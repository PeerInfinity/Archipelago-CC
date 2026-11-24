# Seedling hammer-phase FEWER-HITS — a third, hit-avoiding pass (`HIT_AVOID_PASS`, OFF) and fewer-hits ranking (`FEWER_HITS_RANK`, OFF)

Session `seedling-hammer-fewer-hits` (Opus, cloud). The planner is `seedling-hammer-phase-planning-12`.
⚖ The user approved the slice on 2026-11-19: *"Fewer-hits ranking (Recommended)"*. No follow-up from the planner arrived,
so the scope is the brief's.

## 1. Start, head, branch

| | |
|---|---|
| Start SHA | `f43e2de82a26cbc23d8304ffc46ed0013fce16c0` (main, TRAIN 166, `HIT_AWARE_ANSWER` ON) |
| Commits | step 1 measure `8864f9b434` · step 2 switches `5fe05e3941` (**the code head**) · step 3 rows `691fc5ad32` · census evidence `0f480bfba2` · this report (last; its message carries the Cloud trailers) |
| Branch | `claude/seedling-fewer-hits-ranking-ueku4b` |
| Switches | `jsRuntimeSolver.HIT_AVOID_PASS`: `SEEDLING_HIT_AVOID_PASS=1`, `withHitAvoidPass(enabled, fn)`, `HIT_AVOID_PASS_DEFAULT = false`. `jsRuntimeSolver.FEWER_HITS_RANK`: `SEEDLING_FEWER_HITS_RANK=1`, `withFewerHitsRank(enabled, fn)`, `FEWER_HITS_RANK_DEFAULT = false`. Both are listed in `SOLVER_ENV_NAMES` |
| Thread | Both run inside `solveAnytime`, so in the page's **solve worker** (and in node). No main-thread mapper reads either switch, so `pageSolverEnvSwitchOn` is not needed: the worker env channel is the whole page wiring. Measured: the page rows for `--solver-env=SEEDLING_HIT_AVOID_PASS=1` carry the `hit-avoid` pass row (§6) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-fewer-hits-evidence/` (`README.txt` lists every file): `w0/` base page rows and captures, `game/` page ON rows, `census/`, `survey/`, `tools/`, and the bounded vitest log |
| Environment | `session_bootstrap.sh --seedling`, node v22.23.5, 4 cores. This session started `:8000` (`serve-nocache.py`). `solverBot.js` is not touched |

## 2. The answer first

**The one thing to know first:** of the brief's three residues, only **302** is the third pass's.
- **302's hit is a phase question, but not the seam time's.** It comes from the item-delivery replan tick:
  - The arrival solve is always hitless (full 156 t).
  - An item delivery interrupts it at **t57 or t58**, depending on the page's timing, and the continuation is
    re-solved from there.
  - From t58 the full pass is hitless. From t57 **both** passes take one hit.
  - Starting the t57 continuation's search **one idle tick later** gives a hitless plan.
- **The other two residues are not this pass's:**
  - **128 / 161:** phase-invariant. They are hitless under FADE_MOVE, an existing OFF switch.
  - **The L16 pit legs that hit** (the `out_pit_7_x` keys): the model bills a hit on the landing tick in L17, at every
    start.

| leg (key) | env | OFF | ON | p4g game |
|---|---|---|---|---|
| 302 `level_30__r2c10 <- in_L28_304_16 -> location:L30 flag 0: bosslock@64,32 cleared`, t57 continuation | defaults | full 101 t, 1 model hit (dashless 103 t, 1 hit) | **`hit-avoid` 97 t (delay 1), 0 hits**, 4 work units, 1 try | OFF: 1 hit (t102) on both t57 runs. **ON: 0 hits on all 3 t57 runs**, game end = model end, 0 divergences |
| 302, t58 continuation | defaults | full 98 t, 0 hits | = OFF (the pass does not run) | 0 hits, both arms |
| 128 / 161 (L12 `bosslock@432,240`) | defaults | full 541 / 610 t, 2 punches | = OFF; the pass tries 3 starts in 86 units and finds none | 2 hits each (base) |

- **302 on the page:**
  - Base: 2 of 6 runs drained at t57, and both took the hit.
  - ON: 3 of 6 runs drained at t57, all shipped `hit-avoid`, and every ON run was hitless.
- **Census** (node, all 922 legs, arrival requests):
  - 9 legs have every pass hit. The third pass runs on exactly those 9 and moves **0** of them.
  - Its cost there is 86 work units on every one of the 9 (median = max), the window it gives itself.
  - **0 legs move. No leg moves toward a hit.**
- **FEWER_HITS_RANK** moves nothing at seed 1. On every both-hit leg, the shipped plan already has the fewest hits, or
  the counts tie.
- **Route survey `--through=end`, OFF vs both ON:** 224/26 both arms. **0 rows differ** outside timing fields, and no step
  gains a hit (the survey never asks `solveAnytime`).
- **Acceptance md5:** `391322d681b7aa0229d94b3f6906d024` at base and at the tip with both switches OFF.

## 3. The reproduction (measured)

**Page, base, defaults.** Rows: `w0/rows-*.jsonl`. Captures: `w0/cap/*.jsonl.gz`. The command:
`probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page=seedling_bot_ap_p4g --page-legs=1 --keys=<key>
--capture-requests=…`. The leg list is `seedling-divergence-legs.mjs` at this base: 922 legs (`census/legs.jsonl.gz`).

**302, six runs.**
- Every run solves the arrival the same way:
  - dashless 187 t, 2 model hits;
  - full 156 t, 0 hits. The full pass ships.
- At t57 or t58 the gate reports `item delivery` → `replanned`, and a continuation is solved from there:

| runs | delivery tick | continuation passes | shipped | game hits |
|---|---|---|---|---|
| r1–r4 | 58 | dashless 107 t 1 h; full 98 t 0 h | full 98 t | 0 |
| r0, r5 | 57 | dashless 103 t 1 h; full 101 t 1 h | full 101 t | **1** (t102, `exact`, the continuation's tape) |

- **The seam time is not the driver.** `seamTime` 5104 drained at t57 on r0 and at t58 on r4.
- **Node, the t57 capture with k idle ticks appended** (`tools/phase.mjs`; `w0/phase-302-r5-i1.jsonl`):
  - k = 1: both passes 96 t, **0 hits**.
  - k = 3, 5, 10, 11, 12: hitless.
  - k = 2, 4, 6–9: one hit.
  - The hit is a phase of the bodies' motion against the start tick: **class (a)**. A hitless plan is in the search
    space, and the passes miss it only because of where they start.

**128 / 161.**
- Page: 2 game hits each (128: t493, t520; 161: t562, t589).
- Passes: dashless 571 / 696 t, 3 hits and a death; full 541 / 610 t, 2 hits.
- Node: k = 0..16 idle ticks first gives the same passes and the same hits at every k (`w0/phase-128.jsonl`,
  `phase-161.jsonl`). The punches come ~500 t in, at the lock, so the start phase cannot reach them.
- Under `SEEDLING_FADE_MOVE=1`, both passes are **hitless at the same tick counts** (571/541, 696/610;
  `w0/fm-*.jsonl`).
- Class (a), but the hitless plan comes from FADE-MOVE's strategy. That is a hand-over (§9), not this pass's.

**L16 pit exits.** Two different key families were checked:
- **`out_pit_9_x`:** the ids 838 / 841 / 845 / 848 in this base's list are these legs. On the page (`w0/rows-oth.jsonl`)
  and in node, both passes are hitless.
- **`out_pit_7_x` (the hitting keys):**
  - Keys: 836 `level_16__r1c9 <- in_L15_144_16 ~> level_16__r1c1 -> exit:out_pit_7_2`, 839 (`… out_pit_7_3`), 843
    `level_16__r1c9 <- in_L17_32_48 ~> level_16__r3c7 -> exit:out_pit_7_2`, 846 (`… out_pit_7_3`). These are HIT-TIEBREAK's
    keys.
  - Both passes take 1 model hit.
  - The hit row (`census/pit7-hit-rows.jsonl`) is on the plan's **last tick, in level 17**: `chaser bob@96,32`. The pit
    drops the player onto it.
  - With 0..30 idle ticks first and no budget (`census/phase-8*.jsonl`), it is 1 hit at every k, both passes, every
    route.
  - On the page (`w0/rows-pit7.jsonl`): `roomHits` is empty. But the lab samples `botStatus.hits` only while the player
    stands in the leg's level (`seedlingDivergenceLab.js`: `if (s?.level !== goal.level …) return`), so the game
    witness is **blind** to the landing in L17.
  - **Class (b):** the model says every plan hits, and the game has not been asked. Hand-over (§9).

## 4. Design and change; OFF identity

All hunks are in `jsRuntimeSolver.js`, plus two names in `solverEnvChannel.js`.
- **New functions and exports:**
  - `HIT_AVOID_PASS` / `FEWER_HITS_RANK`, their `with…` wrappers and `…_DEFAULT`s;
  - `HIT_AVOID_MAX_DELAY = 16`, a search bound and not a game value;
  - `fewerHitsOrder`, `delayedPlan`, `hitAvoidPass`.
- **Call sites:** one line in `betterAnswer`, and one block in `solveAnytime` after the pass loop.

**`hitAvoidPass` (ON).**
- **When it runs:** after the passes, and only when the plan in hand still takes a model hit (`planTakesHit === true`).
  This needs the `modelHits` stamp, so it needs `HIT_AWARE_ANSWER` ON (the default). It never runs on a hitless leg.
- **What it tries:**
  - It replays the tape, then advances the run one idle tick at a time, for `delay` = 1..16.
  - For each delay it re-runs the **first** pass's search (`passes[0]`: dashless) with those idle ticks appended to the
    tape. `live` is the incremental run's own digest, so the solver's shadow check holds.
  - The first plan the model plays hitless over the idle ticks and its own ticks is the answer.
  - It stops early if standing still is itself hit.
- **How the plan is re-based** (`delayedPlan`):
  - the idle ticks become the plan's first ticks;
  - `expected` is the idle replay's rows followed by the solve's rows;
  - `equipsAt`, `equipItems`, `trailingEquip` and the dash ticks shift by `delay`;
  - `modelHits` adds the idle ticks' own;
  - `prefixLength` stays the tape's;
  - the plan carries `pass: 'hit-avoid'` and `hitAvoidDelay`.
- **Ranking:** the plan's ticks count from the original start, so `betterAnswer`'s verdict rule ranks it like any other
  pass. A hitless plan beats the hit one. A plan that still hits is never returned.
- **Budget:**
  - It runs on the attempt's own work clock, so the budget still binds.
  - It stops `upgradeWindowWork` units after its own start (85 at defaults: "upgrade briefly, then ship").
  - In place, with no budget, `HIT_AVOID_MAX_DELAY` bounds it.
- **Its row:** `{pass: 'hit-avoid', ok, ticks, work, tries, delay, modelHits, cut}`.
  - It carries `cut`, never `limit` / `deadline`. `budgetCut` and `passNote` read those as a cut of the shipped passes,
    and a held retry reads `limit`.
  - It posts no `onPass`. The page's provisional plan stays the two passes' best, and `answered` is unchanged.

**`FEWER_HITS_RANK` (ON).**
- In `betterAnswer`, after the verdict rule: when **both** plans are stamped and both take a hit, fewer hits wins, then
  fewer deaths, then today's strictly-fewer-ticks rule.
- A hitless plan still always beats a hit one (the verdict rule runs first).

**OFF.**
- The pass block reads `HIT_AVOID_PASS.enabled` (false), and `betterAnswer` reads `FEWER_HITS_RANK.enabled` (false).
  Nothing else changes.
- Acceptance md5 (`node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`):
  - **base `f43e2de8`: `391322d681b7aa0229d94b3f6906d024`**;
  - **tip (code head `5fe05e3941`, both OFF): `391322d681b7aa0229d94b3f6906d024`**.
  - Equal.

**Generated surfaces.**
- `census-seedling-solver-surface.mjs --write`, then `--check`: GREEN, 374 rows, unchanged.
- `census-seedling-constants.mjs --check`: PASS.
- `generate-procgen-reference.mjs` and `generate-docs-index.mjs`: no tracked change.
- No docs under `docs/json/developer/procgen/` were edited.

## 5. Rows and bounded vitest

**`hammerFewerHits.test.js` (new, 8 rows).**
- **The switches:** both OFF by default, both in `SOLVER_ENV_NAMES`, both restored after a throw.
- **Synthetic `betterAnswer`, both plans hit:**
  - ON: fewer hits wins, then deaths, then length;
  - a verdict difference still decides first;
  - an unstamped plan decides by length;
  - OFF: length alone;
  - `fewerHitsOrder` reads only two hit stamps.
- **`delayedPlan`:** the idle ticks come first; rows, equips, `trailingEquip` and hits shift or add correctly.
- **Witness** (fixtures `fixtures/hammer-fewer-hits/leg302-l28-l30-delivery-t5{7,8}-request.json.gz`: the page's t57
  and t58 continuation captures, cut to level 30 with `tools/cut-fixture.mjs`):
  - t57 OFF: both passes 1 hit, and the full 101 t ships.
  - t57 ON: `hit-avoid` ships, delay 1, 97 t, stamp 0. It re-drives hitless to the expected end, and its row carries no
    `limit`/`deadline`.
  - t58: ON = OFF byte for byte, and the pass never runs.

**Mutants.** Each was applied to `jsRuntimeSolver.js`, and the file was then restored from git. Each turned red:

| mutant | red rows |
|---|---|
| the pass never runs | t57 ON |
| the idle ticks dropped from the plan | `delayedPlan`, t57 ON |
| the pass runs on a hitless plan | t58 |
| the ranking ignores its switch | the OFF row |

**Runs.**
- The new file alone: 8/8.
- **Bounded vitest: 23 files, 370 / 370 passed** (`--maxWorkers=2`). The file list is `vitest-bounded-files.txt` and the
  log is `vitest-bounded.txt`. The set is HIT-TIEBREAK's 22 (every `jsRuntimeSolver*` / `jsRuntime*` solving file,
  `solverEnvChannel`, the wasm walk / delivery / equips / hold-seam rows, the dash-window and dash-shape rows, FADE-MOVE,
  CLEARTAG-STAND, HIT-TIEBREAK) plus the new file.

**Not run (the brief's boundaries):** unfiltered vitest, the train tier, pytest, `standing-values`, full sweeps, the
whole-game walk.

## 6. Page play and game witness (p4g)

Page sweep at the code head: `--page=seedling_bot_ap_p4g --page-legs=1 --solver-env=SEEDLING_HIT_AVOID_PASS=1`, key 302,
six runs. Rows: `game/rows-302-on-*.jsonl`. The `SOLVER_ENV:` line shows the worker received the switch.

| run | delivery | continuation passes | shipped | game hits | divs | game end = model end |
|---|---|---|---|---|---|---|
| 1, 3, 6 | t57 | dashless 103 t 1 h; full 101 t 1 h; **hit-avoid 97 t 0 h** | `hit-avoid` | **0** | 0 | (72.722, 50.082) both |
| 2, 4, 5 | t58 | dashless 107 t 1 h; full 98 t 0 h (no third pass) | full | 0 | 0 | (72.368, 50.023) both |

The base arm (§3) shipped the 101 t plan on its two t57 runs, and the game took the hit at t102 on both.

No other leg goes to 0 hits, so no other witness is owed.

## 7. Census: which seed-1 divergence-sweep legs the change can move, and why

**Method** (`tools/census-leg.mjs`, `census/README` lines in `README.txt`).
- HIT-TIEBREAK's census, adapted: every leg of this base's list (922) is solved in node as the page's solver producer
  asks its **arrival**:
  - inv staging; the sphere's items and slots by KEY (`census/sphere-items.jsonl`); save keys, seals and totems;
  - this session's p4g dump;
  - `ANYTIME_PASSES` under 640 / 85.
- It runs with both switches ON. The dashless/full rows are the base's own, because OFF never runs the third pass, so
  one run gives the base's choice (verdict, then ticks) and the ON choice.
- **Validated:** 128 reproduces the page's passes exactly (571/541 t, work 34/119, the hits).

**Results** (`census/summary.txt`).

| outcome | legs |
|---|---|
| solved | 817 |
| refused | 81 |
| no solver goal | 3 |
| over the 240 s cap | 21 (the same boss legs as HIT-TIEBREAK's) |

**The third pass's whole reach (arrivals):** the 9 legs where every planned pass takes a model hit.
- L12: 127 `level_12__r0c19 <- in_L35_32_64 -> location:L12 flag 4: bosslock@416,240 cleared`, 128 (`… flag 5:
  bosslock@432,240 …`), 160 `level_12__r0c19 <- in_L95_624_64 -> location:L12 flag 4: bosslock@416,240 cleared`, 161
  (`… flag 5 …`), 172 `level_12__r0c19 <- in_L95_624_80 -> location:L12 flag 5: bosslock@432,240 cleared`.
- L16: the four `out_pit_7_x` legs 836 / 839 / 843 / 846 (keys in §3).
- **What the pass did on them:** it ran on exactly these 9. It made 2–10 tries, each time cut by its own window at 86
  work units, and found **no hitless plan**:
  - the L12 punches are phase-invariant (§3);
  - the L16 hit is the landing in L17 at every start.
- **Moved:** 0. **Moved toward more hits:** 0.
- **Cost:** 0 on the other 808 solved legs. On the 9 it costs 86 work units (median = max). That is about 1 s per try on
  the L12 legs in node (0.7–1.2 s for one two-pass solve at k > 0, `w0/phase-128.jsonl`).

**FEWER_HITS_RANK** moves 0 legs.
- On every both-hit leg the shipped plan already has the fewest hits: L12 full 2 h beats dashless 3 h + death by length
  anyway.
- Or the counts tie: L16, 1 h each, so length decides.

**What the census cannot see: continuations.** 302's hit is a replan after an item delivery mid-walk. Only the page
reaches it. On the page the pass moved 302's t57 continuation, which happened on 3 of the 6 ON runs (§6). Every other
page-only continuation is unmeasured.

## 8. What the brief got wrong (measured)

1. **"L16 pits 838/841/845/848: both passes take a hit."**
   - In this base's leg list those ids are the `out_pit_9_x` legs. They are hitless on both passes, on the page and in
     node.
   - The hitting legs are the `out_pit_7_x` keys (836/839/843/846 here; the same keys HIT-TIEBREAK named).
   - Their hit is not on the route. It is the landing tick in L17, on `bob@96,32`, at every start.
   - So no pass or ranking can avoid it. It is a fidelity/accounting question (§9).
2. **"302: a seam/arrival-phase dependence like L40's 866."**
   - The arrival solve is the same on all 12 runs (full 156 t, hitless).
   - The intermittency is the **item-delivery replan tick** (57 vs 58). The seam time is not the driver: `seamTime` 5104
     gave both ticks.
   - A seam-time sweep of the arrival request would see nothing. The phase that matters is the continuation's start, and
     the start-delay search reaches it.
3. **"Legs 128 and 161 at defaults: dashless DIES, full takes 2 h."**
   - That holds.
   - But no start delay (0..16) changes either pass.
   - FADE_MOVE alone makes both passes hitless at the same tick counts. Their fix is that switch's landing, not a third
     pass.
4. **"Survey every mover; list steps that got longer because they became hitless."** The route survey solves each step
   in place, with no `solveAnytime`. Its 0 movers holds by construction, as HIT-TIEBREAK found.

## 9. Residue / hand-overs

- **Planner (landing):**
  - The sweep arms: OFF, and `SEEDLING_HIT_AVOID_PASS=1`, with capture on the ON arm.
  - Predicted:
    - 302 goes to 0 hits on every run. A t57 run ships `hit-avoid` 97 t, against the 101 t hit plan.
    - Every arrival plan is unchanged: the census found 0 movers.
    - A continuation elsewhere can move only toward a hitless plan.
  - The 302 hit's rate on the base arm depends on how often the page drains at t57: 2/6 here.
  - `FEWER_HITS_RANK` changes nothing at seed 1, so landing it is optional. It is a fallback order for a future
    both-hit pair with different counts.
- **FADE-MOVE (128 / 161, and the L12 family 127 / 160 / 172):**
  - All five are both-hit at defaults.
  - FADE_MOVE alone makes 128 and 161 hitless at the same ticks (measured here). HIT-TIEBREAK measured 127 / 160 / 172.
  - The flip of `SEEDLING_FADE_MOVE` is their fix.
- **Fidelity (L16 `out_pit_7_x`, class (b)):**
  - The model bills `chaser bob@96,32` hitting on the **landing tick in L17**, at every start (836 / 839 / 843 / 846).
  - Two questions:
    1. Does the game hit there? A p4g witness must sample past the exit: the lab's `roomHits` drops samples outside the
       leg's level, so today's rows cannot say.
    2. Should a hit on the transition tick count in **this** leg's verdict, or in the next leg's arrival? Billed to this
       leg, it marks four otherwise hitless routes as hit plans.
  - If the game agrees and the hit belongs to the leg, it is a rules question: a pit drop onto a chaser's spawn. That
    goes to the no-hit gate.
- **Not measured:**
  - continuation legs other than 302;
  - the 21 boss legs over the cap;
  - the census's node rng versus the page's on bodies it moves;
  - the pass with a non-default `passes` list (a held retry runs with no plan in hand, so the pass, which needs a plan,
    never runs there).
- **JS arc:**
  - The hunks are new exports plus two call sites (`betterAnswer`, and one block after `solveAnytime`'s loop).
  - A `hit-avoid` plan carries `hitAvoidDelay`, and its pass name is new. `seedlingSolveWatch.js`'s note text treats any
    pass other than `full` / `dashless` as a plain route.
