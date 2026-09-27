/**
 * ⛓⛓ SEEDLING GENERATED LEVELS G8 task 2 — **EVERY READER OF A GROWN ROOM'S
 * `size`** (plan §14 W0 #2: the table of readers, each proved here, not assumed).
 *
 * A room that grew (`seedlingGenRoomReroll.test.js` › G8) carries its FINAL size
 * in `size` and its `record`, and the size it was asked for in
 * `generation.grownFrom`. What must hold downstream:
 *   - the ENGINE reads no room's `size` back: a Seedling room is SIDES geometry,
 *     so its neighbours (and everything outside its own sidecar) are byte-identical
 *     to the same world with the room asked for at its grown size directly;
 *   - G2's ASSEMBLER emits the grown record (`validateLevelSet` inside it refuses a
 *     set it cannot place), one apitem per location;
 *   - the gates' WALKER (`seedlingRoomPlay.roomPath`) plans over the grown room:
 *     every door approach and location reached from the start;
 *   - the COMPOSITE MAP (a loaded document) sizes its cells off the payloads that
 *     carry `width`/`height` (the mazes) — a grown room moves no cell.
 * Measured on the two census worlds G8 closed: grid growth 3×3 at 8×6 seed 1
 * (`region_2_1` grows to 10×8) and the host state at 8×6 seed 26 (`region_2_2`).
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeAll } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { roomPath } from '../../../scripts/procgen/seedlingRoomPlay.js';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import { SEEDLING_GENERATED_HOST_STATE } from '../procgenPipeline/presetDefs.js';
import { reconstructResultFromSidecars } from '../procgenPipeline/compositeMapDocument.js';
import { installSeedlingGenRoom } from '../flashPanel/flashSeedlingGenLibrary.js';
import * as room from './seedlingGenRoom.js';
import { walkableCellsFrom } from './levelSetExits.js';
import { buildLevelWorld } from './levelWorld.js';
import { assembleGeneratedSeedlingSet } from './seedlingGeneratedSet.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const GEN = 'flash_seedling_gen';

const build = async (state) => (await runPresetHeadless(buildRunFromState(structuredClone(state)))).rulesJson;
const GRID_8x6_S1 = {
    mode: 'gridGrowth', params: { seed: 1, gridWidth: 3, gridHeight: 3, regionWidth: 8, regionHeight: 6 },
    scenario: { items: { key_red: 1, key_blue: 1, victory: 1 }, obstacles: { door_red: 1, door_blue: 1 } },
    substrateQuotas: {}, substrateMix: { maze: 1, [GEN]: 1 }, substrateMode: 'mix',
};
const HOST_8x6_S26 = { ...SEEDLING_GENERATED_HOST_STATE,
    params: { ...SEEDLING_GENERATED_HOST_STATE.params, seed: 26, regionWidth: 8, regionHeight: 6 } };
const WORLDS = [['grid 8x6 seed 1', GRID_8x6_S1, 'region_2_1'], ['host 8x6 seed 26', HOST_8x6_S26, 'region_2_2']];
const GROWN = { width: 10, height: 8 };

/** The rules.json with one region's sidecar taken out — everything the room's size could have reached. */
const without = (rules, region) => {
    const copy = structuredClone(rules);
    delete copy.preset_sidecars['1'][region];
    return copy;
};

const built = {};
beforeAll(async () => {
    for (const rel of REGISTRY_LIBRARIES) {
        // eslint-disable-next-line no-await-in-loop
        await import(join(ROOT, rel));
    }
    for (const [name, state] of WORLDS) {
        // eslint-disable-next-line no-await-in-loop
        built[name] = await build(state);
    }
}, 120_000);

describe('G8 task 2 — every reader of a grown room\'s `size`', () => {
    it.each(WORLDS)('%s: the room GREW (the precondition every row below reads)', (name, _state, region) => {
        const p = built[name].preset_sidecars['1'][region].playable_payload;
        expect(p.size).toEqual(GROWN);
        expect([p.record.width, p.record.height]).toEqual([GROWN.width, GROWN.height]);
        expect(p.generation.grownFrom).toEqual({ width: 8, height: 6 });
    });

    /**
     * ⛓ THE ENGINE — the same world with the room asked for at its grown size
     * DIRECTLY (a wrapped install: that one region's core is called with
     * `size: 10×8`): outside the room's own sidecar the rules.json is deep-equal.
     * So no stitching, adjacency, maze tile, rule, name or grid cell reads the
     * room's size — and the grown room's neighbours are byte-identical.
     */
    it.each(WORLDS)('%s: outside its own sidecar the world is byte-identical to the room ASKED at 10x8', async (name, state, region) => {
        installSeedlingGenRoom({ ...room, generateGenRoom: (input) => room.generateGenRoom(
            input.region_id === region ? { ...input, size: { ...GROWN } } : input) });
        let asked;
        try {
            asked = await build(state);
        } finally {
            installSeedlingGenRoom(room);
        }
        expect(asked.preset_sidecars['1'][region].playable_payload.size).toEqual(GROWN);
        expect(JSON.stringify(without(built[name], region))).toBe(JSON.stringify(without(asked, region)));
        const neighbours = Object.entries(built[name].preset_sidecars['1']).filter(([r]) => r !== region);
        expect(neighbours.length).toBeGreaterThan(0);
    }, 120_000);

    it.each(WORLDS)('%s: G2\'s assembler emits the GROWN record — a valid set, one apitem per location', (name, _state, region) => {
        const rules = built[name];
        const out = assembleGeneratedSeedlingSet(rules, {});
        const level = out.levelOf.get(region);
        const record = out.set.rooms[level].source.record;
        expect([record.width, record.height]).toEqual([GROWN.width, GROWN.height]);
        const p = rules.preset_sidecars['1'][region].playable_payload;
        expect(out.report.apitems.filter((a) => a.region === region)).toHaveLength(p.locations.length);
        expect(out.report.doors.filter((d) => d.region === region)).toHaveLength(p.exits.length);
    });

    it.each(WORLDS)('%s: the gates\' walker (`roomPath`) plans over the grown room — every approach and location reached', (name, _state, region) => {
        const p = built[name].preset_sidecars['1'][region].playable_payload;
        const readers = { walkableCellsFrom, buildLevelWorld };
        const inRoom = (c) => c.tx >= 0 && c.ty >= 0 && c.tx < p.size.width && c.ty < p.size.height;
        const approaches = p.exits.map((e) => ({ tx: e.entrance_spawn.x / p.tile_size, ty: e.entrance_spawn.y / p.tile_size }));
        for (const to of [...approaches, ...p.locations.slice(1).map((l) => l.cell)]) {
            const path = roomPath(p, p.start, to, readers);
            expect(path, `${region} → (${to.tx},${to.ty})`).not.toBeNull();
            for (const c of path) expect(inRoom(c)).toBe(true);
        }
        // at least one cell the walk uses lies OUTSIDE the asked 8×6 — the walker used the grown room
        const all = new Set(approaches.concat(p.locations.map((l) => l.cell)).map((c) => `${c.tx},${c.ty}`));
        expect([...all].some((k) => { const [tx, ty] = k.split(',').map(Number); return tx >= 7 || ty >= 5; })).toBe(true);
    });

    it.each(WORLDS)('%s: the composite map (a loaded document) sizes its cells off the mazes — the grown room moves no cell', (name) => {
        const result = reconstructResultFromSidecars(built[name]);
        expect(result.regionSize).toEqual({ width: 8, height: 6 });
    });
});
