# Click actions S1: the registry and its model

**Status: built.** `regionView/clickActions.js` is the click-action registry, its per-panel settings model, the
three built-in path actions and the migration from the Region Graph's seven "On Region Node Click" keys. It is pure
code with no UI, and no panel uses it yet, so no app behaviour changes. `git diff --stat origin/main...<tip> --
frontend/modules/regionGraph/ frontend/modules/regionMap/` prints 0 lines.

The design is the mode-toggle discussion's (session `mode-toggle-ui-discussion`, rulings R1–R8 of 2026-11-16). This
is its slice CA-S1. Inputs: `step4-clicks.md` (the click census this reproduces) and `step2-view-model.md`
(`regionActions.js`).

Base: `d3f74f4978` (train 138).

## 1. What changed

| File | Change |
|---|---|
| `frontend/modules/regionView/clickActions.js` (new) | The whole slice; detail below |
| `frontend/modules/regionView/clickActions.test.js` (new, 20 rows) | The registry, `runClickActions`, the built-ins over the REAL `regionActions` (payloads, the R7 source), the migration |
| `frontend/modules/regionView/clickActions.equivalence.test.js` (new, 14 rows = 1536 combinations) | The 2^7 × {region, location} equivalence (§3) |
| `frontend/modules/loops/loopModeExemptions.js` | `\|\| source.startsWith('regionView-path')` (`:40`), plus its docblock (`:21-26`) |
| `frontend/modules/loops/loopModeExemptions.test.js` | Pins `pathSourceFor(panelId)` as planning, by the module's constants (`:48`). A `replay-regionView-path-…` lookalike is play (`:91`), and so is any other `regionView-*` source |
| `frontend/modules/regionView/README.md` | The file-table row, the planning-prefix rule, and a "Click actions" section: the descriptor, the built-ins, the settings shape and the migration table |

**`clickActions.js`:**

| Lines | What |
|---|---|
| `:43` `ORDER` | R8: `path` 100, then `check` 200, then `panel` 300 (the default) |
| `:46-51` `PATH_SOURCE_PREFIX`, `pathSourceFor(panelId)` | `'regionView-path'` → `'regionView-path-<panelId>'` |
| `:56-71` | `BUILT_IN_IDS` (`path.route`, `path.checkAll`, `path.check`), `ROUTE_FROM`, `ROUTE_DISTANCE`, `LOCATION_CHECK` |
| `:82` `registerClickAction(desc)` | Validates the descriptor. The id must be namespaced by its owner (`owner.…`). A duplicate throws `duplicate id "<id>" (already registered by "<owner>")`. The descriptor is frozen |
| `:107` `unregisterClickAction(id)` / `:112` `listClickActions(target)` | The list is in run order: `order`, then registration order |
| `:136` `runClickActions(panelId, target, ctx, settings, h)` | It runs nothing when `settings.enabled === false` (`reason: 'disabled'`). It returns `{ ran, results: [{ id, owner, result }], skipped: [{ id, reason: 'unregistered' }] }`. It never writes `settings` |
| `:177` `routeTo(h, region, route, panelId)` | The route action's body (§2). The location `path.check` reuses it |
| `:199` `BUILT_IN_ACTIONS` | The three built-ins, registered at module load (`:260`) |
| `:263` `resetClickActionsForTests()` | Clears the registry and re-registers the built-ins |
| `:275` `LEGACY_REGION_GRAPH_CLICK_DEFAULTS` | The seven keys and their defaults. A test pins them to `layoutControlsManager.js`'s checkbox list |
| `:298` `migrateRegionGraphClickKeys(old7)` / `:324` `defaultClickActions()` | §2's table. `defaultClickActions()` returns the migration of the seven defaults |

## 2. The model as built

**The built-ins.** They are owned by `path` and call `regionActions.js` only. Each one makes the same calls as the
Region Graph's code it replaces:

| Id | Target | Value | Calls (`regionActions`) | Replaces (at base) |
|---|---|---|---|---|
| `path.route` | region | `{ from: 'pathEnd', distance }` | `addToPath(h, r, { moveOnlyOneStep: distance !== 'all', source, beforeExecute: h.beforePathExecute })` | `navigationManager.js:376` `addToPath` |
| | | `{ from: 'start', distance }` | `overwritePath(…)`, with the same options | `navigationManager.js:402` `overwritePath` |
| | | `{ from: 'player', distance: 'one' }` | `planOneStepMove(h, r, { onError })`, then `publishRegionMove(h, move, source)` when the plan is a `move` | `navigationManager.js:284` |
| | | `{ from: 'player', distance: 'all' }` | `planDirectMove`, then `publishRegionMove` | `navigationManager.js:342` |
| | | `{ from: 'player', distance: 'oneAndAll' }` | both plans first, then both publishes | `graphInteractionManager.js:340-347` with both move boxes ticked |
| `path.checkAll` | region | `true` | `locationChecksAllowed` gate, then `checkAccessibleLocationsInRegion(h, r, { originator: h.originators.bulkCheck, snapshot, staticData })`. It is called only when the region has locations | `graphInteractionManager.js:368` |
| `path.check` | location | `'now'` | gate, then `checkLocation(h, { locationName, regionName, originator: h.originators.check })` | `graphInteractionManager.js:297` |
| | | `'addToPath'` | gate, then the parent region's route (by the REGION `path.route` setting), then `addLocationCheckToPath` | `graphInteractionManager.js:259-285` |

The gate blocks the whole location action, and so its moves too: the handler returns first (`:246`). It does not
block `path.route` on a region click.

**Settings, per panel** (R4; the schema entries come with each panel's adoption):

```js
{ enabled: true,
  region:   { 'path.route': { from: 'pathEnd', distance: 'all' } | false, 'path.checkAll': false, 'regions.open': true },
  location: { 'path.check': 'now' | 'addToPath' } }
```

**The migration as built** (`migrateRegionGraphClickKeys`). A missing or non-boolean key takes its default.

| Today's keys | `clickActions` |
|---|---|
| `addToPath` | `path.route.from = 'pathEnd'` (wins over everything below) |
| else `overwritePath` | `from = 'start'` |
| else `movePlayerDirectly` or `movePlayerOneStep` | `from = 'player'` |
| none of those four | `path.route = false` |
| `movePlayerOneStep` | `distance = 'one'` |
| `from: 'player'` with BOTH move boxes | `distance = 'oneAndAll'` (below) |
| `showRegionInPanel` | `regions.open: true` |
| `checkAllLocationsInRegion` | `path.checkAll: true` |
| `addLocationsToPath` | `path.check = 'addToPath'`, else `'now'` |

`defaultClickActions()` = `{ enabled: true, region: { 'path.route': { from: 'pathEnd', distance: 'all' },
'path.checkAll': false, 'regions.open': true }, location: { 'path.check': 'now' } }`.

⚠ **`'oneAndAll'` is an addition to the design.** The design's distance is `'all' | 'one'`. But today, with *Move one
step* and *Move directly* both ticked and neither path box, the handler makes TWO moves: a one-step move and a
direct move, both planned from where the player stood (`graphInteractionManager.js:340-347`). The design's mapping
(`movePlayerOneStep → 'one'`) would drop the direct move, so 4 of the 128 states would differ. The UI never writes
that state, because the boxes' change handlers untick each other (`:197-212`), and no settings preset holds it
(`grep -a` over `frontend/settings/*.json`). A hand-edited setting can. The value keeps the migration exact. CA-S2
can show it as a third distance, or collapse it to `'one'` with a recorded delta. That is CA-S2's decision.

## 3. Equivalence

**Method: MEASURED, imported.** `clickActions.equivalence.test.js` drives the Region Graph's REAL handlers with no
DOM: `GraphInteractionManager.handleRegionNodeClick` (`graphInteractionManager.js:311`) and `handleLocationNodeClick`
(`:239`), over a real `NavigationManager`.

- The checkboxes are `{ checked }` stubs keyed by id.
- `addLocationsToPath` comes from a stubbed `settingsManager.getSetting`.
- `regionActions.js` is replaced by a recorder, shared by both sides, that logs each call's name and arguments.
- The new side runs `migrateRegionGraphClickKeys(bits)` through `runClickActions('regionGraph', …)`.
- No expected list is written by hand. Each row compares the two recorded logs.

**Compared, per combination:**

1. The **play channel**, in order, arguments included: `publishRegionMove`, `addToPath`, `overwritePath`,
   `checkLocation`, `checkAccessibleLocationsInRegion`, `addLocationCheckToPath`.
2. The **Regions-panel channel**, in order: `showRegionInRegionsPanel` and every CHANGE of "Show All Regions".
   `navigationManager.setShowAllRegions` (`:435`) fires only on a change.
3. The **multiset of all calls**, arguments included, the read-only ones too: `planOneStepMove`, `planDirectMove`,
   `locationChecksAllowed`.

**Scenarios:** 128 combinations × 12 = **1536 rows**.

- Region clicks: 2 regions (with and without locations) × discovery (checks allowed or blocked) × Show All's
  starting state = 8 scenarios.
- Location clicks: discovery × Show All = 4 scenarios.

**Result:** 1536 / 1536 equal. 1224 rows have a non-empty play channel.

**Deltas:**

- **`source` (the expected one).** A path move carries `regionView-path-regionGraph` where today it is one of
  `REGION_GRAPH_SOURCES`. Each row swaps today's strings for it before comparing. It asserts that today's log never
  contained the new string, and counts the swaps: 1152 swaps across 1080 rows.
- **The interleaving between the two channels** is not compared. Today it is set by the handlers' dynamic imports:
  the Regions-panel publishes are synchronous, and the moves and checks run after `import('./index.js')` resolves.
  The new order is R8's: path, then checks, then panel actions. 484 of the 1536 rows interleave the channels
  differently. Each channel's own order is identical in every row.

**What is NOT measured:**

- **`regions.open` is a stand-in.** It is the Regions panel's action (CA-S4), not a built-in. The table registers a
  stand-in with today's behaviour (`graphInteractionManager.js:351-359`: Show All = !(add || overwrite path), then
  activate and navigate). The table proves the settings carry what that action needs. It does not prove that S4's
  real action does it.
- **`publishNodeSelected`** is the Region Graph's own publish. It stays with the panel (design §4.3), so it is not
  compared.

**⚠ A vitest artefact, worked around.** Inside a test, two `import()`s in flight at once resolve only once. Measured
in a scratch test: the second import never settles, for a mocked module and for an unmocked one.
`regionGraphDispatch.test.js` notes the same. A click with two moves would therefore lose one. So the handler runs
with `ui`'s four navigation methods as recorders, and its own async work settles alone. Each recorded navigation
call is then replayed on a real `NavigationManager`, one at a time. The log is reassembled in the browser's order:

1. the handler's synchronous part;
2. the navigation calls' effects (their imports were issued first);
3. the handler's own async checks.

**Mutation check:** each of these edits to `clickActions.js` turns the table red:

- `oneAndAll` → `one`: 11 of 14 rows fail.
- `overwritePath` beating `addToPath`: 11 rows fail.
- `regions.open` always on: 9 rows fail.

## 4. Loop mode (R7)

`isLoopModePlanningSource` gains `source.startsWith('regionView-path')`. It keeps `regionGraph*` and step 4's
`regionMap*`. Flash and Discovery are left out: a panel-owned play action keeps its own source and stays gated. The
pin calls `pathSourceFor` for `regionGraph`, `regionMap` and an arbitrary panel id, so renaming the prefix turns the
pin red. `regionView-teleport`, a bare `regionView`, and `replay-regionView-path-…` are play.

## 5. Proof

**Bounded vitest (⚖ 52)**, `npx vitest run <paths> --maxWorkers=3`, over these files:

- every test that imports a touched file (`git grep -a -l "loopModeExemptions\|clickActions"` finds
  `loopModeExemptions.test.js`);
- every test in `regionView/`, `regionGraph/` and `regionMap/`.

Result: **10 files, 124 tests passed**. `loops/blockModes.test.js` (166 tests) passed as well; it carries a
`regionGraph-addToPath` gate row.

- **Census pins:** none moved. `regionView/README.md` is under no docs-link census: `procgenDocs/docLinks.test.js`
  scans `docs/json/developer/procgen/` only. No module-import-order or binding-contract test enrols `regionView/`.
- **Engine closure:** the closure ∩ the diff = ∅ (42 files). `engineMd5` is `bec369878feb67081187edca62baa951` at
  base `d3f74f4978`, measured in a throwaway worktree, and the same at the tip.

## 6. Notes for CA-S2 (the strip and the Region Graph's adoption)

What the Region Graph's wiring does today, which the adoption has to replace or keep:

1. **`regions.open` must be registered by somebody before the Graph drops its checkbox.** It is panel-owned (CA-S4).
   If CA-S2 lands first, the default click loses "open in the Regions panel" unless S2 registers it, or keeps
   today's branch. The stand-in in `clickActions.equivalence.test.js` is the behaviour to copy: set Show All to
   `!(route.from is 'pathEnd' or 'start')`, then `showRegionInRegionsPanel`.
2. **`h.beforePathExecute`** must be `() => navigationManager.setShowAllRegions(false)`. Today the path edits turn
   Show All off even when *Show region in panel* is unticked (`navigationManager.js:386, 413`). Without the handle,
   that side effect is lost.
3. **The handles.**
   - The Graph's dispatcher is `moduleDispatcher`, which it reads lazily through `import('./index.js')` today. The
     adoption passes it in `h.dispatcher`.
   - `h.originators` = `REGION_GRAPH_ORIGINATORS`.
   - `h.stateManager`, `h.pathFinder`, `h.gameState` and `h.getRules` / `h.restart` come from
     `navigationManager._handles` (`:25`).
   - `h.onError` is the logger's warning.
4. **The status bar.** The texts ("No path to X", "Added n region(s) to path", "Restart → R …") are built by
   `navigationManager.js` from the action results. `runClickActions` returns the same results (per action, in
   `results[i].result`), so the strip's host must map them. `regionMap/regionMapClicks.js` `statusOf` (`:90`) does
   this already for the Region Map.
5. **`regionGraph:nodeSelected`** is published before any action (`graphInteractionManager.js:323`). Keep it outside
   `runClickActions` until S5.
6. **The discovery context.** The Graph reads `ui.isDiscoveryModeActive` / `ui.discoverySettings`; pass them as
   `ctx.discovery = { active, settings }`.
7. **`'oneAndAll'`** (§2) needs either a display in the strip or a ruling to collapse it.
8. **Reader drift goes away.** The Graph acts on its DOM checkboxes; the Region Map reads the settings
   (`step4-clicks.md` §6.2). Once both run `runClickActions` over their settings objects, there is one reader.
9. **The six settings presets** (`settings-{depgraph,vibecoding,apcalc,check-all-from-graph,metamath,textadventure}.json`)
   still name the old keys. Every one of them migrates cleanly; none has both move boxes on.
