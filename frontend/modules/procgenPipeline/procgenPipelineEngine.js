/**
 * procgenPipeline engine — headless grid-growth pipeline logic.
 * See NewDocs/plans/procedural-generation/grid-growth-pipeline.md.
 *
 * This file hosts the scenario pool, grid model, growth loop,
 * incremental re-stitcher, and full-world Boolean compile. Contents
 * grow per the v1 punch list in the plan doc.
 */

import { createRng } from '../shared/rng.js';
import { generateMazeRegion } from '../mazeRoom/mazeRoomEngine.js';
import { DEFAULT_ITEMS, DEFAULT_OBSTACLES } from '../mazeRoom/library.js';
import { compileRegion } from '../shared/pathsAndObstaclesCompiler.js';

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
// Cell-to-region storage for the grid-growth pipeline. Each cell holds
// a Region = the output of a substrate generator (generateMazeRegion
// etc.) augmented with its grid position.

export class Grid {
    constructor({ width, height }) {
        if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
            throw new Error(`Grid: invalid dimensions ${width}x${height}`);
        }
        this.width = width;
        this.height = height;
        this.cells = new Map();
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
            if (!side) { exit.target_region = null; continue; }
            const neighborCell = grid.neighborCell(region.cell, side);
            const neighbor = neighborCell ? grid.getRegion(neighborCell) : null;
            exit.target_region = neighbor ? neighbor.region_id : null;
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

// Drop exits whose target_region is null from the extracted rules.
// Unused exits (grid-edge, or never-built neighbor) get quietly
// omitted from the final rules so the compiler doesn't see dangling
// targets. The playable tile itself stays as-is; only the exit entry
// goes away.
export function wallOffUnusedExits(grid) {
    for (const region of grid.allRegions()) {
        if (!region.extracted_rules) continue;
        region.extracted_rules.exits = (region.extracted_rules.exits ?? [])
            .filter((e) => e.target_region != null);
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

function pickStartExitSide(cell, grid, rng) {
    const candidates = SIDES.filter((s) => {
        const n = grid.neighborCell(cell, s);
        return n !== null;
    });
    if (candidates.length === 0) return null;
    return candidates[Math.floor(rng.next() * candidates.length)];
}

function pickChildExitSide(cell, grid, entranceSide, rng) {
    // Prefer in-bounds unbuilt-neighbor sides, excluding the entrance.
    // If none available (dead-end corner), return null — caller skips
    // the cell and the parent's exit gets walled off.
    const candidates = SIDES
        .filter((s) => s !== entranceSide)
        .filter((s) => {
            const n = grid.neighborCell(cell, s);
            return n !== null && !grid.hasRegion(n);
        });
    if (candidates.length === 0) return null;
    return candidates[Math.floor(rng.next() * candidates.length)];
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
    } = growthParams;

    const rng = createRng(seed);
    const pool = new ScenarioPool({
        items: itemPool, obstacles: obstaclePool, itemLib, obstacleLib,
    });
    const grid = new Grid(gridDims);

    const stats = {
        regionsBuilt: 0,
        regionsSkipped: 0,
        stopReason: null,
    };

    // --- Start region ---
    const startCell = {
        gx: Math.floor(gridDims.width / 2),
        gy: Math.floor(gridDims.height / 2),
    };
    const startExitSide = pickStartExitSide(startCell, grid, rng);
    if (!startExitSide) {
        throw new Error('growMaze: start cell has no in-bounds neighbors (grid too small?)');
    }
    const startRegion = generateMazeRegion({
        region_id: regionIdForCell(startCell),
        size: regionSize,
        entrance_side: null,
        entrance_tile: null,
        exit_sides: [startExitSide],
        arrival_inventory: new Set(),
        items_to_place: [],
        obstacles_to_place: [],
        item_lib: itemLib,
        obstacle_lib: obstacleLib,
        rng,
        params: regionParams,
    });
    grid.placeRegion(startCell, startRegion);
    pool.markPlaced({
        placed_items: startRegion.placed_items,
        placed_obstacles: startRegion.placed_obstacles,
    });
    stitchGrid(grid);
    stats.regionsBuilt += 1;

    // --- Frontier init ---
    const frontier = [];
    for (const placed of startRegion.exits_placed) {
        const childCell = grid.neighborCell(startCell, placed.side);
        if (childCell && !grid.hasRegion(childCell)) {
            frontier.push({ childCell, parentCell: startCell, parentSide: placed.side });
        }
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
        const { childCell, parentCell, parentSide } = entry;

        // Already built via another frontier path (shouldn't happen
        // under tree shape, but guard against it).
        if (grid.hasRegion(childCell)) continue;

        const parentRegion = grid.getRegion(parentCell);
        const parentExitPlaced = parentRegion.exits_placed.find((e) => e.side === parentSide);
        if (!parentExitPlaced) {
            stats.regionsSkipped += 1;
            continue;
        }

        const entranceSide = OPPOSITE_SIDE[parentSide];
        const entranceTile = mirrorTileAcrossSide(parentExitPlaced.tile_position, parentSide, regionSize);
        const exitSide = pickChildExitSide(childCell, grid, entranceSide, rng);
        if (!exitSide) {
            // Dead-end cell with no outgoing direction — parent's exit
            // becomes walled off in the final pass.
            stats.regionsSkipped += 1;
            continue;
        }

        const arrival = accumulatedInventory(grid);
        const plan = pool.planPlacement({
            arrivalInventory: arrival, rng, maxItems: maxItemsPerRegion,
        });

        const region = generateMazeRegion({
            region_id: regionIdForCell(childCell),
            size: regionSize,
            entrance_side: entranceSide,
            entrance_tile: entranceTile,
            exit_sides: [exitSide],
            arrival_inventory: arrival,
            items_to_place: plan.items_to_place,
            obstacles_to_place: plan.obstacles_to_place,
            item_lib: itemLib,
            obstacle_lib: obstacleLib,
            rng,
            params: regionParams,
        });

        grid.placeRegion(childCell, region);
        pool.markPlaced({
            placed_items: region.placed_items,
            placed_obstacles: region.placed_obstacles,
        });
        stitchGrid(grid);
        stats.regionsBuilt += 1;

        for (const placed of region.exits_placed) {
            const newChild = grid.neighborCell(childCell, placed.side);
            if (newChild && !grid.hasRegion(newChild)) {
                frontier.push({ childCell: newChild, parentCell: childCell, parentSide: placed.side });
            }
        }
    }

    if (!stats.stopReason) {
        stats.stopReason = 'frontier_empty';
    }

    wallOffUnusedExits(grid);

    return { grid, pool, stats, startCell };
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

export function compileRegionGraph(grid, opts = {}) {
    const {
        obstacleLib = DEFAULT_OBSTACLES,
        itemLib = DEFAULT_ITEMS,
        startCell,
    } = opts;

    if (!startCell) throw new Error('compileRegionGraph: startCell required');
    const startRegion = grid.getRegion(startCell);
    if (!startRegion) throw new Error('compileRegionGraph: startCell has no region');

    const regions = {};
    const items = {};
    const itempool_counts = {};
    const canonical_placements = {};
    let nextLocationId = LOCATION_ID_BASE;

    // Iterate regions in deterministic order so assigned location ids
    // don't jitter across runs.
    const orderedRegions = [...grid.allRegions()].sort((a, b) => {
        if (a.cell.gy !== b.cell.gy) return a.cell.gy - b.cell.gy;
        return a.cell.gx - b.cell.gx;
    });

    for (const region of orderedRegions) {
        const compiled = compileRegion(region.extracted_rules, { obstacleLib });

        const regionExits = compiled.exits.map((e) => ({
            name: e.id,
            connected_region: e.target_region,
            access_rule: e.rule,
        }));

        const regionLocations = compiled.locations.map((loc) => {
            // Disambiguate multiple same-id locations in a region (two
            // key_red_pickup entries at different positions would collide
            // otherwise) by appending position to the global name.
            const suffix = loc.position
                ? `__${loc.position.x}_${loc.position.y}`
                : '';
            const globalName = `${compiled.region_name}__${loc.id}${suffix}`;
            const numericId = nextLocationId++;
            if (loc.item) {
                // Register the item and tally the canonical placement.
                items[loc.item] = items[loc.item] ?? {
                    name: loc.item,
                    classification: itemLib[loc.item]?.classification ?? 'progression',
                };
                itempool_counts[loc.item] = (itempool_counts[loc.item] || 0) + 1;
                canonical_placements[globalName] = loc.item;
            }
            return {
                name: globalName,
                id: numericId,
                access_rule: loc.rule,
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

// --- Scenario pool ---
//
// Tracks remaining items and obstacles for the current scenario. Hands
// out placement plans to each region as it's built, and accepts back
// the region's actual placement to decrement counts.
//
// v1 heuristic: pick up to `maxItems` items uniformly at random from
// the unplaced pool. For each picked item, pair it with one matching
// obstacle from the pool if available (where "matching" means the
// obstacle has a single-item clear_set containing exactly that item).
// Unpaired obstacles are not offered. `arrivalInventory` is accepted
// by the plan call but not consulted in v1 — richer planners that use
// it are growth.

export class ScenarioPool {
    constructor({ items = {}, obstacles = {}, itemLib = {}, obstacleLib = {} } = {}) {
        this.items = { ...items };
        this.obstacles = { ...obstacles };
        this.itemLib = itemLib;
        this.obstacleLib = obstacleLib;
    }

    itemsRemaining() {
        return Object.values(this.items).reduce((a, b) => a + b, 0);
    }

    obstaclesRemaining() {
        return Object.values(this.obstacles).reduce((a, b) => a + b, 0);
    }

    totalRemaining() {
        return this.itemsRemaining() + this.obstaclesRemaining();
    }

    snapshot() {
        return {
            items: { ...this.items },
            obstacles: { ...this.obstacles },
        };
    }

    // Return which obstacle ids would be cleared by a lone `itemId`.
    // v1 matches only single-item clear_set combinations; multi-item
    // combos (e.g. needs key AND keycard) are deferred.
    _obstaclesClearedByItem(itemId) {
        const out = [];
        for (const [obsId, obs] of Object.entries(this.obstacleLib)) {
            for (const combo of obs.clear_set || []) {
                if (combo.length === 1 && combo[0] === itemId) {
                    out.push(obsId);
                    break;
                }
            }
        }
        return out;
    }

    planPlacement({ arrivalInventory: _arrivalInventory, rng, maxItems = 2 } = {}) {
        if (!rng || typeof rng.next !== 'function') {
            throw new Error('planPlacement: rng required');
        }

        // Flatten unplaced items into a multiset we can sample from.
        const pool = [];
        for (const [id, count] of Object.entries(this.items)) {
            for (let i = 0; i < count; i++) pool.push(id);
        }

        const picked_items = [];
        for (let i = 0; i < maxItems && pool.length > 0; i++) {
            const idx = Math.floor(rng.next() * pool.length);
            picked_items.push(pool.splice(idx, 1)[0]);
        }

        // Pair items with one matching obstacle each, where available.
        const obstacle_budget = { ...this.obstacles };
        const picked_obstacles = [];
        for (const item_id of picked_items) {
            for (const obstacle_id of this._obstaclesClearedByItem(item_id)) {
                if ((obstacle_budget[obstacle_id] || 0) > 0) {
                    picked_obstacles.push(obstacle_id);
                    obstacle_budget[obstacle_id] -= 1;
                    break;
                }
            }
        }

        return {
            items_to_place: picked_items,
            obstacles_to_place: picked_obstacles,
        };
    }

    markPlaced({ placed_items = [], placed_obstacles = [] } = {}) {
        for (const p of placed_items) {
            const id = p.item_id;
            if ((this.items[id] || 0) > 0) this.items[id] -= 1;
        }
        for (const p of placed_obstacles) {
            const id = p.obstacle_id;
            if ((this.obstacles[id] || 0) > 0) this.obstacles[id] -= 1;
        }
    }
}
