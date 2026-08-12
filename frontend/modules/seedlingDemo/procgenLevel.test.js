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
    ProcgenLevelError, SINGLE_SCREEN_TILES, TERRAIN, assertTerrainColumns, atlasOf,
    bootAtTile, emptyLevel, oelAtTile, terrainAt, tileAtOel, tileEntry, withEntities,
    withTerrain,
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
