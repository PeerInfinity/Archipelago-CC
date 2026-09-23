/**
 * flashPanel/gameInput — **THE HOST'S TWO DUTIES TO THE GAME'S KEYBOARD**
 * (seedling-pipeline T2b, U2a + F3).
 *
 * The wasm page's runtime hears keys through Emscripten callbacks on its own
 * canvas, so a key reaches the game ONLY while the page's focus is inside the
 * iframe AND on that canvas. Two things the host does to that focus broke play
 * (measured on the box, plan §15.0):
 *
 *   U2a — ACTIVATION DOES NOT FOCUS THE GAME. After ▶ Start the iframe's focus
 *     sits on its BODY; after a tab activation (the overlay's button, or the
 *     automatic one) the page's focus is on the button or the body. The game
 *     hears nothing until a person clicks the canvas. Focusing the IFRAME
 *     element alone does not help (measured: keys still dead); focusing the
 *     canvas inside it, from the host, does — the browser moves the page's
 *     focus into the frame with it.
 *
 *   F3 — A KEY HELD ACROSS A DOOR NEVER COMES UP. A door fires mid-hold, the
 *     Maze Room tab comes forward, and the key's `keyup` lands on the host page
 *     (or on the frame's BODY), never on the canvas. The game keeps the key
 *     down: after the return the Seedling player walks on with no key pressed
 *     (measured: y 271 → 229.7 across a host-side keyup, then STOPPED at 221.9
 *     by one synthetic `keyup` on the canvas). There is no bot verb for it and
 *     the game registers no blur callback, so the release is a `keyup` event
 *     with the key's own `key`/`code`/`keyCode`, dispatched on the canvas.
 *
 * ⛓ WHAT IS "HELD" is what the GAME heard: a `keydown` whose target was the
 * canvas, until a `keyup` for the same `code` reached the frame. It is released
 * when focus leaves the canvas (its `blur`, the frame window's `blur`) and when
 * the host says so (the flash substrate PARKED). Pure over injected DOM objects:
 * no `document` global is read here, so node rows can drive it with fakes.
 */

/** Capture listeners, spelled as an options object on BOTH add and remove. */
const CAPTURE = Object.freeze({ capture: true });

/** The game's input surface inside the frame: its first canvas. */
export function gameCanvasOf(frameEl) {
    let doc = null;
    try { doc = frameEl?.contentDocument ?? null; } catch { doc = null; }
    return doc?.querySelector?.('canvas') ?? null;
}

/**
 * Give the game real keyboard focus, the way a click on its canvas does.
 * @returns {{focused: boolean, why: string}}
 */
export function focusGameCanvas(frameEl) {
    if (!frameEl) return { focused: false, why: 'no game frame' };
    if (typeof frameEl.getClientRects === 'function' && frameEl.getClientRects().length === 0) {
        return { focused: false, why: 'the game frame is hidden (its tab is not the active one)' };
    }
    const canvas = gameCanvasOf(frameEl);
    if (!canvas) return { focused: false, why: 'no canvas in the game frame yet' };
    try { frameEl.focus?.({ preventScroll: true }); } catch { /* best effort; the canvas focus decides */ }
    try { canvas.focus({ preventScroll: true }); } catch { /* reported below */ }
    const doc = canvas.ownerDocument;
    const focused = doc?.activeElement === canvas;
    return { focused, why: focused ? 'canvas focused' : 'the canvas refused focus' };
}

/**
 * Track the keys the game is holding and release them into it on demand.
 * `getFrame()` is read on every use, so a remounted iframe is followed.
 */
export function createHeldKeyRelease({ getFrame, onRelease } = {}) {
    /** code -> {key, code, keyCode} */
    const held = new Map();
    let installed = null;

    /** Release every held key, or only `codes`, into the canvas. */
    function release(reason, codes = null) {
        const released = [...held.values()].filter((k) => !codes || codes.includes(k.code));
        if (released.length === 0) return [];
        const frame = getFrame?.();
        const canvas = gameCanvasOf(frame);
        const win = canvas?.ownerDocument?.defaultView ?? null;
        const Ctor = win?.KeyboardEvent;
        for (const k of released) held.delete(k.code);
        if (!canvas || typeof Ctor !== 'function') return [];
        for (const k of released) {
            canvas.dispatchEvent(new Ctor('keyup', {
                key: k.key, code: k.code, keyCode: k.keyCode, which: k.keyCode, bubbles: true, cancelable: true,
            }));
        }
        onRelease?.(released.map((k) => k.code), reason);
        return released.map((k) => k.code);
    }

    function install() {
        const frame = getFrame?.();
        const canvas = gameCanvasOf(frame);
        const win = canvas?.ownerDocument?.defaultView ?? null;
        if (!canvas || !win) return false;
        if (installed?.canvas === canvas) return true;
        uninstall();
        const onDown = (e) => {
            if (e.target !== canvas || !e.code) return;
            held.set(e.code, { key: e.key, code: e.code, keyCode: e.keyCode });
        };
        const onUp = (e) => {
            if (!e.code || !held.has(e.code)) return;
            if (e.target === canvas) { held.delete(e.code); return; }
            // ⛔ THE KEYUP REACHED THE FRAME BUT NOT THE CANVAS (measured at W0:
            // after a door fired, the frame's focus sat on its BODY), so the game
            // never heard it. Forward it. Our own dispatch comes back through
            // here with the canvas as its target, and the key is already gone.
            release('its keyup landed outside the game canvas', [e.code]);
        };
        const onBlur = () => { release('the game lost focus'); };
        win.addEventListener('keydown', onDown, CAPTURE);
        win.addEventListener('keyup', onUp, CAPTURE);
        win.addEventListener('blur', onBlur);
        canvas.addEventListener('blur', onBlur);
        installed = { canvas, win, onDown, onUp, onBlur };
        return true;
    }

    function uninstall() {
        if (!installed) return;
        const { canvas, win, onDown, onUp, onBlur } = installed;
        try {
            win.removeEventListener('keydown', onDown, CAPTURE);
            win.removeEventListener('keyup', onUp, CAPTURE);
            win.removeEventListener('blur', onBlur);
            canvas.removeEventListener('blur', onBlur);
        } catch { /* the frame may be gone */ }
        installed = null;
        held.clear();
    }

    return { install, uninstall, release, held: () => [...held.keys()] };
}
