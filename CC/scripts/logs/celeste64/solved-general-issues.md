# Solved Celeste 64 General Issues

## Issue 1: Rule engine does not support "not in" operator

**Status:** SOLVED
**Severity:** CRITICAL
**Location:** frontend/modules/shared/ruleEngine.js

**Description:**
The rule engine did not support the "not in" comparison operator, which is used extensively in Celeste 64 rules for checking if region connections are blocked.

**Solution:**
Added support for both "not in" and enhanced "in" operators in the rule engine's compare operation handler:
- Added "not in" case that negates the result of "in" logic
- Enhanced "in" operator to handle object (dictionary) membership checks using JavaScript's `in` operator
- Both operators now support arrays, strings, Sets, and objects

**Files Modified:**
- frontend/modules/shared/ruleEngine.js (lines 994-1060)

**Testing:**
After adding "not in" support and fixing the exporter, all spoiler tests pass successfully with 35 sphere events processed correctly.

Note: The "not in" operator support alone was not sufficient to fix the issue. The exporter also needed to be fixed to properly handle Celeste 64 helper functions (see solved-exporter-issues.md).
