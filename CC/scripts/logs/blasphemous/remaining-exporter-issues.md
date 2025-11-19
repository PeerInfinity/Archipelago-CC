# Remaining Exporter Issues for Blasphemous

This file tracks outstanding issues with the Blasphemous exporter (exporter/games/blasphemous.py).

## Issue 1: Inconsistent item_check format in rules

**Status**: FIXED

**Description**:
The exporter is generating inconsistent formats for `item_check` rules. Some have the item name directly as a string:
```json
{
  "type": "item_check",
  "item": "Three Gnarled Tongues"
}
```

While others wrap it in a constant object:
```json
{
  "type": "item_check",
  "item": {
    "type": "constant",
    "value": "Taranto to my Sister"
  }
}
```

This inconsistency could be causing rule evaluation failures in the JavaScript frontend.

**Location**: `exporter/analyzer/ast_visitors.py:720-733` - The analyzer's handling of `state.has()` calls.

**Root Cause**: The analyzer tries to resolve item names from constant objects, but when it can't fully resolve them, it keeps the constant wrapper instead of unwrapping it. Specifically, line 731 sets `item_value = first_arg` when the item name can't be resolved, keeping the entire constant rule object.

**Impact**: Sphere 0 region accessibility test fails - regions that should be accessible are not being unlocked.

**Test**:
- Run: `npm test --mode=test-spoilers --game=blasphemous --seed=1`
- Fails at Sphere 0 with "Access rule evaluation failed" errors
- Many regions in LOG are not accessible in STATE

## Issue 2: Access rule evaluation failures

**Status**: May be resolved by Issue 1 fix - needs more investigation

**Description**:
7 access rules are failing to evaluate, causing regions to not be properly unlocked. This is likely related to Issue 1.

**Impact**: JavaScript STATE engine cannot properly match Python LOG progression.

## Issue 3: Regions not being discovered by state manager

**Status**: Investigating

**Description**:
Even after fixing the item_check inconsistency, the spoiler test still fails. Regions that should be accessible in Sphere 0 (like D17Z01S01[E]) are not being made accessible by the JavaScript state manager, even though they have `constant: true` access rules.

- D17Z01S01 is successfully reached from Menu
- D17Z01S01 has an exit to D17Z01S01[E] with access_rule `{type: "constant", value: true}`
- But D17Z01S01[E] is not being marked as accessible

This suggests an issue with the state manager's region traversal logic, not with the exported rules themselves.

**Next Steps**:
- Investigate state manager code to see why exits with constant:true are not being followed
- Check if there's an issue with how the state manager processes region exits
