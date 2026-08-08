/**
 * `playerDamage` — the transcription's own stratum.
 *
 * R6 slice 3. Every case here is derived from `Player.as` rather than from a
 * recording: the recording's job (`contactControl.test.js`, and the R6 pair)
 * is to say the transcription is the RIGHT one, and this file's job is to
 * make each individual line of it falsifiable in milliseconds.
 *
 * The mutation list this is written against — every one of these turns at
 * least one case below red:
 *
 *   · `hitsTimerMax` 20 -> 19 / 21
 *   · `shake += 5` -> `shake = 5`      (the §8.9 correction)
 *   · `>=` on the x comparator -> `>`  (the asymmetry)
 *   · `>`  on the y comparator -> `>=` (the same, the other way)
 *   · `hits >= hitsMax` -> `>`         (a death one hit late)
 *   · die AND knockback instead of either/or
 *   · the gate order (a frozen tick still burning i-frames)
 *   · `hitUpdate`'s decrement before the input read instead of after
 *   · `normalize` on a zero-length point returning NaN instead of a no-op
 */

import { describe, expect, it } from 'vitest';

import {
    DEATH_REBOOT, KNOCKBACK_COMPARATORS, PLAYER_DAMAGE, PlayerDamageError,
    canSteer, createPlayerDamage, iFrameSteeringSpan, knockbackAxisLands,
    knockbackDelta, playerHit, stepPlayerDamage,
} from './playerDamage.js';

const fresh = () => createPlayerDamage();
const hitOnce = (over = {}) => playerHit(fresh(), {
    hitsMax: 3, force: PLAYER_DAMAGE.contactForce, from: { x: 0, y: 0 },
    at: { x: 8, y: 0 }, direction: 3, ...over,
});

describe('the constants are the source\'s', () => {
    it('carries `Player.as`\'s four numbers', () => {
        expect(PLAYER_DAMAGE.hitsTimerMax).toBe(20);
        expect(PLAYER_DAMAGE.hitsTimerInt).toBe(10);
        expect(PLAYER_DAMAGE.hitsMaxDef).toBe(3);
        expect(PLAYER_DAMAGE.shakePerHit).toBe(5);
        expect(PLAYER_DAMAGE.contactForce).toBe(3);
    });

    it('a fresh player has taken nothing and faces nothing', () => {
        expect(fresh()).toEqual({ hits: 0, hitsTimer: 0, directionFace: -1 });
    });
});

describe('⛔ the knockback comparators are ASYMMETRIC, and it is not a typo', () => {
    it('x is `>=` and y is `>` — at exactly 0.5 they disagree', () => {
        expect(KNOCKBACK_COMPARATORS).toMatchObject({ x: '>=', y: '>', threshold: 0.5 });
        expect(knockbackAxisLands('x', 0.5)).toBe(true);
        expect(knockbackAxisLands('y', 0.5)).toBe(false);
        expect(knockbackAxisLands('x', -0.5)).toBe(true);
        expect(knockbackAxisLands('y', -0.5)).toBe(false);
    });

    it('...and agree everywhere else', () => {
        for (const v of [0, 0.25, 0.49999, 0.50001, 0.75, 1, -0.75, -1]) {
            expect(knockbackAxisLands('x', v), `x ${v}`)
                .toBe(Math.abs(v) >= 0.5);
            expect(knockbackAxisLands('y', v), `y ${v}`)
                .toBe(Math.abs(v) > 0.5);
        }
    });

    it('⛓ THE REACHABLE CASE: a contact at exactly 30° drops the y impulse', () => {
        // center = (cos 30°, sin 30°) — |y| is EXACTLY 0.5 in doubles when
        // the offset is built from the sine directly. The x impulse lands
        // and the y one does not, from one `if` to the next.
        const at = { x: Math.cos(Math.PI / 6), y: 0.5 };
        const kb = knockbackDelta(at, { x: 0, y: 0 }, 3);
        expect(kb.center.y).toBe(0.5);
        expect(kb.landed).toEqual({ x: true, y: false });
        expect(kb.dy).toBe(0);
        expect(kb.dx).toBeGreaterThan(0);
    });

    it('a named axis is required — a typo must not silently drop an impulse', () => {
        expect(() => knockbackAxisLands('z', 1)).toThrow(PlayerDamageError);
    });
});

describe('`Player.knockback(f, p)`', () => {
    it('normalizes to 1 and scales by the force', () => {
        const kb = knockbackDelta({ x: 30, y: 40 }, { x: 0, y: 0 }, 3);
        // (30,40) has length 50; normalized (0.6, 0.8); both clear 0.5.
        expect(kb.center.x).toBeCloseTo(0.6, 15);
        expect(kb.center.y).toBeCloseTo(0.8, 15);
        expect(kb.dx).toBeCloseTo(1.8, 15);
        expect(kb.dy).toBeCloseTo(2.4, 15);
    });

    it('points AWAY from the attacker on both axes', () => {
        const kb = knockbackDelta({ x: 0, y: 0 }, { x: 10, y: 10 }, 3);
        expect(kb.dx).toBeLessThan(0);
        expect(kb.dy).toBeLessThan(0);
    });

    it('⛔ a COINCIDENT origin is a no-op, not a NaN', () => {
        // `Point.normalize` is guarded by AS3's `if (length)` truthiness in
        // the runtime (`avm2_globals.c:1026`), so a zero-length centre stays
        // (0,0) — both comparators see 0 and no impulse lands. A model that
        // divided by zero would produce NaN velocities and a stream of NaN
        // positions for the rest of the run.
        const kb = knockbackDelta({ x: 64, y: 64 }, { x: 64, y: 64 }, 3);
        expect(kb.center).toEqual({ x: 0, y: 0 });
        expect(kb).toMatchObject({ dx: 0, dy: 0, landed: { x: false, y: false } });
        expect(Number.isNaN(kb.dx)).toBe(false);
    });

    it('a diagonal shallower than 30° drops the y impulse and keeps the x', () => {
        const kb = knockbackDelta({ x: 100, y: 10 }, { x: 0, y: 0 }, 3);
        expect(kb.landed).toEqual({ x: true, y: false });
    });
});

describe('`Player.hit()` — the gates, in source order', () => {
    it('`Bot.noDamage` returns before EVERYTHING', () => {
        const r = playerHit(fresh(), {
            hitsMax: 3, force: 3, from: { x: 0, y: 0 }, at: { x: 8, y: 0 }, noDamage: true,
        });
        expect(r).toMatchObject({ applied: false, died: false, shakeDelta: 0 });
        expect(r.refusedAt).toBe('Bot.noDamage');
        expect(r.state).toEqual(fresh());
    });

    it('an open i-frame window swallows the hit whole', () => {
        const open = { hits: 1, hitsTimer: 7, directionFace: -1 };
        const r = playerHit(open, { hitsMax: 3, force: 3, from: { x: 0, y: 0 }, at: { x: 8, y: 0 } });
        expect(r.applied).toBe(false);
        expect(r.refusedAt).toBe('hitsTimer');
        // ⚠ AND THE WINDOW IS NOT REFRESHED. A model that re-armed it here
        // would make a body standing on the player permanently invulnerable
        // to nothing and permanently un-hittable — the same stream for the
        // first 20 ticks and a different one after.
        expect(r.state.hitsTimer).toBe(7);
    });

    it('⛔ a CEREMONY swallows it too — and buys no i-frames doing so', () => {
        const r = playerHit(fresh(), {
            hitsMax: 3, force: 3, from: { x: 0, y: 0 }, at: { x: 8, y: 0 }, frozen: true,
        });
        expect(r.refusedAt).toBe('Game.freezeObjects');
        expect(r.state.hitsTimer).toBe(0);
        expect(r.shakeDelta).toBe(0);
    });

    it('a player already at `hitsMax` takes nothing more', () => {
        const dead = { hits: 3, hitsTimer: 0, directionFace: -1 };
        expect(playerHit(dead, { hitsMax: 3, from: null }).refusedAt).toBe('hits >= hitsMax');
    });

    it('⚠ `hitsMax` has NO default — a hard-coded 3 would misprice a heart run', () => {
        expect(() => playerHit(fresh(), { force: 3 })).toThrow(PlayerDamageError);
        expect(() => playerHit(fresh(), { hitsMax: null })).toThrow(/hitsMax/);
    });

    it('the darksuit retaliation is refused BY NAME, not silently skipped', () => {
        expect(() => playerHit(fresh(), { hitsMax: 3, hasDarkSuit: true, from: null }))
            .toThrow(/darkSuit|hasDarkSuit/i);
    });
});

describe('`Player.hit()` — what a landed hit costs', () => {
    it('one heart, twenty i-frames and FIVE of shake', () => {
        const r = hitOnce();
        expect(r.applied).toBe(true);
        expect(r.state.hits).toBe(1);
        expect(r.state.hitsTimer).toBe(20);
        expect(r.shakeDelta).toBe(5);
        expect(r.died).toBe(false);
    });

    it('⚠ `damage` is a NUMBER, and ZERO is a real value', () => {
        // `checkDrowning`'s lava arm is `hit(null, 0, null, 0)` — no damage,
        // no knockback, and it STILL burns the i-frames and STILL shakes.
        // A model that treated `d` as a count of hearts would drop it.
        const r = playerHit(fresh(), { hitsMax: 3, damage: 0, from: null });
        expect(r.applied).toBe(true);
        expect(r.state.hits).toBe(0);
        expect(r.state.hitsTimer).toBe(20);
        expect(r.shakeDelta).toBe(5);
    });

    it('the facing is parked in `directionFace`', () => {
        expect(hitOnce({ direction: 2 }).state.directionFace).toBe(2);
    });

    it('a null point means no impulse AND no parked facing', () => {
        const r = playerHit(fresh(), { hitsMax: 3, force: 6, from: null, direction: 2 });
        expect(r.knockback).toMatchObject({ dx: 0, dy: 0 });
        expect(r.state.directionFace).toBe(-1);
    });

    it('⛔ DIE AND KNOCKBACK ARE THE TWO ARMS OF ONE `if`', () => {
        const twoDown = { hits: 2, hitsTimer: 0, directionFace: -1 };
        const r = playerHit(twoDown, {
            hitsMax: 3, force: 3, from: { x: 0, y: 0 }, at: { x: 8, y: 0 },
        });
        expect(r.died).toBe(true);
        // A corpse gets no impulse. A model that applied one would give the
        // death tick a velocity the game never wrote — and the death tick
        // runs no physics at all, so it would surface as a respawn one
        // sweep out of place.
        expect(r.knockback).toBeNull();
        // ...and the shake still lands: `Game.shake += 5` is ABOVE the fork.
        expect(r.shakeDelta).toBe(5);
    });

    it('the death test is `>=`, so a 0.5-damage source can cross it', () => {
        const half = { hits: 2.5, hitsTimer: 0, directionFace: -1 };
        expect(playerHit(half, { hitsMax: 3, damage: 0.5, from: null }).died).toBe(true);
        const under = { hits: 2, hitsTimer: 0, directionFace: -1 };
        expect(playerHit(under, { hitsMax: 3, damage: 0.5, from: null }).died).toBe(false);
    });

    it('a four-heart run survives the hit a three-heart run dies to', () => {
        const twoDown = { hits: 2, hitsTimer: 0, directionFace: -1 };
        expect(playerHit(twoDown, { hitsMax: 3, from: null }).died).toBe(true);
        expect(playerHit(twoDown, { hitsMax: 4, from: null }).died).toBe(false);
    });
});

describe('`Player.hitUpdate()` — the window, and the facing it hands back', () => {
    it('decrements, and does nothing at rest', () => {
        expect(stepPlayerDamage(fresh())).toMatchObject({ recovered: false, direction: null });
        const s = { hits: 1, hitsTimer: 5, directionFace: 2 };
        expect(stepPlayerDamage(s).state.hitsTimer).toBe(4);
    });

    it('hands the facing back on the tick it reaches zero, and only then', () => {
        let s = { hits: 1, hitsTimer: 2, directionFace: 2 };
        let r = stepPlayerDamage(s);
        expect(r).toMatchObject({ recovered: false, direction: null });
        r = stepPlayerDamage(r.state);
        expect(r).toMatchObject({ recovered: true, direction: 2 });
        expect(r.state.directionFace).toBe(-1);
    });

    it('⚠ hands back -1 when the hit never parked a facing', () => {
        // A `p == null` hit leaves `directionFace` at its initialiser, and
        // `hitUpdate` assigns it anyway — so the recovery tick writes
        // `direction = -1`. A model that treated -1 as "skip" would keep a
        // facing the game had thrown away.
        const r = stepPlayerDamage({ hits: 1, hitsTimer: 1, directionFace: -1 });
        expect(r).toMatchObject({ recovered: true, direction: -1 });
    });
});

describe('⛔ the steering loss is TWENTY ticks, and it is an ORDERING fact', () => {
    it('`canSteer` is false for exactly `hitsTimerMax` consecutive ticks', () => {
        expect(iFrameSteeringSpan()).toBe(PLAYER_DAMAGE.hitsTimerMax);
        expect(iFrameSteeringSpan()).toBe(20);
    });

    it('the hit tick itself is the FIRST refused one', () => {
        // `Player.hit` runs during the ENEMIES' update, above the player's
        // own `input()`. So the window is already 20 when `input()` reads
        // it, and the tick that lands the hit is the first of the twenty —
        // not the one after.
        const after = hitOnce().state;
        expect(canSteer(after)).toBe(false);
    });

    it('and the twentieth tick after it steers again', () => {
        let s = hitOnce().state;
        for (let i = 0; i < 19; i += 1) {
            expect(canSteer(s), `tick +${i}`).toBe(false);
            s = stepPlayerDamage(s).state;
        }
        expect(canSteer(s)).toBe(false);
        s = stepPlayerDamage(s).state;
        expect(canSteer(s)).toBe(true);
    });
});

describe('⛔⛔ a death is a WORLD REBOOT, and the shape says where it lands', () => {
    it('names the ctor args as the spawn, not the death position', () => {
        expect(DEATH_REBOOT.spawnFrom).toMatch(/constructor args/);
        expect(DEATH_REBOOT.deferred).toMatch(/end of tick/);
    });

    it('⛓ takes NO last step, unlike a teleport', () => {
        expect(DEATH_REBOOT.lastStep).toBe(false);
        expect(DEATH_REBOOT.lastStepWhy).toMatch(/!dying/);
    });

    it('resets the player\'s three damage fields and keeps `hitsMax`', () => {
        expect(DEATH_REBOOT.resets).toContain('hits');
        expect(DEATH_REBOOT.resets).toContain('hitsTimer');
        expect(DEATH_REBOOT.survives).toContain('Main.hitsMax');
        // `Game.shake` is a public static and outlives the world — which is
        // why a load has to DRAIN it rather than assume it went away.
        expect(DEATH_REBOOT.survives).toContain('Game.shake');
    });

    it('names the darksuit arm as inert rather than leaving it unmentioned', () => {
        expect(DEATH_REBOOT.darkSuitArm).toMatch(/inert/);
    });
});
