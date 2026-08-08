/**
 * seedlingDemo/bossTotemFight — THE FIGHT: A SWEEPING FLOOR, A BEAM WRITTEN
 * IN `render()`, AND A BODY YOU CANNOT SHOOT FAST ENOUGH TO SILENCE.
 *
 * Region-atlas Phase 8, subtractive ladder rung R6, slice 4. Brief:
 * `NewDocs/plans/seedling-bot-r6-opus-kickoff.md` §4.4, with §2.2 amended by
 * §8.11 (the sweeping floor, the un-restored `collidable`), §8.16 (the
 * one-tick `v.y` lag) and §8.10 (the death blast).
 *
 * `bossTotem.js` owns the WAKE and the one `update()` loop; this file owns
 * everything the fight arms of that loop need to consult — the animation
 * tables, the render-side head position, the laser's two rectangles, the
 * attack's projectiles, the death blast and the body's contact pricing.
 * ⛔ ONE LOOP, TWO FILES: a second `update()` here would be a second cost
 * model, and [[feedback_two_cost_models_must_agree]] is the trap that shape
 * always pays.
 *
 * ── ⛔⛔⛔ THE DESCENT IS 0.75 px/tick, NOT 1 ──────────────────────────
 *
 * §2.2 reads `v.y = rate` (ramping to 1 by `rateRate` 0.025) as "1 px/tick".
 * `Mobile.mobileUpdate` runs `friction()` BEFORE `moveY(v.y)`, and
 * `Mobile.DEFAULT_FRICTION` is 0.25 — `BossTotem` never overrides `f`. So
 * the number that reaches `moveY` is `rate - 0.25`, and the terminal descent
 * is **0.75 px/tick**; the jump is `5·rate - 0.25` = **4.75 px/tick**, not 5.
 * Every tick table below is the stepped loop, never the arithmetic.
 *
 * ── ⛔⛔ THE LASER IS TWO RECTANGLES AND THE PROBE IS A THIRD ──────────
 *
 * `getLaserRect(dir, headPos, laserPos)` sweeps downward one pixel at a time
 * from `laserStart = headPos + laserPos` looking for a `"Solid"`, then
 * returns a rectangle. **The probe column and the returned column are not
 * the same column.** The probe is
 * `x + laserTo.x*dir - int(dir<0)*laserWidth` and the rect is
 * `x + laserStart.x*dir - laserWidth/2` — for `dir = 1` the probe spans
 * `[x-8, x+10)` while the damage rect spans `[x-17, x+1)`, an 9 px offset.
 * The depth is therefore measured on a DIFFERENT column from the one that
 * hits, and a transcription that reused one for the other would be right in
 * L43 (the arena is a clean 80 px shaft) and wrong the moment it is not.
 * Both are returned, named.
 *
 * ⇒ the two damage rects are `[x-17, x+1)` and `[x-1, x+17)` — 18 px each,
 * centred on `x ∓ 8`, overlapping by 2 px in the middle. **The band the
 * player must stand out of is `[x-17, x+17)`**, and with `bosstotem@152,168`
 * (whose `x` NEVER changes — `knockback` is overridden empty and nothing
 * else writes `v.x`) that is a FIXED `[135, 169)` for the whole fight.
 *
 * ── ⛓⛓⛓ AND `headPos` IS EXACTLY ZERO-JITTER DURING THE FIGHT ────────
 *
 * §2.2 left a slice-0 probe open: whether `render()`'s two unconditional
 * `Math.random()` draws feed `headPos` during the fight or only during the
 * wake rumble. **They are multiplied by `rumble`**, which is
 * `(1 - cos(rumblingTime / 240 · 2π)) / 2`, and `rumblingTime` has been 0
 * since 240 ticks after the wake — the fight cannot start before that
 * (`activationRestTime` alone is 120 more). `rumble` is 0, so
 * `rumbleRandDist` is `(draw - 0.5) · 3 · 0` = **exactly 0**, whatever the
 * draws are. ⇒ **THE DRAWS STILL HAPPEN AND CONTRIBUTE NOTHING.** They are
 * a polluter of the stream with no consumer here
 * ([[feedback_polluter_needs_a_consumer]]), which is the same verdict §8.3
 * reached for L112 by a different route. ⚠ It comes BACK during the
 * white-out: `render()` does `rumblingTime++` once `destroy` is set.
 *
 * `Point.normalize(length / 2)` is an exact halving — the runtime computes
 * `norm = thickness / length` = `(length/2)/length` = 0.5 to the bit, and
 * skips entirely when `length` is 0 (`avm2_globals.c:993`). So the two-frame
 * blend is a plain average and `headPos.x` is 0 on every walk frame.
 *
 * ── ⛔ THE BODY IS A LIVE CONTACT AND THE SCHEDULE CANNOT SILENCE IT ──
 *
 * `Enemy.hitPlayer` fires on `hitsTimer <= 0`, and `hitUpdate()` runs
 * FIRST in the same `super.update()`. A wand shot landing on tick `T` sets
 * `hitsTimer = 20`; the boss's own `hitUpdate` on that tick takes it to 19,
 * and ticks `T+1 … T+19` take it to 0 — at which point `hitPlayer()`, four
 * lines below, sees `0` and fires. **The next shot cannot land until
 * `T+20`.** ⇒ a perfect 20-tick schedule still leaves a one-tick contact
 * window at `T+19`, every cycle, for ever. The stance does not out-run the
 * body; it stands clear of it (`py >= b.y + 46`, from the 4x5 player box at
 * origin (2,2) against `[y+12, y+44)`).
 */

import { rect } from './levelWorld.js';

export class BossTotemFightError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BossTotemFightError';
    }
}

const fail = (m) => { throw new BossTotemFightError(m); };

/**
 * `Enemies/BossTotem.as`'s fight half, transcribed. Every number is a field
 * or a const of the class, at the name the class gives it.
 */
export const BOSS_TOTEM_FIGHT = Object.freeze({
    as3: 'Enemies/BossTotem.as',
    /** `stateAnimations` — `state`'s setter runs `changeAnimation` through it. */
    stateAnimations: Object.freeze(['rest', 'walk', 'attack', 'jump', 'special']),
    states: Object.freeze({ rest: 0, walk: 1, attack: 2, jump: 3, special: 4 }),
    /** ⛓ NOT a Spritemap: `currentFrame` is stepped by hand and scaled by `rate`. */
    animateFrames: Object.freeze({ attack: 14, rest: 8, walk: 8, jump: 8 }),
    animateRate: Object.freeze({ attack: 0.3, rest: 0.1, walk: 0.2, jump: 0.5 }),
    /** `rate` ramps by `rateRate` and is NEVER reset — 40 ticks to 1. */
    rateRate: 0.025,
    rateMax: 1,
    /** `Mobile.DEFAULT_FRICTION`; `BossTotem` never overrides `f`. */
    friction: 0.25,
    /** `maxYPosition` — the gate is on `y - originY + height`, i.e. `y + 44`. */
    maxYPosition: 352,
    /** The jump ends at `startY - 32`, and the rise is `-5 * rate`. */
    jumpRise: -5,
    jumpTopOffset: -32,
    waitAtTopTimeMax: 30,
    /** `laserPos`, `laserWidthDef`, `laserHitTimeMax`, `force`. */
    laserPos: Object.freeze({ x: -8, y: -11 }),
    laserWidthDef: 6,
    laserWidthFire: 18,
    laserHitTimeMax: 15,
    laserForce: 10,
    /** `Game.shake = laserHitTimeMax * 2`, fired ON SCHEDULE, hit or miss. */
    laserShake: 30,
    /** `laserStep`'s charge arm: `+= max((w - def)/def/divisor, minIncrease)`. */
    chargeDivisor: 4,
    chargeMinIncrease: 0.01,
    /** The attack arm: two `BossTotemShot`s at `floor(currentFrame) == 7`. */
    shootFrame: 7,
    shotPosition: Object.freeze({ x: 30, y: 75 }),
    shotSpeed: Object.freeze({ x: 0, y: 2 }),
    /** ⛔ DECLARED AND NEVER READ — a census row that made it a trigger is wrong. */
    attackDistanceDeclaredNeverRead: 60,
    /** `removed()` — the SECOND shake writer in this room. */
    removedShake: 60,
    /** `render()`'s white-out: `rumblingTime++` to `rumblingTimeMax`, then `remove`. */
    whiteOutRenders: 240,
    src: Object.freeze({
        machine: 'BossTotem.as:317-405',
        laserStep: 'BossTotem.as:416-455',
        getLaserRect: 'BossTotem.as:653-666',
        hitPlayers: 'BossTotem.as:482-488',
        headPos: 'BossTotem.as:501-598 — written in render(), read by laserStep',
        superUpdateFirst: 'BossTotem.as:294-297 — `super.update()` inside `if (activated)`, '
            + 'ABOVE the machine ⇒ movement applies the PREVIOUS tick\'s v.y (§8.16)',
        collidable: 'BossTotem.as:338/358/379 — false in the jump arm, true only in the '
            + 'walk and attack arms, and the 30-tick top wait reaches NEITHER (§8.11)',
    }),
});

/**
 * The head's per-frame offsets, one row per animation (`headXxxPos`).
 *
 * ⛓ ONLY THE `y` COLUMN IS KEPT because every `x` in every one of the four
 * tables is 0 — asserted in the suite rather than assumed here, so a table
 * that gained an x would fail loudly instead of being silently dropped.
 */
export const HEAD_POS_Y = Object.freeze({
    rest: Object.freeze([0, 0, 1, 1, 2, 1, 1, 0]),
    walk: Object.freeze([0, 1, 2, 3, 4, 3, 2, 1]),
    jump: Object.freeze([0, -1, -2, -3, -4, -5, -6, -7]),
    attack: Object.freeze([0, 1, 1, 2, 2, 4, 4, 8, 6, 4, 2, 1, 1, 0]),
});

/** `defHeadPos` — `render()`'s activation-blend target. */
export const DEF_HEAD_POS = Object.freeze({ x: 0, y: 36 });

/**
 * `render()`'s `headPos`, for a boss whose `activationStage` is 1 and whose
 * `rumblingTime` is 0 — i.e. every tick of the fight.
 *
 * ⛔ THIS IS A RENDER-SIDE VALUE AND THE LASER READS IT ONE FRAME LATE.
 * `laserStep()` runs in `update()`; the `headPos` it sees was written by the
 * PREVIOUS frame's `render()`, from the animation state that frame's
 * `update()` left behind. The caller owns the lag; this function is pure.
 */
export function bossTotemHeadPosY(anim, currentFrame) {
    const table = HEAD_POS_Y[anim];
    if (!table) fail(`bossTotemHeadPosY: no head table for animation "${anim}"`);
    const frames = BOSS_TOTEM_FIGHT.animateFrames[anim];
    const frame = Math.floor(currentFrame);
    const frameUp = Math.ceil(currentFrame) % frames;
    if (!(frame >= 0 && frame < frames)) {
        fail(`bossTotemHeadPosY: currentFrame ${currentFrame} is outside "${anim}"`);
    }
    // `headPos = a.clone().add(b); headPos.normalize(headPos.length / 2)` —
    // an exact halving, and a no-op on the zero vector (same answer).
    const blended = (table[frameUp] + table[frame]) / 2;
    // `(headPos.y - defHeadPos.y) * val + defHeadPos.y + rumbleRandDist`
    // with `val = 1` and `rumbleRandDist = (draw - 0.5) * 3 * 0 = 0`.
    return (blended - DEF_HEAD_POS.y) * 1 + DEF_HEAD_POS.y;
}

/** `headPos.x` — 0 on every frame of every animation, for the same reason. */
export const HEAD_POS_X = 0;

/**
 * `laserStep()`'s charge arm, stepped.
 *
 * From `laserWidthDef` the increment is `max((w - 6)/24, 0.01)`, so the ramp
 * is 0.01/tick until `w > 6.24` and geometric after it. ⚠ SIMULATED, never
 * `log`-solved: repeated addition of 0.01 is not 24 exact hundredths and a
 * closed form would be asserting an arithmetic the game does not do.
 * [[feedback_accumulate_dont_divide_the_fade]]
 *
 * @returns {number} walk ticks from `laserWidth = 6` to the tick that FIRES.
 */
export function laserChargeTicks() {
    let w = BOSS_TOTEM_FIGHT.laserWidthDef;
    for (let i = 0; i < 100000; i += 1) {
        if (!(w < BOSS_TOTEM_FIGHT.laserWidthDef * 2)) return i;
        w += Math.max(
            (w - BOSS_TOTEM_FIGHT.laserWidthDef) / BOSS_TOTEM_FIGHT.laserWidthDef
                / BOSS_TOTEM_FIGHT.chargeDivisor,
            BOSS_TOTEM_FIGHT.chargeMinIncrease,
        );
    }
    return fail('laserChargeTicks: the laser never charged');
}

/**
 * `getLaserRect(dir, headPos, laserPos)`, both directions.
 *
 * @param {object}   b        the boss state (`x`, `y`, `laserWidth`, `headY`)
 * @param {function} isSolid  `(rect) => boolean`, the world's `"Solid"` query
 * @returns {Array<{dir, x, y, right, bottom, w, h, probeX, depth, cappedAtSweep}>}
 *
 * ⛔ `laserTo.x` NEVER MOVES — the sweep only ever adds to `y` — so the
 * returned width is exactly `laserWidth` and the height is the break index.
 * A rect whose height is the full sweep (`FP.width` = 160) is one that found
 * no floor; `cappedAtSweep` names that rather than letting 160 read as a
 * measurement.
 */
export function bossTotemLaserRects(b, isSolid) {
    if (typeof isSolid !== 'function') fail('bossTotemLaserRects needs an isSolid(rect)');
    if (b.headY === null || b.headY === undefined) {
        fail('bossTotemLaserRects: headY is unset — the laser reads the PREVIOUS '
            + 'frame\'s render() and a run that has not rendered has no rect to read');
    }
    const lw = b.laserWidth;
    const startX = HEAD_POS_X + BOSS_TOTEM_FIGHT.laserPos.x;
    const startY = b.headY + BOSS_TOTEM_FIGHT.laserPos.y;
    const SWEEP = 160;      // `FP.width`; `Main.as:36` is `super(160, 160, FPS)`
    const out = [];
    for (const dir of [1, -1]) {
        const probeX = b.x + startX * dir - (dir < 0 ? lw : 0);
        let depth = 0;
        for (; depth < SWEEP; depth += 1) {
            if (isSolid(rect(probeX, b.y + startY + depth, lw, 1))) break;
        }
        const x = b.x + startX * dir - lw / 2;
        out.push({
            dir,
            x,
            y: b.y + startY,
            right: x + lw,
            bottom: b.y + startY + depth,
            w: lw,
            h: depth,
            probeX,
            depth,
            cappedAtSweep: depth >= SWEEP,
        });
    }
    return out;
}

/**
 * `hitPlayers(players)` — `collideRectInto("Player", …)` TWICE into ONE
 * vector, then one `player.hit(null, force, new Point(player.x, y), damage)`
 * per entry.
 *
 * ⛔ A PLAYER INSIDE BOTH RECTS IS PUSHED TWICE and `hit` is called twice.
 * The second call is swallowed by the PLAYER's own i-frames, not by the
 * boss — which matters, because a model that de-duplicated the vector would
 * agree here and disagree the moment the player's timer is already 0 on some
 * other path. Returned as a COUNT so the caller applies the game's calls.
 */
export function bossTotemLaserHits(rects, playerBox) {
    let calls = 0;
    for (const r of rects) {
        if (playerBox.x < r.right && playerBox.right > r.x
            && playerBox.y < r.bottom && playerBox.bottom > r.y) calls += 1;
    }
    return calls;
}

/**
 * The body's own contact, `Enemy.hitPlayer` for this class.
 *
 * ⛓ NO `onScreen` TERM. `BossTotem`'s ctor sets `activeOffScreen = true`, so
 * `Enemy.update`'s early return never fires for him — which is the one place
 * in this room where §11.6's camera band does NOT have to be consulted.
 * ⛔ THE GATE THAT REPLACES IT IS `collidable`: `Entity.collide` opens with
 * `if (!collidable || !e) return null`, so the jump AND the 30-tick top wait
 * (which never restores the flag — §8.11) are contact-free as well as
 * un-hittable, from the SAME field.
 */
export const BOSS_TOTEM_BODY = Object.freeze({
    /** `setHitbox(80, 32, 40, -12)` ⇒ `[x-40, x+40) x [y+12, y+44)`. */
    hitbox: Object.freeze({ w: 80, h: 32, ox: 40, oy: -12 }),
    /** `Enemy.hitPlayer` — `p.hit(this, 3, new Point(x, y), damage)`. */
    force: 3,
    damage: 1,
    hitsTimerMax: 20,
    src: 'Enemy.as:211-221 + BossTotem.as:257 (`setHitbox`) and :259 (`activeOffScreen`)',
});

/** The boss's body rect at its CURRENT position, or null when un-collidable. */
export function bossTotemBodyRect(b) {
    if (!b.collidable || b.destroy) return null;
    const { w, h, ox, oy } = BOSS_TOTEM_BODY.hitbox;
    return rect(b.x - ox, b.y - oy, w, h);
}

/**
 * Does `hitPlayer()` fire this tick? `Enemy.update` runs `hitUpdate()` and
 * then `hitPlayer()`, so the timer this reads is the one AFTER the decrement.
 */
export function bossTotemBodyContactFires(b) {
    if (b.destroy) return { fires: false, refusedAt: 'destroy' };
    if (!b.collidable) return { fires: false, refusedAt: 'collidable' };
    if ((b.hitsTimer ?? 0) > 0) return { fires: false, refusedAt: 'hitsTimer' };
    return { fires: true, refusedAt: null };
}

/**
 * `Enemy.hit`, for THIS class's overrides.
 *
 * `BossTotem.hit` wraps `super.hit` in `fullyActivated && activationRestTime
 * <= 0`, and `Enemy.hit`'s own five terms follow. `hits += d` with `d = 0.5`
 * against `hitsMax = 5` ⇒ **TEN shots**; `knockback` is overridden EMPTY so
 * a landed shot does not move him a pixel.
 *
 * @returns {{landed: boolean, refusedAt: string|null, killed: boolean}}
 */
export function bossTotemTakesHit(b, { type = 'Wand', damage = 0.5, freezeObjects = false } = {}) {
    if (!b.fullyActivated) return { landed: false, refusedAt: 'fullyActivated', killed: false };
    if (b.activationRestTime > 0) {
        return { landed: false, refusedAt: 'activationRestTime', killed: false };
    }
    if (b.hitsTimer > 0) return { landed: false, refusedAt: 'hitsTimer', killed: false };
    if (freezeObjects) return { landed: false, refusedAt: 'freezeObjects', killed: false };
    if (type !== 'Wand') return { landed: false, refusedAt: 'onlyHitBy', killed: false };
    if (!(b.hits < BOSS_TOTEM_KILL.hitsMax)) {
        return { landed: false, refusedAt: 'hits >= hitsMax', killed: false };
    }
    b.hits += damage;
    b.hitsTimer = BOSS_TOTEM_BODY.hitsTimerMax;
    const killed = b.hits >= BOSS_TOTEM_KILL.hitsMax;
    if (killed) b.destroy = true;
    return { landed: true, refusedAt: null, killed };
}

/** `hitsMax = 5` against a shot damage of 0.5 — the ten-shot schedule. */
export const BOSS_TOTEM_KILL = Object.freeze({
    hitsMax: 5,
    shotDamage: 0.5,
    shots: 10,
    /** The boss's own `hitsTimerMax`, which PACES the schedule (§10.2). */
    cadence: 20,
    onlyHitBy: 'Wand',
});

/**
 * `Game.cameraTarget`, written at the BOTTOM of `BossTotem.update()` on
 * every frame he exists.
 *
 * ```as3
 *   if (p && Math.abs(y - p.y) <= FP.screen.height * 3/4
 *         && Math.abs(x - p.x) <= FP.screen.width * 3/4)
 *       Game.cameraTarget = new Point((x + p.x)/2 - 80, (y + p.y)/2 - 80);
 *   else Game.resetCamera();
 * ```
 *
 * ⛔ IT REPLACES THE FOLLOW, INCLUDING THE INVENTORY TERM. `Game.view`'s own
 * target is `player.x - 80 - INVENTORY_TERM`; this one has no such term, so
 * the camera JUMPS by that offset on the tick the boss first comes in range
 * and back on the tick he dies. A model that added the boss's target to the
 * player's would be off by it for the whole fight.
 *
 * ⛓ THE BOX IS A ¾-SCREEN BOX ON *BOTH* AXES and it is a `<=`. Outside it
 * the boss RESETS the camera — which is `(-1,-1)`, i.e. back to the follow,
 * not "leave it alone".
 *
 * @returns {{x,y}} the target, or `{x:-1, y:-1}` for `Game.resetCamera()`.
 */
export function bossTotemCameraTarget(b, player) {
    const SCREEN = 160;
    const box = SCREEN * 3 / 4;
    if (Math.abs(b.y - player.y) <= box && Math.abs(b.x - player.x) <= box) {
        return { x: (b.x + player.x) / 2 - SCREEN / 2, y: (b.y + player.y) / 2 - SCREEN / 2 };
    }
    return { x: -1, y: -1 };
}

// ── THE ATTACK'S PROJECTILES ──────────────────────────────────────────

/**
 * `Projectiles/BossTotemShot.as`, transcribed.
 *
 * ⛔⛔ `f = 0` — the ONE `Mobile` in this room with no friction, so its
 * velocity really is the ctor's `(0, 2)` and stays it. (The boss's own does
 * not: see the file header.)
 * ⛔ `solids = []` and the `"Solid"` arm of its own hit loop flips `v.x` —
 * which for `v.x = 0` flips NOTHING. ⇒ **a BossTotemShot is never destroyed
 * by a wall**; it falls until `y + 8 >= 384` or until it leaves the screen.
 */
export const BOSS_TOTEM_SHOT = Object.freeze({
    as3: 'Projectiles/BossTotemShot.as',
    /** `setHitbox(16, 16, 8, 8)`. */
    hitbox: Object.freeze({ w: 16, h: 16, ox: 8, oy: 8 }),
    /** `roomBottom` — the gate is `y - originY + height >= 384`, i.e. `y >= 376`. */
    roomBottom: 384,
    bottomY: 376,
    friction: 0,
    /** `hitables` — the types it collects, in the ctor's order. */
    hitables: Object.freeze(['Player', 'Solid']),
    /** `(hits[i] as Player).hit(null, v.length, new Point(x, y))` — d DEFAULTS to 1. */
    playerForceIsSpeed: true,
    playerDamage: 1,
    /** The death `Explosion(x + v.x, y + v.y, hitables, 24, 1)` ⇒ radius 15.6. */
    explosionRadius: 24,
    explosionHitRadius: 24 * 0.65,
    explosionDamage: 1,
    /** `onScreen((graphic as Spritemap).width)` — a 20 px margin, camera-relative. */
    onScreenMargin: 20,
});

/** One shot, at the entity point the attack arm spawns it at. */
export function createBossTotemShot(x, y, vx, vy) {
    return { x, y, vx, vy, removed: false, exploded: false };
}

/** The two shots one `shootFrame` publishes, in `FP.world.add` order. */
export function bossTotemAttackShots(b) {
    const { x: sx, y: sy } = BOSS_TOTEM_FIGHT.shotPosition;
    const { x: vx, y: vy } = BOSS_TOTEM_FIGHT.shotSpeed;
    return [
        createBossTotemShot(b.x + sx, b.y + sy, vx, vy),
        // ⛓ `new Point(-shotSpeed.x, shotSpeed.y)` — a NEGATED ZERO on the x
        // axis. `-0` and `0` compare equal and `FP.sign(-0)` is 0 either way,
        // so this is a difference the game cannot observe; kept because the
        // source has it and a reader who saw `vx: 0` twice would wonder.
        createBossTotemShot(b.x - sx, b.y + sy, -vx, vy),
    ];
}

/** The shot's box at its current point. */
export function bossTotemShotRect(s) {
    const { w, h, ox, oy } = BOSS_TOTEM_SHOT.hitbox;
    return rect(s.x - ox, s.y - oy, w, h);
}

/**
 * One `BossTotemShot.update()`.
 *
 * ── ⛔⛔⛔ THE OFF-SCREEN REMOVAL IS A BAND QUESTION, AND IT IS ALWAYS
 *    UNCERTAIN AFTER THE FIRST VOLLEY ────────────────────────────────
 *
 * The laser writes `Game.shake = 30` on schedule and §11.6's band never
 * closes, so from the first volley onward `onScreen` is three-valued for
 * every body near a screen edge — and these shots END at the bottom edge by
 * construction. A blanket refusal would make the window unwritable: the
 * attack fires 39 ticks after the first laser whatever the stance does.
 *
 * ⇒ **`'uncertain'` RESOLVES TO THE SURVIVING BRANCH, AND THAT IS SOUND
 * RATHER THAN OPTIMISTIC.** A removed shot does *nothing*: it is not a
 * solid for any mover (`solids = []` and its own type is in no list), it
 * moves nothing, and its `Explosion` never happens. A surviving shot can do
 * two things and both are strictly more. So the surviving branch is an
 * OVER-APPROXIMATION of the removed one, and the two are observationally
 * identical exactly when the surviving branch touches nothing.
 *
 * The caller therefore drives the surviving branch and REFUSES only if it
 * touches the player — which is the assertion that makes the window's claim
 * hold in both worlds instead of in the one it happened to pick.
 * `removalUncertain` is the flag that says the caller owes that check.
 *
 * @returns {{fate: 'flying'|'hitPlayer'|'bottom'|'offScreen',
 *            explodeAt: {x,y}|null, playerHit: boolean,
 *            removalUncertain: boolean}}
 */
export function stepBossTotemShot(s, { playerBox = null, onScreenVerdict = 'on' } = {}) {
    if (s.removed) {
        return { fate: 'flying', explodeAt: null, playerHit: false, removalUncertain: false };
    }
    // `super.update()` — Mobile: friction (f = 0, a no-op), then moveX/moveY.
    // `solids = []`, so neither move can be blocked by anything.
    s.x += s.vx;
    s.y += s.vy;
    // The hit loop: `collideTypesInto(["Player","Solid"], x, y, hits)`.
    // "Solid" only ever flips `v.x`, which is 0 — transcribed as the no-op
    // it is rather than dropped, so a future non-zero `v.x` is a code change
    // and not a silent divergence.
    let playerHit = false;
    if (playerBox) {
        const box = bossTotemShotRect(s);
        if (box.x < playerBox.right && box.right > playerBox.x
            && box.y < playerBox.bottom && box.bottom > playerBox.y) playerHit = true;
    }
    const atBottom = s.y - BOSS_TOTEM_SHOT.hitbox.oy + BOSS_TOTEM_SHOT.hitbox.h
        >= BOSS_TOTEM_SHOT.roomBottom;
    if (playerHit || atBottom) {
        s.removed = true;
        s.exploded = true;
        return {
            fate: playerHit ? 'hitPlayer' : 'bottom',
            explodeAt: { x: s.x + s.vx, y: s.y + s.vy },
            playerHit,
            removalUncertain: false,
        };
    }
    // ⛔ AND THE OFF-SCREEN TEST RUNS **AFTER** the bottom test, so a shot
    // that reaches `roomBottom` on the tick it also leaves the view still
    // explodes. The order is the whole difference between a blast and a
    // silent removal.
    if (onScreenVerdict === 'off') {
        s.removed = true;
        return { fate: 'offScreen', explodeAt: null, playerHit: false, removalUncertain: false };
    }
    return {
        fate: 'flying', explodeAt: null, playerHit: false,
        removalUncertain: onScreenVerdict === 'uncertain',
    };
}

// ── THE DEATH ─────────────────────────────────────────────────────────

/**
 * The death blast, per §8.10: `Enemy.dieEffects("Wand")` →
 * `Explosion(x, y, ["Player","Enemy"], max(width, height) = 80, 1)`, whose
 * ctor does `radius *= 0.65` ⇒ **52**, and whose `added()` does a SQUARE
 * prefilter and then an **origin-to-origin** `FP.distance <= 52`.
 *
 * ⛔ ABOUT THE POINT THE BOSS DIED AT, WHICH THE DESCENT MOVED. The kill can
 * land anywhere in `y ∈ [136, 308]`, so the safe set is not a fixed disc; it
 * is a disc about wherever the tenth shot caught him.
 *
 * ⛓ `added()` fires when `updateLists()` runs — the END of the death tick.
 * One tick of offset, named: a player who is outside the disc on the death
 * tick and inside it one tick later is HIT.
 */
export const BOSS_TOTEM_DEATH_BLAST = Object.freeze({
    visualRadius: 80,
    radiusCoeff: 0.65,
    radius: 52,
    force: 4,
    damage: 1,
    /** `added()` runs at the end of the tick `startDeath` was called on. */
    appliesOnTick: '+1 — `updateLists()` drains `_add` after `World.update`',
    test: 'origin-to-origin: `FP.distance(x, y, c.x, c.y) <= 52`, NOT a rect overlap',
    prefilter: 'collideRectInto(type, x-52, y-52, 104, 104) — a SQUARE, then the disc',
});

/**
 * Is a point inside the blast? `FP.distance` is Euclidean and the test is
 * `<=`, so the boundary is INSIDE.
 */
export function bossTotemDeathBlastHits(blastX, blastY, px, py) {
    const dx = px - blastX;
    const dy = py - blastY;
    return Math.sqrt(dx * dx + dy * dy) <= BOSS_TOTEM_DEATH_BLAST.radius;
}

/**
 * The square prefilter, so a caller can show that the disc and the square
 * disagree — they do, on the corners, and a model that used the square
 * would report a hit 21 px outside the blast.
 */
export function bossTotemDeathBlastPrefilter(blastX, blastY) {
    const r = BOSS_TOTEM_DEATH_BLAST.radius;
    return rect(blastX - r, blastY - r, r * 2, r * 2);
}

/**
 * The white-out, and the two writes at its end.
 *
 * ⛓ THE COUNTER IS A RENDER COUNTER. `render()` does `rumblingTime++` and
 * removes at `>= rumblingTimeMax`, so the span is 240 RENDER frames, not 240
 * updates — identical here (the engine renders every frame it updates) and
 * named because the two clocks are not the same clock.
 *
 * ⛓ AND `Game.cameraTarget` IS FROZEN THROUGH IT (§8.16): `update()` returns
 * at `if (destroy)` above the camera block, so the last midpoint written
 * before the kill is the camera for all 240 frames.
 */
export const BOSS_TOTEM_WHITE_OUT = Object.freeze({
    renders: 240,
    counter: 'rumblingTime, incremented in render() once `destroy` is set',
    cameraFrozen: true,
    /** `removed()`, guarded by `doActions`. */
    onRemoved: Object.freeze([
        'Game.resetCamera()',
        'undrawCover()',
        'Game.levelMusics[level] = -1',
        'Main.unlockMedal(badges[6])',
        'Game.shake = 60',
        'Game.setPersistence(tag, false)',
    ]),
    /**
     * ⛔ THE POLARITY. `setPersistence(tag, false)` with `tag = 5` — and the
     * ledger reads `{43,5}` as the KILL. `Game.setPersistence(t, v)` writes
     * `persistence[level][t] = v`, so the boss's row goes FALSE when he dies
     * and `check()` (which removes him when `!checkPersistence(tag)`) is what
     * makes the write mean "dead". Same shape as the MagicalLock's (§10.8),
     * and the OPPOSITE of what "a kill sets a flag" suggests.
     */
    persistenceWrite: Object.freeze({ level: 43, tag: 5, value: false }),
});

/**
 * `check()` on a LATER visit: `doActions = false` then `FP.world.remove` —
 * so a re-entry removes the corpse with every side effect suppressed.
 */
export function bossTotemReentryRemoves(persistenceOn) {
    return { removed: !persistenceOn, doActions: false, sideEffects: [] };
}
