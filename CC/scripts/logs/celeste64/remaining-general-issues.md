# Remaining Celeste 64 General Issues

## Issue 1: Rule engine does not support "not in" operator

**Status:** SOLVED (moved to solved-general-issues.md)
**Severity:** CRITICAL
**Location:** frontend/modules/shared/ruleEngine.js

**Description:**
The spoiler test shows repeated warnings:
```
[ruleEngine] [evaluateRule] Unsupported comparison operator: not in
```

This operator is used extensively in the Celeste 64 rules.json file (at least 40 occurrences) for checking if region connections are blocked.

**Example usage in rules.json:**
```json
{
  "type": "compare",
  "left": {
    "type": "name",
    "name": "region_connection"
  },
  "op": "not in",
  "right": {
    "type": "constant",
    "value": {
      "('Forsaken City', 'Granny Island')": [...]
    }
  }
}
```

**Impact:**
- All rules using "not in" evaluate to undefined/false
- Causes regions to be inaccessible: Forsaken City, Granny Island, Intro Islands
- Causes 10+ locations to be inaccessible in Sphere 0

**Fix Required:**
Add support for "not in" operator in the rule engine's compare operation handler.

**Test Results:**
- Sphere 0 fails with STATE MISMATCH
- Missing regions: Forsaken City, Granny Island, Intro Islands
- Missing locations: Climb Sign Checkpoint, Fall Through Spike Floor Strawberry, First Strawberry, Floating Blocks Strawberry, Girders Strawberry, Granny Checkpoint, Intro Checkpoint, South-East Tower Checkpoint, South-East Tower Side Strawberry, South-East Tower Top Strawberry

## Issue 2: "in" operator support verification

**Status:** VERIFIED - Enhanced
**Severity:** N/A
**Location:** frontend/modules/shared/ruleEngine.js

**Description:**
The "in" operator was already implemented but was enhanced to support object (dictionary) membership checks.

**Enhancement:**
Added support for object membership testing:
```javascript
} else if (typeof right === 'object' && right !== null) {
  // Handle object (dictionary) membership check
  result = left in right;
}
```

This allows checking if a key exists in a dictionary, which complements the "not in" operator functionality.

**Impact:** None - enhancement only, tests pass
