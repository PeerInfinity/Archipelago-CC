# seedling-js-l22-l25-divergence — why the JS runtime's bot refuses L22→L25 while wasm walks it

MEASURE + REPORT ONLY. Cloud slice, launched by `seedling-js-planning-24` (js-24); `seedling-hammer-phase-planning-17` copied.
⚖ Robert 2026-11-27T16:11:44Z: "Launch the diagnosis (Recommended)". **No fix was built.**

## Summary for Robert

**L22→L25 (the 8/48 wall) is a budget cut that wasm retries and JS does not.** Both runtimes send the solver the
same question here, and the solver gives the same answer to both. At the shipped budget (640 work units), the first
attempt, a walk without dashes, refuses by name. That refusal is the `CORRIDOR … wallflyer@64,80 …
CORRIDOR_LADDER_NEST 2` text the walk tool quotes. The second attempt, a walk with dashes, then runs out of effort.
The panel shows this second attempt as "out of effort". So the walk tool's message and the panel's message describe
the **same solve**, seen from its two passes.

- **wasm:** the page sees the budget cut and asks once more with 4× the budget (2560), the room held. It finds a
  113-tick plan with 0 hits.
- **JS:** the JS page never asks again with a bigger budget. It takes the refusal, and the bot fails.

With your "no work limit" switch, JS finds the **byte-identical 113-tick plan** that wasm plays. Replays in node give
the same answer every time (1 distinct answer over 3 runs on every request), for both runtimes' requests, at 640,
2560 and no limit.

**L40:** the first item is the same story. Both runtimes are cut at 640, and wasm's held 4× retry is what passes it.
The spinner refusal you saw is a different kind of thing:
- On wasm, the same spinner@816,848 refusal comes from the *continuation* request for the second item. It refuses
  at every budget, unlimited included, so more budget would not help.
- Wasm gets past it by falling back to a fresh solve.
- On JS the outcome depends on where the first item's plan left the player. In my no-limit JS walk (J0) that second
  item solved, so your live refusal did not reproduce here.

One more real difference turned up. **The JS runtime resets the game clock to 4800 at every room boot**, where wasm
keeps the game's running clock. At L22 it changes nothing. At L40 it changes *which* plan is found: the spinner's
hammer angle comes from that clock. J0's next wall after L40 is an unrelated JS-only refusal at L57 ("no teleporter
or pit on tile (6, 4)"). The fix for the 8/48 wall would go in the JS page's solver driver
(`jsRuntimeSolver.createRuntimeSolver`): give it the held 4× retry wasm has. That is a recommendation only; it needs
your word as its own slice.

## Base, knobs and probes

| item | value |
|---|---|
| base | `origin/main` @ **`102dcbeb16`** (train 227). LHM (train 228) had **not** landed at the end (re-fetched: main still `102dcbeb`), so every arm ran on one base |
| wasm builds | `frontend/modules/flashPanel/wasm` @ **`9968c7dda4c08397e93b0900d73a9e8126cda8b6`** (gitlink = checkout) |
| bootstrap | `scripts/cloud/session_bootstrap.sh --all` → READY. Dev server `scripts/serve-nocache.py 8000`; 4 CPUs |
| capture / solver-env knobs | **already on main**: the brief's `0f6f207310` / `744e85dcd1` are on main as `58a65911` / `cd9c3719`. Cherry-picking them conflicted only against themselves, and the three files at main are byte-identical to `744e85dcd1`'s (`git diff 744e85dcd1 HEAD --` those files is empty). Nothing was cherry-picked |
| probe 1 (MEASUREMENT-ONLY) | `d1d9da5e` + `a3b1633f`: `TEST_MEASURE_CAPTURE_SERVICE=<regex\|1>` → `?measureCaptureService=`. A probe in `jsRuntimeSolveService.createWorkerSolveService.start` appends every request that **either** runtime's service posts, with its settled answer, in the replay's input format (`captureRequest`). It needs the existing capture binding. `a3b1633f` reaches it through `window.top`: the JS page is the iframe `jsRuntime.html`, and the first J0 attempt captured nothing (see "Restarts") |
| probe 2 (MEASUREMENT-ONLY) | `3028cb27`: `TEST_MEASURE_SOLVER_NO_LIMIT=1` → `?measureSolverNoLimit=1`. The walk row sets `moduleSettings.flashPanel.seedlingSolverNoWorkLimit` and `…SolverBackstopOff` to true (`persist: false`). The panel's `_refreshSolverLimits` (`flashPanelUI.js:626-642`) pushes them to the JS page: `setSolverBudgetWork(0)`, `setSolverBackstopMs(0)`. Verified on the page: every J0 solve logs `budget no work limit`, and its requests carry `budgetWork: 0` |
| measured heads | W1 `d1d9da5e`; J0 (restarted), J1, W2, J2 `a3b1633f`. W1's results file records `treeMoved: true` (`d1d9da5e`→`3028cb27`): probe 2 was committed while W1 ran. Probe 2 is inert without its env var, and W1's page and spec were already loaded |

**OFF is byte-identical** (`evidence/offproof.mjs`): the same two requests were posted through main's
`jsRuntimeSolveService.js` (`git show origin/main:…`) and through the probed one, with a fake worker. Output:
`messages 2 2 byte-identical: true`. With the `__measureCaptureAppend` binding present but no URL parameter:
`byte-identical: true`. The appender throws if it is called; it was not called. Probe 2 is a single
`if (MEASURE_PARAMS.get('measureSolverNoLimit') === '1')` in `tutorialTests.js`, and a single
`if (process.env.TEST_MEASURE_SOLVER_NO_LIMIT === '1')` in `app.spec.js`. `npx vitest run
frontend/modules/seedlingDemo/jsRuntimeSolveService.test.js` passes 22/22.

**The probe records what the worker received, faithfully.** On W1, the probe's L22 rows #45/#46 are byte-identical
(sorted-key JSON) to the existing harness capture's entry-9 rows i7/i8:
`probe#45 == capture id9 i7: True`, `probe#46 == capture id9 i8: True`.

**Restarts.** The first J0 (head `3028cb27`) was stopped at t≈100 s by literal PID: the probe's gate was off inside
the iframe. The probe was fixed (`a3b1633f`), smoke-tested (`jsmoke`, 150 s: JS-frame rows appear, first answer
`9815665bf4e4` = wasm's first), and **J0 was re-run in full**. There was no container restart.

## The arms (seed 1, base defaults except J0)

| arm | runtime / knobs | checked | stop | cause (quoted) | L22→L25 solve: work / budget, cut? | hits (plan's `modelHits`) |
|---|---|---|---|---|---|---|
| **W1** | wasm, capture ON | 13/48 | entry 14 "Level 012 - Chest" | `budget: the step's wait ran out` (600 s arm budget, by design; past entry 9) | a0 **643/640, full pass `limit: budget`** → retry 1 **817/2560 SOLVED, 113 ticks** | 0 |
| **W2** | wasm, capture ON | 23/48 | entry 24 "Level 089 - Feather" in `level_57` | `budget: the step's wait ran out` (1500 s, by design; past L40) | a0 643/640 cut → retry 817/2560 SOLVED, 113 ticks (same answers `d777bfb2c075` → `78614fcbef7f`) | 0 |
| **J1** | JS, capture ON | **8/48** | entry 9 "Level 025 - Chest" in `level_22__r8c0` | `refusal … the solver declined — solverBot(js-runtime-L22-exit) reach-exit (0,128)->L25 -> kill (bob@96,144) stance -> kill (bob@96,144) stance: CORRIDOR — the corridor meets chaser:wallflyer@64,80 … (CORRIDOR_LADDER_NEST 2) … — solving… (budget 640 work units)` | **643/640, full pass `limit: budget`; no retry** (one request, answer `124fe8a24dc3`) | — |
| **J2** | JS, capture ON | **8/48** | entry 9, same exit | same text, verbatim | 643/640 cut, no retry (answer `124fe8a24dc3`) | — |
| **J0** | JS, **no work limit + backstop off** | **23/48** | entry 24 "Level 089 - Feather" in `level_57` | `refusal "error: level_57: the bot cannot walk to exit \"level_57 -> level_58__r4c1\" — the JS runtime refused {"kind":"exit","level":57,"tiles":[[6,4]],…}: level 57 has no teleporter or pit on tile (6, 4)"` | unlimited: **SOLVED, 113 ticks, answer `78614fcbef7f` = wasm's retry plan, byte for byte** (dashless refused, full solved) | 0 |

k/N at L22→L25: **wasm 2/2 pass** (both through the held retry). **JS at the defaults 0/2** (and re-measures 6–10 before
this). **JS unlimited 1/1 pass.** The answer did not vary between repeats on either runtime. The verdict was the
same in all 5 arms. The "bimodal" walk was not seen at this exit.

## Replays (`replay-seedling-solve-request.mjs --n=3 --live`; a budget is set by editing the request's `budgetWork`, as the replayer has no flag)

Answer hashes are sha1[0:12] of the plan or the refusal text. The refusal text embeds the request's name, so the
wasm refusal `d777…` and the JS refusal `124f…` are the same text with the name swapped (checked: equal over the
282-character common prefix).

| request | budget | verdict | dashless pass | full pass | answer | runs |
|---|---|---|---|---|---|---|
| W1 #45 wasm L22 a0 | 640 | REFUSED | refusal, work 178 | **cut** (`limit: budget`), 465 | `d777bfb2c075` = page | 1/3 distinct |
| W1 #46 wasm L22 held retry (full only) | 2560 | **SOLVED** 113 ticks | — | ok 817, hits 0 | `78614fcbef7f` = page | 1/3 |
| W1 #45 @ 4× (both passes) | 2560 | **SOLVED** 113 | refusal 178 | ok 817 | `78614fcbef7f` | 1/3 |
| W1 #45 unlimited | 0 | **SOLVED** 113 | refusal | ok | `78614fcbef7f` | 1/3 |
| J0 #62 JS L22 @ shipped | 640 | REFUSED | refusal, 178 | **cut**, 465 | `124fe8a24dc3` = **J1/J2 page** | 1/3 |
| J0 #62 @ 4× | 2560 | **SOLVED** 113, hits 0 | refusal 178 | ok 817 | `78614fcbef7f` | 1/3 |
| J0 #62 @ 4×, held-retry shape (full only) | 2560 | **SOLVED** 113 | — | ok 817 | `78614fcbef7f` | 1/3 |
| J0 #62 unlimited | 0 | **SOLVED** 113 | refusal | ok | `78614fcbef7f` = J0 page | 1/3 |
| J0 #62 @ 640, `seam.time` → 15874 (wasm's) | 640 | REFUSED | 178 | cut 465 | `124fe8a24dc3` | 1/1 |
| J0 #62 unlimited, `seam.time` → 15874 | 0 | SOLVED 113 | | | `78614fcbef7f` | 1/1 |
| W1 #45 @ 640, `seam.time` → 4800 (JS's) | 640 | REFUSED | 178 | cut 465 | `d777bfb2c075` | 1/1 |
| W2 #93 wasm L40 item (880,816) a0 | 640 | REFUSED | **cut** (`kill-chaser`, budget), 643 | **cut** (`walk`, budget), 1 | `668f4ca7aff6` = page | 1/3 |
| W2 #93 @ 4× | 2560 | **SOLVED** 1106 ticks, hits 0 | ok 774 (1126 t) | ok 857 | `8e2c3dcc23fd` = page retry #94 | 1/1 |
| J0 #126 JS L40 item (880,816) unlimited | 0 | **SOLVED** 1022, hits 0 | ok (1094 t) | ok | `a0d702e11a78` = J0 page | 1/3 |
| J0 #126 @ shipped | 640 | REFUSED | **cut** (`kill-chaser`), 643 | **cut** (`walk`), 1 | `5d514a643e92` | 1/3 |
| J0 #126 @ 4× | 2560 | **SOLVED** 1022 | ok 735 | ok 722 | `a0d702e11a78` | 1/3 |
| J0 #126 @ 640, `seam.time` → 33953 | 640 | REFUSED (cut) | | | `5d514a643e92` | 1/1 |
| J0 #126 @ 4×, `seam.time` → 33953 | 2560 | SOLVED **1106** | ok 774 | ok 857 | **`8e2c3dcc23fd` = wasm's plan** | 1/1 |
| W2 #93 @ 4×, `seam.time` → 4800 | 2560 | SOLVED **1022** | ok 735 | ok 722 | **`a0d702e11a78` = JS's plan** | 1/1 |
| W2 #95 wasm L40 item (160,640) continuation | 640 | REFUSED by name | refusal 66 | refusal 66 | `72fb6ec7ac18` = page | 1/3 |
| W2 #95 unlimited | 0 | **REFUSED by name** (`combat ladder is EXHAUSTED … danger at (524.8,680.7) — spinner:spinner@816,848`) | refusal | refusal | `72fb6ec7ac18` | 1/1 |
| J0 #127 JS L40 item (160,640) unlimited | 0 | SOLVED 785, hits 0 | ok 834 t | ok 785 t | `59f9ba4d8666` = page | 1/3 |
| J0 #127 @ shipped | 640 | SOLVED 785 (work 150) | ok 55 | ok 95 | `59f9ba4d8666` | 1/1 |

The `REPLAY:` lines are in `evidence/replay-L22.REPLAY.txt` and `evidence/replay-L40.REPLAY.txt`. Every request
gave `1 distinct answer(s) over N, 1 distinct trace(s)`.

## The diff: the JS vs wasm request for L22→L25 (J1 #70 vs W1 #45; normalised, sorted keys, persistence as a set)

| field | wasm (W1 #45) | JS (J1 #70) | effect on the verdict |
|---|---|---|---|
| `budgetWork` | 640 | 640 | — (equal; J0's request has 0) |
| `upgradeWindowWork` | 85 | 85 | — |
| `passes` | `[dashless(none, all), full(all, +sword-dash, window)]` | absent → the worker's `ANYTIME_PASSES`, **the same two** (`jsRuntimeSolveWorker.js:116`) | none |
| `solverGoal` | `reach-exit (0,128)` | same | — |
| `live` (the start digest: position, velocity, tick, deaths, slot) | — | **equal** | — |
| `perTick` | `[]` | `[]` | — |
| `equips`, `scratchPersistence`, `staging.boot/despawn/equips/grants/inventory_slots/noDamage/noHazards/noclip/save` | — | **equal** | — |
| `source.records` (the room atlas) | — | **equal** | — |
| `staging.seam.items` | 13 flags | the same 13 + `hitsMax: 3` (`jsRuntimeCore.js` stages `hits_max` through `items`) | none |
| `staging.seam.{beam, cutscene, hits_max, menu_state, rock_set, secondary}` | present, defaults | absent | none |
| `staging.persistence` | 32 rows | 24 rows, a **strict subset**: wasm carries 8 more, for rooms 10, 11, 17 (×2), 19, 20, 36, 86 | none here (other rooms) |
| `staging.pins` | `[sound, dead_frames]` | `[dead_frames, sound]` (order) | none |
| `staging.rng` | `{seed: 1920394485, split: true}` | `{seed: 0, fp: 987286273, split: false}` | none measured |
| **`staging.seam.time`** | **15874** (the game's running clock; 15919 in W2) | **4800** (`PAGE_BOOT_TIME`) | **none at L22** (swapped both ways: same work and answers) |

**There is no divergent INPUT that explains the L22 verdict.** The two requests get the same work (178 + 465) and
the same verdict at 640, and the same plan at 2560 or unlimited. **The first point where the runtimes differ is the
PAGE's handling of the budget-cut answer:**

- **wasm**, `frontend/modules/flashPanel/seedlingWasmPlayback.js:1544-1549` (BASE):
  ```js
  if (!play.request.producer && budgetCut(res)) {
      …
      const unanswered = (handle.answered ?? 0) < (play.request.passes?.length ?? 0);
      const action = expiryAction({ provisional: res, retries: play.retries, unanswered });
      if (action === 'retry' && retrySolve(cut)) return;
  ```
  `retrySolve` (`:1419-1444`): `const budget = play.budget * SOLVE_RETRY_BUDGET_FACTOR;` and
  `passes: passesAfter(play.request.passes, cut.answered), budgetWork: budget` (it resumes at the cut pass);
  `svc().start(req, { attempt: { retry: play.retries, … } })`. The policy is in
  `frontend/modules/seedlingDemo/wasmPlayback.js:1047` `SOLVE_RETRY_BUDGET_FACTOR = 4`, `:1049`
  `MAX_SOLVE_RETRIES = 1`, and `:1064-1067` `expiryAction` (`'retry'` when the answer is a refusal, a pass was left
  unanswered by the cut, and a retry is left).
- **JS**, `frontend/modules/seedlingDemo/jsRuntimeSolver.js` `createRuntimeSolver` (BASE):
  - `:1441-1443` — `// ⛓ RETRY ATTEMPT — this solver never re-asks a start at a larger budget: each start is attempt 0` →
    `service.start(…, { attempt: { retry: 0, budgets: … [budget] } })`;
  - `:1506` — `const expired = budgetCut(r);` is used only for stats (`stats.expiries`) and the note for a provisional
    plan;
  - `:1515-1517` — `if (!r.ok) { if (r.kind === 'divergence') return { failed: r.message }; return
    decline(String(r.message), r.obstacle ?? null); }`. The budget-cut refusal becomes a **decline**, whose text is
    the dashless pass's named refusal.
  - The walker then fails the goal at once. It takes one of its "never walk" arms (`jsRuntimeWalker.js:465-485`:
    arrival-inside-solid / priced danger / event-or-encounter; the probe did not keep `obstacle`, so which one is
    not measured). Its decline-retry (`SOLVER_RETRY_AFTER_TICKS` 90 / `SOLVER_RETRY_MAX` 3, `jsRuntimeSolver.js:98-99`)
    is never reached. If it were, it would re-ask **at the same budget** after walking, not at 4×.

## Reconciling the walk tool and the panel (js-24's (e), (f))

They report the **same solve**, at the **same budget**: 640 on the CI walk (`budgetWork: 640` in J1/J2's request; the
walk tool's status reads `budget 640 work units`). The panel's "work limit ON" is the shipped
`SOLVER_BUDGET_WORK` 640. Per rung, from the solver's own answer (J1 #70 `result.passes`):

| rung | pass | verdict | work | limit | text |
|---|---|---|---|---|---|
| 1 · Plain walk | `dashless` | **refusal by name** | 178 | — (not cut) | `… CORRIDOR — the corridor meets chaser:wallflyer@64,80 … (CORRIDOR_LADDER_NEST 2) …` |
| 2 · With dashes | `full` (+sword-dash) | **cut** (`deadline: sword-dash`, `limit: budget`) | 465 | budget | — ("out of effort") |

The answer's `message` is rung 1's text, so the walk tool quotes rung 1. The panel shows each rung, and rung 2's cut
is the "out of effort / deadline". **(f)** Rung 2 solves at 4× (2560; work 817 alone, 995 with rung 1 run again) and
at unlimited, with 113 ticks and 0 model hits. Rung 1 refuses at every budget; it is never cut.

## L40 (js-24's (c))

- **Item (880,816), the first L40 solve:** the requests differ in the same fields as at L22, and
  `seam.time` 33953 (wasm) vs 4800 (JS). **Both are budget cuts at 640, and both solve at 2560.** Wasm's **held
  retry is what passes it there** (page: #93 cut → #94 retry 2560 SOLVED, 1631 work). `seam.time` is the one field
  that changes the plan: the JS request with wasm's clock plays wasm's exact plan (`8e2c3dcc23fd`, 1106 ticks), and
  the wasm request with the JS clock plays JS's exact plan (`a0d702e11a78`, 1022 ticks). `procgenOracle.js:227-228`:
  `seam.time` is "day/night phase, AND `Spinner`'s hammer angle".
- **Item (160,640), the spinner:** wasm's continuation request (#95, prefix 1106 ticks from its first plan)
  **REFUSES BY NAME at every budget**, unlimited included:
  `the combat ladder is EXHAUSTED. The corridor passes through danger at (524.8,680.7) — spinner:spinner@816,848`.
  That is (32.8, 42.5) in tiles, close to the "(30, 42) (spinner@816,848)" of Robert's live refusal. **It is a
  refusal, not a cut. The held retry does not pass it** (no budget would). Wasm passes it by falling back to a fresh
  solve from the room (`contFallback`; page #96 SOLVED, 494 ticks).
- JS's request for the same item starts from JS's *own* first-item plan (prefix 1018 ticks, a different `live`). It
  **solved** on the J0 page and in replay **even at 640** (work 150). So the two L40 requests for this item are not
  the same request: they start from different arrival states, because the first-item plans differ, because
  `seam.time` differs. **Robert's live L40 refusal did not reproduce in J0.** The likeliest reading, which is NOT
  measured: his live run reached that item from yet another state (a different first plan or clock: a restored save
  stages its own `Main.time`, `jsRuntimeCore.js:688`), and the JS page has no fresh-solve fallback after a named
  refusal. The J0 L40 requests are in `evidence/J0.requests.jsonl.gz` (#126, #127) for hammer-17's PKH+MU replay.

## Verdicts

| hypothesis | L22→L25 | L40 |
|---|---|---|
| **H1** — the solver is given different inputs | **REFUTED.** The requests differ only in fields that do not move this solve (table above; `seam.time` swapped both ways: no change). Same work and verdict at every budget. The hammer-9 lead (wallflyer@64,80 as an unbridged static enemy on JS): the CORRIDOR refusal names `chaser:wallflyer@64,80` with the same text on **both** runtimes, and the requests carry no runtime-specific enemy input: `source.records` is equal, and neither request carries a switch stamp (`killLockBodies` / `contactFidelity` / `dashShape` …, `stampHooks`): their top-level keys are identical apart from `passes`. So it is not a JS-only classification at this base | **PARTLY.** Item 1: the verdict is not input-driven (both cut, both solve at 4×), but `seam.time` picks *which* plan. Item 2: the requests differ in their arrival state (a consequence of item 1's plan), and only wasm's refuses |
| **H2** — no held retry on the JS frame | **CONFIRMED.** Page: wasm cut → retry 2560 SOLVED (W1, W2); JS cut → decline → bot fails (J1, J2). Replay: the JS request at 4× solves. Unlimited (J0) passes with wasm's exact plan. Code: `jsRuntimeSolver.js:1441`, `:1515-1517` vs `seedlingWasmPlayback.js:1544-1549` | **CONFIRMED for item 1** (wasm passes through its held retry; the JS request at 640 is cut and needs 4×). **Not the cause for item 2** (a refusal by name at any budget) |
| **H3** — anything else | **NOT the cause at L22, but FOUND:** (a) `seam.time` — the JS runtime restages the day clock at `PAGE_BOOT_TIME` (4800) at **every room boot** (`jsRuntimeCore.js:688` `time = restoredTime … : undefined` → `bootStaging({…, time})` `:695` → `GENERATED_BOOT_TIME` `procgenOracle.js:253`), while wasm's `Main.time` keeps counting; (b) the JS staging carries fewer `persistence` rows (other rooms' clears) and another `rng` form. Same arrival state and same entry at L22 on both | **(a) moves L40's plan** (measured above). **(c) the JS-only L57 wall** (J0's stop): `jsRuntimeCore.js:1755-1761` refuses the exit `level_57 -> level_58__r4c1` because tile (6,4) holds no `EXIT_TYPES` entity and no pit cell, before any solve. Wasm walks that exit. It is out of this brief's scope and **not diagnosed further** |

## Where a fix would go (recommendation only — nothing was built; a fix needs Robert's word)

1. **The 8/48 wall: a held 4× retry in the JS page's solver driver.** `frontend/modules/seedlingDemo/jsRuntimeSolver.js`,
   `createRuntimeSolver` → `take()` (`:1505-1517`). On `budgetCut(r)` with a refusal and a pass left unanswered, re-`start`
   once at `budget × SOLVE_RETRY_BUDGET_FACTOR`, resuming at `passesAfter(...)`, the room still held: the same policy
   as `wasmPlayback.expiryAction` and `seedlingWasmPlayback.retrySolve`. Measured expectation: L22→L25 then plays the
   113-tick, 0-hit plan, and L40's first item solves (JS #126 at 2560: SOLVED).
2. (Optional, a separate ruling) **the clock**: `jsRuntimeCore.js:688/695`, carry the run's `gameTime` across room
   boots, so JS plans match wasm's (measured at L40: wasm's clock → wasm's plan, byte for byte).
3. (Separate) the L57 exit check, `jsRuntimeCore.js:1755-1761`.

- **Engine closure:** `node scripts/procgen/seedlingDerivedRuleTable.js --print-engine-closure` prints 43 files
  (maze/procgen rule-engine modules). **None of `jsRuntimeSolver.js`, `jsRuntimeCore.js`, `jsRuntimeWalker.js`,
  `jsRuntimeSolveService.js`, `jsRuntimeSolveWorker.js`, `wasmPlayback.js`, `seedlingWasmPlayback.js`,
  `procgenOracle.js` is in it.** So a fix at (1) does not move the derived rule table.
- **Survey / sweeps:** (1) is page-side and changes no `solveAnytime` answer: every replay above is a pure function of
  its request. So the survey, the divergence sweeps and the replays would not move. Only JS-runtime walks and
  JS-runtime in-app rows that hit a budget cut would, and that is reasoned, not measured. (2) would change JS plans
  (L40's, measured), and so it may move any JS-runtime row or witness that pins a JS plan. Not measured.

## Evidence (`CC/docs/cloud-reports/seedling-js-l22-l25-divergence-evidence/`, 3.5 MB total)

- `W1/W2/J0/J1/J2.requests.jsonl.gz` — the probe's rows for the L22 and L40 solves (request as the worker received it +
  the page's answer + per-pass rows): W1 #45/#46, W2 #45/#46/#93–#96, J0 #62/#126/#127, J1 #70, J2 #64.
- `<arm>.measure.log.gz`, `<arm>.summary.txt`, `seq.log` (start/end/head per arm, and the J0 restart note).
- `replay-*.requests.jsonl.gz` (the replayed variants), `replay-*.out.jsonl` (one row per run), `replay-L22.REPLAY.txt`,
  `replay-L40.REPLAY.txt`.
- `diff-L22-W1_45-vs-J1_70.txt`, `diff-L40a-W2_93-vs-J0_126.txt`, `diff-L40b-W2_95-vs-J0_127.txt` (`sumreq.py`).
- `run-arm.sh`, `seq.sh`, `sumreq.py`, `diffreq.py`, `offproof.mjs` — the runners and checks.
