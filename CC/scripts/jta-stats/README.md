# jta-stats — JtA automation statistics harness

Measures, for every task in the first N zones of Journey to Ascension
(`frontend/modules/journey-to-ascension`, branch `substrate`), the cumulative
run number at which the task is FIRST fully completed (reps == max_reps),
under a configurable automation profile. Used to A/B automation settings.

## Files

- `driver.mjs` — environment-agnostic measurement loop. Drives
  `sim.updateGamestate()` directly under instant mode; replicates the
  rendering layer's run-end branch (`maybeAutoPrestige()`, else
  `doEnergyReset()`); counts cumulative runs in the driver because
  `energy_reset_count` zeroes on prestige. Exports `baselineMods()` (the
  tested play profile) and `runFirstCompletionStats(env, options)`.
  **`baselineMods()` is spark-OFF since 2026-07-06**: the game's own
  default for `award_spark_on_discovery` is false, and it being on in
  every earlier sweep contaminated Rounds 1–4 (see SUMMARY.md validity
  caveat). Spark-on runs are now an explicit
  `modOverrides: { award_spark_on_discovery: true }`.
- `node-env.mjs` — shared plain-Node environment: DOM stubs + build-module
  loading in the browser's evaluation order (used by `run-node.mjs` and
  `profile-vanilla.mjs`).
- `run-node.mjs` — plain-Node bootstrap over `node-env.mjs`. Fast path for
  sweeps; no server needed.
- `profile-vanilla.mjs` — Phase 0 of the zone-randomization plan
  (`CC/docs/plans/jta-zone-randomization-plan.md`): static structural profile
  of the vanilla data (tasks/zones/skills/perks/unlock chains, cost
  distributions) + a tuned-defaults playthrough per variant (standalone /
  pinMaxEnergy=100) collecting reset-gap pacing, perk-milestone spacing,
  skill trajectories, and `estimateResetsToComplete`-vs-actual calibration
  (via the driver's `onRunBoundary` hook). Writes
  `results/vanilla-profile.json`, per-variant `vanilla-profile-raw-*.json`,
  and `results/VANILLA-PROFILE.md`.
- `run-playwright.mjs` — real-browser bootstrap against
  `http://localhost:8000/frontend/modules/journey-to-ascension/index.html`
  (fresh save via `localStorage.clear()`), running the same driver in-page.
  Fidelity check; results are byte-identical to the Node path.
- `experiments.mjs` — sweep runner: writes `configs/<name>.json`, runs each
  config in a fresh process, regenerates `results/comparison.md`.
- `report.mjs` — one result file → per-task table; many → comparison.
- `results/SUMMARY.md` — findings write-up.

## Usage

```
node CC/scripts/jta-stats/run-node.mjs                       # baseline, 500 runs
node CC/scripts/jta-stats/run-node.mjs --config CC/scripts/jta-stats/configs/stall-40.json
node CC/scripts/jta-stats/run-playwright.mjs                 # needs dev server on :8000
node CC/scripts/jta-stats/experiments.mjs                    # full sweep
node CC/scripts/jta-stats/experiments.mjs --only baseline,stall-40 --max-runs 100
node CC/scripts/jta-stats/report.mjs results/*.json > results/comparison.md
node CC/scripts/jta-stats/profile-vanilla.mjs                # Phase 0 profile, both variants
node CC/scripts/jta-stats/profile-vanilla.mjs --max-runs 500 --zone-limit 15
```

Config JSON: `{ "name": "...", "options": { "modOverrides": {...},
"autoFillOrder": [...], "maxRuns": 500, "zoneLimit": 15,
"purchasePolicy": {...}, "pinMaxEnergy": 100,
"excludeTaskIds": [...], "gameDataPatch": [...] } }` — `modOverrides` are
deltas on top of `baselineMods()`; `mods` replaces the profile wholesale.
`excludeTaskIds` removes tasks from the metric universe — used by the
zone-limited spark-off configs to drop the four SBtV-gated hidden tasks
(ids 17/28/88/158, no in-game unlocker; unobtainable without discovery
spark or a prestige-scale horizon). Full-game (zoneLimit 30) runs keep
them in: prestige spark buys SeeBeyondTheVeil eventually and their timing
is real tail signal.

`experiments.mjs` runs the current spark-off rounds by default; the
spark-on-era entries (Rounds 1–4 + defaults tuning) live in
`LEGACY_EXPERIMENTS` and only run with `--legacy` (or by name via
`--only`), with `award_spark_on_discovery: true` injected so re-runs
reproduce the historical numbers. `--report FILE.md` names the comparison
output (default `comparison.md`).
`pinMaxEnergy` emulates jta-substrate play: max_energy re-clamped to the
value at init and after every reset/prestige, the way the substrate bridge
pins energy to the shared loop-mode pool (see results/SUMMARY.md Round 4).

`gameDataPatch` applies field-level task-def patches through the fork's
`window.applyTaskPatches` hook once after init (array of `{id, ...fields}`
or a `{[id]: {...fields}}` map; fields: `cost_multiplier`, `xp_mult`,
`max_reps`, `hidden_by_default`, `unlocks_task`, `perk`, `item`). This is
the same Tier-1 delivery the substrate bridge uses (patches ride each
region's sidecar), so the harness can measure pacing under
randomized/rebalanced game data. Patches mutate the static defs and never
reset, so they persist across every simulated run; a patched `max_reps`
is reflected in the first-completion metric universe.

`purchasePolicy` swaps the sim's auto_buy_cheapest for a driver-side Divinity
buy strategy (see `makePurchasePolicy` in driver.mjs): `{kind:"cheapest"}`
(control), `{kind:"unlocksFirst"}`, `{kind:"reserve", f}`,
`{kind:"spendCap", g}` (winner — flow cap on repeatable spending between
unlocks), `{kind:"levelCap", cap}`, `{kind:"tiers", list:[...]}`. Results
gain a `purchases` timeline (run each unlock was bought).

## Gotchas (learned building this)

- **Skip on Block is required** (`options.skipBlocked`, default true; it's a
  GAMESTATE automation-panel setting, not a mod). With the game's default
  Pause on Block, the priority walk returns null forever at the first
  blocked task (too-strong boss) and the run never ends.
- The driver clears `GAMESTATE.pending_render_events` every tick: nothing
  drains it headlessly and `saveGame` serializes the whole gamestate
  (queue included) on every instant completion.
- The sim restarts the interval game loop via `setTickRate()` (zone advance,
  prestige) even after `pauseGameLoop()` — the driver re-pauses on exit and
  `run-node.mjs` must `process.exit(0)`.
- Node must import `build/game.js` FIRST (the page's entry module) so the
  circular game/simulation/rendering imports evaluate in the browser's order.
- Zone-1 Use Secret Fishing Spot / zone-2 Training Dummy / zone-8 Train at
  Every Guild only unlock via the SeeBeyondTheVeil Divinity purchase.
- **Mastery of Time's `skipFreeZones()` completes skipped zones' tasks
  INSIDE doEnergyReset/doPrestige** — on transient task arrays a per-tick
  scan never sees. The driver reconstructs these at the run boundary
  (`viaZoneSkip: true` completions): after the run-end action, every
  universe task below current_zone is complete unless it's a hidden task
  whose unlock isn't owned.
- `active_task` is null at the end of EVERY tick under instant mode — it is
  not an idle signal. Idle (end of content: last zone done, real game waits
  for a click) is detected as 50 ticks with zone+energy+reps all unchanged,
  then the driver forces the run-end branch.
