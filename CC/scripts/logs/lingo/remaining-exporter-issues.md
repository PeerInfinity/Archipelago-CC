# Lingo - Remaining Exporter Issues

## Critical Issues

### 1. "Sun Painting" entrance exported with incorrect constant true rule

**Status:** Partially fixed, needs more investigation

**Progress:**
- Modified exporter.py to pass connected_region to postprocess_entrance_rule
- Modified lingo.py to use connected_region for simple entrance names
- However, the method is still being called twice (once with connected_region=None)
- Need to investigate why both calls originate from line 595 (process_regions)

**Description:**
The "Sun Painting" entrance from "Starting Room" to "Pilgrim Antechamber" is being exported with `access_rule: {type: "constant", value: true}` instead of a proper helper call. This makes Pilgrim Antechamber accessible at Sphere 0 when it should only be accessible at Sphere 3.1 after collecting the "Pilgrim Room - Sun Painting" item.

**Root Cause:**
The entrance name "Sun Painting" doesn't follow the standard pattern "Source to Target (through Room - Door)", so the exporter's `postprocess_entrance_rule` method can't extract the door information from the name. When it detects a "broken" rule (analyzer failed) with no door_name extracted, it defaults to returning `{type: "constant", value: true}`.

**Expected Behavior:**
The entrance should have a helper call:
```json
{
  "type": "helper",
  "name": "lingo_can_use_entrance",
  "args": [
    {"type": "constant", "value": "Pilgrim Antechamber"},
    {
      "type": "tuple",
      "elements": [
        {"type": "constant", "value": "Pilgrim Antechamber"},
        {"type": "constant", "value": "Sun Painting"}
      ]
    }
  ]
}
```

**Solution Options:**
1. Modify the exporter to pass more context (entrance.connected_region) to postprocess_entrance_rule
2. Have postprocess_entrance_rule look up the door in world.player_logic.item_by_door when the name doesn't match the pattern
3. Improve the analyzer to correctly analyze the lingo_can_use_entrance lambda even when it references world.player_logic

**Investigation Notes:**
- The door "Pilgrim Antechamber - Sun Painting" is in item_by_door
- The item "Pilgrim Room - Sun Painting" exists and is required
- This is the only entrance that causes Pilgrim Antechamber to be incorrectly accessible at Sphere 0

## Non-Critical Issues

None identified yet.
