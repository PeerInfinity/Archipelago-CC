# JtA Zone Randomization & Reset-Paced Balancing — Plan

**Date:** 2026-07-06 (v2 + same-day ruling rounds); Phases 1–2 shipped
2026-07-08 ·
**Status: Phase 0 (vanilla profiling) DONE 2026-07-06 (`572fd9c32`, SUMMARY.md
Round 5). Phase 1 (enablers) DONE 2026-07-08. Phase 2 (AP integration) DONE
2026-07-08 — pipeline perk items + opt-in seeded shuffle + filler + Victory +
libraryItems + `arbitrary_ap_locations` + per-zone grant-suppression
`task_patches` (`c08c62de3`); bridge location-check dispatch + `applyTaskPatches`
+ AP-authoritative `grantPerk` reconciliation (`90b5ad02b`); in-app
`jta-location-check-and-perk-grant` test on a generated `jta_locations_test`
preset (`038d8cff8`); round-trip now 18/18 (task_patches survive), 18/18
substrate suite green. All §7 rulings received; v1 scope settled (zones 0–14,
perk-shuffle + rebalance; synthetic data deferred). NEXT: Phase 3 (the §2
balancing pass — Pass B rebalance at rules load).**

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
   baselines for everything else. **DONE 2026-07-06.**
7. **Two-pass flow (user, 2026-07-06 follow-up):** generation produces the
   original rules.json → world_generator + Generate.py **re-randomize item
   placements during fill** → the exported rules.json needs its costs
   **rebalanced against the actual sphere log** when loaded. The post-fill
   rebalance is REQUIRED, not an optional multiworld refinement (see §2b).
8. **v1 scope (user, 2026-07-06 follow-up):** randomize perk placements only
   + rebalance costs to the target progression curve; **zones 0–14** (the old
   goal-zone-15 scope), which avoids prestige entirely. **Fully synthetic
   data is deferred until after v1.**
9. **Prestige-grant semantics (recorded for post-v1):** perks/unlocks granted
   by OTHER multiworld players do not reset on prestige (AP inventory
   persists; re-grant after prestige). Whether perks/unlocks granted from the
   CURRENT JtA game reset on prestige should become an option — **default:
   they DO reset**. Out of v1 scope (zones 0–14 never prestige).

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

## 2b. The two-pass generation flow (promoted per user review 2026-07-06)

AP's fill re-randomizes item placements among the locations, so any costs
balanced at pipeline time against the pipeline's *intended* order are stale
once Generate.py exports the final rules.json. The flow is therefore:

1. **Pass A — structure (procgen pipeline):** zones → regions, perk-task
   locations, perk items, loose count-based access rules that shape the
   sphere order. Costs are NOT authoritative here — vanilla costs (v1) or
   provisional assignments (synthetic mode later) suffice, because Pass B
   always rebalances. (Pipeline-side pre-balancing for in-panel preview play
   is possible but optional.)
2. **world_generator + Generate.py:** fill shuffles the items; the export
   emits the final rules.json + the actual sphere log.
3. **Pass B — authoritative rebalance (at rules load, in-app):** run the §2
   forward pass against the ACTUAL sphere log — the near-literal JtA analog
   of the Loops cost generator, which is itself an in-app post-fill pass —
   and apply the resulting patches via the Q2 hook. Deterministic given the
   sphere log; cache the patches (keyed by seed) so the solve runs once per
   world, not per session.

Same balancer code both places: Pass A (when used) walks the intended order,
Pass B walks the sphere log. This supersedes the earlier "post-fill
sphere-log refinement — deferred" framing: Pass B **is** the primary
balancing point. Note the sphere log records tasks completed and perks
received independently (multiworld: a JtA task may hold another player's
item; a perk may arrive from elsewhere) — the walk grants what the log says
arrives, exactly like the Loops generator's `itemsReceived` handling.

**Verify early (Phase 1 enabler):** that `preset_sidecars` (and any
zone-payload fields) survive the pipeline → world_generator → Generate.py →
exported-rules.json round-trip; if not, that pass-through is a prerequisite
for Pass B having its inputs at load time.

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

*(Patch-timing sub-choice — RULED (user 2026-07-06): implementer's call,
whichever is cleaner to implement. Note Pass B computes all patches at rules
load anyway, so all-at-once may fall out naturally.)*

### Q3. Where does randomization/generation run?

> **RULED (user 2026-07-06): procgen-pipeline-initiated.** Where the
> generation/balancing CODE lives is the implementer's call (cleanest wins);
> the user notes some of it may make more sense inside the submodule.
> Working split: engine-touching parts (headless gamestate driver, estimator
> inversion, forward-play) lean toward the submodule — they version with the
> mechanics they model, like the estimators themselves; pipeline/AP-facing
> parts (progression plan, sidecar stamping, curve data, sphere-log walk)
> stay in the outer repo. Decide finally at implementation.

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
> average.** Phase 0 measured it (SUMMARY.md Round 5, re-run with
> `award_spark_on_discovery` OFF per follow-up ruling). **v1 anchor curve
> (zones 0–14, standalone):** 21 perk milestones, gaps
> [0, 4, 5, 7, 4, 6, 2, 6, 14, 8, 8, 4, 6, 8, 10, 10, 8, 2, 14, 8, 70] —
> p50 = 7, mean 9.7; consecutive first-completion gaps p50 = 2. (The final
> 70 is the SBtV-gated straggler, not organic pacing — see open question
> 10.) A single scalar `resetsPerStep` is demoted to a manual-override knob.

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
- Anchor variant — **RULED (user 2026-07-06): the STANDALONE (unpinned)
  curve** is the pacing target. The balancer solves under actual loop
  budgets to *hit* that curve, so substrate play feels standalone-paced;
  pinned100 data stays as calibration/verification context.
  - **SUPERSEDED (RULED 2026-07-08): the runtime is now STANDALONE natively.**
    The JtA substrate producer leg (`energyBonusSync`, default ON as of
    commit — reports JtA's `jta_starting_energy_bonus` accumulator up via
    `setSubstrateMaxManaBonus('jta', …)`) makes JtA own its `max_energy`, so
    its starting-energy growth raises the shared pool and play is *natively*
    standalone-paced. The balancer now targets the standalone curve against a
    **matching standalone runtime** — no pinned-pool budget-compensation.
    pinned100 is calibration/comparison only. The standalone≡bonus-sync
    equivalence holds for JtA-only worlds; the per-item max-mana term is now
    gated by `moduleSettings.gameState.includePerItemMaxMana` (default on) so
    it doesn't double-count against JtA energy.
- Also RULED:
  the profiling profile disables `award_spark_on_discovery` (discovery
  spark funds Divinity purchases without prestiging and distorts the
  vanilla curve) — profile re-run accordingly. Tolerance band still to
  pick after the first Phase 4 verification round.

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

### Phase 0 — Vanilla profiling — **DONE 2026-07-06** (`572fd9c32`; findings in `results/SUMMARY.md` Round 5, data in `results/vanilla-profile.json`)
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

### Phase 1 — Enablers — **DONE 2026-07-08**
- Fork (Tier 1): `applyTaskPatches` + `grantPerk` + `setTaskCompletionCallback`
  — additive, `SAVE_VERSION`-neutral, dormant in standalone play. Fired from
  `onFullyFinishTask`; the general callback carries
  `{id,name,zone,type,perk,item,reps,maxReps,synthetic}`; `applyTaskPatches`
  mutates the static `TaskDefinition`s in place (array or map form,
  cost/xp/max_reps/hidden/unlocks_task/perk/item) and rebuilds the derived
  perk/item maps (new `zones.ts:rebuildZoneDerivedMaps`) when perk/item
  change. Submodule `b0b675a`; verified headlessly + byte-identical
  standalone baseline. **Grant suppression is NOT a flag** — it falls out of
  patching a task's `perk`→`Count` (Phase 2 wiring).
- Harness: `gameDataPatch` config option — applies Tier-1 patches via
  `window.applyTaskPatches` after init, before the metric universe is built.
- Pipeline: jta `extractZoneRules` skeleton (opt-in via
  `setJtaEmitZoneLocations`; off by default → byte-identical). Emits each
  zone task as an AP location + `ap_locations` payload map; excludes the 4
  SBtV-gated ids (17/28/88/158); places the v1 do-nothing `JtA Filler` item
  on every location. Task identity comes from a regenerable snapshot
  (`zoneTaskData.js` + `generate-zone-task-data.mjs`, sourced fresh from the
  Fork 1.6 build — the DOM-coupled fork build can't be imported by the
  headless-safe library / browser pipeline). `dump-shuffled-spiral.js
  --jta-locations` flag.
- **Round-trip verification (§2b) — PASSED (14/14):**
  `verify-jta-locations-roundtrip.mjs` drives the full toolchain and confirms
  task locations + `ap_locations` + `jtaZone` + the sphere log survive
  pipeline → world_generator (`_worldgen_sidecars.json`) → Generate.py
  (exported rules.json `preset_sidecars` + sphere log + spoiler). Nothing
  dropped — no pass-through fix needed. 17/17 in-app substrate suite green
  (incl. 6 JtA); fork standalone baseline byte-identical.

### Phase 2 — AP integration — **DONE 2026-07-08** (`c08c62de3` / `90b5ad02b` / `038d8cff8`)
- **Pipeline** (`jtaSubstrateWrapperLibrary.js`): perk display-name items on
  task locations + `JtA Filler` elsewhere + one `Victory` in the goal zone
  (`setJtaGoalZone`); `libraryItems` classification (perks progression, filler
  filler, Victory is_victory — was absent, so filler had mis-classified as
  progression); `supportedFeatures` += `arbitrary_ap_locations`; per-zone
  `task_patches` = perk→`Count` grant suppression. **Opt-in seeded perk shuffle**
  (`setJtaPerkShuffleSeed`, user ruling 2026-07-08 — the pipeline CAN randomize
  placement even though AP fill re-randomizes; off = vanilla identity, bounded
  to `[0, goalZone]`). `zoneTaskData` generator emits `JTA_PERK_COUNT`.
- **Bridge** (`bridge.js`): `setTaskCompletionCallback` → resolve
  `world.ap_locations[id]` → `user:locationCheck` (deduped, re-seeded from
  `checkedLocations`); apply `world.task_patches` on loadRegion; AP-authoritative
  `grantPerk(name)` reconciliation on connect / `snapshotUpdated` / rulesLoaded
  (idempotent, self-rejecting for non-perks — no perk-name map needed). Absorbs
  the `jtaArchipelago` conventions (location = task name is now the
  compileRegionGraph `region__id` name; item = perk display name).
- **Round-trip** upgraded to real `setJtaGoalZone` + `setJtaPerkShuffleSeed` and
  asserts `task_patches` survive the toolchain (18/18).
- **In-app test** `jta-location-check-and-perk-grant` (generated
  `jta_locations_test` preset): fresh-save reset → walkTo drives zone 0 →
  location check + item receipt + perk present + perks-held == perk-items-received
  (AP-authoritative). 18/18 substrate suite green.
- Notes: the substrate boots from a SHARED save slot (plan §6.3), so a clean test
  needs a save reset; `performTask`+`stepTick` don't advance tasks in managed mode
  — `walkTo` (arms the game's automation) is the driver.

### Phase 3 — The §2 balancing pass (Pass B first; shared module) — **IN PROGRESS 2026-07-08**

> **Phase 3a (unplanned prerequisite, DONE `02d9ebcab`).** Pass A emitted no
> access rules at all — every location was `True_`, so AP produced ONE sphere,
> Victory sat in logic at sphere 0, and this phase's sphere-log walk had nothing
> to walk. Fixed by porting the old apworld's loose count-based gate
> (`HasFromListUnique`, zone Z needs Z perks) onto **locations** rather than
> entrances, since the spiral layout gives region adjacency no zone order. Victory
> also had to be pinned (`lockedCanonicalItems` + `procgen_metadata`, both
> required). At v1 scope the exported log now has 21 perk milestones — 1:1 with
> the anchor curve. This resolves open question 9 (loose over strict) in practice.
>
> **Phase 3c (DONE, refreshed 2026-07-08).** Calibration re-derived from raw
> zone≤14 samples (`derive-calibration.mjs`, SUMMARY Round 7). The profile was
> regenerated first, and that mattered twice: the committed 2026-07-06 profile
> predated Round 6's shipped defaults, and `--sample-every 5` was too sparse
> (n≈20/bucket) to trust. At `--sample-every 1` (1487 samples vs 301) the
> reachable pacing window is **[6, 19] resets**. The **floor of 6 is a real game
> property** — an affordable task still waits for automation's priority queue —
> and anchor gaps below it clamp to minimum cost (**RULED: clamp, count, measure
> in Phase 4**). The upper end is only a *sampling limit*: an apparent "plateau
> past estimate ~10" in the sparse run **disappeared** under dense sampling, so
> that claim is withdrawn. The z0–14 anchor curve is unchanged across stale,
> prestige-on and prestige-free profiles (only the excluded SBtV straggler
> moves), so **prestige is not a confound** and the solver keeps `auto_prestige`
> on. pinned100's floor is 28.2, independently confirming the `energyBonusSync`
> supersession above.
>
> **Solver home (RULED + spiked):** a Web Worker importing the submodule's
> committed `build/*.js` behind shared DOM stubs. `estimateResetsToComplete` is a
> module export and **not** on `window`, so the bridge could never have called it;
> the worker can. Stubbed `localStorage` keeps the solver away from the player's
> save. **Zero fork changes.** Solve at `stateManager:rulesLoaded`, patches cached
> in localStorage by seed.
>
> **Phase 3d — primitives DONE + verified (`9192d3a96`); the forward-walk driver
> is WIP and does not converge (`0ce2db703`).** JtA's automation is autonomous and
> outruns the sphere-log walk; `setAutomationEndZone` is *not* a confinement lever
> (`simulation.ts:3965`/`4322` switch automation Off permanently). The fix is to
> drive first-touch costing off the **sim's** zone entry rather than the walk's —
> targets still come from the walk, so pacing intent is unchanged. Also learned:
> Generate.py does **not** embed `sphere_log` in rules.json (sibling `.jsonl`), so
> Pass B must take the log from `sphereState`, not `rawJsonData`.

- `balance` module (code home per Q3 ruling: engine-touching parts lean
  submodule, orchestration outer; importable by the app at rules load, the
  pipeline, and a Node CLI/harness): sphere-log/intended-order walk,
  first-touch assignment, local estimator inversion corrected through the
  Phase 0 calibration curve, real-sim advancement, intra-step split rule,
  defaults for the tail; emits Tier-1 patches.
- **Primary integration = Pass B (§2b): rebalance at rules load against the
  actual sphere log**, patches cached per seed. Pass A pre-balancing for
  in-panel preview is optional and can come later.
- Pacing defaults per Q6 ruling: position-indexed vanilla curve (STANDALONE
  anchor, spark-on-discovery off) with seeded jitter; `resetsPerStep` scalar
  as manual override.
- Measure solve runtime at load; Web Worker if it blows the interactive
  budget — decision point, not a blocker.

### Phase 4 — Verification
- Harness `randomized-pacing-*` experiment family: measured reset gaps within
  band (band defaults from Phase 0), **standalone-pool** tuned-defaults
  automation (matches the `energyBonusSync` runtime per the 2026-07-08
  supersession; pinned kept for comparison only); SUMMARY round.
- In-app smoke: randomized+balanced preset progresses zone 1→3 within
  expected resets under playback automation.

### Phase 5 — Synthetic generation (the destination — **deferred until after v1 ships**; v1 = Phases 1–4 at zones 0–14 scope)
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
10. **SBtV-gated hidden tasks in v1 scope — RULED (user 2026-07-06):
   ignored/excluded in v1.** Exactly four zone-0–14 tasks have no in-game
   unlocker (Divinity/SeeBeyondTheVeil-gated): ids **17** (z0 Use Secret
   Fishing Spot), **28** (z1 Training Dummy), **88** (z7 Train at Every
   Guild), **158** (z14 Write Down Some Learnings) — verified as precisely
   the pinned-run unreached set and the standalone run-~1460 stragglers.
   They are excluded from the v1 location pool, the pacing walk, and the
   verification metric universe (all other hidden z0–14 tasks have in-game
   unlock chains and stay in). The v1 anchor curve's trailing 70-gap value
   drops with them.

## 7. Rulings

| # | Question | Status |
|---|---|---|
| 1 | Balancing math home | **RULED (2026-07-06, recommendations accepted):** fork estimators + real sim inside the §2 pass, corrected via the Phase 0 calibration curve; harness verifies; old solvers retired without port |
| 2 | Data delivery | **RULED:** two-tier fork hooks (field-level `applyTaskPatches` now, structural later) + `grantPerk` + task-completion callback; patch timing = implementer's choice (cleaner wins) |
| 3 | Randomization home | **RULED:** procgen-pipeline-initiated; code home = implementer's choice, engine-touching parts may live in the submodule |
| 4 | Content scope | **RULED:** all tasks = locations, all perks = items, all in sphere log; **v1 = perk shuffle + rebalance, zones 0–14 (no prestige)**; synthetic generation deferred until after v1 |
| 5 | AP checks this arc | **RULED:** yes; grants AP-authoritative (A1) |
| 6 | Pacing knob | **RULED:** defaults = profiled vanilla values capturing the CURVE (position-indexed replay with seeded jitter, **STANDALONE anchor** — user 2026-07-06 follow-up; profiling with `award_spark_on_discovery` OFF); scalar `resetsPerStep` = manual override; tolerance band picked after first verification round |
| 7 | Synthetic construction order | **RULED (direction; build post-v1):** co-construction with a thin planned layer; sphere log as byproduct trace, AP's post-fill log authoritative |
| 8 | Vanilla profiling first | **RULED + DONE:** Phase 0, `572fd9c32`, SUMMARY.md Round 5 |
| 9 | Two-pass flow | **RULED (user-raised):** post-fill rebalance at rules load is the authoritative balancing point (§2b); Pass A is structure-only |
| 10 | Prestige-grant reset | **Recorded for post-v1:** foreign-granted perks/unlocks persist through prestige; own-game grants reset on prestige by default, behind an option |
