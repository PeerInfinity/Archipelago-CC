# Remaining Helper Issues

## Issue 1: Missing `_lingo_can_satisfy_requirements` helper function

**Status**: Not implemented

**Description**: The helper function `_lingo_can_satisfy_requirements` is called in many location and entrance access rules but is not implemented in the JavaScript frontend.

**Error Message**:
```
Helper function "_lingo_can_satisfy_requirements" NOT FOUND in snapshotInterface
```

**Impact**: This causes 19 locations to be inaccessible in sphere 0, including:
- Fours, Hallway Room (1) - OUT, Hidden Room - DEAD END, Hidden Room - OPEN, Hub Room - OPEN, Hub Room - TRACE, Outside The Bold - BEGIN, Outside The Undeterred - ONE, Outside The Wondrous - SHRINK, Second Room - Good Luck, Starting Room - HI, Starting Room - HIDDEN, The Eyes They See - NEAR, The Seeker - Achievement, The Traveled - Achievement, The Traveled - HELLO, Threes, Twos, Welcome Back Area - WELCOME BACK

**Python Implementation** (from worlds/lingo/rules.py:48):
```python
def _lingo_can_satisfy_requirements(state: CollectionState, access: AccessRequirements, world: "LingoWorld"):
    for req_room in access.rooms:
        if not state.can_reach(req_room, "Region", world.player):
            return False

    for req_door in access.doors:
        if not _lingo_can_open_door(state, req_door.room, req_door.door, world):
            return False

    if len(access.colors) > 0 and world.options.shuffle_colors:
        for color in access.colors:
            if not state.has(color.capitalize(), world.player):
                return False

    if not all(state.has(item, world.player) for item in access.items):
        return False

    if not all(state.has(item, world.player, index) for item, index in access.progression.items()):
        return False

    if access.the_master and not lingo_can_use_mastery_location(state, world):
        return False

    if access.postgame and state.has("Prevent Victory", world.player):
        return False

    return True
```

**AccessRequirements structure** (from worlds/lingo/player_logic.py:17):
```python
class AccessRequirements:
    rooms: Set[str]          # Rooms that must be reachable
    doors: Set[RoomAndDoor]  # Doors that must be openable
    colors: Set[str]         # Color items required (if shuffle_colors)
    items: Set[str]          # Items required
    progression: Dict[str, int]  # Progressive items with required count
    the_master: bool         # Requires mastery completion
    postgame: bool           # Postgame flag
```

**Next Steps**:
1. Need to check how AccessRequirements is exported to the rules.json
2. Implement the helper function in lingoLogic.js to evaluate AccessRequirements
3. May also need to implement `_lingo_can_open_door` as a separate helper

