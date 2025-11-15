# Super Mario Land 2 - Remaining Helper Issues

## Issue 1: "Mario's Castle - Wario" accessible in LOG but not in STATE (Sphere 10.1)

**Type:** Helper Implementation Issue

**Description:**
The spoiler test shows that the location "Mario's Castle - Wario" is accessible in the Python sphere log at Sphere 10.1, but the JavaScript state manager doesn't think it's accessible at that sphere.

The test also reports: "Region Mario's Castle is not reachable" in the JavaScript state.

**Test Output:**
```
STATE MISMATCH found for: {"type":"state_update","sphere_number":"10.1","player_id":"1"}
> Locations accessible in LOG but NOT in STATE (or checked): Mario's Castle - Wario
    ISSUE: Region Mario's Castle is not reachable
REGION MISMATCH found for: {"type":"state_update","sphere_number":"10.1","player_id":"1"}
> Regions accessible in LOG but NOT in STATE: Mario's Castle
```

**Status:** To be investigated

**Next Steps:**
1. Check the Python entrance rule for "Menu -> Mario's Castle"
2. Check if the JavaScript helper function `marios_castle_wario` is implemented correctly
3. Check if the entrance rule is exported correctly in rules.json
