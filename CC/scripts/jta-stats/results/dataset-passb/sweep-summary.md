# Pass-B convergence over generated datasets × fill seeds (Phase 5e §4.2)

Instrument: the Pass-B convergence report, run over roundtrip exports of
GENERATED synthetic-dataset worlds (z15). Levers (xp_mult co-solve, economy
scaling) are added only if the trigger signals below fire — plan §4.2 table.

| dataset | fill | converged? | entries | milestones | stalled | never-started | completed-unsolved | saturated | unengaged (ms) | gap p50/mean/max | cm min/p50/max |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | yes | 130 | 21 | 0 | 0 | 0 | 0 | 2 (0) | 3/3.6/13 | 0.0500/1.21/1.45e+3 |
| 1 | 2 | **no** (1 stalled entries) | 130 | 21 | 1 | 0 | 0 | 0 | 1 (0) | 3/6.2/62 | 0.0500/1.41/2.18e+4 |
| 2 | 1 | yes | 130 | 21 | 0 | 0 | 0 | 0 | 2 (0) | 4/4.5/19 | 0.0500/1.02/1.36e+4 |
| 2 | 2 | yes | 130 | 21 | 0 | 0 | 0 | 0 | 4 (0) | 4/4.4/16 | 0.0500/0.453/4.50e+4 |
| 3 | 3 | yes | 130 | 21 | 0 | 0 | 0 | 0 | 0 (0) | 3/3.6/19 | 0.0500/0.914/4.42e+4 |
| 4 | 4 | yes | 130 | 21 | 0 | 0 | 0 | 0 | 1 (0) | 3/3.6/9 | 0.0500/0.213/1.09e+5 |

## §4.2 trigger signals

- **xp_mult co-solve trigger** (milestone stalls / saturated milestone solves): not fired.
- **economy scaling trigger** (a whole zone band pinned at min cost): not fired.
- **economy starvation** (saturated solves in a band): not fired.

Per-pair per-bucket clamp profiles and full walk reports: `bp-ds*-f*.json` beside this file.

