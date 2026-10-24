# Seedling fidelity ENCOUNTERS: the encounter goal from any arrival, and the Witch is a talk

**Slice:** `seedling-fidelity-encounters`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning-5`), wave 10 (model coverage).

| | |
|---|---|
| Started from | **`3e0ff8b80f`** (main after the hammer arc's B2; not rebased) |
| Head | the last commit on the branch (this report is committed last) |
| Harness branch | `claude/seedling-fidelity-encounters-9p04lh` (the harness branch IS the slice branch) |
| Commits | D1+D2 `6d1ed6f` · D3 `eabb486` · docs + reference `aa4b8b7` · this report |
| Dev server | `serve-nocache.py 9540` (this tree) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS** (survey step 140 REFUSED → SOLVED). One CI red is left for the planner: the standing roster row (it needs `standing-values --write`) |

## The one thing to know first

**The sweep's 8 `unresolved` encounter legs never reach the solver, so nothing in this slice can move them by itself.** Every one stops at the binding: the vanilla arm's playback map refuses every encounter row by name (`ENCOUNTER_REFUSAL`, `flashPanel/seedlingPlaybackController.js`). Behind that, `jsRuntimeSolver.solverGoalFor` maps a location only to `collect-placement`. The solver side now answers both encounters, the Bob Boss from every arena state and the Witch for the first time. The JS arc has to bind the two rows (the wiring is listed below).

## W0 (at `3e0ff8b80f`, before any edit)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9540 bash scripts/procgen/identity-block.sh .` (venv active) | maze `246dfbce…`, acceptance `76602ae8…`, c3 `4937da80…`, c6 `430573e9…`, c4 `b9d2185d…`, ENEMY `30bcc49c…`, guard `a6d18d49…`, AREA `02b22525…`, killgate s2/s5/s9 `006b0639…`/`7d4cb820…`/`49e23d85…`, level pre/post s1 `e28c1e5d…`/`fb1a59e5…`, generated set `OK`; reference `4 … DIFFER` (this container's uninitialised substrate submodules). Log md5 `8b6d3065c1a012fb368cc31f58719855` |
| six producers | the block's loop | battery `405d9c4b`, d2-chain `b76f6483`, l18 `465a8b46`, tail `35456fbc`, r9-l3 `6cd35fe1`, r9-campaign `13b8d51f`, **all exit 0** |
| tapeRunner pairs | `vitest run tapeRunner.test.js --reporter=json`; md5 over the sorted `fullName\tstatus\n` lines | **575**, md5 **`fbe5fc605470431789b76760698b9564`**, 0 non-pass |
| surface / constants / entities / profile | the four `--check`s | GREEN 227 / PASS 5,443 / 528 leaves / 138 keys |
| roster | `fixtures/tapes/index.json` | 259 |
| bounded vitest BEFORE | 47 files: the brief's list plus every `grep -a` hit for what I touch (`solverEncounter`, `bobBoss`, `placedTalk`, `fallRock`, `levelWorld`, `fidelityF6`, `outOfBandLedger`, `encounters`, `r7Acceptance`, `r5Chain`, `levelRun`, `wasmArrival`, `fidelityBurn`, `entityBlocks`, the surface/constants/surveyFamily tests) | **47 files / 1,824 tests, all green** |

## D1: measure (PASS)

**(a) Which side leaves the 8 encounters `unresolved`.** I re-derived the legs (`seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`, 841 legs). The 8 legs are the vanilla ledger's only two `encounter` rows:

| Legs | Location | Drop | Where it stops |
|---|---|---|---|
| 351 (42 blocks) | `Level 032 - Bob Boss`, arrival (64,112) from L30 | Fire | the binding |
| 109, 119, 129, 139, 149, 159, 169 (1 block each) | `Level 012 - Witch`, seven arrivals | Progressive Sword (the dark sword) | the binding |

Two layers stop them, both owned by the JS arc:

1. **The binding.** `vanillaArmPlaybackMap` puts every `encounters` row into `refused` (`ENCOUNTER_REFUSAL`), so `dump.entries` never holds the location and `seedling-divergence-bare.mjs` writes `unresolved`.
2. **The mapping.** Even if the row were bound, `jsRuntimeSolver.solverGoalFor` maps `kind: 'location'` only to `collect-placement` via `locationEntityOf`, and an encounter has no pickup entity (`"the location names no entity of the room"`).

The solver itself has owned the goal kind since swim U5: `{kind: 'encounter', at, drop: {item}, then}`.

**(b) The Bob Boss from live arrivals.** The sweep's L32 arrival (64,112) is the same door as the survey's staged (72,120): one is OEL coordinates, the other the player's (+8, +8). So the meaningful variation is the arena's STATE, not the door. Each state was measured in node with `solveSegment` from `r5-bobboss-fire`'s boot with one field changed:

| Arrival state | BEFORE | AFTER (D2) |
|---|---|---|
| fresh (the survey's) | SOLVED 1,042 | SOLVED 1,042 (unchanged) |
| mid-fight continuation, `prefix` cut at t5 / 13 / 100 / 200 / 300 / 400 / 500 / 600 / 700 / 800 | **all SOLVED** (the executor already reads the arena off the run) | same |
| rock fallen ({32,1} cleared), at the L30 door | **refused at build**: `LevelWorldError … fallrocklarge … response "arm" … A clear list must never name it` | SOLVED 1,041, no arm leg |
| rock fallen, at the respawn (72,104) | refused at build | SOLVED 1,034 |
| Fire held, rock fallen, tree standing | refused at build (and the executor would spin 8,000 ticks waiting for a boss) | SOLVED 256 (`drop already`, burn, pit) |
| Fire held, rock fallen, tree burned | refused at build | SOLVED 142 |
| Fire held, rock unarmed | **throws**: `a fire window's hit tick 8 falls on a FROZEN tick (the BobBoss rock's arm frame)` | SOLVED 261 (arm first) |

What the game does in the rock-fallen state was read from `Scenery/FallRockLarge.as` and witnessed on the game (D2). The ctor builds the rock at `fallTo`, Solid, with `cameraTimer = 0`. The first `update()` snaps a player inside it onto its top (`activate && y >= fallTo` → `p.y = y - originY + p.originY - p.height`), then takes the `cameraTimer == 0` arm and adds `BobBoss(72, 72)`, which removes itself when `Player.hasFire`. The L30 door's arrival (80,128) is INSIDE the fallen rock, so the game moves the player 128 → 125 on observation 1.

## D2: Bob Boss from any arrival (PASS)

**Change** (no flag; every change was measured byte-inert on the committed roster):

- `levelWorld.js`: `arenaRockOf(e)` (a `fallrocklarge` with both `bossrock` and `thirdboss`). A clear of that rock's tag no longer throws; the roster row carries `fallenAtBuild: true`, present only then. The derived clear list (`persistenceClearsFor`) still refuses it, and every other `arm` rock (L39's `fallrock`, L82's `bossrock`) is still refused at build.
- `levelRun.js`:
  - the arena reads `fallenAtBuild` the way it reads a death's `bobRocksFallen`;
  - `FallRockLarge.update`'s snap, every live frame while a landed rock overlaps the player, before the player steps (ledger `rock-snap`);
  - the arm's boss spawn honours `BobBoss`'s `hasFire` self-removal, the same gate the fallen-at-build arm already read;
  - the arena's `rock` entity row carries `holdsPlayer: true` only while the snap is due.
- `solverBot.js` `execBobBossEncounter`:
  - Fire already held → no fight and no collect (`drop` record with `already: true`);
  - the arm leg runs regardless of the Fire (its frozen frame would swallow the burn press);
  - one settle tick when the rock holds the player (nothing can be planned from inside a Solid);
  - the completion check accepts a rock that was armed before the segment.

**Game witnesses** (authored by `scripts/procgen/plan-seedling-encounters.mjs`, recorded with `check-seedling-bot-differential --record --only=…`, p4f, headless, port 9540; reproduced by the model):

| Tape | Arrival | What the game did | Model |
|---|---|---|---|
| `enc-l32-fallen-door` (1,055 t) | `swim-u5-bobboss-encounter`'s staging + {32,1} cleared, the L30 door | snap 128 → 125 at obs 1, boss re-added at once, three forms, Fire, burn, the pit to L30 at t975; hits 0; `fire-removed → 31:29`; 14/14 item properties | **worst \|Δ\| 0** over 1,056 obs |
| `enc-l32-fire-return` (142 t) | the same + Fire held + tree {32,0} burned | snap, no boss, the pit at t62 | **worst \|Δ\| 0** over 143 obs |

**Mutants** (predicted, then made by copy → edit → restore; `levelRun.js` md5 restored `e3655918…`):

| Mutant | Predicted | Measured |
|---|---|---|
| M1 the snap removed | both tapes red | both red (`JS stream matches the real game recording`) |
| M2 `fallenAtBuild` ignored | both tapes red | both red |
| (the `hasFire` arm gate) | no tape reaches it | covered by the unit row "Fire held, rock unarmed: the arm first … no boss" |

`fidelityEncounters.test.js` (new) has rows for every state in D1(b) plus the build rows.

## D3: the L12 Witch (PASS)

**What the game does** (`NPCs/Witch.as`, `NPCs/NPC.as`, `Pickups/DarkSword.as`, `Pickups/Pickup.as`). It is a talk, not a fight:

| Piece | The AS3 | Model |
|---|---|---|
| the text | `update()`: `if (Main.hasWand) prepNewText(hasDarkSword ? textExtra1 : textExtra)`, BEFORE `talk()` | `witch.witchText` at the open; the level's 5-page text is spoken only by a wand-less player |
| the open | `NPC.talk()`: an X **release** inside `talkRange` 24 (entity points), `keyNeeded` true | the existing placed-talk arm |
| the grant | `doneTalking()`: `if (hasWand && !hasDarkSword) FP.world.add(new DarkSword(p.x - 8, p.y - 8))`. The `talking` setter runs it on the last page AND on leaving the circle | `witch-close` with `cause` + `grants`; the spawn at `trunc(p.x - 8) + 8` (int ctor args) |
| the pickup | queued on the closing frame, in the world from the next; a runtime add is prepended, so it updates before the player; `_attract` false, so overlap only; `special` | `darksword-added` on the close tick, `darksword-contact` on close + 1, phase A (150 dead frames) and its text |
| the removal | `Player.hasDarkSword = true`; `if (checkPersistence(-1)) setPersistence(-1, false)` (out of band, behind an out-of-band read) | `hasDarkSword`; `darksword-removed` with flag {11,29}, `writesWhen: 'ifFlagAlreadySet'` (reported, not applied, as the Fire's is) |

**Change:**

- `witch.js` (new): the two texts verbatim, `witchText`, `witchGrants`, `darkSwordSpawnAt`, `darkSwordBox`, `DARK_SWORD`.
- `dialogue.PLACED_NPC_TALK.witch.doneTalking`: `'REFUSED'` → `'darksword'`.
- `levelRun.js`: the talk arm speaks `witchText` and spawns on close; the runtime `DarkSword` and its ceremony; ledger kind `witchEvents` (LEDGER_KIND_NAMES 33 → 34).
- `solverBot.js`: `execWitchEncounter`, registered as `ENCOUNTER_EXECUTORS['Progressive Sword']`:
  - (a) the walkable tile centre nearest the player inside the circle;
  - (b) the ceremony cadence opens and pages the dialogue, standing still;
  - (c) the same cadence pages the sword's ceremony until `hasDarkSword`, verified on the ledger;
  - the sword already held → `already`; no wand → refused by name before a tick.
- `outOfBandLedger.OUT_OF_BAND_WRITERS.DarkSword.witness`: `r5-witch-darksword` (a name reserved five waves ago that never became a tape) → `enc-l12-witch`.

**Survey step 140** (`survey-seedling-route.mjs --through=end --route=full --only=140`, local): **REFUSED (ENCOUNTER-UNMODELLED) → SOLVED 601 t**, 0 hits, ends in L95 (the encounter plus the step's `reach-exit`).

**Game witness:** `enc-l12-witch` (601 t) starts from the survey's step-140 arrival (16,352) with the sword and the wand.

- The encounter goal opens the dialogue at t286, pages `textExtra` to its end at t340, the sword lands at (407,392), contact is at t341, and the run then walks out to L95.
- Recorded on p4f: 602 obs, 1 transition, **the game's 14 item properties match the model's (3 true: sword, wand, dark sword)**, the slot array `[0,2]`, hits 0. The model reproduces the stream.

**Mutants** (on the walking-out witness; `levelRun.js` md5 restored `5288fc17…`):

| Mutant | Predicted | Measured |
|---|---|---|
| M3b the level's text instead of `textExtra` (5 pages, not 3) | red | red |
| M3c no add delay (contact on the closing frame) | red | red |
| M3d no spawn | red | red |

⚠ **A first version of the witness was blind.** It stopped at the drop, and all three mutants PASSED: the talk and the ceremony freeze the player, so x and y never moved. The witness now walks out by the L95 door, which is what turned the three red (a trap candidate, below). The spawn's truncation (sub-pixel) is still invisible to any stream; a unit row pins it.

## The survey and sweep rows this moves

**Survey** (local, `survey-seedling-route.mjs --through=end --route=full`; the BEFORE column is CI run 38010117701):

| Step | Room, goal | BEFORE | AFTER |
|---|---|---|---|
| 140 | L12 Witch → Progressive Sword, then L95 | REFUSED, ENCOUNTER-UNMODELLED | **SOLVED 601** |
| 51 | L32 Bob Boss | SOLVED 1,056 | SOLVED 1,056 (unchanged) |
| 30, 32, 43, 108, 120, 134 | L12 crossings | SOLVED 328 / 311 / 2,364 / 208 / 249 / 673 | identical |
| 57, 78, 87 | L12 | REFUSED (chest stance; puncher dwell hit) | identical refusals |
| 63 | L12 → L37 | REFUSED (combat ladder exhausted, puncher) | identical refusal (solo run, `--timeout=3600`; the first, loaded run read TIMEOUT at 1,500 s, and CI spent 1,001 s on it) |
| 154, 175, 185 | L12 | REFUSED / SOLVED 540 / REFUSED | identical |

**Sweep:** no leg moves until the JS arc binds the rows. Legs 351 and 109–169 stay `unresolved` (D1).

**CI dispatches for the planner** (I cannot dispatch: 403):

1. `seedling-survey.yml` on `claude/seedling-fidelity-encounters-9p04lh`, `through=end`, `route=full`, `only=140,51,63`. Expect 140 SOLVED, 51 SOLVED 1,056, and 63 as on main.
2. After the JS arc's binding: `seedling-divergence-sweep.yml`, `mode=inv`, `ids=351,109,119,129,139,149,159,169`. Expect the 8 rows to leave `unresolved`.
3. `seedling-differential` (the tape tier) `--only=enc-l32-fallen-door,enc-l32-fire-return,enc-l12-witch`, to re-check the three recordings against the live game on CI.

## For the JS arc: what to wire, and the pins

**No pin of the JS arc's moved.** CI's `JavaScript Unit Tests` at `aa4b8b7` (run 38068708976): **19,352 passed, 1 red** (below). `jsRuntimeSolver`, `wasmArrival` and `wasmArrivalComposite` are green in it.

**To wire** (no signature changes; only new optional fields):

1. **Bind the encounter rows** (`seedlingPlaybackController.vanillaArmPlaybackMap`): instead of refusing an `encounters` row, emit an entry `{location, level, kind: 'encounter', at, drop: {item}}`.
   - `at` is the location's atlas tile: (64,128) for L32, (416,384) for L12, the coordinates the survey's `surveyRoute` hands the solver.
   - `drop.item` is the AP item, `Fire` / `Progressive Sword`.
2. **Map it** (`jsRuntimeSolver.solverGoalFor` / `wasmArrival.arrivalSolverGoal`): a location entry with `kind: 'encounter'` → `{kind: 'encounter', at, drop: {item}, then}`, with `then: 'reach-pit'` for L32 (the survey's) and `null` for L12. `solveSegment`, `twoPassSolve` and the request shape are unchanged.
3. **Collection.** The executors verify the drop on the run (`hasFire`, `hasDarkSword`). The page's check report for these two locations is the JS arc's: neither is a pickup the apitem observer sees.
4. **A live arrival after a death in L32** carries {32,1} in its persistence. `createRunForStaging` now builds it (it threw before), so no wiring is needed beyond passing the game's persistence through, as today.

**New, optional fields** (nothing removed):

- `run.ledger('witchEvents')` / `run.witchEvents`;
- the `bobBoss` entity's `rock` row may carry `holdsPlayer: true`;
- `world.fallRocks[]` may carry `fallenAtBuild: true`;
- an encounter `drop` record may carry `already: true`;
- the encounter `talk` record (`cause`).

No new `SolverRefusal.obstacle.kind`: the Witch refuses with the existing `encounter` / `unmodelled-encounter`. `solverView` is unchanged; `solverBot` now also imports `TALK_RANGE` through it (surface row re-censused, 227 rows GREEN).

## Handed to the hammer arc

Nothing. No hammer-owned function was touched.

## Deltas

**New files:**

- `frontend/modules/seedlingDemo/witch.js`, `fidelityEncounters.test.js` (15 rows);
- `scripts/procgen/plan-seedling-encounters.mjs` (`--check`: 12 PASS; `check-procgen-help --in-place`: HELP ok · IMPORT ok);
- tapes + expectations `enc-l32-fallen-door`, `enc-l32-fire-return`, `enc-l12-witch`.

**Changed:** `levelWorld.js`, `levelRun.js`, `solverBot.js`, `dialogue.js`, `outOfBandLedger.js`, `r8Acceptance.js` (three declared exposures).

**Records:**

- surface GREEN **227** (`--write`); constants PASS **5,443 → 5,453** (8 `witch.js` literals classified `rule/magnitude` with their AS3 sites; `--profile-rows` + `--write`);
- roster **262**; tape index regenerated;
- `seedling-bot.md` (an encounter paragraph), `seedling-bot-log.md` (entry + four trap candidates);
- reference: instruments + docs index regenerated (the four substrate rows left as committed, as at W0).

**Pins moved and re-pinned** (each named in its test):

- roster counts 259 → 262 (`tapeEnvelope`, `observationTolerance` ×2 incl. `swapped`, `dialogueAutoAdvance` ×2);
- `r8Acceptance` exposed set 78 → 81 (+ the three witnesses), its sorted list and its synthetic mirror;
- `placedTalk` refused NPCs `['oracle','witch','yeti']` → `['oracle','yeti']`;
- `solverEncounter` registry keys `['Fire']` → `['Fire','Progressive Sword']`;
- `levelRun.test` ledger kinds 33 → 34 (+ the witness row `enc-l12-witch` for `witchEvents`);
- `outOfBandLedger.test` DarkSword witness.

## What the brief got wrong (measured)

1. **"The sweep's #1 unserved edge is Bob Boss … the live arrival solver has NO GOAL for an encounter location"**: half right. There is no goal, but neither the arrival solver nor `solveSegment` is where it is missing: the playback map refuses the row first. "Unresolved" is a binding verdict.
2. **"Run `bobBossFight` from each arrival state … where it fails, name the gap"**: from the sweep's arrival it did NOT fail. That arrival is the survey's door in OEL coordinates, and continuation arrivals already solved. The gaps were arena STATES no arrival in the sweep or survey stages (rock fallen, Fire held), and one of them was a build refusal, not a fight.
3. **"D3: model the [Witch] fight so an executor can be derived … like Bob Boss's"**: there is no fight. The Witch is an NPC whose dialogue ending adds a pickup. The model REFUSED her dialogue by name (`PLACED_NPC_TALK.witch.doneTalking: 'REFUSED'`), which is the gap the survey's `ENCOUNTER-UNMODELLED` was naming.
4. **"8 encounters + 48 event goals unresolved"**: the 8 are 1 + 7 legs of only two locations.

## Residue

1. The two encounters are unreachable from the live page until the JS arc wires the binding and the mapping (above).
2. The `DarkSword` out-of-band write is reported, not applied, as the Fire's is; `ifFlagAlreadySet` is recorded on the row, and its effect on the previous level's slot 29 is not modelled.
3. A dropped dark sword (the player walking more than about 6 px away on the closing frame) stays in the world and is collected on a later overlap. That is modelled generally but not witnessed.
4. The Bob Boss arena's snap is witnessed only from the door; a respawn never overlaps the rock.
5. `Witch` text pages when the player holds neither the wand nor the sword: the level's text, unwitnessed on the game since this slice (the model no longer refuses it).
6. Survey step 63 is cost-bound locally: it TIMEOUTs at 1,500 s on a loaded box and refuses identically to CI when run alone.
7. Queued, not started: the six boss / final-lock survey steps (147, 171, 192, 198, 218, 219) and the L112 Owl (sweep leg 795).
8. Untracked dirt from the bounded vitest's procgen tests (`scripts/procgen/.atlas-sphere-*`, `.rl-*`, `worlds/*_worldgen/`) was left untracked and not staged.

## Byte-inertia

- tapeRunner at the head: **581 rows, 0 non-pass**, md5 `68819ddca4fb3cebeb6c0fc9c57be8d6`; the 575 pre-slice rows `fbe5fc60…` = W0.
- identity block AFTER (this tree at `eabb486`): **every md5 row and all six producers identical to W0**. The only difference is the reference line, 4 → 8 DIFFER: the instruments and docs index my new script and docs moved, regenerated at `aa4b8b7` and back to W0's 4 substrate rows.
- bounded vitest AFTER: **49 files / 1,877 tests, all green**.

## Rows to BANK

- tapeRunner pairs **581 / `68819ddc…`** (old 575 `fbe5fc60…`);
- roster **262**; surface **227**; constants **5,453**; R8 exposed **81**; LEDGER kinds **34**;
- `ENCOUNTER_EXECUTORS` = `Fire`, `Progressive Sword`;
- ⚠ the standing roster row's `mechanic` part: 199 → **202** tapes (needs `standing-values --write` after the tier run; red in CI until then: `rosterCategories.test.js` › "the LIVE row carries one part per derived category", expected 202, the row says 199). **STOP — the planner re-banks it.**
- survey (local) 140 SOLVED 601; 51 unchanged.
