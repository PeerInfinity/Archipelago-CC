/**
 * seedlingDemo/hammerExecutorShakeBand.test — ⛓⛓ SEEDLING HAMMER-PHASE BX: A WALK WHOSE OWN READ THE CAMERA'S SHAKE BAND
 * HIDES WAITS THE BAND OUT (`EXECUTOR_SHAKE_BAND`, OFF by default; `solverBot.js`).
 *
 * The chaser forecast throws when whether a body is on screen depends on `Game.shake`'s jiggle (`levelRun.js`
 * `chaserForecast`'s `onScreenAt`). PKB's residue 1: two reads about the walk the run is about to take still let that
 * throw out of the whole solve, both in `walkTo` — the walk's opening gate (`refuseDanger` → `dangerNow` →
 * `swordTickAt`) and its corridor probe (`probeCorridor` → `previewWalk`). ON, the walk stands one tick and asks again
 * (bounded by `EXECUTOR_BAND_WAIT`); OFF, the throw escapes as before.
 *
 * The state is LB's: leg 414's atlas boot (`fixtures/hammer-lb-hx/boot-414.json`, the ghost sword, goal the chest).
 * Its first walk opens with exactly the two reads, in order: the run's first chaser forecast is the gate's
 * (`swordTickAt`), the second is the corridor probe's (`previewWalk`), both at t0 (measured). Each row stages the band as
 * PKB's rows do — the chosen forecast's step throws the forecast's own words — and caps the run's `advance` at `CAP`
 * ticks: a walk that got past its two reads is all a row needs to see.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { ANYTIME_PASSES, solveAnytime } from './jsRuntimeSolver.js';
import { atlasLevelSource } from './levelSource.js';
import { withPressKillBombs } from './pressKillCost.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import {
    EXECUTOR_BAND_WAIT, EXECUTOR_SHAKE_BAND, EXECUTOR_SHAKE_BAND_COUNTS, EXECUTOR_SHAKE_BAND_DEFAULT, SolverRefusal,
    solveSegment, withExecutorShakeBand,
} from './solverBot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV = globalThis.process?.env ?? {};
const CAP = 20;
const CAPPED = 'CAP: the row has seen the walk past its reads';

const BAND = () => new Error('chaserForecast: whether bob bob@288,80 is on screen depends on where inside '
    + '`Game.shake`\'s jiggle the camera landed, and the two draws that decide it are not indexable');
const LIVE = () => new Error('levelRun: whether bob@288,80 is on screen at tick 0 depends on where inside '
    + '`Game.shake`\'s jiggle the camera landed');
const DEFECT = () => new TypeError('a defect');

/** 414's atlas boot with the ghost sword (`hammerPressKillGuards.test.js`'s staging). */
function stagingOf() {
    const staging = solveStaging(stagingFromTape(parseTape(readFileSync(
        join(HERE, 'fixtures', 'hammer-lb-hx', 'boot-414.json'), 'utf8'))));
    staging.seam = { ...staging.seam, items: { ...staging.seam.items, hasSword: true, hasGhostSword: true } };
    return staging;
}

/**
 * `solveSegment` from the boot with the switch at `on`, where the `n`th chaser forecast the run builds throws `make()`
 * on its first step whenever `banded(n)`. Returns the keys the run was advanced with, the error it ended on, and what
 * the switch counted.
 */
function solve(on, banded, { make = BAND, cap = CAP } = {}) {
    const staging = stagingOf();
    const run = createRunForStaging(staging, atlasLevelSource());
    const forecast = run.chaserForecast.bind(run);
    let n = 0;
    run.chaserForecast = (...args) => {
        const fc = forecast(...args);
        n += 1;
        return fc && banded(n) ? { ...fc, step: () => { throw make(); } } : fc;
    };
    const keys = [];
    const advance = run.advance.bind(run);
    run.advance = (held) => {
        if (run.ticksCompleted >= cap) throw new Error(CAPPED);
        keys.push([...held].sort().join('+'));
        return advance(held);
    };
    const was = { ...EXECUTOR_SHAKE_BAND_COUNTS };
    let error = null;
    try {
        withExecutorShakeBand(on, () => solveSegment({ run, goals: [{ kind: 'collect-placement',
            placement: { x: 880, y: 816 } }], name: 'bx', boot: staging.boot, dashMode: 'all' }));
    } catch (e) {
        error = e;
    }
    const counted = Object.fromEntries(Object.keys(was).map((k) => [k, EXECUTOR_SHAKE_BAND_COUNTS[k] - was[k]]));
    return { keys, error, counted };
}

const NONE = { gate: 0, probe: 0, waited: 0, refused: 0 };

describe('EXECUTOR_SHAKE_BAND — the switch (hammer-phase BX)', () => {
    it.skipIf(ENV.SEEDLING_EXECUTOR_SHAKE_BAND !== undefined)('ships OFF', () => {
        expect(EXECUTOR_SHAKE_BAND.enabled).toBe(false);
        expect(EXECUTOR_SHAKE_BAND_DEFAULT).toBe(false);
    });

    it('`withExecutorShakeBand` sets it for the call and restores it, a throw included', () => {
        const was = EXECUTOR_SHAKE_BAND.enabled;
        expect(withExecutorShakeBand(true, () => EXECUTOR_SHAKE_BAND.enabled)).toBe(true);
        expect(withExecutorShakeBand(false, () => EXECUTOR_SHAKE_BAND.enabled)).toBe(false);
        expect(() => withExecutorShakeBand(true, () => { throw new Error('x'); })).toThrow('x');
        expect(EXECUTOR_SHAKE_BAND.enabled).toBe(was);
        expect(EXECUTOR_BAND_WAIT).toBe(45);
    });

    it('with no band, ON walks the keys OFF walks (the first CAP ticks, key for key)', () => {
        const off = solve(false, () => false);
        const on = solve(true, () => false);
        expect(off.error.message).toBe(CAPPED);
        expect(on.error.message).toBe(CAPPED);
        expect(on.keys).toEqual(off.keys);
        expect(on.keys.length).toBe(CAP);
        expect(on.counted).toEqual(NONE);
    }, 300_000);
});

describe('the walk\'s gate (`refuseDanger` → `swordTickAt`): site 1', () => {
    it('OFF: the band escapes the whole solve, before a tick (PKB residue 1, 371 at seam 5243)', () => {
        const off = solve(false, (n) => n === 1);
        expect(off.error.message).toMatch(/^chaserForecast: whether bob bob@288,80 is on screen/);
        expect(off.keys).toEqual([]);
        expect(off.counted).toEqual(NONE);
    }, 300_000);

    it('ON: the walk stands one tick (no keys), asks the gate again, and walks on', () => {
        const free = solve(false, () => false);
        const on = solve(true, (n) => n === 1);
        expect(on.error.message).toBe(CAPPED);
        expect(on.counted).toEqual({ gate: 1, probe: 0, waited: 1, refused: 0 });
        expect(on.keys[0]).toBe('');
        expect(on.keys.length).toBe(CAP);
        expect(on.keys.slice(1)).not.toEqual([]);
        expect(free.keys[0]).not.toBe('');
    }, 300_000);
});

describe('the walk\'s corridor probe (`probeCorridor` → `previewWalk`): site 2', () => {
    it('OFF: the band escapes the whole solve, before a tick (PKB residue 1, LB hand-over 5)', () => {
        const off = solve(false, (n) => n === 2);
        expect(off.error.message).toMatch(/^chaserForecast: whether bob bob@288,80 is on screen/);
        expect(off.keys).toEqual([]);
        expect(off.counted).toEqual(NONE);
    }, 300_000);

    it('ON: the walk stands one tick (no keys), plans and probes again, and walks on', () => {
        const on = solve(true, (n) => n === 2);
        expect(on.error.message).toBe(CAPPED);
        expect(on.counted).toEqual({ gate: 0, probe: 1, waited: 1, refused: 0 });
        expect(on.keys[0]).toBe('');
        expect(on.keys.length).toBe(CAP);
    }, 300_000);
});

/**
 * The page's own request: L40 leg 371 (`level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144`),
 * captured at seam 5242 on BX's base (`probe-seedling-divergence-sweep.mjs --capture-requests`), its atlas records cut to
 * level 40 (byte-identical answers at 5243, 5252 and 5266, measured), replayed at another arrival clock (`atSeamTime`'s
 * one field) on the dashless pass alone. The band here is the forecast's own, not staged.
 */
const LEG371 = JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'hammer-bx-371',
    'leg371-l40-request.json.gz'))).toString('utf8'));
function solve371(seam, { bombs, band }) {
    const captured = LEG371.requests[0].request;
    const req = restoreRequest({ ...captured, staging: { ...captured.staging,
        seam: { ...captured.staging.seam, time: seam } } });
    const { passes = ANYTIME_PASSES, source, ...tape } = req;
    const was = { ...EXECUTOR_SHAKE_BAND_COUNTS };
    const answer = withPressKillBombs(bombs, () => withExecutorShakeBand(band, () => solveAnytime({ ...tape, source,
        levelSource: levelSourceFromAtlas(source.records) }, { passes: passes.slice(0, 1) })));
    const counted = Object.fromEntries(Object.keys(was).map((k) => [k, EXECUTOR_SHAKE_BAND_COUNTS[k] - was[k]]));
    return { ok: answer.ok, ticks: answer.ok ? answer.plan.solution.length : null, work: answer.work,
        message: answer.ok ? null : String(answer.message), counted };
}
const BAND_TEXT = /^chaserForecast: whether bob bob@288,80 is on screen depends on where inside `Game\.shake`'s jiggle/;

describe('leg 371, the page\'s request (hammer-phase PKB residue 1)', () => {
    it('seam 5243, the defaults: OFF the gate\'s band is the answer; ON the walk waits 11 ticks and the hold refuses by '
        + 'name', () => {
        const off = solve371(5243, { bombs: true, band: false });
        expect([off.ok, off.work]).toEqual([false, 101]);
        expect(off.message).toMatch(BAND_TEXT);
        const on = solve371(5243, { bombs: true, band: true });
        expect([on.ok, on.work]).toEqual([false, 117]);
        expect(on.message).toMatch(/^solverBot\(wasm-location-40\) apitem \(64,144\) contact -> hold: the hold stands still /);
        expect(on.counted).toEqual({ gate: 8, probe: 3, waited: 11, refused: 0 });
    }, 120_000);

    it('seam 5252, `PRESS_KILL_BOMBS` OFF: OFF the corridor probe\'s band is the answer; ON the walk waits 18 ticks and '
        + 'the leg SOLVES', () => {
        const off = solve371(5252, { bombs: false, band: false });
        expect([off.ok, off.work]).toEqual([false, 92]);
        expect(off.message).toMatch(BAND_TEXT);
        const on = solve371(5252, { bombs: false, band: true });
        expect([on.ok, on.ticks, on.work]).toEqual([true, 1935, 153]);
        expect(on.counted).toEqual({ gate: 13, probe: 5, waited: 18, refused: 0 });
    }, 120_000);
});

/**
 * ⛓ hammer-phase BX I2 — LB's hand-over 5b, second half (no switch: a refusal's words): when `deriveRefuge` refused
 * candidates for the shake band (PKB's catch, counted in `shakeRefused`), the press kill's *"nowhere to be"* says so.
 */
const NOWHERE = 'and no strike on spinner@192,128 is derivable. The room has nowhere to be.';
describe('the press kill\'s "nowhere to be" names the refuges the shake band hid (hammer-phase BX I2)', () => {
    it('371 at 5266, `PRESS_KILL_BOMBS` OFF: every one of the 12 previewed refuges is banded, and the refusal says so', () => {
        const r = solve371(5266, { bombs: false, band: false });
        expect([r.ok, r.work]).toEqual([false, 88]);
        expect(r.message.endsWith(`${NOWHERE} (PRESS_KILL_SHAKE_GUARD: 12 refuge candidate(s) whose preview the `
            + 'camera-shake band hid are not counted.)')).toBe(true);
    }, 120_000);

    it('371 at 5265, the defaults: no refuge was banded, and the refusal is the words it was (BW\'s suffix, no other)', () => {
        const r = solve371(5265, { bombs: true, band: false });
        expect([r.ok, r.work]).toEqual([false, 88]);
        expect(r.message.endsWith(`${NOWHERE} (PRESS_KILL_BOMBS: a refuge whose walk or wait a forecast Bomb's `
            + 'Explosion lands on is not counted.)')).toBe(true);
        expect(r.message).not.toContain('PRESS_KILL_SHAKE_GUARD');
    }, 120_000);
});

describe('EXECUTOR_SHAKE_BAND ON — what it does not do', () => {
    it('a band that never settles: the walk stands EXECUTOR_BAND_WAIT ticks, then refuses by name', () => {
        const on = solve(true, () => true, { cap: 200 });
        expect(on.error).toBeInstanceOf(SolverRefusal);
        expect(on.error.message).toMatch(/: EXECUTOR_SHAKE_BAND — the camera-shake band hides whether bob@288,80 is on screen at the walk's gate \(t45\), and the walk has already stood 45 tick\(s\) for it \(EXECUTOR_BAND_WAIT 45\)\.$/);
        expect(on.keys).toEqual(Array(EXECUTOR_BAND_WAIT).fill(''));
        expect(on.counted).toEqual({ gate: EXECUTOR_BAND_WAIT + 1, probe: 0, waited: EXECUTOR_BAND_WAIT, refused: 1 });
    }, 300_000);

    it('an error that is not the forecast\'s band still throws: the live run\'s own band words, and a defect', () => {
        const live = solve(true, (n) => n === 1, { make: LIVE });
        expect(live.error.message).toMatch(/^levelRun: whether /);
        expect(live.counted).toEqual(NONE);
        const defect = solve(true, (n) => n === 2, { make: DEFECT });
        expect(defect.error).toBeInstanceOf(TypeError);
        expect(defect.counted).toEqual(NONE);
    }, 300_000);
});
