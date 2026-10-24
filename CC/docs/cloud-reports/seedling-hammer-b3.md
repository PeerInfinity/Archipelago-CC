# Seedling HAMMER-PHASE — slice B3: the replay REWIND, and the fight search as a FALLBACK where today's path refuses

Slice `seedling-hammer-b3` (Opus, cloud), planner `seedling-hammer-phase-planning`.

⚖ **The user** (2026-10-10), shown B2's result: **"Fight as fallback first"** — *"run the fight search only where
today's path refuses … can only add solves"*; and, shown replay rewind vs true snapshots: **"Yes, please fold replay
rewind into B3."**

| | |
|---|---|
| Start SHA | `3e0ff8b` (main; contains B2: `a6cb6b0`…`0911d74` + the bank) |
| Head | the commit carrying this report (code `d541207`, `2baf8f1`; records `a9956ce`, `9225d34`, `4541594`) |
| Harness branch | `claude/seedling-hammer-b3-ezx2ty` (the brief's `seedling-hammer-b3`; the harness names the branch). Nothing went to `main` |
| Dev server | `serve-nocache.py 9540` (`SEEDLING_PORT=9540`); a base worktree `/home/user/wt-b3-base` on 9541 (W0); a scratch worktree `/home/user/wt-b3-mut` (the mutants) |
| Verdicts | **W0 PASS · D0 PASS · D1 PASS · D2 STOP at 4 (cost: the fast capacity file does not finish ON; the slow census does, 703 → 712 s); every other D2 item measured, the movers listed · D3 PASS** |

## The one thing to know first

**The fallback does exactly what the ruling asked on every generation row measured: it adds 21 solves, loses none,
and never touches a solve that succeeds today** (identity OFF = base row for row; ON, the six producers, ENEMY, the
killgates, the levels and the L18 sweep are byte-identical). Every added solve has the plain fight's ticks.

**But it is not free for generation**: the fast capacity file does not finish with it on (D2.4). Each fallback costs
under 3 s; what costs is that a refused kill gate it rescues now certifies, keeps its tag, and the room re-rolls again —
the seed-57 killgate draw went from 335 s to more than 2,400 s (65 fallbacks, 83 s of them search). The slow census is
unaffected (703 → 712 s). That decision, and the movers in D2.6, are what a flip needs.

Two things the brief did not expect, both measured:
- **The rewind buys nothing on the generated rows.** Every press kill there starts at tick 0 (the kill-lock room is the
  boot room), so rewinding to the kill's start IS a whole re-solve: same verdict, same ticks, same wall time on all 9
  coded cases. The rewind is exact (2,440 probes, 0 mismatches) and cheap (≈0.02–0.11 ms per replayed tick; L40
  1.25 ms/tick) — it is ready for a kill that starts late, which no measured row has.
- **Most of what the fight adds comes from the press arm's ADMISSION refusal, not from the coded corners**: 12 of the
  21 (c3/c6/acceptance's one room, five c4 rooms and c4's kill-lock *"no weapon"*). Those are reached where the
  admission is terminal, and the fallback asks them again there; the whole-solve retry (coded refusals only) adds 9.

## W0 — at the base `3e0ff8b` (PASS)

| row | command | result |
|---|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-hammer-b3-ezx2ty origin/main` | `3e0ff8b`; `git log --oneline -30 \| grep -a hammer-b2` lists B2's five commits |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0; `bulletml-dodge` at its pin `7423ee86` |
| identity block | `SEEDLING_PORT=9541 bash scripts/procgen/identity-block.sh .` in the base worktree (venv activated; submodules symlinked) | log md5 `8b6d3065c1a012fb368cc31f58719855`. maze `246dfbce`, acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `30bcc49c`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set **OK**. Reference: 4 DIFFER (the worktree, as B2 saw) |
| six `--check`s | in the block | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 13b8d51f`, all exit 0 (= B2's) |
| surface / constants / entities / profile | each `--check` | GREEN 227 · PASS 5,443 · PASS 528 · PASS 138 |
| roster | `fixtures/tapes/index.json` | 259 |
| bounded vitest BEFORE | the 83 files below, base worktree | **3,079 tests: 3,068 pass, 1 fail, 10 skipped**: the fail is `procgenDocs/generated` (the worktree) and `seedlingGenCapacity` does not load there (`registerBackend: duplicate id 'empty'`, the symlinked modules) — B2's two environmental rows. tapeRunner **575**, md5 `3dd640fad700c9f492fb7259b4954fa5` (`status\tfullName`, sorted, newline-terminated) |

**The 83 files** (by rule: A's standing names + `tapeRunner presses combatVerbs tiers` + the hammer files + the files my
change reaches (`twoPassSolve procgenOracle watchSolve seedlingGenCapacity`) + every non-slow `rg -a` hit for
`clearOfHammersAt|discClearanceAt|slashPressForecast|swordWindowStep|spinnerPressHits|witness-bases|r9-solve-18|
DEADLINE_SITES|HAMMER_PHASE_RUNG|spinnerForecast|HAMMER_ESCAPE|HAMMER_APPROACH|HAMMER_FIGHT|execKillByPress|
twoPassSolve|solveForPage|procgenOracle|forkRun` + `procgenDocs/generated`): procgenDocs/generated, blockRoute,
breakVerb, campaignChain, combatVerbs, contactFidelity, dangerMap, decisionTrace, dialogueAutoAdvance, entityBlocks,
fidelityArrival, fidelityAxe, fidelityF1b, fidelityF1c, fidelityF6, fidelityF7, fidelityLadder2, fidelityReturn,
fixtures/tiers, gameClock, ghostSword, hammerApproach, hammerEscape, hammerFight, jsRuntimeDeclarations,
jsRuntimeGeneratedSolver, jsRuntimeSolver, jsRuntimeSolverShouldStop, levelRun, mover, moverRooms,
observationTolerance, playthroughAcceptance, presses, procgenCollectPath, procgenCorridorBody, procgenCountableClock,
procgenDoorElements, procgenKillGateDemand, procgenNestedOpeners, procgenOracle, procgenPostSword,
procgenRequirements, procgenRoam, procgenScratchPersistence, procgenSeedlingElementsCertify, procgenShortcutRock,
procgenShoveDistance, procgenSwimPins, procgenSwimPrice, procgenSwimSolver, procgenWaterGate, procgenWaterShortcut,
procgenWaterfallGate, procgenWeigh, r5Shaft, r8Acceptance, ropeSword, seedlingCanCross, seedlingGenCapacity,
shoveWeighParity, solverBot, solverDeadline, solverSpinnerKill, spinner, spinnerClockPairing, tapeEnvelope,
tapeIndexManifest, tapeRunner, twoPassSolve, wasmWalkTape, watchGenOverlay, watchGenerate, watchManual,
watchOverlays, watchSolve (seedlingDemo), and boxLock, lintGateLabels, reachClosure, rerecordCampaign,
seedlingConstantsCensus, seedlingSolverSurface, surveyFamily (scripts/procgen).

**Today's refused spinner certify records** (B2's instrument, the OFF path, each refusal re-solved at the base and
classified; `/tmp/claude-0/w0/refused.jsonl`) — the fallback's candidates:

| row | records | refused | by class |
|---|---|---|---|
| killgate s2 / s5 / s9 | 9 / 9 / 9 | 0 | — |
| ENEMY | 2 | 0 | — |
| acceptance | 23 | 4 | 4 `SolverRefusal` (ladder EXHAUSTED; 2 are the press arm's admission at the ladder's last rung, 2 have no sword) |
| empty pairs c3 | 102 | 2 | 2 `SolverRefusal` (ladder EXHAUSTED, the press arm's admission) |
| empty pairs c6 | 170 | 10 | 10 `SolverRefusal` (2 the admission as above; 8 others) |
| carved pairs c4 | 138 | 22 | **11 `HAMMER_SAFETY`**, **2 `STRIKE_BOUND_EXHAUSTED`** (`BUDGET_EXHAUSTED`), 9 `SolverRefusal` (5 the admission at the ladder, 1 the kill-lock order's *"no weapon"*, 3 others) |
| capacity rows | — | — | not captured (the capacity cost row below is the measurement there) |

## D0 — the replay rewind (PASS)

**What.** `solveSegment` gains ONE optional option, `rewindRun: () => run` — a fresh run in the state the segment's
run was handed over in (at `boot`, or with the caller's `prefix` already replayed), built exactly as `run` was. With it,
`rewind.replay(t)` = `replayToTick({makeRun: rewindRun, perTick, from: prefix.length, to: t, …})`: a fresh run with
`perTick[prefix.length … t)` replayed through `advance`. `rewind.to(t)` also ADOPTS it: the segment's view over the
run is rebuilt on the fresh one (`viewOf`, the same function that wraps the original — dash counting, apitem takes,
the `walk` deadline site), the segment's tick-indexed state is cut back to `t` (keys, equips, takes, dash ticks) and an
`undo()` restores exactly what was cut. No change to `levelRun`: no snapshot, the replay IS the state.

**Inputs replayed** (every mutator a solve calls on a run besides `advance` was grepped: `equipNow` and `takeApItem`;
`adoptWindowClock`, `addEquips`, `addTimedClears` are called only by callers before the solve):

| input | carried by |
|---|---|
| the keys | `perTick[prefix.length … t)` |
| the segment's slot selections (`equip` → `run.equipNow`) | `solverEquips`, applied before their tick (run-clock ticks converted to tape ticks) |
| the segment's apitem takes (the view's `inner.takeApItem`) | `apItemsTaken`, applied after their tick |
| the pass's persistence, PENDING rows, `gameTick` answers (they are persistence rows by then), scratch persistence, the staging (items, equips, frontier, clock), a caller's prefix and its `adoptWindowClock`/`addEquips`/`addTimedClears` | the factory's contract (it builds the run as `run` was built). `twoPassSolve`: `() => makeRun(passRows)`; `solveForPage`: `() => createRunForStaging(honest, levelSource, {scratchPersistence})` |
| solver state keyed by the run object (`SKIRTED`, the skirt-grid memory) | carried to the new view on adopt (`KEYLOCK_REACH_MEMO` is a pure per-tick memo) |

The factory is checked: a run whose `ticksCompleted` is not the handed-over run's is refused by name.

**Where it reaches the solver.** `ctx.rewind` on the five executor ctx objects inside `solveSegment` (null without a
factory, and nothing reads it unless the fallback is on). A rewound segment ends on the fresh run: it rides out as
`out.liveRun`, **non-enumerable** (no serialised `out` changes); `solveForPage` uses `out.liveRun ?? run` for the
despawn check and the returned `run` (the oracle reads `run.scratchClears` from it).

**The exactness gate** — `check-seedling-rewind-exactness.mjs` (+ `rewindExactnessHook.js`, loaded with `--import`;
`--help` door; `--rows`): runs a producer's OWN script; at every press kill's first tick (`execKillByPress`) and every
50th tape tick (before that tick's advance) of every segment with a factory, the live run and the rewound run are
fingerprinted — `ticksCompleted`, level, `run.state`, `gameTimeAt(0)`, transitions, scratch clears, `entities(f)` for
all 27 families, `progress(f)` for all 13 fields, `ledger(k)` for every kind, Sets/Maps spelled out — and compared as
text. The child's stdout md5 is printed (the probe is inert: every producer's digest unchanged). At the final code
(`2baf8f1`):

| row | stdout md5 (= producer) | probes | kill starts | max tick | mismatches | rewind median / max |
|---|---|---|---|---|---|---|
| `solve-seedling-r8-l18 --check` | `465a8b46` | 22 | 3 | 350 | **0** | 5.2 / 14 ms |
| `solve-seedling-r8-d2-chain --check` | `b76f6483` | 48 | 3 | 1,650 | **0** | 15.9 / 120 ms |
| `solve-seedling-r8-tail --check` | `35456fbc` | 18 | 0 | 400 | **0** | 21.5 / 35 ms |
| `solve-seedling-r9-l3 --check` | `6cd35fe1` | 3 | 0 | 150 | **0** | 7.0 / 13 ms |
| `solve-seedling-r9-campaign --check` | `13b8d51f` | 49 | 3 | 500 | **0** | 10.8 / 41 ms |
| killgate s2 / s5 / s9 (certify solves) | `006b0639` / `7d4cb820` / `49e23d85` | 80 / 88 / 142 | 9 each | 650 | **0** | ≤ 6.9 / 65 ms |
| ENEMY census | `30bcc49c` | 92 | 2 | 350 | **0** | 6.2 / 30 ms |
| acceptance batch | `76602ae8` | 714 | 19 | 700 | **0** | 2.1 / 57 ms |
| L18 sweep (45 solves × their passes) | (prints wall times) | 1,184 | 135 | 500 | **0** | 4.5 / 55 ms |
| **total** | | **2,440** | **192** | | **0** | |
| `solve-seedling-r8-battery --check` | `405d9c4b` | 0 | — | — | — | it re-solves nothing (verifies committed tapes only) |
| L40 (survey step 82 re-pointed at (848,16), `collect:64,144`, dashless; scratch driver with a factory) | SOLVED 1,799 t | 12 | 1 (t1093) | 1,650 | **0** | 0.28–2.4 s |

**Cost** (the rewind's wall time against the replayed tick count): L18 and the generated rooms 0.02–0.11 ms per tick
(a rewind to t300 ≈ 6 ms, the longest, t1650 on the d2 chain, 120 ms). L40 (5 spinners, a large level): ≈ 310 ms to
build the run plus ≈ 1.25 ms per tick (t150 276 ms … t1650 2.4 s). For the fallback's use (one rewind per refused kill,
before a fight search of seconds) it is not the cost; true snapshots are not needed for this slice.

**Mutant** (predicted first; copy + restore, `twoPassSolve.js` md5 `ce71909e` at both ends): the factory built without
the pass's persistence (`makeRun([])`). Predicted: red at the probe after L18's declared clear (t350). Measured: red
**earlier** — 5 mismatches from t250 (`ledgers.spinnerKillLockOpens[1].declaredAt`: the ledger carries the declaration
from the removal on, the PENDING sentinel in pass 1), the t350 replay throws (an undeclared kill-lock). First version of
the hook let that throw escape into the solve (the producer's stdout moved); the hook now records a throwing replay as
a mismatch, and the mutant reds with the producer's stdout intact.

## D1 — `HAMMER_FIGHT_FALLBACK` (PASS; `d541207`, `2baf8f1`)

**Switch.** `HAMMER_FIGHT_FALLBACK = {enabled, mode}` beside `HAMMER_FIGHT_BOUNDS`: OFF by default
(`SEEDLING_HAMMER_FIGHT_FALLBACK=1`, `withHammerFightFallback(true, fn[, mode])`); `mode` `'rewind'` (default) or
`'whole'` (`SEEDLING_HAMMER_FIGHT_FALLBACK_MODE=whole`: the whole-solve retry only, the D2.8 comparison). Inert while
`HAMMER_FIGHT` itself is on. `HAMMER_FIGHT_FALLBACK_TRACE.sink` gets every fallback with its wall time (no record holds
ms). No new deadline site: a retry's fight search spends `hammer-fight`'s units like any search; a cut is no claim.

**Trigger** (`FIGHT_FALLBACK_CODES`, `isFightFallbackRefusal`):

| refusal | in? | why |
|---|---|---|
| `HAMMER_SAFETY` — `safeStep`'s *"There is no step out."*, its unsafe-press twin, the refuge's *"nowhere to be"* | **IN** | the run has been driven into the corner the fight plans around |
| `STRIKE_BOUND_EXHAUSTED` — the schedule's whole bound with the body alive (`BUDGET_EXHAUSTED`) | **IN** | a kill the switch-off path could not finish; c4 n122/n176 are exactly this and the fight kills them in 635 t |
| the press arm's ADMISSION refusal at the combat ladder's `kill` rung | **IN** (rewind mode) | terminal there: `kill` is the last rung whenever a spinner is among the danger's sources (`detour` needs every source to be a chaser) and the EXHAUSTED refusal leaves `walkTo` uncaught; no tick is spent, so the admission is asked again in place, and a failed kill is rewound to the rung's tick |
| the admission at the kill-lock order's press arm (`resolveKillStrategy`) | **OUT** | the ceiling and chaser arms come next and may SOLVE today |
| `execKill`'s *"the kill work order has no weapon"* | **IN** (rewind mode) | reached only when every arm refused — terminal; found by measuring (c4 n124, the one record the plain fight solved and the first design did not) |
| any other throw (an uncoded `SolverBotError`, a `SolverRefusal`, the line-of-sight refusal) | OUT | |

**Retry, rewind mode** (`execKillByPress`, now a wrapper over the unchanged `execKillByPressOnce`): on a coded
refusal, `ctx.rewind.to(t0)` (`t0` = the kill's first tick), the order is admitted again with the fight on
(`derivePressKill` on the fresh run from the admission's own inputs — `PRESS_ADMISSIONS`, a side table keyed by the
`plans` array every caller hands on) and only the kill is redone with the fight on; the segment then goes on with the
fight off. A retry whose kill completes and whose lock tail raises a `PendingDeclaration` (or a discovery) is a kill
that completed: adopted, the throw goes on to `twoPassSolve`. Anything else: `undo()` — the run, keys, equips, takes
and dash count are the refusal's again — and the ORIGINAL refusal is thrown, its words unchanged plus one sentence
(`fightFallbackSentence`), with the row on it (`e.fightFallback`, so no outer layer retries it again). The refusal-text
pins were grepped: they all run with the flag off.

**Retry, no rewind / whole mode**: `twoPassSolve` re-runs the pass once with `withHammerFight(true, …)` (a
`fight-fallback` row in `passes`, signature unchanged), and `procgenOracle.solve` re-solves once (`solveOnce` under
`withHammerFight(true, …)`; the smallest edit: the existing call became a local `solveOnce`, plus the retry block and
the record fields). Coded refusals only (the admission arm needs a rewind to undo a failed kill). Only a SOLVE (or the
next declaration) replaces the refusal.

**Earlier rewind point?** Never needed in what was measured: every coded case the whole-solve retry solves, the
kill-start rewind solves at the same ticks; the only record the plain fight solves and the fallback did not (n124) was
an admission refusal, now answered.

**Records** (present only when the fallback ran): the kill record's `fightFallback` row `{t, how: 'rewind'|'admission',
refused, refusedAt?, bodies, verdict, ticks, fights}`; the segment result's `fightFallbacks` (rows of the adopted
retries); `twoPassSolve`'s solve pass `fightFallbacks: n` and `fight-fallback` pass rows; the oracle's SOLVED record
`fightFallbacks` / `fightFallback`, and a REFUSED/BUDGET record's `fightFallback` (with the appended sentence in
`reasonText`).

**What a caller can now observe (flag ON only):** a `twoPassSolve` result may carry `fight-fallback` rows in `passes`
and `fightFallbacks` on its solve row; `out` may carry `fightFallbacks` and a non-enumerable `liveRun`; a refusal may
be one sentence longer and carry `fightFallback`; `solveForPage`'s `run` may be the factory's run. With the flag OFF:
nothing (the contracts of `solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging` unchanged;
`solveSegment` gained one optional option).

## D2 — measured (box: 4 cores, loaded by 1–7 jobs; ON/OFF pairs ran back to back in one process)

### 1. Byte-identity of every success — PASS

| row | OFF (head) | ON |
|---|---|---|
| identity block | = base row for row (`diff` empty; reference ALL 7 + 5 MATCH at head) | maze, ENEMY, guard, AREA, killgate s2/s5/s9, levels pre/post s1, generated set: **unmoved**; acceptance, c3, c6, c4: the movers (6) |
| six producer `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 13b8d51f`, exit 0 | **identical**, exit 0 |
| L18 sweep (`sweep-seedling-l18-residues.mjs`) | 45/45, lengths = A4's table exactly | **= OFF row for row** (lengths and per-row digests; lengths line md5 `1c019765…` both) |
| 71 planner `--check`s (`plan-seedling-r7-ends-meet` skipped: :8000) | — | 70 OFF = ON digest; **1 moves** (6) — `plan-seedling-hammer-b2-fight`, `-b1-approach`, `f1c-l18-phase` unmoved. Six exit 1 identically OFF and ON (`ladder2-witness` drifts at the base too; `r5-conch`, `r5-feather`, `r6-shieldboss`, `r9-l0-sword-dash`, `r9-l6-sword-dash-hit`) |
| the JS arc's live L18 plan | 518 / 500 / 503 t (full), work 59/57/57 | **identical** |
| committed tapes | — | none can move (a replay never consults the solver) |

### 2. Added solves — 21, by path

Every captured record re-solved off / fallback (rewind mode) / whole (`check-seedling-hammer-monotonicity.mjs`, its
new `fallback` and `whole` modes; final code; JSON `/tmp/claude-0/d2/mono2/`):

| row | records | solved off → fallback → whole | added (fallback) |
|---|---|---|---|
| killgate s2 / s5 / s9 | 9 each | 9 → 9 → 9 | 0 |
| ENEMY | 2 | 2 → 2 → 2 | 0 |
| acceptance | 23 | 19 → **21** → 19 | n109 131 t, n110 139 t (admission, the ladder) |
| c3 | 102 | 100 → **102** → 100 | n387 131, n388 139 (admission; the same room) |
| c6 | 170 | 160 → **162** → 160 | n635 131, n636 139 (admission; the same room) |
| c4 | 138 | 116 → **131** → 125 | rewind: n63 413, **n122 635, n176 635** (strike bound), n128 352, n175 443, n177 443, n178 447, n415 352, n1345 246; admission (ladder): n230 263, n231 297, n232 297, n236 235, n237 235; admission (no weapon): **n124 645** |

Still refused with the fallback: c4 n75, n349 (`HAMMER_SAFETY`; the retry's fight search exhausts at 2,716 expansions
— `{rewind@0: refused}`, the refusal stands with its sentence); c4 n121, n123, n229 (the fight kills, then the walk
refuses elsewhere — the plain fight refuses them too); and every refusal of another class (no sword, no corridor).
B1's seven (not refused today) solve OFF and are untouched by the fallback (they never reach it): the non-regression
row is the monotonicity count, 0.

On the FALLBACK generator path (the records the ON generator draws; capture stdout = the ON identity digests): 
acceptance 21 records, refused → solved **6**; c3 100, **1**; c6 168, **4**; c4 142, **25** — exactly B2's FIGHT-path
counts — and 0 solved → refused.

### 3. Monotonicity — PASS: 0 solved → refused on every row, both generator paths (by construction, and confirmed).

### 4. Cost

| set | OFF | ON | note |
|---|---|---|---|
| re-solving the captured records (one process, per record back to back) | killgate 2.6/6.7/8.6 s; ENEMY 2.7; acceptance 16.0; c3 235.7; c6 305.9; c4 105.1 | 2.3/6.5/8.3; 2.6; 18.1; 231.7; 246.9; **135.5** | only c4 pays (+30 s: 15 retries, two of them the 63,029-expansion strike-bound fights at ~23 s each) |
| row captures, wall (loaded, not back to back) | acceptance 75.2, c3 176.9, c6 242.3, c4 228.3 s | 97.4, 202.6, 271.8, 227.6 s | noise of the same order as the difference |
| fallback searches | — | acceptance 2, c3 2, c6 2 (one ~2,000-expansion search each), c4 17 (median ~6,000, max 63,029) | |
| `seedlingGenCapacity.test.js` (fast) | **25 s**, 9/9 | **did not finish**: killed at the 3,000 s cap (`timeout 3000`, exit 124) | |
| `seedlingGenCapacity.slow` (both biomes) | **703 s** (loaded) | **712 s**, 2/2 (back to back with OFF; lighter load) | |
| the fast file's seed-57 killgate draw (direct, `/tmp/claude-0/sp/kg57.mjs`) | escape off: 3 re-rolls, 7.5 s | escape off + fallback: **did not finish in 2,400 s**. Escape ON (today's default): off 51 re-rolls, **335 s** (A2 measured 315 s); with the fallback **did not finish in 2,400 s** — 65 fallbacks in the first 2,311 s, all `solved` (62 admission, 3 rewind), **82.6 s** of fallback search in total | |

**⛔ STOP-class finding (cost): the fallback keeps B2's capacity mechanism, at a smaller per-search price.** Each
fallback is cheap (0.7–2.5 s; 82.6 s for 65 of them), but every one it wins turns a refused kill gate into a
certified one; a draw whose kill gate certifies keeps the gate's tag, and the room re-rolls (A3's mechanism). On the
fast file's seed-57 killgate draw that multiplies the re-rolls past any bound measured: escape off (the row's own
switch) 7.5 s → did not finish in 2,400 s; escape on (the default) 335 s → did not finish in 2,400 s. The fast file
therefore does not finish ON (killed at 3,000 s). **The slow census (both biomes, the default escape) is unaffected:
703 s off, 712 s on**, both 2/2 — its draws did not land this re-roll chain. Levers for the planner (none landed): the
capacity row asks the fallback off by switch as it asks the escape off (its subject is the re-roll mechanism, not the
kill), a generation-time cap on fallbacks per draw, or a draw-level rule that a gate certified only by the fallback
does not keep its tag. The fallback was not shrunk to fit.

### 5. The JS arc

- `measure-seedling-l18-live-gap.mjs`: **518 / 500 / 503 t (full)**, work 59 / 57 / 57, budgeted and unbudgeted,
  identical OFF and ON (L18 never refuses today, and the worker passes no factory).
- `jsRuntimeSolverCalibration.slow`: 5/5 OFF (16 s) and 5/5 ON (16 s) — it never reaches a refusal.
- What the worker would need: see "What the JS arc must wire".

### 6. Movers with the fallback ON (measured, NOT landed) — the list for a licence

| row | OFF | ON |
|---|---|---|
| acceptance batch | `76602ae8` | `0094257a2f5d474abd3049d21d2d9c72` |
| empty pairs c3 | `4937da80` | `6873ee49b9b7fa84ea6c3f328d34b51b` |
| empty pairs c6 | `430573e9` | `15dbcf3fe4010a097984f227f714e61e` |
| carved pairs c4 | `b9d2185d` | `bc35ee7e11dc9f01831feebce87ef53c` |
| ENEMY, killgate s2/s5/s9, guard, AREA, maze, levels s1, generated set | — | unmoved |
| the six producer `--check`s | — | unmoved (exit 0) |
| `plan-seedling-hammer-a-escape --check` | `29891f04` exit 0 | `345b4ff8` **exit 1**: its two *"with the switch OFF this staging REFUSES HAMMER_SAFETY"* rows (residues 21, 15, escape off) now solve. The witness tapes do not move |
| the other 70 planners | — | unmoved |
| committed tapes, producer digests | — | none |
| unit rows ON (the 83-file AFTER set run with the env set) | — | **7 rows in 6 files, every one a refusal pin whose room now solves**: `fidelityF1c` 1 (*"the remainder is NAMED (the escape OFF)"*), `hammerEscape` 2 (the escape-off refusals of `hammer-a-l18-escape21`/`15`), `procgenCountableClock` 1 (*"a hammer-safety SolverBotError becomes REFUSED"*), `procgenPostSword` 1 (*"with the clock UNDECLARED the same room throws"*), `procgenRoam` 1 (winding 14×14 seed 12 *"refuses by the DWELL"*), `watchGenOverlay` 1; plus `hammerFightFallback` 5 (its own OFF-default rows), `procgenDocs/generated` (docs index, not the flag); `seedlingGenCapacity` see 4 |

Expected and confirmed: only rows that contain a refused-today spinner record (the four generated rows whose level
choice changes because a refused gate now certifies) and pins that assert a refusal. **STOP here, as briefed: the flag
is OFF in head.**

### 7. The GAME witness — not recorded, and why

Every refused-today record is a generated level (900), and no generated level is a roster tape (B2's finding again).
With today's defaults (escape on) L18 never refuses, so there is no refused-today L18 staging. The fallback's keys are
the plain fight's keys in every case measured (the unit row asserts it on L18 r4 with the escape off: fallback =
`withHammerFight(true)`, key for key), and that class of keys is game-witnessed by B2's `hammer-b2-l18-fight40` (0 px,
0 hits). A tape whose subject is "the escape off, then the fallback" would witness the fight again, not the fallback.

### 8. Rewind vs whole-solve retry (both measured, same process)

| added solve | rewind | whole | same verdict? |
|---|---|---|---|
| c4 n63 | SOLVED 413, 5.0 s | SOLVED 413, 4.6 s | yes |
| c4 n122 / n176 | SOLVED 635, 22.8 / 24.7 s | SOLVED 635, 23.8 / 26.4 s | yes |
| c4 n128 / n415 | 352, 0.3 / 0.4 s | 352, 0.3 / 0.4 s | yes |
| c4 n175 / n177 | 443, 1.8 / 1.6 s | 443, 1.5 / 1.7 s | yes |
| c4 n178 | 447, 1.7 s | 447, 1.8 s | yes |
| c4 n1345 | 246, 0.1 s | 246, 0.1 s | yes |
| the 12 admission solves | SOLVED (0.2–2.8 s) | REFUSED (the whole retry's trigger is coded refusals only) | — |
| c4 n75 / n349 (retry refused) | REFUSED 1.0 / 1.1 s | REFUSED 1.1 / 1.1 s | yes |

Every rewind was to **t0** (`refusedAt` 2…2011): the kill starts at the boot tick in every generated room, so the two
paths do the same work. On L18 with the escape off (residues 4/5/6/8/15/18–22: all ten refuse `HAMMER_SAFETY` OFF),
rewind and whole both solve at the fight's lengths (349 … 411 t), the rewind 10–28 s, the whole 9–28 s per solve, both
over three passes.

### 9. Mutants (predicted first; copy + restore in `/home/user/wt-b3-mut`, `solverBot.js` md5 `fd04a4b7` at both ends)

| mutant | predicted | measured |
|---|---|---|
| m3, the trigger widened to every throw (`isFightFallbackRefusal` → `!e.fightFallback`) | the kill-lock tail's own `PendingDeclaration` (pass 1 of every lock room) is "retried" with the fight, so successes move: `l18 --check` ON exits 1, the unit "a success never asks" row reds | **as predicted, and harder**: `l18 --check` ON dies — `r8-solve-18: pass 1 and pass 2 DISAGREE at tick 0` (pass 1's discovery throw was retried); 2 unit rows red (the success row, and the trigger row) |
| m2, "replace only if it solves" removed (a failed retry's own throw goes out, not undone) | the undo row reds; on c4 n75/n349 the refusal text changes, no verdict moves to SOLVED, monotonicity untouched | **as predicted** (c4 refused subset: 15 solved either way; the undo row red) **plus** unpredicted: the escaped throw carries no `fightFallback`, so the oracle's whole-solve retry fires on it — a second fight search per refusal |
| D0's m1 (the factory without persistence) | see D0 | see D0 |

## D3 — records (PASS)

| row | result |
|---|---|
| `seedling-bot-log.md` | `### Seedling hammer-phase B3 — the fight as a fallback` |
| `seedling-bot.md` | the press-kill paragraph gains the rewind and `HAMMER_FIGHT_FALLBACK` |
| surface / constants | `--check` GREEN 227 · PASS 5,443 at head with no `--write` needed (entities 528, profile 138 unmoved) |
| reference | regenerated (the two new instruments, the line shift in `watchSolve`, the docs index): `--check` ALL 7 + 5 MATCH; `check-procgen-docs` ALL CHECKS PASSED |
| help door | `check-procgen-help`: both new instruments PASS (HELP ok, IMPORT ok); the run's 25 other failures are instruments this slice did not touch (import side effects, load timeouts) |
| bounded vitest AFTER (flag OFF) | the 83 files (82 + `hammerFightFallback`, − `seedlingGenCapacity`): **3,089 tests, 3,087 pass**; the two reds were `procgenDocs/generated` (the docs index before my last regeneration; 78/78 with `lintGateLabels` and `hammerFightFallback` after it) and one `hammerFightFallback` row's STACK_TRACE_ERROR (a 77 s row past vitest's 60 s default under a load of ~7; the rows now carry explicit timeouts, 9/9). tapeRunner **575**, md5 `3dd640fad700c9f492fb7259b4954fa5` = BEFORE |
| `lintGateLabels` | 14/14 |

## What the JS arc must wire

The worker (`jsRuntimeSolver.solveAnytime` → `solveSegment({prefix, …})`) passes no factory and has no whole-solve
layer, so **with the flag on it gets nothing**: neither the rewind nor the whole retry (and `twoPassSolve`'s internal
pass does not cover it). To get the fallback it must:
1. pass `rewindRun: () => run′` — a fresh shadow run built as its `run` was AND advanced through the session's prefix
   (the factory's contract: `run′.ticksCompleted` equal to the handed-over run's; checked);
2. return an UNRECORDED run from it: the rewind replays ticks through `run′.advance`, which a recording Proxy would
   count as session ticks;
3. read `out.liveRun` (non-enumerable) after a solve that used a fallback, and continue from it, not from its own run;
4. re-calibrate if the flag is ever turned on for live play: a retry's fight search spends `hammer-fight` units (one
   per 250 expansions; c4's largest fallback ≈ 250 units) — on L18 none is ever asked today.

## Deltas

| row | base | head |
|---|---|---|
| code | — | `solverBot`: `rewindRun` (solveSegment option), `viewOf`, the rewind (`replay`/`to`/`undo`/`note`), `replayToTick`, `REWIND_PROBE`, `HAMMER_FIGHT_FALLBACK`/`withHammerFightFallback`/`_TRACE`, `FIGHT_FALLBACK_CODES`, `isFightFallbackRefusal`, `fightFallbackSentence`, `fightFallbackRefused`, `PRESS_ADMISSIONS`, `KILL_ORDER_ADMISSIONS`, `execKillByPress` (wrapper) over `execKillByPressOnce`, the admission arm at the ladder's kill rung and at `execKill`'s no-weapon refusal, `out.fightFallbacks`/`liveRun`. `twoPassSolve`: `rewindRun`, the whole-pass retry. `watchSolve.solveForPage`: the factory, `liveRun`. `procgenOracle.solve`: `solveOnce`, the whole-solve retry, the record fields |
| byte-inertia (flag OFF) | — | identity block at head = base row for row; six `--check`s; the sweep 45/45 = A4 |
| tests | — | `hammerFightFallback.test.js` (9 rows, explicit timeouts), fixtures `hammer-b3-admission-c3.json`, `hammer-b3-admission-c4-killlock.json` |
| instruments | — | `check-seedling-rewind-exactness.mjs` + `rewindExactnessHook.js`; `check-seedling-hammer-monotonicity.mjs` gains the `fallback` and `whole` modes and records which path produced the keys |
| tapes / roster | 259 | 259 (no tape moved, none added) |
| surface / constants | GREEN 227 / 5,443 | unchanged |
| bounded vitest | 83 / 3,079 | 83 (− `seedlingGenCapacity`, measured in its own runs; + `hammerFightFallback`) / 3,089 |

## What the brief got wrong (measured)

1. **"rewind to the tick the kill STARTED … the natural point"** — natural, but on every generated row the kill starts
   at tick 0, so the rewind is a whole re-solve there: same verdict, ticks and wall time as the whole-solve retry.
2. **"the press arm's admission refusal — name … why each is or is not included"**, with the design placing the retry
   only at coded corners: most of what the fight adds (12 of 21) is the ADMISSION refusal. It is terminal at two
   places (the ladder's last rung, the kill-lock order's "no weapon") and is answered there; at the kill-lock press arm
   it is not terminal and stays out.
3. **"Everything that feeds a run besides the keys … the pass's persistence declarations, pending declarations,
   scratch persistence, item grants / equips, any gameTick oracle answers, a frontier state"**: all of those are
   construction inputs (the factory's), except equips; the one the list missed is the APITEM take — the segment's own
   view writes `takeApItem` into the run on the take tick (and the crusher's `fork` does not replay it: a latent
   divergence there, residue).
4. **"a GAME witness if a refused-today record can be staged as a tape"**: none can (all are level 900; L18 never
   refuses with today's defaults).
5. **"seedlingGenCapacity … must finish and stay comfortably inside 900 s"**: the slow census does (703 → 712 s); the FAST file does not finish ON, because its killgate row's draw re-rolls past every bound once refused gates certify — D2.4.
6. **"B1's seven are NOT refused today … measure them anyway"**: they never reach the fallback (it only runs on a
   refusal), so the measurement is the monotonicity count (0) — re-solving them would re-measure OFF.

## Residue

| # | item | owner |
|---|---|---|
| 0 | No other process's temp directory was removed; every path I created was removed by name (the instruments remove their own `mkdtemp` directories) | — |
| 1 | **The capacity re-roll cost (D2.4)**: the fast file's seed-57 killgate draw does not finish ON (either escape state); levers listed there, none measured | planner |
| 2 | The crusher's `fork` (`forkRun`) replays keys and equips but not apitem takes (D0's list): a fork past a take diverges. Read only by `bait` | fidelity arc (crusher) |
| 3 | The rewind has no measured late-starting kill: its saving over the whole retry is unmeasured on real rows | a later slice |
| 4 | `plan-seedling-ladder2-witness --check` DRIFT at the base (pre-existing) | fidelity arc |
| 5 | `check-procgen-help`: 25 failures on instruments this slice did not touch | — |
| 6 | The JS worker gets no fallback until it wires a factory (above) | JS arc |

## Byte-inertia

- **Not touched:** AS3, wasm, any gitlink, rules, the JS arc's files, `chooseBodyToRemove`, the ghost-sword press, the
  crusher bait, `DEADLINE_SITES` (no row added).
- **No committed tape moved; no producer digest moved** (flag OFF, and ON).
- **Not run:** `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). `git stash` was not used.
- **Kills:** by PID only (a mis-written chain, the identity block it had started); no pattern kill.
- **Scratch only, never committed:** `/tmp/claude-0/sp`, `/tmp/claude-0/w0`, `/tmp/claude-0/d0`, `/tmp/claude-0/d2`,
  the two worktrees.

## Rows to BANK

- **Nothing moved with the flag OFF**: acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY
  `30bcc49c`, killgate `006b0639`/`7d4cb820`/`49e23d85`, producers `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1
  13b8d51f`; roster 259; surface GREEN 227; constants 5,443; entities 528; profile 138.
- **New:** `check-seedling-rewind-exactness` over the 11 rows above — 2,440 probes, 0 mismatches; `hammerFightFallback`
  9/9.
- **For a licence (ON, not banked):** the movers table in D2.6, and the capacity finding in D2.4.
