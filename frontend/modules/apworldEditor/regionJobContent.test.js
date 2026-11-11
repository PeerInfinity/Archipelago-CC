/**
 * ⛓⛓ CONTENT SETS C4 — **THE APWORLD EDITOR'S REGENERATE CARRIES THE WORLD'S
 * CONTENT.** A loaded set cannot cross the worker's `postMessage`, so the
 * composed args carry none, and the job attaches it where it runs
 * (`attachJobContent`: the args' `regionParams.content`, else the document's
 * `procgen_metadata[p].content`). A synchronous caller that cannot attach (the
 * op replayed with no inlined result) is refused by name; a stack of default
 * packs only comes from the process's preload cache at the region seam.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { assembleRegionParams } from '../procgenPipeline/sphereConfigHooks.js';
import { collectPendingGenerations } from '../procgenPipeline/procgenPipelineEngine.js';
import {
    CONTENT_SET_KEY, DEFAULT_CONTENT_PACK_FIELD, RECORDED_CONTENT_KEY, defaultContentSetOf, isContentSet,
    preloadDefaultContent, resetDefaultContentCache,
} from '../procgenPipeline/worldContent.js';
import { composeRegenerateArgs, regionGenerationPlan } from './regionGenerationFlow.js';
import { regenerateRegionEntry } from './regionRegenerate.js';
import {
    INITIALISE_JOB, attachJobContent, runRegenerateJob, runRegenerateOnPage,
} from './regionGenerationRun.js';
import { initialiseKnobs } from './slotInitialise.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const read = (rel) => JSON.parse(readFileSync(join(ROOT, 'frontend', 'presets', rel), 'utf8'));
const FOUR = read('multiworld/AP_05594871498841892311/AP_05594871498841892311_rules.json');
const bytes = (o) => JSON.stringify(o);

const PLAYER = '3';
const REGION = 'region_1_0';
const TARGET = 'maze';

// ── a fixture pack, in memory (worldContent.test.js's shape) ────────────
const MEM = 'mem:/packs/';
const PACK = 'trial';
const FILES = {
    [`${PACK}/pack.json`]: {
        schema_version: 1, id: PACK, title: PACK, licence: 'CC0',
        layers: { concepts: 'concepts/manifest.json', text: 'text/manifest.json' },
    },
    [`${PACK}/concepts/manifest.json`]: {
        schema_version: 1,
        concepts: {
            [`${PACK}:character/the-gate`]: {
                kind: 'character', name: 'The Gate', look: { color: '#a04040', symbol: '#' }, presents: 'guardian',
            },
        },
    },
    [`${PACK}/text/manifest.json`]: { schema_version: 1, strings: { [`${PACK}:gate/blocked`]: 'The Gate knows.' }, lists: {} },
};
function memIo() {
    const reads = [];
    return {
        reads,
        base: MEM,
        readJson: async (url) => {
            reads.push(url);
            const hit = Object.keys(FILES).find((suffix) => url.endsWith(`/${suffix}`));
            if (!hit) throw new Error(`no file ${url}`);
            return structuredClone(FILES[hit]);
        },
    };
}

/** FOUR with player PLAYER's `procgen_metadata` block naming `list` (⚠ a per-player map). */
function docNaming(list) {
    const doc = structuredClone(FOUR);
    doc.procgen_metadata = { ...(doc.procgen_metadata ?? {}), [PLAYER]: { ...(doc.procgen_metadata?.[PLAYER] ?? {}), [RECORDED_CONTENT_KEY]: list } };
    return doc;
}
const plan = regionGenerationPlan(FOUR, PLAYER, REGION, TARGET, { seed: 4 });
const argsFor = (doc) => composeRegenerateArgs(doc, PLAYER, REGION, TARGET, { ...plan.defaults });

describe('⛓ C4 attachJobContent — the job\'s set, loaded where it runs', () => {
    it('premise: the plan regenerates this region with this target', () => {
        expect(plan.refusal).toBeNull();
    });

    it('⛔ a document naming no content: the args themselves, and no read', async () => {
        const io = memIo();
        const args = argsFor(FOUR);
        expect(await attachJobContent(args, io)).toBe(args);
        expect(io.reads).toEqual([]);
    });

    it('a document naming content: the job carries the list and the loaded set; the composed args carry neither', async () => {
        const doc = docNaming([PACK]);
        const args = argsFor(doc);
        expect(RECORDED_CONTENT_KEY in args.regionParams || CONTENT_SET_KEY in args.regionParams).toBe(false);
        const job = await attachJobContent(args, memIo());
        expect(job.regionParams[RECORDED_CONTENT_KEY]).toEqual([PACK]);
        expect(isContentSet(job.regionParams[CONTENT_SET_KEY])).toBe(true);
        expect(job.regionParams[CONTENT_SET_KEY].ids).toEqual([PACK]);
        expect(args.regionParams[CONTENT_SET_KEY]).toBeUndefined();
        // ⛔ the args posted to the worker clone; the attached job would not.
        expect(() => structuredClone(args)).not.toThrow();
        expect(() => structuredClone(job)).toThrow();
    });

    it('an initialise, a zone source and a library source are not attached', async () => {
        const doc = docNaming([PACK]);
        const io = memIo();
        for (const args of [
            { job: INITIALISE_JOB, doc, player: PLAYER, substrate: TARGET },
            { doc, player: PLAYER, region: REGION, substrate: TARGET, source: { kind: 'zone', zoneIdx: 0 } },
            { doc, player: PLAYER, region: REGION, substrate: TARGET, regionParams: {}, source: { kind: 'library' } },
        ]) expect(await attachJobContent(args, io)).toBe(args);
        expect(io.reads).toEqual([]);
    });
});

describe('⛓ C4 regenerateRegionEntry reads the document\'s content list', () => {
    const control = regenerateRegionEntry(argsFor(FOUR));

    it('premise: the control regenerate lands', () => {
        expect(control.ok, control.threw).toBe(true);
    });

    it('⛔ a content-naming document with no set attached is REFUSED by name (the synchronous op replay)', () => {
        const res = regenerateRegionEntry(argsFor(docNaming([PACK])));
        expect(res.ok).toBe(false);
        expect(res.threw).toMatch(/^world content: .*\[trial\]/);
    });

    it('with the set attached the regenerate lands, and its entry is the control\'s (no substrate reads the set yet)', async () => {
        const res = regenerateRegionEntry(await attachJobContent(argsFor(docNaming([PACK])), memIo()));
        expect(res.ok, res.threw).toBe(true);
        expect(bytes(res.entry)).toBe(bytes(control.entry));
    });

    it('runRegenerateJob attaches before it regenerates; every message it posts clones', async () => {
        const posted = [];
        let seen = null;
        await runRegenerateJob(argsFor(docNaming([PACK])), {
            post: (m) => posted.push(m),
            loadLibraries: async () => ({ registered: substrateRegistry.getAll().map((e) => e.id), failed: [] }),
            regenerate: (job) => { seen = job; return regenerateRegionEntry(job); },
            attachContent: (a) => attachJobContent(a, memIo()),
        });
        expect(seen.regionParams[CONTENT_SET_KEY].ids).toEqual([PACK]);
        const result = posted.find((m) => m.type === 'result');
        expect(result.ok, result.threw).toBe(true);
        for (const m of posted) expect(() => structuredClone(m)).not.toThrow();
    });

    it('a pack the job cannot load is the job\'s refusal, by name', async () => {
        const posted = [];
        await runRegenerateJob(argsFor(docNaming(['absent'])), {
            post: (m) => posted.push(m),
            loadLibraries: async () => ({ registered: [TARGET], failed: [] }),
            regenerate: regenerateRegionEntry,
            attachContent: (a) => attachJobContent(a, memIo()),
        });
        const result = posted.find((m) => m.type === 'result');
        expect(result.ok).toBe(false);
        expect(result.threw).toMatch(/absent/);
    });

    it('runRegenerateOnPage attaches once before the first ask', async () => {
        let seen = null;
        const handle = runRegenerateOnPage(argsFor(docNaming([PACK])), {
            timeoutMs: 600000,
            regenerate: (job) => { seen = job; return regenerateRegionEntry(job); },
            collect: collectPendingGenerations,
            attachContent: (a) => attachJobContent(a, memIo()),
        });
        const res = await handle.promise;
        expect(res.ok, res.threw).toBe(true);
        expect(seen.regionParams[CONTENT_SET_KEY].ids).toEqual([PACK]);
    });
});

describe('⛓ C4 — a target declaring a DEFAULT pack (a fixture entry): the editor builds from the preload cache', () => {
    const original = substrateRegistry.get(TARGET);
    const declare = () => substrateRegistry.entries.set(TARGET, { ...original, [DEFAULT_CONTENT_PACK_FIELD]: PACK });
    // ⛓ CONTENT SETS R1 — the real registry now declares a default pack (the text adventure's), which the
    // in-memory io does not hold: the preload reads a FIXTURE registry of the one declaring target.
    const preloadTarget = () => preloadDefaultContent({ ...memIo(), registry: { getAll: () => [substrateRegistry.get(TARGET)] } });
    afterEach(() => {
        substrateRegistry.entries.set(TARGET, original);
        resetDefaultContentCache();
    });

    it('⛔ not preloaded: composing the args still works (they defer the set); the regenerate is refused by name', () => {
        declare();
        const res = regenerateRegionEntry(argsFor(FOUR));
        expect(res.ok).toBe(false);
        expect(res.threw).toMatch(/\[trial\] were not preloaded.*preloadDefaultContent/);
    });

    it('preloaded: the composed args carry no set (they clone), the regenerate lands, and its entry is the control\'s', async () => {
        const control = regenerateRegionEntry(argsFor(FOUR));
        declare();
        await preloadTarget();
        const bag = { ...plan.defaults };
        // A synchronous builder's assembleRegionParams carries the cached set …
        expect(assembleRegionParams({ activeIds: [TARGET], mode: 'topDown', params: bag })[CONTENT_SET_KEY])
            .toBe(defaultContentSetOf([PACK]));
        // … and the composed args (posted to the worker, recorded in a provenance) defer it.
        const args = argsFor(FOUR);
        expect(CONTENT_SET_KEY in args.regionParams).toBe(false);
        expect(() => structuredClone(args)).not.toThrow();
        const io = memIo();
        expect(await attachJobContent(args, io)).toBe(args);
        expect(io.reads).toEqual([]);
        const res = regenerateRegionEntry(args);
        expect(res.ok, res.threw).toBe(true);
        expect(bytes(res.entry)).toBe(bytes(control.entry));
    });

    it('an initialise\'s knobs (computed where the initialise runs) take the cached set', async () => {
        declare();
        await preloadTarget();
        expect(initialiseKnobs(TARGET, { ...plan.defaults }).regionParams[CONTENT_SET_KEY]).toBe(defaultContentSetOf([PACK]));
    });
});
