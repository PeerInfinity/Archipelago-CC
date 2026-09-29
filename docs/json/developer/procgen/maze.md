# Maze Substrate

The maze substrate (`frontend/modules/mazeRoom/`, substrate id `maze`) renders each region as a grid-of-tiles room: the player walks tile by tile, picks up items by stepping onto location tiles, and leaves through exit tiles. It is the only substrate with saved custom queues, and it doubles as the second binding of the procgen level generator.

The module splits into a headless engine (`mazeRoomEngine.js`, no DOM and no eventBus), the panel (`mazeRoomUI.js`), the registry entry (`mazeRoomLibrary.js`) and `index.js`, which registers the module and re-exports the engine surface. The standalone page that generates, edits and solves maze levels has its own document: [The Maze Lab Page](./maze-lab.md).

## The engine (`mazeRoomEngine.js`)

A world is a `width × height` grid of floor/wall tiles (an `Int8Array`), an entrance, and a `Map` of exits (`exit_id → { x, y, side, exitName, targetRegion, … }`). Items, obstacles, blocks, buttons, consumable tiles and mana tiles are overlays on floor tiles; the tile grid itself stays binary.

The inputs are `N`/`S`/`E`/`W` (`INPUTS`) plus `INPUT_WAIT`, which returns a clone with `turn + 1` and nothing else changed. A wait is deliberately not in `INPUTS` or the BFS solver's input list: `mazeVisitedKey` ignores `turn`, so the search would prune it as a self-loop. Feasibility questions go through the shared simulator core's `reach` / `makeBfsSolver` (the engine's instance is `bfsSolver`); see [Playback and Debugging Tools](./playback-and-debugging.md#the-shared-simulator-core-frontendmodulessharedsimulatorcorejs).

Region generation (`generateRegionCore`) resolves the biome, runs its wall backend and post-processors, checks feasibility, places obstacles, items and logic gates to satisfy the region's access rules (`placeFromItems` / `placeFromRules`), then extracts paths and obstacles for verification (`extractPathsAndObstacles`). When no reachable floor tile is free for a location, the region grows and placement retries rather than dropping the location.

**Where a placement lands.** Each item goes on a tile drawn with one rng value, uniformly, from the tiles the player can reach from the entrance that are free (not the entrance, an exit, an item or an obstacle); a gate-and-key pair's key is drawn the same way from the tiles before its door, never one already holding an item or an exit. The reachable set is `reachableTileFixpoint`: a position BFS under the carried items plus every pickup an earlier pass stood on, repeated until a pass collects nothing new, so it costs O(tiles × passes) with at most (distinct pickups + 1) passes, once per placement. It is exact because clearance is monotone in the inventory (no rule construct the engine knows closes a passage when an item is added). Buttons and blocks are not monotone, so a world with either keeps the full-state BFS (`reachableTilesByKey`), whose state count is (floor tiles) × 2^u for u pickups collectable without a gate. Until APWORLD SUBSTRATE CHANGE C1 every world used that full-state list, which repeated a tile once per inventory it was first reached under. The draw was weighted by those repeats, and open rooms with a dozen ungated locations took seconds to minutes. C1 changed the draw and re-recorded the rooms it moved (`procgen_topdown` AP_1–12 and `seedling_atlas_sphere`).

**How big a room is built.** A room needs a free reachable tile for every location that takes one (an item or a gate). The maze declares that as its `locationCapacity` (`mazeLocationCapacity.js`). An open room holds `width × height − 1 − exits` locations, and at most the site-percolation share (`1 − 0.592746`) of that floor may be gated, because each gate is a wall to the placer's reach. A walled room declares nothing: its floor depends on the wall draw. Since APWORLD SUBSTRATE CHANGE C2 the realiser (`generateRegionProcedural`) starts a room at the first size on its grow ladder that the declaration says holds it. It no longer re-rolls four times at a size that cannot and then grows a step per attempt (a 340-location room took nine builds to reach 27×27). The retry-then-grow stays as the fallback. No committed room moved: every one fits at the size it was asked for. See [Substrate Registry](./substrate-registry.md#build-time--location-capacity).

**The sidecar round trip.** `deserializeMazeWorld` (engine) reads a region's `preset_sidecars` payload; its inverse `serializeMazeWorld` is in `mazeSerializer.js`, a separate file to avoid an import cycle with `mazeGeometry.js`. `shared/procgen/adapterPrimitives.js` re-exports the pair as `tileGridDeserializer` / `tileGridSerializer`.

### `whyBlocked` — why the engine refused, in one place

`whyBlocked(world, state, input, inventoryOverride, clearanceOpts)` returns `null` for a legal move or a wait, and otherwise one sentence: `wall at (x,y)`, `off the grid`, `door_red is shut — needs key_red`, `door_A0 is shut — nothing on button_A0`, or `block at (x,y) cannot move: …`. It sits beside `step` and checks in the same order, because only the engine's effective inventory can tell a missing item from an unpressed button. `mazeQueueExecutor.refusalReason` delegates to it. Its test is a property: over every reachable `(state, input)` of three fixture worlds, `whyBlocked(...) === null` exactly when `step(...) !== null`.

## Biomes and wall backends

A **biome** is a named bundle of (backend, params, post-processors); a **backend** is one wall-generation strategy, registered by id in `shared/procgen/mazeAlgorithms/registry.js`. A region picks its biome in `preset_sidecars[player][region].biome`; an unspecified region uses `classic`.

The table is `BIOMES` in `procgenCore/skeletonKinds.js` (re-exported by `mazeRoomBiomeLibrary.js`). Biome names are also the procgen loop's **skeleton kinds** — the room a generated level starts from — for both the maze and Seedling, which is why the table lives in a neutral module.

| Biome | Backend | Character |
|---|---|---|
| `empty` | `empty` | No walls; showcases the topology layer |
| `classic` (default) | `random_walls` | Uniform random wall proposals with a feasibility check |
| `corridor` | `corridor_only` | Shortest path entrance → exits; everything else wall |
| `branchy` | `recursive_backtracker` (newest picker) | Long winding corridors, deep dead ends |
| `bushy` | `recursive_backtracker` (random picker) | Prim's-like, shorter branches |
| `loopy` | `kruskals` + `braid(p: 0.5)` | Perfect maze with some loops braided in |
| `open` | `kruskals` + `braid(p: 1.0)` | Every dead end removed |
| `rooms` | `recursive_division` (`minRoom` 3) | Chambers connected by single-tile gaps |
| `winding` | `recursive_backtracker` (newest) + `pruneDeadEnds` | One winding corridor entrance → goal |

`winding` differs from `corridor`: `corridor` is the BFS shortest path and needs the simulator, while `winding` keeps the spanning tree's own wandering route. Its `pruneDeadEnds` threshold of 9999 means "run to a fixed point".

**Warning:** `skeletonKinds.js` holds two defaults that must stay separate. `DEFAULT_BIOME_ID` (`classic`) is what an unconfigured AP region generates; `DEFAULT_SKELETON_KIND` (`empty`) is what the procgen loop starts from.

A biome that uses an existing backend is a one-line table entry. A new backend is a new file plus an import in `mazeRoom/mazeAlgorithms/index.js`, which performs all six registrations in the order `listBackends()` returns. Post-processors (`braid`, `pruneDeadEnds`, `chambers`) are in `shared/procgen/mazeAlgorithms/postProcessors.js`.

| Directory | Backends | Why there |
|---|---|---|
| `shared/procgen/mazeAlgorithms/` | `recursive_backtracker`, `kruskals`, `recursive_division` | Use only the grid contract, so any grid substrate can carve with them |
| `mazeRoom/mazeAlgorithms/` | `empty`, `random_walls`, `corridor_only` | The last two run the maze simulator to check feasibility |

The **grid contract** is in `shared/procgen/mazeAlgorithms/gridTiles.js`: `{width, height, tiles: Int8Array (row-major, index = y*width + x), entrance: {x,y}, exits: iterable of {x,y} via values()}`, plus `TILE_FLOOR` / `TILE_WALL` / `getTile` / `setTile` and an `rng.next()` in [0,1). The engine re-exports those definitions.

### Kind parameters

A kind may declare **knobs** in the `[{key, domain, default, why}]` schema parameterized templates use (checked by `templateContract.assertParamSchema`). One parser, `skeletonKinds.parseSkeleton`, reads them: `?skeleton=<kind>;<key>=<value>;…` on the lab pages, `--skeleton='rooms;minRoom=2'` on both CLIs (quote it; `;` is special to the shell), `--kinds=` on the sweep.

| Knob | Kinds | Domain | Default | Effect |
|---|---|---|---|---|
| `minRoom` | `rooms` | 2, 3, 4 | 3 | Smallest chamber `recursive_division` cuts; the only knob passed to the backend |
| `prune` | `bushy`, `loopy` | 0, 1 | 0 | Fill every dead end back in |
| `chambers` | every carving kind (all but `empty`, `classic`, `corridor`) | 0–3 | 0 | Stamp *k* open 3×3 squares onto the finished carve |

- **A knob at its default changes nothing.** A post-processor knob is appended only when off its default, so no draw is spent and existing seeds keep their levels.
- **Draw order is part of a level's identity:** goal cell, backend, the table's post-processors, then knob-added ones in declaration order. `chambers` must be declared last (checked at load), or a prune would remove the chambers.
- **`prune` is a boolean** because `pruneDeadEnds` runs to a fixed point. It is not offered on `branchy` (the result equals `winding`) or `open` (nothing left to prune).
- **`chambers` only turns wall into floor**, so it cannot disconnect anything. Its margin is the caller's: Seedling passes 1 to keep its border ring, the maze 0.

Which kinds a binding offers is declared: `classic` and `corridor` carry `needs:` because their backends need the maze simulator, and `kindsOffered({ simulator })` filters on it, so Seedling refuses them by name.

## The maze as the second substrate on the procgen loop

`procgenMaze.js` binds the maze to the substrate-neutral level generator in `frontend/modules/procgenCore/`, the same loop core that generates Seedling levels. The loop itself — its two passes and the pass-1 draw order — is described in [Architecture](./architecture.md). The maze supplies:

- **The model** (`mazeModel`). The skeleton is the room `createWorld` gives, with the entrance at (0,0) and one exit at a goal cell drawn from the room stream before anything else, so no skeleton kind can move the goal. Then come the carve, the optional element and the optional area graph. Anchors are one seeded shuffle of the whole grid; a named cell is judged once in `refusalAt` (`legalAt` derives from it); a template's tiles, obstacles and items are placed together into a **clone**, because the loop reverts by keeping the old record.
- **The oracle** (`mazeOracle`): `reach` plus `bfsSolver`, with the goal "the player stands on the goal tile". It certifies by replaying the plan through `step` rather than trusting the solver's `ok`. `BUDGET_EXHAUSTED` is a real outcome: the node cap is `DEFAULT_MAZE_BUDGET` (`maxExpansions: 20000`).
- **The palette** (`MAZE_PALETTE`, `MAZE_TEMPLATES`): `wall-segment` (orientation × length) and `door-key` (a `door_red` at the anchor and its `key_red` at an offset, placed together).

**Note:** `door-key` is not checked to be a cut, so a door the player can walk around is kept as decoration. Area-graph locks are cuts by construction; Seedling's flood-based door law (`doorLawRefusal`) is not bound on the maze's palette.

`generateMazeLevel` runs model, oracle and loop, then the cost records and the `require` outcome when the area graph or an element ran. Its defaults (11×11 room) are `MAZE_DEFAULTS`.

### The connectivity pre-check

`refusalAt` also refuses, by name and before any solve, **a candidate whose tile writes would disconnect the entrance from the goal**, using one flood in `procgenCore/gridFlood.js` shared with Seedling. Since `legalAt` derives from it, `anchorsFor` stops offering sealing cells and the loop reports `NO_ANCHOR` rather than spending a solve; a directive naming such a cell gets `ILLEGAL_PLACEMENT`. It reads tiles only, so it never refuses a `door-key` (passability depends on the key). Reverts that remain are the oracle refusing through an item, such as a wall that cuts off a key.

### The command-line twin

`scripts/procgen/generate-maze-level.mjs` is the CLI twin of `generate-seedling-level.mjs`: seed and bounds in; level, generation trace and summary out as JSON on stdout. `--verify` runs two fresh child processes and checks the output is byte-identical. `scripts/procgen/sweep-yield-table.mjs` sweeps kinds × sizes × seeds and tabulates what the loop kept, reverted and refused.

## The area graph

The area graph is an optional **lock-and-key layer** above the carve, and this is its home document. The carved room is partitioned into **areas**; `procgenCore/areaGraph.js` (`buildAreaGraph`, a re-implementation of MetaZelda's logic) grows a tree over them in **key levels**; the binding realises each level as locks and keys. Both the maze and Seedling (`seedlingDemo/procgenSeedling.js`) use it. Seedling's key is a flag rather than an item; see [Paths and Obstacles](./paths-and-obstacles.md) and [Flash Substrate](./flash.md).

The knob is one string through one codec, `procgenCore/areaSpec.js` (`parseAreaSpec` / `formatAreaSpec` / `normalizeAreaSpec`): `--areas=` on the CLI and sweep, `?areas=` on the lab page.

```
<keys>[;key=value]…        0 · 1 · 2;graphify=0.5;goalShortcut=0
```

| Key | Domain | Default | Meaning |
|---|---|---|---|
| `keys` | 0–3 | 0 | Key-count target; at 0 the layer does not run and spends no draws |
| `partition` | `chambers` | `chambers` | How the room becomes areas (`procgenCore/areaPartition.js`) |
| `graphify` | 0, 0.2, 0.5, 1 | 0.2 | MetaZelda's extra-edge probability |
| `shortcut` | 0, 1 | 0 | Realise one `graphify` edge as a `door_SC` whose `key_SC` is reachable without it |
| `goalShortcut` | 0, 1 | 1 | Allow the post-solve entrance ↔ exit shortcut |

**What an area is.** A cell is *wide* if it belongs to an all-floor 2×2 square; an area is a maximal 4-connected blob of wide cells; other floor cells are corridors (edges). One-cell areas are added for the entrance and goal when they are not in a chamber; unreachable floor is not partitioned. So `empty` is always one area and a 1-wide carve has none: the layer is a `rooms` / `chambers=` feature and refuses by name elsewhere.

**How a lock reaches the grid.** The lock belongs to the area: for every area at key level L ≥ 1, `door_K{L-1}` goes on every boundary cell (a cell of the area touching floor outside it). That also closes junction corridors and cycles the tree did not use, which a per-edge door would leave open. `key_K{n}` goes on a non-boundary cell of the area the graph assigned it. Per-instance `obstacleLib` / `itemLib` entries (`door_K0 → key_K0`) travel in the payload; without them `isObstacleCleared` treats the door as unknown and it opens for everybody. Ids come from `doorIdFor` / `keyIdFor`.

**It is verified.** For each key level `n`, with doors above `n` treated as wall, the flood from the entrance must equal exactly the areas of level ≤ `n` plus the corridors touching them (`verifyAreaLevels`). Every failure — a mismatch, an unplaceable key, a graph the bounds refuse, a single-area partition, entrance and goal in one area — is a graded refusal naming the reason, and the carved room is left as it was. The loop's skeleton solve then certifies the room with its doors and keys before pass 2.

**Solver-work records.** When the layer runs, `summary.elements` carries per symbol the BFS plan length and nodes expanded with and without it, the key → door plan length, and the ablation proving the cut (remove the key and the goal is unreachable); `summary.kept[].cost` carries each kept template's before/after plan length. Nothing decides on them.

**Requiring a symbol.** `--require=K0` (CLI, sweep) or `?require=K0,K1` (lab page), parsed by `areaSpec.parseRequireList`, says *the run must place these symbols as locks the goal is beyond*. The proof is the ablation: removing `key_K` must leave the goal unreachable (`isCut`). A met symbol is graded `STRONG`, the only grade reachable on the maze because the BFS ablation is a proof. An unmet directive is a refused run, never a retry; the reasons are `MAZE_REQUIRE_REFUSALS`. The CLI then exits with code 6, and `summary.require` is `{asked, met: [{symbol, grade, planWith, planWithoutKey}], refused}` (absent when nothing was required).

## Blocks, buttons and the flag switch

The engine's state is `(player, blocks, inventory)`. Moving into a **block** pushes it one cell onward; the cell beyond must be floor, block-free and free of any un-cleared obstacle. A block does not open doors. `world.blocks` is a `Map(posKey → true)` of initial positions; the live ones are `state.blocks`, a sorted posKey array that is absent when the world has no blocks, so `mazeVisitedKey` is unchanged for block-free worlds.

A **button** (`world.buttons`, with `world.buttonLib` naming what each `holds`) is a walkable cell, pressed while a block or the player is on it. Pressing adds a derived token (such as `sw_A0`) to the effective inventory for that step only, so it is a *hold*: step off and the door shuts.

**Note:** clearance reads the stance before the move, so a player on a button can step into an adjacent door on their own press. Keep a button's door at least two cells away.

A **flag** (`flag_K0`) is an ordinary item whose library entry has `kind: 'flag'`: picked up on arrival and permanent. In region play it is an Archipelago location, like a key. Buttons are deliberately not in `world.items`, which would create a phantom AP check. `serializeMazeLevel` omits `blocks`, `buttons` and `buttonLib` when empty.

## The first element

An **element** (`procgenCore/elements.js`, one module per element in `procgenCore/elements/`) is a template placed in pass 1. `defineElement` gives it a `phase`: a **`pre-carve`** element is built before the carve inside a rectangle the binding offers, writes its own floor and wall, and declares its **ports**, the outside cells it needs kept (`demand`), and the **area** it is; an **`on-connector`** element is built after the carve with a read-only room probe, writes sparsely and has `area: null` (a door cuts an area, it does not make one).

The heads are `ELEMENT_TABLE` in `procgenCore/elementSpec.js`. **The maze binds only `guard`**, the pre-carve **reverse-pull block gadget** (`procgenCore/elements/reversePullBlock.js`); the other heads are Seedling's ([Flash Substrate](./flash.md)) and the maze refuses them as `the-element-is-not-a-maze-element`, spending no draw. The gadget is a block put on its button and pulled backwards `len` steps with `turns` direction changes. Reversed, that walk is a legal push sequence, so the gadget is solvable by construction, and the BFS certifies it anyway.

### The spec

```
--elements=<name>[;key=value]…      none · guard · guard;len=4;turns=2;binds=any
```

One codec, `procgenCore/elementSpec.js`, for the CLIs, sweep and lab page (`?elements=`). `none`, the default, means the element code does not run and spends no draws. `len` and `turns` come from the element's own schema. A parameter the spec **names** spends no draw; one it **omits** is drawn — so `guard` and `guard;len=3` are different runs, and a named parameter is kept even at its default. `binds` is the binding's knob: at `item` (default) the gadget's area is the only one that may hold a key symbol, so it always guards something; at `any` it competes with every area.

### How it goes in

The draw order, part of the level's identity:

1. the goal cell
2. `instantiate` — the element's parameters, in schema order
3. the **site** — one pick among squares of side `len + SITE_MARGIN` whose one-cell ring is on the grid and excludes the entrance and goal (`elementSiteCandidates`)
4. `construct(site)`
5. the carve, over the whole grid; its result inside the reserved square is replaced by the element's tiles
6. the composite (no draws)
7. the area block — partition, graph, realisation

The ring is walled except where the entry port faces; the connector digs the shortest tunnel from that mouth to floor the entrance reaches, outside the reserved square. The exit mouth is sealed, or the player could walk round the site and the door would stop being a cut. Failures are graded refusals that leave the carved room intact: `no-site-fits-this-room`, `the-entry-port-cannot-be-joined`, `the-elements-demand-is-not-met`, `the-reserved-rectangle-seals-the-room`, `the-guard-is-not-a-cut-of-the-level`, or the element's own `TURNS_EXCEED_LEN` / `SITE_TOO_SMALL` / `WALK_NOT_FOUND`. Use 15×15 rooms for elements; small rooms refuse most runs.

### The guard

The gadget's area is fed to the partition as a **declared** area (`E0`, `kind: 'element'`), since a one-wide push lane has no 2×2 square. The symbol the graph gives it is realised as `flag_K{n}` on the cell just beyond the guard door `door_A0` (ids from `guardIdsFor` / `flagIdFor`), placed rather than drawn so it cannot land in front of the guard; that symbol's doors are cleared by the flag. Flag realisation applies only to the guarded symbol, so other payloads keep `key_K{n}`. For the terrain flood, `door_A0` belongs to its flag's key level; the guard's own cut is checked separately (`guardIsCut`) and by the skeleton solve over block state.

### What it costs

Each placed gadget adds a row to `summary.elements[]`: `pushes`, `planLength`, `nodes` from the plan; `len` / `turns` / `cells`; `tunnel` (how far the connector dug); and `carveOverwrote`. A placed element is recorded as `{params, site, drawsAtConstruct}` plus the seed: advance a fresh stream by `drawsAtConstruct`, instantiate with every parameter as an override, and construct on the site. `{params}` alone is not enough, because the site pick draws between `instantiate` and `construct`.

The lab page draws the gadget and steps the block through the solve: see [The Maze Lab Page](./maze-lab.md#plan-stepping-and-the-element-overlay).

## The maze lab page (`frontend/modules/mazeRoom/lab.html`)

A standalone static page that generates, edits, solves and hand-drives maze levels from URL parameters, and edits region libraries and worlds. See [The Maze Lab Page](./maze-lab.md).

## The action queue (`shared/actionQueue` + `mazeKeys.js` + `mazeQueueExecutor.js`)

A tile-level action queue with an icon-row UI, built on the shared `ActionQueue` class (`shared/actionQueue/`) that jta and omsi also use. It backs the maze's `customQueues: true` loop-mode capability. Entries have the shape `{actionType, actionId, substrate: 'maze', loops}`:

| `actionType` | `actionId` | Meaning |
|---|---|---|
| `move` | `N` / `E` / `S` / `W` | One step; block pushes use the same verb |
| `wait` | — | One turn passes (spacebar) |
| `locationCheck` | location name | Explicit check at the current tile; used by saved and replayed queues and loops delegation (stepping onto a location already checks it) |

| File | Role |
|---|---|
| `mazeKeys.js` | Vocabulary, entry builders, `KEY_MAP` (arrows, WASD, space), `describeMazeAction`; no DOM or engine imports, so the lab's manual arm can use it |
| `mazeQueueExecutor.js` | `executeMazeEntry(world, state, entry, opts) → {next, reason}`, the one place an entry becomes an engine transition; `projectActions` (live queue → recording) and its inverse `expandEntries`. Pure |
| `mazeRoomUI.js` | Every side effect, plus the edit cursor clamp (`_clampedEditIndex`, since `ActionQueue.add` throws inside the done region) and stopping the driver (`stepOne` advances even on `FAILED`) |

**Live uncompressed, recording compressed.** Each press is one icon; `projectActions` folds identical consecutive entries into `loops: n` (never a `locationCheck`), and replayers expand before adding.

**A refused entry stops the replay.** It is marked `FAILED` with the reason; the replayer stops, the departure exit is not crossed, and the loops block stays parked in manual mode. A refusal already in the recording (a wall bumped while recording) is stored as `params.refused` and replays as a completion, because it consumed a turn that hazard timing depends on.

**Recording for loops.** The maze is the reference fine-grained substrate for loop recording: its visit recorder captures the whole visit as one `move` / `wait` / `locationCheck` stream (format `actionQueue/1`), stashes it for loops (`takeLastRecording`), and replays it, crossing the recorded departure exit at the end. Recordings also carry `worldDigest` / `requires` preconditions ([The Maze Lab Page](./maze-lab.md#recording-preconditions)). See [Loop Recording and Block Modes](./loop-recording.md).

**Loop delegation.** On a `manaEnabled` region a Bot-mode block hands the current action to the panel (`loops:substrateActionBegan`), which walks it tile by tile, charges mana per tile (`_loopsDrivenAction`) and reports `loops:substrateActionCompleted`. The controller's `walkTo` drives the visualizer instead, a separate position tracker. Bot × Instant is not offered for the maze (`regionBotHonorsInstant` is false for delegation solvers).

## Content modules

Content modules add gameplay content to a region without touching core substrate code. Two ship, in `shared/procgen/contentModules/`, and **`applyMazeContentModules` (in `mazeRoomLibrary.js`) calls them directly**. The registry entry exposes it as `applyContentModules`, which the pipeline engine calls after the base region build.

| Module | Files | What it does |
|---|---|---|
| Hazards | `hazardPathGen.js` (the tile cycle), `hazardRuntime.js` (cycle position, facing, move validity), `hazardRender.js` (overlay) | Patrolling dangers on generated paths, kept off the entrance, exits and location tiles |
| Consumable tiles | `consumableTileGen.js` | Cross-game consumable tiles; runs after hazards and draws no random numbers when inactive (`consumableTilesActive`) |

`contentModules/registry.js` defines a hook contract (`generate`, `serialize` / `deserialize`, `procgenSettingsSchema`, `tickRuntime`, `validateMove`, `onMove`, `render`, `resetOnEntry`), but no production code registers a module in it. The autopather is hazard- and wait-aware, so it can plan routes that wait out a hazard's cycle.

## The autopather (`mazeAutopather.js`)

BFS pathfinding (`findPath`) used by the playback controller, the queue and the exploration UI. Targets are a tile, an exit, a location, or `closestUnexplored` (nearest walkable unseen tile, given `opts.seenTiles`). It returns `{ steps, length }` including both endpoints, or `null`. Walkability is inventory-aware when an inventory is passed and geometry-only otherwise (the procgen-time mode). `stepsToInputs` / `stepsToActions` convert a path to engine inputs or queue entries.

## Panel and runtime

The panel (`mazeRoomUI.js`, component `mazeRoomPanel`) subscribes to `maze:loadRegion`. A load that arrives before the panel mounts is buffered (`pendingLoadRegion` in `index.js`) and drained by the constructor. On load the module activates its panel unless the loops panel has "Keep this panel focused" set while its queue is driving.

**Where a load puts the player.** `mazeArrival.resolveMazeArrival` tries the exit `arrivedFrom.exit_id` names and the exit whose `targetRegion` is `arrivedFrom.source_region`, else keeps the `entrance`. When any exit carries a `targetExitId` (grid, sphere, top-down worlds), `exit_id` goes first. When none does (the shuffled spiral, which links no reverse exits), `source_region` goes first, because `exit_id` is then the source exit's own name — a return from a placed Seedling room names `exit_S`.

The visit recording keys on `arrivedFrom.exit_id ?? 'entrance'`, matching `loops/blockIdentity.js`, so the panel keeps `arrivedFromExitId` (that key, used by the saved-queue filters) separate from `arrivalDoorId` (the exit the player was placed on, where a hazard reset returns them).

**Keyboard.** On its container's `show` and after a load, the panel retries focus briefly until its root has a layout box, because Golden Layout shows the tab after the event and a hidden element refuses focus. A step that crosses into another region loads it synchronously inside `ActionQueue.stepOne`; that load clears the queue, and `stepOne` returns `superseded` rather than advancing it.

Around the panel:

- The **playthrough visualizer** (`mazeRoomVisualizer.js`) auto-walks the region with its own simulated state; see [Playback and Debugging Tools](./playback-and-debugging.md#per-substrate-visualizers).
- The **editor** (`mazeRoomEditor.js`) edits a loaded region in place: floor/wall, entrance, items (with AP-canonical location names), obstacles, block, button (with its `buttonLib` entry and `door_A{n}` registration) and flag. Every brush produces a closed op (`applyEditOp`), so an edit list replays. Exits and logic gates are not in its palette.
- The canvas draw is `mazeRoomRender.drawWorld`, shared with the lab page; see [its `view` contract](./maze-lab.md#drawworlds-view-contract).
- `frontend/modules/mazeGameDataPanel/` is a separate module for the A-Mazing-Idle game, not this substrate.

## A real game's map as maze regions

The maze can also be handed a world. The region atlas's **maze projection** (`procgenPipeline/regionAtlasMazeProjection.js`, plan [`region-atlas-plan.md`](../../../../CC/docs/plans/region-atlas-plan.md), preset `seedling_atlas_maze`) compiles a marked real-game region into one maze world per AP sub-region: zero-item-reachable cells are floor, the rest wall; a crossing between sub-regions is an exit tile carrying a `clear_set_type: 'rule'` obstacle with the atlas's access rule; a location is an item overlay with its AP name. Nothing in `mazeRoom/` knows about it — the output is ordinary sidecars.

**Substrate is chosen per region.** `compileRegionAtlas` (`procgenPipeline/regionAtlasCompiler.js`) resolves each region's substrate as its own optional `substrate` field, else the compile's default (the `substrateId` override, else the maze flavour, else the atlas game's `flash_<game>`), and hands it to the matching row of a sidecar-builder table; a substrate the table lacks is refused by name. The report carries `substrate` (the default) and `substrates` (sidecars emitted per substrate). In the other direction, `mazeAtlasDerivation.js` writes each library entry's substrate onto its region and refuses, naming the entry, any entry that is not a tile-grid maze payload.

### Fidelity fences — what the projection loses, and what it must not

Every departure is a named note in the report's `maze_notes`, never a silent drop — for example `walled_unlabelled`, `carved`, `opened_solid`, `single_route`, `sink_walled`, `exit_tile_collision`. The full list is the `kind:` values in `regionAtlasMazeProjection.js`.

**`exit_tile_collision` matters because one maze tile can only be one crossing.** Seedling's linker lands each arrival on the destination's return door, which the real game tolerates; projected, two doors want one tile. The rule: the exit with a `targetRegion` survives, and an arrival-only exit (`targetRegion: null`, the far end of a `one_way` link) is evicted, since the entrance already gives a place to arrive. Two real crossings on one tile stay a named collision. Without this rule a linked two-room set could project to a one-way trap that AP reachability cannot see.

Two payload facts hold for any hand-built or projected maze sidecar:

| Fact | Why |
|---|---|
| **`exit_id` equals `exitName`** | `createWorld` keys `world.exits` on `exit_id`, the panel publishes `user:regionMove` with `exitName`, and `procgenPlayer`'s region-move handler reads `exits.get(exitName).targetExitId` on the source world. If they differ the lookup misses silently and every arrival falls back to the entrance. (The flash family keys on `exitName ?? exit_id`.) |
| **Semantics live in the overlays** | The tile grid is binary; anything conditional is an obstacle, item, consumable or mana tile on a floor tile, never a new tile value. |

## Registry entry

The maze entry implements the full procedural build-time contract (`generateRegionCore`, `placeFromItems`, `placeFromRules`, `extractPathsAndObstacles`, `serializeWorld`, `applyContentModules`), the region-library hooks (`captureLibraryEntry`, `instantiateLibraryEntry`) and the full loop-mode surface (queue actions, manual play, custom queues, record / playback / instant, `takeLastRecording`). Field detail and the capability matrix: [Substrate Registry Reference](./substrate-registry.md).

Its Procgen Pipeline hooks are in `mazeProcgenParams.js`:

| Hook | What it does |
|---|---|
| `defaultProcgenParams` | Hazard knobs `enableHazards`, `hazardCount`, `hazardMaxConsecutiveFails`, `hazardWallOverlapAllowed`, and connection flags `mazeRequireSameWall` / `mazeRequireTileAlign` |
| `renderProcgenParams` | Hazard controls in the panel's *maze parameters* subsection |
| `buildLibraryRegionParams` | The two connection flags, in sphere mode |
| `renderLibraryProcgenParams` | The flags' toggles in the *Region libraries* subsection |

There is no `buildRegionParams`: the hazard knobs become `hazardOpts` through `effectiveHazardOpts` (`procgenPipeline/presetRun.js`), which only `applyContentModules` reads. The connection flags are read only when a captured maze pack is instantiated into a sphere slot (`mazeLibraryEntry.js`), and the pipeline consults the library-scoped pair for the substrates the selected sphere libraries realise, so a maze pack with no maze quota still gets its flags.

## Related documentation

- [The Maze Lab Page](./maze-lab.md)
- [Architecture](./architecture.md)
- [Substrate Registry Reference](./substrate-registry.md)
- [Loop Recording and Block Modes](./loop-recording.md)
- [Playback and Debugging Tools](./playback-and-debugging.md)
- [Paths and Obstacles](./paths-and-obstacles.md)
