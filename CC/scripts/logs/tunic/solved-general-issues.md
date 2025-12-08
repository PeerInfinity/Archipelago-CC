# Solved General Issues - TUNIC

This document tracks resolved general issues with TUNIC.

## Solved Issues

### 1. Block rules with return statements not unwrapped correctly in AND/OR conditions

**Date Fixed:** 2025-12-08

**Problem:**
TUNIC uses complex "block" type rules with `return` statements for access rules. When these block rules were nested inside OR/AND conditions, the return value marker `{__isReturn: true, value: X}` was not being unwrapped, causing the marker object to be treated as truthy even when the actual value was `false`.

This caused many regions to be incorrectly accessible from the start (Sphere 0), including:
- Overworld Holy Cross
- Overworld Southeast Cross Door
- Overworld Fountain Cross Door
- Various portal regions
- Fortress regions
- And many more (25+ regions initially)

**Root Cause:**
The rule engine was only unwrapping `__isReturn` markers at depth 0 (top-level rule evaluation). However, block rules nested inside OR/AND conditions are evaluated at depth > 0, so their return markers were never unwrapped.

**Solution:**
Added unwrapping of `__isReturn` markers in both the `and` and `or` case handlers in `frontend/modules/shared/ruleEngine.js` (lines 568-573 for AND, lines 608-613 for OR). This ensures that when evaluating conditions in boolean operations, block return values are properly unwrapped before checking truthiness.

**Files Modified:**
- `frontend/modules/shared/ruleEngine.js`

**Test Result:**
All 80 spheres now pass.
