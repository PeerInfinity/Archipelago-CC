# Remaining Exporter Issues for Starcraft 2

*Last updated: 2025-11-30*

## Issue 1: terran_competent_comp incorrectly expanded

**Problem**: The `terran_competent_comp` helper is being incorrectly expanded by the exporter instead of being kept as a helper call. The result is a strange rule structure that doesn't match the Python logic.

**Example from seed 3 - Media Blitz Victory**:
```json
{
  "type": "conditional",
  "test": {
    "type": "not",
    "condition": {
      "type": "helper",
      "name": "terran_competent_anti_air"
    }
  },
  "if_true": {"type": "constant", "value": false},
  "if_false": {
    "type": "helper",
    "name": "weapon_armor_upgrade_count",
    "args": [{"type": "constant", "value": "Progressive Terran Infantry Weapon"}]
  }
}
```

**Expected**: Should be a simple helper call:
```json
{
  "type": "helper",
  "name": "terran_competent_comp"
}
```

**Python source** (rules.py line 1651-1655):
```python
make_location_data(
    SC2Mission.MEDIA_BLITZ.mission_name,
    "Victory",
    SC2WOL_LOC_ID_OFFSET + 2000,
    LocationType.VICTORY,
    logic.terran_competent_comp,  # <-- should be kept as helper call
),
```

**Impact**: Affects seed 3 and potentially other seeds. Media Blitz, Shatter the Sky, and Zero Hour locations fail the spoiler test.

**Priority**: High - this is a fundamental exporter issue that affects multiple missions.

**Next Steps**:
1. Investigate why the exporter is expanding `terran_competent_comp` instead of keeping it as a helper
2. The issue may be in the generic rule analyzer's handling of method references vs calls
