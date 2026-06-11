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
import { createBotDriver } from '../botDriver.js';
import { renderFrame } from './render.js';
import { installDevHarness } from './devBridge.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

let session = null;
let portalSides = {};   // portal id -> grid side (from params.sidePortals)
let backExitSide = null; // the entrance side (the region's back exit)
// What falling off the level bottom does (params.fallBehavior):
//   'current'  — respawn at this level's entrance (default)
//   'previous' — exit to the previous region via the back exit
//   'start'    — reserved (return to the starting region; v2)
// Routing never depends on this: every non-start region carries a
// real back portal in its geometry.
let fallBehavior = 'current';
let fellExitSent = false; // one fall exit per configure (no double moves)
let lastItems = [];
let message = '';
let messageTimer = 0;

// Playback-bot driver (botDriver.js). Engaged via the optional
// __swfBridge.botWalkTo / botStop contract methods — the host bridge
// translates AP location/exit names to game-local goal ids before
// calling in. The driver synthesizes per-frame inputs that merge with
// (and never block) real keyboard input.
const botDriver = createBotDriver();

// gateStates getter for the driver's route planning: an OPEN
// non-target portal en route would exit the region mid-leg, so the
// driver avoids its host platform when an alternative exists.
function isPortalOpen(id) {
    return session ? session.gateStates.portals[id] !== false : true;
}

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
        backExitSide = params.backExitSide ?? null;
        fallBehavior = params.fallBehavior ?? 'current';
        fellExitSent = false;
        // Goal ids are region-local: a target from the previous region
        // is meaningless here. The host bridge re-sends botWalkTo for
        // this region (it holds the pending AP-name target) right
        // after configure.
        botDriver.clearTarget();
        session = createGameSession(params.bounceLevel);
        // Pickups the host already has checked (region revisits) — by
        // their in-game ids; the bridge inverts ap_locations for us.
        session.seedCollected(config?.checkedLocations);
        session.setItems(lastItems);
        // Gate states start open (the session default). NOT carried
        // across configure like lastItems: ids are region-local, and
        // the bridge pushes this region's fresh states (when it has
        // gate_rules) in the same task as configure — no frame runs
        // in between.
        statusEl.textContent = `region: ${config.regionId ?? '?'} — level: `
            + `${params.bounceLevel.id} — arrows/A/D to move (when unlocked)`;
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
    /**
     * Playback bot: steer toward a game-local goal
     * ({ kind: 'pickup' | 'portal', id }). The driver re-plans on
     * every landing, so a mid-flight call engages cleanly.
     */
    botWalkTo(goal) {
        botDriver.setTarget(goal);
        if (goal?.id) setMessage(`bot: heading to ${goal.id}`);
    },
    /** Playback bot: release synthesized inputs (keyboard untouched). */
    botStop() {
        botDriver.clearTarget();
    },
};
window.__swfBridge = Object.assign(window.__swfBridge ?? {}, gameSide);

// Test/debug surface (NOT part of the __swfBridge contract):
// verify-bounce-embed.mjs reads this to assert that host-granted items
// actually reached the game (the bridge pollItems path), not just the
// host inventory.
window.__bounceDebug = () => ({
    items: [...lastItems],
    abilities: session ? { ...session.abilities } : null,
    collected: session ? [...session.collected] : null,
    gateStates: session ? session.gateStates : null,
    levelId: session?.level?.id ?? null,
    backExitSide,
    fallBehavior,
    botStatus: botDriver.getStatus(),
});

// ── standalone dev harness ──────────────────────────────────────
if (window === window.parent) {
    installDevHarness(window.__swfBridge, document.getElementById('devpanel'));
}

// ── events out ──────────────────────────────────────────────────
function handleEvent(ev) {
    const bridge = window.__swfBridge;
    const botTarget = botDriver.getStatus().target;
    if (ev.type === 'pickup') {
        setMessage(`checked: ${ev.id}`);
        if (botTarget?.kind === 'pickup' && botTarget.id === ev.id) {
            botDriver.clearTarget(); // arrived — next walkTo comes from the bot
        }
        bridge.sendLocation?.(ev.id);
    } else if (ev.type === 'lockedPickup' || ev.type === 'lockedPortal') {
        setMessage('locked — something is still missing');
    } else if (ev.type === 'exit') {
        const side = portalSides[ev.portalId] ?? null;
        setMessage(`exit ${ev.direction ?? '?'}${side ? ` (side ${side})` : ''}`);
        if (botTarget?.kind === 'portal' && botTarget.id === ev.portalId) {
            botDriver.clearTarget(); // region unloads; bridge re-targets after configure
        }
        bridge.sendExit?.(ev.portalId, side);
    } else if (ev.type === 'fell') {
        botDriver.notifyFell();
        // gameCore auto-respawns at the entrance either way; in
        // 'previous' mode we additionally exit via the back side (one
        // shot per configure so a fall during the host round-trip
        // can't move twice).
        if (fallBehavior === 'previous' && backExitSide && !fellExitSent) {
            fellExitSent = true;
            setMessage('fell! back to the previous level');
            bridge.sendExit?.('__fall_back', backExitSide);
        } else {
            setMessage('fell! back to the entrance');
        }
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
            // Bot input merges with (never blocks) the keyboard. The
            // driver sees the PREVIOUS tick's state, so it observes
            // each landing exactly once — its re-plan trigger.
            const bot = botDriver.nextInput(
                session.state, session.level, session.abilities, { isPortalOpen });
            for (const ev of session.tick({
                left: keys.left || !!bot?.left,
                right: keys.right || !!bot?.right,
            })) {
                handleEvent(ev);
            }
        }
        if (messageTimer > 0 && --messageTimer === 0) message = '';
    }
    if (session) renderFrame(ctx, session, { message });
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
