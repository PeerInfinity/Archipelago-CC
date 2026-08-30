/**
 * `wandShot.js` — `WandShot`, THE THIRTEENTH PER-VISIT FAMILY.
 *
 * Region-atlas Phase 8, rung **R6, slice 2**. The SECOND projectile the
 * model has ever carried (`iceTurretBlast` was the first, R5 slice 22) and
 * the first one the PLAYER makes — so it is also the first per-visit body
 * whose existence a tape is responsible for.
 *
 * Brief: `NewDocs/plans/seedling-bot-r6-opus-kickoff.md` §4 slice 2 item 2,
 * §2.3 and §8.16. Source, read at first hand on fork `bot` @ `a9f84ab`:
 * `Projectiles/WandShot.as` (whole class), `Mobile.as:17,31-45,60-72,84-115`,
 * `Enemies/Enemy.as:141-209` (`hit`, `startDeath`, `dieEffects`),
 * `Puzzlements/MagicalLock.as:64-73`, `net/flashpunk/Entity.as:146-211`
 * (`collide`/`collideTypes`), `net/flashpunk/World.as:47-61,105-111`.
 *
 * ── ⛔⛔⛔ IT OVERRIDES `update()` AND DROPS THE FREEZE GATE ───────────
 *
 * ```
 *   override public function update():void {
 *       if ((graphic as Spritemap).currentAnim != "die") {
 *           life--;
 *           if (life <= 0) { playSound("Wand Fizzle"); play("die"); }
 *           if (offCameraBy(160)) destroy = true;
 *           var hitX:Entity = moveX(v.x);
 *           var hitY:Entity = moveY(v.y);
 *           if (hitX) checkEntity(hitX); else if (hitY) checkEntity(hitY);
 *           layering();
 *       }
 *       death();
 *   }
 * ```
 *
 * `Mobile.mobileUpdate` is never called, so THREE of its guards are gone:
 * the `if (!destroy)` around the body, the `if (!Game.freezeObjects)`
 * around the move, and `friction()`. Consequences, all real:
 *
 * 1. **A shot flies through a ceremony.** Its own move is ungated. So is
 *    `wandEnd`, which created it (`Player.sprites()` is ungated too) — see
 *    `wandVerb.WAND_FREEZE_SPLIT`.
 * 2. **…and is WASTED if it lands on a frozen body.** `Enemy.hit`'s guard
 *    is `(hitsTimer <= 0 || hitByDarkStuff) && !Game.freezeObjects && canHit`,
 *    so the damage is refused — but `checkEntity` plays `"die"`
 *    unconditionally on the line below, so the shot is spent all the same.
 *    A ten-shot schedule that crosses a freeze is short by however many
 *    shots landed inside it, SILENTLY. `stepWandShot` reports
 *    `spentWithoutDamage` so a window can refuse instead.
 * 3. **A CULLED shot keeps flying.** `destroy = true` from the camera test
 *    does not stop the move below it, and the next update re-enters the
 *    body because the guard is on the ANIMATION, not on `destroy`. It
 *    fades for eleven ticks and collides the whole time. (Vacuous today —
 *    see `WAND_SHOT_CULL`.)
 *
 * ── ⛓⛓⛓ THE EPSILON VELOCITIES RUN A SUB-PIXEL PROBE ON THE OTHER AXIS ─
 *
 * `Mobile.moveX` is `for (i = 0; i < Math.abs(_xrel); i++)`. For an "up"
 * shot `v.x` is `1.837e-16` — and `0 < 1.837e-16` is TRUE, so the loop runs
 * ONCE with a step of `1.837e-16`. That probe is a full `collideTypes`
 * call at `x + 1.837e-16`, and FlashPunk's `collide` uses STRICT
 * inequalities (`x - originX + width > e.x - e.originX && …`), so a box
 * edge that exactly TOUCHES a wall is not a contact and the same edge one
 * epsilon further along IS. `WAND_SHOT_GRAZE` is that mechanism, per
 * direction.
 *
 * ⛔⛔⛔ **AND IT IS ALMOST EVERYWHERE UNREACHABLE — A §8.16 DELTA.** §8.16
 * banks *"the sub-pixel x drift is real and must be transcribed rather than
 * rounded away"*. Measured, the drift is not there: `x + 1.837e-16`
 * evaluates to a double, and at any `x` whose ulp/2 exceeds the epsilon the
 * sum is **bit-identical to `x`**. Both the position add and the probe are
 * the same expression, so both vanish together. The measured largest
 * coordinate at which the epsilon still changes the double is
 *
 * ```
 *   up.x    1.837e-16   ->  1        (player x >= 2)  UNREACHABLE
 *   down.x -5.511e-16   ->  8        (shot x 1..8)    reachable
 *   left.y -3.674e-16   ->  4        (shot y 1..4)    reachable
 * ```
 *
 * — see `WAND_SHOT_EPSILON`. The player is hard-clamped to `x >= originX`
 * (2) and `y >= originY` (2), so two of the three bands are inside a
 * plausible stance and the third is not. **Keeping the epsilon is still
 * mandatory** — it is what the game computes, and deleting it deletes two
 * reachable cases — but the REASON is a narrow band near the west and north
 * walls, not a drift that accumulates over a flight.
 * [[feedback_the_obvious_claim_about_your_instrument]] (trap 70), second
 * customer, and this time the false claim was in the brief rather than in
 * a test.
 *
 * ⛓ THE ONE PLACE THE EPSILON BITES AT ORDINARY COORDINATES is the SPAWN,
 * because there the addend meets `int()` rather than a rounding boundary:
 * `int(px - 2.939e-15)` is one lower for every integer `px` below 32
 * (`wandVerb.WAND_SPAWN_EPSILON_BITES`). Two mechanisms, two ranges, and
 * only the spawn one is wide.
 *
 * ⛓ AND `hitX` WINS. `if (hitX) checkEntity(hitX); else if (hitY) …` — so
 * on a shot travelling west the X sweep reports even when the Y probe would
 * also have found something.
 *
 * ── ⛔ A FOURTH MOVER, AND IT INVALIDATES A CLAIM OF EXCLUSIVITY ───────
 *
 * ```
 *   Mobile.as:17            ["Solid","Tree","Rock","Rope","ShieldBoss"]
 *   WandShot.as:69          …push("Enemy")
 * ```
 *
 * — the player's list PLUS `"Enemy"` and MINUS `"LavaBoss"`.
 * `levelWorld.SOLIDS_BY_MOVER` gains a `wandshot` row, and `levelWorld`'s
 * `spinners` docblock — *"only for the movers whose own `solids` carry
 * `"Enemy"`: a `PushableBlock*`, and nothing else in the game"* — is now
 * FALSE and is corrected there. A `Spinner` stops a wand shot.
 * [[feedback_notsolid_is_per_mover]], fourth mover;
 * [[feedback_two_member_list_one_member_read]] for the sentence it broke.
 *
 * ⛓ AND THE BOSS TOTEM'S TYPE FLIP IS INVISIBLE TO THIS MOVER. An unwoken
 * `BossTotem` is `"Solid"` and a woken one is `"Enemy"`, and BOTH names are
 * in this list — so the shot is stopped either way and `checkEntity`'s
 * `_e is Enemy` is true either way (the flip is on `type`, not on the
 * class). What the two states DO differ in is whether `BossTotem.hit`'s own
 * `fullyActivated && activationRestTime <= 0` gate lets the damage land,
 * and that is slice 4's.
 *
 * ── ⛓ THE LIFETIME IS SIXTEEN AND THE CULL IS UNREACHABLE ─────────────
 *
 * `lifeMax = tilesMove * Tile.w / v.length` = `int(3 * 16 / 3)` = 16 in
 * every direction (the epsilon components underflow out of `Point.length`).
 * Sixteen updates at 3 px is 48 px of travel, and the camera cull is a
 * point test 160 px outside a 160 px screen — so a shot cannot outrun it.
 * The cull is a **bounded vacuity with a witness**: `WAND_SHOT_CULL.reach`
 * is the arithmetic and `wandShotCulled` is transcribed anyway, because
 * "unreachable in the rooms we route" is a claim about the rooms.
 */

import { FP_MAX_ELAPSED } from './breakableRocks.js';
import { SCREEN_H, SCREEN_W } from './camera.js';
import { MOBILE_DEATH_FADE } from './enemyDamage.js';
import { rect } from './levelWorld.js';
import { magicalLockOpens } from './magicalLock.js';

export class WandShotError extends Error {
    constructor(message) { super(message); this.name = 'WandShotError'; }
}
const fail = (m) => { throw new WandShotError(m); };

/** `FP.sign` — `value < 0 ? -1 : (value > 0 ? 1 : 0)` (`FP.as:142-145`). */
const fpSign = (n) => (n < 0 ? -1 : (n > 0 ? 1 : 0));

/** AS3's `int(v)` — truncation toward zero, with no `-0` (see `wandVerb`). */
const toInt = (n) => {
    const t = Math.trunc(n);
    return t === 0 ? 0 : t;
};

/** `Scenery/Tile.w`. */
const TILE_W = 16;

/**
 * The class's constants, verbatim. Every one is a literal, a
 * `private const` or a `private var` initialiser in `WandShot.as`.
 */
export const WAND_SHOT = Object.freeze({
    type: 'Projectile',
    /** `tilesMove` — 3 tiles of travel. */
    tilesMove: 3,
    /** `force` — the knockback handed to `Enemy.hit`. */
    force: 3,
    /** `Music.playSound` volumes; they move the draw stream and nothing else. */
    fireVolume: 0.6,
    fizzleVolume: 0.3,
    /** `const margin:int = 160` in `update()`. */
    cullMargin: 160,
    /**
     * Per wand. `setHitbox(3, 3, 2, 2)` / `setHitbox(5, 5, 2, 2)` —
     * ⚠ ORIGIN 2 ON A 3-WIDE BOX, so the box is `[x-2, x+1)`: ASYMMETRIC,
     * one pixel west-heavy. The fire shot's 5x5 keeps origin 2 and is
     * east-heavy instead.
     */
    wand: Object.freeze({
        shotType: 0, damage: 0.5, hitbox: Object.freeze({ w: 3, h: 3, originX: 2, originY: 2 }),
    }),
    firewand: Object.freeze({
        shotType: 1, damage: 1, hitbox: Object.freeze({ w: 5, h: 5, originX: 2, originY: 2 }),
    }),
});

/**
 * `Mobile.solids` + the ctor's `solids.push("Enemy")`.
 *
 * ⚠ `solids` is an INSTANCE field with an array initialiser
 * (`Mobile.as:17`), so the push does not leak into any other mover — a
 * static would have made every `Mobile` in the game collide with enemies
 * the first time a shot was fired.
 */
export const WAND_SHOT_SOLID_TYPES = Object.freeze([
    'Solid', 'Tree', 'Rock', 'Rope', 'ShieldBoss', 'Enemy',
]);

/** `sprWandShot.add(...)` — both anims, both wands, same numbers. */
export const WAND_SHOT_ANIMS = Object.freeze({
    flare: Object.freeze({ frames: Object.freeze([0, 1, 2]), frameCount: 3, frameRate: 5, loop: true }),
    die: Object.freeze({ frames: Object.freeze([3, 4, 5]), frameCount: 3, frameRate: 20, loop: true }),
});

function wrapUpdates(anim) {
    const step = anim.frameRate * FP_MAX_ELAPSED;
    let timer = 0;
    let index = 0;
    for (let update = 1; update <= 10000; update += 1) {
        timer += step;
        while (timer >= 1) {
            timer -= 1;
            index += 1;
            if (index === anim.frameCount) return update;
        }
    }
    return fail('wrapUpdates: the animation never wrapped');
}

/**
 * The two clocks, DERIVED at the clamped elapsed — §8.2's last table row
 * (`flare` / `die` = 19 / 5), re-derived rather than copied.
 *
 * ⛓ `flare` is cosmetic: `animEnd` only acts when the current anim is
 * `"die"`, so a flare wrap at update 19 does nothing at all — and it cannot
 * happen anyway, because the shot has been playing `"die"` since update 16
 * at the latest. Derived to make that a MEASUREMENT.
 */
export const WAND_SHOT_ANIM_UPDATES = Object.freeze({
    flare: wrapUpdates(WAND_SHOT_ANIMS.flare),
    die: wrapUpdates(WAND_SHOT_ANIMS.die),
});

/**
 * ⛓ THE DEATH CHAIN, in ticks from the update that played `"die"`.
 *
 * The shot's own `e.update()` plays `"die"`; the SAME tick's graphic pass
 * (`World.update` steps `e._graphic` right after `e.update()`) is die
 * update 1. So the callback lands `die - 1` ticks later, sets
 * `destroy = true`, and `Mobile.death()`'s fade starts on the tick AFTER
 * that — the callback tick's own `death()` already ran, above the graphic
 * pass, while `destroy` was still false.
 */
export const WAND_SHOT_DEATH = Object.freeze({
    /** Ticks from `play("die")` to `animEnd` → `destroy = true`. */
    destroyTickOffset: WAND_SHOT_ANIM_UPDATES.die - 1,
    /** `Mobile.death()`'s `alpha -= 0.1` — eleven, not ten. */
    fadeTicks: MOBILE_DEATH_FADE.ticks,
    /** Ticks from `play("die")` to `FP.world.remove`. */
    removeTickOffset: (WAND_SHOT_ANIM_UPDATES.die - 1) + MOBILE_DEATH_FADE.ticks,
    src: 'WandShot.as:71-76 (animEnd) + Mobile.as:60-72 (death) + '
        + 'net/flashpunk/World.as:58 (the graphic pass, below e.update())',
});

/**
 * `lifeMax = tilesMove * Tile.w / v.length`, with the `int` coercion of the
 * declared type.
 *
 * ⚠ TAKES THE VELOCITY, not a direction, because the divisor is
 * `Point.length` and the epsilon components are what make it interesting:
 * `sqrt(3^2 + (1.837e-16)^2)` is exactly 3.0 in doubles (the square
 * underflows), so all four cardinals get 16 — which is a measurement about
 * float behaviour, not an assumption about symmetry.
 */
export function wandShotLifeMax(vx, vy) {
    const len = Math.sqrt(vx * vx + vy * vy);
    if (!(len > 0)) fail(`wandShotLifeMax: a zero-velocity shot has no lifetime (${vx},${vy})`);
    return toInt(WAND_SHOT.tilesMove * TILE_W / len);
}

/**
 * The camera cull, transcribed. ⚠ A POINT TEST ON THE ENTITY POSITION, not
 * a box test — `x < FP.camera.x - margin || x > FP.camera.x +
 * FP.screen.width + margin || …` — and `FP.screen` is 160x160
 * (`camera.SCREEN_W`/`SCREEN_H`), NOT `FP.width`/`FP.height`, which are the
 * LEVEL (`camera.js` header note 1).
 */
export function wandShotCulled(x, y, cam) {
    const m = WAND_SHOT.cullMargin;
    return x < cam.x - m || x > cam.x + SCREEN_W + m
        || y < cam.y - m || y > cam.y + SCREEN_H + m;
}

/**
 * ⛓ WHY THE CULL IS A BOUNDED VACUITY, as arithmetic rather than as prose.
 *
 * `travel` is the furthest a shot can get from where it spawned;
 * `nearestEdge` is the smallest distance from any point of the camera box
 * to the cull boundary. The player is always inside the camera box (the
 * camera tracks them and is clamped to the level), so the spawn point is
 * at worst 16 px outside it via `WAND_SPAWN_REACH`.
 */
export const WAND_SHOT_CULL = Object.freeze({
    travel: WAND_SHOT.tilesMove * TILE_W,
    spawnReach: 16,
    /** From ANY point of the 160x160 camera box to the cull boundary. */
    nearestEdge: WAND_SHOT.cullMargin,
    get reachable() { return this.travel + this.spawnReach > this.nearestEdge; },
    why: '48 px of travel plus a 16 px spawn offset against a 160 px margin — a shot '
        + 'cannot reach the boundary before its own lifetime ends it. Transcribed anyway: '
        + 'a room whose camera is clamped away from the player (a level narrower than the '
        + 'screen, where `stepCamera` centres instead of tracking) is the case that would '
        + 'change the arithmetic, and that is a property of the ROOM.',
    /**
     * ⛓⛓⛓ R6 SLICE 3: THE CAMERA TERM §10.6 SAID THIS ARITHMETIC WOULD
     * GAIN, added and re-derived rather than left as a note.
     *
     * The cull is a point test against `FP.camera`, and a shaking camera is
     * displaced by up to `shake / 2` on each axis (`camera.js`'s band). The
     * displacement that MATTERS is the one that moves the boundary TOWARD
     * the shot, i.e. it eats the margin. The largest `Game.shake` this
     * rung's roster can produce is `BossTotem.removed()`'s 60
     * (`camera.SHAKE_WRITERS`), so the worst case eats 30 px.
     *
     * ⇒ 48 + 16 + 30 = 94 against 160. Still unreachable, by 66 px — so the
     * cull's VERDICT is the same for every camera in the band and a run may
     * evaluate it at any point of one. That is what licenses `levelRun` to
     * keep culling while the camera is a band, and it is asserted rather
     * than assumed: the guard reads this flag.
     */
    maxRosterShake: 60,
    get maxShakeDisplacement() { return this.maxRosterShake / 2; },
    get reachableUnderShake() {
        return this.travel + this.spawnReach + this.maxShakeDisplacement > this.nearestEdge;
    },
});

/**
 * One shot.
 *
 * @param {string} id
 * @param {number} x  the ctor's `_x:int` — truncated HERE so a caller
 *   cannot forget it (and `wandVerb.wandShotSpawn` has already truncated,
 *   which is idempotent and asserted rather than assumed)
 * @param {object} v  `{vx, vy}` — the exact vector, epsilons included
 */
export function createWandShot(id, x, y, { vx, vy }, { fire = false } = {}) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        fail(`createWandShot(${id}): (${x},${y}) must be finite`);
    }
    const kind = fire ? WAND_SHOT.firewand : WAND_SHOT.wand;
    const life = wandShotLifeMax(vx, vy);
    return {
        id,
        fire,
        shotType: kind.shotType,
        damage: kind.damage,
        x: toInt(x),
        y: toInt(y),
        v: { x: vx, y: vy },
        lifeMax: life,
        life,
        /** `"flare"` until something plays `"die"`. */
        anim: 'flare',
        /** The tick `play("die")` ran, or null. */
        dyingSince: null,
        destroy: false,
        /**
         * `Mobile.death()`'s alpha countdown, in TICKS REMAINING. Null
         * until `destroy` is set — an eagerly-initialised counter would be
         * indistinguishable from one that had already started, and `death()`
         * is only ever reached through `destroy`.
         */
        fade: null,
        removed: false,
        /** Filled by `checkEntity` — `{kind, id}` or null. */
        hit: null,
        spawnedAt: null,
    };
}

/** The 3x3 (or 5x5) box. ⚠ origin 2 on a 3-wide box — see `WAND_SHOT`. */
export function wandShotRect(state) {
    const b = state.fire ? WAND_SHOT.firewand.hitbox : WAND_SHOT.wand.hitbox;
    return rect(state.x - b.originX, state.y - b.originY, b.w, b.h);
}

/**
 * `Mobile.moveX` / `moveY`, transcribed INCLUDING the loop bound.
 *
 * ⚠ `for (i = 0; i < Math.abs(rel); i++)` with `rel = 1.8e-16` runs ONCE.
 * That is not a rounding artefact to clean up; it is the sub-pixel probe
 * the header's second finding is about.
 *
 * @returns {?object} the blocker `hitAt` returned, or null for a clear sweep
 */
function moveAxis(state, axis, rel, hitAt) {
    const n = Math.abs(rel);
    const s = fpSign(rel);
    for (let i = 0; i < n; i += 1) {
        const step = Math.min(1, n - i) * s;
        const nx = axis === 'x' ? state.x + step : state.x;
        const ny = axis === 'y' ? state.y + step : state.y;
        const c = hitAt(nx, ny, state);
        if (c) return c;
        state[axis] += step;
    }
    return null;
}

/**
 * `WandShot.checkEntity(_e)` — the dispatch, and the two arms that act.
 *
 * ```
 *   if (_e is Enemy)            (_e as Enemy).hit(force, Point(x,y), damage, "Wand");
 *   else if (_e is MagicalLock) (_e as MagicalLock).hit(shotType);
 *   (graphic as Spritemap).play("die");
 *   Music.playSound("Wand Fizzle", -1, fizzleVolume);
 * ```
 *
 * ⛔ THE `play("die")` IS OUTSIDE BOTH ARMS. The shot is spent on a plain
 * wall, on a lock too strong for it, and on an enemy the freeze refused —
 * every contact costs a shot, and only two of them can pay.
 *
 * @param {object} blocker `{kind, id, ...}` — the caller classifies, because
 *   `_e is Enemy` is an AS3 CLASS test and this package holds types
 * @returns {object} the event, for the run's ledger
 */
export function wandShotCheckEntity(state, blocker, { frozen = false, tick = null } = {}) {
    const kind = blocker?.kind;
    if (kind === undefined) {
        fail('wandShotCheckEntity: the blocker must carry a `kind` — `_e is Enemy` is a '
            + 'CLASS test in AS3 and this package holds runtime TYPES, which are not the '
            + 'same partition (an unwoken BossTotem is `type = "Solid"` and IS an Enemy). '
            + 'The caller that owns the world owns the classification.');
    }
    let event;
    if (kind === 'enemy') {
        event = {
            arm: 'enemy',
            id: blocker.id,
            force: WAND_SHOT.force,
            damage: state.damage,
            t: 'Wand',
            // ⛔ `Enemy.hit`'s own `&& !Game.freezeObjects`.
            landed: !frozen,
            spentWithoutDamage: frozen,
        };
    } else if (kind === 'magicallock') {
        const opens = magicalLockOpens(blocker.lockType, state.shotType);
        event = {
            arm: 'magicallock',
            id: blocker.id,
            lockType: blocker.lockType,
            shotType: state.shotType,
            opened: opens,
            spentWithoutDamage: !opens,
        };
    } else {
        event = { arm: 'other', id: blocker.id ?? null, spentWithoutDamage: true };
    }
    state.hit = { kind, id: event.id };
    playDie(state, tick);
    return event;
}

/** `(graphic as Spritemap).play("die")` — resets the clock even if replayed. */
function playDie(state, tick) {
    state.anim = 'die';
    state.dyingSince = tick;
}

/**
 * ONE GAME UPDATE of `WandShot.update()`, in the game's own order.
 *
 * @param {object} state
 * @param {object} ctx
 * @param {number} ctx.tick     the run's tick, for the death clock
 * @param {boolean} ctx.frozen  `Game.freezeObjects` — gates NOTHING here and
 *   is passed through to the `Enemy.hit` arm, which is where it bites
 * @param {?object} ctx.cam     `{x, y}` — the camera, for the cull
 * @param {function} ctx.hitAt  `(x, y, state) => blocker|null` — the world's
 *   `collideTypes(solids, x, y)` over `WAND_SHOT_SOLID_TYPES`; the blocker
 *   must carry `{kind, id}` (and `lockType` for a lock)
 * @returns {{event: ?object, fizzled: boolean, culled: boolean, removed: boolean}}
 */
export function stepWandShot(state, ctx = {}) {
    const { tick = null, frozen = false, cam = null, hitAt = null } = ctx;
    if (state.removed) return { event: null, fizzled: false, culled: false, removed: true };
    if (typeof hitAt !== 'function') {
        fail('stepWandShot: `hitAt` is required. A shot with no collision oracle would '
            + 'fly through every wall in the room and report a clean flight, which is the '
            + 'shape [[feedback_graceful_fallback_vacuous_replay]] names.');
    }

    let event = null;
    let fizzled = false;
    let culled = false;

    // ⛓ THE GUARD IS THE ANIMATION, NOT `destroy` — so a culled shot
    // re-enters this body on its next update and keeps colliding.
    if (state.anim !== 'die') {
        state.life -= 1;
        if (state.life <= 0) {
            // `Music.playSound("Wand Fizzle", …)` — a draw-stream polluter
            // with no gameplay consumer in L43 (§8.3's census).
            fizzled = true;
            playDie(state, tick);
        }
        if (cam && wandShotCulled(state.x, state.y, cam)) {
            culled = true;
            state.destroy = true;
        }
        // ⚠ BOTH SWEEPS RUN even on the fizzle update: `play("die")` above
        // changed `currentAnim`, and this body's guard was evaluated on
        // entry. A shot that runs out of life ON a wall still hits it.
        const hitX = moveAxis(state, 'x', state.v.x, hitAt);
        const hitY = hitX ? null : moveAxis(state, 'y', state.v.y, hitAt);
        // `if (hitX) … else if (hitY) …` — the X blocker WINS, which on a
        // vertical shot means the epsilon axis is checked first.
        const blocker = hitX ?? hitY;
        if (blocker) event = wandShotCheckEntity(state, blocker, { frozen, tick });
    }

    // `death()` — `Mobile.as:60-72`, unconditional at the bottom of `update`.
    if (state.destroy) {
        state.fade = (state.fade ?? MOBILE_DEATH_FADE.ticks) - 1;
        if (state.fade <= 0) state.removed = true;
    }
    return { event, fizzled, culled, removed: state.removed };
}

/**
 * The graphic pass `World.update` runs right after `e.update()` — the die
 * clock, and the only writer of `destroy` on a shot that hit something.
 *
 * ⚠ SEPARATE FROM `stepWandShot` ON PURPOSE. It is a different call site in
 * a different file (`World.as:58`, outside the `e.active` test), it is not
 * freeze-gated, and folding it into the entity's own step would make the
 * SAME-TICK start of the die clock invisible — which is the one tick the
 * whole death chain is measured from.
 */
export function stepWandShotGraphic(state, tick) {
    if (state.removed || state.anim !== 'die' || state.destroy) return { destroyed: false };
    if (tick - state.dyingSince >= WAND_SHOT_DEATH.destroyTickOffset) {
        state.destroy = true;
        return { destroyed: true };
    }
    return { destroyed: false };
}

/**
 * ⛔⛔⛔ WHERE THE EPSILON SURVIVES DOUBLE ROUNDING — the §8.16 delta, as a
 * measurement.
 *
 * `state[axis] += step` and `hitAt(x + step, y)` are the SAME expression
 * evaluated twice, so the position add and the collision probe stand or
 * fall together: wherever `x + eps === x`, the shot neither drifts nor
 * probes and the epsilon is completely unobservable.
 *
 * ⚠ **BOUNDED, AND THE BOUND IS NAMED.** Integer coordinates `1..1024`.
 * The answer is a small number in every case, so extending the sweep can
 * only confirm it; a non-integer coordinate has a smaller ulp than the
 * integer above it and so is covered a fortiori for the sticking side.
 */
function measureEpsilonReach() {
    const out = {};
    for (const [name, eps, playerFloor, note] of [
        ['up.x', 3 * Math.cos(Math.PI / 2), 2,
            'the player is clamped to x >= originX = 2, so the band 0..1 is '
            + 'UNREACHABLE and an up shot\'s x probe is inert in every room'],
        ['down.x', 3 * Math.cos(3 * Math.PI / 2), 1,
            'a down shot from a player at x in [2,9] spawns at x in [1,8] (the '
            + 'spawn truncation costs one) — inside the band, so REACHABLE'],
        ['left.y', -3 * Math.sin(Math.PI), 1,
            'a left shot from a player at y in [2,5] spawns at y in [1,4] — '
            + 'inside the band, so REACHABLE'],
    ]) {
        let largestSticking = null;
        for (let x = 1; x <= 1024; x += 1) if (x + eps !== x) largestSticking = x;
        out[name] = Object.freeze({
            eps, largestSticking, playerFloor, reachable: playerFloor <= largestSticking, note,
        });
    }
    return Object.freeze(out);
}

export const WAND_SHOT_EPSILON = Object.freeze({
    perAxis: measureEpsilonReach(),
    /** Over integer coordinates 1..1024 — the bound, named. */
    sweptTo: 1024,
    /**
     * ⛔ The claim §8.16 makes and this refines: the drift over a whole
     * 16-update flight at an ordinary coordinate is exactly zero, because
     * every one of the sixteen adds rounds back individually.
     */
    driftOverAFlightAtOrdinaryCoordinates: 0,
});

/**
 * ⛔ THE GRAZE, both signs, as the declaration a test walks.
 *
 * The claim is about FlashPunk's strict `>`/`<` meeting a signed epsilon,
 * so it is stated as the two boundary cases rather than as a story: for an
 * UP shot at integer `x`, a wall whose LEFT edge is exactly the shot box's
 * right edge is a contact; for a DOWN shot, a wall whose RIGHT edge is
 * exactly the box's left edge is a contact. Neither is a contact if the
 * epsilon is rounded to zero.
 */
export const WAND_SHOT_GRAZE = Object.freeze({
    up: Object.freeze({
        axis: 'x', epsilonSign: +1, touchingEdge: 'wall.left === box.right',
        reachable: false, why: 'the probe is absorbed above x = 1 — see WAND_SHOT_EPSILON',
    }),
    down: Object.freeze({
        axis: 'x', epsilonSign: -1, touchingEdge: 'wall.right === box.x', reachable: true,
    }),
    left: Object.freeze({
        axis: 'y', epsilonSign: -1, touchingEdge: 'wall.bottom === box.y', reachable: true,
    }),
    right: Object.freeze({
        axis: 'y', epsilonSign: 0,
        touchingEdge: null,
        why: '⛓ THE ONE DIRECTION WITH NO GRAZE. `-3 * Math.sin(0)` is `-0`, and '
            + '`Math.abs(-0)` is 0, so `moveY`\'s loop does not run at all. Three of the '
            + 'four cardinals carry a probe and one does not — which is why this is a '
            + 'table and not a rule.',
    }),
});

/**
 * ⛓⛓ THE PLANNING DOCTRINE FOR A WINDOW THAT FIRES THE WAND.
 *
 * Written here because every such window is subject to all of it.
 */
export const WAND_SHOT_PLAN = Object.freeze({
    /**
     * ⛔ A KILL SPAWNS `Explosion(x, y, ["Player","Enemy"], max(w,h), 1)` —
     * `Enemy.dieEffects`'s `"Wand"` arm, radius `0.65 * max(w,h)`,
     * origin-to-origin, applied ONCE on `added()`. The R5 "no wand kills
     * near self" law is this line, and §8.10 is the geometry.
     */
    killSpawnsExplosion: true,
    /**
     * ⛔ THE CONTACT ORDER. `hitX` is dispatched in preference to `hitY`,
     * so a stance that grazes a wall on the epsilon axis loses the shot
     * before the real axis is ever swept.
     */
    epsilonAxisFirst: true,
    /** ⛔ Every contact spends the shot, including the ones that pay nothing. */
    everyContactSpends: true,
    /** ⛔ A shot that lands during a ceremony is spent and deals nothing. */
    frozenContactIsWasted: true,
    /**
     * ⛓ The corridor is 48 px and the first 16 are free: the shot SPAWNS
     * 16 px along the facing, so the sweep never tests the tile the player
     * is standing in and a wall inside that 16 px is not a blocker — it is
     * a place the shot appears INSIDE, and the first sweep then reports it.
     */
    spawnReach: 16,
    travel: WAND_SHOT.tilesMove * TILE_W,
});
