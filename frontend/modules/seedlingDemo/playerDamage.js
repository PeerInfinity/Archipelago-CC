/**
 * seedlingDemo/playerDamage — `Player.hit()`, `knockback()`, `hitUpdate()`
 * and `die()`, transcribed. The half of `noDamage` that is a MODEL.
 *
 * Region-atlas Phase 8, subtractive ladder rung R6, slice 3. Brief:
 * the R6 kickoff §3.4 part 1, §8.8, §8.9.
 *
 * ── WHAT THIS RETIRES ─────────────────────────────────────────────────
 *
 * Every tape from R0 to R5 was recorded with `Bot.noDamage` ON, and R0's
 * bounded-vacuity table carried the reason: with the guard on, "the walk
 * was contact-free" and "the guard swallowed every contact" produce the
 * SAME stream, so the model was never asked which one it was. R5's
 * contact-control pair (`contactControl.test.js`) is the positive control
 * that told them apart, and it closed with an IOU: its live arm asserts the
 * SIGNATURE of the divergence (the impulse points away, friction decays it,
 * the walk never re-accelerates east) because the model could not produce
 * the numbers. This module is the numbers.
 *
 * ── THE THREE FACTS THE SOURCE WILL MISLEAD YOU ABOUT ─────────────────
 *
 * 1. **`Bot.noDamage` guards the WHOLE BODY, and that is not the same as
 *    "the contact does nothing".** `Player.hit`'s first line is
 *    `if (Bot.noDamage) return`, so the flag buys no sound, no shake, no
 *    `hits`, no i-frames, no knockback and no `die()`. But the callers
 *    around it are NOT guarded: `IceTurretBlast` calls `Player.freeze(15)`
 *    on the line ABOVE its `hit`, and `Enemy.hitPlayer` has already run its
 *    own `hitsTimer` gate. ⇒ the flag switches between two different things
 *    a contact does, never between something and nothing.
 *    [[feedback_nodamage_prices_damage_not_freeze]]
 *
 * 2. **⛔ THE KNOCKBACK'S TWO AXES USE DIFFERENT COMPARATORS.**
 *    `Player.knockback` is
 *
 *        if (Math.abs(center.x) >= 0.5) v.x += f * center.x;
 *        if (Math.abs(center.y) >  0.5) v.y += f * center.y;
 *
 *    — `>=` on x and `>` on y (`Player.as:1500,1504`). On the unit circle
 *    that is one point per quadrant: a contact at exactly 30° above the
 *    horizontal gives `|center.y| == 0.5` EXACTLY and the y impulse is
 *    dropped while the x impulse lands. It reads like a typo and it is the
 *    behaviour, so it is transcribed with the asymmetry intact and
 *    `KNOCKBACK_COMPARATORS` names it. ⚠ `Enemy.knockback` is a DIFFERENT
 *    function (`atan2` + `cos`/`sin`, no threshold at all) — the two are
 *    not variants of one rule and `enemyKnockback` lives in `spinner.js`.
 *
 * 3. **⛔ THE i-FRAME WINDOW COSTS EXACTLY 20 TICKS OF STEERING, AND THE
 *    COUNT IS AN ORDERING FACT.** `Player.input()` wraps its four arrow
 *    branches in `if (hitsTimer <= 0)` (`Player.as:1524`) while
 *    `hitUpdate()` — the decrement — runs BELOW `super.update()` in
 *    `Player.update` (`:1580`). So on the hit tick the enemy sets the timer
 *    to 20 before the player's `input()` ever reads it, and the tick that
 *    finally decrements it to 0 is the 20th. Ticks T..T+19 steer nothing;
 *    T+20 steers again. `iFrameSteeringSpan()` derives that rather than
 *    stating it.
 *
 * ── THE ORDER WITHIN A TICK, WHICH IS THE WHOLE OF "WHEN" ─────────────
 *
 * `World.addUpdate` PREPENDS and `loadlevel` adds the player before the
 * enemies, so THE ENEMIES UPDATE FIRST (the settled order — see
 * `seedling-bot.md`'s transitions contract, and R5's pair measured it: the
 * overlap exists in observation 49 and the position first moves in 50).
 * One tick therefore runs:
 *
 *   1. `Enemy.update` → `hitPlayer()` → `Player.hit(...)`
 *        → `hits += d`, `hitsTimer = 20`, `Game.shake += 5`,
 *          then EITHER `die()` OR `knockback(f, p)` — never both.
 *   2. `Player.update` → `super.update()` = `friction(); input(); moveX; moveY`
 *        — so the impulse written in step 1 is FRICTIONED ON THE SAME TICK,
 *          and `input()` finds `hitsTimer == 20` and steers nothing.
 *   3. `Player.update` → `sprites(); hitUpdate(); checkFallingInPit();`
 *        — `hitUpdate` decrements 20 → 19.
 *
 * ⚠ And step 2 is skipped entirely when step 1 killed: `Player.update` runs
 * `super.update()` under `if (!dying)`, and `die()` sets `dying = true`. So
 * the death tick has NO friction, NO input and NO movement — the player
 * stands exactly where the hit found them while the world swap is pending.
 *
 * ── ⛓ FREEZE: THE TWO HALVES GO OPPOSITE WAYS (§10.6, one class on) ───
 *
 * `Player.hit`'s gate is `hitsTimer <= 0 && hits < hitsMax &&
 * !Game.freezeObjects`, so a contact that lands inside a ceremony pays
 * NOTHING — no damage, no shake, no knockback, and no i-frames either. But
 * `hitUpdate()` sits outside `super.update()`, which is the only thing the
 * freeze gates, so an i-frame window ALREADY OPEN keeps running down
 * through the ceremony. A schedule that leans on "the hit is suppressed
 * while frozen" and a schedule that leans on "the window survives the
 * ceremony" are both right, about different halves.
 * [[feedback_freeze_gates_are_not_uniform]]
 */

import { PROFILE } from './seedlingProfile.js';

/**
 * `Player.darkSuitForce` / `Player.darkSuitDamage` (`Player.as:255-256`) — the
 * dark suit's retaliation, `e.hit(darkSuitForce, new Point(x, y),
 * darkSuitDamage, "Suit")`, which `Player.hit` makes on the attacker `e` inside
 * its own gate and above `hits += d` (R1-swim D1).
 */
export const DARK_SUIT_FORCE = PROFILE.darkSuitForce;
export const DARK_SUIT_DAMAGE = PROFILE.darkSuitDamage;

/**
 * `Player.as:325-337` — the constants, each with its line.
 *
 * ⚠ `hitsMax` is NOT here. It is `Main.hitsMax`, a static the `health`
 * pickup ADDS to (`hitsMaxDef` 3 + 1 per heart), so it is a RUN value the
 * caller passes in — the same thing `tapeFormat`'s inventory mirror and
 * `botStatus.items.hitsMax` carry. A constant here would be the fourth
 * place that number is written down and the first one that could rot.
 */
export const PLAYER_DAMAGE = Object.freeze({
    /** `hitsTimerMax` — the i-frame window, in ticks (`Player.as:336`). */
    hitsTimerMax: 20,
    /** `hitsTimerInt` — the flash period; cosmetic, and the ONLY consumer
     *  of `hitsTimer % n` (`Player.as:337`, used at `:1406`). */
    hitsTimerInt: 10,
    /** `hitsMaxDef` — a fresh save's `hitsMax` (`Player.as:325`). */
    hitsMaxDef: 3,
    /**
     * `Game.shake += 5` (`Player.as:1389`).
     *
     * ⛔ AN ADDITION. The other two writers on this rung's roster ASSIGN
     * (`BossTotem.laserStep`'s `= 30`, `removed()`'s `= 60`), so three
     * writers use two operators and a model that read all three as `=`
     * would lose every second hit's contribution. §8.9's own correction to
     * R5 §34.3; `SHAKE_WRITERS` in `camera.js` is the table.
     */
    shakePerHit: 5,
    /**
     * `Enemy.hitPlayer`'s force (`Enemies/Enemy.as:218`,
     * `p.hit(this, 3, new Point(x, y), damage)`).
     *
     * ⚠ THE BASE CLASS's contact force, which is what a body contact costs
     * — NOT a per-class field. The classes that pass their own
     * (`Puncher.punchForce`, `Spinner.hitForce`, `BossTotem`'s `force`)
     * override the CALL, not this number.
     */
    contactForce: 3,
});

/**
 * ⛔ THE COMPARATORS, AS DATA — because the asymmetry is the kind of thing
 * a reader "fixes" while transcribing.
 *
 * `x` is `>=` and `y` is `>`, verbatim from `Player.as:1500` and `:1504`.
 * `knockbackAxisLands` is the ONE implementation both `applyKnockback` and
 * the test read, so a mutation to either comparator is visible.
 */
export const KNOCKBACK_COMPARATORS = Object.freeze({
    x: '>=', y: '>', threshold: 0.5,
    src: 'Player.as:1498-1506',
    why: 'the y branch drops an impulse the x branch would keep, at exactly '
        + '|component| == 0.5 — one direction per quadrant on the unit circle',
});

export class PlayerDamageError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PlayerDamageError';
    }
}

const fail = (message) => { throw new PlayerDamageError(message); };

/**
 * A fresh `Player`'s damage state.
 *
 * ⚠ EVERY FIELD IS AN INSTANCE INITIALISER, which is why a world swap
 * resets all four: `arriveIn` builds a whole new `Player` and so does
 * `restartLevel`. The one thing that survives is `hitsMax`, which lives on
 * `Main` — see `PLAYER_DAMAGE`'s note.
 *
 * `directionFace` is `-1` for "not set" (`Player.as:63`): `knockback`
 * parks the pre-hit facing there and `hitUpdate` hands it back when the
 * window closes.
 */
export function createPlayerDamage() {
    return { hits: 0, hitsTimer: 0, directionFace: -1 };
}

/**
 * `Math.abs(component) >= 0.5` on x, `> 0.5` on y — the one place either
 * comparator is written.
 *
 * @param {'x'|'y'} axis
 * @param {number} component the NORMALIZED component (|center| == 1)
 */
export function knockbackAxisLands(axis, component) {
    const a = Math.abs(component);
    if (axis === 'x') return a >= KNOCKBACK_COMPARATORS.threshold;
    if (axis === 'y') return a > KNOCKBACK_COMPARATORS.threshold;
    return fail(`knockbackAxisLands: axis must be "x" or "y", got ${JSON.stringify(axis)}`);
}

/**
 * `Player.knockback(f, p)` — the impulse, as a velocity DELTA.
 *
 * ```
 *   var center:Point = new Point(x - p.x, y - p.y);
 *   center.normalize(1);
 *   if (Math.abs(center.x) >= 0.5) v.x += f * center.x;
 *   if (Math.abs(center.y) >  0.5) v.y += f * center.y;
 * ```
 *
 * ⛔ `Point.normalize` ON A ZERO-LENGTH POINT IS A NO-OP, not a NaN and not
 * a throw: the runtime's `point_normalize` is guarded by AS3's `if (length)`
 * truthiness (`SWFModernRuntime/src/avm2/avm2_globals.c:1026`, skipping 0
 * AND NaN). So a player standing at EXACTLY the attacker's origin keeps
 * `center == (0,0)`, both comparators see 0, and the contact costs a heart
 * with no impulse at all. Modelled rather than refused, because a static
 * 16x16 body and a 4x5 player centred in the same cell is an ordinary
 * stance, not a corner case.
 *
 * ⚠ RETURNS THE DELTA, NOT THE VELOCITY. The caller owns `v`, and the two
 * axes are independent — a delta of `{x: 3, y: 0}` and "the y impulse was
 * dropped" are the same fact, which is what `landed` says out loud.
 *
 * @param {{x:number,y:number}} at   the PLAYER's position
 * @param {{x:number,y:number}} from `p` — the attacker's `new Point(x, y)`
 * @param {number} f the force
 */
export function knockbackDelta(at, from, f) {
    let cx = at.x - from.x;
    let cy = at.y - from.y;
    const length = Math.sqrt(cx * cx + cy * cy);
    // `if (length)` — zero and NaN both skip, leaving `center` untouched.
    if (length !== 0 && !Number.isNaN(length)) {
        const norm = 1 / length;
        cx *= norm;
        cy *= norm;
    }
    const landedX = knockbackAxisLands('x', cx);
    const landedY = knockbackAxisLands('y', cy);
    return {
        dx: landedX ? f * cx : 0,
        dy: landedY ? f * cy : 0,
        landed: { x: landedX, y: landedY },
        center: { x: cx, y: cy },
    };
}

/**
 * `Player.hit(e, f, p, d)` — the whole body, in one call.
 *
 * ```
 *   if (Bot.noDamage) return;
 *   if (hitsTimer <= 0 && hits < hitsMax && !Game.freezeObjects)
 *   {
 *       if (e && hasDarkSuit) e.hit(darkSuitForce, new Point(x,y), darkSuitDamage, "Suit");
 *       Music.playSound("Hurt");
 *       hits += d;
 *       hitsTimer = hitsTimerMax;
 *       Game.shake += 5;
 *       if (hits >= hitsMax) die(); else knockback(f, p);
 *   }
 * ```
 *
 * @param {object} s        `{hits, hitsTimer, directionFace}`
 * @param {object} o
 * @param {number} o.hitsMax   the RUN's `Main.hitsMax`
 * @param {number} [o.force]   `f`
 * @param {number} [o.damage]  `d` (⚠ a NUMBER — `WandShot` is 0.5 against
 *                             an enemy, and `checkDrowning`'s lava call is
 *                             `hit(null, 0, null, 0)`: damage ZERO, which
 *                             still burns the i-frames and still shakes)
 * @param {{x:number,y:number}} [o.from] `p`; `null` means no knockback at
 *                             all (the AS3 `if (p)` arm)
 * @param {{x:number,y:number}} [o.at]   the player's position
 * @param {number} [o.direction] the facing, for `directionFace`
 * @param {boolean} [o.noDamage] `Bot.noDamage`
 * @param {boolean} [o.frozen]   `Game.freezeObjects`
 * @param {boolean} [o.hasDarkSuit] `Player.hasDarkSuit`
 * @param {boolean} [o.byEnemy] the AS3 call's `e != null` — `true` when the
 *   source passes `this` (a body contact, a punch, a hammer), `false` when it
 *   passes `null` (every projectile, trap and hazard). ⛔ NO DEFAULT under the
 *   dark suit: a source that has not declared which it is would decide whether
 *   an enemy takes damage, so an undeclared one is refused by name.
 * @returns {{state:object, applied:boolean, died:boolean, shakeDelta:number,
 *            knockback:{dx:number,dy:number}|null, refusedAt:string|null,
 *            retaliates:boolean}} `retaliates` — the dark suit's
 *            `e.hit(darkSuitForce, playerPoint, darkSuitDamage, "Suit")` is
 *            owed to the attacker; the CALLER makes it (this module owns no
 *            enemy). The game makes it before `hits += d`; the two writes touch
 *            disjoint state and read only the player's position, which a hit
 *            does not move, so their order inside the call is not observable.
 */
export function playerHit(s, {
    hitsMax, force = 0, damage = 1, from = null, at = null, direction = null,
    noDamage = false, frozen = false, hasDarkSuit = false, byEnemy = undefined,
} = {}) {
    if (!Number.isFinite(hitsMax)) {
        fail('playerHit: `hitsMax` is the RUN\'s `Main.hitsMax` and has no default here — '
            + 'the `health` pickup ADDS to it, so a hard-coded 3 would silently price a '
            + `four-heart run as a three-heart one. Got ${JSON.stringify(hitsMax)}`);
    }
    const nothing = (refusedAt) => ({
        state: s, applied: false, died: false, shakeDelta: 0, knockback: null, refusedAt,
        retaliates: false,
    });
    // `if (Bot.noDamage) return` — the FIRST line, above everything.
    if (noDamage) return nothing('Bot.noDamage');
    // ⚠ The three-term gate, in source order. `frozen` last because that is
    // where it sits, and because §10.6's finding is exactly that this gate
    // has it while the wand's animation does not.
    if (s.hitsTimer > 0) return nothing('hitsTimer');
    if (!(s.hits < hitsMax)) return nothing('hits >= hitsMax');
    if (frozen) return nothing('Game.freezeObjects');
    // ⛓⛓⛓ R1-swim D1 — `if (e && hasDarkSuit) e.hit(darkSuitForce, new
    // Point(x, y), darkSuitDamage, "Suit")`, INSIDE the gate above: a hit the
    // player's own i-frame swallows retaliates nothing.
    if (hasDarkSuit && byEnemy === undefined) {
        fail('playerHit: `hasDarkSuit` retaliates INTO the attacker when the call passes '
            + '`e` (`e.hit(darkSuitForce, …, "Suit")`) and not when it passes `null` — and '
            + 'this source has not declared which it is (`byEnemy`). Refused by name '
            + 'rather than guessed: the answer decides whether an enemy takes damage.');
    }
    const retaliates = hasDarkSuit && byEnemy === true;
    const hits = s.hits + damage;
    const next = { ...s, hits, hitsTimer: PLAYER_DAMAGE.hitsTimerMax };
    if (hits >= hitsMax) {
        // `die()` — and NO knockback. The two are the arms of one `if`, so a
        // model that applied the impulse and then noticed the death would
        // give a corpse a velocity the game never wrote.
        return {
            state: next,
            applied: true,
            died: true,
            shakeDelta: PLAYER_DAMAGE.shakePerHit,
            knockback: null,
            refusedAt: null,
            retaliates,
        };
    }
    if (from === null) {
        // `knockback`'s own `if (p)`: no point, no impulse and no
        // `directionFace` either. `Pulser` and the lava arm both call this way.
        return {
            state: next,
            applied: true,
            died: false,
            shakeDelta: PLAYER_DAMAGE.shakePerHit,
            knockback: { dx: 0, dy: 0, landed: { x: false, y: false }, center: null },
            refusedAt: null,
            retaliates,
        };
    }
    if (at === null) {
        fail('playerHit: a knockback needs the PLAYER\'s position (`at`) as well as the '
            + 'attacker\'s (`from`) — `center` is `new Point(x - p.x, y - p.y)` and there '
            + 'is no defensible default for the left operand.');
    }
    // ⚠ `hitsTimer > 0` is tested AFTER the assignment above, so it is
    // ALWAYS true here and `directionFace` is ALWAYS written. Transcribed as
    // the unconditional it is, with the condition named — reading the AS3
    // line in isolation suggests a branch that cannot be taken.
    const kb = knockbackDelta(at, from, force);
    return {
        state: {
            ...next,
            directionFace: direction === null ? next.directionFace : direction,
        },
        applied: true,
        died: false,
        shakeDelta: PLAYER_DAMAGE.shakePerHit,
        knockback: kb,
        refusedAt: null,
        retaliates,
    };
}

/**
 * `Player.hitUpdate()` — the decrement, and the facing it hands back.
 *
 * ```
 *   Game.health(hits, hitsMax);          // HUD only
 *   if (hitsTimer > 0) {
 *       if (hitsTimer % hitsTimerInt == 0) …flash…   // cosmetic
 *       hitsTimer--;
 *       if (hitsTimer <= 0) { …colour…; direction = directionFace; directionFace = -1; }
 *   }
 * ```
 *
 * ⚠ RUNS THROUGH A FREEZE. It sits below `super.update()` in
 * `Player.update`, and `Game.freezeObjects` gates only what is INSIDE
 * `mobileUpdate` — so a ceremony that suppresses the hit does not suspend
 * the window an earlier hit opened.
 *
 * @returns {{state:object, recovered:boolean, direction:number|null}}
 *          `direction` is non-null only on the recovery tick, and it is the
 *          value `Player.direction` is ASSIGNED (which is `-1` — "unset" —
 *          when the window was opened by a `p == null` hit that never wrote
 *          `directionFace`).
 */
export function stepPlayerDamage(s) {
    if (!(s.hitsTimer > 0)) return { state: s, recovered: false, direction: null };
    const hitsTimer = s.hitsTimer - 1;
    if (hitsTimer > 0) {
        return { state: { ...s, hitsTimer }, recovered: false, direction: null };
    }
    return {
        state: { ...s, hitsTimer, directionFace: -1 },
        recovered: true,
        direction: s.directionFace,
    };
}

/**
 * The steering gate: `Player.input()`'s four arrow branches are inside
 * `if (hitsTimer <= 0)`.
 *
 * ⚠ ONLY the arrows. The waterfall acceleration, the two `useItem` presses
 * and the bandcamp key are all BELOW the block and run regardless — so a
 * player in i-frames can still swing a sword and still be pushed by a
 * waterfall. A model that gated `input()` wholesale would silently disarm
 * every press in a fight.
 */
export function canSteer(s) {
    return s.hitsTimer <= 0;
}

/**
 * How many consecutive ticks lose their steering, DERIVED from the two
 * orderings rather than stated.
 *
 * The hit lands during the enemies' update (step 1 above), so tick T's own
 * `input()` already sees the full window; `hitUpdate` runs after the move,
 * so the window is 20, 19, … 1 across T..T+19 and 0 from T+20. Simulated
 * here with the SAME two functions the run uses, so a mutation to either
 * moves this number.
 */
export function iFrameSteeringSpan() {
    let s = playerHit(createPlayerDamage(), {
        hitsMax: PLAYER_DAMAGE.hitsMaxDef, force: PLAYER_DAMAGE.contactForce,
        from: { x: 0, y: 0 }, at: { x: 8, y: 0 }, direction: 3,
    }).state;
    let span = 0;
    // The hit tick itself: `input()` runs before `hitUpdate()`.
    while (!canSteer(s)) {
        span += 1;
        s = stepPlayerDamage(s).state;
    }
    return span;
}

/**
 * ⛔⛔ A DEATH IS A GAME-INITIATED WORLD REBOOT (§8.8) — the shape, as data.
 *
 * `Player.die()` is `dying = true; (FP.world as Game).restartLevel();` and
 * `restartLevel()` is `FP.world = new Game(level, playerPosition.x,
 * playerPosition.y)`. Three consequences, none of them optional:
 *
 * 1. **The destination is the level's OWN entry point, not the death
 *    position.** `playerPosition` is written once, by the `Game`
 *    constructor, from ITS OWN ARGS (`Game.as:624`) — the boot coordinates,
 *    or the teleporter's `to` attrs, or `checkFallingInPit`'s ctor pair. It
 *    is never updated by walking. ⚠ And the `<player>` object arm of
 *    `loadlevel` (`Game.as:2088`) cannot fire: NO level in the checkout has
 *    one (`grep -rl '<player' assets/levels` = 0), so the ctor args are the
 *    whole story.
 * 2. **`FP.world =` only records a `_goto`.** The swap lands at end of
 *    tick, exactly like a teleporter's, and under RECORD-THEN-ACT that
 *    means **the death is never observed**: the observation the death tick
 *    produces is ALREADY the rebuilt world, and the stance the last hit
 *    found appears in no stream. ⛓ MEASURED on `r6-contact-pair-live` —
 *    observation 99 is 55 px east of the trap-side stance and observation
 *    100 is the respawn. The difference from a teleporter is that the old
 *    player does NOT take a last step: `dying` is already true when
 *    `Player.update` tests `if (!dying) super.update()`.
 * 3. **It is reachable from EVERY fight window**, not just the ending ones
 *    — which makes "the driver survives a world swap it did not order" a
 *    requirement on the DRIVER, not only on this model.
 */
export const DEATH_REBOOT = Object.freeze({
    trigger: 'Player.as:1487 `die()` — `dying = true; (FP.world as Game).restartLevel()`',
    reboot: 'Game.as:1894 `FP.world = new Game(level, playerPosition.x, playerPosition.y)`',
    spawnFrom: 'the CURRENT Game\'s constructor args (Game.as:624), not the death position',
    deferred: 'end of tick — `Engine.checkWorld`, the same seam a teleporter uses',
    lastStep: false,
    lastStepWhy: '`Player.update` runs `super.update()` under `if (!dying)`, and `die()` '
        + 'set it — so unlike a teleport there is no doomed final movement tick',
    resets: Object.freeze(['hits', 'hitsTimer', 'directionFace', 'v', 'terrain',
        'direction', 'drownTimer', 'frozenTimer']),
    survives: Object.freeze(['Main.hitsMax', 'Game.shake', 'Game.time', 'persistence']),
    /**
     * ⚠ The `sprShrumDark.currentAnim == "dead"` arm at `Player.as:481-490`
     * — which reboots into `new Game(114, 72, 128, false, 2)` and sets
     * `Game.menu` — is the DARKSUIT-only bad ending. `getSuit()` returns
     * `sprShrumDark` only when `hasDarkSuit`, and the `die`/`dead` anims
     * exist on no other sprite, so it is INERT on this rung's honest path.
     * Named rather than assumed (§8.8), because the credits witness is an
     * ELIMINATION over the four `Game.menu = true` writers and this is one
     * of the four.
     */
    darkSuitArm: 'Player.as:481-490 — inert without hasDarkSuit; not modelled',
});

/** ⛓ STAGEDHITS — the keys a staging's `player_damage` may carry (`botStatus`'s spelling; see `stagedPlayerDamage`). */
export const STAGED_PLAYER_DAMAGE_KEYS = Object.freeze(['hits', 'hits_timer', 'direction_face']);

/**
 * ⛓⛓⛓ SEEDLING FIDELITY STAGEDHITS (wave 14, planner `seedling-fidelity-planning-6`) — THE PLAYER'S DAMAGE AT A
 * STAGING, AND IT IS READ FROM THE GAME.
 *
 * ⚖ The user's standard (2026-10-05): the solver must KNOW which state it is in, without clearing the save and without
 * leaving and re-entering the room. Since FORCEDHIT the solver may take a billed hit, so the player's damage is state a
 * later plan inherits — and a staging built anywhere but at a world's construction must say what it is.
 *
 * ── WHAT A STAGING CARRIES (`player_damage`, an OPTIONAL staging field) ─────────────────────────────────────────
 *
 *   `hits`            `Player.hits` — `botStatus.hits` (`Bot.as:2124`)
 *   `hits_timer`      `Player.hitsTimer`, the i-frame countdown — `botStatus.hits_timer` (`Bot.as:2125`). It gates
 *                     the ARROWS (`canSteer`) and swallows the next hit from any source, so a staging that dropped it
 *                     plans steering the game ignores (measured, D3: the control moves on the re-stage's first tick)
 *   `direction_face`  `Player.directionFace`, the facing a knockback PARKED (`Player.as:1500`), −1 when none.
 *                     ⚠ NOT on `botStatus` (`direction` is private — `Bot.as:597`); it moves the FACING only
 *                     (`nextDirection`), never a position. Absent = −1. Read it off `botMobiles`' player `anim` when a
 *                     staged i-frame matters to a press (the facing the parked window swings by).
 *
 * The snake_case is `botStatus`'s, on `inventory_slots`' precedent: a field a live staging reads straight off the game.
 * No tape carries it (`stagingFromTape` does not copy it, `buildStagedTape` does not write it), so every committed
 * replay is a fresh `Player`'s — byte-identical by construction.
 *
 * ⛔ WHEN TO STAGE IT — AND WHEN STAGING IT IS A DOUBLE BILL:
 *   · an ARRIVAL staging (`wasmArrival.stagingFromWasmArrival`, read at the begin record) is a new `Player`: 0, and
 *     the field is never needed there;
 *   · a re-stage that REPLAYS the shipped prefix over the arrival (`continuationSolveRequest`, a delivery's
 *     `stageItems` + `deliveryRefusal`'s `prefix`) re-bills every hit the prefix took — staging the LIVE hits there
 *     would bill them twice. The replay is checked against the game instead (`stagedHitsMismatch`);
 *   · a staging with NO prefix at a point the game did not construct (an in-place reboot at the player's position —
 *     `jsRuntimeCore.rebootInPlace` — or a cold adoption of a room someone else walked) is where the game's damage
 *     must be staged, from `botStatus` at that point (`playerDamageFromStatus`).
 *
 * @param {object|null|undefined} staged  the staging's `player_damage`, or null/undefined (a fresh `Player`)
 * @param {object} o
 * @param {number} o.hitsMax  the RUN's `Main.hitsMax`
 * @returns {{hits:number, hitsTimer:number, directionFace:number}} the run's initial damage state
 */
export function stagedPlayerDamage(staged, { hitsMax }) {
    if (staged === null || staged === undefined) return createPlayerDamage();
    const why = (s) => fail(`playerDamage: the staged \`player_damage\` ${s} — refused by name rather than staged `
        + `(got ${JSON.stringify(staged)})`);
    if (typeof staged !== 'object' || Array.isArray(staged)) why('is not an object');
    const unknown = Object.keys(staged).filter((k) => !STAGED_PLAYER_DAMAGE_KEYS.includes(k));
    if (unknown.length) why(`names ${JSON.stringify(unknown)}, which it does not carry (${STAGED_PLAYER_DAMAGE_KEYS.join(', ')})`);
    const { hits, hits_timer: hitsTimer, direction_face: directionFace = -1 } = staged;
    if (!Number.isInteger(hits) || hits < 0) why('`hits` is not a non-negative integer');
    if (!Number.isInteger(hitsTimer) || hitsTimer < 0 || hitsTimer > PLAYER_DAMAGE.hitsTimerMax) {
        why(`\`hits_timer\` is not an integer in 0..${PLAYER_DAMAGE.hitsTimerMax} (\`hitsTimerMax\`, Player.as:336)`);
    }
    if (!Number.isInteger(directionFace) || directionFace < -1 || directionFace > 3) {
        why('`direction_face` is not −1 (none) or a facing 0..3');
    }
    if (!Number.isFinite(hitsMax)) {
        why('cannot be checked: `hitsMax` is the RUN\'s `Main.hitsMax` and has no default here');
    }
    // `Player.hit` dies at `hits >= hitsMax` and the death reboots the world (a new `Player` at 0): a live player
    // never stands there, so a staging that says so is a misread, not a state.
    if (hits >= hitsMax) why(`says \`hits\` ${hits} ≥ \`hitsMax\` ${hitsMax}: that player is dead (\`die()\`, Player.as:1487)`);
    return { hits, hitsTimer, directionFace };
}

/**
 * The `player_damage` block a live staging takes from ONE `botStatus` read — the two keys the game exposes, as it
 * names them. ⚖ State comes from the GAME: never from a plan's predicted `damage` (`solveSegment`'s result field).
 */
export function playerDamageFromStatus(status) {
    const hits = status?.hits;
    const hitsTimer = status?.hits_timer;
    if (!Number.isInteger(hits) || !Number.isInteger(hitsTimer)) {
        fail(`playerDamage: botStatus carries no integer \`hits\` / \`hits_timer\` (got ${JSON.stringify(hits)} / `
            + `${JSON.stringify(hitsTimer)}) — the player's damage cannot be staged from it`);
    }
    return { hits, hits_timer: hitsTimer };
}

/**
 * ⛓ `wasmPlayback.shadowMismatch`'s missing half: the model's damage (a run, or its `damage`) against ONE `botStatus`
 * read — null when `hits` and `hits_timer` are equal, else `{expected, got}` (the model, the game), the same shape.
 * A shadow that re-billed a different hit count, or a re-stage that dropped the i-frame, is a STAGING BUG, named.
 *
 * @param {{damage:object}|{hits:number, hitsTimer:number}} run
 * @param {{hits:number, hits_timer:number}} status
 * @returns {null|{expected:{hits:number, hits_timer:number}, got:{hits:number, hits_timer:number}|null}}
 */
export function stagedHitsMismatch(run, status) {
    const d = run?.damage ?? run ?? null;
    const expected = d ? { hits: d.hits, hits_timer: d.hitsTimer } : null;
    if (!expected || !status) return { expected, got: null };
    const got = { hits: status.hits, hits_timer: status.hits_timer };
    return expected.hits === got.hits && expected.hits_timer === got.hits_timer ? null : { expected, got };
}
