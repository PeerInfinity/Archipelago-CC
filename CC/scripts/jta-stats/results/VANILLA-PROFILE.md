# Vanilla JtA Profile (Phase 0)

Generated 2026-07-06T19:40:04.065Z by `profile-vanilla.mjs` (maxRuns 2000, zoneLimit 30, sampleEvery 5, estimatorCap 200). Target profile + calibration inputs for the zone-randomization plan (`CC/docs/plans/jta-zone-randomization-plan.md`).

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

- 269/269 tasks completed in 569 runs (all done by run 570); prestiges at runs [225, 394, 529]
- Reset gaps between consecutive first-completions: n=269 mean=2.12 p50=2 p90=4 max=57
- Perk-milestone gaps: n=47 mean=10.89 p50=8 p90=18 max=61
  - values: [0, 4, 5, 7, 4, 6, 2, 6, 14, 8, 8, 4, 6, 8, 10, 10, 8, 2, 14, 8, 34, 2, 2, 8, 4, 10, 10, 61, 4, 8, 28, 2, 16, 16, 8, 14, 2, 18, 61, 14, 4, 4, 18, 6, 4, 10, 10]
- Unlock-event gaps (perk or task-unlocker): n=69 mean=7.42 p50=5 p90=14 max=61
- 4 completions arrived via Mastery-of-Time zone skip.

### Estimator calibration (estimate → actual resets to completion)

| estimate | actual resets | actual/estimate |
|---|---|---|
| 0 | n=302 mean=12.72 p50=6 p90=37 max=87 | — |
| 1 | n=55 mean=16.98 p50=8 p90=57 max=81 | n=55 mean=16.98 p50=8 p90=57 max=81 |
| 2 | n=27 mean=15.37 p50=8 p90=46 max=67 | n=27 mean=7.69 p50=4 p90=23 max=33.5 |
| 3-5 | n=49 mean=16.08 p50=10 p90=34 max=75 | n=49 mean=4.41 p50=2.67 p90=11 max=25 |
| 6-10 | n=42 mean=21.05 p50=14 p90=54 max=87 | n=42 mean=3.01 p50=1.89 p90=9 max=14.5 |
| 11-20 | n=45 mean=19.87 p50=13 p90=57 max=91 | n=45 mean=1.33 p50=0.92 p90=4.38 max=6.5 |
| 21-50 | n=48 mean=22.85 p50=17 p90=63 max=97 | n=48 mean=0.7 p50=0.5 p90=1.7 max=3.48 |
| 51-200 | n=87 mean=25.17 p50=16 p90=67 max=101 | n=87 mean=0.25 p50=0.18 p90=0.52 max=1.17 |
| >cap(200) | n=786 mean=36.68 p50=30 p90=77 max=136 | — |
- 1441 samples, 0 on never-completed tasks.

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
| 0 The Village | 8/8 | 1 | 349 |
| 1 The Village Watch | 9/9 | 4 | 349 |
| 2 The Raid | 8/8 | 7 | 57 |
| 3 The Wilderness | 9/9 | 11 | 99 |
| 4 The Cave System | 9/9 | 20 | 103 |
| 5 The Road to the City | 10/10 | 25 | 105 |
| 6 The City Outskirts | 8/8 | 33 | 47 |
| 7 The City | 10/10 | 39 | 349 |
| 8 The Forest | 10/10 | 53 | 117 |
| 9 The Magician | 8/8 | 65 | 77 |
| 10 The Ocean | 9/9 | 73 | 127 |
| 11 The Island | 9/9 | 83 | 157 |
| 12 The Desert | 9/9 | 87 | 169 |
| 13 The Oasis | 9/9 | 97 | 175 |
| 14 The Ritual | 9/9 | 129 | 349 |
| 15 The Dream | 9/9 | 161 | 205 |
| 16 The Metropolis | 9/9 | 173 | 278 |
| 17 The Foothills | 9/9 | 185 | 288 |
| 18 The Dragon's Lair | 9/9 | 262 | 308 |
| 19 The Place of Power | 10/10 | 268 | 348 |
| 20 The Sky | 9/9 | 294 | 332 |
| 21 The Volcano | 9/9 | 300 | 364 |
| 22 The Underworld | 9/9 | 320 | 384 |
| 23 The Depths of the Sea | 9/9 | 336 | 461 |
| 24 The Deepest Deep | 8/8 | 356 | 437 |
| 25 The Void | 9/9 | 437 | 475 |
| 26 The Return | 9/9 | 445 | 493 |
| 27 The Cult | 10/10 | 459 | 497 |
| 28 The War Preparations | 9/9 | 473 | 513 |
| 29 The Gates of Heaven | 8/8 | 489 | 570 |

## Variant: pinned100

- 269/269 tasks completed in 1151 runs (all done by run 1151); prestiges at runs [345, 566, 813, 878, 933, 1106]
- Reset gaps between consecutive first-completions: n=269 mean=4.28 p50=2 p90=10 max=102
- Perk-milestone gaps: n=47 mean=23.17 p50=14 p90=52 max=145
  - values: [0, 4, 5, 7, 4, 11, 3, 4, 34, 46, 30, 20, 24, 6, 44, 2, 2, 20, 26, 30, 145, 18, 2, 28, 10, 30, 57, 2, 8, 30, 26, 6, 52, 14, 38, 2, 81, 2, 108, 26, 8, 12, 14, 26, 6, 14, 2]
- Unlock-event gaps (perk or task-unlocker): n=69 mean=15.78 p50=6 p90=38 max=123
- 5 completions arrived via Mastery-of-Time zone skip.

### Estimator calibration (estimate → actual resets to completion)

| estimate | actual resets | actual/estimate |
|---|---|---|
| 0 | n=617 mean=55.48 p50=25 p90=185 max=340 | — |
| 1 | n=47 mean=28.21 p50=16 p90=66 max=149 | n=47 mean=28.21 p50=16 p90=66 max=149 |
| 2 | n=44 mean=31.43 p50=19 p90=74 max=183 | n=44 mean=15.72 p50=9.5 p90=37 max=91.5 |
| 3-5 | n=57 mean=26.61 p50=16 p90=70 max=134 | n=57 mean=6.88 p50=4.4 p90=17.25 max=26.8 |
| 6-10 | n=57 mean=32.98 p50=28 p90=74 max=118 | n=57 mean=4.38 p50=3.67 p90=9.25 max=16.86 |
| 11-20 | n=87 mean=40.05 p50=30 p90=89 max=193 | n=87 mean=2.66 p50=1.72 p90=6.4 max=16.08 |
| 21-50 | n=104 mean=51.39 p50=32 p90=137 max=207 | n=104 mean=1.58 p50=1.08 p90=4.07 max=9.23 |
| 51-200 | n=208 mean=46.27 p50=33 p90=120 max=227 | n=208 mean=0.47 p50=0.32 p90=1.07 max=3.24 |
| >cap(200) | n=2108 mean=82.54 p50=66 p90=182 max=296 | — |
- 3329 samples, 0 on never-completed tasks.

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
| Ascension | 332 | 332 | 332 | 332 | 332 | 334 |

### Zone completion timeline

| Zone | completed | first run | last run |
|---|---|---|---|
| 0 The Village | 8/8 | 1 | 748 |
| 1 The Village Watch | 9/9 | 4 | 748 |
| 2 The Raid | 8/8 | 7 | 119 |
| 3 The Wilderness | 9/9 | 11 | 237 |
| 4 The Cave System | 9/9 | 20 | 345 |
| 5 The Road to the City | 10/10 | 32 | 360 |
| 6 The City Outskirts | 8/8 | 37 | 78 |
| 7 The City | 10/10 | 55 | 748 |
| 8 The Forest | 10/10 | 103 | 281 |
| 9 The Magician | 8/8 | 151 | 189 |
| 10 The Ocean | 9/9 | 189 | 293 |
| 11 The Island | 9/9 | 197 | 345 |
| 12 The Desert | 9/9 | 207 | 468 |
| 13 The Oasis | 9/9 | 235 | 484 |
| 14 The Ritual | 9/9 | 305 | 748 |
| 15 The Dream | 9/9 | 464 | 556 |
| 16 The Metropolis | 9/9 | 488 | 653 |
| 17 The Foothills | 9/9 | 526 | 675 |
| 18 The Dragon's Lair | 9/9 | 601 | 685 |
| 19 The Place of Power | 10/10 | 619 | 789 |
| 20 The Sky | 9/9 | 657 | 741 |
| 21 The Volcano | 9/9 | 683 | 872 |
| 22 The Underworld | 9/9 | 729 | 984 |
| 23 The Depths of the Sea | 9/9 | 749 | 1016 |
| 24 The Deepest Deep | 8/8 | 773 | 976 |
| 25 The Void | 9/9 | 978 | 1042 |
| 26 The Return | 9/9 | 986 | 1074 |
| 27 The Cult | 10/10 | 1002 | 1088 |
| 28 The War Preparations | 9/9 | 1030 | 1090 |
| 29 The Gates of Heaven | 8/8 | 1066 | 1151 |
