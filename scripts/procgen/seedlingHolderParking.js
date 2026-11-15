/**
 * ⛓ The block-stopper census's CORE (moved verbatim from `census-seedling-block-stoppers.mjs`, session tile-fire-breaks-rocks):
 * the bodies' cells, their kill verbs, whether they settle, the holder rooms' lock prices with and without a parked body,
 * and the cells a holder block can be pushed over. The census reads it (its output byte-identical across the move) and so
 * does the rules producer, which narrows a rock's Fire arm by the census's own holder verdict (`holderParkVerdicts`).
 * Nothing here imports the producer: the entity semantics a price reads are injected (`entitySemantics`).
 */
import { combatCensusOf } from '../../frontend/modules/seedlingDemo/levelWorld.js';
import { contactRect } from '../../frontend/modules/seedlingDemo/combat.js';
import { PUSHABLE_KINDS, blockPushSearch, blockHolderVerdict, blockHolderSearch } from '../../frontend/modules/flashPanel/seedlingBlockPaths.js';
import { deriveWeaponFootprint } from '../../frontend/modules/flashPanel/seedlingWeaponFootprints.js';
import { conditionKey, entityClaims, tileTypeForPlacement, SEEDLING_TILE_SIZE } from '../../frontend/modules/flashPanel/seedlingSemantics.js';

export const T = SEEDLING_TILE_SIZE;
export const BLOCKING = new Set(['wall', 'sink', 'manual']);
/** The walk-in push stances: the player directly behind the block (`PushableBlock.as:39-58`). */
export const WALK_IN_STANCES = Object.freeze({ N: [[0, -1]], E: [[1, 0]], S: [[0, 1]], W: [[-1, 0]] });
/** Tile types a body is removed on, by its `terrain` field (`combat.ENEMY_CLASSES`): Water 1, Pit 6, Lava 17. */
export const TERRAIN_TILE = { water: 1, pit: 6, lava: 17 };

export const xy = (i, width) => [i % width, (i - (i % width)) / width];
export const label = (e) => `${e.tag}@${e.x},${e.y}`;

/** The tiles a body's contact rect covers. */
export function bodyTiles(e, width) {
    const r = contactRect(e);
    const out = [];
    for (let y = Math.floor(r.y / T); y < Math.ceil(r.bottom / T); y += 1) {
        for (let x = Math.floor(r.x / T); x < Math.ceil(r.right / T); x += 1) out.push(y * width + x);
    }
    return out;
}

/** A mobile body's cells: a flood of the grid from its tiles over cells that are open to it. */
export function bodyRange(e, grid, tileTypes) {
    const { width, height, cells } = grid;
    const tiles = bodyTiles(e, width);
    if (!(e.row?.speed > 0)) return new Set(tiles);
    const lethal = new Set(Object.entries(TERRAIN_TILE).filter(([t]) => /dies|falls|refuses/.test(e.row?.terrain?.[t] ?? '')).map(([, v]) => v));
    const open = (i) => !BLOCKING.has(cells[i].kind) && (cells[i].conditions ?? []).length === 0 && !lethal.has(tileTypes.get(i));
    const seen = new Set(tiles);
    const stack = tiles.filter((i) => i >= 0 && i < cells.length && open(i));
    while (stack.length) {
        const i = stack.pop();
        const [x, y] = xy(i, width);
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const [nx, ny] = [x + dx, y + dy];
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const n = ny * width + nx;
            if (seen.has(n) || !open(n)) continue;
            seen.add(n);
            stack.push(n);
        }
    }
    return seen;
}

export function tileTypesOf(level, width) {
    const out = new Map();
    for (const layer of level.layers ?? []) {
        if (layer.name === 'cliffsides') continue;
        for (const placement of layer.tiles ?? []) {
            const t = tileTypeForPlacement(placement);
            if (t !== null) out.set(placement[1] * width + placement[0], t);
        }
    }
    return out;
}

/**
 * The push flags whose hit kills a body: `Enemy.hit` takes any attack type when `onlyHitBy` is "" (every class with a
 * `kill` row here) except "Fire" unless `hitByFire` (`Enemy.as:141-181`), and the player's hit verbs are the sword
 * press ("Sword", `Player.as:924`) and the spear thrust ("Spear", `Player.as:989`).
 */
export const KILL_FLAGS = Object.freeze(['hasSword', 'hasSpear']);
export const killFlagsOf = (e) => (e.row?.kill ? [...KILL_FLAGS] : []);

/**
 * Whether a body is rebuilt on every entry: unless its class's `removed()` writes its own tag (`sideWrite` 'own tag')
 * AND the instance has one (`tag >= 0`: `if (tag >= 0 && !Game.checkPersistence(tag))`, `SandTrap.as:44`,
 * `Spinner.as:50`), a kill lasts the visit.
 */
export const respawns = (e) => !(e.row?.sideWrite === 'own tag' && Number(e.attrs?.tag ?? -1) >= 0);
export const removal = (e) => (e.row?.kill ? `${e.row.kill.hits} hit(s)` : (e.row?.aggro?.kind === 'armed-by-proximity' ? 'self (armed by proximity)' : 'none by a hit'));

/**
 * A price (`entries(..).sets`: an OR of ANDs of condition keys) as a minimal DNF over ATOMS: an `any` condition is
 * expanded into its alternatives, an `all` into their product, and a conjunction that is a superset of another is
 * dropped. Two prices that read the same logically print the same.
 */
export function priceDnf(sets, byKey) {
    const alts = (c) => {
        if (c?.any) return c.any.flatMap(alts);
        if (c?.all) return c.all.reduce((acc, m) => acc.flatMap((a) => alts(m).map((b) => [...a, ...b])), [[]]);
        return [[conditionKey(c)]];
    };
    let out = [];
    for (const set of sets) {
        let conj = [[]];
        for (const k of set) {
            const c = byKey.get(k);
            const a = c ? alts(c) : [[k]];
            conj = conj.flatMap((x) => a.map((y) => [...x, ...y]));
        }
        out.push(...conj.map((x) => [...new Set(x)].sort()));
    }
    const sub = (a, b) => a.every((k) => b.includes(k));
    const uniq = [...new Map(out.map((x) => [x.join(' & '), x])).values()];
    return uniq.filter((x) => !uniq.some((y) => y !== x && sub(y, x))).map((x) => x.join(' & ')).sort();
}

/**
 * The room's re-closing locks, as the grid builder reads them (`buildSeedlingRegionGrid`'s `reclosing`), searched by
 * `blockHolderSearch` from every neighbour of every lock cell. `stoppers` in the search's shape. Returns
 * `{ '<lock> from x,y': dnf }`.
 */
export function holderPrices(level, grid, tileTypes, stoppers = [], { entitySemantics }) {
    const { width, height } = grid;
    const rec = [];
    for (const e of level.entities ?? []) {
        const sem = entitySemantics(e, level);
        if (sem?.opensFrom && sem.heldBy) rec.push({ e, tiles: entityClaims(e, sem, { pixelMaskFootprints: true }).map((c) => c.tile), opensFrom: sem.opensFrom, heldBy: sem.heldBy });
    }
    const closedCells = new Set(rec.flatMap((r) => r.tiles.map(([x, y]) => y * width + x)));
    const out = {};
    for (const r of rec) {
        const lockCells = new Set(r.tiles.map(([x, y]) => y * width + x));
        const search = blockHolderSearch(grid, {
            blocks: r.heldBy.blocks, fallers: r.heldBy.fallers ?? [], holders: r.opensFrom, lockCells, closedCells, tileTypes, keyOf: conditionKey, stoppers,
        });
        for (const li of lockCells) {
            const [x, y] = xy(li, width);
            for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                const [nx, ny] = [x + dx, y + dy];
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                const n = ny * width + nx;
                if (lockCells.has(n) || BLOCKING.has(grid.cells[n].kind)) continue;
                const { sets, refused } = search.entries(n);
                out[`${r.e.type}@${r.e.x},${r.e.y} from ${nx},${ny}`] = refused ? `refused: ${refused}` : priceDnf(sets, search.byKey);
            }
        }
    }
    return out;
}

/** Whether a body comes to rest: no chase and moving is a wall-bouncer (`Spinner.as:124-171`), which never does. */
export const settles = (e) => !(e.row?.aggro?.kind === 'none' && e.row?.speed > 0);

/**
 * A holder block's cells: the push search from each standable neighbour, every condition in the room held (an upper
 * bound), as the census prices a `holder` use. `block` is the pushable entity.
 */
export function holderBlockCells(grid, tileTypes, b) {
    const { width } = grid;
    const [bx, by] = [Math.floor(b.x / T), Math.floor(b.y / T)];
    const push = PUSHABLE_KINDS[b.type].push;
    const stances = push ? deriveWeaponFootprint(push.replace(/^has/, '').toLowerCase(), 'block') : WALK_IN_STANCES;
    const block = { tx: bx, ty: by, condition: push ? { flag: push } : null };
    const all = [...new Set(grid.cells.flatMap((cell) => (cell.conditions ?? []).map(conditionKey)))];
    if (push) all.push(conditionKey({ flag: push }));
    const cells = new Set();
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const [sx, sy] = [bx + dx, by + dy];
        if (sx < 0 || sy < 0 || sx >= width || sy >= grid.height) continue;
        const r = blockPushSearch(grid, { block, stances, tileTypes, keyOf: conditionKey, held: all }, sy * width + sx, null);
        for (const i of [...r.cells, ...r.fatal]) cells.add(i);
    }
    return cells;
}

/**
 * The census's HOLDER verdict for one decided holder room (`heldBy`, `buildBlockHolders`): per pushable block, per body
 * whose cells meet the block's (`bodies`: the room's unmodelled enemies), the lock prices as the rules run the search and
 * with the body PARKED FOR GOOD on the cells it meets (keyed by its kill verbs). `moved` = the entries it changes;
 * `holderVerdict` 'TIGHTER' when it moves one and settles. `null` when the room is not decided.
 */
export function holderParkVerdicts(level, { grid, tileTypes, heldBy, bodies, entitySemantics }) {
    const { width } = grid;
    const v = blockHolderVerdict({ width, height: grid.height, cells: grid.cells }, {
        heldBy, holders: [], lockCells: new Set(), closedCells: new Set(), tileTypes, keyOf: conditionKey,
    });
    if (!v.decided) return null;
    let basePrices = null;
    const rows = [];
    for (const b of (level.entities ?? []).filter((e) => PUSHABLE_KINDS[e.type])) {
        const cells = holderBlockCells(grid, tileTypes, b);
        for (const { e, range } of bodies) {
            const on = [...range].filter((i) => cells.has(i));
            if (on.length === 0) continue;
            basePrices ??= holderPrices(level, grid, tileTypes, [], { entitySemantics });
            const parkedPrices = holderPrices(level, grid, tileTypes,
                on.map((i) => ({ tx: xy(i, width)[0], ty: xy(i, width)[1], keys: killFlagsOf(e).map((f) => ({ flag: f })), label: label(e) })),
                { entitySemantics });
            const moved = Object.keys(basePrices).filter((k) => JSON.stringify(basePrices[k]) !== JSON.stringify(parkedPrices[k]))
                .map((k) => ({ entry: k, price: basePrices[k], parked: parkedPrices[k] }));
            const parked = moved.length ? 'tighter' : 'same';
            const still = settles(e);
            rows.push({ block: b, cells, body: label(e), e, on, prices: basePrices, parked, moved, settles: still,
                holderVerdict: parked === 'same' || !still ? 'ok' : 'TIGHTER' });
        }
    }
    return rows;
}

/**
 * The census's bodies for a holder room: its killable enemies (a body with no kill is the rules' modelled stopper, never
 * parked) with their cells, or none when the room has no pushable block (the census visits only rooms with one).
 */
export function holderRoomBodies(level, grid, tileTypes) {
    if (!(level.entities ?? []).some((e) => PUSHABLE_KINDS[e.type])) return [];
    return combatCensusOf(level).enemies.filter((e) => e.row?.kill).map((e) => ({ e, range: bodyRange(e, grid, tileTypes) }));
}
