# Super Metroid - Solved Helper Issues

This document tracks resolved issues in the helper functions for Super Metroid (`frontend/modules/shared/gameLogic/sm/smLogic.js`).

## Solved Issues

### 1. canAccessShaktoolFromPantsRoom missing multiple access paths

**Status:** RESOLVED

**Description:** The JavaScript implementation of `canAccessShaktoolFromPantsRoom` was missing several access paths that exist in the Python implementation:

1. **Bomb + Infinite Bomb Jump path:** The Python implementation includes a path using `Grapple + Gravity + Bomb + (knowsAccessSpringBallWithBombJumps OR canInfiniteBombJump)`. This was completely missing from the JavaScript version.

2. **Gravity Jump path:** `knowsAccessSpringBallWithGravJump` was missing.

3. **Flatley Jump path:** `knowsAccessSpringBallWithFlatley` (suitless with SpaceJump) was missing.

4. **PuyoClipXRay path:** The Ice + Gravity + XRayScope + knowsPuyoClipXRay path was missing.

5. **SuitlessPuyoClip path:** The suitless version of the Puyo Clip was missing.

**Impact:** Spring Ball location was not accessible when using the Bomb + IBJ path, causing test failure at Sphere 4.4.

**Solution:**
1. Added new knows helper functions:
   - `knowsPuyoClipXRay`
   - `knowsSuitlessPuyoClip`
   - `knowsAccessSpringBallWithBombJumps`
   - `knowsAccessSpringBallWithGravJump`
   - `knowsAccessSpringBallWithFlatley`

2. Updated `canAccessShaktoolFromPantsRoom` to include all paths from the Python implementation:
   - Puyo clip path with all variants (regular, XRay, suitless)
   - Grapple block path with all movement options (HiJump, SpaceJump, GravJump, BombJumps/IBJ, Flatley)

**Python Reference:** `worlds/sm/variaRandomizer/graph/vanilla/graph_helpers.py:823-843`

### 2. canSpringBallJump missing knowsSpringBallJump check

**Status:** RESOLVED

**Description:** The JavaScript implementation of `canSpringBallJump` was missing the `knowsSpringBallJump` check that exists in the Python implementation.

**Python implementation:**
```python
def canSpringBallJump(self):
    return sm.wand(sm.canUseSpringBall(),
                   sm.knowsSpringBallJump())
```

**JavaScript (was incorrect):**
```javascript
export function canSpringBallJump(snapshot, staticData) {
  return canUseSpringBall(snapshot, staticData);
}
```

**Impact:** The JS implementation was too permissive, allowing suitless Maridia traversal (via `canDoSuitlessOuterMaridia`) even when the `SpringBallJump` technique was disabled in settings. This caused Yellow Maridia regions to be incorrectly marked as accessible at Sphere 3.5 when they shouldn't be (depending on settings).

**Solution:** Fixed `canSpringBallJump` to include the `knowsSpringBallJump` check:
```javascript
export function canSpringBallJump(snapshot, staticData) {
  return wand(snapshot, staticData,
    canUseSpringBall(snapshot, staticData),
    knowsSpringBallJump(snapshot, staticData));
}
```

**Python Reference:** `worlds/sm/variaRandomizer/logic/helpers.py:239-242`

### 3. knowsSpringBallJumpFromWall always returning true

**Status:** RESOLVED

**Description:** The JavaScript implementation of `knowsSpringBallJumpFromWall` was hardcoded to return `{ bool: true, difficulty: 0 }` instead of checking the knows settings.

**Impact:** The JS implementation was too permissive, allowing access to Norfair Reserve Tank area via `canEnterNorfairReserveAreaFromBubbleMoutain` even when the `SpringBallJumpFromWall` technique was disabled. This caused a mismatch at Sphere 2.4 where Reserve Tank, Norfair and related locations showed as accessible when they shouldn't be.

**Solution:** Fixed `knowsSpringBallJumpFromWall` to check the knows settings properly.

### 4. canPassZebetites missing knows checks and incorrect missile threshold

**Status:** RESOLVED

**Description:** The JavaScript `canPassZebetites` function was missing knowledge checks for Ice and Speed zebetite skips, and was too permissive with its thresholds.

**Impact:** The JS was too permissive, allowing zebetite passage with just Ice or SpeedBooster without the required technique knowledge.

**Solution:**
1. Added `knowsIceZebSkip` and `knowsSpeedZebSkip` helper functions
2. Fixed `canPassZebetites` to require proper knowledge checks and correct damage threshold (1100 damage from missiles only)

### 5. enoughStuffsMotherbrain ignoring MB1 charge limitation

**Status:** RESOLVED

**Description:** The JavaScript `enoughStuffsMotherbrain` function incorrectly returned true with just Charge beam, ignoring that Mother Brain Phase 1 cannot be hit by charge beam.

**Impact:** Mother Brain showed as accessible when the player had Charge beam but insufficient ammo for MB1 (needs 3000+ damage from missiles/supers).

**Solution:** Added check that MB1 requires 3000+ ammo damage regardless of Charge beam.

**Python Reference:** `worlds/sm/variaRandomizer/logic/helpers.py:709-733`
