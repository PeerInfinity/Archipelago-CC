# Starcraft 2 Rule Types Investigation

## Summary

The SC2 game currently works with spoiler testing passing. The blacklisted helpers have JavaScript fallback implementations in `frontend/modules/shared/gameLogic/sc2/helpers.js`.

## Recent Improvements

### Static Data Export for Rating Dictionaries

We've implemented infrastructure to export rating dictionaries (like `tvx_defense_ratings`) as static data in rules.json. This enables helpers that use these dictionaries to be exported as JSON rules instead of requiring JavaScript fallback.

**Changes Made:**
1. **exporter/games/sc2.py**: Added `preprocess_world_data` to export rating dictionaries as `static_data.rating_tables`
2. **exporter/exporter.py**: Added `static_data` and `helpers` to export key ordering
3. **frontend/modules/shared/ruleEngine.js**: Updated `sum_of` rule to handle dictionary iteration (Python's `for item in dict` yields keys)

**Helpers Now Exported:**
- `terran_defense_rating` - uses dictionary iteration with `sum_of`
- `terran_sustainable_mech_heal` - simple boolean logic
- `terran_can_rescue` - simple `has_any` + settings check
- `terran_cliffjumper` - simple `has`/`has_all`
- `terran_able_to_snipe_defiler` - simple `has`/`has_any`/`has_all`
- `soa_power_rating` - complex loops with `break` statements (rule engine supports this)
- `terran_power_rating` - uses dictionary iteration and calls soa_power_rating
- `basic_kerrigan` - iterates over imported list (removed from blacklist)

### Kerrigan Item Groups Export

Added export of kerrigan item groups as static data for helpers that iterate over these lists:
- `kerrigan_non_ulimates`
- `kerrigan_logic_active_abilities`
- `kerrigan_abilities`
- `kerrigan_passives`
- `kerrigan_active_abilities`

**Remaining Blacklisted:**
- `kerrigan_levels` - calls external function `get_full_item_list()` which can't be resolved at export time
- `two_kerrigan_actives` - has logic bug in Python (see below), JS fallback has correct implementation
- `competent_comp` helpers - complex conditional logic with many dependencies

### Known Bug: two_kerrigan_actives

The Python implementation in `worlds/sc2/rules.py` has a bug where the loop variable is unused:

```python
# BUGGY Python code - loop variable 'i' is never used
def two_kerrigan_actives(self, state, story_tech_available=True):
    count = 0
    for i in range(7):  # BUG: i is never used!
        if state.has_any(kerrigan_logic_active_abilities, self.player):
            count += 1
    return count >= 2
```

The condition `state.has_any(kerrigan_logic_active_abilities, self.player)` is checked 7 times identically, which means it either passes immediately (count=7) or fails (count=0).

**The JavaScript fallback has the CORRECT implementation** - it checks each kerrigan tier separately:

```javascript
// CORRECT JS implementation - counts per tier
const kerriganActivesTiers = [
    ['Kinetic Blast (Kerrigan Tier 1)', 'Leaping Strike (Kerrigan Tier 1)'],
    ['Crushing Grip (Kerrigan Tier 2)', 'Psionic Shift (Kerrigan Tier 2)'],
    [],  // Tier 3 has no actives
    ['Wild Mutation (Kerrigan Tier 4)', 'Spawn Banelings (Kerrigan Tier 4)', 'Mend (Kerrigan Tier 4)'],
    // ... etc
];
for (const tier of kerriganActivesTiers) {
    if (tier.length > 0 && has_any(snapshot, tier)) {
        count++;
    }
}
return count >= 2;
```

**Resolution**: This helper MUST remain blacklisted so that the correct JavaScript implementation is used instead of the buggy Python export. This is an upstream Archipelago bug that should be reported.

## Current Status

### Exported to JSON (17 helpers)
These helpers are successfully converted to JSON rule definitions:
- `is_item_placement`
- `marine_medic_firebat_upgrade`
- `marine_medic_upgrade`
- `nova_anti_air_weapon`, `nova_full_stealth`, `nova_heal`, `nova_ranged_weapon`
- `terran_air`, `terran_air_anti_air`, `terran_basic_anti_air`
- `terran_bio_heal`, `terran_common_unit`, `terran_competent_anti_air`
- `terran_early_tech`, `terran_maw_requirement`, `terran_moderate_anti_air`
- `weapon_armor_upgrade_count`

### Blacklisted Helpers (reduced from 36)
These helpers are NOT exported to JSON due to complexity. They fall back to JavaScript implementations.
The blacklist has been reduced as more helpers now export correctly (see "Helpers Now Exported" section above).

#### Competent Composition Helpers (3)
- `terran_competent_comp`, `protoss_competent_comp`, `zerg_competent_comp`
- **Why blacklisted**: Calls `weapon_armor_upgrade_count` with complex arithmetic comparisons

#### Rating Helpers (4 remaining)
- `protoss_defense_rating`, `zerg_defense_rating`
- `protoss_power_rating`, `zerg_power_rating`
- **Why blacklisted**: Use generator expressions with dictionary iteration (protoss/zerg variants not yet removed from blacklist)
- **Note**: `terran_defense_rating` and `terran_power_rating` have been removed from blacklist and now export correctly

#### Mission Requirement Helpers (10+)
- `terran_havens_fall_requirement`, `terran_great_train_robbery_train_stopper`
- `terran_welcome_to_the_jungle_requirement`, etc.
- **Why blacklisted**: Call other blacklisted helpers like `terran_defense_rating`

#### Kerrigan Helpers (2 remaining)
- `kerrigan_levels`, `two_kerrigan_actives`
- **Why blacklisted**:
  - `kerrigan_levels`: Calls `get_full_item_list()` - external function that can't be resolved at export time
  - `two_kerrigan_actives`: Has logic bug in Python code - MUST use JS fallback which has correct implementation (see Known Bug section above)
- **Note**: `basic_kerrigan` has been removed from blacklist and now exports correctly using kerrigan_non_ulimates from static_data

#### Combat Capability Helpers (8+)
- `terran_beats_protoss_deathball`, `terran_base_trasher`, etc.
- **Why blacklisted**: Call other blacklisted helpers
- **Note**: `terran_can_rescue`, `terran_cliffjumper`, `terran_able_to_snipe_defiler`, `terran_sustainable_mech_heal` have been removed from blacklist

## JavaScript Fallback Coverage

All blacklisted helpers have JavaScript implementations in `frontend/modules/shared/gameLogic/sc2/helpers.js`:
- 51 helper functions implemented
- Coverage is complete for all helpers called in access rules

## Patterns That Need New Rule Types

### 1. External Dictionary Lookups (MEDIUM PRIORITY)
**Pattern**: `dictionary[item]` where dictionary is imported from another module
```python
tvx_defense_ratings[item]  # from worlds/sc2/rules.py imports
```
**Solution**: Export dictionaries as constants in rules.json at generation time

### 2. External Function Calls (LOW PRIORITY)
**Pattern**: `get_full_item_list()[item].number`
```python
level_amount = get_full_item_list()[kerrigan_level_item].number
```
**Solution**: Pre-compute and inline values during export, or create a `static_data_lookup` rule type

### 3. Generator Expressions with External Iteration (MEDIUM PRIORITY)
**Pattern**: `sum(expr for item in external_dict if condition)`
```python
sum((rating for item, rating in dict.items() if state.has(item, self.player)))
```
**Status**: The `generator_expression` type exists but needs the dictionary to be available

### 4. Custom Functions (LOW PRIORITY)
**Pattern**: `min2(a, b)` - custom helper function
**Solution**: Either inline as `min(a, b)` or add to built-in functions

## Recommendations

### Short-term (No code changes needed)
The current system works because JavaScript implementations provide fallback logic. No immediate action required.

### Medium-term Improvements

1. **Export Dictionaries as Static Data**
   - Export `tvx_defense_ratings`, `pvx_defense_ratings`, etc. to rules.json
   - This would allow generator expressions to work
   - Enables removing many helpers from blacklist

2. **Inline External Function Results**
   - During export, resolve `get_full_item_list()[item].number` to actual values
   - Store as constants in the exported helper

3. **Report Upstream Bug**
   - `two_kerrigan_actives` has a bug in upstream Archipelago `worlds/sc2/rules.py`
   - The loop variable is unused - should iterate over kerrigan tiers, not `range(7)`
   - The JavaScript fallback has the CORRECT implementation, so this helper must stay blacklisted
   - Consider reporting this bug to upstream Archipelago repository

### Long-term Architecture

Consider a hybrid approach:
1. Export as much logic as possible to JSON for transparency
2. Keep complex calculations that depend on external data in JavaScript
3. Add validation to ensure JSON rules and JS helpers produce consistent results

## Files Reference

| File | Purpose |
|------|---------|
| `exporter/games/sc2.py` | SC2-specific export handler with blacklist |
| `worlds/sc2/rules.py` | Original Python helper functions |
| `frontend/modules/shared/gameLogic/sc2/helpers.js` | JavaScript helper implementations |
| `frontend/modules/shared/gameLogic/sc2/sc2Logic.js` | SC2 game logic module |
| `frontend/modules/shared/ruleEngine.js` | Rule evaluation engine |

## Testing

```bash
# Generate SC2 multiworld
python Generate.py --weights_file_path "Templates/Starcraft 2.yaml" --multi 1 --seed 1

# Run spoiler test
npm test -- --mode=test-spoilers --game=sc2 --seed=1
```

Both tests currently pass.
