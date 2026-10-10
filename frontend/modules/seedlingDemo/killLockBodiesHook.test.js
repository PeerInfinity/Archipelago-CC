/**
 * ⛓ KILLLOCK HOOK (slice `seedling-js-forkrun`, ⚖ the user 2026-10-10) — the model's kill-lock body switches
 * (`killLockBodies.js`, K1–K5) are settable in the browser: flashPanel settings defaulted to
 * `KILLLOCK_BODIES_DEFAULTS`; the panel's instance and the JS page apply them; a solve WORKER (its own module
 * copy) runs the set the request carries; and ⚖ "identical plans on every machine" — at the defaults the
 * request is byte-identical to today's, off-default it is STAMPED, and so is the plan.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Worker as NodeWorker } from 'node:worker_threads';

import {
    KILLLOCK_BODIES, KILLLOCK_BODIES_DEFAULTS, KILLLOCK_BODIES_KEYS, applyKillLockBodies, formatKillLockBodies,
    isDefaultKillLockBodies, killLockBodiesStamp, parseKillLockBodies, withKillLockBodies,
} from './killLockBodies.js';
import { createWorkerSolveService } from './jsRuntimeSolveService.js';
import { createInPlaceSolveService } from './jsRuntimeSolver.js';
import { register } from '../flashPanel/index.js';
import { KILLLOCK_SETTING_KEYS, killLockPageQuery, killLockSettingProp } from '../flashPanel/seedlingKillLockSettings.js';

const OFF = { ...KILLLOCK_BODIES_DEFAULTS, lavaRunnerLive: true, chaserKillArm: false };

function settingsSchema() {
    let schema = null;
    const api = new Proxy({}, { get: (_t, name) => (...a) => { if (name === 'registerSettingsSchema') schema = a[0]; } });
    register(api);
    return schema;
}

describe('the settings: one boolean per switch, the schema default IS the model\'s default', () => {
    const props = settingsSchema()?.properties ?? {};
    for (const k of KILLLOCK_BODIES_KEYS) {
        it(`${k} → flashPanel.${killLockSettingProp(k)}, default ${KILLLOCK_BODIES_DEFAULTS[k]}`, () => {
            expect(props[killLockSettingProp(k)]).toMatchObject({ type: 'boolean', default: KILLLOCK_BODIES_DEFAULTS[k] });
            expect(KILLLOCK_SETTING_KEYS[k]).toBe(`moduleSettings.flashPanel.${killLockSettingProp(k)}`);
        });
    }
});

describe('the grammar, the stamp and the page query', () => {
    afterEach(() => applyKillLockBodies(KILLLOCK_BODIES_DEFAULTS));

    it('parse ∘ format is the identity; `none` / `all`; an unknown key throws by name', () => {
        expect(parseKillLockBodies(formatKillLockBodies(OFF))).toEqual(OFF);
        expect(Object.values(parseKillLockBodies('none')).every((v) => v === false)).toBe(true);
        expect(Object.values(parseKillLockBodies('all')).every((v) => v === true)).toBe(true);
        expect(() => parseKillLockBodies('nope', '?killLockBodies=')).toThrow(/\?killLockBodies= names "nope"/);
    });

    it('at the defaults nothing is stamped and the page URL gets no query', () => {
        expect(isDefaultKillLockBodies(KILLLOCK_BODIES)).toBe(true);
        expect(killLockBodiesStamp()).toBeNull();
        expect(killLockPageQuery(KILLLOCK_BODIES_DEFAULTS)).toBe('');
    });

    it('off-default: the stamp is the full set, and the page query names it', () => {
        applyKillLockBodies(OFF);
        expect(killLockBodiesStamp()).toEqual(OFF);
        expect(parseKillLockBodies(new URLSearchParams(killLockPageQuery(OFF)).get('killLockBodies'))).toEqual(OFF);
    });
});

/** A fake worker: what the service POSTS. */
function postedBy(run) {
    const posted = [];
    const service = createWorkerSolveService({ createWorker: () => ({ onmessage: null, onerror: null,
        postMessage: (m) => posted.push(m), terminate() {} }) });
    run(service);
    service.dispose();
    return posted;
}
const REQUEST = { staging: { boot: { level: 1, x: 0, y: 0 } }, perTick: [], live: {}, solverGoal: { kind: 'reach-exit' },
    source: { records: new Map() } };

describe('the request: byte-identical at the defaults, stamped off-default', () => {
    it('the defaults add no field (today\'s request exactly)', () => {
        const [msg] = postedBy((s) => s.start({ ...REQUEST }));
        expect('killLockBodies' in msg.request).toBe(false);
    });

    it('an off-default set of the posting instance rides on the request', () => {
        const [msg] = withKillLockBodies(OFF, () => postedBy((s) => s.start({ ...REQUEST })));
        expect(msg.request.killLockBodies).toEqual(OFF);
    });
});

const ENTRY = new URL('./jsRuntimeSolveWorker.js', import.meta.url).href;
function nodeWorker() {
    const w = new NodeWorker(`
        const { parentPort } = require('node:worker_threads');
        globalThis.self = {
            postMessage: (m) => parentPort.postMessage(m),
            set onmessage(fn) { parentPort.on('message', (data) => fn({ data })); },
        };
        import(${JSON.stringify(ENTRY)});
    `, { eval: true });
    const adapter = { onmessage: null, onerror: null, postMessage: (m) => w.postMessage(m), terminate: () => w.terminate() };
    w.on('message', (data) => adapter.onmessage?.({ data }));
    w.on('error', (err) => adapter.onerror?.({ message: err.message }));
    return adapter;
}

describe('the WORKER (its own module copy) solves under the request\'s set, and says so', () => {
    it('a stamped request\'s answer carries the set the worker\'s switches READ; a default one carries none', async () => {
        const service = createWorkerSolveService({ createWorker: nodeWorker });
        const ask = async (request) => {
            const h = service.start(request);
            for (let i = 0; i < 2000 && !h.settled; i += 1) await new Promise((r) => { setTimeout(r, 10); });
            expect(h.settled).toBe(true);
            return h.result;
        };
        try {
            // A request the worker answers at once (no such room): the stamp still says what it ran under.
            const req = { ...REQUEST, staging: { boot: { level: 999, x: 0, y: 0 } } };
            const off = await withKillLockBodies(OFF, () => ask({ ...req }));
            expect(off.ok).toBe(false);
            expect(off.killLockBodies).toEqual(OFF);
            const plain = await ask({ ...req });
            expect(plain.killLockBodies).toBeUndefined();
        } finally { service.dispose(); }
    });

    it('in place, the same: the stamp names the set an off-default instance solved under', () => {
        const svc = createInPlaceSolveService();
        const req = { ...REQUEST, staging: { boot: { level: 999, x: 0, y: 0 } } };
        const off = withKillLockBodies(OFF, () => svc.start({ ...req }).result);
        expect(off.killLockBodies).toEqual(OFF);
        expect(svc.start({ ...req }).result.killLockBodies).toBeUndefined();
    });
});
