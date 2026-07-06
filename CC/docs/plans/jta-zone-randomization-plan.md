# JtA Zone Randomization & Reset-Paced Balancing — Plan

**Date:** 2026-07-06 (v2, same-day revision after design discussion) ·
**Status: Phase 0 (vanilla profiling) IN PROGRESS — user go-ahead 2026-07-06;
remaining rulings pending for Phases 1+.**

The next JtA arc after `jta-substrate-integration-plan.md` (all phases complete
except its Phase 6 stub, which this plan absorbs). This is the modern successor
to the old March-2026 randomizer stack's core value, and the feature that must
land before that stack can be retired (standing ruling: keep deprecated code
until its useful features are absorbed).

Session context lives in the memory topic
`project_jta_substrate_integration.md` → **NEXT ARC** section (design inputs
captured 2026-07-05 while the substrate arc was hot). Settled rulings from that
arc (bidirectional reset sync, strict pause, no max mana, game-owned shared
save, Pause-on-Block default, automation defaults) are **not re-opened here**.

## 0. Requirements (user, 2026-07-06)

1. **All JtA tasks count as AP locations. All JtA perks count as AP items.
   All of them appear in the sphere log.** (Supersedes v1's "perk tasks only"
   scope — perk tasks were the old apworld's 44/45-location surface; the new
   surface is every task: 134 tasks in zones 0–14 alone, roughly double across
   all 30 zones.)
2. **Pacing:** each task becomes completeable within a target number of loop
   resets after the previous one. With all tasks as locations the target
   attaches to *progression steps*, with tasks inside a step splitting the
   step's budget (see §2).
3. **Eventual destination: fully synthetic game data** built on the JtA
   engine — zones constructed **one task at a time**, each task's data set
   from what the player is *known to have access to at that point*. New tasks
   are NOT always appended to the latest zone; sometimes they backfill into
   earlier zones. **Backfill purpose (clarified 2026-07-06):** a backfilled
   task's cost is assigned later in the walk, when a *higher* cost has become
   affordable — so it cannot be completed on the first pass through its zone
   and the player must return later (metroidvania-style revisit structure
   inside zones).
   First-completions are the unlock events: some tasks grant a perk, others
   unlock further tasks (`unlocks_task`/hidden chains).
4. Even before synthetic data, the **same forward-pass strategy assigns costs
   to existing (vanilla/shuffled) tasks**.
5. Known complication: tasks depend on specific skills and grant XP to those
   skills. Synthetic data can *choose* each task's skills; existing tasks
   cannot be re-skilled (cost/xp multipliers are the only levers).
6. **First step: collect statistics on vanilla JtA data** (via the existing
   simulated-playthrough scripts) as the approximate target profile for
   synthetic generation — and, it turns out, as calibration + verification
   baselines for everything else.

---

## 1. The three surfaces (verified 2026-07-06)

### 1a. The old randomizer stack — what we're absorbing

Pipeline: `worlds/jta` apworld fill overwrites each perk task's `perk` field →
`_gamedata.json` → non-standard `post_output` hook shells out to **Node**
(`scripts/jta/cost-adjust.js` or `cost-plan.js`) after `create_playthrough` so
the sphere log exists → solver binary-searches per-task `costMult`/`xpMult` →
`_costs.json` → frontend pushes it into the old `jta-remote/game-bundle` copy
via `jta:replaceGameData`/`jta:patchTaskDefs` → `jtaArchipelago` bridges perk
task completion → `user:locationCheck` and received items → `jta:grantPerks`.

Key facts:

- **What it randomizes: perk placement only** (45 hardcoded `PERK_TASKS` rows,
  `worlds/jta/game_data.py:104`). Costs are never randomized — they are
  *solved* post-fill to make the randomized placement completable.
- **Two divergent solvers**, both reachable via `costgen_mode`:
  - Legacy `jtaCostGenerator.adjustCosts` (mode 0): walks the sphere log; per
    step, bottleneck detection (target task at costMult 0.01 → is the zone
    reachable?), then log-scale binary search over three levers — zone-traversal
    costMult (max multiplier meeting target), xpMult boost (min boost, zones
    0..Z), and the perk task's own costMult — targeting **`resets_per_sphere`**
    (default 5, floor 2); advances skill state by simulating that many resets
    between steps.
  - Modern `JTACostPlanner` (modes 1/2, default 2 = two-pass): action-queue
    step simulation, per-category **attempt** targets
    (normal 2 / perk 5 / boss 5 / traversal 5), Phase-1 costMult search +
    Phase-2/3 xpMult search, optional second pass with xpMults baked in.
- **Three independent copies of the economy math** (simulator.js 84KB, the
  legacy generator's embedded copy, the planner's embedded copy) — all
  **v0.5.0 / 27 zones**, with named-perk special cases hardcoded
  (MinorTimeCompression, EnergeticMemory, EnergySpell +50, Writing ×1.5, …).
  The fork is **1.6 / 30 zones** with mechanics none of them model (prestige
  queue, thresholds, Unlock Savings, scroll-aware estimators).
- Documented limitations of the legacy solver
  (`docs/json/games/journey-to-ascension/cost-adjustment-algorithm.md`):
  **no feedback loop** (earlier adjustments never revisited), **xpMult
  compounding** across steps (retroactive levers re-scale zones 0..Z that were
  already tuned), deliberately weak "base strategy", no items/artifacts/
  prestige. §2 below eliminates the first two by construction.
- `jtaArchipelago`'s mapping conventions (worth keeping verbatim):
  **location name = task name; item name = perk display name**; dedupe on the
  host side; grants queued until iframe ready, reconciled from stateManager
  inventory on connect.

### 1b. The substrate side — where the feature must live

- Zone assignment is **positional**: `arrangeShuffledSpiral` keeps a
  per-substrate `zoneCounter` (`procgenPipelineEngine.js:3095`) — Nth jta
  region → zone N. No randomization, no spec input.
- jta implements only `synthesizeZonePayload(zoneIdx) → {jtaZone}`
  (`jtaSubstrateWrapperLibrary.js:130`). It has **no `extractZoneRules`**, so
  jta regions get zero locations — but the engine dispatcher *already calls*
  `extractZoneRules` when present (`procgenPipelineEngine.js:2471`), threading
  `{region_id, exitSides, regionSize}`. Implementing it gives jta per-region
  locations/payload with **zero engine changes**.
- **Any extra payload field survives the sidecar round-trip verbatim**
  (`serializeWorld`/`deserializeWorld` spread everything except `exits`) and
  arrives at the bridge as `payload.world.<field>` right where `jtaZone` is
  read (`bridge.js:317-343`). That is the runtime injection seam.
- The AP-checks-inside-a-zone pattern **already exists** in bounce/runner:
  `extractZoneRules` emits `locations` + an `ap_locations` payload map
  (pickup id → `${region_id}__${id}`), the in-game bridge dispatches
  `user:locationCheck` on collection, gated by
  `supportedFeatures: ['arbitrary_ap_locations']`. jta lacks the feature flag
  and the wiring, nothing else.
- **Runner is the precedent for seed-driven zone content**
  (`generateZoneSet({count, seed, physics})`, materialized lazily). Bounce
  uses authored zones; jta uses the fork's static zones.
- jta cannot participate in **sphere-growth** (the flagship driver) without
  `generateZoneForSpecs` — it is spiral-only today. The synthetic-generation
  destination (§0.3) is essentially jta's `generateZoneForSpecs` story.
- Sidecars are **build-time only**, deterministic per (seed, params); never
  regenerated at play time.
- **The Loops cost generator (`frontend/modules/loops/costGenerator.js`) is
  the in-repo precedent for the balancing algorithm** — see §2.

### 1c. The fork's own machinery — what we can build on

- `estimateResetsToComplete(task, max_resets)` (`simulation.ts:2296`, exported)
  is **exactly the pacing metric**: decision-time `current_energy` as every
  simulated run's budget, closed-form level requirement via the
  `1.01^(mean level)` split, only skill XP persists across simulated resets,
  O(max_resets). Scroll-aware, overdraft-tick-aware — it already models Fork
  1.4–1.6 mechanics because it *is* Fork 1.4+ code.
- **Neither estimator is pure**: both read ambient `GAMESTATE` (skills, energy,
  perks, prestige) plus module-global multipliers. Headless use = stand up a
  real gamestate (`initializeHeadless()`), set state, construct a `Task`, call.
  The stats harness already does precisely this against the committed
  `build/*.js`.
- **No data-injection hook exists** (grep-verified: no
  replaceGameData/patchTaskDefs/setGameData analogue in the fork).
  `ZONES` is a static const of plain mutable `TaskDefinition` objects, but
  `TASK_LOOKUP`/`PERKS_BY_ZONE`/`ITEMS_BY_ZONE`/`zone_id` stamps are derived
  **once at module load**. Consequence: *field-level* mutation of existing
  defs (costMult, xpMult, perk, item) stays coherent (derived maps hold
  references); *structural* changes (add/remove/move tasks) stale the derived
  maps and need a hook that refreshes them. This splits the injection story
  into two tiers (§3 Q2).
- Per-task randomizer levers in the data model: `cost_multiplier`, `xp_mult`,
  `max_reps`, `skills[]`, `type` (Boss ⇒ 4^zone instead of 2.2^zone), `perk`,
  `item`, `use_item`, `unlocks_task`, `hidden_by_default`. Global levers
  (probably out of scope): base cost 10, exponents 2.2/4, XP base 8 ×
  1.25^zone, level curve 1.02^level.
- The `window.*` surface has task/zone/automation control
  (`loadZone`, `injectSyntheticTask`, `setMod`, `performTask`, `stepTick`,
  `setInstantMode`, …) but **no perk-grant hook** (the old game-bundle's
  `window.tryAddPerk` has no fork equivalent — verify at implementation time),
  **no general task-completion callback** (the bridge only hears
  travel/synthetic tasks — all-tasks-as-locations needs one), and no def-patch
  hook.
- `CC/scripts/jta-stats/` measures **emergent runs-to-first-completion for
  every task** under real automation (Node, deterministic, ~9s/500 runs,
  byte-identical to browser). It currently reads `zones.ZONES` as committed —
  **no modified-data path** — but the driver/runner is structured so a
  "gameDataPatch" option is a small, localized change.

---

## 2. The core algorithm: a Loops-style forward pass

**Adopted 2026-07-06 (user-confirmed), replacing v1's "legacy solver
skeleton" recommendation.** The in-repo precedent is the Loops cost generator
(`frontend/modules/loops/costGenerator.js`), which walks the sphere log one
location at a time and, per entry: finds the path, assigns costs to
*not-yet-costed* regions on the path (half of current mana split across them:
`manaForRegions / remainingUncosted`) and to the location (half of current
mana), commits the costs **before** queuing, plays the step through the
**real loop engine** (instant mode), waits for the check to actually land,
applies item boosts, resets, continues. Defaults fill the untouched tail.

Why this shape wins for JtA — it eliminates the legacy solver's two documented
limitations **by construction**:

- **First-touch assignment**: when a progression step first needs to cross new
  zones, the uncosted traversal/mandatory tasks get their costs assigned
  *then*, as part of that step's budget. Nothing already assigned is ever
  revisited → no retroactive traversal lever, no xpMult compounding, no
  feedback-loop problem.
- **Real-engine advancement**: state between steps is the *emergent* state
  (the fork's own sim in instant mode plays the step to actual completion, the
  analog of `_waitForLocationCheck`), not a model's projection — assignment
  errors don't accumulate; each step re-anchors on reality. Zero model drift:
  the game is the simulator (consistent with Q1).

**The one piece that doesn't transfer: the assignment rule.** Loops charges
"half of what you have" — affordable-by-construction, implicit pacing target
of "within this loop". JtA's target is inverted: the task should NOT complete
now but *within N resets*. So the per-step rule becomes: from the current real
gamestate, choose the `costMult` that makes `estimateResetsToComplete(task) ≈
target` — a cheap **local inversion** (cost is linear in `cost_multiplier`; at
worst a few bisection iterations on the estimator, no full sims), replacing the
legacy 25-iteration global searches.

Sketch (existing-data mode; synthetic mode generates the task first, §3 Q7):

```
walk intended progression order (step = unlock milestone / sphere entry):
  for each not-yet-costed traversal task the step newly requires:
    assign costMult by local estimator inversion against the step's
    traversal share of the budget (Loops-style split across the new tasks)
  for each task in the step:
    assign costMult so estimateResetsToComplete ≈ its share of the step
    budget (category weights = intra-step split rule, cf. old planner's
    per-category targets)
  play forward with the real sim (instant mode, pinned pool) until the
  step's tasks actually complete; grant the step's items/perks
assign defaults to any never-visited tasks; emit patches
```

Budget/runtime: forward play totals ≈ (resets per step × steps) instant-mode
runs — same order as a harness experiment (~9s/500 runs), so a full balancing
pass is plausibly ~5–15s. Two honest caveats:

1. **Estimator vs emergent mismatch**: the estimator assumes dedicated grind;
   real automation splits attention (items, thresholds, other categories).
   Forward play absorbs the drift state-wise; the *measured* gap can still
   deviate from target — Phase 0 profiling measures the systematic factor,
   Phase 4 verification asserts the band. If deviation is systematic, the fix
   is a correction factor on the target, not a different architecture.
2. **Starting-mana budgets — terminology note (user re-affirmed 2026-07-06):**
   `maxMana`/`max_energy` is misnamed — it is the **starting mana**, the
   per-reset refill target, **never a ceiling**. Substrate mana/energy is
   unbounded above it (a configurable cap was considered and deferred, maybe
   never; the `maxMana`→`startingMana` rename is deferred to the cleanup
   backlog). So: the solver's per-reset budget is the loop's *starting* mana
   with no Energetic-Memory growth (harness `pinMaxEnergy` semantics — note
   the harness option clamps carried-in surplus that real play would keep,
   making it slightly conservative; real budgets can only be higher).

---

## 3. Design questions — options and recommendations

### Q1. Where does the balancing math live?

| | Option | Assessment |
|---|---|---|
| **A** | **Fork's in-engine estimators + real sim** (headless `GAMESTATE`, the harness pattern), inside the §2 forward pass | Single source of truth — the solver optimizes the metric the game's own thresholds use; models Fork 1.6 mechanics for free; zero drift by construction. |
| **B** | Resurrect/port the old JS solver stack | The economy models are stale (v0.5.0/27 zones, three divergent copies); porting recreates the drift problem permanently. §2 supersedes even the solver *skeletons* (the retroactive levers are what the forward pass eliminates). |
| **C** | Stats-harness full-sim bisection as the in-loop oracle | Highest per-evaluation fidelity but each evaluation is a multi-run sim; unnecessary given §2's local inversion + real-engine advancement. Stays as the **verifier**. |

**Recommendation: A within the §2 pass; C as verifier; B retired outright**
(algorithms absorbed only as history — the per-category target idea survives
as the intra-step split rule).

### Q2. How does randomized/synthetic data reach the game?

**Two tiers** (revised for the synthetic destination):

- **Tier 1 — field-level patch hook** (`applyTaskPatches(patches)`: costMult/
  xpMult/perk/item/maxReps by task id, idempotent, NOT part of the save blob):
  sufficient for costing + perk-shuffling *existing* tasks; safe against the
  derived-map staleness trap; consumed by both the substrate bridge (patches
  ride each region's sidecar payload next to `jtaZone`) and the stats harness.
- **Tier 2 — structural replacement hook** (`replaceZones(zonesData)`-style,
  rebuilding `TASK_LOOKUP`/`PERKS_BY_ZONE`/`ITEMS_BY_ZONE` + zone_id stamps):
  required for fully synthetic data (new tasks, new zone compositions).
  Deferred to the synthetic phase; designed so Tier 1 becomes a special case.

Build-time data generation (writing a `zones.js` per seed) is rejected for
runtime use (can't rebuild per seed in the browser) — the hooks serve both the
bridge and the harness with one mechanism.

*(Sub-choice to confirm: apply patches lazily per-region at load vs
all-at-once at rules load by iterating the warehouse — lazy is simpler;
all-at-once keeps global displays like `PERKS_BY_ZONE` coherent.)*

### Q3. Where does randomization/generation run?

**Recommendation unchanged: the procgen pipeline** (deterministic per (seed,
params), content lands in sidecars + `extracted_rules.locations`, flows to AP
via the standard rules.json → world_generator → Generate.py path; the pipeline
is JS in the same origin as the fork's build, so the §2 pass can import
`build/simulation.js` directly — Web Worker if the ~5–15s solve blows the
interactive budget). The non-standard `post_output` subprocess dies with the
apworld path. AP seed-generation-time and frontend-load-time homes remain
rejected as in v1. Optional post-fill sphere-log refinement (a near-literal
JtA analog of the Loops in-app generator) stays deferred unless
solo-approximate pacing proves wrong in multiworld play.

### Q4. Content scope — SUPERSEDED BY USER DIRECTION (2026-07-06)

Scope is now staged rather than optional:

1. **AP surface: ALL tasks = locations, ALL perks = items, all in the sphere
   log** (requirement §0.1). Location semantics: first *full* completion
   (reps == max_reps, matching the harness definition). ~40 perks vs hundreds
   of locations ⇒ most of the pool is filler (old apworld precedent: "Energy
   Boost" filler — see open question 7).
2. **Existing-data mode first**: perk shuffle + §2 costing over the fork's
   vanilla zones (Tier-1 patches only).
3. **Synthetic mode as the destination** (requirement §0.3): zones constructed
   one task at a time from known player access, with backfill into earlier
   zones — priced at assignment time (later in the walk), so backfilled tasks
   are unaffordable on the zone's first pass and require returning later.
   (Engine side note: an earlier zone_id still scales base cost by 2.2^zone
   and XP by 1.25^zone, so the assigned costMult compensates — the estimator
   inversion handles this automatically.)
   Requires Tier-2 hook + Q7 ruling + the Phase 0 vanilla profile as its
   target shape.
4. Zone-order shuffle (region i ↔ zone π(i)) demoted to an optional stretch
   after existing-data mode works — superseded in spirit by synthetic mode.

### Q5. AP checks in this arc?

Mooted by §0.1 — all tasks are locations, so yes, definitively this arc.
Remaining sub-ruling: **grant semantics** — recommendation stands at
**AP-authoritative** (suppress local perk grant via patch; perk arrives only
as an AP item through a new fork `grantPerk` hook; solo play round-trips
locally so feel is unchanged). Local-grant hybrid (old stack's shape)
double-grants in multiworld.

### Q6. Specifying the pacing target

Revised for all-tasks-as-locations: **the knob attaches to progression steps,
not individual tasks**, with an **intra-step split rule** deciding how a
step's budget is shared among its tasks (category-weighted; the old planner's
per-category attempt targets are the precedent). Verification stays
two-layer: solver-internal acceptance per step + emergent harness
verification against Phase 0 bands.

> **RULED (user 2026-07-06): default pacing targets = the profiled vanilla
> values, and the default must capture the vanilla pacing CURVE, not just its
> average.** Phase 0 measured the curve (SUMMARY.md Round 5): consecutive
> first-completion gaps p50 = 2; perk-milestone gaps p50 = 8 (standalone) /
> 14 (pinned) growing from ~4 early to 60+ late game, long tail max 61/145.
> A single scalar `resetsPerStep` is demoted to a manual-override knob.

Remaining sub-choice — **how the curve is represented**:

- **A (recommended): position-indexed curve replay** — the k-th milestone's
  target gap comes from a smoothed vanilla gap-vs-progression-index curve
  (the ordered gap sequences already stored in `vanilla-profile.json`), with
  seeded jitter matching local variance. Preserves the trend (early quick,
  late grindy), not just the distribution.
- **B: phase-banded distribution sampling** — split progression into bands,
  sample each step's target from that band's vanilla gap distribution. Same
  distribution per phase; the trend survives only at band granularity, and
  order within a band scrambles.
- Anchor variant: **pinned100's curve for substrate play** (matches loop
  starting-mana budgets; standalone's curve kept for standalone-flavored
  worlds/comparison). Tolerance band still to pick after the first Phase 4
  verification round.

### Q7 (NEW). Synthetic generation: sphere log first, or co-constructed?

The user's open question (§0: "construct the sphere log along with the other
data, or generate the sphere log first — not sure which is better").

| | Option | Assessment |
|---|---|---|
| **A** | **Sphere-log/plan first**, then realize tasks to match | The skeleton is an editable, inspectable artifact (fits the stepped pipeline's editable sphere steps). But a fully detailed log is written blind to engine dynamics — whether "task X completes N resets after W" is realizable depends on skill levels that only exist once the prefix is played; infeasible steps force backtracking/re-planning. |
| **B** | **Co-construction** — generate task-by-task from emergent state; the log falls out as a byproduct trace | Feasible-by-construction (the Loops principle applied to generation); never backtracks. But progression *structure* becomes emergent — hard to author, edit, or aim at global targets ("perk X around step 20") without lookahead heuristics. |

**Recommendation: B for the mechanics, with a thin planned layer on top —
plan only what needs no engine knowledge.** The planned layer fixes the
*order*: which perk/item unlocks at which step, when new zones open, when
tasks backfill into earlier zones (the §0.3 backfill knob lives here), with
cadence targets taken from the Phase 0 vanilla profile. The forward pass then
realizes each step's task (zone placement, `skills[]` choice, costMult) from
real emergent state. This mirrors sphere-growth (driver plans spheres,
substrate realizes zones) and the stepped pipeline (the coarse plan is the
editable artifact). The exact sphere log is emitted as a byproduct trace; the
*authoritative* log is still AP's, computed post-fill, with access rules
constructed so fill reproduces the intended order.

**Skills sub-policy** (requirement §0.5): synthetic tasks choose `skills[]`
freely — policy informed by the vanilla profile (skill-introduction cadence,
trained-skill coverage so estimator inversion stays in sane costMult ranges,
deliberate fresh-skill introductions as difficulty spikes). Existing tasks:
skills fixed; cost/xp multipliers are the only levers, and achievable pacing
accuracy is bounded by the skill trajectories — Phase 0 measures that bound.

---

## 4. Recommended phasing

Each phase separately land-able and committed separately per repo policy.

### Phase 0 — Vanilla profiling (user-proposed starting point; no product code)
Extend `CC/scripts/jta-stats/` to collect, from vanilla playthroughs:
- **Empirical pacing**: resets between consecutive first-completions, per
  task/category/zone (the vanilla pacing curve).
- **Skill trajectories**: per-skill level vs run number.
- **Structural profile**: tasks/zone, type mix, skills-per-task,
  skill-introduction cadence, perk/item spacing, costMult/xpMult/max_reps
  distributions.
- **Estimator calibration**: `estimateResetsToComplete` at decision time vs
  actual resets-to-complete (the systematic correction factor for §2 caveat 1).
Output: `results/vanilla-profile.json` + a SUMMARY round. Run under both
standalone and `pinMaxEnergy` (substrate) budgets.

### Phase 1 — Enablers
- Fork (Tier 1): `applyTaskPatches` + `grantPerk` + a general
  task-completion callback (`setTaskCompletionCallback` or widened travel
  callback). SAVE_VERSION-neutral; headless-testable via the harness DOM-stub
  pattern.
- Harness: `gameDataPatch` config option.
- Pipeline: jta `extractZoneRules` skeleton emitting the *vanilla* zone's
  tasks as locations (param-gated, no randomization) — proves the
  locations path end-to-end (world_generator → Generate.py → spoiler/sphere
  log) before content changes.

### Phase 2 — AP integration (all tasks = locations, all perks = items)
- Location per task (first-full-completion semantics), item per perk,
  filler design (open question 7), `supportedFeatures` +=
  `arbitrary_ap_locations`.
- Seeded perk shuffle in the pipeline; grant suppression patches;
  AP-authoritative grants with inventory reconciliation on
  connect/rules-reload (absorbs `jtaArchipelago` conventions).
- In-app test: complete a task → check sent → item receipt → perk present.

### Phase 3 — The §2 balancing pass over existing data
- `balance` module home per Q3 (importable by pipeline and a Node CLI);
  intended-progression-order walk, first-touch assignment, local estimator
  inversion (with Phase 0 correction factor), real-sim advancement,
  intra-step split rule, defaults for the tail; emits Tier-1 patches.
- `resetsPerStep` + tolerance as substrate params; measure solve runtime →
  Web Worker / pre-generation script decision point.

### Phase 4 — Verification
- Harness `randomized-pacing-*` experiment family: measured reset gaps within
  band (band defaults from Phase 0), pinned-pool tuned-defaults automation;
  SUMMARY round.
- In-app smoke: randomized+balanced preset progresses zone 1→3 within
  expected resets under playback automation.

### Phase 5 — Synthetic generation v1 (the destination)
- Fork Tier-2 hook (`replaceZones` + derived-map refresh).
- Planned layer (Q7): unlock-order/backfill/zone-cadence skeleton, profile-
  informed; co-constructive realization one task at a time (zone placement,
  skills policy, costMult from live state); sphere-log trace emitted; access
  rules encode the intended order.
- Harness validation against the Phase 0 structural + pacing profile.
- (Optional stretch, before or instead: zone-order shuffle of vanilla data —
  cheap once Phase 3 works, superseded in spirit by this phase.)

### Phase 6 — Absorption audit → old-stack retirement green-light
- Walk the absorption map (§5); confirm nothing unabsorbed/undropped remains;
  produce the retirement checklist (deletion is its own future change, per
  the standing ruling).

## 5. Absorption map (what retirement requires)

| Old asset | Fate under this plan |
|---|---|
| `worlds/jta` apworld (perk placement, options, slot data) | Superseded by pipeline randomization + standard procgen→world_generator path (Phase 2); `resets_per_sphere` semantics carried into `resetsPerStep` |
| `post_output` Node subprocess bridge | Dies with the apworld path — generation and balancing run natively in JS (Phase 3) |
| `jtaCostGenerator.js` (legacy solver) | **Superseded by the §2 Loops-style forward pass** (first-touch assignment + real-engine advancement remove the retroactive levers it needed); code retired |
| `jtaCostPlanner.js` / `cost-plan.js` / `cost-debugger.js` | Per-category attempt targets survive as the intra-step split rule (Q6); two-pass machinery unnecessary under §2; code retired |
| `simulator.js` + `gameData.js` (v0.5.0 economy copies) | Replaced by the fork's own estimators/sim (Q1); no port |
| `jtaGameDataLoader.js` + `jta:replaceGameData`/`patchTaskDefs` | Replaced by the fork Tier-1/Tier-2 hooks + sidecar payloads (Q2) |
| `jtaArchipelago` perk↔item bridge | Conventions (location=task name, item=perk display name, reconcile-on-connect) absorbed into the substrate bridge (Phase 2); module retired |
| `cost-adjustment-algorithm.md` | Stays as historical reference for the superseded algorithms; new docs go in `docs/json/developer/procgen/jta.md` |

## 6. Open questions (beyond the rulings)

1. **Patch application timing** (Q2 sub-choice): lazy per-region vs
   all-at-once at rules load.
2. **Solver runtime budget**: measure the Phase 3 pass; if >~10s in-browser,
   Web Worker vs generate-time script.
3. **Shared save × randomized seeds**: the one-shared-save ruling
   (`incrementalGameSave_substrate`) means skills earned under seed A carry
   into seed B — AP-authoritative grants de-fang the *perk* side, but carried
   *skills* deflate a new seed's pacing. Options when it bites: per-preset
   save keying (already deferred once), or solver assumes fresh-save state.
   Flag for first playtest.
4. **Tolerance band + intra-step split defaults** (Q6): pick after Phase 0.
5. **Multiworld pacing refinement** (Q3): post-fill sphere-log pass (in-app,
   Loops-generator analog) — deferred unless solo-approximate pacing proves
   wrong in real multiworld play.
6. **`grantPerk` hook shape**: verify the fork's internal grant path and
   persistence-safety (an AP-granted perk must survive save/load without its
   task being complete).
7. **Filler item design — RULED for v1 (user 2026-07-06): filler items do
   nothing.** Ideas for later (starting-mana boosts, spark, scrolls) parked.
8. **Repeatable-task check semantics**: first full completion is the working
   definition; confirm no second-check surface is wanted (e.g. per-rep
   partial locations) — assume no for v1.
9. **Sphere-log fidelity** (Q7): how strictly must AP's post-fill sphere log
   reproduce the generator's intended order — strict (specific-perk access
   rules) vs loose (count-based rules, old-apworld style)? Strict rules
   over-constrain fill in multiworld; loose rules let fill drift from the
   balanced order. Recommend: loose + Phase 4 verification tolerance, revisit
   if drift breaks pacing.

## 7. Rulings

| # | Question | Status |
|---|---|---|
| 1 | Balancing math home | **Recommended:** fork estimators + real sim inside the §2 pass; harness verifies; old solvers retired. §2 architecture user-confirmed 2026-07-06 ("makes sense"); formal ruling on Q1 packaging pending |
| 2 | Data delivery | **Recommended:** two-tier fork hooks (field-level now, structural for synthetic); sidecar-carried patches — pending |
| 3 | Randomization home | **Recommended:** procgen pipeline — pending |
| 4 | Content scope | **RULED (user 2026-07-06):** all tasks = locations, all perks = items, all in sphere log; existing-data mode first, fully synthetic generation as destination |
| 5 | AP checks this arc | **Mooted yes** by ruling 4; grant semantics (AP-authoritative recommended) — pending |
| 6 | Pacing knob | **PARTIALLY RULED (user 2026-07-06):** defaults = profiled vanilla values, capturing the CURVE not just the average; scalar `resetsPerStep` demoted to manual override. Remaining: curve representation (position-indexed replay recommended vs phase-banded sampling) + tolerance band |
| 7 | Synthetic construction order | **Recommended:** co-construction with a thin planned layer (order planned, realization emergent); sphere log as byproduct trace, AP's post-fill log authoritative — pending (user explicitly undecided) |
| 8 | Vanilla profiling first | **RULED (user 2026-07-06):** yes — Phase 0 |
