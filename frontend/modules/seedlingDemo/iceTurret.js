/**
 * `iceTurret.js` — THE CORPSE, AND THE PUSH THAT IS A PROPERTY OF THE TICK.
 *
 * Region-atlas Phase 8, subtractive ladder rung R5, slice 20 step 1. The
 * TENTH per-visit geometry family, and the second that moves without the
 * player touching it — but for the opposite reason from a `Crusher`: a
 * crusher moves because it can SEE the player, a corpse moves because it
 * was SHOVED, and then keeps moving for 32 ticks on its own.
 *
 * Brief: `NewDocs/plans/seedling-bot-r5-opus-kickoff.md` §33.5 and §33.8
 * item 1 — "the build needs the two-cycle reproduced exactly, and
 * `fire.bumps` needs to be able to say WHICH TICK it fires on". Source:
 * `Enemies/IceTurret.as`, `Enemies/Enemy.as`, `Mobile.as`, `Player.as`'s
 * `genericHit`, all read at first hand. Measurement it replaces:
 * `r5Totem.L40_CORPSE`, which was a stepped loop in a probe and is asserted
 * against this module now.
 *
 * ── ⛔⛔⛔ FIVE THINGS THE LADDER'S STORIES GOT WRONG ─────────────────
 *
 * 1. **AN ALIVE TURRET IS NOT A SOLID.** `type = "Solid"` is the ELSE-ARM
 *    OF `if (sprIceTurret.currentAnim != "dead")`, not of the attack-range
 *    test — so it fires only for a CORPSE, and only on a tick the player's
 *    box does not overlap it. `levelWorld`'s `ENTITY_CLASSES.iceturret`
 *    priced it as an unconditional 32x32 solid on the other reading; that
 *    is corrected at the same commit as this file, and it is worth +16
 *    lattice cells in every L40 flood.
 *
 * 2. **AND THE FLIP IS A LATCH.** Nothing ever writes `type` back to
 *    "Enemy". The corpse becomes Solid the first tick the player is off it
 *    and stays Solid for the rest of the visit.
 *
 * 3. **THE REST POSITION IS A TWO-CYCLE** (§33.5). `input()` derives `cTile`
 *    with `Math.round(x / Tile.w)` and snaps a stationary axis with
 *    `Math.floor(x / Tile.w) * Tile.w + Tile.w/2`. At a tile CENTRE those
 *    disagree, so a standing body oscillates half a pixel for ever — and
 *    `bump` reads the same `round`, so WHICH PUSHES MOVE IT IS A PROPERTY
 *    OF THE TICK.
 *
 * 4. **THE MOTION IS FREEZE-GATED, ONE LEVEL DOWN** (§33.5, correcting
 *    §32.6 item 5). `IceTurret.update()`'s `super.update()` sits above its
 *    own `freezeObjects` return, but it is `Enemy.update()`, whose
 *    `super.update()` is `Mobile.mobileUpdate()` — and THAT wraps
 *    `friction(); input(); moveX(); moveY();` in `if (!Game.freezeObjects)`.
 *    A glide PAUSES for a ceremony.
 *
 * 5. ⛔⛔ **AND THE HAZARD-TILE DEATH IS NOT MID-GLIDE ONLY.** §32.6 item 2
 *    is right about `input()`'s own check (it tests tile CORNERS and a
 *    parked body sits on a CENTRE), but it is not the only path:
 *    `Enemy.update()`'s `getState()` switch is unconditional, above every
 *    gate, and kills a corpse standing on water or lava at rest. The brief's
 *    "price paths, not rest cells" is half the rule — price BOTH.
 *
 * ── ⛔⛔ AND ONE MORE THE PROBE COULD NOT SEE ─────────────────────────
 *
 * `Enemy.update()`'s FIRST line is `if (!activeOffScreen && !onScreen())
 * return`, and `IceTurret` does not set `activeOffScreen`. ⇒ **THE GLIDE IS
 * CAMERA-GATED**: a corpse off screen does not move, does not check its
 * terrain and does not die. Everything below `super.update()` in
 * `IceTurret.update()` — the type latch and the layer — still runs. A
 * 32-tick glide is a 32-tick commitment to keeping the body on screen.
 */

import { rect } from './levelWorld.js';

export class IceTurretError extends Error {
    constructor(message) { super(message); this.name = 'IceTurretError'; }
}
const fail = (m) => { throw new IceTurretError(m); };

/** `FP.sign` — `value < 0 ? -1 : (value > 0 ? 1 : 0)` (`FP.as:142-145`). */
const fpSign = (n) => (n < 0 ? -1 : (n > 0 ? 1 : 0));

const TILE = 16;

/**
 * The constructor's numbers, verbatim. Every one is `private const` or a
 * literal in `Enemies/IceTurret.as`, so an `.oel` decides only position —
 * there is no `tset`, no `tag` and no attribute of any kind on the
 * placement (`Game.as:2137` passes `o.@x, o.@y` and nothing else).
 */
export const ICE_TURRET = Object.freeze({
    /**
     * ⛔ `super(_x + Tile.w, _y + Tile.h)` — a WHOLE tile, not the half every
     * other family's ctor adds. ⛔⛔ SO THE PLACEMENT'S OWN SUB-TILE OFFSET
     * SURVIVES, and L40's `iceturret@472,400` is not on the grid: 472 is
     * 29.5 tiles, so the entity sits at a half-tile in x and a tile CORNER
     * in y. That asymmetry is why the two axes of the rest cycle read
     * differently, and it is a property of the .oel rather than of the class.
     */
    ctor: Object.freeze({ dx: TILE, dy: TILE }),
    /** `setHitbox(32, 32, 16, 16)` — the box is [oel.x, +32) x [oel.y, +32). */
    alive: Object.freeze({ w: 32, h: 32, originX: 16, originY: 16 }),
    /** `death()`'s `setHitbox(16, 16, 8, 8)` — centred on the entity point. */
    corpse: Object.freeze({ w: 16, h: 16, originX: 8, originY: 8 }),
    moveSpeed: 0.5,
    hitsMax: 3,
    hitsTimerMax: 30,
    attackRange: 128,
    shootTimerMax: 25,
    blastsPerVolley: 3,
    shotSpeed: 6,
    distBtwnShots: 12,
    /** `bothRange` — how far from a diagonal both axes still fire. */
    bothRange: 0.1,
    /** `bump` is gated on these two attack types and on the "dead" anim. */
    pushedBy: Object.freeze(['Fire', 'Pulse']),
    /**
     * ⛔ AND FIRE CANNOT KILL IT. `Enemy.hit`'s damage arm is
     * `if (hitByFire || t != "Fire")`, `hitByFire` defaults false and
     * `IceTurret` never sets it — so a fire press falls to the else and
     * calls `knockback`, which `IceTurret` overrides EMPTY. Fire MOVES a
     * corpse and does nothing at all to a live turret.
     */
    hitByFire: false,
    /** `knockback` is an empty override: undisplaceable while alive. */
    knockback: 'empty override — `IceTurret.as:110-113`',
    /** `Mobile.solids`, plus what `death()` pushes. */
    solids: Object.freeze(['Solid', 'Tree', 'Rock', 'Rope', 'ShieldBoss']),
    corpseSolids: Object.freeze(['Solid', 'Tree', 'Rock', 'Rope', 'ShieldBoss', 'Enemy', 'Player']),
    /**
     * ⛔⛔ NOT SET, AND THAT IS THE CONSTRAINT. `Enemy.update`'s first line
     * returns when `!activeOffScreen && !onScreen()`, so a corpse only
     * glides, only checks its terrain and only dies while the camera has it.
     */
    activeOffScreen: false,
    /** Tile `t` values `input()` and `Enemy.update` both treat as fatal. */
    fatalTiles: Object.freeze({ water: 1, pit: 6, lava: 17 }),
    src: 'Enemies/IceTurret.as:30-51 (ctor), :53-95 (update), :135-150 (death), '
        + ':169-201 (bump), :203-240 (input); Enemies/Enemy.as:61-113,141-181; '
        + 'Mobile.as:17,31-45,84-115',
});

/**
 * ⛓⛓⛓ THE STATE, AND WHY `tile` IS NOT DERIVED.
 *
 * `tile` is the TARGET the body glides to and it is the only field a bump
 * writes. `cTile` is where the body thinks it is, recomputed every tick
 * with `Math.round`. The glide runs while they differ. A model that derived
 * `tile` from the position would have no push at all.
 *
 * ⚠ THE CTOR ALIASES THEM (`cTile = tile` is a reference assignment on a
 * `Point`), which is invisible because the first `input()` rebinds `cTile`
 * to a fresh Point before anything writes through either. Transcribed as
 * copies, which is what the game does from tick 1 onward.
 */
export function createIceTurret(x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
        fail(`createIceTurret: (${x},${y}) must be the OEL integer placement`);
    }
    const ex = x + ICE_TURRET.ctor.dx;
    const ey = y + ICE_TURRET.ctor.dy;
    return {
        id: `iceturret@${x},${y}`,
        /** The OEL placement, for the id join with `world.solids`. */
        oel: { x, y },
        x: ex,
        y: ey,
        v: { x: 0, y: 0 },
        tile: { x: Math.floor(ex / TILE), y: Math.floor(ey / TILE) },
        cTile: { x: Math.floor(ex / TILE), y: Math.floor(ey / TILE) },
        lTile: { x: Math.floor(ex / TILE), y: Math.floor(ey / TILE) },
        hits: 0,
        hitsTimer: 0,
        /** `sprIceTurret.currentAnim == "dead"` — the corpse predicate. */
        dead: false,
        /** `type == "Solid"` — a LATCH, set once the player steps off. */
        solid: false,
        /** `Mobile.destroy`, and `fell` once a pit descent completes. */
        destroy: false,
        fallInPit: false,
        removed: false,
        /** Bookkeeping the plan reads: how many ticks of glide are owed. */
        ticks: 0,
        /** The two previous positions — `iceTurretSettled`'s whole mechanism. */
        prev1: null,
        prev2: null,
        settled: false,
    };
}

/** The box the body occupies right now — 32x32 alive, 16x16 dead. */
export function iceTurretRect(state) {
    const b = state.dead ? ICE_TURRET.corpse : ICE_TURRET.alive;
    return rect(state.x - b.originX, state.y - b.originY, b.w, b.h);
}

/** The snap `input()` puts a stationary axis on: `floor(v/16)*16 + 8`. */
const snapOf = (v) => Math.floor(v / TILE) * TILE + TILE / 2;

/**
 * ⛓⛓⛓ WHICH PHASE OF THE REST CYCLE EACH AXIS IS IN — 0 or 1.
 *
 * Phase 0 is the tick the axis sits ON its own snap centre; phase 1 is the
 * tick it sits half a pixel BELOW it, because `input()` set `v` from a
 * `round` that disagreed with the `floor` the snap uses and then moved.
 *
 * ⛔ AND THE RULE FALLS OUT OF IT: **a phase-0 axis moves POSITIVE and a
 * phase-1 axis moves NEGATIVE**, 16 px in 32 ticks; the other direction
 * travels half a pixel and is back in two. So the pair a press can move is
 * `{x: phase.x ? 'W' : 'E', y: phase.y ? 'N' : 'S'}`, and the two axes of a
 * parked body are in OPPOSITE phases (each snap moves the other axis's
 * reading), which is why the pairs read as "N and E" then "S and W".
 *
 * ⚠ IT IS PER AXIS, deliberately. Nothing makes the two axes' phases a
 * single number; they are opposite for a body parked on a tile corner and
 * this reports both so a plan reads the axis it is pushing along.
 */
export function iceTurretPhase(state) {
    return {
        x: state.x === snapOf(state.x) ? 0 : 1,
        y: state.y === snapOf(state.y) ? 0 : 1,
    };
}

/**
 * ⛔⛔ IS THE BODY DONE GLIDING? — AND THE TWO OBVIOUS PREDICATES BOTH LIE.
 *
 * `tile == cTile` is what `input()` tests to zero `v`, and it is FALSE half
 * the time AT REST: `cTile` is `Math.round`, the two-cycle straddles the
 * rounding boundary, so a parked body reports `cTile.y` 25 and 26 on
 * alternate ticks against a `tile.y` of 25. A settle counter built on it
 * runs for ever — the corpse probe hit this and named it ("a joint 'both
 * axes arrived' test never fires").
 *
 * ⛔ AND "the floor tile equals the target" fires ELEVEN TICKS EARLY: the
 * body enters the target tile at its far edge and keeps travelling to the
 * centre, so a leg that stopped waiting there would flood against a corpse
 * still 8 px from where it ends up.
 *
 * ⛓ What is exact is the CYCLE ITSELF: a moving body is never where it was
 * two ticks ago, and a parked one always is. `stepIceTurret` keeps the two
 * previous positions for this and nothing else.
 */
export function iceTurretSettled(state) {
    return state.settled === true;
}

/** The two compass directions a bump can actually move the body right now. */
export function iceTurretMovableDirections(state) {
    const p = iceTurretPhase(state);
    return Object.freeze([p.x ? 'W' : 'E', p.y ? 'N' : 'S']);
}

/**
 * `Enemy.hit` for the types that can actually damage it, and `death()`'s
 * FIRST stage.
 *
 * ⛔ `death()` INTERCEPTS the removal: the hitbox shrinks to 16x16, the
 * "dead" anim plays, `destroy` goes BACK to false and `solids` gains
 * Enemy/Player. So a killed turret is still `classCount(IceTurret)` — a
 * kill lock in its room stays shut — and it writes NO persistence: there is
 * no `removed()`, no `setPersistence` and no tag anywhere in the class.
 */
export function killIceTurret(state) {
    if (state.dead) return state;
    state.hits = ICE_TURRET.hitsMax;
    state.dead = true;
    state.destroy = false;
    return state;
}

/**
 * `IceTurret.bump(p, t)` — `Player.genericHit` calls it with the PLAYER's
 * entity point and the ATTACK TYPE, BEFORE `Enemy.hit`, on every dispatch.
 *
 * ⛔ THE PUSH IS AWAY FROM THE PRESS POINT and it moves BOTH AXES when the
 * angle is within `bothRange` of a diagonal, so a press is one tile per
 * AXIS rather than one tile. The target is `Math.round(x / Tile.w)`, which
 * is what makes the direction a property of the tick.
 *
 * @returns {{applied: boolean, why?: string, deg?: number, tile?: object}}
 */
export function bumpIceTurret(state, press, type) {
    if (!press || !Number.isFinite(press.x) || !Number.isFinite(press.y)) {
        fail('bumpIceTurret: the press point is `new Point(player.x, player.y)` — the '
            + 'ENTITY position, not the hitbox corner and not a tile');
    }
    if (!state.dead) {
        return { applied: false, why: 'alive — `bump` is gated on the "dead" anim, and '
            + '`knockback` is an empty override, so a live turret is undisplaceable' };
    }
    if (!ICE_TURRET.pushedBy.includes(type)) {
        return { applied: false, why: `"${type}" is not in [${ICE_TURRET.pushedBy.join(', ')}] `
            + '— a sword or spear press reaches `bump` and does nothing' };
    }
    const tT = { x: Math.round(state.x / TILE), y: Math.round(state.y / TILE) };
    // ⛓ With the CORPSE hitbox, `x - originX + width/2` is `x - 8 + 8` = x,
    // so the angle is `atan2(p.y - y, p.x - x)` in screen coordinates — and
    // `sin(a) > 0` means the press point is BELOW, which targets NORTH.
    const a = Math.atan2(-(state.y - ICE_TURRET.corpse.originY + ICE_TURRET.corpse.h / 2)
        + press.y, press.x - (state.x - ICE_TURRET.corpse.originX + ICE_TURRET.corpse.w / 2));
    const s = Math.abs(Math.sin(a));
    const c = Math.abs(Math.cos(a));
    if (s - ICE_TURRET.bothRange < c) state.tile.x = Math.cos(a) > 0 ? tT.x - 1 : tT.x + 1;
    if (s > c - ICE_TURRET.bothRange) state.tile.y = Math.sin(a) > 0 ? tT.y - 1 : tT.y + 1;
    return { applied: true, deg: (a * 180) / Math.PI, tile: { ...state.tile }, tT };
}

/**
 * `IceTurret.input()`, verbatim and in order. The ORDERING is the finding:
 * the stationary-axis snap happens BEFORE the move, so a "settled" body is
 * not at a fixed point.
 *
 * @param {object} state
 * @param {?function} terrainAt `(x, y) => t` — `Enemy.getState()`'s tile
 *   value at a point, or null to skip the check (which is what a probe
 *   about the arithmetic wants and what a ROUTE must never do).
 */
function iceTurretInput(state, terrainAt) {
    state.lTile = { ...state.cTile };
    state.cTile = { x: Math.round(state.x / TILE), y: Math.round(state.y / TILE) };
    // ⛓ `input()`'s OWN self-destruct check, and §32.6 item 2 is right about
    // it: it tests tile CORNERS while the snap below puts a parked body on a
    // CENTRE, 8 px away, so only a body crossing a boundary ever runs it.
    // ⛔ It is NOT the only fatal-terrain path — see `stepIceTurret`.
    if (terrainAt && state.x === state.cTile.x * TILE && state.y === state.cTile.y * TILE) {
        const t = terrainAt(state.x, state.y);
        if (t === ICE_TURRET.fatalTiles.water || t === ICE_TURRET.fatalTiles.lava
            || t === ICE_TURRET.fatalTiles.pit) {
            state.destroy = true;
        }
    }
    state.v.x = ICE_TURRET.moveSpeed * fpSign(state.tile.x - state.cTile.x);
    if (state.v.x === 0) state.x = Math.floor(state.x / TILE) * TILE + TILE / 2;
    state.v.y = ICE_TURRET.moveSpeed * fpSign(state.tile.y - state.cTile.y);
    if (state.v.y === 0) state.y = Math.floor(state.y / TILE) * TILE + TILE / 2;
}

/**
 * `Mobile.moveX`/`moveY` — 1 px sub-steps, stopping at the first solid.
 * With `moveSpeed 0.5` there is exactly one sub-step per axis per tick, but
 * the loop is transcribed rather than collapsed because the constant is the
 * class's and a `Pulse` is free to change it.
 */
function moveAxis(state, axis, rel, blockedAt) {
    const n = Math.abs(rel);
    for (let i = 0; i < n; i += 1) {
        const step = Math.min(1, n - i) * fpSign(rel);
        const nx = axis === 'x' ? state.x + step : state.x;
        const ny = axis === 'y' ? state.y + step : state.y;
        if (blockedAt && blockedAt(nx, ny)) return true;
        state[axis] += step;
    }
    return false;
}

/**
 * ONE GAME TICK of `IceTurret.update()`, in the game's own order.
 *
 * ⛔⛔ THE FOUR GATES, AND THEY ARE FOUR DIFFERENT GATES:
 *
 *   · `onScreen`  — `Enemy.update`'s first line. Off screen, NOTHING below
 *                   it runs: no terrain check, no glide, no death.
 *   · terrain     — `Enemy.getState()`, ABOVE every freeze test, so a corpse
 *                   on lava dies during a ceremony. At rest, too.
 *   · `frozen`    — `Mobile.mobileUpdate`'s `if (!Game.freezeObjects)`, which
 *                   wraps friction/input/moveX/moveY and nothing else.
 *   · the latch   — `IceTurret.update`'s own tail, BELOW its
 *                   `if (Game.freezeObjects) return`, so the Solid flip does
 *                   not happen during a ceremony either.
 *
 * @param {object} state
 * @param {object} ctx
 * @param {boolean} ctx.frozen     `Game.freezeObjects`
 * @param {boolean} ctx.onScreen   `Entity.onScreen()` for this body
 * @param {?function} ctx.blockedAt `(x, y) => boolean` — would the body's box
 *   at (x, y) hit one of its own `solids`? The corpse's list includes
 *   "Player", so the PLAYER blocks the glide.
 * @param {?function} ctx.terrainAt `(x, y) => t`
 * @param {?function} ctx.playerOverlaps `(rect) => boolean` — `collide("Player",
 *   x, y)`, which decides the Solid latch.
 */
export function stepIceTurret(state, ctx = {}) {
    const {
        frozen = false, onScreen = true,
        blockedAt = null, terrainAt = null, playerOverlaps = null,
    } = ctx;
    if (state.removed) return state;
    state.ticks += 1;

    // ── Enemy.update() ────────────────────────────────────────────────
    if (ICE_TURRET.activeOffScreen || onScreen) {
        // ⛔ THE TERRAIN SWITCH, ABOVE EVERY FREEZE GATE — and it does NOT
        // need the body to be mid-glide. `dieInWater` is `hits >= hitsMax`,
        // set at the top of `IceTurret.update` before `super.update()`, so
        // it is true for a corpse and false for a live turret.
        if (terrainAt) {
            const t = terrainAt(state.x, state.y);
            if (t === ICE_TURRET.fatalTiles.water && state.dead) state.destroy = true;
            else if (t === ICE_TURRET.fatalTiles.lava) state.destroy = true;
            else if (t === ICE_TURRET.fatalTiles.pit && !state.fallInPit) state.fallInPit = true;
        }
        if (!state.destroy && state.fallInPit) {
            // The descent: `Enemy.update`'s own block, which REPLACES the
            // Mobile update — a body falling into a pit does not glide.
            state.x += (Math.floor(state.x / TILE) * TILE + TILE / 2 - state.x) / 10;
            state.y += (Math.floor(state.y / TILE) * TILE + TILE / 2 - state.y) / 10;
            state.pitAlpha = (state.pitAlpha ?? 1) - 0.05;
            if (state.pitAlpha <= 0) { state.destroy = true; state.fell = true; }
        } else {
            // Mobile.mobileUpdate()
            if (!state.destroy && !frozen) {
                iceTurretInput(state, terrainAt);
                moveAxis(state, 'x', state.v.x, blockedAt);
                moveAxis(state, 'y', state.v.y, blockedAt);
            }
            // Mobile.death() — for a corpse, `IceTurret.death()` has already
            // intercepted, so the second call is what actually removes it.
            if (state.destroy) state.removed = true;
        }
    }

    // ⛓ The two-cycle detector — see `iceTurretSettled`. Updated for every
    // tick the body's update ran, frozen or not: a frozen body does not move,
    // and "did not move" is exactly what this measures.
    state.settled = state.prev2 !== null
        && state.x === state.prev2.x && state.y === state.prev2.y;
    state.prev2 = state.prev1;
    state.prev1 = { x: state.x, y: state.y };

    // ── IceTurret.update()'s own tail, below its freeze return ────────
    if (frozen || state.removed) return state;
    if (state.dead && !state.solid) {
        // `else if (!collide("Player", x, y)) type = "Solid"` — a LATCH.
        const overlaps = playerOverlaps ? playerOverlaps(iceTurretRect(state)) : false;
        if (!overlaps) state.solid = true;
    }
    return state;
}

/**
 * ⛓⛓⛓ THE PLAN'S DOCTRINE, so a leg cannot be written against half of it.
 *
 * A `fire.bumps` press is FIVE bumps, not one — `FIRE_WINDOW.hitTicks` is
 * `[4,5,6,7,8]` and `Player.genericHit` calls `bump` on every dispatch of
 * every hit tick. The corpse's own update runs BEFORE the player's each
 * tick (the loader adds `iceturret` after the Player and `addUpdate`
 * PREPENDS), so bump `k` is seen by the glide on tick `k+1`, and bumps
 * 2..5 re-target a body that is already moving.
 *
 * ⛓⛓⛓ **AND THAT IS WHY THE PARITY IS NOT LOAD-BEARING.** §33.5 read the
 * single-bump table — "phase 0 moves N and E; phase 1 moves S and W" — and
 * concluded that a fire press's tick parity is load-bearing and that no
 * press verb in this driver could express it. Measured against the five-bump
 * press (`probe-seedling-r5-l40-bumps.mjs`), all four cardinal pushes move a
 * tile from BOTH parities: whichever phase bump 1 lands on, bump 2 lands on
 * the other, and the refused direction — which travels half a pixel and is
 * back in two ticks — is re-targeted before it can settle.
 *
 * ⇒ **`fire.bumps` NEEDS NO PARITY ARGUMENT.** What survives the correction
 * is a ±1 px difference in the net and a ±0.5 px drift on the cross axis, so
 * the RESTING POSITION still differs by parity — a thing an assertion has to
 * allow for, not a thing a plan has to steer. The verb's argument is the
 * STANCE and the COUNT.
 */
export const ICE_TURRET_PLAN = Object.freeze({
    verb: 'fire.bumps',
    argument: 'the stance and the COUNT — one press is one tile per axis, from either '
        + 'parity',
    /** ⛔ §33.5's headline, and it does not survive the five-bump press. */
    parityIsLoadBearing: false,
    paritySurvivesAs: 'a ±1 px net and a ±0.5 px cross-axis drift in the RESTING position',
    bumpsPerPress: 5,
    bumpTicks: Object.freeze([4, 5, 6, 7, 8]),
    /**
     * ⛓ HOW LONG A LEG HAS TO WAIT AFTER A BUMP PRESS, and it is not the
     * glide's 32.
     *
     * The first bump lands at T+4 and the last at T+8, and the body only
     * commits to the far tile once the last one has re-targeted it — so the
     * 32 ticks of 0.5 px motion start from the END of the window, not the
     * start. Measured on both parities (`probe-…-l40-bumps.mjs`, and
     * `iceTurret.test.js` asserts it): settled at T+38 and T+37.
     *
     * ⚠ `PUSH_GLIDE_TICKS` is 40 and covers it, which is luck rather than
     * design — a block's glide is a different mechanism with a different
     * constant. Named here so the driver can floor-check against THIS
     * number, the way a burn floors against its own.
     */
    waitAfterPressTicks: 40,
    settledBy: Object.freeze({ parity0: 38, parity1: 37 }),
    updatesBeforeThePlayer: true,
    glidePxPerTick: ICE_TURRET.moveSpeed,
    /** ⛔ The four gates a leg has to satisfy at once. */
    gates: Object.freeze([
        'ON SCREEN for every tick of the glide — `Enemy.update`\'s first line',
        'NOT FROZEN — `Mobile.mobileUpdate` wraps the whole move block',
        'no fatal tile under the body at REST or mid-glide — two different checks',
        'the player OFF the corpse for the Solid latch, and the player is in the '
            + 'corpse\'s own `solids` list so it also BLOCKS the glide',
    ]),
    /**
     * ⛔⛔⛔ AND THE KILL IS THE BLOCKER — NAMED, PRICED AND NOT BUILT.
     *
     * The corpse is built, the bump is driven and `fire.bumps` exists; the
     * leg cannot run because NO ENEMY IN THIS MODEL IS KILLABLE BY ANY
     * WEAPON. `presses.PRESS_ARM_POLICY.Enemy` is `refused` ("a death moves
     * totalEnemies(), which opens tSet == -1 locks") and the four modelled
     * sword/spear arms are Tile, PushableBlockSpear, BreakableRock and
     * LightPole — none of them an enemy. So a sword press whose slash rect
     * reaches the turret THROWS one layer below the verb.
     *
     * ⛓ What the kill needs is small and specific: `Enemy.hit`'s guards
     * (`hitsTimer <= 0`, `onlyHitBy`, `if (hitByFire || t != "Fire")`, `hits
     * += d`, `hits >= hitsMax -> startDeath`) plus a `hitsTimer` decrement
     * in the stepper, plus a `kill` arm on the press verb. What makes it a
     * SLICE rather than a paragraph is the refusal's own reason: a death
     * moves `totalEnemies()`, which opens every `tset == -1` lock in the
     * room, so the first enemy this model kills has to bring the kill-lock
     * ledger with it.
     *
     * ⚠ AND FIRE IS NOT THE WAY IN. `Enemy.hit`'s damage arm is
     * `if (hitByFire || t != "Fire")` and `IceTurret` never sets
     * `hitByFire`, so a fire hit falls to the empty `knockback` override —
     * which is exactly why the BUMP could be modelled without a damage
     * model, and why the kill cannot.
     */
    kill: Object.freeze({
        hits: ICE_TURRET.hitsMax,
        cadence: ICE_TURRET.hitsTimerMax,
        notFire: '`Enemy.hit`\'s `if (hitByFire || t != "Fire")` — fire falls to the '
            + 'else and calls the empty `knockback`',
        writes: 'nothing — no `removed()`, no `check()`, no `setPersistence`, no tag',
        blocked: true,
        blockedBy: '`presses.PRESS_ARM_POLICY.Enemy` is `refused` — no enemy in this '
            + 'model is killable by any weapon, and a death moves `totalEnemies()`, '
            + 'which opens every `tset == -1` lock in the room',
    }),
    /** ⚠ And the corpse is per-VISIT: `new Game` rebuilds a live turret. */
    perVisit: 'a rebuild REVIVES the turret, so the kill, the pushes, the hold and '
        + 'everything downstream of the hold share ONE window',
});
