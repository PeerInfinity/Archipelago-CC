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
import { fireHits } from './fireVerb.js';

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
/** `Scenery/LightPole.as:20` — ticks before the same pole can be toggled again. */
export const LIGHTPOLE_HITS_TIMER_MAX = 25;

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
export function pressRespondersIn(world, rect, { pushables: live = null } = {}) {
    if (!world.roles?.includes('blocking')) {
        throw new PressError(`pressRespondersIn: level ${world.level} was built without `
            + `the "blocking" role (${(world.roles ?? []).join(', ') || 'none'}), so its `
            + 'press census is empty because nothing was asked. An audit over an '
            + 'unasked census would pass by construction.');
    }
    const hits = [];
    for (const r of world.pressResponders) {
        // ⚠ A PUSHED BLOCK MOVED, and the census did not. Every other
        // responder's rect is a constant; this one is the run's state, and
        // asking the static census for it is how a three-push chain lands
        // its first push and silently no-ops the other two.
        if (live && r.pushableId && live.has(r.pushableId)) {
            const now = live.get(r.pushableId);
            if (now.removed) continue;
            if (rectsOverlap(rect, now.rect)) hits.push({ ...r, rect: now.rect, live: true });
            continue;
        }
        if (rectsOverlap(rect, r.rect)) hits.push(r);
    }
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
export function auditPress(world, rect, { weapon, intended = [], pushables = null } = {}) {
    const responders = pressRespondersIn(world, rect, { pushables });
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
/**
 * What this rung DOES with each arm `genericHit` can take — the policy the
 * executor enforces, one entry per `PRESS_ARMS` key.
 *
 *   `modelled`  the run tracks the effect (`levelRun`'s per-visit state)
 *   `inert`     the arm runs in the game and changes NOTHING the model or
 *               the observation stream can see — stated per class, from the
 *               class's own body, never as a default
 *   `refused`   real, unmodelled, and a synthesis-time throw
 *
 * ⚠ AN ENUMERATION OVER `PRESS_ARMS`, checked as one. "Everything else is
 * refused" would have been the safe-sounding rule and it is the wrong one:
 * `r3-collect-sword` presses X to page its own dialogue, the player is
 * holding the sword by then, and the rect reaches two TREES — so a blanket
 * refusal fails a COMMITTED recording over an arm whose body is empty.
 */
export const PRESS_ARM_POLICY = Object.freeze({
    Tile: { policy: 'modelled', why: 'the bridge timer — `bridges.js` and the run\'s openBridges' },
    PushableBlockSpear: { policy: 'modelled', why: 'the slide — `pushables.js` and the run\'s per-visit state' },
    Tree: { policy: 'inert', why: '`Tree.hit()` is an EMPTY BODY (Scenery/Tree.as)' },
    // ⛔⛔ R5 slice 11 — the three the census could not see, joined here so
    // this table and `PRESS_ARMS` still have identical keys (which is what
    // `presses.test.js` asserts, and is why the gap could not be papered
    // over on one side only). All three reach `genericHit` through an
    // ancestor's `e is <Class>` test and override the method it calls.
    BurnableTree: {
        policy: 'inert',
        why: '⛓ INERT FOR THE SWORD AND ONLY FOR THE SWORD. `BurnableTree.hit(t)` is '
            + 'gated on `t == "Fire"`, so a sword or spear press really is an empty '
            + 'body — but the parent entry above says that for EVERY `t`, and for this '
            + 'subclass a FIRE press burns it down. See `FIRE_ARM_POLICY.BurnableTree`; '
            + '[[feedback_inert_for_this_weapon]], with the arm inherited rather than '
            + 'shared.',
    },
    BombPusher: {
        policy: 'inert',
        why: '`override public function hit(f, p, d, t):void { }` — an EMPTY OVERRIDE, '
            + 'so no weapon damages, knocks back or spends an i-frame on one. It escaped '
            + '`pressEnemies` because its ctor overwrites `type` with "Solid".',
    },
    LavaBoss: { policy: 'refused', why: 'boss damage — R6/R7; declared so the census sees it' },
    Grass: {
        policy: 'inert',
        why: '`cut()` plays a sound, sets its own `cutGrass` and increments '
            + '`Main.grassCut` — a SharedObject counter with a medal at 10,000. No '
            + 'geometry, no persistence flag, and Grass is `type = "Grass"`, in no '
            + 'solids list.',
    },
    // ⚠ THIS TABLE IS THE SWORD'S AND THE SPEAR'S. `FIRE_ARM_POLICY` at the
    // bottom of this file is the third weapon's, and it disagrees here and
    // in three other places — which is the point of it being a second table
    // rather than a flag.
    PushableBlockFire: {
        policy: 'inert',
        why: 'the NON-relative arm, which is the one place `moveTypes` IS consulted '
            + '— `["Fire","Pulse"]` against a press\'s "Sword"/"Spear", so no SWORD '
            + 'press moves one. ⛓ A FIRE press does: see `FIRE_ARM_POLICY`, and '
            + '`r5Shaft` for the room that needs it.',
    },
    Enemy: { policy: 'refused', why: 'a death moves totalEnemies(), which opens tSet == -1 locks' },
    IceTurret: { policy: 'refused', why: 'the Enemy cost plus a bump; Dungeon 5, off route' },
    // ⚠ MODELLED FROM R5 SLICE 5, and it was the FEATHER that ruled it in.
    // L92's two `breakablerock`s are the only thing between L87's door and
    // L91's, L91 is the only way into L89's top, and L89's top is the only
    // side the feather can be reached from (`probe-seedling-r5-feather`:
    // 256 cells and the door with both broken; 14, 14 and 92 without). So
    // the arm stopped being avoidable, and `breakableRocks.js` is the
    // transcription: `hit(_t)` starts a 4-frame animation, `endAnim`
    // removes the entity AND writes `Game.setPersistence(tag, false)`, and
    // for L92's two `tag = -1` rocks that write lands in ANOTHER LEVEL.
    BreakableRock: {
        policy: 'modelled',
        why: '`hit(hasGhostSword ? 1 : 0)` breaks a rockType-0 rock with the PLAIN sword; '
            + 'it is Solid for the whole animation and `endAnim` then removes it and '
            + 'writes `setPersistence(tag, false)` — a ledger entry, and an out-of-band '
            + 'one for tag -1. Per VISIT: `check()` only rebuilds-away a rock with '
            + 'tag >= 0, so a -1 rock comes back with the next `new Game`. '
            + 'See `breakableRocks.js`.',
    },
    // ⚠ STILL REFUSED AT SLICE 5 STEP 2, and now for a stated reason
    // rather than for want of a route. `probe-seedling-r5-totem-shaft`
    // priced it: L39's rope is 112 px of WALL across the only shaft out of
    // the arrival corridor, a press needs no weapon type and no line of
    // sight (`Player.as:916,1093-1095`), and pulling it is the RIGHT
    // verdict — a declared clear would open a tile the game keeps, because
    // `hit()` shrinks the hitbox rather than removing the entity. What it
    // is not is USEFUL yet: the room behind it is closed by three
    // `WandLock`s whose only holders are `PushableBlockFire`s, and no
    // weapon this arc models moves one. So the arm stays refused until the
    // slice that can walk through it, rather than shipping a transcription
    // no fixture exercises. The verdict, the group-6 analysis and the
    // arithmetic are in `r5Totem.TOTEM_ROPE` / `GROUP_6`.
    // ⛓ BUILT AT R5 SLICE 7 — but under `FIRE_ARM_POLICY`, not here. The
    // arm takes no `t`, so either weapon pulls a rope; the route chose fire
    // because a SWORD press would consult the `blockedLine` oracle and then
    // waive it (`Player.as:916` exempts `type == "Rope"`), and that oracle
    // is one nothing else on this route needs. So the SWORD verdict stays
    // `refused` — accurately, since no fixture makes one.
    RopeStart: {
        policy: 'refused',
        why: 'SHRINKS to a one-cell solid and writes persistence, and its group publication '
            + 'arms a Pulser. Ruled an ARM rather than a clear at R5 slice 5 step 2 '
            + '(`r5Totem.TOTEM_ROPE`) and BUILT at slice 7 — for the FIRE press '
            + '(`FIRE_ARM_POLICY.RopeStart`, `r5Shaft.ROPE_PULL`). A sword press at one '
            + 'is still unmodelled and still refused.',
    },
    ShieldBoss: { policy: 'refused', why: 'boss damage — R5' },
    // ⚠ MODELLED FROM R4, and it was ruled in rather than assumed. It is the
    // only entry here whose arm has a real, banked effect that is not
    // geometry: `set activate` calls `Game.setPersistence(tag, !activate)`,
    // so a hit is a LEDGER ENTRY. It is modelled because L65's third push
    // cannot avoid one — the block at (10,7) and `lightpole@176,120` occupy
    // the same rows, so every rect that reaches the block spans the pole —
    // and the census prices the toggle at exactly that one flag: `tset -1`
    // (no group), L65 has no activators, the darktrap is 40 px outside the
    // light's 28 px reach, and `PERSISTENCE_RESPONSE.lightpole` is
    // 'cosmetic', so banking the clear changes no geometry on re-entry.
    // ⚠ It is a TOGGLE behind a 25-tick `hitsTimer`, not a latch.
    LightPole: {
        policy: 'modelled',
        why: '`hit()` toggles `activate` behind a 25-tick hitsTimer and `set activate` '
            + 'writes Game.setPersistence(tag, !activate) — a ledger entry, banked',
    },
    LavaBall: { policy: 'refused', why: 'R5 — Dungeon 7' },
    Watcher: { policy: 'refused', why: 'R6 — the ending' },
});

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

/**
 * ── ⛓ THE THIRD WEAPON'S AUDIT (R5 slice 7) ───────────────────────────
 *
 * `PRESS_ARM_POLICY` above answers "what does a press do to each arm", and
 * every one of its verdicts is a SWORD's or a SPEAR's. `Player.fire()`
 * dispatches the same `genericHit` with `t = "Fire"`, and four of the
 * answers change:
 *
 *   PushableBlockFire  ⛓ MODELLED — this is the whole point. `moveTypes`
 *                      is `["Fire","Pulse"]` and the non-relative arm
 *                      consults it, so fire is the ONE thing that moves one.
 *   RopeStart          ⛓ MODELLED — `hit()` takes no `t` at all, so fire
 *                      pulls a rope exactly as a sword does. Which means a
 *                      fire press near one is not a no-op, and the route
 *                      has to know.
 *   BreakableRock      ⛓ MODELLED — `hit(hasGhostSword ? 1 : 0)` likewise
 *                      ignores `t`. A fire press breaks rocks.
 *   Tile / LightPole   INERT — both arms are `if (t == "Spear")`, so fire
 *                      cannot decrement a bridge or toggle a pole. That is
 *                      the OPPOSITE of the sword's Tile verdict and it is
 *                      why this is a second table rather than a flag on the
 *                      first.
 *
 * ⚠ AND `PushableBlockSpear` FLIPS THE OTHER WAY. A `PushableBlockSpear`
 * reaches `Player.as:1118` — the `_relative` arm — before the `is
 * PushableBlockFire` test below it, and that arm RETURNS BEFORE the
 * `moveTypes` loop. So a spear block is pushed by the DIRECTION of the
 * press whatever `t` is... except that `spearDirection` is only written by
 * `set spearing`, and a fire press never sets it. Refused rather than
 * guessed: no route fires next to one, and a wrong sign here is an
 * irreversible push.
 */
export const FIRE_ARM_POLICY = Object.freeze({
    PushableBlockFire: {
        policy: 'modelled',
        why: '`hit(new Point(x, y), "Fire")` — the non-relative arm, `moveTypes` '
            + 'contains "Fire", and the destination is one whole tile away from the '
            + 'player by `Math.atan2`. See `pushables.hitPushableFromPoint`.',
    },
    RopeStart: {
        policy: 'modelled',
        why: '`(e as RopeStart).hit()` takes no `t`, so every weapon pulls a rope. '
            + 'See `ropes.js`.',
    },
    BreakableRock: {
        policy: 'modelled',
        why: '`(e as BreakableRock).hit(hasGhostSword ? 1 : 0)` takes no `t` either — '
            + 'a fire press breaks a rockType-0 rock. See `breakableRocks.js`.',
    },
    Tile: {
        policy: 'inert',
        why: '`if (t == "Spear") bridgeOpeningTimer--` — "Fire" is not "Spear", so a '
            + 'fire press over a bridge tile does NOTHING. The exact inverse of the '
            + 'sword table\'s entry, which is why the two are separate.',
    },
    LightPole: {
        policy: 'inert',
        why: '`if (t == "Spear") (e as LightPole).hit()` — same gate, same answer. A '
            + 'fire press cannot write a lightpole\'s persistence flag.',
    },
    Tree: { policy: 'inert', why: '`Tree.hit()` is an EMPTY BODY, for every `t`.' },
    BurnableTree: {
        policy: 'refused',
        why: '⛔⛔ THE SUBCLASS THAT MAKES THE LINE ABOVE A LIE. `BurnableTree extends '
            + 'Tree` and overrides `hit`: under `t == "Fire"` it plays a 20-frame '
            + 'animation whose wrap callback is `die()`, which removes a 2x2 SOLID and '
            + 'writes `setPersistence(tag, false)` from `removed()`. `genericHit` reaches '
            + 'it through `e is Tree`, so it has always been pressable; what it did not '
            + 'have was a table entry, and `PRESS_ARMS[cls.as3]` is how the census finds '
            + 'one — so it was in NO list and `auditFire` beside L40\'s tree returned an '
            + 'empty census. REFUSED rather than modelled because the burn is a '
            + 'per-visit geometry change with no family yet (it would be the EIGHTH), '
            + 'and a route that needs it must build one first. The tick cost is already '
            + 'derived: `bobBoss.BURNABLE_TREE.burnTicks` is 41, because 15 * 0.0333 is '
            + '0.4995 and not 0.5.',
    },
    Grass: {
        policy: 'inert',
        why: '`cut(t)` increments `Main.grassCut` and nothing the stream can see, for '
            + 'every `t`.',
    },
    PushableBlockSpear: {
        policy: 'refused',
        why: 'it matches `e is PushableBlockSpear` FIRST and takes the `_relative` arm, '
            + 'which is directed by `spearDirection` — a field only `set spearing` '
            + 'writes, and a fire press never does. Rather than guess what a stale '
            + 'direction pushes, this rung refuses to fire beside one.',
    },
    Enemy: {
        policy: 'refused',
        why: 'ZERO damage and ZERO i-frames, but 55 knockback impulses per press '
            + '(`fireVerb.FIRE_ON_ENEMY`) — a DISPLACE, which is a route verdict rather '
            + 'than a press effect and is priced by the encounter ladder. Refused here '
            + 'so an accidental one cannot happen silently.',
    },
    IceTurret: {
        policy: 'refused',
        why: '`IceTurret.bump` is gated on `t == "Fire" || t == "Pulse"` — so unlike '
            + 'every other enemy it takes a SECOND, class-specific arm from a fire '
            + 'press. Dungeon 5 and L40; refused until a route needs it.',
    },
    BombPusher: {
        policy: 'inert',
        why: '⛓ AND IT IS AN EMPTY OVERRIDE, not an absence. `BombPusher.hit(f, p, d, t)` '
            + 'has an empty body, so a fire press beside one costs nothing and does '
            + 'nothing — unlike every other enemy, which takes 55 knockback impulses '
            + '(`FIRE_ON_ENEMY`). It reaches the `e is Enemy` arm and is NOT in '
            + '`pressEnemies`, because its ctor overwrites `type` with "Solid". Declared '
            + 'so a route cannot price a kill that cannot happen; L40 has one.',
    },
    LavaBoss: { policy: 'refused', why: 'boss damage — R6/R7; declared so the census sees it' },
    ShieldBoss: { policy: 'refused', why: 'boss damage — R6' },
    LavaBall: { policy: 'refused', why: 'R5 — Dungeon 7' },
    Watcher: { policy: 'refused', why: 'R6 — the ending' },
});

/**
 * What a fire press at `(px, py)` REACHES, with both of `fire()`'s filters.
 *
 * ⚠ NOT `pressRespondersIn`. That one tests `rectsOverlap`, which is
 * STRICT; `Entity.collideRect` is inclusive on all four edges, and the
 * radius cut afterwards is `FP.distanceRects(...) > sprFire.width / 2` with
 * the player's own `originY` substituted for the target's. Both live in
 * `fireVerb`, and this is the join between them and the census.
 *
 * ⚠ THE BRIDGE TILES ARE DELIBERATELY NOT MERGED IN. `pressRespondersIn`
 * appends them because a sword press's `Tile` arm is real; fire's is
 * `if (t == "Spear")`, so a bridge tile in the rect is not a responder at
 * all. Including it and then filtering would make the audit's `live` list
 * disagree with what the game dispatches.
 */
export function fireRespondersIn(world, player, { pushables: live = null } = {}) {
    if (!world.roles?.includes('blocking')) {
        throw new PressError(`fireRespondersIn: level ${world.level} was built without `
            + `the "blocking" role (${(world.roles ?? []).join(', ') || 'none'}), so its `
            + 'press census is empty because nothing was asked.');
    }
    const targets = [];
    for (const r of world.pressResponders) {
        let rect = r.rect;
        if (live && r.pushableId && live.has(r.pushableId)) {
            const now = live.get(r.pushableId);
            if (now.removed) continue;
            rect = now.rect;
        }
        targets.push({
            ...r,
            rect,
            // `fireHits` wants the raw entity fields, because which origin
            // gets subtracted from which coordinate is the whole finding.
            x: rect.x + (r.originX ?? 0),
            y: rect.y + (r.originY ?? 0),
            originX: r.originX ?? 0,
            originY: r.originY ?? 0,
            // ⚠ FROM THE EDGES, not from `rect.w`. A `RopeStart`'s width is
            // `_xend - _x + 16` — computed from its last `<node>` — and the
            // census's rect carries `right` without a `w`. `fireHits`
            // refuses a non-finite dimension by name, which is how this was
            // found rather than silently measured as a zero-width rope.
            w: rect.right - rect.x,
            h: rect.bottom - rect.y,
            id: `${r.tag}@${r.x},${r.y}`,
            // Every press responder in the census is in `hitables` — the
            // fire rect's candidate list is by TYPE, and `fireHits` refuses
            // a type it does not know rather than skipping it silently.
            type: FIRE_HITABLE_TYPE_BY_ARM[r.as3] ?? 'Solid',
        });
    }
    const hits = fireHits(player, targets);
    return hits.map((h) => ({ ...targets.find((t) => t.id === h.id), ...h }));
}

/**
 * The `hitables` type each fire-reachable class collides as.
 *
 * It matters because the DISPATCH COUNT is `11 - i` for `hitables[i]` — a
 * `"Solid"` is hit five times per tick and an `"Enemy"` eleven — and the
 * count is what the knockback arithmetic multiplies.
 */
export const FIRE_HITABLE_TYPE_BY_ARM = Object.freeze({
    PushableBlockFire: 'Solid',
    PushableBlockSpear: 'Solid',
    RopeStart: 'Rope',
    BreakableRock: 'Rock',
    Tree: 'Tree',
    // ⚠ A `BurnableTree`'s `type` is "Solid", NOT "Tree", and its own ctor
    // comment says why: *"NOT a tree. Done so it doesn't loop with the
    // other trees."* So it is hit FIVE times per tick, like every other
    // Solid, and not however many a "Tree" gets — a difference that only
    // matters once something counts the dispatches, and is transcribed now
    // rather than when it does.
    BurnableTree: 'Solid',
    // ⚠ Both are `Enemy` SUBCLASSES whose ctor rewrote `type`, which is how
    // they escaped `pressEnemies`. The dispatch count follows the type the
    // ctor left behind, not the class's ancestry.
    BombPusher: 'Solid',
    LavaBoss: 'LavaBoss',
    Grass: 'Grass',
    LightPole: 'LightPole',
});

/**
 * `auditPress` for the fire weapon: everything the rect reaches, split by
 * what this rung does with it.
 */
export function auditFire(world, player, { pushables = null } = {}) {
    const live = fireRespondersIn(world, player, { pushables });
    const verdict = (r) => FIRE_ARM_POLICY[r.as3];
    const refused = live.filter((r) => (verdict(r)?.policy ?? 'refused') === 'refused');
    const modelled = live.filter((r) => verdict(r)?.policy === 'modelled');
    const inert = live.filter((r) => verdict(r)?.policy === 'inert');
    return { live, modelled, inert, refused, enemies: world.pressEnemies };
}
