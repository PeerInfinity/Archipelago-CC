# SEEDLING HAMMER-PHASE — slice SIBLING-EXIT (`seedling-hammer-sibling-exit`)

## 1. SHAs

- Start: `5634df8868e21e7963ce7ef4d05ea861bf0c0b1a` (main after TRAIN 193).
- Branch: `claude/seedling-sibling-exit-yc70tc`.
- Code head: `9614304fa49ed3a7fdfbfddba118a4be5815c5a5`. The report is the commit after it, which carries the `Cloud-Status` trailer.
- Evidence: `CC/docs/cloud-reports/seedling-hammer-sibling-exit-evidence/` (`README.txt`, `tools/`, `step1/`, `step4/`, `step5/`).
- Planner follow-up followed: `seedling-hammer-phase-planning-13`'s wording fix. The LICENCE is wider than the shared
  boundaries: the controller, the region-binding file and the survey are allowed. I used two of the three (see §4; the binding
  needed no change).

## 2. The answer first

**Switch: `SIBLING_EXIT_CHOICE`** (`frontend/modules/seedlingDemo/siblingExitChoice.js`). `SEEDLING_SIBLING_EXIT_CHOICE=1` turns it on,
and `withSiblingExitChoice(enabled, fn)` is the wrapper. It is in `SOLVER_ENV_NAMES` and **ships OFF**.

**The one thing to know first:** the region binding already credits the door actually taken. A pit writes no
`pendingExit`; the game's `level` report comes with `Main.playerPositionX/Y` equal to that exit's own ctor spawn. The binding
tie-breaks on that spawn, and 7/7 L16 pit landings are credited as the exit taken. On the real game the reports were
(144,32) ON and (112,32) / (112,48) OFF. So the binding needed **no change**. The whole fix is goal resolution plus the solve.

Results, switch ON:
- **The census moves exactly the 4 L16 pit legs (the 2 (arrival, group) pairs).** They are 4 of 160 sibling-group legs.
  - All 4 ship `level_16__r1c9 -> level_17 #3` (tile 14,3) with **0 hits**, against 1 hit OFF (`17:bob@96,32` on the landing).
  - 156 legs are unchanged, and **no leg gains a hit**.
- **The real game witness** (wasm, a fresh page per leg, 4 legs × OFF/ON):
  - OFF: each leg takes 1 hit in L17 on the landing.
  - ON: each leg ships `#3` and is hitless through the fall plus about 65 idle frames.
- **The JS runtime** (page → walker → `keysFor` → in-place solve) ships `#3` too, lands at ctor (144,32), takes 0 hits, and the
  note names the sibling.
- **The survey** (`--through=end` and `--through=4.2`):
  - step 24 (L16) goes from 273 t / 1 hit to 311 t / 0 hits;
  - step 25 (L17) now arrives at (144,32) and goes from 63 t to 76 t, still 0 hits;
  - no step gains a hit.
- **OFF is byte-identical:**
  - acceptance md5 is `391322d681b7aa0229d94b3f6906d024` at the base and at the tip;
  - the survey `--through=end` (250 steps) and `--through=4.2` (39 steps), base vs tip OFF, have every row equal once
    wall-clock fields are dropped.

## 3. The reproduction (measured)

**Where the route's exit name becomes a goal.** `seedlingPlaybackController.resolveSeedlingAtlasGoal` gives
`{kind:'exit', level, tiles: exit.exit_tiles, name}` for the ONE exit the route names (`seedlingPlaybackController.js:221` at the base).
- On the wasm runtime, the engine maps that goal with `wasmArrival.arrivalSolverGoal` (`nearestPitAt` → `reach-pit` at that tile).
- On the JS runtime, `createRuntimeSolver.keysFor` maps it with `solverGoalFor`.
- Both runtimes solve with `jsRuntimeSolver.solveAnytime`: the solve worker on the page, or the in-place service.

**Where the arrival door is checked.** In `flashPanel/seedlingRegionBinding.js`:
- `_resolveDeparture` handles only an **external** door, from a `pendingExit` report. In the AS3 only `Teleporter.as:107` writes
  that report; `Stairs` extends it, and a pit is no Teleporter.
- A pit crossing therefore goes through `_resolveCrossing` → `resolveCrossingExit(world, level, lastSpawn)`: every departure of
  the region reaching that level, tie-broken by distance from the reported spawn to each exit's `target_spawn`.
- The fall reports the ctor exactly. `Player.checkFallingInPit` calls `new Game(fallthroughLevel, x, y)`, the
  `Game.playerPosition` setter writes `Main.playerPositionX/Y`, and those two are declared before `level` in `games/seedling.json`.

**What refuses today if a sibling is taken: nothing.**
- `tools/binding-pit-arrivals.mjs` → `step1/binding-pit-arrivals.jsonl`: each of the 7 landings, fed as the game reports it,
  publishes `regionMove {sourceRegion: level_16__r1c9, targetRegion: level_17, exitName: <the exit taken>}`, 7/7.
- The Playback Bot advances on `targetRegion` (`playbackBotUI.onRegionMove`), and all 7 siblings reach `level_17`.
- The JS walker completes a pit exit on any pit crossing out of the goal's level (`jsRuntimeWalker.observe`). The wasm engine
  checks a leg's end against the plan's own `expected` end (`legEndRefusal`).
- **So the bot can arrive through `in_pit_L16_9_2` when the route named `_7_2`, with no change.**
- Caveat: a report 8 px off the ctor (the model's centre-x) would mis-credit the second- and third-row tiles
  (`offByCentre` in the jsonl). The game's own report is exact (§6), so nothing is wrong today.

**The named exit's hit** (the lookahead's reproduction, re-run through this slice's production path, `tools/sibling-leg.mjs`):
`level_16__r1c9 <- in_L17_32_48 ~> level_16__r3c7 -> exit:out_pit_7_2` ships full 149 t and replays 1 hit, `17:bob@96,32`. The
level changes at t70, the ctor is (112,32), and the hit comes on the landing.

## 4. Design and change; OFF identity

**Each part and the thread it runs on:**

| part | where | thread |
|---|---|---|
| switch read | `SIBLING_EXIT_CHOICE.enabled = process.env… === '1' \|\| pageSolverEnvSwitchOn('SEEDLING_SIBLING_EXIT_CHOICE')` | page **main** thread (YETI-TALK's pattern) / node |
| sibling-set derivation | `apSiblingExitsOf(rules, player, regions)`: exits of one source region with the same `connected_region`, the same rule OBJECT (`sameApRule`, key-order-blind deep equality) and both DOORS (sidecar tiles) into the same level. Generic. | main (map build, `realRoomPlaybackMap`, ON only) |
| goal | `resolveSeedlingAtlasGoal` adds `siblings: [{name, tiles}]` (exit-name order), ON only | main |
| mapper | `attachSiblingSolverGoals`: wasm in `arrivalSolverGoal` (covers arrivals and continuations); JS in `keysFor`'s `start` call, via a new `resolveExit` dep (`jsRuntimeWalker.exitResolutionOf`, the same cell rule as `arrivalSolverGoal`) | main |
| per-sibling solve + choice | `solveAnytime`'s sibling arm → `solveWithSiblings`: the named exit is solved first, with `onPass` heard, so a provisional plan is today's. **Only if its plan takes a hit** is each sibling solved from the SAME request (the goal swapped), in fixed order. Then `chooseSiblingExit` picks. | **solve WORKER** (and node / in-place); it reads no switch and answers what the request carries |
| note | `forcedHitNote` (read by both runtimes' notes) prefixes `sibling exit "…#3" in place of "…" — <why>` | both |
| survey | `--through` crossing goals carry `siblings` (from `hopEdge` per sibling); the step child solves the siblings when the crossing step's replay hits; the parent hands the next step `--arrival-override=<x>,<y>` | node |

**The choice** (js-22 item 3, `chooseSiblingExit`):
- Ship the named exit, unless its plan takes a hit or a death and a sibling's plan takes none.
- Among the hitless siblings, take the fewest ticks, then the lowest exit name (code-point order). Solve-time order never decides.
- If every sibling hits or has no plan, keep the named exit and say so in `why`.
- A named exit with no plan keeps its refusal: the choice moves a hit, not a refusal.

**Extra work per sibling group** (`step5/summary.txt`, node, the 4-core box under a concurrent survey):
- Where the named exit is hitless, **0 extra solves**. That is 156 of 160 legs; the median ON−OFF wall time is −1 ms.
- On the 4 L16 legs, the arm adds 6 solves:
  - +3.5 s and +3.8 s (`in_L17_32_48`, against 0.2–0.4 s);
  - +24.5 s and +26.0 s (`in_L15_144_16`, against 1.1–1.2 s).
- Each sibling gets the normal page budget. The `in_L15` siblings are expensive, and that cost stays inside one held solve.

**What did NOT change:**
- `seedlingRegionBinding.js`: measured unneeded (§3).
- `seedlingWasmPlayback.js` and every other `flashPanel/*` file except the controller.
- solverBot, the fidelity model files, botDriver*, rules, AS3, wasm, gitlinks.

### The licensed hunks, quoted exactly (for js-22)

(`git diff 5634df8868 9614304fa4 -- seedlingPlaybackController.js survey-seedling-route.mjs`; also in `evidence/licensed-hunks.diff`.
The seedlingDemo hunks (five files) are in `evidence/seedlingDemo-hunks.diff`.)

```diff
diff --git a/frontend/modules/flashPanel/seedlingPlaybackController.js b/frontend/modules/flashPanel/seedlingPlaybackController.js
index 83cfed4e..15af391c 100644
--- a/frontend/modules/flashPanel/seedlingPlaybackController.js
+++ b/frontend/modules/flashPanel/seedlingPlaybackController.js
@@ -110,6 +110,8 @@ import SEEDLING_PLAYTHROUGH_ATLAS_DOC from './atlases/seedling-playthrough.json'
 // ⛓ LIGHTS WIRING — import-free (the model's switches as data; the panel's closure already holds it through
 // `seedlingContactSettings.js`): a wired boss fight is walked only while its switch is ON (`BOUND_BOSS_FIGHTS`).
 import { CONTACT_FIDELITY } from '../seedlingDemo/contactFidelity.js';
+// ⛓ SIBLING-EXIT — the AP-equivalent sibling exits (switch OFF: no map or goal carries them; a leaf module).
+import { SIBLING_EXIT_CHOICE, apSiblingExitsOf } from '../seedlingDemo/siblingExitChoice.js';
 
 /** The substrate this controller walks (the default instance; J3 builds a second for the atlas rooms). */
 export const SEEDLING_PLAYBACK_SUBSTRATE = 'flash_seedling_gen';
@@ -218,6 +220,12 @@ export function resolveSeedlingAtlasGoal(target, atlas, { liveLevel = null, regi
             if (!Array.isArray(exit.exit_tiles) || exit.exit_tiles.length === 0) {
                 return { refused: `the atlas exit "${name}" marks no exit tiles to walk onto` };
             }
+            // ⛓ SIBLING-EXIT (ON only) — the route's exit, with its AP-equivalent siblings for the solve to weigh.
+            const siblings = SIBLING_EXIT_CHOICE.enabled ? atlas?.siblingExits?.get?.(exit.exitName) ?? null : null;
+            if (siblings?.length) {
+                return { goal: { kind: 'exit', level: payload.level, tiles: exit.exit_tiles, name,
+                    siblings: siblings.map((x) => ({ name: x.name, tiles: x.tiles.map((t) => [...t]) })) } };
+            }
             return { goal: { kind: 'exit', level: payload.level, tiles: exit.exit_tiles, name } };
         }
         // ⛓ VANILLA MAP — a rules exit between two sub-regions of ONE level is a LOGICAL link (it carries a
@@ -528,17 +536,20 @@ export function realRoomPlaybackMap(loaded, rawRules, { atlases = [SEEDLING_PLAY
     const player = roomPlayerOf(playerId);
     const regions = new Map(atlasRoomRegions(rawRules, player).map(({ region }) => [region,
         rawRules.preset_sidecars[player][region].playable_payload]));
+    // ⛓ SIBLING-EXIT (ON only) — every door's AP-equivalent siblings, read off the rules (OFF: the map is today's).
+    const siblings = SIBLING_EXIT_CHOICE.enabled ? { siblingExits: apSiblingExitsOf(rawRules, player, regions) } : {};
     if (loaded.arm === RANDOMIZER_ARMS.ATLAS) {
         const ev = runtimeEventsOf(rawRules, player);
         return { arm: RANDOMIZER_ARMS.ATLAS, entries: loaded.entries ?? [], refused: ev.refused.length ? [...(loaded.refused ?? []), ...ev.refused] : loaded.refused ?? [],
-            events: ev.events, regions, links: realRoomLinks(rawRules, regions) };
+            events: ev.events, regions, links: realRoomLinks(rawRules, regions), ...siblings };
     }
     // The vanilla arm's result carries no `arm` field (its shape predates the other two): it is the arm
     // whose load DELIVERED a rewritten set.
     if (!loaded.set) return null;
-    return vanillaArmPlaybackMap({ entries: loaded.entries ?? [], encounters: loaded.encounters ?? [],
+    const map = vanillaArmPlaybackMap({ entries: loaded.entries ?? [], encounters: loaded.encounters ?? [],
         reports: loaded.reports ?? [], set: loaded.set, regions, rules: rawRules, playerId: player,
         ...rulesAtlasOf(rawRules, atlases, player) });
+    return siblings.siblingExits ? { ...map, ...siblings } : map;
 }
 
 const ROOMS_OF = Object.freeze({ flash_seedling_gen: 'generated rooms', flash_seedling: 'atlas rooms' });
diff --git a/scripts/procgen/survey-seedling-route.mjs b/scripts/procgen/survey-seedling-route.mjs
index 632d5b4b..c009869f 100644
--- a/scripts/procgen/survey-seedling-route.mjs
+++ b/scripts/procgen/survey-seedling-route.mjs
@@ -199,6 +199,14 @@ import { parseDashMode, dashModeNote } from './dashMode.js';
 
 import { argvHelp } from './argvHelp.js';
 import { seedlingSurveyDir, throughSurveyDir } from './seedlingSurveyDir.js';
+/**
+ * ⛓ SIBLING-EXIT (`SEEDLING_SIBLING_EXIT_CHOICE=1`, OFF: nothing below runs and no row gains a field) — under
+ * `--through`, the crossing "the door AP's path took" also offers its AP-equivalent siblings (same region, same
+ * `connected_region`, same rule OBJECT: `siblingExitChoice.apSiblingExitsOf`); a step whose crossing plan takes a hit
+ * solves each sibling and ships the choice (`chooseSiblingExit`), and the next step arrives where the chosen one lands
+ * (the parent hands it to that step's child as `--arrival-override=<x>,<y>`).
+ */
+import { SIBLING_EXIT_CHOICE, apSiblingExitsOf, chooseSiblingExit } from '../../frontend/modules/seedlingDemo/siblingExitChoice.js';
 import { DEFAULT_SURVEY_PRESET, assertPresetId, deliveredMapDocument, presetRulesPath, sphereOrderFor } from './surveyPreset.js';
 
 argvHelp(import.meta.url);
@@ -219,6 +227,14 @@ const argOf = (k, dflt) => {
 };
 const STEP = argOf('step', null);
 const ONLY = argOf('only', null);
+/** ⛓ SIBLING-EXIT (ON only) — the parent's hand-over: this step arrives where the previous step's chosen sibling lands. */
+const ARRIVAL_OVERRIDE = (() => {
+    const v = argOf('arrival-override', null);
+    if (v === null) return null;
+    const [x, y] = v.split(',').map(Number);
+    if (!Number.isInteger(x) || !Number.isInteger(y)) { console.error(`ERROR: --arrival-override=${v} is not <x>,<y>`); process.exit(2); }
+    return { x, y };
+})();
 /**
  * ⛓ STRATEGY SWITCH r1 — `--disable=<name>[,<name>…]`: every step solved with those strategies switched off
  * (`twoPassSolve`'s `disable`; the flag is ON by default, and with `SEEDLING_STRATEGY_SWITCH=0` every step REFUSES by
@@ -622,6 +638,26 @@ function hopEdge(from, to, hop) {
     }
 }
 
+/**
+ * ⛓ SIBLING-EXIT (ON, `--through` only) — the AP-equivalent siblings of the exit AP's path took out of `from`, each
+ * resolved to its own crossing by `hopEdge` (a sibling with no edge is dropped). `[]` OFF, or when it has none.
+ */
+let SIBLINGS_BY_EXIT = null;
+function crossingSiblings(from, to, hop) {
+    if (!SIBLING_EXIT_CHOICE.enabled || !THROUGH || !hop?.name) return [];
+    SIBLINGS_BY_EXIT ??= apSiblingExitsOf(apRules, '1', new Map(Object.entries(apRules.preset_sidecars?.['1'] ?? {})
+        .map(([r, side]) => [r, side?.playable_payload])));
+    const out = [];
+    for (const sib of SIBLINGS_BY_EXIT.get(hop.name) ?? []) {
+        const { edge } = hopEdge(from, to, { region: hop.region, name: sib.name });
+        if (!edge) continue;
+        out.push({ name: sib.name, kind: edge.kind === 'pit' ? 'reach-pit' : 'reach-exit',
+            ...(edge.kind === 'pit' ? { pit: { ...edge.pit } } : { exit: { ...edge.exit } }),
+            arrival: edge.arrival ? { x: edge.arrival.x, y: edge.arrival.y } : null, via: edge.via });
+    }
+    return out;
+}
+
 // ─────────────────────────────────────────────────────────────────────
 // 2. THE ROUTE — three BFS legs over AP's own region graph
 // ─────────────────────────────────────────────────────────────────────
@@ -1144,7 +1180,10 @@ function buildSteps(visits, legs, id) {
                 //   (the solver falls through after the drop); a second
                 //   reach-pit goal would ask for the fall twice.
             } else if (edge?.kind === 'pit') {
-                goals.push({ kind: 'reach-pit', pit: { ...edge.pit }, why: `${edge.via} → L${next.level}` });
+                // ⛓ SIBLING-EXIT (ON only) — the crossing carries its AP-equivalent siblings.
+                const siblings = crossingSiblings(v.level, next.level, v.exitOut);
+                goals.push({ kind: 'reach-pit', pit: { ...edge.pit }, why: `${edge.via} → L${next.level}`,
+                    ...(siblings.length ? { exitName: v.exitOut.name, siblings } : {}) });
             } else if (edge) {
                 // ⛓ fidelity BOSSFORK D3 (ON only: OFF no edge is `tentaclebeast@`): the mouth stands only once the beast
                 //   is dead, so its crossing is the fight first, unless this visit's goals already clear its report —
@@ -1153,7 +1192,10 @@ function buildSteps(visits, legs, id) {
                 if (mouthFight && !goals.some((g) => g.kind === 'clear-tag' && g.obstacle === mouthFight.obstacle)) {
                     goals.push(mouthFight);
                 }
-                goals.push({ kind: 'reach-exit', exit: edge.exit, why: `${edge.via} → L${next.level}` });
+                // ⛓ SIBLING-EXIT (ON only) — the crossing carries its AP-equivalent siblings.
+                const siblings = crossingSiblings(v.level, next.level, v.exitOut);
+                goals.push({ kind: 'reach-exit', exit: edge.exit, why: `${edge.via} → L${next.level}`,
+                    ...(siblings.length ? { exitName: v.exitOut.name, siblings } : {}) });
             }
         }
         const prev = visits[i - 1];
@@ -1768,6 +1810,53 @@ async function solveOneStep(step) {
         };
     }
 
+    /**
+     * ⛓ SIBLING-EXIT (ON only: no goal carries `siblings` OFF) — the crossing's plan takes a hit: each AP-equivalent
+     * sibling is solved from the same boot with the crossing goal swapped, replayed the same way, and the step ships
+     * `chooseSiblingExit`'s choice. The row names it (`siblingExit`), with every sibling's verdict.
+     */
+    let siblingExit = null;
+    const crossingGoal = solvable.at(-1);
+    if (solved && replay && Array.isArray(crossingGoal?.siblings) && crossingGoal.siblings.length > 0) {
+        const hurt = replay.hits > 0 || replay.deaths > 0;
+        const rows = [{ name: crossingGoal.exitName, ok: true, ticks: solved.out.perTick.length, hits: replay.hits,
+            deaths: replay.deaths, via: crossingGoal.why }];
+        const tried = [{ solved, replay }];
+        if (hurt) {
+            for (const sib of crossingGoal.siblings) {
+                const sibGoals = [...goals.slice(0, -1), sib.kind === 'reach-pit'
+                    ? { kind: 'reach-pit', pit: { ...sib.pit } } : { kind: 'reach-exit', exit: { ...sib.exit } }];
+                let alt = null;
+                let why = null;
+                try {
+                    // eslint-disable-next-line no-await-in-loop
+                    alt = await twoPassSolve({ makeRun, goals: sibGoals, name: `survey-step-${step.step}-sibling`, boot: staging.boot,
+                        dashMode: DASH_MODE, persistence: staging.persistence, log: () => {}, ...(DISABLE ? { disable: DISABLE } : {}) });
+                } catch (e) { why = e.message.split('\n')[0]; }
+                let rep = null;
+                if (alt) {
+                    const run = makeRun(alt.persistence);
+                    const equipsAt = new Map((alt.out.equips ?? []).map((e) => [e.t, e.slot]));
+                    alt.out.perTick.forEach((held, t) => {
+                        if (equipsAt.has(t)) run.equipNow(equipsAt.get(t));
+                        run.advance(held);
+                    });
+                    rep = { hits: run.playerHits.length, deaths: run.playerDeaths.length, endLevel: run.level,
+                        transitions: (run.transitions ?? []).map((t) => `${t.from}->${t.to}@${t.t}`),
+                        earnedClears: (run.earnedClears ?? []).map((c) => `{${c.level},${c.tag}}`) };
+                }
+                tried.push({ solved: alt, replay: rep });
+                rows.push({ name: sib.name, ok: !!alt, ticks: alt ? alt.out.perTick.length : null, hits: rep?.hits ?? null,
+                    deaths: rep?.deaths ?? null, via: sib.via, ...(why ? { refusal: why } : {}) });
+            }
+        }
+        const choice = chooseSiblingExit(rows);
+        const chosen = crossingGoal.siblings[choice.index - 1] ?? null;
+        siblingExit = { named: crossingGoal.exitName, chosen: choice.chosen, why: choice.why, rows,
+            ...(chosen ? { arrival: chosen.arrival, namedTicks: solved.out.perTick.length, namedHits: replay.hits } : {}) };
+        if (choice.index > 0) ({ solved, replay } = tried[choice.index]);
+    }
+
     if (solved) {
         const walk = buildStagedTape({
             staging: { ...staging, persistence: solved.persistence,
@@ -1820,6 +1909,8 @@ async function solveOneStep(step) {
          */
         agreesWithKnown: known && solved
             ? solved.out.perTick.length === committedTape(known).tick_count : null,
+        ...(siblingExit ? { siblingExit } : {}),
+        ...(step.arrivalOverride ? { arrivalOverride: step.arrivalOverride } : {}),
     };
 }
 
@@ -1915,6 +2006,11 @@ assertBootSourcesOnDisk();
 if (STEP !== null) {
     const step = allSteps.find((s) => String(s.step) === String(STEP));
     if (!step) throw new Error(`no route step ${STEP} (the survey has ${allSteps.length})`);
+    // ⛓ SIBLING-EXIT (ON only) — the previous step shipped a sibling: this step arrives where that one lands.
+    if (ARRIVAL_OVERRIDE) {
+        step.arrivalOverride = { from: step.arrival ? { ...step.arrival } : null, to: { ...ARRIVAL_OVERRIDE } };
+        step.arrival = { ...ARRIVAL_OVERRIDE };
+    }
     const result = await solveOneStep(step);
     console.log(`##SURVEY##${JSON.stringify(result)}`);
     process.exit(0);
@@ -2178,8 +2274,12 @@ for (const s of addendum) {
 }
 
 const rows = [];
-for (const step of [...route.steps, ...addendum]) {
+/** ⛓ SIBLING-EXIT (ON only) — `step id → {x, y}`: where the previous step's chosen sibling lands. */
+const arrivalOverrides = new Map();
+const surveyOrder = [...route.steps, ...addendum];
+for (const step of surveyOrder) {
     if (wanted && !wanted.has(String(step.step))) continue;
+    const override = arrivalOverrides.get(String(step.step)) ?? null;
     process.stdout.write(`\n== step ${step.step} — L${step.level} ... `);
     const started = Date.now();
     // eslint-disable-next-line no-await-in-loop
@@ -2188,7 +2288,8 @@ for (const step of [...route.steps, ...addendum]) {
             ...(THROUGH ? [`--through=${THROUGH}`, `--route=${ROUTE_MODE}`] : []),
             ...(PRESET !== DEFAULT_SURVEY_PRESET ? [`--preset=${PRESET}`] : []),
             ...(CARRY_EARNED !== null ? [`--carry-earned=${resolvePath(CARRY_EARNED)}`] : []),
-            ...(DISABLE ? [`--disable=${DISABLE.join(',')}`] : [])], {
+            ...(DISABLE ? [`--disable=${DISABLE.join(',')}`] : []),
+            ...(override ? [`--arrival-override=${override.x},${override.y}`] : [])], {
             cwd: REPO, timeout: TIMEOUT_S * 1000, maxBuffer: 64 * 1024 * 1024, killSignal: 'SIGKILL',
         }, (err, stdout, stderr) => {
             const marked = String(stdout).split('\n').find((l) => l.startsWith('##SURVEY##'));
@@ -2224,6 +2325,11 @@ for (const step of [...route.steps, ...addendum]) {
      */
     res.family = familyOf(res.refusal, res.replay);
     rows.push(res);
+    if (res.siblingExit?.arrival && res.siblingExit.chosen !== res.siblingExit.named) {
+        const at = surveyOrder.indexOf(step);
+        const next = surveyOrder[at + 1];
+        if (next && route.steps.includes(next) === route.steps.includes(step)) arrivalOverrides.set(String(next.step), res.siblingExit.arrival);
+    }
     console.log(res.verdict === 'SOLVED'
         ? `SOLVED ${res.ticks} ticks, ${res.traceRows} decision(s), ${res.replans} re-plan(s), `
           + `${res.replay.hits} hit(s), ${res.passes.length} pass(es) — ${res.ms} ms`
```

**OFF identity:**
- acceptance md5 (`batch-seedling-acceptance.mjs 2>/dev/null | md5sum`):
  - base `391322d681b7aa0229d94b3f6906d024`;
  - tip `391322d681b7aa0229d94b3f6906d024` (also re-measured after steps 2 and 4).
- Survey, base script vs tip, switch OFF, compared per step (goals, verdict, ticks, hits, deaths) and as the whole row without
  wall-clock fields (`tools/survey-compare.py`):
  - `--through=end`: 250/250 equal (`step4/survey/end-base-vs-off.txt`);
  - `--through=4.2`: 39/39 equal (`4.2-base-vs-off.txt`).
  - The base side was the base commit's `survey-seedling-route.mjs` run beside the tip modules. A base worktree could not be
    set up here: the submodules' mirror clone failed and linking them in was refused. The survey reaches no changed module
    except the new leaf when ON, so this compares the survey hunk itself.
- In-app rows: none were run. OFF, the controller builds the same map and goal objects (row: "OFF: the goal is today's"), so
  no page path sees a new field. The in-app OFF claim is that argument plus the bounded rows; it is not a run.

## 5. Rows and bounded vitest

| file | tier | rows | covers |
|---|---|---|---|
| `seedlingDemo/siblingExitChoice.test.js` | default | 17 | switch OFF + env name + restore; rules compared as OBJECTS; the L16 set is exactly its 6 siblings (symmetric); every seed-1 set shares region, `connected_region` and rule; a non-sibling is refused by name (another region, another rule, on a rules copy); the choice (hitless kept, fewest ticks then name, every rotation and reversal the same, all-hit kept with the note, refusal kept); the arm (a clean named exit solves nothing else; a hitting one solves each sibling once from the same request, `onPass` hears the named only); the mapper (OFF returns the same object); controller OFF/ON; the binding (7 landings credited as taken; a landing no exit reaches is warned by name, no move) |
| `seedlingDemo/siblingExitWitness.slow.test.js` | slow | 2 | `in_L17_32_48`: the wasm path in node and the JS page, OFF 1 landing hit, ON `#3` hitless at (144,32). About 10 s. |
| `seedlingDemo/siblingExitWitness.train.test.js` | train | 2 | the same for `in_L15_144_16`. About 73 s, so it is off the slice push; there is a `train-shard-costs.json` row for it. |
| `seedlingDemo/siblingExitWitnessRows.js` | (support) | — | the shared witness rows |

- **Mutations, each run and red by name:**
  - m1, rule compared by name: 1 red;
  - m3, no sort: 3 red;
  - m4, siblings solved when the named exit is clean: 1 red;
  - m5, controller ignores the switch: 1 red.
- **Bounded runs, by path:**
  - the 13 neighbouring files (env channel, wasmArrival ×2, walker, jsRuntimeSolver ×4, controller, vanilla arm map, logical
    links, encounter binding, this one): 292/292 pass;
  - `procgenDocs/`: 497/497;
  - `trainShardPlan.test.js`: 21/21;
  - slow 2/2 and train 2/2.
- **Regenerated and checked:**
  - `census-seedling-solver-surface.mjs --write`: 374 rows, unchanged, `--check` GREEN;
  - `generate-procgen-reference.mjs`: `instruments.js` gains the survey's `arrival-override` flag, `--check` matches;
  - `generate-docs-index.mjs`: current.
- No unfiltered vitest, no pytest, no standing-values.

## 6. Game witness (wasm) and JS runtime

**The wasm GAME** (`tools/make-witness-lab.mjs`, `step4/wasm-witness-{off,on}.jsonl`):
- **Harness.** The divergence sweep's driver and lab (inv mode, `--page-legs=1`: one clean game per leg), with five asserted,
  measurement-only changes:
  - (a) an exit goal is resolved by the controller from the panel's own atlas map, so the page's
    `?seedlingSolverEnv=SEEDLING_SIBLING_EXIT_CHOICE=1` reaches it (`goalSame` true on every leg);
  - (b) hits are sampled in every level;
  - (c) a crossed leg runs until its tape drains;
  - (e) after the leg, the engine's arrival HOLD is released and the game runs idle for 4 s;
  - (d) the game's own `level` / `playerPositionX/Y` reports are recorded.
- The generated files were removed after the run.

| leg (key) | OFF: plan, game hits | ON: plan (chosen), game hits | game's crossing report OFF → ON |
|---|---|---|---|
| `level_16__r1c9 <- in_L15_144_16 ~> level_16__r1c1 -> exit:out_pit_7_2` | 371 t, **1** (L17 @120,40) | 355 t (`#3`), **0** | (112,32) → (144,32) |
| `level_16__r1c9 <- in_L15_144_16 ~> level_16__r1c1 -> exit:out_pit_7_3` | 381 t, **1** (L17 @120,40) | 355 t (`#3`), **0** | (112,48) → (144,32) |
| `level_16__r1c9 <- in_L17_32_48 ~> level_16__r3c7 -> exit:out_pit_7_2` | 149 t, **1** (L17 @120,40) | 195 t (`#3`), **0** | (112,32) → (144,32) |
| `level_16__r1c9 <- in_L17_32_48 ~> level_16__r3c7 -> exit:out_pit_7_3` | 174 t, **1** (L17 @120,40) | 195 t (`#3`), **0** | (112,48) → (144,32) |

- The game agrees with the user's witness and the model: the leftmost top tile lands on the bob, and `#3` (tile 14,3) is safe.
- Fed to the binding (§3), the game's report (144,32) is credited as `level_16__r1c9 -> level_17 #3`. That is item 5's
  region-change half.
- The check credit and the Regions panel read the binding's move (`targetRegion level_17` is the same for every sibling) and
  the game's own checks; nothing there names the pit.
- Not shown live: the sweep harness never runs the AP region flow (its binding sat on `level_0__r7c6`), so no
  `user:regionMove` was published there. A Playback Bot page walk would show it, and none was run.

**The JS runtime** (the witness rows, §5): OFF lands at ctor (112,32) and takes `17:bob@96,32`; ON lands at ctor (144,32) with 0
hits. The `solved reach-pit` note says `sibling exit "level_16__r1c9 -> level_17 #3" in place of "level_16__r1c9 -> level_17"
— the named exit takes 1 hit(s); … solves hitless (195 t)`.

## 7. Census

- **Where the choice can run.** It runs where the route's exit has AP-equivalent siblings: **21 groups** at seed 1, sizes 2 ×17,
  3, 4, 7 (the L16 pit) and 13 (`step5/groups.txt`; this is the lookahead's set).
  - They carry **160 divergence-sweep legs** in 63 (arrival, group) pairs (`step5/keys.txt`).
  - In the survey, 25 steps carry siblings (`step4/survey/end-off-vs-on.txt`: steps 24, 44, 84, 115, 117, 118, 128, 129, 139,
    140, 143, 144, 151, 152, 166, 173, 176, 177, 187, 206, 207, 215, 247, 248, 249).
- **Method** (`tools/sibling-leg.mjs`, `step5/census.jsonl.gz`):
  - every one of the 160 legs is solved OFF and ON through the production path: controller → `arrivalSolverGoal` →
    `solveAnytime`, with the lookahead's inv staging and the leg list at `ba36761859` (keys are stable);
  - each shipped plan is replayed.
- **Results:**
  - OFF, 4 legs hit, and they are the 4 L16 pit legs.
  - ON, the siblings are solved on those 4 only, and **exactly those 4 move**. The `… -> exit:out_pit_7_2` and
    `… -> exit:out_pit_7_3` legs, from `in_L15_144_16 ~> level_16__r1c1` and from `in_L17_32_48 ~> level_16__r3c7`, all move to `#3`.
  - The other 156 legs ship the same ticks and hits.
  - 0 legs gain a hit.
- **Survey:**
  - 1 step changes exit (24), and 1 step moves with it (25, its arrival);
  - the other 24 sibling steps keep the named exit hitless and solve nothing extra;
  - 0 steps gain a hit, in `--through=end` and in `--through=4.2`.

## 8. What the brief got wrong (measured)

1. **"the region binding that accepts the arrival door"** is not a gate.
   - The binding names the crossing by the game's exact ctor-spawn report, and it already credits any of the 7 pit siblings as
     the door taken (7/7, §3; the game's report confirms it, §6).
   - It changed nothing, and no binding hunk is quoted.
2. **"any other arrival is refused by name, as today"**: today nothing compares the door taken with the route's exit.
   - The only refusal the binding has is a level no exit of the region reaches; that is a warning, with no move, and it is
     pinned as a row.
   - A different-rule door into the same level is credited as itself, as it always was.
   - The new set is strict: such a door is never a sibling, so the solve never ships it.
   - The refusal-by-name row is on the set derivation (`notSiblingReason`).
3. **The game witness needs the fall.** The wasm engine holds the first frame of the landing level (the arrival HOLD), so a
   leg ends before the bob reaches the player. The witness has to release the hold, which is change (e). The sweep's
   `roomHits` alone would read 0 OFF.
4. **Ids:** at the lookahead's leg list (the census input), the 4 legs are 829 / 832 / 836 / 839 (the witness rows carry `id`).
   Name them by key.

## 9. Residue / hand-overs

- **Landing (the planner):**
  - The user's SHA-bound OK is still owed.
  - js-22 reviews the hunks in §4.
  - Re-merge after P2: my `flashPanel` hunk is in `seedlingPlaybackController.js` only, in `resolveSeedlingAtlasGoal` and
    `realRoomPlaybackMap`, away from P2's.
  - The ON sweeps are the planner's.
- **Cost:** the `in_L15_144_16` sibling solves add about 25 s per leg in node (6 solves at the page budget). If that is too
  slow on the page, a smaller per-sibling budget is the knob (not built).
- **Not run:**
  - a Playback Bot walk on the page (the live `user:regionMove` and the Regions panel with `#3`);
  - in-app rows;
  - full divergence sweeps (by the brief).
- **The JS-runtime witness boots via the page's own save path** (`restoreSave` with the rope flag). It is not the delivered
  AP load.
- **Generic:** groups other than L16 (teleporter pairs, the L40 stairs + 12 pits) were never exercised ON, because their named
  exits are hitless. Their sibling mapping is covered only by the generic rows.
