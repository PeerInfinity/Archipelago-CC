/**
 * flashPanel/wasmGamePage — **ONE PAIR OF READINESS PREDICATES FOR ONE
 * RECOMPILED GAME PAGE** (maze-lab arms F-b / plan §17.1 F4).
 *
 * ── ⛔⛔ WHAT THIS REPLACES: FOUR PROPERTIES, TWO QUESTIONS, TWO ANSWERS ──
 *
 * The SWFRecomp page (`wasm/seedling_bot_ap_p4d/game.html`) is booted by two
 * hosts that never agreed on when it was up:
 *
 *   the PANEL   `wasmBridgeAdapter.waitForShim` → `window.__swfBridge` exists
 *               `wasmBridgeAdapter._getFlash`   → `game.wireCheck` is a function
 *   the LAB     `watchWasm`'s first `until`     → `window.__runtimeReady`
 *               `watchWasm`'s second `until`    → `bot('botStatus') !== null`
 *
 * Four properties of ONE page, answering two questions — *"is the page's
 * runtime up?"* and *"is the game up?"* — with a different witness on each
 * side. A build that gained one of a pair before the other would boot on one
 * host and hang on the other, and neither host would be wrong.
 *
 * ── ⛓⛓⛓ THE BOOT ORDER, MEASURED — NOT READ OFF THE SOURCE ──────────────
 *
 * One boot of the p4d page on **real-GPU Windows Chrome** (`intel / gen-9`,
 * headed, via `seedling-watch-ship-win.py`), a probe polling all four
 * properties at 1 ms and on every rAF, `performance.now()` at first sight,
 * origin = probe install (just after `domcontentloaded`):
 *
 *   ORDER  PROPERTY            FIRST SEEN     registered with
 *     1    `__swfBridge`           0.3 ms     (already there — a CLASSIC script,
 *                                             before the wasm glue: `game` is {})
 *     2    `__runtimeReady`      271.5 ms     `Module.onRuntimeInitialized`,
 *                                             which also ENABLES ▶ Start
 *     3    `game.wireCheck`     2024.8 ms     with `configure`, `readState` —
 *                                             BridgeGeneric's three, one batch
 *     4    `game.botStatus`     3567.1 ms     with the other ten Bot.as verbs —
 *                                             a SECOND batch, 1,542 ms later
 *
 * ⇒ **TWO OBSERVABLE DIVERGENCES, both of them the panel's**, and both now
 * closed by the pair below:
 *
 *  1. `waitForShim` resolved at 0.3 ms, so the panel printed *"click ▶ Start
 *     in the game"* for **271 ms while the button was still `disabled`**.
 *  2. `_getFlash()` answered at `wireCheck`, so for **1,542 ms** the panel
 *     believed the game was up while `botLoadLevels`, `botLevelSet` and
 *     `botStatus` did not exist yet — a window in which the AP-placement
 *     delivery would have called `undefined`.
 *
 * ── THE TWO QUESTIONS, AND WHY EACH IS THE **LATER** WITNESS ─────────────
 *
 * `runtimeUp` (Q1) — *the page's runtime is up, and ▶ Start is pressable.*
 * `gameUp`    (Q2) — *the game is up: its callbacks are registered.*
 *
 * ⛔ Each is the CONJUNCTION of its pair, which is the "later of the two"
 * stated in a form that does not depend on the order staying what it was
 * measured to be. `botStatus` is 1,542 ms behind `wireCheck` on p4d TODAY; a
 * build that registered them the other way round would still boot identically
 * on both hosts, because both hosts are asking for both.
 *
 * ⛔ **AND NEITHER SIDE'S TIMEOUTS MOVE.** The lab's 200 ms / 180 s and the
 * panel's 30 s / 10 min are the two hosts' own answers to *"how long is it
 * reasonable to wait for a human to press a button"*, not facts about the
 * page. WHAT is waited for is shared; HOW LONG is not — the same split
 * `pollUntil.js` already draws.
 *
 * ⛔ **`watchWasm.until()` STILL DOES NOT BECOME `pollUntil`.** F-a measured
 * four differences (the leak witness in `lifetime.guard`, the instant reject on
 * retire, the swallowed predicate throw, the lab's cadence) and they are all
 * still true. This file is about WHAT the loops ask, not about the loops.
 *
 * ⛔⛔ **DEPENDENCY-FREE, AND THAT IS A PRICE, NOT AN AESTHETIC.**
 * `flashPanel/index.js`'s static closure is the shipped panel bundle;
 * `wasmBridgeAdapter.js` is in it, so whatever this file imports, every page
 * that mounts the flash panel pays for. It imports nothing, so it costs one
 * file. The LAB imports it too, and that direction (`seedlingDemo` →
 * `flashPanel`) is free — the lab page is not bundled.
 */

/** The two page-side witnesses Q1 is the later of. Named for the rows. */
export const RUNTIME_WITNESSES = Object.freeze(['__swfBridge', '__runtimeReady']);

/**
 * The two callbacks Q2 is the later of — BridgeGeneric's first and Bot.as's,
 * one per registration batch. ⛓ `botStatus` is the measured-last of the two
 * (see the table above); `wireCheck` is named as well so a build that reverses
 * the batches cannot make either host answer early.
 */
export const GAME_WITNESSES = Object.freeze(['wireCheck', 'botStatus']);

/**
 * The frame's own window, or null.
 *
 * ⛔ THE `try` IS NOT DEFENSIVE PADDING: reading `contentWindow` across origins
 * THROWS, and the page must be same-origin for any of this to work at all —
 * so a cross-origin frame is *"not up"*, not an exception out of a predicate.
 */
export function frameWindow(el) {
    try {
        return el?.contentWindow ?? null;
    } catch {
        return null;
    }
}

/** The shim object the page's classic script installs, or null. */
export function bridgeOf(win) {
    try {
        return win?.__swfBridge ?? null;
    } catch {
        return null;
    }
}

/**
 * The RAW callback surface — whatever `__registerCallback` has filled in so
 * far, `{}` included.
 *
 * ⛔ UNGATED ON PURPOSE, and it is not a weaker `gameUp`. The verb-call rule
 * (`callBot`) has to work BEFORE Q2 is satisfied, because asking the surface
 * for a verb is how a host finds out whether the verb is there yet.
 */
export function gameOf(win) {
    return bridgeOf(win)?.game ?? null;
}

/**
 * **Q1 — the page's runtime is up, and ▶ Start is pressable.**
 *
 * The later of `__swfBridge` (a classic script, ~0.3 ms) and `__runtimeReady`
 * (`Module.onRuntimeInitialized`, ~271 ms), which is the same flag that
 * `document.getElementById('btn-start').disabled = false` rides. A host that
 * prompts for Start before this is asking for a click the page will refuse.
 */
export function runtimeUp(win) {
    return Boolean(bridgeOf(win)) && win?.__runtimeReady === true;
}

/**
 * **Q2 — the game is up: its callbacks are registered.**
 *
 * @returns {object|null} the callback surface itself when both witnesses are
 *   there — so a caller that wants the object gets the object, and a caller
 *   that wants a boolean gets a truthy one. Null until then.
 */
export function gameUp(win) {
    const game = gameOf(win);
    if (!game) return null;
    for (const name of GAME_WITNESSES) {
        if (typeof game[name] !== 'function') return null;
    }
    return game;
}

/**
 * ⛓⛓⛓ **CALL A VERB ON THE GAME — THE WHOLE RULE, IN ONE PLACE**
 * (maze-lab arms F-b / plan §17.1 F2).
 *
 * It was spelled three times and the three did not agree:
 *
 *   `watchWasm.js`'s `bot()`      re-read `__swfBridge.game` on EVERY call and
 *                                 answered **null** for a missing verb
 *   `flashPanelUI.js:560`         captured `adapter._getFlash()` ONCE and
 *                                 **THREW** (`g[name] is not a function`)
 *   `seedlingRandomizerWiring.
 *   readWorld`                    each call in its own `try`/`catch`, i.e. the
 *                                 same rule a third time, as error handling
 *
 * ⛔ **THE RE-READ IS THE HALF THAT WAS A LATENT BUG.** An iframe reload
 * REPLACES the whole `__swfBridge` object (`wasmBridgeAdapter`'s header says
 * so, and `installStateHook` exists because of it) and a preset switch
 * replaces the iframe under the SAME element id — so a captured `game` is the
 * PREVIOUS game's callback table, wired to a runtime that is gone.
 *
 * ⛔ **AND `null` IS THE BETTER ANSWER FOR A MISSING VERB, MEASURED AGAINST
 * WHAT READS IT.** `seedlingLevelSetDelivery.deliver()` distinguishes a bot
 * that THROWS (*"botLoadLevels threw on chunk 1/9: …"*) from one that answers
 * something other than `ok`/`pending` (*"botLoadLevels answered null to chunk
 * 1/9, and the LAST chunk of a delivery must answer \"ok\""*). Under the
 * capture-and-throw form a build with no `botLoadLevels` produced a raw
 * TypeError text; under this rule it produces the second sentence, which names
 * the verb, the chunk and the contract. ⛓ The THROW arm is not dead — a verb
 * that exists and raises inside the game still reaches it.
 *
 * @returns {*} whatever the game returned, or `null` if the page, the shim,
 *   the callback table or the verb is not there.
 */
export function callBot(win, name, arg) {
    const game = gameOf(win);
    if (!game || typeof game[name] !== 'function') return null;
    return arg === undefined ? game[name]() : game[name](arg);
}

/**
 * `callBot` bound to a WINDOW GETTER — the form a host holds onto.
 *
 * ⛔ A GETTER, NOT A WINDOW. Binding the window would reinstate the capture
 * this file exists to remove; the getter is what makes "re-read per call" true
 * of the returned function rather than of its call sites.
 */
export function botOver(getWin) {
    return (name, arg) => callBot(getWin(), name, arg);
}
