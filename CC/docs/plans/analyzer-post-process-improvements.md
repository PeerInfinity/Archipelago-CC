# Analyzer Post-Process Improvements Plan

## Implementation Status

| Improvement | Status | Notes |
|-------------|--------|-------|
| For loop detection | ✅ IMPLEMENTED | Detects state-dependent for loop bodies |
| Conditional branch evaluation | ⏳ Partial | Related - for loops now preserved as helpers |
| F-string multi-pass resolution | ✅ IMPLEMENTED | expand_rule already called during export - removed redundant post_process_data |
| Closure variable capture | ✅ IMPLEMENTED | Parameter substitution for rule dict args |
| Dict subscript resolution | ✅ IMPLEMENTED | Added expand_rule to civ_6 for era subscripts |
| State method optimization | ✅ IMPLEMENTED | Added expand_rule to tww (kept post_process_data as backup) |

### Implementation Notes (2025-12-17)

**For Loop Detection Enhancement (ast_visitors.py)**

The `has_dynamic_for_loops` function was improved to detect for loops with state-dependent bodies:

```python
def contains_state_reference(node):
    """Check if an AST node references 'state' anywhere."""
    for child in ast.walk(node):
        if isinstance(child, ast.Name) and child.id == 'state':
            return True
    return False

for node in ast.walk(tree):
    if isinstance(node, ast.For):
        # Check if the loop body contains state-dependent operations
        for body_node in node.body:
            if contains_state_reference(body_node):
                return True  # Preserve as helper
```

**Results:**
- KH1's `has_x_worlds` is now correctly preserved as a helper
- The function body (with for loop and state.has() calls) is exported to frontend
- Frontend JavaScript can execute the helper at runtime

**Remaining Issue - Parameter Substitution:**
- When `has_parasite_cage` is inlined, it references parameter `worlds`
- `worlds` is passed as `has_x_worlds(state, player, 3, ...)`
- The analyzer preserves `has_x_worlds` as a helper call
- BUT: it doesn't substitute the `worlds` parameter with this helper call
- Result: `{"type": "name", "name": "worlds"}` in the exported rule
- **This requires closure variable capture / parameter substitution (Phase 2)**

---

## Overview

This document outlines improvements to the rule analyzer that would reduce or eliminate the need for game-specific `post_process_data()` implementations. These improvements address analyzer limitations identified in the following exporters:

| Exporter | Issue | Priority |
|----------|-------|----------|
| civ_6.py | Dict subscript resolution | Medium |
| kdl3.py | F-string multi-pass resolution | High |
| kh1.py | Closure parameter capture, conditional evaluation | High |
| v6.py | Loop variable closure capture | High |
| tww.py | State method → setting optimization | Low |

## 1. Dict Subscript Resolution

### Problem

The analyzer cannot resolve subscript expressions like `world.era_required_items[era]` where the dictionary exists at runtime but the subscript key is a constant.

**Current analyzer output:**
```json
{
  "type": "subscript",
  "value": {"type": "constant", "value": ["ERA_ANCIENT", "ERA_CLASSICAL", ...]},
  "index": {"type": "constant", "value": "ERA_ANCIENT"}
}
```

**Expected output:**
```json
{
  "type": "constant",
  "value": ["Item1", "Item2", "Item3"]
}
```

### Root Cause

The analyzer extracts dict keys when it encounters a subscript on a dict, but doesn't attempt to resolve the subscript when both the dict and index are available.

### Proposed Solution

Add subscript resolution logic to the analyzer that:
1. Detects when a subscript has both a constant dict value and a constant index
2. Resolves the subscript to the actual value from the dict
3. Falls back to current behavior if resolution fails

### Implementation Location

`exporter/rule_analyzer.py` - in the subscript handling logic

### Affected Files

- `exporter/rule_analyzer.py` - Add subscript resolution
- `exporter/games/civ_6.py` - Remove `_fix_era_subscripts()` and `post_process_data()`

### Test Cases

1. Simple dict subscript: `{"a": 1, "b": 2}["a"]` → `1`
2. Dict with list values: `{"era": ["item1", "item2"]}["era"]` → `["item1", "item2"]`
3. Nested subscript: Should not resolve if inner value is not constant

---

## 2. F-String Multi-Pass Resolution

### Problem

F-strings containing complex expressions (like subscripts into imported modules) are not fully resolved during initial analysis. kdl3.py works around this by running `expand_rule()` again in `post_process_data()`.

**Example f-string:**
```python
f"{location_name.level_names_inverse[level]} - Stage Clear"
```

### Root Cause

The f-string resolution happens during initial rule analysis, but some components (like module attribute subscripts) may not be resolvable until after the full rule tree is built.

### Proposed Solution

**Option A: Deferred Resolution Queue**
- During analysis, mark unresolved f-strings with a special node type
- After initial analysis completes, run a second pass to resolve deferred f-strings
- Game exporters can provide resolution context (like `level_names_inverse` mappings)

**Option B: Pre-load Module Data**
- Load game-specific module data (like `level_names_inverse`) before rule analysis
- Make this data available during f-string resolution
- Requires game exporters to declare what module data they need

### Recommendation

Option B is cleaner - add a new exporter hook:

```python
def get_preloaded_module_data(self) -> Dict[str, Any]:
    """Return module data to make available during rule analysis."""
    return {
        'level_names_inverse': self.level_names_inverse
    }
```

### Implementation Location

- `exporter/rule_analyzer.py` - F-string resolution logic
- `exporter/games/base.py` - Add `get_preloaded_module_data()` hook

### Affected Files

- `exporter/rule_analyzer.py` - Enhanced f-string resolution
- `exporter/games/base.py` - New hook method
- `exporter/games/kdl3.py` - Remove `post_process_data()`, implement hook

---

## 3. Closure Variable Capture

### Problem

Two related issues with closures:

**3a. Loop Variable Capture (v6.py)**

Python closures capture variables by reference, not by value. When a loop creates lambdas that reference the loop variable, the analyzer needs to capture the variable's value at each iteration.

```python
for i in range(len(areas)):
    set_rule(loc, lambda s: _has_trinket_range(s, player,
        door_cost * (area_cost_map[i] - 1),  # 'i' captured by reference
        door_cost * area_cost_map[i]))
```

**3b. Parameter Reference Capture (kh1.py)**

When helper functions are inlined, parameter references remain unresolved:

```python
def has_all_magic_lvx(state, player, level):
    return state.has_all_counts({
        "Progressive Fire": level,  # 'level' is a parameter
        ...
    }, player)
```

### Root Cause

The analyzer doesn't track:
1. Loop variable values at each iteration
2. Parameter values when inlining function calls

### Proposed Solution

**For Loop Variables:**
1. Detect closure creation inside loops
2. Capture the loop variable's current value into the closure's `__closure__` cell
3. Store these captured values for use during rule analysis

**For Parameters:**
1. When inlining a function call, track the mapping of parameter names to argument values
2. During analysis of the inlined body, substitute parameter references with their argument values
3. Add a parameter substitution context stack for nested inlining

### Implementation Location

- `exporter/rule_analyzer.py` - Closure and parameter tracking

### Affected Files

- `exporter/rule_analyzer.py` - Enhanced closure analysis
- `exporter/games/v6.py` - Remove `post_process_data()`
- `exporter/games/kh1.py` - Remove `_fix_has_all_counts_rule()` (partial)

### Complexity

This is the most complex improvement. Consider implementing in phases:
1. Phase 1: Parameter substitution during inlining
2. Phase 2: Loop variable capture

---

## 4. Conditional Branch Evaluation

### Problem

When the analyzer encounters conditionals where one branch cannot be evaluated, it produces unexpected results. In kh1.py, this manifests as `constant 0.0`:

```python
# Original Python
if difficulty >= LOGIC_MINIMAL:
    return True
else:
    return has_x_worlds(state, player, num_of_worlds, ...)
```

**Current analyzer output:**
```json
{
  "type": "conditional",
  "test": {"type": "compare", "left": {"type": "constant", "value": 5}, "op": ">=", "right": {"type": "constant", "value": 15}},
  "if_true": {"type": "constant", "value": true},
  "if_false": {"type": "constant", "value": 0.0}
}
```

The `if_false` branch becomes `0.0` because `has_x_worlds` couldn't be analyzed.

### Root Cause

1. The analyzer attempts to inline `has_x_worlds` but fails
2. Failed inlining produces a falsy result (`0.0` or `None`)
3. This falsy result is stored as the branch value

### Proposed Solution

**Option A: Preserve Unevaluated Branches**
- When a branch can't be evaluated, preserve it as a helper call instead of producing `0.0`
- Add a fallback: `{"type": "helper", "name": "has_x_worlds", "args": [...]}`

**Option B: Evaluate Known Conditionals**
- When `test` is fully constant (like `5 >= 15`), evaluate it immediately
- Return only the taken branch, eliminating dead code
- In this case: `5 >= 15` is `False`, so return `if_false` branch

**Option C: Combined Approach**
- First try Option B (evaluate constant tests)
- If the taken branch fails analysis, use Option A (preserve as helper)

### Recommendation

Option C provides the best results:
1. Dead code elimination when possible
2. Graceful fallback to helper calls when analysis fails

### Implementation Location

- `exporter/rule_analyzer.py` - Conditional handling

### Affected Files

- `exporter/rule_analyzer.py` - Enhanced conditional evaluation
- `exporter/games/kh1.py` - Remove conditional fixing code

---

## 5. State Method → Setting Optimization

### Problem

Some games define state methods that simply return setting values:

```python
# In TWW world
def _tww_in_swordless_mode(self, state):
    return self.logic_in_swordless_mode
```

The analyzer outputs these as state method calls, but they could be simplified to setting lookups.

### Current Behavior

```json
{"type": "state_method", "method": "_tww_in_swordless_mode", "args": []}
```

### Optimized Output

```json
{"type": "setting_value", "setting": "logic_in_swordless_mode"}
```

### Proposed Solution

Add an **opt-in** optimization that:
1. Detects state methods that only return a setting/attribute value
2. Replaces the method call with a direct setting lookup
3. Is controlled by an exporter configuration attribute

### Configuration

Add to `BaseGameExportHandler`:

```python
class BaseGameExportHandler:
    # Enable optimization of state methods that return settings
    # Set to a dict mapping method names to setting names, or True for auto-detection
    OPTIMIZE_STATE_METHOD_TO_SETTING: Dict[str, str] | bool = False
```

**Usage in game exporter:**

```python
class TWWGameExportHandler(GenericGameExportHandler):
    OPTIMIZE_STATE_METHOD_TO_SETTING = {
        '_tww_in_swordless_mode': 'logic_in_swordless_mode',
        '_tww_in_required_bosses_mode': 'logic_in_required_bosses_mode',
        '_tww_obscure_1': 'logic_obscure_1',
        # ... etc
    }
```

Or for auto-detection (more complex):

```python
OPTIMIZE_STATE_METHOD_TO_SETTING = True  # Auto-detect simple getter methods
```

### Implementation Location

- `exporter/games/base.py` - Configuration attribute
- `exporter/rule_analyzer.py` or `exporter/games/generic.py` - Optimization logic

### Affected Files

- `exporter/games/base.py` - Add `OPTIMIZE_STATE_METHOD_TO_SETTING`
- `exporter/rule_analyzer.py` - Add optimization pass (if done at analysis time)
- `exporter/games/generic.py` - Add optimization pass (if done at export time)
- `exporter/games/tww.py` - Remove `post_process_data()`, add configuration

### Considerations

- **Explicit mapping** (dict) is safer than auto-detection
- Auto-detection would need to analyze method bodies, which is complex
- Explicit mapping also documents the optimization clearly

---

## Implementation Priority

### Phase 1: High Impact, Moderate Complexity
1. **Conditional Branch Evaluation** (Option C) - Fixes most kh1.py issues
2. **F-String Multi-Pass Resolution** (Option B) - Fixes kdl3.py

### Phase 2: High Impact, High Complexity
3. **Closure Variable Capture** - Fixes v6.py and remaining kh1.py issues

### Phase 3: Lower Priority
4. **Dict Subscript Resolution** - Fixes civ_6.py
5. **State Method Optimization** - Fixes tww.py (opt-in feature)

---

## Testing Strategy

### Unit Tests

Add tests to `exporter/tests/` for each improvement:

1. `test_subscript_resolution.py` - Dict subscript cases
2. `test_fstring_resolution.py` - F-string with module data
3. `test_closure_capture.py` - Loop and parameter closure cases
4. `test_conditional_evaluation.py` - Constant conditional simplification
5. `test_state_method_optimization.py` - Setting optimization

### Integration Tests

For each affected game:
1. Run export with improvements enabled
2. Verify `post_process_data()` is no longer needed
3. Run spoiler tests to verify correctness

### Regression Tests

1. Export all games before and after changes
2. Compare outputs to ensure no unintended changes
3. Run full test suite: `python scripts/test/test-all-templates.py -p`

---

## Migration Path

For each improvement:

1. **Implement** the analyzer improvement
2. **Test** that it produces equivalent output to post_process_data()
3. **Add** configuration flag if needed (like `OPTIMIZE_STATE_METHOD_TO_SETTING`)
4. **Remove** the post_process_data() code from the game exporter
5. **Document** any new exporter hooks or configuration options

---

## Open Questions

1. **Closure capture scope**: Should we attempt to capture all closure variables, or only those referenced in the rule body?

2. **Auto-detection for state method optimization**: Is the complexity of auto-detecting simple getter methods worth it, or should we always require explicit mapping?

3. **Error handling**: When subscript/f-string resolution fails, should we:
   - Silently preserve the unresolved form?
   - Log a warning?
   - Fail the export?

4. **Performance**: Will multi-pass resolution significantly impact export time for large games?

---

## References

- `exporter/games/civ_6.py` - Dict subscript workaround
- `exporter/games/kdl3.py` - F-string workaround
- `exporter/games/kh1.py` - Closure/conditional workarounds
- `exporter/games/v6.py` - Loop closure workaround
- `exporter/games/tww.py` - State method optimization
- `CC/docs/exporter-content-types.md` - Full exporter analysis
