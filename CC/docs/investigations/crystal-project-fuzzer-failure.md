# Crystal Project UT Fuzzer Failure Investigation

**Date**: 2026-01-23
**APWorld**: Crystal Project v0.14.0
**Source**: https://github.com/Emerassi/CrystalProjectAPWorld/releases/download/CrystalProject-v0.14.0/crystal_project.apworld

## Summary

The Crystal Project apworld fails the Universal Tracker (UT) fuzzer test with 100% failure rate due to undefined helper functions in the generated worldgen code. This is a fundamental incompatibility between the apworld's rule structure and the current exporter/world generator pipeline.

## Error Details

**Primary Error**: `NameError: name 'can_fight_gran' is not defined`

```
File "/home/user/Archipelago-CC/worlds/crystal_project_worldgen_.../Rules.py", line 465, in <lambda>
    lambda state: ((can_fight_gran(state, player)) and (True))
                    ^^^^^^^^^^^^^^
NameError: name 'can_fight_gran' is not defined
```

## Root Cause Analysis

### The Pipeline Issue

1. **Export Phase**: The exporter sees calls like `can_fight_gran(state)` in the original Crystal Project rules and converts them to abstract `AST_capability` rules:
   ```json
   {"rule": "AST_capability", "args": {"capability": "fight_gran"}}
   ```

2. **World Generation Phase**: The world generator handles `AST_capability` rules by generating lambda expressions:
   ```python
   lambda state: ((can_fight_gran(state, player)) and (True))
   ```

3. **Missing Function**: The function `can_fight_gran` is never defined because:
   - The helper function body isn't exported to the JSON
   - The world generator doesn't generate a stub or implementation

### Code Location

The bug is in `world_generator/rule_codegen.py:6536-6565`. The `_generate_expression` method generates function calls for `AST_capability` rules without verifying the function exists:

```python
if rule_type == 'AST_capability':
    args = expr.get('args', {})
    capability = args.get('capability', '')
    if capability:
        helper_name = f'can_{capability}'
        func_name = self.get_function_name(helper_name)
        # ... generates function call without validation
        return f'{func_name}(state, player)'
```

In contrast, the Rule Builder path at line 1172 correctly checks `if helper_name in self.known_helpers` before generating the call.

## Affected Helper Functions

Crystal Project uses these helper patterns that aren't supported:

### AST_capability (2 functions)
- `can_fight_gran` - Requires (Scholar job + Reverse Polarity) OR level range check
- `can_push_ice_block_and_goat` - Requires vertical movement + region pass OR regionsanity disabled

### AST_generic_helper (6 functions)
- `is_area_in_level_range` - Level range calculation based on player options
- `is_hop_to_it_at_least_fancy_footwork` - Hop-to-it progression check
- `is_hop_to_it_at_least_one_hop_beyond` - Hop-to-it progression check
- `is_hop_to_it_pray` - Hop-to-it mode check
- `is_regionsanity_disabled` - Option check
- `is_regionsanity_extreme` - Option check

## Original Helper Implementation

The `can_fight_gran` function in the original world:
```python
def can_fight_gran(self, state: CollectionState) -> bool:
    return (state.has(SCHOLAR_JOB, self.player) and
            state.has(REVERSE_POLARITY, self.player)) or \
           self.is_area_in_level_range(state, GRAN_FIGHT_LEVEL)
```

This logic involves:
- Item checks (Scholar job, Reverse Polarity)
- Game-specific level calculation (GRAN_FIGHT_LEVEL)
- Nested helper call (`is_area_in_level_range`)

This complexity cannot be captured in the current export format.

## Recommendations

### Short-term (Quick Fix)
Add validation in `_generate_expression` to check if helpers exist before generating calls. If not found, return `'True'` as a fallback (accepting logic overapproximation):

```python
if rule_type == 'AST_capability':
    args = expr.get('args', {})
    capability = args.get('capability', '')
    if capability:
        helper_name = f'can_{capability}'
        if helper_name not in self.known_helpers:
            return 'True'  # Fallback for undefined helpers
        # ... continue with function call generation
```

### Medium-term
Create a Crystal Project-specific exporter in `exporter/games/unofficial/crystal_project.py` that:
1. Expands `can_fight_gran` to its actual item checks
2. Handles `is_area_in_level_range` by extracting level constants
3. Maps game-specific options to standard patterns

### Long-term
Implement helper function body extraction in the export pipeline:
1. Parse Python AST of helper functions
2. Extract and serialize the logic
3. Regenerate equivalent functions in worldgen

## Status

**Verdict**: Known incompatible - requires either exporter updates or apworld changes.

This apworld should be added to the known-incompatible list for UT fuzzer testing until either:
1. A game-specific exporter is implemented
2. The world generator is enhanced to handle undefined capabilities
3. The apworld maintainer refactors the rules to avoid complex helper functions

## Files Referenced

- `custom_worlds/crystal_project.apworld` - The apworld package
- `world_generator/rule_codegen.py` - Rule code generation (bug location)
- `exporter/games/base/generic.py` - Generic capability expansion
- `worlds/tracker/fuzzer_hook.py` - UT fuzzer hook
