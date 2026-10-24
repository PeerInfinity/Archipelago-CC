/**
 * seedlingDemo/bulb — ⛓ seedling-fidelity-bulb D2: `Enemies/Bulb.as`'s DEATH, TRANSCRIBED.
 *
 * The Bulb is a `Bob` (the chase is `chasers.chaseImpulse`, moveSpeed 0.65, runRange 80, a 12x12 box, `hitsMax` 1).
 * What is its own is the death, and it is the one kill in the game that EDITS THE FLOOR:
 *
 * ```
 *   update():  if (anim == "drop" || anim == "die") {                  // ⛔ NO super.update() — no Enemy.update:
 *                  tile = ((floor(x/16) + .5) * 16, (floor(y/16) + .5) * 16)   // no off-screen return, no terrain
 *                  v = tile - (x, y); v.normalize(min(v.length, moveSpeed))    // switch, no hitUpdate, no hitPlayer
 *                  mobileUpdate()                                      // friction, moveX, moveY (freeze-gated)
 *              } else { super.update(); …scaleX… }                     // Bob's update: alive, chasing
 *              if (hits >= hitsMax && anim != "drop" && anim != "die") play("drop")
 *   startDeath(t):  { }                                                // ⛔ EMPTY — the blow sets nothing
 *   endAnim():  "drop" → play("die"); collidePoint("Tile", x, y).t = 17   // LAVA, for the rest of the visit
 *               "die"  → FP.world.remove(this)                         // no `destroy`, no fade
 * ```
 *
 * ── ⛔ FOUR THINGS THE SOURCE SAYS THAT A FIRST READING GETS WRONG ────
 *
 * 1. **THE KILLING BLOW DOES NOT STOP THE BODY.** `startDeath` is empty, so the update after the blow is an ordinary
 *    living one — `Enemy.update` moves it, `Bob.update` adds the chase impulse — and only its LAST statement plays
 *    "drop". (The contact is quiet that tick, but only because the blow armed `hitsTimer` 30.) The tile that turns to
 *    lava is the one under the centre where THAT update leaves the body, not where it was struck.
 * 2. **THE SLIDE NEVER LEAVES THE TILE.** `v` points at the centre of the tile the body is in, re-read every update,
 *    and `friction()` runs on it before the move: the body creeps in at `min(d, 0.65) − 0.25` a tick and stops once
 *    both components fall in `friction`'s 0.05 dead zone (the game's rest on `bulb-l77-lava`: 0.253 px off centre). So the lava tile is decided the moment "drop" begins, ~27 ticks before it is written.
 * 3. **"DROP" AND "DIE" RUN NO `Enemy.update`.** No i-frame tick (`hits_timer` freezes where the armed tick left
 *    it), no contact, no off-screen gate (a dropping Bulb the camera has lost still slides), no terrain switch (it
 *    does not drown on the lava it just wrote).
 * 4. **THE REMOVAL IS `endAnim`'s OWN `FP.world.remove`** — no `destroy`, no `Mobile.death` fade. Both anims LOOP
 *    (`Spritemap.add`'s default), so the callback fires at the wrap and `play("die")` resets the timer.
 *
 * The lava write itself — the tile's `t`, read live by `Player.getState`/`checkDrowning` and by every `Enemy`'s
 * terrain switch — is `levelRun`'s per-visit tile overlay (`levelWorld.withTileWrites`); this module only says which
 * tile and when.
 */

import { CHASERS, applyFriction, animTicks, createSpriteAnim, stepSpriteAnim } from './chasers.js';
import { ENEMY_CLASSES } from './combat.js';
import { TILE_SIZE } from './levelWorld.js';
import { pointLength, pointNormalize } from './playerPhysicsV1.js';

export class BulbError extends Error {
    constructor(message) { super(message); this.name = 'BulbError'; }
}
const fail = (m) => { throw new BulbError(m); };

/** The class's death facts (`CHASERS.bulb.dropDeath`), throwing for a class that has none. */
export function dropDeathOf(tag) {
    const d = CHASERS[tag]?.dropDeath;
    if (!d) fail(`dropDeathOf: "${tag}" has no drop death (only the Bulb writes a tile when it dies)`);
    return d;
}

/** Does this census tag die the Bulb's way (an empty `startDeath`, "drop", a tile write, "die", a removal)? */
export function hasDropDeath(tag) {
    return !!CHASERS[tag]?.dropDeath;
}

/** The tile (column, row) under a centre — `collidePoint("Tile", x, y)` and the slide's own `floor(x / Tile.w)`. */
export function tileUnder(x, y) {
    return { tx: Math.floor(x / TILE_SIZE), ty: Math.floor(y / TILE_SIZE) };
}

/** Ticks from the "drop" update that STARTS the anim (its first graphic update) to its `endAnim` (the lava write). */
export function dropTicks(tag) {
    const d = dropDeathOf(tag).drop;
    return animTicks(d.frames, d.rate);
}

/** Ticks of "die", from the update after the lava write to `endAnim`'s removal. */
export function dieTicks(tag) {
    const d = dropDeathOf(tag).die;
    return animTicks(d.frames, d.rate);
}

/** A fresh "drop" Spritemap (`play("drop")`). */
export function createDropAnim(tag) {
    const d = dropDeathOf(tag).drop;
    return createSpriteAnim(d.frames, d.rate);
}

/** A fresh "die" Spritemap (`endAnim`'s `play("die")`: `play` resets the timer, so nothing carries over). */
export function createBulbDieAnim(tag) {
    const d = dropDeathOf(tag).die;
    return createSpriteAnim(d.frames, d.rate);
}

/**
 * ONE "drop"/"die" update of the body: the slide toward its tile's centre (`Bulb.update`'s first arm, then
 * `mobileUpdate`). `move(x, y, dx, dy) => {x, y}` is the caller's solid sweep (the chaser's own `solids`).
 *
 * @returns {{x, y, v}} `v` is the velocity the update leaves (after `friction()`), which is what the game reports.
 */
export function bulbSlideStep(tag, body, { frozen = false, move = null } = {}) {
    const ms = ENEMY_CLASSES[tag]?.speed;
    if (!(ms > 0)) fail(`bulbSlideStep: "${tag}" has no speed in ENEMY_CLASSES`);
    const cx = (Math.floor(body.x / TILE_SIZE) + 0.5) * TILE_SIZE;
    const cy = (Math.floor(body.y / TILE_SIZE) + 0.5) * TILE_SIZE;
    const dx = cx - body.x;
    const dy = cy - body.y;
    // `v.normalize(Math.min(v.length, moveSpeed))` — a no-op on the zero point (`pointNormalize`'s guard).
    let v = pointNormalize(dx, dy, Math.min(pointLength(dx, dy), ms));
    // `mobileUpdate()`: `if (!destroy) { if (!Game.freezeObjects) { friction(); input(); moveX; moveY } }` — the
    // body is never `destroy`ed by this death, so only the freeze gates it.
    if (frozen) return { x: body.x, y: body.y, v };
    v = applyFriction(v);
    const m = move ? move(body.x, body.y, v.x, v.y) : { x: body.x + v.x, y: body.y + v.y };
    return { x: m.x, y: m.y, v };
}

/**
 * The GRAPHIC half of one tick for a body in its drop death — the "drop" or "die" Spritemap's update, and the
 * `endAnim` it ends in. Mutates `body.bulbPhase` / `body.anim`.
 *
 * @returns {?{event: 'lava', tile: {tx, ty}} | {event: 'removed'}} what `endAnim` did this tick, or null.
 */
export function stepBulbGraphic(tag, body) {
    if (!body.anim || !stepSpriteAnim(body.anim)) return null;
    if (body.bulbPhase === 'drop') {
        body.bulbPhase = 'die';
        body.anim = createBulbDieAnim(tag);
        return { event: 'lava', tile: tileUnder(body.x, body.y) };
    }
    if (body.bulbPhase === 'die') {
        body.anim = null;
        return { event: 'removed' };
    }
    fail(`stepBulbGraphic: a "${body.bulbPhase}" phase has no anim callback`);
    return null;
}
