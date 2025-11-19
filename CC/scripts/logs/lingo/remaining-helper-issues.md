# Remaining Helper Issues for Lingo

## Issue 1: Missing Regions at Sphere 0 (CRITICAL)

**Status**: Root cause identified - investigation ongoing

### Symptoms
- Sphere 0 should have 38 accessible regions according to the Python sphere log
- JavaScript state manager only finds 14 regions as reachable
- Test fails at Sphere 0 with significant region mismatch

### Expected vs Actual Regions

**Expected (38 regions from Python sphere log)**:
Color Hallways, Compass Room, Crossroads, Dead End Area, Directional Gallery, Far Window, Hallway Room (1), Hedge Maze, Hidden Room, Hub Room, Menu, Near Far Area, Number Hunt, Orange Tower, Orange Tower Second Floor, Outside The Agreeable, Outside The Bold, Outside The Undeterred, Outside The Wondrous, Owl Hallway, Second Room, Starting Room, Sunwarps, The Artistic (Apple), The Artistic (Lattice), The Artistic (Panda), The Artistic (Smiley), The Eyes They See, The Seeker, The Steady (Rose), The Traveled, The Wondrous, The Wondrous (Bookcase), The Wondrous (Chandelier), The Wondrous (Doorknob), The Wondrous (Table), The Wondrous (Window), Welcome Back Area, Wondrous Lobby

**Actual (14 regions found by JavaScript)**:
Menu, Starting Room, Hidden Room, The Seeker, Second Room, Hub Room, Dead End Area, Sunwarps, Crossroads, The Tenacious, Near Far Area, Hedge Maze, Orange Tower, Owl Hallway

### Root Cause Analysis

1. **Helper function is working correctly**: The `lingo_can_use_entrance` helper is being called and evaluates correctly. It properly checks door_reqs and item_by_door.

2. **Iterative evaluation is working**: The state manager DOES iteratively evaluate regions. For example:
   - Starting Room becomes reachable
   - Second Room becomes reachable (from Starting Room)
   - Hub Room becomes reachable (from Second Room)
   - Crossroads becomes reachable (from Hub Room)

3. **Critical finding**: Crossroads IS reachable, and there exists an entrance "Crossroads to Outside The Agreeable" with `access_rule: true` (unconditional access). Yet "Outside The Agreeable" is NOT in the final reachable set!

4. **Hypothesis**: The state manager may not be properly evaluating ALL exits from reachable regions, or there's an issue with how entrance access rules are being processed.

### Debugging Evidence

From debug logs:
- `lingo_can_use_entrance` is called correctly with proper parameters
- Door requirements are being checked against regionReachability
- Regions become reachable in the expected order (Menu → Starting Room → Second Room → Hub Room → Crossroads)
- However, many entrances with simple access rules (like `access_rule: true`) are not resulting in their target regions becoming reachable

### Configuration

- `shuffle_colors`: false (not exported to settings, defaults to false)
- Color requirements are correctly being ignored when shuffle_colors is disabled
- Door requirements include room dependencies which create dependency chains that are being resolved iteratively

### Next Steps

1. Verify that the state manager is actually evaluating ALL exits from reachable regions
2. Check if there's an issue with the entrance access rule evaluation in the state manager
3. Add logging to the state manager to see which entrances are being evaluated and which are being skipped
4. Compare the state manager's evaluation loop with the Python logic to identify discrepancies

### Potential Fixes

Suspects:
- State manager may be caching entrance evaluations and not re-evaluating them after new regions become reachable
- State manager may be skipping some entrances during evaluation
- There may be a bug in how the state manager marks regions as reachable after successful entrance evaluation

### Debug Logging Added

Added extensive console.log statements to:
- `lingo_can_use_entrance`: Logs all function calls, parameters, and return values
- `_lingo_can_satisfy_requirements`: Logs room requirement checks and current reachable regions

These logs should be removed before final commit once the issue is resolved.
