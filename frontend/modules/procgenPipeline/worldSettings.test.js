/**
 * ⛓⛓ CONTENT SETS PL-1 — **THE TWO NEW WORLD SETTINGS AND THE NUMBERS SWITCH** (Z.5, Z8): `exists`, `numbers`
 * and `numbersMode`, each recorded in `procgen_metadata[p]` only when it is not the default, read back on rebuild,
 * and refused by name when malformed; a numbers pack for another substrate or another `exists` is refused by name.
 * ⛔ The default world records none of them (the concept trial control, byte for byte, is `worldContent.test.js`'s).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import '../textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js';
import { nodePackIo } from '../contentPacks/nodePackIo.js';
import { CONCEPT_TRIAL_STATE } from './presetDefs.js';
import { prepareRunFromState, runPresetHeadless } from './presetRun.js';
import { rebuildEnvelopeFromRulesJson, rebuildRegionParams } from './procgenPipelineEngine.js';
import {
    ABSENT_NUMBERS_MODE, DEFAULT_CONTENT_PACK_FIELD, NUMBERS_MODES, NUMBERS_WALK_FIELD,
    RECORDED_EXISTS_KEY, RECORDED_NUMBERS_KEY, RECORDED_NUMBERS_MODE_KEY, WORLD_SETTING_KEYS, WorldContentError,
    assertWorldNumbers, defaultNumbersModeOf, documentNumbersModeOf, documentWorldSettingsOf, generationNumbersMode,
    recordedContentOf, recordedWorldSettingsOf, worldSettingsRegionParams,
} from './worldContent.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FIXTURES = new URL('../packStructure/fixtures/packs/', import.meta.url).href;

/** A registry stand-in: `getAll()` by id, `get(id)`. */
const fakeRegistry = (entries) => ({
    getAll: () => [...entries].sort((a, b) => (a.id < b.id ? -1 : 1)),
    get: (id) => entries.find((e) => e.id === id),
});
const REG = fakeRegistry([
    { id: 'still', [DEFAULT_CONTENT_PACK_FIELD]: 'still-pack' },
    { id: 'walker', [DEFAULT_CONTENT_PACK_FIELD]: 'walker-pack', [NUMBERS_WALK_FIELD]: true },
    { id: 'walker2', [NUMBERS_WALK_FIELD]: true },
]);
const settings = (params, substrateIds) => worldSettingsRegionParams({ params, substrateIds, registry: REG });

describe('recorded only when not the default', () => {
    it('a world that names none of them takes no key (any mix)', () => {
        for (const mix of [[], ['still'], ['still', 'walker']]) expect(settings({}, mix)).toEqual({});
    });
    it('exists: recorded when it is not exactly the mix\'s default packs, in order', () => {
        expect(settings({ exists: ['still-pack'] }, ['still'])).toEqual({});
        expect(settings({ exists: ['still-pack', 'walker-pack'] }, ['still', 'walker'])).toEqual({});
        expect(settings({ exists: ['walker-pack', 'still-pack'] }, ['still', 'walker'])).toEqual({ exists: ['walker-pack', 'still-pack'] });
        expect(settings({ exists: ['omsi'] }, ['still'])).toEqual({ exists: ['omsi'] });
    });
    it('numbers: recorded whenever it names packs (its default is each exists pack\'s own set)', () => {
        expect(settings({ numbers: ['omsi'] }, ['still'])).toEqual({ numbers: ['omsi'] });
    });
    it('the keys in the order a metadata block records them: content, exists, numbers, numbersMode', () => {
        expect(Object.keys(recordedContentOf({ numbersMode: 'assign', numbers: ['b'], exists: ['a'], content: ['c'] })))
            .toEqual(['content', ...WORLD_SETTING_KEYS, RECORDED_NUMBERS_MODE_KEY]);
    });
});

describe('the numbers switch (Z8): an absent key ALWAYS means table; generation writes assign', () => {
    it('the two values', () => expect([...NUMBERS_MODES]).toEqual(['assign', 'table']));
    it('generation default: assign only when every substrate in the mix declares a walk', () => {
        expect(defaultNumbersModeOf({ substrateIds: ['walker', 'walker2'], registry: REG })).toBe('assign');
        expect(defaultNumbersModeOf({ substrateIds: ['walker', 'still'], registry: REG })).toBe('table');
        expect(defaultNumbersModeOf({ substrateIds: [], registry: REG })).toBe('table');
    });
    it('⛓ generation under walking substrates WRITES assign; asking for table there writes nothing', () => {
        expect(settings({}, ['walker', 'walker2'])).toEqual({ numbersMode: 'assign' });
        expect(settings({ numbersMode: 'table' }, ['walker'])).toEqual({});
        expect(settings({ numbersMode: 'assign' }, ['still'])).toEqual({ numbersMode: 'assign' });
        expect(generationNumbersMode({ substrateIds: ['still'], numbersMode: null, registry: REG })).toBe('table');
    });
    it('⛔ a document that records no mode is table, whatever the registry later declares', () => {
        expect(ABSENT_NUMBERS_MODE).toBe('table');
        expect(documentNumbersModeOf({ procgen_metadata: { 1: {} } }, 1)).toBe('table');
        expect(documentNumbersModeOf({}, 1)).toBe('table');
        expect(documentNumbersModeOf({ procgen_metadata: { 1: { numbersMode: 'assign' } } }, '1')).toBe('assign');
    });
    it('⛔ the real registry declares no walk in this slice, so no committed world gains the key', async () => {
        const { substrateRegistry } = await import('../shared/procgen/substrateRegistry.js');
        expect(substrateRegistry.getAll().filter((e) => e[NUMBERS_WALK_FIELD] !== undefined).map((e) => e.id)).toEqual([]);
    });
});

describe('⛔ refused by name', () => {
    it('a malformed list, an unknown mode, a malformed walk declaration', () => {
        expect(() => settings({ exists: 'omsi' }, [])).toThrow(/^world content: params\.exists is not a list/);
        expect(() => settings({ numbers: ['omsi', 'omsi'] }, [])).toThrow(/params\.numbers names "omsi" twice/);
        expect(() => settings({ numbersMode: 'tabled' }, [])).toThrow(/params\.numbersMode "tabled" is not one of assign, table/);
        expect(() => recordedWorldSettingsOf({ numbersMode: 'fixed' })).toThrow(/procgen_metadata\.numbersMode "fixed"/);
        expect(() => documentWorldSettingsOf({ procgen_metadata: { 1: { exists: [1] } } }, 1)).toThrow(WorldContentError);
        const bad = fakeRegistry([{ id: 'x', [NUMBERS_WALK_FIELD]: 'yes' }]);
        expect(() => defaultNumbersModeOf({ substrateIds: ['x'], registry: bad })).toThrow(/entry "x"'s numbersWalk "yes" is not true or false/);
    });
    it('⛓ a numbers pack for another substrate or another exists (fixture packs on disk); none named reads nothing', async () => {
        const io = nodePackIo({ base: FIXTURES });
        const read = [];
        expect(await assertWorldNumbers({}, { substrateIds: ['maze'], base: FIXTURES, readJson: async (u) => { read.push(u); return io.readJson(u); } })).toEqual([]);
        expect(read).toEqual([]);
        const ok = await assertWorldNumbers({ exists: ['omsi'], numbers: ['omsi'] }, { substrateIds: ['action_nodes'], registry: REG, ...io });
        expect(ok.map((p) => p.id)).toEqual(['omsi']);
        await expect(assertWorldNumbers({ exists: ['omsi'], numbers: ['omsi'] }, { substrateIds: ['maze'], registry: REG, ...io }))
            .rejects.toThrow(/^world content: numbers names the pack "omsi", which has no set for the substrate\(s\) \[maze\]/);
        await expect(assertWorldNumbers({ exists: ['jta'], numbers: ['omsi'] }, { substrateIds: ['omsi'], registry: REG, ...io }))
            .rejects.toThrow(/over the world's exists \[jta\]/);
        await expect(assertWorldNumbers({ numbers: ['jta'] }, { substrateIds: ['jta'], registry: REG, ...io }))
            .rejects.toThrow(/numbers names the pack "jta", which has no numbers layer/);
    });
});

describe('the record and the read-back, through a real generation (the concept trial world)', async () => {
    const SET = { exists: ['meta'], numbersMode: 'assign' };
    const bundle = { ...structuredClone(CONCEPT_TRIAL_STATE), params: { ...CONCEPT_TRIAL_STATE.params, ...SET } };
    const world = await runPresetHeadless(await prepareRunFromState(bundle, { io: nodePackIo() }));
    const committed = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/concept_trial/AP_1/AP_1_rules.json'), 'utf8'));
    const players = Object.keys(world.rulesJson.procgen_metadata ?? {});

    it('procgen_metadata[p] records exists and numbersMode (⚠ per player), and nothing else in the document moved', () => {
        expect(players.length).toBeGreaterThan(0);
        for (const p of players) {
            expect(world.rulesJson.procgen_metadata[p][RECORDED_EXISTS_KEY]).toEqual(SET.exists);
            expect(world.rulesJson.procgen_metadata[p][RECORDED_NUMBERS_MODE_KEY]).toBe('assign');
            expect(RECORDED_NUMBERS_KEY in world.rulesJson.procgen_metadata[p]).toBe(false);
        }
        const stripped = structuredClone(world.rulesJson);
        for (const p of players) for (const k of Object.keys(SET)) delete stripped.procgen_metadata[p][k];
        expect(JSON.stringify(stripped, null, 2)).toBe(JSON.stringify(committed, null, 2));
    });
    it('a rebuild from the compiled document reads both back into its regionParams', () => {
        for (const p of players) {
            const env = rebuildEnvelopeFromRulesJson(world.rulesJson, { playerId: p });
            const rp = env.config?.regionParams ?? env.opts?.regionParams;
            expect(rp.exists).toEqual(SET.exists);
            expect(rp.numbersMode).toBe('assign');
        }
        expect(rebuildRegionParams({ exists: ['a'], numbers: ['b'], numbersMode: 'assign' }, undefined))
            .toEqual({ exists: ['a'], numbers: ['b'], numbersMode: 'assign' });
        expect(rebuildRegionParams({ exists: ['a'] }, { exists: ['mine'] })).toEqual({ exists: ['mine'] });
        expect(() => rebuildRegionParams({ numbersMode: 'fixed' }, undefined)).toThrow(/numbersMode "fixed"/);
    });
});
