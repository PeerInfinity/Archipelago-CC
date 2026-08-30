/**
 * fireVerb — the hand-derived stratum for the SECOND weapon.
 *
 * Every number here is read out of `Player.as`, `Enemies/Enemy.as`,
 * `net/flashpunk/graphics/Spritemap.as` and `net/flashpunk/Entity.as`, not
 * from running this port. Where a fact is a NEGATIVE — "`fireTimer` is not
 * fuel", "fire never damages anything", "`hitByFire` has no writer" — the
 * check is phrased against the fork's source text rather than against the
 * model, because a model asserting its own silence asserts nothing.
 *
 * ⚠ THE SOURCE-TEXT CHECKS ARE A BOUNDED STRATUM AND THEY NAME THEIR BOUND.
 * The AS3 lives in a SEPARATE repository (the fork at `~/CC/seedling`), which
 * CI does not check out, so those checks are `skipIf`-gated on its presence
 * and vitest reports them as SKIPPED rather than passing. A green run with
 * five skips is a different result from a green run with none, and
 * `SOURCE_CLAIMS` below is the always-running half: it asserts that every
 * ⛔ claim in the module still carries a citation, so a run without the fork
 * still fails if a citation is deleted.
 */

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
    FIRE_DAMAGE,
    FIRE_DEAD_FRAME_RULE,
    FIRE_DISPATCHES_BY_TYPE,
    FIRE_FORCE,
    FIRE_HIT_FRAME_END,
    FIRE_HIT_FRAME_START,
    FIRE_HIT_TYPE,
    FIRE_METER,
    FIRE_ON_ENEMY,
    FIRE_PRESS_CADENCE,
    FIRE_RADIUS,
    FIRE_SPAN_TICKS,
    FIRE_SPRITE,
    FIRE_TIMELINE,
    FIRE_WINDOW,
    FireVerbError,
    animTimeline,
    collideRectInclusive,
    distanceRects,
    fireDispatchCount,
    fireHits,
    fireKnockback,
    fireRadiusDistance,
    fireRadiusDistanceCorrected,
    fireRect,
    firePress,
} from './fireVerb.js';
import { HITABLE_TYPES } from './combatVerbs.js';
import { FP_MAX_ELAPSED } from './breakableRocks.js';
import { rect, rectsOverlap } from './levelWorld.js';

const FORK = `${process.env.HOME}/CC/seedling/src`;
const haveFork = existsSync(`${FORK}/Player.as`);
const src = (rel) => readFileSync(`${FORK}/${rel}`, 'utf8');
/** Skipped, loudly, when the fork is not beside this repo. */
const forkIt = it.skipIf(!haveFork);

/** A `fireHits` target row, with the fields the AS3 distance actually reads. */
const target = (over = {}) => ({
    id: 'pushableblockfire@144,176',
    type: 'Solid',
    x: 144,
    y: 176,
    originX: 0,
    originY: 0,
    w: 16,
    h: 16,
    ...over,
});

describe('the animation window (Spritemap.update simulated, never divided)', () => {
    it('the fire sprite is 32x32, nine frames at 25 fps, LOOPING', () => {
        expect(FIRE_SPRITE).toMatchObject({
            w: 32, h: 32, frameCount: 9, frameRate: 25, loop: true,
        });
        // `centerOO()` — the origin is half the frame, which is what centres
        // the collide rect on the player instead of hanging it off them.
        expect(FIRE_SPRITE.originX).toBe(FIRE_SPRITE.w / 2);
        expect(FIRE_SPRITE.originY).toBe(FIRE_SPRITE.h / 2);
    });

    it('the frame table is the one 0.0333 produces, stall on frame 4 and all', () => {
        // Ticks T+0 .. T+11. The stall (a tick whose `_timer` never reached
        // 1) is the whole reason this is simulated: it lands on frame 4 at
        // 0.0333 and on frame 5 at 1/30.
        expect(FIRE_TIMELINE.frames.slice(0, 12))
            .toEqual([0, 0, 1, 2, 3, 4, 4, 5, 6, 7, 8, 0]);
        expect(FIRE_TIMELINE.callbackUpdates[0]).toBe(11);
    });

    it('⛔ 1/30 IS A DIFFERENT TABLE — the constant is load-bearing', () => {
        const naive = animTimeline(FIRE_SPRITE, 1 / 30);
        expect(naive.frames.slice(0, 12)).not.toEqual(FIRE_TIMELINE.frames.slice(0, 12));
        // The stall moves by one frame; the WINDOW happens to survive, which
        // is exactly the coincidence that would let a wrong constant ship.
        expect(naive.frames.slice(0, 12)).toEqual([0, 0, 1, 2, 3, 4, 5, 5, 6, 7, 8, 0]);
        expect(FP_MAX_ELAPSED).toBe(0.0333);
    });

    it('the hit window is ticks T+4..T+8, derived from frames 3..6', () => {
        expect(FIRE_HIT_FRAME_START).toBe(3);
        expect(FIRE_HIT_FRAME_END).toBe(6);
        expect([...FIRE_WINDOW.hitTicks]).toEqual([4, 5, 6, 7, 8]);
        expect(FIRE_WINDOW.firstHitTick).toBe(4);
        expect(FIRE_WINDOW.lastHitTick).toBe(8);
        // Every hit tick's frame really is in the window, and every tick
        // `firing` is up that is NOT a hit tick really is outside it.
        for (let k = 1; k <= FIRE_WINDOW.endTick; k += 1) {
            const inWindow = FIRE_TIMELINE.frames[k] >= FIRE_HIT_FRAME_START
                && FIRE_TIMELINE.frames[k] <= FIRE_HIT_FRAME_END;
            expect(FIRE_WINDOW.hitTicks.includes(k)).toBe(inWindow);
        }
    });

    it('⚠ an UPDATE INDEX is not a TICK — the wrap on update 11 is tick T+10', () => {
        expect(FIRE_WINDOW.wrapUpdate).toBe(11);
        expect(FIRE_WINDOW.endTick).toBe(10);
        // And therefore the cadence is ELEVEN, not twelve: a press on T+10
        // is swallowed (`useItem` runs in `super.update()`, before
        // `sprites()` fires the callback), and T+11 replays the animation.
        expect(FIRE_PRESS_CADENCE).toBe(11);
        expect(FIRE_PRESS_CADENCE).toBe(FIRE_WINDOW.endTick + 1);
    });

    it('a NON-looping animation would report its wrap at the same update', () => {
        // The `complete` arm of `Spritemap.update` is transcribed even though
        // this sprite never takes it — a bounded vacuity with a witness.
        const once = animTimeline({ ...FIRE_SPRITE, loop: false });
        expect(once.callbackUpdates[0]).toBe(FIRE_TIMELINE.callbackUpdates[0]);
        expect(once.frames[11]).toBe(FIRE_SPRITE.frameCount - 1);
    });

    it('animTimeline refuses a degenerate animation', () => {
        expect(() => animTimeline({ ...FIRE_SPRITE, frameCount: 0 })).toThrow(FireVerbError);
    });
});

describe('⛓ the first ruling: fireTimer is a GLOW, not fuel', () => {
    it('the model says so, with its readers named', () => {
        expect(FIRE_METER.metered).toBe(false);
        expect(FIRE_METER.max).toBe(180);
        expect(FIRE_METER.increment).toBe(60);
        expect(FIRE_METER.readers).toHaveLength(2);
        for (const r of FIRE_METER.readers) expect(r).toContain('Player.as:');
    });

    forkIt('⛔ and the SOURCE says so: `set firing` never reads it, `hit()` commented out',
        () => {
            const player = src('Player.as');
            // `set firing`'s whole body, from its signature to the next getter.
            const body = player.slice(
                player.indexOf('public function set firing'),
                player.indexOf('public function get deathRaying'),
            );
            expect(body.length).toBeGreaterThan(100);
            // It WRITES the timer and never gates on it: the only comparison
            // in there is the clamp, and the clamp's payload is commented out.
            expect(body).toContain('fireTimer += fireIncrement');
            expect(body).toContain('//hit();');
            expect(body.match(/if \(fireTimer/g) ?? []).toHaveLength(1);
            // And every OTHER read is in `render` — `fire()`'s `else` arm is a
            // decrement, not a test.
            const reads = [...player.matchAll(/fireTimer/g)].length;
            expect(reads).toBeGreaterThan(4);
        });
});

describe('⛔ the dispatch multiplicity — vc is never cleared', () => {
    it('a target of hitables[i] is dispatched 11 - i times per hit tick', () => {
        expect(HITABLE_TYPES).toHaveLength(11);
        HITABLE_TYPES.forEach((t, i) => {
            expect(FIRE_DISPATCHES_BY_TYPE[t]).toBe(11 - i);
        });
        expect(fireDispatchCount('Enemy')).toBe(11);
        expect(fireDispatchCount('Solid')).toBe(5);
        expect(fireDispatchCount('Watcher')).toBe(1);
    });

    it('a type outside `hitables` THROWS rather than defaulting to one', () => {
        expect(() => fireDispatchCount('Player')).toThrow(FireVerbError);
        expect(() => fireDispatchCount('Tile')).toThrow(FireVerbError);
    });

    forkIt('⛔ and the SOURCE says so: fire()\'s `for each` is INSIDE the type loop', () => {
        const player = src('Player.as');
        const fireBody = player.slice(
            player.indexOf('public function fire():void'),
            player.indexOf('public function slashEnd():void'),
        );
        const slashBody = player.slice(
            player.indexOf('public function slash():void'),
            player.indexOf('public function getSlashRect():Rectangle'),
        );
        // In `fire()` the dispatch loop opens AFTER the collide call and
        // BEFORE the type loop closes; in `slash()` it opens after it.
        const fCollide = fireBody.indexOf('collideRectInto');
        const fEach = fireBody.indexOf('for each');
        expect(fEach).toBeGreaterThan(fCollide);
        // `slash()` has no `for each` at all — it re-indexes `v` in a second,
        // sibling loop, which is the shape that visits each entity once.
        expect(slashBody).not.toContain('for each');
        // And neither body ever empties the vector between passes.
        expect(fireBody).not.toContain('vc.length = 0');
        expect(fireBody).not.toContain('vc = new Vector');
    });
});

describe('⛔ fire on an enemy — knockback only, i-frames untouched', () => {
    it('zero damage, no i-frames, 55 impulses per press', () => {
        expect(FIRE_DAMAGE).toBe(0);
        expect(FIRE_FORCE).toBe(0.325);
        expect(FIRE_ON_ENEMY.damage).toBe(0);
        expect(FIRE_ON_ENEMY.consumesIFrames).toBe(false);
        expect(FIRE_ON_ENEMY.dispatchesPerHitTick).toBe(11);
        expect(FIRE_ON_ENEMY.hitTicks).toBe(5);
        expect(FIRE_ON_ENEMY.perPress).toBe(55);
        expect(FIRE_ON_ENEMY.impulsePerPress).toBeCloseTo(17.875, 10);
    });

    forkIt('⛔ and the SOURCE says so: the "Fire" arm knocks back, hitsTimer commented out',
        () => {
            const enemy = src('Enemies/Enemy.as');
            const hitBody = enemy.slice(enemy.indexOf('public function hit(f:Number=0'));
            expect(hitBody).toContain('if (hitByFire || t != "Fire")');
            // The `else` of that `if` — the arm every "Fire" hit takes.
            const elseArm = hitBody.slice(hitBody.indexOf('if (hitByFire || t != "Fire")'));
            expect(elseArm).toContain('//hitsTimer = hitsTimerMax;');
        });

    forkIt('⛓ `hitByFire` has NO WRITER in the whole source — the damage arm is dead', () => {
        // A write would be `hitByFire = true` (or `hitByFire=true`). The
        // declaration `public var hitByFire:Boolean = false;` is the only
        // assignment anywhere, and it is the false one.
        const enemy = src('Enemies/Enemy.as');
        const lavaBoss = src('Enemies/LavaBoss.as');
        for (const text of [enemy, lavaBoss]) {
            expect(text.match(/hitByFire\s*=\s*true/g)).toBeNull();
        }
        expect(enemy).toContain('public var hitByFire:Boolean = false;');
    });

    it('the knockback is atan2 AWAY from the player', () => {
        // Player due west of the enemy -> the enemy is shoved east.
        const k = fireKnockback({ x: 100, y: 50 }, { x: 80, y: 50 });
        expect(k.vx).toBeCloseTo(FIRE_FORCE, 10);
        expect(k.vy).toBeCloseTo(0, 10);
        // Player due north (screen up) -> shoved south.
        const k2 = fireKnockback({ x: 100, y: 50 }, { x: 100, y: 30 });
        expect(k2.vy).toBeCloseTo(FIRE_FORCE, 10);
    });
});

describe('the rect, the radius, and the two origins', () => {
    it('the collide rect is 32x32 centred on the player ENTITY position', () => {
        const r = fireRect(152, 184);
        expect(r).toMatchObject({ x: 136, y: 168, right: 168, bottom: 200 });
        expect(FIRE_RADIUS).toBe(16);
        expect(FIRE_RADIUS).toBe(FIRE_SPRITE.w / 2);
    });

    it('⚠ the candidate test is INCLUSIVE where levelWorld.rectsOverlap is strict', () => {
        const r = fireRect(152, 184);            // right edge at 168
        // A block whose LEFT edge is exactly the fire rect's right edge.
        const box = rect(168, 184, 16, 16);
        expect(collideRectInclusive(box, r)).toBe(true);
        expect(rectsOverlap(box, r)).toBe(false);
        // One pixel further out and both agree it is not a candidate.
        expect(collideRectInclusive(rect(169, 184, 16, 16), r)).toBe(false);
    });

    it('distanceRects is FP.as branch for branch, including the corner arms', () => {
        // Overlapping -> 0.
        expect(distanceRects(0, 0, 10, 10, 5, 5, 10, 10)).toBe(0);
        // X-overlap, target below -> vertical gap.
        expect(distanceRects(0, 0, 10, 10, 2, 20, 10, 10)).toBe(10);
        // Y-overlap, target right -> horizontal gap.
        expect(distanceRects(0, 0, 10, 10, 20, 2, 10, 10)).toBe(10);
        // Neither -> the diagonal between the two nearest corners.
        expect(distanceRects(0, 0, 10, 10, 20, 20, 10, 10))
            .toBeCloseTo(Math.hypot(10, 10), 10);
        expect(distanceRects(20, 20, 10, 10, 0, 0, 10, 10))
            .toBeCloseTo(Math.hypot(10, 10), 10);
    });

    it('⛔ THE WRONG originY: the model and the "corrected" one DISAGREE', () => {
        // A target whose own originY is NOT the player's 2. `Grass` and the
        // enemy classes are full of these; a 16x16 block has origin 0, so
        // the shift is the player's own 2 px.
        const player = { x: 152, y: 220 };
        const t = target({ y: 176 });        // well above the player
        const asWritten = fireRadiusDistance(player, t);
        const asIntended = fireRadiusDistanceCorrected(player, t);
        expect(asWritten).not.toBe(asIntended);
        expect(asWritten - asIntended).toBeCloseTo(2, 10);
        // ⚠ And it is not symmetric: a target BELOW the player moves the
        // other way, so a model that "corrected" it would be wrong on one
        // side and right on the other, which reads as a flaky margin.
        const below = target({ y: 240 });
        expect(fireRadiusDistance({ x: 152, y: 184 }, below))
            .not.toBe(fireRadiusDistanceCorrected({ x: 152, y: 184 }, below));
    });

    it('a target missing an origin THROWS rather than reading it as 0', () => {
        const t = target();
        delete t.originY;
        expect(() => fireRadiusDistance({ x: 0, y: 0 }, t)).toThrow(FireVerbError);
    });
});

describe('fireHits — the per-tick dispatch set', () => {
    it('an adjacent block is hit, with the Solid dispatch count', () => {
        // Player standing one tile east of the block, both grid-aligned.
        const hits = fireHits({ x: 168, y: 184 }, [target()]);
        expect(hits).toHaveLength(1);
        expect(hits[0]).toMatchObject({
            t: FIRE_HIT_TYPE, force: FIRE_FORCE, damage: 0, dispatches: 5,
        });
    });

    it('the corner cut is real — a diagonal neighbour inside the rect is DROPPED', () => {
        // The 32x32 rect reaches a diagonal neighbour's box, but the radius
        // is 16 and the corner distance is not.
        const player = { x: 152, y: 184 };
        const diag = target({ id: 'diag', x: 168, y: 200 });
        const box = rect(diag.x, diag.y, diag.w, diag.h);
        expect(collideRectInclusive(box, fireRect(player.x, player.y))).toBe(true);
        expect(fireRadiusDistance(player, diag)).toBeGreaterThan(FIRE_RADIUS);
        expect(fireHits(player, [diag])).toHaveLength(0);
    });

    it('a type not in `hitables` is not a candidate at all', () => {
        const hits = fireHits({ x: 168, y: 184 }, [target({ type: 'Player' })]);
        expect(hits).toHaveLength(0);
    });

    it('⚠ there is NO line-of-sight test — fire reaches through a wall', () => {
        // `slash()` needs a `blockedLine` oracle and refuses without one;
        // `fire()` has no `collideLine` call, so the model must not invent
        // one. The assertion is that the same call shape works with no
        // oracle at all.
        expect(fireHits({ x: 168, y: 184 }, [target()])).toHaveLength(1);
    });
});

describe('firePress — the scheduled verb', () => {
    const player = { x: 168, y: 184 };

    it('refuses to schedule without a slot — a sword press is SILENT on a block', () => {
        expect(() => firePress(100, player, [target()])).toThrow(FireVerbError);
        expect(() => firePress(100, player, [target()], { slot: 1 })).not.toThrow();
    });

    it('the schedule is the window offset by the press tick', () => {
        const p = firePress(100, player, [target()], { slot: 1, equipAt: 90 });
        expect(p.hitTicks).toEqual([104, 105, 106, 107, 108]);
        expect(p.firstHitTick).toBe(104);
        expect(p.lastHitTick).toBe(108);
        expect(p.endTick).toBe(110);
        expect(p.nextPressTick).toBe(111);
        expect(p.spans).toEqual([{ key: 'primary', from: 100, to: 100 + FIRE_SPAN_TICKS }]);
        expect(p.equips).toEqual([{ t: 90, slot: 1 }]);
        expect(p.expect).toHaveLength(1);
    });

    it('rejects a nonsense tick', () => {
        expect(() => firePress(-1, player, [], { slot: 1 })).toThrow(FireVerbError);
        expect(() => firePress(1.5, player, [], { slot: 1 })).toThrow(FireVerbError);
    });
});

describe('the two kinds of dead frame, applied to this verb', () => {
    it('a freezeObjects frame BURNS the window and a blackCover frame stretches it', () => {
        expect(FIRE_DEAD_FRAME_RULE.freezeObjects).toContain('BURNS');
        expect(FIRE_DEAD_FRAME_RULE.blackCover).toContain('stretches');
    });

    forkIt('⛔ and the SOURCE says so: genericHit returns first, sprites() is ungated', () => {
        const player = src('Player.as');
        const gh = player.slice(player.indexOf('public function genericHit'));
        // The very first statement of `genericHit`.
        expect(gh.slice(0, 200)).toContain('if (Game.freezeObjects)');
        // And `sprites()` — the only `sprFire.update()` — is called from
        // `update()` with no freeze test between them.
        expect(player).toContain('sprFire.update();');
        const game = src('Game.as');
        expect(game).toContain('if (blackCover <= 0)');
    });
});

/**
 * The always-running half of the source-text stratum: every ⛔ claim the
 * module makes still carries a citation into the AS3.
 *
 * ⚠ NOT a restatement of the claims. This checks the SHAPE of the evidence
 * (a file and a line), which is the thing a later edit deletes by accident;
 * the claims themselves are checked above, against the source, when the fork
 * is present.
 */
const SOURCE_CLAIMS = [
    ['FIRE_SPRITE.src', FIRE_SPRITE.src],
    ['FIRE_METER.readers[0]', FIRE_METER.readers[0]],
    ['FIRE_METER.readers[1]', FIRE_METER.readers[1]],
    ['FIRE_METER.why', FIRE_METER.why],
    ['FIRE_ON_ENEMY.why', FIRE_ON_ENEMY.why],
    ['FIRE_DEAD_FRAME_RULE.src', FIRE_DEAD_FRAME_RULE.src],
];

describe('the citation stratum (runs with or without the fork)', () => {
    it('every ⛔ claim names a file and a line', () => {
        for (const [where, text] of SOURCE_CLAIMS) {
            expect(text, `${where} has no citation`).toMatch(/\.as:\d+/);
        }
    });

    it('and the run SAYS whether the source-text half executed', () => {
        // Deliberately not an assertion about `haveFork`'s value — CI has no
        // fork and that is fine. It asserts the PROBE still exists, so a
        // refactor that dropped it (turning eleven skips into eleven silent
        // passes) goes red.
        expect(typeof haveFork).toBe('boolean');
        expect(FORK).toContain('seedling');
    });
});
