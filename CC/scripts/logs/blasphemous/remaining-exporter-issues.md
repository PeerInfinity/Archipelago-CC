# Remaining Exporter Issues

## Issue 1: Sphere 0 - Regions not being marked as accessible

**Test failure:** Sphere 0 has regions accessible in Python LOG but NOT in JavaScript STATE

**Error details:**
- "Regions accessible in LOG but NOT in STATE: CO01, CO05, CO11, CO25, CO29, CO33, D01BZ02S01..." (400+ regions)
- "ISSUE: Region D01Z03S03 is not reachable" (repeated multiple times)
- Starting regions (Menu, D17Z01S01) ARE accessible, but child regions are NOT

**Root cause:** The JavaScript state manager is NOT correctly marking regions as reachable even though they should be accessible with the starting abilities (Dash Ability + Wall Climb Ability).

**Investigation findings:**
1. ✓ Starting items (Dash Ability, Wall Climb Ability) exist in itemData
2. ✓ Rules.json has correct access rules (e.g., D17Z01S01 -> D17Z01S01[E] has access_rule: true)
3. ✓ Initialization code correctly adds starting items to inventory
4. ✓ BFS reachability algorithm looks correct
5. ✓ Helper functions (dash, wall_climb) exist in blasphemousLogic.js
6. ? Spoiler test may be using different initialization path than normal gameplay
7. ? Starting items may not be added correctly in spoiler test mode

**Hypothesis:** The spoiler test uses sphere log for initialization. Blasphemous has `add_sphere_items_upfront: true` which should add Sphere 0 resolved_items to inventory. This may not be working correctly in the spoiler test.

**Next steps:**
1. Check how spoiler test handles `add_sphere_items_upfront` setting
2. Verify that Sphere 0 items from sphere log are being added to inventory
3. Add debug logging to confirm inventory state before reachability computation

**Status:** Investigating - likely an issue with spoiler test initialization, not the core state manager

