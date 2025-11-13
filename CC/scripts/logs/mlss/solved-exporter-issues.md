# Solved Exporter Issues

## Issue 1: StateLogic module name not resolved in worker context
**Problem**: MLSS Python code uses `StateLogic.super()`, `StateLogic.canDash()`, etc. The exporter correctly captured these as module-qualified function calls (e.g., `StateLogic.super`), but the worker-side snapshot interface's `resolveName` method only handled `'logic'`, not `'StateLogic'`.

**Solution**: Updated `frontend/modules/stateManager/core/statePersistence.js` line 390 to handle both `'logic'` and `'StateLogic'`:
```javascript
if (name === 'logic' || name === 'StateLogic') {
```

**Test Result**: Test now progresses from sphere 0.4 to sphere 3.10. The StateLogic helper functions are now accessible.

