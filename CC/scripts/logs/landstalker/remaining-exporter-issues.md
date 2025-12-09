# Remaining Exporter Issues - Landstalker

Last updated: 2025-12-09

## Status: No remaining issues

All spoiler tests pass (53/53 spheres). The exporter correctly handles:

1. **Complex nested `has_all(set(...))` patterns** from path requirements
2. **`event_visited_` region tracking** - properly converted from Python's `_landstalker_has_visited_regions` function
3. **Region code extraction** from Region objects in closure variables
4. **All-of pattern resolution** with unresolved iterators

## Notes

The exporter (`exporter/games/landstalker.py`) includes custom handling for:
- `prepare_closure_vars()` - Converts Region objects to their codes for serialization
- `expand_rule()` - Handles `has_all`, `all_of`, and `item_check` with binary_op patterns
- `_resolve_all_of_iterator()` - Resolves unresolved region iterators
- `_simplify_has_all()` - Simplifies `state.has_all(set([items]), player)` patterns
- `_build_event_visited_conditions()` - Builds AND conditions for event_visited_ checks

## Generation Warnings (Informational)

During generation, some shop item rules fail to analyze:
- `Kazalt: Shop item #1-5 Item Rule` - These are shop placement rules that use complex list comprehensions
- These warnings do not affect gameplay logic since the access rules (not item rules) are what matter for progression
