/**
 * playerPhysicsV1 — unit cases.
 *
 * These are the INDEPENDENT stratum of slice 1. Every expected value here
 * is derived by hand from reading the AS3 (and, for Point semantics, the
 * recompiled runtime's C), NOT by running this port and recording what it
 * said. That distinction is the whole reason these tests are worth
 * anything: the fixture-vs-provisional-expectation test in
 * `tapeRunner.test.js` shares this module's assumptions and can only
 * detect change, whereas these can detect being wrong.
 *
 * Two cases exist specifically because the original design brief got them
 * backwards, and a port written to the brief would pass everything else:
 *   - "input() OVERSHOOTS moveSpeed" — the brief said velocity saturates
 *     and is effectively binary per axis
 *   - "Player overrides the movers" is a source fact, exercised here as
 *     the two-add mover loop the overshoot makes typical
 */

import { describe, expect, it } from 'vitest';

import {
    applyFriction,
    applyInput,
    CHECK_OFFSET_Y,
    CLAMP,
    clampFor,
    LEVEL0_WORLD,
    DEFAULT_FRICTION,
    MOVE_SPEEDS,
    moveAxis,
    pointLength,
    pointNormalize,
    sign,
    STAIR_SPEED,
    step,
    WALK_SPEED,
    WATER_SPEED,
} from './playerPhysicsV1.js';

const held = (...keys) => new Set(keys);

describe('constants transcribed from source', () => {
    it('has the 38-entry moveSpeeds table with the right special indices', () => {
        // Player.as:86-89. Only 1, 10, 17, 25, 30 differ from the walk speed.
        expect(MOVE_SPEEDS).toHaveLength(38);
        expect(MOVE_SPEEDS[1]).toBe(WATER_SPEED);      // water
        expect(MOVE_SPEEDS[17]).toBe(WATER_SPEED);     // deep water
        expect(MOVE_SPEEDS[10]).toBe(STAIR_SPEED);     // stairs
        expect(MOVE_SPEEDS[30]).toBe(STAIR_SPEED);     // stairs (dark)
        expect(MOVE_SPEEDS[25]).toBe(WATER_SPEED / 2); // lava
        const special = new Set([1, 10, 17, 25, 30]);
        MOVE_SPEEDS.forEach((s, i) => {
            if (!special.has(i)) expect(s, `index ${i}`).toBe(WALK_SPEED);
        });
    });

    it('derives the world clamp from the LEVEL size, not the screen size', () => {
        // setHitbox(4, 5, 2, 2) (Player.as:295/414) with FP.width/height
        // taken from the level file, NOT from Main's 160x160 screen:
        // Game.as:1854-1855 overwrites them on every load, and level 0
        // (OverWorld.oel) is 320x320.
        expect(LEVEL0_WORLD).toEqual({ width: 320, height: 320 });
        expect(CLAMP).toEqual({ minX: 2, maxX: 318, minY: 2, maxY: 317 });
        // A 160x160 level would give the bounds the screen size suggests —
        // pinning both shows the formula, not a memorised pair of numbers.
        expect(clampFor({ width: 160, height: 160 }))
            .toEqual({ minX: 2, maxX: 158, minY: 2, maxY: 157 });
    });

    it('samples terrain one pixel below the origin', () => {
        // checkOffsetY = -originY + height - 2 = -2 + 5 - 2 (Player.as:416)
        expect(CHECK_OFFSET_Y).toBe(1);
    });

    it('FP.sign returns 0 for zero, not 1', () => {
        expect(sign(-3)).toBe(-1);
        expect(sign(0)).toBe(0);
        expect(sign(3)).toBe(1);
    });
});

describe('flash.geom.Point semantics', () => {
    it('normalizes to the requested length', () => {
        const n = pointNormalize(3, 4, 10);   // length 5 → scale by 2
        expect(n.x).toBeCloseTo(6, 12);
        expect(n.y).toBeCloseTo(8, 12);
    });

    it('leaves a zero vector untouched instead of producing NaN', () => {
        // The AS3 `if (length)` truthiness skips on 0 AND NaN
        // (avm2_globals.c:901). Without this guard friction would make
        // every resting player NaN on its first tick.
        expect(pointNormalize(0, 0, 5)).toEqual({ x: 0, y: 0 });
    });

    it('normalizing to zero length yields exactly zero', () => {
        expect(pointNormalize(0.8, 0.6, 0)).toEqual({ x: 0, y: 0 });
    });
});

describe('friction is VECTOR-length, not per-axis', () => {
    it('removes exactly f from the length of an axis-aligned velocity', () => {
        expect(applyFriction({ x: 0.8, y: 0 }, DEFAULT_FRICTION).x).toBeCloseTo(0.55, 12);
    });

    it('removes ONE friction quantum from a diagonal, not one per axis', () => {
        // Hand-derived: |(0.8,0.8)| = sqrt(1.28) = 1.1313708498984762;
        // target length 1.1313708498984762 - 0.25 = 0.8813708498984762,
        // split evenly between the axes.
        const v = applyFriction({ x: 0.8, y: 0.8 }, DEFAULT_FRICTION);
        expect(pointLength(v.x, v.y)).toBeCloseTo(0.8813708498984762, 12);
        expect(v.x).toBeCloseTo(v.y, 15);
        // Per axis, written as the derivation rather than a recorded
        // constant so it stays checkable by hand:
        //   0.8 * (|v| - f) / |v|,  |v| = sqrt(0.8^2 + 0.8^2)
        const len = Math.sqrt(1.28);
        expect(v.x).toBeCloseTo(0.8 * (len - DEFAULT_FRICTION) / len, 12);
        // A per-axis port would give 0.55 on each axis (combined length
        // 0.778). This is the divergence the brief warns about, pinned.
        expect(v.x).toBeGreaterThan(0.55);
    });

    it('snaps a component under 0.05 to exactly zero', () => {
        // Mobile.as:75-83 — this is why the player ever comes to rest.
        expect(applyFriction({ x: 0.04, y: 0 }, 0).x).toBe(0);
        expect(applyFriction({ x: 0.05, y: 0 }, 0).x).toBe(0.05); // < is strict
    });

    it('cannot drive length below zero', () => {
        expect(applyFriction({ x: 0.1, y: 0 }, DEFAULT_FRICTION)).toEqual({ x: 0, y: 0 });
    });
});

describe('input() OVERSHOOTS moveSpeed — it is not a clamp', () => {
    it('adds the full accel whenever the axis is under the cap', () => {
        // Player.as:1500-1503 — `if (v.x < moveSpeed) v.x += accel`, and
        // accel === moveSpeed. From 0.55 that lands at 1.35, well past the
        // 0.8 "cap". A clamping implementation would answer 0.8.
        const v = applyInput({ x: 0.55, y: 0 }, held('right'), WALK_SPEED);
        expect(v.x).toBeCloseTo(1.35, 12);
        expect(v.x).toBeGreaterThan(WALK_SPEED);
    });

    it('does nothing once the axis is at or above the cap', () => {
        expect(applyInput({ x: 0.8, y: 0 }, held('right'), WALK_SPEED).x).toBe(0.8);
        expect(applyInput({ x: 1.1, y: 0 }, held('right'), WALK_SPEED).x).toBe(1.1);
    });

    it('produces a limit cycle when a direction is held, not a constant speed', () => {
        // The corrected behaviour, hand-derived tick by tick from
        // friction (-0.25 of length) alternating with the threshold add:
        const expected = [0.8, 1.35, 1.1, 0.85, 1.4, 1.15, 0.9, 1.45, 1.2, 0.95];
        let v = { x: 0, y: 0 };
        const seen = [];
        for (let t = 0; t < expected.length; t++) {
            v = applyFriction(v, DEFAULT_FRICTION);
            v = applyInput(v, held('right'), WALK_SPEED);
            seen.push(v.x);
        }
        seen.forEach((x, i) => expect(x, `tick ${i}`).toBeCloseTo(expected[i], 12));
        // The claim that matters: peak velocity is nearly 2x moveSpeed.
        expect(Math.max(...seen)).toBeGreaterThan(1.4);
    });

    it('applies opposite keys in source order, both firing', () => {
        // Four independent ifs, not an else-chain (Player.as:1492-1519):
        // up runs first (y > -0.8 → -0.8), then down sees -0.8 < 0.8 → +0.8.
        expect(applyInput({ x: 0, y: 0 }, held('up', 'down'), WALK_SPEED).y)
            .toBeCloseTo(0, 12);
    });
});

describe('the mover loop', () => {
    it('moves the full amount in one iteration when |rel| <= 1', () => {
        expect(moveAxis(80, 0.8)).toBeCloseTo(80.8, 12);
    });

    it('runs TWO iterations for the typical |rel| > 1 case', () => {
        // 1.35 → +1 then +0.35. Typical because input() overshoots.
        expect(moveAxis(80, 1.35)).toBeCloseTo(81.35, 12);
        expect(moveAxis(80, -1.35)).toBeCloseTo(78.65, 12);
    });

    it('runs no iterations at zero velocity', () => {
        expect(moveAxis(80, 0)).toBe(80);
    });
});

describe('step()', () => {
    it('reaches walk speed on the first held tick', () => {
        const s = step({ x: 80, y: 128, vx: 0, vy: 0 }, held('right'));
        expect(s.vx).toBeCloseTo(0.8, 12);
        expect(s.x).toBeCloseTo(80.8, 12);
        expect(s.y).toBe(128);
    });

    it('travels exactly 1.70px from a single 1-tick tap', () => {
        // Independent hand-derivation: 0.8 + 0.55 + 0.30 + 0.05, then the
        // snap zeroes it. This quantum is what bounds how precisely the bot
        // driver can ever stop (botDriverV1's tolerance note).
        let s = step({ x: 80, y: 128, vx: 0, vy: 0 }, held('right'));
        for (let i = 0; i < 20; i++) s = step(s, held());
        expect(s.x - 80).toBeCloseTo(1.7, 12);
        expect(s.vx).toBe(0);
    });

    it('honours the terrain seam — noclip does NOT bypass terrain speed', () => {
        // getState() types the tile under the player independently of
        // collision (Player.as:656), so a water tile really is slower.
        const water = step({ x: 80, y: 128, vx: 0, vy: 0 }, held('right'),
            { terrainStateAt: () => 1 });
        expect(water.vx).toBeCloseTo(WATER_SPEED, 12);
        expect(water.x).toBeCloseTo(80.45, 12);
    });

    it('throws on a terrain state outside the speed table', () => {
        expect(() => step({ x: 80, y: 128, vx: 0, vy: 0 }, held('right'),
            { terrainStateAt: () => 99 })).toThrow(/outside the/);
    });

    it('clamps to the world bounds as part of the tick', () => {
        let s = { x: 4, y: 128, vx: 0, vy: 0 };
        for (let i = 0; i < 20; i++) s = step(s, held('left'));
        expect(s.x).toBe(CLAMP.minX);
    });

    it('moves nothing at all while frozen', () => {
        // Game.freezeObjects gates the whole friction/input/move block
        // (Mobile.as:33-40) — which is why a frozen tick must not consume
        // tape on the AS3 side.
        const s = step({ x: 80, y: 128, vx: 0.8, vy: 0 }, held('right'), { frozen: true });
        expect(s).toEqual({ x: 80, y: 128, vx: 0.8, vy: 0 });
    });

    it('resolves X fully before Y', () => {
        // Mobile.as:37-38 order. Invisible without collision, but the order
        // is transcribed now so v2 inherits it rather than rediscovering it.
        const s = step({ x: 80, y: 128, vx: 0, vy: 0 }, held('right', 'down'));
        expect(s.x).toBeCloseTo(80.8, 12);
        expect(s.y).toBeCloseTo(128.8, 12);
    });
});
