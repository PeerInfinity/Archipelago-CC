/**
 * seedlingDemo/turret — ⛓⛓⛓ U15-swim D1: `Turret` + `TurretSpit`, TRANSCRIBED.
 *
 * The shooter that stopped the campaign chain at route step 27. U14's L29 walk
 * (`r9-solve-29`, the Green Key) passes 15.9 px from `turret@80,176`, and the
 * game's `TurretSpit` knocks the player at t196: `hits` 1 and no Green Key. The
 * model stepped neither class (`combat.js` priced the turret as a 64 px volume).
 * Brief: swim U15 (⚖ Q47). Source, read whole: `Enemies/Turret.as`,
 * `Projectiles/TurretSpit.as`, `Enemies/Enemy.as`, `Mobile.as`,
 * `net/flashpunk/graphics/Spritemap.as:69-101`, `net/flashpunk/World.as:47-61`,
 * `net/flashpunk/Entity.as:130-137` (`onScreen`), `FP.as:233-241`
 * (`angle_difference`), `Player.as:1138-1146,1181-1256` (the shield entity).
 *
 * ⛓ THE PRECEDENT IS `iceTurret.js` + `iceTurretBlast.js`. `Turret` is the same
 * aim-and-fire block with other numbers, and `TurretSpit` is the same projectile
 * with two differences that both matter: it KNOCKS (`hit(null, v.length, p)`,
 * force ≈ 3, where the blast passes 0 and freezes instead), and it has an
 * OFF-SCREEN CULL (`if (!onScreen(12)) remove`), which the blast has not.
 *
 * ── THE AS3 (`Turret.update`, in source order) ──────────────────────────
 *
 * ```
 *   super.update();                              // Enemy.update (onScreen-gated
 *                                                // hitUpdate/hitPlayer)
 *   if (Game.freezeObjects || destroy || currentAnim == "die") return;
 *   player = nearestToEntity("Player");
 *   if (player) {
 *     var d:int = FP.distance(x, y, player.x, player.y);           // TRUNCATED
 *     if (d <= 64 && anim != "startshot" && anim != "finishshot") {
 *       angle += angle_difference(-atan2(p.y - y, p.x - x), angle/180*PI) * 180/PI / 10;
 *       if (shootTimer > 0) shootTimer--;
 *       else if (hitsTimer <= 0) { shootTimer = 40; play("startshot"); }
 *     } else shootTimer = 40;                     // RE-ARMED every animation tick
 *   }
 *   if (currentAnim == "") frame = 0;
 * ```
 *
 * then `World.update` runs the Spritemap in the SAME slot (`World.as:58`), and
 * `endAnim`'s `case "startshot"` plays "finishshot" and ADDS the spit:
 * `new TurretSpit(x, y, Point(3 cos a, 3 sin a))`, `a = -angle/180*PI`.
 *
 * ⛓ THE CLOCK, SIMULATED (`turretCadence`, below): both animations are two
 * frames at rate 10 under `FP.elapsed` = 0.0333, so each wraps on its SEVENTH
 * update (0.333 × 3 = 0.999 misses the `>= 1` by 0.001). The spit is added on
 * the play tick + 6, first updates on + 7 (the add is deferred and PREPENDED),
 * the turret idles from + 14, and the next play is + 54: the 40 re-armed by
 * every animation tick, then 40 decrements. A turret in range from its first
 * frame fires on tick ONE (`shootTimer` is seeded 0); one the player walks into
 * plays 40 ticks after the entry tick.
 *
 * ── `TurretSpit.update` ───────────────────────────────────────────────────
 *
 * ```
 *   super.update();                // Mobile: if (!freezeObjects) { friction();
 *                                  //   moveX(v.x); moveY(v.y) }  — solids = []
 *   if (v.length > 0) {
 *     collideTypesInto(["Player","Tree","Solid","Shield"], x, y, hits);
 *     for each: "Player" -> hit(null, v.length, Point(x, y));     // "Enemy" arm DEAD
 *     if (hits.length > 0) remove(this);
 *   }
 *   if (!onScreen(12)) remove(this);   // 12 = the spritemap's width
 * ```
 *
 * ⛔ `"Shield"` IS THE PLAYER'S OWN SHIELD ENTITY (`Player.addShield`,
 * `shieldObj.type = "Shield"`), whose box `Player.render` places — so a spit
 * that meets the shield side of a player is removed WITHOUT a hit. The box is
 * `bobBossFight.playerShieldRect` at the previous frame's render; the caller
 * hands it in.
 *
 * ⛔ `hit(null, …)`: `e` is null, so the dark suit does not retaliate (R1's
 * `playerDamage` contract) — `retaliate: null` at the funnel.
 *
 * ⚠ `Music.playSoundDistPlayer(x, y, "Turret Shoot")` in the spit's ctor
 * passes `intInd = -1`, so `Music.playSound` draws `Rng.cos()` for the index on
 * every spawn: the COSMETIC stream under the campaign's `rng.split`, the shared
 * one without it. The model transports the streams and simulates no draw.
 *
 * ── WHAT IS REFUSED, AND WHERE ────────────────────────────────────────────
 *
 * The turret's own damage is not modelled: a press that reaches one is
 * refused by `levelRun`'s press audit (`KILL_ARM_POLICY.Turret`), so
 * `hitsTimer` stays 0 and the `destroy`/"die" gate never closes. Its 16x16
 * body contact (`Enemy.hitPlayer`) is the census scan's, as before.
 */

import { rect, rectsOverlap } from './levelWorld.js';
// `_timer += _anim._frameRate * FP.elapsed`, `FP.elapsed` pinned at
// `Engine.MAX_ELAPSED` — one transcription of that constant for the package.
import { FP_ELAPSED } from './chasers.js';
import { defineRecord } from './entityRecords.js';

export class TurretError extends Error {
    constructor(message) { super(message); this.name = 'TurretError'; }
}
const fail = (m) => { throw new TurretError(m); };

/** `FP.sign` (`FP.as:142-145`). */
const fpSign = (n) => (n < 0 ? -1 : (n > 0 ? 1 : 0));

/**
 * `Turret`'s constructor numbers, verbatim (`Enemies/Turret.as:17-37`). An
 * `.oel` decides only the position (`Game.as:2272` passes `o.@x, o.@y`).
 */
export const TURRET = defineRecord('turret', {
    /** `super(_x + Tile.w/2, _y + Tile.h/2)` — the entity point is the cell centre. */
    ctor: { dx: 8, dy: 8 },
    /** `setHitbox(16, 16, 8, 8)`. */
    hitbox: { w: 16, h: 16, originX: 8, originY: 8 },
    attackRange: 64,
    /** ⛔ `var d:int = FP.distance(...)` — truncated, so the bound is d < 65. */
    rangeIsTruncated: true,
    shootTimerMax: 40,
    shotSpeed: 3,
    angleSpeedDivisor: 10,
    /** `attackAnimSpeed` — the frameRate of both shot animations. */
    attackAnimSpeed: 10,
    /**
     * `add(name, frames, rate)` defaults `loop` to TRUE, so both shot
     * animations reach `endAnim` on the WRAP, not on a completion.
     */
    anims: {
        startshot: { frames: 2, rate: 10, loop: true },
        finishshot: { frames: 2, rate: 10, loop: true },
        /** ⛔ Unreachable here: the press that would start it is refused. */
        die: { frames: 6, rate: 10, loop: true },
        hit: { frames: 1, rate: 0, loop: true },
    },
    /** `knockback` is an EMPTY override (`Turret.as:86-89`). */
    knockback: 'empty override — `Turret.as:86-89`',
    src: 'Enemies/Turret.as:17-37 (ctor), :45-79 (update), :97-114 (endAnim); '
        + 'Game.as:2272 (the add, after the Player at :2227)',
}, { doc: ['src', 'knockback'], src: 'turret.js' });

/** `Projectiles/TurretSpit.as`'s numbers, verbatim. */
export const TURRET_SPIT = defineRecord('turretSpit', {
    /** `setHitbox(4, 4, 2, 2)` — a 4x4 box centred on the entity point. */
    hitbox: { w: 4, h: 4, originX: 2, originY: 2 },
    type: 'TurretSpit',
    /** ⛔ The ONLY thing that stops a spit: `solids = []`. */
    hitables: ['Player', 'Tree', 'Solid', 'Shield'],
    /** `f = 0`: no decay, but `friction()`'s two zeroing tests still run. */
    friction: 0,
    frictionZero: 0.05,
    /** `Turret.shotSpeed`. */
    speed: 3,
    /** `onScreen((graphic as Spritemap).width)` — `new Spritemap(img, 12, 8)`. */
    cullMargin: 12,
    /** `Player.hit(null, v.length, …)` — the damage is `hit`'s default 1. */
    damage: 1,
    /** ⛔ The `"Enemy"` arm is DEAD: `"Enemy"` is not in `hitables`. */
    deadSwitchArm: 'Enemy',
    sound: 'Turret Shoot at spawn, intInd -1 (one Rng.cos() index draw) — no gameplay reader',
    src: 'Projectiles/TurretSpit.as (whole class); Mobile.as:284-376',
}, { doc: ['src', 'sound'], src: 'turret.js' });

/** One turret, from its `.oel` placement. */
export function createTurret(x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
        fail(`createTurret: (${x},${y}) must be the OEL integer placement`);
    }
    return {
        id: `turret@${x},${y}`,
        x: x + TURRET.ctor.dx,
        y: y + TURRET.ctor.dy,
        /** `sprTurret.angle`, DEGREES, an unbounded accumulator (`Image.angle`). */
        angle: 0,
        /** Seeded 0 — a turret in range on its first frame fires on it. */
        shootTimer: 0,
        /** ⛔ Always 0 here: the press arm that would set it is refused. */
        hitsTimer: 0,
        /** The Spritemap: `currentAnim` ("" until something plays), `_index`, `_timer`. */
        anim: '',
        animIndex: 0,
        animTimer: 0,
        /** A monotonic counter, for spit ids. Not a game field. */
        shots: 0,
        /** The spit THIS tick's `endAnim` produced, or null. */
        spawned: null,
    };
}

/** The 16x16 body. */
export function turretRect(t) {
    const b = TURRET.hitbox;
    return rect(t.x - b.originX, t.y - b.originY, b.w, b.h);
}

/** `FP.angle_difference` (`FP.as:233-241`) — ONE wrap each way, not a modulo. */
function angleDifference(a0, a1) {
    let d = a0 - a1;
    if (d < -Math.PI) d += 2 * Math.PI;
    if (d > Math.PI) d -= 2 * Math.PI;
    return d;
}

/** `var d:int = FP.distance(x, y, player.x, player.y)` — `int()` truncates. */
export function turretDistance(t, player) {
    return Math.trunc(Math.sqrt((player.x - t.x) * (player.x - t.x)
        + (player.y - t.y) * (player.y - t.y)));
}

/** `d <= attackRange`, on the truncated distance. */
export function turretInRange(t, player) {
    return turretDistance(t, player) <= TURRET.attackRange;
}

/** The aim-and-fire block, below the freeze return. */
function turretAim(t, player) {
    if (!player) return;
    if (turretInRange(t, player) && t.anim !== 'startshot' && t.anim !== 'finishshot') {
        t.angle += (angleDifference(
            -Math.atan2(player.y - t.y, player.x - t.x),
            (t.angle / 180) * Math.PI,
        ) * 180) / Math.PI / TURRET.angleSpeedDivisor;
        if (t.shootTimer > 0) {
            t.shootTimer -= 1;
        } else if (t.hitsTimer <= 0) {
            t.shootTimer = TURRET.shootTimerMax;
            // `play("startshot")`: `_index = 0; _timer = 0; complete = false`.
            t.anim = 'startshot';
            t.animIndex = 0;
            t.animTimer = 0;
        }
    } else {
        t.shootTimer = TURRET.shootTimerMax;
    }
}

/**
 * `Spritemap.update()`, in `World.update`'s slot right after the entity's own
 * update — and NOT freeze-gated: a shot already in the barrel leaves on
 * schedule through a ceremony.
 *
 * @returns {?object} the spit a `startshot` wrap spawned
 */
function turretAnimStep(t) {
    const a = TURRET.anims[t.anim];
    if (!a || a.rate === 0) return null;
    t.animTimer += a.rate * FP_ELAPSED;
    while (t.animTimer >= 1) {
        t.animTimer -= 1;
        t.animIndex += 1;
        if (t.animIndex === a.frames) {
            t.animIndex = 0;
            if (t.anim === 'startshot') {
                // `endAnim`: play("finishshot") FIRST (which zeroes `_timer`, so
                // the `while` exits), then the spit, at the turret's entity point.
                const deg = t.angle;
                t.anim = 'finishshot';
                t.animIndex = 0;
                t.animTimer = 0;
                t.shots += 1;
                return spawnSpit(`${t.id}#${t.shots}`, t.x, t.y, deg);
            }
            if (t.anim === 'finishshot') {
                // `default: play("")` — no such anim: `complete`, `currentAnim` "".
                t.anim = '';
                t.animIndex = 0;
                t.animTimer = 0;
                return null;
            }
            return null;
        }
    }
    return null;
}

/**
 * ONE game tick of `Turret.update()` plus its graphic pass.
 *
 * @param {object} t
 * @param {object} ctx
 * @param {boolean} ctx.frozen  `Game.freezeObjects` — returns above the aim;
 *   the animation still runs
 * @param {?{x:number,y:number}} ctx.player  the player's ENTITY point as the
 *   previous tick left it (the turret updates before the player)
 */
export function stepTurret(t, ctx = {}) {
    const { frozen = false, player = null } = ctx;
    t.spawned = null;
    if (!frozen) turretAim(t, player);
    t.spawned = turretAnimStep(t);
    return t;
}

/** One spit. `x`/`y` are the ctor's `_x:int, _y:int` — truncated here. */
export function createTurretSpit(id, x, y, vx, vy) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) fail(`createTurretSpit: (${x},${y})`);
    return {
        id,
        x: Math.trunc(x),
        y: Math.trunc(y),
        v: { x: vx, y: vy },
        spawnedAt: null,
        removed: false,
        /** `hit` | `cull` once removed. */
        removedBy: null,
        hitTypes: null,
    };
}

/** `endAnim`'s spawn: `a = -angle/180*PI`, `v = (3 cos a, 3 sin a)`. */
export function spawnSpit(id, x, y, angleDeg) {
    const a = (-angleDeg / 180) * Math.PI;
    return createTurretSpit(id, x, y, TURRET_SPIT.speed * Math.cos(a),
        TURRET_SPIT.speed * Math.sin(a));
}

/** The 4x4 box. */
export function turretSpitRect(s) {
    const b = TURRET_SPIT.hitbox;
    return rect(s.x - b.originX, s.y - b.originY, b.w, b.h);
}

/** `Point.length`. */
export function spitSpeed(s) {
    return Math.sqrt(s.v.x * s.v.x + s.v.y * s.v.y);
}

/** `Mobile.moveX`/`moveY` with `solids = []`: 1 px sub-steps, all free. */
function moveAxis(s, axis, rel) {
    const n = Math.abs(rel);
    for (let i = 0; i < n; i += 1) s[axis] += Math.min(1, n - i) * fpSign(rel);
}

/**
 * ONE game tick of `TurretSpit.update()`.
 *
 * @param {object} s
 * @param {object} ctx
 * @param {boolean} ctx.frozen  gates the MOVE only
 * @param {?object} ctx.playerBox  the player's box
 * @param {?object} ctx.shieldBox  the player's shield entity box, or null
 * @param {?function} ctx.blockedAt  `(rect) => boolean`, a `Tree`/`Solid`/`Shield`
 * @param {?function} ctx.onScreen  `(rect, margin) => boolean`, `Entity.onScreen`
 * @returns {{hitPlayer:boolean, removed:boolean, hitTypes:?Array, culled:boolean}}
 */
export function stepTurretSpit(s, ctx = {}) {
    const {
        frozen = false, playerBox = null, shieldBox = null, blockedAt = null, onScreen = null,
    } = ctx;
    const none = { hitPlayer: false, removed: s.removed, hitTypes: s.hitTypes, culled: false };
    if (s.removed) return none;
    if (!frozen) {
        // `friction()` with f = 0: `normalize(len/len)` is the identity; the
        // zeroing tests are not.
        if (Math.abs(s.v.x) < TURRET_SPIT.frictionZero) s.v.x = 0;
        if (Math.abs(s.v.y) < TURRET_SPIT.frictionZero) s.v.y = 0;
        moveAxis(s, 'x', s.v.x);
        moveAxis(s, 'y', s.v.y);
    }
    const box = turretSpitRect(s);
    let hitPlayer = false;
    if (spitSpeed(s) > 0) {
        const types = [];
        if (playerBox && rectsOverlap(box, playerBox)) types.push('Player');
        if (blockedAt && blockedAt(box)) types.push('Solid');
        if (shieldBox && rectsOverlap(box, shieldBox)) types.push('Shield');
        if (types.length > 0) {
            s.removed = true;
            s.removedBy = 'hit';
            s.hitTypes = types;
            hitPlayer = types.includes('Player');
        }
    }
    // `if (!onScreen(width)) remove(this)` — below the collision, every tick.
    if (!s.removed && onScreen && !onScreen(box, TURRET_SPIT.cullMargin)) {
        s.removed = true;
        s.removedBy = 'cull';
        return { hitPlayer: false, removed: true, hitTypes: null, culled: true };
    }
    return { hitPlayer, removed: s.removed, hitTypes: s.hitTypes, culled: false };
}

/**
 * ⛓ THE CADENCE, SIMULATED rather than divided — `stepTurret` itself, on a
 * player standing in range. Offsets are from the `play("startshot")` tick.
 */
export function turretCadence() {
    const t = createTurret(0, 0);
    const near = { x: t.x + 1, y: t.y };
    let tick = 0;
    const plays = [];
    let spawn = null;
    let idle = null;
    while (plays.length < 2 && tick < 1000) {
        const before = t.anim;
        stepTurret(t, { player: near });
        if (before !== 'startshot' && t.anim === 'startshot') plays.push(tick);
        if (t.spawned && spawn === null) spawn = tick;
        if (before === 'finishshot' && t.anim === '' && idle === null) idle = tick + 1;
        tick += 1;
    }
    if (plays.length < 2) fail('turretCadence: the turret never fired twice');
    return Object.freeze({
        /** Seeded `shootTimer` 0: a turret in range from its first frame plays on it. */
        firstPlayTick: plays[0],
        spawnAfterPlay: spawn - plays[0],
        /** The spit is added at the end of that frame and first updates on the next. */
        firstSpitUpdateAfterPlay: spawn - plays[0] + 1,
        idleAfterPlay: idle - plays[0],
        periodTicks: plays[1] - plays[0],
        /** A player who ENTERS range at tick E: 40 decrements E..E+39, the play at E+40. */
        playAfterEntry: TURRET.shootTimerMax,
    });
}

export const TURRET_CADENCE = turretCadence();
