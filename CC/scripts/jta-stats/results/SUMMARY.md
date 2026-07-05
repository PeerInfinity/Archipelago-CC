# JtA automation stats — findings (2026-07-05)

Setup: fresh save, tested play profile (all mods on except queue_cycle/instant_mode,
auto-prestige stall-only@20, When-All-Skipped = Best Task, Skip on Block, tuned
threshold defaults), instant mode, automation All to zone 99, 500-run budget.
Metric: cumulative run number at which each task in zones 1-15 first hits
reps == max_reps. "Mean run" counts a never-completed task as 501.

## Harness validation (Playwright vs plain Node)

Byte-identical `completions` / `runEnds` / `finalState` across both
environments (the sim has no `Math.random`; same module graph, same tick
math). Compute time is also the same (~8-12s for 500 runs / ~15.6k ticks);
Playwright adds ~1.5-2s of browser startup + bridge and needs the dev server.
**Use `run-node.mjs` for sweeps; keep `run-playwright.mjs` as the in-browser
fidelity check.**

## Baseline shape

- 132/134 tasks first-complete within 500 runs; mean run 86.6, median 77;
  5 prestiges; ends at highest zone 25.
- The two never-completed tasks (zone-1 Use Secret Fishing Spot, zone-2
  Training Dummy) plus the run-441 outlier (zone-8 Train at Every Guild) are
  all gated on the **SeeBeyondTheVeil** Divinity purchase — auto_buy_cheapest
  reaches it very late. The zones-1-15 completion tail is entirely a prestige
  buy-strategy question (§7 prestige buy queue), not a run-scheduling one.

## What beat the baseline (mean run over zones 1-15)

| change | mean | median | notes |
|---|---|---|---|
| combo: item /rep 5% + perk-first fill + rst 5 + stall 40 | **77.0** | 71 | best overall; only 2 prestiges, reaches zone 30 |
| item /rep 5% + perk-first fill + stall 40 | 78.9 | **67** | best median |
| item /rep 5% + perk-first fill + rst 5 | 81.5 | 71 | best without touching auto-prestige |
| item /rep 5% + perk-first fill | 82.4 | 67 | |
| threshold_item_pct 10 → 5 | 82.9 | 69 | single biggest lever |
| stall 20 → 40 | 83.7 | 77 | fewer prestiges = less re-climbing |
| perk-first auto-fill order | 83.9 | 69 | perks before items |
| /rst 3 → 5 (perk/progression/unlocker) | 85.0 | 71 | small win |
| prestige /rst 10 → 5 | 85.8 | 77 | marginal |

## What lost

- **thresholds-off: catastrophic** (65/134 completed, mean 296). The
  threshold filter is what makes the single priority list viable at all.
- All-Skipped = End Run: mean 101 (vs 77-87) — banking leftover energy loses
  to Best-Task grinding it into levels.
- Tighter stall (5/10): more prestiges (7-9), stuck re-climbing, mean 91-94.
- item /rep 2% (too strict, 87.6) and 20% (too lax, 91.4) — 5% is the sweet
  spot of the values tried.
- cycle-off 0 or 2 (vs 1): 95.7 / 92.9 — the 1-off-1-on cadence wins.
- no-ring / no-dreamcatcher / both: 87.1-87.5 — each helper is a small but
  real gain.
- prestige-first auto-fill order: no change from baseline (86.6).

## Caveats

- Single metric: first completions in zones 1-15. stall-40 configs prestige
  less (2 vs 5), which likely costs long-run divine spark income — this
  sweep does not measure spark efficiency.
- Deterministic sim: each config is one trajectory, not an average; small
  deltas (<~2 mean runs) are within butterfly-effect territory.
- 500-run budget; the two SeeBeyondTheVeil-gated tasks never complete under
  any config, penalized identically (501) everywhere.
