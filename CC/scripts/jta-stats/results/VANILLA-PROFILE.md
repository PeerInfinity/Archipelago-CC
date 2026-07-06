# Vanilla JtA Profile (Phase 0)

Generated 2026-07-06T21:49:42.589Z by `profile-vanilla.mjs` (maxRuns 3000, zoneLimit 30, sampleEvery 5, estimatorCap 200). Target profile + calibration inputs for the zone-randomization plan (`CC/docs/plans/jta-zone-randomization-plan.md`).

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

- 264/269 tasks completed in 3000 runs — 5 unreached; prestiges at runs [207, 326, 413, 492, 563, 634, 705, 772, 895, 1018, 1141, 1236, 1355, 1458, 1529, 1600, 1661, 1720, 1777, 1836, 1893, 1950, 2005, 2060, 2113, 2164, 2215, 2266, 2349, 2456, 2531, 2640, 2715, 2780, 2881, 2944, 2997]
- Reset gaps between consecutive first-completions: n=264 mean=11.13 p50=2 p90=12 max=457
- Perk-milestone gaps: n=46 mean=63.85 p50=10 p90=146 max=648
  - values: [0, 4, 5, 7, 4, 6, 2, 6, 14, 8, 8, 4, 6, 8, 10, 10, 8, 2, 14, 8, 70, 61, 10, 4, 6, 32, 73, 404, 10, 18, 56, 2, 117, 121, 210, 142, 46, 142, 648, 40, 81, 4, 261, 146, 4, 95]
- Unlock-event gaps (perk or task-unlocker): n=67 mean=43.84 p50=8 p90=117 max=648
- 2 completions arrived via Mastery-of-Time zone skip.
- Unreached: Avatar of the Gods (z28); Avoid the Gods' Revenge (z28); Take Your Place in Heaven (z29); Rally Your Troops (z29); Break Down the Gates (z29)

### Estimator calibration (estimate → actual resets to completion)

| estimate | actual resets | actual/estimate |
|---|---|---|
| 0 | n=785 mean=157 p50=83 p90=456 max=966 | — |
| 1 | n=119 mean=153.61 p50=101 p90=379 max=871 | n=119 mean=153.61 p50=101 p90=379 max=871 |
| 2 | n=81 mean=191.21 p50=112 p90=544 max=881 | n=81 mean=95.6 p50=56 p90=272 max=440.5 |
| 3-5 | n=159 mean=214.11 p50=113 p90=576 max=901 | n=159 mean=55.99 p50=30.5 p90=151.33 max=297 |
| 6-10 | n=126 mean=244.17 p50=135 p90=676 max=941 | n=126 mean=32.95 p50=18 p90=91.13 max=130.67 |
| 11-20 | n=151 mean=225.82 p50=101 p90=656 max=966 | n=151 mean=16.3 p50=6.76 p90=44.44 max=86 |
| 21-50 | n=215 mean=231.92 p50=125 p90=638 max=986 | n=215 mean=7.33 p50=4.18 p90=18.95 max=41.95 |
| 51-200 | n=367 mean=283.21 p50=119 p90=806 max=1186 | n=367 mean=2.96 p50=1.29 p90=8.1 max=19.15 |
| >cap(200) | n=5047 mean=325.37 p50=229 p90=787 max=1448 | — |
- 7407 samples, 357 on never-completed tasks.

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
| 0 The Village | 8/8 | 1 | 1460 |
| 1 The Village Watch | 9/9 | 4 | 1460 |
| 2 The Raid | 8/8 | 7 | 57 |
| 3 The Wilderness | 9/9 | 11 | 99 |
| 4 The Cave System | 9/9 | 20 | 103 |
| 5 The Road to the City | 10/10 | 25 | 105 |
| 6 The City Outskirts | 8/8 | 33 | 47 |
| 7 The City | 10/10 | 39 | 1460 |
| 8 The Forest | 10/10 | 53 | 117 |
| 9 The Magician | 8/8 | 65 | 77 |
| 10 The Ocean | 9/9 | 73 | 127 |
| 11 The Island | 9/9 | 83 | 163 |
| 12 The Desert | 9/9 | 87 | 205 |
| 13 The Oasis | 9/9 | 97 | 262 |
| 14 The Ritual | 9/9 | 129 | 1461 |
| 15 The Dream | 9/9 | 169 | 391 |
| 16 The Metropolis | 9/9 | 270 | 823 |
| 17 The Foothills | 9/9 | 286 | 843 |
| 18 The Dragon's Lair | 9/9 | 795 | 881 |
| 19 The Place of Power | 10/10 | 799 | 1471 |
| 20 The Sky | 9/9 | 833 | 1095 |
| 21 The Volcano | 9/9 | 855 | 1517 |
| 22 The Underworld | 9/9 | 978 | 1653 |
| 23 The Depths of the Sea | 9/9 | 1113 | 2428 |
| 24 The Deepest Deep | 8/8 | 1317 | 2291 |
| 25 The Void | 9/9 | 2291 | 2602 |
| 26 The Return | 9/9 | 2309 | 2839 |
| 27 The Cult | 10/10 | 2416 | 2920 |
| 28 The War Preparations | 7/9 | 2600 | 2841 |
| 29 The Gates of Heaven | 5/8 | 2841 | 2938 |

## Variant: pinned100

- 203/269 tasks completed in 3000 runs — 66 unreached; prestiges at runs [345, 550, 657, 742, 825, 902, 977, 1052, 1125, 1232, 1337, 1436, 1535, 1620, 1737, 1844, 1937, 2024, 2137, 2252, 2353, 2488, 2603, 2714, 2859, 2988]
- Reset gaps between consecutive first-completions: n=203 mean=14.01 p50=2 p90=14 max=341
- Perk-milestone gaps: n=34 mean=83.12 p50=24 p90=309 max=373
  - values: [0, 4, 5, 7, 4, 11, 3, 4, 34, 46, 30, 20, 24, 6, 44, 2, 2, 20, 26, 30, 163, 24, 4, 309, 369, 291, 6, 2, 14, 200, 218, 180, 373, 351]
- Unlock-event gaps (perk or task-unlocker): n=49 mean=57.67 p50=11 p90=291 max=367
- 0 completions arrived via Mastery-of-Time zone skip.

### Estimator calibration (estimate → actual resets to completion)

| estimate | actual resets | actual/estimate |
|---|---|---|
| 0 | n=857 mean=135.63 p50=48 p90=377 max=953 | — |
| 1 | n=64 mean=60.69 p50=22 p90=159 max=538 | n=64 mean=60.69 p50=22 p90=159 max=538 |
| 2 | n=46 mean=81.24 p50=44 p90=190 max=662 | n=46 mean=40.62 p50=22 p90=95 max=331 |
| 3-5 | n=89 mean=105.92 p50=45 p90=316 max=858 | n=89 mean=27.25 p50=11.6 p90=76 max=192.33 |
| 6-10 | n=107 mean=146.32 p50=74 p90=417 max=773 | n=107 mean=18.9 p50=9.25 p90=50.78 max=96.63 |
| 11-20 | n=167 mean=167.44 p50=91 p90=413 max=868 | n=167 mean=11.13 p50=5.35 p90=28.78 max=43.4 |
| 21-50 | n=246 mean=171.46 p50=133 p90=400 max=888 | n=246 mean=5.38 p50=3.92 p90=11.81 max=27 |
| 51-200 | n=425 mean=221.63 p50=168 p90=514 max=898 | n=425 mean=2.13 p50=1.64 p90=4.9 max=15.75 |
| >cap(200) | n=4912 mean=308.46 p50=227 p90=705 max=1325 | — |
- 8134 samples, 1221 on never-completed tasks.

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
| 0 The Village | 7/8 | 1 | 4 |
| 1 The Village Watch | 8/9 | 4 | 9 |
| 2 The Raid | 8/8 | 7 | 119 |
| 3 The Wilderness | 9/9 | 11 | 237 |
| 4 The Cave System | 9/9 | 20 | 357 |
| 5 The Road to the City | 10/10 | 32 | 359 |
| 6 The City Outskirts | 8/8 | 37 | 78 |
| 7 The City | 9/10 | 55 | 267 |
| 8 The Forest | 10/10 | 103 | 281 |
| 9 The Magician | 8/8 | 151 | 189 |
| 10 The Ocean | 9/9 | 189 | 293 |
| 11 The Island | 9/9 | 197 | 460 |
| 12 The Desert | 9/9 | 207 | 486 |
| 13 The Oasis | 9/9 | 235 | 512 |
| 14 The Ritual | 8/9 | 305 | 470 |
| 15 The Dream | 9/9 | 474 | 1483 |
| 16 The Metropolis | 9/9 | 510 | 1705 |
| 17 The Foothills | 9/9 | 1192 | 1840 |
| 18 The Dragon's Lair | 9/9 | 1473 | 2103 |
| 19 The Place of Power | 9/10 | 1497 | 1697 |
| 20 The Sky | 9/9 | 1711 | 2470 |
| 21 The Volcano | 6/9 | 2105 | 2448 |
| 22 The Underworld | 7/9 | 2472 | 2819 |
| 23 The Depths of the Sea | 6/9 | 2823 | 2845 |
| 24 The Deepest Deep | 0/8 | — | — |
| 25 The Void | 0/9 | — | — |
| 26 The Return | 0/9 | — | — |
| 27 The Cult | 0/10 | — | — |
| 28 The War Preparations | 0/9 | — | — |
| 29 The Gates of Heaven | 0/8 | — | — |
