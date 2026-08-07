/**
 * seedlingDemo/playerPhysicsV2 — the v1 tick with the sweeps RE-ARMED, the
 * terrain probe made stateful, and ROOM TRANSITIONS modelled.
 *
 * v2 slices 2 and 3 of the real-game bot ladder. Brief:
 * `CC/docs/plans/seedling-bot-v2-opus-kickoff.md` §3.2 / §3.3. This is an
 * EXTENSION of `playerPhysicsV1`, not a fork: the sweep loop, the friction,
 * the input overshoot, the update order and the world clamp are all still
 * that module's, because the AS3 has one `Player.update` and one
 * `moveX`/`moveY` pair. What lives here is exactly the three things v1
 * could not express:
 *
 *   1. **The collision test.** `Player.moveX/moveY` do
 *      `var c:Entity = Bot.noclip ? null : collideTypes(solids, x + d, y);`
 *      per 1-px step; v1 always took the `null` arm. Here the `collides`
 *      seam of `playerPhysicsV1.step` is wired to the level geometry. On a
 *      hit the sweep RETURNS: the position stays at the last free step
 *      (mid-pixel, wherever the fractional approach ended) and the velocity
 *      is NOT zeroed — `Mobile.as:39-40` discards the returned entity and
 *      never touches `v`. Both are directly recorded facts, not readings of
 *      the source: `collide-up-rock` pins at y = 130.5 and then creeps to
 *      130.05 four ticks after the key is released, which only happens if
 *      the into-wall velocity survived and decayed through `friction()`.
 *
 *   2. **`getState()` is STATEFUL** (`Player.as:656-668`). v1's seam was a
 *      pure `terrainStateAt(x, y) -> t`, which cannot express any of the
 *      three properties the real function has — nearest by tile CENTRE,
 *      candidates restricted to still-walkable tiles, and STICKY when the
 *      intersect gate fails. `_state` is a member (`Player.as:297`,
 *      initialised 0), so it belongs to the runner's per-tick state, and
 *      `resolveTerrainState` below takes the previous value and returns the
 *      next one.
 *
 *   3. **Room transitions.** There is no edge logic anywhere in Seedling:
 *      "walking off the left edge" is an AABB overlap with an authored
 *      `Teleporter` entity, and the tick order that produces the recorded
 *      stream is transcribed across `updateTeleporters` (which runs BEFORE
 *      the player, so it tests the position the previous tick left) and
 *      `arriveIn` (the end-of-tick swap). The full settled order, and why
 *      there is no intermediate observation, is in `tapeFormat.js`'s
 *      docblock — it is a contract both consumers share, not an
 *      implementation detail of this module.
 *
 * ── How this module gets a level: INJECTION ───────────────────────────
 * A design decision slices 3 and 4 both build on, so it is stated here
 * rather than left implicit.
 *
 * `tapeFormat` / `playerPhysicsV1` / `tapeRunner` / `botDriverV1` are
 * deliberately dependency-free and browser-usable — engine-only modules
 * with no `fs`, no DOM and no data files — and slice 1 kept
 * `buildLevelWorld` in that doctrine by having it take a level RECORD
 * rather than reading the 975 KB atlas itself. The seam therefore stays
 * where slice 1 put it: **the caller injects a `levelSource(level) ->
 * record`**, and the node-only half that reads `seedling-map.json` off
 * disk lives in `levelSource.js`, beside `fixtures/index.js` which is
 * already this module's node-only edge. A browser caller builds the same
 * one-function seam over a `fetch`ed atlas; nothing in the engine imports
 * the data.
 *
 * A record source rather than a prebuilt world, for two reasons:
 *   - a tape crosses levels, and the runner must be able to build a world
 *     for a level nobody named at call time (a teleporter's `to`);
 *   - `buildLevelWorld` throws loudly on geometry v2 does not model, and
 *     that throw should fire when the level is actually ENTERED, naming the
 *     level the run walked into, rather than eagerly for all 116.
 * The runner memoises the worlds it builds, so the record source is asked
 * once per level per run.
 *
 * ── Loud seams, not quiet approximations ──────────────────────────────
 * Unmodelled terrain (water, pit, lava, ice, waterfall) and pixelmask
 * colliders THROW with the thing named. So do the two transition cases the
 * model cannot honestly resolve: two teleporters firing on one tick (the
 * winner depends on FlashPunk's update order) and a teleporter targeting
 * its own level (invisible to the game side's derivation). v1's lesson was
 * that every divergence came from a description tidier than the code, so a
 * fixture that strays dies loudly instead of producing a plausible stream
 * that the differential then blames on physics.
 */

import { rectsOverlap, TILE_SIZE } from './levelWorld.js';
import { coerceTerrainState } from './tapeFormat.js';
import {
    CHECK_OFFSET_Y,
    DEFAULT_FRICTION,
    HITBOX,
    MOVE_SPEEDS,
    WATER_FRICTION,
    step as stepV1,
} from './playerPhysicsV1.js';

import {
    SWIM_LENGTH_FRAMES, createPinnedChannel, stepChannel, playChannel,
    channelPlaying, swimSpeedBonus,
} from './swimSoundClock.js';

export class PhysicsV2Error extends Error {
    constructor(message) {
        super(message);
        this.name = 'PhysicsV2Error';
    }
}

/**
 * `Player.as:297` — `private var _state:int = 0`. The sticky terrain state
 * starts at Ground, and a fresh `Player` (a boot, or an arrival through a
 * teleporter) resets it, because the whole entity is new.
 */
export const INITIAL_TERRAIN_STATE = 0;

/**
 * The player's collision box at (x, y), as `Entity.collide` places it
 * (`net/flashpunk/Entity.as`):
 *     x - originX + width > e.x - e.originX  &&  ...
 * i.e. a STRICT half-open overlap of `[x-originX, +width) x [y-originY,
 * +height)`. With `normalHitbox` that is 4x5 with origin (2, 2).
 */
export function playerBoxAt(x, y) {
    const px = x - HITBOX.originX;
    const py = y - HITBOX.originY;
    return { x: px, y: py, right: px + HITBOX.width, bottom: py + HITBOX.height };
}

/**
 * The rect `getState` compares the nearest tile against (`Player.as:660`):
 *     new Rectangle(x - originX, y - originY + checkOffsetY, width, height)
 * — the player's box shifted DOWN by `checkOffsetY` (= 1). Note the probe
 * POINT is `(x, y + checkOffsetY)` and the probe RECT is offset by the same
 * amount; they are two uses of one offset, not two offsets.
 */
export function terrainProbeRect(x, y) {
    const px = x - HITBOX.originX;
    const py = y - HITBOX.originY + CHECK_OFFSET_Y;
    return { x: px, y: py, right: px + HITBOX.width, bottom: py + HITBOX.height };
}

/**
 * `Player.getState()` (`Player.as:656-668`), transcribed:
 *
 *     var tile:Tile = FP.world.nearestToPoint("Tile", x, y + checkOffsetY) as Tile;
 *     if (tile && (new Rectangle(tile.x-tile.originX, ...)).intersects(playerRect))
 *         state = tile.t;
 *
 * Three properties that all have to be here together:
 *
 * - **Nearest by CENTRE.** `nearestToPoint` defaults to `useHitboxes =
 *   false` and measures squared distance to the entity's x/y
 *   (`World.as:640-668`); a `Tile`'s position IS its cell centre
 *   (`Tile.as:101-110`).
 * - **Walkable candidates only.** A solid tile flipped its type to
 *   `"Solid"` on its first update and left the `"Tile"` list, so `state`
 *   can never become a wall type and the nearest candidate beside a wall
 *   may be a surprisingly distant cell. (`beforeTypeFlip` is the one tick
 *   where that is not yet true — see `levelWorld.nearestWalkableTile`.)
 * - **STICKY.** The assignment is inside the intersect gate, so when the
 *   gate fails the PREVIOUS state persists. This is the property a pure
 *   probe cannot have at all: a non-sticky resolver silently substitutes
 *   "the nearest tile" for "the last tile that was actually under me".
 *
 * ⚠ `Rectangle.intersects` is strict — positive-area overlap only, so
 * rects that merely touch do NOT intersect. Verified in the recompiled
 * runtime rather than assumed: `SWFModernRuntime/src/avm2/avm2_text.c:8029`
 * is `(ax < bx+bw) && (ax+aw > bx) && (ay < by+bh) && (ay+ah > by)` behind
 * an isEmpty guard on both rects — the same comparison as FlashPunk's own
 * `Entity.collide`, which is why `rectsOverlap` serves both.
 *
 * ⚠ Not to be confused with `getStatePos` (`Player.as:670-678`): a
 * different function, with NO intersect gate, returning -1 when there is no
 * tile. It is not this one with the gate left out.
 */
export function resolveTerrainState(
    level, x, y, prevState,
    {
        beforeTypeFlip = false, noHazards = [], openBridges = null,
        // ⛓ R5 slice 4: called for a tie whose two candidates lead
        // somewhere different. A CALLBACK rather than a module-level sink,
        // because a diagnostic that outlives the run it describes is a
        // diagnostic that will one day be read against the wrong run.
        onDecidedTie = null,
    } = {},
) {
    const { tile, tie } = level.nearestWalkableTileWithTie(
        x, y + CHECK_OFFSET_Y, { beforeTypeFlip, openBridges },
    );
    if (!tile) return prevState;
    // ⛓ AN EXACT TIE IS NOW DECIDED, NOT REFUSED (R5 slice 4).
    //
    // This used to throw whenever the two candidates behaved differently
    // under the tape's relaxation, because the winner is FlashPunk's
    // entity-list order and `levelWorld` did not transcribe it. It does
    // now — `addType` PREPENDS, so the list is the reverse of the extract
    // and the LATER tile wins — and the throw's own advice ("move the
    // route") stopped being available at the same moment: L47's arrival
    // from L46 puts the probe exactly between a snow tile and an ice one,
    // and a route has no say in where a teleporter drops the player.
    //
    // ⚠ The tie is still WORTH SEEING, so it is reported rather than
    // dropped: a decided tie is a place where the model's answer rests on
    // one transcribed line, and `resolveTerrainState` is not the layer that
    // should decide whether that matters.
    if (tie) {
        const a = terrainEffectClass(coerceTerrainState(tile.t, noHazards));
        const b = terrainEffectClass(coerceTerrainState(tie.t, noHazards));
        if (a !== b && onDecidedTie) {
            onDecidedTie({
                level: level.level,
                x,
                y: y + CHECK_OFFSET_Y,
                won: { tx: tile.tx, ty: tile.ty, t: tile.t, effect: a },
                lost: { tx: tie.tx, ty: tie.ty, t: tie.t, effect: b },
            });
        }
    }
    return rectsOverlap(tile.rect, terrainProbeRect(x, y)) ? tile.t : prevState;
}

/**
 * The anti-ping-pong latch, as `Game`'s first frame arms it.
 *
 * `Teleporter.playerTouching` is set true in exactly ONE place —
 * `Teleporter.check()` (`Teleporter.as:58-65`) — and `Game.update` runs
 * `check()` on every entity on the first frame of a new `Game`
 * (`Game.as:803-812`), ABOVE the `blackCover` gate, so it happens on the
 * world's very first frame whether or not that frame is a live tick.
 * Arriving ON a teleporter therefore pre-latches it and it cannot fire
 * until the player steps off.
 *
 * ⚠ `check()` does not consult `deactivated` — it latches on overlap
 * regardless — so this does not filter either. It is inert today (a
 * deactivated teleporter's `update()` returns before it can fire OR clear),
 * and transcribing it costs nothing.
 *
 * Returned as a Set of INDICES into `level.teleporters`, because the worlds
 * are memoised and shared between runs: the latch is player state and
 * belongs to the caller's per-tick state, not to the geometry. In the game
 * that is automatic — a revisited level is a brand new `Game` with brand
 * new `Teleporter` entities.
 */
const EMPTY_LATCH = new Set();

/**
 * What the physics actually DOES with an effective terrain state — the
 * complete set of consumers at this rung, from `Player.as:516-537` and the
 * setter: `moveSpeed`, the friction selection, the four derived flags, and
 * the pit branch. Two effective states in the same class are
 * indistinguishable in the observation stream however the tie is broken.
 *
 * Deliberately NOT "are the two numbers equal": Ground (0) and Dirt (4) are
 * different states and identical behaviour, and `hazard-boot-pit` — a
 * COMMITTED R0 recording — resolves an exact tie between Dirt and a coerced
 * Pit. Throwing on that would have failed a fixture over an ambiguity the
 * game cannot express.
 */
function terrainEffectClass(effective) {
    switch (effective) {
        case 6: return 'pit';              // the transport branch
        case 1: case 25: return 'water';   // WATER_FRICTION + the swim bonus
        case 17: return 'lava';            // same branch, different state
        case 22: return 'ice';             // slidingFriction + slidingSpeed
        case 10: case 30: return 'stair';  // moveSpeed 0.4, no branch
        default: return 'plain';           // dMS, DEFAULT_FRICTION, no branch
    }
}

/** No key held — what a transport tick passes to `input()`. */
const NO_KEYS = new Set();

/** `Tile.types` index for a Pit. */
const PIT_STATE = 6;

// ── R4: THE HAZARDS COME BACK ─────────────────────────────────────────
//
// Four sticky booleans, three effect sites, and one cumulative timer. The
// thing that makes them harder than a speed table is that they are STATE:
// the setter assigns them on a RAW change (`_s != _state`) and they persist
// until the next one, so the tile the player is standing on and the physics
// the player is running are two different questions.

/** `Tile.types` indices, the ones with hazard physics behind them. */
const WATER_STATE = 1;
const LAVA_STATE = 17;
const ICE_STATE = 22;
const WATERFALL_STATE = 25;

/**
 * The four flags a fresh `Player` starts with — all false (`Player.as:67-70`),
 * and reset by a world swap for the same reason `terrain` is: the entity is
 * new.
 */
export const INITIAL_HAZARD_FLAGS = Object.freeze({
    onIce: false, onWaterfall: false, inWater: false, inLava: false,
});

/**
 * ── R4: `Player.direction`, the facing a press reads ──────────────────
 *
 * The ladder ran three rungs without it because nothing ever pressed an
 * attack key on purpose. R4 does, and every press rect is a function of
 * this one integer (`presses.spearRect`), so it becomes state.
 *
 * ⚠ IT IS DERIVED FROM VELOCITY, NOT FROM KEYS, and the difference is
 * visible in the one case that matters: a player pinned against a wall has
 * `v` zeroed by the sweep, so holding a direction into a wall does NOT
 * keep re-asserting the facing — it STICKS at whatever the last non-zero
 * velocity said. Every press stance the R4 route uses is exactly that
 * case, so a keys-based model would have been right about the direction
 * and wrong about which tick it was right on.
 *
 * `Player.sprites()` (`Player.as:1596-1626`), in order:
 *
 *   directionFace >= 0   ->  direction = directionFace
 *   v.x < 0              ->  2 (LEFT)
 *   v.x > 0              ->  0 (RIGHT)
 *   v.y < 0              ->  1 (UP)
 *   v.y > 0              ->  3 (DOWN)
 *   otherwise            ->  unchanged
 *
 * ⚠ X BEFORE Y, so a diagonal faces horizontally, and the fall-through is
 * "unchanged" rather than any default.
 *
 * ⚠ AND IT RUNS AFTER THE MOVES. `sprites()` is called after
 * `super.update()` — i.e. after friction, `input()`, `moveX` and `moveY` —
 * so the value a press consumes is the one the PREVIOUS tick left.
 * `input()` fires `useItem` and `set spearing` captures `spearDirection =
 * direction` at that moment, and `spear()` itself already ran earlier in
 * the same update, so the rect fires on the NEXT tick. The bridge probe
 * confirms that one-tick lag end to end (press 25, pin breaks 85, and
 * `framesToOpen()` is 60).
 */
export const INITIAL_DIRECTION = 3;
export const DIRECTION_RIGHT = 0;
export const DIRECTION_UP = 1;
export const DIRECTION_LEFT = 2;
export const DIRECTION_DOWN = 3;

/**
 * `sprites()`'s derivation, given this tick's post-move velocity.
 *
 * `directionFace` is passed explicitly rather than folded in, because its
 * writers are a closed set and naming them is the point — see
 * `directionAfterFall`.
 */
export function nextDirection(direction, vx, vy, directionFace = -1) {
    if (directionFace >= 0) return directionFace;
    if (vx < 0) return DIRECTION_LEFT;
    if (vx > 0) return DIRECTION_RIGHT;
    if (vy < 0) return DIRECTION_UP;
    if (vy > 0) return DIRECTION_DOWN;
    return direction;
}

/**
 * ⚠ THE ONE `directionFace` WRITER AN R4 WALK CAN REACH, and it is the pit
 * transport R1 already models.
 *
 * `directionFace` is written in exactly three places (every `directionFace
 * =` in `Player.as`): `checkFallingInPit` sets 3 while the player spins
 * down a hole; the `fallFromCeiling` landing clears it to -1 and sets
 * `direction = 3`; and `knockback` sets it to the current direction under
 * `hitsTimer > 0`, which `Bot.noDamage` makes unreachable — it guards
 * `Player.hit()`, and `hitsTimer` is only ever set there.
 *
 * So for a walk with `noDamage` on, the whole of `directionFace` collapses
 * to: **a fall arrival faces DOWN.** That is a bounded vacuity with a
 * witness rather than an omission, and the witness is R5, whose first
 * unguarded contact re-opens the `knockback` arm.
 */
export function directionAfterFall() {
    return DIRECTION_DOWN;
}

/** `Player.as:65-80` and `Mobile.as:14-15`. */
export const SLIDING_FRICTION = 0.025;
export const SLIDING_SPEED = 1;
export const WATERFALL_ACCELERATION = 0.8;

/** `Player.as:312` — `drownTimerMax`. */
export const DROWN_TIMER_MAX = 10;

/**
 * The state setter's flag assignment (`Player.as:701-724`), transcribed.
 *
 * ⚠ FOUR PROPERTIES, and every one of them is a way to get this wrong:
 *
 * 1. **It runs only on a RAW change.** The gate is `_s != _state` on the
 *    UNCOERCED value, so re-resolving the same tile does not re-assign —
 *    which matters because the assignment is the only thing that ever
 *    clears a flag.
 * 2. **It reads the COERCED value.** `var eff:int = Bot.coerceState(_s)`,
 *    so a hazard in `noHazards` sets nothing and the whole of R1-R3 runs
 *    with all four false.
 * 3. **`inWater` includes WATERFALL.** `eff == 1 || eff == 25` — so a
 *    waterfall runs water friction and the water speed table entry, and
 *    (from `Player.as:530`) carries the `soundPosition("Swim")` term too.
 *    The R4 kickoff bundled waterfall with water for drowning, where they
 *    are NOT the same, and separated them here, where they are.
 * 4. **`onGround` gates the whole block**, and its else-arm clears all
 *    four. `Enemies/LavaTrap.as:61/66` is the only writer of `onGround`
 *    anywhere in the codebase, so it is constant true everywhere the
 *    ladder goes and the else-arm is dead code — recorded rather than
 *    transcribed, because transcribing a branch no fixture can reach is
 *    how a model grows arms nobody has ever tested.
 */
export function hazardFlagsFor(effective) {
    return {
        onIce: effective === ICE_STATE,
        onWaterfall: effective === WATERFALL_STATE,
        inWater: effective === WATER_STATE || effective === WATERFALL_STATE,
        inLava: effective === LAVA_STATE,
    };
}

/**
 * `Player.as:1426-1450` — `checkDrowning`, and the one number that decides
 * whether R4's forbidden-floor policy is a preference or a requirement.
 *
 * ⛔ **`drownTimer` IS NEVER RESET OFF-HAZARD.** The only three writes in
 * the whole class are `= drownTimerMax` on the FIRST contact tick, the
 * decrement below, and `drown()`'s own modular spin — so stepping off the
 * tile freezes the timer where it is and stepping back on resumes the
 * countdown. The whole-run budget for standing on an unprotected hazard is
 * therefore **eleven ticks, cumulative**, after which `drowning` latches
 * and `drown()` runs to `die()`.
 *
 * ⚠ `noDamage` does NOT cover this. It guards `Player.hit()`, and the lava
 * arm's `hit(null, 0, null, 0)` passes damage ZERO anyway — the lethality
 * is the timer, not the damage, and nothing guards `die()`.
 *
 * ⚠ And it reads the COERCED state, so R1-R3's tapes cannot reach it: with
 * water and lava in `noHazards`, `eff` is 0 and this is dead. R4 arms lava,
 * which is precisely why the walk must never stand on one — and why the
 * game's own `drownTimer` readout is asserted 0 as a POSITIVE control
 * rather than trusted to the planner.
 *
 * `canSwim` is the CONCH and `hasDarkSuit` the dark suit, both read off the
 * run's inventory mirror.
 */
export function checkDrowning(drown, effective, inventory) {
    if (drown.drowning) return drown;
    let kind = 0;
    if (effective === WATER_STATE && !inventory.canSwim) kind = 1;
    else if (effective === LAVA_STATE && !inventory.hasDarkSuit) kind = 2;
    if (kind === 0) return drown;
    // `if (v == 2) hit(null, 0, null, 0)` — damage 0, and `Bot.noDamage`
    // guards the body regardless, so there is no health effect to model.
    if (drown.timer <= 0) return { ...drown, timer: DROWN_TIMER_MAX };
    const timer = drown.timer - 1;
    if (timer <= 0) return { timer: 0, drowning: true };
    return { ...drown, timer };
}

/**
 * `Player.as:1411-1423` — `drown()`, the spiral.
 *
 * Writes `v` DIRECTLY, ahead of the friction/input/move block, so the
 * thrash is then subject to friction and the sweeps like any other
 * velocity. Distinctive and deterministic, which is what makes it a usable
 * PAIR witness short of the death it ends in.
 */
export function drownStep(drown) {
    const timer = (drown.timer - 0.5 + DROWN_TIMER_MAX) % DROWN_TIMER_MAX;
    const angle = (timer / DROWN_TIMER_MAX) * 2 * Math.PI;
    return {
        drown: { timer, drowning: true },
        v: { x: Math.cos(angle), y: Math.sin(angle) * 2 },
        dead: timer <= 0,
    };
}

/**
 * `Player.as:516-537` — the friction and speed the flags select.
 *
 * ⚠ ICE REPLACES BOTH, and it is not "water with a different number":
 * `f = slidingFriction (0.025)` AND `moveSpeed = slidingSpeed (1)`, so the
 * player accelerates FASTER than on dry land and decays 10x slower — the
 * ~40 px coast that makes `ShieldLock.turnOff`'s `if (p)` a live question.
 *
 * ⚠ AND THE WATER ARM READS THE RAW STATE. `moveSpeed = moveSpeeds[state]`
 * at `:530`, not `moveSpeeds[eff]` as two lines above it — which is
 * unobservable (the arm only runs when the flag is set, and the flag is set
 * from `eff`, so `eff === state` there) and transcribed anyway, because
 * "unobservable" has decayed twice on this arc the moment the driver got
 * better.
 *
 * ⛓ THE SOUND TERM IS MODELLED NOW, AND ITS VACUITY IS CLOSED (R5 slice 4).
 * `+ 0.25 * int(Music.soundPosition("Swim") < 0.1)` reads a real channel
 * position — the live Web Audio mixer clock, in wall-clock milliseconds,
 * which slice 2 measured DIVERGING across frame rates at tick 52 of an
 * identical tape. The §13 ruling took the PIN: under a v5 tape's
 * `pins: ["sound"]` the game reads a frame clock instead, and
 * `swimSoundClock` is the same arithmetic on this side. `swimBurst` is what
 * that clock says, and `step` refuses to run a wet tick without the pin
 * rather than modelling the term as zero — see its docblock.
 */
export function speedFrictionFor(flags, rawState, effective, moveSpeeds, swimBurst) {
    if (flags.onIce) {
        return { friction: SLIDING_FRICTION, moveSpeed: SLIDING_SPEED };
    }
    const dry = moveSpeeds[effective];
    if (flags.inWater || flags.inLava) {
        return {
            friction: WATER_FRICTION,
            moveSpeed: moveSpeeds[rawState] + swimBurst,
        };
    }
    return { friction: DEFAULT_FRICTION, moveSpeed: dry };
}

export function initialLatch(level, x, y) {
    const box = playerBoxAt(x, y);
    const latched = new Set();
    level.teleporters.forEach((tp, i) => {
        if (rectsOverlap(box, tp.rect)) latched.add(i);
    });
    return latched;
}

/**
 * `Teleporter.update()` (`Teleporter.as:81-100`), transcribed for every
 * teleporter in the level:
 *
 *     checkDeactivated();
 *     if (deactivated) return;
 *     if (collide("Player", x, y)) {
 *         if (!playerTouching) FP.world = new Game(to, playerPos.x, playerPos.y);
 *     } else playerTouching = false;
 *
 * Three details that a tidier paraphrase loses:
 *   - firing does NOT set `playerTouching`; only `check()` ever sets it.
 *     Harmless, because the world the entity belongs to is about to be
 *     discarded — but transcribe it rather than "fixing" it.
 *   - a deactivated teleporter returns BEFORE the else-branch, so it does
 *     not clear its own latch either.
 *   - the whole loop runs before the player moves.
 *
 * It walks `level.teleporters` directly rather than calling
 * `level.teleporterHit`, because that query answers only the middle arm.
 *
 * Returns the NEXT latch set and every teleporter that fired this tick.
 */
export function updateTeleporters(level, x, y, latched) {
    const box = playerBoxAt(x, y);
    const next = new Set(latched);
    const fired = [];
    level.teleporters.forEach((tp, i) => {
        if (tp.deactivated) return;
        if (rectsOverlap(box, tp.rect)) {
            if (!next.has(i)) fired.push({ index: i, teleporter: tp });
        } else {
            next.delete(i);
        }
    });
    return { latched: next, fired };
}

/**
 * The other half of the swap: the state the arriving player starts from.
 *
 * `Game.as:2040` builds `new Player(playerx, playery)` and the Player ctor
 * re-centres onto the tile (`Player.as:357`), so the arrival is
 * `(playerx + 8, playery + 8)` — both ints, precomputed by `levelWorld` as
 * `teleporter.arrival`. The whole entity is NEW, so velocity is zero and
 * the sticky terrain state is back at `INITIAL_TERRAIN_STATE`; the latch is
 * pre-armed for whatever the arrival overlaps. Held keys are NOT reset and
 * do not appear here at all — FlashPunk's `Input` is static, its listeners
 * live on `FP.stage`, and no teleport path calls `Input.clear()`, so a tape
 * span simply continues across the swap.
 *
 * Recorded, not deduced: `transition-west-return` arrives at (296, 168) and
 * (24, 136) and moves exactly one accel quantum on the tick after each.
 *
 * The caller supplies the already-built destination world, because building
 * one needs the injected level source (see the docblock above) — which is
 * why the swap is split across this function and `tapeRunner`'s loop.
 */
export function arriveIn(level, teleporter) {
    const { x, y } = teleporter.arrival;
    return {
        x,
        y,
        vx: 0,
        vy: 0,
        terrain: INITIAL_TERRAIN_STATE,
        // ⚠ RESET, like `terrain` and for the same reason: the arrival is a
        // WHOLE NEW `Player`, so `Player.as:67-70`'s initialisers run
        // again. `drownTimer` resets here too — it is an instance field —
        // which is the ONE thing that clears it, and it does not soften the
        // eleven-tick budget: `checkDrowning` needs eleven ticks in ONE
        // level, and a level change is a level the walk chose to leave.
        hazard: INITIAL_HAZARD_FLAGS,
        drown: { timer: 0, drowning: false },
        // ⚠ RESET, and for the same reason as `terrain` and the flags: the
        // arrival is a whole new `Player`, so `Player.as:61`'s
        // `direction:int = 3` initialiser runs again. A walk that carried
        // the facing across a door would aim the first press in the new
        // level at whatever the last corridor of the old one pointed at.
        direction: INITIAL_DIRECTION,
        latched: initialLatch(level, x, y),
        hitX: null,
        hitY: null,
    };
}

/**
 * ── THE PIT TRANSPORT (R1) ────────────────────────────────────────────
 *
 * A pit is not a floor with a speed. Standing on one starts a three-phase
 * transport that the game drives and the player cannot steer, and every
 * frame of it is a LIVE observed tick — `receiveInput = false` stops input,
 * not the tick counter, so the differential sees all of it.
 *
 *   EDGE      `Player.as:697`. Inside the state SETTER, so it fires only on
 *             a raw change (`_s != _state`) and only while `onGround`, and
 *             it reads the COERCED value — which is what makes
 *             `hazard-boot-pit` (pit coerced) and `pit-fall-83` (pit live)
 *             a contrast pair over one room and one input span.
 *             `fallInPitPos` snapshots the tile `getState` just resolved.
 *   FALL-OUT  `checkFallingInPit`, run between moveY and the world clamp.
 *             Exactly 20 ticks. Each one: `receiveInput = false` (so from
 *             the NEXT tick input is dead — the edge tick itself still runs
 *             `input()` normally), the position lerps a tenth of the way to
 *             the pit tile's centre, and alpha drops 0.05 from 1.
 *   SWAP      at `alpha <= 0`: ctor args
 *             `floor(max(fallInPitPos - Game.fallthroughOffset, 0)/16)*16`,
 *             then `FP.world = new Game(fallthroughLevel, x, y)` — the same
 *             deferred end-of-tick swap a teleporter makes, so it rides
 *             `levelRun`'s one-swap-two-callers machinery as a new arrival
 *             KIND rather than a second implementation.
 *   DESCENT   `Player.as:481-506`. The arrival is `fallFromCeiling`, and
 *             `Player.check()` — which `Game.update` runs for every entity
 *             on the new world's FIRST frame, above the `blackCover` gate —
 *             drops the player to `FP.camera.y - (height - originY)`. That
 *             camera is the one `loadlevel` just set from the player's own
 *             position, UNCLAMPED, because `view()` runs after `check()`.
 *             So the drop is always exactly 83 px and the descent is always
 *             exactly 41 ticks, in every level. Nothing else runs while
 *             falling: no getState, no friction, no input, no clamp.
 *
 * ⚠ AND THE LANDING IS THE OTHER WAY ROUND FROM THE OBVIOUS READING.
 * `if (bouncedFromCeiling || getStatePos(x, yStart) is 6/1/17)` LANDS;
 * everything else BOUNCES — once, at `v.y = -2`, for exactly 39 ticks. You
 * cannot bounce on a hole or a liquid, so an ordinary floor is the case
 * that bounces. Both are on the R1 route: 83 -> 84 lands on a PIT and does
 * not bounce (which is what chains the next fall), 84 -> 85 and 71 -> 82
 * land on Igneous Stone and do.
 *
 * ⚠ `getStatePos` is NOT routed through the coerce (verified on the `bot`
 * branch: R0's four coerce sites do not include it). So the landing check
 * reads the RAW tile type while the physics reads the coerced one — and the
 * route exercises both readings of one tile, because the `48 -> 49` fall
 * lands on ICE, which `noHazards` flattens for the physics and which the
 * landing check sees as 22 and bounces off.
 */

/** `fallAlphaSpeed` (`Player.as:345`) and the alpha it counts down from. */
export const FALL_ALPHA_SPEED = 0.05;
export const FALL_ALPHA_START = 1;

/** `const divisor:int = 10` in `checkFallingInPit`. */
export const FALL_LERP_DIVISOR = 10;

/**
 * `FP.screen.height / 2 + (height - originY)` = 80 + 3.
 *
 * `FP.screen` caches 160x160 at Engine construction (`Screen.resize()`),
 * and `Game.as:1854`'s per-level `FP.width/height` overwrite does NOT touch
 * it — so this is a constant of the BUILD, not of the level.
 */
export const DESCENT_DROP = 83;

/** `v.y += 0.1`, `v.y = Math.min(v.y, 5)`, and the bounce's `v.y = -2`. */
export const DESCENT_GRAVITY = 0.1;
export const DESCENT_MAX_FALL = 5;
export const BOUNCE_VELOCITY = -2;

/** The three raw states a descent does NOT bounce off (`Player.as:490`). */
export const NO_BOUNCE_STATES = Object.freeze([6, 1, 17]);

/**
 * `Player.getStatePos(_x:int, _y:int)` (`Player.as:670-678`) — a DIFFERENT
 * function from `getState`, and not that one with the gate left out:
 *
 *   - no intersect gate at all, so it answers for the nearest tile however
 *     far away it is;
 *   - returns -1 when the level has no tile entity at all;
 *   - the parameters are typed `int`, so the caller's `x` (a Number) is
 *     TRUNCATED on the way in;
 *   - it is not coerced.
 */
export function getStatePos(level, x, y) {
    const tile = level.nearestWalkableTile(Math.trunc(x), Math.trunc(y));
    return tile ? tile.t : -1;
}

/**
 * The ctor args `checkFallingInPit` hands `new Game(...)`, and the level it
 * hands them to. Throws when the level has no `control` block, because the
 * game's own `else` there is `die()`.
 */
export function fallDestination(level, target) {
    const ft = level.fallthrough;
    if (!ft) {
        throw new PhysicsV2Error(
            `the player fell into a pit in level ${level.level}, which has NO control `
            + 'block — `Game.fallthroughLevel` is still -1 and `checkFallingInPit` '
            + 'calls die(). That pit is lethal floor, not transport (27 of the 116 '
            + 'levels are like this, Dungeon 6 and most of Dungeon 8 among them), so '
            + 'the route must not step on it.',
        );
    }
    const snap = (v, off) => Math.floor(Math.max(v - off, 0) / TILE_SIZE) * TILE_SIZE;
    return {
        to_level: ft.level,
        ctor: { x: snap(target.x, ft.offsetX), y: snap(target.y, ft.offsetY) },
    };
}

/**
 * The arrival state for a FALL, the counterpart of `arriveIn`.
 *
 * The latch is armed at the CTOR position rather than at the dropped-to y,
 * and the order is transcribed rather than assumed: `loadlevel` adds the
 * player (`Game.as:2040`) BEFORE the teleporters (`:2169`) and
 * `World.addUpdate` PREPENDS, so the teleporters are EARLIER in the list
 * that `Game.update`'s first-frame `check()` walks — they see the player
 * where the constructor put them, and `Player.check()` moves them up
 * afterwards.
 */
export function arriveFromFall(level, ctor) {
    const x = ctor.x + TILE_SIZE / 2;
    const yStart = ctor.y + TILE_SIZE / 2;
    return {
        x,
        y: yStart - DESCENT_DROP,
        vx: 0,
        vy: 0,
        terrain: INITIAL_TERRAIN_STATE,
        // The fall arrival is a new `Player` too, AND its landing writes
        // the same value explicitly (`directionFace = -1; direction = 3`)
        // — the two agree, which is why this is one constant and not a
        // branch. `directionAfterFall()` names the second path.
        direction: directionAfterFall(),
        latched: initialLatch(level, x, yStart),
        hitX: null,
        hitY: null,
        fall: { phase: 'descent', yStart, bounced: false },
    };
}

/**
 * Advance one tick in a real level.
 *
 * `state` is `{x, y, vx, vy, terrain, latched}` and a NEW state is
 * returned, plus this tick's sweep results (`hitX`, `hitY`) which are
 * outputs rather than carried state — the AS3 caller discards them.
 *
 * When a teleporter fires, the returned state also carries
 * `transition: {from_level, to_level, teleporter, index}` — and its x/y are
 * still the OLD level's, because the old player really does complete this
 * tick's movement there. The caller applies `arriveIn` against the
 * destination world to finish the end-of-tick swap. That last doomed step
 * is never observed and never feeds the arrival (which comes from the
 * teleporter's own oel attrs), so the stream cannot tell whether it was
 * modelled; it is modelled because the game runs it.
 *
 * `opts`:
 *   `level`           a `buildLevelWorld` result (required)
 *   `noclip`          the TAPE's flag; picks the arm of the AS3's
 *                     `Bot.noclip ? null : collideTypes(...)` ternary
 *   `noHazards`       the TAPE's hazard-name set; the effects of those
 *                     terrains are coerced away (see below)
 *   `frozen`          `Game.freezeObjects`, as at v1
 *   `beforeTypeFlip`  this is the world's first live tick, so no Tile has
 *                     run its own first update yet
 */
export function step(state, held, opts = {}) {
    const {
        level, noclip = false, noHazards = [], frozen = false, beforeTypeFlip = false,
        // R2: the ids of lock/cover activators whose group is currently held,
        // so they are `type = ""` rather than solid. Owned by the RUN, not by
        // the world — it is per-tick state — and stepped AFTER this call,
        // because `World.addUpdate` prepends and `loadlevel` adds the Player
        // LAST, so the player reads the state as of the previous tick's end.
        openActivators = null,
        // R4: the two other per-VISIT state families the run owns, for the
        // same reason and with the same shape as `openActivators` — and
        // they reach BOTH queries, because a bridge and a block each change
        // what the sweep hits AND what `getState` answers.
        //
        //   `openBridges`  the ids (`"tx,ty"`) whose timer has run out: out
        //                  of the solids list, INTO the getState candidates
        //   `pushables`    id -> `{rect, removed}`, the blocks' live rects
        openBridges = null,
        pushables = null,
        // R5 slice 5: the third per-visit family. A BreakableRock whose
        // `endAnim` fired is `FP.world.remove(this)`, so unlike a bridge it
        // leaves the solids list WITHOUT joining the tiles — it reaches the
        // sweep and nothing else.
        brokenRocks = null,
        /**
         * ⛔⛔⛔ R5 SLICE 14: TWO MEMBERS OF THIS FAMILY WERE PASSED IN AND
         * SILENTLY DROPPED — for two slices and four slices respectively.
         *
         * `levelRun` has handed `stepV2` a `burnedTrees` set since slice 12
         * and a `fallenRocks` map since slice 10; `levelWorld.collidesSolid`
         * has accepted both since the same slices; `plannerBlockerAt` takes
         * both. This function destructured NEITHER, and an unlisted key in
         * an options object is not an error — it is a silence. So the one
         * mover whose collisions decide where the route actually goes could
         * not see a burned tree or a dropped rock, while every other query
         * in the file could.
         *
         * ⇒ the burn "wired end to end" in §25.4 opened the cell for the
         * PLANNER and left it solid for the PLAYER, which is a green plan
         * whose walk stalls on a wall the model says is gone. Found by
         * driving it: `r5-l37-burn`'s walk-proof leg grazed
         * `burnabletree@128,192` 1,999 times.
         *
         * ⚠ AND IT IS THE TWO-MEMBER-LIST SHAPE AGAIN
         * ([[feedback_two_member_list_one_member_read]]): `fallenRocks` came
         * along for free once the question was asked of every member instead
         * of the one the slice needed.
         */
        burnedTrees = null,
        fallenRocks = null,
        /**
         * ⛓⛓⛓ R5 SLICE 15: THE NINTH, AND THE FIRST THAT MOVES ON ITS OWN.
         *
         * Listed here as its own entry rather than folded into the block
         * above because §28.2's finding was that this exact destructuring
         * pattern loses keys silently, twice, for four slices. A crusher's
         * box is the one in this list that can change WITHOUT the player
         * having done anything, so a sweep that could not see it would walk
         * into a wall that arrived on its own — the failure mode the burn's
         * had, minus even the press to hang a suspicion on.
         */
        crushers = null,
        /**
         * ⛓⛓⛓ R5 SLICE 20: THE TENTH, AND THE ONLY ONE WHOSE DEFAULT IS
         * "NOT A SOLID".
         *
         * Named here, explicitly, for §28.2's reason and for one more: every
         * other key in this list makes a solid GO AWAY when it is present,
         * so a dropped key over-blocks and the sweep refuses a walk that was
         * legal. This one makes a solid APPEAR — a corpse the run has pushed
         * onto a button is a 16x16 wall the level never built — so a dropped
         * key UNDER-blocks and the sweep walks THROUGH a body the game stops
         * it at, byte-for-byte wrong with no refusal to hang it on.
         *
         * ⛔ It is also the only key whose absence is not neutral by
         * accident: `liveRectOf`'s turret arm never falls through to
         * `s.rect`, so leaving it out is exactly "there is no corpse".
         */
        turrets = null,
        /**
         * ⛓⛓⛓ R5 SLICE 23: THE TWELFTH, AND THE ONLY ONE WHOSE DEFAULT IS
         * "STILL A SOLID" **BY DESIGN RATHER THAN BY INHERITANCE**.
         *
         * `liveRectOf`'s boss arm falls through to `s.rect` when the run
         * says nothing, and that default is load-bearing: an unwoken
         * `BossTotem` IS `type = "Solid"` (the else of `if (activated)`),
         * so every flood and every planner query made before this family
         * existed was made against the correct world. What the key expresses
         * is the WAKE — the one event that takes the wall away.
         *
         * ⛔ So a dropped key here UNDER-BLOCKS in the opposite direction
         * from the turret's: the sweep would refuse a walk the game allows,
         * which is the SAFE failure. Named anyway, because "it fails safe"
         * is how a key stays dropped for four slices.
         */
        bosses = null,
        pulledRopes = null,
        // ⛔⛔ R5 slice 9: the SIXTH. `Chest.open()` writes `type = ""` and
        // the entity then fades for 60 more ticks, so the SOLIDITY goes
        // first and one set covers both states. In L38 that flip is the
        // only join between the room the walk arrives in and the room the
        // errand is in — a sweep that could not be told about it walks into
        // a wall the run has already opened.
        openChests = null,
        // R4: `checkDrowning` reads `canSwim` and `hasDarkSuit` off the
        // Player's statics, so the run's inventory mirror is what decides
        // whether standing on an armed hazard is survivable. Defaulted to
        // "holds neither", which is the conservative arm: every tape below
        // R4 coerces both hazards away, so the branch is dead there anyway.
        inventory = null,
        // R5 slice 4: the tape's `pins` list. The swim sound term is only
        // modellable under `pins: ["sound"]`, so the physics is told which
        // experiment it is in rather than inferring it — the same rule
        // `relax` already follows for `noclip`/`noHazards`/`grants`.
        pins = [],
        /**
         * ⛓⛓⛓ R5 SLICE 22: `Player.input()`'s first-line return, threaded.
         *
         * The run owns `frozenTimer` (an `IceTurretBlast` is its only writer
         * in the whole game) and decrements it in the player's own slot,
         * ABOVE this call, because `freezeStep()` is at `Player.as:532` —
         * above `super.update()`. See `playerPhysicsV1.step`'s note for why
         * this is not `frozen`.
         */
        inputBlocked = false,
        // ⛓ R5 slice 4: reported when an exact `nearestToPoint` tie is
        // DECIDED by the transcribed list order and its two candidates lead
        // somewhere different. Nothing here consumes it; a planner does.
        onDecidedTie = null,
    } = opts;
    if (!level || typeof level.collidesSolid !== 'function') {
        throw new PhysicsV2Error(
            'playerPhysicsV2.step needs opts.level — a buildLevelWorld result. '
            + 'The v2 rung is collision and real terrain; without geometry it would '
            + 'silently be the v1 engine under a v2 name.',
        );
    }

    // 0. Teleporters update BEFORE the player (`World.addUpdate` prepends
    //    and `loadlevel` adds the player at `Game.as:2040`, the teleporters
    //    at `:2169`), so a trigger tests the position the PREVIOUS tick
    //    left — which is exactly the position this tick starts from. The
    //    swap itself is deferred to `Engine.checkWorld` at end-of-tick, so
    //    everything below still runs in the OLD level.
    const { latched, fired } = updateTeleporters(
        level, state.x, state.y, state.latched ?? EMPTY_LATCH,
    );
    const fall = state.fall ?? null;
    let transition = null;
    // ⚠ A teleporter firing while a transport is IN FLIGHT is refused, not
    // resolved. It is the same doctrine as the two-teleporter throw and it
    // is LIVE, not defensive: level 100's exit to 101 stands ON a pit tile,
    // so both fire on the same tick there. The teleporter would win (its
    // swap lands at end of tick, the fall needs twenty more), but "would
    // win" is bookkeeping this module does not get to assume — and the R1
    // route does not cross level 100.
    if (fired.length > 0 && fall) {
        throw new PhysicsV2Error(
            `a teleporter at (${fired[0].teleporter.x},${fired[0].teleporter.y}) fired in `
            + `level ${level.level} while a pit transport was in flight (phase `
            + `"${fall.phase}"). Which world swap wins is not transcribed — route the `
            + 'tape so a trigger volume and a pit tile are never overlapped together.',
        );
    }
    if (fired.length > 1) {
        // `FP.world = ` only records a `_goto`, so two teleporters firing on
        // one tick means the LAST one in FlashPunk's update order wins — and
        // that order is the prepend order of a list this module deliberately
        // does not transcribe. An ambiguity we cannot resolve is a named
        // error, not a guess: move the fixture.
        throw new PhysicsV2Error(
            `${fired.length} teleporters fired on the same tick in level ${level.level} `
            + `(${fired.map((f) => `(${f.teleporter.x},${f.teleporter.y})->`
                + `${f.teleporter.to}`).join(', ')}). Which world swap wins depends on `
            + 'FlashPunk\'s update order, which is not transcribed — route the tape '
            + 'so that at most one trigger volume is overlapped per tick.',
        );
    }
    if (fired.length === 1) {
        const { teleporter } = fired[0];
        if (teleporter.to === level.level) {
            // The oracle cannot see this one: the game's `transitions` are
            // derived from the level field (`Bot.as` hardcodes the array),
            // and a same-level teleport changes no level. Modelling it would
            // put an entry in the JS stream that the game could never
            // report, which is a divergence created by the model.
            throw new PhysicsV2Error(
                `teleporter at (${teleporter.x},${teleporter.y}) in level `
                + `${level.level} targets its OWN level. A same-level teleport is not `
                + 'differentially observable — the game side derives its transitions '
                + 'from the level field — so it is refused rather than modelled.',
            );
        }
        transition = {
            kind: 'teleporter',
            from_level: level.level,
            to_level: teleporter.to,
            teleporter,
            index: fired[0].index,
        };
    }

    // 0b. THE DESCENT ARM. `Player.update`'s `if (fallFromCeiling)` block
    //     is an ELSE against everything below — no getState, no
    //     friction/input/move, no world clamp — so a descent tick is a
    //     ballistic y and nothing else, with x frozen at the arrival value.
    if (fall && fall.phase === 'descent') {
        if (transition) {
            throw new PhysicsV2Error(
                `a teleporter fired in level ${level.level} during a fall-from-ceiling `
                + 'descent. The descent sweeps 83 px of one column, so a trigger volume '
                + 'on that column is crossed at speed — route the fall to a different '
                + 'pit tile.',
            );
        }
        const vy = Math.min(state.vy + DESCENT_GRAVITY, DESCENT_MAX_FALL);
        let y = state.y + vy;
        let nextFall = fall;
        let nextVy = vy;
        if (y >= fall.yStart) {
            // ⚠ The polarity: pit/water/lava LAND, everything else BOUNCES.
            const landed = fall.bounced
                || NO_BOUNCE_STATES.includes(getStatePos(level, state.x, fall.yStart));
            if (landed) {
                // Note what is NOT here: `y` is left where the overshoot put
                // it (3.1 px past yStart on a 41-tick descent), because the
                // landing arm never assigns y. Only the BOUNCE arm does.
                nextVy = 0;
                nextFall = null;
            } else {
                y = fall.yStart;
                nextVy = BOUNCE_VELOCITY;
                nextFall = { ...fall, bounced: true };
            }
        }
        return {
            x: state.x,
            y,
            vx: state.vx,
            vy: nextVy,
            hitX: null,
            hitY: null,
            terrain: state.terrain ?? INITIAL_TERRAIN_STATE,
            // The transport path runs no `getState`, so nothing can change
            // the flags or the timer — carried through unchanged rather
            // than defaulted, or a fall would silently clear a stickiness
            // the game keeps.
            hazard: state.hazard ?? INITIAL_HAZARD_FLAGS,
            drown: state.drown ?? { timer: 0, drowning: false },
            // The mixer runs through a transport too — a fall is frames, and
            // frames are what the pinned clock counts.
            swim: state.swim ? stepChannel({ ...state.swim }) : null,
            // ⚠ `checkFallingInPit` holds `directionFace = 3` for the whole
            // descent, so the facing is pinned DOWN rather than derived
            // from the descent's own velocity — which is downward anyway,
            // so the two agree and the pin is what is transcribed.
            direction: directionAfterFall(),
            latched,
            fall: nextFall,
            transition: null,
        };
    }

    // 1. getState(), then the speed/friction selection it drives. Both run
    //    ahead of `super.update()` (`Player.as:508-537`), so the terrain
    //    that sets this tick's speed is the terrain under the PRE-movement
    //    position — and it runs even when frozen.
    //
    //    ⚠ TWO VALUES, and keeping them apart is the whole of `noHazards`.
    //    `terrain` is what the resolver RESOLVED and what the sticky state
    //    stores; `effective` is what the physics CONSUMES. `Player.as` does
    //    the same: `_state = _s` keeps the raw tile type (so the `_s !=
    //    _state` change gate, `lastState` and the splash comparison are
    //    byte-identical with the flag on or off) while the effect sites —
    //    the pit branch, `onIce`/`onWaterfall`/`inWater`/`inLava`,
    //    `moveSpeed` at `:715` AND at `:523`, and `checkDrowning`'s two
    //    tests at `:1420`/`:1424` — read through the coerced value.
    //
    //    Storing raw is not a detail: it is what lets the tests keep
    //    asserting the RESOLVER's own answer (level 0's spawn tile is BRICK,
    //    not Ground — a claim the observation stream cannot make) instead of
    //    asserting a value the relaxation has already flattened.
    const terrain = resolveTerrainState(
        level, state.x, state.y,
        state.terrain ?? INITIAL_TERRAIN_STATE,
        { beforeTypeFlip, noHazards, openBridges, onDecidedTie },
    );
    // The guard runs on the EFFECTIVE value, so a coerced hazard is legal
    // terrain and an un-coerced one still throws by name. Bridge (29) is not
    // in the hazard vocabulary at all and cannot be coerced: it fails at
    // BUILD time, because it cannot be sorted into a list at all.
    const effective = level.assertModelledTerrain(
        coerceTerrainState(terrain, noHazards),
    );

    // 1b. THE PIT EDGE, inside the state setter (`Player.as:690-706`).
    //     Guarded by the RAW change gate — `_s != _state`, so re-resolving
    //     the same pit tile does not re-arm it — and by `onGround`, which
    //     `Enemies/LavaTrap.as:61/66` is the only writer of anywhere in the
    //     codebase, so it is constant true everywhere R1 goes. The test is
    //     on the COERCED value, which is the whole of `noHazards`: with pit
    //     in the set this branch is dead and the same tape merely walks.
    const prevTerrain = state.terrain ?? INITIAL_TERRAIN_STATE;

    // 1c. THE FOUR HAZARD FLAGS, in the SAME setter and under the SAME two
    //     gates as the pit edge: a RAW change, while `onGround`. They are
    //     assigned together with it in `Player.as`'s `set state`, so they
    //     are assigned together here — separating them would let a future
    //     edit move one without the other, and the whole difficulty of
    //     these flags is that they are STATE rather than a lookup.
    const prevFlags = state.hazard ?? INITIAL_HAZARD_FLAGS;
    const flags = terrain !== prevTerrain ? hazardFlagsFor(effective) : prevFlags;

    let nextFall = fall;
    if (!fall && terrain !== prevTerrain && effective === PIT_STATE) {
        // `fallInPitPos = new Point(tile_test.x, tile_test.y)` where
        // `tile_test` is `nearestToPoint("Tile", x, y + checkOffsetY)` —
        // byte-identical probe args to `getState`'s own, so it is always the
        // tile that was just resolved, and a Tile's position IS its centre.
        const tile = level.nearestWalkableTile(
            state.x, state.y + CHECK_OFFSET_Y, { beforeTypeFlip },
        );
        nextFall = { phase: 'out', target: { x: tile.x, y: tile.y }, alpha: FALL_ALPHA_START };
    }

    // 2-4. The v1 tick, unchanged, with the collision arm of the ternary
    //      selected. `world` is the LEVEL's pixel size, which is what
    //      `Game.as:1854-1855` writes into FP.width/height on every load.
    //
    //      ⚠ INPUT IS REFUSED ONLY IF A FALL WAS ALREADY IN FLIGHT WHEN THE
    //      TICK STARTED. `receiveInput = false` is set inside
    //      `checkFallingInPit`, which runs AFTER `super.update()` — so the
    //      tick the edge fires still runs `input()` normally. Killing input
    //      on the edge tick diverges on the first tick of every fall.
    // 1d. `checkDrowning()` runs BEFORE the friction/speed selection
    //     (`Player.as:512`), and `drown()` writes `v` directly — so the
    //     thrash is then subject to this tick's friction and sweeps like
    //     any other velocity.
    const heldItems = inventory ?? { canSwim: false, hasDarkSuit: false };
    let drown = state.drown ?? { timer: 0, drowning: false };
    let drownV = null;
    drown = checkDrowning(drown, effective, heldItems);
    if (drown.drowning) {
        const spun = drownStep(drown);
        drown = spun.drown;
        drownV = spun.v;
        if (spun.dead) {
            throw new PhysicsV2Error(
                `the player DROWNED in level ${level.level} at `
                + `(${state.x}, ${state.y}) — terrain state ${effective}. `
                + 'An armed hazard is PLANNER-FORBIDDEN FLOOR (the pit precedent): '
                + '`drownTimer` is never reset off-hazard, so eleven cumulative ticks '
                + 'on water without canSwim (the conch, R5) or lava without the dark '
                + 'suit ends the run. Re-route, or coerce the hazard in `noHazards`.',
            );
        }
    }

    // 2. ⛓ THE SWIM SOUND TERM (R5 slice 4), and the mixer that drives it.
    //
    //    `Player.as:530-534` is TWO lines and both of them matter:
    //
    //        moveSpeed = moveSpeeds[state] + 0.25 * int(soundPosition("Swim") < 0.1);
    //        if (v.length > 0 && !soundIsPlaying("Swim")) playSound("Swim");
    //
    //    ⚠ THE ORDER IS STEP, READ, THEN PLAY, and it is not a choice.
    //    `Music.pinStep` is called from `Bot.update`, at the top of
    //    `Main.update`; `Player.update` runs inside `World.update`. So the
    //    read sees a channel the frame has already advanced, and the replay
    //    lands after it — which is exactly why the FIRST stroke after a
    //    pause is boosted.
    //
    //    ⛔ AND A COMPLETED, UN-REPLAYED CHANNEL READS ZERO, SO THE BOOST
    //    LATCHES. `Sfx.onComplete` nulls the channel and zeroes `_position`,
    //    and `soundPosition` divides that by 1000 — so a swim sound that
    //    finished and was not replayed reports 0, which is `< 0.1`, which is
    //    a boost, indefinitely. `Player.as:531` only replays while
    //    `v.length > 0`, so that is precisely the state a swimmer who stops
    //    moving ends up in. The swim boost is NOT "six ticks in every 47"
    //    for a stop-start swim, and a leg priced as though it were would
    //    under-run its target. (§14.3 — found by writing the opposite
    //    expectation into a test and being wrong.)
    //
    //    ⚠ `v.length` is the velocity at the TOP of `Player.update`, i.e.
    //    what the PREVIOUS tick's move left — `super.update()` has not run
    //    yet — so it is `state`'s, not `next`'s.
    const wet = flags.inWater || flags.inLava;
    let swim = state.swim ?? null;
    if (wet && !pins.includes('sound')) {
        // ⛔ REFUSED, NOT DEFAULTED TO ZERO. Without the pin the term reads
        // a wall clock and is not reproducible at all: slice 2 ran one tape
        // at 0.4 fps and 10.1 fps and the streams parted four ticks after
        // the water edge. A model that quietly used 0 there would agree with
        // whichever recording it happened to be compared against and
        // disagree with the next one.
        throw new PhysicsV2Error(
            `the player entered ${flags.inLava ? 'Lava' : 'Water'} in level `
            + `${level.level} at (${state.x}, ${state.y}) on a tape that does not pin `
            + '"sound". `Player.as:530` adds `0.25 * int(Music.soundPosition("Swim") < '
            + '0.1)` to the swim speed, and unpinned that position is the Web Audio '
            + 'mixer\'s WALL CLOCK — measured diverging at tick 52 between a 0.4 fps and '
            + 'a 10.1 fps run of one tape. Add "sound" to the tape\'s `pins`, or coerce '
            + 'the hazard in `noHazards`.',
        );
    }
    if (wet && !swim) swim = createPinnedChannel(SWIM_LENGTH_FRAMES);
    // The mixer does not stop for a dry tick, a frozen one or a room fade —
    // so the channel steps whenever it exists, not only while swimming.
    if (swim) swim = stepChannel({ ...swim });
    const swimBurst = wet ? swimSpeedBonus(swim) : 0;
    const { friction, moveSpeed } = speedFrictionFor(
        flags, terrain, effective, MOVE_SPEEDS, swimBurst,
    );

    // `Player.as:531`'s replay — READ FIRST (above), then play. Gated on
    // the incoming velocity, and only inside the wet arm, because that is
    // where the call site is.
    if (wet && swim && !channelPlaying(swim)
        && Math.hypot(state.vx ?? 0, state.vy ?? 0) > 0) {
        swim = playChannel({ ...swim });
    }

    const next = stepV1({ ...state, ...(drownV ? { vx: drownV.x, vy: drownV.y } : {}) },
        fall ? NO_KEYS : held, {
        terrainStateAt: () => effective,
        frozen,
        // ⛔ A DESCENT ALREADY DROPS THE KEYS (`fall ? NO_KEYS : held` above)
        // and is a different arm of `Player.update` entirely; the OR here is
        // the source's own — `!receiveInput || frozenTimer > 0 ||
        // fallFromCeiling` — with the run supplying the middle term.
        inputBlocked,
        friction,
        moveSpeed,
        // `Player.input()`'s last act. The feather exempts UPWARD motion
        // only — `!hasFeather || v.y >= 0` — so a feather-holding player
        // still gets pushed while falling or standing.
        postInput: flags.onWaterfall
            ? (v) => ((!heldItems.hasFeather || v.y >= 0)
                ? { x: v.x, y: v.y + WATERFALL_ACCELERATION } : v)
            : null,
        world: level.world,
        collides: noclip
            ? null
            : (x, y) => level.collidesSolid(playerBoxAt(x, y),
                { beforeTypeFlip, openActivators, openBridges, pushables, brokenRocks,
                    burnedTrees, fallenRocks, crushers, turrets, bosses, pulledRopes,
                    openChests }),
        // `checkFallingInPit()` sits between moveY and the world clamp.
        afterMove: nextFall ? (x, y) => ({
            x: x + (Math.floor(nextFall.target.x / TILE_SIZE) * TILE_SIZE
                + TILE_SIZE / 2 - x) / FALL_LERP_DIVISOR,
            y: y + (Math.floor(nextFall.target.y / TILE_SIZE) * TILE_SIZE
                + TILE_SIZE / 2 - y) / FALL_LERP_DIVISOR,
        }) : null,
    });

    if (nextFall) {
        // The alpha countdown, as REPEATED SUBTRACTION. Twenty subtractions
        // of 0.05 from 1.0 land on -3.191891195797325e-16 — just below zero,
        // so the swap is on tick 20. Computing the count as 1/0.05, or
        // accumulating the other way, can land a hair ABOVE zero and give
        // 21, and the recording says 20.
        const alpha = nextFall.alpha - FALL_ALPHA_SPEED;
        if (alpha <= 0) {
            const dest = fallDestination(level, nextFall.target);
            transition = {
                kind: 'fall',
                from_level: level.level,
                to_level: dest.to_level,
                ctor: dest.ctor,
            };
            nextFall = null;
        } else {
            nextFall = { ...nextFall, alpha };
        }
    }

    return {
        ...next,
        terrain,
        hazard: flags,
        drown,
        swim,
        latched,
        transition,
        fall: nextFall,
        // `sprites()` runs AFTER `super.update()`, so it reads THIS tick's
        // post-move velocity — and the value it leaves is what the NEXT
        // tick's press will capture as `spearDirection`.
        direction: nextDirection(
            state.direction ?? INITIAL_DIRECTION, next.vx, next.vy,
        ),
    };
}
