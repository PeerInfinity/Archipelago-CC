# Remaining Exporter Issues for Landstalker

## Status: No Issues

As of 2025-12-09, all spoiler tests pass for Landstalker - The Treasures of King Nole.

The exporter correctly handles:
- Complex nested `has_all(set(...))` patterns from path requirements
- Shop item rules with duplicate checking
- Region visit tracking via `_landstalker_has_visited_regions` helper
- Conversion of Region objects to region codes for `event_visited_` events

## Test Results

- **Total spheres tested**: 53
- **Passed**: 53
- **Failed**: 0
- **Error count**: 0

## Exporter Implementation

The custom exporter at `exporter/games/landstalker.py` provides:

1. **`prepare_closure_vars`**: Converts Region objects in `required_regions` to their codes for serialization
2. **`expand_rule`**: Handles complex rule patterns including:
   - `state.has_all(set([items]))` simplification
   - `all_of` iterator resolution for region events
   - Binary operation simplification for `event_visited_` + region code patterns
3. **`_simplify_has_all`**: Converts has_all patterns to simple item checks or AND conditions
4. **`_resolve_all_of_iterator`**: Resolves unresolved iterator variables in `all_of` rules
5. **`_build_event_visited_conditions`**: Builds AND conditions for event_visited_ checks
