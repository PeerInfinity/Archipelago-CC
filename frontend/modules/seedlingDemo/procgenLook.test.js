/**
 * ⛓ seedling-gen-biomes-1 (C1 + C2) — **THE LOOKS AND THE FOUR LATER ITEM PRESETS**,
 * the default tier. The heavy rows (byte identity of the five old biomes over two
 * seeds, every new preset certifying over three) are `seedlingGenBiomes.slow.test.js`.
 */
import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';

import { TILE_COLUMN_TO_TYPE, TILE_TYPE_ENTITY_TYPES } from '../flashPanel/seedlingSemantics.js';
import { TILE_SIZE, buildLevelWorld } from './levelWorld.js';
import {
    COSMETIC_FLOOR_TYPES, COSMETIC_WALL_TYPES, GEN_LOOKS, GEN_LOOK_NAMES, applyLook, assertLookCosmetic,
    lookColumnRefusal,
} from './procgenLook.js';
import { TERRAIN, emptyLevel, withTerrain } from './procgenLevel.js';
import {
    ENDGAME_ITEMS, POST_DARK_SUIT_ITEMS, POST_FIRE_ITEMS, POST_SPEAR_ITEMS, POST_SWIM_ITEMS,
} from './procgenPalette.js';
import { GEN_ROOM_BIOMES, generateGenRoom, serializeGenRoom } from './seedlingGenRoom.js';
import { GEN_ROOM_BIOME_NAMES, GEN_ROOM_DEFAULTS } from './seedlingGenRoomPayload.js';
import { BIOME_NAMES, DEFAULT_CENSUS_BIOMES } from './watchGenerate.js';

const OLD = ['pre-sword', 'post-sword', 'post-shield', 'post-swim', 'post-feather'];
const NEW = ['post-fire', 'post-spear', 'post-dark-suit', 'endgame'];
const sha = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const rngDrawing = (seed) => ({ next: () => (seed + 0.5) / 0x7fffffff });
const roomOf = (seedlingGen, seed = 1) => generateGenRoom({
    region_id: 'r', exits: [{}], size: { width: 10, height: 10 }, rng: rngDrawing(seed), params: { seedlingGen },
}).world;

/** A 6×6 room holding every terrain a look must leave alone: water, pit, waterfall. */
const MIXED = withTerrain(emptyLevel({ level: 900, width: 6, height: 6 }), [
    { tx: 2, ty: 2, terrain: 'water' }, { tx: 3, ty: 2, terrain: 'pit' }, { tx: 2, ty: 3, terrain: 'waterfall' },
]);

/** The collision-relevant facts of a built world, by position, without the tile types. */
function walkFacts(record) {
    const w = buildLevelWorld(record);
    const at = (t) => `${t.rect?.x ?? t.x},${t.rect?.y ?? t.y}`;
    return {
        solids: w.solids.map((s) => `${s.rect.x},${s.rect.y},${s.rect.w},${s.rect.h}`).sort(),
        walkable: w.walkableTiles.map(at).sort(),
        lethal: w.lethalTerrainTiles.map(at).sort(),
        pits: w.pitTiles.map(at).sort(),
    };
}

describe('C1 — the look map: every look paints a COSMETIC floor and wall', () => {
    const rows = GEN_LOOK_NAMES.flatMap((name) => ['floor', 'wall'].map((role) => [name, role]));
    it.each(rows)('%s · %s', (name, role) => {
        const column = GEN_LOOKS[name][role];
        const type = TILE_COLUMN_TO_TYPE[column];
        expect(lookColumnRefusal(column, role)).toBe(null);
        expect(role === 'floor' ? COSMETIC_FLOOR_TYPES : COSMETIC_WALL_TYPES).toContain(type);
        expect(TILE_TYPE_ENTITY_TYPES[type]).toBe(role === 'floor' ? 'Tile' : 'Solid');
    });

    it('a look per biome, plus `overworld` — and no look is today\'s Ground floor', () => {
        expect([...GEN_LOOK_NAMES].sort()).toEqual(['overworld', ...GEN_ROOM_BIOME_NAMES].sort());
        for (const l of Object.values(GEN_LOOKS)) expect(l.floor).not.toBe(TERRAIN.ground.column);
    });

    // ⛔ THE MUTANTS: a look that paints a walk-changing tile must not load.
    it.each([
        ['floor', 2, /Water/], ['floor', 7, /Pit/], ['floor', 19, /Lava/], ['floor', 24, /Ice/],
        ['floor', 12, /Cliff Stairs/], ['floor', 37, /Ghost Tile Step/], ['floor', 38, /Igneous-to-Lava/],
        ['floor', 36, /Bridge/], ['floor', 32, /Waterfall/], ['floor', 15, /Cave/], ['floor', 1, /grows grass/],
        ['floor', 3, /Stone/], ['wall', 0, /Ground/], ['wall', 26, /glowing/],
    ])('a %s on column %i is REFUSED', (role, column, why) => {
        const mutant = { floor: TERRAIN.ground.column, wall: TERRAIN.wall.column, [role]: column };
        expect(() => assertLookCosmetic('mutant', mutant)).toThrow(why);
    });
});

describe('C1 — applyLook', () => {
    it('ABSENT is the record itself (null, undefined, empty)', () => {
        for (const name of [null, undefined, '']) expect(applyLook(MIXED, name)).toBe(MIXED);
    });

    it.each(GEN_LOOK_NAMES)('%s: ground → its floor, wall → its wall, water/pit/waterfall untouched; walk facts equal', (name) => {
        const looked = applyLook(MIXED, name);
        const before = new Map(MIXED.layers[0].tiles.map((t) => [`${t[0]},${t[1]}`, t[2] / TILE_SIZE]));
        for (const t of looked.layers[0].tiles) {
            const was = before.get(`${t[0]},${t[1]}`);
            const want = was === TERRAIN.ground.column ? GEN_LOOKS[name].floor
                : was === TERRAIN.wall.column ? GEN_LOOKS[name].wall : was;
            expect(t[2] / TILE_SIZE).toBe(want);
        }
        expect(walkFacts(looked)).toEqual(walkFacts(MIXED));
        expect(applyLook(looked, name)).toEqual(looked);
    });

    it('an unknown look is refused BY NAME', () => {
        expect(() => applyLook(MIXED, 'lava-land')).toThrow(/"lava-land" is not a look/);
    });
});

describe('C1 — the gen room\'s `look` knob', () => {
    it('the default is ABSENT: `look: \'\'` is today\'s room, byte for byte, with no `look` in `generation`', () => {
        expect(GEN_ROOM_DEFAULTS.look).toBe('');
        const plain = serializeGenRoom(roomOf({ biome: 'pre-sword' }), null, null, null, {});
        const empty = serializeGenRoom(roomOf({ biome: 'pre-sword', look: '' }), null, null, null, {});
        expect(sha(empty)).toBe(sha(plain));
        // ⛓ the base commit's own digest (seedlingGenBiomes.slow.test.js holds the other nine)
        expect(sha(plain)).toBe('057aba413bd143dd');
        expect('look' in plain.generation).toBe(false);
    }, 120_000);

    it('a look moves ONLY the record\'s tile columns, and rides in `generation`', () => {
        const plain = serializeGenRoom(roomOf({ biome: 'pre-sword' }), null, null, null, {});
        const looked = serializeGenRoom(roomOf({ biome: 'pre-sword', look: 'overworld' }), null, null, null, {});
        expect(looked.generation).toEqual({ ...plain.generation, look: 'overworld' });
        expect(looked.record).toEqual(applyLook(plain.record, 'overworld'));
        const { record: _a, generation: _b, ...restLooked } = looked;
        const { record: _c, generation: _d, ...restPlain } = plain;
        expect(restLooked).toEqual(restPlain);
        expect(walkFacts(looked.record)).toEqual(walkFacts(plain.record));
    }, 120_000);

    it('an unknown look is a badKnob refusal', () => {
        expect(() => roomOf({ biome: 'pre-sword', look: 'nowhere' })).toThrow(/`look` = "nowhere".*the looks are/);
    });
});

describe('C2 — the four later item presets', () => {
    it('the inventories are the census boots', () => {
        expect(POST_FIRE_ITEMS).toEqual({ hasSword: true, hasShield: true, hasTorch: true, hasFire: true });
        expect(POST_SPEAR_ITEMS).toEqual({ ...POST_FIRE_ITEMS, hasWand: true, canSwim: true, hasFeather: true,
            hasSpear: true });
        expect(POST_DARK_SUIT_ITEMS).toEqual({ ...POST_SPEAR_ITEMS, hasDarkSuit: true, hasDarkShield: true });
        expect(ENDGAME_ITEMS).toEqual({ ...POST_DARK_SUIT_ITEMS, hasGhostSword: true, hasFireWand: true });
        for (const name of NEW) expect(GEN_ROOM_BIOMES[name].items).not.toHaveProperty('hasDarkSword');
    });

    it('⛔ post-swim is NOT corrected here: sword, shield, conch — no torch, fire or wand', () => {
        expect(POST_SWIM_ITEMS).toEqual({ hasSword: true, hasShield: true, canSwim: true });
        expect(GEN_ROOM_BIOMES['post-swim'].items).toBe(POST_SWIM_ITEMS);
    });

    it('the names: one list, two spellings, and the lab\'s; the old five first and unmoved; opt-in to censuses', () => {
        expect(GEN_ROOM_BIOME_NAMES).toEqual([...OLD, ...NEW]);
        expect(Object.keys(GEN_ROOM_BIOMES)).toEqual(GEN_ROOM_BIOME_NAMES);
        expect(BIOME_NAMES).toEqual(GEN_ROOM_BIOME_NAMES);
        for (const name of GEN_ROOM_BIOME_NAMES) expect(GEN_ROOM_BIOMES[name].name).toBe(name);
        expect(DEFAULT_CENSUS_BIOMES).toEqual(OLD);
    });

    it('the roster is post-sword\'s by reference (C2 adds no template)', () => {
        for (const name of NEW) {
            expect(GEN_ROOM_BIOMES[name].templates).toBe(GEN_ROOM_BIOMES['post-sword'].templates);
            expect(GEN_ROOM_BIOMES[name].excluded).toBe(GEN_ROOM_BIOMES['post-sword'].excluded);
        }
    });
});
