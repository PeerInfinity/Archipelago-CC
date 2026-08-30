/**
 * seedlingDemo/deadFrameBand.test — the band, asserted against the BANKED
 * observations rather than against itself.
 *
 * R5 slice 12 step 0. §24.85 designed this band and §24.9 named it
 * unbuilt. The claim it has to support is two-sided and neither half is
 * the half the band was fitted from:
 *
 *   ADMITS   every one of the 79 recorded residues — including the 50
 *            the old floor wrongly rejected;
 *   CATCHES  a ±150-frame ceremony error on every tape, INCLUDING the
 *            four long walks where the old linear ceiling was blind to
 *            one.
 *
 * ⚠ THE OBSERVATIONS ARE COMMITTED DATA, not a live sweep. The game side
 * comes from `fixtures/dead-frame-observations.json`, written by
 * `probe-seedling-deadframe-band --bank` from the sweep that gated
 * `247d859bb`. That file exists because the sweep's own payload directory
 * is gitignored and was the only copy of the numbers §24.85 quoted — and
 * those numbers did not reproduce.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    FADE_STATS, LEGACY_FADE_PER_LOAD, MAX_HALF_WIDTH, SPREAD_PER_SQRT_LOAD,
    describeFadeBand, fadeBand, legacyFadeBand,
} from './deadFrameBand.js';
import { CEREMONY_DEAD_FRAMES } from './sealCeremony.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const BANKED = JSON.parse(readFileSync(
    join(HERE, 'fixtures', 'dead-frame-observations.json'), 'utf8'));

/** The smallest freeze the model can be wrong about. */
const DEFECT = CEREMONY_DEAD_FRAMES.pickup;

describe('the banked observations are what the module says they are', () => {
    it('⛔ the stats match the file, so a remembered number cannot drift in', () => {
        // §24.85's prose said mean 19.31 / σ 0.85 / 181 observations and
        // the sweep it quoted says 19.1275 / 0.4117 / 557. The failure
        // mode is not arithmetic, it is a constant that outlives the
        // measurement it came from, so both live in one file and this
        // check joins them.
        expect(BANKED.totalTapes).toBe(FADE_STATS.tapes);
        expect(BANKED.totalLoads).toBe(FADE_STATS.loads);
        expect(BANKED.mean).toBeCloseTo(FADE_STATS.mean, 3);
        expect(BANKED.sigma).toBeCloseTo(FADE_STATS.sigma, 3);
        expect(BANKED.min).toBeCloseTo(FADE_STATS.min, 3);
        expect(BANKED.max).toBeCloseTo(FADE_STATS.max, 3);
    });

    it('the observations are the full roster, one row per tape', () => {
        expect(BANKED.observations).toHaveLength(79);
        expect(BANKED.observations.reduce((n, o) => n + o.loads, 0)).toBe(557);
        for (const o of BANKED.observations) {
            expect(o.residue).toBe(o.dead - o.modelled);
            expect(o.loads).toBeGreaterThan(0);
        }
    });
});

describe('ADMITS — every recorded residue is inside the band', () => {
    it('all 79, two-sidedly', () => {
        const outside = BANKED.observations.filter((o) => {
            const b = fadeBand(o.loads);
            return o.residue < b.lo || o.residue > b.hi;
        });
        expect(outside.map((o) => o.name)).toEqual([]);
    });

    it('⛓ and the old floor\'s flake is admitted — 50 at three loads', () => {
        // `transition-west-return` reported 50 once and 56 on four solo
        // re-runs. The old floor was 51: zero margin, so the STARVED run
        // went red. This is the observation the half-width is SET from.
        const b = fadeBand(3);
        expect(50).toBeGreaterThanOrEqual(b.lo);
        expect(legacyFadeBand(3).lo).toBeGreaterThan(50);
    });
});

describe('CATCHES — a ±150-frame ceremony error is rejected on every tape', () => {
    it('a spurious ceremony (residue too LOW) — the floor\'s job', () => {
        const missed = BANKED.observations.filter(
            (o) => o.residue - DEFECT >= fadeBand(o.loads).lo);
        expect(missed.map((o) => o.name)).toEqual([]);
    });

    it('a missed freeze (residue too HIGH) — the ceiling\'s job', () => {
        const missed = BANKED.observations.filter(
            (o) => o.residue + DEFECT <= fadeBand(o.loads).hi);
        expect(missed.map((o) => o.name)).toEqual([]);
    });

    it('⛔⛔ and the LEGACY band was blind to a missed freeze on the four full walks', () => {
        // The finding that makes this a strengthening rather than a
        // loosening. The old ceiling is 24/load against a fade of 19, so
        // its slack grows ~5 frames per load and passes 150 at 30 loads —
        // which is exactly the roster's most valuable tapes.
        const legacyBlind = BANKED.observations
            .filter((o) => o.residue + DEFECT <= legacyFadeBand(o.loads).hi)
            .map((o) => o.name)
            .sort();
        expect(legacyBlind).toEqual([
            'r1-walk-full', 'r2-walk-full', 'r3-walk-full', 'r4-walk-full',
        ]);
        // …and the new band catches every one of them.
        for (const name of legacyBlind) {
            const o = BANKED.observations.find((x) => x.name === name);
            expect(o.residue + DEFECT).toBeGreaterThan(fadeBand(o.loads).hi);
        }
    });

    it('⛓ §24.85\'s named case, both bands, both sides', () => {
        const o = BANKED.observations.find((x) => x.name === 'r3-walk-full');
        expect(o.loads).toBe(53);
        const b = fadeBand(53);
        const l = legacyFadeBand(53);
        // the recorded value is admitted by BOTH
        expect(o.residue).toBeGreaterThanOrEqual(b.lo);
        expect(o.residue).toBeLessThanOrEqual(b.hi);
        expect(o.residue).toBeGreaterThanOrEqual(l.lo);
        // the spurious ceremony is caught by BOTH — this is the case
        // §24.85 said a naive widening would lose
        expect(o.residue - DEFECT).toBeLessThan(l.lo);
        expect(o.residue - DEFECT).toBeLessThan(b.lo);
    });
});

describe('the shape, and the cap that keeps detection unconditional', () => {
    it('the centre is linear and the half-width is √N', () => {
        expect(fadeBand(1).centre).toBeCloseTo(FADE_STATS.mean, 6);
        expect(fadeBand(100).centre).toBeCloseTo(FADE_STATS.mean * 100, 6);
        expect(fadeBand(4).half).toBeCloseTo(SPREAD_PER_SQRT_LOAD * 2, 6);
        expect(fadeBand(9).half).toBeCloseTo(SPREAD_PER_SQRT_LOAD * 3, 6);
    });

    it('⛓ the band is TIGHTER than the linear one everywhere past a few loads', () => {
        for (const n of [10, 20, 41, 53, 79]) {
            const b = fadeBand(n);
            const l = legacyFadeBand(n);
            expect(b.hi).toBeLessThan(l.hi);
            expect(b.lo).toBeGreaterThan(l.lo);
        }
    });

    it('⛔ the half-width can never reach a whole ceremony, at any load count', () => {
        // Without the cap this is a claim about the roster's current
        // largest tape; with it, it is a claim. `4.5·√N` passes 75 at 278
        // loads and the roster's biggest is 79.
        expect(MAX_HALF_WIDTH).toBe(DEFECT / 2);
        for (const n of [1, 79, 278, 1000, 100000]) {
            expect(fadeBand(n).half).toBeLessThanOrEqual(MAX_HALF_WIDTH);
            expect(fadeBand(n).half * 2).toBeLessThanOrEqual(DEFECT);
        }
        expect(fadeBand(79).capped).toBe(false);
        expect(fadeBand(1000).capped).toBe(true);
    });

    it('the flake margin is real but not generous — 4.26 needed, 4.5 shipped', () => {
        // The number `SPREAD_PER_SQRT_LOAD` is derived from, restated as a
        // test so a future edit has to argue with it: admitting 50 at
        // three loads needs (19.1275*3 − 50)/√3.
        const needed = (FADE_STATS.mean * 3 - 50) / Math.sqrt(3);
        expect(needed).toBeCloseTo(4.26, 2);
        expect(SPREAD_PER_SQRT_LOAD).toBeGreaterThan(needed);
        expect(SPREAD_PER_SQRT_LOAD).toBeLessThan(needed * 1.5);
    });

    it('rejects a load count that is not a positive integer', () => {
        expect(() => fadeBand(0)).toThrow(RangeError);
        expect(() => fadeBand(-1)).toThrow(RangeError);
        expect(() => fadeBand(1.5)).toThrow(RangeError);
    });

    it('describes itself for a check detail', () => {
        expect(describeFadeBand(4)).toContain('4.5·√4');
        expect(describeFadeBand(4)).toContain('4 load(s)');
        expect(LEGACY_FADE_PER_LOAD.min).toBe(17);
    });
});
