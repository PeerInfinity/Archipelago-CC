# Solved Helper Issues for Blasphemous

## Fixed Issues

### Issue 1: ceremony_items() helper incorrect implementation - FIXED
**Sphere:** 4.17
**Problem:** The `ceremony_items()` helper function was only checking for "Egg of Deformity" instead of counting unique items in the "egg" group.
**Solution:** Updated ceremony_items() to delegate to egg_items() which correctly counts: "Melted Golden Coins", "Torn Bridal Ribbon", and "Black Grieving Veil"
**Files modified:** frontend/modules/shared/gameLogic/blasphemous/blasphemousLogic.js (lines 1282-1289)
**Result:** Region RB06 is now accessible, test progresses to Sphere 6.1

### Issue 2: redento_rooms() helper not calling knots() and limestones() helpers - FIXED
**Sphere:** 6.1
**Problem:** The `redento_rooms()` function was directly checking inventory for "Knot of Hair" and "Limestone" instead of calling the knots() and limestones() helper functions. The knots() helper requires reaching a specific region first, and limestones() counts toe items, not limestone items.
**Python implementation:** Calls self.knots(state) and self.limestones(state)
**Wrong JS implementation:** Directly checked `snapshot?.inventory?.["Knot of Hair"]` and `snapshot?.inventory?.["Limestone"]`
**Solution:** Updated redento_rooms() to call this.knots() and this.limestones() helper functions
**Files modified:** frontend/modules/shared/gameLogic/blasphemous/blasphemousLogic.js (lines 729-730)
**Result:** Redento's 5th meeting is now properly gated by the correct item requirements

### Issue 3: toes() helper using wrong item names - FIXED
**Sphere:** 6.1 (related to Issue 2)
**Problem:** The `toes()` helper function was checking for wrong item names (e.g., "Big Toe Made of Limestone" instead of "Big Toe made of Limestone", and including items like "Second Toe Made of Tin" that don't exist in the toe group).
**Python implementation:** Counts items in the "toe" group: "Little Toe made of Limestone", "Big Toe made of Limestone", "Fourth Toe made of Limestone"
**Wrong JS implementation:** Checked for wrong items with wrong capitalization
**Solution:** Updated toes() to check the correct three items in the toe group
**Files modified:** frontend/modules/shared/gameLogic/blasphemous/blasphemousLogic.js (lines 1060-1074)
**Result:** limestones() now correctly counts toe items, allowing Redento's 5th meeting to be properly accessible

### Issue 4: eyes() helper using wrong item name - FIXED
**Sphere:** 7.6
**Problem:** The `eyes()` helper function was checking for "Crystallised Left Eye of the Envious" instead of "Broken Left Eye of the Traitor".
**Python implementation:** Counts items in the "eye" group: "Severed Right Eye of the Traitor", "Broken Left Eye of the Traitor"
**Wrong JS implementation:** Checked for "Crystallised Left Eye of the Envious"
**Solution:** Updated eyes() to check the correct item name "Broken Left Eye of the Traitor"
**Files modified:** frontend/modules/shared/gameLogic/blasphemous/blasphemousLogic.js (lines 1099-1112)
**Result:** traitor_eyes() now correctly counts eye items, allowing access to "KotTW: Gift from the Traitor"
