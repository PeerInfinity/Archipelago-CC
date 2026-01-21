# World Generator: Helper Functions Implementation Plan

## Status: COMPLETE

This plan has been fully implemented. All phases are complete and helper functions are now generated correctly for all worldgen worlds.

## Overview

This document outlines the plan to update the world generator to read "helpers" data from rules.json files and convert them into working Python helper functions in the generated world files.

## Implementation Summary

### What Was Implemented

1. **Phase 1: Extract Helper Definitions** - `extractors.py`
   - `HelperData` dataclass with `name`, `params`, `body`, `defaults`, `param_mappings`
   - `extract_helpers()` function supporting both simple and parameterized helpers

2. **Phase 2: Generate Python Helper Functions** - `rule_codegen.py`
   - `HelperCodeGenerator` class with full code generation capabilities
   - `generate_helper_function()` for complete function definitions
   - `get_helper_call()` for generating calls to helpers

3. **Phase 3: Extend Rule Type Support** - `rule_codegen.py`
   - 30+ rule type handlers in `_generate_expression()`
   - Full statement support: `assign`, `aug_assign`, `tuple_assign`, `return`, `for_range`, `for_iter`, `if_statement`, `while_loop`, `break`, `continue`
   - Expression support: `conditional`, `binary_op`, `compare`, `not`, `subscript`, `attribute`, `function_call`, `method_call`, `helper`, `state_method`, `can_reach`, and many more

4. **Phase 4: Update Rules.py Generation** - `templates.py`
   - `generate_rules_py()` integrates helpers at module level
   - Hybrid approach: Rule Builder for simple rules, lambdas for complex rules
   - NamedTuple class generation for complex helper return types

5. **Phase 5: Update Helper Call Generation** - `rule_codegen.py` + `templates.py`
   - Helper calls use Rule Builder's `HelperCall` where appropriate
   - Direct function calls in lambda expressions

### Additional Features (Beyond Original Plan)

- **param_mappings**: Support for setting-dependent parameters that map helper params to world options/attributes
- **NamedTuple support**: Automatic generation of NamedTuple classes for complex helper data structures
- **Context tracking**: Location/entrance context for variable substitution in rules
- **Boss defeat rules**: Generation of defeat rule functions for dungeon bosses
- **Enhanced rule types**: `generator_expression`, `lambda`, `f_string`, `map`, and more

## Generated Output Examples

### shapez WorldGen (`worlds/shapez_worldgen/Rules.py`)

```python
# Helper functions
def can_stack(state: "CollectionState", player: int) -> bool:
    return state.has('Stacker', player)

def has_x_belt_multiplier(state: "CollectionState", player: int, needed = None) -> bool:
    multiplier = 1.0
    for _ in range(state.count('Rising Belt Upgrade', player)):
        multiplier *= 2
    multiplier += (state.count('Gigantic Belt Upgrade', player) * 10)
    multiplier += state.count('Big Belt Upgrade', player)
    multiplier += (state.count('Small Belt Upgrade', player) * 0.1)
    return (multiplier >= needed)
```

### Undertale WorldGen (`worlds/undertale_worldgen/Rules.py`)

```python
def _undertale_has_plot(state: "CollectionState", player: int, item = None) -> bool:
    return (state.has('Complete Skeleton', player) if (item == 'Complete Skeleton')
            else (state.has('Fish', player) if (item == 'Fish')
            else (state.has('Mettaton Plush', player) if (item == 'Mettaton Plush')
            else (state.has('DT Extractor', player) if (item == 'DT Extractor') else None))))
```

## Design Decisions (Final)

1. **Helper function naming**: Helper names are preserved from the original export. No automatic `_{game}_` prefix is added by default (the original world's naming convention is respected).

2. **Helper function location**: Generated helpers are placed in `Rules.py` at module level, like original worlds. This allows the exporter to detect and re-export them.

3. **Setting-dependent parameters**: Handled via `param_mappings` which maps parameter names to world options/attributes. Values are accessed at runtime via `state.multiworld.worlds[player].<name>`.

4. **Rule Builder compatibility**: Helpers are called via Rule Builder's `HelperCall` for simple cases, and via direct function calls in lambda expressions for complex cases.

5. **Hybrid generation approach**: Simple rules use Rule Builder (provides "explain" functionality), complex rules with blocks/loops use lambdas.

## Files Modified

| File | Changes |
|------|---------|
| `world_generator/extractors.py` | Added `HelperData` class and `extract_helpers()` |
| `world_generator/rule_codegen.py` | Added `HelperCodeGenerator` class with full code generation |
| `world_generator/templates.py` | Updated `generate_rules_py()` to include helpers |

## Completion Checklist

- [x] Review and approve this plan
- [x] Implement Phase 1 (extraction)
- [x] Implement Phase 2 (code generation for simple helpers)
- [x] Test with Undertale
- [x] Implement Phase 3 (complex rule types)
- [x] Test with shapez
- [x] Run spoiler tests on worldgen worlds

## Verification

All worldgen worlds now have working helper functions. Example worlds with helpers:
- `worlds/shapez_worldgen/` - Complex helpers with loops and arithmetic
- `worlds/undertale_worldgen/` - Parameterized conditional helpers
- `worlds/alttp_worldgen/` - Boss defeat rules and dungeon helpers
- 70+ other worldgen worlds

---

*Plan completed. This document preserved for historical reference.*
