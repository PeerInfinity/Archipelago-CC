# VVVVVV Remaining Exporter Issues

This document tracks outstanding exporter-related issues for VVVVVV.

## Status
Helper function `_has_trinket_range` has been implemented, but exporter issues remain.

## Issues

### 1. Missing door_cost and area_cost_map in settings export
**Status:** Not started
**Priority:** High
**Description:**
The VVVVVV world uses `options.door_cost` and a dynamically created `area_cost_map` dictionary in the access rules for area connections. These values are not being exported to the rules.json file, causing the JavaScript rule engine to fail when trying to evaluate the expressions.

**Python Code (worlds/v6/Rules.py):**
```python
def set_rules(multiworld, options, player, area_connections, area_cost_map):
    # ...
    menu_region.connect(connecting_region=target_region,
                       rule=lambda state, i=i: _has_trinket_range(state, player,
                                                                  options.door_cost * (area_cost_map[i] - 1),
                                                                  options.door_cost * area_cost_map[i]))
```

**Current Behavior:**
- The access rule contains references to `options.door_cost` and `area_cost_map[i]` as AST nodes
- These need to be resolved before calling the helper function
- The values are not exported to `settings` in the rules.json

**Required Fix:**
Create a VVVVVV exporter (`exporter/games/v6.py`) that:
1. Exports `door_cost` value to settings
2. Exports `area_cost_map` dictionary to settings
3. Ensures these values are accessible to the rule engine during evaluation

**Test Case:**
After fix, Laboratory region should become accessible in sphere 0.4 when player has Trinket 01, 02, and 03.

**door_cost default value:** 3
**area_cost_map (when area_cost is false):** `{0: 0, 1: 1, 2: 2, 3: 3, 4: 4}`
