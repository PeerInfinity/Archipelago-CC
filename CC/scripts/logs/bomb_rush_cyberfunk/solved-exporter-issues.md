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

---

### Issue 3: Region entrance functions returning empty rules
**Resolved:** 2025-11-15
**Fix:** Added all region entrance and sub-region access functions to preserve list

**Problem:** Region entrance functions like `brink_terminal_entrance`, `millennium_mall_entrance`, and `mataan_smoke_wall` were failing to be analyzed, resulting in empty `and` rules. This made regions accessible immediately instead of when they should be gated by chapter completion, REP requirements, or other conditions.

**Solution:** Added comprehensive list of region entrance and sub-region access functions to `should_preserve_as_helper()`:
- Main region entrances: versum_hill_entrance, millennium_square_entrance, brink_terminal_entrance, millennium_mall_entrance, pyramid_island_entrance, mataan_entrance
- Sub-region access functions: versum_hill_ch1_roadblock, versum_hill_oldhead, versum_hill_all_challenges, versum_hill_basketball_court, brink_terminal_plaza, brink_terminal_tower, brink_terminal_oldhead_underground, brink_terminal_oldhead_dock, millennium_mall_theater, millennium_mall_oldhead_ceiling, millennium_mall_oldhead_race, pyramid_island_gate, pyramid_island_oldhead, pyramid_island_top, pyramid_island_upper_half, mataan_smoke_wall, mataan_oldhead

**Result:** All region entrances now have proper access requirements. The spoiler test now passes completely with all 186 state updates validated successfully across 10.9 spheres.
