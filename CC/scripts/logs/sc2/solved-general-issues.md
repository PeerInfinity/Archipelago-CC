# Starcraft 2 - Solved General Issues

Last updated: 2025-12-22

## Summary
This document tracks general issues that have been resolved.

## Solved Issues

### 1. SC2 Game Logic Module Registration

**Issue:** SC2 game logic module needed to be registered with the game logic registry.

**Solution:** Created `sc2Logic.js` module:
- Exports helper functions from helpers.js
- Defines helper prefixes for faction-specific helpers
- Implements `wrapState()` for state enhancement
- Implements `initializeGameLogic()` for module initialization

**Files Modified:**
- `frontend/modules/shared/gameLogic/sc2/sc2Logic.js`

---

### 2. Power Rating State Enhancement

**Issue:** Some rules reference `power_rating` on state object.

**Solution:** Implemented `wrapState()` in sc2Logic.js to:
- Add computed `power_rating` based on settings
- Calculate base power rating from advanced_tactics setting

**Files Modified:**
- `frontend/modules/shared/gameLogic/sc2/sc2Logic.js`

---

### 3. Helper Prefix Resolution

**Issue:** Generic helper names (e.g., `defense_rating`) need to resolve to faction-specific helpers.

**Solution:** Exported `helperPrefixes` array:
- Includes 'terran_', 'zerg_', 'protoss_', 'nova_'
- Rule engine uses these to find faction-specific implementations

**Files Modified:**
- `frontend/modules/shared/gameLogic/sc2/sc2Logic.js`
