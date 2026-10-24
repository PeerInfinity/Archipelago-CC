# Seedling fidelity STEP-OFF: an exit tile re-triggers only after the player steps off it (model + solver)

**Slice:** `seedling-fidelity-stepoff`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning-2`).

⚖ **The user** (2026-10-04): *"The model should model this behavior, and the solver should know that it needs to step off the exit tile before it will re-trigger."*

| | |
|---|---|
| Started from | `origin/fidelity-harvest/sf-f7` @ **`0aab89b4d8`** (SF + F7), as briefed |
| Head | the last commit on the branch (this report is committed last) |
| Harness branch | `claude/exit-tile-stepoff-model-il3y6o` (local `seedling-fidelity-stepoff`, pushed there) |
| Commits | D1 `6be75fd` · D2 `cce7104` · D3 **`182829a`** · D4 `3afb8ca`, `6838130` · this report |
| Dev servers | `serve-nocache.py 9230` (this tree), `9231` (the pristine BEFORE worktree `Archipelago-CC-wt-stepoff-base` @ `0aab89b4d8`) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (no model change was needed) · D3 PASS · D4 PASS** |

## The one thing to know first

**The model already had the re-trigger guard. The gap was in the solver.** `Teleporter.playerTouching` has been transcribed since R0 as `playerPhysicsV2.initialLatch` / `updateTeleporters` (`state.latched`, armed at every boot, crossing and respawn). Nine new game arms and eight older committed recordings confirm it.

What was missing: `solveSegment`'s `reach-exit` walked to the centre of a door the run already stood latched on. That is a zero-length walk, and it stalled for 400 ticks. **D3 (`182829a`) makes the solver step off first.** It walks to the nearest standable cell ringing the door, then makes the crossing walk. All five `crosses` arrivals now solve with no death, and the game plays the solver's plan on two teleporters and one stairs door with 0 px error.

**For the JS arc:** the walker's step-off is no longer needed in front of the solver. Their call sites that can retire are listed below. None of their pins move at this head.

## W0 (at `0aab89b4d8`, before any edit)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9231 bash scripts/procgen/identity-block.sh .` in a **pristine worktree** at `0aab89b4d8` (`new-worktree.sh --with-wasm`; submodules finished by hand with `git -c protocol.file.allow=always submodule update`, because the mirrors' `file` transport is refused) | log md5 **`aa46950b5958b32136111155250dd253`** (= F7's, byte for byte) |
| six `--check`s | the block's producer loop | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 b29b589b`, **all exit 0** |
| reference | the block's last row | ALL 7 + 5 MATCH |
| tapeRunner | inside the bounded vitest | **469/469**; sorted `(fullName, status)` md5 **`1999093a9c5df32b4b4d1f3582687aa4`** |
| surface / constants / entities / profile | the four `--check`s, in the worktree | **GREEN 194** · **PASS 4,966** · **PASS 518** · **PASS 138** (both JSONs) |
| roster | `fixtures/tapes/index.json` | **206** |
| bounded vitest BEFORE | 19 files: `solverBot`, `solverBotLethalPit`, `levelRun`, `levelWorld`, `tapeRunner`, `jsRuntimeArrivalOnDoor`, `wasmArrivalComposite`, `jsRuntimeWalker`, `wasmArrival`, `shoveWeighParity`, `watchGenOverlay`, `decisionTrace`, `entityBlocks`, `jsRuntimeDeclarations`, `fidelityF7`, `lintGateLabels`, `boxLock`, `seedlingSolverSurface`, `seedlingConstantsCensus` | **19 files / 1,098 tests, all green** |

**Every `ARRIVALS_ON_A_DOOR` arrival through the solver at the base.** Each was booted fresh at its spawn and given `reach-exit` on the door it stands latched on (scratch `/tmp/claude-0/so/arrivals.mjs`):

| arrival | JS arc class | base verdict | words | ms |
|---|---|---|---|---|
| L3 (96,128) | closed | REFUSES | *"… the re-planned corridor failed too — … waypoint 0 (104,136): not reached within 400 ticks; stalled at (104,136) …"* | 42 |
| L34 (128,0) | lock | REFUSES | *"no corridor for goal reach-exit toward (136,8) in level 34. Obstacle: solid:pole … A\* start tile (8,0) … is not walkable: solid magicallock at (128,0)"* | 3 |
| L37 (576,144) | closed | REFUSES | the 400-tick stall at (584,152) | 28 |
| L43 (144,64) | pit | REFUSES | *"the teleporter at (144,64) in level 43 stands ON a PIT tile (9,4) …"* | 0 |
| L58 (80,16) | deactivated | REFUSES | *"… is DEACTIVATED (tag 1, invert false) …"* | 0 |
| L87 (432,304) | crosses | REFUSES | the 400-tick stall at (440,312) | 22 |
| L100 (288,96) | pit | REFUSES | *"… stands ON a PIT tile (18,6) …"* | 0 |
| L101 (96,16) | crosses | REFUSES | the 400-tick stall at (112.04,32.04) | 33 |
| L102 (224,96) | crosses | REFUSES | the 400-tick stall at (232,104) | 15 |
| L106 (64,48) | crosses | REFUSES | the 400-tick stall at (72,56) | 16 |
| L109 (160,48) | crosses | REFUSES | the 400-tick stall at (168,56) | 13 |

## D1 — the game's rule (PASS, measured)

**The AS3** (read-only):
- `Teleporter.check()` (`Teleporter.as:67-74`) runs `if (collide("Player", x, y)) playerTouching = true;`.
- `update()` (`:89-118`) runs `checkDeactivated(); if (deactivated) return; if (collide("Player", x, y)) { if (!playerTouching) FP.world = new Game(…); } else playerTouching = false;`.
- `Game.update` runs `check()` on every entity once, on a new world's first frame, above the `blackCover` gate (the `!checked` latch).

So, exactly:
- **Armed by** any `new Game` (boot, crossing or respawn) whose player box overlaps the door's 16x16 hitbox. Positive-area intersect, the same predicate the model uses.
- **Released by** ONE `update()` of the door with no overlap. The door updates before the player, so it reads the position the previous tick left.
- **Fired by** the next overlapping update.
- **Firing does not set the flag.** Only `check()` sets it, and nothing resets it except the `else`.
- **A deactivated door** returns before the `else`, so it neither fires nor clears.
- **Stairs vs teleporters:** no difference. `Stairs.update()` is `super.update()`, and stairs are built with `tag -1`.

**Measured on the game** (`probe-seedling-stepoff.mjs --record`, p4f headless logic-only, one fresh page per arm). There are three doors: `teleporter@432,304` (L87 → L88), `teleporter@64,48` (L106 → L101) and `stairsup@32,48` (L17 → L16). For each door, `STAND` stands 60 t. `SHORT` holds away for `nMin − 1` ticks, then back for 40. `MIN` holds away for `nMin` ticks, then back:

| arm | game transitions | model | stream | box off the rect |
|---|---|---|---|---|
| L87 STAND / SHORT(9) / MIN(10) | — / — / **t13 → L88** | equal | 0 px (61/50/51 obs) | none / closest −0.65 px / **t10 0.15 px, t11 0.05 px** |
| L106 STAND / SHORT(8) / MIN(9) | — / — / **t12 → L101** | equal | 0 px | none / (leaves the far side at t26, no return) / **t9 0.2, t10 0.35** |
| L17 stairs STAND / SHORT(9) / MIN(10) | — / — / **t13 → L16**, t19 → L17 | equal | 0 px | none / (far side t28) / **t10 0.15, t11 0.05** |

⇒ **The minimal step-off is sub-pixel.** A box 0.05 px clear of the rect re-arms the door, and edge-touching counts as clear (positive-area intersect). Standing never re-fires the door.

## D2 — the model (PASS; it already carried the guard)

There was nothing to transcribe. `levelRun`'s boot (`latched: initialLatch(world, spawn…)`), `arriveAt`/`arriveIn` (crossings) and `arriveAtRespawn` (deaths) all arm the latch, and `updateTeleporters` is the update's three arms verbatim. `fidelityStepOff.test.js` replays each of D1's nine game tapes (`fidelityStepOff.js`, one derivation shared with the probe) and requires the game's compact stream and transitions exactly.

**Mutant m1** (`initialLatch` returns an empty set; predicted: all nine model-vs-game arms, the three per-door latch rows and the geometry row, so 13/16):
- **Measured 13/16 red**: the STAND arms cross on t1, the old immediate transition.
- **11 tapeRunner rows red**: eight committed recordings, each differential plus three stepping rows. They are `r2-walk-1-sword-shield`, `r2-walk-full`, `r3-lava`, `r3-walk-1-sword`, `r3-walk-full`, `r4-walk-1-sword`, `r4-walk-full` and `r9-solve-3`.
- These recordings were already game witnesses of the guard. `r9-solve-3` boots ON L3's door to L11 and stands in the pocket breaking the rock for 152 ticks without firing.
- Restored md5-identical (`playerPhysicsV2.js 03e26e8c…`).

## D3 — the solver (PASS)

**`solverBot.js`** (`182829a`):
- **`reach-exit`** first calls `stepOffIfLatched`. When `run.state.latched` holds the goal door, it:
  - picks `stepOffCellFor(run, index, planOpts)`;
  - writes a trace row (`obstacle: latched-door`, verb `step-off`);
  - walks there with the door allowed (the route starts on it);
  - then makes the ordinary crossing walk.
- **The record** gains `stepOff: {door, to, from, ticks}` only when a step-off was planned, so every other record is byte-identical.
- **`stepOffCellFor`** looks at the tile centres ringing the door, nearest first. A cell must pass three tests:
  - its player box is OFF the door rect;
  - `isWalkableTile` holds with no teleporter allowed, so the cell is never another door;
  - the planner routes to the cell itself (not a snapped node).

  If no cell passes, the refusal is *"… : closed — the run stands LATCHED on teleporter@x,y in level N (`Teleporter.check()` latched it on the arrival frame) and no standable cell next to it can be walked to …"*.
- **`decisionTrace.KNOWN_STRATEGY_VERBS`** gains `step-off`.

No signature or contract moved (`solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging`).

**The per-arrival solver table at the head** (same boots, `fidelityStepOff.test.js` pins each row):

| arrival | class | head verdict | words / plan | ms |
|---|---|---|---|---|
| L3 (96,128) | closed | REFUSES | `closed — … teleporter@96,128 in level 3 …` | 4 |
| L34 (128,0) | lock | REFUSES | `closed — … teleporter@128,0 in level 34 …` (the magical lock's solid rings it; true, though the cause is the arrival's) | 1 |
| L37 (576,144) | closed | REFUSES | `closed — … stairs@576,144 in level 37 …` | 2 |
| L43, L100 | pit | REFUSES | unchanged (the pit/trigger conflict, by name) | 0 |
| L58 | deactivated | REFUSES | unchanged | 0 |
| **L87** | crosses | **SOLVES** | 32 t → L88, step-off to (440,296) 26 t, verbs `[step-off, walk]`, 0 deaths | 41 |
| **L101** | crosses | **SOLVES** | 39 t → L110 (door `teleporter@104,24`), step-off to (104,8) | 19 |
| **L102** | crosses | **SOLVES** | 33 t → L107, step-off to (216,104) | 5 |
| **L106** | crosses | **SOLVES** | 33 t → L101, step-off to (56,56) | 9 |
| **L109** | crosses | **SOLVES** | 33 t → L101, step-off to (152,56) | 8 |

The JS arc's composite rows (`probe-seedling-wasm-arrival-composites` D) solve directly too: the house door L86 from (48,64) in 32 t → L0, L2's `stairs@48,16` in 33 t → L0, and L3's `teleporter@64,0` in 33 t → L2.

**The game witness of the solver's plan:** the `SOLVER-*` arms of `fixtures/stepoff-oracle.json` (md5 `68cc1c48…`). The tape is the solve's own `perTick` (`buildStagedTape`), played on the game:

| arm | plan | game |
|---|---|---|
| SOLVER-L87-teleporter | step-off 26 t + back, 32 t | **t32 → L88**, 33 obs, worst 0 px |
| SOLVER-L106-teleporter | 33 t | **t33 → L101**, worst 0 px |
| SOLVER-L17-stairs | 33 t | **t32 → L16**, worst 0 px |

The nine D1 arms re-recorded byte-identical inside the same oracle.

**Mutant m2** (`stepOffIfLatched` returns null; predicted: 5 crosses + 3 closed/lock + 3 SOLVER arms = 11). **Measured 11/31 red.** The crosses rows show the old 400-tick stall again. Restored md5-identical (`solverBot.js a4ac9580…`).

**The W4 baseline classes** (28 composites / 8 closed / 5 step-off refusals / 1 solver refusal). ⚠ No instrument or record on this branch carries that census, so its 42 rows could not be re-run one by one. By mechanism:
- **composites** (latched on the goal door, a cell to step to): the solver now solves them from the arrival itself. All 8 composite rows the JS arc pins solve.
- **closed pockets**: still refused, now by the solver's own `closed` name, at once.
- **step-off refusals** (the walker's step-off died, crossed, or stayed latched past 240 t): the solver's step-off is a planned, danger-gated `walkTo`, so these become ordinary solves or ordinary named solver refusals. They are unmeasured here because the rows are not in this tree.
- **the 1 solver refusal**: unidentified, so unmeasured.

## D4 — records (PASS)

| Row | W0 (`0aab89b4d8`) | head | movers |
|---|---|---|---|
| identity log | `aa46950b…` | **`aa46950b5958b32136111155250dd253`**, byte-identical (`diff` empty) | **none** |
| six `--check`s | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 b29b589b`, all exit 0 | **identical**, all exit 0 | none: no producer's segment aims at the door its arrival is latched on |
| tapeRunner | 469, md5 `1999093a…` | **469, md5 `1999093a…`** | none |
| roster | 206 | **206** | none: the witnesses live in an oracle, not the roster, so no roster pin moves |
| surface | GREEN 194 | **GREEN 194** (`--write` → `--check`) | `state:latched`, `world:teleporters`, `import:levelWorld.js#rectsOverlap`, plus the `run:level/state/world`, `state:x/y`, `TILE_SIZE`, `playerBoxAt` site counts: solverBot now reads them statically. No new row, nothing unclassified |
| constants / entities / profile | 4,966 / 518 / 138 | **4,966 / 518 / 138** | none |
| reference | ALL 7 + 5 MATCH | **ALL 7 + 5 MATCH** after regeneration | instruments **336 → 337** (`probe-seedling-stepoff.mjs`, `--help` clean under `check-procgen-help --in-place --only=`); the docs index |
| bounded vitest | 19 files / 1,098 | **20 files / 1,129, all green** | + `fidelityStepOff` (31) |
| `boxLock` | green | **green** | `probe-seedling-stepoff.mjs` joins `guarded` |

**Committed tapes that boot on a door** (all 206 run through `createRunForStaging`): `r3-lava` (L96 on `32,64→L82`) and `r9-solve-3` (L3 on `96,128→L11`). Neither transitions through that door: `r3-lava` has no transition, and `r9-solve-3` leaves to L2. So **no committed tape diverges, and nothing needed re-recording.**

`seedling-bot-log.md`: `### Seedling fidelity STEP-OFF — the exit tile re-trigger` follows F7, with three trap candidates. `seedling-bot.md`'s transitions contract gains the arrival-latch paragraph.

## For the JS arc: their pins that move, and the retirable call sites

**Pins that move at my head: none.** These are green at the head:
- `jsRuntimeArrivalOnDoor` 19, `wasmArrivalComposite` 14, `jsRuntimeWalker` 11, `wasmArrival` 29;
- `jsRuntimeSolver` 14, `wasmWalkTape` 32, `jsRuntimeCore` 12, `wasmPlayback` 53;
- `seedlingWasmPlayback` 74, `jsRuntimeDeclarations` 6.

⚠ **Two of their mutation docblocks go stale.** Their catchers no longer red, because the solver now handles the latched case itself:
- `jsRuntimeArrivalOnDoor.test.js` m3 (*"`solverGoalFor` maps a latched exit to the solver → the ON rows red"*);
- `wasmArrivalComposite.test.js` m2 (*"no step-off prefix … every 'crosses' row red"*).

**Now redundant**, because the solver given the latched arrival plans step-off + crossing itself:
1. `jsRuntimeSolver.js:237`: `solverGoalFor`'s `if (resolved?.stepOff) return { walker: … }`. The latched exit can map to `reach-exit` directly. Their pin `jsRuntimeArrivalOnDoor.test.js:265-274` ("stays on the walker, named") moves when they retire it.
2. `wasmArrival.js:378-389`: `arrivalSolverGoal`'s latched arm (`stepOffPoint` + `stepOff: {index, point}`). The closed-pocket refusal there can become the solver's `closed` refusal.
3. `wasmArrival.js:409/421-423` (`stepOffGoal` → `producer: STEP_OFF_PRODUCER`), `wasmWalkTape.js:229-292` (`stepOffSolveFromStaging`) and `:313`, `jsRuntimeSolveWorker.js:16/38/60` (the `step-off` producer), and `seedlingWasmPlayback.js:814-816`. The composite (walker prefix ++ solve) becomes a plain solve.
4. `wasmArrival.js:451-452`: the continuation refusal *"the held player stands latched on the goal door — a step-off composite starts at an arrival"*. The solver now steps off from a shadow as well.
5. **Keep:** `jsRuntimeWalker.js:126` `stepOffPoint` and its `resolve` arm (`:266-280`) for the **solver-OFF** walker. Without the solver the walker still has to step off itself.

## Deltas

- `frontend/modules/seedlingDemo/solverBot.js`: `stepOffCellFor` (exported), `stepOffIfLatched`, the `reach-exit` call, and two imports (`isWalkableTile`, `rectsOverlap`).
- `frontend/modules/seedlingDemo/decisionTrace.js`: `step-off` verb.
- New: `fidelityStepOff.js`, `fidelityStepOff.test.js` (31 rows), `fixtures/stepoff-oracle.json`, `scripts/procgen/probe-seedling-stepoff.mjs`.
- `scripts/procgen/boxLock.test.js` (`guarded` += the probe), `seedling-solver-surface.json` (re-written).
- Docs: `seedling-bot.md`, `seedling-bot-log.md`, the regenerated reference (`README.md`, `architecture.md`, `generated/docsIndex.js`, `generated/instruments.js`).

## What the brief got wrong (measured)

1. **"Today the model and solver do not know this."** The model has known it since R0 (`initialLatch`, `updateTeleporters`). D2's game arms match it with 0 px error, and m1 shows eight older committed recordings already depended on it. Only the solver was missing it.
2. **"`levelRun`'s transition logic carries the re-trigger guard (armed at an on-door arrival …)".** It lives in `playerPhysicsV2`, and `levelRun` arms it (boot `:3997`, and every arrival through `arriveAt`). No edit was needed.
3. **"what 'stepped off' means (the hitbox fully out … one frame? a flag reset on `new Game`?)".** It is the box fully out of the rect (edge-touching counts as out) for one door update. The flag is re-armed, not reset, by `new Game`'s `check()`. Stairs and teleporters are identical. The game needed only 0.05 px.
4. **"Game witnesses for ≥1 stairs … `crosses` case".** All five `crosses` arrivals are teleporters. L37's stairs is ringed by lava, so the stairs witness boots ON `stairsup@32,48` in L17. A boot is a `new Game`, the same first frame an arrival has.
5. **"the W4 baseline 28/8/5/1 … report which of those rows this slice solves".** That census is not in this tree, so it was reported by class (above) plus the rows the JS arc pins.
6. **"a door ringed by no standable cell refuses by a TRUE name (`closed`)".** L34's `lock` arrival also reads `closed`. It is true (no cell rings it inside the magical lock's solid), but the root cause is the binding's `entrance_spawn` fallback, as the JS arc classifies it.

## Residue

1. **The one-update claim is AS3-read, not isolated on the game.** Every MIN arm was off the rect for two observed updates. A search over hold/pause/return timings found no single-tick-off crossing to record.
2. **L3 with the sword.** The pocket's ring includes `breakablerock@96,112`. The solver refuses `closed` and does not try `break` to make a step-off cell. The vanilla round trip opens it first, as the JS arc's L3 row does.
3. **The step-off walks to the cell centre** (26 t), where a few px would do (D1: 10 t away is enough). This is correct but not minimal, and an economy is left for later.
4. The W4 census rows (above).

## Byte-inertia

- **No committed tape, expectation or declaration moved.** tapeRunner's 469 `(name, status)` pairs are md5-identical, the roster is still 206, and `campaign-frontier.json` was not touched.
- **No AS3, wasm, gitlink or rules edit.** No JS-arc file was edited (`jsRuntime*`, `flashPanel/*`, `wasmArrival.js`, `wasmWalkTape.js`, the worker).
- **Stayed out of** `applyFire` and the obstacle strategies (BURN), and out of `climbLadder` (L14).
- **Not run:** `standing-values --write`, `pytest`, the unfiltered vitest. `git stash` was not used. Mutants were copy → edit → run → copy back, md5-checked.
- **Tree dirt:**
  - The bootstrap set `extensions.worktreeConfig true` (required by `new-worktree.sh`).
  - The BEFORE worktree `/home/user/Archipelago-CC-wt-stepoff-base` (branch `stepoff-base`) is left in place.
  - Untracked: none staged.
- **Box:** the D1 probe ran while the BEFORE block was on node-only rows. The D3 re-record ran while that block's producer `--check`s ran; those take no box, and every row came back equal. The AFTER block ran with no browser work alongside.

## The identity rows the coordinator must BANK

- identity log md5: BEFORE **`aa46950b5958b32136111155250dd253`** (pristine `0aab89b4d8` worktree); AFTER **`aa46950b5958b32136111155250dd253`**, byte-identical (`diff` empty) (head)
- the six `--check`s: `405d9c4bb37a0ab00fb0ef9a99194783` `8e7a43be0509882d753f54155ef284c2` `33d20889ebd8c72452ce7262bce9505b` `35456fbc07e7151ddbc4c2a1fd00c789` `6cd35fe1414af6bf5beb7605f235cb8e` `b29b589b26e6ad996c2a328d16b52c90`, all exit 0 (BEFORE; AFTER **identical**, all exit 0)
- counts: tapeRunner **469** (md5 `1999093a…`, unmoved), roster **206**, surface **GREEN 194**, constants **4,966**, instruments **337**, entities 518, profile 138
- `stepoff-oracle.json` md5 `68cc1c48c3b7884bee6218e41509d4fe` (12 arms)
- **for the JS arc:** D3 = **`182829a`** (`solveSegment`'s `reach-exit` steps off a latched door; `stepOffCellFor` is exported)
