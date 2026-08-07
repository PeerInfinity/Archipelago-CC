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
 * ── The name is a rung, not a fork ────────────────────────────────────
 * `Player.moveX/moveY` sweep 1px at a time and consult
 * `collideTypes(solids, ...)`; the bot build sets a `Bot.noclip` flag that
 * skips exactly that consultation, and v1 ran every tape with it set. v2
 * re-armed it — as an `opts.collides` seam on the SAME sweep loop and the
 * SAME `step()`, because the AS3 has one loop and one update order too.
 * The v2-specific parts (the level geometry, and the stateful `getState`
 * that replaced v1's pure `terrainStateAt` probe) live in
 * `playerPhysicsV2.js`; everything below is shared by both rungs. The file
 * keeps its name so the v1 oracle recordings keep pointing at the module
 * whose transcription they validated.
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
 *
 * The labels are `TILE_TYPE_NAMES` (`flashPanel/seedlingSemantics.js`).
 * Three of them were wrong at v1 and are corrected here (the VALUES were
 * always right — `playerPhysicsV1.test.js` pins them against the AS3):
 * index 17 is Lava, not "deep water"; index 25 is Waterfall, not "lava";
 * index 30 is Ghost Tile Step, not "stairs (dark)".
 */
export const MOVE_SPEEDS = Object.freeze([
    /*  0 */ WALK_SPEED,
    /*  1 */ WATER_SPEED,       // Water
    /*  2.. 9 */ WALK_SPEED, WALK_SPEED, WALK_SPEED, WALK_SPEED,
    WALK_SPEED, WALK_SPEED, WALK_SPEED, WALK_SPEED,
    /* 10 */ STAIR_SPEED,       // Cliff Stairs
    /* 11..16 */ WALK_SPEED, WALK_SPEED, WALK_SPEED, WALK_SPEED, WALK_SPEED, WALK_SPEED,
    /* 17 */ WATER_SPEED,       // Lava
    /* 18..24 */ WALK_SPEED, WALK_SPEED, WALK_SPEED, WALK_SPEED, WALK_SPEED,
    WALK_SPEED, WALK_SPEED,
    /* 25 */ WATER_SPEED / 2,   // Waterfall
    /* 26..29 */ WALK_SPEED, WALK_SPEED, WALK_SPEED, WALK_SPEED,
    /* 30 */ STAIR_SPEED,       // Ghost Tile Step
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
 * `Player.moveX` / `Player.moveY` (`Player.as:1687` / `:1717`) — ONE loop,
 * used by both rungs, because the AS3 has one loop too.
 *
 * ⚠ `Player` OVERRIDES `Mobile.moveX/moveY`; the base-class versions are
 * dead for the player. (The overrides also carry a shield branch whose
 * `collideTypes` call is commented out, so `c_s` is unconditionally null
 * and the live condition is just `!c`.)
 *
 * `collideAt` IS the AS3's per-step test, verbatim:
 *     var c:Entity = Bot.noclip ? null : collideTypes(solids, x + d, y);
 * — pass `null` for the v1 noclip path, or a probe that returns the
 * blocking entity (or null) for the v2 collision path. Two properties of
 * the hit branch are load-bearing and are the whole reason the loop shape
 * was preserved at v1:
 *   - the loop RETURNS, so the position stays at the LAST FREE STEP, which
 *     is wherever the fractional approach left it — mid-pixel, not on a
 *     tile edge and not on an integer;
 *   - `Mobile.as:39-40` DISCARDS the returned entity and never touches
 *     `v`, so velocity is NOT zeroed on contact. Pressing into a wall is a
 *     stable, oracle-observable state: the position pins while the limit
 *     cycle keeps running in `v`.
 *
 * Note `for (i:int = 0; i < Math.abs(rel); i++)` with a fractional bound:
 * a |rel| of 1.35 runs TWO iterations (+1, then +0.35), and a |rel| of
 * 0.8 runs ONE (a sub-pixel step). Both are common given the velocities
 * above; a recon pass that claimed sub-pixel `rel` skips the loop entirely
 * was wrong, and the recorded mid-pixel stop at y = 130.5 is the proof.
 *
 * Returns `{pos, hit}`. The AS3 caller discards `hit`; it is surfaced here
 * because the pathing driver needs to tell "walked the whole way" from
 * "stopped early", and a planner that cannot is one that re-plans silently.
 */
export function sweepAxis(pos, rel, collideAt = null) {
    let p = pos;
    const magnitude = Math.abs(rel);
    const s = sign(rel);
    for (let i = 0; i < magnitude; i++) {
        const d = Math.min(1, magnitude - i) * s;
        const c = collideAt ? collideAt(p + d) : null;
        if (c) return { pos: p, hit: c };
        p += d;
    }
    return { pos: p, hit: null };
}

/** The noclip sweep — `sweepAxis` with the collision test skipped. */
export function moveAxis(pos, rel) {
    return sweepAxis(pos, rel).pos;
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
 * assumption hiding inside a hardcoded number.
 *
 * v2 replaced the SEAM as well as the stub: `getState` is sticky, so a
 * pure `(x, y) => t` cannot express it. `playerPhysicsV2.resolveTerrainState`
 * is the transcription; this stub stays because the v1 tapes' byte-identical
 * streams are the regression net for that refactor, and re-terraining them
 * would move the goalposts along with the code.
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
 *
 * `opts.afterMove(x, y)` is the seam for anything `Player.update` runs
 * BETWEEN the move and the clamp — which at R1 is exactly one thing,
 * `checkFallingInPit()` (`Player.as:561`, with the clamp at `:563-564`).
 * Returning `{x, y}` replaces the position. The ordering is not cosmetic:
 * the pit lerp happens before the world clamp, so in a small level a lerp
 * that pulled the player outside the bounds would be clamped back, and a
 * model that clamped first would not.
 *
 * `opts.collides(x, y)` is the collision seam: it tests the PLAYER'S box
 * placed at (x, y) and returns the blocking entity or null. Omitting it is
 * the noclip path — the AS3's `Bot.noclip ? null : collideTypes(...)`,
 * with the ternary decided once instead of per step. `playerPhysicsV2`
 * supplies it from the level geometry; nothing else about the tick
 * changes, which is why the v1 fixtures stay byte-identical.
 */
export function step(state, held, opts = {}) {
    const {
        terrainStateAt = groundTerrain, frozen = false, world = LEVEL0_WORLD,
        collides = null, afterMove = null,
        // ── R4's two hazard seams ─────────────────────────────────────
        // `friction` / `moveSpeed` override step 2's selection, because
        // from R4 the choice is not a function of the terrain state alone:
        // `Player.as:516-537` reads the STICKY `onIce`/`inWater`/`inLava`
        // flags, which the state SETTER assigned on the last raw change
        // and which therefore outlive the tile that set them. v2 computes
        // them; this file stays the dry-land transcription it has always
        // been, with the two values it selects made injectable rather than
        // duplicated.
        friction = null, moveSpeed: moveSpeedOverride = null,
        // `Player.input()`'s LAST act, after the four direction checks and
        // before `useItem` (`Player.as:1537-1540`): the waterfall push.
        // It belongs inside the input phase rather than beside it — a
        // model that added it after the sweeps would push the player on a
        // frozen tick, when `mobileUpdate` runs no input at all.
        postInput = null,
        /**
         * ⛓⛓⛓ R5 SLICE 22: `Player.input()`'s OWN FIRST LINE, as a seam.
         *
         * ```
         *   if (!receiveInput || frozenTimer > 0 || fallFromCeiling) return;
         * ```
         *
         * ⛔ THIS IS NOT `frozen`, AND THE DIFFERENCE IS THE WHOLE POINT.
         * `frozen` is `Game.freezeObjects`, which `Mobile.mobileUpdate`
         * reads one frame HIGHER and which skips `friction()`, both sweeps
         * and the input together — a ceremony parks the player and PRESERVES
         * the velocity. This one returns out of `input()` alone, so friction
         * still decays `v` and both sweeps still run: the player DRIFTS to a
         * stop and then stands still. The two produce different position
         * streams from the same tick count, which is exactly how
         * `IceTurretBlast`'s freeze was found — as a 0.8 px disagreement in
         * a recording, not as a stopped clock.
         *
         * ⚠ AND IT TAKES `postInput` WITH IT. The waterfall push is the LAST
         * statement of `input()` (`Player.as:1550-1553`), below the return,
         * so a model that skipped only the direction keys would push a frozen
         * player down a waterfall the game leaves alone.
         */
        inputBlocked = false,
    } = opts;
    const clamp = world === LEVEL0_WORLD ? CLAMP : clampFor(world);

    let x = state.x;
    let y = state.y;
    let v = { x: state.vx, y: state.vy };

    // 1-2. Terrain state selects friction and speed for THIS tick.
    const terrain = terrainStateAt(x, y + CHECK_OFFSET_Y);
    const tableSpeed = MOVE_SPEEDS[terrain];
    if (tableSpeed === undefined) {
        throw new RangeError(
            `terrainStateAt returned state ${terrain}, which is outside the `
            + `moveSpeeds table (0..${MOVE_SPEEDS.length - 1})`,
        );
    }
    const moveSpeed = moveSpeedOverride ?? tableSpeed;
    // v1 is dry land: `f = DEFAULT_FRICTION` (`Player.as:534`). Water/lava
    // select WATER_FRICTION and ice SLIDING_FRICTION — from R4, computed
    // by v2 from the sticky flags and passed in.
    const f = friction ?? DEFAULT_FRICTION;

    // 3. mobileUpdate(), gated by Game.freezeObjects.
    let hitX = null;
    let hitY = null;
    if (!frozen) {
        v = applyFriction(v, f);
        // `Player.input()`, whole — the direction arms AND the waterfall
        // push below them — behind its own first-line return.
        if (!inputBlocked) {
            v = applyInput(v, held, moveSpeed);
            if (postInput) v = postInput(v);
        }
        // X is FULLY resolved before Y, and Y's probe sees the NEW x —
        // `moveX(v.x); moveY(v.y);` (`Mobile.as:38-39`), where moveY reads
        // the member `x` that moveX has already written. Swapping the two
        // changes where a diagonal into a corner comes to rest.
        const sx = sweepAxis(x, v.x, collides && ((px) => collides(px, y)));
        x = sx.pos;
        hitX = sx.hit;
        const sy = sweepAxis(y, v.y, collides && ((py) => collides(x, py)));
        y = sy.pos;
        hitY = sy.hit;
    }

    // 3b. `checkFallingInPit()` — between moveY and the clamp, where the
    //     AS3 puts it. Nothing else lives here.
    if (afterMove) {
        const moved = afterMove(x, y);
        x = moved.x;
        y = moved.y;
    }

    // 4. The hard clamp is part of the tick, not a safety net.
    x = Math.min(Math.max(x, clamp.minX), clamp.maxX);
    y = Math.min(Math.max(y, clamp.minY), clamp.maxY);

    // `hitX`/`hitY` are this tick's sweep RESULTS, not carried state — the
    // AS3 discards them. They ride along so a caller can tell a completed
    // move from one the geometry cut short.
    return { x, y, vx: v.x, vy: v.y, hitX, hitY };
}
