# Loops Cost Debugger Module

**Module ID:** `loopsCostDebugger`

**Purpose:** Plan loop-mode mana costs one action queue at a time from a sphere
log, showing the reasoning behind every assignment, and verify an existing cost
sidecar against the same formula. It is a *debugger*, not the production cost
generator — see [one loop-cost engine, one store](../procgen/gotchas.md#one-loop-cost-engine-one-store--and-the-debugger-is-its-inspector)
for how it relates to `shared/procgen/loopCostGenerator.js`. ⚠ Its `costPlanner.js`
is nevertheless what the **runtime** runs for Generate Costs and for the
auto-generate on entering loop mode.

⚖ **Since 2026-09-06 it carries no algorithm of its own.** `costPlanner.js`
extends `shared/procgen/loopCostPlanner.js` — the one cost model, which the
procgen pipeline drives too — and supplies only what a pure module cannot know:
the state manager (turned into a topology), the player id via `sphereState`, and
each region's substrate via `procgenPlayer.getRegionInfo`. Its `getCostData()`
applies the same write-by-class rule the pipeline does, so **what Generate Costs
stamps into the store is the block the pipeline would have embedded**;
`scripts/procgen/check-loop-costs-one-model.mjs` asserts that over five
documents. Before that it was a second, disagreeing model.

## Key Files

- `frontend/modules/loopsCostDebugger/index.js` — registration, the `CostPlanner`
  singleton, and `getSphereLog()`
- `frontend/modules/loopsCostDebugger/costPlanner.js` — the app-side DRIVER of
  the shared model (no DOM, no game engine); the model is
  `shared/procgen/loopCostPlanner.js`
- `frontend/modules/loopsCostDebugger/documentStateManager.js` — a rules.json
  working copy wearing the state manager's face (H5), and the source of the
  region → substrate map for a document the app has never applied
- `frontend/modules/loopsCostDebugger/costDebuggerUI.js` — the panel
- `frontend/modules/loopsCostDebugger/costDebugger.css` — panel styles

## Two consumers

| Consumer | Path | What it does with the plan |
|----------|------|----------------------------|
| **Cost Debugger panel** | `costDebuggerUI.js` | Load / Plan Step / Plan Sphere / Plan All / Reset / Verify. Nothing is written to the live cost store; the plan is for reading. |
| **Loop mode, headless** | `loops/loopUI.js` → `_handleGenerateCostsInline()` | When a world has no cost sidecar, runs the same planner and stamps the result into the live store via `costDataManager.setCostData(costData, 'costPlanner')`. Reached from the panel's "Generate Costs" button and from `loops/eventCoordinator.js` when loop mode is entered without cost data. |

## Data flow

```
sphereState (raw log, all players) ──→ getSphereLog() ──→ CostPlanner.loadSphereLog()
                                          (raw JSONL entry shape)          │
stateManagerProxySingleton ─┐                                              │
  .getStaticData()          ├─→ topologyFromStaticData() ─→ the topology ──┤
  .getLatestStateSnapshot() │      {startRegion, regions, locations,       │
procgenPlayer               │       adjacency, regionSubstrates}           │
  .getRegionInfo() ─────────┘                                              ↓
                                          shared/procgen/loopCostPlanner.js
                                                  plan steps  →  getCostData()
                                                     │             (write by class)
                                     panel display ──┘        └── costDataManager
                                                                  (headless path only)
```

The topology is the whole seam: the pipeline builds the same shape with
`topologyFromRulesJson`, so neither side re-implements the parse and the two
provably plan the same walk. It is rebuilt on every `loadSphereLog()` and
`reset()`, which is how a rules reload or a player switch is picked up instead
of replanning against the previous world.

`getSphereLog()` prefers `sphereState.getRawSphereLog()` — the literal parsed
entries, every player's slice intact, which the planner then filters itself. A
*verbose*-format log's raw entries carry cumulative `inventory_details` rather
than the incremental `new_inventory_details` the planner reads, so those fall
back to a cumulative→delta reconstruction from `getSphereData()` (current player
only). Both produce the same entry shape.

## Player-slice semantics

The planner works on **one player's slice of a multiworld log against one
player's static data**, and that is sound: per-player slices are computed
against the full multiworld fill (`exporter/sphere_logger.py`). Spheres are
multiworld playthrough spheres, `sphere_locations` filters by *location* owner,
and `base_items` filters by *item* owner — so items received from other worlds
are included and the cross-player dependencies are already baked into the sphere
ordering. Single-player planning needs no cross-player reasoning of its own.

What is *not* sound is planning the **wrong** player. The failure is silent by
nature: a log with no slice for the loaded player yields zero entries, and a log
for the wrong seed yields entries whose locations are all absent from this
player's static data. Either way the planner still emits a complete
defaults-only cost set. The module therefore reports, rather than absorbs, each
mismatch:

- The player id comes from `sphereState.getCurrentPlayerId()`, falling back to
  `staticData.playerId`; there is **no** fallback to player 1. With neither
  available, extraction refuses by name.
- `getLogDiagnostics()` records the resolved id, the players the log actually
  contains, and how many `state_update` entries matched — the panel surfaces
  "available players: [...]" when the count is zero.
- `getSkippedForeignEntries()` counts sphere-log locations missing from this
  player's world; the panel warns on any, and loudly when it is all of them.
- `getPlanRejectionReason()` returns a single human-readable cause (or null).
  **The headless path must call it and refuse to `setCostData` when it is
  non-null** — that is the only thing standing between a mismatch and a wrong
  cost set installed as if it were real.
- Planning guards (10000 steps for `planAll`, 1000 for `planCurrentSphere`)
  record a truncation instead of reporting a complete plan.

The panel marks a loaded plan stale on `sphereState:dataLoaded` (a player switch
re-slices the retained log) and on `stateManager:rulesLoaded`; `reset()`
re-derives the entries, the start region and the adjacency map so a replan never
uses the previous world's topology.

## Public Functions

Registered with `centralRegistry`:

| Function | Returns | Description |
|----------|---------|-------------|
| `getCostPlanner()` | `CostPlanner\|null` | The shared planner instance (also `window.costPlanner`) |
| `getPlannedSteps()` | `Array` | Steps planned so far |
| `getCostData()` | `Object\|null` | The cost set the current plan implies |
| `getSphereLog()` | `Array\|null` | Sphere log in raw JSONL entry shape |

## Events Published

| Event | Data | Description |
|-------|------|-------------|
| `loopsCostDebugger:stepPlanned` | `{ step, stepIndex }` | One action queue planned |
| `loopsCostDebugger:allPlanned` | `{ steps, total, truncated }` | `planAll()` finished; `truncated` is non-null when a guard cut it short |
| `loopsCostDebugger:reset` | `{}` | Planner returned to its pre-planning state |
