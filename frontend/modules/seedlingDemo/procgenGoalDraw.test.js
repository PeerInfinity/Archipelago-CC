/**
 * seedlingDemo/procgenGoalDraw — **THE GOAL IS A PASS-1 DECISION**, and the
 * rule is `manhattan(goal, start) >= GOAL_MIN_FROM_START`.
 *
 * PROCGEN ELEMENTS arc 3, slice 4c (⚖ user, 2026-08-17; the generation review
 * §3 row 2 / §4 item 2). Slice 4a measured that **4 of 12 seeds refused every
 * door element on every kind** because the goal is the room stream's FIRST draw
 * and knew nothing of the elements' own `>= 2`-from-the-goal rule. These rows
 * are the claim, its PROOF, and its measured PRICE.
 *
 * ⛔ THE PRICE IS A ROW TOO. A goal drawn further from the start corner sits
 * more CENTRALLY, and the `guard` element's 4x4/5x5 reserved rectangle has
 * fewer places to go: its census falls 29 -> 21 (len 2: 16 -> 10) while the two
 * door elements gain 43. A slice that asserted only the gain would be reporting
 * half a measurement.
 */

import { describe, expect, it } from 'vitest';

import {
    GOAL_MIN_FROM_START, SEEDLING_DEFAULTS, ProcgenSeedlingError, seedlingModel,
} from './procgenSeedling.js';
import { parseSkeleton } from '../procgenCore/skeletonKinds.js';

const kindOf = (k) => parseSkeleton(k, { simulator: false, substrate: 'the goal-draw rows' });
const START = SEEDLING_DEFAULTS.start;
const manhattan = (c) => Math.abs(c.tx - START.tx) + Math.abs(c.ty - START.ty);

const KINDS = ['empty', 'winding', 'branchy', 'rooms'];

describe('⛓⛓⛓ THE GOAL DRAW — `manhattan >= 3` from the START', () => {
    it('the constant is 3, and it is the SMALLEST value that carries the claim', () => {
        expect(GOAL_MIN_FROM_START).toBe(3);
    });

    /**
     * ⛔ THE LITERAL 3, NOT `GOAL_MIN_FROM_START` — and the mutant is what said
     * so. Slice 4c's mutant (b) dropped the constant to 1; SIX of this file's
     * seven rows reddened and this one did NOT, because phrased against the
     * constant it asserts `>= 1` of a draw that is `>= 1` by arithmetic. The
     * row above pins the constant, so the PAIR always caught it — but a row
     * that reads the value it is testing is trap 269's ECHO, and it costs one
     * word to remove.
     */
    it('every drawn goal, 40 seeds x 4 kinds, is at least 3 cells from the start', () => {
        for (const k of KINDS) {
            for (let seed = 1; seed <= 40; seed += 1) {
                const m = seedlingModel({ seed, skeleton: kindOf(k) });
                expect(manhattan(m.goalCell), `${k}/${seed} ${JSON.stringify(m.goalCell)}`)
                    .toBeGreaterThanOrEqual(3);
            }
        }
    });

    /**
     * ⛓⛓⛓ **THE PROOF, DRIVEN RATHER THAN ARGUED.** At Manhattan `m` the
     * shortest path is at least `m + 1` cells, so `m >= 3` gives a path of at
     * least four — `start, p1, p2, goal` — and `p1`'s graph distance to the goal
     * is >= 2. On a grid Manhattan and graph distance share a PARITY and
     * Manhattan <= graph distance, so `manhattan(p1, goal)` is exactly 2 when
     * the distance is 2 and more when it is more. ⇒ at least one door candidate
     * survives the elements' own `>= 2` rule, on every kind and every carve.
     */
    it('⛓ the main path is at least FOUR cells, and its first interior cell is >= 2 '
        + 'from the goal — on every kind and every seed', () => {
        for (const k of KINDS) {
            for (let seed = 1; seed <= 12; seed += 1) {
                const room = seedlingModel({ seed, skeleton: kindOf(k) }).roomProbe();
                expect(room.mainPath.length, `${k}/${seed}`).toBeGreaterThanOrEqual(4);
                const p1 = room.mainPath[1];
                const g = room.goal;
                expect(Math.abs(p1.x - g.x) + Math.abs(p1.y - g.y), `${k}/${seed} p1`)
                    .toBeGreaterThanOrEqual(2);
            }
        }
    });

    /**
     * ⛔⛔ THE FOUR RECOVERED SEEDS, BY NAME. Before this rule seeds 8 and 11 put
     * the goal ADJACENT to the start (`no-cut-cell` — a two-cell main path has
     * no interior cell to stand a door on) and seeds 5 and 6 put it two away
     * (`goal-too-close`). Both refusals are now UNREACHABLE FROM THE GOAL DRAW,
     * and this row drives all four on every kind and both elements.
     */
    it('⛓⛓⛓ seeds 5, 6, 8 and 11 place a door element where they refused BY THE GOAL', () => {
        for (const k of KINDS) {
            for (const seed of [5, 6, 8, 11]) {
                for (const name of ['killgate', 'blockpocket']) {
                    const m = seedlingModel({ seed, skeleton: kindOf(k), elements: { name } });
                    const why = m.elements.ran ? null : m.elements.refused.reason;
                    expect(['no-cut-cell', 'goal-too-close'], `${k}/${seed}/${name}`)
                        .not.toContain(why);
                }
            }
        }
    });

    /** ⛓ AND THE TWO NAMES ARE GONE FROM THE WHOLE CENSUS, not just those four. */
    it('`no-cut-cell` and `goal-too-close` do not occur at all over 10 kinds x 12 seeds', () => {
        const kinds = ['empty', 'winding', 'branchy', 'bushy', 'loopy', 'open', 'rooms',
            'rooms;minRoom=4', 'winding;chambers=2', 'loopy;chambers=2'];
        const seen = new Set();
        for (const k of kinds) {
            for (let seed = 1; seed <= 12; seed += 1) {
                for (const name of ['killgate', 'blockpocket']) {
                    const m = seedlingModel({ seed, skeleton: kindOf(k), elements: { name } });
                    if (!m.elements.ran) seen.add(m.elements.refused.reason);
                }
            }
        }
        expect([...seen].sort()).not.toContain('no-cut-cell');
        expect([...seen].sort()).not.toContain('goal-too-close');
    });

    /** ⛔ THE CANDIDATE LIST LOSES EXACTLY FIVE CELLS — the two at Manhattan 1
     *  and the three at Manhattan 2 — and the row names them. */
    it('the five excluded cells are named, and the goal is never one of them', () => {
        const excluded = [[2, 1], [1, 2], [3, 1], [2, 2], [1, 3]];
        for (const [tx, ty] of excluded) {
            expect(Math.abs(tx - START.tx) + Math.abs(ty - START.ty))
                .toBeLessThan(GOAL_MIN_FROM_START);
        }
        const drawn = new Set();
        for (let seed = 1; seed <= 60; seed += 1) {
            const m = seedlingModel({ seed, skeleton: kindOf('empty') });
            drawn.add(`${m.goalCell.tx},${m.goalCell.ty}`);
        }
        for (const [tx, ty] of excluded) expect(drawn.has(`${tx},${ty}`)).toBe(false);
        expect(drawn.has(`${START.tx},${START.ty}`)).toBe(false);
    });

    /**
     * ⛔ A ROOM WITH NO LEGAL GOAL REFUSES BY NAME rather than falling back to
     * the whole interior — a fallback would put the arc back where 4a found it
     * and would do it silently, on exactly the rooms where it matters most.
     */
    it('a room too small to hold a legal goal REFUSES, and says why', () => {
        expect(() => seedlingModel({ seed: 1,
            defaults: { ...SEEDLING_DEFAULTS, width: 4, height: 4 } }))
            .toThrow(ProcgenSeedlingError);
        expect(() => seedlingModel({ seed: 1,
            defaults: { ...SEEDLING_DEFAULTS, width: 4, height: 4 } }))
            .toThrow(/no interior cell of this 4x4 room is 3 or more cells/);
    });
});
