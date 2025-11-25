# SMZ3 Solved Exporter Issues

This document tracks exporter issues that have been resolved for the SMZ3 game.

## Resolved Issues

### Issue 1: Regressive key requirements in Palace of Darkness (2025-11-25)

**Problem:** Palace of Darkness locations (e.g., Dark Maze - Bottom) have "anti-softlock" key logic where acquiring certain items (Bow+Hammer) INCREASES the key requirement from 5 to 6. This created a semantic mismatch between Python's cumulative sphere calculation and JavaScript's real-time rule evaluation.

**Root cause:** The exported rules preserved the conditional `KeyPD >= (6 if Bow+Hammer else 5)`. When a player gained Bow+Hammer after a location was marked accessible (with 5 keys), JavaScript would re-evaluate and determine it was no longer accessible.

**Fix:** Modified `postprocess_rule` in `exporter/games/smz3.py` to always simplify regressive conditionals (where `if_true > if_false`) to use the minimum value. This ensures that once Python marks a location accessible, JavaScript agrees.

**Files changed:** `exporter/games/smz3.py`

---

### Issue 2: any_of ItemIs evaluation for Ganon's Tower (2025-11-25)

**Problem:** Ganon's Tower locations with `any(loc.ItemIs(type) for type in [...])` patterns were being incorrectly evaluated at export time. The `any_of` rule wasn't properly checking if the placed item matched any of the types in the iteration list.

**Root cause:** The exporter code only handled `constant` types in the iterator, but the actual values were `attribute` types (e.g., `ItemType.KeyGT`).

**Fix:** Extended the `any_of` handling in `postprocess_rule` to:
1. Handle both `constant` and `attribute` types in the iterator
2. Properly evaluate `ItemIs` for each type using the current location object
3. Return a constant boolean based on whether any type matched

**Files changed:** `exporter/games/smz3.py`
