# Super Metroid - Solved Helper Issues

*Last updated: 2025-11-27*

## Overview

This document tracks helper function issues that have been fixed in `frontend/modules/shared/gameLogic/sm/smLogic.js`.

## Solved Issues

### 1. enoughStuffGT - Golden Torizo damage calculation (Seed 3)

**Problem:** The `enoughStuffGT` function only checked for Charge Beam, but the Python version also allows beating Golden Torizo with enough Super Missiles alone.

**Root Cause:** Misunderstanding of `ignoreMissiles=True` parameter - it only ignores regular Missiles, not Super Missiles.

**Solution:** Updated to calculate actual damage:
- Charge beam alone is sufficient (infinite charged shots)
- Charge + Plasma allows boss drops (always beatable)
- Super Missiles: count * 5 * 300 damage >= 9000 (need 6+ packs)

**File:** `frontend/modules/shared/gameLogic/sm/smLogic.js:584-624`

### 2. canDefeatBotwoon - Damage calculation (Seed 5)

**Problem:** The `canDefeatBotwoon` function used a simplified combo check `(4 Missiles + 2 Supers)` that didn't verify total damage was >= 6000.

**Root Cause:** The combo check passed with 5 Missile packs + 2 Super packs = 5500 damage < 6000 needed.

**Solution:** Changed to calculate actual total damage:
- Charge beam alone is sufficient
- Missiles: count * 5 * 100 damage
- Supers: count * 5 * 300 damage
- Total must be >= 6000

**File:** `frontend/modules/shared/gameLogic/sm/smLogic.js:1214-1250`

### 3. knowsCrocPBsDBoost and knowsCrocPBsIce - Always returning true (Seed 8)

**Problem:** Both functions always returned `{bool: true, difficulty: 0}` regardless of preset settings.

**Root Cause:** These knows techniques are disabled in the regular preset (`[False, 0]`), but the implementation didn't check settings.

**Solution:** Updated both functions to read from `staticData.settings[playerId].knows` and default to disabled.

**File:** `frontend/modules/shared/gameLogic/sm/smLogic.js:1010-1034`

### 4. canPassRedKiHunters and canPassThreeMuskateers - Missing super missile fallback (Seed 9)

**Problem:** Lower Norfair regions not accessible despite having 4 Super packs and Varia Suit.

**Root Cause:** Python's `canGoThroughLowerNorfairEnemy` allows using Super Missiles alone to kill enemies, but this fallback was missing in JavaScript.

**Solution:** Added Super Missile count check as a fallback option:
- Red Ki Hunters (n=3): need 4+ Super packs (5400 damage)
- Three Muskateers (n=6): need 8+ Super packs (10800 damage)

**File:** `frontend/modules/shared/gameLogic/sm/smLogic.js:2735-2779`
