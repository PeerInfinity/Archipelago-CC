/**
 * seedlingDemo/lightBoss — ⛓⛓⛓ SEEDLING FIDELITY LIGHTS (wave 20, D2): THE L69 LIGHTS FIGHT, TRANSCRIBED.
 *
 * ⚖ The user (2026-10-20): *"L69 Lights"*. R4b lifted L69 out of `NEVER_ENTER_LEVELS`; the rules enter it by L70's pit
 * and leave by the death exit, so the bot and the model must FIGHT it. Switch: `CONTACT_FIDELITY.lightsBossFight`
 * (OFF: nothing here is reached and the model is the one before this slice, byte for byte).
 *
 * Source, read whole (vendor/seedling `src/` @ccdf189776): `Enemies/LightBossController.as` (192),
 * `Enemies/LightBoss.as` (117), `Projectiles/LightBossShot.as` (49), `Projectiles/TurretSpit.as`,
 * `Scenery/LightBossTotem.as` (59), `Enemies/Enemy.as`, `Mobile.as`, `NPCs/NPC.as` (the intro), `Teleporter.as`,
 * `Game.as:1962-1965` (`worldFrame`), `VanillaSet.as:139-140` (`light_boss_exit`).
 *
 * ── THE FAMILY, IN UPDATE ORDER (`World.addUpdate` PREPENDS) ──────────────────────────────────────────────────────
 *
 *   every LightBossShot, newest first   (added by the controller's `shoot()` calls, after the fliers exist)
 *   the six LightBoss fliers, 5 .. 0    (added by the controller once the intro is gone)
 *   the LightBossTotem                  (added by `check()`, after the intro NPC, so it is in front of it)
 *   the intro NPC                       (added by `check()`)
 *   the LightBossController             (`Game.as:2282`, a `loadlevel` entity: after every run-time add)
 *   … the Player last                   (`Game.as:2250` — added before the controller, so it updates after it)
 *
 * So each flier steers by the `goto` the controller wrote on the PREVIOUS tick, a shot is spawned at the position the
 * flier reached THIS tick (the controller updates after it), and every body tests the player where the previous tick
 * left it (the player updates last). The levelRun hook (`stepLightsNow`) runs this order; this module is pure.
 *
 * ── WHAT IS NOT MODELLED, BY RULING ───────────────────────────────────────────────────────────────────────────────
 *
 * ⚖ `LightBoss.update`'s `if (!Math.floor(Rng.cos() * 90)) Music.playSound("Boss 6 Move")` (`LightBoss.as:67`) is the
 * COSMETIC stream (a sound pick): never modelled (user, 2026-10-10). The `Light`s, the colours, the angles, the medal and
 * the music are render/sound only.
 */

import { pointLength, pointNormalize } from './playerPhysicsV1.js';
import { applyFriction, createSpriteAnim, stepSpriteAnim } from './chasers.js';
import { worldFrame } from './lavaChain.js';
import { enemyHit, enemyHitUpdate } from './enemyDamage.js';
// ⛓ The runtime's trig (musl), not V8's: `runtimeLibm.js`'s header has the measurement.
import { atan2 as libmAtan2, cos as libmCos, sin as libmSin } from './runtimeLibm.js';
import { rect, rectsOverlap } from './levelWorld.js';
import { LIGHT_BOSS_WORLD, lightsExitRect, lightsWorldRows } from './lightBossWorld.js';

export { lightsExitRect, lightsWorldRows };

export class LightBossError extends Error {
    constructor(message) { super(message); this.name = 'LightBossError'; }
}
const fail = (m) => { throw new LightBossError(m); };

/** `FP.sign` (`FP.as:142-145`). */
const fpSign = (n) => (n < 0 ? -1 : (n > 0 ? 1 : 0));

/** `int(n)` — the AVM2 `Number → int` conversion: truncation toward zero, NaN → 0. */
const toInt = (n) => (Number.isFinite(n) ? Math.trunc(n) : 0);

/** The numbers, verbatim. */
export const LIGHT_BOSS = Object.freeze({
    controller: Object.freeze({
        /** `spinCenter = new Point(x + Tile.w / 2, y + Tile.h / 2)` (`LightBossController.as:52`). */
        centerOffset: 8,
        /**
         * `spinRate:Number = FP.RAD` (`:22`) — ⛔ NEGATIVE: FlashPunk's `RAD` is `Math.PI / -180` (`FP.as:749`, its y axis
         * points down), so the circle turns the other way from the one a reader of `+= spinRate` pictures. MEASURED: the
         * game's six `goto`s on the spawn update are the x-mirror of a `+π/180` model's.
         */
        spinRate: Math.PI / -180,
        /** `radiusCircle:int = 100` (`:23`) — ⛔ an INT: every assignment truncates. */
        radiusInitial: 100,
        radiusMin: 48,
        radiusMax: 64,
        /** `radiusCircleFrames` (`:26`) and `loopsPerCircle` (`:27`): `cFrame = Game.worldFrame(180, 4)` = `int(time % 180)`. */
        frames: 180,
        loops: 4,
        states: 3,
        /** `new LightBoss(spinCenter.x, -32, …)` (`:78`). */
        spawnY: -32,
        /** The shot frames of `flyCircle` / `flyCircleInvert` (`:117-120`, `:142-145`) and of `flyCircleDouble` (`:163-168`). */
        shotFrames: Object.freeze([135, 90, 45, 0]),
        shotFramesDouble: Object.freeze([150, 120, 90, 60, 30, 0]),
        src: 'Enemies/LightBossController.as:14-31 (fields), :48-63 (check), :65-100 (update), :102-107 (endState), '
            + ':109-176 (the three patterns), :178-189 (removeFlier)',
    }),
    flier: Object.freeze({
        /** `setHitbox(12, 12, 6, 6)` (`LightBoss.as:42`). */
        hitbox: Object.freeze({ w: 12, h: 12, originX: 6, originY: 6 }),
        /** `divisor:int = 20` (`:18`): `v += (goto - pos) / 20`. */
        divisor: 20,
        /** `maxSpeed:Number = 1.5` (`:21`): `v.normalize(Math.min(v.length, maxSpeed))`. */
        maxSpeed: 1.5,
        /** `lightLength:int = 4` (`:19`): the shot leaves 4 px ahead of the body along `angleFace`. */
        lightLength: 4,
        /** `shotSpeed:int = 1` (`:20`). */
        shotSpeed: 1,
        /** `hitsMax = 3` (`:48`); `Enemy.hitsTimerMax` 30 (`Enemy.as:24`). */
        hitsMax: 3,
        hitsTimerMax: 30,
        /** `Enemy.hitPlayer`: `p.hit(this, 3, new Point(x, y), damage)` with `damage = 1` (`Enemy.as:20, 215`). */
        contactForce: 3,
        damage: 1,
        /** `sprLightBoss.add("die", [1, 2, 3, 4, 5, 6, 7, 8, 9], 20)` (`:31`) — `animEnd` removes the body. */
        die: Object.freeze({ frames: 9, rate: 20 }),
        src: 'Enemies/LightBoss.as:15-56 (ctor), :58-82 (update), :84-95 (startDeath), :97-108 (animEnd), :110-113 (shoot)',
    }),
    shot: Object.freeze({
        /** `setHitbox(4, 4, 2, 2)` (`LightBossShot.as:27`). */
        hitbox: Object.freeze({ w: 4, h: 4, originX: 2, originY: 2 }),
        /** `hitables = ["Player"]`, `solids = []` (`:29-30`); `f = 0` (`:25`). */
        friction: 0,
        /** `Player.hit(null, v.length, …)` with the default damage 1 (`TurretSpit.as:54`). */
        damage: 1,
        /**
         * The two culls: `TurretSpit.update`'s `!onScreen(spritemap.width = 8)` and then `LightBossShot.update`'s
         * `!onScreen()` (`:45`). The second is the stricter (margin 0), so it is the one that decides.
         */
        cullMargin: 0,
        src: 'Projectiles/LightBossShot.as (whole class); Projectiles/TurretSpit.as:37-66 (update)',
    }),
    /** The totem and the exit, as the WORLD build reads them (`lightBossWorld.js`, a leaf module `levelWorld` imports). */
    totem: LIGHT_BOSS_WORLD.totem,
    intro: Object.freeze({
        text: 'HOW FAR YOU HAVE COME, BEING OF THE LIGHT.~OUR OWN LIGHT WILL SWALLOW YOU. COME, MEET YOUR FATE.',
        /** `new NPC(x, y, null, -1, text, 4, 34)` (`LightBossController.as:53`). */
        talkingSpeed: 4,
        lineLength: 34,
        /** `NPC.talkRange` 24 (`NPC.as:27`), measured from the NPC's point `(x + 8, y + 8)`. */
        talkRange: 24,
        src: 'Enemies/LightBossController.as:35,53-55; NPCs/NPC.as:44-66 (ctor), :74-85 (removed), :186-245 (talk)',
    }),
    exit: LIGHT_BOSS_WORLD.exit,
});

// ── the controller ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The fight as `check()` leaves it on a visit whose tag still HOLDS (`LightBossController.as:50-56`): the intro text up,
 * the totem standing, no fliers. A visit whose tag is CLEARED never builds one: `check()` runs `endState()` and removes
 * the controller (`:58-62`), which the WORLD build answers (the exit teleporter, no totem).
 */
export function createLightsFight({ x, y, flierNum, tag }) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) fail(`createLightsFight: (${x},${y}) must be the OEL placement`);
    if (!Number.isInteger(flierNum) || flierNum <= 0) fail(`createLightsFight: fliernum ${flierNum}`);
    const c = LIGHT_BOSS.controller;
    return {
        id: `lightbosscontroller@${x},${y}`,
        x, y, tag,
        flierNumber: flierNum,
        center: { x: x + c.centerOffset, y: y + c.centerOffset },
        spin: 0,
        radius: c.radiusInitial,
        state: 0,
        madeFliers: false,
        /** `myText` — the intro NPC; null from the update after its `removed()`. */
        introUp: true,
        /** `myFliers`, in id order (the vector the controller indexes). Each is ALSO in `bodies` until removed. */
        fliers: [],
        /** Every flier ever spawned, in spawn order, removed ones included (the world's view: `removed` flags). */
        bodies: [],
        shots: [],
        shotSeq: 0,
        totemDie: false,
        /** `Game.time` at the last unfrozen update (null before the first). */
        time: null,
        /** `endState()` has run: the tick, or null. */
        endedAt: null,
        updates: 0,
    };
}

/** `Game.totalEnemies()` restricted to this room: every LightBoss still in the world (dying ones count). */
export function lightsEnemiesInWorld(fight) {
    return fight.bodies.filter((b) => !b.removed).length;
}

/** The totem's box while it is a `Solid` (`type = ""` from the render of the tick `die` is set). */
export function lightsTotemRect(fight) {
    return rect(fight.x, fight.y, LIGHT_BOSS.totem.w, LIGHT_BOSS.totem.h);
}


/**
 * ONE `LightBossController.update()`, after the fliers have updated this tick.
 *
 * @param {object} fight
 * @param {object} ctx
 * @param {boolean} ctx.frozen `Game.freezeObjects` — the whole update is inside `if (!Game.freezeObjects)`
 * @param {?number} ctx.time  `Game.time` at this update (`worldFrame` reads it); null refuses a pattern step by name
 * @returns {{spawned: boolean, ended: boolean, shots: object[]}}
 */
export function stepLightsController(fight, { frozen = false, time = null } = {}) {
    const out = { spawned: false, ended: false, shots: [] };
    if (frozen) return out;
    fight.updates += 1;
    // `if (madeFliers && totalEnemies() <= 0 && !myTotem.die) { myTotem.die = true; endState(); … }`
    if (fight.madeFliers && lightsEnemiesInWorld(fight) <= 0 && !fight.totemDie) {
        fight.totemDie = true;
        out.ended = true;
    }
    // `if (!myText && !madeFliers) { while (myFliers.length < flierNumber) push(new LightBoss(spinCenter.x, -32, …)) }`
    if (!fight.introUp && !fight.madeFliers) {
        while (fight.fliers.length < fight.flierNumber) {
            const f = createLightBossFlier(fight.center.x, LIGHT_BOSS.controller.spawnY, fight.fliers.length);
            fight.fliers.push(f);
            fight.bodies.push(f);
        }
        fight.madeFliers = true;
        out.spawned = true;
    }
    if (time === null) {
        fail(`stepLightsController: ${fight.id} steps its pattern on \`Game.worldFrame\` and this tick has no \`Game.time\` `
            + '— the radius, the spin and the shot frames are not derivable. Refused by name, never guessed.');
    }
    /** The `Game.time` of this update — a forecast steps the next from `time + 1`. */
    fight.time = time;
    flyPattern(fight, time, out);
    return out;
}

/** `flyCircle` / `flyCircleInvert` / `flyCircleDouble`, by `state` (`:109-176`). */
function flyPattern(fight, time, out) {
    const c = LIGHT_BOSS.controller;
    const cFrame = worldFrame(time, c.frames, c.loops);
    // `radiusCircle = radiusCircleMin + (max - min) * (Math.sin(cFrame / frames * 2 * Math.PI) + 1) / 2` — into an INT.
    fight.radius = toInt(c.radiusMin + (c.radiusMax - c.radiusMin)
        * (libmSin(cFrame / c.frames * 2 * Math.PI) + 1) / 2);
    const r = fight.radius;
    const n = fight.fliers.length;
    const frames = fight.state === 2 ? c.shotFramesDouble : c.shotFrames;
    const shooting = frames.includes(cFrame);
    for (let i = 0; i < n; i += 1) {
        let a = i / n * 2 * Math.PI + fight.spin;
        let rr = r;
        if (fight.state === 1 && i % 2 === 0) rr = r / 2;
        if (fight.state === 2 && i % 2 === 0) a = i / n * 2 * Math.PI + fight.spin * 2;
        const f = fight.fliers[i];
        f.goto = { x: fight.center.x + rr * libmCos(a), y: fight.center.y + rr * libmSin(a) };
        if (shooting) {
            const s = lightBossShoot(f, `${fight.id}#${(fight.shotSeq += 1)}`);
            fight.shots.push(s);
            out.shots.push(s);
        }
    }
    // `spin += spinRate * (2 - (radiusCircle - radiusCircleMin) / (radiusCircleMax - radiusCircleMin))`
    fight.spin += c.spinRate * (2 - (r - c.radiusMin) / (c.radiusMax - c.radiusMin));
}

/** `removeFlier(_id)` (`:178-189`): splice, re-index the rest, advance the pattern. */
function removeFlier(fight, id) {
    if (id >= 0 && id < fight.fliers.length) {
        fight.fliers.splice(id, 1);
        for (let i = id; i < fight.fliers.length; i += 1) fight.fliers[i].fid -= 1;
        fight.state = Math.min(fight.state + 1, LIGHT_BOSS.controller.states - 1);
    }
}

// ── the fliers ─────────────────────────────────────────────────────────────────────────────────────────────────────

let flierSeq = 0;
/** One `new LightBoss(_x, _y, _id, parent)` (`LightBoss.as:28-56`). */
export function createLightBossFlier(x, y, fid) {
    flierSeq += 1;
    const fl = LIGHT_BOSS.flier;
    return {
        id: `lightboss#${fid}`,
        /** `id` — the controller's index, re-numbered by `removeFlier`. */
        fid,
        x: toInt(x),
        y: toInt(y),
        vx: 0,
        vy: 0,
        goto: null,
        /** `angleFace:Number` — NaN until the first update writes it (an unset `Number`). */
        angleFace: NaN,
        hits: 0, hitsMax: fl.hitsMax, hitsTimer: 0, hitsTimerMax: fl.hitsTimerMax,
        hitByDarkStuff: false, canHit: true, onlyHitBy: '', hitByFire: false, maxForce: -1, justKnock: false,
        activeOffScreen: true, destroy: false, as3: 'LightBoss',
        /** The "die" Spritemap once `startDeath` played it; null while "sit". */
        dieAnim: null,
        removed: false,
        diedAt: null,
        seq: flierSeq,
    };
}

/** The 12x12 box. */
export function lightBossRect(f) {
    const b = LIGHT_BOSS.flier.hitbox;
    return rect(f.x - b.originX, f.y - b.originY, b.w, b.h);
}

/** `Mobile.moveX`/`moveY` with `solids = []`: 1 px sub-steps, all free. */
function moveAxis(o, axis, rel) {
    const n = Math.abs(rel);
    for (let i = 0; i < n; i += 1) o[axis] += Math.min(1, n - i) * fpSign(rel);
}

/**
 * ONE `LightBoss.update()` (`:58-82`) — `Enemy.update` (no off-screen gate: `activeOffScreen`; no terrain death in
 * L69: its tiles are 26/27/28), `Mobile.mobileUpdate` (friction 0.25 and the free move, `solids = []`), `hitUpdate`,
 * `hitPlayer`; then, unfrozen, the steer toward `goto`, `angleFace`, and the 1.5 cap.
 *
 * @param {object} f MUTATED
 * @param {object} ctx
 * @param {boolean} ctx.frozen
 * @param {?object} ctx.playerBox the player's box as the previous tick left it
 * @param {?function} ctx.onContact `(f) => void` — `Enemy.hitPlayer` collided: the caller bills `p.hit(this, 3, (x, y),
 *   1)` HERE, inside the update (the dark suit's retaliation lands in `v` before the steer and the cap)
 * @returns {{contact: boolean}}
 */
export function stepLightBossFlier(f, { frozen = false, playerBox = null, onContact = null } = {}) {
    if (f.removed) return { contact: false };
    let contact = false;
    // Mobile.mobileUpdate — `destroy` is never set on a LightBoss before its removal (startDeath plays an anim).
    if (!frozen) {
        const v = applyFriction({ x: f.vx, y: f.vy });
        f.vx = v.x;
        f.vy = v.y;
        moveAxis(f, 'x', f.vx);
        moveAxis(f, 'y', f.vy);
    }
    // `if (!destroy) { hitUpdate(); hitPlayer(); }`
    enemyHitUpdate(f, { onScreen: true });
    if (f.dieAnim === null && f.hitsTimer <= 0 && playerBox && rectsOverlap(lightBossRect(f), playerBox)) {
        contact = true;
        if (onContact) onContact(f);
    }
    if (frozen) return { contact };
    const fl = LIGHT_BOSS.flier;
    if (f.goto) {
        f.vx += (f.goto.x - f.x) / fl.divisor;
        f.vy += (f.goto.y - f.y) / fl.divisor;
    }
    f.angleFace = libmAtan2(f.vy, f.vx);
    const capped = pointNormalize(f.vx, f.vy, Math.min(pointLength(f.vx, f.vy), fl.maxSpeed));
    f.vx = capped.x;
    f.vy = capped.y;
    return { contact };
}

/**
 * The flier's GRAPHIC update, in its own slot right after its update (`World.as:58`) and not freeze-gated: the "die"
 * Spritemap. `animEnd`'s die arm sets `destroy` and removes the body (`:97-108`) — the removal lands at the end of the
 * frame, so the body still counts in `totalEnemies()` for the rest of THIS tick.
 *
 * @returns {boolean} true on the update `animEnd` fires
 */
export function stepLightBossFlierGraphic(f) {
    if (f.removed || f.dieAnim === null) return false;
    if (!stepSpriteAnim(f.dieAnim)) return false;
    f.destroy = true;
    return true;
}

/**
 * `Enemy.hit(f, p, d, t)` on a flier (`Enemy.as:141-175`), then `knockback` (the base: `v += f·(cos a, sin a)`,
 * `a = atan2(y − p.y, x − p.x)`, skipped once "die" plays) or `LightBoss.startDeath` (`:84-95`: play "die", NO `destroy`,
 * `parent.removeFlier(id)`).
 *
 * @returns {object} `enemyDamage.enemyHit`'s verdict
 */
export function lightBossFlierHit(fight, f, { d, force, t, from, frozen = false }) {
    if (f.removed) fail(`lightBossFlierHit: ${f.id} is not in the world`);
    const verdict = enemyHit(f, { d, f: force, t, frozen });
    if (verdict.killed) {
        f.dieAnim = createSpriteAnim(LIGHT_BOSS.flier.die.frames, LIGHT_BOSS.flier.die.rate);
        removeFlier(fight, f.fid);
        f.dying = true;
    } else if (verdict.knockedBack && f.dieAnim === null && from) {
        // `Enemy.knockback`: `a = Math.atan2(y - p.y, x - p.x); v.x += f * Math.cos(a); v.y += f * Math.sin(a)`.
        const a = libmAtan2(f.y - from.y, f.x - from.x);
        const k = verdict.force ?? force;
        f.vx += k * libmCos(a);
        f.vy += k * libmSin(a);
    }
    return verdict;
}

// ── the shots ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** `shoot()` (`LightBoss.as:110-113`): 4 px ahead along `angleFace`, at 1 px/t along it; the ctor's `_x:int`. */
export function lightBossShoot(f, id) {
    const fl = LIGHT_BOSS.flier;
    const a = f.angleFace;
    return {
        id,
        x: toInt(f.x + fl.lightLength * libmCos(a)),
        y: toInt(f.y + fl.lightLength * libmSin(a)),
        vx: fl.shotSpeed * libmCos(a),
        vy: fl.shotSpeed * libmSin(a),
        removed: false,
        removedBy: null,
    };
}

/** The 4x4 box. */
export function lightBossShotRect(s) {
    const b = LIGHT_BOSS.shot.hitbox;
    return rect(s.x - b.originX, s.y - b.originY, b.w, b.h);
}

/**
 * ONE `LightBossShot.update()`: `TurretSpit.update` (`Mobile.mobileUpdate` with `f = 0` — the zeroing tests still run —
 * then, while `v.length > 0`, `collideTypesInto(["Player"])` and the hit, then the cull) and its own cull.
 *
 * @param {object} s MUTATED
 * @param {object} ctx
 * @param {boolean} ctx.frozen gates the move only
 * @param {?object} ctx.playerBox
 * @param {function} ctx.onScreen `(rect, margin) => boolean`
 * @returns {{hitPlayer: boolean, culled: boolean}}
 */
export function stepLightBossShot(s, { frozen = false, playerBox = null, onScreen } = {}) {
    if (s.removed) return { hitPlayer: false, culled: false };
    if (!frozen) {
        const v = applyFriction({ x: s.vx, y: s.vy }, LIGHT_BOSS.shot.friction);
        s.vx = v.x;
        s.vy = v.y;
        moveAxis(s, 'x', s.vx);
        moveAxis(s, 'y', s.vy);
    }
    let hitPlayer = false;
    if (pointLength(s.vx, s.vy) > 0 && playerBox && rectsOverlap(lightBossShotRect(s), playerBox)) {
        hitPlayer = true;
        s.removed = true;
        s.removedBy = 'hit';
        return { hitPlayer, culled: false };
    }
    if (!onScreen(lightBossShotRect(s), LIGHT_BOSS.shot.cullMargin)) {
        s.removed = true;
        s.removedBy = 'cull';
        return { hitPlayer: false, culled: true };
    }
    return { hitPlayer: false, culled: false };
}

// ── the run's faces ────────────────────────────────────────────────────────────────────────────────────────────────

/** `Player.spearForce` (`Player.as:145`) — the push `Player.spear`'s `genericHit` hands `Enemy.hit`. */
export const SPEAR_FORCE = 7;

/** The `teleporters` row `endState()`'s `new Teleporter(x, y, 36, 112, 96, true)` is (`lightsWorldRows`' exit arm). */
export function lightsExitRow(fight) {
    return lightsWorldRows({ attrs: { fliernum: String(fight.flierNumber) } }, fight.x, fight.y, fight.tag,
        new Set([fight.tag])).exit;
}

/**
 * The world with a mid-visit exit Teleporter APPENDED (`levelRun.visitWorld`; the latch indices of the room's own
 * teleporters are unchanged). `null` returns the same object, so a room without one is the world it was.
 */
export function withLightsExit(world, exit) {
    if (!exit) return world;
    const teleporters = [...world.teleporters, exit];
    const o = Object.create(world);
    Object.defineProperties(o, {
        teleporters: { value: teleporters, enumerable: true },
        teleporterHit: {
            value: (box) => teleporters.filter((tp) => !tp.deactivated && rectsOverlap(box, tp.rect)),
            enumerable: true,
        },
    });
    return o;
}

/** `run.entities('lightsFight')`: a copy a consumer cannot alias (the solver's forecast steps a clone of it). */
export function lightsFightView(fight, { events = [] } = {}) {
    return { ...cloneLightsFight(fight), intro: { ...fight.intro, d: fight.intro.d ? { ...fight.intro.d } : null },
        events: events.map((e) => ({ ...e })) };
}

// ── the forecast ───────────────────────────────────────────────────────────────────────────────────────────────────

/** A deep copy of a fight, for a forecast that must not touch the run's own state. */
export function cloneLightsFight(fight) {
    const bodies = fight.bodies.map((b) => ({ ...b, goto: b.goto ? { ...b.goto } : null,
        dieAnim: b.dieAnim ? { ...b.dieAnim } : null }));
    const bySeq = new Map(bodies.map((b) => [b.seq, b]));
    return {
        ...fight,
        center: { ...fight.center },
        bodies,
        fliers: fight.fliers.map((f) => bySeq.get(f.seq)),
        shots: fight.shots.map((s) => ({ ...s })),
    };
}
