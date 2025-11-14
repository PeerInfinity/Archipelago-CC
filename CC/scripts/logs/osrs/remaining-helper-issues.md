# Remaining Helper Issues for Old School Runescape

This file tracks issues related to missing or incorrect helper functions.

## Issues

### Issue 1: quest_points helper may not be loading correctly

**Status:** In Progress

**Location:** `frontend/modules/shared/gameLogic/osrs/osrsLogic.js`

**Description:**
The `quest_points` helper function has been created and should calculate the total quest points by summing up QP event items in the player's inventory. However, the test is still showing "Access rule evaluation failed" for locations that require quest points.

**Test Failure:**
- Locations: "Activate the 'Protect Item' Prayer", "Cut a Ruby", "Kill a Hill Giant", "Total Level 150"
- Sphere: 2.7
- Error: Access rule evaluation failed

**Next Steps:**
1. Verify the helper function is being loaded by the module loader
2. Check if the helper function needs to be registered in a configuration file
3. Test the helper function logic to ensure it correctly calculates quest points
4. Debug why the access rule evaluation is failing despite the helper being defined
