# Solved Exporter Issues for Bomb Rush Cyberfunk

## Summary
This document tracks resolved exporter issues.

## Resolved Issues

### Issue 1: Incorrect graffiti_spots function inlining
**Resolved:** 2025-11-15
**Fix:** Added `should_preserve_as_helper()` method to BombRushCyberfunkGameExportHandler

**Problem:** The exporter was analyzing the body of the `graffiti_spots()` helper function and trying to inline it, generating incorrect argument mappings for the spot counting functions.

**Solution:** Implemented `should_preserve_as_helper()` method in the Bomb Rush Cyberfunk exporter to preserve `graffiti_spots` and related helper functions (spots_s_glitchless, spots_m_glitchless, etc.) as helper calls instead of inlining them.

**Result:** The `graffiti_spots` function is now correctly exported as:
```json
{
  "type": "helper",
  "name": "graffiti_spots",
  "args": [
    {"type": "constant", "value": 2},     // movestyle
    {"type": "constant", "value": 0},     // limit (false)
    {"type": "constant", "value": 0},     // glitched (false)
    {"type": "constant", "value": 5}      // spot_count
  ]
}
```

---

### Issue 2: Region access functions returning empty rules
**Resolved:** 2025-11-15
**Fix:** Added region access functions to preserve list

**Problem:** Functions like `versum_hill_rietveld`, `mataan_crew_battle`, etc. were failing to be analyzed properly, resulting in empty `and` rules with no conditions. This caused locations to be accessible earlier than intended.

**Solution:** Added all complex region access functions to the `should_preserve_as_helper()` preserve list:
- versum_hill_rietveld
- versum_hill_crew_battle
- versum_hill_rave
- brink_terminal_crew_battle
- brink_terminal_mesh
- millennium_mall_switch
- millennium_mall_big
- millennium_mall_crew_battle
- pyramid_island_all_challenges
- pyramid_island_crew_battle
- pyramid_island_race
- mataan_challenge1
- mataan_deep_city
- mataan_challenge2
- mataan_all_challenges
- mataan_smoke_wall2
- mataan_deepest
- mataan_crew_battle
- mataan_faux

**Result:** These functions are now properly exported as helper calls with correct arguments, and the JavaScript implementations in bombRushCyberfunkLogic.js can handle them.
