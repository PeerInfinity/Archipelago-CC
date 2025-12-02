# Solved Helper Issues for Pokemon Red/Blue

This document tracks resolved issues with the Pokemon Red/Blue helper functions (`frontend/modules/shared/gameLogic/pokemon_rb/pokemon_rbLogic.js`).

## Solved Issues

### 1. can_learn_hm checking "Static" prefixed Pokemon incorrectly

**Date Solved:** 2025-12-02

**Problem:**
The `can_learn_hm` function was checking for both base Pokemon names (e.g., "Snorlax") AND "Static {pokemon}" variants (e.g., "Static Snorlax"). This was more permissive than Python's implementation.

When a player obtained "Static Snorlax" at sphere 3.22, our JavaScript incorrectly returned `true` for `can_learn_hm("Surf")` because it found "Static Snorlax" in inventory. However, Python's implementation only checks for the base name "Snorlax" (the key from `local_poke_data`), so it correctly returned `false`.

This caused Surf areas (Power Plant, Cinnabar Island, Seafoam Islands, etc.) to appear accessible at sphere 3.22 instead of sphere 3.40 (when "Kangaskhan" - without "Static" prefix - was obtained).

**Fix:**
Changed `can_learn_hm` to only check for exact Pokemon name matches from `local_poke_data`, matching Python's behavior:

```javascript
// Before (buggy):
const hasPokemon = has(snapshot, staticData, pokemon) || has(snapshot, staticData, `Static ${pokemon}`);

// After (fixed):
const hasPokemon = has(snapshot, staticData, pokemon);
```

**Files Modified:**
- `frontend/modules/shared/gameLogic/pokemon_rb/pokemon_rbLogic.js` (line 124-128)
