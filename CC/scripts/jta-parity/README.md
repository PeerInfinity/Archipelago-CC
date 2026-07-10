# jta-parity — fork vs upstream differential parity harness

Proves that the Journey to Ascension **fork** (`frontend/modules/journey-to-ascension`,
branch `substrate`) with **all of its added mods/toggles at their shipped
defaults (the "toggles all off" convention)** behaves **identically** to the
**upstream game at the fork point**, by running both engines headlessly in
lockstep through the same deterministic scenarios and comparing
gameplay-observable state **field-by-field after every single tick**.

Both sims contain no `Math.random`, no `Date.now` (grep-verified in both
versions), so the bar is **exact equality** (`===` per field), not tolerance.

## Comparison target

- Fork point: `a0057b1a0b3435dd9864f8611920546098b0af7e`
  ("The Zone name now has a tooltip which shows the highest Zone").
  Verified as `git merge-base HEAD upstream/main` inside the submodule.
- **Upstream drift: none.** As of 2026-07-10, live `meneth/journey-to-ascension`
  `main` is *exactly* the fork point commit, so fork-point == upstream HEAD.
  `fetch-upstream.mjs` re-checks this on every fetch and prints a drift note;
  if upstream ever moves, the harness still compares against the FORK POINT
  (so every difference found is fork-introduced) — update this section then.
- Fork side: the submodule's **committed HEAD** `build/` via `git archive`
  (never the working tree, which other work may be editing concurrently).
  The fork commit used is recorded in every result JSON (`forkCommit`).

## Usage

```
node CC/scripts/jta-parity/fetch-upstream.mjs        # clone + checkout fork point + npm ci + local tsc
node CC/scripts/jta-parity/run-parity.mjs            # all scenarios (each in a fresh child process)
node CC/scripts/jta-parity/run-parity.mjs --scenario automation
node CC/scripts/jta-parity/run-parity.mjs --list

# comparator canary: perturb the fork by 1e-9 at tick N; MUST report a
# divergence at exactly that tick/field and exit 1 (guards against the
# harness ever passing vacuously)
node CC/scripts/jta-parity/run-parity.mjs --scenario scripted --selftest-perturb 500
```

Upstream does not commit `build/`; `fetch-upstream.mjs` compiles it with the
clone's own `./node_modules/.bin/tsc` (from its `npm ci`), never an ambient
tsc. Everything generated lives in gitignored `upstream/`, `fork-head/`,
`results/`.

## How both engines are driven (the common surface)

Both builds are stood up with the jta-stats prior art
(`frontend/modules/jtaBalance/headlessGameEnv.js`: DOM/localStorage stubs,
`game.js` imported FIRST for the circular-import evaluation order). The fork's
convenience hooks (`initializeHeadless`, `setInstantMode`, `setMod`, …) are
**deliberately not used** — everything goes through exports that exist in
BOTH builds:

- init: `game.GAMESTATE.initialize()` (fresh state; localStorage is a stub)
- tick: `sim.updateGamestate()`, then clear `pending_render_events`
  (comparing the drained events by per-build enum NAME first)
- run end: the reset/prestige decision lives in the rendering layer in both
  games, so the driver replicates the click: `sim.doEnergyReset()` /
  `sim.doPrestige()` at `is_in_energy_reset`
- input: `sim.clickTask(task)`; automation via the game's own **pre-fork**
  feature: `sim.toggleAutomation(def)`, `sim.setAutomationMode(All)`,
  `sim.setAutomationEndZone`, `GAMESTATE.automation_skip_blocked`
- Divinity purchases: driver-side greedy-cheapest over
  `addPrestigeUnlock` / `increasePrestigeRepeatableLevel` (the fork's
  auto-buy is a mod, default off; upstream has none)

Policies are deterministic, applied per-engine with no cross-engine reads.
Each scenario runs in a fresh child process: both sims keep mutable
module-level state and upstream has no external way to rebuild `GAMESTATE`,
so process-fresh is the only provably symmetric reset. Timers are neutered
(`setInterval` stubbed) so `setTickRate()` can never tick an engine outside
the lockstep.

Idle forcing: when nothing changes for 50 ticks (automation dry / no task —
no energy drain, no run end; the real game waits for a click), the driver
flips `is_in_energy_reset` on BOTH engines, replicating the player's reset
click. Off in the `idle` scenario.

## The comparison projection

Explicit field list, all present in both builds (see `project()` in
`run-parity.mjs`): zone/progression (`current_zone`, `highest_zone*`,
`is_in_energy_reset`, `is_at_end_of_content`, `is_in_zone_skip`), energy
(`current_energy`, `max_energy`, `energy_reset_count`), `active_task` and all
`tasks` (id/progress/reps/enabled/hasted/xp_boosted/lightning),
`unlocked_tasks`, skills (type/level/progress/speed_modifier),
`unlocked_skills`, reset-start snapshots, perks, items, `used_items`,
`items_found_this_energy_reset`, `undo_item`, queued item counters, `power`,
`has_unlocked_power`, `attunement`, all prestige state (available/count/
highest zone/spark/unlocks/repeatables/layers), the common
`energy_reset_info` fields, player toggles (`repeat_tasks`, `auto_use_items`,
`manual_tooltips`), automation state (mode/end/skip_blocked/prios), and the
hint counters. Render events are compared each tick as well (by enum name +
context).

Compared after **every tick**, after every policy action, after setup, and
after every reset/prestige boundary. On divergence the harness pins the first
divergent tick, phase, and field paths, then watches ~300 more ticks to
classify it transient (re-converged) vs persistent.

**Fork-only fields are reported, not hidden**: each result JSON lists every
`GAMESTATE` key the fork added (with end-of-scenario values) plus any
upstream-only keys (none), and `staticData` proves the task/zone/skill/
prestige definitions are value-identical (the fork's only task-def addition
is the substrate `free` flag, `false` on every real task). If a fork-only
field influenced any projected field with mods off, the per-tick equality
check is what would catch it.

Every PASS carries an activity floor (`minTicks`, `minResets`) — a scenario
that under-runs its floor is marked VACUOUS and fails, so no claim rests on
zero ticks.

## Scenarios and results (2026-07-10, fork `d0e41aa`, upstream `a0057b1`)

| scenario | drive | ticks | resets | prestiges | result |
|---|---|---|---|---|---|
| `idle` | no input at all | 2,000 | 0 | 0 | **PASS** |
| `scripted` | scripted click-through (first enabled non-Travel task, then Travel) | 2,517 | 25 | 0 | **PASS** |
| `automation` | scripted until the Amulet perk (earned tick 9,136), then the game's own automation self-plays; auto-use items on | 31,304 | 200 | 0 | **PASS** (reaches zone 6) |
| `forced-prestige` | SYNTHETIC: scripted play, `doPrestige()` forced at boundaries 3 and 6, first prestige layer opened, greedy Divinity purchases | 808 | 6 | 2 | **PASS** |

**Verdict: PASS — no divergence found on any tick of any scenario.**
Aggregate report: `results/parity-report.json`; per-scenario details in
`results/<name>.json`.

## Confirmed-inert fork deltas (expected, and verified inert with mods off)

- **The whole GameMods system**: every boolean mod defaults `false`
  (`forkModDefaults` is snapshotted into each result as proof). Numeric mod
  defaults (e.g. the auto-prestige stall 40→20 retune,
  `auto_prestige_stall_resets: 20`) are only read when their toggle is on.
- **Instant mode** (`instant_mode` / `window.setInstantMode`): off; never used.
- **Init-order fix**: fork runs `initializeSkills()` before `resetTasks()`;
  upstream's order produces ~32 "Couldn't find skill" log lines per fresh
  init (the harness counts and suppresses them —
  `suppressedUpstreamSkillSpam`). Post-setup state is identical anyway.
- **Substrate/AP hooks** (`applyTaskPatches`, `grantPerk`,
  `setTaskCompletionCallback`, `setPerkCategoryTaskIds`, `setCostedTaskIds`,
  `setTaskFirstStartCallback`, managed-mode save slot, synthetic task
  injection): callbacks are no-ops unless registered; managed mode only via
  `?managed=1`; none engaged here.
- **`TaskDefinition.free`** (fork-only field): `false` on every real task;
  only synthetic injected tasks set it.
- **Fork-only `GAMESTATE` bookkeeping** (`jta_starting_energy_bonus`,
  `run_task_history`, `queue_configs`, `peak_spark_per_reset`,
  `prestige_buy_queue`, `auto_fill_order`, …): enumerated per run in
  `gamestateFields.forkOnly`; none influenced projected state.
- **`updateGamestate` additions**: peak-spark tracking (fork-only field),
  `processPrestigeBuyQueue` (queue only fills via UI), `maybeAutoBuyCheapest`
  (gated on the `auto_buy_cheapest` mod, off).
- **zones.ts `rebuildZoneDerivedMaps` refactor**: structural only — static
  data compare proves value-identical definitions.
- **Three fork-added `EventType` members** appended before `Count`
  (`AwardedSparkOnDiscovery`, `ThresholdStall`, `AutoPrestiged`): existing
  numbering unchanged; never emitted with mods off (render-event comparison
  would catch them).
- **`SAVE_VERSION`** `"1.1.1"` → `"Fork 1.6"`: save-file metadata, not
  gameplay-observable (and saves go to a stubbed localStorage here).

## Known coverage limits (what a stronger claim would need)

- Real (non-synthetic) prestige: the first Prestige-type task sits in zone 14;
  unmodded non-instant self-play reaches zone 6 in this budget. The prestige
  code path is exercised via the labeled-synthetic `forced-prestige` scenario
  instead (the sim does not gate `doPrestige()`).
- Manual item clicks (`clickItem` / `undoItemUse`) are not scripted;
  item USE is covered via the pre-fork `auto_use_items` toggle in the
  `automation` scenario, item acquisition everywhere.
- End-of-content / zones beyond 6, Mastery of Time's `skipFreeZones`, and the
  deeper prestige layers are not reached under unmodded pacing.
- Enabling any fork mod is out of scope by design (the claim is about shipped
  defaults).
