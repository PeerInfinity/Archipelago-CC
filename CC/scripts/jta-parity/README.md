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

## UI parity (`run-ui-parity.mjs`)

Verifies the fork's UI looks the same as upstream on a FRESH page load,
modulo the documented exclusions below.

```
node CC/scripts/jta-parity/run-ui-parity.mjs      # needs the :8000 dev server
```

Both sides are served by the already-running repo dev server on :8000 (the
script checks and refuses to start a duplicate): upstream from `upstream/`
(fork-point clone, compiled by `fetch-upstream.mjs`), the fork from
`fork-head/` — the submodule's **committed HEAD, full tree**, re-extracted
via `git archive` on every run. So re-checking after the submodule pointer
advances (e.g. once the in-flight prestige-popup gating fix lands) is just a
re-run. The live submodule path is never loaded (its working tree carries
uncommitted changes).

Four views per side, each in a fresh Playwright context (clean localStorage,
fixed 1440x1050 viewport): `main`, `settings-open`, `stats-open`, and
`prestige-open` (the hidden `#open-prestige` button is clicked
programmatically — the open handler is not gated in either build; flagged
`syntheticOpen` in the report). Per view:

- **DOM structural diff** — both trees serialized identically (tag + sorted
  attributes + collapsed text; scripts/comments dropped) and diffed three
  ways: **raw** (no exclusions — classification input, nothing hidden),
  **clean** (exclusion list applied — the pass/fail signal), **residual**
  (exclusions + known-pending). Serializations and unified diffs land in
  `results/ui/`.
- **Screenshot pixel diff** — exact RGBA compare with pink masks over the
  excluded elements only. Differing pixels are split into the excluded
  elements' union footprint (orange in the diff image — the approved delta
  changes the Settings box size, so the two masks legitimately cover
  different areas) and everything outside (red — must be zero or noise).
  Both screenshots + diff image + pixel counts are saved.
- A **self-stability probe** (same page serialized twice, 700ms apart, game
  loop running) guards against tick-volatile DOM being misread as a fork
  difference. Fresh-load DOM is static.
- **Renderer noise**: even with determinism flags (`--disable-gpu`,
  `--disable-lcd-text`, srgb, no font hinting), the SAME page screenshotted
  twice occasionally differs by a few dozen pixels (channel deltas <= ~20) —
  measured as a per-view noise floor, and any outside-region diff must
  additionally REPRODUCE across up to 3 fresh screenshot pairs before it can
  be called UNEXPECTED; transient jitter vanishes on retake. A real UI
  difference reproduces identically.

### UI exclusion list (complete)

| entry | kind | justification |
|---|---|---|
| `#settings` subtree | excluded-intentional | Settings popup: user-approved fork additions — the "Game Mods" section (7 controls, all rendering "Off"/defaults) plus a `.scroll-area` wrapper around the popup's pre-existing content. Static `index.html` delta. This is the ONLY DOM exclusion. |
| `#prestige-box` subtree | known-pending (prestige-open view only) | Fork's `populatePrestigeView` Divinity additions (purchase queue / Auto-Buy controls) were expected to be ungated on committed HEAD; a gating fix is in flight. See observation below — on a fresh load they do not render at all. Re-run after the submodule pointer advances. |

### UI results (2026-07-10, fork `d0e41aa`, upstream `a0057b1`)

| view | DOM raw diff | DOM after exclusions | pixels outside excluded regions | verdict |
|---|---|---|---|---|
| main | 55 lines (all `#settings`) | **0** | 0 (transient noise vanished on retake) | PASS |
| settings-open | 55 lines (all `#settings`) | **0** | 0 (excluded footprint ~107k px = the approved bigger box; noise vanished on retake) | PASS |
| stats-open | 55 lines (all `#settings`) | **0** | 0 (transient noise vanished on retake) | PASS |
| prestige-open | 55 lines (all `#settings`) | **0** | 0 (pixel-exact) | PASS |

**UI verdict: PASS — identical modulo the single documented Settings-popup
exclusion.** Report: `results/ui/ui-parity-report.json`.

**Prestige-popup observation:** the fork's Divinity queue/auto-buy controls
did NOT appear — `populatePrestigeView` gates them behind
`GAMESTATE.prestige_layers_unlocked.length > 0` (rendering.ts), and a fresh
game has no layers unlocked, so the popup renders byte-identically to
upstream (DOM raw diff over the whole page: only the `#settings` lines;
pixels exact). The known-pending `#prestige-box` entry therefore had nothing
to absorb on this HEAD; it stays in the harness so the post-gating-fix re-run
reports through the same channel. A deeper check (popup on a save WITH
unlocked layers) would need a progressed save and is out of scope for the
fresh-load claim.

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
