/**
 * ⛓ SOLVER ENV → THE JS FRAME (⚖ Robert 2026-11-20, "Pass them to JS too"; measurement only).
 *
 * The host page's `?seedlingSolverEnv=` already reaches the wasm runtime's solve worker (the host's own
 * `jsRuntimeSolveService` reads `globalThis.location.search`). The JS runtime solves in its OWN frame's worker, which
 * reads the frame's query (`jsRuntimePage.js`). The Flash panel now carries the host's value into that frame's URL,
 * verbatim; absent, the URL is today's byte for byte.
 *
 * Rows: the URL builder (`solverEnvPageParam`); the panel's real init flow building the JS page URL (driven on a bare
 * panel, as `flashPanelInitEpoch.test.js` does); and the REAL worker entry, at the worker URL the JS page builds from
 * that frame URL (`jsRuntimePage.js`'s own `solveWorkerUrl(…, win.location.search)`), reading a switch set with `=0`.
 *
 * ── THE MUTATION LIST (run during development) ──
 *   m1 the panel does not add `solverEnvPageParam(...)` to the JS query -> 'the panel's JS page URL carries …' and
 *      'the JS frame's worker reads …' red
 *   m2 the helper returns a value when the host sets none                -> 'absent / blank → ''' and 'absent: …
 *      byte for byte' red
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Worker as NodeWorker } from 'node:worker_threads';

import settingsManager from '../../app/core/settingsManager.js';
import { FlashPanelUI } from './flashPanelUI.js';
import { solverEnvPageParam } from './seedlingSolverEnvCarry.js';
import { SOLVER_ENV_PARAM, solveWorkerUrl } from '../seedlingDemo/solverEnvChannel.js';

const ENTRY = new URL('../seedlingDemo/jsRuntimeSolveWorker.js', import.meta.url);
const SHIM = new URL('../seedlingDemo/solverEnvShim.js', import.meta.url).href;
const OFF = 'SEEDLING_TALK_CLEAR_GOAL=0';
const TWO = 'SEEDLING_CHOOSER_PAIR_SIZE=3;SEEDLING_TALK_CLEAR_GOAL=0';
const hostSearch = (spec) => `?rules=./presets/seedling_playthrough/AP_1/AP_1_rules.json&${SOLVER_ENV_PARAM}=${encodeURIComponent(spec)}`;

describe('solverEnvPageParam — the host query → the JS frame\'s query part', () => {
    it('present → carried VERBATIM (the frame reads back exactly the host\'s value)', () => {
        for (const spec of [OFF, TWO, 'SEEDLING_CONTACT_FIDELITY=a,b', 'SEEDLING_NOPE=1']) {
            const part = solverEnvPageParam(hostSearch(spec));
            expect(part.startsWith(`${SOLVER_ENV_PARAM}=`)).toBe(true);
            expect(new URLSearchParams(part).get(SOLVER_ENV_PARAM)).toBe(spec);
        }
    });

    it('absent / blank → \'\' (nothing to add)', () => {
        for (const search of [undefined, null, '', '?rules=x', `?${SOLVER_ENV_PARAM}=`, `?${SOLVER_ENV_PARAM}=%20`]) {
            expect(solverEnvPageParam(search)).toBe('');
        }
    });
});

/** A bare panel (the prototype's own methods, the DOM stubbed) that stops where the JS page would be embedded. */
function barePanel() {
    const panel = Object.create(FlashPanelUI.prototype);
    const componentState = {
        configPath: 'games/seedling.json', swfPath: 'swf/seedling_injected.swf', wasmPath: 'wasm/seedling.html',
    };
    Object.assign(panel, {
        componentState,
        ...componentState,
        flashObjectId: `test-${Math.random()}`,
        eventBus: { subscribe: () => () => {}, publish: () => {} },
        adapter: null,
        isInitialized: false,
        swfContainer: { innerHTML: '' },
        teleportRow: { style: {} },
        _heldKeys: { install: () => {}, uninstall: () => {} },
        _setStatus: () => {},
        _panelLog: () => {},
        _customSetRefusal: async () => null,
        _initializeWasm: vi.fn(async () => {}),
    });
    return panel;
}

describe('the Flash panel builds the JS page URL with the host\'s switches', () => {
    let hadLocation;
    let previousLocation;
    let hadDocument;
    let previousDocument;
    beforeEach(() => {
        hadLocation = 'location' in globalThis;
        previousLocation = globalThis.location;
        hadDocument = 'document' in globalThis;
        previousDocument = globalThis.document;
        globalThis.document = {
            getElementById: () => null,
            createElement: () => { throw new Error('no DOM'); },
            head: { appendChild: () => {} },
        };
        vi.spyOn(settingsManager, 'getSetting').mockImplementation(async (key, fallback) => (
            key === 'moduleSettings.flashPanel.runtime' ? 'js' : fallback));
    });
    afterEach(() => {
        vi.restoreAllMocks();
        if (hadLocation) globalThis.location = previousLocation; else delete globalThis.location;
        if (hadDocument) globalThis.document = previousDocument; else delete globalThis.document;
    });

    async function jsPageUrl(search) {
        if (search === undefined) delete globalThis.location;
        else globalThis.location = { search, href: `http://localhost:8000/${search}` };
        const panel = barePanel();
        await panel._initializeAdapter();
        expect(panel.transport).toBe('js');
        expect(panel._initializeWasm).toHaveBeenCalledTimes(1);
        return panel.wasmPath;
    }

    it('absent: today\'s URL, byte for byte (no location at all, a host query without the param, a blank param)', async () => {
        const today = await jsPageUrl(undefined);
        expect(today).toMatch(/^\.\/modules\/seedlingDemo\/jsRuntime\.html/);
        expect(today).not.toContain(SOLVER_ENV_PARAM);
        expect(await jsPageUrl('?rules=x')).toBe(today);
        expect(await jsPageUrl(`?rules=x&${SOLVER_ENV_PARAM}=`)).toBe(today);
    });

    it('the panel\'s JS page URL carries the host\'s ?seedlingSolverEnv= verbatim (and nothing else changes)', async () => {
        const today = await jsPageUrl('?rules=x');
        const url = await jsPageUrl(hostSearch(TWO));
        expect(new URL(url, 'http://localhost/').searchParams.get(SOLVER_ENV_PARAM)).toBe(TWO);
        const without = new URL(url, 'http://localhost/');
        without.searchParams.delete(SOLVER_ENV_PARAM);
        expect(new URL(today, 'http://localhost/').searchParams.toString()).toBe(without.searchParams.toString());
    });

    /** The real worker entry at `url` (node `worker_threads`, empty env, `self.location` = url): its switches. */
    const readWorker = (url) => new Promise((done, fail) => {
        const w = new NodeWorker(`
            const { parentPort } = require('node:worker_threads');
            const post = (m) => parentPort.postMessage(m);
            globalThis.self = { location: new URL(${JSON.stringify(String(url))}), postMessage: post, set onmessage(fn) {} };
            (async () => {
                await import(${JSON.stringify(ENTRY.href)});
                const shim = await import(${JSON.stringify(SHIM)});
                const env = Object.fromEntries(Object.entries(globalThis.process?.env ?? {}).filter(([k]) => k.startsWith('SEEDLING_')));
                post({ applied: shim.SOLVER_ENV_APPLIED, error: shim.SOLVER_ENV_ERROR, env });
            })().catch((e) => post({ threw: e.message }));
        `, { eval: true, env: {} });
        w.on('message', (m) => { w.terminate(); done(m); });
        w.on('error', (e) => { w.terminate(); fail(e); });
    });

    it('the JS frame\'s worker reads the host\'s switch set with =0 (SEEDLING_TALK_CLEAR_GOAL, a ships-ON switch)', async () => {
        const page = new URL(await jsPageUrl(hostSearch(OFF)), 'http://localhost:8000/');
        // `jsRuntimePage.js`: the frame builds its worker URL from its OWN query.
        const workerUrl = solveWorkerUrl(ENTRY, page.search);
        expect(workerUrl).not.toBe(ENTRY);
        const r = await readWorker(workerUrl);
        expect(r.threw).toBeUndefined();
        expect(r.error).toBe(null);
        expect(r.applied).toBe(OFF);
        expect(r.env).toEqual({ SEEDLING_TALK_CLEAR_GOAL: '0' });
        // absent: the frame's worker URL is today's (the SAME object), and the worker installs nothing.
        const plain = new URL(await jsPageUrl('?rules=x'), 'http://localhost:8000/');
        expect(solveWorkerUrl(ENTRY, plain.search)).toBe(ENTRY);
    }, 60000);
});
