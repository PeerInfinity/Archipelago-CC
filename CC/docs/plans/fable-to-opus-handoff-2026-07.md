# Fable → Opus handoff — cross-arc queue (2026-07-11)

**Purpose.** Written at the Fable→Opus transition (Fable access ends ~2026-07-13).
During 2026-07-10/11 every active arc was either shipped or carried to a fully
ruled design; this document is the single ordered queue of what comes next,
with dependencies. Detail lives in the per-arc plan docs and memory topic
files — this doc is the map, not the territory.

**How to use.** Each section names its plan doc and memory topic. Plan docs
marked *(NewDocs)* live in the gitignored `NewDocs/` tree — not in git
history, but present in the working tree and available to Opus sessions.
Memory topic files hold the durable pointers. Standing convention: a NewDocs
plan moves to `CC/docs/plans/` when its implementation starts.

**Standing cross-cutting rules (apply to everything below):**
- **Intended-solution-first testing** (user ruling 2026-07-11): witness
  replay / bot completion are the hard gates; "no unintended solution" gets
  bounded budgets at calibration time only. See
  `feedback_intended_solution_first_testing` memory.
- **Every verification suite needs one independent stratum** (real saves,
  in-app tests, separate oracle) — a verifier sharing the generator's
  assumptions verifies nothing. See `feedback_verifier_shared_assumption`.
- **Byte-inert at defaults**: fork features ship default-off behind
  options; parity/determinism goldens must pass with everything at default.
- **Git discipline**: explicit staging only (never `git add -A`); commit
  submodule first, outer pointer bump in its own commit; push submodule
  branches BEFORE any outer push that bumps them; push only when asked.

---

## 1. Runner substrate — FIRST (restores lost coverage)

Status: `runnerDemo` vitest suites are DISABLED in both configs (2026-07-09)
— the substrate currently has near-zero routine test coverage.

1. **Implement the test-strategy rebalance** — *(NewDocs)*
   `NewDocs/plans/procedural-platformer/runner-test-strategy-rebalance.md`.
   This is the re-enablement path: fast/slow re-split by cost class, matrix
   rows demoted to a manual `vitest.calib.config.js` tier, new G1 preset
   bot-replay gate (~30–60s, exercises committed rules.json), stored witness
   tapes (10ms replay; key tapes to level-payload + physics hash, regenerate
   on replay failure — never hand-fix). Target: ~31 min battery → ~15–18 min
   with coverage restored.
2. **Then OR-route lanes O1–O5** — *(NewDocs)*
   `runner-or-lanes-step6-plan.md`. De-risked: the verify/emission stack
   handles OR today (experiment-confirmed); work is confined to
   planStripSpecsV2 + orGate grammar + integration. Verification follows the
   rebalanced doctrine (witness per disjunct = hard gate; lane exclusivity =
   bounded, calibration-time). Memory: `project_runner_substrate`.

## 2. World persistence across reloads (small, self-contained)

Implement P1–P4 of *(NewDocs)* `NewDocs/plans/world-persistence-reload-design.md`
(sessionStorage `apcc_lastWorld` riding the existing
`moduleSpecificConfig.rulesConfig` boot channel — deliberately NOT a new init
catch-up). Acceptance must include: (a) the live reload repro (preset → Run
all → Load → page reload → panel reattaches) — the design session verified by
code-reading only; (b) the **stale-path leg**: a persisted preset path whose
fetch 404s at boot must degrade to first-preset and clear the record (this
failure happens AFTER the sessionStorage read succeeds, so the self-clear
guard doesn't obviously cover it); (c) `restoreLastWorld` (schema default on)
must be read honoring the schema default — do not repeat the `autoLoadMode`
boot-reader pattern fixed in `5fa4b4726`. Memory:
`project_world_persistence_reload`.

## 3. JtA — post-v1 and retirement track

Phase 5 is COMPLETE (5a–5f + 5g raw-value/Fork 1.8 with all riders;
tick-for-tick triple equivalence green). Memory:
`project_jta_zone_randomization`.

1. **Post-v1 phases A→E** — *(NewDocs)*
   `NewDocs/plans/jta/jta-synthetic-post-v1-design.md`, all 7 rulings
   accepted. Phase 0 (5g) is done; start at A. Carry-forward data point:
   5g reduced worst Pass-B saturation by an order of magnitude (1.1e4 vs
   1.09e5) but did NOT eliminate it — the economy-scaling lever retains a
   residual case even on C4-clean linear worlds.
2. **jtaActionQueue → substrate port** —
   `CC/docs/plans/jta-action-queue-port-plan.md`, all 10 rulings settled,
   zero fork changes v1. Feeds item 3.
3. **Phase 6 absorption audit** — parent plan §5 absorption map. Gates the
   old-March-stack retirement (deletion itself is a separate future change
   per standing ruling).
4. **Backlog (in `CC/docs/cleanup-backlog.md`):** the presets-guard 300s
   zone-demo click budget is a coin flip under load — bump to ~450s
   (one-liner); the balance-walk solve-at-completion fix (own step + batch
   re-run — invalidates caches and committed measurement records, NOT a
   drive-by); task-256/z12 filler stranding stays accepted unless a
   multiworld hardens the gate (measured remedy: `threshold_other_metric =
   RESETS`).

## 4. Omsi Loops — the one open design front

Memory: `project_omsi_loops_fork`. Plan docs *(NewDocs)* in
`NewDocs/plans/omsiloops/`.

1. **Scoring-horizon design pass (§11.5) — PENDING SLOT.** A final Fable
   session is planned for this (prompt delivered 2026-07-11; includes the
   stat-gain-multiplier test-speed enabler and snapshot-start iteration).
   - If it lands: implement/continue its output; it will update this
     section itself.
   - If it does not land: this is the ONE item in the queue that may exceed
     comfortable Opus territory — a greedy-scorer horizon problem (planner
     converges to commuting-without-advancing at L506+; travel-cost
     reductions and capacity compounding are invisible to the scorer).
     Evidence base: multitown plan §10a.6–7 + §11.5, omsi-stats SUMMARY
     Round 6, the instrumented L500 state. Constraint: any travel-relief
     term must gate on `townsUnlocked > 1` to preserve town-0 byte-inertness
     (v0 acceptance hash). Iterate boosted-first (100× → 10× → 1×) per the
     user's ruling.
2. **Unlock-discretization U0–U5** —
   `omsi-loops-unlock-discretization-plan.md` (~5–6 days, on `substrate`).
   Defines the AP location pool; extractor prototyped (157×2 predicates,
   0.8s); enforcement = suppression-scoped `getNextValidAction` check; keep
   the differential corpus + real-save-fixture stratum as a LIVE gate (it is
   also the non-monotone detector — Buy Glasses is the only one TODAY).
3. **Housekeeping when stable:** merge `automation` → `substrate`, then bump
   the outer submodule pointer (currently held on `substrate` per standing
   ruling). Remaining Phase E slices: action-completion callback,
   setTownGate, instant stepping, cloud-save hard-off audit.
4. **Social:** cirne DM drafted, unsent, non-blocking
   (`cirne-dm-draft.md`); community post waits for "something to show";
   never bundle the license ask + AP announcement + AI disclosure in one
   post.

## 5. Cavernous II — Stage 2 onward

Memory: `project_new_substrates_planning`. Plan *(NewDocs)*
`NewDocs/plans/cavernous/cavernous2-substrate-plan.md`. Stage 0+1 SHIPPED,
pushed, fork CI green; simple-mode boost byte-inert-proven.

Inputs already settled — do not re-derive:
- **v1 AP pool** = *(NewDocs)* `experiments/derived-rules-zone1.md` (+ .json):
  35/35 classified; iron chain = the ONLY hard-dep class (9 bridge
  locations); everything else pure mana budget (M* 5→376).
- **Location trigger RULED = REACH** (single layer: check hook on
  enter/setMined; ghost suppression stays on the grant side). The generator
  keeps `TRIGGER=completion` env mode for re-pricing comparisons; a later
  machine-split into completion-keyed locations is a recorded idea.
- **÷E² combat-intake correction is WRONG** — refuted by twin runs; vanilla
  intake gives exact parity. `effectiveCloneCount()` in settings.ts is the
  single definition of E.
- **Playback requirements:** chain veins must be picked by Dijkstra cost;
  the portal is a PRESENT action — walking onto Θ does nothing, queues must
  include it.
- **Contingency toggles** (kudzu no-regrow, iron-bridge persist) are
  pre-designed, adopt-on-evidence only; the stats harness must measure
  loops-to-milestone toggles-off vs on BEFORE any toggle defaults on (the
  balance pass needs to know which mode it prices).
- **v0 victory** = reach zone 2 — the portal is pit-gated, so it exercises
  the full iron→furnace→anvil→bridge chain.

## 6. Everything else (unchanged queues)

Pre-existing next steps that predate this transition, in their topic files:
top-down stepped pipeline phases 4/5/6 (editors); sphere-growth soft
difficulty (deferred); grid-growth retirement (planned, not started); docs
migration help module; flashPanel unification. Nothing from the 07-10/11
work blocks on them.

---

## Dependency sketch

```
runner rebalance ──► OR-lanes O1–O5
5g (DONE) ──► post-v1 A→E
action-queue port ──► Phase 6 audit ──► old-stack retirement
scoring-horizon design ──► multi-town continuation (beyond M4)
U0–U5 (independent of M-phases) ──► omsi randomization v1
Cavernous Stage 2 (hooks/managed) ──► v0 substrate ──► Stage F (pool + trigger ready)
world-persistence P1–P4 (independent)
```
