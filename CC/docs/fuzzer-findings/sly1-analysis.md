# Sly Cooper and the Thievius Raccoonus - UT Fuzzer Analysis

**APWorld**: sly1.apworld v0.3.3-alpha
**Source**: https://github.com/hoppel16/ArchipelagoBranchSly1
**Date**: 2026-01-24
**Failure Rate**: ~40% (varies by option combinations)

## Summary

The sly1 apworld has two distinct failure modes in UT fuzzer testing:

1. **AST_sum_of Rule Conversion Bug** (~30% of failures): The world generator cannot convert `AST_sum_of` patterns, causing incorrect logic for the Clockwerk boss fight access rule.

2. **FillError** (~10% of failures): Certain option combinations cause more progression items than available locations, which is an apworld design issue.

## Issue 1: AST_sum_of Rule Not Supported

### Root Cause

The world generator (`world_generator/rule_codegen.py`) doesn't have a converter for `AST_sum_of` rules. When encountered, it falls back to `True_()` (line 1232-1234).

### Affected Code

Original rule from `sly1/Rules.py` (line 70):
```python
if options.UnlockClockwerk.value == 1:  # boss_victories mode
    set_rule(multiworld.get_entrance("Hideout -> Cold Heart of Hate", player),
        lambda state: sum(state.has(boss, player) for boss in bosses) >= options.RequiredBosses.value)
```

Where `bosses = ["Beat Raleigh", "Beat Muggshot", "Beat Mz. Ruby", "Beat Panda King"]`.

### Exported JSON (from rules export)

```json
{
  "name": "Hideout -> Cold Heart of Hate",
  "connected_region": "Cold Heart of Hate",
  "access_rule": {
    "rule": "Compare",
    "args": {
      "left": {
        "rule": "AST_sum_of",
        "args": {
          "element_rule": {
            "type": "item_check",
            "item": {"type": "name", "name": "boss"}
          },
          "iterator_info": {
            "target": {"type": "name", "name": "boss"},
            "iterator": {
              "type": "constant",
              "value": ["Beat Raleigh", "Beat Muggshot", "Beat Mz. Ruby", "Beat Panda King"]
            }
          }
        }
      },
      "op": ">=",
      "right": 2
    }
  }
}
```

### Generated Code (Incorrect)

```python
world.set_rule(
    multiworld.get_entrance("Hideout -> Cold Heart of Hate", player),
    Compare(True_(), ">=", 2)  # BUG: True_() instead of boss count!
)
```

### Correct Conversion Should Be

```python
world.set_rule(
    multiworld.get_entrance("Hideout -> Cold Heart of Hate", player),
    HasFromListUnique('Beat Raleigh', 'Beat Muggshot', 'Beat Mz. Ruby', 'Beat Panda King', count=2)
)
```

### Impact

The incorrect rule causes both false positives and false negatives:
- **False positive**: UT thinks Clockwerk is accessible when no bosses are defeated (Compare(True_(), ">=", X) where X <= 1)
- **False negative**: UT thinks Clockwerk is NOT accessible when enough bosses ARE defeated

## Issue 2: FillError

### Root Cause

The apworld can generate more progression items than available locations for certain option combinations. This manifests as:

```
FillError: Not enough locations for progression items. There are 11 more
progression items than there are available locations.
```

### Trigger Conditions

Likely related to:
- High `RequiredPages` values with limited location pools
- Certain `ExcludeMinigames` combinations reducing available locations
- Bundle size options affecting item/location balance

This is an inherent design issue with the apworld, not a tracker/exporter bug.

## Recommendations

### Fix Option A: Add AST_sum_of Support (Recommended)

Add support for `AST_sum_of` in `world_generator/rule_codegen.py`:

1. Add mapping: `'AST_sum_of': 'ast_sum_of'` to `rb_to_type` dict
2. Implement `_convert_ast_sum_of()` that detects the boolean-counting pattern:
   - When element_rule is `item_check` on the iterator variable
   - Convert to `HasFromListUnique(*items, count=threshold)`

### Fix Option B: Create Custom Exporter

Create `exporter/games/unofficial/sly1.py` with a rule handler that intercepts the sum comprehension during export and converts it to a simpler format.

### For FillError Issue

Report to the apworld maintainer at https://github.com/hoppel16/ArchipelagoBranchSly1/issues

## Test Commands

```bash
# Single run with specific seed
python fuzz.py -r 1 -j 1 -g sly1 -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed 2

# Multiple runs to check failure rate
python fuzz.py -r 10 -j 4 -g sly1 -n 1 --hook worlds.tracker.fuzzer_hook:Hook

# Full test via test runner
python scripts/test/test-all-ut-fuzz.py --runs 10 --include-list "Sly Cooper and the Thievius Raccoonus.yaml" --custom-worlds-only
```

## Files Involved

- `custom_worlds/sly1.apworld` - The apworld package
- `world_generator/rule_codegen.py` - Rule conversion logic (needs AST_sum_of support)
- `rule_builder/rules.py` - HasFromListUnique class (already exists, can be used)
- `exporter/games/unofficial/` - Location for potential custom exporter

## Related Code Locations

- `rule_codegen.py:1061-1075` - `rb_to_type` mapping (missing AST_sum_of)
- `rule_codegen.py:1182-1217` - `converters` dict (missing ast_sum_of handler)
- `rule_codegen.py:1232-1234` - Fallback to `True_()` for unknown rules
- `rule_builder/rules.py:1795` - HasFromListUnique class definition
