/**
 * ⛓⛓ SEEDLING GENERATED LEVELS G2 — **NO DOOR MAY SEAL AN APPROACH** (⚖ planner
 * (A) + (A+R), 2026-09-23). The fixture is the MEASURED case: `region_0_0` of
 * G1's spiral state, whose door 0 at (8,1) had its approach at (8,2) — a one-cell
 * pocket whose other neighbour (8,3) became door 1, so the arrival stood between
 * two portals. Then the re-roll (deterministic, no engine rng), its record
 * (`generation.rerolls`), the goal re-certified with the doors as WALLS, and the
 * refusal once the re-rolls run out.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeAll } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import { SEEDLING_GENERATED_ROOM_STATE } from '../procgenPipeline/presetDefs.js';
import { createRng } from '../shared/rng.js';
import { pickDoorCells, walkableCellsFrom } from './levelSetExits.js';
import { generateSeedlingLevel } from './procgenSeedling.js';
import {
    GEN_ROOM_BIOMES, GEN_ROOM_DOOR_REROLLS, generateGenRoom, goalHoldsWithDoorsAsWalls, hazardCells, rerollSeed,
} from './seedlingGenRoom.js';
import { SEEDLING_GENERATED_LEAF_STATE } from '../procgenPipeline/presetDefs.js';
import { buildLevelWorld } from './levelWorld.js';

/** ⛔ The test's OWN hazard read — never the subject's `hazardCells` (a probe sharing its subject's assumption agrees with the bug). */
const hazardsOf = (record) => {
    const w = buildLevelWorld(record);
    return new Set([...w.lethalTerrainTiles, ...w.pitTiles].map((t) => `${Math.floor(t.x / 16)},${Math.floor(t.y / 16)}`));
};

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const key = (c) => `${c.tx},${c.ty}`;
const guard = (goal) => new Set([[0, -1], [-1, 0], [1, 0], [0, 1]]
    .map(([dx, dy]) => key({ tx: goal.tx + dx, ty: goal.ty + dy })));

/** The flood from `start` with every door cell a WALL — the law's own witness. */
function sealedFlood(record, start, doors) {
    const flood = walkableCellsFrom(record, start);
    const wall = new Set(doors.map(key));
    const seen = new Set([key(start)]);
    const queue = [start];
    for (let i = 0; i < queue.length; i += 1) {
        const at = queue[i];
        for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
            const c = { tx: at.tx + dx, ty: at.ty + dy };
            if (seen.has(key(c)) || wall.has(key(c)) || !flood.has(key(c))) continue;
            seen.add(key(c));
            queue.push(c);
        }
    }
    return seen;
}

/** An rng whose first draw yields `seed` as the room's drawn seed, counting its draws. */
const rngDrawing = (seed) => {
    const r = { calls: 0, next: () => { r.calls += 1; return (seed + 0.5) / 0x7fffffff; } };
    return r;
};

describe('the measured case — region_0_0 of G1\'s spiral state', () => {
    let room;
    beforeAll(async () => {
        for (const rel of REGISTRY_LIBRARIES) {
            // eslint-disable-next-line no-await-in-loop
            await import(join(ROOT, rel));
        }
        const { rulesJson } = await runPresetHeadless(buildRunFromState(structuredClone(SEEDLING_GENERATED_ROOM_STATE)));
        const p = rulesJson.preset_sidecars['1'].region_0_0.playable_payload;
        room = { record: p.record, start: p.start, goal: p.goal_cell, rerolls: p.generation.rerolls, exits: p.exits };
    }, 60000);

    it('WITHOUT keepReachable (the linker\'s law, G1\'s): door 1 at (8,3) seals door 0\'s approach (8,2)', () => {
        expect(room.rerolls).toBe(0); // the fix did not re-roll this room — the same record as G1's
        const { doors } = pickDoorCells(room.record, room.start, 2, { exclude: guard(room.goal) });
        expect(doors.map((d) => [d.tx, d.ty])).toEqual([[8, 1], [8, 3]]);
        expect(doors[0].from).toEqual({ tx: 8, ty: 2 });
        expect(sealedFlood(room.record, room.start, doors).has('8,2')).toBe(false);
    });

    it('WITH keepReachable: door 0 KEEPS (8,1) (prefix-stable); door 1 moves; every approach and the goal stay reachable', () => {
        const { doors } = pickDoorCells(room.record, room.start, 2,
            { exclude: guard(room.goal), keepReachable: { cells: [room.goal] } });
        expect([doors[0].tx, doors[0].ty]).toEqual([8, 1]);
        expect([doors[1].tx, doors[1].ty]).not.toEqual([8, 3]);
        const seen = sealedFlood(room.record, room.start, doors);
        for (const d of doors) expect(seen.has(key(d.from)), key(d)).toBe(true);
        expect(seen.has(key(room.goal))).toBe(true);
        // …and it is what the room's payload carries
        expect(room.exits.map((e) => e.exit_tiles[0])).toEqual(doors.map((d) => [d.tx, d.ty]));
    });

    it('PREFIX-STABLE under keepReachable: the doors of k are the first k of n', () => {
        const pick = (n) => pickDoorCells(room.record, room.start, n,
            { exclude: guard(room.goal), keepReachable: { cells: [room.goal] } }).doors.map(key);
        const three = pick(3);
        expect(pick(1)).toEqual(three.slice(0, 1));
        expect(pick(2)).toEqual(three.slice(0, 2));
    });
});

describe('the re-roll — deterministic, no engine rng, recorded', () => {
    it('the hash is PINNED: attempt 0 is the drawn seed; attempts 1..K are fixed values, never 0', () => {
        expect(rerollSeed(12345, 0)).toBe(12345);
        expect([1, 2, 3, 8].map((k) => rerollSeed(12345, k))).toEqual([1352004432, 1352024683, 1352044935, 1352146192]);
        for (let k = 1; k <= GEN_ROOM_DOOR_REROLLS; k += 1) {
            for (const drawn of [1, 2, 0x7ffffffe]) expect(rerollSeed(drawn, k)).toBeGreaterThan(0);
        }
        expect(GEN_ROOM_DOOR_REROLLS).toBe(8);
    });

    it('the registry\'s drive room (8x6, a/b, createRng(1)) seats on re-roll 2 — ONE engine draw, the seed recorded', () => {
        const rng = createRng(1);
        let calls = 0;
        const spy = { next: () => { calls += 1; return rng.next(); } };
        const drawn = ((createRng(1).next() * 0x7fffffff) | 0) || 1;
        const { world } = generateGenRoom({ region_id: 'probe', exits: [{ exit_id: 'a', side: 'N' }, { exit_id: 'b', side: 'S' }],
            size: { width: 8, height: 6 }, rng: spy, params: {} });
        expect(calls).toBe(1);
        expect(world.generation.rerolls).toBe(2);
        expect(world.seed).toBe(rerollSeed(drawn, 2));
    });

    it('a room that seats on the FIRST draw: rerolls 0, the drawn seed, and the generator\'s own record for it', () => {
        const rng = rngDrawing(7);
        const { world } = generateGenRoom({ region_id: 'first', exits: [{ exit_id: 'a' }], size: { width: 10, height: 10 }, rng, params: {} });
        expect(rng.calls).toBe(1);
        expect(world).toMatchObject({ seed: 7, generation: { rerolls: 0 } });
    });

    it('the goal is RE-CERTIFIED with the doors as walls: seed 25\'s flood-lawful doors fail the solver, so the room re-rolls', () => {
        const palette = GEN_ROOM_BIOMES['pre-sword'];
        const out = generateSeedlingLevel({ seed: 25, palette, defaults: { width: 10, height: 10 },
            bounds: { obstacleTarget: 6, triesPerStep: 8, saturationK: 3 } });
        const { doors } = pickDoorCells(out.record, out.summary.startCell, 2,
            { keepReachable: { cells: [out.summary.goalCell] } });
        expect(doors.map((d) => [d.tx, d.ty])).toEqual([[6, 4], [8, 5]]);
        expect(goalHoldsWithDoorsAsWalls(out, doors, palette.items ?? null)).toBe('REFUSED');
        const { world } = generateGenRoom({ region_id: 'r25', exits: [{ exit_id: 'a' }, { exit_id: 'b' }],
            size: { width: 10, height: 10 }, rng: rngDrawing(25), params: {} });
        expect(world.generation.rerolls).toBeGreaterThan(0);
        expect(world.seed).toBe(rerollSeed(25, world.generation.rerolls));
    });

    it('re-rolls EXHAUSTED → the refusal, saying "without sealing an approach"', () => {
        const exits = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ exit_id: `e${i}` }));
        expect(() => generateGenRoom({ region_id: 'seven', exits, size: { width: 8, height: 6 }, rng: createRng(3), params: {} }))
            .toThrow(/generated Seedling room 'seven' \(seed \d+, 8x6\) must hold 7 door\(s\), one per exit, and its walkable area cannot seat them apart without sealing an approach/);
    });
});

describe('hazards — no door, approach or location on water, lava or a pit (measured on the box, G2)', () => {
    let worlds;
    beforeAll(async () => {
        for (const rel of REGISTRY_LIBRARIES) {
            // eslint-disable-next-line no-await-in-loop
            await import(join(ROOT, rel));
        }
        worlds = {};
        for (const [name, state] of Object.entries({ spiral: SEEDLING_GENERATED_ROOM_STATE, leaf: SEEDLING_GENERATED_LEAF_STATE })) {
            // eslint-disable-next-line no-await-in-loop
            worlds[name] = (await runPresetHeadless(buildRunFromState(structuredClone(state)))).rulesJson;
        }
    }, 60000);

    it('the measured case: region_0_1\'s record has WATER where G1 put door 1 (6,6) and its approach (7,6)', () => {
        const p = worlds.spiral.preset_sidecars['1'].region_0_1.playable_payload;
        const hazards = hazardCells(p.record);
        expect(hazards.has('6,6') && hazards.has('7,6')).toBe(true);
        expect(p.exits.map((e) => e.exit_tiles[0])).not.toContainEqual([6, 6]);
    });

    it('in every generated room of both worlds: doors, approaches and locations stand on SAFE cells, reached safely', () => {
        let rooms = 0;
        for (const world of Object.values(worlds)) {
            for (const s of Object.values(world.preset_sidecars['1'])) {
                if (s.substrate !== 'flash_seedling_gen') continue;
                rooms += 1;
                const p = s.playable_payload;
                const hazards = hazardsOf(p.record);
                expect(hazardCells(p.record)).toEqual(hazards);
                const doors = p.exits.map((e) => ({ tx: e.exit_tiles[0][0], ty: e.exit_tiles[0][1] }));
                const seen = sealedFlood(p.record, p.start, [...doors, ...[...hazards].map((h) => {
                    const [tx, ty] = h.split(',').map(Number);
                    return { tx, ty };
                })]);
                for (const d of doors) expect(hazards.has(key(d)), `door ${key(d)}`).toBe(false);
                for (const e of p.exits) {
                    const a = { tx: e.entrance_spawn.x / 16, ty: e.entrance_spawn.y / 16 };
                    expect(hazards.has(key(a)) || !seen.has(key(a)), `approach ${key(a)}`).toBe(false);
                }
                for (const l of p.locations) expect(hazards.has(key(l.cell)), `location ${l.name}`).toBe(false);
            }
        }
        expect(rooms).toBe(3);
    });
});
