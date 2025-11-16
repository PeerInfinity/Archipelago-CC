# Remaining Exporter Issues for Lingo

## Test Results Summary
- **Test Date**: 2025-11-16 (Latest)
- **Seed**: 1
- **Status**: FAILED at Sphere 0 (Partial progress: Menu->Starting Room now works)

## Current Issue: Method calls in entrance rules

### Progress Made
- Menu exits to Starting Room, Sunwarps, and Orange Tower now properly simplified to `True`
- Starting Room is now accessible (not in missing regions list)
- world.player_logic references successfully replaced with settings

### Remaining Problem
Entrance rules from Starting Room use complex patterns like:
```
"Back Right Door" not in settings.item_by_door.get("Hidden Room")
```

This involves:
1. A method call: `settings.item_by_door.get("Hidden Room")`
2. The `not in` operator with a function_call result

The rule type is:
```json
{
  "type": "compare",
  "left": {"type": "constant", "value": "Back Right Door"},
  "op": "not in",
  "right": {
    "type": "function_call",
    "function": {
      "type": "attribute",
      "object": {"type": "attribute", "object": {"type": "name", "name": "settings"}, "attr": "item_by_door"},
      "attr": "get"
    },
    "args": [{"type": "constant", "value": "Hidden Room"}]
  }
}
```

### Solution Needed
The exporter needs to evaluate `settings.item_by_door.get("Hidden Room")` at export time and replace it with a simpler construct. Since `item_by_door` is exported in settings, we can:
1. Look up `settings['item_by_door'].get('Hidden Room')` during export
2. Replace the function_call with the actual result (either the dict value or None/empty dict)
3. Simplify the `not in` check accordingly

### Regions Still Not Accessible (35):
Color Hallways, Compass Room, Crossroads, Dead End Area, Directional Gallery, Far Window, Hallway Room (1), Hedge Maze, Hidden Room, Hub Room, Near Far Area, Number Hunt, Orange Tower Second Floor, Outside The Agreeable, Outside The Bold, Outside The Undeterred, Outside The Wondrous, Owl Hallway, Second Room, The Artistic (Apple), The Artistic (Lattice), The Artistic (Panda), The Artistic (Smiley), The Eyes They See, The Seeker, The Steady (Rose), The Traveled, The Wondrous, The Wondrous (Bookcase), The Wondrous (Chandelier), The Wondrous (Doorknob), The Wondrous (Table), The Wondrous (Window), Welcome Back Area, Wondrous Lobby

