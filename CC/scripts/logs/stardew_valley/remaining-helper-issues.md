# Stardew Valley - Remaining Helper Issues

## Issue 2: Missing helper function "total_received"

**Status**: Active
**Priority**: High
**Type**: Helper Issue

**Description**:
The spoiler test shows that some locations are using a helper function called "total_received" which is not implemented in the frontend helper functions.

**Error Message**:
```
Helper function "total_received" NOT FOUND in snapshotInterface
```

**Investigation Needed**:
1. Search for total_received usage in the Python source code
2. Understand what this helper function does
3. Implement it in the Stardew Valley frontend helper file

**Test Command**:
```bash
npm test --mode=test-spoilers --game=stardew_valley --seed=1
```

**Last Tested**: 2025-11-14
