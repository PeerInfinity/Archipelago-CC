# Seedling hammer-phase: F1-REFUSAL (the bad 32:10 arrival solves hitless instead of refusing)

Slice `seedling-hammer-f1-refusal` (Opus, cloud). Planner: `seedling-hammer-phase-planning-16`. ⚖ Approved by the user
on 2026-11-26 (*"F1 refusal follow-up"*): measure first, switch-guarded OFF. Landing needs the user's own SHA-bound OK
(the planner asks). No planner follow-up arrived during the slice, so none was followed. Evidence:
[`seedling-hammer-f1-refusal-evidence/`](seedling-hammer-f1-refusal-evidence/).

## 1. Commits

- **Start:** `be493c453a` (branch `hammer-harvest-chaser-stand`, = CHASER-STAND's head). Acceptance md5 measured there:
  `391322d681b7aa0229d94b3f6906d024`.
- **Branch:** `claude/seedling-f1-refusal-5uqmoh`.
- **Commits:**
  - `50f41da7`: step 1, the reproduction (measurement only);
  - `5b20ad1f`: step 2, `REFUSAL_STAND_BOMBS` (OFF);
  - `c0efd70a`: step 3, the unit and train-tier rows;
  - `313e3021`: steps 4–5, the evidence (requests, sweep, fixtures, 2560 retries, LHM configs, surveys, game witness, census);
  - this report's commit (the head).

## 2. The answer first

- **The one thing to know first:** F1 32:10's refusal is **not LHM's to answer**. The latched hold after the kill starts
  with a bomb (`#16`) already in the air. That bomb lands on **every** walk out of the stance at the walk's 16th tick,
  while a still stand dodges it, and LHM's cells are walk-first. LHM is asked once and finds **0** cells, so it makes 0
  forks.
  - A delayed-start probe (outside LHM's rules) clears the bomb, but its route-ranked cells then walk into
    `bob@272,112`, at 2 forks and ~62 units a fork.
  - So the fix is the refusal pass, as the brief's candidate said.
- **Switch:** `REFUSAL_STAND_BOMBS` (RSB), OFF, in `jsRuntimeSolver.solveAnytime` (the page's **solve worker**, and
  node). Env `SEEDLING_REFUSAL_STAND_BOMBS=1`, wrapper `withRefusalStandBombs`. When the ladder (plus hit-avoid and HSB)
  ends in a **refusal**, all three of these must hold:
  - no pass was cut by the budget (a budget cut is the held retry's);
  - a press kill of the attempt derived a strike with bombs in play (`STRIKE_STAND_LOBBER`, solverBot);
  - the LAST pass (`full`) then runs once more under `PRESS_KILL_STRIKE_BOMBS`, and only a hitless plan replaces the
    refusal.
- **F1 32:10 under five + RSB: 814 t, 0 h**, `eb1337adcf98`, at **597 / 640** work units (margin 43).
  - The page does not retry this request: neither pass is budget-cut, so the 2560 retry never fires.
  - The plan is the one CHASER-STAND game-witnessed under PSB-everywhere. Played again here on a fresh p4g page it
    finished **2263/2263 with 0 hits**, at the model's end exactly.
- **The bar is met.** On the 16-seam sweep, five gives **12 / 0 / 4** and five + RSB gives **13 / 0 / 3** (hitless / with
  hits / refusals). No seam has a hit, and no hitless solve is lost.
  - Every other measured request, the 18 L40 fixtures and the 2560 retries give **byte-identical** answers.
  - A1 32:10 keeps 651 t, 0 h, the seam that PSB-everywhere lost.
  - The survey `--through=end` is identical on all 250 steps, and no step gains a hit. It has no anytime ladder, so it
    never reaches RSB (0 tries on its 23 refusals): it shows only that the switch ON leaves the in-place path untouched.
- **Flip-ready by the numbers?** Five + RSB: **yes on this slice's bar**. It changes one request, refusal → hitless, and
  moves nothing else measured. The cost is work on a refusal only: +314 on F1, +54 at seam −10 (cut, still a refusal),
  +19 on leg 855 (still a refusal).
- **The two non-default LHM configs (§3):**
  - leg 371 @5266 (PKB OFF): covered by **HSB under five** (1662 t, 1 h → 1775 t, 0 h), not by RSB;
  - leg 368 @5290 (BPW OFF): covered by **neither**. HSB's try is cut by the budget (1 or 16 units left), and RSB is
    never asked because it is a solve, not a refusal.

## 3. The reproduction (measured)

**Inputs.**
- The captures are fetched from their branches, as CHASER-STAND did:
  - re-measure-9's `F1.stop-requests.jsonl.gz` (`claude/whole-game-wasm-remeasure-9-ltkolv`);
  - re-measure-8's `A1`/`P1` (`claude/whole-game-wasm-remeasure-8-89f0jy`).
- Solved in node as the worker does (`tools/solve.mjs`, CHASER-STAND's, plus the RSB counts and a `BUDGET=` override).
- **five** = `SEEDLING_PRESS_KILL_START_WAIT=1 SEEDLING_PRESS_KILL_REFUGE_BOMBS=1 SEEDLING_DASH_STAND_SIGHT=1
  SEEDLING_OPP_AIM_CHASERS=1 SEEDLING_HIT_AVOID_STAND_BOMBS=1`, with LHM ON by default.

**Where the anytime ladder ends on F1 32:10 under five** (`measure/requests-raw.jsonl`):

| pass | verdict | work | cut | reason |
|---|---|---|---|---|
| dashless | refusal | 158 | none (natural) | the hold after the kill: *"stands still for up to 131 tick(s) at (167.13,136.44), inside bombpusher@112,128's 256 px reach — a Bomb's Explosion at (168,135) 61 tick(s) into the wait … LATCHED … no pacing is clean (MOVING_WAIT, 256 tried)"* |
| full | refusal | 125 | none (natural) | *"kill (spinner@192,160) by press: the player died at t2058 (bomb bombpusher@112,128#17) … PRESS_KILL_REBOOT_GUARD"* |
| hit-avoid / HSB | not asked | – | – | no plan bills a hit (both are refusals) |

- Total **283 / 640**. No row carries `limit: 'budget'`, so `budgetCut` is false and the page's held retry
  (`SOLVE_RETRY_BUDGET_FACTOR` × 640 = 2560) never fires for this request. A refusal stands at 283.

**Why LHM declines** (`measure/f1-32-10-lhm-cells.txt`, `tools/lhmc-hook.mjs`: an in-memory loader patch that logs every
cell `latchedHoldCells` drops, and why):
- It is asked once (t1996, presser `buttonroom@160,128`, group 1, latched) and declines with
  *"no hitless wait (0 fork(s))"*. The ordered cell list is **empty**.
- Of the 110 lattice cells within 96 px:

  | filter | cells |
  |---|---|
  | solid | 54 |
  | no plan (no corridor) | 26 |
  | **the preview meets `bomb:bombpusher@112,128#16` at previewed tick 16** | **30** (every walkable cell, in every direction, 15.9–93.7 px away) |

- So bomb `#16` is in the air at the hold's start and lands on any walk that starts at once. The still wait dodges it:
  its first blast is a later bomb, at +61.
- **Within LHM's rules (walk at once, then stand) there is no answer.** That is not a bound: its 2-fork bound is never
  reached.
- **A probe outside its rules** (`tools/lhmd-hook.mjs` / `lhmd2-hook.mjs`: stand D ticks, then walk):
  - The preview keeps 22 / 18 / 16 / 11 / 0 cells at D = 17 / 24 / 32 / 40 / 48.
  - But the forks then fail on `chaser bob@272,112` (`measure/f1-32-10-lhm-delay-probe-D*.txt`), e.g. D=17
    `(231,88): HIT at fork tick 83`. The route-ranked cells lie towards the bob.
  - The preview prices bombs only, by design (LHM's own note), and each fork costs ~62 units (dashless 158 → 282).
  - Making LHM answer this would mean a delayed start, pricing chasers and more forks: a larger redesign with no
    measured solve. Not taken.

**The budget margin.**
- At 640, the refusal pass costs 314 after the ladder's 283, so it ends at **597** (43 to spare). That is exactly the
  brief's 597.
- At the 2560 held retry: **not reached** for F1 (no budget cut, above). Where the ladder *is* budget-cut (sweep seams
  −80 and +10, fixtures 871/872/853), RSB is not asked at 640. At 2560 those seams are cut again in the dashless pass
  (2561), so RSB is still not asked there. Legs 871/872 at 2560 solve identically with RSB on or off
  (`measure/retry-2560-raw.jsonl`).

**The two non-default LHM configs** (`measure/lhm-configs.jsonl`, `tools/lhmcfg.mjs`, solved exactly as their committed
rows solve them: `hammerRefugeBandText`'s `solve371`, dashless alone; `fidelityL40Bk2`'s `solveAt`, every pass):

| config | base defaults | + HSB | + RSB | five | five + RSB |
|---|---|---|---|---|---|
| leg 371 @5266, `PRESS_KILL_BOMBS` OFF | 1662 t, **1 h** `t1248 #9` (LHM moved 1) | 1662 t, **1 h** (stand-bombs 1 h) | = base | **1775 t, 0 h** (HSB replaced) | 1775 t, 0 h (= five) |
| leg 368 @5290, `BOMB_PHASE_WAIT` OFF, D2 switches | 1604 t, **1 h** `t1278 #8` | 1604 t, 1 h (stand-bombs cut at 1 u) | = base | 1604 t, **1 h** (HSB cut) | = five |
| leg 368 @5290, `BOMB_PHASE_WAIT` OFF, `{dashSpinnerForecast:false}` | 1604 t, **1 h** `t1278 #8` | 1604 t, 1 h (cut at 16 u) | = base | 1604 t, **1 h** | = five |

- **371:** covered by HSB under five (PKRB's refuge question is what HSB's PSB rerun needs; HSB alone keeps `#9`). RSB is
  never asked: it is a billed-hit solve.
- **368:** covered by neither. The ladder spends 625–642 of 640 before HSB's try, so the try is cut. It is a budget
  question, not a refusal: RSB does not reach it, by design.

**The survey `--through=end`, five vs five + RSB** (`survey/`, `tools/survey2.sh`, a reach preload per step):
- **Identical on all 250 steps** (verdict, ticks, replay hits and deaths, refusal text): 227 solved, 23 refused under both.
- The steps with hits are the same in both, and the same as CHASER-STAND's all4 + OAC + HSB: 24 (L16, 1 h), 202 (L82,
  2 h), 220 (L82, 2 h). 0 deaths. **No step gains a hit.**
- ⚠ **What it shows, and what it does not:** RSB is ON on all 250 steps, but its block counts **0 refusals and 0 tries**,
  although 23 steps refuse. The survey solves in place, with no `solveAnytime` ladder, so it never reaches RSB (or HSB:
  0 tries there too).
  - So the survey shows that OFF-path code is untouched with the switch ON: `deriveStrike`'s watch is never armed outside
    `solveAnytime`.
  - It cannot witness the change itself.

## 4. Design + change, OFF identity

- **`REFUSAL_STAND_BOMBS`** (`jsRuntimeSolver.js`): one new block after HSB's in `solveAnytime`, plus three new
  functions:
  - `withRefusalStandBombs`;
  - `refusalStandBombsAsks(best, rows, lobberSeen)`, the pure decision: a `refusal`, no row with `limit === 'budget'`,
    `lobberSeen > 0`;
  - `refusalStandBombsPass`, which is `standBombsPass` (HSB's own try: PSB ON, the attempt's work clock to its budget, no
    window, keeps only a hitless plan, a cut is `cut` never `limit`, skipped when PSB is already ON) relabelled
    `refusal-stand-bombs` with `from: <pass>`.
- **Which pass: the LAST** (`passes[passes.length - 1]`), the ladder's widest search (`full`).
  - Measured on F1: under PSB the dashless pass refuses again (175 u). Rerunning both would need 489 units after the
    ladder's 283, i.e. 772 > 640.
- **The gate, `STRIKE_STAND_LOBBER`** (`solverBot.js`): `{watch, seen}` plus `armStrikeStandLobber` /
  `disarmStrikeStandLobber`.
  - One line in `deriveStrike`, after PSB's pinned gate:
    `if (STRIKE_STAND_LOBBER.watch && bombsInPlay(run)) STRIKE_STAND_LOBBER.seen += 1;`.
  - It is armed only when RSB is ON, at the ladder's start, and disarmed before the decision reads it.
  - It is a decision input, and the doc says so. It is what "a room where the stand question reads something" means: a
    press-kill strike derived with a lobber or a live bomb in play. Without it the try would repeat the pass for nothing.
- **Threads:** all of it runs in the solve worker (and node). Nothing is read on the page's main thread, so no
  `pageSolverEnvSwitchOn`.
- **No single-game constants:** no level, coordinate or entity id. Pinned by a source row.
- **OFF identity:** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`:
  - at the base `be493c453a`: `391322d681b7aa0229d94b3f6906d024`;
  - at `5b20ad1f` (RSB in place): `391322d681b7aa0229d94b3f6906d024`.
  - OFF, the watch is never armed: `deriveStrike`'s new line reads `watch` (false) and short-circuits before
    `bombsInPlay`.
- **Regenerated:**
  - `census-seedling-solver-surface.mjs --write`: 375 rows, *"same seedling-solver-surface"* (no diff); `--check` GREEN;
  - `generate-procgen-reference.mjs` and `generate-docs-index.mjs`: no diff;
  - no docs edit under `docs/json/developer/procgen/`, so no procgenDocs pins are owed.

## 5. Rows + bounded vitest runs

- **`hammerF1Refusal.test.js`** (default tier, 7 rows):
  - RSB ships OFF, its env name is in `SOLVER_ENV_NAMES`, and its wrapper restores the switch, also on a throw;
  - the decision: a solve never, a refusal with `lobberSeen` 0 never, a budget cut never (a window cut does not block),
    and a divergence, a skip or nothing never;
  - with PSB already ON the try is a named skipped row;
  - source:
    - armed once, only by the switch;
    - asked after HSB, of `passes[passes.length - 1]`;
    - disarmed before the decision;
    - the try reuses `standBombsPass` and never writes `limit`;
  - `STRIKE_STAND_LOBBER`'s arm/disarm restore;
  - source: one guarded counting line beside PSB's pinned gate, and PSB gains no reader.
- **`hammerF1Refusal.train.test.js`** (train tier, 3 rows, **147 s**; cost row added to
  `scripts/test/train-shard-costs.json`). The witness is the committed `press-kill-start-wait/P1-32-10` fixture
  (`hammerPkswHitsRows.solveCapturedTotem64`) under five:
  - F1 (P1 − 97) OFF: both passes refuse, the full pass by a bomb death while pressing, and the RSB try is not made;
  - F1 ON: `[dashless ✗, full ✗, refusal-stand-bombs ✓]` (`from: 'full'`), fresh replay 0 hits, 0 deaths, end level 40,
    work ≤ 640;
  - P1 + 7, ON vs OFF: equal answers (HSB's hitless plan), and the RSB try is not made.
- **Bounded runs:**

  | files | tier | result |
  |---|---|---|
  | `hammerChaserStand.test.js`, `pkswHits.test.js`, `solverEnvChannel.test.js` (after step 2) | default | 3 files, **30/30** |
  | `hammerF1Refusal.test.js` | default | **7/7** |
  | `hammerF1Refusal.train.test.js` | train | **3/3** (147 s) |
  | `trainShardPlan.test.js`, `hammerF1Refusal.test.js`, `hammerChaserStand.test.js`, `pkswHits.test.js`, `solverEnvChannel.test.js` (final code) | default | 5 files, **58/58** |

- **Not run:** no unfiltered vitest, no pytest, no `standing-values --write`. **A dispatched train-tier run at the tip is
  owed** (the slice touches the anytime ladder and solverBot's press kill):
  `unittests_frontend.yml -f train_only=true`.

## 6. Page play / game witness

**F1 32:10 on the game** (`game/f1-32-10-fiversb.{json,log}`, `tools/reqwitness.mjs`, CHASER-STAND's with the lock name
and an answer hash added):
- **Method:**
  - the request is solved in node under five + RSB, as the worker does;
  - the staged tape is the request's prefix (1449 keys, its equips kept) plus the plan;
  - it is played on a fresh `seedling_bot_ap_p4g` page, headless logic-only, with the delivered AP set, under the box
    lock (head `c0efd70a`, 0 tracked changes).
- **Solve:**
  - `[dashless refusal 158, full refusal 125, refusal-stand-bombs 814 t / 314 u, model 0 h]`;
  - answer `eb1337adcf98`, the same keys CHASER-STAND witnessed under PSB-everywhere.
- **Game:** **finished 2263/2263, 0 hits**, 0 hits at the prefix, end L40 (71.564…, 152.896…), the model's end exactly.
- A page `--solver-env` run was not made. The witness plays the worker's own answer, and the solve is a pure function of
  the request (work units, no clock).

## 7. Census: which seed-1 divergence-sweep legs (by key) the change can move

- **The leg list at this head:** `seedling-divergence-legs.mjs --presets=seedling_playthrough --out=…` gives **915** legs,
  the same list as CHASER-STAND's (`census/legs-reach.txt`).
- **What RSB needs:**
  - a `solveAnytime` answer that is a refusal, with no budget cut;
  - and a press-kill strike derived with bombs in play;
  - so a **spinner room with a lobber**. From the committed atlas census (CHASER-STAND's): spinners in L18, L39, L40, L92;
    a BombPusher only in **L40**.
- **The legs:** the **50 legs that start in L40** (ids 359–396 and 847–858 at this head; the same set as HSB's).
  - The 16 legs from L39/L41/L42/L43 whose target is L40 (356, 397, 398, 400–424 even) end at the crossing into L40 and
    derive no strike there.
- **Measured reach over the committed L40 captures:**
  - 18 fixtures: RSB was tried on **one** (fixture `leg855-l41-l40-totem64`, key `level_40__r4c4 <- in_L41_0_160 ~> level_40__r0c53 -> location:Level 040
    - Totem Part 64,144`): 19 units, still a refusal, the same words.
  - Three refusals were budget-cut and not asked (871, 872, 853).
  - The 32:10 request family (`level_40 … -> location:Level 040 - Totem Part 64,144`, the whole-game entry-32 continue):
    tried at seams −97 (**solved**) and −10 (cut at 640, still a refusal).
- **The survey cannot witness it:** it solves in place, with no anytime ladder (§3, *the survey*).
- **What a landing's sweeps must watch:** the 50 L40 legs, and how much extra work their refusals spend.

## 8. What the brief got wrong (measured)

- **"If LHM can answer it hitless within its rules, that may be the better fix":** it cannot. LHM finds **0** cells, not a
  cut set: every walk out meets bomb `#16`, already in the air, at its 16th tick. Its 2-fork bound is never reached.
- **"MOVING_WAIT tried 256 pacings, LHM was asked once and declined":** confirmed. The decline's cause is the in-flight
  bomb and LHM's walk-first cells, not its bound.
- **"PSB's full pass alone solves it in 314 units after OAC's 283, i.e. 597 of 640":** confirmed exactly (597). The ladder
  is not cut (283 is two natural refusals), so the 2560 retry never runs for this request.
- **"Unmeasured elsewhere":** measured now. Over the 16 seams, 7 requests and 18 fixtures, RSB moves only F1 32:10.
- **"Say whether HSB (on a billed hit) or your change covers those two":**
  - 371 is HSB's under five, not under HSB alone;
  - 368 is neither's, a budget case;
  - the change cannot reach a billed-hit solve.
- Nothing else in the brief was contradicted.

## 9. Residue / hand-overs

1. **Leg 368 @5290 with `BOMB_PHASE_WAIT` OFF** keeps `#8` (t1278) under five.
   - The ladder spends 625–642 of 640 before HSB's try, so the try is cut.
   - This is a budget question for HSB (a billed hit), not a refusal. It is a non-default config (BPW is ON by default).
2. **Refusal cost.** On a refusal in L40 that is not budget-cut, RSB spends up to the attempt's remaining budget, e.g.
   +54 units at seam −10 (cut at 641) and +19 on leg 855.
   - It never spends past 640, and never turns a refusal into a held retry (its cut is `cut`, not `limit`).
   - The page's latency on such a refusal grows by at most the budget's remainder.
3. **The survey does not reach the anytime ladder** (§3, *the survey*), so it is no witness for HSB or RSB. A page-path sweep of the 50
   L40 legs with the six-name spec is the landing's evidence.
4. **PSB everywhere** stays unshippable (CHASER-STAND §9 item 2). RSB, like HSB, asks it only where its cost cannot be a
   hitless plan: after a refusal.
5. **Owed:**
   - a dispatched train-tier run at the tip (`unittests_frontend.yml -f train_only=true`);
   - the planner's L40 page sweep, and a whole-game re-measure, with the six-name `;` spec
     `SEEDLING_PRESS_KILL_START_WAIT=1;SEEDLING_PRESS_KILL_REFUGE_BOMBS=1;SEEDLING_DASH_STAND_SIGHT=1;SEEDLING_OPP_AIM_CHASERS=1;SEEDLING_HIT_AVOID_STAND_BOMBS=1;SEEDLING_REFUSAL_STAND_BOMBS=1`.
     Expect entry 32's 640 continue on F1's phase to **solve hitless** (814 t), not refuse.
