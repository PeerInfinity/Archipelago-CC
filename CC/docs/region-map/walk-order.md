# Region Map walk order: a Regions panel stuck on "Loading region data..."

Slice `region-map-walk-order`, 2026-11-24. Base `817d620e30` (origin/main at launch; it had not moved by the
packet). Gate tip **`2b438bbeba`**. This report is committed on top of it.

⚖ **Rulings.** The user, session 84c8ab35, 2026-11-24: *"Yes, please start the tutorial fix slice."* Then, once the
cause turned out to be an app defect rather than a test leak (the slice stopped and reported first, per the
review's edit 2), 2026-11-24T02:09:20.834Z: *"Every panel that gets stuck (Recommended)"*. That option read *"Fix the
Regions panel plus any of the other five the session proves can get stuck … Panels that recover on their own are
left alone."* The sweep below proves the Regions panel is the only one, so only it is fixed.

## The cause

`RegionUI.renderAllRegions` (`frontend/modules/regions/regionUI.js`) bails when the stateManager proxy has no
snapshot or static data yet, which happens for a moment during a world load. When it bailed it wrote
`this.regionsContainer.innerHTML = '<p>Loading region data...</p>'`. But `#region-details-container` is not a plain
list. It holds the section skeleton the panel builds once in `createRootElement`: `#accessibility-sorted-sections` >
`#available-content` / `#unavailable-content`, and `#general-sorted-list-section` > `#general-sorted-list-content`.
The renderer (`regionRenderer.js` `renderRegions` / `updateSectionVisibility`) only *looks those up*; nothing builds
them again. So after one bail, every later render warned `available-content element not found in regionsContainer`
and drew nothing. The panel showed "Loading region data..." until the page was reloaded.

The order dependence is a probability, not a leaking row. Each world load an earlier row does is another chance for
a render to land in the no-snapshot window. One bail anywhere before the walk is enough, because the walk's own world
load cannot repair the skeleton. Step 11 (`click-region`) is the first step that reads the Regions panel. Its done
check needs the panel's last `.region-block` to be `level_2`, and there were none.

**What a player would have seen:** load a world (a preset, a file, a new seed) while the Regions panel is
rendering. From then on the Regions panel says "Loading region data..." and shows no regions, whatever you click,
until you reload the page. Every other panel works normally.

### Evidence (before)

The exact repro is region-map-tiled-squares-cap's local run, taken from that session:

```
npm test -- --wait-for-box=900 --bundled --port=8143 --mode=test-substrates --test=region-map-classic-world,region-map-seedling-paints,region-map-follow-player,region-map-custom-set-atlas,region-map-watch-set-bundle,region-map-lab-apworld-door-seedling-set,region-map-discovery,region-map-clicks-generated,region-map-click-default,region-map-go-to-equals-canvas-click,region-map-zoom-pinch-links,region-map-mobile-tab,region-map-click-master-off,region-map-click-location-check,region-map-click-settings-independent,region-map-clicks-seedling,region-map-clicks-loop-mode,tutorial-walk-tracker-region-map
```

The runner executes them in this order: classic-world, zoom-pinch-links, mobile-tab, seedling-paints,
follow-player, discovery, clicks-generated, click-default, click-master-off, click-location-check,
go-to-equals-canvas-click, click-settings-independent, clicks-seedling, clicks-loop-mode, custom-set-atlas,
watch-set-bundle, **the walk (17th)**, lab-apworld-door-seedling-set.

- **On a clean checkout of base `817d620e30`, bundled, the walk FAILED**: *"tracker-region-map — ready, but it
  fails at step 11 of 15 (click-region): its done check never held"*. The done check was polled for its full
  window (click-region took 16.8 s). Every bundled run of that list that I made at base failed, 3 of 3 (one
  plain, two carrying temporary diagnostics).
- With temporary diagnostics in the failing run: the pick worked (status `Went to region level_2.`), but there
  were **0** `.region-block` elements. The container text read `Loading region data...`. The one RegionUI instance
  was initialized, its `visitedRegions` held 3 entries, and by then the proxy held a snapshot and 307 regions. The
  log had 2 to 3 bails ("Static region data or snapshot not ready"), the first at row 9 (click-master-off) during a
  world load, followed by 222 to 270 `available-content element not found` warnings.
- **Bisect: no single row does it.** Each predecessor paired alone with the walk passed (discovery, click-default,
  clicks-generated, follow-player, clicks-loop-mode). The first eight predecessors with the walk failed and the last
  eight passed. Of those first eight, follow-player + discovery + clicks-generated + click-default with the walk
  failed once and passed once. That is the signature of a race, not of leaked state.
- **Unbundled**, tiled-squares-cap measured the same list PASSING 3 times out of 3 at its tip. In my unbundled runs
  the bail never fired, so the window seems to exist only on the bundled boot's timing.

## The fix

The fix is in the app, as ruled, not in a test row. The walk sets no state that it lacks, and no row leaks any.

- New `frontend/modules/regions/regionsLoadingState.js`: `showRegionsLoading(container)` empties the sections'
  *content* (the old world's blocks go, as they did before) and hides the two sections with the `hidden`
  attribute. That attribute is separate from the `style.display` the renderer sets per sort method. It then
  prepends a `<p class="region-loading-message">Loading region data...</p>`. `clearRegionsLoading(container)`
  removes the message and the `hidden` attributes again.
- `regionUI.js`: the bail calls `showRegionsLoading`, and the first line after the data check calls
  `clearRegionsLoading`. That is +4/-3 lines plus an import.
- **The regression guard** is `frontend/modules/regions/regionsLoadingState.test.js` (3 rows). It drives the REAL
  `RegionUI.prototype.renderAllRegions` bail, then the REAL `RegionRenderer.renderRegions`, over a fake DOM whose
  `innerHTML` setter drops children as the real one does. Both mutants were measured red: with the old
  `innerHTML =` write back, all 5 section ids are missing; with the `clearRegionsLoading` call dropped, the "render
  after the bail" row fails. No persisted setting is involved, so the review's settings-key guard does not apply.

## Proof (at `2b438bbeba`)

| What | Where | Result |
|---|---|---|
| The failing order, bundled | local ×3 (`test-results-2026-11-24T02-46-56`, `…02-52-14`, `…02-58-07`) | **18/18 each**. The bail FIRED in two of them (2 and 3 times), and there were **0** `not found` warnings, so the panel recovered |
| The failing order, unbundled | local (`…03-04-17`) | 18/18 |
| The walk solo, bundled | local (`…03-05-21`) | PASSED (53.5 s) |
| The failing order on CI, bundled ×3 | `test-substrates-repeat.yml -f test=<the 18 ids> -f repeat=3 -f bundled=true`, run 45317213361 | **Rate: 3/3 passed**. The walk took 17.2 to 17.6 s each time |
| The walk ×8 | `test-substrates-repeat.yml -f test=tutorial-walk-tracker-region-map -f repeat=8`, run 45317210191 | **Rate: 8/8 passed** |
| `-f batch=tutorials-tracker` | 45317206679 | success; **headroom 67.2 s of 600 s (11 %)**. Base 363564bffa run 45276137574 took 57.4 s: +9.8 s |
| TT (`test-templates.yml`) | 45317203641 | every job success: ALTTP spoiler & regression; fast **331.3 s (55 %)**, base main push 45304232746 330.4 s; fast bundled **334.1 s (56 %)**, base 319.8 s (+14.3 s); apworld, seedling-js, seedling-js-solver, seedling-wasm, playback-bot |
| JSUT (push) | 45317114255 | success, 1429 files / 30035 tests, 0 failed. Base 45294214947 had 1428 / 30032: **+1 F / +3 T** (the new file) |
| unittests (push) | 45317114408 | success |
| Bounded vitest | `regionMap/ tutorials/ regions/` + `regionView/reachabilityCopies.equivalence.test.js` (the importers) | 19 files / 254 tests pass |
| DOM once data is present | `scripts/dev/region-panels-dom-snapshot.mjs`, default presets × S1–S7, base vs tip, `diff -r` | **moved 0 of 336 files** (0 of the 168 Regions-panel files). Oracle 0 mismatches |
| Closure ∩ diff | `seedlingDerivedRuleTable.js --print-engine-closure` | ∅; engineMd5 `74ae60f575531492ed9eaec1839e1fe3` (42 files), the same at base and tip. 0 gitlinks |

The two pre-existing poll warnings appear in every run of the list, before and after the fix: region-map-discovery's
"fit all" (STARVED/STUCK) and region-map-clicks-loop-mode's "loop mode: fit all" (STARVED). Both rows pass, and the
warnings are not this defect.

## The sweep

**The other five `Loading …` sites**, measured at base. Each one writes `innerHTML = '<p>Loading …</p>'` on the same
kind of bail.

| Site | Container's static content | Later render | Verdict |
|---|---|---|---|
| `regions/regionUI.js:754` | the section skeleton (template :278–292) | the renderer looks the sections up and never rebuilds them | **stuck: fixed** |
| `dungeons/dungeonUI.js:169` | `#dungeon-details-container` is empty (:122) | `innerHTML = ''`, then appends blocks (:177) | recovers |
| `exits/exitUI.js:517` | `#exits-grid` is empty (:314) | `innerHTML = ''` + rebuild (:846) | recovers |
| `helpers/helperUI.js:267` | `#helper-details-container` is empty (:107) | `innerHTML = ''`, then appends (:283) | recovers |
| `locations/locationUI.js:752` | `#locations-grid` is empty (:431) | `innerHTML = ''` + rebuild (:1190) | recovers |
| `presets/presetUI.js:1297` | the preset list container | rewrites the whole list each call | recovers |

The other `innerHTML` writes in `regions/` are not skeleton wipes: `regionRenderer.js:297/304/311` empty the
sections' *content*, and the `regionBlockBuilder.js` writes build per-block children.

**The other walks after the same 16 rows**, bundled at the tip, run `test-results-2026-11-24T03-13-01`: track-a-game
(which also reads the Regions panel's blocks), path-analyzer, region-graph, dungeons and helpers all passed, 21/21.
⚠ The bail did not fire in that run (0 bails), so it shows those walks pass after those rows. It does not show them
surviving a bail. For the Regions panel that guarantee comes from the fix itself, and the other panels recover by
construction (the table).

## How to catch the next one

- **A red walk whose app state looks right is worth one diagnostic dump of the panels it reads.** The walk's failure
  line names the panel status and the Playback Bot, not the panels its done check reads. Here, one dump of the pick
  status, the Regions blocks and the container text named the cause at once. Bisecting rows only showed that no
  single row was to blame.
- **When no single row reproduces an order failure, look for a race that one event can make permanent.** Here a
  transient "no data yet" became permanent damage. Any `innerHTML =` on a container whose children are looked up
  later (ids queried by a renderer) has the same shape. The quick audit: for each loading or error message written
  with `innerHTML`, does the template give that container children?
- **The panel logs said it** (`available-content element not found`, hundreds of times). A warning that repeats on
  every render after a single event is the defect, not noise.
