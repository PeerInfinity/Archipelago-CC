/**
 * procgenPipeline engine — headless grid-growth pipeline logic.
 * See NewDocs/plans/procedural-generation/grid-growth-pipeline.md.
 *
 * This file hosts the scenario pool, grid model, growth loop,
 * incremental re-stitcher, and full-world Boolean compile. Contents
 * grow per the v1 punch list in the plan doc.
 */

import { createRng } from '../shared/rng.js';
import {
    generateRegionCore, placeFromItems, extractPathsAndObstacles,
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
        const compiled = compileRegion(region.extracted_rules, { obstacleLib });

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
function serializeMazeWorld(world, extractedRules, baseObstacleLib = DEFAULT_OBSTACLES) {
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

    // Only include obstacleLib entries that aren't already in the
    // base library — standard colored doors live there; per-instance
    // logic_gate_<N> entries don't and must travel in the sidecar so
    // the compiler / runtime can look them up.
    const obstacleLibExtras = {};
    for (const [id, def] of Object.entries(world.obstacleLib || {})) {
        if (!(id in baseObstacleLib)) {
            obstacleLibExtras[id] = def;
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
    };
}

export function buildPresetSidecars(grid, { playerId = '1', baseObstacleLib = DEFAULT_OBSTACLES } = {}) {
    const regionMap = {};
    for (const region of grid.allRegions()) {
        regionMap[region.region_id] = {
            substrate: 'maze',
            render_hint: region.render_hint ?? 'maze',
            playable_payload: serializeMazeWorld(
                region.playable_payload,
                region.extracted_rules,
                baseObstacleLib,
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
        playerId, baseObstacleLib: obstacleLib,
    });

    return scaffold;
}
