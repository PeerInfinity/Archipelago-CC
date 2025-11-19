# SMZ3 Remaining Exporter Issues

## Issue 2: RewardType reference not resolved

**Status:** In Progress
**Sphere where issue appears:** 5.8
**Test failure:** Sahasrahla location not accessible

**Description:**
The location "Sahasrahla" is accessible in the Python backend at sphere 5.8, but not in the JavaScript frontend. The error message is:
```
Name "RewardType" NOT FOUND in context
ISSUE: Access rule evaluation failed
Locations accessible in LOG but NOT in STATE (or checked): Sahasrahla
```

**Root Cause:**
The access rule for "Sahasrahla" references a `RewardType` enum or variable that is not being properly exported or resolved by the JavaScript rule engine. This is likely a reference to ALTTP reward types (like pendants or crystals).

**Expected behavior:**
The `RewardType` reference should be resolved to a concrete rule that the JavaScript frontend can evaluate.

**Current behavior:**
The JavaScript rule engine encounters `RewardType` and fails to evaluate the rule because it doesn't exist in the context.

**Fix needed:**
The exporter needs to resolve `RewardType` references to concrete rules, or the JavaScript rule engine needs to handle reward type checking.
