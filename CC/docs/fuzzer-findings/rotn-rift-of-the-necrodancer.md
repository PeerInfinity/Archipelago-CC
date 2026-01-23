# Rift of the Necrodancer - UT Fuzzer Findings

**APWorld**: rotn.apworld v0.8.1
**Source**: https://github.com/studkid/RiftArchipelago
**Test Date**: 2026-01-23
**Fuzzer Results**: 30% success rate (3/10 success, 4 failures, 3 ignored)

## Issue Summary

| Error Type | Runs | Root Cause | Fix Location |
|------------|------|------------|--------------|
| `empty range for randrange()` | [0] | Option validation bug | APWorld |
| Logic Mismatch (None) | [4, 7, 9] | Duplicate item IDs | APWorld |

## Detailed Analysis

### Issue 1: Option Validation Error

**Error**: `ValueError: empty range for randrange() (0, 0, 0)`

**Location**: `rotn/__init__.py:92` in `generate_early()`

**Cause**:
The fuzzer can generate option combinations where:
1. `min_intensity > max_intensity` (e.g., min=26, max=3)
2. `include_remix: false`, `include_minigames: false`, `include_boss_battle: false`
3. Limited DLC songs selected

The apworld attempts to swap min/max intensity, but when all remaining filtering criteria result in zero available songs, the call to `randrange(0, len(available_song_keys))` fails.

**Recommended Fix** (for apworld maintainer):
```python
# In generate_early()
if len(available_song_keys) == 0:
    raise OptionError("No songs available with current filter settings. "
                      "Try adjusting intensity range or enabling more song types.")
```

### Issue 2: Duplicate Item IDs (Critical)

**Error**: Logic mismatch - UT and server disagree on accessible locations

**Cause**:
Both "(Medium)" and "(Hard)" variants of minigame/boss songs share the same item ID:

```python
# In RiftCollections.py __init__()
for key, data in self.EXTRA_DATA.items():
    self.song_items[key] = SongData(data.code, ...)           # e.g., 2012
    self.song_items[key + " (Medium)"] = SongData(data.code + 1, ...)  # 2013
    self.song_items[key + " (Hard)"] = SongData(data.code + 1, ...)    # 2013 (BUG!)
```

**Affected Items**:
| Item Name | ID |
|-----------|----|
| Take a Breather | 2012 |
| Take a Breather (Medium) | 2013 |
| Take a Breather (Hard) | 2013 |
| Lunch Rush | 2015 |
| Lunch Rush (Medium) | 2016 |
| Lunch Rush (Hard) | 2016 |
| Voguelike | 2018 |
| Voguelike (Medium) | 2019 |
| Voguelike (Hard) | 2019 |
| Show Time! | 2021 |
| Show Time! (Medium) | 2022 |
| Show Time! (Hard) | 2022 |
| Harmonie | 2112 |
| Harmonie (Medium) | 2113 |
| Harmonie (Hard) | 2113 |
| Deep Blues | 2115 |
| Deep Blues (Medium) | 2116 |
| Deep Blues (Hard) | 2116 |
| Matron | 2118 |
| Matron (Medium) | 2119 |
| Matron (Hard) | 2119 |
| Reaper | 2121 |
| Reaper (Medium) | 2122 |
| Reaper (Hard) | 2122 |
| The NecroDancer | 2124 |
| The NecroDancer (Medium) | 2125 |
| The NecroDancer (Hard) | 2125 |

**Impact**:
- When converting item codes back to names (e.g., in `item_id_to_name`), only one variant is returned
- This causes UT to think the wrong item is in the starting inventory
- Results in location accessibility mismatches between UT and server

**Recommended Fix** (for apworld maintainer):
```python
# In RiftCollections.py __init__()
for key, data in self.EXTRA_DATA.items():
    self.song_items[key] = SongData(data.code, ...)
    self.song_items[key + " (Medium)"] = SongData(data.code + 1, ...)
    self.song_items[key + " (Hard)"] = SongData(data.code + 2, ...)  # Fixed!
```

Note: This also requires updating `EXTRA_DATA` to use larger code spacing (e.g., 3 per song instead of 1).

## Conclusion

**Status**: Cannot be fixed in tracker/exporter - requires apworld updates

**Action Items**:
1. Report duplicate item ID bug to apworld maintainer at https://github.com/studkid/RiftArchipelago/issues
2. Consider adding this apworld to a known-incompatible list until fixed

## Reproduction Steps

```bash
# Download and install apworld
curl -L -o custom_worlds/rotn.apworld "https://github.com/studkid/RiftArchipelago/releases/download/v0.8.1/rotn.apworld"

# Generate templates
source .venv/bin/activate
python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"

# Run fuzzer
python fuzz.py -r 10 -j 4 -g rotn -n 1 --hook worlds.tracker.fuzzer_hook:Hook
```
