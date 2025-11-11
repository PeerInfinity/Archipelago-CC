# Solved Exporter Issues for Final Fantasy Mystic Quest

This document tracks exporter-related issues that have been fixed.

## Solved Issues

### Issue 1: Binary operation string concatenation not handled

**Problem**: The FFMQ exporter's `expand_rule` function only handled the specific case of binary operations where the left operand was a name reference (e.g., `w + "s"`), but didn't handle general constant string concatenation (e.g., `"Bomb" + "s"`).

**Impact**: Location access rules containing expressions like `state.has_any(item_groups["Bomb" + "s"])` were not being properly expanded. The rules remained as nested subscript/binary_op/state_method structures instead of being simplified to basic item_check conditions. This caused regions like "Bone Dungeon B1 - Checker Room" and "Bone Dungeon B2 - Exploding Skull Room - First Room" to be unreachable in the frontend state manager.

**Solution**: Modified the `expand_rule` function in `exporter/games/ffmq.py` to:
1. Recursively expand both left and right operands of binary operations
2. Handle general string concatenation when both operands are constants
3. Properly concatenate constant strings (e.g., "Bomb" + "s" = "Bombs")
4. Fall back to the expanded operands if full resolution isn't possible

**Files Changed**:
- `exporter/games/ffmq.py`: Lines 27-88

**Test Result**: After fix, the spoiler test passes with all 74 sphere updates validated successfully.
