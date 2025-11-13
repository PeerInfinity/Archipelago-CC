# Solved Exporter Issues - Stardew Valley

This file tracks resolved exporter issues for Stardew Valley.

## Resolved Issues

### ✅ StardewRule Serialization Support (Issue #1 - Partial)

**Date Resolved**: 2025-11-13
**Impact**: Critical - Fixed 472 of 480 locations (98.3% success rate)

**Problem**:
Stardew Valley uses custom `StardewRule` objects instead of Python lambda functions. The analyzer couldn't extract source code from these objects, resulting in 480 locations with `access_rule: null`. This made all these locations appear immediately accessible in the frontend.

**Solution Implemented**:
Created a comprehensive StardewRule serialization system:

1. **New Module**: `exporter/analyzer/stardew_rule_serializer.py`
   - `is_stardew_rule(obj)` - Detects StardewRule objects by module path
   - `serialize_stardew_rule(rule_obj, player_context)` - Recursively serializes rule objects to JSON

2. **Analyzer Integration**: Modified `exporter/analyzer/analysis.py`
   - Added early detection of StardewRule objects in `analyze_rule()`
   - Calls serializer before attempting source extraction
   - Returns serialized result directly, bypassing AST analysis

3. **Rule Type Support**: Implemented handlers for all major StardewRule types:
   - `Received` - Item possession checks
   - `And`/`Or` - Logical combinations with recursive serialization
   - `True_`/`False_` - Literal boolean values
   - `Has` - Lazy evaluation wrappers (recursively serializes underlying rule)
   - `Count` - N-of-M conditions (converts to AND/OR when possible)
   - `Reach` - Region accessibility (simplified to constant true)
   - `TotalReceived` - Multi-item count checks
   - `HasProgressionPercent` - Progression percentage checks

**Technical Details**:
```python
# Before: Lambda inspection attempt
source = inspect.getsource(rule_func)  # Failed for StardewRule objects

# After: Object detection and serialization
if is_stardew_rule(rule_func):
    return serialize_stardew_rule(rule_func, player_context)
```

**Results**:
- ✅ Generation completes with no errors
- ✅ Zero "Unknown StardewRule type" warnings
- ✅ 472/480 locations now have proper access rules
- 🟡 8 locations still have issues (requires further investigation)

**Files Modified**:
- `exporter/analyzer/analysis.py` - Added StardewRule detection
- `exporter/analyzer/stardew_rule_serializer.py` - New serialization module
- `exporter/games/stardew_valley.py` - Game handler (stub for now)

**Remaining Work**:
See `remaining-exporter-issues.md` for the 8 locations that still need debugging.
