/**
 * ⛓ HOLD SEAM (js slice `seedling-js-hold-seam`) — a continuation shipped onto a HELD game is solved across the hold.
 *
 * The game's witness is fidelity SLOWFIX D-B's (`fixtures/hold-seam-witness/l15-hold-seam.json`, `fidelityHoldSeam.test.js`):
 * logical-links B's chest leg in L15 (185 t) ends held, the game holds 300 ms — its pinned swim channel 33 → 43 while
 * nothing else moves — and the engine's continuation walk (157 t) reads x 115.30 at t18 where an unstepped model reads
 * 115.05. These rows hold the page's wiring (`wasmHoldSeam.js` → `continuationSolveRequest` → `replayTape` /
 * `forkRunFor` / the worker's `solveFromTape`): the count is the GAME's pin against the shadow's channel, and with it
 * every replay of the room plays the continuation at 0 px.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { deliveredMoonrockSet } from './fidelityMoonrock.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { forkRunFor, liveOf, replayTape } from './jsRuntimeSolver.js';
import { continuationSolveRequest } from './wasmArrival.js';
import { continuationHoldSeam, heldSwimFrames, holdSeamRestage, holdsMap, pinChannelOf } from './wasmHoldSeam.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const W = JSON.parse(readFileSync(join(HERE, 'fixtures', 'hold-seam-witness', 'l15-hold-seam.json'), 'utf8'));

/** The page's AP rooms for this walk (as `fidelityHoldSeam.test.js` mounts them): L15's chest the AP apitem. */
function apRecords() {
    const { records } = deliveredMoonrockSet(REPO);
    const r15 = records.get(15);
    const swapped = new Map(records);
    swapped.set(15, { ...r15, entities: r15.entities.map((e) => (e.type === 'chest' && e.x === 144 && e.y === 96
        ? { type: 'apitem', x: 144, y: 96, attrs: { tag: '1', look: 'chest' } } : e)) });
    return swapped;
}
const RECORDS = apRecords();
const SRC = levelSourceFromAtlas(RECORDS);
const SHIPPED = W.chestKeys;
const pin = (frames, playing = true) => ({ sound_pin: { set: 'Swim', channels: [{ playing, frames, len_frames: 47 }] } });
/** The game's held status at the continuation (the witness's last seam read: pin 43). */
const HELD = pin(W.held.seam.last.pin.frames, W.held.seam.last.pin.playing);
/** The engine's exit goal for the walk (`level_15__r1c5 -> level_14`: the walk leaves L15 by its west edge, near row 5). */
const GOAL = { kind: 'exit', level: 15, tiles: [0, 1, 2].flatMap((tx) => [3, 4, 5, 6, 7].map((ty) => [tx, ty])), name: 'level_15__r1c5 -> level_14' };

/** `run` stepped by the continuation's keys, its observations in the continuation's own ticks. */
function walk(run) {
    const out = [{ t: 0, level: run.level, x: run.state.x, y: run.state.y }];
    for (const k of W.walkKeys) {
        run.advance(new Set(k));
        out.push({ t: out.length, level: run.level, x: run.state.x, y: run.state.y });
    }
    return out;
}
function firstDiff(game, model) {
    for (const o of game) {
        const m = model.find((q) => q.t === o.t);
        if (!m || m.level !== o.level || m.x !== o.x || m.y !== o.y) return { t: o.t, game: o, model: m };
    }
    return null;
}

describe('HOLD SEAM — the held frames, measured off the game\'s pin', () => {
    const OPEN33 = { frames: 33, open: true, lengthFrames: 47 };
    it('the witness: the model at 33, the held game\'s pin at 43 → 10 frames (fidelity\'s count, read, not assumed)', () => {
        expect(W.held.pinAtChestEnd.frames).toBe(33);
        expect(heldSwimFrames({ channel: OPEN33, status: HELD, pins: W.staging.pins })).toEqual({ n: W.heldFrames, game: { frames: 43, open: true, lengthFrames: 47 } });
    });
    it('a game channel that completed while held → the frames that close the model\'s (more change nothing)', () => {
        expect(heldSwimFrames({ channel: OPEN33, status: pin(0, false), pins: ['sound'] }).n).toBe(14);
    });
    it('NO HOLD → NO STEP: the same pin, a closed model channel, no swim sound, or no `sound` pin → 0', () => {
        expect(heldSwimFrames({ channel: OPEN33, status: pin(33), pins: ['sound'] }).n).toBe(0);
        expect(heldSwimFrames({ channel: { frames: 0, open: false, lengthFrames: 47 }, status: HELD, pins: ['sound'] }).n).toBe(0);
        expect(heldSwimFrames({ channel: null, status: HELD, pins: ['sound'] }).n).toBe(0);
        expect(heldSwimFrames({ channel: OPEN33, status: HELD, pins: ['dead_frames'] })).toEqual({ n: 0, game: null });
    });
    it('a pin no hold reaches is REFUSED by name and steps nothing (behind the model, a stopped channel, another length, none)', () => {
        for (const st of [pin(20), pin(5, false), { sound_pin: { channels: [{ playing: true, frames: 40, len_frames: 48 }] } }, {}]) {
            const r = heldSwimFrames({ channel: OPEN33, status: st, pins: ['sound'] });
            expect(r.n).toBe(0);
            expect(r.refusal).toMatch(/swim/);
        }
        expect(pinChannelOf({})).toBeNull();
    });
    it('holdsMap: room rows → the replay\'s Map (two holds at one tick add); none → null', () => {
        expect(holdsMap([])).toBeNull();
        expect([...holdsMap([{ t: 4, n: 2 }, { t: 9, n: 3 }, { t: 4, n: 1 }])]).toEqual([[4, 3], [9, 3]]);
    });
});

describe('HOLD SEAM — the continuation, solved across the hold (the L15 witness)', () => {
    it('a HELD continuation steps the shadow by the game\'s n: seam at the prefix end, the room\'s holds {185 → 10}', () => {
        const { seam, holds } = continuationHoldSeam({ staging: W.staging, shipped: SHIPPED, levelSource: SRC, status: HELD });
        expect(seam).toEqual({ t: SHIPPED.length, model: { frames: 33, open: true, lengthFrames: 47 }, game: { frames: 43, open: true, lengthFrames: 47 },
            n: 10, refusal: null });
        expect([...holds]).toEqual([[185, 10]]);
    });

    it('the shadow with those holds plays the game\'s continuation at 0 px (158 obs; t18 = 115.30) — the request\'s replay and the solver\'s fork alike', () => {
        const holds = new Map([[185, 10]]);
        const perTick = SHIPPED.map((h) => new Set(h));
        const shadow = replayTape({ staging: W.staging, perTick, levelSource: SRC, scratchPersistence: true, holds });
        expect(shadow.state.swim).toEqual({ frames: 43, open: true, lengthFrames: 47 });
        expect(firstDiff(W.held.continuation, walk(shadow))).toBeNull();
        // ⛓ CRUSHER FORK — a fork replays the prefix and the hold at its end on its own advances
        const fork = forkRunFor({ staging: W.staging, levelSource: SRC, scratchPersistence: true, prefixLength: perTick.length, holds })();
        for (const h of perTick) fork.advance(h);
        expect(firstDiff(W.held.continuation, walk(fork))).toBeNull();
    });

    it('CONTROL (the wiring removed — no holds): the same shadow leaves the game at t18, +0.25 px in x — the live signature', () => {
        const shadow = replayTape({ staging: W.staging, perTick: SHIPPED.map((h) => new Set(h)), levelSource: SRC, scratchPersistence: true });
        const d = firstDiff(W.held.continuation, walk(shadow));
        expect(d.t).toBe(18);
        expect(d.game.x - d.model.x).toBeCloseTo(0.25, 9);
    });

    it('the continuation REQUEST carries the holds: its `live` is the stepped shadow\'s, the worker\'s replay lands on it', () => {
        const holds = new Map([[185, 10]]);
        const c = continuationSolveRequest({ staging: W.staging, shipped: SHIPPED, goal: GOAL, levelSource: SRC, records: RECORDS,
            record: RECORDS.get(15), holds });
        expect(c.refusal).toBeUndefined();
        expect([...c.request.holds]).toEqual([[185, 10]]);
        const worker = replayTape({ ...c.request, scratchPersistence: true });
        expect(worker.state.swim.frames).toBe(43);
        expect(liveOf(worker)).toEqual(c.request.live);
    });

    it('NO HOLD → the request is the one it always was: no `holds` key, the shadow unstepped', () => {
        const plain = continuationSolveRequest({ staging: W.staging, shipped: SHIPPED, goal: GOAL, levelSource: SRC, records: RECORDS, record: RECORDS.get(15) });
        const none = continuationSolveRequest({ staging: W.staging, shipped: SHIPPED, goal: GOAL, levelSource: SRC, records: RECORDS, record: RECORDS.get(15),
            holds: continuationHoldSeam({ staging: W.staging, shipped: SHIPPED, levelSource: SRC, status: pin(33) }).holds });
        expect('holds' in plain.request).toBe(false);
        expect('holds' in none.request).toBe(false);
        expect(none.request.live).toEqual(plain.request.live);
        // no `sound` pin: no seam is measured (nothing replayed for it), the room's holds pass through
        expect(continuationHoldSeam({ staging: { ...W.staging, pins: ['dead_frames'] }, shipped: SHIPPED, levelSource: SRC, status: HELD }))
            .toEqual({ seam: null, holds: null });
    });
});

describe('HOLD SEAM — the ship re-reads the pin (the hold runs on while the solver thinks)', () => {
    const SEAM = { t: 185, model: { frames: 33, open: true, lengthFrames: 47 }, n: 10, refusal: null };
    it('the same channel at the ship → ship (null)', () => {
        expect(holdSeamRestage(SEAM, HELD, ['sound'])).toBeNull();
    });
    it('the pin moved on → re-stage, with the count as it reads now', () => {
        expect(holdSeamRestage(SEAM, pin(45), ['sound'])).toEqual({ n: 12, game: { frames: 45, open: true, lengthFrames: 47 } });
        expect(holdSeamRestage(SEAM, pin(0, false), ['sound'])).toMatchObject({ n: 14 });
    });
    it('solved on a CLOSED channel: it never moves again — no re-stage however long the hold', () => {
        expect(holdSeamRestage({ ...SEAM, n: 14 }, pin(0, false), ['sound'])).toBeNull();
    });
    it('no seam, or one refused at the solve → nothing to re-check', () => {
        expect(holdSeamRestage(null, HELD, ['sound'])).toBeNull();
        expect(holdSeamRestage({ ...SEAM, refusal: 'x' }, pin(45), ['sound'])).toBeNull();
    });
});
