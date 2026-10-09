/**
 * seedlingDemo/wallFlyer — ⛓⛓⛓ R2-swim D1: `Enemies/WallFlyer.as`, TRANSCRIBED.
 *
 * The body that sits on a wall and launches across the room at 4 px/tick when
 * the player crosses its ray. J0(a)'s census met it as a refusal: *"the player
 * is standing inside wallflyer@48,112 in level 22 … on a tape that does NOT
 * declare `noDamage`"* — `contactPricing` priced the class `mover`, so a
 * contact against its `.oel` placement was a number the run could not produce.
 * Three rooms hold the class: L22 (four), L25 (two), L27 (one).
 *
 * ── THE AS3, IN UPDATE ORDER ───────────────────────────────────────────
 *
 * ```
 *   check():   v = decideMotion(-moveSpeed)              // INTO its wall, first frame
 *   update():  super.update()                            // Enemy.update, below
 *              if (destroy || currentAnim == "die") return;
 *              vTriggered = decideMotion(moveSpeed)      // AWAY from its wall
 *              if (|vTriggered| > 0 && FP.world.collideLine("Player", x, y,
 *                      x + attackRange·v̂x, y + attackRange·v̂y)) {
 *                  v = vTriggered; play("jump"); }
 *              activeOffScreen = |v| > 0
 *   Enemy.update(): if (!activeOffScreen && !onScreen()) return;
 *              getState() terrain switch (water/lava destroy, pit latch)
 *              pit ? the descent : { mobileUpdate(); if (!destroy) { hitUpdate(); hitPlayer(); } }
 *   mobileUpdate(): if (!destroy && !freeze) { friction(); moveX(v.x); moveY(v.y) }; death()
 * ```
 *
 * ⛓ `f = 0`, so `Mobile.friction` is `normalize(|v|)` — a no-op on the length
 * — followed by the 0.05 per-axis dead band, which snaps the `-4·sin(π)`
 * residue a horizontal launch carries (4.9e-16) to 0 BEFORE the first move.
 *
 * ⛓ `moveX`/`moveY` OVERRIDE `Mobile`'s to zero `v` on a collision (and to
 * reverse it on a `"Player"` collider — dead code: `"Player"` is not in this
 * class's `solids`, `Mobile.solids` verbatim). A flyer that reaches a wall
 * therefore STOPS there, and its next `decideMotion` points back across the
 * room: it ping-pongs while the player stays in the ray.
 *
 * ⛔ THE TRIGGER IS BELOW `Enemy.update`'s OFF-SCREEN RETURN, which returns from
 * `Enemy.update` only. So a resting flyer the camera has lost still looks down
 * its ray, launches, and is `activeOffScreen` from that tick on.
 *
 * ⛔ `decideMotion` PROBES `["Solid", "Tree"]`, NOT the class's `solids`
 * (`["Solid","Tree","Rock","Rope","ShieldBoss"]`). The two agree in a room with
 * no `Rock`/`Rope`/`ShieldBoss`-typed entity, which is every wallflyer room
 * today; `levelRun` refuses a room where they would differ, by name.
 *
 * ⛓ `knockback` is OVERRIDDEN to `v = -v` (`WallFlyer.as:200-204`): any
 * non-lethal `Enemy.hit` — the dark suit's retaliation among them — sends a
 * flying body back the way it came, and a resting one nowhere.
 *
 * ⚠ The ctor's `coins` (`Math.random`, twice: `Enemy.as:30` and
 * `WallFlyer.as:19`) and `fallSpinSpeed` (`FP.choose`) are draws nothing
 * modelled reads — `spinner.SPINNER_CTOR_RNG`'s shape.
 */

import { rectsOverlap, SOLIDS_BY_MOVER, TILE_SIZE } from './levelWorld.js';
import { collideLineSolid } from './crusher.js';
import { animTicks, createSpriteAnim, stepSpriteAnim } from './chasers.js';
import { defineRecord } from './entityRecords.js';
import { TILE_TYPE_IDS } from '../flashPanel/seedlingSemantics.js';

export class WallFlyerError extends Error {
    constructor(message) { super(message); this.name = 'WallFlyerError'; }
}
const fail = (m) => { throw new WallFlyerError(m); };

const TILE = TILE_SIZE;
const sign = (n) => Math.sign(n);

/**
 * `Enemies/WallFlyer.as` + the `Enemy`/`Mobile` fields it inherits.
 */
export const WALLFLYER = defineRecord('wallFlyer', {
    /** `super(_x + Tile.w/2, _y + Tile.h/2, …)` — the entity is the CELL CENTRE. */
    dx: TILE / 2,
    dy: TILE / 2,
    /** `setHitbox(14, 14, 7, 7)` ⇒ the box is [x-7, x+7) x [y-7, y+7). */
    w: 14,
    h: 14,
    originX: 7,
    originY: 7,
    /** `moveSpeed:Number = 4` — the launch, and `check()`'s settle (negated). */
    moveSpeed: 4,
    /** `attackRange:int = FP.screen.width`; `Main.as:36` is `super(160, 160, …)`. */
    attackRange: 160,
    /** `f = 0` in the ctor: `Mobile.friction` keeps the length. */
    f: 0,
    /** `Mobile.friction`'s per-axis dead band. */
    zeroBand: 0.05,
    /** `Enemy`'s, not overridden. */
    hitsMax: 3,
    hitsTimerMax: 30,
    damage: 1,
    /** `Enemy.hitPlayer`'s `p.hit(this, 3, …)`. */
    contactForce: 3,
    /** `add("die", [5, 6, 7, 8], 10)`. */
    dieAnimFrames: 4,
    dieAnimRate: 10,
    /** `Enemy.fallAlphaSpeed` / `Mobile.death`'s fade. */
    fallAlphaSpeed: 0.05,
    alphaFade: 0.1,
    /** `decideMotion`'s own probe list — NOT `solids`. */
    triggerTypes: Object.freeze(['Solid', 'Tree']),
    /** `Mobile.solids`, verbatim (its own copy: a shared node is refused). */
    solids: Object.freeze([...SOLIDS_BY_MOVER.enemy]),
    terrain: Object.freeze({ [TILE_TYPE_IDS.water]: 'water', [TILE_TYPE_IDS.pit]: 'pit', [TILE_TYPE_IDS.lava]: 'lava' }),
    src: 'Enemies/WallFlyer.as:18-21,24-45,53-75,110-163,200-254 + Enemies/Enemy.as:62-118,141-181,211-221 + Mobile.as:31-101',
}, { doc: ['src'], src: 'wallFlyer.js' });

/**
 * `decideMotion`'s switch, by the four-bit wall mask `d` (+1 right, +2 above,
 * +4 left, +8 below). The angle EXPRESSIONS are the source's, operand for
 * operand, so the doubles are the game's; `null` is `default: return new
 * Point()`.
 */
const ANGLE_BY_MASK = Object.freeze([
    null,                 // 0
    Math.PI,              // 1
    Math.PI * 3 / 2,      // 2
    Math.PI * 5 / 4,      // 3
    0,                    // 4
    0,                    // 5
    Math.PI * 7 / 4,      // 6
    Math.PI * 3 / 2,      // 7
    Math.PI / 2,          // 8
    Math.PI * 3 / 4,      // 9
    Math.PI / 2,          // 10
    Math.PI,              // 11
    Math.PI / 4,          // 12
    Math.PI / 2,          // 13
    0,                    // 14
    null,                 // 15
]);

/** The 14x14 body at an entity point. */
export function wallFlyerRect(p) {
    if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) {
        fail('wallFlyerRect: a wallflyer needs a finite entity position');
    }
    const x = p.x - WALLFLYER.originX;
    const y = p.y - WALLFLYER.originY;
    return { x, y, w: WALLFLYER.w, h: WALLFLYER.h, right: x + WALLFLYER.w, bottom: y + WALLFLYER.h };
}

/**
 * `decideMotion(speed)` — the wall mask at the body's position, and the
 * launch vector away from it (or into it, for a negative speed).
 *
 * @param {{x:number,y:number}} p
 * @param {number} speed
 * @param {(rect) => boolean} probe  `collideTypes(["Solid","Tree"], …)`
 */
export function decideMotion(p, speed, probe) {
    let d = 0;
    if (probe(wallFlyerRect({ x: p.x + WALLFLYER.w, y: p.y }))) d += 1;
    if (probe(wallFlyerRect({ x: p.x, y: p.y - WALLFLYER.h }))) d += 2;
    if (probe(wallFlyerRect({ x: p.x - WALLFLYER.w, y: p.y }))) d += 4;
    if (probe(wallFlyerRect({ x: p.x, y: p.y + WALLFLYER.h }))) d += 8;
    const ang = ANGLE_BY_MASK[d];
    if (ang === null) return { x: 0, y: 0, d };
    return { x: speed * Math.cos(ang), y: -speed * Math.sin(ang), d };
}

const len = (v) => Math.hypot(v.x, v.y);

/**
 * One wallflyer at its `.oel` cell, at rest and NOT yet checked.
 *
 * ⛓ `check()` runs inside the world's first `Game.update` (`Game.as:870-878`,
 * `if (!checked)`), just before the entity updates — so the tick-0 sample
 * reads `v = 0` (MEASURED: `r2-wallflyer-contact`'s body probe, t 0), and the
 * first `stepWallFlyer` applies `v = decideMotion(-moveSpeed)` (INTO the wall)
 * before its own update settles the body against that wall.
 */
export function newWallFlyer({ id, x, y }) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) fail(`newWallFlyer: ${id} needs a finite .oel position`);
    return {
        id,
        as3: 'WallFlyer',
        x: x + WALLFLYER.dx,
        y: y + WALLFLYER.dy,
        vx: 0,
        vy: 0,
        checked: false,
        hits: 0,
        hitsTimer: 0,
        activeOffScreen: false,
        alpha: 1,
        destroy: false,
        fallInPit: false,
        fell: false,
        removed: false,
        dieAnim: null,
        deathCause: null,
        launches: 0,
    };
}

/** `Mobile.friction` at `f = 0`: the length kept, the dead band applied. */
export function wallFlyerFriction(vx, vy) {
    const l = Math.hypot(vx, vy);
    let nx = vx;
    let ny = vy;
    if (l > 0) {
        const scaled = Math.max(l - WALLFLYER.f, 0);
        nx = (vx / l) * scaled;
        ny = (vy / l) * scaled;
    }
    if (Math.abs(nx) < WALLFLYER.zeroBand) nx = 0;
    if (Math.abs(ny) < WALLFLYER.zeroBand) ny = 0;
    return { vx: nx, vy: ny };
}

/** The `moveX`/`moveY` override for one axis: stop (zero BOTH axes) on a hit. */
function stopAxis(pos, rel, collides) {
    let p = pos;
    for (let i = 0; i < Math.abs(rel); i += 1) {
        const step = Math.min(1, Math.abs(rel) - i) * sign(rel);
        if (collides(p + step)) return { pos: p, stopped: true };
        p += step;
    }
    return { pos: p, stopped: false };
}

/**
 * ONE `WallFlyer.update()` — the ENTITY half. The "die" graphic half is the
 * caller's (`stepWallFlyerGraphic`), after it, as `World.update` runs them.
 *
 * `ctx`:
 *   `collides(rect)`     the class's `solids` (static geometry, blocks).
 *   `probe(rect)`        `decideMotion`'s `["Solid","Tree"]`.
 *   `tileTypeAt(x, y)`   `nearestToPoint("Tile", x, y).t`.
 *   `onScreen(rect)`     `Entity.onScreen()` — a boolean; an uncertain band is
 *                        the caller's refusal to raise.
 *   `frozen`             `Game.freezeObjects` (the motion only).
 *   `playerBox`          the player's box where the previous tick left it
 *                        (the Player updates last).
 *   `hitPlayer(w)`       `Enemy.hitPlayer`'s call, made when its gates pass and
 *                        the boxes overlap; returns the body as the call left
 *                        it (a retaliation may hit it).
 *
 * @returns the next state (a new object) plus `{ launched, contact }`.
 */
export function stepWallFlyer(s, ctx) {
    const { collides, probe, tileTypeAt, onScreen, frozen = false, playerBox, hitPlayer } = ctx;
    if (s.removed) return { w: s, launched: false, contact: false };
    let w = { ...s };
    let contact = false;
    // `check()`, on the world's first update frame.
    if (!w.checked) {
        const v0 = decideMotion(w, -WALLFLYER.moveSpeed, probe);
        w.vx = v0.x;
        w.vy = v0.y;
        w.checked = true;
    }
    // ── Enemy.update ──────────────────────────────────────────────────
    const gate = w.activeOffScreen || onScreen(wallFlyerRect(w));
    if (gate) {
        const kind = WALLFLYER.terrain[tileTypeAt(w.x, w.y)];
        if (kind === 'water' || kind === 'lava') {
            if (!w.destroy) w.deathCause = kind;
            w.destroy = true;
        } else if (kind === 'pit' && !w.fallInPit) {
            w.fallInPit = true;
        }
        if (!w.destroy && w.fallInPit) {
            w.x += (Math.floor(w.x / TILE) * TILE + TILE / 2 - w.x) / 10;
            w.y += (Math.floor(w.y / TILE) * TILE + TILE / 2 - w.y) / 10;
            w.alpha -= WALLFLYER.fallAlphaSpeed;
            if (w.alpha <= 0) {
                w.destroy = true;
                w.fell = true;
                w.deathCause = 'pit';
            }
        } else {
            // Mobile.mobileUpdate
            if (!w.destroy && !frozen) {
                const fr = wallFlyerFriction(w.vx, w.vy);
                w.vx = fr.vx;
                w.vy = fr.vy;
                const sx = stopAxis(w.x, w.vx, (nx) => collides(wallFlyerRect({ x: nx, y: w.y })));
                w.x = sx.pos;
                if (sx.stopped) { w.vx = 0; w.vy = 0; }
                // `moveY(v.y)` reads `v.y` after `moveX` may have zeroed it.
                const sy = stopAxis(w.y, w.vy, (ny) => collides(wallFlyerRect({ x: w.x, y: ny })));
                w.y = sy.pos;
                if (sy.stopped) { w.vx = 0; w.vy = 0; }
            }
            // Mobile.death()
            if (w.destroy) {
                w.alpha -= WALLFLYER.alphaFade;
                if (w.alpha <= 0) w.removed = true;
            }
            if (!w.destroy) {
                // hitUpdate()
                if (w.hitsTimer > 0) w.hitsTimer -= 1;
                // hitPlayer()
                if (w.dieAnim === null && w.hitsTimer <= 0 && playerBox
                    && rectsOverlap(wallFlyerRect(w), playerBox)) {
                    contact = true;
                    w = hitPlayer(w);
                }
            }
        }
    }
    // ── WallFlyer.update's tail ───────────────────────────────────────
    if (w.destroy || w.dieAnim !== null) return { w, launched: false, contact };
    let launched = false;
    const vt = decideMotion(w, WALLFLYER.moveSpeed, probe);
    const l = len(vt);
    if (l > 0 && playerBox) {
        const hit = collideLineSolid([playerBox], w.x, w.y,
            w.x + WALLFLYER.attackRange * (vt.x / l), w.y + WALLFLYER.attackRange * (vt.y / l));
        if (hit) {
            // A re-trigger along the same wall writes the same vector: only a
            // CHANGE is a launch for the ledger.
            launched = (w.vx === 0 && w.vy === 0) || w.vx * vt.x + w.vy * vt.y <= 0;
            if (launched) w.launches += 1;
            w.vx = vt.x;
            w.vy = vt.y;
        }
    }
    w.activeOffScreen = len({ x: w.vx, y: w.vy }) > 0;
    return { w, launched, contact };
}

/** The graphic half: the "die" anim, whose `endAnim` sets `destroy`. */
export function stepWallFlyerGraphic(w) {
    if (w.removed || w.dieAnim === null || w.dieAnim.complete) return w;
    const anim = { ...w.dieAnim };
    const fired = stepSpriteAnim(anim);
    return { ...w, dieAnim: anim, ...(fired ? { destroy: true } : {}) };
}

/**
 * `Enemy.hit(f, p, d, t)` with `WallFlyer`'s two overrides: `knockback` is
 * `v = -v`, and `startDeath` plays "die" instead of setting `destroy`.
 *
 * Gates, in source order: `hitsTimer <= 0 || hitByDarkStuff`, the freeze,
 * `canHit` (true); `onlyHitBy` is ""; `hitByFire` is false, so a Fire hit is
 * the knockback alone.
 */
export function hitWallFlyer(w, { damage = 1, t = '', frozen = false } = {}) {
    if (w.removed || w.destroy) return { w, landed: false, killed: false };
    if (w.hitsTimer > 0 && w.hitByDarkStuff !== true) return { w, landed: false, killed: false };
    if (frozen) return { w, landed: false, killed: false };
    if (t === 'Fire') return { w: { ...w, vx: -w.vx, vy: -w.vy }, landed: false, killed: false };
    if (w.hits >= WALLFLYER.hitsMax) return { w, landed: false, killed: false };
    const hits = w.hits + damage;
    const dark = t === 'Shield' || t === 'Suit';
    const next = {
        ...w, hits, hitsTimer: WALLFLYER.hitsTimerMax,
        ...(dark || w.hitByDarkStuff !== undefined ? { hitByDarkStuff: dark } : {}),
    };
    if (hits >= WALLFLYER.hitsMax) {
        return {
            w: { ...next, dieAnim: createSpriteAnim(WALLFLYER.dieAnimFrames, WALLFLYER.dieAnimRate),
                deathCause: t === '' ? 'killed' : t.toLowerCase() },
            landed: true,
            killed: true,
        };
    }
    return { w: { ...next, vx: -next.vx, vy: -next.vy }, landed: true, killed: false };
}

/**
 * ⛓ seedling-fidelity-wallflyer W6: the "die" anim's length in graphic updates, from `add("die", [5, 6, 7, 8], 10)`
 * through `chasers.animTicks` (the one stepping rule) — the number `enemyDamage.removalTicksAfterHit('WallFlyer', …)`
 * takes, since `CORPSE_COUNTING.WallFlyer` carries no chaser tag to resolve it from.
 */
export function wallFlyerDeathTicks() {
    return animTicks(WALLFLYER.dieAnimFrames, WALLFLYER.dieAnimRate);
}
