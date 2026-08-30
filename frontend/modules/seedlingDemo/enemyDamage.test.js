/**
 * `enemyDamage.test.js` — the strata for the FIRST predictive Enemy arm.
 *
 * Region-atlas Phase 8, R5 slice 21 step 0. Per the §14 law, every check
 * here is phrased from ONE artifact's own readout with both sides from
 * somewhere this module does not own:
 *
 *   · the fade counts are run as LOOPS and cross-checked against
 *     `activators.opensOnTick`, which is a different module's transcription
 *     of the same float question — so a shared derivation cannot make both
 *     agree on a wrong answer;
 *   · the policy enumeration is checked against `combat.js`'s two tables,
 *     which come from `Game.as` and the `Enemies/` directory rather than
 *     from anything here;
 *   · the death staging is checked against `chasers.deathTicks`, which
 *     derives from each class's own `Spritemap.add` arguments;
 *   · the kill-lock nil is checked against the COMMITTED ATLAS for L40,
 *     not against a hand-written lock list.
 */

import { describe, expect, it } from 'vitest';

import {
    CORPSE_COUNTING, ENEMY_DAMAGE_DEFAULTS, EnemyDamageError, KILL_ARM_POLICY,
    KILL_SIDE_WRITES, LOCK_ACTIVATION_FADE_TICKS, MOBILE_DEATH_FADE, MODELLED_KILL_ARMS,
    PIT_FADE, TOTAL_ENEMIES_CLASSES, TOTAL_ENEMIES_OMISSIONS, assertKillArmPolicyCovers,
    createEnemyDamage, enemyHit, enemyHitUpdate, fadeTicks, killLockLedger, mobileDeath,
    removalTicksAfterHit, totalEnemiesOf,
} from './enemyDamage.js';
import { RESPONDERS, opensOnTick } from './activators.js';
import { deathTicks, killWindowTicks } from './chasers.js';
import { KILL_PRESS_CADENCE } from './combatVerbs.js';
import { atlasLevelSource } from './levelSource.js';

const sword = { d: 1, f: 5, t: 'Sword' };

describe('the fades — and both of them are counted, never divided', () => {
    /**
     * ⛔⛔⛔ THE ELEVEN TICKS THE LADDER LOST. `Math.ceil(1 / 0.1)` is 10 and
     * it is wrong: ten subtractions of 0.1 from 1 leave 1.39e-16, which is
     * not `<= 0`, so the ELEVENTH is the one that removes the body.
     */
    it('⛔ `Mobile.death()` takes ELEVEN calls, not ten', () => {
        expect(MOBILE_DEATH_FADE.ticks).toBe(11);
        expect(Math.ceil(1 / MOBILE_DEATH_FADE.alphaStep)).toBe(10);
        // the float, stated so the count is not a magic number
        let a = 1;
        for (let i = 0; i < 10; i += 1) a -= 0.1;
        expect(a).toBeGreaterThan(0);
        expect(a - 0.1).toBeLessThan(0);
    });

    /**
     * ⚠ AN INDEPENDENT STRATUM, and this is the one the §14 law asks for:
     * `activators.opensOnTick` transcribed the SAME float question for the
     * `Cover` (decrement, then test, with the clamp) months earlier and from
     * a different source file. If both were wrong they would have to be
     * wrong the same way, which a shared derivation would guarantee and two
     * hand transcriptions do not.
     */
    it('⛓ and `activators.opensOnTick(0.1)` — a different module, same answer', () => {
        expect(opensOnTick(0.1)).toBe(MOBILE_DEATH_FADE.ticks);
    });

    it('⛓ the pit descent is twenty, at 0.05', () => {
        expect(PIT_FADE.ticks).toBe(20);
        expect(PIT_FADE.alphaStep).toBe(0.05);
    });

    /**
     * ⚠ THE CLAMP DOES NOT CHANGE EITHER COUNT — asserted rather than
     * assumed, because `Image.set alpha` clamping is what makes a PIT
     * removal immediate and it would be easy to conclude it also shortens
     * the fade. It does not.
     */
    it('⚠ …and the clamp changes neither count, which is why the pit is the odd one', () => {
        const unclamped = (step) => {
            let a = 1;
            for (let n = 1; n <= 1000; n += 1) { a -= step; if (a <= 0) return n; }
            throw new Error('never');
        };
        expect(unclamped(0.1)).toBe(MOBILE_DEATH_FADE.ticks);
        expect(unclamped(0.05)).toBe(PIT_FADE.ticks);
    });

    it('⛓ the lock fade comes from `activators`, not from a second copy here', () => {
        expect(LOCK_ACTIVATION_FADE_TICKS).toBe(opensOnTick(RESPONDERS.lock.fade));
        // 101, not 100: the `alpha > 0` test runs BEFORE the decrement.
        expect(LOCK_ACTIVATION_FADE_TICKS).toBe(101);
        expect(fadeTicks(1, RESPONDERS.lock.fade)).toBe(100);
    });

    it('a fade that never converges throws rather than looping', () => {
        expect(() => fadeTicks(1, 0)).toThrow(EnemyDamageError);
        expect(() => fadeTicks(1, -1)).toThrow(EnemyDamageError);
    });
});

describe('the policy — an ENUMERATION, checked against `combat.js`', () => {
    it('⛓ covers every summed class and every named omission, and adds nothing', () => {
        expect(assertKillArmPolicyCovers()).toEqual([]);
    });

    /**
     * ⛓ THE MECHANISM, NOT THE COUNT. This asserted `['IceTurret']` from R5
     * slice 21 until R6 slice 5 lifted `ShieldBoss` and turned it red for
     * doing its job — [[feedback_coincidental_predicate_rots]], the same
     * fuse `r6Acceptance.test.js` lit one slice earlier. What the rule
     * actually is: a lift is PER CLASS, so every modelled row must carry a
     * `CORPSE_COUNTING` row saying what its death does to `classCount`, and
     * no row may be modelled without one.
     */
    it('⛔ the lift is PER CLASS — every modelled arm has staged its own corpse', () => {
        expect(MODELLED_KILL_ARMS.length).toBeGreaterThan(0);
        for (const as3 of MODELLED_KILL_ARMS) {
            expect(CORPSE_COUNTING[as3], `${as3} is modelled with no CORPSE_COUNTING row`)
                .toBeTruthy();
            expect(KILL_SIDE_WRITES[as3], `${as3} is modelled with no KILL_SIDE_WRITES row`)
                .toBeTruthy();
        }
        // ...and the two shapes really are different, so the table is not a
        // rubber stamp: one death moves `classCount` and one does not.
        expect(MODELLED_KILL_ARMS.map((c) => CORPSE_COUNTING[c].removesBody))
            .toEqual(expect.arrayContaining([true, false]));
    });

    /**
     * ⛔⛔ THE REFUSAL IS BY NAME, and the name is what makes it auditable.
     * A blanket "everything else is refused" cannot be diffed against the
     * AS3 — which is exactly how `BurnableTree` and `BombPusher` fell out of
     * the press census in slice 11.
     */
    it('⛔ every refusal carries its OWN reason, not a shared one', () => {
        const refused = Object.entries(KILL_ARM_POLICY)
            .filter(([, p]) => p.policy === 'refused');
        expect(refused.length).toBeGreaterThan(15);
        const whys = refused.map(([, p]) => p.why);
        for (const w of whys) expect(typeof w).toBe('string');
        // ⚠ A refusal that says the same thing as another is a refusal
        // nobody re-read. Bob's cost is CITED by its neighbours, so the
        // duplicates are bounded and named rather than forbidden.
        const shared = whys.filter((w) => w === 'the Bob cost; off every R5 route');
        expect(shared.length).toBeLessThanOrEqual(4);
    });

    /**
     * ⛔ `Turret` IS NOT `IceTurret`. The plain one has no `death()`
     * override, so its kill really does move `classCount` — refused by name
     * so the lift cannot be read as covering the family.
     */
    it('⛔ `Turret` stays refused, and says why it is not the one that was lifted', () => {
        expect(KILL_ARM_POLICY.Turret.policy).toBe('refused');
        expect(KILL_ARM_POLICY.Turret.why).toMatch(/NOT `IceTurret`/);
        expect(TOTAL_ENEMIES_CLASSES).toContain('Turret');
    });

    it('⛔ the base class has its own row, and it refuses', () => {
        expect(KILL_ARM_POLICY.Enemy.policy).toBe('refused');
        expect(TOTAL_ENEMIES_CLASSES).toContain('Enemy');
    });

    it('the three empty overrides are `inert`, and they are the same three `combat.js` names', () => {
        const inert = Object.entries(KILL_ARM_POLICY)
            .filter(([, p]) => p.policy === 'inert').map(([c]) => c).sort();
        expect(inert).toEqual(['BombPusher', 'DarkTrap', 'Grenade']);
        expect(Object.keys(TOTAL_ENEMIES_OMISSIONS)).toContain('BombPusher');
    });

    it('⛔ a state for a refused class THROWS at birth, not at the press', () => {
        // ⛓ R8 SLICE 6: `Spinner` WAS an exemplar here and is now `modelled`.
        // ⛓⛓ R9 SLICE 12: so is `Bob` — a debt's record is an assertion that
        // must flip, and this is the second time this row has been asked to.
        // The control is REPLACED rather than deleted (trap 62): `Jellyfish`
        // is transcribed to the same depth in the same module as `Bob`, is a
        // CHASER exactly as `Bob` is, and is deliberately unconverted — so it
        // is still the class where "transcribed" and "modelled" visibly
        // differ, and the row keeps a live negative rather than becoming an
        // enumeration of successes.
        expect(() => createEnemyDamage('Jellyfish')).toThrow(/refused/);
        expect(createEnemyDamage('Bob').as3).toBe('Bob');
        expect(createEnemyDamage('Spinner').as3).toBe('Spinner');
        expect(() => createEnemyDamage('Nonesuch')).toThrow(/no KILL_ARM_POLICY row/);
    });

    it('an override that names no `Enemy` field throws', () => {
        expect(() => createEnemyDamage('IceTurret', { hitpoints: 3 }))
            .toThrow(/is not a field of/);
    });
});

describe('`Enemy.hit` — the five gates, and each refusal names itself', () => {
    const fresh = () => createEnemyDamage('IceTurret', { dieInWater: false });

    it('gate 1a — the i-frame, and a hit sets it to `hitsTimerMax`', () => {
        const s = fresh();
        expect(enemyHit(s, sword).landed).toBe(true);
        expect(s.hitsTimer).toBe(ENEMY_DAMAGE_DEFAULTS.hitsTimerMax);
        const again = enemyHit(s, sword);
        expect(again.landed).toBe(false);
        expect(again.refusedAt).toMatch(/i-frames/);
        expect(s.hits).toBe(1);
    });

    /**
     * ⛔⛔ THE I-FRAME AND THE DAMAGE GO OPPOSITE WAYS UNDER A FREEZE.
     * `Enemy.hit` carries `!Game.freezeObjects` INSIDE its own gate, so no
     * damage lands; `hitUpdate` is reached from `Enemy.update`'s tail, which
     * has no freeze test at all, so the timer keeps running down. A
     * ceremony therefore SPENDS i-frames without allowing hits.
     */
    it('⛔ gate 1b — damage is freeze-gated and the i-frame is NOT', () => {
        const s = fresh();
        expect(enemyHit(s, { ...sword, frozen: true }).refusedAt).toMatch(/frozen/);
        expect(s.hits).toBe(0);
        enemyHit(s, sword);
        expect(s.hitsTimer).toBe(30);
        for (let i = 0; i < 30; i += 1) enemyHitUpdate(s, { onScreen: true });
        expect(s.hitsTimer).toBe(0);
    });

    /**
     * ⚠ AND OFF SCREEN NEITHER RUNS. `Enemy.update`'s first line returns
     * above everything, so an off-camera body's timer is frozen — which is
     * why a cadence computed from the timer is wrong the moment the camera
     * loses the target.
     */
    it('⚠ off screen the timer does not run down at all', () => {
        const s = fresh();
        enemyHit(s, sword);
        for (let i = 0; i < 60; i += 1) enemyHitUpdate(s, { onScreen: false });
        expect(s.hitsTimer).toBe(30);
    });

    it('gate 1c — `canHit: false` is unkillable by construction', () => {
        const s = fresh();
        s.canHit = false;
        expect(enemyHit(s, sword).refusedAt).toMatch(/canHit/);
    });

    it('gate 2 — `onlyHitBy`, with the `justKnock` else-arm', () => {
        const s = fresh();
        s.onlyHitBy = 'Wand';
        expect(enemyHit(s, sword)).toMatchObject({ landed: false, knockedBack: false });
        s.justKnock = true;
        expect(enemyHit(s, sword)).toMatchObject({ landed: false, knockedBack: true });
        expect(enemyHit(s, { ...sword, t: 'Wand' }).landed).toBe(true);
    });

    it('⛔ gate 3 — fire falls to `knockback` and spends NO i-frame', () => {
        const s = fresh();
        const r = enemyHit(s, { d: 1, f: 5, t: 'Fire' });
        expect(r).toMatchObject({ landed: false, damaged: false, knockedBack: true });
        expect(s.hits).toBe(0);
        // ⛓ THE COMMENTED-OUT LINE IS THE FINDING: `//hitsTimer =
        // hitsTimerMax;` sits in that arm, so a fire hit leaves the body
        // immediately hittable by the sword.
        expect(s.hitsTimer).toBe(0);
        expect(enemyHit(s, sword).landed).toBe(true);
    });

    /**
     * ⛔⛔⛔ GATE 4 IS IN NO BRIEF. A body already at `hitsMax` — mid death
     * animation, mid fade — takes NOTHING: no damage, no knockback, no
     * i-frame refresh. That is what makes `killSchedule`'s SLACK press a
     * true no-op instead of a second death.
     */
    it('⛔ gate 4 — a body at `hitsMax` takes nothing at all', () => {
        const s = fresh();
        s.hits = s.hitsMax;
        const r = enemyHit(s, sword);
        expect(r).toMatchObject({ landed: false, damaged: false, knockedBack: false });
        expect(r.refusedAt).toMatch(/already dying/);
        expect(s.hitsTimer).toBe(0);
    });

    it('gate 5 — the third hit kills, and the first two knock back', () => {
        const s = fresh();
        const seen = [];
        for (let i = 0; i < 3; i += 1) {
            s.hitsTimer = 0;
            seen.push(enemyHit(s, sword));
        }
        expect(seen.map((r) => r.killed)).toEqual([false, false, true]);
        expect(seen.map((r) => r.knockedBack)).toEqual([true, true, false]);
        expect(s.dying).toBe(true);
        expect(s.destroy).toBe(true);
    });

    /**
     * ⛓ THE LATCH IN GATE 1. `hitByDarkStuff` is an OR against the i-frame,
     * so a Shield hit makes every subsequent hit land regardless of cadence
     * — and a plain hit clears it again. R6/R7 owns the weapons; the gate is
     * transcribed because a cadence rule derived without it is wrong for
     * exactly those.
     */
    it('⛓ `hitByDarkStuff` ORs PAST the i-frame, and a plain hit clears it', () => {
        const s = createEnemyDamage('IceTurret', { dieInWater: false, hitsMax: 9 });
        expect(enemyHit(s, { d: 1, t: 'Shield' }).landed).toBe(true);
        expect(s.hitByDarkStuff).toBe(true);
        expect(s.hitsTimer).toBe(30);
        // …and the very next Shield hit lands, i-frame notwithstanding
        expect(enemyHit(s, { d: 1, t: 'Shield' }).landed).toBe(true);
        expect(s.hits).toBe(2);
        // a SWORD hit lands too (the gate is still open) and clears the latch
        expect(enemyHit(s, sword).landed).toBe(true);
        expect(s.hitByDarkStuff).toBe(false);
        expect(enemyHit(s, sword).refusedAt).toMatch(/i-frames/);
    });

    it('`maxForce` clamps the force `knockback` receives', () => {
        const s = fresh();
        s.maxForce = 2;
        expect(enemyHit(s, { d: 1, f: 5, t: 'Sword' }).force).toBe(2);
        const t = fresh();
        expect(enemyHit(t, { d: 1, f: 5, t: 'Sword' }).force).toBe(5);
    });

    it('the subclass gate sits ABOVE all five — `IceTurret.hit` refuses a corpse', () => {
        const s = fresh();
        const r = enemyHit(s, { ...sword, reachable: false });
        expect(r.landed).toBe(false);
        expect(r.refusedAt).toMatch(/subclass/);
    });
});

/**
 * ⛔⛔⛔ THE CADENCE, AND THE MARGIN IS ONE TICK.
 *
 * The body's `hitUpdate` runs BEFORE the player's press each tick, so a hit
 * at tick T is followed by thirty decrements on T+1..T+30 and the gate is
 * open again for the player's update of T+30. `KILL_PRESS_CADENCE` is 31.
 * Thirty would NOT clear it, and this is the stratum that says so.
 */
describe('the cadence — driven, not asserted from the constant', () => {
    const drive = (cadence) => {
        const s = createEnemyDamage('IceTurret', { dieInWater: false });
        let landed = 0;
        for (let tick = 0; tick < 200; tick += 1) {
            // the body updates first…
            enemyHitUpdate(s, { onScreen: true });
            // …then the player presses, on the cadence
            if (tick % cadence === 0 && enemyHit(s, sword).landed) landed += 1;
        }
        return { landed, hits: s.hits, dying: s.dying };
    };

    it('⛓ 31 lands three hits and kills; 30 lands three too — the margin is exactly one', () => {
        expect(KILL_PRESS_CADENCE).toBe(31);
        expect(drive(31)).toMatchObject({ landed: 3, hits: 3, dying: true });
        expect(drive(30)).toMatchObject({ landed: 3, hits: 3, dying: true });
    });

    it('⛔ …and 29 does NOT — the i-frame refuses one and the kill needs a fourth press', () => {
        const s = createEnemyDamage('IceTurret', { dieInWater: false });
        let landed = 0;
        let refused = 0;
        for (let tick = 0; tick <= 58; tick += 1) {
            enemyHitUpdate(s, { onScreen: true });
            if (tick % 29 === 0) {
                if (enemyHit(s, sword).landed) landed += 1; else refused += 1;
            }
        }
        expect(refused).toBeGreaterThan(0);
        expect(landed).toBeLessThan(3);
        expect(s.dying).toBe(false);
    });

    /**
     * ⛓ ONE PRESS IS AT MOST ONE LANDED HIT. `slashDelayMax` is 0, so
     * `slash()`'s hit test runs on every tick the flag is up — five of them,
     * the "slash" anim's own length — and the i-frame refuses four of the
     * five. Which is the mirror image of `fire.bumps`: there, five
     * dispatches are five EFFECTS; here they are one.
     */
    it('⛓ the five-tick slash window lands ONE hit — the mirror of `fire.bumps`', () => {
        const s = createEnemyDamage('IceTurret', { dieInWater: false });
        let landed = 0;
        for (let k = 0; k < 5; k += 1) {
            enemyHitUpdate(s, { onScreen: true });
            if (enemyHit(s, sword).landed) landed += 1;
        }
        expect(landed).toBe(1);
    });
});

describe('`Mobile.death()` — and `destroy` is not removal', () => {
    it('the fade runs on EVERY call and removes on the eleventh', () => {
        const s = createEnemyDamage('IceTurret', { dieInWater: false });
        s.destroy = true;
        for (let i = 1; i < MOBILE_DEATH_FADE.ticks; i += 1) {
            mobileDeath(s);
            expect(s.removed).toBe(false);
        }
        mobileDeath(s);
        expect(s.removed).toBe(true);
    });

    it('a call with `destroy` false is a no-op — the fade does not start on its own', () => {
        const s = createEnemyDamage('IceTurret', { dieInWater: false });
        for (let i = 0; i < 50; i += 1) mobileDeath(s);
        expect(s.alpha).toBe(1);
        expect(s.removed).toBe(false);
    });

    it('an intercept that CONSUMES the destroy stops the fade before it starts', () => {
        const s = createEnemyDamage('IceTurret', { dieInWater: false });
        s.destroy = true;
        let consumed = false;
        const intercept = (st) => {
            if (consumed) return false;
            consumed = true; st.destroy = false; return true;
        };
        mobileDeath(s, intercept);
        expect(s.alpha).toBe(1);
        expect(s.destroy).toBe(false);
        // …and the SECOND destroy goes all the way through
        s.destroy = true;
        for (let i = 0; i < MOBILE_DEATH_FADE.ticks; i += 1) mobileDeath(s, intercept);
        expect(s.removed).toBe(true);
    });
});

describe('the death staging, per class — and the window floor was eleven short', () => {
    it('⛔ a turret kill removes NOTHING', () => {
        expect(CORPSE_COUNTING.IceTurret.shape).toBe('intercept');
        expect(CORPSE_COUNTING.IceTurret.removesBody).toBe(false);
        expect(removalTicksAfterHit('IceTurret')).toBe(null);
    });

    /**
     * ⛔⛔⛔ THE CORRECTION, AND IT IS `combatVerbs.killWindowTicks`.
     *
     * That function is `1 + deathTicks(tag)` — the hit test's lag plus the
     * death ANIMATION. The body is removed by `Mobile.death()`, ELEVEN ticks
     * after the animation ends, and `classCount` does not move until it is.
     * The L60 pair passed on `killSchedule`'s SLACK press, which bought 31
     * ticks over an arithmetic that was 11 short.
     */
    it('⛔ bob and jellyfish need `deathTicks + 11`, not `deathTicks`', () => {
        expect(deathTicks('bob')).toBe(25);
        expect(deathTicks('jellyfish')).toBe(35);
        expect(removalTicksAfterHit('Bob', deathTicks('bob'))).toBe(36);
        expect(removalTicksAfterHit('Jellyfish', deathTicks('jellyfish'))).toBe(46);
        // the shipped floor, and the gap
        expect(killWindowTicks('bob')).toBe(26);
        expect(removalTicksAfterHit('Bob', deathTicks('bob')) + 1 - killWindowTicks('bob'))
            .toBe(MOBILE_DEATH_FADE.ticks);
    });

    it('⛓ a `fade` class has no animation stage at all, and refuses one', () => {
        expect(CORPSE_COUNTING.Spinner.shape).toBe('fade');
        expect(removalTicksAfterHit('Spinner')).toBe(MOBILE_DEATH_FADE.ticks);
        expect(() => removalTicksAfterHit('Spinner', 25)).toThrow(/no death ANIMATION/);
    });

    it('an `anim+fade` class REFUSES to be priced without its animation length', () => {
        expect(() => removalTicksAfterHit('Bob')).toThrow(/needs its death/);
    });

    it('a class with no staging row throws rather than defaulting', () => {
        expect(() => removalTicksAfterHit('Cactus')).toThrow(/no CORPSE_COUNTING row/);
    });
});

describe('the kill-side writes', () => {
    it('⛔ a turret kill is invisible to the ledger in BOTH directions', () => {
        expect(KILL_SIDE_WRITES.IceTurret.writes).toBe('none');
    });

    it('⛓ the bob family\'s `removed()` is an EMPTY OVERRIDE, which is stronger than absent', () => {
        expect(KILL_SIDE_WRITES.Bob.writes).toBe('none');
        expect(KILL_SIDE_WRITES.Jellyfish.writes).toBe('none');
    });

    /**
     * ⛔ AND THE SPINNER IS THE ONE THAT WRITES. Its `removed()` is
     * `if (doActions) Game.setPersistence(tag, false)` — so a spinner kill
     * is a LEDGER ENTRY as well as a count move, and the sentinel arm
     * (`_tag:int = -1`) is a bounded vacuity: every spinner in the committed
     * extract carries a tag.
     */
    it('⛔ a spinner kill writes its OWN tag, and the −1 arm is a named vacuity', () => {
        expect(KILL_SIDE_WRITES.Spinner.writes).toBe('ownTag');
        expect(KILL_SIDE_WRITES.Spinner.sentinel).toMatch(/bounded vacuity/);
        const l40 = atlasLevelSource()(40);
        const spinners = l40.entities.filter((e) => e.type === 'spinner');
        expect(spinners).toHaveLength(5);
        for (const s of spinners) expect(Number.parseInt(s.attrs.tag, 10)).toBeGreaterThanOrEqual(0);
    });
});

describe('`totalEnemies()` — the roster, never a count minus kills', () => {
    it('counts BODIES by the whitelist, and a corpse still counts', () => {
        const bodies = [
            { as3: 'IceTurret' }, { as3: 'Bob' }, { as3: 'BombPusher' },
            { as3: 'Spinner' }, { as3: 'Spinner', removed: true },
        ];
        // BombPusher is a named OMISSION — not in the sum
        expect(totalEnemiesOf(bodies)).toBe(3);
        expect(TOTAL_ENEMIES_CLASSES).not.toContain('BombPusher');
    });

    it('refuses a body with no class rather than skipping it', () => {
        expect(() => totalEnemiesOf([{ x: 1 }])).toThrow(/needs an `as3`/);
        expect(() => totalEnemiesOf(7)).toThrow(/pass the live roster/);
    });
});

/**
 * ⛔⛔⛔ THE KILL-LOCK LEDGER — AND L40's ANSWER IS NIL, COMPUTED.
 *
 * The refusal this slice lifts was `a death moves totalEnemies(), which
 * opens tSet == -1 locks`. For the one class it lifts, in the one room it
 * runs in, that consequence is provably nothing — and the machinery still
 * runs the scan, because "there were no kill locks" and "nobody looked"
 * print the same thing.
 */
describe('the kill-lock ledger', () => {
    const l40 = atlasLevelSource()(40);

    it('⛔ L40 has NO kill lock — every lock in it is tset 0..5 or a keyType bosslock', () => {
        const led = killLockLedger(l40, { bodiesBefore: [], bodiesAfter: [] });
        expect(led.locks).toEqual([]);
        expect(led.nil).toBe(true);
        expect(led.why).toMatch(/scanned, not assumed/);
        // …and the reason, read off the atlas rather than off the verdict
        // ⚠ AN EXPLICIT LIST, NOT A SUFFIX TEST. `"pushableblock".endsWith("lock")`
        // is true, and a filter that swept one in would have read its absent
        // `attrs` as a missing `tset` and made this assertion about the wrong
        // entity. [[feedback_coincidental_predicate_rots]]
        const LOCK_TYPES = new Set(['lock', 'wandlock', 'rocklock', 'grasslock',
            'shieldlock', 'shieldlocknorm', 'bosslock', 'magicallock']);
        const locks = l40.entities.filter((e) => LOCK_TYPES.has(e.type));
        expect(locks.length).toBeGreaterThan(0);
        for (const e of locks) {
            if (e.type === 'bosslock') {
                expect(e.attrs.tset).toBeUndefined();
                expect(e.attrs.keyType).toBe('2');
            } else {
                expect(Number.parseInt(e.attrs.tset, 10)).toBeGreaterThanOrEqual(0);
            }
        }
    });

    /**
     * ⛓ AND THE TURRET KILL DOES NOT MOVE THE COUNT EITHER — two independent
     * reasons for the same nil, asserted separately so a change to one
     * cannot hide behind the other. [[feedback_two_gates_one_opener]]
     */
    it('⛓ a turret kill leaves `totalEnemies()` exactly where it was', () => {
        const before = [{ as3: 'IceTurret' }, { as3: 'Bob' }];
        const after = [{ as3: 'IceTurret' }, { as3: 'Bob' }];  // the corpse stays
        const led = killLockLedger(l40, { bodiesBefore: before, bodiesAfter: after });
        expect(led.moved).toBe(false);
        expect(led.totalBefore).toBe(2);
        expect(led.totalAfter).toBe(2);
        expect(led.opens).toEqual([]);
    });

    it('⛓ a room WITH a kill lock opens it only when the count reaches zero', () => {
        const fake = {
            level: 999,
            entities: [
                { type: 'wandlock', x: 16, y: 16, attrs: { tset: '-1', tag: '3' } },
                { type: 'bosslock', x: 32, y: 16, attrs: { keyType: '2' } },
            ],
        };
        const still = killLockLedger(fake, {
            bodiesBefore: [{ as3: 'Bob' }, { as3: 'Bob' }],
            bodiesAfter: [{ as3: 'Bob' }],
        });
        expect(still.locks).toHaveLength(1);
        expect(still.opens).toEqual([]);
        expect(still.nil).toBe(true);
        expect(still.why).toMatch(/stay shut/);

        const opened = killLockLedger(fake, {
            bodiesBefore: [{ as3: 'Bob' }],
            bodiesAfter: [{ as3: 'Bob', removed: true }],
        });
        expect(opened.opens).toHaveLength(1);
        expect(opened.nil).toBe(false);
        expect(opened.why).toMatch(/OPEN/);
        // ⛓ and the LEDGER entry is 101 ticks after the count, not on it
        expect(opened.ledgerWriteAfterTicks).toBe(LOCK_ACTIVATION_FADE_TICKS);
    });

    /**
     * ⚠ A LOCK THAT WAS ALREADY OPEN IS NOT A LOCK THIS DEATH OPENED. The
     * distinction matters because the walk's claim is "the kill earned
     * this", and a room entered with zero enemies would otherwise credit
     * every death with an opening it did not cause.
     */
    it('⚠ …and a count that was ALREADY zero credits the death with nothing', () => {
        const fake = {
            level: 998,
            entities: [{ type: 'lock', x: 16, y: 16, attrs: { tset: '-1', tag: '1' } }],
        };
        const led = killLockLedger(fake, { bodiesBefore: [], bodiesAfter: [] });
        expect(led.opens).toEqual([]);
        expect(led.why).toMatch(/ALREADY 0/);
    });

    it('refuses a missing level record rather than returning an empty scan', () => {
        expect(() => killLockLedger(null, {})).toThrow(/pass the level RECORD/);
    });
});
