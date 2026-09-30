/**
 * ⛓⛓ SEEDLING SWIM T1, D1 — **THE BOOT-AWARE HAZARD SET.** S1's residue: a
 * `post-swim` generated room with a `watergate` re-rolled through every size
 * (S1: 83 re-rolls, grown to 28×28; T1's W0 on THIS room: 173, grown to 48×48,
 * 37 min) and `require: 'canSwim'` never came back (900 s), because `hazardCells` walled every water cell whatever the
 * boot granted. Now water is not a hazard when the biome's items grant `canSwim`,
 * lava when they grant `hasDarkSuit`, pits always are — for the SEAL floods; a
 * door, its approach and a location still never stand on a lethal cell, and the
 * approach is reached from the start WITHOUT crossing one (so an arrival lands on
 * the start's side of the gate).
 *
 * The fixture is the measured room: `generateGenRoom` 10×10, drawn seed 16807,
 * `{biome: 'post-swim', elements: 'watergate'}` — start (1,1) in a one-wide
 * column, the water at (2,3) the only way into the room body, the goal (5,3).
 */
import { describe, it, expect, beforeAll } from 'vitest';

import { buildLevelWorld } from './levelWorld.js';
import { walkableCellsFrom } from './levelSetExits.js';
import { generateSeedlingLevel } from './procgenSeedling.js';
import { coreLevelRecord } from './levelSetValidator.js';
import { parseElementSpec, parseItemRequireList } from '../procgenCore/elementSpec.js';
import {
    GEN_ROOM_BIOMES, generateGenRoom, goalHoldsWithDoorsAsWalls, hazardCells, pickGenRoomDoors,
} from './seedlingGenRoom.js';

const key = (c) => `${c.tx},${c.ty}`;
/** An rng whose first draw yields `seed` as the room's drawn seed. */
const rngDrawing = (seed) => ({ next: () => (seed + 0.5) / 0x7fffffff });
const SWIM = { biome: 'post-swim', elements: 'watergate' };
const room = (extra = {}) => generateGenRoom({
    region_id: 'swim', exits: [{}], size: { width: 10, height: 10 }, rng: rngDrawing(16807),
    params: { seedlingGen: { ...SWIM, ...extra } },
}).world;

/** ⛔ The test's OWN terrain read (tile type by cell), never the subject's `hazardCells`. */
const terrainOf = (record) => {
    const out = new Map();
    for (const t of buildLevelWorld(record).walkableTiles) out.set(`${t.tx},${t.ty}`, t.t);
    return out;
};

/** The flood from `start` over the walkable cells with `walls` (keys) walled. */
function reach(record, start, walls) {
    const flood = walkableCellsFrom(record, start);
    const seen = new Set([key(start)]);
    const queue = [start];
    for (let i = 0; i < queue.length; i += 1) {
        for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
            const c = { tx: queue[i].tx + dx, ty: queue[i].ty + dy };
            if (seen.has(key(c)) || walls.has(key(c)) || !flood.has(key(c))) continue;
            seen.add(key(c));
            queue.push(c);
        }
    }
    return seen;
}

/** `record` with the cells in `paint` ({"tx,ty": tileset column}) repainted. */
function repainted(record, paint) {
    return { ...record, layers: record.layers.map((layer) => (!Array.isArray(layer.tiles) ? layer : {
        ...layer, tiles: layer.tiles.map((t) => (`${t[0]},${t[1]}` in paint ? [t[0], t[1], paint[`${t[0]},${t[1]}`] * 16, ...t.slice(3)] : t)),
    })) };
}

describe('SWIM T1 D1 — hazardCells(record, items): one arm per item', () => {
    // water (2,3) is the generator's; lava (tileset column 19 → type 17) and pit (column 7 → type 6) are painted in.
    // ⛔ lazily, never at collection: a `-t` run of one row must not build the room
    let record; let t;
    beforeAll(() => {
        record = repainted(room().record, { '6,6': 19, '7,7': 7 });
        t = terrainOf(record);
    });

    it('the fixture holds one water, one lava and one pit cell, by the test\'s own read', () => {
        expect(t.get('2,3')).toBe(1);
        expect(t.get('6,6')).toBe(17);
        expect(t.get('7,7')).toBe(6);
    });
    it('no items ⇒ water, lava and pit are all walled (the set every room read before T1)', () => {
        const h = hazardCells(record);
        expect(['2,3', '6,6', '7,7'].every((c) => h.has(c))).toBe(true);
        expect(hazardCells(record, null)).toEqual(h);
        expect(hazardCells(record, { canSwim: false, hasDarkSuit: false })).toEqual(h);
    });
    it('canSwim ⇒ water is open; lava and the pit stay walled', () => {
        const h = hazardCells(record, { canSwim: true });
        expect(h.has('2,3')).toBe(false);
        expect(h.has('6,6')).toBe(true);
        expect(h.has('7,7')).toBe(true);
    });
    it('hasDarkSuit ⇒ lava is open; water and the pit stay walled', () => {
        const h = hazardCells(record, { hasDarkSuit: true });
        expect(h.has('6,6')).toBe(false);
        expect(h.has('2,3')).toBe(true);
        expect(h.has('7,7')).toBe(true);
    });
    // ⛓ SWIM T4 — `post-feather` (post-swim + the feather) joined the gen room and grants canSwim too.
    it('byte-inertia: no biome but post-swim and post-feather grants canSwim or hasDarkSuit, so every other room reads the item-less set', () => {
        const granting = Object.entries(GEN_ROOM_BIOMES)
            .filter(([, p]) => p.items?.canSwim || p.items?.hasDarkSuit).map(([name]) => name);
        expect(granting).toEqual(['post-swim', 'post-feather']);
        for (const [name, p] of Object.entries(GEN_ROOM_BIOMES)) {
            if (!granting.includes(name)) expect(hazardCells(record, p.items ?? null), name).toEqual(hazardCells(record));
        }
    });
});

describe('SWIM T1 D1 — a post-swim watergate room builds, and its gate is between the arrival and the goal', () => {
    it('the door picker seats the door WITH the boot (the require row\'s own reader)', () => {
        // the generator's own draw for the seed, NOT `generateGenRoom` (whose re-roll loop a mutant spins)
        const out = generateSeedlingLevel({ seed: 16807, palette: GEN_ROOM_BIOMES['post-swim'],
            defaults: { width: 10, height: 10 }, bounds: { obstacleTarget: 6, triesPerStep: 8, saturationK: 3 },
            elements: parseElementSpec('watergate'), require: parseItemRequireList('canSwim') });
        const doors = pickGenRoomDoors(coreLevelRecord(out.record), out.summary.startCell, out.summary.goalCell, 1,
            GEN_ROOM_BIOMES['post-swim'].items, "'swim'");
        expect(doors.map(key)).toEqual(['1,8']);
    });
    it('`{biome: post-swim, elements: watergate}` builds at re-roll 0 (W0: 173 re-rolls, grown to 48×48)', () => {
        const w = room();
        expect(w.generation.rerolls).toBe(0);
        expect(w.size).toEqual({ width: 10, height: 10 });
    });
    it('`require: canSwim` is MET at re-roll 0 (W0: no answer in 900 s)', () => {
        const w = room({ require: 'canSwim' });
        expect(w.generation.require).toBe('canSwim');
        expect(w.generation.rerolls).toBe(0);
    });
    it('the goal certifies with the boot and the door as a wall — and NOT without the conch', () => {
        const w = room({ require: 'canSwim' });
        const door = [...w.exits.values()][0];
        const cells = door.exit_tiles.map(([tx, ty]) => ({ tx, ty }));
        // the generator's own output for the room's seed (the oracle needs its model)
        const out = generateSeedlingLevel({ seed: w.seed, palette: GEN_ROOM_BIOMES['post-swim'],
            defaults: { width: 10, height: 10 }, bounds: { obstacleTarget: 6, triesPerStep: 8, saturationK: 3 },
            elements: parseElementSpec('watergate'), require: parseItemRequireList('canSwim') });
        expect(out.require?.met).toBe(true);
        expect(goalHoldsWithDoorsAsWalls(out, cells, GEN_ROOM_BIOMES['post-swim'].items)).toBe(true);
        expect(goalHoldsWithDoorsAsWalls(out, cells, { ...GEN_ROOM_BIOMES['post-swim'].items, canSwim: false }))
            .not.toBe(true);
    });
    it('the arrival (the door\'s approach) is on the start\'s DRY side; the goal is only past the water', () => {
        const w = room({ require: 'canSwim' });
        const door = [...w.exits.values()][0];
        const t = terrainOf(w.record);
        const lethal = new Set([...t].filter(([, v]) => v === 1 || v === 17 || v === 6).map(([k]) => k));
        const dry = reach(w.record, w.start, lethal);
        const approach = { tx: door.entrance_spawn.x / 16, ty: door.entrance_spawn.y / 16 };
        expect(lethal.has(key(approach))).toBe(false);
        expect(lethal.has(door.exit_tiles[0].join(','))).toBe(false);
        expect(dry.has(key(approach))).toBe(true);
        expect(dry.has(key(w.goalCell))).toBe(false);
        expect(reach(w.record, w.start, new Set()).has(key(w.goalCell))).toBe(true);
    });
});
