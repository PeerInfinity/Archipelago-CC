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
  the acceptance gate is **≤ 500 loops** from a fresh save.
- **V0 exact-reproduction check**: at seed 12345, default weights, predictor
  seeding off, the run must reproduce the frozen queue-planner v0 experiment
  byte-for-byte — 500 loops / 5,432,753 ticks / final-state hash
  `54506b48ec1758af` (`NewDocs/plans/omsiloops/experiments/PLANNER-REPORT.md`).
  This is the proof that the fork port did not change planner behavior; it
  is also the whole-system regression gate the XML migration plan reuses
  (its Phase 5).
- **Milestone table**: loops to each unlock (Pick Locks, glasses, Short
  Quests, Investigate, Lessons, travel wall, town 1) — printed per run,
  stored in the result JSON.
- **Predictor divergences**: with `--seed-predictor`, predictor-vs-engine
  discrepancies are recorded (the "third oracle"); count lands in the JSON.

Findings land in `SUMMARY.md` as runs accumulate.
