/**
 * `iceTurretBlast.js` — THE BLAST, AND THE FREEZE NO DAMAGE POLICY TOUCHES.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 22 step 0. The
 * ELEVENTH per-visit family and **the first PROJECTILE this model has ever
 * had** — the first body that is not placed by an `.oel`, does not belong
 * to the level, and is created and destroyed inside a window.
 *
 * Brief: `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §35.11 item 1.
 * Source: `Projectiles/IceTurretBlast.as` (whole class), `Mobile.as:17,
 * 31-45,84-115`, `Player.as:586-603` (`freeze`/`freezeStep`), `:1372-1399`
 * (`hit`), `:1519` (`input`'s gate), `Enemies/IceTurret.as:152-167`
 * (`endAnim`, the spawn), `net/flashpunk/World.as:895-955` (the deferred
 * add and the PREPEND). All read at first hand.
 *
 * ── ⛔⛔⛔ WHY THIS FAMILY EXISTS: IT REFUTED A LEG ────────────────────
 *
 * `r5-l40-part5` and `-control` were recorded against the real game at R5
 * slice 21 and diverged at tick 1616 of 1965 — in BOTH arms, at the same
 * tick, by the same 0.8 px, settling at a permanent 14.15 px. The cause is
 * two lines:
 *
 * ```
 *   case "Player":
 *       (hits[i] as Player).freeze(freezeTime);              // 15 ticks
 *       (hits[i] as Player).hit(null, 0, new Point(x, y));   // Bot.noDamage
 * ```
 *
 * `Player.hit`'s WHOLE BODY is behind `if (Bot.noDamage) return`, so the
 * damage really is free. `freeze()` is the line ABOVE it and is guarded by
 * NOTHING. ⇒ **"damage taken is priced, not forbidden" is half the rule**:
 * `Bot.noDamage` prices the damage; nothing prices the FREEZE, and a freeze
 * is a displacement. [[feedback_nodamage_prices_damage_not_freeze]].
 *
 * ── ⛓⛓⛓ AND THE DIVERGENCE TICK IS NOT THE CONTACT TICK ──────────────
 *
 * The recording's first visible disagreement is 1616. The contact is at
 * **1614**, and the two ticks between are invisible because
 * `Player.input()`'s direction arms are themselves gated:
 * `if (v.y > -moveSpeed) v.y -= accel` refuses while the player is still
 * above walk speed, so a blocked input on a fast tick and a live input on
 * a fast tick produce the same number. Blocked ticks 1614..1627 (fourteen),
 * of which the first two are silent and nine are the dead stop at
 * (499.6,472.75) that §35.8 measured.
 *
 * ⇒ **fourteen, from a freeze of fifteen.** `freezeStep()` runs at
 * `Player.as:532`, ABOVE `super.update()`, so the contact tick's own
 * decrement has already happened by the time `input()` reads the gate:
 * 15 -> 14 on the contact tick, and the gate `frozenTimer > 0` first fails
 * on the tick the decrement writes 0. The arithmetic is asserted, not the
 * outcome — see `FREEZE_SPAN`.
 *
 * ── ⛔⛔ FOUR THINGS THE BRIEF'S OWN SUMMARY DID NOT SAY ───────────────
 *
 * 1. **THE CTOR TRUNCATES.** `Mobile(_x:int, _y:int, ...)` and
 *    `IceTurretBlast(_x:int, _y:int, _v:Point)` both take INTS, so the two
 *    off-centre blasts' `x + 12*cos(a + PI/2)` spawn positions are
 *    truncated toward zero. The VELOCITY is a `Point` and is not.
 *
 * 2. **`friction()` STILL RUNS, AND IT CAN ZERO AN AXIS.** `f = 0` makes
 *    `v.normalize(max(len - 0, 0))` an identity, but `Mobile.friction`'s
 *    next two lines are `if (Math.abs(v.x) < 0.05) v.x = 0` — so a shot
 *    within 0.48 degrees of an axis loses its cross component PERMANENTLY
 *    on its first tick. Transcribed rather than skipped.
 *
 * 3. **THE COLLISION TEST IS NOT FREEZE-GATED.** `IceTurretBlast.update`
 *    is `super.update(); if (v.length > 0) { …collide… }` — and only the
 *    MOVE inside `mobileUpdate` is behind `if (!Game.freezeObjects)`. A
 *    blast parked on the player by a ceremony freezes them on the ceremony's
 *    first frame and is removed there.
 *
 * 4. **THERE IS NO OFF-WORLD BOUND.** `Mobile` has none, `Enemy`'s is
 *    commented out (`Enemy.as:108-111`) and a blast is not an `Enemy`
 *    anyway. A blast that hits nothing flies for ever. See `prune`.
 *
 * ── ⛓⛓ COVER IS A MODELLED RESOURCE ──────────────────────────────────
 *
 * `hitables` is `["Player", "Tree", "Solid", "Shield"]` and the blast is
 * REMOVED on any contact — so a wall, a tree, and **the corpse the leg
 * itself made** all shield the player. It is a narrower list than
 * `Mobile.solids`: a `Rope`, a `ShieldBoss` and a `LavaBoss` do NOT stop a
 * blast, which is why this module asks the world for its own box list
 * rather than reusing the player's. [[feedback_notsolid_is_per_mover]] one
 * family further on.
 */

import { rect, rectsOverlap } from './levelWorld.js';

export class IceTurretBlastError extends Error {
    constructor(message) { super(message); this.name = 'IceTurretBlastError'; }
}
const fail = (m) => { throw new IceTurretBlastError(m); };

/** `FP.sign` — `value < 0 ? -1 : (value > 0 ? 1 : 0)` (`FP.as:142-145`). */
const fpSign = (n) => (n < 0 ? -1 : (n > 0 ? 1 : 0));

/** AS3's `int(v)` — truncation TOWARD ZERO, which is not `Math.floor`. */
const toInt = (n) => Math.trunc(n);

/**
 * The class's constants, verbatim. Every one is a literal or a
 * `private const` in `Projectiles/IceTurretBlast.as`.
 */
export const ICE_TURRET_BLAST = Object.freeze({
    /** `setHitbox(4, 4, 2, 2)` — a 4x4 box CENTRED on the entity point. */
    hitbox: Object.freeze({ w: 4, h: 4, originX: 2, originY: 2 }),
    type: 'IceBlast',
    /**
     * ⛔ NARROWER THAN `Mobile.solids`, and that is the finding. The blast
     * flies THROUGH a `Rope`, a `ShieldBoss` and a `LavaBoss`; it stops on
     * a `Tree`, which `Crusher.solids` (["Solid"]) does not.
     */
    hitables: Object.freeze(['Player', 'Tree', 'Solid', 'Shield']),
    /** `Player.freeze(freezeTime)` — the ONE number the whole slice is about. */
    freezeTicks: 15,
    /** `f = 0` in the ctor: no decay, but `friction()` still runs. */
    friction: 0,
    /** ⛔ EMPTY. Its own `hitables` check is its only stop — no wall physics. */
    solids: Object.freeze([]),
    /** `IceTurret.shotSpeed`. */
    speed: 6,
    /** `IceTurret.distBtwnShots` — the perpendicular offset of blasts 2 and 3. */
    distBtwnShots: 12,
    perVolley: 3,
    /**
     * ⛔ THE `"Enemy"` CASE IS DEAD CODE, AND IT IS TRANSCRIBED AS DEAD.
     * `update()`'s switch has a `case "Enemy": (hits[i] as Enemy).hit(...)`
     * arm, and `"Enemy"` is not in `hitables` — so `collideTypesInto` can
     * never put one in the vector and the arm can never run. Kept in the
     * record because a later reader who finds it in the source needs to
     * know it was seen and ruled dead, not missed.
     */
    deadSwitchArm: 'Enemy',
    /** One `Music.playSoundDistPlayer` at spawn, dist-gated. Sound only. */
    sound: 'Other:2 at spawn, radius 200, volume 0.4 — no gameplay reader',
    src: 'Projectiles/IceTurretBlast.as (whole class); Mobile.as:17,31-45,84-115; '
        + 'Enemies/IceTurret.as:152-167',
});

/**
 * ⛓⛓⛓ THE FREEZE, AS AN ARITHMETIC RATHER THAN AS AN OUTCOME.
 *
 * A schedule's slack can hide an arithmetic error, so the span is derived
 * here and asserted by `iceTurretBlast.test.js` against the game's own
 * recording rather than read off a passing walk.
 *
 * ```
 *   tick T    IceTurretBlast.update  -> Player.freeze(15)      frozenTimer = 15
 *             (blasts PREPEND, so every blast updates before the player)
 *   tick T    Player.update          -> freezeStep()           frozenTimer = 14
 *                                    -> super.update() -> input()
 *                                       gate `frozenTimer > 0` -> REFUSED
 *   …
 *   tick T+13 freezeStep()                                     frozenTimer = 1
 *                                       gate -> REFUSED
 *   tick T+14 freezeStep()                                     frozenTimer = 0
 *                                       gate -> PASSES
 * ```
 *
 * ⇒ **fourteen refused ticks from a fifteen-tick freeze**, the first of
 * them the contact tick itself.
 */
export const FREEZE_SPAN = Object.freeze({
    freezeTicks: ICE_TURRET_BLAST.freezeTicks,
    /** Ticks on which `Player.input()` returns at its first line. */
    refusedTicks: ICE_TURRET_BLAST.freezeTicks - 1,
    firstRefusedIsContactTick: true,
    /**
     * ⛔ AND A REFUSED TICK IS NOT A DEAD TICK. `Game.freezeObjects` is a
     * different flag and `dead_frames` does not see this one: the tape
     * keeps advancing, `friction()` keeps running and the player keeps
     * DRIFTING on the velocity the freeze preserved. The nine-tick dead
     * stop in the L40 recording is the tail of a fourteen-tick refusal,
     * not its length.
     */
    isDeadFrames: false,
    /**
     * ⛔⛔ AND A REFUSED TICK BURNS A PRESS. `useItem(Main.primary)` is
     * called from INSIDE `Player.input()`, below the gate, and
     * `Input.pressed` is a per-frame rising edge cleared whether or not
     * anybody reads it — so a `primary` press on a refused tick is lost
     * silently, exactly as it is under a touch-lock's `receiveInput`.
     * `levelRun` refuses to author one rather than modelling the loss.
     */
    burnsAPress: true,
    /**
     * ⛓ AND AN ATTACK ALREADY UNDERWAY IS NOT CANCELLED. `slash()`,
     * `spear()` and `fire()` are called from `Player.update` ABOVE
     * `super.update()`, so their windows keep running through a freeze —
     * only the press that would START one is lost.
     */
    cancelsAnOpenWindow: false,
    src: 'Player.as:532 (freezeStep, above super.update()), :586-603, :1519',
});

/**
 * ⛔ `Player.hit(null, 0, p)` — THE OTHER LINE, AND UNDER `noDamage` IT IS
 * NOTHING AT ALL.
 *
 * ```
 *   if (Bot.noDamage) return;                                  // R0
 *   if (hitsTimer <= 0 && hits < hitsMax && !Game.freezeObjects) {
 *       if (e && hasDarkSuit) e.hit(...);                      // e is null here
 *       Music.playSound("Hurt");
 *       hits += d;  hitsTimer = hitsTimerMax;  Game.shake += 5;
 *       if (hits >= hitsMax) die(); else knockback(f, p);
 *   }
 * ```
 *
 * ⛓⛓ **AND A ZERO-FORCE KNOCKBACK DISPLACES NOTHING** — verified rather
 * than assumed, because it is the one term that could have made the damage
 * arm move the player even with `hits` unchanged. `Player.knockback`'s body
 * is `v.x += f * center.x` / `v.y += f * center.y` behind two magnitude
 * tests, and `IceTurretBlast` passes `f = 0`: both adds are exactly `0 *
 * something`. The ONLY state a landed blast hit writes with `noDamage` off
 * is `hits`, `hitsTimer`, `Game.shake` and `directionFace` — and `shake` is
 * camera-only (§34.3).
 *
 * ⚠ THREE GATES, NOT ONE, and `hits < hitsMax` is the one a summary drops:
 * a player already at `hitsMax` is mid-`die()` and takes nothing.
 */
export const BLAST_DAMAGE = Object.freeze({
    force: 0,
    damage: 1,
    /** `new Point(x, y)` — the BLAST's entity point, not the turret's. */
    knockbackFrom: 'the blast',
    knockbackDisplaces: 0,
    knockbackWhy: '`f` is 0, so `v.x += f * center.x` adds exactly zero on both axes',
    gates: Object.freeze(['Bot.noDamage', 'hitsTimer <= 0', 'hits < hitsMax',
        '!Game.freezeObjects']),
    shake: 5,
    shakeIsCameraOnly: true,
    /** ⛓ Under `noDamage` the blast's ENTIRE gameplay effect is the freeze. */
    underNoDamage: 'the freeze, and nothing else',
    src: 'Player.as:1372-1399, :1491-1511',
});

/**
 * One blast. `id` is `<turretId>#<volley>.<k>` so a ledger entry names the
 * shot as well as the shooter.
 */
export function createIceTurretBlast(id, x, y, vx, vy) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        fail(`createIceTurretBlast: (${x},${y}) must be finite`);
    }
    return {
        id,
        // ⛔ The ctor's `int` params. Truncation toward zero, applied HERE
        // so a caller cannot forget it.
        x: toInt(x),
        y: toInt(y),
        v: { x: vx, y: vy },
        spawnedAt: null,
        removed: false,
        /** What it hit, for the ledger — `null` until it hits something. */
        hitTypes: null,
    };
}

/** The 4x4 box, centred on the entity point. */
export function iceTurretBlastRect(state) {
    const b = ICE_TURRET_BLAST.hitbox;
    return rect(state.x - b.originX, state.y - b.originY, b.w, b.h);
}

/**
 * ⛓⛓⛓ `IceTurret.endAnim`'s `case "startshot"` — THE VOLLEY, THREE BODIES.
 *
 * ```
 *   var a:Number = -sprIceTurret.angle / 180 * Math.PI;
 *   add(new IceTurretBlast(x, y, new Point(6cos a, 6 sin a)));
 *   add(new IceTurretBlast(x + 12*cos(a + PI/2), y + 12*sin(a + PI/2), same v));
 *   add(new IceTurretBlast(x - 12*cos(a + PI/2), y - 12*sin(a + PI/2), same v));
 * ```
 *
 * ⛓ THE ORDER IS LOAD-BEARING FOR THE UPDATE LIST AND FOR NOTHING ELSE.
 * `World.addUpdate` PREPENDS, so after `updateLists()` the three sit
 * `-12, +12, centre` at the head — but blasts do not collide with each
 * other (`IceBlast` is in no `hitables`) and all three carry the same
 * velocity, so the order is unobservable. Preserved anyway, because
 * "unobservable today" is a claim about today's rooms.
 *
 * ⚠ ALL THREE SHARE ONE VELOCITY. The spread is a translation of the
 * SPAWN POINT perpendicular to the aim, not a fan — the three fly parallel
 * 12 px apart for ever.
 *
 * @param {string} turretId
 * @param {number} volley  a monotonic counter, for the ids
 * @param {number} x  the turret's entity x
 * @param {number} y  the turret's entity y
 * @param {number} angleDeg  `sprIceTurret.angle`, in DEGREES
 */
export function spawnVolley(turretId, volley, x, y, angleDeg) {
    const a = (-angleDeg / 180) * Math.PI;
    const vx = ICE_TURRET_BLAST.speed * Math.cos(a);
    const vy = ICE_TURRET_BLAST.speed * Math.sin(a);
    const d = ICE_TURRET_BLAST.distBtwnShots;
    const px = Math.cos(a + Math.PI / 2);
    const py = Math.sin(a + Math.PI / 2);
    return [
        createIceTurretBlast(`${turretId}#${volley}.0`, x, y, vx, vy),
        createIceTurretBlast(`${turretId}#${volley}.1`, x + d * px, y + d * py, vx, vy),
        createIceTurretBlast(`${turretId}#${volley}.2`, x - d * px, y - d * py, vx, vy),
    ];
}

/**
 * `Mobile.moveX`/`moveY` with `solids = []` — every sub-step is free, so
 * this is `x += v.x` ACCUMULATED IN 1 px STEPS, which is not the same
 * double as `x + v.x`. Transcribed as the loop for that reason.
 */
function moveAxis(state, axis, rel) {
    const n = Math.abs(rel);
    for (let i = 0; i < n; i += 1) {
        state[axis] += Math.min(1, n - i) * fpSign(rel);
    }
}

/**
 * `Mobile.friction()` with `f = 0`.
 *
 * `v.normalize(Math.max(v.length - 0, 0))` scales by `length/length`, which
 * is exactly 1.0 — an identity in doubles, not merely approximately one.
 * What is NOT an identity is the two zeroing tests below it.
 */
function blastFriction(state) {
    if (Math.abs(state.v.x) < 0.05) state.v.x = 0;
    if (Math.abs(state.v.y) < 0.05) state.v.y = 0;
}

/**
 * ONE GAME TICK of `IceTurretBlast.update()`, in the game's own order.
 *
 * ```
 *   super.update()                    // Mobile.mobileUpdate
 *     if (!destroy) {
 *       if (!Game.freezeObjects) { friction(); input(); moveX(v.x); moveY(v.y); }
 *       layering();
 *     }
 *     death();                        // destroy is never set on a blast
 *   if (v.length > 0) {
 *     collideTypesInto(hitables, x, y, hits);
 *     for each: case "Player": freeze(15); hit(null, 0, Point(x,y));
 *     if (hits.length > 0) FP.world.remove(this);
 *   }
 * ```
 *
 * @param {object} state
 * @param {object} ctx
 * @param {boolean} ctx.frozen        `Game.freezeObjects` — gates the MOVE only
 * @param {?object} ctx.playerBox     the player's 4x5 box, or null
 * @param {?function} ctx.blockedAt   `(rect) => boolean` — does this box hit a
 *   `Tree`/`Solid`/`Shield`? NOT the player's solids list; see the docblock.
 * @returns {{hitPlayer: boolean, removed: boolean, hitTypes: ?Array}}
 */
export function stepIceTurretBlast(state, ctx = {}) {
    const { frozen = false, playerBox = null, blockedAt = null } = ctx;
    if (state.removed) return { hitPlayer: false, removed: true, hitTypes: state.hitTypes };

    if (!frozen) {
        blastFriction(state);
        // `Mobile.input()` is empty and `IceTurretBlast` does not override it.
        moveAxis(state, 'x', state.v.x);
        moveAxis(state, 'y', state.v.y);
    }

    // ⛔ NOT freeze-gated: `update()`'s own body sits below `super.update()`.
    if (state.v.x === 0 && state.v.y === 0) {
        return { hitPlayer: false, removed: false, hitTypes: null };
    }
    const box = iceTurretBlastRect(state);
    const types = [];
    // ⛓ THE ORDER INSIDE THE VECTOR IS THE TYPE-LIST ORDER, and it does not
    // matter: the only arm with an effect is "Player", the "Enemy" arm is
    // dead, and everything else falls to `default:`. What matters is that
    // ANY contact removes the blast — so a wall between the turret and the
    // player is a complete shield and not a partial one.
    if (playerBox && rectsOverlap(box, playerBox)) types.push('Player');
    if (blockedAt && blockedAt(box)) types.push('Solid');
    if (types.length === 0) return { hitPlayer: false, removed: false, hitTypes: null };
    state.removed = true;
    state.hitTypes = types;
    return { hitPlayer: types.includes('Player'), removed: true, hitTypes: types };
}

/**
 * ⛔ THE PRUNE, AND IT IS NOT A LIFETIME.
 *
 * The game gives a blast none: `Mobile` has no bound and `Enemy`'s is
 * commented out. A model that carried every blast for ever would be
 * faithful and would also grow without limit in a long window, so this
 * drops one only once it can no longer reach ANYTHING — its box is outside
 * the union of the level rect and every hitable box, and its velocity
 * points away from that union on the axis that put it outside.
 *
 * ⛓ That is exact rather than a heuristic: the player is hard-clamped
 * inside the level rect every tick (`Player.as:562-563`), and the bound is
 * computed from the hitable boxes themselves rather than assumed to be
 * inside it. A blast this drops has provably no future contact.
 *
 * @param {object} state
 * @param {{x:number,y:number,right:number,bottom:number}} reach
 */
export function blastIsSpent(state, reach) {
    const b = iceTurretBlastRect(state);
    if (b.right <= reach.x && state.v.x <= 0) return true;
    if (b.x >= reach.right && state.v.x >= 0) return true;
    if (b.bottom <= reach.y && state.v.y <= 0) return true;
    if (b.y >= reach.bottom && state.v.y >= 0) return true;
    return false;
}

/**
 * ⛓⛓ THE PLAN'S DOCTRINE FOR A ROOM WITH A LIVE TURRET IN IT.
 *
 * Written down here rather than in a leg, because every leg that kills a
 * turret is subject to all of it and none of it is negotiable.
 */
export const BLAST_PLAN = Object.freeze({
    /**
     * ⚠ THERE IS NO APPROACH OUT OF RANGE. `attackRange` is 128 and the
     * slash reach is 16, so every stance that can kill a turret is 112 px
     * inside the volume its blasts come out of. A leg does not avoid them;
     * it PRICES them.
     */
    avoidable: false,
    /**
     * ⛓⛓⛓ AND COVER IS THE ONE RESOURCE THAT ANSWERS THEM. A blast is
     * removed by the FIRST `Tree`/`Solid`/`Shield` it touches, so a stance
     * with a wall on the turret's bearing takes no freezes at all — and the
     * corpse the leg itself makes is a 16x16 `"Solid"` from the tick the
     * player steps off it. **The kill buys its own cover**, which is a
     * property of the second half of a kill leg and not of the first.
     */
    cover: 'any Tree/Solid/Shield on the bearing removes the blast outright',
    /** The cost of one contact, in refused input ticks. */
    costTicks: FREEZE_SPAN.refusedTicks,
    /** ⛔ And a press on any of them is LOST, not delayed. */
    pressPolicy: 'never schedule a press inside a freeze span — `levelRun` refuses it',
    /**
     * ⛓ THE VOLLEY CADENCE, from `IceTurret.update`'s own arithmetic and
     * asserted by `iceTurret.test.js` rather than described:
     *
     *   T      shootTimer 0 -> play("startshot"), shootTimer = 25
     *   T+3    the "startshot" callback: THREE BLASTS, play("finishshot")
     *   T+19   the "finishshot" callback: play("") — the turret is idle again
     *   T+20…  25 decrements, so the next volley is at T+45
     *
     * ⛔ The 25 is RE-ARMED EVERY TICK of the animation by `update()`'s own
     * `else { shootTimer = shootTimerMax; }` arm — the anim is in the same
     * condition as the range test — so the gap is the ANIMATION PLUS 26,
     * not 25 from the shot.
     */
    volleyPeriodTicks: 45,
    spawnTickAfterPlay: 3,
    animEndTickAfterPlay: 19,
    src: 'Enemies/IceTurret.as:53-95,152-167; net/flashpunk/graphics/Spritemap.as:69-99',
});
