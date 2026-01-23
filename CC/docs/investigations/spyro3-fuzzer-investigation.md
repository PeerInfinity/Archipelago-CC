# Spyro 3 APWorld UT Fuzzer Investigation

## Summary

The Spyro 3 APWorld (v1.2.2) fails the Universal Tracker fuzzer testing due to fundamental architectural issues in how the apworld defines its access rules.

## Test Results

- **Total runs**: 10
- **Success**: 0
- **Timeouts**: 7-8 (varies by run)
- **Ignored**: 2-3

## Root Cause Analysis

### Primary Issue: Complex Nested Functions

The Spyro 3 apworld defines all its rule helper functions as **nested functions inside the `set_rules()` method**. This creates several problems:

1. **RecursionError during AST parsing**: The `__init__.py` file is 2265 lines, and when the exporter tries to parse this file's AST, it can exceed Python's recursion limit during `ast.dump()` for debug logging.

2. **RecursionError during lambda source extraction**: When `astunparse.unparse()` tries to convert complex lambda AST nodes back to source code, it can also hit recursion limits.

3. **Slow export time**: Even with fallbacks to `inspect.getsource()`, processing 4329 locations (many with complex rules) exceeds the fuzzer's 15-second timeout.

### Specific Problematic Patterns

```python
def set_rules(self) -> None:
    # All these helpers are nested functions
    def is_level_completed(self, level, state): ...
    def is_boss_defeated(self, boss, state): ...
    def has_all_gems(self, state): ...
    def get_gems_accessible_in_level(self, level, state): ...
    def has_total_accessible_gems(self, state, max_gems, include_sbr=True, include_moneybags=True): ...
    # ... 40+ more nested functions

    # Rules reference these nested functions
    set_rule(location, lambda state: get_gems_accessible_in_level(self, level, state) >= max_gems / 4)
```

### Gem Counting Logic

The `has_all_gems()` and `get_gems_accessible_in_level()` functions implement complex gem counting logic that:
- Checks accessibility per-level based on game options
- Accounts for Moneybags payments
- Considers Open World mode
- Handles Gemsanity options
- Recursively checks level completion status

This logic cannot be easily serialized to the Rule Builder format used by worldgen.

## Attempted Fixes

### 1. Spyro 3-Specific Exporter
Created `exporter/games/unofficial/spyro3.py` to handle complex helper functions by:
- Expanding known helpers to simplified item checks
- Falling back to True for unanalyzable rules

**Result**: Does not fix the timeout issue because the problem occurs before expand_rule is called.

### 2. RecursionError Handling in Analysis
Modified `exporter/analyzer/analysis.py` to catch RecursionError during AST dump.

**Result**: Partially helps, but recursion errors also occur elsewhere.

### 3. Large File Detection
Modified `exporter/analyzer/source_extraction.py` to skip AST parsing for files over 1500 lines.

**Result**: Reduces recursion errors but the export still times out due to the volume of rules.

## Recommendations

### For Archipelago-CC
1. **Add Spyro 3 to known-incompatible list**: Document that this apworld cannot pass fuzzer testing with current architecture.

2. **Consider timeout increase**: The 15-second fuzzer timeout may be too aggressive for large apworlds.

3. **Improve export caching**: Better caching of source extraction could reduce repeated processing.

### For APWorld Maintainer
To make Spyro 3 compatible with the Universal Tracker:

1. **Move helper functions to module level**: Define functions outside `set_rules()` to simplify AST analysis.

2. **Simplify gem counting**: Consider caching or pre-computing gem accessibility rather than recalculating per-location.

3. **Use simpler rule patterns**: Avoid deeply nested function calls in lambdas.

4. **Consider Rule Builder integration**: Provide explicit Rule Builder compatible rules.

## Technical Details

### Files Modified
- `exporter/games/unofficial/spyro3.py` - New game-specific exporter
- `exporter/analyzer/analysis.py` - RecursionError handling for AST dump
- `exporter/analyzer/source_extraction.py` - Large file detection and fallback

### APWorld Info
- **Version**: 1.2.2
- **Download**: https://github.com/Uroogla/S3AP/releases/download/1.2.2/spyro3.apworld
- **Game**: Spyro 3: Year of the Dragon
- **Locations**: 4329
- **Items**: 131

## Conclusion

The Spyro 3 apworld's complexity exceeds what the current exporter architecture can handle within the fuzzer's time constraints. While partial fixes have been implemented, full compatibility would require either:
1. Significant refactoring of the apworld's rule structure
2. Major improvements to the exporter's handling of complex lambdas
3. Extended fuzzer timeout for complex games
