# Shapez Solved Exporter Issues

## Issue 1: Unknown rule type "capability" - FIXED

**Status:** Fixed
**Priority:** High
**Type:** Exporter
**Date Fixed:** 2025-11-13

### Description
The generic exporter was creating rules with type "capability" for helper functions that start with `can_*`, but the ruleEngine.js doesn't support this rule type.

### Solution
Created `exporter/games/shapez.py` that overrides the `expand_rule` method to preserve helper functions as-is instead of expanding them to capability rules.

### Files Modified
- Created: `exporter/games/shapez.py`

### Result
Helper functions are now properly exported as type "helper" with their function names preserved, allowing them to be called by the frontend.
