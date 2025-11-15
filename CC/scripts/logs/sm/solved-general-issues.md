# Solved General Issues - Super Metroid

This file tracks general issues that have been fixed.

## Solved Issues

### 1. Missing 'any_of' rule type support in rule engine

**Issue:** The rule engine didn't recognize the `any_of` rule type, causing hundreds of warnings and preventing proper rule evaluation.

**Error:**
```
[ruleEngine] [evaluateRule] Unknown rule type: any_of
```

**Fix:** Added `any_of` case handler in `frontend/modules/shared/ruleEngine.js` (lines 1458-1512). The handler:
- Evaluates an element_rule against items from an iterator
- Returns true if ANY item satisfies the element_rule (OR logic)
- Handles undefined values properly
- Returns false for empty iterables

**Status:** SOLVED - No more any_of warnings appear in test output
