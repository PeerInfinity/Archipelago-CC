/**
 * fullTierEstimate — the estimator's own rows (R9 slice P3b, §47.11 (3) (d)).
 *
 * ⛔⛔ WHAT THESE ROWS ARE FOR. R9 slice 12h quoted ~55 min for a run that took
 * ~89 (§47.8 item 5), because the estimate came from a tape COUNT and then
 * from a per-tape RATE measured on the short R1–R4 walks. Both of those are
 * shapes a test can REFUSE, and the discriminating one is below: two sets with
 * the SAME tape count and different tick sums must not price the same.
 */
import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    FIXED_SEC_PER_TAPE, FULL_TIER_CALIBRATION, SEC_PER_KILOTICK,
    describeFullTierEstimate, estimateFullTierSeconds, rosterLabels, tickSumOf,
} from './fullTierEstimate.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TAPES = join(REPO, 'frontend/modules/seedlingDemo/fixtures/tapes');

describe('fullTierEstimate', () => {
    /**
     * ⛓⛓⛓ THE CALIBRATION IS A CLAIM ABOUT A MEASUREMENT, so it is checked
     * against that measurement rather than against itself. R9 slice 12h drove
     * the full tier in 143 minutes; the two constants have to reproduce it.
     */
    it('reproduces the 12h full-tier measurement it is calibrated on, within 5 %', () => {
        const { tapes, ticks, minutes } = FULL_TIER_CALIBRATION;
        const predicted = estimateFullTierSeconds({ tapes, ticks }) / 60;
        expect(Math.abs(predicted - minutes) / minutes).toBeLessThan(0.05);
    });

    /**
     * ⛔⛔ THE ROW THAT REFUSES §47.8 ITEM 5's SHAPE. A per-tape estimator
     * cannot tell these two apart; this one must.
     */
    it('prices two rosters of the SAME tape count differently when their ticks differ', () => {
        const short = estimateFullTierSeconds({ tapes: 10, ticks: 1000 });
        const long = estimateFullTierSeconds({ tapes: 10, ticks: 20000 });
        expect(long).toBeGreaterThan(short);
        /* ⛓ …and the whole difference is the tick term, to the second. */
        expect(long - short).toBeCloseTo((SEC_PER_KILOTICK * 19000) / 1000, 6);
    });

    it('charges the fixed per-load cost even for a zero-tick roster', () => {
        expect(estimateFullTierSeconds({ tapes: 3, ticks: 0 }))
            .toBeCloseTo(FIXED_SEC_PER_TAPE * 3, 6);
    });

    /**
     * ⛓ THE SENTENCE CARRIES ITS PROVENANCE. A consumer prints this line and
     * nothing else, so the head the calibration came from has to be in it —
     * otherwise an estimate reads exactly like a measurement.
     */
    it('describes itself with both constants and the head it was calibrated at', () => {
        const said = describeFullTierEstimate({ tapes: 2, ticks: 3000 });
        expect(said).toContain('≈');
        expect(said).toContain(`${FIXED_SEC_PER_TAPE} s × tapes`);
        expect(said).toContain(`${SEC_PER_KILOTICK} s × ticks/1000`);
        expect(said).toContain(FULL_TIER_CALIBRATION.measuredAt);
    });

    /**
     * ⛔ A MISSING TAPE IS A STOP. Contributing 0 would make a roster look
     * CHEAPER the more of it had gone missing — the wrong direction for every
     * decision this feeds.
     */
    it('refuses a label with no tape BY NAME rather than counting it as zero', () => {
        expect(() => tickSumOf(['no-such-tape-p3b'], { tapesDir: TAPES }))
            .toThrow(/no-such-tape-p3b/);
    });

    it('sums the committed roster and agrees with the roster it enumerates', () => {
        const roster = rosterLabels({ tapesDir: TAPES });
        expect(roster).not.toContain('index');
        expect(roster.length).toBeGreaterThan(100);
        expect(tickSumOf(roster, { tapesDir: TAPES })).toBeGreaterThan(0);
    });
});
