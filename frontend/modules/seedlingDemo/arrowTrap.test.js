import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
    ARROW, ARROW_ENEMY_HIT, ARROW_KILL_PLAN, ARROW_PLAYER_ARM, ARROW_TARGET_DISPOSITIONS,
    ARROW_TRAP, ARROW_TRAP_CENSUS,
    ARROW_TRAP_PRESSER, arrowLane, arrowLaneForPlacement, arrowLaneRect,
    arrowRect, arrowTrapEntityPoint, arrowTrapFires,
    arrowVolley, assertArrowTrapCensus, createArrow, createArrowTrap, lanesOver,
    shadowOf, stepArrow, stepArrowTrap,
} from './arrowTrap.js';
import { assertArrowTargetPartition } from './r8Acceptance.js';
import { rect } from './levelWorld.js';
import { atlasLevelSource } from './levelSource.js';
import {
    ENEMY_DAMAGE_DEFAULTS, KILL_ARM_POLICY, MOBILE_DEATH_FADE, createEnemyDamage, enemyHit,
} from './enemyDamage.js';
import { PUZZLEMENT_HAZARDS } from './combat.js';

/** L5's four traps, as the level places them. */
const L5_TRAPS = ARROW_TRAP_CENSUS[5].map((p, i) => {
    const e = arrowTrapEntityPoint(p.x, p.y);
    return createArrowTrap({ id: `arrowtrap@${p.x},${p.y}#${i}`, ...e, t: p.t, shootDefault: p.shootDefault });
});
const L5_LANES = L5_TRAPS.map(arrowLane);
/** L5 is 7 tiles by 8 — `FP.width/height` from the `.oel` at `Game.as:1930`. */
const L5_BOUND = Object.freeze({ w: 112, h: 128 });

/** One trap, armed, run for `n` ticks; returns the tick each volley fired on. */
function volleyTicks(trap, n, armed = true) {
    const at = [];
    for (let t = 1; t <= n; t += 1) {
        if (stepArrowTrap(trap, armed).fired) at.push(t);
    }
    return at;
}

describe('`ArrowTrap`, against `Puzzlements/ArrowTrap.as`', () => {
    it('⛔ the ctor offset is (+8, +2) — `Activators(_x:int, _y:int)` TRUNCATES the 2.5', () => {
        // `super(_x + Tile.w/2, _y + sprArrowTrap.height/2, …)` with a 16x5
        // sprite reads as +2.5, and the int params take it to +2. Trap 143's
        // shape one class along: the expression is not the signature.
        expect(ARROW_TRAP.ctor).toMatchObject({ dx: 8, dy: 2 });
        expect(arrowTrapEntityPoint(16, 16)).toEqual({ x: 24, y: 18 });
        expect(arrowTrapEntityPoint(32, 48)).toEqual({ x: 40, y: 50 });
    });

    it('⛔⛔ THERE IS ONE TRANSCRIPTION — `combat.js`\'s — and this is it', () => {
        // Not a cross-check: an IDENTITY. R5 slice 2's headline defect was a
        // second transcription of the constructor offsets that disagreed with
        // the first by eight pixels on every enemy on the map, and the
        // standing answer since `chasers.js` is to IMPORT the census rather
        // than re-read the class. A mutation of `combat.js`'s row moves this
        // module and every consumer of it in one step, which is the point.
        expect(ARROW_TRAP.ctor).toBe(PUZZLEMENT_HAZARDS.arrowtrap.ctor);
        // ...and the value, so a mutation of the census still reddens HERE.
        expect(PUZZLEMENT_HAZARDS.arrowtrap.ctor.dy).toBe(2);
    });

    it('⛔⛔ THE VOLLEY PERIOD IS ELEVEN, not the `shootTimerMax` 10', () => {
        // fire on 0, re-arm to 10, ten decrements, fire again. Every summary
        // in the arc reads `shootTimerMax` as the period; it is the period
        // MINUS ONE.
        const trap = createArrowTrap({ id: 'a', x: 24, y: 18, t: 0 });
        expect(volleyTicks(trap, 34)).toEqual([1, 12, 23, 34]);
        expect(ARROW_TRAP.volleyPeriodTicks).toBe(ARROW_TRAP.shootTimerMax + 1);
    });

    it('an armed trap fires on its FIRST update — `shootTimer` starts at 0', () => {
        const trap = createArrowTrap({ id: 'a', x: 24, y: 18, t: 0 });
        expect(stepArrowTrap(trap, true).fired).toBe(true);
    });

    it('⛓ disarming RESETS the timer, so re-arming fires immediately', () => {
        // `update()`'s else arm is `shootTimer = 0`, not a pause. A trap
        // toggled off and on again has no cooldown at all — which is what
        // makes a button that flickers a damage source rather than a lull.
        const trap = createArrowTrap({ id: 'a', x: 24, y: 18, t: 0 });
        stepArrowTrap(trap, true);              // fires, shootTimer = 10
        expect(trap.shootTimer).toBe(10);
        expect(stepArrowTrap(trap, false).fired).toBe(false);
        expect(trap.shootTimer).toBe(0);
        expect(stepArrowTrap(trap, true).fired).toBe(true);
    });

    it('⛔ `shootDefault` INVERTS *when*, never *where* — it is an XOR', () => {
        const normal = createArrowTrap({ id: 'n', x: 24, y: 18, t: 0, shootDefault: false });
        const inverted = createArrowTrap({ id: 'i', x: 24, y: 18, t: 0, shootDefault: true });
        expect(arrowTrapFires(normal, true)).toBe(true);
        expect(arrowTrapFires(normal, false)).toBe(false);
        expect(arrowTrapFires(inverted, true)).toBe(false);
        expect(arrowTrapFires(inverted, false)).toBe(true);
        // ...and both fire STRAIGHT DOWN. The velocity is a literal.
        expect(arrowVolley('n', 0, 24, 18).every((a) => a.v.x === 0 && a.v.y === 5)).toBe(true);
        expect(arrowVolley('i', 0, 24, 18).every((a) => a.v.x === 0 && a.v.y === 5)).toBe(true);
    });

    it('⛔ the trap is NOT freeze-gated — it fires through every ceremony', () => {
        // `ArrowTrap extends Activators extends Entity`, so `mobileUpdate`'s
        // freeze test is not in its chain and nothing else tests the flag.
        expect(ARROW_TRAP.freezeGated).toBe(false);
        // The step takes no `frozen` argument at all, which is the assertion:
        // a signature that accepted one would invite a caller to pass it.
        expect(stepArrowTrap.length).toBe(2);
    });

    it('the volley is three arrows at -4 / 0 / +4, spawned two pixels ABOVE', () => {
        const v = arrowVolley('a', 3, 24, 18);
        expect(v.map((a) => a.x)).toEqual([20, 24, 28]);
        expect(v.every((a) => a.y === 16)).toBe(true);
        expect(v.map((a) => a.id)).toEqual(['a#3.0', 'a#3.1', 'a#3.2']);
    });

    it('⚠ the spawn truncates — `Arrow(_x:int, _y:int, _v:Point)`', () => {
        // The only placement in the game with a fractional entity point is
        // this one, and the truncation is why the arrows land on integers.
        const a = createArrow('x', 20.9, 16.9, 0, 5);
        expect([a.x, a.y]).toEqual([20, 16]);
        // ...and the VELOCITY is a Point and is not truncated.
        const f = createArrow('y', 0, 0, 0.5, 4.5);
        expect(f.v).toEqual({ x: 0.5, y: 4.5 });
    });
});

describe('`Arrow`, against `Projectiles/Arrow.as`', () => {
    it('the hitbox is 4x4 CENTRED — `setHitbox(4, 4, 2, 2)`', () => {
        expect(arrowRect(createArrow('a', 24, 40, 0, 5)))
            .toMatchObject({ x: 22, y: 38, right: 26, bottom: 42 });
    });

    it('it falls exactly 5 px a tick — `solids` is EMPTY so nothing blocks the move', () => {
        expect(ARROW.solids).toEqual([]);
        const a = createArrow('a', 24, 16, 0, 5);
        stepArrow(a, { bound: L5_BOUND });
        expect(a.y).toBe(21);
        stepArrow(a, { bound: L5_BOUND });
        expect(a.y).toBe(26);
    });

    it('⛔ a `Solid` STOPS it and takes NOTHING — the removal is outside the switch', () => {
        const a = createArrow('a', 56, 60, 0, 5);
        const torch = { id: 'torch@48,64', type: 'Solid', rect: rect(48, 64, 16, 16) };
        const r = stepArrow(a, { bound: L5_BOUND, bodies: [torch] });
        expect(r.hits.map((h) => h.id)).toEqual(['torch@48,64']);
        expect(a.die).toBe(true);
        expect(a.v).toEqual({ x: 0, y: 0 });
        // ...and it is still in the world, fading, for ten more ticks.
        expect(a.removed).toBe(false);
    });

    it('⛓ the fade is ELEVEN ticks — the `Image.alpha` clamp fencepost', () => {
        expect(ARROW.fadeTicks).toBe(MOBILE_DEATH_FADE.ticks);
        const a = createArrow('a', 56, 60, 0, 5);
        const wall = { id: 'w', type: 'Solid', rect: rect(48, 64, 16, 16) };
        let n = 0;
        while (!a.removed && n < 40) { stepArrow(a, { bound: L5_BOUND, bodies: [wall] }); n += 1; }
        expect(n).toBe(ARROW.fadeTicks);
    });

    it('⛔ a spent arrow tests NOTHING further — `if (v.length > 0)` is a one-way latch', () => {
        const a = createArrow('a', 56, 60, 0, 5);
        const wall = { id: 'w', type: 'Solid', rect: rect(48, 64, 16, 16) };
        stepArrow(a, { bound: L5_BOUND, bodies: [wall] });
        const bob = { id: 'bob', type: 'Enemy', rect: rect(52, 60, 8, 8) };
        // The bob overlaps it and takes nothing, because the velocity is 0.
        expect(stepArrow(a, { bound: L5_BOUND, bodies: [wall, bob] }).hits).toEqual([]);
    });

    it('the off-world bound is the LEVEL rect and it is STRICT on all four sides', () => {
        const a = createArrow('a', 24, 124, 0, 5);
        stepArrow(a, { bound: L5_BOUND });          // 124 -> 129 > 128
        expect(a.removed).toBe(true);
        const edge = createArrow('b', 24, 123, 0, 5);
        stepArrow(edge, { bound: L5_BOUND });       // 123 -> 128, NOT > 128
        expect(edge.removed).toBe(false);
    });

    it('⛔ the MOVE is freeze-gated and the HIT TEST is not', () => {
        const a = createArrow('a', 56, 62, 0, 5);
        const bob = { id: 'bob', type: 'Enemy', rect: rect(52, 60, 8, 8) };
        const r = stepArrow(a, { frozen: true, bound: L5_BOUND, bodies: [bob] });
        expect(a.y).toBe(62);                       // it did not move
        expect(r.hits.map((h) => h.id)).toEqual(['bob']);  // it hit anyway
    });

    it('⚠ the test is at the POST-MOVE position only — a thin target is tunnelled', () => {
        // Named rather than assumed away: a `Bob` is 8 px tall and cannot be
        // tunnelled, but "nothing in this room is thin" is a claim about
        // this room. A 2-px body between two sample points is passed clean.
        const a = createArrow('a', 24, 16, 0, 5);
        // The gap between the pre-move box [14,18) and the post-move box
        // [19,23) is exactly one pixel row, and a body inside it is passed.
        const thin = { id: 'thin', type: 'Enemy', rect: rect(22, 18, 4, 1) };
        expect(stepArrow(a, { bound: L5_BOUND, bodies: [thin] }).hits).toEqual([]);
        expect(a.y).toBe(21);
    });

    it('a type NOT in `hitables` is invisible to it', () => {
        const a = createArrow('a', 24, 16, 0, 5);
        const rope = { id: 'r', type: 'Rope', rect: rect(16, 16, 16, 16) };
        expect(stepArrow(a, { bound: L5_BOUND, bodies: [rope] }).hits).toEqual([]);
    });
});

describe('⛔ the damage, and it is ONE (trap 143)', () => {
    it('the call passes FORCE and takes the DEFAULT damage', () => {
        expect(ARROW_ENEMY_HIT.force).toBe(ARROW.speed);
        expect(ARROW_ENEMY_HIT.damage).toBe(1);
        expect(ARROW_ENEMY_HIT.force).not.toBe(ARROW_ENEMY_HIT.damage);
    });

    /**
     * ⛔⛔⛔ THE FAMILY DOES **NOT** LIFT `KILL_ARM_POLICY.Bob`, AND THE
     * REASON IS THE POLICY'S OWN REASON.
     *
     * The obvious move for a slice whose whole subject is "arrows kill the
     * bobs" is to promote `Bob` from `refused` to `modelled`. It would be
     * wrong. The refusal turns on *"modelling it needs the chaser's POSITION
     * at the press"* — and an arrow needs the body IN A LANE exactly as a
     * press needs it in reach. What the arrow changes is only that the
     * PLAYER need not be adjacent; the body's position is still the
     * unmodelled term, and it is unmodelled because `Bob.update` steers at
     * the player every tick with no pathfinding and no wall test.
     *
     * ⇒ this module models the MECHANISM and the GEOMETRY; the GAME
     * adjudicates every kill, which is §1.5 standing and is what the probe
     * is for. A `modelled` row here would have made `levelRun` predict a
     * fight it cannot see.
     */
    it('⛔⛔⛔ `Bob` stays `refused` — an arrow does not lift the position problem', () => {
        expect(KILL_ARM_POLICY.Bob.policy).toBe('refused');
        expect(() => createEnemyDamage('Bob')).toThrow(/is `refused`/);
        // ...and the refusal's reason is the reason: POSITION, not damage.
        expect(KILL_ARM_POLICY.Bob.why).toMatch(/POSITION/);
    });

    it('⛓⛓ THREE arrows kill a default `Enemy`, and the i-frames floor it at 60 ticks', () => {
        // The arithmetic, off `Enemy`'s own defaults rather than off a body
        // this model refuses to construct. `Bob` overrides neither field.
        expect(ENEMY_DAMAGE_DEFAULTS.hitsMax).toBe(3);
        expect(ENEMY_DAMAGE_DEFAULTS.hitsTimerMax).toBe(ARROW_ENEMY_HIT.iFrameTicks);
        expect(Math.ceil(ENEMY_DAMAGE_DEFAULTS.hitsMax / ARROW_ENEMY_HIT.damage))
            .toBe(ARROW_ENEMY_HIT.arrowsToKillDefaultEnemy);
        expect(ARROW_ENEMY_HIT.minTicksToKillDefaultEnemy)
            .toBe((ARROW_ENEMY_HIT.arrowsToKillDefaultEnemy - 1) * ARROW_ENEMY_HIT.iFrameTicks);
    });

    it('⛔ driven through `enemyHit`, one arrow is ONE hit — the class the policy DOES model', () => {
        // `IceTurret` is the one `modelled` row whose `hitsMax` is the base
        // 3, so it is the only body in the tree an arrow's arithmetic can be
        // driven against end to end. The gates are `enemyDamage`'s, never
        // this module's.
        let body = createEnemyDamage('IceTurret');
        const v = enemyHit(body, { d: ARROW_ENEMY_HIT.damage, f: ARROW_ENEMY_HIT.force });
        body = v.state ?? body;
        expect(body.hits).toBe(1);
        expect(v.killed).toBe(false);
        // ...and the i-frame it just bought refuses the next two arrows of
        // the same volley, which is why the cadence cannot beat the floor.
        expect(enemyHit(body, { d: ARROW_ENEMY_HIT.damage, f: ARROW_ENEMY_HIT.force }).landed)
            .toBe(false);
    });

    it('⛔ a five-damage arrow would be a ONE-arrow kill, which the trace refutes', () => {
        // `stand`'s mobile trace read a single body at `h2` at t=115 and dead
        // by t=187 — a count climbing ONE AT A TIME, which is impossible
        // under a one-arrow kill. The constant is pinned against the
        // MEASUREMENT, not against the expression it came from.
        expect(Math.ceil(ENEMY_DAMAGE_DEFAULTS.hitsMax / 5)).toBe(1);
        expect(Math.ceil(ENEMY_DAMAGE_DEFAULTS.hitsMax / ARROW_ENEMY_HIT.damage)).toBe(3);
    });
});

describe('⛓ the lanes and the shadows — L5, off the census', () => {
    it('the four lanes are 12 px wide and cover columns 1, 2, 4 and 5', () => {
        expect(L5_LANES.map((l) => [l.x0, l.x1]).sort((a, b) => a[0] - b[0]))
            .toEqual([[18, 30], [34, 46], [66, 78], [82, 94]]);
    });

    it('⛔⛔ COLUMN 3 IS NOT A LANE, and that is the whole choreography', () => {
        // `bob@48,80` centres at (56,88) with `setHitbox(8, 8, 4, 4)`.
        const shadowed = rect(52, 84, 8, 8);
        expect(lanesOver(shadowed, L5_LANES)).toEqual([]);
        // ...while the two left bobs START inside `arrowtrap@16,16`'s lane,
        // which is why the naive arm kills two of three for free.
        expect(lanesOver(rect(20, 68, 8, 8), L5_LANES).length).toBe(1);
        expect(lanesOver(rect(20, 84, 8, 8), L5_LANES).length).toBe(1);
    });

    it('⚠ the lane is HALF-OPEN — a body at exactly `x1` is OUT', () => {
        // A ONE-pixel probe, so the answer is about the edge and not about
        // an 8-wide body reaching the next lane along.
        expect(lanesOver(rect(30, 68, 1, 8), L5_LANES).map((l) => l.id)).toEqual([]);
        expect(lanesOver(rect(29, 68, 1, 8), L5_LANES).length).toBe(1);
        // ...and the left edge is INCLUSIVE, which is the other half.
        expect(lanesOver(rect(18, 68, 1, 8), L5_LANES).length).toBe(1);
        expect(lanesOver(rect(17, 68, 1, 8), L5_LANES).length).toBe(0);
    });

    it('a body ABOVE the spawn row is in no lane', () => {
        // `fromY` is the spawn row; an arrow never travels up.
        expect(lanesOver(rect(20, 4, 8, 8), L5_LANES)).toEqual([]);
    });

    it('⛔⛔ COVER SHADOWS A LANE — "no trap above" is only half the predicate', () => {
        const torch = rect(48, 64, 16, 16);
        // A body directly under `arrowtrap@64,48`'s lane is lit...
        expect(shadowOf(rect(68, 84, 8, 8), L5_LANES, [torch]).shadowed).toBe(false);
        // ...and one under a Solid is not, even though the lane reaches it.
        const under = rect(52, 84, 8, 8);
        const wide = [{ ...arrowLane(L5_TRAPS[0]), x0: 48, x1: 64, fromY: 18 }];
        const s = shadowOf(under, wide, [torch]);
        expect(s.shadowed).toBe(true);
        expect(s.blockedBy).toHaveLength(1);
        // ...and WITHOUT the cover the same body is lit, so the cover is
        // what the assertion is about and not the geometry.
        expect(shadowOf(under, wide, []).shadowed).toBe(false);
    });

    it('the presser\'s own cell is out of every lane — asserted, not assumed', () => {
        // `button@48,48` centres at (56,56); the player box there is what
        // `ARROW_KILL_PLAN.presserSafety` requires to be lane-free.
        expect(lanesOver(rect(52, 52, 8, 8), L5_LANES)).toEqual([]);
    });
});

describe('the census, re-asserted against the map extract', () => {
    it('eleven traps in five levels, and it round-trips off the atlas', () => {
        const found = assertArrowTrapCensus(atlasLevelSource());
        expect(Object.keys(found).map(Number).sort((a, b) => a - b)).toEqual([4, 5, 8, 16, 67]);
        expect(Object.values(found).reduce((n, v) => n + v.length, 0)).toBe(11);
    });

    it('⚠ TWO SENSES — L4/L5/L8 fire when pressed, L16/L67 fire until pressed', () => {
        // A model that had only ever seen L5 would have the sense backwards
        // for four of the eleven.
        expect(ARROW_TRAP_CENSUS[5].every((t) => t.shootDefault === false)).toBe(true);
        expect(ARROW_TRAP_CENSUS[16].every((t) => t.shootDefault === true)).toBe(true);
        expect(ARROW_TRAP_CENSUS[67].every((t) => t.shootDefault === true)).toBe(true);
    });

    it('the census REFUSES a map that moved, in both directions', () => {
        const base = atlasLevelSource();
        const gained = (n) => {
            const r = base(n);
            if (n !== 3) return r;
            return { ...r, entities: [...r.entities, { name: 'arrowtrap', x: 0, y: 0, attrs: { tset: '0', shoot: '0' } }] };
        };
        expect(() => assertArrowTrapCensus(gained)).toThrow(/the levels holding arrowtraps moved/);
        const lost = (n) => {
            const r = base(n);
            if (n !== 5) return r;
            return { ...r, entities: r.entities.filter((e) => (e.name ?? e.type) !== 'arrowtrap' || e.x !== 16) };
        };
        expect(() => assertArrowTrapCensus(lost)).toThrow(/level 5's traps moved/);
    });
});

describe('the presser, and the two facts that are counter-intuitive', () => {
    it('⛔ an ENEMY presses the button', () => {
        expect(ARROW_TRAP_PRESSER.hitables).toContain('Enemy');
        expect(ARROW_TRAP_PRESSER.excludes).toBe('Cover');
    });

    it('⛔⛔ the publication is UNCONDITIONAL and per tick — no edge, no latch', () => {
        expect(ARROW_TRAP_PRESSER.republishesEveryTick).toBe(true);
        expect(ARROW_TRAP_PRESSER.trapReadsPreviousTick).toBe(true);
    });
});

describe('the plan doctrine', () => {
    it('the six phases are in the order the measurement cut them', () => {
        expect(ARROW_KILL_PLAN.phases)
            .toEqual(['press', 'clear', 'bait', 'dwell', 'back', 'hold']);
    });

    it('⛓ the hold outlasts the kill by the LOCK\'s fade, not by slack', () => {
        expect(ARROW_KILL_PLAN.lockFadeTicks).toBe(100);
        expect(ARROW_KILL_PLAN.minHoldAfterBaitTicks)
            .toBeGreaterThanOrEqual(ARROW_ENEMY_HIT.minTicksToKillDefaultEnemy
                + ARROW_KILL_PLAN.lockFadeTicks);
        // ...and the probe's measured hold clears that floor, which is why
        // the arm passed on its fourth cut and not by luck.
        expect(ARROW_KILL_PLAN.measuredL5.hold)
            .toBeGreaterThanOrEqual(ARROW_KILL_PLAN.minHoldAfterBaitTicks);
    });
});

/**
 * ⛔ THE MUTATION LIST — every constant this module could get wrong, with
 * the stratum that reddens. A row with no biter is a bounded vacuity and is
 * named as one.
 *
 *   shootTimerMax 10 -> 9        the period test (11 -> 10)
 *   volleyPeriodTicks 11 -> 10   the period test's second assertion
 *   ctor.dy 2 -> 2.5             the entity-point test AND the combat.js cross-check
 *   spawnOffsetsX -> [0]         the volley test, the lane width test
 *   spawnDY -2 -> 0              the volley test
 *   velocity.y 5 -> 1            the fall test, the bound test
 *   hitbox 4x4 -> 8x8            the rect test, the lane width test
 *   hitables minus 'Solid'       the Solid-stops-it test
 *   hitables plus 'Rope'         the not-in-hitables test
 *   fadeStep 0.1 -> 0.2          the eleven-tick fade test
 *   fadeTicks 11 -> 10           the fade test's cross-check to MOBILE_DEATH_FADE
 *   ARROW_ENEMY_HIT.damage 1 -> 5  the three-arrow test AND the refutation test
 *   ARROW_ENEMY_HIT.force 5 -> 1   the force/damage inequality test
 *   iFrameTicks 30 -> 0          the 60-tick floor test
 *   lane half-open -> inclusive  the `exactly x1` test
 *   shadowOf ignoring cover      the cover test's third assertion
 *   the census, either direction the two refusal tests
 *
 * ⚠ NON-BITERS, recorded rather than left to be rediscovered:
 *
 *   `ARROW_TRAP.initialShootTimer` 0 -> 0 is the only value the class has;
 *   there is nothing to mutate it to that the disarm test does not already
 *   pin from the other side.
 *
 *   `ARROW_KILL_PLAN.measuredL5.clear`/`dwell` have NO biter here and
 *   cannot have one: they are numbers the GAME adjudicated in the probe,
 *   and a unit test that pinned them would be a test of a transcription of
 *   a measurement. The probe is their stratum. [[the game is the only oracle]]
 */
describe('the mutation list is data, not a comment', () => {
    it('every constant named above is exported and finite', () => {
        for (const n of [ARROW_TRAP.shootTimerMax, ARROW_TRAP.volleyPeriodTicks,
            ARROW_TRAP.ctor.dy, ARROW_TRAP.spawnDY, ARROW_TRAP.velocity.y,
            ARROW.fadeStep, ARROW.fadeTicks, ARROW.speed,
            ARROW_ENEMY_HIT.damage, ARROW_ENEMY_HIT.force, ARROW_ENEMY_HIT.iFrameTicks,
            ARROW_KILL_PLAN.lockFadeTicks]) {
            expect(Number.isFinite(n)).toBe(true);
        }
    });
});

/**
 * ⛓⛓⛓ R8 SLICE 3 — THE ARROW MEETS A BODY AT LAST.
 *
 * `stepArrow`'s `bodies` parameter has defaulted to `[]` since R7 slice 6b,
 * which is what made the model's arrows fly through everything and scoped
 * slice 1's enemy bridge by ROOM (trap 157). These are the geometry half;
 * the PRICING half is `levelRun`'s, and the two are separate on purpose —
 * this module has no opinion about which world it is stepping.
 */
describe('R8 slice 3: bodies, cover, and the removal outside the switch', () => {
    const body = (id, type, r) => ({ id, type, rect: r });

    it('⛓ an arrow that touches a body STOPS — velocity zeroed, `die` latched', () => {
        const a = createArrow('a#0', 50, 50, 0, 5);
        const r = stepArrow(a, {
            bound: { w: 200, h: 200 },
            bodies: [body('bob@1,1', 'Enemy', rect(48, 52, 8, 8))],
        });
        expect(r.hits).toHaveLength(1);
        expect(a.v).toEqual({ x: 0, y: 0 });
        expect(a.die).toBe(true);
        expect(a.hitTypes).toEqual(['Enemy']);
    });

    /**
     * ⛔ COVER IS A RESOURCE, AND IT IS THE `default:` ARM. `Tree`, `Solid`
     * and `Shield` take no damage and stop the arrow anyway, because the
     * removal (`if (hits.length > 0)`) sits OUTSIDE the switch.
     */
    it('⛔ an arrow dies on COVER, which takes no damage at all', () => {
        const a = createArrow('a#0', 50, 50, 0, 5);
        const seen = [];
        const r = stepArrow(a, {
            bound: { w: 200, h: 200 },
            coverAt: (box) => { seen.push(box); return { id: 'torch@48,64', cls: { type: 'Solid' }, rect: rect(48, 52, 16, 16) }; },
        });
        expect(seen).toHaveLength(1);
        expect(r.hits.map((h) => h.type)).toEqual(['Solid']);
        expect(a.die).toBe(true);
    });

    /**
     * ⛔ THE DISPOSITIONS PARTITION `ARROW.hitables`, and the check reads the
     * transcription's own list rather than a copy typed beside it (trap 89).
     */
    it('⛓ the target dispositions are TOTAL over the hitables', () => {
        expect(assertArrowTargetPartition(ARROW_TARGET_DISPOSITIONS, ARROW.hitables))
            .toEqual({ types: 5 });
        /**
         * ⛔⛔ R8 SLICE 5 — THIS ROW FLIPPED, AND THE FLIP IS THE FINDING.
         * `Player` was `priced-elsewhere` and the payer it named
         * (`PUZZLEMENT_HAZARDS.arrowtrap`) is a CENSUS row no consumer bills
         * from. The GAME reported `hits: 1` where this model reported 0.
         */
        expect(ARROW_TARGET_DISPOSITIONS.Player).toBe('damaged');
        expect(ARROW_PLAYER_ARM.damagePricedBy).toMatch(/applyPlayerHit/);
        expect(ARROW_PLAYER_ARM.censusRow).toMatch(/PUZZLEMENT_HAZARDS\.arrowtrap/);
        // ⛓ The census's number and the live arm's number are still ONE
        // number — what changed is which of them is a bill.
        expect(ARROW_PLAYER_ARM.damage).toBe(PUZZLEMENT_HAZARDS.arrowtrap.damage);
        // ⛔ And nothing is filed `priced-elsewhere` any more; the value stays
        // in the vocabulary rather than being deleted (trap 62).
        expect(Object.values(ARROW_TARGET_DISPOSITIONS))
            .not.toContain('priced-elsewhere');
    });

    it('⛔ MUTATION: a hitable with no disposition is a NAMED throw', () => {
        const { Shield, ...short } = ARROW_TARGET_DISPOSITIONS;
        expect(() => assertArrowTargetPartition(short, ARROW.hitables))
            .toThrow(/Unclassified: Shield/);
    });

    it('⛔ MUTATION: a disposition for a type that is not hitable is a NAMED throw', () => {
        expect(() => assertArrowTargetPartition(
            { ...ARROW_TARGET_DISPOSITIONS, Rope: 'stops' }, ARROW.hitables,
        )).toThrow(/not a hitable: Rope/);
    });

    /**
     * ⛓ A TYPE THE ARROW DOES NOT HIT IS NOT A STOP. `Rock` and `Rope` are in
     * the PLAYER's solids list and in no arrow's — a model that reused
     * `collidesSolid` would stop arrows the game flies through, which is the
     * over-approximation `collidesArrowCover` exists to avoid.
     */
    it('⛓ a body of an unhitable type is flown through', () => {
        const a = createArrow('a#0', 50, 50, 0, 5);
        const r = stepArrow(a, {
            bound: { w: 200, h: 200 },
            bodies: [body('rock@1,1', 'Rock', rect(48, 52, 8, 8))],
        });
        expect(r.hits).toEqual([]);
        expect(a.die).toBe(false);
    });

    /**
     * ⛔⛔ AND A STOPPED ARROW GOES ON OVERLAPPING THE BODY IT HIT for the
     * whole eleven-tick fade — which is exactly why slice 1's
     * "a stepped chaser is inside a live arrow" assertion had to be deleted
     * rather than kept: after the family is built, that condition is the
     * ORDINARY case.
     */
    it('⛓ a stopped arrow keeps its position through the fade', () => {
        const a = createArrow('a#0', 50, 50, 0, 5);
        const b = body('bob@1,1', 'Enemy', rect(48, 52, 8, 8));
        stepArrow(a, { bound: { w: 200, h: 200 }, bodies: [b] });
        const at = { x: a.x, y: a.y };
        let ticks = 0;
        while (!a.removed && ticks < 50) {
            const r = stepArrow(a, { bound: { w: 200, h: 200 }, bodies: [b] });
            // ⛔ AND IT DOES NOT HIT AGAIN — `if (v.length > 0)` gates the
            // whole test block, and the hit ZEROED the velocity. A model that
            // re-tested a dead arrow would kill a bob three times over.
            expect(r.hits).toEqual([]);
            ticks += 1;
        }
        expect(a.removed).toBe(true);
        expect(ticks).toBe(ARROW.fadeTicks - 1);
        expect({ x: a.x, y: a.y }).toEqual(at);
    });
});

/**
 * ── ⛓⛓⛓ THE HOIST'S EQUIVALENCE GATE (editor arc slice 8) ─────────────────
 *
 * `arrowLaneForPlacement` and `arrowLaneRect` did not add geometry — they took
 * ownership of eleven inline retypes (six placement→lane, five lane→rect) that
 * `dangerMap` and `solverBot` had each written out by hand. The orchestrator's
 * binding condition on that hoist was that the equivalence be asserted **PER
 * SITE, BEFORE the convergence**, and that a site which did not match the
 * common spelling exactly — a different clamp, a different floor, anything —
 * be a STOP-AND-REPORT rather than something harmonised into agreement.
 *
 * ⛓ That is slice 1's `createRunForStaging` lesson, which is the only reason
 * the condition exists: two run constructions that looked like copies of each
 * other disagreed about `despawn`, and the naive unification would have
 * changed a solve. A refactor that makes two things agree is a behaviour
 * change wearing a refactor's name.
 *
 * ⛔ THE SOURCE ARM IS THE HALF THAT SURVIVES THE CONVERGENCE, and it survives
 * INVERTED (trap 62 — a check is replaced, never deleted). Before: *every*
 * `arrowLane(` call in the two modules matches the canonical retype. After:
 * there are NONE, because the adapter is the only spelling left. The count is
 * asserted either way, so the day someone writes a twelfth retype the gate
 * says so instead of the tree quietly growing a second spelling back.
 */
describe('the arrowLane placement adapter — the hoist and its equivalence gate', () => {
    const readSrc = (name) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
    /** Whitespace-normalised, so a line-wrapped call reads like a one-liner. */
    const flat = (s) => s.replace(/\s+/g, ' ');
    const MODULES = ['dangerMap.js', 'solverBot.js'];

    /**
     * The canonical retype, with the receiver's NAME left free — five sites
     * call it `trap` and `solverBot`'s sixth calls it `t`, which is the only
     * difference between them and is not a difference at all.
     */
    const RETYPE = /arrowLane\(\s*\{ id: (\w+)\.id, t: \1\.t, x: \1\.ex, y: \1\.ey \}\s*\)/g;
    /** The canonical lane→rect, with the HEIGHT expression left free. */
    const LANE_RECT = /rect\(lane\.x0, lane\.fromY, lane\.x1 - lane\.x0, Math\.max\((.+?) - lane\.fromY, 1\)\)/g;

    it('⛔ NO module retypes a placement inline any more — the adapter is the one spelling', () => {
        for (const m of MODULES) {
            const src = flat(readSrc(m));
            // Every `arrowLane(` that is not the adapter's own call site.
            const calls = src.match(/(?<!ForPlacement|Rect)\barrowLane\(/g) ?? [];
            expect({ module: m, inlineArrowLaneCalls: calls.length })
                .toEqual({ module: m, inlineArrowLaneCalls: 0 });
            const rects = src.match(LANE_RECT) ?? [];
            expect({ module: m, inlineLaneRects: rects.length })
                .toEqual({ module: m, inlineLaneRects: 0 });
        }
    });

    /**
     * ⛓ THE BEHAVIOURAL HALF, and it is the one that outlives the source arm.
     * The retype's spelling is transcribed here VERBATIM from what the eleven
     * sites said at `55bd867f6`, so this asserts the adapter against the code
     * it replaced rather than against itself.
     */
    it('⛓⛓⛓ reproduces the retyped spelling EXACTLY, on every real L5 placement', () => {
        const placements = ARROW_TRAP_CENSUS[5].map((p, i) => {
            const e = arrowTrapEntityPoint(p.x, p.y);
            return { id: `arrowtrap@${p.x},${p.y}#${i}`, t: p.t, ex: e.x, ey: e.y };
        });
        expect(placements.length).toBeGreaterThan(0);
        for (const trap of placements) {
            // ── the six sites' spelling, verbatim ──
            const retyped = arrowLane({ id: trap.id, t: trap.t, x: trap.ex, y: trap.ey });
            expect(arrowLaneForPlacement(trap)).toEqual(retyped);
        }
    });

    it('⛓⛓ …and the lane→rect arithmetic the five rect sites wrote out', () => {
        const lane = L5_LANES[0];
        for (const height of [L5_BOUND.h, 128, 256, 16]) {
            // ── the five sites' spelling, verbatim ──
            const written = rect(lane.x0, lane.fromY, lane.x1 - lane.x0,
                Math.max(height - lane.fromY, 1));
            expect(arrowLaneRect(lane, height)).toEqual(written);
        }
    });

    /**
     * ⚠ THE FLOOR IS A REAL ARM, not defensive noise: a trap whose spawn row
     * is at or below the level's bottom gives a non-positive height, and
     * `rectsOverlap` is half-open — a zero-height rect overlaps nothing, so
     * the lane would silently stop being dangerous instead of being a sliver.
     */
    it('⚠ the height floor keeps a below-the-floor lane a RECT, not a nothing', () => {
        const lane = L5_LANES[0];
        expect(arrowLaneRect(lane, lane.fromY).h).toBe(1);
        expect(arrowLaneRect(lane, lane.fromY - 40).h).toBe(1);
    });

    /**
     * ⛔ `ex`/`ey` ARE ALREADY THE ENTITY POINT — the adapter maps NAMES and
     * must not re-apply `arrowTrapEntityPoint`'s `(+8, +2)`. A regression that
     * did would move every lane two tiles and still look like a lane.
     */
    it('⛔ maps names only — it does not re-apply the entity offset', () => {
        const e = arrowTrapEntityPoint(16, 16);
        const viaPlacement = arrowLaneForPlacement({ id: 'a', t: 1, ex: e.x, ey: e.y });
        const viaEntity = arrowLane({ id: 'a', t: 1, x: e.x, y: e.y });
        expect(viaPlacement).toEqual(viaEntity);
        expect(viaPlacement.fromY).toBe(e.y + ARROW_TRAP.spawnDY);
    });
});
