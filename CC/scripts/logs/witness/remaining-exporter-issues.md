# Remaining Exporter Issues for The Witness

## Issue 1: Laser Activation Locations Have Incorrect Access Rules

**Status:** Not Fixed
**Priority:** High
**Sphere:** 0

**Description:**
Multiple laser activation event locations are being exported with `{'type': 'constant', 'value': True}` as their access rule, when they should have proper requirements. This causes them to be accessible immediately in the frontend, but they should only be accessible after certain conditions are met.

**Affected Locations:**
Based on comparing the exported rules.json with the sphere log:

1. **Bunker Laser Activated**
   - Current rule: `{'type': 'constant', 'value': True}`
   - Expected: Should require Colored Squares (appears in Sphere 5.2)
   - Depends on: Bunker Laser Panel (0x09DE0)

2. **Desert Laser Activated** (might be correct)
   - Current rule: `{'type': 'constant', 'value': True}`
   - Expected: Appears in Sphere 0, so might be correct if panel has no requirements

3. **Shadows Laser Activated** (might be correct)
   - Current rule: `{'type': 'constant', 'value': True}`
   - Expected: Appears in Sphere 0, so might be correct if panel has no requirements

4. **Swamp Laser Activated**
   - Current rule: `{'type': 'constant', 'value': True}`
   - Expected: Should require Negative Shapers (appears in Sphere 4.1)
   - Depends on: Swamp Laser Panel

5. **Town Laser Activated**
   - Current rule: `{'type': 'constant', 'value': True}`
   - Expected: Should require Progressive Symmetry (appears in Sphere 6.2)
   - Depends on: Town Laser Panel

6. **Treehouse Laser Activated**
   - Current rule: `{'type': 'constant', 'value': True}`
   - Expected: Should require Progressive Stars 2 (appears in Sphere 7.1)
   - Depends on: Treehouse Laser Panel

**Root Cause:**
The issue is in `exporter/games/witness.py` in the `_simplify_region_reachability_pattern` function (lines 87-104).

This function simplifies ALL region reachability checks to `{'type': 'constant', 'value': True}` based on the assumption that "locations are only checked when their region is reachable". While this is true for normal locations, it's INCORRECT for laser activation event locations:

1. Laser activation locations are in the "Entry" region (always reachable)
2. They depend on completing laser panels in OTHER regions (e.g., "Bunker Laser Platform")
3. The Python code correctly adds region reachability checks for cross-region dependencies
4. But the Witness exporter's postprocess_rule method simplifies these away, breaking the logic

The function has a TODO comment acknowledging this is a "TEMPORARY WORKAROUND" and should be replaced with proper can_reach rules.

**Expected Behavior:**
The laser activation locations should either:
1. Require completing the corresponding laser panel location, OR
2. Inherit the item requirements that make the laser panel accessible

**Files Involved:**
- `worlds/witness/data/WitnessLogic.txt` - Defines laser entity dependencies
- `worlds/witness/player_logic.py` - Processes entity dependencies into requirements
- `worlds/witness/rules.py` - Creates lambda functions for location access
- `exporter/exporter.py` - Analyzes and exports access rules
- `exporter/analyzer.py` - Analyzes lambda functions
- `exporter/games/witness.py` - Witness-specific export handling

**Next Steps:**
1. Investigate why the analyzer is converting these dependencies to constant true
2. Check if the Python lambda functions are being created correctly
3. Determine if a Witness-specific helper or custom export handler is needed
4. Implement a fix that properly exports entity completion checks
