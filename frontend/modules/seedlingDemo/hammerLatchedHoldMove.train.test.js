/**
 * ⛓ hammer-phase LATCHED-HOLD — the witness row (train tier: two solves of a captured page request, ~65 s).
 *
 * The whole-game walk's request A1 32:12 (L40's Totem Part from the south): OFF, the presser hold on
 * `buttonroom@160,128` refuses — the stance is inside a lobber's reach and no pacing is clean (MOVING_WAIT). ON
 * (`LATCHED_HOLD_MOVE`), the group has latched before the hold, so the wait is spent off the stance; the request solves
 * and the plan, replayed on a fresh run, takes no hit and no death.
 */
import { describe, expect, it } from 'vitest';

import { LATCHED_HOLD_MOVE_COUNTS, resetLatchedHoldMoveCounts, withLatchedHoldMove } from './solverBot.js';
import { solveCapturedA1 } from './hammerLatchedHoldMoveRows.js';

describe('LATCHED_HOLD_MOVE — A1 32:12 (L40 Totem Part 64,144, the latched bombpusher hold)', () => {
    it('OFF: refuses on the hold, by name (MOVING_WAIT), byte-identical to the capture\'s answer', () => {
        resetLatchedHoldMoveCounts();
        const out = withLatchedHoldMove(false, () => solveCapturedA1());
        expect(out.ok).toBe(false);
        expect(out.answer).toBe('599d2ef41b84');
        expect(out.message).toMatch(/contact -> hold: the hold stands still for up to 131 tick\(s\)/);
        expect(out.message).toMatch(/no pacing is clean \(MOVING_WAIT/);
        expect(LATCHED_HOLD_MOVE_COUNTS.asked).toBe(0);
    }, 240_000);

    it('ON: solves hitless — the wait ends off the stance, and the fresh replay takes no hit or death', () => {
        resetLatchedHoldMoveCounts();
        const out = withLatchedHoldMove(true, () => solveCapturedA1());
        expect(out.ok).toBe(true);
        expect(out.answer).toBe('a404ddf42e41');
        expect(out.ticks).toBe(1889);
        expect(out.modelHits).toEqual({ hits: 0, deaths: 0 });
        expect(out.hits).toEqual([]);
        expect(out.deaths).toBe(0);
        expect(out.end.level).toBe(40);
        const moves = LATCHED_HOLD_MOVE_COUNTS.moves;
        expect(moves.length).toBeGreaterThan(0);
        expect(moves[0]).toMatchObject({ presser: 'buttonroom@160,128', group: 1, t: 1553, target: { x: 248, y: 103 },
            ticks: 130, forks: 1 });
    }, 240_000);
});
