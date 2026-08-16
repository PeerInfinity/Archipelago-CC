/**
 * seedlingDemo/procgenLevel — THE PoC's LEVEL MODEL, in the atlas's own
 * vocabulary.
 *
 * Seedling PROCGEN PoC arc, slice 1 (kickoff §3.2's "level model" injection,
 * `NewDocs/plans/seedling-procgen-poc-kickoff.md`). A generated level is an
 * **atlas level RECORD** — the same plain JSON `levelSourceFromAtlas` already
 * hands `buildLevelWorld` — and nothing else. ⚖ Kickoff §2: a second spelling
 * (an `.oel`, a "simpler" grid format) would be a second level language for
 * one engine, and the two would agree until somebody edited one.
 *
 * ── WHY THE COLUMNS ARE DECLARED AND THEN CHECKED ─────────────────────
 *
 * The generator writes terrain by choosing a tileset COLUMN, because that is
 * the only thing the game reads: `Game.as`'s 45-case switch is
 * `Math.floor(o.@tx / Tile.w)` and `levelWorld` transcribes it as
 * `TILE_COLUMN_TO_TYPE[column]`. A column is therefore a coordinate in a
 * table, not a name — write 4 where you meant 3 and you get Brick where you
 * wanted Stone, silently, and every downstream claim ("the border is solid")
 * is about a room nobody built.
 *
 * So each terrain in `TERRAIN` carries BOTH its column and the tile type it
 * claims that column builds, `assertTerrainColumns()` checks the pair against
 * `TILE_COLUMN_TO_TYPE` — the same table the engine reads — and
 * `procgenLevel.test.js` goes one step further and checks each one against a
 * BUILT WORLD: a wall must join `world.solids`, water must land in
 * `lethalTerrainTiles`, a pit in `pitTiles`, ground in `walkableTiles`. A
 * hand-written "column 3 is a wall" is exactly the kind of assertion that
 * survives being wrong.
 *
 * ⚠ **A TILE ENTRY IS `[tx, ty, txPixel, tyPixel]`, NOT `[tx, ty, col, row]`**
 * — measured against the committed extract, and the difference is a factor of
 * `TILE_SIZE`. The third element is the tileset's PIXEL x (48 for column 3),
 * and `levelWorld` divides it back down; the fourth is the pixel y, which the
 * builder destructures away (every placement in the extract has 0). `tileEntry`
 * is the one place that multiplication is written.
 *
 * ── SINGLE-SCREEN MEANS 10x10, MEASURED ───────────────────────────────
 *
 * ⚖ Kickoff §1.5 rules v1 single-screen so the CAMERA BAND family stays out
 * of the PoC. That is a size, not a wish: `camera.SCREEN_W/H` are 160x160
 * (`Main.as:36`), so ten tiles square is exactly one screen — and
 * `cameraFor`'s clamp is `world.width < SCREEN_W ? … : min(max(x, 0), width -
 * SCREEN_W)`, which at equality pins the camera at 0 for the whole run. It is
 * also the atlas's own most common level size (11 of 116). `SINGLE_SCREEN_TILES`
 * is derived from `SCREEN_W`, never typed as 10.
 *
 * ⛔ NO NODE IMPORTS, EVER — `atlasSource.js`'s docblock is the law and the
 * reason: this module is on the GENERATE arm's path in the browser, and one
 * `node:fs` anywhere in the graph makes the whole graph unloadable there.
 */

import { SCREEN_W, SCREEN_H } from './camera.js';
import { TILE_SIZE } from './levelWorld.js';
import { TILE_COLUMN_TO_TYPE, TILE_TYPE_NAMES } from '../flashPanel/seedlingSemantics.js';

export class ProcgenLevelError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProcgenLevelError';
    }
}

const fail = (message) => { throw new ProcgenLevelError(message); };

/** One screen, in tiles — 160/16. Derived, because the claim is geometric. */
export const SINGLE_SCREEN_TILES = Object.freeze({
    width: SCREEN_W / TILE_SIZE,
    height: SCREEN_H / TILE_SIZE,
});

/**
 * THE PoC's TERRAIN VOCABULARY — four terrains, each a (column, type) pair.
 *
 * `type` is the CLAIM and `column` is the write; `assertTerrainColumns()`
 * checks them against `TILE_COLUMN_TO_TYPE`. The two that v1's palette does
 * not place yet (water, pit) are fixed and verified NOW rather than when
 * slice 2 wants them, because "which column is a pit" is a fact about the
 * game and finding it out costs the same today as tomorrow.
 *
 * ⚠ THE COLUMN CHOICE IS COSMETIC WHERE A TYPE HAS TWO. Columns 0 and 1 both
 * build type 0 (Ground) and differ only in `TILE_COLUMN_VARIANTS[0].grass`;
 * the flag changes no collision (`seedlingSemantics`' own note). Column 0 is
 * taken because it is the one the variants table names, so the room's
 * appearance is a declared fact rather than a default nobody wrote down.
 *
 * ⚠ AND THE TYPES ARE ALL MODELLED. Every entry is in
 * `levelWorld.MODELLED_TILE_TYPES` — `assertTerrainColumns` does not check
 * that (the list is not exported as a Set and membership is the engine's
 * business), but `procgenLevel.test.js` does, because a generated room that
 * strays onto unmodelled terrain dies inside `buildLevelWorld` with a message
 * about the GAME rather than about the generator.
 */
export const TERRAIN = Object.freeze({
    ground: Object.freeze({ name: 'ground', column: 0, type: 0 }),
    wall: Object.freeze({ name: 'wall', column: 3, type: 2 }),
    water: Object.freeze({ name: 'water', column: 2, type: 1 }),
    pit: Object.freeze({ name: 'pit', column: 7, type: 6 }),
});

export const TERRAIN_NAMES = Object.freeze(Object.keys(TERRAIN));

/**
 * Every declared (column, type) pair, against the engine's own table.
 *
 * Called at module load — a wrong column is a defect in THIS file and there
 * is no run in which it should be allowed to reach a level record.
 */
export function assertTerrainColumns() {
    for (const t of Object.values(TERRAIN)) {
        const built = TILE_COLUMN_TO_TYPE[t.column];
        if (built !== t.type) {
            fail(`procgenLevel: TERRAIN.${t.name} declares column ${t.column} builds tile `
                + `type ${t.type} (${TILE_TYPE_NAMES[t.type]}), and TILE_COLUMN_TO_TYPE `
                + `says it builds ${built} (${TILE_TYPE_NAMES[built] ?? 'nothing at all'}). `
                + 'The table is the game\'s 45-case switch as data; this file is wrong.');
        }
    }
    return true;
}

assertTerrainColumns();

/** The terrain entry a name selects, refusing an unknown one BY NAME. */
export function terrainByName(name) {
    const t = TERRAIN[name];
    if (!t) {
        fail(`procgenLevel: "${name}" is not one of the PoC's terrains `
            + `(${TERRAIN_NAMES.join(', ')}). The palette's boundary is the survey's `
            + 'proven envelope (⚖ kickoff §1.1), so a new terrain is a measured '
            + 'addition, not a free string here.');
    }
    return t;
}

/**
 * One tile placement, in the extract's own shape.
 *
 * ⛔ THE MULTIPLICATION LIVES HERE AND NOWHERE ELSE. `[tx, ty, column *
 * TILE_SIZE, 0]` — the third element is a PIXEL offset into the tileset and
 * `levelWorld` divides it back down. A caller that wrote the column straight
 * into the slot would build tile type `TILE_COLUMN_TO_TYPE[0]` for every
 * terrain whose column is under 16, which is all four of them: an all-Ground
 * room that looked like it had walls in the JSON.
 */
export const tileEntry = (tx, ty, column) => [tx, ty, column * TILE_SIZE, 0];

/**
 * The OEL coordinates of a tile's top-left corner — where an ENTITY placed
 * "in" that cell goes.
 *
 * ⚠ NOT THE CENTRE, and the offset is the game's not ours: every placed class
 * adds `dx = dy = 8` in its constructor (`levelWorld`'s pickup table), so an
 * entity written at a cell's corner lands centred in the cell. The same is
 * true of the PLAYER: a staging block's `boot` is an OEL coordinate and the
 * run's tick-0 state is `boot + 8` (measured: boot (16,16) → state (24,24),
 * the centre of tile (1,1)).
 */
export const oelAtTile = (tx, ty) => ({ x: tx * TILE_SIZE, y: ty * TILE_SIZE });

/** The cell an OEL coordinate names. The inverse of `oelAtTile`. */
export const tileAtOel = (x, y) => ({
    tx: Math.floor(x / TILE_SIZE),
    ty: Math.floor(y / TILE_SIZE),
});

const inBounds = (record, tx, ty) => tx >= 0 && ty >= 0
    && tx < record.width && ty < record.height;

/**
 * A BORDERED EMPTY ROOM — the loop's step 1 skeleton (kickoff §3.1).
 *
 * Wall on the whole outer ring, `ground` everywhere inside, no entities. That
 * is the room the Cloudberry inversion starts from: trivially solvable, so
 * the first solve is a check on the SKELETON and every later refusal is
 * attributable to a placed template.
 *
 * ⚠ THE BORDER IS A WALL, NOT AN EDGE. A room whose outer cells were ground
 * would let the walk leave the rectangle: `loadlevel`'s own bounds guard
 * drops out-of-rectangle TILES (`tiles_outside_level`), and nothing stops a
 * player from walking off a floor that ends. The ring is what makes the room
 * a room.
 *
 * @param {object} params
 * @param {number} params.level         the level id this record answers to
 * @param {number} [params.width]       tiles; defaults to one screen
 * @param {number} [params.height]      tiles; defaults to one screen
 * @param {string} [params.floor]       interior terrain name
 * @param {string} [params.border]      ring terrain name
 * @param {string} [params.className]   the record's `class` (cosmetic)
 * @param {string} [params.path]        the record's `path` (provenance)
 */
export function emptyLevel({
    level,
    width = SINGLE_SCREEN_TILES.width,
    height = SINGLE_SCREEN_TILES.height,
    floor = 'ground',
    border = 'wall',
    className = null,
    path = null,
} = {}) {
    if (!Number.isInteger(level)) {
        fail('procgenLevel: emptyLevel needs an integer `level` — the id a `levelSource` '
            + 'answers to, and the id a staging block\'s `boot.level` names.');
    }
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 3 || height < 3) {
        fail(`procgenLevel: emptyLevel needs integer width/height of at least 3 tiles `
            + `(got ${width}x${height}) — a room with a wall ring and no interior is not `
            + 'a room.');
    }
    const floorTerrain = terrainByName(floor);
    const borderTerrain = terrainByName(border);
    const tiles = [];
    for (let ty = 0; ty < height; ty += 1) {
        for (let tx = 0; tx < width; tx += 1) {
            const ring = tx === 0 || ty === 0 || tx === width - 1 || ty === height - 1;
            tiles.push(tileEntry(tx, ty, (ring ? borderTerrain : floorTerrain).column));
        }
    }
    return freezeRecord({
        level,
        class: className ?? `Procgen${level}`,
        path: path ?? `procgen/${level}.oel`,
        width,
        height,
        layers: [{ name: 'tiles', set: 'tileset', tiles }],
        entities: [],
    });
}

/**
 * Frozen, because the loop's REVERT is "keep the old record" (kickoff §3.2)
 * and that is only true of a record nobody can edit in place. The freeze is
 * deep enough to cover the containers a placement would reach for — the
 * record, its layers array, each layer, its tiles array and the entities
 * array — and `buildLevelWorld` only ever reads.
 */
function freezeRecord(record) {
    for (const layer of record.layers) {
        Object.freeze(layer.tiles);
        Object.freeze(layer);
    }
    Object.freeze(record.layers);
    Object.freeze(record.entities);
    return Object.freeze(record);
}

/** The tiles layer, refusing a record that has none. */
function tilesLayer(record) {
    const layer = (record.layers ?? []).find((l) => l.name === 'tiles');
    if (!layer) {
        fail(`procgenLevel: level ${record?.level} has no "tiles" layer — every generated `
            + 'record carries exactly one, and `buildLevelWorld` reads terrain from it.');
    }
    return layer;
}

/**
 * The same record with some cells' terrain replaced — PURE, a new record out.
 *
 * The primitive `applyTemplate` (slice 2) is built from: a template writes
 * its tiles through here and its entities through `withEntities`, both at
 * once, and a rejected candidate is discarded by throwing the RESULT away
 * rather than by undoing anything.
 *
 * ⚠ REPLACE, not append. The extract's own layers hold at most one placement
 * per cell and `buildLevelWorld` would build BOTH — two tiles in one cell,
 * one of them a wall the picture does not show. A cell named twice in one
 * call is refused rather than resolved: which of the two the caller meant is
 * a fact about the caller.
 */
export function withTerrain(record, cells) {
    const layer = tilesLayer(record);
    const seen = new Set();
    const replaced = new Map();
    for (const cell of cells) {
        const { tx, ty } = cell;
        if (!inBounds(record, tx, ty)) {
            fail(`procgenLevel: cell (${tx},${ty}) is outside level ${record.level}'s `
                + `${record.width}x${record.height} rectangle. \`loadlevel\` drops `
                + 'out-of-rectangle placements silently (the extract counts them in '
                + '`tiles_outside_level`), so a generator that painted past the edge '
                + 'would build a room it could not see.');
        }
        const key = `${tx},${ty}`;
        if (seen.has(key)) {
            fail(`procgenLevel: cell (${tx},${ty}) is named twice in one withTerrain call. `
                + 'One cell holds one tile; which write you meant is not derivable here.');
        }
        seen.add(key);
        replaced.set(key, terrainByName(cell.terrain).column);
    }
    const tiles = layer.tiles.map(([tx, ty, txPixel, tyPixel]) => {
        const column = replaced.get(`${tx},${ty}`);
        return column === undefined
            ? [tx, ty, txPixel, tyPixel]
            : tileEntry(tx, ty, column);
    });
    return freezeRecord({
        ...record,
        layers: record.layers.map((l) => (l === layer ? { ...l, tiles } : { ...l })),
        entities: [...record.entities],
    });
}

/**
 * The same record with entities appended — PURE, a new record out.
 *
 * ⛔ NO VALIDATION OF THE TYPE HERE, deliberately. `buildLevelWorld` refuses
 * an entity tag it has not transcribed, BY NAME, with the construction site
 * it wants — and that refusal is better than any list this file could keep,
 * which would be a second roster to drift from the first.
 */
export function withEntities(record, entities) {
    assertEntities(entities);
    return freezeRecord({
        ...record,
        layers: record.layers.map((l) => ({ ...l, tiles: [...l.tiles] })),
        entities: [...record.entities, ...entities.map((e) => ({ ...e }))],
    });
}

/**
 * The same record with its entity list REPLACED wholesale — PURE, a new
 * record out.
 *
 * ⛓⛓ CONSTRUCTIVE-MODE SLICE 11 (free editing). `withEntities` APPENDS, which
 * is everything a generator ever needs: a template adds bodies and a reverted
 * candidate is discarded by throwing the result away. A hand EDIT can also
 * REMOVE one and can rewrite one's attributes, and neither is expressible as
 * an append.
 *
 * ⛔ ONE PRIMITIVE FOR BOTH, rather than a `withoutEntity` and a
 * `withEntityAttrs` that would each have to re-state the freeze and the
 * validation. `watchEdit.js` composes them as a filter and a map over
 * `record.entities` — which is the shape the ops already have — and this file
 * keeps the ONE place a record is rebuilt and frozen.
 *
 * ⚠ SAME VALIDATION AS `withEntities`, and same deliberate GAP: the TYPE is
 * not checked here. `buildLevelWorld` refuses a tag it has not transcribed, BY
 * NAME, with the construction site it wants — a second roster in this file
 * would drift from the first.
 */
export function withEntitiesReplaced(record, entities) {
    assertEntities(entities);
    return freezeRecord({
        ...record,
        layers: record.layers.map((l) => ({ ...l, tiles: [...l.tiles] })),
        entities: entities.map((e) => ({ ...e })),
    });
}

/** The shared shape check — see `withEntities`' docblock for the gap it leaves. */
function assertEntities(entities) {
    for (const e of entities) {
        if (!e || typeof e.type !== 'string' || !Number.isFinite(e.x) || !Number.isFinite(e.y)) {
            fail(`procgenLevel: an entity must be {type, x, y, attrs?} — got `
                + `${JSON.stringify(e)}. The coordinates are OEL coordinates (the cell's `
                + 'corner; the class adds its own +8), which is what `oelAtTile` returns.');
        }
    }
}

/**
 * The terrain name a cell currently holds — the read half, for a placement
 * rule that needs to know what it is painting over.
 */
export function terrainAt(record, tx, ty) {
    const entry = tilesLayer(record).tiles.find(([x, y]) => x === tx && y === ty);
    if (!entry) return null;
    const column = Math.floor(entry[2] / TILE_SIZE);
    const found = Object.values(TERRAIN).find((t) => t.column === column);
    return found ? found.name : null;
}

/**
 * A staging block's `boot` for a cell — `{level, x, y}` at the cell's corner,
 * which puts the player's tick-0 state at the cell's centre (see `oelAtTile`).
 */
export const bootAtTile = (record, tx, ty) => {
    if (!inBounds(record, tx, ty)) {
        fail(`procgenLevel: boot cell (${tx},${ty}) is outside level ${record.level}'s `
            + `${record.width}x${record.height} rectangle.`);
    }
    return { level: record.level, ...oelAtTile(tx, ty) };
};

/**
 * The atlas a `levelSource` can be built over, holding exactly this level.
 *
 * ⛔ ONE SEAM. `levelSourceFromAtlas` is the browser-safe injection point the
 * page and the runner already share (`atlasSource.js`), and a generated level
 * enters the model by being an atlas of one — not by a second source function
 * with its own idea of what a missing level means.
 */
export const atlasOf = (record) => ({
    schema_version: 1,
    game: 'seedling',
    generator: 'frontend/modules/seedlingDemo/procgenLevel.js',
    tile_size: TILE_SIZE,
    level_count: 1,
    levels: [record],
});
