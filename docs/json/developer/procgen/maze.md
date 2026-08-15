# Maze Substrate

The maze substrate (`frontend/modules/mazeRoom/`, substrate id `maze`) renders regions as grid-of-tiles maze rooms: the player walks tile by tile, picks up items by stepping onto location tiles, and leaves through exit tiles on the perimeter. It is the most fully-featured substrate — the only one supporting every loop-queue action type and saved custom queues — and its tile-grid engine doubles as the shared implementation the text-adventure substrate builds on (`shared/procgen/adapterPrimitives.js`).

The module splits cleanly: `mazeRoomEngine.js` is headless (no DOM, no eventBus), `mazeRoomUI.js` is the panel, `mazeRoomLibrary.js` is the registry entry, and `index.js` wires registration and re-exports the engine surface.

## The engine (`mazeRoomEngine.js`)

A world is a `width × height` grid of floor/wall tiles (an `Int8Array`), an entrance, and a `Map` of exits (`exit_id → { x, y, side, exitName, targetRegion, … }` — multi-exit by construction). Movement inputs are `N`/`S`/`E`/`W`; a `WAIT` pseudo-input exists at the playback level (it advances the turn without calling the engine's `step`, and path planners emit it for deliberate waiting). Feasibility questions ("can the player reach every exit?") go through the shared simulator core's `reach`/`makeBfsSolver` — the maze was the first consumer of that interface ([Playback and Debugging Tools](./playback-and-debugging.md#the-shared-simulator-core-frontendmodulessharedsimulatorcorejs)).

Region generation composes: resolve the biome → run its wall backend → apply its post-processors → check feasibility → place obstacles, items, and logic gates to satisfy the region's access rules → extract paths-and-obstacles for verification. Placement is guaranteed: when no reachable floor tile is free for a location, the region grows and placement retries rather than silently dropping the location.

## Biomes and wall backends

A **biome** is a named bundle of (backend, params, post-processors) in `mazeRoomBiomeLibrary.js`; a **backend** is one wall-generation strategy, registered by id in the shared `mazeAlgorithms/registry.js` (kept in `shared/procgen/` so a future grid-based substrate could reuse it). Per-region biome selection lives in `preset_sidecars[player][region].biome`; unspecified regions fall back to `classic`.

| Biome | Backend | Character |
|---|---|---|
| `empty` | `empty` | No walls — showcases the topology layer |
| `classic` (default) | `random_walls` | Uniform random wall proposals with a feasibility check |
| `corridor` | `corridor_only` | Shortest path entrance→exits; everything else wall |
| `branchy` | `recursive_backtracker` (newest picker) | Long winding corridors, deep dead ends |
| `bushy` | `recursive_backtracker` (random picker) | Prim's-like, shorter branches |
| `loopy` | `kruskals` + `braid(p: 0.5)` | Perfect maze with some loops braided in |
| `open` | `kruskals` + `braid(p: 1.0)` | Every dead end removed |
| `rooms` | `recursive_division` (minRoom 3) | Chambers connected by single-tile gaps |

Adding a biome that uses an existing backend is a one-line change to the biome table; adding a backend is a new file under `mazeAlgorithms/` plus a registry entry. Post-processors (`braid`, `pruneDeadEnds`) are looked up the same way.

**Where the backends live, and the grid contract.** The backends are split across two directories by what they need. `recursive_backtracker`, `kruskals` and `recursive_division` sit in `shared/procgen/mazeAlgorithms/` beside the registry, `cellGrid.js`, `postProcessors.js` and `gridTiles.js`, because they touch a world only through the **grid contract** written down in `gridTiles.js` — `{width, height, tiles: Int8Array (row-major, index = y*width + x), entrance: {x,y}, exits: iterable of {x,y} via values()}` plus `TILE_FLOOR`/`TILE_WALL`/`getTile`/`setTile` and an `rng.next()` in [0,1). No inventory, no obstacles, no simulator. That makes them usable as carvers by any grid substrate, which is what the registry's "room for a future grid-based substrate" note always promised. `corridor_only` and `random_walls` stay in `mazeRoom/mazeAlgorithms/` because they run the maze simulator (`createState`/`apply`/`bfsSolver`/`reach`) to check feasibility, and `empty` stays with them. `mazeRoomEngine.js` imports the five `gridTiles.js` definitions and re-exports them under the same names, so maze-side callers import them from wherever they always did. `mazeAlgorithms/index.js` still performs all six registrations, and its import order is the order `listBackends()` returns.

## The maze as the second substrate on the procgen loop

`procgenMaze.js` binds the maze to the substrate-agnostic generator loop in
`frontend/modules/procgenCore/` — the same loop that generates Seedling levels,
not a maze-local copy of it. It supplies the loop's three injections. The
**model** builds the skeleton (the plain open room `createWorld` already gives:
all floor, entrance at (0,0), one exit at a goal cell drawn from the room stream
*before* anything else, so a carver dropped in later as a `skeleton()` kind
cannot move the goal), offers anchors by one seeded shuffle of the *whole* grid
and taking the first legal cells, adjudicates a named cell once in `refusalAt`
(with `legalAt` derived from it), and `place`s a template's tiles, obstacles and
items together into a **clone** — the maze world is mutable and the loop's
revert is "keep the old record", so a `place` that wrote in place would leave
rejected candidates standing. The **oracle** is `reach` + the maze `bfsSolver`
against "the player stands on the goal tile", and it certifies by **replaying
the returned plan through `step`** rather than trusting the solver's own `ok`;
`BUDGET_EXHAUSTED` is a real class because `makeBfsSolver` has a real node cap
(`options.budget`), though the default 20,000 never binds on a room whose whole
state space is 242 states. The **palette v1** is two parameterized templates:
`wall-segment` (ori × len, paints `TILE_WALL`) and `door-key` (a `door_red` at
the anchor and its `key_red` at a parameterized offset, placed atomically, so
no world ever holds a door whose key was never placed).

⛔ What palette v1 is **not** yet: it does not check that a door is a **cut
vertex** — `placeGateAndKey` does that, and generalising it is a later slice. A
door the walk can simply walk around is a kept candidate that happens to be
decoration, which the arc's yield table will measure rather than assume. There
are no carved skeleton kinds yet (the room is always open), no hazards, no
pushable blocks — those are later slices of the same arc.

`scripts/procgen/generate-maze-level.mjs` is the CLI twin of
`generate-seedling-level.mjs`: a seed and the bounds in, the level, the full
generation trace and the summary out as JSON, with stdout as the determinism
channel and `--verify` spawning two fresh child processes to prove the payload
is byte-identical across them.

## The maze lab page (`frontend/modules/mazeRoom/lab.html`)

A **standalone static page** — no frontend, no GL panel, no eventBus — that
generates, edits and solves maze levels from URL parameters alone. It is the
maze's counterpart of `seedlingDemo/watch.html`, and what the two have in
common now lives in `frontend/modules/procgenCore/`
(`urlParams.js`, `labView.js`, `paletteRoster.js`, `pageLifetime.js`) rather
than being written twice.

```
python3 -m http.server 8000        # from the repo root
http://localhost:8000/frontend/modules/mazeRoom/lab.html?seed=3&count=4&run=1
```

Its headless half is `mazeLab.js` (URL reader/writer, the three modes' logic,
the payload); its DOM arm is `mazeLabView.js`; its unit tests are
`mazeLab.test.js`.

### The three modes

A `?source=` selector switches between them **in place** — no reload — and each
switch starts a new page lifetime (`procgenCore/pageLifetime.js`) so the arm
being left drops its listeners.

| mode | what it does |
|---|---|
| `generate` (default) | the loop, in the page. STEP places one template and re-solves; RUN-ALL runs to the target or to SATURATION. The generation pane shows every attempt with its outcome word (`KEPT` / `REVERTED` / `NO_ANCHOR` / `ILLEGAL_PLACEMENT`) and the oracle's **verbatim** refusal. A catalogue lists what the palette can generate, by family; unticking a family RESTRICTS the roster the run may draw from, and ATTEMPT on a row runs one directed attempt for that template. |
| `edit` | `mazeRoomEditor.js`'s palette — floor / wall / entrance / item / obstacle / erase — applied to the clicked tile. Every edit lands on a **clone**, so UNDO is a pop of a world stack and the level the page says it generated is never rewritten underneath it. |
| `solve` | `mazeOracle` on the world now on screen, with the plan drawn over the room: SOLVED / REFUSED / BUDGET_EXHAUSTED, reason verbatim. |

A step-*k* level **is** `generate-maze-level.mjs --seed=S --count=k`, byte for
byte, because it is the same call — the browser row asserts that across the two
runtimes.

### Identity and certification

The URL carries a **run somebody could type**; it does not carry manual edits.
An edited level's identity is the **payload** (`?gen=` / the save box /
download-upload), and the page says so the moment there are edits:

```
seed 3 · maze-v1 · 11x11 · step 4, then 2 manual edit(s)  ·  palette: maze-v1 …
UNCERTIFIED — nothing has solved the world now on screen  ·
⚠ the URL is NOT a reproduction after edits — the PAYLOAD is
```

**Editing never bypasses the oracle.** Any edit that *changes the world* drops
the certification, and the readout says UNCERTIFIED until SOLVE puts a verdict
back. An edit the editor refused, or one that changed nothing (`Tile (3,3)
already floor.`), is not an edit: `applyEdit` compares the serialised worlds
rather than trusting the editor's own descriptor. A loaded payload is
uncertified whatever the file claimed — this page's certification is its own
oracle's answer or nothing.

### The URL grammar

Shared with `watch.html` through `procgenCore/urlParams.js`:
`?source=` `?seed=` `?biome=` `?count=` `?tries=` `?k=` `?anchortries=`
`?families=` / `?templates=` `?directed=` `?run=1` `?gen=`.

Maze-only, each with the line that forced it:

| parameter | why it exists here and not on `watch.html` |
|---|---|
| `?width=` / `?height=` | the ROOM. The v1 palette on the default 11×11 room reverts **nothing** over seeds 1–12; reverts appear at 5×5/target 12 and saturation at 4×4. Without this the REVERTED and SATURATED panes are unreachable and a reader would conclude the palette refuses nothing. Try `?width=5&height=5&count=12&run=1`. |
| `?expansions=` | the BFS **node cap**. Seedling's budget is `?tickbudget=`, denominated in solver *ticks*; one word for both would be two spellings of "the budget". The default (20000) never binds on a v1 level — the state space is `cells × 2^items` = 242 — so `?expansions=1` is how `BUDGET_EXHAUSTED` is reached on purpose. |

`?biome=` selects the **palette** (`maze-v1` today), not a wall backend. The
maze's own biome vocabulary arrives as `?skeleton=` in a later slice; spelling
those `?biome=` would have been the real collision.

There is **no `?skeleton=` yet** — it lands in both pages together.

### `drawWorld`'s `view` contract

The panel's canvas draw was extracted to `mazeRoomRender.js` so the panel and
the page paint one picture: `drawWorld(ctx, world, view)`. **`view` is the whole
input** — every `this.*` the panel's `_drawWorld` used to read is now a named,
required field, and `assertView` refuses a missing one by name rather than
defaulting it (a default for `isTileVisible` is "everything is visible", which
is a picture chosen by the renderer under a caller's name).

| field | meaning; `null` means |
|---|---|
| `tilePx` | tile side in canvas pixels — not defaulted; the caller sizes the canvas |
| `playerPos` | `{x,y}` \| `null` = draw no player |
| `inventory` | `Set` — decides whether a door reads cleared, and (outside playback) whether an item is still on the floor |
| `isPlayback` | playback tracks pickups per LOCATION, dev flow by inventory — the flag chooses, it does not merge |
| `checkedLocations` | `Set` — playback's per-location pickup truth |
| `ruleEvaluator` | `(rule) => boolean` \| `null` = the library's local subset evaluator |
| `fogEnabled` | boolean |
| `isTileVisible` | `(x,y) => boolean`, consulted only when `fogEnabled` |
| `seenTiles` | `Set` of `"x,y"` \| `null` = the fog blackout covers everything |
| `isExitVisible` | `(exit) => boolean` — discovery filter (playback only) |
| `isLocationVisible` | `(name) => boolean` — discovery filter (playback only) |
| `isConsumableCollected` | `(x,y) => boolean` \| `null` = nothing tracks them. The panel closes its region id into this; the page has no regions |

`plainView({tilePx})` is every filter off — what a page wants for a world it
just generated. The extraction's gate is `mazeRoomRender.test.js`: the unit
runner is `environment: 'node'` with no jsdom and no `canvas` package, so
nothing can rasterise, and the gate compares an **ordered draw-op log** (every
call and every property assignment, hashed) through a recorder that *throws* on
any member it does not model. The log records every state mutation as well as
the geometry, so equal logs ⇒ equal pixels — a stricter gate than a pixel hash.
Seven fixtures were captured from `_drawWorld` before the extraction and pasted.

### The browser row

```
node scripts/procgen/check-maze-lab.mjs
node scripts/procgen/check-maze-lab.mjs --host=http://localhost:8000
```

It brings its own static server on a free port (`serveRepoRoot`) and **has no
skip condition** — the rows that skipped when no dev server was up once hid a
page that could not load at all for two rungs. It asserts the import graph has
zero `node:`/bare specifiers, the page loads with zero console errors, the
browser reproduces node's level and trace byte for byte, STEP advances one rung
and the *pane* shows the outcome word, RESTRICT reaches the loop, the directed
attempt reports a named outcome with its keep-kind sentence, a click on a cell
the row computes itself paints that cell and the identity line says
"1 manual edit(s)" + UNCERTIFIED, SOLVE re-certifies while a sealed entrance
comes back REFUSED with the oracle's own text, the payload round-trips through
the save box, and the URL is a fixed point *whose literal values are asserted
against numbers the row states* (a fixed point tests self-consistency, never
correctness).

### What is not here yet

- **iframe hosting** — a later slice registers this page as an `iframePanel`
  instance with an eventBus contract. Nothing on the page assumes a host: no
  `window.parent`, no global an embedder must set.
- **`?skeleton=` and the carved skeleton kinds** — a later slice, in both pages
  together.
- **the yield table and the connectivity pre-check**, and the **cut-vertex
  rule** — a door the walk can walk around is a KEPT candidate that happens to
  be decoration today.

## The action queue (`mazeRoomQueue.js`)

A tile-level action queue with a Cavernous-2-style icon-row UI in the panel. Three verbs: `move` (N/E/S/W — block pushes ride the same verb via a content module's `onMove` hook), `wait` (one tick, spacebar), and `locationCheck` (explicit check at the current tile — used by saved/replayed queues and loops-delegation expansion; direct keypresses rarely emit it because checks fire as a side effect of stepping onto a location tile). Execution is synchronous, and the queue is what backs the maze's `customQueues: true` loop-mode capability.

The per-tile verbs make the maze the reference **fine-grained** substrate under the loop-recording capture contract: its visit recorder (in `mazeRoomUI.js`) captures the whole visit as one interleaved stream — `move`/`wait` inputs *and* the queue-grade `locationCheck`s — stashes it for loops to pull (`takeLastRecording`), and replays it via `replayActions`, crossing the recorded departure exit itself after the interior drains. Loops projects the coarse subset of that stream into the block's queued interior. See [Loop Recording and Block Modes](./loop-recording.md).

**Loop delegation and the Bot radio (M6).** The maze is the **delegation** solver — the odd one out among the solver substrates. On a `manaEnabled` region it declares `sharing.mana.loopActionDelegation`, and a **Bot**-mode block hands the current action to the panel (`loops:substrateActionBegan`), which walks it tile-by-tile through the visualizer, charges per tile natively (`_loopsDrivenAction`), and reports `loops:substrateActionCompleted`. This is a genuinely different driver from the `walkTo` path the other solver substrates use: the maze *has* a `walkTo` on its controller, but it drives the **visualizer** (a separate position tracker), while delegation drives the charging panel engine. M6 unified the *trigger* (the Bot radio, `regionSolver(region) → 'delegation'` here) and kept both drivers. Before M6, delegation fired from a pre-dispatch tick for any non-Manual block, which silently shadowed Record and Playback on these regions; that latent bug is gone by construction now that only a Bot block initiates. **Bot × Instant is deferred for the maze**: the controller's `instant()` drives the visualizer, but a delegated walk is tracked through that same visualizer's per-tick change stream (step buffer, per-tile charging, stuck detection), so collapsing its ticks touches the two-position-tracker split — `regionBotHonorsInstant` is false for the maze, and the checkbox is withheld. Not impossible; out of scope for M6.

## Content modules (hazards)

Content modules add gameplay content to a region without touching core substrate code. The registry (`shared/procgen/contentModules/registry.js`) sits alongside the wall-backend registry and shares its shape; a module declares any subset of the hook contract:

- **Build time:** `generate(world, opts, rng)` (called after wall layout and placement), `serialize(world)` / `deserialize(sidecar, world)` for the per-region sidecar payload, `procgenSettingsSchema` for auto-generated authoring controls.
- **Runtime:** `tickRuntime` (advance one turn), `validateMove` (veto a proposed move — multiple modules' vetoes are conjunctive), `onMove` (side effects after an allowed move), `render` (canvas overlay between the substrate render and the player sprite), `resetOnEntry` (region content is fresh on every entry).

The maze's registry entry exposes `applyContentModules`, which the pipeline engine calls after the base region build; substrates that don't declare it skip the pass.

The one shipped content module is **hazards** — patrolling dangers that cycle along generated paths. It is split into three pure pieces: `hazardPathGen.js` (geometry only — the tile sequence a hazard cycles along), `hazardRuntime.js` (cycle position, facing, move-validity checks), and `hazardRender.js` (overlay drawing). Pathfinding is hazard-aware and wait-aware: the autopather can plan routes that deliberately wait out a hazard's cycle.

## The autopather (`mazeAutopather.js`)

BFS pathfinding over maze worlds, used by the playback controller, the queue, and exploration UI. Target kinds: a specific tile, an exit, a location, or `closestUnexplored` (the nearest walkable un-seen tile, given `opts.seenTiles` — walking onto it clears fog around the new position, priming the next leg). Returns `{ steps, length }` including both endpoints, or `null` when unreachable. Walkability is inventory-aware when an inventory is provided (tiles holding obstacles the inventory can't clear block) and geometry-only otherwise, which is the mode procgen-time callers use.

## Panel and runtime

The panel (`mazeRoomUI.js`, component `mazeRoomPanel`) subscribes to `maze:loadRegion`. A load event that arrives before the panel mounts is buffered (`pendingLoadRegion` in `index.js`) and drained by the panel constructor — one of the standard init-race catch-ups. On load the module self-activates its panel unless the loops panel has "Keep this panel focused" set while its queue is driving.

Around the core panel:

- The **playthrough visualizer** (`mazeRoomVisualizer.js`) auto-walks the region with its own simulated state — see [Playback and Debugging Tools](./playback-and-debugging.md#per-substrate-visualizers).
- The **editor** (`mazeRoomEditor.js`) edits a loaded region in place with a tile palette: floor/wall, the entrance, items (with AP-canonical location names), and obstacles. Exit placement and logic-gate editing are not part of its palette.
- The **game-data inspector** is a separate read-only module/panel (`frontend/modules/mazeGameDataPanel/`).

## A real game's map as maze regions

Besides generating worlds, the maze substrate can be handed one: the region
atlas's **maze projection** (`procgenPipeline/regionAtlasMazeProjection.js`,
plan `CC/docs/plans/region-atlas-plan.md` Phase 5b, preset
`seedling_atlas_maze`) compiles a marked real-game region into one maze world
per AP sub-region. The sub-region's own zero-item-reachable cells are floor and
everything else is wall, a crossing between sub-regions is an exit tile carrying
a `clear_set_type: 'rule'` obstacle with the atlas's access rule, and a location
is an item overlay with its AP location name. Nothing in mazeRoom knows about
it — the projection speaks the ordinary sidecar shape, which is the point.

Two payload facts are load-bearing for **any** hand-built or projected maze
sidecar, not just that one:

| | |
|---|---|
| **`exit_id` IS `exitName`** | Every generated maze sidecar holds this (`{exit_id: 'exit_1', exitName: 'exit_1'}`) and it is not cosmetic. `createWorld` keys `world.exits` on `exit_id`, the panel publishes `user:regionMove` with `exitName`, and `procgenPlayer.handleRegionMove` resolves the arrival by asking the SOURCE world for `exits.get(exitName)` and reading its `targetExitId`. Key them apart and that lookup misses **silently**: `targetExitId` is never read and every arrival falls back to `world.entrance` instead of the crossing the player walked through. (The flash family differs — its `deserializeWorld` keys on `exitName ?? exit_id` and its glue resolves an arrival against `exits[].exit_id`.) |
| **Semantics live in the overlays** | The tile grid is binary (floor/wall). Anything conditional is an obstacle, an item, a consumable or a mana tile on top of a floor tile — never a new tile value. |

## Registry entry

The maze entry implements the full procedural build-time contract (`generateRegionCore`, `placeFromItems`, `placeFromRules`, `extractPathsAndObstacles`, `serializeWorld`, plus `applyContentModules`) and the full loop-mode surface (`regionMove`/`locationCheck`/`explore` queue actions, manual play, custom queues, `record`/`playback`/`instant`, and the `takeLastRecording` recorder hook). Field-by-field detail: [Substrate Registry Reference](./substrate-registry.md).

## Related documentation

- [Architecture](./architecture.md)
- [Substrate Registry Reference](./substrate-registry.md)
- [Loop Recording and Block Modes](./loop-recording.md)
- [Playback and Debugging Tools](./playback-and-debugging.md)
