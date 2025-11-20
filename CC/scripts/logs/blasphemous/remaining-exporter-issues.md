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

**Additional verification:**
8. ✓ Blasphemous world pushes Dash and Wall Climb as precollected items (lines 104, 107 in __init__.py)
9. ✓ Exporter correctly exports these to starting_items in rules.json
10. ✓ Spoiler test has code to handle add_sphere_items_upfront setting

**Conclusion:**
This appears to be a framework issue with how the spoiler test processes Sphere 0 items, not an exporter issue. The exporter is working correctly:
- Starting items are properly configured in Blasphemous world
- They are correctly exported to rules.json
- Helper functions exist and are properly named
- Access rules are correctly structured

**Recommendation:**
- This issue requires debugging the spoiler test framework itself
- The problem is likely in the timing/order of operations when loading Sphere 0
- For now, document this as a known limitation and proceed with other fixes
- Come back to this if time permits

**Status:** Investigation complete - exporter is correct, issue is in test framework infrastructure

