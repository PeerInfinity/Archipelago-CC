/**
 * Bounce Demo game page — build-order step 6
 * (NewDocs/plans/procedural-generation/dj-metroidvania-v2.md).
 *
 * The page OWNS `window.__swfBridge.configure/pollItems` (the game
 * side of the flashSubstrate contract); the host bridge injects
 * `sendLocation` when embedded in an iframe. Standalone (opened
 * directly in a tab, window === window.parent) the dev harness plays
 * host: fake configure/pollItems drivers + logged outward calls — so
 * the page is host-naive and embedding is a swap, not a migration.
 *
 * Outward calls the game makes:
 *  - __swfBridge.sendLocation(pickupId) — pickup landed (the bridge
 *    maps pickupId -> AP location name via the region's ap_locations).
 *  - __swfBridge.sendExit(portalId, side) — portal landed. NOTE: a
 *    bridge extension; the real flash bridge doesn't implement it yet
 *    (documented embed-time work: dispatch user:regionMove).
 *
 * Auto-start: the loop runs from page load (capability start:'auto').
 */

import { createGameSession } from '../gameCore.js';
import { renderFrame } from './render.js';
import { installDevHarness } from './devBridge.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

let session = null;
let portalSides = {};   // portal id -> grid side (from params.sidePortals)
let lastItems = [];
let message = '';
let messageTimer = 0;

function setMessage(text) {
    message = text;
    messageTimer = 150;
}

// ── keyboard ────────────────────────────────────────────────────
const keys = { left: false, right: false };
const KEYMAP = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };
window.addEventListener('keydown', (e) => {
    const dir = KEYMAP[e.key];
    if (!dir) return;
    keys[dir] = true;
    if (e.key.startsWith('Arrow')) e.preventDefault();
});
window.addEventListener('keyup', (e) => {
    const dir = KEYMAP[e.key];
    if (dir) keys[dir] = false;
});

// ── game side of the __swfBridge contract ───────────────────────
const gameSide = {
    configure(config) {
        const params = config?.params ?? {};
        if (!params.bounceLevel) {
            console.warn('[bounce-game] configure without params.bounceLevel', config);
            return;
        }
        const sidePortals = params.sidePortals ?? {};
        portalSides = Object.fromEntries(
            Object.entries(sidePortals).map(([side, id]) => [id, side]));
        session = createGameSession(params.bounceLevel);
        session.setItems(lastItems);
        statusEl.textContent = `region: ${config.regionId ?? '?'} — level: `
            + `${params.bounceLevel.id} — arrows/A/D to move (when unlocked)`;
    },
    pollItems(received) {
        lastItems = Array.isArray(received) ? received : [];
        session?.setItems(lastItems);
    },
    /** Restart the current level (collected checks persist). */
    reset() {
        session?.reset();
        setMessage('level reset');
    },
};
window.__swfBridge = Object.assign(window.__swfBridge ?? {}, gameSide);

// ── standalone dev harness ──────────────────────────────────────
if (window === window.parent) {
    installDevHarness(window.__swfBridge, document.getElementById('devpanel'));
}

// ── events out ──────────────────────────────────────────────────
function handleEvent(ev) {
    const bridge = window.__swfBridge;
    if (ev.type === 'pickup') {
        setMessage(`checked: ${ev.id}`);
        bridge.sendLocation?.(ev.id);
    } else if (ev.type === 'exit') {
        const side = portalSides[ev.portalId] ?? null;
        setMessage(`exit ${ev.direction ?? '?'}${side ? ` (side ${side})` : ''}`);
        bridge.sendExit?.(ev.portalId, side);
    } else if (ev.type === 'fell') {
        setMessage('fell! back to the entrance');
    }
}

// ── fixed-timestep loop (60Hz logic, rAF render) ────────────────
const FRAME_MS = 1000 / 60;
let acc = 0;
let last = performance.now();
function frame(now) {
    acc = Math.min(acc + (now - last), 250); // clamp away tab-switch spirals
    last = now;
    while (acc >= FRAME_MS) {
        acc -= FRAME_MS;
        if (session) {
            for (const ev of session.tick({ left: keys.left, right: keys.right })) {
                handleEvent(ev);
            }
        }
        if (messageTimer > 0 && --messageTimer === 0) message = '';
    }
    if (session) renderFrame(ctx, session, { message });
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
