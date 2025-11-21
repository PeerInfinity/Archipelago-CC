# Super Metroid - Solved Exporter Issues

## Issue 1: self.evalSMBool exported as function_call instead of helper

**Status**: ✓ Solved

**Description**:
Rules containing `self.evalSMBool(...)` were being exported as `function_call` type with object reference to "self", which the frontend couldn't evaluate.

**Solution**:
The analyzer now automatically converts `self.evalSMBool` calls to helper type before the exporter's `expand_rule` method is called. The exporter's expand_rule method handles helper type correctly.

**Test Results**:
- No more "Name 'self' NOT FOUND in context" errors

**Files Modified**:
- None (fixed in analyzer, exporter code was already correct)

## Issue 2: Complex accessFrom patterns exported as True

**Status**: ✓ Solved

**Description**:
Locations with complex `accessFrom` comprehensions that hit recursion limits were being exported with permissive rules, making locations accessible when they shouldn't be.

**Solution**:
Modified exporter to detect accessFrom patterns that hit recursion limits and export them as `False` instead of preserving corrupted structures.

**Test Results**:
- Reduced incorrectly accessible locations from 5 to 0 in initial testing
- However, this also made simple accessFrom locations (like Morphing Ball) inaccessible

**Files Modified**:
- exporter/games/sm.py:304-307 (convert accessFrom patterns to False)
- exporter/games/sm.py:311-314 (convert deeply nested any_of to False)

**Related Issue**:
This fix exposed Issue 1 in remaining-exporter-issues.md (cannot distinguish simple vs complex accessFrom)
