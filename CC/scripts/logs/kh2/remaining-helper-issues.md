# KH2 Remaining Helper Issues

No remaining helper issues! All issues have been moved to solved-helper-issues.md.

---

## Issue 2: Data Axel Region Not Accessible (Sphere 14.1) - MOVED TO SOLVED

---

## Issue 1: Data Xaldin Region Not Accessible (Sphere 13.5) - MOVED TO SOLVED

**Status:** Not Fixed
**Sphere:** 13.5
**Error Type:** State Mismatch - Missing Region

### Description
The "Data Xaldin" region is not accessible in the JavaScript state manager when it should be, according to the Python sphere log.

### Error Details
```
Locations accessible in LOG but NOT in STATE (or checked):
- (Post BC2: Ballroom) Data Xaldin
- Data Xaldin Event Location

Regions accessible in LOG but NOT in STATE:
- Data Xaldin
```

### Root Cause
The exit from "Xaldin" region to "Data Xaldin" region uses the helper function `get_data_xaldin_rules()`, which is implemented in `frontend/modules/shared/gameLogic/kh2/kh2Logic.js:1369`.

The function checks:
1. All items in NORMAL_DATA_XALDIN dictionary (for FightLogic=1/normal mode)
2. Final Form with level 5 requirement (using `form_list_unlock`)

Required items (from NORMAL_DATA_XALDIN):
- Fire Element: 3
- Finishing Plus: 1
- Guard: 1
- Reflect Element: 3
- Flare Force: 1 (Donald limit)
- Fantasia: 1 (Donald limit)
- High Jump: 3
- Aerial Dodge: 3
- Glide: 3
- Magnet Element: 1
- Horizontal Slash: 1
- Aerial Dive: 1
- Aerial Spiral: 1

The sphere log shows that acquiring "Aerial Dive" in Sphere 13.5 should unlock Data Xaldin region.

### Investigation Needed
1. Check if all NORMAL_DATA_XALDIN items are actually present in the state when Aerial Dive is acquired
2. Verify `kh2_dict_count()` is working correctly
3. Verify `form_list_unlock()` is working correctly for Final Form level 5 with fightLogic=true
4. Check if there's a timing issue with when the helper is evaluated

### Files Involved
- `frontend/modules/shared/gameLogic/kh2/kh2Logic.js:1369` - get_data_xaldin_rules() implementation
- `frontend/modules/shared/gameLogic/kh2/kh2Logic.js:2703` - kh2_dict_count() utility
- `frontend/modules/shared/gameLogic/kh2/kh2Logic.js:102` - form_list_unlock() implementation
- `frontend/presets/kh2/AP_14089154938208861744/AP_14089154938208861744_rules.json:4940-4943` - Exit access rule definition
