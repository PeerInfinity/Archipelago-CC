# Cross-seed emergent verification (Phase 4)

`baseline` = the 2026-07-09 grant semantics (own-world perks re-grant on
re-completion). `no-regrant` = bridge.js as it ships today.

| seed | variant | solve converged? | coverage | full? | runs | prestiges | re-grants | thresholdFloored covered | gap p50 | gap mean | gap max |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | baseline | yes | 130/130 | yes | 243 | 3 | 55 | 6/6 | 2 | 5.65 | 49 |
| 1 | no-regrant | yes | 128/130 | **NO** | 2000 | 28 | 0 | 4/6 | 2 | 24.90 | 434 |
| 2 | baseline | yes | 130/130 | yes | 157 | 2 | 37 | 7/7 | 2 | 2.70 | 8 |
| 2 | no-regrant | yes | 127/130 | **NO** | 2000 | 9 | 0 | 5/7 | 2 | 2.70 | 8 |
| 3 | baseline | yes | 130/130 | yes | 46 | 0 | 0 | 5/5 | 1 | 2.20 | 7 |
| 3 | no-regrant | yes | 130/130 | yes | 46 | 0 | 0 | 5/5 | 1 | 2.20 | 7 |
| 4 | baseline | **no** (5 stalled entries · 1 unengaged MILESTONES) | 130/130 | yes | 241 | 4 | 67 | 14/14 | 1 | 12.00 | 106 |
| 4 | no-regrant | **no** (5 stalled entries · 1 unengaged MILESTONES) | 125/130 | **NO** | 2000 | 40 | 0 | 9/14 | 1 | 1.83 | 6 |

Pooled baseline milestone gaps (n=80): p50 2, mean 5.64, max 106 — target `resetsPerStep = 5`.


### seed 1 / no-regrant: 2 locations never checked

- task 115 (zone 10) Look for Land — **thresholdFloored**
- task 136 (zone 12) Comb the Desert — **thresholdFloored**

### seed 2 / no-regrant: 3 locations never checked

- task 116 (zone 10) Practice Transforming — **thresholdFloored**
- task 125 (zone 11) Build Another Hut — **thresholdFloored**
- task 136 (zone 12) Comb the Desert

### seed 4 / no-regrant: 5 locations never checked

- task 46 (zone 3) Befriend a Deer — **thresholdFloored**
- task 107 (zone 9) Low-oxygen Exercise — **thresholdFloored**
- task 136 (zone 12) Comb the Desert — **thresholdFloored**
- task 156 (zone 14) Guided Spellcasting — **thresholdFloored**
- task 157 (zone 14) Go for a Walk — **thresholdFloored**
