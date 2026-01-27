# Plan: Remove AST Storage from Generated Helper Functions

**Status: COMPLETED** (January 2025)

> Implementation verified: `world_generator/templates.py` no longer generates `_HELPER_DEFINITIONS` or `get_helper_definitions()`. Newly generated worldgen worlds have clean `Rules.py` files with only Python helper functions. Older worldgen worlds (generated before this change) may still have the legacy format until regenerated.

## Overview

Currently, the world generator stores helper functions in two formats within the generated `Rules.py`:
1. **Python functions** - Executable code for Archipelago runtime
2. **`_HELPER_DEFINITIONS` dictionary** - AST format for frontend evaluation

This plan removes the redundant AST storage. When the exporter runs on a worldgen world, it will parse the Python helper functions and regenerate the AST format, producing equivalent output.

## Goal

Simplify generated `Rules.py` files by storing only readable Python helper functions, eliminating the verbose AST dictionary that duplicates the same logic in a less readable format.

## Current State

### Generated Rules.py Structure (shapez_worldgen example)

```python
# Lines 19-86: Python helper functions (readable)
def _shapezworldgen_can_cut_half(state: "CollectionState", player: int) -> bool:
    return state.has('Cutter', player)

def _shapezworldgen_can_build_mam(state: "CollectionState", player: int, floating = None) -> bool:
    return (_shapezworldgen_can_make_stitched_shape(state, player, floating)) and ...

# Lines 89-409: AST dictionary (verbose, hard to read)
_HELPER_DEFINITIONS = {   'can_build_mam': {   'body': {   'conditions': [   {   'conditions': [   {'name': 'can_stack', 'type': 'helper'},
                                                                           ...

def get_helper_definitions() -> dict:
    """Return helper definitions for frontend evaluation."""
    return _HELPER_DEFINITIONS
```

The `_HELPER_DEFINITIONS` dictionary is ~320 lines for shapez_worldgen, containing the same logic as the ~70 lines of Python functions above it.

### Why AST Storage Exists

The frontend JavaScript (`frontend/modules/shared/ruleEngine.js`) evaluates rules using AST format. It looks up helper definitions from `staticData.helpers` and recursively evaluates the AST structure. The `_HELPER_DEFINITIONS` provides this data when a worldgen world is loaded.

## Desired State

### Generated Rules.py Structure (after change)

```python
# Only Python helper functions - no AST dictionary
def _shapezworldgen_can_cut_half(state: "CollectionState", player: int) -> bool:
    return state.has('Cutter', player)

def _shapezworldgen_can_build_mam(state: "CollectionState", player: int, floating = None) -> bool:
    return (_shapezworldgen_can_make_stitched_shape(state, player, floating)) and ...

# No _HELPER_DEFINITIONS
# No get_helper_definitions()
```

### How Frontend Gets Helper AST

When the exporter runs on a worldgen world:
1. It parses the Python helper functions in `Rules.py`
2. Converts them to AST format using `exporter/analyzer/`
3. Stores in the `helpers` section of the exported `rules.json`

The frontend loads helpers from `rules.json` as usual - no change needed.

## Feasibility Validation

Round-trip testing confirmed the exporter can parse generated Python back to equivalent AST:

| Test Case | Result |
|-----------|--------|
| Simple helper (`state.has()`) | ✅ Exact match |
| State methods (`state.has_any()`, `state.count()`) | ✅ Exact match |
| Complex blocks (loops, assignments) | ✅ Exact match |
| NOT/AND/OR logic | ✅ Exact match |
| Helper-calling-helper | ✅ Semantic match (references vs inlined) |

See investigation in conversation for detailed test output.

## Files Modified

### Primary Changes

| File | Change |
|------|--------|
| `world_generator/templates.py` | Removed `_HELPER_DEFINITIONS` generation |
| `world_generator/templates.py` | Removed `get_helper_definitions()` function generation |

### Files Verified (no changes needed)

| File | Verification |
|------|--------------|
| `exporter/analyzer/` | Handles worldgen helper functions correctly |
| `exporter/games/base/helper_discovery.py` | Provides `get_helper_definitions()` via Python parsing |
| `frontend/modules/shared/ruleEngine.js` | Uses `staticData.helpers` from rules.json (not Python) |

## Success Criteria

1. ✅ Generated `Rules.py` contains only Python helper functions
2. ✅ No `_HELPER_DEFINITIONS` or `get_helper_definitions()` in generated code
3. ✅ Exporter produces `rules.json` with populated `helpers` section
4. ✅ Spoiler tests pass for worldgen worlds
5. ✅ Frontend can evaluate rules correctly

## Related Documentation

- `CC/docs/plans/completed/helper-generation-plan.md` - Original plan for generating Python helpers
- `docs/json/developer/guides/world-generator.md` - World generator documentation
- `exporter/analyzer/ast_visitors.py` - Python-to-AST conversion logic
