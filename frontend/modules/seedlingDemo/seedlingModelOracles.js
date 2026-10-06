// ⛓ RULES logical-links — the PHYSICS MODEL's answers to the questions the
// tile transcription gives up on, as the analyzer's OPTIONAL oracles
// (`procgenPipeline/regionAtlasAnalyzer.js`, its contract: `manualCrossingVerdict`,
// `modelReach` and, since RULES burnable-trees, `tileSolid` — a door INSIDE an
// item-gated solid). All are about what is SOLID:
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

import { buildLevelWorld, rectsOverlap, TILE_SIZE } from './levelWorld.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { spawnFromBoot } from './playerPhysicsV1.js';

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
 * @returns {{ manualCrossingVerdict:Function, modelReach:Function, tileSolid:Function, sealedPocket:Function }}
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
        // RULES burnable-trees: no free pixel for the body on the tile, every
        // solid live, so a door there is used only once its solid is gone.
        tileSolid: ({ tile }) => tileSolidInModel(tile),
        // ⛓ RULES obstacle-events — THE DOOR'S OWN POCKET. A door the analyzer binds only through
        // material it cannot price (a building's sprite rect) is asked here what the model says: the
        // box's flood from the door (from beside it when the tile has no free pixel, as `modelReach`),
        // never entering gated material. When that pocket reaches no component (`inComponent`) and
        // every gated cell on its border is SOLID in the model, the door is used only once one of
        // those solids is gone: the answer is their conditions, one entry per border cell. Water is
        // not solid, so a pocket left through water answers null (nothing is necessary).
        // L0's door to L1 stands in the house's doorway with breakablerock@80,112 as its only way out.
        sealedPocket: ({ tile, enterable, inComponent }) => {
            const [tx, ty] = tile;
            let pocket = flood([tile], enterable);
            if (pocket.length === 0) {
                pocket = flood([[tx, ty - 1], [tx - 1, ty], [tx + 1, ty], [tx, ty + 1]]
                    .filter(([x, y]) => enterable(x, y)), enterable);
            }
            if (pocket.some((t) => inComponent(t))) return null;
            const inPocket = new Set(pocket.map(([x, y]) => `${x},${y}`));
            const border = new Map();
            for (const [x, y] of [tile, ...pocket]) {
                for (const n of [[x, y - 1], [x - 1, y], [x + 1, y], [x, y + 1]]) {
                    const k = `${n[0]},${n[1]}`;
                    if (inPocket.has(k) || border.has(k)) continue;
                    const gx = n[0] - ox;
                    const gy = n[1] - oy;
                    if (gx < 0 || gy < 0 || gx >= grid.width || gy >= grid.height) continue;
                    const c = grid.cells[gy * grid.width + gx];
                    if ((c?.conditions?.length ?? 0) === 0) continue;
                    if (!tileSolidInModel(n)) return null;
                    border.set(k, { tile: n, conditions: c.conditions });
                }
            }
            return border.size === 0 ? null : [...border.values()];
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

// ⛓ RULES arrival-spawns — WHERE AN ARRIVAL MAY STAND (solver-walk S5's census:
// the region binding's `entrance_spawn` fallback stood the player inside L34's
// magical lock, over L43's and L100's pits, and on L58's dead door).

/**
 * Why the model cannot boot the player at the OEL spawn `(x, y)` (the
 * `new Game(level, x, y)` argument; the Player adds the half-tile offset), or
 * null when it can. Three refusals, each the model's own reading:
 *   - the player's box is inside a SOLID (`collidesSolid`, every solid live):
 *     the player cannot move;
 *   - the probe point stands on a PIT tile: every boot falls;
 *   - the box is on a door that is not LIVE (`deactivated`): a door cell the
 *     game never lands anyone on, and no crossing starts there.
 * A live door is NOT a refusal: an arrival latched on it steps off and back on
 * (S5's walker), and the game's own stairs do land there (L3, L37, L87).
 */
export function arrivalStandRefusal(level, x, y) {
    const world = modelWorldOf(level);
    const at = spawnFromBoot({ x, y });
    const box = playerBoxAt(at.x, at.y);
    const solid = world.collidesSolid(box, {});
    if (solid) return `inside a solid (${solid.cls?.as3 ?? solid.tag ?? solid.blocker?.cls?.as3 ?? solid.kind})`;
    const tx = Math.floor(at.x / TILE_SIZE);
    const ty = Math.floor((at.y + 1) / TILE_SIZE);
    if (world.pitTiles.some((t) => t.tx === tx && t.ty === ty)) return `over a pit at tile (${tx}, ${ty})`;
    const dead = world.teleporters.find((tp) => tp.deactivated && rectsOverlap(box, tp.rect));
    if (dead) return `on a door that is not live (the teleporter at (${dead.x}, ${dead.y}), tag ${dead.tag})`;
    return null;
}

/** How far (4-connected tiles) from an exit's tiles its approach cell may be. */
export const APPROACH_RING_LIMIT = 2;

/**
 * The arrival spawn (OEL pixels) for one atlas exit. A LANDING (the arrival
 * end of a one-way connection) is the game's own `playerx/playery` (or a
 * pit's landing arithmetic) and is kept as it is, even where the model has a
 * solid there: the game put it there (L12's magical lock from L83, L113's
 * final door from L115 — the lock is the far side of the door you came
 * through). A DEPARTURE door's entrance is the door tile, so in this order:
 * the door tile, ONLY where a game link lands on it (`landedOn`: L3's pocket
 * door from L11, L87's from L88 — ⚖ user 2026-10-04) and the model can stand
 * there; else the GAME's
 * own arrival at this door (`returnSpawn`, the reverse link's
 * `playerx/playery` — `seedlingReturnSpawns`; trusted as game data, like a
 * landing); else the door's APPROACH cell —
 * the nearest ring of tiles around the exit (≤ `APPROACH_RING_LIMIT`), nearest the entrance tile first, that the
 * model can stand on and `inComponent` accepts (the generated rooms' rule: the
 * cell you step into the door from). None → REFUSED by name.
 *
 * @param {object} level the map document's level record
 * @param {object} exit the atlas exit (`exit_id`, `exit_tiles`, `entrance_tile`)
 * @param {{x:number, y:number}} entranceSpawn the exit's `entrance_tile` in pixels
 * @param {object} [opts]
 * @param {boolean} [opts.landing] the exit is a connection's landing end
 * @param {boolean} [opts.landedOn] a game link lands on this door's tile
 * @param {{x:number, y:number}|null} [opts.returnSpawn]
 * @param {(tile:number[]) => boolean} [opts.inComponent] the approach cell's region test
 * @returns {{x:number, y:number, via:'landing'|'entrance'|'return-link'|'approach', why?:string}}
 */
export function seedlingArrivalSpawn(level, exit, entranceSpawn, {
    landing = false, landedOn = false, returnSpawn = null, inComponent = () => true, tileSize = TILE_SIZE,
} = {}) {
    if (landing) return { x: entranceSpawn.x, y: entranceSpawn.y, via: 'landing' };
    const why = arrivalStandRefusal(level, entranceSpawn.x, entranceSpawn.y)
        ?? (landedOn ? null : 'a door tile no game link lands on');
    if (why === null) return { x: entranceSpawn.x, y: entranceSpawn.y, via: 'entrance' };
    // The reverse link's landing is the game's own point, trusted like a landing (L0's (288,176) stands in a
    // model solid, as the binding's return table already lands it).
    if (returnSpawn) {
        return { x: returnSpawn.x, y: returnSpawn.y, via: 'return-link', why };
    }
    // Rings outward from the exit's own tiles (a pit field's inner pit has only pits beside it), nearest the
    // entrance tile first within a ring, at most APPROACH_RING_LIMIT rings.
    const seen = new Set(exit.exit_tiles.map(([tx, ty]) => `${tx},${ty}`));
    const [ex, ey] = exit.entrance_tile;
    let ring = exit.exit_tiles.map(([tx, ty]) => [tx, ty]);
    for (let depth = 1; depth <= APPROACH_RING_LIMIT && ring.length > 0; depth += 1) {
        const next = [];
        for (const [tx, ty] of ring) {
            for (const [nx, ny] of [[tx, ty - 1], [tx - 1, ty], [tx + 1, ty], [tx, ty + 1]]) {
                if (nx < 0 || ny < 0 || nx >= level.width || ny >= level.height || seen.has(`${nx},${ny}`)) continue;
                seen.add(`${nx},${ny}`);
                next.push([nx, ny]);
            }
        }
        next.sort((a, b) => (((a[0] - ex) ** 2 + (a[1] - ey) ** 2) - ((b[0] - ex) ** 2 + (b[1] - ey) ** 2))
            || (a[1] - b[1]) || (a[0] - b[0]));
        for (const [tx, ty] of next) {
            if (!inComponent([tx, ty])) continue;
            if (arrivalStandRefusal(level, tx * tileSize, ty * tileSize) !== null) continue;
            return { x: tx * tileSize, y: ty * tileSize, via: 'approach', why };
        }
        ring = next;
    }
    throw new Error(`level ${level.level}: exit "${exit.exit_id}" has no arrival spawn the game could put the player on `
        + `— its entrance (${entranceSpawn.x}, ${entranceSpawn.y}) is ${why}`
        + ', no reverse link lands beside it'
        + `, and no cell within ${APPROACH_RING_LIMIT} tiles of it is standable in its own component`);
}
