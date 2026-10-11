/**
 * seedling-fidelity-bombpusher D2 — `bombPusher.js` against the AS3 it transcribes and the game rows that measured it
 * (`probe-seedling-bombpusher.mjs` on the two `bomb-refuted-*` tapes; the rows quoted here are the game's `botMobiles()`).
 */
import { describe, expect, it } from 'vitest';

import {
    BOMB, BOMB_PUSHER, BOMB_PUSHER_CADENCE, bombPusherDistance, createBomb, createBombPusher, stepBomb,
    stepBombPusher,
} from './bombPusher.js';

describe('bombPusher — the constants (Enemies/BombPusher.as, Projectiles/Bomb.as, Projectiles/Explosion.as)', () => {
    it('the lobber stands at its 3x3 body\'s centre and shoots within 256 px, 15 ticks apart', () => {
        const b = createBombPusher(112, 128);
        expect([b.id, b.x, b.y]).toEqual(['bombpusher@112,128', 136, 152]);
        expect(BOMB_PUSHER.maxDistance).toBe(256);
        expect(BOMB_PUSHER.shotTimeMax).toBe(15);
        expect(BOMB_PUSHER.anims.shoot).toEqual({ frames: 5, rate: 5, loop: true });
    });

    it('the Explosion\'s radius is an int: int(24 × 0.65) = 15, not 15.6', () => {
        expect(BOMB.explosionHitRadius).toBe(15);
        expect(BOMB.force).toBe(4);
        expect(BOMB.damage).toBe(1);
        expect(BOMB.tMax).toBe(30);
    });
});

describe('bombPusher — the clock, simulated (measured on the game: shoot t819, bomb t849, next shoot t865)', () => {
    it('shoot on the first tick in range; the bomb on the wrap 30 ticks later; a play every 46', () => {
        expect(BOMB_PUSHER_CADENCE).toEqual({
            firstPlayTick: 0, spawnAfterPlay: 30, firstBombUpdateAfterPlay: 31, periodTicks: 46,
            bombUpdates: 31, explodeAfterPlay: 61,
        });
    });

    it('the range test is FP.distance on the previous tick\'s player, not truncated: 256.44 waits, 255.52 shoots', () => {
        const b = createBombPusher(112, 128);
        // L42 t817 / t818 (the player's end-of-tick points the lobber reads on t818 / t819)
        const far = { x: 384.39280715099824, y: 88.27167426086446 };
        const near = { x: 383.44280715099825, y: 88.27167426086446 };
        expect(bombPusherDistance(b, far)).toBeGreaterThan(256);
        stepBombPusher(b, { player: far });
        expect(b.anim).toBe('');
        stepBombPusher(b, { player: near });
        expect(b.anim).toBe('shoot');
        expect(b.shotTime).toBe(-1);
    });
});

describe('bombPusher — the flight, to the bit (L42 t849..t880)', () => {
    it('aims at Point(p.x, p.y): v = (p − (136,152)) / 30, the runtime\'s Point arithmetic', () => {
        const s = createBomb('b', 136, 152, { x: 347.9928071509982, y: 88.27167426086446 });
        expect(s.v).toEqual({ x: 7.066426905033273, y: -2.1242775246378516 });
    });

    it('thirty updates land exactly on the game\'s t879 row; the 31st steps once more and explodes at int(x, y)', () => {
        const s = createBomb('b', 136, 152, { x: 347.9928071509982, y: 88.27167426086446 });
        for (let i = 0; i < 30; i += 1) expect(stepBomb(s).exploded).toBe(null);
        expect([s.x, s.y]).toEqual([347.99280715099803, 88.27167426086459]);
        expect(stepBomb(s).exploded).toEqual({ x: 355, y: 86 });
        expect(s.removed).toBe(true);
    });

    it('friction\'s zeroing test flattens a launch with |vy| < 0.05 (L42 t941: vy 0.0024 → the game flew flat at y 152)', () => {
        const s = createBomb('b', 136, 152, { x: 311.4428071509982, y: 152.0716742608645 });
        expect(Math.abs(s.v.y)).toBeLessThan(0.05);
        stepBomb(s);
        expect(s.v.y).toBe(0);
        expect(s.y).toBe(152);
    });

    it('a frozen bomb keeps counting and does not move', () => {
        const s = createBomb('b', 136, 152, { x: 200, y: 152 });
        stepBomb(s, { frozen: true });
        expect([s.x, s.y, s.t]).toEqual([136, 152, 29]);
    });
});
