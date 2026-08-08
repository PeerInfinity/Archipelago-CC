/**
 * seedlingDemo/bossTotem — THE WAKE, AND THE CLAMP THAT IS AN ASSIGNMENT.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 23, step 2. Brief:
 * `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §37; the tick table it is
 * asserted against is §34.3, banked as `r5Totem.L43_BOSS_WAKE.ticks` by
 * `probe-seedling-r5-l43-boss-wake.mjs` at slice 20.
 *
 * ── WHAT THIS FAMILY IS FOR ───────────────────────────────────────────
 *
 * L43 is the wand room. Nothing in this rung has ever walked in it, because
 * `Wand.update`'s whole body is gated on `Player.hasAllTotemParts()` and
 * `Bot`'s boot block could not present that array until slice 23's AS3
 * batch. With the boot field the room becomes a window like any other — and
 * the window's whole content is this class waking up.
 *
 * The wake is FIVE mechanisms, and only two of them touch the player:
 *
 *   1. ⛓ THE PRE-WAKE SOLID. `type = "Solid"` is the ELSE of
 *      `if (activated)`, so until the Wand leaves the world the boss is an
 *      80x32 wall at `[x-40, x+40) x [y+12, y+44)` — which for
 *      `bosstotem@152,168` is `[112,192) x [180,212)`, EXACTLY the arena's
 *      five open columns 7..11. ⛔ `levelWorld`'s ROLES row says
 *      `collider: 'none'` for `bosstotem`, which was unobservable for
 *      twenty-two slices because no tape had ever been in this room; it is
 *      wrong and this family is what makes it wrong VISIBLY.
 *   2. ⛓⛓⛓ THE CLAMP. Once `fullyActivated`,
 *      `if (p.y < y - originY + height) p.y = y - originY + height` runs at
 *      the TOP of `update()` — above the block that sets the flag, which is
 *      why the onset is one tick AFTER it. It is an ASSIGNMENT and not a
 *      collision: the player is teleported to `y = 212`, they do not walk
 *      into anything. It has NO freeze test above it.
 *   3. the activation ramp — 97 sine-eased increments, the number that
 *      decides when 2 starts;
 *   4. the rest timer — 120 ticks, gated on `!Game.freezeObjects`, which
 *      decides when the boss WALKS and therefore where a window must end;
 *   5. everything after the walk, which this model does NOT have and which
 *      is exactly why the boundary band's ceiling is A+335.
 *
 * ── ⛔ THE THREE THINGS A SUMMARY OF `update()` DROPS ─────────────────
 *
 * 1. **THE CLAMP IS A FLOOR, NOT A CEILING, AND IT ONLY BITES FROM THE
 *    NORTH.** `p.y < 212` pushes the player DOWN to 212. The wand sits at
 *    entity y 232 — SOUTH of the clamp — so a walk that collects it and
 *    stands still never sees the assignment at all. The clamp is only
 *    witnessed by a walk that spends the 31 live ticks between the freeze
 *    draining (A+185) and the flag landing (A+215) going NORTH. A window
 *    that stood still would report a green "the clamp holds" having tested
 *    nothing.
 * 2. **`activated` IS EDGE-TRIGGERED ON `classCount(Wand) <= 0`**, i.e. on
 *    the Wand being REMOVED FROM THE WORLD — which `Pickup.pick_up()`
 *    reaches only after 150 `specialTimer` decrements AND the dialogue.
 *    R0's grants ruling is what made this inert for four rungs: a granted
 *    `hasWand` never removes the entity, so `classCount(Wand)` never
 *    reaches 0 (`levelWorld`'s `bosstotem` hazard row says so at length).
 * 3. **THE REST TIMER IS FREEZE-GATED AND THE RAMP IS NOT.** `rumblingTime`
 *    and `activationStage` advance inside `if (activated)`, with no freeze
 *    test; `activationRestTime` is inside
 *    `else if (fullyActivated && !Game.freezeObjects)`. On this room's own
 *    schedule that never binds — the flag lands at A+215 and the rocks'
 *    freeze drained at A+185 — but the two arms are transcribed separately
 *    rather than collapsed, because "no route does that yet" is how the
 *    statue got its offset wrong for two slices.
 *
 * ⚠ AND THE RUMBLE IS RENDER-ONLY. `rumblingTime` feeds
 * `rumbleRandAngle`/`rumbleRandDist` (two `Math.random()` draws) inside the
 * limb-placement code, which writes graphic offsets and nothing else. The
 * 240-tick rumble is a LOOK, not a displacement — the brief's "escaped
 * south during its 240-tick rumble" read it as a window and there is none.
 *
 * ── R6 SLICE 4: AND THE FIVE MECHANISMS ARE NOW SIX ──────────────────
 *
 * Item 5 above — *"everything after the walk, which this model does NOT
 * have and which is exactly why the boundary band's ceiling is A+335"* — is
 * what this slice built. `stepBossTotem` below now runs the WHOLE
 * `update()`: `super.update()` (friction, `moveY`, `hitUpdate`, `hitPlayer`)
 * above the state machine, then walk / laser / attack / jump / top-wait.
 * `bossTotemFight.js` owns everything that loop consults — the animation
 * tables, the render-side head position, the laser rects, the projectiles,
 * the death blast — and `renderBossTotem` below is the `render()` half,
 * because the beam reads a value only `render()` writes.
 *
 * ⛔ THE CLAMP IS NOT A CONSTANT AND NEVER WAS (§8.11): `bossTotemClampY` is
 * `b.y - oy + h` and always tracked `b.y`; what was missing was a `b.y` that
 * MOVED. It now sweeps 180 → 352 and snaps back, for ever.
 */

import { rect } from './levelWorld.js';
import {
    BOSS_TOTEM_FIGHT, BOSS_TOTEM_WHITE_OUT,
    bossTotemAttackShots, bossTotemBodyContactFires, bossTotemBodyRect,
    bossTotemHeadPosY, bossTotemLaserHits, bossTotemLaserRects,
} from './bossTotemFight.js';

/**
 * `Enemies/BossTotem.as`, transcribed. Every number is a field or a const
 * of the class, at the name the class gives it.
 */
export const BOSS_TOTEM = Object.freeze({
    as3: 'Enemies/BossTotem.as',
    /** `setHitbox(80, 32, 40, -12)` */
    hitbox: Object.freeze({ w: 80, h: 32, ox: 40, oy: -12 }),
    /** `rumblingTimeMax` — the decrement starts on the activation tick. */
    rumblingTimeMax: 240,
    /** The ramp starts when `rumblingTime <= rumblingTimeMax / 2`. */
    rampGate: 120,
    /** `activationRate`, and the `n` its sine easing divides by. */
    activationRate: 0.02,
    easingN: 8,
    /** `activationRestTimeMax` — drained only on unfrozen ticks. */
    activationRestTimeMax: 120,
    /** `waitAtTopTime` starts at 0, so the rest arm is live from tick 0. */
    waitAtTopTimeMax: 30,
    /** ⛓ The wake rewrites the RESPAWN point, so a death lands in here. */
    playerPosSet: Object.freeze({ x: 144, y: 352 }),
    kill: Object.freeze({ hitsMax: 5, hitsTimerMax: 20, onlyHitBy: 'Wand' }),
    /** ⛓ `activeOffScreen = true` — the camera is out of this one. */
    activeOffScreen: true,
    src: Object.freeze({
        clamp: 'BossTotem.as:280-286 — above the activation block, no freeze test',
        activate: 'BossTotem.as:287-293 — `FP.world.classCount(Wand) <= 0 && !activated`',
        ramp: 'BossTotem.as:294-313',
        preWakeSolid: 'BossTotem.as:315 — the ELSE of `if (activated)`',
        rest: 'BossTotem.as:317-330',
    }),
});

/**
 * `Pickups/Wand.as`, the half no other pickup has.
 *
 * ⛔⛔ THE FADE IS A FREEZE THAT FIRES ON APPROACH, NOT ON CONTACT. The
 * gate is `p.y < y + Tile.h && Player.hasAllTotemParts() && !p.fallFromCeiling`
 * — a half-room-wide condition on the PLAYER'S Y ALONE — and while the
 * alpha is under 1 it writes `Game.freezeObjects = alpha < 1` every tick.
 * So the ceremony's first 100 frozen frames are spent BEFORE the player has
 * touched anything, and a window that priced the wand at
 * `CEREMONY_DEAD_FRAMES.pickup` would be 100 frames short.
 *
 * ⚠ AND THE `|| !doBossActions` ARM IS DEAD. `doBossActions` is a
 * `private var` initialised `true` at `Wand.as:21` and assigned nowhere in
 * the class, so it can never be the way in.
 *
 * ⛓ `tset: 0` is the group `removed()` publishes to — L43's three
 * `fallrock`s are all tset 0, and one of them seals the room's only shaft.
 */
export const WAND_PICKUP = Object.freeze({
    as3: 'Pickups/Wand.as',
    /** `super(_x + Tile.w/2, _y + Tile.h/2, ...)` */
    ctorOffset: Object.freeze({ dx: 8, dy: 8 }),
    /** `setHitbox(3, 8, 2, 4)` */
    hitbox: Object.freeze({ w: 3, h: 8, ox: 2, oy: 4 }),
    alphaRate: 0.01,
    /** The gate's y term: `p.y < y + Tile.h`, y being the ENTITY y. */
    gateBelowOffset: 16,
    tset: 0,
    text: 'You got the Wand!~It shoots weakly, but far.',
    /** ⛔ `Pickup.specialTimerMax` — 150 frozen frames AFTER the contact. */
    specialTimerTicks: 150,
    deadArm: '`|| !doBossActions` — Wand.as:21 initialises it true and nothing assigns it',
});

export class BossTotemError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BossTotemError';
    }
}

/**
 * The number of ticks a wand fade costs, from the first gated tick.
 *
 * `alpha` starts at 0 and steps `min(alpha + 0.01, 1)`; the freeze is
 * `alpha < 1` READ AFTER the step, so the tick that brings alpha to 1 is
 * already unfrozen. ⚠ SIMULATED rather than `1 / 0.01`, for the reason
 * `fallRockFreezeTicks` is: repeated addition of 0.01 is not 100 exact
 * hundredths, and dividing would be asserting an arithmetic the game does
 * not do. [[feedback_accumulate_dont_divide_the_fade]]
 */
export function wandFadeFreezeTicks() {
    let alpha = 0;
    let frozen = 0;
    // The loop bound is a runaway guard, not the answer.
    for (let i = 0; i < 10000; i++) {
        alpha = Math.min(alpha + WAND_PICKUP.alphaRate, 1);
        if (!(alpha < 1)) return frozen;
        frozen += 1;
    }
    throw new BossTotemError('wandFadeFreezeTicks: the alpha ramp did not reach 1');
}

/** Is the player's y inside `Wand.update`'s approach gate? */
export function wandFadeGateOpen({ playerY, wandY, hasAllTotemParts, fallFromCeiling }) {
    return Boolean(hasAllTotemParts) && !fallFromCeiling
        && playerY < wandY + WAND_PICKUP.gateBelowOffset;
}

/** One boss, per visit. `x`/`y` are the ENTITY point, not the OEL one. */
export function createBossTotem(x, y) {
    return {
        x, y,
        /** ⛓ `startY = _y` — the JUMP's ceiling is `startY - 32`, for ever. */
        startY: y,
        activated: false,
        fullyActivated: false,
        rumblingTime: BOSS_TOTEM.rumblingTimeMax,
        activationStage: 0,
        activationRestTime: BOSS_TOTEM.activationRestTimeMax,
        waitAtTopTime: 0,
        /** Ticks since `activated` went true; -1 while it has not. */
        sinceActivation: -1,
        /** Sticky: did this boss ever reach the walk arm? */
        walking: false,

        // ── R6 SLICE 4: THE FIGHT ─────────────────────────────────────
        /** `v.y`, written by the machine and spent by the NEXT tick (§8.16). */
        vy: 0,
        /** `_state` and the animation its setter selects. */
        state: BOSS_TOTEM_FIGHT.states.rest,
        anim: 'rest',
        currentFrame: 0,
        animate: true,
        /** ⛔ NOT restored by the 30-tick top wait (§8.11). */
        collidable: true,
        /** `rate`, ramping by `rateRate` and NEVER reset. */
        rate: 0,
        laserWidth: BOSS_TOTEM_FIGHT.laserWidthDef,
        laserHitTime: 0,
        /** The attack arm's one-shot latch, cleared in the WALK arm. */
        shot: false,
        /** `Enemy.hits` / `Enemy.hitsTimer` — the schedule's pacer. */
        hits: 0,
        hitsTimer: 0,
        destroy: false,
        /**
         * ⛓ RENDER-SIDE, AND THE LASER READS IT ONE FRAME LATE. `null` until
         * the first `renderBossTotem`, which is what makes a laser fired
         * before any render a loud failure rather than a silent `(0,0)`.
         */
        headY: null,
        /** `render()`'s white-out counter, once `destroy` is set. */
        whiteOutRenders: 0,
        /** Set by `renderBossTotem` when `FP.world.remove(this)` is called. */
        removeRequested: false,
        removed: false,
    };
}

/**
 * The pre-wake SOLID box, or `null` once the boss has activated.
 *
 * ⛔ `null` MEANS NOT SOLID, the `iceTurretRect` convention and the reverse
 * of the pushables one: the caller must not fall through to a static rect,
 * because an activated boss is `type = "Enemy"` and `"Enemy"` is not in
 * `Mobile.solids`. The player walks through it — which is the entire reason
 * the 31-tick northward window exists.
 */
export function bossTotemSolidRect(b) {
    if (b.activated) return null;
    const { w, h, ox, oy } = BOSS_TOTEM.hitbox;
    return { x: b.x - ox, right: b.x - ox + w, y: b.y - oy, bottom: b.y - oy + h };
}

/**
 * The y the clamp assigns, or `null` while it is not running.
 *
 * `y - originY + height` with `originY = -12` and `height = 32`.
 */
export function bossTotemClampY(b) {
    if (!b.fullyActivated) return null;
    const { h, oy } = BOSS_TOTEM.hitbox;
    return b.y - oy + h;
}

/** `state`'s setter — `changeAnimation(stateAnimations[state])`. */
function setBossState(b, i) {
    b.state = i;
    const next = BOSS_TOTEM_FIGHT.stateAnimations[i];
    // `if (currentAnimation != str || restart) currentFrame = 0`
    if (b.anim !== next) b.currentFrame = 0;
    b.anim = next;
}

/** `Mobile.friction()` — `v.normalize(max(v.length - f, 0))`, then the 0.05 floor. */
function bossFriction(b) {
    const len = Math.abs(b.vy);
    if (len !== 0) {
        const thickness = Math.max(len - BOSS_TOTEM_FIGHT.friction, 0);
        // `normalize` skips a zero-length vector; a zero `v` cannot get here.
        b.vy = (b.vy / len) * thickness;
    }
    // ⛓ `v.x` gets the same treatment and the boss's is 0 for ever:
    // `knockback` is overridden EMPTY and nothing else writes it.
    if (Math.abs(b.vy) < 0.05) b.vy = 0;
}

/** `Mobile.moveY(v.y)` — one-pixel sub-steps against `solids`. */
function bossMoveY(b, isSolid) {
    const rel = b.vy;
    const sign = rel > 0 ? 1 : (rel < 0 ? -1 : 0);
    let moved = 0;
    let blocked = null;
    for (let i = 0; i < Math.abs(rel); i += 1) {
        const d = Math.min(1, Math.abs(rel) - i) * sign;
        const { w, h, ox, oy } = BOSS_TOTEM.hitbox;
        if (isSolid(rect(b.x - ox, b.y + d - oy, w, h))) { blocked = true; break; }
        b.y += d;
        moved += d;
    }
    return { moved, blocked };
}

/**
 * `laserStep()` — the charge, the fire, and the 15-tick cooldown that ends
 * in the attack.
 *
 * ⛔ IT IS CALLED FROM THE WALK ARM ONLY, so the cooldown is spent WALKING
 * (still descending), and the attack does not begin until it drains. A model
 * that stepped it in the attack arm too would fire twice as often.
 */
function bossLaserStep(b, { isSolid, playerBox }, out) {
    const def = BOSS_TOTEM_FIGHT.laserWidthDef;
    if (b.laserWidth < def * 2) {
        b.laserWidth += Math.max(
            (b.laserWidth - def) / def / BOSS_TOTEM_FIGHT.chargeDivisor,
            BOSS_TOTEM_FIGHT.chargeMinIncrease,
        );
        return;
    }
    if (b.laserHitTime > 0) {
        b.laserHitTime -= 1;
        if (b.laserHitTime <= 0) {
            b.laserWidth = def;
            setBossState(b, BOSS_TOTEM_FIGHT.states.attack);
            b.vy = 0;
        }
        return;
    }
    b.laserWidth = BOSS_TOTEM_FIGHT.laserWidthFire;
    b.laserHitTime = BOSS_TOTEM_FIGHT.laserHitTimeMax;
    out.laserFired = true;
    if (isSolid) {
        out.laserRects = bossTotemLaserRects(b, isSolid);
        if (playerBox) out.laserHitCalls = bossTotemLaserHits(out.laserRects, playerBox);
    }
    // ⛓⛓ ON SCHEDULE, HIT OR MISS — the shake is written beside the rect
    // test and outside it. §11.6's band opens here whatever the stance did.
    out.shake = BOSS_TOTEM_FIGHT.laserShake;
}

/**
 * One `BossTotem.update()`, in the game's own order.
 *
 * @param {object}  b          the state, mutated
 * @param {object}  opts
 * @param {boolean} opts.wandGone      `FP.world.classCount(Wand) <= 0`
 * @param {boolean} opts.freezeObjects `Game.freezeObjects` for THIS tick
 * @param {number|null} opts.playerY   the player's y, or null if unmodelled
 * @param {?object} opts.playerBox     the player's box, for the laser and the body
 * @param {?function} opts.isSolid     `(rect) => boolean` — `"Solid"`, for
 *   `moveY` and the laser's downward sweep. Required once the boss can walk.
 * @param {?number} opts.terrainState  `Enemy.getState()` — the tile `t` under
 *   `(x, y)`. 1 (water) and 17 (lava) DESTROY him and 6 (pit) starts a fall;
 *   passing one of those throws, because none of the three is modelled and a
 *   silent pass would be a boss that survived a pit in the model only.
 *
 * @returns {object} the tick's events — see `emptyStep()` below.
 *
 * ⛔ THE CLAMP IS RETURNED, NOT APPLIED. The caller owns the player's
 * state, and a family that reached into it would be a second writer for the
 * one field the whole window's claim is about.
 */
export function stepBossTotem(b, {
    wandGone, freezeObjects, playerY = null, playerBox = null,
    isSolid = null, terrainState = null,
}) {
    const out = {
        clampedY: null, activatedNow: false, walkingNow: false,
        moved: 0, laserFired: false, laserRects: null, laserHitCalls: 0,
        attackShots: [], bodyContact: false, bodyContactRefusedAt: null,
        jumpedNow: false, landedAtTopNow: false, shake: null,
    };
    // ⛔ `if (destroy) { return; }` IS THE FIRST LINE, above the clamp and
    // above the camera block. A dying boss stops assigning the player's y on
    // the kill tick itself — which is why the white-out is a free 240 ticks
    // and not 240 more ticks of a sweeping floor.
    if (b.destroy) return out;

    // 1. the clamp, at the TOP, above everything and outside every freeze.
    //    ⛓ It reads `b.y` BEFORE this tick's movement, so the floor the
    //    player is assigned is one tick behind the body that carries it.
    if (playerY !== null && b.fullyActivated) {
        const floor = bossTotemClampY(b);
        if (playerY < floor) out.clampedY = floor;
    }
    // 2. the activation edge.
    if (wandGone && !b.activated) {
        b.activated = true;
        b.sinceActivation = 0;
        out.activatedNow = true;
    } else if (b.activated) {
        b.sinceActivation += 1;
    }
    // 3. `if (activated) { type = "Enemy"; super.update(); …ramp… }`
    if (b.activated) {
        // ── `Enemy.update` → `Mobile.mobileUpdate` ────────────────────
        // `activeOffScreen = true`, so `Enemy.update`'s onScreen early
        // return never fires — the one body in this room the camera band
        // (§11.6) cannot make uncertain.
        if (terrainState === 1 || terrainState === 17 || terrainState === 6) {
            throw new BossTotemError(`stepBossTotem: the boss is standing on tile `
                + `t=${terrainState} (water/pit/lava). \`Enemy.update\` would destroy `
                + 'him or start a pit fall, and neither is modelled. L43\'s arena is '
                + 't=5 and t=18 for every y the descent reaches — a run that gets here '
                + 'is in a room this family has never been in.');
        }
        if (!freezeObjects) {
            bossFriction(b);
            if (b.vy !== 0) {
                if (typeof isSolid !== 'function') {
                    throw new BossTotemError('stepBossTotem: the boss has a non-zero '
                        + '`v.y` and no `isSolid` — `moveY` sweeps against '
                        + '`Mobile.solids` one pixel at a time, and a mover with no '
                        + 'collision oracle walks through walls and reports a clean run. '
                        + '[[feedback_graceful_fallback_vacuous_replay]]');
                }
                out.moved = bossMoveY(b, isSolid).moved;
            }
        }
        // `hitUpdate()` then `hitPlayer()`, NEITHER freeze-gated — the drain
        // runs through a ceremony and only `Player.hit` refuses at the end.
        if (b.hitsTimer > 0) b.hitsTimer -= 1;
        const contact = bossTotemBodyContactFires(b);
        out.bodyContactRefusedAt = contact.refusedAt;
        if (contact.fires && playerBox) {
            const body = bossTotemBodyRect(b);
            if (body && playerBox.x < body.right && playerBox.right > body.x
                && playerBox.y < body.bottom && playerBox.bottom > body.y) {
                out.bodyContact = true;
            }
        }
        // the rumble countdown and the ramp — NO freeze test.
        if (b.rumblingTime > 0) b.rumblingTime -= 1;
        if (b.rumblingTime <= BOSS_TOTEM.rampGate && b.activationStage < 1) {
            const n = BOSS_TOTEM.easingN;
            b.activationStage += BOSS_TOTEM.activationRate * ((n - 1) / n)
                * Math.sin(b.activationStage * Math.PI)
                + BOSS_TOTEM.activationRate / n;
            if (b.activationStage >= 1) {
                b.activationStage = 1;
                b.fullyActivated = true;
            }
        }
    }
    // 4. the machine — freeze-gated, unlike everything above it.
    if (b.waitAtTopTime > 0) {
        // ⛔ AND THIS ARM DOES NOTHING ELSE. `collidable` was set false by
        // the jump and no arm here restores it (§8.11), so the 30-tick wait
        // is un-hittable AND contact-free from the same un-restored field.
        b.waitAtTopTime -= 1;
    } else if (b.fullyActivated && !freezeObjects) {
        if (b.activationRestTime > 0) {
            b.activationRestTime -= 1;
        } else {
            if (!b.walking) { b.walking = true; out.walkingNow = true; }
            if (b.rate < BOSS_TOTEM_FIGHT.rateMax) {
                b.rate = Math.min(b.rate + BOSS_TOTEM_FIGHT.rateRate,
                    BOSS_TOTEM_FIGHT.rateMax);
            }
            const S = BOSS_TOTEM_FIGHT.states;
            const frames = BOSS_TOTEM_FIGHT.animateFrames[b.anim];
            const step = BOSS_TOTEM_FIGHT.animateRate[b.anim] * b.rate;
            if (b.state === S.jump) {
                b.vy = BOSS_TOTEM_FIGHT.jumpRise * b.rate;
                b.collidable = false;
                b.laserWidth = BOSS_TOTEM_FIGHT.laserWidthDef;
                b.laserHitTime = 0;
                // ⛓ THE JUMP ANIMATION IS A ONE-SHOT: it clamps to the last
                // frame and sets `animate = false`, and only the walk or
                // attack arm turns it back on.
                if (b.currentFrame + step >= frames) {
                    b.currentFrame = frames - 1;
                    b.animate = false;
                }
                if (b.y <= b.startY + BOSS_TOTEM_FIGHT.jumpTopOffset) {
                    b.y = b.startY + BOSS_TOTEM_FIGHT.jumpTopOffset;
                    b.vy = 0;
                    setBossState(b, S.rest);
                    b.waitAtTopTime = BOSS_TOTEM_FIGHT.waitAtTopTimeMax;
                    out.landedAtTopNow = true;
                }
            } else if (b.state === S.attack) {
                b.animate = true;
                b.collidable = true;
                b.vy = 0;
                if (Math.floor(b.currentFrame) === BOSS_TOTEM_FIGHT.shootFrame && !b.shot) {
                    b.shot = true;
                    out.attackShots = bossTotemAttackShots(b);
                }
                if (b.currentFrame + step >= frames) setBossState(b, S.walk);
            } else {
                b.shot = false;
                b.animate = true;
                b.collidable = true;
                setBossState(b, S.walk);
                b.vy = b.rate;
                bossLaserStep(b, { isSolid, playerBox }, out);
                // ⛔ THE JUMP GATE IS **BELOW** `laserStep`, so on a tick
                // where the cooldown ends AND the floor is reached, the JUMP
                // WINS — `state = 3` overwrites the `state = 2` laserStep
                // just wrote, and the attack that was about to start never
                // happens. Transcribed in this order for exactly that case.
                if (b.y - BOSS_TOTEM.hitbox.oy + BOSS_TOTEM.hitbox.h
                    >= BOSS_TOTEM_FIGHT.maxYPosition) {
                    setBossState(b, S.jump);
                    out.jumpedNow = true;
                }
            }
            // ⛓ The anim step reads the animation the arms above just chose
            // and the `rate` this tick raised — one accumulator, stepped by
            // hand, NOT a Spritemap (§8.2's exception).
            if (b.animate) {
                b.currentFrame = (b.currentFrame
                    + BOSS_TOTEM_FIGHT.animateRate[b.anim] * b.rate)
                    % BOSS_TOTEM_FIGHT.animateFrames[b.anim];
            }
        }
    }
    return out;
}

/**
 * `BossTotem.render()`, the half the fight depends on.
 *
 * Two jobs, both of which a model that only stepped `update()` would lose:
 *
 *   1. **`headPos` for the NEXT tick's laser** — the whole reason the beam
 *      carries a one-frame lag. Written here from the animation state
 *      `update()` just left behind.
 *   2. **the white-out**, once `destroy` is set: `rumblingTime++` and
 *      `FP.world.remove(this)` at 240. ⛓ `remove` is DEFERRED — the engine
 *      loop is `update(); updateLists(); render();`, so a `remove` called in
 *      render N is drained by update N+1's `updateLists`, and `removed()`
 *      (with it `{43,5}` and `Game.shake = 60`) lands on tick N+1.
 *
 * @returns {{removeRequestedNow: boolean}}
 */
export function renderBossTotem(b) {
    const out = { removeRequestedNow: false };
    // `headPos` is computed at the TOP of render(), above the destroy block.
    b.headY = bossTotemHeadPosY(b.anim, b.currentFrame);
    if (b.destroy && !b.removeRequested) {
        b.whiteOutRenders += 1;
        if (b.whiteOutRenders >= BOSS_TOTEM_WHITE_OUT.renders) {
            b.removeRequested = true;
            out.removeRequestedNow = true;
        }
    }
    return out;
}

/**
 * The wake's tick table, DERIVED by stepping the loop above rather than
 * restated.
 *
 * `A` is the tick after `Wand.removeSelf()` — i.e. the first tick on which
 * `classCount(Wand)` is 0 — so `A + 0` is the activation tick itself.
 *
 * ⚠ `freezeUntil` is the caller's, not this family's: the rocks own the
 * freeze and `fallRock.fallRockFreezeTicks` is what prices it. It is a
 * PARAMETER here so the table can be derived without this file importing a
 * second family's arithmetic and quietly becoming its second copy.
 */
export function bossWakeTable(freezeUntil) {
    const b = createBossTotem(152, 168);
    const out = {
        activation: null, rampStarts: null, fullyActivated: null,
        clampOnset: null, restDrained: null, walkStarts: null,
    };
    let clampSeen = false;
    for (let t = 0; t < 2000; t++) {
        const frozen = t < freezeUntil;
        // ⛓ The probe player stands NORTH of the clamp, which is the only
        // stance the assignment is observable from at all.
        const r = stepBossTotem(b, { wandGone: true, freezeObjects: frozen, playerY: 100 });
        if (r.activatedNow) out.activation = t;
        if (out.rampStarts === null && b.activationStage > 0) out.rampStarts = t;
        if (out.fullyActivated === null && b.fullyActivated) out.fullyActivated = t;
        if (!clampSeen && r.clampedY !== null) { out.clampOnset = t; clampSeen = true; }
        if (out.restDrained === null && b.fullyActivated && b.activationRestTime === 0) {
            out.restDrained = t;
        }
        if (r.walkingNow) { out.walkStarts = t; break; }
    }
    if (out.walkStarts === null) {
        throw new BossTotemError('bossWakeTable: the boss never reached its walk');
    }
    return out;
}
