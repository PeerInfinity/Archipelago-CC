/**
 * ⛓⛓ CONTENT SETS C3 — **A WORLD NAMES ITS CONTENT STACK.** The param, the one
 * effective-stack rule, the load (and its empty case, which never reads), the
 * channel to the placers, the record and the rebuild, and the byte-equality pin:
 * the concept trial world with a fixture stack compiles to its control's
 * `rules.json` apart from `procgen_metadata[p].content`, and its placers
 * demonstrably received the set.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, vi } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import '../textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { ContentPackError, parseRegistry } from '../contentPacks/contentPacks.js';
import { nodePackIo } from '../contentPacks/nodePackIo.js';
import { CONCEPT_TRIAL_STATE } from './presetDefs.js';
import {
    buildRunFromState, prepareRunFromState, runPresetHeadless, worldContentStackOf, DEFAULT_PARAMS,
} from './presetRun.js';
import { assembleRegionParams } from './sphereConfigHooks.js';
import { rebuildEnvelopeFromRulesJson, rebuildRegionParams } from './procgenPipelineEngine.js';
import { appendSphere, serializeEnvelope, deserializeEnvelope } from './sphereSteps.js';
import { DEFAULT_ITEMS, DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import {
    CONTENT_SET_KEY, DEFAULT_CONTENT_PACK_FIELD, EMPTY_CONTENT_SET, RECORDED_CONTENT_KEY, WorldContentError,
    assertContentLoaded, attachContentSet, attachEnvelopeContent, contentParamRefusal, contentRegionParams,
    effectiveContentStack, isContentSet, loadContentSet, recordedContentOf,
} from './worldContent.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// ── a fixture stack, in memory ──────────────────────────────────────────
const MEM = 'mem:/packs/';
const FIXTURE = {
    trial: {
        pack: {
            schema_version: 1, id: 'trial', title: 'trial', licence: 'CC0',
            layers: { concepts: 'concepts/manifest.json', text: 'text/manifest.json', art: 'art/manifest.json' },
        },
        concepts: {
            schema_version: 1,
            concepts: {
                'trial:character/the-gate': {
                    kind: 'character', name: 'The Gate', look: { color: '#a04040', symbol: '#' },
                    text: { blocked: 'trial:gate/blocked' }, presents: 'guardian',
                },
            },
        },
        text: { schema_version: 1, strings: { 'trial:gate/blocked': 'The Gate knows its rule.' }, lists: {} },
    },
    later: {
        pack: { schema_version: 1, id: 'later', title: 'later', licence: 'CC0', layers: { text: 'text/manifest.json' } },
        text: { schema_version: 1, strings: { 'trial:gate/blocked': 'Overridden.' }, lists: { 'later:names': ['A'] } },
    },
};
/** `readJson` over FIXTURE, counting reads (and the URLs read). */
function memIo(files = FIXTURE) {
    const read = [];
    const table = {};
    for (const [id, f] of Object.entries(files)) {
        table[`${id}/pack.json`] = f.pack;
        for (const [layer, path] of Object.entries(f.pack.layers)) if (f[layer]) table[`${id}/${path}`] = f[layer];
    }
    return {
        read,
        base: MEM,
        readJson: async (url) => {
            read.push(url);
            const hit = Object.keys(table).find((suffix) => url.endsWith(`/${suffix}`));
            if (!hit) throw new Error(`no file ${url}`);
            return structuredClone(table[hit]);
        },
    };
}
/** A registry stand-in: `getAll()` by id, `get(id)`. */
const fakeRegistry = (entries) => ({
    getAll: () => [...entries].sort((a, b) => (a.id < b.id ? -1 : 1)),
    get: (id) => entries.find((e) => e.id === id),
});

describe('params.content — the param', () => {
    it('defaults to an empty list beside params.concepts', () => {
        expect(DEFAULT_PARAMS[RECORDED_CONTENT_KEY]).toEqual([]);
        expect(DEFAULT_PARAMS.concepts).toEqual([]);
    });
    it('accepts absent, empty and a list of distinct pack ids; refuses the rest by name', () => {
        for (const ok of [undefined, null, [], ['trial'], ['trial', 'later']]) expect(contentParamRefusal(ok)).toBeNull();
        expect(contentParamRefusal('trial')).toMatch(/not a list/);
        expect(contentParamRefusal(['Trial'])).toMatch(/"Trial", which is not a pack id/);
        expect(contentParamRefusal([3])).toMatch(/3, which is not a pack id/);
        expect(contentParamRefusal(['trial', 'trial'])).toMatch(/names "trial" twice/);
    });
});

describe('effectiveContentStack — the one rule', () => {
    const reg = fakeRegistry([
        { id: 'zeta', [DEFAULT_CONTENT_PACK_FIELD]: 'zeta-pack' },
        { id: 'alpha', [DEFAULT_CONTENT_PACK_FIELD]: 'alpha-pack' },
        { id: 'beta' },
        { id: 'gamma', [DEFAULT_CONTENT_PACK_FIELD]: 'alpha-pack' },
    ]);
    it('defaults in REGISTRY order (not mix order), once each, then params.content in order', () => {
        expect(effectiveContentStack({ substrateIds: ['zeta', 'beta', 'alpha', 'gamma'], content: ['theme', 'extra'], registry: reg }))
            .toEqual(['alpha-pack', 'zeta-pack', 'theme', 'extra']);
    });
    it('a substrate outside the mix contributes nothing; a pack the defaults named keeps its first place', () => {
        expect(effectiveContentStack({ substrateIds: ['beta'], content: ['zeta-pack'], registry: reg })).toEqual(['zeta-pack']);
        expect(effectiveContentStack({ substrateIds: ['zeta'], content: ['zeta-pack'], registry: reg })).toEqual(['zeta-pack']);
    });
    it('a malformed defaultContentPack is refused naming the entry', () => {
        const bad = fakeRegistry([{ id: 'odd', [DEFAULT_CONTENT_PACK_FIELD]: 'Not A Pack' }]);
        expect(() => effectiveContentStack({ substrateIds: ['odd'], registry: bad })).toThrow(/entry "odd"'s defaultContentPack/);
    });
    it('no registered entry declares a default pack yet, so every world\'s default stack is empty', () => {
        const declarers = substrateRegistry.getAll().filter((e) => e[DEFAULT_CONTENT_PACK_FIELD] !== undefined);
        expect(declarers.map((e) => e.id)).toEqual([]);
        expect(worldContentStackOf(CONCEPT_TRIAL_STATE)).toEqual([]);
    });
});

describe('loadContentSet — the load', () => {
    it('⛔ an empty stack returns the empty set WITHOUT calling readJson', async () => {
        const readJson = vi.fn();
        expect(await loadContentSet([], { base: MEM, readJson })).toBe(EMPTY_CONTENT_SET);
        expect(readJson).not.toHaveBeenCalled();
        expect(EMPTY_CONTENT_SET.ids).toEqual([]);
        expect(EMPTY_CONTENT_SET.concepts.keys()).toEqual([]);
        expect(EMPTY_CONTENT_SET.text.keys()).toEqual([]);
    });
    it('a stack loads to a frozen { ids, concepts, text }; a later pack wins per key; art is not fetched', async () => {
        const io = memIo();
        const set = await loadContentSet(['trial', 'later'], io);
        expect(Object.isFrozen(set)).toBe(true);
        expect(isContentSet(set)).toBe(true);
        expect(Object.keys(set)).toEqual(['ids', 'concepts', 'text']);
        expect(set.ids).toEqual(['trial', 'later']);
        expect(set.concepts.presenting('guardian').key).toBe('trial:character/the-gate');
        expect(set.text.string('trial:gate/blocked')).toBe(FIXTURE.later.text.strings['trial:gate/blocked']);
        expect(io.read.some((u) => u.includes('/art/'))).toBe(false);
    });
    it('assertPresents runs on the loaded stack: a concept presenting an unknown mechanic id is refused', async () => {
        const files = structuredClone(FIXTURE);
        files.trial.concepts.concepts['trial:character/the-gate'].presents = 'dragon';
        await expect(loadContentSet(['trial'], memIo(files))).rejects.toThrow(/presents "dragon"/);
    });
    it('a pack that is not there is refused by name', async () => {
        await expect(loadContentSet(['absent'], memIo())).rejects.toBeInstanceOf(ContentPackError);
    });
    it('⛔ the set is runtime state: JSON omits it, so a saved envelope keeps only the ids list', async () => {
        const set = await loadContentSet(['trial'], memIo());
        expect(JSON.parse(JSON.stringify({ content: ['trial'], [CONTENT_SET_KEY]: set }))).toEqual({ content: ['trial'] });
    });
    it('node reads the committed packs from disk (every pack the registry lists loads as a content stack)', async () => {
        const reg = parseRegistry(JSON.parse(readFileSync(join(ROOT, 'frontend/packs/packs.json'), 'utf8')));
        const set = await loadContentSet([...reg.packs], nodePackIo());
        expect(set.ids).toEqual([...reg.packs]);
    });
});

describe('the channel — assembleRegionParams and the region seam', () => {
    it('an empty stack adds no key (the set given or not)', () => {
        const without = assembleRegionParams({ activeIds: ['maze'], params: { concepts: [] } });
        const withEmpty = assembleRegionParams({ activeIds: ['maze'], params: { content: [] }, contentSet: EMPTY_CONTENT_SET });
        expect(without).toEqual(withEmpty);
        expect(RECORDED_CONTENT_KEY in withEmpty || CONTENT_SET_KEY in withEmpty).toBe(false);
    });
    it('a non-empty stack rides as content + contentSet; with no loaded set it is refused by name', async () => {
        const set = await loadContentSet(['trial'], memIo());
        const out = contentRegionParams({ params: { content: ['trial'] }, contentSet: set, substrateIds: ['maze'] });
        expect(out).toEqual({ [RECORDED_CONTENT_KEY]: ['trial'], [CONTENT_SET_KEY]: set });
        expect(() => contentRegionParams({ params: { content: ['trial'] }, substrateIds: ['maze'] }))
            .toThrow(WorldContentError);
        expect(() => contentRegionParams({ params: { content: ['trial', 'later'] }, contentSet: set }))
            .toThrow(/\[trial, later\] was not loaded/);
    });
    it('the region seam refuses a region whose packs no loaded set holds, and passes one that needs none', async () => {
        expect(() => assertContentLoaded({}, 'maze')).not.toThrow();
        expect(() => assertContentLoaded({ [RECORDED_CONTENT_KEY]: ['trial'] }, 'maze')).toThrow(/\[trial\]/);
        const set = await loadContentSet(['trial'], memIo());
        expect(() => assertContentLoaded({ [RECORDED_CONTENT_KEY]: ['trial'], [CONTENT_SET_KEY]: set }, 'maze')).not.toThrow();
        const reg = fakeRegistry([{ id: 'own', [DEFAULT_CONTENT_PACK_FIELD]: 'own-pack' }]);
        expect(() => assertContentLoaded({}, 'own', reg)).toThrow(/needs the content pack\(s\) \[own-pack\]/);
    });
    it('buildRunFromState refuses a world naming content when nothing was loaded (an entry point that forgot)', () => {
        const bundle = { ...CONCEPT_TRIAL_STATE, params: { ...CONCEPT_TRIAL_STATE.params, content: ['trial'] } };
        expect(() => buildRunFromState(structuredClone(bundle))).toThrow(WorldContentError);
    });
});

describe('the record and the rebuild', () => {
    it('recordedContentOf writes only a non-empty list, as a copy', () => {
        expect(recordedContentOf(undefined)).toEqual({});
        expect(recordedContentOf({ content: [] })).toEqual({});
        const list = ['trial'];
        const rec = recordedContentOf({ content: list, [CONTENT_SET_KEY]: EMPTY_CONTENT_SET });
        expect(rec).toEqual({ content: ['trial'] });
        expect(rec.content).not.toBe(list);
    });
    it('rebuildRegionParams reads content back under the caller\'s own, beside concepts', () => {
        const mine = { a: 1 };
        expect(rebuildRegionParams({}, mine)).toBe(mine);
        expect(rebuildRegionParams({ content: ['trial'], concepts: ['sword'] }, undefined))
            .toEqual({ content: ['trial'], concepts: ['sword'] });
        expect(rebuildRegionParams({ content: ['trial'] }, { content: ['later'] })).toEqual({ content: ['later'] });
    });
    it('attachContentSet: an empty stack returns the same object without reading', async () => {
        const rp = { maxIterations: 0 };
        const io = memIo();
        expect(await attachContentSet(rp, { substrateIds: ['maze'], ...io })).toBe(rp);
        expect(io.read).toEqual([]);
    });
});

// ── the byte-equality pin ───────────────────────────────────────────────
const WITH_CONTENT = { ...CONCEPT_TRIAL_STATE, params: { ...CONCEPT_TRIAL_STATE.params, content: ['trial'] } };
/** The document minus the recorded content list (the one difference a content stack may make). */
const withoutContent = (rulesJson) => {
    const out = structuredClone(rulesJson);
    for (const block of Object.values(out.procgen_metadata ?? {})) delete block[RECORDED_CONTENT_KEY];
    return out;
};
describe('⛔ byte-equality — the concept trial world with a fixture stack is its control apart from the record', async () => {
    const substrates = Object.keys(CONCEPT_TRIAL_STATE.substrateQuotas);
    // Control: the committed concept trial state, loaded through the async entry (an empty stack: no read).
    const ctrlIo = memIo();
    const ctrl = await runPresetHeadless(await prepareRunFromState(structuredClone(CONCEPT_TRIAL_STATE), { io: ctrlIo }));
    const committed = readFileSync(join(ROOT, 'frontend/presets/concept_trial/AP_1/AP_1_rules.json'), 'utf8');

    // The world with content, its placers wrapped (registry entries are frozen, so the wrapped entry stands in
    // for the real one for this one build; each call still runs the real hook).
    const io = memIo();
    const received = [];
    const originals = new Map(substrates.map((id) => [id, substrateRegistry.get(id)]));
    for (const [id, entry] of originals) {
        const wrap = (hook, paramsOf) => (...args) => {
            received.push({ substrate: id, hook, set: paramsOf(args)?.[CONTENT_SET_KEY] ?? null });
            return entry[hook](...args);
        };
        substrateRegistry.entries.set(id, {
            ...entry,
            generateRegionCore: wrap('generateRegionCore', (a) => a[0].params),
            placeFromRules: wrap('placeFromRules', (a) => a[1].params),
        });
    }
    let run;
    let world;
    try {
        run = await prepareRunFromState(structuredClone(WITH_CONTENT), { io });
        world = await runPresetHeadless(run);
    } finally {
        for (const [id, entry] of originals) substrateRegistry.entries.set(id, entry);
    }

    it('the empty-stack control read nothing and is byte for byte the committed concept_trial preset', () => {
        expect(ctrlIo.read).toEqual([]);
        expect(JSON.stringify(ctrl.rulesJson, null, 2)).toBe(committed);
    });

    it('the fixture stack was read once, before generation', () => {
        expect(io.read.filter((u) => u.endsWith('/pack.json'))).toEqual([`${MEM}trial/pack.json`]);
    });

    it('every placer call of every region received the loaded set (the same object)', () => {
        const regions = Object.keys(world.rulesJson.preset_sidecars['1']);
        expect(received.filter((r) => r.hook === 'placeFromRules').length).toBeGreaterThanOrEqual(regions.length);
        expect(new Set(received.map((r) => r.substrate))).toEqual(new Set(substrates));
        const sets = new Set(received.map((r) => r.set));
        expect(sets.size).toBe(1);
        const [set] = sets;
        expect(isContentSet(set)).toBe(true);
        expect(set.ids).toEqual(WITH_CONTENT.params.content);
        expect(set.concepts.presenting('guardian').name).toBe('The Gate');
    });

    it('the compiled rules.json is the control\'s apart from procgen_metadata[p].content', () => {
        expect(JSON.stringify(withoutContent(world.rulesJson))).toBe(JSON.stringify(ctrl.rulesJson));
        expect(world.rulesJson.procgen_metadata['1'][RECORDED_CONTENT_KEY]).toEqual(WITH_CONTENT.params.content);
        expect(RECORDED_CONTENT_KEY in ctrl.rulesJson.procgen_metadata['1']).toBe(false);
    });

    it('the run\'s envelope config saves without the set and keeps the list', () => {
        const saved = JSON.parse(JSON.stringify(run.run.config.regionParams));
        expect(saved[RECORDED_CONTENT_KEY]).toEqual(WITH_CONTENT.params.content);
        expect(CONTENT_SET_KEY in saved).toBe(false);
    });
});

describe('the append path — rebuild, attach, append', async () => {
    const OPTS = { itemLib: DEFAULT_ITEMS, obstacleLib: DEFAULT_OBSTACLES };
    const bundle = (content) => ({
        mode: 'sphereGrowth',
        params: { seed: 1, startSubstrate: 'maze', sphereCount: 3, fillerCount: 0, revisitPercent: 25, content },
        scenario: { items: { 'Progressive Sword': 1, 'Progressive Swim': 1, victory: 1 }, obstacles: {} },
        substrateQuotas: { maze: 99 }, substrateMix: {}, substrateMode: 'quotas',
    });
    const world = await runPresetHeadless(await prepareRunFromState(bundle(['trial']), { io: memIo() }));
    const control = await runPresetHeadless(await prepareRunFromState(bundle([]), { io: memIo() }));

    it('the rebuild reads the list back into regionParams.content; the control\'s regionParams stay {}', () => {
        expect(rebuildEnvelopeFromRulesJson(structuredClone(world.rulesJson), OPTS).config.regionParams)
            .toEqual({ [RECORDED_CONTENT_KEY]: ['trial'] });
        expect(rebuildEnvelopeFromRulesJson(structuredClone(control.rulesJson), OPTS).config.regionParams).toEqual({});
    });

    it('⛔ an append from a rebuild that was not re-attached is refused by name at the region seam', async () => {
        const env = rebuildEnvelopeFromRulesJson(structuredClone(world.rulesJson), OPTS);
        await expect(appendSphere(env, { items: ['Progressive Swim'] })).rejects.toThrow(WorldContentError);
    });

    it('attachEnvelopeContent loads the set; the append then runs and keeps the record; its logic is the control\'s', async () => {
        const io = memIo();
        const env = await attachEnvelopeContent(rebuildEnvelopeFromRulesJson(structuredClone(world.rulesJson), OPTS), io);
        expect(env.config.regionParams[CONTENT_SET_KEY].ids).toEqual(['trial']);
        expect(env.opts.regionParams).toBe(env.config.regionParams);
        await appendSphere(env, { items: ['Progressive Swim'] });
        expect(env.compile.rulesJson.procgen_metadata['1'][RECORDED_CONTENT_KEY]).toEqual(['trial']);

        const ctrlEnv = await attachEnvelopeContent(rebuildEnvelopeFromRulesJson(structuredClone(control.rulesJson), OPTS), memIo());
        await appendSphere(ctrlEnv, { items: ['Progressive Swim'] });
        expect(JSON.stringify(withoutContent(env.compile.rulesJson))).toBe(JSON.stringify(ctrlEnv.compile.rulesJson));
    });

    it('a saved envelope round-trips the list without the set; re-attaching restores it', async () => {
        const io = memIo();
        const env = await attachEnvelopeContent(rebuildEnvelopeFromRulesJson(structuredClone(world.rulesJson), OPTS), io);
        const back = deserializeEnvelope(JSON.parse(JSON.stringify(serializeEnvelope(env))));
        expect(back.config.regionParams).toEqual({ [RECORDED_CONTENT_KEY]: ['trial'] });
        await attachEnvelopeContent(back, memIo());
        expect(isContentSet(back.config.regionParams[CONTENT_SET_KEY])).toBe(true);
    });
});
