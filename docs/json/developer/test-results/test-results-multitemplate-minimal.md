# Archipelago Multi-Template Test Results

## Multi-Template Test - Advancement Items Only

[← Back to Test Results Summary](./test-results-summary.md)

**Generated:** 2025-11-20 00:50:00

**Source Data Created:** 2025-11-20T00:50:00.035711

**Source Data Last Updated:** 2025-11-20T00:50:00.035720

## Summary

- **Total Games:** 1
- **Total Template Configurations:** 41
- **Passed Configurations:** 36 (87.8%)
- **Failed Configurations:** 3 (7.3%)
- **Invalid Configurations:** 2 (4.9%)

## A Link to the Past

**Results:** 36/41 passed (87.8%)  
**Custom Exporter:** ✅ Yes | **Custom GameLogic:** ✅ Yes

| Template | Test Result | Gen Errors | Sphere Reached | Max Spheres | Progress |
|----------|-------------|------------|----------------|-------------|----------|
| accessibility_full | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| accessibility_items | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| accessibility_minimal | ⚫ Invalid | 3 | 0 | 0 | N/A |
| allow_collect_false | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| allow_collect_true | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| beemizer | ❌ Generation Failed | 7 | 0 | 0 | N/A |
| big_key_shuffle_any_world | ✅ Passed | 0 | 38.1 | 38.1 | 100.0% |
| big_key_shuffle_different_world | ✅ Passed | 0 | 38.1 | 38.1 | 100.0% |
| big_key_shuffle_original_dungeon | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| big_key_shuffle_own_dungeons | ⚫ Invalid | 3 | 0 | 0 | N/A |
| big_key_shuffle_own_world | ✅ Passed | 0 | 38.1 | 38.1 | 100.0% |
| big_key_shuffle_start_with | ✅ Passed | 0 | 18.1 | 18.1 | 100.0% |
| bombless_start_false | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| bombless_start_true | ❌ Failed | 0 | 0 | 31.1 | 0.0% |
| boss_chaos | ❌ Failed | 0 | 0 | 18.1 | 0.0% |
| boss_shuffle_basic | ✅ Passed | 0 | 23.1 | 23.1 | 100.0% |
| boss_shuffle_chaos | ✅ Passed | 0 | 19.1 | 19.1 | 100.0% |
| boss_shuffle_full | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| boss_shuffle_none | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| boss_shuffle_singularity | ✅ Passed | 0 | 27.1 | 27.1 | 100.0% |
| bush_shuffle_false | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| bush_shuffle_true | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| compass_shuffle_any_world | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| compass_shuffle_different_world | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| compass_shuffle_original_dungeon | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| compass_shuffle_own_dungeons | ✅ Passed | 0 | 18.1 | 18.1 | 100.0% |
| compass_shuffle_own_world | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| compass_shuffle_start_with | ✅ Passed | 0 | 20.1 | 20.1 | 100.0% |
| dark_room_logic_lamp | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| dark_room_logic_none | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| dark_room_logic_torches | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| death_link_false | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| death_link_true | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| dungeon_counters_off | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| dungeon_counters_on | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| dungeon_counters_pickup | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| enemy_damage_chaos | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| enemy_damage_shuffled | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| enemy_health_default | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| enemy_health_expert | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| entrance_shuffle_dungeons_simple | ✅ Passed | 0 | 24.2 | 24.2 | 100.0% |

## Notes

### Test Result Meanings

- ✅ **Passed:** Configuration works correctly and test completed successfully
- ❌ **Failed:** Test ran but did not complete successfully
- ⚫ **Invalid:** Configuration cannot be generated due to FillError (impossible item placement)

### Column Descriptions

- **Gen Errors:** Number of errors during world generation
- **Sphere Reached:** The logical sphere the test reached before completion/failure
- **Max Spheres:** Total logical spheres available in the game
- **Progress:** Percentage of logical spheres completed

### Game Information

- **Custom Exporter:** Whether the game has a custom Python exporter script (✅ Yes) or uses generic exporter (⚫ No)
- **Custom GameLogic:** Whether the game has custom JavaScript game logic (✅ Yes) or uses generic logic (⚫ No)

**Pass Criteria:** Generation errors = 0, Max spheres > 0, Spoiler test completed successfully

**Invalid Configurations:** Templates marked as Invalid have settings that cannot be satisfied by the game's logic (FillError). These represent impossible configurations, not bugs.
