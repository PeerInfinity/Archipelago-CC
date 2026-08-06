/**
 * seedlingDemo/crusher — THE PURSUER, and the ruling it forces.
 *
 * R5 slice 12 step 3. §24.6 measured L41 and L42 down to "the part crosses
 * on the crusher alone" and then stopped at a contradiction: `hazards`
 * prices a crusher HARD-AVOID over exactly the four 64-px lanes the level's
 * solution requires standing in. That is only a contradiction while the
 * crusher is read as a HAZARD. It is not one.
 *
 * ── ⛔⛔ IT IS A DETERMINISTIC PURSUER, AND EVERY WORD OF THAT MATTERS ─
 *
 *   ALWAYS ARMED   `update()`'s gate is `if (activate || t == -1)`. On a
 *                  `Lock`, `tSet < 0` is the KILL-LOCK sentinel — "open
 *                  when the room is clear". On a `Crusher` the same
 *                  literal means the opposite: ON, permanently. Both
 *                  spellings live in this cluster, one class apart.
 *   AT REST        it GRID-SNAPS (`Math.round(x / Tile.w) * Tile.w`), so
 *                  its resting position is always a cell corner however it
 *                  arrived.
 *   IT NEEDS SIGHT `collideLine("Solid", x, y, p.x, p.y)` with its own
 *                  `type` swapped to `"BS"` for the duration — so ANY
 *                  Solid between it and the player shields you, including
 *                  a pushable block, a `BreakableRock`, and another
 *                  crusher. ⛓ THAT IS L41's WHOLE LEG: its
 *                  `breakablerock`s are what shield it, so BREAKING THEM
 *                  UNLEASHES IT and the leg is an ORDER, not a set.
 *   FOUR LANES     four 64-px rects, scanned in the order E, N, W, S with
 *                  NO `break` — so a player inside two of them arms the
 *                  LATER one. A diagonal approach picks S over E.
 *   IT CHARGES     1 px per tick, its own `moveX`/`moveY`, `v` ZEROED on
 *                  the first Solid — and it stays where it stopped. No
 *                  retraction, no timer, no RNG. Then it re-scans from the
 *                  new cell.
 *   IT KILLS       `hit()` runs on EVERY armed tick, including at rest,
 *                  and its damage is 1000 — `die()` at any `hitsMax`. Its
 *                  reach is its own 32x32 BODY; the lanes only trigger.
 *                  ⛓ And it kills `Enemy` too, with the same 1000.
 *
 * ── ⚠⚠ AND IT DOES NOT STOP FOR A CEREMONY ───────────────────────────
 *
 * `update()` never tests `Game.freezeObjects`. A pickup's 150 frozen
 * frames stop the PLAYER (`Mobile.mobileUpdate` is what the flag gates)
 * and not the crusher — so **a part-collect near a crusher is a
 * ceremony-duration SURVIVAL claim**, not a positional one. Either the
 * collect stance is outside every reachable charge line for the whole
 * freeze, or the crusher is baited and PARKED behind a Solid first.
 * `CEREMONY_RULE` states it; it generalises to every ungated pursuer.
 *
 * ── ⚖ THE CONSEQUENCE: HARD-AVOID IS RETIRED FOR THIS CLASS ──────────
 *
 * `hazardVolume`'s verdict is right about the DAMAGE and wrong about the
 * VERB. A hazard is something a route stays out of; a crusher is a piece
 * of MACHINERY a route operates — present the player in a lane, sidestep
 * at walking speed against its 1 px/tick, and park it against a wall,
 * where it becomes a mobile Solid that can seal a corridor, open one, or
 * shield the next lane. `CRUSHER_VERBS` names the three.
 */

import { rectsOverlap } from './levelWorld.js';

export class CrusherError extends Error {
    constructor(message) { super(message); this.name = 'CrusherError'; }
}
const fail = (m) => { throw new CrusherError(m); };

const TILE = 16;

/** `Crusher.as:18-38`, transcribed. */
export const CRUSHER = Object.freeze({
    /** `super(_x + Tile.w, _y + Tile.h, …)` — the ENTITY is a tile in. */
    dx: TILE,
    dy: TILE,
    /** `setHitbox(32, 32, 16, 16)` — a 2x2 body centred on the entity. */
    w: 32,
    h: 32,
    originX: 16,
    originY: 16,
    /** `intDist` — how far each detection lane reaches. */
    intDist: 64,
    /** `speed` — one pixel per tick. A walking player is faster. */
    speed: 1,
    /** "KILL EVERYTHING". */
    damage: 1000,
    force: 1,
    spinRate: 8,
    type: 'Solid',
    /** What `hit()` collides into — Solid and ShieldBoss are collected and ignored. */
    hitables: Object.freeze(['Player', 'Solid', 'Enemy', 'ShieldBoss']),
    /** What `moveX`/`moveY` stop on. ⚠ NOT "Player" — it moves THROUGH you, killing. */
    solids: Object.freeze(['Solid']),
});

/**
 * `directions`, IN SOURCE ORDER — and the order is the semantics.
 *
 * ⛔ The scan loop has no `break`, so every matching direction overwrites
 * `v` and the LAST one wins. A player standing where the east and south
 * lanes overlap is charged at from the SOUTH.
 */
export const DIRECTIONS = Object.freeze([
    Object.freeze({ name: 'E', dx: 1, dy: 0 }),
    Object.freeze({ name: 'N', dx: 0, dy: -1 }),
    Object.freeze({ name: 'W', dx: -1, dy: 0 }),
    Object.freeze({ name: 'S', dx: 0, dy: 1 }),
]);

/** ⛔ `t == -1` means ALWAYS ON — the opposite of the same literal on a `Lock`. */
export const alwaysArmed = (t) => t === -1;

/** The 32x32 body, which is both its collider and its kill box. */
export function crusherRect(c) {
    if (!Number.isFinite(c?.x) || !Number.isFinite(c?.y)) {
        fail('crusherRect: a crusher needs a finite entity position');
    }
    const x = c.x - CRUSHER.originX;
    const y = c.y - CRUSHER.originY;
    return { x, y, w: CRUSHER.w, h: CRUSHER.h, right: x + CRUSHER.w, bottom: y + CRUSHER.h };
}

/**
 * The four detection rects, transcribed rather than described.
 *
 *     offsetX = -originX + intDist * (dx < 0 ? dx : 0)
 *     w       = width    + intDist * |dx|
 *
 * ⚠ Each rect CONTAINS the body — the arm is grown from it, not attached
 * to it — so a player standing on the crusher is inside all four.
 */
export function detectionRects(c) {
    return DIRECTIONS.map((d) => {
        const x = c.x - CRUSHER.originX + CRUSHER.intDist * (d.dx < 0 ? d.dx : 0);
        const y = c.y - CRUSHER.originY + CRUSHER.intDist * (d.dy < 0 ? d.dy : 0);
        const w = CRUSHER.w + CRUSHER.intDist * Math.abs(d.dx);
        const h = CRUSHER.h + CRUSHER.intDist * Math.abs(d.dy);
        return { dir: d.name, dx: d.dx, dy: d.dy, x, y, w, h, right: x + w, bottom: y + h };
    });
}

/**
 * `World.collideLine(type, …)` — a 1 px RAYCAST OF POINTS, not a swept
 * rect, transcribed from `net/flashpunk/World.as:411-500`.
 *
 * ⚠ THREE THINGS A REWRITE GETS WRONG. The coordinates are cast to `int`
 * at the signature; the loop is `while (x < toX)` so the END POINT IS
 * NEVER SAMPLED; and the minor axis advances by a FRACTION
 * (`ySign *= yDelta / xDelta`), so the sampled points are not integers and
 * `collidePoint`'s own `int` truncation is what quantises them.
 *
 * @param {Array<{x,y,right,bottom}>} solids  boxes to test, self EXCLUDED
 *   by the caller — the game does it with a temporary `type = "BS"` swap.
 * @returns {object|null} the first box a sample lands in
 */
export function collideLineSolid(solids, fromX, fromY, toX, toY) {
    const fx = Math.trunc(fromX);
    const fy = Math.trunc(fromY);
    const tx = Math.trunc(toX);
    const ty = Math.trunc(toY);
    const at = (px, py) => {
        // `collidePoint` is `x >= e.x && y >= e.y && x < e.right && y < e.bottom`
        // on the truncated point.
        const ix = Math.trunc(px);
        const iy = Math.trunc(py);
        for (const s of solids) {
            if (ix >= s.x && iy >= s.y && ix < s.right && iy < s.bottom) return s;
        }
        return null;
    };
    if (Math.hypot(tx - fx, ty - fy) < 1) return at(fx, ty);
    const xDelta = Math.abs(tx - fx);
    const yDelta = Math.abs(ty - fy);
    let xSign = tx > fx ? 1 : -1;
    let ySign = ty > fy ? 1 : -1;
    let x = fx;
    let y = fy;
    if (xDelta > yDelta) {
        ySign *= yDelta / xDelta;
        if (xSign > 0) { while (x < tx) { const e = at(x, y); if (e) return e; x += xSign; y += ySign; } }
        else { while (x > tx) { const e = at(x, y); if (e) return e; x += xSign; y += ySign; } }
    } else {
        xSign *= yDelta === 0 ? 0 : xDelta / yDelta;
        if (ySign > 0) { while (y < ty) { const e = at(x, y); if (e) return e; x += xSign; y += ySign; } }
        else { while (y > ty) { const e = at(x, y); if (e) return e; x += xSign; y += ySign; } }
    }
    return null;
}

/**
 * The scan: which way does a resting crusher charge, if any?
 *
 * @param {object} c        `{x, y}` — the crusher's ENTITY position
 * @param {object} player   `{x, y, right, bottom}` — the player's box
 * @param {Array} solids    every Solid EXCEPT this crusher
 * @returns {{dir:string|null, dx:number, dy:number, shieldedBy:object|null, matched:string[]}}
 */
export function scanCrusher(c, player, solids = []) {
    // ⛔ SIGHT FIRST, AND IT IS AN EARLY EXIT. A shielded crusher does not
    // scan at all — which is why breaking the rock in front of one is a
    // step in a route rather than a tidy-up.
    const shieldedBy = collideLineSolid(solids, c.x, c.y, player.x ?? 0, player.y ?? 0);
    if (shieldedBy) return { dir: null, dx: 0, dy: 0, shieldedBy, matched: [] };
    const matched = [];
    let pick = { dir: null, dx: 0, dy: 0 };
    for (const r of detectionRects(c)) {
        if (rectsOverlap(player, r)) {
            matched.push(r.dir);
            // ⛔ NO `break` — the LAST match wins, so this assignment is
            // deliberately unconditional.
            pick = { dir: r.dir, dx: r.dx, dy: r.dy };
        }
    }
    return { ...pick, shieldedBy: null, matched };
}

/**
 * One `Crusher.update()` while armed.
 *
 * `ctx`:
 *   `solids(rect)`   does this box hit a Solid other than me? (the charge's
 *                    stopper — ⚠ "Solid" ONLY: it does not stop for the
 *                    player, it kills them)
 *   `player`         the player's box, and its `{x, y}` for the sight line
 *   `lineSolids`     the Solids the sight line may hit, self excluded
 *
 * @returns {{crusher, moved:number, stopped:boolean, kills:boolean, scan:object|null}}
 */
export function stepCrusher(c, ctx = {}) {
    const { solids = () => null, player = null, lineSolids = [] } = ctx;
    let { x, y, vx = 0, vy = 0 } = c;
    let scan = null;
    if (vx === 0 && vy === 0) {
        // ⛓ THE GRID SNAP IS `Math.round`, NOT `floor` — a crusher that
        // stopped 7 px into a cell snaps FORWARD to the next one, and a
        // model that floored would park it a tile back.
        x = Math.round(x / TILE) * TILE;
        y = Math.round(y / TILE) * TILE;
        if (player) {
            scan = scanCrusher({ x, y }, player, lineSolids);
            vx = scan.dx * CRUSHER.speed;
            vy = scan.dy * CRUSHER.speed;
        }
    }
    // The charge: 1 px steps, `v` zeroed by the first Solid — and it STAYS
    // where it stopped. `moveX` runs before `moveY`, and only one of them
    // is ever non-zero because the scan picks one axis.
    let stopped = false;
    const stepAxis = (axis, v, pos) => {
        let p = pos;
        for (let i = 0; i < Math.abs(v); i += 1) {
            const step = Math.min(1, Math.abs(v) - i) * Math.sign(v);
            const probe = axis === 'x'
                ? crusherRect({ x: p + step, y })
                : crusherRect({ x, y: p + step });
            if (solids(probe)) { stopped = true; return { pos: p, v: 0 }; }
            p += step;
        }
        return { pos: p, v };
    };
    const sx = stepAxis('x', vx, x);
    x = sx.pos; vx = sx.v;
    const sy = stepAxis('y', vy, y);
    y = sy.pos; vy = sy.v;
    // ⚠ `hit()` runs EVERY armed tick, at rest as much as mid-charge, and
    // its reach is the BODY. The lanes only trigger.
    const kills = Boolean(player && rectsOverlap(player, crusherRect({ x, y })));
    return { crusher: { ...c, x, y, vx, vy }, moved: Math.abs(vx) + Math.abs(vy), stopped, kills, scan };
}

/**
 * ⚠⚠ THE RULE A CEREMONY NEAR ONE HAS TO SATISFY.
 *
 * Stated as data because it generalises past this class: `Game.freezeObjects`
 * is tested by `Mobile.mobileUpdate`, so it stops MOBILES. A `Crusher` is an
 * `Activators`, not a `Mobile`, and its `update()` has no gate at all —
 * exactly like the `Pulser` whose ring keeps ticking through a FallRock
 * freeze (§23) and the `Button` that stays pressed under a frozen player
 * (R3). The freeze is not a pause; it is a pause FOR ONE CLASS TREE.
 */
export const CEREMONY_RULE = Object.freeze({
    freezeGated: false,
    src: 'Puzzlements/Crusher.as:42 — `update()` tests `activate || t == -1` and nothing else',
    /** `CEREMONY_DEAD_FRAMES.pickup`; named, not imported, to keep this file a leaf. */
    pickupFreezeFrames: 150,
    /**
     * ⛔⛔ R5 SLICE 13 — THE ORIGINAL CLAIM WAS TOO STRONG, AND CORRECTING IT
     * MAKES IT CHECKABLE.
     *
     * This entry said *"150 frames of freeze against 150 px of charge"* — a
     * survival claim over the whole ceremony. The MOTION half is right and
     * the DAMAGE half is not: `Crusher.hit()` deals its 1000 by calling
     * `(c as Player).hit(...)` (`Crusher.as:98`), and `Player.hit`'s own
     * gate is `if (hitsTimer <= 0 && hits < hitsMax && !Game.freezeObjects)`
     * (`Player.as:1380`). ⇒ **a frozen player cannot be damaged by it.** The
     * crusher charges through the ceremony and its `hit()` lands on a
     * no-op every one of those frames.
     *
     * ⛓⛓ SO THE CLAIM IS ONE FRAME, NOT 150: the crusher may not be
     * overlapping the stance ON THE FIRST UNFROZEN TICK, because `hit()`
     * runs on every armed tick and the freeze is what was suppressing it.
     * That is a claim a model can discharge exactly — simulate the charge
     * forward 150 frames and test one overlap — where "safe for the whole
     * duration" is a claim about 150 unobservable frames.
     *
     * ⚠ AND THE POSITIONAL CONSEQUENCE SURVIVES INTACT. 150 px of charge
     * lands the crusher somewhere new, and it is a 32x32 `Solid` that stays
     * where it stopped — so a ceremony can seal the corridor the route
     * still needs. The route still has to simulate; it just does not have
     * to dodge.
     */
    damagesFrozenPlayer: false,
    damagePath: 'Crusher.as:98 -> Player.hit -> gated on !Game.freezeObjects',
    claim: 'a part-collect within reach of a crusher is a claim about ONE FRAME — the '
        + 'first unfrozen tick — plus a positional claim about where 150 px of charge '
        + 'leaves a 32x32 mobile Solid. `hit()` runs through the freeze and lands on a '
        + 'no-op, because every damage path in this game reaches the player through '
        + '`Player.hit` and that method is freeze-gated. Either the stance is clear of '
        + 'the BODY when the freeze drains, or the crusher is baited and PARKED behind a '
        + 'Solid before the pickup is touched.',
    generalises: 'every ungated pursuer — read `update()` for a `Game.freezeObjects` test '
        + 'to know whether it MOVES, and then read its damage call to know whether it '
        + 'HURTS. The two are different questions and this entry conflated them for a '
        + 'slice. See `PLAYER_DAMAGE_PATHS`.',
});

/**
 * ⛓⛓⛓ WHAT CAN HURT A FROZEN PLAYER — ENUMERATED, BECAUSE EVERY CEREMONY
 * FROM HERE ON IS A STANCE-SAFETY QUESTION.
 *
 * R5 slice 13. Five collect ceremonies stand between the route and the wand,
 * each freezing the player for 150 frames beside whatever the room holds, so
 * "is this stance safe" stopped being answerable one class at a time. Asked
 * of the whole source instead — every `.hit(` call site that takes a
 * `Player`, and every write to the player's death path:
 *
 * ```
 *   Enemy.hitPlayer, Spinner's hammer, Puncher, Tentacle, BobSoldier,
 *   ShieldBoss, BossTotem, Flyer's drop, RockFall, Pod, SpinningAxe,
 *   Pulser's ring, Crusher, Explosion, Grenade, Arrow, TurretSpit,
 *   LavaBall, BossTotemShot                      → ALL call Player.hit
 *   Player.hit                                   → `!Game.freezeObjects`
 * ```
 *
 * ⇒ **A FROZEN PLAYER IS INVULNERABLE, with exactly one exception in the
 * whole game.** That is a far stronger statement than any per-class audit
 * would have produced, and it is why a totem-part collect beside a spinner
 * is a positional claim rather than a survival one.
 *
 * ⛔⛔ THE EXCEPTION IS `LavaTrap`, AND IT BYPASSES `Bot.noDamage` TOO.
 * `LavaTrap.as:72` is `attached.die()` — the Player's own `die()`, called
 * directly once the tongue has reeled a player without the dark suit all the
 * way in. `Player.die()` is `dying = true; restartLevel()` with no freeze
 * test and no `Bot.noDamage` test (the relaxation guards `hit()`'s body,
 * `Player.as:1379`). ⚠ So the ladder's "damage is off" relaxation is NOT
 * total, and the one class that escapes it is also the one class a ceremony
 * cannot protect against.
 *
 * ⛓ INERT FOR THIS RUNG, MEASURED: `lavatrap` appears only in L77, L78, L80
 * (Dungeon 7) and L108 (Dungeon 8), and R5's route reaches none of them. It
 * is declared rather than omitted because "no route goes there yet" is how
 * §24.3's statue got its offset wrong for two slices.
 */
export const PLAYER_DAMAGE_PATHS = Object.freeze({
    allThrough: 'Player.hit',
    gate: 'Player.as:1380 — `hitsTimer <= 0 && hits < hitsMax && !Game.freezeObjects`',
    frozenPlayerIsInvulnerable: true,
    exceptions: Object.freeze([Object.freeze({
        as3: 'LavaTrap',
        src: 'Enemies/LavaTrap.as:72 — `attached.die()`',
        bypassesFreeze: true,
        bypassesNoDamage: true,
        why: 'it calls `Player.die()` directly rather than `Player.hit()`, so neither '
            + '`Game.freezeObjects` nor `Bot.noDamage` is consulted. It only fires once '
            + 'the tongue has fully reeled in a player without `hasDarkSuit`.',
        levels: Object.freeze([77, 78, 80, 108]),
        onR5Route: false,
    })]),
});

/**
 * ⚖ THE VERBS THAT REPLACE HARD-AVOID.
 *
 * `hazardVolume` prices a crusher's plus of four lanes as HARD-AVOID, which
 * is right about the damage and wrong about the verb: it is the volume the
 * SOLUTION requires standing in. A route does not avoid a crusher, it
 * OPERATES one.
 */
export const CRUSHER_VERBS = Object.freeze({
    bait: Object.freeze({
        verb: 'bait',
        why: 'stand in a lane with a clear sight line and let it commit. Its speed is 1 '
            + 'px/tick and a walking player is faster, so the sidestep is free ONCE THE '
            + 'CHARGE IS COMMITTED — v is only re-derived at rest.',
        risk: 'the scan is LAST-MATCH-WINS over E,N,W,S, so a diagonal stance arms the '
            + 'later direction and a bait that assumed "east" gets charged from the south',
    }),
    park: Object.freeze({
        verb: 'park',
        why: 'a charge ends against the first Solid and STAYS there — no retraction, no '
            + 'timer. So a bait is also a placement: park it against a wall, against a '
            + 'pushable block, or in a doorway.',
        risk: 'it is a mobile SOLID (type "Solid", 32x32), so parking it can seal a '
            + 'corridor the route still needs — and it then SHIELDS itself, because the '
            + 'sight line is what arms it',
    }),
    weapon: Object.freeze({
        verb: 'weapon',
        why: '`hit()` deals 1000 to `Enemy` as well as to `Player`, so a crusher charged '
            + 'through an enemy kills it — for free, and without the encounter ladder',
        risk: 'it does not stop for an enemy either (`moveX` collides "Solid" only), so it '
            + 'passes through and keeps coming',
    }),
});
