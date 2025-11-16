# Remaining Helper Issues for Lingo

## Potential Helper Issues

### lingo_can_use_entrance
The lingo_can_use_entrance helper may not be working correctly, as many regions are not reachable at sphere 0. Need to investigate if:
1. Door parameter is being passed correctly
2. Item lookup for doors is working
3. Door requirements checking is implemented properly

### Door Requirements (door_reqs)
The TODO comments in lingoLogic.js indicate that door_reqs checking is not fully implemented:
- Line 52: "TODO: Implement proper access requirements checking for doors without items"
- Line 209: "TODO: Export and check door_reqs data"

This needs to be implemented to properly check doors that don't have associated items.

