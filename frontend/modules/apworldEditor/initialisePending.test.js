/**
 * apworldEditor — P5d: **ONE PRESS OF *INITIALISE PROCGEN DATA* BUILDS A SLOT
 * WHOSE REGIONS GENERATE ASYNCHRONOUSLY** (cloudberry's game page; here the
 * stand-in `cloudberryTestGenerator`).
 *
 * P5c gave Generate ▸ a page finish: the worker flags a refusal that left work
 * pending, and the page awaits exactly that work and asks again. Initialise runs
 * the same path. The difference is the BOUND: a whole-slot realise stops at the
 * first region still generating, so each ask finishes one more region
 * (`initialisePageRetryBound` = the slot's region count, not P5c's one retry).
 * The pins, each with the mutant it kills (named in the test):
 *   - the whole slot, one press: built, every level generated once, the result = a
 *     synchronous initialise once every level is cached;
 *   - the worker flags an initialise that left work pending, and only that;
 *   - the bound and the no-progress guard, each by name;
 *   - a generation that fails mid-slot is the answer by name (its region), not "still pending";
 *   - the page sentences (timeout, cancel) and the ticker's "(on this page)".
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { collectPendingGenerations } from '../procgenPipeline/procgenPipelineEngine.js';
import {
    clearCloudberryLevelCache, cloudberryGenerationStats, installCloudberryGenerator,
} from '../cloudberryDemo/cloudberryGeneration.js';
import { cloudberryTestGenerator } from '../cloudberryDemo/cloudberryTestGenerator.js';
import { initialiseSlot } from './slotInitialise.js';
import { initialiseAnswer, initialiseTickerText } from './initialiseFlow.js';
import {
    REGION_GENERATION_CANCELLED_ON_PAGE, REGION_GENERATION_NO_PROGRESS, REGION_GENERATION_STILL_PENDING,
    INITIALISE_JOB, initialisePageRetryBound, regenerateAwaitingGeneration, runRegenerateOnPage, workerJobAnswer,
} from './regionGenerationRun.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const read = (g) => JSON.parse(readFileSync(
    join(ROOT, 'frontend', 'presets', g, 'AP_14089154938208861744', 'AP_14089154938208861744_rules.json'), 'utf8'));
/** A bare slot whose every reachable region gets a cell (measured: 9 placed of 10 regions). */
const DOC = read('adventure');
const P = '1';
const JOB = { doc: DOC, player: P, substrate: 'cloudberry', gridDims: { width: 4, height: 4 }, seed: 1, backExits: 'add' };
const bytes = (o) => JSON.stringify(o);
/** The result fields the op records (`ms` is a clock reading). */
const recorded = (r) => bytes({ ...r, ms: 0, retried: undefined, retries: undefined, onPage: undefined });

/** A stand-in that counts its generations and can be told to fail on its Nth. */
function countingGenerator({ failOn = 0 } = {}) {
    const base = cloudberryTestGenerator();
    const g = {
        build: base.build,
        features: base.features,
        calls: 0,
        async generate(args) {
            g.calls += 1;
            if (g.calls === failOn) throw new Error('the hidden page timed out');
            return base.generate(args);
        },
    };
    return g;
}

beforeEach(() => clearCloudberryLevelCache());
afterEach(() => { installCloudberryGenerator(null, { store: null }); clearCloudberryLevelCache(); });

describe('the worker flags an initialise that left work pending', () => {
    const libs = (over = {}) => ({
        initialiseSlot, collect: collectPendingGenerations, fetchJson: null, progress: () => {},
        zoneJobAnswer: () => { throw new Error('not a zone job'); },
        regenerateRegionEntry: () => { throw new Error('not a regenerate job'); },
        ...over,
    });

    it('⛓ a cloudberry slot is flagged (pendingGeneration), naming the first region it waited on', () => {
        installCloudberryGenerator(countingGenerator(), { store: null });
        const res = workerJobAnswer({ job: INITIALISE_JOB, ...JOB }, libs());
        // mutant: the worker's initialise branch unflagged (P5c's state) → pendingGeneration undefined
        expect(res.ok).toBe(false);
        expect(res.pendingGeneration).toBe(true);
        expect(res.why).toMatch(/cannot wait/);
        expect(typeof res.region).toBe('string');
    });

    it('⛓ a synchronous slot (maze) is not flagged: the very same answer; progress reaches the caller', () => {
        let first = null;
        const events = [];
        const res = workerJobAnswer({ job: INITIALISE_JOB, ...JOB, substrate: 'maze' }, libs({
            initialiseSlot: (a) => { first = initialiseSlot(a); return first; },
            progress: (e) => events.push(e),
        }));
        expect(res.ok).toBe(true);
        expect(res).toBe(first);
        expect(res.pendingGeneration).toBeUndefined();
        expect(events.filter((e) => e?.type === 'region').length).toBe(res.stats.placed);
    });

    it('⛓ the region regenerate and the zone job keep their P5c / R5b dispatch', () => {
        const flagged = workerJobAnswer({ region: 'r' }, libs({
            regenerateRegionEntry: () => ({ ok: false, threw: 'generating' }),
            collect: (fn) => ({ value: fn(), pending: [Promise.resolve()] }),
        }));
        expect(flagged.pendingGeneration).toBe(true);
        const zone = { ok: true, zone: 1 };
        expect(workerJobAnswer({ source: { kind: 'zone' } }, libs({ zoneJobAnswer: () => zone }))).toBe(zone);
    });
});

describe('ONE press initialises the whole slot on the page', () => {
    it('⛓⛓ every region built; each level generated ONCE; the result = a sync initialise once cached', async () => {
        const g = countingGenerator();
        installCloudberryGenerator(g, { store: null });
        const bound = initialisePageRetryBound(DOC, P);
        expect(bound).toBe(Object.keys(DOC.regions[P]).length);
        const generatedBefore = cloudberryGenerationStats().generated;
        const res = await runRegenerateOnPage(JOB, {
            timeoutMs: 60000, regenerate: (a) => initialiseSlot(a), collect: collectPendingGenerations, maxRetries: bound,
        }).promise;
        expect(res.ok, res.why ?? res.threw).toBe(true);
        expect(res.onPage).toBe(true);
        const placed = res.stats.placed;
        expect(placed).toBeGreaterThan(1);
        expect(Object.values(res.entries).every((e) => e.substrate === 'cloudberry')).toBe(true);
        // mutant: maxRetries left at P5c's 1 → REGION_GENERATION_STILL_PENDING after the second region
        expect(res.retries).toBe(placed);
        expect(g.calls).toBe(placed);
        expect(cloudberryGenerationStats().generated - generatedBefore).toBe(placed);
        // the bare synchronous initialise, now every level is cached, is the same result
        const again = initialiseSlot(JOB);
        expect(again.ok).toBe(true);
        expect(recorded(res)).toBe(recorded(again));
    });

    it('⛓ with P5c\'s bound of ONE retry the same slot is refused by name (the bound is what moved)', async () => {
        installCloudberryGenerator(countingGenerator(), { store: null });
        const res = await regenerateAwaitingGeneration(() => initialiseSlot(JOB), { collect: collectPendingGenerations });
        expect(res.ok).toBe(false);
        expect(res.stillPending).toBe(true);
        expect(res.why).toContain(`${REGION_GENERATION_STILL_PENDING} (retried 1 of its bound 1)`);
        expect(initialiseAnswer(JOB, res, 60).text).toContain(REGION_GENERATION_STILL_PENDING);
    });

    it('⛓⛓ a generation that FAILS mid-slot is the answer BY NAME (its region), never "still pending"', async () => {
        const g = countingGenerator({ failOn: 3 });
        installCloudberryGenerator(g, { store: null });
        const res = await regenerateAwaitingGeneration(() => initialiseSlot(JOB), {
            collect: collectPendingGenerations, maxRetries: initialisePageRetryBound(DOC, P),
        });
        expect(res.ok).toBe(false);
        expect(res.stillPending).toBeUndefined();
        expect(res.why).toContain('CloudberryLevelRefused');
        expect(res.why).toContain('the generator failed: the hidden page timed out');
        expect(res.retries).toBe(3);
        expect(g.calls).toBe(3);
        const text = initialiseAnswer(JOB, res, 60).text;
        expect(text).toContain('the hidden page timed out');
        expect(text).toContain(res.region);
    });
});

describe('the bound and the no-progress guard', () => {
    it('⛓ the bound: fresh work pending on every ask stops at maxRetries, refused by name', async () => {
        let asks = 0;
        const collect = (fn) => ({ value: fn(), pending: [Promise.resolve()] });
        const res = await regenerateAwaitingGeneration(() => { asks += 1; return { ok: false, why: 'still generating' }; },
            { collect, maxRetries: 3 });
        // mutant: `while (true)` → asks never stops (the test times out); `<=` → asks 5
        expect(asks).toBe(4);
        expect(res).toMatchObject({ ok: false, stillPending: true, retries: 3 });
        // an initialise answer carries `why`: it is the refusal (mutant: only `threw` set → the answer prints the old why)
        expect(res.why).toBe(`${REGION_GENERATION_STILL_PENDING} (retried 3 of its bound 3); its last refusal: still generating`);
        expect(res.threw).toBe(res.why);
    });

    it('⛓ no progress: a retry that yields work it ALREADY awaited is refused at once', async () => {
        let asks = 0;
        const same = Promise.resolve();
        const collect = (fn) => ({ value: fn(), pending: [same] });
        const res = await regenerateAwaitingGeneration(() => { asks += 1; return { ok: false, threw: 'generating' }; },
            { collect, maxRetries: 10 });
        // mutant: no `awaited` guard → asks 11, refused as STILL_PENDING
        expect(asks).toBe(2);
        expect(res.stillPending).toBe(true);
        expect(res.threw).toBe(`${REGION_GENERATION_NO_PROGRESS} (retried 1 of its bound 10); its last refusal: generating`);
        expect(res.why).toBeUndefined();
    });

    it('⛓ the bound is the slot\'s region count, at least one', () => {
        expect(initialisePageRetryBound(DOC, P)).toBe(Object.keys(DOC.regions[P]).length);
        expect(initialisePageRetryBound({ regions: {} }, P)).toBe(1);
    });
});

describe('the page\'s sentences', () => {
    it('⛓ timeout and Cancel of a page run are their own sentences; the ticker says "(on this page)"', async () => {
        let fire = null;
        const h = runRegenerateOnPage(JOB, {
            timeoutMs: 5000, regenerate: () => ({ ok: false, why: 'generating' }),
            collect: (fn) => ({ value: fn(), pending: [new Promise(() => {})] }),
            setTimer: (fn) => { fire = fn; return 1; }, clearTimer: () => {}, maxRetries: 9,
        });
        fire();
        const res = await h.promise;
        expect(res).toMatchObject({ ok: false, timedOut: true, onPage: true });
        const progress = { type: 'region', index: 4, total: 9 };
        // mutant: no onPage branch → "The worker was stopped" (no worker was)
        const t = initialiseAnswer(JOB, res, 5, progress).text;
        expect(t).toContain('on this page gave up after 5 s after building 4 / 9 regions');
        expect(t).toContain('the generation already started keeps running and is cached');
        expect(t).not.toContain('The worker was stopped');

        const c = runRegenerateOnPage(JOB, {
            timeoutMs: 5000, regenerate: () => ({ ok: false, why: 'generating' }),
            collect: (fn) => ({ value: fn(), pending: [new Promise(() => {})] }),
        });
        c.cancel();
        expect(initialiseAnswer(JOB, await c.promise, 5).text).toBe(`apworld: ${REGION_GENERATION_CANCELLED_ON_PAGE}.`);

        expect(initialiseTickerText({ phase: 'running', elapsedS: 1.25, budgetS: 60, progress, onPage: true }))
            .toBe('(on this page) built 4 / 9 · 1.3 s of 60');
        expect(initialiseTickerText({ phase: 'running', elapsedS: 1.25, budgetS: 60, progress }))
            .toBe('built 4 / 9 · 1.3 s of 60');
    });
});
