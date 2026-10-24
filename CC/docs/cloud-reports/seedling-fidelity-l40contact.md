# Seedling fidelity L40CONTACT — a live spinner walls a chaser (wave 17)

Slice `seedling-fidelity-l40contact` (Opus, cloud), planner `seedling-fidelity-planning-8`, wave 17 (model coverage).
⚖ The user (2026-10-03 / 2026-10-05): extend the model to cover everything in the game.

| | |
|---|---|
| Start SHA | **`e967758748`** (= main: wave 16 + the lapse flip + hammer DD/RE/SF) |
| Head | the commit carrying this report. Before it: D1 `ea80fef`, D3 `d4d055a`, D2 `b569313`, lint fix `17a680a4`, records `7701f8d5` |
| Branch | `claude/seedling-fidelity-l40contact-aorzm5` (the harness's; the brief's `seedling-fidelity-l40contact`). Nothing went to `main` |
| Dev servers | `serve-nocache.py 9682` (primary, PID 555) and `9683` (the base worktree: wrapper 3703, server 3704), all killed by PID at the end |
| Verdicts | **W0 PASS · D1 PASS** (switch `chaserSpinnerWalls`, OFF; the whole prefix game-exact ON) **· D2 PASS** (no switch: the model matches the game) **· D3 PASS** (it is D1; no separate fix) **· D4 STOP → hammer** (bisected: `926cc2a8`, `rebootShake`; the throw's catcher is `deriveStrike` / `previewWalk`) |

## The one thing to know first

**G1 and G3 are one gap, now closed behind `chaserSpinnerWalls`. G2 is not a gap, and G4 is the hammer arc's.** A live
Spinner is an "Enemy", and a Bob stops against it. With the switch ON, CW's staging A sword prefix (3,113 t) and both of
SF's floor-ON sword plans read on the game at the model's clock with worst |Δ| 0. CW's "second parting at t1989" was the
probe's join, not the model, and SF's t658 "approach-geometry hit" is the same missing wall seen 50 ticks downstream.
ON moves no committed tape, producer, identity row, tapeRunner pair or survey step. Of the 42 sweep legs the switch can
reach (L40, L92), only 414 changes, and only as one sample of an answer that varies with the seam clock in both modes.

## W0 — the base (PASS)

Measured at a pristine detached worktree of `e967758748` (submodules symlinked from the primary, its own server on 9683).

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0. Six submodules were `-` after `READY` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, swfRecompilerPanel/browser, textAdventureEngine); `git submodule update --init` each before the reference regeneration |
| identity block | `SEEDLING_PORT=9683 bash scripts/procgen/identity-block.sh .` (venv) | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, **ENEMY `36b59445`** (the lapse's), guard `a6d18d49`, AREA `02b22525`, killgate `006b0639` / `7d4cb820` / `49e23d85`, levels `e28c1e5d` / `fb1a59e5`, generated set OK. Value rows md5 `75e91109` (`evidence/w0/identity-w0.txt`). The reference row read 4 DIFFER at the worktree: the symlinked/uninitialised submodules' registry rows (the prior slices' artefact); the primary tree reads ALL 7 + 5 MATCH |
| six `--check`s | the block's loop | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · **r9-campaign `6b1bf15c`** (the lapse flip's re-record), all exit 0 |
| tapeRunner pairs | `status\tfullName` sorted, from the run's JSON (`tools/pairs.py`) | **611 `75a3c41f`** |
| surface / constants / entities / profile | each `--check` | GREEN **296** · PASS **5,882** · PASS **566** · PASS **138** |
| roster | `fixtures/tapes/index.json` | **277** |
| bounded vitest BEFORE | 71 files (`evidence/w0/vitest-files.txt`): the brief's standing list + every non-slow test naming `chaserStaticEnemyBoxes`, `chaserForecast(`, `stepChasersNow`, `ceremonyShove`, `CONTACT_FIDELITY_KEYS`, `formatContactFidelity`, the surface/constants censuses; `hammer*`, `solverSpinnerKill*`, `pressKillCost*`, `chasers`, `r4Swim`, `spinner`, `fidelityBobSoldier*`, `tapeRunner` | **2497 / 2497** |

## D1 — a live spinner walls a chaser (PASS; `chaserSpinnerWalls`, OFF)

**Measurement.** CW's staging A sword prefix (`handover-l40-A-sword-prefix.tape.json`, 3,113 t) on the game (p4f,
headless logic-only, `probe-seedling-u9-shield-mobiles --class=Bob`): the first parting is t1801, as CW reported. The
game stops `bob@736,752` dead at (743.929, 753.416), velocity still written, while `spinner@880,848` crosses it
southward; the model walks it on.

**Mechanism (AS3).**
- `Enemy.as:58` `type = "Enemy"`: a Spinner is one, alive, for its whole visit.
- `Bob.as:39` `solids.push("Enemy")`: Bob and Puncher sweep against it. BobSoldier does not (`enemyBoxStopsChaser`).
- `Game.as:2276` adds `bob` and `:2416` adds `spinner`; `World.addUpdate` prepends, so the spinner moves first each
  tick. A spinner's own `solids` do not hold "Enemy", so it passes through the bob.

**The change** (`levelRun.js`, inside my region's functions; `contactFidelity.js` gains one key at the end):
- `chaserSpinnerWallsNow()` (beside `chaserStaticEnemyBoxesNow`, which is unchanged): the live spinners as
  `{id, rect}` while the key is ON, `[]` OFF.
- `stepChasersNow`: `staticEnemyBoxes = [...chaserStaticEnemyBoxesNow(), ...chaserSpinnerWallsNow()]`, read once
  per tick after `advance` has stepped the spinners (the game's order).
- `chaserForecastNow`: ON, with live spinners, a copy of the spinners (`fspin`) is stepped once per forecast tick
  before the chasers, under `spinnerForecast`'s ctx split (this tick's ctx first, `beforeTypeFlip: false` after); its
  walls join the sweep. A press's hits on a spinner are not forecast.
- `SEEDLING_CHASER_SPINNER_WALLS=0|1`. ⚠ The bomb-blast check's use of `chaserStaticEnemyBoxesNow` is untouched (it
  already refuses spinners on their own rule).

**The second parting (t1989) is the probe's, not the model's.** CW's scratch wall moved the parting to t1989 (worst
8.8 px). I replayed the same model ON against CW's game rows with a label-free join (`tools/cmp.mjs`, one-to-one by
distance): **37,356 comparisons, worst 0**. The probe labels each game row with the nearest body of its OWN model
run. That run was OFF, so once the OFF model had parted, both game bobs were labelled `bob@736,752` from t1989 to
t1994. Re-read with the switch ON in the probe's own model (`evidence/d1/game-A-sword-*-on.txt`):

| probe (ON) | clock | comparisons | worst \|Δ\| |
|---|---|---|---|
| `--class=Bob` | `[0]`, 3,109 sampled ticks | 37,308 | **0** |
| `--class=Spinner` | `[0]`, 3,111 sampled ticks | 15,555 | **0** |

OFF the same probe FAILs (the clock fits no shift; Bob worst 32.0, Spinner 226.3). **So the whole prefix is the
game's ON.** CW's later chaser hits (2025 / 2057 / 2080) and its refusal tick 3113 are game-faithful ON; OFF they are
the model's.

**Gate `fidelityL40Contact.test.js`** (the D1 rows; fixture `fixtures/l40contact-spinnerwall-witness/`, CW's tape
byte-equal + the game rows `[t, x, y, vx, vy, hits]` of the two moving L40 bobs from t1700):
1. ships OFF (skipped under the env);
2. the witness is the game's (worst 0, the stop t1801–t1812 at one point);
3. OFF parts at t1801 at the game's (743.929…, 753.416…) against the model's (743.812…, 753.195…);
4. ON: every watched row from t1700 to the end equals the game to the bit;
5. ON: the chaser FORECAST from t1790 equals the drive for 40 ticks, both bobs, 0 px (the bob stands t1800–t1815).

**Mutants** (predicted first; copy → edit → gate → restore by md5 `995a43cb`; `evidence/mutants/`):

| mutant | predicted | measured |
|---|---|---|
| M1 the forecast's walls dropped | row 5 | row 5 red |
| M2 the live walls dropped | rows 4, 5 (and D3's ON row) | rows 4, 5 red; D3 ON red |
| M3 the forecast's spinners never stepped | row 5 | row 5 red |
| M4 the switch ignored (walls always) | row 3 | row 3 red |

**Census.** A first cut used `fspin.stepped === 0`, a new physics literal (RED); the ctx is now carried instead
(`fspin.ctx = fspin.ctxAfter ?? fspin.ctx`), so no literal. `census-seedling-constants --write` → **5,883** (one
structural literal moved lines); surface GREEN **296** (the new functions are module-private).

## D2 — the puncher's killed flag vs `strikeBodies` (PASS; no switch)

**Measurement** (leg 378, ghost sword: page staging and atlas boot alike; `tools/cw-solve.mjs --ptrace`,
`evidence/d2/`):

| tick | the press | the model's body | `strikeBodies` |
|---|---|---|---|
| t97 / t101 | ghost press pressed / fired, `killed: true` | hits 2 → 4 | — |
| t102–t132 | — | `dying`, i-frame 30 → 0 | member, `spent: true` (the lapse) |
| t133 | — | `destroy` (the "die" anim ends) | **out** |
| t134–t143 | — | fading, alpha 0.9 → 0 | out |
| t144 | — | removed | — |

**On the game** (the atlas boot's first 160 executed ticks, `probe-seedling-u9-shield-mobiles --class=Puncher`): clock
`[0]`, **305 comparisons, worst |Δ| 0**, and it exists exactly when the model's does. The game's anim is "die" from
t102 to t132 at hits 4 = `hitsMax` (`Puncher.as:44`: 10 frames at rate 10), "" from t133 (`endAnim`: `destroy`), and
the body is gone at t144.

**So: not a respawn, and the killed flag does not disagree with membership.** A killed body stays a member while the
game plays its "die": it is in the world, an "Enemy" that `Enemy.hit` refuses (`hits < hitsMax`), which is what
`spent` says. DD's reading ("killed at t104, still in `strikeBodies` at t133") is this window (DD's ANYTIME run
killed at t104; this solve kills at t101). DD's ledger-index window is the right guard; nothing to hand back. The run
does replay ticks under a bare `solveSegment` (the trace sees t72 twice: a rewind), which is the hammer arc's
replay hook and not a membership question.

**Gate:** one D2 row (fixture `l40contact-378-ghost-puncher.{tape,game}.json`): the kill press, then at every game row
`[hits, hitsTimer]` equal, "die" ⇔ `dying && !destroy`, membership ⇔ `!destroy`, `spent` ⇔ the lapse; removed at t144.
**Mutant M5** (dying bodies dropped from `strikeBodies`): red at t102, as predicted.

## D3 — SF's approach-geometry hit at t658 (PASS; it is D1)

**Reproduction.** `SEEDLING_STRIKE_ETA_FLOOR=1` (env, measurement only) and G1/RE's `g1-solve.mjs` on staging A
(`hammer-p1-l40-south-boot.json`, `collect:880,816`, sword):

| walls | refusal | player hits (t, source, knockback dy) | game read (Bob, model ON) |
|---|---|---|---|
| OFF | REFUSED t1695 on `bob@736,752` (SF's answer) | 658 bob −3.0 · 747 bob −2.9 · 778 bob (death) | clock `[0]`, 20,292 comparisons, worst **0** |
| ON | REFUSED t1811 on `bob@736,752` | 674 bob −3.0 · 705 bob −3.0 · 762 bob (death) | clock `[0]`, 1,794 sampled ticks, worst **0** |

The two plans share their keys to index 657. **Why the model's bob reaches the player at t658 OFF:** it leaves home
(744, 760) at t606, through `spinner@880,848`. With the wall it stands at home until t631, so at t658 it is at
(744.0, 754.0) instead of (743.8, 748.3), 5.7 px further south, and never reaches the player. Replayed ON, the OFF plan's
tape puts the player at t658 at **(744.2596783699775, 742.494712313261)**, the game's reading in SF's
`sword-plan-dash-window.txt`, to the bit. The contact rule itself is not at fault.

**Staging A's sword plan at 0 px through t658, floor OFF and ON:** floor OFF, the plan is CW's prefix (D1's witness,
0 px through t3113 ON). Floor ON, both plans above are 0 px for their whole length ON.

**Gate:** two D3 rows (fixture `l40contact-a-sword-floorplan.tape.json`): OFF the t658 hit (dy ≈ −3), ON no hit and
the game's player point. Mutant M2 turns the ON row red.

## D4 — 414's throw (STOP → hammer arc)

**Re-measure** (`cw-solve.mjs --leg=414 --atlas=1 --ghost=1`, defaults): **it still THROWS** at t2439 inside the press
kill (`execKillByPress` → `deriveStrike` → `walkTo` → `previewWalk` → the chaser forecast): *"whether bob bob@736,752
is on screen depends on where inside `Game.shake`'s jiggle the camera landed…"*, after deaths at t1202 and t2395.

**Bisect** (`git bisect run tools/bisect-414.sh`: G1's own `g1-solve.mjs` on 414's atlas boot view `d4/boot-414.json`,
rebuilt as G1 built it, with `SEEDLING_GHOST_KILL_RUNG=1` so G1's rung is on at every commit; exit 1 = the shake
throw). The brief's good end `11e113e2fe` predates G1's rung (REFUSED t0 there), so the good end is `ff759a4a` (G1 D1):
**REFUSED 5672, msg `26977d99`**, exactly G1's `cand-414a.json`. Eight steps after the two manual end checks (`evidence/d4/bisect.log`, `bisect-log.txt`):

> **first bad commit: `926cc2a8` — "wave-14 flip — four CONTACT_FIDELITY defaults ON"** (parent `638ac396`: 5672)

It flips `totemShotBlastInt`, `rebootShake`, `fallRockPostFall`, `forecastSpeedByTerrain`. **With `rebootShake` alone
OFF at the base** (`SEEDLING_CONTACT_FIDELITY=<every default-ON key but rebootShake>`): REFUSED **5672**, 14 hits (G1's
row; the obstacle text now names `bobsoldier@880,832`, a later model change).

**The mechanism.**
1. The death at t2395 reboots with the killing hit's shake carried into the settle frames (`rebootShake`: the camera
   band, ⚖ the jiggle's VALUE is never modelled).
2. 44 ticks later the press kill's strike preview runs the chaser forecast.
3. Inside the band, whether `bob@736,752` is on screen is the cosmetic RNG's question, and `onScreenAt` throws by design.
4. Nothing between it and the solve catches the throw.

**Why STOP.** The band stays (⚖ user 2026-10-10). "Plan away from uncertain on-screen stances" means the strike
preview must treat the throw as a refused candidate (or wait the band out). That catch belongs in `deriveStrike` /
`previewWalk`'s caller in the press kill: the hammer arc's region and the walker's, not mine. Hand-over below.

**With `chaserSpinnerWalls` ON** the atlas run does not meet the band at t2439 (the bobs stand differently). It dies to
`bob@736,752` every ~1,195 ticks instead (9 deaths, 27 hits, one ghost landing on `spinner@880,848` per cycle, its hits
reset by each reboot) until `execKillByPressOnce` throws at **t11419**: *"ran the strike schedule … for the whole
11418-tick bound (29 strike(s) planned, 10 landing(s))"*. That is the press kill's loop across death reboots (the hammer
arc's). Hand-over item 2.

## The movers ON (for the licence) — nothing re-recorded

| measure | OFF (= W0) | ON (`SEEDLING_CHASER_SPINNER_WALLS=1`) |
|---|---|---|
| identity block, every value row | `evidence/after/identity-after.txt` = W0 | **= OFF** (`identity-on.txt`): no identity row, no producer `--check` moves |
| tapeRunner pairs | 611 `75a3c41f` | **611 `75a3c41f`**: no committed roster tape moves |
| bounded vitest (72 files) | 2,503 | 2,503 passed, **2 red** (`evidence/movers/vitest-on.txt`): `contactFidelity`'s shipped-defaults pin (a flip re-pins it by name) and `lintGateLabels` (my own typed count; fixed at `17a680a4`, flag-independent) |
| route survey (local, `--through=end --route=full`) | steps 78, 124, 126, 139 (L40's only steps) = CI run 38778265493's rows | **byte-identical** (REFUSED, REFUSED, SOLVED 70, SOLVED 172) |
| which rooms can move | — | only rooms with a live spinner AND a chaser whose `solids` hold "Enemy": **L40** (bob, puncher) and **L92** (bob, jellyfish). L18 / L39 hold spinners and no chaser |
| sweep legs by captured request ×2 | 42 legs (376–415, 717, 718; 49 requests) | **one moves: 414** (request 0, budget 640); the other 48 requests answer identically OFF/ON, each stable ×2 |

**414, decided on the seam census, not on one row** (`--seam-time-sweep=-10..10`, `evidence/movers/seam-*`):
Leg 414 (request 0, captured seam 5130; the tool's own line: OFF "12 distinct answer(s) over 21"):

| seam | OFF answer (class, work) | ON answer (class, work) | same |
|---|---|---|---|
| 5120 | `668f4ca7` deadline, 643 | `668f4ca7` deadline, 643 | = |
| 5121 | `668f4ca7` deadline, 643 | `668f4ca7` deadline, 643 | = |
| 5122 | `668f4ca7` deadline, 643 | `668f4ca7` deadline, 643 | = |
| 5123 | `557d5b62` shake-throw, 130 | `b31529c5` shake-throw, 140 | ≠ |
| 5124 | `668f4ca7` deadline, 643 | `340dd659` refused: solverBot, 160 | ≠ |
| 5125 | `668f4ca7` deadline, 643 | `ab77029c` refused: solverBot, 134 | ≠ |
| 5126 | `668f4ca7` deadline, 643 | `668f4ca7` deadline, 643 | = |
| 5127 | `b31529c5` shake-throw, 142 | `668f4ca7` deadline, 643 | ≠ |
| 5128 | `744b3498` refused: solverBot, 641 | `668f4ca7` deadline, 643 | ≠ |
| 5129 | `80c3b4d3` refused: solverBot, 158 | `668f4ca7` deadline, 643 | ≠ |
| 5130 | `b31529c5` shake-throw, 254 | `668f4ca7` deadline, 643 | ≠ |
| 5131 | `668f4ca7` deadline, 643 | `668f4ca7` deadline, 643 | = |
| 5132 | `4d6c5292` swing-throw, 308 | `668f4ca7` deadline, 643 | ≠ |
| 5133 | `668f4ca7` deadline, 643 | `668f4ca7` deadline, 643 | = |
| 5134 | `18902000` swing-throw, 308 | `299effe0` refused: solverBot, 158 | ≠ |
| 5135 | `b31529c5` shake-throw, 154 | `b31529c5` shake-throw, 152 | = |
| 5136 | `668f4ca7` deadline, 643 | `668f4ca7` deadline, 643 | = |
| 5137 | `668f4ca7` deadline, 643 | `668f4ca7` deadline, 643 | = |
| 5138 | `60802c8b` refused: solverBot, 72 | `60802c8b` refused: solverBot, 72 | = |
| 5139 | `b31529c5` shake-throw, 200 | `17108b88` refused: solverBot, 130 | ≠ |
| 5140 | `78591e78` refused: solverBot, 72 | `78591e78` refused: solverBot, 72 | = |

OFF 9 distinct over 21: {'deadline': 10, 'shake-throw': 5, 'refused: solverBot': 4, 'swing-throw': 2}; ON 8 distinct over 21: {'deadline': 13, 'shake-throw': 2, 'refused: solverBot': 6}; equal at 11 of 21

Leg 397 (request 0, captured seam 5129; control: it does not move at its captured seam):

| seam | OFF answer (class, work) | ON answer (class, work) | same |
|---|---|---|---|
| 5119 | `b31529c5` shake-throw, 162 | `b31529c5` shake-throw, 162 | = |
| 5120 | `668f4ca7` deadline, 643 | `668f4ca7` deadline, 643 | = |
| 5121 | `668f4ca7` deadline, 643 | `668f4ca7` deadline, 643 | = |
| 5122 | `668f4ca7` deadline, 643 | `668f4ca7` deadline, 643 | = |
| 5123 | `bfe988e4` refused: solverBot, 190 | `ddd67a68` refused: solverBot, 170 | ≠ |
| 5124 | `e5f4dd14` refused: solverBot, 236 | `668f4ca7` deadline, 643 | ≠ |
| 5125 | `96ace1ee` refused: solverBot, 308 | `96ace1ee` refused: solverBot, 308 | = |
| 5126 | `668f4ca7` deadline, 643 | `668f4ca7` deadline, 643 | = |
| 5127 | `bfd640ec` refused: solverBot, 156 | `bfd640ec` refused: solverBot, 156 | = |
| 5128 | `e5f4dd14` refused: solverBot, 236 | `668f4ca7` deadline, 643 | ≠ |
| 5129 | `5a55f5b8` refused: solverBot, 156 | `5a55f5b8` refused: solverBot, 156 | = |
| 5130 | `5a55f5b8` refused: solverBot, 156 | `5a55f5b8` refused: solverBot, 156 | = |
| 5131 | `668f4ca7` deadline, 643 | `eb20ee94` shake-throw, 380 | ≠ |
| 5132 | `3e18e52b` shake-throw, 216 | `012b1b36` refused: solverBot, 294 | ≠ |
| 5133 | `100dd16a` shake-throw, 242 | `4bc52144` shake-throw, 242 | ≠ |
| 5134 | `db6c13d7` refused: solverBot, 358 | `db6c13d7` refused: solverBot, 358 | = |
| 5135 | `668f4ca7` deadline, 643 | `668f4ca7` deadline, 643 | = |
| 5136 | `4bc52144` shake-throw, 242 | `4bc52144` shake-throw, 242 | = |
| 5137 | `668f4ca7` deadline, 643 | `668f4ca7` deadline, 643 | = |
| 5138 | `668f4ca7` deadline, 643 | `668f4ca7` deadline, 643 | = |
| 5139 | `15192151` refused: solverBot, 72 | `15192151` refused: solverBot, 72 | = |

OFF 12 distinct over 21: {'shake-throw': 4, 'deadline': 8, 'refused: solverBot': 9}; ON 11 distinct over 21: {'shake-throw': 4, 'deadline': 9, 'refused: solverBot': 8}; equal at 15 of 21

**Reading it.** No seam time SOLVES in either mode on either leg; the switch reshuffles which refusal a given clock lands on, within the classes both modes share. On 414 the shake-band throws fall from 5 to 2 of 21 and the `levelRun: the swing at …` throws from 2 to 0; deadlines rise from 10 to 13. On 397 the classes are equal in count (4 shake, 8→9 deadline, 9→8 refused). So 414's captured-row move (shake throw → deadline) is one sample of this, **not a regression and not a fix**.

**Survey/sweep rows this moves (before → after):** none on the survey. Divergence sweep: leg 414's answer moves at
its captured seam (the shake throw → the deadline), within a distribution both modes share; I expect no
`done`/`crossed`/`failed` class to move on the other 41 legs.

**CI dispatches for the planner** (from the cloud `workflow_dispatch` is 403), ref
`claude/seedling-fidelity-l40contact-aorzm5`:
1. `JavaScript Unit Tests` runs on push: at the head, `node scripts/procgen/ci-vitest-summary.mjs <head> --wait`.
2. `seedling-divergence-sweep.yml`, the switch A/B with no code edit: `mode=inv`, `producer=solver`,
   `page=seedling_bot_ap_p4f`, `shards=1`, `ids=376-415,717,718`, once with `contact_fidelity=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,strikeIframeLapse,fallRockPostFall,forecastSpeedByTerrain,buttonFallReleaseStep,waypointSlide,lavaChainPlayerHit,ceremonyShove`
   (the default set, spelled out) and once with the same string plus `,chaserSpinnerWalls`; add `capture_requests` and
   `seam_census` on 414 and 397. Compare by KEY against run 38778270309. Expect no class change beyond `crossed`↔`done`
   noise.
3. `seedling-survey.yml`, `through=end`, `route=full`, `only=78,124,126,139`: needs a one-line scratch commit setting
   `chaserSpinnerWalls: true` (the workflow has no switch input). Expect run 38778265493's four rows.

## What the JS arc must wire

Nothing for a page leg to see the switch beyond what exists: `contactFidelity` keys travel in the request's stamp
(`contactFidelityStamp`) and the sweep's `contact_fidelity` input. No new staging/result field, no new
`SolverRefusal.obstacle.kind`, no `solveSegment` / `twoPassSolve` / `createRunForStaging` contract change. The walker
was not touched: **no `producer:walker` row can move**.

## Hand-overs

**To the hammer arc:**
1. **414's shake-band throw (D4).** `926cc2a8`'s `rebootShake` puts a camera band on the settle after a death, and the
   press kill's strike preview (`deriveStrike` → `walkTo` → `previewWalk`) lets the chaser forecast's `onScreenAt`
   throw escape the solve. ⚖ The band stays; the question is the catcher: a strike candidate whose preview meets an
   uncertain on-screen stance should be refused (or the press kill should wait the band out). The same throw appears in
   the page request at 5 of 21 seam times, OFF and ON (414: 5 of 21 seam times OFF, 2 of 21 ON; 397: 4 of 21 in both). State: `evidence/d4/boot-414.json` with
   `g1-solve.mjs --view=… --goal=collect:880,816 --ghost=1` (throws at t2439).
2. **The press kill across death reboots (D4, the switch ON).** 414 atlas ON: `execKillByPress` keeps its strike
   schedule through 9 deaths to `bob@736,752` (one landing per life, the spinner's hits reset by each reboot) until its
   11,418-tick bound. A death that reboots the room resets the fight; the arm should stop (refuse by name) at the first
   death, not re-run the schedule. State: `evidence/d4/a414-ghost-w1.json`.
3. **(For information) CW's chooser hand-over still stands.** None of the above reaches the chest's guard.

**To fidelity (a later slice):** OFF, the seam census also shows `levelRun: the swing at (727.7…, 680.2…) reaches s…`
throws on 414 at 5132 / 5134: a model refusal by name on the press path (another unmodelled interaction), not measured
further here.

## Deltas (base → head)

- **Code:** `contactFidelity.js` (the `chaserSpinnerWalls` key + its env line); `levelRun.js`
  (`chaserSpinnerWallsNow`; one line in `stepChasersNow`; `fspin` in `chaserForecastNow`). Nothing in the hammer arc's
  region, the JS arc's files, `deriveStrike` / `minTicksBetween` / `strikeScanBox`, the walker or any shared registry
  (`OBSTACLE_STRATEGIES`, `KILL_ARM_POLICY`, …) was edited; `CONTACT_FIDELITY` gained one row at its end.
- **Tests:** `fidelityL40Contact.test.js` (8 rows: D1 ×5, D3 ×2, D2 ×1); `contactFidelity.test.js` (the defaults pin
  gains `chaserSpinnerWalls: false`).
- **Fixtures:** `fixtures/l40contact-spinnerwall-witness/` (three tapes, two game-row files; not roster tapes).
- **Generated:** `seedling-constants-census.csv` + `seedling-constants.md` region (5,883); the docs index word counts.
- **Docs:** `seedling-bot-log.md` § L40CONTACT; `seedling-bot.md`'s as-built paragraph.
- **Not touched:** no AS3, wasm, gitlink or rules edit; no committed tape or producer output moved; no `standing-values
  --write`, no `pytest`, no unfiltered local vitest (⚖ 52); no `git stash`, rebase or force-push.

| | before (W0) | after (head, OFF) |
|---|---|---|
| identity block (value rows) | `75e91109` | **= W0** |
| six `--check`s | as W0 | = |
| tapeRunner pairs | 611 `75a3c41f` | 611 `75a3c41f` |
| surface / constants / entities / profile | 296 / 5,882 / 566 / 138 | 296 / **5,883** / 566 / 138 |
| roster | 277 | 277 |
| bounded vitest | 71 files, 2497 / 2497 | **84 files, 3047 / 3047** (+ the gate, `procgenDocs/*`, `checkProcgenHelp`) |
| reference | ALL 7 + 5 MATCH (primary tree) | **ALL 7 + 5 MATCH** |
| CI `JavaScript Unit Tests` | — | green at the records commit `7701f8d5` (run 38811222812): **20,415 / 20,415**, slow battery 253 / 253. ⚠ `b569313` was red by one row (my typed count in `lintGateLabels`), fixed at `17a680a4` (green, 20,415). The report commit is docs-only; its run is the planner's to read |

## What the brief got wrong (measured)

1. **"A scratch wall moves the parting to t1989 … the second parting is unexplained."** There is no second parting.
   The probe joins each game row to its own (OFF) model's nearest body, so after the OFF model parted it labelled both
   game bobs `bob@736,752`. With the wall in the probe's model the whole 3,113-tick prefix is 0 px.
2. **"G2: is it a respawn, or does `levelRun`'s killed flag disagree with membership?"** Neither: the membership is
   the "die" window, and the game agrees tick for tick. `strikeBodies` includes a dying body by design (`spent`).
3. **"G3: the difference is the approach geometry, which is chaser contact."** The contact rule is exact; the bob is in
   the wrong place because a spinner did not stop it 52 ticks earlier. It is G1.
4. **"G4: G1 had REFUSED at 5672 … something since `11e113e2fe` moved it."** At `11e113e2fe` itself the instrument
   refuses at t0 (G1's rung is not there yet); 5672 is G1's switch ON, first at `ff759a4a`. The mover is the wave-14
   flip's `rebootShake`.
5. **"Re-derive legs … match legs by KEY."** The ids did not shift at this base (378/381/397/414 have the keys the
   reports name).
6. **The bootstrap left six submodules uninitialised** after `READY`; until they were initialised the reference
   regeneration rewrote the substrate registry from the missing trees (restored, then regenerated cleanly).

## Residue

1. **The flip is the user's.** Measured ON: no committed tape, producer, identity row, tapeRunner pair or survey step
   moves; the bounded set reds only the defaults pin. Re-pins a flip owes: `contactFidelity.test.js`'s defaults
   (`chaserSpinnerWalls: true`), and the "ships OFF" row of `fidelityL40Contact.test.js` (it reads the defaults). The CI
   sweep A/B (dispatch 2) is the remaining check.
2. **The page legs ran while the box was loaded.** My first page capture (378/381/397/414) timed out on the page at
   all four (vitest BEFORE was running); its requests were captured, and every decision is from node replays of
   them. ⚠ Mutant M4 (which touches the default path) was live in the tree for ~10 s while that page sweep was booting
   pages; the captured requests are game-side staging and do not depend on it.
3. **414 and 397 are seam-sensitive in both modes** (12 distinct answers over 21 seam times OFF). A single sweep row for
   them cannot license or refuse anything.
4. **Tree hygiene.** The two scratch worktrees (`base`, the bisect's `bis`) are removed by name; both servers
   are killed by PID; the six submodules initialised for the reference stay checked out at their recorded gitlinks (no
   gitlink moved).

## Rows to BANK

- `CONTACT_FIDELITY.chaserSpinnerWalls` (OFF); `SEEDLING_CHASER_SPINNER_WALLS`.
- Surface **296**; constants **5,883**; entities **566**; profile **138**; roster **277**; tapeRunner pairs
  **611 `75a3c41f`**; identity value rows = W0 (`75e91109`), ENEMY `36b59445`, r9-campaign `6b1bf15c`; reference
  ALL 7 + 5 MATCH.
- Gate `fidelityL40Contact.test.js` (8 rows); witness folder `fixtures/l40contact-spinnerwall-witness/`.
- Game witnesses: CW staging A sword prefix ON (Bob 37,308 / Spinner 15,555, worst 0); SF floor plans ON (worst 0);
  leg 378 puncher death (305, worst 0).
- D4: first bad `926cc2a8` (`rebootShake`).
