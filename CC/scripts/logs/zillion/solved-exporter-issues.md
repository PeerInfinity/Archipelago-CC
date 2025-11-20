# Solved Exporter Issues for Zillion

## Issue 1: Runtime Testing Doesn't Work During Export (SOLVED)

### Problem
The exporter was using runtime testing which resulted in 470 locations being incorrectly marked as accessible.

### Solution Implemented
Changed the exporter to read requirements directly from `location.zz_loc.req` instead of runtime testing.

### Files Modified
- `exporter/games/zillion.py`

### Result
Successfully reduced incorrect location accessibility from 470 to 41 locations.

## Issue 2: Starting Capabilities Not Accounted For (SOLVED)

### Problem
The exporter was treating gun=1 and jump=1 as requiring items, when these are baseline capabilities the player starts with.

### Solution Implemented
Updated the exporter to account for starting capabilities:
- gun=1, jump=1: No items required (baseline)
- gun=2: Requires 1 "Zillion" item
- gun=3: Requires 2 "Zillion" items
- Similar logic for jump with "Opa-Opa"

### Files Modified
- `exporter/games/zillion.py` (lines 45-71)

### Result
Sphere 0 now correctly shows 12 locations accessible with no items (down from 0 before the fix).
