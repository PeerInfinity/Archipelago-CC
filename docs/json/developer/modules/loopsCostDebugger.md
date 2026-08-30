# Loops Cost Debugger Module

**Module ID:** `loopsCostDebugger`

**Purpose:** Plan loop-mode mana costs one action queue at a time from a sphere
log, showing the reasoning behind every assignment, and verify an existing cost
sidecar against the same formula. It is a *debugger*, not the production cost
generator — see the [loop-cost engine disambiguation](../procgen/gotchas.md#three-loop-cost-engines-one-store)
for how it differs from `loops/costGenerator.js` and
`shared/procgen/loopCostGenerator.js`.

## Key Files

- `frontend/modules/loopsCostDebugger/index.js` — registration, the `CostPlanner`
  singleton, and `getSphereLog()`
- `frontend/modules/loopsCostDebugger/costPlanner.js` — the planning engine
  (pure; no DOM, no game engine)
- `frontend/modules/loopsCostDebugger/costDebuggerUI.js` — the panel
- `frontend/modules/loopsCostDebugger/costDebugger.css` — panel styles

## Two consumers

| Consumer | Path | What it does with the plan |
|----------|------|----------------------------|
| **Cost Debugger panel** | `costDebuggerUI.js` | Load / Plan Step / Plan Sphere / Plan All / Reset / Verify. Nothing is written to the live cost store; the plan is for reading. |
| **Loop mode, headless** | `loops/loopUI.js` → `_handleGenerateCostsInline()` | When a world has no cost sidecar, runs the same planner and stamps the result into the live store via `costDataManager.setCostData(costData, 'costPlanner')`. Reached from the panel's "Generate Costs" button and from `loops/eventCoordinator.js` when loop mode is entered without cost data. |

## Data flow

```
sphereState (raw log, all players)  ─┐
                                     ├─→ getSphereLog()  →  CostPlanner.loadSphereLog()
stateManagerProxySingleton           │        (raw JSONL entry shape)         │
  .getStaticData()  (this player) ───┘                                        │
                                                                              ↓
                                                       plan steps  →  getCostData()
                                                                       │        │
                                                       panel display ──┘        └── costDataManager (headless path only)
```

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
