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
import { DEFAULT_ITEMS, DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import { compileRegion } from '../shared/procgen/pathsAndObstaclesCompiler.js';
import { ScenarioPool } from '../shared/procgen/scenarioPool.js';
import { makeRulesJsonScaffold } from '../shared/rulesJsonBuilder.js';
import { generateSphereLog } from '../shared/procgen/forwardSimulator.js';
import { generateLoopCosts } from '../shared/procgen/loopCostGenerator.js';
import { computeLongestShortestPath } from '../mazeRoom/mazeGeometry.js';
import {
    SIDE_N, SIDE_S, SIDE_E, SIDE_W, SIDES,
    OPPOSITE_SIDE, SIDE_DELTAS,
    mirrorTileAcrossSide,
} from '../shared/procgen/spatialPrimitives.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { generateHazards } from '../shared/procgen/contentModules/hazardPathGen.js';

function getAdapter(substrateId) {
    const adapter = substrateRegistry.get(substrateId);
    if (!adapter) {
        throw new Error(
            `procgenPipeline: no substrate registered for id '${substrateId}' — `
            + `import the substrate's library module before calling the driver`,
        );
    }
    return adapter;
}

// --- Substrate selection ---
//
// Per-region substrate id resolution. Used by both top-down and
// grid-growth drivers. Resolution order, highest priority first:
//
//   1. opts.substrateByRegion[regionName] — explicit caller override
//   2. Source region's `substrate` field (top-down only; grid-growth
//      synthesises regions and has no source tag to read)
//   3. opts.substratePicker(regionName, sourceRegion, ctx) — custom
//      callback. Replaces steps 4-5 if provided.
//   4. opts.substrateQuotas (+ opts.substrateCounts): weighted roll
//      against remaining per-substrate capacity. Caller is responsible
//      for incrementing counts after building each region. Returns
//      null when every quota is exhausted — callers in quota mode
//      should detect this and stop the loop.
//   5. Weighted roll against opts.substrateMix
//   6. Default 'maze'
//
// `sourceRegion` is the source rules.json region object for top-down
// callers, or null for grid-growth (no source rules.json exists).

export function pickSubstrate(regionName, sourceRegion, opts, rng) {
    const byRegion = opts?.substrateByRegion;
    if (byRegion && Object.prototype.hasOwnProperty.call(byRegion, regionName)) {
        return byRegion[regionName];
    }
    if (sourceRegion?.substrate) {
        return sourceRegion.substrate;
    }
    if (typeof opts?.substratePicker === 'function') {
        const picked = opts.substratePicker(regionName, sourceRegion, { rng });
        if (picked) return picked;
    }
    if (opts?.substrateQuotas) {
        const picked = pickSubstrateWithQuota(
            opts.substrateQuotas, opts.substrateCounts || {}, rng,
        );
        if (picked) return picked;
        // All quotas exhausted. Fall through to mix / default rather
        // than throw — growMaze checks remaining capacity before the
        // call so this branch is only reached in unusual setups
        // (e.g. caller passed empty quotas with no mix fallback).
    }
    if (opts?.substrateMix) {
        return rollSubstrateMix(opts.substrateMix, rng);
    }
    return 'maze';
}

/**
 * Weighted random pick. `mix` is `{ id: weight, ... }` with positive
 * numeric weights. The function normalises at pick time, so weights
 * don't need to sum to 1 — `{ maze: 1, text_adventure: 1 }` is a fair
 * 50/50, `{ maze: 3, text_adventure: 1 }` is 75/25. Deterministic
 * given a fixed rng + unchanged map iteration order.
 *
 * Empty mix or all-zero weights fall back to 'maze' (since this is
 * the substrate-selection path's hard default).
 */
export function rollSubstrateMix(mix, rng) {
    const entries = Object.entries(mix).filter(([, w]) => w > 0);
    if (entries.length === 0) return 'maze';
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = rng.next() * total;
    for (const [id, weight] of entries) {
        r -= weight;
        if (r <= 0) return id;
    }
    // Floating-point edge: r > 0 after walking all weights (rounding
    // accumulated across the subtractions). Last entry wins.
    return entries[entries.length - 1][0];
}

/**
 * Sum of remaining per-substrate capacity. 0 means every quota is
 * filled; positive means at least one substrate has room. Used by
 * growMaze to decide whether to keep growing in quota mode.
 */
export function totalRemainingQuota(quotas, counts) {
    if (!quotas) return 0;
    let sum = 0;
    for (const [id, quota] of Object.entries(quotas)) {
        const rem = quota - (counts?.[id] || 0);
        if (rem > 0) sum += rem;
    }
    return sum;
}

/**
 * Weighted random pick by remaining quota capacity. `quotas` is
 * `{ id: total, ... }` and `counts` is `{ id: placed_so_far, ... }`.
 * Each substrate's weight = max(0, quota - placed). Returns null
 * when nothing has capacity left — callers in quota mode should
 * treat that as the stop signal.
 */
export function pickSubstrateWithQuota(quotas, counts, rng) {
    const remaining = [];
    for (const [id, quota] of Object.entries(quotas)) {
        const rem = quota - (counts?.[id] || 0);
        if (rem > 0) remaining.push([id, rem]);
    }
    if (remaining.length === 0) return null;
    const total = remaining.reduce((s, [, r]) => s + r, 0);
    let r = rng.next() * total;
    for (const [id, rem] of remaining) {
        r -= rem;
        if (r <= 0) return id;
    }
    return remaining[remaining.length - 1][0];
}

// Re-export so existing callers (tests, UI) that imported ScenarioPool
// from this module keep working. New callers should import from
// shared/procgen/scenarioPool.js directly.
export { ScenarioPool };

// Re-export side constants so existing callers that imported them from
// here keep working. New callers should import from
// shared/procgen/spatialPrimitives.js directly.
export { SIDE_N, SIDE_S, SIDE_E, SIDE_W, SIDES, OPPOSITE_SIDE };

export function cellKey(cell) {
    return `${cell.gx},${cell.gy}`;
}

// --- Grid data model ---
//
// Cell-to-region storage for the grid-growth pipeline. Each cell
// holds a Region = the driver-composed output of a substrate (see
// buildSubstrateRegion below) augmented with its grid position.

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

// Top-down counterpart to stitchGrid. The top-down driver's Phase 2
// already wrote the source's connected_region onto each substrate
// exit's targetRegion (per exit, not per side), so we just need to:
// 1. drop exits whose target wasn't placed (skipped by Phase 1's
//    BFS due to grid-full → null target so wallOffUnusedExits can
//    drop them), and
// 2. set isTeleporter from cell adjacency between this region's cell
//    and the target region's cell.
// Mirror updates onto extracted_rules.exits so buildRulesJson sees
// the same view.
function finalizeTopDownExits(grid, cellsByName) {
    for (const region of grid.allRegions()) {
        const myCell = region.cell;
        const exits = region.playable_payload?.exits;
        const extracted = region.extracted_rules?.exits ?? [];
        const extractedById = new Map(extracted.map((e) => [e.id, e]));
        if (!exits) continue;
        for (const [exitId, worldExit] of exits) {
            const target = worldExit.targetRegion;
            const targetCell = target ? cellsByName.get(target) : null;
            if (target && !targetCell) {
                // Target was skipped by Phase 1; null it so it gets
                // walled off.
                worldExit.targetRegion = null;
                worldExit.isTeleporter = false;
                const ex = extractedById.get(exitId);
                if (ex) ex.target_region = null;
                continue;
            }
            if (targetCell && myCell) {
                worldExit.isTeleporter = !cellsAreAdjacent(myCell, targetCell);
            }
            const ex = extractedById.get(exitId);
            if (ex) ex.target_region = worldExit.targetRegion ?? null;
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

/**
 * Bidirectional-exit invariant pass. After stitchGrid wires every
 * forward exit to its geographic neighbor, two regions can end up
 * with an asymmetric pair: region A has an exit to region B but
 * region B has none back. This happens at cross-branch boundaries
 * — the BFS-tree back-exit code only ever adds back-exits pointing
 * at the parent, not at stitched-neighbor cells.
 *
 * `mode` decides how to reconcile:
 *   - 'add' (default): create a reciprocal back-exit on the target.
 *     The back-exit lands on the opposite side at the mirrored
 *     tile, matching the existing parent-child back-exit shape so
 *     the runtime and the rules compiler see the same structure.
 *   - 'remove': null the source exit's target_region. The next call
 *     to wallOffUnusedExits drops it from playable_payload,
 *     extracted_rules, and exits_placed.
 *
 * Must run after stitchGrid (so targetRegion fields are resolved)
 * and before wallOffUnusedExits (so 'remove' mode's nulled targets
 * get cleaned up in one place).
 */
export function reconcileBidirectionalExits(grid, regionSize, mode = 'add') {
    if (mode !== 'add' && mode !== 'remove') {
        throw new Error(`reconcileBidirectionalExits: unknown mode '${mode}'`);
    }
    const byName = new Map();
    for (const region of grid.allRegions()) {
        byName.set(region.region_id, region);
    }
    for (const sourceRegion of grid.allRegions()) {
        const exits = sourceRegion.playable_payload?.exits;
        if (!exits) continue;
        // Snapshot — addReciprocalBackExit mutates the target's
        // exits, not the source's, so iteration of `exits` is safe;
        // but snapshotting keeps the loop trivially correct as the
        // function evolves.
        for (const [sourceExitId, sourceExit] of [...exits]) {
            if (!sourceExit?.targetRegion) continue;
            const target = byName.get(sourceExit.targetRegion);
            if (!target) continue;
            const targetExits = target.playable_payload?.exits;
            if (!targetExits) continue;
            let hasReciprocal = false;
            for (const [, te] of targetExits) {
                if (te?.targetRegion === sourceRegion.region_id) {
                    hasReciprocal = true;
                    break;
                }
            }
            if (hasReciprocal) continue;
            if (mode === 'add') {
                addReciprocalBackExit(
                    sourceRegion, sourceExit, sourceExitId, target, regionSize,
                );
            } else {
                removeAsymmetricExit(sourceRegion, sourceExit, sourceExitId);
            }
        }
    }
}

function addReciprocalBackExit(sourceRegion, sourceExit, sourceExitId, targetRegion, regionSize) {
    const backSide = OPPOSITE_SIDE[sourceExit.side];
    if (!backSide) return;  // null/unknown side — can't mirror
    const backTile = mirrorTileAcrossSide(
        { x: sourceExit.x, y: sourceExit.y },
        sourceExit.side,
        regionSize,
    );
    const backExitId = sourceRegion.region_id;
    // Don't collide with an existing exit of the same id. Should be
    // rare — region ids are unique — but a defensive guard.
    if (targetRegion.playable_payload.exits.has(backExitId)) return;
    targetRegion.playable_payload.exits.set(backExitId, {
        exit_id: backExitId,
        x: backTile.x,
        y: backTile.y,
        side: backSide,
        exitName: backExitId,
        targetRegion: sourceRegion.region_id,
        targetExitId: sourceExitId,
        isBackExit: true,
        isTeleporter: !!sourceExit.isTeleporter,
    });
    if (Array.isArray(targetRegion.extracted_rules?.exits)) {
        targetRegion.extracted_rules.exits.push({
            id: backExitId,
            position: { x: backTile.x, y: backTile.y },
            target_region: sourceRegion.region_id,
            paths: [{ path_id: 'p1', obstacles: [] }],
        });
    }
    // Round-trip link so transitions can resolve the entrance tile.
    sourceExit.targetExitId = backExitId;
}

function removeAsymmetricExit(sourceRegion, sourceExit, sourceExitId) {
    sourceExit.targetRegion = null;
    const er = sourceRegion.extracted_rules?.exits?.find((e) => e.id === sourceExitId);
    if (er) er.target_region = null;
}

// --- Growth loop helpers ---

function regionIdForCell(cell) {
    return `region_${cell.gx}_${cell.gy}`;
}

// mirrorTileAcrossSide now lives in shared/procgen/spatialPrimitives.js;
// imported at the top of this file.

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
// Wraps the three substrate adapter calls (generateRegionCore +
// placeFromItems + extractPathsAndObstacles) into the region-object
// shape the grid-growth driver and its downstream consumers expect.
// Lives in the driver (not in any substrate) because the
// "start region → no obstacles" policy is a driver concern — the
// caller passes `obstacles_to_place: []` for start regions.
//
// Substrate dispatch goes through substrateRegistry; the substrate
// id defaults to 'maze' when the caller doesn't specify one. Step 4
// will add per-region substrate selection to the callers above.

function buildSubstrateRegion({
    substrate = 'maze',
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
    biome = null,
    hazardOpts = null,
}) {
    const adapter = getAdapter(substrate);
    if (typeof adapter.generateRegionCore !== 'function') {
        throw new Error(
            `Substrate '${substrate}' has no generateRegionCore — it is a `
            + 'zone-based substrate (e.g. JtA) and cannot be used with the '
            + 'grid-growth driver. Use the shuffled-spiral layout instead, '
            + 'or remove this substrate from the quotas / mix.',
        );
    }
    const core = adapter.generateRegionCore({
        region_id,
        size,
        entrances,
        exits: exit_sides.map((side) => ({ side })),
        item_lib: itemLib,
        obstacle_lib: obstacleLib,
        rng,
        params,
        biome,
    });
    const placement = adapter.placeFromItems(core.world, {
        items_to_place,
        obstacles_to_place,
        arrival_inventory,
        rng,
        params,
    });
    const extracted_rules = adapter.extractPathsAndObstacles(core.world, { regionId: region_id });
    // Content module pass: stamp hazards onto the world after the
    // base maze + obstacle layout is done. No-op when no hazards are
    // requested or when the substrate isn't 'maze'.
    if (substrate === 'maze') applyHazardModule(core.world, hazardOpts, rng);
    return {
        substrate,
        region_id,
        playable_payload: core.world,
        extracted_rules,
        placed_items: placement.placed_items,
        placed_obstacles: placement.placed_obstacles,
        exits_placed: core.exits_placed,
        render_hint: substrate,
        sidecar_filename: `${region_id}.json`,
        wall_stats: core.wall_stats,
        biome: core.biome ?? null,
        grow_telemetry: core.grow_telemetry ?? null,
    };
}

/**
 * Run the hazard content module's `generate` pass on a freshly-built
 * world. Mutates world.hazards in place when hazards land; no-op
 * otherwise. Gated on hazardOpts.enabled to keep existing presets
 * cost-free unless the caller opts in.
 *
 * @param {object} world - target world (must have width/height/tiles)
 * @param {object|null} hazardOpts
 * @param {boolean} hazardOpts.enabled
 * @param {number} [hazardOpts.count] - target hazard count per region (0)
 * @param {number} [hazardOpts.maxConsecutiveFails]
 * @param {boolean} [hazardOpts.wallOverlapAllowed]
 * @param {{next:()=>number}} rng
 */
function applyHazardModule(world, hazardOpts, rng) {
    if (!hazardOpts || !hazardOpts.enabled) return;
    const count = Math.max(0, Math.floor(hazardOpts.count ?? 0));
    if (count === 0) return;
    // Keep hazards off entrance / exit / location tiles. Hazards
    // don't statically block tiles (the player walks through them
    // when the cycle phase allows), but a hazard whose path
    // includes one of these "anchor" tiles would obscure them
    // visually and create UX confusion — entrance is where the
    // player spawns, exits route between regions, and locations
    // hold the item sprite.
    const reservedTiles = new Set();
    if (world.entrance) {
        reservedTiles.add(`${world.entrance.x},${world.entrance.y}`);
    }
    if (world.exits) {
        for (const exit of world.exits.values()) {
            if (typeof exit?.x === 'number' && typeof exit?.y === 'number') {
                reservedTiles.add(`${exit.x},${exit.y}`);
            }
        }
    }
    // world.items is a Map<posKey, itemId>; each entry is a
    // location tile. Reserve them all so hazards stay clear of
    // pickups.
    if (world.items) {
        for (const key of world.items.keys()) {
            reservedTiles.add(key);
        }
    }
    const result = generateHazards(world, {
        count,
        maxConsecutiveFails: hazardOpts.maxConsecutiveFails ?? 10,
        wallOverlapAllowed: !!hazardOpts.wallOverlapAllowed,
        initialReservedTiles: reservedTiles,
    }, rng);
    if (result.hazards.length > 0) {
        world.hazards = result.hazards.map((h) => ({ ...h, phase: 0 }));
    }
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
        // Content-module options. Passed through to buildSubstrateRegion
        // — null disables. See applyHazardModule for the option shape.
        hazardOpts = null,
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
        // Substrate selection. Source-tag branch is a no-op here
        // (grid-growth synthesises regions with no source); the
        // remaining resolution branches (byRegion / picker / quotas
        // / mix / 'maze' default) all apply.
        substrateByRegion,
        substrateMix,
        substrateQuotas,
        substratePicker,
        // Quota mode only: optional fixed substrate for the start
        // region. When null/'auto', the start substrate is chosen
        // via pickSubstrate (weighted by remaining quota or by mix).
        // The start region's substrate counts against its quota.
        startSubstrate = null,
        // Quota mode only: when true, an empty item pool ends growth
        // early. When false (default), growth continues and later
        // regions are built with empty item plans.
        stopOnPoolEmpty = false,
        // How the bidirectional post-pass reconciles asymmetric exit
        // pairs left by cross-branch stitching:
        //   - 'add' (default): create a reciprocal back-exit on the
        //     target region so the player can walk back.
        //   - 'remove': drop the one-way forward exit instead.
        // No-op when assumeBidirectional is false.
        asymmetricExits = 'add',
    } = growthParams;

    // Per-substrate running counter for quota mode. Mutated as each
    // region is built; passed to pickSubstrate so the weighted roll
    // sees up-to-date remaining capacity.
    const substrateCounts = {};

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
        // Live reference — mutated as regions are built. Callers in
        // quota mode use this for the per-substrate breakdown.
        substrateCounts,
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
    const startRegionId = regionIdForCell(startCell);
    // Resolve start substrate. In quota mode, honor an explicit
    // startSubstrate when it has capacity; otherwise fall through to
    // pickSubstrate (which itself uses the quota / mix / default
    // chain). Either way, the start substrate counts against its
    // quota — incremented just below.
    let startSub;
    if (startSubstrate && startSubstrate !== 'auto'
            && (!substrateQuotas
                || ((substrateQuotas[startSubstrate] ?? 0)
                    - (substrateCounts[startSubstrate] || 0)) > 0)) {
        startSub = startSubstrate;
    } else {
        startSub = pickSubstrate(startRegionId, null, {
            substrateByRegion, substrateMix, substrateQuotas,
            substrateCounts, substratePicker,
        }, rng);
    }
    substrateCounts[startSub] = (substrateCounts[startSub] || 0) + 1;
    const startRegion = buildSubstrateRegion({
        substrate: startSub,
        region_id: startRegionId,
        size: regionSize,
        entrances: [],                     // start region — substrate picks middle
        exit_sides: startExitSides,
        arrival_inventory: new Set(),
        items_to_place: [],
        obstacles_to_place: [],            // start region — no obstacles
        itemLib, obstacleLib, rng, params: regionParams,
        hazardOpts,
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
        if (stopOnPoolEmpty && pool.itemsRemaining() === 0) {
            stats.stopReason = 'pool_empty';
            break;
        }
        if (maxRegions != null && stats.regionsBuilt >= maxRegions) {
            stats.stopReason = 'max_regions';
            break;
        }
        if (substrateQuotas
                && totalRemainingQuota(substrateQuotas, substrateCounts) === 0) {
            stats.stopReason = 'quotas_filled';
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

        const childRegionId = regionIdForCell(childCell);
        const childSub = pickSubstrate(childRegionId, null, {
            substrateByRegion, substrateMix, substrateQuotas,
            substrateCounts, substratePicker,
        }, rng);
        substrateCounts[childSub] = (substrateCounts[childSub] || 0) + 1;
        const region = buildSubstrateRegion({
            substrate: childSub,
            region_id: childRegionId,
            size: regionSize,
            entrances: [{ side: entranceSide, tile: entranceTile }],
            exit_sides: exitSides,
            arrival_inventory: arrival,
            items_to_place: plan.items_to_place,
            obstacles_to_place: plan.obstacles_to_place,
            itemLib, obstacleLib, rng, params: regionParams,
            hazardOpts,
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

    // Cross-branch stitching can leave one-way exits. When the user
    // wants bidirectional traversal, reconcile asymmetric pairs
    // before walling off unused exits — 'remove' mode nulls the
    // target_region, and wallOff then drops it.
    if (assumeBidirectional) {
        reconcileBidirectionalExits(grid, regionSize, asymmetricExits);
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
 *
 * Top-down regions skip mazegen walling by default (see
 * topDownFromRulesJson's regionParams default), so total area is
 * usable as floor area. The slack term covers walking room + the
 * substrate's collision-avoidance during clockwise wall assignment.
 */
function topDownRegionSize(base, exitCount, locationCount) {
    let width = base.width;
    let height = base.height;
    // Corners are excluded from the usable perimeter (see
    // clockwisePerimeterTiles): a 6x6 has 16 non-corner border tiles,
    // not 20. Slack = 2 covers retries for the substrate's collision-
    // avoidance during clockwise wall assignment.
    const perimeter = (w, h) => 2 * (w - 2) + 2 * (h - 2);
    const perimNeeded = exitCount + 1 + 2;
    while (perimeter(width, height) < perimNeeded) {
        width += 2;
        height += 2;
    }
    const slack = 4;
    const tilesNeeded = locationCount + exitCount + 1 + slack;
    while (width * height < tilesNeeded) {
        if (width <= height) width += 1; else height += 1;
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

/**
 * Count source-side regions, locations, exits, and non-trivial logic
 * gates for a top-down rules.json input. Excludes the synthetic Menu
 * region (the driver strips it; buildRulesJson re-emits it on the
 * output side, so it's not a meaningful "source" entity for
 * preservation accounting).
 *
 * "logic_gates" counts exits + locations whose access_rule is
 * something other than absent or `{rule: 'True_'}` — i.e. any
 * non-trivial AP access rule that has to be encoded as an in-world
 * gate by the driver.
 *
 * Used to populate procgen_metadata.source_counts on the output
 * rules.json. See NewDocs/plans/presets-panel-overhaul.md §"Source
 * preservation".
 */
export function computeSourceCounts(rulesJson, playerId = '1') {
    const sourceRegions = rulesJson?.regions?.[playerId] ?? {};
    const startField = rulesJson?.start_regions?.[playerId];
    let declaredStart = null;
    if (Array.isArray(startField?.default)) declaredStart = startField.default[0];
    else if (Array.isArray(startField)) declaredStart = startField[0];
    const resolved = resolveTopDownStart(sourceRegions, declaredStart);
    const menuName = resolved?.menuName ?? null;

    let regionCount = 0;
    let locationCount = 0;
    let exitCount = 0;
    let logicGateCount = 0;
    const isNonTrivial = (rule) =>
        rule != null && !(typeof rule === 'object' && rule.rule === 'True_');

    for (const [name, region] of Object.entries(sourceRegions)) {
        if (menuName && name === menuName) continue;
        regionCount += 1;
        for (const exit of region?.exits ?? []) {
            exitCount += 1;
            if (isNonTrivial(exit?.access_rule)) logicGateCount += 1;
        }
        for (const loc of region?.locations ?? []) {
            locationCount += 1;
            if (isNonTrivial(loc?.access_rule)) logicGateCount += 1;
        }
    }
    return {
        regions: regionCount,
        locations: locationCount,
        exits: exitCount,
        logic_gates: logicGateCount,
    };
}

export function topDownFromRulesJson(rulesJson, opts = {}) {
    const {
        playerId = '1',
        gridDims = { width: 12, height: 12 },
        regionSizeBase = { width: 6, height: 6 },
        seed = 1,
        itemLib = DEFAULT_ITEMS,
        obstacleLib = DEFAULT_OBSTACLES,
        // maxIterations: 0 disables wall-add iterations in mazegen.
        // Top-down regions exist to host the source's logic gates, not
        // to be walking puzzles — leaving them as open rooms maximises
        // floor space for locations + exits + entrance, which is what
        // a dense source region (e.g. Adventure's Overworld with 11
        // locations) needs to round-trip cleanly. Callers can override
        // by passing their own regionParams.
        regionParams = { maxIterations: 0 },
        teleporterMinGap = 2,
        // Honor the source's flag, default true. When set, every
        // BFS-tree-edge gets a back-exit on the child for round-
        // tripping back through the entrance.
        assumeBidirectional = rulesJson?.assume_bidirectional_exits !== false,
        // Substrate selection. See pickSubstrate above for resolution
        // order. v1 default: every region uses the maze substrate.
        substrateByRegion,
        substrateMix,
        substratePicker,
        // Per-region biome override. Shape: { [region_name]: { id,
        // paramsOverride? } }. Falls through to source-region's biome
        // (if rules.json carries one), otherwise to the substrate
        // default. v1 callers don't pass this; future commits will.
        biomeByRegion,
        // Content-module options (maze content modules Phase 2e).
        // Same shape as growMaze's hazardOpts; see applyHazardModule.
        // null disables.
        hazardOpts = null,
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
        // Menu is stripped from the source-region BFS (we don't
        // realize it; buildRulesJson re-emits it on emit), so the
        // total to compare against regionsBuilt also excludes it.
        regionsTotal: Object.keys(sourceRegions).length - (menuName ? 1 : 0),
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
    // Pick one uniform region size that fits every region's exit and
    // location budget (per-axis max of each region's individual sizing).
    // Equal-sized regions make entrance/exit tile coordinates line up
    // across shared walls without coord wrapping, and keep the visual
    // grid consistent — the alternative (per-region auto-grow) produced
    // mismatched walls where a wide parent's exit had no in-bounds
    // counterpart on a smaller child. A future pass could let one source
    // region span multiple Grid cells; for now everyone is one cell.
    let uniformSize = { width: regionSizeBase.width, height: regionSizeBase.height };
    for (const { name } of placementOrder) {
        const r = sourceRegions[name];
        if (!r) continue;
        const s = topDownRegionSize(
            regionSizeBase,
            (r.exits ?? []).length,
            (r.locations ?? []).length,
        );
        if (s.width > uniformSize.width) uniformSize.width = s.width;
        if (s.height > uniformSize.height) uniformSize.height = s.height;
    }

    // exitSidesByExit lets a child resolve its entrance tile from its
    // parent's exit position — populated as we go through phase 2 in
    // BFS-placement order, so parents always realise before children.
    const exitSidesByExit = new Map(); // "name:exit_id" -> {side, tile_position}

    for (const { name, cell, parent } of placementOrder) {
        const sourceRegion = sourceRegions[name];
        if (!sourceRegion) continue;
        const size = uniformSize;

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
        // The exit pointing back to the BFS parent gets pinned to
        // the entrance tile so the two regions' exit tiles line up
        // across the shared wall.
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
            const isParentReverse = parent && targetName === parent.name && entrances.length > 0;
            const tile = isParentReverse ? entrances[0].tile : null;
            const resolvedSide = isParentReverse ? entrances[0].side : side;
            return {
                exit_id: srcExit.name,
                exitName: srcExit.name,
                targetRegion: targetName ?? null,
                ...(resolvedSide ? { side: resolvedSide } : {}),
                ...(tile ? { tile } : {}),
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

        // Substrate dispatch: per-region resolution via pickSubstrate
        // (caller override > source tag > picker > mix > 'maze').
        const substrateId = pickSubstrate(name, sourceRegion, {
            substrateByRegion, substrateMix, substratePicker,
        }, rng);
        const adapter = getAdapter(substrateId);
        // Biome resolution mirrors substrate dispatch: per-region from
        // input wins, otherwise inherit from rules.json source region
        // (which the top-down driver may stamp), otherwise null →
        // substrate default. v1 callers don't supply biome; that's a
        // future commit.
        const regionBiome = biomeByRegion?.[name] ?? sourceRegion?.biome ?? null;
        const core = adapter.generateRegionCore({
            region_id: name,
            size,
            entrances,
            exits: exitSpecs,
            item_lib: itemLib,
            obstacle_lib: obstacleLib,
            rng,
            params: regionParams,
            biome: regionBiome,
        });
        const placement = adapter.placeFromRules(core.world, {
            exit_rules,
            location_rules,
            item_placements,
            rng,
        });
        const extracted_rules = adapter.extractPathsAndObstacles(core.world, { regionId: name });

        // Top-down knows the source's location IDs and access rules
        // directly. Override the BFS-derived names+rules from
        // extractPathsAndObstacles with the source data — names so
        // round-tripped locations match the source (e.g. "Slay Yorgle"
        // not "Freeincarnate_pickup"), rules so cut-vertex pollution
        // (a gate placed for one location showing up on another's BFS
        // path) doesn't conflate access rules across locations.
        const locationIdByPos = new Map();
        for (const placed of placement.placed_locations ?? []) {
            const k = `${placed.position.x},${placed.position.y}`;
            locationIdByPos.set(k, placed.location_id);
        }
        for (const loc of extracted_rules.locations) {
            const k = `${loc.position.x},${loc.position.y}`;
            const sourceLocId = locationIdByPos.get(k);
            if (sourceLocId) {
                loc.id = sourceLocId;
                // AP-canonical location names are unique within a
                // player's rules.json, so use the source name verbatim
                // as the round-tripped location's global name. Skips
                // the Region__locId__x_y mangling makeLocationName
                // applies to grid-growth's auto-derived ids.
                loc.global_name = sourceLocId;
                if (location_rules[sourceLocId]) {
                    loc.access_rule = location_rules[sourceLocId];
                }
            }
        }
        for (const ex of extracted_rules.exits) {
            if (exit_rules[ex.id]) ex.access_rule = exit_rules[ex.id];
        }

        for (const placed of core.exits_placed) {
            exitSidesByExit.set(`${name}:${placed.exit_id}`, {
                side: placed.side,
                tile_position: placed.tile_position,
            });
        }

        // Content-module pass: place hazards on the freshly-built
        // world. No-op when hazardOpts is null/disabled or substrate
        // isn't 'maze'.
        if (substrateId === 'maze') applyHazardModule(core.world, hazardOpts, rng);

        // Mutate the stub in place — Grid doesn't have a replaceRegion
        // method and placeRegion would throw on the second call.
        const stub = grid.getRegion(cell);
        Object.assign(stub, {
            substrate: substrateId,
            playable_payload: core.world,
            extracted_rules,
            placed_items: placement.placed_items,
            placed_obstacles: [],
            placed_logic_gates: placement.placed_logic_gates,
            exits_placed: core.exits_placed,
            render_hint: substrateId,
            sidecar_filename: `${name}.json`,
            biome: core.biome ?? null,
            grow_telemetry: core.grow_telemetry ?? null,
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

    // ----- Phase 4: finalize + clean up -----
    // grid-growth's stitchGrid resolves target_region from grid
    // adjacency (one exit per cell per side). Top-down has many exits
    // per side with distinct sources-of-truth targets, so adjacency-
    // based resolution would collapse them onto whatever single region
    // sits on that neighbor cell. Use a per-exit finalizer instead:
    // the source's connected_region already rode through Phase 2 onto
    // the substrate's exit objects; here we just confirm the target
    // got placed, set isTeleporter from cell adjacency, and null out
    // dangling exits so wallOffUnusedExits can drop them.
    finalizeTopDownExits(grid, cellsByName);
    wallOffUnusedExits(grid);

    // ----- Phase 5: per-exit entrance resolution -----
    // Each exit A.X with target B should know its counterpart B.Y
    // (where Y.target = A) so the maze panel can spawn the player on
    // Y's tile when crossing A.X. Without this link, all arrivals
    // fall back to world.entrance — which is the BFS-parent-mirrored
    // tile, not the matching reverse exit. Bidirectional source
    // rules.json (Adventure et al.) always supplies these reverses;
    // the §2 synthetic back-exit phase above only fires when the
    // source DOESN'T declare one, and that path already linked
    // targetExitId itself.
    linkReverseExits(grid);
    // For non-start regions, align world.entrance with the BFS-
    // parent's matching reverse-exit tile so the rendered green
    // border doesn't sit on a meaningless leftover tile (the §1
    // mirror-from-parent's-exit-position landing). The substrate's
    // BFS already finished placement, so changing world.entrance now
    // is just bookkeeping for the renderer + initial-spawn fallback.
    for (const { name, cell, parent } of placementOrder) {
        if (!parent) continue;
        const region = grid.getRegion(cell);
        const exits = region?.playable_payload?.exits;
        if (!exits) continue;
        for (const e of exits.values()) {
            if (e.targetRegion === parent.name) {
                region.playable_payload.entrance = { x: e.x, y: e.y };
                break;
            }
        }
    }

    if (!stats.stopReason) {
        stats.stopReason = stats.regionsBuilt === stats.regionsTotal
            ? 'all_placed'
            : 'partial_layout';
    }

    return { grid, startCell, stats };
}

// Walk every exit in every region and set targetExitId to the
// matching reverse exit (the exit in the destination region that
// points back to this one). Idempotent: skips exits that already
// have targetExitId set (e.g. synthetic back-exits added by the
// bidirectional phase). When a destination has multiple exits back
// to this region (rare; AP source rules.json normally pairs them
// 1:1), the first match wins.
function linkReverseExits(grid) {
    const regionByName = new Map();
    for (const r of grid.allRegions()) regionByName.set(r.region_id, r);
    for (const region of grid.allRegions()) {
        const exits = region.playable_payload?.exits;
        if (!exits) continue;
        for (const exit of exits.values()) {
            if (exit.targetExitId) continue;
            if (!exit.targetRegion) continue;
            const target = regionByName.get(exit.targetRegion);
            const targetExits = target?.playable_payload?.exits;
            if (!targetExits) continue;
            for (const reverse of targetExits.values()) {
                if (reverse.targetRegion === region.region_id) {
                    exit.targetExitId = reverse.exit_id;
                    break;
                }
            }
        }
    }
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
            const globalName = loc.global_name
                ?? makeLocationName(compiled.region_name, loc.id, loc.position);
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
export function serializeMazeWorld(world, extractedRules, baseObstacleLib = DEFAULT_OBSTACLES, baseItemLib = DEFAULT_ITEMS) {
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
        const name = loc.global_name
            ?? makeLocationName(extractedRules.region_id, loc.id, loc.position);
        locationNameByPos.set(key, name);
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
    // Geometric property used by loop-mode mana hooks: the longest of
    // the pairwise shortest paths among (entrance, ...exits). Combined
    // with baseRegionCost from loop_costs at runtime to derive a
    // per-tile move cost: moveCost = baseRegionCost / longestShortestPath.
    // Always computed (cheap BFS over the tile grid); the runtime
    // ignores it when manaEnabled is off.
    const longestShortestPath = computeLongestShortestPath(world);

    // Hazards (Phase 2). Each entry is the IMMUTABLE shape — the
    // runtime initializes phase to 0 in deserializeMazeWorld. Stored
    // entries strip phase + any other mutable runtime state per the
    // strip-progress-on-save convention.
    const hazardsOut = Array.isArray(world.hazards) && world.hazards.length > 0
        ? world.hazards.map((h) => ({
            shape: h.shape,
            length: h.length,
            tiles: h.tiles.map((t) => ({ x: t.x, y: t.y })),
            cycleLength: h.cycleLength,
        }))
        : null;

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
        longestShortestPath,
        ...(hazardsOut ? { hazards: hazardsOut } : {}),
    };
}

// --- Shuffled-spiral layout driver ---
//
// Alternative to growMaze. Auto-sizes a grid that fits sum(quotas)
// regions, places one region per cell in a clockwise square spiral
// starting east of the center, and wires every cell to its
// in-bounds neighbors with always-accessible exits. Substrates are
// shuffled across the spiral sequence (substrate quotas determine
// multiplicity); within each substrate, regions are emitted in
// substrate-native order so a zone-based substrate like JtA sees
// zone 0, 1, 2, ... in spiral order regardless of where its slots
// land in the shuffle.
//
// v1 scope:
//   - 4-way always-accessible exits per cell
//   - no items / obstacles for zone-based substrates (procedural
//     substrates still draw from the pool via buildSubstrateRegion)
//   - clockwise spiral, east first step (not configurable yet)
//   - no difficulty progression for procedural substrates

/**
 * Generator: yields cells in a clockwise square spiral starting at
 * `start` and stepping `firstStep` first. Coords can go negative;
 * call sites that need a finite slice should offset by min(gx)/min(gy).
 *
 * Step counts follow the classic outward-spiral pattern 1,1,2,2,3,3,
 * ... — one leg in the current direction, then a 90° CW turn, repeat.
 */
export function* spiralCells(start = { gx: 0, gy: 0 }, firstStep = 'E') {
    const DIRS = { E: [1, 0], S: [0, 1], W: [-1, 0], N: [0, -1] };
    const TURN_CW = { E: 'S', S: 'W', W: 'N', N: 'E' };
    if (!DIRS[firstStep]) {
        throw new Error(`spiralCells: invalid firstStep '${firstStep}'`);
    }
    let cell = { gx: start.gx, gy: start.gy };
    yield cell;
    let dir = firstStep;
    let stepCount = 1;
    while (true) {
        for (let leg = 0; leg < 2; leg++) {
            const [dx, dy] = DIRS[dir];
            for (let i = 0; i < stepCount; i++) {
                cell = { gx: cell.gx + dx, gy: cell.gy + dy };
                yield cell;
            }
            dir = TURN_CW[dir];
        }
        stepCount++;
    }
}

/**
 * Build the ordered substrate sequence for a shuffled-spiral run.
 * For quotas {A:3, B:2}, returns a 5-element array containing 3 'A'
 * and 2 'B' entries in a shuffled order. When `startSubstrate` is
 * provided (and has remaining quota), it's pinned to position 0;
 * the remainder is shuffled.
 */
export function buildShuffledSubstrateSequence(quotas, startSubstrate, rng) {
    const slots = [];
    for (const [id, count] of Object.entries(quotas)) {
        for (let i = 0; i < count; i++) slots.push(id);
    }
    // Pull one startSubstrate slot off first if requested.
    let head = null;
    if (startSubstrate && startSubstrate !== 'auto') {
        const idx = slots.indexOf(startSubstrate);
        if (idx < 0) {
            throw new Error(
                `arrangeShuffledSpiral: startSubstrate '${startSubstrate}' `
                + `has no quota`,
            );
        }
        head = slots.splice(idx, 1)[0];
    }
    // Fisher–Yates shuffle on the remainder.
    for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    return head !== null ? [head, ...slots] : slots;
}

// Perimeter midpoint for a synthetic exit on the given side. Used
// only for zone-based substrates where tile geometry is fictional
// but the procgen pipeline still wants a tile_position. The values
// satisfy stitchGrid's posKey lookup and procgenPlayer's entrance
// tracking; the substrate runtime ignores them.
function perimeterMidpoint(side, size) {
    const w = size.width, h = size.height;
    if (side === 'N') return { x: Math.floor(w / 2), y: 0 };
    if (side === 'S') return { x: Math.floor(w / 2), y: h - 1 };
    if (side === 'W') return { x: 0, y: Math.floor(h / 2) };
    if (side === 'E') return { x: w - 1, y: Math.floor(h / 2) };
    throw new Error(`perimeterMidpoint: invalid side '${side}'`);
}

/**
 * Build a region for a zone-based substrate (one with no
 * generateRegionCore — currently just JtA). The result shape mirrors
 * what buildSubstrateRegion returns so downstream code (stitchGrid,
 * wallOff, buildPresetSidecars, buildRulesJson) can consume it
 * uniformly.
 */
function synthesizeZoneRegion({
    substrate, region_id, zoneIdx, regionSize, exitSides, adapter,
}) {
    const exitsMap = new Map();
    const exitsPlaced = [];
    const extractedExits = [];
    // One synthetic exit per in-bounds neighbor side. id format
    // 'exit_<side>' is unique per region and survives serialization.
    for (const side of exitSides) {
        const exit_id = `exit_${side}`;
        const tile = perimeterMidpoint(side, regionSize);
        exitsMap.set(exit_id, {
            exit_id,
            x: tile.x,
            y: tile.y,
            side,
            exitName: exit_id,
            targetRegion: null,   // resolved by stitchGrid
            isBackExit: false,
            isTeleporter: false,
        });
        exitsPlaced.push({ exit_id, side, tile_position: { x: tile.x, y: tile.y } });
        extractedExits.push({
            id: exit_id,
            position: { x: tile.x, y: tile.y },
            target_region: null,
            paths: [{ path_id: 'p1', obstacles: [] }],
        });
    }
    const zonePayload = adapter.synthesizeZonePayload
        ? adapter.synthesizeZonePayload(zoneIdx)
        : {};
    return {
        substrate,
        region_id,
        playable_payload: { ...zonePayload, exits: exitsMap },
        extracted_rules: { exits: extractedExits, locations: [] },
        placed_items: [],
        placed_obstacles: [],
        exits_placed: exitsPlaced,
        render_hint: substrate,
        sidecar_filename: `${region_id}.json`,
        wall_stats: null,
        biome: null,
        grow_telemetry: null,
    };
}

export function arrangeShuffledSpiral(config) {
    const {
        regionSize,
        itemPool = {},
        obstaclePool = {},
        itemLib = DEFAULT_ITEMS,
        obstacleLib = DEFAULT_OBSTACLES,
        seed = 1,
        regionParams = {},
        growthParams = {},
        hazardOpts = null,
    } = config;
    if (!regionSize || !regionSize.width || !regionSize.height) {
        throw new Error('arrangeShuffledSpiral: regionSize.{width,height} required');
    }
    const {
        substrateQuotas,
        startSubstrate = null,
        maxItemsPerRegion = 2,
        assumeBidirectional = true,
    } = growthParams;
    if (!substrateQuotas || Object.keys(substrateQuotas).length === 0) {
        throw new Error('arrangeShuffledSpiral: growthParams.substrateQuotas required');
    }
    // Upfront validation: every substrate must be registered with
    // either a build-time generateRegionCore (procedural) or a
    // zoneCount (zone-based). Zone-based substrates' quotas must
    // also fit within their zoneCount.
    for (const [sub, count] of Object.entries(substrateQuotas)) {
        if (count <= 0) continue;
        const adapter = substrateRegistry.get(sub);
        if (!adapter) {
            throw new Error(
                `arrangeShuffledSpiral: substrate '${sub}' is not registered`,
            );
        }
        const hasZones = typeof adapter.zoneCount === 'number';
        const hasGen = typeof adapter.generateRegionCore === 'function';
        if (!hasZones && !hasGen) {
            throw new Error(
                `arrangeShuffledSpiral: substrate '${sub}' has neither `
                + 'zoneCount nor generateRegionCore. Its registry entry '
                + 'may be stale — hard-refresh the page (Ctrl+Shift+R) and '
                + 'try again.',
            );
        }
        if (hasZones && count > adapter.zoneCount) {
            throw new Error(
                `arrangeShuffledSpiral: quota for '${sub}' (${count}) `
                + `exceeds substrate zoneCount (${adapter.zoneCount})`,
            );
        }
    }

    const rng = createRng(seed);
    const sequence = buildShuffledSubstrateSequence(
        substrateQuotas, startSubstrate, rng,
    );
    if (sequence.length === 0) {
        throw new Error('arrangeShuffledSpiral: substrateQuotas sum to zero');
    }

    // Auto-size grid: take the first N spiral cells, then offset so
    // every coord is non-negative.
    const rawCells = [];
    const gen = spiralCells({ gx: 0, gy: 0 }, 'E');
    for (let i = 0; i < sequence.length; i++) rawCells.push(gen.next().value);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of rawCells) {
        if (c.gx < minX) minX = c.gx;
        if (c.gx > maxX) maxX = c.gx;
        if (c.gy < minY) minY = c.gy;
        if (c.gy > maxY) maxY = c.gy;
    }
    const gridDims = { width: maxX - minX + 1, height: maxY - minY + 1 };
    const cells = rawCells.map((c) => ({ gx: c.gx - minX, gy: c.gy - minY }));
    const startCell = cells[0];

    const grid = new Grid(gridDims);
    const pool = new ScenarioPool({
        items: itemPool, obstacles: obstaclePool, itemLib, obstacleLib,
    });
    const zoneCounter = {};  // per-substrate "Nth zone" counter
    const occupied = new Set(cells.map((c) => cellKey(c)));

    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        const substrate = sequence[i];
        const adapter = getAdapter(substrate);
        const zoneIdx = zoneCounter[substrate] ?? 0;
        zoneCounter[substrate] = zoneIdx + 1;

        // Sides whose geographic neighbor is in-bounds AND will hold
        // a spiral region (occupied set is the universe of cells).
        const exitSides = [];
        for (const side of SIDES) {
            const neighbor = grid.neighborCell(cell, side);
            if (!neighbor) continue;
            if (occupied.has(cellKey(neighbor))) exitSides.push(side);
        }

        let region;
        if (typeof adapter.zoneCount === 'number') {
            region = synthesizeZoneRegion({
                substrate,
                region_id: regionIdForCell(cell),
                zoneIdx,
                regionSize,
                exitSides,
                adapter,
            });
        } else {
            const arrival = accumulatedInventory(grid);
            const plan = pool.planPlacement({
                arrivalInventory: arrival, rng, maxItems: maxItemsPerRegion,
            });
            region = buildSubstrateRegion({
                substrate,
                region_id: regionIdForCell(cell),
                size: regionSize,
                entrances: [],
                exit_sides: exitSides,
                arrival_inventory: arrival,
                items_to_place: plan.items_to_place,
                obstacles_to_place: plan.obstacles_to_place,
                itemLib, obstacleLib, rng, params: regionParams,
                hazardOpts,
            });
            pool.markPlaced({
                placed_items: region.placed_items,
                placed_obstacles: region.placed_obstacles,
            });
        }
        grid.placeRegion(cell, region);
    }

    // Resolve exit targets to neighbor region ids. Same pass the
    // grid-growth driver uses; for zone-based regions our synthetic
    // tile positions match the perimeter-midpoint convention so the
    // posKey lookup inside stitchGrid hits.
    stitchGrid(grid);
    if (assumeBidirectional) {
        reconcileBidirectionalExits(grid, regionSize, 'add');
    }
    wallOffUnusedExits(grid);

    const stats = {
        regionsBuilt: cells.length,
        regionsSkipped: 0,
        teleportersPlaced: 0,
        stopReason: 'spiral_complete',
        substrateCounts: { ...zoneCounter },
    };
    return { grid, pool, stats, startCell };
}

export function buildPresetSidecars(grid, {
    playerId = '1',
    baseObstacleLib = DEFAULT_OBSTACLES,
    baseItemLib = DEFAULT_ITEMS,
    // Loop-mode opt-in. When true, every region's playable_payload gets
    // `manaEnabled: true`, activating the substrate's mana hooks at
    // runtime. Default false — existing presets stay cost-free unless
    // the caller explicitly enables loop mode. Future: per-region map.
    manaEnabled = false,
    // Fog-of-war flag. Substrate consumers default to fog ON when the
    // field is absent; explicit `fogEnabled: false` is the legacy
    // "reveal everything on entry" opt-out. Maze substrate hides
    // un-stepped tiles + fires per-tile discovery; text-adventure
    // substrate skips its on-entry "discover everything in region"
    // shortcut and renders undiscovered locations / exits as ???
    // placeholders that the player reveals one-at-a-time via the
    // explore action. Defaults to true (decoupled from manaEnabled
    // since the flip — pass `false` explicitly to opt out).
    fogEnabled = true,
} = {}) {
    const regionMap = {};
    for (const region of grid.allRegions()) {
        const substrateId = region.substrate ?? 'maze';
        const adapter = getAdapter(substrateId);
        const playablePayload = adapter.serializeWorld(
            region.playable_payload,
            region.extracted_rules,
            baseObstacleLib,
            baseItemLib,
        );
        if (manaEnabled) {
            playablePayload.manaEnabled = true;
        }
        // Emit fogEnabled explicitly so consumers can disambiguate
        // "absent → default true" from "explicit false → opt-out".
        playablePayload.fogEnabled = fogEnabled !== false;
        regionMap[region.region_id] = {
            substrate: substrateId,
            render_hint: region.render_hint ?? substrateId,
            // Driver-level layout coordinate. Lets the Region Graph
            // panel reproduce the maze's spatial layout (one Cytoscape
            // node per region, positioned by grid cell) instead of
            // running its own force-directed pass — and lets any
            // other consumer that wants to reason about adjacency
            // (e.g. distinguishing teleporter from grid-adjacent
            // edges) read the same coordinate space the maze uses.
            grid_cell: { gx: region.cell.gx, gy: region.cell.gy },
            playable_payload: playablePayload,
            // Resolved biome (substrate-supplied — null when the
            // substrate doesn't have a biome concept). Round-trips so
            // a regenerate-this-region action can reuse the same
            // biome configuration. Omitted when null to keep the
            // sidecar output minimal for substrates that ignore it.
            ...(region.biome ? { biome: region.biome } : {}),
            // Substrate-side auto-grow telemetry from generateRegionCore.
            // Read by computeProcgenStats to surface formula
            // under-provisioning in the procgen stats panel. Omitted
            // (rather than null) when the adapter didn't report it.
            ...(region.grow_telemetry ? { grow_telemetry: region.grow_telemetry } : {}),
        };
    }
    return { [playerId]: regionMap };
}

// stringifyRulesJson lives in shared/rulesJsonBuilder.js so the
// editor (and any other module that displays rules.json content) can
// use it without depending on the procgen pipeline. Re-exported here
// to keep existing import paths working.
export { stringifyRulesJson } from '../shared/rulesJsonBuilder.js';

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
        // Procgen metadata to embed at the top level of the output
        // rules.json. When absent, no procgen_metadata field is
        // emitted (backward compatible). Caller-supplied fields:
        //   { driver: 'grid-growth' | 'top-down',
        //     source_game?: string,                  // top-down only
        //     source_counts?: { regions, locations, exits, logic_gates },
        //     stop_reason?: string }
        // region_count and grid_dims are auto-derived from the grid.
        // See NewDocs/plans/presets-panel-overhaul.md §"Driver
        // metadata, added in this plan".
        procgenMetadata = null,
        // Embed a procgen-side sphere log at the top level of the
        // output rules.json. The forward simulator (Phase 1.4) walks
        // the freshly-built scaffold and produces JSONL-compatible
        // entries. Default true; callers (tests, debug harnesses) can
        // disable. See debugging-tools.md Phase 4.
        embedSphereLog = true,
        // Embed loop-mode cost data (per-region moveCost, per-location
        // cost) at the top level of the output rules.json. Requires
        // embedSphereLog. The runtime loops module auto-loads this when
        // present. Default false (loop mode is opt-in).
        // See NewDocs/plans/procedural-generation/
        // loop-mode-substrate-integration.md (Phase 2).
        enableLoopMode = false,
        // Per-region XP effect mode stamped on every loop_costs region
        // entry: 'cost' (default — XP discounts mana cost), 'speed'
        // (reserved for v2 — XP discounts action time only), 'both'
        // (reserved for v2), or 'none' (XP has no effect on cost).
        // Threaded through to generateLoopCosts when enableLoopMode is
        // true. See loop-mode-substrate-integration.md (Phase 7).
        regionXpEffect = 'cost',
        // Items granted to the player at game start (from the source
        // rules.json's `starting_items[playerId]`). Filtered to items
        // present in the compiled items pool, with `sourceItems`
        // backfilling definitions for starting-only items (items that
        // exist in the source's items pool but were never placed in
        // any region — APCalc has these). Default empty.
        startingItems = [],
        sourceItems = null,
        // When set to an item name, overwrite the scaffold's default
        // constant-true completion_condition with an item_check on
        // this item (state.has(itemName) at runtime). Grid-growth
        // passes the scenario's victory item here so the generated
        // worldgen package satisfies AP's test_completion_condition.
        // Top-down leaves this null and inherits the scaffold default.
        completionConditionItem = null,
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

    if (completionConditionItem) {
        scaffold.game_info[playerId].completion_condition = {
            type: 'item_check',
            item: completionConditionItem,
        };
    }

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

    // Starting items: keep names that exist in the compiled items
    // pool. For names that don't, backfill the definition from
    // `sourceItems` if available (source had the item declared but
    // never placed it — e.g. APCalc's starting-only buttons). Drop
    // anything that's neither — orphan references would fail
    // rulesDoc validation as "starting item is not a defined item".
    if (Array.isArray(startingItems) && startingItems.length > 0) {
        const kept = [];
        for (const name of startingItems) {
            if (scaffold.items[playerId][name] != null) {
                kept.push(name);
                continue;
            }
            const def = sourceItems?.[name];
            if (def != null) {
                scaffold.items[playerId][name] = def;
                kept.push(name);
            }
        }
        scaffold.starting_items[playerId] = kept;
    }

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
    // Loop mode flips `manaEnabled: true` (substrate mana hooks).
    // Fog is on by default (the substrate's per-tile / per-explore
    // discovery applies); callers wanting the legacy reveal-on-entry
    // behavior pass `fogEnabled: false` explicitly. Per-region
    // overrides are a later v2 concern.
    scaffold.preset_sidecars = buildPresetSidecars(grid, {
        playerId,
        baseObstacleLib: obstacleLib,
        baseItemLib: itemLib,
        manaEnabled: enableLoopMode,
    });

    // Procgen metadata: caller-supplied fields plus auto-derived
    // region_count and grid_dims from the grid. Only emitted when the
    // caller passes procgenMetadata, so older test fixtures that
    // don't care continue to produce identical output.
    if (procgenMetadata) {
        const allRegions = [...grid.allRegions()];
        let maxGx = -1, maxGy = -1;
        for (const region of allRegions) {
            const cell = region.cell;
            if (!cell) continue;
            if (cell.gx > maxGx) maxGx = cell.gx;
            if (cell.gy > maxGy) maxGy = cell.gy;
        }
        scaffold.procgen_metadata = {
            ...procgenMetadata,
            region_count: allRegions.length,
            grid_dims: {
                width: maxGx >= 0 ? maxGx + 1 : 0,
                height: maxGy >= 0 ? maxGy + 1 : 0,
            },
        };
    }

    // Procgen-side sphere log — Phase 4. Walks the freshly-built
    // scaffold against the forward simulator's accessibility model
    // and embeds the result as a top-level array. The loader
    // (sphereState/index.js) falls back to this field when no
    // separate _sphere_log.jsonl is present.
    if (embedSphereLog) {
        try {
            scaffold.sphere_log = generateSphereLog(scaffold, {
                playerId,
                metadata: {
                    seed,
                    seed_name: seedName,
                },
            });
        } catch (e) {
            // Don't fail the entire build if sphere log generation
            // throws — emit a marker entry the loader will see and
            // log a warning, but keep the rules.json otherwise valid.
            scaffold.sphere_log = [{
                type: 'metadata',
                error: `forwardSimulator failed: ${e?.message ?? String(e)}`,
            }];
        }
    }

    // Loop-mode cost generation — Phase 2 of loop-mode-substrate-integration.
    // Pure simulation against the freshly-generated sphere log; runtime
    // costDataManager picks up `loop_costs` directly from rules.json on load.
    if (enableLoopMode && embedSphereLog && Array.isArray(scaffold.sphere_log)) {
        try {
            scaffold.loop_costs = generateLoopCosts({
                rulesJson: scaffold,
                sphereLog: scaffold.sphere_log,
                playerId,
                regionXpEffect,
                sourceFileName: seedName || `seed_${seed}`,
            });
        } catch (e) {
            // Match the sphere-log error pattern: don't fail the build,
            // emit a marker the loader will warn about.
            scaffold.loop_costs = {
                version: '1.0',
                generatedAt: new Date().toISOString(),
                error: `loopCostGenerator failed: ${e?.message ?? String(e)}`,
                regions: {},
                locations: {},
                defaultRegionCost: 50,
                defaultLocationCost: 10,
            };
        }
    }

    return scaffold;
}
