# regionView — the shared region view model and actions

A library, not a panel (no `index.js`, no `moduleInfo`). It holds what a region view **knows** and what it **does**,
with no renderer in it, so the Region Graph (Cytoscape) and the Region Map (step 3b, canvas) give the same answers.
Report: `CC/docs/region-map/step2-view-model.md`.

| File | What | Who uses it |
|------|------|-------------|
| `regionViewModel.js` | Pure functions of (snapshot, staticData, discovery context): `isRegionReachable`, `locationState`, `locationCounts`, `regionInteriorState`, `regionColorState`, `exitState`, `regionDiscovery` / `locationDiscovery` / `exitDiscovery` (the ONE hide/placeholder decision), `displayGroupsOf` + `aggregateCounts` / `aggregateVisibility` | Region Graph (`graphDataManager.js`), `regionViewState.js` |
| `regionViewState.js` | `createRegionViewState(handles)`: subscribes to the Region Graph's triggers, recomputes at most once per animation frame, `get()` a frozen view, `subscribe`, `refresh`, `dispose` | Region Map (step 3b). The Region Graph keeps its own wiring |
| `regionActions.js` | Moves (one step, direct, the ⛓ restart step), path edits (add, overwrite), location checks (single, bulk), select/show publishes. Explicit handles in, a result out (`{ ok: false, reason: 'no-path' }`) | `clickActions.js`; Region Graph (`navigationManager.js`, `graphInteractionManager.js`); Region Map (`regionMap/regionMapClicks.js`, step 4: the only caller of `moveOneStep` / the one-step option until CA-S3) |
| `clickActions.js` | The click-action registry: which named actions a click on a region or a location RUNS, per panel. `registerClickAction` / `unregisterClickAction` / `listClickActions` / `getClickAction` / `onClickActionsChanged`, `runClickActions`, the built-in path actions, `routeStatusText` / `clickStatusOf`, `migrateRegionGraphClickKeys` / `defaultClickActions` | Region Graph (CA-S2: `graphInteractionManager.js`); the Regions panel (`regions/regionsClickActions.js`, `regions.open`). The Region Map adopts it in CA-S3 |
| `clickActionsUI.js` | The shared "On click" strip: `mountClickActionsStrip({ panelId, container, getSettings, saveSettings })`. Renders the registry generically, edits a panel's `clickActions` | Region Graph (CA-S2). The Region Map in CA-S3 |

## Rules

- **Nothing here imports Cytoscape, the DOM, a panel or a singleton.** Every collaborator is an argument (the
  discovery context's `discovery`, an action's `h.dispatcher`, …). `clickActionsUI.js` is the one DOM builder: it
  builds through its `doc` argument (the page's `document` by default), so the tests mount it on a fake.
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

**An action** is `{ id, owner, label, target: 'region'|'location', kind: 'toggle'|'choice', choices?, order?, run(h, ctx),
summary?, choiceLabels? }`.

- The id is namespaced by its owner (`path.route`, `regions.open`, `flash.teleport`). A duplicate id throws, naming
  the owner that holds it.
- `run` gets the panel's handles and `{ panelId, target, regionName, locationName?, discovery?, settings, value }`,
  and returns the `regionActions` result shape.
- **Run order** (R8): `order` = `ORDER.path` (100), then `ORDER.check` (200), then panel actions (`ORDER.panel`,
  300, the default). Equal orders run in registration order.
- `summary` (a string, or `(value) => string`) is the action's word in the strip's collapsed line (default: `label`);
  `choiceLabels` (`{ value: text }`) labels a choice's values in the strip. Both are optional and display-only.
- `onClickActionsChanged(listener)` tells a listener after every register / unregister (a plain listener list, no
  event bus); the strip re-renders on it.

**The built-ins** (owner `path`) call `regionActions.js` only:

| Id | Target | Kind | Values |
|---|---|---|---|
| `path.route` | region | choice | `{ from: 'pathEnd'\|'start'\|'player' }` (always all the way), or `false` |
| `path.checkAll` | region | toggle | check every accessible, unchecked location there |
| `path.check` | location | choice | `'now'` (one `user:locationCheck`) or `'addToPath'` (the parent region's `path.route`, then a path check) |

- Their moves go out under `source: 'regionView-path-<panelId>'` (`pathSourceFor`), which loop mode classifies as
  planning. A panel-owned play action keeps its own source and stays gated.
- `locationChecksAllowed` (discovery's `disableLocationCheckUI`) blocks `path.checkAll` and `path.check`. It does not
  block `path.route`.
- Extra handles beyond `regionActions`': `h.originators = { check, bulkCheck }` (the panel's originator strings),
  `h.beforePathExecute()` (optional; passed as the path edits' `beforeExecute`), and `h.onError` (optional).
- ⚖ There is no "one step" (user, 2026-11-17T23:00:54Z: *"I think I want to entirely remove the "move player one
  step" option"*). A route goes all the way; `from: 'player'` is the direct move. A stored route that still carries a
  `distance` (none existed outside tests when this was ruled) is read without it.

**Settings** live per panel (`moduleSettings.<panel>.clickActions`; the schema entry comes with each panel's
adoption — the Region Graph's in CA-S2, default `defaultClickActions()`):

```js
{ enabled: true,                                    // the master switch: false → a click runs nothing
  region:   { 'path.route': { from: 'pathEnd' }, 'path.checkAll': false, 'regions.open': true },
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
| else `movePlayerDirectly` | `from = 'player'` |
| none of those three | `path.route = false` |
| `movePlayerOneStep` | ignored (⚖ removed): the answer is the one the same keys give with it false |
| `showRegionInPanel` | `regions.open` (the Regions panel's action; it registers it itself) |
| `checkAllLocationsInRegion` | `path.checkAll` |
| `addLocationsToPath` | `path.check = 'addToPath'`, else `'now'` |

`defaultClickActions()` is the migration of the seven old defaults: route from the path end, and open the Regions
panel. `clickActions.equivalence.test.js` drives the Region Graph's handlers from BEFORE CA-S2 (kept verbatim in
`legacyRegionGraphClicks.testkit.js`) against its adopted ones for every combination with `movePlayerOneStep` false,
on a region and a location click: the same `regionActions` calls, with the same arguments. Only the `source` differs
(and the order between the play and Regions-panel channels, R8). The rows with `movePlayerOneStep` true are classified
there: they are what the removal changes.

## The "On click" strip (`clickActionsUI.js`)

`mountClickActionsStrip({ panelId, container, getSettings, saveSettings, doc? })` → `{ element, render, setExpanded,
isExpanded, destroy }`. The host keeps its `clickActions` in memory (`getSettings()` is synchronous) and stores what
`saveSettings(next)` hands it (always a new object). It knows no panel and no action by name:

- **Collapsed:** one line — `On click: extend path · Regions — location: check` — and the ⏸ master switch
  (`enabled`; `▶` resumes). Paused, the line reads `On click: ⏸ paused`.
- **Expanded:** a Region list and a Location list from `listClickActions(target)`. A `toggle` is a checkbox. A
  `choice` is a select whose first option is "off" (`false`): `choices` as an array is one select (the value is the
  choice), as `{ field: [values] }` one select per field (the value is `{ field: value }`, only the declared fields).
- **Unknown ids are kept.** An enabled id with no registered action (its panel is not loaded) shows greyed out,
  `<id>: <value> (not loaded)`; an edit elsewhere never drops it.
- It re-renders on `onClickActionsChanged`; the host calls `render()` when its settings change from outside.

## Tests

`regionViewModel.test.js`, `regionViewState.test.js`, `clickActions.test.js`, `clickActions.equivalence.test.js`,
`clickActionsUI.test.js` (the strip, on `procgenCore/fakeEditorDom.testkit.js`), `regionActions.test.js` (it carries
`regionGraph/navigationManager.restart.test.js`'s restart cases too), and `regionGraph/regionGraphDispatch.test.js`
(the Region Graph's adopted handlers still dispatch through its own `moduleDispatcher`, with its originators).
In-app equivalence: `node scripts/dev/region-graph-class-snapshot.mjs --port=<port> --out=<dir>`, then `diff -r`
against `CC/docs/region-map/step2-dumps/before/`.
