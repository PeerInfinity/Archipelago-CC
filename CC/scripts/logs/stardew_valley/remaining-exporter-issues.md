# Remaining Exporter Issues

## Issue 1: Virtual event items not exported ("Received Progression Percent", "Received Progression Item")

**Location**: `exporter/games/stardew_valley.py`

**Problem**:
- Stardew Valley uses virtual event items like "Received Progression Percent" and "Received Progression Item"
- These items are computed automatically by the Python backend's CollectionState
- They are NOT in the item_table and are not exported to the items list in rules.json
- Rules check for these items (e.g., `item_check` for "Received Progression Percent" with count=4)
- Frontend state manager can't find these items in inventory, so rules fail

**Test Failure**: "Read Jack Be Nimble, Jack Be Thick" location at Sphere 0.11
- Access rule requires: `item_check(Received Progression Percent, count=4)`
- At sphere 0.11, player has 4 progression percent items
- But frontend can't evaluate the rule because the item doesn't exist in its tracking

**Solution Needed**:
Export virtual event items to the items list with proper definitions, and ensure the state manager knows how to compute their counts from the actual progression items received.

