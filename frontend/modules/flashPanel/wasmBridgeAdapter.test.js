/**
 * `WasmBridgeAdapter`'s side of the one game page (maze-lab arms F-b / plan
 * §17.1 F2, F4).
 *
 * ⛔ THE WAIT LOOPS ARE NOT HERE — they are in `pollUntil.test.js`, with the
 * loop they share and the two other call sites. What is asserted HERE is the
 * adapter's own reading of the page: the window walk it re-reads, the gate
 * `_getFlash()` answers on, and the verb call the panel now hands to whoever
 * needs a bot.
 *
 * ⛓ `_getWin()` is stubbed rather than a DOM built: the adapter's `document.
 * getElementById(this.flashObjectId)` is the one line these rows are not about,
 * and `wasmGamePage.test.js` drives `frameWindow` on its own.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { WasmBridgeAdapter } from './wasmBridgeAdapter.js';

const CONFIG = JSON.parse(readFileSync(
    fileURLToPath(new URL('./games/seedling.json', import.meta.url)), 'utf8'));

const adapterFor = (getWin) => {
    const a = new WasmBridgeAdapter({
        config: CONFIG,
        flashObjectId: `test-${Math.random()}`,
        stateManager: { getLatestStateSnapshot: () => ({ inventory: {} }) },
        dispatcher: { publish: () => {} },
        eventBus: { subscribe: () => () => {} },
        log: () => {},
    });
    a._getWin = getWin;
    return a;
};

/** The page once both registration batches have landed. */
const bootedWith = (game) => ({ __swfBridge: { game }, __runtimeReady: true });
const BOOTED = bootedWith({ wireCheck() {}, botStatus() {}, botLoadLevels: () => 'ok' });

describe('adapter.bot — the panel\'s verb call, re-read per call', () => {
    /**
     * ⛔⛔ **THE ROW THE CAPTURE-ONCE FORM REDS.** `flashPanelUI.js` used to do
     * `const g = adapter._getFlash()` once, at the top of the AP-placement
     * load, and index `g` for every step after it. An iframe reload REPLACES
     * `__swfBridge` (which is why `installStateHook` exists) and a preset
     * switch replaces the iframe under the SAME element id — so `g` is the
     * PREVIOUS game's callback table, wired to a runtime that is gone.
     */
    it('⛔ swap __swfBridge between two calls and the SECOND reaches the NEW game', () => {
        let win = bootedWith({ wireCheck() {}, botStatus: () => 'first' });
        const a = adapterFor(() => win);
        expect(a.bot('botStatus')).toBe('first');
        win = bootedWith({ wireCheck() {}, botStatus: () => 'second' });
        expect(a.bot('botStatus')).toBe('second');
    });

    it('answers NULL for a verb this build does not have — the delivery NAMES that', () => {
        const a = adapterFor(() => bootedWith({ wireCheck() {}, botStatus() {} }));
        expect(a.bot('botLoadLevels', '{"chunk":1}')).toBeNull();
    });

    it('passes the one argument through, and passes none when none was given', () => {
        const seen = [];
        const a = adapterFor(() => bootedWith({
            wireCheck() {}, botStatus() {}, botLoadLevels: (...x) => { seen.push(x); return 'ok'; },
        }));
        expect(a.bot('botLoadLevels', '{"chunk":1}')).toBe('ok');
        a.bot('botLoadLevels');
        expect(seen).toEqual([['{"chunk":1}'], []]);
    });

    it('a frame that has gone away is null, never a throw', () => {
        const a = adapterFor(() => null);
        expect(a.bot('botStatus')).toBeNull();
    });

    /**
     * ⛓ THE BOT IS NOT GATED ON Q2, AND THAT IS DELIBERATE: asking the surface
     * for a verb is HOW a host finds out whether the verb is there yet, and
     * the lab's `start` stage does exactly that.
     */
    it('⛓ works before the game is "up" — an ungated surface is how Q2 gets answered', () => {
        const a = adapterFor(() => bootedWith({ wireCheck() {}, botStatus: () => 'early' }));
        expect(a._getFlash()).not.toBeNull();
        const b = adapterFor(() => bootedWith({ wireCheck() {} }));
        expect(b._getFlash()).toBeNull();
        expect(b.bot('wireCheck')).not.toBeNull();
    });
});

describe('the window walk and the two gates', () => {
    it('_getBridge is the shim, ungated — installStateHook and the push tick need it early', () => {
        const a = adapterFor(() => ({ __swfBridge: { game: {} }, __runtimeReady: false }));
        expect(a._getBridge()).not.toBeNull();
        expect(a._getFlash()).toBeNull();
    });

    it('_getFlash answers with the callback SURFACE once both batches have landed', () => {
        const a = adapterFor(() => BOOTED);
        expect(a._getFlash()).toBe(BOOTED.__swfBridge.game);
    });

    /** ⛔ 1,542 ms of it, measured on the live p4d page. */
    it('⛔ and NOT on BridgeGeneric\'s batch alone', () => {
        const a = adapterFor(() => bootedWith({ wireCheck() {}, configure() {}, readState() {} }));
        expect(a._getFlash()).toBeNull();
    });

    it('installStateHook binds a STABLE hook and is idempotent across a re-run', () => {
        const win = bootedWith({ wireCheck() {}, botStatus() {} });
        const a = adapterFor(() => win);
        expect(a.installStateHook()).toBe(true);
        const first = win.__swfBridge.onStateChanged;
        expect(a.installStateHook()).toBe(true);
        expect(win.__swfBridge.onStateChanged).toBe(first);
    });

    it('…and a reload that resets the shim gets re-hooked, with the SAME hook identity', () => {
        let win = bootedWith({ wireCheck() {}, botStatus() {} });
        const a = adapterFor(() => win);
        a.installStateHook();
        const hook = win.__swfBridge.onStateChanged;
        win = bootedWith({ wireCheck() {}, botStatus() {} });
        expect(a.installStateHook()).toBe(true);
        expect(win.__swfBridge.onStateChanged).toBe(hook);
    });

    it('a missing frame refuses the hook by returning false', () => {
        expect(adapterFor(() => null).installStateHook()).toBe(false);
    });
});
