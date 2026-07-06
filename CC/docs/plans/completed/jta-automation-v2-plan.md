# JtA Automation v2 — Energy Thresholds, Auto Dreamcatcher, Auto Ring, Auto Prioritize, Prestige Buy Queue

Plan for the next wave of automation features in the **journey-to-ascension submodule**
(`frontend/modules/journey-to-ascension/`, fork of meneth/journey-to-ascension, branch
`substrate`). All code references are to files inside the submodule.

> **Status (2026-07-05): all phases SHIPPED.** §3–§6 landed as SAVE_VERSION
> "Fork 1.4" (phases 1–5, 2026-07-03), plus prestige automation (Auto-Prestige,
> spark stats, purchase queue, Auto-Buy Cheapest, 2026-07-04). §7 shipped in two
> parts: the Fork 1.4 purchase queue + Auto-Buy Cheapest, then the Fork 1.5
> **Unlock Savings** repeatable-spend budget (submodule `3573865`) — see the §7
> as-shipped note. Numeric defaults were re-tuned twice: from playtest
> (`a2d1ef1`) and then from simulation sweeps (`64bd3c1`). The purchase policy
> and the defaults were selected with the **stats harness** in the outer repo —
> `CC/scripts/jta-stats/` (headless Node ≡ Playwright drivers over the committed
> `build/`), findings in `CC/scripts/jta-stats/results/SUMMARY.md`: a
> budget-capped greedy beat pure cheapest, hard saving, balance-floor reserves,
> and authored orderings on *both* time-to-first-completion and long-run Spark
> income (Spark gain is exponential in deepest zone, so fewer-but-deeper
> prestiges compound; a short prestige-stall trigger was the single worst
> setting tested). Player-facing docs: the submodule's
> `docs/automation-game-mods.md`.

## 1. Motivation

The existing automation (Game Mods, Advanced Automation panel, queue cycling, artifact
tasks — see the submodule's `docs/`) is optimized for **advancing the frontier**: once a
perk is earned the player prunes its task from the priority list. Prestige breaks this:
all perks must be re-earned, and the best XP-per-energy tasks change. Playing with
*Award Spark on Discovery* sidesteps prestige entirely, which shows the gap: we need
automation that handles the **re-climb after prestige** and, more generally, decides
*whether a task is worth its energy* without the player re-curating lists.

Ideas considered and rejected for complexity (recorded so we don't re-litigate):

- Multiple queue configurations with switch *conditions* (queue cycling already gives
  unconditional rotation; conditional switching adds a rules engine).
- A meta-queue that feeds tasks into the main queue one at a time after first success.

The accepted direction: a set of **category-aware energy-per-level thresholds** (§3)
that make a single priority list self-pruning, plus targeted auto-artifact tools
(§4 Dreamcatcher, §5 Ring), an auto-prioritizer (§6), and a prestige purchase queue
(§7). Together with the existing mods these close the loop toward full automation.

## 2. Current state (research summary)

Key facts the design builds on (verified 2026-07-03, `SAVE_VERSION = "Fork 1.3"`):

- **Scheduler chokepoint**: `pickNextTaskInAutomationQueue()` (`simulation.ts:1927`)
  walks `automation_prios.get(current_zone)` (per-zone ordered task-id list). Blocked
  tasks (`isTaskDisabledWithoutBeingFinished`) either `continue` (if
  `automation_skip_blocked`) or halt automation. **All new skip logic hooks here.**
- **Artifact start effects**: `applyTaskRepStartEffects()` (`simulation.ts:506`) runs
  `maybeAutoUseLightning()` then `maybeAutoUseHaste()` (order matters: haste's cost
  estimate sees the queued lightning), then consumes one of each queued artifact
  counter (`queued_scrolls_of_haste` → `task.hasted`, `queued_magic_rings` →
  `task.xp_boosted`, `queued_lightning` → Boss `task.lightning`). Synthetic tasks
  (`isSyntheticTask`) are excluded. **Auto Dreamcatcher and Auto Ring slot in here.**
- **Cost math**: one rep costs `calcTaskEnergyCost(task, hasted, lightning)` =
  `calcTaskTicks × calcEnergyDrainPerTick` (`simulation.ts:301`). Cost is fixed
  (`calcTaskCost`, `:216`); items/perks change *speed* (ticks), hence energy.
- **XP math**: XP is linear in progress, so a full rep grants each skill in
  `task.skills` exactly `calcSkillXp(task, calcTaskCost(task))` (`simulation.ts:66`);
  Magic Ring multiplies that by `MAGIC_RING_MULT = 5`. Level curve:
  `xpNeeded(L) = 1.02^L × 10 × xp_needed_mult` (`:103`; per-skill mult in
  `skills.ts:44`). Expected levels from a rep are therefore computable exactly by
  replaying the `addSkillXp` while-loop against current level/progress.
- **Perk state**: `GAMESTATE.perks: Map<PerkType, boolean>`; prestige sets values to
  `false` (so `knowsPerk` survives, `hasPerk` does not, `simulation.ts:2188`). "Perk
  not earned this prestige" ⇔ `!hasPerk(perk)`.
- **Task metadata** (`zones.ts:14`): `perk`, `item`, `use_item`, `unlocks_task`,
  `max_reps`, `TaskType {Normal, Travel, Mandatory, Prestige, Boss}`. Travel is
  disabled while any Mandatory/Prestige task is unfinished (`updateEnabledTasks`,
  `simulation.ts:704`).
- **Dreamcatcher** (`items.ts:293`) does **not** restore energy: on consume it adds
  one copy of every item type in `items_found_this_energy_reset` (except itself).
  Value grows the later in the run it is used.
- **No per-run task history exists.** `EnergyResetInfo` tracks only skill/power
  deltas; nothing records which tasks completed last run. Auto Ring needs new state.
- **Mods infrastructure**: `GameMods` + `defaultMods()` merged over saves
  (`simulation.ts:2371`) — old saves get new fields for free. `setMod()` coerces
  number/boolean, applies mutual exclusions. UI: `ADVANCED_AUTOMATION_TOGGLES` table
  + `setupAdvancedAutomationControls()` (`rendering.ts:2461/2489`); the canonical
  toggle-plus-numeric-input pattern is `setupAutoUseCycleControl` (`rendering.ts:2556`)
  using `createNumericInput` (`rendering.ts:37`).
- **Cycle hooks**: `doEnergyReset()` → `applyResetCycle()` (`simulation.ts:982`);
  `doPrestige()` → `resetQueueCycleForPrestige()` (`:2175`). Prestige wipes all items
  (including rings/dreamcatchers), resets skills to aptitude base.

## 3. Feature: energy-per-level thresholds (six categories)

**Player model**: "I'm willing to spend at most T% of my max energy to earn one skill
level from this kind of task. If a prioritized task is worse than that, skip it."
This makes one priority list serve the whole prestige cycle: early after prestige,
cheap tasks pass everywhere; late in a run, only worthwhile tasks run.

### 3.1 Metric

For a candidate task at decision time:

```
repCost   = calcTaskEnergyCost(task, false, false)        // unboosted; artifacts are a separate decision
expLevels = Σ over task.skills of fractionalLevels(skill, calcSkillXp(task, calcTaskCost(task), /*ignore_boost*/ true))
costPerLevel = repCost / expLevels
SKIP if costPerLevel > (threshold_pct / 100) × max_energy
```

`fractionalLevels(skill, xp)` replays the `addSkillXp` loop from the skill's current
`(level, progress)` and returns whole levels gained **plus the fractional remainder**
(`progress' / xpNeeded(level')`). The fractional part matters: high-level skills gain
<1 level per rep and a whole-level metric would divide by zero. Implement as a pure
helper `calcExpectedLevels(task): number` in `simulation.ts` next to `calcSkillXp`
(it is also reused by Auto Ring §5 and Auto Prioritize §6).

Tasks with no skills, and synthetic tasks (artifact/host-exit), are **exempt** —
never threshold-skipped.

### 3.2 Categories and classification

First match wins, in this order (a task awarding a perk AND an item is judged as a
perk task):

| # | Category (mod key suffix) | Predicate |
|---|---------------------------|-----------|
| 1 | `perk_affordable` | `perk != Count && !hasPerk(perk)` and finishing **all remaining reps** is affordable this cycle (see below) |
| 2 | `perk_unaffordable` | `perk != Count && !hasPerk(perk)`, not affordable |
| 3 | `item` | `item != Count` |
| 4 | `progression` | `type ∈ {Travel, Mandatory, Prestige}` |
| 5 | `unlocker` | `unlocks_task >= 0` |
| 6 | `other` | everything else |

**Affordability "counting items and artifacts"** (categories 1 vs 2):

```
remaining = max_reps - reps
affordable ⇔ Σ costs of remaining reps ≤ current_energy
  where up to (scrolls held + queued) reps are costed hasted,
  and for Bosses up to (lightning held + queued) reps are costed with lightning
```

Per-rep cost is constant for a task, so this is
`min(remaining, boosts) × boostedCost + rest × plainCost` — no loop over reps needed.
This deliberately mirrors the optimism of `getBossEnergyDisparityLimit()` (what your
artifacts *could* do). Held energy-restoring items (Food etc.) are ignored in v1 —
they're consumed by `autoUseItems` anyway when auto-use is on.

### 3.3 Scheduler hook

In `pickNextTaskInAutomationQueue()`, after the blocked-task branch and the
`task.enabled` check, before `return task`:

```
if (isThresholdSkipped(task)) continue;   // always skip, independent of automation_skip_blocked
```

`isThresholdSkipped(task)`: master mod on → classify category → category toggle on →
compute costPerLevel → compare to that category's threshold. Category toggle **off =
exempt** (task always eligible); this is the confirmed semantics.

Cost: the while-loop sims are a few iterations per skill; the scheduler only runs
when no task is active. No caching needed; if profiling ever disagrees, memoize per
(task, skill-levels-dirty) tick.

**End-of-run stall.** If *every* prio task is threshold-skipped, the scheduler
returns null, no energy drains, and the run stalls forever — unlike skip-on-blocked,
which eventually unblocks. Ship a companion toggle in the same panel section:

- **`threshold_end_run`** (default off): when automation is on, thresholds are
  active, at least one task was threshold-skipped this pass, and nothing was
  returned, trigger the energy reset (call the same path as energy exhaustion —
  set `is_in_energy_reset`; `auto_continue_energy_reset` then chains it). Leftover
  energy was by definition only spendable at bad rates.

Without that toggle, behavior matches pause-on-blocked: automation idles and the
player intervenes (the UI should show a "waiting: all tasks below threshold" hint on
the automation status line).

### 3.4 State and UI

New `GameMods` fields (all flat, so `setMod`'s number/boolean coercion just works):

```
threshold_master: boolean (false)
threshold_end_run: boolean (false)
threshold_<cat>_enabled: boolean ×6 (false)
threshold_<cat>_pct: number ×6 (defaults: perk_affordable 100, perk_unaffordable 25,
                                item 50, progression 100, unlocker 50, other 10)
```

Defaults are starting suggestions (generous for things you almost always want —
perks you can finish, travel — and tight for filler); they only matter once a
category is enabled, and every value has an edit box.

UI: new collapsible block **"Energy Thresholds"** inside the Advanced Automation
panel, built by a `setupThresholdControls(parent)` sibling of
`setupAutoUseCycleControl`. One master toggle row, then six rows of
`[toggle button] [category label] [numeric input %]` via `createNumericInput`
(min 1, max 1000 — >100% is meaningful early, when one level can cost more than max
energy), plus the end-run toggle. Tooltips explain each category, notably that
1 vs 2 depend on live affordability and a task can migrate between them mid-run.

Thresholds are **global**, not per-queue, in v1 (queue cycling stores plan +
item mode only). If multi-phase strategies later want per-queue thresholds, add an
optional override blob to `QueueConfig` — out of scope here.

## 4. Feature: Auto Dreamcatcher

**Decision (confirmed)**: one Dreamcatcher per qualifying task start, while copies
are held. Since qualifying starts cluster at the end of a run (costs rise relative
to remaining energy), copies drain naturally when duplication value is highest.

Implementation — `maybeAutoUseDreamcatcher(task)` in `simulation.ts`, called from
`applyTaskRepStartEffects()` **after** `maybeAutoUseLightning`/`maybeAutoUseHaste`
(so the cost estimate reflects the artifacts that will actually apply):

```
guards: mod auto_dreamcatcher on; !isSyntheticTask(task); auto_use_items on
        (same banking-cycle convention as auto haste/lightning);
        getItemCount(Dreamcatcher) ≥ 1;
        items_found_this_energy_reset has ≥ 1 non-Dreamcatcher entry (else it's a no-op waste)
trigger: calcTaskEnergyCost(task, willBeHasted, willBeLightninged)
           ≥ (mods.auto_dreamcatcher_pct / 100) × current_energy
action:  useItem(Dreamcatcher, 1); disableItemUndo();
```

Unlike haste, the effect is instant (no queued counter, no per-task flag) — the
`on_consume` in `items.ts:293` does the duplication.

State: `auto_dreamcatcher: boolean (false)`, `auto_dreamcatcher_pct: number (25)`.
UI: toggle + "Trigger at % of current energy:" numeric input (min 1, max 100),
following the `setupAutoUseCycleControl` pattern.

## 5. Feature: Auto Ring

**Decision (confirmed)**: rank tasks by expected *extra* levels if a Magic Ring (5×
XP for one rep) were used first, based on **last run's successfully completed
tasks**; spend up to all held rings on the top-ranked tasks; same
`auto_use_items` gating as the other auto-artifact tools.

### 5.1 New per-run history

New Gamestate fields (both saved; both wiped on prestige, since prestige changes the
balance *and* wipes all rings anyway):

```
run_task_history: RunTaskRecord[]        // current run, cleared each energy reset
last_run_task_history: RunTaskRecord[]   // previous run, replaced each energy reset

RunTaskRecord = { zone_id, task_id, extra_levels_if_ringed: number, completed: boolean }
```

- On **rep start** (in `applyTaskRepStartEffects`, real tasks only): compute
  `X = calcSkillXp(task, calcTaskCost(task), ignore_boost=true)` per skill and
  `extra = Σ fractionalLevels(skill, 5X) − fractionalLevels(skill, X)` from the
  *pre-rep* skill state (this is the only moment that state is observable), and
  upsert the record (`completed=false`). Keep the **max** `extra` seen for a task
  across its reps this run.
- On **rep finish** (`applyFinishTaskRepEffects`): mark the record `completed=true`.
- In `doEnergyReset()` (next to `storeLoopStartNumbersForNextGameOver`):
  `last_run_task_history = run_task_history.filter(r => r.completed)`;
  `run_task_history = []`. In `doPrestige()`: clear both.

Record count is bounded by tasks-per-run (dozens), so save-size impact is trivial.
Serialization is plain arrays of plain objects — no reviver work needed.

### 5.2 Ring plan and spending

- In `doEnergyReset()`, after item culling: `ring_plan = ` the `(zone_id, task_id)`
  keys of `last_run_task_history` sorted by `extra_levels_if_ringed` descending,
  truncated to `getItemCount(MagicRing)`. Stored on Gamestate (not saved — cheap to
  rebuild on load from `last_run_task_history` and current ring count; do that in
  `loadGame`).
- `maybeAutoUseRing(task)` in `applyTaskRepStartEffects`, before the
  haste/lightning calls (a ring changes XP, not cost, so order vs. those two is
  free; putting it first keeps the queued-ring consumption on the same rep):

```
guards: mod auto_ring on; !isSyntheticTask; auto_use_items on;
        queued_magic_rings == 0; getItemCount(MagicRing) ≥ 1;
        (zone, task) ∈ ring_plan and not already ringed this run
action: useItem(MagicRing, 1); disableItemUndo(); mark key ringed
```

One ring per planned task per run. Rings acquired mid-run beyond the plan size are
banked until the next reset's plan — acceptable v1 simplification (note in docs).
First run after prestige has no plan and no rings; the feature self-suspends.

State: `auto_ring: boolean (false)` plus the history fields above.
UI: single toggle row in `ADVANCED_AUTOMATION_TOGGLES` (no numeric input). The
tooltip should state the "based on last run" dependency explicitly.

### 5.3 Why last-run history rather than live computation

`extra_levels_if_ringed` depends on skill state *at the moment the task runs*, which
for future tasks in future zones is unknowable at decision time. Last run is the
best available predictor of both which tasks get reached and what the skill state is
when they do — exactly the user's proposed design. When priorities change between
runs the plan degrades gracefully: unmatched keys simply never fire.

## 6. Feature: Auto Prioritize

**Decision (confirmed)**: v1 is a one-click **"Auto-fill priorities"** button whose
output the player can tweak; a later phase adds an autopilot mod that re-runs it
each reset/prestige.

### 6.1 The generator

`autoFillPriorities(zone_id)` builds a fresh prio list for one zone from the zone's
task definitions (respecting `hidden_by_default` vs `unlocked_tasks`, and skipping
already-finished tasks); `autoFillAllPriorities()` loops zones `0..highest_zone` and
writes `automation_prios`, then `syncActiveQueueIfCycling()` + `saveGame()`.

Ordering heuristic (user-specified, refined):

1. **Item-awarding tasks** (`item != Count`) — resources first.
2. **Unlocker tasks** (`unlocks_task >= 0`) — open the graph early.
3. **Perk tasks** — all of them, ordered by remaining-energy-to-finish ascending.
   (Whether an unaffordable one actually runs is delegated to the §3 thresholds,
   which re-evaluate live; the generator shouldn't bake in a snapshot decision.)
4. **Remaining normal tasks** by `expectedLevels / repCost` descending (reuses
   `calcExpectedLevels`).
5. **Mandatory / Prestige** tasks.
6. **Travel** last — preserving the existing `toggleAutomation` invariant.

Ties broken by task id for determinism. Tasks with `use_item` are included; the
existing missing-item block/skip handles them at runtime.

Newly unlocked tasks mid-run: v1 does nothing special (the button can be re-clicked;
`unlockTask` already injects the task, it just isn't prioritized). The autopilot
phase hooks `unlockTask` to insert the new task at its heuristic position.

### 6.2 UI and phases

- **Phase A (button)**: "Auto-fill priorities" button at the top of the Advanced
  Automation panel (near "Edit Priorities"), with a confirm tooltip since it
  overwrites all zone lists. Works well combined with priority edit mode for
  touch-ups.
- **Phase B (autopilot)**: mod `auto_prioritize: boolean (false)` that calls
  `autoFillAllPriorities()` in `doEnergyReset()` (after `applyResetCycle`, so it
  wins) and in `doPrestige()`, plus the `unlockTask` insertion hook. **Mutually
  exclusive with `queue_cycle`** (enforced in `setMod` like
  `auto_use_cycle`/`queue_cycle`): queue cycling's whole point is hand-crafted
  per-queue plans, and autopilot would overwrite the loaded queue every reset.

With thresholds (§3) + autopilot (Phase B) + the existing auto-use/reset/cycle mods,
a run needs no manual decisions — the stated end goal.

## 7. Feature: prestige purchase queue + auto-buy (later)

Sketch only; implement after §3–§6 have burned in.

> **As shipped (deviations from the sketch below):** repeatables queue as one
> entry **per click** in click order (no `target_level` absorption — entries of
> one upgrade are independent and need not be consecutive, which makes ordering
> a finer tool than the sketch's "up to level N"). There is no
> `auto_buy_prestige` gate: the queue engine always runs while the queue is
> non-empty (an explicit queue *is* the opt-in), and the greedy default is the
> separate **Auto-Buy Cheapest** toggle. Fork 1.5 added **Unlock Savings**
> (`auto_buy_budget_enabled` / `auto_buy_budget_pct`, default off / 100%):
> unlockables are bought the moment affordable (cheapest first) and repeatable
> spending since the last unlockable purchase is capped at pct% of the cheapest
> unowned unlockable's cost (persisted counter shared by manual/queued/auto
> purchases). Chosen over alternatives by harness sweep — pure cheapest lets
> low-exponent repeatables soak Spark forever below each unlockable's price;
> hard saving and balance-floor reserves starve the repeatable engine and lose
> badly; the flow cap won on completion speed *and* long-run Spark income.

- **State**: `prestige_buy_queue: PrestigeBuyEntry[]` on Gamestate (saved,
  survives prestige — that's the point). `PrestigeBuyEntry = { kind: 'unlock' |
  'repeatable', type: number, target_level?: number }` — repeatables queue as
  "buy up to level N" so one entry can absorb multiple purchases.
- **Engine**: `processPrestigeBuyQueue()` — while the head entry is affordable
  (`divine_spark ≥ cost` via `calcPrestigeRepeatableCost` / unlock `cost`), buy via
  the existing `addPrestigeUnlock` / `increasePrestigeRepeatableLevel` and advance.
  Strictly head-of-queue (no skipping ahead to cheaper entries) so ordering is a
  real strategic tool.
- **Hooks**: after spark award in `doPrestige()`, and — important synergy with
  *Award Spark on Discovery* — after the discovery-spark award on Prestige-task
  completion, so mid-run spark can buy immediately.
- **Mod**: `auto_buy_prestige: boolean (false)` gates the engine; the queue UI
  (add/reorder/remove, shown in the Divinity popup next to each purchasable) is
  useful even with the mod off (one-click "buy when I can afford it" planning).

## 8. Cross-cutting

- **Persistence**: every new Gamestate field gets a class initializer (old saves
  keep defaults, per `loadGameFromData` semantics); every new mod lands in
  `defaultMods()` (merged over saves at `simulation.ts:2371`). No migration code.
- **Save version / changelog**: bump `SAVE_VERSION` to `"Fork 1.4"` **and** add the
  matching `changelog.ts` Fork entry in the same commit (the version/changelog
  mismatch bug was already fixed once — commit `1a69767`).
- **Docs**: extend the submodule's `docs/automation-game-mods.md` (thresholds,
  Dreamcatcher, Ring, auto-fill) as features land; new `docs/prestige-buy-queue.md`
  for §7. Keep the player/dev "code map" convention.
- **Build**: `npx tsc` after every source change; `build/` is committed.
- **Managed mode**: `saveGame()` is a no-op under `?managed`; all new state lives in
  GAMESTATE so substrate sessions behave correctly within a session, matching the
  existing mods. No bridge/API changes required; none of these features touch
  synthetic tasks (all guards exclude them).
- **window API**: new mods are reachable through the existing
  `window.getMod/setMod`; add `window.autoFillPriorities` alongside the queue API.

## 9. Phasing

Each phase = state → logic → UI → docs + changelog → `npx tsc` → manual playtest,
one commit series per phase (project convention: commit directly to the submodule's
`substrate` branch, then bump the submodule pointer in the outer repo).

| Phase | Contents | Notes |
|-------|----------|-------|
| 1 | §3 thresholds (metric helper, classifier, scheduler hook, panel section, end-run toggle) | Biggest lever for both post-prestige and general play; `calcExpectedLevels` is shared infrastructure for later phases |
| 2 | §4 Auto Dreamcatcher | Small, independent |
| 3 | §5 Auto Ring (history tracking first, then plan + spender) | History fields land here |
| 4 | §6 Phase A auto-fill button | Reuses phase-1 metric |
| 5 | §6 Phase B autopilot mod + unlockTask hook | Mutual exclusion with queue_cycle |
| 6 | §7 prestige buy queue + auto-buy | Separate design pass on the Divinity popup UI before implementing |

All six phases shipped: 1–5 as Fork 1.4 (2026-07-03/04), 6 across Fork 1.4
(queue + Auto-Buy Cheapest) and Fork 1.5 (Unlock Savings, 2026-07-05).

## 10. Open questions (non-blocking, defaults chosen)

- Threshold defaults in §3.4 are guesses; tune after a playtest with thresholds
  enabled post-prestige. **Resolved twice**: playtest tuning `a2d1ef1` (combat +
  item /rep 10%, prestige /rst 10, other /lvl 1%, rest /rst 3, stall 20), then
  sweep tuning `64bd3c1` (item /rep → 5%, the four /rst-3 categories → /rst 5,
  stall → 40; toggles all still off). The sweep also found the default
  **auto-fill order** (item-first) is ~2 runs worse than perk-first at the
  margin — left as-is pending a user ruling, since item-first was itself a
  ruling.
- Should Auto Dreamcatcher ignore the `auto_use_items` gate? Duplicated items on a
  banking cycle are still banked (half-kept via UnderstandingTheReset), so firing on
  banking cycles is arguably fine. v1 keeps the gate for consistency with
  haste/lightning; revisit if banking runs feel wasteful.
- Per-queue threshold overrides (§3.4) if multi-phase queue strategies want
  different aggressiveness per queue.
- Auto Ring mid-run ring acquisitions beyond the plan size are banked; if that feels
  wrong in play, extend the plan to `held + spent` entries dynamically.
  **Resolved**: the dynamic `held + spent` budget shipped in phase 3 — rings
  rarely survive the early-game reset cull, so a reset-time snapshot was almost
  always zero and mid-run pickups must widen the window immediately.
