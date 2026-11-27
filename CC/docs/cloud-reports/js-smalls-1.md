# Slice `js-smalls-1`: the save-switch hint, the nightly comment, the two walk instruments

Planner, reviewer and landing queue: `seedling-js-planning-23` (js-23). Local worktree, branch `js-smalls-1`,
base `754b1909bb` (= `git merge-base HEAD origin/main` at launch). Gated slice tip: `c29a39c3e8`. main then moved to
`d05f789087`, so it was merged as `102c1a97c4` and the push gates were re-run there (js-23: the tip runs stand for the
diff; the train re-runs TT and the batches). This report is the last commit, docs-only, on top of the merge.

⚖ Robert's rulings (session 5c21eccb, AskUserQuestion, 2026-11-26T19:16:17.687Z):

1. Ruffle "Use the save" leftover: **"Leave it, note it in the UI (Recommended)"**, *"A one-line hint next to the
   switch: 'takes effect on the next game load'. Small js-arc slice or ride-along."*
2. Nightly yml comment: **"Fix the comment (Recommended)"**, *"Comment-only edit riding js-23's next docs/closure-nil
   train; no schedule change."*
3. Instruments: **"Land them as instruments (Recommended)"**, *"js-23 packages both, off by default, on a normal train
   after its gates; re-measures then run from main."*

## Item 1: "takes effect on the next game load" (`3fba35472a`)

- **Files:** `frontend/modules/flashPanel/flashPanelUI.js`, `frontend/modules/flashPanel/seedlingRuffleSaveToggle.test.js`,
  `frontend/modules/flashPanel/seedlingJsSaveToggle.test.js`, `docs/json/user/modules/flashPanel.md`.
- **What changed:** `SETTINGS_CONTROLS` rows take an optional `hint`. Both "Use the save" rows (Ruffle and JS) carry
  `SAVE_SWITCH_HINT` = "takes effect on the next game load". It is drawn as a muted line inside the row, after the
  switch and its label (`.flash-panel-setting-hint`, #777, 11px, italic). The panel had no hint style, so this is
  the smallest muted line. There is no behaviour change and no new setting.
- **The JS switch gets the hint too, on a measurement.** I bound a bare panel ON, which restored the stored save
  (n=7), then played (n=8) and switched OFF through `_onJsSaveSettingChanged`:
  - The run stayed at n=8 and play went on to n=9. `restoreSave` was called once, at the load only. Nothing rewound.
  - Switched back ON, the run stayed at n=9, there was still no restore, and storage got zero further reads.
  - So neither direction touches the running game. Only the next load reads the save.
  - Caveat: the JS *write* side acts at once. ON starts writing and OFF stops it, as the user doc already says.
    The hint is about what the game is playing from, which only the next load changes.
  - The measurement is the new row "switched OFF mid-run after a restore: nothing rewinds…" in
    `seedlingJsSaveToggle.test.js`. It uses the real controller and the panel's own methods on a fake core.
- **Pin:** `seedlingRuffleSaveToggle.test.js` "⛓ SAVE HINT". It renders the Settings section on a minimal fake
  document (the repo has no jsdom) and checks:
  - exactly the `seedlingJsSave` and `seedlingRuffleSave` rows carry the hint;
  - its text is "takes effect on the next game load";
  - it is the row's last child.
  - Mutation check: dropping the Ruffle row's hint turns this row red by name.
- **Shots** (live panel, port 8142, Settings open):
  - [ruffle-save-hint.png](js-smalls-1-shots/ruffle-save-hint.png): the Flash runtime selected.
  - [js-save-hint.png](js-smalls-1-shots/js-save-hint.png): the JS runtime selected.
  - The rendered row's text was read back: "Use the save" + "takes effect on the next game load".

## Item 2: the nightly comment (`9bad871c3c`)

- **Files:** `.github/workflows/test-substrates-nightly.yml` and `.github/workflows/README.md`. Comments and docs only;
  the cron `37 10 * * *` is unchanged, and the YAML parses.
- **What changed:** the cron comment no longer places 02:37 / 03:37 "inside the 22:00–07:00 after-hours window". It
  now says both hours fall deep in the night: after the 20:00–21:30 Pacific B1 dispatch window (⚖ 2026-11-21) and
  before the day's push gates. It keeps the point that the cron is not shifted twice a year.
- **The same commit fixes two README statements of the old rule:**
  - § *Substrate tests — nightly manual batches*, Triggers: it said "still inside the after-hours window".
  - § *After-hours bulk runs (B1)*: it said "The nightly above is in the window too". That is now false; it reads
    that the nightly is not a B1 dispatch.
  - CLAUDE.md's "Nightly + after hours" lines already state 20:00–21:30 and were left alone.

## Item 3: the two walk instruments (`58a659112b`, `cd9c3719d0`, `c29a39c3e8`)

- **Cherry-picked with `-x`, in commit order:** `0f6f207310` (TEST_MEASURE_CAPTURE_REQUESTS) and then `744e85dcd1`
  (`--solver-env`, which builds on it). Both applied clean on `754b1909bb` with no drift.
  - Files: `frontend/modules/tests/testCases/tutorialTests.js`, `scripts/procgen/walk-seedling-whole-game.mjs`,
    `test_json/e2e/app.spec.js`.
  - The picked messages still say "Not for landing". Ruling 3 supersedes that, as the follow-up commit says.
- **Docs:** `docs/json/developer/procgen/seedling-bot.md`, where the walk's other knobs are documented. Each knob has a
  row in the flag table and in the env table, plus one example command:
  - `--capture-requests=test-results/whole-game-walk/requests.jsonl`
  - `--solver-env=SEEDLING_STRIKE_IFRAME_LAPSE=0`
  - The docs also note a limit: `--solver-env` splits on commas, so a value that contains a comma needs
    `TEST_MEASURE_SOLVER_ENV` set directly. `generate-procgen-reference.mjs` was re-run (docsIndex,
    instruments census), and `check-procgen-docs.mjs` passes everything.
- **OFF-by-default proof:**
  1. *The walk script (measured).* `measureEnv(parseArgs([]))` has neither env var. The pre-existing `toEqual` row
     pins the whole no-flag env, unchanged. Each flag passes only its own env var.
  2. *`app.spec.js` (source pin).* Each of the following sits directly under its own knob's guard:
     - the `&seedlingSolverEnv=` param and `page.on('worker')`, under `if (process.env.TEST_MEASURE_SOLVER_ENV)`;
     - `&measureCaptureRequests=1` and `exposeFunction('__measureCaptureAppend')`, under `if (measureCapturePath)`.
     - Mutation check: hoisting the solverEnv param out of its guard turns the row red.
  3. *`tutorialTests.js` (source pin).* `MEASURE_CAPTURE` is true only for `?measureCaptureRequests=1`.
     - The one call is `MEASURE_CAPTURE ? await startRequestCapture(…) : null`.
     - When OFF, `stop` returns `capture?.stop()`, which is undefined, so there is nothing to await.
     - The codec and solve-service imports are dynamic and live inside the capture.
     - `MEASURE_ACTIVE` is unchanged when the knob is unset, so with no knob set there is no sampler, as before.
  4. *Bundled boot.* `npm run build` inlines the dynamic `scripts/procgen/seedlingSolveRequestCodec.js` (1.8 kB) as a
     lazy dynamic-import module. It has no imports and no top-level effects (two pure functions), so OFF it never runs.
  5. *CI with the knobs unset:*
     - TT 45884395316: all 9 jobs green.
     - `tutorials-seedling-whole-game` 45884398917, the walk the instruments live in: 1/1 PASSED in 193.7 s. Its log has
       no `[MEASURE` line, no `seedlingSolverEnv=` param and no `measureCaptureRequests`.
     - `feature-checks` 45884402165: 10/10.
  - Pins 1–3 are in `scripts/procgen/walkSeedlingWholeGame.test.js` (§ "the walk instruments are OFF by default").
  - The re-measure-9 / -10 branches were not touched.

## Gates

**At the slice tip `c29a39c3e8`** (headSha on every run):

| Gate | Run | Result |
|---|---|---|
| JSUT (push) | 45884334163 | success; suite 1451/30292 vs base `754b1909bb` 1451/30287 → **+0 F / +5 T**; train tier skipped (no train-tier file) |
| unittests (push) | 45884334210 | success |
| TT (dispatch) | 45884395316 | 9/9 jobs green |
| `tutorials-seedling-whole-game` | 45884398917 | 1/1, 193.7 s of 600 s (32 %), instruments OFF |
| `feature-checks` | 45884402165 | 10/10, 69.4 s of 600 s (12 %) |

**Headroom**, against the median of main's three samples at `754b1909bb` (runs 45878591158, 45867180328,
45883863809). Both are inside +20 s and 70 %, so no re-sample was needed.

| Leg | main | median | tip | Δ |
|---|---|---|---|---|
| fast | 336.9 / 327.3 / 328.4 s | 328.4 s | 327.2 s (55 %) | −1.2 s |
| fast, bundled | 341.3 / 331.6 / 346.6 s | 341.3 s | 317.5 s (53 %) | −23.8 s |

Main's third sample (45883863809) went red on its bundled leg, on `test_region_graph_sub_region_merged`.
- js-23 identified it as the known badge flake. The `regionMap: … u.obstacles.get is not a function` painter warnings
  in that log are pre-existing, on both boots, in green and red runs alike; js-23 sent them to an owner.
- Neither is in this diff.

**At the merge `102c1a97c4`** (origin/main `d05f789087`):
- The conflicts were generated counts only (procgen README, `procgenDocs/generated/docsIndex.js`). They were
  regenerated after `git submodule update frontend/modules/shared`: main bumped that submodule, and without the update
  the generator read the old checkout. Diff vs origin/main = exactly the slice's 14 files, **0 gitlinks**.
- Main brought `3467fc6575`, which refuses a comma-joined `?seedlingSolverEnv=` spec. It is compatible: the walk's
  `--solver-env` joins entries with `;`.
- JSUT 45897756665: success; suite 1453/30353 vs main `d05f789087` 1453/30348 → **+0 F / +5 T**.
- unittests 45897756595: success.

**Closure and bounded vitest:**
- Closure ∩ diff = **∅**, at the tip and at the merge.
- engineMd5 `74ae60f575531492ed9eaec1839e1fe3` at base = tip = merge: none of its 42 files changed.
- Bounded vitest (every test importing a touched file, plus `frontend/modules/flashPanel/`, `--maxWorkers=3`):
  - tip: 108 files / 2005 tests green;
  - merge: 113 of 114 files green, plus `procgenDocs/`. The one red, `seedlingWasmPlayback.test.js` "clause FADE"
    (a 60.8 s wall-clock wait, run while another session held the box), was 152/152 green solo and is untouched by
    the slice and by main.
- `check-procgen-docs.mjs`: ALL CHECKS PASSED.
