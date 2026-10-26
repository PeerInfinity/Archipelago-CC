/**
 * flashPanel/touchControls — **ON-SCREEN CONTROLS FOR A FLASH-PANEL GAME ON A TOUCH DEVICE** (slice
 * `seedling-js-touch-controls`, ⚖ the user 2026-10-24/26).
 *
 * A d-pad and the game's action buttons, drawn under the game (beside it when the stage has the room), that send the
 * SAME key events the keyboard sends: a press is a `keydown` with the key's own `key`/`code`/`keyCode`, a release is
 * its `keyup`, both dispatched on the game's canvas (`gameInput.dispatchGameKey`). So every runtime that hears the
 * keyboard through that canvas hears the controls with no change of its own — the wasm page and the JS page alike.
 *
 * ⛓ GENERIC. Nothing here knows a game: a game declares its controls in its `games/*.json` config as a
 * `touch_controls` block (`parseTouchLayout` reads it; `seedling.json` holds Seedling's), and this module draws and
 * drives whatever it declares. ⛔ No game's specifics belong in this file.
 *
 * ⛓ HELD-KEY SEMANTICS are the keyboard's: press on pointerdown, release on pointerup / pointercancel / a lost
 * capture / sliding off the control, and EVERY held key released when the controls are hidden or torn down, the page
 * is hidden, the panel is hidden or the host releases the game's keys (a room swap: `FlashPanelUI.releaseHeldKeys`).
 * A key the game already got a `keyup` for from someone else (`forget`) is not released twice — a second `keyup` is a
 * second release EDGE to a game that reads `released(...)` (Seedling's talk key does).
 *
 * The pointer core is the Runner's: `shared/touchInput.createTouchTracker`, used unchanged — a pointer id → zone
 * map where a zone's flag is held while ANY pointer holds it (two thumbs, one zone each, release only their own).
 * Visibility is `shared/touchInput.shouldShowTouchControls` over the panel's `touchControls` setting.
 *
 * Split for the node tests: `createTouchKeyBridge` (pure: pointer events in, key events out), `dpadDirection` (pure
 * geometry), `mountTouchControls` (the thin DOM binder).
 */

import { createTouchTracker, resolveTouchOverride, shouldShowTouchControls } from '../shared/touchInput.js';

export const TOUCH_SETTING_PROP = 'touchControls';
export const TOUCH_SETTING_KEY = `moduleSettings.flashPanel.${TOUCH_SETTING_PROP}`;
export const TOUCH_SETTING_VALUES = Object.freeze(['auto', 'on', 'off']);

/** The schema prop (the Runner's spelling: `auto` = a coarse pointer). */
export function touchControlsSchemaProps() {
    return {
        [TOUCH_SETTING_PROP]: {
            type: 'string',
            enum: [...TOUCH_SETTING_VALUES],
            default: 'auto',
            label: 'Touch controls',
            description: "On-screen controls (a d-pad and the game's buttons) for the games that declare them. "
                + "'auto' shows them on a touch device (a coarse pointer, or the page's `?touch=1`); 'on' / 'off' "
                + 'force them either way. They send the same keys the keyboard does. Takes effect at once.',
        },
    };
}

/**
 * Should the controls show? `on`/`off` decide; `auto` (or anything unknown) defers to the page's `?touch=` param and
 * then to the coarse-pointer media query — the Runner's order.
 */
export function touchControlsVisible(setting, { search = globalThis.location?.search ?? '', matchMediaFn } = {}) {
    const override = setting === 'on' ? true : (setting === 'off' ? false : resolveTouchOverride(search));
    return shouldShowTouchControls({ override, matchMediaFn });
}

/** The d-pad's directions, clockwise from right; a diagonal holds its two arrows. */
export const DPAD_DIRECTIONS = Object.freeze(['right', 'downright', 'down', 'downleft', 'left', 'upleft', 'up', 'upright']);
const DIAGONAL_PARTS = Object.freeze({
    downright: ['down', 'right'], downleft: ['down', 'left'], upleft: ['up', 'left'], upright: ['up', 'right'],
});

/**
 * Which direction a point on the d-pad reads, from its offset to the centre (screen axes: +y is down), or null in
 * the dead zone / outside the reach. 8 sectors of 45° with diagonals, 4 of 90° without.
 * @param {number} dx @param {number} dy offsets in px
 * @param {{radius: number, deadZone?: number, reach?: number, diagonals?: boolean}} o
 */
export function dpadDirection(dx, dy, { radius, deadZone = 0.2, reach = 1.25, diagonals = true } = {}) {
    const d = Math.hypot(dx, dy);
    if (!(radius > 0) || d < radius * deadZone || d > radius * reach) return null;
    const a = (Math.atan2(dy, dx) + 2 * Math.PI) % (2 * Math.PI); // 0 = right, π/2 = down
    if (!diagonals) return ['right', 'down', 'left', 'up'][Math.round(a / (Math.PI / 2)) % 4];
    return DPAD_DIRECTIONS[Math.round(a / (Math.PI / 4)) % 8];
}

const keySpec = (k, where) => {
    if (!k || typeof k.code !== 'string' || !k.code) throw new Error(`touch_controls: ${where} has no key \`code\``);
    return Object.freeze({ key: String(k.key ?? k.code), code: k.code, keyCode: Number(k.keyCode ?? 0) });
};

/**
 * Read a game config's `touch_controls` block into a layout, or null when the game declares none. Refuses a
 * malformed block by name (a control that silently sends nothing is worse than none).
 *
 *   { dpad: { diagonals?, keys: { up, down, left, right: {key, code, keyCode} } },
 *     buttons: [{ id, label, title?, key, code, keyCode, transports? }] }
 *
 * `transports` (optional) limits a button to the runtimes that act on its key (e.g. `["wasm"]`).
 */
export function parseTouchLayout(block) {
    if (block === undefined || block === null) return null;
    if (typeof block !== 'object') throw new Error('touch_controls: not an object');
    let dpad = null;
    if (block.dpad) {
        const keys = {};
        for (const dir of ['up', 'down', 'left', 'right']) keys[dir] = keySpec(block.dpad.keys?.[dir], `dpad.${dir}`);
        dpad = Object.freeze({ diagonals: block.dpad.diagonals !== false, keys: Object.freeze(keys) });
    }
    const buttons = (block.buttons ?? []).map((b, i) => {
        if (!b?.id) throw new Error(`touch_controls: buttons[${i}] has no id`);
        return Object.freeze({
            id: String(b.id),
            label: String(b.label ?? b.id),
            title: b.title ? String(b.title) : '',
            keys: Object.freeze([keySpec(b, `buttons[${i}] (${b.id})`)]),
            transports: Array.isArray(b.transports) ? Object.freeze(b.transports.map(String)) : null,
        });
    });
    if (!dpad && buttons.length === 0) throw new Error('touch_controls: declares neither a dpad nor a button');
    return Object.freeze({ dpad, buttons: Object.freeze(buttons) });
}

/** The keys each d-pad direction holds (a diagonal: both of its arrows). */
export function dpadDirectionKeys(dpad) {
    const out = {};
    for (const dir of DPAD_DIRECTIONS) out[dir] = (DIAGONAL_PARTS[dir] ?? [dir]).map((d) => dpad.keys[d]);
    return out;
}

/**
 * ⛓ THE PURE CORE — pointer events in, key events out. `zones` are `{id, keys: [{key, code, keyCode}], hitTest(x, y)}`
 * (first match wins: the tracker's rule); `send(type, keySpec)` delivers one `keydown`/`keyup`. A key is down while
 * ANY pointer holds a zone carrying it; every change sends releases first, then presses (a thumb sliding left → right
 * on the d-pad: `keyup Left`, then `keydown Right` — never both held at once).
 */
export function createTouchKeyBridge({ zones, send }) {
    const byId = new Map(zones.map((z) => [z.id, z]));
    const tracker = createTouchTracker(zones.map((z) => ({ id: z.id, flag: z.id, hitTest: z.hitTest })), {});
    const pointers = new Set();
    /** code -> keySpec: what the game has been sent a keydown for and no keyup yet. */
    const sent = new Map();

    const sync = () => {
        const want = new Map();
        for (const [id, on] of Object.entries(tracker.flags)) {
            if (!on) continue;
            for (const k of byId.get(id)?.keys ?? []) want.set(k.code, k);
        }
        for (const [code, k] of [...sent]) {
            if (want.has(code)) continue;
            sent.delete(code);
            send('keyup', k);
        }
        for (const [code, k] of want) {
            if (sent.has(code)) continue;
            sent.set(code, k);
            send('keydown', k);
        }
    };

    return {
        /** A pointer went down at (x, y): the zone it took, or null (it hit no control and is not tracked). */
        down(pointerId, x, y) {
            if (pointers.has(pointerId)) tracker.up(pointerId);
            const zone = tracker.down(pointerId, x, y);
            if (zone) pointers.add(pointerId); else pointers.delete(pointerId);
            sync();
            return zone ? zone.id : null;
        },
        /** A held pointer moved: it now holds the zone under it (none = released). Untracked pointers are ignored. */
        move(pointerId, x, y) {
            if (!pointers.has(pointerId)) return null;
            tracker.up(pointerId);
            const zone = tracker.down(pointerId, x, y);
            if (!zone) pointers.delete(pointerId);
            sync();
            return zone ? zone.id : null;
        },
        up(pointerId) {
            pointers.delete(pointerId);
            tracker.up(pointerId);
            sync();
        },
        cancel(pointerId) {
            pointers.delete(pointerId);
            tracker.cancel(pointerId);
            sync();
        },
        /** Drop every pointer and release every key (hidden, torn down, the host released the game's keys). */
        releaseAll() {
            for (const id of [...pointers]) tracker.cancel(id);
            pointers.clear();
            sync();
        },
        /**
         * The game already got these keys' `keyup` from someone else (the F3 release): stop counting them as sent,
         * so nothing sends a second one. A finger still on the control presses again on its next move.
         */
        forget(codes) {
            for (const c of codes ?? []) sent.delete(c);
        },
        /** Which zones are held now (for the pressed look). */
        heldZones() {
            return Object.entries(tracker.flags).filter(([, on]) => on).map(([id]) => id);
        },
        /** The codes the game has been sent a keydown for and no keyup. */
        held() {
            return [...sent.keys()];
        },
        activeCount: () => pointers.size,
    };
}

const STRIP_CSS = 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 4px;'
    + 'box-sizing:border-box;width:100%;touch-action:none;user-select:none;-webkit-user-select:none;'
    + '-webkit-touch-callout:none;flex-shrink:0;';
const PAD_CSS = 'position:relative;flex:0 0 auto;border-radius:50%;background:rgba(255,255,255,0.06);'
    + 'border:1px solid rgba(255,255,255,0.18);pointer-events:auto;';
const BUTTON_CSS = 'flex:0 0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;'
    + 'background:rgba(233,69,96,0.22);border:1px solid rgba(233,69,96,0.6);color:#f0d0d6;'
    + 'font:bold 16px ui-monospace,monospace;pointer-events:auto;';
const ARROWS = Object.freeze({ up: '▲', down: '▼', left: '◀', right: '▶' });

/**
 * ⛓ THE DOM BINDER. Builds the controls into `doc` (not attached: the caller places `element`), binds the pointer
 * events on it, and returns `{element, bridge, setButtons(transport), setPlacement(mode, geometry), releaseAll,
 * destroy}`. `send(type, keySpec)` delivers a key. The d-pad and the buttons are the only things that take pointers
 * (`pointer-events: none` elsewhere), so in the beside-the-game placement a tap on the game still reaches it.
 */
export function mountTouchControls({ doc, layout, send, size = 132 } = {}) {
    const win = doc.defaultView;
    const root = doc.createElement('div');
    root.className = 'flash-touch-controls';
    root.style.cssText = STRIP_CSS + 'pointer-events:none;';

    const left = doc.createElement('div');
    left.className = 'flash-touch-left';
    left.style.cssText = 'display:flex;align-items:center;pointer-events:none;';
    const right = doc.createElement('div');
    right.className = 'flash-touch-right';
    right.style.cssText = 'display:flex;flex-wrap:wrap-reverse;align-items:center;justify-content:flex-end;gap:10px;'
        + 'pointer-events:none;max-width:60%;';
    root.append(left, right);

    const zones = [];
    const zoneEls = new Map();
    let pad = null;
    if (layout.dpad) {
        pad = doc.createElement('div');
        pad.className = 'flash-touch-dpad';
        pad.style.cssText = PAD_CSS + `width:${size}px;height:${size}px;`;
        for (const [dir, glyph] of Object.entries(ARROWS)) {
            const a = doc.createElement('div');
            a.className = `flash-touch-dpad-${dir}`;
            const pos = { up: 'top:4%;left:50%;transform:translateX(-50%);', down: 'bottom:4%;left:50%;transform:translateX(-50%);',
                left: 'left:6%;top:50%;transform:translateY(-50%);', right: 'right:6%;top:50%;transform:translateY(-50%);' }[dir];
            a.style.cssText = `position:absolute;${pos}color:rgba(255,255,255,0.55);font-size:${Math.round(size / 6)}px;pointer-events:none;`;
            a.textContent = glyph;
            pad.append(a);
            zoneEls.set(dir, a);
        }
        left.append(pad);
        const dirKeys = dpadDirectionKeys(layout.dpad);
        const hit = (x, y) => {
            const r = pad.getBoundingClientRect();
            return dpadDirection(x - (r.left + r.width / 2), y - (r.top + r.height / 2),
                { radius: r.width / 2, diagonals: layout.dpad.diagonals });
        };
        for (const dir of DPAD_DIRECTIONS) {
            if (!layout.dpad.diagonals && DIAGONAL_PARTS[dir]) continue;
            zones.push({ id: `dpad-${dir}`, keys: dirKeys[dir], hitTest: (x, y) => hit(x, y) === dir });
        }
    }
    const buttonEls = new Map();
    for (const b of layout.buttons) {
        const el = doc.createElement('div');
        el.className = `flash-touch-button flash-touch-button-${b.id}`;
        el.dataset.button = b.id;
        el.textContent = b.label;
        if (b.title) el.title = b.title;
        const d = Math.round(size * 0.44);
        el.style.cssText = BUTTON_CSS + `width:${d}px;height:${d}px;`;
        right.append(el);
        buttonEls.set(b.id, el);
        // a little slack around the circle: a thumb lands off-centre
        zones.push({
            id: `button-${b.id}`, keys: b.keys,
            hitTest: (x, y) => {
                if (el.style.display === 'none') return false;
                const r = el.getBoundingClientRect();
                const s = r.width * 0.12;
                return x >= r.left - s && x <= r.right + s && y >= r.top - s && y <= r.bottom + s;
            },
        });
    }
    // ⚠ Buttons BEFORE the d-pad: its reach (1.25 × its radius) must not take a press meant for a button.
    zones.sort((a, b) => (a.id.startsWith('button-') ? 0 : 1) - (b.id.startsWith('button-') ? 0 : 1));

    const bridge = createTouchKeyBridge({ zones, send });
    const paint = () => {
        const held = new Set(bridge.heldZones());
        const dirs = new Set();
        for (const id of held) {
            if (!id.startsWith('dpad-')) continue;
            const dir = id.slice(5);
            for (const p of DIAGONAL_PARTS[dir] ?? [dir]) dirs.add(p);
        }
        for (const [dir, el] of zoneEls) el.style.color = dirs.has(dir) ? '#fff' : 'rgba(255,255,255,0.55)';
        for (const [id, el] of buttonEls) el.style.background = held.has(`button-${id}`) ? 'rgba(233,69,96,0.7)' : 'rgba(233,69,96,0.22)';
        root.dataset.held = bridge.held().join(',');
    };

    const onDown = (e) => {
        if (bridge.down(e.pointerId, e.clientX, e.clientY) === null) return;
        // ⛔ preventDefault keeps the focus where it is (the game's canvas) and stops the compat mouse events.
        e.preventDefault();
        try { root.setPointerCapture?.(e.pointerId); } catch { /* a synthetic pointer: no capture to take */ }
        paint();
    };
    const onMove = (e) => {
        if (bridge.activeCount() === 0) return;
        bridge.move(e.pointerId, e.clientX, e.clientY);
        paint();
    };
    const onUp = (e) => { bridge.up(e.pointerId); paint(); };
    const onCancel = (e) => { bridge.cancel(e.pointerId); paint(); };
    const releaseAll = () => { bridge.releaseAll(); paint(); };
    const onVisibility = () => { if (doc.visibilityState === 'hidden') releaseAll(); };
    const onContext = (e) => e.preventDefault(); // a long press opens no menu
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onCancel);
    root.addEventListener('lostpointercapture', onUp);
    root.addEventListener('contextmenu', onContext);
    doc.addEventListener('visibilitychange', onVisibility);
    win?.addEventListener?.('pagehide', releaseAll);

    return {
        element: root,
        bridge,
        /** Show only the buttons that act on this transport (a `transports`-limited button is hidden elsewhere). */
        setButtons(transport) {
            for (const b of layout.buttons) {
                const on = !b.transports || b.transports.includes(transport);
                buttonEls.get(b.id).style.display = on ? 'flex' : 'none';
            }
            releaseAll();
        },
        /**
         * `below` — a strip in the flow under the game; `beside` — laid over the stage, d-pad left of the game and
         * buttons right of it (`{width, height, gameWidth}` in px: the stage, and the game centred in it).
         */
        setPlacement(mode, { width = 0, height = 0, gameWidth = 0 } = {}) {
            root.dataset.placement = mode;
            if (mode === 'beside') {
                const side = Math.max(0, (width - gameWidth) / 2);
                Object.assign(root.style, {
                    position: 'absolute', left: '0', top: '0', width: `${width}px`, height: `${height}px`, padding: '0',
                    justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '12px',
                });
                for (const el of [left, right]) {
                    Object.assign(el.style, { width: `${side}px`, justifyContent: 'center', boxSizing: 'border-box', maxWidth: '' });
                }
                right.style.flexDirection = 'column-reverse';
            } else {
                Object.assign(root.style, { position: '', left: '', top: '', width: '100%', height: '', padding: '8px 4px', alignItems: 'center' });
                for (const el of [left, right]) Object.assign(el.style, { width: '', justifyContent: '' });
                right.style.flexDirection = '';
                right.style.justifyContent = 'flex-end';
                right.style.maxWidth = '60%';
            }
        },
        releaseAll,
        destroy() {
            releaseAll();
            root.removeEventListener('pointerdown', onDown);
            root.removeEventListener('pointermove', onMove);
            root.removeEventListener('pointerup', onUp);
            root.removeEventListener('pointercancel', onCancel);
            root.removeEventListener('lostpointercapture', onUp);
            root.removeEventListener('contextmenu', onContext);
            doc.removeEventListener('visibilitychange', onVisibility);
            win?.removeEventListener?.('pagehide', releaseAll);
            root.remove();
        },
    };
}
