/**
 * r5Swim — the drown DECLARATION, driven through all four of its quadrants.
 *
 * `drownFinding` is the only piece of harness policy this arc has that can
 * turn a hard failure into a pass, so it gets the treatment the
 * `saw_input_refused` precedent gets: every combination of (declared?,
 * timer) asserted here, in milliseconds, rather than only ever observed
 * passing at the end of a twenty-minute replay. A check that has never
 * failed is indistinguishable from one that cannot.
 *
 * ⚠ THE DECLARED QUADRANTS ARE DRIVEN THROUGH AN INJECTED TABLE, and that
 * is not a convenience. The shipped `DROWN_EXPECTED` is EMPTY until the arm
 * that needs it is recorded — the roster guard refuses an entry naming a
 * fixture the repo does not have — so a test that read only the shipped
 * table would leave the two declared quadrants unexercised for exactly as
 * long as they matter most.
 */

import { describe, expect, it } from 'vitest';

import { DROWN_TIMER_MAX as PHYSICS_DROWN_TIMER_MAX } from './playerPhysicsV2.js';
import {
    DROWN_EXPECTED, DROWN_EXPECTED_NAMES, DROWN_TIMER_MAX, R5SwimError,
    drownDeclarationRosterFindings, drownFinding,
} from './r5Swim.js';

const UNDECLARED = 'r5-karlore-fire';
const DECLARED = 'a-declared-drowning-arm';
/** The shape the shipped table will carry once its fixture exists. */
const TABLE = Object.freeze({
    [DECLARED]: Object.freeze({ minTicks: 3, maxTicks: 9, why: 'the armed-water witness' }),
});
/**
 * `checkDrowning` writes MAX on the FIRST contact tick without decrementing
 * and decrements on every later one, so contact ticks and timer values run
 * in opposite directions: `contact = MAX - timer + 1`.
 */
const timerFor = (contact) => DROWN_TIMER_MAX - contact + 1;

describe('the drown declaration, in all four quadrants', () => {
    it('UNDECLARED + timer 0 — the ordinary pass, and the positive control', () => {
        const f = drownFinding(UNDECLARED, 0, TABLE);
        expect(f.ok).toBe(true);
        expect(f.name).toContain('never started drowning');
    });

    it('⛔ UNDECLARED + timer non-zero — still the hard failure it always was', () => {
        // The whole point of the declaration is that it does not loosen
        // this. A tape nobody declared that drowned is a route defect, and
        // the detail points at the table rather than hiding it.
        const f = drownFinding(UNDECLARED, 7, TABLE);
        expect(f.ok).toBe(false);
        expect(f.detail).toContain('DROWN_EXPECTED');
    });

    it('DECLARED + timer non-zero — the armed-water witness, and it PASSES', () => {
        const f = drownFinding(DECLARED, timerFor(5), TABLE);
        expect(f.ok).toBe(true);
        expect(f.name).toContain('DECLARED drowning fired');
    });

    it('⛔⛔ DECLARED + timer 0 — a RED, because a control that did not drown '
        + 'is a pair that proves nothing', () => {
        const f = drownFinding(DECLARED, 0, TABLE);
        expect(f.ok).toBe(false);
        expect(f.detail).toContain('never fired');
    });

    it('and the two names differ, so a reader can tell which check ran', () => {
        expect(drownFinding(UNDECLARED, 0, TABLE).name)
            .not.toBe(drownFinding(DECLARED, timerFor(5), TABLE).name);
    });
});

describe('the band, and why it has both edges', () => {
    const decl = TABLE[DECLARED];

    it('the declared band\'s interior passes', () => {
        for (let c = decl.minTicks; c <= decl.maxTicks; c += 1) {
            expect(drownFinding(DECLARED, timerFor(c), TABLE).ok, `${c} contact tick(s)`)
                .toBe(true);
        }
    });

    it('⛔ one tick UNDER the floor fails — too brief to be a deliberate stand', () => {
        expect(drownFinding(DECLARED, timerFor(decl.minTicks - 1), TABLE).ok).toBe(false);
    });

    it('⛔ one tick OVER the ceiling fails — the next tick is `die()`', () => {
        expect(drownFinding(DECLARED, timerFor(decl.maxTicks + 1), TABLE).ok).toBe(false);
    });

    it('⚠ the ceiling exists because the MODEL throws on the death, not as taste', () => {
        // `checkDrowning` latches `drowning` on the eleventh cumulative
        // contact tick and `playerPhysicsV2.step` throws on the death that
        // follows. A declared arm is allowed to drown and is not allowed to
        // die — a dead player's stream is a respawn, not a comparison.
        expect(DROWN_TIMER_MAX).toBe(PHYSICS_DROWN_TIMER_MAX);
        expect(timerFor(DROWN_TIMER_MAX)).toBe(1);
    });
});

describe('the readings that are not answers', () => {
    it('no timer at all yields NO finding — a pre-R5 build is not this check\'s business', () => {
        expect(drownFinding(UNDECLARED, undefined, TABLE)).toBeNull();
        expect(drownFinding(UNDECLARED, null, TABLE)).toBeNull();
    });

    it('⛔ a non-numeric readout FAILS rather than passing vacuously', () => {
        // The old `status.drown_timer === 0` would have been false for a
        // string "0" and true for nothing else. A check that cannot answer
        // must not pass, whichever way it cannot answer — and it must not
        // pass on the DECLARED side either.
        for (const bad of ['0', NaN, {}, []]) {
            expect(drownFinding(UNDECLARED, bad, TABLE)?.ok, JSON.stringify(bad)).toBe(false);
            expect(drownFinding(DECLARED, bad, TABLE)?.ok, JSON.stringify(bad)).toBe(false);
        }
    });
});

describe('the declaration cannot rot', () => {
    it('every SHIPPED declaration names a real fixture', async () => {
        const { fixtureNames } = await import('./fixtures/index.js');
        const [f] = drownDeclarationRosterFindings(fixtureNames());
        expect(f.ok, f.detail).toBe(true);
    });

    it('⛔ and a declaration whose fixture is missing goes red', () => {
        // Driven through the roster rather than the table, because the
        // shipped table is empty: an empty table against an empty roster is
        // vacuously fine, and this is the arm that has to work.
        const [f] = drownDeclarationRosterFindings([]);
        for (const n of DROWN_EXPECTED_NAMES) expect(f.detail).toContain(n);
        expect(f.ok).toBe(DROWN_EXPECTED_NAMES.length === 0);
    });

    it('the roster check refuses a caller that passes nothing', () => {
        expect(() => drownDeclarationRosterFindings(undefined)).toThrow(R5SwimError);
    });

    it('⚠ the shipped table is a list of NAMES with well-formed bands', () => {
        // `feedback_coincidental_predicate_rots`. A predicate over "declares
        // water armed" would sweep in the SWIM arm, whose entire claim is
        // that it crossed armed water and the timer never started.
        for (const [name, d] of Object.entries(DROWN_EXPECTED)) {
            expect(typeof name).toBe('string');
            expect(d.why, name).toMatch(/\S/);
            expect(d.minTicks, name).toBeGreaterThan(0);
            expect(d.maxTicks, name).toBeGreaterThanOrEqual(d.minTicks);
            expect(d.maxTicks, name).toBeLessThan(DROWN_TIMER_MAX + 1);
        }
    });
});
