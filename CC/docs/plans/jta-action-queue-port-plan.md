# JtA Action Queue Port — Plan

**Date:** 2026-07-10 ·
**Status: PROPOSED — awaiting §7 rulings before any implementation.**
Source task: `CC/docs/cleanup-backlog.md` ("Port the jtaActionQueue module to
the substrate JtA", user request 2026-07-10). Feeds the Phase-6 absorption
audit of `jta-zone-randomization-plan.md` — this port is one of the "features
to absorb before deleting the old stack", and it is wanted **even if the
module remains unused** afterwards, so the queue-UI capability isn't lost
when the old March stack is retired.

Standing rulings honored (not re-opened here):

- The substrate arc's strategy — extend the game's OWN automation — stands.
  This port does not resurrect host-side automation.
- `jtaQueueEngine`'s host-side *automation* (strategy builder / drain
  autopilot) is superseded by Fork 1.4/1.5. §1.3 confirms this against the
  code and scopes the port accordingly.
- Playback: `walkTo` designates the exit; the game's own automation plays the
  zone. The queue is a *manual-play* tool beside that, not a replacement.
- The old March stack is kept until its useful features are absorbed;
  deletion is a separate future change.
- Pause-on-Block stays the game default.

---

## 1. What the old stack actually is (verified 2026-07-10)

Two modules plus a shared library, loaded only under `?mode=jta`
(`module-configs/modules-jta.json:207-218`; other modes' configs omit them).
They drive the frozen `jta-remote/game-bundle` copy of the game via the
in-iframe `jta-remote/jtaGameClient.js` (1382 lines) over namespaced
eventBus topics.

### 1.1 The queue semantics — an ordered ACTION SCRIPT

The queue is a **linear script of actions executed top-to-bottom within one
run** (one energy-reset "life"). Entry shape
(`shared/actionQueue/actionTypes.js:16-24`, `jtaQueueEngine/jtaActionDefs.js:78-89`):

```
{ entryId, actionType, actionId, label, group, zoneId, loops, disabled }
```

`actionType ∈ {clickTask, useItem, useAllItems, prestige}`. "Travel" is not a
distinct verb — it's a `clickTask` on a Travel task. Each entry repeats
`loops` times before the cursor advances; `disabled` entries are skipped.
On start an immutable `ExecutionSnapshot` is frozen ("Current" list, with
per-entry actuals: energy cost, skill gains, time); the editable "Next" list
stays live. When the script exhausts, an optional **drain strategy** repeats
a leftover task until energy runs out, then auto-resets.

### 1.2 Module split

- **`jtaActionQueue` = pure UI shell** (index.js:1-2: "all state lives in
  jtaQueueEngine"). One GL component (`jtaActionQueue`) hosting two
  sub-panels: an **Actions panel** (zone-navigated task/item/prestige
  buttons; click or drag adds an entry) and a **Queue panel** (read-only
  Current list with progress + actuals, predicted-vs-actual debug table,
  editable Next list with up/down/±loops/disable/remove/drag-reorder).
  Plus controls (Start/Stop/Next/Drain/Reset/Clear/Undo), a **loadout bar**
  (named saved queues + sequencing), and settings. The UI is inert without
  the engine — every handler calls `getEngine()` and no-ops if absent.
- **`jtaQueueEngine` = headless state owner**: `ActionQueue`,
  `LoadoutManager`, `JTAQueueExecutor` (sends protocol commands, polls
  completion at 500 ms), `JTAQueueBuilder` (auto-generates strategy queues),
  `JTAQueuePredictor` (rolls a cloned sim-state forward per entry),
  `JTAEnergyDrainStrategy`. Dependency is cleanly one-way: UI → engine.
- **`shared/actionQueue/`** (shared submodule): game-agnostic
  `ActionQueue` / `ExecutionSnapshot` / `LoadoutManager` / `actionTypes`.
  Only the JtA stack consumes it today, but it is the deliberately extracted
  reusable layer — directly relevant to the upcoming Idle Loops / Cavernous
  II substrates (both queue-driven games; the old UI plan explicitly used
  omsi-loops' queue as its reference implementation).

Persistence (host localStorage): `jta-action-loadouts` (all loadouts +
queues + sequencing), `jta-aq-settings`, `jta-aq-collapsed` (UI state).

### 1.3 Which parts are superseded — confirmed

The standing ruling holds, with a precise boundary:

- **Superseded by Fork 1.4/1.5/1.6 automation:** the *Builder* (strategy
  levels baseline/itemCollection/pushCollect generating `[Auto]` queues —
  this is host-side autopilot), the *EnergyDrainStrategy* (heuristic
  autopilot tail), and the *Predictor's* purpose (the fork's own
  `estimateResetsToComplete` is the maintained estimator; the Predictor
  imports `jta-randomizer/simulator.js` + `gameData.js`, a **stale v0.5.0 /
  27-zone re-implementation** — the fork is Fork 1.6 / 30 zones with new
  mechanics, and zone-rando patches costs at runtime, so its numbers are
  wrong against the submodule no matter what).
- **NOT superseded — the capability this port preserves:** the shared
  `ActionQueue` model, the loadout system, the two-panel editing UI, and a
  (rewritten) *executor* — a queue you can't run is just a list. The fork
  has **no equivalent** of an ordered cross-action script ("do task X ×3,
  use item Y, take exit Z"): its automation is a per-zone *priority* list
  consumed greedily by `pickNextTaskInAutomationQueue`, and its "queues"
  are something else entirely (§2.1).

### 1.4 Protocol coupling (the seam to replace)

Commands sent: `jta:requestGameDefs`, `jta:requestDetailedState`,
`jta:requestTaskStatus`, `jta:clickTask {taskId}`,
`jta:clickItem {itemType, useAll}`, `jta:doPrestige`, `jta:dismissGameOver`.
Received: the matching `*Snapshot`/`*Status`/`*Clicked` replies plus the
pushed `jta:energyDepleted`. All handled by `jtaGameClient.js:877-1322`,
which reads live game-bundle globals. Sibling old-stack modules
(`jtaArchipelago`, `jtaGameDataPanel`, `jtaCostDebugger`) share the same
client but use *different* messages (`jta:replaceGameData`,
`jta:patchTaskDefs`, instant-mode verification APIs) — they are **not** in
scope here and keep working unmodified in `?mode=jta`.

---

## 2. What the new stack already offers (verified 2026-07-10)

### 2.1 The fork's "queues" are a different concept — mismatch confirmed

A fork `QueueConfig` (simulation.ts:1537-1544) is a **saved automation-plan
snapshot**: `{name, prios: [zone, taskId[]][], artifact_tasks,
auto_use_mode, excluded_items, repeat_count}`. With the `queue_cycle` mod,
`applyResetCycle` (:1663) advances through these plans **across energy
resets** — each queue's plan becomes the live `automation_prios` for
`repeat_count` consecutive runs. It answers "which automation plan should
the next N runs use", not "perform these actions in this order now". The
fork **already ships a full in-iframe editor** for these (Advanced
Automation panel, rendering.ts:3163-3352: add/remove/rename/reorder queues,
repeat counts, auto-use modes, excluded items, edit-priorities mode), gated
by the `advanced_automation` UI mod. So re-pointing the old UI at the
fork's config-queue machinery would duplicate an existing, better-integrated
UI — and still lose the action-script capability. **The port's value is the
action-script semantics** (§4 option A1).

### 2.2 Fork window APIs available (no fork changes needed for the core)

- `performTask(taskId)` simulation.ts:4166 — programmatic task activation
  (with a guard against re-issuing while active, :4228 — re-issuing
  re-applies rep-start effects; the executor must issue once and poll).
- `useItem(itemType, useAll)` :4245; `getAvailableTasks()` :4335 (enabled +
  incomplete current-zone tasks); `getFullState()` :4185-4241 (energy, zone,
  skills, perks, items `[{type,count}]`, current-zone tasks
  `[{id,name,reps,maxReps,progress,enabled,completed}]`, `activeTaskId`,
  prestige state).
- **`window.doPrestige` does NOT exist** — the old `prestige` action type has
  no direct fork hook (completing a Prestige task only sets
  `prestige_available`). §7-R8.
- Substrate hooks (`setAutomationMode`, `ensureZoneAutomationPriorities`,
  `setInstantMode`, `stepTick`) deliberately bypass the Amulet gate — a
  driver, not the player. `performTask`/`useItem` sit in the same
  programmatic tier.

### 2.3 Bridge architecture and the pattern to follow

`bridge.js` runs **inside** the iframe with direct `window` access; host ↔
bridge traffic is eventBus topics relayed by `IframeClient`. Today the
bridge exposes **none** of the queue/action surface to the host. Two
established host→bridge command patterns exist; the right template is the
**PlaybackProxy command channel**: host publishes `jta:playbackControl
{method, args}` → bridge `_handlePlaybackControl` (bridge.js:789)
switch-dispatches to fork window calls. A queue port adds an analogous
channel (e.g. `jta:queueAction {method, args, requestId}` with reply
events), registered in the wrapper's `register()` (index.js:122-138).

**Constraint — single-slot fork callbacks:** the bridge owns
`setTaskCompletionCallback` / `setEnergyResetCallback` / etc. A ported
executor must NOT set fork callbacks; completion/reset signals must be
relayed *by the bridge* (new host-facing events, or request/response
polling like the old 500 ms `jta:taskStatus` loop).

### 2.4 Host-side static catalog already exists

`jtaSubstrateWrapper/zoneTaskData.js` — a generated snapshot of ALL zones'
task identity (id/name/type/perk/item/maxReps/hidden/unlocksTask, Fork 1.6,
regenerable via `generate-zone-task-data.mjs`). This can feed the Actions
panel's all-zones catalog with **zero protocol round-trips**. Caveats:
it has no *item-name* table (needed for `useItem` buttons — extend the
generator or relay names once from the fork), and it is a **vanilla-data
snapshot** — the Phase-5 synthetic-data arc will eventually invalidate any
static host-side table, so the catalog source should be behind a small
interface that can later switch to a live/dataset-driven source.

### 2.5 Substrate runtime facts that shape the executor

- Managed mode: host owns the clock (paused off-region), `doEnergyReset()`
  returns the fork to zone 0, and a loop reset **teleports the player to the
  start region**, pausing the game and parking any in-flight activity.
  Walks span resets by design; a queue run would face the same interruption.
- Zone transitions: the fork never calls `advanceZone()`; completing a
  Travel/exit task fires the travel callback → bridge dispatches
  `user:regionMove` → host moves the region → bridge reloads the zone and
  re-injects synthetic exit tasks (stable ids `10000 + zone×100 +
  exitIndex`). Exit tasks appear in the zone's task list — so a queue entry
  on an exit task is *naturally* how a script spans zones.
- Automation conflict: while `automation_mode != Off` the engine sets
  `GAMESTATE.active_task` every tick (simulation.ts:489) — it would fight a
  queue-issued `performTask`. The playback path already solves this shape:
  set mode for the operation, restore prior mode after.
- Persistence split: fork-side state (mods, queue_configs, priorities)
  persists in the game save blob (`incrementalGameSave_substrate`);
  host-side queue loadouts persist in host localStorage. These stay
  separate — the port adds nothing to the save blob.

---

## 3. Gap analysis — feature → disposition

| Old-stack feature | Fork/bridge equivalent today | Port disposition (recommended) |
|---|---|---|
| Ordered action script (clickTask/useItem entries, loops, disable, reorder) | **None** — this is the capability at stake | **Port** (new transport) |
| Editable Next + frozen Current snapshot w/ actuals | None | Port (shared `ExecutionSnapshot` reused as-is) |
| Loadouts + sequencing | Fork queue_configs are a different concept (§2.1) | Port host-side (localStorage), new key |
| Actions catalog (all zones) | `zoneTaskData.js` (+ item names TBD) | Re-source from zoneTaskData / bridge |
| Executor transport (`jta:clickTask` protocol → jtaGameClient) | `performTask`/`useItem` via a new bridge channel | **Rewrite seam** |
| Completion polling (`jta:taskStatus`) | `getFullState()`/`getAvailableTasks()` via bridge request-response | Rewrite (bridge relays; no fork callbacks) |
| Strategy Builder (`[Auto]` queues) | Fork automation + auto-fill/auto-prioritize | **Drop from ported path** (superseded) |
| Predictor (energy/time/skill per entry) | Fork's `estimateResetsToComplete` family (different question); old one is stale v0.5.0 sim | **Drop v1**; optional later re-source from fork build |
| EnergyDrainStrategy + auto-reset | Fork automation + threshold End-Run; substrate reset sync | **Drop** (superseded) |
| `prestige` action type | No `window.doPrestige`; prestige is auto-prestige/UI-only | Drop v1 or add fork export (§7-R8) |
| `jta:energyDepleted` → dismiss game-over | Bridge reset sync + loops reset flow already handle depletion | Executor *pauses* on reset instead (§7-R6) |

---

## 4. Design options

### A. What to port (the central question)

- **A1 — Action-script capability only (RECOMMENDED).** Port the UI + shared
  ActionQueue + loadouts + a rewritten executor that drives the fork through
  the bridge. Do NOT build a host mirror of the fork's config-queues — the
  fork's own Advanced Automation panel already covers that, in-context,
  persisted in the save. This preserves exactly the capability that would
  otherwise be lost, at minimum surface.
- **A2 — Config-queue mirror only.** Re-point the old panels at
  `getQueueConfigs`/`addQueue`/… through a new bridge relay. Rejected as the
  primary goal: duplicates an existing fork UI, loses the action script.
- **A3 — Both.** A1 now; a host config-queue mirror stays *possible* later
  over the same bridge channel (the relay method list is the only addition).
  Recommend A1 with the channel designed so A2 is a pure additive follow-up.

### B. Integration seam

- **B1 — New bridge command channel (RECOMMENDED).** `jta:queueAction
  {method, args, requestId}` → bridge handler → fork window calls; replies +
  a small set of bridge-published events (task status on request;
  reset/regionMove already exist as host events). Follows the
  playbackControl pattern; keeps bridge the single owner of fork callbacks;
  methods v1: `performTask`, `useItem`, `getStatus` (activeTaskId +
  current-zone task reps), `getItemDefs` (names, once). No fork changes.
- **B2 — Old-protocol shim.** Implement `jta:requestGameDefs` /
  `jta:clickTask` / `jta:taskStatus` / … against the fork so the old engine
  runs unmodified. Rejected: the reply shapes are v0.5.0-shaped (27-zone
  defs snapshot, skill-enum holes), the engine's Builder/Predictor would
  still import stale static data and mislead, and we'd be freezing a dead
  protocol into the new stack right before retiring its only other user.

### C. Code placement

- **C1 — In-place port with a transport seam (RECOMMENDED).** Keep
  `jtaActionQueue`/`jtaQueueEngine` as the modules; extract the executor's
  transport into an interface with two implementations: the existing
  remote-protocol one (used in `?mode=jta`, untouched behavior) and the new
  bridge one (used when the substrate wrapper is present). Builder/Predictor
  stay wired only to the legacy transport. One UI codebase; the old mode
  keeps working until retirement; the Phase-6 audit then deletes the legacy
  transport + jta-remote together.
- **C2 — Hard re-point.** Rewrite in place, old mode loses its queue.
  Simplest end-state but violates "keep until absorbed" *during* the
  transition (the port isn't proven absorbed until it works).
- **C3 — Copy to a new module** (`jtaSubstrateActionQueue`). No risk to the
  old mode, but forks 1.8k lines of UI that must then be maintained twice
  until retirement, and the retirement audit has to reconcile divergence.

### D. Engine-component disposition (follows from §1.3 — mostly settled by
the standing ruling; recorded for confirmation)

Drop from the substrate path: Builder, Predictor, EnergyDrainStrategy, and
their `jta-randomizer` imports. UI consequences: strategy/`[Auto]`-loadout
controls, the predicted-vs-actual table, and the Drain button are hidden
when running on the bridge transport (they remain functional on the legacy
transport). The Predictor *slot* stays in the engine API so a future
fork-estimator-backed implementation can fill it (`estimateResetsToComplete`
answers a different question — "resets to finish task X" — which may
actually be the more useful column in substrate play).

### E. Substrate-specific execution semantics (new questions the old stack
never faced)

- **E1 Cross-zone scripts.** Recommend: supported v1, for free — exit tasks
  are ordinary entries; completing one triggers the normal
  regionMove/zone-reload flow, and the executor continues with the next
  entry once the new zone's status shows it live. Alternative (current-zone
  only v1) rejected as it guts the "script a route" use case that made the
  queue worth having.
- **E2 Reset/teleport policy.** A depletion mid-script loop-resets and
  teleports the player off the region. Recommend v1: the executor
  **pauses** (script + cursor kept; status "paused: loop reset") and offers
  Resume; resuming requires being back on a jta region. Auto-resume on
  re-entry (walk-style parked retry) is a later opt-in — it re-opens the
  walk-arming races the bridge already solves for walkTo, and the queue is
  a manual-play tool (standing ruling: playback belongs to the game's own
  automation).
- **E3 Automation-conflict policy.** Recommend: on Start, the executor (via
  the bridge) records `getAutomationMode()` and sets Off; on
  Stop/exhaust/pause it restores. Mirrors `playbackAutomation: 'activate'`
  symmetrically. Refuse Start while a playback walk is in flight (the bot
  owns the zone then) — cheap check, avoids two drivers.
- **E4 Prestige action.** No fork hook. Options: (a) drop from the v1
  catalog (recommended — prestige in AP play has bridge-managed perk-regrant
  semantics and auto-prestige coverage; a script-issued prestige adds risk
  for little value), (b) add a `doPrestige` window export to the fork
  (small, but a fork change + parity re-run for an unused feature).

### F. Registration, visibility, persistence

- **F1 Visibility (needs ruling).** The task says "wanted even if unused".
  Recommend: register the modules in the default mode's
  `module-configs/modules.json` (+ `__BUNDLED_MODULES__` in
  `init-bundled.js`, + `moduleMetadata.js` fallback) but do **NOT** add the
  panel to the default layout preset — it stays reachable via the panel
  menu / a jta-focused layout. Alternative: keep it out of the default mode
  entirely and only prove it in tests — cheaper, but then "ported" is only
  demonstrable in the test config.
- **F2 Loadout storage key.** Old `jta-action-loadouts` entries carry
  game-bundle-era task ids and zone indices. The fork's ids largely coincide
  but synthetic exit tasks (≥10000) and Fork-1.6 data (30 zones) do not
  exist in old saves, and v0.5.0 loadouts may reference removed content.
  Recommend a separate key (`jta-action-loadouts-substrate`) — no migration.
- **F3 Panel contract.** The GL component already satisfies the
  three-registration checklist under mode jta; the port re-applies it for
  the default mode per F1. No new GL components (Actions/Queue are
  sub-panels of the one component).

---

## 5. Recommended shape (phases, contingent on §7)

Assuming A1 + B1 + C1 + D + E1/E2/E3 + E4(a) + F as recommended — **v1 is
outer-repo only (bridge + modules), zero fork changes**:

- **Phase 1 — Seam.** Bridge: `jta:queueAction` request/response channel
  (`performTask` / `useItem` / `getStatus` / `getItemDefs` / get+set
  automation mode) + topic registration in the wrapper. Engine: extract
  `QueueTransport` interface; wrap the existing protocol calls as
  `RemoteTransport` (behavior-identical in `?mode=jta` — guard: existing
  mode still works by hand-test).
- **Phase 2 — BridgeTransport + executor rework.** Completion polling on
  `getStatus`; automation off/restore; pause-on-reset (listen to the host's
  existing loop-reset/regionChanged events); cross-zone continuation on
  regionMove; Start refused during a playback walk.
- **Phase 3 — Catalog + UI trims.** Actions panel sourced from
  `zoneTaskData.js` behind a catalog interface (item names via
  `getItemDefs`); hide Builder/Predictor/Drain affordances on the bridge
  transport; new loadout key.
- **Phase 4 — Registration + docs + tests.** Default-mode registration per
  F1; an in-app substrate test (drive a 3-entry script: task ×2 → use item →
  exit task; assert reps, item count, regionMove) added to the
  **test-substrates config** (substrate tests only run there); update
  `docs/json/developer/procgen/jta.md` and the cleanup-backlog entry;
  record the absorption in the Phase-6 audit map.

Rough size: bridge ~150 lines, engine/transport ~300, UI trims ~100, test
~150. No SAVE_VERSION, no parity-harness impact (no submodule change).

---

## 6. Verification

- Legacy guard: `?mode=jta` queue still starts/runs one entry (manual
  smoke — the old stack has no automated tests; do not expand its coverage).
- New: the Phase-4 in-app test in the test-substrates config; substrate
  suite + regression stay green; `npm test -- --mode=test-substrates`.
- No claims about Predictor accuracy are carried over (component dropped).

---

## 7. Rulings sought

Answer these before implementation; recommendations restated inline.

1. **R1 — Port semantics:** action-script capability only (A1), with the
   bridge channel designed so a config-queue mirror (A2) remains a pure
   later add-on? *(Recommend A1.)*
2. **R2 — Seam:** new `jta:queueAction` bridge channel (B1) vs old-protocol
   shim (B2)? *(Recommend B1.)*
3. **R3 — Placement:** in-place with dual transport, `?mode=jta` untouched
   (C1) vs hard re-point (C2) vs parallel copy (C3)? *(Recommend C1.)*
4. **R4 — Component drops:** confirm Builder + Predictor +
   EnergyDrainStrategy are excluded from the substrate path (hidden in UI on
   the bridge transport), with the Predictor slot left open for a future
   fork-estimator column? *(Recommend yes.)*
5. **R5 — Cross-zone scripts in v1:** allowed via exit-task entries (E1) vs
   current-zone-only? *(Recommend allowed.)*
6. **R6 — Reset policy:** pause-on-loop-reset with manual Resume (E2), no
   auto-resume in v1? *(Recommend yes.)*
7. **R7 — Automation conflict:** executor forces automation Off during a run
   and restores after; Start refused while a playback walk is active (E3)?
   *(Recommend yes.)*
8. **R8 — Prestige action:** drop from v1 catalog (no fork changes) vs add a
   `doPrestige` fork export? *(Recommend drop; revisit only if a use appears.)*
9. **R9 — Visibility:** register in the default mode but keep the panel out
   of the default layout (F1), vs test-config-only? *(Recommend F1.)*
10. **R10 — Loadout key:** fresh `jta-action-loadouts-substrate` key, no
    migration of v0.5.0 loadouts (F2)? *(Recommend yes.)*

---

## 8. Fact appendix (file:line, verified 2026-07-10)

- Old entry shape / action types: `shared/actionQueue/actionTypes.js:16-24`,
  `jtaQueueEngine/jtaActionDefs.js:8-13,78-89`. Executor loop:
  `jtaQueueExecutor.js:439-476` (loops), `:676-708` (drain), 500 ms poll
  `:10,549`. Engine state owner: `jtaQueueEngine.js:36-76`; localStorage
  keys `:114,484` + `loadoutManager.js:19`. UI-inert-without-engine:
  `jtaActionQueue/index.js:612-652`.
- Old protocol: commands/replies in `jta-remote/jtaGameClient.js:877-1322`;
  defs snapshot `:751-871`; detailed state `:101-199`; `jta:energyDepleted`
  push `:355-361`. Mode gating: `modes.json:189-205` →
  `module-configs/modules-jta.json:207-218,280-282`; layout
  `layout-configs/layout_presets.json:434-459`.
- Stale data: `jta-randomizer/gameData.js` v0.5.0, `ZONES.length == 27`
  (fork: 30); Builder/Predictor import it at
  `jtaQueueBuilder.js:11-20`, `jtaQueuePredictor.js:4-19`.
- Fork queue configs: `simulation.ts:1537-1544` (shape), `:1561-1647`
  (save/load/advance/prestige-restart), `:1663` (`applyResetCycle`),
  `:3845-3856` (`queue_cycle` setMod side-effects), `:3905-3907` (GAMESTATE
  fields — persist via `saveGame` `:3490-3509` under
  `incrementalGameSave_substrate`, `getSaveLocation` `:3486`). In-iframe
  queue editor: `rendering.ts:3163-3352`; `advanced_automation` gate
  `rendering.ts:2598-2611`.
- Fork window API: `performTask` `simulation.ts:4166` (re-issue guard
  `:4228`), `useItem` `:4245`, `getAvailableTasks` `:4335`, `getFullState`
  `:4185-4241` (no queue_configs/mods/automation_prios in it), queue API
  `:4270-4331`; Amulet-gate bypass note `:4275-4278`; automation picker
  `:2851` consumed at `:489`. `window.doPrestige` absent.
- Bridge: in-iframe direct window access `bridge.js:82`; playbackControl
  handler `:789`; fork calls inventory + host events (deduct/gain mana,
  `jta:bridgeEnergyReset` `:855`, `user:regionMove` `:337`,
  `user:locationCheck` `:516`); single-slot callbacks owned at
  `:1054-1066`; host registration `jtaSubstrateWrapper/index.js:122-138`,
  PlaybackProxy injection `:188-191`.
- Host catalog: `jtaSubstrateWrapper/zoneTaskData.js` (generated, Fork 1.6,
  all zones, no item-name table).
- Panel checklist (for F1): `module-configs/modules.json` +
  `layout-configs/layout_presets.json` + `app/core/moduleMetadata.js` +
  `__BUNDLED_MODULES__` in `init-bundled.js`.
