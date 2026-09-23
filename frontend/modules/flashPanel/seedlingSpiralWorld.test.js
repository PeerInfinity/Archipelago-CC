/**
 * ⛓⛓⛓ SEEDLING IN THE PIPELINE T1 — **A SHUFFLED-SPIRAL WORLD WITH ONE REAL
 * SEEDLING ROOM, BUILT HEADLESS** through `presetRun.js` — the same assembly
 * the Procgen Pipeline panel's Generate calls (`buildRunFromState` →
 * `runPresetHeadless`), with the panel's whole registry loaded
 * (`REGISTRY_LIBRARIES`, the every-preset row's preload).
 *
 * This is T2's oracle: the preset it commits must equal the world built here.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { buildRunFromState, runPresetHeadless } from '../procgenPipeline/presetRun.js';
import { FLASH_SEEDLING_SUBSTRATE_ID, SEEDLING_STARTER_ATLAS } from './flashSeedlingLibrary.js';
import { SIDES } from '../shared/procgen/spatialPrimitives.js';
import { rulesJsonSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
import { loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { reachableRegions, regionsOf } from '../procgenCore/rulesGraph.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const COMMITTED = JSON.parse(readFileSync(
    join(ROOT, 'frontend/presets/seedling_atlas/AP_1/AP_1_rules.json'), 'utf8'));

/** The one-room world: three maze rooms and ONE real Seedling room, seed 1. */
export const ONE_ROOM_STATE = Object.freeze({
    mode: 'shuffledSpiral',
    params: { seed: 1, regionWidth: 8, regionHeight: 6 },
    scenario: { items: {}, obstacles: {} },
    substrateQuotas: { maze: 3, [FLASH_SEEDLING_SUBSTRATE_ID]: 1 },
    substrateMix: {},
    substrateMode: 'quotas',
});
const build = async (state) => runPresetHeadless(buildRunFromState(structuredClone(state)));

/** The top-level blocks the flash panel reads, and the committed atlas preset's values for them. */
const PANEL_BLOCKS = ['region_atlas', 'flash_panel'];

describe('the one-room spiral world — the two top-level blocks', () => {
    it('a world that realised a Seedling room carries `region_atlas` and `flash_panel`, the atlas\'s own values', async () => {
        const { rulesJson } = await build(ONE_ROOM_STATE);
        const realised = Object.values(rulesJson.preset_sidecars['1']).map((s) => s.substrate);
        expect(realised).toContain(FLASH_SEEDLING_SUBSTRATE_ID);
        for (const key of PANEL_BLOCKS) {
            expect(COMMITTED[key], `the committed seedling_atlas preset carries ${key}`).toBeTruthy();
            expect(rulesJson[key], key).toEqual(COMMITTED[key]);
        }
    });

    it('the same state with the Seedling quota moved to the maze carries NEITHER block', async () => {
        const { rulesJson } = await build({ ...ONE_ROOM_STATE, substrateQuotas: { maze: 4 } });
        const realised = Object.values(rulesJson.preset_sidecars['1']).map((s) => s.substrate);
        expect(realised).not.toContain(FLASH_SEEDLING_SUBSTRATE_ID);
        for (const key of PANEL_BLOCKS) expect(Object.hasOwn(rulesJson, key), key).toBe(false);
    });
});

describe('the one-room spiral world, end to end (T2\'s oracle)', () => {
    const bySubstrate = (rulesJson, id) => Object.entries(rulesJson.preset_sidecars['1'])
        .filter(([, s]) => s.substrate === id);

    it('ONE real room: real atlas doors, external to the maze, level = the atlas region\'s map_ref', async () => {
        const { rulesJson, ms } = await build(ONE_ROOM_STATE);
        console.log(`one-room spiral world: ${Object.keys(rulesJson.preset_sidecars['1']).length} regions, ${ms} ms`);
        const rooms = bySubstrate(rulesJson, FLASH_SEEDLING_SUBSTRATE_ID);
        expect(rooms).toHaveLength(1);
        const [[regionId, { playable_payload: p }]] = rooms;
        const atlasRegion = SEEDLING_STARTER_ATLAS.regions.find((r) => r.region_id === p.atlas_region);
        expect(p.level).toBe(atlasRegion.map_ref);
        const atlasDoorIds = atlasRegion.exits
            .filter((e) => (p.atlas_sub_region === undefined ? true : e.sub_region === p.atlas_sub_region))
            .map((e) => e.exit_id);
        const apExits = regionsOf(rulesJson)[regionId].exits.map((e) => e.name);
        expect(p.exits.length).toBeGreaterThan(0);
        expect(p.exits.map((e) => e.exitName).sort()).toEqual([...apExits].sort());
        for (const door of p.exits) {
            expect(atlasDoorIds, door.exit_id).toContain(door.exit_id);
            expect(SIDES).toContain(door.side);
            expect(door).toMatchObject({
                external: true, target_substrate: 'maze', target_level: null, target_spawn: null,
            });
            // the maze neighbour behind the door has an exit leading back
            const neighbour = rulesJson.preset_sidecars['1'][door.targetRegion];
            expect(neighbour?.substrate, door.targetRegion).toBe('maze');
            const back = [...neighbour.playable_payload.exits].filter((e) => e.targetRegion === regionId);
            expect(back.length, `${door.targetRegion} -> ${regionId}`).toBeGreaterThan(0);
        }
    });

    it('the rules.json is schema-valid and every region is reachable from the start (free evaluator)', async () => {
        const { rulesJson } = await build(ONE_ROOM_STATE);
        expect(rulesJsonSchemaErrors(rulesJson, loadRulesSchema())).toEqual([]);
        const all = Object.keys(regionsOf(rulesJson));
        expect(all.length).toBeGreaterThan(4);
        expect([...reachableRegions(rulesJson)].sort()).toEqual([...all].sort());
    });

    it('the same world built TWICE is byte-identical', async () => {
        const a = await build(ONE_ROOM_STATE);
        const b = await build(ONE_ROOM_STATE);
        expect(JSON.stringify(b.rulesJson)).toBe(JSON.stringify(a.rulesJson));
    });
});
