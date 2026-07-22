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

## The action queue (`mazeRoomQueue.js`)

A tile-level action queue with a Cavernous-2-style icon-row UI in the panel. Three verbs: `move` (N/E/S/W — block pushes ride the same verb via a content module's `onMove` hook), `wait` (one tick, spacebar), and `locationCheck` (explicit check at the current tile — used by saved/replayed queues and loops-delegation expansion; direct keypresses rarely emit it because checks fire as a side effect of stepping onto a location tile). Execution is synchronous, and the queue is what backs the maze's `customQueues: true` loop-mode capability.

The per-tile verbs make the maze the reference **fine-grained** substrate under the loop-recording capture contract: its visit recorder (in `mazeRoomUI.js`) captures the whole visit as one interleaved stream — `move`/`wait` inputs *and* the queue-grade `locationCheck`s — stashes it for loops to pull (`takeLastRecording`), and replays it via `replayActions`, crossing the recorded departure exit itself after the interior drains. Loops projects the coarse subset of that stream into the block's queued interior. See [Loop Recording and Block Modes](./loop-recording.md).

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

## Registry entry

The maze entry implements the full procedural build-time contract (`generateRegionCore`, `placeFromItems`, `placeFromRules`, `extractPathsAndObstacles`, `serializeWorld`, plus `applyContentModules`) and the full loop-mode surface (`regionMove`/`locationCheck`/`explore` queue actions, manual play, custom queues, `record`/`playback`/`instant`, and the `takeLastRecording` recorder hook). Field-by-field detail: [Substrate Registry Reference](./substrate-registry.md).

## Related documentation

- [Architecture](./architecture.md)
- [Substrate Registry Reference](./substrate-registry.md)
- [Loop Recording and Block Modes](./loop-recording.md)
- [Playback and Debugging Tools](./playback-and-debugging.md)
