/**
 * wallFlyer — R2-swim D1. The transcription's own terms, hand-derived from
 * `Enemies/WallFlyer.as`; the game's word on them is `r2-wallflyer-contact` /
 * `r2-wallflyer-suit` (tapeRunner) and their body probe (244/244 each).
 */

import { describe, expect, it } from 'vitest';

import {
    WALLFLYER, decideMotion, hitWallFlyer, newWallFlyer, stepWallFlyer, stepWallFlyerGraphic,
    wallFlyerFriction, wallFlyerRect,
} from './wallFlyer.js';

/** A wall occupying x < 48 (a rock face), and nothing else. */
const wallWest = (r) => r.x < 48;
const ctx = (over = {}) => ({
    collides: wallWest,
    probe: wallWest,
    tileTypeAt: () => 0,
    onScreen: () => true,
    playerBox: null,
    hitPlayer: (w) => w,
    ...over,
});

describe('wallFlyer', () => {
    it('the record carries the source numbers', () => {
        expect(WALLFLYER.moveSpeed).toBe(4);
        expect(WALLFLYER.attackRange).toBe(160);
        expect(WALLFLYER.f).toBe(0);
        expect([...WALLFLYER.triggerTypes]).toEqual(['Solid', 'Tree']);
        expect(wallFlyerRect({ x: 56, y: 120 })).toMatchObject({ x: 49, y: 113, right: 63, bottom: 127 });
    });

    it('decideMotion: a wall to the WEST (d = 4) launches east, its negation points into the wall', () => {
        expect(decideMotion({ x: 55, y: 120 }, 4, wallWest)).toMatchObject({ x: 4, d: 4 });
        expect(decideMotion({ x: 56, y: 120 }, -4, wallWest).x).toBe(-4);
        expect(decideMotion({ x: 100, y: 120 }, 4, wallWest)).toEqual({ x: 0, y: 0, d: 0 });
    });

    it('f = 0 friction keeps the length and zeroes the 4.9e-16 residue of a horizontal launch', () => {
        expect(wallFlyerFriction(-4, -4.898587196589413e-16)).toEqual({ vx: -4, vy: 0 });
    });

    it('the first step runs check() and settles 1 px into contact with its wall, at rest', () => {
        const w0 = newWallFlyer({ id: 'wallflyer@48,112', x: 48, y: 112 });
        expect([w0.x, w0.vx, w0.checked]).toEqual([56, 0, false]);
        const { w } = stepWallFlyer(w0, ctx());
        expect([w.x, w.vx, w.vy, w.activeOffScreen]).toEqual([55, 0, 0, false]);
    });

    it('a player on the ray launches it on the same update, and it flies 4 px a tick', () => {
        const playerBox = { x: 86, y: 118, right: 90, bottom: 123 };
        let { w, launched } = stepWallFlyer(newWallFlyer({ id: 'a', x: 48, y: 112 }), ctx({ playerBox }));
        expect([w.x, w.vx, launched, w.activeOffScreen]).toEqual([55, 4, true, true]);
        ({ w } = stepWallFlyer(w, ctx({ playerBox })));
        expect(w.x).toBe(59);
    });

    it('a dark-suit hit lands, latches and REVERSES (knockback is v = -v); a third hit plays "die"', () => {
        const w = { ...newWallFlyer({ id: 'a', x: 48, y: 112 }), vx: 4, vy: 0 };
        const r = hitWallFlyer(w, { damage: 1, t: 'Suit' });
        expect([r.landed, r.w.hits, r.w.hitsTimer, r.w.hitByDarkStuff, r.w.vx]).toEqual([true, 1, 30, true, -4]);
        // latched: the next damaging hit lands through the i-frame
        const r2 = hitWallFlyer(r.w, { damage: 1, t: 'Suit' });
        expect(r2.w.hits).toBe(2);
        const r3 = hitWallFlyer(r2.w, { damage: 1, t: 'Suit' });
        expect([r3.killed, r3.w.destroy, r3.w.dieAnim !== null]).toEqual([true, false, true]);
        let g = r3.w;
        let n = 0;
        while (!g.destroy) { g = stepWallFlyerGraphic(g); n += 1; }
        // 4 frames at rate 10 through `stepSpriteAnim` (Bob's 4 at rate 5 is 25): the fencepost lands on 13.
        expect(n).toBe(13);
    });

    it('an unlatched body inside its i-frame is not hit', () => {
        const w = { ...newWallFlyer({ id: 'a', x: 48, y: 112 }), hitsTimer: 5 };
        expect(hitWallFlyer(w, { t: 'Sword' }).landed).toBe(false);
    });
});
