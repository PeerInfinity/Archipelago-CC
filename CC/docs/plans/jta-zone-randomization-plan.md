# JtA Zone Randomization & Reset-Paced Balancing — Plan

**Date:** 2026-07-06 · **Status: PLANNING — options presented, rulings pending; no implementation.**

The next JtA arc after `jta-substrate-integration-plan.md` (all phases complete
except its Phase 6 stub, which this plan absorbs). Goal: randomize JtA zone
content on the substrate path and balance it so **each task becomes
completeable within a target number of loop resets after the previous one**.
This is the modern successor to the old March-2026 randomizer stack's core
value, and the feature that must land before that stack can be retired
(standing ruling: keep deprecated code until its useful features are absorbed).

Session context lives in the memory topic
`project_jta_substrate_integration.md` → **NEXT ARC** section (design inputs
captured 2026-07-05 while the substrate arc was hot). Settled rulings from that
arc (bidirectional reset sync, strict pause, no max mana, game-owned shared
save, Pause-on-Block default, automation defaults) are **not re-opened here**.

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
  no feedback loop (earlier adjustments never revisited), xpMult compounding
  across steps, deliberately weak "base strategy", no items/artifacts/prestige.
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
  `generateZoneForSpecs` — it is spiral-only today.
- Sidecars are **build-time only**, deterministic per (seed, params); never
  regenerated at play time.

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
  maps and need either a rebuild or a hook that refreshes them.
- Per-task randomizer levers in the data model: `cost_multiplier`, `xp_mult`,
  `max_reps`, `skills[]`, `type` (Boss ⇒ 4^zone instead of 2.2^zone), `perk`,
  `item`, `use_item`, `unlocks_task`, `hidden_by_default`. Global levers
  (probably out of scope): base cost 10, exponents 2.2/4, XP base 8 ×
  1.25^zone, level curve 1.02^level.
- The `window.*` surface has task/zone/automation control
  (`loadZone`, `injectSyntheticTask`, `setMod`, `performTask`, `stepTick`,
  `setInstantMode`, …) but **no perk-grant hook** (the old game-bundle's
  `window.tryAddPerk` has no fork equivalent — verify at implementation time)
  and no def-patch hook.
- `CC/scripts/jta-stats/` measures **emergent runs-to-first-completion for
  every task** under real automation (Node, deterministic, ~9s/500 runs,
  byte-identical to browser). It currently reads `zones.ZONES` as committed —
  **no modified-data path** — but the driver/runner is structured so a
  "gameDataPatch" option is a small, localized change.

---

## 2. Design questions — options and recommendations

### Q1. Where does the balancing math live?

| | Option | Assessment |
|---|---|---|
| **A** | **Fork's in-engine estimators** (`estimateResetsToComplete` et al., driven headlessly through a real `GAMESTATE` the way the stats harness does) | Single source of truth — the metric the solver optimizes is literally the metric the game's own thresholds use; models Fork 1.6 mechanics for free; zero drift by construction. Cost: estimators answer "resets for THIS task from THIS state" — sequencing across tasks needs the driver to advance state between steps (run the real sim in instant mode, which the harness already does). |
| **B** | Resurrect/port the old JS solver stack (simulator + costGenerator/costPlanner) | The solver *skeletons* (sphere-walk, bottleneck detection, log-scale binary search, two-pass xpMult) are proven and worth copying as **algorithms**. But the economy models are stale (v0.5.0/27 zones, three divergent copies, no prestige/threshold modeling) — porting them to Fork 1.6 recreates the drift problem permanently. |
| **C** | The stats-harness driver as the in-loop oracle (bisection where each evaluation = full instant-mode sim run counting actual resets) | Highest fidelity — measures emergent behavior under the real automation, not an estimator's assumptions. Cost: each solver evaluation is a multi-run sim; ~25 bisection iterations × ~50 pacing steps could be minutes per seed (needs measurement). Fine offline; likely too slow inside an interactive browser pipeline. |

**Recommendation: A for the in-loop solver, C as the verifier, B mined for
algorithm structure only (no code resurrection).** Concretely: a new
`balance` module stands up a headless gamestate, walks the intended
progression order, uses `estimateResetsToComplete`-style evaluation inside the
legacy solver's proven search structure (bottleneck test → traversal lever →
xp lever → task lever), and advances state between steps by running the real
sim for the target reset count. The harness then verifies the emergent pacing
end-to-end (Q6). The old stack's economy re-implementations are what made it
rot; the fork's own code is the only copy that can't drift.

### Q2. How does randomized data reach the game?

| | Option | Assessment |
|---|---|---|
| **A** | **New fork window hook** — e.g. `applyTaskPatches(patches)` (field-level: costMult/xpMult/perk/item/maxReps by task id), applied by the bridge before/at `loadZone` | Matches the sidecar pass-through seam that already exists; per-seed data with no rebuild; save-compatible (task ids stable). Field-level patching is safe against the derived-map staleness trap (§1c). Needs a submodule change (SAVE_VERSION-neutral — patches are not saved state). |
| **B** | Build-time generation into the fork's data format (generate a `zones.js` per seed / rebuild) | Wrong tool for per-seed runtime randomization in the browser (can't rebuild per seed at play time; dynamic module substitution fights the bundler). It IS the right shape for the harness/CI verifier — but a shared hook (A) used by both the bridge and the harness driver is one mechanism instead of two. |

**Recommendation: A — a single field-level patch hook in the fork, consumed by
both the substrate bridge (runtime) and the stats harness (verification).**
Patches ride the per-region sidecar payload (`taskPatches` next to `jtaZone`)
— everything we randomize is per-zone, so no world-level channel is needed;
the bridge applies a region's patches before `loadZone`. Structural
randomization (adding/moving tasks), if ever wanted, becomes a v2 hook that
also refreshes `TASK_LOOKUP`/`PERKS_BY_ZONE`/`ITEMS_BY_ZONE`; not needed for
the scope recommended in Q4. *(Sub-choice to confirm: apply patches lazily
per-region at load, or all-at-once at rules load by iterating the warehouse —
lazy is simpler and sufficient since a zone's defs only matter once loaded,
but all-at-once keeps `PERKS_BY_ZONE`-style displays coherent globally.)*

### Q3. Where does randomization run?

| | Option | Assessment |
|---|---|---|
| **A** | AP seed generation (the `worlds/jta` path, modernized) | Multiworld-exact (real sphere log). But the old apworld models a hand-written 27-zone linear world, not the substrate topology; and its defining oddity — Python shelling out to Node because the cost model is JS — exists only because generation runs in Python. |
| **B** | **The procgen pipeline** (extractZoneRules/generateZoneForSpecs, seeded like runner's `generateZoneSet`) | The architecturally native home: deterministic per (seed, params), content lands in sidecars + `extracted_rules.locations`, flows to AP via the standard rules.json → world_generator → Generate.py path — the perk tasks become ordinary AP locations and **the non-standard `post_output` subprocess dies**. The pipeline is JS in the same origin as the fork's build — it can import `build/simulation.js`/`zones.js` directly and run the balancing solver in-process (Web Worker if slow). Pacing is solved against the pipeline's *intended* progression order (which the pipeline itself decides), i.e. solo-approximate rather than fill-exact. |
| **C** | Frontend load time | Non-deterministic vs the seed, invisible to AP logic. Ruled out. |

**Recommendation: B.** The multiworld-exactness gap vs A is real but small in
practice (the old apworld's count-based access rules only ever made the sphere
log *approximately* zone-ordered anyway), and B is what lets the old stack
retire — one generation path, no Python→Node bridge. An optional post-fill
refinement pass (re-run the solver against the actual sphere log, old-style)
can be bolted on later **if** solo-approximate pacing proves wrong in
multiworld play; record as deferred, don't build now.

### Q4. Scope of "zone content"

| | Option | Assessment |
|---|---|---|
| **A** | Perk placement only + cost/xp balancing (old-stack parity) | Absorbs the old stack's entire randomization value; smallest surface; field-level patches suffice. |
| **B** | A + **zone-order shuffle** (region i gets zone π(i) instead of zone i) | The seam is one line in the spiral driver (the `zoneCounter`); high fun-value ("which zone is behind this exit?"). But zone costs scale 2.2^zone_id — putting zone 12 second is a pacing cliff the balancer must flatten, which stresses the solver hard (traversal-lever multipliers far outside the old search ranges). |
| **C** | B + deep content randomization (skills[], items, reps, task structure) | Needs the structural patch hook, re-derivation of the category classifiers the automation depends on (unlocker/combat/item/perk precedence), and rebalancing interactions we can't predict yet. |

**Recommendation: A for this arc's core, B as an explicit stretch phase behind
its own go/no-go after A's solver proves itself, C deferred to a future arc.**
Rationale: A alone unblocks old-stack retirement (the user-stated gate); B is
where substrate randomization becomes visibly different from the old stack,
but only attempt it with a working balancer in hand.

### Q5. Do perk tasks become AP location checks in this arc (old Phase 6)?

| | Option | Assessment |
|---|---|---|
| **A** | **Yes — this arc.** `extractZoneRules` emits perk-task locations + `ap_locations`; bridge sends `user:locationCheck` on perk-task completion; perks granted on AP item receipt (AP-authoritative). | Randomized perk placement without AP checks is barely a randomizer — the perk↔item bridge is the point of the feature, and the bounce/runner pattern makes the wiring cheap. Also the natural moment to absorb `jtaArchipelago`'s conventions (location = task name, item = perk display name, inventory reconciliation on connect). |
| **B** | Later — randomize + balance self-contained zones first, wire AP checks in a follow-up arc. | Smaller first landing, but leaves the old stack unabsorbable (its AP integration is half its value) and means building perk randomization twice (local-grant semantics, then AP-authoritative semantics). |

**Recommendation: A**, with one sub-decision to rule on — **grant semantics**:

- **A1 — AP-authoritative (recommended):** the randomized task's local perk
  grant is suppressed (perk field patched to none; location carries the item);
  the perk arrives only via AP item receipt (new fork `grantPerk` hook —
  the fork has no `window.tryAddPerk`; needs adding either way). Correct
  multiworld semantics; solo play is unchanged in practice because checks
  round-trip locally.
- **A2 — local-grant hybrid (old stack's shape):** task grants its placed perk
  locally AND sends the check. Simpler, but double-grants in multiworld and
  entangles game saves with AP inventory.

### Q6. Specifying and verifying the pacing target

**Specification.** The user's framing — "each task completeable within N
resets after the previous one" — is per-*step*, which matches the legacy
`resets_per_sphere` semantics (not the planner's per-category attempt counts).
Options for the knob surface:

- **A (recommended): one `resetsPerStep` target + tolerance band**, a procgen
  substrate param (panel-exposed like other jta params, flowing into the
  world's options the standard way). Keep the legacy floor (≥2). Progression
  "steps" = the pipeline's intended unlock order (perk tasks + zone
  traversals in region-topology order).
- **B: per-category targets** (planner-style: traversal/perk/boss/normal) —
  more expressive, more knobs to explain; can be added later as advanced
  params without changing A's default surface.

**Verification.** Two layers, both required:

1. **Solver-internal acceptance:** each step's solved estimate must land in
   `[target − tol, target + tol]` (tolerance itself an option; legacy used
   exact-target bisection with 25 iterations and no explicit band — adopt an
   explicit band, e.g. ±1 reset or ±33%, TBD by measurement).
2. **Emergent verification via the stats harness** (the natural verifier per
   the NEXT-ARC notes): extend `CC/scripts/jta-stats/` with a
   `gameDataPatch` config option (Q2's hook), run the tuned-defaults
   automation profile with `pinMaxEnergy` set to loop starting mana (matching
   substrate semantics per the §4 Round-4 measurement), and assert the
   measured reset gap between consecutive first-completions stays within the
   band. This is a new experiment family (`randomized-pacing-*`), reported in
   `results/SUMMARY.md` like prior rounds.

**Substrate-play caveat the solver must honor:** in loop mode `max_energy` is
pinned to the loop's starting mana each entry (no Energetic-Memory growth),
so the solver's per-reset budget must be the pinned pool, not standalone
energy growth — this is exactly what `pinMaxEnergy` emulates in the harness.
Mana carried between zones/substrates in mixed worlds makes real budgets
*higher* than the model's; the model is conservative in the right direction.

---

## 3. Recommended phasing (contingent on the rulings above)

Assumes Q1=A(+C verify), Q2=A, Q3=B, Q4=A(+B stretch), Q5=A1, Q6=A.
Each phase is separately land-able and committed separately per repo policy.

### Phase 0 — Enablers (no behavior change)
- Fork: `applyTaskPatches(patches)` window hook (field-level, id-keyed,
  idempotent, applied pre-`loadZone`; explicitly NOT part of the save blob) +
  `grantPerk(perkType)` hook. SAVE_VERSION unchanged. Headless-testable via
  the harness DOM-stub pattern.
- Harness: `gameDataPatch` config option in `driver.mjs`/`run-node.mjs`
  (apply patches after `initializeHeadless`, before the run loop).
- Pipeline: jta gains a skeleton `extractZoneRules` that emits the *vanilla*
  zone's perk-task locations (no randomization yet) behind a param default-off,
  proving the locations path end-to-end (world_generator → Generate.py →
  spoiler) before any content changes.

### Phase 1 — Perk randomization + AP checks (the old stack's core, absorbed)
- Seeded perk shuffle in the pipeline (respecting goal-zone scope); patches
  (`perk` field changes + grant suppression) stamped into per-region sidecar
  payloads; `ap_locations`-style map for perk tasks.
- Bridge: apply patches, dispatch `user:locationCheck` on perk-task completion
  (dedupe like `jtaArchipelago` did), grant perks on AP item receipt with
  inventory reconciliation on connect/rules-reload (reuse the re-baseline
  pattern from the reset-sync work).
- `supportedFeatures` += `arbitrary_ap_locations`.
- In-app test: randomized preset → complete a perk task → check sent → item
  receipt → perk present in game state.

### Phase 2 — Reset-paced balancing solver
- New `balance` module (home per Q3-B: importable by both the pipeline and a
  Node CLI; lives with the pipeline code, imports the fork's `build/*`).
  Legacy solver skeleton (bottleneck test → traversal costMult lever →
  xpMult lever → task costMult lever, log-scale bisection) over fork
  estimators + real-sim state advancement; emits per-task patches merged with
  Phase 1's.
- `resetsPerStep` + tolerance as substrate params; solver runs during pipeline
  generation (measure runtime; move to a Web Worker / pre-generation script if
  it blows the interactive budget — decision point, not a blocker).

### Phase 3 — Verification harness + acceptance
- `randomized-pacing-*` experiment family; assert measured reset gaps within
  band under pinned-pool tuned-defaults automation; SUMMARY.md round.
- One in-app smoke: randomized+balanced preset completes zone 1→2→3 within
  expected resets under playback automation.

### Phase 4 (stretch, own go/no-go) — Zone-order shuffle
- Seeded permutation at the spiral-driver seam; solver must flatten the
  2.2^zone traversal cliff (widen search ranges; expect xpMult to do more
  work). Gate on Phase 2/3 results.

### Phase 5 — Absorption audit → old-stack retirement green-light
- Walk the absorption map (§4); confirm nothing left in the old stack that
  isn't absorbed or explicitly dropped; produce the retirement checklist
  (actual deletion is its own future change, per the standing ruling).

## 4. Absorption map (what retirement requires)

| Old asset | Fate under this plan |
|---|---|
| `worlds/jta` apworld (perk placement, options, slot data) | Superseded by pipeline randomization + standard procgen→world_generator path (Phase 1); `resets_per_sphere` semantics carried into `resetsPerStep` |
| `post_output` Node subprocess bridge | Dies with the apworld path — solver runs natively in JS (Phase 2) |
| `jtaCostGenerator.js` (legacy solver) | Algorithm skeleton absorbed into the new balance module (Phase 2); code retired |
| `jtaCostPlanner.js` / `cost-plan.js` / `cost-debugger.js` | Per-category attempt targets recorded as Q6-B future option; two-pass xpMult idea absorbed; code retired |
| `simulator.js` + `gameData.js` (v0.5.0 economy copies) | Replaced by the fork's own estimators/sim (Q1-A); no port |
| `jtaGameDataLoader.js` + `jta:replaceGameData`/`patchTaskDefs` | Replaced by the fork `applyTaskPatches` hook + sidecar payloads (Q2-A) |
| `jtaArchipelago` perk↔item bridge | Conventions (location=task name, item=perk display name, reconcile-on-connect) absorbed into the substrate bridge (Phase 1); module retired |
| `cost-adjustment-algorithm.md` | Stays as historical reference for the absorbed algorithms; new balancing docs go in `docs/json/developer/procgen/jta.md` |

## 5. Open questions (beyond the six rulings)

1. **Patch application timing** (Q2 sub-choice): lazy per-region vs
   all-at-once at rules load.
2. **Solver runtime budget**: measure Phase 2 solve time; if >~10s in-browser,
   pick Web Worker vs generate-time script.
3. **Shared save × randomized seeds**: the one-shared-save ruling
   (`incrementalGameSave_substrate`) means perks/skills earned under seed A
   carry into seed B — with AP-authoritative grants the *perks* stop being a
   problem (they come from AP inventory), but carried *skills* deflate a new
   seed's pacing. Options when it bites: per-preset save keying (already
   deferred once), or solver assumes fresh-save state and accepts that veteran
   saves run ahead of pace. Not blocking; flag for the first playtest.
4. **Tolerance band default** (Q6): pick after first harness round.
5. **Multiworld pacing refinement** (Q3): post-fill sphere-log pass — deferred
   unless solo-approximate pacing proves wrong in real multiworld play.
6. **`grantPerk` hook shape**: verify the fork's internal perk-grant path
   (old game-bundle exposed `window.tryAddPerk`; fork exposes nothing) and
   whether grant needs to be persistence-safe (granted perks live in the
   save blob — an AP-granted perk must survive save/load without the task
   being complete).

## 6. Rulings requested

| # | Question | Options | Recommendation |
|---|---|---|---|
| 1 | Balancing math home | A fork estimators / B old-JS port / C harness-in-loop | **A in-loop, C as verifier, B algorithms-only** |
| 2 | Data delivery | A fork patch hook / B build-time data | **A** (field-level; shared by bridge + harness) |
| 3 | Randomization home | A AP seed gen / B procgen pipeline / C frontend load | **B** |
| 4 | Content scope | A perks+balance / B +zone-order / C +deep content | **A core, B stretch phase, C future arc** |
| 5 | AP checks now? | A this arc (A1 AP-authoritative / A2 local-grant) / B later | **A1** |
| 6 | Pacing knob | A single resetsPerStep+band / B per-category targets | **A** (B later as advanced params) |
