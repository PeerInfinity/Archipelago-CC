# Click actions S5: `regionGraph:nodeSelected` and `regionMap:nodeSelected` retired

**Status: built, gated; packeted to js-22.** Neither map publishes a `*:nodeSelected` event any more. The generic
`regionView:regionClicked` / `regionView:locationClicked` `{ panelId, regionName, locationName? }` are the only click
events the Region Graph and the Region Map publish. The node's visual selection on the Graph stays. Only the event
went. No click action, run order or initial value changed.

The design is the mode-toggle discussion's (rulings R1–R8, 2026-11-16). This is its slice CA-S5, after CA-S4
(`click-actions-s4.md`). Base: `14c0386ccf` (origin/main at launch; `git merge-base HEAD origin/main` =
`14c0386ccf773a4daa08064a22a3650dbac547fb`). Code tip: `134f8e60cc`. Planner: archipelago-cc-23. Reviewer and
landing-queue owner: seedling-js-planning-22 (js-22).

## ⚖ Rulings this slice carries (session 84c8ab35)

- **R1–R8 (2026-11-16)**, the mode-toggle design (verbatim in the design §3). **R8** kept `regionGraph:nodeSelected`
  until S5. That is this slice.
- **2026-11-17T18:08:42Z, the order:** *"Yes, go ahead (Recommended)"* (… CA-S4 → **CA-S5** → Region Map tutorial →
  duplication).
- **2026-11-20, should apcalc / vibeCodingSim hear Region Map clicks:** *"Region Graph only"*. CA-S4's filtered
  listeners are final. Their comments (`apcalc/index.js:69-71`, `vibeCodingSim/index.js:85-87`) cited "an open
  question, not a ruling" and now cite this ruling. No behaviour change.
- **Not a user ruling:** retiring the Map's `regionMap:nodeSelected` is the planner's decision, by the same rule as
  the Graph's (nothing in the app hears it). It rests on the census in §1, and the STOP on any app subscriber held.
- **js-22's review (2026-11-21), GO with 6 edits.** content-4 replaces content-3; train 184 overlaps; the census grep
  set is widened; generated files are regenerated with `--write`; the overlay-card exactly-once pin is checked per
  map, master on and off; headroom is measured against the then-current main.

## 1. The census

Each table below is `git grep -a -n -E
"regionGraph:nodeSelected|REGION_GRAPH_NODE_SELECTED|regionMap:nodeSelected|REGION_MAP_NODE_SELECTED|publishNodeSelected"`
over the whole tree, with `--recurse-submodules` for the bare `nodeSelected` / `NODE_SELECTED` sweep. `CC/docs/` is
excluded: 40 lines in the earlier slice reports, kept as history.

The widened set (js-22 edit 3) is `frontend/tutorials/` (none: tutorials live in `frontend/modules/tutorials/`), the
tutorial content and `tutorialTests.js`, `test_json/`, `scripts/`, every `frontend/modules/*/iframe*` and adapter, the
nine submodules, and the `docs/` user guides. It found **nothing** outside the files below.

The tutorial executor (`tutorials/tutorialExecutor.js`) never subscribes to the bus. It polls the DOM (`waitFor`), so
no tutorial step can wait on either event. No generated file (event registry, docsIndex, urlGrammar) names either
event, so there was nothing to `--write` (js-22 edit 4); `procgenDocs/generated.test.js` and
`quickLaunch/generated.test.js` are green at the tip.

**No app subscriber, at base or at the tip.** Every subscriber is a test.

The base had 99 lines; the tip has 87. **App code at the tip has no publisher, registration, constant, helper or
subscriber.** The lines left are history comments, absence pins, oracle testkits, and tests that assert absence.

| File | Base lines | Tip lines | What they are; fate |
|---|---|---|---|
| `regionGraph/graphInteractionManager.js` | 8, 189, 205 | 190 | **publisher** (`:205`), its import (`:8`) and doc (`:189`): retired; `:190` is the new doc line (history) |
| `regionGraph/index.js` | 85 | — | **registration**: retired |
| `regionGraph/regionGraphOriginators.js` | 14 | 7 | **constant**: retired; `:7` is a history line |
| `regionGraph/nodeOverlayManager.js` | 342 | 343 | comment (the card click's events): rewritten to `regionView:regionClicked`; history |
| `regionMap/regionMapClickActions.js` | 25, 33, 44, 141, 152 | 25 | **publisher** (`:152`), **constant** (`:44`), helper import (`:33`), docs: retired; `:25` history |
| `regionMap/index.js` | 24, 52 | — | **registration** (`:52`) and its import (`:24`): retired |
| `regionView/regionActions.js` | 16, 263, 264 | 261 | **helper** `publishNodeSelected` (`:263-266`) and its header: retired; `:261` history |
| `regionView/clickActions.js` | 57 | 57 | history comment (`ORDER.select`); "the event was retired" added at `:59` |
| `regionView/README.md` | 48, 136 | 48, 137, 138 | "still published until CA-S5" → "retired in CA-S5" |
| `apcalc/index.js`, `vibeCodingSim/index.js` | 70; 86 | 70; 86 | comment: now cites the "Region Graph only" ruling |
| `discovery/index.js`, `discovery/discoveryClickActions.js`, `flashPanel/flashClickActions.js`, `flashPanel/flashPanelUI.js` | 490; 3, 11; 19; 1691 | the same | history comments (past tense already): kept |
| `docs/json/developer/modules/regionGraph.md` | 43 | 43 | the `regionGraph:nodeSelected` row is dropped; the generic events' row (`:43`) says CA-S5 retired it |
| `docs/json/developer/modules/regionMap.md` | 69 | 72 | the event list drops it; a stale "The Region Graph does not publish it yet" is fixed |
| `docs/json/developer/procgen/action-nodes.md` | 105 | — | "publishes no `regionGraph:nodeSelected`" → "no `regionView:regionClicked`" |
| `test-configs/playwright_tests_config-substrates.json` | 2103, 2169, 2187, 2193, 2205 | the same | `_comment`s: each now names `regionView:regionClicked` and the retirement |
| `tests/testCases/regionGraphPanelTests.js` | 18 lines | 340, 352, 378, 545, 628, 640, 655, 678, 684, 685, 905 | the rows now wait on `regionView:regionClicked` (Graph); each checks the retired event stays silent (§4) |
| `tests/testCases/regionMapTests.js` | 757, 817, 818, 857, 858, 886, 887, 1160 | 757 | dropped from `CLICK_EVENTS` and the asserts; `:757` is a history comment |
| `tests/testCases/actionNodesTests.js` | 863, 965 | 863 | the two rows hear `regionView:regionClicked` filtered to the Graph (§4); `:863` is a history comment |
| `regionGraph/regionGraphDispatch.test.js` | 82, 88, 115, 124 | 88, 133, 136 | the first publish is now the generic event; new bus-recorder rows (§5) |
| `regionGraph/nodeOverlayClick.test.js` | 68, 97, 107 | 69 | AN-3b's exactly-once now counts `regionView:regionClicked`, and zero `*:nodeSelected` |
| `regionMap/regionMapClickActions.test.js` | 166, 171 | 177 | the region click publishes the generic event alone; new bus-recorder rows (§5) |
| `regionView/regionActions.test.js` | 180, 183 | 178, 179 | `publishNodeSelected` is `undefined` |
| `regionView/nodeSelectedRetired.test.js` (**new**) | — | 2, 5, 31 | the source-scan pin (§5) |
| `flashPanel/flashClickActions.test.js`, `discovery/discoveryClickActions.test.js`, `regionView/panelClickActions.test.js` | 14, 164, 168, 169; 3, 40; 232, 236, 248 | the same | **absence pins, kept** (now trivially true; they stop the listener coming back) |
| the three oracles + their testkits (§3) | 2+2+3+2+2+6 | 4+5+4+4+3+12 | the BASE side, recorded as the retired `select` channel |

## 2. What was retired (file:line at base `14c0386ccf`)

- **`regionGraph:nodeSelected`**:
  - the publish, `regionGraph/graphInteractionManager.js:205`
    (`actions.publishNodeSelected(…, REGION_GRAPH_NODE_SELECTED, regionName, node.data())`), with the
    `regionActions` import `:6` (its only use) and the constant's import `:8`;
  - the registration, `regionGraph/index.js:85`;
  - the constant, `regionGraph/regionGraphOriginators.js:14`.
  - The click order is unchanged: select the node (the visual select state, `ui.selectedNode` and the `selected`
    class), then `regionView:regionClicked`, then the REGION click actions. The overlay card's body click
    (`nodeOverlayManager.js:349`) still calls `handleRegionNodeClick`, so it publishes exactly one generic event
    (AN-3b's pin, §5).
- **`regionMap:nodeSelected`**:
  - the publish, `regionMap/regionMapClickActions.js:152`;
  - the constant `:44`, and the helper import `:33`;
  - the registration, `regionMap/index.js:52`, and its import `:24`.
  - `runRegionMapClick` no longer takes `data` (it fed only the selection payload); `regionMapUI.js:640` stopped
    passing it.
- **`regionActions.publishNodeSelected`**, `regionView/regionActions.js:263-266`, with the "and `<module>:nodeSelected`"
  publisher line in its header (`:16-19`). It had no caller left.

## 3. The equivalence oracles: all three KEPT

Each oracle recorded the BASE `select` channel. At the tip the ONLY delta is that publish disappearing, and each
oracle now counts it and asserts the tip's `select` channel is empty. Every other counter is **identical to base**,
measured by running the same three files at base `14c0386ccf` in a throwaway worktree and again at the tip.

| Oracle | Configs × clicks | The retired `select`, counted | Everything else vs base |
|---|---|---|---|
| CA-S2 `regionView/clickActions.equivalence.test.js` + `legacyRegionGraphClicks.testkit.js` (Region Graph, 2^6 key combinations × 12 scenarios) | 768 rows | `retiredSelect` **512** = 64 × 8 region-click scenarios, exactly one each; 0 on the 256 location rows | `rows 768, swappedSources 504, crossOrderDiffers 228, nonEmptyPlay 584, newSourceSeen 504`: equal; the one-step table equal |
| CA-S3 `regionMap/regionMapClicks.equivalence.test.js` + `legacyRegionMapClicks.testkit.js` (Region Map, the same grid) | 768 rows | `retiredSelect` **512** | `swappedSources 504, crossOrderDiffers 32, nonEmptyPlay 584, newSourceSeen 504, genericEvents 768, statusRows 504, regionsOpened 256, graphMigratedOnCopy 768, rowsWithOldSource 504`: equal |
| CA-S4 `regionView/panelClickActions.equivalence.test.js` + `legacyNodeSelectedListeners.testkit.js` (Graph AND Map clicks; the DEFAULT config and the 6 presets × 3 discovery bundles × box × seed) | 420 rows | `S` **252** = 3 region clicks (Graph Field, Graph C, Map Field) × 7 × 3 × 2 × 2 | `equal 223, G 252, F 172, I 56, other []`, and every `Fdetail` key: byte-identical to base's tally |

**Why keep them.** Each still pins what no live test enumerates: the CA-S2/CA-S3 `play` / `regions` / all-calls
channels over every key combination, and the CA-S3 status text and R4 first-run copy. CA-S4 pins the Flash, Discovery,
apcalc and vibeCodingSim channels per preset. None of them tests nothing:
- the `select` count is asserted exactly;
- the header of each file and testkit says the channel is retired;
- the old pins (rows, non-empty play, sources swapped) still hold.

**The one structural change (CA-S4 oracle).** Its BASE side clicks through the tip's real `GraphInteractionManager`
and `runRegionMapClick`, and its verbatim base listeners subscribe to `regionGraph:nodeSelected`. Since the tip no
longer publishes that event, the base side re-publishes the base's selection event itself (`baseSelect`):
`{ nodeId, data }`, on the base bus, immediately before the handler, where the base handler published it. The source
pin there now also asserts that `graphInteractionManager.js` names no `publishNodeSelected` / `NODE_SELECTED`. So the
base side's handler stays "the tip's, minus the generic publishes, plus the retired one": that is the whole diff, and
it is pinned.

## 4. The tests that subscribed

**In-app, Region Graph** (`regionGraphPanelTests.js`). Each row now waits on `regionView:regionClicked` with
`panelId === 'regionGraph'`. Each also subscribes to the retired `regionGraph:nodeSelected` and asserts it stays
silent.
- `test_node_selection`: a pointer tap publishes `{ panelId: 'regionGraph', regionName }` and marks the node selected.
- `test_region_graph_node_picker`: picking a region is heard on the generic event.
- `test_region_graph_click_default`: the generic event is the FIRST of the recorded events.
- `test_region_graph_click_master_off`: still published, master off. The row's name changed from "nodeSelected still
  published" to "the click event still published". The id did not, so the roster is unchanged.

**In-app, Region Map** (`regionMapTests.js`). `regionMap:nodeSelected` left `CLICK_EVENTS`, the order assert (the
generic event is now `order[0]`) and the master-off and location-click asserts.

**In-app, ActionNodes** (`actionNodesTests.js`, content-4's rows). The diff was sent first and OK'd by content-4
(2026-11-21: *"apply it as sent, label edits included"*). `an-click-performs-once` (`:863`) and
`an-perform-all-button` (`:965`) subscribe to `regionView:regionClicked` filtered to `panelId === 'regionGraph'`. The
filter matters at `:863`, because the same row later clicks the Region Map. The asserted values (`[ready.node_id]`
exactly once; `[]` for the button) are unchanged; the labels name the new event.

## 5. Proof

**Vitest** (bounded, ⚖ 52; `npx vitest run <144 files> --maxWorkers=3`). The set:
- every test importing a touched file (`git grep -a -l`);
- all of `regionView/`, `regionGraph/`, `regionMap/`, `regions/`, `flashPanel/`, `discovery/`, `apcalc/`,
  `vibeCodingSim/` and `actionNodes/`;
- `loops/loopModeExemptions.test.js`;
- the census / import-order / binding-contract tests: `procgenCore/bindingContract.test.js`,
  `tests/moduleImportOrder.test.js`, `app/core/panelLifecycle.test.js`, `flashPanel/moduleRegistration.test.js`,
  `quickLaunch/quickLaunchImportOrder.test.js`;
- the docs pins (`procgenDocs/*`, `quickLaunch/generated.test.js`) for the `docs/` edits.

**144/144 files green.** No test scans event-bus publisher registrations, so no census test needed an edit; they are
green as gates.

New pins:
- **bus recorder, per map, master on AND off:**
  - `regionGraphDispatch.test.js` "CA-S5": a region tap and a location tap publish no `*:nodeSelected`, exactly ONE
    generic event, and it comes first. `ui.selectedNode` is still set (the selection stays).
  - `regionMapClickActions.test.js` "CA-S5, master on/off": the same for a Map region click and a location click.
- **the overlay card (AN-3b's exactly-once, js-22 edit 5):** `nodeOverlayClick.test.js`.
  - Both card kinds (ActionNodes', vibeCodingSim's), master on: exactly one
    `['regionView:regionClicked', { panelId: 'regionGraph', regionName: 'Field' }]`, zero `*:nodeSelected`, and the
    strip run once.
  - Master off: exactly one and zero, with no action run.
  - A BUTTON in the card: none.
  - The Region Map has no overlay cards (its overlay is the location squares). Its card-click equivalent is the cell
    click, pinned by the Map rows above and by `an-click-performs-once`'s Map leg.
- **`regionView/nodeSelectedRetired.test.js` (new):** a source scan of every app `.js` in `regionGraph/`,
  `regionMap/` and `regionView/` (tests and testkits excluded). No `*:nodeSelected` registration or publish, no
  `NODE_SELECTED`, no `publishNodeSelected`. **Measured failing at base on exactly the six files that carried the
  event** (`graphInteractionManager.js`, `regionGraph/index.js`, `regionGraphOriginators.js`, `regionMap/index.js`,
  `regionMapClickActions.js`, `regionActions.js`), and passing at the tip.

**D0** (`scripts/dev/region-graph-class-snapshot.mjs`, 3 presets × S1–S7):
- BEFORE: the base worktree, served on 8142;
- AFTER: this tree, on 8141;
- result: `diff -r` is **byte-identical** (22 files).

**Closure ∩ diff = ∅** (the 42 files of `seedlingDerivedRuleTable.js --print-engine-closure`). **engineMd5**
`74ae60f575531492ed9eaec1839e1fe3` at base and at the tip. **Gitlinks: 0.**

**Local in-app** (port 8141, `--test=` the nine rewritten rows): **9/9**.

**CI at the code tip `134f8e60cc`.** Each run's headSha is `134f8e60cc5d4d5d35307c691350ddf638dcfa90`. `origin/main`
was still `14c0386ccf` when the packet went out, so the pre-packet main merge was a no-op and the gate SHA is the tip.

| Gate | Result |
|---|---|
| JSUT (push) | run 44940322189: 1399 files / 29408 tests, 0 failed; slow 36/438. Base `14c0386ccf` (run 44929029898): 1398 / 29378. **+1 file, +30 tests**: `nodeSelectedRetired.test.js` (26), the Graph's 2 and the Map's 2 bus-recorder rows |
| unittests (push) | run 44940322168 success |
| TT (`test-templates.yml` dispatch), read job by job | run 44940347868 success. ALTTP spoiler & regression 60/60; fast 131/131; fast-bundled 131/131; seedling-js 40/40; seedling-js-solver 12/12; seedling-wasm 12/12; playback-bot 16/16; apworld 142/142 |
| feature-checks (`test-substrates-manual.yml -f batch=feature-checks`) | run 44940350375: 10/10, 70.8 s of 600 (12%) |
| ActionNodes rows on both boots (content-4's landing condition) | `an-click-performs-once` PASSED (fast and fast-bundled, 5.8 s); `an-perform-all-button` PASSED (both, 0.6 s); TT run 44940347868 |
| tutorials batches | not run: no tutorial content or walk names either event, and the executor never subscribes to the bus (§1) |

**Repeat ×8** (`test-substrates-repeat.yml -f repeat=8`), one dispatch per rewritten row; 8/8 required:

| Row | Run | Rate |
|---|---|---|
| `test_node_selection` | 44940352480 | **Rate: 8/8** |
| `test_region_graph_node_picker` | 44940354468 | **Rate: 8/8** |
| `test_region_graph_click_default` | 44940356621 | **Rate: 8/8** |
| `test_region_graph_click_master_off` | 44940358610 | **Rate: 8/8** |
| `region-map-click-default` | 44940360772 | **Rate: 8/8** |
| `region-map-click-master-off` | 44940363961 | **Rate: 8/8** |
| `region-map-click-location-check` | 44940366803 | **Rate: 8/8** |
| `an-click-performs-once` | 44940369362 | **Rate: 8/8** |
| `an-perform-all-button` | 44940371952 | **Rate: 8/8** |

**Headroom** (`check-batch-headroom.js`, TT run 44940347868). Base is the `main` push run 44937417336 at
`14c0386ccf`, the then-current main:

| Batch | Tip | Base | Δ |
|---|---|---|---|
| fast | 307.5 s / 600 (51%) | 323.5 s (54%) | −16.0 s |
| fast-bundled | 316.0 s / 600 (53%) | 324.9 s (54%) | −8.9 s |
| seedling-js | 228.4 s (38%) | 227.8 s (38%) | +0.6 s |
| seedling-js-solver | 185.9 s (31%) | 180.5 s (30%) | +5.4 s |
| seedling-wasm | 217.1 s (36%) | 179.5 s (30%) | +37.6 s |
| playback-bot | 113.9 s (19%) | 108.6 s (18%) | +5.3 s |

All batches are under 70%. `fast` and `fast-bundled` (the batches holding every row this slice edits) are below
base. seedling-wasm's +37.6 s is variance, not this slice: no seedling-wasm row changed, it is in the batch set only
through the import closure, and CA-S4 recorded it at 163.6 s and 220.7 s on two runs of one roster. It stays at 36%.

## 6. `test_control_buttons`

**Rate: 8/8** (`test-substrates-repeat.yml -f test=test_control_buttons -f repeat=8`, run 44941578472 at
`134f8e60cc`; dispatched at the slice tip with archipelago-cc-23's OK, as both a gate run and the flake measurement it
had planned for the B1 window). Nothing to do: the slice does not touch the layout-button path. The row also passed in
TT's `fast` (3.3 s) and `fast-bundled` (4.3 s). The fast-bundled STUCK *"Layout started on button click"* (job
136520396727, tip 4a29f236db; green on rerun) did not recur in 8 + 2 runs.

## 7. Notes for the Region Map tutorial

**Events a walk can wait on now.** There are exactly two click events, the same on both maps:
- `regionView:regionClicked` `{ panelId, regionName }`;
- `regionView:locationClicked` `{ panelId, regionName, locationName }`.

`panelId` is `'regionGraph'` or `'regionMap'`. Filter with `isClickFromPanel(data, panelId)` (`regionView/clickActions.js`).

They are published before any click action, and master off too. An overlay card's body click on the Graph publishes
`regionClicked` once; a card's BUTTON publishes nothing. There is no `*:nodeSelected` any more: a walk that waits on
one waits forever. The source pin above refuses it in the map modules.

The tutorial executor itself does not subscribe to the bus (`waitFor` polls the DOM). So a tutorial STEP waits on what
the click did (the path end, the Regions panel, the strip summary). Only a walk ROW in `tutorialTests.js` can hear the
events, through `tc.eventBus.subscribe`.

**CA-S4's tutorial notes, re-checked at `134f8e60cc`.** All still hold:
- the Map strip's host is `.region-map-click-strip-host` (`regionMapUI.js:217`);
- each action's row and control carry `data-action-id` (`clickActionsUI.js:174, :182, :194`), and the Flash teleport
  is `flash.teleport` (`flash.teleportLocation` for a location);
- the Map offers *Centre the Region Graph on it* and never itself (`regionMapClickActions.js:95` `offeredTo`;
  `regionGraphCentreAction.js:32` likewise for the Graph);
- the default collapsed summary is still *On click: extend path · Regions — location: check* (the rows that pin it:
  `regionMapTests.js:801`, `regionGraphPanelTests.js:548`);
- `RegionMapUI.centreOnRegion(name)` is at `regionMapUI.js:519`;
- `seedling-js-runtime-click-teleport` is in the substrates config (`:2581`).
