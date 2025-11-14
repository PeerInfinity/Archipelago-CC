# Stardew Valley - Remaining Helper Issues

## Issue 1: Missing helper function "count_true"

**Status**: Active
**Priority**: High
**Type**: Helper Issue

**Description**:
The spoiler test shows that some locations are using a helper function called "count_true" which is not implemented in the frontend helper functions.

**Error Message**:
```
Helper function "count_true" NOT FOUND in snapshotInterface
```

**Locations Affected** (from Sphere 0.5):
- Carnival Bundle
- Cow's Delight
- Forager's Bundle
- Harvest Amaranth
- Level 1 Farming

**Investigation Needed**:
1. Search for count_true usage in the Python source code
2. Understand what this helper function does
3. Implement it in the Stardew Valley frontend helper file

**Test Command**:
```bash
npm test --mode=test-spoilers --game=stardew_valley --seed=1
```

**Last Tested**: 2025-11-14
