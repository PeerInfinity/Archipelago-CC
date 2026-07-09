# JtA Pass-B Balance Pass — Phase 3 Redesign Plan

**Date:** 2026-07-08 ·
**Status: COMPLETE 2026-07-09. §7 steps 1–5 all done (3d-hooks `12c014e`+`198dbe8c5`,
3d-order `319d0c6bb`, 3d-pass `415961ccb` — converges, see §4b; 3e `80432e2c2` —
in-app worker + host module; 3f docs), plus the suppressed-perk-task
categorization fix (§4c, submodule `0478389` + outer `45c944b80`) which closed
the last §8 open ruling. Everything pushed; CI fully green.
NEXT: Phase 4 emergent verification, in the parent plan — note it now carries a
first-class LOCATION-COVERAGE assertion, because `thresholdFloored` tasks
complete in the walk only because the walk waits for them.**
Child plan of `jta-zone-randomization-plan.md` (its Phase 3, redone per the
2026-07-08 re-rulings). The parent plan's §2 sketch and Phase-3 progress notes
are superseded by this document where they conflict.

The prior Phase-3 state this starts from: `balanceCore.js` primitives verified
(`9192d3a96`), `balancePass.js` WIP and non-converging (`0ce2db703`, its header
documents why), shared headless env + automation profile extracted
(`c4974417f`/`419c45796`), calibration curve retired (`5737825e5`).

## 0. Rulings this plan implements

**From the 2026-07-08 re-ruling round (recorded in the parent plan / memory):**

1. **Constant pacing:** aim for a constant number of resets between perk
   milestones. `resetsPerStep` is THE knob; curve-matching is abandoned.
2. The Phase-3c calibration curve is retired (rough prior at best). Measure
   real gaps by replaying the forward pass, don't predict them.
3. Repricing only perk tasks is insufficient — **all tasks get costs**.
4. **The sphere log is the cost-assignment order and the walk must cover
   every task.** The forward pass assigns a task's cost the first time the
   simulated playthrough encounters it, in walk order. Assigning later ⇒ the
   player has more skills ⇒ the cost can be set higher — that is the
   mechanism, not a side effect.
5. **Automation must reject tasks with no cost assigned yet.** That is the
   confinement lever (`setAutomationEndZone` is NOT one — it switches
   automation Off permanently).

**New rulings from the 2026-07-08 design discussion (this session):**

6. **Assignment moment = immediately before the sim runs the task for the
   first time** — not when the walk releases it, and not when the previous
   task's cost was assigned.
7. **Assignment budget = the energy remaining at that moment** (decision-time
   `current_energy`), NOT max energy. This is exactly
   `estimateResetsToComplete`'s documented contract ("decision-time energy as
   every simulated run's budget, per design"), so the estimator is used
   as-is, no budget normalization.
8. **v1 item scope confirmed:** all tasks are AP locations; perk tasks'
   perks become shuffled AP items; every other location gets a do-nothing
   item. (Parked for later: task-unlocks as items; other item ideas.)
9. **The sphere log's granularity is accepted as-is** (each perk unlock
   opens a sphere; all of a sphere's locations are grouped). The frontend
   does more than blindly follow the log: **v1 randomizes the order of
   locations within each sphere** (seeded), with special cases for Mandatory
   and Travel tasks (which could never be blindly followed anyway — see
   §2.1). Parked for later: moving selected locations between spheres in
   ways that don't disturb the rest of the sphere logic.
10. **`resetsPerStep` default = 5**, revisit if measurement says a different
    number works better.

## 1. Survey findings the design rests on (verified 2026-07-08)

### 1.1 What state exists at cost-assignment time, and what the estimator does

At the assignment moment the solver has the full live headless `GAMESTATE`:
skill levels/progress grown by all prior play, `current_energy` /
`max_energy`, perks granted so far in walk order, items/scrolls, and the task
definition. `estimateResetsToComplete(task, cap)` (simulation.ts:2342) is not
a full sim — it is an O(cap) closed-ish model reading exactly that state:
decision-time `current_energy` as every simulated run's budget, `calcTaskCost`
(linear in `cost_multiplier`), the live progress multiplier split into a
1.01^(mean level) part and an everything-else part held constant, per-run XP
grinding with only skill XP persisting. Known short-circuits: returns 0 for
`skills.length == 0` (cost cannot move a skill-less task) and 0 for an
already-completed task (the allowlist makes that unreachable during the walk).

**Efficiency conclusions (work item "a"):**

- The bisection is NOT the bottleneck and does not need replacing. Geometric
  bisection at 0.01 relative tolerance ≈ 11 estimator calls per task.
- Cap the estimator at `target + 1` instead of `ESTIMATOR_CAP = 200`: each
  call becomes O(target). With targets ≤ resetsPerStep the entire assignment
  side for ~130 tasks is milliseconds.
- Warm-starting the bracket from the previous solve on similar tasks is an
  available micro-optimization; likely unnecessary.
- A closed-form seed from the estimator's structure
  (`budget × progress_per_tick / (reps × base_cost × drain)`) is possible but
  not needed; noted for the record.
- The pass's real cost is sim advancement: ≈ 21 milestones × 5 resets ≈ 105+
  instant-mode resets, the same order as a stats-harness experiment — a few
  seconds. Comfortably inside a Web Worker budget.

**Consequence of ruling 6:** "assign immediately before first run" cannot be
done by observing state between ticks — it must be a synchronous callback
from inside the sim, fired before the task's first progress/cost evaluation
(§3.2).

**AMENDED 2026-07-08 (3d-hooks empirical findings): the walk advances under
NORMAL ticking, not instant mode.** Two verified facts killed instant mode as
the advancement engine: (a) `completeTaskInstantly` is affordability-blind —
it completes ALL of a task's reps in the starting tick regardless of cost,
billing the energy (negative → reset) but completing anyway, so no
cost patch can pace a task that starts under instant mode; (b) the baseline
automation profile sets `threshold_all_skipped = 2` (Best Task — force-run
the best skipped task), and under the walk's allowlist confinement
"all skipped" is the NORMAL state during a milestone wait, so instant mode
would force-complete the milestone immediately (and switching the fallback to
End Run instead would deadlock any milestone whose skills no replayed task
trains). Under normal ticking both problems vanish: thresholds gate the
started task per-tick at its patched cost, and the Best-Task fallback is the
faithful catch-up grind (partial progress + XP, no completion) that real play
has. Measured cost (150-run probe over the v1 zone range, baselineMods):
normal ticking 38.1 ms/run vs instant 21.8 ms/run — only ~1.75× slower
(per-tick cost is completion-dominated, not tick-count-dominated), so a full
walk stays ~10 s in the worker, once per seed, cached.

### 1.2 Sphere-log facts

- Both emitters write one `state_update` per pickup (fractional sub-spheres
  `N.M`), so a log is a literal total order over the locations it contains.
- **Coverage differs by config.** Python export contains every location only
  when `extend_sphere_log_to_all_locations` is on (current host.yaml: on;
  the `minimal-spoilers` preset: **off** — progression locations only). The
  JS pipeline's embedded Pass-A log (`shared/procgen/forwardSimulator.js`)
  **never** emits filler locations as `sphere_locations`, by documented
  design.
- **Within-sphere order is alphabetical by location name** in both emitters —
  for names like `region_0_0__13` that is lexicographic on stringified task
  ids, i.e. arbitrary.
- AP spheres can only be split by progression items: 21 perks ⇒ at most ~22
  integer spheres. A per-task order finer than that cannot be expressed in
  access rules; it must be constructed frontend-side (ruling 9).

### 1.3 Fork playability constraints on the walk order

- `has_unfinished_mandatory_task` (updateEnabledTasks, simulation.ts:850)
  counts **unfinished** Mandatory/Prestige tasks regardless of their enabled
  state, and while any exist it disables Travel. An uncosted Mandatory task
  therefore locks the sim in its zone ⇒ **a zone's Mandatory tasks must
  precede that zone's Travel task in the walk order.**
- `unlocks_task` chains (all 22 are intra-zone): a hidden task ordered before
  its unlocker deadlocks the walk (the sim can't complete the uncosted
  unlocker) ⇒ **unlockers precede unlockees.**
- Reps reset every energy reset, so each run replays every previously-costed
  task from zone 0 upward — the walk's frontier task in an earlier zone is
  reached again next run. A run whose remaining work is all
  uncosted-disabled goes idle and the driver's idle-tick guard ends it.
- The hook seam for the allowlist exists:
  `isTaskDisabledWithoutBeingFinished(task)` (simulation.ts:838) already
  gates too-strong-boss + missing-item; `updateEnabledTasks()` recomputes
  `task.enabled` every tick; automation filters on it. Under Pause-on-Block a
  disabled task halts the queue, so the solver must run
  `automation_skip_blocked` (it already does).

### 1.4 What this simplifies

Pass A needs **no changes**. The Phase-2/3a pipeline output (all tasks as
locations, perk items + do-nothing filler + Victory, zone-uniform
`HasFromListUnique` count gates, grant-suppression `task_patches`,
`ap_locations` maps) is exactly the structure this plan consumes. The
per-task order is built in Pass B (§2), so no new sidecar artifact, no
emitter changes, and no dependence on the `extend_sphere_log_to_all_locations`
setting (§2.2).

## 2. The walk order (Pass-B order builder)

### 2.1 Construction

Inputs: the post-fill sphere log (in-app: from `sphereState`,
embedded-first-then-file; Node: the `.jsonl`), the rules.json (locations,
access rules, per-region payloads `ap_locations` / `task_patches`), the fork's
`TASK_LOOKUP` (type, `unlocks_task`, zone), and the world seed.

1. **Buckets = integer spheres.** Parse the log with
   `extractLocationEntries`; group fractional entries by integer sphere.
   Each entry keeps its granted items (perk grants ride their entries).
2. **Complete the universe.** Every jta task location present in rules.json
   but absent from the log (minimal-spoilers exports, embedded JS logs) is
   synthesized into the bucket matching its access-rule count (the sphere at
   which that perk count is first satisfied, computed from the log's
   cumulative grants). Synthesized entries carry no grants. The SBtV ids
   (17/28/88/158) are not locations and never enter the walk.
3. **Within-bucket seeded shuffle** (seeded from the world seed, so a given
   seed always produces the same walk), then **constraint repair**:
   - unlockers before their `unlocks_task` targets;
   - a zone's Mandatory tasks before that zone's Travel task;
   - (cross-bucket order is already right: zone Z+1's tasks sit in a later
     bucket than zone Z's Travel, so serial release never strands the sim.)
4. **Milestones** = entries whose grants include a perk item, wherever the
   shuffle put them. Steps are the milestone-delimited runs of entries.

The result is a total order over all v1 tasks: the log dictates bucket
sequence and where the perks land (fill's truth, authoritative); the seeded
shuffle dictates the order inside each bucket (ruling 9).

### 2.2 Coverage stance

Ruling 4's "the walk must cover every task" is enforced by the order builder
(step 2 above), not by the emitters. This deliberately works under
minimal-spoilers logs and Pass-A embedded logs. The verify script asserts the
constructed order covers exactly the v1 task set (all zone 0–14 tasks minus
SBtV), whatever the log flavor.

## 3. Fork hooks (Tier 1, submodule)

Both hooks follow the Phase-1 hook conventions: additive, `SAVE_VERSION`-
neutral, dormant unless set (standalone baseline must stay byte-identical),
not part of the save blob.

### 3.1 `setCostedTaskIds(ids: number[] | Set | null)`

Module-level allowlist; `null` (default) = inert. One added condition in
`isTaskDisabledWithoutBeingFinished`: list active ∧ task id not in it ∧ task
not synthetic ⇒ disabled. Synthetic tasks (host exit tasks, ids ≥ 10000) are
exempt — they are host-owned, not costed. O(1) set lookup per task per tick.

Interaction notes (verified, §1.3): the solver runs `automation_skip_blocked`
so the disabled frontier is skipped, not halting; the Mandatory→Travel gate is
handled by the walk order, not by the hook.

### 3.2 First-start cost callback — `setTaskFirstStartCallback(fn | null)`

Fired **synchronously** when a task at `reps == 0 && progress == 0` is about
to receive its first progress tick, BEFORE that tick evaluates the task's
cost. Contract: the callback may call `applyTaskPatches` synchronously and
the starting tick sees the patched cost — this is what makes ruling 6
implementable under instant mode (§1.1). The fork does not track
"first start ever" (reps reset every run would make that stateful); it fires
on every fresh start and the host filters — the solver keeps a pending set
and solves each task exactly once.

Exact placement inside the task-start path is an implementation-time
decision; the requirement is "before the first cost/progress evaluation of
that task's first rep this run".

## 4. The rewritten forward pass (`balancePass.js`)

State: headless env (existing `headlessGameEnv.js` + `pauseGameLoop`
discipline), `baselineMods()` automation profile, **NORMAL ticking — instant
mode must stay off** (see the §1.1 amendment: `completeTaskInstantly` is
affordability-blind and the profile's Best-Task fallback would instant-force
milestones under confinement), grant suppression via the perk→Count patches
(as today), allowlist initially empty, walk pointer at entry 0, run counter
from the existing stepper.

Per walk entry k:

1. **Release:** add task k's id to the allowlist and to the pending-cost set,
   with its target attached.
2. **Assign at first start** (hook §3.2): when the sim first starts task k,
   solve `cost_multiplier` by geometric bisection so
   `estimateResetsToComplete(task, target + 1) ≈ target`, against live state
   and decision-time energy (rulings 6+7). Remove from pending.
   - **Milestone entry:** target = `max(1, resetsPerStep −
     resetsSinceLastMilestone)` — the remaining step budget, so the constant
     milestone-to-milestone gap survives however many resets the step's
     other tasks consumed.
   - **Non-milestone entry (AMENDED during 3d-pass, supersedes the "small
     constant est-target" idea):** the Loops-style **fraction rule** — cost
     aimed at a small category fraction of decision-time energy
     (`DEFAULT_CATEGORY_FRACTIONS`: Travel/Mandatory 0.10, Normal 0.25,
     Boss 0.5), implemented as the est≥1 bisection's LOW bracket × fraction.
     Reps reset every run, so every costed task is REPLAYED every run:
     pricing connective tissue at even ~one run's grind each made reaching a
     zone-3 frontier cost dozens of runs (measured). Vanilla's economy shape
     — cheap connective tissue, grindy milestones — must be preserved.
   - **Boundary fallback (AMENDED):** first-start is the organic assignment
     path, but a frontier can be unable to START at its pre-solve vanilla
     cost (Boss disparity gate ⇒ DISABLED; threshold-skipped in an
     already-passed zone — automation replays the zone, takes Travel onward,
     and the all-skipped Best-Task fallback never fires because deeper zones
     always offer work). A frontier still pending after a full run since
     release is solved at the run boundary instead.
   - **Engagement clamp (AMENDED):** every solved cost is clamped down to
     the largest multiplier the threshold mods still engage with (bisect on
     `isThresholdSkipped`, ×0.5 safety margin — the LEVEL metric's ratio
     drifts against a task as skills grow). Note: grant suppression
     (perk→Count) RECATEGORIZES former perk tasks from the perk threshold
     category into "other" (LEVEL metric, 1% budget) — in the solver and in
     real AP play alike.
   - **Unengaged disposition (AMENDED):** the LEVEL metric is nearly
     cost-invariant (energy cost and XP yield both scale with progress), so
     a task can be rejected at ANY cost once skills outgrow it. Such a
     frontier (clamp floored) does not block the walk: grants are handed
     over, the entry is reported `unengaged`, and the walk moves on. These
     are also the tasks a tuned-profile REAL player's automation would never
     run — a real-play design question recorded in §8.
   - Guards kept: skill-less ⇒ leave vanilla (estimator can't move it);
     saturated ⇒ leave PRISTINE vanilla + count (restore must read a
     snapshot taken before solving — the bisection mutates the shared
     definitions).
3. **Advance:** tick the sim (normal ticking, idle-tick + max-ticks guards,
   auto-prestige branch replicated) until task k COMPLETES (existing
   completion callback), bounded by a per-entry stall ceiling (report, move
   on).
4. **Grant:** apply entry k's logged grants — perk items via `grantPerk`
   (AP-authoritative order preserved), everything else a no-op.
5. Advance the walk pointer; release k+1.

Output: Tier-1 patch list (`cost_multiplier` per task) + a report: measured
milestone gaps vs `resetsPerStep`, per-entry gaps, clamp/saturation/stall
counts, total resets. **v1 is report-only** — no online correction of future
solves from measured past gaps; if the report shows systematic bias, an
online correction factor is the designated next lever (it never revisits past
assignments, so it stays first-touch-compatible).

Retired with this rewrite: `invertCalibration` +
`targetGapForMilestone` usage in the pass (calibration curve is retired;
anchor-curve replay is superseded by the constant knob), `costZone`-style
zone-batch assignment, the `setAutomationEndZone` confinement attempt, and
the already-complete fallback counting.

### 4c. The suppressed-perk-task defect and its fix (2026-07-09)

The `unengaged` tasks Phase 3d reported were not a pacing curiosity — they
were a **defect introduced by grant suppression**, reaching real AP play, not
just the solver.

Suppression patches a perk task's `perk` -> `PerkType.Count`. Both of the
fork's categorizers gate on the same condition,
`def.perk != Count && !hasPerk(def.perk)`:

- `getThresholdCategory` — the task drops out of `perk_affordable` /
  `perk_unaffordable` (100% / 25% budgets, **resets** metric, which cost CAN
  move) into `other` (1% budget, **level** metric). That metric is
  `calcTaskEnergyCost / calcExpectedLevels`; XP is linear in cost, so the
  **cost term cancels exactly** — no `cost_multiplier` can engage the task.
  Worse, perk tasks carry deliberately tiny `xp_mult` (task 89 = 0.02, 104 =
  0.1, 69 = 0.5) because the perk *is* the reward, so they fail an
  XP-efficiency test by construction.
- `autoFillCategory` — the task also loses its cheapest-first `"perk"`
  priority band (an unnoticed second casualty), reordering the whole plan.

The `!hasPerk` half bites independently: in a multiworld the perk item
routinely arrives **before** its vanilla task is done, at which point even an
unsuppressed perk task would fall to `other`.

**Fix (user-proposed):** Tier-1 hook `setPerkCategoryTaskIds(ids | null)`
forces both categorizers to treat the listed tasks as granting a
currently-unearned perk, *regardless of `def.perk` or `hasPerk`*. Suppression
itself is untouched. The host retires an id once the task's AP location is
checked, so a finished perk task stops being prioritized every run — the
bridge from `_reportedLocationNames`, the balance pass from the walk's
completions. Standalone stays byte-identical (null default).

**Result on the verify seed:** `unengaged` 7 -> **0**, threshold-clamped 25 ->
14, and milestone gaps moved from p50 = 2 / mean 2.6 to **p50 = 3 / mean 3.7**
against `resetsPerStep = 5` (the ~2.5x undershoot became ~1.35x, because perk
milestones regained a cost-sensitive metric). Solve time 2.4 s.

**Two further findings, both load-bearing:**

1. **`unengaged` must be metric-aware.** "Skipped even at MIN cost" only means
   "no cost can ever engage it" under the cost-invariant **level** metric.
   Under **resets**/**rep** the task is merely unaffordable *right now* with
   untrained skills — skills grow (the all-skipped Best-Task fallback grinds
   them), so the walk must WAIT. This is not cosmetic: on the verify seed the
   two survivors were task 134 (a perk task) and task 151, a **Mandatory**
   task — and mandatory tasks disable Travel until finished, so pricing it as
   a don't-care would have walled the player inside zone 14. With the
   classification fixed, both complete by waiting and `unengaged` is 0.
2. **Unengaged tail pricing (user ruling 2026-07-09):** genuinely unengaged
   tasks carry no perk and are strategically irrelevant, so their cost does
   not matter. They are repriced to the **largest cost the pass assigned to
   anything**, once every other cost is settled — a deliberate don't-care
   default, and better than the floor clamp's MIN (a MIN-cost task is
   single-tick, which makes its whole zone free-skippable). Milestones are
   excluded and reported as `unengagedMilestones`, a hard failure in the
   verify script. Currently inert on the verify seed: nothing ends up
   unengaged.

## 5. Worker + host module (Phase 3e — unchanged rulings, recorded)

- **Web Worker** imports the submodule's committed `build/*.js` behind the
  shared DOM stubs (`headlessGameEnv.js`); stubbed `localStorage` keeps it
  off the player's save; `estimateResetsToComplete` is reachable as a module
  export (it is not on `window`). Zero fork changes for the worker itself
  (spiked live).
- **`jtaBalance` host module:** subscribe `stateManager:rulesLoaded`; sphere
  log from `sphereState` (embedded-first-then-file — Generate.py does NOT
  embed `sphere_log` in rules.json); rules doc cached from the
  **`stateManager:rawJsonDataLoaded` push event** (AMENDED during 3e
  verification: the `getLastRawJsonData()` pull only updates on the
  `files:jsonLoaded` path, so rules loaded any other way — e.g. the test
  harness — leave it stale at the app's initial preset; procgenPlayer
  caches from the push event for the same reason); run the pass in the
  worker; merge patches into the procgenPlayer warehouse
  `world.task_patches` (the bridge already applies those on `loadRegion`);
  cache patches in localStorage keyed by seed (`seed_name ||
  generation_seed || seed` — Pass-A presets carry an EMPTY-STRING
  seed_name) so the solve runs once per world; register in
  `__BUNDLED_MODULES__` (init-bundled.js) **and in modules.json's
  `loadPriority` array — a module absent from that list silently never
  initializes even when its `moduleDefinitions` entry is enabled.**
  Known limitation (documented in the module header): a cache-miss solve
  finishing while the player already stands in a jta region only takes
  effect on the next region entry.

## 6. Verification (Phase 3f)

- `scripts/procgen/verify-jta-balance-pass.mjs` (end-to-end, Node): on a real
  15-zone seed — order covers exactly the v1 task set; 0 stalls; 0
  saturations; every task costed or accounted (skill-less); measured
  milestone gaps within a tolerance band of `resetsPerStep = 5` (band chosen
  from the first green run's spread, then pinned).
- vitest units for the order builder: bucket assignment (log + synthesized),
  seeded-shuffle determinism, constraint repair (mandatory<travel,
  unlocker<unlockee) under adversarial shuffles.
- Fork: standalone 500-run baseline byte-identical with hooks unset; rebuild
  via `npx tsc` in the submodule, commit `build/`.
- Suites: `npx vitest run frontend/modules/jtaBalance`, substrate suite
  (`npm test -- --mode=test-substrates`, 18/18), round-trip
  (`verify-jta-locations-roundtrip.mjs`, 26/26).
- In-app smoke after 3e: load a jta preset, confirm solve-at-rulesLoaded +
  cache hit on reload + patches visible in the iframe's task costs.

## 7. Phasing (each step committed separately, direct to main)

1. **3d-hooks (submodule):** `setCostedTaskIds` + `setTaskFirstStartCallback`
   + build; byte-identical baseline proof.
2. **3d-order:** order builder (balanceCore) + vitest units.
3. **3d-pass:** `balancePass.js` rewrite + `verify-jta-balance-pass.mjs`
   green.
4. **3e:** worker + `jtaBalance` host module + seed-keyed cache +
   registration + in-app test.
5. **3f:** docs (`docs/json/developer/procgen/jta.md`), parent-plan §2b/§4/§7
   update, memory topic update.

### 4b. First converging run (2026-07-08, seed 14089154938208861744, 15 zones)

2.1 s wall, 64 resets simulated, 130/130 tasks costed, 0 stalls, 0
saturated, 7 unengaged, 25 threshold-clamped. Milestone gaps vs
`resetsPerStep = 5`: p25=1 p50=2 p75=4 max=12 mean=2.6 — a systematic
~2.5× UNDERSHOOT (the estimator's dedicated-grind model vs replay XP +
growing budgets). Report-only per the ruling; `resetsPerStep` is the
compensating knob and Phase 4 measures the emergent result. Walk-order
lessons folded into the order builder: buckets are COARSER than zones
(fill front-loads perks; 5 integer spheres covered 15 zones), so
within-bucket repair needs zone-reachability edges (Travel(z) before any
deeper-zone task) and item-dependency edges (producer before consumer) on
top of unlock chains and Mandatory-before-Travel.

## 7b. Handoff to Phase 4 (what this plan could not verify)

The pass grades its own homework: milestone gaps are measured **inside the walk
that assigns the costs**, where automation is confined by `setCostedTaskIds`.
Two things therefore need out-of-sample measurement, and only the parent plan's
Phase 4 can provide it:

1. **Location coverage under free automation.** Six tasks on the verify seed are
   reported `thresholdFloored`: MIN cost is unaffordable at first touch, and
   they complete only because the walk WAITS (nothing else is runnable, so the
   all-skipped Best-Task fallback grinds the skill up). In free play automation
   always has better work available, so the fallback may never fire and those AP
   locations may never be checked. The walk cannot detect this by construction.
2. **Emergent pacing.** In-sample gaps after §4c are p50 3 / mean 3.7 against
   `resetsPerStep = 5`. Per §2 caveat 1 of the parent plan, a systematic
   deviation is corrected with a factor on the target, not an architecture
   change. Phase 4 also settles the tolerance band and the final `resetsPerStep`.

## 8. Parked (explicitly out of v1 scope, recorded 2026-07-08)

- ~~Threshold `other`-category level metric vs AP locations~~ — **RESOLVED
  2026-07-09 (user ruling + fix): see §4c.**
- Task-unlocks as AP items; further item ideas beyond perks + do-nothing.
- Moving locations between spheres without disturbing sphere logic
  (backfill-lite); per-task gate-count spread (the full backfill mechanism —
  synthetic-phase material).
- An explicit generator-emitted per-task ordinal (authorable/seedable order
  artifact) — the sidecar seam exists if the derived+shuffled order proves
  insufficient.
- Online correction of future solves from measured gaps (v1 is report-only).
- Multiworld post-fill refinement (parent plan §6.5, unchanged).
