# Pokemon Red and Blue - Solved Exporter Issues

This file tracks exporter-related issues that have been fixed.

## Solved Issues

### Issue 1: logic.oaks_aide() not converted to helper call - FIXED ✓

**Status:** Fixed in commit f6cf38f

**Solution:**
1. Modified ast_visitors.py to add handler for `logic.method()` calls
2. Fixed elif chain structure in visit_Call so state handler doesn't block logic handler
3. Added filtering of `world` argument in _filter_special_args
4. Added resolution of binary_op and attribute expressions in logic method arguments

**Result:**
- Rule now correctly exports as `{"type": "helper", "name": "oaks_aide", "args": [{"type": "constant", "value": 25}]}`
- Test progresses from Sphere 3.7 to Sphere 3.9
- All three Oak's Aide locations (Route 2, Route 11, Route 15) now work correctly
