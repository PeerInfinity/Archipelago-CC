# ALTTP Rule Types Investigation

This document summarizes the investigation into what rule types are needed to support helper functions in A Link to the Past.

## Current Status

**Tests pass**: The ALTTP spoiler tests pass successfully, meaning all rule evaluation works correctly.

**Update**: The `region_reference` and `region_attribute` rule types have been implemented, enabling export of `can_get_good_bee` and `is_not_bunny` helpers.

**Update**: Fixed parameter name resolution in helper export. Parameters like `quantity` and `count` are now preserved as name references instead of being resolved to default values. This enabled `can_kill_most_things` export.

### Exported Helpers (25 total)

These helpers are successfully exported as JSON rule definitions and evaluated by the frontend rule engine:

| Helper | Key Rule Types Used |
|--------|-------------------|
| `basement_key_rule` | item_check, count_check |
| `bottle_count` | min, group_count |
| `can_activate_crystal_switch` | item_check, helper calls |
| `can_bomb_or_bonk` | item_check, helper (can_use_bombs) |
| `can_extend_magic` | block, assign, conditional, binary_op, helper calls |
| `can_hold_arrows` | conditional, setting_value, count_item, binary_op |
| `can_lift_heavy_rocks` | item_check |
| `can_lift_rocks` | item_check |
| `can_melt_things` | item_check, setting_value |
| `can_retrieve_tablet` | item_check, setting_value |
| `can_shoot_arrows` | setting_value, item_check, helper calls |
| `can_use_bombs` | block, assign, conditional, setting_value, count_item |
| `cross_peg_bridge` | item_check |
| `has_beam_sword` | item_check |
| `has_crystals` | group_count, compare |
| `has_fire_source` | item_check |
| `has_hearts` | helper (heart_count), compare |
| `has_melee_weapon` | helper (has_sword), item_check |
| `has_misery_mire_medallion` | setting_value with subscript |
| `has_sword` | item_check |
| `has_turtle_rock_medallion` | setting_value with subscript |
| `heart_count` | min, count_item, setting_value, binary_op |
| `can_get_good_bee` | block, assign, region_reference, helper calls |
| `is_not_bunny` | conditional, item_check, region_attribute, setting_value |
| `can_kill_most_things` | conditional, setting_value, helper calls, default params |

### Blacklisted Helpers (7 total)

These helpers are NOT exported as JSON. They use JavaScript fallback implementations:

| Helper | Reason | JS Implementation |
|--------|--------|-------------------|
| `GanonDefeatRule` | Complex game-specific logic | Yes, in alttpLogic.js |
| `can_buy` | Uses shop_items data | Yes, in ruleEngine.js |
| `can_buy_unlimited` | Uses shop_items data | Yes, in ruleEngine.js |
| `item_name_in_location_names` | Dynamic item/location lookup | Complex dungeon logic |
| `tr_big_key_chest_keys_needed` | Complex dungeon key logic | Complex dungeon logic |
| `location_item_name` | Dynamic item/location lookup | Complex dungeon logic |
| `can_defeat_boss` | Boss-specific logic | Yes, in alttpLogic.js |

## Implemented: Region Attribute Support

### Region Object Support (for `can_get_good_bee`, `is_not_bunny`, `can_bomb_clip`)

These helpers use patterns like:
```python
def can_get_good_bee(state, player):
    cave = state.multiworld.get_region('Good Bee Cave', player)
    return (
        state.has_group("Bottles", player) and
        cave.can_reach(state) and
        is_not_bunny(state, cave, player)
    )

def is_not_bunny(state, region, player):
    if state.has('Moon Pearl', player):
        return True
    return region.is_light_world if state.multiworld.worlds[player].options.mode != 'inverted' else region.is_dark_world
```

**Implemented rule types:**
- `region_reference` - Captures a region reference from `state.multiworld.get_region(name, player)`
- `region_attribute` - Accesses region properties like `is_light_world`, `is_dark_world`
- Region references can be passed as helper arguments (stored in local scope)
- `variable.can_reach()` on region references is handled by the frontend

### 2. Self-Locking Item Logic (for `item_name_in_location_names`, `location_item_name`)

These helpers check what item is placed at a specific location:
```python
def location_item_name(state, location_name, player):
    # Returns the item placed at the given location
    location = state.multiworld.get_location(location_name, player)
    return (location.item.name, location.item.player) if location.item else None
```

**Challenge:** This requires access to the randomized item placements, which may:
- Not be available during export (circular dependency)
- Need special handling for logic that varies based on item placement

**Current solution:** The JavaScript implementations handle this using the `canonical_placements` data in rules.json.

## Recommendations

### Completed: Region Attribute Support

The following improvements have been implemented:
- `region_reference` rule type to capture region references from `get_region()` calls
- `region_attribute` rule type to access region properties
- Frontend handling for `can_reach()` calls on region references

This enables `can_get_good_bee` and `is_not_bunny` to be exported as JSON rules.

### Remaining: Self-Locking Item Logic

The `item_name_in_location_names` and `location_item_name` helpers still use JavaScript
implementations because they require access to `canonical_placements` data at runtime.

### Already Working Well

- Tests pass for ALTTP
- Remaining blacklisted helpers have working JavaScript implementations
- Complex dungeon logic (boss defeat, key counting) is well-suited for JavaScript

### Future Considerations (Lower Priority)

For reference, this was the suggested approach that has now been implemented:
   ```javascript
   case 'region_attribute': {
     const regionName = evaluateRule(rule.region, context, depth + 1);
     const regions = context.getStaticData()?.regions?.[playerId]?.[regionName];
     result = regions?.[rule.attr];
     break;
   }
   ```

## Files Referenced

| File | Purpose |
|------|---------|
| `worlds/alttp/StateHelpers.py` | Original Python helper implementations |
| `exporter/games/alttp.py` | ALTTP-specific export handler with blacklist |
| `exporter/analyzer/ast_visitors.py` | Python AST to JSON rule conversion |
| `frontend/modules/shared/ruleEngine.js` | Frontend rule evaluation |
| `frontend/modules/shared/gameLogic/alttp/alttpLogic.js` | ALTTP JavaScript helper implementations |

## Conclusion

The ALTTP helper export system is working correctly:
1. `can_get_good_bee` and `is_not_bunny` are now exported as JSON rules (region_reference/region_attribute support)
2. `can_kill_most_things` is now exported as JSON rules (fixed parameter name preservation)
3. The remaining blacklisted helpers are appropriate - shop logic, boss logic, and key counting are better handled in JavaScript
4. 25 helpers are now exported as JSON, up from 22
