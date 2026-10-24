/**
 * `wandVerb.test.js` — R6 slice 2's first stratum.
 *
 * THE MUTATION LIST these were written against, one `it` per row:
 *
 *  1. cadence read off 60 fps arithmetic (15 instead of 8)
 *  2. cadence DIVIDED instead of accumulated
 *  3. `fireTick` conflated with `wrapUpdate` (an update index IS a tick)
 *  4. the shot's first own update conflated with the fire tick (the
 *     deferred `FP.world.add` dropped)
 *  5. `WAND_PRESS_CADENCE` off by one at the swallowed press
 *  6. the gate written as §2.3's three terms
 *  7. the `firing` term written as a plain `!firing`
 *  8. the item test dropped from the gate
 *  9. direction read at PRESS time
 * 10. direction read from the fire tick's OWN `sprites()` (no stale tick)
 * 11. the velocity epsilons rounded to 0
 * 12. the spawn offset epsilons rounded to 0
 * 13. `int()` written as `Math.floor`
 * 14. `sprFireWand.width` (17) used for a fire shot's offset
 * 15. the pre-clamp read swapped for the observed position
 */

import { describe, expect, it } from 'vitest';

import { FP_MAX_ELAPSED } from './breakableRocks.js';
import { KILL_PRESS_CADENCE } from './combatVerbs.js';
import { R6_ANIM_CLOCKS, animCallbackUpdate } from './r6Acceptance.js';
import {
    assertClearIsReachable,
    assertSpawnUnclamped,
    canStartWanding,
    FIRE_WAND_SPRITE,
    WAND_DIRECTIONS,
    WAND_FACING_RULE,
    WAND_FREEZE_SPLIT,
    WAND_GATE_TERMS,
    WAND_MIXED_WINDOW_LAW,
    WAND_PRESS_CADENCE,
    WAND_SPAWN_EPSILON_BITES,
    WAND_SPAWN_REACH,
    WAND_SPEED,
    WAND_SPRITE,
    WAND_TIMELINE,
    WAND_WINDOW,
    wandPress,
    wandShotSpawn,
    wandShotVelocity,
    WandVerbError,
} from './wandVerb.js';

describe('the cadence is an accumulator, not frame math', () => {
    it('wraps on update 8 — §8.2, re-derived', () => {
        expect(WAND_WINDOW.wrapUpdate).toBe(8);
    });

    it('is NOT the 60 fps reading of 15 (mutation 1)', () => {
        // What a 60 fps reading gives: 5 frames / (20 * (1/60)) = 15.
        const sixtyFps = Math.ceil(WAND_SPRITE.frameCount / (WAND_SPRITE.frameRate * (1 / 60)));
        expect(sixtyFps).toBe(15);
        expect(WAND_WINDOW.wrapUpdate).not.toBe(sixtyFps);
    });

    it('is simulated — and the fast path AGREES here, which is measured not asserted', () => {
        // Trap 70: the obvious "dividing gives a different answer" claim is
        // FALSE for this pair. Pin the agreement rather than a divergence.
        const divided = Math.ceil(
            WAND_SPRITE.frameCount / (WAND_SPRITE.frameRate * FP_MAX_ELAPSED),
        );
        expect(divided).toBe(WAND_WINDOW.wrapUpdate);
    });

    it('agrees with r6Acceptance\'s canonical table — two derivations, one number', () => {
        const row = R6_ANIM_CLOCKS.find((r) => r.owner === 'Player' && r.anim === 'wand');
        expect(row).toMatchObject({ frameRate: WAND_SPRITE.frameRate, frames: WAND_SPRITE.frameCount });
        expect(WAND_WINDOW.wrapUpdate).toBe(row.expect);
        // …and the two loops are genuinely different code: §8.2's
        // `animCallbackUpdate` and `fireVerb.animTimeline`.
        expect(animCallbackUpdate(WAND_SPRITE.frameRate, WAND_SPRITE.frameCount))
            .toBe(WAND_WINDOW.wrapUpdate);
    });

    it('reaches the wrap from index 0 and no earlier', () => {
        const { frames } = WAND_TIMELINE;
        expect(frames[0]).toBe(0);
        // The frame is still 4 on the update BEFORE the wrap...
        expect(frames[WAND_WINDOW.wrapUpdate - 1]).toBe(4);
        // ...and back to 0 on it.
        expect(frames[WAND_WINDOW.wrapUpdate]).toBe(0);
    });
});

describe('an update index is not a tick', () => {
    it('the fire tick is one BELOW the wrap update (mutation 3)', () => {
        expect(WAND_WINDOW.fireTick).toBe(WAND_WINDOW.wrapUpdate - 1);
        expect(WAND_WINDOW.fireTick).toBe(7);
    });

    it('the shot\'s first own update is one ABOVE the fire tick (mutation 4)', () => {
        // `FP.world.add` -> `_add`, drained by `updateLists()` AFTER
        // `World.update`. The shot does not exist for the pass that made it.
        expect(WAND_WINDOW.firstShotUpdateTick).toBe(WAND_WINDOW.fireTick + 1);
    });

    it('the press cadence is endTick + 1, and endTick is the fire tick (mutation 5)', () => {
        expect(WAND_WINDOW.endTick).toBe(WAND_WINDOW.fireTick);
        expect(WAND_PRESS_CADENCE).toBe(8);
        expect(WAND_PRESS_CADENCE).toBe(WAND_WINDOW.endTick + 1);
    });

    it('a second press at exactly the cadence is the first tick that can fire', () => {
        const a = wandPress(100, 0, { x: 64, y: 64 });
        expect(a.nextPressTick).toBe(108);
        const b = wandPress(a.nextPressTick, 0, { x: 64, y: 64 });
        expect(b.fireTick).toBe(115);
        expect(b.fireTick).toBeGreaterThan(a.fireTick);
    });
});

describe('the gate is §8.16\'s five terms, not §2.3\'s three', () => {
    const held = { hasWand: true };

    it('needs the item — §2.3 dropped this (mutation 8)', () => {
        expect(canStartWanding({})).toBe(false);
        expect(canStartWanding({ hasWand: true })).toBe(true);
        expect(canStartWanding({ hasFireWand: true })).toBe(true);
    });

    it('refuses while slashing, spearing or deathRaying', () => {
        expect(canStartWanding({ ...held, slashing: true })).toBe(false);
        expect(canStartWanding({ ...held, spearing: true })).toBe(false);
        // ⛔ `deathRaying` is the term §2.3 dropped (mutation 6).
        expect(canStartWanding({ ...held, deathRaying: true })).toBe(false);
    });

    it('the `firing` term is CONDITIONAL on hasFireWand (mutation 7)', () => {
        // A plain wand: firing shuts the gate.
        expect(canStartWanding({ hasWand: true, firing: true })).toBe(false);
        // The FIRE wand: `useItem` case 5 sets BOTH, so the gate must not
        // refuse itself. A plain `!firing` would return false here.
        expect(canStartWanding({ hasFireWand: true, firing: true })).toBe(true);
    });

    it('the term table names all five', () => {
        expect(WAND_GATE_TERMS).toHaveLength(5);
        expect(WAND_GATE_TERMS.map((t) => t.term)).toEqual([
            '(hasWand || hasFireWand)', '!slashing', '(!firing || hasFireWand)',
            '!deathRaying', '!spearing',
        ]);
    });

    it('the CLEAR goes through the same setter, and is reachable on the honest path', () => {
        expect(assertClearIsReachable({ hasWand: true })).toBe(true);
        expect(() => assertClearIsReachable({})).toThrow(WandVerbError);
        expect(() => assertClearIsReachable({})).toThrow(/RISE as well as the fall/);
    });
});

describe('direction is read at fire time, one tick stale', () => {
    it('declares the rule rather than leaving it to a comment (mutations 9, 10)', () => {
        expect(WAND_FACING_RULE.readAt).toBe('fire');
        expect(WAND_FACING_RULE.staleByTicks).toBe(1);
    });

    it('wandPress takes the facing as an argument, so a press-tick facing cannot leak in', () => {
        // The whole defence against mutation 9 is that this module CANNOT
        // read a facing: only the run knows it, and the run is told which
        // tick to take it from. Asserted as an interface fact.
        const p = wandPress(10, 2, { x: 100, y: 100 });
        expect(p.direction).toBe(2);
        expect(p.fireTick).toBe(17);
    });
});

describe('the epsilon velocities and offsets', () => {
    it('are computed from the angle, not typed as literals (mutation 11)', () => {
        for (const d of WAND_DIRECTIONS) {
            const a = d.direction * Math.PI / 2;
            expect(d.vx).toBe(WAND_SPEED * Math.cos(a));
            expect(d.vy).toBe(-WAND_SPEED * Math.sin(a));
        }
    });

    it('match §8.16\'s two printed values exactly', () => {
        expect(wandShotVelocity(1)).toEqual({ vx: 1.8369701987210297e-16, vy: -3 });
        expect(wandShotVelocity(2)).toEqual({ vx: -3, vy: -3.6739403974420594e-16 });
    });

    it('are NOT zero on the cross axis — three of four (mutation 11)', () => {
        expect(wandShotVelocity(0).vy).toBe(-0);   // the one exact zero
        expect(wandShotVelocity(1).vx).not.toBe(0);
        expect(wandShotVelocity(2).vy).not.toBe(0);
        expect(wandShotVelocity(3).vx).not.toBe(0);
    });

    it('give a Point.length of exactly 3 in all four directions', () => {
        for (const d of WAND_DIRECTIONS) {
            expect(Math.sqrt(d.vx * d.vx + d.vy * d.vy)).toBe(3);
        }
    });

    it('the spawn offset uses sprWand.width for BOTH wands (mutation 14)', () => {
        expect(WAND_SPAWN_REACH).toBe(WAND_SPRITE.w);
        expect(WAND_SPAWN_REACH).toBe(16);
        // The fire wand's sprite is a pixel wider and `wand()` never reads it.
        expect(FIRE_WAND_SPRITE.w).toBe(17);
        expect(wandShotSpawn(0, 100, 100)).toMatchObject({ x: 116 });
        // …and the fire flag does not enter `wandShotSpawn` at all.
        expect(wandPress(0, 0, { x: 100, y: 100 }, { fire: true }).spawn.x).toBe(116);
    });
});

describe('the ctor truncates, and the epsilon can eat a pixel', () => {
    it('truncates toward zero, not floor (mutation 13)', () => {
        // A left shot from a negative-x player: `int(-0.5)` is 0, `floor` is -1.
        expect(wandShotSpawn(2, 15.5, 100).x).toBe(0);
        expect(Math.floor(15.5 - 16)).toBe(-1);
    });

    it('the DOWN shot loses a pixel at x = 18 (mutation 12)', () => {
        const s = wandShotSpawn(3, 18, 100);
        expect(s.exactX).toBe(17.999999999999996);
        expect(s.x).toBe(17);
        // Rounding the epsilon away would have given 18.
        expect(Math.trunc(18 + 0)).toBe(18);
    });

    it('and does NOT at x = 40, which is why the boundary is measured', () => {
        expect(wandShotSpawn(3, 40, 100).x).toBe(40);
    });

    it('the measured boundary is 32 for both negative-epsilon axes', () => {
        expect(WAND_SPAWN_EPSILON_BITES['down.x'].onIntegers).toBe(32);
        expect(WAND_SPAWN_EPSILON_BITES['left.y'].onIntegers).toBe(32);
    });

    it('the four clean axes never disagree with a rounding model — the negative half', () => {
        for (const k of ['right.x', 'right.y', 'up.y', 'left.x', 'down.y']) {
            expect(WAND_SPAWN_EPSILON_BITES[k].onIntegers).toBeNull();
            expect(WAND_SPAWN_EPSILON_BITES[k].justBelowIntegers).toBeNull();
        }
    });

    it('the UP shot\'s POSITIVE epsilon bites just below an integer instead', () => {
        expect(WAND_SPAWN_EPSILON_BITES['up.x'].onIntegers).toBeNull();
        expect(WAND_SPAWN_EPSILON_BITES['up.x'].justBelowIntegers).toBe(16);
    });
});

describe('the pre-clamp read', () => {
    it('passes when the tick\'s clamp did not move the player', () => {
        expect(assertSpawnUnclamped({ x: 100, y: 100 }, { x: 100, y: 100 })).toBe(true);
    });

    it('refuses by name when it did (mutation 15)', () => {
        expect(() => assertSpawnUnclamped({ x: 1, y: 100 }, { x: 2, y: 100 }, 'W-exit'))
            .toThrow(/W-exit: the fire tick's final clamp MOVED the player/);
    });
});

describe('the freeze split and the mixed-window law', () => {
    it('four gates on one flag and only two close', () => {
        expect(WAND_FREEZE_SPLIT).toMatchObject({
            pressBlocked: true, animAdvances: true, shotFires: true,
            shotMoves: true, shotDamages: false,
        });
    });

    it('a mixed window is paced by the ENEMY, not by the wand', () => {
        expect(WAND_MIXED_WINDOW_LAW.playerCadence).toBe(8);
        expect(KILL_PRESS_CADENCE).toBe(31);
        expect(KILL_PRESS_CADENCE).toBeGreaterThan(WAND_PRESS_CADENCE);
    });
});

describe('refusals', () => {
    it('an out-of-range direction is a model defect, not an input to clamp', () => {
        expect(() => wandShotVelocity(4)).toThrow(/direction must be 0\.\.3/);
        expect(() => wandShotSpawn(-1, 0, 0)).toThrow(WandVerbError);
    });

    it('a non-finite position is refused rather than truncated to NaN', () => {
        expect(() => wandShotSpawn(0, NaN, 0)).toThrow(/must be finite/);
    });

    it('a negative press tick is refused', () => {
        expect(() => wandPress(-1, 0, { x: 0, y: 0 })).toThrow(/non-negative integer/);
    });
});
