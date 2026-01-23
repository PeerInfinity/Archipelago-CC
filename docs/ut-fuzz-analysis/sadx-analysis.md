# Sonic Adventure DX (SADX) APWorld - UT Fuzzer Analysis

## Summary

**APWorld**: Sonic Adventure DX
**Version**: v1.2.0-pre-release-2
**Source**: https://github.com/ClassicSpeed/sadx-classic-randomizer
**UT Fuzzer Pass Rate**: ~60% (6 out of 10 runs pass with exporter fixes)

## Root Cause

The SADX apworld uses **dynamic rule patterns** that cannot be converted to static Rule Builder expressions. The exporter captures the AST structure but cannot evaluate method calls on location-specific objects.

### Failing Rule Patterns

#### 1. Field Emblem Rules (Primary Cause)

```python
def add_field_emblem_rules(self, location_name: str, field_emblem: EmblemLocation):
    location = self.multiworld.get_location(location_name, self.player)
    add_rule(location, lambda state: any(
        (state.can_reach_region(
            get_region_name(character.character if isinstance(character, CharacterUpgrade) else character,
                            field_emblem.area), self.player) and
         (state.has(character.upgrade, self.player) if isinstance(character, CharacterUpgrade) else True))
        for character in field_emblem.get_logic_characters_upgrades(self.options) if
        character in get_playable_characters(self.options) or
        (isinstance(character, CharacterUpgrade) and character.character in get_playable_characters(self.options))))
```

**Issues**:
- `field_emblem.get_logic_characters_upgrades(self.options)` - method call on location object
- `isinstance(character, CharacterUpgrade)` - runtime type checking
- `CharacterUpgrade` class with `.character` and `.upgrade` attributes
- `get_playable_characters(self.options)` - option-dependent filtering

#### 2. Sub-Level Rules

```python
def add_sub_level_rules(self, location_name: str, sub_level: SubLevelLocation):
    location = self.multiworld.get_location(location_name, self.player)
    add_rule(location, lambda state: any(
        state.can_reach_region(get_region_name(character, sub_level.area), self.player) for character in
        sub_level.get_logic_characters(self.options) if character in get_playable_characters(self.options)))
```

**Issues**:
- `sub_level.get_logic_characters(self.options)` - method call on location object
- Dynamic filtering by playable characters

#### 3. Chao Egg Rules

```python
def add_egg_rules(self, location_name: str, egg: ChaoEggLocation):
    location = self.multiworld.get_location(location_name, self.player)
    add_rule(location, lambda state: any(
        state.can_reach_region(get_region_name(character, egg.area), self.player) for character in
        egg.characters if character in get_playable_characters(self.options)))
```

**Issues**:
- Same pattern as sub-level rules with option-dependent character filtering

### Why This Fails

The Rule Builder can only handle:
- Static item checks (`Has`, `HasAll`, `HasAny`)
- Static region access checks (`CanReach`)
- Boolean combinations (`And`, `Or`)
- Constant-based comprehensions over known lists

The Rule Builder **cannot** handle:
- Method calls on runtime objects (`location.get_logic_characters(options)`)
- Runtime type checking (`isinstance()`)
- Custom class attribute access (`character.upgrade`)
- Option-dependent iterators

### Exported Rules

When the exporter encounters these unsupported patterns, it falls back to `False_()` in `world_generator/rule_codegen.py:4728-4730`:

```python
# Couldn't resolve statically - fall back to False_()
self.required_imports.add('False_')
return 'False_()'
```

This makes locations like "Station Emblem" permanently inaccessible in the UT tracker, but the original server logic correctly evaluates them as accessible.

## Example Failure

```
Locations `Station Emblem` were in server logic but not expected in UT
```

- **Server logic**: Evaluates `lambda state: any(...)` at runtime with actual character/option values
- **UT (worldgen)**: Rule converted to `False_()` because iterator is a method call

## Locations Affected

Based on test failures:
- Field Emblems: Station, Burger Shop, City Hall, Casino, Tails' Workshop, Shrine, Pool, Spinning Platform, Main Platform
- Sub-Levels: Twinkle Circuit (Sonic), and likely others
- Chao: Silver Chao Egg, and likely others

## Implementation Status

### Custom SADX Exporter (Implemented)

Created `exporter/games/unofficial/sadx.py` that:
1. Pre-computes character/upgrade combinations for each location type
2. Generates static rules based on known emblem/sub-level data
3. Resolves option-dependent logic at export time
4. Expands nested AST patterns in entrance/exit rules

**What was implemented:**
- Field emblem location rules (12 locations)
- Sub-level location rules (Twinkle Circuit, Sand Hill, Sky Chase - all variants)
- Chao egg location rules (Gold, Silver, Black eggs)
- Unified boss fight rules (Chaos 4, Chaos 6, Egg Hornet)
- Logic level support (0-4) for different character requirements
- Playable character filtering based on options
- Nested AST_any_of/all_of exit rule expansion (e.g., Hotel Key | Life Belt)
- Empty AST_all_of rule conversion to True_()

**Current status: ~60% pass rate**

The exporter significantly improves the pass rate from 0% to approximately 60%. The remaining failures are due to:

1. **Perfect Chaos Fight** (~30% of failures): This location has complex goal-based rules that check `can_reach` on dynamically selected other locations based on options like `goal_requires_levels`, `goal_requires_missions`, etc. These rules cannot be statically exported.

2. **Chao Race Locations** (~10% of failures): Chao races require reaching chao garden regions which may have character-specific access rules that aren't fully expanded.

**Known limitations:**
- Perfect Chaos Fight is intentionally excluded as its rules depend on dynamic goal requirements
- Some edge cases with option-dependent location creation still fail
- The post_process_data method needs to be properly integrated into the generation pipeline

### Recommended Next Steps

1. **For immediate use**: The exporter provides significant improvement for most game configurations
2. **For full compatibility**: Request the SADX apworld maintainer to refactor rules to use simpler patterns
3. **Long-term**: Consider adding Perfect Chaos Fight handling when goal options can be resolved at export time

## Technical Details

### Exporter AST Capture

The exporter correctly captures the AST structure:
```json
{
  "rule": "AST_any_of",
  "args": {
    "iterator_info": {
      "type": "comprehension_details",
      "iterator": {
        "type": "function_call",
        "function": {
          "type": "attribute",
          "object": {"type": "name", "name": "field_emblem"},
          "attr": "get_logic_characters_upgrades"
        }
      }
    }
  }
}
```

But `_convert_ast_any_of` in `rule_codegen.py` only handles:
- `subscript` iterators into constant dicts
- `constant` list iterators

Function call iterators are unsupported and fall back to `False_()`.

## Files Referenced

- `custom_worlds/sadx.apworld` - The APWorld package
- `sadx/Rules.py` - Original rule definitions
- `world_generator/rule_codegen.py` - Rule conversion logic (lines 4585-4730)
- `frontend/presets/sonic_adventure_dx/` - Exported rules

## Date

Analysis performed: 2026-01-22
