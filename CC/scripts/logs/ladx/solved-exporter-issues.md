# Links Awakening DX - Solved Exporter Issues

## Issue 1: Missing GOLD_LEAF Item Mapping

**Status**: FIXED
**Sphere**: 12.16
**Fixed in**: exporter/games/ladx.py:265

### Description
The exporter was missing a mapping for `GOLD_LEAF` -> `"Gold Leaf"`.

### Solution
Added mapping to `item_name_mapping` dict:
```python
'GOLD_LEAF': 'Gold Leaf',
```

### Verification
After fix, test progressed from Sphere 12.16 to Sphere 13.5, confirming that regions requiring Gold Leaves are now accessible.

---

## Issue 2: Missing INSTRUMENT1-8 Item Mappings

**Status**: FIXED
**Sphere**: 13.5
**Fixed in**: exporter/games/ladx.py:264-271

### Description
The exporter was missing mappings for all 8 dungeon instruments (INSTRUMENT1-8), preventing access to the final game regions.

### Solution
Added all instrument mappings to `item_name_mapping` dict:
```python
# Instruments
'INSTRUMENT1': 'Full Moon Cello',
'INSTRUMENT2': 'Conch Horn',
'INSTRUMENT3': 'Sea Lily\'s Bell',
'INSTRUMENT4': 'Surf Harp',
'INSTRUMENT5': 'Wind Marimba',
'INSTRUMENT6': 'Coral Triangle',
'INSTRUMENT7': 'Organ of Evening Calm',
'INSTRUMENT8': 'Thunder Drum',
```

### Verification
After fix, all spheres pass. Test completes successfully with "Overall Result: true" and "1 passed (8.7s)". All 164 events matched between Python sphere log and JavaScript state progression.

---

---

## Issue 3: Missing BOWWOW Item Mapping

**Status**: FIXED
**Sphere**: 5.7 (seed 7)
**Fixed in**: exporter/games/ladx.py:233

### Description
The exporter was missing a mapping for `BOWWOW` -> `"BowWow"`, causing access issues to Bottle Grotto dungeon in some seeds.

### Solution
Added mapping to `item_name_mapping` dict:
```python
'BOWWOW': 'BowWow',
```

### Verification
Seeds 1-6 passed before fix (didn't require BowWow early).
Seed 7 failed at Sphere 5.7 before fix.
After fix, all seeds 7-10 pass.

---

## Summary

**Total Issues Fixed**: 3
- GOLD_LEAF mapping
- INSTRUMENT1-8 mappings
- BOWWOW mapping

**Test Results**: ✅ PASSING (Seeds 1-10)
- Seed 1: PASS (164 events)
- Seeds 2-6: PASS
- Seeds 7-10: PASS (after BOWWOW fix)

The LADX exporter is now fully functional for seeds 1-10 with default settings.

---
