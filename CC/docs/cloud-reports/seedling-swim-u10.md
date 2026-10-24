# Seedling swim U10: step 24's three walls, and the goal collected in passing

**Slice:** `seedling-swim-u10`, a cloud fan-out worker for the swim arc (plan §15.11, ⚖ Q38). Its siblings U6b and U9 ran in parallel, and none of their regions were edited: no `deriveStrike`/`derivePressKill`/`execKillByPress`/`deriveRefuge`/`safeStep`/`stepToward`, no `spinnerDanger`/`staticEnemyDanger`, and no `Player.shieldBump`/`chasers.js`/`bobBossFight.js`.

| | |
|---|---|
| Started from | `origin/main` @ `0a8771ad8d` |
| Harness branch | `claude/seedling-swim-u10-step-24-xinqub` (the harness pins it, not `seedling-swim-u10`) |
| Commits | D1 `e6410d3` · D2 `cb75960` · D3 `d091e36` · D4 `6779d4f` · D5 `efe2575`, `be9e25d` (survey row) · this report |
| Dev server | `scripts/serve-nocache.py 8910`, `SEEDLING_PORT=8910`, build `seedling_bot_ap_p4e` |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Step 24 reproduces U7's refusal in 140.1 s. The six `--check`s are on bank. Bounded vitest 9 files / 368. |
| D1 | **PASS** | The kill arm scans around the target. Measured exactly as predicted: 76 leash cells, 17 reachable, 17 refused by the forecast (278 s). |
| D2 | **PASS, with its game witness** | The forecast's punch row prices the dwell. The model reproduces both witness arms on the game: 0 hits at the admitted stance, and the punch at the predicted tick on the control. The ladder now passes, and step 24 refuses at wall 3 byte for byte (470 s). |
| D3 | **PASS for wall 3; step 24 STOPS at a fifth wall** | Wall 3 was a **corpse** (measured): the gate priced a `destroy`ed puncher in its fade. With that fixed, the walk opens both keyType-0 locks and refuses at *"keylock: bosslock@80,656 needs a key"*, a keyType-1 lock (474 s). Steps 22, 23 and 25–30 are byte-identical to U5. |
| D4 | **PASS** | A goal satisfied before it was asked is recognised. All three re-measured cells certify; the sweep goes from 94 to 96 certified. |
| D5 | **PASS** | Log section, bot page, surface GREEN 187, constants PASS 4,623, reference ALL MATCH, bounded vitest 9 / 369. |

**The one thing to know first.** Step 24 is not solved, but none of U7's three walls stands any more. The kill arm kills the puncher; the corpse no longer blocks the gate; both keyType-0 locks open. The walk then stands at tile (26,16) with no planned path to the pit and walks into a **keyType-1** lock (the Green Key, collected at route step 27). From (424,224), just north of the locks, the pit plans fine with no Green Key, so wall 5 is how the walk sees the opened lock row, not the level. I measured it and did not chase it (residue).

## W0: the banked rows (pristine worktree at `0a8771a`)

| Row | Result |
|---|---|
| identity block | maze `246dfbce…` · acceptance `6bbc0273…` · c3 `659d2437…` · c6 `6abcc3d6…` · c4 `fcc6d836…` · ENEMY `f8f24b07…` (= the bank) · guard `a6d18d49…` · AREA `02b22525…` · killgate s2/s5/s9 `997ab4a8…`/`4614c86c…`/`dc17ad46…` · level pre/post s1 `e28c1e5d…`/`c4841acb…` · generated set OK (with the venv) |
| six `--check`s | `410f27c0 b470c14d 17be7d70 9a6a3192 6cd35fe1 2823a811`, all exit 0 |
| campaign census | exit 0, `NO CHAIN ROOM MOVES`, normalised md5 `58f15636…` (the output embeds the tree path) |
| step 24 (`--only=24 --timeout=600`) | REFUSED in 140.1 s, U7's text (*"… kill, chaser arm: no stance derives for puncher@416,256 on level 12: 0 cell(s) inside its 80 px leash, 0 of those reachable …"*); JSON md5 `5a8a68bd…` |
| ENEMY census puncher row | chamber **REFUSED**, corridor **SOLVED 141** |
| corridor-body sweep (post-sword, U3's bounds, 2 shards) | 168 cells, **145 placed / 94 certified**. Three cells read *"walked at totempart … without touching it"*. |
| bounded vitest (the brief's eight paths) | **9 files / 368**, exit 0 |

⚠ The W0 `reference --check` read "4 differ" on the symlinked worktree. Main's own `--check` at HEAD reads ALL 7 + 5 MATCH after D5's regeneration.

## D1: the scan centre (`e6410d3`)

- **Predicted:** 76 leash cells, 17 reachable, 17 refused by the forecast, and the refusal names the target scan.
- **Measured (278.3 s):** *"no stance derives for puncher@416,256 on level 12: the 8-cell box around the player's node held 0 leash cells, so the box around the TARGET was scanned: 76 cell(s) inside its 80 px leash, 17 of those reachable and with a corridor onward, and 17 of THOSE refused by the forecast [(360,280): the WAIT is dangerous at tick 954 …; (376,280): … 924; (392,280): … 924; …]"*
- The fallback runs only when the player's box holds no leash cell. The six `--check`s are byte-identical at D2's head.
- **Mutant (a)** (target scan off, at the full head): U7's text, byte-identical except one clause, the corridor danger's reason. D2's pricing, live in the mutant, now names it *"the punch: …"* instead of *"… pad 8"*. With that clause normalised, the strings are equal (1,754 vs 1,826 chars raw).
- **Unit row: not added (the brief's spec does not fit the shipped tree).** A derivation from L12's far side costs 30–47 s. Asked from a fresh boot rather than the survey's arrival state, it refuses the 17 by *"the preview did not settle"*, not by the forecast's name, and after D2 the survey's derivation finds a stance. The survey row is the measurement.

## D2: the punch, priced by the forecast (`cb75960`)

- **The one field:** `chaserForecastNow` body rows carry `punch: {rect, live, hitsPlayer}` for a class with a `CHASERS[tag].attack` row. It is set on the tick the wind-up ends:
  - `rect` is `puncherPunchRect` at the start-of-tick previewed player;
  - `live` is the `hitsTimer` gate, read after this tick's `hitUpdate`;
  - `hitsPlayer` says whether the punch meets the player.

  It is absent for every other class.
- **The pricing:** `chaserDanger` uses `punch` only in transit with forecast bodies (`perTick`). There it prices the punch and the bare body, with pad 0. The WAIT arm and the live bodies keep `threatPad`.
- **Byte-inertia:** the six `--check`s are on bank at `cb75960`. The roster pins went 157 → 159; tapeRunner is green in the touched-suites run.

### The witness (headless, `--record --only=…`, then U7's per-tick puncher probe)

Authored by `scripts/procgen/plan-seedling-u10-puncher-dwell.mjs` (has `--check`). Both arms stand with a sword and hold the kill arm's own preview keys (`previewWalk` with the strike policy and a standing tail).

| arm | stance | model (predicted before recording) | game |
|---|---|---|---|
| `u10-puncher-dwell` (200 t) | (392,280) | the forecast admits it; the **pad refuses it at t45**; presses land t14/47/80; puncher removed by t124; player hits **0** | **THE MODEL REPRODUCES THE RECORDING — 201 observations**; game `hits` 0; probe: 201 samples, shift [0], **123 puncher comparisons agree** (worst \|Δ\| 2.8e-17) |
| `u10-puncher-dwell-refused` (34 t) | (400,248) | the forecast refuses it by **the punch at t34**; the player is punched at t34 | reproduces all 35 observations; game `hits` 1; probe: 35 comparisons agree (worst 1.1e-16) |

Choosing the arms was a scan over 40 cells in the leash with sword and strikes. In every cell, the driven model agreed with the forecast's first-danger tick: the 15 admitted cells all took 0 hits, and every refused cell took its first hit at the forecast tick.

⚠ **The control's first recording (50 ticks) exposed a model gap, outside this slice.** The preview's next press falls on the punch's own tick. The model swung it west (`slashPresses` direction 2); the game swung it east and landed a hit, so from t36 the game's puncher reads `hits 2` against the model's 1. Positions stayed bit-exact. This is the player's facing after a knockback, a Player-model question. The arm now ends on the punch's tick, and the gap is in the residue.

- **The 17 stances' verdicts under D2** (from the survey's own record): **1 qualified**, (376,248), with a predicted death at derivation tick 1008. U7's static pad had refused all 17.
- **Step 24 with D2 (470.0 s):** *"keylock stance (bosslock@432,240): the danger map forbids (377.33707798757996,251.97557486687154) — chaser:puncher@416,256 (inside leash 80 (d=7.9), box grown 1 px/tick x 0 + pad 8). Slice 2 has NO DODGE POLICY …"*. This is U7's wall 3.
- **Mutant (b)** (punch pricing off): the D1 refusal, **byte-identical** (row md5 `654f3100` in both).

## D3: wall 3 was a corpse (`d091e36`)

**What the brief assumed, and what was measured.** The brief assumed the gate priced a live padded body that the ladder had already priced away. A file-sink probe at `refuseDanger` read the state at the refusal (t1812):

- `run.chasers` held `puncher@416,256` at (379.3,260.1) with `hits 3`, `dying: true`, `destroy: true`, `alpha 1`;
- `strikeBodies` was `[]`;
- `chaserKills` held `{t: 1781, by: 'press'}`;
- the kill record was `arm: 'chaser'`, stance (376,248), `ticks 109`, `strikes 3`.

The dwell ends when the body leaves `strikeBodies`, which drops `destroy` (31 ticks after the blow). `run.chasers` keeps the body through the fade, and the next gate prices the fading corpse with the pad.

**The fix:** `chaserDanger` skips a body with `destroy` set. `Enemy.update` runs `hitUpdate(); hitPlayer();` only `if (!destroy)`, and `play("die")` replaced any wind-up. `levelRun`'s stepper already bills nothing for such a body. `dying` alone is still priced. The witness is `u7-puncher-kill`: its corpse stands at the player's side through the fade, and game `hits` stays 0. This is narrower than the brief's "the decision gate reads the forecast": nothing about a live body changes.

- **Predicted:** step 24 SOLVED in about 2,600 ticks (2,300–3,000).
- **Measured: REFUSED in 473.6 s at a fifth wall:** *"reach-pit (36,43)->L21 -> keylock: bosslock@80,656 needs a key this run does not hold. The key is a SUB-ORDER — a `collect-placement` goal the macro layer owes …"* (`CC/docs/cloud-reports/seedling-swim-u10-survey.json`).

**The strategy the ladder chose before wall 5:** KILL, chaser arm. The puncher was killed by three presses from (376,248), billed at t1781 and removed. Then the keylock verb opened `bosslock@432,240`, and then `@416,240`.

**Wall 5, measured** (two file-sink probes, at `execKeylock`'s refusal and in `identifyAndSelect`):

| t | position (tile) | `planWaypoints` to (584,696) | frontier head(s) |
|---|---|---|---|
| 1947 | (440.6,258.1), (27,16) | different components | `bosslock@416,240`, `bosslock@80,656`, … |
| 2048 | (423.7,258.1), (26,16) | different components | `bosslock@80,656` (keyType 1), `bosslock@112,192` (4), … |

At t2048:

- `openActivators` is `[bosslock@416,240, bosslock@432,240, shieldlocknorm@288,704]`;
- `keys` is `[0]`;
- `chasers` is `[]`.

Out of the survey, from a fresh run booted at (424,224), north of the lock row, `planWaypoints` reaches each of the pit's four neighbour tiles in 6–9 waypoints, with no Green Key. So the level admits the route. What fails is the walk's planning across the opened lock row at (26–27,15). I did not establish why. My out-of-survey attempt to open a lock by hand did not open it, so the cause is unmeasured. That is the next slice's first question.

- **Steps 22, 23 and 25–30** (`--only=22,23,25,26,27,28,29,30 --timeout=600`): 8/8 SOLVED 48 / 229 / 26 / 89 / 383 / 336 / 210 / 1056. Every row is **byte-identical to U5's JSON** in all fields but `ms`.
- **Mutant (c)** (corpse skip off): wall 3's text, **byte-identical** (row md5 `1481562f`, the same as D2's measurement).
- **Timeout:** step 24 ran with `--timeout=1500` in every D3 run. The solve takes 470 s, over the default 600 s's margin under load (four jobs on four cores).

## D4: the goal collected in passing (`6779d4f`)

The goal loop's `collect-placement` branch asks `run.progress('takenPickups')` twice: before the stance, and after the walk to it but before the stance's danger gate. If the pickup is already taken, it records `{goal: 'collect-placement', strategy: 'collect', arm: 'collected-in-passing', pickup, item, collectedAt, why}` and goes on to the next goal. `certifyCollects` reads `pickup.x/y`, so it certifies the goal. `runCollect` itself is unchanged.

**Re-measured on main.** U6's four cells (`empty` 10x10 s10, `branchy` 10x10 s2/s9, `rooms` 10x10 s9) were measured on U6's tree. On main, `empty` 10x10 s10 certifies at W0 already. The full sweep names three cells instead:

| cell | W0 | head | mutant (d), 600 s budget |
|---|---|---|---|
| `empty` 10x10 s9 | *"walked at totempart@32,96 for 400 ticks without touching it; stalled at (39.73,103.55)"* | **certified** | same text as W0 |
| `empty` 14x14 s5 | *"… totempart@64,64 …"* | TIMEOUT at 120 s in the sweep; **certified alone in 172 s** (`--cellbudget=600`) | same text as W0 |
| `open` 14x14 s3 | *"… totempart@32,96 …"* | **certified** | same text as W0 |

| corridor-body sweep | W0 | head |
|---|---|---|
| cells | 168 | 168 |
| placed | 145 | 144 (one cell becomes a harness TIMEOUT) |
| certified | **94** | **96** |
| *"without touching"* | 3 | **0** |
| ladder EXHAUSTED | 25 | 25 |
| *"the danger map forbids"* | 8 | 8 |
| `the-solver-cannot-cross-the-roaming-body` (gap only) | 14 | 14 |
| strike-schedule bound | 1 | 1 |
| TIMEOUT | 1 | 2 |

Only those three cells moved; the per-cell diff is empty elsewhere.

- **Prediction:** I did not write one before the sweep. The brief's *"144/93?"* was U4b's figure, and main already read 145 / 94.
- **Unit row:** `solverBot.test.js` *"a collect goal whose pickup is already taken is met in passing, not re-walked"*: r8-solve-10 with the sword's placement asked twice.
- **Mutant (d)** (check off): the unit row goes red with *"walked at sword@48,48 for 400 ticks without touching it"*, and the three sweep cells return to W0's text with the same stall coordinates. The copy was restored md5-identical (`bed9ed01…`).

## Surface, constants and reference deltas

- **Solver surface:** 187 → 187 rows, `--check` GREEN. Line numbers move, and `import:levelWorld.js#rectsOverlap` goes from 22 to 23 sites (`dangerMap.js` 9 → 10). No new facade export and no new run member: D4 reads `run.progress('takenPickups')` and `run.ledger('collected')`, both already on the surface.
- **Constants census:** 4,620 → 4,623 literals, PASS. The three new literals are the forecast punch's `hitsTimer` gate (`levelRun.js|step|ha550babb|0|{0,1,2}`), classified `rule` in `seedling-constants-fields.csv`. I checked the census for unclassified rows: the two hits on the word are pre-existing source text.
- **Reference:** regenerated (`generate-procgen-reference.mjs`). It covers the docs index, the instruments table (the new plan script), and the architecture word counts. `--check` ALL 7 + 5 MATCH. `generate-tape-index.mjs` re-emitted the index at 159 tapes.

## What the brief got wrong (measured)

1. **"the chaser FORECAST's punch rows are already there".** They were not. U7's D2 stepped the wind-up in the forecast but reported no punch ("⛔ No punch is thrown … the danger map prices the reach as `threatPad`"). The one field D2 adds is that report. It is in `levelRun.js` (the simulation file), as the brief's single-getter exception allows, and it is byte-neutral: the six `--check`s and tapeRunner are unmoved.
2. **Wall 3 is not "the decision gate's pad on LIVE bodies".** It is the pad on a corpse whose fade is running (D3 above).
3. **Step 24's predicted SOLVED.** It refuses at a fifth wall, a keyType-1 lock (D3).
4. **"the three roster-count pins (158 with the witness)".** The witness has two arms, so the count is 159. The exposure ledger goes from 19 to 21.
5. **U6's four D4 cells.** On main they are three different cells (D4).
6. **"`botDriverV2.js:4772`".** `runCollect` is at `:4776` on main. D4 lives in the goal loop, not in `runCollect`.

## Residue

- **Wall 5 (step 24):** after both keyType-0 locks open, the walk at tile (26,16) has no planned component path to the pit. Its frontier then names the keyType-1 `bosslock@80,656`. A fresh boot north of the lock row plans fine. First question: the planner's view of the opened locks' row 15 at t2048 (fade state, `liveGeometryOpts`, or the tile under the player).
- **The player's facing after a knockback** (found by the D2 control's first recording, `/tmp`-only evidence): a press on the knockback's own tick swings west in the model and east in the game. This is a Player-model question, U9's neighbourhood. The committed control stops before it.
- **The D1 unit row** the brief asked for is not built (see D1).
- **`standing-values.json`** is not rewritten, per the rules. Its ENEMY, c3, c6 and c4 rows are now stale against this head (see below).
- **Scratch instruments** (session scratchpad): `explore.mjs` (the 40-cell stance scan), `refused.mjs`, `d1unit.mjs`, `w5.mjs`, `norm.mjs`, `sum.mjs`, `diffcells.mjs`, `six.sh`, `sweep.sh`.

## Byte-inertia

| Artifact | W0 (`0a8771a`) | AFTER (`6779d4f` code = HEAD code) |
|---|---|---|
| maze / acceptance / guard / AREA / killgate s2,s5,s9 / level pre,post s1 | as W0 above | **identical** |
| generated set | OK | OK |
| **ENEMY census** | `f8f24b07…` | **`212b22e6…`**: one table row, puncher chamber **REFUSED → SOLVED 166** (U7's change-2 number); the CHAMBER tally goes from 20/4/2 to 21/3/2 (solved/refused/threw). This is D2+D3's move, already `212b22e6` at the D3 head. |
| **empty pairs c3** | `659d2437…` | **`385f5f3d…`**: one line, `empty post-feather seed 9` (attempts 3 → 7, ticks 74→74 → 766→607). D4's move; at the D3 head the row equals W0. |
| **empty pairs c6** | `6abcc3d6…` | **`20d07551…`**: the same cell, `empty post-feather seed 9` (attempts 6 → 13). |
| **carved pairs c4** | `fcc6d836…` | **`26f2232f…`**: two lines, `winding post-shield seed 2` (SATURATED → TARGET_REACHED) and `rooms post-feather seed 9` (same `kept`, different level). D4's move; at the D3 head c4 equals W0. |
| six `--check`s | `410f27c0 b470c14d 17be7d70 9a6a3192 6cd35fe1 2823a811`, exit 0 | **identical** at D2, D3 and D4, exit 0 |
| campaign census | exit 0, NO CHAIN ROOM MOVES, normalised `58f15636…` | **identical** |
| survey steps 22, 23, 25–30 | U5's JSON (`0351288c…`) | **row-identical** (all fields but `ms`) |
| survey step 24 | REFUSED 140 s (U7's text) | REFUSED 474 s (wall 5) |
| tapeRunner / roster | 157 tapes | 159 tapes (+ the two witnesses), green |
| bounded vitest (the brief's eight paths) | 9 / 368 | 9 / 369 (+ touched suites 7 / 812) |
| reference `--check` | — | ALL 7 + 5 MATCH (main tree) |
| `fixtures/**` | — | **the witnesses only**: `tapes/u10-puncher-dwell.json` `1458edf0…`, `tapes/u10-puncher-dwell-refused.json` `39698639…`, `expectations/u10-puncher-dwell.json` `c3dd45de…`, `expectations/u10-puncher-dwell-refused.json` `0d14de04…`, and `tapes/index.json` regenerated. `campaign-frontier.json` is untouched. |

**Why the D4 movers move.** Generating a level runs the certify solve, and U8's fold puts `corridorbody` in every post-sword-and-later default. Each moved row is a post-shield or post-feather draw whose certify solve passed a collect it had refused before, so the generator kept a different level.

None of the following was touched or run: AS3, wasm, gitlinks, committed tapes (other than the two new witnesses), biome defaults, `standing-values --write`, `pytest`, unfiltered vitest. No U6b or U9 region was edited.
