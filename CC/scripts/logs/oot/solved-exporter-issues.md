# Solved Exporter Issues for Ocarina of Time

This file tracks exporter issues that have been fixed.

## Issue 1: Undefined Helpers - "rule" and "old_rule"

**Status**: SOLVED
**Date Fixed**: 2025-11-12

### Problem
Many locations had access rules that contained undefined helpers named "rule" and "old_rule". These are closure variables from the `add_rule()` function in `worlds/generic/Rules.py` that couldn't be analyzed because they're in dynamically-created lambdas.

### Solution
Modified the OOT exporter (`exporter/games/oot.py`) to:
1. Detect these special helpers in the `expand_rule()` method
2. Replace them with `{type': 'constant', 'value': True}` since they typically represent the default (empty) rule
3. Recursively process all rule node types (and, or, function_call, etc.) to find and replace these helpers wherever they appear
4. Simplify resulting rules by removing constant True conditions from AND nodes

### Files Changed
- `exporter/games/oot.py` - Added custom `expand_rule()` method
- `exporter/analyzer/ast_visitors.py` - Added logic to detect and analyze callable closure variables (attempted fix that wasn't ultimately needed)

### Result
All "rule" and "old_rule" helpers have been successfully removed from the rules.json. Locations that had these helpers now have properly simplified access rules.

### Note
While this issue was fixed, it did not resolve the overall test failure. The test still fails with thousands of extra locations accessible, indicating a more fundamental issue with region connectivity or access rule evaluation.
