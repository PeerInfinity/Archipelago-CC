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
import { FLASH_SEEDLING_SUBSTRATE_ID } from './flashSeedlingLibrary.js';

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
