/**
 * `wandShot.test.js` — R6 slice 2's second stratum.
 *
 * THE MUTATION LIST:
 *
 *  1. `mobileUpdate()` called instead of the override (freeze gate restored)
 *  2. the `!destroy` guard restored (a culled shot stops flying)
 *  3. `friction()` restored (the epsilon components zeroed on tick 1)
 *  4. lifetime read as a distance instead of `int(48 / v.length)`
 *  5. the life decrement placed AFTER the move
 *  6. the fizzle update's move skipped
 *  7. `hitY` preferred over `hitX`
 *  8. the epsilon-axis probe skipped (`if (Math.abs(rel) < 1) return`)
 *  9. `rectsOverlap` written non-strict (the graze becomes a contact
 *     everywhere, not only past the epsilon)
 * 10. `play("die")` moved INSIDE `checkEntity`'s two arms
 * 11. the die clock started on the tick after `play("die")`
 * 12. the fade DIVIDED (10 ticks instead of 11)
 * 13. `Enemy.hit`'s `!Game.freezeObjects` dropped (a frozen hit lands)
 * 14. the hitbox origin read as 1.5 (a "centred" 3x3)
 * 15. `"Enemy"` dropped from the solids list
 * 16. the cull written as a BOX test, or against `FP.width`
 */

import { describe, expect, it } from 'vitest';

import { SCREEN_W } from './camera.js';
import { MOBILE_DEATH_FADE } from './enemyDamage.js';
import { PLAYER_SOLID_TYPES, rect, rectsOverlap } from './levelWorld.js';
import { MAGICAL_LOCK_GEOMETRY } from './magicalLock.js';
import { wandShotSpawn, wandShotVelocity } from './wandVerb.js';
import {
    createWandShot,
    stepWandShot,
    stepWandShotGraphic,
    WAND_SHOT,
    WAND_SHOT_ANIM_UPDATES,
    WAND_SHOT_CULL,
    WAND_SHOT_DEATH,
    WAND_SHOT_EPSILON,
    WAND_SHOT_GRAZE,
    WAND_SHOT_SOLID_TYPES,
    wandShotCulled,
    wandShotLifeMax,
    wandShotRect,
    WandShotError,
} from './wandShot.js';

/** A `hitAt` over a fixed list of boxes, with the AS3 classification. */
const worldOf = (blockers) => (x, y, state) => {
    const box = wandShotRect({ ...state, x, y });
    for (const b of blockers) if (rectsOverlap(box, b.rect)) return b;
    return null;
};

/** Fly a shot until it is removed or `limit` ticks pass. */
function fly(state, blockers, { limit = 60, frozen = false, cam = null } = {}) {
    const log = [];
    const hitAt = worldOf(blockers);
    for (let t = 0; t < limit && !state.removed; t += 1) {
        const r = stepWandShot(state, { tick: t, frozen, cam, hitAt });
        const g = stepWandShotGraphic(state, t);
        log.push({ t, x: state.x, y: state.y, ...r, destroyed: g.destroyed });
    }
    return log;
}

const upShot = (px = 100, py = 100) => {
    const s = wandShotSpawn(1, px, py);
    return createWandShot('s', s.x, s.y, wandShotVelocity(1));
};

describe('the constants', () => {
    it('a plain shot is 3x3 at origin 2,2 — ASYMMETRIC (mutation 14)', () => {
        expect(WAND_SHOT.wand.hitbox).toEqual({ w: 3, h: 3, originX: 2, originY: 2 });
        const box = wandShotRect(createWandShot('s', 100, 100, { vx: 3, vy: -0 }));
        // [98, 101) — one pixel west-heavy, not centred on 100.
        expect(box).toMatchObject({ x: 98, right: 101 });
    });

    it('damage 0.5 and force 3 — TEN plain shots against hitsMax 5', () => {
        expect(WAND_SHOT.wand.damage).toBe(0.5);
        expect(WAND_SHOT.force).toBe(3);
        expect(5 / WAND_SHOT.wand.damage).toBe(10);
    });

    it('the fire shot is 5x5 and damage 1 — the same origin, so it is east-heavy', () => {
        expect(WAND_SHOT.firewand.hitbox).toEqual({ w: 5, h: 5, originX: 2, originY: 2 });
        expect(WAND_SHOT.firewand.damage).toBe(1);
    });

    it('the solids list is Mobile.solids + Enemy, MINUS LavaBoss (mutation 15)', () => {
        expect(WAND_SHOT_SOLID_TYPES).toContain('Enemy');
        expect(WAND_SHOT_SOLID_TYPES).not.toContain('LavaBoss');
        // The player's list is the same minus Enemy plus LavaBoss — the two
        // differ by exactly two names, which is the whole per-mover point.
        const player = new Set(PLAYER_SOLID_TYPES);
        const shot = new Set(WAND_SHOT_SOLID_TYPES);
        expect([...shot].filter((t) => !player.has(t))).toEqual(['Enemy']);
        expect([...player].filter((t) => !shot.has(t))).toEqual(['LavaBoss']);
    });

    it('the lifetime is 16 in every direction (mutation 4)', () => {
        for (const d of [0, 1, 2, 3]) {
            const { vx, vy } = wandShotVelocity(d);
            expect(wandShotLifeMax(vx, vy)).toBe(16);
        }
    });

    it('the anim clocks are 19 / 5 — §8.2\'s last row, re-derived', () => {
        expect(WAND_SHOT_ANIM_UPDATES).toEqual({ flare: 19, die: 5 });
    });
});

describe('a free flight', () => {
    it('travels exactly 48 px in 16 updates and then fizzles', () => {
        const s = upShot(100, 100);
        expect({ x: s.x, y: s.y }).toEqual({ x: 100, y: 84 });
        const log = fly(s, []);
        const fizzle = log.find((r) => r.fizzled);
        // 0-indexed: the sixteenth update.
        expect(fizzle.t).toBe(15);
        expect(fizzle.y).toBe(84 - 48);
        expect(s.life).toBe(0);
    });

    it('the drift in POSITION is zero at ordinary coordinates — the §8.16 delta', () => {
        const s = upShot(100, 100);
        fly(s, []);
        // Sixteen adds of 1.837e-16 at x = 100, and the x is bit-identical.
        expect(s.x).toBe(100);
        expect(Object.is(s.x, 100)).toBe(true);
        expect(WAND_SHOT_EPSILON.driftOverAFlightAtOrdinaryCoordinates).toBe(0);
    });

    it('…and the measured band where it does NOT vanish is tiny, per axis', () => {
        const p = WAND_SHOT_EPSILON.perAxis;
        expect(p['up.x'].largestSticking).toBe(1);
        expect(p['down.x'].largestSticking).toBe(8);
        expect(p['left.y'].largestSticking).toBe(4);
        // Two of the three bands are inside a stance the player clamp allows.
        expect(p['up.x'].reachable).toBe(false);
        expect(p['down.x'].reachable).toBe(true);
        expect(p['left.y'].reachable).toBe(true);
    });

    it('the epsilon is kept anyway — it IS the arithmetic (mutations 3, 8)', () => {
        // A shot low enough for the probe to survive: the add sticks.
        const s = createWandShot('lo', 1, 40, wandShotVelocity(1));
        expect(s.x + s.v.x).not.toBe(s.x);
        // …and a `friction()` call (mutation 3) would have zeroed it outright.
        expect(Math.abs(s.v.x)).toBeLessThan(0.05);
    });

    it('is removed 15 ticks after the fizzle: 4 of die anim + 11 of fade', () => {
        const s = upShot(100, 100);
        const log = fly(s, []);
        const fizzle = log.find((r) => r.fizzled).t;
        const destroyed = log.find((r) => r.destroyed).t;
        const removed = log.find((r) => r.removed).t;
        expect(destroyed - fizzle).toBe(WAND_SHOT_DEATH.destroyTickOffset);
        expect(destroyed - fizzle).toBe(4);
        expect(removed - fizzle).toBe(WAND_SHOT_DEATH.removeTickOffset);
        expect(removed - fizzle).toBe(15);
    });

    it('the fade is 11 ticks, ACCUMULATED not divided (mutation 12)', () => {
        expect(MOBILE_DEATH_FADE.ticks).toBe(11);
        expect(Math.ceil(1 / 0.1)).toBe(10);
        expect(WAND_SHOT_DEATH.fadeTicks).not.toBe(10);
    });

    it('stops moving the instant the die anim starts (mutation 5)', () => {
        const s = upShot(100, 100);
        const log = fly(s, []);
        const fizzle = log.find((r) => r.fizzled);
        const after = log[log.indexOf(fizzle) + 1];
        // The fizzle update STILL MOVES (mutation 6) …
        expect(fizzle.y).toBe(36);
        // … and the one after it does not.
        expect(after.y).toBe(36);
    });
});

describe('the epsilon-axis probe', () => {
    /**
     * The DOWN graze — the REACHABLE one. Box is `[x-2, x+1)`, so a wall
     * whose RIGHT edge is exactly `x-2` touches it and does not overlap it.
     * At `x = 4` the `-5.511e-16` probe still survives the double add.
     */
    const downShot = (x, y) => createWandShot('d', x, y, wandShotVelocity(3));
    const grazeWall = { kind: 'other', id: 'w', rect: rect(0, 0, 2, 200) }; // right = 2

    it('a wall the box exactly TOUCHES is not a contact without the epsilon', () => {
        const s = downShot(4, 40);
        expect(wandShotRect(s).x).toBe(2);
        expect(rectsOverlap(wandShotRect(s), grazeWall.rect)).toBe(false);
    });

    it('…and IS one at x - 5.511e-16 — the graze (mutations 8, 9)', () => {
        const s = downShot(4, 40);
        const log = fly(s, [grazeWall]);
        const hit = log.find((r) => r.event);
        // The very first update: `moveX` probes before `moveY` moves.
        expect(hit.t).toBe(0);
        expect(hit.event.arm).toBe('other');
        // …and it never travelled: the x sweep returned the blocker.
        expect(hit.y).toBe(40);
    });

    it('the same stance TEN pixels east is inert — the epsilon is absorbed', () => {
        const s = downShot(14, 40);
        // 14 > `down.x`'s largestSticking of 8, so `x + eps === x`.
        expect(s.x + s.v.x).toBe(s.x);
        const wall = { kind: 'other', id: 'w', rect: rect(0, 0, 12, 200) }; // right = 12
        expect(fly(s, [wall]).some((r) => r.event)).toBe(false);
    });

    it('a wall ONE pixel further out is not a contact at all', () => {
        const s = downShot(4, 40);
        const log = fly(s, [{ kind: 'other', id: 'w', rect: rect(0, 0, 1, 200) }]);
        expect(log.some((r) => r.event)).toBe(false);
    });

    it('the X blocker wins over the Y blocker (mutation 7)', () => {
        // A LEFT shot: the x sweep is a real 3 px walk, the y sweep a probe.
        const s = createWandShot('l', 100, 100, wandShotVelocity(2));
        const xWall = { kind: 'other', id: 'w', rect: rect(80, 90, 16, 20) };
        const yEnemy = { kind: 'enemy', id: 'e', rect: rect(90, 80, 20, 18) }; // bottom 98
        const log = fly(s, [xWall, yEnemy]);
        const hit = log.find((r) => r.event);
        expect(hit.event.id).toBe('w');
        expect(hit.event.arm).toBe('other');
    });

    it('the RIGHT shot has no probe at all — three of four, not a rule', () => {
        expect(WAND_SHOT_GRAZE.right.touchingEdge).toBeNull();
        expect(Math.abs(wandShotVelocity(0).vy)).toBe(0);
    });

    it('and the UP graze is a MECHANISM whose band the player clamp excludes', () => {
        expect(WAND_SHOT_GRAZE.up.reachable).toBe(false);
        // The mechanism itself is real at x = 1, which no stance reaches.
        const s = createWandShot('u', 1, 40, wandShotVelocity(1));
        const wall = { kind: 'other', id: 'w', rect: rect(2, 0, 8, 200) };
        expect(rectsOverlap(wandShotRect(s), wall.rect)).toBe(false);
        expect(fly(s, [wall]).some((r) => r.event)).toBe(true);
    });
});

describe('checkEntity', () => {
    const enemy = { kind: 'enemy', id: 'boss', rect: rect(92, 40, 16, 16) };

    it('dispatches the Wand arm with force 3 and damage 0.5', () => {
        const s = upShot(100, 100);
        const log = fly(s, [enemy]);
        const e = log.find((r) => r.event).event;
        expect(e).toMatchObject({
            arm: 'enemy', id: 'boss', force: 3, damage: 0.5, t: 'Wand', landed: true,
        });
    });

    it('a FROZEN contact is spent and deals nothing (mutation 13)', () => {
        const s = upShot(100, 100);
        const log = fly(s, [enemy], { frozen: true });
        const e = log.find((r) => r.event).event;
        expect(e.landed).toBe(false);
        expect(e.spentWithoutDamage).toBe(true);
        // …and the shot dies anyway.
        expect(s.anim).toBe('die');
    });

    it('a plain wall spends the shot too — play("die") is outside both arms (m. 10)', () => {
        const s = upShot(100, 100);
        const log = fly(s, [{ kind: 'other', id: 'rock', rect: rect(92, 40, 16, 16) }]);
        const hit = log.find((r) => r.event);
        expect(hit.event.arm).toBe('other');
        expect(hit.event.spentWithoutDamage).toBe(true);
        expect(s.anim).toBe('die');
    });

    it('a magicallock the shot cannot open is ALSO spent', () => {
        const fireLock = {
            kind: 'magicallock', id: 'L', lockType: 1, rect: rect(92, 40, 16, 16),
        };
        const s = upShot(100, 100);
        const log = fly(s, [fireLock]);
        const e = log.find((r) => r.event).event;
        expect(e.opened).toBe(false);
        expect(e.spentWithoutDamage).toBe(true);
        expect(s.anim).toBe('die');
    });

    it('a lockType 0 lock opens to a plain shot', () => {
        const lock = {
            kind: 'magicallock', id: 'L', lockType: 0, rect: rect(92, 40, 16, 16),
        };
        const s = upShot(100, 100);
        const e = fly(s, [lock]).find((r) => r.event).event;
        expect(e).toMatchObject({ arm: 'magicallock', opened: true, shotType: 0 });
    });

    it('refuses a blocker with no `kind` — types and classes are not one partition', () => {
        const s = upShot(100, 100);
        expect(() => fly(s, [{ id: 'x', rect: rect(92, 40, 16, 16) }]))
            .toThrow(/must carry a `kind`/);
    });

    it('the geometry it dispatches against is levelWorld\'s own lock cell', () => {
        expect(MAGICAL_LOCK_GEOMETRY).toMatchObject({ w: 16, h: 16, type: 'Solid' });
    });
});

describe('the ungated override', () => {
    it('a shot flies through a ceremony (mutation 1)', () => {
        const s = upShot(100, 100);
        fly(s, [], { frozen: true });
        // Same 48 px as the unfrozen flight — `mobileUpdate`'s gate is gone.
        expect(s.y).toBe(36);
    });

    it('a CULLED shot keeps flying and keeps colliding (mutation 2)', () => {
        // A camera 1,000 px away puts the spawn outside the cull box.
        const cam = { x: 2000, y: 2000 };
        const s = upShot(100, 100);
        const log = fly(s, [], { cam });
        expect(log[0].culled).toBe(true);
        expect(s.destroy).toBe(true);
        // …and it still moved on the culling update, and on the next ten.
        expect(log[0].y).toBe(81);
        expect(log[1].y).toBe(78);
        // It is removed by the FADE (11 ticks), not by the cull.
        expect(log.find((r) => r.removed).t).toBe(MOBILE_DEATH_FADE.ticks - 1);
    });
});

describe('the cull', () => {
    it('is a POINT test against a 160x160 screen, not FP.width (mutation 16)', () => {
        const cam = { x: 0, y: 0 };
        const edge = SCREEN_W + WAND_SHOT.cullMargin;
        expect(wandShotCulled(edge, 0, cam)).toBe(false);
        expect(wandShotCulled(edge + 1, 0, cam)).toBe(true);
        expect(wandShotCulled(-WAND_SHOT.cullMargin, 0, cam)).toBe(false);
        expect(wandShotCulled(-WAND_SHOT.cullMargin - 1, 0, cam)).toBe(true);
    });

    it('is a BOUNDED VACUITY on a real flight, and the bound is arithmetic', () => {
        expect(WAND_SHOT_CULL.reachable).toBe(false);
        expect(WAND_SHOT_CULL.travel + WAND_SHOT_CULL.spawnReach)
            .toBeLessThan(WAND_SHOT_CULL.nearestEdge);
    });
});

describe('refusals', () => {
    it('a missing collision oracle is refused, not defaulted to "no walls"', () => {
        const s = upShot(100, 100);
        expect(() => stepWandShot(s, { tick: 0 })).toThrow(WandShotError);
        expect(() => stepWandShot(s, { tick: 0 })).toThrow(/`hitAt` is required/);
    });

    it('a zero-velocity shot has no lifetime and says so', () => {
        expect(() => wandShotLifeMax(0, 0)).toThrow(/no lifetime/);
    });
});
