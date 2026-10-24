# Seedling fidelity ARRIVAL: an arrival inside a solid, measured on the game, known to the model, refused by name with the way out

**Slice:** `seedling-fidelity-arrival`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning-3`), wave 6 (the first model-coverage wave).

⚖ **The user** (2026-10-05): *"Arrival inside a solid should only happen if we play the game out of order. The proper fix for this might be to restart using the menu, or just take a different path. The broken state of some obstacles is saved in the save data. We might need to set up Archipelago logic to track which things were broken, or maybe other things saved in the save data."*

| | |
|---|---|
| Started from | `origin/main` @ **`88a7e4daa4`** (≥ `9527592ac4`, wave 5 = SLOTS + STEPOFF2 + FRONTIER2; ancestor check passed) |
| Head | the last commit on the branch (this report is committed last) |
| Harness branch | `claude/arrival-inside-solid-bm2gws` (no local `seedling-fidelity-arrival`: the harness branch IS the slice branch, reset to `origin/main`) |
| Commits | D1+D2 `fb42c56` · D3 `eb6737a` · D4 `a59a5e6` · docs `76c126b` · D3 survey family `6d71afb` · D3 narrowing `05ceeae` · docs wording `bc3d6ea` · this report |
| Dev server | `serve-nocache.py 9360` (PID 2006), this tree |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (no mismatch to fix) · D3 PASS · D4 PASS** |

## The one thing to know first

**An arrival inside a solid is now a named state, not a planning failure.**

- The game fixes it: with the obstacle's saved flag held, the player takes **no step in any direction**; with the flag cleared, the same landing walks free. The model's stream is the game's at 0 px on every one of the 40 arms that test this.
- The solver asks the state at `solveSegment`'s entry and refuses **before any search**:
  - `obstacle.kind: 'arrival-inside-solid'`;
  - the solid, and its flag `{level, tag}` with the action and item that clear it;
  - `wayOut`: the Menu's Restart (`seedlingStartSpawn`) and every other door that lands in that level outside a solid.
- Every sweep leg and survey step that arrives inside a solid used to refuse under a misleading name; 28 legs and 2 steps were re-measured. Seven legs named the **wrong rock**: L0 from L12 named `breakablerock@80,112`, 13 tiles away, and L0 from L1 named `@288,176`. The L113 legs named a pillar or a spire.
- ⚠ **Two of the three cases the brief names cannot happen in play**, and the third does happen on the AP route:
  - **L0 from L1** (legs 1–6) cannot happen with the rock unbroken. L1's only entrance is L0's `teleporter@80,96`, which sits behind that very rock (measured; see *What the brief got wrong*).
  - **The L113 legs** are the same shape: L115's only entrance is behind the final door.
  - **L0 from L12** does happen on the AP route (survey step 42): L12 has 13 other entrances.

## W0 (at `88a7e4daa4`, before any edit)

My first files were untracked new files. They were moved to the scratchpad (md5-recorded) for W0 and copied back after; `git stash` was not used. The primary tree was pristine for every W0 row.

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9360 bash scripts/procgen/identity-block.sh .` (venv active) | md5 **`5bf108151ad7a075428d0ff20f15240e`**: byte-identical to STEPOFF2's banked value. `generated set` OK, reference ALL 7 + 5 MATCH |
| six `--check`s | the block's producer loop | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1` + campaign `56bb3724`, **all exit 0** |
| surface / constants / entities / profile | the four `--check`s | **GREEN 198** · **PASS 4,977** · **PASS 518** · **PASS 138** (both JSONs) |
| roster | `fixtures/tapes/index.json` `.tapes` | **227** |
| bounded vitest BEFORE | 60 files (below) | **60 files / 2,140 tests, all green**; tapeRunner **511**, sorted `(fullName, status)` md5 **`0ce826422e03bda48b1733c7bd18a08f`** |

**The bounded set** (60 files):
- the standing list: `r8Acceptance`, the roster pins (`tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`), `ropeSword`, `shoveWeighParity`, `watchGenOverlay`, `watchOverlays`, `r5Shaft`, `decisionTrace`, `entityBlocks`, `solverDeadline`, `seedlingCanCross`, `campaignChain`, `jsRuntimeDeclarations` (read-only), `boxLock`, `lintGateLabels`, `seedlingSolverSurface`, `seedlingConstantsCensus`, `tapeRunner`, `wasmArrival`, `jsRuntimeWalker`, `jsRuntimeSolver`;
- the three files that pin a `no REACHABLE stance` sentence (`procgenNestedOpeners`, `procgenSeedlingElementsCertify`, `procgenPalette`);
- ⚠ wave 5's lesson: **every** test file `grep -a` finds for `solveSegment|twoPassSolve|obstacle.kind|inside-solid|stepOffIfLatched`. The change sits at `solveSegment`'s entry, so every row that stages a solve is in reach: 35 files, e.g. `blockRoute`, `botDriverV2`, every `fidelity*`, `jsRuntimeArrivalOnDoor`, `wasmArrivalComposite`, the `procgen*Solver`/`Weigh`/`CollectPath`, `solverBot`, `solverPrefix`, `twoPassSolve`, `turretSolver`, `watchSolve`, `surveyFamily`.

## D1 — the game (PASS)

**The probe.** `scripts/procgen/probe-seedling-arrival-solid.mjs` is new. It takes the box (guarded), runs headless logic-only on p4f, and plays one arm per fresh page. The arms come from `fidelityArrival.arrivalArms()`, so the node rows replay the very tapes the game played. Each arm boots a fresh JS-runtime staging at a **GAME landing** (a door's `playerx/playery`; a boot is a `new Game`, the landing's own first frame). The obstacle's flag is **HELD** (never broken: the out-of-order arrival) or **CLEARED** (`persistence: [{level, tag}]`). The arm then stands, holds one cardinal for 30 ticks, or (with the Sword, flag held) presses the primary once and then holds a direction.

`--record` → `fixtures/arrival-solid-oracle.json`, md5 **`8923e598097d1b7c1b0a0b098c8998cd`**: 42 arms, **ALL CHECKS PASSED**.

| landing (GAME) | solid · flag | HELD: stand / ←→↑↓ | CLEARED: stand / ← → ↑ ↓ (px moved) | model vs game |
|---|---|---|---|---|
| (a) L12 `teleporter@0,80` → **L0 (288,176)** | `breakablerock@288,176` · {0,1} | 0 / 0 0 0 0 | 0 / 35.25 · **272 → L12** · 5.5 · 5 | 0 px, all 10 |
| L1 `teleporter@64,112` → **L0 (80,112)** | `breakablerock@80,112` · {0,4} | 0 / 0 0 0 0 | 0 / 5.5 · 21.95 · **42.35 → L1** · 35.25 | 0 px, all 10 |
| (b) L12 `teleporter@40,688` → **L24 (48,128)** | `burnabletree@32,128` · {24,0} | 0 / 0 0 0 0 | 0 / 21.95 · 5.5 · 35.25 · **596.95 → crossing** | 0 px, all 10 |
| (b) L115 `teleporter@64,144` → **L113 (112,16)** | `finaldoor@112,0` · {113,0} | 0 / 0 0 0 0 | 0 / 5.5 · 21.95 · **112 → crossing** · 35.25 | 0 px, all 10 |

- **(a) The game's verdict.** With the rock unbroken the player is **stuck**: every hold moves 0 px for 30 ticks (`Entity.moveBy` stops at the first `collide("Solid", x+sign, y)`, and the box starts inside). With the flag cleared the rock is not built, the player walks, and holding right crosses the door back to L12.
- **(b) STEPOFF2's `inside-solid` boots, checked against the doors' `playerx/playery`.** Of the nine, only the L24 pair (`burnabletree@32,128`) and the L113 pair (`finaldoor@112,0`) are **real game landings**. Both are game-poked above; the census (D1(c)) lists them. The other five are the binding's on-door fallback, and the census finds no game landing for them:
  - L66 `bosslock@72,64`;
  - L34 `magicallock@128,0`;
  - L3 `breakablerockghost@0,64`;
  - L5 `lock@48,112`;
  - L98 `lock@112,112`.
- **Can the player act from inside? Yes, with the Sword.** One primary press at tick 0 breaks the rock in the game: its own `persistence_cleared` reads `[{tag:1, level:0}]` / `[{tag:4, level:0}]`, and the held direction then moves the player 24.7 / 21.95 px. **No strategy is built on this** (the user's ruling). It is recorded as game evidence, and as residue: the model breaks the rock too (`rocksBroken` `goneAt` 8) but frees the box **2 ticks before the game does**. The model's first move is on observation 8 and the game's on observation 10; worst 2.35 px.

## D1(c) / D2 — the census, and the model in each save state (PASS, no fix needed)

`scripts/procgen/census-seedling-arrival-solid.mjs` is new: node only, no box, exit 0.
- It walks **every door in the map** (both directions: each side has its own door) and boots its landing fresh twice: with no clears, and with the overlapping solid's own tag cleared.
- Per row it reports: inside or not; the **model's stuck test** (`arrivalSolid.modelStuck`: every cardinal hold, 30 ticks, the run's own preview stepper); the action and item that clear the flag (`FLAG_ACTIONS`, read at each class's `setPersistence(tag, false)`); and the solver's answer.
- An `arm` class (a FallRock, which a clear ADDS) is asked the other way round. No landing is inside one.

**10 (landing, solid) rows, 10 doors, 8 landing positions:**

| door → landing | solid | flag | clears it | held | cleared |
|---|---|---|---|---|---|
| L1 `teleporter@64,112` → L0 (80,112) | `breakablerock@80,112` | {0,4} | a sword strike | inside, stuck | out, walks |
| L12 `teleporter@0,80` → L0 (288,176) | `breakablerock@288,176` | {0,1} | a sword strike | inside, stuck | out, walks |
| L12 `teleporter@40,688` → L24 (48,128) | `burnabletree@32,128` | {24,0} | fire | inside, stuck | out, walks |
| L76 `teleporter@0,80` → L71 (288,256) | `shieldlock@288,256` | {71,2} | its activation group | inside, stuck | out, walks |
| L83 `teleporter@32,64` → L12 (32,864) | `magicallock@32,864` | {12,7} | a wand shot | inside, stuck | out of it, **still stuck** |
| L83 `teleporter@32,64` → L12 (32,864) | `bosslock@32,864` | {12,12} | the boss key | inside, stuck | out of it, **still stuck** |
| L113 `teleporter@64,144` → L112 (112,16) | `rocklock@112,16` | {112,1} | its activation group | inside, stuck | out, walks |
| L113 `teleporter@80,144` → L112 (112,16) | `rocklock@112,16` | {112,1} | its activation group | inside, stuck | out, walks |
| L115 `teleporter@64,144` → L113 (112,16) | `finaldoor@112,0` | {113,0} | the Watcher spoken | inside, stuck | out, walks |
| L115 `teleporter@80,144` → L113 (128,16) | `finaldoor@112,0` | {113,0} | the Watcher spoken | inside, stuck | out, walks |

- **D2: the model builds each solid exactly when the game does.** The build already reads the save: `PERSISTENCE_RESPONSE` despawns via `clearedAwayByTag`, and the tree's despawn goes through `treeBuiltIn`.
  - Every row is inside the solid with the flag held, and outside it with the flag cleared.
  - L12 (32,864) stands inside a **stacked** magical lock and boss lock: it is free only with both flags cleared (`allCleared {7,12}`: free).
  - The game witnesses the two states on four of the eight positions (D1). There, the model's 40 movement and stand streams are the game's at 0 px.
  - No mismatch was found, so there was no fix to make.

## D3 — the solver knows the state and refuses by name (PASS)

**The change** (`solverBot.js`, `eb6737a`; the shared module `arrivalSolid.js`):
- At `solveSegment`'s entry, after the argument checks and before the goal loop, `arrivalInsideSolid(run)` asks two things:
  - does the player box overlap a solid (`Entity.collide`'s positive-area test)?
  - does any cardinal hold move it (`modelStuck`)?
- A box that grazes a solid and can walk out is not this state.
- If it is this state, `SolverRefusal`:

```
<name>: arrival-inside-solid — the run's box at (296,184) in level 0 is INSIDE breakablerock@288,176 and no cardinal hold
moves it (the game's `Entity.moveBy` stops at the first collide). The save says the obstacle is still there
(breakablerock@288,176: persistence {level 0, tag 1} still holds — it is cleared when the obstacle is broken by a sword
strike (hasSword)): an arrival here means the game was played out of order. The solver does not act from inside a solid.
Way out: Restart from the Menu (`seedlingStartSpawn`), or another route into level 0 (L2 stairs@48,16 -> (264,264),
L13 stairs@64,144 -> (56,200), L86 teleporter@48,64 -> (168,296), L89 teleporter@160,304 -> (248,24),
L94 teleporter@304,160 -> (24,136), L94 teleporter@304,176 -> (24,152)).
```

`obstacle` = `{ kind: 'arrival-inside-solid', id, solids: [ids], flags: [{solid, level, tag, action, item}], at: {level, x, y}, latchedOn?, wayOut: [{kind: 'restart', via: 'seedlingStartSpawn', why}, {kind: 'another-route', level, arrivals: [{from, door, at}]}] }`. `considered` holds each hold's 0 px.
- `perTick` and `rows` are **empty**: no search, nothing pressed.
- The other arrivals are every door in the map that lands in this level, read through `run.worldFor` (each level built under the run's own clears), whose landing box is outside every solid. L1's landing is itself inside a rock, so it is **not** offered.

**The way out, by what the code can know.** `seedlingStartSpawn` needs the start region's payload, which a solver run does not carry, so the refusal names the warp and the binding resolves it. For the playthrough preset that resolves to **L0 (16,128)**, outside every census solid (measured).

**STEPOFF2's words kept.** STEPOFF2's latched boots under a lock (L66 `bosslock@72,64`, …) are this state met later, so they now refuse here first:
- `kind` is `'arrival-inside-solid'` with `latchedOn`, and `solids` keeps STEPOFF2's field;
- the message ends `Latched: inside-solid — the run stands LATCHED on teleporter@72,64 in level 66 with its box INSIDE bosslock@72,64: no direction moves it …`, word for word;
- `fidelityStepOff.test.js` is unedited and green (42/42).

**Only a solid a saved flag decides** (`05ceeae`). The first AFTER vitest at `6d71afb` found **one** red row:
- `procgenCollectPath` *"refuses by name when the pickup has NO walkable ring cell at all"* boots the player at the generated room's start (1,1), which is inside a `tile:Stone` of the test's own 7×7 wall ring;
- it expects the stance search's *"no WALKABLE stance within 3 lattice rings"*;
- no save state removes a wall, so there is no flag to name and no out-of-order arrival.

`arrivalInsideSolid` now fires only when a solid under the box is of a flag-bearing class (`FLAG_ACTIONS`: rock, ghost rock, burnable tree, the locks, magical lock, final door, fallen rock). A box inside a permanent wall only keeps today's refusal. All census rows, sweep legs and survey steps above are flag classes, so none of them moved.

**With the flag set, the same arrival solves as before.** L0 (288,176), Sword, `persistence [{0,1}]` → **5 t into L12**. That is the same plan as at base (measured at base before the edit: `SOLVES 5 12 [walk]`).

**The route survey names it.** `surveyFamily.FAMILY_RULES` gains one row, asked first because the sentence is unique: `ARRIVAL-INSIDE-SOLID — the arrival box is inside <solid>, whose saved flag still holds …`. No other row moved or was reworded.

**Mutants** (predicted first; copy → edit → run `fidelityArrival` + `fidelityStepOff` (136) → copy back, md5 restored: `solverBot.js` `6f8ca035…`, `levelWorld.js` `c5340010…`, `arrivalSolid.js` `6c8e2588…` at the time):

| mutant | predicted | measured |
|---|---|---|
| m1 the entry check removed (`insideSolid = null`) | 5: the 3 solver rows, the census's solver column, the D4 table | **5** (fidelityStepOff 0: its regexes still match STEPOFF2's own path) |
| m2 the build ignores a `despawn` clear (`clearedAwayByTag` false) | 20: 16 CLEARED movement arms, the census CLEARED row, the cleared solve, the control, the D4 table | **16**. ⚠ The four L24 tree arms stayed green: the tree's build reads `treeBuiltIn`, not `clearedAwayByTag`. A "clear" has more than one reader (trap candidate) |
| m3 `modelStuck` always reads free | 7: m1's 5 + the census STUCK row + the L12 stacked row | **7** |
| m4 the narrowing removed (any solid, walls too) | 1: `procgenCollectPath`'s sealed pickup; `fidelityArrival` 0 | **1** (of 105) |

## D4 — the rules arc's input (PASS)

`fixtures/arrival-solid-edges.json` (md5 **`f79820d1bcb8e84f0bb7db59d480d9c4`**) is written by `census-seedling-arrival-solid.mjs --json=…` and pinned by `fidelityArrival.test.js` (the committed table must equal the census's). There is one row per edge whose passability depends on a saved obstacle state. Each row carries:
- `edge` (door, landing);
- `solid`, `flag`, `action` / `item` / `cite`;
- `side`: always *outside the solid, in the landing level's room; the landing is ON its cell*;
- `flagHeld` / `flagCleared`;
- `gameWitnessed`;
- `solver`;
- `backDoors` (the landing level's doors to the source: the in-order crossing);
- `otherWaysIntoSource`.

| edge | flag | clears it (item) | other ways into the source level | ⇒ can play reach it with the flag held? |
|---|---|---|---|---|
| L1 → L0 (80,112) | {0,4} | sword strike (`hasSword`) | **0** | **No.** L1's only entrance, L0 `teleporter@80,96`, is behind this rock (measured: from the true start (80,128) the bare solver refuses on the break; with the Sword it breaks and crosses in 31 t) |
| L12 → L0 (288,176) | {0,1} | sword strike (`hasSword`) | 13 | **Yes**, and the AP route does it (survey step 42) |
| L12 → L24 (48,128) | {24,0} | fire (`hasFire`) | 12 (into L12) | yes |
| L76 → L71 (288,256) | {71,2} | its activation group | 1 | yes, and the AP route does it (survey step 186) |
| L83 → L12 (32,864) ×2 solids | {12,7} + {12,12} | wand shot (`hasWand`) + boss key (`hasKey`) | **0** (into L83) | only if L83's entrance (L12 `teleporter@32,848`) is reachable past the stacked locks. Not measured |
| L113 → L112 (112,16) ×2 doors | {112,1} | its activation group | 4 | yes |
| L115 → L113 (112,16), (128,16) | {113,0} | the Watcher has spoken | **0** | **No** on the vanilla map: L115 is entered only through L113's final door |

**What the rules arc gets.** These are the edges where AP logic would have to track saved obstacle state for an arrival to be passable. The solver already refuses each by name, so a rule that crosses one with the flag held now reads `arrival-inside-solid` in every survey and sweep, not a misleading room failure.

## The survey / sweep rows this moves (before → after)

**The sweep's legs** (`seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`, 799 legs): **30 legs** arrive at a census landing. The 28 exit legs were solved in node (`solveSegment`, staging at the arrival, `hasSword` when the sphere holds the Progressive Sword) at base (a detached worktree at `88a7e4d`) and at head. The 2 `location` legs (153, 575) refuse at the entry at head before their goal is read; they were not solved at base.

| legs | arrival | BEFORE | AFTER |
|---|---|---|---|
| 1–6 (`level_0__r8c0`) | L0 (80,112) via `in_L1_64_112` | `solid` — *"**breakablerock@288,176** cannot be broken … `primary` slot holds NOTHING"* (the wrong rock) | `arrival-inside-solid` (`breakablerock@80,112`, {0,4}) |
| 37 (`level_0__r11c19`, the sweep's #2, Σ35) | L0 (288,176) via `in_L12_0_80`, Sword | `solid` — *"no REACHABLE stance for a swing at **breakablerock@80,112**"* (the wrong rock) | `arrival-inside-solid` (`breakablerock@288,176`, {0,1}) |
| 152 | L12 (32,864) | `pixelmask` — *"no corridor … cliffside0"* | `arrival-inside-solid` (`magicallock@32,864, bosslock@32,864`) |
| 258–260 | L24 (48,128) | `solid` — *"burnabletree@32,128 cannot be burned … does not hold FIRE"* | `arrival-inside-solid` (`burnabletree@32,128`, {24,0}) |
| 572, 574 / 573 | L71 (288,256) | `proximity-hazard` (button@112,176 stance) / `solid` (a chest-stance loop) | `arrival-inside-solid` (`shieldlock@288,256`, {71,2}) |
| 759 / 760 | L112 (112,16) | `pixelmask` (cliffside2) / `solid` (planttorch) | `arrival-inside-solid` (`rocklock@112,16`) |
| 779–790 (12 legs) | L113 (112,16)/(128,16) | `solid` (ruinedpillar / dungeonspire / finaldoor), each a `no corridor` | `arrival-inside-solid` (`finaldoor@112,0`, {113,0}) |

**None of them solves before or after.** Σ unserved does not move; the **names** do. Every one now reads the save state and its way out. All 28 named a room obstacle before, and 7 of those named the wrong rock (legs 1–6 named `@288,176` for a run inside `@80,112`; leg 37 named the reverse).

**The rules survey** (`survey-seedling-route.mjs --through=end`, 236 steps; derive-only to find them, then `--only=42,55,186` at base and head):

| step | BEFORE (family) | AFTER (family) |
|---|---|---|
| 42 L0 visit 6, from L12 at (288,176) | REFUSED `unclassified`: *"no REACHABLE stance for a swing at breakablerock@80,112"* | REFUSED **`ARRIVAL-INSIDE-SOLID`** (`breakablerock@288,176`) |
| 186 L71 visit 3, from L76 at (288,256) | REFUSED `unclassified` (a chest-stance loop) | REFUSED **`ARRIVAL-INSIDE-SOLID`** (`shieldlock@288,256`) |
| 55 L25 (the brief's `pickup-inside-solid` kin) | REFUSED `VERB-MISSING`: the chest's PLACEMENT is inside `rock2@80,96` | **unchanged.** A placement inside a permanent solid is not an arrival and no flag removes `rock2`: FRONTIER's `solid:*` rows, not this slice |

**The STEPOFF2 census** (`census-seedling-stepoff.mjs --on-doors`, 280 latched rows): AFTER = SOLVES 232 · hazard-floor 25 · closed 6 · 8 other. These are unchanged; the only move is **the 9 `inside-solid` → `arrival-inside-solid`**, with the same nine rows (L113 ×2, L24 ×2, L34, L3, L5, L66, L98).

## For the JS arc: pins and what to wire

- **Pins red at my head: none.** Green in the bounded AFTER at `05ceeae`: `jsRuntimeArrivalOnDoor`, `wasmArrivalComposite`, `jsRuntimeWalker`, `jsRuntimeSolver`, `jsRuntimeSolverShouldStop`, `wasmArrival`, `jsRuntimeDeclarations` and `seedlingCanCross`. None of them quotes `inside-solid` (`grep -a`); STEPOFF2's L37 `closed — …` clause is untouched.
- **New `SolverRefusal.obstacle.kind`: `'arrival-inside-solid'`.** Its optional fields are `solids`, `flags`, `at`, `latchedOn?`, `wayOut[]`, all listed above. No signature moved: `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging` are untouched. `pending` is **not** set: the refusal never asks for a declaration, because a declaration would be a clear the game did not make.
- **What to wire:**
  - (1) the sweep's family classifier should read `obstacle.kind === 'arrival-inside-solid'`; today it would stamp the L0 leg by its words;
  - (2) the Playback Bot / walker can surface `wayOut[0]` as the Menu's Restart (`seedlingStartSpawn`, the binding's) and `wayOut[1].arrivals` as "another route";
  - (3) the latched boots that read `inside-solid` (STEPOFF2's 9) now carry `kind: 'arrival-inside-solid'` + `latchedOn`; their words are unchanged.
- **CANCROSS's `solverStamp` moves** (`solverBot.js` changed), so derived rules read STALE until re-derived. That is the intended behaviour.

## Deltas

- New:
  - `frontend/modules/seedlingDemo/arrivalSolid.js`: a solver-family file, imports through the door;
  - `fidelityArrival.js`;
  - `fidelityArrival.test.js` (94 rows);
  - `fixtures/arrival-solid-oracle.json`;
  - `fixtures/arrival-solid-edges.json`;
  - `scripts/procgen/probe-seedling-arrival-solid.mjs`;
  - `scripts/procgen/census-seedling-arrival-solid.mjs`.
- Changed:
  - `solverBot.js`: the entry check, one import;
  - `solverView.js`: `LEVEL_COUNT` exported through the door;
  - `seedling-solver-surface.json`: 198 → 201 rows (+`world:finalDoors`, +`world:magicalLocks`, +`import:LEVEL_COUNT`, classified `seedling/constant`; site-count drift on `world:teleporters`, `state:latched`, `run:*`, `state:x/y`);
  - `surveyFamily.js` (+1 row) and `surveyFamily.test.js` (+1);
  - `boxLock.test.js`: the probe guarded.
- Docs:
  - `seedling-bot.md`: the arrival-inside-a-solid paragraph;
  - `seedling-bot-log.md`: the ARRIVAL entry, three trap candidates;
  - the regenerated reference: `README.md`, `architecture.md`, `generated/docsIndex.js`, `generated/instruments.js`; instruments **356 → 358**.

## What the brief got wrong (measured)

1. **"L0 entered from L12's landing … the walker refuses too … NO game evidence yet."** There is game evidence now (D1), and it says more than the walker could: the player is stuck, **and** one Sword press from inside breaks the rock. The base solver's refusal named the **wrong rock** (`breakablerock@80,112`) for a run standing in `@288,176`. Its planner treats the box as standing somewhere it cannot leave and searches the room for any rock to break.
2. **"the sweep game-poked L0 from L1's door: the game's landing (80,112) is inside `breakablerock@80,112`."** True as a poke, but **unreachable in play**. L1's only entrance is L0's `teleporter@80,96`, directly behind that rock; the true start (80,128) is south of it. Measured: from (80,128) the bare solver refuses on the break, and with the Sword it breaks the rock and crosses in 31 t. Legs 1–6 arrive there only because the sweep's start-region legs take the region's `in_L1_64_112` entrance spawn. The real start (`seedlingStartSpawn`) is **(16,128)**.
3. **"STEPOFF2's census found 9 boots whose box is inside a solid."** Only **two pairs are game landings**: L24's tree (L12 `teleporter@40,688` → (48,128)) and L113's final door (L115 → (112,16)/(128,16)). The other five (L66, L34, L3, L5, L98) are the binding's on-door fallback; no door lands there. The census adds **three game landings STEPOFF2 never booted** (only latched boots were its rows): L0 (288,176), L71 (288,256) and L112 (112,16), plus L12 (32,864) inside two stacked locks.
4. **"the rules survey's L25 `pickup-inside-solid` may be kin."** It is not this state. Step 55's chest *placement* is inside `rock2@80,96`, a permanent solid that no flag removes. The arrival is free.
5. **"the arrival build already reads the persistence (clears); verify … Fix any mismatch."** Verified. There was nothing to fix (D2). The model's stream is the game's on all 40 movement and stand arms.

## Residue

1. **The press from inside is 2 ticks early in the model.** `rocksBroken.goneAt` is 8; the game frees the box at observation 10 (worst 2.35 px). No strategy uses it (the ruling), so nothing replays it. The `fidelityArrival` rows pin the gap, so a fix will read.
2. **L83 → L12 (32,864)**: whether L83's only entrance (L12 `teleporter@32,848`) is reachable without both locks open is not measured. If it is not, that row is unreachable in play like L1's.
3. **L71 / L112 / L12 (32,864) are census rows without a game poke.** Their D2 verdict is the model's only. The four poked landings cover a rock, a tree and the final door; a lock (activation-group / key) landing was not poked.
4. **`wayOut.another-route` is per level, not per region.** The solver run carries no region binding. The arrivals it names are the level's doors whose landing is outside a solid; whether one reaches the obstacle's room side is the binding's (or the rules arc's) question.
5. **`rocklock`'s world row carries no `persistTag`.** The solver's refusal says *"its world row carries no persistence tag"* for L112, while the census (map-backed) names {112,1}.

## Byte-inertia

- **No committed tape, expectation or declaration moved.** tapeRunner's 511 `(name, status)` pairs are md5-identical (`0ce82642…`), and the roster stays 227. The change only fires for a run whose box is inside a solid and cannot move, which no committed producer segment starts in.
- **The identity block** at head `05ceeae`: md5 **`5bf108151ad7a075428d0ff20f15240e`**, `diff`-identical to W0, every row. It was also identical at `6d71afb` (before the narrowing).
- **No AS3, wasm, gitlink or rules edit.** No JS-arc file was edited (`jsRuntime*`, `flashPanel/*`, `wasmArrival.js`, `wasmWalkTape.js`, the worker, and their tests). No other wave-6 region was touched: no `OBSTACLE_STRATEGIES` row, no combat ladder, no proximity/IceTurret, no `playerPhysicsV2.js`.
- **Not run:** `standing-values --write`, `pytest`, the unfiltered vitest. `git stash` was not used.
- **Tree dirt (outside the repo's tracked files):**
  - a detached scratch worktree `/tmp/claude-0/s/base` @ `88a7e4d` (with symlinks to the primary's `node_modules` and `frontend/modules/shared`) served the BEFORE survey and sweep rows. It was removed afterwards (`git worktree remove`, then `prune`);
  - `.cache/seedling-survey/through-end/` (the survey's own cache, git-ignored) remains;
  - the dev server on 9360 (PID 2006) is still running.
- **Box:** taken by the probe (twice: a scoped `--only=` run, then the recording), by the identity block (BEFORE and AFTER), and by nothing else alongside.

## AFTER

| Row | W0 | head | movers |
|---|---|---|---|
| identity log | `5bf108151ad7a075428d0ff20f15240e` | **`5bf108151ad7a075428d0ff20f15240e`** at `05ceeae` (and at `6d71afb`), `diff` clean | none |
| producer `--check`s | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1` `56bb3724` | **identical, all exit 0** | none: no producer segment starts inside a solid |
| tapeRunner | 511, md5 `0ce82642…` | **511, md5 `0ce826422e03bda48b1733c7bd18a08f`** | none |
| roster | 227 | 227 | none |
| surface | GREEN 198 | **GREEN 201** (`--write` → classify 3 → `--check`) | +3 rows (above), site counts |
| constants / entities / profile | 4,977 / 518 / 138 | **4,977 / 518 / 138**, PASS | none |
| reference | ALL 7 + 5 MATCH | **ALL 7 + 5 MATCH** after regeneration | instruments 356 → 358 (`check-procgen-help --in-place --only=` ALL PASS for both) |
| `check-procgen-docs` | — | ALL CHECKS PASSED | |
| bounded vitest | 60 files / 2,140 | **61 files / 2,235, all green** (at `05ceeae`; the first AFTER at `6d71afb` read 2,234/2,235: below) | + `fidelityArrival` 94, `surveyFamily` 8 → 9; nothing else moved |
| `boxLock` | green | **green (26)** | the probe guarded |

## The rows the coordinator must BANK

- identity log md5: BEFORE **`5bf108151ad7a075428d0ff20f15240e`** (pristine `88a7e4d`, venv active); AFTER **`5bf108151ad7a075428d0ff20f15240e`** (head `05ceeae`): byte-identical
- the six `--check`s: `405d9c4bb37a0ab00fb0ef9a99194783` `8e7a43be0509882d753f54155ef284c2` `33d20889ebd8c72452ce7262bce9505b` `35456fbc07e7151ddbc4c2a1fd00c789` `6cd35fe1414af6bf5beb7605f235cb8e` + campaign `56bb3724fd0ed3dda184e6e7d6d5d27c`, all exit 0 (BEFORE; AFTER **identical**)
- counts: tapeRunner **511** (`0ce826422e03bda48b1733c7bd18a08f`), roster **227**, surface **GREEN 201**, constants **4,977**, entities 518, profile 138, instruments **358**
- `arrival-solid-oracle.json` md5 **`8923e598097d1b7c1b0a0b098c8998cd`** (42 arms, p4f); `arrival-solid-edges.json` md5 **`f79820d1bcb8e84f0bb7db59d480d9c4`** (10 edges)
- the census: 10 rows / 8 positions; every row inside + stuck with the flag held, outside with it cleared (L12 stacked: free with both)
- the STEPOFF2 census: 9 `inside-solid` → `arrival-inside-solid`, everything else unchanged (232 / 25 / 6 / 8)
- the sweep: 28 exit legs re-measured, all → `arrival-inside-solid` (0 solve before or after; 7 named the wrong rock before); the survey: steps 42 and 186 `unclassified` → `ARRIVAL-INSIDE-SOLID`
- **for the JS arc:** D3 = **`eb6737a`** (`obstacle.kind: 'arrival-inside-solid'`, `flags`, `wayOut`, `latchedOn`)
