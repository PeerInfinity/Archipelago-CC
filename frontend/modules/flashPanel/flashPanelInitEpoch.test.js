/**
 * ⛔⛔ A TORN-DOWN INIT FLOW GOES QUIET — ON EVERY TRANSPORT, AT EVERY AWAIT
 * (the init EPOCH; §5.91 finding (a)).
 *
 * `_teardownForReinit` drops the adapter, but it cannot stop an init flow that
 * is still awaiting: the settings reads in `_initializeAdapter`, the config
 * fetch in each transport's init, the Ruffle load. Measured (§5.91's DIAG): a
 * runtime switch js → auto → wasm ran TWO flows into `_initializeWasm`
 * ("config loaded" ×2); the first had not yet built its adapter, so the
 * adapter-identity guards could not see it, and it embedded an iframe and
 * attached the region glue to an adapter nobody detaches.
 *
 * The teardown now bumps `_initEpoch`; each flow captures the epoch it started
 * under and, once that is stale, writes no DOM, attaches no glue and sets no
 * status. The §5.91 adapter-identity guards stay (`flashPanelFlashTeardown.test.js`).
 *
 * ⛓ Driven on a bare panel object (the prototype's own methods, the DOM
 * stubbed): `flashPanelUI.js` imports in node, its constructor needs a DOM.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import settingsManager from '../../app/core/settingsManager.js';
import { FlashPanelUI } from './flashPanelUI.js';

const REFRESHES = ['_refreshSolverWalk', '_refreshWasmSolverBudget', '_refreshSolverUpgradeWindow',
    '_refreshKillLockBodies', '_refreshContactFidelity', '_refreshAxeDodgeAsk', '_refreshDashOnlyWindow',
    '_refreshDashShape', '_refreshJsGraphics'];

function deferred() {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    return { promise, resolve };
}

/**
 * A bare panel. `gate` names ONE of its awaits (a refresh, or `_loadConfig`)
 * to hold until the test releases it; every other await answers at once.
 */
function barePanel({ gate = null } = {}) {
    const statuses = [];
    const logs = [];
    const held = deferred();
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
        _setStatus: (text) => statuses.push(text),
        _panelLog: (msg) => logs.push(msg),
        _setupTeleportUI: vi.fn(),
        _embedWasmIframe: vi.fn(),
        _embedSwf: vi.fn(),
        _attachRegionGlue: vi.fn(),
        _detachRegionGlue: () => {},
    });
    const answer = (value) => async () => {
        return value;
    };
    for (const name of REFRESHES) panel[name] = answer(undefined);
    panel._loadConfig = answer({ game: 'Seedling', stage_size: [480, 480] });
    if (gate) {
        const inner = panel[gate];
        panel[gate] = vi.fn(async (...args) => { await held.promise; return inner(...args); });
    }
    return { panel, statuses, logs, release: () => held.resolve() };
}

/** Settle every microtask the flows can reach without the clock moving. */
async function settle() {
    for (let i = 0; i < 50; i += 1) await vi.advanceTimersByTimeAsync(0);
}

describe('the init epoch', () => {
    let hadDocument;
    let previousDocument;
    let runtime;
    beforeEach(() => {
        hadDocument = 'document' in globalThis;
        previousDocument = globalThis.document;
        globalThis.document = {
            getElementById: () => null,
            createElement: () => { throw new Error('no DOM'); },
            head: { appendChild: () => {} },
        };
        runtime = 'auto';
        vi.spyOn(settingsManager, 'getSetting').mockImplementation(async (key, fallback) => (
            key === 'moduleSettings.flashPanel.runtime' ? runtime : fallback));
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        if (hadDocument) globalThis.document = previousDocument;
        else delete globalThis.document;
    });

    /**
     * ⛔ W0 — THE DOUBLE INIT, REPRODUCED. Flow 1 (js → auto) is still in its
     * settings refreshes when the second change (auto → wasm) tears it down and
     * starts flow 2. Without the epoch, flow 1 resumed into `_initializeWasm`
     * and embedded a second iframe and attached the glue a second time.
     */
    it('⛔ js → auto → wasm: ONE iframe, ONE glue attach, and the adapter is the second flow\'s', async () => {
        const { panel, logs, release } = barePanel({ gate: '_refreshDashShape' });
        const flow1 = panel._initializeAdapter();
        await settle();
        expect(panel._refreshDashShape).toHaveBeenCalledTimes(1); // flow 1 is held there
        panel._teardownForReinit();
        runtime = 'wasm';
        const flow2 = panel._initializeAdapter();
        release();
        await settle();
        expect(logs.filter((l) => /^config loaded/.test(l))).toHaveLength(1);
        expect(panel._embedWasmIframe).toHaveBeenCalledTimes(1);
        expect(panel._attachRegionGlue).toHaveBeenCalledTimes(1);
        expect(panel._attachRegionGlue.mock.calls[0][0]).toBe(panel.adapter);
        await vi.advanceTimersByTimeAsync(31000);
        await Promise.all([flow1, flow2]);
    });

    it('⛔ a flow torn down in its first settings read builds nothing', async () => {
        const { panel, statuses, logs, release } = barePanel({ gate: '_refreshSolverWalk' });
        const flow = panel._initializeAdapter();
        await settle();
        panel._teardownForReinit();
        const at = statuses.length;
        const logsAt = logs.length;
        release();
        await settle();
        await vi.advanceTimersByTimeAsync(31000);
        await flow;
        expect(statuses.slice(at)).toEqual([]);
        expect(logs.slice(logsAt)).toEqual([]);
        expect(panel._embedWasmIframe).not.toHaveBeenCalled();
        expect(panel.adapter).toBeNull();
    });

    /**
     * ⛔ Torn down under its RUNTIME read: the stale flow must not record that
     * read as `_initRuntime` — the runtime-change handler reads `undefined`
     * there as "an init is still reading the setting".
     */
    it('⛔ a flow torn down in its runtime read leaves `_initRuntime` unset', async () => {
        const { panel, statuses, release } = barePanel();
        const read = deferred();
        settingsManager.getSetting.mockImplementationOnce(async () => { await read.promise; return 'auto'; });
        const flow = panel._initializeAdapter();
        await settle();
        panel._teardownForReinit();
        const at = statuses.length;
        read.resolve();
        release();
        await settle();
        await vi.advanceTimersByTimeAsync(31000);
        await flow;
        expect(panel._initRuntime).toBeUndefined();
        expect(statuses.slice(at)).toEqual([]);
        expect(panel._embedWasmIframe).not.toHaveBeenCalled();
    });

    /** One row per transport: torn down while its config is being fetched. */
    for (const [transport, setup] of [
        ['wasm', () => {}],
        ['js', () => { runtime = 'js'; }],
        ['flash', (panel) => { runtime = 'flash'; panel.wasmPath = null; panel.componentState.wasmPath = null; }],
    ]) {
        it(`⛔ ${transport}: torn down under its config fetch — no DOM write, no glue attach, no status`, async () => {
            const { panel, statuses, logs, release } = barePanel({ gate: '_loadConfig' });
            setup(panel);
            const flow = panel._initializeAdapter();
            await settle();
            expect(panel._loadConfig).toHaveBeenCalledTimes(1); // held inside the transport's init
            panel._teardownForReinit();
            const at = statuses.length;
            const logsAt = logs.length;
            release();
            await settle();
            await vi.advanceTimersByTimeAsync(31000);
            await flow;
            expect(statuses.slice(at)).toEqual([]);
            expect(logs.slice(logsAt)).toEqual([]);
            expect(panel._setupTeleportUI).not.toHaveBeenCalled();
            expect(panel._embedWasmIframe).not.toHaveBeenCalled();
            expect(panel._embedSwf).not.toHaveBeenCalled();
            expect(panel._attachRegionGlue).not.toHaveBeenCalled();
            expect(panel.adapter).toBeNull();
            expect(panel.gameConfig).toBeNull();
        });
    }

    it('control: NOT torn down, each transport reaches its embed and attaches the glue once', async () => {
        for (const [rt, embed] of [['wasm', '_embedWasmIframe'], ['js', '_embedWasmIframe'], ['flash', '_embedSwf']]) {
            runtime = rt;
            const { panel } = barePanel();
            if (rt === 'flash') panel.wasmPath = null;
            const flow = panel._initializeAdapter();
            await settle();
            expect(panel[embed]).toHaveBeenCalledTimes(1);
            expect(panel._attachRegionGlue).toHaveBeenCalledTimes(1);
            expect(panel.transport).toBe(rt);
            await vi.advanceTimersByTimeAsync(31000);
            await flow;
        }
    });
});
