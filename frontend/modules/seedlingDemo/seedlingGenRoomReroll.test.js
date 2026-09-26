/**
 * ⛓⛓ SEEDLING GENERATED LEVELS G5 — **THE RE-ROLL FOR WHAT THE CORE DID NOT
 * SEE** (⚖ planner 2026-09-26: design (i) for engine-added doors, (B) for
 * locations — one function, one counter, one budget, no engine rng).
 *
 * G2's re-roll covered the doors the CORE mints. Two cases still refused where a
 * re-roll builds, both MEASURED at G5 W0 (the census in the plan's §10.1):
 *   1. an ENGINE-added door — sphere growth's back exit, grid growth's links —
 *      bound at serialize time: the sphere LEAF at 8×6 refused at 9/40 seeds,
 *      grid growth 3×3 at 8×6 at seeds 2/4/8 and at 10×10 at seed 7;
 *   2. LOCATIONS a room cannot seat safely — top-down Adventure seed 6's
 *      `Overworld` (11 locations, 10 free cells).
 * Each row names the world it was measured on.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import { SEEDLING_GENERATED_HOST_STATE, SEEDLING_GENERATED_LEAF_STATE } from '../procgenPipeline/presetDefs.js';
import { installSeedlingGenRoom } from '../flashPanel/flashSeedlingGenLibrary.js';
import * as room from './seedlingGenRoom.js';
import { walkableCellsFrom } from './levelSetExits.js';
import { generateSeedlingLevel } from './procgenSeedling.js';
import { buildLevelWorld } from './levelWorld.js';

const {
    GEN_ROOM_BIOMES, GEN_ROOM_DOOR_REROLLS, GEN_ROOM_REROLL_CAUSES, extractGenRules, goalHoldsWithDoorsAsWalls,
    rerollGenRoom,
} = room;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const GEN = 'flash_seedling_gen';
const committed = (name) => JSON.parse(readFileSync(join(ROOT, `frontend/presets/${name}/AP_1/AP_1_rules.json`), 'utf8'));

const build = async (state, ctx) => (await runPresetHeadless(buildRunFromState(structuredClone(state), ctx))).rulesJson;
const withSeed = (state, seed, extra = {}) => ({ ...state, params: { ...state.params, seed, ...extra } });
const rooms = (rulesJson) => Object.entries(rulesJson.preset_sidecars['1'])
    .filter(([, s]) => s.substrate === GEN).map(([id, s]) => [id, s.playable_payload]);
const GRID = (seed, w, h) => ({
    mode: 'gridGrowth', params: { seed, gridWidth: 3, gridHeight: 3, regionWidth: w, regionHeight: h },
    scenario: { items: { key_red: 1, key_blue: 1, victory: 1 }, obstacles: { door_red: 1, door_blue: 1 } },
    substrateQuotas: {}, substrateMix: { maze: 1, [GEN]: 1 }, substrateMode: 'mix',
});

const key = (c) => `${c.tx},${c.ty}`;
const cellOf = ([tx, ty]) => ({ tx, ty });
/** ⛔ The test's OWN hazard read and flood — never the subject's (a probe sharing its subject's assumption agrees with the bug). */
const hazardsOf = (record) => {
    const w = buildLevelWorld(record);
    return new Set([...w.lethalTerrainTiles, ...w.pitTiles].map((t) => `${Math.floor(t.x / 16)},${Math.floor(t.y / 16)}`));
};
function safeFlood(record, start, walls) {
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

/**
 * The laws a room answers AFTER any re-roll, read off its PAYLOAD: the seed is
 * the one the generator built; the record is the generator's own for that seed and
 * those knobs; every approach and location reachable safely with every door and
 * hazard a wall (the goal too, when the door-free safe flood reaches it — G2's law); and the generator's OWN solver re-certifies the goal on
 * the FINAL record with the final doors as walls (planner condition 4).
 */
function assertRoomLawful(id, p) {
    const g = p.generation;
    const out = generateSeedlingLevel({
        seed: p.seed, palette: GEN_ROOM_BIOMES[g.biome], defaults: { width: p.size.width, height: p.size.height },
        bounds: { obstacleTarget: g.obstacleTarget, triesPerStep: g.triesPerStep, saturationK: g.saturationK },
    });
    expect(out.record.layers, `${id}: the record is the generator's own for its seed`).toEqual(p.record.layers);
    const doors = p.exits.map((e) => cellOf(e.exit_tiles[0]));
    const hazards = hazardsOf(p.record);
    const reach = safeFlood(p.record, p.start, new Set([...hazards, ...doors.map(key)]));
    // G2's law: a cell past a solid the SOLVER clears (the goal, often) is no door's to seal — the
    // oracle below certifies it; what the door-FREE safe flood reaches, the doors must not cut off.
    const free = safeFlood(p.record, p.start, hazards);
    for (const e of p.exits) {
        expect(reach.has(key({ tx: e.entrance_spawn.x / 16, ty: e.entrance_spawn.y / 16 })), `${id} ${e.exitName}'s approach`).toBe(true);
    }
    for (const [i, l] of p.locations.entries()) {
        if (i === 0 && !free.has(key(l.cell))) continue; // location 0 IS the goal cell
        expect(reach.has(key(l.cell)), `${id} ${l.name}`).toBe(true);
    }
    if (free.has(key(p.goal_cell))) expect(reach.has(key(p.goal_cell)), `${id}: the goal`).toBe(true);
    expect(goalHoldsWithDoorsAsWalls(out, doors, GEN_ROOM_BIOMES[g.biome].items ?? null), `${id}: re-certified`).toBe(true);
}

describe('the re-roll\'s record — one counter, one cause, nothing on a first draw', () => {
    it('the causes are three SPELLED sentences; the budget is still G2\'s K', () => {
        expect(GEN_ROOM_REROLL_CAUSES).toEqual({ doors: 'doors', engineDoors: 'engine-added door', locations: 'locations' });
        expect(GEN_ROOM_DOOR_REROLLS).toBe(8);
    });

    it('a FIRST-DRAW world is byte-identical: the committed leaf and host rebuild to their files, no `rerollCause`, no drawn seed', async () => {
        for (const [name, state] of [['seedling_generated_leaf', SEEDLING_GENERATED_LEAF_STATE],
            ['seedling_generated_host', SEEDLING_GENERATED_HOST_STATE]]) {
            const rulesJson = await build(state);
            expect(rulesJson, name).toEqual(committed(name));
            for (const [id, p] of rooms(rulesJson)) {
                expect(p.generation.rerolls, id).toBe(0);
                expect(Object.hasOwn(p.generation, 'rerollCause'), id).toBe(false);
                expect(Object.hasOwn(p, 'drawnSeed'), id).toBe(false);
            }
        }
    }, 60_000);
});

describe('case 1 — an ENGINE-added door re-rolls the room at serialize time (design (i))', () => {
    /**
     * ⛓ MEASURED at G5 W0: the committed leaf state at 8×6 refused at seeds 10,
     * 11, 12, 16, 18, 25, 31, 35, 36 (of 1–40) — each its back exit, the room's one
     * door, inserted by the ENGINE after the core ran.
     */
    const LEAF_REFUSED_AT_BASE = [10, 11, 12, 16, 18, 25, 31, 35, 36];
    it.each(LEAF_REFUSED_AT_BASE)('the sphere LEAF, seed %i: builds, re-rolled for its engine-added door, lawful', async (seed) => {
        const rulesJson = await build(withSeed(SEEDLING_GENERATED_LEAF_STATE, seed));
        const generated = rooms(rulesJson);
        expect(generated).toHaveLength(1);
        const [id, p] = generated[0];
        expect(p.generation.rerolls, id).toBeGreaterThan(0);
        expect(p.generation.rerollCause, id).toBe(GEN_ROOM_REROLL_CAUSES.engineDoors);
        expect(p.exits).toHaveLength(1);
        assertRoomLawful(id, p);
    }, 60_000);

    it.each([
        ['8x6', 2, 8, 6], ['8x6', 4, 8, 6], ['10x10', 7, 10, 10],
    ])('grid growth 3x3 at %s, seed %i (refused at the base): builds; each engine-door re-roll recorded; every room lawful', async (_s, seed, w, h) => {
        const rulesJson = await build(GRID(seed, w, h));
        const generated = rooms(rulesJson);
        expect(generated.some(([, p]) => p.generation.rerollCause === GEN_ROOM_REROLL_CAUSES.engineDoors)).toBe(true);
        for (const [id, p] of generated) assertRoomLawful(id, p);
    }, 60_000);

    it('grid growth 3x3 at 8x6, seed 8: a room whose engine-added doors no draw seats REFUSES, naming the case and the budget', async () => {
        await expect(build(GRID(8, 8, 6))).rejects.toThrow(new RegExp(
            `generated Seedling room 'region_1_0' \\(seed \\d+, 8x6\\) must hold 3 door\\(s\\), one per exit, 2 of them an `
            + `engine-added door .* re-rolled up to ${GEN_ROOM_DOOR_REROLLS} time\\(s\\), the budget`));
    }, 60_000);

    /**
     * ⛓ Planner condition 2 — a regeneration keeps the AP LOGIC. The host preset,
     * with every room's regeneration FORCED at serialize time (`rerollGenRoom`
     * over the final exit list, as the engine-door path calls it): the extracted
     * rules are deep-equal, the rules.json outside `preset_sidecars` is
     * deep-equal, and inside the room's sidecar only the fields a room's GEOMETRY
     * writes move.
     */
    it('a FORCED regeneration on the host preset moves no rule: extracted rules and the rules.json outside the sidecars unmoved', async () => {
        const seen = [];
        installSeedlingGenRoom({
            ...room,
            serializeGenRoom: (world, extracted, o, i, context) => {
                const rows = world.locations.map(({ cell: _c, tag: _t, ...row }) => row);
                const forced = rerollGenRoom(world, [...world.exits.entries()], rows, GEN_ROOM_REROLL_CAUSES.engineDoors);
                expect(forced.err).toBeUndefined();
                seen.push({ before: extractGenRules(world), after: extractGenRules(forced.room), room: forced.room });
                return room.serializeGenRoom(forced.room, extracted, o, i, context);
            },
        });
        let forcedJson;
        try {
            forcedJson = await build(SEEDLING_GENERATED_HOST_STATE);
        } finally {
            installSeedlingGenRoom(room);
        }
        const base = committed('seedling_generated_host');
        expect(seen).toHaveLength(1);
        expect(seen[0].after).toEqual(seen[0].before);
        const { preset_sidecars: forcedSidecars, ...forcedRest } = forcedJson;
        const { preset_sidecars: baseSidecars, ...baseRest } = base;
        expect(forcedRest).toEqual(baseRest);
        const GEOMETRY = ['seed', 'record', 'start', 'goal_cell', 'generation', 'locations', 'exits'];
        for (const [id, s] of Object.entries(baseSidecars['1'])) {
            const f = forcedSidecars['1'][id];
            if (s.substrate !== GEN) { expect(f, id).toEqual(s); continue; }
            const strip = (p) => Object.fromEntries(Object.entries(p).filter(([k]) => !GEOMETRY.includes(k)));
            expect(strip(f.playable_payload), id).toEqual(strip(s.playable_payload));
            expect(f.playable_payload.seed, `${id}: it DID re-roll`).not.toBe(s.playable_payload.seed);
            // what a location and a door keep: every name, item, rule, AP exit name and target
            const logicOfLoc = (l) => ({ name: l.name, item: l.item, access_rule: l.access_rule });
            expect(f.playable_payload.locations.map(logicOfLoc)).toEqual(s.playable_payload.locations.map(logicOfLoc));
            const logicOfExit = ({ exit_id: _d, exit_tiles: _t, entrance_tile: _e, entrance_spawn: _s, ...rest }) => rest;
            expect(f.playable_payload.exits.map(logicOfExit)).toEqual(s.playable_payload.exits.map(logicOfExit));
            expect(f.playable_payload.generation).toMatchObject({ rerolls: 1, rerollCause: GEN_ROOM_REROLL_CAUSES.engineDoors });
            assertRoomLawful(id, f.playable_payload);
        }
    }, 60_000);
});
