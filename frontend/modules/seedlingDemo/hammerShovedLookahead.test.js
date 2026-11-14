/**
 * ⛓⛓ SEEDLING HAMMER-PHASE L40-SPINNER-WALLS — `SHOVED_BODY_LOOKAHEAD` (OFF): when the run's own spinner forecast moves a
 * body faster than `SPINNER.moveSpeed` (a shield bump's or a landing's shove), the walk's survival horizon scales with
 * that speed (`shovedHorizon`, capped at two `STEP_LOOKAHEAD` spans), and a no-aim or charted key must outlast it. The
 * slow solve rows are `hammerShovedLookahead.train.test.js`.
 *
 * These rows pin the switch and the horizon rule on hand-built forecast rows (the shape `spinnerForecast` returns: one
 * array of rects per row, the same bodies in the same order); the speeds are the witness's measured ones (report § 3).
 */
import { describe, expect, it } from 'vitest';

import { SHOVED_BODY_LOOKAHEAD, shovedHorizon, withShovedBodyLookahead } from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { SPINNER } from './spinner.js';

/** `n` forecast rows of one body starting at (x, y), moving (vx, vy) per row, plus a still second body. */
function rows(n, vx, vy, x = 100, y = 100) {
    return Array.from({ length: n }, (_, i) => [
        { x: x + vx * i, y: y + vy * i, right: x + vx * i + SPINNER.w, bottom: y + vy * i + SPINNER.h },
        { x: 10, y: 10, right: 10 + SPINNER.w, bottom: 10 + SPINNER.h },
    ]);
}

describe('SHOVED_BODY_LOOKAHEAD — the switch', () => {
    it('ships OFF, is in the page channel\'s table, and the wrapper restores (also on a throw)', () => {
        expect(SHOVED_BODY_LOOKAHEAD.enabled).toBe(false);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_SHOVED_BODY_LOOKAHEAD');
        expect(withShovedBodyLookahead(true, () => SHOVED_BODY_LOOKAHEAD.enabled)).toBe(true);
        expect(SHOVED_BODY_LOOKAHEAD.enabled).toBe(false);
        expect(() => withShovedBodyLookahead(true, () => { throw new Error('x'); })).toThrow('x');
        expect(SHOVED_BODY_LOOKAHEAD.enabled).toBe(false);
    });
});

describe('shovedHorizon — the survival horizon a forecast asks for', () => {
    it('a body at moveSpeed (any heading, float noise included) keeps the four-tick lookahead', () => {
        const c = Math.cos(-Math.PI / 4) * SPINNER.moveSpeed;
        expect(shovedHorizon(rows(6, c, c))).toBe(4);
        expect(shovedHorizon(rows(6, SPINNER.moveSpeed, 0))).toBe(4);
        expect(shovedHorizon(rows(6, 0, 0))).toBe(4);
        expect(shovedHorizon([])).toBe(4);
    });

    it('a shoved body scales it by its speed over moveSpeed, rounded up, capped at two spans', () => {
        expect(shovedHorizon(rows(6, 1.5, 0))).toBe(6);
        expect(shovedHorizon(rows(6, -1.2, 1.2))).toBe(7); // |v| = 1.70
        // the witness's rebound speeds (clock 5225 t647: 4.86 px/tick; clock 5241 t1362: 3.4 px/tick)
        expect(shovedHorizon(rows(6, 4.86, 0))).toBe(8);
        expect(shovedHorizon(rows(6, -3.4, 0))).toBe(8);
    });

    it('rows are compared only while they hold the same bodies (a removal stops the read)', () => {
        const r = rows(6, 1, 0);
        r[3] = r[3].slice(0, 1);
        r[4] = [{ x: 0, y: 0, right: 7, bottom: 7 }];
        expect(shovedHorizon(r)).toBe(4);
        const s = rows(6, 1, 0);
        s[2] = [{ ...s[2][0], x: s[2][0].x + 5 }, s[2][1]]; // a shove between rows 1 and 2
        expect(shovedHorizon(s)).toBe(8);
    });
});
