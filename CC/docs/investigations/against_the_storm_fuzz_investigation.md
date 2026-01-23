# Against the Storm APWorld Fuzz Investigation

## Summary

The Against the Storm apworld (v1.1.0) fails the Universal Tracker (UT) fuzz test with a **0% success rate**. The failures are primarily due to issues within the apworld itself, not the UT/exporter infrastructure.

## APWorld Details

- **Source**: https://github.com/Ryguy-9999/ArchipelagoATS
- **Version**: v1.1.0
- **Download URL**: https://github.com/Ryguy-9999/ArchipelagoATS/releases/download/v1.1.0/against_the_storm.apworld

## Test Results

### Initial Test Report
- **Total runs**: 10
- **Success**: 0 (0.0%)
- **Failures**: 9
- **Timeouts**: 1

### Confirmed Test Results (Reproduced)
- **Total runs**: 10
- **Success**: 0 (0.0%)
- **Failures**: 2 (FillError)
- **Timeouts**: 8

## Root Cause Analysis

### Primary Issue: Seed Generation Fails Before UT Testing

The fuzz tests fail during seed generation itself, before any UT comparison can occur. Two error types are observed:

1. **FillError: "Game appears as unbeatable"**
   - The Archipelago fill algorithm cannot place items in a way that guarantees the game is beatable
   - The world's `can_goal()` completion condition is too restrictive for certain option combinations

2. **TimeoutError**
   - Seed generation takes too long and is killed by the fuzzer timeout
   - Likely caused by the recursive `satisfies_recipe()` function in `Recipes.py`

### Technical Details

#### Completion Logic (`can_goal`)
The world's `can_goal()` method requires `satisfies_recipe()` to return True for a complex set of production chains:

```python
def can_goal(self, state: CollectionState) -> bool:
    if self.options.seal_items and not state.has_all(["Sealed Forest",
            "Guardian Heart", "Guardian Blood", "Guardian Feathers", "Guardian Essence"], self.player):
        return False

    if self.options.required_seal_tasks.value > 1:
        return satisfies_recipe(state, self.player,
                                self.production_recipes if self.options.blueprint_items.value else None,
            ["Jerky,Porridge,Skewers,Biscuits,Pie,Pickled Goods,Paste", "Coal,Oil,Sea Marrow", "Amber",
             "Ale,Training Gear,Incense,Scrolls,Wine,Tea", "Tools", "Purging Fire", "Planks", "Bricks", "Fabric",
             "Pack of Crops", "Pack of Provisions", "Pack of Building Materials", "Stone,Sea Marrow,Training Gear",
             "Pipes", "Parts", "Ancient Tablet"])
```

#### Recipe Checking Logic (`satisfies_recipe`)
The `satisfies_recipe()` function is recursive and checks complex production chains:

```python
def satisfies_recipe(state: CollectionState, player: int,
                     blueprint_map: dict[str, list[Recipe]] | None, recipe: list[str], debug: bool = False) -> bool:
    for item_set in recipe:
        for item in item_set.split(","):
            if state.has(item, player) and has_blueprint_for(state, player, blueprint_map, item) and \
               (item not in game_recipes or satisfies_recipe(state, player, blueprint_map, game_recipes[item], debug)):
                break
        else:
            return False
    return True
```

This recursive logic:
1. Evaluates complex AND/OR rules for production chains
2. May have circular dependencies in some configurations
3. Is computationally expensive for the fill algorithm to evaluate

### Option Combinations That Cause Failures

Failures are more likely with these option settings:
- `blueprint_items: true` - Makes production buildings into items
- `seal_items: true` - Requires Guardian items
- `required_seal_tasks > 1` - Requires more complex production chains
- `enable_keepers_dlc: true` or `enable_nightwatchers_dlc: true` - Adds more complexity

The default template (which works) uses simpler settings:
- `blueprint_items: false`
- `seal_items: true`
- `required_seal_tasks: 1`

### Missing Exporter

Additionally, there is **no exporter** for Against the Storm in the codebase:
- No file exists at `exporter/games/unofficial/against_the_storm.py`
- Even if seeds generated successfully, UT testing would require an exporter to export the rules

## Recommendations

### For This Repository (Not Fixable Here)

1. **Add to known-incompatible list**: The apworld has fundamental logic issues that prevent consistent seed generation
2. **Skip in UT fuzz testing**: Until the apworld maintainer fixes the issues
3. **Create exporter (optional)**: Only useful after apworld fixes are made

### For APWorld Maintainer (Ryguy-9999)

The issues should be reported to the apworld maintainer with these suggestions:

1. **Fix `satisfies_recipe()` complexity**:
   - The recursive rule checking is too slow/complex
   - Consider caching or simplifying the production chain validation

2. **Review completion logic**:
   - The `can_goal()` requirements may be too strict for some option combinations
   - The fill algorithm may not be able to satisfy all constraints

3. **Test more option combinations**:
   - The default template works, but randomized options frequently fail
   - Need to ensure all valid option combinations can generate beatable seeds

4. **Optimize for fill algorithm**:
   - The recursive `satisfies_recipe()` may need to be simplified for better performance
   - Consider pre-computing which items unlock which production capabilities

## Test Commands

```bash
source .venv/bin/activate

# Single fuzzer run
python fuzz.py -r 1 -j 1 -g against_the_storm -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed 0

# Multiple runs to check success rate
python fuzz.py -r 10 -j 4 -g against_the_storm -n 1 --hook worlds.tracker.fuzzer_hook:Hook

# Test with default template (works)
python Generate.py --weights_file_path "Templates/Against the Storm.yaml" --multi 1 --seed 1
```

## Files Examined

- `custom_worlds/against_the_storm.apworld` (v1.1.0)
  - `against_the_storm/__init__.py` - Main world class with `can_goal()` and `set_rules()`
  - `against_the_storm/Recipes.py` - Production chain logic with `satisfies_recipe()`
  - `against_the_storm/Items.py` - Item definitions
  - `against_the_storm/Locations.py` - Location definitions
  - `against_the_storm/Options.py` - Game options

## Conclusion

This is a **fundamental apworld compatibility issue**, not a UT/exporter infrastructure issue. The apworld's logic makes certain option combinations unbeatable, and the recursive production chain checking causes performance issues.

**Recommendation**: Add Against the Storm to a known-incompatible list and report the issues to the apworld maintainer.
