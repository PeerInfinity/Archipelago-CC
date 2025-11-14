# Pokemon Red and Blue - Solved Helper Issues

*Last updated: 2025-11-14*

## Summary

**Fixed Issues:** 1

---

## Fixed Issues

### 1. can_learn_hm() doesn't recognize "Static" prefix on Pokemon

**Priority:** HIGH
**Status:** FIXED
**Date Fixed:** 2025-11-14

**Description:**
The `can_learn_hm()` helper function checked if the player had a Pokemon by checking `has(snapshot, staticData, pokemon)` where `pokemon` is the base name like "Magikarp" or "Lapras". However, static Pokemon (obtained as gifts or specific encounters) are stored with a "Static" prefix like "Static Magikarp" or "Static Lapras", causing the check to fail.

**Impact:**
- Can_surf, can_cut, can_fly, can_strength, can_flash all failed when only static Pokemon were available
- Blocked access to regions requiring HM moves

**Fix:**
Modified `can_learn_hm()` in `frontend/modules/shared/gameLogic/pokemon_rb/pokemon_rbLogic.js` to check for both base Pokemon name and "Static {pokemon}" prefix:

```javascript
for (const [pokemon, data] of Object.entries(local_poke_data)) {
  // Check for both base Pokemon name and "Static {pokemon}" prefix
  if ((has(snapshot, staticData, pokemon) || has(snapshot, staticData, `Static ${pokemon}`))
      && data.tms && data.tms[6]) {
    // Check if the Pokemon can learn this HM
    if (data.tms[6] & (1 << (moveIndex + 2))) {
      return true;
    }
  }
}
```

**Result:**
- Helper now correctly recognizes static Pokemon as valid HM users
- Combined with the exporter fix, all HM-based helpers now work correctly
