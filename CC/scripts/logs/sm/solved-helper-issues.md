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
