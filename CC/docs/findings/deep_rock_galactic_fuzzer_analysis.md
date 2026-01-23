# Deep Rock Galactic APWorld - UT Fuzzer Analysis

## Summary

The Deep Rock Galactic apworld (v0.15.2) fails the Universal Tracker fuzz test due to **two separate issues**:

1. **Python Exception**: "Sample larger than population or is negative" - A bug in the apworld's `remove_locations` function
2. **Logic Mismatch**: UT tracking doesn't match server logic for accessible locations

## Issue 1: `random.sample()` Bug

### Root Cause

In `locations.py:400`, the function uses:
```python
keys_to_remove = random.sample(DictRemoveRand, NumToRemove)
```

Where `DictRemoveRand` is `RemovableLocations` and `NumToRemove` is `LocationDifference` (the `locations_to_remove` option).

**The bug**: `RemovableLocations` is only populated with Main Objectives when `Goal == 1` (kill_caretaker). For other goals (goldrush=2, hunter=3), only Secondary Objectives are added, resulting in ~64 available locations.

However, `locations_to_remove` option has a range of **0-150** (defined in `options.py:104-109`).

### Reproduction

When `goal_mode=2` (goldrush) and `locations_to_remove > 64`:
```python
from worlds.deep_rock_galactic.locations import remove_locations, location_init
ALL_LOCATIONS = location_init()
# This triggers: ValueError: Sample larger than population or is negative
result = remove_locations(ALL_LOCATIONS.copy(), LocationDifference=100, Goal=2, ...)
```

### Size of RemovableLocations by Goal

| Goal | Main Objectives | Secondaries | Total Max |
|------|----------------|-------------|-----------|
| 1 (caretaker) | 9×8×4 = 288 | 16×4 = 64 | ~352 |
| 2 (goldrush) | 0 | 16×4 = 64 | ~64 |
| 3 (hunter) | 0 | 16×4 = 64 | ~64 |

### Suggested Fix (for apworld maintainer)

**Option A**: Cap `NumToRemove` in `remove_locations`:
```python
# In remove_locations, before line 400:
NumToRemove = min(NumToRemove, len(DictRemoveRand))
if NumToRemove > 0:
    keys_to_remove = random.sample(DictRemoveRand, NumToRemove)
```

**Option B**: Reduce the max value of `locations_to_remove` option to 60 or add goal-dependent validation.

**Option C**: Add Main Objectives to `RemovableLocations` for all goals (if game logic allows).

## Issue 2: Logic Mismatch (UT vs Server)

When the fuzzer successfully generates a seed (no Python exception), the UT tracking produces different accessible locations than the server logic.

### Observed Discrepancy

From fuzzer log `fuzz_output/error/deep_rock_galactic/0/0.log`:
- Many locations "expected to be in logic but weren't"
- Different sphere accessibility between UT and server

### Likely Causes

1. **Lambda functions in rules**: The apworld uses inline lambdas in `regions.py` that may not export correctly to JSON
2. **`has_from_list` calls**: The rules use `state.has_from_list(Generic_Progressives, player, N)` which may not translate to Rule Builder format
3. **Missing exporter**: No game-specific exporter exists in `exporter/games/` or `exporter/games/unofficial/`

### Example Rules from regions.py

```python
def rule_generic_progressive3(state):
    return state.has_from_list(Generic_Progressives,player,diffArr[0])

def rule_carrying(state):
    return state.has_from_list(Carrying_Buffs,player,diffArr[3])

def rule_morkite(state):
    return state.has('Progressive-Morkite-Mining',player,diffArr[4])
```

These use `has_from_list` which requires special handling for UT compatibility.

## Recommendations

### For This Repository

1. **Add to known-incompatible list**: The apworld has a fundamental bug that causes generation failures with certain option combinations
2. **Do not create exporter**: Until the apworld bug is fixed, an exporter would be unreliable

### For APWorld Maintainer (Cousinit117)

1. **Fix the `random.sample()` bug** in `locations.py`
2. **Test with fuzzer** to verify fix: `python fuzz.py -r 50 -j 4 -g deep_rock_galactic -n 1 --hook worlds.tracker.fuzzer_hook:Hook`
3. **Consider rules export**: If UT support is desired, ensure rules use standard AP patterns

## Test Results

| Metric | Value |
|--------|-------|
| Total Runs | 10 |
| Success | 0 (0%) |
| Failures (Python Exception) | Variable based on random options |
| Failures (Logic Mismatch) | Variable based on random options |
| Timeouts | 0 |

Note: Results vary because the fuzzer generates random option combinations. Some trigger the `random.sample()` bug, others complete but have logic mismatches.

## Files Analyzed

- `custom_worlds/deep_rock_galactic.apworld`:
  - `__init__.py` - World class definition
  - `locations.py` - Location definitions and `remove_locations` function (bug location)
  - `regions.py` - Region and rule definitions
  - `options.py` - Game options including `locations_to_remove`

## APWorld Repository

- GitHub: https://github.com/Cousinit117/Deep-Rock-Galactic-AP
- Version tested: 0.15.2
