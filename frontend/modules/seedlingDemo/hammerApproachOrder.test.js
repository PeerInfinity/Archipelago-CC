/**
 * seedlingDemo/hammerApproachOrder.test — ⛓⛓ SEEDLING HAMMER-PHASE BK2-APPROACH-ORDER (`TURRET_APPROACH_VOLLEY_ORDER`,
 * OFF): `approachKillForCorpse`'s tries asked in the volley's order. The fast rows: the switch ships OFF and the env
 * alone turns it on; the wait order off an anchor (`approachWaitOrder`) is every wait once, the anchor first, outward,
 * the earlier of a pair first; with no anchor it is OFF's ascending order; the name rides the solver env channel.
 * The solves (L40's Boss Key 2 from L39 and from L43, the page's own requests) are `hammerApproachOrder.train.test.js`.
 */
import { describe, expect, it } from 'vitest';

import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import {
    TURRET_APPROACH_VOLLEY_ORDER, TURRET_APPROACH_VOLLEY_ORDER_DEFAULT, approachWaitOrder, withTurretApproachVolleyOrder,
} from './solverBot.js';

const ASCENDING = Array.from({ length: 49 }, (_, w) => w);

describe('hammer-phase BK2-APPROACH-ORDER: TURRET_APPROACH_VOLLEY_ORDER', () => {
    it('ships OFF, the env alone turns it on, and the scope restores it', () => {
        expect(TURRET_APPROACH_VOLLEY_ORDER_DEFAULT).toBe(false);
        expect(TURRET_APPROACH_VOLLEY_ORDER.enabled).toBe(process.env.SEEDLING_TURRET_APPROACH_VOLLEY_ORDER === '1');
        const was = TURRET_APPROACH_VOLLEY_ORDER.enabled;
        expect(withTurretApproachVolleyOrder(true, () => TURRET_APPROACH_VOLLEY_ORDER.enabled)).toBe(true);
        expect(withTurretApproachVolleyOrder(false, () => TURRET_APPROACH_VOLLEY_ORDER.enabled)).toBe(false);
        expect(TURRET_APPROACH_VOLLEY_ORDER.enabled).toBe(was);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_TURRET_APPROACH_VOLLEY_ORDER');
    });

    it('no anchor (no startshot seen from the route\'s first waypoint): the waits ascend, as OFF asks them', () => {
        expect(approachWaitOrder(null)).toEqual(ASCENDING);
    });

    it('an anchor: the anchor first, then outward, the earlier of each pair first — every wait exactly once', () => {
        expect(approachWaitOrder(32).slice(0, 9)).toEqual([32, 31, 33, 30, 34, 29, 35, 28, 36]);
        for (const a of [1, 17, 32, 47]) {
            const order = approachWaitOrder(a);
            expect([...order].sort((x, y) => x - y)).toEqual(ASCENDING);
            for (let k = 1; k < order.length; k += 1) {
                const d = Math.abs(order[k] - a) - Math.abs(order[k - 1] - a);
                expect(d > 0 || (d === 0 && order[k] > order[k - 1])).toBe(true);
            }
        }
    });

    it('an anchor on the range\'s edge runs the one way there is', () => {
        expect(approachWaitOrder(0)).toEqual(ASCENDING);
        expect(approachWaitOrder(48)).toEqual([...ASCENDING].reverse());
    });
});
