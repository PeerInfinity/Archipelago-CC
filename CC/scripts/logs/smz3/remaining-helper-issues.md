# SMZ3 - Remaining Helper Issues

This file tracks outstanding issues with the SMZ3 helper functions (`frontend/modules/shared/gameLogic/smz3/smz3Logic.js`).

## Issue #1: Missing smz3_CanExit Helper Function

**Severity**: High
**Type**: Missing Helper Implementation

**Description**:
The exporter generates rules that reference a `smz3_CanExit` helper function, but this function is not implemented in the JavaScript helper file.

**Example Usage in Generated Rules**:
```json
{
  "type": "helper",
  "name": "smz3_CanExit",
  "args": []
}
```

**Locations Affected**:
This helper is used extensively in lower Norfair locations:
- "Power Bomb (lower Norfair above fire flea room)"
- "Power Bomb (Power Bombs of shame)"
- "Missile (lower Norfair near Wave Beam)"
- "Energy Tank, Ridley"
- "Energy Tank, Firefleas"
- And likely many more

**Python Source**:
Need to find the `CanExit` method in the TotalSMZ3 library to understand what it checks.

**Implementation Needed**:
Add `smz3_CanExit` function to `frontend/modules/shared/gameLogic/smz3/smz3Logic.js` with proper logic.
