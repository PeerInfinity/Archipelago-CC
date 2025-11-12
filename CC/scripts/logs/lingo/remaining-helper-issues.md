# Remaining Helper Issues for Lingo

## Issue 1: Helper functions need proper implementation

**Status:** Partially implemented (placeholders)
**Type:** Incomplete helper functions
**Priority:** High

**Description:**
The helper functions `lingo_can_use_entrance` and `lingo_can_use_location` have been created with placeholder implementations that just return `true`. This prevents proper logic evaluation and causes regions to not be accessible when they should be.

**Current Status:**
- `lingo_can_use_entrance(snapshot, staticData, room, door)` - Placeholder that returns true
- `lingo_can_use_location(snapshot, staticData, location)` - Placeholder that returns true

**Root Cause:**
The `door` parameter is coming as `{"type": "name", "name": "door"}` which is an unresolved variable reference from the Python closure. The exporter cannot serialize the RoomAndDoor NamedTuple properly.

**Impact:**
37 regions are not accessible when they should be:
- Color Hallways, Compass Room, Crossroads, Dead End Area, Directional Gallery, Far Window, Hallway Room (1), Hedge Maze, Hidden Room, Hub Room, Near Far Area, Number Hunt, Orange Tower, Orange Tower Second Floor, Outside The Agreeable, Outside The Bold, Outside The Undeterred, Outside The Wondrous, Owl Hallway, Second Room, Starting Room, Sunwarps, The Artistic (Apple), The Artistic (Lattice), The Artistic (Panda), The Artistic (Smiley), The Eyes They See, The Seeker, The Steady (Rose), The Traveled, The Wondrous, The Wondrous (Bookcase), The Wondrous (Chandelier), The Wondrous (Doorknob), The Wondrous (Table), The Wondrous (Window), Welcome Back Area, Wondrous Lobby

**Action Required:**
This is a complex issue that requires fixing the exporter to properly resolve and serialize the `door` variable from closures. The helper functions are infrastructure but the real fix needs to be in the exporter.
