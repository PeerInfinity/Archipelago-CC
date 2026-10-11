/**
 * ⛓ AXE_DODGE HOOK (slice `seedling-js-axe-dodge`, ⚖ the user 2026-10-11) — fidelity's SOLVECOST switch
 * `solverBot.AXE_DODGE_ASK_PER_PREVIEW` is settable in the browser, the CONTACT hook's pattern
 * (`contactFidelityHook.test.js`): a flashPanel setting whose `default` IS the model's own value (read, never
 * restated); the JS page and the wasm engine apply it; a solve WORKER (its own module copy) runs the value the request
 * carries; and ⚖ "identical plans on every machine" — at the default the request is byte-identical to today's,
 * off-default it is STAMPED, and so is the answer.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Worker as NodeWorker } from 'node:worker_threads';

import { AXE_DODGE_ASK_PER_PREVIEW } from './solverBot.js';
import {
    AXE_DODGE_ASK_PER_PREVIEW_DEFAULT, applyAxeDodgeAsk, axeDodgeAskStamp, formatAxeDodgeAsk, parseAxeDodgeAsk,
    withAxeDodgeAsk,
} from './axeDodgeAskHook.js';
import { createWorkerSolveService } from './jsRuntimeSolveService.js';
import { createInPlaceSolveService } from './jsRuntimeSolver.js';
import { register } from '../flashPanel/index.js';
import {
    AXE_DODGE_SETTING_KEY, AXE_DODGE_SETTING_PROP, axeDodgeOverride, axeDodgePageParam,
} from '../flashPanel/seedlingAxeDodgeSettings.js';

/** The value that is NOT the model's default (whichever that is). */
const OFF = !AXE_DODGE_ASK_PER_PREVIEW_DEFAULT;

function settingsSchema() {
    let schema = null;
    const api = new Proxy({}, { get: (_t, name) => (...a) => { if (name === 'registerSettingsSchema') schema = a[0]; } });
    register(api);
    return schema;
}

describe('defaults = defaults: the setting\'s `default` is the model\'s own value, read and never restated', () => {
    it('the hook\'s default is what the solver module holds (read at import)', () => {
        expect(AXE_DODGE_ASK_PER_PREVIEW_DEFAULT).toBe(AXE_DODGE_ASK_PER_PREVIEW.enabled);
    });

    it('flashPanel.seedlingAxeDodgeAskPerPreview: default | on | off, schema default `default`', () => {
        const props = settingsSchema()?.properties ?? {};
        expect(props[AXE_DODGE_SETTING_PROP]).toMatchObject({ type: 'string', enum: ['default', 'on', 'off'], default: 'default' });
        expect(AXE_DODGE_SETTING_KEY).toBe(`moduleSettings.flashPanel.${AXE_DODGE_SETTING_PROP}`);
    });

    it('`default` (and anything unknown) is no override, and gives the page URL no parameter', () => {
        expect(axeDodgeOverride('default')).toBeNull();
        expect(axeDodgeOverride(undefined)).toBeNull();
        expect(axeDodgeOverride(true)).toBeNull();
        expect(axeDodgePageParam('default')).toBe('');
        expect(axeDodgePageParam(null)).toBe('');
    });
});

describe('the grammar, the stamp and the page query', () => {
    afterEach(() => applyAxeDodgeAsk(null));

    it('parse ∘ format is the identity; an unknown value throws by name', () => {
        expect(parseAxeDodgeAsk(formatAxeDodgeAsk(true))).toBe(true);
        expect(parseAxeDodgeAsk(formatAxeDodgeAsk(false))).toBe(false);
        expect(() => parseAxeDodgeAsk('maybe', '?axeDodgeAskPerPreview=')).toThrow(/\?axeDodgeAskPerPreview= is "maybe"/);
    });

    it('at the default nothing is stamped', () => {
        expect(AXE_DODGE_ASK_PER_PREVIEW.enabled).toBe(AXE_DODGE_ASK_PER_PREVIEW_DEFAULT);
        expect(axeDodgeAskStamp()).toBeNull();
        // forcing the default's own value is still the default: no stamp
        applyAxeDodgeAsk(AXE_DODGE_ASK_PER_PREVIEW_DEFAULT);
        expect(axeDodgeAskStamp()).toBeNull();
    });

    it('off-default: the stamp is the value, and the page parameter names it', () => {
        applyAxeDodgeAsk(OFF);
        expect(axeDodgeAskStamp()).toBe(OFF);
        const param = axeDodgePageParam(formatAxeDodgeAsk(OFF));
        expect(parseAxeDodgeAsk(new URLSearchParams(param).get('axeDodgeAskPerPreview'))).toBe(OFF);
        applyAxeDodgeAsk(null);
        expect(AXE_DODGE_ASK_PER_PREVIEW.enabled).toBe(AXE_DODGE_ASK_PER_PREVIEW_DEFAULT);
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

describe('the request: byte-identical at the default, stamped only off-default', () => {
    it('the default adds no field (today\'s request exactly)', () => {
        const [msg] = postedBy((s) => s.start({ ...REQUEST }));
        expect('axeDodgeAskPerPreview' in msg.request).toBe(false);
        expect(JSON.stringify(Object.keys(msg.request))).toBe(JSON.stringify(Object.keys({ ...REQUEST })));
    });

    it('an off-default value of the posting instance rides on the request', () => {
        const [msg] = withAxeDodgeAsk(OFF, () => postedBy((s) => s.start({ ...REQUEST })));
        expect(msg.request.axeDodgeAskPerPreview).toBe(OFF);
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

describe('the WORKER (its own module copy) solves under the request\'s value, and says so', () => {
    it('a stamped request\'s answer carries the value the worker\'s switch READ; a default one carries none', async () => {
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
            const off = await withAxeDodgeAsk(OFF, () => ask({ ...req }));
            expect(off.ok).toBe(false);
            expect(off.axeDodgeAskPerPreview).toBe(OFF);
            const plain = await ask({ ...req });
            expect(plain.axeDodgeAskPerPreview).toBeUndefined();
        } finally { service.dispose(); }
    });

    it('in place, the same: the stamp names the value an off-default instance solved under', () => {
        const svc = createInPlaceSolveService();
        const req = { ...REQUEST, staging: { boot: { level: 999, x: 0, y: 0 } } };
        const off = withAxeDodgeAsk(OFF, () => svc.start({ ...req }).result);
        expect(off.axeDodgeAskPerPreview).toBe(OFF);
        expect(svc.start({ ...req }).result.axeDodgeAskPerPreview).toBeUndefined();
        expect(AXE_DODGE_ASK_PER_PREVIEW.enabled).toBe(AXE_DODGE_ASK_PER_PREVIEW_DEFAULT);
    });
});
