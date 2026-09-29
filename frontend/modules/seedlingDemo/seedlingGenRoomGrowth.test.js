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
 * Measured on two census worlds: the FIRST seed of grid growth 3×3 at 8×6 and of
 * the host state at 8×6 whose world holds a grown room, and that room — FOUND by
 * a scan in `beforeAll` (APWORLD SUBSTRATE CHANGE H1, plan §46; trap 1464), not
 * listed. ⛓ They were listed until H1: grid seed 1 (`region_2_1`) until C1 (plan
 * §42), whose maze key filter moved its draw so it no longer grew, then seed 6
 * (`region_1_1`) by hand; the host world seed 26 (`region_2_2`). At H1 the scan
 * finds grid seed 3 (`region_1_1`) — seed 6 was never the first grower after C1 —
 * and host seed 26 (`region_2_2`).
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
const GRID_8x6 = (seed) => ({
    mode: 'gridGrowth', params: { seed, gridWidth: 3, gridHeight: 3, regionWidth: 8, regionHeight: 6 },
    scenario: { items: { key_red: 1, key_blue: 1, victory: 1 }, obstacles: { door_red: 1, door_blue: 1 } },
    substrateQuotas: {}, substrateMix: { maze: 1, [GEN]: 1 }, substrateMode: 'mix',
});
const HOST_8x6 = (seed) => ({ ...SEEDLING_GENERATED_HOST_STATE,
    params: { ...SEEDLING_GENERATED_HOST_STATE.params, seed, regionWidth: 8, regionHeight: 6 } });
const KINDS = [['grid 8x6', GRID_8x6], ['host 8x6', HOST_8x6]];
const WORLDS = KINDS.map(([name]) => [name]);
const GROWN = { width: 10, height: 8 };
/**
 * ⛓ The scan's bound: the widest gap between consecutive growers measured over
 * seeds 1–40 at H1 (26 seeds — the host state's first grower), doubled — the
 * same measurement `seedlingGenRoomReroll.test.js`'s G8 census bounds by.
 */
const FIRST_GROWER_BOUND = 26 * 2;

/** The rules.json with one region's sidecar taken out — everything the room's size could have reached. */
const without = (rules, region) => {
    const copy = structuredClone(rules);
    delete copy.preset_sidecars['1'][region];
    return copy;
};

/** Per kind: the first world with a grown generated room — `{seed, state, region, rules}`. */
const found = {};
const built = {};
beforeAll(async () => {
    for (const rel of REGISTRY_LIBRARIES) {
        // eslint-disable-next-line no-await-in-loop
        await import(join(ROOT, rel));
    }
    for (const [name, make] of KINDS) {
        for (let seed = 1; seed <= FIRST_GROWER_BOUND && !found[name]; seed += 1) {
            // eslint-disable-next-line no-await-in-loop
            const rules = await build(make(seed));
            const grown = Object.entries(rules.preset_sidecars['1'])
                .find(([, sc]) => sc.substrate === GEN && sc.playable_payload.generation?.grownFrom);
            if (grown) found[name] = { seed, state: make(seed), region: grown[0], rules };
        }
        if (!found[name]) throw new Error(`${name}: no world with a grown room within ${FIRST_GROWER_BOUND} seeds`);
        built[name] = found[name].rules;
        // eslint-disable-next-line no-console
        console.log(`G8 task 2 census, ${name}: seed ${found[name].seed}, ${found[name].region}`);
    }
}, 300_000);

describe('G8 task 2 — every reader of a grown room\'s `size`', () => {
    it.each(WORLDS)('%s: the room GREW (the precondition every row below reads)', (name) => {
        const { region } = found[name];
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
    it.each(WORLDS)('%s: outside its own sidecar the world is byte-identical to the room ASKED at 10x8', async (name) => {
        const { state, region } = found[name];
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

    it.each(WORLDS)('%s: G2\'s assembler emits the GROWN record — a valid set, one apitem per location', (name) => {
        const { region } = found[name];
        const rules = built[name];
        const out = assembleGeneratedSeedlingSet(rules, {});
        const level = out.levelOf.get(region);
        const record = out.set.rooms[level].source.record;
        expect([record.width, record.height]).toEqual([GROWN.width, GROWN.height]);
        const p = rules.preset_sidecars['1'][region].playable_payload;
        expect(out.report.apitems.filter((a) => a.region === region)).toHaveLength(p.locations.length);
        expect(out.report.doors.filter((d) => d.region === region)).toHaveLength(p.exits.length);
    });

    it.each(WORLDS)('%s: the gates\' walker (`roomPath`) plans over the grown room — every approach and location reached', (name) => {
        const { region } = found[name];
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
