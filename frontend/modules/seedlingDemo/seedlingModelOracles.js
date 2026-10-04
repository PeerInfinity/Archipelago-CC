// ⛓ RULES logical-links — the PHYSICS MODEL's answers to the two questions the
// tile transcription gives up on, as the analyzer's two OPTIONAL oracles
// (`procgenPipeline/regionAtlasAnalyzer.js`, its contract: `manualCrossingVerdict`
// and `modelReach`). Both are about what is SOLID:
//   - a crossing whose only way runs through a building's sprite rect (`manual`:
//     the per-pixel outline is not transcribed). It used to ship OPEN as a
//     "NEEDS A HAND-WRITTEN RULE" True_ row — L0's `r8c0 <-> r1c6` among them
//     (the house's outline and the row-7 poles wall r1c6 off; walk-plan §5.17);
//   - an exit tile NO component reaches through the crossing material, which
//     used to bind to no component and be bucketed into the first sub-region.
// The answer is a 1-PIXEL flood of the player's own box through
// `levelWorld.collidesSolid`, every solid live (a cell-centre flood is the tile
// coarsening the playthrough generator's `--masks` measured sealing the Owl's
// Nest). It never enters gated material: the analyzer owns what a crossing COSTS.
//
// Lifted out of `make-seedling-playthrough-rules.mjs` so every Seedling atlas
// producer asks the SAME model the same way (the starter atlas, the playthrough,
// and the re-analysers that must reproduce them). ⛓ The firewall's allowed
// direction (§6.3): an atlas producer reads the model; the model reads nothing back.

import { buildLevelWorld, TILE_SIZE } from './levelWorld.js';
import { playerBoxAt } from './playerPhysicsV2.js';

// One model world per level DOCUMENT (a caller that rewrites a level gets a new
// object, so a fresh world).
const modelWorlds = new WeakMap();
const modelWorldOf = (level) => {
    if (!modelWorlds.has(level)) modelWorlds.set(level, buildLevelWorld(level));
    return modelWorlds.get(level);
};

/**
 * The tiles the player's box can reach from `seeds` (atlas tiles), entering a
 * tile only when `enterable(tx, ty)`, in first-reach order (pixel distance).
 * Every free pixel position of a seed tile is a start.
 */
export function modelFloodTiles(level, seeds, enterable, { tileSize = TILE_SIZE } = {}) {
    const TILE = tileSize;
    const world = modelWorldOf(level);
    const W = level.width * TILE;
    const H = level.height * TILE;
    const freeAt = (x, y) => world.collidesSolid(playerBoxAt(x, y), {}) === null;
    const seen = new Uint8Array(W * H);
    const queue = [];
    for (const [tx, ty] of seeds) {
        for (let y = ty * TILE; y < (ty + 1) * TILE; y += 1) {
            for (let x = tx * TILE; x < (tx + 1) * TILE; x += 1) {
                if (x < 0 || y < 0 || x >= W || y >= H || seen[y * W + x] || !freeAt(x, y)) continue;
                seen[y * W + x] = 1;
                queue.push(y * W + x);
            }
        }
    }
    const order = [];
    const reached = new Set();
    for (let head = 0; head < queue.length; head += 1) {
        const at = queue[head];
        const x = at % W;
        const y = (at - x) / W;
        const tk = `${Math.floor(x / TILE)},${Math.floor(y / TILE)}`;
        if (!reached.has(tk)) { reached.add(tk); order.push([Math.floor(x / TILE), Math.floor(y / TILE)]); }
        for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx]) continue;
            const ntx = Math.floor(nx / TILE);
            const nty = Math.floor(ny / TILE);
            if ((ntx !== Math.floor(x / TILE) || nty !== Math.floor(y / TILE)) && !enterable(ntx, nty)) continue;
            seen[ny * W + nx] = 1;
            if (!freeAt(nx, ny)) continue;
            queue.push(ny * W + nx);
        }
    }
    return order;
}

/**
 * The analyzer's two model oracles for ONE level and the grid the analyzer is
 * running on (atlas tiles = grid cell + `grid.origin`).
 *
 * @returns {{ manualCrossingVerdict:Function, modelReach:Function }}
 */
export function seedlingModelOracles(level, grid, { tileSize = TILE_SIZE } = {}) {
    const flood = (seeds, enterable) => modelFloodTiles(level, seeds, enterable, { tileSize });
    /** True when no pixel position in the tile is free for the player's box. */
    const tileSolidInModel = ([tx, ty]) => flood([[tx, ty]], () => false).length === 0;
    const ox = grid.origin?.x ?? 0;
    const oy = grid.origin?.y ?? 0;
    const charged = ([ax, ay]) => {
        const gx = ax - ox;
        const gy = ay - oy;
        if (gx < 0 || gy < 0 || gx >= grid.width || gy >= grid.height) return false;
        const c = grid.cells[gy * grid.width + gx];
        return c && c.kind !== 'manual' && c.kind !== 'open'
            && ((c.conditions?.length ?? 0) > 0 || Object.keys(c.dirs ?? {}).length > 0
                || Object.keys(c.faces ?? {}).length > 0 || Object.keys(c.enter ?? {}).length > 0);
    };
    return {
        // One way of a manual crossing: can the player's box get from `from` to
        // `to` inside the building's cells and that way's own corridor? The
        // corridor's gated cells are walked as the model has them (water is not
        // solid); a corridor through a gated SOLID (a rock an item breaks) gets
        // NO verdict, since every solid is live here and the item is the point.
        manualCrossingVerdict: ({ from, to, via, corridor }) => {
            if (corridor.some((t) => charged(t) && tileSolidInModel(t))) return undefined;
            const key = (t) => `${t[0]},${t[1]}`;
            const allowed = new Set([...from, ...to, ...via, ...corridor].map(key));
            const target = new Set(to.map(key));
            const reached = flood(from, (tx, ty) => allowed.has(`${tx},${ty}`));
            return reached.some((t) => target.has(key(t)));
        },
        // A tile with no free pixel (an NPC, a door drawn on a wall) is used
        // from BESIDE it, so the flood then starts from its enterable neighbours.
        modelReach: ({ tile, enterable }) => {
            const own = flood([tile], enterable);
            if (own.length > 0) return own;
            const [tx, ty] = tile;
            const beside = [[tx, ty - 1], [tx - 1, ty], [tx + 1, ty], [tx, ty + 1]].filter(([x, y]) => enterable(x, y));
            return flood(beside, enterable);
        },
    };
}

/**
 * ⛔ REFUSED BY NAME, NOT BUCKETED (RULES logical-links): an exit or location that
 * binds to NO component, in a region that is still SPLIT (after any pruning),
 * would sit in whichever sub-region `applyRegionAnalysis` put first — a route no
 * player walks. An unsplit region has no sub-region to be wrong about (L50/L52's
 * swim-only doors), so it passes.
 */
export function refuseUnboundMembers(region, unbound) {
    if (!region?.subgraph || unbound.length === 0) return;
    throw new Error(`${region.region_id} is split into sub-regions, and `
        + `${unbound.map((b) => `${b.kind} "${b.id}" at [${b.tile}]`).join(', ')} binds to NO walkable component `
        + '(neither the crossing material nor the physics model reaches one) — it would be bucketed into the first '
        + 'sub-region, a route no player walks');
}
