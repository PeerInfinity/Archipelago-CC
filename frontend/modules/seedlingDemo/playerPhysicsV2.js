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

import { rectsOverlap } from './levelWorld.js';
import {
    CHECK_OFFSET_Y,
    HITBOX,
    step as stepV1,
} from './playerPhysicsV1.js';

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
export function resolveTerrainState(level, x, y, prevState, { beforeTypeFlip = false } = {}) {
    const tile = level.nearestWalkableTile(x, y + CHECK_OFFSET_Y, { beforeTypeFlip });
    if (!tile) return prevState;
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
        latched: initialLatch(level, x, y),
        hitX: null,
        hitY: null,
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
 *   `frozen`          `Game.freezeObjects`, as at v1
 *   `beforeTypeFlip`  this is the world's first live tick, so no Tile has
 *                     run its own first update yet
 */
export function step(state, held, opts = {}) {
    const {
        level, noclip = false, frozen = false, beforeTypeFlip = false,
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
    let transition = null;
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
            from_level: level.level,
            to_level: teleporter.to,
            teleporter,
            index: fired[0].index,
        };
    }

    // 1. getState(), then the speed/friction selection it drives. Both run
    //    ahead of `super.update()` (`Player.as:508-537`), so the terrain
    //    that sets this tick's speed is the terrain under the PRE-movement
    //    position — and it runs even when frozen.
    const terrain = level.assertModelledTerrain(resolveTerrainState(
        level, state.x, state.y,
        state.terrain ?? INITIAL_TERRAIN_STATE,
        { beforeTypeFlip },
    ));

    // 2-4. The v1 tick, unchanged, with the collision arm of the ternary
    //      selected. `world` is the LEVEL's pixel size, which is what
    //      `Game.as:1854-1855` writes into FP.width/height on every load.
    const next = stepV1(state, held, {
        terrainStateAt: () => terrain,
        frozen,
        world: level.world,
        collides: noclip
            ? null
            : (x, y) => level.collidesSolid(playerBoxAt(x, y), { beforeTypeFlip }),
    });

    return { ...next, terrain, latched, transition };
}
