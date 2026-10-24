/**
 * `magicalLock.test.js` — R6 slice 2's third stratum.
 *
 * THE MUTATION LIST:
 *
 * 1. `lockType <= shotType` written as `==` (three of four rows still pass)
 * 2. …or as `>=` (the fire wand stops opening the plain lock)
 * 3. the destroy clock DIVIDED instead of accumulated
 * 4. the callback tick read as `hitTick + 15` (an update index IS a tick)
 * 5. the open tick read as the callback tick (the deferred `remove` dropped)
 * 6. the lock treated as non-solid from the HIT tick (the BurnableTree
 *    lesson with a different number)
 * 7. `setPersistence(tag, false)` read as a SET, like a boss tag
 * 8. a re-hit treated as a no-op (the animation does restart)
 * 9. the entity point read as the `.oel` cell (the +8/+8 dropped)
 */

import { describe, expect, it } from 'vitest';

import { FP_MAX_ELAPSED } from './breakableRocks.js';
import { PERSISTENCE_RESPONSE } from './levelWorld.js';
import {
    createMagicalLock,
    hitMagicalLock,
    MAGICAL_LOCK_CALLBACK_TICK_OFFSET,
    MAGICAL_LOCK_DESTROY_ANIM,
    MAGICAL_LOCK_DESTROY_UPDATES,
    MAGICAL_LOCK_GEOMETRY,
    MAGICAL_LOCK_MATRIX,
    MAGICAL_LOCK_OPEN_TICK_OFFSET,
    MAGICAL_LOCK_TYPES,
    magicalLockIsSolid,
    magicalLockOpens,
    MagicalLockError,
    stepMagicalLock,
    WAND_SHOT_TYPES,
} from './magicalLock.js';

describe('lockType <= shotType', () => {
    it('walks all four rows — a `==` passes three of them (mutations 1, 2)', () => {
        for (const row of MAGICAL_LOCK_MATRIX) {
            expect(magicalLockOpens(row.lockType, row.shotType)).toBe(row.opens);
        }
        expect(MAGICAL_LOCK_MATRIX).toHaveLength(4);
        expect(MAGICAL_LOCK_MATRIX.filter((r) => r.opens)).toHaveLength(3);
    });

    it('the one FALSE row is a plain wand against a fire lock', () => {
        const no = MAGICAL_LOCK_MATRIX.filter((r) => !r.opens);
        expect(no).toHaveLength(1);
        expect(no[0]).toMatchObject({ lock: 'magicallockfire', shot: 'wand' });
    });

    it('a plain wand opens L43\'s lockType 0 — the rung\'s north exit', () => {
        expect(MAGICAL_LOCK_TYPES.magicallock).toBe(0);
        expect(WAND_SHOT_TYPES.wand).toBe(0);
        expect(magicalLockOpens(MAGICAL_LOCK_TYPES.magicallock, WAND_SHOT_TYPES.wand)).toBe(true);
    });

    it('refuses a third value rather than guessing', () => {
        expect(() => magicalLockOpens(2, 0)).toThrow(MagicalLockError);
        expect(() => magicalLockOpens(0, -1)).toThrow(/shotType must be 0 or 1/);
    });
});

describe('the destroy clock', () => {
    it('is 15 updates, SIMULATED (mutation 3)', () => {
        expect(MAGICAL_LOCK_DESTROY_UPDATES).toBe(15);
        // The closed form agrees here and is not what runs — pinned as a
        // measurement, per trap 70.
        const divided = Math.ceil(
            MAGICAL_LOCK_DESTROY_ANIM.frameCount
            / (MAGICAL_LOCK_DESTROY_ANIM.frameRate * FP_MAX_ELAPSED),
        );
        expect(divided).toBe(MAGICAL_LOCK_DESTROY_UPDATES);
    });

    it('the callback lands one tick BELOW the update index (mutation 4)', () => {
        // The shot is at the head of the update list (added at run time,
        // `addUpdate` prepends), so the lock's graphic pass on the hit tick
        // IS destroy update 1.
        expect(MAGICAL_LOCK_CALLBACK_TICK_OFFSET).toBe(14);
    });

    it('the cell opens one tick AFTER that — the deferred remove (mutation 5)', () => {
        expect(MAGICAL_LOCK_OPEN_TICK_OFFSET).toBe(15);
        expect(MAGICAL_LOCK_OPEN_TICK_OFFSET).toBe(MAGICAL_LOCK_CALLBACK_TICK_OFFSET + 1);
    });
});

describe('a lock through its whole life', () => {
    const make = () => createMagicalLock('L43#4', { tag: 4, x: 144, y: 112 }, 0);

    it('sits on the cell centre, not the .oel corner (mutation 9)', () => {
        const l = make();
        expect({ x: l.ex, y: l.ey }).toEqual({ x: 152, y: 120 });
        expect(MAGICAL_LOCK_GEOMETRY).toMatchObject({ dx: 8, dy: 8, originX: 8, originY: 8 });
    });

    it('is SOLID for the whole animation and passable one tick later (mutation 6)', () => {
        const l = make();
        expect(magicalLockIsSolid(l, 500)).toBe(true);
        hitMagicalLock(l, 0, 500);
        for (let t = 500; t < 515; t += 1) {
            expect(magicalLockIsSolid(l, t)).toBe(true);
            expect(stepMagicalLock(l, t).removed).toBe(false);
        }
        expect(stepMagicalLock(l, 515).removed).toBe(true);
        expect(magicalLockIsSolid(l, 515)).toBe(false);
    });

    it('CLEARS its persistence — the reverse polarity of a boss tag (mutation 7)', () => {
        const l = make();
        expect(l.persistenceCleared).toBe(false);
        hitMagicalLock(l, 0, 10);
        expect(l.persistenceCleared).toBe(true);
        // …and `check()` on the next boot removes it, which levelWorld owns.
        expect(PERSISTENCE_RESPONSE.magicallock).toBe('despawn');
    });

    it('a shot too weak leaves everything untouched', () => {
        const fire = createMagicalLock('L', { tag: 1, x: 0, y: 0 }, 1);
        expect(hitMagicalLock(fire, 0, 10)).toEqual({ opened: false, restarted: false });
        expect(fire.persistenceCleared).toBe(false);
        expect(fire.hitTick).toBeNull();
        expect(magicalLockIsSolid(fire, 999)).toBe(true);
    });

    it('a RE-HIT restarts the animation and moves the open tick (mutation 8)', () => {
        const l = make();
        hitMagicalLock(l, 0, 100);
        expect(l.openTick).toBe(115);
        const again = hitMagicalLock(l, 0, 105);
        expect(again).toEqual({ opened: true, restarted: true });
        expect(l.openTick).toBe(120);
        // …which is reachable: the lock is still "Solid" and still in the
        // shot's own solids list, so a second shot stops on the same box.
        expect(magicalLockIsSolid(l, 116)).toBe(true);
    });

    it('a removed lock absorbs nothing', () => {
        const l = make();
        hitMagicalLock(l, 0, 0);
        stepMagicalLock(l, 20);
        expect(l.removed).toBe(true);
        expect(hitMagicalLock(l, 0, 21)).toEqual({ opened: false, restarted: false });
    });
});

describe('refusals', () => {
    it('a non-finite placement is refused', () => {
        expect(() => createMagicalLock('L', { x: NaN, y: 0 }, 0)).toThrow(/finite x\/y/);
    });

    it('an unknown lockType is refused at construction', () => {
        expect(() => createMagicalLock('L', { x: 0, y: 0 }, 2)).toThrow(/lockType must be 0 or 1/);
    });
});
