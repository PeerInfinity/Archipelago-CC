# Seedling fidelity DESCENT: a fall's descent fires a live door it crosses (model + solver)

**Slice:** `seedling-fidelity-descent`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning-2`).

⚖ **The user** (2026-10-05): *"… Disabling the moon rock event was the right choice, but it looks like we didn't need to change the fall target. And so I think your recommended option 'No repoint + model fix' is correct."* This slice is that model fix.

| | |
|---|---|
| Started from | `origin/fidelity-harvest/wave2` @ **`47fb574643066ea32cc6d4f92cd8abc2b48dfe06`**, as briefed |
| Head | the last commit on the branch (this report is committed last) |
| Branches | local `seedling-fidelity-descent`; pushed to the harness branch **`claude/fall-teleporter-descent-a0ut6g`** |
| Commits | D1 `8329f80` · D2 `b7e2d35` · D3 `d7c9d8c` · D4 `1c63b76` · this report |
| Dev server | `serve-nocache.py 9250` (this tree) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS (no contract change) · D4 PASS** |

## The one thing to know first

**The fix is one guard: the model's in-flight refusal now covers the fall-out only.** The descent is the new `Game`'s arrival animation, not a transport in flight. On the game, a live door the descending player overlaps simply fires, and the run arrives on the ground at that door's target. With that one guard narrowed, the existing transition machinery reproduces the game exactly, 0 px, on:
- every descent arm (6);
- every fall arm of the moonrock oracle (rock unset and set, built-in and delivered, the approved repoint).

**The census:** L110's pit is the **only** fall in the atlas that lands under a door, out of 39 (pit, ctor) pairs over 12 levels. It goes L0 `stairsdown@256,272` → L2 (48,32).

**The latch is settled by a discriminator the atlas does not contain.** A probe world puts the landing tile and the 83-px drop on two different doors. The game fires the door under the drop on the first update, which proves the arrival frame's `Teleporter.check()` saw the player at the ctor position. That is what `arriveFromFall` already transcribed. The mutant that latches at the drop goes to L3 instead.

## W0 (at `47fb574643`, before any edit)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9250 bash scripts/procgen/identity-block.sh .` on this tree, pristine | exit 0, log md5 **`aa46950b5958b32136111155250dd253`** (= the MOONROCK / STEP-OFF / L14 published value) |
| six `--check`s | the block's producer loop | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 b29b589b`, **all exit 0** |
| reference | the block's last row | ALL 7 + 5 MATCH |
| surface / constants / entities / profile | the four `--check`s | **GREEN 195** · **PASS 4,966** (0 drift) · **PASS 518** · **PASS 138** (both JSONs) |
| roster | `fixtures/tapes/index.json` (md5 `9cb65768…`) | **209** tapes |
| bounded vitest BEFORE | 20 files: `decisionTrace`, `entityBlocks`, `fidelityMoonrock`, `fidelityStepOff`, `jsRuntimeDeclarations` (read-only), `levelRun`, `levelWorld`, `playerPhysicsV2`, `seedlingSetPatches`, `shoveWeighParity`, `solverBot`, `solverBotLethalPit`, `solverEncounter`, `solverReachPit`, `tapeRunner`, `watchGenOverlay`, `boxLock`, `lintGateLabels`, `seedlingConstantsCensus`, `seedlingSolverSurface` | **20 files / 1,161 tests, all green**; sorted `(fullName, status)` md5 **`d67014338d39e5011fe61566f0d78ae2`** |
| tapeRunner | inside it | **475/475**, pair md5 **`4bbf900b77a0a081967990ce545e7c7c`** |
| the moonrock oracle's fall arms through the model at the base | `fidelityMoonrock.test` (green at W0) + this slice's D1 recording at the base model | every fall arm refuses: *"a teleporter at (256,272) fired in level 0 while a pit transport was in flight (phase "descent"). Which world swap wins is not transcribed — route the tape so a trigger volume and a pit tile are never overlapped together."* (`(48,16) … level 2` on the approved repoint) |

⚠ The refusal lives in **`playerPhysicsV2.step`** (`:1106`, and a second, unreachable copy in the descent arm `:1180`), not in `levelRun`'s transitions. `levelRun`'s swap tail (`:17221-17267`) already handles a teleporter transition from any state.

## D1 — the game's rule (PASS: AS3 read, then measured)

**The AS3** (read-only):
- **The swap.** `Player.checkFallingInPit` (`Player.as:745-772`): at `alpha <= 0` it computes `x/y = floor(max(fallInPitPos − fallthroughOffset, 0)/16)·16`, sets `Game.setFallFromCeiling = true`, and calls `FP.world = new Game(fallthroughLevel, x, y)`.
- **The arrival.** `loadlevel` (`Game.as:2227-2254`) builds the `Player` at the ctor and sets `player.fallFromCeiling = setFallFromCeiling`. The flag is reset at `:2430`.
- **The first frame.** `Game.update` runs `check()` on every entity. The doors were added after the player, and `World.addUpdate` prepends, so **the doors' `Teleporter.check()` runs first** and sees the player at the ctor tile's centre: `if (collide) playerTouching = true`. Then `Player.check()` (`Player.as:437-442`) sets `y = FP.camera.y − (height − originY)`, an 83 px lift.
- **The descent.** `Player.update`'s `if (fallFromCeiling)` arm (`:499-526`) is `v.y += 0.1; v.y = min(v.y, 5); y += v.y`, and nothing else. `Player.input()` returns while `fallFromCeiling` (`:1521`), so **the player cannot act**.
- **The fire.** `Teleporter.update` (`Teleporter.as:89-118`) has **no `fallFromCeiling` guard**. It runs `checkDeactivated(); if (deactivated) return;`, then on an overlap fires if not `playerTouching`; otherwise `playerTouching = false`.
- **Stairs.** `Stairs.update` is `super.update()`.
- **The new room.** The door's `FP.world = new Game(to, playerx, playery)` is built without `setFallFromCeiling`, so the new room's arrival is the door's own `playerx/playery` + 8, **on the ground**, and the fall is over.

**Measured** (`probe-seedling-descent.mjs --record`, p4f headless logic-only, one fresh page per arm, `fixtures/descent-oracle.json`):

| arm (tape / world) | game transitions | what it settles |
|---|---|---|
| `fall` / built-in | L110 → L0 **t27** at (264,197); L0 → L2 **t66** at (56,40); final L2 (56,40) | the descent's start: the ctor (256,272) + 8, lifted 83 px; the stairs fire 39 updates into the descent; the arrival is the door's `playerx/playery` (48,32) + 8, on the ground |
| `fall` / delivered (`329dd9d9`) | identical stream, frame for frame | the delivered set (no moonrock) is the same game |
| `fallAct` / built-in (`left` held t12–t150) | the same transitions at the same ticks; **x = 264 on every observation t27–t65**; every observation before t66 identical to `fall`; final L2 (34.05,40) | the player cannot act during the fall-out or the descent; input is live again in L2 |
| `fall` / delivered:approved (L110 → L2 (48,32)) | L110 → L2 t27 at (56,−43); L2 → L0 **t61** at (264,264) | a door the descent crosses FROM ABOVE, unlatched, fires. A second, different door (stairsup) |
| **`fall` / delivered:latch-probe** (L110 → L2 (48,96), probe world) | L110 → L2 t27 at **(56,21)**; L2 → L0 **t28** at (264,264) | **THE LATCH.** The landing tile is ON `teleporter@48,96` (→ L3) and the drop is ON `stairsup@48,16` (→ L0). The stairs fire on the very first update, so they were not latched: `check()` saw the CTOR position. Latched at the drop, the run would go to L3 |
| `solver` / built-in (D3) | L110 → L0 t194; L0 → L2 t233; final L2 (56,40) | the solver's plan, below |

So the latch state of a fall arrival is **armed for a door under the landing tile, and released by the first descent update** (83 px up), whenever the door has not already fired. For L110 the stairs are latched on the arrival frame, released on t28, and fired on t66.

**The census** (`fidelityDescent.censusFallsOntoDoors`, by the model's own descent): every pit tile of every level whose pits fall, × every one of its 256 pixels as `fallInPitPos`, gives the distinct ctors.

| from | pit tile | → level | ctor | door on the descent |
|---|---|---|---|---|
| 12 | (576,688) | 21 | (80,80) | — |
| 16 | (192,48) (192,64) (208,48) (208,64) (208,80) (224,48) (224,64) | 17 | (112,32) (112,48) (128,32) (128,48) (128,64) (144,32) (144,48) | — |
| 30 | (48,224) | 31 | (48,544) | — |
| 32 | (64,0) (80,0) | 30 | (224,80) (240,80) | — |
| 40 | 12 tiles at x ∈ {224,240,368,384}, y ∈ {432…480} | 43 | 12 ctors at x ∈ {64,80,208,224}, y ∈ {320…368} | — |
| 48 | (176,48) | 49 | (32,32) | — |
| 56 | (96,16) | 57 | (96,160) | — |
| 70 | (32,32) (one tile, two ctors) | 69 | (48,112) (48,128) | — |
| 71 | (192,208) | 82 | (160,272) | — |
| 83 | (32,16) | 84 | (32,32) | — |
| 84 | 9 tiles (16–48, 16–48) | 85 | 9 ctors (32–64, 48–80) | — (L85's `teleporter@80,0` is one tile right of the nearest column, x = 64) |
| **110** | **(64,64)** | **0** | **(256,272)** | **`stairsdown@256,272` → L2 (48,32): latched on arrival, fired at descent tick 39** |

That is **39 (pit, ctor) pairs over 12 levels, 0 skipped, 1 onto a door**, and the delivered set's census is identical. No pit falls onto a deactivated door, and no fall lands on a door it cannot leave.

## D2 — the model (PASS)

`playerPhysicsV2.step` (`b7e2d35`):
- **The in-flight refusal** (`:1116`) now reads `if (fired.length > 0 && fall && fall.phase !== 'descent')`. The FALL-OUT keeps its refusal and its words. L100's door on a pit tile is still refused, and is still unmeasured.
- **The descent arm** (0b) no longer throws on a transition. It computes the descent tick (the old player's last, never-observed step, in the old level, as every swap does) and returns `transition` with `fall: null`.
- **`levelRun`** then arrives the run through `arriveIn` (the door's `playerx/playery`), the same tail every teleporter takes. No `levelRun` line changed.

| witness | model vs game |
|---|---|
| the six `descent-oracle` arms | **stream-identical** (`fidelityDescent.test` "every arm …") |
| the moonrock oracle: `fall` and `fallRockSet` × built-in, delivered, unpatched, approved, off-stairs; `shield` × all | **15/15 stream-identical** (scratch comparison). `fidelityMoonrock.test` now pins `fall` / `fallRockSet` × {built-in, delivered} and `fall` / approved |
| `playerPhysicsV2.test` (2 new rows) | a descent onto L83's `teleporter@32,64`: latched at the arrival, released on the first update, fired with `kind: 'teleporter'`, `fall: null`, x frozen while `left`+`down` are held. A deactivated door on the column: no transition, and the fall lands |

**Mutants** (predicted first; copy → edit → run → copy back; `playerPhysicsV2.js` md5 `543eeb9f…` restored each time):
- **M1, the old refusal restored** (`&& fall.phase !== 'descent'` removed). Predicted 5 red: descent MODEL=GAME, census, moonrock ×2, the `playerPhysicsV2` descent-latch row. **Measured 5/98 red, exactly those, with the old words**: *"a teleporter at (256,272) fired in level 0 while a pit transport was in flight (phase "descent"). Which world swap wins is not transcribed …"*
- **M2, the fall's latch armed at the dropped y** (`initialLatch(level, x, yStart − DESCENT_DROP)`). Predicted 3 red: descent MODEL=GAME (the latch probe), census (`latched: []`), the `playerPhysicsV2` latch row. **Measured 3/573 red** (tapeRunner included, unmoved). The latch probe goes **L2 → L3 at t66**; the game goes to L0 at t28.

## D3 — the solver (PASS; no contract change)

**What the goal API does.** `solveSegment` does not accept "reach L2 via the pit":
- `reach-pit`'s identity is the pit TILE (`{kind: 'reach-pit', pit: {tx, ty, x, y}}`, `assertGoal`), and nothing in it names a destination.
- **The caller asks for the pit and reads the chained landing.** That is the least change, and it needs no new goal field.

**`solverBot.js`** (`d7c9d8c`): the pit executor counts `run.transitions` across `coastThroughTransport`. When a door fired during the coast, the record gains:

```js
{ goal: 'reach-pit', to: 0, t: 194, coast: 39,
  chained: { via: [{ t: 233, from_level: 0, to_level: 2 }], ends: { level: 2, x: 56, y: 40 } } }
```

- `to` stays the control's level (where the pit falls).
- `chained` is written **only** when a chain happened, so every other record is byte-identical. `solverReachPit` (`{… to: 31, t: 98, coast: 80}`) and `solverEncounter` (`{… to: 30, t: 962, coast: 80}`) hold unchanged.
- `out.transitions` carries both swaps either way.
- `coastThroughTransport` needed no change: the door's arrival clears `run.state.fall`, so the coast stops at the chained arrival.
- No signature or contract moved: `solveSegment`, `PendingDeclaration`, `createRunForStaging`, `twoPassSolve`.

**The plan** (`fidelityDescent.descentSolverArm`):
- **The run:** a fresh JS-runtime boot at L110's only arrival (L101's `teleporter@104,24` → L110 (48,112)), then `reach-pit (4,4)`. **233 t**: 110 → 0 at t194, 0 → 2 at t233. It ends in **L2 (56,40)**, i.e. door arrival (48,32).
- **At the base this solve could not run:** the model's in-flight refusal threw inside its coast (M1 restores that).
- **The game witness** is the probe's `solver/builtin` arm. The tape is `buildStagedTape` of the solve's own `perTick`. On the game it runs L110 (56,120) → L0 t194 → L2 t233 → final **L2 (56,40)**, model worst **0 px**.
- **The re-record:** the five D1 arms re-recorded in the same oracle with **identical game streams**.

**Mutant M3**, `chained` never written. Predicted 1 red (the record row). **Measured 1/22.** Restored (`solverBot.js` md5 `55ba7151…`).

## D4 — records

**Committed tapes that fall onto a door: none, so there is no STOP.** At the base the model refused every descent-door fire, and all 209 committed tapes replay green there. So no committed tape crosses a descent door. The fix only touches paths that used to throw: the `fall: transition ? null : nextFall` and `transition` returns are reached only when a door fired. tapeRunner's 475 `(name, status)` pairs are md5-identical BEFORE and AFTER, and so is the fall-latch mutant M2's tapeRunner.

| Row | W0 (`47fb574`) | head | movers |
|---|---|---|---|
| identity log | `aa46950b…` | **`aa46950b5958b32136111155250dd253`, byte-identical** (`diff` empty) | **none** |
| six `--check`s | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 b29b589b`, all exit 0 | **identical**, all exit 0 | none |
| reference | ALL 7 + 5 MATCH | **ALL 7 + 5 MATCH** after regeneration; `check-procgen-docs` ALL CHECKS PASSED; the probe passes `check-procgen-help --in-place --only=` | instruments **342 → 343** (`probe-seedling-descent.mjs`); the docs index (the log entry, `seedling-bot.md`) |
| tapeRunner | 475, md5 `4bbf900b…` | **475, md5 `4bbf900b…`** | none |
| roster | 209 | **209** | none: the witnesses live in an oracle, not the roster |
| surface | GREEN 195 | **GREEN 195** (`--write` → `--check`) | site counts only: `run:level` 101→102, `run:state` 305→307, `run:transitions` 4→6, `state:x` 134→135, `state:y` 141→142. All are in `solverBot.js` (the `chained` read). No new row, nothing unclassified |
| constants | PASS 4,966, 0 drift | **PASS 4,966, 0 drift** after `--write` | the CSV re-written. 27 rows moved, all `playerPhysicsV2.step` line shifts plus the two edited lines' new hashes, all `structural`. No literal added or removed |
| entities / profile | PASS 518 / PASS 138 | **identical logs** (`cmp`) | none |
| bounded vitest | 20 files / 1,161, md5 `d6701433…` | **21 files / 1,172, all green** | − 1 row renamed (`fidelityMoonrock`'s refusal row → MODEL = GAME); + `fidelityDescent` (9), + 2 `playerPhysicsV2` rows, + the renamed row (12 added, 1 removed). Every other pair is unchanged |
| `boxLock`, `lintGateLabels` | green | **green** | `probe-seedling-descent.mjs` joins `guarded`: a static `playwright` import, and the take sits behind `isEntryPoint` |
| `reach-seedling-change --range=47fb574..HEAD` (an upper bound) | — | 36 producers | the six in the block are identical. The other 30 `--check`s were run at head: **23 green**, and 7 DRIFT that are byte-identical at the base (residue 4) |

`seedling-bot-log.md` gains `### Seedling fidelity DESCENT — a fall fires the door it lands on`, after L14, with three trap candidates. `seedling-bot.md`'s pit section gains the descent-door paragraph.

## For the rules arc: the exact rule

**A fall chains through a door if, and only if, the door is live and the descent column crosses it after the first update.**
- **The arrival.** A fall arrives at its ctor tile's centre (`floor(max(fallInPitPos − (control.x + xOff, control.y + yOff), 0)/16)·16 + 8`). The arrival frame's `Teleporter.check()` **latches** every door whose 16×16 rect that ctor box overlaps (positive area). Then the player is lifted 83 px.
- **The descent.** It is 41 ticks of ballistic y at a frozen x. A landing on ordinary floor bounces once, which adds 39 ticks inside the same column. The player cannot act, so it is an outcome, not a choice.
- **The fire.** Every door update reads the previous tick's position. No overlap **releases** a latch, and the 83 px lift releases the landing door on update 1. An overlap with a **live, unlatched** door **fires**: the run arrives on the ground at that door's `playerx/playery` + 8, and the fall is over. The landing door itself therefore fires when the descent comes back down onto it. L110 → L0 is exactly that, fired at descent tick 39.
- **Stairs and teleporters are identical.** Hidden teleporters (`show 0`) fire like visible ones.
- **What does NOT chain:**
  - a **deactivated** door (`tag ≥ 0` with persistence against it). It returns before either arm, so it neither fires nor releases;
  - a door outside the descent column;
  - the **fall-out** (the 20 ticks in the old room). It is still refused by name: L100's exit on a pit tile, unmeasured.
- **The atlas today.** Exactly one fall chains: **L110 (64,64) → L0 `stairsdown@256,272` → L2 (48,32)**, so the L110-pit → L2 edge is TRUE as an outcome. The L0 arrival is not a place the player can stand or act. It holds with the moonrock unset and set (set, it chains through the rock's Teleporter on the same tile and writes `{2,0}`; on the delivered set there is no rock). The census table is above, and `censusFallsOntoDoors(levels)` re-derives it for any set: a generated set, or a patched control.

## The JS arc's pins

**No pin of yours moves.** At head, 16 of your test files run read-only: **432 tests, 431 green**. The one red is `jsRuntimeVanillaDelivery` §5.18 (*"… the FIRST refusal is the solver's decline at L14"*), and it is **red at the base `47fb574` too**: same row, 1/8, measured in a pristine base worktree. That is the L14 slice's named pin of the decline it removed.
- `jsRuntimeDeclarations` 6 · `jsRuntimeSolver` 14 · `jsRuntimeCore` 12 · `jsRuntimeAtlas` 11 · `jsRuntimeSolveService` 14 · `jsRuntimeVerbs` 12 · `jsRuntimeArrivalOnDoor` 19 · `jsRuntimeWalker` 11
- `wasmArrival` 29 · `wasmArrivalComposite` 14 · `wasmWalkTape` 32 · `wasmPlayback` 53 · `seedlingWasmPlayback` 74 · `seedlingVanillaArmMap` 13 · `solverDeadline` 8 · `director` 108

What changes under you:
- **A live fall from L110 no longer refuses.** The MOONROCK report's ⚠ (*"a live fall from L110 on the playthrough will refuse in the model by the descent-teleporter name"*) is retired. The JS runtime's model run now chains L110 → L0 → L2 as the game does.
- **A `reach-pit` record may carry `chained: {via, ends}`.** It appears only for a fall whose descent fires a door, which today means L110's pit only. A consumer that maps `records[i].to` to "the level the segment ended in" is wrong for that one pit: read `chained.ends.level`, or `out.transitions.at(-1).to_level`.
- No JS-arc file was edited (`jsRuntime*`, `flashPanel/*`, `wasmArrival.js`, `wasmWalkTape.js`, the solver worker, `solveSegment`'s `prefix` admission).

## Deltas

- New:
  - `frontend/modules/seedlingDemo/fidelityDescent.js`: `DESCENT_VARIANTS`, `PATCH_L110_FALL_LATCH_PROBE` (probe world only, not in `SEEDLING_SET_PATCHES`), `descentSet`, `descentWorld`, `DESCENT_TAPES`, `DESCENT_ARMS`, `descentSolverArm`, `L110_ARRIVAL`, `L110_PIT`, `censusFallsOntoDoors`;
  - `fidelityDescent.test.js` (9 rows);
  - `fixtures/descent-oracle.json`;
  - `scripts/procgen/probe-seedling-descent.mjs`.
- Changed:
  - `playerPhysicsV2.js` (the guard and the descent arm), with its test (+2 rows);
  - `solverBot.js` (`chained`);
  - `fidelityMoonrock.js` (`tapeOf` exported, so the two slices play one staging) and `fidelityMoonrock.test.js` (the refusal row became MODEL = GAME; the approved row asserts the chain);
  - `boxLock.test.js` (`guarded` += the probe);
  - `seedling-bot.md` (the descent-door paragraph; the "these throw" list now names only the fall-out);
  - `seedling-bot-log.md`;
  - the solver surface;
  - the constants census;
  - the regenerated reference.

## What the brief got wrong (measured)

1. **"The model REFUSES it … (`levelRun`'s transitions)" / "D2 — `levelRun`'s transitions".** The refusal is in `playerPhysicsV2.step`, in two places. `levelRun` needed no edit: its swap tail already arrives a teleporter transition from any state.
2. **"is a door the player lands on armed by `Teleporter.check()` on the new Game's first frame? measured: it fires, so presumably not".** It **is** armed: the doors' `check()` runs before `Player.check()` and sees the ctor position. It fires anyway because the 83 px lift releases it on the first update, and the descent comes back down onto it. "It fires" could not tell the two apart on L110. The latch probe can: armed at the ctor (what the game does) gives L0 at t28, and armed at the drop would give L3 (M2).
3. **"at least one OTHER fall-onto-a-door if the atlas has one".** It has none: L110 is the census's only row. The two other doors witnessed are probe/delivered-variant worlds: L2's `stairsup@48,16` (the approved repoint, crossed from above) and L2's `teleporter@48,96` / `stairsup@48,16` pair (the latch probe).
4. **"a reach-pit goal … does `solveSegment` accept a goal 'reach L2 via the pit'?"** No, and it needs to be no new goal shape. The solver already planned the chained fall correctly once the model stopped throwing (233 t, ending in L2). What was missing was the record saying where the run ended.

## Residue

1. **The fall-out phase stays refused** (`playerPhysicsV2.step`, *"… while a pit transport was in flight (phase "out")"*). L100's exit to L101 and L43's to L37 stand on pit tiles, so the door and the pit edge meet in the OLD room. There, the door's `FP.world =` and `checkFallingInPit`'s `FP.world =` can land on the same tick, and the last write wins. This slice did not measure it, and the planners still refuse those two doors.
2. **The rock-set L0** (vanilla after the Shield, built-in map only) chains through the rock's `moonrock_target` Teleporter on the same tile. It is witnessed by the moonrock oracle (`fallRockSet` / built-in, MODEL = GAME now), but it is not in `censusFallsOntoDoors`, which builds worlds from the records' static entities and so cannot see a runtime-spawned rock.
3. **Generated sets.** `censusFallsOntoDoors(records)` takes any set, but no generated set was censused: a generator that places a pit's ctor under a door's column would chain the same way. The rules arc can call it per atlas.
4. **Pre-existing reds**, all byte-identical at the base (measured in a pristine base worktree at `47fb574`):
   - **`--check` DRIFT, 7 producers.** `plan-seedling-f1-l5-open-lock` (`61f3ffe2`, as MOONROCK reported), `plan-seedling-f1c-l18-lock` (`7fe91d6c`), `plan-seedling-f1c-l18-phase` (`83066f07`), `plan-seedling-r9-l0-sword-dash` (`cbf2cd8b`), `plan-seedling-r9-l6-bob-press` (`0d722204`), `plan-seedling-r9-l6-harmless-window` (`8534968c`) and `plan-seedling-r9-l6-sword-dash-hit` (`68b42bf9`). Each log is `cmp`-identical between base and head.
   - **`jsRuntimeVanillaDelivery` §5.18**, the L14 decline pin.
5. The scratch worktrees are gone (byte-inertia).

## Byte-inertia

- **No committed tape, expectation, declaration or roster pin moved.** `campaign-frontier.json` was not touched.
- **No AS3, wasm, gitlink, rules or rules-generator edit.** `seedling-map.json` was not touched, and `SEEDLING_SET_PATCHES` is unchanged: the latch probe's repoint lives in `fidelityDescent.js` as a probe world.
- **No JS-arc file edited.** CANCROSS's new files were not touched.
- **No signature or contract moved:** `solveSegment`, `PendingDeclaration`, `createRunForStaging`, `twoPassSolve`. A `reach-pit` record gains an optional `chained`.
- **Not run:** `standing-values --write`, `pytest`, the unfiltered vitest. `git stash` was not used. Mutants were copy → edit → run → copy back, md5-checked.
- ⚠ **One near-miss, caught.** My first D2 edit landed in the main tree about 30 s after the BEFORE identity block started, while it was on its first rows. I reverted it with `git checkout --`, killed the block by PID (791/793/808/809/810), and re-ran the block from scratch on the pristine tree. Its log equals the published `aa46950b…`. All later development ran in a scratch worktree, and the commits were cherry-picked after the BEFORE block finished.
- **Box:**
  - The D1 probe recording ran while the BEFORE block was on its node-only measurement rows. The D3 re-record ran while the block's producer `--check`s ran: those take no box, and the box was free (checked) once `generated set` had passed.
  - The AFTER block ran alongside the JS-arc vitest and the producer `--check`s, which are node-only. Its log is byte-identical.
- **Tree dirt** (none staged):
  - `/home/user/de-wt` (detached scratch worktree, where D1–D3 were developed) and `/home/user/de-base` (a pristine `47fb574` for the base re-runs) were removed (`git worktree remove`) before this report was committed; `git worktree list` shows only this tree.
  - Scratch: `/tmp/claude-0/de/`.

## The rows to BANK

- identity log md5: BEFORE **`aa46950b5958b32136111155250dd253`**, AFTER **`aa46950b5958b32136111155250dd253`**, byte-identical (head)
- the six `--check`s: `405d9c4bb37a0ab00fb0ef9a99194783` `8e7a43be0509882d753f54155ef284c2` `33d20889ebd8c72452ce7262bce9505b` `35456fbc07e7151ddbc4c2a1fd00c789` `6cd35fe1414af6bf5beb7605f235cb8e` `b29b589b26e6ad996c2a328d16b52c90`, all exit 0 (BEFORE = AFTER)
- counts: tapeRunner **475** (md5 `4bbf900b…`, unmoved), roster **209**, surface **GREEN 195**, constants **4,966**, entities 518, profile 138, instruments **343**
- `fixtures/descent-oracle.json` md5 **`54888e5e863195069fb1c452798aa35a`** (6 arms, p4f headless); probe-variant set ids `delivered` `329dd9d9`, `delivered:approved` `8ac54ada`, `delivered:latch-probe` `ac5b57c4`
- **the census:** 39 (pit, ctor) pairs / 12 levels / **1 onto a door** (L110 (64,64) → L0 `stairs@256,272` → L2 (48,32), descent tick 39)
- **for the JS arc:** D2 = **`b7e2d35`** (the descent fires its door); D3 = **`d7c9d8c`** (`reach-pit` record `chained`)
- pre-existing reds: 7 producer DRIFTs (residue 4), `jsRuntimeVanillaDelivery` §5.18
