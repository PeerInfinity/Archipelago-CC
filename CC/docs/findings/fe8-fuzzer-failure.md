# Fire Emblem Sacred Stones (FE8) UT Fuzzer Failure Analysis

## Summary

**APWorld**: Fire Emblem Sacred Stones (fe8.apworld v0.4.2)
**Source**: https://github.com/CT075/Archipelago/releases/download/fe8-0.4.2/fe8.apworld
**Failure Rate**: ~80% (8/10 in testing)
**Error Type**: Logic mismatch (None)

## Root Cause

The FE8 world uses **complex lambda functions** for access rules that the world generator cannot properly convert to Rule Builder expressions. When conversion fails, the generator defaults to `True_()`, making locations always accessible in the UT, while the server correctly evaluates the original complex rules.

### The Problem Rule: `finalboss_rule`

The FE8 world defines a `finalboss_rule` function (in `__init__.py` lines 256-275) that controls access to:
- FinalBoss region entrance ("Clear chapter 20")
- Lagdou Ruins region entrance ("Complete Chapter 19")

```python
def finalboss_rule(state: CollectionState) -> bool:
    if not level_cap_at_least(min_endgame_level_cap)(state):
        return False
    weapons_needed = self.progression_holy_weapons
    weapon_types_needed = {HOLY_WEAPONS[weapon] for weapon in weapons_needed}

    for weapon in weapons_needed:
        if not state.has(weapon, self.player):
            return False

    for weapon_type in weapon_types_needed:
        if state.count(f"Progressive Weapon Level ({weapon_type})", self.player) < NUM_WEAPON_LEVELS:
            return False

    return True
```

### Unsupported Patterns

The exporter converts this to an `AST_block` JSON rule with several patterns the world generator cannot handle:

1. **`for_iter` (iteration over arbitrary collections)**
   - The generator handles `for_range` (numeric loops) but not `for_iter`
   - FE8 uses `for weapon in weapons_needed` and `for weapon_type in weapon_types_needed`

2. **Set comprehensions**
   - `{HOLY_WEAPONS[weapon] for weapon in weapons_needed}`
   - Creates dynamic sets based on option-dependent data

3. **Helper function calls with closures**
   - `level_cap_at_least(min_endgame_level_cap)` returns a closure
   - The nested function captures `self.player` from the outer scope

4. **Instance variable access**
   - `self.progression_holy_weapons` - a property that varies based on options

### Code Path

When processing the `AST_block` rule in `world_generator/rule_codegen.py`:

1. `_convert_ast_block()` (line 3186) is called
2. `_contains_state_method()` returns True (rule has `state.count()` calls)
3. `_generate_runtime_ast_block()` (line 3588) attempts conversion
4. At line 3670, it encounters `for_iter` statements
5. The handler only supports `for_range`, so it returns `None`
6. The caller falls back to `True_()` (line 3348)

### Generated Code (Incorrect)

```python
# In worlds/fire_emblem_sacred_stones_worldgen_*/Rules.py
world.set_rule(
    multiworld.get_entrance("Clear chapter 20", player),
    True_()  # Should have complex rule!
)
world.set_rule(
    multiworld.get_entrance("Complete Chapter 19", player),
    True_()  # Should have complex rule!
)
```

## Impact

When `required_holy_weapons > 0` (set randomly by fuzzer):
- **Server**: Requires specific weapons AND weapon levels >= 3 to access FinalBoss/Lagdou Ruins
- **UT (worldgen)**: Makes these entrances always accessible (`True_()`)

This causes logic mismatches where the server thinks locations are inaccessible, but the UT thinks they are always accessible.

## Potential Fixes

### Option 1: FE8-Specific Exporter Handler

Create `exporter/games/unofficial/fe8.py` that:
- Detects the `finalboss_rule` pattern
- Exports it as a simpler equivalent using explicit item/count checks
- Handles the `level_cap_at_least` helper explicitly

**Pros**: Clean solution, preserves original logic
**Cons**: Requires understanding FE8 world internals

### Option 2: Extend World Generator AST Support

Enhance `_generate_runtime_ast_block()` to handle:
- `for_iter` loops over known collections
- Set comprehensions with static dictionaries
- Helper function calls (at least common patterns)

**Pros**: Benefits all games with similar patterns
**Cons**: Complex implementation, may not handle all edge cases

### Option 3: Add FE8 to Known-Incompatible List

Document that FE8 is not compatible with UT tracking due to rule complexity.

**Pros**: Immediate resolution
**Cons**: Doesn't fix the underlying issue

### Option 4: Report to APWorld Maintainer

Suggest the maintainer simplify the rules to avoid:
- Set comprehensions
- Nested helper functions
- `for` loops over collections

**Pros**: Fixes at the source
**Cons**: Requires upstream changes, may take time

## Recommendation

**Short-term**: Add FE8 to a known-incompatible list with documentation of the issue.

**Long-term**: Create an FE8-specific exporter handler that:
1. Detects the `finalboss_rule` function
2. Expands it based on the `required_holy_weapons` and `min_endgame_level_cap` options
3. Generates an equivalent rule using supported patterns (CountItem, HasItem, Compare, And, Or)

## Test Commands

```bash
# Reproduce failure
source .venv/bin/activate
python fuzz.py -r 10 -j 4 -g fe8 -n 1 --hook worlds.tracker.fuzzer_hook:Hook

# Check specific failure log
cat fuzz_output/error/fe8/0/0.log
cat fuzz_output/error/fe8/0/0.yaml
```

## Files Involved

- `custom_worlds/fe8.apworld` - The APWorld package
- `world_generator/rule_codegen.py` - Rule code generation (lines 3186-3790)
- `exporter/games/unofficial/` - Location for potential FE8 handler
- `worlds/fire_emblem_sacred_stones_worldgen_*/Rules.py` - Generated rules (incorrect)
