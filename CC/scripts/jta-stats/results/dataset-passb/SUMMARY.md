# Pass-B convergence over generated datasets × fill seeds (Phase 5e §4.2)

Instrument: the Pass-B convergence report, run over roundtrip exports of
GENERATED synthetic-dataset worlds (z15). Levers (xp_mult co-solve, economy
scaling) are added only if the trigger signals below fire — plan §4.2 table.

| dataset | fill | converged? | entries | milestones | stalled | never-started | saturated | unengaged (ms) | gap p50/mean/max | cm min/p50/max |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | **no** (1 entries never started) | 130 | 21 | 0 | 1 | 0 | 1 (0) | 2/2.8/8 | 0.0500/0.758/9.92e+3 |
| 1 | 2 | **no** (1 stalled entries) | 130 | 21 | 1 | 0 | 0 | 1 (0) | 3/6.2/62 | 0.0500/1.19/8.38e+4 |
| 2 | 1 | **no** (1 unengaged MILESTONES) | 130 | 21 | 0 | 0 | 0 | 2 (1) | 3/3.8/20 | 0.0500/0.632/1.03e+4 |
| 2 | 2 | **no** (2 unengaged MILESTONES) | 130 | 21 | 0 | 0 | 0 | 5 (2) | 4/4.6/20 | 0.0500/0.664/5.09e+4 |
| 3 | 3 | **no** (1 entries never started) | 130 | 21 | 0 | 1 | 0 | 0 (0) | 2/2.5/5 | 0.0500/0.388/3.82e+4 |
| 4 | 4 | yes | 130 | 21 | 0 | 0 | 0 | 1 (0) | 2/3.7/14 | 0.0500/0.173/7.86e+4 |

## §4.2 trigger signals

- **xp_mult co-solve trigger** (milestone stalls / saturated milestone solves): not fired.
- **economy scaling trigger** (a whole zone band pinned at min cost): not fired.
- **economy starvation** (saturated solves in a band): not fired.

Per-pair per-bucket clamp profiles and full walk reports: `bp-ds*-f*.json` beside this file.


## Conclusion (2026-07-10, Phase 5e §4.2 measurement verdict)

**No lever fires.** Every trigger in the plan's §4.2 what-else-balances table
stayed silent across 6 generated worlds (datasets 1-4 × fill seeds, z15 =
130 locations each): zero saturated solves anywhere, zero milestone stalls,
no zone band pinned at min cost, no starvation band. xp_mult co-solve and
economy scaling are NOT built — per the plan, measurements first, levers
only when a failure mode demands them.

The 5/6 conservative-bar failures decompose into three ALREADY-KNOWN walk
modes, none dataset-specific and none a §4.2 signal:

1. **Threshold-drift unengagement** (ds2-f1: task 235; ds2-f2: tasks 96,
   197 — all `thresholdFloored`, milestone entries at MIN cost). These are
   perk-ITEM milestones on tasks that are not native perk tasks (AP fill
   placed a perk there), so the `setPerkCategoryTaskIds` override does not
   cover them and the `other` category's cost-INVARIANT energy-per-level
   metric refuses them at any cost. Same mode as vanilla Phase-4 seed 4's
   1 unengaged MILESTONE; Phase 4 proved emergently that free play (zone
   re-entry + all-skipped Best-Task fallback) completes this class anyway —
   the dataset-world emergent confirmation is Phase 5f's job. NOT the
   xp_mult trigger: the refusal is threshold-metric cost-invariance, not
   estimator inversion running out of cost range.
2. **Replay stall** (ds1-f2: task 35, non-milestone, threshold-skipped in
   an already-passed zone while deeper zones offer work). Vanilla seed 4
   shows 5 of these. Grants flow on; coverage effect deferred to 5f.
3. **Boundary-fallback bookkeeping gap** (ds1-f1: task 195; ds3-f3
   analogous): a released task completes organically at its Pass-A
   provisional cost within ONE run of release — before the run-boundary
   fallback's >=2-run guard — so first-start never fires a solve and the
   task keeps its provisional cost. It COMPLETED (coverage unaffected);
   the convergence bar counts it "never started". One task per affected
   world plays unsolved; cosmetic for pacing, filed as a walk-machinery
   note, not a balance lever.

Baseline: vanilla z15 fill-seed 1 (bp-vanilla-f1.json, same day, same bar)
passes clean — but vanilla Phase 4 already established the bar is
conservative (its seed 4 fails with 5 stalls + 1 unengaged milestone and
still plays to 130/130). Milestone pacing on the dataset worlds (gap means
2.5-6.2 vs resetsPerStep=5) sits inside the settled [0.4x, 3x] advisory
band on every pair.
