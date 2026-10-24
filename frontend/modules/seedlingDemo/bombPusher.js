/**
 * seedlingDemo/bombPusher — ⛓⛓⛓ seedling-fidelity-bombpusher D2: `BombPusher` + `Bomb` + its `Explosion`, TRANSCRIBED.
 *
 * The lobber that refuted L40BUTTON's damage-on walks. `bombpusher@112,128` (L40, the game's only one) lobs a `Bomb`
 * at the player whenever they stand within 256 px; the model stepped no emitter, so model and solver saw a quiet room
 * (`combat.js` described it, `entityBlocks` tagged it, `enemyDamage` marked it inert). Source, read whole:
 * `Enemies/BombPusher.as`, `Projectiles/Bomb.as`, `Projectiles/Explosion.as`, `Mobile.as:26-117`,
 * `Enemies/Enemy.as:62-112`, `net/flashpunk/graphics/Spritemap.as:69-141`, `net/flashpunk/World.as:895-934`
 * (`updateLists`), `Player.as:1374-1401,1493-1513` (`hit`, `knockback`), `Game.as:2250,2299` (the adds).
 *
 * ── `BombPusher.update` (`BombPusher.as:37-50`) ─────────────────────────
 *
 * ```
 *   p = nearestToPoint("Player", x, y);
 *   if (shotTime > 0) shotTime--;
 *   else if (shotTime == 0 && p && FP.distance(x, y, p.x, p.y) <= maxDistance) { shotTime = -1; play("shoot"); }
 *   super.update();                    // Enemy.update: `activeOffScreen` (:34) — never camera-gated; v = 0
 * ```
 *
 * then `World.update` runs the Spritemap in the SAME slot. `endAnim` (`:52-64`) on the "shoot" WRAP (`add` defaults
 * `loop` to true): `shotTime = 15; add(new Bomb(x, y, Point(p.x, p.y))); play("sit")`. ⛔ NO FREEZE TEST anywhere in
 * the class: the clock and the anim run through a ceremony's frozen frames.
 *
 * ⛓ THE CLOCK, MEASURED ON THE GAME (`probe-seedling-bombpusher.mjs`, the two `bomb-refuted-*` tapes): the player's
 * end-of-tick distance first reads ≤ 256 at t818 (255.52; t817 256.44) and the lobber plays "shoot" on t819 — it
 * updates BEFORE the player (`Game.as:2299` adds it after the Player at `:2250`, and `addUpdate` prepends), so it reads
 * the previous tick's player. "shoot" is 5 frames at rate 5 × `FP.elapsed` 0.0333: 7 updates for the first frame and
 * 6 for each other, so the wrap — and the Bomb — is on update 31, the play tick + 30 (t849). The next play is the
 * wrap + 16 (15 decrements, then the test): one bomb every 46 ticks while the player stays in range (t819, 865, 911 …).
 *
 * ── `Bomb` (`Bomb.as`) ────────────────────────────────────────────────────
 *
 * ```
 *   ctor(_x:int, _y:int, _p):  v = (p.x - x, p.y - y); v.normalize(v.length / 30); f = 0; solids = []; 16x16
 *   update():  super.update();             // Mobile: if (!freezeObjects) { friction(); moveX(v.x); moveY(v.y) }
 *              if (t > 0) { t--; scale … } else FP.world.remove(this);      // t starts at tMax = 30
 *   removed(): FP.world.add(new Explosion(x, y, ["Player","Enemy","ShieldBoss"], 24));
 * ```
 *
 * The bomb is added at RUN TIME (`addUpdate` prepends), so it updates FIRST, from the tick after its wrap. Thirty
 * updates carry it exactly onto the aim point (t → 0); the 31st moves it ONE MORE STEP and removes it, and the
 * Explosion lands at that point. `friction()` with f = 0 is the identity on a non-zero `v`, but its two `< 0.05`
 * zeroing tests are not: L42's t941 bomb launched with vy 0.0024 and flew flat (measured).
 *
 * ── `Explosion` (`Explosion.as`) ──────────────────────────────────────────
 *
 * ```
 *   ctor(_x:int, _y:int, _hit, _r = 24, _d = 1):  radius:int = 24; … radius *= 0.65;   // ⛔ an `int`: 15, not 15.6
 *   added(): for each type: collideRectInto(type, x - radius, y - radius, 2r, 2r, v);
 *            for each c: if (FP.distance(x, y, c.x, c.y) <= radius)
 *                Player → hit(null, 4, Point(x, y), 1);   Enemy → hit(4, Point(x, y), 1)
 * ```
 *
 * `removed()` runs in `updateLists()`' REMOVE loop and its `add` lands in the ADD loop of the SAME `updateLists()`
 * (`World.as:900-926`), so `added()` — the whole damage pass — tests the player's END-of-tick origin on the bomb's
 * 31st update. Measured: L42 t1064 (explosion (285, 217), player (280.74, 215.30): `hits` 0 → 1, vx −3.714, vy 0 —
 * `knockback`'s `|centre.y| > 0.5` gate) and t1156; L41 t1153 and t1291, and t1337's third hit kills (`hitsMax` 3).
 *
 * ⚠ COSMETIC: the Explosion's `angle = Rng.cos() * 360` and the sound's index draw are the cosmetic stream (⚖ never
 * modelled); the Bomb's `scale`/`angle` are render-only. None is read by gameplay.
 */

import { rect } from './levelWorld.js';
import { FP_ELAPSED } from './chasers.js';
import { pointLength, pointNormalize } from './playerPhysicsV1.js';
import { defineRecord } from './entityRecords.js';

export class BombPusherError extends Error {
    constructor(message) { super(message); this.name = 'BombPusherError'; }
}
const fail = (m) => { throw new BombPusherError(m); };

/** `FP.sign` (`FP.as:142-145`). */
const fpSign = (n) => (n < 0 ? -1 : (n > 0 ? 1 : 0));

/** `BombPusher`'s constructor numbers, verbatim (`Enemies/BombPusher.as:18-35`). */
export const BOMB_PUSHER = defineRecord('bombPusher', {
    /** `super(_x + Tile.w * 3 / 2, _y + Tile.h * 3 / 2)` — the entity point is the 3x3 body's centre. */
    ctor: { dx: 24, dy: 24 },
    /** `setHitbox(48, 48, 24, 24)`, `type = "Solid"` — a wall the Explosion's `"Enemy"` arm does not reach. */
    hitbox: { w: 48, h: 48, originX: 24, originY: 24 },
    /** `maxDistance` — `FP.distance(x, y, p.x, p.y) <= 256`, a `Number` (not truncated). */
    maxDistance: 256,
    /** `shotTimeMax` — decremented to 0 between a wrap and the next play. */
    shotTimeMax: 15,
    /** `add("shoot", [0, 2, 1, 2, 3], 5)` / `add("sit", [0, 3], 2)` — `loop` defaults to true. */
    anims: {
        shoot: { frames: 5, rate: 5, loop: true },
        sit: { frames: 2, rate: 2, loop: true },
    },
    /** `activeOffScreen = true` (`:34`): `Enemy.update`'s camera gate never returns. */
    activeOffScreen: true,
    src: 'Enemies/BombPusher.as:18-35 (ctor), :37-50 (update), :52-64 (endAnim); Game.as:2299 (the add, after the '
        + 'Player at :2250)',
}, { doc: ['src'], src: 'bombPusher.js' });

/** `Projectiles/Bomb.as` + the `Explosion` its `removed()` adds, verbatim. */
export const BOMB = defineRecord('bomb', {
    /** `setHitbox(16, 16, 8, 8)` (the 16x16 Spritemap, centred). `type = "Bomb"` — nothing collides with it. */
    hitbox: { w: 16, h: 16, originX: 8, originY: 8 },
    /** `tMax`: `v` is a 30th of the aim vector; the 31st update moves once more and removes. */
    tMax: 30,
    /** `Mobile.friction()` with `f = 0`: the identity, then the two zeroing tests. */
    frictionZero: 0.05,
    /** `new Explosion(x, y, hitables, 24)`. */
    explosionRadiusArg: 24,
    /** `Explosion.radiusCoeff` — applied to an `int` field, so the hit radius TRUNCATES. */
    radiusCoeff: 0.65,
    /** `int(24 * 0.65)` — the radius both the prefilter square and the disc use. */
    explosionHitRadius: Math.trunc(24 * 0.65),
    /** `Explosion.force`. */
    force: 4,
    /** `Explosion`'s `_d` default. */
    damage: 1,
    hitables: ['Player', 'Enemy', 'ShieldBoss'],
    src: 'Projectiles/Bomb.as (whole class); Projectiles/Explosion.as:18-68; Mobile.as:26-117',
}, { doc: ['src'], src: 'bombPusher.js' });

/** One lobber, from its `.oel` placement. */
export function createBombPusher(x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
        fail(`createBombPusher: (${x},${y}) must be the OEL integer placement`);
    }
    return {
        id: `bombpusher@${x},${y}`,
        x: x + BOMB_PUSHER.ctor.dx,
        y: y + BOMB_PUSHER.ctor.dy,
        /** Seeded 0: a player in range on its first update is shot at on it. */
        shotTime: 0,
        /** The Spritemap: `currentAnim` ("" until "shoot" first plays), `_index`, `_timer`. */
        anim: '',
        animIndex: 0,
        animTimer: 0,
        /** A monotonic counter, for bomb ids. Not a game field. */
        shots: 0,
        /** The bomb THIS tick's `endAnim` produced, or null. */
        spawned: null,
    };
}

/** The 48x48 body. */
export function bombPusherRect(b) {
    const h = BOMB_PUSHER.hitbox;
    return rect(b.x - h.originX, b.y - h.originY, h.w, h.h);
}

/** `FP.distance(x, y, p.x, p.y)`. */
export function bombPusherDistance(b, player) {
    return Math.sqrt((b.x - player.x) * (b.x - player.x) + (b.y - player.y) * (b.y - player.y));
}

/** `play(name)`: a new name resets `_index`/`_timer`; the same name is a no-op. */
function play(b, name) {
    if (b.anim === name) return;
    b.anim = name;
    b.animIndex = 0;
    b.animTimer = 0;
}

/** `Spritemap.update()` + `endAnim`, in the update's own slot. @returns {?object} the bomb a "shoot" wrap added */
function bombPusherAnimStep(b, player) {
    const a = BOMB_PUSHER.anims[b.anim];
    if (!a) return null;
    b.animTimer += a.rate * FP_ELAPSED;
    while (b.animTimer >= 1) {
        b.animTimer -= 1;
        b.animIndex += 1;
        if (b.animIndex === a.frames) {
            b.animIndex = 0;
            if (b.anim === 'shoot') {
                // `endAnim`: the timer, the Bomb (at the player `nearestToPoint` names NOW), then `play("sit")`,
                // which zeroes `_timer` — so the `while` exits.
                b.shotTime = BOMB_PUSHER.shotTimeMax;
                b.shots += 1;
                const spawned = player ? createBomb(`${b.id}#${b.shots}`, b.x, b.y, player) : null;
                play(b, 'sit');
                return spawned;
            }
            // "sit" wraps into `endAnim`'s non-"shoot" arm: nothing.
        }
    }
    return null;
}

/**
 * ONE game tick of `BombPusher.update()` plus its graphic pass.
 *
 * @param {object} b
 * @param {object} ctx
 * @param {?{x:number,y:number}} ctx.player  the player's ENTITY point as the previous tick left it (the lobber updates
 *   before the player); null when the world has none
 */
export function stepBombPusher(b, ctx = {}) {
    const { player = null } = ctx;
    b.spawned = null;
    if (b.shotTime > 0) {
        b.shotTime -= 1;
    } else if (b.shotTime === 0 && player && bombPusherDistance(b, player) <= BOMB_PUSHER.maxDistance) {
        b.shotTime = -1;
        play(b, 'shoot');
    }
    b.spawned = bombPusherAnimStep(b, player);
    return b;
}

/** One bomb. `x`/`y` are the ctor's `_x:int, _y:int`; `target` is `Point(p.x, p.y)`. */
export function createBomb(id, x, y, target) {
    const bx = Math.trunc(x);
    const by = Math.trunc(y);
    const dx = target.x - bx;
    const dy = target.y - by;
    // `v.normalize(v.length / tMax)` — the runtime's own `Point` arithmetic (`oneSpelling`).
    const v = pointNormalize(dx, dy, pointLength(dx, dy) / BOMB.tMax);
    return {
        id,
        x: bx,
        y: by,
        v: { x: v.x, y: v.y },
        t: BOMB.tMax,
        spawnedAt: null,
        removed: false,
        /** The Explosion's point (`_x:int, _y:int`) once the 31st update removed it. */
        explodeAt: null,
    };
}

/** The 16x16 box. */
export function bombRect(s) {
    const h = BOMB.hitbox;
    return rect(s.x - h.originX, s.y - h.originY, h.w, h.h);
}

/** `Mobile.moveX`/`moveY` with `solids = []`: sub-steps of at most 1 px, all free. */
function moveAxis(s, axis, rel) {
    const n = Math.abs(rel);
    for (let i = 0; i < n; i += 1) s[axis] += Math.min(1, n - i) * fpSign(rel);
}

/**
 * ONE game tick of `Bomb.update()`.
 *
 * @param {object} s
 * @param {object} ctx
 * @param {boolean} ctx.frozen  `Game.freezeObjects` — gates the MOVE only; `t` counts through a freeze
 * @returns {{exploded: ?{x:number,y:number}}} the Explosion's point when this update removed the bomb
 */
export function stepBomb(s, ctx = {}) {
    const { frozen = false } = ctx;
    if (s.removed) return { exploded: null };
    if (!frozen) {
        // `friction()`: `normalize(max(len - 0, 0))` is the identity (len/len is exactly 1); the zeroing is not.
        const n = pointNormalize(s.v.x, s.v.y, Math.max(pointLength(s.v.x, s.v.y) - 0, 0));
        s.v = { x: n.x, y: n.y };
        if (Math.abs(s.v.x) < BOMB.frictionZero) s.v.x = 0;
        if (Math.abs(s.v.y) < BOMB.frictionZero) s.v.y = 0;
        moveAxis(s, 'x', s.v.x);
        moveAxis(s, 'y', s.v.y);
    }
    if (s.t > 0) {
        s.t -= 1;
        return { exploded: null };
    }
    s.removed = true;
    // `new Explosion(x, y, …)` — `_x:int, _y:int`.
    s.explodeAt = { x: Math.trunc(s.x), y: Math.trunc(s.y) };
    return { exploded: { ...s.explodeAt } };
}

/**
 * ⛓ THE CADENCE, SIMULATED rather than divided — `stepBombPusher` itself, on a player standing in range. Offsets
 * are from the `play("shoot")` tick.
 */
export function bombPusherCadence() {
    const b = createBombPusher(0, 0);
    const near = { x: b.x + 100, y: b.y };
    const plays = [];
    let spawn = null;
    for (let tick = 0; plays.length < 2 && tick < 1000; tick += 1) {
        const before = b.anim;
        stepBombPusher(b, { player: near });
        if (before !== 'shoot' && b.anim === 'shoot') plays.push(tick);
        if (b.spawned && spawn === null) spawn = tick;
    }
    if (plays.length < 2) fail('bombPusherCadence: the lobber never fired twice');
    const s = createBomb('cadence', b.x, b.y, near);
    let updates = 0;
    while (!s.removed && updates < 100) {
        stepBomb(s);
        updates += 1;
    }
    return Object.freeze({
        /** Seeded `shotTime` 0: a player in range on the first update is shot at on it. */
        firstPlayTick: plays[0],
        /** The "shoot" wrap — the Bomb is added at the end of that tick. */
        spawnAfterPlay: spawn - plays[0],
        /** It first updates on the next tick (the add is deferred and PREPENDED). */
        firstBombUpdateAfterPlay: spawn - plays[0] + 1,
        periodTicks: plays[1] - plays[0],
        /** Updates from the first to the one that removes it — the Explosion lands at the end of that tick. */
        bombUpdates: updates,
        explodeAfterPlay: spawn - plays[0] + updates,
    });
}

export const BOMB_PUSHER_CADENCE = bombPusherCadence();
