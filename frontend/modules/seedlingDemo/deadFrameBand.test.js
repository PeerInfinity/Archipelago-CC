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
    FADE_STATS, LEGACY_FADE_PER_LOAD, MAX_HALF_WIDTH, MIN_FLOOR_HALF_WIDTH, SPREAD_PER_SQRT_LOAD,
    deadFrameBudget, describeFadeBand, fadeBand, legacyFadeBand, skipPathBoot,
} from './deadFrameBand.js';
import { LOAD_FADE_FRAMES, PAGE_BOOT_TIME } from './gameClock.js';
import { CEREMONY_DEAD_FRAMES } from './sealCeremony.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const BANKED = JSON.parse(readFileSync(
    join(HERE, 'fixtures', 'dead-frame-observations.json'), 'utf8'));

/** The smallest freeze the model can be wrong about. */
const DEFECT = CEREMONY_DEAD_FRAMES.pickup;

describe('the banked observations are what the module says they are', () => {
    it('⛔ the stats match the file, so a remembered number cannot drift in', () => {
        // §24.85's prose said mean 19.31 / σ 0.85 / 181 observations and
        // the sweep it quoted says 19.1275 / 0.4117 / 557 (re-derived
        // 2026-10-02 from the headless full tier: 19.2632 / 0.5734 / 589). The failure
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
        expect(BANKED.observations).toHaveLength(FADE_STATS.tapes);
        expect(BANKED.observations.reduce((n, o) => n + o.loads, 0)).toBe(FADE_STATS.loads);
        for (const o of BANKED.observations) {
            expect(o.residue).toBe(o.dead - o.modelled);
            expect(o.loads).toBeGreaterThan(0);
        }
    });
});

describe('ADMITS — every recorded residue is inside the band', () => {
    it(`all ${BANKED.observations.length}, two-sidedly`, () => {
        const outside = BANKED.observations.filter((o) => {
            const b = fadeBand(o.loads);
            return o.residue < b.lo || o.residue > b.hi;
        });
        expect(outside.map((o) => o.name)).toEqual([]);
    });

    it('⛓ and the old floor\'s flake is the BOOT FADE\'s — any k at three loads is owed back', () => {
        // `transition-west-return` reported 50 once and 56 on four solo
        // re-runs; the old floor was 51 and the starved run went red. ⛓ R6
        // lockstep: it boots at the page's spawn, so it pays `60 − k` where k
        // is the page's pre-arm share of its own boot fade — and the budget
        // now owes k back, so every k the clamp allows lands on the centre.
        const tape = { tick_count: 40, boot: { level: 0, x: 80, y: 128 } };
        for (let k = 0; k < LOAD_FADE_FRAMES; k++) {
            const { modelled } = deadFrameBudget({ tape, expected: {}, transitions: 2,
                armedAt: PAGE_BOOT_TIME + k });
            const residue = (3 * LOAD_FADE_FRAMES - k) - modelled;
            expect(residue).toBeGreaterThanOrEqual(fadeBand(3).lo);
            expect(residue).toBeLessThanOrEqual(fadeBand(3).hi);
        }
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

    it('⛔⛔ and the LEGACY band was blind to a missed freeze on the full walks', () => {
        // The finding that makes this a strengthening rather than a
        // loosening. The old ceiling is 24/load against a fade of 19, so
        // its slack grows ~5 frames per load and passes 150 at 30 loads —
        // which is exactly the roster's most valuable tapes.
        const legacyBlind = BANKED.observations
            .filter((o) => o.residue + DEFECT <= legacyFadeBand(o.loads).hi)
            .map((o) => o.name)
            .sort();
        // Four at the first derivation; `r1-walk-full` (79 loads) RETIRED
        // under ⚖ ruling 26 (`c828cee1a5`), so the re-derived bank has three.
        // ⛓ At 20/load the ceiling's slack is 4/load: blind from 38 loads.
        expect(legacyBlind).toEqual([
            'r2-walk-full', 'r3-walk-full', 'r4-walk-full',
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
        // the spurious ceremony is caught by the √N band — the case §24.85
        // said a naive widening would lose. ⛓ R6 lockstep: and the LEGACY
        // floor no longer catches it. At 20/load its 17/load floor has 3/load
        // of slack, 159 frames at 53 loads: the linear band is now blind on
        // BOTH sides of the roster's longest walks.
        expect(o.residue - DEFECT).toBeGreaterThanOrEqual(l.lo);
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

    it('⛓ 4.5·√N is HEADROOM now: the worst all-pinned residual is far inside it', () => {
        // Replaces the flake-margin row: 4.5 was set from a 6-frame STARVED
        // run, and that starvation was the skip-path boot fade, owed back by
        // name since the R6 lockstep. What is left is fenceposts.
        const worst = Math.max(...BANKED.observations.map(
            (o) => Math.abs(o.residue - FADE_STATS.mean * o.loads) / Math.sqrt(o.loads)));
        expect(worst).toBeLessThan(SPREAD_PER_SQRT_LOAD / 2);
    });

    it('⛓⛓ trap 1484: a single-load tape reading 14 (k = 6) is owed back by name, not by a floor', () => {
        const b = fadeBand(1);
        // the band alone no longer admits it…
        expect(14).toBeLessThan(b.lo);
        // …the budget does, because the page spent 6 of the boot fade before the arm
        const { modelled } = deadFrameBudget({
            tape: { tick_count: 40, boot: { level: 0, x: 80, y: 128 } },
            expected: {}, transitions: 0, armedAt: PAGE_BOOT_TIME + 6,
        });
        expect(14 - modelled).toBeGreaterThanOrEqual(b.lo);
        expect(14 - modelled).toBeLessThanOrEqual(b.hi);
    });

    it('⛔ the wider floor still CATCHES a load the model invented, below four loads', () => {
        // An invented load (a death or reboot the game did not take) puts the
        // game's residue one fade below the model's centre.
        for (const n of [2, 3]) {
            const invented = FADE_STATS.mean * (n - 1);
            expect(invented).toBeLessThan(fadeBand(n).lo - 5);
        }
    });

    it('⛓ the floor minimum is RETIRED: the band is symmetric at every load count', () => {
        expect(MIN_FLOOR_HALF_WIDTH).toBe(SPREAD_PER_SQRT_LOAD);
        for (const n of [1, 2, 3, 4, 9, 53, 79]) {
            const b = fadeBand(n);
            expect(b.centre - b.lo).toBeCloseTo(b.hi - b.centre, 6);
        }
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

describe('⛓⛓ R6 lockstep: the boot fade the page spent before botStart (`bootFadeSpent`)', () => {
    const SPAWN = { level: 0, x: 80, y: 128 };
    const budget = (tape, armedAt) => deadFrameBudget({
        tape: { tick_count: 40, ...tape }, expected: {}, transitions: 0, armedAt,
    });

    it('a tape at the page\'s spawn takes the skip path; anywhere else, or with a declared clock, does not', () => {
        expect(skipPathBoot({ boot: SPAWN })).toBe(true);
        expect(skipPathBoot({ boot: { ...SPAWN, x: 81 } })).toBe(false);
        expect(skipPathBoot({ boot: { level: 38, x: 80, y: 128 } })).toBe(false);
        // `seam.time` writes Main.time before the arm, so armed_at stops counting the page's frames.
        expect(skipPathBoot({ boot: SPAWN, seam: { time: 9000 } })).toBe(false);
    });

    it('is k = armed_at − PAGE_BOOT_TIME, and it is taken OFF the modelled side (the residue owes it back)', () => {
        // The first all-pinned full tier: straight-run armed at 4806 and read 14 = 20 − 6.
        const b = budget({ boot: SPAWN }, PAGE_BOOT_TIME + 6);
        expect(b.bootFadeSpent).toBe(6);
        expect(b.modelled).toBe(-6);
        expect(14 - b.modelled).toBe(LOAD_FADE_FRAMES);
    });

    it('is clamped to one fade, and is zero without an arm time or off the skip path', () => {
        expect(budget({ boot: SPAWN }, PAGE_BOOT_TIME + 99).bootFadeSpent).toBe(LOAD_FADE_FRAMES);
        expect(budget({ boot: SPAWN }, PAGE_BOOT_TIME - 3).bootFadeSpent).toBe(0);
        expect(budget({ boot: SPAWN }, null).bootFadeSpent).toBe(0);
        expect(budget({ boot: { level: 38, x: 144, y: 300 } }, PAGE_BOOT_TIME + 6).bootFadeSpent).toBe(0);
    });
});
