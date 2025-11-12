# Solved Exporter Issues

## Issue 1: Item name mismatch in access rules (SOLVED)

**Error**: Access rule evaluation failed for Master level 2 & 3
**Root Cause**:
- Item was defined as "Master Form" (with space) but rules checked for "MasterForm" (without space)
- KH2 exporter's `expand_helper` was extracting attribute name instead of resolving to value

**Solution**:
1. Updated ast_visitors.py to resolve item names in state.has() calls
2. Updated KH2 exporter to return form_arg as-is instead of extracting attr name
3. Added resolve_attribute_nodes_in_rule() function in exporter.py to resolve ItemName.* references to their string values

**Files Modified**:
- exporter/analyzer/ast_visitors.py (lines 447-468)
- exporter/games/kh2.py (lines 29-48)
- exporter/exporter.py (added resolve_attribute_nodes_in_rule function and calls)

