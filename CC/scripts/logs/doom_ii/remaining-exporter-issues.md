# DOOM II - Remaining Exporter Issues

This file tracks unresolved issues with the DOOM II exporter (`exporter/games/doom_ii.py`).

## Issues

None - All individual seed tests passing.

## Informational Items

### Generation Warning (Non-blocking)

**Issue**: Handler for DOOM II returned no item data warning during generation
**Details**: During generation, the following warning appears:
```
Handler for DOOM II returned no item data. Item export might be incomplete.
```

**Status**: Informational only - Does not affect test results
**Impact**: The exporter's `get_item_data()` method returns no custom item data, relying entirely on the base class generic implementation. This warning can be safely ignored as long as tests pass.

**File**: `exporter/games/doom_ii.py:58-62`

**Test Results**: All seeds tested individually (1-10) pass successfully.
