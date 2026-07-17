# JtA Synthetic Data — Post-v1 Design

**Date:** 2026-07-11 · **Status: RULED 2026-07-11 — the user accepted all
seven §8 recommendations as a blanket ruling (without a full read; if a
recommendation later proves wrong in implementation, surface it rather than
treating the ruling as immovable). Implementation owner = Opus.**

**Progress: Phase A SHIPPED + PUSHED 2026-07-12 (Opus)** — 4 commits on `main`
(`f1dfaa6e6`, `f2383ccac`, `23ac5ce5f`, `1ca9506f8`). Two implementation
decisions confirmed with the user, deviating slightly from the text below: the
id stride is **policy-gated** (mirror 20 / profiled 100 + validated override),
NOT globally widened (§2.3) — this keeps the mirror byte-identity gate literal;
and `skillCount` is **add-only** (reducing would sever the role couplings).
Acceptance (`CC/scripts/jta-stats/results/dataset-passb/profiled-batch.md`):
the xp_mult co-solve lever stays UNBUILT — zero floor-clamped milestone stalls
on generated C4-clean profiled worlds; 5f emergent gate PASSES on all.
**This doc moved from `NewDocs/plans/jta/` into git when Phase A implementation
started (standing convention).** **Phase B SHIPPED 2026-07-13 (Opus, on `main`,
NOT pushed)** — as the "reshaped Phase B" on the stepped-spiral pipeline (the
2026-07-12 re-sequencing: spiral parity first, so ②d lands on JtA's actual path,
not a sphere-growth detour). The ②d "content" step is spiral ② content; the
`generateZoneForSpecs`-into-sphere-growth selection strategy is DEFERRED (spiral
supersedes its v1 purpose). All four gates met — see
`CC/docs/plans/stepped-spiral-parity-plan.md` §6 Part 3. Design session deliverable (Fable planning window). Successor
design to `CC/docs/plans/jta-synthetic-data-plan.md` (Phase 5, RULED + 5a–5f
DONE); this document sequences everything AFTER Phase 5g. **Phase 5g
(raw-value economy mode, Fork 1.8) is phase zero of this plan and is already
planned + ruled** (parent plan §6 5g, §7 Q8/Q9) — this document does not
re-open it, but §2.6 hands its implementer a short rider list that is cheap
while 5g is still unimplemented.

Settled and NOT re-opened here: all v1 scope rulings (linear topology v1,
vanilla-balance skeleton, effects-vanilla-like, namebank-only theme v1), all
seven Phase-5 §7 rulings plus Q8/Q9, `threshold_other_metric = LEVEL`, the 5f
progression gate, `resetsPerStep = 5`, coverage-hard/pacing-advisory
verification, behavior-slots-with-effects-endpoint (per-behavior shim only on
concrete need), single-carrier + refs carriage.

The five questions this document answers:

1. §2 — structural departure from the vanilla mirror (structure policy v2 +
   the balancing levers, grounded in a new measurement experiment).
2. §3 — branching zone topology (dataset, engine, balance pass, verification).
3. §4 — the declarative effect vocabulary and the per-behavior migration.
4. §5 — theme/narrative hooks beyond namebanks.
5. §6 — where synthetic generation lives in the procgen stepped pipeline.

§7 sequences the phases; §8 collects the rulings requested.

---

## 1. Ground facts (verified 2026-07-11)

Condensed from a code survey this session; cites are current HEAD.

### 1a. The Pass-B walk — what is and is not order-coupled

- The walk is SERIAL: one integer `frontier`, one entry released at a time
  (`jtaBalance/balancePass.js:254,263-270,441`), one milestone timeline
  (`milestoneBaseRun` scalar, `:255,330,437-439`). It **never travels**: no
  `loadZone`/`walkTo` anywhere in the pass — zone entry is emergent from the
  fork's own automation replaying zones **in array order from zone 0 every
  energy reset**.
- First-touch = `setTaskFirstStartCallback` fires on the sim's first actual
  start of a released task; `solveEntry` geometric-bisects
  `estimateResetsToComplete` over `cost_multiplier ∈ [0.05, 1e6]`
  (`balanceCore.js:241-270`), patches, never revisits. The boundary fallback
  (≥2 runs after release) solves never-started frontiers at run boundaries
  (`balancePass.js:490-508`).
- Order comes from `orderBuilder.buildWalkOrder`: integer-sphere buckets from
  the log (bucket assignment is the ONLY thing the log's internal order
  contributes — within-sphere order is lexicographic noise and is discarded),
  seeded per-bucket shuffle, then a topological repair over edges. **The one
  topology-coupled rule: `buildBucketEdges` orders `Travel(z)` before every
  task with `zone > z` — a numeric total-order test**
  (`orderBuilder.js:147-155`), plus Mandatory-before-Travel within a zone
  (`:124-135`).
- `setCostedTaskIds` confinement is an id-set, topology-blind
  (`simulation.ts:960-987`).
- §4.2 trigger instrumentation (already built, 5e): per-entry
  `clamp ∈ {floor, saturated, threshold}`, `stalled` + stall diagnostics,
  `milestone`, per-bucket band profiles; aggregated by
  `CC/scripts/jta-stats/sweep-dataset-passb.mjs:100-183` into three named
  triggers — **xp_mult co-solve** (milestone stalled/saturated), **economy
  scaling** (a whole zone band pinned at floor), **economy starvation**
  (saturated solves in a band).

### 1b. The engine — how linear it really is

- `GAMESTATE.tasks` is rebuilt from `ZONES[GAMESTATE.current_zone]` ONLY
  (`simulation.ts:1019-1031`). Consequence: the `has_unfinished_mandatory_task`
  → disable-all-Travel gate (`simulation.ts:999-1010`) is **already
  current-zone-scoped in effect** — it loops the live task list, which is one
  zone's. Branching does NOT need a fork change here. (An earlier reading of
  this gate as cross-zone-global is wrong.)
- Still genuinely linear/ordinal: `advanceZone` (+1 on native Travel
  completion), `highest_zone` (a highwater ordinal driving auto-prioritize
  coverage 0..highest and the auto-prestige stall trigger), free-zone-skip
  (skips fully-completed zones in array order), and — until 5g — the economy
  backbone `pow(2.2|4, zone_id)` + per-zone drain + `1.25^zone` XP scaling.
- Managed mode already host-drives zone transitions (`loadZone` does the full
  advanceZone bookkeeping, Fork 1.6 playtest fix round 1); synthetic exit
  tasks (ids ≥ 10000, one per (zone, exitIndex), stable) are the host's
  region-graph edges and are NOT AP locations; the dataset's native Travel
  tasks ARE AP locations and (in standalone/worker play) advance the zone
  array linearly.

### 1c. Pipeline + carriage + caching

- The stepped pipeline wraps ONLY sphere-growth and top-down. **JtA is
  spiral-only and monolithic today** (`arrangeShuffledSpiral` →
  `synthesizeZonePayload`/`extractZoneRules`); it implements no
  `generateZoneForSpecs`, so it cannot participate in sphere growth or the
  stepped ③ Regions step. The engine stubs anticipate JtA implementing it
  "as a selection strategy" (`procgenPipelineEngine.js:3898-3901,4619`).
- Stepped-pipeline editable-artifact convention: a serializable envelope;
  presence-based invalidation (`STEP_OUTPUT_PRESENT`/`detectCompleted`,
  `sphereSteps.js:603-626`); each runner clears downstream fields; rng
  re-derivation makes mid-pipeline edits deterministic. Presets store config
  knobs only, not envelopes.
- Dataset mode is a **library-global side channel** (`setJtaDataset`) called
  only from CLI/test scripts — no pipeline step, panel, or preset can turn it
  on today. Carriage (zone-0 carrier + refs, warehouse resolution, bridge
  `loadGameData`) is production-ready and proven.
- **`dataset_id` is a pure function of (theme, seed, zoneCount)**
  (`generateDataset.js:419`) and the Pass-B cache key + fork save slot key on
  it (`hostGlue.js:185-188`, `getSaveLocation`). A dataset whose CONTENT is
  edited without changing those three params keeps its id ⇒ **stale Pass-B
  patches replay onto wrong task ids and an incompatible save loads**. Fine
  today (nothing edits datasets); a blocker for any editable-artifact story
  (§6) and for hand-edited experiments (§2.4 worked around it manually).
- Structure policy v1 caps a zone at 20 tasks (`id = zi*20 + ti + 10`,
  `generateDataset.js:336`) — an id-scheme artifact, not a design intent.

### 1d. Experiment plumbing added this session

`verify-jta-locations-roundtrip.mjs` gained `JTA_RT_DATASET_FILE`
(committed `b95fa96e4`; bypasses
generation, uses the given document verbatim; generation-time validator/C4
gates are deliberately skipped — the fork's `loadGameData` validation still
applies). With `JTA_RT_QUOTA=15` this gives a one-command path from a
hand-edited dataset to a filled export + Pass-B solve. Used by §2.4; also the
natural seam for §2.5's departure sweeps.

---

## 2. Question 1 — structural departure from the mirror

### 2.1 The frame

v1's mirror is balance-isomorphic to vanilla BY CONSTRUCTION, so the 5e
verdict ("no lever fires") certifies the *machinery*, not synthetic data in
general. The design question decomposes into: (a) which departures the
EXISTING machinery (C1–C4 generation gates + Pass-B first-touch cost solve +
threshold-engagement clamp) already absorbs, (b) which ones need levers that
don't exist, and (c) what the generator's parameter surface should look like
once it stops mirroring.

The load-bearing property (from §1a): Pass B plays the REAL fork against
whatever tables are loaded and re-anchors state every step. Cost-side
consequences of ANY structural departure are absorbed automatically — the
failure modes are exclusively the ones the §4.2 triggers name: a required
SKILL LEVEL that cannot be reached within budget at any cost (floor clamp →
stall → the xp_mult co-solve trigger), and systematic band-level clamping
(economy triggers).

### 2.2 Departure taxonomy

| Departure | Verdict | Why / guard |
|---|---|---|
| Task count per zone (±) | SAFE | Pass B costs each task at first touch; more tasks = more resets per zone, milestone pacing unchanged. Guard: C4 floors (more/fewer training opportunities move margins, gate catches). Needs the §2.6 id-scheme widening. |
| Task-type mix (Normal/Mandatory/Boss counts) | SAFE within invariants | Invariants: ≥1 Travel per non-terminal zone (linear: exactly 1); Boss cost via raw values post-5g (pre-5g the 4^zone backbone makes Boss-heavy zones solver-hostile — one more reason 5g is phase zero). Mandatory placement is free (gate is zone-scoped, §1b). |
| reps/xp per task | SAFE | Profile quantiles as priors; C4 re-checks totals. |
| Perk/item roster size + placement cadence | SAFE | Sentinel/`libraryItems` already dataset-driven; behavior slots stay fixed (§4). Automation-unlock perk must stay reachably early (existing C2-adjacent rule). |
| Skill COUNT + introduction cadence | SAFE mechanically; C4 is the balance gate | Count rewrite proven (5b). More skills = thinner training per skill ⇒ C4 floors bind — this is where the §2.5 repair loop earns its keep. |
| Zone count / length | SAFE (already a param) | Post-5g, raw values decouple depth from the exponential backbone entirely. |
| Skill-demand patterns that outrun training supply | **THE unsafe class** | Demonstrated in §2.4: this is the only structural failure axis the harness surfaces, and C4 is exactly its static predictor. |
| Global difficulty (systematically easier/harder worlds) | Needs the §2.5 economy lever (post-5g only) | Pre-5g the backbone is compiled; post-5g the generator owns the raw curve. |

### 2.3 Structure policy v2 — profile-parameterized generation

`generateJtaDataset` grows a `params.structure` block; `policy: "mirror"`
(the v1 behavior) stays the default and must regenerate byte-identically:

```jsonc
"structure": {
  "policy": "mirror" | "profiled",
  "zoneCount": 15,
  "tasksPerZone": { "mean": 9, "jitter": 0.25 },      // or per-zone array
  "skillCount": 10,
  "typeMix": null,          // per-zone overrides; default = profile-shaped
  "perkCadence": null,      // placements per zone; default = profile-shaped
  "unlockChainDensity": null,
  "economy": null           // post-5g: raw-curve params (§2.5 lever 2)
}
```

Under `profiled`, the generator samples counts/mixes/reps/xp from the
vanilla-profile DISTRIBUTIONS (`results/vanilla-profile.json` already carries
per-zone type histograms and quantiles) instead of copying entries, then
assigns skills under the C4 discipline below. Identity synthesis (names,
permutation, ids) is unchanged. Two mechanical riders: widen the id scheme to
`zi*100 + ti + 10` (90 tasks/zone headroom, still < 10000), and stamp a
content hash into `dataset_id` (§2.6).

**C4 gains a repair loop.** Today C4 is assert-only (mirror always passes at
1.00×). Under `profiled`, on a floor violation the generator REPAIRS
deterministically instead of throwing: raise `xp_mult`/`max_reps` on
already-generated earlier tasks training the deficient skill (bounded by
profile p95), or retarget a Normal task's skill assignment; log every repair
into `provenance`. Rationale: generation-time repair keeps the invariant
where it is cheapest to hold and preserves the measurements-first staging —
the runtime lever (below) stays unbuilt until a C4-CLEAN world fires a
trigger.

### 2.4 Experiment — which triggers actually fire (run 2026-07-11)

Method: baseline z15 dataset (seed 1, `sunken-meridian`), three hand-edited
departures injected via `JTA_RT_DATASET_FILE` (bypassing the generation
gates ON PURPOSE — the point is to see the runtime instrumentation catch
what the static gates would have), each exported through the full
roundtrip (world_generator + Generate.py fill, seed 1, z15 = 130+
locations) and solved by `verify-jta-balance-pass.mjs`; trigger aggregation
identical to `sweep-dataset-passb.mjs`. Control = the committed ds1-f1 row
(`results/dataset-passb/SUMMARY.md`).

- **D1 "dense"** — +6 Normal tasks in zone 6 (clones of that zone's own
  skill/reps/xp patterns; 136 tasks). A C4-INCREASING departure.
- **D2 "demand"** — every zone-12..14 Normal/Boss task re-pointed to demand
  the least-trained skill (the Ascension-analog: literally ZERO training
  opportunity before z12). A demand-side C4 catastrophe.
- **D3 "supply"** — `xp_mult → 0.05` on all 15 pre-z12 tasks training the
  least-trained *trained* skill ("Drifting", opp 105); demand untouched. A
  supply-side C4 violation.

**RESULTS (z15, fill seed 1):**

| Case | Entries | Solver bar | Stalled | Saturated | floor/threshold clamps | Triggers | totalResets | gap p50/mean/max | cm max |
|---|---|---|---|---|---|---|---|---|---|
| control (committed ds1-f1) | 130 | PASS | 0 | 0 | (typical) | all silent | ~70 | in band | 1.09e5 |
| D1 dense | **136** | **PASS** | 0 | 0 | 10 / 18 | **all silent** | 80 | 2 / 2.9 / 15 | 1.27e4 |
| D2 demand | 130 | **FAIL** (8 stalled) | **8** (2 milestones) | 0 | 11 / 20 | **xp_mult co-solve FIRED**; economy triggers silent | **574** | 3 / 10.2 / **141** | 3.91e3 |
| D3 supply | 130 | **PASS** | 0 | 0 | 11 / 12 | **all silent** | 66 | 3 / 3.1 / 9 | 805 |

Reports: scratchpad `bp-d1dense/d2demand/d3supply.json` (session-local, /tmp
convention); aggregation script `analyze-departures.mjs` beside them.

**Findings (the evidence the rest of §2 stands on):**

1. **Task-count departure is safe, with evidence.** D1's 6 extra tasks walk,
   cost, and pace normally (136/136 entries, gaps in band); the walk has no
   hidden mirror dependency. (Its cm max 1.27e4 is the known
   exponential-fighting pathology 5g removes — unrelated to the departure.)
2. **The trigger instrumentation discriminates correctly.** D2's injected
   pathology fired EXACTLY the trigger designed for it — milestone stalls
   with floor-clamped solves (`cm = 0.05`, `thresholdSkipped`, all in the
   late buckets), totalResets blowing out 66→574 as the walk grinds waiting
   for untrainable levels — while both economy-band triggers stayed silent
   (they measure a different mode). §4.2's harness is validated as the
   detection instrument for the levers.
3. **C4 is the right static predictor, and it is CONSERVATIVE.** D2 (zero
   prior opportunity + concentrated late demand — a gross C4 violation) is
   fatal; D3 (a ~20× supply cut on a moderately-used skill — also a C4
   violation) is fully ABSORBED by the existing machinery (cost range +
   waiting inside the 60-reset stall bar). So: C4-clean ⇒ no observed
   trigger; C4-violating ⇒ at-risk, not doomed. This is precisely the
   posture §2.3's repair loop + §2.5's trigger-gated lever encode: keep
   generated worlds C4-clean at generation (cheap, deterministic), and
   build the runtime lever only if a C4-clean world ever fires the trigger
   — none has, across the 5e batch, 5f, and this experiment.

### 2.5 The levers, designed

**Lever 1 — xp_mult co-solve (Pass B, worker).**
- *What it solves:* a released task whose demanded skill cannot reach the
  required level within the step budget at ANY `cost_multiplier` ≥ MIN — the
  floor-clamp→stall mode. The estimator inversion has run out of range at the
  BOTTOM (the 5e batch's 1.09e5 multipliers were the TOP running out; 5g
  fixes that side by reparameterization).
- *Mechanism:* when a solve floor-clamps AND the level deficit is the cause
  (the existing `isLevelMetricTask`/stall diagnostics already distinguish
  this), extend the inversion to the task's OWN `xp_mult` at `cm = MIN`:
  find the smallest `xp_mult ≤ bound` (profile p95 × a configured ceiling)
  such that replay-training closes the level gap within the remaining step
  budget — `estimateResetsToComplete` already models xp accrual, so this is
  the same bisection on a second axis. `xp_mult` is Tier-1 patchable
  (`applyTaskPatches`), rides the same patch list, caches identically.
- *First-touch discipline preserved:* only the task being solved is touched —
  no retroactive edits to already-costed tasks.
- *Report:* new `xpSolved` counter + per-entry `xpMult` in the patch; the
  §4.2 aggregation gains an "xp co-solve engaged" column.
- *Inertness gate:* on any input where the trigger condition never occurs,
  emitted patches are byte-identical to the pre-lever solver (the lever is
  a new branch in the floor-clamp path only).
- *Proof it fires correctly:* re-run the §2.4 D2/D3 departures through the
  extended solver — stalls/floor-stalls clear, gap means return to band; D1
  and the mirror batch byte-identical.

**Lever 2 — economy scaling (Pass A, generator; post-5g only).**
- *What it solves:* systematic band-level clamping — whole zone bands at
  floor (world too hard for its depth curve) or saturated (too easy) — which
  no per-task lever should fix.
- *Mechanism:* NOT a runtime lever. Under raw mode the generator owns the
  difficulty backbone; `params.structure.economy` parameterizes the raw-value
  curve (base cost, per-zone growth, Boss premium, drain curve, xp curve).
  Calibration is a measurement loop: `sweep-dataset-passb.mjs` over a params
  grid; the band profiles name the correction direction. The knob ships with
  profile-derived defaults = vanilla's own curve (so `mirror` and default
  `profiled` are unchanged).
- *Signal that it's needed:* the two economy triggers (§1a), which §2.4 shows
  stay silent under feasible-by-C4 departures.

**Detection harness re-use:** `sweep-dataset-passb.mjs` grows a
`--dataset-file FILE[,FILE…]` mode (env pass-through of `JTA_RT_DATASET_FILE`
already works — the sweep just needs the loop + labeling) and a
`--structure JSON` mode once policy v2 exists, so departure batches are
one-command and their trigger tables land in `results/dataset-passb/` beside
the mirror rounds.

### 2.6 Riders for 5g (cheap while it is unimplemented — hand to Opus with 5g)

1. **`computeC4Report`/`opportunityTable` hardcode `XP_ZONE_MULT = 1.25`**
   (`generateDataset.js:99-129`). Under `value_mode: "raw"` the opportunity
   weight must read the task's `raw_xp` (floors stay profile-derived —
   vanilla is formula-mode). Without this, C4 silently mis-weights every
   raw dataset. 5g's plan doesn't currently mention it.
2. **Content-hash the dataset identity.** `provenance.content_hash` = FNV-1a
   over the canonical document minus `provenance`; `dataset_id` gains the
   short hash (`synthetic-<theme>-s<seed>-z<zones>-<hash8>`). Fixes the §1c
   cache/save poisoning for ANY future edit path, and gives hand-edited
   experiment documents correct identity for free. Add a
   `datasetValidator.js --restamp` CLI mode (recompute hash, rewrite id) for
   hand-edit workflows. Do it in 5g because 5g already touches generator +
   validator + schema and regenerates fixtures; doing it later invalidates a
   second round of fixtures.
3. **Optional `zones[].key`** (short stable string, unique): a
   position-independent zone identity for §3's topology edges and §5's arc
   references. Additive, ignorable by the engine. Same
   touch-the-schema-once argument.

(5g's own design is otherwise untouched by this document; §3.3 confirms its
raw mode is exactly what branching needs.)

---

## 3. Question 2 — branching topology

### 3.1 What branching means in JtA terms

Three layers, deliberately kept distinct:

- **Host/region layer (already branching-capable):** procgen region graphs
  with >1 exit per jta region; exits are synthetic host tasks with stable
  per-(zone, exit) ids; the playback bot walks the graph; `walkTo` designates
  an exit. Nothing here assumes linearity — this layer needs NO design work.
- **Dataset layer (this section):** zones arranged in a DAG rooted at zone 0.
  Schema addition (new `topology` section, absent ⇒ linear v1 semantics
  exactly):

  ```jsonc
  "topology": {
    "edges": [ { "from": "z-vault", "to": "z-reef", "travel_task": 214 } ]
  }
  ```

  with `zones[].key` (§2.6 rider) as the node identity. Validator rules:
  DAG; single root = zones[0]; every zone reachable; every non-terminal zone
  ≥1 out-edge; each edge's `travel_task` is a Travel-type task in its `from`
  zone (one native Travel task PER EXIT — Travel count per zone becomes the
  out-degree); the goal zone is a designated terminal; optional dead-end
  branches are allowed (they are pure AP content — fill may place progression
  there, the sphere log resolves it). **`zones[]` MUST be a topological
  linearization of the DAG** (validator-enforced). Free-zone-skip,
  `highest_zone`, and the array all operate on that linearization.
- **Engine layer (stays linear):** the fork keeps its zone ARRAY and plays
  one zone at a time. Branching is expressed by the HOST loading zones in
  graph order. §1b's finding removes the scariest fork change (the mandatory
  gate is already zone-scoped); what remains is a short verify-first list
  (§3.4).

**The PURPOSE ruling (parts must fit):** the region graph and the dataset
zone DAG must be isomorphic. Direction of fit: **the region graph is the
skeleton; the dataset is generated to fit it.** The arrangement/growth step
emits a `graphSpec` (nodes with out-degrees, depth estimates, goal node);
`generateJtaDataset` consumes it and emits zones + edges matching 1:1. (The
reverse direction — dataset first, arrangement realizes it — falls out for
free in CLI/spiral use, where the generator itself invents the graphSpec
from params.) This is also exactly the shape `generateZoneForSpecs` wants
(§6.3): growth decides topology, the substrate supplies fitting content.

### 3.2 Why 5g is REQUIRED here (already assessed, restated for dependency)

Under branching, zone ordinal stops being the difficulty axis — two zones at
array positions 5 and 9 can be alternative same-depth branches. The
`2.2^zone_id` backbone would price them absurdly apart; raw mode prices them
by VALUE, making array position economically meaningless. Bonus consequence:
**re-linearization becomes value-preserving** — the same DAG can be emitted
with a different topological order of `zones[]` (ids, edges, raw values all
travel with the zone objects) and the world is economically identical. §3.5
uses this for verification.

### 3.3 The balance pass under branching

The generalization is far smaller than feared, because of two §1a facts: the
walk is SERIAL and never travels, and the order builder discards within-
sphere log order anyway.

1. **Order builder: NO edge-rule change needed.** The `Travel(z) → tasks in
   zones > z` numeric test stays SOUND provided `zones[]` is topologically
   sorted: the worker walk's replay is the fork's linear array replay, so in
   the walk's own dynamics, zone w genuinely is reached only after every
   array-earlier zone. The rule over-constrains relative to the GRAPH (it
   orders parallel branches by array position), but that only affects
   within-bucket ordering — bucket assignment still comes from the sphere
   log, which encodes the fill's actual access resolution over the real
   (branching) access rules. Document the soundness argument in
   `orderBuilder.js` when Phase C lands; change nothing.
2. **First-touch state skew is the real (bounded) distortion.** Within a
   sphere containing parallel-branch tasks, the walk costs branch-A entries
   with pre-branch-B state and vice versa, in seeded-shuffle order; a real
   player choosing the other branch first sees different levels than the
   walk assumed at those tasks. The skew is bounded by one bucket's worth of
   state gain. Staged response:
   - **Default stance: accept + measure.** Emergent play is automation-
     driven (both in the driver and via the in-app playback bot), and
     automation interleaves available work rather than committing to one
     branch — its state accumulation resembles the walk's more than a
     single-path human's. The 5f progression gate + pacing advisory on §3.5's
     sweeps is the arbiter, per the house measurements-first rule.
   - **Ready lever: sphere-start batch costing.** If the sweeps drift: solve
     ALL entries of an integer-sphere bucket against the state at bucket
     START (the estimator is state-reading but side-effect-free; the walk
     already patches before playing), then release + play the bucket. Makes
     within-bucket order irrelevant entirely; slightly conservative (later
     entries costed as if earlier same-bucket training hadn't happened).
     This is a localized change in `balancePass` (solve timing), not an
     architecture change.
3. **Confinement and milestones: unchanged.** `setCostedTaskIds` is an
   id-set; the milestone timeline is a property of the walk's serialization,
   not of the topology.
4. **Cache: unchanged** — `(seed, dataset_id)`; content-hashed ids (§2.6)
   make re-linearized variants distinct entries, which is correct (their
   sphere logs differ).

### 3.4 Engine verify-first list (Phase C slice 1 — scoping, not building)

Each item: verify the behavior in managed mode, then apply the smallest
remedy. Candidate remedies named so Opus starts with a hypothesis, not a
blank page:

| # | Question | Candidate remedy if needed |
|---|---|---|
| E1 | Does completing a native Travel task in MANAGED mode call `advanceZone` (array +1)? Branching needs it NOT to (the host owns transitions; a graph edge's Travel completing must check its AP location and signal the host, not move the engine off the host-designated zone). | Managed-mode guard at the advanceZone call site (the bridge already owns transition bookkeeping via `loadZone`) — dormant in standalone, parity-gated. |
| E2 | `highest_zone` highwater vs skipped branches: after the host loads array-position-7 while position-5 (other branch) is unvisited, does auto-prioritize planning zones 0..7 (including 5) misbehave — wasted priorities, wrong Reflections/stall-trigger accounting? | Either harmless (priorities for a zone the engine never enters are inert — tasks list is per-zone, §1b) — verify and document; or a managed-mode visited-zone set feeding the planners. |
| E3 | Free-zone-skip over a linearization prefix containing UNVISITED branch zones: skip requires fully-completed, so it stalls at the first skipped-branch zone — is that observable in managed play at all (host teleports directly)? | Expected inert in managed mode; verify, document, and keep the worker walk (which DOES linear-replay) aware that its replay completes branches in array order — already its semantics. |
| E4 | Victory/goal semantics with dead-end branches: goal zone completion while an optional branch is incomplete. | Already host-side (Victory is an AP location + completion condition); expected no engine involvement; verify. |

If E1 is the only real change (likely), the fork surface of branching is one
guarded call site — Fork 1.9, parity-gated by the standing discipline
(native byte-identical; managed-mode delta = exactly the guard).

### 3.5 Verification story for branching worlds

- **Static:** validator topology rules (§3.1); C4 generalizes by replacing
  "zones < Z" with "ancestors of Z in the DAG" — the honest opportunity set
  (a training task on the OTHER branch is not guaranteed prior play).
  Conservative for optional branches feeding the trunk; measured against the
  emergent layer like today.
- **Solver layer:** `sweep-dataset-passb` unchanged (the walk generalizes per
  §3.3); branching batches land beside linear rounds.
- **Emergent, tier 1 (cheap, headless):** the driver plays the fork
  standalone = plays THE linearization. Generate K alternative topological
  linearizations of the same DAG (value-preserving under raw mode, §3.2),
  sweep each with the 5f progression gate + pacing advisory. Divergence
  ACROSS linearizations of one world is the branch-order-sensitivity
  measurement — this is the concrete generalization of the emergent sweep to
  multiple frontiers, and it triggers §3.3's batch-costing lever if it
  drifts.
- **Emergent, tier 2 (acceptance, in-app):** one playback-bot walk over the
  real region graph per branching template (the substrate test harness +
  `walkTo` machinery already span resets and regions), asserting progression
  gate + grants — the bridge-seam proof the headless tiers can't give.

---

## 4. Question 3 — the effect vocabulary

### 4.1 Decomposition of the slot inventory

The 49 behavior keys (17 perk + 4 item + 16 prestige-unlock + 12 repeatable,
`datasetBehaviors.js`) collapse into ~14 parameterized declarative kinds.
Target vocabulary (v2 `effects[]` entries; kinds marked ✅ already exist):

| Kind | Params | Absorbs (slot keys) |
|---|---|---|
| `skill_speed` ✅ | skill, add | (already data) |
| `energy_on_consume` ✅ | base_amount | (already data) |
| `xp_all_mult` | mult, scope: run\|prestige | xp_all_mult_a/b, xp_all_prestige_mult(_b) |
| `starting_energy` | flat / per_reset growth, curve: linear\|square, scope | starting_energy_flat, starting_energy_growth(+_square), starting_energy_prestige_flat |
| `time_compression` | mult | time_compression_minor/major |
| `energy_drain_mult` | mult, source: flat\|zone_history | energy_drain_reduction, energy_drain_zone_history, grant_drain_reflections |
| `speed_global` | per_unit, source: completed_zones\|perks_held | speed_per_completed_zone, speed_per_perk_held |
| `item_energy_mult` | mult | item_energy_mult |
| `spark_gain` | mult\|double | spark_gain_mult_a/b/c, spark_gain_double_a/b |
| `keep_items_on_reset` | — | keep_items_on_reset, note_item_floor_on_reset (variant: floor) |
| `unlock_feature` | feature: automation\|attunement\|attunement_search\|attunement_crafting\|see_beyond\|permanent_automation | automation_unlock, attunement_enable, attunement_expand_*, see_beyond_the_veil, permanent_automation |
| `attunement_gain_mult` | mult | attunement_gain_mult |
| `travel_skill_prestige_mult` | mult | travel_skill_prestige_mult, (godly travel) |
| `queued_effect` | on, effect: haste\|xp\|boss_haste\|duplicate, magnitude | the 4 artifact queue mechanics, mastery_of_time, tick_rate_from_energy_overflow |

The last two rows are the deep-coupling tail (queue engine, prestige
plumbing) and migrate LAST or never — a behavior key that never blocks
generation freedom the generator wants is allowed to stay a slot
indefinitely (the ruled per-behavior stance).

### 4.2 Migration order and mechanics

Order by (generator value ÷ site cost) — the generator wants to VARY
magnitudes and PLACE effects freely; a slot only hurts when it pins a
placement or a magnitude the generator wants free:

1. `xp_all_mult` (2 in-run slots; single multiplicative site).
2. `starting_energy` family (the 4 accumulator sites are already enumerated
   from the bonus-sync work — `jta_starting_energy_bonus`).
3. `time_compression` (2 slots, one rate site).
4. `energy_drain_mult` (2 slots).
5. `speed_global`, `item_energy_mult`, `spark_gain` as needed.
6. `unlock_feature` (placement freedom only — magnitudeless).
7. `queued_effect` tail: only on concrete need.

Per-behavior mechanics = the proven 5b pattern: a runtime `EFFECTS` handler
table in `simulation.ts` with vanilla defaults (SKILL_ROLES/ECONOMY/
PRESTIGE_DATA precedent); the enum-identity branch rewrites to read the
effect entry; `loadGameData` populates from the dataset; the validator's
slot-constraint table drops that key. Each step is one fork release, gated
by: native byte-identity, 5c dataset lockstep (vanilla fixture re-expressed
with the migrated key as an `effects[]` entry must be tick-identical), and a
**magnitude-perturbation canary** — a dataset with a NON-vanilla magnitude
for the migrated effect must DIVERGE in lockstep (anti-vacuity: proves the
data path is live, the compiled default dead).

### 4.3 Magnitudes for effects vanilla never exhibits

- **Priors from the fixture:** per-kind magnitude tables measured from
  vanilla (each kind has 1–3 vanilla exemplars + roster position). Encoded
  in a new `effectMagnitudes.js` beside `datasetBehaviors.js`; the generator
  samples within prior range by default (ruling 3 spirit).
- **Novel territory (multi-effect entries, off-range magnitudes, new
  placements) — one-knob perturbation protocol:** generate variants varying
  a single magnitude across a ladder, run passb + a short emergent sweep per
  rung; the widest rung ladder where the progression gate + pacing band hold
  becomes that kind's VALIDATED range and updates `effectMagnitudes.js`.
  Evidence-backed ranges instead of hand-waved ones, reusing §2.5's
  `--dataset-file` batch mode wholesale.
- **Why cost-side is not the risk:** Pass B replays the real sim, which
  models every live effect — costs re-anchor automatically. The failure axis
  is pacing/trivialization (a 10× `time_compression` collapses the reset
  economy), which is exactly what the emergent band measures.

### 4.4 Addendum (2026-07-16) — Phase-D riders + vanilla-snapshot unification

Recorded at the omsi-XML-resume planning session, after a side-by-side of this
system with the omsi XML migration plan (which now imports THIS plan's mechanics —
two-layer model, gate triple, perturbation canary; see the omsi plan §8). Three
small items attach to the JtA side:

**Rider D-a — standalone `?dataset=<url>` boot. DONE 2026-07-16 (fork `4b8ae1a`,
attached to rung 2).** `maybeLoadDatasetFromUrl` in game.ts: after the normal
bootstrap (standalone only — managed mode ignores the param, the bridge owns
dataset loading there), fetch the URL and feed it through the same path as
`window.loadGameData` (full validation, dataset-keyed save slot; the brief
vanilla boot never touches the dataset's save). Failures keep the vanilla game
and surface console + alert. Also exposed `window.getLoadedDatasetId`. Guard:
`scripts/procgen/verify-jta-dataset-url-boot.mjs` (two local servers, the
dataset one cross-origin + CORS; asserts vanilla boot absent the param, themed
zone-0 task + dataset id with it, alert + vanilla-intact on a broken URL).
Byte-inert leg: native parity 4/4 + UI parity zero DOM diff re-ran green
against the D-a fork commit.

**Rider D-b — new-stack in-UI dataset import/export.** The only existing UI
import/export (`jtaGameDataPanelUI.js`) belongs to the retired jta-randomizer stack
and moves SAVE blobs + old cost tables, not schema datasets. A new-stack surface is
validator + `setJtaDataset`/`loadGameData` + file-picker wiring, plus export =
serializing the live doc (the CLI exporter already proves the shape). Small;
attach to Phase D or land independently.

**Unification U-a — retire `zoneTaskData.js` in favor of `datasets/vanilla.json`.
DONE 2026-07-16 (`950c18dbb`) — new `vanillaDataset.js` (static JSON module import),
one `_zoneView` derivation, all consumers switched, snapshot + generator deleted,
zoneCount backlog item closed; every gate byte-inert (dump-spiral dump
byte-identical, Generate.py artifacts sha256-identical, vitest 2966, preset regen
zero drift).**
The pipeline's VANILLA identity channel still reads the hand-maintained snapshot
`zoneTaskData.js` (names/types/perks/items — the source of the `zoneCount: 16`
hand-sync backlog item), while the synthetic channel reads the dataset doc. Since
vanilla-through-the-loader is proven tick-identical (§5c/5g) and
`datasets/vanilla.json` is regenerable from the fork build
(`export-vanilla-dataset.mjs`), pointing the vanilla channel at the dataset fixture
makes ONE data path serve both, retires the snapshot file, and dissolves the
hand-sync assertion item (the exporter + schema validator BECOME the sync
mechanism). Gate: byte-inert on all pipeline outputs (dump-spiral 5/5, Generate.py
roundtrips) — the fixture is a superset of the snapshot, so this is
read-site-only. Standalone small item; do NOT bundle with a Phase-D rung (different
risk surface).

---

## 5. Question 4 — theme and narrative hooks

v1 is namebank-only BY RULING; this designs what the schema grows so theme
can CONSTRAIN structure, without re-opening v1. Guiding order:
**theme → structure params → skeleton → identities** — theme becomes the
outermost prior, and everything it constrains flows through the SAME
C1–C4 + Pass-B gates as any other structure (no new balance surface).

Schema growth (additive; all optional; `entityTheme` stays open-shaped):

1. **Arc:** `dataset.theme.arc = [{ zones: [keys], beat:
   "setup"|"rising"|"climax"|"denouement" }]` + `zones[].theme.arc_beat`.
   Constraint direction: the arc template feeds structure policy v2 (climax
   beats pull Boss placement + perk density; denouement shortens zones) —
   arc is a PRIOR over `params.structure`, resolved before sampling.
2. **Threads (task micro-stories):** `task.theme.thread = { id, step }`.
   Generator emits thread task-sequences from theme templates
   (verb-sequence + type-pattern grammars in namebanks v2) and REALIZES the
   narrative order mechanically: `unlocks_task` chains and/or same-zone
   ordering follow thread steps. This is the concrete "task sequences that
   read as stories" mechanism — narrative implies structure, structure is
   what fill and the balancer already handle.
3. **Effect-aligned naming:** namebanks keyed by effect kind + magnitude
   tier (`perkNames.skill_speed.strong` etc.), so item/perk names MATCH
   their effects — the "parts fit each other" purpose at the name level.
   Falls out of §4's vocabulary (the generator knows each entry's kinds).
4. **Narrative content (the eventual destination):** reserve
   `theme.narrative` at dataset level and `flavor`/`prologue`/`epilogue`
   strings at entity level. Display surfaces: perk/item tooltips are ALREADY
   dataset-carried (live today); zone/task flavor display needs one dormant
   fork UI surface (a flavor line under the task name — additive, dataset-
   only, parity-inert when absent). Defer the fork touch until content
   exists to show; the schema fields cost nothing now.
5. **Provenance vs content:** the theme CONTRACT (namebank tables, arc/
   thread templates) stays generator-side (namebanks v2 module); the
   DOCUMENT carries what was chosen (titles, flavor, beats, thread tags) —
   same split as today's `namebanks: {theme: key}` breadcrumb.

---

## 6. Question 5 — pipeline placement

### 6.1 The step split

The user's prior (structure early / balance post-fill, mirroring Pass A/B)
maps onto the stepped pipeline as ONE new step plus the existing in-app pass:

- **New sphere-mode step ②d "content" (dataset synthesis)** between ②b
  topology and ②c items:
  - Runs AFTER topology because that is when the jta node set, exit degrees,
    and depth estimates exist — exactly the `graphSpec` §3.1 needs (for
    linear spiral worlds the graphSpec is trivially a chain).
  - Runs BEFORE items because the item pool for jta regions derives from the
    dataset (perk names) — ②c round-robins items it must already know.
  - **Editable artifact = the dataset document itself** on the envelope
    (`env.jtaDataset`) — plain JSON, serializes with the envelope, perfectly
    matches the presence-based convention (`STEP_OUTPUT_PRESENT` gains the
    field; the runner clears it downstream of ②b edits; re-running ②d with
    unchanged inputs regenerates byte-identically per the generator's
    determinism). A hand edit in the panel triggers the validator + a
    `--restamp` (content hash → new `dataset_id`, §2.6) — which is what makes
    editing SAFE against the Pass-B cache and save slots (§1c gap).
  - Non-jta worlds: step is a no-op (absent artifact ⇒ skipped), preserving
    byte-identity for every existing preset.
- **Balance stays where it is: Pass B in-app at rules load, authoritative.**
  Fill isn't in the pipeline, so a pipeline "balance step" would be Pass-A
  provisional by definition. Optional later affordance: a preview solve
  button in the panel (the worker exists; label non-authoritative); NOT part
  of this design's phases.

### 6.2 Why pre-synthesis beats lazy per-region minting

`generateZoneForSpecs` could mint zones on demand during growth, accumulating
the dataset incrementally. Rejected: **C4 is a GLOBAL invariant** (cumulative
opportunity across all ancestor zones) — a lazy minter cannot assert or
repair it without lookahead across unrealized regions; the repair loop
(§2.3) wants the whole skeleton in hand. Pre-synthesis also gives the
editable artifact a single well-defined home (②d) instead of scattering
content decisions across region realization.

### 6.3 jta joins sphere growth as a SELECTION strategy

Exactly the engine stubs' phrasing: `generateZoneForSpecs(specs)` binds the
NEXT unbound dataset zone (matching `specs.exitSpecs.length` out-degree —
guaranteed matchable because ②d consumed the same graphSpec) and emits
`{locations, exitRules, payload}` — locations from the zone's tasks (the
existing `extractZoneRules` body refactored to per-zone form), exits as loose
count rules like today, payload `{jtaZone, jta_dataset_ref}` (+ full doc on
the first region). Spiral path keeps working: ②d-equivalent = run the
generator before arrangement (today's CLI flow), wired into presets via
substrate params (`{dataset: {seed, theme, structure}}` in the preset's
config bundle — presets store config, not envelopes, per convention).

### 6.4 Cache/carriage interactions (consolidated)

- Carriage: unchanged (single-carrier + refs; warehouse resolution; bridge).
- `(seed, dataset_id)` Pass-B cache: correct across pipeline re-runs ONCE
  ids are content-hashed — any edit or re-roll produces a new id (fresh
  solve, fresh save slot); an unchanged re-run reproduces the same id
  (cache hit, correct). Without §2.6 rider 2, the editable step MUST NOT
  ship. Sequencing in §7 enforces this.
- Save slots: same argument via `incrementalGameSave_substrate__<id>`.

---

## 7. Phasing (each phase separately land-able; house-style gates)

**Phase 0 — 5g raw-value mode + riders (Opus; ruled, planned).** Riders
(§2.6): raw-aware C4, content-hashed `dataset_id` + `--restamp`, optional
`zones[].key`. Gates: 5g's own (pre-multiplied raw-vanilla ≡ formula-vanilla
≡ native tick-for-tick; 5f sweep on raw worlds) + fixture regeneration once.

**Phase A — structure policy v2 + departure harness — DONE 2026-07-12 (Opus).**
`params.structure` (`mirror` default), **policy-gated id stride** (mirror 20 /
profiled 100 + validated `idStride` override; NOT the global widening — keeps
the byte-identity gate literal), C4 repair loop, `skillCount` (add-only),
`sweep-dataset-passb/-emergent --dataset-file/--structure` batch modes. The
xp_mult co-solve lever was NOT built: per §2.4/§2.5 it is trigger-gated, and
the acceptance batch (below) fired no true trigger. Gates ALL MET: `mirror`
regenerates byte-identically (guard 94/94 + preset regen zero drift); profiled
batch (control/dense/sparse/skillcount ×2 seeds) — **zero floor-clamped
milestone stalls, economy triggers silent** on all 8 C4-clean worlds (the
sweep trigger heuristic was tightened to §2.5's precise floor-clamp condition,
having over-fired on the known threshold-drift mode); 5f-gate emergent sweep
PASSES on every profiled world (Victory + all perks in budget). Full record:
`CC/scripts/jta-stats/results/dataset-passb/profiled-batch.md`; durable notes
in the `project_jta_zone_randomization` memory topic.

**Phase B — pipeline residency — SHIPPED 2026-07-13 (Opus) as the reshaped Phase
B on the stepped-spiral pipeline.** ②d content = spiral ② content (the
2026-07-12 re-sequencing put it on JtA's actual path); envelope artifact
(`env.content`) + restamp-on-edit (`onContentEdit` → `stampDatasetIdentity`);
preset substrate params (`substrateConfig.jta`, config carries a Node-generated
`datasetDoc` — fixtures unbundled, so generation stays a Node concern). Ordering
resolved: **install at ① arrange** (so the quota-vs-`zoneCount` validation sees
the dataset), ② materialises the editable doc, ③/④ engine untouched.
`generateZoneForSpecs`-into-sphere-growth: DEFERRED (spiral supersedes its v1
purpose; keep only for genuinely sphere-shaped future worlds). All four gates
MET — (a) dataset-less byte-identity, (b) `JTA_RT_PIPELINE` roundtrip, (c)
pipeline reproduces the committed playable preset the in-app test solves+plays,
(d) edit → new id → fresh solve. Commit-by-commit in
`stepped-spiral-parity-plan.md` §6 Part 3.

**Phase C — branching topology (needs 0 + A; B for growth-fit worlds).**
Slice 1 = §3.4 verify-first list (fork change only if E1 confirms; Fork 1.9
parity-gated). Then: schema `topology` + validator rules + toposort; graph
mode in the generator (graphSpec consumption); DAG-aware C4 (ancestors);
linearization emitter; §3.5 tier-1 sweeps; tier-2 in-app acceptance. The
orderBuilder soundness note lands as documentation. Batch-costing lever only
if tier-1 linearization sweeps drift. Gates: topology-absent datasets
byte-identical through every layer (schema/validator/generator/walk);
branching batch passes the progression gate on ≥2 linearizations per world;
E1 fork change (if any) native-byte-identical + managed-delta-only.

**Phase D — effects migration ladder (independent cadence; each rung its own
fork release).** §4.2 order; per-rung gates: native byte-identity, dataset
lockstep with re-expressed vanilla fixture, magnitude-perturbation canary.
Magnitude-range protocol (§4.3) runs per kind BEFORE the generator varies it.

**Rung 2 (starting_energy) SHIPPED 2026-07-16 — Fork 1.10 (submodule `e5422e2`),
perk-side keys only.** The two PERK behavior keys migrated (EnergySpell flat 50 /
EnergeticMemory per-reset 0.1 → `effects[] {kind: starting_energy, flat |
per_reset + curve: "linear", scope: "run"}`; fork
`EFFECTS.starting_energy_flat_run` at the tryAddPerk position,
`starting_energy_growth_run` as the calcEnergeticMemoryGain base term — gains
SUM across carriers, the square applies to the total). **Deviation from the
§4.1 absorb list, discovered at the audit (the rung-1 lesson applied BEFORE
coding): the prestige-side pair stays slotted** — TranscendantMemory is impure
(auto-grants perk slot 19 by enum identity AND squares the growth gain; `curve:
"square"` reserved for it) and DivineSupremacy is triply impure (flat energy +
FINAL_PRESTIGE_MULT on mandatoryish task speed + spark ×2; `scope: "prestige"`
reserved). They migrate when their entangled kinds do. Residual coupling
recorded in datasetBehaviors.js: TranscendantMemory grants PERK SLOT 19
whatever a dataset placed there. Both migrated sites still route through
`modifyMaxEnergy`, so the `jta_starting_energy_bonus` accumulator (host
energy-bonus sync) observes identical deltas — the bonus-sync leg needed no
change and its in-app test is a rung gate. `effectMagnitudes.js` generalized to
multi-param kinds (`exemplars[].params` + per-field `priors`; both
starting_energy priors are degenerate single-exemplar spans until a §4.3
sweep); the `structure.effects.shuffle` lever re-places entries preserving
their variant, re-sampling prior'd fields (identical rng consumption for
single-magnitude kinds). Canary extended: doubled flat + doubled per_reset +
novel flat placement alongside the rung-1 xp legs. HARNESS FIX shipped with
this rung: run-parity's parent read STALE child result JSONs when a child
died before writing (every child had FATALed while the summary said PASS) —
children's results are now pre-deleted per run and a non-zero exit fails the
scenario regardless of the file. Note the harness gates the COMMITTED fork
(`git archive HEAD`), so the fork commit precedes the parity gates in the
rung workflow.

**Rung 1 (xp_all_mult) SHIPPED 2026-07-16 — Fork 1.9 (submodule `5cba354`), run
scope only.** The two in-run slots migrated (Writing ×1.5 / GazedBeyondTheVeil ×2
→ `effects[] {kind: xp_all_mult, mult, scope: "run"}`; runtime `EFFECTS`
handler table in simulation.ts; loader `applyEffects`). **Deviation from the
§4.1 absorb list, discovered at implementation: the prestige pair
(xp_all_prestige_mult(_b)) stays slotted** — DivineInspiration also doubles
attunement gain and UnparalleledLearning also doubles spark gain (impure keys),
and their XP multipliers sit SPLIT around the repeatable multipliers in the
calcSkillXp chain, so no per-scope application order re-expresses them exactly
(float chain position is load-bearing, the 5g lesson). They migrate when the
attunement/spark kinds do; `scope: "prestige"` is reserved in the schema.
Gates all green: native 4/4 tick-identical (2000/2517/31304/808); re-expressed
fixture lockstep 4/4 tick-identical, formula AND raw twins; magnitude canary
(new `--selftest-perturb-effect`: doubled exemplar mult + novel placement on
perks[0]) DETECTED in both modes, plus a layer-1 `runtime_data.effects` sweep.
`effectMagnitudes.js` holds the exemplars + prior [1.5, 2] (not yet
sweep-widened); generator lever `structure.effects.shuffle` (profiled-only,
zero-rng default) places the kind freely with prior-sampled magnitudes. UI
parity zero DOM diff (fixture carries the compiled tooltip text).

**Phase E — theme v2 (after A; display surface deferred).** Arc priors +
thread grammars + effect-aligned banks (needs D only for the kinds it names;
`skill_speed`/`energy_on_consume` are already free). Gates: namebank-only
datasets regenerate byte-identically (arc/threads opt-in); themed batch
passes the standard sweeps; thread realization asserted structurally
(unlock chains match thread steps) by the generated-dataset guard.

Dependency sketch: 0 → A → {B, C, E}; D free-runs; C additionally wants B
for sphere-growth-shaped worlds but its schema/walk/verification core only
needs A.

---

## 8. Rulings — ALL RULED 2026-07-11, each = as recommended (blanket user acceptance)

1. **5g riders (§2.6):** fold raw-aware C4 + content-hashed dataset_id +
   `--restamp` + optional `zones[].key` into the 5g implementation?
   **Recommend yes** (touch schema/generator/validator/fixtures once).
2. **xp_mult co-solve trigger policy (§2.5):** build the lever now vs only
   when a C4-CLEAN world fires it. **Recommend trigger-gated** (the
   experiment shows the static C4 gate is the effective boundary; the
   generation-time repair loop is the cheaper standing fix).
3. **Branching walk stance (§3.3):** accept + measure (linearization
   sweeps), with sphere-start batch costing as the ready lever. **Recommend
   as stated.**
4. **Branching fit direction (§3.1):** region graph is the skeleton, dataset
   generated to fit. **Recommend as stated** (matches sphere-growth and the
   PURPOSE ruling).
5. **Pipeline placement (§6.1):** ②d content step between topology and
   items; balance stays in-app; no pipeline balance step. **Recommend as
   stated.**
6. **Effects migration order (§4.2):** xp_all_mult → starting_energy →
   time_compression → drain → the rest on need; queue/prestige tail may stay
   slots indefinitely. **Recommend as stated.**
7. **Theme v2 scope (§5):** arc + threads + effect-aligned banks as the v2
   set; narrative display surface deferred until content exists. **Recommend
   as stated.**

## 9. Traceability

| Deferred question (source) | Where it landed |
|---|---|
| Which mirror departures are safe (5d structure policy note) | §2.2 taxonomy + §2.4 evidence |
| xp_mult co-solve / economy scaling design (plan §4.2 table) | §2.5 levers + §8.2 |
| §4.2 instrumentation re-use | §2.5 detection harness + §1d seam |
| Branching topology + grid fit (v1 scope ruling 1, PURPOSE ruling) | §3.1 |
| 5g REQUIRED for branching (5g assessment) | §3.2 |
| Walk generalization under multiple frontiers | §3.3 |
| 5g amendments while unimplemented | §2.6 |
| effects[] endpoint (Phase-5 ruling 1) | §4 |
| Theme carries narrative eventually (PURPOSE ruling) | §5 |
| Pipeline split prior (user: structure early / balance post-fill) | §6.1 |
| generateZoneForSpecs "JtA later" stubs | §6.3 |
| (seed, dataset_id) cache × re-runs | §6.4 + §2.6 rider 2 |
