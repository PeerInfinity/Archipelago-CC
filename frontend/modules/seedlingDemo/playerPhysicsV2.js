/**
 * seedlingDemo/playerPhysicsV2 — the v1 tick with the sweeps RE-ARMED and
 * the terrain probe made stateful.
 *
 * v2 slice 2 of the real-game bot ladder. Brief:
 * `CC/docs/plans/seedling-bot-v2-opus-kickoff.md` §3.2. This is an
 * EXTENSION of `playerPhysicsV1`, not a fork: the sweep loop, the friction,
 * the input overshoot, the update order and the world clamp are all still
 * that module's, because the AS3 has one `Player.update` and one
 * `moveX`/`moveY` pair. What lives here is exactly the two things v1 could
 * not express:
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
 *   - slice 3 crosses levels, and the runner must be able to build a world
 *     for a level nobody named at call time (a teleporter's `to`);
 *   - `buildLevelWorld` throws loudly on geometry v2 does not model, and
 *     that throw should fire when the level is actually ENTERED, naming the
 *     level the run walked into, rather than eagerly for all 116.
 * The runner memoises the worlds it builds, so the record source is asked
 * once per level per run.
 *
 * ── Loud seams, not quiet approximations ──────────────────────────────
 * Unmodelled terrain (water, pit, lava, ice, waterfall), pixelmask
 * colliders and — until slice 3 — room transitions all THROW with the thing
 * named. v1's lesson was that every divergence came from a description
 * tidier than the code, so a fixture that strays dies loudly instead of
 * producing a plausible stream that the differential then blames on
 * physics.
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
 * Thrown when a tape walks into a live teleporter. Room transitions are
 * slice 3; modelling them means the world swap, the arrival offset, the
 * anti-ping-pong latch and the `transitions` records, and half of that
 * silently would be worse than none of it.
 */
export class TransitionNotModelledError extends PhysicsV2Error {
    constructor(message) {
        super(message);
        this.name = 'TransitionNotModelledError';
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
 * Advance one tick in a real level.
 *
 * `state` is `{x, y, vx, vy, terrain}` and a NEW state is returned, plus
 * this tick's sweep results (`hitX`, `hitY`) which are outputs rather than
 * carried state — the AS3 caller discards them.
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

    // Teleporters update BEFORE the player (`World.addUpdate` prepends and
    // `loadlevel` adds the player at `Game.as:2040`, the teleporters at
    // `:2169`), so a trigger tests the position the PREVIOUS tick left —
    // which is exactly the position this tick starts from.
    //
    // Slice 3 replaces this throw with the modelled swap. Until then the
    // seam is deliberately blunt: it fires on ANY overlap, including the
    // one case the real game suppresses (arriving ON a teleporter
    // pre-latches it, `Teleporter.as:58-65`). That can only over-throw, and
    // an over-throw names the fixture to move while an under-throw is a
    // divergence nobody sees.
    const standing = level.teleporterHit(playerBoxAt(state.x, state.y));
    if (standing.length > 0) {
        const tp = standing[0];
        throw new TransitionNotModelledError(
            `unmodelled room transition: the player overlaps a live teleporter at `
            + `(${tp.x},${tp.y}) in level ${level.level}, bound for level ${tp.to} at `
            + `(${tp.arrival.x},${tp.arrival.y}). Room transitions are slice 3 of the v2 `
            + 'ladder — the world swap, the arrival offset, the anti-ping-pong latch and '
            + 'the `transitions` records land together or not at all.',
        );
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

    return { ...next, terrain };
}
