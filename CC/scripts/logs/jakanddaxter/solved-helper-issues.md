# Solved Helper Issues

## Issue 1: Missing helpers.js file for can_reach_orbs helper

**Status**: SOLVED
**Priority**: High
**Solved at**: Helper function successfully loaded and used by rule engine

**Description**: The spoiler test failed at Sphere 3.15 with 15 orb trade locations. The access rules used the `can_reach_orbs` helper function, but it was not being properly registered with the game logic registry.

**Root Cause**: No `helpers.js` file existed to export helper functions for the game logic registry.

**Solution**: Created `frontend/modules/shared/gameLogic/jak_and_daxter__the_precursor_legacy/helpers.js` with helper functions and updated logic file to import and export them.

**Note**: This fix required the exporter fix (orb_count) to work correctly.

**Verification**: After both fixes, all orb trade locations become accessible at the correct sphere.

