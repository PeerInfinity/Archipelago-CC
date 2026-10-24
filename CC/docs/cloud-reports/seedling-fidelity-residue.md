# Seedling fidelity RESIDUE — TIMEDPASS's pass to the exit (`drillTimedPassExit`, OFF); whirlpools in the walk (`whirlpoolDrown`, OFF)

| | |
|---|---|
| Session | `seedling-fidelity-residue` (planner `seedling-fidelity-planning-11`, wave 28) |
| Start SHA | `d3346cf784` (= main, recorded; the harness branch was already there) |
| Head | the commit carrying this report (the last on the branch); last code commit `bda327b4` |
| Harness branch | `claude/seedling-fidelity-residue-alhow6` (nothing pushed elsewhere) |
| Port | 9728 (9729 the pristine base worktree's W0 server, 9730 the scratch ON tree's probe server) |
| Verdicts | **W0 PASS · D-A PASS behind `drillTimedPassExit` (OFF; 2 p4g witnesses, 0 px) · D-B PASS behind `whirlpoolDrown` (OFF; 1 p4g witness, 0 px) · Movers: measured, STOP for the licence (list below)** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-residue-evidence/` |

## The one thing to know first

**D-A: "the same search, goal = the crossing" was only half of it.** After the Fire cut, the drill the rope's `FallRock`
release hops onto the stance hits the player whatever it does (81 of 81 two-tick key sequences, each held 10 more ticks),
so the cut's STAND must be chosen for the way out it leaves. ON, the pass to the cut is certified with the exit's pass
behind it: **from the L25 arrival both L28 doors SOLVE hit-free (182 t / 134 t), game-witnessed at 0 px; from the L26
arrival the only stand the search finds leaves no way out and the clear-tag refuses by name** (its forced-hit reading:
two hits, over the budget — measured, not built). **D-B: the whirlpool drown is transcribed and witnessed at 0 px, a walk
that drowns refuses by name, and the pull is priced. It moves ONE sweep row at the defaults, and that row is HITLESS's R1
live: leg `level_57 <- in_L58_48_112 -> exit:out_tentaclebeast_80_48`'s CONTINUATION request (the page interrupts the
plan mid-fight) threw the plain drown `Error` OFF (`whirlpool#36 … tick 928`, at every seam time −3..+3) and the page
re-ran its old 1212-t plan; ON it SOLVES 372 t (`dodge`, then the walk), game room hits 0, ×2.** With HITLESS OFF the 15
seed/staging pairs that threw now solve, no death.

## W0 (PASS)

**The base.** The harness branch was at `d3346cf784`; `session_bootstrap.sh --seedling` → `READY`, node v22.22.0; server
PID kept, port 9728. W0 was measured on a pristine detached worktree at the base (`/tmp`, its own server on 9729).

| row | command | result |
|---|---|---|
| identity block | `SEEDLING_PORT=9729 bash scripts/procgen/identity-block.sh .` at the base worktree (`evidence/identity-w0.txt`) | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5` — equal to TIMEDPASS's and HITLESS's published rows. Generated set: the worktree has no venv (environmental) |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `0dd65640`, all exit 0 |
| reference | `generate-procgen-reference.mjs --check` | 4 DIFFER — the environmental four (registry, capabilities, two substrate regions), at base and head alike |
| surface / constants / entities / profile | each `--check` at the base | GREEN **345** · PASS **6,908** · PASS **566** · PASS **138** |
| roster | `fixtures/tapes/index.json` | **289** tapes |
| tapeRunner pairs | sorted `status\tfullName` of `tapeRunner.test.js` (`evidence/tape-runner-pairs.txt`) | **635**, md5 **`88fc7df4dd05d11dfd84ebbea675cc8e`** |
| bounded vitest BEFORE | 210 files at the base (`evidence/vitest-files.txt` = these + `fidelityResidue.test.js`: HITLESS's 165 ∪ TIMEDPASS's 96 ∪ the brief's named rows ∪ every test `grep -a`-hitting `whirlpool`, `drownStep`, `dangerVolumes`, `DRILL_TIMED_PASS`, `execDrillTimedPass`, `corridorBodyForecast`, `stateDigest`, `drown`, `playerDeaths`; `.slow` excluded) | **6,654 tests, 6,654 passed** |
| ON keys | `grep -c ': true,' contactFidelity.js` | **54** (as the brief said) |

**D-A W0 — the residue, reproduced** (`evidence/tools/da.mjs`, `solveSegment` with `forkRun`, Fire alone, goals
`[cut {28,0}, reach-exit]`): all four (arrival, door) pairs refused at the walk's first gate — *"the danger map forbids
(152.18,56.37) — enemy:drill@128,96 … (152,56)"* from L25, *(151.87,55.81)* from L26. **From that state no continuation
is hit-free** (`evidence/tools/da2.mjs`: L25 post-cut state, all 81 two-tick key sequences then 10 ticks held: 81 hit).
`da3.mjs` (L26, idle): the hit at t1 knocks the player to (142.57,50.06) — steering is blocked for the whole 20-tick
i-frame (`canSteer: hitsTimer <= 0`) — and at t21 `drill@80,96` (at (136,56), 6.57 px away in x) lands a second hit.

**D-B W0 — the whirlpool (AS3, `Puzzlements/Whirlpool.as:44-97`, `Player.as:1431-1444`).**
- *The pull*: on every update while LIVE (`timerSetDies <= timerSet < timerSetLive + timerSetDies` after the decrement:
  grow 150, live 60, dies 30) and `collide("Player")` with the player's point within `(width − originX) × scale` = 16:
  `r = int(d)`, the player moved to the centre and back out by `r = int(r × 0.999)` (one pixel less for any r < 1000) at
  the angle less `spinRate` 20° — an ABSOLUTE write, before the player updates (the whirlpool is added runtime, newest
  first).
- *The drown*: at `r <= 1`, `player.drown()` on EVERY update (`deathCount` is 0 and never set): `drownTimer = (drownTimer
  − 0.5 + 10) % 10`, `v` the spiral, `dying = true`, and `die()` (→ `restartLevel`) when the timer reaches 0 — the 20th
  call. `dying` skips the player's `super.update()` (no input, no move) and is never cleared; `drowning` is NOT set, so
  the player's own `checkDrowning` does not spin. A whirlpool that ends its live portion first leaves the player `dying`
  where it stands.
- *Where the model stepped it*: `levelRun.stepTentacleRuntimeNow` → `tentacleBeast.stepWhirlpool` (the pull, exact); the
  drown THREW a plain `Error` (bosskills D3).
- *Why nothing priced it*: `dangerMap.dangerAt` / `dangerVolumes` had no whirlpool source, so the walk's probe never saw
  one; the walker (`botDriverV2`) does not read the danger map at all (no `dangerMap` import). HITLESS's settle keeps the
  verb's own continuation out of them (`tentacleBeastSettleStep`), which is why the defaults never meet one.

## D-A — the pass to the exit (PASS, behind `drillTimedPassExit`, OFF) — `afa084bd`, witnesses `8dcc0205`

`contactFidelity.js`: **`drillTimedPassExit`** (OFF; `SEEDLING_DRILL_TIMED_PASS_EXIT=0|1`). `solverBot.js`:
- **`searchDrillTimedPass`** gains two options (absent OFF: byte-identical): `cross {level, index}` — the goal is a child
  whose stepped state carries the stepper's teleporter transition through that door to that level (any other crossing
  still refuses; no stand is tracked) — and `accept(keys, i)` — a found walk may be passed over (at most
  `DRILL_TIMED_PASS.acceptMax` 24, once per 8 px cell + drill configuration) and the search runs on.
- **`execDrillTimedPassExit`**: a `reach-exit` whose planned walk to the door wakes a live stepped drill, in a run with no
  drill-killing weapon (the kill stays first), is searched as the pass is with the goal the crossing, certified on the
  segment's fork (`certifyExitPass`: played to the crossing hit-free), then played; record `drillPass` on the
  `reach-exit` record (`verb: 'drill-pass-exit'`). Otherwise null and the walk runs as before.
- **`execDrillTimedPass`**: when the segment's NEXT goal is a `reach-exit` (`exitAfterGoal`), a stand is accepted only
  when the cut's certificate holds AND, on that same fork, the crossing's pass is found and plays hit-free
  (`certifyExitAfterCut`). The record gains `exitAfter {passedOver}`. A cut with no exit after it is unchanged.

**Measured (ON)** — `fidelityResidue.test.js`:

| Fire alone, `[cut {28,0}, reach-exit]` | OFF | ON |
|---|---|---|
| from L25 → L26 door (0,96) | REFUSED at the gate (`enemy:drill@128,96`) | **SOLVED 182 t, 0 hits** — stand passed over ×2, pass 60 t (OFF's cut-only 59), exit pass 111 t, certified |
| from L25 → L25 door (96,0) | REFUSED at the gate | **SOLVED 134 t, 0 hits** — exit pass 63 t |
| from L26 → either door | REFUSED at the gate | REFUSED at the cut, by name: *"(152,56): walks arrive from search tick 107, and none in 45 ticks stands 14 ticks there contact-free with a way out (1 passed over: after the cut, no pass to the crossing …)"* (`obstacle: {kind: 'drill', id: 'drill@80,96'}`) |
| cut alone (no exit after) | 70 t | 70 t, tick-identical |
| Sword from L26, cut then exit | solved | tick-identical |

Measured and **not built** (removed for its code): a forced-hit fallback for the L26 exit (the proof holds at depth 2,
least 1 hit; but every leaf's knockback ends inside `drill@80,96`'s box when the i-frame runs out — 12 of 12 leaves — so
leaving costs two hits, over `FORCED_HITS`' budget). Widening the stand search (`arrivalStall` 45 → 400, horizon 900)
found no second stand at L26 (52 s).

**Witnesses** (`probe-seedling-timed-pass.mjs --record`, the two new `TIMEDPASS_EXIT_WITNESSES`, both keys ON, p4g,
`fixtures/timedpass-witness/`): `residue-l28-fire-l25-exit-l26` (182 sampled ticks) and `residue-l28-fire-l25-exit-l25`
(133): **0 px** (player, every drill with hits/anim, chasers), **the game's player never hit**, the game ends in L26 / L25.

**Mutants** (predicted first, copy + restore; `evidence/mutants.txt`): a1 `execDrillTimedPassExit` not called → the two
exit rows red (measured: + both witnesses' re-plans, 4); a2 the certificate ignores the way out → L25 rows red (measured
6: + the re-plans and both L26 wordings); a3 the crossing accepts any teleporter → predicted the L25-door row red;
**SURVIVES** — no L28 pass reaches another door first, and the fork's certificate checks the level anyway (named).

## D-B — whirlpools in the walk (PASS, behind `whirlpoolDrown`, OFF) — `9ef99e56`, witness `c1d5dddc`

`contactFidelity.js`: **`whirlpoolDrown`** (OFF; `SEEDLING_WHIRLPOOL_DROWN=0|1`). ON:
1. **The model** (`levelRun.stepTentacleRuntimeNow`): the external `drown()` transcribed — the pull's write, then
   `drownStep` (the timer, the spiral `v`), `state.drown.dying = true`, a `tentacleLedger` row `kind: 'drown'`, and on the
   twentieth call `pendingDeath` (source `whirlpool`, id the whirlpool) → the existing reboot (`playerDeaths`, respawn).
   `playerPhysicsV2.step`: `drown.dying` without `drowning` is a still tick (no spin of its own; the whirlpool's `v`
   stands unspent); `levelRun`'s `acting` gate drops input while `dying`.
2. **The solver sees it**: `solveSegment`'s `walkTo` refuses a walk during which a whirlpool drowned the player, by name
   (`obstacle: {kind: 'whirlpool', id}` — **a new `SolverRefusal.obstacle.kind`**), before any re-plan from the respawn;
   the Tentacled Beast verb's plays (`playTentacleBeastPolicy`, the settle) count the drown as a death
   (`tentacleDeaths`, why `"the player drowned in whirlpool#N …"`).
3. **The pull is priced**: `dangerMap.whirlpoolDanger` in `dangerAt` (WAIT: any update from the next to the question's
   tick; TRANSIT: the ETA's own; box ∩ the 32x32 box AND the entity point inside r 16), a `dangerVolumes` row per
   whirlpool not yet dying; the DODGE rung's **WHIRLPOOL arm**: when every probe reason is a whirlpool, one stall at the
   walk's start as long as the named whirlpools still pull, certified by the corridor's preview + probe, then re-plan.

No walker edit: `botDriverV2.*` is untouched, and the walker does not import `dangerMap` — **no `producer:walker` sweep
row can move**. No new per-visit run map (`state.drown.dying` is in `state`, the digest's `player` part; the drown rows go
to the existing `tentacleLedger`).

**Witness** `fixtures/whirlpool-witness/whirlpool-drown-s15.json` (`probe-seedling-bosskills.mjs --record --dir=whirlpool-witness`,
p4g; the tape: the door staging at seed 15, the HITLESS-OFF fight, then a bang-bang walk at `whirlpool#78`'s centre —
`evidence/tools/drowntape.mjs`): **0 px on all 2144 sampled ticks** of 2242 (CPU load; the samples are a subset) — the
pull, the player held at (106.967,115.895) for the 20 calls, `die()` at t2202, the respawn at (104,72) with hits 0. OFF the
model refuses the first `drown()` at t2183, as before (pinned).

**Seed sweep** (HITLESS's tool, `evidence/tools/sweepB.mjs`, `[fight {57,0}, mouth]`, seeds 1..40, two stagings;
`evidence/seeds/`):

| staging | HITLESS | key OFF | key ON |
|---|---|---|---|
| door (96,64) | ON (default) | 40 SOLVED | 40 SOLVED, **all 40 identical** |
| door | OFF | 33 SOLVED, **7 ERROR** (the drown throw) | **40 SOLVED, 0 deaths**; plan movers seeds 4 (1019 → 1150) and 34 (1367 → 1503): the walk now waits out a whirlpool it used to cross unpulled |
| `tb-solve-s2` (96,160) | ON (default) | 40 SOLVED | 40 SOLVED, **all 40 identical** |
| s2 | OFF | 32 SOLVED, **8 ERROR** | **40 SOLVED, 0 deaths**; plan movers seeds 10 (2132 → 2259), 33 (1477 → 1495) |

**Mutants**: b1 the drown throws again → predicted the witness ON row and the seed-15 solve red; MEASURED the witness row
alone (the priced walk never meets the pull); b2 `whirlpoolDanger` returns nothing → seed 15 REFUSES *"the player
DROWNED in whirlpool#78 at run tick 2207 … a walk that died is refused, not re-planned from the respawn"* (as predicted,
+ the pricing row: 2 red); b3 the DODGE stall one tick short → seed 15 red (as predicted).

## The movers — before → after, and the dispatches to confirm

**Route survey, full** (local, `survey-seedling-route.mjs --through=end --route=full`, OFF vs `SEEDLING_DRILL_TIMED_PASS_EXIT=1
SEEDLING_WHIRLPOOL_DROWN=1`): **239 rows, SOLVED 186 / REFUSED 53 in both; 0 rows differ** by (level, goals, boot) on
verdict, refusal, ticks, replans, passes and replay (`evidence/survey-full-{off,on}.txt`). The full route has no Fire-only
L28 step; its L57 step (110) runs HITLESS's settle.

**Keyed sweep ×2** (local, p4g, `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page-legs=1
--leg-budget-ms=240000`, the 16 L28/L57/L58 legs of `evidence/sweep-leg-keys.txt` derived at the base; arm A =
`evidence/sweep-arm-A.txt` (the 54 defaults), arm B = `sweep-arm-B.txt` (+ both keys); `evidence/sweep-{A,B}{1,2}.jsonl`):
**every verdict equal in all four runs; game room hits 0 in every row of every run.** The 8 L28 legs are tick-identical
(every L28 leg's inventory holds the Sword, so D-A never runs there). The two L58 legs from the mouth via r4c1
(`… ~> level_58__r4c1 -> exit:out_teleporter_80_16`, `… -> location:L58 flag 1: yeti@56,56 cleared`) fail in every arm
(base behaviour, not this slice's). Two rows differ, both L57 continuations:

| leg (key) | A1 | A2 | B1 | B2 |
|---|---|---|---|---|
| `level_57 <- in_L58_48_112 -> exit:out_tentaclebeast_80_48` | done: 1212 t, interrupted, **resumed** the same plan (the continuation's solve threw the drown) | same | done: 1212 t interrupted, continuation **372 t `dodge`+`walk`** | same, 371 t |
| `level_57 <- in_pit_L56_6_10 -> exit:out_tentaclebeast_80_48` | 2177 + 258 t | 2177 + 258 t | 2177 + 259 t | 2177 + 259 t |

Decided on captured requests (arm A, `--capture-requests`, replayed in node: `evidence/replay-l57-{off,on}.txt`,
`evidence/census-494-1-on.jsonl`): leg 494's continuation requests i=1 / i=2 are the drown throw OFF at every seam time
−3..+3 and SOLVED 372 t ON at every one (1 answer over 7): **a real plan mover, the brief's R1**. Leg 492's continuation
replays to 259 t OFF as well (the A rows' 258 came at another seam time): **run noise, not this slice's**.

**Probes standard, ON** (local; a scratch worktree at `bda327b4` with both literals flipped, its own server on 9730,
`--host`): **11/11 ALL CHECKS PASSED** (`evidence/probe-battery-standard-on.txt`: logical-links B,R; vanilla-map;
arrival-composites; midroom-replan D; restart-route W,J; restart-warp W,J; adopt; obstacle-events W,J;
generated-playback; loop-restart; seal-delivery A). The container restarted once mid-battery: logical-links had passed,
the other ten were re-run from the start.

**Bounded vitest ON** (the scratch tree at `c44e20f5` with both literals flipped; 211 files, `evidence/rows-on.txt`):
**6,680 tests, 4 red — every one a flip re-pin**; tapeRunner pairs 635 `88fc7df4…` (= W0).

**Please run, on this branch** (my last head):
1. **Survey full A/B**: `seedling-survey.yml -f through=end -f route=full` at my head (OFF), and the same on a planner commit
   flipping `drillTimedPassExit` and `whirlpoolDrown` to `true` (ON). Expected: 0 movers; compare against 39496129402 by
   (level, goal, boot).
2. **Keyed sweep A/B ×2**: `seedling-divergence-sweep.yml -f keys='<the 16 keys of evidence/sweep-leg-keys.txt, '|'-joined>'
   -f leg_budget_ms=240000 -f capture_requests=true`, arm A `-f contact_fidelity=$(cat evidence/sweep-arm-A.txt)`, arm B
   `-f contact_fidelity=$(cat evidence/sweep-arm-B.txt)` (⚠ the input turns every unlisted key OFF: both files list all
   54 defaults), each twice.
3. **Probes**: `seedling-probe.yml -f battery=standard` at my head (OFF) and on the flipped commit of (1);
   `-f probes=probe-seedling-timed-pass.mjs` at my head (4 witnesses; it plans with each witness's own keys).

## What the JS arc must wire / pins that move

- **No contract change** to `solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging`.
- **New `SolverRefusal.obstacle.kind`: `'whirlpool'`** (`{kind, id}`), ON only.
- **New optional record fields**: `drillPass` on a `reach-exit` record (`{verb: 'drill-pass-exit', drills, to, ticks,
  expanded, certified}`); `exitAfter {passedOver}` on the rope clear-tag's `drillPass`. ON only.
- **Run state the skin reads**: `run.state.drown` may carry `dying: true` (ON only, during a whirlpool drown); the
  `tentacleLedger` gains `kind: 'drown'` rows; no field renamed. `seedlingSkinRenderer.test.js` is in the bounded set.
- **The walker**: untouched; no `producer:walker` row can move (the walker does not read the danger map).
- **Flip re-pins owed** (the ON reds of the bounded set — nothing else, no tape, no producer, no control):
  1. `contactFidelity.test.js` › the shipped defaults (both keys `false` → `true`);
  2. `fidelityResidue.test.js` › D-A *ships OFF*; 3. › D-B *ships OFF*;
  4. `fidelityTentacleBeast.test.js` › HITLESS *seed 7: ON, a variant whose fork drowns …* — `tried[1].why` reads
     *"the player drowned in whirlpool#N at spent …"* instead of the thrown message (the variant is rejected as before).

## Handed to the hammer arc

Nothing. `planWaypoints`, the escape, `stateDigest*`, the fork closure / `replayOntoFork` (called, not edited), the forced-hit
proof (`proveForcedHit`, called only in a measurement that was then removed) are untouched. The new state
(`state.drown.dying`) lives in `state`, which the digest's `player` part already hashes.

## Deltas

- `contactFidelity.js`: `drillTimedPassExit`, `whirlpoolDrown` (OFF) + their env overrides; `contactFidelity.test.js` pins.
- `solverBot.js`: `DRILL_TIMED_PASS.acceptMax`; `searchDrillTimedPass` (`cross`, `accept`); `execDrillTimedPass`
  (`exitAfter`); `certifyExitAfterCut`, `certifyExitPass`, `execDrillTimedPassExit`; `exitAfterGoal` and the `reach-exit`
  hook in `solveSegment`; `tentacleDeaths`, `tentacleDeathWhy`; `walkTo`'s drown refusal (`deathsNow`,
  `refuseIfDrowned`); the DODGE rung's WHIRLPOOL arm.
- `levelRun.js`: the drown transcription in `stepTentacleRuntimeNow`; the `acting` gate. `playerPhysicsV2.js`:
  `dyingOutside`. `dangerMap.js`: `whirlpoolDanger`, the `dangerVolumes` rows. `solverView.js`: `WHIRLPOOL`,
  `whirlpoolRect` re-exported.
- `fidelityTimedPass.js` (`TIMEDPASS_EXIT_WITNESSES`, per-witness `switches`), `probe-seedling-timed-pass.mjs` (plays both
  lists); new `fidelityResidue.test.js` (24 rows); fixtures `timedpass-witness/residue-*` (2), `whirlpool-witness/` (1).
- `entityBlocks.js` (`tentacleBeastFight` read by `dangerMap` too) + its doc table in `seedling-solver-surface.md`;
  `solveProgress.js` (`whirlpool` a forecast source in `dangerKindOf`) + its TC2 pin — the three OFF reds the bounded
  AFTER found (`c44e20f5`).
- Censuses: surface **347** GREEN (two classified imports), constants **6,913** PASS (two classified rows re-keyed in
  `seedling-constants-fields.csv` where D-B extended their statements; no retirement). The bot-log entry.

## What the brief got wrong (measured)

- *"Extend the pass search … to a `reach-exit` goal (same search, goal = the crossing)"* — not enough: after the cut
  every continuation is hit (81/81), so the stand before the cut must be certified with its way out. And from L26 no
  stand the search reaches has one (refused by name; forced, it costs two hits).
- *"From both arrivals to both L28 doors"* — the fix reaches two of the four: L25's.
- *"the walker (`botDriverV2.*`) changes need the JS arc's review"* — none were needed: the drown is refused in
  `solveSegment`'s `walkTo`, and the walker does not read the danger map, so no `producer:walker` row can move.
- *"HITLESS's settle avoids it only inside the tentacle verb"* — true, and it is exactly where it leaks: a page
  CONTINUATION solved from mid-fight (leg 494, the sweep's interrupted plan) starts outside the verb's settle and walked
  into a live whirlpool — the drown throw, at the defaults. The 80 seeds × 2 stagings and the survey (whole solves) never
  meet one.

## Residue

- **L26 → either L28 door with Fire alone** stays refused (the cut's only stand has no way out). A pass that lures
  `drill@128,96` off the stance's column before the cut, or a stand searched through the rock's span (the forecast does not
  step the ceremony — TIMEDPASS's residue), is the next step. ⚖ The menu return to the start region remains.
- **A whirlpool that ends before the 20th call leaves the player `dying` for good** (the game's soft-lock until the
  menu) — transcribed, not witnessed.
- **The pull is priced conservatively** (the disc, any live update): four HITLESS-OFF seeds wait out a whirlpool they used
  to cross unpulled (+18 … +136 t). At the defaults nothing moves.
- **Cost**: D-A's L26 refusal now spends ~13-15 s (the search with the exit certificate); L25's two solves ~10 s and ~1 s.

## Byte-inertia (OFF)

- **Identity at head equals W0 on every md5 row and all six producer `--check`s** (exit 0; `evidence/identity-after.txt`
  diffed against `identity-w0.txt`: identical); the reference differs by the environmental four only (my docs-index
  region regenerated).
- tapeRunner pairs 635 `88fc7df4…` (= W0, and = W0 ON); roster 289; surface GREEN 347; constants PASS 6,913; entities
  PASS 566; profile PASS 138.
- **Bounded vitest AFTER** (default, 211 files, `evidence/rows-after.txt`): 6,680 tests, 6,677 passed, 3 red at
  `bda327b4` — the contract tables above, fixed in `c44e20f5` (`entityBlocks` 30/30, `solveProgress` green on re-run).
  = BEFORE's 6,654 + `fidelityResidue` (24) + `contactFidelityHook`'s per-key rows (2). OFF the solver plans every
  witness, tape and survey row as at the base (survey 0 diffs; sweep arm A = base behaviour).

## CI

`JavaScript Unit Tests` at `7bf06d68` (run 40058506803): **failure, 1 red of 22,450** in the unfiltered suite
(22,449 passed), slow battery green (267/267). The red is `procgenDocs/generated.test.js` › *`--check` exits 0* — the docs
index's line/word counts, moved by the bot-log paragraph added in that same commit (mine; the regenerated index is the
next commit). The run at this report's head is quoted in the session's closing message (`ci-vitest-summary.mjs <head>`);
expected: green.

## Rows to BANK

- D-A: after an L28 Fire cut the released drill's hit is unavoidable from that state (81/81); a stand must be certified
  with its way out; Fire from L25 → both doors SOLVED hit-free (182 / 134 t), 2 p4g witnesses at 0 px; L26 refused by name.
- D-B: `Whirlpool.as`'s external `drown()` (dying without drowning, 20 calls, die) transcribed, p4g witness at 0 px on
  2144 ticks; the pull priced; at the defaults one sweep mover (leg 494's continuation: the drown throw → SOLVED 372 t,
  ×2, captured and replayed at 7 seam times); 80 seeds and the survey unchanged; HITLESS OFF 15/15 drown throws → solved.
- Trap candidates (bot-log): certify a goal WITH what follows it; an external `drown()` is not the hazard drown; a death
  inside a walk is not a stall to re-plan from.
- Commits: D-A `afa084bd`, D-B `9ef99e56`, witnesses `8dcc0205` / `c1d5dddc`, censuses `bda327b4`, evidence, this report.
