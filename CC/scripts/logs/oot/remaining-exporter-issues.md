# Remaining Exporter Issues for Ocarina of Time

## Status: In Progress

Last Updated: 2025-11-20

## Active Issues

### 1. Sphere 0.8 Mismatch - Deku Tree Slingshot Room Access

**Severity:** High
**Type:** Exporter/Helper Issue
**Status:** Not Started

**Description:**
The spoiler test fails at Sphere 0.8 with the following mismatches:

- **Locations accessible in STATE but NOT in LOG:**
  - `Deku Tree Slingshot Chest`
  - `Deku Tree Slingshot Room Side Chest`

- **Regions accessible in STATE but NOT in LOG:**
  - `Deku Tree Slingshot Room`

**Analysis:**
These locations and the region are becoming accessible too early in the JavaScript implementation compared to the Python implementation. This suggests that either:
1. The access rules for these locations/regions are not being exported correctly
2. A helper function is missing or implemented incorrectly
3. The rule format is not being interpreted correctly

**Test Command:**
```bash
npm test --mode=test-spoilers --game=oot --seed=1
```

**Files to Investigate:**
- `exporter/games/oot.py` - Check how rules are being exported for Deku Tree locations
- `frontend/presets/oot/AP_14089154938208861744/AP_14089154938208861744_rules.json` - Examine the exported rules
- OOT world files in `worlds/oot/data/World/` - Check original rule definitions

**Next Steps:**
1. Examine the rules.json to see what access_rule is defined for "Deku Tree Slingshot Room" entrance
2. Check the original Python rule definition in the OOT world data files
3. Determine if this is an exporter issue (rule not exported correctly) or a helper issue (missing helper function)
4. Fix the root cause

**Related Locations:**
- Deku Tree Slingshot Chest
- Deku Tree Slingshot Room Side Chest
- Region: Deku Tree Slingshot Room
