# Sly Cooper and the Thievius Raccoonus - UT Fuzzer Analysis

**APWorld**: sly1.apworld v0.3.3-alpha
**Source**: https://github.com/hoppel16/ArchipelagoBranchSly1
**Date**: 2026-01-24
**Status**: ✅ FIXED (logic mismatch), ⚠️ REMAINING (FillError - apworld issue)

## Summary

The sly1 apworld had two distinct failure modes in UT fuzzer testing:

1. **AST_sum_of Rule Conversion Bug** - **FIXED**: The world generator now correctly converts `AST_sum_of` patterns to `HasFromListUnique`.

2. **FillError** (~12% of runs): Certain option combinations cause more progression items than available locations. This is an inherent apworld design issue.

### Test Results

| Metric | Before Fix | After Fix |
|--------|------------|-----------|
| Success Rate | ~60% | ~88% |
| Logic Mismatches | ~30% | 0% |
| FillError | ~10% | ~12% |

## Issue 1: AST_sum_of Rule Not Supported (FIXED)

### Root Cause

The world generator (`world_generator/rule_codegen.py`) didn't have a converter for `AST_sum_of` rules. When encountered, it fell back to `True_()`.

### Fix Applied

Added `_try_convert_ast_sum_of_compare()` method in `rule_codegen.py` that:
1. Detects the pattern: `sum(state.has(item) for item in items) >= count`
2. Converts to: `HasFromListUnique(*items, count=count)`

### Affected Code

Original rule from `sly1/Rules.py` (line 70):
```python
if options.UnlockClockwerk.value == 1:  # boss_victories mode
    set_rule(multiworld.get_entrance("Hideout -> Cold Heart of Hate", player),
        lambda state: sum(state.has(boss, player) for boss in bosses) >= options.RequiredBosses.value)
```

Where `bosses = ["Beat Raleigh", "Beat Muggshot", "Beat Mz. Ruby", "Beat Panda King"]`.

### Generated Code (After Fix)

```python
world.set_rule(
    multiworld.get_entrance("Hideout -> Cold Heart of Hate", player),
    HasFromListUnique('Beat Raleigh', 'Beat Muggshot', 'Beat Mz. Ruby', 'Beat Panda King', count=2)
)
```

## Issue 2: FillError (APWorld Design Issue)

### Root Cause

The apworld can generate more progression items than available locations for certain option combinations. This manifests as:

```
FillError: Not enough locations for progression items. There are N more
progression items than there are available locations.
```

### Trigger Conditions

Likely related to:
- High `RequiredPages` values with limited location pools
- Certain `ExcludeMinigames` combinations reducing available locations
- Bundle size options affecting item/location balance

### Recommendation

Report to the apworld maintainer at https://github.com/hoppel16/ArchipelagoBranchSly1/issues

## Test Commands

```bash
# Single run with specific seed
python fuzz.py -r 1 -j 1 -g sly1 -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed 2

# Multiple runs to check failure rate
python fuzz.py -r 50 -j 8 -g sly1 -n 1 --hook worlds.tracker.fuzzer_hook:Hook

# Full test via test runner
python scripts/test/test-all-ut-fuzz.py --runs 10 --include-list "Sly Cooper and the Thievius Raccoonus.yaml" --custom-worlds-only
```

## Files Changed

- `world_generator/rule_codegen.py` - Added `_try_convert_ast_sum_of_compare()` method
  - Lines ~2771-2777: Call to the new method from `_convert_compare()`
  - Lines ~5357-5456: Implementation of `_try_convert_ast_sum_of_compare()`

## Technical Details

### AST_sum_of Pattern Recognition

The fix recognizes this JSON pattern from the exporter:
```json
{
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
```

The converter:
1. Validates the `element_rule` is an `item_check` on the iterator variable
2. Extracts the item list from `iterator_info.iterator`
3. Extracts the threshold from the right operand
4. Generates `HasFromListUnique(*items, count=threshold)`
