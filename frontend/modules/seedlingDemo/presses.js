/**
 * seedlingDemo/presses — what an X press REACHES, and what answers it.
 *
 * Region-atlas Phase 8, subtractive ladder rung R4. Brief:
 * `CC/docs/plans/seedling-bot-r4-opus-kickoff.md` §3.2.
 *
 * Until R4 the ladder never pressed an attack key on purpose: R1-R3's
 * routes avoid every responder, and the one stray press `r3-collect-sword`
 * leaves after its ceremony was checked to have moved nothing. R4 presses
 * for REAL — the L63 bridge decrements only under a Spear — so "which
 * entities are in the rect" stops being a curiosity and becomes the audit
 * that decides whether a press is legal at all.
 *
 * ── WHY THE RECT IS THE WHOLE MECHANIC ────────────────────────────────
 *
 * `Player.slash()` and `Player.spear()` both do the same two steps:
 * `collideRectInto(type, ...)` for each of eleven `hitables` types, then a
 * loop calling `genericHit(entity, t, force, damage)` on everything
 * collected. `genericHit` dispatches BY CLASS, so one press can decrement a
 * bridge, break a rock, push a block, toggle a lightpole and hit three
 * enemies — and the ones nobody intended are exactly as real as the one
 * that was.
 *
 * ⚠ THE TWO WEAPONS ARE NOT THE SAME SHAPE, and the difference is the
 * reason R4's audit runs with the spear rect from the equip tick on:
 *
 *   SLASH  a 16x32 rect from the sprite frame, THEN two filters — a 16 px
 *          distance gate (`FP.distanceRectPoint(...) <= 16`) and a
 *          LINE-OF-SIGHT gate (`!collideLine("Solid", ...)`, waived for
 *          Solid/Rope/Flyer).
 *   SPEAR  a 32x5 rect and NO FILTERS AT ALL. Every entity the rect
 *          contains is hit, through walls, at twice the reach.
 *
 * So equipping the spear does not merely change what a press DOES, it
 * widens what a press TOUCHES — which is why §3.2's audit is a per-press
 * question rather than a per-room one.
 */

import { PRESS_ARMS, rectsOverlap } from './levelWorld.js';

export class PressError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PressError';
    }
}

/**
 * `Player.as:99` — the eleven types `collideRectInto` is called for.
 *
 * A TYPE, not a class: `collideRectInto` walks FlashPunk's per-type lists,
 * so "Solid" collects Tiles, BreakableRocks, PushableBlocks and scenery
 * alike, and `genericHit` sorts them out afterwards by class. Transcribed
 * whole because the audit's question is "what could this rect contain",
 * and a list pruned to the classes R4 expects would answer a narrower
 * question than the one being asked.
 */
export const HITABLE_TYPES = Object.freeze([
    'Enemy', 'Grass', 'Tree', 'Rock', 'Rope', 'ShieldBoss', 'Solid',
    'LightPole', 'LavaBall', 'LavaBoss', 'Watcher',
]);

/** `Player.as:114-146` — damage and reach. */
export const SWORD_DAMAGE = 1;
export const DARK_SWORD_DAMAGE = 2;
export const SPEAR_DAMAGE = 2;
/** `slashingSprite.width * scaleX` — the slash's post-rect distance gate. */
export const SLASH_REACH = 16;
/** `Player.as:947-948` — `const length:int = 32; const thick:int = 5;` */
export const SPEAR_LENGTH = 32;
export const SPEAR_THICK = 5;
/** `Enemy.as:22-24` — the default an unmodified enemy carries. */
export const ENEMY_HITS_MAX = 3;
/** `Enemy.as:24` — ticks before the same enemy can be hit again. */
export const ENEMY_HITS_TIMER = 30;
/** `Player.as:119` — the double-tap window that turns two presses into a DASH. */
export const SLASH_TIMER_MAX = 20;

/** Facing directions, as `Player.direction` numbers them. */
export const RIGHT = 0;
export const UP = 1;
export const LEFT = 2;
export const DOWN = 3;

const rect = (x, y, w, h) => ({ x, y, w, h, right: x + w, bottom: y + h });

/**
 * `Player.spear()`'s rect (`Player.as:944-968`), transcribed with its
 * offset chain intact.
 *
 * ⚠ THE ORIGIN IS NOT THE PLAYER POSITION. `spearX`/`spearY`
 * (`Player.as:1321-1327`) fold `spearOffset = (-1, 2)` through two
 * direction-parity expressions, so the rect's anchor moves by a pixel or
 * two per direction — and a model that used `(x, y)` directly would be
 * within a pixel of right, which is precisely the resolution at which
 * `l71`'s 5 px margins and L65's 8 px gap between a block and a lightpole
 * are decided.
 *
 *   dir 0  spearX = x        spearY = y + 1
 *   dir 1  spearX = x + 1    spearY = y + 2
 *   dir 2  spearX = x        spearY = y + 2
 *   dir 3  spearX = x - 1    spearY = y + 2
 */
export function spearOrigin(x, y, direction) {
    const parity = direction % 2;
    return {
        x: x + (-1) * parity * (direction - 2),
        y: y + 2 * parity + (1 - parity) + (direction === LEFT ? 1 : 0),
    };
}

/** The 32x5 thrust rect, by facing. */
export function spearRect(x, y, direction) {
    const { x: sx, y: sy } = spearOrigin(x, y, direction);
    const L = SPEAR_LENGTH;
    const T = SPEAR_THICK;
    switch (direction) {
        // ⚠ The four arms are NOT symmetric in the AS3: cases 0 and 1 carry
        // a `+ 1` that cases 2 and 3 do not (`- thick/2 + 1` against
        // `- thick/2`). Transcribed rather than regularised — the arc's
        // standing rule is that the tidier description is the wrong one.
        case RIGHT: return rect(sx, sy - T / 2 + 1, L, T);
        case UP: return rect(sx - T / 2 + 1, sy - L, T, L);
        case LEFT: return rect(sx - L, sy - T / 2, L, T);
        case DOWN: return rect(sx - T / 2, sy, T, L);
        default:
            throw new PressError(`spearRect: direction ${direction} is not 0..3`);
    }
}

/**
 * `Player.getSlashRect()` (`Player.as:911-932`), for a plain sword.
 *
 * `sprSlash` is a 16x32 Spritemap frame at scale 1, so `h` is 32 and the
 * rect is 16x32 ahead of the player (or 32x16 above/below it). The
 * ghost-sword arm doubles `h` from the frame WIDTH instead — R5, and left
 * out rather than guessed, because `hasGhostSword` also re-routes the whole
 * press through the Spear branch of `genericHit`.
 */
export function slashRect(x, y, direction) {
    const w = 16;
    const h = 32;
    switch (direction) {
        case RIGHT: return rect(x, y - h / 2, w, h);
        case UP: return rect(x - h / 2, y - w, h, w);
        case LEFT: return rect(x - w, y - h / 2, w, h);
        case DOWN: return rect(x - h / 2, y, h, w);
        default:
            throw new PressError(`slashRect: direction ${direction} is not 0..3`);
    }
}

/**
 * `FP.distanceRectPoint(px, py, rx, ry, rw, rh)` — the slash's second gate.
 *
 * Zero when the point is inside the rect; otherwise the Euclidean distance
 * to the nearest edge. Transcribed because the slash's reach is this and
 * not the rect: an entity in the corner of the 16x32 box can be 20 px away
 * and is NOT hit.
 */
export function distanceRectPoint(px, py, r) {
    const dx = px < r.x ? r.x - px : (px > r.right ? px - r.right : 0);
    const dy = py < r.y ? r.y - py : (py > r.bottom ? py - r.bottom : 0);
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * ── THE LEVEL QUERY: what this rect actually contains ─────────────────
 *
 * The half that was a stated GAP until the census grew `PRESS_ARMS`. The
 * reason it was a gap rather than a default is worth keeping: a
 * `LightPole` is `collider: 'none'` — `type = "LightPole"` is in no solids
 * list — so it appeared in NONE of `solids`, `activators`, `pressers`,
 * `pickups` or `proximityHazards`, and a rect query written against that
 * world would have reported "nothing else in the rect" for the exact
 * entity whose stray hit writes a persistence flag. A query that cannot
 * see a responder is worse than no query: it passes, and its passing reads
 * as "the press is clean".
 *
 * ⚠ IT REFUSES RATHER THAN ANSWERING EMPTILY. A world built without the
 * `blocking` role has no `type` and no hitboxes, so its `pressResponders`
 * is empty because nothing was ASKED, not because nothing responds. That
 * distinction is the whole reason this throws.
 */
export function pressRespondersIn(world, rect) {
    if (!world.roles?.includes('blocking')) {
        throw new PressError(`pressRespondersIn: level ${world.level} was built without `
            + `the "blocking" role (${(world.roles ?? []).join(', ') || 'none'}), so its `
            + 'press census is empty because nothing was asked. An audit over an '
            + 'unasked census would pass by construction.');
    }
    const hits = world.pressResponders.filter((r) => rectsOverlap(rect, r.rect));
    // A bridge is a press responder and it is TERRAIN — the one arm of
    // `genericHit` that dispatches on `Tile`. Merged here so a caller
    // asking "what does this thrust touch" gets one answer rather than two
    // lists it has to remember to consult.
    for (const tile of world.bridgeTiles) {
        if (!rectsOverlap(rect, tile.rect)) continue;
        hits.push({
            tag: `tile:${tile.name}`,
            as3: 'Tile',
            x: tile.x,
            y: tile.y,
            rect: tile.rect,
            tile: { tx: tile.tx, ty: tile.ty },
            arm: PRESS_ARMS.Tile.arm,
            cost: PRESS_ARMS.Tile.cost,
            src: PRESS_ARMS.Tile.src,
        });
    }
    return hits;
}

/**
 * §3.2's audit for ONE press, as a pure function over the census.
 *
 * `intended` names what the press is FOR — `{as3, x, y}` per responder, or
 * a bridge's `{as3: 'Tile', tx, ty}`. Everything else the rect contains is
 * an unintended responder, and the caller (leg synthesis) throws on a
 * non-empty `illegal`: a stray push is an irreversible route change, a
 * stray lightpole hit is a ledger entry, a stray bridge decrement is an
 * opening the run did not plan.
 *
 * ⚠ THE ENEMY HALF IS NOT A RECT QUESTION and is returned separately. A
 * chaser is wherever it is, not where it spawned, so the rule is
 * arithmetic over the whole walk (`pressWouldKill`): one spear press is 2
 * damage against `hitsMax` 3, so at most ONE press per enemy per walk, and
 * `hitsTimer` (30) means a second press inside thirty ticks is a no-op on
 * that enemy anyway. What this returns is the LEVEL's roster; the walk's
 * own press count is what the executor tracks against it.
 *
 * ⚠ The `LightPole` and `Tile` arms fire only under `t == "Spear"`, so a
 * SLASH press is audited against a smaller responder set — which is a
 * reason to prefer the sword where the geometry allows, not a reason to
 * skip the audit.
 */
export function auditPress(world, rect, { weapon, intended = [] } = {}) {
    const responders = pressRespondersIn(world, rect);
    const spearOnly = new Set(['LightPole', 'Tile']);
    const live = responders.filter(
        (r) => weapon === 'spear' || !spearOnly.has(r.as3),
    );
    const wanted = (r) => intended.some((i) => i.as3 === r.as3
        && (r.tile
            ? i.tx === r.tile.tx && i.ty === r.tile.ty
            : i.x === r.x && i.y === r.y));
    const illegal = live.filter((r) => !wanted(r));
    const missing = intended.filter(
        (i) => !live.some((r) => r.as3 === i.as3
            && (r.tile ? r.tile.tx === i.tx && r.tile.ty === i.ty
                : r.x === i.x && r.y === i.y)),
    );
    return { responders, live, illegal, missing, enemies: world.pressEnemies };
}

/**
 * ── THE PRESS AUDIT (§3.2, ruled 2026-08-02) ──────────────────────────
 *
 * The §3-era policy was "swing only in rooms whose census shows zero enemy
 * entities", which forbids the health chain outright (L63 has seven). The
 * ruled replacement is per-press, and slice 0 made it CHEAPER than the
 * brief assumed:
 *
 *   - **A death draws no RNG and spawns no `Coin`.** `dropCoins()` is
 *     commented out at every call site (`Bob`, `BobSoldier`, `Jellyfish`,
 *     `Drill`, `Spinner`). The only per-enemy draw is the constructor's
 *     `coins = 4 + Math.random()*4`, which fires at every level build
 *     regardless of what anyone presses.
 *   - **`Grenade.hit()` and `DarkTrap.hit()` are overridden EMPTY.**
 *     Neither can be damaged by any press at all.
 *   - **One spear press cannot kill a default enemy** (2 damage against
 *     `hitsMax` 3), and `hitsTimer` is 30 ticks, so a second press inside
 *     thirty is a no-op on that enemy.
 *
 * What a press still costs, and therefore what the audit forbids:
 *
 *   - a DEATH moves `totalEnemies()`, which opens `tSet == -1` locks — a
 *     blocker the walk did not earn;
 *   - a `LightPole` hit TOGGLES its group and `set activate` calls
 *     `Game.setPersistence(tag, !activate)` — a ledger entry;
 *   - a pushable moves ONE TILE in the player's FACING direction and a
 *     pushable resting on water/lava/pit destroys itself, so an unintended
 *     push is an irreversible route change;
 *   - a bridge decrement starts an opening the run did not plan.
 */
export const PRESS_COSTS = Object.freeze({
    death: 'moves totalEnemies(), which opens tSet == -1 locks',
    lightpole: 'toggles the group AND writes Game.setPersistence(tag, !activate)',
    pushable: 'slides one tile in the FACING direction; destroys itself on water/lava/pit',
    bridge: 'decrements bridgeOpeningTimer, starting a ~60-frame opening',
});

/**
 * Damage per press, by weapon (`Player.as:114-146`, via `genericHit`).
 *
 * ⚠ `hasDarkSword` upgrades the SLASH to 2 and the ladder has held the
 * dark sword since R2, so a sword press is not reliably 1 — which matters
 * because 2 and 2 kill a 3-HP enemy and 1 and 1 do not.
 */
export function pressDamage(weapon, inventory = {}) {
    if (weapon === 'spear') return SPEAR_DAMAGE;
    return inventory.hasDarkSword ? DARK_SWORD_DAMAGE : SWORD_DAMAGE;
}

/**
 * Would `presses` presses of `weapon` KILL an enemy with `hitsMax` HP?
 *
 * `Enemy.hit` accumulates `hits += d` and dies at `hits >= hitsMax`, with
 * `hitsTimer` (30) between accepted hits — so the count that matters is
 * presses that land at least 30 ticks apart.
 */
export function pressWouldKill(weapon, presses, inventory = {}, hitsMax = ENEMY_HITS_MAX) {
    return presses * pressDamage(weapon, inventory) >= hitsMax;
}
