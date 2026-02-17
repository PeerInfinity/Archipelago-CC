# ALttP UT Fuzzer Investigation Report

## Summary

Investigation into ALttP UT fuzzer testing failures. The game passes canonical worldgen testing (seed=1, default options) but fails ~40-60% of fuzz tests with random option configurations.

## Root Cause

The failures are caused by **incorrect rule export** when certain game options are enabled. The exporter produces malformed rules that cause logic mismatches between the Universal Tracker and the server.

### Affected Options

The following options appear to trigger export bugs:
- `enemy_shuffle: true`
- `entrance_shuffle: full`
- `small_key_shuffle: any_world` or `different_world`

### Bug Details

Self-locking rules like the one for "Eastern Palace - Big Key Chest" are incorrectly exported.

**Original Python rule:**
```python
state._lttp_has_key('Small Key (Eastern Palace)', player, 2) or (
    (location_item_name(state, 'Eastern Palace - Big Key Chest', player) ==
     ('Big Key (Eastern Palace)', player)) and
    state.has('Small Key (Eastern Palace)', player)
)
```

**Correctly exported (canonical seed):**
```json
{
  "rule": "Or",
  "children": [
    {"rule": "Has", "args": {"item_name": "Small Key (Eastern Palace)", "count": 2}},
    {
      "rule": "And",
      "children": [
        {
          "rule": "Compare",
          "args": {
            "left": {"rule": "AST_placement_lookup", "args": {"location": "Eastern Palace - Big Key Chest"}},
            "op": "==",
            "right": ["Big Key (Eastern Palace)", 1]
          }
        },
        {"rule": "Has", "args": {"item_name": "Small Key (Eastern Palace)"}}
      ]
    }
  ]
}
```

**Incorrectly exported (failing fuzzer seeds):**
```json
{
  "rule": "Or",
  "children": [
    {"rule": "Has", "args": {"item_name": "Small Key (Eastern Palace)"}},
    {"rule": "Has", "args": {"item_name": "Eastern Palace - Big Key Chest"}},
    {"rule": "Has", "args": {"item_name": "Big Key (Eastern Palace)"}}
  ]
}
```

### Problems with Incorrect Export

1. **Count requirement lost**: `_lttp_has_key(..., 2)` becomes `Has(item, count=1)` instead of `Has(item, count=2)`
2. **Location name as item**: The location name "Eastern Palace - Big Key Chest" appears as an item name in a `Has` rule
3. **Rule structure flattened**: The nested `And(Compare, Has)` becomes a flat list of `Has` rules
4. **Extra items added**: "Big Key (Eastern Palace)" appears as a separate Has rule when it should be part of the Compare

### Affected Locations

Any location with a self-locking rule pattern (where `location_item_name` is used to check if a specific key is placed at the location) is affected:
- Eastern Palace - Big Key Chest
- Turtle Rock - Big Key Chest
- Other dungeon locations with similar patterns

## Technical Details

### Investigation Path

1. Reproduced failure with fuzzer seed 1
2. Compared exported rules.json between canonical seed and failing seed
3. Found canonical seed has correct `AST_placement_lookup` in Compare rule
4. Found failing seed has location name incorrectly in Has rule
5. Traced issue to exporter/analyzer components

### Relevant Files

- `exporter/analyzer/ast_visitors/call_visitor.py` - Handles `_lttp_has_key` state method
- `exporter/converter/ast_to_rule_builder.py` - Converts AST rules to Rule Builder format
- `worlds/alttp/Rules.py:325-329` - Original self-locking rule definition

### Not the Issue

The following were investigated and found NOT to be the root cause:
- `worlds/tracker/TrackerCore.py` - The `pre_fill` step execution order was checked but didn't fix the issue
- `world_generator/rule_codegen.py` - The world generator correctly converts the exported rules; the bug is in the exported data itself

## Recommended Fix

The fix should be in the exporter, specifically in how self-locking rule patterns are analyzed when certain options (like `enemy_shuffle`) are enabled.

Possible approaches:
1. Ensure `_lttp_has_key` always produces `count_check` with correct count
2. Ensure `location_item_name` comparisons are preserved as `Compare(AST_placement_lookup, ==, tuple)`
3. Add tests for self-locking rule export with various option combinations

## Partial Fixes Applied

The following fixes have been implemented in `exporter/analyzer/closure_function_analyzer.py`:

### 1. Location Name Filtering (is_item_name)
Added a heuristic to filter location names from being treated as item names in bytecode analysis:
- Location names like "Eastern Palace - Big Key Chest" contain " - " but no parentheses
- Item names like "Small Key (Eastern Palace)" contain parentheses
- This prevents location names from appearing incorrectly in Has rules

### 2. Error Result Handling (_analyze_add_rule_pattern)
Fixed the error detection when analyzing combined add_rule lambdas:
- Previously only checked for `None` results before trying bytecode fallback
- Now also checks for `{'type': 'error'}` dict results
- Ensures failed analysis properly triggers bytecode fallback

### 3. Ambiguous AND/OR Pattern Detection (_analyze_via_bytecode)
Changed behavior when both JUMP_IF_TRUE and JUMP_IF_FALSE are detected:
- Previously defaulted to OR which produced incorrect rule structures
- Now returns `None` to indicate analysis failed rather than guessing wrong
- This allows the caller to handle the failure appropriately

### 4. Multiline Lambda Source Extraction (MAJOR FIX)
Fixed the core issue preventing self-locking rules from being correctly exported:

**Problem**: When a multiline lambda is passed as an argument to a function call (e.g., `set_rule(..., lambda: ...)`):
1. `inspect.getsource()` returns source code by line boundaries, not expression boundaries
2. `textwrap.dedent()` removes leading whitespace from continuation lines, breaking implicit line continuation
3. `inspect.getsource()` may include trailing parens from the outer function call

**Solution**: Try multiple source parsing strategies:
1. Try dedented source first (works for most single-line lambdas)
2. If that fails, join all lines into a single line
3. Strip trailing unbalanced parens from outer function calls
4. Added `count_paren_balance()` helper that correctly ignores parens inside strings

**Result**: Self-locking rules like Eastern Palace - Big Key Chest now correctly export with:
- `location_item_name(...)` converted to `placement_lookup` rule
- The comparison preserved as `compare` rule
- All nested conditions properly structured

## Status

**PARTIALLY FIXED**: The multiline lambda source extraction fix resolved the self-locking rule export issue. However, fuzzer tests still fail ~60% of the time due to additional issues documented below.

## Remaining Issues (January 2026 Analysis)

Fuzzer testing with 20 runs shows: 8 successes, 12 failures (60% failure rate).

### Common Failure Patterns

Analysis of failure logs reveals these recurring issues:

#### 1. Flute/Flute Spot Logic Export
**Symptom**: "Flute Spot was expected to be in logic but wasn't"
- The UT state shows `Activated Flute:1` but Flute Spot location remains inaccessible
- Occurs with `entrance_shuffle: full` and `mode: inverted`
- The flute activation event chain may not be correctly exported

#### 2. Blacksmith/Purple Chest Event Chain
**Symptom**: "Purple Chest, Blacksmith were expected to be in logic but weren't"
- The UT state shows `Return Smith:1, Pick Up Purple Chest:1, Get Frog:1`
- Events are processed but the actual locations aren't accessible
- Related to complex event dependencies (Frog → Smith → Purple Chest)

#### 3. Zora's Ledge Access Rules
**Symptom**: "Zora's Ledge was in server logic but not expected in UT"
- Server considers it accessible, UT doesn't
- Often occurs with `glitches_required: hybrid_major_glitches`
- Glitch-dependent access rules may not be correctly exported

#### 4. Rule Expansion Depth/Size Limits
**Symptom**: Log messages like:
- `Rule expansion exceeded maximum depth (100)`
- `ALttP rule too large (53.0 KB > 50 KB), simplifying to constant True`
- Rules with complex helper references exceed processing limits
- When simplified to True, locations become artificially accessible

### Affected Option Combinations

Failures correlate with these option patterns:

| Option | Problematic Values | Issue |
|--------|-------------------|-------|
| `glitches_required` | `overworld_glitches`, `hybrid_major_glitches` | Glitch rules not exported |
| `mode` | `inverted` | Inverted mode-specific rules |
| `entrance_shuffle` | `full`, `restricted` | Complex entrance logic |
| `retro_caves` | `true` | Affects item/location accessibility |

### Root Causes

1. **Event chain export**: Multi-step event dependencies (Frog → Smith → Purple Chest, Flute activation) aren't correctly captured in the exported rules

2. **Glitch rule complexity**: Advanced glitch modes have complex conditional rules that either:
   - Exceed the analysis depth limit (10)
   - Produce rules too large to export (>50KB)
   - Get simplified incorrectly

3. **Rule size limits**: The exporter has protective limits:
   - Max analysis depth: 10 (ClosureFunctionAnalyzer)
   - Max rule expansion depth: 100
   - Max rule size: 50KB
   - When exceeded, rules are simplified to constant True (over-permissive)

### Additional Testing Results

**Test: Disable glitch modes and inverted mode**
```bash
python fuzz.py -r 20 -j 4 -g alttp --hook worlds.tracker.fuzzer_hook:Hook \
  --disallow-options "glitches_required=overworld_glitches,hybrid_major_glitches,major_glitches,minor_glitches;mode=inverted"
```
Result: 65% success (13/20), improvement from 40% baseline

Even without glitch modes, failures occur due to:
1. **Swamp Palace - Big Chest**: Self-locking rules with key counts
2. **Turtle Rock - Big Key Chest**: Rule simplified to True after exceeding size limit
3. **Rule explosion**: Options like `entrance_shuffle: dungeons_crossed` + shop randomization create 500KB+ rules

### Root Cause Summary

The primary remaining issue is **rule size explosion**:
1. Complex option combinations (entrance shuffle + shop randomization + retro modes) create exponentially large rules
2. Rules exceeding 50KB are simplified to `constant True` during export
3. The simplified rules don't match the original game logic, causing sphere mismatches

### Implemented Fixes (January 2026)

1. **Early rule simplification**: Rules over 200KB are simplified to Moon Pearl check in `alttp.py:expand_rule()`
   - Threshold raised from 100KB due to lossless simplification improvements
   - Prevents further explosion during expansion
   - Conservative but prevents timeouts and memory issues

2. **Bunny path depth limit**: `MAX_BUNNY_PATH_DEPTH = 3` in `closure_function_analyzer.py`
   - Limits recursive path analysis in bunny rules
   - Falls back to Moon Pearl check when depth exceeded

3. **Options limit**: `MAX_BUNNY_OPTIONS = 10` in `closure_function_analyzer.py`
   - Limits number of path options analyzed per bunny rule
   - Prevents explosion from hundreds of entrance combinations

4. **Lossless rule simplification** (NEW): Added to `rule_expansion.py`
   - Fingerprint-based deduplication: Removes structurally identical conditions
   - Constant folding: `AND(True, X) → X`, `OR(False, X) → X`
   - Flattening: `OR(OR(A, B), C) → OR(A, B, C)`
   - Domination: `AND(False, X) → False`, `OR(True, X) → True`
   - Applied automatically during rule expansion via `_simplify_and_or()`

5. **Improved dominance pruning** (NEW): Fixed in `closure_function_analyzer.py`
   - Options without `can_reach` now correctly dominate options with `can_reach` when items are subset
   - Example: `has(Moon Pearl)` dominates `can_reach(X) AND has(Moon Pearl)`
   - Significantly reduces bunny rule size when Moon Pearl is sufficient

6. **Fingerprint-based deduplication** (NEW): Added to `closure_function_analyzer.py`
   - `_rule_fingerprint()` creates canonical string representation for rules
   - `_simplify_or_conditions()` and `_simplify_and_conditions()` use fingerprints
   - Catches structurally identical rules even when they're different objects

7. **Nested structure flattening** (NEW): Added to `closure_function_analyzer.py`
   - `_flatten_or_children()` and `_flatten_and_children()` methods
   - Applied before deduplication to maximize duplicate detection

### Test Results

With all lossless simplification fixes:
- **Timeouts eliminated**: 0 timeouts in 30-run test (was 3 before)
- **Success rate**: ~20-40% depending on option combinations
- **Remaining failures**: Mostly due to logic export issues, not rule size

### Remaining Issues

1. **Event chain rules**: Blacksmith, Flute Spot, Purple Chest still have issues with multi-step event dependencies
2. **Location access mismatches**: Some locations (Old Man, Tower of Hera, Waterfall Fairy) show server/UT logic differences
3. **Glitch mode rules**: `hybrid_major_glitches` and `overworld_glitches` have complex rules that may not export correctly

### Recommended Future Fixes

1. **Event chains**: Fix Flute activation and Blacksmith event dependencies in the exporter
2. **Glitch rules**: Investigate why glitch-dependent rules cause logic mismatches
3. **Location access**: Debug specific location access rules that differ between server and UT

### Next Steps for Investigation

1. **Event chains**: Trace Flute/Blacksmith event dependencies in the exporter
2. **Location mismatches**: Compare specific location rules between exported JSON and original Python
3. **Glitch rules**: Analyze how glitch-related rules are being exported

## Test Commands

```bash
# Reproduce a specific failure
python fuzz.py -r 1 -j 1 -g alttp -n 1 --hook worlds.tracker.fuzzer_hook:Hook --starting-seed 1

# Check failure logs
cat fuzz_output/error/alttp/0/*.log

# Check YAML options
cat fuzz_output/error/alttp/0/*.yaml

# Compare exported rules
python -c "import json; print(json.dumps(json.load(open('frontend/presets/alttp/AP_<SEED>/AP_<SEED>_rules.json'))['regions']['1']['Eastern Palace']['locations'][...]['access_rule'], indent=2))"
```
