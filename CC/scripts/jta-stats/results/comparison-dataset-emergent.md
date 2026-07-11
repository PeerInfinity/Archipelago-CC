# Emergent verification of generated dataset worlds (Phase 5f)

Free-automation playthroughs of Pass-B-solved GENERATED worlds (z15), the Phase-4 sweep re-aimed at synthetic datasets. Hard gate = full
coverage; advisory = per-world mean milestone gap in [2, 15] (resetsPerStep=5); C4 emergent = min demanded-skill
level at each zone completion vs the vanilla anchor (flag < 0.4x or any level-0 demanded skill). Play artifacts: `/tmp/jta-dataset-emergent`.

| world | solve | coverage | full? | runs | prestiges | re-grants | gap p50/mean/max | band ok? | C4 worst-zone ratio | C4 zero-levels |
|---|---|---|---|---|---|---|---|---|---|---|
| vanilla-f1 | ok | 130/130 | yes | 249 | 3 | 56 | 2/2.6/10 | yes | 1.00x (z-) | 0 |
| ds1-f1 | ok | 129/130 | **NO** | 2000 | 63 | 1129 | 2/2.9/14 | yes | 0.03x (z0) | 0 |
| ds1-f2 | **no** (1 stalled entries) | 127/130 | **NO** | 2000 | 64 | 1160 | 4/3.9/11 | yes | 0.33x (z14) | 0 |
| ds2-f1 | ok | 129/130 | **NO** | 2000 | 63 | 1139 | 2/3.5/18 | yes | 0.15x (z0) | 0 |
| ds2-f2 | ok | 127/130 | **NO** | 2000 | 53 | 879 | 2/3.0/24 | yes | 0.35x (z14) | 0 |
| ds3-f3 | ok | 129/130 | **NO** | 2000 | 63 | 1131 | 2/2.7/20 | yes | 0.09x (z0) | 0 |
| ds4-f4 | ok | 129/130 | **NO** | 2000 | 67 | 1195 | 2/2.6/8 | yes | 0.09x (z0) | 0 |

- **Hard gate (full coverage):** **FAILED** — ds1-f1 (129/130: task 256 z12); ds1-f2 (127/130: task 216 z10, task 256 z12, task 276 z13); ds2-f1 (129/130: task 256 z12); ds2-f2 (127/130: task 135 z6, task 215 z10, task 256 z12); ds3-f3 (129/130: task 256 z12); ds4-f4 (129/130: task 256 z12)
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

## Diagnosis (2026-07-10, same day)

**The hard-gate failure is real, structural, and NOT a cost or model
problem.** The stranded set (task 256/z12 on all six worlds, plus 135/215/216/276
on some) is the mirrored deep-zone slot family of vanilla's known
`thresholdFloored` fragility class:

- Not cost: task 256 solved to cost_multiplier ~0.1 (near-MIN) in every
  world and still never ran. Not the unengaged-tail max-cost repricing
  either (256 was not in any tail; tail members like 215 strand at max cm
  AND 256 strands at 0.1 — cost is irrelevant, as the cost-invariance of
  the LEVEL metric predicts).
- Not the model: all perks granted (perksMissing []), regrants track
  prestiges exactly, and 1480/2000 runs replay through zone 12 — the task
  is simply never CHOSEN: the `other` category's cost-invariant
  energy-per-level metric refuses it, and z12 always offers other work so
  the all-skipped fallback never fires there. The walk cannot see this
  (256 completes IN-walk under confinement); it is purely emergent.
- Why vanilla escapes and mirrors don't: the metric's ratio depends on the
  demanded skill's LEVEL trajectory, which depends on the whole world's
  fill/costs — the balance-isomorphism argument covers structure, not the
  emergent level trajectory. Vanilla-f1 clears its own fragile slots
  (130/130 in 249 runs); every dataset world leaves 1-3 behind at the
  2000-run ceiling with ~63 prestige cycles.

**Existing-knob rescue experiments (measurements, no defaults changed):**

| variant (ds1-f1) | coverage | runs |
|---|---|---|
| tuned profile (threshold_other_metric = LEVEL) | 129/130 | 2000 (ceiling) |
| + `threshold_all_skipped = END_RUN` | 129/130 | 2000 (ceiling) — does NOT rescue |
| + `threshold_other_metric = RESETS` | **130/130** | **117** |
| ds2-f2 (worst world, 3 stranded) + RESETS | **130/130** | **194** (gap mean 9.5, in-band) |

**The lever exists and is a SETTLED KNOB: Phase 4 ruled
`threshold_other_metric` stays LEVEL on vanilla evidence ("no change
needed"). The dataset evidence reopens it — flipping it (globally, or for
dataset worlds only) is a user decision, deliberately NOT taken here.**
Scope note: this profile is the tuned harness/automation profile; the
game's shipped defaults run with thresholds OFF entirely, so shipped-
default play is unaffected — the stranding applies to the tuned-profile
automation that Phase 4's coverage claims (and the balance walk's economy)
are anchored on.

C4-emergent caveat: the worst-zone ratio flags (0.03x-0.35x) are a TIMING
artifact of the metric — dataset worlds complete early zones at LOWER
skill levels than the vanilla anchor because they complete them EARLIER
(and z14 later, post-prestige-cycling); zero-level demanded skills = 0
everywhere, which is the substantive half of the check. Interpret the
ratio column with the completion-run column of the per-world results.
