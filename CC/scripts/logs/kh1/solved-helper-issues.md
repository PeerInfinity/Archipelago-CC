# Solved Helper Issues - Kingdom Hearts

## Issue 1: has_emblems Helper - Wrong World Count

**Problem**: The `has_emblems` helper in `kh1Logic.js` was using `has_x_worlds(5)` instead of `has_x_worlds(6)` as specified in the Python code.

**Solution**: Changed line 117 in `frontend/modules/shared/gameLogic/kh1/kh1Logic.js` from:
```javascript
return this.has_x_worlds(snapshot, staticData, 5, keyblades_unlock_chests);
```
to:
```javascript
return this.has_x_worlds(snapshot, staticData, 6, keyblades_unlock_chests);
```

**Files Modified**: `frontend/modules/shared/gameLogic/kh1/kh1Logic.js`
