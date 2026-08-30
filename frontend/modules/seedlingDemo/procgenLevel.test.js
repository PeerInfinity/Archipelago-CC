/**
 * seedlingDemo/procgenLevel.test — the level model, checked against a BUILT
 * WORLD rather than against itself.
 *
 * PROCGEN PoC arc, slice 1. The claim that matters is the terrain
 * vocabulary: a declared column is a coordinate in the game's own switch, and
 * the only way to know it means what this file says it means is to build the
 * world and ask. So each of the four terrains is placed and then found — a
 * wall in `solids`, water in `lethalTerrainTiles`, a pit in `pitTiles`,
 * ground in `walkableTiles`.
 */

import { describe, expect, it } from 'vitest';

import {
    MODELLED_TILE_TYPES, ROLES, TILE_SIZE, buildLevelWorld,
} from './levelWorld.js';
import { TILE_COLUMN_TO_TYPE, TILE_TYPE_NAMES } from '../flashPanel/seedlingSemantics.js';
import { SCREEN_H, SCREEN_W } from './camera.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import {
    FILL_DENSE, FILL_MODES, FILL_SHELL, ProcgenLevelError, ROOM_TILES_MAX, ROOM_TILES_MIN,
    SINGLE_SCREEN_TILES, TERRAIN, assertClosed, assertRoomSize, assertTerrainColumns, atlasOf,
    bootAtTile, emptyLevel, fillByName, hasTile, oelAtTile, shellOf, terrainAt, tileAtOel,
    tileEntry, withEntities, withTerrain,
} from './procgenLevel.js';

const LEVEL = 900;

/** The room every case starts from: one screen, bordered, empty. */
const room = (over = {}) => emptyLevel({ level: LEVEL, ...over });

const worldFor = (record) => buildLevelWorld(record, { roles: ROLES });

describe('the terrain vocabulary is the game\'s, not a second table', () => {
    it('every declared (column, type) pair agrees with TILE_COLUMN_TO_TYPE', () => {
        expect(assertTerrainColumns()).toBe(true);
        for (const t of Object.values(TERRAIN)) {
            expect(TILE_COLUMN_TO_TYPE[t.column]).toBe(t.type);
        }
    });

    it('every terrain type is one levelWorld models', () => {
        for (const t of Object.values(TERRAIN)) {
            expect(MODELLED_TILE_TYPES, `${t.name} (type ${t.type} `
                + `${TILE_TYPE_NAMES[t.type]})`).toContain(t.type);
        }
    });

    it('a tile entry writes the tileset PIXEL x, not the column', () => {
        // ⛔ The factor of TILE_SIZE that `levelWorld` divides back out.
        expect(tileEntry(3, 4, TERRAIN.wall.column))
            .toEqual([3, 4, TERRAIN.wall.column * TILE_SIZE, 0]);
    });
});

describe('each terrain, against the world the engine builds from it', () => {
    /** One interior cell repainted, so the terrain under test is unique. */
    const withOne = (terrain) => withTerrain(room(), [{ tx: 4, ty: 4, terrain }]);

    it('the border is a WALL: every ring cell joins `solids`', () => {
        const world = worldFor(room());
        const ring = 2 * (SINGLE_SCREEN_TILES.width + SINGLE_SCREEN_TILES.height) - 4;
        expect(world.solids).toHaveLength(ring);
        for (const s of world.solids) expect(s.tag).toBe(`tile:${TILE_TYPE_NAMES[TERRAIN.wall.type]}`);
        // …and the corner is where the ring says it is.
        expect(world.solids.some((s) => s.rect.x === 0 && s.rect.y === 0)).toBe(true);
    });

    it('the floor is GROUND: every interior cell is walkable, type 0', () => {
        const world = worldFor(room());
        const interior = (SINGLE_SCREEN_TILES.width - 2) * (SINGLE_SCREEN_TILES.height - 2);
        expect(world.walkableTiles).toHaveLength(interior);
        expect(new Set(world.walkableTiles.map((t) => t.t))).toEqual(new Set([TERRAIN.ground.type]));
        expect(world.walkableTiles[0].entityType).toBe('Tile');
    });

    it('WATER carries the water state and lands in `lethalTerrainTiles`', () => {
        const world = worldFor(withOne('water'));
        const wet = world.tiles.filter((t) => t.tx === 4 && t.ty === 4);
        expect(wet).toHaveLength(1);
        expect(wet[0].t).toBe(TERRAIN.water.type);
        expect(wet[0].name).toBe('Water');
        expect(world.lethalTerrainTiles.map((t) => `${t.tx},${t.ty}`)).toEqual(['4,4']);
    });

    it('a PIT carries the pit state and lands in `pitTiles`', () => {
        const world = worldFor(withOne('pit'));
        const pit = world.tiles.filter((t) => t.tx === 4 && t.ty === 4);
        expect(pit).toHaveLength(1);
        expect(pit[0].t).toBe(TERRAIN.pit.type);
        expect(pit[0].name).toBe('Pit');
        expect(world.pitTiles.map((t) => `${t.tx},${t.ty}`)).toEqual(['4,4']);
    });

    it('a wall placed INSIDE the room is a solid too', () => {
        const world = worldFor(withOne('wall'));
        const inner = world.solids.filter((s) => s.rect.x === 4 * TILE_SIZE
            && s.rect.y === 4 * TILE_SIZE);
        expect(inner).toHaveLength(1);
        // …and it left the walkable set, which is what a wall means.
        expect(world.walkableTiles.some((t) => t.tx === 4 && t.ty === 4)).toBe(false);
    });
});

describe('the empty room is one screen, bordered', () => {
    it('the default size is SCREEN/TILE_SIZE, derived rather than typed', () => {
        expect(SINGLE_SCREEN_TILES).toEqual({
            width: SCREEN_W / TILE_SIZE, height: SCREEN_H / TILE_SIZE,
        });
        const r = room();
        expect([r.width, r.height]).toEqual([SINGLE_SCREEN_TILES.width, SINGLE_SCREEN_TILES.height]);
        expect(r.layers[0].tiles).toHaveLength(r.width * r.height);
    });

    it('every ring cell is wall and every interior cell is floor', () => {
        const r = room();
        for (let ty = 0; ty < r.height; ty += 1) {
            for (let tx = 0; tx < r.width; tx += 1) {
                const ring = tx === 0 || ty === 0 || tx === r.width - 1 || ty === r.height - 1;
                expect(terrainAt(r, tx, ty), `(${tx},${ty})`).toBe(ring ? 'wall' : 'ground');
            }
        }
    });

    it('it names its level, carries one tiles layer and no entities', () => {
        const r = room();
        expect(r.level).toBe(LEVEL);
        expect(r.layers.map((l) => l.name)).toEqual(['tiles']);
        expect(r.layers[0].set).toBe('tileset');
        expect(r.entities).toEqual([]);
    });

    it('refuses a room with no interior, and a level that is not an integer', () => {
        expect(() => emptyLevel({ level: LEVEL, width: 2, height: 9 }))
            .toThrow(ProcgenLevelError);
        expect(() => emptyLevel({ level: '900' })).toThrow(/integer `level`/);
    });
});

describe('placement is pure — revert is keeping the old record', () => {
    it('withTerrain returns a new record and leaves the old one alone', () => {
        const before = room();
        const after = withTerrain(before, [{ tx: 2, ty: 2, terrain: 'water' }]);
        expect(after).not.toBe(before);
        expect(terrainAt(before, 2, 2)).toBe('ground');
        expect(terrainAt(after, 2, 2)).toBe('water');
        expect(after.layers[0].tiles).toHaveLength(before.layers[0].tiles.length);
    });

    it('withEntities appends without touching the old record', () => {
        const before = room();
        const at = oelAtTile(8, 8);
        const after = withEntities(before, [{ type: 'torchpickup', ...at, attrs: { tag: '0' } }]);
        expect(before.entities).toHaveLength(0);
        expect(after.entities).toEqual([{ type: 'torchpickup', x: 128, y: 128, attrs: { tag: '0' } }]);
    });

    it('the returned record is frozen, so an in-place edit cannot happen quietly', () => {
        const r = room();
        expect(Object.isFrozen(r)).toBe(true);
        expect(Object.isFrozen(r.layers[0].tiles)).toBe(true);
        expect(Object.isFrozen(r.entities)).toBe(true);
    });

    it('refuses a cell outside the rectangle and a cell named twice', () => {
        expect(() => withTerrain(room(), [{ tx: 10, ty: 0, terrain: 'wall' }]))
            .toThrow(/outside level 900's 10x10 rectangle/);
        expect(() => withTerrain(room(), [
            { tx: 3, ty: 3, terrain: 'wall' }, { tx: 3, ty: 3, terrain: 'water' },
        ])).toThrow(/named twice/);
    });

    it('refuses an unknown terrain BY NAME, listing the four', () => {
        expect(() => withTerrain(room(), [{ tx: 3, ty: 3, terrain: 'lava' }]))
            .toThrow(/"lava" is not one of the PoC's terrains \(ground, wall, water, pit\)/);
    });

    it('refuses an entity with no coordinates', () => {
        expect(() => withEntities(room(), [{ type: 'torchpickup' }]))
            .toThrow(/must be \{type, x, y, attrs\?\}/);
    });
});

describe('coordinates: the cell corner is the entity coordinate', () => {
    it('oelAtTile and tileAtOel round-trip', () => {
        expect(oelAtTile(8, 8)).toEqual({ x: 128, y: 128 });
        expect(tileAtOel(128, 128)).toEqual({ tx: 8, ty: 8 });
        expect(tileAtOel(135, 129)).toEqual({ tx: 8, ty: 8 });
    });

    it('bootAtTile names the level and the corner', () => {
        expect(bootAtTile(room(), 1, 1)).toEqual({ level: LEVEL, x: 16, y: 16 });
        expect(() => bootAtTile(room(), 99, 1)).toThrow(/outside level 900/);
    });
});

describe('the injection seam takes the record unchanged', () => {
    it('levelSourceFromAtlas(atlasOf(record)) returns it by level number', () => {
        const r = room();
        const source = levelSourceFromAtlas(atlasOf(r));
        expect(source(LEVEL)).toBe(r);
        expect(() => source(4)).toThrow(/has no level 4/);
    });

    it('the atlas declares the same tile size the record was built with', () => {
        expect(atlasOf(room()).tile_size).toBe(TILE_SIZE);
    });

    it('a placed pickup reaches the built world\'s census', () => {
        const r = withEntities(room(), [{
            type: 'torchpickup', ...oelAtTile(8, 8), attrs: { tag: '0' },
        }]);
        const world = worldFor(r);
        expect(world.pickups).toHaveLength(1);
        expect({ tag: world.pickups[0].tag, x: world.pickups[0].x, y: world.pickups[0].y })
            .toEqual({ tag: 'torchpickup', x: 128, y: 128 });
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE ROOM CONTRACT — PROCGEN ELEMENTS arc 5, slice 1
 * ══════════════════════════════════════════════════════════════════════ */

/** A record built by hand from a picture — `#` wall, `.` ground, ` ` ABSENT. */
const fromPicture = (rows) => {
    const tiles = [];
    rows.forEach((row, ty) => {
        [...row].forEach((ch, tx) => {
            if (ch === ' ') return;
            tiles.push(tileEntry(tx, ty, (ch === '#' ? TERRAIN.wall : TERRAIN.ground).column));
        });
    });
    return Object.freeze({
        level: LEVEL,
        class: 'Hand',
        path: 'hand.oel',
        width: rows[0].length,
        height: rows.length,
        layers: [{ name: 'tiles', set: 'tileset', tiles }],
        entities: [],
    });
};

describe('the SIZE channel refuses by name and never clamps', () => {
    it('takes the pair and hands it back frozen', () => {
        expect(assertRoomSize({ width: 20, height: 12 })).toEqual({ width: 20, height: 12 });
        expect(Object.isFrozen(assertRoomSize({ width: 3, height: 60 }))).toBe(true);
    });

    it(`⛔ refuses > ${ROOM_TILES_MAX} BY AXIS, and names the vanilla measurement`, () => {
        expect(() => assertRoomSize({ width: 61, height: 10 }))
            .toThrow(/width=61 is outside \[3\.\.60\]/);
        expect(() => assertRoomSize({ width: 10, height: 61 }))
            .toThrow(/height=61 is outside/);
        expect(() => assertRoomSize({ width: 61, height: 10 })).toThrow(/VANILLA MAXIMUM/);
        expect(() => assertRoomSize({ width: 61, height: 10 })).toThrow(/60x58/);
    });

    it(`⛔ refuses < ${ROOM_TILES_MIN} and a non-integer, by axis`, () => {
        expect(() => assertRoomSize({ width: 2, height: 10 })).toThrow(/width=2 is outside/);
        expect(() => assertRoomSize({ width: 10.5, height: 10 }))
            .toThrow(/width=10.5 is not an integer/);
        expect(() => assertRoomSize({ width: 10, height: '12' }))
            .toThrow(/height="12" is not an integer/);
    });

    it('the CHANNEL names itself in the sentence — a flag typo reads as a flag typo', () => {
        expect(() => assertRoomSize({ width: 61, height: 10 }, 'generate-seedling-level'))
            .toThrow(/^generate-seedling-level: width=61/);
    });

    /** ⛓ The vanilla maximum is a MEASUREMENT and the constant carries it, so a
     *  reader who doubts 60 is pointed at the file it was measured from. */
    it('60 and 3 are the declared bounds, not magic numbers in the check', () => {
        expect([ROOM_TILES_MIN, ROOM_TILES_MAX]).toEqual([3, 60]);
        expect(assertRoomSize({ width: ROOM_TILES_MAX, height: ROOM_TILES_MAX }))
            .toEqual({ width: 60, height: 60 });
    });

    it('a non-square room is legal from day one — `emptyLevel` already took both', () => {
        const r = emptyLevel({ level: LEVEL, width: 20, height: 12 });
        expect([r.width, r.height]).toEqual([20, 12]);
        expect(r.layers[0].tiles).toHaveLength(240);
        expect(terrainAt(r, 19, 11)).toBe('wall');
        expect(terrainAt(r, 18, 10)).toBe('ground');
    });
});

describe('the FILL vocabulary', () => {
    it('offers exactly dense and shell, and refuses anything else BY NAME', () => {
        expect(FILL_MODES).toEqual([FILL_DENSE, FILL_SHELL]);
        expect(fillByName('shell')).toBe('shell');
        expect(() => fillByName('sparse')).toThrow(/fill="sparse" is not one of \[dense, shell\]/);
    });
});

describe('THE SHELL — floor, the wall that touches it, and NOTHING beyond', () => {
    it('⛓ a bordered OPEN room loses nothing at all, and that is the honest answer', () => {
        const r = emptyLevel({ level: LEVEL, width: 12, height: 8 });
        expect(shellOf(r).layers[0].tiles).toHaveLength(96);
        /** ⛔ …and the 4-adjacent MUTANT drops exactly the four CORNERS, which
         *  is the whole difference between the two rules on an open room. */
        expect(shellOf(r, { adjacency: 4 }).layers[0].tiles).toHaveLength(92);
    });

    it('⛓⛓ drops the wall a floor cell cannot touch, and keeps the wall it can', () => {
        const dense = fromPicture([
            '#####',
            '#...#',
            '#.#.#',
            '#...#',
            '#####',
        ]);
        /** every wall of this room is 8-adjacent to floor, so nothing goes */
        expect(shellOf(dense).layers[0].tiles).toHaveLength(25);
        const withBlob = fromPicture([
            '#######',
            '#.....#',
            '#.###.#',
            '#.###.#',
            '#.###.#',
            '#.....#',
            '#######',
        ]);
        /** ⛓ the 3x3 wall blob's CENTRE touches no floor at all — one cell. */
        expect(withBlob.layers[0].tiles).toHaveLength(49);
        expect(shellOf(withBlob).layers[0].tiles).toHaveLength(48);
        expect(hasTile(shellOf(withBlob), 3, 3)).toBe(false);
        expect(hasTile(shellOf(withBlob), 2, 3)).toBe(true);
    });

    it('⛔ NULL IS NOT WALL — the built world gets NO solid where a cell is absent', () => {
        const withBlob = fromPicture([
            '#######',
            '#.....#',
            '#.###.#',
            '#.###.#',
            '#.###.#',
            '#.....#',
            '#######',
        ]);
        const dropped = shellOf(withBlob);
        expect(terrainAt(dropped, 3, 3)).toBe(null);
        const solidAt = (w, tx, ty) => w.solids.some((s) => s.x === tx * TILE_SIZE + TILE_SIZE / 2
            && s.y === ty * TILE_SIZE + TILE_SIZE / 2);
        expect(solidAt(worldFor(withBlob), 3, 3)).toBe(true);
        expect(solidAt(worldFor(dropped), 3, 3)).toBe(false);
        /** ⛓ and the wall the player CAN touch is still solid in both */
        expect(solidAt(worldFor(dropped), 2, 3)).toBe(true);
    });

    it('the strip is PURE — the input record is untouched and the output is frozen', () => {
        const r = emptyLevel({ level: LEVEL, width: 8, height: 8 });
        const before = JSON.stringify(r);
        const out = shellOf(r);
        expect(JSON.stringify(r)).toBe(before);
        expect(Object.isFrozen(out)).toBe(true);
        expect(Object.isFrozen(out.layers[0].tiles)).toBe(true);
        expect(out).not.toBe(r);
    });

    it('carries the entities across untouched', () => {
        const r = withEntities(emptyLevel({ level: LEVEL, width: 8, height: 8 }),
            [{ type: 'torchpickup', ...oelAtTile(4, 4), attrs: { tag: '0' } }]);
        expect(shellOf(r).entities).toEqual(r.entities);
    });

    it('refuses an adjacency that is neither 4 nor 8', () => {
        expect(() => shellOf(emptyLevel({ level: LEVEL }), { adjacency: 6 }))
            .toThrow(/adjacency must be 4 or 8/);
    });
});

describe('⛔⛔ THE CLOSURE LAW — no floor cell 4-adjacent to an ABSENT cell', () => {
    it('holds on every shell this file produces, and says so', () => {
        const withBlob = fromPicture([
            '#####',
            '#...#',
            '#.#.#',
            '#...#',
            '#####',
        ]);
        expect(assertClosed(shellOf(withBlob))).toBe(true);
        expect(assertClosed(emptyLevel({ level: LEVEL, width: 20, height: 12 }))).toBe(true);
    });

    /**
     * ⛓⛓⛓ THE HAND-BUILT HOLED SHELL — the row the LAW exists for, and it is
     * hand-built precisely because `shellOf` cannot produce one from a dense
     * input. A future strip that ran mid-pipeline, an edit, or a level set
     * imported from somewhere else can.
     */
    it('⛔ REFUSES a room whose floor touches nothing, and names both cells', () => {
        const holed = fromPicture([
            '#####',
            '#...#',
            '#... ',
            '#...#',
            '#####',
        ]);
        expect(() => assertClosed(holed))
            .toThrow(/THE CLOSURE LAW — the floor cell \(3,2\) is 4-adjacent to the ABSENT cell \(4,2\)/);
        expect(() => assertClosed(holed)).toThrow(/An absent cell is NOT a wall/);
    });

    /**
     * ⛓⛓⛓ THE ROW MUTANT (a) EXISTS FOR. `shellOf` cannot produce a hole FROM A
     * DENSE INPUT — the law holds by construction there — so the row that gates
     * the call inside it has to hand it an input that is already sparse. ⛔
     * Without this row, deleting `assertClosed(out)` from `shellOf` reddens
     * NOTHING, because the law's own row calls the law directly.
     */
    it('⛔ `shellOf` REFUSES to return a holed room when the input already had the hole', () => {
        const holed = fromPicture([
            '#####',
            '#...#',
            '#... ',
            '#...#',
            '#####',
        ]);
        expect(() => shellOf(holed)).toThrow(/THE CLOSURE LAW/);
    });

    it('⛓ a hole on the DIAGONAL is not a way out, and is not refused', () => {
        const cornerless = fromPicture([
            ' ### ',
            '#...#',
            '#...#',
            '#...#',
            ' ### ',
        ]);
        expect(assertClosed(cornerless)).toBe(true);
    });

    it('the channel names itself, so a caller knows which record was asked about', () => {
        const holed = fromPicture(['##', '. ']);
        expect(() => assertClosed(holed, 'procgenSeedling')).toThrow(/^procgenSeedling: THE CLOSURE LAW/);
    });
});
