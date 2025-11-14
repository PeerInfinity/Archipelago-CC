# Remaining Helper Issues

## Issue 1: Helper functions with access_cache parameter not being evaluated

**Locations affected:** Tagged 5 Graffiti Spots, Tagged 10 Graffiti Spots, and all other graffiti spot milestone locations

**Symptom:** These locations should be accessible in Sphere 0 according to the spoiler log, but the JavaScript rule engine marks them as inaccessible with "Access rule evaluation failed" error.

**Root cause:** The access rules call helper functions like `spots_s_glitchless(0, access_cache)` where `access_cache` is passed as a `{type: "name", name: "access_cache"}` node instead of being resolved to an actual value.

**Current status:** Partially fixed (2 of 8 functions updated)
- Modified `spots_s_glitchless` and `spots_s_glitched` to detect when `access_cache` is a name reference and build it dynamically
- Still need to update the remaining functions:
  - `spots_m_glitchless`
  - `spots_m_glitched`
  - `spots_l_glitchless`
  - `spots_l_glitched`
  - `spots_xl_glitchless`
  - `spots_xl_glitched`

**Implementation approach:**
Each spot counting function now checks if `access_cache` is undefined or a name reference, and if so, builds it using:
```javascript
if (!accessCache || (typeof accessCache === 'object' && accessCache?.type === 'name')) {
    const options = getOptionsFromStaticData(staticData);
    accessCache = build_access_cache(snapshot, staticData, options.movestyle, options.limit, options.glitched);
}
```

**Files modified:**
- `frontend/modules/shared/gameLogic/bomb_rush_cyberfunk/bombRushCyberfunkLogic.js`
  - Added `getOptionsFromStaticData()` helper (lines 498-514)
  - Modified `spots_s_glitchless()` to handle access_cache parameter (lines 517-583)
  - Modified `spots_s_glitched()` to handle access_cache parameter (lines 585-626)
  - Updated exports to include spot counting functions and `build_access_cache` (lines 1138-1147)

**Next steps:**
1. Update the remaining 6 spot counting functions with the same pattern
2. Re-run the spoiler test to verify the fix works
3. If tests still fail, add debug logging to identify any remaining issues

