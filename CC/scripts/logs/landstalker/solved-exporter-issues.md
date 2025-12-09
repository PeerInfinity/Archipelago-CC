# Solved Exporter Issues - Landstalker

Last updated: 2025-12-09

## Previously Solved Issues

### 1. Region Object Serialization
**Problem:** Region objects in `required_regions` closure variables couldn't be serialized to JSON.
**Solution:** Added `prepare_closure_vars()` to convert Region objects to their `.code` string representation.

### 2. `has_all(set(...))` Pattern
**Problem:** The pattern `state.has_all(set(required_items), player)` was not being simplified.
**Solution:** Added `_simplify_has_all()` to convert these to simple `item_check` rules or `and` conditions.

### 3. Unresolved Iterator in `all_of`
**Problem:** The `all(state.has("event_visited_" + region.code, player) for region in regions)` pattern had an unresolved `regions` iterator.
**Solution:** Added `_resolve_all_of_iterator()` with a region stack to track and resolve the `required_regions` variable.

### 4. Binary Op String Concatenation
**Problem:** `"event_visited_" + region.code` was exported as a binary_op instead of a resolved string.
**Solution:** Added `_simplify_region_event_binary_op()` to resolve Region.code attribute access and build the final event name.

## Current Test Status

- All 53 spheres pass
- 0 errors
- Test result: PASSED
