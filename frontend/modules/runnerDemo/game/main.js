/**
 * Runner game page (bounceDemo/game/main.js is the model).
 *
 * The page OWNS `window.__swfBridge.configure/pollItems` (the game
 * side of the flashSubstrate contract); the host bridge injects
 * `sendLocation` when embedded in an iframe. Standalone (opened
 * directly in a tab, window === window.parent) the dev harness plays
 * host: fake configure/pollItems drivers + logged outward calls — so
 * the page is host-naive and embedding is a swap, not a migration.
 *
 * Outward calls the game makes:
 *  - __swfBridge.sendLocation(pickupId) — pickup touched (the bridge
 *    maps pickupId -> AP location name via the region's ap_locations).
 *  - __swfBridge.sendExit(portalId, side) — portal touched.
 *
 * Inputs (all synthesize the same held-state flags — physics.js
 * input contract):
 *  - keyboard: Space/W/↑/J jump, S/↓ drop, R reset
 *  - touch (shared touchInput.js helper): the WHOLE PANEL is the jump
 *    area — pointerdown = press edge (feeds the jump buffer), hold =
 *    variable jump, pointerup = jump cut — plus a corner DROP button;
 *    pointer-id tracked so jump+drop multi-touch is safe. Shown on
 *    coarse pointers, `?touch=1`, or a host `params.touchControls`
 *    override.
 *
 * Auto-start: the loop runs from page load (capability start:'auto').
 */

import { resolvePhysicsStamp } from '../physics.js';
import { createGameSession } from '../gameCore.js';
import { renderFrame, createJuice } from './render.js';
import { installDevHarness } from './devBridge.js';
import {
    installTouchControls, resolveTouchOverride,
} from '../../shared/touchInput.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const wrapEl = document.getElementById('gamewrap');

let session = null;
let juice = createJuice();
let portalSides = {};    // portal id -> grid side (from params.sidePortals)
let backExitSide = null; // the entrance side (the region's back exit)
// What a fall respawn ALSO does (params.fallBehavior):
//   'current'  — nothing extra: physics respawned at this entrance (default)
//   'previous' — exit to the previous region via the back exit
let fallBehavior = 'current';
let physicsProfileId = null; // from params.physics?.profile (debug surface)
let fellExitSent = false;    // one fall exit per configure (no double moves)
let lastItems = [];
let message = '';
let messageTimer = 0;
// declared before the bridge exists: configure() assigns it, and the
// standalone dev harness calls configure during module init
let frameMs = 1000 / 50; // TICK_HZ — reset by configure's profile

function setMessage(text) {
    message = text;
    messageTimer = 150;
}

// ── keyboard (held-state; the press EDGE is derived in step) ─────
const keys = { jump: false, drop: false, reset: false };
const KEYMAP = {
    Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyJ: 'jump',
    ArrowDown: 'drop', KeyS: 'drop',
    KeyR: 'reset',
};
window.addEventListener('keydown', (e) => {
    const flag = KEYMAP[e.code];
    if (!flag) return;
    keys[flag] = true;
    e.preventDefault();
});
window.addEventListener('keyup', (e) => {
    const flag = KEYMAP[e.code];
    if (flag) keys[flag] = false;
});

// ── touch (input synthesis via the shared helper) ────────────────
// Corner drop button FIRST (first hitTest match wins), then the
// whole-panel jump area.
const touchFlags = {};
const TOUCH_ZONES = [
    {
        id: 'drop', flag: 'drop', label: 'drop',
        hitTest: (nx, ny) => nx > 0.82 && ny > 0.76,
        css: { right: '2%', bottom: '3%', width: '16%', height: '21%' },
    },
    {
        id: 'jump', flag: 'jump', label: '',
        hitTest: () => true,
        css: { left: '1%', top: '1%', width: '98%', height: '98%',
               border: 'none', background: 'transparent' },
    },
];
const urlTouchOverride = resolveTouchOverride(window.location.search);
let touch = { visible: false, tracker: null, destroy() {} };
function installTouch(hostOverride) {
    touch.destroy();
    touch = installTouchControls({
        container: wrapEl,
        zones: TOUCH_ZONES,
        flags: touchFlags,
        override: hostOverride ?? urlTouchOverride,
    });
}
installTouch(null);

// ── game side of the __swfBridge contract ────────────────────────
const gameSide = {
    configure(config) {
        const params = config?.params ?? {};
        if (!params.runnerLevel) {
            console.warn('[runner-game] configure without params.runnerLevel', config);
            return;
        }
        const sidePortals = params.sidePortals ?? {};
        portalSides = Object.fromEntries(
            Object.entries(sidePortals).map(([side, id]) => [id, side]));
        backExitSide = params.backExitSide ?? null;
        fallBehavior = params.fallBehavior ?? 'current';
        fellExitSent = false;
        // Physics profile stamp ({ profile, constants } on params) —
        // a world plays under the constants its rules were derived
        // with (resolvePhysicsStamp: embedded constants win).
        const constants = resolvePhysicsStamp(params.physics);
        physicsProfileId = params.physics?.profile ?? null;
        frameMs = 1000 / constants.TICK_HZ;
        session = createGameSession(params.runnerLevel, { constants });
        juice = createJuice();
        // Pickups the host already has checked (region revisits) — by
        // their in-game ids; the bridge inverts ap_locations for us.
        session.seedCollected(config?.checkedLocations);
        session.setItems(lastItems);
        if (params.touchControls !== undefined) installTouch(!!params.touchControls);
        statusEl.textContent = `region: ${config.regionId ?? '?'} — level: `
            + `${params.runnerLevel.id} — auto-run; space to jump, s to drop, r to reset`;
    },
    pollItems(received) {
        lastItems = Array.isArray(received) ? received : [];
        session?.setItems(lastItems);
    },
    /**
     * Rule-gated portals/pickups: the bridge evaluates the region's
     * authored gate rules against live inventory and pushes per-goal
     * booleans ({ portals: {id: bool}, pickups: {id: bool} },
     * true = open). The game never sees the rules — only the booleans.
     */
    setGateStates(states) {
        session?.setGateStates(states);
    },
    /** Restart the current level (collected checks persist). */
    reset() {
        session?.reset();
        setMessage('level reset');
    },
};
window.__swfBridge = Object.assign(window.__swfBridge ?? {}, gameSide);

// Test/debug surface (NOT part of the __swfBridge contract): the
// Playwright verifications read player state and apex heights here
// instead of eyeballing pixels.
let maxYSinceMark = -Infinity;
window.__runnerMark = () => { maxYSinceMark = -Infinity; };
window.__runnerDebug = () => ({
    items: [...lastItems],
    abilities: session ? { ...session.abilities } : null,
    collected: session ? [...session.collected] : null,
    gateStates: session ? session.gateStates : null,
    levelId: session?.level?.id ?? null,
    physicsProfile: physicsProfileId,
    touchVisible: touch.visible,
    player: session ? {
        x: session.state.x,
        y: session.state.y,
        vx: session.state.vx,
        vy: session.state.vy,
        onGround: session.state.onGround,
        landedOn: session.state.landedOn,
        respawned: session.state.respawned,
    } : null,
    maxY: maxYSinceMark,
});

// ── standalone dev harness ───────────────────────────────────────
if (window === window.parent) {
    installDevHarness(window.__swfBridge, document.getElementById('devpanel'));
}

// ── events out ───────────────────────────────────────────────────
function handleEvent(ev) {
    const bridge = window.__swfBridge;
    if (ev.type === 'pickup') {
        setMessage(`checked: ${ev.id}`);
        bridge.sendLocation?.(ev.id);
    } else if (ev.type === 'lockedPickup' || ev.type === 'lockedPortal') {
        setMessage('locked — something is still missing');
    } else if (ev.type === 'exit') {
        const side = portalSides[ev.portalId] ?? ev.arrow ?? null;
        setMessage(`exit ${side ?? '?'}`);
        bridge.sendExit?.(ev.portalId, side);
    } else if (ev.type === 'respawned') {
        if (ev.cause === 'fell' && fallBehavior === 'previous'
                && backExitSide && !fellExitSent) {
            fellExitSent = true;
            setMessage('fell! back to the previous level');
            bridge.sendExit?.('__fall_back', backExitSide);
        } else {
            setMessage({
                fell: 'fell! back to the entrance',
                hazard: 'ouch! back to the entrance',
                reset: 'reset',
            }[ev.cause] ?? ev.cause);
        }
    }
}

// ── fixed-timestep loop (C.TICK_HZ logic, rAF render) ────────────
let acc = 0;
let last = performance.now();
function frame(now) {
    acc = Math.min(acc + (now - last), 250); // clamp away tab-switch spirals
    last = now;
    while (acc >= frameMs) {
        acc -= frameMs;
        if (session) {
            const prevState = session.state;
            // touch merges with (never blocks) the keyboard
            for (const ev of session.tick({
                jump: keys.jump || !!touchFlags.jump,
                drop: keys.drop || !!touchFlags.drop,
                reset: keys.reset,
            })) {
                handleEvent(ev);
            }
            juice.update(prevState, session.state, frameMs / 1000);
            maxYSinceMark = Math.max(maxYSinceMark, session.state.y);
        }
        if (messageTimer > 0 && --messageTimer === 0) message = '';
    }
    if (session) renderFrame(ctx, session, { message, juice });
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
