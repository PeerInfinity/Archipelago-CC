/**
 * The panel's one readiness loop, and the three waits that were it three times
 * (maze-lab arms F-a / plan §17.1 F3).
 *
 * ⛔⛔ **THESE ROWS DID NOT EXIST BEFORE F-a, AND THAT IS THE FINDING.** The
 * brief's proof for this rung was *"drop the `cancelled` check ⇒ the adapter's
 * detach row reds"*. There WAS no detach row: `git grep -n "_cancelled\|
 * waitForShim"` at `8a1eb6b1a` reaches `wasmBridgeAdapter.js` and
 * `flashPanelUI.js` and NOTHING under a `.test.js`. The cancellation that
 * exists so a preset switch cannot resolve a stale wait against the NEW game
 * page — the reason the check was written — was asserted by nobody, on any
 * transport. The mutant would have been vacuously green.
 *
 * ⛓ So the loop gets its rows here, and the three CALL SITES get theirs: a
 * shared owner is only worth having if the thing it owns is asserted once.
 * `_getFlash`/`_getWin` are stubbed on real adapter instances — the classes
 * construct in node (the adapter guards on `typeof window`), and the DOM lookup
 * is the one line these rows are not about.
 *
 * ⛓ F-b moved the WASM adapter's stub point one level out, from `_getBridge()`
 * to `_getWin()`: the readiness pair is now `wasmGamePage.runtimeUp`/`gameUp`,
 * which read `__runtimeReady` off the frame's WINDOW as well as the shim off
 * it. A row that stubbed the bridge could not express *"the shim is there and
 * the runtime is not"*, which is the 271 ms this arc measured.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { FlashBridgeAdapter } from './flashBridgeAdapter.js';
import { pollUntil } from './pollUntil.js';
import { WasmBridgeAdapter } from './wasmBridgeAdapter.js';

const CONFIG = JSON.parse(readFileSync(
    fileURLToPath(new URL('./games/seedling.json', import.meta.url)), 'utf8'));

const adapterOpts = () => ({
    config: CONFIG,
    flashObjectId: `test-${Math.random()}`,
    stateManager: { getLatestStateSnapshot: () => ({ inventory: {} }) },
    dispatcher: { publish: () => {} },
    eventBus: { subscribe: () => () => {} },
    log: () => {},
});

/** What the promise did, without a `try` at every call site. */
const settle = async (p) => p.then((value) => ({ value }), (error) => ({ message: error.message }));

describe('pollUntil — the loop itself', () => {
    it('resolves with the predicate\'s VALUE, so a caller that wants the element gets it', async () => {
        const el = { wireCheck() {} };
        await expect(pollUntil(() => el, { maxMs: 1000, intervalMs: 1 })).resolves.toBe(el);
    });

    it('keeps probing across intervals until the predicate turns truthy', async () => {
        let probes = 0;
        const out = await pollUntil(() => (++probes >= 3 ? 'ready' : null), { maxMs: 5000, intervalMs: 1 });
        expect(out).toBe('ready');
        expect(probes).toBe(3);
    });

    it('throws the CALLER\'S timeout message — the deadline wording is not the loop\'s', async () => {
        expect(await settle(pollUntil(() => null, {
            maxMs: 5, intervalMs: 1, timeoutMessage: 'the pigeon did not arrive within 5ms',
        }))).toEqual({ message: 'the pigeon did not arrive within 5ms' });
    });

    it('has a deadline of ZERO meaning "do not even probe once"', async () => {
        let probes = 0;
        expect(await settle(pollUntil(() => { probes += 1; return 'x'; }, { maxMs: 0 })))
            .toEqual({ message: 'poll did not succeed within 0ms' });
        expect(probes).toBe(0);
    });

    /**
     * ⛔ THE ORDER INSIDE AN ITERATION IS THE CONTRACT: cancellation is asked
     * BEFORE the predicate. A replacement iframe reuses the same element id, so
     * a detached loop that probed first could resolve against the NEW page —
     * which is the whole reason `_cancelled` was written.
     */
    it('asks `cancelled` BEFORE the predicate, and refuses without probing', async () => {
        let probes = 0;
        expect(await settle(pollUntil(() => { probes += 1; return 'the new page'; }, {
            maxMs: 5000, intervalMs: 1, cancelled: () => true,
        }))).toEqual({ message: 'poll cancelled' });
        expect(probes).toBe(0);
    });

    it('refuses at the FIRST iteration after cancellation, mid-wait', async () => {
        let cancelled = false;
        let probes = 0;
        const p = pollUntil(() => { probes += 1; return null; }, {
            maxMs: 5000, intervalMs: 1, cancelled: () => cancelled,
        });
        await new Promise((r) => setTimeout(r, 10));
        cancelled = true;
        expect(await settle(p)).toEqual({ message: 'poll cancelled' });
        const probesAtRefusal = probes;
        await new Promise((r) => setTimeout(r, 10));
        expect(probes).toBe(probesAtRefusal); // and it stopped probing
    });

    it('without a `cancelled` it simply cannot be aborted — the Flash transport never could', async () => {
        expect(await settle(pollUntil(() => null, { maxMs: 5, intervalMs: 1 })))
            .toEqual({ message: 'poll did not succeed within 5ms' });
    });

    it('lets a throw from the predicate OUT — swallowing one is `watchWasm.until`\'s choice, not this loop\'s', async () => {
        expect(await settle(pollUntil(() => { throw new Error('the frame went away'); }, { maxMs: 5000 })))
            .toEqual({ message: 'the frame went away' });
    });
});

describe('the three call sites keep their own wording and their own cancellation', () => {
    it('FlashBridgeAdapter.waitForBridge resolves with the object, and only once wireCheck is a FUNCTION', async () => {
        const a = new FlashBridgeAdapter(adapterOpts());
        let el = { wireCheck: 'not a function yet' };
        a._getFlash = () => el;
        const p = a.waitForBridge(5000);
        await new Promise((r) => setTimeout(r, 10));
        const ready = { wireCheck() {} };
        el = ready;
        await expect(p).resolves.toBe(ready);
    });

    it('…and its refusal names the timeout it was given', async () => {
        const a = new FlashBridgeAdapter(adapterOpts());
        a._getFlash = () => null;
        expect(await settle(a.waitForBridge(5)))
            .toEqual({ message: 'bridge did not become ready within 5ms' });
    });

    /** ⛓ The Flash transport has no `_cancelled`, and detaching does not invent one. */
    it('…and detach() does NOT abort it — that is the transport difference, asserted', async () => {
        const a = new FlashBridgeAdapter(adapterOpts());
        a._getFlash = () => null;
        const p = a.waitForBridge(60);
        a.detach();
        expect(await settle(p))
            .toEqual({ message: 'bridge did not become ready within 60ms' });
    });

    it('WasmBridgeAdapter.waitForRuntime returns TRUE (not the shim) once the RUNTIME is up', async () => {
        const a = new WasmBridgeAdapter(adapterOpts());
        let win = null;
        a._getWin = () => win;
        const p = a.waitForRuntime(5000);
        await new Promise((r) => setTimeout(r, 10));
        win = { __swfBridge: { game: {} }, __runtimeReady: true };
        await expect(p).resolves.toBe(true);
    });

    /**
     * ⛔⛔ **THE 271 ms** (maze-lab arms F-b / plan §17.1 F4). `__swfBridge` is
     * installed by a CLASSIC script before the wasm glue — measured at 0.3 ms
     * on the live p4d page, against 271.5 ms for `__runtimeReady`, which is
     * also what enables the ▶ Start button. This wait used to resolve on the
     * shim, so the panel printed *"click ▶ Start in the game"* over a button
     * that was still `disabled`.
     */
    it('⛔ and the SHIM ALONE is not enough — ▶ Start is not pressable yet', async () => {
        const a = new WasmBridgeAdapter(adapterOpts());
        a._getWin = () => ({ __swfBridge: { game: {} }, __runtimeReady: false });
        expect(await settle(a.waitForRuntime(5))).toEqual({
            message: "the wasm page's runtime did not come up within 5ms "
                + '(__swfBridge + __runtimeReady)',
        });
    });

    it('…and names the RUNTIME in its refusal, with both witnesses', async () => {
        const a = new WasmBridgeAdapter(adapterOpts());
        a._getWin = () => null;
        expect(await settle(a.waitForRuntime(5))).toEqual({
            message: "the wasm page's runtime did not come up within 5ms "
                + '(__swfBridge + __runtimeReady)',
        });
    });

    /**
     * ⛔⛔ THE ROW THE ARC WAS MISSING. `flashPanelUI.js:451` waits 30 s for the
     * runtime and `:457` waits TEN MINUTES for the user's ▶ Start; a preset
     * switch in between must abort both, or a stale loop resolves against the
     * replacement iframe — same element id, different game.
     */
    it('detach() ABORTS an in-flight runtime wait', async () => {
        const a = new WasmBridgeAdapter(adapterOpts());
        a._getWin = () => null;
        const p = a.waitForRuntime(30000);
        await new Promise((r) => setTimeout(r, 10));
        a.detach();
        expect(await settle(p)).toEqual({ message: 'adapter detached' });
    });

    it('detach() ABORTS an in-flight bridge wait — the ten-minute one', async () => {
        const a = new WasmBridgeAdapter(adapterOpts());
        // runtime up, game callbacks not registered
        a._getWin = () => ({ __swfBridge: { game: {} }, __runtimeReady: true });
        const p = a.waitForBridge(600000);
        await new Promise((r) => setTimeout(r, 10));
        a.detach();
        expect(await settle(p)).toEqual({ message: 'adapter detached' });
    });

    it('WasmBridgeAdapter.waitForBridge resolves with the GAME callback surface', async () => {
        const a = new WasmBridgeAdapter(adapterOpts());
        const game = { wireCheck() {}, botStatus() {} };
        let win = { __swfBridge: { game: { wireCheck: undefined } }, __runtimeReady: true };
        a._getWin = () => win;
        const p = a.waitForBridge(5000);
        await new Promise((r) => setTimeout(r, 10));
        win = { __swfBridge: { game }, __runtimeReady: true };
        await expect(p).resolves.toBe(game);
    });

    /**
     * ⛔⛔ **THE 1,542 ms, ON THE PANEL'S SIDE OF IT.** `wireCheck` registers
     * with BridgeGeneric's three; `botStatus` with Bot.as's eleven, a second
     * and a half later (measured on the live p4d page). This wait used to
     * resolve on `wireCheck` alone, so `_getFlash()` handed the AP-placement
     * delivery a `game` with no `botLoadLevels` on it. The lab has always
     * waited for `botStatus`; the shared `gameUp` is why they now agree.
     */
    it('⛔ and BridgeGeneric\'s wireCheck ALONE is not the game being up', async () => {
        const a = new WasmBridgeAdapter(adapterOpts());
        a._getWin = () => ({
            __swfBridge: { game: { wireCheck() {}, configure() {}, readState() {} } },
            __runtimeReady: true,
        });
        expect(a._getFlash()).toBeNull();
        expect(await settle(a.waitForBridge(5)))
            .toEqual({ message: 'bridge did not become ready within 5ms' });
    });

    it('…and its refusal is the inherited wording, on the wasm transport too', async () => {
        const a = new WasmBridgeAdapter(adapterOpts());
        a._getWin = () => null;
        expect(await settle(a.waitForBridge(5)))
            .toEqual({ message: 'bridge did not become ready within 5ms' });
    });
});
