# SMZ3 Exporter Issues - Solved

## Issues Fixed

### 1. smz3_canAccess Helper Generation (SOLVED)
**Date Solved**: 2025-11-18
**Severity**: Critical
**Description**: The exporter was analyzing the `Available` method which combines `Region.CanEnter` and `self.canAccess`, but it was converting `self.canAccess` to a helper call rather than analyzing the actual lambda.
**Solution**: Modified exporter to extract and analyze the `canAccess` lambda directly from the location object instead of the `Available` method.
**Code Changes**:
- exporter/games/smz3.py: Changed line 261 from `loc_object.Available` to `loc_object.canAccess`
**Verification**: `smz3_canAccess` no longer appears in generated rules.json (0 occurrences)

---

*Last updated: 2025-11-18*
