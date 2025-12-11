# Solved Exporter Issues - Civilization VI

*Last updated: 2025-12-11*

## Issue 1: Era Region Subscript Resolution

**Problem**: The analyzer incorrectly exported `world.era_required_non_progressive_items[era]` and `world.era_required_progressive_items_counts[era]` subscripts. When the analyzer encountered these dictionary lookups:

1. It converted the dict to a list of its keys (era names like `["ERA_ANCIENT", "ERA_CLASSICAL", ...]`)
2. It converted the era index to its string value (e.g., `"ERA_ANCIENT"`)
3. The resulting subscript `["ERA_ANCIENT", ...]["ERA_ANCIENT"]` didn't work because you can't subscript a list with a string

This caused all era region transitions (ERA_ANCIENT -> ERA_CLASSICAL, etc.) to be inaccessible because the `has_all` and `has_all_counts` rules couldn't resolve their arguments.

**Root Cause**: The analyzer in `visit_Attribute` (ast_visitors.py) converts dict attributes to their keys list when they're closure variables. This is correct for iteration but breaks subscript operations.

**Solution**: Added post-processing in `exporter/games/civ_6.py`:

1. `preprocess_world_data()`: Captures the era requirements data from the world object BEFORE regions are processed, storing it in `_era_requirements`
2. `post_process_data()`: Recursively walks through all exit and location access rules, finding broken subscript patterns
3. `_fix_era_subscripts()`: Detects the pattern where a subscript has:
   - `value`: constant list of era names
   - `index`: constant era name string
4. `_resolve_era_subscript()`: Replaces the broken subscript with the actual resolved value:
   - For `has_all`: Returns the list of non-progressive items for that era
   - For `has_all_counts`: Returns the dict of progressive item counts for that era

**Additional handling**: EraType enum objects in the data structure needed to be converted to strings using a helper function since post_process_data runs before JSON serialization.

**Files Modified**:
- `exporter/games/civ_6.py` - Extended from minimal handler to full handler with era subscript resolution

**Testing**: Spoiler test passes with all 56 sphere events processed successfully.
