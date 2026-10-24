/**
 * gameInput (seedling-pipeline T2b, U2a + F3) — driven over fake DOM objects
 * built on node's own `EventTarget`, so the listeners that run are the real
 * ones the module installs.
 */
import { describe, expect, it } from 'vitest';

import { createHeldKeyRelease, focusGameCanvas, gameCanvasOf } from './gameInput.js';

class FakeKeyboardEvent extends Event {
    constructor(type, init = {}) {
        super(type, init);
        this.key = init.key; this.code = init.code; this.keyCode = init.keyCode ?? 0;
    }
}

/** A frame whose document holds one canvas; `activeElement` follows focus(). */
function fakeFrame({ hidden = false, canvasRefuses = false, noCanvas = false } = {}) {
    const win = new EventTarget();
    win.KeyboardEvent = FakeKeyboardEvent;
    const doc = { activeElement: null, defaultView: win };
    const canvas = new EventTarget();
    canvas.ownerDocument = doc;
    canvas.focus = () => { if (!canvasRefuses) doc.activeElement = canvas; };
    // Events dispatched on the canvas reach the window's capture listeners.
    const origDispatch = canvas.dispatchEvent.bind(canvas);
    canvas.dispatchEvent = (ev) => {
        Object.defineProperty(ev, 'target', { value: canvas, configurable: true });
        win.dispatchEvent(ev);
        canvas.seen = [...(canvas.seen ?? []), `${ev.type}:${ev.code}:${ev.keyCode}`];
        return origDispatch(ev);
    };
    doc.querySelector = (sel) => (sel === 'canvas' && !noCanvas ? canvas : null);
    const frame = {
        contentDocument: doc,
        focused: false,
        focus() { this.focused = true; },
        getClientRects: () => (hidden ? [] : [{}]),
    };
    /** A key event as the browser delivers it: target set, dispatched at the window (capture). */
    const key = (type, code, keyCode, target = canvas) => {
        const ev = new FakeKeyboardEvent(type, { key: code, code, keyCode });
        Object.defineProperty(ev, 'target', { value: target, configurable: true });
        win.dispatchEvent(ev);
    };
    return { frame, canvas, win, doc, key };
}

describe('focusGameCanvas (U2a)', () => {
    it('focuses the frame AND the canvas inside it — the canvas is what hears keys', () => {
        const { frame, canvas, doc } = fakeFrame();
        expect(focusGameCanvas(frame)).toEqual({ focused: true, why: 'canvas focused' });
        expect(frame.focused).toBe(true);
        expect(doc.activeElement).toBe(canvas);
    });

    it('refuses a HIDDEN frame by name (its tab is not the active one) and touches nothing', () => {
        const { frame, doc } = fakeFrame({ hidden: true });
        const r = focusGameCanvas(frame);
        expect(r.focused).toBe(false);
        expect(r.why).toMatch(/hidden/);
        expect(frame.focused).toBe(false);
        expect(doc.activeElement).toBe(null);
    });

    it('names a missing frame and a missing canvas', () => {
        expect(focusGameCanvas(null).why).toBe('no game frame');
        expect(focusGameCanvas(fakeFrame({ noCanvas: true }).frame).why).toMatch(/no canvas/);
        expect(gameCanvasOf({ get contentDocument() { throw new Error('cross-origin'); } })).toBe(null);
    });

    it('reports a canvas that refused focus', () => {
        expect(focusGameCanvas(fakeFrame({ canvasRefuses: true }).frame))
            .toEqual({ focused: false, why: 'the canvas refused focus' });
    });
});

describe('createHeldKeyRelease (F3)', () => {
    function rig() {
        const f = fakeFrame();
        const log = [];
        const k = createHeldKeyRelease({ getFrame: () => f.frame, onRelease: (codes, why) => log.push({ codes, why }) });
        expect(k.install()).toBe(true);
        return { ...f, k, log };
    }

    it('a key the GAME heard go down, and never heard come up, is released INTO the canvas on blur', () => {
        const { canvas, key, k, log } = rig();
        key('keydown', 'ArrowUp', 38);
        expect(k.held()).toEqual(['ArrowUp']);
        canvas.dispatchEvent(new Event('blur'));
        expect(canvas.seen).toContain('keyup:ArrowUp:38');
        expect(k.held()).toEqual([]);
        expect(log).toEqual([{ codes: ['ArrowUp'], why: 'the game lost focus' }]);
    });

    it('…and on the frame WINDOW\'s blur (focus left for the host page)', () => {
        const { win, canvas, key, k } = rig();
        key('keydown', 'ArrowRight', 39);
        win.dispatchEvent(new Event('blur'));
        expect(canvas.seen).toContain('keyup:ArrowRight:39');
        expect(k.held()).toEqual([]);
    });

    it('…and when the host says so (the park), with the reason passed through', () => {
        const { canvas, key, k, log } = rig();
        key('keydown', 'ArrowLeft', 37);
        expect(k.release('the flash substrate parked')).toEqual(['ArrowLeft']);
        expect(canvas.seen).toContain('keyup:ArrowLeft:37');
        expect(log.at(-1).why).toBe('the flash substrate parked');
    });

    it('a key that came up normally is NOT released again', () => {
        const { canvas, key, k } = rig();
        key('keydown', 'ArrowDown', 40);
        key('keyup', 'ArrowDown', 40);
        expect(k.release('parked')).toEqual([]);
        expect(canvas.seen ?? []).toEqual([]);
    });

    it('a keyup that reached the frame\'s BODY, not the canvas, is FORWARDED to the canvas (the game did not hear it)', () => {
        const { canvas, key, k, log } = rig();
        key('keydown', 'ArrowUp', 38);
        key('keydown', 'ArrowLeft', 37);
        key('keyup', 'ArrowUp', 38, { tagName: 'BODY' });
        expect(canvas.seen).toEqual(['keyup:ArrowUp:38']);
        expect(k.held()).toEqual(['ArrowLeft']);
        expect(log).toEqual([{ codes: ['ArrowUp'], why: 'its keyup landed outside the game canvas' }]);
    });

    it('a keydown the game did NOT hear (target not the canvas) is not tracked', () => {
        const { key, k } = rig();
        key('keydown', 'ArrowUp', 38, { tagName: 'BODY' });
        expect(k.held()).toEqual([]);
    });

    it('uninstall stops tracking', () => {
        const { key, k } = rig();
        k.uninstall();
        key('keydown', 'ArrowUp', 38);
        expect(k.held()).toEqual([]);
    });
});
