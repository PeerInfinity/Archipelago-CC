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

## Pending Investigation: Superbunny Cave Failures

The 3 Superbunny Cave failures are NOT related to the item_rule LOSSY FALLBACK fix. They are access rule issues.

### What We Know

1. All 3 seeds have `glitches_required: hybrid_major_glitches`
2. The UT/worldgen says Superbunny Cave is accessible
3. The server logic sphere does NOT include Superbunny Cave locations
4. Player does NOT have Moon Pearl

### What to Investigate

1. **What rule is exported for Superbunny Cave access?**
   - Generate a failing seed and examine the `_rules.json`
   - Look at the access rule for Superbunny Cave locations

2. **What rule does the original ALttP world have?**
   - Debug the original world's access rule for Superbunny Cave
   - Compare with exported rule

3. **Is CanReachEntrance sufficient?**
   - The exported rules use `CanReachEntrance(X)` for superbunny paths
   - Does this correctly capture the path context from the BFS?

4. **Is there a simpler fix than BunnyPaths?**
   - Could we fix the closure analysis to properly export the bunny rule structure?
   - Is the issue in how the rule is exported or how it's evaluated?

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
# Run fuzzer for ALttP (1000 seeds)
source .venv/bin/activate
python scripts/test/ut-fuzz-single-game.py --game alttp --count 1000

# Generate a specific failing seed
python Generate.py --weights_file_path "378-0.yaml" --multi 1 --seed 24408062

# Check fuzzer results
cat fuzz_output/report.json
cat fuzz_output/error/alttp/168/168.log
```

## Related Documents

- `CC/docs/plans/entrance-aware-bunny-evaluation.md` (deleted in revert)
- `CC/docs/plans/bunny-paths-preserve-original-requirements.md` (deleted in revert)
- These documents are available in git history before commit `cfb30e7d8`
