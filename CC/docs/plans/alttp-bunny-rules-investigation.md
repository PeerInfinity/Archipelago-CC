# ALttP Bunny Rules Investigation

## Status
**Current state**: 3/1000 failures in ALttP fuzzer tests (Superbunny Cave locations)
**Branch with working state**: `ut-fuzz-single/a-link-to-the-past/20260131-233658` (based on `b924d4efd`)

## Problem Summary

The ALttP UT fuzzer tests fail for Superbunny Cave locations in glitch modes with entrance shuffle. All 3 failures have the same pattern:

- **Seeds**: 168, 378, 850
- **Failure**: `Superbunny Cave - Top, Superbunny Cave - Bottom were expected to be in logic but weren't`
- **Direction**: UT says accessible, server says NOT accessible (UT too permissive)

### Common Settings in Failing Seeds
- `glitches_required: hybrid_major_glitches` (enables superbunny access)
- Entrance shuffle enabled (full, crossed, or restricted)
- Player does NOT have Moon Pearl in any of these cases

## Key Technical Concepts

### How ALttP Bunny Rules Work

The `set_bunny_rules()` function in `worlds/alttp/Rules.py:1653-1783` runs a **BFS at world generation time** to find valid paths from each Dark World location back to Link state:

```python
# Simplified logic from get_rule_to_add():
possible_options = [lambda state: state.has('Moon Pearl', player)]

# BFS backwards through entrances
queue = [(current_region, [])]
while queue:
    (current, path) = queue.popleft()
    for entrance in current.entrances:
        new_region = entrance.parent_region
        new_path = path + [entrance.access_rule]

        if is_link(new_region):
            # Found a path to Link state!
            possible_options.append(path_to_access_rule(new_path, entrance))

return lambda state: any(rule(state) for rule in possible_options)
```

The final bunny rule is: "Moon Pearl OR (can reach entrance A with items X) OR (can reach entrance B with items Y) ..."

### How add_rule Combines Rules

The `add_rule()` function in `worlds/generic/Rules.py` wraps rules:

```python
def add_rule(spot, rule, combine='and'):
    old_rule = spot.access_rule
    if combine == 'and':
        spot.access_rule = lambda state: rule(state) and old_rule(state)
    else:
        spot.access_rule = lambda state: rule(state) or old_rule(state)
```

So if Library has original rule `has('Book of Mudora')` and bunny rules are added:
```
Final rule = bunny_rule(state) AND has('Book of Mudora')
           = (Moon Pearl OR superbunny_path) AND Book of Mudora
```

## Fixes Applied

### 1. Item Rule Analysis (Committed: 65365af3a)

**Problem**: LOSSY FALLBACK warnings for item rules like:
```
LOSSY FALLBACK: Closure variable 'old_rule' could not be analyzed for target 'Hyrule Castle - Big Key Drop Item Rule'
```

**Root Cause**: The recursive analysis in `call_visitor.py` only checked for `state` arguments. Item rules use `item` (or `i`) instead, so they were skipped.

**Fix**: Added check for `item`/`i` arguments in `call_visitor.py:557-559`:
```python
has_item_arg = any(isinstance(arg, ast.Name) and arg.id in ('item', 'i') for arg in node.args)
if has_state_arg or has_item_arg:
    # Recursive analysis...
```

Also enhanced `_extract_closure_vars()` in `closure_function_analyzer.py` to extract default argument values.

### 2. BunnyPaths Approach (Reverted)

A `BunnyPaths` rule type was implemented to pre-compute and export superbunny path options. This was reverted because:

1. The implementation replaced entire access rules with BunnyPaths, losing original requirements (e.g., Library losing Book of Mudora requirement)
2. Attempts to fix by adding `old_rule` items to BunnyPaths options made some cases too restrictive
3. Some locations weren't being detected as BunnyPaths patterns at all

**Lesson**: The BunnyPaths approach tried to solve too much at once. A simpler approach might work better.

## Root Cause: Python Late Binding Bug in ALttP

**The 3 Superbunny Cave failures are caused by a Python late binding bug in ALttP's `set_bunny_rules()` function.**

### The Bug

In `worlds/alttp/Rules.py`, lines 1735, 1738, 1741, 1743 create lambdas inside a loop:

```python
for entrance in current.entrances:
    new_path = path + [entrance.access_rule]
    # ...
    # Lines 1741, 1743 - LATE BINDING BUG:
    possible_options.append(lambda state: path_to_access_rule(new_path, entrance)(state))
```

Due to Python's late binding, ALL these lambdas capture the SAME `entrance` and `new_path` values - the values from the LAST loop iteration.

**Example demonstrating the bug:**
```python
options = []
for entrance in ['A', 'B', 'C']:
    options.append(lambda: entrance)
print([f() for f in options])  # ['C', 'C', 'C'] - all reference last value!
```

### Why Line 1752 Works Correctly

Line 1752 uses a different pattern that AVOIDS late binding:
```python
possible_options.append(path_to_access_rule(new_path, entrance))
```

This calls `path_to_access_rule` IMMEDIATELY and appends the result. The values are captured at call time, not at lambda evaluation time.

### Detection Strategy

Late-bound lambdas have `path_to_access_rule` in their closure (because they call it at evaluation time).
Correctly-bound lambdas have `entrance` and `path` in their closure but NOT `path_to_access_rule`.

```python
# Late-bound (broken): co_freevars includes 'path_to_access_rule'
lambda state: path_to_access_rule(new_path, entrance)(state)

# Correctly-bound (works): co_freevars is ('entrance', 'path'), no 'path_to_access_rule'
path_to_access_rule(new_path, entrance)  # returns a lambda
```

### Impact on Exported Rules

The exported rule for Superbunny Cave - Top becomes:
```
Or(
    And(CanReachEntrance('Palace of Darkness Hint'), Has('Magic Mirror')),
    CanReachEntrance('Palace of Darkness Hint'),  <-- TOO PERMISSIVE (wrong entrance)
    Has('Moon Pearl')
)
```

The second option should reference a different entrance (the one from Superbunny Cave (Bottom)), but due to late binding, it references the same entrance as the first option.

### Fix Attempt: Skipping Late-Bound Options (Reverted)

**Attempted fix**: Skip all late-bound superbunny options by detecting `path_to_access_rule` in `co_freevars`.

**Implementation**: Added `_is_late_bound_superbunny_option()` to `call_visitor.py` to detect and skip lambdas with `path_to_access_rule` in their closure.

**Result**: Made things MUCH WORSE - failures increased from 3/1000 to 8/20 (40% failure rate).

**Why it failed**: The fix was too aggressive. Many locations only have 1 superbunny path found by the BFS. Even if that path is late-bound, it's still correct because there's no other path to reference incorrectly. The late-binding bug only manifests when MULTIPLE paths are found and all end up referencing the LAST path.

**Better approach needed**: Instead of skipping all late-bound options:
1. Detect when multiple late-bound lambdas reference the SAME entrance (due to late binding)
2. Deduplicate them, keeping only one

Or alternatively, fix the bug in ALttP's `Rules.py` itself (but this modifies original Archipelago code).

### Current Status

**Accepting 3/1000 failure rate** as the baseline. The late-binding bug affects a small subset of locations (Superbunny Cave) only when:
- Multiple superbunny paths are found by BFS
- Both paths get added via late-bound lambdas
- All late-bound lambdas reference the wrong (last) entrance

For most locations with bunny rules, either:
- Only 1 superbunny path exists (late-binding doesn't cause issues)
- The correctly-bound pattern (line 1752) is used

## File Locations

| Purpose | Path |
|---------|------|
| ALttP bunny rules | `worlds/alttp/Rules.py:1653-1783` |
| add_rule function | `worlds/generic/Rules.py:99-108` |
| locality_rules (item_rule wrapping) | `worlds/generic/Rules.py:34-82` |
| Closure function analyzer | `exporter/analyzer/closure_function_analyzer.py` |
| Call visitor (recursive analysis) | `exporter/analyzer/ast_visitors/call_visitor.py` |
| Fuzzer hook | `worlds/tracker/fuzzer_hook.py` |
| ALttP game handler | `exporter/games/official/alttp.py` |

## Fuzzer Test Commands

```bash
# Run fuzzer for ALttP (use exec on Linux to avoid module caching)
source .venv/bin/activate
exec python fuzz.py -r 100 -j 4 -g alttp -n 1 --hook worlds.tracker.fuzzer_hook:Hook

# Generate a specific failing seed
python Generate.py --weights_file_path "378-0.yaml" --multi 1 --seed 24408062

# Check fuzzer results
cat fuzz_output/report.json
cat fuzz_output/error/alttp/168/168.log
```

See `CC/docs/fuzzer-testing.md` for detailed fuzzer documentation.

## Related Documents

- `CC/docs/plans/entrance-aware-bunny-evaluation.md` (deleted in revert)
- `CC/docs/plans/bunny-paths-preserve-original-requirements.md` (deleted in revert)
- These documents are available in git history before commit `cfb30e7d8`
