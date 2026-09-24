/**
 * ⛓⛓⛓ SEEDLING GENERATED LEVELS G1 — **THE PIPELINE SPECIFIES A SEEDLING ROOM
 * AND GETS ONE BACK, IN EVERY DRIVER**, headless, through `presetRun.js` (the
 * assembly the Procgen Pipeline panel's Generate calls) with the panel's whole
 * registry loaded (`REGISTRY_LIBRARIES` — which brings `flash_seedling_gen`'s
 * BUILD door, `flashSeedlingGenBuild.js`).
 *
 * Per world: built twice byte-identically; schema-valid; every region reachable
 * (the free evaluator); every generated sidecar CARRIES its room (`record`), its
 * `level` is its ordinal among the generated regions, it has ONE door per
 * stitched exit spelled `out_teleporter_<px>_<py>`, arrivals land on the door's
 * approach cell, and its AP item stands on the goal cell; the rules.json carries
 * `flash_panel` and NO `region_atlas`. G2 assembles and plays these worlds.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import { SEEDLING_GENERATED_ROOM_STATE, SEEDLING_GENERATED_LEAF_STATE } from '../procgenPipeline/presetDefs.js';
import { FLASH_SEEDLING_GEN_SUBSTRATE_ID } from './flashSeedlingGenLibrary.js';
import { seedlingFlashPanelBlock } from './flashSeedlingLibrary.js';
import { walkableCellsFrom } from '../seedlingDemo/levelSetExits.js';
import { rulesJsonSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
import { loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { reachableRegions, regionsOf } from '../procgenCore/rulesGraph.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const SEEDLING_ATLAS = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/seedling_atlas/AP_1/AP_1_rules.json'), 'utf8'));

const build = async (state, ctx) => runPresetHeadless(buildRunFromState(structuredClone(state), ctx));
const generatedOf = (rulesJson) => Object.entries(rulesJson.preset_sidecars['1'])
    .filter(([, s]) => s.substrate === FLASH_SEEDLING_GEN_SUBSTRATE_ID);

/** Every per-sidecar law, over one built world. */
function assertGeneratedSidecars(rulesJson) {
    const sidecars = rulesJson.preset_sidecars['1'];
    const apRegions = regionsOf(rulesJson);
    const generated = generatedOf(rulesJson);
    generated.forEach(([regionId, { playable_payload: p }], ordinal) => {
        const at = `${regionId}`;
        expect(p.generated, at).toBe(true);
        expect(p.record, at).toMatchObject({ width: p.size.width, height: p.size.height });
        // ⛓ level = the region's ordinal among flash_seedling_gen regions, sidecar order
        expect(p.level, at).toBe(ordinal);
        // ⛓ one door per stitched exit — the payload's exits ARE the AP region's exits
        const apExits = apRegions[regionId].exits.map((e) => e.name);
        expect(p.exits.map((e) => e.exitName).sort(), at).toEqual([...apExits].sort());
        const flood = walkableCellsFrom(p.record, p.start);
        const doorCells = new Set();
        for (const door of p.exits) {
            const [tx, ty] = door.exit_tiles[0];
            doorCells.add(`${tx},${ty}`);
            expect(door.exit_id, at).toBe(`out_teleporter_${tx * 16}_${ty * 16}`);
            // ⛓ the arrival: the door's APPROACH cell, never the door tile
            const from = flood.get(`${tx},${ty}`)?.from;
            expect(from, `${at} ${door.exit_id} is in the room's flood`).toBeTruthy();
            expect(door.entrance_spawn, at).toEqual({ x: from.tx * 16, y: from.ty * 16 });
            expect(door, at).toMatchObject({ kind: 'teleporter', external: true, target_level: null, target_spawn: null });
            expect(door.target_substrate, at).toBe(sidecars[door.targetRegion]?.substrate ?? null);
            expect('x' in door || 'y' in door, `${at}: no engine tile on a door`).toBe(false);
        }
        expect(doorCells.size, `${at}: distinct doors`).toBe(p.exits.length);
        // ⛓ the AP locations: the first on the goal cell, each a real AP location of the region
        const apLocations = apRegions[regionId].locations.map((l) => l.name);
        expect(p.locations.map((l) => l.name).sort(), at).toEqual([...apLocations].sort());
        if (p.locations.length) expect(p.locations[0].cell, at).toEqual(p.goal_cell);
        expect(new Set(p.locations.map((l) => l.tag)).size, at).toBe(p.locations.length);
    });
    expect(rulesJson.flash_panel).toEqual(seedlingFlashPanelBlock());
    expect(Object.hasOwn(rulesJson, 'region_atlas')).toBe(false);
    return generated;
}

function assertWorldSound(rulesJson) {
    expect(rulesJsonSchemaErrors(rulesJson, loadRulesSchema())).toEqual([]);
    const all = Object.keys(regionsOf(rulesJson));
    expect([...reachableRegions(rulesJson)].sort()).toEqual([...all].sort());
}

describe('the spiral — SEEDLING_GENERATED_ROOM_STATE (maze 2 + flash_seedling_gen 2, seed 1, 10x10)', () => {
    it('spells the quota with the entry\'s own id', () => {
        expect(SEEDLING_GENERATED_ROOM_STATE.substrateQuotas[FLASH_SEEDLING_GEN_SUBSTRATE_ID]).toBe(2);
    });

    it('builds twice byte-identically; schema-valid; every region reachable', async () => {
        const a = await build(SEEDLING_GENERATED_ROOM_STATE);
        const b = await build(SEEDLING_GENERATED_ROOM_STATE);
        console.log(`generated spiral world: ${Object.keys(a.rulesJson.preset_sidecars['1']).length} regions, ${a.ms} / ${b.ms} ms`);
        expect(JSON.stringify(a.rulesJson)).toBe(JSON.stringify(b.rulesJson));
        assertWorldSound(a.rulesJson);
    }, 60_000);

    it('two generated rooms carry their rooms, doors and the blue key on a goal cell', async () => {
        const { rulesJson } = await build(SEEDLING_GENERATED_ROOM_STATE);
        const generated = assertGeneratedSidecars(rulesJson);
        expect(generated).toHaveLength(2);
        const holding = generated.filter(([, s]) => s.playable_payload.locations.some((l) => l.item === 'key_blue'));
        expect(holding).toHaveLength(1);
        const [[, { playable_payload: p }]] = holding;
        expect(p.locations[0]).toMatchObject({ item: 'key_blue', cell: p.goal_cell });
    }, 60_000);

    it('the committed seedling_generated_room preset IS this world (G2)', async () => {
        // The byte gate is make-seedling-spiral-room-preset.mjs --state=generated --check;
        // this row keeps the equality in the CI suite, format-agnostic.
        const committed = JSON.parse(readFileSync(
            join(ROOT, 'frontend/presets/seedling_generated_room/AP_1/AP_1_rules.json'), 'utf8'));
        const { rulesJson } = await build(SEEDLING_GENERATED_ROOM_STATE);
        expect(committed).toEqual(rulesJson);
    }, 60_000);
});

describe('sphere growth — SEEDLING_GENERATED_LEAF_STATE (a 1-item generated leaf behind a maze gate)', () => {
    it('builds twice byte-identically, oracle clean; schema-valid; every region reachable', async () => {
        const a = await build(SEEDLING_GENERATED_LEAF_STATE);
        const b = await build(SEEDLING_GENERATED_LEAF_STATE);
        console.log(`generated sphere world: ${Object.keys(a.rulesJson.preset_sidecars['1']).length} regions, ${a.ms} / ${b.ms} ms`);
        expect(JSON.stringify(a.rulesJson)).toBe(JSON.stringify(b.rulesJson));
        expect(a.oracleErrors).toEqual([]);
        assertWorldSound(a.rulesJson);
    }, 60_000);

    it('the generated room is a LEAF holding one item, entered through its parent\'s gated exit', async () => {
        const { rulesJson } = await build(SEEDLING_GENERATED_LEAF_STATE);
        const generated = assertGeneratedSidecars(rulesJson);
        expect(generated).toHaveLength(1);
        const [[regionId, { playable_payload: p }]] = generated;
        expect(p.exits).toHaveLength(1);            // the door back to its parent — inserted by the ENGINE
        expect(p.locations).toHaveLength(1);
        expect(p.locations[0].cell).toEqual(p.goal_cell);
        const parent = p.exits[0].targetRegion;
        expect(rulesJson.preset_sidecars['1'][parent].substrate).toBe('maze');
        const gate = regionsOf(rulesJson)[parent].exits.find((e) => e.connected_region === regionId).access_rule;
        expect(gate.rule).not.toBe('True_');
    }, 60_000);

    it('the committed seedling_generated_leaf preset IS this world (G3)', async () => {
        // The byte gate is make-seedling-spiral-room-preset.mjs --state=generated-leaf --check;
        // this row keeps the equality in the CI suite, format-agnostic.
        const committed = JSON.parse(readFileSync(
            join(ROOT, 'frontend/presets/seedling_generated_leaf/AP_1/AP_1_rules.json'), 'utf8'));
        const { rulesJson } = await build(SEEDLING_GENERATED_LEAF_STATE);
        expect(committed).toEqual(rulesJson);
    }, 60_000);
});

describe('top-down over the seedling_atlas source, mix {flash_seedling_gen: 1}', () => {
    const topDown = (seed, params) => build({
        mode: 'topDown', params: { seed, ...params }, scenario: { items: {}, obstacles: {} },
        substrateQuotas: {}, substrateMix: { [FLASH_SEEDLING_GEN_SUBSTRATE_ID]: 1 }, substrateMode: 'mix',
    }, { topDownSource: SEEDLING_ATLAS, sphereLog: null });

    /**
     * ⛓ T3 §17.6 measured top-down REFUSING `flash_seedling` here: the start
     * region asks for 7 "sides" and the zone realiser's four ran dry. A
     * procedural room mints one door per exit, so the seven-door room BUILDS —
     * given room for seven non-adjacent doors (10x10) and a grid that places all
     * ten source regions (5x5).
     */
    it.each([1, 4])('seed %i: all ten source regions, the start region a SEVEN-door room', async (seed) => {
        const { rulesJson, ms } = await topDown(seed, { regionWidth: 10, regionHeight: 10, gridWidth: 5, gridHeight: 5 });
        console.log(`top-down seedling_atlas seed ${seed}: ${ms} ms`);
        assertWorldSound(rulesJson);
        const generated = assertGeneratedSidecars(rulesJson);
        expect(generated).toHaveLength(Object.keys(SEEDLING_ATLAS.regions['1']).length - 1); // all but Menu
        const start = rulesJson.preset_sidecars['1'].overworld_start__r8c0.playable_payload;
        expect(start.exits).toHaveLength(7);
        // the source's one location keeps its name, on its room's goal cell
        const house = rulesJson.preset_sidecars['1'].starting_house.playable_payload;
        expect(house.locations.map((l) => l.name)).toEqual(['Starting House - Chest']);
    }, 60_000);

    it('at the default 8x6 the seven doors do not fit — REFUSED by name, saying what to raise', async () => {
        await expect(topDown(1, {})).rejects.toThrow(
            /generated Seedling room 'overworld_start__r8c0' \(seed \d+, 8x6\) must hold 7 door\(s\), one per exit.*Raise the region size/);
    }, 60_000);
});

describe('grid growth — maze + flash_seedling_gen', () => {
    it('builds twice byte-identically; schema-valid; every region reachable; the generated rooms lawful', async () => {
        // ⛓ G2: 10x10, not the 8x6 default. Under `keepReachable` (no door seals an
        //   approach) seed 1 at 8x6 REFUSES: `region_0_1` gets an ENGINE-added exit its
        //   12-cell room cannot seat unsealed, and an engine-added door cannot re-roll
        //   (the room and its locations are fixed by then). G1 built it with a sealed door.
        const state = {
            mode: 'gridGrowth', params: { seed: 1, gridWidth: 3, gridHeight: 3, regionWidth: 10, regionHeight: 10 },
            scenario: { items: { key_red: 1, key_blue: 1, victory: 1 }, obstacles: { door_red: 1, door_blue: 1 } },
            substrateQuotas: {}, substrateMix: { maze: 1, [FLASH_SEEDLING_GEN_SUBSTRATE_ID]: 1 }, substrateMode: 'mix',
        };
        const a = await build(state);
        const b = await build(state);
        console.log(`grid growth maze + flash_seedling_gen: ${a.ms} / ${b.ms} ms`);
        expect(JSON.stringify(a.rulesJson)).toBe(JSON.stringify(b.rulesJson));
        assertWorldSound(a.rulesJson);
        expect(assertGeneratedSidecars(a.rulesJson).length).toBeGreaterThan(0);
    }, 60_000);
});

describe('the generator\'s knobs reach the BUILT room in every mode that builds one (G3)', () => {
    /**
     * ⛓ G3 W0 measured the spiral and the grid growth building every room at the
     * DEFAULTS whatever the bag said (`regionParams: {}`); G3 passes the in-mix
     * `buildRegionParams` hooks through. The knobs are read back off each room's
     * payload (`generation`), the value the form reopens on.
     */
    const KNOBS = { seedlingGenObstacleTarget: 2, seedlingGenFill: 'shell' };
    const GRID = {
        mode: 'gridGrowth', params: { seed: 1, gridWidth: 3, gridHeight: 3, regionWidth: 10, regionHeight: 10 },
        scenario: { items: { key_red: 1, key_blue: 1, victory: 1 }, obstacles: { door_red: 1, door_blue: 1 } },
        substrateQuotas: {}, substrateMix: { maze: 1, [FLASH_SEEDLING_GEN_SUBSTRATE_ID]: 1 }, substrateMode: 'mix',
    };
    it.each([
        ['the spiral', SEEDLING_GENERATED_ROOM_STATE],
        ['sphere growth', SEEDLING_GENERATED_LEAF_STATE],
        ['grid growth', GRID],
    ])('%s: every generated room records obstacleTarget 2 and fill shell', async (_name, state) => {
        const { rulesJson } = await build({ ...state, params: { ...state.params, ...KNOBS } });
        const rooms = generatedOf(rulesJson);
        expect(rooms.length).toBeGreaterThan(0);
        for (const [regionId, { playable_payload: p }] of rooms) {
            expect(p.generation, regionId).toMatchObject({ obstacleTarget: 2, fill: 'shell' });
        }
    }, 60_000);
});
