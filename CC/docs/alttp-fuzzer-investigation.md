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

## Remaining Issues

The partial fixes improve some cases but don't fully solve the problem. The remaining issue is:

**Chained add_rule Analysis**: When multiple `add_rule` calls are chained (e.g., base rule + stalfos_rule + lamp_requirement), the innermost original rule may still fail analysis. When this happens, only the outer rules are preserved while the original rule's requirements are lost.

Example: Eastern Palace - Big Key Chest ends up with only `can_kill_most_things(4) AND Lamp` when it should have the full self-locking key requirement.

### Root Cause
The `location_item_name` comparison pattern in the original rule:
```python
location_item_name(state, 'Eastern Palace - Big Key Chest', player) == ('Big Key (Eastern Palace)', player)
```
This pattern requires:
1. AST analysis to recognize the function call
2. The game handler to convert it to `placement_lookup` rule type
3. The comparison to be preserved with the tuple on the right side

When options like `enemy_shuffle` trigger `add_rule` to wrap the original rule, the closure function analyzer may fail to fully analyze the nested lambda chain, resulting in lost requirements.

## Workaround

Currently, there is no workaround. Games with self-locking rules may fail fuzzer testing when certain options are enabled.

## Test Commands

```bash
# Reproduce a specific failure
python fuzz.py -r 1 -j 1 -g alttp -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed 1

# Check failure logs
cat fuzz_output/error/alttp/0/*.log

# Check YAML options
cat fuzz_output/error/alttp/0/*.yaml

# Compare exported rules
python -c "import json; print(json.dumps(json.load(open('frontend/presets/alttp/AP_<SEED>/AP_<SEED>_rules.json'))['regions']['1']['Eastern Palace']['locations'][...]['access_rule'], indent=2))"
```
