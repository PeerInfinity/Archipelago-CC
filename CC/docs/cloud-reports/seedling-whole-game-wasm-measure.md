# Cloud report: `seedling-whole-game-wasm-measure`

**How far does the Playback Bot get in the whole Seedling game, end to end, in the real wasm game? MEASURE ONLY.**

Coordinator: `seedling-js-planning-16` (js-16). Ruling: Robert, 2026-11-04 ("Yes, js-16 scopes it"). Branch:
`claude/seedling-whole-game-wasm-measure-srmzjm` (the harness pinned this branch; there is no
`seedling-whole-game-wasm-measure` branch). No fixes: no solver, bot, wasm, `vendor/seedling`, preset or rules file was changed.
The only commits are the MEASUREMENT-ONLY instrument (`f232811c`) and this report.

## Headline

**In the real wasm game the bot checks 18 of 48 locations (spheres 0 to 6.5) and stops at entry 19/48, "Level 040 - Boss Key 2"
(sphere 6.6). The cause is a solver refusal**: `solverBot(wasm-location-40)`, "the combat ladder is EXHAUSTED", with a
`bobsoldier@880,832` on the corridor, and then 640 and 2560 work units both run out. The stop took about 23 minutes and was the same in
3 of 3 runs, to within a pixel. No OOM and no crash in any run: the wasm heap stayed at 656 MB throughout, over up to 161 region changes.
The JS runtime (control) stops at **the same entry**, with a different named refusal, so this is a bot/solver stop, not a wasm one.

## Base and subject

| | |
|---|---|
| base | `origin/main` = `26ed405d3f45d3cb86ebae87207035fc08a57e04` ("train: tile-frontier-route 4c06b906f5") |
| wasm submodule `frontend/modules/flashPanel/wasm` | `9968c7dda4c08397e93b0900d73a9e8126cda8b6`, checked out by `session_bootstrap.sh --all` (READY; "seedling wasm builds: OK (4 dirs)") |
| `vendor/seedling` | `ccdf189776471fa57be8c0568c6e881a2d5acc18` |
| box | the cloud container, headless Chromium with WebGPU (the batch's `webgpu: true`), dev server `scripts/serve-nocache.py 8000`, one run at a time under the box lock |
| row | `tutorial-walk-seedling-whole-game`, batch `tutorials-seedling-whole-game` (MANUAL, WebGPU), tutorial S4 `seedling-whole-game`, step `bot-plays` |

### The subject is the VANILLA placement, not a randomized one

`loadPlaythrough` (`frontend/modules/tutorials/content/seedling/seedling.js:27`) loads `PLAYTHROUGH = { game: 'seedling_playthrough',
seed: 1 }`, which is **`frontend/presets/seedling_playthrough/AP_14089154938208861744/`**. That seed is **not randomized**:

- its spoiler says `Randomize Items: No` and `Use Canonical Options: Yes`;
- `worlds/seedling_playthrough/__init__.py:452` forces `randomize_items = False` when `seed == CANONICAL_SEED (1)`, and `pre_fill`
  then places `original_seed_placements`;
- `original_seed_placements` equals `canonical_placements` (the world's "vanilla locations") on all 84 keys, with 0 differences
  (measured with `ast.literal_eval` over the two class dicts).

So the tutorial's whole-game walk plays the original game's own item placement, delivered through the AP path (the page logs a
`seedling-ap-record-01b432a9` level set).

**No randomized Seedling Playthrough preset is committed.** `preset_files.json` lists only seed 1 for `seedling_playthrough`.
`seedling_playthrough/AP_1/` is a procgen rules file, not a registered preset, and `presets/seedling/` is the other world (the
community "Seedling" randomizer, 40 locations, no Flash-panel atlas), which the wasm walk does not play. Committing a randomized
preset would be a preset change, which this slice may not make. So I **generated one locally and did not commit it**:
`python Generate.py --weights_file_path "Templates/Seedling Playthrough.yaml" --multi 1 --seed 2` → **`AP_01043188731678011336`**
(`Randomize Items: Yes`, 48 queue entries, last sphere 11.2; the page loads it as level set `seedling-ap-record-45602886`). It is the
right supplementary subject because it is the same world, rules shape and template as the tutorial's, with only the placement
randomized. It was measured in one run (Arm A′ below). Afterwards I reverted `preset_files.json` and deleted the generated dir.

The queue (both seeds): **48 rows**, the sphere log's non-event locations in order. Victory is row 48, "Level 115 - The Seed"
(sphere 13.2 on seed 1, 11.2 on seed 2). The bot's `(i/48)` counter is that queue.

## Budget knobs used

| knob | value | what it lifts |
|---|---|---|
| `TEST_AUTO_START_TIMEOUT_MS` (existing) | `10800000` (3 h) | the in-app runner's suite budget |
| `TEST_TIMEOUT` (existing) | `11000000` | Playwright's test and wait timeout |
| `TEST_MEASURE_STEP_TIMEOUT_MS` (**new, MEASUREMENT-ONLY**) | `10800000` | the walk steps' done-wait; `bot-plays`'s **180 s is hardcoded** in `botPlaysToTheEnd` (`steps/procgen.js:204`), with no knob |
| `TEST_MEASURE_BOT_STALL_MS` (**new, MEASUREMENT-ONLY**) | `300000` | `botCannotFinish`'s 60 s "status unchanged" window (`BOT_STALL_MS`) |
| `TEST_MEASURE_FLASH_RUNTIME` (**new**) | `js` (Arm B only) | walks the row on the JS runtime through the row's existing session override |
| `TEST_MEASURE_PLAYTHROUGH_SEED` (**new**) | `2` (Arm A′ only) | `PLAYTHROUGH.seed` |
| `TEST_MEASURE_SKIP_REFUSALS` (**new**) | `10` (probes only) | on a bot `error`, log it, count the head as seen, play on |

Bot speed is the walk row's own test speed (`startAppBotTestSpeed`), unchanged. With these values, **every stop below is the walk's
own**. In Arms A and B the bot's status turned to `error: …` and `botCannotFinish` ended the step at once, so neither the 3 h clock
nor the 300 s stall window decided anything. The one stall-window end is the probe run on seed 2, after skips (see below).

## Arm A: the real wasm game, seed 1 (the tutorial's subject), 3 runs

| run | locations checked / total | last sphere reached | stop: level / step | cause by name | wall time (`bot-plays`) | swaps (region changes / wasm teleport pushes) |
|---|---|---|---|---|---|---|
| A1 | **18/48** (bot); 31 in the snapshot incl. event locations | 6.5 done; refused 6.6 | `level_40__r32c36`, entry **19/48 "Level 040 - Boss Key 2"**, `bot-plays` | **solver refusal**: `solverBot(wasm-location-40)` … "the combat ladder is EXHAUSTED", danger `chaser:bobsoldier@880,832` at (887.6,854.6); "ran out of 640, then 2560 work units on its held retry" | 1431.5 s (row 1451.4 s) | 103 / 70 |
| A2 | 18/48 (31) | 6.5; refused 6.6 | same, entry 19/48 | same; danger at (887.7,853.6) | 1383.8 s (row 1399.1 s) | 103 / 70 |
| A3 | 18/48 (31) | 6.5; refused 6.6 | same, entry 19/48 | same; danger at (887.6,854.6) | 1376.6 s (row 1389.9 s) | 103 / 70 |

**Stable: 3/3 identical**, with a wall spread of 1377–1432 s. wasm heap 656 MB at every 15 s sample, in every run. No OOM, no
`RuntimeError`, no page error. The only error line in each run is one `Failed to load resource: … 404` during boot.

Timeline (A1: queue entry first seen @ seconds / region changes): `1@16s/r2 3@150s/r15 5@210s/r22 8@360s/r39 10@555s/r52
12@600s/r57 14@675s/r58 15@870s/r69 17@1065s/r84 18@1095s/r89 19@1410s/r103`. A2 and A3 track it to within ~60 s.

Quoted (A1):
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 1451.4s
[tutorial-walk-timing] seedling-whole-game: load 7.3s, start-game-page 5.9s, start-game 4.1s, bot-plays-open 0.3s, bot-plays 1431.5s
[MEASURE tick] seedling-whole-game t=1440s step=bot-plays checked=31 botQueue=48 botCursor=18 botChecked=18 botRegion="level_40__r32c36" regionChanges=103 wasmPushes=70 transport=wasm wasmMemMB=656 jsHeapMB=179 status="Sphere 6.6 → walking to \"Level 040 - Boss Key 2\" (19/48) — solving again, the room held… (budget 2560 work units, retry 1)"
[WARN] [flashPanelModule] [playback] the wasm playback failed: the solver declined Level 040 - Boss Key 2 in level 40 (pass dashless): solverBot(wasm-location-40) …
[MEASURE end] … status="error: level_40__r32c36: the bot cannot walk to location "Level 040 - Boss Key 2" — the wasm playback failed: the solver declined Level 040 - Boss Key 2 in level 40 (pass dashless): solverBot(wasm-location-40) apitem (656,528) contact -> shove stance (pushableblockfire@576,576) -> hold stance (wandlock@448,432) -> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED. The corridor passes through danger at (887.6,854.6) — chaser:bobsoldier@880,832 (the sword: `swordHitting`'s `collideLine("Player", …)` from 8 to 16 px off the body crosses this box THIS tick (no enemy i-frame and no `destroy` gate refuses it)) — and every rung of ⚖ §11.8a's order refused: — and the solver ran out of 640, then 2560 work units on its held retry on location in level 40"
```
The row reads PASSED because the ratchet grades it against its recorded `firstFailingStep: 'bot-plays'` ("in progress, as recorded:
fails at step 5 of 5 (bot-plays)"). PASSED is **not** victory.

## Arm B (control): the JS runtime, seed 1, one run

| run | locations checked / total | last sphere | stop | cause by name | wall time | swaps |
|---|---|---|---|---|---|---|
| B1 (`transport=js`) | **18/48** (31) | 6.5; refused 6.6 | `level_40__r32c36`, entry **19/48 "Level 040 - Boss Key 2"** | **walk failure + solver deadline**: "not reached within 1800 ticks — stalled at (589.99, 594.09); the planner said: no walkable tile path in level 40 from tile (36,37) to (41,33) … different connected components"; "solverBot(js-runtime-L40-location): the caller's anytime deadline (`shouldStop`) was reached at the `walk` site … ⏱ DEADLINE … this refusal may be the deadline's, not the room's"; "walking instead (after 3 retries)" | 1048.6 s (row 1057.7 s) | 103 / 68 |

```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 1057.7s
[tutorial-walk-timing] seedling-whole-game: load 3.0s, start-game-page 3.5s, start-game 0.2s, bot-plays-open 0.3s, bot-plays 1048.6s
```

**B gets no further than A.** It stops at the same entry after the same 18 checks and the same 103 region changes, only faster
(1049 s against ~1400 s). **The stop is not wasm-only.** The "wasm OOM near 150 swaps" named in the 2026-10-14 comment did not occur:
A ran out of road at 103 region changes, and the probes below reached 142 and 161 on wasm, all at a flat 656 MB. The two runtimes
**name different reasons** at the same spot: wasm says combat ladder exhausted on the bobsoldier; JS says a tile-path split plus the
anytime deadline. That itself is a lead for js-16, not a finding about which is right.

## Arm A′ (supplementary): a RANDOMIZED seed in the real wasm game (seed 2, local, uncommitted), one run

The first stop is the comparable number. The rest of the run is the skip probe (next section).

| run | locations checked / total | last sphere | first stop | cause by name | time to first stop | swaps at stop |
|---|---|---|---|---|---|---|
| A′1 | **13/48** | 4.4 done; refused 4.5 | `level_26__r2c4`, entry **14/48 "Level 030 - Torchpickup"** (route exit `level_26__r2c4 -> level_27`) | **solver refusal**: `solverBot(wasm-exit-26)`: "no corridor for goal reach-exit toward (72,312) in level 26. Obstacle: solid:tree (tree@128,224); also on the frontier: rocklock@112,208, rock2@128,192. **No strategy row exists for this obstacle.** Planner said: no walkable tile path in level 26 from tile (8,13) to (4,19)" | ~909 s | 98 / — |

On seed 1 the same location (entry 11 there) is reached by another route, under a different inventory. A randomized placement
therefore stops **earlier** (13/48) than the vanilla walk (18/48), on a route the vanilla order never asks for.

## What stands between the stop and victory (skip probes; nothing fixed)

`measureSkipRefusals=10`, one run per seed, on wasm. On a bot `error` the probe logs it, marks the refused head as seen and calls
`bot.play()` on the same page. ⚠ Read it as a **lower bound on the work**: a row after a skip can refuse only because the skipped
item was never collected. Rows marked *knock-on* are that, or are the bot stranded by an earlier refusal.

**Seed 1 (vanilla), wasm** (`bot-plays` 1840.8 s; region changes 142; heap 656 MB):

| # | entry | refused leg | named cause | independent? |
|---|---|---|---|---|
| 1 | 19 Level 040 - Boss Key 2 | location, L40 | combat ladder EXHAUSTED, `bobsoldier@880,832`; 640→2560 work units | **yes (the stop)** |
| 2 | 20 Level 040 - Chest | location, L40 apitem (880,816) | combat ladder EXHAUSTED, the **same** `bobsoldier@880,832` ("avoid: … A* goal tile (55,51) … is not walkable: danger:bobsoldier"; "time: … 48 px UPPER BOUND"; "bait: no stance within … leash (80)") | yes (same enemy) |
| – | 21–23 L40 Totem 160,640, L46 Chest, L48 Chest | — | **landed** | |
| 3 | 24 Level 055 - Boss Key 3 | exit `level_53__r14c9 -> level_54__r1c8` | chaser kill `jellyfish@144,192` by press: "still in the world after the whole 174-tick bound", 22.5 px off; 640→2560 work units | yes |
| 4 | 25 Level 089 - Feather | location, L89 | "no corridor … Obstacle: pixelmask:cliffside1 … **No strategy row exists for this obstacle**"; the planner refused 3 upward steps into an armed waterfall (`climbsArmedWaterfall`: without the feather a waterfall is one-way down) | yes (logic says sphere 6 reaches it) |
| 5 | 26 Level 090 - Chest | exit `level_91 -> level_89__r1c10` | combat ladder EXHAUSTED, `enemy:drill@64,80`; "NO LIVE BODY's removal admits a corridor" | yes, and it **strands** the bot in L91 |
| 6–9 | 27–30 (L40/L41/L42 totem parts, L57 Tentacled Beast) | — | "no path from level_91 to … nor from the restart target Menu" | knock-on (stranded) |
| 10 | 31 Level 064 - Ghostspear | exit `level_91 -> level_89__r1c10` | the drill refusal again | knock-on |

**Seed 2 (randomized), wasm** (`bot-plays` 2077.5 s; region changes 161; heap 656 MB):

| # | entry | refused leg | named cause | independent? |
|---|---|---|---|---|
| 1 | 14 Level 030 - Torchpickup | exit `level_26__r2c4 -> level_27` | tree/rocklock corridor, "No strategy row exists" | **yes (the stop)** |
| – | 15 L39 Totem 72,40 | — | landed | |
| 2 | 16 Level 040 - Boss Key 2 | location, L40 | `kill (spinner@880,848) by press: the player died at t732 (chaser bob@736,752)` → `PRESS_KILL_REBOOT_GUARD` (a different inventory, a different rung than seed 1's) | yes |
| 3 | 17 Level 040 - Chest | location, L40 | the same spinner press-kill death (t735) | yes |
| – | 18–20 L40 Totem 160,640, L46 Chest, L48 Chest | — | landed | |
| 4 | 21 Level 055 - Boss Key 3 | exit `level_53__r14c9 -> level_54__r1c8` | "ran out of 640, then 2560 work units … ⏱ DEADLINE … may be the deadline's, not the room's" | yes (the same leg as seed 1's #3) |
| 5 | 22 Level 089 - Feather | location, L89 | cliffside1 / waterfall, the same as seed 1's #4 | yes |
| 6 | 23 Level 090 - Chest | exit `level_92__r4c2 -> level_91` | `bait (jellyfish@120,64)`: "the dwell's condition … is ALREADY TRUE before a tick is spent, so waiting for it proves nothing" | yes; strands in L92 |
| 7–9 | 24–26 totem parts | — | "no path from level_92__r4c2 to … nor from the restart target Menu" | knock-on |
| end | 27 Level 043 - Wand | — | `blocked: the check of "Level 043 - Wand" did not land` for 300 s (the stall window); console: `Location check rejected: not_accessible` | knock-on (its totem parts were skipped) |

**The next refusals, as far as visible** (de-duplicated, in walk order), for the vanilla walk:
1. **L40 bobsoldier@880,832**: blocks both Boss Key 2 and the L40 Chest (2 of the 48 rows directly; Boss Key 2 gates what follows).
2. **L53→L54 jellyfish@144,192** press kill (Boss Key 3). On seed 2 the same leg is a deadline refusal.
3. **L89 Feather**: the cliffside1 pixelmask / armed-waterfall corridor, "No strategy row exists".
4. **L91→L89 exit**: `drill@64,80`. It strands the bot (no path back and no Menu restart), so every later row is unseen.

Past row 31 (sphere 7.10) nothing was observed. Spheres 8–13 (17 rows, incl. The Seed) are **unmeasured**. A randomized placement
adds its own refusals on routes the vanilla order never takes (seed 2's L26 rocklock/tree exit), plus a different L40 rung
(spinner press-kill death).

## MEASUREMENT-ONLY instrument change

Commit `f232811c`, "MEASUREMENT-ONLY: knobs + sampler for the Seedling whole-game walk measure". **Not for landing**; js-16 decides.
Each knob is inert unless its URL param is set (`app.spec.js` adds the param only when the `TEST_MEASURE_*` env var is set). Runs A1
and A2 ran an earlier state of the same diff, without the seed, runtime and skip knobs, which are inert when unset. A3, B, A′ and the
probes ran `f232811c`. The diff:

```diff
diff --git a/frontend/modules/tests/testCases/tutorialTests.js b/frontend/modules/tests/testCases/tutorialTests.js
index 722a6c56..6cdb0fa2 100644
--- a/frontend/modules/tests/testCases/tutorialTests.js
+++ b/frontend/modules/tests/testCases/tutorialTests.js
@@ -28,6 +28,9 @@ import {
 } from '../../tutorials/tutorialExecutor.js';
 import { buildContext } from '../../tutorials/tutorialContext.js';
 import { centralRegistry } from '../../../app/core/centralRegistry.js';
+// MEASUREMENT-ONLY (cloud slice seedling-whole-game-wasm-measure): the walk sampler's readouts.
+import { getActivePanel as getActiveBotPanel } from '../../playbackBot/index.js';
+import { getActivePanelInstance as getActiveFlashPanel } from '../../flashPanel/index.js';
 
 const CATEGORY = 'Tutorials';
 const WALK_CATEGORY = 'Tutorial walks';
@@ -416,10 +419,12 @@ async function tutorialWalkRow(tc, tutorial, { runtime = null } = {}) {
     if (!ui) return tc.getOverallResult();
     // A bot step plays at test speed (botTestSpeed.js); the person's saved settings are untouched.
     const restoreSpeed = await startAppBotTestSpeed();
+    let measure = null;
     try {
         ui.start(tutorial.id);
         // Each step's own time (its action + its done wait), so a doneTimeoutMs margin is measured, not assumed.
         const stepStarts = [];
+        measure = startMeasureSampler(tutorial, stepStarts, ui);
         const outcome = await walkTutorial(tutorial, {
             onStep: ({ index, step }) => { stepStarts.push({ id: step.id, at: performance.now() }); ui._goTo(index); },
             perform: async () => {
@@ -433,8 +438,10 @@ async function tutorialWalkRow(tc, tutorial, { runtime = null } = {}) {
                 const ok = await waitFor(async () => {
                     if (ui.doneSteps.has(step.id) || await step.done(ui.ctx)) return true;
                     failed = step.failed ? (await step.failed(ui.ctx)) || null : null;
+                    // MEASUREMENT-ONLY: a skip probe (?measureSkipRefusals=N) takes a bot error itself, N times.
+                    if (failed && measure?.skipsLeft?.() > 0 && /Playback Bot says "error/.test(failed)) failed = null;
                     return Boolean(failed);
-                }, step.doneTimeoutMs ?? DEFAULT_DONE_TIMEOUT_MS, 250);
+                }, measureStepTimeout(step.doneTimeoutMs ?? DEFAULT_DONE_TIMEOUT_MS), 250);
                 if (failed) throw new Error(`the app shows it cannot finish: ${failed}`);
                 return Boolean(ok);
             },
@@ -454,6 +461,7 @@ async function tutorialWalkRow(tc, tutorial, { runtime = null } = {}) {
         tc.log?.(`${tutorial.id}: ${verdict.message}`);
         tc.reportCondition(`${tutorial.id} — ${verdict.message}`, verdict.ok);
     } finally {
+        measure?.stop();
         await restoreSpeed();
         // A walk that ended early never reached its own restore step (a feature check's ctx.setSetting).
         try { await ui.ctx.restoreSettings(); } catch (e) { tc.log?.(`could not restore the step settings: ${e.message}`); }
@@ -475,6 +483,96 @@ async function tutorialWalkRow(tc, tutorial, { runtime = null } = {}) {
     return tc.getOverallResult();
 }
 
+// ── MEASUREMENT-ONLY (cloud slice seedling-whole-game-wasm-measure) ──────────
+// ?measureStepTimeoutMs= raises every walk step's done-wait to at least that;
+// ?measureBotStallMs= lifts botCannotFinish's stall window. With either set, a
+// `[MEASURE]` line is logged every 15 s (and once at the end) with the bot's
+// status, the checks, the region, the region changes and wasm teleport pushes
+// so far, and the wasm memory size.
+const MEASURE_PARAMS = (() => {
+    try { return new URLSearchParams(globalThis.location?.search ?? ''); } catch { return new URLSearchParams(); }
+})();
+const MEASURE_STEP_MS = Number(MEASURE_PARAMS.get('measureStepTimeoutMs')) || 0;
+const MEASURE_STALL_MS = Number(MEASURE_PARAMS.get('measureBotStallMs')) || 0;
+if (MEASURE_STALL_MS > 0) globalThis.__measureBotStallMs = MEASURE_STALL_MS;
+// ?measureFlashRuntime=js|wasm walks every plain walk row under that Flash runtime (the row's session override).
+const MEASURE_RUNTIME = MEASURE_PARAMS.get('measureFlashRuntime') || null;
+const MEASURE_SKIPS = Number(MEASURE_PARAMS.get('measureSkipRefusals')) || 0;
+const measureStepTimeout = (ms) => (MEASURE_STEP_MS > 0 ? Math.max(ms, MEASURE_STEP_MS) : ms);
+
+function wasmMemoryBytes() {
+    let best = null;
+    for (const f of document.querySelectorAll('iframe')) {
+        try {
+            const w = f.contentWindow;
+            const n = w?.HEAPU8?.byteLength ?? w?.Module?.HEAPU8?.byteLength ?? w?.wasmMemory?.buffer?.byteLength ?? null;
+            if (Number.isFinite(n)) best = Math.max(best ?? 0, n);
+        } catch { /* cross-origin or torn down */ }
+    }
+    return best;
+}
+
+function startMeasureSampler(tutorial, stepStarts, ui) {
+    if (!(MEASURE_STEP_MS > 0 || MEASURE_STALL_MS > 0 || MEASURE_SKIPS > 0)) return null;
+    const t0 = performance.now();
+    let regionChanges = 0;
+    let lastRegion = null;
+    const unsub = eventBus.subscribe('gameState:regionChanged', (d) => {
+        regionChanges += 1;
+        lastRegion = d?.newRegion ?? d?.region ?? d?.to ?? lastRegion;
+    }, 'tests');
+    const sample = (tag) => {
+        try {
+            const bot = getActiveBotPanel()?.getBot?.() ?? getActiveBotPanel()?.bot ?? null;
+            const snap = ui.ctx.snapshot();
+            const checked = (snap?.checkedLocations ?? []).length;
+            const fp = getActiveFlashPanel();
+            const mem = wasmMemoryBytes();
+            const heap = performance.memory?.usedJSHeapSize ?? null;
+            const line = `[MEASURE ${tag}] ${tutorial.id} t=${((performance.now() - t0) / 1000).toFixed(0)}s`
+                + ` step=${stepStarts.at(-1)?.id ?? '?'} checked=${checked}`
+                + ` botQueue=${bot?._queue?.length ?? '?'} botCursor=${bot?._cursor ?? '?'} botChecked=${bot?._checkedSoFar?.size ?? '?'}`
+                + ` botRegion=${JSON.stringify(bot?._currentRegion ?? null)} lastRegionEvent=${JSON.stringify(lastRegion)}`
+                + ` regionChanges=${regionChanges} wasmPushes=${fp?.adapter?.invocationPushes ?? '?'} transport=${fp?.transport ?? '?'}`
+                + ` wasmMemMB=${mem == null ? '?' : (mem / 1048576).toFixed(0)} jsHeapMB=${heap == null ? '?' : (heap / 1048576).toFixed(0)}`
+                + ` status=${JSON.stringify(document.querySelector('.playback-bot .playback-bot-status')?.textContent.trim() ?? null)}`;
+            console.log(line);
+        } catch (e) {
+            console.log(`[MEASURE ${tag}] sampler threw: ${e?.message ?? e}`);
+        }
+    };
+    const timer = setInterval(() => sample('tick'), 15000);
+    // The skip probe: on a bot error, log it, count the refused head as seen and play on from the next entry.
+    // It FIXES nothing; an entry after a skipped item may refuse only because that item was never collected.
+    let skips = 0;
+    let skipping = false;
+    const skipTimer = MEASURE_SKIPS > 0 ? setInterval(async () => {
+        if (skipping || skips >= MEASURE_SKIPS) return;
+        const status = document.querySelector('.playback-bot .playback-bot-status')?.textContent.trim() ?? '';
+        if (!status.startsWith('error')) return;
+        const bot = getActiveBotPanel()?.getBot?.();
+        const head = bot?._queue?.[bot._cursor];
+        if (!bot || !head) return;
+        skipping = true;
+        skips += 1;
+        sample(`skip ${skips}`);
+        console.log(`[MEASURE skip ${skips}] t=${((performance.now() - t0) / 1000).toFixed(0)}s skipping entry ${bot._cursor + 1}/${bot._queue.length} "${head.locationName}" (sphere ${head.sphereIndex}${head.fractionalIndex != null ? '.' + head.fractionalIndex : ''})`);
+        try {
+            bot.stop();
+            bot._checkedSoFar.add(head.locationName);
+            await bot.play();
+        } catch (e) {
+            console.log(`[MEASURE skip ${skips}] play threw: ${e?.message ?? e}`);
+        } finally {
+            skipping = false;
+        }
+    }, 1000) : null;
+    return {
+        skipsLeft: () => MEASURE_SKIPS - skips,
+        stop: () => { clearInterval(timer); if (skipTimer) clearInterval(skipTimer); sample('end'); try { unsub?.(); } catch { /* */ } },
+    };
+}
+
 // The generator games' tutorials switch modules on in the Modules panel and
 // off again at their end — but a walk that stops early never reaches the end.
 // A row switches off what it found off.
@@ -580,7 +678,7 @@ for (const { tutorial, id, kind, category } of walkRows) {
                 : tutorial.status === 'terminal' ? `needs a terminal: it must stop at ${terminalStep(tutorial)?.step.id}`
                     : `in progress: firstFailingStep ${tutorial.firstFailingStep ?? 'null'}`}). Reloads the world loaded before.`,
         // Named per row: the registry tells test functions apart by name.
-        testFunction: { [fn]: (tc) => tutorialWalkRow(tc, tutorial) }[fn],
+        testFunction: { [fn]: (tc) => tutorialWalkRow(tc, tutorial, { runtime: MEASURE_RUNTIME }) }[fn],
         category,
         enabled: false,
     });
diff --git a/frontend/modules/tutorials/content/seedling/seedling.js b/frontend/modules/tutorials/content/seedling/seedling.js
index 5437ae69..6ee86dd7 100644
--- a/frontend/modules/tutorials/content/seedling/seedling.js
+++ b/frontend/modules/tutorials/content/seedling/seedling.js
@@ -19,7 +19,9 @@ import { localMultiworld } from '../steps/multiworld.js';
 
 const WASM_README = 'https://github.com/PeerInfinity/seedling-wasm#readme';
 const RECOMPILER = { panel: 'swfRecompilerPanel' };
-const PLAYTHROUGH = Object.freeze({ game: 'seedling_playthrough', seed: 1, title: 'Seedling Playthrough' });
+// MEASUREMENT-ONLY (seedling-whole-game-wasm-measure): ?measurePlaythroughSeed=<n> plays another committed-or-local seed.
+const MEASURE_SEED = (() => { try { return Number(new URLSearchParams(globalThis.location?.search ?? '').get('measurePlaythroughSeed')) || null; } catch { return null; } })();
+const PLAYTHROUGH = Object.freeze({ game: 'seedling_playthrough', seed: MEASURE_SEED ?? 1, title: 'Seedling Playthrough' });
 const botStatus = { ...BOT, selector: '.playback-bot .playback-bot-status' };
 const botButton = (name) => ({ ...BOT, selector: `.playback-bot .playback-control-bar-button-${name}` });
 
diff --git a/frontend/modules/tutorials/content/steps/procgen.js b/frontend/modules/tutorials/content/steps/procgen.js
index 6f4f1c14..1c036c96 100644
--- a/frontend/modules/tutorials/content/steps/procgen.js
+++ b/frontend/modules/tutorials/content/steps/procgen.js
@@ -47,8 +47,10 @@ export const BOT_STALL_MS = 60000;
 export function botCannotFinish(ctx) {
     const status = ctx.text(botStatus);
     if (status.startsWith('error')) return `the Playback Bot says "${status}"`;
-    if (ctx.unchangedFor('bot-status', status, BOT_STALL_MS)) {
-        return `the Playback Bot has said "${status}" for ${BOT_STALL_MS / 1000} s`;
+    // MEASUREMENT-ONLY (seedling-whole-game-wasm-measure): ?measureBotStallMs= lifts the stall window.
+    const stallMs = globalThis.__measureBotStallMs ?? BOT_STALL_MS;
+    if (ctx.unchangedFor('bot-status', status, stallMs)) {
+        return `the Playback Bot has said "${status}" for ${stallMs / 1000} s`;
     }
     return null;
 }
diff --git a/test_json/e2e/app.spec.js b/test_json/e2e/app.spec.js
index 4a897809..ef3ad157 100644
--- a/test_json/e2e/app.spec.js
+++ b/test_json/e2e/app.spec.js
@@ -68,6 +68,23 @@ test.describe('Application End-to-End Tests', () => {
   if (autoStartTimeoutMs) {
     APP_URL += `&autoStartTimeoutMs=${encodeURIComponent(autoStartTimeoutMs)}`;
   }
+  // MEASUREMENT-ONLY (cloud slice seedling-whole-game-wasm-measure): lift a tutorial walk's step
+  // timeout and the bot's stall window, so a long walk stops on its own, not on the harness clock.
+  if (process.env.TEST_MEASURE_STEP_TIMEOUT_MS) {
+    APP_URL += `&measureStepTimeoutMs=${encodeURIComponent(process.env.TEST_MEASURE_STEP_TIMEOUT_MS)}`;
+  }
+  if (process.env.TEST_MEASURE_PLAYTHROUGH_SEED) {
+    APP_URL += `&measurePlaythroughSeed=${encodeURIComponent(process.env.TEST_MEASURE_PLAYTHROUGH_SEED)}`;
+  }
+  if (process.env.TEST_MEASURE_FLASH_RUNTIME) {
+    APP_URL += `&measureFlashRuntime=${encodeURIComponent(process.env.TEST_MEASURE_FLASH_RUNTIME)}`;
+  }
+  if (process.env.TEST_MEASURE_SKIP_REFUSALS) {
+    APP_URL += `&measureSkipRefusals=${encodeURIComponent(process.env.TEST_MEASURE_SKIP_REFUSALS)}`;
+  }
+  if (process.env.TEST_MEASURE_BOT_STALL_MS) {
+    APP_URL += `&measureBotStallMs=${encodeURIComponent(process.env.TEST_MEASURE_BOT_STALL_MS)}`;
+  }
 
   test('run in-app tests and check results', async ({ page }) => {
     // Counted for the summary: a green run can hide a thrown handler, and the
```

## The criterion today

Robert's criterion is that the bot plays the whole randomized Seedling game to victory in the real wasm game. Today it gets about
**three-eighths of the way through the vanilla placement (18 of 48 checks, spheres 0–6.5, about 23 minutes) and stops for good** in
level 40. A solver refusal stops it: an enemy (a bobsoldier) sits on the only corridor to Boss Key 2, and every combat rung the solver
has refuses. It stops there every time, and the JS runtime stops at the same place, so **neither the wasm OOM nor the 180 s budget is
the limit now**: the budget only hides the stop (at 180 s the walk is at entry 4 of 48), and wasm memory never moved. On a
genuinely randomized seed it stops sooner (13 of 48), at a route the vanilla order never needed. Skipping past the stop shows at
least four more independent refusals before the bot strands itself (around entry 26 of 48, sphere ~7). The last third of the game,
spheres 8–13 including The Seed, has not been seen at all.
