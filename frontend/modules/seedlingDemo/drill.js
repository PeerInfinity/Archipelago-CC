/**
 * seedlingDemo/drill — ⛓ seedling-fidelity-terrain D2: `Enemies/Drill.as`, TRANSCRIBED (behind
 * `contactFidelity.CONTACT_FIDELITY.drillLive`, OFF).
 *
 * The divergence sweep's L88 rows ("terrain", Δy ≈ +2.5) are this body: the game's drill hops one tile onto the
 * player and its contact knocks the player back (`hits` 0 → 1 at the divergence tick), and the model has no drill
 * at all — `combat.contactPricing('drill')` is a `mover`, so the run only ever threw if the player stood inside the
 * PLACEMENT, and billed nothing anywhere else.
 *
 * ── THE AS3, IN UPDATE ORDER ───────────────────────────────────────────
 * ```
 *   update():  if (Game.freezeObjects) return;                  // ABOVE super.update — the i-frame parks too
 *              super.update()                                   // Enemy.update: the off-screen return, the terrain
 *                                                               // switch, mobileUpdate (v is always 0: knockback is
 *                                                               // an EMPTY override), hitUpdate, hitPlayer
 *              if (destroy || currentAnim == "die") return;
 *              if (hitsTimer > 0) play("hit")
 *              else { if (currentAnim == "hit") play("undrill");
 *                     p = nearestToPoint("Player"); d = distance(x, y, p.x, p.y)
 *                     if (currentAnim == "sit" && d <= runRange 48 && !collideLine("Solid", x, y, p.x, p.y)) {
 *                         tox:int = x; toy:int = y
 *                         if (|p.x − x| > 8) tox += ±16;   if (|p.y − y| > 8) toy += ±16
 *                         if (tox != x && !collideTypes(solids, tox, y)) { x = tox; play("drill") }
 *                         if (toy != y && !collideTypes(solids, x, toy)) { y = toy; play("drill") } } }
 *   graphic:   "drill" [5 frames, 20] → endAnim → "undrill" [4, 20] → endAnim → "sit" (rate 0: never ends)
 *              "hit" [2, 20, loop] → endAnim → play("hit") (a no-op: already playing)
 *              "die" [6, 10] → endAnim → destroy
 *   hitPlayer: p.hit(this, 3, Point(x, y), damage 1) when !destroy, anim != "die", hitsTimer <= 0 and the 10x10
 *              box (origin 5, 5) overlaps the player's
 * ```
 * ⛓ The player is read where the PREVIOUS tick left it: `loadlevel` adds the drills (`Game.as:2290`) before the
 * Player, and `addUpdate` prepends. ⛓ `solids` is `Mobile.solids` + "Enemy" (`Drill.as:35`); `levelRun` admits a
 * room only when the drill is its ONLY census enemy, so the "Enemy" term meets nothing (L88).
 */

import { createSpriteAnim, stepSpriteAnim } from './chasers.js';

export const DRILL = Object.freeze({
    /** `super(_x + Tile.w/2, _y + Tile.h/2)`. */
    dx: 8,
    dy: 8,
    /** `setHitbox(10, 10, 5, 5)`. */
    w: 10,
    h: 10,
    ox: 5,
    oy: 5,
    /** `runRange:int = 48`. */
    runRange: 48,
    tile: 16,
    /** `Enemy.hitsMax` / `hitsTimerMax`. */
    hitsMax: 3,
    hitsTimerMax: 30,
    /** `Enemy.hitPlayer`: `p.hit(this, 3, …, damage)`, `damage = 1`. */
    contactForce: 3,
    damage: 1,
    /** `sprDrill.add(…)` — frames and rates; "sit" is rate 0 (never completes). */
    anims: Object.freeze({
        drill: Object.freeze({ frames: 5, rate: 20 }),
        undrill: Object.freeze({ frames: 4, rate: 20 }),
        hit: Object.freeze({ frames: 2, rate: 20, loop: true }),
        die: Object.freeze({ frames: 6, rate: 10 }),
    }),
});

export function newDrill({ id, x, y }) {
    return { id, x: x + DRILL.dx, y: y + DRILL.dy, hits: 0, hitsTimer: 0, hitByDarkStuff: false,
        anim: 'sit', sprite: null, destroy: false, removed: false, hops: 0 };
}

export function drillRect(d) {
    const x = d.x - DRILL.ox;
    const y = d.y - DRILL.oy;
    return { x, y, right: x + DRILL.w, bottom: y + DRILL.h };
}

/** `Spritemap.play(name)` without `reset`: the same name keeps playing. */
function play(d, name) {
    if (d.anim === name) return d;
    const a = DRILL.anims[name];
    return { ...d, anim: name, sprite: a ? createSpriteAnim(a.frames, a.rate) : null };
}

/**
 * ONE `Drill.update()` — the entity half. `ctx`:
 *   `frozen`               `Game.freezeObjects`
 *   `onScreen(rect)`       `Entity.onScreen()` (Enemy.update's early return: contact and i-frame only)
 *   `playerBox`, `player`  the player's box and entity point where the previous tick left them
 *   `lineBlocked(x0, y0, x1, y1)`  `collideLine("Solid", …)`
 *   `collides(rect)`       `collideTypes(solids, …)` for the hop
 *   `hitPlayer(d)`         the contact; returns the body as the call left it
 * @returns {{d, contact: boolean, hopped: boolean}}
 */
export function stepDrill(s, ctx) {
    if (s.removed || ctx.frozen) return { d: s, contact: false, hopped: false };
    let d = { ...s };
    let contact = false;
    // ── Enemy.update (activeOffScreen is never set for this class) ──
    if (ctx.onScreen(drillRect(d))) {
        if (!d.destroy) {
            if (d.hitsTimer > 0) d.hitsTimer -= 1;
            if (d.anim !== 'die' && d.hitsTimer <= 0 && ctx.playerBox && rectsOverlapStrict(drillRect(d), ctx.playerBox)) {
                contact = true;
                d = ctx.hitPlayer(d);
            }
        }
    }
    // ── Drill.update's tail ──
    if (d.destroy || d.anim === 'die') return { d, contact, hopped: false };
    let hopped = false;
    if (d.hitsTimer > 0) {
        d = play(d, 'hit');
    } else {
        if (d.anim === 'hit') d = play(d, 'undrill');
        const p = ctx.player;
        if (p && d.anim === 'sit' && Math.hypot(p.x - d.x, p.y - d.y) <= DRILL.runRange
            && !ctx.lineBlocked(d.x, d.y, p.x, p.y)) {
            let tox = Math.trunc(d.x);
            let toy = Math.trunc(d.y);
            if (Math.abs(p.x - d.x) > DRILL.tile / 2) tox += (p.x > d.x ? 1 : -1) * DRILL.tile;
            if (Math.abs(p.y - d.y) > DRILL.tile / 2) toy += (p.y > d.y ? 1 : -1) * DRILL.tile;
            if (tox !== d.x && !ctx.collides(drillRect({ x: tox, y: d.y }))) {
                d.x = tox;
                d = play(d, 'drill');
                hopped = true;
            }
            if (toy !== d.y && !ctx.collides(drillRect({ x: d.x, y: toy }))) {
                d.y = toy;
                d = play(d, 'drill');
                hopped = true;
            }
            if (hopped) d.hops += 1;
        }
    }
    return { d, contact, hopped };
}

/** The graphic half (`World.update` runs it after the entity, outside every gate): `endAnim`'s switch. */
export function stepDrillGraphic(s) {
    if (s.removed || !s.sprite) return s;
    const sprite = { ...s.sprite };
    const fired = stepSpriteAnim(sprite);
    let d = { ...s, sprite };
    if (!fired) return d;
    switch (d.anim) {
        case 'drill': return play(d, 'undrill');
        case 'undrill': return play(d, 'sit');
        case 'hit': {
            // a looping anim: `_index = 0` and the callback, whose `play("hit")` is a no-op
            const a = DRILL.anims.hit;
            return { ...d, sprite: createSpriteAnim(a.frames, a.rate) };
        }
        case 'die': d = { ...d, destroy: true, sprite: null }; return d;
        default: return play(d, 'sit');
    }
}

/**
 * `Enemy.hit(f, p, d, t)` on a drill — `knockback` is an EMPTY override, so a landed hit moves nothing.
 * @returns {{d, landed, killed}}
 */
export function hitDrill(s, { damage = 1, t = '', frozen = false } = {}) {
    if (s.removed || s.destroy) return { d: s, landed: false, killed: false };
    if (!(s.hitsTimer <= 0 || s.hitByDarkStuff) || frozen) return { d: s, landed: false, killed: false };
    if (t === 'Fire') return { d: s, landed: false, killed: false };
    if (s.hits >= DRILL.hitsMax) return { d: s, landed: false, killed: false };
    const hits = s.hits + damage;
    const next = { ...s, hits, hitsTimer: DRILL.hitsTimerMax, hitByDarkStuff: t === 'Shield' || t === 'Suit' };
    if (hits >= DRILL.hitsMax) return { d: play(next, 'die'), landed: true, killed: true };
    return { d: next, landed: true, killed: false };
}

/** `Entity.collide`'s strict half-open overlap. */
function rectsOverlapStrict(a, b) {
    return a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
}
