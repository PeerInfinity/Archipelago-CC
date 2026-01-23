# Pokemon FireRed and LeafGreen UT Fuzzer Failure Investigation

**Date**: 2026-01-23
**APWorld Version**: 1.0.2
**Source**: https://github.com/vyneras/Archipelago/releases/download/1.0.2/pokemon_frlg.apworld

## Summary

The Pokemon FireRed and LeafGreen community apworld fails the Universal Tracker (UT) fuzz test with 100% failure rate. The root cause is that the exporter doesn't capture helper function definitions, leading to undefined function references in the generated worldgen Rules.py.

## Error Details

**Error Type**: `NameError: name 'can_fly' is not defined`

**Location**: `worlds/pokemon_firered_and_leafgreen_worldgen_*/Rules.py:1105`

```python
# Generated code references undefined helper functions:
multiworld.get_entrance("Flying", player).access_rule = \
    lambda state: can_fly(state, player)  # can_fly is not defined!
```

## Root Cause Analysis

### 1. Original World Uses Complex Helper Methods

The Pokemon FRLG apworld defines 19 helper methods in its rules.py:

```python
# From pokemon_frlg/rules.py (apworld)
def can_fly(self, state: CollectionState) -> bool:
    return (state.has_all(("HM02 Fly", "TM Case", "Teach Fly"), self.player) and
            self.has_badge_requirement(state, "Fly"))

def can_surf(self, state: CollectionState) -> bool:
    return (state.has_all(("HM03 Surf", "TM Case", "Teach Surf"), self.player) and
            self.has_badge_requirement(state, "Surf"))

# ... 17 more helpers (can_cut, can_strength, can_flash, etc.)
```

These helpers encapsulate complex logic: checking for HMs, TM Case, teach moves, AND badge requirements.

### 2. Exporter Creates AST_capability Markers

When the exporter encounters rules using these helpers, it creates `AST_capability` markers:

```json
{
  "name": "Pallet Town Surfing Spot",
  "connected_region": "Pallet Town (Water)",
  "access_rule": {
    "rule": "AST_capability",
    "args": {
      "capability": "surf",
      "inferred": true,
      "description": "Requires ability to surf",
      "_original_ast_type": "capability"
    },
    "_converted_from_ast": true
  }
}
```

### 3. Helpers Section is Empty

The `helpers` section in rules.json is empty:
```json
{
  "helpers": {}
}
```

No helper function definitions are exported because:
- No custom exporter exists for Pokemon FRLG
- The default exporter doesn't extract helper method bodies
- AST_capability markers reference functions that don't exist

### 4. World Generator Creates Undefined References

The world generator's rule codegen (rule_codegen.py:6536-6565) converts `AST_capability` markers to function calls:

```python
# From rule_codegen.py
if rule_type == 'AST_capability':
    capability = args.get('capability', '')
    helper_name = f'can_{capability}'  # "can_surf"
    return f'{func_name}(state, player)'  # can_surf(state, player)
```

The generated Rules.py contains 81+ calls to undefined helpers like `can_fly`, `can_surf`, `can_cut`.

## Comparison with Pokemon Emerald

Pokemon Emerald has a custom exporter (`exporter/games/official/pokemon_emerald.py`) that:

1. Maps HM names to helper functions
2. Exports `hm_requirements` which maps HMs to badge requirements
3. Expands rules from `hm_rules["HM_NAME"]()` pattern to capability checks

Pokemon FRLG lacks this custom handling.

## Potential Solutions

### Option 1: Create Custom Exporter for Pokemon FRLG

Create `exporter/games/unofficial/pokemon_frlg.py` similar to Pokemon Emerald:

```python
class PokemonFRLGGameExportHandler(GenericGameExportHandler):
    HM_TO_HELPER = {
        "HM01 Cut": "can_cut",
        "HM02 Fly": "can_fly",
        "HM03 Surf": "can_surf",
        # ... etc
    }

    def get_helpers(self, world) -> Dict[str, Any]:
        """Export helper function definitions."""
        # Extract and export the actual helper logic
        return {
            "can_fly": {
                "params": ["state", "player"],
                "body": {"And": [
                    {"HasAll": ["HM02 Fly", "TM Case", "Teach Fly"]},
                    # badge requirement logic
                ]}
            }
        }
```

**Effort**: Medium-High
**Maintainability**: Requires updates when apworld changes

### Option 2: Enhance Default Exporter

Enhance the default exporter to:
1. Detect helper methods (methods matching `can_*` pattern)
2. Parse their AST to extract logic
3. Export to `helpers` section

**Effort**: High
**Maintainability**: Would work for similar apworlds automatically

### Option 3: Request APWorld Author Changes

Ask the apworld maintainer to:
1. Use Rule Builder compatible patterns
2. Or provide helper definitions in a format the exporter understands

**Effort**: Low (for us)
**Maintainability**: Depends on upstream cooperation

### Option 4: Add to Known-Incompatible List

Document that Pokemon FRLG is incompatible with worldgen-based UT tracking:
- Add to a skip list in the fuzzer
- Note in documentation

**Effort**: Low
**Maintainability**: Simple but doesn't fix the issue

## Additional Notes

### Timeout Issue

Initial fuzzer runs timed out because:
- Default timeout is 15 seconds
- TrackerCore initialization for Pokemon FRLG takes ~16 seconds (large game with 1715 locations)
- Use `-t 60` for longer timeout

### Native UT Support

The apworld includes `pokemon_frlg/universal_tracker.py` with native UT support functions (`ut_set_options`, `ut_set_maps`, `ut_set_locations`). This is independent of our worldgen-based tracking - the apworld was designed for PopTracker-style tracking, not our rules.json approach.

## Recommendation

**Short-term**: Add Pokemon FRLG to a known-incompatible list for worldgen-based UT testing.

**Long-term**: Create a custom exporter (`exporter/games/unofficial/pokemon_frlg.py`) that properly exports the helper function definitions. This would follow the pattern established by Pokemon Emerald.

## Files Referenced

- `custom_worlds/pokemon_frlg.apworld` - The apworld package
- `exporter/games/official/pokemon_emerald.py` - Example custom exporter
- `world_generator/rule_codegen.py:6536-6565` - AST_capability handling
- `worlds/tracker/fuzzer_hook.py` - UT fuzzer hook
