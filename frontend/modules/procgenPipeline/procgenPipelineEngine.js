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
import { makeRulesJsonScaffold, makeHasRule, makeAndRule } from '../shared/rulesJsonBuilder.js';
import { validateSpherePlan } from './spherePlanner.js';
import { generateSphereLog } from '../shared/procgen/forwardSimulator.js';
import { generateLoopCosts } from '../shared/procgen/loopCostGenerator.js';
import { computeLongestShortestPath } from '../mazeRoom/mazeGeometry.js';
import {
    SIDE_N, SIDE_S, SIDE_E, SIDE_W, SIDES,
    OPPOSITE_SIDE, SIDE_DELTAS,
    mirrorTileAcrossSide,
    REGION_GROW_STEP,
} from '../shared/procgen/spatialPrimitives.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { extractItemRequirementFromRule } from './ruleRequirements.js';

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

    // Replace the region already at `cell` (re-roll / editor write-back).
    // placeRegion throws on an occupied cell by design; this is the explicit
    // in-place swap for re-realising one region while keeping its coordinates.
    replaceRegion(cell, region) {
        if (!this.hasRegion(cell)) {
            throw new Error(`Grid.replaceRegion: cell (${cell.gx},${cell.gy}) is empty`);
        }
        this.cells.set(cellKey(cell), { ...region, cell: { gx: cell.gx, gy: cell.gy } });
    }

    // Remove and return the region at `cell` (layout editing: move/swap).
    removeRegion(cell) {
        const region = this.cells.get(cellKey(cell));
        this.cells.delete(cellKey(cell));
        return region ?? null;
    }

    // Drop all teleporter mappings (layout editing rebuilds them from the
    // logical links after a move/swap — see relayoutSphereGrid).
    clearTeleporters() {
        this.teleporters.clear();
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

// --- Grid transport codec (stepped-pipeline CLI) -----------------------
//
// A live Grid nests non-JSON-safe values inside each region's
// playable_payload — substrate internals like the maze's `tiles`
// (Int8Array) and `exits`/`obstacles`/`items` (Map). To carry a grown
// grid across a process boundary (pipeline step ③ → step ④) the codec
// LOSSLESSLY tags those types so deserializeGrid reconstructs the EXACT
// in-memory object; buildRulesJson(deserializeGrid(serializeGrid(g))) is
// then byte-identical to buildRulesJson(g) because the structure is
// reproduced verbatim — no substrate-semantic round-trip is involved.
//
// This is transport, NOT a hand-editing surface (the tagged form is
// deliberately structural). Edit a grown region via the in-app region
// editor / reRollSphereRegion, or edit the pipeline at steps ①–②c.
const _TYPED_ARRAYS = {
    Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
    Int32Array, Uint32Array, Float32Array, Float64Array,
};

function _encodeGridValue(v) {
    if (v === null || typeof v !== 'object') return v;
    if (v instanceof Map) {
        return { __k: 'Map', __v: [...v.entries()].map(
            ([k, val]) => [_encodeGridValue(k), _encodeGridValue(val)]) };
    }
    if (v instanceof Set) {
        return { __k: 'Set', __v: [...v].map(_encodeGridValue) };
    }
    if (ArrayBuffer.isView(v) && !(v instanceof DataView)) {
        return { __k: v.constructor.name, __v: Array.from(v) };
    }
    if (Array.isArray(v)) return v.map(_encodeGridValue);
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = _encodeGridValue(val);
    return out;
}

function _isTagged(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v)
        && typeof v.__k === 'string' && '__v' in v && Object.keys(v).length === 2;
}

function _decodeGridValue(v) {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(_decodeGridValue);
    if (_isTagged(v)) {
        if (v.__k === 'Map') {
            return new Map(v.__v.map(
                ([k, val]) => [_decodeGridValue(k), _decodeGridValue(val)]));
        }
        if (v.__k === 'Set') return new Set(v.__v.map(_decodeGridValue));
        const TA = _TYPED_ARRAYS[v.__k];
        if (TA) return TA.from(v.__v);
        throw new Error(`deserializeGrid: unknown tagged type '${v.__k}'`);
    }
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = _decodeGridValue(val);
    return out;
}

/**
 * Serialize a live Grid to a plain JSON-safe object (see codec note above).
 * Region payloads keep their structure verbatim via tagged Map/typed-array
 * encoding; teleporter values are already plain cellKey strings.
 */
export function serializeGrid(grid) {
    if (!grid || !(grid instanceof Grid)) {
        throw new Error('serializeGrid: expected a Grid instance');
    }
    return {
        width: grid.width,
        height: grid.height,
        teleporters: [...grid.teleporters.entries()],
        cells: [...grid.cells.entries()].map(
            ([key, region]) => [key, _encodeGridValue(region)]),
    };
}

/**
 * Reconstruct a live Grid from serializeGrid's output. Sets cells directly
 * (not via placeRegion) so the stored region objects — including their
 * `cell` coordinate — are reproduced exactly, with no re-validation or
 * re-wrapping that would perturb byte-identity.
 */
export function deserializeGrid(obj) {
    if (!obj || typeof obj !== 'object') {
        throw new Error('deserializeGrid: expected an object');
    }
    const grid = new Grid({ width: obj.width, height: obj.height });
    for (const [key, region] of obj.cells ?? []) {
        grid.cells.set(key, _decodeGridValue(region));
    }
    for (const [key, val] of obj.teleporters ?? []) {
        grid.teleporters.set(key, val);
    }
    return grid;
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

/**
 * Set-based twin of findDisconnectedCell, for callers that track
 * occupancy in a Set of `${gx},${gy}` keys rather than a populated
 * Grid (the sphere-growth placement pre-pass decides every cell
 * before any region is built, so grid.allRegions() is still empty).
 * Same semantics: an unbuilt cell at least `minGap` Manhattan-distance
 * from every occupied cell, chosen uniformly via rng, or null when the
 * grid is too crowded.
 */
function findDisconnectedCellFromOccupied(occupiedKeys, dims, rng, minGap = 2) {
    const built = [...occupiedKeys].map((k) => {
        const [gx, gy] = k.split(',').map(Number);
        return { gx, gy };
    });
    if (built.length === 0) {
        return { gx: Math.floor(dims.width / 2), gy: Math.floor(dims.height / 2) };
    }
    const candidates = [];
    for (let gx = 0; gx < dims.width; gx++) {
        for (let gy = 0; gy < dims.height; gy++) {
            if (occupiedKeys.has(`${gx},${gy}`)) continue;
            let minDist = Infinity;
            for (const r of built) {
                const d = Math.abs(gx - r.gx) + Math.abs(gy - r.gy);
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

// --- Region structural accessors (substrate-agnostic seam) ---
//
// A built region's exit table (a Map of exit_id -> exit object) and its
// entrance are STRUCTURAL bookkeeping the engine owns: stitching,
// back-exits, reverse links, wall-off. They are distinct from the
// substrate's opaque runtime payload. As of Phase 4c they live on the
// engine-owned region descriptor (region.exits / region.entrance),
// canonical for ALL substrates: maze ALIASES its world's Map (same
// object), zone substrates no longer carry a faked Map on the payload.
// buildPresetSidecars re-attaches both onto the payload right before
// serialize so the substrate serializeWorld signatures stay unchanged.
// These accessors are the single seam through which all engine code
// touches them. See
// NewDocs/plans/procedural-generation/topdown-bounce-obstacle-refactor.md
// (Phase 2a / 4c).
export function getRegionExits(region) {
    return region?.exits;
}
export function setRegionExits(region, exits) {
    if (region) region.exits = exits;
}
export function getRegionEntrance(region) {
    return region?.entrance;
}
export function setRegionEntrance(region, entrance) {
    if (region) region.entrance = entrance;
}

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
            const worldExit = getRegionExits(region)?.get(exit.id);
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
        const exits = getRegionExits(region);
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

        const worldExits = getRegionExits(region);
        if (worldExits) {
            for (const id of [...worldExits.keys()]) {
                if (!validIds.has(id)) worldExits.delete(id);
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
        const exits = getRegionExits(sourceRegion);
        if (!exits) continue;
        // Snapshot — addReciprocalBackExit mutates the target's
        // exits, not the source's, so iteration of `exits` is safe;
        // but snapshotting keeps the loop trivially correct as the
        // function evolves.
        for (const [sourceExitId, sourceExit] of [...exits]) {
            if (!sourceExit?.targetRegion) continue;
            const target = byName.get(sourceExit.targetRegion);
            if (!target) continue;
            const targetExits = getRegionExits(target);
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
    const targetExits = getRegionExits(targetRegion);
    if (targetExits.has(backExitId)) return;
    targetExits.set(backExitId, {
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
    // Content-module pass: stamp substrate-specific content (maze hazards)
    // onto the world after the base layout. No-op for substrates that don't
    // declare the hook — the engine names no substrate here.
    adapter.applyContentModules?.(core.world, { hazardOpts }, rng);
    return {
        substrate,
        region_id,
        playable_payload: core.world,
        // Structural exit table + entrance — the engine-owned descriptor
        // fields (Phase 4c). Maze ALIASES its world's Map (same object), so
        // back-exit/stitch mutations via getRegionExits also reach the
        // world; serializeMazeWorld reads world.exits directly and
        // buildPresetSidecars re-attaches region.exits / region.entrance
        // before serialize.
        exits: core.world.exits,
        entrance: core.world.entrance,
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
        // — null disables. See mazeRoomLibrary's applyMazeContentModules for the option shape.
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
            getRegionExits(region).set(backExitId, {
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
            const parentWorldExit = getRegionExits(parentRegion)?.get(parentExitPlaced.exit_id);
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
        // Same shape as growMaze's hazardOpts; see mazeRoomLibrary's applyMazeContentModules.
        // null disables.
        hazardOpts = null,
        // Item names the player holds for free at game start (source
        // starting_items plus any substrate ability items the UI granted —
        // e.g. bounce arrows). A zone substrate may attach these to a
        // surplus exit's physics requirement without changing the realised
        // logic (see generateRegionZoneGen's drift handling).
        freeItems = null,
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
                target_region: targetName ?? null,
                ...(resolvedSide ? { side: resolvedSide } : {}),
                ...(tile ? { tile } : {}),
                // Realised via placeFromRules / zone requirement. True_
                // rules are skipped by the substrate — no gate appears on
                // the tile, but the exit is still emitted in
                // extracted_rules.
                ...(srcExit.access_rule ? { access_rule: srcExit.access_rule } : {}),
            };
        });

        const locationSpecs = (sourceRegion.locations ?? []).map((srcLoc) => {
            const locId = srcLoc.name ?? String(srcLoc.id ?? '');
            return {
                id: locId,
                item: srcLoc.item?.name ?? null,
                ...(srcLoc.access_rule ? { access_rule: srcLoc.access_rule } : {}),
            };
        }).filter((l) => l.id);

        // Substrate dispatch: per-region resolution via pickSubstrate
        // (caller override > source tag > picker > mix > 'maze').
        const substrateId = pickSubstrate(name, sourceRegion, {
            substrateByRegion, substrateMix, substratePicker,
        }, rng);
        // Biome resolution mirrors substrate dispatch: per-region from
        // input wins, otherwise inherit from rules.json source region
        // (which the top-down driver may stamp), otherwise null →
        // substrate default. v1 callers don't supply biome; that's a
        // future commit.
        const regionBiome = biomeByRegion?.[name] ?? sourceRegion?.biome ?? null;

        // Unified region build (procedural or zone). The helper realises
        // the exit/location access rules onto substrate geometry, sets
        // global_name from the AP-canonical source ids, applies the
        // hazard module (maze only), and returns the region descriptor.
        const region = generateRegion({
            substrate: substrateId,
            region_id: name,
            size,
            entrances,
            exits: exitSpecs,
            locations: locationSpecs,
            itemLib,
            obstacleLib,
            rng,
            params: regionParams,
            biome: regionBiome,
            hazardOpts,
            useSourceLocationName: true,
            stampEntrance: true,
            freeItems,
        });

        for (const placed of region.exits_placed) {
            exitSidesByExit.set(`${name}:${placed.exit_id}`, {
                side: placed.side,
                tile_position: placed.tile_position,
            });
        }

        // Mutate the stub in place — Grid doesn't have a replaceRegion
        // method and placeRegion would throw on the second call.
        const stub = grid.getRegion(cell);
        Object.assign(stub, {
            substrate: region.substrate,
            playable_payload: region.playable_payload,
            // Structural exit table + entrance now ride the descriptor
            // (Phase 4c), so they must be copied onto the grid stub
            // alongside the payload — the stub is what stitchGrid /
            // back-exit / linkReverseExits / entrance-align mutate through
            // getRegionExits / getRegionEntrance.
            exits: region.exits,
            entrance: region.entrance,
            extracted_rules: region.extracted_rules,
            placed_items: region.placed_items,
            placed_obstacles: [],
            placed_logic_gates: region.placed_logic_gates,
            exits_placed: region.exits_placed,
            render_hint: region.render_hint,
            sidecar_filename: region.sidecar_filename,
            biome: region.biome,
            grow_telemetry: region.grow_telemetry,
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
            const entranceTile = getRegionEntrance(region);
            const entranceSide = OPPOSITE_SIDE[parentExit.side];
            const backExitId = parent.name;
            // Skip the synthetic back-exit when the source already
            // declared a reverse exit pointing at the parent (under
            // any name) — we'd just be duplicating an existing route.
            const regionExits = getRegionExits(region);
            const hasExplicitReverse = [...regionExits.values()]
                .some((e) => e.targetRegion === parent.name);
            if (regionExits.has(backExitId) || hasExplicitReverse) continue;
            regionExits.set(backExitId, {
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
            const parentWorldExit = getRegionExits(parentRegion)?.get(parent.exit_id);
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
        const exits = getRegionExits(region);
        if (!exits) continue;
        for (const e of exits.values()) {
            if (e.targetRegion === parent.name) {
                setRegionEntrance(region, { x: e.x, y: e.y });
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
        const exits = getRegionExits(region);
        if (!exits) continue;
        for (const exit of exits.values()) {
            if (exit.targetExitId) continue;
            if (!exit.targetRegion) continue;
            const target = regionByName.get(exit.targetRegion);
            const targetExits = getRegionExits(target);
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
        // Item names whose canonical placement must ALWAYS hold — the
        // compiled location gets `locked: true`, which world_generator
        // turns into place_locked_item (so even multiworld fill keeps
        // the item there). Used for the bounce start-stack arrow.
        lockedItems = [],
    } = opts;
    const lockedItemSet = new Set(lockedItems);
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
        // Two channels carry per-region obstacle defs the base library
        // lacks, both needed so compileObstacle doesn't throw on an
        // undefined id:
        //   - playable_payload.obstacleLib: top-down's placeFromRules /
        //     maze's per-instance logic_gate entries (serialized into the
        //     maze sidecar).
        //   - region.obstacle_defs: zone substrates' emitted obstacle defs
        //     (Phase 3 — physics gaps + authored logic gates). A
        //     region-level field, so it never reaches the serialized
        //     payload (keeping zone sidecars byte-identical).
        const localLib = region.playable_payload?.obstacleLib;
        const regionDefs = region.obstacle_defs;
        const mergedLib = (localLib || regionDefs)
            ? { ...obstacleLib, ...regionDefs, ...localLib }
            : obstacleLib;
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
                ...(itemPlacement && lockedItemSet.has(loc.item)
                    ? { locked: true } : {}),
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
 * generateRegionCore — JtA, Bounce Demo). The result shape mirrors
 * what buildSubstrateRegion returns so downstream code (stitchGrid,
 * wallOff, buildPresetSidecars, buildRulesJson) can consume it
 * uniformly.
 *
 * Optional adapter hook `extractZoneRules(zoneIdx, ctx)` lets a
 * zone-based substrate contribute AP locations and per-side exit
 * access rules (the "zone-locations channel" —
 * NewDocs/plans/procedural-generation/dj-metroidvania-v2.md §"Pipeline
 * integration"). ctx is { region_id, exitSides, regionSize }; the
 * return shape is:
 *
 *   { locations: [{ id, item, access_rule, position? }],  // AP locations
 *     exitRules: { [side]: <Rule Builder rule> },         // per-side gate
 *     payload:   { ... } }                                // merged into playable_payload
 *
 * The synthetic exit scaffolding (exit_<side> ids at perimeter
 * midpoints) is unchanged — stitchGrid/wallOff/reconcile conventions
 * stay intact; the hook only attaches rules and locations to it.
 * Adapters without the hook behave exactly as before (always-open
 * exits, no locations). JtA's planned extract-locations-from-zone-data
 * will implement this same hook.
 */
function synthesizeZoneRegion({
    substrate, region_id, zoneIdx, regionSize, exitSides, adapter,
}) {
    const zoneRules = adapter.extractZoneRules
        ? adapter.extractZoneRules(zoneIdx, { region_id, exitSides, regionSize })
        : null;
    const zonePayload = adapter.synthesizeZonePayload
        ? adapter.synthesizeZonePayload(zoneIdx)
        : {};
    return assembleZoneRegion({
        substrate, region_id, regionSize, exitSides, zoneRules, zonePayload,
    });
}

// Shared tail of zone-region synthesis: synthetic exit scaffolding
// (exit_<side> at perimeter midpoints — stitchGrid/wallOff
// conventions) plus the zone-locations channel result. Consumed by
// both the spiral path (extractZoneRules) and the sphere-growth path
// (generateZoneForSpecs).
function assembleZoneRegion({
    substrate, region_id, regionSize, exitSides, zoneRules, zonePayload,
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
        // Phase 4a: prefer the substrate's obstacle paths (bounce); fall
        // back to a verbatim access_rule for substrates not yet on the
        // obstacle emission (jta), and to the always-open placeholder when
        // neither is present.
        const sidePaths = zoneRules?.exitPaths?.[side];
        const sideRule = zoneRules?.exitRules?.[side];
        extractedExits.push({
            id: exit_id,
            position: { x: tile.x, y: tile.y },
            target_region: null,
            paths: sidePaths ?? [{ path_id: 'p1', obstacles: [] }],
            ...(!sidePaths && sideRule ? { access_rule: sideRule } : {}),
        });
    }
    const extractedLocations = (zoneRules?.locations ?? []).map((loc) => ({
        id: loc.id,
        item: loc.item ?? null,
        position: loc.position ?? null,
        paths: loc.paths ?? [{ path_id: 'p1', obstacles: [] }],
        ...(!loc.paths && loc.access_rule ? { access_rule: loc.access_rule } : {}),
    }));
    return {
        substrate,
        region_id,
        playable_payload: { ...zonePayload, ...(zoneRules?.payload ?? {}) },
        // Structural exit table — engine-owned descriptor field (Phase 4c).
        // The zone payload no longer carries a faked exits Map;
        // buildPresetSidecars re-attaches region.exits before serialize.
        exits: exitsMap,
        // region_id mirrors what procedural adapters' extractPathsAndObstacles
        // emits. compileRegion reads it as the region_name; without it,
        // compileRegionGraph collapses every zone-based region onto
        // regions[undefined] and Menu's GameStart exit dangles.
        extracted_rules: { region_id, exits: extractedExits, locations: extractedLocations },
        // Per-region obstacle lib additions (bounce's physics gaps). A
        // region-level field — never reaches the serialized payload. {}
        // for substrates that emit none.
        obstacle_defs: zoneRules?.obstacleDefs ?? {},
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

// --- Unified region-build contract (Phase 2a) ---
//
// generateRegion(spec) is the single region-build path shared by the
// layout drivers (top-down now; sphere-growth next). It dissolves the
// procedural(tile)/zone dichotomy: callers hand it a substrate-agnostic
// `spec` (exits + locations carrying Rule Builder access_rules) and get
// back a `descriptor` (the region object). The engine NEVER reaches into
// a substrate's playable_payload — structural fields (exits_placed,
// entrance) live on the descriptor / are stamped onto the payload here so
// the seam accessors (getRegionExits/getRegionEntrance) keep working.
//
// spec = {
//   substrate, region_id, size, rng, params, biome, itemLib, obstacleLib,
//   hazardOpts,
//   entrances: [{ side, tile }],                                  // 0 or 1
//   exits:     [{ exit_id?, exitName?, side?, tile?, target_region?,
//                 access_rule? }],
//   locations: [{ id, item?, access_rule? }],
//   useSourceLocationName,   // stamp loc.global_name = id (top-down)
// }
//
// Two branches by substrate kind:
//   PROCEDURAL (adapter.generateRegionCore): core → placeFromRules →
//     extractPathsAndObstacles → override loc ids/rules → exit-rule
//     override → hazard pass. Byte-identical to the prior top-down inline
//     sequence (rng draws in the same order; exit/location rule maps built
//     in spec order).
//   ZONE (generateZoneForSpecs[Gen]): map each access_rule to a physics
//     requirement (extractItemRequirementFromRule), run the zone
//     generate-to-spec, then assemble the descriptor keyed by the SPEC's
//     exit_id (not exit_<side>) and set playable_payload.entrance (the
//     leak fix). Final access rules are the SOURCE rules (top-down
//     realises-existing); the substrate only contributes winnable geometry.
//
// generateRegionGen is the generator form (forwards the zone adapter's
// per-attempt progress events); generateRegion drains it synchronously.

// Retry-then-grow budget for fitting every location into a procedural
// (maze) region. Re-roll the wall layout this many times at the requested
// size first (a fresh layout usually frees enough reachable floor)...
const LOCATION_FIT_RETRIES_BEFORE_GROW = 4;
// ...then grow the region on each subsequent attempt, up to this many
// attempts total before failing loudly. A location drop is rare (~1% of
// regions) but must never silently happen, so the budget is generous.
const LOCATION_FIT_MAX_ATTEMPTS = 10;

function generateRegionProcedural(spec) {
    const adapter = getAdapter(spec.substrate);

    // Core exit specs — size-independent, so reused across retry-grow
    // attempts below.
    const coreExits = (spec.exits ?? []).map((e) => ({
        ...(e.exit_id != null ? { exit_id: e.exit_id } : {}),
        ...(e.exitName != null ? { exitName: e.exitName } : {}),
        ...(e.side ? { side: e.side } : {}),
        ...(e.tile ? { tile: e.tile } : {}),
        ...(e.target_region != null ? { targetRegion: e.target_region } : {}),
    }));

    // Build location_rules / item_placements from the spec, in spec order,
    // so placeFromRules sees the same map contents and key order it did
    // when the caller built these inline. (exit_rules depends on the core's
    // resolved exit_ids, so it's rebuilt per attempt inside the loop.)
    const location_rules = {};
    const item_placements = [];
    for (const loc of spec.locations ?? []) {
        if (loc.access_rule) location_rules[loc.id] = loc.access_rule;
        if (loc.item != null) {
            item_placements.push({ item_id: loc.item, location_id: loc.id });
        }
    }
    // Every location id placeFromRules is responsible for realising.
    const requestedLocIds = new Set([
        ...Object.keys(location_rules),
        ...item_placements.map((p) => p.location_id),
    ]);

    // Retry-then-grow so a location is NEVER silently dropped. A maze's
    // wall layout can leave too little entrance-reachable floor to host
    // every location, in which case placeFromRules skips the overflow
    // (pickReachableFloorTile returns null). Re-running generateRegionCore
    // advances the rng → a fresh wall layout that usually frees floor;
    // after a few same-size re-rolls, grow the region. Throw loudly if even
    // the grown region can't fit them. For the common case (everything
    // fits on attempt 0) the loop runs exactly once, leaving rng draws and
    // geometry identical to the pre-retry behaviour.
    let size = { width: spec.size.width, height: spec.size.height };
    let core = null;
    let placement = null;
    let exit_rules = null;
    for (let attempt = 0; attempt <= LOCATION_FIT_MAX_ATTEMPTS; attempt++) {
        core = adapter.generateRegionCore({
            region_id: spec.region_id,
            size,
            entrances: spec.entrances ?? [],
            exits: coreExits,
            item_lib: spec.itemLib,
            obstacle_lib: spec.obstacleLib,
            rng: spec.rng,
            params: spec.params,
            biome: spec.biome ?? null,
        });
        // exit_rules maps the core's resolved exit_id (by side) to the
        // spec's access rule — rebuilt per attempt since exits_placed is
        // re-resolved each time generateRegionCore runs.
        exit_rules = {};
        for (const e of spec.exits ?? []) {
            if (!e.access_rule) continue;
            let exitId = e.exit_id;
            if (exitId == null && e.side != null) {
                exitId = core.exits_placed.find((p) => p.side === e.side)?.exit_id;
            }
            if (exitId != null) exit_rules[exitId] = e.access_rule;
        }
        placement = adapter.placeFromRules(core.world, {
            exit_rules, location_rules, item_placements, rng: spec.rng,
        });
        const placedIds = new Set(
            (placement.placed_locations ?? []).map((p) => p.location_id));
        if ([...requestedLocIds].every((id) => placedIds.has(id))) break;
        if (attempt === LOCATION_FIT_MAX_ATTEMPTS) {
            throw new Error(
                `generateRegionProcedural: could not place all `
                + `${requestedLocIds.size} location(s) in '${spec.region_id}' `
                + `after ${LOCATION_FIT_MAX_ATTEMPTS} retries `
                + `(final ${size.width}x${size.height})`);
        }
        if (attempt >= LOCATION_FIT_RETRIES_BEFORE_GROW) {
            size = {
                width: size.width + REGION_GROW_STEP,
                height: size.height + REGION_GROW_STEP,
            };
        }
    }
    const extracted_rules = adapter.extractPathsAndObstacles(
        core.world, { regionId: spec.region_id });

    // Override BFS-derived location ids/rules with the spec's authoritative
    // ids + access rules (path-walk pollution must not leak into access
    // rules; the spec rule IS the rule). global_name is stamped only when
    // the caller asks (top-down preserves AP-canonical source names).
    const locationIdByPos = new Map();
    for (const placed of placement.placed_locations ?? []) {
        locationIdByPos.set(`${placed.position.x},${placed.position.y}`, placed.location_id);
    }
    const specById = new Map((spec.locations ?? []).map((l) => [l.id, l]));
    for (const loc of extracted_rules.locations) {
        const specLocId = locationIdByPos.get(`${loc.position.x},${loc.position.y}`);
        if (!specLocId) continue;
        loc.id = specLocId;
        if (spec.useSourceLocationName) loc.global_name = specLocId;
        const sl = specById.get(specLocId);
        if (sl?.access_rule) loc.access_rule = sl.access_rule;
        else if (spec.defaultLocationRuleToTrue) loc.access_rule = { rule: 'True_' };
    }
    for (const ex of extracted_rules.exits) {
        if (exit_rules[ex.id]) ex.access_rule = exit_rules[ex.id];
    }

    adapter.applyContentModules?.(core.world, { hazardOpts: spec.hazardOpts ?? null }, spec.rng);

    return {
        substrate: spec.substrate,
        region_id: spec.region_id,
        playable_payload: core.world,
        // Structural exit table + entrance alias the maze world (Phase 4c).
        exits: core.world.exits,
        entrance: core.world.entrance,
        extracted_rules,
        placed_items: placement.placed_items,
        placed_obstacles: [],
        placed_logic_gates: placement.placed_logic_gates,
        exits_placed: core.exits_placed,
        render_hint: spec.substrate,
        sidecar_filename: `${spec.region_id}.json`,
        wall_stats: core.wall_stats ?? null,
        biome: core.biome ?? null,
        grow_telemetry: core.grow_telemetry ?? null,
    };
}

function* generateRegionZoneGen(spec) {
    const adapter = getAdapter(spec.substrate);
    const regionSize = spec.size;
    const specById = new Map((spec.locations ?? []).map((l) => [l.id, l]));

    // Bounce-style zone substrates gate on a side; assign one to any exit
    // the layout driver couldn't resolve geographically (clockwise over
    // the still-free sides).
    const usedSides = new Set((spec.exits ?? []).filter((e) => e.side).map((e) => e.side));
    const freeSides = SIDES.filter((s) => !usedSides.has(s));
    const exitsResolved = (spec.exits ?? []).map((e) => ({
        ...e,
        side: e.side ?? freeSides.shift(),
    }));

    // A gate may arrive as a Rule Builder access_rule (top-down realises
    // an existing rules.json) OR as a pre-split requirement/counts pair
    // (sphere-growth composes item-name gates directly). Prefer the
    // direct pair when present; otherwise extract from the rule.
    const requirementOf = (g) => (g?.requirement !== undefined
        ? { requirement: g.requirement, counts: g.counts ?? {} }
        : extractItemRequirementFromRule(g?.access_rule));

    const exitSpecs = exitsResolved.map((e) => ({ side: e.side, ...requirementOf(e) }));

    // Free-item arrow drifts (top-down). A bounce-style zone hosts at most
    // one arrowless ("column top") exit; the rest must drift off-column on
    // a directional item the adapter declares (driftItems). Top-down
    // realises an existing world whose exits carry no such items, so a
    // multi-exit region hands the realiser several arrowless exits and
    // throws. When the caller marks those drift items as FREE (granted as
    // starting items — see the top-down UI), attach one to the PHYSICS
    // requirement of each surplus exit that can take it.
    //
    // An exit only needs the forced column when its PHYSICS CORE is
    // non-empty — i.e. it carries a non-arrow item the substrate realises
    // as geometry (adapter.libraryItems, minus victory). A source gate on a
    // non-substrate item (Adventure keys etc.) is an authored lock with NO
    // geometry, so its physics core is empty and it drifts freely; the lock
    // (and the gate it enforces) rides along untouched. The exit keeps its
    // source access_rule, which compileRegion prefers over the synthesised
    // obstacle paths, so the realised LOGIC is unchanged — only the geometry
    // gains a drift the player can always pay. Scoped to exits carrying a
    // source access_rule so it never perturbs sphere-growth (which composes
    // its own gates and passes no freeItems).
    // The free-arrow exit drift is a COLUMN geometry device: a column hosts one
    // arrowless "top", so surplus exits are pushed off-column on a free Left/Right
    // arrow. The BRAID hosts surplus exits NATIVELY — proposeBraidLevel forks the
    // spine and puts one portal per fork branch (no cap), all on free arrows — so
    // it needs no drift. Worse, a drift would inject `left`/`right` into the exit
    // requirements, and the braid's gate analysis (planBraidGatedChain) reads any
    // arrow in a requirement as a GATE — so a region with surplus exits in both
    // directions trips "cannot gate both arrows" and wrongly falls back to a
    // column. Skip the drift in braid mode: the arrows stay free, the requirements
    // stay empty (Regime-1 all-free), and the fork braid realises every exit.
    // The substrate declares whether it hosts surplus exits natively
    // (braid does → skip the drift); default not-native → drift.
    const driftItems = adapter.driftItems ?? [];
    const freeDrifts = driftItems.filter((d) => (spec.freeItems ?? []).includes(d));
    if (!adapter.hostsSurplusExitsNatively?.(spec.params) && freeDrifts.length > 0) {
        const geometryItems = new Set(Object.entries(adapter.libraryItems ?? {})
            .filter(([, def]) => !def?.is_victory).map(([name]) => name));
        const isDrift = (it) => driftItems.includes(it);
        const physicsCore = (req) => req.filter((it) => geometryItems.has(it) && !isDrift(it));
        const arrowless = exitSpecs
            .map((s, i) => ({ s, override: !!exitsResolved[i].access_rule }))
            .filter(({ s }) => !s.requirement.some(isDrift));
        if (arrowless.length > 1) {
            // Driftable = empty physics core AND a source-rule override (so
            // the free arrow rides only geometry, never the emitted logic).
            const driftable = arrowless.filter(({ s, override }) =>
                override && physicsCore(s.requirement).length === 0);
            // Keep one arrowless exit as the column top. A non-driftable
            // arrowless exit (a real physics gate) is the natural top, so
            // drift ALL driftable exits; otherwise keep the first driftable
            // one arrowless and drift the rest. (Two non-driftable arrowless
            // exits = two distinct physics column tops, an irreducible
            // geometry conflict the realiser still rejects.)
            const hasNonDriftableTop = arrowless.length > driftable.length;
            const toDrift = hasNonDriftableTop ? driftable : driftable.slice(1);
            toDrift.forEach(({ s }, k) => {
                s.requirement = [...s.requirement, freeDrifts[k % freeDrifts.length]];
            });
        }
    }

    // The entrance side rides the generator (NOT the forward-exit
    // scaffolding) as the guaranteed back-portal, gated on the region's
    // entry gate — but only when the caller supplied one (sphere). For
    // top-down the entrance is geometry-only (the entry gate lives on the
    // parent's exit), so it is not passed to the generator.
    //
    // BRAID: the back portal is UNGATED. Its entry gate is the item you came
    // in with, which differs from the region's FORWARD gates (next-sphere
    // items) — so a gated back portal makes nearly every region's requirements
    // mutually incomparable, which a single braid chain can't realise. The
    // back portal never needs gating: you can only BE here if you already used
    // the entry item, so a free way back grants no reachability you didn't have
    // (monotone — less restrictive is always sound). Ungating it lets the braid
    // realise the region as one nested chain of its forward gates. The column
    // keeps the gated back portal (it has the width for a back-portal branch
    // tip), so column output stays byte-identical.
    const ent = spec.entrances?.[0];
    if (ent && (ent.requirement !== undefined || ent.access_rule !== undefined)) {
        // Gated back portal (column) vs ungated (braid) — the substrate
        // decides from its regionParams; default gated.
        const backGated = adapter.backPortalGated?.(spec.params) ?? true;
        exitSpecs.push(backGated
            ? { side: ent.side, ...requirementOf(ent) }
            : { side: ent.side, requirement: [], counts: {} });
    }
    const locationSpecs = (spec.locations ?? []).map((loc) => ({
        id: loc.id, item: loc.item ?? null, ...requirementOf(loc),
    }));

    // Base zoneSpecs; the substrate enriches them with its own layout
    // vocabulary (bounce: physicsProfile + the braid mode/width/jitter/
    // platformRows/decoration/freeArrow — see buildZoneSpecs), so the
    // engine names no substrate-specific params. `seed` is computed here
    // (consuming the region rng) before the adapter enriches.
    const baseZoneSpecs = {
        region_id: spec.region_id,
        exitSpecs,
        locationSpecs,
        seed: spec.seed ?? ((spec.rng.next() * 0x7fffffff) | 0),
    };
    const zoneSpecs = typeof adapter.buildZoneSpecs === 'function'
        ? adapter.buildZoneSpecs(baseZoneSpecs, spec.params ?? {})
        : baseZoneSpecs;
    const zoneRules = typeof adapter.generateZoneForSpecsGen === 'function'
        ? yield* adapter.generateZoneForSpecsGen(zoneSpecs)
        : adapter.generateZoneForSpecs(zoneSpecs);

    // Assemble the descriptor, keying exits by the SPEC's exit_id (top-down
    // overrides/teleporters key on the source exit id) rather than
    // synthesising exit_<side>.
    const exitsMap = new Map();
    const exitsPlaced = [];
    const extractedExits = [];
    for (const e of exitsResolved) {
        const tile = e.tile ?? perimeterMidpoint(e.side, regionSize);
        const exitId = e.exit_id ?? `exit_${e.side}`;
        // No targetExitId here — it's appended later by linkReverseExits /
        // the back-exit pass (matching assembleZoneRegion's key order so
        // serialized zone payloads stay byte-identical).
        exitsMap.set(exitId, {
            exit_id: exitId,
            x: tile.x,
            y: tile.y,
            side: e.side,
            exitName: e.exitName ?? exitId,
            targetRegion: e.target_region ?? null,
            isBackExit: false,
            isTeleporter: false,
        });
        exitsPlaced.push({ exit_id: exitId, side: e.side, tile_position: { x: tile.x, y: tile.y } });
        // Phase 3: the substrate emits its derived access as
        // paths-and-obstacles (the canonical form). Top-down OVERRIDES with
        // the source rule verbatim (rules realised, not authored), keying
        // an explicit access_rule; sphere-growth carries no source rule, so
        // the compiler compiles the obstacle paths. The bounce paths ride
        // along either way (the obstacle representation for the region).
        const paths = zoneRules?.exitPaths?.[e.side] ?? [{ path_id: 'p1', obstacles: [] }];
        extractedExits.push({
            id: exitId,
            position: { x: tile.x, y: tile.y },
            target_region: e.target_region ?? null,
            paths,
            ...(e.access_rule ? { access_rule: e.access_rule } : {}),
        });
    }
    const extractedLocations = (zoneRules?.locations ?? []).map((loc) => {
        const sl = specById.get(loc.id);
        return {
            id: loc.id,
            item: loc.item ?? null,
            position: loc.position ?? null,
            paths: loc.paths ?? [{ path_id: 'p1', obstacles: [] }],
            // Source rule (top-down) wins; otherwise the compiler compiles
            // the obstacle paths above.
            ...(sl?.access_rule ? { access_rule: sl.access_rule } : {}),
            ...(spec.useSourceLocationName ? { global_name: loc.id } : {}),
        };
    });

    const playable_payload = { ...(zoneRules?.payload ?? {}) };
    // Back-portal routing param (sphere + top-down both want it): landing
    // on the entrance side resolves to the driver's back-exit. fallBehavior
    // is per-world.
    if (playable_payload.params && ent?.side) {
        playable_payload.params.backExitSide = ent.side;
        if (spec.params?.fallBehavior) {
            playable_payload.params.fallBehavior = spec.params.fallBehavior;
        }
    }
    // Location-name reconciliation (top-down). The substrate names its
    // pickups by its own convention (bounce: `${region}__${id}`, matching
    // makeLocationName), and the payload's ap_locations maps each in-game
    // objective to that name — the bridge resolves an objective through it
    // to fire user:locationCheck. But top-down overrides each location's
    // compiled AP name with the SOURCE name (global_name = loc.id), so the
    // unreconciled map points at a name the stateManager never registered
    // (location_not_found on every bounce pickup). Rebuild ap_locations to
    // the compiled global_name so the bridge reports the registered name.
    if (spec.useSourceLocationName && playable_payload.ap_locations) {
        const nameById = new Map(extractedLocations.map((l) => [l.id, l.global_name ?? l.id]));
        playable_payload.ap_locations = Object.fromEntries(
            Object.entries(playable_payload.ap_locations)
                .map(([k, v]) => [k, nameById.get(k) ?? v]));
    }
    // Entrance leak fix: zone regions previously omitted .entrance, so the
    // top-down bidirectional back-exit pass threw on entranceTile.x. Only
    // the engine-owned drivers that READ getRegionEntrance need it stamped
    // (top-down); sphere-growth computes its back-exit tile locally and
    // leaves .entrance undefined to keep its serialized payloads
    // byte-identical. As of Phase 4c the entrance rides the descriptor
    // (region.entrance), not the payload; buildPresetSidecars re-attaches it.
    const regionEntrance = (spec.stampEntrance && ent)
        ? (ent.tile ?? perimeterMidpoint(ent.side, regionSize))
        : undefined;

    return {
        substrate: spec.substrate,
        region_id: spec.region_id,
        playable_payload,
        // Structural exit table + entrance — engine-owned descriptor fields
        // (Phase 4c). Exits keyed by SPEC exit_id; the zone payload no
        // longer carries either.
        exits: exitsMap,
        entrance: regionEntrance,
        extracted_rules: {
            region_id: spec.region_id,
            exits: extractedExits,
            locations: extractedLocations,
        },
        // Per-region obstacle library additions (physics gaps the emitted
        // paths reference + per-instance authored logic gates). A
        // region-level field — NOT inside playable_payload — so it reaches
        // the compiler via compileRegionGraph but never the serialized
        // sidecar (serializeWorld spreads the payload). Empty object when
        // the substrate emits no obstacle defs.
        obstacle_defs: zoneRules?.obstacleDefs ?? {},
        placed_items: [],
        placed_obstacles: [],
        placed_logic_gates: [],
        exits_placed: exitsPlaced,
        render_hint: spec.substrate,
        sidecar_filename: `${spec.region_id}.json`,
        wall_stats: null,
        biome: null,
        grow_telemetry: null,
    };
}

export function* generateRegionGen(spec) {
    const adapter = getAdapter(spec.substrate);
    if (typeof adapter.generateRegionCore === 'function') {
        return generateRegionProcedural(spec);
    }
    if (typeof adapter.generateZoneForSpecs === 'function'
            || typeof adapter.generateZoneForSpecsGen === 'function') {
        return yield* generateRegionZoneGen(spec);
    }
    throw new Error(`generateRegion: substrate '${spec.substrate}' has neither `
        + 'generateRegionCore nor generateZoneForSpecs');
}

export function generateRegion(spec) {
    const gen = generateRegionGen(spec);
    let r = gen.next();
    while (!r.done) r = gen.next();
    return r.value;
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

// --- Sphere-driven growth driver ---
//
// The sphere-plan-first wave grower
// (NewDocs/plans/procedural-generation/sphere-driven-growth.md).
// Two phases:
//
//   buildSphereTree — pure bookkeeping: given the sphere plan, decide
//     every region up front (wave, items, entry gate, parent, side,
//     substrate). Wave 0 hosts sphere-1 items behind no gates; wave k
//     regions attach behind gates containing ≥1 sphere-k item (the
//     STRATIFICATION RULE that makes the plan an exact sphere-log
//     oracle); fillers carry no items. Because the whole tree is
//     decided before any geometry, every region is built ONCE with
//     all its exits known — this supersedes the plan doc's
//     stub-then-wall mechanism (no stubs needed; nothing is walled).
//
//   growSpheres — realise the tree in wave order on a Grid using the
//     same machinery as grid-growth (cell adjacency else teleporter,
//     back-exits, stitchGrid, wallOff). Maze regions realise gates
//     via placeFromRules (the top-down driver's requirement-targeted
//     path); zone-based substrates must expose generateZoneForSpecs.
//
// Gate composition is single-item in v1 (one sphere-k item per
// gate). Host selection respects substrate gate compatibility:
// adapter.gateableItems (when present) limits the gate vocabulary,
// and adapter.canHostExitGates(existingGates, newGate) lets a
// substrate veto structurally-unrealisable combinations (bounce's
// arrowless-exit rules). Gates are handed to substrates as term
// arrays [{ item, count }] — bounce realises non-ability (and
// count > 1) terms as authored bridge-evaluated locks rather than
// geometry (rule-gated portals/pickups), so any item can gate any
// substrate's exits.

// The tree build is split into three composable phases so the Procgen
// Pipeline panel can surface + edit it at the right altitude (②a/②b/②c).
// The split is byte-identity-preserving because of how the seeded rng is
// consumed: the fillerWaves draws happen UP FRONT (②a), the per-region
// substrate+wiring loop is rng-interleaved and incremental so it must stay
// fused (②b), and item round-robin consumes NO rng (②c — a pure final
// pass). buildSphereTree below re-composes them on one threaded rng, so the
// unedited pipeline reproduces the original single-pass output exactly.

/**
 * ②a — Allocate. Draw the up-front fillerWaves (the ONLY rng this phase
 * consumes) and compute the deterministic region count per wave. Leaves
 * rng advanced past the draws so ②b continues the same stream.
 * Returns { allocation: { regionsPerWave, fillersPerWave, fillerWaves }, rng }.
 * `fillerWaves` (raw draw order) is what ②b consumes; `fillersPerWave`
 * (per-wave aggregate) is the editor-facing view.
 */
export function allocateSphereTree(plan, opts = {}, rng) {
    const { maxItemsPerRegion = 2, fillerCount = 0 } = opts;
    const spheres = plan.spheres;
    const waves = spheres.length;
    // Region count per wave is deterministic: ceil(items / maxItemsPerRegion),
    // at least one (a wave must have somewhere to hang its items / children).
    const regionsPerWave = spheres.map(
        (s) => Math.max(1, Math.ceil(s.items.length / maxItemsPerRegion)));
    // Filler waves chosen up front so each wave knows its region count —
    // these draws must precede ②b's loop to keep the rng stream identical
    // to the original single-pass buildSphereTree.
    const fillerWaves = [];
    for (let i = 0; i < fillerCount; i++) {
        fillerWaves.push(Math.floor(rng.next() * waves));
    }
    // Per-wave aggregate (length = waves) for the allocation editor; ②b
    // still consumes fillerWaves (draw order) to preserve byte-identity.
    const fillersPerWave = regionsPerWave.map(() => 0);
    for (const fw of fillerWaves) fillersPerWave[fw] += 1;
    return { allocation: { regionsPerWave, fillersPerWave, fillerWaves }, rng };
}

/**
 * ②b — Topology. The interleaved per-region loop: substrate pick + host/gate
 * wiring + side assignment, consuming rng. Builds nodes WITHOUT items (those
 * come in ②c). Region N's host pick depends on regions 1..N-1's consumed
 * sides / childGates, so substrate and wiring CANNOT be separated without
 * reordering the shared rng stream — they stay fused here (substrate is still
 * editable in-place on the result). Returns
 * { nodes, substrateCounts, quotaFallbacks, rng }; nodes are in realisation
 * order (parents always precede children).
 *
 * Drives the wiring context over EVERY wave in order — byte-identical to the
 * prior single-function loop. The batched sphere-major driver instead drives
 * the context a batch of waves at a time (interleaving realisation), which is
 * why the per-wave step + state live in createSphereWiringContext.
 */
export function wireSphereTree(plan, allocation, opts = {}, rng) {
    const ctx = createSphereWiringContext(plan, allocation, opts, rng);
    for (let w = 0; w < plan.spheres.length; w++) ctx.wireWave(w);
    return {
        nodes: ctx.nodes,
        substrateCounts: ctx.substrateCounts,
        quotaFallbacks: ctx.quotaFallbacks(),
        rng,
    };
}

/**
 * Stateful wiring context for ②b. Holds the growing node set, substrate
 * tallies and the cumulative-count table, and exposes `wireWave(w)` to attach
 * sphere w's regions (plus the fillers assigned to wave w) onto the nodes
 * built so far. Region N's host pick depends on regions 1..N-1's consumed
 * sides, so the context persists across batches — nodes / substrateCounts /
 * quotaFallbacks accumulate, and the rng is the single shared stream the
 * realiser also draws from.
 */
function createSphereWiringContext(plan, allocation, opts = {}, rng) {
    const {
        revisitRatio = 0.25,
        substrateQuotas = null,
        startSubstrate = null,
        // World-level regionParams — passed to each host substrate's
        // structural hooks (backPortalGated / exitGateVeto / gateHostingHint)
        // so the grower's gate accounting matches what the substrate
        // realises, without the engine naming any substrate.
        regionParams = {},
    } = opts;
    const spheres = plan.spheres;
    const waves = spheres.length;
    const { regionsPerWave, fillerWaves } = allocation;

    // Cumulative instance counts per sphere: cumCounts[k] maps item →
    // number of instances in spheres 1..k+1. A wave-w gate on item X
    // must demand the cumulative count through sphere w (a plain
    // Has(X) would be satisfied by an EARLIER instance of X, opening
    // the region a sphere early — the duplicate-instance oracle
    // failure). Single-instance items keep count 1 == plain Has.
    const cumCounts = [];
    {
        const running = new Map();
        for (const s of spheres) {
            for (const item of s.items) {
                running.set(item, (running.get(item) ?? 0) + 1);
            }
            cumCounts.push(new Map(running));
        }
    }

    const substrateCounts = {};
    // Regions that defaulted to 'maze' because every quota was already
    // filled — the plan needs more regions than the quotas allow.
    // Surfaced so the UI can warn loudly (a silent maze region in a
    // bounce-only world reads as a bug).
    let quotaFallbacks = 0;
    const pickSub = (preferred = null) => {
        let sub = null;
        if (preferred && preferred !== 'auto') {
            const remaining = substrateQuotas
                ? (substrateQuotas[preferred] ?? 0) - (substrateCounts[preferred] || 0)
                : 1;
            if (remaining > 0) sub = preferred;
        }
        if (!sub && substrateQuotas) {
            sub = pickSubstrateWithQuota(substrateQuotas, substrateCounts, rng);
            if (!sub) quotaFallbacks += 1;
        }
        if (!sub) sub = 'maze';
        substrateCounts[sub] = (substrateCounts[sub] || 0) + 1;
        return sub;
    };

    const nodes = [];
    const addNode = ({ wave, gate, gateCounts = {}, parent, substrate, isFiller = false }) => {
        const node = {
            index: nodes.length,
            wave,
            gate,             // entry-gate item names ([] = ungated)
            gateCounts,       // item → required count (> 1 only for
                              // multi-instance items; emitted as
                              // Has(item, count) — the count gate)
            parent,           // parent node index (null for the root)
            side: null,       // side ON THE PARENT hosting this child
            substrate,
            items: [],        // [{ id, item }] location specs
            isFiller,
            childGates: [],
            usedSides: new Set(),
        };
        if (parent != null) {
            const host = nodes[parent];
            const free = SIDES.filter((s) => !host.usedSides.has(s));
            node.side = free[Math.floor(rng.next() * free.length)];
            host.usedSides.add(node.side);
            // childGates carry counts as [{ item, count }] terms so
            // substrate vetoes can tell physics gates (count 1
            // abilities) from authored locks.
            const gateTerms = gate.map((item) => ({
                item, count: gateCounts[item] ?? 1,
            }));
            host.childGates.push(gateTerms);
            node.usedSides.add(OPPOSITE_SIDE[node.side]);
            // The region's GUARANTEED BACK PORTAL is structurally a
            // gate it must realise (requirement = its entry gate: a
            // branch tip when that contains an arrow, the on-column
            // top otherwise). Seed it so canHostExitGates accounts
            // for it when child gates are assigned — e.g. an
            // arrowless-entered bounce region's top slot is taken,
            // so it can host no arrowless child gate. Inert for
            // substrates without the veto hook (maze walks back via
            // its entrance tile).
            //
            // EXCEPT when the substrate UNGATES its back portal (braid
            // bounce — see backPortalGated / generateRegionZoneGen): it
            // then occupies no gate slot, and counting it here would
            // falsely consume the region's one arrowless slot and abort
            // growth. Default (maze, column bounce): the back portal is a
            // gate, so seed it.
            const backGated = substrateRegistry.get(substrate)
                ?.backPortalGated?.(regionParams) ?? true;
            if (backGated) {
                node.childGates.push(gateTerms);
            }
        }
        nodes.push(node);
        return node;
    };

    const canHost = (host, gateTerms) => {
        if (host.usedSides.size >= 4) return false;
        const adapter = substrateRegistry.get(host.substrate);
        if (!adapter) return false;
        const gateable = adapter.gateableItems ?? null;
        // A substrate with a declared gate vocabulary can only realise
        // gates on those items. Bounce now declares null — authored
        // bridge-evaluated locks cover the full vocabulary including
        // count gates (rule-gated portals, priority #2); the check
        // remains for future fixed-zone substrates (e.g. JtA).
        if (gateable && gateTerms.some(({ item }) => !gateable.includes(item))) {
            return false;
        }
        // The substrate picks its structural gate-hosting veto from the
        // regionParams (bounce: a STRICTER nested-chain veto for braid,
        // the arrowless-top veto for column). Without the right veto the
        // grower composes regions the layout can't realise. Falls back to
        // a plain canHostExitGates when the substrate declares no selector.
        const veto = adapter.exitGateVeto?.(regionParams) ?? adapter.canHostExitGates;
        if (typeof veto === 'function'
                && !veto([...host.childGates], gateTerms)) {
            return false;
        }
        return true;
    };

    // Pick (host, gate) for a wave-w attachment. Wave 0 attaches
    // ungated to wave-0 hosts; wave k ≥ 1 gates on one sphere-k item.
    // revisitRatio steers toward older hosts (the "come back with the
    // new item" texture); the frontier pool falls back either way.
    // `gateWave` overrides which sphere supplies the gate items —
    // fillers carry no items, so wave-0 fillers gate on sphere-1
    // items instead of [] (an arrowless [] gate would fight the back
    // portal for the host's single arrowless slot on substrates like
    // bounce). The CHILD's substrate doesn't constrain the gate:
    // bounce realises any entry gate's back portal via authored
    // locks (anyone inside satisfies the entry gate by construction).
    const pickHostAndGate = (wave, { gateWave = wave } = {}) => {
        // Required count for a gate item at this gate's sphere: the
        // cumulative instance count through sphere gateWave (1 for
        // single-instance items — the common case).
        const cum = gateWave > 0 ? cumCounts[gateWave - 1] : null;
        const gateCount = (item) => cum?.get(item) ?? 1;
        const gateChoices = gateWave === 0
            ? [[]]
            : rng.shuffle([...new Set(spheres[gateWave - 1].items)]).map((item) => [item]);
        const eligible = nodes.filter((h) => h.usedSides.size < 4
            && (gateWave === 0 ? h.wave === 0 : true));
        const older = eligible.filter((h) => h.wave < wave - 1);
        const frontier = eligible.filter((h) => h.wave >= wave - 1);
        const useOlder = older.length > 0 && rng.next() < revisitRatio;
        const pools = useOlder ? [older, frontier] : [frontier, older];
        for (const pool of pools) {
            for (const host of rng.shuffle([...pool])) {
                for (const gate of gateChoices) {
                    const gateTerms = gate.map((item) => ({
                        item, count: gateCount(item),
                    }));
                    if (canHost(host, gateTerms)) {
                        return {
                            host,
                            gate,
                            gateCounts: Object.fromEntries(
                                gate.map((item) => [item, gateCount(item)])),
                        };
                    }
                }
            }
        }
        // Append each active substrate's gate-hosting guidance (the
        // realisable-gate constraints are the substrate's, not the
        // engine's).
        const hintIds = new Set([
            ...nodes.map((n) => n.substrate),
            ...(startSubstrate ? [startSubstrate] : []),
            ...Object.keys(substrateQuotas ?? {}),
        ]);
        const hints = [...new Set([...hintIds]
            .map((id) => substrateRegistry.get(id)?.gateHostingHint?.(regionParams))
            .filter(Boolean))];
        throw new Error(`growSpheres: no host can realise a wave-${wave} entry gate.`
            + (hints.length ? ` ${hints.join(' ')}` : ''));
    };

    // Attach sphere w's regions (then the fillers assigned to wave w) onto the
    // nodes built so far. Called per wave in order by wireSphereTree, or a
    // batch at a time by the batched driver — same body, same rng order.
    const wireWave = (w) => {
        const hostingRegions = regionsPerWave[w];
        for (let i = 0; i < hostingRegions; i++) {
            if (w === 0 && i === 0) {
                addNode({
                    wave: 0, gate: [], parent: null,
                    substrate: pickSub(startSubstrate),
                });
                continue;
            }
            const substrate = pickSub();
            const { host, gate, gateCounts } = pickHostAndGate(w);
            addNode({ wave: w, gate, gateCounts, parent: host.index, substrate });
        }
        // Fillers assigned to this wave attach like regular wave
        // regions but carry no items — so their gates are free to use
        // sphere-1 items even at wave 0 (no stratification impact).
        for (const fw of fillerWaves) {
            if (fw !== w) continue;
            const substrate = pickSub();
            const { host, gate, gateCounts } = pickHostAndGate(w, {
                gateWave: w === 0 && waves > 1 ? 1 : w,
            });
            addNode({ wave: w, gate, gateCounts, parent: host.index, substrate, isFiller: true });
        }
    };

    return { nodes, substrateCounts, wireWave, quotaFallbacks: () => quotaFallbacks };
}

/**
 * ②c — Item placement. Round-robin each sphere's items across that sphere's
 * hosting (non-filler) regions, in realisation order. Consumes NO rng, so
 * moving all item assignment to this final pass is byte-identical to the
 * original interleaved placement. Mutates `nodes[i].items` and returns nodes.
 */
export function placeSphereTreeItems(plan, nodes) {
    const spheres = plan.spheres;
    for (let w = 0; w < spheres.length; w++) {
        // The wave's hosting regions are its non-filler nodes, in insertion
        // order (== the original per-wave `waveNodes`). Fillers carry no items.
        const waveNodes = nodes.filter((n) => n.wave === w && !n.isFiller);
        if (waveNodes.length === 0) continue; // edited allocation: nowhere to host
        spheres[w].items.forEach((item, idx) => {
            const node = waveNodes[idx % waveNodes.length];
            node.items.push({ id: `loc_${node.items.length}`, item });
        });
    }
    return nodes;
}

/**
 * Decide the abstract region tree for a sphere plan. Pure given rng.
 * Returns { nodes, substrateCounts, quotaFallbacks }; nodes are in
 * realisation order (parents always precede children). Re-expressed as the
 * composition of the three editable phases on ONE threaded rng — the stepped
 * pipeline (②a→②b→②c, unedited) reproduces this exactly.
 */
export function buildSphereTree(plan, opts = {}, rng) {
    const { allocation } = allocateSphereTree(plan, opts, rng);
    const wired = wireSphereTree(plan, allocation, opts, rng);
    placeSphereTreeItems(plan, wired.nodes);
    return {
        nodes: wired.nodes,
        substrateCounts: wired.substrateCounts,
        quotaFallbacks: wired.quotaFallbacks,
    };
}

/**
 * Recompute a tree's DERIVED bookkeeping after a ②b topology edit (reparent
 * / substrate / gate). Given nodes whose parent/gate/substrate may have been
 * hand-edited, this re-derives each node's gateCounts, side, usedSides, and
 * childGates so the tree stays coherent for ③ — and collects advisory veto
 * warnings (the substrate's own gate-hosting rules + gate vocabulary).
 *
 * This is the EDITED path only: it assigns sides deterministically (first
 * free, no rng), unlike wireSphereTree's rng pick. The unedited stepped run
 * never calls this (it uses wireSphereTree → byte-identical). Assumes nodes
 * stay in realisation order (parent index < node index); the editor enforces
 * that by only offering earlier-index parents. Mutates and returns nodes.
 */
export function rebuildSphereTopology(plan, nodes, opts = {}) {
    const { regionParams = {} } = opts;
    // cumCounts[k] = item → cumulative instances through sphere k+1 (for the
    // count gate), same as wireSphereTree.
    const cumCounts = [];
    {
        const running = new Map();
        for (const s of plan.spheres) {
            for (const item of s.items) running.set(item, (running.get(item) ?? 0) + 1);
            cumCounts.push(new Map(running));
        }
    }
    // A node's gate lives in its own sphere (gateWave = node.wave); a wave-0
    // filler gates on sphere 1 (matching wireSphereTree's gateWave override).
    const gateWaveOf = (nd) => (nd.wave > 0 ? nd.wave : (nd.isFiller ? 1 : 0));
    const countFor = (item, gateWave) => (gateWave > 0
        ? (cumCounts[gateWave - 1]?.get(item) ?? 1) : 1);

    const substrateCounts = {};
    const warnings = [];
    for (const nd of nodes) {
        nd.usedSides = new Set();
        nd.childGates = [];
        if (nd.parent == null) nd.side = null;
        // Recompute gateCounts from the (possibly edited) gate + gateWave.
        const gw = gateWaveOf(nd);
        nd.gateCounts = Object.fromEntries((nd.gate ?? []).map((it) => [it, countFor(it, gw)]));
        substrateCounts[nd.substrate] = (substrateCounts[nd.substrate] || 0) + 1;
    }
    for (const nd of nodes) {
        if (nd.parent == null) continue;
        const host = nodes[nd.parent];
        if (!host) { warnings.push(`#${nd.index}: parent #${nd.parent} not found.`); continue; }
        const gateTerms = (nd.gate ?? []).map((item) => ({
            item, count: nd.gateCounts[item] ?? 1,
        }));
        // Advisory checks (NOT enforced) — mirror canHost in buildSphereTree.
        const adapter = substrateRegistry.get(host.substrate);
        const gateable = adapter?.gateableItems ?? null;
        if (gateable && gateTerms.some(({ item }) => !gateable.includes(item))) {
            warnings.push(`#${nd.index}: gate [${nd.gate.join(',')}] outside `
                + `#${host.index}'s (${host.substrate}) gate vocabulary.`);
        }
        const veto = adapter?.exitGateVeto?.(regionParams) ?? adapter?.canHostExitGates;
        if (typeof veto === 'function' && !veto([...host.childGates], gateTerms)) {
            warnings.push(`#${nd.index}: ${host.substrate} #${host.index} can't host `
                + `gate [${nd.gate.join(',') || '—'}] (substrate veto).`);
        }
        if (host.wave > nd.wave) {
            warnings.push(`#${nd.index} (wave ${nd.wave}) attaches to later wave `
                + `#${host.index} (wave ${host.wave}) — stratification broken.`);
        }
        // The entry gate should contain an item INTRODUCED at the gate's
        // sphere (the stratification rule that makes the plan a sphere-log
        // oracle). Flag a gate item that isn't a sphere-gateWave item.
        const gw = gateWaveOf(nd);
        if (gw > 0 && (nd.gate ?? []).length) {
            const sphereSet = new Set(plan.spheres[gw - 1]?.items ?? []);
            for (const it of nd.gate) {
                if (!sphereSet.has(it)) {
                    warnings.push(`#${nd.index}: gate item "${it}" isn't a sphere-${gw} `
                        + 'item — the oracle will mismatch.');
                }
            }
        }
        // Assign a side (first free; null = over the 4-side budget).
        const free = SIDES.filter((s) => !host.usedSides.has(s));
        if (free.length === 0) {
            nd.side = null;
            warnings.push(`#${host.index} has more than 4 children — #${nd.index} has no free side.`);
        } else {
            nd.side = free[0];
            host.usedSides.add(nd.side);
            nd.usedSides.add(OPPOSITE_SIDE[nd.side]);
        }
        host.childGates.push(gateTerms);
        const backGated = substrateRegistry.get(nd.substrate)?.backPortalGated?.(regionParams) ?? true;
        if (backGated) nd.childGates.push(gateTerms);
    }
    return { nodes, substrateCounts, warnings };
}

// Realise one tree node as a maze-style (procedural) region via the
// shared generateRegion contract. The composed per-exit gate rides as
// the exit's access_rule; locations default to True_ (the composed gate
// IS the rule — path-walk pollution must not leak in), and global_name
// is left to makeLocationName (sphere ids aren't AP-canonical names).
function buildSphereProceduralRegion({
    substrate, region_id, size, entrances, exitPlans, locations,
    itemLib, obstacleLib, rng, params, hazardOpts,
}) {
    return generateRegion({
        substrate,
        region_id,
        size,
        rng,
        params,
        biome: null,
        itemLib,
        obstacleLib,
        hazardOpts,
        entrances,
        exits: exitPlans.map((e) => ({
            side: e.side, ...(e.rule ? { access_rule: e.rule } : {}),
        })),
        locations: locations.map((l) => ({
            id: l.id, item: l.item, ...(l.rule ? { access_rule: l.rule } : {}),
        })),
        defaultLocationRuleToTrue: true,
    });
}

// Realise one tree node as a zone-based region via the substrate's
// generateZoneForSpecs hook (bounce; JtA later as a selection
// strategy). The driver's gates ride as requirement arrays (AP item
// names); the hook returns derived rules verified to match exactly.
//
// Every non-start region gets a GUARANTEED BACK PORTAL on its
// entrance side, gated on its own ENTRY gate (anyone inside holds
// those items): a branch tip when the gate contains an arrow, the
// on-column top otherwise (the slot canHostExitGates reserved during
// tree building). The portal rides only the payload (sidePortals +
// geometry): landing on it sends the entrance side, which the bridge
// resolves to the driver's back-exit — whose rules.json rule is the
// forward gate's copy, matching the portal's derived rule exactly.
// Routing never relies on falling; fall behavior is a per-world
// bounce parameter (regionParams.fallBehavior).
function* buildSphereZoneRegion({
    substrate, region_id, regionSize, exitPlans, locations,
    entranceSide, entryGate = [], entryGateCounts = {},
    regionParams = {}, seed,
}) {
    if (!entranceSide && exitPlans.length === 0) {
        throw new Error(`growSpheres: zone region '${region_id}' has neither `
            + 'children nor a parent — single-region zone worlds are not supported');
    }
    // The driver's gates are pre-split item-name requirement arrays; the
    // shared zone branch consumes them directly (no rule round-trip). The
    // entrance side rides as the guaranteed back-portal (requirement =
    // the entry gate). stampEntrance is left off so the serialized payload
    // stays byte-identical to the pre-unification assembleZoneRegion path
    // (sphere-growth's back-exit pass reads its own local entrance tile,
    // not getRegionEntrance).
    return yield* generateRegionGen({
        substrate,
        region_id,
        size: regionSize,
        params: regionParams,
        seed,
        exits: exitPlans.map((e) => ({
            side: e.side, requirement: e.gate, counts: e.gateCounts ?? {},
        })),
        locations: locations.map((l) => ({ id: l.id, item: l.item, requirement: [] })),
        entrances: entranceSide
            ? [{ side: entranceSide, requirement: entryGate, counts: entryGateCounts }]
            : [],
    });
}

// Count gates: a multi-instance gate item demands its cumulative count
// through the gate's sphere (makeHasRule emits args.count only when > 1, so
// single-instance gates stay plain Has).
function sphereGateRule(gate, gateCounts = {}) {
    return gate.length === 0
        ? null
        : makeAndRule(gate.map((item) => makeHasRule(item, gateCounts[item] ?? 1)));
}

/**
 * Build the realiser specs for ONE tree node — the per-child exit plans
 * (side + gate + composed rule), the entrance mirrored from the parent's
 * placed exit, and the location specs from the node's items. Pure (consumes
 * NO rng): exactly the computation growSpheresGen's realisation loop does per
 * node, factored out so a single region can be re-realised (re-roll / editor
 * save) without re-running the whole grow. Requires the node's cell/side to be
 * resolved (placement pre-pass) and the parent region already in the grid.
 *
 * Pass {childrenByParent, gateRule} from a caller that already has them (the
 * grow loop) to avoid rebuilding the children index per node; omit them for a
 * one-off single-node call (re-roll).
 */
function buildNodeRealiserSpecs(node, tree, grid, regionSize, deps = {}) {
    let { childrenByParent, gateRule } = deps;
    if (!childrenByParent) {
        childrenByParent = new Map();
        for (const n of tree.nodes) {
            if (n.parent == null) continue;
            if (!childrenByParent.has(n.parent)) childrenByParent.set(n.parent, []);
            childrenByParent.get(n.parent).push(n);
        }
    }
    if (!gateRule) gateRule = sphereGateRule;

    const parentNode = node.parent != null ? tree.nodes[node.parent] : null;
    const cell = node.cell;
    const region_id = regionIdForCell(cell);

    const exitPlans = (childrenByParent.get(node.index) ?? []).map((child) => ({
        side: child.side,
        gate: child.gate,
        gateCounts: child.gateCounts,
        rule: gateRule(child.gate, child.gateCounts),
    }));

    let entrances = [];
    let parentExitPlaced = null;
    let entranceSide = null;
    let entranceTile = null;
    if (parentNode) {
        const parentRegion = grid.getRegion(parentNode.cell);
        parentExitPlaced = parentRegion.exits_placed.find((e) => e.side === node.side);
        if (!parentExitPlaced) {
            throw new Error(`growSpheres: parent '${parentRegion.region_id}' has no `
                + `exit on side ${node.side} for '${region_id}'`);
        }
        entranceSide = OPPOSITE_SIDE[node.side];
        entranceTile = mirrorTileAcrossSide(
            parentExitPlaced.tile_position, node.side, regionSize);
        entrances = [{ side: entranceSide, tile: entranceTile }];
    }

    const locations = node.items.map((it) => ({ id: it.id, item: it.item, rule: null }));

    return {
        region_id, cell, parentNode, parentExitPlaced,
        exitPlans, entrances, entranceSide, entranceTile, locations,
    };
}

/**
 * Apply the parent back-exit that growSpheresGen adds after placeRegion (a
 * reciprocal exit on the entrance tile; buildRulesJson's post-pass copies the
 * forward gate's rule onto it). A re-realised region is fresh, so it must get
 * the same back-exit wired to the same parent exit. No-op for the root or when
 * bidirectional exits are disabled. Mutates `region` (and the parent's stored
 * world exit) in place.
 */
function applySphereBackExit(grid, node, specs, region, { assumeBidirectional = true } = {}) {
    if (!assumeBidirectional || !specs.parentNode) return;
    const parentRegion = grid.getRegion(specs.parentNode.cell);
    const backExitId = parentRegion.region_id;
    getRegionExits(region).set(backExitId, {
        exit_id: backExitId,
        x: specs.entranceTile.x,
        y: specs.entranceTile.y,
        side: specs.entranceSide,
        exitName: backExitId,
        targetRegion: parentRegion.region_id,
        targetExitId: specs.parentExitPlaced.exit_id,
        isBackExit: true,
        isTeleporter: node.isTeleporter,
    });
    region.extracted_rules.exits.push({
        id: backExitId,
        position: { x: specs.entranceTile.x, y: specs.entranceTile.y },
        target_region: parentRegion.region_id,
        paths: [{ path_id: 'p1', obstacles: [] }],
    });
    const parentWorldExit = getRegionExits(parentRegion)?.get(specs.parentExitPlaced.exit_id);
    if (parentWorldExit) parentWorldExit.targetExitId = backExitId;
}

/**
 * Re-roll ONE region's interior on a new seed, keeping its entrances, exits,
 * locations and access rules fixed (so neighbours don't desync). Zone
 * substrates only (bounce): exits are portals on sides, not positional, so the
 * re-roll is fully local. Procedural/maze re-roll is rejected — the exit tile
 * position feeds adjacency stitching, so a naive re-roll could move an exit off
 * the shared edge and break the link (use the editor instead). Replaces the
 * region in the grid in place and returns it.
 */
export function reRollSphereRegion(grid, node, tree, {
    seed, regionSize, regionParams = {}, assumeBidirectional = true,
} = {}) {
    if (!regionSize || !regionSize.width || !regionSize.height) {
        throw new Error('reRollSphereRegion: regionSize.{width,height} required');
    }
    const adapter = getAdapter(node.substrate);
    if (typeof adapter.generateRegionCore === 'function') {
        throw new Error(`reRollSphereRegion: substrate '${node.substrate}' is procedural `
            + '(maze) — re-roll is not supported yet (its exit tile positions feed '
            + 'adjacency stitching). Edit the region instead.');
    }
    if (typeof adapter.generateZoneForSpecs !== 'function'
            && typeof adapter.generateZoneForSpecsGen !== 'function') {
        throw new Error(`reRollSphereRegion: substrate '${node.substrate}' has no zone realiser`);
    }
    const specs = buildNodeRealiserSpecs(node, tree, grid, regionSize);
    const gen = buildSphereZoneRegion({
        substrate: node.substrate,
        region_id: specs.region_id,
        regionSize,
        exitPlans: specs.exitPlans,
        locations: specs.locations,
        entranceSide: specs.entranceSide,
        entryGate: node.gate,
        entryGateCounts: node.gateCounts,
        regionParams,
        seed,
        adapter,
    });
    let r = gen.next();
    while (!r.done) r = gen.next();
    const region = r.value;
    applySphereBackExit(grid, node, specs, region, { assumeBidirectional });
    grid.replaceRegion(specs.cell, region);
    // The re-realised region has FRESH exits with no grid-level wiring yet
    // (target_region is resolved by stitchGrid, not the realiser). Re-run the
    // same stitch + walls tail growSpheresGen runs so the new forward exits
    // resolve to their neighbours by side-adjacency — without it the region's
    // children go unreachable and the oracle breaks. stitchGrid leaves the
    // driver-managed back-exits (not in exits_placed) alone, and is idempotent
    // for the untouched regions (target_region is stable across a re-roll, as
    // exit sides are preserved).
    stitchGrid(grid);
    wallOffUnusedExits(grid);
    return grid.getRegion(specs.cell);
}

// Capture the grid's STITCHED forward links as position-independent triples
// {fromId, side, toId} (region_id + side + target region_id). Back-exits are
// skipped — they store their target directly and aren't re-stitched. Used to
// rebuild teleporters after a layout move/swap.
function captureForwardLinks(grid) {
    const links = [];
    for (const region of grid.allRegions()) {
        const exits = getRegionExits(region);
        const list = exits instanceof Map ? [...exits.values()] : (exits ?? []);
        for (const e of list) {
            if (e.isBackExit || !e.targetRegion || !e.side) continue;
            links.push({ fromId: region.region_id, side: e.side, toId: e.targetRegion });
        }
    }
    return links;
}

/**
 * Re-derive the grid's connections after a layout edit (move/swap). The logical
 * links (which region connects to which, on which side) are position-independent
 * (region_id + side), so we: capture them, drop all teleporters, then for each
 * link set a teleporter when the endpoints AREN'T geographically adjacent on
 * that side (adjacency resolves itself), and finally stitchGrid re-derives every
 * forward exit's target_region (teleporters take precedence over adjacency, so a
 * moved region's exit resolves to its intended target even if some other region
 * now sits next to it). Back-exits keep their stored targets untouched.
 */
export function relayoutSphereGrid(grid) {
    const links = captureForwardLinks(grid);
    grid.clearTeleporters();
    const cellOf = new Map(grid.allRegions().map((r) => [r.region_id, r.cell]));
    for (const { fromId, side, toId } of links) {
        const from = cellOf.get(fromId);
        const to = cellOf.get(toId);
        if (!from || !to) continue;
        const nb = grid.neighborCell(from, side);
        if (nb && nb.gx === to.gx && nb.gy === to.gy) continue; // adjacency resolves it
        grid.setTeleporter(from, side, to);
    }
    stitchGrid(grid);
    return grid;
}

/**
 * Move the region at `fromCell` to an EMPTY `toCell`, preserving all its
 * connections (rewired via relayoutSphereGrid). Geometry is untouched (sides
 * unchanged) — only the grid placement changes. Throws if fromCell is empty or
 * toCell is occupied.
 */
export function moveSphereRegion(grid, fromCell, toCell) {
    if (!grid.hasRegion(fromCell)) {
        throw new Error(`moveSphereRegion: no region at (${fromCell.gx},${fromCell.gy})`);
    }
    if (grid.hasRegion(toCell)) {
        throw new Error(`moveSphereRegion: target (${toCell.gx},${toCell.gy}) is occupied`);
    }
    if (!grid.isInBounds(toCell)) {
        throw new Error(`moveSphereRegion: target (${toCell.gx},${toCell.gy}) out of bounds`);
    }
    const region = grid.removeRegion(fromCell);
    grid.placeRegion(toCell, region);
    return relayoutSphereGrid(grid);
}

/**
 * Swap the two regions at `cellA` and `cellB`, preserving every connection
 * (rewired via relayoutSphereGrid). Geometry untouched. Throws if either cell
 * is empty.
 */
export function swapSphereRegions(grid, cellA, cellB) {
    if (!grid.hasRegion(cellA) || !grid.hasRegion(cellB)) {
        throw new Error('swapSphereRegions: both cells must hold a region');
    }
    const a = grid.removeRegion(cellA);
    const b = grid.removeRegion(cellB);
    grid.placeRegion(cellA, b);
    grid.placeRegion(cellB, a);
    return relayoutSphereGrid(grid);
}

// Midpoint tile of a region side (where a single exit on that side draws/sits),
// matching resolveExitTilePositions' even distribution for one exit.
function sideMidpointTile(side, regionSize) {
    const lastX = regionSize.width - 1;
    const lastY = regionSize.height - 1;
    const along = (span) => Math.max(0, Math.min(span - 1, Math.round(0.5 * (span - 1))));
    if (side === 'N') return { x: along(regionSize.width), y: 0 };
    if (side === 'S') return { x: along(regionSize.width), y: lastY };
    if (side === 'W') return { x: 0, y: along(regionSize.height) };
    return { x: lastX, y: along(regionSize.height) }; // E
}

// Relabel ONE exit to a new side: update its world-exit side + tile coords, its
// exits_placed entry (forward exits only), and its extracted_rules position so
// stitchGrid still matches it. Returns the exit's previous side. Does NOT touch
// sidePortals (the caller re-keys those) or re-stitch.
function relabelExitSide(region, exitId, newSide, regionSize) {
    const tile = sideMidpointTile(newSide, regionSize);
    const exits = getRegionExits(region);
    const we = exits instanceof Map ? exits.get(exitId)
        : (exits ?? []).find((e) => e.exit_id === exitId);
    const oldSide = we?.side ?? null;
    if (we) { we.side = newSide; we.x = tile.x; we.y = tile.y; }
    const placed = (region.exits_placed ?? []).find((p) => p.exit_id === exitId);
    if (placed) { placed.side = newSide; placed.tile_position = { x: tile.x, y: tile.y }; }
    const ex = (region.extracted_rules?.exits ?? []).find((e) => e.id === exitId);
    if (ex) ex.position = { x: tile.x, y: tile.y };
    return oldSide;
}

function regionSidePortals(region) {
    const sp = region?.playable_payload?.params?.sidePortals;
    if (!sp) {
        throw new Error('exit-side editing is only supported for zone substrates '
            + '(the region has no playable_payload.params.sidePortals)');
    }
    return sp;
}

// Grid side → on-screen portal arrow direction (mirrors bounceDemo's
// SIDE_DIRECTIONS). The arrow is cosmetic, but it should follow the side a
// portal now serves after an exit-side move/swap.
const SIDE_TO_DIRECTION = { N: 'up', S: 'down', E: 'right', W: 'left' };

// Point the bounce level portal now serving `side` in the matching direction.
// No-op for zone substrates without a bounceLevel/portals (e.g. JtA).
function applyPortalDirection(region, side) {
    const params = region?.playable_payload?.params;
    const portalId = params?.sidePortals?.[side];
    const portals = params?.bounceLevel?.portals;
    if (!portalId || !Array.isArray(portals)) return;
    const portal = portals.find((p) => p.id === portalId);
    if (portal) portal.direction = SIDE_TO_DIRECTION[side];
}

/**
 * Move one of a region's exits/entrances to an EMPTY side. For zone (bounce)
 * regions the exit's side is just the linking key (sidePortals[side] → the level
 * portal; the portal's geometry is independent), so this is a relabel: move the
 * exit + re-key sidePortals, then relayout (rebuild teleporters + re-stitch).
 * Geometry is untouched. Throws if the target side already has an exit.
 */
export function moveSphereExitSide(grid, regionCell, exitId, newSide, regionSize) {
    const region = grid.getRegion(regionCell);
    if (!region) throw new Error('moveSphereExitSide: no region at cell');
    const sidePortals = regionSidePortals(region);
    const exits = getRegionExits(region);
    const list = exits instanceof Map ? [...exits.values()] : (exits ?? []);
    if (list.some((e) => e.exit_id !== exitId && e.side === newSide)) {
        throw new Error(`moveSphereExitSide: side ${newSide} already has an exit`);
    }
    const oldSide = relabelExitSide(region, exitId, newSide, regionSize);
    if (oldSide && sidePortals[oldSide] !== undefined) {
        sidePortals[newSide] = sidePortals[oldSide];
        delete sidePortals[oldSide];
    }
    applyPortalDirection(region, newSide);
    return relayoutSphereGrid(grid);
}

/**
 * Swap the sides of two exits/entrances within one region (relabel both +
 * swap their sidePortals), then relayout. Geometry untouched.
 */
export function swapSphereExitSides(grid, regionCell, exitIdA, exitIdB, regionSize) {
    const region = grid.getRegion(regionCell);
    if (!region) throw new Error('swapSphereExitSides: no region at cell');
    const sidePortals = regionSidePortals(region);
    const exits = getRegionExits(region);
    const get = (id) => (exits instanceof Map ? exits.get(id)
        : (exits ?? []).find((e) => e.exit_id === id));
    const sideA = get(exitIdA)?.side;
    const sideB = get(exitIdB)?.side;
    if (!sideA || !sideB) throw new Error('swapSphereExitSides: exit not found');
    relabelExitSide(region, exitIdA, sideB, regionSize);
    relabelExitSide(region, exitIdB, sideA, regionSize);
    const t = sidePortals[sideA];
    sidePortals[sideA] = sidePortals[sideB];
    sidePortals[sideB] = t;
    applyPortalDirection(region, sideA);
    applyPortalDirection(region, sideB);
    return relayoutSphereGrid(grid);
}

/**
 * Reconstruct the realiser contract a zone (bounce) region was built with —
 * the same exit/location specs generateRegionZoneGen fed the substrate — so a
 * per-region editor can re-emit rules from a hand-edited level and stay
 * consistent with the logical tree. Mirrors generateRegionZoneGen's spec build:
 * forward exits carry each child's gate; the entrance side rides as the back
 * portal (ungated in braid, gated on the entry gate otherwise); locations carry
 * the node's items. Returns { exitSpecs, locationSpecs, physicsProfile, mode,
 * freeArrow, entranceSide } for assembleBounceRegionFromLevel.
 */
/**
 * Generic region-contract dispatcher: compute the engine's per-node realiser
 * specs (`buildNodeRealiserSpecs`, kept engine-internal) and hand them to the
 * substrate's `buildRegionContract` hook, which does the substrate-specific
 * shaping (exit/location specs, mode, free arrow, …). The engine never names a
 * substrate; the hook receives the specs so the substrate needs no engine
 * import. Used by the panel's Edit ▸ and the region-step verify scripts.
 */
export function buildRegionContract(substrateId, node, tree, grid, regionSize, regionParams = {}) {
    const adapter = substrateRegistry.get(substrateId);
    if (typeof adapter?.buildRegionContract !== 'function') {
        throw new Error(`buildRegionContract: substrate '${substrateId}' has no region-contract builder`);
    }
    const specs = buildNodeRealiserSpecs(node, tree, grid, regionSize);
    return adapter.buildRegionContract({ specs, node, regionParams });
}

/**
 * Sphere-driven growth: realise a sphere plan as a region graph.
 * Output shape matches growMaze ({ grid, stats, startCell }) so the
 * existing compile/emit tail consumes it unchanged; `tree` rides along
 * for tests and debugging.
 */

/**
 * Placement pre-pass — assign each node in `nodes[fromIndex..]` its final
 * cell + attachment side + isTeleporter flag BEFORE any region is built. The
 * parent's exit side is committed when the PARENT is built (from its
 * children's node.side), and the child's entrance is mirrored across that same
 * side — so the side must be settled before the parent's build iteration.
 * buildSphereTree picks each child's side blind to occupancy (no cells exist
 * yet); here we have the grid, so we PREFER a free side whose neighbor cell is
 * in-bounds and unoccupied, and fall back to a remote (teleporter) cell only
 * when EVERY open side is blocked (a region can be fully surrounded by
 * earlier-placed branches).
 *
 * The occupancy + reserved-side state of the already-placed prefix
 * `nodes[0..fromIndex)` is rebuilt from their committed cells/sides, so the
 * pass runs INCREMENTALLY per batch. With fromIndex=0 over an empty prefix it
 * reproduces the original single-pass loop exactly (same rng draw order) —
 * this is the seam batched growth reuses without drift.
 */
function placeSphereTreeCells(grid, nodes, rng, {
    startCell, teleporterMinGap, dims, fromIndex = 0,
}) {
    const occupiedKeys = new Set();
    const reservedSides = new Map(); // parent index -> Set of sides spoken for
    for (let i = 0; i < fromIndex; i++) {
        const nd = nodes[i];
        if (nd.cell) occupiedKeys.add(cellKey(nd.cell));
        if (nd.parent != null && nd.side != null) {
            if (!reservedSides.has(nd.parent)) reservedSides.set(nd.parent, new Set());
            reservedSides.get(nd.parent).add(nd.side);
        }
    }
    for (let i = fromIndex; i < nodes.length; i++) {
        const node = nodes[i];
        const parentNode = node.parent != null ? nodes[node.parent] : null;
        if (!parentNode) {
            node.cell = startCell;
            node.side = null;
            node.isTeleporter = false;
            occupiedKeys.add(cellKey(startCell));
            continue;
        }
        if (!reservedSides.has(parentNode.index)) {
            reservedSides.set(parentNode.index, new Set());
        }
        const hostReserved = reservedSides.get(parentNode.index);
        // The host's entrance side (toward its OWN parent) hosts no
        // child — that's where the host's back portal / parent sit.
        const entranceOnHost = parentNode.side != null
            ? OPPOSITE_SIDE[parentNode.side] : null;
        const freeSides = SIDES.filter(
            (s) => s !== entranceOnHost && !hostReserved.has(s));
        if (freeSides.length === 0) {
            // buildSphereTree caps children per host at the side budget
            // (canHost: usedSides.size < 4), so this is unreachable; guard
            // loudly rather than assign an undefined side.
            throw new Error(`growSpheres: host '${parentNode.index}' has no free `
                + 'side for a child — buildSphereTree side budget violated');
        }
        const openSides = freeSides.filter((s) => {
            const neighbor = grid.neighborCell(parentNode.cell, s);
            return neighbor && !occupiedKeys.has(cellKey(neighbor));
        });
        let side;
        let cell;
        let isTeleporter;
        if (openSides.length > 0) {
            side = openSides[Math.floor(rng.next() * openSides.length)];
            cell = grid.neighborCell(parentNode.cell, side);
            isTeleporter = false;
        } else {
            // Every open adjacent side is occupied/out-of-bounds: go
            // remote. Still consume a free side so the parent has an
            // exit to host the teleporter.
            side = freeSides[Math.floor(rng.next() * freeSides.length)];
            cell = findDisconnectedCellFromOccupied(
                occupiedKeys, dims, rng, teleporterMinGap);
            if (!cell) {
                throw new Error('growSpheres: no free cell for region — '
                    + 'pass larger growthParams.gridDims');
            }
            isTeleporter = true;
        }
        hostReserved.add(side);
        node.cell = cell;
        node.side = side;
        node.isTeleporter = isTeleporter;
        occupiedKeys.add(cellKey(cell));
    }
}

/**
 * Realiser loop — build + place the region for each node in
 * `nodes[fromIndex..]`, yielding region/regionDone progress events. The
 * per-node realiser specs (exit plans, entrance, locations) come from
 * buildNodeRealiserSpecs (the same factoring reRollSphereRegion uses), so a
 * node range can be realised onto an already-grown grid. fromIndex=0 over the
 * full node set reproduces growSpheresGen's original inline loop exactly.
 * `total` defaults to the current node count (the batched driver passes the
 * known FINAL total so progress reads sensibly across batches).
 */
function* realiseSphereNodes(grid, nodes, tree, rng, {
    fromIndex = 0, total = nodes.length,
    regionSize, itemLib, obstacleLib, regionParams, hazardOpts,
    assumeBidirectional, childrenByParent, stats,
}) {
    for (let i = fromIndex; i < nodes.length; i++) {
        const node = nodes[i];
        // Cell + side were resolved by the placement pre-pass
        // (occupancy-aware adjacency, remote only when fully surrounded).
        const isTeleporter = node.isTeleporter;
        const specs = buildNodeRealiserSpecs(node, tree, grid, regionSize, { childrenByParent });
        const {
            region_id, cell, parentNode, exitPlans, entrances, entranceSide, locations,
        } = specs;
        node.region_id = region_id;

        yield {
            type: 'region',
            index: node.index,
            total,
            region_id,
            substrate: node.substrate,
            sphere: node.wave,
            placements: locations.length,
        };

        const adapter = getAdapter(node.substrate);
        let region;
        if (typeof adapter.generateRegionCore === 'function') {
            region = buildSphereProceduralRegion({
                substrate: node.substrate,
                region_id,
                size: regionSize,
                entrances,
                exitPlans,
                locations,
                itemLib, obstacleLib, rng, params: regionParams, hazardOpts,
            });
        } else if (typeof adapter.generateZoneForSpecs === 'function'
                || typeof adapter.generateZoneForSpecsGen === 'function') {
            region = yield* buildSphereZoneRegion({
                substrate: node.substrate,
                region_id,
                regionSize,
                exitPlans,
                locations,
                entranceSide,
                entryGate: node.gate,
                entryGateCounts: node.gateCounts,
                regionParams,
                seed: (rng.next() * 0x7fffffff) | 0,
                adapter,
            });
        } else {
            throw new Error(`growSpheres: substrate '${node.substrate}' has neither `
                + 'generateRegionCore nor generateZoneForSpecs');
        }

        grid.placeRegion(cell, region);
        if (isTeleporter) {
            grid.setTeleporter(parentNode.cell, node.side, cell);
            stats.teleportersPlaced += 1;
        }

        // Back-exit to the parent on the entrance tile — buildRulesJson's
        // post-pass copies the forward gate's rule onto it.
        applySphereBackExit(grid, node, specs, region, { assumeBidirectional });
        stats.regionsBuilt += 1;
        yield {
            type: 'regionDone',
            index: node.index,
            total,
            region_id,
        };
    }
}

/**
 * Generator core of growSpheres: yields PROGRESS EVENTS between the
 * expensive steps and returns the result. Yields never touch the rng,
 * so draining synchronously (growSpheres) is byte-identical to the
 * pre-generator implementation; the panel drains asynchronously
 * (growSpheresAsync) so the UI can repaint between events.
 *
 * Event shapes:
 *   { type: 'plan', regions, spheres }            — tree decided
 *   { type: 'region', index, total, region_id,
 *     substrate, sphere, placements }             — region build starting
 *   { type: 'attempt', attempt, attempts }        — zone-substrate
 *     generate-and-test attempt (forwarded from the adapter's
 *     generateZoneForSpecsGen when it has one)
 *   { type: 'regionDone', index, total, region_id }
 *   { type: 'phase', name }                       — stitch/walls tail
 */
export function* growSpheresGen(config) {
    const {
        regionSize,
        itemLib = DEFAULT_ITEMS,
        obstacleLib = DEFAULT_OBSTACLES,
        seed = 1,
        regionParams = {},
        growthParams = {},
        hazardOpts = null,
    } = config;
    if (!regionSize || !regionSize.width || !regionSize.height) {
        throw new Error('growSpheres: regionSize.{width,height} required');
    }
    const {
        spherePlan,
        maxItemsPerRegion = 2,
        fillerCount = 0,
        revisitRatio = 0.25,
        substrateQuotas = null,
        startSubstrate = null,
        gridDims = null,
        teleporterMinGap = 2,
        assumeBidirectional = true,
    } = growthParams;
    if (!spherePlan) {
        throw new Error('growSpheres: growthParams.spherePlan required');
    }
    const planErrors = validateSpherePlan(spherePlan);
    if (planErrors.length > 0) {
        throw new Error(`growSpheres: invalid sphere plan — ${planErrors[0]}`);
    }
    // Upfront quota validation (same contract as the spiral): every
    // substrate must be registered and realisable by this driver —
    // procedurally (generateRegionCore) or via the sphere hook
    // (generateZoneForSpecs, landing with bounce in step 5).
    for (const [sub, count] of Object.entries(substrateQuotas ?? {})) {
        if (count <= 0) continue;
        const adapter = substrateRegistry.get(sub);
        if (!adapter) {
            throw new Error(`growSpheres: substrate '${sub}' is not registered`);
        }
        if (typeof adapter.generateRegionCore !== 'function'
                && typeof adapter.generateZoneForSpecs !== 'function') {
            throw new Error(`growSpheres: substrate '${sub}' has neither `
                + 'generateRegionCore nor generateZoneForSpecs — it cannot '
                + 'realise requirement-targeted regions');
        }
    }

    // The tree-build and region-build can run as SEPARATE pipeline steps:
    // when a pre-built tree (and its live rng — see buildSphereGrowthTree)
    // is injected, reuse them so the random stream stays continuous. The
    // all-in-one path (no prebuiltTree) builds the tree here on a fresh
    // rng exactly as before, so its output is byte-identical.
    const prebuilt = growthParams.prebuiltTree ?? null;
    const rng = prebuilt ? (growthParams.rng ?? createRng(seed)) : createRng(seed);
    const tree = prebuilt ?? buildSphereTree(spherePlan, {
        maxItemsPerRegion, fillerCount, revisitRatio, substrateQuotas, startSubstrate,
        regionParams,
    }, rng);
    yield {
        type: 'plan',
        regions: tree.nodes.length,
        spheres: spherePlan.spheres.length,
    };

    // Auto-size a grid with room for tree growth + teleporter targets.
    const side = Math.max(5, Math.ceil(Math.sqrt(tree.nodes.length)) * 2 + 1);
    const dims = gridDims ?? { width: side, height: side };
    const grid = new Grid(dims);
    const startCell = {
        gx: Math.floor(dims.width / 2),
        gy: Math.floor(dims.height / 2),
    };

    const stats = {
        regionsBuilt: 0,
        regionsSkipped: 0,
        teleportersPlaced: 0,
        stopReason: null,
        substrateCounts: tree.substrateCounts,
        quotaFallbacks: tree.quotaFallbacks,
    };

    const childrenByParent = new Map();
    for (const node of tree.nodes) {
        if (node.parent == null) continue;
        if (!childrenByParent.has(node.parent)) childrenByParent.set(node.parent, []);
        childrenByParent.get(node.parent).push(node);
    }

    // --- Placement pre-pass + realiser ---
    //
    // Both phases are extracted (placeSphereTreeCells / realiseSphereNodes)
    // so batched growth can reuse the SAME code over a node range; here the
    // full node set is placed then realised in one pass — byte-identical to
    // the prior inline loops.
    placeSphereTreeCells(grid, tree.nodes, rng, { startCell, teleporterMinGap, dims });
    yield* realiseSphereNodes(grid, tree.nodes, tree, rng, {
        regionSize, itemLib, obstacleLib, regionParams, hazardOpts,
        assumeBidirectional, childrenByParent, stats,
    });

    // Every exit was allocated to a specific child (or teleporter), so
    // stitching is purely confirmatory and nothing needs the
    // cross-branch reconcile pass — shortcuts can't exist by
    // construction, which is exactly what keeps the plan an exact
    // sphere oracle.
    yield { type: 'phase', name: 'stitch + walls' };
    stitchGrid(grid);
    wallOffUnusedExits(grid);
    stats.stopReason = 'plan_complete';

    return { grid, stats, startCell, tree };
}

/**
 * Sphere-driven growth, synchronous: drains growSpheresGen with no
 * pauses — byte-identical to the pre-generator implementation (yields
 * never touch the rng). All headless callers and tests use this.
 */
export function growSpheres(config) {
    const gen = growSpheresGen(config);
    let r = gen.next();
    while (!r.done) r = gen.next();
    return r.value;
}

/**
 * Sphere-driven growth, asynchronous: forwards each progress event to
 * `onProgress` and yields to the event loop between events so the UI
 * can repaint (the panel's Generate progress indicator). Identical
 * output to growSpheres.
 */
export async function growSpheresAsync(config, onProgress = null) {
    const gen = growSpheresGen(config);
    let r = gen.next();
    while (!r.done) {
        onProgress?.(r.value);
        await new Promise((resolve) => { setTimeout(resolve, 0); });
        r = gen.next();
    }
    return r.value;
}

// Extract the validated sphere plan + buildSphereTree opts from a
// growSpheres-shaped config, so the all-in-one tree build and the three
// stepped sub-phases set up identically (same defaults, same validation).
function sphereTreeSetup(config, label) {
    const { regionParams = {}, growthParams = {} } = config;
    const {
        spherePlan,
        maxItemsPerRegion = 2,
        fillerCount = 0,
        revisitRatio = 0.25,
        substrateQuotas = null,
        startSubstrate = null,
    } = growthParams;
    if (!spherePlan) {
        throw new Error(`${label}: growthParams.spherePlan required`);
    }
    const planErrors = validateSpherePlan(spherePlan);
    if (planErrors.length > 0) {
        throw new Error(`${label}: invalid sphere plan — ${planErrors[0]}`);
    }
    const opts = {
        maxItemsPerRegion, fillerCount, revisitRatio, substrateQuotas, startSubstrate,
        regionParams,
    };
    return { plan: spherePlan, opts };
}

/**
 * Build ONLY the region tree (step ② of stepped sphere growth) on a
 * fresh rng, returning the tree AND the live rng. Feed both back into
 * growSpheresGen via growthParams.{prebuiltTree, rng} for the region
 * build (step ③) so the random stream continues unbroken — the stepped
 * path is then byte-identical to the all-in-one growSpheres. Takes the
 * same config shape as growSpheresGen.
 */
export function buildSphereGrowthTree(config) {
    const { plan, opts } = sphereTreeSetup(config, 'buildSphereGrowthTree');
    const rng = createRng(config.seed ?? 1);
    const tree = buildSphereTree(plan, opts, rng);
    return { tree, rng };
}

/**
 * ②a stepped entry — validate the plan, create a fresh rng, and run the
 * Allocate phase. Returns { plan, opts, allocation, rng }; the panel stashes
 * plan/opts and feeds the (possibly edited) allocation into wireSphereTree
 * for ②b. Re-running this re-derives the rng from seed at the post-allocate
 * position (allocate's fillerWaves draws are a fixed count), so a downstream
 * sub-step can restart on the correct rng without snapshotting its state.
 */
export function buildSphereAllocation(config) {
    const { plan, opts } = sphereTreeSetup(config, 'buildSphereAllocation');
    const rng = createRng(config.seed ?? 1);
    const { allocation } = allocateSphereTree(plan, opts, rng);
    return { plan, opts, allocation, rng };
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
        // Re-attach the engine-owned structural fields (exits + entrance)
        // onto the payload just before serialize (Phase 4c). The descriptor
        // (region.exits / region.entrance) is canonical for ALL substrates;
        // serializeWorld still reads world.exits / world.entrance, so
        // merging here keeps the substrate signatures unchanged and the
        // emitted sidecar byte-identical (maze aliases its world; zone
        // payloads append exits then entrance in the same positions the
        // faked Map / stamped entrance used to occupy). Entrance is omitted
        // when undefined (sphere-growth zone regions) to match the prior
        // "never stamped" payload.
        const entrance = getRegionEntrance(region);
        const payloadForSerialize = {
            ...region.playable_payload,
            exits: getRegionExits(region),
            ...(entrance ? { entrance } : {}),
        };
        const playablePayload = adapter.serializeWorld(
            payloadForSerialize,
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
        // Item names whose canonical placement is ALWAYS locked
        // (compiled location gets locked:true → world_generator uses
        // place_locked_item). The sphere-growth bounce start passes
        // its start-stack arrow here so even multiworld fill keeps
        // the intro pickup an arrow.
        lockedCanonicalItems = [],
        // When set to an item name, overwrite the scaffold's default
        // constant-true completion_condition with an item_check on
        // this item (state.has(itemName) at runtime). Grid-growth
        // passes the scenario's victory item here so the generated
        // worldgen package satisfies AP's test_completion_condition.
        // Top-down leaves this null and inherits the scaffold default.
        completionConditionItem = null,
    } = opts;

    if (!startCell) throw new Error('buildRulesJson: startCell required');

    const compiled = compileRegionGraph(grid, {
        startCell, itemLib, obstacleLib, playerId,
        lockedItems: lockedCanonicalItems,
    });

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
                const worldExit = getRegionExits(region)?.get(exit.name);
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
