# JtA automation stats — findings (2026-07-05, rev 2)

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

## Suggested in-game mod shape (not yet implemented)

Extend auto_buy_cheapest with one numeric knob (e.g.
`auto_buy_unlock_budget`, default 1.0): track repeatable spending since the
last unlock purchase; skip repeatables whose cost would push that spending
past budget × (cheapest unowned unlock's cost) while any reachable unlock
remains. 0 = hard save (bad), large = today's pure greedy. The explicit
purchase queue stays the manual override, exactly as now.

## Round 3 — long-run spark income (income-comparison.md)

The round-1/2 caveat ("low-prestige winners may cost long-run income") is
**refuted**: 1000-run trajectories with exact earned-spark accounting show
the completion winners winning income at every horizon. Spark gain is
exponential in the deepest zone reached, so fewer-but-deeper prestiges
compound: at run 1000, combo + spendCap has earned ~18.7 quadrillion vs
~8.8q for baseline (2.1×), and it leads at run 200, 300, 500, 750 too.
Frequent prestiging (stall 5) is catastrophic — 68k TOTAL at run 1000,
eight orders of magnitude behind, stuck at lifetime zone 20.

## Caveats

- Deterministic sim → each config is one trajectory; deltas under ~2 mean
  runs are noise-equivalent (butterfly effects).
- Divine Speed's real-time benefit is invisible in instant mode (it speeds
  wall-clock ticks, explicitly not energy use).
