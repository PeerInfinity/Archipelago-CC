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
// ⛓⛓⛓ R5 SLICE 21: THE DAMAGE ARM. `enemyDamage.js` owns `Enemy.hit`'s
// five gates, the i-frame timer, the death staging and `Mobile.death()`'s
// eleven-tick fade for EVERY class; this file owns what is specific to
// `IceTurret` — the `currentAnim != "dead"` gate above `super.hit`, and the
// `death()` override that consumes the first `destroy`.
import {
    MOBILE_DEATH_FADE, PIT_FADE, createEnemyDamage, enemyHit, enemyHitUpdate, mobileDeath,
} from './enemyDamage.js';
// ⛓⛓⛓ R5 SLICE 22: THE BLAST. The ELEVENTH family and the first
// projectile. This file owns the SHOOTER — the aim, the volley clock and
// the two-animation state machine that decides when `endAnim` fires;
// `iceTurretBlast.js` owns what leaves the barrel.
import { spawnVolley } from './iceTurretBlast.js';
// `_timer += _anim._frameRate * FP.elapsed`, with `FP.elapsed` pinned at
// `Engine.MAX_ELAPSED`. One transcription of that constant for the package.
import { FP_ELAPSED } from './chasers.js';

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
    /** `attackAnimSpeed` — the frameRate of BOTH shot animations. */
    attackAnimSpeed: 10,
    /**
     * ⛓ The two shot animations, and their frame COUNTS are what the
     * `Spritemap` clock divides. `add(name, frames, rate)` defaults `loop`
     * to TRUE, so both fire their callback on the WRAP rather than on a
     * completion — which is why `complete` never goes true for either and
     * why `endAnim` is reached at all.
     */
    anims: Object.freeze({
        startshot: Object.freeze({ frames: 1, rate: 10, loop: true }),
        finishshot: Object.freeze({ frames: 5, rate: 10, loop: true }),
        /** ⛔ rate 0 — `_timer` never advances, so "dead" NEVER calls back. */
        dead: Object.freeze({ frames: 1, rate: 0, loop: true }),
        /** ⛔ rate 0, and nothing in the class ever plays it. */
        hit: Object.freeze({ frames: 1, rate: 0, loop: true }),
    }),
    /** ⛔ `var d:int = FP.distance(...)` — the range test TRUNCATES first. */
    rangeIsTruncated: true,
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
        // ⛓⛓ R5 SLICE 21: the damage fields, from the ONE transcription of
        // `Enemy.as`'s defaults — `hits`, `hitsMax`, `hitsTimer`,
        // `hitsTimerMax`, `hitByDarkStuff`, `canHit`, `onlyHitBy`,
        // `hitByFire`, `justKnock`, `maxForce`, `dying`, `destroy`, `alpha`,
        // `removed`. Spread FIRST so the fields below win where this class's
        // constructor overwrites one.
        ...createEnemyDamage('IceTurret', {
            // `IceTurret`'s ctor line 51 — the ONE damage field it writes.
            // ⚠ And it is not a constant: `update()`'s first line is
            // `dieInWater = hits >= hitsMax`, so it flips the tick after the
            // killing blow. Seeded false because that is what the ctor does.
            dieInWater: false,
        }),
        id: `iceturret@${x},${y}`,
        /** The OEL placement, for the id join with `world.solids`. */
        oel: { x, y },
        x: ex,
        y: ey,
        v: { x: 0, y: 0 },
        tile: { x: Math.floor(ex / TILE), y: Math.floor(ey / TILE) },
        cTile: { x: Math.floor(ex / TILE), y: Math.floor(ey / TILE) },
        lTile: { x: Math.floor(ex / TILE), y: Math.floor(ey / TILE) },
        /** `sprIceTurret.currentAnim == "dead"` — the corpse predicate. */
        dead: false,
        // ── ⛓⛓⛓ R5 SLICE 22: THE SHOOTER ────────────────────────────
        /**
         * `sprIceTurret.angle`, in DEGREES and UNBOUNDED. `Image.angle` is
         * a plain public var with no setter and no normalisation, so this
         * accumulates exactly as the game's does — including past ±180,
         * which is what makes `FP.angle_difference`'s SINGLE wrap
         * observable rather than academic.
         */
        angle: 0,
        /** `shootTimer`, seeded 0 — so a turret in range fires on tick ONE. */
        shootTimer: 0,
        /**
         * The `Spritemap`'s own three fields. `currentAnim` is `_anim ?
         * _anim._name : ""`, and a fresh Spritemap has played nothing —
         * so the initial value is the empty string, which is exactly the
         * state `update()`'s range arm requires.
         */
        anim: '',
        animIndex: 0,
        animTimer: 0,
        /** A monotonic counter, for blast ids. Not a game field. */
        volleys: 0,
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
        /** R5 slice 22: the blasts THIS tick's `endAnim` produced, or null. */
        spawned: null,
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
 * ⛓⛓⛓ `IceTurret.hit(f, p, d, t)` — THE OVERRIDE, AND IT IS ONE LINE.
 *
 * ```
 *   override public function hit(f, p, d, t):void {
 *       if (sprIceTurret.currentAnim != "dead") super.hit(f, p, d, t);
 *   }
 * ```
 *
 * So the CORPSE is untouchable by every weapon — which is the reason
 * `bumpIceTurret` could be modelled in slice 20 without a damage model at
 * all, and the reason a sword press at a corpse is a genuine no-op rather
 * than a fourth hit.
 *
 * ⛔ AND FIRE STILL CANNOT KILL IT. `Enemy.hit`'s third gate is
 * `if (hitByFire || t != "Fire")` and `IceTurret` never sets `hitByFire`,
 * so a fire hit falls to the else and calls `knockback` — which this class
 * overrides EMPTY. Fire moves a corpse (`bump`, one layer up in
 * `genericHit`) and does nothing whatever to a live turret.
 *
 * @returns the `enemyHit` verdict — see `enemyDamage.js`.
 */
export function hitIceTurret(state, { d = 1, f = 0, t = 'Sword', frozen = false } = {}) {
    return enemyHit(state, { d, f, t, frozen, reachable: !state.dead });
}

/**
 * The three sword hits as ONE call, for a probe or a fixture that wants a
 * corpse without spending 63 ticks landing them at the i-frame cadence.
 *
 * ⛔⛔ AND IT NO LONGER PRODUCES A CORPSE. Slice 20's version wrote
 * `dead = true` directly, which is `startDeath` AND `death()` collapsed into
 * one instant — and `death()` is a TICK LATER, inside `Mobile.mobileUpdate`,
 * on an update the killing blow's own tick has already run. What this sets
 * is exactly what `Enemy.startDeath` sets: `destroy`. The next
 * `stepIceTurret` is what turns the body into the corpse, because that is
 * where the game does it. [[feedback_one_press_is_five_dispatches]] — the
 * same shape one layer down: a death is a SEQUENCE, not a flag.
 */
export function killIceTurret(state) {
    if (state.dead || state.dying) return state;
    state.hits = ICE_TURRET.hitsMax;
    state.hitsTimer = ICE_TURRET.hitsTimerMax;
    state.dying = true;
    // `Enemy.startDeath` — and NOTHING else. The corpse is `death()`'s job.
    state.destroy = true;
    return state;
}

/**
 * ⛔⛔⛔ `IceTurret.death()` — THE INTERCEPT, as `mobileDeath`'s hook.
 *
 * ```
 *   if (destroy) {
 *       if (anim == "dead") super.death();
 *       else { setHitbox(16,16,8,8); play("dead"); destroy = false;
 *              solids.push("Enemy","Player"); }
 *   }
 * ```
 *
 * The first call CONSUMES the destroy: the hitbox shrinks to 16x16, the
 * "dead" anim plays and the body stays in the world. So a killed turret is
 * still `classCount(IceTurret)` — a `tset == -1` lock in its room stays
 * shut — and it writes NO persistence: there is no `removed()`, no
 * `setPersistence` and no tag anywhere in the class.
 *
 * ⚠ AND THE GATE IS THE ANIM, NOT `hits`. A LIVE turret destroyed by lava
 * (`dieInLava` is the base default and this class does not clear it) turns
 * into a corpse first and dies on the tick after — which is the game, and
 * is why this hook tests `dead` rather than `hits >= hitsMax`.
 *
 * @returns {boolean} true when the override consumed the destroy.
 */
function interceptIceTurretDeath(state) {
    if (state.dead) return false;
    state.dead = true;
    state.destroy = false;
    return true;
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
 * `FP.angle_difference(a0, a1)` — and it wraps ONCE, not to a canonical
 * range.
 *
 * ```
 *   var d:Number = a0 - a1;
 *   if (d < -Math.PI) d += 2 * Math.PI;
 *   if (d >  Math.PI) d -= 2 * Math.PI;
 * ```
 *
 * ⛔ SO A DIFFERENCE BEYOND ±3π COMES BACK UNWRAPPED, and `sprIceTurret.angle`
 * is an unbounded accumulator — the two facts only meet on a turret that has
 * chased the player round it several times. Transcribed verbatim rather than
 * replaced with a modulo, which is the tidier description this arc keeps
 * being punished for.
 */
function angleDifference(a0, a1) {
    let d = a0 - a1;
    if (d < -Math.PI) d += 2 * Math.PI;
    if (d > Math.PI) d -= 2 * Math.PI;
    return d;
}

/**
 * ⛓⛓⛓ `IceTurret.update()`'s AIM-AND-FIRE BLOCK — the tail below its own
 * `if (Game.freezeObjects) return`.
 *
 * ```
 *   if (currentAnim != "dead") {
 *       player = FP.world.nearestToEntity("Player", this)
 *       if (player) {
 *           var d:int = FP.distance(x, y, player.x, player.y);
 *           if (d <= attackRange && currentAnim != "startshot"
 *                                && currentAnim != "finishshot") {
 *               angle += angle_difference(-atan2(p.y - y, p.x - x),
 *                                         angle/180*PI) * 180/PI / 10;
 *               if (shootTimer > 0)      shootTimer--;
 *               else if (hitsTimer <= 0) { shootTimer = 25; play("startshot"); }
 *           } else {
 *               shootTimer = shootTimerMax;          // <- RE-ARMED
 *           }
 *       }
 *       if (currentAnim == "") frame = 0;
 *   }
 * ```
 *
 * ⛔⛔ **THE `else` RE-ARMS THE CLOCK, AND THE ANIMATION IS INSIDE THE SAME
 * CONDITION.** So the 25-tick gap is not measured from the shot: it starts
 * when the animation ENDS, because every tick of the animation runs the
 * `else` and writes 25 back. [[feedback_else_arm_binds_to_the_nearest_if]]
 * on the arm rather than on the guard — the condition it belongs to is a
 * three-term `&&` and only one of the three is the range.
 *
 * ⛔ **AND `d` IS AN `int`.** `var d:int = FP.distance(...)` truncates
 * before `d <= attackRange`, so the real threshold is a distance strictly
 * below 129, not 128.
 *
 * ⛔⛔ **AND THIS BLOCK IS NOT `onScreen`-GATED.** `Enemy.update`'s screen
 * test returns out of `Enemy.update`, which is `super.update()` — one frame
 * higher than this. A turret the camera has left still aims and still
 * fires; what it stops doing is moving, checking its terrain and dying.
 */
function iceTurretAim(state, player) {
    if (state.dead || !player) return;
    const d = Math.trunc(Math.sqrt((player.x - state.x) * (player.x - state.x)
        + (player.y - state.y) * (player.y - state.y)));
    if (d <= ICE_TURRET.attackRange && state.anim !== 'startshot' && state.anim !== 'finishshot') {
        state.angle += (angleDifference(
            -Math.atan2(player.y - state.y, player.x - state.x),
            (state.angle / 180) * Math.PI,
        ) * 180) / Math.PI / 10;
        if (state.shootTimer > 0) {
            state.shootTimer -= 1;
        } else if (state.hitsTimer <= 0) {
            state.shootTimer = ICE_TURRET.shootTimerMax;
            // `play("startshot")` — `_index = 0; _timer = 0; complete = false`.
            state.anim = 'startshot';
            state.animIndex = 0;
            state.animTimer = 0;
        }
    } else {
        state.shootTimer = ICE_TURRET.shootTimerMax;
    }
}

/**
 * ⛓⛓⛓ `Spritemap.update()` — AND IT IS NOT PART OF `Entity.update` AT ALL.
 *
 * `World.update`'s loop is
 * ```
 *   if (e.active) { …; e.update(); }
 *   if (e._graphic && e._graphic.active) e._graphic.update();
 * ```
 * — the SAME iteration, immediately after the entity. So the animation
 * advances once per tick, after `IceTurret.update` has run, and `play()`
 * called during that update gets its first increment on its own tick.
 *
 * ⛔⛔⛔ **AND IT IS NOT FREEZE-GATED.** `Game.freezeObjects` is read by
 * `Mobile.mobileUpdate` and by `IceTurret.update`'s tail; nothing in
 * `World.update` or `Spritemap.update` looks at it. ⇒ **A CEREMONY DOES
 * NOT STOP A VOLLEY ALREADY IN THE BARREL**: the animation keeps running
 * through frozen frames and `endAnim` spawns its three blasts on schedule.
 * What the freeze stops is the DECISION to start another one.
 *
 * ⛓ THE CLOCK, TRANSCRIBED RATHER THAN DIVIDED. `_timer += 10 * 0.0333`
 * and a `while (_timer >= 1) { _timer--; _index++; }` — ten increments of
 * 0.333 leave 3.33 and not 10/3, so the wrap ticks are 4 and 16 rather
 * than the 3 and 15 a division gives (§35's double-precision rule, one
 * clock over).
 *
 * @returns {?Array} the three blasts a `startshot` wrap spawned, or null
 */
function iceTurretAnimStep(state, turretId) {
    const a = ICE_TURRET.anims[state.anim];
    // `if (_anim && !complete)` — an unknown name (the `play("")` case) and
    // a rate-0 animation both sit here doing nothing for ever.
    if (!a || a.rate === 0) return null;
    let spawned = null;
    state.animTimer += a.rate * FP_ELAPSED;
    while (state.animTimer >= 1) {
        state.animTimer -= 1;
        state.animIndex += 1;
        if (state.animIndex === a.frames) {
            // `_loop` is true for both, so: `_index = 0; callback()`.
            state.animIndex = 0;
            if (state.anim === 'startshot') {
                // `endAnim`'s `case "startshot"`: play("finishshot") FIRST,
                // then add the three blasts. `play` resets `_timer` to 0
                // INSIDE the callback, so the remainder is DISCARDED and the
                // `while` exits — the second animation starts from zero.
                const angle = state.angle;
                state.anim = 'finishshot';
                state.animIndex = 0;
                state.animTimer = 0;
                state.volleys += 1;
                spawned = spawnVolley(turretId, state.volleys, state.x, state.y, angle);
                break;
            }
            if (state.anim === 'finishshot') {
                // `endAnim`'s `default:` — `play("")`, which finds no anim,
                // sets `complete = true` and leaves `currentAnim` empty.
                state.anim = '';
                state.animIndex = 0;
                state.animTimer = 0;
                break;
            }
            // ⛔ `case "dead": break;` — unreachable, because the "dead"
            // animation's frameRate is 0 and `_timer` never gets there.
            // Transcribed as unreachable rather than pruned.
            break;
        }
    }
    return spawned;
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
 * @param {?{x:number,y:number}} ctx.player  R5 slice 22: the player's ENTITY
 *   point, for `FP.world.nearestToEntity("Player", this)` and the range
 *   test. Omitting it makes the turret inert — which is what a probe about
 *   the corpse's glide wants and what a ROUTE must never do.
 */
export function stepIceTurret(state, ctx = {}) {
    const {
        frozen = false, onScreen = true,
        blockedAt = null, terrainAt = null, playerOverlaps = null, player = null,
    } = ctx;
    if (state.removed) return state;
    state.ticks += 1;
    // The blasts THIS tick spawned, replaced every tick so a caller cannot
    // drain a stale volley twice.
    state.spawned = null;

    // ── IceTurret.update()'s FIRST line, above `super.update()` ───────
    // ⛓ `dieInWater = hits >= hitsMax` — RE-DERIVED EVERY TICK, so it flips
    // on the tick AFTER the killing blow (the turret updates before the
    // player, so the hit lands after this line has already run for that
    // tick). One tick early or late is the difference between a corpse that
    // drowns and one that does not.
    state.dieInWater = state.hits >= state.hitsMax;

    // ── Enemy.update() ────────────────────────────────────────────────
    if (state.activeOffScreen || onScreen) {
        // ⛔ THE TERRAIN SWITCH, ABOVE EVERY FREEZE GATE — and it does NOT
        // need the body to be mid-glide.
        if (terrainAt) {
            const t = terrainAt(state.x, state.y);
            if (t === ICE_TURRET.fatalTiles.water && state.dieInWater) state.destroy = true;
            else if (t === ICE_TURRET.fatalTiles.lava && state.dieInLava) state.destroy = true;
            else if (t === ICE_TURRET.fatalTiles.pit && state.canFallInPit
                && !state.fallInPit) state.fallInPit = true;
        }
        if (!state.destroy && state.fallInPit && state.canFallInPit) {
            // The descent: `Enemy.update`'s own block, which REPLACES the
            // Mobile update — a body falling into a pit does not glide, and
            // does not reach `death()` either.
            // ⛔ AND IT FADES THE SAME `alpha` `Mobile.death()` READS. Not a
            // second counter: `(graphic as Image).alpha -= fallAlphaSpeed` is
            // literally the field the removal test looks at, which is why a
            // pit removal is IMMEDIATE where a hazard removal takes eleven
            // ticks — the descent has already spent the whole budget.
            state.x += (Math.floor(state.x / TILE) * TILE + TILE / 2 - state.x) / 10;
            state.y += (Math.floor(state.y / TILE) * TILE + TILE / 2 - state.y) / 10;
            const next = state.alpha - PIT_FADE.alphaStep;
            state.alpha = next < 0 ? 0 : (next > 1 ? 1 : next);
            if (state.alpha <= 0) { state.destroy = true; state.fell = true; }
        } else {
            // Mobile.mobileUpdate()
            if (!state.destroy && !frozen) {
                iceTurretInput(state, terrainAt);
                moveAxis(state, 'x', state.v.x, blockedAt);
                moveAxis(state, 'y', state.v.y, blockedAt);
            }
            // ⛔⛔⛔ `death()`, AND IT IS UNCONDITIONAL — the last line of
            // `mobileUpdate`, outside its `if (!destroy)` and outside the
            // freeze gate. Slice 20 had `if (state.destroy) state.removed =
            // true`, which is wrong TWICE: the first `destroy` is CONSUMED
            // by `IceTurret.death()` (the corpse), and the second starts an
            // eleven-tick alpha fade rather than removing anything. A corpse
            // killed by a hazard is still a wall for those eleven ticks.
            mobileDeath(state, interceptIceTurretDeath);
            // `Enemy.update`'s own tail — and it reads `destroy` AFTER
            // `death()` may have cleared it, which is why a turret's FIRST
            // dead tick still runs `hitUpdate`.
            if (!state.destroy) enemyHitUpdate(state, { onScreen });
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
    // ⛓⛓ AND THE ANIMATION IS BELOW EVEN THAT. `Spritemap.update` is
    // called by `World.update` after `e.update()` returns, so it runs on
    // the frozen ticks the `return` skips — see `iceTurretAnimStep`.
    if (state.removed) return state;
    if (frozen) {
        state.spawned = iceTurretAnimStep(state, state.id);
        return state;
    }
    if (state.dead) {
        // `else if (!collide("Player", x, y)) type = "Solid"` — a LATCH.
        if (!state.solid) {
            const overlaps = playerOverlaps ? playerOverlaps(iceTurretRect(state)) : false;
            if (!overlaps) state.solid = true;
        }
    } else {
        iceTurretAim(state, player);
    }
    state.spawned = iceTurretAnimStep(state, state.id);
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
     * ⛓⛓⛓ THE KILL — BUILT AT R5 SLICE 21, AND IT IS THE FIRST ONE.
     *
     * `enemyDamage.js` is the arm; `hitIceTurret` is this class's gate above
     * it, `killIceTurret` is `startDeath` alone, and `stepIceTurret`'s
     * `mobileDeath` slot is where the corpse is actually made.
     *
     * ⛔ THE CADENCE IS THE I-FRAME, AND THE MARGIN IS ONE TICK. A hit sets
     * `hitsTimer = 30` during the PLAYER's update; the body's `hitUpdate`
     * runs BEFORE the player each tick, so thirty decrements land on the
     * thirty ticks after and the gate is open again on the thirtieth. A
     * 31-tick press cadence (`combatVerbs.KILL_PRESS_CADENCE`, which is
     * `max(21, 30 + 1)`) clears it by one — and 30 would not, which is why
     * "three presses" is only a kill if the presses are SPACED.
     *
     * ⛓ AND ONE PRESS IS AT MOST ONE LANDED HIT. `slashDelayMax` is 0, so
     * `slash()`'s hit test runs on every tick the flag is up — five of them,
     * the "slash" anim's own length — and the i-frame refuses four. The
     * exception is `hitByDarkStuff`, which ORs past the i-frame; no weapon
     * this rung carries sets it.
     *
     * ⛔⛔ AND THE DEATH COSTS THE LEDGER NOTHING, WHICH IS COMPUTED, NOT
     * ASSUMED. `death()` intercepts, so `classCount(IceTurret)` does not
     * move and no `tset == -1` lock can open — and L40 has none anyway (all
     * nine of its locks are `wandlock`s with `tset` 0–5, plus a `keyType`-2
     * `bosslock`). `enemyDamage.killLockLedger` runs the scan and ASSERTS
     * the empty set, because "no kill locks" and "nobody looked" print the
     * same thing.
     *
     * ⚠ AND FIRE IS STILL NOT THE WAY IN. `Enemy.hit`'s third gate is
     * `if (hitByFire || t != "Fire")` and `IceTurret` never sets
     * `hitByFire`, so a fire hit falls to the empty `knockback` override —
     * which is exactly why the BUMP could be modelled a slice before the
     * damage model existed.
     */
    kill: Object.freeze({
        hits: ICE_TURRET.hitsMax,
        /** The i-frame the presses have to clear, in ticks. */
        iFrames: ICE_TURRET.hitsTimerMax,
        landedHitsPerPress: 1,
        landedHitsPerPressWhy: 'the i-frame refuses the other four tests of the five-tick '
            + 'slash window; `hitByDarkStuff` is the only thing that ORs past it and no '
            + 'weapon this rung carries sets it',
        notFire: '`Enemy.hit`\'s `if (hitByFire || t != "Fire")` — fire falls to the '
            + 'else and calls the empty `knockback`',
        writes: 'nothing — no `removed()`, no `check()`, no `setPersistence`, no tag',
        /** ⛔ `classCount(IceTurret)` is unchanged by a kill. */
        movesTotalEnemies: false,
        corpseIsStagedOnTheNextTick: true,
        blocked: false,
        arm: 'enemyDamage.KILL_ARM_POLICY.IceTurret — `modelled`, and the ONLY one',
    }),
    /**
     * ⛔⛔⛔ AND THE BLAST IS THE ONE THAT REFUTED THE LEG — R5 slice 21.
     *
     * `plan-seedling-r5-l40-part5.mjs` synthesised clean, drove clean, and
     * DIVERGED FROM THE REAL GAME at tick 1616 of 1965 — in both arms of
     * its pair, at the same tick, by the same 0.8 px, growing to a
     * permanent **14.15 px** y offset. The recording is valid and the model
     * is refuted.
     *
     * ⛓⛓⛓ THE CAUSE IS `IceTurretBlast`, AND IT IS NOT THE DAMAGE:
     *
     * ```
     *   case "Player":
     *       (hits[i] as Player).freeze(freezeTime);              // 15 ticks
     *       (hits[i] as Player).hit(null, 0, new Point(x, y));   // Bot.noDamage
     * ```
     *
     * `Player.hit`'s WHOLE BODY is behind `if (Bot.noDamage) return`, so the
     * damage really is free. `freeze()` is the line ABOVE it and is guarded
     * by nothing — and `Player.input()`'s own gate is
     * `if (!receiveInput || frozenTimer > 0 || fallFromCeiling) return`. So a
     * blast that touches the player STOPS THE WALK for fifteen ticks, and
     * the recording shows exactly that: a NINE-TICK dead stop at
     * (499.6,472.8) that the model walks straight through.
     *
     * ⇒ **"damage taken is priced, not forbidden" is HALF THE RULE.**
     * `Bot.noDamage` prices the damage; nothing prices the FREEZE, and a
     * freeze is a displacement. [[feedback_the_obstacle_is_the_machine]]:
     * the turret's capability set has three members — a 32x32 body, contact
     * damage, and a projectile that stops the player — and the leg was
     * priced against a model that had only the first.
     *
     * ⚠ AND IT IS UNAVOIDABLE FOR THIS ERRAND, WHICH IS WHY IT IS A SLICE
     * AND NOT A RE-ROUTE. `attackRange` is 128 and the slash reach is 16, so
     * every stance that can kill one is 112 px inside the volume the blasts
     * come out of. There is no approach that is out of range.
     */
    blasts: Object.freeze({
        /**
         * ⛓⛓⛓ R5 SLICE 22: BUILT — `iceTurretBlast.js`, and the refuted
         * recording is what CONFIRMED it.
         *
         * The two withdrawn `--win` streams were still on disk, so the
         * acceptance cost no new recording at all: the same two tapes,
         * replayed through the corrected model, are BYTE-IDENTICAL to the
         * real game for all 1,966 observations of both arms. The residue
         * §35.8 banked — tick 1616, 0.8 px, settling at 14.15, a nine-tick
         * stop at (499.6,472.75) — is exactly what the fix has to erase,
         * and a free oracle is a stronger gate than a fresh recording
         * because it was made BEFORE the model that now matches it.
         *
         * ⛔⛔ AND THE DIVERGENCE TICK WAS NEVER THE CONTACT TICK. The
         * contact is at **1614**; 1616 is the first tick on which the
         * refusal was VISIBLE, because `Player.input()`'s direction arms
         * are themselves gated on `v.y > -moveSpeed` and refuse on a fast
         * tick anyway. Two silent ticks, then nine of dead stop, out of
         * fourteen refused.
         *
         * ⛔⛔⛔ AND THE CAUSE OF THE PHASE WAS THE CAMERA. Getting the
         * freeze onto tick 1614 needed more than the projectile: an
         * `IceTurret` off screen does not run `Mobile.mobileUpdate`, so it
         * has not yet taken `input()`'s 8 px y snap — and eight pixels of
         * turret moves the 128 px range boundary by six ticks, which moves
         * the 45-tick volley clock by a whole cycle. `levelRun` runs
         * `camera.js` live for this.
         */
        modelled: true,
        modelledIn: 'iceTurretBlast.js — the ELEVENTH per-visit family',
        confirmedBy: 'r5-l40-part5 / -control, byte-identical for 1,966 ticks in BOTH arms',
        contactTick: 1614,
        /** The residue the fix had to erase, kept as the acceptance. */
        divergence: Object.freeze({ tick: 1616, dy: -0.8, settlesAt: 14.15, bothArms: true }),
        freezeTicks: 15,
        freezeGuardedByNoDamage: false,
        damageGuardedByNoDamage: true,
        stallObserved: Object.freeze({ from: 1619, to: 1627, ticks: 9 }),
        volley: Object.freeze({
            blasts: ICE_TURRET.blastsPerVolley,
            everyTicks: ICE_TURRET.shootTimerMax,
            speed: ICE_TURRET.shotSpeed,
            range: ICE_TURRET.attackRange,
        }),
        why: '`IceTurretBlast.update` calls `Player.freeze(15)` on the line ABOVE '
            + '`Player.hit`, and only `hit` is behind `if (Bot.noDamage) return`. '
            + '`Player.input()` returns while `frozenTimer > 0`, so the blast is a '
            + 'fifteen-tick STOP that no damage policy touches.',
        built: 'three bodies per volley at 6 px/tick from the turret\'s own angle, '
            + 'colliding with ["Player","Tree","Solid","Shield"] and removed on the first '
            + 'hit — `iceTurretBlast.js`, with the volley clock in this file.',
        /**
         * ⛓⛓ AND THE PRICE IS A NUMBER NOW. Fourteen refused input ticks
         * per contact, `run.blastFreezes` per leg, and a press inside a
         * span is a REFUSAL rather than a silent loss.
         */
        costTicksPerContact: 14,
    }),
    /**
     * ⛔⛔⛔ R5 SLICE 22: `onScreen` IS LOAD-BEARING FOR THE POSITION, NOT
     * ONLY FOR THE GLIDE — WHICH IS THE HALF SLICE 20 NAMED AND MISSED.
     *
     * `stepIceTurretsNow` declared `onScreen: true` with an argued reason:
     * a corpse only glides on screen, and every leg that pushes one stands
     * beside it. Both true. But `Enemy.update`'s early return skips the
     * whole of `Mobile.mobileUpdate`, and this class's `input()` SNAPS ITS
     * OWN y — a turret at a tile corner moves 8 px the first tick it runs.
     * So the camera decides where the body IS, which decides when the
     * player crosses its 128 px range, which sets the phase of a 45-tick
     * volley clock.
     *
     * Measured: with `onScreen: true` from tick 0 the L40 turret stands at
     * y 424 and fires at 1560/1605/1650; with the camera live it stands at
     * 416 until the camera reaches it, and the recording's contact lands.
     *
     * ⇒ [[feedback_the_obstacle_is_the_machine]]: enumerating what the gate
     * stops has to include "being where it started".
     */
    onScreenDecidesPosition: true,
    /** ⚠ And the corpse is per-VISIT: `new Game` rebuilds a live turret. */
    perVisit: 'a rebuild REVIVES the turret, so the kill, the pushes, the hold and '
        + 'everything downstream of the hold share ONE window',
});
