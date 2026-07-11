# Emergent verification of generated dataset worlds (Phase 5f)

Free-automation playthroughs of Pass-B-solved GENERATED worlds (z15), the Phase-4 sweep re-aimed at synthetic datasets. Hard gate (user
ruling 2026-07-10) = the Victory task AND every perk-holding task complete
within the run budget; total location coverage is REPORTED, not gated
(solo v1 filler does nothing; in a multiworld a filler location can hold
another player's progression item — caveat rides with the report).
Advisory = per-world mean milestone gap in [2, 15] (resetsPerStep=5); C4 emergent = min demanded-skill
level at each zone completion vs the vanilla anchor (flag < 0.4x or any level-0 demanded skill). Play artifacts: `/tmp/jta-dataset-emergent`.

| world | solve | victory+perks? | victory run | last perk run | coverage | runs | prestiges | re-grants | gap p50/mean/max | band ok? | C4 worst-zone ratio | C4 zero-levels |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| vanilla-f1 | ok | yes | 63 | 53 | 130/130 | 249 | 3 | 56 | 2/2.6/10 | yes | 1.00x (z-) | 0 |
| ds1-f1 | ok | yes | 55 | 59 | 129/130 (stranded: 256) | 2000 | 63 | 1129 | 2/2.9/14 | yes | 0.03x (z0) | 0 |
| ds1-f2 | **no** (1 stalled entries) | yes | 89 | 79 | 127/130 (stranded: 216,256,276) | 2000 | 64 | 1160 | 4/3.9/11 | yes | 0.33x (z14) | 0 |
| ds2-f1 | ok | yes | 73 | 71 | 129/130 (stranded: 256) | 2000 | 63 | 1139 | 2/3.5/18 | yes | 0.15x (z0) | 0 |
| ds2-f2 | ok | yes | 62 | 62 | 127/130 (stranded: 135,215,256) | 2000 | 53 | 879 | 2/3.0/24 | yes | 0.35x (z14) | 0 |
| ds3-f3 | ok | yes | 67 | 55 | 129/130 (stranded: 256) | 2000 | 63 | 1131 | 2/2.7/20 | yes | 0.09x (z0) | 0 |
| ds4-f4 | ok | yes | 55 | 53 | 129/130 (stranded: 256) | 2000 | 67 | 1195 | 2/2.6/8 | yes | 0.09x (z0) | 0 |

- **Hard gate (Victory + all perk tasks within 2000 runs):** PASS on every world.
- **Residual stranded filler (informational; multiworld caveat):** ds1-f1: task 256 z12; ds1-f2: task 216 z10, task 256 z12, task 276 z13; ds2-f1: task 256 z12; ds2-f2: task 135 z6, task 215 z10, task 256 z12; ds3-f3: task 256 z12; ds4-f4: task 256 z12
- **Pacing advisory:** every world inside the band.
- **C4 emergent:** flagged — ds1-f1 (worst 0.03x z0, zero-levels 0); ds1-f2 (worst 0.33x z14, zero-levels 0); ds2-f1 (worst 0.15x z0, zero-levels 0); ds2-f2 (worst 0.35x z14, zero-levels 0); ds3-f3 (worst 0.09x z0, zero-levels 0); ds4-f4 (worst 0.09x z0, zero-levels 0)

Per-zone C4 detail (min demanded-skill level at zone completion):

| zone | vanilla-f1 | ds1-f1 | ds1-f2 | ds2-f1 | ds2-f2 | ds3-f3 | ds4-f4 |
|---|---|---|---|---|---|---|---|
| 0 | 33 | 1 | 13 | 5 | 40 | 3 | 3 |
| 1 | 37 | 476 | 536 | 39 | 491 | 13 | 616 |
| 2 | 16 | 18 | 7 | 50 | 73 | 24 | 12 |
| 3 | 101 | 94 | 159 | 83 | 56 | 76 | 27 |
| 4 | 110 | 133 | 162 | 589 | 190 | 108 | 104 |
| 5 | 211 | 250 | 289 | 252 | 239 | 208 | 160 |
| 6 | 607 | 323 | 729 | 607 | 751 | 824 | 257 |
| 7 | 467 | 365 | 339 | 394 | 600 | 435 | 267 |
| 8 | 486 | 384 | 558 | 489 | 396 | 364 | 326 |
| 9 | 558 | 581 | 573 | 803 | 587 | 592 | 434 |
| 10 | 652 | 557 | 678 | 879 | 828 | 607 | 512 |
| 11 | 698 | 811 | 710 | 707 | 757 | 676 | 572 |
| 12 | 764 | 753 | 733 | 724 | 757 | 676 | 616 |
| 13 | 1404 | 932 | 750 | 763 | 813 | 706 | 678 |
| 14 | 836 | 305 | 279 | 314 | 294 | 305 | 259 |

## Gate history + residual-filler diagnosis (2026-07-10)

**Gate refinement (user ruling, same day):** the first run of this sweep
gated on TOTAL location coverage (the Phase-4 bar) and FAILED every dataset
world on 1-3 stranded locations. The user ruled the hard gate is
progression: the Victory task and every perk-holding task complete within
the run budget. Under that gate all six worlds PASS — victory at runs
55-89, last perk by run 53-79, comparable to the vanilla anchor (63/53).
Everything stranded is a FILLER location; no perk or Victory task ever
stranded (verified per world: stranded ∩ perk-task ids = ∅, perksMissing
= [] everywhere, and every stranded task sits in zones 6-13 while Victory
is always on a zone-14 task).

**What the residual stranding is** (informational; matters in a MULTIWORLD,
where a filler location can hold another player's progression item): the
mirrored deep-zone slot family of vanilla's `thresholdFloored` fragility
class — task 256 (z12, the same structural slot) on all six worlds. Not
cost (solved to cm ≈ 0.1 and still never ran; cost-invariance of the LEVEL
metric predicts exactly that), not the model (perks/regrants clean, z12
replayed 1480×): the `other` category's energy-per-level metric refuses
the task and its zone never empties, so the all-skipped fallback never
fires. The balance walk cannot see it — the task completes IN-walk under
confinement; it is purely emergent. Vanilla's own fragile slots clear
(130/130 in 249 runs) because the metric's refusal depends on the
emergent skill-level trajectory, which the balance-isomorphism argument
does not cover.

**Existing-knob rescue experiments** (measurements only, no defaults
changed — relevant if multiworld coverage ever hardens the gate again):

| variant (ds1-f1) | coverage | runs |
|---|---|---|
| tuned profile (threshold_other_metric = LEVEL) | 129/130 | 2000 (ceiling) |
| + `threshold_all_skipped = END_RUN` | 129/130 | 2000 — does NOT rescue |
| + `threshold_other_metric = RESETS` | **130/130** | **117** |
| ds2-f2 (worst, 3 stranded) + RESETS | **130/130** | **194** (gap mean 9.5, in-band) |

`threshold_other_metric` stays LEVEL (the Phase-4 settled value) — with the
progression gate it no longer needs re-litigating; the RESETS rescue is
recorded as the known remedy should full-coverage ever become a hard
requirement (e.g. multiworld fill placing progression on these slots).

Scope note: all of this is the tuned harness/automation profile; the
game's shipped defaults run thresholds OFF entirely. C4-emergent caveat:
the worst-zone anchor-ratio flags (0.03x-0.35x) are a completion-TIMING
artifact — dataset worlds complete early zones EARLIER (at lower levels)
and z14 later (post-prestige-cycling); the substantive half of the check
is zero-level demanded skills, which is 0 everywhere.
