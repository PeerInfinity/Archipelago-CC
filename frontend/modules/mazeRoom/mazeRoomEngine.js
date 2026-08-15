/**
 * mazeRoom engine — headless maze world model + generation
 * (docs/json/developer/procgen/maze.md).
 *
 * Headless: no DOM, no rendering, no input wiring. That lives in
 * mazeRoomUI.js once v1 is engine-complete.
 */

import { createRng } from '../shared/rng.js';
import { reach, makeBfsSolver } from '../shared/simulatorCore.js';
import { DEFAULT_ITEMS, DEFAULT_OBSTACLES, isObstacleCleared } from '../shared/procgen/library.js';
import {
    REGION_GROW_STEP, REGION_GROW_MAX_ATTEMPTS,
    clockwisePerimeterTiles,
    entranceTileForStartRegion,
    tryAssignExitTiles,
} from '../shared/procgen/spatialPrimitives.js';
import { getBackend } from '../shared/procgen/mazeAlgorithms/registry.js';
import { getPostProcessor } from '../shared/procgen/mazeAlgorithms/postProcessors.js';
import {
    TILE_FLOOR, TILE_WALL,
    tileIndex, getTile, setTile,
} from '../shared/procgen/mazeAlgorithms/gridTiles.js';
import { resolveBiome } from './mazeRoomBiomeLibrary.js';
// Side-effect: ensure all maze backends are registered before
// generateMaze runs.
import './mazeAlgorithms/index.js';

// Re-export clockwisePerimeterTiles for callers (tests, other
// modules) that imported it from mazeRoomEngine. Step 3 re-points
// them at spatialPrimitives.js directly and this re-export drops.
export { clockwisePerimeterTiles };

// --- Tile types ---
//
// Defined in shared/procgen/mazeAlgorithms/gridTiles.js (with the grid
// contract the algorithms depend on) and re-exported here so every caller
// that imported them from mazeRoomEngine keeps working.

export { TILE_FLOOR, TILE_WALL, tileIndex, getTile, setTile };

// --- Inputs ---

export const INPUT_N = 'N';
export const INPUT_S = 'S';
export const INPUT_E = 'E';
export const INPUT_W = 'W';
// Wait input — recognised by the visualizer's tick loop (skips
// engine.step, advances state.turn) and emitted by stepsToInputs
// for duplicate-tile entries in a planned path. NOT included in
// INPUTS because step() doesn't consume it; only the playback
// surfaces need to know about it.
export const INPUT_WAIT = 'WAIT';
export const INPUTS = [INPUT_N, INPUT_S, INPUT_E, INPUT_W];

const DELTAS = {
    [INPUT_N]: { dx: 0, dy: -1 },
    [INPUT_S]: { dx: 0, dy: 1 },
    [INPUT_E]: { dx: 1, dy: 0 },
    [INPUT_W]: { dx: -1, dy: 0 },
};

// --- World ---

export function createWorld(width, height, opts = {}) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2) {
        throw new Error(`createWorld: invalid dimensions ${width}x${height}`);
    }
    const tiles = new Int8Array(width * height);
    const entrance = opts.entrance ?? { x: 0, y: 0 };
    assertInBounds(width, height, entrance, 'entrance');

    // world.exits: Map<exit_id, { exit_id, x, y, side, exitName,
    // targetRegion, ... }>. Multi-exit support — replaces the older
    // singular world.exit. Two input shorthands accepted:
    //   opts.exits: [...]  (preferred)
    //   opts.exit:  {x,y}  (legacy single-exit; converted to a Map
    //                       entry with exit_id 'exit')
    // Order of insertion is preserved so the "default exit" for
    // single-exit code paths is well-defined.
    const exits = new Map();
    const addExit = (entry, fallbackId) => {
        assertInBounds(width, height, entry, 'exit');
        const id = entry.exit_id ?? fallbackId;
        exits.set(id, {
            exit_id: id,
            x: entry.x,
            y: entry.y,
            side: entry.side ?? null,
            exitName: entry.exitName ?? null,
            targetRegion: entry.targetRegion ?? null,
            targetExitId: entry.targetExitId ?? null,
            isBackExit: entry.isBackExit ?? false,
            isTeleporter: entry.isTeleporter ?? false,
        });
    };
    const exitsProvided = Array.isArray(opts.exits) || !!opts.exit;
    if (Array.isArray(opts.exits)) {
        opts.exits.forEach((e, i) => addExit(e, `exit_${i}`));
    }
    if (opts.exit) {
        // Legacy single-exit shorthand. Default id is 'exit' to match
        // what the old extractPathsAndObstacles emitted.
        addExit(opts.exit, 'exit');
    }
    if (!exitsProvided) {
        // Caller didn't specify any exit shape — default to the old
        // "exit at bottom-right" for ergonomics. Explicit `exits: []`
        // is respected as "this region has no exits" (e.g. when
        // wallOffUnusedExits stripped them all).
        addExit({ x: width - 1, y: height - 1 }, 'exit');
    }

    return {
        width, height, tiles, entrance, exits,
        // Sparse overlays keyed by "x,y". Obstacles block entry unless
        // inventory clears them; items add themselves to inventory on
        // successful entry. Both sit on top of floor tiles.
        obstacles: new Map(),
        items: new Map(),
        // Cross-game consumable tiles (X1). Two more sparse overlays on
        // the same posKey scheme, both deliberately OUTSIDE the item /
        // location machinery:
        //   consumableTiles: Map<posKey, {substrate, type, count}> —
        //     stepping on one grants another game's consumable through
        //     the resourceChannels bus. NOT an AP location (D10): no
        //     location table entry, no AP tracking, no pickup cost, and
        //     winnability logic ignores them entirely (D5).
        //   manaTiles: Map<posKey, amount> — refills the shared loop-mode
        //     mana pool via the mana channel's gainMana leg.
        // Both stay empty unless a generator's content-module pass fills
        // them, so worlds built without the knobs are byte-identical.
        consumableTiles: new Map(),
        manaTiles: new Map(),
        itemLib: opts.itemLib ?? DEFAULT_ITEMS,
        obstacleLib: opts.obstacleLib ?? DEFAULT_OBSTACLES,
    };
}

/**
 * Returns the exit at (x, y), or null if no exit sits there.
 *
 * Maintains a position-keyed cache (`world._exitsByPos`) so the BFS
 * goal predicate / step pipeline don't pay an O(exits) iterator
 * allocation per state visit. The cache is rebuilt lazily when
 * `world.exits.size` no longer matches it (after wallOffUnusedExits,
 * after the driver adds back-exits, etc.) — coarse but correct, and
 * the rebuild cost is amortised across the many subsequent lookups
 * inside a single BFS run.
 */
export function getExitAt(world, x, y) {
    if (!world._exitsByPos || world._exitsByPos.size !== world.exits.size) {
        const cache = new Map();
        for (const e of world.exits.values()) {
            cache.set(`${e.x},${e.y}`, e);
        }
        world._exitsByPos = cache;
    }
    return world._exitsByPos.get(`${x},${y}`) ?? null;
}

/**
 * The first exit in insertion order. Used by single-exit code paths
 * (gate-and-key placement, walker manhattan scoring) that haven't yet
 * been generalised to multi-exit. New consumers should iterate
 * `world.exits` directly.
 */
export function getDefaultExit(world) {
    return world.exits.values().next().value ?? null;
}

function posKey(x, y) { return `${x},${y}`; }

/**
 * Inverse of procgenPipeline's serializeMazeWorld. Reconstructs a
 * playable maze world from a sidecar payload (JSON-safe arrays /
 * plain objects) into the in-memory shape (Int8Array for tiles, Maps
 * for obstacles and items).
 *
 * AP-canonical metadata baked into the sidecar by the pipeline at
 * serialization time (per-item locationName, per-exit exitName /
 * targetRegion) is preserved on the deserialized world so the
 * substrate can publish user:locationCheck and user:regionMove with
 * the right names without consulting any external lookup at runtime.
 *
 *   sidecar.exits[].{exitName,targetRegion} → world.exits Map entries
 *   sidecar.items[].locationName            → world.itemLocationNames
 *                                             Map<"x,y", name>
 *
 * Backward-compat: a sidecar emitted before multi-exit shipped
 * carries a singular `exit: {x, y, exitName, targetRegion}` field.
 * Read that as a one-element `exits` list with id 'exit'.
 *
 * The sidecar's `obstacleLib` field carries only per-instance entries
 * the pipeline added on top of the base library (typically
 * logic_gate_<N> entries for top-down placements). They're merged
 * with the supplied base library so the deserialized world has a
 * complete obstacleLib.
 */
export function deserializeMazeWorld(sidecar, opts = {}) {
    if (!sidecar || typeof sidecar !== 'object') {
        throw new Error('deserializeMazeWorld: sidecar must be an object');
    }
    const { width, height, tiles, entrance, obstacles, items } = sidecar;
    if (!Array.isArray(tiles) || tiles.length !== width * height) {
        throw new Error(`deserializeMazeWorld: tiles length ${tiles?.length} != ${width}*${height}`);
    }

    const baseItemLib = opts.baseItemLib ?? opts.itemLib ?? DEFAULT_ITEMS;
    const itemLib = { ...baseItemLib, ...(sidecar.itemLib ?? {}) };
    const baseObstacleLib = opts.baseObstacleLib ?? DEFAULT_OBSTACLES;
    const obstacleLib = { ...baseObstacleLib, ...(sidecar.obstacleLib ?? {}) };

    // Multi-exit-aware load with legacy single-exit shorthand.
    let exitsInput;
    if (Array.isArray(sidecar.exits)) {
        exitsInput = sidecar.exits.map((e) => ({
            exit_id: e.exit_id ?? 'exit',
            x: e.x,
            y: e.y,
            side: e.side ?? null,
            exitName: e.exitName ?? null,
            targetRegion: e.targetRegion ?? null,
            targetExitId: e.targetExitId ?? null,
            isBackExit: e.isBackExit ?? false,
            isTeleporter: e.isTeleporter ?? false,
        }));
    } else if (sidecar.exit) {
        exitsInput = [{
            exit_id: 'exit',
            x: sidecar.exit.x,
            y: sidecar.exit.y,
            side: sidecar.exit.side ?? null,
            exitName: sidecar.exit.exitName ?? null,
            targetRegion: sidecar.exit.targetRegion ?? null,
        }];
    }

    const world = createWorld(width, height, {
        entrance: { x: entrance.x, y: entrance.y },
        exits: exitsInput,
        itemLib,
        obstacleLib,
    });

    world.tiles.set(tiles);

    for (const o of obstacles ?? []) {
        world.obstacles.set(posKey(o.x, o.y), o.id);
    }

    const itemLocationNames = new Map();
    for (const i of items ?? []) {
        world.items.set(posKey(i.x, i.y), i.id);
        if (i.locationName) {
            itemLocationNames.set(posKey(i.x, i.y), i.locationName);
        }
    }
    world.itemLocationNames = itemLocationNames;

    // Cross-game consumable tiles (X1). Absent on every pre-X1 sidecar
    // and on any world generated with the knobs at their byte-inert
    // defaults; createWorld already seeded empty Maps, so absence is a
    // no-op rather than a special case.
    for (const c of sidecar.consumableTiles ?? []) {
        world.consumableTiles.set(posKey(c.x, c.y), {
            substrate: c.substrate,
            type: c.type,
            count: c.count,
        });
    }
    for (const m of sidecar.manaTiles ?? []) {
        world.manaTiles.set(posKey(m.x, m.y), m.amount);
    }

    // Loop-mode plumbing (Phase 3): both fields ride through verbatim
    // when present on the sidecar. The runtime substrate uses them to
    // compute per-tile cost = baseRegionCost / longestShortestPath.
    if (typeof sidecar.longestShortestPath === 'number') {
        world.longestShortestPath = sidecar.longestShortestPath;
    }
    if (sidecar.manaEnabled === true) {
        world.manaEnabled = true;
    }
    // Phase 6h: fogEnabled rides through verbatim. The maze panel's
    // _adoptLoadedRegion overrides this.fogEnabled from this field;
    // the TA substrate's _adoptLoadedRegion gates _discoverEverythingInRegion
    // on it. Without this preservation, the runtime sees `undefined`
    // and falls back to legacy behavior (auto-discover everything),
    // bypassing the per-region fog model entirely.
    if (sidecar.fogEnabled === true) {
        world.fogEnabled = true;
    }

    // Hazards (maze content modules Phase 2). Each sidecar entry is the
    // immutable shape (tiles + cycleLength + length + shape); phase
    // initializes to 0 here, matching the v1 region-reset model where
    // every region entry starts hazards fresh. resetHazards from the
    // substrate also resets to 0 after teleport.
    if (Array.isArray(sidecar.hazards) && sidecar.hazards.length > 0) {
        world.hazards = sidecar.hazards.map((h) => ({
            shape: h.shape,
            length: h.length,
            tiles: (h.tiles ?? []).map((t) => ({ x: t.x, y: t.y })),
            cycleLength: h.cycleLength,
            phase: 0,
        }));
    }

    return world;
}

export function getObstacle(world, x, y) {
    return world.obstacles.get(posKey(x, y));
}

export function setObstacle(world, x, y, obstacleId) {
    world.obstacles.set(posKey(x, y), obstacleId);
}

export function clearObstacle(world, x, y) {
    world.obstacles.delete(posKey(x, y));
}

export function getItem(world, x, y) {
    return world.items.get(posKey(x, y));
}

export function setItem(world, x, y, itemId) {
    world.items.set(posKey(x, y), itemId);
}

export function clearItem(world, x, y) {
    world.items.delete(posKey(x, y));
}

// --- Consumable tiles (X1) ---
//
// Accessors mirror the item overlay. `world.consumableTiles` /
// `world.manaTiles` are optional on worlds built before X1 (and on
// hand-authored / library-instantiated worlds), so every getter
// tolerates their absence rather than assuming createWorld ran.

export function getConsumableTile(world, x, y) {
    return world.consumableTiles?.get(posKey(x, y));
}

export function setConsumableTile(world, x, y, grant) {
    if (!world.consumableTiles) world.consumableTiles = new Map();
    world.consumableTiles.set(posKey(x, y), grant);
}

export function clearConsumableTile(world, x, y) {
    world.consumableTiles?.delete(posKey(x, y));
}

export function getManaTile(world, x, y) {
    return world.manaTiles?.get(posKey(x, y));
}

export function setManaTile(world, x, y, amount) {
    if (!world.manaTiles) world.manaTiles = new Map();
    world.manaTiles.set(posKey(x, y), amount);
}

export function clearManaTile(world, x, y) {
    world.manaTiles?.delete(posKey(x, y));
}

function assertInBounds(width, height, pt, label) {
    if (pt.x < 0 || pt.x >= width || pt.y < 0 || pt.y >= height) {
        throw new Error(`${label} (${pt.x},${pt.y}) out of bounds for ${width}x${height}`);
    }
}

// tileIndex / getTile / setTile live in
// shared/procgen/mazeAlgorithms/gridTiles.js and are re-exported at the top
// of this file.

export function isFloor(world, x, y) {
    if (x < 0 || x >= world.width || y < 0 || y >= world.height) return false;
    return world.tiles[tileIndex(world, x, y)] === TILE_FLOOR;
}

export function isEntrance(world, x, y) {
    return world.entrance.x === x && world.entrance.y === y;
}

export function setEntrance(world, x, y) {
    world.entrance = { x, y };
}

export function isExit(world, x, y) {
    return getExitAt(world, x, y) !== null;
}

// --- State ---

export function createState(world) {
    return {
        player_pos: { x: world.entrance.x, y: world.entrance.y },
        turn: 0,
        inventory: new Set(),
    };
}

function cloneState(state) {
    return {
        player_pos: { x: state.player_pos.x, y: state.player_pos.y },
        turn: state.turn,
        inventory: new Set(state.inventory),
    };
}

// --- step ---
//
// Accepts an optional `inventoryOverride` (a Set of item ids) for
// clearance checks. When provided, the override is treated as truth
// and state.inventory is left unchanged on pickup — the caller is
// responsible for managing inventory externally (in playback this is
// stateManager via user:locationCheck events; see procgen-player.md
// step 6 + step 7).
//
// When `inventoryOverride` is undefined the function preserves its
// historical behavior: clearance is checked against state.inventory
// and items walked onto are added to state.inventory directly. This
// keeps internal callers (BFS, walker, generation feasibility) and
// the maze panel's standalone "Generate" dev flow working as they
// always have.
//
// `clearanceOpts` is forwarded to isObstacleCleared so the panel can
// inject a stateManager-backed rule evaluator for logic-gate
// obstacles. See library.js's isObstacleCleared and top-down-driver.md
// §8.

export function step(world, state, input, inventoryOverride, clearanceOpts) {
    const delta = DELTAS[input];
    if (!delta) return null;
    const nx = state.player_pos.x + delta.dx;
    const ny = state.player_pos.y + delta.dy;
    if (!isFloor(world, nx, ny)) return null;
    const inv = inventoryOverride !== undefined ? inventoryOverride : state.inventory;
    const obstacleId = getObstacle(world, nx, ny);
    if (obstacleId && !isObstacleCleared(obstacleId, inv, world.obstacleLib, clearanceOpts)) {
        return null;
    }
    const next = cloneState(state);
    next.player_pos.x = nx;
    next.player_pos.y = ny;
    next.turn += 1;
    if (inventoryOverride === undefined) {
        const itemId = getItem(world, nx, ny);
        if (itemId) next.inventory.add(itemId);
    }
    return next;
}

// --- Goal predicates ---

export function reachedExit(state, world) {
    return isExit(world, state.player_pos.x, state.player_pos.y);
}

/**
 * Detect substrate-level events that occurred during a single step.
 * Pure helper consumed by the maze panel in playback mode to decide
 * which AP-level dispatcher events (user:locationCheck,
 * user:regionMove) to publish.
 *
 *   - 'pickup'      — moved onto an item tile. Always fires when an
 *                     item tile is stepped onto, even if the same
 *                     item id is already in `inventory` (multi-
 *                     instance items, e.g. Adventure's 12
 *                     Freeincarnates: each Freeincarnate location
 *                     check needs its own pickup event). Idempotency
 *                     across visits is the caller's concern — the
 *                     panel filters using stateManager's per-location
 *                     `checkedLocations` set, which is keyed by AP-
 *                     canonical location name.
 *   - 'exit_cross'  — moved onto the exit tile from elsewhere.
 *                     Fires only on the step that arrives, not while
 *                     the player is standing on the exit.
 *   - 'consumable_pickup' (X1) — moved onto a cross-game consumable
 *                     tile. Carries the {substrate, type, count} grant
 *                     verbatim. Fires on EVERY arrival; respawn /
 *                     one-shot semantics are the caller's concern (the
 *                     visualizer's posKey-keyed collected set, cleared
 *                     on gameState:loopReset per X1-R1) — the same
 *                     division of labour as 'pickup' above.
 *   - 'mana_pickup' (X1) — moved onto a mana-refill tile. Carries the
 *                     refill `amount`. Same respawn division.
 *
 * A tile can carry more than one overlay, so a single step may emit a
 * 'pickup' AND a 'consumable_pickup'. Placement keeps them disjoint in
 * practice, but nothing in the engine enforces that.
 *
 * No events when the player didn't move (oldPos === newPos), since
 * step() only returns a new state on successful movement and a
 * stationary "step" can't trigger a fresh pickup or transition.
 *
 * The helper does not consult AP names (locationName, exitName,
 * targetRegion) — those are the panel's concern at publish time.
 *
 * The `inventory` parameter is unused for the pickup filter (kept
 * for signature stability with older callers); leave it as the
 * empty Set if you don't have one to hand.
 */
export function detectStepEvents(world, oldPos, newPos, _inventory) {
    const events = [];
    const moved = oldPos.x !== newPos.x || oldPos.y !== newPos.y;
    if (!moved) return events;

    const newKey = posKey(newPos.x, newPos.y);

    const itemId = world.items.get(newKey);
    if (itemId) {
        events.push({
            type: 'pickup',
            itemId,
            position: { x: newPos.x, y: newPos.y },
        });
    }

    // X1 consumable overlays. Optional chaining because worlds built
    // before X1 (and library-instantiated ones) carry no such Maps.
    const grant = world.consumableTiles?.get(newKey);
    if (grant) {
        events.push({
            type: 'consumable_pickup',
            grant,
            position: { x: newPos.x, y: newPos.y },
        });
    }

    const manaAmount = world.manaTiles?.get(newKey);
    if (manaAmount) {
        events.push({
            type: 'mana_pickup',
            amount: manaAmount,
            position: { x: newPos.x, y: newPos.y },
        });
    }

    const oldExit = getExitAt(world, oldPos.x, oldPos.y);
    const newExit = getExitAt(world, newPos.x, newPos.y);
    // Fire exit_cross whenever we step ONTO an exit, except when we
    // were already standing on the same exit (no-op repeat). The
    // earlier `!oldExit && newExit` condition missed the case where
    // a region has two adjacent exit tiles — e.g. apcalc's hub
    // regions, where the back-exit from Region 16 and the exit to C
    // sit at (7,2) and (7,1) inside Region 1. The bot spawns on the
    // back-exit tile, the bot's next-leg walkTo lands on the C
    // exit tile, and without this fix the second-exit cross never
    // fires — the visualizer reaches the target and idles, leaving
    // the bot waiting for a region transition that never comes.
    if (newExit && (!oldExit || oldExit.exit_id !== newExit.exit_id)) {
        events.push({
            type: 'exit_cross',
            exit_id: newExit.exit_id,
            position: { x: newPos.x, y: newPos.y },
        });
    }

    return events;
}

// --- BFS solver for the maze simulator ---

// Reachability is a function of (position, inventory) once ability-gated
// tiles exist — two states at the same tile with different inventories
// can reach different parts of the world, so BFS must treat them as
// distinct nodes.
function mazeVisitedKey(state) {
    if (state.inventory.size === 0) {
        return `${state.player_pos.x},${state.player_pos.y}|`;
    }
    const inv = [...state.inventory].sort().join(',');
    return `${state.player_pos.x},${state.player_pos.y}|${inv}`;
}

export const bfsSolver = makeBfsSolver({
    step,
    inputs: INPUTS,
    visitedKey: mazeVisitedKey,
});

// Obstacle-transparent step used by path/obstacle extraction: walls
// still block, but obstacles are passable (we want to reconstruct the
// geometric route and then annotate it with the obstacles it crossed,
// independently of whether the player could clear them at run time).
function ghostStep(world, state, input) {
    const delta = DELTAS[input];
    if (!delta) return null;
    const nx = state.player_pos.x + delta.dx;
    const ny = state.player_pos.y + delta.dy;
    if (!isFloor(world, nx, ny)) return null;
    const next = cloneState(state);
    next.player_pos.x = nx;
    next.player_pos.y = ny;
    next.turn += 1;
    return next;
}

const ghostBfsSolver = makeBfsSolver({
    step: ghostStep,
    inputs: INPUTS,
    visitedKey: (s) => `${s.player_pos.x},${s.player_pos.y}`,
});

// --- Paths-and-obstacles extraction ---
//
// Produces the central paths-and-obstacles representation
// (docs/json/developer/procgen/paths-and-obstacles.md). For each
// target location (the exit + every item pickup), we walk an
// obstacle-transparent BFS from the entrance, then annotate the path
// with the obstacles it crossed. Emits a single path per location.

function obstaclesAlongPath(world, startState, plan) {
    const seen = [];
    const seenSet = new Set();
    let s = startState;
    for (const input of plan) {
        s = ghostStep(world, s, input);
        if (!s) break;
        const obstacleId = getObstacle(world, s.player_pos.x, s.player_pos.y);
        if (obstacleId && !seenSet.has(obstacleId)) {
            seen.push(obstacleId);
            seenSet.add(obstacleId);
        }
    }
    return seen;
}

function pathsToTarget(world, position) {
    const start = createState(world);
    const result = reach(world, ghostBfsSolver, start,
        (s) => s.player_pos.x === position.x && s.player_pos.y === position.y);
    if (!result.ok) return [];
    const obstacles = obstaclesAlongPath(world, start, result.plan);
    return [{ path_id: 'p1', obstacles }];
}

export function extractPathsAndObstacles(world, opts = {}) {
    const regionId = opts.regionId ?? 'maze_room';

    // Exits are region-to-region connections; one entry per exit tile
    // in `world.exits`. Target region resolution (for multi-region
    // graphs) happens during stitching.
    const exits = [];
    for (const exit of world.exits.values()) {
        exits.push({
            id: exit.exit_id,
            position: { x: exit.x, y: exit.y },
            target_region: exit.targetRegion ?? null,
            paths: pathsToTarget(world, { x: exit.x, y: exit.y }),
        });
    }

    // Locations are Archipelago check slots; in v1 each item pickup
    // position is a location whose canonical item is what the generator
    // placed there.
    const locations = [];
    for (const [key, itemId] of world.items) {
        const [x, y] = key.split(',').map(Number);
        locations.push({
            id: `${itemId}_pickup`,
            position: { x, y },
            item: itemId,
            paths: pathsToTarget(world, { x, y }),
        });
    }

    return {
        region_id: regionId,
        entrance: { x: world.entrance.x, y: world.entrance.y },
        exits,
        locations,
    };
}

// --- apply / undo ---

export function apply(world, edit) {
    switch (edit.type) {
        case 'add_wall':
        case 'remove_wall': {
            assertInBounds(world.width, world.height, edit, edit.type);
            const idx = tileIndex(world, edit.x, edit.y);
            const prev = world.tiles[idx];
            const next = edit.type === 'add_wall' ? TILE_WALL : TILE_FLOOR;
            world.tiles[idx] = next;
            return { type: edit.type, x: edit.x, y: edit.y, prev };
        }
        default:
            throw new Error(`apply: unknown edit type ${edit.type}`);
    }
}

export function undo(world, token) {
    const idx = tileIndex(world, token.x, token.y);
    world.tiles[idx] = token.prev;
}

// --- Generator ---

const DEFAULT_PARAMS = Object.freeze({
    maxIterations: 2000,
    stallLimit: 200,
    // Gate-and-key placement. Set false to get a walls-only maze.
    placeGateAndKey: true,
    gateKeyMaxAttempts: 20,
    // Minimum number of non-entrance, non-door floor tiles that must be
    // reachable from the entrance with the door as a wall — ensures
    // there's somewhere meaningful to put the key.
    gateKeyMinBeforeDoor: 2,
});

export function floorTilesExcluding(world, exclude) {
    const out = [];
    for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
            if (getTile(world, x, y) !== TILE_FLOOR) continue;
            let skip = false;
            for (const pt of exclude) {
                if (pt.x === x && pt.y === y) { skip = true; break; }
            }
            if (skip) continue;
            out.push({ x, y });
        }
    }
    return out;
}

function tracePath(world, startState, plan) {
    const positions = [{ x: startState.player_pos.x, y: startState.player_pos.y }];
    let s = startState;
    for (const input of plan) {
        s = step(world, s, input);
        if (!s) return null;
        positions.push({ x: s.player_pos.x, y: s.player_pos.y });
    }
    return positions;
}

// Enumerate tiles the player can reach from startState with the
// current world and inventory. Stand-alone from bfsSolver because we
// want the full set, not a single goal-directed plan.
function reachableTiles(world, startState) {
    const visited = new Set([mazeVisitedKey(startState)]);
    const queue = [startState];
    const out = [{ x: startState.player_pos.x, y: startState.player_pos.y }];
    while (queue.length > 0) {
        const s = queue.shift();
        for (const input of INPUTS) {
            const next = step(world, s, input);
            if (!next) continue;
            const k = mazeVisitedKey(next);
            if (visited.has(k)) continue;
            visited.add(k);
            queue.push(next);
            out.push({ x: next.player_pos.x, y: next.player_pos.y });
        }
    }
    return out;
}

// Floor-only flood fill from the entrance: walls block, obstacles are
// transparent. This matches what extractPathsAndObstacles consumes
// (ghostStep semantics) — a target tile in this set is guaranteed to
// have a non-empty path in the extracted rules. Used as the wall-
// generator's feasibility predicate so no wall can isolate a target
// from the entrance.
export function floorReachableSet(world) {
    const visited = new Set([posKey(world.entrance.x, world.entrance.y)]);
    const queue = [{ x: world.entrance.x, y: world.entrance.y }];
    while (queue.length > 0) {
        const p = queue.shift();
        for (const input of INPUTS) {
            const d = DELTAS[input];
            const nx = p.x + d.dx;
            const ny = p.y + d.dy;
            if (!isFloor(world, nx, ny)) continue;
            const k = posKey(nx, ny);
            if (visited.has(k)) continue;
            visited.add(k);
            queue.push({ x: nx, y: ny });
        }
    }
    return visited;
}

// Feasibility predicate for the wall generator: every exit AND every
// item must be floor-connected to the entrance.
//
// "All exits" is load-bearing because the surrounding pipeline can
// strip exits after generation (procgenPipelineEngine.wallOffUnusedExits
// drops exits whose target neighbor cell never got built). If the
// generator only required *any* exit reachable, walls would freely
// isolate exits while another stayed reachable — and a later strip of
// the still-reachable one would leave the surviving exit with no path,
// compiling to a False_ access rule.
//
// "All items" is defense-in-depth: items are placed after the wall
// generator runs (placeFromItems on a then-stable wall layout), so
// world.items is empty during generateMaze and this branch is a no-op
// at the current call sites. Keeping items in the contract makes the
// helper safe to reuse if a future caller mutates walls after items
// land.
export function allTargetsReachable(world) {
    const reachable = floorReachableSet(world);
    for (const e of world.exits.values()) {
        if (!reachable.has(posKey(e.x, e.y))) return false;
    }
    for (const k of world.items.keys()) {
        if (!reachable.has(k)) return false;
    }
    return true;
}

function placeGateAndKey(world, rng, params, { door_id = 'door_red', key_id = 'key_red' } = {}) {
    // v1 gate-and-key targets a single exit. For multi-exit worlds we
    // pick the default (first-inserted) exit; the cut-vertex check
    // still demands the door blocks every route to it. Generalising
    // across all exits simultaneously is a growth path tied to
    // multi-exit grid growth.
    const targetExit = getDefaultExit(world);
    if (!targetExit) return { placed: false, reason: 'no_exit' };
    const pathResult = reach(world, bfsSolver, createState(world),
        (s) => s.player_pos.x === targetExit.x && s.player_pos.y === targetExit.y);
    if (!pathResult.ok) return { placed: false, reason: 'no_path' };
    const pathPositions = tracePath(world, createState(world), pathResult.plan);
    if (!pathPositions || pathPositions.length < 3) {
        return { placed: false, reason: 'path_too_short' };
    }
    // Door candidates: path positions strictly between entrance and exit.
    const doorCandidates = pathPositions.slice(1, -1);

    for (let attempt = 0; attempt < params.gateKeyMaxAttempts; attempt++) {
        const doorPos = doorCandidates[Math.floor(rng.next() * doorCandidates.length)];
        setObstacle(world, doorPos.x, doorPos.y, door_id);

        // With empty inventory the door acts as a wall, so `reachableTiles`
        // returns exactly the pre-door region.
        const beforeDoor = reachableTiles(world, createState(world));

        // Door must be a *cut vertex* — a position that every entrance→
        // exit route passes through. If the exit is still reachable with
        // the door as a wall, the door is bypassable and we retry.
        const exitBypassable = beforeDoor.some(
            (p) => p.x === targetExit.x && p.y === targetExit.y,
        );
        if (exitBypassable) {
            clearObstacle(world, doorPos.x, doorPos.y);
            continue;
        }

        const keyCandidates = beforeDoor.filter((p) =>
            !(p.x === world.entrance.x && p.y === world.entrance.y)
            && !(p.x === doorPos.x && p.y === doorPos.y),
        );
        if (keyCandidates.length < params.gateKeyMinBeforeDoor) {
            clearObstacle(world, doorPos.x, doorPos.y);
            continue;
        }

        const keyPos = keyCandidates[Math.floor(rng.next() * keyCandidates.length)];
        setItem(world, keyPos.x, keyPos.y, key_id);

        // Sanity check: exit reachable when the player has the key.
        const final = reach(world, bfsSolver, createState(world), reachedExit);
        if (!final.ok) {
            clearObstacle(world, doorPos.x, doorPos.y);
            clearItem(world, keyPos.x, keyPos.y);
            continue;
        }

        return { placed: true, doorPos, keyPos };
    }

    return { placed: false, reason: 'no_suitable_placement' };
}

// Reset every non-entrance, non-exit tile to floor. Used by the
// fallback path when a backend produces an unreachable layout.
function resetTilesToFloor(world) {
    for (let i = 0; i < world.tiles.length; i++) {
        world.tiles[i] = TILE_FLOOR;
    }
}

export function generateMaze(config) {
    const width = config.width;
    const height = config.height;
    const params = { ...DEFAULT_PARAMS, ...(config.params ?? {}) };
    const rng = createRng(config.seed ?? 1);

    // Resolve biome up-front so an unknown id throws before world setup.
    const { id: biomeId, biome, params: biomeParams } = resolveBiome(config.biome);
    const backend = getBackend(biome.backend);
    if (!backend) {
        throw new Error(`generateMaze: biome '${biomeId}' references unknown backend '${biome.backend}'`);
    }
    const mergedBackendParams = { ...params, ...biomeParams };

    const world = createWorld(width, height, {
        entrance: config.entrance,
        exits: config.exits,
        // Legacy single-exit shorthand still accepted by createWorld.
        exit: config.exit,
    });

    // 0-exit terminal regions (top-down may produce these for source
    // regions that only have a back-edge). There's no exit to reach,
    // so skip the wall-generation loop and return a trivial walls-only
    // region; the caller adds back-exits afterward.
    if (world.exits.size === 0) {
        return {
            world,
            stats: {
                biome: biomeId,
                backend: biome.backend,
                usedFallback: false,
                iterations: 0,
                accepted: 0,
                rejected: 0,
                rejectedFeasibility: 0,
                stalled: false,
                shortestPath: null,
                gateKeyPlaced: false,
                gateKeyReason: 'no_exit',
                doorPos: null,
                keyPos: null,
            },
        };
    }

    if (!allTargetsReachable(world)) {
        throw new Error('generateMaze: entrance and exit not connected in empty room');
    }

    let backendStats = backend.run(world, mergedBackendParams, rng);
    let usedFallback = false;

    // Apply listed post-processors in order (braid, pruneDeadEnds,
    // etc.). Each post-processor's params come from the biome entry;
    // none of them are configurable from generateMaze's caller.
    for (const pp of biome.postProcessors ?? []) {
        const fn = getPostProcessor(pp.id);
        if (!fn) {
            throw new Error(`generateMaze: biome '${biomeId}' references unknown post-processor '${pp.id}'`);
        }
        fn(world, pp.params ?? {}, rng);
    }

    // Validation safety net. Tree-based backends are connected by
    // construction and `random_walls` rejects any wall that breaks
    // feasibility, so this should never trip in practice — but a
    // backend with a bug shouldn't be able to ship an unsolvable
    // region. Reset and re-run with the classic backend.
    if (!allTargetsReachable(world)) {
        // eslint-disable-next-line no-console
        console.warn(`mazeRoom: biome '${biomeId}' produced unreachable layout, falling back to random_walls`);
        resetTilesToFloor(world);
        const classic = getBackend('random_walls');
        backendStats = classic.run(world, mergedBackendParams, rng);
        usedFallback = true;
    }

    const gateKeyResult = params.placeGateAndKey
        ? placeGateAndKey(world, rng, params)
        : { placed: false, reason: 'disabled' };

    const finalReach = reach(world, bfsSolver, createState(world), reachedExit);
    const stats = {
        biome: biomeId,
        backend: biome.backend,
        usedFallback,
        iterations: backendStats.iterations,
        accepted: backendStats.accepted,
        rejected: backendStats.rejectedFeasibility ?? 0,
        rejectedFeasibility: backendStats.rejectedFeasibility ?? 0,
        stalled: backendStats.stalled ?? false,
        shortestPath: finalReach.ok ? finalReach.steps : null,
        gateKeyPlaced: gateKeyResult.placed,
        gateKeyReason: gateKeyResult.reason ?? null,
        doorPos: gateKeyResult.doorPos ?? null,
        keyPos: gateKeyResult.keyPos ?? null,
    };

    return { world, stats };
}

// --- Substrate adapter ---
//
// Three pipeline-agnostic functions — generateRegionCore,
// placeFromItems, and extractPathsAndObstacles (already defined
// above) — compose into the full substrate-adapter contract. See
// docs/json/developer/procgen/substrate-registry.md.
//
// v1 scope:
//   - Exactly one entrance (or none for start regions).
//   - Multi-exit: caller may specify spec.side (random tile on that
//     side) or omit it (substrate picks via clockwise wall
//     assignment, starting from east).
//   - Auto-grow: if not all exits can be placed at the input size
//     (entrance + exits exceed perimeter capacity), the substrate
//     grows the region and retries up to a small budget.
//   - Colored key+door pairs via placeGateAndKey; other items
//     placed on random reachable tiles; other obstacles left
//     unplaced and reported back to the caller.

// Side constants, auto-grow knobs, perimeter helpers, exit-tile
// assignment, and the start-region entrance helper now live in
// shared/procgen/spatialPrimitives.js. They're imported at the top
// of this file.

function pickReachableFloorTile(world, rng, excluded) {
    const excludedKeys = new Set(excluded.map((p) => `${p.x},${p.y}`));
    const tiles = reachableTiles(world, createState(world));
    const candidates = tiles.filter((t) => {
        if (t.x === world.entrance.x && t.y === world.entrance.y) return false;
        if (isExit(world, t.x, t.y)) return false;
        if (excludedKeys.has(`${t.x},${t.y}`)) return false;
        if (getItem(world, t.x, t.y)) return false;
        if (getObstacle(world, t.x, t.y)) return false;
        return true;
    });
    if (candidates.length === 0) return null;
    return candidates[Math.floor(rng.next() * candidates.length)];
}

// Single-key gate pairs the placer tries to realise via the cut-vertex
// gate-and-key flow. Derived from the obstacle library at call time so
// new colors (or non-color metaphors like gem/barrier, skeleton/padlock)
// are picked up automatically — extend itemLib/obstacleLib and the
// substrate auto-discovers the pair. Order follows obstacleLib insertion
// order, which is deterministic for frozen library objects.
//
// "Single-key gate" means clear_set is exactly [[<one_item>]] — one
// combo, one item. Multi-key gates (clear_set: [[a, b]]) are out of
// scope here; those are handled by the logic-gate obstacle path
// (placeFromRules) which is already fully rule-driven.
export function deriveSingleKeyGatePairs(obstacleLib) {
    const pairs = [];
    for (const [door_id, entry] of Object.entries(obstacleLib)) {
        if (!entry || entry.clear_set_type !== 'combo_list') continue;
        const cs = entry.clear_set;
        if (!Array.isArray(cs) || cs.length !== 1) continue;
        if (!Array.isArray(cs[0]) || cs[0].length !== 1) continue;
        pairs.push({ key_id: cs[0][0], door_id });
    }
    return pairs;
}

/**
 * Substrate adapter — core.
 *
 * Produces an empty-but-valid walls-only maze honoring the given
 * entrance and single exit side. No items or obstacles placed; that
 * is the placer's job.
 *
 * Input:
 *   {
 *     region_id,
 *     size: { width, height },
 *     entrances: []                    // start region (substrate
 *                                      //   picks middle tile), OR
 *                [{ side, tile }],     // child region
 *     exits: [{ side }],               // single exit in v1
 *     item_lib, obstacle_lib,
 *     rng,
 *     params,                          // maze-specific knobs
 *   }
 *
 * Output:
 *   {
 *     world,                           // walls-only, libs threaded
 *     exits_placed: [{ side, tile_position }],
 *     entrance_tile,                   // what the substrate resolved
 *     wall_stats,                      // from generateMaze
 *   }
 */
export function generateRegionCore(input) {
    const {
        region_id,
        size,
        entrances = [],
        exits = [],
        item_lib = DEFAULT_ITEMS,
        obstacle_lib = DEFAULT_OBSTACLES,
        rng,
        params = {},
        // Per-region biome selection. Shape: { id, paramsOverride? }.
        // null/undefined → DEFAULT_BIOME_ID via resolveBiome inside
        // generateMaze. Round-tripped through preset_sidecars.
        biome = null,
    } = input;

    if (!region_id) throw new Error('generateRegionCore: region_id required');
    if (!size || !size.width || !size.height) throw new Error('generateRegionCore: size.{width,height} required');
    if (!rng || typeof rng.next !== 'function') throw new Error('generateRegionCore: rng required');
    if (entrances.length > 1) throw new Error('generateRegionCore v1: at most one entrance supported');
    // 0 exits is legal — a "terminal" region in the source rules.json
    // has no outgoing edges; the caller may add a back-exit after the
    // fact (top-down driver does this). The substrate produces a
    // walls-only region with just the entrance tile in that case.

    // Resolve entrance tile (independent of size growth — the same
    // tile coords stay valid across the auto-grow attempts).
    let entrance_tile;
    if (entrances.length === 0) {
        entrance_tile = entranceTileForStartRegion(size);
    } else {
        const ent = entrances[0];
        if (!ent.tile) {
            throw new Error('generateRegionCore: entrance tile required for non-start region');
        }
        entrance_tile = ent.tile;
    }

    // Default exit_id: 'exit' for the single-exit case (preserves the
    // legacy id and keeps already-serialized rules.json files
    // round-tripping); 'exit_<i>' otherwise.
    const defaultExitId = (i) => exits.length === 1 ? 'exit' : `exit_${i}`;

    // Auto-grow loop: try to assign all exit tiles at the current
    // size; if assignment fails (exits ran out of perimeter slots),
    // grow the region uniformly and retry.
    let currentSize = { width: size.width, height: size.height };
    let resolvedExits = null;
    let growAttempts = 0; // # of failed assignments, == # of times the size grew.
    for (let attempt = 0; attempt <= REGION_GROW_MAX_ATTEMPTS; attempt++) {
        resolvedExits = tryAssignExitTiles(currentSize, exits, entrance_tile, rng, defaultExitId);
        if (resolvedExits) break;
        if (attempt === REGION_GROW_MAX_ATTEMPTS) {
            throw new Error(
                `generateRegionCore: cannot place ${exits.length} exit(s) in `
                + `${size.width}x${size.height} after ${REGION_GROW_MAX_ATTEMPTS} `
                + `grow attempts (final ${currentSize.width}x${currentSize.height})`,
            );
        }
        currentSize = {
            width: currentSize.width + REGION_GROW_STEP,
            height: currentSize.height + REGION_GROW_STEP,
        };
        growAttempts += 1;
    }

    const mazeSeed = Math.floor(rng.next() * 0x7fffffff);
    const { world, stats: wall_stats } = generateMaze({
        width: currentSize.width,
        height: currentSize.height,
        seed: mazeSeed,
        entrance: entrance_tile,
        exits: resolvedExits,
        biome,
        params: { ...params, placeGateAndKey: false },
    });

    // Thread caller-supplied libs onto the world so step() and
    // extractPathsAndObstacles consult the right clear_sets.
    world.itemLib = item_lib;
    world.obstacleLib = obstacle_lib;

    // Stamp the resolved biome on the world so serializeMazeWorld can
    // emit it into the sidecar without the caller having to thread it
    // through separately. wall_stats.biome is the resolved id (i.e.
    // DEFAULT_BIOME_ID when input was null).
    world.biome = {
        id: wall_stats.biome,
        ...(biome?.paramsOverride ? { paramsOverride: biome.paramsOverride } : {}),
    };

    return {
        world,
        exits_placed: resolvedExits.map((e) => ({
            exit_id: e.exit_id,
            side: e.side,
            tile_position: { x: e.x, y: e.y },
        })),
        entrance_tile,
        size_used: { width: currentSize.width, height: currentSize.height },
        wall_stats,
        biome: world.biome,
        // Per-region auto-grow telemetry. Surfaced through the
        // top-down driver and into procgen_metadata so the procgen
        // stats panel can show which regions had their initial size
        // under-provisioned by topDownRegionSize. Used to tune the
        // formula's slack constants.
        grow_telemetry: {
            requested_size: { width: size.width, height: size.height },
            final_size: { width: currentSize.width, height: currentSize.height },
            grow_attempts: growAttempts,
        },
    };
}

// tryAssignExitTiles now lives in shared/procgen/spatialPrimitives.js.
// generateRegionCore (above) imports it from there.

/**
 * Substrate adapter — item-driven placement.
 *
 * Places the requested concrete items and obstacles into an existing
 * `world` produced by generateRegionCore. The caller decides whether
 * obstacles are appropriate for this region (e.g. start regions pass
 * `obstacles_to_place: []`); placeFromItems always attempts to place
 * everything it is given.
 *
 * Input:
 *   world,
 *   {
 *     items_to_place: [item_id, ...],
 *     obstacles_to_place: [obstacle_id, ...],
 *     arrival_inventory: Set<item_id>,    // accepted, v1-unused
 *     rng,
 *     params,                             // gateKey* knobs
 *   }
 *
 * Output:
 *   { placed_items, placed_obstacles }
 *
 * Unplaced items/obstacles are reported by omission; the caller can
 * compute the diff against its inputs.
 */
export function placeFromItems(world, input = {}) {
    const {
        items_to_place = [],
        obstacles_to_place = [],
        arrival_inventory: _arrival_inventory = new Set(),
        rng,
        params = {},
    } = input;

    if (!world) throw new Error('placeFromItems: world required');
    if (!rng || typeof rng.next !== 'function') throw new Error('placeFromItems: rng required');

    const placed_items = [];
    const placed_obstacles = [];
    const remaining_items = [...items_to_place];
    const remaining_obstacles = [...obstacles_to_place];

    const pgParams = {
        gateKeyMaxAttempts: params.gateKeyMaxAttempts ?? 20,
        gateKeyMinBeforeDoor: params.gateKeyMinBeforeDoor ?? 2,
    };

    // Try to place one key-and-door pair per single-key gate that has
    // both sides of the pair in the inputs. Pairs are derived from the
    // obstacle library, so any colored or metaphorical key/door entries
    // present in world.obstacleLib are picked up.
    for (const { key_id, door_id } of deriveSingleKeyGatePairs(world.obstacleLib)) {
        if (!remaining_obstacles.includes(door_id) || !remaining_items.includes(key_id)) continue;
        const result = placeGateAndKey(world, rng, pgParams, { key_id, door_id });
        if (!result.placed) continue;
        placed_obstacles.push({ obstacle_id: door_id, position: result.doorPos });
        placed_items.push({ item_id: key_id, position: result.keyPos });
        remaining_obstacles.splice(remaining_obstacles.indexOf(door_id), 1);
        remaining_items.splice(remaining_items.indexOf(key_id), 1);
    }

    // Remaining items land on random reachable floor tiles.
    for (const item_id of remaining_items) {
        const excluded = [
            ...placed_items.map((p) => p.position),
            ...placed_obstacles.map((p) => p.position),
        ];
        const tile = pickReachableFloorTile(world, rng, excluded);
        if (!tile) break;
        setItem(world, tile.x, tile.y, item_id);
        placed_items.push({ item_id, position: tile });
    }

    // Remaining obstacles go unplaced in v1. The caller reclaims
    // them by diffing inputs against output.
    return { placed_items, placed_obstacles };
}

/**
 * Substrate adapter — rule-driven placement.
 *
 * Top-down mode. Realises a pre-specified rule set as geometry by
 * placing logic_gate tiles directly on target tiles — on the exit
 * tile for each exit rule, on the item-pickup tile for each location
 * rule. Simple, no cut-vertex search, no gate merging; see
 * substrate-pipeline-architecture.md §"Logic-gate obstacle" for the
 * rationale.
 *
 * Each placed gate becomes a per-instance obstacle entry in the
 * world's `obstacleLib` with a unique id (`logic_gate_<N>`) and its
 * own `clear_rule`. The compiler and runtime don't need special
 * handling beyond the `clear_set_type: 'rule'` dispatch already in
 * place.
 *
 * Input:
 *   world,
 *   {
 *     exit_rules:      { [exit_id]:     <Rule Builder rule> },
 *     location_rules:  { [location_id]: <Rule Builder rule> },
 *     item_placements: [ { item_id, location_id } ],
 *     rng,
 *     params,
 *   }
 *
 * Output:
 *   { placed_logic_gates, placed_items, placed_locations }
 *
 * v1 scope:
 *   - Exactly one exit per region — at most one entry in exit_rules.
 *   - A location rule places a gate on the same tile as the location's
 *     item, so the gate clearance also gates item pickup.
 *   - item_placements entries with no matching location_rule land on
 *     a random reachable tile with no gate.
 *
 * The **gate-of-arrival exception** from the architecture doc is a
 * no-op in v1: `step()` only checks the target tile of a move, never
 * the source, so a player placed on a gate tile (via createState or
 * the future playback dispatcher's region-transition) is allowed to
 * be there and can always step off. The exception becomes
 * load-bearing once back-traversal / bidirectional exits land —
 * re-entering the same gate then has to be a normal gated step
 * again, and `State` will need a "gates I've arrived on and not
 * stepped off" set. Deferred until that work.
 */
export function placeFromRules(world, input = {}) {
    const {
        exit_rules = {},
        location_rules = {},
        item_placements = [],
        rng,
        params: _params = {},
    } = input;

    if (!world) throw new Error('placeFromRules: world required');
    if (!rng || typeof rng.next !== 'function') throw new Error('placeFromRules: rng required');

    // Copy the obstacleLib so per-instance gate entries added here
    // don't leak into other regions sharing the same reference.
    world.obstacleLib = { ...world.obstacleLib };

    const logicGateBase = world.obstacleLib.logic_gate ?? {
        name: 'Logic Gate',
        clear_set_type: 'rule',
        color: '#b06eb8',
        display: { mode: 'tree' },
    };

    let gateCounter = 0;
    const newGateId = () => `logic_gate_${gateCounter++}`;
    const registerGate = (rule) => {
        const gate_id = newGateId();
        world.obstacleLib[gate_id] = {
            ...logicGateBase,
            id: gate_id,
            clear_set_type: 'rule',
            clear_rule: rule,
        };
        return gate_id;
    };

    const placed_logic_gates = [];
    const placed_items = [];
    const placed_locations = [];

    // §6: a logic gate whose rule is just `True_` would never block
    // anything — placing it is pure visual noise. Skip those.
    const isTrueRule = (rule) => rule?.rule === 'True_';

    // Exit rules: gate each exit tile by exit_id. Each exit_rules
    // entry must reference an exit_id that's already in world.exits.
    for (const [exit_id, rule] of Object.entries(exit_rules)) {
        const exit = world.exits.get(exit_id);
        if (!exit) {
            throw new Error(`placeFromRules: exit_rules references unknown exit_id '${exit_id}'`);
        }
        if (isTrueRule(rule)) continue; // §6 — no gate needed
        const gate_id = registerGate(rule);
        setObstacle(world, exit.x, exit.y, gate_id);
        placed_logic_gates.push({
            gate_id,
            exit_id,
            position: { x: exit.x, y: exit.y },
            clear_rule: rule,
        });
    }

    // Location rules: pick a reachable floor tile per location, place
    // the mapped item there, and put a gate on the same tile.
    const itemByLocation = Object.fromEntries(
        item_placements.map((p) => [p.location_id, p.item_id]),
    );
    const placedLocationIds = new Set();
    for (const [location_id, rule] of Object.entries(location_rules)) {
        const excluded = [
            ...placed_logic_gates.map((g) => g.position),
            ...placed_items.map((p) => p.position),
        ];
        const tile = pickReachableFloorTile(world, rng, excluded);
        if (!tile) continue;

        const item_id = itemByLocation[location_id];
        if (item_id) {
            setItem(world, tile.x, tile.y, item_id);
            placed_items.push({ item_id, location_id, position: tile });
        }
        if (isTrueRule(rule)) {
            // §6 — record the location placement but skip the gate.
            placed_locations.push({ location_id, position: tile });
            placedLocationIds.add(location_id);
            continue;
        }
        const gate_id = registerGate(rule);
        setObstacle(world, tile.x, tile.y, gate_id);
        placed_logic_gates.push({
            gate_id,
            location_id,
            position: tile,
            clear_rule: rule,
        });
        placed_locations.push({ location_id, position: tile });
        placedLocationIds.add(location_id);
    }

    // Rule-less item placements land on a random reachable tile, no
    // gate. These locations are reachable via the region's ordinary
    // paths-and-obstacles extraction (no placed obstacle → empty path).
    for (const { item_id, location_id } of item_placements) {
        if (placedLocationIds.has(location_id)) continue;
        const excluded = [
            ...placed_logic_gates.map((g) => g.position),
            ...placed_items.map((p) => p.position),
        ];
        const tile = pickReachableFloorTile(world, rng, excluded);
        if (!tile) continue;
        setItem(world, tile.x, tile.y, item_id);
        placed_items.push({ item_id, location_id, position: tile });
        placed_locations.push({ location_id, position: tile });
        placedLocationIds.add(location_id);
    }

    return { placed_logic_gates, placed_items, placed_locations };
}
