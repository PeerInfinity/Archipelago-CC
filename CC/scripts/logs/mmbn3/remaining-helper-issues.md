# Remaining Helper Issues

## Issue 1: Location "Job: My Navi is sick" not accessible after collecting "Recov30 *"

**Status:** Under investigation

**Description:**
- Sphere 3.2 test failure
- Location "Job: My Navi is sick" requires item "Recov30 *"
- After collecting "Recov30 *" from "Job: Legendary Tomes - Treasure", the location should become accessible
- Python backend correctly identifies it as accessible
- JavaScript frontend does not recognize it as accessible

**Access Rule:**
```json
{
  "type": "item_check",
  "item": {
    "type": "constant",
    "value": "Recov30 *"
  }
}
```

**Investigation:**
- Added `has` and `count` helper functions to mmbn3/helpers.js (didn't fix the issue)
- Item name "Recov30 *" contains a space and asterisk character
- The item is correctly defined in the items list
- The access rule is correctly exported in rules.json

**Next Steps:**
- Need deeper investigation into StateManager's behavior
- May require examining test infrastructure

