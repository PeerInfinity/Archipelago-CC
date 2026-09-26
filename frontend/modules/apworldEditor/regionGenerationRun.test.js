/**
 * regionGenerationRun — the Region generation form's time limit (a SETTING) and
 * the worker that runs one region under it (APWORLD SUBSTRATE CHANGE R2, tasks
 * 1–2). The worker is FAKED here (the protocol, the timeout, Cancel, a thrown
 * realiser); the real one runs in the in-app `apworldEditor` rows.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SettingsManager } from '../../app/core/settingsManager.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { register } from './index.js';
import {
    INITIALISE_JOB, INITIALISE_TIMEOUT_DEFAULT_S, INITIALISE_TIMEOUT_KEY, INITIALISE_TIMEOUT_SETTING,
    initialiseTimeoutSeconds, initialiseTimeoutSentence,
    REGENERATE_WORKER_LIBRARIES, REGENERATE_WORKER_PATH, REGION_GENERATION_CANCELLED, REGION_GENERATION_LOAD_BOUND_MS,
    REGION_GENERATION_GAVE_UP, REGION_GENERATION_TIMEOUT_DEFAULT_S, REGION_GENERATION_TIMEOUT_KEY,
    REGION_GENERATION_TIMEOUT_SETTING, REGION_GENERATION_TIMEOUT_WHERE, regionGenerationTimeoutSeconds,
    regionGenerationTimeoutSentence, runRegenerateInWorker, runRegenerateJob,
} from './regionGenerationRun.js';
import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** The settings schema `index.js` registers, captured off a fake registration API. */
function registeredSchema() {
    const schemas = [];
    const api = new Proxy({}, {
        get: (_, name) => (name === 'registerSettingsSchema' ? (s) => schemas.push(s) : () => {}),
    });
    register(api);
    expect(schemas).toHaveLength(1);
    return schemas[0];
}

describe('the time-limit SETTING (task 1)', () => {
    it('⛓ the schema index.js registers defaults to REGION_GENERATION_TIMEOUT_DEFAULT_S — one source', () => {
        const prop = registeredSchema().properties[REGION_GENERATION_TIMEOUT_KEY];
        expect(prop.default).toBe(REGION_GENERATION_TIMEOUT_DEFAULT_S);
        expect(prop.type).toBe('integer');
        expect(prop.minimum).toBe(1);
        expect(prop.label).toMatch(/time limit/i);
        expect(prop.description).toMatch(/Generate/);
        expect(REGION_GENERATION_TIMEOUT_SETTING).toBe(`moduleSettings.apworldEditor.${REGION_GENERATION_TIMEOUT_KEY}`);
    });

    it('⛓ getSetting with NO persisted value answers the schema default (the reader passes no copy)', async () => {
        centralRegistry.registerSettingsSchema('apworldEditor', registeredSchema());
        const sm = new SettingsManager();
        sm.setInitialSettings({ moduleSettings: {} });
        expect(await sm.getSetting(REGION_GENERATION_TIMEOUT_SETTING)).toBe(REGION_GENERATION_TIMEOUT_DEFAULT_S);
        await sm.updateSetting(REGION_GENERATION_TIMEOUT_SETTING, 1, { persist: false });
        expect(await sm.getSetting(REGION_GENERATION_TIMEOUT_SETTING)).toBe(1);
    });

    it.each([
        [60, 60], [1, 1], [2.9, 2], ['7', 7], [0, 60], [-3, 60], ['abc', 60], [undefined, 60], [null, 60],
    ])('a stored value %j means a %j s budget', (stored, s) => {
        expect(regionGenerationTimeoutSeconds(stored)).toBe(s);
    });

    it('⛓ the timeout sentence quotes the setting by name, its value, and where it lives', () => {
        const t = regionGenerationTimeoutSentence(60, 'bounce', 'C');
        expect(t).toContain(`${REGION_GENERATION_GAVE_UP} 60 s`);
        expect(t).toContain(`\`${REGION_GENERATION_TIMEOUT_KEY}\` = 60`);
        expect(t).toContain(REGION_GENERATION_TIMEOUT_WHERE);
        expect(t).toContain('nothing was recorded');
    });
});

describe('R7 — the WHOLE-SLOT budget of Initialise procgen data (a separate setting)', () => {
    it('⛓ registered beside R2\'s, default INITIALISE_TIMEOUT_DEFAULT_S (300), one source', () => {
        const props = registeredSchema().properties;
        expect(Object.keys(props)).toEqual([REGION_GENERATION_TIMEOUT_KEY, INITIALISE_TIMEOUT_KEY]);
        const prop = props[INITIALISE_TIMEOUT_KEY];
        expect(INITIALISE_TIMEOUT_DEFAULT_S).toBe(300);
        expect(prop.default).toBe(INITIALISE_TIMEOUT_DEFAULT_S);
        expect(prop.type).toBe('integer');
        expect(prop.minimum).toBe(1);
        expect(prop.label).toMatch(/Initialise/);
        expect(INITIALISE_TIMEOUT_SETTING).toBe(`moduleSettings.apworldEditor.${INITIALISE_TIMEOUT_KEY}`);
    });

    it('⛓ getSetting with NO persisted value answers the default; a stored value is read', async () => {
        centralRegistry.registerSettingsSchema('apworldEditor', registeredSchema());
        const sm = new SettingsManager();
        sm.setInitialSettings({ moduleSettings: {} });
        expect(await sm.getSetting(INITIALISE_TIMEOUT_SETTING)).toBe(INITIALISE_TIMEOUT_DEFAULT_S);
        await sm.updateSetting(INITIALISE_TIMEOUT_SETTING, 2, { persist: false });
        expect(await sm.getSetting(INITIALISE_TIMEOUT_SETTING)).toBe(2);
    });

    it.each([[300, 300], [1, 1], [4.7, 4], ['12', 12], [0, 300], [-1, 300], ['x', 300], [undefined, 300]])(
        'a stored value %j means a %j s budget', (stored, s) => {
            expect(initialiseTimeoutSeconds(stored)).toBe(s);
        },
    );

    it('⛓ the sentence quotes the setting, its value, where it lives, and how far the build got', () => {
        const t = initialiseTimeoutSentence(300, 'maze', '1', { index: 120, total: 445 });
        expect(t).toContain(`${REGION_GENERATION_GAVE_UP} 300 s after building 120 / 445 regions`);
        expect(t).toContain(`\`${INITIALISE_TIMEOUT_KEY}\` = 300`);
        expect(t).toContain(REGION_GENERATION_TIMEOUT_WHERE);
        expect(t).toContain('nothing was recorded');
        expect(initialiseTimeoutSentence(5, 'maze', '1')).not.toContain('after building');
    });
});

describe('the worker file and its libraries (task 2)', () => {
    it('⛓ the worker imports exactly the REGISTRY_LIBRARIES the reference generator declares', () => {
        expect(REGENERATE_WORKER_LIBRARIES.map((l) => `frontend/modules/${l}`)).toEqual([...REGISTRY_LIBRARIES]);
    });

    it('⛓ the bundler copies the worker file (a worker cannot be bundled into bundle.js)', () => {
        const bundler = readFileSync(join(REPO, 'scripts/build/bundle-frontend.js'), 'utf8');
        expect(bundler).toContain(`'modules/${REGENERATE_WORKER_PATH}'`);
    });
});

/** A job runner's I/O, recording what it posts. */
function jobIO({ registered = ['maze', 'bounce'], failed = [], regenerate }) {
    const posted = [];
    let t = 0;
    return {
        posted,
        io: {
            post: (m) => posted.push(m),
            loadLibraries: async () => ({ registered, failed }),
            regenerate,
            now: () => (t += 5),
        },
    };
}

describe('runRegenerateJob — the worker side of the protocol', () => {
    const args = { region: 'r', substrate: 'bounce', seed: 3 };

    it('posts ready (with what registered) then the realiser\'s result, with its ms', async () => {
        const { posted, io } = jobIO({ regenerate: (a) => ({ ok: true, entry: { substrate: a.substrate } }) });
        await runRegenerateJob(args, io);
        expect(posted.map((m) => m.type)).toEqual(['ready', 'result']);
        expect(posted[0].registered).toEqual(['maze', 'bounce']);
        expect(posted[1]).toMatchObject({ ok: true, entry: { substrate: 'bounce' } });
        expect(posted[1].ms).toBeGreaterThan(0);
    });

    it('⛓ R7 — a job\'s PROGRESS messages are posted between ready and the result', async () => {
        const { posted, io } = jobIO({
            regenerate: (a, { progress }) => {
                progress({ type: 'region', index: 0, total: 2, region_id: 'A' });
                progress({ type: 'region', index: 1, total: 2, region_id: 'B' });
                return { ok: true, entries: {} };
            },
        });
        await runRegenerateJob({ job: INITIALISE_JOB, player: '1', substrate: 'bounce' }, io);
        expect(posted.map((m) => m.type)).toEqual(['ready', 'progress', 'progress', 'result']);
        expect(posted[2]).toEqual({ type: 'progress', event: { type: 'region', index: 1, total: 2, region_id: 'B' } });
    });

    it('⛓ a realiser that THROWS past the op is answered as a refusal, never a crashed worker', async () => {
        const { posted, io } = jobIO({ regenerate: () => { throw new Error('boom'); } });
        await runRegenerateJob(args, io);
        expect(posted[1]).toMatchObject({ type: 'result', ok: false, threw: 'boom' });
    });

    it('⛓ a target no loaded library registers is refused by name, with the libraries that refused', async () => {
        const regenerate = vi.fn();
        const { posted, io } = jobIO({
            registered: ['maze'], failed: [{ library: 'x/y.js', error: 'document is not defined' }], regenerate,
        });
        await runRegenerateJob(args, io);
        expect(regenerate).not.toHaveBeenCalled();
        expect(posted[1]).toMatchObject({ ok: false, unavailable: true });
        expect(posted[1].threw).toContain('`bounce`');
        expect(posted[1].threw).toContain('x/y.js refused to load (document is not defined)');
    });
});

/** A fake Worker the page side drives: records posts, terminate, and lets a row answer. */
class FakeWorker {
    constructor() {
        this.posted = [];
        this.terminated = 0;
        this.onmessage = null;
        this.onerror = null;
    }

    postMessage(m) { this.posted.push(m); }

    terminate() { this.terminated += 1; }

    say(data) { this.onmessage?.({ data }); }
}

describe('runRegenerateInWorker — the page side: budget, Cancel, terminate', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    const start = (timeoutMs = 1000) => {
        const w = new FakeWorker();
        const run = runRegenerateInWorker({ region: 'r', substrate: 'bounce' }, {
            timeoutMs, createWorker: () => w, now: () => Date.now(),
        });
        return { w, run };
    };

    it('posts the job, and a result settles it once — the worker is terminated after', async () => {
        const { w, run } = start();
        expect(w.posted).toEqual([{ type: 'run', args: { region: 'r', substrate: 'bounce' } }]);
        w.say({ type: 'ready', registered: ['bounce'], failed: [] });
        expect(run.phase()).toBe('running');
        w.say({ type: 'result', ok: true, entry: { substrate: 'bounce' }, ms: 12 });
        const out = await run.promise;
        expect(out).toMatchObject({ ok: true, entry: { substrate: 'bounce' }, ms: 12 });
        expect(w.terminated).toBe(1);
    });

    it('⛓⛓ the TIMEOUT: terminate() the worker, answer timedOut + the budget, and a late answer is ignored', async () => {
        const { w, run } = start(1000);
        w.say({ type: 'ready', registered: ['bounce'], failed: [] });
        vi.advanceTimersByTime(999);
        let settled = false;
        run.promise.then(() => { settled = true; });
        await Promise.resolve();
        expect(settled).toBe(false);
        vi.advanceTimersByTime(1);
        const out = await run.promise;
        expect(out).toMatchObject({ ok: false, timedOut: true, budgetMs: 1000, phase: 'running' });
        expect(w.terminated).toBe(1);
        w.say({ type: 'result', ok: true, entry: {} });
        expect(await run.promise).toBe(out);
        expect(w.terminated).toBe(1);
        expect(run.terminated()).toBe(true);
        expect(run.late()).toBe(1);
    });

    it('⛓ the budget RESTARTS at ready: it bounds the realiser, not the libraries\' cold start', async () => {
        const { w, run } = start(1000);
        vi.advanceTimersByTime(900);
        w.say({ type: 'ready', registered: ['bounce'], failed: [] });
        vi.advanceTimersByTime(900);
        expect(run.phase()).toBe('running');
        vi.advanceTimersByTime(100);
        expect((await run.promise).timedOut).toBe(true);
    });

    it('⛓⛓ the LOAD is not bounded by a short budget — a 1 s setting still reaches the realiser (the in-app row\'s find)', async () => {
        const { w, run } = start(1000);
        vi.advanceTimersByTime(1500);
        expect(run.phase()).toBe('loading');
        w.say({ type: 'ready', registered: ['bounce'], failed: [] });
        expect(run.phase()).toBe('running');
        vi.advanceTimersByTime(1000);
        expect(await run.promise).toMatchObject({ timedOut: true, phase: 'running', budgetMs: 1000 });
    });

    it('⛓ a load that never says ready ends at REGION_GENERATION_LOAD_BOUND_MS (or the budget, if longer)', async () => {
        const { w, run } = start(1000);
        vi.advanceTimersByTime(REGION_GENERATION_LOAD_BOUND_MS - 1);
        expect(run.phase()).toBe('loading');
        vi.advanceTimersByTime(1);
        expect(await run.promise).toMatchObject({ timedOut: true, phase: 'loading', budgetMs: REGION_GENERATION_LOAD_BOUND_MS });
        expect(w.terminated).toBe(1);
        const long = start(REGION_GENERATION_LOAD_BOUND_MS + 5000);
        vi.advanceTimersByTime(REGION_GENERATION_LOAD_BOUND_MS);
        expect(long.run.phase()).toBe('loading');
    });

    it('⛓ CANCEL terminates and answers cancelled; the timer that would have fired does nothing', async () => {
        const { w, run } = start(1000);
        w.say({ type: 'ready', registered: ['bounce'], failed: [] });
        run.cancel();
        const out = await run.promise;
        expect(out).toMatchObject({ ok: false, cancelled: true });
        vi.advanceTimersByTime(5000);
        expect(w.terminated).toBe(1);
        expect(REGION_GENERATION_CANCELLED).toContain('nothing was recorded');
    });

    it('⛓ R7 — progress reaches onProgress while running; after the outcome it is LATE and dropped', async () => {
        const w = new FakeWorker();
        const seen = [];
        const run = runRegenerateInWorker({ job: INITIALISE_JOB }, {
            timeoutMs: 1000, createWorker: () => w, now: () => Date.now(), onProgress: (e) => seen.push(e),
        });
        w.say({ type: 'ready', registered: ['maze'], failed: [] });
        w.say({ type: 'progress', event: { type: 'region', index: 0, total: 3, region_id: 'A' } });
        w.say({ type: 'progress', event: { type: 'region', index: 1, total: 3, region_id: 'B' } });
        expect(seen.map((e) => e.index)).toEqual([0, 1]);
        expect(seen[0].type).toBe('region');
        run.cancel();
        const out = await run.promise;
        expect(out).toMatchObject({ ok: false, cancelled: true });
        w.say({ type: 'progress', event: { type: 'region', index: 2, total: 3, region_id: 'C' } });
        expect(seen).toHaveLength(2);
        expect(run.late()).toBe(1);
        expect(w.terminated).toBe(1);
    });

    it('a worker error is answered by name and the worker terminated', async () => {
        const { w, run } = start();
        w.onerror({ message: 'SyntaxError: x', filename: 'w.js', lineno: 3 });
        const out = await run.promise;
        expect(out).toMatchObject({ ok: false, workerFailed: true });
        expect(out.threw).toContain('SyntaxError: x (w.js:3)');
        expect(w.terminated).toBe(1);
    });
});
