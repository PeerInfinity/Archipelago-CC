# Solved Exporter Issues

## 1. Unresolved Variable in all_of Iterator (FIXED)

**Status**: ✅ SOLVED

**Issue**: The `all_of` rules had an unresolved variable reference in the iterator field, and binary_op patterns for region event names weren't being simplified.

**Solution**: Implemented a comprehensive fix in the Landstalker exporter:

1. **Added `prepare_closure_vars` hook**: Extracts `required_regions` from lambda closures and adds region codes to a stack for later expansion
2. **Added `_resolve_all_of_iterator` method**: Resolves unresolved `regions` iterators in `all_of` rules by popping from the regions stack and building concrete item checks
3. **Added `_simplify_region_event_binary_op` method**: Simplifies binary_op patterns like `"event_visited_" + region.code` to concrete event names by extracting the region code from Region objects

**Files Modified**:
- `exporter/exporter.py`: Added hook to call `game_handler.prepare_closure_vars()` before rule analysis
- `exporter/games/landstalker.py`: Implemented custom preprocessing and expansion logic

**Test Results**: All spoiler tests now pass (53 steps verified with 0 mismatches)

