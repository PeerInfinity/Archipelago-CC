# Solved General Issues for Yu-Gi-Oh! 2006

## Issue 1: Missing support for "capability" rule type

**Status**: SOLVED
**Priority**: HIGH
**Type**: Rule Engine Issue
**Fixed in commit**: (will be included in next commit)

### Description
The rule engine did not support the "capability" rule type that appeared in the generated rules.json file. This caused warnings and potentially contributed to test failures.

### Evidence
- Browser console showed repeated warnings: `[ruleEngine] [evaluateRule] Unknown rule type: capability {rule: Object}`
- Found in rules.json: `{"type": "capability", "capability": "gain_lp_every_turn", "inferred": true}`
- Test failed at sphere 2.70 with "Timeout waiting for ping response"

### Analysis
The exporter was generating a "capability" rule type with a "capability" field (e.g., "gain_lp_every_turn"). This is an inferred rule that checks if the player has the ability to perform a certain action. The capability name "gain_lp_every_turn" corresponds to a helper function "can_gain_lp_every_turn" that already exists in yugioh06Logic.js.

### Solution Implemented
Added support for the "capability" rule type in the frontend rule engine (frontend/modules/shared/ruleEngine.js):
1. Added a new case for 'capability' rule type in the evaluateRule() switch statement
2. Implemented conversion of capability name to helper function name (e.g., "gain_lp_every_turn" -> "can_gain_lp_every_turn")
3. Calls context.executeHelper() with the converted helper function name
4. Updated documentation to include capability in the list of supported rule types

### Files Modified
- frontend/modules/shared/ruleEngine.js (added capability case at line 1746, updated documentation at line 128)
