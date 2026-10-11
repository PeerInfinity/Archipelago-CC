/**
 * ⛓ CONTACT HOOK (slice `seedling-js-contact-hook`, ⚖ the user 2026-10-11) — the model's contact switches
 * (`contactFidelity.js`) are settable in the browser, the KILLLOCK hook's pattern (`killLockBodiesHook.test.js`):
 * flashPanel settings defaulted to `CONTACT_FIDELITY_DEFAULTS`, one per key of `CONTACT_FIDELITY` itself; the
 * panel's instance and the JS page apply them; a solve WORKER (its own module copy) runs the set the request
 * carries; and ⚖ "identical plans on every machine" — at the defaults the request is byte-identical to today's,
 * off-default it is STAMPED, and so is the answer.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Worker as NodeWorker } from 'node:worker_threads';

import {
    CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, CONTACT_FIDELITY_KEYS, applyContactFidelity, contactFidelityStamp,
    formatContactFidelity, isDefaultContactFidelity, parseContactFidelity, withContactFidelity,
} from './contactFidelity.js';
import { createWorkerSolveService } from './jsRuntimeSolveService.js';
import { createInPlaceSolveService } from './jsRuntimeSolver.js';
import { register } from '../flashPanel/index.js';
import { CONTACT_SETTING_KEYS, contactPageParam, contactSettingProp } from '../flashPanel/seedlingContactSettings.js';

/** BULB's A/B: `bulbLive` flipped from its default, plus one more key the other way. */
const OFF = { ...CONTACT_FIDELITY_DEFAULTS, bulbLive: !CONTACT_FIDELITY_DEFAULTS.bulbLive,
    drillLive: !CONTACT_FIDELITY_DEFAULTS.drillLive };

function settingsSchema() {
    let schema = null;
    const api = new Proxy({}, { get: (_t, name) => (...a) => { if (name === 'registerSettingsSchema') schema = a[0]; } });
    register(api);
    return schema;
}

describe('the settings: one boolean per switch of CONTACT_FIDELITY, the schema default IS the model\'s default', () => {
    const props = settingsSchema()?.properties ?? {};
    it('the key list is CONTACT_FIDELITY\'s own keys (a switch added later is covered without an edit)', () => {
        expect(CONTACT_FIDELITY_KEYS).toEqual(Object.keys(CONTACT_FIDELITY));
        expect(Object.keys(CONTACT_SETTING_KEYS)).toEqual(Object.keys(CONTACT_FIDELITY));
        const missing = Object.keys(CONTACT_FIDELITY).filter((k) => !props[contactSettingProp(k)]);
        expect(missing, 'contact switches with no flashPanel setting').toEqual([]);
    });
    for (const k of CONTACT_FIDELITY_KEYS) {
        it(`${k} → flashPanel.${contactSettingProp(k)}, default ${CONTACT_FIDELITY_DEFAULTS[k]}`, () => {
            expect(props[contactSettingProp(k)]).toMatchObject({ type: 'boolean', default: CONTACT_FIDELITY_DEFAULTS[k] });
            expect(CONTACT_SETTING_KEYS[k]).toBe(`moduleSettings.flashPanel.${contactSettingProp(k)}`);
        });
    }
});

describe('the grammar, the stamp and the page query', () => {
    afterEach(() => applyContactFidelity(CONTACT_FIDELITY_DEFAULTS));

    it('parse ∘ format is the identity; `none` / `all`; an unknown key throws by name', () => {
        expect(parseContactFidelity(formatContactFidelity(OFF))).toEqual(OFF);
        expect(Object.values(parseContactFidelity('none')).every((v) => v === false)).toBe(true);
        expect(Object.values(parseContactFidelity('all')).every((v) => v === true)).toBe(true);
        expect(() => parseContactFidelity('nope', '?contactFidelity=')).toThrow(/\?contactFidelity= names "nope"/);
    });

    it('at the defaults nothing is stamped and the page URL gets no parameter', () => {
        expect(isDefaultContactFidelity(CONTACT_FIDELITY)).toBe(true);
        expect(contactFidelityStamp()).toBeNull();
        expect(contactPageParam(CONTACT_FIDELITY_DEFAULTS)).toBe('');
    });

    it('off-default: the stamp is the full set, and the page parameter names it', () => {
        applyContactFidelity(OFF);
        expect(contactFidelityStamp()).toEqual(OFF);
        expect(parseContactFidelity(new URLSearchParams(contactPageParam(OFF)).get('contactFidelity'))).toEqual(OFF);
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
        expect('contactFidelity' in msg.request).toBe(false);
        expect(JSON.stringify(Object.keys(msg.request))).toBe(JSON.stringify(Object.keys({ ...REQUEST })));
    });

    it('an off-default set of the posting instance rides on the request', () => {
        const [msg] = withContactFidelity(OFF, () => postedBy((s) => s.start({ ...REQUEST })));
        expect(msg.request.contactFidelity).toEqual(OFF);
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
            const off = await withContactFidelity(OFF, () => ask({ ...req }));
            expect(off.ok).toBe(false);
            expect(off.contactFidelity).toEqual(OFF);
            const plain = await ask({ ...req });
            expect(plain.contactFidelity).toBeUndefined();
        } finally { service.dispose(); }
    });

    it('in place, the same: the stamp names the set an off-default instance solved under', () => {
        const svc = createInPlaceSolveService();
        const req = { ...REQUEST, staging: { boot: { level: 999, x: 0, y: 0 } } };
        const off = withContactFidelity(OFF, () => svc.start({ ...req }).result);
        expect(off.contactFidelity).toEqual(OFF);
        expect(svc.start({ ...req }).result.contactFidelity).toBeUndefined();
    });
});
