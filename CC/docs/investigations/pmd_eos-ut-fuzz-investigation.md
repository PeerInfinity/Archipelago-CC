# PMD Explorers of Sky UT Fuzz Investigation

## Summary

**APWorld**: Pokemon Mystery Dungeon Explorers of Sky (pmd_eos)
**Version**: v0.3.2rc1
**Source**: https://github.com/CrypticMonkey33/ArchipelagoExplorersOfSky
**Test Results**: 0% success rate (10/10 failures)

## Error Breakdown

| Error Type | Count | Seeds |
|------------|-------|-------|
| `'Team Name Location'` (KeyError) | 5 | 1, 2, 3, 7, 8 |
| `None` (Logic mismatch) | 5 | 0, 4, 5, 6, 9 |

## Issue 1: KeyError 'Team Name Location'

### Root Cause

The apworld has a bug where the `"Team Name"` classification is not handled in the `create_regions` function.

**Location of the bug**: `pmd_eos/__init__.py`, `create_regions()` method (lines 120-354)

**The problem**:
1. `subX_table` in `RomTypeDefinitions.py` defines `Team Name Location` with classification `"Team Name"`:
   ```python
   SubXBitfield(127, 8, 1, 7, "Team Name Location", ["Main Game"], "Team Name Trap", "Team Name")
   ```

2. The `create_regions` function handles these classifications:
   - `"Free"`, `"Rank"`, `"EarlyDungeonComplete"`, `"EarlySubX"`, `"SpecialDungeonComplete"`
   - `"LateDungeonComplete"`, `"LateSubX"`, `"Manaphy"`, `"SecretRank"`, `"Legendary"`, `"Instrument"`
   - `"SpindaDrinkEvent"`, `"SpindaDrink"`, `"BossDungeonComplete"`
   - `"ProgressiveBagUpgrade"`, `"ShopItem"`, `"DojoDungeonComplete"`, `"SEDungeonUnlock"`
   - `"RuleDungeonComplete"`, `"OptionalSubX"`

3. **`"Team Name"` classification is NOT handled**, so the location is never created.

4. In `Rules.py`, `subx_rules()` iterates over all SubX items and tries to add rules:
   ```python
   add_rule(world.multiworld.get_location(item.flag_definition, player), ...)
   ```
   This fails with `KeyError: 'Team Name Location'` because the location doesn't exist.

### Fix Required (in apworld)

Either:
1. Add handling for `"Team Name"` classification in `create_regions()`:
   ```python
   elif location.classification == "Team Name":
       extra_items_region.locations.append(EOSLocation(self.player, location.name,
                                                       location.id, extra_items_region))
   ```

2. Or add a check in `subx_rules()` to skip if the location doesn't exist:
   ```python
   if item.classification == "Team Name":
       continue  # Location not created
   ```

## Issue 2: Logic Mismatches

### Symptoms

Locations like Rank checks (Diamond Rank, Super Rank, etc.) and Shop Items are marked as reachable by the server but not by the UT tracker.

### Root Cause

The apworld uses complex rule patterns that are not properly captured by the default rules exporter:

1. **Rank-based logic**: The Rank locations have conditional rules based on `max_rank` option
2. **Dynamic location creation**: Some locations are only created based on option values
3. **Complex lambda rules**: The rules use patterns like `state.has_group()` with custom groups

Without a custom exporter for `pmd_eos`, these complex patterns are not correctly translated to the rules JSON.

### Example from logs

```
Locations Diamond Rank,Super Rank,Ultra Rank,Hyper Rank,Master Rank were expected to be in logic but weren't
```

The server thinks these are reachable, but the UT doesn't because the exported rules don't correctly represent the game's progression logic.

## Additional Issues

1. **Item/Location count mismatch**: The apworld often has more items than locations:
   ```
   Player 0-0 had 1 more items than locations.
   Unable to place all items.
   ```

2. **Missing manifest**: The apworld is missing `archipelago.json`:
   ```
   Invalid or missing manifest file for pmd_eos.apworld. This apworld will stop working with Archipelago 0.7.0.
   ```

## Recommendations

### For the APWorld Maintainer

1. **Fix the Team Name Location bug**: Add handling for the `"Team Name"` classification in `create_regions()` or skip it in `subx_rules()`.

2. **Fix item/location count**: Ensure the item pool matches the number of available locations.

3. **Add archipelago.json manifest**: Required for Archipelago 0.7.0 compatibility.

### For This Repository

1. **Add to known-incompatible list**: Until the apworld is fixed, it should be marked as incompatible with UT tracking.

2. **Create custom exporter (optional)**: A `pmd_eos.py` exporter could be created to handle the special rule patterns, but this only helps with logic mismatches, not the KeyError bug.

## Files Examined

- `custom_worlds/pmd_eos.apworld/pmd_eos/__init__.py` - World class, `create_regions()`
- `custom_worlds/pmd_eos.apworld/pmd_eos/Rules.py` - `subx_rules()` function
- `custom_worlds/pmd_eos.apworld/pmd_eos/Locations.py` - Location data tables
- `custom_worlds/pmd_eos.apworld/pmd_eos/RomTypeDefinitions.py` - SubX bitfield definitions

## Investigation Date

2026-01-23
