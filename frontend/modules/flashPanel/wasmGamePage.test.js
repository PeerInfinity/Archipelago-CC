/**
 * The two readiness questions the recompiled game page answers, and the four
 * properties that used to answer them two different ways (maze-lab arms F-b /
 * plan §17.1 F4).
 *
 * ⛔⛔ **THE SUBJECT OF THESE ROWS IS A MEASUREMENT, NOT A PREFERENCE.** One
 * boot of `wasm/seedling_bot_ap_p4d/game.html` on real-GPU Windows Chrome, a
 * probe at 1 ms + every rAF, `performance.now()` at first sight:
 *
 *     __swfBridge      0.3 ms     game.wireCheck   2024.8 ms
 *     __runtimeReady 271.5 ms     game.botStatus   3567.1 ms
 *
 * Both gaps were live divergences between the two hosts, and each row below
 * that names a number names one of them.
 */
import { describe, expect, it } from 'vitest';

import {
    botOver, bridgeOf, callBot, frameWindow, gameOf, gameUp, GAME_WITNESSES,
    runtimeUp, RUNTIME_WITNESSES,
} from './wasmGamePage.js';

/** The page as it is at each of the four moments, in order. */
const AT_SHIM = { __swfBridge: { game: {} }, __runtimeReady: false };
const AT_RUNTIME = { __swfBridge: { game: {} }, __runtimeReady: true };
const AT_WIRECHECK = {
    __swfBridge: { game: { wireCheck() {}, configure() {}, readState() {} } },
    __runtimeReady: true,
};
const AT_BOTSTATUS = {
    __swfBridge: {
        game: {
            wireCheck() {}, configure() {}, readState() {},
            botStatus() {}, botLoadLevels() {}, botLevelSet() {},
        },
    },
    __runtimeReady: true,
};

describe('the witnesses are NAMED, so a row can say which one is missing', () => {
    it('Q1 is the two page-side properties; Q2 is one callback per registration batch', () => {
        expect(RUNTIME_WITNESSES).toEqual(['__swfBridge', '__runtimeReady']);
        expect(GAME_WITNESSES).toEqual(['wireCheck', 'botStatus']);
    });

    it('and they are FROZEN — a host may read the list, never edit it', () => {
        expect(Object.isFrozen(RUNTIME_WITNESSES)).toBe(true);
        expect(Object.isFrozen(GAME_WITNESSES)).toBe(true);
    });
});

describe('runtimeUp (Q1) — the page\'s runtime is up and ▶ Start is pressable', () => {
    /**
     * ⛔ **271.5 ms.** `__swfBridge` is a CLASSIC script that runs before the
     * wasm glue with `game` still `{}`; `__runtimeReady` is set in
     * `Module.onRuntimeInitialized`, the same callback that does
     * `btn-start.disabled = false`. A host that prompts for ▶ Start on the
     * shim alone is asking for a click the page will refuse.
     */
    it('⛔ the SHIM ALONE is not the runtime — this is the 271 ms', () => {
        expect(bridgeOf(AT_SHIM)).not.toBeNull();
        expect(runtimeUp(AT_SHIM)).toBe(false);
    });

    it('answers TRUE only once __runtimeReady has flipped', () => {
        expect(runtimeUp(AT_RUNTIME)).toBe(true);
        expect(runtimeUp(AT_WIRECHECK)).toBe(true);
    });

    /** ⛔ The flag WITHOUT the shim is not a page this host can talk to. */
    it('⛔ and __runtimeReady alone is not enough either — it is the LATER of two, not the only one', () => {
        expect(runtimeUp({ __runtimeReady: true })).toBe(false);
    });

    it('a missing window is "not up", never a throw', () => {
        expect(runtimeUp(null)).toBe(false);
        expect(runtimeUp(undefined)).toBe(false);
        expect(runtimeUp({})).toBe(false);
    });

    it('a TRUTHY-but-not-true __runtimeReady is not the flag the page sets', () => {
        expect(runtimeUp({ __swfBridge: {}, __runtimeReady: 1 })).toBe(false);
        expect(runtimeUp({ __swfBridge: {}, __runtimeReady: 'yes' })).toBe(false);
    });
});

describe('gameUp (Q2) — the game is up: its callbacks are registered', () => {
    /**
     * ⛔⛔ **1,542 ms, AND IT IS THE ONE THAT BIT.** `wireCheck` arrives with
     * BridgeGeneric's three; `botStatus` with Bot.as's eleven, a second and a
     * half later. The panel answered on the first batch, so for that window
     * `_getFlash()` handed out a `game` with no `botLoadLevels` on it — the
     * exact surface the AP-placement delivery calls.
     */
    it('⛔ BridgeGeneric\'s batch alone is NOT the game being up — this is the 1,542 ms', () => {
        expect(gameOf(AT_WIRECHECK)).not.toBeNull();
        expect(typeof gameOf(AT_WIRECHECK).wireCheck).toBe('function');
        expect(gameUp(AT_WIRECHECK)).toBeNull();
    });

    /**
     * ⛓ The conjunction is the "LATER of the two" written so it does not
     * depend on the order staying what it was measured to be: a build that
     * registered `botStatus` first would still boot identically on both hosts.
     */
    it('⛔ and neither is Bot.as\'s batch alone — the order is measured, not assumed', () => {
        const only = { __swfBridge: { game: { botStatus() {} } }, __runtimeReady: true };
        expect(gameUp(only)).toBeNull();
    });

    it('answers with the callback SURFACE ITSELF once both batches have landed', () => {
        expect(gameUp(AT_BOTSTATUS)).toBe(AT_BOTSTATUS.__swfBridge.game);
    });

    it('an EMPTY game object is the shim\'s starting state, not a game', () => {
        expect(gameOf(AT_RUNTIME)).toEqual({});
        expect(gameUp(AT_RUNTIME)).toBeNull();
        expect(gameUp(AT_SHIM)).toBeNull();
    });

    it('a non-function of the right NAME does not count — `__registerCallback` installs functions', () => {
        const fake = {
            __swfBridge: { game: { wireCheck: true, botStatus: 'ready' } },
            __runtimeReady: true,
        };
        expect(gameUp(fake)).toBeNull();
    });

    it('a missing window is "not up", never a throw', () => {
        expect(gameUp(null)).toBeNull();
        expect(gameOf(null)).toBeNull();
        expect(bridgeOf(null)).toBeNull();
    });
});

describe('frameWindow — the walk that is re-read, never captured', () => {
    it('hands back the frame\'s own window', () => {
        const win = { __swfBridge: {} };
        expect(frameWindow({ contentWindow: win })).toBe(win);
    });

    it('a missing element is null, not a throw', () => {
        expect(frameWindow(null)).toBeNull();
        expect(frameWindow(undefined)).toBeNull();
        expect(frameWindow({})).toBeNull();
    });

    /**
     * ⛔ A CROSS-ORIGIN FRAME IS "NOT UP", NOT AN EXCEPTION. Reading
     * `contentWindow` across origins throws, and every caller here is a
     * PREDICATE inside a poll loop — one that threw would take the loop with
     * it (or, in the lab's `until`, be swallowed and read as "not yet"
     * forever).
     */
    it('⛔ a cross-origin frame refuses by returning null, not by throwing', () => {
        const el = { get contentWindow() { throw new Error('cross-origin'); } };
        expect(frameWindow(el)).toBeNull();
        expect(() => frameWindow(el)).not.toThrow();
    });

    /**
     * ⛓ THE REASON THE WALK IS A FUNCTION AND NOT A CAPTURE: a preset switch
     * replaces the iframe under the SAME element id, so the second call must
     * see the second game.
     */
    it('⛓ re-reading the SAME element after a reload sees the NEW window', () => {
        const el = { contentWindow: { __swfBridge: { game: {} }, __runtimeReady: true } };
        expect(runtimeUp(frameWindow(el))).toBe(true);
        el.contentWindow = { __swfBridge: { game: {} }, __runtimeReady: false };
        expect(runtimeUp(frameWindow(el))).toBe(false);
    });
});

/**
 * ⛓⛓ **THE VERB-CALL RULE** (maze-lab arms F-b / plan §17.1 F2). It was
 * spelled three times — the lab re-read and answered null, the panel captured
 * once and threw, and `readWorld` restated it as a `try`/`catch` per call.
 */
describe('callBot — one rule: re-read per call, null for a missing verb', () => {
    const pageWith = (game) => ({ __swfBridge: { game }, __runtimeReady: true });

    it('calls the verb and hands back what the game returned', () => {
        const win = pageWith({ botStatus: () => '{"tick":166}' });
        expect(callBot(win, 'botStatus')).toBe('{"tick":166}');
    });

    it('passes ONE argument, and passes NONE when none was given', () => {
        const seen = [];
        const win = pageWith({ botLoadLevels: (...a) => { seen.push(a); return 'ok'; } });
        expect(callBot(win, 'botLoadLevels', '{"chunk":1}')).toBe('ok');
        callBot(win, 'botLoadLevels');
        expect(seen).toEqual([['{"chunk":1}'], []]);
    });

    /**
     * ⛔ `undefined` IS THE ONLY "NO ARGUMENT". A caller that means to send
     * null must be able to: `botLoadLevels(null)` is a call with an argument.
     */
    it('⛔ a null argument is an ARGUMENT — only `undefined` means "no argument"', () => {
        const seen = [];
        const win = pageWith({ v: (...a) => { seen.push(a.length); return 'ok'; } });
        callBot(win, 'v', null);
        callBot(win, 'v', undefined);
        expect(seen).toEqual([1, 0]);
    });

    /**
     * ⛔ THE ANSWER THE DELIVERY READS. `seedlingLevelSetDelivery` turns this
     * null into *"botLoadLevels answered null to chunk 1/1…"*; the capture-and-
     * throw form produced a raw TypeError instead.
     */
    it('⛔ answers NULL for a verb this build does not have — never a TypeError', () => {
        const win = pageWith({ wireCheck() {} });
        expect(callBot(win, 'botLoadLevels', '{}')).toBeNull();
        expect(() => callBot(win, 'botLoadLevels', '{}')).not.toThrow();
    });

    it('⛓ but a verb that EXISTS and raises inside the game still throws — that arm is not dead', () => {
        const win = pageWith({ botStart: () => { throw new Error('arena died'); } });
        expect(() => callBot(win, 'botStart')).toThrow('arena died');
    });

    it('a page, shim or callback table that is not there is null, not a throw', () => {
        expect(callBot(null, 'botStatus')).toBeNull();
        expect(callBot({}, 'botStatus')).toBeNull();
        expect(callBot({ __swfBridge: {} }, 'botStatus')).toBeNull();
        expect(callBot({ __swfBridge: { game: {} } }, 'botStatus')).toBeNull();
    });

    it('a NON-function of the right name is not a verb', () => {
        expect(callBot(pageWith({ botStatus: '{"tick":1}' }), 'botStatus')).toBeNull();
    });
});

describe('botOver — the re-read is the point', () => {
    /**
     * ⛔⛔ **THE MUTANT'S ROW.** An iframe reload replaces the whole
     * `__swfBridge` object, and a preset switch replaces the iframe under the
     * SAME element id. A `bot` that captured the callback table would go on
     * calling the PREVIOUS game's — wired to a runtime that is gone.
     */
    it('⛔ a bot built BEFORE a reload reaches the NEW game after it', () => {
        let win = { __swfBridge: { game: { botStatus: () => 'first' } }, __runtimeReady: true };
        const bot = botOver(() => win);
        expect(bot('botStatus')).toBe('first');
        win = { __swfBridge: { game: { botStatus: () => 'second' } }, __runtimeReady: true };
        expect(bot('botStatus')).toBe('second');
    });

    it('⛓ and a bot built before the game has ANY callbacks answers null, then answers', () => {
        let win = { __swfBridge: { game: {} }, __runtimeReady: true };
        const bot = botOver(() => win);
        expect(bot('botStatus')).toBeNull();
        win = { __swfBridge: { game: { botStatus: () => 'up' } }, __runtimeReady: true };
        expect(bot('botStatus')).toBe('up');
    });

    it('⛓ a frame that has gone away answers null rather than throwing', () => {
        const bot = botOver(() => null);
        expect(bot('botStatus')).toBeNull();
    });
});
