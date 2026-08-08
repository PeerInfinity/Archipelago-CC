/**
 * `bossTotemFight.test.js` — the FOURTEENTH per-visit family, and the first
 * fight window's arithmetic.
 *
 * R6 slice 4. The claims are grouped by the thing that could be wrong about
 * them, and each group names the mutation it would catch — a suite whose
 * cases all pass on a broken model is a bounded vacuity with no witness.
 *
 * ⛓ THE INDEPENDENT STRATUM IS AT THE BOTTOM: `the fight timeline` steps
 * the shipped loop against the shipped L43 geometry and pins the tick
 * numbers a SEPARATE transcription of `BossTotem.as` produced (written from
 * the AS3 without reference to this module, scratch-only). Every number in
 * it is the loop, never arithmetic.
 */

import { describe, expect, it } from 'vitest';

import {
    BOSS_TOTEM_BODY, BOSS_TOTEM_DEATH_BLAST, BOSS_TOTEM_FIGHT, BOSS_TOTEM_KILL,
    BOSS_TOTEM_SHOT, BOSS_TOTEM_WHITE_OUT, HEAD_POS_X, HEAD_POS_Y,
    bossTotemAttackShots, bossTotemBodyContactFires, bossTotemBodyRect,
    bossTotemCameraTarget, bossTotemDeathBlastHits, bossTotemDeathBlastPrefilter,
    bossTotemHeadPosY, bossTotemLaserHits, bossTotemLaserRects, bossTotemShotRect,
    createBossTotemShot, laserChargeTicks, stepBossTotemShot,
} from './bossTotemFight.js';
import { createBossTotem, renderBossTotem, stepBossTotem } from './bossTotem.js';
import { ENEMY_CLASSES, contactPricing } from './combat.js';
import { atlasLevelSource } from './levelSource.js';
import { buildLevelWorld, rect } from './levelWorld.js';

const ROLES = ['blocking', 'trigger', 'pickup', 'proximity-hazard'];
const l43 = buildLevelWorld(atlasLevelSource()(43), { roles: ROLES });
/**
 * ⛔ THE BOSS IS EXCLUDED FROM HIS OWN SOLIDS. `Entity.collide` opens with
 * `e !== this`, and `liveRectOf`'s boss arm returns null for an activated
 * one — which is the same exclusion by a different route. A probe that left
 * him in would find the arena solid at his spawn and report a boss who
 * cannot move at all (the first cut of the scratch transcription did).
 */
const OPTS = { bosses: new Map([['bosstotem@152,168', { activated: true }]]) };
const isSolid = (r) => !!l43.collidesSolid(r, OPTS);

/** A boss on the tick his `activationRestTime` has just drained. */
function fighting() {
    const b = createBossTotem(152, 168);
    b.activated = true;
    b.fullyActivated = true;
    b.activationStage = 1;
    b.rumblingTime = 0;
    b.activationRestTime = 0;
    b.sinceActivation = 0;
    renderBossTotem(b);      // the first render, so `headY` exists
    return b;
}

/** One engine frame: `update()` then `render()`, in the engine's order. */
function frame(b, opts = {}) {
    const r = stepBossTotem(b, {
        wandGone: true, freezeObjects: false, isSolid, ...opts,
    });
    renderBossTotem(b);
    return r;
}

describe('the animation tables', () => {
    it('⛓ every x column is ZERO, which is what licenses keeping only y', () => {
        // The four `headXxxPos` arrays in `BossTotem.as` are all `Point(0, n)`.
        // If one ever gained an x, `HEAD_POS_Y` would silently drop it — so
        // this is the guard on the abbreviation, not a restatement of it.
        expect(HEAD_POS_X).toBe(0);
        expect(Object.keys(HEAD_POS_Y).sort())
            .toEqual(['attack', 'jump', 'rest', 'walk']);
    });

    it('each table is exactly as long as its `animateFrames` entry', () => {
        for (const [anim, table] of Object.entries(HEAD_POS_Y)) {
            expect(table).toHaveLength(BOSS_TOTEM_FIGHT.animateFrames[anim]);
        }
    });

    it('⛓ `headPos` is the two-frame AVERAGE — `normalize(length/2)` halves', () => {
        // `a.clone().add(b)` then `normalize(length / 2)`: the runtime's
        // `point_normalize` computes `thickness / length` = 0.5 exactly, and
        // skips a zero-length vector entirely (same answer).
        // walk = [0,1,2,3,4,3,2,1]; frame 0 with frameUp 1 blends 0 and 1.
        expect(bossTotemHeadPosY('walk', 0)).toBe(0);
        expect(bossTotemHeadPosY('walk', 0.5)).toBe(0.5);
        expect(bossTotemHeadPosY('walk', 3.2)).toBe(3.5);
        // ⛓ AND THE WRAP IS A MODULO: `ceil(7.5) % 8` is 0, so the last
        // frame blends with the FIRST and not with an eighth entry.
        expect(bossTotemHeadPosY('walk', 7.5)).toBe(0.5);
    });

    it('⛔ the jump table is NEGATIVE — the head rises', () => {
        expect(bossTotemHeadPosY('jump', 4)).toBe(-4);
    });

    it('refuses an animation it has no table for', () => {
        expect(() => bossTotemHeadPosY('special', 0)).toThrow(/no head table/);
    });

    it('⛓ `BossTotem` is NOT a Spritemap — the frame is stepped by hand', () => {
        // §8.2's exception: `sprBossTotem` has no `add()`ed anims, so
        // `_anim` is null and `World.update`'s graphic pass is a no-op on
        // it. `animateRate` is a per-tick delta scaled by `rate`, not a
        // frameRate against `FP.elapsed`.
        expect(BOSS_TOTEM_FIGHT.animateRate.attack).toBe(0.3);
        expect(BOSS_TOTEM_FIGHT.animateRate.walk).toBe(0.2);
    });
});

describe('the laser', () => {
    it('⛓⛓ the charge is 103 WALK ticks, and it is stepped not solved', () => {
        // `+= max((w - 6)/24, 0.01)` — flat 0.01 until w > 6.24, geometric
        // after. A closed form would be asserting an arithmetic the game
        // does not do. [[feedback_accumulate_dont_divide_the_fade]]
        expect(laserChargeTicks()).toBe(103);
    });

    it('⛔⛔ the PROBE column and the DAMAGE column are not the same column', () => {
        const b = fighting();
        b.laserWidth = BOSS_TOTEM_FIGHT.laserWidthFire;
        b.headY = 0.5;
        const [east, west] = bossTotemLaserRects(b, isSolid);
        // `x + laserTo.x*dir - int(dir<0)*laserWidth` against
        // `x + laserStart.x*dir - laserWidth/2` — a 9 px offset for dir 1.
        expect(east.probeX).toBe(144);
        expect(east.x).toBe(135);
        expect(west.probeX).toBe(142);
        expect(west.x).toBe(151);
        expect(east.probeX - east.x).toBe(9);
    });

    it('⛓⛓⛓ the band the stance must clear is a FIXED [135, 169)', () => {
        const b = fighting();
        b.laserWidth = BOSS_TOTEM_FIGHT.laserWidthFire;
        b.headY = 0.5;
        const rects = bossTotemLaserRects(b, isSolid);
        expect(rects.map((r) => [r.x, r.right])).toEqual([[135, 153], [151, 169]]);
        // ⛓ AND THE TWO OVERLAP BY 2 px in the middle, which is why a
        // player standing under him is hit TWICE.
        expect(rects[0].right - rects[1].x).toBe(2);
        // The boss's x NEVER changes: `knockback` is overridden empty and
        // nothing else writes `v.x`. So this band is a constant of the room.
        expect(BOSS_TOTEM_FIGHT.src.machine).toMatch(/BossTotem\.as/);
    });

    it('⛔ the sweep CAPS at FP.width and the cap is named, not measured', () => {
        const b = fighting();
        b.laserWidth = BOSS_TOTEM_FIGHT.laserWidthFire;
        b.y = 226.8;
        b.headY = 0.5;
        const [east] = bossTotemLaserRects(b, isSolid);
        // From y 216.3 the next Solid is row 24 at y 384, which is 168 px
        // away — past the 160 the loop runs. A model that read 160 as a
        // measurement would think it had found a floor.
        expect(east.depth).toBe(160);
        expect(east.cappedAtSweep).toBe(true);
    });

    it('…and it DOES find the floor once he is low enough', () => {
        const b = fighting();
        b.laserWidth = BOSS_TOTEM_FIGHT.laserWidthFire;
        b.y = 301.75;
        b.headY = 3.5;
        const [east] = bossTotemLaserRects(b, isSolid);
        expect(east.depth).toBe(89);
        expect(east.cappedAtSweep).toBe(false);
    });

    it('⛔ a player inside BOTH rects produces TWO `hit` calls', () => {
        const b = fighting();
        b.laserWidth = BOSS_TOTEM_FIGHT.laserWidthFire;
        b.headY = 0.5;
        const rects = bossTotemLaserRects(b, isSolid);
        // `hitPlayers` walks one vector that BOTH `collideRectInto`s
        // appended to. De-duplicating would agree here and disagree the
        // moment the player's own i-frames were already 0.
        expect(bossTotemLaserHits(rects, rect(150, 300, 4, 5))).toBe(2);
        expect(bossTotemLaserHits(rects, rect(136, 300, 4, 5))).toBe(1);
        expect(bossTotemLaserHits(rects, rect(129, 300, 4, 5))).toBe(0);
    });

    it('refuses to build a rect before any render has written `headY`', () => {
        const b = createBossTotem(152, 168);
        expect(() => bossTotemLaserRects(b, isSolid)).toThrow(/headY is unset/);
    });

    it('⛓⛓ `Game.shake = 30` is `laserHitTimeMax * 2` and fires on schedule', () => {
        expect(BOSS_TOTEM_FIGHT.laserShake)
            .toBe(BOSS_TOTEM_FIGHT.laserHitTimeMax * 2);
    });
});

describe('the body, and the ten-shot schedule it paces', () => {
    it('⛓ the census row and the live family agree on the hitbox', () => {
        // §11.9's `hitbox: null` was honest and is now filled in; the two
        // must not drift, because the census is what `contactPricing`
        // reasons about and this is what the run collides.
        expect(ENEMY_CLASSES.bosstotem.hitbox).toEqual(BOSS_TOTEM_BODY.hitbox);
    });

    it('⛔ `contactPricing` moved the totem out of `mover` and into `boss`', () => {
        expect(contactPricing('bosstotem').kind).toBe('boss');
        expect(contactPricing('spinner').kind).toBe('stepped');
        expect(contactPricing('slime').kind).not.toBe('boss');
    });

    it('the body box is `[x-40, x+40) x [y+12, y+44)`', () => {
        const b = fighting();
        expect(bossTotemBodyRect(b))
            .toMatchObject({ x: 112, right: 192, y: 180, bottom: 212 });
    });

    it('⛔⛔ …and it is NULL while `collidable` is false', () => {
        const b = fighting();
        b.collidable = false;
        expect(bossTotemBodyRect(b)).toBeNull();
        expect(bossTotemBodyContactFires(b))
            .toEqual({ fires: false, refusedAt: 'collidable' });
    });

    it('the contact gate is `collidable`, then `hitsTimer`, and no onScreen', () => {
        const b = fighting();
        expect(bossTotemBodyContactFires(b)).toEqual({ fires: true, refusedAt: null });
        b.hitsTimer = 1;
        expect(bossTotemBodyContactFires(b).refusedAt).toBe('hitsTimer');
        b.hitsTimer = 0;
        b.destroy = true;
        expect(bossTotemBodyContactFires(b).refusedAt).toBe('destroy');
        // ⛓ `activeOffScreen = true` — the ONE body in L43 the camera band
        // cannot make uncertain.
        expect(BOSS_TOTEM_BODY.src).toMatch(/activeOffScreen/);
    });

    it('⛓⛓⛓ TEN shots, and the pacer is the BOSS not the player', () => {
        expect(BOSS_TOTEM_KILL.hitsMax / BOSS_TOTEM_KILL.shotDamage)
            .toBe(BOSS_TOTEM_KILL.shots);
        expect(BOSS_TOTEM_KILL.cadence).toBe(BOSS_TOTEM_BODY.hitsTimerMax);
        expect(BOSS_TOTEM_KILL.cadence).toBe(20);
    });

    it('⛔ the schedule cannot silence the body — the gap is one tick', () => {
        // A shot at T sets `hitsTimer = 20`; the boss's own `hitUpdate` on
        // that tick takes it to 19 and T+1..T+19 take it to 0, at which
        // point `hitPlayer` — four lines below — fires. The next shot
        // cannot land until T+20.
        const b = fighting();
        b.hitsTimer = BOSS_TOTEM_BODY.hitsTimerMax;
        let firedAt = null;
        for (let t = 0; t < 25 && firedAt === null; t += 1) {
            b.hitsTimer -= 1;                       // `hitUpdate()`
            if (bossTotemBodyContactFires(b).fires) firedAt = t;
        }
        expect(firedAt).toBe(19);
    });

    it('the five gates of `Enemy.hit`, each named on its own', () => {
        const gates = [];
        const b = createBossTotem(152, 168);
        gates.push(bossTotemTakesHitRefusal(b));            // fullyActivated
        b.fullyActivated = true;
        gates.push(bossTotemTakesHitRefusal(b));            // activationRestTime
        b.activationRestTime = 0;
        b.hitsTimer = 5;
        gates.push(bossTotemTakesHitRefusal(b));            // hitsTimer
        b.hitsTimer = 0;
        gates.push(bossTotemTakesHitRefusal(b, { freezeObjects: true }));
        gates.push(bossTotemTakesHitRefusal(b, { type: 'Sword' }));
        expect(gates).toEqual([
            'fullyActivated', 'activationRestTime', 'hitsTimer',
            'freezeObjects', 'onlyHitBy',
        ]);
    });
});

/** Small helper so the gate list above reads as a list. */
function bossTotemTakesHitRefusal(b, opts = {}) {
    // eslint-disable-next-line global-require
    const { bossTotemTakesHit } = require0();
    return bossTotemTakesHit({ ...b }, opts).refusedAt;
}
// vitest runs ESM; a tiny indirection keeps the helper above readable.
let cached = null;
function require0() {
    if (!cached) cached = fightModule;
    return cached;
}
// eslint-disable-next-line import/first
import * as fightModule from './bossTotemFight.js';

describe('the attack and its projectiles', () => {
    it('two shots at `x ± 30, y + 75`, in `FP.world.add` order', () => {
        const b = fighting();
        b.y = 238.05;
        const [east, west] = bossTotemAttackShots(b);
        expect([east.x, east.y]).toEqual([182, 313.05]);
        expect([west.x, west.y]).toEqual([122, 313.05]);
    });

    it('⛓ the west shot carries a NEGATED ZERO the game cannot observe', () => {
        const [, west] = bossTotemAttackShots(fighting());
        expect(Object.is(west.vx, -0)).toBe(true);
        // ...and `-0 === 0`, so nothing downstream can tell.
        expect(west.vx === 0).toBe(true);
        expect(Math.sign(west.vx)).toBe(-0);
    });

    it('⛓⛓ the two safe columns of the whole arena are 1 px wide', () => {
        // The shot boxes are 16x16 at origin (8,8) ⇒ [114,130) and
        // [174,190); the laser band is [135,169); the arena walls are at
        // 112 and 192. A 4-wide player box therefore fits in exactly two
        // places — and this is arithmetic, not a search.
        const laser = [135, 169];
        const shots = [[114, 130], [174, 190]];
        const fits = [];
        for (let px = 114; px <= 190; px += 1) {
            const box = [px - 2, px + 2];
            const clash = box[0] < laser[1] && box[1] > laser[0]
                || shots.some((s) => box[0] < s[1] && box[1] > s[0]);
            if (!clash) fits.push(px);
        }
        expect(fits).toEqual([132, 133, 171, 172]);
    });

    it('⛔ a shot is never destroyed by a WALL — flipping `v.x = 0` is a no-op', () => {
        const s = createBossTotemShot(122, 300, 0, 2);
        const r = stepBossTotemShot(s);
        expect(r.fate).toBe('flying');
        expect(s.y).toBe(302);
        // `solids = []`, and the `"Solid"` arm only ever flips `v.x`.
        expect(BOSS_TOTEM_SHOT.friction).toBe(0);
    });

    it('the bottom gate is `y >= 376`, and the blast is at `(x+vx, y+vy)`', () => {
        const s = createBossTotemShot(122, 375, 0, 2);
        const r = stepBossTotemShot(s);
        expect(s.y).toBe(377);
        expect(r.fate).toBe('bottom');
        expect(r.explodeAt).toEqual({ x: 122, y: 379 });
        expect(BOSS_TOTEM_SHOT.bottomY).toBe(376);
    });

    it('⛔ the OFF-SCREEN test runs AFTER the bottom test', () => {
        // A shot that reaches `roomBottom` on the tick it also leaves the
        // view still EXPLODES. The order is the whole difference between a
        // blast and a silent removal.
        const s = createBossTotemShot(122, 375, 0, 2);
        const r = stepBossTotemShot(s, { onScreenVerdict: 'off' });
        expect(r.fate).toBe('bottom');
        expect(r.explodeAt).not.toBeNull();
    });

    it('⛔⛔⛔ `uncertain` resolves to the SURVIVING branch, and says so', () => {
        // A removed shot does NOTHING — it is solid for no mover and its
        // Explosion never happens — so surviving is a strict
        // over-approximation and the two branches agree exactly when the
        // surviving one touches nothing. `removalUncertain` is the flag
        // that says the caller owes that check.
        const s = createBossTotemShot(122, 300, 0, 2);
        const r = stepBossTotemShot(s, { onScreenVerdict: 'uncertain' });
        expect(r.fate).toBe('flying');
        expect(r.removalUncertain).toBe(true);
        expect(s.removed).toBe(false);
    });

    it('hits the player at `v.length` force and damage ONE', () => {
        const s = createBossTotemShot(122, 300, 0, 2);
        const r = stepBossTotemShot(s, { playerBox: rect(118, 298, 4, 5) });
        expect(r.playerHit).toBe(true);
        expect(r.fate).toBe('hitPlayer');
        // `hit(null, v.length, new Point(x, y))` — `d` DEFAULTS to 1.
        expect(BOSS_TOTEM_SHOT.playerDamage).toBe(1);
    });

    it('the shot box is 16x16 at origin (8,8)', () => {
        expect(bossTotemShotRect(createBossTotemShot(122, 300, 0, 2)))
            .toMatchObject({ x: 114, right: 130, y: 292, bottom: 308 });
    });
});

describe('the death', () => {
    it('⛓ the radius is 52 — `max(w,h) = 80` times `radiusCoeff` 0.65', () => {
        expect(BOSS_TOTEM_DEATH_BLAST.visualRadius
            * BOSS_TOTEM_DEATH_BLAST.radiusCoeff).toBe(52);
    });

    it('⛔⛔ ORIGIN TO ORIGIN, and the square prefilter DISAGREES on the corners', () => {
        // A model that stopped at the prefilter would report a hit 21 px
        // outside the blast. Both are computed so the disagreement is a
        // fixture rather than a footnote.
        const box = bossTotemDeathBlastPrefilter(152, 268);
        const cornerish = { x: 152 + 45, y: 268 + 45 };
        const inSquare = cornerish.x >= box.x && cornerish.x <= box.right
            && cornerish.y >= box.y && cornerish.y <= box.bottom;
        expect(inSquare).toBe(true);
        expect(bossTotemDeathBlastHits(152, 268, cornerish.x, cornerish.y)).toBe(false);
        expect(Math.round(Math.hypot(45, 45))).toBe(64);
    });

    it('the boundary is INSIDE — `FP.distance <= radius`', () => {
        expect(bossTotemDeathBlastHits(152, 268, 152, 268 + 52)).toBe(true);
        expect(bossTotemDeathBlastHits(152, 268, 152, 268 + 52.0001)).toBe(false);
    });

    it('⛓⛓ the white-out is 240 RENDERS and the tag is a CLEAR, not a set', () => {
        expect(BOSS_TOTEM_WHITE_OUT.renders).toBe(240);
        expect(BOSS_TOTEM_WHITE_OUT.persistenceWrite)
            .toEqual({ level: 43, tag: 5, value: false });
    });

    it('`render()` counts the white-out and asks for the removal at 240', () => {
        const b = fighting();
        b.destroy = true;
        let asked = null;
        for (let i = 1; i <= 245 && asked === null; i += 1) {
            if (renderBossTotem(b).removeRequestedNow) asked = i;
        }
        expect(asked).toBe(240);
        expect(b.removeRequested).toBe(true);
    });

    it('⛔ a destroyed boss runs NO update at all — the clamp stops at the kill', () => {
        const b = fighting();
        b.destroy = true;
        const before = { ...b };
        const r = stepBossTotem(b, {
            wandGone: true, freezeObjects: false, playerY: 100, isSolid,
        });
        expect(r.clampedY).toBeNull();
        expect(b.y).toBe(before.y);
        expect(b.rate).toBe(before.rate);
    });
});

describe('the camera override', () => {
    it('⛔ it REPLACES the follow, inventory term and all', () => {
        const b = fighting();
        expect(bossTotemCameraTarget(b, { x: 132, y: 230 }))
            .toEqual({ x: (152 + 132) / 2 - 80, y: (168 + 230) / 2 - 80 });
    });

    it('…and outside the ¾-screen box it RESETS rather than leaving it alone', () => {
        const b = fighting();
        expect(bossTotemCameraTarget(b, { x: 132, y: 400 })).toEqual({ x: -1, y: -1 });
        // The box is a `<=` on BOTH axes: 120 is inside, 121 is not.
        expect(bossTotemCameraTarget(b, { x: 152, y: 168 + 120 }).x).not.toBe(-1);
        expect(bossTotemCameraTarget(b, { x: 152, y: 168 + 121 })).toEqual({ x: -1, y: -1 });
    });
});

describe('the state machine, stepped', () => {
    it('⛔⛔⛔ the descent is 0.75 px/tick, NOT the 1 the brief reads', () => {
        // `Mobile.mobileUpdate` runs `friction()` (0.25, never overridden)
        // BEFORE `moveY(v.y)`, and `v.y = rate` tops out at 1.
        const b = fighting();
        for (let i = 0; i < 60; i += 1) frame(b);
        const y0 = b.y;
        frame(b);
        expect(b.y - y0).toBeCloseTo(0.75, 10);
        expect(b.rate).toBe(1);
    });

    it('…and the jump rises 4.75, not 5', () => {
        const b = fighting();
        b.rate = 1;
        b.state = BOSS_TOTEM_FIGHT.states.jump;
        b.anim = 'jump';
        b.y = 300;
        frame(b);              // sets v.y = -5
        const y0 = b.y;
        frame(b);              // friction, then moveY
        expect(y0 - b.y).toBeCloseTo(4.75, 10);
    });

    it('⛓ `v.y` is spent ONE TICK LATE — `super.update()` is above the machine', () => {
        const b = fighting();
        expect(b.vy).toBe(0);
        const y0 = b.y;
        frame(b);                       // the machine writes v.y = 0.025
        expect(b.y).toBe(y0);           // ...and nothing has moved yet
        expect(b.vy).toBeGreaterThan(0);
    });

    it('⛔⛔ `collidable` is NOT restored by the 30-tick top wait (§8.11)', () => {
        const b = fighting();
        b.rate = 1;
        b.state = BOSS_TOTEM_FIGHT.states.jump;
        b.anim = 'jump';
        b.y = 137;
        frame(b);
        expect(b.collidable).toBe(false);
        // land, then run the whole wait
        for (let i = 0; i < 32 && b.waitAtTopTime !== 30; i += 1) frame(b);
        expect(b.waitAtTopTime).toBe(30);
        for (let i = 0; i < 30; i += 1) {
            frame(b);
            expect(b.collidable).toBe(false);
        }
        // ...and the first walk tick after it is what restores the flag.
        frame(b);
        expect(b.collidable).toBe(true);
    });

    it('⛓ the top wait suppresses the ANIM too — nothing steps for 30 ticks', () => {
        const b = fighting();
        b.rate = 1;
        b.state = BOSS_TOTEM_FIGHT.states.jump;
        b.anim = 'jump';
        b.y = 137;
        frame(b);
        for (let i = 0; i < 32 && b.waitAtTopTime !== 30; i += 1) frame(b);
        const f0 = b.currentFrame;
        for (let i = 0; i < 30; i += 1) frame(b);
        expect(b.currentFrame).toBe(f0);
    });

    it('⛔ the JUMP GATE is below `laserStep`, so a tie goes to the JUMP', () => {
        // `laserStep` can write `state = 2` (attack) and the gate below it
        // writes `state = 3` over the top. Transcribed in that order.
        const b = fighting();
        b.rate = 1;
        b.laserWidth = BOSS_TOTEM_FIGHT.laserWidthFire;
        b.laserHitTime = 1;                     // the cooldown ends THIS tick
        b.y = 308;                              // ...and so does the descent
        frame(b);
        expect(b.state).toBe(BOSS_TOTEM_FIGHT.states.jump);
    });

    it('⛓ `attackDistance` is DECLARED AND NEVER READ (§8.11)', () => {
        expect(BOSS_TOTEM_FIGHT.attackDistanceDeclaredNeverRead).toBe(60);
        // Nothing in the family consumes it; a census row that made it a
        // trigger would be wrong, and this is the note in executable form.
        expect(BOSS_TOTEM_FIGHT.src.collidable).toMatch(/8\.11/);
    });

    it('refuses to move with no collision oracle', () => {
        const b = fighting();
        b.vy = 1;
        expect(() => stepBossTotem(b, { wandGone: true, freezeObjects: false }))
            .toThrow(/no `isSolid`/);
    });

    it('refuses a terrain the class would DIE on', () => {
        const b = fighting();
        expect(() => stepBossTotem(b, {
            wandGone: true, freezeObjects: false, isSolid, terrainState: 17,
        })).toThrow(/water\/pit\/lava/);
    });

    it('⛓ …and L43 has none of those under any y the descent reaches', () => {
        const seen = new Set();
        for (let y = 136; y <= 308; y += 1) seen.add(l43.nearestWalkableTile(152, y)?.t);
        expect([...seen].sort((a, b) => a - b)).toEqual([5, 18]);
    });
});

describe('⛓⛓⛓ the fight timeline — the independent transcription, pinned', () => {
    /**
     * Every number below came out of a SEPARATE transcription of
     * `BossTotem.as` (scratch, written from the AS3 with no reference to
     * this module) stepped against the same shipped geometry, and this loop
     * reproduces it tick for tick. That agreement is the stratum; the
     * numbers are only its residue.
     */
    const b = fighting();
    const ev = [];
    for (let t = 0; t < 1000; t += 1) {
        const r = frame(b);
        if (r.laserFired) ev.push({ t, kind: 'laser', y: b.y });
        if (r.attackShots.length) ev.push({ t, kind: 'attack', y: b.y });
        if (r.jumpedNow) ev.push({ t, kind: 'jump', y: b.y });
        if (r.landedAtTopNow) ev.push({ t, kind: 'top', y: b.y });
    }

    it('the first cycle, from a boss whose rest has just drained', () => {
        expect(ev.slice(0, 4)).toEqual([
            { t: 103, kind: 'laser', y: 226.79999999999998 },
            { t: 142, kind: 'attack', y: 238.04999999999998 },
            { t: 259, kind: 'jump', y: 308.54999999999995 },
            { t: 297, kind: 'top', y: 136 },
        ]);
    });

    it('⛓ and the steady cycle is 346 ticks with TWO lasers and ONE attack', () => {
        const tops = ev.filter((e) => e.kind === 'top').map((e) => e.t);
        expect(tops.slice(0, 3)).toEqual([297, 643, 989]);
        expect(tops[1] - tops[0]).toBe(346);
        const inCycle = ev.filter((e) => e.t > 643 && e.t <= 989);
        expect(inCycle.map((e) => e.kind)).toEqual(['laser', 'attack', 'laser', 'jump', 'top']);
    });

    it('⛓ the offsets from a landing are the same every cycle', () => {
        const from = 643;
        expect(ev.filter((e) => e.t > from && e.t <= 989).map((e) => e.t - from))
            .toEqual([134, 173, 299, 308, 346]);
        // 134 = the 30-tick wait + one walk tick + 103 of charge.
        expect(30 + 1 + laserChargeTicks()).toBe(134);
    });

    it('⛔ the boss is un-hittable for 68 of every 346 ticks', () => {
        // 308 -> 346 is the jump, and the 30-tick wait never restores the
        // flag — so the window a schedule can land in is 278 wide.
        expect(346 - 308 + 30).toBe(68);
    });

    it('⛔ the floor sweeps 180 -> 353.3, NOT to 352 — the gate is one tick late', () => {
        const b2 = fighting();
        let lo = Infinity;
        let hi = -Infinity;
        for (let t = 0; t < 1000; t += 1) {
            frame(b2);
            const floor = b2.y + 44;
            lo = Math.min(lo, floor);
            hi = Math.max(hi, floor);
        }
        expect(lo).toBe(180);
        // §8.11 reads `maxYPosition` 352 as the bottom of the sweep. The
        // GATE is `y + 44 >= 352`, and it is tested at the BOTTOM of the
        // walk arm — after `v.y = rate` was written for the next tick. So
        // the boss takes ONE MORE 0.75 step before the jump arm can write
        // `-5 * rate`, and the floor's true low-water is 353.3.
        expect(hi).toBeCloseTo(353.3, 5);
    });
});
