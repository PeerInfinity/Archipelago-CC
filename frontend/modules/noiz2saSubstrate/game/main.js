/**
 * The Noiz2sa region page — one region (a segment of a stage) played in the substrate's iframe.
 *
 * It runs the game repo's engine (`../../bulletml-dodge/src/game/`, the submodule) and its simple drawing
 * (`web/draw.js`, ⚖ simple graphics), one fixed 16 ms step per frame as the game's own page does (`web/play.js`).
 * The region rules are `../noiz2saRegion.js` (a copy of the game's `segment-run.js`): a hit restarts the region
 * from its start at once; the clear is the region's one location; after it the player may leave by an exit.
 *
 * The `__swfBridge` contract (flashSubstrate/bridge.js, injected by the host panel):
 *   game side, here:   configure({params: {start, end, seed, exits}, regionId, checkedLocations})
 *   host side, called: sendLocation('clear') on the clear; sendExit(exitName, null) to leave;
 *                      setPlayClock(running) on every state change (running = the game is stepping).
 * Opened directly in a tab (no host), the page plays the region in its URL: ?start=1:2&end=1:3&seed=1.
 *
 * The game only steps while the player is playing it: a configured region waits for a game key (or a click), and
 * the page pauses when it loses focus (⚖ no offline progress). The page reports its clock (`setPlayClock(running)`,
 * running only while `playing`), so the host's time drain charges played time only.
 * Keys: arrows/WASD move, Z fire, X slow, P pause, 1–9 leave by that exit once cleared.
 *
 * Test surface (not the contract): `window.__noiz2saDebug()` reads the state; `window.__noiz2saTest` drives
 * injected input (`play(tape, {speed})` — a run-length tape, see noiz2saRegion.js `encodeInputs`), the step
 * speed, and `leave(exitName)`.
 */
import { newGame, stepGame, input } from '../../bulletml-dodge/src/game/noiz2sa-game.js';
import { loadNoiz2saPatternsWeb } from '../../bulletml-dodge/src/game/patterns-web.js';
import { draw, FIELD_X, invalidatePanels } from '../../bulletml-dodge/web/draw.js';
import { createRegionRun, regionSpanOf, parsePosition, showSpan, decodeInputs, FPS } from '../noiz2saRegion.js';

const CLEAR_ID = 'clear';
const INTERVAL_BASE = 16; // ms per frame (noiz2sa.c)
const MAX_FRAMES_PER_TICK = 8; // a slow display frame catches up at most this many game frames
const $ = (id) => document.getElementById(id);
const canvas = $('screen'), ctx = canvas.getContext('2d');
const statusEl = $('status'), exitsEl = $('exits');
const embedded = window !== window.parent;

const app = {
    patterns: null, loadError: null,
    pending: null,          // a configure that arrived before the patterns
    regionId: null, span: null, exits: [], alreadyChecked: false,
    run: null,
    state: 'waiting',       // waiting (no region) | ready | playing | paused | cleared
    clearSent: false,
    tape: null, tapeAt: 0, injected: false, speed: 1,
    effects: [], message: '', lastTime: null, acc: 0,
};

// ── keyboard ──
const held = new Set();
const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyZ', 'KeyX', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);
const UP = ['ArrowUp', 'KeyW', 'Numpad8'], DOWN = ['ArrowDown', 'KeyS', 'Numpad2'];
const LEFT = ['ArrowLeft', 'KeyA', 'Numpad4'], RIGHT = ['ArrowRight', 'KeyD', 'Numpad6'];
const any = (ks) => ks.some((k) => held.has(k));
const DIR = [[8, 1, 2], [7, 0, 3], [6, 5, 4]]; // dir 1..8 = N, NE, E, SE, S, SW, W, NW by [dy+1][dx+1]
function keyboardInput() {
    const dx = (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0), dy = (any(DOWN) ? 1 : 0) - (any(UP) ? 1 : 0);
    return input(DIR[dy + 1][dx + 1], held.has('KeyZ'), held.has('KeyX'));
}
addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    held.add(e.code);
    if (e.repeat) return;
    if (/^Digit[1-9]$/.test(e.code)) { leaveBy(app.exits[Number(e.code.slice(5)) - 1]?.exitName); return; }
    if (e.code === 'KeyP') { if (app.state === 'playing') setState('paused'); else if (app.state === 'paused') setState('playing'); return; }
    if (GAME_KEYS.has(e.code) && (app.state === 'ready' || app.state === 'paused')) { app.injected = false; app.speed = 1; setState('playing'); }
});
addEventListener('keyup', (e) => held.delete(e.code));
addEventListener('blur', () => {
    held.clear();
    if (app.state === 'playing' && !app.injected) setState('paused');
});
canvas.addEventListener('click', () => {
    canvas.focus();
    if (app.state === 'ready' || app.state === 'paused') setState('playing');
});

function setState(s) {
    app.state = s;
    app.lastTime = null; app.acc = 0;
    invalidatePanels();
    showStatus();
    reportPlayClock();
}

// The play clock (loopSupport.playClock): the host's time drain charges a region only while its clock runs, and
// the clock runs only in `playing` — not while the region waits for its first key, is paused, or is cleared and
// waiting for the player to leave. Whoever drives the input (the keyboard, an injected tape, a bot) the report is
// the same. Reported on every state change; the bridge drops it when no region is active.
function reportPlayClock() {
    if (!app.regionId) return;
    window.__swfBridge?.setPlayClock?.(app.state === 'playing');
}

// ── the region ──
function startRegion({ regionId, span, exits, alreadyChecked }) {
    app.regionId = regionId; app.span = span; app.exits = exits; app.alreadyChecked = alreadyChecked;
    app.run = createRegionRun(span, { engine: { newGame, stepGame }, patterns: app.patterns });
    app.clearSent = false; app.tape = null; app.injected = false; app.effects = []; app.message = '';
    setState('ready');
    renderExits();
}

function configureNow(config) {
    const params = config?.params ?? {};
    const span = regionSpanOf(params);
    const exits = Array.isArray(params.exits) ? params.exits : [];
    const alreadyChecked = (config?.checkedLocations ?? []).includes(CLEAR_ID);
    startRegion({ regionId: config?.regionId ?? null, span, exits, alreadyChecked });
}

function leaveBy(exitName) {
    if (!exitName || !exitsOpen()) return false;
    const exit = app.exits.find((e) => e.exitName === exitName);
    if (!exit) return false;
    app.message = `leaving by ${exitName}`;
    showStatus();
    window.__swfBridge?.sendExit?.(exitName, null);
    return true;
}

const exitsOpen = () => !!app.run && (app.run.cleared || app.alreadyChecked);

function renderExits() {
    exitsEl.textContent = '';
    if (!app.run) return;
    if (app.exits.length === 0) {
        const n = document.createElement('span'); n.className = 'note'; n.textContent = 'this region has no exit';
        exitsEl.appendChild(n);
        return;
    }
    app.exits.forEach((e, i) => {
        const b = document.createElement('button');
        b.textContent = `${i + 1}: leave → ${e.targetRegion ?? e.exitName}`;
        b.title = `${e.exitName}${e.side ? ` (side ${e.side})` : ''}`;
        b.disabled = !exitsOpen();
        b.dataset.exit = e.exitName;
        b.addEventListener('click', () => leaveBy(e.exitName));
        exitsEl.appendChild(b);
    });
    if (!exitsOpen()) {
        const n = document.createElement('span'); n.className = 'note'; n.textContent = 'clear the region to leave';
        exitsEl.appendChild(n);
    }
}

function onCleared() {
    setState('cleared');
    if (!app.clearSent) {
        app.clearSent = true;
        window.__swfBridge?.sendLocation?.(CLEAR_ID);
    }
    app.message = app.alreadyChecked ? 'cleared again' : 'REGION CLEAR';
    renderExits();
}

function stepOnce() {
    let inp = 0;
    if (app.injected) {
        // an injected tape that ran out waits for the next one (no idle frames between tapes)
        if (!app.tape || app.tapeAt >= app.tape.length) { app.tape = null; setState('ready'); return; }
        inp = app.tape[app.tapeAt++];
    } else {
        inp = keyboardInput();
    }
    const out = app.run.step(inp);
    if (out.hit) {
        const s = app.run.g.ship; // the new attempt's ship; the explosion goes where the old one was hit
        app.effects.push({ x: lastShip.x, y: lastShip.y, r: 40, life: 40, age: 0, color: '#f66' });
        app.message = `HIT — the region restarts (attempt ${app.run.attempt})`;
        lastShip = { x: s.x >> 8, y: s.y >> 8 };
        // an injected tape belongs to one attempt: after a hit the run waits for the next one
        if (app.injected) { app.tape = null; app.tapeAt = 0; setState('ready'); }
    } else {
        lastShip = { x: app.run.g.ship.x >> 8, y: app.run.g.ship.y >> 8 };
    }
    if (out.stageChanged) invalidatePanels();
    if (out.cleared) onCleared();
}
let lastShip = { x: 0, y: 0 };

// ── the loop ──
function frame(now) {
    requestAnimationFrame(frame);
    if (app.state === 'playing' && app.run) {
        if (app.lastTime === null) app.lastTime = now;
        app.acc += Math.min(now - app.lastTime, INTERVAL_BASE * MAX_FRAMES_PER_TICK);
        app.lastTime = now;
        let n = 0;
        while (app.acc >= INTERVAL_BASE && n < MAX_FRAMES_PER_TICK && app.state === 'playing') {
            app.acc -= INTERVAL_BASE;
            for (let k = 0; k < app.speed && app.state === 'playing'; k++) stepOnce();
            n++;
            for (const e of app.effects) e.age++;
            app.effects = app.effects.filter((e) => e.age < e.life);
        }
        if (n) showStatus();
    }
    render();
}

const VIEW = { effects: null, mode: 'play', modeLabel: '', speed: 1, tapeName: '', bot: false, policyName: '', muted: true, hitDot: false, paused: false, banner: '' };
function render() {
    const run = app.run;
    VIEW.effects = app.effects;
    VIEW.modeLabel = app.span ? `REGION ${showSpan(app.span)}` : 'NOIZ2SA';
    VIEW.paused = app.state === 'paused';
    VIEW.banner = app.state === 'ready' ? 'press Z or click to start'
        : app.state === 'cleared' ? 'REGION CLEAR — leave by an exit'
            : app.message.startsWith('HIT') && run?.attemptFrames < 90 ? 'HIT — the region restarts' : '';
    draw(ctx, run?.g ?? null, VIEW);
    // the left panel's lower half is the region's own (draw.js puts bot/sound/help text there, unused here)
    ctx.fillStyle = '#05080c'; ctx.fillRect(0, 196, FIELD_X - 1, 480 - 196);
    ctx.textAlign = 'left'; ctx.font = '12px monospace'; ctx.fillStyle = '#7ab';
    const lines = run ? [
        `ATTEMPT ${run.attempt}`, `HITS ${run.hits}`, `TIME ${(run.totalFrames / FPS).toFixed(1)}s`,
        'HITBOX centered', run.cleared ? 'CLEARED' : app.alreadyChecked ? 'cleared before' : '',
    ] : [app.loadError ? 'load failed' : app.patterns ? 'waiting for a region' : 'loading…'];
    lines.forEach((s, i) => ctx.fillText(s, 14, 216 + i * 18));
    ctx.font = '11px monospace'; ctx.fillStyle = '#567';
    ['arrows/WASD move', 'Z fire  X slow', 'P pause', '1-9 leave (cleared)'].forEach((s, i) => ctx.fillText(s, 14, 400 + i * 16));
}

function showStatus() {
    if (app.loadError) { statusEl.textContent = `Noiz2sa — could not load the patterns: ${app.loadError}`; return; }
    if (!app.run) { statusEl.textContent = app.patterns ? 'Noiz2sa — waiting for a region…' : 'Noiz2sa — loading…'; return; }
    const r = app.run;
    statusEl.textContent = `region ${app.regionId ?? '(standalone)'} — ${showSpan(app.span)}, seed ${app.span.seed} — `
        + `${app.state}, attempt ${r.attempt}, ${(r.totalFrames / FPS).toFixed(1)}s`
        + (app.message ? ` — ${app.message}` : '');
}

// ── game side of the __swfBridge contract ──
const gameSide = {
    configure(config) {
        if (!app.patterns) { app.pending = config; return; }
        try {
            configureNow(config);
        } catch (err) {
            console.error('[noiz2sa-game] configure refused:', err, config);
            statusEl.textContent = `Noiz2sa — this region cannot be played: ${err.message}`;
        }
    },
    reset() {
        if (app.run) { app.run.restart(); app.clearSent = false; setState('ready'); renderExits(); }
    },
};
window.__swfBridge = Object.assign(window.__swfBridge ?? {}, gameSide);

window.__noiz2saDebug = () => ({
    patternsLoaded: !!app.patterns,
    regionId: app.regionId,
    span: app.span,
    state: app.state,
    attempt: app.run?.attempt ?? 0,
    hits: app.run?.hits ?? 0,
    frames: app.run?.totalFrames ?? 0,
    attemptFrames: app.run?.attemptFrames ?? 0,
    pos: app.run?.pos ?? null,
    scene: app.run?.g?.scene ?? null,
    cleared: !!app.run?.cleared,
    clearSent: app.clearSent,
    alreadyChecked: app.alreadyChecked,
    exitsOpen: exitsOpen(),
    exits: app.exits.map((e) => e.exitName),
    tapeLeft: app.tape ? app.tape.length - app.tapeAt : 0,
});
window.__noiz2saTest = {
    /** play an injected tape from the current attempt's next frame; `speed` game frames per 16 ms */
    play(tape, { speed = 1 } = {}) {
        if (!app.run) return false;
        app.tape = typeof tape === 'string' ? decodeInputs(tape) : [...tape];
        app.tapeAt = 0; app.injected = true; app.speed = Math.max(1, Math.trunc(speed));
        if (app.state !== 'cleared') setState('playing');
        return true;
    },
    /** back to the keyboard */
    release() { app.injected = false; app.tape = null; app.speed = 1; },
    leave: (exitName) => leaveBy(exitName),
};

// ── boot ──
loadNoiz2saPatternsWeb(new URL('../../bulletml-dodge/', import.meta.url)).then((patterns) => {
    app.patterns = patterns;
    if (app.pending) { const c = app.pending; app.pending = null; gameSide.configure(c); }
    else if (!embedded) {
        // standalone: the region in the URL
        const q = new URLSearchParams(location.search);
        try {
            const span = { start: parsePosition(q.get('start') ?? '1:1'), end: parsePosition(q.get('end') ?? q.get('start') ?? '1:1'), seed: Number(q.get('seed') ?? 1) };
            startRegion({ regionId: null, span: regionSpanOf(span), exits: [], alreadyChecked: false });
        } catch (err) { statusEl.textContent = `Noiz2sa — ${err.message}`; }
    }
    showStatus();
}).catch((err) => {
    app.loadError = err.message;
    console.error('[noiz2sa-game] patterns:', err);
    showStatus();
});
showStatus();
requestAnimationFrame(frame);
