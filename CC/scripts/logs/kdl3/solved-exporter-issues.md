# Solved Exporter Issues for Kirby's Dream Land 3

## Issue 1: Event items not included in items_data [SOLVED]

**Description:**
Event items (items with `code=None`) like "Grass Land - Stage Completion" and "Level 1 Boss Defeated" were not being included in the items section of the rules.json file. This caused locations that require these items to fail validation.

**Error:**
```
STATE MISMATCH found for: Sphere 0.14
> Locations accessible in STATE (and unchecked) but NOT in LOG: Level 1 Boss - Defeated
```

**Warnings:**
```
[WARN] [InventoryManager] Adding unknown item: Grass Land - Stage Completion
[WARN] [InventoryManager] Adding unknown item: Level 1 Boss Defeated
```

**Root Cause:**
The exporter only included items that were in `world.item_id_to_name` (items with IDs). Event items with `code=None` were created dynamically using `place_locked_item()` but were never added to `item_id_to_name`, so they didn't get exported.

**Location in Code:**
exporter/exporter.py:898-909 - Only updated existing items, didn't add new event items

**Fix:**
Modified the exporter to collect all items placed at locations, including event items, and add them to items_data even if they don't have an ID.

**Changes:**
- exporter/exporter.py:897-934 - Added logic to create item entries for event items when they're encountered at locations
- exporter/exporter.py:936-972 - Added same logic for precollected items

**Verification:**
Event items now appear in rules.json:
```json
{
  "name": "Grass Land - Stage Completion",
  "id": null,
  "groups": [],
  "advancement": true,
  "useful": false,
  "trap": false,
  "event": true,
  "type": null,
  "max_count": 6
}
```
