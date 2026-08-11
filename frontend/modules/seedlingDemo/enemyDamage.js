/**
 * `enemyDamage.js` — THE KILL, AND THE ELEVEN TICKS AFTER THE ANIMATION.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 21 step 0. The
 * FIRST predictive Enemy arm this model has ever had: every rung before
 * this one either avoided enemies, drove a kill in the GAME and read the
 * result off the observation stream (R5 slice 3's L60 pair), or refused the
 * press outright (`presses.PRESS_ARM_POLICY.Enemy`, `refused` since R4).
 *
 * Brief: `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §34.9/§34.10 —
 * *"what makes it a SLICE rather than a paragraph is the refusal's own
 * reason: a death moves `totalEnemies()`, which opens every `tset == -1`
 * lock in the room, so the first enemy this model kills has to bring the
 * kill-lock ledger with it."* Source: `Enemies/Enemy.as`,
 * `Enemies/IceTurret.as`, `Enemies/Bob.as`, `Enemies/Jellyfish.as`,
 * `Enemies/Spinner.as`, `Mobile.as`, `Puzzlements/Lock.as`, `Game.as`,
 * `net/flashpunk/graphics/Image.as`, all read at first hand.
 *
 * ── ⛔⛔⛔ WHAT THE LADDER HAD WRONG, AND IT IS ELEVEN TICKS ──────────
 *
 * `combatVerbs.killWindowTicks` is `1 + deathTicks(tag)` — the hit test's
 * one-tick lag plus the death ANIMATION, *"during which the body is still
 * an entity `Game.totalEnemies()` counts"*. That is half the wait.
 *
 * `Mobile.mobileUpdate()`'s last line is an UNCONDITIONAL `death()`, and
 * `Mobile.death()` is `if (destroy) { alpha -= 0.1; if (alpha <= 0)
 * FP.world.remove(this) }`. So `destroy` does not remove anything: it
 * starts an ALPHA FADE, and `Image.set alpha` CLAMPS to [0,1], so the
 * eleventh subtraction is the one that trips the test (ten of them leave
 * `1.39e-16`, which is not `<= 0`). ⇒ **a body counts for its animation AND
 * for eleven ticks after it**, and `classCount` drops at the
 * `world.updateLists()` of the removal tick.
 *
 * The L60 pair passed anyway, and the reason is worth keeping: its
 * assertion is the EFFECT read off the game, and `killSchedule`'s SLACK
 * press bought 31 ticks of margin over an arithmetic that was 11 short. A
 * schedule that had trusted the arithmetic and dropped the slack would have
 * ended the walk at a shut lock. [[feedback_the_pickup_seals_its_own_exit]]
 * in the other direction: the thing that saved it was not the thing that
 * was checked.
 *
 * ── ⛔⛔ AND A TURRET KILL DOES NOT MOVE `totalEnemies()` AT ALL ──────
 *
 * `IceTurret.death()` INTERCEPTS: on the first call it shrinks the hitbox,
 * plays "dead", sets `destroy` BACK to false and pushes Enemy/Player onto
 * its own solids. The entity is never removed, `classCount(IceTurret)` is
 * unchanged, and a `tset == -1` lock in its room stays shut. It moves only
 * if the CORPSE later self-destroys — a hazard tile at rest or mid-glide,
 * or a pit — and then only after `Mobile.death()`'s eleven ticks (a pit
 * has already faded the same alpha to zero, so a pit removal is immediate).
 *
 * ⇒ the two questions "did it die" and "did the room's kill locks open" are
 * DIFFERENT questions with different answers, and this module refuses to
 * collapse them. `CORPSE_COUNTING` is the table.
 *
 * ── ⛓⛓ THE FIVE GATES, AND THE FOURTH IS NOT IN ANY BRIEF ───────────
 *
 * `Enemy.hit`'s chain is five deep, not three:
 *
 *   1. `(hitsTimer <= 0 || hitByDarkStuff) && !Game.freezeObjects && canHit`
 *   2. `onlyHitBy == "" || onlyHitBy == t`      else: `justKnock` -> knockback
 *   3. `hitByFire || t != "Fire"`               else: knockback, NO i-frame
 *   4. `hits < hitsMax`                         else: NOTHING AT ALL
 *   5. `hits >= hitsMax` after `hits += d`      -> `startDeath(t)`
 *
 * Gate 4 is the one no brief names and it is the one that matters for a
 * schedule with slack in it: a press that lands on a body already at
 * `hitsMax` — i.e. mid death animation, mid fade, or a corpse whose
 * subclass forgot to gate `hit` — does not damage, does not knock back and
 * does not refresh the i-frame. It is a true no-op, and a model that let
 * `hits` run past `hitsMax` would report a second death.
 *
 * ⛓ AND GATE 1 HAS A LATCH IN IT. `hitByDarkStuff` is set to
 * `(t == "Shield" || t == "Suit")` on every DAMAGING hit, and it sits in
 * the gate as an OR against the i-frame — so one Shield hit makes every
 * subsequent hit land regardless of cadence, until a non-dark hit clears
 * it again. R6/R7 owns the weapons; the gate is transcribed here because a
 * cadence rule derived without it is wrong for exactly those weapons.
 *
 * ── WHAT THIS MODULE IS NOT ───────────────────────────────────────────
 * It does not decide WHERE to stand (`combatVerbs.slashRect`), it does not
 * move an enemy (`chasers.js`), and it does not own any class's per-visit
 * state (`iceTurret.js` does, for the one class this slice lifts). It is
 * the DAMAGE BOOKKEEPING plus the ledger consequence, as pure functions.
 */

import {
    KILL_LOCK_TAGS, KILL_LOCK_TSET, TOTAL_ENEMIES_CLASSES, TOTAL_ENEMIES_OMISSIONS,
    killLocksIn,
} from './combat.js';
// ⚠ IMPORTED, NEVER RE-DERIVED. `Lock.activationStep`'s hundred-tick fade
// has ONE answer in this package and `activators.js` computed it first —
// including the `alpha > 0`-tested-FIRST arm that puts `turnOff()` a tick
// after the alpha reaches zero. A second copy here is the two-consumers
// failure this arc keeps paying for.
import { RESPONDERS, opensOnTick } from './activators.js';

export class EnemyDamageError extends Error {
    constructor(message) { super(message); this.name = 'EnemyDamageError'; }
}
const fail = (m) => { throw new EnemyDamageError(m); };

/** Re-exported so a consumer needs ONE import for "what counts" (§7's gate). */
export { KILL_LOCK_TAGS, KILL_LOCK_TSET, TOTAL_ENEMIES_CLASSES, TOTAL_ENEMIES_OMISSIONS };

/**
 * `Enemies/Enemy.as:19-51` — every damage-relevant field default, verbatim.
 *
 * Exported as data because a subclass changes these by ASSIGNMENT in its
 * constructor (`IceTurret` writes `dieInWater = false`, `Spinner` writes
 * `activeOffScreen = true`), so "the default" and "this instance's value"
 * are two different facts and a model that hard-codes one cannot express
 * the other.
 */
export const ENEMY_DAMAGE_DEFAULTS = Object.freeze({
    damage: 1,
    hits: 0,
    hitsMax: 3,
    hitsTimer: 0,
    hitsTimerMax: 30,
    /** `const` — the colour-flash modulus, and the only other reader of the timer. */
    hitsTimerInt: 10,
    hitByDarkStuff: false,
    hitByFire: false,
    canHit: true,
    justKnock: false,
    onlyHitBy: '',
    maxForce: -1,
    dieInWater: true,
    dieInLava: true,
    canFallInPit: true,
    activeOffScreen: false,
    src: 'Enemies/Enemy.as:19-51 (fields), :141-181 (hit), :223-245 (hitUpdate), '
        + ':182-186 (startDeath); Mobile.as:31-45 (mobileUpdate), :60-72 (death)',
});

/**
 * ⛓⛓⛓ `Mobile.death()`'s FADE, COUNTED — the eleven ticks the ladder lost.
 *
 * ```
 *   public function death():void {
 *       if (destroy) {
 *           (graphic as Image).alpha -= 0.1;
 *           if ((graphic as Image).alpha <= 0) FP.world.remove(this);
 *       }
 *   }
 * ```
 *
 * `Image.set alpha` is `value = value < 0 ? 0 : (value > 1 ? 1 : value)`
 * (`Image.as:157`), so the read-modify-write goes through a CLAMP. Counted
 * rather than divided: ten subtractions of 0.1 from 1 leave
 * `1.3877787807814457e-16`, which is not `<= 0`, so the eleventh is the one
 * that removes. `10` would have been the plausible wrong answer and
 * `Math.ceil(1 / 0.1)` would have produced it.
 *
 * ⚠ THE CLAMP DOES NOT CHANGE THE COUNT HERE and that is asserted, not
 * assumed — `enemyDamage.test.js` runs both. It is transcribed because the
 * clamp is what makes the PIT path immediate: `Enemy.update`'s descent
 * already drove the same alpha to 0 over its own twenty ticks, so the first
 * `death()` after `fell` removes on its first call.
 */
export const MOBILE_DEATH_FADE = Object.freeze({
    alphaStep: 0.1,
    /** The count, derived by the same loop the game runs — see `fadeTicks`. */
    ticks: fadeTicks(1, 0.1),
    clamped: true,
    src: 'Mobile.as:60-72 + net/flashpunk/graphics/Image.as:155-158',
});

/** `Enemy.update`'s pit descent: `alpha -= fallAlphaSpeed` at 0.05. */
export const PIT_FADE = Object.freeze({
    alphaStep: 0.05,
    ticks: fadeTicks(1, 0.05),
    src: 'Enemies/Enemy.as:34 (fallAlphaSpeed), :91-102 (the descent)',
});

/**
 * How many calls of `alpha -= step` it takes before `alpha <= 0`.
 *
 * A LOOP, deliberately, and hoisted so both constants above are one
 * arithmetic step from the source. `Math.ceil(from / step)` is the closed
 * form and it is off by one for 0.1 — which is the whole point.
 */
export function fadeTicks(from, step) {
    if (!(step > 0)) fail(`fadeTicks: step must be positive, got ${step}`);
    let a = from;
    for (let n = 1; n <= 1000; n += 1) {
        // `Image.set alpha`'s clamp, applied to the write exactly as the
        // setter does — the getter then returns the clamped value.
        const next = a - step;
        a = next < 0 ? 0 : (next > 1 ? 1 : next);
        if (a <= 0) return n;
    }
    return fail(`fadeTicks: ${from} never reached 0 at step ${step} in 1000 ticks`);
}

/**
 * ⛔⛔⛔ THE POLICY, PER CLASS — AND THE LIFT IS PER CLASS TOO.
 *
 * `presses.PRESS_ARM_POLICY.Enemy` has been `refused` since R4 with one
 * reason for the whole family: *"a death moves totalEnemies(), which opens
 * tSet == -1 locks"*. That reason is CORRECT and it is not a reason to
 * refuse a class whose death provably moves nothing — which is exactly
 * `IceTurret`'s case, and exactly why this slice lifts one row rather than
 * the table.
 *
 * ⚠ AN ENUMERATION OVER `TOTAL_ENEMIES_CLASSES` PLUS THE OMISSIONS, checked
 * as one by `assertKillArmPolicyCovers`. "Everything not listed is refused"
 * is the safe-sounding rule and it is the one that let `BurnableTree` and
 * `BombPusher` fall out of the press census in slice 11: a default cannot
 * be diffed against the AS3.
 *
 * `modelled` — the run tracks the damage, the death staging and the
 *              `totalEnemies` consequence for this class
 * `refused`   — real, unmodelled, and a synthesis-time throw BY NAME
 * `inert`     — no press of any weapon can damage one; its `hit()` override
 *              is empty (`levelWorld.PRESS_UNKILLABLE` is the same three)
 */
export const KILL_ARM_POLICY = Object.freeze({
    IceTurret: Object.freeze({
        policy: 'modelled',
        why: '⛓ THE FIRST, AND IT IS THE ONE WHOSE DEATH COSTS THE LEDGER NOTHING. '
            + '`death()` intercepts the removal, so `classCount(IceTurret)` is unchanged '
            + 'and no `tset == -1` lock can move — the machinery still COMPUTES that nil '
            + 'rather than skipping the scan. Three plain-sword hits at `hitsMax` 3; NOT '
            + 'fire (`Enemy.hit`\'s `if (hitByFire || t != "Fire")` sends a fire hit to '
            + '`IceTurret`\'s empty `knockback` override). See `iceTurret.js` for the '
            + 'per-visit state and the corpse.',
    }),
    // ── the three whose `hit()` override is EMPTY ─────────────────────
    DarkTrap: Object.freeze({ policy: 'inert', why: 'Enemies/DarkTrap.as:56-59 — the body is empty' }),
    Grenade: Object.freeze({ policy: 'inert', why: 'Enemies/Grenade.as:70-71 — `{ }`; its hitsMax 1 is unreachable by a press' }),
    BombPusher: Object.freeze({ policy: 'inert', why: 'Enemies/BombPusher.as — `hit(...):void { }` on one line' }),
    // ── every other counted class, refused BY NAME ────────────────────
    /**
     * ⛔⛔ R8 SLICE 1 PAID HALF OF THIS ROW'S STATED DEBT AND THE ROW STAYS
     * `refused` — deliberately, and said out loud rather than left as an
     * omission.
     *
     * The row's own reason was *"modelling it needs the chaser's POSITION at
     * the press (`chasers.js` transcribes the walk but no route drives one)"*.
     * A route drives one now: `levelRun.stepChasersNow` walks the body every
     * tick and `r8-l6-bob-contact` proves the arithmetic against the game,
     * byte for byte. **That is the position, not the press.**
     *
     * ⛔ WHAT IS STILL OWED, and what a slice that flips this row has to
     * DRIVE rather than argue:
     *   · `Enemy.hit`'s five gates against a chaser (`hitsTimer`, the freeze,
     *     `canHit`, `onlyHitBy`, `hits < hitsMax`) — `enemyHit` owns them and
     *     nothing has ever handed it a bob;
     *   · the death as an ANIMATION — `startDeath` plays "die" WITHOUT
     *     setting `destroy` (`chasers.deathTicks` = 25 ticks for a bob), and
     *     `Game.totalEnemies()` counts the body for every one of them, so a
     *     kill lock opens ~25 ticks after the killing blow and not on it;
     *   · the `classCount` consequence IN A ROOM THAT HAS A KILL LOCK. L5 is
     *     exactly such a room and is exactly the room slice 1 could not step
     *     (`chaserRoomVerdict` refuses it — the arrows that do the killing
     *     there are unpriced).
     *
     * ⇒ a refusal retired without a driven witness is trap 101's shape, and
     * this slice's driven arm prices a CONTACT, not a press. It stays refused.
     */
    Bob: Object.freeze({
        policy: 'refused',
        why: 'a Bob death REMOVES the body (`endAnim` sets `destroy` after 25 ticks, then '
            + 'eleven of `Mobile.death`), so `classCount(Bob)` drops and every '
            + '`tset == -1` lock in the room can open. ⛓ R8 slice 1 paid the POSITION '
            + 'half — `levelRun.stepChasersNow` drives `chasers.chaserStep` and the game '
            + 'confirmed it byte-exact — and the row still refuses, because what a PRESS '
            + 'arm needs is the damage/death staging: `Enemy.hit`\'s five gates against a '
            + 'chaser, the 25-tick die ANIMATION during which `totalEnemies()` still '
            + 'counts the body, and the `classCount` move in a room that has a kill lock '
            + '(L5 — the one room the bridge cannot step). The L60 pair still shows the '
            + 'honest alternative: drive the kill in the game and read the lock off the '
            + 'stream.',
    }),
    BobSoldier: Object.freeze({ policy: 'refused', why: 'the Bob cost plus a shield state nobody has transcribed' }),
    BobBoss: Object.freeze({ policy: 'refused', why: 'boss damage — the encounter SCRIPT owns it (`bobBoss.js`), not a press arm' }),
    Flyer: Object.freeze({ policy: 'refused', why: 'the Bob cost, plus the LOS exemption (`v[i] is Flyer` skips the collideLine)' }),
    Jellyfish: Object.freeze({ policy: 'refused', why: 'the Bob cost with a 35-tick death anim; L60\'s pair drives two IN THE GAME' }),
    Cactus: Object.freeze({ policy: 'refused', why: 'the Bob cost; off every R5 route' }),
    SandTrap: Object.freeze({ policy: 'refused', why: 'the Bob cost; a static hazard whose volume `hazards.js` prices instead' }),
    // ⛓⛓⛓ R6 SLICE 5: THE SECOND `modelled` ROW, AND THE FIRST BOSS IN IT.
    ShieldBoss: Object.freeze({
        policy: 'modelled',
        why: '⛓ THE SHIELDSPIRE. `shieldBossFight.js` owns the encounter script — the '
            + 'swallowed first `hit()` as the fight\'s ARMING DISPATCH, the 120-update '
            + 'stand-under band, and `movedShield` as the only animation `super.hit` is '
            + 'reachable through. The damage half is THIS module\'s `enemyHit`, because '
            + '`ShieldBoss.hit`\'s window arm is a plain forward. ⛔ Its death REMOVES '
            + 'the body, so `classCount(ShieldBoss)` moves and every `tset == -1` lock '
            + 'in the room can open — the ledger consequence is computed, not skipped '
            + '(L19 has no such lock, and that nil is the assertion).',
    }),
    Spinner: Object.freeze({
        policy: 'refused',
        why: '⛔ AND ITS DEATH IS THE ONE THAT WRITES. `Spinner.removed()` is '
            + '`if (doActions) Game.setPersistence(tag, false)` — UNCONDITIONAL on its '
            + 'own tag — so a spinner kill is a LEDGER ENTRY as well as a `classCount` '
            + 'move. `spinner.js` transcribes the body\'s motion; the damage arm is '
            + 'refused until a route needs it and can declare both consequences.',
    }),
    WallFlyer: Object.freeze({ policy: 'refused', why: 'the Bob cost; off every R5 route' }),
    Puncher: Object.freeze({ policy: 'refused', why: 'the Bob cost; L40 has two and no leg presses either' }),
    Drill: Object.freeze({ policy: 'refused', why: 'the Bob cost; off every R5 route' }),
    Turret: Object.freeze({
        policy: 'refused',
        why: '⚠ NOT `IceTurret`, AND NOT ITS TWIN. A plain `Turret` has no `death()` '
            + 'override, so its kill DOES remove the body and DOES move `classCount`. '
            + 'Refused by name so the lift of the ice one cannot be read as covering it.',
    }),
    BossTotem: Object.freeze({ policy: 'refused', why: 'R6 — `hitsMax` 5 and `onlyHitBy = "Wand"`; the room opens on its death' }),
    Tentacle: Object.freeze({ policy: 'refused', why: 'D8; off this rung' }),
    TentacleBeast: Object.freeze({ policy: 'refused', why: 'D8; off this rung' }),
    LightBoss: Object.freeze({ policy: 'refused', why: 'boss damage — R6' }),
    LavaRunner: Object.freeze({ policy: 'refused', why: 'D7; the island stances are a slice-7 problem' }),
    Bulb: Object.freeze({
        policy: 'refused',
        why: '⛔ ITS DEATH WRITES A TILE. `Bulb.endAnim` turns the cell it dies on into '
            + 'LAVA for the visit (§5\'s standing rule: never kill one on a cell the '
            + 'route re-crosses), so the arm owes a terrain write as well as a count.',
    }),
    Squishle: Object.freeze({ policy: 'refused', why: 'off every R5 route' }),
    /**
     * ⛓⛓⛓ R6 SLICE 6f — THE THIRD `modelled` ROW, AND THE PLAYER NEVER DEALS
     * THE DAMAGE.
     *
     * The lift is one class wide and it is lifted IN THE SAME CHANGE that
     * integrates its consumer (`levelRun`'s Owl family), because a lifted
     * policy with no consumer is a silence and not a permission.
     *
     * ⛔ `onlyHitBy = "Lava"`, so no press can damage him at all — a sword
     * takes `Enemy.hit`'s `justKnock` arm and only SHOVES. All three hits are
     * `FinalBoss.update`'s own `hit(6, centre, 1, "Lava")`, fired when his
     * 12x12 box's FIRST overlapping `Tile` is `t == 17`. The player buys the
     * geometry; the room does the killing.
     *
     * ⛔⛔ AND THE DEATH MOVES `totalEnemies()` BY NOTHING — for
     * `IceTurret`'s reason with a stronger mechanism. `death()` is overridden
     * to an EMPTY BODY (not an intercept: there is no second call that ever
     * reaches `super.death()`), so `Mobile.death`'s fade never runs,
     * `FP.world.remove` is never called, and `classCount(FinalBoss)` is
     * exactly where the level build left it — forever. ⇒ no `tset == -1` lock
     * can move, and the machinery still COMPUTES that nil rather than
     * skipping the scan.
     *
     * ⛔⛔⛔ WHAT DOES OPEN L112 IS NOT THE COUNT. `endAnim`'s "dead" arm runs
     * `Button.activateAll(null, 0, true)` and TWO direct
     * `Game.setPersistence` writes — so `rocklock@112,16 {tset 0, tag 1}`
     * opens from the BUTTON SWEEP and `{112,1}` lands from its own line.
     * A ledger that read the room's opening off `totalEnemies()` would find
     * nothing and conclude nothing had happened.
     */
    FinalBoss: Object.freeze({
        policy: 'modelled',
        why: '⛓ THE THIRD, AND THE ONLY KILL ON THE LADDER THE PLAYER CANNOT DEAL. '
            + '`onlyHitBy = "Lava"` + `justKnock`: a press SHOVES (no `hitsTimer`, so '
            + 'the five tests compound until the 16 px reach loses him) and the lava '
            + 'self-hit kills, three times, one per pod cycle (`hitThisSequence` clears '
            + 'only on the tick `rockfallTime == 0`). `death()` is an EMPTY override, so '
            + 'the corpse is never removed and `classCount(FinalBoss)` never moves — the '
            + 'room opens from `endAnim`\'s `Button.activateAll(null, 0, true)` and its '
            + 'two direct persistence writes, not from the count. See '
            + '`finalBossFight.js` for the fight and `finalBossRng.js` for the schedule.',
    }),
    LavaBoss: Object.freeze({ policy: 'refused', why: 'R6/R7; not in the `totalEnemies` sum at all, and Solid to the player' }),
    LightBossController: Object.freeze({ policy: 'refused', why: 'an `Entity`, not a `Mobile` — it SPAWNS a LightBoss rather than being one' }),
    IceTrap: Object.freeze({ policy: 'refused', why: '`canHit = false` — unkillable AND uncounted; `hazards.js` prices the volume' }),
    LavaTrap: Object.freeze({ policy: 'refused', why: 'uncounted, and the L108 ferry is three of the nine — `r5Swim` owns them' }),
    /**
     * ⚠ THE BASE CLASS IS ITS OWN ROW, and it stays refused. `Game.as`'s sum
     * ends with `classCount(Enemy)`, so a bare `Enemy` would count; nothing
     * in the extract places one, which is a claim about the MAP rather than
     * about the class, so the row exists and refuses.
     */
    Enemy: Object.freeze({
        policy: 'refused',
        why: 'the base class. `totalEnemies()` sums `classCount(Enemy)` too, and nothing '
            + 'in the extract places a bare one — a fact about the map, not about the '
            + 'class, so this refuses rather than being absent.',
    }),
});

/**
 * The two tables partition the classes the press census can reach —
 * checked, not claimed.
 *
 * ⚠ THE §14 LAW: this is NOT a mutation table over a derivation this
 * module also owns. `TOTAL_ENEMIES_CLASSES` is transcribed in `combat.js`
 * from `Game.as:1788-1813` and `TOTAL_ENEMIES_OMISSIONS` from the
 * `Enemies/` directory; this asserts that `KILL_ARM_POLICY` covers both
 * lists and adds nothing they do not name. A class in the sum with no
 * policy row is a press this rung would silently allow.
 */
export function assertKillArmPolicyCovers() {
    const findings = [];
    const policy = new Set(Object.keys(KILL_ARM_POLICY));
    for (const c of TOTAL_ENEMIES_CLASSES) {
        if (!policy.has(c)) findings.push(`${c} is summed by totalEnemies() and has NO kill-arm policy row`);
    }
    for (const c of Object.keys(TOTAL_ENEMIES_OMISSIONS)) {
        if (!policy.has(c)) findings.push(`${c} is a named omission and has NO kill-arm policy row`);
    }
    for (const c of policy) {
        if (!TOTAL_ENEMIES_CLASSES.includes(c) && !(c in TOTAL_ENEMIES_OMISSIONS)) {
            findings.push(`${c} has a kill-arm policy row but is in neither combat.js table`);
        }
    }
    return findings;
}

/** The classes this rung will actually damage. */
export const MODELLED_KILL_ARMS = Object.freeze(
    Object.entries(KILL_ARM_POLICY).filter(([, p]) => p.policy === 'modelled').map(([c]) => c),
);

/**
 * ⛔⛔⛔ DOES A DEATH MOVE `classCount`, AND WHEN — PER CLASS.
 *
 * The question the refusal's own reason turns on, and the three shapes are
 * genuinely different:
 *
 *   `fade`      `startDeath` sets `destroy` and `Mobile.death()` fades the
 *               body out over `MOBILE_DEATH_FADE.ticks`. `classCount` drops
 *               at the removal.
 *   `anim+fade` the subclass OVERRIDES `startDeath` to play an animation
 *               WITHOUT setting `destroy`; its own `endAnim` sets it at the
 *               animation's end, and the fade follows. This is the shape
 *               `combatVerbs.killWindowTicks` models — minus the fade.
 *   `intercept` `death()` is overridden to consume the first `destroy`,
 *               so the body is NEVER removed by a kill. `classCount` does
 *               not move at all, and only a later self-destroy can move it.
 *
 * ⚠ `animTicks` is NOT duplicated here. `chasers.deathTicks` derives it
 * from the class's own `Spritemap.add` arguments, and a second copy is the
 * two-consumers failure this arc keeps paying for; the rows below carry
 * the TAG so a caller resolves it there.
 */
export const CORPSE_COUNTING = Object.freeze({
    IceTurret: Object.freeze({
        shape: 'intercept',
        removesBody: false,
        chaserTag: null,
        why: '`IceTurret.death()` — `if (destroy) { if (anim == "dead") super.death(); '
            + 'else { setHitbox(16,16,8,8); play("dead"); destroy = false; '
            + 'solids.push("Enemy","Player") } }`. The first call CONSUMES the destroy, '
            + 'so a kill leaves the entity in the world and `classCount(IceTurret)` '
            + 'exactly where it was. ⛔ The corpse is still a counted enemy.',
        laterRemovalBy: 'a fatal tile under the body — water or lava at REST or mid-glide '
            + '(`Enemy.update`\'s ungated `getState()` switch), or a pit. Then '
            + '`death()`\'s second call reaches `super.death()` and the eleven-tick fade '
            + 'runs — except from a pit, whose own twenty-tick descent has already driven '
            + 'the same alpha to zero, so that removal is immediate.',
        src: 'Enemies/IceTurret.as:135-151',
    }),
    Bob: Object.freeze({
        shape: 'anim+fade', removesBody: true, chaserTag: 'bob',
        why: '`startDeath` plays "die" and does NOT set `destroy`; `endAnim` does, at the '
            + 'animation\'s end. Then the fade.',
        src: 'Enemies/Bob.as:84-97',
    }),
    Jellyfish: Object.freeze({
        shape: 'anim+fade', removesBody: true, chaserTag: 'jellyfish',
        why: 'the same two-stage shape as Bob, with an eight-frame animation.',
        src: 'Enemies/Jellyfish.as:77-91',
    }),
    /**
     * ⛓⛓⛓ R6 SLICE 5. The same two-stage shape as Bob's — and the anim
     * length does NOT come from `chasers.deathTicks`, because a ShieldBoss
     * is not a chaser and has no row there. `chaserTag: null` with an
     * `anim+fade` shape is legal precisely because `removalTicksAfterHit`
     * takes the count as an ARGUMENT; the caller resolves it from
     * `shieldBossFight.SHIELD_BOSS_DIE_UPDATES`, which derives it from the
     * class's own `add("die", [9..19], 15)`.
     */
    ShieldBoss: Object.freeze({
        shape: 'anim+fade', removesBody: true, chaserTag: null,
        why: '`startDeath` is overridden to `Game.setPersistence(tag, false); play("die")` '
            + '— it writes the KILL FLAG and does NOT set `destroy`. `endAnim` sets it 23 '
            + 'graphic updates later, and the eleven-tick fade follows. ⛔ So the tag '
            + 'precedes the corpse by 23 and the corpse precedes the REMOVAL by 11, and '
            + 'the removal is the one that matters: the body is in `Mobile.solids` and '
            + 'the room\'s `bosskey` is inside it.',
        src: 'Enemies/ShieldBoss.as:62-66 (startDeath), :212-217 (endAnim)',
    }),
    /**
     * ⛓⛓⛓ R6 SLICE 6f: A FOURTH SHAPE, AND IT IS THE ONLY TERMINAL ONE.
     *
     * `intercept` says "the first `destroy` is consumed and a LATER one can
     * still remove the body". The Owl's `death()` is an EMPTY OVERRIDE: there
     * is no arm, no second call and no path to `super.death()` anywhere in
     * the class. The corpse is permanent, and — because `startDeath` also
     * writes `type = "Solid"` — it is a permanent WALL wherever the third
     * shove left him. `shape: 'never'` says exactly that.
     *
     * ⛔ `laterRemovalBy` IS `null` AND THAT IS A MEASUREMENT, NOT AN
     * OMISSION. `IceTurret`'s row names three routes to a second removal (a
     * fatal tile, a pit); the Owl has `dieInWater`, `dieInLava` and
     * `canFallInPit` all false, so `Enemy.update`'s terrain switch cannot set
     * `destroy` for him either — and `destroy` is already true, so his
     * `update()` returns above the switch in any case.
     */
    FinalBoss: Object.freeze({
        shape: 'never', removesBody: false, chaserTag: null,
        why: '`FinalBoss.death()` is `override public function death():void { }` — an '
            + 'EMPTY body, not an intercept. `Mobile.death`\'s fade never runs, '
            + '`FP.world.remove` is never called, and `classCount(FinalBoss)` never '
            + 'moves. ⛔ AND `startDeath` SETS `type = "Solid"`, so the corpse is a '
            + 'PERMANENT WALL at the third shove\'s endpoint — which is why a plan '
            + 'chooses where he dies. `dieInWater`/`dieInLava`/`canFallInPit` are all '
            + 'false, so no terrain can remove him later either.',
        laterRemovalBy: null,
        src: 'Enemies/FinalBoss.as:236-243 (death, startDeath), :52-64 (the ctor flags)',
    }),
    Spinner: Object.freeze({
        shape: 'fade', removesBody: true, chaserTag: null,
        why: '`Spinner` does NOT override `startDeath`, so `Enemy.startDeath` sets '
            + '`destroy` on the killing blow and the fade starts immediately. ⛔ And its '
            + '`removed()` writes `Game.setPersistence(tag, false)` — see `KILL_SIDE_WRITES`.',
        src: 'Enemies/Spinner.as:57-64 (removed); Enemies/Enemy.as:182-186 (startDeath)',
    }),
});

/**
 * ⛓⛓ HOW LONG FROM THE LANDED HIT TO `classCount` MOVING — the number
 * `combatVerbs.killWindowTicks` is eleven short of.
 *
 * @param {string} as3
 * @param {?number} deathAnimTicks `chasers.deathTicks(row.chaserTag)`,
 *   which the caller resolves so this module does not own a second copy of
 *   `animTicks`. Required for an `anim+fade` row, refused for the others.
 * @returns {?number} null when the class's kill removes NOTHING.
 */
export function removalTicksAfterHit(as3, deathAnimTicks = null) {
    const row = CORPSE_COUNTING[as3];
    if (!row) {
        fail(`removalTicksAfterHit: "${as3}" has no CORPSE_COUNTING row. A class whose `
            + 'death staging nobody has read cannot be given a window floor — '
            + 'transcribe it, or leave the arm refused.');
    }
    if (!row.removesBody) return null;
    if (row.shape === 'fade') {
        if (deathAnimTicks !== null) {
            fail(`removalTicksAfterHit: ${as3} is a \`fade\` row — it has no death `
                + 'ANIMATION stage, so passing one would add a wait the game does not take.');
        }
        return MOBILE_DEATH_FADE.ticks;
    }
    if (!Number.isInteger(deathAnimTicks) || deathAnimTicks <= 0) {
        fail(`removalTicksAfterHit: ${as3} is an \`anim+fade\` row, so it needs its death `
            + `animation's length from \`chasers.deathTicks('${row.chaserTag}')\`; got `
            + `${deathAnimTicks}.`);
    }
    return deathAnimTicks + MOBILE_DEATH_FADE.ticks;
}

/**
 * ⛓ WHAT A DEATH WRITES TO THE PERSISTENCE ARRAY, PER CLASS.
 *
 * `removed()` is the site for every class in this table but one — and
 * ⛔⛔ R6 SLICE 5 IS THE EXCEPTION THAT WIDENS THE PREMISE. `ShieldBoss`
 * writes from `startDeath`, i.e. inside the killing `hit()` itself, 34
 * ticks before `removed()` would run. "A class whose body is never removed
 * never writes" was true of the four rows this table opened with and it is
 * not a property of the mechanism; the `site` field is what carries the
 * difference now, and a caller that assumed `removed()` would be 34 ticks
 * late on the one row that matters most.
 *
 * ⚠ THE CLASSIFICATION EXTENDS `outOfBandLedger.OUT_OF_BAND_WRITERS`
 * RATHER THAN DUPLICATING IT: that module answers "which slot does a −1
 * land in", this one answers "does a KILL write at all". `Spinner` is in
 * this table and not in that one because every spinner in the committed
 * extract carries a tag ≥ 0 — the sentinel is reachable (`_tag:int = -1`
 * is its constructor default) and no map exercises it, which is a bounded
 * vacuity and is named as one.
 */
export const KILL_SIDE_WRITES = Object.freeze({
    IceTurret: Object.freeze({
        writes: 'none',
        why: 'there is no `removed()`, no `check()`, no `setPersistence` and no tag '
            + 'anywhere in `IceTurret.as` — and the body is not removed by a kill in any '
            + 'case. A turret kill is invisible to the ledger in BOTH directions.',
    }),
    Bob: Object.freeze({
        writes: 'none',
        why: '`removed()` is overridden to an EMPTY body (its only line is the commented '
            + '`//if(!fell) dropCoins();`), which is a stronger statement than "no '
            + 'override": the class was given one on purpose to drop the base behaviour.',
    }),
    Jellyfish: Object.freeze({
        writes: 'none',
        why: 'the same empty override as Bob, same commented line.',
    }),
    ShieldBoss: Object.freeze({
        writes: 'ownTag',
        site: 'startDeath',
        guard: null,
        why: '⛔ THE ONLY ROW WHOSE SITE IS NOT `removed()`. `startDeath` is '
            + '`Game.setPersistence(tag, false); sprShieldBoss.play("die")` — the flag '
            + 'is written by the killing HIT, with no `doActions` guard and no wait for '
            + 'the animation. `removed()` is not overridden at all, so the removal 34 '
            + 'ticks later writes nothing. ⇒ the kill witness is available immediately '
            + 'and the WALL is not.',
        sentinel: '`ShieldBoss(_x, _y, _tag:int = -1)`. A `<shieldboss>` with no `tag` '
            + 'would write OUT OF BAND through `i * 30 + j`; L19\'s carries `tag="0"` '
            + 'and it is the only instance in the extract, so the -1 arm is a bounded '
            + 'vacuity with no witness — named, not skipped.',
    }),
    /**
     * ⛓⛓⛓ R6 SLICE 6f: THE ONLY ROW THAT WRITES **TWO** FLAGS, and the only
     * one whose site is an ANIMATION CALLBACK rather than a method.
     *
     * `endAnim`'s `"dead"` arm — reached through the GRAPHIC, which
     * `World.update` advances whether or not the entity is active and whether
     * or not the world is frozen — spawns five more RockFalls, runs
     * `Button.activateAll(null, 0, true)`, and then writes
     * `setPersistence(tag)` AND `setPersistence(tag+1)`, guarded by one
     * `checkPersistence(tag)`.
     *
     * ⛔ SO THE TAG IS NOT AVAILABLE AT THE KILL. `startDeath` writes NOTHING
     * (it sets `type`, plays "die", clears the level music and sets
     * `destroy`), which is the exact opposite of the ShieldBoss row above:
     * there the tag PRECEDES the corpse by 23 ticks, here it FOLLOWS the
     * killing hit by 109 (`finalBossFight.finalBossDeathSchedule`). A window
     * that ends on the kill has killed him and witnessed nothing.
     *
     * ⛓ `removed()` has its own `setPersistence(tag)` and it is dead code for
     * this class twice over: it is guarded by `checkPersistence(tag)`, which
     * `endAnim` has already cleared, and `removed()` is never reached at all
     * because nothing removes the body.
     */
    FinalBoss: Object.freeze({
        writes: 'ownTag+1',
        site: 'endAnim("dead")',
        guard: 'checkPersistence(tag)',
        why: '⛔ TWO FLAGS FROM ONE ARM, 109 ticks after the third lava hit. `{112,0}` is '
            + 'the Owl and `{112,1}` is the RockLock, and the second is a DIRECT '
            + '`setPersistence(tag+1)` — not a consequence of the '
            + '`Button.activateAll(null, 0, true)` on the line above it, which is a '
            + 'separate mechanism that opens the same lock by its group. ⇒ the tag does '
            + 'not depend on the button sweep reaching anything.',
        sentinel: '`FinalBoss(_x, _y, _tag:int = -1)` and `endAnim` writes `tag` and '
            + '`tag+1` with no `>= 0` test — so a `<finalboss>` with no `tag` would '
            + 'write `{level,-1}` and `{level,0}`, i.e. one OUT OF BAND and one at a '
            + 'neighbour\'s address. L112\'s carries `tag="0"` and it is the only '
            + 'instance in the extract, so the -1 arm is a bounded vacuity with no '
            + 'witness — named, not skipped. ⚠ `check()` DOES test `tag >= 0`; the '
            + 'write does not.',
    }),
    Spinner: Object.freeze({
        writes: 'ownTag',
        site: 'removed',
        guard: 'doActions',
        why: '`removed()` is `if (doActions) Game.setPersistence(tag, false)`. `doActions` '
            + 'is only cleared by `check()` removing the entity at BUILD time, so a '
            + 'spinner that is alive to be killed always has it — the write is '
            + 'unconditional in practice.',
        sentinel: '`Spinner(_x, _y, _tag:int = -1)`, so a `<spinner>` with no `tag` '
            + 'attribute would write OUT OF BAND. Every spinner in the committed extract '
            + 'carries one (L40\'s three are 17, 18, 19), so the −1 arm is a bounded '
            + 'vacuity with no witness — named, not skipped.',
    }),
});

/**
 * A damage state for ONE body.
 *
 * ⚠ `as3` IS REQUIRED AND IS CHECKED AGAINST THE POLICY. A state built for
 * a class this rung refuses is a kill the model would predict and the
 * synthesis layer would never see — the refusal has to bite where the
 * state is BORN, not only where the press is authored.
 */
export function createEnemyDamage(as3, overrides = {}) {
    const p = KILL_ARM_POLICY[as3];
    if (!p) {
        fail(`createEnemyDamage: "${as3}" has no KILL_ARM_POLICY row. Every class the `
            + 'press census can reach is enumerated there; a missing row is a class '
            + 'nobody has classified, not a class that is safe.');
    }
    if (p.policy !== 'modelled') {
        fail(`createEnemyDamage: "${as3}" is \`${p.policy}\` — ${p.why}`);
    }
    const known = new Set(Object.keys(ENEMY_DAMAGE_DEFAULTS));
    for (const k of Object.keys(overrides)) {
        if (!known.has(k) || k === 'src') {
            fail(`createEnemyDamage: "${k}" is not a field of \`Enemy\`. A constructor `
                + 'override that names nothing is a transcription error wearing a '
                + `default. Known: [${[...known].filter((n) => n !== 'src').join(', ')}].`);
        }
    }
    const { src, ...fields } = ENEMY_DAMAGE_DEFAULTS;
    return {
        as3,
        ...fields,
        ...overrides,
        /** `startDeath` has run — for `fade`/`anim+fade`, `Mobile.destroy`. */
        dying: false,
        /** `Mobile.destroy`, which is NOT "removed" — see `MOBILE_DEATH_FADE`. */
        destroy: false,
        /** `(graphic as Image).alpha`, which is what actually removes a body. */
        alpha: 1,
        removed: false,
    };
}

/**
 * `Enemy.hit(f, p, d, t)`, verbatim and in order.
 *
 * Returns what HAPPENED rather than mutating silently, because four of the
 * five gates produce a different no-op and a leg that presses at nothing
 * needs to be told which one it hit. `state` is mutated in place (the
 * game's own shape) and the verdict describes the mutation.
 *
 * @param {object} state a `createEnemyDamage` state
 * @param {object} opts
 * @param {number} opts.d   damage — `Player.swordDamage` is 1, dark 2, spear 2
 * @param {number} opts.f   force, for `knockback`
 * @param {string} opts.t   the attack type: "Sword" | "Spear" | "Fire" | …
 * @param {boolean} opts.frozen `Game.freezeObjects`
 * @param {boolean} opts.reachable the SUBCLASS gate, if it has one —
 *   `IceTurret.hit` is entirely inside `if (currentAnim != "dead")`, so a
 *   corpse refuses every hit one level ABOVE `Enemy.hit`. Passed in rather
 *   than derived because it is a different class's business.
 * @returns {{landed, refusedAt, damaged, killed, knockedBack, hits, hitsTimer}}
 */
export function enemyHit(state, { d = 1, f = 0, t = '', frozen = false, reachable = true } = {}) {
    const no = (refusedAt) => ({
        landed: false, refusedAt, damaged: false, killed: false, knockedBack: false,
        hits: state.hits, hitsTimer: state.hitsTimer,
    });
    // ── the subclass gate, ABOVE `Enemy.hit` ──────────────────────────
    if (!reachable) return no('subclass — the override refused the call before `super.hit`');
    // `if (maxForce >= 0) f = Math.min(f, maxForce)`
    const force = state.maxForce >= 0 ? Math.min(f, state.maxForce) : f;
    // gate 1
    if (!((state.hitsTimer <= 0 || state.hitByDarkStuff) && !frozen && state.canHit)) {
        if (frozen) return no('frozen — `!Game.freezeObjects` is IN the gate, so damage is freeze-gated');
        if (!state.canHit) return no('canHit is false — unkillable by construction');
        return no(`i-frames — hitsTimer ${state.hitsTimer} > 0 and hitByDarkStuff is false`);
    }
    // gate 2
    if (!(state.onlyHitBy === '' || state.onlyHitBy === t)) {
        if (state.justKnock) {
            return { ...no(`onlyHitBy "${state.onlyHitBy}" != "${t}"`), knockedBack: true };
        }
        return no(`onlyHitBy "${state.onlyHitBy}" != "${t}"`);
    }
    // gate 3 — ⛔ the else-arm knocks back and does NOT spend an i-frame
    //          (`//hitsTimer = hitsTimerMax;` is commented out in the source)
    if (!(state.hitByFire || t !== 'Fire')) {
        return { ...no('t == "Fire" and hitByFire is false — the fire arm calls `knockback` only'), knockedBack: true };
    }
    // gate 4 — ⛔ NOT IN ANY BRIEF: a body already at hitsMax takes NOTHING,
    // not even an i-frame refresh. This is what makes a slack press a true
    // no-op instead of a second death.
    if (!(state.hits < state.hitsMax)) {
        return no(`hits ${state.hits} >= hitsMax ${state.hitsMax} — already dying; no damage, `
            + 'no knockback, no i-frame');
    }
    state.hits += d;
    state.hitsTimer = state.hitsTimerMax;
    // ⛓ THE LATCH IN GATE 1, set on every damaging hit.
    state.hitByDarkStuff = (t === 'Shield' || t === 'Suit');
    if (state.hits >= state.hitsMax) {
        // `startDeath(t)` — the BASE version sets `destroy`; a subclass that
        // overrides it (Bob, Jellyfish) plays an animation instead, and the
        // caller stages that. `dying` is the fact both shapes share.
        state.dying = true;
        const shape = CORPSE_COUNTING[state.as3]?.shape ?? 'fade';
        if (shape === 'fade' || shape === 'intercept') state.destroy = true;
        return {
            landed: true, refusedAt: null, damaged: true, killed: true, knockedBack: false,
            hits: state.hits, hitsTimer: state.hitsTimer, force,
        };
    }
    return {
        landed: true, refusedAt: null, damaged: true, killed: false, knockedBack: true,
        hits: state.hits, hitsTimer: state.hitsTimer, force,
    };
}

/**
 * `Enemy.hitUpdate()` — ONE tick of the i-frame timer.
 *
 * ⛔ IT IS NOT FREEZE-GATED, and the asymmetry is the finding: `Enemy.hit`
 * carries `!Game.freezeObjects` inside its own gate, but `hitUpdate` is
 * reached from `Enemy.update`'s tail, which only ever returns early for
 * `onScreen` and for the pit descent. So during a ceremony an enemy CANNOT
 * be damaged and its i-frames DO run down — the two halves of "frozen" go
 * opposite ways.
 *
 * ⚠ AND OFF SCREEN NEITHER RUNS. `Enemy.update`'s first line returns when
 * `!activeOffScreen && !onScreen()`, above everything, so an off-camera
 * body's timer is FROZEN. `combat.js`'s header says this; it is repeated
 * here because a cadence computed from the timer is wrong the moment the
 * camera loses the target.
 *
 * @param {object} ctx
 * @param {boolean} ctx.onScreen  `Entity.onScreen()` for this body
 * @param {boolean} ctx.destroy   `Enemy.update` calls it under `if (!destroy)`
 */
export function enemyHitUpdate(state, { onScreen = true } = {}) {
    if (!(state.activeOffScreen || onScreen)) return state;
    // `Enemy.update`'s own `if (!destroy) { hitUpdate(); hitPlayer(); }`
    if (state.destroy) return state;
    if (state.hitsTimer > 0) state.hitsTimer -= 1;
    return state;
}

/**
 * `Mobile.death()` — one call, and it is called EVERY tick `mobileUpdate`
 * runs, not once.
 *
 * @param {object} state
 * @param {?function} intercept the subclass's own `death()` override.
 *   `(state) => boolean` — return true when the override CONSUMED the
 *   destroy (which is `IceTurret`'s whole mechanism) so the fade does not
 *   start. Absent means `Mobile.death()` verbatim.
 */
export function mobileDeath(state, intercept = null) {
    if (!state.destroy) return state;
    if (intercept && intercept(state)) return state;
    const next = state.alpha - MOBILE_DEATH_FADE.alphaStep;
    state.alpha = next < 0 ? 0 : (next > 1 ? 1 : next);
    if (state.alpha <= 0) state.removed = true;
    return state;
}

/**
 * `Game.totalEnemies()` over a live roster.
 *
 * ⛔ THE ARGUMENT IS BODIES, NOT KILLS. `classCount` counts entities in the
 * world's list, so a body that is DEAD, DYING, mid-animation or mid-fade
 * still counts and a body that was never built does not. The one way to
 * get this wrong is to subtract kills from a census total, which is why
 * this takes the roster.
 *
 * @param {Array<{as3: string, removed?: boolean}>} bodies
 */
export function totalEnemiesOf(bodies) {
    if (!Array.isArray(bodies)) fail('totalEnemiesOf: pass the live roster, not a count');
    let n = 0;
    for (const b of bodies) {
        if (!b || typeof b.as3 !== 'string') {
            fail(`totalEnemiesOf: every body needs an \`as3\`, got ${JSON.stringify(b)}`);
        }
        if (b.removed) continue;
        if (TOTAL_ENEMIES_CLASSES.includes(b.as3)) n += 1;
    }
    return n;
}

/**
 * ⛔⛔⛔ THE KILL-LOCK LEDGER — AND IT COMPUTES THE NIL, IT DOES NOT SKIP
 * THE SCAN.
 *
 * `Lock.update()` is `super.update(); checkEnemies(); activationStep();`
 * and `checkEnemies()` is `if (tSet == -1 && totalEnemies() == 0) activate
 * = true`. Two things follow that a "does this room have kill locks" test
 * would miss:
 *
 *   · the comparison is `== 0`, over the WHOLE WORLD's counted classes —
 *     not "the enemies near the lock" and not "the enemies the route met";
 *   · `activate` is a LATCH into `activationStep`, whose fade is
 *     `alpha -= 0.01` — a hundred ticks — before `turnOff()` writes
 *     `Game.setPersistence(tag, false)`. So the LEDGER entry a kill lock
 *     produces lands 100 ticks after the count reaches zero, not on it.
 *
 * ⚠ AND THE ANSWER FOR L40 IS NIL, WHICH IS WHY THIS IS ARITHMETIC AND NOT
 * A SHRUG. Every lock in L40 is a `wandlock` with `tset` 0–5 and the one
 * `bosslock` is `keyType`-2, so `killLocksIn` returns EMPTY and no kill in
 * that room can open anything. The machinery still runs the scan and
 * ASSERTS the empty set, because "there were no kill locks" and "nobody
 * looked" print the same thing.
 * [[feedback_bounded_sweep_must_name_what_it_bounded]]
 *
 * @param {object} levelRecord the atlas record for the room
 * @param {object} opts
 * @param {Array} opts.bodiesBefore the live roster before the kill
 * @param {Array} opts.bodiesAfter  the live roster after it
 * @param {?function} opts.placementOf `killLocksIn`'s census hook
 * @returns {{level, locks, totalBefore, totalAfter, moved, opens, nil, why}}
 */
export function killLockLedger(levelRecord, { bodiesBefore, bodiesAfter, placementOf } = {}) {
    if (!levelRecord || !Array.isArray(levelRecord.entities)) {
        fail('killLockLedger: pass the level RECORD — the scan is over its entities, and '
            + 'an absent record would return an empty lock list that reads like a nil.');
    }
    const locks = killLocksIn(levelRecord, { placementOf });
    const totalBefore = totalEnemiesOf(bodiesBefore ?? []);
    const totalAfter = totalEnemiesOf(bodiesAfter ?? []);
    const wasZero = totalBefore === 0;
    const isZero = totalAfter === 0;
    const opens = (!wasZero && isZero) ? locks : [];
    return {
        level: levelRecord.level ?? null,
        locks,
        totalBefore,
        totalAfter,
        moved: totalAfter !== totalBefore,
        opens,
        /** ⛓ The claim, and it is a CONJUNCTION so a caller can assert it whole. */
        nil: opens.length === 0,
        why: locks.length === 0
            ? `the room holds NO tset ${KILL_LOCK_TSET} lock of any of `
                + `[${KILL_LOCK_TAGS.join(', ')}], so no death in it can open one — `
                + 'scanned, not assumed'
            : (isZero
                ? (wasZero
                    ? `${locks.length} kill lock(s), and totalEnemies() was ALREADY 0 `
                        + 'before this death — they were open already'
                    : `${locks.length} kill lock(s) OPEN: totalEnemies() went `
                        + `${totalBefore} -> 0`)
                : `${locks.length} kill lock(s) stay shut: totalEnemies() is still `
                    + `${totalAfter}`),
        /** ⛓ The fade between the count reaching zero and the ledger write. */
        ledgerWriteAfterTicks: LOCK_ACTIVATION_FADE_TICKS,
    };
}

/**
 * `Lock.activationStep()`'s fade — how many ticks from `activate` latching
 * to `turnOff()` writing the persistence flag.
 *
 * ⚠ NOT COMPUTED HERE. `activators.opensOnTick` owns the answer and owns
 * the reason it is 101 rather than 100 (the `alpha > 0` test runs BEFORE
 * the decrement, so `turnOff` lands the tick after the alpha reaches zero).
 * This module needs the number to say WHEN a kill's ledger entry appears;
 * it does not get to have its own.
 */
export const LOCK_ACTIVATION_FADE_TICKS = opensOnTick(RESPONDERS.lock.fade);
