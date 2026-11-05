/**
 * apworldEditor — P5c: **ONE PRESS REGENERATES A REGION WHOSE GENERATION IS ASYNC**.
 *
 * A realiser whose generator runs outside JS (cloudberry's game page; here the
 * stand-in `cloudberryTestGenerator`) yields the promise of that work; a
 * synchronous drain records it (`collectPendingGenerations`) and the press awaits
 * exactly that work, then asks ONCE more (`regenerateAwaitingGeneration`). The
 * pins, each with the mutant it kills (named in the test):
 *   - async success: one press builds, and the stand-in generated once;
 *   - sync substrate unchanged: one call, nothing pending, the very same answer;
 *   - async failure: the generation's failure is the answer, by name, never retried green;
 *   - a second press while the first is pending generates nothing more;
 *   - the bound: a retry that again finds work pending is refused by name;
 *   - the worker's flag and the page run's timeout/cancel.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { collectPendingGenerations, generateRegion } from '../procgenPipeline/procgenPipelineEngine.js';
import {
    clearCloudberryLevelCache, cloudberryGenerationStats, installCloudberryGenerator,
} from '../cloudberryDemo/cloudberryGeneration.js';
import { cloudberryTestGenerator } from '../cloudberryDemo/cloudberryTestGenerator.js';
import { applyRulesDocOp } from './rulesDocOps.js';
import {
    REGION_GENERATION_STILL_PENDING, flagPendingGeneration, regenerateAwaitingGeneration, runRegenerateOnPage,
} from './regionGenerationRun.js';
import { regenerationAnswer } from './regionGenerationFlow.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}
const read = (rel) => JSON.parse(readFileSync(join(ROOT, 'frontend', 'presets', rel), 'utf8'));
const CB = read('cloudberry_sphere_worldgen/AP_14089154938208861744/AP_14089154938208861744_rules.json');
const FOUR = read('multiworld/AP_05594871498841892311/AP_05594871498841892311_rules.json');
const op = (p, region, substrate, seed = 7) => ({ op: 'regenerate-region-sidecar', player: p, region, substrate, seed });
/** The start region: its way back needs nothing, so the plan is accepted. */
const CB_OP = op('1', 'region_2_2', 'cloudberry');

/** A stand-in that counts its generations and can be told to fail. */
function countingGenerator({ fail = null } = {}) {
    const base = cloudberryTestGenerator();
    const g = {
        build: base.build,
        features: base.features,
        calls: 0,
        async generate(args) {
            g.calls += 1;
            if (fail) throw new Error(fail);
            return base.generate(args);
        },
    };
    return g;
}

beforeEach(() => clearCloudberryLevelCache());
afterEach(() => { installCloudberryGenerator(null, { store: null }); clearCloudberryLevelCache(); });

describe('the engine collects what a synchronous region drain could not wait on', () => {
    it('⛓ a sync realiser yields no `await`: nothing pending', () => {
        // mutant: notePendingGeneration pushes every event → this sees maze's progress events
        const { pending, value } = collectPendingGenerations(() => applyRulesDocOp(FOUR, op('3', 'region_1_0', 'maze', 1)));
        expect(value.ok).toBe(true);
        expect(pending).toEqual([]);
        // a ZONE realiser that yields progress events with no `await` (bounce's attempts): still nothing
        const z = collectPendingGenerations(() => applyRulesDocOp(FOUR, op('1', 'region_1_0', 'bounce', 1)));
        expect(z.value.ok, z.value.error).toBe(true);
        expect(z.pending).toEqual([]);
    });

    it('⛓ the collector nests and restores (an inner call keeps its own)', () => {
        installCloudberryGenerator(countingGenerator(), { store: null });
        const outer = collectPendingGenerations(() => {
            const inner = collectPendingGenerations(() => applyRulesDocOp(CB, CB_OP));
            expect(inner.pending.length).toBe(1);
            return null;
        });
        expect(outer.pending).toEqual([]);
        // and no collector is left installed: a later bare drain records nowhere
        expect(() => generateRegion).not.toThrow();
    });
});

describe('ONE press: await the yielded work, then ask once more', () => {
    it('⛓⛓ async success — the first ask is refused while it generates; one press builds', async () => {
        const g = countingGenerator();
        installCloudberryGenerator(g, { store: null });
        // the premise, the old behaviour: the bare synchronous op refuses the first press
        const bare = applyRulesDocOp(CB, CB_OP);
        expect(bare.ok).toBe(false);
        expect(bare.error).toMatch(/cannot wait/);
        clearCloudberryLevelCache();
        let waited = 0;
        const res = await regenerateAwaitingGeneration(() => applyRulesDocOp(CB, CB_OP), {
            collect: collectPendingGenerations, onPending: () => { waited += 1; },
        });
        // mutant: return first.value without awaiting → ok false
        expect(res.ok, res.error).toBe(true);
        expect(res.retried).toBe(true);
        expect(waited).toBe(1);
        expect(res.doc.preset_sidecars['1'].region_2_2.substrate).toBe('cloudberry');
        expect(g.calls).toBeGreaterThan(0);
    });

    it('⛓⛓ sync substrate unchanged — one call, the same answer object, bytes equal to the bare op', async () => {
        let calls = 0;
        const bare = applyRulesDocOp(FOUR, op('3', 'region_1_0', 'maze', 1));
        let first = null;
        const res = await regenerateAwaitingGeneration(() => {
            calls += 1;
            first = applyRulesDocOp(FOUR, op('3', 'region_1_0', 'maze', 1));
            return first;
        }, { collect: collectPendingGenerations });
        // mutant: always retry once → calls 2 and `retried` set
        expect(calls).toBe(1);
        expect(res).toBe(first);
        expect(JSON.stringify(res.doc)).toBe(JSON.stringify(bare.doc));
        expect(res.description).toBe(bare.description);
        // a sync REFUSAL is likewise answered as it stands (no retry)
        let refusals = 0;
        const refused = await regenerateAwaitingGeneration(() => { refusals += 1; return applyRulesDocOp(FOUR, op('3', 'nope', 'maze', 1)); },
            { collect: collectPendingGenerations });
        expect(refusals).toBe(1);
        expect(refused.ok).toBe(false);
        expect(refused.error).toBe(applyRulesDocOp(FOUR, op('3', 'nope', 'maze', 1)).error);
    });

    it('⛓⛓ async failure — the generator\'s failure is the answer BY NAME, never retried to green', async () => {
        const g = countingGenerator({ fail: 'the hidden page timed out' });
        installCloudberryGenerator(g, { store: null });
        let asks = 0;
        const res = await regenerateAwaitingGeneration(() => { asks += 1; return applyRulesDocOp(CB, CB_OP); },
            { collect: collectPendingGenerations });
        expect(asks).toBe(2);
        expect(res.ok).toBe(false);
        // mutant: drop takeSettledCloudberryFailure → the retry starts a NEW generation and is
        //   refused as REGION_GENERATION_STILL_PENDING, the failure unnamed
        expect(res.error).toContain('CloudberryLevelRefused');
        expect(res.error).toContain('the generator failed: the hidden page timed out');
        expect(res.stillPending).toBeUndefined();
        expect(g.calls).toBe(1);
        // handed ONCE: the next press tries again (a transient failure is not remembered)
        await regenerateAwaitingGeneration(() => applyRulesDocOp(CB, CB_OP), { collect: collectPendingGenerations });
        expect(g.calls).toBe(2);
    });

    it('⛓⛓ a second press while the first is pending generates nothing more, and both build', async () => {
        const g = countingGenerator();
        installCloudberryGenerator(g, { store: null });
        const io = { collect: collectPendingGenerations };
        const generatedBefore = cloudberryGenerationStats().generated;
        const a = regenerateAwaitingGeneration(() => applyRulesDocOp(CB, CB_OP), io);
        const callsAfterFirst = g.calls;
        const b = regenerateAwaitingGeneration(() => applyRulesDocOp(CB, CB_OP), io);
        const [ra, rb] = await Promise.all([a, b]);
        expect(ra.ok && rb.ok).toBe(true);
        // mutant: ensureCloudberryLevel without the in-flight map → the second press generates again
        expect(g.calls).toBe(callsAfterFirst);
        expect(cloudberryGenerationStats().generated - generatedBefore).toBe(1);
        expect(JSON.stringify(ra.doc)).toBe(JSON.stringify(rb.doc));
    });

    it('⛓ the bound: a retry that again finds work pending is refused by name, not retried', async () => {
        let asks = 0;
        const never = { ok: false, threw: 'still generating' };
        const collect = (fn) => ({ value: fn(), pending: [Promise.resolve()] });
        const res = await regenerateAwaitingGeneration(() => { asks += 1; return never; }, { collect });
        // mutant: a while loop with no bound → asks never stops (the test times out)
        expect(asks).toBe(2);
        expect(res.ok).toBe(false);
        expect(res.stillPending).toBe(true);
        expect(res.threw).toBe(`${REGION_GENERATION_STILL_PENDING} (retried 1 of its bound 1); its last refusal: still generating`);
    });
});

describe('the worker flags it; the page finishes it', () => {
    it('⛓ flagPendingGeneration flags a refusal that left work pending — only that', () => {
        const pend = (value, n) => () => ({ value, pending: Array.from({ length: n }, () => Promise.resolve()) });
        expect(flagPendingGeneration(null, pend({ ok: false, threw: 'x' }, 1)).pendingGeneration).toBe(true);
        // mutant: flag on any pending → a success would be re-run on the page
        expect(flagPendingGeneration(null, pend({ ok: true }, 1)).pendingGeneration).toBeUndefined();
        const plain = { ok: false, threw: 'a plain refusal' };
        expect(flagPendingGeneration(null, pend(plain, 0))).toBe(plain);
    });

    it('⛓ the page run answers the job with ms, onPage; a refusal that is not "generating" is its own sentence', async () => {
        installCloudberryGenerator(countingGenerator(), { store: null });
        const { regenerateRegionEntry } = await import('./regionRegenerate.js');
        const args = { doc: CB, player: '1', region: 'region_2_2', substrate: 'cloudberry', seed: 7 };
        const h = runRegenerateOnPage(args, { timeoutMs: 60000, regenerate: regenerateRegionEntry, collect: collectPendingGenerations });
        const res = await h.promise;
        expect(res.ok, res.threw).toBe(true);
        expect(res.onPage).toBe(true);
        expect(Number.isFinite(res.ms)).toBe(true);
        expect(regenerationAnswer(args, res, 60).landed).toBe(true);
        // a refusal with nothing pending is answered as it stands, not retried (P5d: region_3_2's way back
        //   no longer refuses — its entry gate is recovered — so the plan's own refusal is a wrong substrate here)
        const bad = { ...args, region: 'nope' };
        const r2 = await runRegenerateOnPage(bad, { timeoutMs: 60000, regenerate: () => ({ ok: false, threw: 'no such region', freeItems: [], hostsSurplus: false }),
            collect: collectPendingGenerations }).promise;
        expect(r2.ok).toBe(false);
        expect(r2.retried).toBeUndefined();
        expect(regenerationAnswer(bad, r2, 60).text).toContain('no such region');
    });

    it('⛓ the page run\'s budget and Cancel: one outcome each, its own sentence, a late answer ignored', async () => {
        let fire = null;
        let resolveWork = null;
        const work = new Promise((r) => { resolveWork = r; });
        const collect = (fn) => ({ value: fn(), pending: [work] });
        const args = { region: 'r', substrate: 's', seed: 1 };
        const h = runRegenerateOnPage(args, {
            timeoutMs: 5000, regenerate: () => ({ ok: false, threw: 'generating' }), collect,
            setTimer: (fn) => { fire = fn; return 1; }, clearTimer: () => {},
        });
        fire();
        const res = await h.promise;
        expect(res).toMatchObject({ ok: false, timedOut: true, onPage: true, budgetMs: 5000 });
        expect(regenerationAnswer(args, res, 5).text).toContain('Nothing was recorded; the generation already started keeps running');
        resolveWork();
        await new Promise((r) => { setTimeout(r, 0); });
        expect(h.late()).toBe(1);

        const c = runRegenerateOnPage(args, {
            timeoutMs: 5000, regenerate: () => ({ ok: false, threw: 'generating' }),
            collect: (fn) => ({ value: fn(), pending: [new Promise(() => {})] }),
        });
        c.cancel();
        const cr = await c.promise;
        expect(cr).toMatchObject({ ok: false, cancelled: true, onPage: true });
        expect(regenerationAnswer(args, cr, 5).text).toContain('generation cancelled — nothing was recorded');
    });

    it('⛓ a REJECTED pending promise is the page run\'s named failure answer, not an unhandled rejection', async () => {
        // Cloudberry's ensure already turns a generator rejection into a refusal; this pins the
        // generic path for a substrate whose yielded `await` itself rejects.
        const args = { region: 'r', substrate: 's', seed: 1 };
        const collect = (fn) => ({ value: fn(), pending: [Promise.reject(new Error('SubstrateGenFailed: the worker died'))] });
        const res = await runRegenerateOnPage(args, {
            timeoutMs: 60000, regenerate: () => ({ ok: false, threw: 'generating' }), collect,
        }).promise;
        expect(res).toMatchObject({ ok: false, onPage: true, threw: 'SubstrateGenFailed: the worker died' });
        expect(res.timedOut).toBeUndefined();
        expect(regenerationAnswer(args, res, 60).text).toContain('SubstrateGenFailed: the worker died');
    });
});
