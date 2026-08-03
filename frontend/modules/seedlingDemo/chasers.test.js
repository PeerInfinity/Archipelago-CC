/**
 * chasers — the exact step for `bob` and `jellyfish`.
 *
 * Hand-derived from `Enemies/Bob.as`, `Enemies/Jellyfish.as`,
 * `Enemies/Enemy.as` and `Mobile.as`. The second stratum is the live
 * game: the first kill pair either opens L60's lock or does not.
 */

import { describe, expect, it } from 'vitest';

import { ENEMY_CLASSES } from './combat.js';
import {
    animTicks,
    applyFriction,
    chaseImpulse,
    chaserBoxAt,
    chaserStep,
    CHASERS,
    deathTicks,
    FP_ELAPSED,
    FRICTION,
    killWindowTicks,
    VELOCITY_EPSILON,
} from './chasers.js';

describe('the animation clock', () => {
    it('FP.elapsed is the 30 fps clamp, not the frame time', () => {
        // `Engine.as:162` clamps at MAX_ELAPSED = 0.0333, and the bot runs
        // at ~24 fps (Windows) and ~0.4 fps (SwiftShader) — both under 30,
        // so both clamp.
        expect(FP_ELAPSED).toBe(0.0333);
    });

    it('⛔ a 30 fps five-frame animation takes SIX ticks, not five', () => {
        // The step is 30 * 0.0333 = 0.999. Five whole units need six ticks.
        // That fencepost is how long `slashing` stays up.
        expect(animTicks(5, 30)).toBe(6);
        expect(animTicks(3, 20)).toBe(5);      // "slashnarrow"
    });

    it('refuses nonsense rather than returning Infinity', () => {
        expect(() => animTicks(0, 30)).toThrow(/positive integer/);
        expect(() => animTicks(5, 0)).toThrow(/frameRate must be positive/);
    });
});

describe('death is an animation, and the body is still counted during it', () => {
    it('a bob takes 25 ticks to leave the world, a jellyfish 35', () => {
        // Bob "die" is [3,4,5,6] at 5 -> ceil(4 / 0.1665) = 25.
        // Jellyfish "die" is 8 frames at 7 -> ceil(8 / 0.2331) = 35.
        expect(deathTicks('bob')).toBe(25);
        expect(deathTicks('jellyfish')).toBe(35);
        expect(killWindowTicks('jellyfish')).toBe(36);
    });

    it('refuses a class nobody transcribed', () => {
        expect(() => deathTicks('turret')).toThrow(/not a transcribed chaser/);
    });
});

describe('the freeze gate differs BY CLASS', () => {
    it('a bob stops chasing while frozen; a jellyfish does not', () => {
        // `Bob.update`: `if (destroy || anim=="die" || Game.freezeObjects) return;`
        // `Jellyfish.update`: `if (destroy || anim=="die") return;`
        expect(CHASERS.bob.freezesOnGameFreeze).toBe(true);
        expect(CHASERS.jellyfish.freezesOnGameFreeze).toBe(false);

        const start = { x: 100, y: 100, v: { x: 0, y: 0 } };
        const player = { x: 140, y: 100 };
        const bob = chaserStep('bob', start, player, { frozen: true });
        expect(bob.v).toEqual({ x: 0, y: 0 });
        const jelly = chaserStep('jellyfish', start, player, { frozen: true });
        expect(jelly.v.x).toBeGreaterThan(0);
    });

    it('and neither MOVES while frozen — that half is shared', () => {
        // `Mobile.mobileUpdate` skips friction/input/move under the freeze
        // for both; only the chase impulse differs.
        const start = { x: 100, y: 100, v: { x: 3, y: 0 } };
        for (const tag of ['bob', 'jellyfish']) {
            const s = chaserStep(tag, start, { x: 140, y: 100 }, { frozen: true });
            expect(s.x).toBe(100);
            expect(s.y).toBe(100);
        }
    });
});

describe('the off-screen return does not stop the chase', () => {
    it('⛔ but the velocity CONVERGES on moveSpeed — it does not run away', () => {
        // `Enemy.update`'s first line returns before `Mobile.mobileUpdate`,
        // so no friction and no move — but `Bob.update` runs its chase block
        // AFTER that call, so `v` accumulates with nothing to spend it on.
        //
        // The first version of this test asserted 0.5, 1, 1.5, 2, 2.5 —
        // "unbounded", which is what the shape of the code suggests and
        // what the module's own header claimed. It is wrong: the impulse is
        // `sign(toV.x - v.x) * moveSpeed`, bang-bang TOWARD the target
        // velocity, so the term is exactly zero once `v.x` reaches `toV.x`.
        // The camera's arrival therefore releases one ordinary step, not a
        // stored-up lurch — and a planner built on the wrong version would
        // hard-avoid rooms that are fine.
        let e = { x: 100, y: 100, v: { x: 0, y: 0 } };
        const player = { x: 160, y: 100 };
        const speeds = [];
        for (let i = 0; i < 5; i += 1) {
            e = chaserStep('bob', e, player, { onScreen: false });
            speeds.push(Math.hypot(e.v.x, e.v.y));
        }
        expect(e.x).toBe(100);
        expect(speeds).toEqual([0.5, 0.5, 0.5, 0.5, 0.5]);
        // And the i-frames do not tick down either — `hitUpdate` is in the
        // part that returned.
        expect(chaserStep('bob', e, player, { onScreen: false }).iframesTicked)
            .toBe(false);
    });
});

describe('the chase block', () => {
    it('does nothing outside the leash, and does not decelerate', () => {
        // `if (d <= runRange)` — outside it the velocity is simply left
        // alone, and friction is what brings a coasting enemy down.
        const e = { x: 0, y: 0, v: { x: 0.4, y: 0 } };
        expect(chaseImpulse('bob', e, { x: 200, y: 0 })).toEqual({ x: 0.4, y: 0 });
        expect(chaseImpulse('jellyfish', e, { x: 200, y: 0 })).toEqual({ x: 0.4, y: 0 });
    });

    it('the leashes are 80 and 160, from the census', () => {
        expect(ENEMY_CLASSES.bob.aggro.range).toBe(80);
        expect(ENEMY_CLASSES.jellyfish.aggro.range).toBe(160);
        // 159 is inside the jellyfish's leash and well outside a bob's.
        const e = { x: 0, y: 0, v: { x: 0, y: 0 } };
        expect(chaseImpulse('bob', e, { x: 159, y: 0 })).toEqual({ x: 0, y: 0 });
        expect(chaseImpulse('jellyfish', e, { x: 159, y: 0 }).x).toBeGreaterThan(0);
    });

    it('accelerates by moveSpeed per axis and re-normalises to moveSpeed', () => {
        // From rest, toward a target due east: sign(0.5 - 0) * 0.5 = +0.5 on
        // x and sign(0 - 0) * 0.5 = 0 on y. |v| is then exactly moveSpeed,
        // which is NOT `> moveSpeed`, so the normalise does not fire.
        const e = { x: 0, y: 0, v: { x: 0, y: 0 } };
        expect(chaseImpulse('bob', e, { x: 40, y: 0 })).toEqual({ x: 0.5, y: 0 });
        // Diagonally, both axes get the full step and |v| = 0.707 > 0.5, so
        // the normalise brings it back to exactly moveSpeed.
        const d = chaseImpulse('bob', e, { x: 40, y: 40 });
        expect(Math.hypot(d.x, d.y)).toBeCloseTo(0.5, 12);
    });

    it('⚠ `pushed` is measured BEFORE the impulse, so knockback survives', () => {
        // An enemy already moving faster than its own speed keeps the
        // excess: the re-normalise is gated on `!pushed`. Cancelling a
        // knockback on the next tick would make every hit look like it
        // landed on a wall.
        const knocked = { x: 0, y: 0, v: { x: -4, y: 0 } };
        const out = chaseImpulse('bob', knocked, { x: 40, y: 0 });
        expect(out).toEqual({ x: -3.5, y: 0 });
        expect(Math.hypot(out.x, out.y)).toBeGreaterThan(ENEMY_CLASSES.bob.speed);
    });

    it('refuses a class it has not transcribed', () => {
        expect(() => chaseImpulse('turret', { x: 0, y: 0, v: { x: 0, y: 0 } }, { x: 0, y: 0 }))
            .toThrow(/not a transcribed chaser/);
    });
});

describe('friction', () => {
    it('subtracts along the vector, never per axis', () => {
        // `v.normalize(max(v.length - f, 0))` — a diagonal loses 0.25 of its
        // LENGTH, not 0.25 on each axis.
        const out = applyFriction({ x: 3, y: 4 });
        expect(Math.hypot(out.x, out.y)).toBeCloseTo(5 - FRICTION, 12);
        expect(out.x / out.y).toBeCloseTo(3 / 4, 12);
    });

    it('zeroes a component under 0.05 — the subtractive stop', () => {
        expect(VELOCITY_EPSILON).toBe(0.05);
        expect(applyFriction({ x: 0.26, y: 0 })).toEqual({ x: 0, y: 0 });
    });

    it('leaves the zero vector alone rather than producing NaN', () => {
        // `Point.normalize` on (0,0) is a no-op in Flash; a naive
        // divide-by-length would put NaN into the position and every
        // downstream comparison would silently become false.
        expect(applyFriction({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    });
});

describe('the tick order is friction, move, THEN chase', () => {
    it('the velocity a tick moves is the PREVIOUS tick\'s chase', () => {
        // `Mobile.mobileUpdate` runs friction and the move inside
        // `super.update()`; the subclass adds to `v` afterwards. So a
        // chaser that has just woken does not move on its waking tick.
        const e = { x: 100, y: 100, v: { x: 0, y: 0 } };
        const s1 = chaserStep('bob', e, { x: 140, y: 100 });
        expect(s1.x).toBe(100);
        expect(s1.v).toEqual({ x: 0.5, y: 0 });
        // Next tick: friction takes 0.25 off the length, the move applies
        // the remaining 0.25, and the chase tops it back up.
        const s2 = chaserStep('bob', s1, { x: 140, y: 100 });
        expect(s2.x).toBeCloseTo(100.25, 12);
    });

    it('an injected move hook is used instead of the free move', () => {
        // The solid sweep is the caller's, so this module has no opinion
        // about which world it is stepping.
        const stuck = () => ({ x: 7, y: 9 });
        const s = chaserStep('jellyfish', { x: 100, y: 100, v: { x: 5, y: 5 } },
            { x: 140, y: 100 }, { move: stuck });
        expect(s.x).toBe(7);
        expect(s.y).toBe(9);
    });

    it('a dying body neither chases nor is re-woken', () => {
        const s = chaserStep('jellyfish', { x: 100, y: 100, v: { x: 0, y: 0 }, dying: true },
            { x: 104, y: 100 });
        expect(s.v).toEqual({ x: 0, y: 0 });
    });
});

describe('the placements come from the census, not from here', () => {
    it('the box is built from ENEMY_CLASSES\' hitbox', () => {
        // Slice 2's headline defect was a second placement transcription
        // that disagreed with the first by eight pixels on every enemy.
        expect(chaserBoxAt('jellyfish', 100, 100))
            .toEqual({ x: 94, y: 94, w: 12, h: 12, right: 106, bottom: 106 });
        expect(chaserBoxAt('bob', 100, 100))
            .toEqual({ x: 96, y: 96, w: 8, h: 8, right: 104, bottom: 104 });
    });

    it('and the ctor offset is +8/+8 for both — never the .oel coordinate', () => {
        expect(ENEMY_CLASSES.bob.ctor).toMatchObject({ dx: 8, dy: 8 });
        expect(ENEMY_CLASSES.jellyfish.ctor).toMatchObject({ dx: 8, dy: 8 });
    });

    it('this module carries NO speed or leash of its own', () => {
        // A second copy is a second thing to get wrong. Asserted rather than
        // trusted, because the temptation to inline `0.8` is exactly how the
        // slice-2 defect got in.
        for (const c of Object.values(CHASERS)) {
            expect(c).not.toHaveProperty('speed');
            expect(c).not.toHaveProperty('runRange');
            expect(c).not.toHaveProperty('hitbox');
        }
    });
});
