/**
 * seedlingWasmPlayback — solver-walk W2: the ENGINE behind the controller's
 * wasm branch.
 *
 * The game is a FAKE whose reads are W1's RECORDED arrivals
 * (`seedlingDemo/fixtures/wasm-arrival-p4f.json`): `botSeam` answers the
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

import { ADOPT_WAIT_MS, createWasmPlayback, loadWasmPlaybackEngine } from './seedlingWasmPlayback.js';
import { SOLVE_RETRY_BUDGET_FACTOR, TUTORIAL_FADE_FRAMES } from '../seedlingDemo/wasmPlayback.js';
import { ANYTIME_PASSES, SOLVER_BUDGET_WORK, SOLVER_UPGRADE_WINDOW_WORK } from '../seedlingDemo/jsRuntimeSolver.js';
import { indexLevels } from '../seedlingDemo/atlasSource.js';
import { createInPlaceProduceService, mountedRecordsOf } from '../seedlingDemo/wasmWalkTape.js';
import { assembleGeneratedSeedlingSet } from '../seedlingDemo/seedlingGeneratedSet.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const RECORDED = readJson('frontend/modules/seedlingDemo/fixtures/wasm-arrival-p4f.json').arrivals;
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
function fakeGame(arrival, { gameTimeSkew = 0, freezeLatchesAfter = 0, stallDrains = 0, clearedAfterDrain = null,
    midSpanOnFirstPlan = null, unwatched = null, realSeam = false } = {}) {
    const baseline = { ...arrival.seam.beginEntry, 'save.time': arrival.seam.beginEntry['save.time'] - 100, 'rng.gameplay': 1 };
    const g = {
        // ⛓ W8 — `unwatched`: the room ran since ITS begin record before the bot drove (the cold start),
        // `{elapsed, mobiles, patch, begin}` = game frames since that begin, the botMobiles rows, botStatus overrides.
        be: unwatched ? { ...arrival.seam.beginEntry, ...(unwatched.begin ?? {}) } : baseline,
        unwatched,
        get be0() { return { ...arrival.seam.beginEntry, ...(unwatched?.begin ?? {}) }; },
        botMobiles() { g.calls.push('botMobiles'); return unwatched ? JSON.stringify({ tick: 0, mobiles: unwatched.mobiles, pods: [] }) : undefined; },
        held: false, armed: false, finished: false, seq: 0, tape: null, drainRows: null, freezePolls: 0,
        calls: [], tapes: [], stalls: stallDrains, cleared: null,
        land() { g.be = arrival.seam.beginEntry; },
        botSeam() { g.calls.push('botSeam'); return JSON.stringify({ beginEntry: g.be, latched: false }); },
        botStatus() {
            g.calls.push('botStatus');
            // ⛓ W8c — an unwatched room may script itself read by read (the new game's ceremony)
            if (g.unwatched?.tick) g.unwatched.tick(g.unwatched);
            if (g.armed && g.tape?.tick_count === 0 && ++g.freezePolls > freezeLatchesAfter) {
                g.armed = false; g.finished = true; g.held = !!g.tape.hold;
            }
            return JSON.stringify({ ...arrival.status,
                // ⛓ W7 — `gameTimeFromBegin`: the read is in the begin record's own frame (a staged arrival), whichever lands
                game_time: (g.unwatched ? (g.be ?? g.be0)['save.time'] + g.unwatched.elapsed : g.gameTimeFromBegin ? g.be['save.time'] : arrival.status.game_time) + gameTimeSkew,
                ...(g.unwatched?.patch ?? {}),
                ...(g.cleared ? { persistence_cleared: g.cleared } : {}),
                ...(g.midSpan ? g.midSpan : {}),
                // ⛓ W7 — where the last drained row left the player (a held end is read against the shadow)
                ...(g.pos ? { level: g.pos.level, x: g.pos.x, y: g.pos.y } : {}),
                held: g.held, armed: g.armed, finished: g.finished, error: '' });
        },
        // ⛓ W8c — `freezeObjects` (games/seedling.json): false unless the unwatched room says otherwise
        readState() { return JSON.stringify({ freezeObjects: false, ...arrival.state, ...(g.unwatched?.state ?? {}), pendingCheck: g.seq ? `${g.seq}|86|0|0` : '' }); },
        // ⛓ W8c — the active set's start level (the new-game arm resolves a −1 begin record to it)
        botLevelSet() { return JSON.stringify({ start_level: g.unwatched?.startLevel ?? 0 }); },
        // ⛓ §5.19 — `realSeam`: as the game does, a tape load CLEARS the begin record and a reset leaves it alone.
        botLoadTape(json) { g.calls.push('botLoadTape'); g.tape = JSON.parse(json); g.tapes.push(g.tape); if (realSeam) g.be = null; return 'ok'; },
        botStart() {
            g.calls.push('botStart');
            g.seq += g.tape.persistence.length;
            g.held = false;
            if (g.tape.tick_count === 0) {
                if (freezeLatchesAfter > 0) { g.armed = true; g.finished = false; } else { g.armed = false; g.finished = true; g.held = !!g.tape.hold; }
            } else { g.armed = true; g.finished = false; }
            return 'ok';
        },
        // A reset forgets the tape; the room the recovery re-enters is a NEW begin record (the fake
        // un-lands to the pre-arrival one, so the forced re-arrival's landing is a change again).
        botReset() { g.calls.push('botReset'); g.held = false; g.armed = false; g.midSpan = null; if (!realSeam) g.be = baseline; g.pos = null; return 'ok'; },
        botDrain() {
            g.calls.push('botDrain');
            if (!g.armed || !g.drainRows) return JSON.stringify({ ticks: [] });
            // A SealController-class freeze: the armed tape counts dead frames, so NO rows drain.
            if (g.stalls > 0) { g.stalls -= 1; return JSON.stringify({ ticks: [] }); }
            const ticks = g.drainRows;
            g.drainRows = null;
            if (clearedAfterDrain) g.cleared = clearedAfterDrain;
            // The first plan still mid-span when its rows drain (the W3 key-release row): armed, at `tick`.
            if (midSpanOnFirstPlan && g.tapes.length === 2) { g.midSpan = midSpanOnFirstPlan; return JSON.stringify({ ticks, transitions: [] }); }
            // ⛓ W7 — a tape declared `hold` latches HELD at its finish, the player where its last row is.
            g.armed = false; g.finished = true; g.held = !!g.tape.hold; g.pos = ticks.at(-1) ?? g.pos;
            return JSON.stringify({ ticks, transitions: [] });
        },
    };
    return g;
}

/**
 * An in-place solve service that hands the fake game the plan's rows to drain —
 * through `perturb(rows, attempt)` (attempt 0 = the first solve), the W3
 * divergence injector.
 */
function capturingService(game, perturb = (rows) => rows, editPlan = null) {
    // ⛓ WG — the produce service: a solver request solves, a `producer: 'walker'` one walks.
    const inner = createInPlaceProduceService();
    const seen = [];
    return {
        seen,
        start(request) {
            const h = inner.start(request);
            if (h.result.ok && editPlan) h.result.plan = editPlan(h.result.plan);
            seen.push({ request, result: h.result });
            if (h.result.ok) {
                game.drainRows = perturb(h.result.plan.expected.map((r, t) => ({ t, level: r.level, x: r.x, y: r.y })),
                    seen.length - 1);
            }
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
    const failExtras = [];
    const dones = [];
    const service = capturingService(game, opts.perturb, opts.editPlan);
    let t = 0;
    const swap = { state: opts.swap ?? null };
    const engine = createWasmPlayback({
        getGame: () => game,
        getSwapState: opts.noGlue ? undefined : () => swap.state,
        getWin: () => opts.win ?? null,
        teleport: (p) => { teleports.push(p); if (opts.land !== false) game.land(); return true; },
        getCheckBinding: () => ({ ignoreHostStart: (w) => { windows.push(w); return true; } }),
        records: opts.records ?? RECORDS, generated: opts.generated ?? false, solveService: service, timers, now: opts.now ?? (() => (t += 1)),
        ...(opts.getBudgetWork ? { getBudgetWork: opts.getBudgetWork } : {}),
        ...(opts.getUpgradeWindowWork ? { getUpgradeWindowWork: opts.getUpgradeWindowWork } : {}),
        ...(opts.backstopMs ? { backstopMs: opts.backstopMs } : {}),
        onNote: (n) => notes.push(n), onFailed: (r, x) => { failures.push(r); failExtras.push(x ?? null); }, onDone: (d) => dones.push(d),
    });
    return { engine, game, timers, teleports, windows, notes, failures, failExtras, dones, service, swap };
}

describe('the engine serves a goal at an arrival (fake game over the recorded reads, real solve)', () => {
    it('chest on a fresh room: forced re-arrival at the SPAWN (the cold start) → freeze (zero-tick, hold) → solve → plan tape ⛓ W7 ending HELD → drained → done, the room held', () => {
        const e = engineOver(A);
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'force-re-arrival' });
        expect(e.teleports).toEqual([{ level: HOUSE, x: A.state.playerPositionX, y: A.state.playerPositionY }]);
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.game.tapes.map((t) => [t.tick_count, t.hold ?? false, t.seam])).toEqual([[0, true, null],
            [e.service.seen[0].result.plan.solution.length, true, null]]);
        expect(e.service.seen[0].request.scratchPersistence).toBe(true);
        expect(e.service.seen[0].result.plan.verbs).toEqual(['chest', 'walk']);
        expect(e.dones).toHaveLength(1);
        expect(e.dones[0].divergence).toBeNull();
        expect(e.dones[0].drained).toBe(e.dones[0].ticks + 1);
        expect(e.engine.stats.hostStarts.map((h) => h.label)).toEqual(['freeze', 'plan']);
        expect(e.notes.at(-1)).toBeNull();
        // ⛓ W7 — a location plan ends HELD: the room is the engine's, its recipe = the arrival + the plan's keys
        expect(e.dones[0].heldEnd).toBe(true);
        expect(e.engine.status()).toMatchObject({ phase: 'held', room: { level: HOUSE, shipped: e.dones[0].ticks, plans: 1 } });
        expect(e.engine.stats.forcedBy).toEqual({ 'cold-start': 1 });
        expect(e.game.held).toBe(true);
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
    it('a goal while a plan tape plays is QUEUED, then ⛓ W7 served as a CONTINUATION from the held end (no second teleport)', () => {
        const e = engineOver(A);
        e.engine.walkTo(CHEST);
        // Run up to the plan's ship, then ask for the door while it plays.
        for (let i = 0; i < 400 && e.engine.status().phase !== 'playing'; i++) e.timers.run(1);
        expect(e.engine.status().phase).toBe('playing');
        expect(e.engine.walkTo(DOOR)).toEqual({ ok: true, action: 'queue' });
        expect(e.engine.status().queued).toEqual(DOOR);
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.teleports).toHaveLength(1); // the cold start only
        const chest = e.service.seen[0].result.plan;
        const door = e.service.seen[1];
        expect(door.request.perTick).toHaveLength(chest.solution.length); // the chest's keys = the prefix
        expect(door.result.ok).toBe(true);
        expect(door.result.plan.prefixLength).toBe(chest.solution.length);
        expect(e.engine.stats).toMatchObject({ continuations: 1, forced: 1, forcedBy: { 'cold-start': 1 } });
        expect(e.engine.stats.heldChecks).toEqual([expect.objectContaining({ shipped: chest.solution.length, equal: true })]);
        expect(e.engine.stats.hostStarts.map((h) => h.label)).toEqual(['freeze', 'plan', 'continuation']);
        // the door's tape is UN-held (its crossing must reach the glue) and boots the same arrival
        expect(e.game.tapes.map((t) => [t.tick_count, t.hold ?? false, t.boot.level])).toEqual([[0, true, HOUSE],
            [chest.solution.length, true, HOUSE], [door.result.plan.solution.length, false, HOUSE]]);
        expect(e.dones.map((d) => [d.goal.name, d.continuation, d.prefix])).toEqual([[CHEST.name, false, 0], [DOOR.name, true, chest.solution.length]]);
        expect(e.dones[1].expectedEnd.level).not.toBe(HOUSE);
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
    it('⛓ W5 — LEVEL 0 is ACCEPTED (W1–W4 refused it for the moonrock): a goal there waits for its arrival', () => {
        const e = engineOver(A);
        const r = e.engine.walkTo({ kind: 'exit', level: 0, tiles: [[1, 1]], name: 'x' });
        expect(r.ok).toBe(true);
        expect(r.reason ?? '').not.toMatch(/moonrock/);
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

    it('⛓ WAVE-6 CONSUMER — a refusal carrying an `obstacle` (`arrival-inside-solid` + `wayOut`) fails WITH it, as data; one without carries none', () => {
        const OBSTACLE = { kind: 'arrival-inside-solid', id: 'breakablerock@288,176', solids: ['breakablerock@288,176'],
            at: { level: 0, x: 296, y: 184 }, wayOut: [{ kind: 'restart', via: 'seedlingStartSpawn', why: 'w' },
                { kind: 'another-route', level: 0, arrivals: [{ from: 2, door: 'stairs@48,16', at: { x: 264, y: 264 } }] }] };
        for (const obstacle of [OBSTACLE, null]) {
            const e = engineOver(A);
            e.service.start = (request) => {
                e.service.seen.push({ request });
                const result = { ok: false, kind: 'refusal', pass: 'dashless', message: 'solverBot(x): arrival-inside-solid — …',
                    ...(obstacle ? { obstacle } : {}),
                    passes: [{ pass: 'dashless', ok: false, kind: 'refusal', ticks: null }, { pass: 'full', ok: false, kind: 'skipped', ticks: null }] };
                return { settled: true, started: true, startedAt: 0, result, provisional: result, answered: 1, passes: result.passes, cancel() {} };
            };
            e.engine.walkTo(CHEST);
            runUntil(e, () => e.failures.length > 0, 20000);
            expect(e.failures[0]).toMatch(/the solver declined Starting House - Chest in level 86 \(refusal\): solverBot\(x\): arrival-inside-solid/);
            expect(e.failExtras[0]).toEqual(obstacle ? { obstacle } : null);
            expect(e.engine.stats.history.at(-1).obstacle ?? null).toEqual(obstacle);
        }
    });

    it('⛓ WAVE-6 CONSUMER — the plan\'s new optional fields pass through: verbs `pulse`/`brave`, `fineLatticeWalks`, an `axe-dodge` deadline', () => {
        const e = engineOver(A, { editPlan: (plan) => ({ ...plan, verbs: [...plan.verbs, 'brave', 'pulse'].sort(),
            fineLatticeWalks: [{ tick: 0, what: 'walk', aim: { x: 1, y: 1 }, waypoints: [], refused: 'r' }],
            deadline: { tripped: true, first: 'axe-dodge', sites: { 'axe-dodge': 1 } } }) });
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.dones).toHaveLength(1);
        expect(e.notes.some((n) => /\(brave,chest,pulse,walk; dashless pass\)/.test(n ?? ''))).toBe(true);
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

/** W3's injector: from tick `at` on, the game stands `dx` px right of the plan (a key the tape never pressed). */
const pushRight = (at = 5, dx = 2) => (rows) => rows.map((r) => (r.t >= at ? { ...r, x: r.x + dx } : r));

describe('W3 — a divergence: botReset + forced re-arrival + re-solve, bounded, then FAILED by name', () => {
    it('ONE injected divergence recovers: the leg is recorded diverged, the room re-entered at the arrival\'s spawn, re-solved, done', () => {
        const e = engineOver(A, { perturb: (rows, attempt) => (attempt === 0 ? pushRight()(rows) : rows) });
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.dones).toHaveLength(1);
        expect(e.dones[0].recoveries).toBe(1);
        expect(e.dones[0].divergence).toBeNull(); // the recovered tape played on plan
        const spawnAt = { level: HOUSE, x: A.state.playerPositionX, y: A.state.playerPositionY };
        expect(e.teleports).toEqual([spawnAt, spawnAt]);
        expect(e.service.seen).toHaveLength(2);
        const h = e.engine.stats.history;
        expect(h.map((x) => x.outcome)).toEqual(['diverged', 'done']);
        expect(h[0].divergence).toMatchObject({ t: 5, got: { x: h[0].divergence.expected.x + 2 } });
        expect(e.engine.stats).toMatchObject({ divergences: 1, recoveries: 1, forced: 2, solves: 2, ships: 2 });
        // freeze + plan per attempt, every one bracketed; the diverged tape was RELEASED before the teleport
        expect(e.engine.stats.hostStarts.map((x) => x.label)).toEqual(['freeze', 'plan', 'freeze', 'plan']);
        const i = e.game.calls.indexOf('botReset');
        expect(i).toBeGreaterThan(e.game.calls.indexOf('botStart'));
        expect(e.notes.some((n) => /recovery 1\/3/.test(n ?? ''))).toBe(true);
    });

    it('a PERSISTENT divergence fails BY NAME after 3 recoveries (4 plans played), the tape released, nothing more started', () => {
        // ⛓ W4 — a NEW divergence each attempt (tick 5, 6, 7, 8): an exact repeat fails sooner (next row)
        const e = engineOver(A, { perturb: (rows, attempt) => pushRight(5 + attempt)(rows) });
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.dones).toEqual([]);
        expect(e.failures).toHaveLength(1);
        expect(e.failures[0]).toMatch(/the game left the plan 4 times on Starting House - Chest in level 86 \(gave up after 3 forced re-arrivals, the bound is 3\); last at tick 8/);
        expect(e.teleports).toHaveLength(4);
        expect(e.service.seen).toHaveLength(4);
        expect(e.engine.stats.history.map((x) => x.outcome)).toEqual(['diverged', 'diverged', 'diverged', 'failed']);
        expect(e.engine.stats.history.at(-1).recoveries).toBe(3);
        expect(e.game.calls.at(-1)).toBe('botReset');
        expect(e.engine.status().phase).toBe('idle');
        expect(e.timers.pending).toBe(0); // no silent wait left behind
    });

    it('⛓ W4 — an EXACT repeat (same tick, same game row) fails BY NAME after 2 plans (1 forced re-arrival), not 4', () => {
        const e = engineOver(A, { perturb: pushRight() });
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.dones).toEqual([]);
        expect(e.failures).toHaveLength(1);
        expect(e.failures[0]).toMatch(/^the game left the plan on Starting House - Chest in level 86 at the SAME tick with the SAME game row 2 times in a row \(gave up after 1 forced re-arrival: .*\); at tick 5: expected .*, game /);
        expect(e.teleports).toHaveLength(2);
        expect(e.service.seen).toHaveLength(2);
        expect(e.engine.stats.history.map((x) => x.outcome)).toEqual(['diverged', 'failed']);
        expect(e.engine.stats.history.at(-1).recoveries).toBe(1);
        expect(e.engine.stats).toMatchObject({ divergences: 2, recoveries: 1, forced: 2, ships: 2 });
        expect(e.game.calls.at(-1)).toBe('botReset');
        expect(e.engine.status().phase).toBe('idle');
        expect(e.timers.pending).toBe(0);
    });

    it('⛓ W4 — the repeat memory is PER GOAL: the next goal\'s first divergence (the same tick and row) recovers', () => {
        const e = engineOver(A, { perturb: (rows, attempt) => (attempt === 0 || attempt === 2 ? pushRight()(rows) : rows) });
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.dones).toHaveLength(1);
        e.engine.stop(); // ⛓ W7 — a paused bot hands the room back; the next goal is a cold start again
        e.game.be = { ...e.game.be, 'save.time': 0 };
        e.engine.walkTo(CHEST);
        e.timers.run();
        // goal 2's first plan (attempt 2) diverges exactly as goal 1's did — a recovery, not a repeat
        expect(e.engine.stats.history.map((x) => x.outcome)).toEqual(['diverged', 'done', 'diverged', 'done']);
    });

    it('the bound is PER GOAL: the next goal starts with a fresh count', () => {
        const e = engineOver(A, { perturb: (rows, attempt) => (attempt < 3 ? pushRight(5 + attempt)(rows) : rows) });
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.dones[0].recoveries).toBe(3); // 3 spent, the 4th plan on plan: done, not failed
        expect(e.failures).toEqual([]);
        e.game.be = { ...e.game.be, 'save.time': 0 };
        e.engine.walkTo(DOOR);
        expect(e.engine.status().recoveries).toBe(0);
    });

    it('a SealController-class FREEZE (no rows drain for a while) is NOT a divergence', () => {
        const e = engineOver(A, { game: { stallDrains: 40 } });
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.dones).toHaveLength(1);
        expect(e.engine.stats).toMatchObject({ divergences: 0, recoveries: 0, forced: 1 });
        expect(e.game.stalls).toBe(0);
    });

    it('a divergence AFTER the goal\'s clear landed ends the leg done (re-solving would meet "already open"), tape released', () => {
        const e = engineOver(A, { perturb: pushRight(), game: { clearedAfterDrain: [{ level: HOUSE, tag: 0 }] } });
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.dones).toHaveLength(1);
        expect(e.dones[0].divergence).toMatchObject({ t: 5 });
        expect(e.dones[0].recoveries).toBe(0);
        expect(e.teleports).toHaveLength(1);
        expect(e.game.calls.at(-1)).toBe('botReset');
    });

    it('a recovery RELEASES the keys the diverged plan held mid-span (keydown+keyup pairs on the canvas, right after botReset); a person\'s key is left alone', () => {
        const events = [];
        class KeyboardEvent { constructor(type, init) { Object.assign(this, init, { type }); } }
        let e = null;
        const canvas = { dispatchEvent: (ev) => { events.push({ type: ev.type, code: ev.code, after: e.game.calls.length }); return true; } };
        const win = { KeyboardEvent, document: { querySelector: (q) => (q === 'canvas' ? canvas : null) } };
        e = engineOver(A, { win, perturb: (rows, attempt) => (attempt === 0 ? pushRight()(rows) : rows),
            game: { midSpanOnFirstPlan: { tick: 10, input: { held: ['right', 'up'] } } } });
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.dones).toHaveLength(1);
        const plan = e.service.seen[0].result.plan.solution;
        expect([...plan[9]]).toContain('up'); // at tick 10 the tape holds solution[9]
        expect([...plan[9]]).not.toContain('right');
        expect(events.map((x) => `${x.type}:${x.code}`)).toEqual(['keydown:ArrowUp', 'keyup:ArrowUp']);
        expect(e.game.calls[events[0].after - 1]).toBe('botReset');
        expect(e.engine.stats.keyReleases).toEqual([['up']]);
    });
});

// ── ⛓ W7 — the room kept still between goals: held ends, continuations, the arrival hold ─────────

/** Run the manual timers in small slices until `pred()` (the arrival watch reschedules itself at 0 ms forever). */
/**
 * ⛓ ANYTIME / O2 → DETERMINISTIC BUDGET — script the engine's solves by attempt number (1-based), each a
 * worker's SETTLED answer (the cut is the answer's, never the clock's):
 *   `'cut'`                  every pass cut at the work budget (a ⏱ refusal, nothing answered);
 *   `{plan: 'dashless'}`     the dashless pass's REAL plan, the full pass cut at the budget;
 *   `{decline: <answer>}`    the dashless pass DECLINED (not cut), the full pass cut at the budget;
 *   `'hang'` / `{hang: 'dashless'}`  a worker that never answers (the dashless plan landed as provisional).
 * Anything else solves for real.
 */
const CUT_MSG = 'the block-route search hit `deadline` ⏱ DEADLINE: …';
const cutRow = (pass) => ({ pass, ok: false, kind: 'refusal', ticks: null, deadline: 'block-route', limit: 'budget' });
const cutAnswer = (pass) => ({ ok: false, kind: 'refusal', pass, message: CUT_MSG, deadline: { tripped: true, first: 'block-route', sites: { 'block-route': 1 } } });
function scriptSolves(e, script) {
    const inner = e.service.start;
    let n = 0;
    e.service.start = (request) => {
        n += 1;
        const step = script[n];
        if (!step) return inner(request);
        e.service.seen.push({ request, scripted: step });
        const names = (request.passes ?? ANYTIME_PASSES).map((p) => p.pass);
        const settle = (result, answered) => ({ settled: true, started: true, startedAt: 0, result, provisional: result, answered,
            passes: result.passes ?? [], cancel() {} });
        if (step === 'cut') return settle({ ...cutAnswer(names.at(-1)), passes: names.map(cutRow) }, 0);
        if (step.plan === 'dashless') {
            const r = inner({ ...request, passes: [ANYTIME_PASSES[0]] }).result;
            const passes = [...r.passes, cutRow('full')];
            return settle({ ...r, passes, plan: { ...r.plan, passes } }, 1);
        }
        if (step.decline) return settle({ ...step.decline, passes: [{ pass: 'dashless', ok: false, kind: 'refusal', ticks: null }, cutRow('full')] }, 1);
        const provisional = step.hang === 'dashless' ? inner({ ...request, passes: [ANYTIME_PASSES[0]] }).result : null;
        const h = { settled: false, started: true, startedAt: 0, result: null, provisional, answered: provisional ? 1 : 0, passes: [],
            cancel() { h.settled = true; h.cancelled = true; } };
        e.service.seen.at(-1).handle = h;
        return h;
    };
}

function runUntil(e, pred, max = 4000) {
    for (let i = 0; i < max && !pred(); i++) e.timers.run(1);
    return pred();
}
/** A service whose plans are edited per attempt (`edit(plan, attempt)`), over the capturing one. */
function editingService(game, edit) {
    const inner = capturingService(game);
    return {
        seen: inner.seen,
        start(request) {
            const h = inner.start(request);
            if (h.result.ok) edit(h.result.plan, inner.seen.length - 1);
            return h;
        },
        warm() {}, dispose() {},
    };
}

describe('⛓ ANYTIME / O2 / O3 → DETERMINISTIC BUDGET — a solve cut at its WORK budget: the earlier plan, the held retry, the knob, the backstop', () => {
    const R = SOLVER_BUDGET_WORK * SOLVE_RETRY_BUDGET_FACTOR;
    it('a later pass CUT at the work budget leaves the earlier pass\'s PLAN, which PLAYS (no retry, no re-arrival): named by its pass, `expired`', () => {
        const e = engineOver(A);
        scriptSolves(e, { 1: { plan: 'dashless' } });
        e.engine.walkTo(CHEST);
        runUntil(e, () => e.dones.length === 1 || e.failures.length > 0, 20000);
        expect(e.failures).toEqual([]);
        expect(e.dones[0]).toMatchObject({ pass: 'dashless', expired: true, retries: 0, budgets: [SOLVER_BUDGET_WORK] });
        expect(e.engine.stats).toMatchObject({ expiries: 1, provisionalPlays: 1, retries: 0, backstops: 0, passes: { dashless: 1 } });
        expect(e.engine.stats.hostStarts.map((h) => h.label)).toEqual(['freeze', 'plan']);
        expect(e.teleports).toHaveLength(1); // the cold start only
        expect(e.engine.stats.history.at(-1)).toMatchObject({ outcome: 'done', pass: 'dashless', expired: true });
        expect(e.dones[0].passes.map((r) => [r.pass, r.limit ?? null])).toEqual([['dashless', null], ['full', 'budget']]);
    });

    it('a solve that answers within its budget is named by the pass that won (the house, no sword: dashless; full SKIPPED)', () => {
        const e = engineOver(A);
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.dones[0]).toMatchObject({ pass: 'dashless', expired: false, retries: 0 });
        expect(e.dones[0].passes.map((r) => [r.pass, r.kind])).toEqual([['dashless', null], ['full', 'skipped']]);
        expect(e.notes.some((n) => /\(chest,walk; dashless pass\)/.test(n ?? ''))).toBe(true);
    });

    it(`every pass cut, nothing answered → a HELD RETRY at ${SOLVE_RETRY_BUDGET_FACTOR}× the units (no botReset, no teleport: the freeze still holds the room), and its plan plays`, () => {
        const e = engineOver(A);
        scriptSolves(e, { 1: 'cut' });
        e.engine.walkTo(CHEST);
        runUntil(e, () => e.dones.length === 1 || e.failures.length > 0, 80000);
        expect(e.failures).toEqual([]);
        expect(e.dones[0]).toMatchObject({ pass: 'dashless', expired: false, retries: 1, budgets: [SOLVER_BUDGET_WORK, R] });
        expect(e.engine.stats).toMatchObject({ expiries: 1, retries: 1, provisionalPlays: 0, backstops: 0 });
        expect(e.game.calls).not.toContain('botReset');
        expect(e.teleports).toHaveLength(1);
        expect(e.engine.stats.hostStarts.map((h) => h.label)).toEqual(['freeze', 'plan']);
        // nothing had answered: the retry runs every pass again, under the RETRY's units
        expect(e.service.seen[1].request.passes.map((p) => p.pass)).toEqual(['dashless', 'full']);
        expect(e.service.seen[1].request.budgetWork).toBe(R);
        expect(e.notes.some((n) => new RegExp(`solving again, the room held… \\(budget ${R} work units, retry 1\\)`).test(n ?? ''))).toBe(true);
    });

    it('the retry RESUMES at the first unanswered pass: a dashless DECLINE, full cut → the retry asks FULL only', () => {
        const e = engineOver(A);
        const declined = { ok: false, kind: 'refusal', pass: 'dashless', message: 'no corridor (dashless)' };
        scriptSolves(e, { 1: { decline: declined } });
        e.engine.walkTo(CHEST);
        runUntil(e, () => e.dones.length === 1 || e.failures.length > 0, 80000);
        expect(e.service.seen[1].request.passes.map((p) => p.pass)).toEqual(['full']);
        // the house holds no sword: the full pass is skipped, so the dashless decline is the answer — said, by name
        expect(e.failures[0]).toMatch(/the solver declined Starting House - Chest in level 86 \(refusal\): no corridor \(dashless\)/);
    });

    it('the retry is cut too → the walk ends BY NAME with both work budgets; the room is released', () => {
        const e = engineOver(A);
        scriptSolves(e, { 1: 'cut', 2: 'cut' });
        e.engine.walkTo(CHEST);
        runUntil(e, () => e.failures.length > 0, 80000);
        expect(e.failures).toEqual([`the solver ran out of ${SOLVER_BUDGET_WORK}, then ${R} work units on its held retry on location in level 86: ${CUT_MSG}`]);
        expect(e.engine.stats).toMatchObject({ expiries: 2, retries: 1, backstops: 0 });
        expect(e.game.calls).toContain('botReset');
        expect(e.engine.status().phase).toBe('idle');
    });

    it('…and a pass that DECLINED (not cut) leads the failure: the decline, not the budget', () => {
        const e = engineOver(A);
        const declined = { ok: false, kind: 'refusal', pass: 'dashless', message: 'combat ladder exhausted' };
        scriptSolves(e, { 1: { decline: declined }, 2: 'cut' });
        e.engine.walkTo(CHEST);
        runUntil(e, () => e.failures.length > 0, 80000);
        expect(e.failures[0]).toBe('the solver declined Starting House - Chest in level 86 (pass dashless): combat ladder exhausted '
            + `— and the solver ran out of ${SOLVER_BUDGET_WORK}, then ${R} work units on its held retry on location in level 86`);
    });

    it('⛓ O3 — the knob (`getBudgetWork`, the setting) is the budget: read at each solve, shown, and what is cut', () => {
        let knob = 30;
        const e = engineOver(A, { getBudgetWork: () => knob });
        expect(e.engine.budgetWork).toBe(30);
        scriptSolves(e, { 1: 'cut', 2: 'cut' });
        e.engine.walkTo(CHEST);
        runUntil(e, () => e.failures.length > 0, 20000);
        expect(e.failures[0]).toMatch(new RegExp(`^the solver ran out of 30, then ${30 * SOLVE_RETRY_BUDGET_FACTOR} work units on its held retry`));
        expect(e.service.seen.map((x) => x.request.budgetWork)).toEqual([30, 30 * SOLVE_RETRY_BUDGET_FACTOR]);
        expect(e.notes.some((n) => /solving… \(budget 30 work units\)/.test(n ?? ''))).toBe(true);
        knob = null; // unset → the engine's own budget, which setBudgetWork moves
        expect(e.engine.budgetWork).toBe(SOLVER_BUDGET_WORK);
        e.engine.setBudgetWork(800);
        expect(e.engine.budgetWork).toBe(800);
        knob = 'junk';
        expect(e.engine.budgetWork).toBe(800);
    });

    it('every solver request carries its WORK budget and upgrade window (no ms); the retry carries the factor, and a dashless refusal CUT by its deadline (not answered) runs again', () => {
        let windowKnob = 25;
        const e = engineOver(A, { getUpgradeWindowWork: () => windowKnob });
        expect(e.engine.upgradeWindowWork).toBe(25);
        scriptSolves(e, { 1: 'cut', 2: 'cut' });
        e.engine.walkTo(CHEST);
        runUntil(e, () => e.failures.length > 0, 80000);
        expect(e.service.seen[0].request).toMatchObject({ budgetWork: SOLVER_BUDGET_WORK, upgradeWindowWork: 25 });
        expect(e.service.seen[1].request).toMatchObject({ budgetWork: R, upgradeWindowWork: 25 });
        expect(e.service.seen[0].request.budgetMs).toBeUndefined();
        expect(e.service.seen[1].request.passes.map((p) => p.pass)).toEqual(['dashless', 'full']);
        windowKnob = 0; // 0: the whole budget
        expect(e.engine.upgradeWindowWork).toBeNull();
        windowKnob = null; // unset: the engine's own window
        expect(e.engine.upgradeWindowWork).toBe(SOLVER_UPGRADE_WINDOW_WORK);
        const d = engineOver(A);
        d.engine.walkTo(CHEST);
        d.timers.run();
        expect(d.service.seen[0].request).toMatchObject({ budgetWork: SOLVER_BUDGET_WORK, upgradeWindowWork: SOLVER_UPGRADE_WINDOW_WORK });
    });

    it('⛔ the clock never retries: a worker that never answers gets ONE request, then the BACKSTOP\'s named failure', () => {
        const e = engineOver(A, { backstopMs: 5000 });
        scriptSolves(e, { 1: 'hang' });
        e.engine.walkTo(CHEST);
        runUntil(e, () => e.failures.length > 0, 80000);
        expect(e.service.seen).toHaveLength(1);
        expect(e.failures).toEqual([`the solve exceeded the backstop on this machine (5 s) on location in level 86 (terminated; the solve's own budget is ${SOLVER_BUDGET_WORK} work units)`]);
        expect(e.engine.stats).toMatchObject({ backstops: 1, retries: 0, expiries: 0 });
        expect(e.service.seen[0].handle.cancelled).toBe(true);
        expect(e.game.calls).toContain('botReset');
    });

    it('⛔ the BACKSTOP never plays the plan in hand: a provisional dashless plan + a worker that never settles → failed by name, no plan tape', () => {
        const e = engineOver(A, { backstopMs: 5000 });
        scriptSolves(e, { 1: { hang: 'dashless' } });
        e.engine.walkTo(CHEST);
        runUntil(e, () => e.failures.length > 0 || e.dones.length > 0, 80000);
        expect(e.dones).toEqual([]);
        expect(e.failures[0]).toMatch(/^the solve exceeded the backstop on this machine/);
        expect(e.engine.stats).toMatchObject({ backstops: 1, provisionalPlays: 0 });
        expect(e.engine.stats.hostStarts.map((h) => h.label)).toEqual(['freeze']);
    });
    it('⛓ SHOULD-STOP — a plan whose pass tripped its deadline is named: the done row\'s `deadline`, the pass row, the playing note', () => {
        const deadline = { tripped: true, first: 'sword-dash', sites: { 'sword-dash': 1 } };
        const e = engineOver(A, { editPlan: (plan) => ({ ...plan, deadline,
            passes: [{ pass: 'dashless', ok: true, kind: null }, { pass: 'full', ok: true, kind: null, deadline: 'sword-dash' }] }) });
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.dones[0]).toMatchObject({ pass: 'dashless', deadline });
        expect(e.dones[0].passes[1]).toEqual({ pass: 'full', ok: true, kind: null, deadline: 'sword-dash' });
        expect(e.notes.some((n) => /; dashless pass; full stopped at its deadline \(sword-dash\)\)/.test(n ?? ''))).toBe(true);
    });
});

describe('W7 — continuations from a held room, and their named fallbacks', () => {
    it('the X-SPLIT rule: the chest plan ends holding X, the door\'s continuation opens on X → NOT shipped; a forced re-arrival (x-split) serves it', () => {
        const e = engineOver(A);
        const svc = editingService(e.game, (plan, attempt) => {
            if (attempt === 0) plan.solution[plan.solution.length - 1].add('primary');
            if (attempt === 1) plan.solution[0].add('primary');
        });
        e.service.start = svc.start;
        e.service.seen = svc.seen;
        e.engine.walkTo(CHEST);
        runUntil(e, () => e.engine.status().phase === 'held');
        e.engine.walkTo(DOOR);
        runUntil(e, () => e.dones.length === 2 || e.failures.length > 0);
        expect(e.failures).toEqual([]);
        expect(e.engine.stats.fallbacks.map((f) => f.kind)).toEqual(['x-split']);
        expect(e.engine.stats.fallbacks[0].why).toMatch(/X-split rule/);
        expect(e.engine.stats.forcedBy).toEqual({ 'cold-start': 1, 'x-split': 1 });
        // the refused continuation was never shipped: freeze, chest plan, (re-arrival) freeze, door plan
        expect(e.engine.stats.hostStarts.map((h) => h.label)).toEqual(['freeze', 'plan', 'freeze', 'plan']);
        expect(e.dones[1]).toMatchObject({ continuation: false });
    });

    it('a continuation the solver DECLINES falls back (named), never a failure: a 2nd chest goal in the held room (the model says "already open")', () => {
        const e = engineOver(A);
        e.engine.walkTo(CHEST);
        runUntil(e, () => e.engine.status().phase === 'held');
        e.engine.walkTo(CHEST);
        runUntil(e, () => e.dones.length === 2 || e.failures.length > 0);
        expect(e.failures).toEqual([]);
        expect(e.engine.stats.history.map((h) => [h.outcome, h.kind ?? null])).toEqual([['done', null], ['fallback', 'continuation-declined'], ['done', null]]);
        expect(e.engine.stats.fallbacks[0].why).toMatch(/declined .*\(refusal\)/);
        expect(e.engine.stats.forced).toBe(2);
    });

    it('a continuation CUT at its work budget — ⛓ O2 and on its held retry too — falls back (continuation-budget)', () => {
        const e = engineOver(A);
        scriptSolves(e, { 2: 'cut', 3: 'cut' });
        e.engine.walkTo(CHEST);
        runUntil(e, () => e.engine.status().phase === 'held');
        e.engine.walkTo(DOOR);
        runUntil(e, () => e.dones.length === 2 || e.failures.length > 0, 80000);
        expect(e.failures).toEqual([]);
        expect(e.engine.stats.fallbacks.map((f) => f.kind)).toEqual(['continuation-budget']);
        expect(e.engine.stats.fallbacks[0].why).toMatch(new RegExp(`ran out of ${SOLVER_BUDGET_WORK}, then ${SOLVER_BUDGET_WORK * SOLVE_RETRY_BUDGET_FACTOR} work units on its held retry`));
        expect(e.engine.stats.retries).toBe(1);
    });

    it('⛓ O2 — a continuation cut at its budget whose HELD RETRY answers is served by it: no fallback, the room never released', () => {
        const e = engineOver(A);
        scriptSolves(e, { 2: 'cut' });
        e.engine.walkTo(CHEST);
        runUntil(e, () => e.engine.status().phase === 'held');
        e.engine.walkTo(DOOR);
        runUntil(e, () => e.dones.length === 2 || e.failures.length > 0, 80000);
        expect(e.failures).toEqual([]);
        expect(e.engine.stats.fallbacks).toEqual([]);
        expect(e.dones[1]).toMatchObject({ continuation: true, retries: 1, budgets: [SOLVER_BUDGET_WORK, SOLVER_BUDGET_WORK * SOLVE_RETRY_BUDGET_FACTOR] });
        expect(e.teleports).toHaveLength(1); // the cold start only
    });

    it('a HELD game that is not the shadow is the STOP condition: named, logged, never solved past (shadow-mismatch → the fallback)', () => {
        const e = engineOver(A);
        e.engine.walkTo(CHEST);
        runUntil(e, () => e.engine.status().phase === 'held');
        e.game.pos = { ...e.game.pos, x: e.game.pos.x + 0.05 };
        e.engine.walkTo(DOOR);
        runUntil(e, () => e.dones.length === 2 || e.failures.length > 0);
        expect(e.engine.stats.heldChecks).toEqual([expect.objectContaining({ equal: false })]);
        expect(e.engine.stats.fallbacks.map((f) => f.kind)).toEqual(['shadow-mismatch']);
        expect(e.engine.stats.continuations).toBe(0); // nothing was solved from the bad staging
        expect(e.service.seen).toHaveLength(2); // chest at the cold start, door at the re-arrival
    });

    it('stop() RELEASES a held room (a held room ignores the keyboard): botReset, the room dropped, idle', () => {
        const e = engineOver(A);
        e.engine.walkTo(CHEST);
        runUntil(e, () => e.engine.status().phase === 'held');
        expect(e.game.held).toBe(true);
        e.engine.stop();
        expect(e.game.calls.at(-1)).toBe('botReset');
        expect(e.game.held).toBe(false);
        expect(e.engine.status()).toMatchObject({ phase: 'idle', room: null, driving: false });
        expect(e.timers.run()).toBe(0); // no guard left ticking
    });

    it('a swap the glue asks for WHILE a room is held (a raced redirect) is let through: released, the room dropped, watching', () => {
        const e = engineOver(A, { swap: { marks: [], queued: 0, pushedOn: null, pushes: 0 } });
        e.engine.walkTo(CHEST);
        runUntil(e, () => e.engine.status().phase === 'held');
        e.swap.state = { marks: [], queued: 1, pushedOn: null, pushes: 0 };
        runUntil(e, () => e.engine.stats.releasedForSwap > 0);
        expect(e.game.calls).toContain('botReset');
        expect(e.game.held).toBe(false);
        expect(e.engine.status()).toMatchObject({ room: null, arriving: true });
    });
});

describe('W7 — the arrival HOLD after an exit plan, and the glue query\'s three arms', () => {
    /**
     * A door plan from A (un-held), then the crossing: begin record B1 (the game's own door) lands with
     * `swapAtB1`, then the redirect's landing (A's begin again) with the glue clear. `gameTimeFromBegin`:
     * each begin record is read in its own frame, so only the glue query can refuse B1.
     */
    function crossing(swapAtB1) {
        const e = engineOver(A, { swap: { marks: [], queued: 0, pushedOn: null, pushes: 0 } });
        e.game.gameTimeFromBegin = true;
        e.engine.walkTo(DOOR);
        runUntil(e, () => e.dones.length === 1);
        expect(e.engine.status()).toMatchObject({ phase: 'idle', arriving: true, room: null });
        e.game.pos = null; // the crossing landed: the player stands at the new room's arrival
        const B1 = { ...A.seam.beginEntry, 'save.time': A.seam.beginEntry['save.time'] - 7 };
        e.swap.state = swapAtB1(B1);
        e.game.be = B1;
        e.timers.run(50);
        const atB1 = { blocked: [...e.engine.stats.holdBlocked], held: e.engine.stats.held };
        e.swap.state = { marks: [], queued: 0, pushedOn: B1, pushes: 1 };
        e.game.be = A.seam.beginEntry;
        runUntil(e, () => e.engine.status().phase === 'held');
        return { e, atB1 };
    }
    const heldAfter = ({ e, atB1 }) => {
        expect(atB1.held).toBe(1); // the cold start's arrival only — B1 was NOT held
        expect(e.engine.stats.held).toBe(2); // the redirect's landing WAS
        expect(e.engine.status()).toMatchObject({ phase: 'held', room: { level: HOUSE, shipped: 0 }, arriving: false });
        expect(e.engine.stats.hostStarts.map((h) => h.label)).toEqual(['freeze', 'plan', 'freeze']);
    };
    it('arm 1 — a binding MARK (bounce / cross-level arrival / external door / parked) refuses B1', () => {
        const r = crossing(() => ({ marks: ['arrival teleport to level 86'], queued: 0, pushedOn: null, pushes: 0 }));
        expect(r.atB1.blocked.map((b) => b.why)).toEqual([expect.stringMatching(/waits on a swap/)]);
        heldAfter(r);
    });
    it('arm 2 — a teleport QUEUED in the adapter refuses B1 (the measured case: the redirect pushed ~0.4 s after the door)', () => {
        const r = crossing(() => ({ marks: [], queued: 1, pushedOn: null, pushes: 0 }));
        expect(r.atB1.blocked.map((b) => b.why)).toEqual([expect.stringMatching(/queued for the game/)]);
        heldAfter(r);
    });
    it('arm 3 — a teleport PUSHED while B1 was live refuses B1 (its swap lands next)', () => {
        const r = crossing((B1) => ({ marks: [], queued: 0, pushedOn: { ...B1 }, pushes: 1 }));
        expect(r.atB1.blocked.map((b) => b.why)).toEqual([expect.stringMatching(/pushed to the game after this arrival/)]);
        heldAfter(r);
    });
    it('an engine built WITHOUT the glue query holds no arrival between goals (a redirect cannot be ruled out); its location end is still held', () => {
        const e = engineOver(A, { noGlue: true });
        e.game.gameTimeFromBegin = true;
        e.engine.walkTo(DOOR);
        runUntil(e, () => e.dones.length === 1);
        expect(e.engine.status()).toMatchObject({ phase: 'idle', arriving: false });
        e.game.pos = null;
        e.game.be = { ...A.seam.beginEntry, 'rng.gameplay': 3 };
        e.timers.run(200);
        expect(e.engine.stats.held).toBe(1); // the cold start only
        expect(e.timers.pending).toBe(0); // no watch running
        e.engine.walkTo(CHEST);
        runUntil(e, () => e.dones.length === 2);
        expect(e.dones[1].heldEnd).toBe(true);
    });
    it('a glue that answers NOTHING never lets an arrival be held between goals', () => {
        const r = (() => {
            const e = engineOver(A, { swap: { marks: [], queued: 0, pushedOn: null, pushes: 0 } });
            e.game.gameTimeFromBegin = true;
            e.engine.walkTo(DOOR);
            runUntil(e, () => e.dones.length === 1);
            e.game.pos = null;
            e.swap.state = null;
            e.game.be = { ...A.seam.beginEntry, 'rng.gameplay': 4 };
            e.timers.run(50);
            return e;
        })();
        expect(r.engine.stats.held).toBe(1);
        expect(r.engine.stats.holdBlocked.at(-1).why).toMatch(/answered no swap state/);
    });
    it('no redirect (the glue clear) → the door\'s own arrival IS held; the next goal there is solved from it with no teleport', () => {
        const e = engineOver(A, { swap: { marks: [], queued: 0, pushedOn: null, pushes: 0 } });
        e.game.gameTimeFromBegin = true;
        e.engine.walkTo(DOOR);
        runUntil(e, () => e.dones.length === 1);
        e.game.pos = null;
        e.game.be = JSON.parse(JSON.stringify(A.seam.beginEntry));
        e.game.be['rng.gameplay'] = 2; // a NEW record, read in its own frame
        runUntil(e, () => e.engine.status().phase === 'held');
        expect(e.engine.stats.held).toBe(2);
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'continue' });
        runUntil(e, () => e.dones.length === 2 || e.failures.length > 0);
        expect(e.failures).toEqual([]);
        expect(e.teleports).toHaveLength(1); // the cold start only
        expect(e.dones[1]).toMatchObject({ continuation: false, heldEnd: true });
    });
});

// ── ⛓ WG — GENERATED rooms: the mounted set is the level source, the J2 walker the producer ──────

const GEN_RECORDED = readJson('frontend/modules/seedlingDemo/fixtures/wasm-arrival-gen-p4f.json').arrivals;
const GEN_SET = assembleGeneratedSeedlingSet(readJson('frontend/presets/seedling_generated_room/AP_1/AP_1_rules.json'),
    { selfPlayer: 1 }).set;
const GEN_RECORDS = mountedRecordsOf(GEN_SET);
const [G_A0, G_B0, G_C1] = GEN_RECORDED;
const KEY_BLUE = { kind: 'location', level: 0, tag: 0, name: 'region_0_0__key_blue_pickup' };
const EXIT_0 = { kind: 'exit', level: 0, tile: [8, 1], name: 'exit_0' };
const PARK = { kind: 'exit', level: 1, tile: [6, 3], name: 'exit_1' };
const genEngine = (arrival, opts = {}) => engineOver(arrival, { ...opts, records: GEN_RECORDS, generated: true });

describe('WG — a GENERATED room (the recorded p4e arrivals on seedling_generated_room, the real walker producer)', () => {
    it('A0 the apitem: forced re-arrival → freeze → the WALKER\'s tape (220 ticks, from the mounted set) → shipped exact → drained → done', () => {
        const e = genEngine(G_A0);
        expect(e.engine.generated).toBe(true);
        expect(e.engine.walkTo(KEY_BLUE)).toEqual({ ok: true, action: 'force-re-arrival' });
        expect(e.teleports).toEqual([{ level: 0, x: G_A0.state.playerPositionX, y: G_A0.state.playerPositionY }]);
        e.timers.run();
        expect(e.failures).toEqual([]);
        const req = e.service.seen[0].request;
        expect(req).toMatchObject({ producer: 'walker', goal: KEY_BLUE, scratchPersistence: true });
        expect(req.source.records).toBe(GEN_RECORDS);
        expect(e.service.seen[0].result.plan).toMatchObject({ producer: 'walker', end: 'collected' });
        expect(e.game.tapes.map((t) => [t.tick_count, t.hold ?? false, t.seam, t.persistence.length])).toEqual([[0, true, null, 0],
            [220, false, null, 0]]);
        expect(e.dones).toHaveLength(1);
        expect(e.dones[0]).toMatchObject({ producer: 'walker', ticks: 220, divergence: null, recoveries: 0 });
        expect(e.engine.stats.hostStarts.map((h) => h.label)).toEqual(['freeze', 'plan']);
        expect(e.notes.some((n) => /walking a tape…/.test(n ?? ''))).toBe(true);
    });

    it('B0 the door after the apitem: both tapes re-declare the EARNED apitem clear {0,0} exactly; the walk crosses to room 1', () => {
        const e = genEngine(G_B0);
        e.engine.walkTo(EXIT_0);
        e.timers.run();
        expect(e.failures).toEqual([]);
        for (const t of e.game.tapes) expect(t.persistence.map(({ level, tag }) => ({ level, tag }))).toEqual([{ level: 0, tag: 0 }]);
        expect(e.windows).toEqual([{ from: 0, to: 1 }, { from: 1, to: 2 }]);
        expect(e.service.seen[0].result.plan.apItemClearsLifted).toEqual([{ level: 0, tag: 0 }]);
        expect(e.dones[0]).toMatchObject({ producer: 'walker', ticks: 7 });
        expect(e.dones[0].expectedEnd.level).toBe(1);
    });

    it('C1 room 1 (entered by the crossing): the parking door, a clear in ANOTHER level declared as the game holds it', () => {
        const e = genEngine(G_C1);
        e.engine.walkTo(PARK);
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.game.tapes.at(-1).boot.level).toBe(1);
        expect(e.dones[0].expectedEnd.level).toBe(2);
    });

    it('W3 on a walker tape: ONE divergence recovers (re-entered, re-walked, done); a PERSISTENT one fails by name after 3 (⛓ W4: an exact repeat after 1)', () => {
        const once = genEngine(G_A0, { perturb: (rows, attempt) => (attempt === 0 ? pushRight()(rows) : rows) });
        once.engine.walkTo(KEY_BLUE);
        once.timers.run();
        expect(once.failures).toEqual([]);
        expect(once.engine.stats.history.map((x) => [x.outcome, x.producer])).toEqual([['diverged', 'walker'], ['done', 'walker']]);
        expect(once.dones[0].recoveries).toBe(1);
        const always = genEngine(G_A0, { perturb: (rows, attempt) => pushRight(5 + attempt)(rows) });
        always.engine.walkTo(KEY_BLUE);
        always.timers.run();
        expect(always.failures).toHaveLength(1);
        expect(always.failures[0]).toMatch(/the game left the plan 4 times on region_0_0__key_blue_pickup in level 0 \(gave up after 3 forced re-arrivals, the bound is 3\)/);
        expect(always.timers.pending).toBe(0);
        // ⛓ W4 — the same divergence every time: an exact repeat, failed after 2 walks
        const same = genEngine(G_A0, { perturb: pushRight() });
        same.engine.walkTo(KEY_BLUE);
        same.timers.run();
        expect(same.failures).toHaveLength(1);
        expect(same.failures[0]).toMatch(/at the SAME tick with the SAME game row 2 times in a row/);
        expect(same.timers.pending).toBe(0);
    });

    it('a goal the walker cannot turn into a tape: the producer\'s refusal RELEASES the freeze and fails by name', () => {
        const e = genEngine(G_A0);
        e.engine.walkTo({ kind: 'location', level: 0, tag: 7, name: 'nowhere' });
        e.timers.run();
        expect(e.failures).toHaveLength(1);
        expect(e.failures[0]).toMatch(/^the walker producer declined nowhere in level 0 \(refusal\): .*no apitem with tag 7/);
        expect(e.game.calls.at(-1)).toBe('botReset');
        expect(e.game.tapes).toHaveLength(1); // the freeze only — no plan shipped
    });

    it('a level the mounted set does not hold is refused synchronously, naming the mounted set', () => {
        const e = genEngine(G_A0);
        expect(e.engine.walkTo({ kind: 'exit', level: 9, tile: [1, 1] })).toEqual({ ok: false,
            reason: 'the mounted generated set has no level 9 to solve' });
        expect(e.teleports).toEqual([]);
    });

    it('loadWasmPlaybackEngine({levelSet}) builds a GENERATED engine from the set — no map document is fetched', async () => {
        let fetched = 0;
        const engine = await loadWasmPlaybackEngine({ levelSet: GEN_SET, baseUrl: 'http://x/', fetchImpl: () => { fetched += 1; },
            getGame: () => null, teleport: () => false, solveService: createInPlaceProduceService() });
        expect(engine.generated).toBe(true);
        expect(fetched).toBe(0);
        engine.dispose();
    });
});

describe('⛓ W8 — the cold start ADOPTED as it stands (no re-arrival) exactly when the room is "its arrival + idle ticks"', () => {
    const PLAYER = { cls: 'Player', x: 56, y: 56, vx: 0, vy: 0, anim: 'down-stand' };
    const unwatched = (o = {}) => ({ elapsed: 200, mobiles: [PLAYER], patch: {}, ...o });
    const CLEAR = { marks: [], queued: 0, pushedOn: null, pushes: 0 };
    const adoptOver = (o = {}, opts = {}) => engineOver(A, { swap: CLEAR, ...opts, game: { unwatched: unwatched(o), ...(opts.game ?? {}) } });
    /** The refusal a mutated read earns: the named clause, and W2's cold-start re-arrival serves the goal. */
    function refusedBy(e, clause) {
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'force-re-arrival' });
        expect(e.engine.stats.adopted).toBe(0);
        expect(e.engine.stats.adoptRefused.map((r) => r.clause)).toEqual([clause]);
        expect(e.engine.stats.forcedBy).toEqual({ 'cold-start': 1 });
        expect(e.teleports).toHaveLength(1);
        expect(e.game.tapes).toEqual([]);
    }

    it('the house, unwatched, nobody touched it: ADOPTED — held where it stands, the chest solved as a continuation from "arrival + 1 idle tick", 0 teleports', () => {
        const e = adoptOver();
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'adopt' });
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.teleports).toEqual([]);
        expect(e.engine.stats).toMatchObject({ adopted: 1, forced: 0, forcedBy: {}, continuations: 1, held: 1, adoptRefused: [] });
        expect(e.engine.stats.hostStarts.map((h) => h.label)).toEqual(['adopt', 'continuation']);
        expect(e.game.tapes[0]).toMatchObject({ tick_count: 0, hold: true, seam: null });
        // The held check ran against the shadow after ONE idle tick, and matched.
        // …read only once the adoption's freeze LATCHED (W7's invariant: the held check reads a held game).
        expect(e.engine.stats.heldChecks).toEqual([expect.objectContaining({ shipped: 1, equal: true, held: true })]);
        expect(e.service.seen[0].request.perTick).toEqual([new Set()]);
        expect(e.service.seen[0].result.plan.verbs).toEqual(['chest', 'walk']);
        expect(e.dones).toHaveLength(1);
        expect(e.dones[0]).toMatchObject({ continuation: true, prefix: 1, divergence: null, heldEnd: true });
        expect(e.engine.status()).toMatchObject({ phase: 'held', room: { level: HOUSE, shipped: 1 + e.dones[0].ticks } });
    });

    /**
     * ⛓ §5.19 — a TRANSIENT clause (`ADOPT_TRANSIENT_CLAUSES`) WAITS, bounded: the goal answers `await-adoption`,
     * nothing is recorded or teleported while it waits, and only a clause that outlives `ADOPT_WAIT_MS` is recorded
     * and spends the cold-start re-arrival (named).
     */
    function waitedOutBy(e, clause) {
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'await-adoption' });
        expect(e.engine.status().phase).toBe('adopt-wait');
        expect(e.engine.stats.adoptRefused).toEqual([]);
        expect(e.teleports).toEqual([]);
        e.timers.run(20000);
        expect(e.engine.stats.adopted).toBe(0);
        expect(e.engine.stats.adoptRefused.map((r) => r.clause)).toEqual([clause]);
        expect(e.engine.stats.forcedBy).toEqual({ 'cold-start': 1 });
        expect(e.teleports).toHaveLength(1);
        expect(e.notes.some((n) => n?.includes(`waited ${ADOPT_WAIT_MS / 1000} s on "${clause}"`))).toBe(true);
    }
    it('clause BEGIN — the begin record names another level (a swap pending) and never lands → WAITED, then not adopted (named)', () => {
        waitedOutBy(adoptOver({ begin: { 'begin.level': 0 } }), 'begin');
    });
    it('clause TAPE — a tape is armed (the room is somebody\'s) → not adopted', () => {
        refusedBy(adoptOver({ patch: { arm: { pending: true, armed_at: -1 } } }), 'tape');
    });
    it('clause FADE — too few frames since the begin record, and the clock never moves → WAITED, then not adopted (named)', () => {
        waitedOutBy(adoptOver({ elapsed: 30 }), 'fade');
    });
    it('⛓ §5.19 — clause FADE is TRANSIENT: the measured skip-intro case (36 frames, needs > 48) WAITS for the fade, then ADOPTS — 0 forced, nothing refused', () => {
        const e = adoptOver({ elapsed: 36, tick: (w) => { w.elapsed += 4; } });
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'await-adoption' });
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.teleports).toEqual([]);
        expect(e.engine.stats).toMatchObject({ adopted: 1, forced: 0, forcedBy: {}, adoptRefused: [] });
        expect(e.engine.stats.hostStarts.map((h) => h.label)).toEqual(['adopt', 'continuation']);
        expect(e.dones).toHaveLength(1);
    });
    it('⛓ §5.19 — a PERMANENT clause refusing while a transient one is waited on is recorded AT ONCE (no wait-out)', () => {
        const e = adoptOver({ elapsed: 36, tick: (w) => { w.elapsed += 4; if (w.elapsed > 44) w.patch = { x: 57.5 }; } });
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'await-adoption' });
        e.timers.run(3);
        expect(e.engine.stats.adoptRefused.map((r) => r.clause)).toEqual(['position']);
        expect(e.engine.stats.forcedBy).toEqual({ 'cold-start': 1 });
    });
    it('⛓ §5.19 — the begin record OUR tape load cleared is read back: adopt, stop, adopt again — 0 forced (the vanilla-map D sequence)', () => {
        const e = adoptOver({}, { game: { realSeam: true } });
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'adopt' });
        expect(e.game.be).toBe(null); // the adoption's freeze tape cleared it, as the game's botLoadTape does
        e.engine.stop();
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'adopt' });
        expect(e.engine.stats).toMatchObject({ adopted: 2, forced: 0, forcedBy: {}, adoptRefused: [] });
    });
    it('⛓ §5.19 — …but not after a teleport was PUSHED since (its swap lands a new room): the begin clause waits for it', () => {
        const e = adoptOver({}, { game: { realSeam: true } });
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'adopt' });
        e.engine.stop();
        e.swap.state = { ...CLEAR, pushes: 1 };
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'await-adoption' });
        e.game.be = A.seam.beginEntry; // the pushed swap lands
        e.timers.run();
        expect(e.engine.stats).toMatchObject({ adopted: 2, forced: 0, adoptRefused: [] });
    });
    it('clause INVENTORY — the player has something to USE (hidden slash/wand state) → not adopted', () => {
        // (the sword held too: ⛓ SLOTS CONSUMER — the staging stages the slot array, and a slot without its item refuses `staging`)
        refusedBy(adoptOver({ patch: { inventory_slots: [0], items: { ...A.status.items, hasSword: true } } }), 'inventory');
    });
    it('clause PLAYER-STATE — i-frames still running → not adopted', () => {
        refusedBy(adoptOver({ patch: { hits_timer: 12 } }), 'player-state');
    });
    it('clause MOBILES — a Mobile besides the player → not adopted', () => {
        refusedBy(adoptOver({ mobiles: [PLAYER, { cls: 'Enemies::Bob', x: 10, y: 10, vx: 0, vy: 0, anim: 'stand' }] }), 'mobiles');
    });
    it('clause TIMED — a timed puzzlement in the room record (combat.PUZZLEMENT_HAZARDS) → not adopted', () => {
        const records = new Map(RECORDS);
        const house = RECORDS.get(HOUSE);
        records.set(HOUSE, { ...house, entities: [...house.entities, { type: 'spinningaxe', x: 80, y: 48 }] });
        refusedBy(adoptOver({}, { records }), 'timed');
    });
    it('clause VELOCITY — the player is still moving → not adopted', () => {
        refusedBy(adoptOver({ mobiles: [{ ...PLAYER, vx: 0.5 }] }), 'velocity');
    });
    it('clause POSITION — the player is not where the arrival\'s shadow stands → not adopted', () => {
        refusedBy(adoptOver({ patch: { x: 57.5 } }), 'position');
    });
    it('clause FACING — back on the spawn, v = 0, but turned (the measured right-then-left person) → not adopted', () => {
        refusedBy(adoptOver({ mobiles: [{ ...PLAYER, anim: 'side-stand' }] }), 'facing');
    });
    it('the GLUE has a redirect in flight → not adopted (as for a held arrival)', () => {
        refusedBy(adoptOver({}, { swap: { marks: [], queued: 1, pushedOn: null, pushes: 0 } }), 'glue');
    });
    it('the held check waits for the adoption\'s freeze to LATCH (a freeze still armed is polled, never checked against)', () => {
        const e = engineOver(A, { swap: CLEAR, game: { unwatched: unwatched(), freezeLatchesAfter: 3 } });
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'adopt' });
        expect(e.engine.status().phase).toBe('adopting');
        expect(e.engine.stats.heldChecks).toEqual([]);
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.engine.stats.heldChecks).toEqual([expect.objectContaining({ shipped: 1, equal: true, held: true })]);
        expect(e.dones).toHaveLength(1);
    });
    // ⛓ W8b — an admitted inert NPC (introchar) beside the house spawn: oel (64,48) → the entity at (72,56), 16 px from (56,56).
    const INTRO = { cls: 'NPCs::IntroCharacter', x: 72, y: 56, vx: 0, vy: 0, type: 'Solid', destroy: false, collidable: true, anim: '' };
    const withIntro = () => {
        const records = new Map(RECORDS);
        const house = RECORDS.get(HOUSE);
        records.set(HOUSE, { ...house, entities: [...house.entities, { type: 'introchar', x: 64, y: 48, attrs: { text: 'hello', tag: '-1' } }] });
        return records;
    };
    it('⛓ W8b — an admitted inert NPC whose talk circle holds the spawn: ADOPTED, the circle recorded, spent once the plan leaves it', () => {
        const e = adoptOver({ mobiles: [INTRO, PLAYER] }, { records: withIntro() });
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'adopt' });
        expect(e.engine.status().room).toMatchObject({ talkCircles: 1 });
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.engine.stats).toMatchObject({ adopted: 1, forced: 0, forcedBy: {}, adoptRefused: [], fallbacks: [] });
        expect(e.engine.status().room).toMatchObject({ talkCircles: 0 });
        // The adoption's reads are recorded like an arrival's (the staging, taken late).
        expect(e.engine.arrivalReads.map((r) => r.status.level)).toEqual([HOUSE]);
        expect(e.dones).toHaveLength(1);
        expect(e.service.seen[0].result.plan.solution.some((k) => new Set(k).has('primary'))).toBe(false);
    });
    it('⛓ W8b — …a plan that presses X before leaving that circle → the named adopt-talk fallback (a forced re-arrival), never shipped', () => {
        const e = adoptOver({ mobiles: [INTRO, PLAYER] }, { records: withIntro(),
            editPlan: (plan) => ({ ...plan, solution: plan.solution.map((k, i) => (i === 0 ? [...k, 'primary'] : k)) }) });
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'adopt' });
        for (let i = 0; i < 200 && !e.engine.stats.fallbacks.length; i++) e.timers.run(1);
        expect(e.engine.stats.fallbacks).toEqual([expect.objectContaining({ kind: 'adopt-talk', why: expect.stringMatching(/X \(primary\) at tick 0, .*talked/) })]);
        expect(e.engine.stats.forcedBy).toEqual({ 'adopt-talk': 1 });
        expect(e.game.tapes.map((t) => t.tick_count)).toEqual([0]); // the adoption's freeze only — the plan never shipped
    });
    it('an engine WITHOUT the glue query adopts nothing (W7\'s rule) — the cold start re-arrives, no clause recorded', () => {
        const e = adoptOver({}, { noGlue: true });
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'force-re-arrival' });
        expect(e.engine.stats).toMatchObject({ adopted: 0, adoptRefused: [], forcedBy: { 'cold-start': 1 } });
    });

    // ── ⛓ W8c — the new-game arm's cold start (`seedling_playthrough`, plan §5.15) ─────────────────────────
    /** A game window whose canvas hands each dispatched key event to `onKey`. */
    const fakeWin = (onKey) => {
        class KeyboardEvent { constructor(type, o) { Object.assign(this, o, { type }); } }
        const canvas = { dispatchEvent(ev) { onKey(ev); return true; } };
        return { KeyboardEvent, document: { querySelector: (q) => (q === 'canvas' ? canvas : null) } };
    };
    /**
     * The house standing in for the arm's room: begin.level −1, the set's start = the house; the cutscene runs for
     * `cutsceneReads` botStatus reads, then the tutorial's freeze holds until an arrow (unless `stubborn`); every
     * read is one frame (`Game.time` +1).
     */
    function newGameOver({ cutsceneReads = 4, stubborn = false, startLevel = HOUSE, endsCutscene = true, patchAfter = {}, opts = {} } = {}) {
        const keys = [];
        let reads = 0;
        const u = unwatched({ begin: { 'begin.level': -1 }, startLevel, state: { freezeObjects: true },
            patch: { cutscene: [true, false, false, false], receive_input: false },
            tick: (w) => {
                reads += 1;
                w.elapsed += 1;
                if (endsCutscene && reads === cutsceneReads) w.patch = { cutscene: [false, false, false, false], receive_input: true, ...patchAfter };
            } });
        const win = fakeWin((ev) => {
            keys.push([ev.type, ev.key]);
            if (!stubborn && ev.type === 'keydown' && ev.key === 'ArrowRight') u.state.freezeObjects = false;
        });
        const e = engineOver(A, { swap: CLEAR, win, ...opts, game: { unwatched: u } });
        return { ...e, keys, u };
    }

    it('⛓ W8c — the new game\'s room: the −1 record resolved, the cutscene WAITED OUT, the tutorial dismissed by ONE arrow pair, then ADOPTED — 0 teleports', () => {
        const e = newGameOver();
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'await-ceremony' });
        expect(e.engine.status().phase).toBe('ceremony');
        e.timers.run();
        expect(e.failures).toEqual([]);
        expect(e.teleports).toEqual([]);
        expect(e.keys).toEqual([['keydown', 'ArrowRight'], ['keyup', 'ArrowRight']]);
        expect(e.engine.stats).toMatchObject({ adopted: 1, forced: 0, forcedBy: {}, adoptRefused: [], continuations: 1, keyReleases: [] });
        expect(e.engine.stats.dismissed).toEqual([expect.objectContaining({ level: HOUSE, key: 'right' })]);
        expect(e.engine.stats.ceremonies).toEqual([expect.objectContaining({ level: HOUSE, began: 'cutscene', adopted: true })]);
        expect(e.engine.stats.hostStarts.map((h) => h.label)).toEqual(['adopt', 'continuation']);
        expect(e.engine.stats.heldChecks).toEqual([expect.objectContaining({ shipped: 1, equal: true, held: true })]);
        // The adoption waited for the Help's fade: more than TUTORIAL_FADE_FRAMES game frames after the press.
        expect(e.engine.arrivalReads.at(-1).status.game_time - e.engine.stats.dismissed[0].gameTime).toBeGreaterThan(TUTORIAL_FADE_FRAMES);
        expect(e.dones).toHaveLength(1);
    });
    it('⛓ W8c — …the adoption is the room\'s staging under the RESOLVED level, and its recorded reads restage (W5\'s probe)', () => {
        const e = newGameOver();
        e.engine.walkTo(CHEST);
        e.timers.run();
        expect(e.engine.room.level).toBe(HOUSE);
        expect(e.engine.room.staging.boot.level).toBe(HOUSE);
        // Recorded RESOLVED: `stagingFromWasmArrival` refuses a record whose level is not the game's.
        expect(e.engine.arrivalReads.at(-1).seam.beginEntry).toMatchObject({ 'begin.level': HOUSE, 'save.time': e.u.elapsed > 0 ? expect.any(Number) : null });
    });
    it('⛓ W8c — THE WINDOW: the scene just ended and its Help is still QUEUED (no freeze yet) → not adopted; the Help surfaces a frame later and is dismissed', () => {
        const keys = [];
        let reads = 0;
        const u = unwatched({ begin: { 'begin.level': -1 }, startLevel: HOUSE, state: { freezeObjects: false },
            // read 1 = the walkTo's, read 2 = the ceremony's first poll (quiet), read 3 = the Help's first update
            tick: (w) => { reads += 1; w.elapsed += 1; if (reads === 3) w.state.freezeObjects = true; } });
        const win = fakeWin((ev) => { keys.push([ev.type, ev.key]); if (ev.type === 'keydown') u.state.freezeObjects = false; });
        const e = engineOver(A, { swap: CLEAR, win, game: { unwatched: u } });
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'await-ceremony' });
        e.timers.run();
        expect(keys).toEqual([['keydown', 'ArrowRight'], ['keyup', 'ArrowRight']]);
        expect(e.engine.stats).toMatchObject({ adopted: 1, forced: 0, forcedBy: {} });
        expect(e.engine.stats.ceremonies).toEqual([expect.objectContaining({ began: 'none', adopted: true })]);
        expect(e.engine.stats.dismissed).toHaveLength(1);
        expect(e.failures).toEqual([]);
    });
    it('⛓ W8c — a new game\'s room long past its ceremony: quiet for CEREMONY_QUIET_FRAMES, then ADOPTED, nothing pressed', () => {
        const keys = [];
        const u = unwatched({ begin: { 'begin.level': -1 }, startLevel: HOUSE, state: { freezeObjects: false }, tick: (w) => { w.elapsed += 1; } });
        const e = engineOver(A, { swap: CLEAR, win: fakeWin((ev) => keys.push(ev.type)), game: { unwatched: u } });
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'await-ceremony' });
        e.timers.run();
        expect(keys).toEqual([]);
        expect(e.engine.stats).toMatchObject({ adopted: 1, forced: 0, dismissed: [] });
        expect(e.dones).toHaveLength(1);
    });
    it('⛓ W8c — the glue query is asked with the record AS LATCHED (−1): a teleport pushed on it blocks the adoption', () => {
        const e = newGameOver();
        e.swap.state = { ...CLEAR, pushedOn: { ...A.seam.beginEntry, 'begin.level': -1 }, pushes: 1 };
        e.engine.walkTo(CHEST);
        e.timers.run(300);
        expect(e.engine.stats.adopted).toBe(0);
        expect(e.engine.stats.adoptRefused.map((r) => r.clause)).toEqual(['glue']);
    });
    it('⛓ W8c — a Help an arrow does NOT dismiss (the freeze outlives the fade) → the named cold-start re-arrival, one press only', () => {
        const e = newGameOver({ stubborn: true });
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'await-ceremony' });
        e.timers.run(200);
        expect(e.keys).toEqual([['keydown', 'ArrowRight'], ['keyup', 'ArrowRight']]);
        expect(e.engine.stats.forcedBy).toEqual({ 'cold-start': 1 });
        expect(e.teleports).toHaveLength(1);
        expect(e.notes.some((n) => /outlived the arrow/.test(n ?? ''))).toBe(true);
    });
    it('⛓ W8c — a ceremony that never ends within CEREMONY_WAIT_MS → the named cold-start re-arrival', () => {
        let t = 0;
        const e = newGameOver({ endsCutscene: false, opts: { now: () => (t += 10000) } });
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'await-ceremony' });
        e.timers.run(100);
        expect(e.keys).toEqual([]);
        expect(e.engine.stats.forcedBy).toEqual({ 'cold-start': 1 });
        expect(e.notes.some((n) => /did not end within 180 s/.test(n ?? ''))).toBe(true);
    });
    it('⛓ W8c — after the ceremony the clauses still rule: a player who moved → refused POSITION, the named cold-start re-arrival', () => {
        const e = newGameOver({ patchAfter: { x: 70 } });
        e.engine.walkTo(CHEST);
        e.timers.run(200);
        expect(e.engine.stats.adopted).toBe(0);
        expect(e.engine.stats.adoptRefused.map((r) => r.clause)).toEqual(['position']);
        expect(e.engine.stats.forcedBy).toEqual({ 'cold-start': 1 });
        expect(e.engine.stats.ceremonies).toEqual([expect.objectContaining({ adopted: false })]);
    });
    it('⛓ W8c — a −1 record whose set starts ELSEWHERE is not resolved → refused BEGIN, no ceremony, no key', () => {
        const e = newGameOver({ startLevel: 0 });
        expect(e.engine.walkTo(CHEST)).toEqual({ ok: true, action: 'force-re-arrival' });
        expect(e.engine.stats.adoptRefused.map((r) => r.clause)).toEqual(['begin']);
        expect(e.keys).toEqual([]);
        expect(e.engine.stats.ceremonies).toEqual([]);
    });
    it('⛓ W8c — clause FREEZE: an ordinary cold start under a freeze botStatus cannot show → refused, and NOTHING is pressed (only the arm\'s tutorial is)', () => {
        const keys = [];
        const e = engineOver(A, { swap: CLEAR, win: fakeWin((ev) => keys.push(ev.type)), game: { unwatched: unwatched({ state: { freezeObjects: true } }) } });
        refusedBy(e, 'freeze');
        expect(keys).toEqual([]);
    });
});
