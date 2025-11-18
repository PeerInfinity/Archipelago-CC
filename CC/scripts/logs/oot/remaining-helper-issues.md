# Remaining Helper Issues for Ocarina of Time

This file tracks helper function issues that still need to be fixed.

## Issues

### Missing Helper Functions

**Status**: In progress
**Sphere**: 0.8
**Type**: Helper function implementation needed

**Description**:
Many OOT helper functions are referenced in rules but not yet implemented in JavaScript. This causes access rule evaluations to fail when these helpers are needed.

**Missing helpers** (partial list from test output):
1. `logic_gerudo_kitchen` - Logic trick for Gerudo Kitchen access
2. `has_fire_source` - Check for any fire source (Din's Fire, Fire Arrows, etc.)
3. `logic_child_dampe_race_poh` - Logic trick for child Dampe race PoH
4. `logic_dmt_bombable` - Logic trick for Death Mountain Trail bombable wall
5. `logic_goron_city_leftmost` - Logic trick for Goron City leftmost path
6. `can_break_upper_beehive_child` - Child-specific beehive breaking
7. `logic_castle_storms_gs` - Logic trick for Castle Storms GS
8. `king_dodongo_shortcuts` - Check for King Dodongo shortcuts setting
9. `can_use_projectile` - Check for any projectile weapon
10. `logic_deku_basement_gs` - Logic trick for Deku Tree basement GS
11. `has_fire_source_with_torch` - Fire source that includes torches
12. `logic_deku_b1_webs_with_bow` - Logic trick for Deku B1 webs with bow
13. `logic_dc_scarecrow_gs` - Logic trick for Dodongo's Cavern scarecrow GS
14. `logic_dc_scrub_room` - Logic trick for Dodongo's Cavern scrub room
15. `logic_forest_first_gs` - Logic trick for Forest Temple first GS
16. `logic_forest_outdoor_east_gs` - Logic trick for Forest Temple outdoor east GS
... and likely more

**Test failure**:
Spoiler test fails at Sphere 0.8 with:
- "Access rule evaluation failed" messages
- Region accessible in STATE but not in LOG: "Deku Tree Slingshot Room"
- Locations accessible in STATE but not in LOG: "Deku Tree Slingshot Chest", "Deku Tree Slingshot Room Side Chest"
- Locations accessible in LOG but not in STATE: "Showed Mido Sword & Shield from KF Outside Deku Tree", "Showed Mido Sword & Shield from Kokiri Forest"

**Next steps**:
1. Extract all missing helpers from test output
2. Look up definitions in OOT's LogicHelpers.json
3. Implement each helper in frontend/modules/shared/gameLogic/oot/ootLogic.js
4. Test after each batch of implementations
