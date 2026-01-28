# Bunny Rule Data Extraction Options

## Overview

This document outlines three approaches for extracting more complete bunny rule data from ALttP's generated world, improving UT fuzzer testing accuracy beyond the current ~74% pass rate.

**Status**: Planning
**Priority**: Medium
**Complexity**: Medium-High
**Date**: 2026-01-28

## Problem Statement

The ALttP UT fuzzer tests show ~74% pass rate (37/50) for standard options, dropping to ~20% for entrance shuffle insanity mode. Analysis reveals that bunny rule data IS stored in closure variables but the current `ClosureFunctionAnalyzer` depth-limits extraction to prevent exponential rule growth.

### Current Limitation

The `ClosureFunctionAnalyzer` uses `MAX_BUNNY_PATH_DEPTH = 1` which causes:
- At depth > 1, `_analyze_options_pattern()` returns Moon Pearl check instead of full path analysis
- At depth > 1, `_analyze_path_pattern()` returns just the can_reach check instead of full path requirements

This is why some locations appear accessible when they shouldn't be - the depth-limited extraction doesn't capture all the requirements from nested paths through mixed regions.

### Data Flow Confirmation

The diagnostic script `scripts/debug/extract_bunny_closures.py` confirms:
1. **39 locations** have `options_to_access_rule` patterns in inverted+insanity mode
2. **Path data IS stored** in nested closures:
   - `entrance` objects (name, parent_region, connected_region)
   - `path` lists (access rule functions from traversed regions)
3. **Data IS extractable** without reconstruction - it exists in the generated world

## Option 1: Increase MAX_BUNNY_PATH_DEPTH

### Description

Increase the `MAX_BUNNY_PATH_DEPTH` constant from 1 to a higher value (e.g., 3-5) to allow deeper extraction of nested bunny rules.

### Implementation

**File**: `exporter/analyzer/closure_function_analyzer.py`

```python
# Change from:
MAX_BUNNY_PATH_DEPTH = 1

# To:
MAX_BUNNY_PATH_DEPTH = 3  # Or configurable via game handler
```

### Pros

1. **Minimal code changes** - Single constant change
2. **Uses existing infrastructure** - ClosureFunctionAnalyzer already handles deeper analysis
3. **Immediate improvement** - More path data extracted automatically

### Cons

1. **Exponential rule growth** - Each depth level multiplies rule complexity
2. **Performance degradation** - Longer export times, larger JSON files
3. **Memory concerns** - Deep analysis may exhaust memory on complex seeds
4. **Frontend impact** - Larger rules mean slower frontend evaluation

### Risk Analysis

| Depth | Estimated Rule Size | Export Time Impact | Memory Risk |
|-------|--------------------|--------------------|-------------|
| 1 (current) | Small | Baseline | Low |
| 2 | 10-100x | 2-5x | Medium |
| 3 | 100-1000x | 5-20x | High |
| 4+ | Exponential | Likely timeout | Very High |

### Mitigation Strategies

1. **Rule size limit**: Cap total rule nodes before falling back to Moon Pearl
2. **Timeout**: Add analysis timeout per location
3. **Game handler control**: Let ALttP handler set depth based on entrance shuffle mode
4. **Selective depth**: Use deeper analysis only for specific region types

### Estimated Effort

| Task | Effort |
|------|--------|
| Increase constant | 0.5 hours |
| Add rule size limiting | 2-4 hours |
| Add timeout protection | 2-4 hours |
| Testing & tuning | 4-8 hours |
| **Total** | **8-16 hours** |

---

## Option 2: Extract Raw Closure Data

### Description

Instead of analyzing the rule code, directly extract the data from closure variables and serialize it in a simpler format that the frontend can evaluate.

### Implementation

**Phase 1: Extract entrance/path data directly**

**File**: `exporter/analyzer/closure_function_analyzer.py`

```python
def extract_bunny_rule_data(self, func: Callable) -> Optional[Dict[str, Any]]:
    """Extract raw data from bunny rule closures without full analysis.

    Instead of analyzing the rule code, extract:
    - entrance names from path_to_access_rule closures
    - item constants from bytecode
    - region references
    """
    closure_vars = self._extract_closure_vars(func)

    # Pattern: options_to_access_rule
    if 'options' in closure_vars:
        options = closure_vars['options']
        extracted_paths = []
        for opt in options:
            if callable(opt):
                path_data = self._extract_path_data(opt)
                if path_data:
                    extracted_paths.append(path_data)

        if extracted_paths:
            return {
                'rule': 'BunnyPathCheck',
                'paths': extracted_paths
            }

    return None

def _extract_path_data(self, func: Callable) -> Optional[Dict[str, Any]]:
    """Extract path data without deep analysis."""
    closure_vars = self._extract_closure_vars(func)

    if 'path' in closure_vars and 'entrance' in closure_vars:
        entrance = closure_vars['entrance']
        path = closure_vars['path']

        # Extract entrance info directly
        entrance_data = {
            'name': getattr(entrance, 'name', None),
            'parent_region': getattr(entrance.parent_region, 'name', None) if hasattr(entrance, 'parent_region') else None,
        }

        # Extract item constants from path rules via bytecode
        required_items = []
        for rule in path:
            if callable(rule) and hasattr(rule, '__code__'):
                for const in rule.__code__.co_consts:
                    if isinstance(const, str) and const in ALTTP_ITEMS:
                        required_items.append(const)

        return {
            'entrance': entrance_data,
            'required_items': list(set(required_items))
        }

    return None
```

**Phase 2: New rule type for frontend**

**File**: `frontend/modules/shared/ruleEngine.js`

```javascript
case 'BunnyPathCheck':
    // Check if any path allows access
    return rule.paths.some(path => {
        // First check entrance reachability
        const entranceReachable = state.isEntranceReachable(path.entrance.name);
        if (!entranceReachable) return false;

        // Then check required items for this path
        return path.required_items.every(item => state.hasItem(item));
    });
```

### Pros

1. **Fast extraction** - No recursive analysis, just closure variable reading
2. **Controlled output size** - Only extracts key data (entrance names, items)
3. **Simpler frontend evaluation** - Clear structure for path checking
4. **No exponential growth** - Data size is linear in number of paths

### Cons

1. **Incomplete data** - Loses complex rule structures (e.g., count requirements, helpers)
2. **New rule type** - Frontend needs to support BunnyPathCheck
3. **Item extraction heuristics** - Bytecode analysis may miss some requirements
4. **Maintenance** - Two extraction methods to maintain

### Data Captured vs Lost

| Data Type | Captured | Lost |
|-----------|----------|------|
| Entrance names | Yes | - |
| Parent regions | Yes | - |
| Item names (from bytecode) | Mostly | Items from helper calls |
| Item counts | No | Yes |
| Helper function logic | No | Yes |
| Can_reach requirements | Partial | Nested can_reach |

### Estimated Effort

| Task | Effort |
|------|--------|
| Raw extraction methods | 4-6 hours |
| Frontend BunnyPathCheck handler | 2-4 hours |
| Integration with ALttP handler | 2-4 hours |
| Testing | 4-8 hours |
| **Total** | **12-22 hours** |

---

## Option 3: Pre-compute Paths at Export Time

### Description

During export, actually evaluate which paths exist for each bunny rule location and cache the computed results. Instead of exporting rule structures, export the evaluated reachability conditions.

### Implementation

**Phase 1: Path evaluation during export**

**File**: `exporter/games/official/alttp.py`

```python
def _precompute_bunny_paths(self, location, player: int) -> Dict[str, Any]:
    """Evaluate bunny paths at export time and cache results.

    This runs the actual path BFS that set_bunny_rules() created,
    then exports the computed path requirements.
    """
    access_rule = location.access_rule
    closure_vars = self._extract_closure_vars(access_rule)

    # Get the bunny rule (from add_rule combined lambda)
    if 'rule' not in closure_vars:
        return None

    bunny_rule = closure_vars['rule']
    bunny_closure = self._extract_closure_vars(bunny_rule)

    if 'options' not in bunny_closure:
        return None

    options = bunny_closure['options']

    # Evaluate each path option to determine what items make it accessible
    computed_paths = []
    for opt in options:
        path_closure = self._extract_closure_vars(opt)
        if 'entrance' in path_closure:
            entrance = path_closure['entrance']

            # Get all items that would be needed for this path
            # by evaluating the path rules
            required_items = self._compute_path_requirements(
                path_closure.get('path', []),
                player
            )

            computed_paths.append({
                'via_entrance': entrance.name,
                'requires': required_items
            })

    if not computed_paths:
        return None

    return {
        'rule': 'PrecomputedBunnyPaths',
        'location': location.name,
        'paths': computed_paths
    }

def _compute_path_requirements(self, path_rules: List, player: int) -> List[str]:
    """Compute what items a path requires by analyzing the rules.

    This extracts the logical requirements from the path rules
    without running the full analyzer.
    """
    requirements = []

    for rule_func in path_rules:
        if not callable(rule_func):
            continue

        # Extract items from bytecode constants
        if hasattr(rule_func, '__code__'):
            for const in rule_func.__code__.co_consts:
                if isinstance(const, str) and const in self.ALTTP_ITEMS:
                    requirements.append(const)

        # Check for nested bunny rules (recursion)
        closure = self._extract_closure_vars(rule_func)
        if 'options' in closure:
            # This path requires going through another bunny region
            # Mark as requiring Moon Pearl for safety
            requirements.append('Moon Pearl')
            break

    return list(set(requirements))
```

**Phase 2: Frontend handler**

**File**: `frontend/modules/shared/ruleEngine.js`

```javascript
case 'PrecomputedBunnyPaths':
    // Check if any precomputed path is satisfied
    return rule.paths.some(path => {
        // Check entrance reachability
        if (!state.isEntranceReachable(path.via_entrance)) {
            return false;
        }
        // Check all required items
        return path.requires.every(item => state.hasItem(item));
    });
```

### Pros

1. **Accurate computation** - Uses actual path evaluation logic
2. **Fixed output size** - Each path is just entrance + items list
3. **No recursive analysis** - Paths computed once at export time
4. **Handles shuffled entrances** - Computed based on actual shuffle result

### Cons

1. **Export time increase** - Must evaluate all paths during export
2. **Still approximate** - Can't fully capture helper function logic
3. **New rule type** - Frontend needs PrecomputedBunnyPaths handler
4. **Nested bunny regions** - Falls back to Moon Pearl for complex cases

### Data Quality

| Scenario | Accuracy |
|----------|----------|
| Simple paths | High |
| Paths with item requirements | High |
| Paths with helper calls | Medium |
| Nested bunny regions | Low (falls back to Moon Pearl) |
| Glitch mode paths | Medium |

### Estimated Effort

| Task | Effort |
|------|--------|
| Path evaluation methods | 6-8 hours |
| Requirement computation | 4-6 hours |
| Frontend handler | 2-4 hours |
| Integration | 2-4 hours |
| Testing | 6-10 hours |
| **Total** | **20-32 hours** |

---

## Comparison Matrix

| Criterion | Option 1: Increase Depth | Option 2: Raw Closure Data | Option 3: Pre-compute Paths |
|-----------|-------------------------|---------------------------|---------------------------|
| **Implementation Effort** | Low (8-16h) | Medium (12-22h) | High (20-32h) |
| **Accuracy** | High (if depth sufficient) | Medium | Medium-High |
| **Performance Risk** | High (exponential) | Low | Medium |
| **Rule Size** | Potentially huge | Fixed | Fixed |
| **Maintenance** | Low | Medium | Medium |
| **Entrance Shuffle Support** | Yes (full) | Partial | Yes (computed) |
| **Nested Regions** | Yes | No | Partial |

## Recommendation

### Short-term: Hybrid Approach (Options 1 + 2)

1. **Increase MAX_BUNNY_PATH_DEPTH to 2** with rule size limiting
2. **Add raw closure extraction as fallback** when depth limit is hit
3. **Keep Moon Pearl fallback** for unanalyzable cases

This provides:
- Better accuracy for most cases (depth 2 covers majority)
- Graceful degradation (raw extraction when depth exceeded)
- Safety net (Moon Pearl for edge cases)

### Long-term: Option 3 with Caching

Pre-computed paths would be most accurate for entrance shuffle scenarios, but the implementation effort is higher. Consider this for a future iteration if the hybrid approach proves insufficient.

## Implementation Plan

### Phase 1: Quick Win (2-4 hours)

1. Increase `MAX_BUNNY_PATH_DEPTH` to 2
2. Add rule size check (fail if > 1000 nodes)
3. Run fuzzer tests to measure improvement

### Phase 2: Raw Extraction Fallback (8-12 hours)

1. Implement `extract_bunny_rule_data()` method
2. Add `BunnyPathCheck` rule type to frontend
3. Integrate as fallback when depth limit hit
4. Test with entrance shuffle insanity

### Phase 3: Tuning (4-8 hours)

1. Adjust depth limit based on performance data
2. Tune rule size thresholds
3. Add game handler configuration options
4. Document configuration options

### Phase 4: Validation (4-8 hours)

1. Run full fuzzer suite (100+ seeds)
2. Test all entrance shuffle modes
3. Test inverted mode combinations
4. Measure pass rate improvement

## Success Criteria

1. **Fuzzer pass rate** improves from ~74% to >85% for standard options
2. **Entrance shuffle insanity** improves from ~20% to >50%
3. **Export time** remains under 2x baseline
4. **Rule JSON size** remains under 2x baseline
5. **No regressions** in other ALttP configurations

## Files to Modify

| File | Changes |
|------|---------|
| `exporter/analyzer/closure_function_analyzer.py` | Increase depth, add raw extraction |
| `exporter/games/official/alttp.py` | Add configuration options |
| `frontend/modules/shared/ruleEngine.js` | Add BunnyPathCheck handler |
| `exporter/constants.py` | Add new constants |

## References

- `scripts/debug/extract_bunny_closures.py` - Diagnostic script showing data is extractable
- `CC/docs/plans/bunny-rule-analyzer-support.md` - Previous bunny rule implementation
- `exporter/analyzer/closure_function_analyzer.py` - Current implementation
- `worlds/alttp/Rules.py:1653-1783` - Original set_bunny_rules() implementation
