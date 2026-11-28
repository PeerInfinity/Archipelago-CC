# seedling-js-l57-exit-check — the JS runtime accepts the exit a boss fight adds (L57's mouth, L69's Lights exit)

Cloud slice for `seedling-js-planning-24` (js-24). ⚖ Robert 2026-11-27T22:53:56Z (via `user-decisions-liaison-6`): *"Fix the L57
exit check (Recommended)"*. The clock was not touched (not licensed).

## Summary for Robert

**What was wrong.** Level 57 has no door of its own. You leave it through the Tentacled Beast's mouth, a teleporter the game
creates only when the beast dies (`TentacleBeast.as:211-214`). The JS runtime only accepted an exit whose tile has a door that is
written into the room file (or a pit). The mouth is created while the game runs, so the JS side refused the exit as "no teleporter
or pit on tile (6, 4)" before the bot even tried. The tile is correct: (80,48) + (24,24) − (8,8) = (96,64), tile (6,4). Across the
committed seedling presets, one other exit has the same shape: L69's Lights exit, created when the last Lights flier dies.

**The fix.** The solver already knew these two exits. It has a table of "exits a boss fight opens" and plans them as "fight, then
take the exit". The JS exit check and the JS walker now ask that same table, so they accept exactly the exits the solver can plan,
and nothing else. A tile with no exit is still refused by name. Pits and normal doors are unchanged. With the solver turned off, the
exit is refused with a clear reason, because only the solver fights. 2 code files changed, plus 1 new test file. No solver answer
changed: 25 replays give the same answers before and after.

**How far JS gets now.** Still **23/48**, on all 3 JS walks. It stops one step later, inside the same room: the solver now tries
the fight and declines it, because *"the tentacles' placements are `Math.random()` draws, and the run's stream has no declared seed
for this room"*.

**The next wall, and it is JS-only.** The JS runtime boots every room with an undeclared random stream (`rng {seed: 0, split:
false}`, `procgenOracle.js:339`). The wasm game declares its live seed (`rng {seed: 980896863, split: true}`). The two L57 requests
are otherwise the same goal. I replayed the JS request with only its `rng` swapped for wasm's, and it then solves to **wasm's exact
answer** (`9a2dd6e53352`, 1830 ticks, 0 hits). Wasm takes L57 → L58 on both control walks (28/48 by the time budget). Fixing this
means giving the JS runtime a declared random stream for its room boots. That is the same `bootStaging` call as the game clock, so
it is an ask, not built.

## Base, tip, branches

| | |
|---|---|
| base | `origin/claude/seedling-js-held-retry-1ec1ey` @ **`ac1d02e6fb`** (not re-tipped during the slice; checked at the end) |
| landing branch | **`claude/js-l57-exit-check-izu8ut`** (the branch the harness pins; the brief's `seedling-js-l57-exit-check`) |
| fix commit | `b5e93afb` |
| merge 1 of origin/main | `e136ff4b` = merge of origin/main **`edb026f9`** (trains region-map-maze-hooks, region-graph-floors: 60 files of region-graph / region-map UI, scripts and docs; none in `seedlingDemo/` or `flashPanel/` seedling runtime files). **The walks FJ1/FW1, the in-app batch and the L57 replays were measured here** |
| merge 2 of origin/main | **`b040b2ea`** = merge of origin/main **`9efa7489`** (trains mystery-placement, region-graph-floor-solver: region-graph, the mystery game and its submodule pointer, generated docs; again none in the seedling runtime). The only conflict was the generated docs word count (`docs/json/developer/procgen/README.md`, `procgenDocs/generated/docsIndex.js`), regenerated with `generate-procgen-reference.mjs` (`--check`: all 7 generated modules and 5 regions match the code); `check-procgen-docs.mjs` ALL CHECKS PASSED. Re-checked here: the closure / engineMd5 and the bounded vitest. The walks were not re-run for a merge that touches no seedling file |
| landing tip | the report commit on top of `b040b2ea` (this file) |
| measuring branch, pre-merge | local `measure/seedling-js-l57-exit-check` = `b5e93afb` + the diagnosis's capture probe `d1d9da5e` → `d2ad1671`, `a3b1633f` → `ece3957e`. Head `ece3957e`. Walks J1, J2, W1. **Not pushed** |
| measuring branch, merge tip | local `measure2/seedling-js-l57-exit-check` = `e136ff4b` + the same probe → `b7b0c883`, `eae3f6da`. Head `eae3f6da`. Walks FJ1, FW1. **Not pushed** |
| no-limit probe `3028cb27` | **not taken**: every walk ran at the shipped limits |

Every number below names its branch. Nothing measurement-only is on the landing branch.

## W0 — findings, with quotes (before any edit)

### 1. What is at L57 tile (6, 4), and what makes `level_57 -> level_58__r4c1` an exit

- **The rules exit** (`worlds/seedling_playthrough/_worldgen_sidecars.json`, the same in `seedling_playthrough` AP_1 /
  AP_14089154938208861744 and `seedling_er` AP_1):
  `{"exit_id": "out_tentaclebeast_80_48", "kind": "teleporter", "exit_tiles": [[6, 4]], "entrance_tile": [6, 4], "exitName":
  "level_57 -> level_58__r4c1", "targetRegion": "level_58__r4c1", "targetExitId": "in_tentacle_beast_mouth_L57_56_96",
  "target_level": 58, "target_spawn": {"x": 48, "y": 96}}`. The id names the **entity** (`tentaclebeast` at `.oel` (80,48)), not a
  door.
- **The room record** (the atlas `seedling-map.json`, `atlasLevelSource()(57)`; `evidence/l57-l69-record.txt`): 12 entities,
  and **none is a `teleporter`/`stairs*`**: 7 `shadow`, `lightalpha`, 2 `orb`, `tentaclebeast 80 48 {"tag":"0"}` (tile (5,3)), and
  `watcher 48 32`. Nothing stands on tile (6,4).
- **The AS3** (`vendor/seedling/src/Enemies/TentacleBeast.as`): the ctor centres the body at `super(_x + 24, _y + 24, …)` (`:37`).
  A cleared tag builds it dead with the mouth at once (`:51-59`: `if (tag >= 0 && !Game.checkPersistence(tag)) { … dead = true; …
  createMouthEntrance(); }`). Otherwise the mouth comes at the end of "dying" (`:200-206`: `case "dying": … //Teleporter to the
  tentacle beast's mouth  createMouthEntrance();`). And:
  `FP.world.add(new Teleporter(x - Tile.w / 2, y - Tile.h / 2, LevelSet.active().namedLevel("tentacle_beast_mouth"),
  LevelSet.active().namedX("tentacle_beast_mouth"), LevelSet.active().namedY("tentacle_beast_mouth")));` (`:211-214`). The
  manifest row is `tentacle_beast_mouth: { level: 58, x: 56, y: 96 }` (`VanillaSet.as:141-142`). A `Teleporter` fires on touch
  (`Teleporter.as` `update`: `if (collide("Player", x, y)) { if (!playerTouching) { Game.pendingExit = … exitType … to;
  FP.world = new Game(to, playerPos.x, playerPos.y); …`).
- So the exit is **a runtime teleporter that one entity type adds**. It is no `.oel` teleporter, so `EXIT_TYPES` (`teleporter`,
  `stairs*`, `jsRuntimeCore.js:234`) never matches it, and it is no pit. The model already knows it: `tentacleBeast.js:79-81`
  (`mouthDx/mouthDy -8`), `levelRun.js` `tentacleMouthRowsFor`, and the solver's `FIGHT_EXITS` (`jsRuntimeSolver.js:810-829`,
  slice `seedling-js-boss-wiring`).

### 2. How wasm takes it

The wasm page has no such check. Its arrival mapping (`wasmArrival.arrivalSolverGoal` → `solverGoalFor`) gives the same
`FIGHT_EXITS` goal (pinned by `jsRuntimeBossWiring.test.js`: `{kind: 'sequence', goals: [clear-tag {57,0}, reach-exit (96,64)]}`),
and the game plays it. On W1 (measuring branch `ece3957e`): `W1 #118 wasm-exit-57 … boot={"level":57,"x":96,"y":160} → SOLVED
9a2dd6e53352 keys=1830 work=216 [dashless:ok w65 t1830 h0 full:ok/window w151 t1830 h0]`. Then a continuation after the plan's
tick 1392: `W1 #119 wasm-continue-exit-57 prefix=1392 → SOLVED 9bb3364d43ce keys=260 [dashless:ok w16 t260 h0 full:ok/window w102
t260 h0]`. The page's status steps through `playing tick 376/1830` (t=1575 s), `819/1830` (t=1590 s) and `1258/1830` (t=1605 s).
At the next tick (t=1620 s) the walk stands in `level_58__r3c3` with `checked` 38 → 39 (the kill report). The next request is
`W1 #120 wasm-location-58 boot={"level":58,"x":48,"y":96}`. FW1 (merge tip, `eae3f6da`) repeats it: #121 `9a2dd6e53352` (1830 t,
h0), #122 `9bb3364d43ce`.

### 3. Is (6, 4) right?

**Yes.** The `.oel` placement (80,48) + the ctor (24,24) − the mouth offset (8,8) = (96,64) → tile (6,4). That is the rules'
`exit_tiles`, `FIGHT_EXITS[1].exitOf` (`c.x + ctorDx + mouthDx`), `levelSetValidator.js` `exitOffset: {x: 16, y: 16}`, and wasm's
`reach-exit (96,64)`. It is not a boundary-cell mis-derivation.

### 4. Every other exit the old check refuses

`evidence/census.mjs` / `census.out.txt` runs the old check (an `EXIT_TYPES` entity or a pit on one of `exit_tiles`) over every named
exit of every committed seedling preset whose payload level is a vanilla room:

| preset | named exits | refused by the old check |
|---|---|---|
| `seedling_playthrough` AP_1 and AP_14089154938208861744 (the 48-entry route's) | 320 | **2**: `level_57 out_tentaclebeast_80_48` [[6,4]], `level_69 out_lightbosscontroller_72_72` [[4,4]] |
| `seedling_er` AP_1 | 320 | the same 2 |
| `seedling_atlas`, `_atlas_host`, `_atlas_location`, `_atlas_sphere`, `_sphere_room`, `_spiral_room` | 6 / 6 / 4 / 34 / 6 / 8 | 0 (generated levels skipped, see below) |

So the class is **"an exit a boss fight adds"**: exactly the two `FIGHT_EXITS` rows. L69 is `LightBossController.endState`
(`:102-107`), in the room record as `lightbosscontroller 72 72 {"fliernum":"6","tag":"0"}`. ⚠ Caveat, named: the census reads the
**vanilla** atlas, so it cannot judge generated-room payloads. Its "refusals" in `seedling_generated_*` are false positives, because
the runtime checks those against the mounted set's own records, which hold their teleporters. The maze presets'
(`seedling_atlas_maze`, `seedling_playthrough_maze`) exits carry no `exit_tiles` (another substrate). Neither is this check's
class.

## The fix (`b5e93afb`)

The JS runtime asks the solver's own table (`jsRuntimeSolver.fightExitOf`, `FIGHT_EXITS`) of the live run. Nothing is typed for
(57, 6, 4): the row reads the room's own placement of the fight's entity and the model's offsets.

- `jsRuntimeCore.js` — new `fightExit(run, goal)`: `null` unless the run stands in the goal's level, else
  `fightExitOf(run, goal, roomSource().source)`. In `validateGoal`, an exit with no `EXIT_TYPES` cell and no pit is now accepted
  when `fightExit` binds it. With the solver mode off it is refused by name: *"level 57's exit at (96, 64) is the teleporter a boss
  fight adds when it ends: it is walked by the solver's fight, and the solver mode is off (`flashPanel.seedlingSolverWalk`)"*. Any
  other cell keeps the old refusal, word for word. The walker gets the same function (`fightExitOf` dep).
- `jsRuntimeWalker.js` — `resolve()` had its own refusal (*"no live teleporter or pit"*). A fight exit now resolves to the exit's
  cell with `fight` set, so the solver maps it (the fight, then the exit). With no solver, or the solver off, it is refused by name.
  A solver DECLINE of a fight exit now **fails** by the solver's reason, as an event or encounter leg does, instead of "walking
  instead": a walk to the cell fights nothing.
- Same acceptance as the solver: `fightExitOf` is the function `solverGoalFor` maps the goal by, so the check accepts exactly the
  exits the solver plays. Both rows need their fidelity switch (`tentacleBeastFight`, `lightsBossFight`, both shipped ON). With a
  switch off, the row binds nothing, and the exit is refused by its old text.
- Not touched: no engine / closure / solverBot / levelRun / contactFidelity / generator / tileStep file, no rules, preset or atlas,
  no `jsRuntimeSolver.js` edit, and not the clock.

### Diff stat (landing tip vs base `ac1d02e6fb`, before the merge) — 0 gitlinks

```
 frontend/modules/seedlingDemo/jsRuntimeCore.js     |  25 +++-
 .../seedlingDemo/jsRuntimeExitCheck.test.js        | 163 +++++++++++++++++++++
 frontend/modules/seedlingDemo/jsRuntimeWalker.js   |  22 ++-
 3 files changed, 207 insertions(+), 3 deletions(-)
```
Plus this report and its evidence directory. The merge adds origin/main's own changes (and no gitlink move).

## Tests (vitest, bounded) and their mutant reds

New `frontend/modules/seedlingDemo/jsRuntimeExitCheck.test.js`, 11 rows. The page rows boot the real vanilla map (`setVanilla` +
`new Game(level, x, y)`); the walker rows use a stub solver.

- the goals are the presets' own (L57 [[6,4]], L69 [[4,4]], the two pit arrivals);
- **now:** `walkTo` accepts L57's mouth; **now:** `walkTo` accepts L69's Lights exit;
- a cell that is no exit is **still refused by name**: (1,1) and (5,4), one cell off the mouth, in L57; (4,5) in L69;
- **now:** with the solver mode off, the mouth is refused by name;
- the run in another level binds no fight: the old refusal, word for word;
- **pits and placed teleporters unchanged**: L56's `out_pit_6_10`, L58's `out_teleporter_48_112` back to L57;
- walker: **now:** a fight exit resolves to its cell (`{target: (104,72), allowTeleporter: null, fight}`) and the solver is asked
  with it; no fight → the old refusal; **now:** solver off → refused by name; **now:** a declined fight exit FAILS by the solver's
  reason.

**Mutant reds** (`evidence/mutants.txt`, each file restored from a copy afterwards):

| mutant | result |
|---|---|
| m0 the BASE (both files at `ac1d02e6fb`) | **6 failed / 5 passed**: every "now" row reds |
| m1 `validateGoal`'s fight arm dropped | 2 failed (the two `walkTo accepts …` rows) |
| m2 the walker's fight arm dropped | 3 failed (the three "now" walker rows) |
| m3 the fight arm accepts any cell of the level | 1 failed ("a cell that is no exit is still refused by name") |
| m4a the core's solver-off refusal dropped | 1 failed |
| m4b the walker's solver-off refusal dropped | 1 failed |
| m5 a declined fight exit walks instead | 1 failed |

**Bounded vitest** (⚖ 52): the 80 default-tier test files that import `jsRuntimeCore` or `jsRuntimeWalker` (`grep -a -l`,
`.slow` excluded; list `evidence/vitest-bounded.files.txt`), `--maxWorkers=3`:
pre-merge `b5e93afb` **80 files / 1557 passed**; merge 1 `e136ff4b` **80 files / 1557 passed**; merge 2 `b040b2ea`
**80 files / 1557 passed** (`vitest-bounded-*.txt`). The suite
number for the pushed SHA comes from CI.

## Walk measure (seed 1, the SHIPPED limits, no `SEEDLING_*` env, a fresh page per walk, `walk-seedling-whole-game.mjs`, `--stall-s=300`)

The capture probe records every solve request (`TEST_MEASURE_CAPTURE_SERVICE=1`). The probe rows are in `<arm>.solves.txt`;
`sumcap.py` is the held-retry's.

| arm | branch / head | runtime | budget | checked | stop | cause (verbatim) | walk |
|---|---|---|---|---|---|---|---|
| **J1** | `measure` `ece3957e` | JS | 3600 s | **23/48** | entry 24 "Level 089 - Feather" in `level_57` | `refusal "error: level_57: the bot cannot walk to exit \"level_57 -> level_58__r4c1\" — the JS runtime's walk failed: the solver declined — solverBot(js-runtime-L57-exit) clear-tag {57,0} tentaclebeast@80,48: 'tentaclebeast' cannot act on tentaclebeast@80,48 with this run's bag — the tentacles' placements are `Math.random()` draws, and the run's stream has no declared seed for this room — solving… (budget 640 work units)"` | 1322 s |
| **J2** | `measure` `ece3957e` | JS | 3600 s | **23/48** | the same | the same, word for word | 1314 s |
| **FJ1** | `measure2` `eae3f6da` (merge tip) | JS | 3600 s | **23/48** | the same | the same, word for word | 1315 s |
| **W1** | `measure` `ece3957e` | wasm | 2400 s | **28/48** | entry 29 "Level 041 - Totem Part 240,144" in `level_61__r0c7` | `budget: the step's wait ran out` (by design) | 2400 s |
| **FW1** (control, merge tip) | `measure2` `eae3f6da` | wasm | 2400 s | **28/48** | the same entry and room | `budget: the step's wait ran out` | 2400 s |

**Before:** held-retry's MJ1/MJ2/FJ1 also reached 23/48, but stopped at the **exit check** (*"the JS runtime refused … no teleporter
or pit on tile (6, 4)"*), before any solve. **Now** the check passes, the walker hands the goal to the solver, and the stop moved
one layer in, to the solver's own verdict on the fight.

**L57 → L58, request by request**

| run | request | answer | plan ticks | model hits |
|---|---|---|---|---|
| J1 #163 / J2 #156 / FJ1 #162 | `js-runtime-L57-exit` budget 640, boot L57 (96,160), row (104,168), goal = the sequence (clear-tag {57,0}, reach-exit (96,64)) | **REFUSED `de3dfedeffe6`**, work 0 (both passes refuse at the strategy: no declared seed) | — | — |
| W1 #118 / FW1 #121 | `wasm-exit-57`, the same boot, row and goal | **SOLVED `9a2dd6e53352`** | 1830 (dashless and full) | 0 / 0 |
| W1 #119 / FW1 #122 | `wasm-continue-exit-57`, prefix 1392 | SOLVED `9bb3364d43ce` | 260 | 0 |

(The JS rows #162 J1 / #161 FJ1 at prefix 239 are the walk's ask from L56's landing coast. J1's was cancelled, FJ1's refused with
the same `de3dfedeffe6`.)

**The first entry after 23 that differs from wasm** is entry **24 itself** ("Level 089 - Feather", reached through L57). Entries 1-23
are checked on every walk, both runtimes. The last shared leg is byte-equal: L56's exit is `f51292dd0c6d` (280 ticks, h0) on J1, J2,
FJ1, W1 and FW1. The held-retry's MW1 and the diagnosis's W2 had the same entry-24 head in L57. The wasm walk takes it there.

**The next wall, named: the JS room boot's undeclared draw stream. It is JS-only.** The JS and wasm L57 requests
(`evidence/L57-request-diff.txt`) are the same `solverGoal`, `boot`, `live` row, `perTick`, `equips`, `budgetWork` and `source`.
They differ in `staging.rng` (JS `{"seed": 0, "split": false, "cosmetic": 0, "fp": 987286273}` — the page boot staging,
`procgenOracle.js:339`; wasm `{"seed": 980896863, "split": true, "cosmetic": 0}` — the live begin record, `wasmArrival.js:294-313`).
They also differ in `staging.seam.time` (4800 vs 43275: the clock), 21 fewer `persistence` rows on JS (other rooms' clears) and seam
fields JS leaves null. **Probe:** J1 #163 replayed with ONLY `staging.rng` replaced by W1 #118's
(`evidence/replay/l57-rngswap.*`) → **SOLVED `9a2dd6e53352`, 1830 ticks, 0 hits**, wasm's answer byte for byte. So at L57 the rng
block alone decides the refusal; the clock, the persistence rows and the seam nulls do not. (That is a statement about the request.
A live JS run would need its OWN declared stream, not wasm's seed. See the follow-ups.)

## Invariants

- **Closure-nil.** `node scripts/procgen/seedlingDerivedRuleTable.js --print-engine-closure`: 42 files, root
  `certifyPlaythroughMaze.js`, **engineMd5 `6c8cd75145bdf58d2eed7d7cc9e6b512`**, at base, pre-merge tip and merge tip. That is
  byte-equal to held-retry's `engine-closure-base-07787a89.txt` (origin/main then). The merge tip's diff vs origin/main `edb026f9`
  touches no closure file, so the md5 is origin/main's. diff ∩ closure = **∅** at base→tip and at the merge tip
  (`evidence/engine-closure-mergetip.txt`). At merge 2 `b040b2ea` (origin/main `9efa7489`): the same 42 files, engineMd5
  `6c8cd75145bdf58d2eed7d7cc9e6b512`, diff ∩ closure = ∅, 0 gitlinks in the diff vs origin/main.
- **No solver answer changed.** The replayer's import closure does reach both edited files (152 modules, measured), so this is a
  real check. Two sets were replayed (`replay-seedling-solve-request.mjs --n=1 --jobs=3`), at the tip and with both files restored
  to `ac1d02e6fb`:
  - held-retry's 20 captured requests (L22 / L40, both runtimes; `seedling-js-held-retry-evidence/replay.requests.jsonl.gz`):
    **20/20 identical** answer AND trace, base = tip (`replay/replay-{base,tip}.out.jsonl`), and each = the page's live answer
    (`replay-tip.txt`);
  - this slice's 5 L57/L58 requests (J1 #163, J2 #156, W1 #118, #119, #123; `l57.requests.jsonl.gz`): **5/5 identical**, base =
    tip = live (`de3dfedeffe6` ×2, `9a2dd6e53352`, `9bb3364d43ce`, `d638696bfa03`).
- **wasm path unchanged.** W1 and FW1 reach 28/48 (entry 29 by the budget), the same as held-retry's W1/MW1 (28/48, entry 29 by the
  budget), and pass L57/L58 with the same answers on both.
- `git status` clean on the landing branch after every restore. The tracked-file dirt was only from the restores, each undone at once.

## In-app rows

`npm test -- --mode=test-substrates --batch=seedling-js` at the merge tip `e136ff4b`: **45 run · 45 passed · 0 failed · 45
enabled · 0 not run**, 0 import failures (`evidence/inapp-seedling-js.txt`). **No in-app pin moved.** No test config, test case or
script cites the old refusal text (`rg -a "no teleporter or pit|no live teleporter or pit|level_57 -> level_58"` over
`frontend/modules/tests`, `frontend/test-configs`, `scripts`: 0 hits).

## Docs

No doc cites the check or its refusal text (`rg -a "no teleporter or pit|validateGoal" docs`: 0 hits), so no doc moved,
`check-procgen-docs.mjs` was not triggered, and no generated pin moved. `seedling-bot-log.md` and `architecture.md` were not edited.

## CI for js-24 to dispatch at the landing tip

- JSUT (`unittests_frontend.yml` default tier) and ut (`unittests.yml`) at the tip;
- the TT dispatch: fast-batch headroom vs the median of 3 main samples (STOP > +20 s or > 70 %);
- `test-substrates-manual.yml` `batch=tutorials-seedling` and `batch=tutorials-seedling-whole-game`;
- surveys END + 4.2 with **0 movers per step**;
- no `train_only` (the slice touches no solverBot / hammer / fidelity / generator / tileStep file).

## Follow-ups (asks, not built)

1. **The next wall: a declared draw stream for the JS room boot.** The JS runtime stages `rng {seed: 0, split: false}` at every room
   boot (`bootStaging`, `procgenOracle.js:339`, reached from `jsRuntimeCore.js` ~:688/695). The Tentacled Beast's verb needs a
   declared seed, `split: true`, and the room the only one built since the reseed (`solverBot.js` `resolveTentacleBeastStrategy`,
   `levelRun.js` `tentacleBeastFightNow`'s `streamRefusal`). Measured: with wasm's `rng` block, the JS request solves to wasm's
   answer. A JS fix would make the JS run's gameplay stream a declared one (reseeded per room boot, as `Bot.as` does for a tape) and
   stage it. That is the same `bootStaging` call as the clock, and it may touch `levelRun` / the tape staging, so it is outside this
   slice's licence. **Ask: one slice for the JS rng declaration; it is the wall at entry 24.**
2. **The clock** (`seam.time` restaged to 4800 at each JS room boot; wasm 43275 here). Still a separate ask, untouched. At L57 it
   does not decide the answer (the rng-swap probe solves with JS's 4800), but the diagnosis measured it moving L40's plan.
3. **To check once (1) lands, not measured here:** the mouth's arrival in L58. Wasm's first L58 request boots at `(48, 96)` (row
   (56,104)). The JS model's mouth row carries `TENTACLE_MOUTH_TO = {level: 58, x: 56, y: 96}` (`levelRun.js`, from
   `VanillaSet.as:142`). JS has never crossed the mouth, so whether its L58 arrival matches the game's is unmeasured. It is named
   here so the next JS walk past L57 compares the two.

## Evidence (`CC/docs/cloud-reports/seedling-js-l57-exit-check-evidence/`, 1.3 MB, no file > 5 MB)

- `J1/J2/W1/FJ1/FW1.summary.txt` (the walk line), `.solves.txt` (every captured solve, `sumcap.py`), `.measure.log.gz`;
  `seq.log`, `final-seq.txt`, `run-arm.sh`, `seq.sh`, `final.sh` (the exact commands; the raw captures (82–175 MB each) are not kept —
  the L57/L58 rows are in `l57.requests.jsonl.gz`);
- `L57-request-diff.txt` (JS vs wasm L57 request, field by field); `replay/` (both replay sets at base and tip, and the rng-swap
  probe's input and output);
- `census.mjs`, `census.out.txt` (Q4), `l57-record.mjs`, `l57-l69-record.txt` (Q1);
- `mutants.txt`; `vitest-bounded-premerge.txt`, `vitest-bounded-mergetip.txt`, `vitest-bounded-merge2.txt`, `vitest-bounded.files.txt`;
  `inapp-seedling-js.txt`; `engine-closure-mergetip.txt`, `engine-closure-merge2.txt`.
