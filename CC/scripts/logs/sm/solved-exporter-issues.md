# Super Metroid - Solved Exporter Issues

## Fixed Issues

### 1. Over-aggressive rule simplification
**Issue**: The exporter was simplifying ALL `evalSMBool(func(...), maxDiff)` calls to `constant: true`, which made all regions immediately accessible.

**Solution**: Removed the over-aggressive simplification in `exporter/games/sm.py`. Now only `evalSMBool(SMBool(True), maxDiff)` is simplified to true. Other patterns are kept for frontend evaluation.

**Files Modified**:
- `exporter/games/sm.py` - Modified `_try_simplify_evalSMBool()` method

### 2. Analyzer not expanding closure variables with complex state access
**Issue**: The analyzer only recursively expanded closure functions if the argument was literally `state`, but SM passes `state.smbm[player]`.

**Solution**: Modified the analyzer to detect when `state` is referenced anywhere in an argument expression, not just as a simple name.

**Files Modified**:
- `exporter/analyzer/ast_visitors.py` - Added `references_state()` helper function in `visit_Call()`

### 3. Insufficient recursion depth for cache decorators
**Issue**: SM's VARIA randomizer uses `Cache.ldeco()` decorators that create nested closures, causing the analyzer to hit the recursion limit before fully expanding rules.

**Solution**: Increased the recursion limit from 3 to 10 to allow deeper expansion.

**Files Modified**:
- `exporter/analyzer/analysis.py` - Increased recursion limit in `analyze_rule()`

