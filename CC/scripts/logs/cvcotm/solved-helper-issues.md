# Solved Helper Issues for Castlevania - Circle of the Moon

## Issue 1: has_ice_or_stone helper missing DSS requirement ✓
**Status**: Solved
**Priority**: High
**Description**: The `has_ice_or_stone` helper function was incomplete and caused locations to be accessible too early.

**Failing Test**:
- Spoiler test failed at Sphere 1.1
- Locations incorrectly accessible:
  - "Catacomb: Fleamen brain room - Upper"
  - "Outer Wall: Right-brained ledge"

**Root Cause**:
The JavaScript helper `has_ice_or_stone` only checked:
```javascript
return !!(snapshot?.inventory?.['Cockatrice Card'] || snapshot?.inventory?.['Serpent Card']);
```

But the Python logic requires:
```python
state.has_any([iname.serpent, iname.cockatrice], self.player) and \
    state.has_any([iname.mercury, iname.mars], self.player)
```

**Solution**:
Updated `has_ice_or_stone` in `frontend/modules/shared/gameLogic/cvcotm/cvcotmLogic.js` to require BOTH:
1. Serpent Card OR Cockatrice Card
2. Mercury Card OR Mars Card

**Implementation**:
```javascript
'has_ice_or_stone': (snapshot, staticData) => {
    // Valid DSS combo that allows freezing or petrifying enemies to use as platforms
    // Requires (Serpent OR Cockatrice) AND (Mercury OR Mars)
    const hasStoneOrSnake = !!(snapshot?.inventory?.['Cockatrice Card'] ||
                               snapshot?.inventory?.['Serpent Card']);
    const hasMercuryOrMars = !!(snapshot?.inventory?.['Mercury Card'] ||
                                snapshot?.inventory?.['Mars Card']);
    return hasStoneOrSnake && hasMercuryOrMars;
},
```

**Verification**:
- Spoiler test now passes all 15 events across 4 spheres
- Locations are correctly gated until player has both card types
- Sphere 1.1: Player gets Serpent Card - locations correctly NOT accessible
- Sphere 1.3: Player gets Mars Card - locations correctly become accessible

**Files Modified**:
- `frontend/modules/shared/gameLogic/cvcotm/cvcotmLogic.js:68-76`
