# Archipelago Multi-Template Test Results

## Multi-Template Test - All Locations

[← Back to Test Results Summary](./test-results-summary.md)

**Generated:** 2025-11-13 00:52:50

**Source Data Created:** 2025-11-12T05:21:21.688007

**Source Data Last Updated:** 2025-11-13T00:52:50.600054

## Summary

- **Total Games:** 1
- **Total Template Configurations:** 41
- **Passed Configurations:** 27 (65.9%)
- **Failed Configurations:** 12 (29.3%)
- **Invalid Configurations:** 2 (4.9%)

## A Link to the Past

**Results:** 27/41 passed (65.9%)  
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
| big_key_shuffle_own_world | ❌ Failed | 0 | 36.3 | 38.1 | 95.3% |
| big_key_shuffle_start_with | ✅ Passed | 0 | 18.1 | 18.1 | 100.0% |
| bombless_start_false | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| bombless_start_true | ❌ Failed | 0 | 0 | 31.1 | 0.0% |
| boss_chaos | ❌ Failed | 0 | 0 | 18.1 | 0.0% |
| boss_shuffle_basic | ✅ Passed | 0 | 23.1 | 23.1 | 100.0% |
| boss_shuffle_chaos | ✅ Passed | 0 | 19.3 | 19.3 | 100.0% |
| boss_shuffle_full | ❌ Failed | 0 | 20.7 | 22.1 | 93.7% |
| boss_shuffle_none | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| boss_shuffle_singularity | ✅ Passed | 0 | 27.2 | 27.2 | 100.0% |
| bush_shuffle_false | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| bush_shuffle_true | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| compass_shuffle_any_world | ❌ Failed | 0 | 19.3 | 22.1 | 87.3% |
| compass_shuffle_different_world | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| compass_shuffle_original_dungeon | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| compass_shuffle_own_dungeons | ✅ Passed | 0 | 18.1 | 18.1 | 100.0% |
| compass_shuffle_own_world | ❌ Failed | 0 | 18.7 | 22.1 | 84.6% |
| compass_shuffle_start_with | ✅ Passed | 0 | 20.1 | 20.1 | 100.0% |
| dark_room_logic_lamp | ❌ Failed | 0 | 19.9 | 22.1 | 90.0% |
| dark_room_logic_none | ❌ Failed | 0 | 20.7 | 22.1 | 93.7% |
| dark_room_logic_torches | ❌ Failed | 0 | 20.7 | 22.1 | 93.7% |
| death_link_false | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| death_link_true | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| dungeon_counters_default | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| dungeon_counters_off | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| dungeon_counters_on | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| dungeon_counters_pickup | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| enemy_damage_chaos | ❌ Failed | 0 | 20.6 | 22.1 | 93.2% |
| enemy_damage_default | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| enemy_damage_shuffled | ✅ Passed | 0 | 22.1 | 22.1 | 100.0% |
| enemy_health_default | ❌ Failed | 0 | 20.2 | 22.1 | 91.4% |

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
