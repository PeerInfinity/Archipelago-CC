# Starcraft 2 - Remaining Helper Issues

## Summary
Test currently processes 37/262 events and reaches Sphere 7.2 before failing. One critical issue remains with The Infinite Cycle being accessible too early.

## Status
- Last test run: Sphere 7.2
- Total test events: 262
- Processed events: 37 (14%)
- Error count: 1
- Sphere count reached: 38

## Critical Issues

### 1. The Infinite Cycle accessible too early
**Severity:** HIGH
**First seen:** Sphere 7.2
**Status:** INVESTIGATING

**Issue:** The Infinite Cycle locations are accessible in STATE but not in LOG at Sphere 7.2. They should not be accessible until Sphere 10.3.

**Details:**
The `the_infinite_cycle_requirement` helper appears to be too permissive. The requirement is:
- story_tech_granted (false in this seed)
- OR NOT kerrigan_unit_available (false - Kerrigan IS available)
- OR (two_kerrigan_actives AND basic_kerrigan AND kerrigan_levels >= 70)

With settings:
- story_levels_granted: true
- kerrigan_unit_available: true
- story_tech_granted: false

At Sphere 7.2, player has:
- Kinetic Blast (Kerrigan Tier 1)
- Heroic Fortitude (Kerrigan Tier 1)

Expected: Should NOT be accessible (only 1 tier of actives, Heroic Fortitude is passive)
Actual: Locations are accessible

At Sphere 10.3, player gets Apocalypse (Kerrigan Tier 7), giving them 2 tiers of actives, which SHOULD make it accessible.

**Possible causes:**
1. Item name tier number mismatches (partially addressed with Tier 2, 6 corrections)
2. Settings not being read correctly from staticData.settings
3. Logic error in one of the Kerrigan helper functions
4. Issue with how kerrigan_levels returns true when story_levels_granted is true

**Next debugging steps:**
1. Add console logging to trace helper evaluation at Sphere 7.2
2. Verify two_kerrigan_actives is counting tiers correctly
3. Check if basic_kerrigan is evaluating correctly
4. Confirm settings are accessible in helper functions

## Other Stubbed Helpers

The following helpers remain as stubs and may be needed as testing progresses:
- terran_mobile_detector
- terran_beats_protoss_deathball
- terran_base_trasher
- terran_can_rescue
- terran_cliffjumper
- terran_able_to_snipe_defiler
- terran_respond_to_colony_infestations
- terran_survives_rip_field
- terran_sustainable_mech_heal
- zerg_competent_defense
- zerg_pass_vents
- marine_medic_upgrade
- can_nuke
- nova_* helpers (various)
- Mission-specific requirement helpers (many remaining)

## Progress Summary

**Completed helpers (14% of test):**
1. basic_kerrigan ✓
2. terran_defense_rating ✓
3. last_stand_requirement ✓
4. zerg_competent_anti_air ✓
5. zerg_basic_anti_air ✓
6. zerg_competent_comp ✓
7. spread_creep ✓
8. morph_brood_lord ✓
9. morph_viper ✓
10. morph_impaler_or_lurker ✓
11. two_kerrigan_actives ✓
12. kerrigan_levels ✓
13. the_infinite_cycle_requirement (needs debugging)

**Test progression:**
- Initial: Failed at Sphere 5.2 (28 events)
- After basic_kerrigan: Sphere 5.5
- After terran_defense_rating: Sphere 5.6
- After last_stand_requirement: Sphere 6.1
- After zerg anti-air: Sphere 8.8
- After zerg comp/creep: Sphere 10.3 (but incorrectly accessible at 7.2)
- Current: Stuck at Sphere 7.2 due to Infinite Cycle issue (37 events)

**Next steps:**
1. Debug why the_infinite_cycle_requirement is allowing access at Sphere 7.2
2. Consider running comprehensive test suite once this issue is resolved
3. Continue implementing remaining helpers as they're encountered
