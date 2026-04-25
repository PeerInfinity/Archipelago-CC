/**
 * procgenPipeline engine — headless grid-growth pipeline logic plus
 * the top-down driver. See NewDocs/plans/procedural-generation/
 * grid-growth-pipeline.md and top-down-driver.md.
 *
 * This file hosts the scenario pool, grid model, growth loop,
 * incremental re-stitcher, full-world Boolean compile, and the
 * top-down driver that consumes an existing rules.json. Contents
 * grow per the v1 punch list in the plan docs.
 */

import { createRng } from '../shared/rng.js';
import {
    generateRegionCore, placeFromItems, placeFromRules,
    extractPathsAndObstacles,
} from '../mazeRoom/mazeRoomEngine.js';
import { DEFAULT_ITEMS, DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import { compileRegion } from '../shared/procgen/pathsAndObstaclesCompiler.js';
import { ScenarioPool } from '../shared/procgen/scenarioPool.js';
import { makeRulesJsonScaffold } from '../shared/rulesJsonBuilder.js';

// Re-export so existing callers (tests, UI) that imported ScenarioPool
// from this module keep working. New callers should import from
// shared/procgen/scenarioPool.js directly.
export { ScenarioPool };

// --- Grid direction constants ---

export const SIDE_N = 'N';
export const SIDE_S = 'S';
export const SIDE_E = 'E';
export const SIDE_W = 'W';
export const SIDES = [SIDE_N, SIDE_S, SIDE_E, SIDE_W];

export const OPPOSITE_SIDE = Object.freeze({
    [SIDE_N]: SIDE_S,
    [SIDE_S]: SIDE_N,
    [SIDE_E]: SIDE_W,
    [SIDE_W]: SIDE_E,
});

const SIDE_DELTAS = Object.freeze({
    [SIDE_N]: { dx: 0, dy: -1 },
    [SIDE_S]: { dx: 0, dy: 1 },
    [SIDE_E]: { dx: 1, dy: 0 },
    [SIDE_W]: { dx: -1, dy: 0 },
});

export function cellKey(cell) {
    return `${cell.gx},${cell.gy}`;
}

// --- Grid data model ---
//
// Cell-to-region storage for the grid-growth pipeline. Each cell
// holds a Region = the driver-composed output of a substrate (see
// buildMazeRegion below) augmented with its grid position.

export class Grid {
    constructor({ width, height }) {
        if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
            throw new Error(`Grid: invalid dimensions ${width}x${height}`);
        }
        this.width = width;
        this.height = height;
        this.cells = new Map();
        // Teleporter mappings keyed by `${fromCellKey}:${side}` →
        // toCellKey. Used when an exit's geographic neighbor is
        // invalid (out of bounds, or already built by another branch
        // of growth); the driver places the new region in a cell
        // disconnected from the geometric layout, and stitchGrid
        // honors this mapping in place of grid.neighborCell.
        this.teleporters = new Map();
    }

    isInBounds(cell) {
        return cell.gx >= 0 && cell.gx < this.width
            && cell.gy >= 0 && cell.gy < this.height;
    }

    hasRegion(cell) {
        return this.cells.has(cellKey(cell));
    }

    getRegion(cell) {
        return this.cells.get(cellKey(cell));
    }

    placeRegion(cell, region) {
        if (!this.isInBounds(cell)) {
            throw new Error(`Grid.placeRegion: cell (${cell.gx},${cell.gy}) out of bounds`);
        }
        if (this.hasRegion(cell)) {
            throw new Error(`Grid.placeRegion: cell (${cell.gx},${cell.gy}) already occupied`);
        }
        this.cells.set(cellKey(cell), { ...region, cell: { gx: cell.gx, gy: cell.gy } });
    }

    neighborCell(cell, side) {
        const d = SIDE_DELTAS[side];
        if (!d) throw new Error(`Grid.neighborCell: unknown side '${side}'`);
        const next = { gx: cell.gx + d.dx, gy: cell.gy + d.dy };
        return this.isInBounds(next) ? next : null;
    }

    setTeleporter(fromCell, fromSide, toCell) {
        this.teleporters.set(`${cellKey(fromCell)}:${fromSide}`, cellKey(toCell));
    }

    /** Returns the target cell for a teleporter exit, or null. */
    getTeleporter(fromCell, fromSide) {
        const v = this.teleporters.get(`${cellKey(fromCell)}:${fromSide}`);
        if (!v) return null;
        const [gx, gy] = v.split(',').map(Number);
        return { gx, gy };
    }

    allRegions() {
        return [...this.cells.values()];
    }

    // Sides of `cell` that point to an unbuilt cell within bounds.
    // Useful for the growth loop's frontier tracking.
    openSides(cell) {
        const out = [];
        for (const side of SIDES) {
            const neighbor = this.neighborCell(cell, side);
            if (neighbor && !this.hasRegion(neighbor)) out.push(side);
        }
        return out;
    }
}

/**
 * Find an unbuilt grid cell at least `minGap` Manhattan-distance away
 * from every built region. Used by the teleporter fallback when an
 * exit's geographic neighbor is unusable. Returns null when no such
 * cell exists (grid is too crowded). Choice among candidates is
 * uniform via rng.
 *
 * Why ≥2: keeps the disconnected region visually distinct from the
 * connected component when the procgen pipeline panel composites the
 * full grid. A 1-cell gap reads as a missing connection rather than
 * a deliberately-disconnected region.
 */
export function findDisconnectedCell(grid, rng, minGap = 2) {
    const built = grid.allRegions();
    if (built.length === 0) {
        // Anywhere in the grid is fine; pick a deterministic cell.
        return { gx: Math.floor(grid.width / 2), gy: Math.floor(grid.height / 2) };
    }
    const candidates = [];
    for (let gx = 0; gx < grid.width; gx++) {
        for (let gy = 0; gy < grid.height; gy++) {
            if (grid.hasRegion({ gx, gy })) continue;
            let minDist = Infinity;
            for (const r of built) {
                const d = Math.abs(gx - r.cell.gx) + Math.abs(gy - r.cell.gy);
                if (d < minDist) minDist = d;
            }
            if (minDist >= minGap) candidates.push({ gx, gy });
        }
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(rng.next() * candidates.length)];
}

// --- Incremental re-stitcher ---
//
// Resolves each built region's exit target_region values by consulting
// grid adjacency. Mutates the stored regions' extracted_rules in place;
// callers that need an immutable snapshot should clone before calling.
//
// Under tree shape (v1), an exit on side `s` of region at cell `c`
// points to the region at cell `c + delta(s)`. If that neighbor cell
// is unbuilt or outside the grid, target_region stays null.

export function stitchGrid(grid) {
    for (const region of grid.allRegions()) {
        const exitsBySide = new Map();
        for (const placed of region.exits_placed ?? []) {
            exitsBySide.set(posKey(placed.tile_position), placed.side);
        }
        for (const exit of region.extracted_rules?.exits ?? []) {
            const side = exitsBySide.get(posKey(exit.position));
            if (!side) {
                // Not in exits_placed — the driver manages this exit
                // directly (e.g. a bidirectional back-exit pointing
                // at the parent region). Leave target_region alone.
                continue;
            }

            // Teleporter exits resolve to an explicit target cell
            // recorded by the growth driver; ordinary exits resolve
            // via geographic adjacency.
            const teleTarget = grid.getTeleporter(region.cell, side);
            const targetCell = teleTarget ?? grid.neighborCell(region.cell, side);
            const neighbor = targetCell ? grid.getRegion(targetCell) : null;
            exit.target_region = neighbor ? neighbor.region_id : null;

            // Mirror onto world.exits so runtime transitions see the
            // resolved target — and the teleporter flag, so the panel
            // can render teleporter exits differently if it wants to.
            const worldExit = region.playable_payload?.exits?.get(exit.id);
            if (worldExit) {
                worldExit.targetRegion = exit.target_region;
                worldExit.isTeleporter = teleTarget !== null;
            }
        }
    }
}

function posKey(p) { return `${p.x},${p.y}`; }

// Union of placed items across all built regions. Valid as an
// arrival_inventory approximation under v1's tree shape + local
// keys-before-doors invariant: every placed item is reachable from
// every built region.
export function accumulatedInventory(grid) {
    const inv = new Set();
    for (const region of grid.allRegions()) {
        for (const p of region.placed_items ?? []) {
            inv.add(p.item_id);
        }
    }
    return inv;
}

// Drop exits whose target_region is null from the extracted rules,
// from world.exits, and from exits_placed. Unused exits (grid-edge,
// or a neighbor cell that never got built) get quietly omitted from
// the final rules so the compiler doesn't see dangling targets, and
// from the runtime view so the maze panel doesn't paint exit-color
// tiles that go nowhere when stepped on.
export function wallOffUnusedExits(grid) {
    for (const region of grid.allRegions()) {
        if (!region.extracted_rules) continue;
        const validExits = (region.extracted_rules.exits ?? [])
            .filter((e) => e.target_region != null);
        const validIds = new Set(validExits.map((e) => e.id));
        region.extracted_rules.exits = validExits;

        if (region.playable_payload?.exits) {
            for (const id of [...region.playable_payload.exits.keys()]) {
                if (!validIds.has(id)) region.playable_payload.exits.delete(id);
            }
        }
        if (Array.isArray(region.exits_placed)) {
            region.exits_placed = region.exits_placed.filter((e) => validIds.has(e.exit_id));
        }
    }
}

// --- Growth loop helpers ---

function regionIdForCell(cell) {
    return `region_${cell.gx}_${cell.gy}`;
}

function mirrorTileAcrossSide(parentTile, parentSide, regionSize) {
    switch (parentSide) {
        case SIDE_E: return { x: 0, y: parentTile.y };
        case SIDE_W: return { x: regionSize.width - 1, y: parentTile.y };
        case SIDE_N: return { x: parentTile.x, y: regionSize.height - 1 };
        case SIDE_S: return { x: parentTile.x, y: 0 };
        default: throw new Error(`mirrorTileAcrossSide: unknown side '${parentSide}'`);
    }
}

/**
 * Pick exit sides for the start region. Always returns the primary
 * (random in-bounds side); each remaining in-bounds side is added
 * with probability `branchProbability` (so 0 collapses to single-
 * exit, 1 yields all-sides).
 */
function pickStartExitSides(cell, grid, rng, branchProbability) {
    const inBounds = SIDES.filter((s) => grid.neighborCell(cell, s) !== null);
    if (inBounds.length === 0) return [];
    return pickSidesWithBranching(inBounds, rng, branchProbability);
}

/**
 * Pick exit sides for a non-start region. Excludes the entrance side
 * and any side whose neighbor cell is already built or out of bounds.
 *
 * The "out of bounds / built" check here is just for selecting which
 * sides to *consider*; an exit on a side that later turns out to
 * conflict (e.g. a sibling branch built into the geographic neighbor
 * first) will route via teleporter at growth time. Returning [] is
 * still possible if every non-entrance side is OOB or built — caller
 * skips the cell.
 */
function pickChildExitSides(cell, grid, entranceSide, rng, branchProbability) {
    const candidates = SIDES
        .filter((s) => s !== entranceSide)
        .filter((s) => {
            const n = grid.neighborCell(cell, s);
            return n !== null && !grid.hasRegion(n);
        });
    if (candidates.length === 0) return [];
    return pickSidesWithBranching(candidates, rng, branchProbability);
}

/** Returns a random primary plus each non-primary at branchProbability. */
function pickSidesWithBranching(candidates, rng, branchProbability) {
    const primary = candidates[Math.floor(rng.next() * candidates.length)];
    const out = [primary];
    for (const s of candidates) {
        if (s === primary) continue;
        if (rng.next() < branchProbability) out.push(s);
    }
    return out;
}

// --- Substrate composition ---
//
// Wraps the three maze-substrate adapter calls (generateRegionCore +
// placeFromItems + extractPathsAndObstacles) into the region-object
// shape the grid-growth driver and its downstream consumers expect.
// Lives in the driver (not the substrate) because the
// "start region → no obstacles" policy is a driver concern — the
// caller passes `obstacles_to_place: []` for start regions.

function buildMazeRegion({
    region_id,
    size,
    entrances,
    exit_sides,
    arrival_inventory,
    items_to_place,
    obstacles_to_place,
    itemLib,
    obstacleLib,
    rng,
    params,
}) {
    const core = generateRegionCore({
        region_id,
        size,
        entrances,
        exits: exit_sides.map((side) => ({ side })),
        item_lib: itemLib,
        obstacle_lib: obstacleLib,
        rng,
        params,
    });
    const placement = placeFromItems(core.world, {
        items_to_place,
        obstacles_to_place,
        arrival_inventory,
        rng,
        params,
    });
    const extracted_rules = extractPathsAndObstacles(core.world, { regionId: region_id });
    return {
        region_id,
        playable_payload: core.world,
        extracted_rules,
        placed_items: placement.placed_items,
        placed_obstacles: placement.placed_obstacles,
        exits_placed: core.exits_placed,
        render_hint: 'maze',
        sidecar_filename: `${region_id}.json`,
        wall_stats: core.wall_stats,
    };
}

// --- Growth loop ---
//
// Builds a grid of regions starting from the center, expanding
// BFS-style. v1 constraints:
//   - One exit per region (including start). Multi-exit starts and
//     branching from any region are growth-path items.
//   - Tree shape only — no shortcuts between grid-adjacent regions.
//   - No reciprocal exit entries on the "back" direction (traversing
//     from B back to A is the caller's concern for v1).
//
// Termination: when the scenario pool is exhausted OR the frontier is
// empty OR the maxRegions cap (if set) is hit.

export function growMaze(config) {
    const {
        gridDims,
        regionSize,
        itemPool = {},
        obstaclePool = {},
        itemLib = DEFAULT_ITEMS,
        obstacleLib = DEFAULT_OBSTACLES,
        seed = 1,
        regionParams = {},
        growthParams = {},
    } = config;

    if (!gridDims || !gridDims.width || !gridDims.height) {
        throw new Error('growMaze: gridDims.{width,height} required');
    }
    if (!regionSize || !regionSize.width || !regionSize.height) {
        throw new Error('growMaze: regionSize.{width,height} required');
    }

    const {
        maxItemsPerRegion = 2,
        maxRegions = null,
        branchProbability = 0.5,
        teleporterMinGap = 2,
        // When true, every non-start region gets a back-exit at its
        // entrance tile pointing to its parent — so the player can
        // walk back the way they came. The back-exit's access rule is
        // copied from the forward exit at compile time, so the same
        // gate guards both directions of traversal. See top-down-
        // driver.md §2.
        assumeBidirectional = true,
    } = growthParams;

    const rng = createRng(seed);
    const pool = new ScenarioPool({
        items: itemPool, obstacles: obstaclePool, itemLib, obstacleLib,
    });
    const grid = new Grid(gridDims);

    const stats = {
        regionsBuilt: 0,
        regionsSkipped: 0,
        teleportersPlaced: 0,
        stopReason: null,
    };

    // --- Start region ---
    const startCell = {
        gx: Math.floor(gridDims.width / 2),
        gy: Math.floor(gridDims.height / 2),
    };
    const startExitSides = pickStartExitSides(startCell, grid, rng, branchProbability);
    if (startExitSides.length === 0) {
        throw new Error('growMaze: start cell has no in-bounds neighbors (grid too small?)');
    }
    const startRegion = buildMazeRegion({
        region_id: regionIdForCell(startCell),
        size: regionSize,
        entrances: [],                     // start region — substrate picks middle
        exit_sides: startExitSides,
        arrival_inventory: new Set(),
        items_to_place: [],
        obstacles_to_place: [],            // start region — no obstacles
        itemLib, obstacleLib, rng, params: regionParams,
    });
    grid.placeRegion(startCell, startRegion);
    pool.markPlaced({
        placed_items: startRegion.placed_items,
        placed_obstacles: startRegion.placed_obstacles,
    });
    stitchGrid(grid);
    stats.regionsBuilt += 1;

    // --- Frontier init ---
    // Each frontier entry represents an unbuilt parent-side that
    // needs a child region. The child cell is resolved at pop time
    // (geographic neighbor when free, teleporter target otherwise).
    const frontier = [];
    for (const placed of startRegion.exits_placed) {
        frontier.push({ parentCell: startCell, parentSide: placed.side });
    }

    // --- Main loop ---
    while (frontier.length > 0) {
        if (pool.itemsRemaining() === 0) {
            stats.stopReason = 'pool_empty';
            break;
        }
        if (maxRegions != null && stats.regionsBuilt >= maxRegions) {
            stats.stopReason = 'max_regions';
            break;
        }

        const pickIdx = Math.floor(rng.next() * frontier.length);
        const entry = frontier.splice(pickIdx, 1)[0];
        const { parentCell, parentSide } = entry;

        const parentRegion = grid.getRegion(parentCell);
        const parentExitPlaced = parentRegion.exits_placed.find((e) => e.side === parentSide);
        if (!parentExitPlaced) {
            stats.regionsSkipped += 1;
            continue;
        }

        // Resolve the child cell. Geographic neighbor wins when it's
        // in-bounds and unbuilt. Otherwise (out of bounds, or built
        // by another branch), find a disconnected cell ≥
        // teleporterMinGap cells away and route as a teleporter.
        const geoNeighbor = grid.neighborCell(parentCell, parentSide);
        let childCell;
        let isTeleporter = false;
        if (geoNeighbor && !grid.hasRegion(geoNeighbor)) {
            childCell = geoNeighbor;
        } else {
            const disc = findDisconnectedCell(grid, rng, teleporterMinGap);
            if (!disc) {
                // Nowhere to teleport to — this parent-side won't
                // yield a region. The parent's exit gets walled off
                // in the final pass.
                stats.regionsSkipped += 1;
                continue;
            }
            childCell = disc;
            isTeleporter = true;
        }

        // Entrance side: opposite of parent's exit for adjacent
        // children; for teleporters the geometry is fictional, so
        // we still mirror the parent's exit position to keep the
        // entrance tile well-defined on the child's perimeter.
        const entranceSide = OPPOSITE_SIDE[parentSide];
        const entranceTile = mirrorTileAcrossSide(parentExitPlaced.tile_position, parentSide, regionSize);
        const exitSides = pickChildExitSides(childCell, grid, entranceSide, rng, branchProbability);
        if (exitSides.length === 0) {
            // Dead-end cell with no outgoing direction — parent's exit
            // becomes walled off in the final pass.
            stats.regionsSkipped += 1;
            continue;
        }

        const arrival = accumulatedInventory(grid);
        const plan = pool.planPlacement({
            arrivalInventory: arrival, rng, maxItems: maxItemsPerRegion,
        });

        const region = buildMazeRegion({
            region_id: regionIdForCell(childCell),
            size: regionSize,
            entrances: [{ side: entranceSide, tile: entranceTile }],
            exit_sides: exitSides,
            arrival_inventory: arrival,
            items_to_place: plan.items_to_place,
            obstacles_to_place: plan.obstacles_to_place,
            itemLib, obstacleLib, rng, params: regionParams,
        });

        grid.placeRegion(childCell, region);
        if (isTeleporter) {
            grid.setTeleporter(parentCell, parentSide, childCell);
            stats.teleportersPlaced += 1;
        }
        if (assumeBidirectional) {
            // Add a back-exit on the child's entrance tile, pointing
            // to the parent. Pair with parent's forward exit via
            // targetExitId on both sides so the procgen player can
            // resolve which entrance tile to spawn the player at on
            // either direction of traversal.
            const backExitId = parentRegion.region_id;
            region.playable_payload.exits.set(backExitId, {
                exit_id: backExitId,
                x: entranceTile.x,
                y: entranceTile.y,
                side: entranceSide,
                exitName: backExitId,
                targetRegion: parentRegion.region_id,
                targetExitId: parentExitPlaced.exit_id,
                isBackExit: true,
                isTeleporter,
            });
            // Mirror onto extracted_rules so the compiler emits the
            // back-exit too. Path-and-obstacles for an entrance-to-
            // entrance walk has zero obstacles → compiles to True_;
            // buildRulesJson's post-pass overwrites this with the
            // forward exit's rule for bidirectional pairs.
            region.extracted_rules.exits.push({
                id: backExitId,
                position: { x: entranceTile.x, y: entranceTile.y },
                target_region: parentRegion.region_id,
                paths: [{ path_id: 'p1', obstacles: [] }],
            });
            // Link parent's forward exit back to this child's
            // back-exit, so a forward traversal carries the right
            // arrivedFrom.exit_id.
            const parentWorldExit = parentRegion.playable_payload?.exits?.get(parentExitPlaced.exit_id);
            if (parentWorldExit) parentWorldExit.targetExitId = backExitId;
        }
        pool.markPlaced({
            placed_items: region.placed_items,
            placed_obstacles: region.placed_obstacles,
        });
        stitchGrid(grid);
        stats.regionsBuilt += 1;

        for (const placed of region.exits_placed) {
            // For teleporter children, every exit becomes a fresh
            // frontier entry — geographic neighbors of a disconnected
            // cell are still the natural growth target, even if those
            // also turn out to need teleporters at pop time.
            frontier.push({ parentCell: childCell, parentSide: placed.side });
        }
    }

    if (!stats.stopReason) {
        stats.stopReason = 'frontier_empty';
    }

    wallOffUnusedExits(grid);

    return { grid, pool, stats, startCell };
}

// --- Top-down driver ---
//
// Consume an existing rules.json and realise its region graph as
// maze-substrate regions on a grid. Produces the same {grid, startCell,
// stats} shape as growMaze so the existing compile/emit tail
// (compileRegionGraph, buildRulesJson, buildPresetSidecars) handles
// the output unchanged. See top-down-driver.md.

function cellsAreAdjacent(a, b) {
    if (!a || !b) return false;
    const dx = Math.abs(a.gx - b.gx);
    const dy = Math.abs(a.gy - b.gy);
    return (dx + dy) === 1;
}

function findAdjacentEmptyCell(grid, fromCell, rng) {
    const candidates = SIDES
        .map((s) => grid.neighborCell(fromCell, s))
        .filter((c) => c !== null && !grid.hasRegion(c));
    if (candidates.length === 0) return null;
    return candidates[Math.floor(rng.next() * candidates.length)];
}

/**
 * Per-region size for top-down: enough perimeter to fit the source
 * region's exits + entrance + slack, and enough floor area to fit the
 * locations. Both substrate-side auto-grow (§1B) and the size we pick
 * here can absorb under-provisioned input — picking a sensible
 * starting size keeps auto-grow from firing on every region.
 */
function topDownRegionSize(base, exitCount, locationCount) {
    let width = base.width;
    let height = base.height;
    const perimeter = (w, h) => 2 * w + 2 * h - 4;
    // Each exit needs a perimeter slot, plus 1 for the entrance on a
    // non-start region, plus a couple of slack tiles for the substrate's
    // collision-avoidance during clockwise assignment.
    const perimNeeded = exitCount + 1 + 2;
    while (perimeter(width, height) < perimNeeded) {
        width += 2;
        height += 2;
    }
    // Locations live on floor tiles; ensure enough floor area for them
    // plus entrance/exit/walking room.
    const floorNeeded = locationCount + 4;
    while (width * height < floorNeeded) {
        width += 1;
        height += 1;
    }
    return { width, height };
}

/**
 * Resolve which source region is the "actual" start. Most rules.json
 * files (including the procgen-emitted ones) wrap the playable start
 * in a synthetic Menu region whose only exit is unconditional and
 * points at the real start. Top-down strips Menu and starts BFS from
 * the connected_region; buildRulesJson re-wraps the output in a
 * fresh Menu region on emit.
 */
function resolveTopDownStart(sourceRegions, declaredStart) {
    if (!declaredStart) return null;
    const region = sourceRegions[declaredStart];
    if (!region) return null;
    if (/^menu$/i.test(declaredStart) && (region.exits ?? []).length > 0) {
        const firstExit = region.exits[0];
        if (firstExit?.connected_region && sourceRegions[firstExit.connected_region]) {
            return { actualStart: firstExit.connected_region, menuName: declaredStart };
        }
    }
    return { actualStart: declaredStart, menuName: null };
}

export function topDownFromRulesJson(rulesJson, opts = {}) {
    const {
        playerId = '1',
        gridDims = { width: 12, height: 12 },
        regionSizeBase = { width: 6, height: 6 },
        seed = 1,
        itemLib = DEFAULT_ITEMS,
        obstacleLib = DEFAULT_OBSTACLES,
        regionParams = {},
        teleporterMinGap = 2,
        // Honor the source's flag, default true. When set, every
        // BFS-tree-edge gets a back-exit on the child for round-
        // tripping back through the entrance.
        assumeBidirectional = rulesJson?.assume_bidirectional_exits !== false,
    } = opts;

    const rng = createRng(seed);
    const grid = new Grid(gridDims);

    if (!rulesJson || typeof rulesJson !== 'object') {
        throw new Error('topDownFromRulesJson: rulesJson required');
    }

    const sourceRegions = rulesJson?.regions?.[playerId] ?? {};
    if (Object.keys(sourceRegions).length === 0) {
        throw new Error(`topDownFromRulesJson: no regions for player '${playerId}'`);
    }

    // Locate the declared start.
    const startField = rulesJson?.start_regions?.[playerId];
    let declaredStart = null;
    if (Array.isArray(startField?.default)) declaredStart = startField.default[0];
    else if (Array.isArray(startField)) declaredStart = startField[0];
    const resolved = resolveTopDownStart(sourceRegions, declaredStart);
    if (!resolved) {
        throw new Error(`topDownFromRulesJson: no usable start region for player '${playerId}'`);
    }
    const actualStartName = resolved.actualStart;
    const menuName = resolved.menuName;

    const stats = {
        regionsBuilt: 0,
        regionsSkipped: 0,
        teleportersPlaced: 0,
        regionsTotal: Object.keys(sourceRegions).length,
        stopReason: null,
    };

    // ----- Phase 1: layout -----
    // Walk the source region graph in BFS order from actualStartName,
    // assigning each region a grid cell. When the desired adjacent
    // cell is unavailable, fall back to a disconnected cell ≥ minGap
    // away and mark the connecting source-exit as needing a teleporter.
    // Stub-place each region in the Grid as we go so neighborCell
    // queries work; phase 2 mutates each stub in place with the
    // realised substrate world.
    const startCell = {
        gx: Math.floor(gridDims.width / 2),
        gy: Math.floor(gridDims.height / 2),
    };
    const cellsByName = new Map();
    const placementOrder = []; // [{ name, cell, parent: {name, exit_id} | null }]
    const teleporterEdges = []; // [{ from_name, exit_id }]

    cellsByName.set(actualStartName, startCell);
    placementOrder.push({ name: actualStartName, cell: startCell, parent: null });
    grid.placeRegion(startCell, { region_id: actualStartName });

    const bfsQueue = [actualStartName];
    while (bfsQueue.length > 0) {
        const fromName = bfsQueue.shift();
        const fromCell = cellsByName.get(fromName);
        const fromRegion = sourceRegions[fromName];
        if (!fromRegion) continue;
        for (const exit of fromRegion.exits ?? []) {
            const targetName = exit.connected_region;
            if (!targetName) continue;
            // Skip the synthetic Menu region everywhere — it's a
            // wrapper, not a playable region. buildRulesJson re-emits
            // it on the output side.
            if (menuName && targetName === menuName) continue;
            if (!sourceRegions[targetName]) continue;

            if (cellsByName.has(targetName)) {
                // Target already placed. If not adjacent, mark this
                // source-exit as a teleporter; if adjacent, no-op
                // (the existing geometric edge will be honored).
                const targetCell = cellsByName.get(targetName);
                if (!cellsAreAdjacent(fromCell, targetCell)) {
                    teleporterEdges.push({ from_name: fromName, exit_id: exit.name });
                }
                continue;
            }

            // Target not yet placed. Try a geographic neighbor first.
            const adj = findAdjacentEmptyCell(grid, fromCell, rng);
            if (adj) {
                cellsByName.set(targetName, adj);
                placementOrder.push({
                    name: targetName, cell: adj,
                    parent: { name: fromName, exit_id: exit.name },
                });
                grid.placeRegion(adj, { region_id: targetName });
                bfsQueue.push(targetName);
            } else {
                const disc = findDisconnectedCell(grid, rng, teleporterMinGap);
                if (disc) {
                    cellsByName.set(targetName, disc);
                    placementOrder.push({
                        name: targetName, cell: disc,
                        parent: { name: fromName, exit_id: exit.name },
                    });
                    grid.placeRegion(disc, { region_id: targetName });
                    bfsQueue.push(targetName);
                    teleporterEdges.push({ from_name: fromName, exit_id: exit.name });
                } else {
                    // Grid is too cramped — drop this edge. The exit
                    // will dangle (target_region: null) and get walled
                    // off in the final pass.
                    stats.regionsSkipped += 1;
                }
            }
        }
    }

    // ----- Phase 2: realise each region -----
    // exitSidesByExit lets a child resolve its entrance tile from its
    // parent's exit position — populated as we go through phase 2 in
    // BFS-placement order, so parents always realise before children.
    const exitSidesByExit = new Map(); // "name:exit_id" -> {side, tile_position}

    for (const { name, cell, parent } of placementOrder) {
        const sourceRegion = sourceRegions[name];
        if (!sourceRegion) continue;
        const exitCount = (sourceRegion.exits ?? []).length;
        const locationCount = (sourceRegion.locations ?? []).length;
        const size = topDownRegionSize(regionSizeBase, exitCount, locationCount);

        let entrances = [];
        if (parent) {
            const parentExit = exitSidesByExit.get(`${parent.name}:${parent.exit_id}`);
            if (parentExit) {
                const entranceTile = mirrorTileAcrossSide(
                    parentExit.tile_position, parentExit.side, size,
                );
                entrances = [{
                    side: OPPOSITE_SIDE[parentExit.side],
                    tile: entranceTile,
                }];
            }
        }

        // Forward exits from source. When the target region was
        // placed at a geographic neighbor, hint the substrate to put
        // the exit on that side so stitchGrid's geographic resolution
        // matches. When the target is not adjacent (teleporter
        // case), omit the side and the substrate clockwise-assigns.
        const exitSpecs = (sourceRegion.exits ?? []).map((srcExit) => {
            const targetName = srcExit.connected_region;
            const targetCell = targetName ? cellsByName.get(targetName) : null;
            let side = null;
            if (targetCell) {
                for (const s of SIDES) {
                    const neighbor = grid.neighborCell(cell, s);
                    if (neighbor && neighbor.gx === targetCell.gx && neighbor.gy === targetCell.gy) {
                        side = s;
                        break;
                    }
                }
            }
            return {
                exit_id: srcExit.name,
                exitName: srcExit.name,
                targetRegion: targetName ?? null,
                ...(side ? { side } : {}),
            };
        });

        // Rules to realise via placeFromRules. True_ rules are skipped
        // by the substrate (§6) — no gate appears on the tile, but
        // the exit/location is still emitted in extracted_rules.
        const exit_rules = {};
        for (const srcExit of sourceRegion.exits ?? []) {
            if (srcExit.access_rule) exit_rules[srcExit.name] = srcExit.access_rule;
        }
        const location_rules = {};
        const item_placements = [];
        for (const srcLoc of sourceRegion.locations ?? []) {
            const locId = srcLoc.name ?? String(srcLoc.id ?? '');
            if (!locId) continue;
            if (srcLoc.access_rule) location_rules[locId] = srcLoc.access_rule;
            const itemName = srcLoc.item?.name;
            if (itemName) {
                item_placements.push({ item_id: itemName, location_id: locId });
            }
        }

        const core = generateRegionCore({
            region_id: name,
            size,
            entrances,
            exits: exitSpecs,
            item_lib: itemLib,
            obstacle_lib: obstacleLib,
            rng,
            params: regionParams,
        });
        const placement = placeFromRules(core.world, {
            exit_rules,
            location_rules,
            item_placements,
            rng,
        });
        const extracted_rules = extractPathsAndObstacles(core.world, { regionId: name });

        for (const placed of core.exits_placed) {
            exitSidesByExit.set(`${name}:${placed.exit_id}`, {
                side: placed.side,
                tile_position: placed.tile_position,
            });
        }

        // Mutate the stub in place — Grid doesn't have a replaceRegion
        // method and placeRegion would throw on the second call.
        const stub = grid.getRegion(cell);
        Object.assign(stub, {
            playable_payload: core.world,
            extracted_rules,
            placed_items: placement.placed_items,
            placed_obstacles: [],
            placed_logic_gates: placement.placed_logic_gates,
            exits_placed: core.exits_placed,
            render_hint: 'maze',
            sidecar_filename: `${name}.json`,
        });

        stats.regionsBuilt += 1;
    }

    // ----- Phase 3: teleporters and back-exits -----
    // Setting teleporter mappings was waiting on the substrate-assigned
    // sides from phase 2; now we can stitch them in.
    for (const tele of teleporterEdges) {
        const fromCell = cellsByName.get(tele.from_name);
        const exitInfo = exitSidesByExit.get(`${tele.from_name}:${tele.exit_id}`);
        const targetName = sourceRegions[tele.from_name]?.exits?.find(
            (e) => e.name === tele.exit_id,
        )?.connected_region;
        const targetCell = targetName ? cellsByName.get(targetName) : null;
        if (fromCell && exitInfo && targetCell) {
            grid.setTeleporter(fromCell, exitInfo.side, targetCell);
            stats.teleportersPlaced += 1;
        }
    }

    if (assumeBidirectional) {
        // Add a back-exit on each non-start region pointing to its
        // BFS parent. Mirrors the grid-growth driver's pattern in §2.
        for (const { name, cell, parent } of placementOrder) {
            if (!parent) continue;
            const region = grid.getRegion(cell);
            if (!region?.playable_payload) continue;
            const parentRegion = grid.getRegion(cellsByName.get(parent.name));
            const parentExit = exitSidesByExit.get(`${parent.name}:${parent.exit_id}`);
            if (!parentRegion || !parentExit) continue;
            const entranceTile = region.playable_payload.entrance;
            const entranceSide = OPPOSITE_SIDE[parentExit.side];
            const backExitId = parent.name;
            // Skip the synthetic back-exit when the source already
            // declared a reverse exit pointing at the parent (under
            // any name) — we'd just be duplicating an existing route.
            const hasExplicitReverse = [...region.playable_payload.exits.values()]
                .some((e) => e.targetRegion === parent.name);
            if (region.playable_payload.exits.has(backExitId) || hasExplicitReverse) continue;
            region.playable_payload.exits.set(backExitId, {
                exit_id: backExitId,
                x: entranceTile.x,
                y: entranceTile.y,
                side: entranceSide,
                exitName: backExitId,
                targetRegion: parent.name,
                targetExitId: parent.exit_id,
                isBackExit: true,
                isTeleporter: false,
            });
            region.extracted_rules.exits.push({
                id: backExitId,
                position: { x: entranceTile.x, y: entranceTile.y },
                target_region: parent.name,
                paths: [{ path_id: 'p1', obstacles: [] }],
            });
            const parentWorldExit = parentRegion.playable_payload?.exits?.get(parent.exit_id);
            if (parentWorldExit) parentWorldExit.targetExitId = backExitId;
        }
    }

    // ----- Phase 4: stitch + clean up -----
    stitchGrid(grid);
    wallOffUnusedExits(grid);

    if (!stats.stopReason) {
        stats.stopReason = stats.regionsBuilt === stats.regionsTotal
            ? 'all_placed'
            : 'partial_layout';
    }

    return { grid, startCell, stats };
}

// --- Stage-4 full compile ---
//
// Run compileRegion across every built region in the grid and stitch
// the results into the pieces of rules.json. Returns the substructures
// a caller (UI, test) can plug into makeRulesJsonScaffold:
//   - regions:              rules.json["regions"]["1"]-ready dict
//   - items:                rules.json["items"]["1"]-ready dict
//   - itempool_counts:      rules.json["itempool_counts"]["1"]
//   - canonical_placements: rules.json["canonical_placements"]["1"]
//   - start_region_name:    name of the start region for start_regions
//
// Location names are region-scoped (region__location_id) to stay
// globally unique. Numeric location ids start at LOCATION_ID_BASE and
// increment in deterministic region-iteration order.

const LOCATION_ID_BASE = 1000;
const ITEM_ID_BASE = 1;

// Construct a location's globally unique name from its region name,
// extracted location id, and position. Position is appended so that
// multiple same-id locations in one region (e.g. two key_red_pickup
// entries) don't collide.
//
// Single source of truth for the naming convention — used by both
// compileRegionGraph (to populate the regions block) and
// serializeMazeWorld (to bake locationName into the sidecar so the
// substrate panel can publish user:locationCheck without going through
// a lookup table at runtime).
export function makeLocationName(regionName, locId, position) {
    const suffix = position ? `__${position.x}_${position.y}` : '';
    return `${regionName}__${locId}${suffix}`;
}

export function compileRegionGraph(grid, opts = {}) {
    const {
        obstacleLib = DEFAULT_OBSTACLES,
        itemLib = DEFAULT_ITEMS,
        startCell,
        playerId = 1,
    } = opts;
    const numericPlayerId = Number.isFinite(Number(playerId)) ? Number(playerId) : 1;

    if (!startCell) throw new Error('compileRegionGraph: startCell required');
    const startRegion = grid.getRegion(startCell);
    if (!startRegion) throw new Error('compileRegionGraph: startCell has no region');

    const regions = {};
    const items = {};
    const itempool_counts = {};
    const canonical_placements = {};
    let nextLocationId = LOCATION_ID_BASE;
    let nextItemId = ITEM_ID_BASE;

    // Iterate regions in deterministic order so assigned location ids
    // don't jitter across runs.
    const orderedRegions = [...grid.allRegions()].sort((a, b) => {
        if (a.cell.gy !== b.cell.gy) return a.cell.gy - b.cell.gy;
        return a.cell.gx - b.cell.gx;
    });

    for (const region of orderedRegions) {
        // Top-down's placeFromRules registers per-instance logic_gate
        // entries on the region's local obstacleLib. The compiler
        // needs to see those alongside the base library, otherwise
        // their ids resolve to undefined and compileObstacle throws.
        const localLib = region.playable_payload?.obstacleLib;
        const mergedLib = localLib ? { ...obstacleLib, ...localLib } : obstacleLib;
        const compiled = compileRegion(region.extracted_rules, { obstacleLib: mergedLib });

        const regionExits = compiled.exits.map((e) => ({
            name: e.id,
            connected_region: e.target_region,
            access_rule: e.rule,
        }));

        const regionLocations = compiled.locations.map((loc) => {
            const globalName = makeLocationName(compiled.region_name, loc.id, loc.position);
            const numericId = nextLocationId++;
            let itemPlacement = null;
            if (loc.item) {
                // Register the item and tally the canonical placement.
                // Every non-event item belongs to the "Everything" group by
                // convention (matches item_groups["1"] = ["Everything"]).
                // First occurrence mints a numeric id that persists for
                // the item's lifetime in this compile.
                const classification = itemLib[loc.item]?.classification ?? 'progression';
                if (!items[loc.item]) {
                    items[loc.item] = {
                        name: loc.item,
                        id: nextItemId++,
                        classification,
                        groups: ['Everything'],
                    };
                }
                itempool_counts[loc.item] = (itempool_counts[loc.item] || 0) + 1;
                canonical_placements[globalName] = loc.item;

                // Shape per rules.schema.json $defs/itemPlacement — what
                // stateManager's checkLocation reads to add the item to
                // inventory at runtime. canonical_placements alone isn't
                // enough; stateManager looks at location.item directly.
                itemPlacement = {
                    name: loc.item,
                    player: numericPlayerId,
                    advancement: classification === 'progression',
                    type: classification,
                };
            }
            return {
                name: globalName,
                id: numericId,
                access_rule: loc.rule,
                ...(itemPlacement ? { item: itemPlacement } : {}),
            };
        });

        regions[compiled.region_name] = {
            name: compiled.region_name,
            exits: regionExits,
            locations: regionLocations,
        };
    }

    return {
        regions,
        items,
        itempool_counts,
        canonical_placements,
        start_region_name: startRegion.region_id,
    };
}

// ScenarioPool now lives in shared/procgen/scenarioPool.js — it is
// re-exported near the top of this file so existing import paths
// continue to work.

// --- Full rules.json assembly ---
//
// buildRulesJson composes:
//   - makeRulesJsonScaffold (the Archipelago-required top-level shape)
//   - compileRegionGraph output (regions, items, canonical_placements,
//     itempool_counts — plugged into the scaffold's per-player slots)
//   - preset_sidecars — per-region playable payloads, serialized into
//     JSON-safe shapes (see
//     NewDocs/plans/procedural-generation/substrate-pipeline-
//     architecture.md §"Preset sidecars through the multiworld bridge"
//     for the target shape).
//
// Output: a single JSON-serialisable object the frontend can write to
// disk as rules.json. World_generator currently ignores unknown
// top-level keys, so preset_sidecars rides along untouched in v1;
// step 8 teaches it to preserve the field through the multiworld
// bridge.

// Serialize a maze world into the sidecar payload shape. Maps and
// Int8Array aren't JSON-safe, so this flattens them. AP-canonical
// names from the extracted_rules are baked in so the substrate panel
// can publish user:locationCheck and user:regionMove with the right
// names without consulting any other lookup at runtime.
function serializeMazeWorld(world, extractedRules, baseObstacleLib = DEFAULT_OBSTACLES, baseItemLib = DEFAULT_ITEMS) {
    const obstacles = [];
    for (const [key, id] of world.obstacles) {
        const [x, y] = key.split(',').map(Number);
        obstacles.push({ x, y, id });
    }

    // Lookup: position key "x,y" -> AP-canonical location name. Built
    // from the extracted location list, which already names each item
    // pickup. The lookup is keyed by position because that's how each
    // item maps back to its location entry.
    const locationNameByPos = new Map();
    for (const loc of extractedRules?.locations ?? []) {
        if (!loc.position) continue;
        const key = `${loc.position.x},${loc.position.y}`;
        locationNameByPos.set(key, makeLocationName(extractedRules.region_id, loc.id, loc.position));
    }

    const items = [];
    for (const [key, id] of world.items) {
        const [x, y] = key.split(',').map(Number);
        items.push({ x, y, id, locationName: locationNameByPos.get(key) ?? null });
    }

    // Bake in each exit's AP-canonical name and target region. The
    // sidecar carries the multi-exit `exits` array; deserializeMaze-
    // World builds world.exits back from it. (Old single-exit
    // sidecars used `exit: {...}`; the deserializer accepts both.)
    const extractedExitsById = new Map();
    for (const e of extractedRules?.exits ?? []) {
        extractedExitsById.set(e.id, e);
    }
    const exitsOut = [];
    for (const e of world.exits.values()) {
        const ext = extractedExitsById.get(e.exit_id);
        exitsOut.push({
            exit_id: e.exit_id,
            x: e.x,
            y: e.y,
            side: e.side,
            exitName: ext?.id ?? e.exitName ?? null,
            targetRegion: ext?.target_region ?? e.targetRegion ?? null,
            // Bidirectional metadata — lets the procgen player resolve
            // which exit_id to spawn at on the other side, and lets the
            // panel render back-exits / teleporters distinctly.
            targetExitId: e.targetExitId ?? null,
            isBackExit: e.isBackExit ?? false,
            isTeleporter: e.isTeleporter ?? false,
        });
    }

    // Only include obstacleLib / itemLib entries that aren't already
    // in the base library. Standard colored doors and the maze's own
    // keys live in the base; per-instance logic_gate_<N> entries
    // (from placeFromRules) and any foreign-item metadata baked in
    // by a top-down driver need to travel in the sidecar so the
    // compiler / renderer / runtime can look them up.
    const obstacleLibExtras = {};
    for (const [id, def] of Object.entries(world.obstacleLib || {})) {
        if (!(id in baseObstacleLib)) {
            obstacleLibExtras[id] = def;
        }
    }
    const itemLibExtras = {};
    for (const [id, def] of Object.entries(world.itemLib || {})) {
        if (!(id in baseItemLib)) {
            itemLibExtras[id] = def;
        }
    }
    return {
        width: world.width,
        height: world.height,
        tiles: Array.from(world.tiles),
        entrance: { x: world.entrance.x, y: world.entrance.y },
        exits: exitsOut,
        obstacles,
        items,
        obstacleLib: obstacleLibExtras,
        itemLib: itemLibExtras,
    };
}

export function buildPresetSidecars(grid, {
    playerId = '1',
    baseObstacleLib = DEFAULT_OBSTACLES,
    baseItemLib = DEFAULT_ITEMS,
} = {}) {
    const regionMap = {};
    for (const region of grid.allRegions()) {
        regionMap[region.region_id] = {
            substrate: 'maze',
            render_hint: region.render_hint ?? 'maze',
            playable_payload: serializeMazeWorld(
                region.playable_payload,
                region.extracted_rules,
                baseObstacleLib,
                baseItemLib,
            ),
        };
    }
    return { [playerId]: regionMap };
}

/**
 * JSON.stringify the rules.json with indent=2 for general readability,
 * but collapse each sidecar's `tiles` array onto a single line. The
 * default formatter puts every tile integer on its own line which makes
 * the file ~10× larger than it needs to be.
 */
export function stringifyRulesJson(rulesJson, { indent = 2 } = {}) {
    // Swap the tiles arrays for placeholder strings before stringifying,
    // then splice the compact arrays back into the result. This is
    // safer than a regex walk over the indented output — the placeholder
    // is unambiguous and the compact-array substitution is a single
    // string replace.
    const MARKER = '__PROCGEN_TILES_';
    const captured = [];
    const patched = structuredClone
        ? structuredClone(rulesJson)
        : JSON.parse(JSON.stringify(rulesJson));
    const sidecars = patched.preset_sidecars || {};
    for (const regionMap of Object.values(sidecars)) {
        for (const sidecar of Object.values(regionMap)) {
            const pp = sidecar && sidecar.playable_payload;
            if (pp && Array.isArray(pp.tiles)) {
                const idx = captured.length;
                captured.push(pp.tiles);
                pp.tiles = `${MARKER}${idx}__`;
            }
        }
    }
    let out = JSON.stringify(patched, null, indent);
    for (let i = 0; i < captured.length; i++) {
        const placeholder = `"${MARKER}${i}__"`;
        out = out.replace(placeholder, JSON.stringify(captured[i]));
    }
    return out;
}

export function buildRulesJson(grid, opts = {}) {
    const {
        startCell,
        gameName = 'Procgen Maze',
        gameDirectory = 'procgen_maze_worldgen',
        worldClassName = 'ProcgenMazeWorld',
        seed = 1,
        seedName = '',
        playerName = 'Player1',
        playerId = '1',
        itemLib = DEFAULT_ITEMS,
        obstacleLib = DEFAULT_OBSTACLES,
        // Whether back-exits inherit their forward exit's rule. Mirrors
        // the source rules.json's top-level flag. For grid-growth
        // output (this driver) the default is true — every gate is
        // bidirectional.
        assumeBidirectional = true,
    } = opts;

    if (!startCell) throw new Error('buildRulesJson: startCell required');

    const compiled = compileRegionGraph(grid, { startCell, itemLib, obstacleLib, playerId });

    const scaffold = makeRulesJsonScaffold({
        gameName,
        gameDirectory,
        worldClassName,
        seed,
        seedName,
        playerName,
        // Menu is the virtual start region — AP convention. Real
        // starting geometry lives in compiled.start_region_name, which
        // Menu connects to with an unconditional exit.
        startRegions: ['Menu'],
    });

    // Synthetic Menu region prefixed in front of compiled regions.
    // Object-literal insertion order is preserved in JSON output, so
    // Menu appears first.
    const menuRegion = {
        name: 'Menu',
        exits: [
            {
                name: 'GameStart',
                connected_region: compiled.start_region_name,
                access_rule: { rule: 'True_' },
            },
        ],
        locations: [],
    };
    scaffold.regions[playerId] = { Menu: menuRegion, ...compiled.regions };
    scaffold.items[playerId] = compiled.items;
    scaffold.itempool_counts[playerId] = compiled.itempool_counts;
    scaffold.canonical_placements[playerId] = compiled.canonical_placements;

    // AP convention: `item_groups["1"]` is a list of group *names*.
    // "Everything" is the standard group covering all non-event items.
    // The inventoryUI warns when the list is empty; a single-entry
    // list suffices.
    scaffold.item_groups[playerId] = ['Everything'];

    // Top-level flag: every back-exit inherits the forward exit's
    // rule. The source-rules.json schema's `assume_bidirectional_exits`
    // is what the player module / future top-down driver consult to
    // decide whether to construct back-exits in the first place.
    scaffold.assume_bidirectional_exits = assumeBidirectional;

    // Bidirectional rule inheritance: for every back-exit in the
    // compiled regions, copy the paired forward exit's compiled rule.
    // Without this the back-exit's rule is True_ (its path through
    // the entrance has no obstacles), which would let the player
    // re-enter A from B without re-satisfying the gate.
    if (assumeBidirectional) {
        const regionsByName = {};
        for (const region of grid.allRegions()) {
            regionsByName[region.region_id] = region;
        }
        for (const region of grid.allRegions()) {
            const compiledRegion = scaffold.regions[playerId][region.region_id];
            if (!compiledRegion) continue;
            for (const exit of compiledRegion.exits) {
                const worldExit = region.playable_payload?.exits?.get(exit.name);
                if (!worldExit?.isBackExit) continue;
                const targetRegion = regionsByName[exit.connected_region];
                const compiledTarget = scaffold.regions[playerId][exit.connected_region];
                if (!targetRegion || !compiledTarget) continue;
                const fwdExit = compiledTarget.exits.find(
                    (e) => e.name === worldExit.targetExitId,
                );
                if (fwdExit) exit.access_rule = fwdExit.access_rule;
            }
        }
    }

    // Menu is virtual — no playable payload, no sidecar entry.
    scaffold.preset_sidecars = buildPresetSidecars(grid, {
        playerId, baseObstacleLib: obstacleLib, baseItemLib: itemLib,
    });

    return scaffold;
}
