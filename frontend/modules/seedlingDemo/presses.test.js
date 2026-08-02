/**
 * presses — the hand-derived stratum for R4's press rects and audit.
 *
 * Every number is read off `Player.as`, `Enemy.as` and the sprite sheets,
 * not off this port. The reason these matter at pixel resolution: L65's
 * `lightpole@176,120` overlaps the top half of `pushableblockspear@176,128`,
 * so whether a horizontal thrust at the block also toggles a lightpole —
 * and writes a persistence flag nobody declared — is decided in the fourth
 * pixel of a five-pixel-thick rect.
 */

import { describe, expect, it } from 'vitest';

import {
    DOWN,
    ENEMY_HITS_MAX,
    ENEMY_HITS_TIMER,
    HITABLE_TYPES,
    LEFT,
    PressError,
    RIGHT,
    SLASH_REACH,
    SLASH_TIMER_MAX,
    SPEAR_DAMAGE,
    SPEAR_LENGTH,
    SPEAR_THICK,
    SWORD_DAMAGE,
    UP,
    distanceRectPoint,
    pressDamage,
    pressWouldKill,
    slashRect,
    spearOrigin,
    spearRect,
} from './presses.js';

describe('the spear rect (Player.as:944-968)', () => {
    it('is 32 long and 5 thick', () => {
        expect(SPEAR_LENGTH).toBe(32);
        expect(SPEAR_THICK).toBe(5);
    });

    it('anchors on spearX/spearY, which are NOT the player position', () => {
        // spearOffset = (-1, 2), folded through the parity expressions at
        // Player.as:1321-1327. Getting these wrong is a one-or-two pixel
        // error, which is the resolution the L65 audit is decided at.
        expect(spearOrigin(100, 200, RIGHT)).toEqual({ x: 100, y: 201 });
        expect(spearOrigin(100, 200, UP)).toEqual({ x: 101, y: 202 });
        expect(spearOrigin(100, 200, LEFT)).toEqual({ x: 100, y: 202 });
        expect(spearOrigin(100, 200, DOWN)).toEqual({ x: 99, y: 202 });
    });

    it('extends 32 px in the facing direction, per arm', () => {
        expect(spearRect(100, 200, RIGHT))
            .toMatchObject({ x: 100, y: 199.5, w: 32, h: 5 });
        expect(spearRect(100, 200, LEFT))
            .toMatchObject({ x: 68, y: 199.5, w: 32, h: 5 });
        expect(spearRect(100, 200, UP))
            .toMatchObject({ x: 99.5, y: 170, w: 5, h: 32 });
        expect(spearRect(100, 200, DOWN))
            .toMatchObject({ x: 96.5, y: 202, w: 5, h: 32 });
    });

    it('keeps the AS3\'s ASYMMETRIC +1, rather than regularising it', () => {
        // Cases 0 and 1 are `- thick/2 + 1`; cases 2 and 3 are `- thick/2`.
        // A tidied version would put the right-facing rect half a pixel
        // lower and the left-facing one half a pixel higher.
        expect(spearRect(100, 200, RIGHT).y).toBe(199.5);    // 201 - 2.5 + 1
        expect(spearRect(100, 200, LEFT).y).toBe(199.5);     // 202 - 2.5
    });

    it('refuses a direction it cannot transcribe', () => {
        expect(() => spearRect(0, 0, 4)).toThrow(PressError);
        expect(() => slashRect(0, 0, -1)).toThrow(PressError);
    });
});

describe('the slash rect and its two gates', () => {
    it('is the 16x32 sprite frame, ahead of the player', () => {
        expect(slashRect(100, 200, RIGHT))
            .toMatchObject({ x: 100, y: 184, w: 16, h: 32 });
        expect(slashRect(100, 200, LEFT))
            .toMatchObject({ x: 84, y: 184, w: 16, h: 32 });
        // Up and down transpose: 32 wide, 16 tall.
        expect(slashRect(100, 200, UP))
            .toMatchObject({ x: 84, y: 184, w: 32, h: 16 });
        expect(slashRect(100, 200, DOWN))
            .toMatchObject({ x: 84, y: 200, w: 32, h: 16 });
    });

    it('⚠ REACHES only 16 px, which the rect alone does not say', () => {
        // `FP.distanceRectPoint(x, y, ...) <= slashingSprite.width` runs
        // AFTER the rect collect, so an entity in the corner of the 16x32
        // box can be inside the rect and outside the reach.
        expect(SLASH_REACH).toBe(16);
        const corner = { x: 112, y: 184, right: 116, bottom: 188 };
        expect(distanceRectPoint(100, 200, corner)).toBeCloseTo(
            Math.sqrt(12 * 12 + 12 * 12), 10,
        );
        expect(distanceRectPoint(100, 200, corner)).toBeGreaterThan(SLASH_REACH);
        // Zero inside the rect, which is the case the formula is easiest
        // to get wrong on.
        expect(distanceRectPoint(100, 200, { x: 90, y: 190, right: 110, bottom: 210 }))
            .toBe(0);
    });

    it('and the spear has NO such gate — 32 px, through walls', () => {
        // The whole reason §3.2's audit switches rect at the equip tick:
        // the spear reaches twice as far and is not filtered at all.
        expect(SPEAR_LENGTH).toBe(2 * SLASH_REACH);
    });
});

describe('the hitables list', () => {
    it('is the eleven TYPES, not the classes genericHit dispatches on', () => {
        expect(HITABLE_TYPES).toEqual([
            'Enemy', 'Grass', 'Tree', 'Rock', 'Rope', 'ShieldBoss', 'Solid',
            'LightPole', 'LavaBall', 'LavaBoss', 'Watcher',
        ]);
        // "Solid" is why a press can reach a Tile (the bridge), a
        // BreakableRock and a PushableBlock with one entry.
        expect(HITABLE_TYPES).toContain('Solid');
    });
});

describe('the press arithmetic (Enemy.as:141-181)', () => {
    it('one spear press cannot kill a default enemy, and two can', () => {
        expect(SPEAR_DAMAGE).toBe(2);
        expect(ENEMY_HITS_MAX).toBe(3);
        expect(pressWouldKill('spear', 1)).toBe(false);
        expect(pressWouldKill('spear', 2)).toBe(true);
    });

    it('⚠ a SWORD press is 1 or 2 depending on the dark sword', () => {
        // The ladder has held the dark sword since R2, so "a sword press is
        // 1 damage" is only true of a run that does not. Two dark-sword
        // presses kill; three plain ones do.
        expect(SWORD_DAMAGE).toBe(1);
        expect(pressDamage('sword', {})).toBe(1);
        expect(pressDamage('sword', { hasDarkSword: true })).toBe(2);
        expect(pressWouldKill('sword', 2, {})).toBe(false);
        expect(pressWouldKill('sword', 2, { hasDarkSword: true })).toBe(true);
        expect(pressWouldKill('sword', 3, {})).toBe(true);
    });

    it('records the two timers the audit spaces presses against', () => {
        // 30 ticks before the same enemy accepts another hit; 20 ticks is
        // the double-tap window that turns a second press into a DASH that
        // MOVES the player (the R3 fixtures space theirs eight apart and
        // leave exactly one stray).
        expect(ENEMY_HITS_TIMER).toBe(30);
        expect(SLASH_TIMER_MAX).toBe(20);
    });
});
