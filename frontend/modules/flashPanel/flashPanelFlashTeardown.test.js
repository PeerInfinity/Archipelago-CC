/**
 * ⛔⛔ A TORN-DOWN FLASH INIT FLOW GOES QUIET (§5.91, the batch-order flake).
 *
 * The real-Flash flow (`FlashPanelUI._initializeFlash`) waits 15 s for a
 * bridge, and that wait cannot be aborted (`pollUntil.test.js` asserts the
 * Flash adapter has no cancellation). A runtime switch tears the panel down
 * and builds a replacement inside those 15 s — the `seedling-js` batch's
 * Flash-runtime row does exactly that in its cleanup, the SWF never boots on
 * CI, and the wait times out ~14 s later, inside the NEXT row. Its catch wrote
 * `bridge timeout` over the replacement wasm page's *click ▶ Start in the
 * game*, and that row waited 120 s for a status that had come and gone
 * (CI: 4/8 batch runs red at 429ba55d1e; the pair alone 20/20).
 *
 * ⛓ Driven on a bare panel object (the prototype's own method, the DOM lookup
 * stubbed): `flashPanelUI.js` imports in node, its constructor needs a DOM.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FlashPanelUI } from './flashPanelUI.js';

const START = 'click ▶ Start in the game';

function barePanel({ bridgeAt = null } = {}) {
    const statuses = [];
    const logs = [];
    const panel = Object.create(FlashPanelUI.prototype);
    Object.assign(panel, {
        configPath: 'games/seedling.json',
        swfPath: 'swf/seedling_injected.swf',
        flashObjectId: `test-${Math.random()}`,
        eventBus: { subscribe: () => () => {}, publish: () => {} },
        adapter: null,
        _setStatus: (text) => statuses.push(text),
        _panelLog: (msg) => logs.push(msg),
        _loadConfig: async () => ({ game: 'Seedling', stage_size: [480, 480] }),
        _setupTeleportUI: () => {},
        _embedSwf: () => {},
        _attachRegionGlue: () => {},
        _configureBridge: vi.fn(),
    });
    // The Flash adapter probes `document.getElementById` — a stub that answers the bridge from `bridgeAt` (ms) on.
    const t0 = Date.now();
    globalThis.document = {
        getElementById: () => (bridgeAt !== null && Date.now() - t0 >= bridgeAt ? { wireCheck() {}, configure() {} } : null),
        createElement: () => { throw new Error('no DOM'); },
    };
    return { panel, statuses, logs };
}

/** Run until the flow has built its adapter (its bridge wait is then in flight). */
async function untilWaiting(panel) {
    for (let i = 0; i < 50 && !panel.adapter; i += 1) await vi.advanceTimersByTimeAsync(0);
    expect(panel.adapter).toBeTruthy();
    return panel.adapter;
}

/** What `_teardownForReinit` + a replacement init leave: a different adapter, the replacement's status. */
function replace(panel) {
    panel.adapter = { replacement: true };
    panel._setStatus(START);
}

describe('the Flash init flow, torn down mid-wait, touches nothing of the replacement', () => {
    let hadDocument;
    let previousDocument;
    beforeEach(() => {
        hadDocument = 'document' in globalThis;
        previousDocument = globalThis.document;
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
        if (hadDocument) globalThis.document = previousDocument;
        else delete globalThis.document;
    });

    it('control: left alone, the wait times out and says so (bridge timeout)', async () => {
        const { panel, statuses, logs } = barePanel();
        const flow = panel._initializeFlash();
        await untilWaiting(panel);
        await vi.advanceTimersByTimeAsync(16000);
        await flow;
        expect(statuses.at(-1)).toBe('bridge timeout');
        expect(logs.some((l) => /^bridge not ready: bridge did not become ready within 15000ms/.test(l))).toBe(true);
    });

    it('⛔ replaced inside the 15 s: the timeout writes NO status and NO log line', async () => {
        const { panel, statuses, logs } = barePanel();
        const flow = panel._initializeFlash();
        await untilWaiting(panel);
        await vi.advanceTimersByTimeAsync(2000);
        replace(panel);
        await vi.advanceTimersByTimeAsync(16000);
        await flow;
        expect(statuses.at(-1)).toBe(START);
        expect(logs.filter((l) => /bridge not ready/.test(l))).toEqual([]);
        expect(panel.adapter).toEqual({ replacement: true });
    });

    it('⛔ replaced before its bridge answers: no "bridge ready", no configure', async () => {
        const { panel, statuses, logs } = barePanel({ bridgeAt: 3000 });
        const flow = panel._initializeFlash();
        await untilWaiting(panel);
        replace(panel);
        await vi.advanceTimersByTimeAsync(5000);
        await flow;
        expect(statuses.at(-1)).toBe(START);
        expect(logs).not.toContain('bridge ready');
        expect(panel._configureBridge).not.toHaveBeenCalled();
    });

    it('⛔ replaced in the 1.5 s configure delay: no configure', async () => {
        const { panel, statuses } = barePanel({ bridgeAt: 0 });
        const flow = panel._initializeFlash();
        await untilWaiting(panel);
        await vi.advanceTimersByTimeAsync(200);
        expect(statuses.at(-1)).toBe('bridge ready');
        replace(panel);
        await vi.advanceTimersByTimeAsync(2000);
        await flow;
        expect(panel._configureBridge).not.toHaveBeenCalled();
    });

    it('control: NOT replaced, the bridge answers and the flow configures', async () => {
        const { panel } = barePanel({ bridgeAt: 0 });
        const flow = panel._initializeFlash();
        await untilWaiting(panel);
        await vi.advanceTimersByTimeAsync(2000);
        await flow;
        expect(panel._configureBridge).toHaveBeenCalledTimes(1);
    });
});
