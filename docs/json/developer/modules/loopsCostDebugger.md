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

## One engine, two drivers, and a third caller

⚖ There is exactly **one** cost algorithm — `shared/procgen/loopCostPlanner.js`.
Everything below is a way of pointing it at a world; none of them is a model.

| Caller | Path | What it does with the plan |
|--------|------|----------------------------|
| **Cost Debugger panel** (driver) | `costDebuggerUI.js` → `loopsCostDebugger/costPlanner.js` | Load / Plan Step / Plan Sphere / Plan All / Reset / Verify. Nothing is written to the live cost store; the plan is for reading, and the panel is the algorithm's INSPECTOR. |
| **Loop mode, headless** (driver) | `loops/loopUI.js` → `_handleGenerateCostsInline()` → the same `costPlanner.js` | When a world has no cost sidecar, runs the same planner and stamps `getCostData()` into the live store via `costDataManager.setCostData(costData, 'costPlanner')`. Reached from the panel's "Generate Costs" button and from `loops/eventCoordinator.js` when loop mode is entered without cost data. ⚠ Since write-by-class, **what it stamps is the block the pipeline would have embedded**. |
| **The procgen pipeline** (third caller) | `procgenPipelineEngine.js` → `shared/procgen/loopCostGenerator.js` `generateLoopCosts()` | At BUILD time, when `enableLoopMode && embedSphereLog`: topology from `rulesJson` instead of from a state manager, then the same plan and the same write-by-class, embedded into the world's `loop_costs`. |

`scripts/procgen/check-loop-costs-one-model.mjs` is the standing proof that the
last two produce byte-identical blocks (modulo `generatedAt` / `generatedFrom`)
over five documents. A second model can only come back by RED-ing there.

## Data flow

```
                 ── THE APP ──                              ── THE BUILD ──

sphereState (raw log, all players)                       rulesJson + its sphere log
        │                                                          │
   getSphereLog()                                       topologyFromRulesJson()
        │                                                          │
stateManagerProxySingleton ─┐                                      │
  .getStaticData()          ├─→ topologyFromStaticData()           │
  .getLatestStateSnapshot() │            │                         │
procgenPlayer               │            │                         │
  .getRegionInfo() ─────────┘            │                         │
   (or documentStateManager,             ↓                         ↓
    for an H5 working copy)         the topology  {startRegion, regions, locations,
                                                   adjacency, regionSubstrates}
                                              │
                                              ↓
                          ┌─────── shared/procgen/loopCostPlanner.js ────────┐
                          │  ONE algorithm: plan the walk, price every       │
                          │  region as coarse (⚖ i)                          │
                          └──────────────────────┬───────────────────────────┘
                                                  ↓
                                     writeCostsByClass()  ← the substrate decides
                                       COARSE numbers · NATIVE nothing · SUMMARY drain
                                                  │
        ┌────────────────────┬────────────────────┴───────────────┐
        ↓                    ↓                                    ↓
  panel display        costDataManager                     the world's `loop_costs`
  (labels each         (Generate Costs / loop-mode          (generateLoopCosts, at
   number by class)     entry — the SAME block)              pipeline build time)
```

The topology is the whole seam: the pipeline builds the same shape with
`topologyFromRulesJson`, so neither side re-implements the parse and the two
provably plan the same walk. It is rebuilt on every `loadSphereLog()` and
`reset()`, which is how a rules reload or a player switch is picked up instead
of replanning against the previous world.

## The plan is not the block — and the panel says which is which

⚖ (i) The walk prices **every** region as if it were coarse, because that is how
the numbers are derived at all. `writeCostsByClass` then decides what reaches
the block, per the region's substrate. So a readout that printed the walk's
number as a price would be stating a cost nothing charges, and every cost the
panel renders is labelled by two independent facts:

| | what it answers | resolved by |
|---|---|---|
| **class** | what the BLOCK says about the region | `classifyRegions()` (shared), over the planner's own topology |
| **capture shape** | who CHARGES it at run time | `loopState.getSubstrateCaptureShape(substrateId)` — the runtime's one resolver |

| class | block entry | the panel prints | why |
|---|---|---|---|
| COARSE | `{moveCost, xpEffect}` + location costs | the number | the block's number is the price |
| NATIVE (jta, omsi) | *none* | **own economy** | the substrate runs its own mana pool; the loop queue charges nothing |
| SUMMARY (runner, bounce) | `{timeDrainPerSecond, xpEffect}` | **time-priced** | priced by how long a visit takes; a per-action cost applies only where the input block named one |

⚠ **The two axes are not the same question, and maze is why.** Maze is COARSE
(the block carries its `moveCost`) *and* FINE (`mazeRoomUI._perTileMoveCost`
divides that cost by the room's longest shortest path and charges it natively).
The panel's Simulated Queue therefore carries a **Charged by** column — *the
queue* / *the substrate* / *time (drain)* — separate from whether a cost exists.

### Sending a plan back to a document (L4)

⚖ *(user, 2026-09-06)* **"the debugger's plan comes back as ONE op"**. When the
APWorld editor hands a working copy over through its `loop_costs` door, the
payload carries an `onSave` beside the document, and the panel offers **Send
costs to the document**: one press writes `getCostData()` — the BLOCK, not the
walk — into the hub as a single document-scope `set-key loop_costs`, which the
hub applies through its own `_acceptEditorOp` (schema veto, slot stamp, undo
step) and which **one Undo there takes back out whole**.

`sendCostsRefusal({workingCopy, planner})` is the rule, pure and exported, and it
answers with a SENTENCE rather than a boolean because every refusal is a state a
person can leave:

| state | what it says |
|---|---|
| no working copy | this panel is on APPLIED state, which the app owns |
| a working copy with no `onSave` | it arrived without a way back — re-open it from the hub |
| the planner rejects the document | the planner's own sentence, quoted (it already answers *"No sphere log loaded"*) |
| a plan that is not COMPLETE | press Plan All — a partial plan's block prices some regions and silently falls back for the rest |
| otherwise | `null`, and the button is live |

The button is **hidden** on applied state (the gesture does not exist there) and
**shown-and-disabled with the reason in its `title`** once a document is adopted.

Two facts the panel states because nothing else does:

- **`generatedFrom` names the DOOR.** The planner stamps `'loopsCostDebugger'`,
  which is true of the store; a block written into a *document* is provenance
  somebody reads later, so it carries the hand-off's own source label (*"the
  APWorld editor"*) — never a file path an unsaved working copy does not have.
- **A `loop_costs` block's PRESENCE is the loop-mode switch**, so sending costs
  to a document that carried none turns loop mode ON for that world
  (`loops/index.js handleRulesLoaded` auto-enables on
  `costDataManager.isLoaded()`, i.e. `costData !== null`). The status line says
  so on a successful send, and the hub's row says it beside the block.

⛔ **The hub's schema veto cannot check the block's MEANING.** Measured at L4:
`rules.schema.json`'s `loop_costs` definition is type-only, so it refuses a
location cost that is not a number or a region entry that is not an object, and
ACCEPTS a `moveCost` on a summary region, a missing `defaultRegionXpEffect`, an
entry for a native region, and an `xpEffect` of `"banana"`. What keeps the block
right is `check-loop-costs-one-model.mjs` and `loopCostGenerator.test.js`.

### What Verify scores, and what it only reports

Verify replays each planned step through the live loop state and compares the
spend. Two rules keep that honest:

1. **A NATIVE region is charged nothing during the replay.**
   `loopState._calculateActionCost` has no `fine` branch — the runtime's shape
   test lives in its callers — so calling it directly bills a jta region the
   store's `defaultRegionCost`. Measured: before this rule, Verify scored the
   runtime wrong by up to **375.7 mana** on `omsi_substrate_test` and reported
   **1/32 within tolerance** on `jta_schedule_test`, on worlds where charging
   nothing is the design.
2. **A step is SCORED only where the block states a price** (`priced`), not
   where the queue does the charging. Scoring by the charger swallows maze,
   whose block-priced steps verify at **10/10, max delta 0.0**.

Steps the block leaves unpriced are replayed and reported — with the region's
own label — and excluded from the tally, which names how many it excluded.

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
