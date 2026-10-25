# Seedling fidelity L40BK2 — L40's Boss Key 2 chain: a weigh's holder derived under the rest of the stance hypothesis (`weighHypothesisChain`); leg 368's struck spinner priced where the walk's strike left it (`dashSpinnerForecast`, ⛓ hammer hand-over 368) — both OFF

| | |
|---|---|
| Session | `seedling-fidelity-l40bk2` (planner `seedling-fidelity-planning-13`, wave 31) |
| Start SHA | `89da08f355` (`fidelity-harvest/w30` = main `cfc681a566` + W30, 77 default-ON keys; not rebased) |
| Code head | `e5840ab2`; docs `55ed5aee` (CI green, below); evidence and this report are the commits after it |
| Harness branch | `claude/seedling-l40bk2-chain-myrvu9` (nothing pushed elsewhere) |
| Port | 9736 (main tree), 9737 (the base worktree), 8000 (the probe battery, which ignores `SEEDLING_PORT`) |
| Verdicts | **W0 PASS · D1 PASS behind `weighHypothesisChain` (the chain's first refusal fixed; the arrival legs then STOP at D3's hammer death; links 4–9 game-witnessed at 0 px) · D2 PASS behind `dashSpinnerForecast` (no certified 368 plan takes a hit across a 17-seam census) · D3 MEASURE + STOP (hand-over) · Movers: STOP for a licence** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-l40bk2-evidence/` |

## The one thing to know first

**The Boss Key 2 chain's first refusal was guard (iii) asking its holders of the world as it is, and with that fixed the
leg's real blocker is the hammer arc's.** Both holders exist and are reachable *under the hypothesis itself*:
- t2's holder (`iceturret@472,400`'s corpse) has its first stance behind the latched south door;
- t5's holder (`pushableblockfire@480,480`) needs FIREMOVE's 35-press route across t2.

With `weighHypothesisChain` ON, survey step 67 and legs 869/870 get past `button@816,400` and walk the south door's links
(chest, tree, latch). They then die in `kill (spinner@880,848) by press`: three hits from `chaser bob@736,752`, then
PRESS_KILL_REBOOT_GUARD. That is `execKillByPress`, so D3 hands it over.

From inside the lock room the solver builds links 4–9 itself, at the defaults already:
- the Sword's circling kill;
- the corpse on t2;
- the 35 presses onto t5;
- the hold on `button@816,400`;
- the pulser's push.

The game reproduces those ticks at 0 px, and the player is never hit (`l40bk2-pocket-chain`).

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `git checkout -B claude/seedling-l40bk2-chain-myrvu9 89da08f355` (the harness branch fast-forwarded; it had no commits of its own); `session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9737 bash scripts/procgen/identity-block.sh .` in a pristine detached worktree of the base, venv active (`evidence/identity-w0.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `7e1497c4`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5` |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `a591fa9d` · l18 `6460d60d` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `27478177`, all exit 0 |
| generated set / reference | in the block | generated set not run (the venv's Playwright 1.56 vs the 1.63 pin, environmental); reference 4 DIFFER in the worktree (its symlinked submodules), ALL MATCH in the main tree |
| surface / constants / entities / profile | each `--check` (`evidence/censuses-w0.txt`) | GREEN **353** · PASS **6,938** · PASS **566** · PASS **138** |
| roster | `fixtures/tapes/index.json` | **289** |
| tapeRunner pairs | sorted `status\tfullName` (`evidence/tape-runner-pairs-w0.txt`) | **635**, md5 **`88fc7df4dd05d11dfd84ebbea675cc8e`** |
| bounded vitest BEFORE | 110 files (`evidence/vitest-files.txt`: the brief's list — no `apReportBosses.test.js` exists — + every test naming the functions and fields touched), in the base worktree (`evidence/rows-before.txt`) | **2,762 / 2,762**, rows md5 `79a44045ac8866ac52323109c8c207b3` |
| `fidelityL32ArenaPrefix.slow` | `vitest -c vitest.slow.config.js` | 5 / 5 |

⚠ The killgate, acceptance and three `--check` md5s differ from FIREPUSH/CORPSEBUMP's: the base moved (W30 + main), and
acceptance is box-dependent. Every comparison below is base against head on this box.

**W0 — the first refusal in the chain, captured and replayed.** Legs 869/870 are **ids 859/860** at this base (keys
`level_40__r32c36 <- in_L39_144_0 ~> level_40__r23c29 -> location:Level 040 - Boss Key 2` and the same `<- in_L43_176_464`).
Captured locally (`probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --capture-requests`, p4g, seams 5173 /
5151) and replayed in node (one answer each, `e9460b8a0f8e` / `725d425c10b9`). Survey step 67 is the same room at this base
(241 steps). All three answer, at the 77 defaults:

> no REACHABLE stance inside button@816,400 … ⛔ AND THE PREREQUISITES WERE TRIED AND REFUSED, one at a time:
> wandlock@448,432 — its group t=2 publishes only while a Solid sits on button@480,384, and NO block in this room can reach
> it …; wandlock@512,480 — (the same); wandlock@800,400 — its group t=5 … button@768,400 …; bosslock@480,352 …

**The first refusal is guard (iii)** (`stanceHypothesis`), not a stance or a route. It asks each `weigh` holder of the world
as it is:
- `deriveCorpseWeigh` refuses t2's corpse because its first press stance "plans no corridor from (488,904)": it is inside
  the lock room, behind the south door `wandlock@480,560`, which *is* in the hypothesis (`hold`; `buttonroom@880,768`
  latches);
- the fire block's route onto t5 then crosses `wandlock@512,480` {t 2}, which the live world has shut.

## D1 — the chain (PASS behind `weighHypothesisChain`, OFF)

`contactFidelity.js`: `weighHypothesisChain: false` (`SEEDLING_WEIGH_HYPOTHESIS_CHAIN=0|1`).

**The change, link by link, each found by the refusal of the one before:**
1. **`chainWeighHypothesis`** (solverBot). Guard (iii)'s refused holders are asked again under the bag with the hypothesis
   discharged (`bagWithDischarged`, the volumes exempted as `stanceReaches` exempts them), to a fixed point. A corpse
   holder's turret volume rides on its entry as an `exempt` field: the fire route's four far-side stances sit in the live
   turret's census rect ("not floor" without it; FIREMOVE's measured contact).
   - To carry the bag, `deriveWeigh`, `weighFireBlock`, `deriveBlockRoute`, `deriveCorpseWeigh` and `deriveWeighSource`
     take an optional `liveBag`. Absent, every call is the bytes it was.
2. **The admissions ride beside the hypothesis, lazily** (`stanceHypothesis(...).chained`, a non-enumerable getter). Only
   `deriveHoldStance` reads them, once every candidate has failed directly and under the hypothesis. The first cut put them
   IN the hypothesis, and the bounded set ON measured two defects (fixed in `e5840ab2`):
   - (a) on L40BUTTON's cluster boot, the route search under the hypothesis bag hit `MAX_ROUTE_EXPANSIONS`, and the throw
     refused the whole solve from inside guard (iii). A bound hit is now "not admitted";
   - (b) leg 368 (the north arrival) lost its 1558 t plan. The eager chain's route searches spent **576 of the dashless
     pass's 640 work units** (185 OFF), so the full pass was cut at the block-route deadline; and the admitted entries had
     left guard (iii)'s `walls`, which `sealedBehindWall` reads.
   - Now the hypothesis and its walls are OFF's exactly, and leg 368 ON = OFF (574 units, plan `32f29414cd8e`).
3. **`nextPastUnbound`** (`walkTo`'s frontier). The walk to `button@816,400`'s stance (824,408) names
   `pushableblockfire@576,576` nearest the aim. Its only mover is the pulser that very hold publishes, so the round refused
   *"Strategy 'shove' failed to apply"* with the doors the derivation leaned on never asked. ON: the L12KEYLINE/L40RES shape.
   The rest of the actionable frontier is tried in its own order; the first entry whose strategy resolves (and is not this
   walk again) is this round's order. It is asked before guard (ii) demotes the failed order to a wall.
4. **`SolverRefusal.equips`** (`solveSegment`'s `refuse`, key ON only). Without it a refused prefix that selected the Fire
   slot does not replay: the presses become swings.

**ON, from the arrival (step 67; `fidelityL40Bk2` row):**

> … -> shove stance (pushableblockfire@576,576) -> hold stance (wandlock@448,432) -> chest stance (chest@880,816) -> kill
> (spinner@880,848) by press: the player died at t780 (chaser bob@736,752) … PRESS_KILL_REBOOT_GUARD

That is one link deeper and is D3's. The L43 arrival (leg 870) takes the same door (same room region, same chain).

**The rest of the chain is the solver's own from inside the lock room.**
- The boot is `prox-l40-turret-volley`'s committed header (L40 (480,456), the pocket; no shield, no Ghost Sword).
- The solver plans 2,650 ticks: the circling kill, two bumps (the corpse on t2), the 35 Fire presses onto t5 (FIREPUSH_ROUTE),
  the walk to (824,408), and the hold that publishes `pulser@592,576`.
- It then refuses at the walk back to the walk block's stance. In this staging the south door was never opened (its latch
  is links 1–3), so the only corridor goes west past `bob@352,416`. That is a staging fact, not a model gap.
- This plan is the same with the key OFF: the base solver already builds links 4–9 once it stands inside the room.

**Witness `l40bk2-pocket-chain`** (p4g `seedling_bot_ap_p4g`, headless logic-only; `probe-seedling-l40bk2.mjs --record`). The
tape is the ticks that refusal spent, with its `equips`, folded onto the boot header.

| check (`evidence/probe-record.txt`) | result |
|---|---|
| the model (D1 ON) replays the tape to its end | PASS |
| the game reproduces the model at 0 px — the player, every block, every chaser, the turret — on every sampled tick | **PASS, 2,643 of 2,650 ticks** (the re-check `--from-fixture`: 2,647) |
| OFF, the model parts from the game on | 0 ticks (D1 is solver-only) |
| the corpse rests on `button@480,384` {t 2} and stays | PASS, from t289 |
| `pushableblockfire@480,480` rests on `button@768,400` {t 5} and stays | PASS, from t2486 |
| `pushableblockfire@576,576` is pushed west toward the pocket by the pulser | PASS, leaves (576,576) at t2619; x 560.5 at t2649 (the prefix ends one tick short of (560,576)) |
| the game never hits the player | PASS |
| the player ends on the hold stance | PASS (824.53, 407.01) |

**Rows** (`fidelityL40Bk2.test.js`):
- the switches ship OFF;
- OFF, guard (iii) walls the three locks; ON, the probe lists them (`weigh`);
- OFF, step 67's sweep text;
- ON, the chain's press-kill end;
- the recording's checks, and the model at 0 px with D1 ON and OFF.

`fidelityL40Bk2.slow.test.js` re-solves the pocket and checks that the recorded tape is the solver's plan, input for input
(263 s; passed at `28ee2375` and again at `e5840ab2`).

## D2 — leg 368's hit-aware dash certificate (PASS behind `dashSpinnerForecast`, OFF; ⛓ hammer hand-over 368)

`contactFidelity.js`: `dashSpinnerForecast: false` (`SEEDLING_DASH_SPINNER_FORECAST=0|1`). Licensed by hammer-2
(2026-10-25); every hunk is docblocked `⛓ hammer hand-over 368`. Hammer-2 reviews at harvest.

**Reproduced at this base** (leg 368 captured at seam 5280; `fixtures/l40bk2-witness/leg368-request.jsonl.gz` carries L40's
records only, and the answer is byte-identical to the full set's; the committed atlas answers differently, so the records
are needed). At seam 5290 the plan is 1600 t (`1da60bcb4c0d`) and the model replay takes `spinner-hammer spinner@192,144` at
**t1222**: L40RES's hit, which the game confirmed to the bit.

**The change:**
- **`previewWalk`** creates the hammer arc's `run.spinnerFightForecast()` cursor (a strike policy, a room with spinners)
  and advances it once per previewed tick (transit, stall and tail alike) with the PRE-move player and the tick's press
  (`combatBefore`'s `STRIKE_PRESS`). Each sample carries `sample.spinners = {rects, ids, bodyGated}`.
- **`dangerMap.spinnerDanger(run, box, horizon, walkRow)`** reads that row BY ID; `dangerAt`'s `walkSpinners` and
  `dangerDuringTransit`'s ninth argument pass it, in transit mode only. `probeSamples` hands `s.spinners`.
- **Cursor exactness, measured** (`evidence/cursorcheck.txt`): driving the 5290 plan in the model from t1179 with the
  driven presses, the cursor's rows track the live spinners to a constant 0.707 px (the comparison's origin offset).

**Two findings came out of the census, and each is a model reading, not a tuning:**
1. **The body arm needs `Enemy.hitPlayer`'s gate.** `hitUpdate()` decrements `hitsTimer`, then `hitPlayer()` fires only if
   `!destroy && hitsTimer <= 0` (`Enemy.as:104-110,211-221`), inside the spinner's own update, which runs before the
   player's sword test of the same frame. The drive of seam 5280's hitless plan overlaps the struck spinner's 7x7 body at
   t1225 (timer 10) and is not hit. The gate is the PREVIOUS row's timer, decremented, and its `destroy`.
   (`spinnerDanger`'s press-blind path never needed it: it never put a struck body beside the player.)
2. **A window-by-window dash admission refuses a chain a later window resolves.** At 5280 the prefix 1180/1182/1188/1200
   meets `spinner@192,144` at t1228, but the drive's fifth press (1216) turns it, and that walk is hitless. That is CORRIDOR
   D2's shape, one family over. So `spinnerDashWhole` plans the chain press-blind (each sample's row set aside) and
   certifies the WHOLE dashed walk with the rows. A chain that fails whole is planned again window by window with the rows.

**Acceptance — a 17-seam census** (5276–5310; `evidence/seam368-{off,on}.txt`; plan and model hits per seam):

| seams | OFF | ON |
|---|---|---|
| 5276, 5278, 5280, 5282, 5284, 5286 | SOLVED 1558 t `32f29414cd8e`, 0 hits | **the same plan**, 0 hits |
| 5305 / 5310 | SOLVED 1583 t `d24f1e7a1150` / 1558 t, 0 hits | **the same plans** |
| 5288, 5293 | SOLVED 1584 t, **hit t1225** (`spinner@192,144`) | REFUSED (the bomb-pusher hold, `32c7b7f741a3`) |
| 5290, 5291, 5292 | SOLVED 1600 t, **hit t1222** | REFUSED (the same) |
| 5289, 5295 | REFUSED (the shake band) | REFUSED (the bomb-pusher hold) |
| 5298, 5300 | REFUSED (the bomb-pusher hold, `1ce1955d012a`) | the same |

**No certified plan takes a hit ON, and no hitless OFF plan is lost.** Every hit OFF plan is refused downstream. That is
not D2's refusal: it is the bomb-pusher hold at (168,136), FIREMOVE's same answer at other seams (`1ce1955d012a`), which the
walk now reaches one tick earlier. A plan for those seams is past that hold, which is not this slice's region.

The model hits the game confirmed were L40RES's (seam 5290, `l40res-368-s5290`). The ON plans at the hitless seams are byte
for byte the OFF plans, so their certificate changed nothing to witness. I did not record a new game witness for D2.

**Rows** (`fidelityL40Bk2.test.js`):
- the capture's key and seam;
- OFF 5290 hits at t1222;
- ON 5290 refuses (no hit plan);
- ON 5280 = OFF 5280 byte for byte.

## D3 — the `spinner@880,848` press-kill death (MEASURE + STOP: hand-over)

- **Legs 387/404 at this base never reach it.** On a 9-seam census each (5165–5173 / 5158–5166; `evidence/census-{387,404}-
  {off,on}.log`) they refuse at the chest approach's combat ladder (`chaser bob@736,800`, spinner danger at (888,852)) or on
  the camera-shake band (404, t690/691). D2 ON answers OFF on every seam, byte for byte. The brief's "387/404 refuse at the
  press kill both ways" no longer holds at this base.
- **The death is reached by the chain's walk** (step 93 with `stanceReentryNextDoor`, L40RES's row: t780; step 67 with D1 ON:
  t780 in node, t766 in the survey's two-pass solve). Replayed in the model (`evidence/d3-death.txt`): the press kill walks
  the x≈744 corridor and takes **three hits, all `chaser bob@736,752`** (t660, t749, t780), with `bob@736,800` close by. None
  is a spinner's.
- **So the fix is not in the forecast.** D2's licence does not cover it, and `execKillByPress` is untouched.

## Mutants (predicted first; copy + edit + run + restore in a head worktree; `evidence/mutants.txt`, `mutants.py`)

| | mutant | predicted red | measured |
|---|---|---|---|
| m1 | `chainWeighHypothesis` admits nothing | ON hypothesis row, ON chain row | exactly those 2 (both runs) |
| m2 | `stanceReaches` drops an entry's `exempt` | ON chain row | exactly that (both runs) |
| m3 | `nextPastUnbound` returns null | ON chain row | exactly that (both runs) |
| m7 | no chained fallback in `deriveHoldStance` | ON chain row | exactly that |
| m4 | `spinRow` attaches no rows | ON 5290 | exactly that |
| m5 | `bodyGated` always false | ON 5280 | exactly that |
| m6 | no whole-chain certificate (rows window by window only) | ON 5280 | exactly that |

## The movers: before → after, and the dispatches to confirm

**Route survey, full** (local, `survey-seedling-route.mjs --through=end --route=full`; arm A = the 77 defaults, arm B = A +
both keys by env; `evidence/survey-full-{A,B}.rows.txt`). 241 rows. A: SOLVED 188 / REFUSED 52 / TIMEOUT 1. B: SOLVED 189 /
REFUSED 52. **2 rows differ:**
- **step 67 (L40, Boss Key 2): REFUSED → REFUSED, deeper.** `no REACHABLE stance inside button@816,400` → the chain's
  `kill (spinner@880,848) by press: the player died at t766 … PRESS_KILL_REBOOT_GUARD`.
- **step 150 (L69): TIMEOUT → SOLVED 826 t.** Noise: arm A alone solves it, 826 t (`evidence/survey-A-150.txt`); FIREPUSH's
  and CORPSEBUMP's same row.
- The first B arm (at `28ee2375`) also moved L39's four visits (66/94/135/155), by a suffix I had added to guard (iii)'s
  wall sentence. It was dropped at `39f4415f`, and the re-check matches A.

SWEEP_SECTION

PROBES_SECTION

**Bounded vitest, both keys ON** (env; 111 files at `e5840ab2`; `evidence/rows-on.txt`): 2,768 / 2,776 (1 skipped). By key
(each key alone, `evidence/rows-on-{d1,d2}.txt`):
- **D1** — three CONTROLS pinned on guard (iii)'s old walls. A flip owes each a re-pin:
  1. `fidelityFirePush.test.js > OFF: the frontier names the fire block and refuses "Strategy 'shove' failed to apply" (legs
     869/870's answer)`. ON, the round passes to the next door;
  2. `fidelityL40Button.test.js > OFF the hypothesis at leg 378's arrival …` (the probe now lists t2/t5);
  3. `fidelityL40Res.test.js > the measurement behind it: the south door is in the stance hypothesis, the west door is not`
     (the west door is now a chained `weigh`).

  (L40BUTTON's `cluster's own boot` row was red at `28ee2375` from the bound throw, and is green since `e5840ab2`.)
- **D2:**
  1. `procgenRoam.test.js > the BODY ABLATION (D5) rooms s10 post-sword: COSTS` → INERT. The generated room's walk with its
     bodies is no longer 32 ticks longer than without them: the struck spinners are priced where they are.
  2. `solveProgress.test.js` × 3 (L18 hammer room, residue 21). The answer is unchanged (`ok`), but its asks, work and
     snapshot count are pinned bytes (1594 vs 1593 snapshots). These are re-pins, and they are the hammer arc's rows.

  The `STACK_TRACE_ERROR`s seen in the per-key runs were the long rows timing out under the parallel load; they pass alone.

**Please run, on `claude/seedling-l40bk2-chain-myrvu9`** (head after this report):
1. **Survey full:** `seedling-survey.yml` with `through=end route=full`. Arm A `contact_fidelity=` the 77 keys of
   `evidence/arm-A.txt`; arm B the 79 of `evidence/arm-B.txt`. Compare against 39496129402 by (level, goal, boot).
   Expected: step 67 REFUSED → REFUSED (the press-kill death); everything else equal but timeouts.
2. **Keyed sweep ×2:** `seedling-divergence-sweep.yml` with `keys=` the 52 keys of `evidence/l40bk2-leg-keys.txt`
   (`|`-separated), `capture_requests=true`, arms A/B as above, and `seam_census=-3..3` for legs 368/371/387/404 and
   859/860. Expected: 859/860's refusal text moves deeper; 0 verdicts by key (368 at a hitting seam may go done → failed,
   which is D2's intent).
3. **Probes:** `seedling-probe.yml battery=standard` with arm B; then a `seedling-probe.yml` run of
   `probe-seedling-l40bk2.mjs --from-fixture` (0 px expected).

## What the JS arc must wire / pins that move

- **No contract change.** `solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging` are untouched; there is
  no new `SolverRefusal.obstacle.kind`.
- **New OPTIONAL fields:**
  - `SolverRefusal.equips` (a refusal from `solveSegment`'s own `refuse`, D1 ON only): the slot selections, as
    `out.equips`;
  - a `previewWalk` sample's `spinners` (D2 ON only);
  - a stance-hypothesis entry's `exempt` and the hypothesis array's non-enumerable `chained` (D1 ON only).
- **New optional arguments** (absent = the bytes they were):
  - `deriveWeigh`/`deriveBlockRoute`/`deriveCorpseWeigh`/`deriveWeighSource`'s `liveBag`;
  - `dangerDuringTransit`'s ninth argument, `dangerAt`'s `walkSpinners`, `spinnerDanger`'s `walkRow`.
- **Run state:** none added, renamed or reshaped. No per-visit map, so no `DIGEST_EXEMPT` row is owed, and
  `stateDigestParts` is untouched. The skin renderer reads nothing new.
- **The walker:** `botDriverV2.drive`/`chooseHeld`/`hasArrived`/`driveStepHeld` are untouched, so no `producer:walker` row
  can move.
- **Pins:** the flashPanel settings rows `seedlingContactWeighHypothesisChain` and `seedlingContactDashSpinnerForecast` (derived
  from `CONTACT_FIDELITY_KEYS`, +2 rows); `contactFidelity.test.js`'s defaults table gains the two OFF keys.

## Hand-overs

- **Hammer arc (D3):** `kill (spinner@880,848) by press` walks the x≈744 corridor into `chaser bob@736,752` (hits t660,
  t749, t780 → death, the reboot guard) — reached by step 67 (D1 ON) and step 93 (L40RES). The press kill's walk does not
  price the chasers beside the spinner's corridor. Measurement: `evidence/d3-death.txt`; boot
  `fixtures/l40bk2-witness/step67-boot.json`. It is the last thing between legs 869/870 and the S-door latch.
- **Hammer arc (D2 review):** the `⛓ hammer hand-over 368` hunks (`previewWalk`'s cursor, `spinnerDashWhole`,
  `spinnerDanger`'s `walkRow` with the body gate). The D2 flip moves three `solveProgress` L18 byte pins (the answer holds).
- **To the planner:** after D3, the chain's remaining unmeasured link is the S-door latch hold on `buttonroom@880,768`. From a
  staging on the latch (the chest and the tree banked), `bobsoldier@880,832` lands its sword on a still player at t79 and
  kills it by t125, and `runHold` refuses "hold tick 84 of 131 MOVED". So the hold needs that chaser handled first.
- **Leg 368's next blocker** (ON, at the seams OFF hit): the bomb-pusher hold at (168,136) (`bombpusher@112,128`), FIREMOVE's
  noise answer.

## Deltas

- `contactFidelity.js` (+ test): the two keys (OFF) and their env lines.
- `solverBot.js`:
  - D1: `chainWeighHypothesis`, `stanceHypothesis`'s `chained`, `deriveHoldStance`'s fallback, `stanceReaches`' entry
    `exempt`, `nextPastUnbound` and its call, the `liveBag` options, `refuse`'s `equips`, `stanceHypothesisProbe`;
  - D2: `previewWalk`'s cursor and `spinRow`, `probeSamples`' `s.spinners`, `spinnerDashWhole` and its call.
- `dangerMap.js`: `spinnerDanger`'s `walkRow` and body gate, `dangerAt`'s `walkSpinners`, `dangerDuringTransit`'s argument.
- New files:
  - `fidelityL40Bk2.js` (+ `.test.js`, `.slow.test.js`);
  - `probe-seedling-l40bk2.mjs` (box-lock roster row in `boxLock.test.js`);
  - `fixtures/l40bk2-witness/`: `step67-boot.json`, `l40bk2-pocket-chain.json`, `leg368-request.jsonl.gz`.
- Censuses: surface **353 GREEN** (re-sealed: read sites only), constants 6,938 PASS, entities 566, profile 138, roster 289.
- Docs: the `seedling-bot.md` paragraph, the bot-log entry, the reference regenerated (the instruments row).

## What the brief got wrong (measured)

- **"refuse 'no REACHABLE stance inside button@816,400'" as a stance or route problem.** It is guard (iii): both holders are
  derivable, but each was asked of the world as it is.
- **"`deriveCorpseWeigh` refuses corners — t5's (30,26)→(48,25)"** is true and does not matter: t5's holder is the fire
  block, not a corpse.
- **"legs 387/404 refuse at their arrivals both ways [at the press kill]".** At this base they refuse earlier (the chest
  ladder, the shake band) on all 9 seams each. The press-kill death is reached only by the chain's walk.
- **"D3: if the fix lives in the forecast…".** It does not: all three hits are a chaser's.
- **Leg ids:** 869/870 are 859/860 at this base; 368/371/387/404 are unchanged.
- **"The model planned it hit-free" (leg 368)** was already corrected by L40RES. What its hand-over did not foresee: an exact
  forecast also needs the body arm's i-frame gate and a whole-chain certificate, or it refuses hitless plans.

## Residue

- Links 1–3 (chest, tree, latch) from the arrival: the press-kill death (hammer) and the latch hold under `bobsoldier@880,832`.
- The chain's game witness stops where the pocket staging's refusal did (the south door shut). A witness of the whole leg
  waits on links 1–3.
- D2's whole-chain certificate serves `walkTo`'s dash only (not the `stand`/`narrow` arms, which certify window by window
  as before).
- D2's ON answer at the seams OFF hit is a refusal (the bomb hold), not a plan.
- `nextPastUnbound` is measured on L40 only.

BYTE_SECTION

## Rows to BANK

- **W0:** the first refusal is guard (iii) (both holders derivable under the hypothesis); legs 859/860 = the brief's 869/870.
- **D1:** the lazy chained admissions and `deriveHoldStance`'s fallback, `nextPastUnbound`, `SolverRefusal.equips`; step 67
  one link deeper; the pocket chain on p4g at 0 px over 2,643 sampled ticks, never hit (corpse t289, t5 t2486, pulse t2619).
- **D2:** the cursor exact to the origin offset; the body arm's gate; the whole-chain certificate; the 17-seam census (no hit
  plan ON, no hitless plan lost).
- **D3:** the death is three chaser hits; legs 387/404 do not reach it at this base.
- **Mutants:** m1–m7, every prediction met.
- **Trap candidates** (in the bot-log entry):
  - a guard asked of the world as it is walls a holder the hypothesis makes reachable;
  - an exact forecast exposes a conservative arm;
  - a greedy admission refuses a chain a later window resolves;
  - a refused prefix without its slot selections is not replayable;
  - an eager second ask spends the anytime budget.
- **Commits:**

  | commit | content |
  |---|---|
  | `c262d8ff` | D1 + D2 code (the hunks interleave in `solverBot.js`, `contactFidelity.js`) |
  | `28ee2375` | the witness, probe, fixtures, tests, box-lock row |
  | `39f4415f` | the wall sentence kept guard (iii)'s own |
  | `e5840ab2` | the lazy chained admissions, the bound catch (the bounded-ON findings) |
  | `55ed5aee` | docs, the regenerated reference |
  | evidence + this report | last |
