# omsi-stats — Idle Loops fork automation statistics

Headless stats harness for the fork's **Advanced Automation** queue planner
(`frontend/modules/omsi-loops`, branch `automation`), cloning the
`CC/scripts/jta-stats/` conventions: `SUMMARY.md` (committed) carries the
findings; raw per-run JSON stays local in gitignored `results/`.

## Usage

```
node CC/scripts/omsi-stats/run-planner.mjs                 # committed submodule HEAD
node CC/scripts/omsi-stats/run-planner.mjs --worktree      # submodule working tree (dev)
node CC/scripts/omsi-stats/run-planner.mjs --seed N --max-loops N
node CC/scripts/omsi-stats/run-planner.mjs --seed-predictor    # predictor cross-check on
node CC/scripts/omsi-stats/run-planner.mjs --weights '{"frontier":1000}'
```

The sim boots through the fork's own `test/harness.mjs` (extracted alongside
the sim files), so a run exercises exactly what the fork ships:
`IdlePlanner.runStandalone()` plays a fresh game with the planner rebuilding
the queue every loop, RNG seeded (mulberry32) with snapshot/restore hooks so
rolled-back evaluation is fully deterministic.

## Metrics and gates

- **Primary metric** (substrate plan §3.3): loops to Forest Path (town 1) —
  the acceptance gate is **≤ 535 loops** from a fresh save (re-baselined from
  ≤ 500 by Part A §11.9; see the V0 note below).
- **V0 exact-reproduction check**: at seed 12345, default weights, predictor
  seeding off, the run must reproduce the frozen reference byte-for-byte —
  **535 loops / 5,965,890 ticks / final-state hash `e23f020400162f9a`**. Part A
  (§11.9, 2026-07-13) deliberately re-froze this from the original queue-planner
  v0 **500 / 5,432,753 / `54506b48ec1758af`**
  (`NewDocs/plans/omsiloops/experiments/PLANNER-REPORT.md`): A1 un-gated the
  town-0 capacity probe, which reshapes the healthy trajectory (500 → 535) AND
  melts the bank:20 fixation hole (DNF@1200 → escapes @538). This check is the
  proof that a planner change either preserves the reference or is a deliberate
  re-freeze; it is also the whole-system regression gate the XML migration plan
  reuses (its Phase 5).
- **Milestone table**: loops to each unlock (Pick Locks, glasses, Short
  Quests, Investigate, Lessons, travel wall, town 1) — printed per run,
  stored in the result JSON.
- **Predictor divergences**: with `--seed-predictor`, predictor-vs-engine
  discrepancies are recorded (the "third oracle"); count lands in the JSON.

Findings land in `SUMMARY.md` as runs accumulate.
