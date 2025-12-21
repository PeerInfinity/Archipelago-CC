# Solved Lingo General Issues

*Last updated: 2025-12-21*

## Issue 1: ruleEngine 'attribute' case fails for pre-evaluated objects (FIXED)

**Status:** Fixed

**Date Fixed:** 2025-12-21

**Description:**
When the Rule Builder format Attribute rule delegates to the AST evaluator with an already-evaluated object, the 'attribute' case in `ruleEngine.js` tried to re-evaluate the plain object as a rule, which failed because plain objects have no `type` or `rule` key.

**Symptoms:**
- All location access rules returned `undefined` instead of proper boolean values
- 19 locations showed as "Access rule evaluation failed" in spoiler tests
- Locations like "Starting Room - HI" with empty access requirements were incorrectly marked as inaccessible

**Root Cause:**
In `ruleEngine.js`, the 'Attribute' case in `evaluateRuleBuilderRule` (line 5229-5243) correctly evaluated the object first, then created an AST rule. But the 'attribute' case in the main evaluateRule switch unconditionally tried to evaluate `rule.object` again. When `rule.object` was already a plain object (like the location), `evaluateRule` returned `undefined`.

**Fix Applied:**
Added a check at the start of the 'attribute' case to detect if `rule.object` is already a plain value (not a rule to evaluate):

```javascript
case 'attribute': {
  // Check if object is already a plain value (not a rule to evaluate)
  // This happens when evaluateRuleBuilderRule passes an already-evaluated object
  // Plain objects have no 'type' (CC format) or 'rule' (Rule Builder format) key
  let baseObject;
  if (rule.object && typeof rule.object === 'object' &&
      !rule.object.type && !rule.object.rule && !Array.isArray(rule.object)) {
    // Object is already evaluated, use directly
    baseObject = rule.object;
  } else {
    baseObject = evaluateRule(rule.object, context, depth + 1, localScope);
  }
  // ... rest of attribute logic
}
```

**Location:** `frontend/modules/shared/ruleEngine.js:1193-1204`

**Test Result:** Spoiler test now passes with all 12 spheres processed, 0 errors.
