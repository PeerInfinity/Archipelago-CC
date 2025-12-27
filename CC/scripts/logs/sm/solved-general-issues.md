# Super Metroid - Solved General Issues

## Issue 1: Non-Advancement Items Not Added to Inventory in Spoiler Test Mode

**Date Solved:** 2025-12-27

**Symptom:**
- Spoiler test failing at Sphere 0.2 with "Bomb" location not accessible
- All inventory items showing 0 count despite locations being checked
- Items like Missiles not being added to inventory after checking locations

**Root Cause:**
The SM exporter correctly exports `count_non_advancement_items: true` to `world[player_id]`, but the frontend location checking code was looking for it in `settings[player_id]`. This caused non-advancement items (like most Missile pickups) to be skipped in spoiler test mode.

In Super Metroid, Missiles (and other ammo items) are often classified as non-advancement items when randomized, but they ARE required for logic (opening red doors, defeating enemies, etc.).

**Files Modified:**
- `frontend/modules/stateManager/core/locationChecking.js`

**Fix:**
Updated the lookup to check both `world` (where game-specific exporters put settings) and `settings` (legacy location):

```javascript
// Before:
const countNonAdvancement = sm.rules?.settings?.[currentPlayerId]?.count_non_advancement_items ?? false;

// After:
const countNonAdvancement = sm.rules?.world?.[currentPlayerId]?.count_non_advancement_items ??
                            sm.rules?.settings?.[currentPlayerId]?.count_non_advancement_items ?? false;
```

**Verification:**
- `npm test --mode=test-spoilers --game=sm --seed=1` now passes all spheres
