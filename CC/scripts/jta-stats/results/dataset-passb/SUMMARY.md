# Pass-B convergence over generated datasets × fill seeds (Phase 5e §4.2)

Instrument: the Pass-B convergence report, run over roundtrip exports of
GENERATED synthetic-dataset worlds (z15 = 130 locations each). Levers
(xp_mult co-solve, economy scaling) are added only if the trigger signals
fire — plan §4.2 table. `bp-ds*-f*.json` beside this file are the full walk
reports; `sweep-summary.md` is the auto-generated table of the latest run
(this file is the curated record — a sweep re-run does not overwrite it).

## Round 2 (2026-07-10, post perk-category-union — CURRENT)

Re-run after the forced perk-category set became the perkOrigin.js union
(native perk tasks ∪ perk HOLDERS — tasks whose own AP location holds a
perk item), applied identically by the solver, the bridge, and the
measurement model. The committed `bp-*.json` files are from this round.

| dataset | fill | converged? | entries | milestones | stalled | never-started | completed-unsolved | saturated | unengaged (ms) | gap p50/mean/max | cm min/p50/max |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | yes | 130 | 21 | 0 | 0 | 0 | 0 | 2 (0) | 3/3.6/13 | 0.0500/1.21/1.45e+3 |
| 1 | 2 | **no** (1 stalled entries) | 130 | 21 | 1 | 0 | 0 | 0 | 1 (0) | 3/6.2/62 | 0.0500/1.41/2.18e+4 |
| 2 | 1 | yes | 130 | 21 | 0 | 0 | 0 | 0 | 2 (0) | 4/4.5/19 | 0.0500/1.02/1.36e+4 |
| 2 | 2 | yes | 130 | 21 | 0 | 0 | 0 | 0 | 4 (0) | 4/4.4/16 | 0.0500/0.453/4.50e+4 |
| 3 | 3 | yes | 130 | 21 | 0 | 0 | 0 | 0 | 0 (0) | 3/3.6/19 | 0.0500/0.914/4.42e+4 |
| 4 | 4 | yes | 130 | 21 | 0 | 0 | 0 | 0 | 1 (0) | 3/3.6/9 | 0.0500/0.213/1.09e+5 |

§4.2 trigger signals: **xp_mult co-solve — not fired** (zero milestone
stalls, zero saturated milestone solves); **economy scaling — not fired**
(no zone band pinned at min cost); **economy starvation — not fired**
(zero saturated solves anywhere).

**5/6 pairs pass the conservative bar** (Round 1: 1/6). What changed and
what remains:

- The **unengaged-milestone mode is GONE** (Round 1 had 3 across two
  pairs; now 0 everywhere, and every remaining `unengaged` entry is a
  non-milestone priced at the pass's max cost — the known, accepted
  `other`-category drift). Root cause was structural: a perk item the fill
  placed on a NON-native perk task fell outside the forced perk-category
  set, so the `other` category's cost-invariant energy-per-level metric
  refused it at any cost. Fixed by the perkOrigin.js union, not by a
  balancing lever.
- The Round-1 **completed-before-solve cases dissolved with the changed
  walk order** (never-started and completed-unsolved both 0 this round).
  The mechanism still exists — a task completing within one run of release
  keeps its Pass-A provisional cost — and stays FILED in
  `CC/docs/cleanup-backlog.md` (solve-at-completion candidate fix); the
  report's `completedUnsolved` counter now tracks it separately from
  genuine never-started entries.
- The one remaining failure, **ds1-f2 task 35, is the replay-stall mode**:
  a non-milestone, threshold-skipped in an already-passed zone while
  deeper zones offer work (solved via the boundary fallback, never
  completed within the 60-reset stall window). Vanilla Phase-4 seed 4
  shows 5 of these and still plays to full coverage emergently; the
  dataset-world emergent confirmation is Phase 5f.
- Milestone pacing tightened: gap means 3.6–6.2 vs `resetsPerStep = 5`
  (Round 1: 2.5–6.2), all pairs inside the settled [0.4×, 3×] advisory
  band.

Baseline `bp-vanilla-f1.json` (vanilla z15, fill seed 1, same walk):
PASS — 0 stalled / 0 never-started / 0 completed-unsolved / 0 saturated /
1 unengaged non-milestone.

**Verdict (unchanged from Round 1): no §4.2 balancing lever fires.**
xp_mult co-solve and economy scaling are NOT built — the failure modes the
batch surfaced were a categorization defect (fixed at its cause) and two
walk-machinery bookkeeping edges (one filed, one recorded), not balance
levers.

## Round 1 (2026-07-10, pre-union — superseded)

First run of the batch, against the walk whose forced perk-category set
covered only NATIVE perk tasks. Kept for the record (full reports in git
history at commit `7afb56ecf`):

| dataset | fill | converged? | stalled | never-started | saturated | unengaged (ms) | gap mean |
|---|---|---|---|---|---|---|---|
| 1 | 1 | **no** (1 never started) | 0 | 1 | 0 | 1 (0) | 2.8 |
| 1 | 2 | **no** (1 stalled) | 1 | 0 | 0 | 1 (0) | 6.2 |
| 2 | 1 | **no** (1 unengaged MILESTONE) | 0 | 0 | 0 | 2 (1) | 3.8 |
| 2 | 2 | **no** (2 unengaged MILESTONES) | 0 | 0 | 0 | 5 (2) | 4.6 |
| 3 | 3 | **no** (1 never started) | 0 | 1 | 0 | 0 (0) | 2.5 |
| 4 | 4 | yes | 0 | 0 | 0 | 1 (0) | 3.7 |

Round-1 failure-mode decomposition (led to the Round-2 changes):
threshold-drift unengagement on perk-ITEM milestones sitting on non-native
perk tasks (ds2-f1 task 235; ds2-f2 tasks 96, 197) → fixed by the
perk-category union; replay stall (ds1-f2 task 35) → known mode, remains;
boundary-fallback bookkeeping gap (ds1-f1 task 195, ds3-f3 task 193
completed at provisional cost before their solve fired, read as "never
started") → counter split + backlog entry. All §4.2 triggers were already
silent in Round 1; the verdict was the same.
