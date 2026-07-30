/**
 * seedlingDemo/playerPhysicsV1 — a LITERAL transcription of Seedling's
 * per-tick player movement, at the v1 rung (collision disabled).
 *
 * This is a transcription, not a model. Every constant, every branch, and
 * every order-of-operations detail below is here because the AS3 does it
 * that way, and the differential harness compares this module's output to
 * the recompiled game's byte for byte. **Faithfulness outranks
 * cleanliness**: where the original is odd, keep the oddity and comment
 * why. Two of those oddities are load-bearing and were mis-described in
 * the original design brief — see `input()` and `moveAxis()` below.
 *
 * Sources (fork `PeerInfinity/Seedling`, `~/CC/seedling`):
 *   `src/Mobile.as`  — friction(), mobileUpdate() order, the constants
 *   `src/Player.as`  — input(), update() order, moveX/moveY OVERRIDES,
 *                      the speed table, the world clamp
 *   `src/net/flashpunk/FP.as:142`     — sign()
 *   `src/net/flashpunk/Entity.as:27`  — x/y are Number, not int
 * and, for the exact float semantics the recompiled runtime gives
 * `flash.geom.Point`:
 *   `SWFModernRuntime/src/avm2/avm2_globals.c:888-909`
 *
 * ── What v1 does NOT do ───────────────────────────────────────────────
 * No collision. `Player.moveX/moveY` sweep 1px at a time and consult
 * `collideTypes(solids, ...)`; the v1 bot build sets a `Bot.noclip` flag
 * that skips exactly that consultation. Re-arming it is the v2 rung, and
 * the loop structure here is preserved precisely so that v2 is a small
 * diff rather than a rewrite.
 *
 * Dependency-free, no RNG, no clock, no DOM — one `step()` call is one
 * fixed physics tick. (Seedling runs FlashPunk's variable-timestep loop,
 * but `FP.elapsed` appears in ZERO lines of game code: all Player/Mobile
 * physics is per-frame constants, which is what makes a tick-indexed
 * tape deterministic at all.)
 */

// ── Constants, straight from the source ───────────────────────────────

/** `Mobile.as:14-15`. */
export const DEFAULT_FRICTION = 0.25;
export const WATER_FRICTION = 0.5;

/** `Player.as:65, 73-80`. */
export const WALK_SPEED = 0.8;          // dMS
export const STAIR_SPEED = 0.4;         // dMSstair
export const WATER_SPEED = 0.45;        // dMSwater
export const SLIDING_SPEED = 1;         // slidingSpeed (ice)
export const SLIDING_FRICTION = 0.025;  // slidingFriction (ice)

/**
 * `Player.as:86-89` — `moveSpeeds`, indexed by the terrain `state` that
 * `getState()` reads off the tile under the player. 38 entries; only
 * indices 1, 10, 17, 25, 30 differ from the walk speed.
 *
 * Transcribed in full rather than collapsed to "0.8 unless special",
 * because the SELECTION STRUCTURE is what v2/v3 will exercise and a
 * table is checkable against the source at a glance.
 */
export const MOVE_SPEEDS = Object.freeze([
    /*  0 */ WALK_SPEED,
    /*  1 */ WATER_SPEED,       // water
    /*  2.. 9 */ WALK_SPEED, WALK_SPEED, WALK_SPEED, WALK_SPEED,
    WALK_SPEED, WALK_SPEED, WALK_SPEED, WALK_SPEED,
    /* 10 */ STAIR_SPEED,       // stairs
    /* 11..16 */ WALK_SPEED, WALK_SPEED, WALK_SPEED, WALK_SPEED, WALK_SPEED, WALK_SPEED,
    /* 17 */ WATER_SPEED,       // deep water
    /* 18..24 */ WALK_SPEED, WALK_SPEED, WALK_SPEED, WALK_SPEED, WALK_SPEED,
    WALK_SPEED, WALK_SPEED,
    /* 25 */ WATER_SPEED / 2,   // lava
    /* 26..29 */ WALK_SPEED, WALK_SPEED, WALK_SPEED, WALK_SPEED,
    /* 30 */ STAIR_SPEED,       // stairs (dark)
    /* 31..37 */ WALK_SPEED, WALK_SPEED, WALK_SPEED, WALK_SPEED, WALK_SPEED,
    WALK_SPEED, WALK_SPEED,
]);

/**
 * Hitbox + world bounds for the clamp at the end of `Player.update`
 * (`Player.as:560-561`):
 *   x = min(max(x, originX), FP.width  + originX - width)
 *   y = min(max(y, originY), FP.height + originY - height)
 * `normalHitbox = Rectangle(2, 2, 4, 5)` → `setHitbox(4, 5, 2, 2)`
 * (`Player.as:295, 414`).
 */
export const HITBOX = Object.freeze({ width: 4, height: 5, originX: 2, originY: 2 });

/** `Scenery/Tile.as:22-23`. */
export const TILE = Object.freeze({ w: 16, h: 16 });

/**
 * ⚠ The player entity does NOT spawn at the coordinates `new Game(level,
 * x, y)` is given. `Player`'s constructor re-centres onto the tile
 * (`Player.as:357`):
 *     super(_x + Tile.w / 2, _y + Tile.h / 2);
 * so `new Game(0, 80, 128)` puts `player.x/.y` at (88, 136).
 *
 * Found by the differential against the real game, which is exactly the
 * arrangement working as intended: a tape's `boot` block carries the GAME
 * CONSTRUCTOR arguments (what a human authoring a tape thinks in, and
 * what the teleport machinery already speaks), and this offset is applied
 * on top — transcribed, not baked into the fixtures.
 *
 * (`Game.as:2034-2037` can override the spawn entirely from a `<player>`
 * object in the level file. Level 0's OverWorld.oel has none, so the
 * constructor args stand; a v2 level that has one will need the level's
 * own value.)
 */
export const SPAWN_OFFSET = Object.freeze({ x: TILE.w / 2, y: TILE.h / 2 });

/** Entity spawn position for a `new Game(level, x, y)` boot block. */
export function spawnFromBoot(boot) {
    return { x: boot.x + SPAWN_OFFSET.x, y: boot.y + SPAWN_OFFSET.y };
}

/**
 * ⚠ `FP.width`/`FP.height` are NOT the 160x160 screen size from
 * `Main.as:36`. The level loader OVERWRITES them from the level file on
 * every load — `Game.as:1854-1855`:
 *     FP.width = xml.width; FP.height = xml.height;
 * so they are the LEVEL's pixel dimensions, and the clamp is per-level.
 * Level 0 (`assets/levels/OverWorld.oel`) is 320x320, giving bounds of
 * x ∈ [2, 318], y ∈ [2, 317] — not the [2, 158] the 160 screen size
 * would suggest.
 *
 * This is exactly the kind of thing a "transcribe the constant" shortcut
 * gets wrong: the 160 is real, it is just not what the clamp reads.
 */
export const LEVEL0_WORLD = Object.freeze({ width: 320, height: 320 });

/** Clamp bounds for a world of the given pixel dimensions. */
export function clampFor(world) {
    return {
        minX: HITBOX.originX,
        maxX: world.width + HITBOX.originX - HITBOX.width,
        minY: HITBOX.originY,
        maxY: world.height + HITBOX.originY - HITBOX.height,
    };
}

/** Bounds for the v1 level. */
export const CLAMP = Object.freeze(clampFor(LEVEL0_WORLD));

/**
 * `Player.as:416` — `checkOffsetY = -originY + height - 2`, the vertical
 * offset at which the terrain state is sampled. With the normal hitbox
 * that is `-2 + 5 - 2 = 1`.
 */
export const CHECK_OFFSET_Y = -HITBOX.originY + HITBOX.height - 2;

// ── flash.geom.Point semantics ────────────────────────────────────────

/** `Point.length` — `sqrt(x*x + y*y)` in doubles. */
export function pointLength(vx, vy) {
    return Math.sqrt(vx * vx + vy * vy);
}

/**
 * `Point.normalize(thickness)`, transcribed from the recompiled runtime
 * (`avm2_globals.c:895-909`), including its guard:
 *   AS3 `if (length)` truthiness skips on BOTH 0 and NaN.
 * Returns a new {x, y}; leaves the point untouched when the guard fails,
 * which is why `normalize()` on a zero vector cannot produce NaN.
 */
export function pointNormalize(vx, vy, thickness) {
    const length = pointLength(vx, vy);
    if (length !== 0 && !Number.isNaN(length)) {
        const norm = thickness / length;
        return { x: vx * norm, y: vy * norm };
    }
    return { x: vx, y: vy };
}

/** `FP.sign` (`FP.as:142`) — note it returns 0 for 0, not 1. */
export function sign(value) {
    return value < 0 ? -1 : (value > 0 ? 1 : 0);
}

// ── The three per-tick operations ─────────────────────────────────────

/**
 * `Mobile.friction()` (`Mobile.as:73-84`).
 *
 * VECTOR-LENGTH friction: it shortens the velocity VECTOR by `f`, then
 * snaps either component to 0 once it is under 0.05. This is why
 * diagonals are faster than axis-aligned movement — both axes accelerate
 * independently but only one friction quantum is removed from the
 * combined length. **A port that damps per-axis diverges immediately.**
 */
export function applyFriction(v, f) {
    const shortened = pointNormalize(v.x, v.y, Math.max(pointLength(v.x, v.y) - f, 0));
    let { x, y } = shortened;
    if (Math.abs(x) < 0.05) x = 0;
    if (Math.abs(y) < 0.05) y = 0;
    return { x, y };
}

/**
 * `Player.input()` (`Player.as:1479-1537`), movement portion.
 *
 * ⚠ THE ODDITY THAT MATTERS. Each branch is
 *     if (v.x < moveSpeed) v.x += accel;      // accel === moveSpeed
 * — a THRESHOLD TEST followed by a FULL-MAGNITUDE ADD. It is *not* a
 * clamp to `moveSpeed`, and velocity is *not* binary per axis. Because
 * friction removes only 0.25 per tick while the add is 0.8, velocity
 * overshoots and settles into a limit cycle. Holding RIGHT from rest on
 * level-0 ground gives:
 *     t=0 0.80 | t=1 1.35 | t=2 1.10 | t=3 0.85 | t=4 1.40 | t=5 1.15 ...
 * a ~3-tick cycle whose envelope drifts upward — peak velocity is nearly
 * 2x `moveSpeed`. The original design brief described this as "one held
 * frame saturates the axis, velocity is effectively binary"; a
 * transcription written to that description diverges from the game on
 * tick 1. Do not "tidy" these branches into a clamp.
 *
 * Branch ORDER is preserved (up, right, down, left) because opposite
 * keys held together both fire — they are four independent `if`s, not an
 * else-chain — and the threshold each one tests sees the previous one's
 * write.
 */
export function applyInput(v, held, moveSpeed) {
    let { x, y } = v;
    const accel = moveSpeed;
    if (held.has('up') && y > -moveSpeed) y -= accel;       // keys[1]
    if (held.has('right') && x < moveSpeed) x += accel;     // keys[0]
    if (held.has('down') && y < moveSpeed) y += accel;      // keys[3]
    if (held.has('left') && x > -moveSpeed) x -= accel;     // keys[2]
    return { x, y };
}

/**
 * `Player.moveX` / `Player.moveY` (`Player.as:1687` / `:1717`) with
 * collision skipped — the v1 noclip path.
 *
 * ⚠ `Player` OVERRIDES `Mobile.moveX/moveY`; the base-class versions are
 * dead for the player. (The overrides also carry a shield branch whose
 * `collideTypes` call is commented out, so `c_s` is unconditionally null
 * and the live condition is just `!c` — which noclip makes always true.)
 *
 * The loop is kept rather than collapsed to `pos + rel`. The two are
 * algebraically identical with collision off, and a 60-tick check found
 * no float divergence between them — but keeping the shape costs nothing,
 * makes v2 a small diff, and means the step sequence is inspectable.
 * Note `for (i:int = 0; i < Math.abs(rel); i++)` with a fractional bound:
 * a |rel| of 1.35 runs TWO iterations (+1, then +0.35), which is the
 * common case given the velocities above.
 */
export function moveAxis(pos, rel) {
    let p = pos;
    const magnitude = Math.abs(rel);
    const s = sign(rel);
    for (let i = 0; i < magnitude; i++) {
        p += Math.min(1, magnitude - i) * s;
    }
    return p;
}

// ── One tick ──────────────────────────────────────────────────────────

/**
 * The default terrain probe for v1: everything is plain ground (state 0).
 *
 * ⚠ Noclip does NOT bypass terrain typing. `getState()` (`Player.as:656`)
 * runs every tick from `Player.update`, reads the nearest Tile under
 * `(x, y + CHECK_OFFSET_Y)` and assigns `state`, and `moveSpeed` is
 * selected from it — collision has nothing to do with it. So a tape that
 * wanders onto water or stairs really does change speed in the game.
 *
 * This is a SEAM, not a constant, on purpose: with it stubbed to ground
 * and v1 fixture tapes kept on open ground, a tape that strays produces a
 * loud differential mismatch (JS 0.8 vs game 0.45) instead of the
 * assumption hiding inside a hardcoded number. v2/v3 replace the stub
 * with the real level tilemap.
 */
export const groundTerrain = () => 0;

/**
 * Advance one tick. `state` is `{ x, y, vx, vy }`; returns a NEW state.
 *
 * Order transcribed from `Player.update` (`Player.as:458-563`) restricted
 * to what v1 exercises (no ice, no water, no ceiling-fall, no combat, and
 * `receiveInput` true):
 *
 *   1. getState()                        → terrain state
 *   2. f / moveSpeed selection           (`:516-537`)
 *   3. super.update() → mobileUpdate()   (`Mobile.as:31-45`):
 *        friction(); input(); moveX(v.x); moveY(v.y)
 *      — note X is fully resolved BEFORE Y, which matters from v2 on
 *   4. clamp to world bounds             (`:560-561`)
 *
 * `opts.terrainStateAt(x, y)` overrides the terrain probe;
 * `opts.world` gives the level's pixel dimensions for the clamp (default
 * level 0's 320x320 — see LEVEL0_WORLD, and note these are NOT the screen
 * size); `opts.frozen` mirrors `Game.freezeObjects`, which gates the whole
 * friction/input/move block in `mobileUpdate` — a frozen tick moves
 * nothing, which is why the bot must not let one consume tape.
 */
export function step(state, held, opts = {}) {
    const {
        terrainStateAt = groundTerrain, frozen = false, world = LEVEL0_WORLD,
    } = opts;
    const clamp = world === LEVEL0_WORLD ? CLAMP : clampFor(world);

    let x = state.x;
    let y = state.y;
    let v = { x: state.vx, y: state.vy };

    // 1-2. Terrain state selects friction and speed for THIS tick.
    const terrain = terrainStateAt(x, y + CHECK_OFFSET_Y);
    const moveSpeed = MOVE_SPEEDS[terrain];
    if (moveSpeed === undefined) {
        throw new RangeError(
            `terrainStateAt returned state ${terrain}, which is outside the `
            + `moveSpeeds table (0..${MOVE_SPEEDS.length - 1})`,
        );
    }
    // v1 is dry land: `f = DEFAULT_FRICTION` (`Player.as:534`). Water/ice
    // select WATER_FRICTION / SLIDING_FRICTION — v2+ territory.
    const f = DEFAULT_FRICTION;

    // 3. mobileUpdate(), gated by Game.freezeObjects.
    if (!frozen) {
        v = applyFriction(v, f);
        v = applyInput(v, held, moveSpeed);
        x = moveAxis(x, v.x);
        y = moveAxis(y, v.y);
    }

    // 4. The hard clamp is part of the tick, not a safety net.
    x = Math.min(Math.max(x, clamp.minX), clamp.maxX);
    y = Math.min(Math.max(y, clamp.minY), clamp.maxY);

    return { x, y, vx: v.x, vy: v.y };
}
