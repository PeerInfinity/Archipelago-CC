# Randomized-pacing runs (Phase 4 — emergent verification)

First-class assertion is **location coverage** under free automation.
`resetsPerStep = 5` is the pacing target the balance pass solved against.

## Coverage

| run | coverage | full? | runs | prestiges | perks | re-grants | stalled |
|---|---|---|---|---|---|---|---|
| randomized-pacing-baseline | 130/130 | **yes** | 243 | 3 | 21/21 | 55 | no |
| randomized-pacing-vanilla-costs | 130/130 | **yes** | 201 | 1 | 21/21 | 19 | no |
| randomized-pacing-no-regrant | 128/130 | **NO** | 2000 | 28 | 21/21 | 0 | no |
| randomized-pacing-no-perk-category | 130/130 | **yes** | 243 | 3 | 21/21 | 55 | no |
| randomized-pacing-endrun-no-perk-category | 130/130 | **yes** | 253 | 3 | 21/21 | 56 | no |
| randomized-pacing-pinned100 | 130/130 | **yes** | 564 | 10 | 21/21 | 189 | no |
| randomized-pacing-pinned100-no-perk-category | 130/130 | **yes** | 566 | 10 | 21/21 | 189 | no |

## Pacing — resets between consecutive perk acquisitions

| run | n | p25 | p50 | p75 | max | mean | vs target 5 |
|---|---|---|---|---|---|---|---|
| randomized-pacing-baseline | 20 | 1 | 2 | 9 | 49 | 5.65 | 0.88× |
| randomized-pacing-vanilla-costs | 20 | 2 | 3 | 10 | 89 | 10.00 | 0.50× |
| randomized-pacing-no-regrant | 20 | 1 | 2 | 9 | 434 | 24.90 | 0.20× |
| randomized-pacing-no-perk-category | 20 | 1 | 2 | 4 | 41 | 5.65 | 0.88× |
| randomized-pacing-endrun-no-perk-category | 20 | 2 | 2 | 4 | 18 | 3.70 | 1.35× |
| randomized-pacing-pinned100 | 20 | 1 | 3 | 5 | 46 | 7.05 | 0.71× |
| randomized-pacing-pinned100-no-perk-category | 20 | 1 | 3 | 6 | 46 | 7.15 | 0.70× |

## The `thresholdFloored` tasks (6) — the coverage risk

Run at which each was first completed under free automation (`—` = never).

| run | t75 | t115 | t134 | t136 | t146 | t151 |
|---|---|---|---|---|---|---|
| randomized-pacing-baseline | 32 | 139 | 49 | 145 | 243 | 65 |
| randomized-pacing-vanilla-costs | 45 | 67 | 79 | 77 | 91 | 180 |
| randomized-pacing-no-regrant | 32 | — | 49 | — | 246 | 65 |
| randomized-pacing-no-perk-category | 32 | 139 | 145 | 145 | 243 | 73 |
| randomized-pacing-endrun-no-perk-category | 36 | 147 | 157 | 157 | 253 | 75 |
| randomized-pacing-pinned100 | 36 | 173 | 81 | 531 | 564 | 101 |
| randomized-pacing-pinned100-no-perk-category | 38 | 175 | 533 | 533 | 566 | 105 |

## Metric cross-check

`completions` (polling; infers zone-skip credit at run boundaries) vs
`firstCompletionRuns` (what the fork's completion callback actually fired —
the same signal the bridge turns into an AP location check).

- **randomized-pacing-baseline**: agree exactly
- **randomized-pacing-vanilla-costs**: agree exactly
- **randomized-pacing-no-regrant**: agree exactly
- **randomized-pacing-no-perk-category**: agree exactly
- **randomized-pacing-endrun-no-perk-category**: agree exactly
- **randomized-pacing-pinned100**: agree exactly
- **randomized-pacing-pinned100-no-perk-category**: agree exactly

### randomized-pacing-no-regrant — uncovered locations (2)

- task 115 (zone 10) Look for Land
- task 136 (zone 12) Comb the Desert

## Perk-acquisition runs

- **randomized-pacing-baseline**: 1, 1, 2, 4, 5, 6, 8, 10, 11, 13, 15, 15, 16, 20, 23, 24, 35, 45, 54, 65, 114
- **randomized-pacing-vanilla-costs**: 2, 2, 3, 5, 10, 12, 15, 37, 43, 46, 49, 52, 53, 53, 55, 65, 71, 75, 95, 113, 202
- **randomized-pacing-no-regrant**: 1, 1, 2, 4, 5, 6, 8, 10, 11, 13, 15, 15, 16, 20, 23, 24, 35, 45, 54, 65, 499
- **randomized-pacing-no-perk-category**: 1, 1, 3, 5, 6, 9, 10, 10, 12, 14, 15, 16, 19, 19, 23, 24, 43, 49, 51, 73, 114
- **randomized-pacing-endrun-no-perk-category**: 1, 1, 3, 6, 8, 11, 12, 12, 15, 17, 18, 21, 23, 23, 27, 31, 49, 51, 53, 57, 75
- **randomized-pacing-pinned100**: 1, 1, 2, 4, 5, 6, 8, 11, 11, 13, 16, 16, 17, 20, 25, 31, 77, 80, 85, 107, 142
- **randomized-pacing-pinned100-no-perk-category**: 1, 1, 3, 5, 6, 9, 10, 10, 13, 15, 16, 19, 21, 21, 27, 33, 79, 84, 87, 111, 144
