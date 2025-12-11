# ALTTP Rule Types Investigation

This document summarizes the investigation into what rule types are needed to support helper functions in A Link to the Past.

## Current Status

**Tests pass**: The ALTTP spoiler tests pass successfully, meaning all rule evaluation works correctly.

### Exported Helpers (22 total)

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

### Blacklisted Helpers (9 total)

These helpers are NOT exported as JSON. They use JavaScript fallback implementations:

| Helper | Reason | JS Implementation |
|--------|--------|-------------------|
| `GanonDefeatRule` | Complex game-specific logic | Yes, in alttpLogic.js |
| `can_buy` | Uses shop_items data | Yes, in ruleEngine.js |
| `can_buy_unlimited` | Uses shop_items data | Yes, in ruleEngine.js |
| `can_get_good_bee` | Uses region objects | Yes, in alttpLogic.js |
| `can_kill_most_things` | Complex logic, already has JS impl | Yes, in alttpLogic.js |
| `item_name_in_location_names` | Dynamic item/location lookup | Complex dungeon logic |
| `tr_big_key_chest_keys_needed` | Complex dungeon key logic | Complex dungeon logic |
| `location_item_name` | Dynamic item/location lookup | Complex dungeon logic |
| `can_defeat_boss` | Boss-specific logic | Yes, in alttpLogic.js |

## What Would Be Needed to Export More Helpers

### 1. Region Object Support (for `can_get_good_bee`, `is_not_bunny`, `can_bomb_clip`)

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

**Required rule types:**
- `get_region` - Capture a region reference from `state.multiworld.get_region(name, player)`
- `region_attribute` - Access region properties like `is_light_world`, `is_dark_world`
- Support for passing region objects as helper arguments

**Alternative approach:** Pre-compute region attributes and make them available through settings or static data.

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

### Short-term (No Changes Needed)

The current system works well:
- Tests pass for ALTTP
- Blacklisted helpers have working JavaScript implementations
- Complex dungeon logic is better handled in JavaScript anyway

### Medium-term (Potential Improvements)

1. **Region attribute support**: Add `region_attribute` rule type that looks up pre-exported region attributes:
   ```javascript
   case 'region_attribute': {
     const regionName = evaluateRule(rule.region, context, depth + 1);
     const regions = context.getStaticData()?.regions?.[playerId]?.[regionName];
     result = regions?.[rule.attr];
     break;
   }
   ```

2. **is_not_bunny as special case**: Since this is used frequently, it could be converted to a special rule type that the frontend handles directly using pre-exported region data.

### Long-term (Lower Priority)

Implementing full region object support would require significant changes to both the analyzer and rule engine. Given that the JavaScript implementations work correctly, this may not be worth the effort.

## Files Referenced

| File | Purpose |
|------|---------|
| `worlds/alttp/StateHelpers.py` | Original Python helper implementations |
| `exporter/games/alttp.py` | ALTTP-specific export handler with blacklist |
| `exporter/analyzer/ast_visitors.py` | Python AST to JSON rule conversion |
| `frontend/modules/shared/ruleEngine.js` | Frontend rule evaluation |
| `frontend/modules/shared/gameLogic/alttp/alttpLogic.js` | ALTTP JavaScript helper implementations |

## Conclusion

The ALTTP helper export system is working correctly. The current blacklisted helpers are appropriate - they represent patterns that are either:
1. Better handled with JavaScript (shop logic, boss logic)
2. Dependent on runtime data (item placements)
3. Complex enough that JS implementation is clearer

No immediate changes are required. If expanding rule type support, focus on region attribute access as it would enable exporting `can_get_good_bee` and `is_not_bunny`.
