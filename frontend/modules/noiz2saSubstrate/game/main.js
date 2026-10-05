/**
 * The Noiz2sa region page — one region (a segment of a stage) played in the substrate's iframe.
 *
 * It runs the game repo's engine (`../../bulletml-dodge/src/game/`, the submodule) and its simple drawing
 * (`web/draw.js`, ⚖ simple graphics), one fixed 16 ms step per frame as the game's own page does (`web/play.js`).
 * The region rules are `../noiz2saRegion.js` (a copy of the game's `segment-run.js`): a hit restarts the region
 * from its start at once; the clear is the region's one location; after it the player may leave by an exit.
 *
 * The `__swfBridge` contract (flashSubstrate/bridge.js, injected by the host panel):
 *   game side, here:   configure({params: {move, seed, locations, exits}, regionId, checkedLocations})
 *   host side, called: sendLocation(<location id>) when that location's CHECK run clears; sendExit(exitName, null)
 *                      when a MOVE run clears;
 *                      setPlayClock(running, {gameSeconds, score}) on every state change and every whole game
 *                      second (running = the game is stepping; the stats are the VISIT's so far, every attempt).
 *   the bot (N4):      botWalkTo(goal, options) — goal {kind: 'pickup', id: <location id>} (play its check run to its clear)
 *                      or {kind: 'portal', id: exitName} (play the move run to its clear, leaving by it); options = the
 *                      host's bot settings {knobs, tracks, botSeed, speed, retryCap} (noiz2saTraining.js
 *                      botWalkOptions); botStop() hands the region back.
 *   host state (N4b):  setHostState({loopMode, bot, region, next, checked, live}) — whether loop mode is on, the
 *                      bot's options for this visit (the visit's bot seed, the knobs at the CURRENT tracks), the next
 *                      action the loops queue holds for the region (`next`: {region, kind: 'move', exit} or {region,
 *                      kind: 'check', location}, or null), the ids of its checked locations, and whether the queue is parked on
 *                      the region for live play; sent on every region load and on every change, in any order with
 *                      configure.
 *                      requestHost({kind: 'chooseExit', exitName} | {kind: 'chooseCheck', location}) — in loop mode, nothing is
 *                      queued for the region: the player chose from the choice list (the host queues the action and
 *                      runs the queue).
 * Opened directly in a tab (no host), the page plays the region in its URL: ?start=1:2&end=1:3&seed=1.
 *
 * The game only steps while the player is playing it: a configured region waits for a game key (or a click), and
 * the page pauses when it loses focus (⚖ no offline progress). The page reports its clock (`setPlayClock(running,
 * stats)`, running only while `playing`), so the host's time drain charges played time only — per GAME second, from
 * `stats.gameSeconds`, so the bot's faster speeds cost the same per region.
 *
 * The bot (N4, the Bot block): the humanlike bot at the host's current tracks, in a worker (`bot-worker.js`), plays
 * the region from where it is; a hit restarts the region and the bot plays the next attempt with the next attempt's
 * bot seed (segment-run.js attemptBotSeed), until the clear or `retryCap` failed attempts (0 = no cap). It plays at
 * `speed` game frames per 16 ms. New settings sent for the same goal apply from the next attempt (the speed at once).
 * Keys: arrows/WASD move, Z fire, X slow, P pause, R play the run again from its start, B let the bot play (and
 * take the controls back); in the choice list 1–9 pick that choice (the exits first, then the locations).
 *
 * N4b/N4c — TWO RUNS per region. A MOVE run plays the move span on every visit (cleared before or not) and its clear
 * PERFORMS the move (the page leaves by its exit). A region has zero or more locations (⚖ N4c: none by default), each
 * with its own CHECK span (by default twice the move's scenes). A location's CHECK run (⚖ 2026-10-05: "I want the
 * location check to be a separate action from the move") plays its span, and its clear checks that location; the
 * player STAYS in the region. A hit restarts the current run's span. Which run plays is the
 * next queued action for the region (loop mode, the host's `next`) or the player's pick from the CHOICE LIST: with
 * nothing queued (or outside loop mode, one behaviour everywhere) the region waits in `choosing`, offering every exit
 * and every unchecked location. In loop mode a pick asks the host to queue the action as the Loops
 * panel does, and the run starts when the host reports it queued; outside loop mode the run starts at once (nothing is
 * queued and nothing drains). After a check run the region goes back to the choice list (now exits only) or to the
 * next queued action. Every visit plays with its own bot seed (the host draws it per region load), reported in the
 * play-clock stats as `botSeed` (so a Record summary carries it); `botFrames` counts the frames the bot played on the
 * visit.
 *
 * Test surface (not the contract): `window.__noiz2saDebug()` reads the state; `window.__noiz2saTest` drives
 * injected input (`play(tape, {speed})` — a run-length tape, see noiz2saRegion.js `encodeInputs`), the step
 * speed, `leave(exitName)`, and the choice list (`choose(exitName)`, `chooseCheck(locationId)`).
 */
import { newGame, stepGame, input } from '../../bulletml-dodge/src/game/noiz2sa-game.js';
import { loadNoiz2saPatternsWeb } from '../../bulletml-dodge/src/game/patterns-web.js';
import { draw, FIELD_X, invalidatePanels } from '../../bulletml-dodge/web/draw.js';
import { packBulletML } from '../../bulletml-dodge/src/bulletml.js';
import { botOptions } from '../../bulletml-dodge/src/game/human.js';
import { attemptBotSeed } from '../../bulletml-dodge/src/game/segment-run.js';
import { createRegionRun, regionSpansOf, parsePosition, showSpan, decodeInputs, FPS } from '../noiz2saRegion.js';

const INTERVAL_BASE = 16; // ms per frame (noiz2sa.c)
const MAX_FRAMES_PER_TICK = 8; // a slow display frame catches up at most this many game frames
const $ = (id) => document.getElementById(id);
const canvas = $('screen'), ctx = canvas.getContext('2d');
const statusEl = $('status'), exitsEl = $('exits');
const embedded = window !== window.parent;

const app = {
    patterns: null, loadError: null,
    pending: null,          // a configure that arrived before the patterns
    regionId: null, exits: [],
    configChecked: [],      // the ids of the region's locations checked when it was configured
    spans: null,            // N4c: the region's {move, seed, locations: [{id, check}]}
    span: null,             // the current run's span {start, end, seed}
    runPlayed: false,       // a frame of the current run was stepped (a run nobody played may be swapped for another)
    runKind: null,          // N4c: the current run — 'move' (its clear performs the move) | 'check' (its clear checks)
    runExit: null,          // a move run's exit (the queued move's, or the player's pick outside loop mode)
    runLoc: null,           // a check run's location id
    run: null,
    state: 'waiting',       // waiting (no region) | choosing (the choice list) | ready | playing | paused | cleared
    clearSent: false, moveClearedThisVisit: false,
    checksCleared: new Set(), // the locations whose check run cleared on this visit
    tape: null, tapeAt: 0, injected: false, speed: 1,
    effects: [], message: '', lastTime: null, acc: 0,
    // the VISIT so far (every attempt, R included): what the play clock reports and the host trains on
    visitFrames: 0, scoreFolded: 0, attemptInputs: [],
    configures: 0,          // regions configured so far (a test waits for a fresh one)
    bot: null,              // the bot's walk: {goal, opts, next, id, inputs, failed} (N4); goal kind 'assist' = the B key
    lastBot: null,          // the last walk's settings and outcome, for the test surface
    loopMode: false,        // N4b, from the host: in loop mode the exits open only after a clear on this visit
    hostBot: null,          // N4b, from the host: the bot's options for this visit (seed, knobs at the current tracks)
    botFrames: 0,           // the frames the bot played on this visit
    next: null,             // N4c, from the host: the next queued action for the region {region, kind, exit?}, or null
    hostChecked: null,      // N4c, from the host: the ids of the region's checked locations (null: not said yet)
    hostLive: false,        // N4c, from the host: the loops queue is parked on the region (a pick's run starts then)
    chosen: null,           // N4c, loop mode: the pick from the choice list {kind, id} (the run starts when queued)
    runs: [],               // N4c, test surface: this visit's runs so far {kind, exit, location, span, cleared, clearFrames, sceneEnds}
    sceneEnds: [],          // the current attempt's scene ends (attempt frames)
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
    if (/^Digit[1-9]$/.test(e.code)) {
        const k = Number(e.code.slice(5)) - 1;
        if (app.state === 'choosing') { const c = choices()[k]; if (c) choose(c.kind, c.id); } else leaveBy(app.exits[k]?.exitName);
        return;
    }
    if (e.code === 'KeyR') { playAgain(); return; }
    if (e.code === 'KeyB') { toggleAssist(); return; }
    if (e.code === 'KeyP') { if (app.state === 'playing') setState('paused'); else if (app.state === 'paused') setState('playing'); return; }
    if (GAME_KEYS.has(e.code) && app.bot && app.state === 'paused') { setState('playing'); return; }
    if (GAME_KEYS.has(e.code) && (app.state === 'ready' || app.state === 'paused')) { app.injected = false; app.speed = 1; setState('playing'); }
});
addEventListener('keyup', (e) => held.delete(e.code));
addEventListener('blur', () => {
    held.clear();
    if (app.state === 'playing' && !app.injected && !app.bot) setState('paused');
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
    const stats = { gameSeconds: app.visitFrames / FPS, score: visitScore(), botFrames: app.botFrames };
    const seed = visitBotSeed();
    if (seed !== null) stats.botSeed = seed;
    window.__swfBridge?.setPlayClock?.(app.state === 'playing', stats);
}
/** the visit's bot seed (the host draws one per region load), or null before the host said */
const visitBotSeed = () => app.hostBot?.botSeed ?? app.bot?.opts.botSeed ?? null;
/** the visit's score: every finished attempt's score from the region's start, plus the current attempt's */
const visitScore = () => app.scoreFolded + (app.run && !app.run.cleared ? app.run.score : 0);

// ── the region ──
function startRegion({ regionId, spans, exits, configChecked }) {
    app.configures++;
    const prevRegion = app.regionId;
    app.regionId = regionId; app.spans = spans; app.exits = exits; app.configChecked = configChecked;
    stopBot();
    app.run = null; app.runKind = null; app.runExit = null; app.runLoc = null; app.span = null; app.runs = [];
    app.clearSent = false; app.moveClearedThisVisit = false; app.checksCleared = new Set();
    app.tape = null; app.injected = false; app.effects = []; app.message = '';
    app.visitFrames = 0; app.scoreFolded = 0; app.attemptInputs = []; app.speed = 1; app.botFrames = 0;
    // a pick from the choice list survives the region configured again (a queue never started starts from its first
    // move, which enters the region again): the run starts once the host reports the pick queued
    if (regionId !== prevRegion) app.chosen = null;
    app.hostChecked = null; app.hostLive = false; // the host's word is per region (setHostState)
    if (app.next && app.next.region !== regionId) app.next = null;
    // a region always has a run to draw: the move run until something else is decided
    prepareRun('move', null);
    decide();
}

/**
 * whether a location of the region is checked: the host's word once it gave one (it says again whenever its snapshot
 * changes), else configure's
 */
const isChecked = (id) => (app.hostChecked ?? app.configChecked).includes(id);
const locationOf = (id) => app.spans?.locations.find((l) => l.id === id) ?? null;
/** the next queued action for THIS region (loop mode), or null */
const hostNext = () => (app.loopMode && app.next && app.next.region === app.regionId ? app.next : null);
/** an action's id: a move's exit, a check's location */
const idOf = (n) => (n.kind === 'move' ? n.exit : n.location);
/** the choice list: every exit, and every unchecked location (N4c) */
const choices = () => [
    ...app.exits.map((e) => ({ kind: 'move', id: e.exitName, exitName: e.exitName })),
    ...(app.regionId ? app.spans.locations.filter((l) => !isChecked(l.id)).map((l) => ({ kind: 'check', id: l.id, exitName: null })) : []),
];

/**
 * A new run of the region: `kind` 'move' plays the move span (its clear leaves by exit `id`), 'check' location `id`'s
 * check span (its clear checks it). The visit's stats go on; an abandoned attempt's score counts.
 */
function prepareRun(kind, id, { start = false } = {}) {
    const span = kind === 'move' ? app.spans.move : locationOf(id)?.check;
    if (!span) return false;
    if (app.run && runUntouched()) app.runs.pop(); // a run nobody played is no run of the visit
    else if (app.run && !app.run.cleared) app.scoreFolded += app.run.score;
    app.runKind = kind; app.runExit = kind === 'move' ? id : null; app.runLoc = kind === 'check' ? id : null; app.runPlayed = false;
    const exit = app.runExit;
    app.span = { ...span, seed: app.spans.seed };
    app.run = createRegionRun(app.span, { engine: { newGame, stepGame }, patterns: app.patterns });
    app.runs.push({ kind, exit: app.runExit, location: app.runLoc, span: app.span, cleared: false, clearFrames: null });
    app.attemptInputs = []; app.sceneEnds = []; app.clearSent = false; app.tape = null; app.tapeAt = 0; app.injected = false; app.speed = 1;
    if (kind === 'move') app.moveClearedThisVisit = false;
    app.message = kind === 'check' ? `the check of ${id}: clear it to check the location`
        : exit ? `the move: its clear leaves by ${exit}` : '';
    invalidatePanels();
    setState(start ? 'playing' : 'ready');
    renderExits();
    return true;
}
/** the current run is action `n`'s ({kind, exit | location}) */
const runIs = (n) => app.runKind === n.kind && (n.kind === 'move' ? app.runExit === n.exit : app.runLoc === n.location);

/** nothing played on the current run yet (a fresh run can be swapped for another) */
const runUntouched = () => !!app.run && !app.runPlayed;

/**
 * What the region does next when it is free to (choosing, cleared, or a run nobody has played yet): in loop mode the
 * host's next queued action — its run; nothing queued → the choice list. Outside loop mode the choice list. A run in
 * progress, or a bot's, is left alone; a queued move's exit is followed even mid-run.
 */
function decide() {
    if (!app.run || app.bot) return;
    const n = hostNext();
    if (n?.kind === 'move' && app.runKind === 'move' && !app.run.cleared) app.runExit = n.exit;
    const free = app.state === 'choosing' || app.state === 'cleared' || (app.state === 'ready' && runUntouched());
    if (!free) return;
    if (n) {
        // the player's pick, now queued: its run starts once the queue is parked on the region (`live`) — a queue never
        // started starts from its first move, which may enter the region again first
        const picked = !!app.chosen && app.chosen.kind === n.kind && app.chosen.id === idOf(n);
        const go = picked && app.hostLive;
        if (!picked || go) app.chosen = null;
        if (app.state === 'cleared' && runIs(n) && n.kind === 'check' && !picked) return; // the clear is still on its way
        if (app.state === 'cleared' && app.runKind === 'move') return; // the move run leaves (afterClear)
        if (app.state === 'ready' && runIs(n)) {
            if (go) { app.message = ''; setState('playing'); renderExits(); }
            return;
        }
        prepareRun(n.kind, idOf(n), { start: go });
        return;
    }
    if (app.state === 'cleared' && app.runKind === 'move') return;
    if (app.chosen && app.loopMode) return; // waiting for the host to queue the pick
    if (choices().length === 0) return;
    if (app.state !== 'choosing') { app.message = app.state === 'cleared' ? app.message : ''; setState('choosing'); }
    renderExits();
}

/** the choice list: pick an exit `id` (a move run) or a location `id` (its check run) */
function choose(kind, id) {
    if (app.state !== 'choosing' || (app.loopMode && app.chosen)) return false;
    if (!choices().some((c) => c.kind === kind && c.id === id)) return false;
    if (!app.loopMode) {
        // outside loop mode nothing is queued and nothing drains: the run starts at once
        return prepareRun(kind, id, { start: true });
    }
    app.chosen = { kind, id };
    app.message = kind === 'check' ? `chosen: the check of ${id} — queueing it` : `chosen: leave by ${id} — queueing the move`;
    showStatus();
    renderExits();
    window.__swfBridge?.requestHost?.(kind === 'check' ? { kind: 'chooseCheck', location: id } : { kind: 'chooseExit', exitName: id });
    return true;
}
const chooseExit = (exitName) => choose('move', exitName);
/** a location's check (default: the first unchecked one) */
const chooseCheck = (id) => choose('check', id ?? choices().find((c) => c.kind === 'check')?.id);

function configureNow(config) {
    const params = config?.params ?? {};
    const spans = regionSpansOf(params);
    const exits = Array.isArray(params.exits) ? params.exits : [];
    const configChecked = (config?.checkedLocations ?? []).filter((id) => spans.locations.some((l) => l.id === id));
    startRegion({ regionId: config?.regionId ?? null, spans, exits, configChecked });
}

function leaveBy(exitName) {
    if (app.state === 'choosing') return chooseExit(exitName);
    if (!exitName || !exitsOpen()) return false;
    const exit = app.exits.find((e) => e.exitName === exitName);
    if (!exit) return false;
    app.message = `leaving by ${exitName}`;
    showStatus();
    if (app.state === 'playing') setState('ready'); // the clock's last report before the exit
    window.__swfBridge?.sendExit?.(exitName, null);
    return true;
}

// N4b: the move out of the region is played to a clear on every visit — the exits open only after a MOVE run's clear
// on this visit.
const exitsOpen = () => !!app.run && app.runKind === 'move' && (app.run.cleared || app.moveClearedThisVisit);

/**
 * R: play the current run again from its start, on the same visit. A check run's clear is sent again when it comes —
 * the bridge dispatches it if the host did not accept the first one (e.g. the queue was not parked on the region) and
 * drops it if it did.
 */
function playAgain() {
    if (!app.run || app.state === 'choosing') return;
    stopBot();
    if (!app.run.cleared) app.scoreFolded += app.run.score; // the abandoned attempt's score counts
    app.run.restart();
    app.attemptInputs = []; app.sceneEnds = [];
    app.clearSent = false; app.tape = null; app.tapeAt = 0; app.injected = false; app.speed = 1;
    app.effects = []; app.message = `playing the ${app.runKind} again`;
    setState('ready');
    renderExits();
}

function note(text) {
    const n = document.createElement('span'); n.className = 'note'; n.textContent = text;
    exitsEl.appendChild(n);
}
function button(label, title, disabled, onClick, data) {
    const b = document.createElement('button');
    b.textContent = label; b.title = title; b.disabled = disabled;
    Object.assign(b.dataset, data);
    b.addEventListener('click', onClick);
    exitsEl.appendChild(b);
}

function renderExits() {
    exitsEl.textContent = '';
    if (!app.run) return;
    if (app.state === 'choosing') {
        const pending = !!app.chosen;
        const list = choices();
        note(pending ? 'queueing…' : list.some((c) => c.kind === 'check')
            ? 'choose: an exit (the clear leaves by it) or a location (its clear checks it)' : 'choose an exit: the clear leaves by it');
        list.forEach((c, i) => {
            if (c.kind === 'move') {
                const e = app.exits.find((x) => x.exitName === c.id);
                button(`${i + 1}: go → ${e.targetRegion ?? e.exitName}`, `${e.exitName}${e.side ? ` (side ${e.side})` : ''}`,
                    pending, () => chooseExit(c.id), { exit: c.id });
            } else {
                button(`${i + 1}: check ${c.id} (${showSpan(locationOf(c.id).check)})`, `the check run of ${c.id}`,
                    pending, () => chooseCheck(c.id), { location: c.id });
            }
        });
        return;
    }
    if (app.runKind === 'check') {
        note(app.state === 'cleared' ? `${app.runLoc} checked — the next action` : `the check of ${app.runLoc} (${showSpan(app.span)}): its clear checks it`);
        return;
    }
    if (app.exits.length === 0) { note('this region has no exit'); return; }
    app.exits.forEach((e, i) => button(`${i + 1}: leave → ${e.targetRegion ?? e.exitName}`, `${e.exitName}${e.side ? ` (side ${e.side})` : ''}`,
        !exitsOpen(), () => leaveBy(e.exitName), { exit: e.exitName }));
    if (!exitsOpen()) note(app.runExit ? `clear the region: the clear leaves by ${app.runExit}` : 'clear the region to leave');
}

function onCleared() {
    const rec = app.runs[app.runs.length - 1];
    if (rec) { rec.cleared = true; rec.clearFrames = app.run.clearFrames; rec.exit = app.runExit; rec.sceneEnds = app.sceneEnds.slice(); }
    app.scoreFolded += app.run.score;
    setState('cleared');
    if (app.runKind === 'check') {
        app.checksCleared.add(app.runLoc);
        if (!app.clearSent) {
            app.clearSent = true;
            window.__swfBridge?.sendLocation?.(app.runLoc);
        }
        app.message = `CHECK CLEAR — ${app.runLoc}`;
    } else {
        app.moveClearedThisVisit = true;
        app.message = 'REGION CLEAR';
    }
    renderExits();
}

/** after a clear: a move run leaves by its exit (a Bot walk by its own portal goal); a check run goes on to what is next */
function afterClear() {
    if (app.runKind === 'move') { if (app.runExit) leaveBy(app.runExit); return; }
    decide();
}

/** one game frame; false when the bot's next input has not arrived yet (the page waits, it never guesses) */
function stepOnce() {
    let inp = 0;
    if (app.bot) {
        inp = app.bot.inputs[app.run.attemptFrames];
        if (inp === undefined) return false;
    } else if (app.injected) {
        // an injected tape that ran out waits for the next one (no idle frames between tapes)
        if (!app.tape || app.tapeAt >= app.tape.length) { app.tape = null; setState('ready'); return; }
        inp = app.tape[app.tapeAt++];
    } else {
        inp = keyboardInput();
    }
    const scoreBefore = app.run.scoreBefore, g0 = app.run.g, sceneBefore = g0.scene;
    const out = app.run.step(inp);
    app.runPlayed = true;
    // the attempt frames at which this attempt's scenes ended (the test surface measures a span in frames with it)
    if (out.hit) app.sceneEnds = [];
    else if (out.cleared || out.stageChanged || (sceneBefore >= 0 && app.run.g.scene !== sceneBefore)) app.sceneEnds.push(app.run.attemptFrames);
    app.visitFrames++;
    if (app.bot) app.botFrames++;
    app.attemptInputs.push(inp);
    if (out.hit) {
        app.scoreFolded += scoreBefore + g0.score; // the failed attempt's score, from the region's start
        app.attemptInputs = [];
        const s = app.run.g.ship; // the new attempt's ship; the explosion goes where the old one was hit
        app.effects.push({ x: lastShip.x, y: lastShip.y, r: 40, life: 40, age: 0, color: '#f66' });
        app.message = `HIT — the region restarts (attempt ${app.run.attempt})`;
        lastShip = { x: s.x >> 8, y: s.y >> 8 };
        // an injected tape belongs to one attempt: after a hit the run waits for the next one
        if (app.injected) { app.tape = null; app.tapeAt = 0; setState('ready'); }
        if (app.bot) botAttemptFailed();
    } else {
        lastShip = { x: app.run.g.ship.x >> 8, y: app.run.g.ship.y >> 8 };
    }
    if (out.stageChanged) invalidatePanels();
    if (out.cleared) {
        const bot = app.bot;
        if (bot) {
            app.lastBot = { ...app.lastBot, cleared: true, attempts: app.run.attempt, failed: bot.failed,
                frames: app.run.totalFrames, visitSeconds: app.visitFrames / FPS, score: app.scoreFolded + app.run.score };
        }
        stopBot();
        onCleared();
        if (bot?.goal.kind === 'portal') leaveBy(bot.goal.id);
        else afterClear();
    } else if (app.state === 'playing' && app.visitFrames % FPS_FRAMES_PER_REPORT === 0) {
        reportPlayClock();
    }
    return true;
}
/** the clock reports while playing: every 62.5 frames is not an integer, so a report every 63 frames (~1 game s) */
const FPS_FRAMES_PER_REPORT = Math.ceil(FPS);

// ── the bot (N4) ──
let worker = null;
function ensureWorker() {
    if (worker) return worker;
    worker = new Worker(new URL('./bot-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'error') { console.error('[noiz2sa-game] bot worker:', m.message); return; }
        if (m.type !== 'inputs' || !app.bot || m.id !== app.bot.id) return;
        for (let i = 0; i < m.inputs.length; i++) app.bot.inputs[m.from + i] = m.inputs[i];
    };
    worker.postMessage({ type: 'init', patterns: Object.fromEntries(Object.entries(app.patterns).map(([k, l]) => [k, l.map(packBulletML)])) });
    return worker;
}

function normalizeBotOptions(o = {}) {
    const speed = Math.trunc(Number(o.speed));
    return {
        knobs: o.knobs && typeof o.knobs === 'object' ? o.knobs : {},
        tracks: o.tracks ?? null,
        botSeed: Number.isInteger(o.botSeed) && o.botSeed >= 0 && o.botSeed <= 0xffffffff ? o.botSeed : 1,
        speed: [1, 2, 4].includes(speed) ? speed : 1,
        retryCap: Number.isInteger(o.retryCap) && o.retryCap > 0 ? o.retryCap : 0,
    };
}

/** the bot plays the region toward `goal` (see the header) */
function botWalkTo(goal, options) {
    if (!app.run || !goal) return false;
    const opts = normalizeBotOptions(options);
    if (app.bot && app.bot.goal.kind === goal.kind && app.bot.goal.id === goal.id) {
        app.bot.next = opts; // the next attempt plays at the new tracks; the speed changes now
        app.speed = opts.speed;
        return true;
    }
    stopBot();
    if (goal.kind === 'portal' && exitsOpen()) return leaveBy(goal.id);
    if (goal.kind === 'pickup' && app.checksCleared.has(goal.id)) {
        // its check cleared on this visit already: say it again (the bridge drops it if the host has it)
        window.__swfBridge?.sendLocation?.(goal.id);
        return true;
    }
    // N4c: a location goal plays its check run, an exit goal the move run — from where it is when it is that run
    const kind = goal.kind === 'pickup' ? 'check' : 'move';
    const same = kind === 'move' ? app.runKind === 'move' : app.runKind === 'check' && app.runLoc === goal.id;
    if (!same || app.run.cleared || app.state === 'choosing') { if (!prepareRun(kind, goal.id)) return false; }
    else if (kind === 'move') app.runExit = goal.id;
    app.chosen = null;
    app.tape = null; app.injected = false;
    app.bot = { goal, opts, next: null, id: 0, inputs: [], failed: 0 };
    app.lastBot = { goal, tracks: opts.tracks, speed: opts.speed, retryCap: opts.retryCap, knobs: opts.knobs, botSeed: opts.botSeed, cleared: false, gaveUp: false, attempts: 0, failed: 0 };
    app.speed = opts.speed;
    startBotAttempt();
    app.message = `the bot plays (${opts.speed}×)`;
    setState('playing');
    return true;
}

/**
 * B — the bot-assist key (N4b, Manual/Record visits): hands the controls to the bot at the current tracks (the host's
 * options for this visit), which plays the current run (move or check) toward its clear, and the clear does what that
 * run's clear does; B again hands them back (the game pauses until the player's next game key). A Bot block's own walk
 * is the queue's: B leaves it alone.
 */
function toggleAssist() {
    if (!app.run || app.state === 'cleared' || app.state === 'waiting' || app.state === 'choosing') return false;
    if (app.bot) {
        if (app.bot.goal.kind !== 'assist') return false;
        stopBot();
        app.message = 'your controls (a game key resumes)';
        setState('paused');
        return true;
    }
    const opts = normalizeBotOptions(app.hostBot ?? {});
    app.tape = null; app.injected = false;
    app.bot = { goal: { kind: 'assist', id: null }, opts, next: null, id: 0, inputs: [], failed: 0 };
    app.lastBot = { goal: app.bot.goal, tracks: opts.tracks, speed: opts.speed, retryCap: opts.retryCap, knobs: opts.knobs, botSeed: opts.botSeed, cleared: false, gaveUp: false, attempts: 0, failed: 0 };
    app.speed = opts.speed;
    startBotAttempt();
    app.message = `the bot plays for you (${opts.speed}×; B: your controls)`;
    setState('playing');
    return true;
}

/** the host's state (N4b/N4c): loop mode, the bot's options for this visit, the next queued action, the checked flag */
function setHostState(state) {
    if (!state || typeof state !== 'object') return;
    if (typeof state.loopMode === 'boolean') {
        if (state.loopMode !== app.loopMode) app.chosen = null;
        app.loopMode = state.loopMode;
    }
    if (state.bot && typeof state.bot === 'object') {
        app.hostBot = normalizeBotOptions(state.bot);
        // an assisting bot plays its next attempt at the new tracks (a walk gets them from the host's proxy)
        if (app.bot?.goal.kind === 'assist') { app.bot.next = app.hostBot; app.speed = app.hostBot.speed; }
    }
    if ('next' in state) app.next = state.next && typeof state.next === 'object' ? state.next : null;
    if (Array.isArray(state.checked) && state.region === app.regionId) app.hostChecked = state.checked.slice();
    if (typeof state.live === 'boolean' && state.region === app.regionId) app.hostLive = state.live;
    if (state.refused && app.chosen && app.state === 'choosing') {
        app.message = `could not queue ${app.chosen.kind === 'check' ? `the check of ${app.chosen.id}` : `the move by ${app.chosen.id}`}: ${state.refused.why ?? 'refused'}`;
        app.chosen = null;
    }
    decide();
    renderExits();
    reportPlayClock();
}

let nextWalkId = 1;
function startBotAttempt() {
    const bot = app.bot;
    if (bot.next) { bot.opts = bot.next; bot.next = null; app.speed = bot.opts.speed; app.lastBot.tracks = bot.opts.tracks; }
    bot.id = nextWalkId++;
    bot.inputs = [];
    const { botSeed: _unused, ...opt } = botOptions({ perception: 'observed', knobs: bot.opts.knobs }, { botSeed: bot.opts.botSeed });
    ensureWorker().postMessage({
        type: 'start', id: bot.id, span: app.span, inputs: app.attemptInputs.slice(), bot: opt,
        botSeed: attemptBotSeed(bot.opts.botSeed, app.run.attempt - 1),
    });
}

/** a hit while the bot played: the next attempt, or — at the retry cap — the bot gives up and the region waits */
function botAttemptFailed() {
    const bot = app.bot;
    bot.failed++;
    app.lastBot.failed = bot.failed;
    if (bot.opts.retryCap > 0 && bot.failed >= bot.opts.retryCap) {
        app.lastBot.gaveUp = true;
        stopBot();
        app.message = `the bot gave up after ${bot.failed} failed attempt${bot.failed === 1 ? '' : 's'}`;
        setState('ready');
        return;
    }
    startBotAttempt();
}

function stopBot() {
    if (!app.bot) return;
    worker?.postMessage({ type: 'stop', id: app.bot.id });
    app.bot = null;
    app.speed = 1;
}
let lastShip = { x: 0, y: 0 };

// ── the loop ──
function frame(now) {
    requestAnimationFrame(frame);
    if (app.state === 'playing' && app.run) {
        if (app.lastTime === null) app.lastTime = now;
        app.acc += Math.min(now - app.lastTime, INTERVAL_BASE * MAX_FRAMES_PER_TICK);
        app.lastTime = now;
        let n = 0, waiting = false;
        while (app.acc >= INTERVAL_BASE && n < MAX_FRAMES_PER_TICK && app.state === 'playing' && !waiting) {
            app.acc -= INTERVAL_BASE;
            for (let k = 0; k < app.speed && app.state === 'playing'; k++) if (!stepOnce()) { waiting = true; break; }
            n++;
            for (const e of app.effects) e.age++;
            app.effects = app.effects.filter((e) => e.age < e.life);
        }
        // waiting for the bot: no backlog builds up (the game never runs ahead to catch up)
        if (waiting) app.acc = Math.min(app.acc, INTERVAL_BASE);
        if (app.bot) worker?.postMessage({ type: 'ack', id: app.bot.id, frame: app.run.attemptFrames });
        if (n) showStatus();
    }
    render();
}

const VIEW = { effects: null, mode: 'play', modeLabel: '', speed: 1, tapeName: '', bot: false, policyName: '', muted: true, hitDot: false, paused: false, banner: '' };
function render() {
    const run = app.run;
    VIEW.effects = app.effects;
    VIEW.modeLabel = app.span ? `${app.runKind === 'check' ? 'CHECK' : 'MOVE'} ${showSpan(app.span)}` : 'NOIZ2SA';
    VIEW.paused = app.state === 'paused';
    VIEW.banner = app.state === 'choosing' ? (app.chosen ? 'queueing…' : 'choose (1-9)')
        : app.state === 'ready' ? 'press Z or click to start'
        : app.state === 'cleared' ? (app.runKind === 'check' ? `CHECK CLEAR — ${app.runLoc}` : 'REGION CLEAR (R: play again)')
            : app.message.startsWith('HIT') && run?.attemptFrames < 90 ? 'HIT — the region restarts' : '';
    draw(ctx, run?.g ?? null, VIEW);
    // the left panel's lower half is the region's own (draw.js puts bot/sound/help text there, unused here)
    ctx.fillStyle = '#05080c'; ctx.fillRect(0, 196, FIELD_X - 1, 480 - 196);
    ctx.textAlign = 'left'; ctx.font = '12px monospace'; ctx.fillStyle = '#7ab';
    const tracks = app.bot?.opts.tracks;
    const lines = run ? [
        `ATTEMPT ${run.attempt}`, `HITS ${run.hits}`, `TIME ${(run.totalFrames / FPS).toFixed(1)}s`,
        'HITBOX centered', run.cleared ? 'CLEARED' : app.runKind === 'check' ? `CHECK ${app.runLoc}` : '',
        app.bot ? `BOT ${app.speed}x` : '',
        tracks ? `TRACKS ${['seeing', 'thinking', 'hands', 'focus', 'panic'].map((k) => tracks[k] ?? 0).join('/')}` : '',
    ] : [app.loadError ? 'load failed' : app.patterns ? 'waiting for a region' : 'loading…'];
    lines.forEach((s, i) => ctx.fillText(s, 14, 216 + i * 18));
    ctx.font = '11px monospace'; ctx.fillStyle = '#567';
    ['arrows/WASD move', 'Z fire  X slow', 'P pause  R again', 'B bot plays', '1-9 choose'].forEach((s, i) => ctx.fillText(s, 14, 384 + i * 16));
}

function showStatus() {
    if (app.loadError) { statusEl.textContent = `Noiz2sa — could not load the patterns: ${app.loadError}`; return; }
    if (!app.run) { statusEl.textContent = app.patterns ? 'Noiz2sa — waiting for a region…' : 'Noiz2sa — loading…'; return; }
    const r = app.run;
    statusEl.textContent = `region ${app.regionId ?? '(standalone)'} — ${app.runKind} ${showSpan(app.span)}, seed ${app.span.seed} — `
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
        stopBot();
        if (app.run) {
            if (!app.run.cleared) app.scoreFolded += app.run.score;
            app.run.restart(); app.attemptInputs = []; app.clearSent = false; setState('ready'); renderExits(); decide();
        }
    },
    botWalkTo: (goal, options) => botWalkTo(goal, options),
    setHostState: (state) => setHostState(state),
    botStop() {
        const was = !!app.bot;
        stopBot();
        if (was && app.state === 'playing') setState('ready');
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
    configChecked: app.configChecked,
    checked: app.spans ? app.spans.locations.filter((l) => isChecked(l.id)).map((l) => l.id) : [],
    exitsOpen: exitsOpen(),
    moveClearedThisVisit: app.moveClearedThisVisit,
    checksCleared: [...app.checksCleared],
    checkClearedThisVisit: app.checksCleared.size > 0,
    spans: app.spans,
    runKind: app.runKind,
    runExit: app.runExit,
    runLoc: app.runLoc,
    runs: app.runs.map((r) => ({ ...r })),
    choices: app.state === 'choosing' ? choices() : [],
    exits: app.exits.map((e) => e.exitName),
    tapeLeft: app.tape ? app.tape.length - app.tapeAt : 0,
    configures: app.configures,
    visitSeconds: app.visitFrames / FPS,
    visitScore: visitScore(),
    speed: app.speed,
    bot: app.bot ? { goal: app.bot.goal, failed: app.bot.failed, tracks: app.bot.opts.tracks } : null,
    lastBot: app.lastBot,
    loopMode: app.loopMode,
    visitBotSeed: visitBotSeed(),
    botFrames: app.botFrames,
    next: app.next,
    hostLive: app.hostLive,
    chosen: app.chosen,
});
window.__noiz2saTest = {
    /** play an injected tape from the current attempt's next frame; `speed` game frames per 16 ms */
    play(tape, { speed = 1 } = {}) {
        if (!app.run) return false;
        app.tape = typeof tape === 'string' ? decodeInputs(tape) : [...tape];
        stopBot();
        app.tapeAt = 0; app.injected = true; app.speed = Math.max(1, Math.trunc(speed));
        if (app.state !== 'cleared') setState('playing');
        return true;
    },
    /** back to the keyboard */
    release() { app.injected = false; app.tape = null; app.speed = 1; },
    leave: (exitName) => leaveBy(exitName),
    /** R: the region again from its start, on the same visit */
    again: () => playAgain(),
    /** B: the bot plays for the player, or hands the controls back */
    assist: () => toggleAssist(),
    /** `choosing`: pick the exit (as the exit button does) */
    choose: (exitName) => chooseExit(exitName),
    /** `choosing`: pick a location's check (as its button does; default: the first unchecked) */
    chooseCheck: (id) => chooseCheck(id),
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
            startRegion({ regionId: null, spans: regionSpansOf(span), exits: [], configChecked: [] });
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
