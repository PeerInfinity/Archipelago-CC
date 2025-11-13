# Pokemon Red and Blue - Solved Exporter Issues

This file tracks exporter-related issues that have been fixed.

## Solved Issues

### Issue 1: logic.oaks_aide() not converted to helper call - FIXED ✓

**Status:** Fixed in commits f6cf38f, a8c863c

**Solution:**
1. Modified ast_visitors.py to add handler for `logic.method()` calls
2. Fixed elif chain structure in visit_Call so state handler doesn't block logic handler
3. Added filtering of `world` argument in _filter_special_args
4. Added resolution of binary_op and attribute expressions in logic method arguments

**Result:**
- Rule now correctly exports as `{"type": "helper", "name": "oaks_aide", "args": [{"type": "constant", "value": 25}]}`
- Test progresses from Sphere 3.7 to Sphere 3.9
- All three Oak's Aide locations (Route 2, Route 11, Route 15) now work correctly

---

### Issue 2: world.options expressions in entrance rules not resolved - FIXED ✓

**Status:** Fixed in latest commit

**Solution:**
1. Extended visit_UnaryOp in ast_visitors.py to resolve attribute expressions
2. Added logic to evaluate `not` operations on constants immediately
3. When operand of `not` is a `world.options.*.value` reference, resolve it to a constant first
4. Then evaluate `not constant` to produce a final constant value

**Affected Code:**
- Route 13 -> Route 13-E entrance rule: `not world.options.extra_strength_boulders.value`
- Now exports as `{"type": "constant", "value": true}` instead of undefined `world` reference

**Result:**
- Test progresses from Sphere 3.9 to Sphere 5.9!
- Safari Zone, Fuchsia City, Lavender Town, and Celadon City now properly accessible
- All 82 previously missing locations at Sphere 3.9 are now correctly recognized
