# Remaining Helper Issues

## Issue 1: Helper functions with access_cache parameter not being evaluated

**Locations affected:** Tagged 5 Graffiti Spots, Tagged 10 Graffiti Spots

**Symptom:** These locations should be accessible in Sphere 0 according to the spoiler log, but the JavaScript rule engine marks them as inaccessible.

**Root cause:** The access rules call helper functions like `spots_s_glitchless(0, access_cache)` where `access_cache` is passed as a `{type: "name", name: "access_cache"}` node instead of being resolved to an actual value. The JavaScript rule engine doesn't know how to build or resolve this `access_cache` variable.

**Analysis:**
- The Python code has helper functions like `spots_s_glitchless(state, player, limit, access_cache)` that expect an `access_cache` dictionary parameter
- There's a `build_access_cache()` function that constructs this dictionary based on current state
- The exporter is generating rules that reference `access_cache` as a variable name, not as a resolved value
- The JavaScript helper functions exist and are implemented correctly in `frontend/modules/shared/gameLogic/bomb_rush_cyberfunk/bombRushCyberfunkLogic.js`
- But the rule engine can't evaluate them because it doesn't know what `access_cache` should be

**Possible solutions:**
1. Modify the rule engine to recognize `access_cache` as a special parameter and build it on demand
2. Modify the exporter to expand these helper calls into the full `graffiti_spots()` function call
3. Create a wrapper helper that builds the access_cache internally

