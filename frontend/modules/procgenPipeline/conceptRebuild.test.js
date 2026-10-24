/**
 * ⛓⛓⛓ CONCEPT LIBRARY T0b, D3 — **THE WORLD'S CONCEPTS SURVIVE A REBUILD.**
 *
 * `rebuildEnvelopeFromRulesJson` reconstructs an append-ready envelope from a
 * compiled `rules.json`. It deserializes every placed region from its payload,
 * so a plain rebuild + compile keeps the skinned gates (measured before T0b).
 * But its `config.regionParams` was `opts.regionParams ?? {}` — and no caller
 * passes one — so every region an APPEND realises (the appended sphere, and the
 * kept region that now carries its gate) was placed with NO concept: measured
 * before T0b on the maze world below, `region_2_2:logic_gate_0` +
 * `region_2_2:logic_gate_1`. The compile now records the world's concept list
 * in `procgen_metadata[slot].concepts` (only when non-empty) and the rebuild
 * reads it back into `regionParams.concepts`.
 *
 * Two worlds, both headless through the panel's own assembly: T1's maze-only
 * sphere world, and a text-adventure-rooted sphere world over the same items
 * (the mix builds headless; its rooms carry the gates' prose).
 */
import { describe, it, expect } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import '../textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js';
import { buildRunFromState, runPresetHeadless } from './presetRun.js';
import {
    rebuildEnvelopeFromRulesJson, rebuildRegionParams, recordedConceptsOf, RECORDED_CONCEPTS_KEY,
} from './procgenPipelineEngine.js';
import { appendSphere, runStep } from './sphereSteps.js';
import { DEFAULT_ITEMS, DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import { TEXT_ADVENTURE_CONCEPT_REALISATIONS } from '../textAdventureSubstrateWrapper/textAdventureConceptRealisations.js';

const CONCEPT_LIST = ['sword', 'guardian', 'swim', 'water'];
const bundle = (concepts, { startSubstrate = 'maze', substrateQuotas = { maze: 99 } } = {}) => ({
    mode: 'sphereGrowth',
    params: { seed: 1, startSubstrate, sphereCount: 3, fillerCount: 0, revisitPercent: 25, concepts },
    scenario: { items: { 'Progressive Sword': 1, 'Progressive Swim': 1, victory: 1 }, obstacles: {} },
    substrateQuotas,
    substrateMix: {},
    substrateMode: 'quotas',
});
const TA_WORLD = { startSubstrate: 'text_adventure', substrateQuotas: { maze: 2, text_adventure: 99 } };
const OPTS = { itemLib: DEFAULT_ITEMS, obstacleLib: DEFAULT_OBSTACLES };

const rebuild = (rulesJson) => rebuildEnvelopeFromRulesJson(structuredClone(rulesJson), OPTS);
const gatesOf = (rulesJson) => Object.entries(rulesJson.preset_sidecars['1'])
    .flatMap(([rid, s]) => Object.keys(s.playable_payload?.obstacleLib ?? {}).map((id) => `${rid}:${id}`));
async function appended(rulesJson) {
    const env = rebuild(rulesJson);
    await appendSphere(env, { items: ['Progressive Swim'] });
    return env.compile.rulesJson;
}

describe('recordedConceptsOf / rebuildRegionParams', () => {
    it('an empty or absent list records nothing and reads back exactly the caller\'s params', () => {
        expect(recordedConceptsOf(undefined)).toEqual({});
        expect(recordedConceptsOf({})).toEqual({});
        expect(recordedConceptsOf({ concepts: [] })).toEqual({});
        const mine = { a: 1 };
        expect(rebuildRegionParams({}, mine)).toBe(mine);
        expect(rebuildRegionParams(undefined, undefined)).toEqual({});
    });
    it('a non-empty list is recorded as a copy and read back under the caller\'s params', () => {
        const list = ['sword'];
        const rec = recordedConceptsOf({ concepts: list, maxIterations: 0 });
        expect(rec).toEqual({ [RECORDED_CONCEPTS_KEY]: ['sword'] });
        expect(rec.concepts).not.toBe(list);
        expect(rebuildRegionParams(rec, undefined)).toEqual({ concepts: ['sword'] });
        expect(rebuildRegionParams(rec, { concepts: ['swim'], x: 1 })).toEqual({ concepts: ['swim'], x: 1 });
    });
});

describe('T0b D3 — the maze world: recorded, read back, and realised by an append', async () => {
    const control = await runPresetHeadless(buildRunFromState(bundle([])));
    const world = await runPresetHeadless(buildRunFromState(bundle(CONCEPT_LIST)));

    it('the compile records the list in the slot\'s metadata; the control records nothing', () => {
        expect(world.rulesJson.procgen_metadata['1'].concepts).toEqual(CONCEPT_LIST);
        expect(RECORDED_CONCEPTS_KEY in control.rulesJson.procgen_metadata['1']).toBe(false);
    });

    it('the rebuild reads it back into regionParams.concepts; the control\'s regionParams stay {}', () => {
        expect(rebuild(world.rulesJson).config.regionParams).toEqual({ concepts: CONCEPT_LIST });
        expect(rebuild(control.rulesJson).config.regionParams).toEqual({});
    });

    it('a plain rebuild + compile keeps the skinned gates (they come off the payloads)', async () => {
        const env = rebuild(world.rulesJson);
        await runStep('compile', env);
        expect(gatesOf(env.compile.rulesJson)).toEqual(['region_2_2:water_gate_0', 'region_2_3:guardian_gate_0']);
    });

    it('⛓ an APPEND realises the concept gates again: guardian_gate / water_gate, never a plain logic_gate', async () => {
        expect(gatesOf(await appended(world.rulesJson)))
            .toEqual(['region_2_2:water_gate_0', 'region_2_2:guardian_gate_1']);
        expect(gatesOf(await appended(control.rulesJson)))
            .toEqual(['region_2_2:logic_gate_0', 'region_2_2:logic_gate_1']);
    });

    it('the appended world still records its concepts, so a second rebuild keeps them', async () => {
        const once = await appended(world.rulesJson);
        expect(once.procgen_metadata['1'].concepts).toEqual(CONCEPT_LIST);
        expect(rebuild(once).config.regionParams.concepts).toEqual(CONCEPT_LIST);
    });
});

describe('T0b D3 — the text-adventure world: an append keeps the gates\' prose', async () => {
    const control = await runPresetHeadless(buildRunFromState(bundle([], TA_WORLD)));
    const world = await runPresetHeadless(buildRunFromState(bundle(CONCEPT_LIST, TA_WORLD)));
    const proseOf = (rulesJson, rid) => rulesJson.preset_sidecars['1'][rid].playable_payload.prose;
    const PROSE = (cid) => TEXT_ADVENTURE_CONCEPT_REALISATIONS[cid].placements.gate.mechanic.prose;

    it('the world builds headless, oracle clean, rooted in a text-adventure room that carries prose', () => {
        expect(world.oracleErrors ?? []).toEqual([]);
        expect(world.rulesJson.preset_sidecars['1'].region_2_2.substrate).toBe('text_adventure');
        expect(proseOf(world.rulesJson, 'region_2_2')).toBeDefined();
        expect(proseOf(control.rulesJson, 'region_2_2')).toBeUndefined();
    });

    it('⛓ after rebuild + append the re-realised room carries the guardian\'s and the water\'s gate prose', async () => {
        const after = await appended(world.rulesJson);
        const exits = proseOf(after, 'region_2_2')?.exits ?? {};
        const said = Object.values(exits).map((e) => e.inaccessibleMessage).sort();
        expect(said).toEqual([PROSE('guardian').blocked, PROSE('water').blocked].sort());
        expect(proseOf(await appended(control.rulesJson), 'region_2_2')).toBeUndefined();
    });
});
