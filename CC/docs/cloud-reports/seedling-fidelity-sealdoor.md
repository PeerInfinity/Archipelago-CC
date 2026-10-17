# Seedling fidelity SEALDOOR — the FinalDoor's open-on-approach, in the solver

Slice `seedling-fidelity-sealdoor`, wave 18, planner `seedling-fidelity-planning-8`.

| | |
|---|---|
| Start SHA | `d1fbfeffc2` (= main; wave 17 harvested OFF) |
| Harness branch | `claude/seedling-finaldoor-sealdoor-156b48` |
| Commits | `24dfc601` D2 · `e9a8a9bd` roster pins · `0f7797c5` bot-log + reference · this report |
| Verdicts | **W0 PASS · D1 PASS (the nine refusals are HONEST) · D2 PASS (switch built, OFF; STOP for the flip) · D3 PASS (nothing in the room blocks next; the STATE does)** |

## The one thing to know first

**The nine L113 legs do not hold the door's predicates, so the game would keep the door shut too.** The brief read
"every one holding all 16 Seal parts" off the sweep's AP inventory. The game's save holds **no seal slot**:
`flashBridgeAdapter`'s classifier drops `!seal`, because it is neither progressive nor a fusion
(`flashBridgeAdapter.js:784`). No leg has talked to the Watcher either.

Measured on the game: leg 804's captured worker request has `staging.save.seal_parts = []` and `persistence = []`.
Survey step 221 stages the same: its 16 Seals are `unpresentable`, and the route never visits L114.

The model was still missing the door's verb. `sealDoorApproach` adds it, and with it the solver states which predicate
fails. With both predicates held, all nine goals solve, and the plans play on the game at 0 px.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `d1fbfeffc2` on the harness branch | bootstrap `READY`, node v22.22.0; server PID 508 on 9686; a base worktree at `/home/user/base-wt` (submodules symlinked), served on 9687 |
| CI baselines | `survey-seedling-shards.mjs --fetch=38926053841`; `gh run download 38926058850` | both fetched. The sweep's L113 rows reproduce: legs 804, 805, 811, 812, 818, 819 refuse ITEM-GATE; 806, 813, 820 `no-verb` |
| identity block (venv on) | `SEEDLING_PORT=9687 bash scripts/procgen/identity-block.sh .` in the base worktree | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `36b59445`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK |
| six `--check`s | the same block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `6b1bf15c`, all exit 0 |
| reference | the same block | "4 GENERATED MODULE(S)/REGION(S) DIFFER", a box artifact: no `frontend/modules/bulletml-dodge` checkout, so the noiz2sa substrate rows drop. Same at head |
| tapeRunner pairs | `status\tfullName` sorted from the vitest JSON | **611 `86af8525`** |
| bounded vitest BEFORE | 123 files: the brief's standing list plus every non-slow test naming `refineStrategy`, `frontierExecutor`, `clearTagExecutor`, `OBSTACLE_STRATEGIES`, `obstacleGateFor`, `KNOWN_STRATEGY_VERBS`, `CONTACT_FIDELITY_KEYS`, the final door's readouts, `clear-tag`, the tape roster or the censuses | **4,336 passed, 0 red** |

⚠ I made the first edits before banking W0. So W0 was measured at a clean detached worktree of the start SHA rather
than in this checkout; nothing tracked there was touched.

## D1 — the game witness, and the legs' state (PASS)

**The rule was already witnessed.** `r6-final-door` and `r6-final-door-control` (R6 slice 6c) were replayed on p4f at
this base (`check-seedling-bot-differential --only=r6-final-door,r6-final-door-control`): **51 PASS / 0 FAIL**.
- With 16 seals and `{114,0}`: the SealController fires at t36 with 181 dead frames, and "open" plays at t37 on the same
  approach.
- `animEnd` is 56 ticks later (t93). The wall leaves one tick after that, because `updateLists` runs after the
  Player's sweep.
- The control, which never talked to the Watcher, fires the same ceremony (its text is "Face the Watcher and return")
  and never opens.

**The nine legs' state** (the sweep runs one fresh page per leg):

| legs | seal slots in the game save | `{114,0}` (Watcher talked) | refusal |
|---|---|---|---|
| 804, 805, 806 (from L112) | **0 / 16**, measured on the game (leg 804's captured request) | **not set**, measured (`persistence = []`) | honest |
| 811, 812, 813 (from L114 @16,144) | 0 / 16 (same bridge path) | not set (the arrival is a jump, not a walk past the Watcher) | honest |
| 818, 819, 820 (from L114 @80,144) | 0 / 16 | not set | honest |

The seal slots stay empty because:
- An AP `Seal` is `!seal` in `games/seedling.json`, and `flashBridgeAdapter`'s inventory classifier pushes a `!` name
  only if it is a progressive rung or a fusion flag. `!seal` is neither, so nothing writes `Main.hasSealPartSet`.
- The live delivery test says so too ("a delivery the game cannot SEE (a Seal: no write)").
- The route survey states the same per step: `'!seal' copy N has no rung (progressive_items: null)`.

The Watcher flag stays unset because the rules carry the talk as *implied*, not as an item
(`seedlingPlaythroughOverlay.COMPLETION`: "free and on the near side of the FinalDoor").

## D2 — the verb (PASS; switch OFF, STOP for the flip)

**Change.** `CONTACT_FIDELITY.sealDoorApproach` (default `false`; `SEEDLING_SEAL_DOOR_APPROACH=0|1`).
- `refineStrategy` selects `approach` for `solid:finaldoor` while the switch is ON. The shared `OBSTACLE_STRATEGIES`
  table is untouched, so OFF it still answers "no row", byte for byte.
- `frontierExecutor` and `clearTagExecutor` register `execApproach` only while ON; `resolveObstacleStrategy` routes to
  `resolveApproachStrategy`.
- `resolveApproachStrategy` reads the door's two predicates from the run's OWN state: the new read-only
  `run.finalDoorGate = {talkedToWatcher, hasAllSealParts, sealSlotsFilled, sealSlots}`. `levelRun.finalDoorGateNow` now
  holds the two expressions `stepFinalDoorsNow` used to compute inline, with the same values.
- When a predicate fails, it **refuses by name** before a tick is spent. The message says which predicate fails and
  what the run holds, quotes the ceremony text the game would show, and names the work order: the Watcher's `talk` in
  L114 and/or the seals.
- Otherwise it picks a stance 36–48 px from the entity point (128,16).
- `execApproach` holds toward the entity point until "open" plays (the 181 dead frames land on the trigger tick), then
  releases. It waits until the `removed` row's `wallOpensAt` has passed. The frontier then re-plans the exit through the
  doorway.
- `approach` joins `KNOWN_STRATEGY_VERBS`, above `pace`.

**Measurement (node, `fidelitySealDoor.test.js`):**

| state | 3 arrivals × {exit 112, exit 128, clear-tag} |
|---|---|
| OFF | the base's refusals, word for word (ITEM-GATE; clear-tag `no-verb`) |
| ON, 16 seals + `{114,0}` | **9 / 9 solve by `approach`**. From L112: stance (104,56), ceremony t89 (181 dead frames), open t90, removed t146, wall t147. The exits enter L115 at t166/t167 |
| ON, no Watcher talk | refused: "{114,0} is SET — the Watcher in L114 has not been talked to this run" |
| ON, no seal slots (the sweep's state) | refused: "the save holds 0 of 16 seal slot(s) and its LAST slot is empty" |
| ON, 15 seals | refused: "15 of 16 …": the last slot is what counts |
| ON, the clear-tag, either missing | `obstacle.reason: 'unresolved'`, with the same sentence |

**Witnesses, game-recorded** (`plan-seedling-sealdoor-witness.mjs`; `check-seedling-bot-differential --record
--only=sealdoor-l113-clear,sealdoor-l113-exit,sealdoor-l113-noseal-control`, p4f, port 9686: all PASS, 0 FAIL). All
three are staged from `r6-final-door`'s game-recorded block, re-pointed at the sweep's arrivals:
- `sealdoor-l113-clear`: leg 806's clear-tag from (64,128), 148 t. The game reports "finaldoor@112,0 -> 113:0 off (open
  90, removed 146)", with 201 dead = 181 modelled + 20 load residue.
- `sealdoor-l113-exit`: leg 811's exit from (16,16), with canSwim, 205 t. Open 128, removed 184, then the crossing into
  L115.
- `sealdoor-l113-noseal-control`: the clear plan's keys with `seal_parts: []`, the sweep's own state. The game reads
  `hasSealPart` all -1, and "the FinalDoor the run did NOT open kept its flag — {113,0} still set, with the approach
  driven and the seal ceremony run".

The model replays all three at 0 px (the 6 new tapeRunner pairs pass).

**Mutants** (predicted first, then made by copy and restore; `solverBot.js` md5 identical before and after):

| mutant | predicted | measured |
|---|---|---|
| M1: drop the `refineStrategy` clause | the 9 ON solves, the 5 ON refusals and the witness-plan row go red; OFF stays green | **15 red**, as predicted |
| M2: keep the hold through the wait | the walk reaches the L115 teleporter mid-verb; the ON solves go red | **⛔ SURVIVED (0 red).** The wait ends at `wallOpensAt`, and one held tick into the doorway does not reach the teleporter. The release is a CHOICE, not a requirement. I corrected the executor's comment and pinned the plan to the recorded tape key for key; M2 is now **1 red** (the witness pin) |
| M3: skip the predicate check | the 5 by-name refusal rows go red | **5 red**, as predicted |

## D3 — what is next behind it (PASS: no room solid; the state)

- **The frontier solids block nothing.** `ruinedpillar@64,32`, `dungeonspire@112,96` and `@32,96` were only listed "also
  on the frontier". With the predicates held, all 9 goals solve past them, so there is no census to do.
- **What blocks the nine legs next is the STATE.** None of it is an L113 model gap:
  1. **The seal slots** (bridge, the JS arc's `flashPanel/*`): an AP `Seal` must write `Main.hasSealPartSet(slot,
     identity)` for the game's door to open. Until that happens, the game itself refuses the door on every AP run, not
     only in the sweep. **This is the largest finding of the slice.** The AS3 bot API already has the channel: a
     botStart save block writes `saveSealParts` (`Bot.as:1763-1776`).
  2. **The Watcher's `{114,0}`**: a cross-room prerequisite. The `talk` verb exists and is game-witnessed
     (`watcher-l114-talk`), but a single `solveSegment` cannot chain L114 → L113. The rules treat it as implied; a
     harness could stage it (`--stage-flags=<key>=>114:0`), as with the event-gated arrivals.
- **The location goal's pre-check is a second spelling.** `jsRuntimeSolver.clearTagVerbOf` (the JS arc's) mirrors
  `refineStrategy` + `clearTagExecutor`, so ON it still answers `no-verb` for legs 806, 813 and 820. The ON bounded run
  caught it: `jsRuntimeSolverEventGoal.test.js` "clearTagVerbOf agrees with the solver's own clear-tag" goes red.

## The movers ON (the licence's list)

| surface | OFF | ON |
|---|---|---|
| survey (local, `--through=end --route=full --only=220,221,222`) | = CI 38926053841: 220 REFUSED (rocklock), 221 REFUSED (ITEM-GATE), 222 SOLVED 173 | **221 REFUSED → REFUSED**, its text now the named predicates (0/16 seals, `{114,0}` SET); 220 and 222 unchanged. No other step can move: the door is the game's only `FinalDoor` (`finalDoorL113.test`: L113 holds exactly one), and the switch acts only where a frontier or a clear-tag names `solid:finaldoor` |
| sweep legs (node bare pass, the sweep's delivered set, `SEEDLING_SEAL_DOOR_APPROACH=1`) | 804, 805, 811, 812, 818, 819 refused ITEM-GATE; 806, 813, 820 no-solver-goal `no-verb` | **804, 805, 811, 812, 818, 819: refused → refused**, now naming "0 of 16 seal slot(s) … {114,0} is SET". 806, 813, 820 unchanged until `clearTagVerbOf` is wired, then they become refused `unresolved`, same sentence. No `producer:walker` row moves (the walker is untouched) |
| committed tapes / tapeRunner pairs | 611 `86af8525` | **611 `86af8525`** (+ 6 new sealdoor rows, all pass); no committed tape moves |
| six producer `--check`s | base values | **identical ON** (all six, exit 0) |
| identity block | head OFF = base, every row | not re-run ON in full: no generated or identity room holds a `FinalDoor`, and the six producers equal the base ON |
| `campaignChain` / L113 endgame tapes | — | none move: `campaignChain` has no L113 row; `r6-final-door` and its control replay tapes, not the solver |

**Bounded vitest** (124 files: W0's 123 plus `fidelitySealDoor.test.js`):
- **OFF:** 4,362 passed. 4 red before the roster re-pins; 3 of those were re-pinned by name (`dialogueAutoAdvance`,
  `observationTolerance` (also `swapped` 280, measured), `tapeEnvelope`: +3 → 280), and those files re-run green.
- **1 red OFF stays: `rosterCategories`** "the LIVE row carries one part per derived category". The standing-values
  roster row's `mechanic` part is 217; the remainder tier now holds 220. The re-pin needs `standing-values --write`,
  which this brief forbids. **Owed by the planner.**
- **ON:** 4,361 passed, 5 red. Every red is a re-pin the flip owes:
  1. `rosterCategories`: as OFF.
  2. `contactFidelity` "the shipped defaults": the defaults pin, read under the env override.
  3. `fidelityClearTag` "{113,0} finaldoor from L112": `REFUSES no-verb` → `REFUSES unresolved` (by name).
  4. `fidelityFrontier3` "L113 (route step 235): the seal door is an ITEM gate": the refusal is now the approach
     resolver's named predicates, so the "Obstacle: solid:finaldoor … ITEM-GATE" regex no longer matches.
  5. `jsRuntimeSolverEventGoal` "clearTagVerbOf agrees with the solver's own clear-tag, flag:L113:0": the JS arc's
     hand-over (below). The solver now refuses `unresolved` while the pre-check says `no-verb`.

### STOP — the flip

The flip is the user's. It owes:
- the defaults pins (`contactFidelity.test.js`, `fidelitySealDoor.test.js`'s "ships OFF");
- `fidelityClearTag`'s {113,0} row (→ `unresolved`) and `fidelityFrontier3`'s L113 row (→ the predicate sentence);
- `clearTagVerbOf` wired by the JS arc **before or with** the flip, otherwise the location goal and the solver disagree.

The flip moves no tape, producer, identity row or survey verdict. It changes only the text of one survey step and six
sweep legs, and every one of them stays a refusal **while the state lacks the predicates**.

### The CI dispatches the planner should run

1. **Sweep A/B** (`seedling-divergence-sweep.yml`, ref `claude/seedling-finaldoor-sealdoor-156b48`):
   - A: default inputs.
   - B: `contact_fidelity=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,strikeIframeLapse,fallRockPostFall,forecastSpeedByTerrain,buttonFallReleaseStep,waypointSlide,lavaChainPlayerHit,ceremonyShove,sealDoorApproach`
     (today's ON set plus `sealDoorApproach`).
   - Expected: legs 804, 805, 811, 812, 818, 819 `failed` → `failed` with the predicate sentence; nothing else moves
     beyond run noise. Optionally add `capture_requests` on those keys to confirm `save.seal_parts = []` on CI.
2. **Survey ON**: `seedling-survey.yml` has no `contact_fidelity` input, so use a flip branch (this branch with the
   default set to `true`). `through=end route=full`. Expected: = 38926053841 on all 222 rows except step 221's refusal
   text.
3. **The witnesses on CI**: the differential's full tier picks up the three `sealdoor-l113-*` tapes. Expected PASS.

## The JS arc: pins that move, and what it must wire

- **`jsRuntimeSolver.clearTagVerbOf(key)`**: add `if (CONTACT_FIDELITY.sealDoorApproach && key === 'solid:finaldoor')
  verb = 'approach'`, registered while the switch is on. That mirrors `solverBot.refineStrategy` and
  `clearTagExecutor`. Its pin `jsRuntimeSolverEventGoal.test.js` (flag:L113:0) moves with it.
- **No new staging field is needed for the predicates.** The run already reads `save.seal_parts` and `persistence`.
  `run.finalDoorGate` is a new read-only run getter, classified in the solver surface.
- **The bridge** (`flashBridgeAdapter.js:784`, `flashPanel/*`): an AP `Seal` writes no seal slot, so no AP run can open
  the FinalDoor in the game. This is the work order behind the nine legs; it is the JS arc's region, not touched here.
- `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging`: no signature or contract change. No new
  `SolverRefusal.obstacle.kind`: the refusals are `solid` (frontier) or `clear-tag` / `unresolved`.

## CI at the last code head

`node scripts/procgen/ci-vitest-summary.mjs 0f7797c5` (run 38945197696; the report commit `a4bb41fd07` is
path-filtered and runs no vitest): **20,590 passed, 1 failed**. The red is `scripts/procgen/rosterCategories.test.js`
"the LIVE row carries one part per derived category", the standing-values `mechanic` part (217 → 220) owed to the
planner. The slow battery has no summary (that step was cancelled after the failure).

## Handed to the hammer arc

Nothing. No edit is in its region.

## Deltas and records

- **Censuses.** `census-seedling-solver-surface` GREEN, 312 rows. 4 new run rows classified: `finalDoorGate`,
  `finalDoors`, `doorCeremonies`, `doorEvents`. `census-seedling-constants` PASS, 6,001 literals: the `-1` seal-slot
  row was **retargeted** from `stepFinalDoorsNow` to `finalDoorGateNow` (a move, not a new rule).
- **Tape index.** 280 tapes; 3 new: `sealdoor-l113-clear`, `sealdoor-l113-exit`, `sealdoor-l113-noseal-control`, all
  with oracle expectations.
- **Bot log.** "Seedling fidelity SEALDOOR". Reference regenerated: instruments and the docs index only, because the
  substrate regions drop on this box (no `bulletml-dodge` checkout).
- **Trap candidates** (in the bot log):
  1. *An AP inventory is not the game's save.*
  2. *A second spelling of a selector drifts behind a switch* (`clearTagVerbOf`).

## What the brief got wrong (measured)

1. *"9 failing legs in L113, every one holding all 16 Seal parts."* They hold 16 AP `Seal` **items**; the game's save
   holds **0** seal slots (bridge drop, measured on the game).
2. *"Establish whether these 9 legs' states include the Watcher talk."* None does. Each is a fresh page and a jump, so
   `persistence = []`.
3. *"Exits refuse … also on the frontier: ruinedpillar …, dungeonspire …"*: these never block. They were listed, not
   met.
4. D1's *"record the SealController dialogue's dead frames, the open length, the tick the Solid leaves"* was already
   banked by R6 slice 6c (`r6-final-door`, 181 / 56 / +1). I re-played it rather than re-recorded it.

## Residue

- The cross-room chain (talk in L114, then approach in L113) is not a single segment. A route-level answer, or the
  harness staging `{114,0}`, is the next order.
- `rosterCategories` stays red until the standing roster row is re-recorded.
- The reference's substrate regions read "differ" on this box (an environment artifact; CI has the submodule).

## Byte-inertia

OFF is byte-identical to the base:
- identity block, every row including the six `--check`s;
- tapeRunner pairs 611 `86af8525`;
- survey steps 220–222;
- bare-pass refusal text for the nine legs;
- bounded vitest: the only reds are the 3 roster count pins (re-pinned) and `rosterCategories` (owed). Each comes from
  adding 3 tapes, not from a moved behaviour.

## Rows to BANK

- `sealDoorApproach`: OFF; ON movers = survey 221 (text), sweep 804/805/811/812/818/819 (text), and 806/813/820 once
  `clearTagVerbOf` is wired.
- Witness tapes: `sealdoor-l113-clear`, `-exit`, `-noseal-control` (oracle, p4f).
- tapeRunner pairs: 617 rows (611 `86af8525` + 6 sealdoor).
- Roster: 280 tapes; `mechanic` 220 (standing value owed).
