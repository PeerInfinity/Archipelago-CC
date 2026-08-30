/**
 * encounters.js — the ladder, the envelope, and the executor's wake rule.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 2.
 *
 * ⚠ THE ENVELOPE'S OWN CORRECTNESS CLAIM IS A DIRECTION, AND THAT IS WHAT
 * THIS SUITE CHECKS. It may say "contact-free" only when no chase policy
 * could have reached the player, and it may say "undecided" as often as it
 * likes. So the tests are one-sided on purpose: a clearance the envelope
 * reports positive is checked against a hand-computed worst case, and a
 * negative one is only ever checked to be REPORTED, never to be a contact.
 *
 * The exception, and it is the useful one: a STATIC instance has no
 * approximation in it, so its verdict is exact in both directions.
 */

import { describe, expect, it } from 'vitest';

import {
    FRICTION,
    LADDER,
    auditEncounterVerdicts,
    chaseEnvelope,
    crossingsOf,
    encounterPlan,
    priceCrossing,
} from './encounters.js';
import { ENEMY_CLASSES, KILL_CADENCE_FLOOR } from './combat.js';
import { cameraTrack } from './camera.js';
import { playerBoxAt } from './playerPhysicsV2.js';
import { ROLES, buildLevelWorld } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import { loadExpectation } from './fixtures/index.js';

const source = atlasLevelSource();
const worldCache = new Map();
const worldFor = (level) => {
    if (!worldCache.has(level)) {
        worldCache.set(level, buildLevelWorld(source(level), { roles: ROLES }));
    }
    return worldCache.get(level);
};

/** A synthetic instance, so the geometry is the test's and not the map's. */
const inst = (tag, cx, cy, level = 0) => ({
    tag,
    level,
    x: cx,
    y: cy,
    cx,
    cy,
    row: ENEMY_CLASSES[tag],
    counted: true,
    disc: typeof ENEMY_CLASSES[tag].aggro.range === 'number'
        ? { x: cx, y: cy, r: ENEMY_CLASSES[tag].aggro.range + 8 }
        : null,
});
const walk = (pts, level = 0) => pts.map((p, i) => ({ t: i, x: p[0], y: p[1], level }));

describe('crossings', () => {
    it('groups contiguous ticks into ONE crossing, and a re-entry into two', () => {
        // A bob's disc is 80 + 8 = 88.
        const bob = inst('bob', 0, 0);
        const path = walk([[200, 0], [50, 0], [40, 0], [200, 0], [30, 0], [300, 0]]);
        const out = crossingsOf(path, bob);
        expect(out.map((c) => [c.from, c.to])).toEqual([[1, 2], [4, 4]]);
        expect(out[0].minDist).toBe(40);
    });

    it('ends a crossing at a LEVEL CHANGE, because the enemy stops existing', () => {
        const bob = inst('bob', 0, 0);
        const path = [
            { t: 0, x: 40, y: 0, level: 0 },
            { t: 1, x: 40, y: 0, level: 1 },
            { t: 2, x: 40, y: 0, level: 0 },
        ];
        expect(crossingsOf(path, bob).map((c) => [c.from, c.to])).toEqual([[0, 0], [2, 2]]);
    });

    it('has no crossings for a class whose reach is not a disc', () => {
        // A boss's "arena" and a wallflyer's screen-width ray are encounter
        // scripts, not discs; `aggroDisc` returns null and so does this.
        expect(crossingsOf(walk([[0, 0]]), { ...inst('bob', 0, 0), disc: null })).toEqual([]);
    });
});

describe('the chase envelope', () => {
    it('grows by exactly the class\'s moveSpeed per tick inside the leash', () => {
        const bob = inst('bob', 0, 0);
        const env = chaseEnvelope(bob, walk([[40, 0], [40, 0], [40, 0], [40, 0]]));
        expect(env.bound).toBe(0.5);
        expect(env.rows.map((r) => r.r)).toEqual([0, 0.5, 1, 1.5]);
    });

    it('coasts, and only by `bound^2 / 2f`, once the player is out of the leash', () => {
        // Outside `runRange` the chase block never runs and `friction()`
        // damps a velocity of at most `bound` to zero — total travel
        // `bound^2/(2f)`. For a bob that is 0.25 px, i.e. half a tick.
        const bob = inst('bob', 0, 0);
        const env = chaseEnvelope(bob, walk([[400, 0], [400, 0], [400, 0], [400, 0]]));
        // bound^2/(2f) = 0.25/0.5 = 0.5 px in total, which one tick spends.
        expect(env.coastBudget).toBe((0.5 * 0.5) / (2 * FRICTION));
        expect(env.coastBudget).toBe(0.5);
        expect(env.rows.map((r) => r.r)).toEqual([0, 0.5, 0.5, 0.5]);
    });

    it('⛔ STOPS at a level change rather than growing into another room', () => {
        // The defect this line exists for: an envelope that kept growing
        // across the boundary reported a closest approach 500 ticks later,
        // in a room the instance does not exist in — a teleporter is
        // `FP.world = new Game(...)` and every enemy in the old world is gone.
        const bob = inst('bob', 0, 0);
        const path = [
            { t: 0, x: 40, y: 0, level: 0 },
            { t: 1, x: 40, y: 0, level: 0 },
            { t: 2, x: 1, y: 0, level: 7 },
            { t: 3, x: 1, y: 0, level: 7 },
        ];
        const env = chaseEnvelope(bob, path);
        expect(env.rows).toHaveLength(2);
        expect(env.stoppedAt).toBe(2);
    });

    it('freezes while the WHOLE envelope is off camera, and only then', () => {
        // `Enemy.update` early-returns on `!onScreen()`, so an off-screen
        // enemy cannot move — a tightening. Conservative: any overlap with
        // the 160x160 window counts as awake.
        const bob = inst('bob', 0, 0);
        const path = walk([[40, 0], [40, 0], [40, 0]]);
        const off = chaseEnvelope(bob, path, { cameraAt: () => ({ x: 900, y: 900 }) });
        expect(off.rows.map((r) => r.r)).toEqual([0, 0, 0]);
        const on = chaseEnvelope(bob, path, { cameraAt: () => ({ x: -40, y: -40 }) });
        expect(on.rows.map((r) => r.r)).toEqual([0, 0.5, 1]);
    });

    it('measures BOX separation, and adds the class\'s threat pad', () => {
        // Hand-computed. The player box is `playerPhysicsV2.playerBoxAt` —
        // 4x5 with origin (2,2), so at (40,0) it is [38,42] x [-2,3]. A
        // bobsoldier's body is 8x8 with origin (4,4), so at (0,0) it is
        // [-4,4] x [-4,4]; its sword is a 16 px collideLine past that, which
        // is the pad, so the grown box is [-20,20].
        //     gap = 38 - 20 = 18
        const soldier = inst('bobsoldier', 0, 0);
        const env = chaseEnvelope(soldier, walk([[40, 0]]));
        expect(env.rows[0].clearance).toBe(18);
        expect(env.pad).toBe(16);
        // The same geometry with no pad clears by 38 - 4 = 34.
        expect(chaseEnvelope(inst('bob', 0, 0), walk([[40, 0]])).rows[0].clearance).toBe(34);
    });

    it('⛔ REFUSES a boss rather than answering 0 and proving the arena safe', () => {
        expect(() => chaseEnvelope(inst('shieldboss', 0, 0), walk([[40, 0]])))
            .toThrow(/ENCOUNTER SCRIPT, not something an envelope may declare/);
    });
});

describe('the ladder', () => {
    const crossing = (tag, cx, cy, path) => crossingsOf(path, inst(tag, cx, cy))[0];

    it('clears a wake it can prove, and says which policy-independent bound did it', () => {
        // A bob woken 80 px away, with the player walking AWAY at 1 px/tick,
        // can never close: the bound is 0.5 px/tick.
        const path = walk(Array.from({ length: 40 }, (_, i) => [82 + i, 0]));
        const v = priceCrossing(crossing('bob', 0, 0, path), path);
        expect(v.rung).toBe('wake-and-thread');
        expect(v.basis).toBe('envelope');
        expect(v.clearance).toBeGreaterThan(0);
        expect(v.why).toContain('Contact-free for ANY chase policy');
    });

    it('⛓ is UNDECIDED, not "a contact", when the envelope cannot clear it', () => {
        // The player stands still inside a bob's leash for 400 ticks; the
        // envelope swallows them long before an exact chase would. The
        // instrument must NOT call that a contact.
        const path = walk(Array.from({ length: 400 }, () => [40, 0]));
        const v = priceCrossing(crossing('bob', 0, 0, path), path);
        expect(v.rung).toBe('kill');
        expect(v.basis).toBe('envelope-undecided');
        expect(v.proven).toBe(false);
        expect(v.why).toContain('UNDECIDED by over-approximation');
        expect(v.cost).toBe(3 * KILL_CADENCE_FLOOR);
    });

    it('⛔ a STATIC instance is EXACT in both directions — the re-route floor', () => {
        // No step bound, no pad: the "envelope" is the class's own hitbox,
        // unmoved. So a negative clearance is a PROVEN overlap, and that is
        // the difference between "cannot tell yet" and "this route walks
        // through a darktrap".
        const inside = walk(Array.from({ length: 4 }, () => [2, 2]));
        const v = priceCrossing(crossing('darktrap', 0, 0, inside), inside);
        expect(v.rung).toBe('hard-avoid');
        expect(v.basis).toBe('exact-static');
        expect(v.proven).toBe(true);
        expect(v.why).toContain('PROVEN CONTACT, not an approximation');

        const outside = walk(Array.from({ length: 4 }, () => [18, 0]));
        const clear = priceCrossing(crossing('darktrap', 0, 0, outside), outside);
        expect(clear.rung).toBe('wake-and-thread');
    });

    it('skips rung 2 for a class whose threat is not its body', () => {
        // A turret's spit covers its whole 64 px range; a clearance proof on
        // the 16x16 body would declare a shooting gallery contact-free.
        const path = walk(Array.from({ length: 10 }, () => [60, 0]));
        const v = priceCrossing(crossing('turret', 0, 0, path), path);
        expect(v.rung).toBe('kill');
        expect(v.basis).toBe('no-body-proof');
        expect(v.why).toContain('THE BODY IS NOT THE THREAT');
    });

    it('takes rung 3 unconditionally when a kill lock demands the instance', () => {
        const path = walk(Array.from({ length: 5 }, (_, i) => [82 + i, 0]));
        const v = priceCrossing(crossing('bob', 0, 0, path), path, { mustClear: true });
        expect(v.rung).toBe('kill');
        expect(v.why).toContain('waits on `totalEnemies() == 0`');
        // ...and the dark sword halves the bill.
        const dark = priceCrossing(crossing('bob', 0, 0, path), path,
            { mustClear: true, hasDarkSword: true });
        expect(dark.presses).toBe(2);
        expect(dark.cost).toBe(2 * KILL_CADENCE_FLOOR);
    });

    it('⚠ REFUSES to price an instance that has already been hit', () => {
        // `Enemy.hit` applies knockback and a knocked enemy's chase takes the
        // `pushed` branch, which does not re-normalize to moveSpeed — so the
        // bound the envelope rests on no longer holds.
        const path = walk([[40, 0]]);
        expect(() => priceCrossing(crossing('bob', 0, 0, path), path, { alreadyHit: true }))
            .toThrow(/the step bound the envelope rests on no longer holds/);
    });

    it('every verdict names exactly one rung from the ladder', () => {
        const path = walk(Array.from({ length: 20 }, () => [40, 0]));
        for (const tag of ['bob', 'darktrap', 'turret', 'grenade', 'jellyfish']) {
            const c = crossing(tag, 0, 0, path);
            if (!c) continue;
            expect(LADDER, tag).toContain(priceCrossing(c, path).rung);
        }
    });
});

describe('the executor\'s wake rule — the INTEGRITY half only', () => {
    const c = (level, tag, x, y) => ({ level, tag, x, y, from: 10, to: 20 });

    it('finds an UNDECLARED crossing — a route that silently changed', () => {
        const findings = auditEncounterVerdicts([], [c(60, 'jellyfish', 120, 112)]);
        expect(findings).toHaveLength(1);
        expect(findings[0].kind).toBe('undeclared');
        expect(findings[0].what).toContain('60:jellyfish@120,112');
    });

    it('finds a STALE verdict — the artifact declares a crossing that did not happen', () => {
        const findings = auditEncounterVerdicts(
            [{ ...c(60, 'jellyfish', 120, 112), rung: 'kill' }], [],
        );
        expect(findings).toHaveLength(1);
        expect(findings[0].kind).toBe('stale');
    });

    it('finds a rung that is not on the ladder', () => {
        const findings = auditEncounterVerdicts(
            [{ ...c(60, 'bob', 0, 0), rung: 'sneak-past' }], [c(60, 'bob', 0, 0)],
        );
        expect(findings.map((f) => f.kind)).toEqual(['malformed']);
    });

    it('...and is SILENT when the plan resolved the wake — never a warning', () => {
        // ⚠ POSITIVE COUNT BEFORE THE ZERO (the silent-watcher law): the three
        // tests above prove this function can speak at all, so an empty list
        // here is a claim rather than a function that never fires.
        const declared = [
            { ...c(60, 'jellyfish', 120, 112), rung: 'kill' },
            { ...c(63, 'darktrap', 64, 96), rung: 'hard-avoid' },
        ];
        const observed = [c(60, 'jellyfish', 120, 112), c(63, 'darktrap', 64, 96)];
        expect(auditEncounterVerdicts(declared, observed)).toEqual([]);
        // A wake the plan RESOLVED as wake-and-thread is equally silent —
        // the executor refuses undeclared wakes, not planner-resolved ones.
        expect(auditEncounterVerdicts(
            [{ ...c(63, 'darktrap', 64, 96), rung: 'wake-and-thread' }],
            [c(63, 'darktrap', 64, 96)],
        )).toEqual([]);
    });
});

describe('R4\'s committed route on the ladder — the re-route FLOOR', () => {
    // §8.6 replayed R4's route against the aggro discs and found 15 wakes,
    // "five of them inside a static's contact box", and called that a FLOOR
    // on the re-route bill. This prices the same walk on the amended ladder.
    const plans = () => {
        const names = ['r4-walk-3-torch', 'r4-walk-4-approach', 'r4-walk-5-spear',
            'r4-walk-6-health'];
        const out = [];
        for (const name of names) {
            const ticks = loadExpectation(name).stream.ticks;
            const cam = cameraTrack(ticks, (l) => worldFor(l).world);
            const byTick = new Map(cam.map((r) => [r.t, r]));
            for (const level of new Set(ticks.map((o) => o.level))) {
                const world = worldFor(level);
                if (world.combat.enemies.length + world.combat.hazards.length === 0) continue;
                const mustClear = new Set(world.combat.killLocks.length > 0
                    ? world.combat.bill.map((e) => `${e.tag}@${e.x},${e.y}`) : []);
                out.push(...encounterPlan(ticks, world, {
                    cameraAt: (t) => byTick.get(t) ?? null, mustClear,
                }).verdicts);
            }
        }
        return out;
    };

    it('⛔ the floor is FOUR DARKTRAPS — proven, unkillable, and R4 walked through them', () => {
        const proven = plans().filter((v) => v.proven === true);
        const instances = [...new Set(proven.map((v) => `L${v.level} ${v.tag}@${v.x},${v.y}`))];
        expect(instances.sort()).toEqual([
            'L62 darktrap@112,208',
            'L63 darktrap@128,272',
            'L63 darktrap@64,96',
            'L65 darktrap@144,144',
        ]);
        // Every one of them is COUNTED and unkillable — the combination
        // `assertNoUnclearableKillLock` exists to keep out of a lock room,
        // here met on open ground where it is a re-route rather than a seal.
        for (const v of proven) expect(v.counted).toBe(true);
    });

    it('proves some crossings contact-free WITHOUT any transcription', () => {
        // The amendment's whole point: a disc entered is not a route defect.
        const cleared = plans().filter((v) => v.rung === 'wake-and-thread');
        expect(cleared.length).toBeGreaterThan(0);
        for (const v of cleared) expect(v.clearance).toBeGreaterThan(0);
    });

    it('⚠ and DEFERS more than it decides, which is the honest report', () => {
        // The envelope is a one-sided instrument: over a 400-tick dwell
        // inside a 160 px jellyfish leash it swallows the player long before
        // an exact chase would. Those are not findings, and the summary must
        // not count them as any.
        const all = plans();
        const deferred = all.filter((v) => v.proven === false
            || v.basis === 'no-body-proof' || v.basis === 'phase-not-yet-pinned');
        expect(deferred.length).toBeGreaterThan(all.filter((v) => v.proven === true).length);
        for (const v of deferred) expect(v.proven).not.toBe(true);
    });

    it('refuses to price a world built without the combat role', () => {
        expect(() => encounterPlan([], buildLevelWorld(source(60))))
            .toThrow(/needs a world built with the `combat` role/);
    });

    it('⛔ the player box is the PHYSICS module\'s, not a second transcription', () => {
        // This module shipped its own — `{w:2, h:2, ox:4, oy:5}` — by reading
        // `normalHitbox = new Rectangle(2, 2, 4, 5)` as (w,h,ox,oy) when
        // `Rectangle` is (x,y,width,height) and `setHitbox` takes
        // (width, height, x, y). The real box is 4x5 with origin (2,2), so
        // the wrong one was 2 px narrower, 3 px shorter and sat 3 px high.
        // `playerBoxAt` has had it right since v2 and four rungs of legs ride
        // on it, which is the whole argument for importing rather than
        // re-transcribing.
        expect(playerBoxAt(100, 100))
            .toEqual({ x: 98, y: 98, right: 102, bottom: 103 });
    });
});
