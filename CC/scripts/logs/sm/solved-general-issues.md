# Super Metroid - Solved General Issues

## Issue 1: State snapshot missing `smbm` property - SOLVED

**Symptom:**
- Locations "Energy Tank, Brinstar Ceiling" and "Morphing Ball" failed to be accessible in Sphere 0
- Error: "Access rule evaluation failed"

**Root Cause:**
The access rules referenced `state.smbm[1].maxDiff` but the state snapshot didn't include the `smbm` property. The `smStateModule.initializeState()` created a state with `smbm`, but the `getSnapshot()` function only included `flags` and `events` from the game state, not `smbm`.

**Solution:**
Added a `getStateForSnapshot()` method to `smStateModule` in `frontend/modules/shared/gameLogic/sm/smLogic.js` that returns all game-specific state fields including `smbm`:

```javascript
getStateForSnapshot(gameState) {
  return {
    flags: gameState.flags || [],
    events: gameState.events || [],
    smbm: gameState.smbm || {
      1: { maxDiff: 999 }
    }
  };
}
```

**File:** `frontend/modules/shared/gameLogic/sm/smLogic.js:273-281`

**Result:**
The two locations that should be accessible in Sphere 0 are now correctly accessible.
