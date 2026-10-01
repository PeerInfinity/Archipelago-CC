/**
 * seedlingDemo/jsRuntimePage — **THE SEEDLING JS RUNTIME'S PAGE** (Seedling JS
 * runtime J1): the DOM half of `jsRuntimeCore.js`, mounted by the flash panel
 * as its game iframe when `moduleSettings.flashPanel.runtime` is `'js'`.
 *
 * It does four things and owns no game logic:
 *
 *  1. installs `window.__swfBridge` in the SHAPE of the wasm build's
 *     `swf_bridge_avm2.js` — `game` (the callback table), `queueItems`,
 *     `onStateChanged` (re-read on every report, because the host REPLACES it:
 *     `WasmBridgeAdapter.installStateHook`), `stateLog` — and sets
 *     `window.__runtimeReady`. Both of `wasmGamePage`'s questions answer at
 *     once: there is no ▶ Start, because there is no GPU or audio context to
 *     unlock (⚖ no graphics, no sound);
 *  2. reads the keyboard on its canvas (`watchManual.KEYBOARD_BINDINGS` — the
 *     watch page's MANUAL arm's bindings, one table);
 *  3. paces the model at 30 ticks a second with a requestAnimationFrame
 *     ACCUMULATOR (watchManual's "THE LOOP QUESTION": the page's clock decides
 *     WHEN a tick runs, the model decides WHAT it does). ⚠ A hidden or
 *     `display:none` frame gets no animation frames, so a timer PUMP keeps the
 *     clock going when rAF has been silent for `PUMP_AFTER_MS` — the panel's
 *     host glue (deliveries, crossings) must not stall behind a tab switch;
 *  4. paints the room in rectangles with the watch page's palette
 *     (`rectPalette.js`): tiles, object solids, teleporters, the AP items and
 *     the player's hitbox.
 *
 * `window.__seedlingJsRuntime` is the core itself — a TEST handle (the in-app
 * row reads the mounted rooms off it to plan its key presses), not part of the
 * contract the host speaks.
 */

import { createJsRuntime } from './jsRuntimeCore.js';
import { heldFromCodes, KEYBOARD_BINDINGS } from './watchManual.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { createLifetime } from './watchLifetime.js';
import {
    FLOOR_COLOUR, SOLID_COLOUR, TILE_COLOURS, objectSolidColour,
} from './rectPalette.js';

export const TICKS_PER_SECOND = 30;
const TICK_MS = 1000 / TICKS_PER_SECOND;
/** At most this many ticks per frame — a long stall is skipped, not replayed. */
const MAX_TICKS_PER_FRAME = 5;
const PUMP_AFTER_MS = 250;

const AP_ITEM_COLOUR = '#e8c040';
const TELEPORTER_COLOUR = '#3fd8ce';
const PLAYER_COLOUR = '#ffffff';

export function mountJsRuntimePage(win = window) {
    const doc = win.document;
    const canvas = doc.getElementById('game');
    const status = doc.getElementById('status');
    const ctx = canvas.getContext('2d');
    // ⛓ Every listener goes through a lifetime (`watchLifetime.test.js`'s rule
    // for every page module here); this page has one, for the document.
    const life = createLifetime('seedling-js-runtime-page');

    const bridge = {
        game: {},
        stateLog: [],
        queueItems: (items) => runtime.queueItems(items),
        onStateChanged: (name, value) => {
            win.console?.log?.('[swfBridge] stateChanged (unhandled):', name, value);
        },
    };
    const runtime = createJsRuntime({
        onStateChanged: (name, value) => {
            bridge.stateLog.push({ name, value });
            bridge.onStateChanged(name, value);
        },
        log: (msg) => win.console?.log?.(msg),
    });
    Object.assign(bridge.game, runtime.game);
    win.__swfBridge = bridge;
    win.__seedlingJsRuntime = runtime;
    win.__runtimeReady = true;

    // ── keys ──────────────────────────────────────────────────────────────
    const down = new Set();
    const onKey = (e, pressed) => {
        if (!(e.code in KEYBOARD_BINDINGS)) return;
        e.preventDefault();
        if (pressed) down.add(e.code);
        else down.delete(e.code);
    };
    life.on(doc, 'keydown', (e) => onKey(e, true));
    life.on(doc, 'keyup', (e) => onKey(e, false));
    life.on(win, 'blur', () => down.clear());

    // ── clock ─────────────────────────────────────────────────────────────
    let last = null;
    let acc = 0;
    let lastFrameAt = 0;
    function advance(now) {
        if (last === null) last = now;
        acc += Math.min(now - last, TICK_MS * MAX_TICKS_PER_FRAME);
        last = now;
        let n = 0;
        while (acc >= TICK_MS && n < MAX_TICKS_PER_FRAME) {
            runtime.tick(heldFromCodes(down));
            acc -= TICK_MS;
            n += 1;
        }
    }
    function frame(now) {
        lastFrameAt = now;
        advance(now);
        paint();
        win.requestAnimationFrame(frame);
    }
    win.requestAnimationFrame(frame);
    win.setInterval(() => {
        const now = win.performance.now();
        if (now - lastFrameAt > PUMP_AFTER_MS) advance(now);
    }, PUMP_AFTER_MS / 2);

    // ── paint ─────────────────────────────────────────────────────────────
    function paint() {
        const view = runtime.view();
        ctx.fillStyle = '#101014';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (!view) {
            status.textContent = runtime.halted
                ? `HALTED — ${runtime.halted.message.split('\n')[0]}`
                : (runtime.mounted
                    ? 'level set mounted — waiting for the host to start the game'
                    : 'Seedling JS runtime — waiting for a level set (J1 plays GENERATED rooms only)');
            return;
        }
        const { world, state, apItems, level } = view;
        const scale = Math.min(canvas.width / world.width, canvas.height / world.height);
        const r = (rect, colour, alpha = 1) => {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = colour;
            ctx.fillRect(rect.x * scale, rect.y * scale, (rect.right - rect.x) * scale, (rect.bottom - rect.y) * scale);
            ctx.globalAlpha = 1;
        };
        const solid = new Set(world.solids.map((s) => `${s.rect.x},${s.rect.y}`));
        for (const t of world.tiles) {
            r(t.rect, solid.has(`${t.rect.x},${t.rect.y}`) ? SOLID_COLOUR : (TILE_COLOURS[t.t] ?? FLOOR_COLOUR));
        }
        for (const s of world.objectSolids) r(s.rect, objectSolidColour(s), 0.85);
        for (const tp of world.teleporters) if (!tp.deactivated) r(tp.rect, TELEPORTER_COLOUR, 0.45);
        for (const p of world.pickups ?? []) r(p.rect, AP_ITEM_COLOUR, 0.5);
        for (const a of apItems) r(a.rect, AP_ITEM_COLOUR, 1);
        r(playerBoxAt(state.x, state.y), PLAYER_COLOUR, 0.95);
        const deaths = runtime.deaths.length;
        status.textContent = `level ${level} · tick ${runtime.ticks}`
            + `${deaths ? ` · deaths ${deaths}` : ''}${runtime.run?.inCeremony ? ' · (text — auto-advancing)' : ''}`;
    }

    life.on(canvas, 'mousedown', () => canvas.focus());
    return runtime;
}
