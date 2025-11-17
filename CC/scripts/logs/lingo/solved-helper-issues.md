# Solved Helper Issues for Lingo

## 1. Tuple type not supported in rule engine (FIXED)

**Date Fixed:** 2025-11-17
**Priority:** Critical
**Location:** `frontend/modules/shared/ruleEngine.js`

**Problem:**
Lingo entrance rules use tuple types for door arguments (e.g., `["Starting Room", "Back Right Door"]`), but the rule engine didn't have a case for evaluating tuple types. This caused all tuple arguments to evaluate to `undefined`, making helper calls fail.

**Solution:**
Added a `case 'tuple':` handler that evaluates each element and returns an array.

**Code:**
```javascript
case 'tuple': {
  if (!rule.elements || !Array.isArray(rule.elements)) {
    result = [];
    break;
  }
  const elements = rule.elements.map((elem) => evaluateRule(elem, context, depth + 1));
  if (elements.some((elem) => elem === undefined)) {
    result = undefined;
  } else {
    result = elements;
  }
  break;
}
```

## 2. Door access requirements not checked (FIXED)

**Date Fixed:** 2025-11-17
**Priority:** High
**Location:** `frontend/modules/shared/gameLogic/lingo/lingoLogic.js` - `lingo_can_use_entrance` function

**Problem:**
The helper function returned `true` for all doors without associated items, ignoring door_reqs (access requirements for doors without items). This made all non-item doors accessible regardless of requirements.

**Solution:**
Modified the helper to check `door_reqs` from settings before returning true:
```javascript
const settings = staticData?.settings?.[playerId];
const doorReqs = settings?.door_reqs?.[effectiveRoom]?.[doorName];

if (doorReqs) {
  return _lingo_can_satisfy_requirements(snapshot, staticData, doorReqs);
}

return true;
```

**Impact:**
Test improved from ~100 wrongly accessible regions to just 1.
