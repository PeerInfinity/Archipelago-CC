# Seedling fidelity PITLATCH — one latch predicate for a door on a Pit tile

Slice `seedling-fidelity-pitlatch`, wave 27 (model coverage after R7), planner `seedling-fidelity-planning-11`.
PITPORT's review condition (js-8), behind PITPORT's own switch.

| | |
|---|---|
| Start SHA | `7c7fd95f07` (= `fidelity-harvest/pitport`: main `ba57be9a3d` + DRILLKILL (+ flip) + PITPORT, `pitTeleporterCrossing` OFF), as briefed |
| Harness branch | `claude/seedling-pitlatch-predicate-ad4joq` (the brief's local name `seedling-fidelity-pitlatch` was not used; only the harness branch is pushed) |
| Commits | D1 `934e1309` · D2 `71fc8fc2` · surface census `2a0e0732` · bot log + test header `a3bd2590` · reference `334bc807` · this report (the head, docs-only) |
| Dev server | `serve-nocache.py 9724` over the checkout; a pristine detached worktree at `7c7fd95f07` served on 9725 for every BEFORE / base-ON arm |
| Switch | none new: `CONTACT_FIDELITY.pitTeleporterCrossing` (PITPORT's), **OFF** |
| Verdicts | **W0 PASS · D1 PASS (two game witnesses, 0 px) · D2 PASS (OFF byte-inert; ON vs PITPORT's ON: 0 survey movers, 0 sweep movers on 43 legs) · Movers: STOP with the list below** |

## The one thing to know first

**The split was live, and only the step-off planner could see it.** At the base with the switch ON,
`stepOffCellFor` — the caller at `solverBot.js` ~4703 that plans with `allowTeleporter` = the latched door — planned a
walk off L43's latched pit door to (152,56) and off L100's to (296,88). On the game (D1) the Pit takes the player at
t0 of that step, respawns it ON the door every 20 ticks, and the door never fires. With the one predicate the planner
now calls that tile a pit and `stepOffCellFor` returns null, agreeing with `stepOffMinimalFor` (which already said
"falls" in every direction, at the game's own t1 position). Nothing else moves: no atlas arrival lands on a pit door,
and `findExitNamed` refuses a latched pit door before any step-off is asked, so the survey (239 steps) and the sweep
see no difference between PITPORT's ON and PITLATCH's ON.

## W0 — the base and the callers (PASS)

| row | command | result |
|---|---|---|
| base | the harness branch reset to `7c7fd95f07`; `session_bootstrap.sh --seedling` | `READY`, node v22 |
| identity block | `SEEDLING_PORT=9725 bash scripts/procgen/identity-block.sh /home/user/base-pitlatch` (venv on) | rc 0; maze `57e07d21`, acceptance `933c14f7`, c6 `430573e9`, c4 `ebb9e743`, enemy `f0bec576`, guard `a6d18d49`, area `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set OK |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `0dd65640`, all exit 0 |
| reference | in the block | **ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH** (this box has the submodules PITPORT's lacked) |
| surface / constants / entities / profile | each `--check` | GREEN **345** · PASS **6,899** · PASS **566** · PASS **138** |
| roster | `generate-tape-index.mjs --check` | **289** tapes |
| tapeRunner pairs | sorted `status\tfullName` of `tapeRunner.test.js --reporter=json` | **635**, md5 **`88fc7df4dd05d11dfd84ebbea675cc8e`** (= PITPORT's) |
| bounded vitest BEFORE | 114 files (below), base worktree | **3,859 passed, 0 failed** |
| route survey ON | `SEEDLING_PIT_TELEPORTER_CROSSING=1 survey-seedling-route.mjs --through=end --route=full`, base worktree | **239 steps: 185 SOLVED / 53 REFUSED / 1 TIMEOUT** |

The bounded set: the brief's standing list (`apReportBosses` = `fidelityApBosses` + `fidelityApFlip`; `fidelityStepOff2`
has no file of its own — its rows live in `fidelityStepOff`; `fidelityL32ArenaPrefix` is slow and not touched), plus
`fidelityPitPort`, `fidelityYeti`, `fidelityHousekeep`, `fidelityStepOff`, `fidelityDrillKill`, `seedlingSolverSurface`,
`seedlingConstantsCensus`, plus every non-slow test that names `liveDoorPitTile`, `pitLatchOpts`, `solverPlanOpts`,
`stepOffCellFor`, `stepOffMinimalFor`, `searchBaitOrdering`, `findExit`, `plannerObstacleAt`,
`unmodelled-pit-teleporter`, `pitdoor-witness`, `PIT_DOOR` or `latched` (`rg -al`). AFTER adds `fidelityPitLatch`
(115 files).

### The callers that can pass a door as `allowTeleporter`

`plannerObstacleAt` is reached through `isWalkableTile` → `planTilePath` / `nearestGoalNode` / `plansReach`'s floods,
and through `controllerPathClear` / `stringPullBlockedAt` (SP's memo) → `stringPull`, all inside `planWaypoints` with
the caller's `opts` passed through unchanged. SP's memo is built inside ONE `planWaypoints` call and keyed on the point
alone, so a new opts key does not enter any memo key: nothing in `planWaypoints` or its memo was edited.

| caller | the door | the bag | threaded |
|---|---|---|---|
| `solverBot.stepOffCellFor` (~4703, the step-off) | the LATCHED door | `solverPlanOpts` (24902) | ✅ via `solverPlanOpts` |
| `solverBot.exitAimFor` (~4885) | the goal door | `solverPlanOpts` | ✅ |
| `corridorPlans` / `plansExactly` (~7225, ~7513) | goal door | `solverPlanOpts(…, {liveBag})` | ✅ |
| `baitForecastOf`, `deriveChaserDetour`, the stance scans (~18773 – 19570, 19814) | goal door | `planOpts` = `solverPlanOpts(run, contacts)` | ✅ |
| `bulbPlacement.needVerdict` (`plansReach`) | a need's door | `() => solverPlanOpts(run, senseContacts(run))` (25631) | ✅ |
| the reach-exit walk and its rungs (~21731 – 24391) | goal door | `solverPlanOpts(run, contacts, …)` | ✅ |
| `crusherBait.searchBaitOrdering` → `plannerObstacleAt(world, …, tp, c.opts)` | `allowTeleporter` | `{...run.liveGeometryOpts(), …}` — NOT `solverPlanOpts` | ✅ new `latchOpts` argument, passed `pitLatchOpts(run)` by `solverBot` (~937) |
| `botDriverV2.drive`'s leg (`planNow`, 6485) — the walker | the leg's exit | `planNow()` | ✅ (⚠ JS-arc review) |
| `jsRuntimeWalker.js` 154, 458 | the step-off door / `r.allowTeleporter` | its own `opts` | ❌ **the JS arc's file — not edited; to wire** (below) |

## D1 — the game witness (PASS)

`scripts/procgen/probe-seedling-pit-doors.mjs` gains two witnesses (`hold`: the keys held from the first tick):

| witness | staging | tape | game | model |
|---|---|---|---|---|
| `l43-latched` | `r8-solve-11`'s block re-pointed at L43, booted ON `teleporter@144,64` (the player at (152,72); the boot latches the door), tags 0/4/5 cleared as `l43-south` | `up` × 70 (toward the ring's north tile (9,3)) | t0 → (152,71.28), **the Pit takes the player**; respawn ON the door at **t20, t40, t60**; never crosses; final (152,71.35) in L43 | **0 px every tick** |
| `l100-latched` | L100, booted ON `teleporter@288,96` (296,104) | `left` × 70 (toward the corridor) | the same: t0 → (295.28,104), respawns **t20/t40/t60**, never crosses | **0 px** |

Run: `SEEDLING_PORT=9724 node scripts/procgen/probe-seedling-pit-doors.mjs --host=http://localhost:9724
--only=l43-latched,l100-latched --out=…` → **ALL CHECKS PASSED** (6 checks); fixtures
`fixtures/pitdoor-witness/pitdoor-l43-latched.json`, `pitdoor-l100-latched.json`. With the switch ON and OFF alike the
model's stream is the game's (`fidelityPitPort`'s D1 loop now covers eight witnesses).

**What the game does on the arrival tick and the step:** the latch HOLDS (the door does not fire while the box stays
on its rect, and it cannot leave the rect: the box moves 0.72 px before the fall freezes input), and the Pit takes the
player on the first tick its probe point is on the pit — tick 0. `die()` → `restartLevel()` respawns on the door,
latched again: a death loop. So the planner must treat a latched pit door's tile as a pit, and there is NO step-off
from one.

## D2 — the predicate (PASS; switch OFF, byte-inert)

**Change** (`71fc8fc2`):
- `botDriverV2.liveDoorPitTile(level, index, latched = null)` → null when `latched?.has(index)` (before any other read;
  still null OFF before anything).
- `findExit`: `pitTiles.some(…) && liveDoorPitTile(level, i, latched) === null` — the same meaning as PITPORT's
  two-predicate condition, now one.
- `plannerObstacleAt`: new opts key `latched` (default null), read ONLY by the pit arm's `liveDoorPitTile(level,
  allowTeleporter, latched)`.
- new export `pitLatchOpts(run)`: `{latched: run.state.latched}` under `pitTeleporterCrossing`, `{}` OFF — so every
  OFF bag is the bag it was, key for key.
- threaded: `solverPlanOpts` (now **exported**, for its row) spreads `...pitLatchOpts(run)` before `extra`; the walker's
  `planNow` spreads it before `extra`; `crusherBait.searchBaitOrdering` takes `latchOpts` (default `{}`) into its
  per-config `c.opts`.
- `normalizeLiveOpts` untouched (the latch is a planner opt beside `allowPit`, not a live family). No
  `planWaypoints` / memo / escape / `stateDigest` edit. No new run field, no per-visit map (no digest question:
  `state.latched` is already run state). No `SolverRefusal.obstacle.kind`, no staging/result field. No signature
  change to `solveSegment` / `twoPassSolve` / `PendingDeclaration` / `createRunForStaging`.

**Rows** (`fidelityPitLatch.test.js`, 6; `fidelityPitPort.test.js`'s verdict row now reads "the shut or latched one
never"):

| row | asserts |
|---|---|
| the one predicate (the row js-8 asked) | L43 and L100: ON, `liveDoorPitTile(w, i, {i})` null; `plannerObstacleAt(w, centre, i, {latched: {i}})` → `{kind: 'pit', blocker: tile}`; unlatched → null; latched on another index → still the door; `isWalkableTile` false latched / true unlatched; OFF: pit either way |
| `pitLatchOpts` | ON `{latched: run.state.latched}`, OFF `{}` |
| `solverPlanOpts` | ON carries the run's own set; OFF has no `latched` key; the planner under it says `pit` at the latched door |
| the game | both witnesses: never cross, respawns `[20, 40, 60]`, stay in the level |
| `stepOffCellFor` | null ON and OFF on both latched doors (the base, ON: (152,56) / (296,88)) |
| `stepOffMinimalFor` | every direction "falls at", and the held direction's position IS the game's t1 |

**Mutants** (predicted first; copy and restore; the three files md5-identical after; ran `fidelityPitLatch` +
`fidelityPitPort` + `fidelityStepOff`, 66 rows):

| mutant | predicted | measured |
|---|---|---|
| M1 `liveDoorPitTile` ignores `latched` | 4 red (predicate, step-off cell, solverPlanOpts, PITPORT's latched row) | **4 red** |
| M2 `pitLatchOpts` always `{}` | 3 red (its row, solverPlanOpts, step-off cell) | **3 red** |
| M3 the pit arm drops `latched` | 3 red (predicate, step-off cell, solverPlanOpts) | **3 red** |
| M4 `solverPlanOpts` drops the spread | 1 red | **1 red** |
| M5 `crusherBait` drops `latchOpts` | 0 — survives: no crusher room holds a pit door | **0 red (survived)** — named residue |

A mutant of the walker's `planNow` spread would survive too: its only door-passing call (6485) follows `findExit`,
which refuses a latched pit door first. Both are defence in depth, not reachable behaviour.

**The step-off case, planned as the game behaves.** The solver path never reaches the step-off for a pit door
(`findExitNamed` throws `unmodelled-pit-teleporter` for a latched pit door, as PITPORT left it — the name stays; the
death loop IS what the game does, so a refusal is correct). Under the predicate, both step-off planners now agree with
the game if anything ever asks: `stepOffMinimalFor` (falls) and `stepOffCellFor` (null).

## The movers — and the CI dispatches

| surface | base ON (PITPORT) | head ON (PITLATCH) | head OFF |
|---|---|---|---|
| route survey, local, `--through=end --route=full` (match by (level, goals, boot)) | 239: 185 / 53 / 1 TIMEOUT | **= base ON, 0 movers** | 239: 185 / 53 / 1; **OFF → ON 4 movers, all REFUSED → REFUSED (words), 0 verdicts** (below) |
| bounded vitest (115 files) | — | **3,862 passed, 2 red** (= PITPORT's flip list exactly) | **3,867 passed, 0 failed** |
| six producer `--check`s | = W0 | **= W0** (`SEEDLING_PIT_TELEPORTER_CROSSING=1`, all six md5-identical, exit 0) | = W0 (the block) |
| tapeRunner pairs | 635 `88fc7df4…` | — | **635 `88fc7df4…`** |
| identity block | W0 | — | **every row = W0** (`generated set` re-run alone: OK, see residue) |
| keyed sweep (43 legs, local, p4g, `inv`, solver, page-legs 1) | 29 done / 14 failed | **= base ON, 0 movers** (end, refusal words, final position, plan ticks — the wand legs' sub-pixel ends included) | 28 done / 15 failed; **OFF → ON 15 movers, all the doorless keys** (below) |

**The survey's OFF → ON movers at this base** (step numbers are this base's local numbering; match by (level, goal,
boot)):
- step **111** (L58, `reach-exit (80,16)`): `stands ON a PIT tile` → `the re-planned corridor failed too … waypoint 1
  (72,56): not reached within 400 ticks; stalled at (56.83,55.93)` — PITPORT's handed-over Yeti-Solid stall (with
  `yetiTalk` ON on this base the door is live on this step; PITPORT's base had it shut);
- step **135** (L43, wand + door): → `no corridor … Obstacle: solid:fallrock (fallrock@176,384)`;
- step **155** (L43, totem skipped + door): → `no corridor … Obstacle: pickup:wand (wand@144,224)`;
- step **218** (L100, booted at the L99 stairs): → `no corridor … Obstacle: pixelmask:cliffside0`.

**The sweep's OFF → ON movers** (43 legs: this base's 28 pit-room keys, ids 409–434 / 496 / 756, plus the 15
doorless keys of the js tool, ids 872–884 / 904 / 923 in its derivation; one sample per arm; the ON arm's
`contactFidelity` stamp is the 50 default-ON keys + `pitTeleporterCrossing`, read off the CONTACT line):
- the **28 pit-room legs: 0 movers** (none asks for a pit door);
- **L58 r1c4 (`level_58__r1c4 <- in_tentacle_beast_mouth_L57_56_96 ~> level_58__r4c1 -> exit:out_teleporter_80_16`,
  id 904): `failed` (`stands ON a PIT tile (5,1)`) → `done`, crosses to L46 (360,136) in 104 t (`walk`, dashless + full
  passes ok)** — the one verdict mover;
- **L43 r3c8 ×13 (872–884): `failed` → `failed`, words**: pit door → `no corridor … Obstacle: solid:bosstotem
  (bosstotem@152,168)` (the leg arrives from L40 with the boss unfought);
- **L100 r4c10 (923): `failed` → `failed`, words**: pit door → `no corridor … Obstacle: pixelmask:cliffside0`.

**Dispatches for the planner** (none was possible from this session):
1. **Survey A/B** (`seedling-survey.yml`, `through=end route=full`) on this branch and on a copy with
   `pitTeleporterCrossing: true` as the default. Expected: the four wording movers above (L58 / L43 ×2 / L100 by
   (level, goal, boot)), 0 verdict movers; and the ON arm identical to the same dispatch on `fidelity-harvest/pitport`
   with the default true (PITLATCH's delta: 0).
2. **Sweep A/B** (`seedling-divergence-sweep.yml`, this branch, `mode=inv producer=solver page=seedling_bot_ap_p4g
   page_legs=1`, ×2 each; then `producer=walker` ×2), `keys=` the 28 pit-room keys of this base's derivation (ids
   409–434, 496, 756: the `level_43__r13c7`, `level_58__r4c1`, `level_100__r2c3` rows of
   `seedling-divergence-legs.mjs --out=legs.jsonl --presets=seedling_playthrough --blocks`):
   - A: default inputs; B: `contact_fidelity=` the 50 default-ON keys of this base (49 + `drillKillFirst`) **plus
     `pitTeleporterCrossing`** (51 keys; read the plan's `contactFidelity` stamp, not the run title).
   - Expected: 28/28 `done` both arms (measured locally, one sample: 28/28 `done` OFF, ON and base ON).
   - ⚠ **The 15 js doorless-legs keys cannot be dispatched on this branch:** `seedling-divergence-legs.mjs` here does
     not derive door-less sub-regions, so `pickLegs` throws on them. They need a branch carrying
     `origin/seedling-js-doorless-legs`' leg tool (`9588c507a5`) on top of this one. Their keys, derived with that tool
     against this base: `level_43__r3c8 <- in_L40_320_576 ~> level_43__r13c7 ~> level_43__r8c7 ->
     exit:out_teleporter_144_64` and the same for the 12 `in_pit_L40_{4,5,13,14}_{20,21,22}` / `in_pit_L40_{4,5}_23`
     arrivals (13), `level_58__r1c4 <- in_tentacle_beast_mouth_L57_56_96 ~> level_58__r4c1 -> exit:out_teleporter_80_16`,
     `level_100__r4c10 <- in_L99_48_96 ~> level_100__r2c3 -> exit:out_teleporter_288_96`. Expected (measured locally,
     one sample): OFF → ON, L58 r1c4 `failed` → `done`, the other 14 `failed` → `failed` by new words.
3. **`seedling-probe.yml battery=standard`** on a copy with the default `true`. Expected: PITPORT's two
   `arrival-composites` D rows (`moved L43 pit door`, `moved L100 pit door`) `named` → `cross`, nothing else; and no
   difference from the same dispatch on `fidelity-harvest/pitport` with the default true (those legs arrive at
   (144,48) / (288,80), off the door: the latch set never holds the door). **Not measured locally** (residue).

## The JS arc: what it must review and wire

- **Review (the walker):** `botDriverV2.findExit`'s condition (one predicate now, same meaning), `liveDoorPitTile`'s
  third argument, `plannerObstacleAt`'s `latched` opt, `pitLatchOpts`, and the one spread in `drive`'s `planNow`. OFF:
  byte-identical (no key added). ON: `planNow`'s door-passing call follows `findExit`, which refuses a latched pit door,
  so no walker plan moves. `producer:walker` sweep rows: not run locally (the solver arms took the session's box
  time); expected none, by the same argument — the walker A/B in dispatch 2 measures it.
- **Wire:** `jsRuntimeWalker.js` 154 (`stepOffPoint`: `planWaypoints(world, from, {x, y}, index, opts)` with `index`
  = the latched door) and 458 (`planWaypoints(…, r.allowTeleporter, …)`) should spread `pitLatchOpts(run)` (or pass
  `latched: run.state.latched` under the switch) into their opts. `stepOffPoint` is the JS runtime's twin of
  `stepOffCellFor` and has the same hole while the switch is ON.
- No new staging field, result field or `SolverRefusal.obstacle.kind`; no `run.*` field renamed or reshaped
  (`seedlingSkinRenderer` green both arms). New exports: `pitLatchOpts` (botDriverV2), `solverPlanOpts` (solverBot).

## Handed over

- Nothing to the hammer arc: no escape-read state, no `stateDigest` change, `planWaypoints` and SP's memo untouched.
- PITPORT's L58 Yeti-Solid stall (the A* edge (56,56) → (72,56) clipping `yeti@56,56` by 0.07 px) is now ALSO a route
  survey row (step 111) at this base, because `yetiTalk` is ON here. Still `planWaypoints`' region; still not edited.
- The sweep's L43 r3c8 legs refuse on `bosstotem@152,168` (the totem stands until its fight; the leg arrives from L40
  with the boss unfought) and L100 r4c10 on the cliffsides — the next obstacles, not the door.

## What the brief got wrong (measured)

1. *"ARRIVE on a door that stands on a Pit tile (L43 from L37, or L100's / L58's — whichever arrival the atlas
   offers)"*: the atlas offers NONE (PITPORT's census: no arrival lands on any of the three; L37 → L43 lands at
   (144,48), off the rect). The witnesses stage the arrival with a boot on the door, which the game latches exactly as
   an arrival would (`Teleporter.check()` on a new `Game`'s first frame).
2. *"js doorless-legs' 15 pit-teleporter keys — derive at your base"*: this base's leg tool does not derive them (850
   legs, no `level_43__r3c8` / `level_58__r1c4` / `level_100__r4c10` rows). They come from the doorless branch's tool
   (928 legs at this base: ids 872–884, 904, 923). They also cannot be dispatched by key on this branch (above).
3. *"expect only the two `arrival-composites` pit-door legs `named` → `cross`"*: right for the FLIP, but PITLATCH
   itself moves no probe row — both arms of PITLATCH vs PITPORT are expected identical (not measured locally).
4. The survey's flip movers at this base are FOUR, not PITPORT's three: L58 step 111 joins (yetiTalk is ON on this
   base, so the door is live on that step).
5. The flip's sweep movers are not PITPORT's "28 pit-room keys, 0 movers" alone: on the doorless keys the flip has a
   **verdict** mover, L58 r1c4 `failed` → `done` (crosses to L46 in 104 t), plus 14 wording movers.

## Residue

- The wasm probe battery was not run locally (dispatch 3); the prediction is argued from the arrivals' positions.
- Sweep: one sample per arm, solver only (`producer=walker` and the ×2 repeats left to dispatch 2); the six-arm chain
  was cut to three arms to fit the session.
- The identity block's `generated set` row at the head was not measured: `check-seedling-generated-set.mjs` met the box
  lock my own queued sweep had just taken (the row printed the lock's notice). Re-run alone afterwards with the venv and `SEEDLING_PORT` set (`SEEDLING_PORT=9724` / `9725 node scripts/procgen/check-seedling-generated-set.mjs`): **OK at the head and at the base** — the row is equal; the block is complete.
- M5 (crusherBait) survives by construction: no crusher room has a pit door.
- The step-off from a latched pit door is a death loop on the game; nothing in the atlas reaches it.

## Byte-inertia

OFF is byte-identical to the base: `pitLatchOpts` returns `{}` and `liveDoorPitTile` returns null before reading the
latch, so no OFF bag gains a key and no OFF branch changes. Measured: identity block rows = W0, six producers = W0 OFF and ON, tapeRunner 635 pairs `88fc7df4…`, constants 6,899 / entities 566 / profile
138 / roster 289 unchanged, bounded vitest OFF 0 red. The surface census moves by the new sites only (345 rows;
`run:state` 678 → 679, `state:latched` 4 → 5, `import:contactFidelity.js#CONTACT_FIDELITY` 90 → 91 sites; `--write` in
`2a0e0732`). The reference moves by the bot-log entry only (docs index; `334bc807`).

## Records

- Bot log: "Seedling fidelity PITLATCH", with two trap candidates.
- Witness fixtures `fixtures/pitdoor-witness/pitdoor-l43-latched.json`, `pitdoor-l100-latched.json`; the instrument
  `probe-seedling-pit-doors.mjs` extended (already a box-lock taker on `boxLock.test`'s list).
- Surface census `--write` (345 rows). Reference regenerated for the bot-log entry (`docsIndex.js`, the README
  index row). No tape index or roster change (289 tapes).

## CI at the last code head

`node scripts/procgen/ci-vitest-summary.mjs 334bc80731` (run **40013542818**, conclusion success, the browser and
headless gate shards included): **vitest 22,317 passed, 0 failed; slow battery 265/265.** Earlier heads: `71fc8fc2`
(run 39988100740) 1 red — the surface census before its `--write` (`2a0e0732`, which the path filter did not run);
`a3bd2590` (run 40008070852) 3 reds + two gate shards' UNEXPECTED-RED `procgen-reference` — the bot-log entry moved the
docs index (words, headings: `docsRender`'s two heading rows, `generated.test`'s `--check`), fixed by `334bc807`. This
report's commit is docs-only (`CC/docs/`, outside the trigger paths and the docs index).

## Rows to BANK

- `pitTeleporterCrossing` (still OFF): PITLATCH's ON delta vs PITPORT's ON = **0** survey (239 steps), 0 sweep (43 legs).
  Flip movers at this base: survey 4 wording (L58 111, L43 135/155, L100 218), 0 verdicts; sweep 28 pit-room legs 0,
  doorless keys 15 (L58 r1c4 failed → done; L43 r3c8 ×13 and L100 r4c10 words); bounded vitest ON 2 reds
  (the defaults pin; housekeep's step-113 row); producers ON = OFF.
- Game witnesses (p4g, 0 px): `pitdoor-l43-latched` 70 t, `pitdoor-l100-latched` 70 t — never cross, respawns t20/40/60.
- `stepOffCellFor` on a latched pit door: null (was (152,56) / (296,88) at the base ON).
