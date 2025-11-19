# Remaining Super Metroid Helper Issues

## Critical Issue: Helper Functions Not Being Evaluated Correctly

**Severity:** High
**Status:** Identified, needs fix
**Blocking:** All location access in Sphere 0

### Problem
Locations that should be accessible are showing "Access rule evaluation failed" and are not being marked as accessible by the state manager.

### Affected Locations
- **Energy Tank, Brinstar Ceiling** - Should be accessible in Sphere 0
- **Morphing Ball** - Should be accessible in Sphere 0

### Current Export
Both locations now export with proper rules:
```json
{
  "type": "helper",
  "name": "evalSMBool",
  "args": [
    {
      "type": "helper",
      "name": "SMBool",
      "args": [{"type": "constant", "value": true}]
    },
    {
      "type": "attribute",
      "object": {
        "type": "subscript",
        "value": {
          "type": "attribute",
          "object": {"type": "name", "name": "state"},
          "attr": "smbm"
        },
        "index": {"type": "constant", "value": 1}
      },
      "attr": "maxDiff"
    }
  ]
}
```

### Analysis
The rule requires evaluating:
1. `SMBool(true)` - should return `{bool: true, difficulty: 0}`
2. `state.smbm[1].maxDiff` - should return 999 (or the configured maxDiff value)
3. `evalSMBool({bool: true, difficulty: 0}, 999)` - should return true

The issue is likely one of:
1. The rule engine doesn't properly handle nested attribute/subscript expressions
2. The helper functions aren't being called with the correct context
3. The `state` variable in the rule doesn't map to the correct snapshot object

### Expected Behavior
- The rule engine should evaluate `state.smbm[1].maxDiff` and get the value 999
- evalSMBool should be called with the snapshot, staticData, the SMBool result, and the maxDiff value
- The function should return true, making the location accessible

### Next Steps
1. Add debug logging to the rule engine to see how complex expressions are being evaluated
2. Check if the rule engine supports subscript operations on attributes
3. Verify that "state" name is correctly resolved to the snapshot object
4. Test if helper functions are being called with the correct number and type of arguments

### Files to Investigate
- `frontend/modules/shared/ruleEngine.js` - Rule evaluation logic
- `frontend/modules/shared/gameLogic/sm/smLogic.js` - Helper function implementations
- Rule schema documentation

---

## Secondary Issue: Energy Tank, Brinstar Ceiling Has Complex VARIA Logic

**Severity:** Medium
**Status:** Identified, will address after fixing primary issue

### Problem
"Energy Tank, Brinstar Ceiling" has a complex rule involving multiple VARIA helpers:
- `knowsCeilingDBoost()` - Returns `{bool: true, difficulty: 0}` (implemented)
- `canFly()` - Returns `{bool: false, difficulty: 0}` (stub)
- `wor()` - OR with difficulty (implemented)
- `haveItem()` - Check for items (implemented)

### Analysis
The rule should pass because `knowsCeilingDBoost()` returns true, and `wor(true, ...)` should return `{bool: true, difficulty: 0}`. However, this depends on the primary issue being fixed first.

### Next Steps
After fixing the primary helper evaluation issue, verify that:
1. `knowsCeilingDBoost()` is being called and returns the correct value
2. `wor()` properly combines SMBool objects
3. `evalSMBool()` correctly evaluates the result
