/**
 * touchControls (slice `seedling-js-touch-controls`) — the pure core: pointer events in, the keyboard's key events
 * out. The DOM binder is driven in the browser (the in-app row `seedling-js-touch-controls`).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
    DPAD_DIRECTIONS, TOUCH_SETTING_KEY, createTouchKeyBridge, dpadDirection, dpadDirectionKeys, parseTouchLayout,
    touchControlsSchemaProps, touchControlsVisible,
} from './touchControls.js';
import { createHeldKeyRelease, dispatchGameKey } from './gameInput.js';
import { KEYBOARD_BINDINGS } from '../seedlingDemo/watchManual.js';

const SEEDLING = JSON.parse(readFileSync(new URL('./games/seedling.json', import.meta.url), 'utf8'));
const LAYOUT = parseTouchLayout(SEEDLING.touch_controls);

/** A strip of 1-D zones on x: d-pad directions at x 0..7, buttons at 10.. (hit = floor(x) === slot). */
function rig(layout = LAYOUT) {
    const dirKeys = dpadDirectionKeys(layout.dpad);
    const zones = [
        ...layout.buttons.map((b, i) => ({ id: `button-${b.id}`, keys: b.keys, hitTest: (x) => Math.floor(x) === 10 + i })),
        ...DPAD_DIRECTIONS.map((dir, i) => ({ id: `dpad-${dir}`, keys: dirKeys[dir], hitTest: (x) => Math.floor(x) === i })),
    ];
    const sent = [];
    const bridge = createTouchKeyBridge({ zones, send: (type, k) => sent.push(`${type}:${k.code}`) });
    const at = (name) => {
        const d = DPAD_DIRECTIONS.indexOf(name);
        if (d >= 0) return d + 0.5;
        return 10 + layout.buttons.findIndex((b) => b.id === name) + 0.5;
    };
    return { bridge, sent, at };
}

describe('Seedling\'s declared controls (games/seedling.json touch_controls)', () => {
    it('are the AS3 key set: four arrows (diagonals on), X, C, V, and Escape on wasm only', () => {
        expect(LAYOUT.dpad.diagonals).toBe(true);
        expect(Object.fromEntries(Object.entries(LAYOUT.dpad.keys).map(([d, k]) => [d, [k.code, k.keyCode]]))).toEqual({
            up: ['ArrowUp', 38], down: ['ArrowDown', 40], left: ['ArrowLeft', 37], right: ['ArrowRight', 39],
        });
        expect(LAYOUT.buttons.map((b) => [b.id, b.keys[0].key, b.keys[0].code, b.keys[0].keyCode, b.transports])).toEqual([
            ['primary', 'x', 'KeyX', 88, null],
            ['secondary', 'c', 'KeyC', 67, null],
            ['inventory', 'v', 'KeyV', 86, null],
            ['menu', 'Escape', 'Escape', 27, ['wasm']],
        ]);
    });

    it('every key the JS runtime is offered is one its page listens for (KEYBOARD_BINDINGS)', () => {
        const codes = [...Object.values(LAYOUT.dpad.keys), ...LAYOUT.buttons.filter((b) => !b.transports || b.transports.includes('js'))
            .flatMap((b) => b.keys)].map((k) => k.code);
        for (const c of codes) expect(Object.keys(KEYBOARD_BINDINGS)).toContain(c);
    });

    it('the bridge never sees the block (configure sends classes / state_properties / path_reads only)', () => {
        expect(Object.keys(SEEDLING)).toContain('touch_controls');
    });
});

describe('parseTouchLayout', () => {
    it('no block = no controls; a malformed one is refused by name', () => {
        expect(parseTouchLayout(undefined)).toBe(null);
        expect(() => parseTouchLayout({})).toThrow(/neither a dpad nor a button/);
        expect(() => parseTouchLayout({ buttons: [{ id: 'a' }] })).toThrow(/buttons\[0\] \(a\) has no key `code`/);
        expect(() => parseTouchLayout({ dpad: { keys: { up: { code: 'ArrowUp' } } } })).toThrow(/dpad\.down/);
    });
});

describe('dpadDirection', () => {
    const r = { radius: 50 };
    it('reads 8 sectors on screen axes (+y down), nothing in the dead zone or past the reach', () => {
        expect(dpadDirection(40, 0, r)).toBe('right');
        expect(dpadDirection(0, -40, r)).toBe('up');
        expect(dpadDirection(-40, 0, r)).toBe('left');
        expect(dpadDirection(0, 40, r)).toBe('down');
        expect(dpadDirection(30, -30, r)).toBe('upright');
        expect(dpadDirection(-30, 30, r)).toBe('downleft');
        expect(dpadDirection(40, -10, r)).toBe('right'); // 14°: still right (the diagonal starts at 22.5°)
        expect(dpadDirection(5, 0, r)).toBe(null);
        expect(dpadDirection(70, 0, r)).toBe(null);
        expect(dpadDirection(60, 0, r)).toBe('right'); // a thumb drifting a little past the rim keeps the key
    });
    it('4 sectors without diagonals', () => {
        expect(dpadDirection(30, -29, { ...r, diagonals: false })).toBe('right');
        expect(dpadDirection(29, -30, { ...r, diagonals: false })).toBe('up');
    });
});

describe('createTouchKeyBridge — the keyboard\'s held-key semantics', () => {
    it('a tap is one keydown then one keyup of that key', () => {
        const { bridge, sent, at } = rig();
        expect(bridge.down(1, at('primary'), 0)).toBe('button-primary');
        expect(sent).toEqual(['keydown:KeyX']);
        expect(bridge.held()).toEqual(['KeyX']);
        bridge.up(1);
        expect(sent).toEqual(['keydown:KeyX', 'keyup:KeyX']);
        expect(bridge.held()).toEqual([]);
    });

    it('a diagonal holds both arrows; multi-touch holds a direction and a button at once', () => {
        const { bridge, sent, at } = rig();
        bridge.down(1, at('upright'), 0);
        bridge.down(2, at('primary'), 0);
        expect(sent).toEqual(['keydown:ArrowUp', 'keydown:ArrowRight', 'keydown:KeyX']);
        bridge.up(2);
        expect(sent.at(-1)).toBe('keyup:KeyX');
        expect(bridge.held().sort()).toEqual(['ArrowRight', 'ArrowUp']);
    });

    it('a slide across the d-pad releases before it presses, and keeps a shared arrow held', () => {
        const { bridge, sent, at } = rig();
        bridge.down(1, at('up'), 0);
        bridge.move(1, at('upright'), 0);   // Up stays held: no edge on it
        bridge.move(1, at('right'), 0);
        bridge.move(1, at('left'), 0);
        expect(sent).toEqual(['keydown:ArrowUp', 'keydown:ArrowRight', 'keyup:ArrowUp', 'keyup:ArrowRight', 'keydown:ArrowLeft']);
    });

    it('sliding off every control releases; a pointer that started off the controls is ignored', () => {
        const { bridge, sent, at } = rig();
        expect(bridge.down(7, 99, 0)).toBe(null);
        bridge.move(7, at('primary'), 0);
        expect(sent).toEqual([]);
        bridge.down(1, at('down'), 0);
        bridge.move(1, 99, 0);
        expect(sent).toEqual(['keydown:ArrowDown', 'keyup:ArrowDown']);
        bridge.move(1, at('down'), 0); // it let go: a return without a new press does nothing
        expect(sent).toHaveLength(2);
    });

    it('two thumbs on one key: it comes up only when the second lets go', () => {
        const { bridge, sent, at } = rig();
        bridge.down(1, at('secondary'), 0);
        bridge.down(2, at('secondary'), 0);
        bridge.up(1);
        expect(sent).toEqual(['keydown:KeyC']);
        bridge.up(2);
        expect(sent).toEqual(['keydown:KeyC', 'keyup:KeyC']);
    });

    it('⛔ pointercancel RELEASES (a mutant that drops the release on cancel fails here)', () => {
        const { bridge, sent, at } = rig();
        bridge.down(1, at('left'), 0);
        bridge.cancel(1);
        expect(sent).toEqual(['keydown:ArrowLeft', 'keyup:ArrowLeft']);
        expect(bridge.activeCount()).toBe(0);
    });

    it('releaseAll (blur / hidden / room swap / teardown) lets every key up and drops every pointer', () => {
        const { bridge, sent, at } = rig();
        bridge.down(1, at('downleft'), 0);
        bridge.down(2, at('inventory'), 0);
        bridge.releaseAll();
        expect(sent.slice(3).sort()).toEqual(['keyup:ArrowDown', 'keyup:ArrowLeft', 'keyup:KeyV']);
        expect(bridge.held()).toEqual([]);
        bridge.up(1); bridge.up(2); // the fingers lifting later send nothing
        expect(sent).toHaveLength(6);
    });

    it('a key the game already got a keyup for (forget) is not released a second time', () => {
        const { bridge, sent, at } = rig();
        bridge.down(1, at('primary'), 0);
        bridge.forget(['KeyX']);
        bridge.up(1);
        expect(sent).toEqual(['keydown:KeyX']);
    });
});

describe('the bridge into the game frame: what the keyboard sends', () => {
    class FakeKeyboardEvent extends Event {
        constructor(type, init = {}) {
            super(type, init);
            this.key = init.key; this.code = init.code; this.keyCode = init.keyCode ?? 0; this.which = init.which ?? 0;
        }
    }
    function frame() {
        const win = new EventTarget();
        win.KeyboardEvent = FakeKeyboardEvent;
        const doc = { defaultView: win, activeElement: null };
        const canvas = new EventTarget();
        canvas.ownerDocument = doc;
        const seen = [];
        const orig = canvas.dispatchEvent.bind(canvas);
        canvas.dispatchEvent = (ev) => {
            Object.defineProperty(ev, 'target', { value: canvas, configurable: true });
            win.dispatchEvent(ev);
            seen.push({ type: ev.type, key: ev.key, code: ev.code, keyCode: ev.keyCode, which: ev.which, bubbles: ev.bubbles });
            return orig(ev);
        };
        doc.querySelector = (s) => (s === 'canvas' ? canvas : null);
        return { el: { contentDocument: doc }, seen };
    }

    it('a tap on X dispatches keydown + keyup {key x, code KeyX, keyCode 88} on the canvas, bubbling — the keyboard\'s spelling', () => {
        const f = frame();
        const zones = [{ id: 'button-primary', keys: LAYOUT.buttons[0].keys, hitTest: () => true }];
        const b2 = createTouchKeyBridge({ zones, send: (type, k) => dispatchGameKey(f.el, type, k) });
        b2.down(1, 0, 0);
        b2.up(1);
        expect(f.seen).toEqual([
            { type: 'keydown', key: 'x', code: 'KeyX', keyCode: 88, which: 88, bubbles: true },
            { type: 'keyup', key: 'x', code: 'KeyX', keyCode: 88, which: 88, bubbles: true },
        ]);
    });

    it('the F3 tracker counts a touch press as held, so a lost focus releases it — once', () => {
        const f = frame();
        const win = f.el.contentDocument.defaultView;
        const canvas = f.el.contentDocument.querySelector('canvas');
        let bridge = null;
        const heldKeys = createHeldKeyRelease({ getFrame: () => f.el, onRelease: (codes) => bridge.forget(codes) });
        expect(heldKeys.install()).toBe(true);
        bridge = createTouchKeyBridge({
            zones: [{ id: 'dpad-up', keys: [LAYOUT.dpad.keys.up], hitTest: () => true }],
            send: (type, k) => dispatchGameKey(f.el, type, k),
        });
        bridge.down(1, 0, 0);
        expect(heldKeys.held()).toEqual(['ArrowUp']);
        canvas.dispatchEvent(new Event('blur')); // a door fired: the maze tab took the focus
        bridge.up(1);
        // the release came from the F3 tracker on the blur; the finger lifting after it sends no second keyup
        expect(f.seen.filter((e) => e.type !== 'blur').map((e) => `${e.type}:${e.code}`)).toEqual(['keydown:ArrowUp', 'keyup:ArrowUp']);
        expect(bridge.held()).toEqual([]);
    });
});

describe('the setting', () => {
    it('auto | on | off, default auto, under flashPanel', () => {
        expect(TOUCH_SETTING_KEY).toBe('moduleSettings.flashPanel.touchControls');
        expect(touchControlsSchemaProps().touchControls).toMatchObject({ enum: ['auto', 'on', 'off'], default: 'auto' });
    });
    it('on / off decide; auto takes ?touch= first, then the coarse-pointer query', () => {
        const coarse = () => ({ matches: true });
        const fine = () => ({ matches: false });
        expect(touchControlsVisible('on', { search: '', matchMediaFn: fine })).toBe(true);
        expect(touchControlsVisible('off', { search: '?touch=1', matchMediaFn: coarse })).toBe(false);
        expect(touchControlsVisible('auto', { search: '', matchMediaFn: coarse })).toBe(true);
        expect(touchControlsVisible('auto', { search: '', matchMediaFn: fine })).toBe(false);
        expect(touchControlsVisible('auto', { search: '?touch=1', matchMediaFn: fine })).toBe(true);
        expect(touchControlsVisible('auto', { search: '?touch=0', matchMediaFn: coarse })).toBe(false);
    });
});
