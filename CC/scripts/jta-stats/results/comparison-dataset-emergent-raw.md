# Emergent verification of generated dataset worlds (Phase 5f)

Free-automation playthroughs of Pass-B-solved GENERATED worlds (z15), the Phase-4 sweep re-aimed at synthetic datasets. Hard gate (user
ruling 2026-07-10) = the Victory task AND every perk-holding task complete
within the run budget; total location coverage is REPORTED, not gated
(solo v1 filler does nothing; in a multiworld a filler location can hold
another player's progression item — caveat rides with the report).
Advisory = per-world mean milestone gap in [2, 15] (resetsPerStep=5); C4 emergent = min demanded-skill
level at each zone completion vs the vanilla anchor (flag < 0.4x or any level-0 demanded skill). Play artifacts: `/tmp/jta-dataset-emergent-raw`.

| world | solve | victory+perks? | victory run | last perk run | coverage | runs | prestiges | re-grants | gap p50/mean/max | band ok? | C4 worst-zone ratio | C4 zero-levels |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| vanilla-f1 | ok | yes | 63 | 53 | 130/130 | 249 | 3 | 56 | 2/2.6/10 | yes | 1.00x (z-) | 0 |
| ds1-f1 | ok | yes | 89 | 101 | 130/130 | 202 | 2 | 34 | 4/5.0/14 | yes | 0.03x (z0) | 0 |
| ds1-f2 | **no** (8 stalled entries) | yes | 137 | 129 | 129/130 (stranded: 256) | 2000 | 52 | 920 | 4/6.4/24 | yes | 0.12x (z14) | 0 |
| ds2-f1 | **no** (2 stalled entries) | yes | 113 | 127 | 126/130 (stranded: 195,197,215,256) | 2000 | 54 | 981 | 4/6.3/22 | yes | 0.15x (z0) | 0 |
| ds2-f2 | **no** (3 stalled entries) | yes | 110 | 108 | 125/130 (stranded: 36,135,176,215,256) | 2000 | 44 | 736 | 2/5.3/23 | yes | 0.18x (z14) | 0 |
| ds3-f3 | **no** (10 stalled entries) | yes | 117 | 109 | 129/130 (stranded: 256) | 2000 | 49 | 838 | 4/5.4/21 | yes | 0.14x (z14) | 0 |
| ds4-f4 | **no** (12 stalled entries) | yes | 143 | 153 | 129/130 (stranded: 256) | 2000 | 50 | 885 | 4/7.6/42 | yes | 0.09x (z0) | 0 |

- **Hard gate (Victory + all perk tasks within 2000 runs):** PASS on every world.
- **Residual stranded filler (informational; multiworld caveat):** ds1-f2: task 256 z12; ds2-f1: task 195 z9, task 197 z9, task 215 z10, task 256 z12; ds2-f2: task 36 z1, task 135 z6, task 176 z8, task 215 z10, task 256 z12; ds3-f3: task 256 z12; ds4-f4: task 256 z12
- **Pacing advisory:** every world inside the band.
- **C4 emergent:** flagged — ds1-f1 (worst 0.03x z0, zero-levels 0); ds1-f2 (worst 0.12x z14, zero-levels 0); ds2-f1 (worst 0.15x z0, zero-levels 0); ds2-f2 (worst 0.18x z14, zero-levels 0); ds3-f3 (worst 0.14x z14, zero-levels 0); ds4-f4 (worst 0.09x z0, zero-levels 0)

Per-zone C4 detail (min demanded-skill level at zone completion):

| zone | vanilla-f1 | ds1-f1 | ds1-f2 | ds2-f1 | ds2-f2 | ds3-f3 | ds4-f4 |
|---|---|---|---|---|---|---|---|
| 0 | 33 | 1 | 40 | 5 | 40 | 6 | 3 |
| 1 | 37 | 124 | 724 | 30 | 553 | 26 | 544 |
| 2 | 16 | 189 | 258 | 85 | 191 | 210 | 222 |
| 3 | 101 | 283 | 724 | 338 | 256 | 345 | 361 |
| 4 | 110 | 696 | 401 | 740 | 200 | 393 | 976 |
| 5 | 211 | 695 | 209 | 455 | 299 | 298 | 431 |
| 6 | 607 | 445 | 1111 | 723 | 563 | 273 | 1057 |
| 7 | 467 | 479 | 547 | 526 | 667 | 527 | 530 |
| 8 | 486 | 596 | 629 | 575 | 458 | 522 | 866 |
| 9 | 558 | 767 | 641 | 655 | 555 | 953 | 866 |
| 10 | 652 | 748 | 755 | 726 | 584 | 735 | 902 |
| 11 | 698 | 749 | 765 | 784 | 755 | 828 | 743 |
| 12 | 764 | 790 | 773 | 817 | 792 | 780 | 758 |
| 13 | 1404 | 914 | 833 | 853 | 755 | 805 | 853 |
| 14 | 836 | 100 | 100 | 139 | 151 | 113 | 132 |
