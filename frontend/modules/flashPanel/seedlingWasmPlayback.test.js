/**
 * seedlingWasmPlayback — solver-walk W2: the ENGINE behind the controller's
 * wasm branch (plan `NewDocs/plans/seedling-js-solver-walk-plan.md` §5.3 W2).
 *
 * The game is a FAKE whose reads are W1's RECORDED arrivals
 * (`seedlingDemo/fixtures/wasm-arrival-p4e.json`): `botSeam` answers the
 * baseline until the forced re-arrival's teleport "lands", then the recorded
 * arrival's `beginEntry`; `botStatus`/`readState` are the recorded reads with
 * the tape flags (`held`, `armed`, `finished`) the verbs set. The SOLVE is
 * real (the in-place service over the vanilla map); the drain replays the
 * plan's own expected rows. The live witness is
 * `scripts/procgen/probe-seedling-wasm-playback.mjs`.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createWasmPlayback } from './seedlingWasmPlayback.js';
import { createInPlaceSolveService } from '../seedlingDemo/jsRuntimeSolver.js';
import { indexLevels } from '../seedlingDemo/atlasSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const RECORDED = readJson('frontend/modules/seedlingDemo/fixtures/wasm-arrival-p4e.json').arrivals;
const RECORDS = indexLevels(readJson('frontend/modules/flashPanel/atlases/seedling-map.json'));
const HOUSE = 86;
const byLabel = (prefix, level) => RECORDED.find((a) => a.label.startsWith(prefix) && a.status.level === level);
const A = byLabel('A ', HOUSE);
const C = byLabel('C ', HOUSE);
const CHEST = { kind: 'location', level: HOUSE, tag: 0, entityType: 'chest', name: 'Starting House - Chest' };
const DOOR = { kind: 'exit', level: HOUSE, tiles: [[3, 4]], name: 'exit_S' };

/** Manual timers: `run()` drains what is due, in order. */
function manualTimers() {
    let q = [];
    let id = 0;
    return {
        setTimeout(fn, ms) { q.push({ id: ++id, fn, ms }); return id; },
        clearTimeout(h) { q = q.filter((t) => t.id !== h); },
        run(max = 5000) {
            let n = 0;
            while (q.length && n < max) { const t = q.shift(); t.fn(); n += 1; }
            return n;
        },
        get pending() { return q.length; },
    };
}

/** A game whose reads are a recorded arrival's. */
function fakeGame(arrival, { gameTimeSkew = 0, freezeLatchesAfter = 0 } = {}) {
    const baseline = { ...arrival.seam.beginEntry, 'save.time': arrival.seam.beginEntry['save.time'] - 100, 'rng.gameplay': 1 };
    const g = {
        be: baseline,
        held: false, armed: false, finished: false, seq: 0, tape: null, drainRows: null, freezePolls: 0,
        calls: [], tapes: [],
        land() { g.be = arrival.seam.beginEntry; },
        botSeam() { g.calls.push('botSeam'); return JSON.stringify({ beginEntry: g.be, latched: false }); },
        botStatus() {
            g.calls.push('botStatus');
            if (g.armed && g.tape?.tick_count === 0 && ++g.freezePolls > freezeLatchesAfter) {
                g.armed = false; g.finished = true; g.held = !!g.tape.hold;
            }
            return JSON.stringify({ ...arrival.status, game_time: arrival.status.game_time + gameTimeSkew,
                held: g.held, armed: g.armed, finished: g.finished, error: '' });
        },
        readState() { return JSON.stringify({ ...arrival.state, pendingCheck: g.seq ? `${g.seq}|86|0|0` : '' }); },
        botLoadTape(json) { g.calls.push('botLoadTape'); g.tape = JSON.parse(json); g.tapes.push(g.tape); return 'ok'; },
        botStart() {
            g.calls.push('botStart');
            g.seq += g.tape.persistence.length;
            g.held = false;
            if (g.tape.tick_count === 0) {
                if (freezeLatchesAfter > 0) { g.armed = true; g.finished = false; } else { g.armed = false; g.finished = true; g.held = !!g.tape.hold; }
            } else { g.armed = true; g.finished = false; }
            return 'ok';
        },
        botReset() { g.calls.push('botReset'); g.held = false; g.armed = false; return 'ok'; },
        botDrain() {
            g.calls.push('botDrain');
            if (!g.armed || !g.drainRows) return JSON.stringify({ ticks: [] });
            const ticks = g.drainRows;
            g.drainRows = null;
            g.armed = false; g.finished = true;
            return JSON.stringify({ ticks, transitions: [] });
        },
    };
    return g;
}

/** An in-place solve service that hands the fake game the plan's rows to drain. */
function capturingService(game) {
    const inner = createInPlaceSolveService();
    const seen = [];
    return {
        seen,
        start(request) {
            const h = inner.start(request);
            seen.push({ request, result: h.result });
            if (h.result.ok) game.drainRows = h.result.plan.expected.map((r, t) => ({ t, level: r.level, x: r.x, y: r.y }));
            return { ...h, startedAt: 0 };
        },
        warm() {}, dispose() {},
    };
}

function engineOver(arrival, opts = {}) {
    const game = fakeGame(arrival, opts.game);
    const timers = manualTimers();
    const teleports = [];
    const windows = [];
    const notes = [];
    const failures = [];
    const dones = [];
    const service = capturingService(game);
    let t = 0;
    const engine = createWasmPlayback({
        getGame: () => game,
        teleport: (p) => { teleports.push(p); if (opts.land !== false) game.land(); return true; },
        getCheckBinding: () => ({ ignoreHostStart: (w) => { windows.push(w); return true; } }),
        records: RECORDS, solveService: service, timers, now: () => (t += 1),
        onNote: (n) => notes.push(n), onFailed: (r) => failures.push(r), onDone: (d) => dones.push(d),
    });
    return { engine, game, timers, teleports, windows, notes, failures, dones, service };
}

describe('the engine serves a goal at an arrival (fake game over the recorded reads, real solve)', () => {
    it('chest on a fresh room: forced re-arrival at the SPAWN → freeze (zero-tick, hold) → solve → plan tape (un-held) → drained → done', () => {
        const e = engineOver(A);
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'force-re-arrival' });
        expect(e.teleports).toEqual([{ level: HOUSE, x: A.state.playerPositionX, y: A.state.playerPositionY }]);
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.game.tapes.map((t) => [t.tick_count, t.hold ?? false, t.seam])).toEqual([[0, true, null],
            [e.service.seen[0].result.plan.solution.length, false, null]]);
        expect(e.service.seen[0].request.scratchPersistence).toBe(true);
        expect(e.service.seen[0].result.plan.verbs).toEqual(['chest', 'walk']);
        expect(e.dones).toHaveLength(1);
        expect(e.dones[0].divergence).toBeNull();
        expect(e.dones[0].drained).toBe(e.dones[0].ticks + 1);
        expect(e.engine.stats.hostStarts.map((h) => h.label)).toEqual(['freeze', 'plan']);
        expect(e.notes.at(-1)).toBeNull();
    });

    it('door after the chest (C): both tapes re-declare the earned chest; each botStart\'s window goes to the binding', () => {
        const e = engineOver(C);
        e.engine.walkTo(DOOR);
        e.timers.run();
        expect(e.failures).toEqual([]);
        for (const t of e.game.tapes) {
            expect(t.persistence.map(({ level, tag }) => ({ level, tag }))).toEqual([{ level: HOUSE, tag: 0 }]);
            expect(t.save.seal_parts).toEqual([C.status.save.seal_parts[0]]);
        }
        expect(e.windows).toEqual([{ from: 0, to: 1 }, { from: 1, to: 2 }]);
        expect(e.dones[0].expectedEnd.level).not.toBe(HOUSE);
    });

    it('a solve that beats the fade waits for the freeze to LATCH before shipping (never botStart over an armed tape)', () => {
        const e = engineOver(A, { game: { freezeLatchesAfter: 3 } });
        e.engine.walkTo(DOOR);
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.game.calls.filter((c) => c === 'botStart')).toHaveLength(2);
        expect(e.game.freezePolls).toBeGreaterThan(3);
        expect(e.dones).toHaveLength(1);
    });
});

describe('the mid-room policy and the queue', () => {
    it('a goal while a plan tape plays is QUEUED, then served by its own forced re-arrival', () => {
        const e = engineOver(A);
        e.engine.walkTo(CHEST);
        // Run up to the plan's ship, then ask for the door while it plays.
        for (let i = 0; i < 400 && e.engine.status().phase !== 'playing'; i++) e.timers.run(1);
        expect(e.engine.status().phase).toBe('playing');
        expect(e.engine.walkTo(DOOR)).toEqual({ ok: true, action: 'queue' });
        expect(e.engine.status().queued).toEqual(DOOR);
        e.game.be = { ...e.game.be, 'save.time': 0 }; // the next forced arrival must CHANGE the begin record
        e.timers.run();
        expect(e.teleports).toHaveLength(2);
        expect(e.failures).toEqual([]);
    });

    it('a goal in ANOTHER room waits for the crossing; no arrival within the window → failed by name', () => {
        const e = engineOver(A);
        e.game.readState = () => JSON.stringify({ ...A.state, level: 0 });
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'await-arrival' });
        expect(e.teleports).toEqual([]);
        e.timers.run(100000);
        expect(e.failures[0]).toMatch(/no arrival in level 86 within 15 s/);
    });
});

describe('named refusals and failures', () => {
    it('LEVEL 0 is refused synchronously, before anything moves (moonrock)', () => {
        const e = engineOver(A);
        const r = e.engine.walkTo({ kind: 'exit', level: 0, tiles: [[1, 1]], name: 'x' });
        expect(r.ok).toBe(false);
        expect(r.reason).toMatch(/level 0 holds a moonrock/);
        expect(e.teleports).toEqual([]);
        expect(e.game.calls).not.toContain('botStart');
    });

    it('an arrival read AFTER a stepped tick is not staged (game_time ≠ the begin record\'s save.time)', () => {
        const e = engineOver(A, { game: { gameTimeSkew: 1 } });
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.failures[0]).toMatch(/read after a stepped tick/);
        expect(e.game.calls).not.toContain('botStart');
    });

    it('the solver\'s refusal (C: the chest is already open) RELEASES the freeze (botReset) and fails by name', () => {
        const e = engineOver(C);
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.failures[0]).toMatch(/the solver declined Starting House - Chest in level 86 \(refusal\)/);
        expect(e.game.calls.filter((c) => c === 'botStart')).toHaveLength(1);
        expect(e.game.calls).toContain('botReset');
    });

    it('stop() mid-play releases our tape (botReset) and records the leg as stopped with what drained', () => {
        const e = engineOver(A);
        e.engine.walkTo(DOOR);
        for (let i = 0; i < 400 && e.engine.status().phase !== 'playing'; i++) e.timers.run(1);
        e.engine.stop();
        expect(e.game.calls.at(-1)).toBe('botReset');
        const h = e.engine.stats.history.at(-1);
        expect(h.outcome).toBe('stopped');
        expect(h.phase).toBe('playing');
        expect(h.drained).toBe(h.ticks + 1);
        expect(e.engine.status().phase).toBe('idle');
    });
});
