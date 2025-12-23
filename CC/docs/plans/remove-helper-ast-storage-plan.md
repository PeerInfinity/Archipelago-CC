# Plan: Remove AST Storage from Generated Helper Functions

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

## Files to Modify

### Primary Changes

| File | Change |
|------|--------|
| `world_generator/templates.py` | Remove `_HELPER_DEFINITIONS` generation (~lines 624-658) |
| `world_generator/templates.py` | Remove `get_helper_definitions()` function generation |

### Files to Verify (no changes expected)

| File | Verification |
|------|--------------|
| `exporter/analyzer/` | Confirm it handles worldgen helper functions correctly |
| `exporter/games/base.py` | Check if it calls `get_helper_definitions()` |
| `frontend/modules/shared/ruleEngine.js` | Confirm it uses `staticData.helpers` from rules.json (not Python) |

## Dependency Check

Before implementing, verify no code depends on `get_helper_definitions()`:

```bash
# Search for references to get_helper_definitions
grep -r "get_helper_definitions" --include="*.py" --include="*.js"

# Search for references to _HELPER_DEFINITIONS
grep -r "_HELPER_DEFINITIONS" --include="*.py" --include="*.js"
```

Expected: Only references should be in `world_generator/templates.py` and the generated `Rules.py` files.

## Implementation Steps

### Step 1: Dependency Check
Run the grep commands above to confirm no external dependencies.

### Step 2: Modify world_generator/templates.py

Remove the helper definitions section generation:

```python
# REMOVE this entire block (approximately lines 624-658):
# Build helper definitions dict for exporter
# ...
helper_definitions_section = ''
if helper_bodies:
    # ... all this code ...
    helper_definitions_section = f'''
# Helper definitions for frontend evaluation
_HELPER_DEFINITIONS = {helper_defs_str}

def get_helper_definitions() -> dict:
    ...
'''
```

Also remove `{helper_definitions_section}` from the return template string.

### Step 3: Regenerate a Worldgen World

```bash
# Generate shapez_worldgen (this runs world generator AND exports rules)
python scripts/test/test-world-generator.py --include-list "shapez.yaml" --phase generate-test-worlds --seed 1

# Verify Rules.py no longer has _HELPER_DEFINITIONS
grep "_HELPER_DEFINITIONS" worlds/shapez_worldgen/Rules.py
# Should return nothing

# Verify helpers section is populated in exported rules.json
python -c "import json; d=json.load(open('frontend/presets/shapez_worldgen/AP_14089154938208861744/AP_14089154938208861744_rules.json')); print('helpers' in d and bool(d['helpers']))"
# Should print True
```

### Step 4: Test Frontend

```bash
# Run spoiler test
npm test -- --mode=test-spoilers --game=shapez_worldgen --seed=1
```

## Testing Strategy

### Unit Tests
- Verify `templates.py` generates Rules.py without `_HELPER_DEFINITIONS`
- Verify generated Rules.py is valid Python (imports correctly)

### Integration Tests
- Run `python scripts/test/test-all-templates.py --include-list "shapez.yaml" -p`
- This generates the world, exports rules, and runs spoiler tests

### Manual Verification
1. Inspect generated `Rules.py` - should only have Python functions
2. Inspect exported `rules.json` - should have `helpers` section with AST
3. Compare helper AST with original - should be semantically equivalent

## Risks and Mitigations

### Risk 1: Exporter doesn't detect worldgen helpers
**Mitigation**: The exporter already parses Python functions. Verify it handles the `_shapezworldgen_*` naming pattern.

### Risk 2: Helper names differ (prefixed vs unprefixed)
**Observation**: Worldgen uses `_shapezworldgen_can_stack`, original uses `can_stack`.
**Mitigation**: This is fine - the exporter will use the actual function names, and rules.json will be internally consistent.

### Risk 3: Inlining differences
**Observation**: Original AST may inline helper bodies; round-tripped AST keeps references.
**Mitigation**: Both are semantically correct. Frontend handles both via helper lookup.

### Risk 4: Some code calls get_helper_definitions()
**Mitigation**: Dependency check in Step 1 will identify any callers.

## Success Criteria

1. ✅ Generated `Rules.py` contains only Python helper functions
2. ✅ No `_HELPER_DEFINITIONS` or `get_helper_definitions()` in generated code
3. ✅ Exporter produces `rules.json` with populated `helpers` section
4. ✅ Spoiler tests pass for shapez_worldgen
5. ✅ Frontend can evaluate rules correctly

## Related Documentation

- `CC/docs/plans/helper-generation-plan.md` - Original plan for generating Python helpers
- `docs/json/developer/guides/world-generator.md` - World generator documentation
- `exporter/analyzer/ast_visitors.py` - Python-to-AST conversion logic
