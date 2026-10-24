# seedling-dash-economics — does the dash search pay for itself?

Slice DS of the HAMMER-PHASE planner (`seedling-hammer-phase-planning`), cloud, Opus. **Measure only.** The cheaper
searches were built in a scratch lab, never as code. No default moved, nothing was re-recorded, and no tracked `.js`
changed. Evidence: [`seedling-dash-economics-evidence/`](./seedling-dash-economics-evidence/). Log:
`seedling-bot-log.md` § *Seedling DS — does the dash search pay for itself?*

| | |
|---|---|
| Start SHA | `af12970374` (`origin/main` at checkout; `evidence/w0/sha.txt`) |
| Head | the commit carrying this report. Before it: W0 `90939f4c`, D1/D2 `03cd25b3`, D3 `575d3796`, D4 `823795c0` |
| Branch | `claude/seedling-dash-economics-9383bx` (the harness names it; the brief's `seedling-dash-economics`). Nothing went to `main` |
| Verdict | **Yes, the dash search pays for itself, and it can pay much better.** At window 0 the population gains 750 s of play for 467 s of extra solve (node), net +283 s. Two lab switches cut that extra cost by ~45 % at the same ticks. No scan shape fits inside today's 85 window by itself, because the window is spent before the first dash preview. A dash-only window of 85 that keeps partial schedules ships 78 % of window 0's savings, for 30 % of its extra wall, with no request worse than today. Every option is the user's call; the flip surfaces are below |

## The one thing to know first

**Today's 85-unit window cannot hold an upgrade of any size, and the cause is not the dash search.** The window counts
from the attempt's start, and the full pass re-solves the whole segment:
- the dashless pass's units;
- then the full pass's own re-plan;
- then its drive.

All three use the window before or around the dash scan. On leg 108 those are **36 + 19 + 29 = 84 of 85 units**, which
leaves one preview for a scan that needs 173. Over the population, 28 % of the full pass's units are this non-dash
work. That is why every scan-side shape, however cheap, captures ≤ 10 % at window 85. A window that counts only the dash
scan's own asks is what changes the outcome.

## W0 — the base (PASS)

| row | result |
|---|---|
| base | `git fetch origin main && git checkout -B <branch> origin/main` → `af12970374` |
| bootstrap | `session_bootstrap.sh --seedling`: `READY`, node v22.22.0. **Six** submodules were `-` after `READY` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, swfRecompilerPanel/browser, textAdventureEngine); `git submodule update --init` each. Server `serve-nocache.py 9589` (PID 950) |
| fidelity | **SPINNINGAXE `b0aeccdc8a` is NOT on main** (it is only on `fidelity-harvest/spinningaxe`; no `partialDodgeReprobe` in the tree). **CORRIDOR is not on the base** (no `corridorBodyPricing`), so its optional arm was skipped |
| defaults | budget 640, window 85, backstop 300 s, fine checkpoints ON, passes `dashless` → `full` (`all`, `stop: window`). `strikeIframeLapse` (the lapse) ON, `REFUGE_ETA_CUT` (RE) ON, `PRESS_KILL_DONE_ON_WALK` (DD) ON, `STRIKE_ETA_FLOOR` (the floor) OFF, `HAMMER_ESCAPE` / `_FALLBACK` ON, `HAMMER_APPROACH` / `HAMMER_FIGHT` OFF, `PRESS_KILL_COST` / `STRIKE_SCAN_COST` ON, `PRESS_KILL_BOMBS` OFF, `GHOST_SPINNER_PRESS` / `GHOST_KILL_RUNG` ON. Full dump: `evidence/w0/defaults.txt` |
| identity block | `SEEDLING_PORT=9589 identity-block.sh .` (`evidence/w0/identity-w0.txt`): **equal to WC's W0 row for row**. Maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `36b59445`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639 / 7d4cb820 / 49e23d85`, levels `e28c1e5d / fb1a59e5`, generated set OK, reference ALL 7 + 5 MATCH |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 6b1bf15c`, all exit 0 (= WC) |
| surface / constants `--check` | GREEN **302** · **5,960** literals, 0 drift (WC quoted 296 / 5,882 at its older base) |
| bounded vitest | the files read: `flashPanelSolverBudgetSettings`, `jsRuntimeSolverAnytime`, `jsRuntimeSolverShouldStop`, `jsRuntimeSolveProgress`, `solveProgress`, `fidelityDash`, `solverDeadline` — **7 files, 71 / 71** |

## D1 — the population: window 85 vs window 0, solve by solve

**The population.** `seedling-divergence-sweep.yml` run **38845773709** (main `af12970374`, `capture_requests=true`,
`shards=10`).
- **The cloud CAN download its artifacts** (`gh run download`).
- 834 legs carry captures, 870 requests. The 9 legs without are the sweep's 9 `skipped` legs.
- **L40 legs 397 and 414 are in it.** Both have their dashless pass REFUSE, so no plan is in hand, there is no window,
  and the dash question does not arise. 414 is cut at the budget in both runs.
- **The L18 sweep's 45 residues are node stagings, not page requests,** so none reaches this population. Whatever L18
  legs the page sweep holds are in the 870.

**The replay.** The lab runner is `replay-seedling-solve-request.mjs`'s `replayOnce` plus an instrument
(`evidence/lab/`).
- It runs the worker's own dispatch, with the request's own budget, at `upgradeWindowWork` 85 (as captured) and null
  (window 0).
- Each request gets one fresh node process per window.
- **Box:** 4 cores, 15 GB, `--jobs=3`, load 3–5; 1,740 runs in ~21 min.

**Faithful.** At window 85, **868 / 870 requests equal the page's own answer** on every pass (ok, kind, ticks, work,
deadline, limit) and on the total work.
- The two that differ, **378:1 and 381:1**, have no page answer: the sweep ended both legs `timeout`, because the
  backstop terminated the worker.
- The replay cuts their full pass at budget 2,562. The node replay has no backstop.

**Walls.** Page `solvedMs` / node ms over 726 single-solve legs: median **0.91** (p25 0.69, p75 1.23), and **0.60** over
the 88 solves above 1 s in node. **The node walls below are an upper estimate of the CI page's.** The trade is priced
in units, and the walls are one box's.

**What window 0 changes** (`evidence/d1/analysis.txt`, per request in `requests-85-vs-0.tsv`):

| full pass at 85 | n | at window 0 |
|---|---|---|
| skipped (no sword) | 137 | the same |
| solved | 416 | the same (no window trips) |
| refused | 55 | the same |
| cut by the budget | 51 | the same |
| **cut by the window** | **211** | **175 solve** (170 shorter, 5 the same length), **31 cut by the budget**, **5 refused** |

Window 0 changes only the 211 window-cut requests, by construction: the other 659 requests' units are identical.

**The distribution.**

| | value |
|---|---|
| requests that gain / lose / don't change | **170 / 0 / 700** |
| ticks saved (Σ) | **22,512 t = 750.4 s of play at 30 fps** |
| extra solve (Σ, all 870) | **+42,844 units, +467 s node wall** |
| … on the 170 gainers | +23,720 units, +210 s |
| … on the 41 cut requests that gain nothing | +270 s (31 new budget cuts: +265 s; 5 new refusals: +3.4 s; 5 same-length solves) |
| median gain | 132 t for +0.47 s; **net +3.5 s** |
| ticks per extra unit (gainers) | 0.95 |
| net over the population (play saved − solve added) | **+283 s** |

**The break-even** is ticks saved > 30 × extra solve seconds, counting the solve as time the player waits before the
playback.
- **152 of the 170 gainers repay their solve.**
- 18 do not:
  - the L40 pits 404, 406, 407 and 408, which save 193–232 t for +6.7 to +18.9 s;
  - small 15–30 t gains on L12 (110, 111, 120, 121, 140, 141, 150, 151), L31 (327, 333, 334, 339) and L52 (482, 484).
- Leg 108 itself: 561 → 328 t, +151 units, +0.56 s node (net +7.2 s), matching the slowsolve check's 202 units
  and 328 t. Under (c) below, at the same 85, it ships the same 328 t.

**Where window 0 makes things worse.**
- **No longer plan.** The dashless plan in hand still ships whenever the full pass fails.
- **5 new refusals**, all L12 cheap (112, 132, 142, 152, 162; ≤ 1.4 s).
- **31 new cuts at 640:**
  - L40 from L39 (384–388, 392, 394, 396) and from L43 (400): **+11 to +34 s each, for nothing**;
  - L50 (467, 468), L52 (478–488), L61 (524:1), L74–76 (624, 633:1–3, 635:1, 636) and L95 (725–740): +0.1 to +4 s.

These cuts are the price of window 0 alone. They are what D2's pre-check removes.

## D2 — where the dash search spends its work

Instrumented on the lab copy over the 617 requests where the full pass runs with a plan in hand, at window 0
(`evidence/d2/`). Every candidate preview was recorded with its corridor, start offset, prefix, verdict, ticks and
wall. Each corridor was also recorded with its waypoints, turns, path px, bodies and its undashed walk's legs.

**The full pass's units** (80,168): **72.1 % are dash previews**. The other 27.9 % are the full pass re-planning and
re-driving what the dashless pass already solved.

**Previews:** 57,066; **2,523 accepted (4.4 %)**, of which 2,434 ended in a shipped plan.

| verdict | previews | wall | mean |
|---|---|---|---|
| not-faster | 31,537 | 198 s (24.5 %) | 6.3 ms |
| **leg-bound** (a leg past the 195-tick preview/drive agreement bound) | 17,496 | **527 s (65.2 %)** | **30.1 ms** |
| certified | 5,757 | 60 s (7.4 %) | 10.3 ms |
| danger | 2,235 | 23 s | 10.3 ms |
| stalled / crossing | 41 | 0.1 s | |

**What predicts cost vs payoff:**
- **The undashed walk's longest leg (the strongest predictor).**
  - All 24 corridors whose undashed walk has a leg ≥ 240 t planned **nothing**. They cost 10,847 units and 242 s.
  - Corridors at 198–234 t did plan (4 of 5).
  - The largest single-window saving measured is 98 t (p99 50).
  - ⇒ a corridor more than ~40 t past the bound cannot certify in practice, and the pre-check is answered from the
    baseline the scan already computes.
- **The prefix.** The swing-only prefix `[0]` (no dash) is 14,277 previews (a quarter, 198 s) and was accepted 43
  times. The full chain `[0,2,8,14]` is accepted most (1,213), then `[0,2]` (754), then `[0,2,8]` (513).
- **Corridor length / start position.** Preview cost grows with the walk left: 3.5 ms under 10 t, 27 ms at ≥ 400 t.
  The scan's tail is **not** waste: 436 windows were accepted with < 30 t remaining, and 231 with < 10 t.
- **Turns / bodies / px** predict payoff weakly. Units per saved tick are best for 1-turn corridors (0.83) and
  1-body corridors (0.91); the ≥ 800 px corridors are the leg-bound class again (32 units per saved tick).
- **The opportunistic arm** was retired at R9 12c′, so there is nothing to measure. **`dashRefusals`** is the trace's
  per-kind summary of the same verdicts.

**The answer:** **95.6 % of previews are never accepted.**
- Corridors that plan nothing take 42.6 % of the dash units and **68.5 % of the preview wall**.
- In units of the whole full pass: the never-accepted previews are **68 %** (54,543 of 80,168), and the corridors
  that plan nothing are 31 %. The non-dash re-plan and drive (28 %) is needed but repeats the dashless pass's work.

## D3 — cheaper shapes, measured (not built)

The lab switches are in `evidence/lab/lab.diff` (scratch only). The 617 requests were run against today (window 85)
and window 0. The table is `evidence/d3/shapes.txt` and the per-request tails are `evidence/d3/tails.txt`.

| shape | window | ticks vs w0 | better / **worse** vs today | Δ units | Δ node wall | worst Δ | net s at 30 fps | fits 85? |
|---|---|---|---|---|---|---|---|---|
| today | 85 | 0 % | — | 0 | 0 | — | 0 | yes |
| window 0 | 0 | 100 % | 170 / 0 | +42,844 | +479 s | +33.6 s | +271 | no (a default change) |
| (a) cheap first: whole chain first, stop at first certified | 0 | 93.2 % | 176 / **91** | +36,869 | +499 s | | +201 | no |
| (b) cap 60 previews / corridor, keep accepted | 0 | 58.4 % | 163 / 0 | +13,258 | +161 s | | +278 | no |
| (b) cap 150, keep accepted | 0 | 88.6 % | 170 / 0 | +24,814 | +294 s | | +371 | no |
| stride 2 | 0 | 103.4 % | 194 / **23** | +32,200 | +469 s | | +307 | no |
| tail 10 | 0 | 98.0 % | 170 / **207** | +38,294 | +500 s | | +235 | no |
| no `[0]` prefix | 0 | 101.2 % | 173 / 0 | +34,536 | +426 s | | +334 | no |
| **leg pre-check K = 40** | 0 | **100 % (identical)** | 170 / 0 | +32,387 | +277 s | +16.9 s | +473 | no |
| **`cheap2` = no `[0]` + pre-check** | 0 | **101.2 %** | 173 / 0 | +24,079 | **+264 s** | +17.7 s | **+496** | no |
| `cheap2` | 85 | 10.2 % | 25 / 0 | −2,035 | +30 s | | +47 | yes |
| (c) dash-only window 85 + keep partial | 85 | 70.4 % | 165 / 0 | +16,773 | +193 s | | +336 | the number, not its meaning |
| (c) dash-only window 40 + keep | 85 | 37.9 % | 157 / **34** | +8,579 | +130 s | | +154 | |
| **(c) `cheap2` + dash-only window 85 + keep** | 85 | **77.6 %** | 166 / **0** | +12,345 | **+146 s** | **+7.9 s** | +437 | the number, not its meaning |
| (c) `cheap2` + dash-only window 130 + keep | 85 | 90.6 % | 169 / 0 | +16,086 | +201 s | +10.3 s | +479 | no (130) |

**Readings:**
- **Nothing that leaves the window's meaning alone fits inside 85.** `cheap2` at 85 gets 10 %. The non-dash work spends
  the window (*the one thing to know first*).
- **The brief's (a) and (b) lose to the others.**
  - (a), ordering by D2's cheap and high-payoff class and stopping at the first certified prefix, drops the scan's
    shortest-walk-per-start tie-break. That makes 91 requests worse than today.
  - (b), a per-corridor cap that keeps what was accepted, is dominated by the dash-only window at every cost.
- **The leg pre-check is the one lossless cut.** It gives identical ticks on all 617, and −10,457 units / −202 s
  against window 0. It also removes window 0's worst cases (L40 from L39: +34 s → ≤ +17 s).
- **Dropping `[0]`** changes plans, by +275 t in total. 3 requests are worse than window 0 by 37 t in total
  (408, 410, 403), and none is worse than today.
- **(c), the staged window, is what reaches the ticks without the cost:**
  - **What changes:** count the window in `sword-dash` asks only (a dash preview is a unit), trip only `sword-dash`
    there, and keep the windows a trip had already accepted. Today a trip drops the whole schedule, and the window
    trips every site.
  - **Cost:** the full pass's non-dash work then runs on the 640 budget, as the dashless pass does.
  - **With `cheap2`, at the same number 85:** 77.6 % of window 0's ticks, no request worse than today, +146 s (30 % of
    window 0's +479 s), and the worst single request +7.9 s.
- **Another shape the evidence points to, not measured:** an INCREMENTAL full pass that does not re-solve what the
  dashless pass solved. Only the dash scan and the drive it moves would be re-run. That is the 28 % non-dash share.
  It is a solver restructure, not a switch, and its value is bounded by (c), which already lets that work run outside
  the window.

### The verdict, and the flip surface (the user's)

**The cheapest shape that captures most of window 0's ticks** is `cheap2` plus the dash-only window at 85, keeping
partial schedules.
- **It captures** 78 % of the ticks for 30 % of the extra solve, with no request worse than today, and a worst case of
  +7.9 s against window 0's +33.6 s.
- **If the user accepts a larger number:** dash-only 130 captures 90.6 % for +201 s. `cheap2` at window 0 captures
  101 % for +264 s, with a worst case of +17.7 s.

It needs three switches. Each is the user's to rule and to flip.

| switch (all OFF = today) | owner | what moves when it flips | flip surface |
|---|---|---|---|
| **leg pre-check** (`planSwordDash` returns its refusal when the undashed walk's longest leg > `PREVIEW_AGREEMENT_BOUND` + K; K = 40 measured) | the solver (`solverBot.js`, read-only here) | no tick on this population. A corridor's trace text (`swordDash.why`, `scanned`) where it fires | the seven producer `--check`s run ON. A sidecar whose corridor has a leg > 235 t moves its md5 (expect few: the committed tapes are mostly pre-L40). Witness rows: `fidelityDash` / `solverDeadline` |
| **no `[0]` prefix** (`dashPrefixesFor('all')` minus the swing-only prefix) | the solver; ⚖ ruling 45(b) set "every prefix" | plans: page +275 t on this population. **In place too** (`all` is every committed tape's mode) | a re-record. §42.7 counts 205 dashes on 16 tapes; any of them whose corridor took `[0]` re-plans. The producer `--check`s, `tapeRunner` pairs, the R9 campaign. ⚖ 40: a re-record is a checkpoint event |
| **dash-only window + keep partial** (`passShouldStop`'s window counts only `sword-dash`; `planSwordDash` keeps the accepted windows on a trip) | the JS arc (js-6: `jsRuntimeSolver.js`) and the solver (the keep) | page plans only. In place there is no deadline, so **no tape moves**. Reverses part of ⚖ WINDOW WHOLE PASS (2026-10-06, *"Yes, stop the whole pass"*) | the divergence sweep re-baselined (166 requests ship shorter). `jsRuntimeSolverAnytime` / `ShouldStop` pins, `jsRuntimeSolverCalibration.slow`, `flashPanelSolverBudgetSettings`. The feature check `seedling-dash-window` (its "cut at 85" premise ends: leg 108 ships its whole 328 t plan at 85, 151 units) |

**Dispatches for the planner** (cloud CI returns 403):
- after a flip on a scratch branch, `seedling-divergence-sweep.yml` (`capture_requests=true`, `shards=10`) compared by
  key against run 38845773709;
- `test-substrates-manual.yml` with `batch=feature-checks` for `seedling-dash-window`.

**A page-side A/B is not needed for the answer.** The replay is faithful at 85 (868/870), and the units are deterministic.
- **For the walls,** a page run at window 0 needs a sweep input that stamps the window. That would be js-6's addition,
  and none exists today.
- **Named for js-6:** `seedling-divergence-sweep.yml` input `upgrade_window_work`, stamped into each request.

## D4 — records (PASS)

| row | result |
|---|---|
| log | `seedling-bot-log.md`: `### Seedling DS — does the dash search pay for itself?` |
| reference | `generate-procgen-reference.mjs` then `--check`: **ALL 7 + 5 MATCH** (re-run after the last log edit). `scripts/quicklaunch/generate-docs-index.mjs`: 176 docs |
| surface / constants | `--check` only (no code moved): GREEN **302** · **5,960**, 0 drift |
| bounded vitest | `procgenDocs/generated`, `procgenDocs/docLinks`, `procgenDocs/docsRender`, `quickLaunch/generated`: **4 files, 150 / 150** |
| not run | pytest, unfiltered vitest (⚖ 52), `standing-values --write`, any CI dispatch (403 from the cloud) |

## What the brief got wrong (measured)

1. *"Fidelity's SPINNINGAXE … should be on main by your launch."* It is not. `b0aeccdc8a` is only on
   `fidelity-harvest/spinningaxe`.
2. The brief hoped a cheaper search would fit *"inside the 85 window"*. Under WINDOW WHOLE PASS, no scan shape can.
   The dashless pass plus the full pass's re-plan and drive spend it first (leg 108: 84 of 85). The lever is what the
   window counts, not how the scan spends it.
3. *"The L18 sweep's 45 residues … as they reach the page."* They are node stagings and never reach the page's
   capture. Legs 397 / 414 do, but their dashless pass refuses, so there is no window and no dash question.
4. *"Cut (by the window, the budget or the backstop)."* The node replay has no backstop. The page's two backstop
   endings (378:1, 381:1) have no captured answer, and the replay cuts them at the budget instead.
5. *"Optimize the dash search … the less computationally expensive dash opportunities."*
   - The expensive opportunities are not merely costly per preview. A predictable class (`leg-bound` corridors) never
     pays at all.
   - The cheap opportunities are not where the ticks are. The tail and the cheap short prefixes carry real windows,
     and cutting them regresses.
6. *"The opportunistic arm"* has not existed since R9 12c′.

## Residue

1. **The leg pre-check's K** is calibrated on one population (the page sweep). The boundary sits between 234 t (still
   plans) and 240 t (never plans). A proof (the largest saving a single window can make on one leg) would make it exact.
2. **The committed tapes' exposure** to the `[0]`-prefix drop and the pre-check was not measured here: no producer was
   run with a switch ON. That is the first thing a flip slice measures.
3. **Walls are node's on one loaded box** (load 3–5). The CI page is ~0.6–0.9× of them. A page A/B needs js-6's
   window input (above).
4. **378:1 / 381:1** are backstop endings on the page. The replay's budget cut at 2,562 is not the page's answer.
5. The **incremental full pass** (D3's last reading) is unmeasured. Its ceiling is the 28 % non-dash share.
6. `legGate` and `cap`-drop are built in the lab but were not run in the battery: `legPre` and `capKeep` dominated them
   on the first look.
