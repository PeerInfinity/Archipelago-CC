# Solved Exporter Issues

## Issue 1: Access rule evaluation failure - "capability" rule type not supported ✅ SOLVED

**Description**: The test was failing because multiple locations had access rules with type "capability" (e.g., `{"type": "capability", "capability": "fight", "inferred": true}`). The frontend rule engine does not recognize this rule type.

**Solution**: Created a custom exporter (`exporter/games/jakanddaxter.py`) that expands capability rules into proper item_check rules:
- `can_fight` → OR check for Jump Dive, Jump Kick, Punch, or Kick
- `can_free_scout_flies` → Jump Dive OR (Crouch AND Crouch Uppercut)

**Implementation**: `JakAndDaxterGameExportHandler.expand_rule()` method handles capability rules and helper functions

**Result**: All Sphere 0 tests now pass. Test progresses to Sphere 3.15.

## Issue 2: State method calls with has_any/has_all ✅ SOLVED

**Description**: Region connections used `state_method` calls with methods `has_any` and `has_all` that the frontend couldn't handle.

**Example**:
```json
{
  "type": "state_method",
  "method": "has_any",
  "args": [
    {"type": "constant", "value": ["Double Jump", "Jump Kick"]},
    {"type": "name", "name": "p"}
  ]
}
```

**Solution**: Added handling in the exporter to convert these to proper OR/AND item checks:
- `has_any(items)` → OR of item_check for each item
- `has_all(items)` → AND of item_check for each item

**Implementation**: `JakAndDaxterGameExportHandler.expand_rule()` handles state_method expansion

**Result**: Region connectivity now works correctly.

## Issue 3: Constant-wrapped item values ✅ SOLVED

**Description**: Item fields in item_check rules were wrapped in constant objects:
```json
{
  "type": "item_check",
  "item": {"type": "constant", "value": "Blue Eco Switch"}
}
```

**Solution**: Added `_unwrap_constant()` method that extracts values from constant wrappers

**Implementation**: Applied automatically to item and count fields in item_check rules

**Result**: Item checks now evaluate correctly.

## Issue 4: Subscript operations for item lookups ✅ SOLVED

**Description**: Many locations used subscript operations to look up items from item_table:
```json
{
  "type": "item_check",
  "item": {
    "type": "subscript",
    "value": {"type": "name", "name": "item_table"},
    "index": {"type": "constant", "value": 741001100}
  },
  "count": 7
}
```

**Solution**:
1. Built a mapping of item IDs to names from `worlds.jakanddaxter.items.item_table` in the exporter constructor
2. Added `_resolve_subscript()` method that resolves item_table lookups to actual item names
3. Applied subscript resolution before unwrapping constants in item_check rules

**Implementation**:
- `JakAndDaxterGameExportHandler.__init__()` builds `item_id_to_name` mapping
- `_resolve_subscript()` handles item_table lookups
- Applied in `expand_rule()` for item_check rules

**Result**: Scout fly collection requirements (e.g., "Free 7 Scout Flies") now work correctly. ID 741001100 resolves to "Scout Fly - Rock Village".

**Progress Summary**: With these 4 fixes, the spoiler test now passes Spheres 0 through 3.14 successfully.

