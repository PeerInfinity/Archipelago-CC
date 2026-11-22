# Region view dedup — the inline reachability copies and the two "Go to" pickers

Slice `region-view-dedup`, cut at `39b1df8cbd` (origin/main), merged with origin/main `ba36761859` at `2679997c93`.
⚖ Rulings (session 84c8ab35, archipelago-cc-23): 2026-11-16, parked item 8, *"Locations/Exits/commonUI duplication:
after step 4."*; 2026-11-17T18:08:42Z, the order, *"Yes, go ahead (Recommended)"* (… CA-S5 → Region Map tutorial →
duplication).

**What it does:** moves the repeated region-reachability tests in Exits, Regions and `commonUI.js` onto
`regionView/regionViewModel.js`'s `isRegionReachable`, and merges the wiring of the two map pickers into one module,
`regionView/goToPicker.js`. **Behaviour does not change.** The proof is equivalence, not review (below). No helper
changed, and no optional parameter was added.

## Census (`git grep -a -n` at base `39b1df8cbd`)

The helper: `isRegionReachable(snapshot, name)` = `snapshot?.regionReachability?.[name]` is `true`, `'reachable'` or
`'checked'`. A copy was replaced only if its answer is the helper's for every input. The rest were left alone and are
findings (below).

### Replaced: 17 expressions at 13 sites

| Base site | Tip | What | Rows, all equal |
|---|---|---|---|
| `exits/exitUI.js:596-600` | `:597` | traversability filter, parent | 7,590 |
| `exits/exitUI.js:614-618` | `:611` | traversability filter, connected | 7,590 |
| `exits/exitUI.js:702-709` | `:695-696` | `accessibility` sort, exit A (parent + connected) | 83,490 |
| `exits/exitUI.js:731-738` | `:718-719` | `accessibility` sort, exit B | 83,490 |
| `exits/exitUI.js:894-904` | `:875-876` | the card render (parent + connected) | 83,490 |
| `regions/index.js:200-211` | `:201`, `:204` | the exit-click handler (source + destination) | 83,490 |
| `regions/navigationManager.js:87-90` | `:88` | `computeRegionsToRender`, Show All | 7,590 |
| `regions/navigationManager.js:117-120` | `:115` | the path | 7,590 |
| `regions/navigationManager.js:134-137` | `:129` | the last region only | 7,590 |
| `regions/regionBlockBuilder.js:563-566` | `:564` | an entrance's source region | 7,590 |
| `regions/regionBlockBuilder.js:747-750` | `:745` | an exit's connected region | 7,590 |
| `commonUI/commonUI.js:2856-2870` | `:2860` | `createRegionLink`: only the first `if`'s condition; `rawStatus` stays for the `undefined` branch, and the whole three-way answer is compared | 7,612 |
| `commonUI/commonUI.js:2964-2969` | `:2961` | `createLocationLink`, its region | 7,612 |

Sites that read `snapshot.regionReachability` with no `?.` on `snapshot` are reached only with a snapshot. Each has a
guard before it: `exitUI.js:507`, `regions/index.js:194`, `regionUI.js:748`. So the helper's `snapshot?.` changes
nothing there. The two `commonUI` sites already read `snapshot?.`, and their input space includes a null snapshot.

`locationState`: 0 identical sites. `regionVisibility`: 0 sites (see the class read-backs below).

### Left alone (they differ, or read a different input) — findings

| Site (tip) | How it differs | Measured |
|---|---|---|
| `locations/locationUI.js:834-838`, and the same test at `:988`, `:1025`, `:1073`, `:1107`, `:1211` | `'reachable' \|\| 'checked'`, **no `true`** | differs on `regionReachability = { R: true }` (in the equivalence test) |
| `locations/locationUI.js` location evaluation | `evaluateRule` with no try/catch, a strict `=== true`, and a `detailedStatus` that keeps the region apart from the rule; `locationState` folds the two | not replaced |
| `exits/exitUI.js:751-756`, `:777-782` (base `:770-775`, `:796-801`), the `accessibility_original` sort | `true \|\| 'checked'`, **no `'reachable'`**: a reachable but unchecked region sorts as locked. **Likely a real bug**; left for its own slice, because fixing it changes the sort | differs on `{ R: 'reachable' }` |
| `commonUI/checksLine.js:32` | reads `snapshot.locationReachability` (precomputed location reachability), not the region's | a different input |
| `commonUI/commonUI.js:2956-2957` `isLocationAccessible` | reads `locationReachability` as `'reachable' \|\| true` | a different input |
| `regions/regionBlockBuilder.js:994-1009` location evaluation | `ruleMet` (`=== true`) and the passed-in `regionIsReachable`; `locationState` uses rule truthiness | not replaced |
| `regionGraph/graphInteractionManager.js:445`, `:521`; `regionGraph/navigationManager.js:92`; `regionGraph/nodePicker.js:51` | read the node's rendered class (`discovery-hidden`, set by `graphDataManager` at the last build or update), which can lag live discovery; `regionVisibility` would answer from live state | belongs with the Region Graph's D2 adoption |
| inline copies in `loops/`, `pathAnalyzer/`, `spoilerChecklist/`, `spoilerTest/`, `stateManager/` | outside this slice's named panels | not surveyed for identity |

## The picker module: `regionView/goToPicker.js`

The Region Graph's `regionGraph/nodePicker.js` (`rg-pick*`) and the Region Map's `regionMap/regionMapPicker.js`
(`region-map-pick*`) were twins (`tutorial.md` § the two pickers). They now share:
- `pickerSelectors(prefix)`: the four selectors from the class prefix;
- `fillList(list, names)`: one sorted `<option>` per name;
- `setupGoToPicker({ root, selectors, lists, regions, locations, goRegion, goLocation })` → `{ refresh, say }`:
  refresh on opening and on either box's focus; a trimmed, non-blank name goes to `goRegion` / `goLocation`.

Each panel keeps its own markup (pinned byte for byte), what its lists hold, what a choice does, and its status
wording. The Graph keeps `ui.refreshNodePicker` (open only). The Map keeps its returned `{ refresh, goToRegion,
goToLocation }` and its `Could not go to …` catch. **Not unified** (as briefed): the two "pending centre" fields
(Graph `pendingCentreOn`, Map `_pendingCentre`) and any shared map-panel base.

Pins written at BASE before the move, and passing there unchanged (commit `602854608d`):
- `regionGraph/nodePicker.test.js` (6): `pickerHTML()` length 1135, sha256 `74d05aa2…ec5afa`; the selectors, the
  lists, refresh on toggle/focus, `refreshNodePicker` only while open, the taps and the status wording, and a missing
  section.
- `regionMap/regionMapPicker.markup.test.js` (3): `buildRegionMapPicker` canon (list ids normalised) length 1102,
  sha256 `0052aadc…2a41a6`; ids per instance; the focus refresh, the returned `refresh`, a blank box, and a throwing
  click.

No pinned test was re-pointed or re-recorded. The existing `regionMap/regionMapPicker.test.js` is untouched.

## Proof

- **Equivalence vitest** (`regionView/reachabilityCopies.equivalence.test.js`): each replaced copy kept VERBATIM from
  base in `regionView/legacyReachabilityCopies.testkit.js` (bodies cut with `sed -n` from `git show 39b1df8cbd:…`),
  against the helper over 15 values × 11 names (`''`, `undefined`, `null`, `__proto__`, `constructor`, `toString`,
  `hasOwnProperty`, unicode, …) × 3 players × missing/null/empty maps, plus a null-prototype map: 690 snapshots, and 692
  with a null snapshot for the two commonUI sites. **402,314 rows, all equal.** The two left-alone families are
  measured to differ.
- **Real snapshots** (`scripts/dev/region-panels-dom-snapshot.mjs` runs the same oracle in the page, at every state):
  seedling_playthrough 54,306 rows, alttp 27,846, procgen_topdown 1,344. **0 mismatches**, BEFORE and AFTER.
- **D0** (`scripts/dev/region-graph-class-snapshot.mjs`, 3 presets × S1–S7): AFTER = BEFORE (`diff -r` empty).
  seedling_playthrough S1=882 … S7=1060; alttp S1=537 … S7=1073; procgen_topdown S1=20 … S7=70.
- **DOM** of the Locations, Exits and Regions panels (the same script): 3 presets × 7 states (S1 initial; S2 3 checks
  + one move; S3 discovery on; S4 the show-undiscovered boxes unticked; S5 Loop mode on; S6 Loop mode + discovery,
  partly discovered; S7 a fresh page) × every sort, and Regions also in Show All + Expand All. 693 captures.
  BEFORE-A = BEFORE-B (determinism) = AFTER (`diff -r` empty). `digests.json` sha256
  `91e6dbc74149a7413dbdf1c821230079bd5385bc79671922d9c5cf8319448acc`. Per panel (sha256 over the sorted
  `preset|state|capture|sha256` lines): Locations (84) `5f42bfa5…fdcc833`, Exits (84) `ec3d36dd…a3c8c70`, Regions
  (189) `98371809…2335c321`.
- **Render cost** (alttp seed 1; the time from a sort-select change to the render, the median over runs after a warmup):

  | Panel, sum of its 4 sorts | BEFORE | AFTER | Δ |
  |---|---|---|---|
  | Locations, 5 runs | 222.0 ms | 260.4 ms | +17.3% |
  | Exits, 5 runs | 190.6 ms | 173.3 ms | −9.1% |
  | Locations, 9 runs | 191.3 ms | 191.3 ms | +0.0% |
  | Exits, 9 runs | 159.2 ms | 161.4 ms | +1.4% |

  The first pair's Locations figure is one sort, `accessibility`: 54 → 115 ms, with AFTER samples of 107–130 ms. Its
  9-run AFTER re-measure is 49.1 ms (BEFORE 54.5 ms). The 9-run BEFORE was taken from the base files checked out in
  this tree and then restored. Per-sort noise is ±25%: Exits `accessibility_original`, whose code this slice does not
  touch, moved +26% in the 9-run pair. Load average about 7 throughout. `locationUI.js` is unchanged; Locations reaches
  the change only through `commonUI.createRegionLink`.
- **engineMd5** `74ae60f575531492ed9eaec1839e1fe3` (42 files) at base, at the slice and at the merge; closure ∩ diff = ∅.
- **Bounded vitest** (⚖ 52), at the merge: the touched dirs (`regionView/`, `regionGraph/`, `regionMap/`, `regions/`,
  `locations/`, `exits/`, `commonUI/`), every test importing a touched file, `moduleImportOrder`, `quickLaunchImportOrder`
  and `procgenCore/bindingContract`: 43 files, 790 tests, green.

## CI at the merge SHA `2679997c93`

Each run is at headSha `2679997c93`.

| Run | What | Result |
|---|---|---|
| 45069242367 | JavaScript Unit Tests (push) | success. Suite 1414 files / 29,728 passed, 0 failed; slow 438. vs main `ba36761859` (1411 / 29,701): **+F 3, +T 27**, 0 failed either side. The three new files hold 26 (6 + 3 + 17); the extra 1 is not attributed |
| 45069242336 | unittests (push) | success |
| 45069295033 | TT, `test-templates.yml` (dispatch) | success, all 9 jobs. `test_region_graph_node_picker` and `region-map-go-to-equals-canvas-click` PASSED in fast and in fast-bundled. Headroom: fast 319.4 s / 600 (53%); main `ba36761859` 324.0 s. Fast-bundled 331.9 s (55%); main 334.1 s |
| 45069297247 | `batch=tutorials-tracker` | success, 9/9, including `tutorial-walk-tracker-region-graph` and `tutorial-walk-tracker-region-map` |
| 45069301491 | `batch=tutorials` | success |
| 45069299176 | `batch=feature-checks` | **failure**, 9/10: `feature-check-seedling-dash-window` — *"the panel refused the solve: the page did not reach level 12"* at 47.9 s |
| 45069917011 | repeat `feature-check-seedling-dash-window` ×8 at `2679997c93` | **8/8 passed** |
| 45069938935 | the same ×8 at the pre-merge tip `e8436a40c6` (control branch) | **8/8 passed** |
| 45070996373 | `batch=feature-checks` again | success, 10/10 |

The one red is a Seedling solve row, outside this slice's import graph. It passed 16 of 16 alone and 10/10 on the
batch re-run.

## What is left

- `exits/exitUI.js` `accessibility_original` sort: no `'reachable'`, so a reachable but unchecked region sorts as
  locked. Fixing it changes the sort, so it needs its own slice (and a ruling on whether it should stay distinct from
  `accessibility`).
- `locations/locationUI.js`'s two-value region test (6 copies) and its location evaluation: moving them onto the
  helpers changes the answer for `regionReachability === true`, and loses the region/rule split. `locationState` would
  need to return that split first.
- `regionBlockBuilder.js`'s location evaluation (`=== true` against truthiness).
- The Region Graph's class read-backs (4 sites) → `regionVisibility`, with the D2 adoption.
- The inline copies in `loops/`, `pathAnalyzer/`, `spoilerChecklist/`, `spoilerTest/`, `stateManager/` (not surveyed).
- The two pending-centre fields and a shared map-panel base (not unified, as briefed).
