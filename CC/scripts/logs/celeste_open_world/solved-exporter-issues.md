# Celeste (Open World) - Solved Exporter Issues

*Last updated: 2025-11-30*

## Issue 1: Dynamic rule lambdas not analyzed correctly

### Problem
The generic rule analyzer was failing to analyze the dynamically-created lambda functions used in Celeste (Open World). The game uses a data-driven approach where rules are created from `possible_access` lists stored in `RegionConnection` and `LevelLocation` objects.

The lambda patterns include:
- Single item requirement: `lambda state, only_item=...: state.has(only_item, world.player)`
- Multiple items AND: `lambda state, only_access=...: state.has_all(only_access, world.player)`
- Multiple options OR: `lambda state, connection=...: for sublist in connection.possible_access: if state.has_all(sublist, world.player): return True`

The analyzer was returning `None` for these patterns, resulting in `access_rule: null` in the rules.json file.

### Symptoms
- Console warnings: `Failed to analyze or expand rule for Exit '...' using runtime analysis.`
- Console warnings: `Analysis finished without errors but produced no result (None) for Entrance '...'.`
- Test failures at Sphere 0.1 with region mismatches

### Root Cause
The standard AST analyzer could not understand the for loop pattern iterating over `connection.possible_access` because:
1. The `possible_access` data is stored in the captured closure variable
2. The for loop with `has_all` checks was not a recognized pattern

### Solution
Created a custom game export handler at `exporter/games/celeste_open_world.py` that implements `override_rule_analysis()` to:

1. Extract default parameters from the lambda function (e.g., `connection=connection`, `only_item=only_item`)
2. Check for recognized patterns:
   - `connection` with `possible_access` attribute
   - `level_location` with `possible_access` attribute
   - `only_access` list (for AND requirements)
   - `only_item` string (for single item requirements)
3. Convert the `possible_access` list directly to proper rule structures:
   - `[[A, B]]` → AND(A, B)
   - `[[A], [B]]` → OR(A, B)
   - `[[A, B], [C]]` → OR(AND(A, B), C)

### Files Changed
- Created: `exporter/games/celeste_open_world.py`

### Verification
All 111 spheres now pass the spoiler test:
```
npm test --mode=test-spoilers --game=celeste_open_world --seed=1
```
