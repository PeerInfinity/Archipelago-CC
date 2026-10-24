/**
 * seedlingDemo/placedGrenade — ⛓⛓⛓ SEEDLING FIDELITY LADDER2: A PLACED
 * `Grenade` IS A BODY WITH A FUSE, NOT A CONTACT.
 *
 * `Enemies/Grenade.as`, the `.oel` placement (`Game.as:2298`, `new
 * Grenade(o.@x, o.@y)` → `_active = false`, `_exTime = 60`). The Owl's grenades
 * (`finalBossFight.GRENADE`) are the same class born ACTIVE on the ground; a
 * placed one starts `fallHeight` (48) px ABOVE its cell, dormant.
 *
 *   - `update()` never calls `super.update()`, so `Enemy.hitPlayer` never runs:
 *     standing on a grenade costs nothing (`finalBossFight.GRENADE`'s docblock).
 *   - DORMANT until `FP.distance(x, endY, p.x, p.y) <= 32` (the player's ENTITY
 *     point, read when the grenade updates — it is added after the Player, so
 *     it updates first and reads the previous frame's point).
 *   - then it FALLS: `v.y += 0.1`, `mobileUpdate()` (friction 0 — only the
 *     |v| < 0.05 clamp — and a 1 px-stepped `moveY`). ⛔ The falling branch
 *     sets `collidable = false`, and `Entity.collide` returns null for a
 *     non-collidable entity (`Entity.as:149`): the fall IGNORES walls, and
 *     only the resting branch (`collidable = true`) meets `solids`. Measured:
 *     L59's and L63's grenades spawn inside a wall and blast on schedule. At
 *     `y >= endY` it bounces `v.y = -v.y + 1` until `v.y <= 0` there; the two
 *     `if`s of `update()` BOTH run in one update.
 *   - resting (`y >= endY`, `v.y <= 0`), `explodeTime` counts 60 → 0 → -1 and
 *     plays `"explode"` (12 fps, 8 frames); its callback is THE BLAST:
 *     `FP.distance(x, endY, p.x, p.y) <= 20` → `p.hit(null, 2, (x, endY), 1)`,
 *     then `"hit"` (3 frames) and `FP.world.remove(this)`.
 *
 * ⇒ the danger is ONE TICK at ONE disc (r 20 at `(x, endY)`), a fixed fuse
 * after the arming update. A walk that passes and leaves is never touched.
 */
import { GRENADE, GRENADE_EXPLODE_UPDATES, GRENADE_HIT_UPDATES, pointDistance } from './finalBossFight.js';

export const PLACED_GRENADE = Object.freeze({
    fallHeight: 48,
    fallTriggerDistance: 32,
    g: 0.1,
    explodeTime: 60,
    hitRadius: GRENADE.hitRadius,
    force: GRENADE.force,
    damage: GRENADE.damage,
    box: GRENADE.box,
    src: 'Enemies/Grenade.as:19-24,32-60,82-117,131-148',
});

/** A placed grenade at its census row's entity point (`cx`, `cy` = `_x + 8`, `_y + 8`). */
export function createPlacedGrenade(cx, cy, { id = null } = {}) {
    return {
        id, x: cx, endY: cy, y: cy - PLACED_GRENADE.fallHeight,
        vx: 0, vy: 0, activated: false, explodeTime: PLACED_GRENADE.explodeTime,
        anim: 'sit', animAge: null, updates: 0,
        armedAt: null, playedAt: null, blastAt: null, removedAt: null, removed: false,
    };
}

function grenadeBox(g, y = g.y) {
    const { w, h, ox, oy } = PLACED_GRENADE.box;
    return { x: g.x - ox, y: y - oy, right: g.x - ox + w, bottom: y - oy + h };
}

/** `Mobile.mobileUpdate` for a grenade: friction (f = 0) then `moveY(v.y)`. */
function mobileUpdate(g, solidAt) {
    // `v.normalize(max(len - 0, 0))` leaves a non-zero v alone; then the clamps.
    if (Math.abs(g.vx) < 0.05) g.vx = 0;
    if (Math.abs(g.vy) < 0.05) g.vy = 0;
    const d = g.vy;
    for (let i = 0; i < Math.abs(d); i += 1) {
        const s = Math.min(1, Math.abs(d) - i) * Math.sign(d);
        if (solidAt && solidAt(grenadeBox(g, g.y + s))) return;
        g.y += s;
    }
}

/**
 * One `Grenade.update()` + its graphic, given the player's entity point as the
 * grenade reads it. Returns `'blast'` on the update whose `"explode"` callback
 * fires (the caller tests `blastReaches`), `'removed'` on the last, else null.
 */
export function stepPlacedGrenade(g, px, py, { solidAt = null } = {}) {
    if (g.removed) return null;
    g.updates += 1;
    const near = pointDistance(g.x, g.endY, px, py) <= PLACED_GRENADE.fallTriggerDistance;
    if (g.y >= g.endY) {
        if (g.vy > 0) {
            g.vy = -g.vy + 1;
        } else {
            g.vy = 0;
            if (g.explodeTime > 0) {
                g.explodeTime -= 1;
            } else if (g.explodeTime === 0) {
                g.explodeTime = -1;
                g.anim = 'explode';
                g.animAge = 0;
                g.playedAt = g.updates;
            }
        }
        mobileUpdate(g, solidAt);
    } else if (near) {
        if (!g.activated) g.armedAt = g.updates;
        g.activated = true;
    }
    if (g.y < g.endY && g.activated) {
        // `collidable = false` first — and `Entity.collide` returns null for a
        // non-collidable entity (`net/flashpunk/Entity.as:149`), so the FALL
        // passes through walls (L59's and L63's grenades spawn inside one).
        g.vy += PLACED_GRENADE.g;
        mobileUpdate(g, null);
    }
    // The graphic, in the same pass (`World.update`).
    if (g.animAge === null) return null;
    g.animAge += 1;
    if (g.anim === 'explode' && g.animAge >= GRENADE_EXPLODE_UPDATES) {
        g.anim = 'hit';
        g.animAge = 0;
        g.blastAt = g.updates;
        return 'blast';
    }
    if (g.anim === 'hit' && g.animAge >= GRENADE_HIT_UPDATES) {
        g.anim = null;
        g.animAge = null;
        g.removed = true;
        g.removedAt = g.updates;
        return 'removed';
    }
    return null;
}

/** `FP.distance(x, endY, p.x, p.y) <= hitRadius` — entity point to entity point. */
export function blastReaches(g, px, py) {
    return pointDistance(g.x, g.endY, px, py) <= PLACED_GRENADE.hitRadius;
}

/**
 * THE FUSE: updates from the arming update to the blast update, simulated for
 * this grenade (its own column's solids). `Infinity` when it never blasts — a
 * grenade whose fall a solid stops above `endY` never rests and never counts.
 */
export function placedGrenadeFuse(cx, cy, { solidAt = null, limit = 2000 } = {}) {
    const g = createPlacedGrenade(cx, cy);
    for (let u = 0; u < limit; u += 1) {
        // The trigger needs the player near once; after that it is never read.
        const ev = stepPlacedGrenade(g, g.x, g.endY, { solidAt });
        if (ev === 'blast') return g.blastAt - g.armedAt;
    }
    return Infinity;
}
