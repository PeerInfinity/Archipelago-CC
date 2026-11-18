# regionView — the shared region view model and actions

A library, not a panel (no `index.js`, no `moduleInfo`). It holds what a region view **knows** and what it **does**,
with no renderer in it, so the Region Graph (Cytoscape) and the Region Map (step 3b, canvas) give the same answers.
Report: `CC/docs/region-map/step2-view-model.md`.

| File | What | Who uses it |
|------|------|-------------|
| `regionViewModel.js` | Pure functions of (snapshot, staticData, discovery context): `isRegionReachable`, `locationState`, `locationCounts`, `regionInteriorState`, `regionColorState`, `exitState`, `regionDiscovery` / `locationDiscovery` / `exitDiscovery` (the ONE hide/placeholder decision), `displayGroupsOf` + `aggregateCounts` / `aggregateVisibility` | Region Graph (`graphDataManager.js`), `regionViewState.js` |
| `regionViewState.js` | `createRegionViewState(handles)`: subscribes to the Region Graph's triggers, recomputes at most once per animation frame, `get()` a frozen view, `subscribe`, `refresh`, `dispose` | Region Map (step 3b). The Region Graph keeps its own wiring |
| `regionActions.js` | Moves (one step, direct, the ⛓ restart step), path edits (add, overwrite), location checks (single, bulk), select/show publishes. Explicit handles in, a result out (`{ ok: false, reason: 'no-path' }`) | Region Graph (`navigationManager.js`, `graphInteractionManager.js`); Region Map (`regionMap/regionMapClicks.js`, step 4) |
| `clickActions.js` | The click-action registry: which named actions a click on a region or a location RUNS, per panel. `registerClickAction` / `unregisterClickAction` / `listClickActions`, `runClickActions`, the built-in path actions, `migrateRegionGraphClickKeys` / `defaultClickActions` | Nobody yet (mode-toggle slice CA-S1). The Region Graph adopts it in CA-S2, the Region Map in CA-S3 |

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
  treats every `source` starting with `regionGraph`, `regionMap` or `regionView-path` as a planning click. A panel
  that routes its clicks through `clickActions.js` needs no prefix of its own (below); one that dispatches moves
  itself must add its prefix there if its clicks should be exempt the same way.
- **Remount = dispose.** A panel that remounts calls `dispose()` on its old view state.

## Click actions (`clickActions.js`)

What a click on a map panel DOES is a list of named **actions**, owned by panels, and a per-panel settings object
saying which of them a click runs. It replaces the Region Graph's seven "On Region Node Click" checkboxes.

**An action** is `{ id, owner, label, target: 'region'|'location', kind: 'toggle'|'choice', choices?, order?, run(h, ctx) }`.

- The id is namespaced by its owner (`path.route`, `regions.open`, `flash.teleport`). A duplicate id throws, naming
  the owner that holds it.
- `run` gets the panel's handles and `{ panelId, target, regionName, locationName?, discovery?, settings, value }`,
  and returns the `regionActions` result shape.
- **Run order** (R8): `order` = `ORDER.path` (100), then `ORDER.check` (200), then panel actions (`ORDER.panel`,
  300, the default). Equal orders run in registration order.

**The built-ins** (owner `path`) call `regionActions.js` only:

| Id | Target | Kind | Values |
|---|---|---|---|
| `path.route` | region | choice | `{ from: 'pathEnd'\|'start'\|'player', distance: 'all'\|'one'\|'oneAndAll' }`, or `false` |
| `path.checkAll` | region | toggle | check every accessible, unchecked location there |
| `path.check` | location | choice | `'now'` (one `user:locationCheck`) or `'addToPath'` (the parent region's `path.route`, then a path check) |

- Their moves go out under `source: 'regionView-path-<panelId>'` (`pathSourceFor`), which loop mode classifies as
  planning. A panel-owned play action keeps its own source and stays gated.
- `locationChecksAllowed` (discovery's `disableLocationCheckUI`) blocks `path.checkAll` and `path.check`. It does not
  block `path.route`.
- Extra handles beyond `regionActions`': `h.originators = { check, bulkCheck }` (the panel's originator strings),
  `h.beforePathExecute()` (optional; passed as the path edits' `beforeExecute`), and `h.onError` (optional).
- `distance: 'oneAndAll'` is legacy. It is the 7-box state with both move boxes and no path box, which makes a one-step
  move AND a direct move. The Region Graph's UI never writes it; only a hand-edited setting can hold it.

**Settings** live per panel (`moduleSettings.<panel>.clickActions`; the schema entries come with each panel's
adoption):

```js
{ enabled: true,                                    // the master switch: false → a click runs nothing
  region:   { 'path.route': { from: 'pathEnd', distance: 'all' }, 'path.checkAll': false, 'regions.open': true },
  location: { 'path.check': 'now' } }
```

`runClickActions(panelId, target, ctx, settings, h)` runs every enabled action in run order and returns
`{ ran, results: [{ id, owner, result }], skipped: [{ id, reason: 'unregistered' }] }`. An enabled id whose panel has
registered nothing is skipped and reported. It is never removed from the settings: `runClickActions` does not write
them.

**Migration** (`migrateRegionGraphClickKeys(old7)`, pure; a missing or non-boolean key takes its default):

| Today's keys | `clickActions` |
|---|---|
| `addToPath` | `path.route.from = 'pathEnd'` (wins over everything below) |
| else `overwritePath` | `from = 'start'` |
| else `movePlayerDirectly` or `movePlayerOneStep` | `from = 'player'` |
| none of those four | `path.route = false` |
| `movePlayerOneStep` | `distance = 'one'`; with `from: 'player'` and `movePlayerDirectly` too, `'oneAndAll'` |
| `showRegionInPanel` | `regions.open` (the Regions panel's action; it registers it itself) |
| `checkAllLocationsInRegion` | `path.checkAll` |
| `addLocationsToPath` | `path.check = 'addToPath'`, else `'now'` |

`defaultClickActions()` is the migration of today's seven defaults: route from the path end, all the way, and open the
Regions panel. `clickActions.equivalence.test.js` drives the Region Graph's real click handlers for all 2^7
combinations, on both a region and a location click. Each combination makes the same `regionActions` calls as its
migrated config, with the same arguments. Only the `source` differs.

## Tests

`regionViewModel.test.js`, `regionViewState.test.js`, `clickActions.test.js`, `clickActions.equivalence.test.js`, `regionActions.test.js` (it carries
`regionGraph/navigationManager.restart.test.js`'s restart cases too), and `regionGraph/regionGraphDispatch.test.js`
(the Region Graph still dispatches through its own `moduleDispatcher`, with its strings).
In-app equivalence: `node scripts/dev/region-graph-class-snapshot.mjs --port=<port> --out=<dir>`, then `diff -r`
against `CC/docs/region-map/step2-dumps/before/`.
