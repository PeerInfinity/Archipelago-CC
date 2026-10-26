# Seedling fidelity L40LATCH — L40 Boss Key 2's S-door latch held under `bobsoldier@880,832`: the hold's still wait priced (`holdWaitPriced`), a BobSoldier killed on the move behind its blade (`chaserOrbitKill`) — both OFF

| | |
|---|---|
| Session | `seedling-fidelity-l40latch` (planner `seedling-fidelity-planning-14`, wave 32) |
| Start SHA | `1e17f44738` (main, 85 default-ON keys; not rebased) |
| Code head | `5bab5247`; docs and evidence are the commits after it, this report the last |
| Harness branch | `claude/l40-latch-hold-f1kcmi` (nothing pushed elsewhere) |
| Port | 9742 (main tree), 9743 (the pristine base worktree), 9744 (the ON worktree, both literals flipped, for the probes) |
| Verdicts | **W0 PASS · D1 PASS behind two keys (the latch is held: the BobSoldier killed first, on the move; game-witnessed at 0 px) · D2 MEASURE + STOP (next gaps named, both in the hammer arc's region) · Movers: STOP for a licence** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-l40latch-evidence/` |

## The one thing to know first

**The latch hold is solved by killing the BobSoldier first, and no still stance can do that: its blade rests where the
player last stood.** `BobSoldier.swordHitting` tests the blade (8–16 px off the body) every frame, spinning or not, and a spin
ends pointing at the player. The game decides it: a still holder on the latch is hit at t93, again at t113, and dies at t133,
and the model agrees at 0 px (`l40latch-stand`).

With both keys ON, from the latch staging the solver:
- prices the hold's wait at the stance walk, so the ladder climbs (`holdWaitPriced`);
- kills the BobSoldier on the move, behind its resting blade (`chaserOrbitKill`, t184);
- kills `spinner@816,848` by the press arm;
- meanwhile `wandlock@480,560` fades open, because the latch published {t 3} on tick 1.

It is never hit, and the game plays those 271 ticks at 0 px (`l40latch-orbit-chain`).

**The leg does not reach the latch yet.** Legs 859/860 die earlier, in the x≈744 corridor: two bobs that no single removal
clears, and the press kill. Both are the hammer arc's. The survey and the 52-leg sweep do not move.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `git checkout -B claude/l40-latch-hold-f1kcmi 1e17f44738`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9743 bash scripts/procgen/identity-block.sh .` in a pristine detached worktree of the base, venv active (`evidence/identity-w0.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5` |
| six `--check`s | in the block | battery `da331da7` **exit 1** · d2-chain `8be1a293` **exit 1** · l18 `b8d8452a` **exit 1** · tail `35456fbc` exit 0 · r9-l3 `6cd35fe1` exit 0 · r9-campaign `e69370f6` **exit 1** |
| generated set / reference | in the block | generated set not run (the venv's Playwright 1.56 vs the 1.63 pin, environmental); reference 4 DIFFER in the worktree (its symlinked submodules; L40BK2's same row) |
| surface / constants / entities / profile | each `--check` (`evidence/censuses-w0.txt`) | GREEN **353** · PASS **6,952** · PASS **566** · PASS **138** |
| roster | `fixtures/tapes/index.json` | **289** |
| tapeRunner pairs | sorted `status\tfullName` of `tapeRunner.test.js` (`evidence/tape-runner-pairs-w0.txt`) | **635**, md5 **`88fc7df4dd05d11dfd84ebbea675cc8e`** |
| bounded vitest BEFORE | 130 files (`evidence/vitest-files.txt`: the brief's list — no `apReportBosses.test.js` exists — L40BK2's 110, and every test naming `runHold`/`execHold`/`KEYLOCK_WAIT_PRICED`/`'hold'`/`CONTACT_FIDELITY_KEYS`), in the base worktree, `--maxWorkers=2` | **3,442 / 3,442** |

⚠ **Four producer `--check`s are exit 1 AT THE BASE.** The l18 row, re-run alone in the base worktree, reports ⛔ DRIFT on
`fixtures/traces/r8-solve-18.trace.json` only (the tape is byte-identical). The regenerated trace differs by
`"why": "certified whole (fidelity L40BK2)"` rows: `dashSpinnerForecast` was flipped ON in W31's harvest without
re-recording the traces. That is a base fact. Every comparison below is base against head.

**W0 — the first refusal, captured and replayed.** Legs 859/860 (keys `level_40__r32c36 <- in_L39_144_0 ~> level_40__r23c29 ->
location:Level 040 - Boss Key 2` and the same `<- in_L43_176_464`; ids unchanged at this base) were captured locally:
`probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --capture-requests`, default build p4g, seams 5190 / 5181
(`evidence/w0-sweep.jsonl`). They were replayed in node (`evidence/w0-replay-off.jsonl`), and the answers equal the page's,
one distinct answer each. Both refuse before the latch:
- **859**: request 0 stops at the anytime deadline; request 1 refuses at the burn stance's ladder: *"burn stance
  (burnabletree@872,784): the combat ladder is EXHAUSTED … chaser:bob@736,752"* (the x≈744 corridor);
- **860**: request 1 refuses in the hammer arc's press kill: *"burn stance … -> kill (spinner@880,848) by press: every key
  set — the plan's own and 5 alternative(s) — lands the player box on a body's 7x7 rect or on the 13 px hammer line"*.

**The latch is reached only from a staging, so the staging banks what is in front of it.**
`fixtures/l40latch-witness/latch-boot.json` is step 67's boot ON the latch (L40 (880,768), the player box inside
`buttonroom@880,768`'s rect) with three things banked by persistence:
- the chest `{40,13}`;
- the tree `{40,0}`;
- `spinner@880,848` `{40,16}` (spinners persist; the BobSoldier does not, and respawns).

That is the room as a re-entry finds it once those three are done. The first staging left `spinner@880,848` alive, and it
wandered into the latch room and hit a scratch fight policy, so it is banked too.

**The latch death, reproduced from the staging, on the game.**
- Witness `l40latch-stand` (p4g `seedling_bot_ap_p4g`, headless logic-only; `probe-seedling-l40latch.mjs --record`): the
  BobSoldier leaves the pocket at t49; its blade lands at t93 and t113, and the holder dies at t133.
- The model reproduces it at 0 px (the player and every body, 160 sampled ticks), hits and death included. No model gap.
- The solver at the defaults stands for the fade and refuses *"hold: hold tick 93 of 131 MOVED, from (888,776)"*, the
  brief's refusal at this staging (L40BK2's was tick 84 at theirs).

## D1 — the latch hold (PASS behind two keys, both OFF)

`contactFidelity.js`:
- `holdWaitPriced: false` (`SEEDLING_HOLD_WAIT_PRICED=0|1`);
- `chaserOrbitKill: false` (`SEEDLING_CHASER_ORBIT_KILL=0|1`).

Both are OFF and byte-identical OFF.

**What the game does to a holder.** A `room = -1` ButtonRoom latches on the first tick the player stands on it, and the lock
fades whoever stands where. But `runHold` stands still for the whole fade, and the BobSoldier closes at 0.8 px/tick once the
player is inside 80 px. The BobSoldier blocks the only way out of the pocket too, so the answer is to kill it.

**D1a — the hold's still wait, priced (`holdWaitPriced`).**
- The change: `holdStandWalk` puts the hold on the stance walk as its tail. It uses L30KEYLOCK's `stand` instrument, with keys
  empty as `runHold`'s. The tail stands the whole bound, the side to err on.
- **A rung that spends nothing is a loop (measured).** With the player already on the stance, the TIME rung answered 0
  ticks, the walk re-probed the same tail hit, and the climb looped forever (mutant m2: 300 s, no tick spent).
  - A hold's tail is marked `hold: true`, and TIME refuses a hit IN it by name (the probe's `waiting`).
  - A transit hit on a hold stance walk stays TIME's. That was measured as well: the first cut refused TIME on any hold walk,
    and changed leg 371's refusal text.
- **A latched hold under MOVING_WAIT paces its bombs (measured by the bounded set ON).** WANDHOLD's legs 368/371 (two paced
  holds of `buttonroom@272,208` beside `bombpusher@112,128`) lost their plans: the still tail priced the bomb that
  `pacedHoldPlan` paces at the executor. Such a tail is now marked `bombs: false`, and `previewWalk`'s new `standBombs` option
  drops the `kind: 'bomb'` spits from the tail's samples (the forecast still steps). `standTailOpts` builds the options of the
  three tail sites, and a keylock tail is unchanged.
- ON alone (`evidence/d1a-holdWaitPriced-alone.txt`): the ladder reaches the kill rung, and the chaser arm finds no stance.
  All 16 cells in the leash are hit by the BobSoldier at tick 93–100, and so is every guard approach.

**D1b — the BobSoldier killed on the move (`chaserOrbitKill`).**
- **Why no stance works.** The blade is tested every frame, at the angle of the last spin's end (`swordSpinningStop(ang)` =
  the player's angle). So a body walking at a still player meets it blade first.
- **What a fight can use.** The rest angle holds until the next spin, which begins only after 60 ticks inside `attackRange`
  (32 px).
- **`orbitKillPolicy`**, one held set per tick (`chooseHeld` toward a point relative to the body):
  - while the blade spins, or is about to: circle at `r`, outside the 8–16 px sweep;
  - while the resting blade is on the player's side: circle round it to the far side;
  - while the body is in its hit i-frames: back off to 34 px, past `attackRange`, where the reset timer stands;
  - on the far side with the body hittable: close in (10 px) and let the one strike policy press (⚖ 30(c));
  - a corpse still swings until its fade removes it: keep away and strike nothing.
- The kill rung's chaser arm tries it ON FORKS where its stance scan finds none for a BobSoldier. There are 20 candidates
  (`ORBIT_KILL_CANDIDATES`: 5 radii × 2 directions × 2 far-side arcs), and the first hitless kill (the body removed, no hit, no
  crossing) is played live, key for key. That is TURRETCIRCLE's shape.
  - From the staging, 8 of the 20 candidates are hitless (`evidence/orbit-candidates.txt`); a wider scratch grid had 257 of 720
    (`evidence/orbit-grid.txt`). It is not a knife edge.

**Both ON, from the latch staging** (`evidence/d1-both-on-ladder.txt`, `d1-chain-events.txt`):

| t | event (model) |
|---|---|
| 1 | the latch publishes {t 3} (the boot is on it) |
| 101 | `wandlock@480,560` is open — during the fight |
| 184 | `bobsoldier@880,832` removed (the orbit arm, candidate `r 22 ccw far 90°`, after the first candidate's fork was hit at t194) |
| 251 | `spinner@816,848` removed (the press arm; it had wandered up to the latch) |
| 271 | the next refusal: the walk west, in the x≈744 corridor (D2) |

The player is never hit.

**Witness `l40latch-orbit-chain`** (p4g, headless logic-only; `probe-seedling-l40latch.mjs --record`): the solver's own 271
ticks with both keys ON (the refused prefix, with its `equips`), folded onto the staging's header.

| check | result |
|---|---|
| the model (D1 ON) replays the tape to its end | PASS |
| the game reproduces the model at 0 px — the player, every block, chaser and turret — on every sampled tick | **PASS, 271 of 271** |
| the game's player hit count equals the model's on every tick | PASS (no hits) |
| OFF, the model parts from the game on | 0 ticks (D1 is solver-only) |
| the game never hits the player | PASS |
| the game's BobSoldier is killed and removed, and stays gone | PASS, from t184 |

**Rows** (`fidelityL40Latch.test.js`, 10; `fidelityL40Latch.slow.test.js`, 2):
- the switches ship OFF;
- the staging banks what it says;
- W0's recording, and the model at 0 px with hits t93/t113/t133-died;
- OFF, the brief's refusal;
- the candidate table;
- candidate 1 from the boot kills by t184, hitless;
- the orbit chain's recording and model at 0 px, ON and OFF;
- the latch on tick 1 and the lock at t101;
- slow: `holdWaitPriced` alone (the TIME and stance-scan refusals); both ON = the recorded tape, input for input.

### Mutants (predicted first; copy + edit + run + restore; `evidence/tools/mutants.py`)

| | mutant | predicted red | measured |
|---|---|---|---|
| m1 | `holdStandWalk` returns `{}` | both slow rows | exactly those 2 |
| m2 | the TIME guard never fires | the `holdWaitPriced`-alone solve never ends | exit 124 at 300 s, the climb looping (`evidence/mutant-m2.txt`) |
| m3 | the orbit policy never strikes | the candidate row (+ slow both-ON) | the candidate row (fast run) |
| m4 | the kill rung's orbit arm gated off | slow both-ON only | exactly that |
| m5 | the far-side test disabled | the candidate row | exactly that |

## D2 — the rest of the chain (MEASURE + STOP: named, both in the hammer arc's region)

**1. The walk back west through the x≈744 corridor.** From the held latch, the next order (`hold stance (wandlock@448,432)`)
walks west past `bob@736,752` and `bob@736,800`, which stand together.
- AVOID finds the components disconnected.
- `chooseBodyToRemove` names no body: no SINGLE removal admits a corridor, and `CHOOSER_HIT_SOURCES` never takes a chaser.
- So the kill rung gets no target: *"the danger on this corridor is not a body this run can watch die"*.
- The natural legs meet the same pair. Sweep A1's 859 at seam 5933 refuses at the burn stance with the BobSoldier covering
  the aim, and the chooser silent because `bob@736,800` holds the corridor (`evidence/a1-bk2-replay-*.jsonl`, the full text
  re-solved in node).
- **Hand-over (hammer: `chooseBodyToRemove`, `hitSourceBodies`).**

**2. `iceturret@472,400` on the walk to `wandlock@448,432`'s hold stance.** A scratch measurement had `hitSourceBodies`
admitting the probe's chaser sources (not landed; `evidence/d2-scratch-chaser-sources.txt`).
- With it, the bobs die on the chaser arm (t271 → t577).
- The walk then meets the ice turret as a static "Enemy" the kill rung has no arm for.
- TURRETCIRCLE's circling kill lives in the weigh's `killForCorpse`, not in the rung's static arm, and the static press arm
  (`STATIC_SWORD_ARM`, `KILL_ARM_POLICY.Turret`) is the hammer arc's.
- **Hand-over (hammer: the static arm).**

Past those two, L40BK2's pocket chain is the solver's own: links 4–9, game-witnessed. Its slow row re-solves the same tape
with my keys ON (below).

## The movers: before → after, and the dispatches to confirm

**Route survey, full** (local, `survey-seedling-route.mjs --through=end --route=full`; arm A = the 85 defaults, arm B = A +
both keys by env, at the final code; `evidence/survey-{A,B}.json`):
- 235 rows each, SOLVED 191 / REFUSED 44 each;
- **0 rows differ** (every field but `ms`);
- step 67 refuses at the press kill both ways (D3 / PKC).

**Keyed sweep ×2** (local, `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --capture-requests`, default
build p4g, `--contact-fidelity` arm A / arm B; the 52 legs in or into L40, re-derived at the base (the same 52 keys as
L40BK2's), `evidence/l40-leg-keys.txt`; rows `evidence/sweep-{A1,A2,B1,B2,B3}.jsonl`, `sweep-summary.txt`). A1 and A2 ran
at the code with both keys OFF, so they are unaffected by the ON-only fixes. B1 ran at `994389e7`, before the TIME refinement;
B2 and B3 ran at the final code `5bab5247`.

| run | done | failed | timeout |
|---|---|---|---|
| A1 | 39 | 12 | 1 |
| A2 | 39 | 12 | 1 |
| B1 | 40 | 11 | 1 |
| B2 | 39 | 12 | 1 |
| B3 | 40 | 11 | 1 |

- **Two legs flip, and both flip inside arm A too: seam noise.** Each was decided on a captured request replayed in node under
  each arm (`evidence/movers-replay.txt`, the request's stamp with the two keys set false/true):
  - **368** (`<- in_L41_0_160 -> Totem Part 64,144`): done / failed / done / failed / done. B2's request (seam 6099) and A2's
    (6119) each answer A = B, byte for byte (refused both arms);
  - **371** (`<- in_L42_240_336`): failed / done / done / done / done. B1's (5597), B2's (5589) and A2's (5600) answer A = B
    (SOLVED both arms). A1's refused request 1 (5603) answers A = B since `5bab5247`; at `994389e7` only the TIME rung's
    line differed — the finding that commit fixed.
- Arm B spends +12…16 work units on those requests (the hold tails' probes), and every answer is the same.
- **859 / 860: failed in every run, A and B.** Their refusals are the seam's: the burn stance's ladder at the BobSoldier with
  the chooser silent, the x≈744 bobs, or the press kill's death. None reaches the latch.
- **0 regressions by key, 0 intended movers.**

**Bounded vitest, both keys ON** (env, 131 files, at the final code; `evidence/rows-on.txt`): **3,444 / 3,454**. The 10 reds,
each attributed by running the key alone:
- `holdWaitPriced` — **four CONTROLS run with `movingWait` OFF**, where the still hold beside `bombpusher@112,128` is now
  priced at the stance walk (the ladder EXHAUSTED on the tail's bomb) instead of `lobberHoldRefusal`'s named refusal at the
  executor. Same obstacle, same verdict, new text:
  - `fidelityBombPusher` D3 "ON (movingWait, bombBlastBody OFF) … refused by name";
  - `fidelityL40Button` D2 "movingWait + bombBlastBody OFF";
  - `fidelityWandHold` legs 368 and 371 "OFF (movingWait, bombBlastBody OFF)".

  A flip owes each `holdWaitPriced: false` in its switch set (or the new text).
- `holdWaitPriced` — **`jsRuntimeSolverShouldStop` × 2** (L4's stairs, verbs `hold, shove, walk`): the same plans (255 t / 219
  t), but the work is 19 → 23 (dashless) and 57 → 61 (full), the hold's tail. The pinned window moves from 76 to 80 units.
  This is a re-pin and the JS arc's row.
- `chaserOrbitKill` — **`fidelityL30KeyLock` × 2**, the switch-by-switch CONTROLS with the target rescan OFF. With no stance
  for `bobsoldier@48,80`, the orbit arm now kills it hitless:
  - (224,80) both OFF: refused → SOLVED 393 t, 0 hits (`r 22 ccw far 110°`, 213 t);
  - (240,80) WAIT alone: EXHAUSTED → SOLVED 401 t, 0 hits;
  - (224,80) WAIT alone: 309 → 393 t.

  The defaults' rows (rescan ON) are unchanged. The L30 orbit plans are model-only: a game witness is owed with the licence
  (`evidence/l30-orbit.txt`).
- Env artifacts, not movers: `contactFidelity.test.js` "the shipped defaults" (the live set differs from the defaults under
  env), and this slice's own OFF row ("hold tick 93 MOVED").
- The first ON run (before `994389e7`) also reddened WANDHOLD's two ON rows and L40BK2's three leg-368 rows. That was the bomb
  pacing found above, and they are green since.

**Probes standard, both keys ON** (the two literals flipped in a worktree at `5bab5247`, served on 9744, every probe
`--host=http://localhost:9744`; `evidence/probe-battery-standard-on.txt`): **11/11 ALL CHECKS PASSED**, including
`logical-links --only=B,R` and `arrival-composites`.

**The fixture probes at the defaults** (main tree, 9742; `evidence/probe-fixtures.txt`): both ALL CHECKS PASSED.
- `probe-seedling-l40latch.mjs --from-fixture`: both witnesses, 0 px on 160 and 271 ticks;
- `probe-seedling-l40bk2.mjs --from-fixture`: the pocket chain, 0 px on 2,650 ticks.

**Legs 859/860's W0 requests** replayed with both keys ON: the same answers byte for byte (`evidence/w0-replay-on.jsonl`).

**Slow suites with both keys ON** (env):
- `fidelityL40Bk2.slow` (the pocket chain re-solved, its hold on `button@816,400` now with a tail): **1/1**, the recorded tape
  input for input;
- `fidelityL32ArenaPrefix.slow`: **5/5**.

**Please run, on `claude/l40-latch-hold-f1kcmi`** (the head after this report):
1. **Survey full:** `seedling-survey.yml` with `through=end route=full`. Arm A: `contact_fidelity=` the 85 keys of
   `evidence/arm-A.txt`; arm B: the 87 of `evidence/arm-B.txt`. Compare against `40250392329` by (level, goal, boot).
   Expected: 0 rows move.
2. **Keyed sweep ×2:** `seedling-divergence-sweep.yml` with:
   - `keys=` the 52 keys of `evidence/l40-leg-keys.txt` (`|`-separated);
   - `capture_requests=true`;
   - arms A/B as above;
   - `seam_census=-3..3` for 859/860 and 368/371.

   Expected: 0 verdicts by key.
3. **Probes:** `seedling-probe.yml battery=standard` with arm B. Then `probe-seedling-l40latch.mjs --from-fixture` and
   `probe-seedling-l40bk2.mjs --from-fixture` (0 px expected).

## What the JS arc must wire / pins that move

- **No contract change.** `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging` are untouched, and
  there is no new `SolverRefusal.obstacle.kind`.
- **New OPTIONAL record:** a combat-ladder `kill` record with `arm: 'orbit'` (`{kind: 'orbit', from, ticks, candidate,
  forks}`) and its trace row (`strategy.arm: 'orbit'`), keys ON only.
- **New optional arguments** (absent = the bytes they were): `previewWalk`'s `standBombs`; a `stand` object's `hold` / `bombs`.
- **Run state:** none added, renamed or reshaped. No per-visit map, so no `DIGEST_EXEMPT` row is owed, and `stateDigestParts`
  is untouched. The skin renderer reads nothing new.
- **The walker:** `botDriverV2` is untouched (`runHold` included), so no `producer:walker` row can move.
- **Pins:** the flashPanel settings rows `seedlingContactHoldWaitPriced` and `seedlingContactChaserOrbitKill` (derived from
  `CONTACT_FIDELITY_KEYS`, +2 rows); `contactFidelity.test.js`'s defaults table gains the two OFF keys.

## Hand-overs

- **Hammer arc, the chooser (D2.1):** L40's x≈744 pair (`bob@736,752` + `bob@736,800`). No single removal admits a corridor,
  so `chooseBodyToRemove` returns nothing, and `CHOOSER_HIT_SOURCES` excludes chasers. It gates legs 859/860 at the burn stance
  (seam 5933) and the latch chain's walk back. A pair hypothesis, or the hit's chaser sources, would hand the chaser arm a
  target (the scratch: `evidence/d2-scratch-chaser-sources.txt`). Related to PKC (the press-kill walk beside the same
  corridor), but this is the walk, not the press kill.
- **Hammer arc, the static arm (D2.2):** `iceturret@472,400` met as a static "Enemy" on the walk to `wandlock@448,432`'s hold
  stance. The rung's static arm (`STATIC_SWORD_ARM`) has no IceTurret death; TURRETCIRCLE's circling kill is reachable only
  from the weigh's `killForCorpse`.
- **Hammer-2 review at harvest:** the kill rung's new orbit arm sits in the chaser arm's no-stance branch, beside (not inside)
  the press-kill code.

## Deltas

- `contactFidelity.js` (+ test): the two keys (OFF) and their env lines.
- `solverBot.js`:
  - D1a: `holdStandWalk`, `standTailOpts`, `previewWalk`'s `standBombs`, the TIME rung's hold-tail refusal, the hold stance
    walk's tail;
  - D1b: `ORBIT_KILL`, `ORBIT_KILL_CANDIDATES`, `orbitKillPolicy`, `orbitKillChaser`, the chaser arm's orbit fallback.
- New files:
  - `fidelityL40Latch.js` (+ `.test.js`, `.slow.test.js`);
  - `probe-seedling-l40latch.mjs` (box-lock roster row in `boxLock.test.js`);
  - `fixtures/l40latch-witness/`: `latch-boot.json`, `l40latch-stand.json`, `l40latch-orbit-chain.json`.
- Censuses: surface **353 GREEN** (re-sealed: read sites only), constants 6,952 PASS, entities 566, profile 138, roster 289.
- Docs: the `seedling-bot.md` paragraph, the bot-log entry, the reference regenerated (the instruments row).

## What the brief got wrong (measured)

- **"Legs 859/860 refuse … 859 on the combat ladder, 860 every key set".** At this base and seams, 859 refuses at the burn
  stance's ladder in the x≈744 corridor (`bob@736,752`), or at seam 5933 with the BobSoldier covering the burn stance and the
  chooser silent. 860 refuses in the press kill. Neither reaches the latch, so neither moves with D1.
- **"`bobsoldier@880,832` lands its sword on a still player at t79 and kills it by t125; hold tick 84".** At this slice's
  staging (chest, tree and `spinner@880,848` banked) it is t93, t113, dead at t133, and hold tick 93. L40BK2's staging was not
  committed, so the ticks differ by staging, not by model.
- **"The hold needs that chaser handled first"** is right, and no still stance does it. The fix is a fight on the move.
- **The base's four producer `--check`s are exit 1** (trace drift from W31's `dashSpinnerForecast` flip), not exit 0.

## Residue

- The latch chain from the arrival waits on the two hammer hand-overs. A witness of the whole leg waits on them too.
- The orbit arm serves BobSoldiers only; a plain Bob keeps the still-stance arm.
- The orbit arm is asked only where the chooser names the BobSoldier. Where it stands with another body, the chooser stays
  silent and the arm is never asked: that is D2.1's gap.
- The candidates are a fixed table; no search over the policy's parameters.
- The hold tail costs work: L4's stairs solve spends +4 units per pass (the same plans).

## Byte-inertia (OFF)

- **The identity block at the code head `5bab5247`** (a worktree with its own server on 9745) **equals W0 on every md5 row and
  all six producer `--check` md5s and exits** (`evidence/identity-{w0,after}.txt`, a row diff). The four base exit-1 rows are
  the base's trace drift, the same bytes. The generated-set row was unmeasured both times: at W0 the Playwright pin, at AFTER
  the box held by the sweep.

- **tapeRunner pairs: 635, `88fc7df4dd05d11dfd84ebbea675cc8e`**, base and head (`evidence/tape-runner-pairs-{w0,after}.txt`). Roster 289. Censuses at head: surface 353 GREEN, constants 6,952 PASS, entities 566, profile 138.
- **Bounded vitest AFTER** (defaults, 131 files, in the code-head worktree `5bab5247`; `evidence/rows-after.txt`):
  **3,454 / 3,454**. Against BEFORE, the only differences are 12 added rows: `fidelityL40Latch` 10 and the two derived settings
  rows in `contactFidelityHook`. (The first AFTER run, at `9b637ce5`, was red on the solver-surface census and one
  `lintGateLabels` row: `63436e5c` re-seals the surface and derives the label.)
- **CI `JavaScript Unit Tests` at `5bab5247` (run 40394512433): success, 23,062 passed, 0 failed; slow battery 271/271** (269 + this slice's 2). At `994389e7` it was the same, 23,062 / 271. The commits after the code head change `CC/docs/` and `docs/` only.
- No committed tape, producer `--check` or identity row moves, ON or OFF. No rules, AS3, wasm or gitlink edit.

## Rows to BANK

- **W0:** 859/860 die before the latch at this base (the x≈744 corridor, the press kill); the latch staging; the still holder
  game-witnessed (t93/t113/t133 died), no model gap.
- **D1:** the hold's tail with TIME's named refusal and the bombs paced; the orbit kill behind the blade; the latch chain from
  the staging on p4g at 0 px over 271 ticks, never hit (BobSoldier t184, lock t101).
- **D2:** the x≈744 pair and the static ice turret, named and handed over.
- **Mutants:** m1–m5, every prediction met.
- **Trap candidates** (in the bot-log entry):
  - a rung that succeeds by spending nothing is a loop;
  - a still stance is the wrong question for a weapon that rests where the player was;
  - a staging past a hand-over must bank what that hand-over kills.
- **Commits:**

  | commit | content |
  |---|---|
  | `9b637ce5` | D1 code, witnesses, probe, fixtures, tests, box-lock row |
  | `7d5ceeda` | the reference regenerated |
  | `63436e5c` | the surface re-sealed; the candidate label derived |
  | `994389e7` | a latched hold under MOVING_WAIT prices its tail without the bombs (the bounded-ON finding) |
  | `5bab5247` | TIME refuses only a hit IN a hold's tail (the sweep finding) — the code head |
  | `d1a79756` | docs: the `seedling-bot.md` paragraph, the bot-log entry |
  | `40164ab2` | the reference regenerated after the docs |
  | evidence + this report | last |
