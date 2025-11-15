# Stardew Valley - Solved Helper Issues

This file tracks helper function issues for Stardew Valley that have been successfully fixed.

## Solved Issues

### 1. Missing `total_received` helper function

**Error:** `Helper function "total_received" NOT FOUND in snapshotInterface`

**Description:** The exporter generates `total_received` helper calls for `TotalReceived` rules (which check if the total count across multiple items meets a threshold), but this helper function was not implemented in the frontend.

**Location:** `frontend/modules/shared/gameLogic/stardew_valley/helpers.js`

**Solution:** Implemented the `total_received` helper function that:
- Takes a required count and an array of item names
- Sums the inventory count for all specified items
- Returns true if the total is >= the required count

**Files Modified:**
- `frontend/modules/shared/gameLogic/stardew_valley/helpers.js` (added total_received function)
