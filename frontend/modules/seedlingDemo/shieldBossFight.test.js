/**
 * shieldBossFight.test — THE SHIELDSPIRE'S OWN STRATUM.
 *
 * Region-atlas Phase 8, rung R6, slice 5. The window and the pair live in
 * `shieldFight.test.js`; this file tests the transcription — the animation
 * clock, the two rectangles, the state machine's five paths, the swallowed
 * dispatch, and the three instants of the death.
 *
 * ⚠ THE MUTATION LIST, and the non-biters recorded as bounded vacuities:
 *
 *   BITES  `movedShield` 16 -> 15 (the window shifts and the schedule's
 *          landing leaves it); `die` 23 -> 22 (`destroy` a tick early);
 *          the fade 11 -> 10 (the wall opens early); `swingTimeMax` 120 ->
 *          119 (every stab moves); the band rect's `+height` -> `-height`
 *          (the strip lands on the body); `frame >= 5` -> `>= 4` (the
 *          damage window widens by two ticks); dropping the `activated`
 *          arm (three hits become four); dropping `sit()` from the window
 *          arm (the stab is never aborted); `startStab`'s `hitsTimer <= 0`
 *          -> unconditional (a stab starts inside the i-frame).
 *   VACUOUS `sit`'s frameRate 0 -> anything (nothing calls `endAnim` from
 *          `sit`, because `stabbing` is false there — but the frameRate is
 *          what makes it structurally impossible, so it is asserted);
 *          `moveShield`'s `retaliation` arm reordered (both arms play a
 *          real anim; only the WINDOW differs, which the window test
 *          measures).
 */

import { describe, expect, it } from 'vitest';

import {
    BOSS_KEY, FP_ELAPSED_CLAMPED, SHIELD_BOSS, SHIELD_BOSS_ANIMS,
    SHIELD_BOSS_ANIM_UPDATES, SHIELD_BOSS_DEAD_ARM, SHIELD_BOSS_DIE_UPDATES,
    SHIELD_BOSS_WINDOW_UPDATES, ShieldBossError, advanceShieldBossGraphic, bossKeyRect,
    bossKeyReachable, createShieldBoss, playShieldBossAnim, shieldBossAnimUpdates,
    shieldBossBandRect, shieldBossBodyRect, shieldBossDeathSchedule, shieldBossEndAnim,
    shieldBossFrameDamages, shieldBossSit, shieldBossStartDeath, shieldBossStartStab,
    shieldBossTakesHit, shieldBossWindowFor, stabIndexReachedAt, stepShieldBoss,
} from './shieldBossFight.js';
import { R6_ANIM_CLOCKS, animCallbackUpdate } from './r6Acceptance.js';
import { CORPSE_COUNTING, KILL_ARM_POLICY, MOBILE_DEATH_FADE } from './enemyDamage.js';
import { CONTACT_BOSS_FAMILIES, ENEMY_CLASSES, contactPricing } from './combat.js';

const boss = (over = {}) => createShieldBoss({ id: 'b', x: 104, y: 64, tag: 0, ...over });
const box = (px, py) => ({ x: px - 2, y: py - 2, right: px + 2, bottom: py + 3, w: 4, h: 5 });
/** The stance the window uses: pinned against the body, inside the band. */
const STANCE = box(104, 90.05);

describe('the anim clock — DERIVED twice, and the two derivations agree', () => {
    it('⛓ every row matches `r6Acceptance`\'s table, which computes it separately', () => {
        const mine = SHIELD_BOSS_ANIM_UPDATES;
        const theirs = Object.fromEntries(R6_ANIM_CLOCKS
            .filter((r) => r.owner === 'ShieldBoss')
            .map((r) => [r.anim, r.expect]));
        expect(mine).toEqual(theirs);
        // ...and both agree with a third computation from the raw args.
        for (const [name, a] of Object.entries(SHIELD_BOSS_ANIMS)) {
            const n = a.frameRate === 0 ? Infinity
                : animCallbackUpdate(a.frameRate, a.frames.length);
            expect(mine[name], name).toBe(n);
        }
    });

    it('⛔ `movedShield` is SIXTEEN and it is the only window', () => {
        expect(SHIELD_BOSS_WINDOW_UPDATES).toBe(16);
        expect(SHIELD_BOSS_ANIM_UPDATES.movedShield).toBe(16);
        // 1 frame at frameRate 2 -> step 0.0666, and 15 steps reach 0.999.
        expect(SHIELD_BOSS_ANIMS.movedShield.frameRate * FP_ELAPSED_CLAMPED)
            .toBeCloseTo(0.0666, 10);
    });

    it('⛔ `die` is 23 updates, not §2.4\'s "~44"', () => {
        expect(SHIELD_BOSS_DIE_UPDATES).toBe(23);
    });

    it('⛓ `sit` NEVER fires its callback — frameRate 0, and that is a real case', () => {
        expect(SHIELD_BOSS_ANIMS.sit.frameRate).toBe(0);
        expect(SHIELD_BOSS_ANIM_UPDATES.sit).toBe(Infinity);
        // The structural half: even 100000 graphic advances move nothing.
        const b = boss();
        for (let i = 0; i < 1000; i += 1) expect(advanceShieldBossGraphic(b)).toBe(false);
        expect(b.anim).toBe('sit');
        expect(b.animTimer).toBe(0);
    });

    it('refuses a non-positive frame count rather than returning 0', () => {
        expect(() => shieldBossAnimUpdates(15, 0)).toThrow(ShieldBossError);
        expect(() => shieldBossAnimUpdates(-1, 3)).toThrow(ShieldBossError);
    });

    it('⛓ SIMULATED, not divided — the two answers differ on `stab`', () => {
        // 6 / (15 * 0.0333) = 12.012…, whose ceiling is 13 and whose floor
        // is 12. The loop is what makes the fencepost non-negotiable.
        expect(SHIELD_BOSS_ANIM_UPDATES.stab).toBe(13);
        expect(Math.floor(6 / (15 * FP_ELAPSED_CLAMPED))).toBe(12);
    });
});

describe('the two rectangles — and they are not the same rectangle', () => {
    it('⛓ the body is `setHitbox(48,48,24,24)` at the asymmetric ctor point', () => {
        expect(shieldBossBodyRect(boss()))
            .toMatchObject({ x: 80, y: 40, right: 128, bottom: 88 });
        expect(SHIELD_BOSS.ctorOffset).toEqual({ dx: 24, dy: 32 });
    });

    it('⛔ the BAND is `(x-24, y+24, 48, Tile.h)` — BELOW the body, not on it', () => {
        const band = shieldBossBandRect(boss());
        expect(band).toMatchObject({ x: 80, y: 88, right: 128, bottom: 104 });
        // They share exactly one edge and overlap in nothing.
        const body = shieldBossBodyRect(boss());
        expect(band.y).toBe(body.bottom);
    });

    it('⛔ the key\'s whole box is INSIDE the body, so it is untakeable', () => {
        const key = { x: 104, y: 72 };
        expect(bossKeyRect(key)).toMatchObject({ x: 100, y: 68, right: 108, bottom: 76 });
        const b = boss();
        expect(bossKeyReachable(b, key).reachable).toBe(false);
        expect(bossKeyReachable(b, key).blockedBy).toMatch(/CONTAINS/);
        // ...and the gate is REMOVAL, not `destroy`.
        b.destroy = true;
        expect(bossKeyReachable(b, key).reachable).toBe(false);
        b.removed = true;
        expect(bossKeyReachable(b, key).reachable).toBe(true);
    });

    it('⛓ `_attract` is FALSE — there is no pull, only an overlap', () => {
        expect(BOSS_KEY.attract).toBe(false);
        expect(BOSS_KEY.special).toBe(true);
        expect(BOSS_KEY.persistTag).toBeNull();
    });
});

describe('the state machine — five paths, and only one of them is a window', () => {
    it('⛔⛔ THE FIRST HIT OF EVERY ENTRY IS SWALLOWED, whatever is playing', () => {
        for (const anim of ['sit', 'moveShield', 'movedShield', 'stab']) {
            const b = boss();
            playShieldBossAnim(b, anim);
            const v = shieldBossTakesHit(b);
            expect(v.swallowed, anim).toBe(true);
            expect(v.landed).toBe(false);
            expect(v.retaliated).toBe(false);
            expect(b.hits).toBe(0);
            expect(b.anim, anim).toBe(anim);          // it does not even sit
            expect(b.swingTime).toBe(0);
        }
    });

    it('⛓ …and it is per ENTRY: a fresh body re-arms it', () => {
        const b = boss();
        shieldBossTakesHit(b);
        expect(b.activated).toBe(true);
        expect(createShieldBoss({ x: 104, y: 64 }).activated).toBe(false);
    });

    it('⛔ a hit from `sit` RETALIATES — moveShield -> stab, no window', () => {
        const b = boss();
        b.activated = true;
        const v = shieldBossTakesHit(b);
        expect(v.retaliated).toBe(true);
        expect(b.anim).toBe('moveShield');
        expect(b.retaliation).toBe(true);
        // Run the chain: `moveShield` wraps into `stab`, never `movedShield`.
        const seen = new Set();
        for (let i = 0; i < 40; i += 1) { advanceShieldBossGraphic(b); seen.add(b.anim); }
        expect([...seen]).toContain('stab');
        expect([...seen]).not.toContain('movedShield');
    });

    it('⛓ the stand-under path is the OTHER one — moveShield -> movedShield', () => {
        const b = boss();
        const { started } = shieldBossStartStab(b, false);
        expect(started).toBe(true);
        expect(b.retaliation).toBe(false);
        for (let i = 0; i < SHIELD_BOSS_ANIM_UPDATES.moveShield; i += 1) {
            advanceShieldBossGraphic(b);
        }
        expect(b.anim).toBe('movedShield');
    });

    it('⛔ `startStab` carries BOTH gates — the i-frame and the animation', () => {
        const a = boss();
        a.hitsTimer = 1;
        expect(shieldBossStartStab(a, false)).toMatchObject({ started: false, refusedAt: 'hitsTimer' });
        const b = boss();
        playShieldBossAnim(b, 'stab');
        expect(shieldBossStartStab(b, false).started).toBe(false);
    });

    it('⛔⛔ a hit in the window with the i-frame UP aborts and does NOT damage', () => {
        const b = boss();
        b.activated = true;
        playShieldBossAnim(b, 'movedShield');
        b.hitsTimer = 5;
        b.stabbing = true;
        const v = shieldBossTakesHit(b);
        expect(v.landed).toBe(false);
        expect(v.refusedAt).toMatch(/i-frames/);
        // ...and `sit()` ran anyway, because it is OUTSIDE `Enemy.hit`'s gates.
        expect(v.aborted).toBe(true);
        expect(b.anim).toBe('sit');
        expect(b.stabbing).toBe(false);
    });

    it('⛓ three landed hits kill him, and `hits` never runs past `hitsMax`', () => {
        const b = boss();
        b.activated = true;
        for (let n = 1; n <= 3; n += 1) {
            playShieldBossAnim(b, 'movedShield');
            b.hitsTimer = 0;
            const v = shieldBossTakesHit(b);
            expect(v.landed).toBe(true);
            expect(b.hits).toBe(n);
            expect(v.killed).toBe(n === 3);
        }
        expect(b.anim).toBe('die');
        expect(b.tagWritten).toBe(true);
        expect(b.destroy).toBe(false);          // ⛔ startDeath does NOT set it
    });

    it('⛔ …and `stabbing` SURVIVES the kill, which the switch\'s default arm saves', () => {
        const b = boss();
        b.activated = true;
        b.hits = 2;
        b.stabbing = true;
        playShieldBossAnim(b, 'movedShield');
        shieldBossTakesHit(b);
        expect(b.anim).toBe('die');
        expect(b.stabbing).toBe(true);          // `sit()` refused: anim is "die"
        // The die callback still only sets `destroy`.
        for (let i = 0; i < SHIELD_BOSS_DIE_UPDATES; i += 1) advanceShieldBossGraphic(b);
        expect(b.anim).toBe('die');
        expect(b.destroy).toBe(true);
    });

    it('⛓ `sit()` is a no-op on a dying body', () => {
        const b = boss();
        shieldBossStartDeath(b);
        expect(shieldBossSit(b)).toBe(false);
        expect(b.anim).toBe('die');
    });

    it('⛓ `endAnim` does nothing at all when `stabbing` is false', () => {
        const b = boss();
        playShieldBossAnim(b, 'moveShield');
        b.stabbing = false;
        shieldBossEndAnim(b);
        expect(b.anim).toBe('moveShield');
    });

    it('refuses an animation the class does not have', () => {
        expect(() => playShieldBossAnim(boss(), 'walk')).toThrow(ShieldBossError);
    });
});

describe('`hitPlayer` — one rect, two jobs', () => {
    it('⛔ ONLY the stab damages: frames 5..8, i.e. `_index` 2..5', () => {
        const b = boss();
        // sit (0), moveShield (0,1), movedShield (2) are all below 5.
        for (const anim of ['sit', 'moveShield', 'movedShield']) {
            playShieldBossAnim(b, anim);
            expect(shieldBossFrameDamages(b), anim).toBe(false);
        }
        // die's frames are 9..19 — all ABOVE 8.
        playShieldBossAnim(b, 'die');
        expect(shieldBossFrameDamages(b)).toBe(false);
        // stab's own frames, walked.
        playShieldBossAnim(b, 'stab');
        const damaging = [];
        for (let i = 1; i <= SHIELD_BOSS_ANIM_UPDATES.stab; i += 1) {
            advanceShieldBossGraphic(b);
            if (b.anim === 'stab' && shieldBossFrameDamages(b)) damaging.push(i);
        }
        expect(damaging.length).toBeGreaterThan(0);
        expect(damaging[0]).toBe(stabIndexReachedAt(2));
    });

    it('⛔⛔ THE COUNTER HAS NO `hitsTimer` GATE — §8.14', () => {
        const b = boss();
        b.hitsTimer = 30;
        for (let i = 0; i < 5; i += 1) {
            stepShieldBoss(b, { playerBox: STANCE, tileT: 5 });
        }
        expect(b.swingTime).toBe(5);            // it counted through the i-frame
        expect(b.hitsTimer).toBe(25);           // ...which also drained
    });

    it('⛓ the counter is CONSECUTIVE: one tick out of the band resets it', () => {
        const b = boss();
        for (let i = 0; i < 50; i += 1) stepShieldBoss(b, { playerBox: STANCE, tileT: 5 });
        expect(b.swingTime).toBe(50);
        stepShieldBoss(b, { playerBox: box(104, 140), tileT: 5 });
        expect(b.swingTime).toBe(0);
    });

    it('⛔ off screen NOTHING runs — the counter, the i-frame and the damage', () => {
        const b = boss();
        b.hitsTimer = 30;
        for (let i = 0; i < 10; i += 1) {
            stepShieldBoss(b, { playerBox: STANCE, onScreen: false, tileT: 5 });
        }
        expect(b.swingTime).toBe(0);
        expect(b.hitsTimer).toBe(30);
        expect(SHIELD_BOSS.activeOffScreen).toBe(false);
    });

    it('⛓ 120 CONSECUTIVE ticks fire `startStab(false)` and reset the counter', () => {
        const b = boss();
        let fired = -1;
        for (let t = 0; t < 200; t += 1) {
            const r = stepShieldBoss(b, { playerBox: STANCE, tileT: 5 });
            if (r.startedStab) { fired = t; break; }
            advanceShieldBossGraphic(b);
        }
        expect(fired).toBe(SHIELD_BOSS.swingTimeMax - 1);
        expect(b.swingTime).toBe(0);
        expect(b.anim).toBe('moveShield');
        expect(b.retaliation).toBe(false);
    });

    it('refuses a lethal tile under the body rather than passing silently', () => {
        for (const t of [1, 6, 17]) {
            expect(() => stepShieldBoss(boss(), { playerBox: null, tileT: t }))
                .toThrow(ShieldBossError);
        }
        expect(() => stepShieldBoss(boss(), { playerBox: null, tileT: 5 })).not.toThrow();
    });
});

describe('the death — three instants, and only one of them opens the room', () => {
    it('⛔⛔ tag -> +23 destroy -> +11 request -> +1 REMOVED, DERIVED', () => {
        const s = shieldBossDeathSchedule(100);
        expect(s.tagTick).toBe(100);
        expect(s.destroyTick).toBe(100 + SHIELD_BOSS_DIE_UPDATES);
        expect(s.removeRequestedTick).toBe(s.destroyTick + MOBILE_DEATH_FADE.ticks);
        // ⛔ AND THE FOURTH INSTANT IS THE ONE THE GAME TAUGHT US.
        // `FP.world.remove` defers to `_remove`, which `updateLists()`
        // drains after `World.update` — and the Player updates LAST, so it
        // collides with the body one more time on the request tick.
        expect(s.removedTick).toBe(s.removeRequestedTick + 1);
        expect(MOBILE_DEATH_FADE.ticks).toBe(11);
    });

    it('⛓ and the DRIVEN machine agrees with the schedule tick for tick', () => {
        const b = boss();
        b.activated = true;
        b.hits = 2;
        playShieldBossAnim(b, 'movedShield');
        const KILL = 100;
        let destroyAt = -1;
        let requestedAt = -1;
        for (let t = 0; t <= 200; t += 1) {
            const r = stepShieldBoss(b, { playerBox: STANCE, tileT: 5 });
            if (r.removeRequestedNow) { requestedAt = t; break; }
            const was = b.destroy;
            advanceShieldBossGraphic(b);
            if (b.destroy && !was) destroyAt = t;
            if (t === KILL) shieldBossTakesHit(b);
        }
        const s = shieldBossDeathSchedule(KILL);
        expect(destroyAt).toBe(s.destroyTick);
        expect(requestedAt).toBe(s.removeRequestedTick);
        // ⛓ …and the body is STILL a wall on the request tick, which is the
        // whole reason the two are different numbers.
        expect(b.removed).toBe(false);
        expect(shieldBossBodyRect(b)).not.toBeNull();
    });

    it('⛔ the body is still a wall for all 34 of those ticks', () => {
        const b = boss();
        shieldBossStartDeath(b);
        expect(shieldBossBodyRect(b)).not.toBeNull();
        b.destroy = true;
        expect(shieldBossBodyRect(b)).not.toBeNull();     // destroy is NOT removal
        b.removed = true;
        expect(shieldBossBodyRect(b)).toBeNull();
    });

    it('⛓ a removed body refuses every further hit and every further step', () => {
        const b = boss();
        b.removed = true;
        expect(shieldBossTakesHit(b).refusedAt).toMatch(/removed/);
        expect(stepShieldBoss(b, { playerBox: STANCE }).refusedAt).toBe('removed');
    });
});

describe('the window arithmetic — the PLAYER\'s window is not the animation\'s', () => {
    it('⛔ it opens one tick EARLY and closes one tick early', () => {
        const w = shieldBossWindowFor(0);
        // `moveShield` advances on 0..4 and swaps at the end of 4, before
        // the player updates — so the sword sees `movedShield` on tick 4.
        expect(w.windowFrom).toBe(SHIELD_BOSS_ANIM_UPDATES.moveShield - 1);
        expect(w.windowTo - w.windowFrom + 1).toBe(SHIELD_BOSS_WINDOW_UPDATES);
        expect(w.stabFrom).toBe(w.windowTo + 1);
    });

    it('⛓ and the DRIVEN machine agrees on both edges', () => {
        const b = boss();
        b.activated = true;
        let stabTick = -1;
        const seen = [];
        for (let t = 0; t < 200; t += 1) {
            const r = stepShieldBoss(b, { playerBox: STANCE, tileT: 5 });
            if (r.startedStab) stabTick = t;
            advanceShieldBossGraphic(b);
            if (stabTick >= 0) seen.push({ t, anim: b.anim });
            if (seen.length > 40) break;
        }
        const w = shieldBossWindowFor(stabTick);
        const inWindow = seen.filter((s) => s.anim === 'movedShield').map((s) => s.t);
        expect(inWindow[0]).toBe(w.windowFrom);
        expect(inWindow[inWindow.length - 1]).toBe(w.windowTo);
    });

    it('⛓ a RETALIATION has no window at all', () => {
        const w = shieldBossWindowFor(50);
        expect(w.retaliationStabFrom).toBe(w.windowFrom);
        // The stand-under path spends 16 ticks between them; the
        // retaliation spends none.
        expect(w.stabFrom - w.windowFrom).toBe(SHIELD_BOSS_WINDOW_UPDATES);
    });

    it('refuses a non-integer tick rather than producing fractional windows', () => {
        expect(() => shieldBossWindowFor(1.5)).toThrow(ShieldBossError);
        expect(() => shieldBossDeathSchedule('100')).toThrow(ShieldBossError);
    });
});

describe('the tables this family joins', () => {
    it('⛓ the kill arm is MODELLED and its corpse is staged', () => {
        expect(KILL_ARM_POLICY.ShieldBoss.policy).toBe('modelled');
        expect(CORPSE_COUNTING.ShieldBoss.shape).toBe('anim+fade');
        expect(CORPSE_COUNTING.ShieldBoss.removesBody).toBe(true);
    });

    it('⛔ he is a `boss` contact, not a `static` one — the census rect is wrong', () => {
        expect(CONTACT_BOSS_FAMILIES).toContain('shieldboss');
        expect(contactPricing('shieldboss').kind).toBe('boss');
        expect(contactPricing('shieldboss').why).toMatch(/NOT HIS HITBOX/);
    });

    it('⛓ and `combat.js`\'s census box is the live one', () => {
        expect(ENEMY_CLASSES.shieldboss.hitbox).toEqual(SHIELD_BOSS.hitbox);
        expect(ENEMY_CLASSES.shieldboss.ctor.dx).toBe(SHIELD_BOSS.ctorOffset.dx);
        expect(ENEMY_CLASSES.shieldboss.ctor.dy).toBe(SHIELD_BOSS.ctorOffset.dy);
    });

    it('⛔ the `e is ShieldBoss` arm is DEAD CODE, and is recorded not modelled', () => {
        expect(SHIELD_BOSS_DEAD_ARM.observable).toBe(false);
        expect(SHIELD_BOSS_DEAD_ARM.unreachableBecause).toMatch(/e is Enemy/);
    });
});
