/**
 * seedling-fidelity-shakeexact — A SPLIT RUN'S CAMERA SHAKE IS EXACT (`CONTACT_FIDELITY.shakeExactSplit`, OFF).
 *
 * ⚖ The user (2026-10-25, "Exact for split"): *"Should the model compute the shake jiggle exactly for split runs,
 * keeping the band only for split-off tapes and the fade-length / reboot cases?"* → "Exact for split". Under `Rng.split`
 * `view()` jiggles by `shake * Game.shakeJiggle(Game.time, axis) - shake/2` and takes no draw (`Game.as:2004-2011`), so
 * `levelRun.stepCameraNow` steps `camera.stepCameraSplit` at the exact `Game.time` when the run is split and its clock
 * counts, and keeps the band where it cannot know the jiggle (`camera.SHAKE_BAND_KEPT`).
 *
 * The witnesses are the GAME's rows (p4g, headless, `probe-seedling-shake-exact.mjs --record`): the player, `hits`,
 * `game_time` and `camera` {x, y, shake} per tick. ON, every sampled camera is the model's point at 0 px — the shaking
 * frames included — except where a kept case holds a band, which then contains the game's camera.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SHAKE_BAND_KEPT, stepCameraJiggled, stepCameraSplit } from './camera.js';
import { CONTACT_FIDELITY, CONTACT_FIDELITY_DEFAULTS, withContactFidelity } from './contactFidelity.js';
import { shakeJiggle } from './finalBossRng.js';
import { loadTape } from './fixtures/index.js';
import { atlasLevelSource } from './levelSource.js';
import { parseTape } from './tapeFormat.js';
import { createTapeStepper } from './tapeRunner.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const witnessPath = (n) => join(HERE, 'fixtures', 'shake-witness', `${n}.json`);
const witness = (n) => JSON.parse(readFileSync(witnessPath(n), 'utf8'));

/** The model's camera after every tick of `tape` (`{t, cam, band, shake, clock}`), and its counters. */
function cameras(tape, { upto = Infinity } = {}) {
    let run = null;
    const st = createTapeStepper(tape, { levelSource: atlasLevelSource(), onTick: (t, s, h, rn) => { run = rn; } });
    const rows = new Map();
    for (let r = st.next(); !r.done; r = st.next()) {
        const t = run.ticksCompleted;
        if (t > upto) break;
        const c = run.cameraNow;
        rows.set(t, { t, cam: c.cam, band: c.band, shake: run.shake, clock: run.gameTime });
    }
    return { rows, counts: run.shakeExactCounts };
}

/** The join: every recorded sample against the model's camera after the same tick. */
function join_(w, on) {
    const tape = parseTape(JSON.stringify(w.tape));
    const { rows, counts } = withContactFidelity({ shakeExactSplit: on }, () => cameras(tape, { upto: w.upto }));
    const out = { counts, pointEq: 0, pointNe: [], bandIn: 0, bandOut: [], bandTicks: [], clockNe: [], shakingExact: 0 };
    const prevShake = new Map(w.samples.map((s) => [s.t + 1, s.cam.shake]));
    for (const s of w.samples) {
        const m = rows.get(s.t);
        if (!m) continue;
        if (m.clock !== null && s.time !== undefined && m.clock !== s.time) out.clockNe.push(s.t);
        if (m.cam) {
            if (m.cam.x === s.cam.x && m.cam.y === s.cam.y) {
                out.pointEq += 1;
                if ((prevShake.get(s.t) ?? 0) > 0) out.shakingExact += 1;
            } else out.pointNe.push(s.t);
        } else {
            out.bandTicks.push(s.t);
            const b = m.band;
            if (s.cam.x >= b.x.lo && s.cam.x <= b.x.hi && s.cam.y >= b.y.lo && s.cam.y <= b.y.hi) out.bandIn += 1;
            else out.bandOut.push(s.t);
        }
    }
    return out;
}

describe('SHAKEEXACT — the switch and the face', () => {
    it.skipIf(!!process.env.SEEDLING_CONTACT_FIDELITY || !!process.env.SEEDLING_SHAKE_EXACT_SPLIT)('shakeExactSplit ships OFF', () => {
        expect(CONTACT_FIDELITY_DEFAULTS.shakeExactSplit).toBe(false);
        expect(CONTACT_FIDELITY.shakeExactSplit).toBe(false);
    });

    it('stepCameraSplit IS stepCameraJiggled at `Game.shakeJiggle(time, axis)`, and refuses an unknown time', () => {
        const world = { width: 640, height: 480 };
        for (const time of [0, 1, 4092, 12264, 26911]) {
            for (const shake of [1, 5, 15, 30, 60]) {
                const a = stepCameraSplit({ x: 100, y: 80 }, { x: 237.4, y: 151.9 }, world, { shake, time });
                const b = stepCameraJiggled({ x: 100, y: 80 }, { x: 237.4, y: 151.9 }, world,
                    { shake, r1: shakeJiggle(time, 0), r2: shakeJiggle(time, 1) });
                expect(a).toEqual(b);
                expect(a.shake).toBe(shake - 1);
            }
        }
        expect(() => stepCameraSplit({ x: 0, y: 0 }, { x: 0, y: 0 }, world, { shake: 5, time: null }))
            .toThrow(/needs the exact Game.time/);
    });

    it('the kept cases are named: unsplit, no clock, a band already, across a load, the reboot settle', () => {
        expect(Object.keys(SHAKE_BAND_KEPT)).toEqual(['unsplit', 'noClock', 'bandAlready', 'acrossLoad', 'rebootSettle']);
    });
});

describe('SHAKEEXACT — the committed tapes (W0 census: 3 of 55 split tapes shake; 0 observations move)', () => {
    // u14-moonrock-beam: the moonrock's `= 60` lands inside its own freeze (60 shaking dead frames); u15-turret-spit:
    // a spit's `Player.hit` `+= 5` on a live tick. Both split, both with a counting clock.
    it.each([['u14-moonrock-beam', 60], ['u15-turret-spit', 5]])('%s — ON, the camera is a point on every tick; OFF, a band', (name, views) => {
        const tape = loadTape(name);
        expect(tape.rng.split).toBe(true);
        const on = withContactFidelity({ shakeExactSplit: true }, () => cameras(tape));
        const off = withContactFidelity({ shakeExactSplit: false }, () => cameras(tape));
        expect(on.counts).toEqual({ exactViews: views, bandOpens: 0, split: true });
        expect([...on.rows.values()].filter((r) => r.band).length).toBe(0);
        expect(off.counts.exactViews).toBe(0);
        expect(off.counts.bandOpens).toBe(1);
        expect([...off.rows.values()].filter((r) => r.band).length).toBeGreaterThan(0);
    });

    // ⚠ A tape whose clock COUNTS (a clockless one keeps its band by `noClock` alone, which would hide this row's arm).
    it('a split:false tape keeps its band with the switch ON (`SHAKE_BAND_KEPT.unsplit`)', () => {
        const tape = loadTape('prox-l40-turret-contact');
        expect(tape.rng?.split ?? false).toBe(false);
        const on = withContactFidelity({ shakeExactSplit: true }, () => cameras(tape));
        const off = withContactFidelity({ shakeExactSplit: false }, () => cameras(tape));
        expect(on.counts.exactViews).toBe(0);
        expect([...on.rows.values()].every((r) => r.clock !== null)).toBe(true);
        expect([...on.rows.values()].filter((r) => r.band).length).toBeGreaterThan(0);
        expect(JSON.stringify([...on.rows.values()])).toBe(JSON.stringify([...off.rows.values()]));
    });

    // The game's own UNSPLIT run of the same walk (MOVINGWAIT D4's witness): `Rng.cos()` jiggled it, so an exact camera
    // would be wrong there — ON keeps the band, and the band holds the game.
    it('the unsplit L42 game witness (rebootshake-l42-part0-damage) — ON, still banded, and the band holds the game', () => {
        const w = JSON.parse(readFileSync(join(HERE, 'fixtures', 'bomb-witness', 'rebootshake-l42-part0-damage.json'), 'utf8'));
        expect(w.tape.rng?.split ?? w.tape.ticks?.[0]?.rng?.split ?? false).toBe(false);
        const r = join_(w, true);
        expect(r.counts.exactViews).toBe(0);
        expect(r.bandTicks.length).toBeGreaterThan(0);
        // t1221 (the death reboot) and t1238 (the load into L42): the game's sample there is polled BEFORE the new
        // world's settle (K2PREP D2's `camFresh`, where `assertWitnessCamera` does not ask: at t1221 the game reads
        // (776, -56) against the settled band's y 0) — the same rows OFF.
        expect(r.bandOut).toEqual([1221]);
        expect(r.pointNe).toEqual([1238]);
        const off = join_(w, false);
        expect([off.bandOut, off.pointNe]).toEqual([[1221], [1238]]);
    });
});

/**
 * The game witnesses. `rows`: [name, shaking frames the game jiggled on a sampled tick (all exact ON), band ticks ON
 * (a kept case), exact views ON].
 */
const GAME = [
    ['shakeexact-u14-moonrock', 0, 0, 60],
    ['shakeexact-u15-spit', 4, 0, 5],
    ['shakeexact-l42-bombs-reboot', 10, 17, 11],
];
describe.each(GAME)('SHAKEEXACT — the game witness %s (p4g)', (name, shaking, bandTicks, views) => {
    it.skipIf(!existsSync(witnessPath(name)))('ON: every sampled camera is the game\'s — a point at 0 px, or a kept band holding it', () => {
        const w = witness(name);
        expect(w.split).toBe(true);
        const r = join_(w, true);
        expect(r.clockNe).toEqual([]);
        expect(r.pointNe).toEqual([]);
        expect(r.bandOut).toEqual([]);
        expect(r.shakingExact).toBe(shaking);
        expect(r.bandTicks.length).toBe(bandTicks);
        expect(r.counts.exactViews).toBe(views);
    });

    it.skipIf(!existsSync(witnessPath(name)))('OFF: the band, which still holds the game (the 10-10 ruling\'s face)', () => {
        const r = join_(witness(name), false);
        expect(r.counts.exactViews).toBe(0);
        expect(r.pointNe).toEqual([]);
        expect(r.bandOut).toEqual([]);
        if (views > 0) expect(r.bandTicks.length).toBeGreaterThan(bandTicks);
    });
});
