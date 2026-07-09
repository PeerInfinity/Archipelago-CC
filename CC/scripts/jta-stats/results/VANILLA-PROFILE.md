# Vanilla JtA Profile (Phase 0)

Generated 2026-07-09T01:26:36.729Z by `profile-vanilla.mjs` (maxRuns 3000, zoneLimit 30, sampleEvery 1, estimatorCap 200). Target profile + calibration inputs for the zone-randomization plan (`CC/docs/plans/jta-zone-randomization-plan.md`).

## Structural profile (static)

- 30 zones, 269 tasks, 47 perk tasks, 27 hidden tasks, 22 unlock chains.
- Skills per task histogram: {"1":195,"2":72,"3":1,"5":1}

| Skill | first zone | tasks using it | xpNeededMult |
|---|---|---|---|
| Charisma | 0 | 38 | 1 |
| Study | 0 | 41 | 1 |
| Combat | 0 | 40 | 5 |
| Search | 0 | 51 | 1 |
| Subterfuge | 0 | 30 | 1 |
| Crafting | 1 | 30 | 1 |
| Travel | 1 | 39 | 1 |
| Magic | 2 | 43 | 3 |
| Fortitude | 3 | 27 | 5 |
| Ascension | 14 | 8 | 200 |

| Zone | tasks | perk | hidden | costMult (min/med/max) | maxReps (med) |
|---|---|---|---|---|---|
| 0 The Village | 8 | 1 | 1 | 1/3/500 | 3 |
| 1 The Village Watch | 9 | 1 | 1 | 0.4/1.5/16 | 4 |
| 2 The Raid | 8 | 2 | 1 | 0.4/3/1300 | 3 |
| 3 The Wilderness | 9 | 1 | 1 | 0.25/2/1000 | 1 |
| 4 The Cave System | 9 | 2 | 1 | 0.3/2/10000 | 1 |
| 5 The Road to the City | 10 | 2 | 1 | 0.5/3/500 | 3 |
| 6 The City Outskirts | 8 | 1 | 0 | 0.5/2/12 | 1 |
| 7 The City | 10 | 2 | 2 | 1/2/500000000 | 1 |
| 8 The Forest | 10 | 1 | 1 | 0.15/2/170 | 3 |
| 9 The Magician | 8 | 1 | 0 | 0.15/2/60 | 1 |
| 10 The Ocean | 9 | 2 | 1 | 0.4/3/15000 | 1 |
| 11 The Island | 9 | 1 | 1 | 1/4/210 | 3 |
| 12 The Desert | 9 | 2 | 1 | 0.2/2/600000 | 1 |
| 13 The Oasis | 9 | 1 | 1 | 0.2/25/840 | 3 |
| 14 The Ritual | 9 | 1 | 1 | 0.025/75/500000 | 3 |
| 15 The Dream | 9 | 3 | 1 | 60/2000/200000000 | 2 |
| 16 The Metropolis | 9 | 3 | 1 | 5/250000/65000000000 | 3 |
| 17 The Foothills | 9 | 1 | 1 | 100/10000/2000000 | 3 |
| 18 The Dragon's Lair | 9 | 2 | 1 | 300/1000000/300000000000000 | 3 |
| 19 The Place of Power | 10 | 2 | 1 | 2/1000000/300000000 | 3 |
| 20 The Sky | 9 | 1 | 1 | 1200/50000000/5000000000 | 3 |
| 21 The Volcano | 9 | 2 | 1 | 5000/1000000000/3000000000000 | 1 |
| 22 The Underworld | 9 | 1 | 1 | 4000/1000000000/50000000000 | 3 |
| 23 The Depths of the Sea | 9 | 2 | 1 | 40000/100000000000/1000000000000 | 1 |
| 24 The Deepest Deep | 8 | 1 | 0 | 24000/20000000000/1000000000000000 | 4 |
| 25 The Void | 9 | 1 | 1 | 500000/50000000000/5000000000000 | 2 |
| 26 The Return | 9 | 2 | 1 | 600000/7000000000000/100000000000000000 | 4 |
| 27 The Cult | 10 | 1 | 1 | 1500000/10000000000000/1e+24 | 3 |
| 28 The War Preparations | 9 | 2 | 1 | 500000000/60000000000000/300000000000000000000 | 3 |
| 29 The Gates of Heaven | 8 | 2 | 0 | 5000000000/500000000000000/5e+28 | 4 |

## Variant: standalone

- 269/269 tasks completed in 2583 runs (all done by run 2583); prestiges at runs [149, 252, 327, 394, 443, 484, 523, 560, 629, 686, 743, 800, 849, 894, 979, 1036, 1113, 1158, 1213, 1264, 1311, 1360, 1405, 1444, 1483, 1520, 1555, 1592, 1625, 1658, 1689, 1746, 1793, 1836, 1893, 1964, 2019, 2066, 2131, 2176, 2221, 2280, 2319, 2358, 2387, 2416, 2443, 2470, 2495, 2520, 2543, 2566]
- Reset gaps between consecutive first-completions: n=269 mean=9.6 p50=2 p90=39 max=166
- Perk-milestone gaps: n=47 mean=51.26 p50=12 p90=173 max=314
  - values: [0, 4, 5, 7, 4, 6, 2, 6, 14, 8, 8, 4, 6, 8, 10, 10, 8, 2, 14, 8, 91, 6, 4, 12, 59, 18, 43, 8, 16, 123, 108, 6, 314, 30, 49, 81, 204, 248, 238, 147, 10, 53, 173, 86, 74, 41, 33]
- Unlock-event gaps (perk or task-unlocker): n=69 mean=34.91 p50=8 p90=118 max=314
- 2 completions arrived via Mastery-of-Time zone skip.

### Estimator calibration (estimate → actual resets to completion)

| estimate | actual resets | actual/estimate |
|---|---|---|
| 0 | n=2545 mean=73.93 p50=20 p90=212 max=629 | — |
| 1 | n=488 mean=92.2 p50=51 p90=250 max=631 | n=488 mean=92.2 p50=51 p90=250 max=631 |
| 2 | n=393 mean=106.38 p50=69 p90=254 max=629 | n=393 mean=53.19 p50=34.5 p90=127 max=314.5 |
| 3-5 | n=725 mean=113.3 p50=71 p90=289 max=635 | n=725 mean=30.64 p50=19.6 p90=78.67 max=210.33 |
| 6-10 | n=639 mean=138.48 p50=81 p90=398 max=643 | n=639 mean=18.22 p50=11.22 p90=49.2 max=106.17 |
| 11-20 | n=717 mean=145.49 p50=76 p90=451 max=698 | n=717 mean=10.2 p50=5.19 p90=29.29 max=55.55 |
| 21-50 | n=948 mean=157.86 p50=89 p90=457 max=778 | n=948 mean=5.07 p50=2.76 p90=14.14 max=33.13 |
| 51-200 | n=1716 mean=163.72 p50=100 p90=424 max=765 | n=1716 mean=1.67 p50=0.94 p90=3.95 max=12.65 |
| >cap(200) | n=23383 mean=239.15 p50=171 p90=562 max=1027 | — |
- 31554 samples, 0 on never-completed tasks.

### Skill milestones (run at which level reached)

| Skill | L5 | L10 | L25 | L50 | L100 | L200 |
|---|---|---|---|---|---|---|
| Charisma | 4 | 4 | 4 | 4 | 5 | 10 |
| Study | 2 | 2 | 3 | 3 | 4 | 15 |
| Combat | 3 | 3 | 5 | 8 | 10 | 23 |
| Search | 2 | 2 | 2 | 3 | 5 | 9 |
| Subterfuge | 2 | 2 | 2 | 3 | 7 | 18 |
| Crafting | 9 | 9 | 9 | 9 | 9 | 11 |
| Travel | 5 | 5 | 5 | 5 | 5 | 10 |
| Magic | 18 | 18 | 19 | 22 | 22 | 22 |
| Fortitude | 13 | 13 | 13 | 13 | 17 | 30 |
| Ascension | 146 | 146 | 146 | 146 | 146 | 148 |

### Zone completion timeline

| Zone | completed | first run | last run |
|---|---|---|---|
| 0 The Village | 8/8 | 1 | 981 |
| 1 The Village Watch | 9/9 | 4 | 981 |
| 2 The Raid | 8/8 | 7 | 57 |
| 3 The Wilderness | 9/9 | 11 | 99 |
| 4 The Cave System | 9/9 | 20 | 103 |
| 5 The Road to the City | 10/10 | 25 | 105 |
| 6 The City Outskirts | 8/8 | 33 | 47 |
| 7 The City | 10/10 | 39 | 981 |
| 8 The Forest | 10/10 | 53 | 117 |
| 9 The Magician | 8/8 | 65 | 77 |
| 10 The Ocean | 9/9 | 73 | 127 |
| 11 The Island | 9/9 | 83 | 212 |
| 12 The Desert | 9/9 | 87 | 226 |
| 13 The Oasis | 9/9 | 97 | 238 |
| 14 The Ritual | 9/9 | 129 | 982 |
| 15 The Dream | 9/9 | 216 | 376 |
| 16 The Metropolis | 9/9 | 234 | 515 |
| 17 The Foothills | 9/9 | 307 | 560 |
| 18 The Dragon's Lair | 9/9 | 364 | 623 |
| 19 The Place of Power | 10/10 | 374 | 1022 |
| 20 The Sky | 9/9 | 599 | 957 |
| 21 The Volcano | 9/9 | 609 | 1307 |
| 22 The Underworld | 9/9 | 939 | 1553 |
| 23 The Depths of the Sea | 9/9 | 969 | 1950 |
| 24 The Deepest Deep | 8/8 | 1093 | 1726 |
| 25 The Void | 9/9 | 1726 | 2121 |
| 26 The Return | 9/9 | 1873 | 2336 |
| 27 The Cult | 10/10 | 1944 | 2358 |
| 28 The War Preparations | 9/9 | 2111 | 2410 |
| 29 The Gates of Heaven | 8/8 | 2260 | 2583 |

## Variant: pinned100

- 200/269 tasks completed in 3000 runs — 69 unreached; prestiges at runs [331, 454, 573, 668, 737, 804, 869, 946, 1009, 1066, 1133, 1196, 1257, 1314, 1367, 1414, 1459, 1506, 1553, 1600, 1647, 1694, 1741, 1784, 1827, 1866, 1923, 1970, 2027, 2082, 2131, 2180, 2229, 2278, 2327, 2376, 2431, 2496, 2553, 2606, 2659, 2710, 2761, 2808, 2853, 2898, 2943]
- Reset gaps between consecutive first-completions: n=200 mean=14.99 p50=2 p90=18 max=390
- Perk-milestone gaps: n=33 mean=90.58 p50=24 p90=187 max=963
  - values: [0, 4, 5, 7, 4, 11, 3, 4, 34, 46, 30, 20, 24, 6, 44, 2, 2, 20, 26, 30, 238, 87, 8, 187, 6, 150, 10, 55, 57, 774, 26, 106, 963]
- Unlock-event gaps (perk or task-unlocker): n=48 mean=62.27 p50=10 p90=123 max=961
- 0 completions arrived via Mastery-of-Time zone skip.

### Estimator calibration (estimate → actual resets to completion)

| estimate | actual resets | actual/estimate |
|---|---|---|
| 0 | n=3358 mean=71.86 p50=32 p90=224 max=512 | — |
| 1 | n=460 mean=120.27 p50=50 p90=393 max=762 | n=460 mean=120.27 p50=50 p90=393 max=762 |
| 2 | n=273 mean=150.29 p50=54 p90=504 max=772 | n=273 mean=75.14 p50=27 p90=252 max=386 |
| 3-5 | n=506 mean=144.4 p50=53 p90=456 max=780 | n=506 mean=37.47 p50=15 p90=118.67 max=216 |
| 6-10 | n=683 mean=177.44 p50=111 p90=453 max=782 | n=683 mean=23.58 p50=14.29 p90=60.33 max=130.33 |
| 11-20 | n=953 mean=205.76 p50=136 p90=508 max=831 | n=953 mean=13.87 p50=8.73 p90=33.57 max=59.21 |
| 21-50 | n=1543 mean=244.74 p50=176 p90=605 max=910 | n=1543 mean=7.56 p50=5.08 p90=18.09 max=35.82 |
| 51-200 | n=2414 mean=324.47 p50=235 p90=765 max=1288 | n=2414 mean=3.51 p50=2.33 p90=9.04 max=18.4 |
| >cap(200) | n=26284 mean=382.83 p50=267 p90=891 max=1874 | — |
- 40597 samples, 4123 on never-completed tasks.

### Skill milestones (run at which level reached)

| Skill | L5 | L10 | L25 | L50 | L100 | L200 |
|---|---|---|---|---|---|---|
| Charisma | 4 | 4 | 4 | 4 | 5 | 10 |
| Study | 2 | 2 | 3 | 3 | 4 | 15 |
| Combat | 3 | 3 | 5 | 8 | 10 | 23 |
| Search | 2 | 2 | 2 | 3 | 5 | 9 |
| Subterfuge | 2 | 2 | 2 | 3 | 7 | 18 |
| Crafting | 9 | 9 | 9 | 9 | 9 | 11 |
| Travel | 5 | 5 | 5 | 5 | 5 | 10 |
| Magic | 18 | 18 | 19 | 22 | 22 | 22 |
| Fortitude | 13 | 13 | 13 | 13 | 17 | 30 |
| Ascension | 449 | 449 | 449 | 449 | 449 | 449 |

### Zone completion timeline

| Zone | completed | first run | last run |
|---|---|---|---|
| 0 The Village | 8/8 | 1 | 2378 |
| 1 The Village Watch | 9/9 | 4 | 2378 |
| 2 The Raid | 8/8 | 7 | 119 |
| 3 The Wilderness | 9/9 | 11 | 237 |
| 4 The Cave System | 9/9 | 20 | 343 |
| 5 The Road to the City | 10/10 | 32 | 345 |
| 6 The City Outskirts | 8/8 | 37 | 78 |
| 7 The City | 10/10 | 55 | 2378 |
| 8 The Forest | 10/10 | 103 | 281 |
| 9 The Magician | 8/8 | 151 | 189 |
| 10 The Ocean | 9/9 | 189 | 293 |
| 11 The Island | 9/9 | 197 | 446 |
| 12 The Desert | 9/9 | 207 | 561 |
| 13 The Oasis | 9/9 | 235 | 636 |
| 14 The Ritual | 9/9 | 305 | 2379 |
| 15 The Dream | 9/9 | 555 | 999 |
| 16 The Metropolis | 9/9 | 652 | 1895 |
| 17 The Foothills | 9/9 | 853 | 1911 |
| 18 The Dragon's Lair | 9/9 | 944 | 2027 |
| 19 The Place of Power | 9/10 | 1115 | 1903 |
| 20 The Sky | 9/9 | 1905 | 2988 |
| 21 The Volcano | 6/9 | 2411 | 2984 |
| 22 The Underworld | 6/9 | 2990 | 2998 |
| 23 The Depths of the Sea | 0/9 | — | — |
| 24 The Deepest Deep | 0/8 | — | — |
| 25 The Void | 0/9 | — | — |
| 26 The Return | 0/9 | — | — |
| 27 The Cult | 0/10 | — | — |
| 28 The War Preparations | 0/9 | — | — |
| 29 The Gates of Heaven | 0/8 | — | — |
