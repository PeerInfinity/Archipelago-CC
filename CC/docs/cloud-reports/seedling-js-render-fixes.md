# Cloud report — `seedling-js-render-fixes`

For the coordinator `seedling-js-planning-13`. Cloud worker, 2026-10-30.

- **Branch:** `claude/seedling-js-render-fixes-2fhm1h` (the harness pinned this branch; `seedling-js-render-fixes` was not used).
- **Base:** `origin/main` @ `9c0f9045`.
- **Commits:** `70eb5936` (the tinter), `23a6951a` (the ice turret), then this report as the last commit.
- **Stopped on:** nothing.

## 1. `createTinter` moves into the shared renderer

| File | Change |
|---|---|
| `frontend/modules/seedlingDemo/seedlingSkinRenderer.js` | New `export function createTinter(doc = globalThis.document)`, placed right after `paintOps`. The body is the page's old `tinted`, op for op. The G2 `Image.as` comment and the G9c silhouette comment are kept. |
| `frontend/modules/seedlingDemo/jsRuntimePage.js` | The private `tintCache` and `function tinted` are deleted. `const tinted = createTinter(doc)` now sits right after `const doc = win.document`. |
| `frontend/modules/mazeRoom/mazeSeedlingSkin.js` | The maze's own copy of `createTinter` is deleted. |
| `frontend/modules/mazeRoom/mazeRoomUI.js` | It now imports `createTinter` from `../seedlingDemo/seedlingSkinRenderer.js`. The call at `:3993` is unchanged. |

- **Why `const tinted` moved up.** The old `tinted` was a hoisted `function`. A `const` left at the bottom of `mountJsRuntimePage` would be in its TDZ if anything painted before mount reached that line, so it now goes right after `doc`.
- **Import direction.** `mazeRoom → seedlingDemo/seedlingSkinRenderer.js` already existed: `mazeSeedlingSkin.js:26` and `mazeSeedlingSprites.js:31` both import it. I also walked the renderer's import closure: it is `seedlingSkinRenderer`, `rectPalette`, `seedlingProfile`, `profileOverrides`, `md5`, `seedlingPixelMasks`, `flashPanel/seedlingSemantics`, `seedlingEntityColliders` and `seedlingBlockPaths`. None of these is a `mazeRoom` file, so the move creates **no import cycle**.
- **Behaviour is unchanged.** The page gets the same ops and the same `WeakMap → Map` cache per (img, tint). The maze's copy had the same ops but no G9c comment.
- **Old pins.** `mazeSeedlingSkin.test.js` never pinned `createTinter`, so no pin had to move.

**Pin:** `seedlingSkinRenderer.test.js` §4b, *"the tinter … on a stub doc that records ops"*. It has 3 rows:
- **Multiply:** the full op list for a colour tint: `drawImage`, `globalCompositeOperation = multiply`, `fillStyle`, `fillRect`, `destination-in`, `drawImage`.
- **Silhouette:** `=colour` gives `source-in`, with the colour after the `=`, then `destination-in`.
- **Cache identity:** the same (img, tint) returns the same canvas. Another tint, another image, or another tinter each makes a new canvas, and `doc.createElement` is counted.

**Mutant:** `'multiply'` changed to `'source-over'` in the renderer. Result: **1 failed, 2 passed** in §4b. Reverted afterwards.

## 2. The IceTurret on the JS page

| File | Change |
|---|---|
| `frontend/modules/seedlingDemo/seedlingRoomBodySkin.js` | New `export const ROOM_BODY_OBJECT_TAGS = Object.freeze(new Set(['iceturret']))`, the same shape as `HAZARD_OBJECT_TAGS`. New `export function roomBodyDrawnObjects(bodyOps, tags = ROOM_BODY_OBJECT_TAGS)`: it returns true for a tagged object only when `bodyOps` is non-empty. That is the lab's rule: a skin that drew nothing keeps its stand-ins. `tags` is the seam for the mutant. |
| `frontend/modules/seedlingDemo/jsRuntimePage.js` | `const roomBodyDrawn = roomBodyDrawnObjects(bodySprites)` is ORed into the `drawnObjects` predicate that the page passes to `roomOps`. |
| `frontend/modules/seedlingDemo/watchArt.js` ⚠ **LAB FILE** | For `seedling-lab-planning-1`: `FAMILY_OBJECT_TAGS.roomBody` now *is* `ROOM_BODY_OBJECT_TAGS` (it had its own `new Set(['iceturret'])`). The import line gains that name, and the comment no longer says the page "keeps it". `labDrawnObjects`'s rule is untouched, so the lab draws the same. `watchArt.test.js` has 46/46 green, and its goldens are unchanged. |

### A dead turret loses no wall picture

These lines are from `vendor/seedling/src/Enemies/IceTurret.as`:
- **`:92-95`:** `else if(!collide("Player", x, y)) { type = "Solid"; }` is the else-arm of `if (sprIceTurret.currentAnim != "dead")` (`:62`). So the corpse wall is only a change of collision **type** on the same entity. It has no separate graphic.
- **`:135-147`:** `death()` calls `setHitbox(16, 16, 8, 8)` and `play("dead")`. **`:42`:** `add("dead", [6])`.
  - So in the game, the dead turret is the turret sprite at frame 6, and that sprite is the wall.
  - The page already draws it that way: `roomBodySkinView` keeps every turret that is not `removed`, dead ones included, and `roomBodyOps` pushes the dead turret with its 16x16 box and frame 6 (`ICE_TURRET_DEAD_FRAME`, `seedlingRoomBodySkin.test.js` §3).
- **The old stand-in never showed the wall anyway.** It was the alive 32x32 rect (`levelWorld.js` `iceturret` row: *"`solid.rect` here is the ALIVE 32x32 body and `liveRectOf` never returns it"*). It never matched the 16x16 corpse box.
- **A turret that is fully `removed`** draws no op. If nothing else in the room-body family drew, the stand-in stays, which is the lab's behaviour. If something else drew, it goes, which is correct: a removed entity is no wall.

**Pin:** `seedlingRoomBodySkin.test.js` §7, *"the ice turret's corpse-wall stand-in"*. It boots L40 at (488,464) and L98 at (100,80) on the JS runtime, runs 5 idle ticks, then composes the page's paint: `roomOps(run.world, art, { entitySprites: roomBodyOps(...), drawnObjects: roomBodyDrawnObjects(bodyOps) })`. Golden per room:

| Room | turrets | turret sprites | stand-ins | mutant stand-ins |
|---|---|---|---|---|
| L40 | 1 | 1 | **0** | **1** |
| L98 | 1 | 1 | **0** | **1** |

The mutant drops `iceturret` from the set, and the stand-in comes back in both rooms, so the golden goes red. A third row pins the rule itself: empty ops keep the stand-in, and a non-tagged object is never hidden.

## Gates

- **Bounded vitest:** `seedlingSkinRenderer.test.js` (24), `seedlingRoomBodySkin.test.js` (34), `mazeSeedlingSkin.test.js` (14), `mazeSeedlingSprites.test.js` (14) and `watchArt.test.js` (46). Result: **5 files, 132/132 passed**. The §5 STATE IDENTITY row in `seedlingSkinRenderer.test.js` is untouched and green.
- **`generate-procgen-reference.mjs --check`:** **ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE.** No doc or generated module cites the moved function.
  - ⚠ The first run showed 4 FAILs (`registry.js`, `capabilities.js` and two capability-matrix regions). The same 4 failed on a clean `origin/main`.
  - The cause was environmental: `scripts/cloud/session_bootstrap.sh --seedling` does not check out the `frontend/modules/bulletml-dodge` submodule, so noiz2sa never registers.
  - After `git submodule update --init frontend/modules/bulletml-dodge`, everything matched, and no `--write` was needed. The gitlink was not moved. It may be worth adding that submodule to the bootstrap.
- **In-app look:** headless Chromium against `scripts/serve-nocache.py 8000`, on `jsRuntime.html?graphics=seedling&camera=follow`. Each room was booted through `__swfBridge.queueItems` (`new_instance Game [level, x, y]`).
  - "Before" is the same tree with only `jsRuntimePage.js` checked out at `9c0f9045`, then restored.
  - The paint's `__seedlingJsGraphics.counts`:

| Room | before | after |
|---|---|---|
| L40 | ops 3089, rects **1** | ops 3088, rects **0** |
| L98 | ops 200, rects **2** | ops 199, rects **1** |

  - Each room drops exactly one op and one rect: the stand-in. L98's remaining rect was already there and is not ice-turret related.
  - No page errors.
  - **Screenshots** (the pale 32x32 box behind the turret is gone in "after"):
    - `seedling-js-render-fixes/L40-before.png`, `L40-after.png`
    - `seedling-js-render-fixes/L98-before.png`, `L98-after.png`
- **CI:** JSUT and unittests run on push to the branch, and the coordinator reads them by SHA. ⚖ Following ruling 52, the full suite was not run here.

## Limits kept

- The renderer only reads. There are no sim, solver, glue, wasm, flashPanel or `levelRun` edits, and `cosmeticRand` is untouched.
- Main was not pushed.
