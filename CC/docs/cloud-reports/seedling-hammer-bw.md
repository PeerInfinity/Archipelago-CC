# Seedling HAMMER-PHASE — slice BW: the press kill's waits see the lobber's bombs

Slice `seedling-hammer-bw` (Opus, cloud), planner `seedling-hammer-phase-planning`. ⚖ The user (2026-10-12): *"Both, in
parallel"*: this slice, beside the planner's CI re-measure of the G1 flip. One behaviour change behind one new switch,
**OFF**, and OFF is byte-inert: `pressKillCost.PRESS_KILL_BOMBS` (`SEEDLING_PRESS_KILL_BOMBS=1`,
`withPressKillBombs(enabled, fn)`).

| | |
|---|---|
| Start SHA | **`b984872d3c`** (= `origin/main` at the fetch; ≥ the brief's floor) |
| Head | the commit carrying this report. D1+D2 code `c8ec7be`, D2 witness `bb99819`, D4 records `8e57bd8`, then this report |
| Branch | `claude/seedling-hammer-bw-ywprg2` (the harness names it; the brief's `seedling-hammer-bw`). Nothing went to `main` |
| Dev server | `serve-nocache.py 9581` (`SEEDLING_PORT=9581`), PID 859, killed by PID at the end (`ss` is not on this box; the PID was the one recorded at launch) |
| Verdicts | **W0 PASS · D1 PASS** (four candidates measured; the strike's stand is the one that removes the hit) **· D2 PASS** (the switch, OFF; the game witness agrees to the bit, 0 hits) **· D3 PASS, STOP at the movers** (one mover: leg 381 with MOVING_WAIT ON; nothing committed moves) **· D4 PASS** |

## The one thing to know first

**381's t1156 hit is the press kill's STRIKE DWELL, and ON it is gone, on the game too.**
- `deriveStrike` priced the strike's walk against the bombs (`dangerDuringTransit` reads the walk's own `spits`). It priced the dwell after arrival and the press train against the hammers only. So did `deriveRefuge`.
- ON, the lobber's own forecast is stepped along the previewed walk and then with the player standing. A window whose stand meets a blast is refused by name.
- On 381 the strike moves from (248,184) to (232,184) and lands at t1154. At t1156 the player stands 23.6 px from `#7`'s blast.
- The game (p4f) plays the ON plan with the player, every Bomb and the lobber's anim equal at 1,290 sampled ticks, hits 0 = 0.
- **The leg still does not solve.** The next stop is `#10` (t1294 on the atlas staging; `#9` at t1248 on the page's) exploding on the chaser `bob@272,112`. That is the Explosion's unstaged `"Enemy"` arm, fidelity's wave 16, refused by name in `levelRun`.

## W0 — the bank, and the reproduction (PASS)

| row | command | result |
|---|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-hammer-bw-ywprg2 origin/main` | `b984872d3c` |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0. Five submodules `-` after `READY` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, textAdventureEngine): `git submodule update --init` each |
| identity block | `SEEDLING_PORT=9581 bash scripts/procgen/identity-block.sh .` (venv) | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set OK, reference **ALL 7 + 5 MATCH**. md5 of the non-`#` lines (the `rc=` line dropped) `77080c2e` (`evidence/identity-w0.txt`). It differs from G1's `a1565a68` only because G1's worktree read the reference row as `4 DIFFER`; every value row is G1's |
| six `--check`s | in the block | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, all exit 0 |
| tapeRunner pairs | `vitest --reporter=json` over `tapeRunner.test.js`; `status\tfullName` sorted, `\n`-joined | **611**, `75a3c41f0c91f6e71953e82d8259dc60` |
| surface / constants / entities / profile | each `--check` | GREEN **284** · PASS **5,841** · PASS **558** · PASS **138** (`evidence/censuses-w0.txt`) |
| roster | `fixtures/tapes/index.json` | **277** |
| bounded vitest BEFORE | 20 files: every non-slow test `rg -a` finds naming `execKillByPress`, `deriveRefuge`, `refugeNow`, `lobberWaitDanger`, `spitForecast`, `MOVING_WAIT` or `PRESS_KILL_COST`, plus `solverBot*`, `hammer*`, `solverSpinnerKill*`, `pressKillCost`, `fidelityMovingWait`, `solveProgress`, `tapeRunner` | **1014 / 1014**, md5 `905767ad197b73a38be52d3a3c4ad9cd` |

### The reproduction (381, `SEEDLING_MOVING_WAIT=1`)

How it was run:
- Driver: `evidence/bw-leg.mjs` (D's `d1-leg.mjs`) with `REWIND_PROBE.sink` recording every tick's position, hits, bombs and call stack.
- Labels: a scratch-only sink in a copy of `solverBot.js` labelled each press-kill tick.
- Inputs: `seedling-divergence-legs.mjs` (843 legs, the ids unchanged); the page's delivered set from `probe-seedling-divergence-sweep.mjs --mode=inv --ids=400 --dump=…`.

| what | measured |
|---|---|
| the press kill | `execKillByPressOnce` ← `execKillByPress` ← `execute` ← `climbLadderUnder` ← `climbLadder`, from t1099 at (280.74,215.30) (the paced hold's stance), on `spinner@192,128` |
| the strike | at t1099 `deriveStrike` returns cell **(248,184)**, press **t1153**, ETA 37 |
| the standing span | the walk arrives at t1127 (248.36,183.72), steps right/left t1128-1130, then **stands t1131-t1155 at (248.37,183.72)** (`held` empty, strike held). At t1153 the strike has lapsed unpressed; it is re-derived at t1154 (press t1156, ETA 0), aimed at t1155 and pressed at t1156 |
| the bomb | `bombpusher@112,128#7`, **spawned t1125** at (136,152) with v (3.8457, 1.1310), aimed at the arriving player (250.19,184.75). It **explodes t1156 at (255,187)**: blast `inSquare`, `hitPlayer` |
| the hit | `playerHits` row t1157 (the advance from t1156), `source: bomb`, `hits 1`, knockback (-3.41, -2.10) |
| after it | the shake band, then `chaserForecast` throws on `bob@288,80` (`CAMERA BAND`): fidelity's row |

**The standing wait a bomb reaches: the STRIKE DWELL** (arrival at the strike cell until the press), and the press's own aim and train with it. That is `execKillByPressOnce`'s walk branch: `aim = strike.cell`, `hasArrived`, `held` empty, then `stepToward` and `safeStep`, both hammer-only. The same hit reproduces on the ATLAS staging (fidelity's `l40buttonStaging`, boot (848,16)): `#7` at t1157's ledger row, executed keys `f7cefc5f`.

The press kill's standing waits, named, with whether a bomb reached one:

| wait | call site | reached by a bomb? |
|---|---|---|
| the strike's dwell (arrived at `strike.cell` until the aim) | `execKillByPressOnce`, the walk branch (`aim = strike ? strike.cell : refuge`) | **yes: 381 MW ON, t1131-t1155** |
| the aim tick and the train (aim, press, `SLASH_HIT_TICKS`) | `pressReadyAt(...) && aimAdmitted()`; the `aimed` branch | yes, the same stance (the hit lands on the press tick) |
| the refuge wait | the walk branch, `refuge = refugeNow()` (`deriveRefuge`) | no (never reached near the lobber in the table) |
| the HAMMER-PHASE stall | `phaseStall` (`hammerPhaseRung`) | no |
| the escape certificate's stands | `following` (`pressEscape`) | no |
| the fight certificate | `fightKeys` (`HAMMER_FIGHT`, OFF) | not run |
| the lock fade | the tail's `NO_KEYS` loop | no (no lock on 381's kill) |

### The L40 table at W0 (`evidence/w0-legs.jsonl`; page staging, cap 900 s, 2 at a time)

| leg | MOVING_WAIT OFF | MOVING_WAIT ON |
|---|---|---|
| 378 | REFUSED at `buttonroom@272,208`'s t0 hold (BOMB), msg `c5ff5e3c` | REFUSED at `buttonroom@160,128`'s t1 hold (BOMB), msg `622623e0` |
| 381 | REFUSED at the t0 hold (BOMB), msg `c1be8451` | THREW `CAMERA BAND` after the t1156 hit, msg `d8c930d8` |
| 384 | SOLVED 859 t, keys `1d700d96` | = |
| 396 | SOLVED 494 t, keys `8bc59cfa` | = |
| 400 | SOLVED 270 t, keys `3adc7396` | = |
| staging A (`view-solve.mjs`, `--stop-tick=1`) | REFUSED 3113 t, keys `af47d35d`, msg `b02571c9`; **0 bomb events** | = |

Only 381 with MOVING_WAIT ON reaches a press kill near the lobber. 384 / 396 / 400 do not run `execKillByPress` (no kill-start). Staging A's 3,113 press-kill ticks are 380+ px from the lobber, so no bomb is ever spawned there.

## D1 — the candidates, measured before chosen (PASS)

Each candidate was built in a scratch copy and selected alone (scratch `BW_ARMS`). All runs are 381 on the page staging with MOVING_WAIT ON (`evidence/d1-381-arms.json`).

| candidate | what it asks | removes 381's hit? | measured |
|---|---|---|---|
| **the strike's stand** (`deriveStrike`) | per cell, once per derivation: the lobber's forecast stepped along the previewed walk, then standing on the cell; refuse a window whose stand (arrival to `+i + hitTicks + 1`) meets a blast | **yes** | strikes from **(232,184)** (press t1153, lands t1154), 0 hits. Then a HAMMER_SAFETY corner at (249.65,166.62), 26 ticks after the landing, on the next approach (a different family) |
| the refuge (`deriveRefuge`) | skip a previewed refuge whose walk or wait over its window meets a blast | no | no refuge is asked before t1156; the hit stands |
| the live aim | do not aim when a blast lands on the stance within the train | no | refused 2 aims; the player still stands there: hit at t1157 |
| the standing wait yields | drop a held strike whose stance a blast reaches before its train ends; re-derive | no | dropped 44 times; the re-derivation picks the same stance: hit at t1157 |
| **all four** | — | **yes** | 0 hits to t1248, then REFUSED: `#9`'s Explosion on `bob@272,112` (the `"Enemy"` arm). The aim and yield guards refused **0** of 12 asks (page) and 0 of 54 (atlas) |

**Chosen: the strike's stand + the refuge.** The aim and yield guards add no measured behaviour (0 refusals with the stand arm on), so they are not shipped. The refuge arm does act: it refused 10 refuges on the page staging and 156 on the atlas. In both runs it moved the post-landing wait off (232,184), onto which `#8` was forecast to land; the strike-only run instead stood there one tick and cornered on the hammer.

**What it costs in ticks.** The first landing comes 3 ticks **sooner** (t1154 vs t1157 OFF). Neither run completes the kill (OFF throws after the hit; ON stops on the `"Enemy"` arm), so the whole-kill cost is not measurable on this leg.

**Legs that do not meet a bomb do not change.** Shown by the L40 table and staging A (D3). In `hammerPressBombs.test.js`, staging A's strike and refuge ON are OFF's.

## D2 — the switch, OFF, and the game witness (PASS)

- **Where.** `pressKillCost.js` gains `PRESS_KILL_BOMBS` (OFF; `SEEDLING_PRESS_KILL_BOMBS=1`), `PRESS_KILL_BOMBS_DEFAULT`, `withPressKillBombs`, and the instrument `PRESS_KILL_BOMBS_COUNTS` with `resetPressKillBombsCounts`.
  - **Why that file and not a new module beside it:** `solverView.js` re-exports only modules in `levelRun.js`'s import closure. A module that only `solverBot` imports is a solver-FAMILY file (`census-seedling-solver-surface` says so by name), and so is anything that reads the run. I built `pressKillBombs.js` first and the census refused it.
  - The two run reads, `bombsInPlay` and `firstBlastOn`, therefore live in `solverBot.js`.
  - The file's header keeps P1/P2 a cost-only A/B; the new section says it is a behaviour switch, apart.
- **The arms** (`solverBot.js`):
  - `strikeStandBlast` / `standBlastAt` in both of `deriveStrike`'s passes, after the dwell's hammer check and before the escape admission (so a bombed window never becomes A3's uncertified fallback). The refusal is by name in `rejected` (*"the STAND meets a bomb: … at +k `#n`'s Explosion at (x,y) lands on the stance"*) and counted in `bombed`, a record field only where a lobber is in play.
  - `refugeBlast` in `deriveRefuge`'s previewed candidates.
  - The refuge refusal (`HAMMER_SAFETY`, *"nowhere to be"*) gains one sentence ON in a lobber room; its first sentence is unchanged.
  - `deriveRefuge` is exported, for the test.
- **OFF is byte-inert.** OFF, nothing is asked: `bombs` is false and no branch reads the forecast. ON in a room with no lobber and no bomb, nothing is asked either.
- **The caches.** No P1/P2 cached function gains an input: every forecast is a fresh `run.spitForecast()` per question, and the per-cell stand blast is memoised only inside one derivation's `walks` map. **P2's aliasing mutant has no new key to run against.** It still runs, in `pressKillCost.test.js`, green in the AFTER set.
- **Progress counts.** No `previewWalk` is added (the forecast is re-stepped over the walk's own samples), so no `solveProgress` count point is skipped or doubled.
- Surface census +2 rows (`PRESS_KILL_BOMBS`, `PRESS_KILL_BOMBS_COUNTS`, class `seedling`); `run:entities` / `run:spitForecast` sites +1. `entityBlocks.FAMILY_BLOCKS`: `bombs` is read by `solverBot` too (and its doc row).
- **Gate `hammerPressBombs.test.js`** (8 rows):
  - the switch: it ships OFF, and `with…` restores, also on a throw;
  - fidelity's committed `movingwait-l42-381-pace` walk at t1099: OFF (248,184) press 1153; ON (232,184) press 1161, `bombed` 8, the refusal naming `#7` at +57, (256,187);
  - the same walk at t1150: OFF (248,184); ON no strike (`bombed` 9); refuge (232,200) → (216,168);
  - OFF asks nothing;
  - staging A: ON = OFF;
  - the game witness replayed: 1,289 samples, 0 parted.
- **Mutants** (predicted, copy and restore, `cmp` clean): M1, the stand arm never refuses → 2 red (t1099, t1150) ✔. M2, the refuge arm off → 1 red (t1150) ✔.

### The game witness `hammer-bw-l42-381-bombstand`

- **Author:** `scripts/procgen/plan-seedling-hammer-bw-bombstand.mjs` (author / `--check` / `--samples`). `fixtures/hammer-bw-bombstand-witness/` holds the tape and `.game.json`; it is not the roster.
- **Staging:** leg 381's atlas staging (fidelity's `l40buttonStaging`, the L42 arrival). `solveSegment` runs with MOVING_WAIT and the switch ON; its executed keys are taken at the run's own `advance`.
- **ON:** 1294 ticks executed, then REFUSED by `levelRun`: *"the Explosion of bombpusher@112,128#10 at (268, 118) on tick 1294 … reaches the chaser bob@272,112 — `Enemy.hit(4, …, 1)` … is not staged"*. The tape is cut at **t1293**.
- **Model, over the prefix:** 0 player hits; one landing, t1154 on `spinner@192,128` (hits 1). Blasts `#1`-`#9` all miss the player.
- **`--check`:** it also asserts OFF's hit (`#7` on t1157's ledger row).
- **On the game:** `SEEDLING_PORT=9581 node scripts/procgen/probe-seedling-bombpusher.mjs --file=<tape> --out=<rows>` (p4f, headless logic-only, damage on, under the box lock). Result: **PASS**.
  - 1,290 sampled ticks of 1,294 (unsampled 22, 544, 553, 562).
  - At every one, the player, every Bomb's position and velocity, and the lobber's anim equal the model's.
  - **Game hits `[]` = model `[]`.**
  - The game's own story at the old stance: `#7` explodes at t1156 with the player at (231.62,183.96); `#8` explodes at t1202 at (229,176), the player at (226.13,157.87) (`evidence/game-381-on.txt`).
- **Where the game parts from the model past the press kill's wait:** nowhere inside the witness. The stop after it is the model refusing by name (the unstaged `"Enemy"` arm), not a parting. The cause is in the model's coverage (`levelRun.drainBombBlastsNow`), fidelity's wave 16. It is not this slice's fix, and there is no tape to hand over beyond the cut witness.

## D3 — ON, STOP at the movers (PASS)

All with `SEEDLING_PRESS_KILL_BOMBS=1`, and with MOVING_WAIT both OFF and ON.

| row | command | OFF (W0) | ON, MOVING_WAIT OFF | ON, MOVING_WAIT ON |
|---|---|---|---|---|
| L40 table 378 | `evidence/legs-run.sh` (`bw-leg.mjs`, page staging) | as W0 | = (msg `c5ff5e3c`) | = (msg `622623e0`) |
| **L40 table 381** | the same | as W0 | = (msg `c1be8451`) | **MOVES**: THREW `CAMERA BAND` after the t1157 hit (msg `d8c930d8`) → **REFUSED at t1248**, `#9`'s Explosion on `bob@272,112` (msg `e5cd34ac`), **0 player hits** |
| L40 table 384 / 396 / 400 | the same | 859 / 494 / 270 t | = (keys `1d700d96` / `8bc59cfa` / `3adc7396`) | = |
| staging A | `view-solve.mjs --view=step-78-boot.json --goal=collect:880,816 --stop-tick=1` | REFUSED 3113, `af47d35d` / `b02571c9` | = | = |
| staging A wall-clock | the same, OFF/ON alternating, 2 rounds (`evidence/time-A.txt`) | 210.4 / 178.4 s | 192.9 / 131.1 s | — |
| identity block (every value row, the six `--check`s, r9-campaign, ENEMY) | `identity-block.sh .` | W0 | **= W0 on every value row** (`evidence/identity-on-mw0.txt`); the reference row read `2 DIFFER` there: the new instrument before D4 regenerated the index | **= W0** likewise (`identity-on-mw1.txt`) |
| **`r9-solve-16`** (inside `r9-campaign --check`) | `SEEDLING_PRESS_KILL_BOMBS=1 SEEDLING_MOVING_WAIT=1 node scripts/procgen/solve-seedling-r9-campaign.mjs --check` | PASS ×3 | (md5 `712f0ead`) | **PASS: 0 hits, 0 deaths; ends at the L18 arrival `["688:L18"]`; calm (v 0,0)**, all checks green (`evidence/campaign-on.txt`) |
| ENEMY census | the block | `afdc6d1a` | `afdc6d1a` | `afdc6d1a` |
| L18 sweep (45 residues) | `sweep-seedling-l18-residues.mjs` (W0 on a base worktree) | 45/45, `c719519a` (timing stripped) | `c719519a` | `c719519a` |
| C2's L18 ghost staging | C2's `ghost-sweep.mjs` | 45/45 (336 ×43, 390, 340), `60c77c81` | `60c77c81` | `60c77c81` |
| bounded vitest | — | — | the AFTER set below runs OFF (its rows set the switch per row) | — |

**One mover, and it is not committed:** leg 381 with MOVING_WAIT ON, `CAMERA BAND` → the `"Enemy"` arm's by-name refusal.
- Before → after md5 (the refusal message): `d8c930d8e61c014f87df1092708f6824` → `e5cd34ac85c0b9d7ba59abc4e1ce6e43`.
- No tape, no identity row, no producer moves. **Nothing was re-recorded.**
- Under the brief's family names the row goes `CAMERA BAND` → an unnamed `Error` (the Explosion's `"Enemy"` arm). That is the family fidelity reported for the cluster boot's walk.

**Divergence-sweep keys for the planner** (`seedling-divergence-sweep.yml`, `-f mode=inv -f producer=solver -f shards=1`,
with `contact_fidelity=<the defaults>,movingWait` for the ON side of the MOVING_WAIT question):

`-f keys="level_40__r0c53 <- in_L41_0_160 -> location:Level 040 - Totem Part 64,144|level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144"`

⚠ **The page cannot see `PRESS_KILL_BOMBS`.** It is env-only (`globalThis.process?.env`), so the page worker runs it OFF, as G1's residue 3. On this branch the sweep reproduces today's verdicts: 378 BOMB at the t1 hold, and 381 `CAMERA BAND` with `movingWait`. It shows the mover only after a flip to default-ON, or with a page setting (the JS arc's). The ON rows above are node's.

## D4 — records (PASS)

| row | result |
|---|---|
| bot doc / log | `seedling-bot.md`: the PRESS_KILL_BOMBS paragraph after G1's. `seedling-bot-log.md`: `### Seedling hammer-phase BW — the press kill's waits see the lobber's bombs` |
| surface | `census-seedling-solver-surface --write` + the two rows classified: GREEN **286** |
| constants | `--profile-rows`, then `--write`, then `--check`: PASS **5,846** (5 new structural literals, 0 moved) |
| entities / profile | PASS 558 / 138 |
| reference | `generate-procgen-reference.mjs` (instruments index + architecture's region: the new instrument; docsIndex word counts), then `--check`: ALL 7 + 5 MATCH. `scripts/quicklaunch/generate-docs-index.mjs` written |
| help gate | `check-procgen-help.mjs --only=plan-seedling-hammer-bw-bombstand.mjs`: HELP ok · IMPORT ok. The whole gate (`--jobs=3`, idle box): **26 FAIL, none this slice's**. They are 24 IMPORT SIDE EFFECT and 2 HELP SIDE EFFECT rows on scripts this slice never touched (`plan-seedling-r4.mjs`, `census-seedling-bosslocks.mjs`, … `evidence/help-gate.txt`). The same 26 failed under load, and `plan-seedling-r4.mjs` / `census-seedling-bosslocks.mjs` fail identically at the base `b984872` (a worktree of it): environmental, pre-existing. The vitest row `checkProcgenHelp` is green |
| bounded vitest AFTER | 30 files: the W0 set + `hammerPressBombs` + `boxLock`, `seedlingConstantsCensus`, `procgenDocs/{generated,docLinks,docsRender}`, `quickLaunch/generated`, `entityBlocks`, `seedlingSolverSurface`, `checkProcgenHelp`. **1296 / 1296**, md5 `70835a38346a0031e7f21ad22d6940dc`. The W0 set's 1014 rows: 0 gone, 0 changed |
| tapeRunner AFTER | **611**, `75a3c41f` = W0 (no roster tape added) |
| timeouts | every row of `hammerPressBombs.test.js` that replays a walk has an explicit 120 s timeout (none runs a full solve; each takes ~1 s) |
| not run | `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No `git stash`, no rebase, no force-push, nothing to `main` |

**Identity block AFTER, switch OFF, on the finished tree** (`evidence/identity-after-off.txt`): **byte-for-byte W0**. Every value row, the six `--check`s (`405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, exit 0), and reference ALL 7 + 5 MATCH.

## The deltas

- New: `hammerPressBombs.test.js` (8 rows); `scripts/procgen/plan-seedling-hammer-bw-bombstand.mjs`; `fixtures/hammer-bw-bombstand-witness/hammer-bw-l42-381-bombstand.{tape,game}.json`.
- `pressKillCost.js`: the BW section (`PRESS_KILL_BOMBS` OFF, default, `with…`, counts, reset).
- `solverView.js`: the two symbols on the `pressKillCost.js` line.
- `solverBot.js`:
  - `bombsInPlay`, `firstBlastOn`, `refugeBlast`, `strikeStandBlast`;
  - `deriveStrike`'s stand arm (both passes), the `bombed` field (lobber rooms, switch ON only);
  - `deriveRefuge`'s arm, and its export;
  - one sentence on the refuge refusal, ON in a lobber room.
- `entityBlocks.js` + `seedling-solver-surface.md`: `bombs` read by `solverBot`.
- Not touched: `runLatchedWait` / `runHold` / `runPace` / `MOVING_WAIT`; `dangerMap`; `spitForecast` / the bomb model; the `"Enemy"` arm; `strikePolicy.js`, `contactFidelity.js`; `solveSegment`'s SUCCESS path; `levelRun.js`, `levelWorld.js`; `ghostSpinnerPress.js`; the JS arc's files. No AS3, wasm, gitlink or rules edit.
- **No new `SolverRefusal.obstacle.kind`, no new staging or result field; no committed tape or sidecar moves.** `bombed` exists only ON.

## What the brief got wrong (measured)

1. *"the run then STANDS t1132–t1155 … in `execKillByPressOnce` (← `climbLadder`)"*: right, and the wait is specifically the **strike's dwell**: a held strike (248,184), press t1153, that lapsed and was re-derived for t1156. It is not a refuge wait. The span is t1131–t1155 (t1127–t1130 is the arrival's jiggle).
2. *"The press kill's waits never consult … the bombs in `run.spitForecast()`"*: the strike's WALK did, through `dangerDuringTransit`'s `spits`. What never consulted them was the stand after the walk and every refuge.
3. *"Put it in `pressKillCost.js` or a new small module beside it"*: a new module cannot be wired through `solverView.js`. The door re-exports only `levelRun.js`'s import closure, so a new module only `solverBot` imports is a solver-family file (the census refused it).
4. *"P1's five L40 legs … name each press-kill standing wait that a bomb reaches"*: only one of the five reaches a press kill near the lobber (381 with MOVING_WAIT ON). 384 / 396 / 400 never run `execKillByPress`, and staging A's press kill is out of the lobber's 256 px.
5. *"`runPace`'s pacing does not transfer"*: confirmed. Neither did a live "yield" on its own: dropping the strike re-derives the same stance 44 times over. The fix belongs in the derivation.

## Residue

1. **For fidelity (wave 16): the next stop is the Explosion's `"Enemy"` arm.** It is now reached by the press kill's own walk on 381.
   - The atlas staging: `#10` on `bob@272,112` at t1294. The page: `#9` at t1248.
   - Each bomb was aimed at the player walking to the next strike cell (264,88), and lands where the chaser has walked.
   - Walks still do not price a blast on a body. The witness tape (cut at t1293) is the prefix to start from.
2. **The UNBILLEDGATE interaction (wave 15).** 381's t1156 hit is an unbilled hit inside a plan; with UNBILLEDGATE ON, OFF would refuse there by name. **ON moves that hit out of the plan:** 0 player hits in the 1,293-tick witness and in the page run to t1248. So UNBILLEDGATE does not fire on it; the leg stops at the `"Enemy"` arm instead.
3. **Turret spits in the dwell are still unpriced.** The arms read bomb entries only (no room holds both a turret and a lobber: `levelRun.spitForecastNow` refuses that).
4. **The escape certificate's stands, the HAMMER-PHASE stall and the lock fade** are still hammer-priced only. None met a bomb in any measured run.
5. **The aim and yield guards were built, measured inert (0 refusals) and not shipped.** If a future walk's preview parts from the live walk near a lobber, they are the next candidates (`evidence/d1-381-arms.json`).
6. **For the planner / JS arc:** the page never sees `PRESS_KILL_BOMBS` (env-only). A flip to default-ON reaches the page worker.
7. **CI for the planner** (dispatch returns 403 from the cloud):
   - `JavaScript Unit Tests` at the head (`node scripts/procgen/ci-vitest-summary.mjs <head> --wait`);
   - optional: `seedling-divergence-sweep.yml` with the two keys above (no change expected while the switch is OFF).
8. **Standing rows to bank: none.** No roster tape; `rosterCategories` does not move.
9. **Tree hygiene.** Two scratch worktrees (the experiment copy, the base for the W0 sweeps) were removed by name. The scratch `pressKillBombs.js` was removed before the first commit. `evidence/bw-leg.mjs` still imports it inside a `try` (the counts read `null` at the head).

## Rows to BANK

- `PRESS_KILL_BOMBS` OFF; `hammerPressBombs` 8 rows; witness `fixtures/hammer-bw-bombstand-witness/` (1293 t, game 1,289 compacted samples, 0 parted); roster 277 unchanged; tapeRunner 611 `75a3c41f` (= W0).
- Surface GREEN 286; constants 5,846; entities 558; profile 138; bounded AFTER 30 files / 1296 `70835a38`.
- **Licence question for the user:** flip `PRESS_KILL_BOMBS`.
  - Movers: 381 with MOVING_WAIT ON only (`CAMERA BAND` → the `"Enemy"` arm, 0 hits); no tape, no identity row, no producer.
  - It matters only together with `movingWait`. Without it, 378/381 refuse at the t0 hold before any press kill.
