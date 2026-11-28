# Seedling hammer-phase: L39 18:11 ARRIVAL HIT (a budget-cut hit plan asks the held retry)

Slice `seedling-hammer-l39-arrival-hit` (Opus, cloud). Planner: `seedling-hammer-phase-planning-17`. ⚖ Approved by the user
on 2026-11-26 (*"Entry-37 wall (Recommended), L40 Chest spinner corner (Recommended), L39 18:11 arrival hit, Step-189
lavarunner"*; this slice is the third). Measure first, switch-guarded OFF. Landing needs the user's own SHA-bound OK (the
planner asks). No planner follow-up arrived during the slice, so none was followed. Evidence:
[`seedling-hammer-l39-arrival-hit-evidence/`](seedling-hammer-l39-arrival-hit-evidence/).

## 1. Commits

- **Start:** `de6e6e7fa8` (branch `hammer-harvest-f1-refusal`: the LHM flip, LHM ON by default, plus the OFF switches
  PKSW/PKRB/DSS/OAC/PSB/HSB/RSB, over main `754b1909bb`; not landed). ⚠ At this base the LHM flip's 10 JSUT re-pins
  (fidelityBombPusher, fidelityL40Bk2, fidelityWandHold, hammerRefugeBandText, fidelityL40Button) are not applied, so those
  rows read red here. That is the base's, not this slice's.
- **Branch:** `claude/seedling-l39-arrival-hit-1kp8qn`.
- **Commits:**
  - `f0b8f3fb`: steps 1–4, `HIT_PLAN_RETRY` (OFF) in `expiryAction` (variant A: the retry resumes at the cut pass), with
    the unit rows, the train rows and the captured request as a fixture;
  - `8cebc41b`: step 3 revised (variant B: the retry re-runs the whole ladder; the switch moves to `hitPlanRetry.js`; the
    solve service's `answered`), the rows re-pinned, the train-cost row;
  - `d16368bc`: the evidence directory;
  - this report's commit (the head), with the survey evidence.

## 2. The answer first

- **The one thing to know first:** the hit is **not the solver's choice**. The worker answers 18:11 with a budget-cut
  attempt:
  - the dashless pass solves with one model hit (536 of 640 units);
  - the full pass is cut at the **budget** (`limit: 'budget'`);
  - hit-avoid and HSB get 1 unit each (`cut: 'budget'`).

  The page's `wasmPlayback.expiryAction` then plays **any** budget-cut answer that holds a plan (`'provisional'`), hit or
  not. So the gate is the page's, on its **main thread**. The held retry at 4× (2560) solves this request hitless.
- **Switch:** `HIT_PLAN_RETRY` (HPR), OFF. Env `SEEDLING_HIT_PLAN_RETRY=1`, wrapper `withHitPlanRetry`. It lives in
  `seedlingDemo/hitPlanRetry.js` (imports `solverEnvChannel.js` only), and `jsRuntimeSolver.js` re-exports it, so the
  name stays in the worker's import closure (the one table). It is read on the page's **MAIN thread**, through
  `pageSolverEnvSwitchOn` (YETI-TALK's pattern). Two reads:
  - `wasmPlayback.expiryAction` answers `'retry'` for a budget-cut answer whose plan bills a model hit or death, while a
    retry is left and a pass is unanswered (`hitPlanRetryAsks`);
  - `jsRuntimeSolveService` does not count a pass whose answer bills a hit as *answered* (`hitPlanHeldOpen`). So the held
    retry (`passesAfter`) re-runs the whole ladder, and the full pass again has a plan in hand.
- **Numbers:**
  - S1 18:11 OFF: 2864 t, **1 hit** (`t1521 spinner-hammer:spinner@112,88`), = the page's `719a637caca4`.
  - S1 18:11 ON: one held retry at 2560, the `full` pass, **3929 t, 0 hits, 0 deaths**, `128f09ae3413`.
    **Played on a fresh p4g page: finished 3929/3929, 0 hits.**
  - The seam band, one 45-tick period of arrival clocks:

    | | clean | hit | refused |
    |---|---|---|---|
    | OFF | 37 | **7** | 1 |
    | ON | **44** | **0** | 1 |

    ON leaves every hitless seam identical, and it adds no refusal (the one refusal is OFF's own, unchanged).
  - SIX + HPR gives the same 7 seams hitless with the same plans.
- **OFF identity:** acceptance md5 `391322d681b7aa0229d94b3f6906d024`, at the base and after both commits.
- **Cost:** a hit plan now waits for one held retry (the retry spent 1176–2449 units over the 7 seams, on top of the cut attempt's ~643). The plans it ships are longer
  than the hit plans: 3317–3940 t against 2853–2867 t.

## 3. The reproduction (measured)

Tools: `tools/page.mjs` mirrors `seedlingWasmPlayback.pollSolve`'s budget branch. It runs:
1. the attempt at the request's budget;
2. `budgetCut` → `expiryAction`;
3. a held retry at `SOLVE_RETRY_BUDGET_FACTOR`× of `passesAfter(answered)`, with `answered` as the service counts it;
4. the final pick by `betterAnswer`.

The shipped plan is then replayed on a fresh run. `tools/passes.mjs` prints one `solveAnytime`'s pass rows. The input is
re-measure-11's `S1.stop-requests-18-32-37.jsonl.gz` row 18 request 11, from
`claude/seedling-whole-game-wasm-remeasure-bypmjt` @98bcc6259b (read into a scratch dir, not committed).

**S1 18:11 at the base (defaults, LHM ON)**: `dashless ok 2864 t w536 h1 · full refusal w106 limit=budget (deadline
block-route) · hit-avoid w1 cut=budget` → `provisional` → ships dashless, 2864 t, hits `["t1521
spinner-hammer:spinner@112,88"]`, answer `719a637caca4` = the page's live answer.

**Under SIX:** the same, plus `stand-bombs refusal w1 cut=budget` (HSB's try), and the same answer.
- So HSB "tried once, replaced 0" because it was **cut by the budget after 1 unit**. No hitless rerun ran.
- PKSW, PKRB, DSS, OAC and RSB are never asked (re-measure-11's counters, reproduced).

**Which rule lets the hit out:**
- In the worker, `betterAnswer` keeps the dashless plan, because the full pass refused.
- Hit-avoid and HSB run on the attempt's own work clock, which had 1 unit left.
- On the page, `budgetCut(res)` is true, and `expiryAction({provisional: res})` returns `'provisional'` for any `ok`
  answer. The held retry is only ever asked for refusals.

**The same request at more budget:**
- whole ladder at 2560 (and at 10240): `dashless 2864 t h1 · full ok 3929 t h0 (deadline sword-dash, limit window)` →
  the full plan, hitless;
- resumed at `full` alone at 2560 (what the page's retry would send): `full ok 2735 t h0, w1190`.

**L1 18:10** (L1's own request, seam 30052): `dashless ok 3818 t w576 h0 · full refusal w65 limit=budget` → provisional,
3818 t, 0 h, `2e1603a6ae22` = live. The same under SIX. **The S1 and L1 requests differ in one field,
`staging.seam.time` (29994 vs 30052)**, so the band below, shifted on S1's request, covers both. S1's request at 30052
gives L1's 3818 t, 0 h.

## 4. Design + change, OFF identity

**Variant A (first commit, superseded):** `expiryAction` alone returns `'retry'` for a hit plan. The page's retry then
resumes at the cut pass (`passesAfter(answered = 1)` → `[full]`), so the full pass runs with **no plan in hand**, and so
with no upgrade window.
- Over the 45-seam period it fixed **6 of the 7** hit seams, with shorter plans (2540–2735 t).
- At seam 30000 it did not: the resumed full pass declines by name (735 units, not a cut). The page then keeps the cut
  hit plan, as today.
- The same seam's whole ladder at 2560 is hitless (3926 t). The full pass, with the dashless plan in hand, trips its
  window at `sword-dash` and returns a partial-dash plan.

**Variant B (shipped OFF):** the service also holds a hit plan's pass open (`hitPlanHeldOpen`, read where `answered` is
counted). The retry therefore re-runs `[dashless, full]` at 4×, and the full pass sees a plan in hand, as the first
attempt's did. **7 of 7** hit seams are hitless.

**What ON does at each outcome of the retry:**
- a hitless plan → shipped (`betterAnswer`'s verdict rule);
- a hit plan again → `expiryAction` with `retries` 1 → `'provisional'` → the shorter of the two hit plans (today's rule);
- a named decline → the cut hit plan ships (`pollSolve`: `play.best` beats a refusal), as today;
- **cut again with no plan** → `'give-up'`. The goal fails by name (`expiryFailure`), instead of playing the hit plan.
  This is the only way ON can turn a shipped hit into a refusal. It did not occur at any measured seam. The page's own
  rule then applies: a continuation falls back to a forced re-arrival; an arrival goal ends the walk by name.

**No-hit logic:** a hitless plan is never retried (`hitPlanRetryAsks` and `hitPlanHeldOpen` are false on a clean plan;
measured on 37 seams: identical). `HAMMER_FIGHT_FALLBACK` is untouched.

**Hunks** (all local; no edit to `solverBot.js`, the model files, `botDriverV*.js` or `flashPanel/*`):
- `hitPlanRetry.js` (new);
- `jsRuntimeSolver.js`: one re-export line;
- `wasmPlayback.js`: one import, one guarded line in `expiryAction`;
- `jsRuntimeSolveService.js`: one import, one guarded clause in `answered`;
- `solverEnvChannel.js`: the table entry.

**OFF identity:** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum` =
`391322d681b7aa0229d94b3f6906d024`, measured at the base, after `f0b8f3fb` and after `8cebc41b`
(`acceptance-md5.txt`).

**The thread, measured:** on a served page (`tools/mainthread.mjs`, `frontend/index.html`):
- no param → `HIT_PLAN_RETRY.enabled` false, `expiryAction(hit plan)` `'provisional'`;
- `?seedlingSolverEnv=SEEDLING_HIT_PLAN_RETRY%3D1` → true, `'retry'`;
- `…%3D0` → false.

The worker reads the same name off its own URL (`solverEnvShim`), but nothing in the worker decides on it.

## 5. Rows + bounded vitest runs

| file | tier | tests | what it pins |
|---|---|---|---|
| `seedlingDemo/hitPlanRetry.test.js` | default | 9 | The switch: ships OFF; a channel name; the wrapper restores; `billsHit` agrees with `planTakesHit`. The decision: the `hitPlanRetryAsks` grid; `expiryAction` OFF unchanged; ON `'retry'` only for a hit/death plan with a retry left and a pass unanswered, the 24-cell grid differing in exactly 2 cells. The service: a dashless hit plan is `answered` 1 OFF and 0 ON; a clean plan is 1 either way; the `hitPlanHeldOpen` grid. |
| `seedlingDemo/hammerHitPlanRetry.train.test.js` + `hammerHitPlanRetryRows.js` + `fixtures/hit-plan-retry/S1-18-11.request.json.gz` (87 KB) | **train** (four whole-request solves, 26.7 s; `train-shard-costs.json` row) | 3 | **OFF:** S1 18:11 provisional dashless, 2864 t, `719a637caca4`, hits `['t1521 spinner-hammer:spinner@112,88']`, full cut at the budget. **ON:** retried once; attempts `[[640, [dashless, full, hit-avoid]], [2560, [dashless, full]]]`; ships `full` 3929 t, `128f09ae3413`; on a fresh replay hits `[]`, deaths 0, end L39; the retry's full row `{ok, deadline: 'sword-dash', limit: 'window', modelHits 0/0}`. **ON at L1's seam 30052:** equal to OFF (dashless 3818 t, `2e1603a6ae22`, no retry). |

- The fixture is the page worker's request **whole**. Its source is the seed's placed atlas: every level's entities differ
  from the bare committed atlas, so a cut to "the records that differ" would keep all 116. The capture note is in the file.
- Bounded runs, by path:
  - `hitPlanRetry`, `solverEnvChannel`, `jsRuntimeSolveService`, `jsRuntimeSolverAnytime`, `flashPanel/seedlingWasmPlayback`:
    **5 files, 203 passed**;
  - `--config vitest.train.config.js hammerHitPlanRetry.train.test.js`: **3 passed** (26.7 s);
  - `scripts/test/trainShardPlan.test.js`: **21 passed**.
- Regenerate + `--check` (no diff):
  - `census-seedling-solver-surface.mjs --write`: 375 rows, GREEN;
  - `generate-procgen-reference.mjs`: all match;
  - `generate-docs-index.mjs`: current.
- No docs edit under `docs/json/developer/procgen/`, so no procgenDocs pins are owed.

**The seam band** (`band/fine-45-seams.md` + raw):
- S1's request, `staging.seam.time` 29970…30014 at step 1, one period. The period was measured on the coarse band (step 5):
  −40 ≡ +5, −35 ≡ +10, and so on, and L1's band repeats it at 30037 and 30082.
- OFF: **37 clean / 7 hit / 1 refused**. The hit seams are 29989–29994 and 30000, every one `spinner-hammer:spinner@112,88`
  at t1519–1523, every one a budget-cut dashless plan.
- ON: **44 clean / 0 hit / 1 refused**:
  - the 7 retried, hitless, 3317 t (29989–29991), 3940 t (29992–29993), 3929 t (29994), 3926 t (30000);
  - the 37 clean seams identical;
  - the refusal (29980, both passes refuse, the held retry's full pass declines) is OFF's own, unchanged.
- SIX and SIX + HPR at the 7 hit seams (`six/`): the same 7 hits OFF, the same 7 hitless plans ON.
- L1's coarse band OFF (step 5 around 30052): hits at 30037 and 30082 only, the same phase.

**The survey `--through=end`** (defaults vs HPR ON, `survey/`):
- **Identical on all 250 steps** in verdict, ticks, hits, deaths and refusal: 226 solved, 24 refused, both.
- **No step gains a hit.** The steps with hits are the same three either way: 24 (L16, 1), 202 (L82, 2), 220 (L82, 2);
  0 deaths.
- That is by construction: the survey solves through `solverBot.twoPassSolve`, with no work budget, no `solveAnytime`
  ladder and no `expiryAction`. So it shows the OFF-path code is untouched with the switch ON, and it is no witness for
  HPR itself (the band and the game witness are).

## 6. Page play / game witness

`tools/witness.mjs`, CHASER-STAND's `reqwitness.mjs` solving through `pageLadder`. It runs a fresh `seedling_bot_ap_p4g`
page, headless logic-only (`__swfGpu lost 1, stalls 0`), with the delivered AP set, under the box lock. It drives the
whole key stream (prefix 0, the arrival is the staging):

| | plan | game |
|---|---|---|
| **ON** (S1 18:11, seam 29994) | retried, `full` 3929 t; model hits `[]`, end L39 (79.76, 48.42) | **finished 3929/3929, hits 0**, end L39 (79.76, 48.42) |
| OFF (control) | provisional `dashless` 2864 t; model hit t1521 | finished 2864/2864, **hits 1**, end L39 (80.75, 48.89) |

The game agrees with the model both ways, so the model's hit verdict, which HPR reads, is the game's here.

## 7. Census

- **What ON can move:** only a page answer whose attempt was cut at the work budget **and** whose plan bills a model hit
  or death. The switch reads no room, entity or level, so the census is the set of such answers, not a set of rooms.
- **Whole-game captures** (re-measure-11, `hits.py` and the pass rows):
  - S1: 206 solved answers, 2 with hits. 5:7 "Level 017 - Chest" had both passes solve with a hit, with no budget cut, so
    ON is not asked. 18:11 is the **one** budget-cut hit plan.
  - L1 (202) and P1 (209): only 5:7, not asked.
  - **So over 617 solved page answers, ON is asked once.**
  - Over the stop-leg captures (S1 32, L1 33, P1 29 requests), budget-cut answers holding a plan: 2. One is 18:11; the
    other is L1 18:10, which is hitless, so ON is not asked.
- **The seed-1 divergence sweep (915 legs at this head, `seedling-divergence-legs.mjs --presets=seedling_playthrough`):**
  - 18:11's arrival (L39 at 144,608, the south region `level_39__r25c9`) has **no sweep twin**: that region's only leg is
    `level_39__r25c9 <- in_L38_144_0 -> exit:out_teleporter_144_624`.
  - The Totem 72,40 goal appears once, from the north: `level_39__r0c9 <- in_L40_480_912 -> location:Level 039 - Totem
    Part 72,40`. It was run on the page (`sweep/`, one key, OFF and `--solver-env=SEEDLING_HIT_PLAN_RETRY=1`): both are a
    112 t hitless dashless plan with no budget cut (`retries 0`, `budgets [640]`), equal. ON is not asked.
  - No committed sweep row in `CC/docs/cloud-reports/` shows a hit pass beside a budget cut: a per-row scan of every committed uncompressed
    `.jsonl` found 0.
  - So the legs ON can move are, by key, the ones whose page answer is a budget-cut hit plan at the sweep's own
    arrival. Every measured one is hitless or uncut. A full ON sweep was not run (the brief: no full sweeps); that is
    the measurement that would name any other.
- **The survey** cannot move: it solves through `solverBot.twoPassSolve`, with no work budget, no `solveAnytime` ladder
  and no `expiryAction` (§5).
- **The JS frame** (`jsRuntimeSolver.createRuntimeSolver`) has **no held retry**. It plays a budget-cut plan as
  `expired`, so HPR does not reach it (§9).

## 8. What the brief got wrong (measured)

- *"Which rule lets a dashless pass with `modelHits` 1 out as the answer?"* No worker rule ships it on purpose. The worker
  keeps it because the full pass was cut. The page's `expiryAction` plays every budget-cut plan, hit or not. The gate is
  on the page's main thread, not in the ladder.
- *"HSB tried once and replaced 0"* reads like a hitless rerun that failed. It was **cut by the budget after 1 unit**
  (`stand-bombs … w1 cut=budget`), and so was hit-avoid. No hitless rerun ran in the attempt.
- *"It depends on the arrival"* is right. The arrival is one number: S1's and L1's requests differ only in
  `staging.seam.time` (29994 vs 30052). The hit recurs with a 45-tick period, at 7 of 45 seams.
- *"P1 18:10 (seam 30052)"*: P1's capture file holds no leg-18 rows (`P1.stop-requests-32-37-38-39`). L1's 18:10 is the
  witness for that seam. Its request equals S1's at seam 30052, and both give `2e1603a6ae22` / 3818 t, 0 h.
- The approved premise, a page retry, is sound. But resuming at the cut pass is not enough. The retry must re-run the
  hit plan's pass too, so the full pass keeps its plan in hand and its window (§4, seam 30000).

## 9. Residue / hand-overs

- **The JS frame** (`createRuntimeSolver`'s budget branch) has no held retry at all, so a budget-cut hit plan there still
  plays. Giving the JS frame a held retry is a larger change (a retry state machine in the driver) and is not this
  slice's. It is reported, not done.
- **Longer plans:** ON ships 3317–3940 t where the hit plan was 2853–2867 t. Variant A's resumed full pass found shorter
  hitless plans at 6 seams (2540–2735 t). A retry that ran both (the resumed pass and the whole ladder) and kept the
  better is a `flashPanel/seedlingWasmPlayback.retrySolve` change, outside this slice's files: a hand-over if length
  matters.
- **The give-up path:** if a retried hit plan's retry is cut again with no plan, the page fails the goal rather than
  playing the hit plan. That is unmeasured on any real leg (0 of 7 seams). Keeping the hit plan instead would be a
  `pollSolve` change (flashPanel), also a hand-over.
- **Re-merge:** the hunks are additive. `jsRuntimeSolveService.js` and `wasmPlayback.js` are not touched by the other
  hammer slices' usual files (`solverBot.js`). `solverEnvChannel.js`'s table is the one shared line.
- Not run: a full divergence sweep, a whole-game walk, `pytest`, unfiltered vitest, `standing-values --write` (per the
  brief).
