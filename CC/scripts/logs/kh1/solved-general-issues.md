# Solved General Issues for Kingdom Hearts 1

This document tracks general issues that have been resolved.

## Solved Issues

### 1. Constant type handler not evaluating nested rules in values
**Issue**: When evaluating a `constant` type rule with an object value containing nested rule objects like `{"type": "name", "name": "level"}`, the nested rules were not being evaluated. This caused helpers with parameterized dictionaries (like `has_all_magic_lvx`) to fail.

**Solution**: Updated the `constant` case in `frontend/modules/shared/ruleEngine.js` to:
- Check if the constant value is an object or array
- Recursively evaluate any nested rule objects (those with `type` or `rule` properties)
- Return plain values unchanged

This fix was necessary for the `has_all_magic_lvx` helper which uses a parameterized dictionary where item counts are resolved from the `level` parameter.
