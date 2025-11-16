# Factorio - Remaining General Issues

This file tracks remaining general issues that are not exporter or helper specific.

## Issues

### 1. Rule Engine: Missing f_string support

**Status:** Active
**Priority:** High
**Type:** Rule Engine

The rule engine does not support the `f_string` rule type, which is used in Factorio access rules for locations that require automated production of items.

**Example:**
```json
{
  "type": "f_string",
  "parts": [
    {
      "type": "constant",
      "value": "Automated "
    },
    {
      "type": "formatted_value",
      "value": {
        "type": "name",
        "name": "ingredient"
      }
    }
  ],
  "all_simple": true,
  "value": "Automated {ingredient}"
}
```

**Impact:** 32+ locations in sphere 0.1 are not accessible because their access rules contain f_strings that cannot be evaluated.

**Affected locations:** AP-1-031, AP-1-055, AP-1-076, AP-1-079, AP-1-080, AP-1-097, AP-1-108, AP-1-126, AP-1-141, AP-1-158, AP-1-194, AP-1-195, AP-1-211, AP-1-235, AP-1-330, AP-1-459, AP-1-475, AP-1-494, AP-1-499, AP-1-633, AP-1-653, AP-1-711, AP-1-754, AP-1-757, AP-1-769, AP-1-798, AP-1-880, AP-1-934, AP-1-951, AP-1-954, AP-1-983, AP-1-997

**File:** frontend/modules/shared/ruleEngine.js

**Fix needed:** Add support for evaluating f_string rules in the evaluateRule function.

### 2. Rule Engine: all_of iterator variable binding not implemented

**Status:** Active
**Priority:** High
**Type:** Rule Engine

The `all_of` rule type does not bind iterator variables when evaluating the element_rule. Line 1449 has a TODO comment: "In a full implementation, we'd need to bind the iterator variable"

**Current behavior:** The element_rule is evaluated without binding the iterator variable (e.g., `ingredient`) to each value from the iterable.

**Example access rule:**
```json
{
  "type": "all_of",
  "element_rule": {
    "type": "item_check",
    "item": {
      "type": "f_string",
      "parts": [...],
      "value": "Automated {ingredient}"
    }
  },
  "iterator_info": {
    "type": "comprehension_details",
    "target": {
      "type": "name",
      "name": "ingredient"
    },
    "iterator": {
      "type": "name",
      "name": "ingredients"
    }
  }
}
```

**Impact:** The f_string in the element_rule cannot resolve the `ingredient` variable, causing access rule evaluation failures.

**File:** frontend/modules/shared/ruleEngine.js:1449

**Fix needed:** Create a new context with bound variables when evaluating element_rule in all_of loops.
