# Seedling HAMMER-PHASE — slice D: the ghost sword in L39 / L40 / L92's spinner rooms

Slice `seedling-hammer-d` (Opus, cloud), planner `seedling-hammer-phase-planning`. ⚖ The user (2026-10-11): *"Please
run them in the order you would recommend."* This slice measures first; a fix was optional. One switch, **OFF**, and OFF
is byte-inert: `ghostSpinnerPress.GHOST_SEARCH_BUCKETS` (`SEEDLING_GHOST_SEARCH_BUCKETS=1`,
`withGhostSearchBuckets(enabled, fn)`).

| | |
|---|---|
| Start SHA | **`5b92583a7f`** (= `origin/main` at the fetch = P1's merge; `pressKillCost.js` present) |
| Head | the commit carrying this report. W0 `eb8df5f`, D2 `76d19d8`, D3 `5ea44c7`, D1 `822c4f5`, D4 `83592fe`, D5 `07b744c`, then this report |
| Branch | `claude/seedling-hammer-d-8bqpqd` (the harness names it; the brief's `seedling-hammer-d`). Nothing went to `main` |
| Dev server | `serve-nocache.py 9577` (`SEEDLING_PORT=9577`), PID 904, killed by PID at the end |
| Verdicts | **W0 PASS · D1 PASS with a hand-over and a STOP** (two verdicts change; the cause is a gate outside this region; the game refutes that room's plans, the sword's too) **· D2 PASS** (the game waives the line) **· D3 PASS** (built, OFF; measured worse ON) **· D4 PASS** (no committed mover) **· D5 PASS** |

## The one thing to know first

**The ghost sword never reaches the spinner press in L40: the combat ladder's KILL rung refuses it before
`derivePressKill` is asked.**
- **The gate.** The rung (`solverBot.js` ~19161, the lock-less spinner arm) still gates on `primaryWeapon === 'sword'`.
  C2 admitted the ghost only inside `derivePressKill` (the kill-lock order).
- **What it costs.** Legs 378 and 381 go from SOLVED (sword) to REFUSED (ghost). 397, 414 and C1's staging A refuse at
  that gate in 1–3 s.
- **What opening it would do.** A scratch mutant that admits the ghost there (never committed) solves 378 with the ghost
  in 1641 t, and reaches staging A's kill 986 ticks sooner than the sword.
- **Who owns it.** The gate is outside this slice's region, so it is handed over.

**Separately, the game refutes both the ghost plan and the base SWORD plan of L40's r0c53 room at (280,216):** an
unmodelled −3.40 px shove, fidelity's.

**D2 is clean:** the game takes a ghost hit through a wall, at the model's tick.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-hammer-d-8bqpqd origin/main` | `5b92583a7f`; `pressKillCost.js` present |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0. Five submodules were `-` after `READY` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, textAdventureEngine): `git submodule update --init` each |
| identity block | `SEEDLING_PORT=9577 bash scripts/procgen/identity-block.sh .` (venv) | non-`#` md5 **`3a48647f548c821267c3e60cf0ddc496`** = P1's W0, row for row (`identity-w0.txt`) |
| six `--check`s | the block's loop | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `712f0ead`, all exit 0; reference ALL 7 + 5 MATCH |
| tapeRunner pairs | inside the bounded run, `status\tfullName` sorted | **611**, `75a3c41f0c91f6e71953e82d8259dc60` (= P1) |
| surface / constants / entities / profile | each `--check` | GREEN **274** · PASS **5,710** · PASS **535** · PASS **138** (`censuses-w0.txt`) |
| roster | `fixtures/tapes/index.json` | **277** |
| bounded vitest BEFORE | 15 files: every test naming `ghostSpinnerPress`, `GHOST_SPINNER_PRESS`, `deriveApproach`, `deriveFight`, `HAMMER_APPROACH`, `deriveStrike` or `execKillByPress` (`rg -a`), plus `solverBot*`, `hammer*`, `solverSpinnerKill*`, `pressKillCost`, `solveProgress`, `tapeRunner` | **985 / 985** (in a clean worktree at the base code). `hammerEscapeGenerated.slow` is the slow tier's and was not run |

## D1 — the three rooms (PASS, with a hand-over and a STOP)

**The method.**
- `seedling-divergence-legs.mjs` lists 843 legs. All 45 in L39 / L40 / L92 were solved with `d1-leg.mjs`: C1/P1's node
  arrival path, on the page's delivered set (`--dump` from `probe-seedling-divergence-sweep.mjs`).
- Each leg was solved twice: with the sweep rows' items (torch, fire, shield, sword; L92 r4c2 also swims), and again
  with the ghost sword added.
- The ghost is granted as the flag `Main.hasGhostSword`, with the sword kept. `levelRun.weaponForPress` then fires
  `ghostsword` from the sword slot (C2's staging), and every ghost staging confirmed `primary` = `ghostsword`.
- Cap 15 min, 3 in parallel on 4 cores. P1's leg ids (378/381/384/396/400) are unchanged.

**No AP route leg holds the ghost sword in these rooms, and only L40's legs ever meet a spinner.** L39's three legs are
the top pocket (`r0c9`, cut off from the spinners) and the shaft's own exit. L92's two are 4–11 t walks.

| leg | goal | sword | ghost | decided by | s (sword / ghost) |
|---|---|---|---|---|---|
| 373 | L39__r0c9 ← L40_480_912 → out_teleporter_144_0 | SOLVED 5 | SOLVED 5 | nothing | 0.2 / 0.2 |
| 374 | L39__r0c9 ← L40_480_912 → Level 039 - Totem Part 72,40 | SOLVED 75 | SOLVED 76 | walk length (full: the ghost's own dash clock) | 0.5 / 0.5 |
| 375 | L39__r2c11 ← L38_144_0 → out_teleporter_144_624 | SOLVED 4 | SOLVED 4 | nothing | 0.1 / 0.2 |
| 376 | L40__r0c53 ← L41_0_160 → out_teleporter_848_0 | SOLVED 70 | SOLVED 105 | walk length (full: the ghost's own dash clock) | 1.6 / 1.5 |
| 377 | L40__r0c53 ← L41_0_160 → out_teleporter_944_96 | SOLVED 5 | SOLVED 5 | nothing | 0.3 / 0.3 |
| 378 | L40__r0c53 ← L41_0_160 → Level 040 - Totem Part 64,144 | SOLVED 1540 | REFUSED (danger: spinner@192,144) | **the kill rung's `primaryWeapon === 'sword'` gate**: the ghost's (dash-timed) walk meets `spinner@192,144`, the sword's never does (its kill is a chaser's) | 222.1 / 218.3 |
| 379 | L40__r0c53 ← L42_240_336 → out_teleporter_848_0 | SOLVED 5 | SOLVED 5 | nothing | 0.3 / 0.2 |
| 380 | L40__r0c53 ← L42_240_336 → out_teleporter_944_96 | SOLVED 70 | SOLVED 105 | walk length (full: the ghost's own dash clock) | 1.2 / 1.6 |
| 381 | L40__r0c53 ← L42_240_336 → Level 040 - Totem Part 64,144 | SOLVED 1592, 3 spinner landings | REFUSED (danger: spinner@192,128) | **the kill rung's `primaryWeapon === 'sword'` gate** (the sword press-kills the spinner, 3 landings) | 249.4 / 252.6 |
| 382 | L40__r23c29 ← L39_144_0 → out_stairsdown_320_576 | SOLVED 172 | SOLVED 289 | walk length (full: the ghost's own dash clock) | 2.7 / 3.5 |
| 383 | L40__r23c29 ← L39_144_0 → out_teleporter_480_912 | SOLVED 4 | SOLVED 4 | nothing | 0.3 / 0.3 |
| 384 | L40__r23c29 ← L39_144_0 → out_pit_4_20 | SOLVED 859 | SOLVED 859 | nothing | 154.3 / 156.5 |
| 385 | L40__r23c29 ← L39_144_0 → out_pit_5_20 | SOLVED 913 | SOLVED 910 | walk length (dashless) | 142.5 / 155.3 |
| 386 | L40__r23c29 ← L39_144_0 → out_pit_13_20 | SOLVED 1025 | SOLVED 1023 | walk length (dashless) | 208.5 / 239.5 |
| 387 | L40__r23c29 ← L39_144_0 → out_pit_14_20 | SOLVED 1087 | SOLVED 1083 | walk length (dashless) | 250.8 / 233.1 |
| 388 | L40__r23c29 ← L39_144_0 → out_pit_4_21 | SOLVED 844 | SOLVED 843 | walk length (dashless) | 112.6 / 126.6 |
| 389 | L40__r23c29 ← L39_144_0 → out_pit_5_21 | REFUSED (danger: bob@192,480) | REFUSED (danger: bob@192,480) | the same ladder (EXHAUSTED on a chaser) | 49.6 / 56.1 |
| 390 | L40__r23c29 ← L39_144_0 → out_pit_13_21 | REFUSED (danger: bob@192,480) | REFUSED (danger: bob@192,480) | the same ladder | 75.7 / 74.2 |
| 391 | L40__r23c29 ← L39_144_0 → out_pit_14_21 | REFUSED (danger: bob@192,480) | REFUSED (danger: bob@192,480) | the same ladder | 80.9 / 79.6 |
| 392 | L40__r23c29 ← L39_144_0 → out_pit_4_22 | SOLVED 834 | SOLVED 840 | walk length (dashless) | 196.2 / 164.4 |
| 393 | L40__r23c29 ← L39_144_0 → out_pit_5_22 | REFUSED (danger: bob@192,480) | REFUSED (danger: bob@192,480) | the same ladder | 47.7 / 71.9 |
| 394 | L40__r23c29 ← L39_144_0 → out_pit_4_23 | SOLVED 804 | SOLVED 804 | nothing | 166.9 / 146.5 |
| 395 | L40__r23c29 ← L39_144_0 → out_pit_5_23 | REFUSED (danger: bob@192,480) | REFUSED (danger: bob@192,480) | the same ladder | 60.8 / 54.5 |
| 396 | L40__r23c29 ← L39_144_0 → Level 040 - Totem Part 160,640 | SOLVED 494 | SOLVED 494 | nothing | 86.7 / 90.6 |
| 397 | L40__r23c29 ← L39_144_0 → Level 040 - Chest | REFUSED (danger: bob@736,752) | REFUSED (danger: spinner@880,848) | **the same gate**, at the spinner (the sword passes it and refuses on a chaser) | 761.8 / 3.3 |
| 398 | L40__r23c29 ← L39_144_0 → L40 flag 8: bosslock@480,352 cleared | THREW (driver: event goal) | THREW (driver: event goal) | the driver cannot map an event-flag goal (the sweep stages it as a clear-tag goal) | 0.0 / 0.0 |
| 399 | L40__r23c29 ← L43_176_464 → out_stairsdown_320_576 | SOLVED 5 | SOLVED 5 | nothing | 0.6 / 0.6 |
| 400 | L40__r23c29 ← L43_176_464 → out_teleporter_480_912 | SOLVED 270 | SOLVED 355 | walk length (full: the ghost's own dash clock) | 34.4 / 29.6 |
| 401 | L40__r23c29 ← L43_176_464 → out_pit_4_20 | SOLVED 392 | SOLVED 462 | walk length (full) | 6.8 / 7.5 |
| 402 | L40__r23c29 ← L43_176_464 → out_pit_5_20 | SOLVED 427 | SOLVED 513 | walk length (full) | 10.2 / 16.4 |
| 403 | L40__r23c29 ← L43_176_464 → out_pit_13_20 | SOLVED 455 | SOLVED 594 | walk length (full) | 15.7 / 18.5 |
| 404 | L40__r23c29 ← L43_176_464 → out_pit_14_20 | SOLVED 640 | SOLVED 692 | walk length (full) | 22.3 / 20.8 |
| 405 | L40__r23c29 ← L43_176_464 → out_pit_4_21 | SOLVED 390 | SOLVED 487 | walk length (full) | 4.9 / 9.5 |
| 406 | L40__r23c29 ← L43_176_464 → out_pit_5_21 | SOLVED 512 | SOLVED 535 | walk length (full) | 9.0 / 10.0 |
| 407 | L40__r23c29 ← L43_176_464 → out_pit_13_21 | SOLVED 631 | SOLVED 601 | walk length (full) | 13.0 / 13.4 |
| 408 | L40__r23c29 ← L43_176_464 → out_pit_14_21 | SOLVED 562 | SOLVED 685 | walk length (full) | 14.7 / 34.4 |
| 409 | L40__r23c29 ← L43_176_464 → out_pit_4_22 | SOLVED 347 | SOLVED 457 | walk length (full) | 5.4 / 8.6 |
| 410 | L40__r23c29 ← L43_176_464 → out_pit_5_22 | SOLVED 526 (1 hit) | SOLVED 511 | walk length (full) | 9.1 / 14.8 |
| 411 | L40__r23c29 ← L43_176_464 → out_pit_4_23 | SOLVED 332 | SOLVED 415 | walk length (full) | 5.4 / 4.6 |
| 412 | L40__r23c29 ← L43_176_464 → out_pit_5_23 | SOLVED 375 | SOLVED 495 | walk length (full) | 7.1 / 9.1 |
| 413 | L40__r23c29 ← L43_176_464 → Level 040 - Totem Part 160,640 | SOLVED 118 | SOLVED 181 | walk length (full) | 2.0 / 3.5 |
| 414 | L40__r23c29 ← L43_176_464 → Level 040 - Chest | REFUSED (danger: bob@736,752) | REFUSED (danger: spinner@880,848) | **the same gate**, at the spinner (the sword passes it and refuses on a chaser) | 58.3 / 1.4 |
| 415 | L40__r23c29 ← L43_176_464 → L40 flag 8: bosslock@480,352 cleared | THREW (driver: event goal) | THREW (driver: event goal) | the driver cannot map an event-flag goal | 0.0 / 0.0 |
| 717 | L92__r4c2 ← L91_240_48 → out_teleporter_32_144 | SOLVED 4 | SOLVED 4 | nothing | 0.1 / 0.1 |
| 718 | L92__r7c17 ← L87_16_32 → out_teleporter_272_144 | SOLVED 11 | SOLVED 11 | nothing | 0.2 / 0.2 |

Notes on the table (sources: `d1-table.md`, `d1.jsonl`):
- "full" means a solve with the dash. The ghost's dash has its own clock (GHOSTMOTION), so dash walks change length
  with no spinner involved; dashless walks move by 1–6 t.
- 410's sword plan takes 1 hit and the ghost's none; both SOLVE.
- The driver kept only 1,200 chars of each refusal. The gate text on 378 / 397 / 414 was read from the full messages
  (`d1-378-ghost-full.json`, and the kill-rung lines of 397 / 414). 381's was confirmed by the mutant below.

**Changed verdicts: 378 and 381 only.** The cause is not reach 24, not the waived line, not the release. It is the
weapon gate on the ladder's kill rung, reached before any press is planned:

> *kill: spinner@192,144 is a live Spinner whose removal the run OBSERVES (…), but the run's `primary` slot fires
> `ghostsword` — the kill this rung derives is a SWORD press (`KILL_ARM_POLICY.Spinner`). The sword is a SUB-ORDER
> the macro layer owes.* (378's full message)

On 378, the sword's walk never meets the spinner (its kill is a chaser's). The ghost's dash-timed walk does, and hits
the gate. On 397, 414 and C1's staging A the verdict stays REFUSED, but the ghost now refuses at this gate in
0.7–3.3 s, while the sword gets past the spinner and refuses later on a chaser (58–762 s).

**What the gate hides: a scratch mutant, in a separate worktree, never committed** (`d1-rung-mutant.diff`). The rung
admits the ghost exactly where `derivePressKill` does (`spinnerStrikePress(weapon) !== SWORD_SPINNER_PRESS`):

| workload | sword (base) | ghost (base) | ghost (mutant) |
|---|---|---|---|
| leg 378 | SOLVED 1540 t | REFUSED (gate) | **SOLVED 1636 t**, 0 hits; ghost landings t1187 (hits 2) · t1239 (4, kill) on `spinner@192,144`, from ~21 px |
| leg 381 | SOLVED 1592 t | REFUSED (gate) | REFUSED on a different wall: `chaserForecast`'s camera-shake band (`bob@272,112`) |
| leg 414 | REFUSED (`chaser:bob@736,752`) | REFUSED (gate, 1.4 s) | REFUSED (`chaser:bob@736,800`): the sword's class of wall |
| staging A (P1's fixture, `--stop-tick=1`) | REFUSED at 3,113 t (chaser `bob@736,752`), keys `af47d35d` = P1 | REFUSED at t0, 0.7 s (gate) | REFUSED at 2,195 t (the same chaser) |

The mutant is inert for the sword: on 378's tape staging the sword solves in 1543 t on both trees.

**P1's residue: does the ghost's reach change staging A?** Yes, once it is past the gate.
- **The sword's kill does land at base.** Six sword landings (t511, 1770, 1985, 2960, 3062, 3100) from 10.7–12.6 px,
  and `spinner@880,848` dies at t3100. The refusal at 3113 is the chaser's (`d1-A-sword.json`).
- **The ghost (mutant) kills it at t2114, 986 ticks sooner,** landing from 19.5–23.8 px. It also kills
  `spinner@816,848` at t2182, then refuses on the same chaser at 2195 (`d1-A-ghost-mutant.json`).
- Both spend about 1,500 ticks between the first landing and the second (refuge waits). That is the sword's own "why",
  and it was not chased here.

**The game witness for the changed verdict: STOP (fidelity's).**
- **The staging.** 378's room was re-solved on C1's TAPE staging (`crusherStaging` at 378's arrival (928,96), the same
  items, keys 0–3; `mut-solve.mjs`). It reproduces D1 exactly. Base: sword SOLVED 1543 t, ghost REFUSED at the gate.
  Mutant: ghost SOLVED 1641 t, two ghost landings from 20.8 / 21.0 px, the kill at t1239.
- **The mutant's ghost plan parts on the game at t1121** (p4f, `probe-seedling-dash-window.mjs --tape-file`). The game
  shoves the standing player at (279.98, 216.20) by −3.40, −3.15, −2.90 … px/tick in x, with no damage. The model
  stands (`d1-378-mutant-game.txt`).
- **The base SWORD plan for the same room parts at t1154, at the same spot, by the same −3.40 px**
  (`d1-378-sword-control-game.txt`).
- **So the disagreement is neither the ghost's nor the press's.** Nothing the model steps is within 48 px of the player
  there: no spinner, no chaser.
- **The bodies part only afterwards.** The game's spinner takes hits at t1193 where the model's body has moved on; that
  is a consequence of the shove.
- Tapes: `d1-378-mutant-ghost.tape.json`, `d1-378-base-sword.tape.json`.

## D2 — the walled line (PASS: the game waives it)

**`hammer-d-l39-ghostwall`** (590 t; `scripts/procgen/plan-seedling-hammer-d-ghostwall.mjs`, author + `--check`;
`fixtures/hammer-d-ghostwall-witness/`, kept beside its samples, not the roster).
- **The staging.** L39 from leg 375's arrival (144,608, `in_L38_144_0`), with its wandlock flag `{39,8}` declared. It
  uses C1's witness staging (`crusherStaging`: `r8-solve-11`'s staging re-booted) with the sword and the ghost sword.
- **The walk.**
  1. Hold `up` up the shaft and cut `rope@96,384` with a ghost press. The rope blocks the shaft until then; the game
     clears tags 9 and 10.
  2. Climb to the shaft's mouth.
  3. Walk (the solver's own `previewWalk`) to the pocket at (168,184), beside the dark Blue Wall block (x 176–207,
     y 160–191).
  4. Stand, aim right, press at t573, then stand 16 ticks.
- **The stance was found, not guessed** (`d2-search.mjs`). The search crosses `walkableCells` with the spinner forecast
  for (cell, press tick) pairs whose FIRST in-reach ghost test has a walled line. It verifies each on the model run and
  requires 0 player hits.
- **Two earlier attempts failed.** Leg 374's arrival is the top pocket, cut off from the spinners. Booting inside the
  spinner region at `r5-press-*`'s (232,88) is hit at once (`spinner@224,112` starts 32 px below).

**The model** (the plan's `--check`, all green):
- one landing on `spinner@224,112`, at t574: a ghost press, its first landed test, 2 damage, from **21.212 px**;
- the test's own point is found exactly. Of the four (player, body) pairings around the landing tick, only "player
  before, body after its own update" reproduces the recorded reach. Its line (169.10, 184.29) → (192.40, 197.07)
  crosses **`tile:Blue Wall (dark)` at (176, 187.96)**, and so do the other three pairings' lines;
- no player hit.

**The game** (p4f, headless logic-only):

| question | the game | |
|---|---|---|
| the player's stream (`probe-seedling-dash-window.mjs --tape-file`) | **= the model's, 591 / 591 observations** (exact) | ✓ |
| the walled hit (`probe-seedling-u9-shield-mobiles.mjs --tape-file --class=Spinner`) | `spinner@224,112`: `hits` 0 → **2**, `hits_timer` **30** at observation 575 (the one after the landing), then the knockback | ✓ the line is waived |
| every Spinner row (3 bodies × every sampled tick) | position, `hits`, `hits_timer` = the model's: **1,764 comparisons, worst \|Δ\| 2.8e-14** | ✓ |
| the spinner press's tests | `Bot.slashTests` 7 → 14 over t575–581, one a tick = the model | ✓ |
| the rope press's tests | the game counts **1 at t184, then 7 at t185**; the model counts one a tick, to 7 at t190 (5 ticks off) | ⚠ fidelity's (the ghost swing's rope arm); the player is unaffected |
| the probe's clock calibration | misses **one** sample, t184 (the rope-cut tick): the poll read the player at its t183 point, while the exact drained stream agrees at t184 | sampling, not the model |

**The gate is `hammerGhostWall.test.js`** (6 rows):
- the landing;
- the walled line at the test's own pairing;
- the game's samples (`hammer-d-l39-ghostwall.game-bodies.json`, compacted) equal to the model at every tick;
- both forecasts ON equal the run and land at t574;
- OFF lands nothing.

**M3 is no longer blind** (`d2-mutants.txt`; copy → edit → measure → restore, in a worktree):

| mutant | predicted | measured |
|---|---|---|
| M3f: the forecast asks the line for a ghost test | the two forecast rows red; C2's file green (blind, as C2 measured) | **2 red** (both diverge from t574); C2's file green |
| M3r: the run asks the line for a ghost hit | the walk throws | **throws**: *"… reaches spinner@224,112's rect but `collideLine("Solid", …)` finds tile:Blue Wall (dark) at (176, 187.957) …"* |
| M3s: the strike asks the line for the ghost | blind | **blind** (17/17): nothing measured ever derives a ghost strike at a walled stance; the D1 ghost legs stop at the rung first |

`probe-seedling-u9-shield-mobiles.mjs` gained `--tape-file` (for an out-of-roster witness). It also now names its
calibration misses: the count, the ticks, and the first miss's two readings.

## D3 — `deriveApproach` / `deriveFight` with the ghost's numbers (PASS; built, OFF)

**D1 alone cannot show it.** No D1 leg reaches a ghost press kill, because the rung gate stops it first. So D3 was asked
on the one ghost press-kill workload there is, C2's L18 staging (`r9-solve-18`'s base + `hasGhostSword`). It does
matter there.

**Where the sword's numbers sat** (`solverBot.js` at the base):
- `deriveFight` pre-filters every press successor with `n + i − lastPress > SLASH_HIT_TICKS && hitsTimer === 0 &&
  distanceRectPoint(…) <= SLASH_REACH`, **before** it asks `pressReadyAt`. So a ghost primary is never offered a press
  from 16–24 px, the ghost's own band;
- its key buckets the window at `SLASH_HIT_TICKS`, its lower bound subtracts `SLASH_REACH`, and its cursor's `ensure`
  margin is `SLASH_HIT_TICKS + 4`;
- `deriveApproach` sizes `need`, its probe and its goal's row margin by `SLASH_HIT_TICKS`. Its goal predicate is
  `pressReadyAt` alone.

**Measured before building** (first a widened scratch mutant, then the switch): C2's staging, `twoPassSolve`, residue 40.

| | sword | ghost |
|---|---|---|
| default (no search) | 518 t | 336 t |
| `HAMMER_FIGHT`, buckets OFF | 342 t | **324 t**; landings from 14.6 / 12.3 / 14.1 px (the prefilter), the last 23.8 |
| `HAMMER_FIGHT`, buckets ON | 342 t (equal) | **321 t**; landings from **20.9 / 20.0** / 13.8 / 23.6 px |
| `HAMMER_APPROACH`, OFF / ON | 362 / 362 t | 325 / 325 t |

**The change** (`5ea44c7`):
- `ghostSpinnerPress.js` gains `GHOST_SEARCH_BUCKETS` (OFF; env opt-in), `withGhostSearchBuckets` and
  `searchPressFor(press)`. ON it returns the press's own row; OFF it returns the sword's row, whatever it is handed.
- `solverBot.js`: `deriveApproach` and `deriveFight` read `searchRow = searchPressFor(strikePressOf(run))` at the eight
  sites above.
- **OFF is byte-inert by construction.** `SWORD_SPINNER_PRESS.reach` and `.hitTicks` are `SLASH_REACH` and
  `SLASH_HIT_TICKS` themselves. ON, a sword run reads the sword's row too.

**The gate is `hammerGhostSearch.test.js`** (5 rows, explicit 120 s timeouts):
- the switch and the row table;
- the sword's fight certificate is the same ON and OFF;
- the ghost fight at t0. OFF, it meets **22** in-reach press nodes, certifies at index **173**, and both of its first two
  landings are from ≤ 16 px. ON, it meets **653**, certifies at **166**, and its first two landings are from 16–24 px;
- the ghost approach is the same ON and OFF.

| mutant | predicted | measured |
|---|---|---|
| D3-M1: the prefilter's reach pinned to `SLASH_REACH` under the switch | the ghost ON row red | 1 red (that row) |
| D3-M2: `searchPressFor` ignores the switch | the table row and the ghost OFF row red | 2 red (those) |

**⚠ But ON is not better.** The 45-residue ghost sweep with `HAMMER_FIGHT` (C2's `ghost-sweep.mjs`;
`d3-ghost-sweep-fight-{off,on}.txt`):
- OFF: **45/45 at 324 t**.
- ON: **45/45 still solve**. Six are shorter (321 t, r37–r42) and one is 362. **The other 38 are longer** (365 ×27,
  366 ×1, 351 ×10), so 39 of 45 are longer in all. Mean **324.0 → 356.0 t**.

The likely reason: offering the 16–24 px band to a weighted-A* search whose key does not separate that band makes it
commit to earlier presses that cost more later. The switch ships OFF, and the measurement argues against the flip.

## D4 — the switch ON vs OFF (PASS: no committed mover)

| row | OFF | ON | moves? |
|---|---|---|---|
| identity block | W0 `3a48647f` | every row = W0; the six producers exit 0 at W0's md5s (r9-campaign `712f0ead`, every r9 segment, `r9-solve-16` included); ENEMY `afdc6d1a` (`identity-on.txt`) | no. The reference row read DIFFER only because this branch's generated docs were not yet regenerated; done in D5, as C2 did |
| r9-campaign `--check` | `712f0ead` exit 0 | `712f0ead` exit 0 | no |
| ENEMY census | `afdc6d1a` | `afdc6d1a` | no |
| L18 sweep (sword, 45 residues, default) | 45/45, lengths `1c019765` | 45/45, every row equal (timing stripped) | no |
| L18 sweep `--fight` (sword) | 45/45 | every row equal | no |
| D1's kill leg 381 (sword) | SOLVED 1592, keys `89198518` | the same keys | no |
| L18 ghost staging, default | 336 t | 336 t | no |
| bounded vitest (W0's 15 + `hammerGhostWall` + `hammerGhostSearch`) | 996 / 996 | **996 / 996**, tapeRunner 611 `75a3c41f` | no |

**The only mover is D3's own workload:** the ghost with `HAMMER_FIGHT` ON, 324 → 321–366 t. With every other hammer
switch at its default, nothing calls either search:
- `deriveApproach` is reached only under `HAMMER_APPROACH`;
- `deriveFight` is reached only under `HAMMER_FIGHT`, or through the fight fallback's `withHammerFight(true)`;
- all three are OFF.

**Nothing was re-recorded. The flip is the user's call.**

## D5 — records (PASS)

- **Logs:** `seedling-bot-log.md` § *Seedling hammer-phase D — the ghost sword in L39 / L40 / L92*; `seedling-bot.md`
  gains a paragraph after P1's.
- **Surface:** `--write`, then `searchPressFor` classified. The unused `GHOST_SEARCH_BUCKETS` import and its door export
  were retired (the census refuses a door export no file imports). `--check` **GREEN 275**.
- **Constants:** `--check` **PASS 5,710**. No literal was added or moved, so no `--profile-rows` was needed. Entities 535
  and profile 138 PASS.
- **Reference:** regenerated (`generate-procgen-reference.mjs`, then `--check`: ALL 7 + 5 MATCH; the instruments and docs
  index rows). `generate-docs-index.mjs` was already current (164 docs).
- **Roster:** no roster tape (the witness sits beside its samples). Roster **277**; no roster-count pin and no
  `rosterCategories` row moves.
- **Bounded vitest AFTER** (switch OFF): **26 files, 1270 / 1270**, tapeRunner 611 `75a3c41f`. The files: W0's 15,
  plus `hammerGhostWall`, `hammerGhostSearch`, `boxLock`, `seedlingConstantsCensus`, `procgenDocs/generated`,
  `procgenDocs/docLinks`, `procgenDocs/docsRender`, `quickLaunch/generated`, `entityBlocks`, `seedlingSolverSurface`
  and `checkProcgenHelp`.
- **Identity block AFTER** (OFF, at `07b744c`): **byte-identical to W0**, every row, the six producers and the reference (ALL 7 + 5 MATCH) included: non-`#` md5 `3a48647f548c821267c3e60cf0ddc496` (`identity-after-off.txt`; re-run after the incident in Residue 10).

## Deltas (base → head)

- **New:**
  - `scripts/procgen/plan-seedling-hammer-d-ghostwall.mjs`;
  - `fixtures/hammer-d-ghostwall-witness/` (the tape and the game's compacted Spinner samples);
  - `hammerGhostWall.test.js` (6 rows) and `hammerGhostSearch.test.js` (5 rows);
  - `CC/docs/cloud-reports/seedling-hammer-d-evidence/` (the drivers, the D1 rows, the game probes, the mutants, the
    identity logs).
- **Changed:**
  - `ghostSpinnerPress.js`: the D3 switch, row and wrapper;
  - `solverBot.js`: the two searches' eight sites and one import;
  - `solverView.js`: one door line;
  - `probe-seedling-u9-shield-mobiles.mjs`: `--tape-file` and the miss report;
  - the surface table, the bot log, `seedling-bot.md`, the generated reference.
- **Untouched:**
  - every identity row, producer and committed tape;
  - `pressKillCost.js`, `levelRun.js`, `ghostSword.js`, `levelWorld.js`;
  - no AS3, wasm, gitlink or rules edit;
  - the kill-rung gate (outside the region): it was measured on a worktree mutant only.

## What the brief got wrong (measured)

1. **"Stage each with `sword` + `ghostsword` (the ghost as the primary)" does not reach the press kill in these rooms.**
   The ladder's kill rung refuses a `ghostsword` primary by name before `derivePressKill`. C2 widened only the kill-lock
   order, so "the ghost's row" is unreachable from the lock-less rung.
2. **"P1's residue: on staging A the SWORD's kill never lands"** is wrong: it lands. There are six landings, and
   `spinner@880,848` dies at t3100. The 3,113 ticks end on the chaser `bob@736,752`, after the kill.
3. **"L39's shafts are candidates"** for the walled stance: they are not. The shaft (x 144–159) has 16 px walls with
   Solid beyond on both sides, and no spinner comes within 24 px of it. The walled stance is the pocket beside the dark
   Blue Wall block, in the spinner region, reached THROUGH the shaft (and its rope).
4. **"D3 only if D1 shows it matters":** D1 cannot show it, because the gate stops every ghost kill before a search
   runs. It was measured on C2's L18 ghost staging, where it does matter, and the sweep shows ON is worse.
5. **"L39 (3 spinners)":** its three legs never meet a spinner. The top pocket is a separate region, and 375 is the
   shaft's own exit. Only L40's legs do.
6. **"leg ids shift":** they are P1's; nothing shifted since P1.

## Residue

1. **⛔ For the hammer arc (the next slice; outside this region): the kill rung's weapon gate.**
   - Where: `solverBot.js` ~19161–19196, `weapon === 'sword' ? derivePressKill(…) : null`, and
     `if (weapon !== 'sword') killWhy = …`.
   - The fix measured: admit the ghost there the way `derivePressKill` does (`d1-rung-mutant.diff`, 3 lines). It is
     inert for the sword (378's room: 1543 t both ways).
   - For the ghost: 378 SOLVED 1641 t; 381, 414 and staging A move on to chaser walls; staging A's kill comes 986 t
     sooner.
   - It is a behaviour change under `GHOST_SPINNER_PRESS`'s meaning, so it needs its own switch, or the user's word on
     C2's.
2. **⛔ For fidelity: an unmodelled shove in L40 r0c53 at (280,216).**
   - The game pushes a standing player −3.40 px/tick (then −3.15, −2.90 …), with no damage. The model stands.
   - Seen at t1154 of the base SWORD plan for 378's room (1543 t) and at t1121 of the ghost's.
   - Both tapes and the game's runs are in the evidence.
   - This puts in question every committed L40 r0c53 plan that stands there, 378's and 381's sword solves included.
3. **For fidelity: the ghost swing's rope arm counts tests differently.** On the game, `Bot.slashTests` reads 1 then 7
   at t184 / t185 (the rope cut); the model counts one a tick. The player stream is exact; only the count differs.
   Evidence: `d2-game-slashtests.json`.
4. **M3s is blind:** the strike's waived line has no witness. A ghost strike derived at a walled stance needs the rung
   gate open first (residue 1).
5. **`GHOST_SEARCH_BUCKETS` ON is worse** on the one workload it moves (39 of 45 residues longer). If the search is
   revisited, its key should separate the 16–24 px band. The switch is OFF.
6. **The spinner removal fencepost** (game 11 samples, model 12) did not show here. No spinner kill was played to its
   removal on the game: D2 lands one hit, and D1's kill plan parts first.
7. **The driver cannot stage the two event-flag goals** (398 / 415, `L40 flag 8`); the sweep stages them as clear-tag
   goals. The 389–395 refusals are the ladder's, the same with either weapon.
8. **CI for the planner** (dispatch returns 403 from the cloud):
   - `JavaScript Unit Tests` on `claude/seedling-hammer-d-8bqpqd` at the head
     (`node scripts/procgen/ci-vitest-summary.mjs <head> --wait`).
   - Optional, for the page: `seedling-divergence-sweep.yml` with `-f mode=inv -f producer=solver -f keys="<378's and
     381's keys>"`. No change is expected (the switch is OFF and the gate is untouched).
9. **Standing rows for fidelity to bank: none.** No roster tape was added, so `rosterCategories` does not move.
10. **⚠ Session incident (no lasting effect).** A shell heredoc that wrote this report's draft expanded its backticks as
    commands. One of them re-ran W0's `git checkout -B claude/seedling-hammer-d-8bqpqd origin/main`, which reset the
    local branch to the newer `origin/main` (`1ef20d8`, wave 13).
    - Nothing was pushed: the remote branch stayed at `07b744c`.
    - The local branch was restored to `07b744c`, and the tree and submodules were verified clean.
    - The identity block running at that moment was killed by PID, and its result discarded.
    - The AFTER block above was re-run from the restored tree.

## Rows to BANK

- `GHOST_SEARCH_BUCKETS` OFF; surface **275**; constants **5,710**; roster **277**; tapeRunner pairs **611**
  `75a3c41f`; identity block `3a48647f`.
- If the user flips `GHOST_SEARCH_BUCKETS`, nothing committed moves (D4), so nothing needs re-pinning. The measurement
  argues against flipping it.
