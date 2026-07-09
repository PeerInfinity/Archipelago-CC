# JtA automation stats — findings (2026-07-05, rev 2)

> **VALIDITY CAVEAT (2026-07-06, user-flagged):** Rounds 1–4 and the
> defaults sweep all ran with `award_spark_on_discovery: true` (it was part
> of `baselineMods()`), and Round 5 showed discovery spark is load-bearing —
> it funds Divinity purchases (MoT, SBtV, energy repeatables) without
> prestiging. Conclusions most exposed: the auto-prestige **stall-40**
> ("No new zone for N resets") tuning, the entire purchase-policy round
> (spendCap explicitly rode discovery spark to zero-prestige completions),
> the income round, and the **all-134 completion metric itself** (it counts
> the four SBtV-gated tasks — ids 17/28/88/158 — which may be unobtainable
> without discovery spark or prestige). Treat Rounds 1–4 numbers as valid
> only for spark-on play. **RESOLVED by Round 6 (same day):**
> `baselineMods()` is now spark-OFF (the game's own default), the legacy
> spark-on experiments live in `LEGACY_EXPERIMENTS` (re-runnable via
> `--legacy`, spark-on auto-injected), and the full re-evaluation below
> found: stall optimum 40 → 20, Unlock Savings a pure win in both spark
> states, thresholds/fill/z15 conclusions unaffected.

> **Defaults shipped (Fork 1.5, submodule `64bd3c1`):** the winning numerics
> are now the game's defaults — item /rep 5%, /rst 5 for the four rst-3
> categories, auto-prestige stall 40 (toggles all still off). Post-tuning
> out-of-box runs: `tuned-defaults` all-134 @ 349; with Unlock Savings on,
> `tuned-defaults-unlock-savings` @ 272 (best sweep config was 270, which
> additionally used perk-first fill). All other result files below predate
> the tuning and keep the old defaults as the historical record.

Setup: fresh save, tested play profile (all mods on except queue_cycle/instant_mode,
auto-prestige stall-only@20, When-All-Skipped = Best Task, Skip on Block, tuned
threshold defaults), instant mode, automation All to zone 99. Metric: cumulative
run number at which each task in zones 1-15 first hits reps == max_reps; a
never-completed task counts as budget+1 in the mean.

> Rev 2: earlier numbers (harness commit `af639337d`) under-counted — Mastery
> of Time's `skipFreeZones()` completes skipped zones' tasks inside
> doEnergyReset/doPrestige where the per-tick scan can't see them. The driver
> now records those boundary completions (`viaZoneSkip: true`), and forces the
> run-end branch after 50 progress-free ticks (end-of-content, where the real
> game waits for a click). With correct measurement the baseline profile
> completes ALL 134 tasks by run 416 — the old "SBtV-gated tasks never
> complete" was mostly measurement artifact.

## Harness validation (Playwright vs plain Node)

Byte-identical results across both environments (no `Math.random` in the sim);
same compute time (~6-16s per config). Playwright adds only browser startup +
the dev-server dependency. Node (`run-node.mjs`) is the sweep workhorse.

## Round 1 — run-scheduling settings (500-run budget)

Winners (mean run / all-134 run; baseline 84.2 / 416):

| change | mean | all-134 |
|---|---|---|
| combo: item /rep 5% + perk-first fill + rst 5 + stall 40 | **74.1** | **352** |
| item /rep 5% + perk-first fill + stall 40 | 74.7 | 353 |
| stall 20 → 40 | 79.1 | 354 |
| item /rep 10% → 5% | 81.3 | 466 |
| perk-first auto-fill; /rst 3 → 5 | 82.4-82.7 | ~420 |

Losers: thresholds-off catastrophic (65/134, mean 296); All-Skipped=End-Run
(100.2); stall 5/10, cycle-off ≠ 1, no-dreamcatcher — all fail to finish in
500 runs. no-ring finishes but later (453).

## Round 2 — Divinity purchase policies (1000-run budget, baseline profile)

All policies implemented driver-side (sim's auto_buy_cheapest off, driver
buys via exported APIs each tick). Control = auto_buy_cheapest.

| policy | mean | all-134 | MoT@ | SBtV@ | prestiges |
|---|---|---|---|---|---|
| **spendCap g=1.0** (repeatable spend between unlocks ≤ 1× next unlock cost) | **82.5** | **354** | 333 | 353 | 2 |
| spendCap g=0.5 | 83.3 | 358 | 338 | 357 | 2 |
| levelCap 10 (repeatables stop at L10 while unlocks remain) | 83.9 | 405 | 346 | 403 | 4 |
| cheapest (control) | 84.2 | 416 | 402 | 415 | 3 |
| reserve f=0.5 (balance floor) | 87.0 | 460 | 441 | 458 | 5 |
| tiers v1 (authored ordering) | 90.0 | 584 | 370 | 583 | 8 |
| unlocks-first / reserve f=1.0 (hard save) | 133.9 | never (130/134) | 942 | never | 11 |

Takeaways:

- **The spend-cap idea wins**: greedy-cheapest is right *locally*, it just
  needs a budget so low-exponent repeatables (Divine Knowledge 1.25×, Spite
  the Gods 1.4×) can't soak spark forever below each big unlock's price.
  Capping cumulative repeatable spending between unlock purchases at ~1× the
  next unlock's cost pulls MoT from run 402 → 333 and SBtV 415 → 353 while
  keeping the early repeatable economy intact. g is forgiving (0.5 ≈ 1.0).
- **Hard saving is the worst possible policy** — repeatables ARE the engine;
  starving them stalls zone progress so badly the spark income never comes.
  A balance-floor reserve (f=0.5) is also net-negative. The flow cap beats
  the stock floor because it never blocks the cheap early purchases.
- **Authored tiers**: worse than cheapest at full completion despite decent
  MoT timing — strict ordering under-buys broad cheap boosts. Not worth the
  UI surface it would need, at least as drafted.
- **Combined best** (round-1 combo profile + spendCap 1.0): all 134 tasks by
  **run 270** (mean 71.6), MoT@251, SBtV@270 — 35% fewer runs than the
  original baseline, with **zero prestiges**: discovery spark alone funds
  everything (stall-40 never fires within 270 runs).

## In-game mod: Unlock Savings (IMPLEMENTED, Fork 1.5, submodule `3573865`)

`auto_buy_budget_enabled` + `auto_buy_budget_pct` (default off / 100%),
Divinity popup next to Auto-Buy Cheapest. Unlockables are bought the moment
they're affordable (cheapest first); the cheapest repeatable is bought only
while repeatable spending since the last unlockable purchase (persisted
counter, shared with manual/queued purchases) stays within pct% of the
cheapest unowned unlockable's cost. The `mod-unlock-savings` experiment
reproduces the driver-side spendCap g=1.0 results byte-identically; with
the toggle off, pure-cheapest behavior is byte-identical too.

## Round 3 — long-run spark income (income-comparison.md)

The round-1/2 caveat ("low-prestige winners may cost long-run income") is
**refuted**: 1000-run trajectories with exact earned-spark accounting show
the completion winners winning income at every horizon. Spark gain is
exponential in the deepest zone reached, so fewer-but-deeper prestiges
compound: at run 1000, combo + spendCap has earned ~18.7 quadrillion vs
~8.8q for baseline (2.1×), and it leads at run 200, 300, 500, 750 too.
Frequent prestiging (stall 5) is catastrophic — 68k TOTAL at run 1000,
eight orders of magnitude behind, stuck at lifetime zone 20.

## Round 4 — substrate-pinned energy (pin100-*.json, 2026-07-05)

The jta substrate pins `max_energy` to the shared loop-mode pool (default
100) on every region entry, so Energetic-Memory / prestige energy growth
stops applying and the threshold pct budgets stay pct-of-100 forever. The
question (substrate-integration plan §4): do the sweep-tuned defaults
transfer, or does substrate play need different values / bridge-side
scaling? Measured with the new `pinMaxEnergy` driver option (re-clamps
max+current at init and after every reset/prestige):

- **pin 100 + tuned defaults (tested play profile): all 134 tasks by run
  747.** Slower than unpinned (270–349) as expected with a fixed budget,
  but fully completable — the economy stays skill-driven.
- **pin 100 + thresholds OFF: 72/134 after 2000 runs**, parked around
  zone 7–8 with zero prestiges. Worse relative outcome than unpinned
  thresholds-off (65/134 in 500 runs, which at least kept climbing).

**Conclusion: the tuned defaults transfer to pool-pinned substrate play
unchanged** — thresholds are MORE load-bearing there, not less, because
the fixed budget makes over-priced tasks permanently unaffordable rather
than temporarily. No bridge-side threshold rescaling and no separate
substrate defaults needed. (Caveat: this emulates the pinned budget in
standalone zone progression; real substrate play adds region-graph
traversal on top, but the threshold judgment being tested is per-task and
identical in both.)

## Caveats

- Deterministic sim → each config is one trajectory; deltas under ~2 mean
  runs are noise-equivalent (butterfly effects).
- Divine Speed's real-time benefit is invisible in instant mode (it speeds
  wall-clock ticks, explicitly not energy use).

## Round 5 — vanilla profile for the zone-randomization arc (vanilla-profile.json, 2026-07-06; re-run same day with award_spark_on_discovery OFF per user ruling)

Phase 0 of `CC/docs/plans/jta-zone-randomization-plan.md`: full-game (30-zone,
269-task) playthroughs + static structural profile + estimator calibration,
via `profile-vanilla.mjs` (details in `VANILLA-PROFILE.md`). Profiling profile
= tuned defaults MINUS Award Spark on Discovery (discovery spark funds
Divinity purchases without prestiging and distorts the vanilla pacing curve;
an earlier same-day run with it ON is in git history for comparison).

- **v1 pacing anchor (zones 0–14, STANDALONE variant — the ruled default):**
  21 perk milestones, gap values
  [0, 4, 5, 7, 4, 6, 2, 6, 14, 8, 8, 4, 6, 8, 10, 10, 8, 2, 14, 8, 70] —
  p50 = 7, mean 9.7; consecutive first-completion gaps p50 = 2. The final 70
  (and the z0–14 completion tail out to run ~1461) is the
  SeeBeyondTheVeil-gated straggler problem, not the organic curve.
- **Discovery spark was load-bearing for the late game**: with it off,
  standalone reaches 264/269 tasks by run 3000 (37 prestiges; 5 unreached in
  z28–29) and pinned-100 only 203/269 (26 prestiges) — vs 569/1151-run full
  completions with it on. Zones 0–14 pacing is nearly identical either way;
  the setting reshapes everything past zone ~15.
- **SBtV-gated hidden tasks (RULED: excluded from v1)**: exactly four
  z0–14 tasks have no in-game unlocker — ids 17 (z0 Use Secret Fishing
  Spot), 28 (z1 Training Dummy), 88 (z7 Train at Every Guild), 158 (z14
  Write Down Some Learnings); they need the SeeBeyondTheVeil Divinity
  purchase. Without discovery spark and without prestige (v1 scope) they
  are unobtainable — pinned-100 left exactly these 4 unreached at 3000
  runs; standalone completed them only at run ~1460. v1 ignores them
  (location pool, pacing walk, and metric universe).
- **Whole-game estimator calibration is tail-dominated under spark-off**
  (tasks sit for hundreds of runs while prestige spark accumulates); the
  Phase 3 balancer should derive its correction curve from the zone≤14
  samples in `vanilla-profile-raw-*.json` (the estimator-vs-actual pattern
  from the spark-on run still holds directionally: optimistic at low
  estimates — queue order dominates; pessimistic at high ones — compounding
  beats the frozen-boost assumption; crossover in the low tens).
- Skill shape (static, unchanged): 195/269 tasks single-skill, 72 two-skill;
  skills introduced at zones 0,0,0,0,0,1,1,2,3,14; Ascension
  (xp_needed_mult 200) is the outlier.

## Round 6 — spark-off re-evaluation (spark-off-*, 2026-07-06)

`award_spark_on_discovery` defaults to **false in the game** — the spark-on
harness baseline modeled the user's personal play profile, not out-of-box
play. This round re-evaluates everything under spark-off. `baselineMods()`
flipped to spark-off (user-approved); spark-on is now an explicit override.

**Universes (user-ruled):** primary = FULL GAME (zoneLimit 30, all 269
tasks, 5000-run budget) — the four SBtV-gated tasks stay IN, because
prestige spark buys SeeBeyondTheVeil eventually and their timing is real
tail signal. Secondary = zones 1–15 with the four EXCLUDED via the new
`excludeTaskIds` driver option (all-134 → **all-130**): without discovery
spark or a prestige-scale horizon they are genuinely unobtainable there.
Full-game runs are tail-dominated, so the headline metrics are the new
done@N checkpoint columns + z1-15 sub-mean (report.mjs), not the plain mean.
Master table: `comparison-spark-off-full.md`.

### A. Scale of the contamination

| profile | all-269 @ | prestiges | MoT@ | SBtV@ |
|---|---|---|---|---|
| spark-off (tuned defaults) | 4068 | 59 | 1237 | 1459 |
| spark-on (same settings) | 570 | 3 | 335 | 348 |

Spark-off is a ~7× longer campaign funded by ~20× more prestiges. Matches
Round 5's profiling run exactly at run 3000 (264/269, 37 prestiges), which
validates the flipped baseline. The z15/130-task horizon is nearly
indifferent (261 vs 175 last-completion; mean 66.4 vs 64.4) — the spark
setting reshapes only the post-z15 game, as Round 5 said.

### B. Auto-prestige — the stall-40 default was wrong for spark-off

| trigger | all-269 @ | prestiges | notes |
|---|---|---|---|
| stall 10 | 3153 | 114 | best tail |
| stall 20 | **3294** | 77 | near-tie, fewer prestiges, best mid-game |
| stall 40 (shipped) | 4068 | 59 | too passive when prestige is the only spark |
| stall 80 | >5000 (268) | 40 | fails |
| stall 5 | >5000 (262) | 304 | prestige spam, mean 1454 |
| ratio 50% | 3725 | 77 | mediocre |
| wealth 10/25/50% | >5000 (166–226) | 422–514 | **catastrophic** |

The wealth trigger (prospective gain ≥ pct of OWNED spark) degenerates while
auto-buy is on: purchases keep held spark near zero, so it fires almost
every run — 500+ prestiges, permanently stuck around zone 20–26. It also
dominates any OR-combo (stall40+wealth10 is trajectory-identical to
wealth-10). Stall remains the right trigger TYPE; only the count was wrong.

### C. Purchase policy — Unlock Savings wins again, harder

| policy | all-269 @ | prestiges | MoT@ | SBtV@ |
|---|---|---|---|---|
| Unlock Savings mod ≡ spendCap g=1.0 | **2887** | 34 | 716 | 1005 |
| spendCap g=0.5 | 3063 | 36 | 716 | 1029 |
| cheapest (baseline) | 4068 | 59 | 1237 | 1459 |
| levelCap 10 | >5000 (258) | 55 | 806 | 1163 |

The in-game mod reproduces driver spendCap g=1.0 byte-identically under
spark-off too. −29% on its own; the flow cap matters MORE when income
arrives in prestige lumps, not less.

### D. Thresholds / auto-fill — insensitive at full-game scale

item /rep 2/5/10%, rst 3/5/8, perk-first fill: all within ±100 runs of the
4068 baseline (≈2%, noise for a deterministic single trajectory). The full
game is prestige/purchase-bound, not scheduling-bound — the Fork 1.5
numerics need no spark-off correction. The z15 secondary agrees (all-130 in
every variant, means 66–69, median 59 across the board).

### E. Winners combined + spark-on safety attribution

| defaults candidate | spark-off all-269 @ | spark-on all-269 @ |
|---|---|---|
| shipped (stall 40, savings off) | 4068 | 570 |
| savings ON, stall 40 | 2887 | **423** (0 prestiges) |
| savings ON, stall 20 | 2583 | 588 |
| savings ON, stall 15 | **2540** | 780 |
| savings ON, stall 10 | 2592 | — |

Attribution is clean: the spark-on regression at stall 15 is entirely the
stall change (stall15-only spark-on: 800; savings-only spark-on: 423 —
savings is a pure win in BOTH spark states). Under spark-on, any stall low
enough to actually fire just buys pointless re-climbs (stall 15 fires 16
times; stall 40 never fires). **stall 20 is the sweet spot**: −37% spark-off
(with savings), +3% spark-on vs shipped defaults, and it matches the user's
own long-standing manual setting. stall 15 vs 20 vs 10 are within noise on
spark-off; 20 is strictly kindest to spark-on.

### Shipped decisions (user rulings, 2026-07-06)

- **`auto_prestige_stall_resets` 40 → 20 SHIPPED** (submodule `f39dd2f`,
  changelog "Fork 1.6.1"; SAVE_VERSION stays Fork 1.6 — no save-shape
  change). Numeric default only; every toggle still ships off.
- **Unlock Savings toggle stays OFF in the game** (toggles-all-off ruling
  stands), but the clarified principle is: when automation is explicitly
  enabled, use the settings that give the best results. `baselineMods()`
  therefore now includes `auto_buy_budget_enabled` — the harness's
  enabled-automation profile plays with savings on.
- Everything else (thresholds, fill order, all-skipped): unchanged.
- Verification: `spark-off-full-shipped-defaults` (empty overrides on the
  new build + new baselineMods) reproduces `spark-off-full-stall20-savings`
  **byte-identically** — all-269 @ 2583, 52 prestiges.

## Round 7 — estimator calibration for the balancer (calibration-*-z14.json, 2026-07-08)

Phase 3c of the zone-randomization arc. `derive-calibration.mjs` joins the raw
`estimatorSamples` (`[taskId, run, estimate]`) against the run each task actually
completed on, restricted to **zones 0-14** and excluding the four SBtV-gated
tasks — the restriction SUMMARY Round 5 asked for, because the whole-game table
in `vanilla-profile.json` is tail-dominated under spark-off and comes out
non-monotonic. The emitted `curve` is an isotonic (pool-adjacent-violators) fit
of median actual vs estimate, which the balancer inverts to pick costs.

**The profile was regenerated for this round, and that mattered twice.**

1. *The committed 2026-07-06 profile was stale.* It predates Round 6's shipped
   defaults (`auto_prestige_stall_resets` 40->20, Unlock Savings on): re-running
   the same command today completes all 269 tasks at run 2583 with 52 prestiges,
   where the old file ran the full 3000 runs to 264/269. The balancer's forward
   pass plays under today's `baselineMods()`, so it must be calibrated against
   today's game.
2. *The "plateau" was a property of the STALE BUILD, not of sampling density.*
   Holding density fixed at `--sample-every 5` and varying only the build:
   stale gives `[6, 6, 8, 10, 14, 14, 14, 14]` (flat top), current gives
   `[6, 6, 8, 10, 12, 13, 13, 19]`. Denser sampling only refines the low buckets.
   An earlier draft of this round credited the flattening to sparse sampling;
   that was wrong — two things were changed at once. There is no plateau, and it
   was never evidence of skill-XP compounding beating the estimator.

**Standalone (the anchor, and now also the runtime — `energyBonusSync` default
on).** 1487 usable samples, 123 censored, sample-every 1.

| estimate | n | actual p25 | p50 | p75 | isotonic p50 |
|---|---|---|---|---|---|
| 0 | 782 | 3 | 6 | 10 | 6 |
| 1 | 102 | 4 | 7 | 16 | 7 |
| 2 | 61 | 6 | 9 | 14 | 9 |
| 3-5 | 124 | 5 | 10 | 19 | 10 |
| 6-10 | 103 | 6 | 11 | 19 | 11 |
| 11-20 | 78 | 10 | 16 | 22 | 14.91 |
| 21-50 | 94 | 8 | 14 | 27 | 14.91 |
| 51-200 | 143 | 9 | 19 | 32 | 19 |

### The window [6, 19] does not mean what it looks like — RETIRED 2026-07-08

This table is kept as a record, not as a calibration. Three defects, found while
re-examining it:

1. **The samples are not independent.** 1487 samples come from only **118
   distinct tasks**; the `est = 0` bucket is 782 samples from 91 tasks. A task
   that lingers 100 runs contributes 100 samples whose `actual` counts down
   100, 99, 98...; a task that finishes at once contributes one. So the median is
   weighted by *how long tasks linger* — the very thing it is trying to predict.
   One task (id 150) supplies 63 samples on its own.
2. **It is the wrong conditional.** The balancer assigns a cost ONCE, at first
   touch. The matching quantity is one observation per task: the estimate at
   first touch, and the resets it then took. That table reads
   `est 0 -> p50 9` (not 6; only 3 of 46 tasks finish within one reset), on
   n = 46/12/7/11/10/5/11/16, and it is **not monotone**: 9, 6, 13, 9, 19, 11,
   15, 32. There is no curve in it.
3. **It is observational, not interventional.** Cost was never manipulated —
   it is vanilla throughout. Estimates vary because of designer-set costs, zone
   and skill level, all of which also drive `actual`. Reading a causal
   "set est = E, get actual = f(E)" off that is confounded; and the balancer's
   whole job is to *set* cost. The build- and prestige-sensitivity above is the
   symptom.

Only the qualitative shape survives: an affordable task still waits several
resets for automation's priority queue, and more expensive tasks take longer.
**Superseded by the user ruling of 2026-07-08: aim for a CONSTANT number of
resets between milestones and measure the real gaps by replaying the forward
pass, rather than predicting them from a static curve.**

**The z0-14 anchor curve is unchanged** across the stale profile, a fresh
prestige-on profile, and a fresh prestige-free profile
(`profile-vanilla.mjs --no-prestige`, added this round): all three give perk-gap
sequence `[0,4,5,7,4,6,2,6,14,8,8,4,6,8,10,10,8,2,14,8]`, p50 = 7. Only the
trailing SBtV straggler moves (70 -> 91 with prestige on), and v1 excludes those
four tasks. **Prestige is therefore not a confound for the zone-0-14 curve**, and
the solver keeps `auto_prestige` on, matching the profile that produced the
anchor curve. (Mastery of Time's zone skip awards items and perks normally — it
routes through `doAllTaskRepsForFree` -> `progressTask` -> `onFullyFinishTask` —
so skipping loses nothing.)

**pinned100, for comparison — floor 28.2.** A pinned-pool runtime could not hit
the standalone anchor curve at all: its *floor* is four times the curve's median
gap. This independently corroborates the 2026-07-08 ruling that made
`energyBonusSync` the default (balancer targets the standalone curve against a
matching standalone runtime, and drops pin-compensation).
