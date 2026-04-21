/**
 * procgenPipeline engine — headless grid-growth pipeline logic.
 * See NewDocs/plans/procedural-generation/grid-growth-pipeline.md.
 *
 * This file hosts the scenario pool, grid model, growth loop,
 * incremental re-stitcher, and full-world Boolean compile. Contents
 * grow per the v1 punch list in the plan doc.
 */

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
