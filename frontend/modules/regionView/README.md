# regionView — the shared region view model and actions

A library, not a panel (no `index.js`, no `moduleInfo`). It holds what a region view **knows** and what it **does**,
with no renderer in it, so the Region Graph (Cytoscape) and the Region Map (step 3b, canvas) give the same answers.
Report: `CC/docs/region-map/step2-view-model.md`.

| File | What | Who uses it |
|------|------|-------------|
| `regionViewModel.js` | Pure functions of (snapshot, staticData, discovery context): `isRegionReachable`, `locationState`, `locationCounts`, `regionInteriorState`, `regionColorState`, `exitState`, `regionDiscovery` / `locationDiscovery` / `exitDiscovery` (the ONE hide/placeholder decision), `displayGroupsOf` + `aggregateCounts` / `aggregateVisibility` | Region Graph (`graphDataManager.js`), `regionViewState.js` |
| `regionViewState.js` | `createRegionViewState(handles)`: subscribes to the Region Graph's triggers, recomputes at most once per animation frame, `get()` a frozen view, `subscribe`, `refresh`, `dispose` | Region Map (step 3b). The Region Graph keeps its own wiring |
| `regionActions.js` | Moves (one step, direct, the ⛓ restart step), path edits (add, overwrite), location checks (single, bulk), select/show publishes. Explicit handles in, a result out (`{ ok: false, reason: 'no-path' }`) | Region Graph (`navigationManager.js`, `graphInteractionManager.js`); Region Map (`regionMap/regionMapClicks.js`, step 4) |

## Rules

- **Nothing here imports Cytoscape, the DOM, a panel or a singleton.** Every collaborator is an argument (the
  discovery context's `discovery`, an action's `h.dispatcher`, …).
- **Reachability comes from the snapshot.** `regionColorState` is the colour a view SHOWS (an accessibility filter or
  discovery can turn it off); `isRegionReachable` is raw. The Region Graph's location nodes follow the former — the
  equivalence run showed that switching them to raw reachability changes what they show.
- **Display keys are not rules regions.** `displayGroupsOf` folds sub-regions by each substrate's
  `compositeMap.displayRegionOf` (Seedling: `level_N__rRcC` → `level_N`). A key is never a move target and never
  looked up in `staticData.regions`; act on a group's members.
- **Dispatcher senders are per module.** An action dispatches through the dispatcher it is handed, so it goes out
  under the caller's module id. A panel registers its own `user:regionMove` / `user:locationCheck` senders (and its
  event-bus publishers) in `register()`, and picks its own `source` / `originator` strings. ⚠ `loops/loopModeExemptions.js`
  treats every `source` starting with `regionGraph` or `regionMap` as a planning click; a new panel's prefix must be
  added there if its clicks should be exempt the same way.
- **Remount = dispose.** A panel that remounts calls `dispose()` on its old view state.

## Tests

`regionViewModel.test.js`, `regionViewState.test.js`, `regionActions.test.js` (it carries
`regionGraph/navigationManager.restart.test.js`'s restart cases too), and `regionGraph/regionGraphDispatch.test.js`
(the Region Graph still dispatches through its own `moduleDispatcher`, with its strings).
In-app equivalence: `node scripts/dev/region-graph-class-snapshot.mjs --port=<port> --out=<dir>`, then `diff -r`
against `CC/docs/region-map/step2-dumps/before/`.
