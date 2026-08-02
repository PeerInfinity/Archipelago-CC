/**
 * seedlingDemo/pushables — the block a press MOVES, tick for tick.
 *
 * Region-atlas Phase 8, subtractive ladder rung R4. Brief:
 * `CC/docs/plans/seedling-bot-r4-opus-kickoff.md` §11 (the multi-push sweep
 * that overturned §8.5) and §12.3 item 3.
 *
 * Until R4 a pushable was priced as a plain solid, which is exactly what it
 * is for a walk that never presses — R2 ruled them onto the blocked list on
 * those terms. §11 promoted this model from optional to LOAD-BEARING: the
 * R4 route needs three pushes in L65, one in L63 and one in L67, and every
 * one of them is the only thing standing between the walk and a door.
 *
 * ── WHAT A PRESS DOES, and the branch that decides it ─────────────────
 *
 * `Player.genericHit` tests `e is PushableBlockSpear` BEFORE
 * `e is PushableBlockFire`, and the Spear arm calls
 * `hit(facingVector, t, _relative = TRUE)`. The `_relative` branch of
 * `PushableBlockFire.hit` (`PushableBlockFire.as:78-83`) RETURNS BEFORE the
 * `moveTypes` loop — so two things follow that a reading of `moveTypes`
 * alone gets backwards:
 *
 *   1. `moveTypes = ["Spear"]` is never consulted on the player's path.
 *      A SWORD slash pushes a `PushableBlockSpear` too.
 *   2. The block moves ONE TILE IN THE PLAYER'S FACING DIRECTION, not
 *      "away from the hit point": `tile = getPos() - p * 16` with
 *      `p = (int(d%2==0)*(d-1), int(d%2==1)*(2-d))`, so the step is `-p`
 *      and it is E / N / W / S for facing 0 / 1 / 2 / 3.
 *
 * Both were ORACLE-CONFIRMED before this model was written — at reach 1
 * (`probe-seedling-l65.mjs`: dx = 15.95, exactly one tile west of a
 * west-facing press) and at reach 2 across a pit and through a wall
 * (`probe-seedling-l67-reach2.mjs`, `probe-seedling-l65-breach.mjs`).
 *
 * ── THE GLIDE, and why it is not a teleport ───────────────────────────
 *
 * `hit` moves the TARGET, not the block. The block walks to it at
 * `moveSpeed = 0.5` px/tick under its own `update()`, which is a 32-tick
 * traverse of one 16 px tile — and for all thirty-two of them the block is
 * `type = "Solid"` at a position that is neither cell. A model that snapped
 * it would open the far cell 32 ticks early and close the near one 32 ticks
 * late, which is the entire width of the corridor the R4 route walks
 * through.
 *
 * ⚠ `PushableBlockFire.update()` OVERRIDES `Mobile.update` and does NOT
 * call `mobileUpdate` — so it checks NEITHER `destroy` NOR
 * `Game.freezeObjects`. A block keeps gliding through a pickup ceremony's
 * frozen frames, and a destroyed one keeps gliding while it fades. (It does
 * stop during an arrival's `blackCover` frames, because those gate
 * `super.update()` in `Game.update` itself — a different mechanism, one
 * level up.)
 *
 * ── THE THREE THINGS IT COLLIDES WITH THAT THE PLAYER DOES NOT ────────
 *
 * `solids.push("Enemy", "Player")` in the constructor. So:
 *   - a block cannot move into the PLAYER, which is inert for a press
 *     (the block moves AWAY from the presser) and live for everything
 *     else — a stray push toward a player who then walks around wedges;
 *   - a block cannot move into an ENEMY, which this model cannot check
 *     because the world carries no enemies at all (they do not block the
 *     player, so the blocking census never collected them). Named as a
 *     BOUND on `stepPushable`'s `enemyRects`, in the safe direction: the
 *     model allows a push the game may refuse, and the refusal is a wedge
 *     the pair fixture would show as a divergence rather than a silent
 *     pass.
 *
 * ── SINKING ───────────────────────────────────────────────────────────
 *
 * A block that comes to rest grid-aligned over Water(1), Lava(17) or
 * Pit(6) sets `destroy` and fades out at 0.1 alpha per frame. ⚠ It stays
 * SOLID for every one of those frames — `type` is untouched and the
 * removal only lands when `FP.world.remove` is processed by
 * `World.updateLists` at the top of the NEXT frame.
 *
 * ⚠ AND NOTHING IN THE R4 ROUTE RESTS ON THE DESTRUCTION. All three of
 * §11's chains land their block on a pit, and a pit is forbidden floor
 * whether a block is standing on it or not — the claim is that the block
 * LEFT the corridor. The sink is transcribed because it is what the game
 * does, and it is named here as a bounded vacuity so nobody later reads
 * the model's silence as a claim.
 */

export class PushableError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PushableError';
    }
}

/** `Scenery/Tile.w` / `Tile.h`. */
export const TILE = 16;

/** `PushableBlockFire.moveSpeed` — px per tick, per axis. */
export const PUSHABLE_SPEED = 0.5;

/** `Mobile.DEFAULT_FRICTION`, which `input()` overwrites — see `friction`. */
export const PUSHABLE_FRICTION = 0.25;

/**
 * Ticks a block takes to cross one tile: 16 px at 0.5 px/tick.
 *
 * Derived rather than asserted, and the fencepost is the interesting half:
 * `moveX(0.5)`'s loop runs exactly once per tick (`i < 0.5` is true for
 * i = 0 and false for i = 1, and the step is `min(1, 0.5 - 0)`), so the
 * thirty-second move is the one that lands the block on the target and
 * `FP.sign(0)` is what stops it there.
 */
export const TICKS_PER_TILE = TILE / PUSHABLE_SPEED;

/**
 * `PushableBlockFire.input()` — the three tile types that destroy a block,
 * by `Tile.t`.
 */
export const DESTROYING_TILE_TYPES = Object.freeze({ 1: 'water', 17: 'lava', 6: 'pit' });

/** `Mobile.death()` — `(graphic as Image).alpha -= 0.1` per frame. */
export const ALPHA_FADE = 0.1;

/** Facing directions, as `Player.direction` numbers them. */
const RIGHT = 0;
const UP = 1;
const LEFT = 2;
const DOWN = 3;

/**
 * `spearDirection` -> the tile step the block takes.
 *
 * ⚠ DERIVED, NOT CHOSEN, and the derivation is the whole content of this
 * table. `Player.as:1103` builds
 * `p = (int(d % 2 == 0) * (d - 1), int(d % 2 == 1) * (2 - d))` and
 * `PushableBlockFire.hit`'s relative branch sets
 * `tile = getPos() - p * Tile.w` — so the block's step is `-p`:
 *
 *   d = 0 (RIGHT)  p = (-1,  0)  ->  step ( 1,  0)  EAST
 *   d = 1 (UP)     p = ( 0,  1)  ->  step ( 0, -1)  NORTH
 *   d = 2 (LEFT)   p = ( 1,  0)  ->  step (-1,  0)  WEST
 *   d = 3 (DOWN)   p = ( 0, -1)  ->  step ( 0,  1)  SOUTH
 *
 * i.e. the block moves the way the player is FACING, which is away from
 * the presser. `pushVector` recomputes `p` from the AS3 expression so the
 * table and the source can be cross-asserted rather than trusted.
 */
export const PUSH_STEP = Object.freeze({
    [RIGHT]: Object.freeze({ dx: 1, dy: 0, name: 'E' }),
    [UP]: Object.freeze({ dx: 0, dy: -1, name: 'N' }),
    [LEFT]: Object.freeze({ dx: -1, dy: 0, name: 'W' }),
    [DOWN]: Object.freeze({ dx: 0, dy: 1, name: 'S' }),
});

/** `Player.as:1103`'s `p`, verbatim, so `PUSH_STEP` can be checked against it. */
export function pushVector(direction) {
    assertDirection(direction, 'pushVector');
    return {
        x: (direction % 2 === 0 ? 1 : 0) * (direction - 1),
        y: (direction % 2 === 1 ? 1 : 0) * (2 - direction),
    };
}

function assertDirection(direction, where) {
    if (!Number.isInteger(direction) || direction < 0 || direction > 3) {
        throw new PushableError(`${where}: direction ${JSON.stringify(direction)} is not `
            + '0..3. `Player.direction` is one of four ints and a press captures it '
            + 'verbatim — an out-of-range facing would silently push nowhere.');
    }
}

/** `FP.sign` — -1, 0 or 1. */
const sign = (n) => (n < 0 ? -1 : (n > 0 ? 1 : 0));

/**
 * `PushableBlockFire.gridPos(_x:int, _y:int)` — the block's own cell corner.
 *
 * ⚠ The AS3 parameters are typed `int`, so the arguments are TRUNCATED
 * before the floor. For a non-negative x that changes nothing
 * (`floor(trunc(x)/16) === floor(x/16)`, because truncation never crosses a
 * multiple of 16 downward) and every level's geometry is non-negative, so
 * the coercion is transcribed and its no-op-ness is the named bound.
 */
export function gridPos(x, y) {
    return { x: Math.floor(Math.trunc(x) / TILE) * TILE, y: Math.floor(Math.trunc(y) / TILE) * TILE };
}

/** `PushableBlockFire.getPos` — the CENTRE of the cell `(x, y)` is in. */
export function getPos(x, y) {
    return {
        x: (Math.floor(Math.trunc(x) / TILE) + 0.5) * TILE,
        y: (Math.floor(Math.trunc(y) / TILE) + 0.5) * TILE,
    };
}

/** The 16x16 hitbox: `setHitbox(16, 16)` with the default (0, 0) origin. */
export function pushableRect(block) {
    return {
        x: block.x, y: block.y, w: TILE, h: TILE, right: block.x + TILE, bottom: block.y + TILE,
    };
}

/** The tile the block currently occupies, for a reachability consumer. */
export function pushableTile(block) {
    return { tx: Math.floor(block.x / TILE), ty: Math.floor(block.y / TILE) };
}

/**
 * A block as `Game.loadlevel` constructs it: at rest, targeting its own
 * cell centre (`tile = getPos(x, y)` in the constructor), fully opaque.
 */
export function newPushable({ id, as3, tag, x, y, family = 'fire' }) {
    if (!id) throw new PushableError('newPushable needs an id — the run keys its state by it');
    return {
        id,
        as3,
        tag,
        // Which `input()` this block runs. Carried on the STATE rather than
        // looked up per tick, because the stepper's whole job is to dispatch
        // on it and a state that did not know would have to ask the world.
        family,
        x,
        y,
        // Where `loadlevel` put it. Kept so "this block has moved" is a
        // question the state can answer without the world being consulted —
        // the run rebuilds the level on re-entry and the two would then
        // disagree about which position is the original.
        spawnX: x,
        spawnY: y,
        vx: 0,
        vy: 0,
        // The TARGET is a cell CENTRE, not a corner: `input()` compares it
        // against `x + Tile.w/2`. Keeping the game's own units here is what
        // makes the `- x - Tile.w/2` below a transcription instead of an
        // off-by-eight waiting to happen.
        target: getPos(x, y),
        destroy: false,
        alpha: 1,
        removed: false,
        /** Set on the frame `alpha` reaches 0; `removed` lands the NEXT tick. */
        removePending: false,
    };
}

/**
 * `genericHit`'s relative arm: move the TARGET one tile along the facing.
 *
 * ⚠ `if (v.length > 0) return` — a block already in motion IGNORES the hit.
 * That is what makes one press one tile even though `spear()` can re-fire
 * every other tick, and it is why a second press landing mid-glide is a
 * no-op rather than a double push. Returned as `moved: false` rather than
 * swallowed, so a caller auditing a press can say the hit was refused.
 */
export function hitPushable(block, direction) {
    assertDirection(direction, 'hitPushable');
    if (block.removed) return { block, moved: false, why: 'the block has been removed' };
    if (block.vx !== 0 || block.vy !== 0) {
        return { block, moved: false, why: 'the block is already moving (`v.length > 0`)' };
    }
    const p = pushVector(direction);
    const here = getPos(block.x, block.y);
    return {
        block: { ...block, target: { x: here.x - p.x * TILE, y: here.y - p.y * TILE } },
        moved: true,
        why: null,
        step: PUSH_STEP[direction],
    };
}

/**
 * `Mobile.friction()`, transcribed — and INERT, which is the point of
 * transcribing it.
 *
 * `PushableBlockFire.update` calls `friction()` and then `input()`, and
 * `input()` assigns BOTH components of `v` unconditionally from
 * `FP.sign(target - centre)`. So nothing friction computes ever survives to
 * a move. It is here so that a rung which changes the ordering (or a reader
 * checking this file against the class) sees the same four lines the game
 * has, and `pushables.test.js` pins the inertness rather than this comment
 * asserting it.
 */
export function frictionStep(vx, vy, f = PUSHABLE_FRICTION) {
    const len = Math.hypot(vx, vy);
    let nx = vx;
    let ny = vy;
    if (len > 0) {
        const scaled = Math.max(len - f, 0);
        nx = (vx / len) * scaled;
        ny = (vy / len) * scaled;
    }
    if (Math.abs(nx) < 0.05) nx = 0;
    if (Math.abs(ny) < 0.05) ny = 0;
    return { vx: nx, vy: ny };
}

/**
 * `Mobile.moveX` / `moveY` for one axis: step by `min(1, |rel| - i)` and
 * stop at the first blocker.
 *
 * Returns `{pos, blocked}`. The AS3 returns the ENTITY it hit and the
 * caller only tests truthiness (`if (moveX(v.x))`), so a boolean is the
 * whole of the contract — but the blocker's identity is what a wedge
 * diagnostic needs, so `collides` may hand one back and it is carried.
 */
function moveAxis(pos, rel, collides) {
    let p = pos;
    let blocked = null;
    for (let i = 0; i < Math.abs(rel); i++) {
        const step = Math.min(1, Math.abs(rel) - i) * sign(rel);
        const hit = collides(p + step);
        if (hit) { blocked = hit; break; }
        p += step;
    }
    return { pos: p, blocked };
}

/**
 * One `PushableBlockFire.update()`.
 *
 * `ctx`:
 *   `collides(rect, block)`   the block's own solids list, self excluded —
 *                             Solid/Tree/Rock/Rope/ShieldBoss PLUS Enemy
 *                             and Player. Returns a blocker or null.
 *   `tileTypeAt(x, y)`        `nearestToPoint("Tile", ...).t` at a point,
 *                             for the sink check. Optional: a ctx without
 *                             it can never sink a block, which is a claim
 *                             the caller is making and so it must say so
 *                             explicitly with `noSink: true`.
 *   `noSink`                  see above.
 *
 * ⚠ THE BLOCK UPDATES BEFORE THE PLAYER. `Game.loadlevel` adds the Player
 * at `Game.as:2040` and the pushables at `:2164-2166`, and
 * `World.addUpdate` PREPENDS — so the update list is reverse add order and
 * the block moves FIRST. A caller therefore steps this at the TOP of a
 * tick, against the player position the previous tick left, and the
 * player's own sweep that tick reads the block where this left it. That is
 * the opposite of `activators.stepActivators`, which is stepped after the
 * movement because its two labellings agree; a half-pixel of block is
 * observable, so this one cannot be relabelled.
 */
export function stepPushable(block, ctx = {}) {
    const { collides = () => null, tileTypeAt = null, noSink = false } = ctx;
    if (block.removed) return block;
    // `World.updateLists` processes `_remove` at the TOP of the frame, so a
    // block whose alpha hit zero last frame is gone before this one runs.
    if (block.removePending) return { ...block, removed: true, removePending: false };

    let { x, y, destroy, alpha } = block;
    const at = (nx, ny) => ({
        x: nx, y: ny, w: TILE, h: TILE, right: nx + TILE, bottom: ny + TILE,
    });

    // ── friction() ────────────────────────────────────────────────────
    const fric = frictionStep(block.vx, block.vy);

    // ── input() ───────────────────────────────────────────────────────
    // The sink check runs FIRST and only when the block is exactly on its
    // grid — `gridPos(x, y).equals(new Point(x, y))`. Mid-glide x is never
    // a multiple of 16, so a block crossing a pit does NOT sink; it sinks
    // on the tick after it arrives.
    const grid = gridPos(x, y);
    if (grid.x === x && grid.y === y) {
        if (tileTypeAt) {
            const t = tileTypeAt(x + TILE / 2, y + TILE / 2);
            if (DESTROYING_TILE_TYPES[t]) destroy = true;
        } else if (!noSink) {
            throw new PushableError(
                `stepPushable: block ${block.id} is grid-aligned at (${x}, ${y}) and the `
                + 'ctx has no `tileTypeAt`, so `PushableBlockFire.input()`\'s sink check '
                + 'cannot be run. Pass the resolver, or pass `noSink: true` to state '
                + 'that the caller knows the block is not over water/lava/pit — an '
                + 'unasked sink check reads as "it does not sink".',
            );
        }
    }
    // `v = moveSpeed * FP.sign(tile - pos - Tile.w/2)`, per axis, against
    // the block's own CENTRE. Both components are assigned unconditionally,
    // which is what makes `friction()` above inert.
    let vx = PUSHABLE_SPEED * sign(block.target.x - x - TILE / 2);
    let vy = PUSHABLE_SPEED * sign(block.target.y - y - TILE / 2);
    // ⚠ The snap is GATED on the grid cell being free. A block whose own
    // cell is occupied (by the player who just walked into it, say) is left
    // where it is rather than being teleported onto them.
    if (!collides(at(grid.x, grid.y), block)) {
        if (Math.abs(vx) <= 0.01) x = Math.trunc(grid.x);
        if (Math.abs(vy) <= 0.01) y = Math.trunc(grid.y);
    }

    // ── update()'s two sweeps ─────────────────────────────────────────
    let target = block.target;
    const sweptX = moveAxis(x, vx, (nx) => collides(at(nx, y), block));
    x = sweptX.pos;
    if (sweptX.blocked) target = { ...target, x: getPos(x, y).x };
    const sweptY = moveAxis(y, vy, (ny) => collides(at(x, ny), block));
    y = sweptY.pos;
    if (sweptY.blocked) target = { ...target, y: getPos(x, y).y };

    // ── death() ───────────────────────────────────────────────────────
    // ⚠ Not gated on anything: `PushableBlockFire.update` calls `death()`
    // unconditionally, and `destroy` is what `death()` itself tests.
    let removePending = false;
    if (destroy) {
        alpha -= ALPHA_FADE;
        if (alpha <= 0) removePending = true;
    }

    // `fric` is computed and DISCARDED, exactly as the game discards it:
    // `input()` reassigns both components before either is read. Naming it
    // is the difference between "this model skips friction" and "this model
    // runs friction and the game throws the answer away".
    void fric;
    return { ...block, x, y, vx, vy, target, destroy, alpha, removePending };
}

// ── the run-state family (per VISIT, like a bridge; not banked) ───────

/**
 * Per-visit block state for one level, keyed by the world's `pushableId`.
 *
 * ⚠ PER VISIT, and this is the `openBridges` lifetime rather than the
 * earned-clear one. `PushableBlockFire` holds its position in an instance
 * variable with no persistence at all, so a re-entered level rebuilds every
 * block at its `.oel` cell — a block pushed into a pit is BACK, standing in
 * the corridor, the next time the walk comes through. Two families, two
 * lifetimes; unifying them would make a route that pushed once plan its
 * return through a corridor the game has closed again.
 *
 * ⚠ BOTH FAMILIES ARE STEPPED, by two different functions. A plain
 * `PushableBlock` has its own `input()` — no press reaches it, and a WALK
 * moves it — and the reason it is modelled rather than merely watched is
 * recorded on `walkPushContact`: the committed R3 walk leans on one.
 */
export function createPushableState(world) {
    const byId = new Map();
    const walkPushed = [];
    for (const p of world.pushables ?? []) {
        const block = newPushable(p);
        if (p.family === 'walk') {
            // ⚠ `PushableBlock`'s ctor is `tile = new Point(floor(x/w),
            // floor(y/h))` — TILE INDICES, where the Fire family's is a
            // pixel centre. `newPushable` gives the pixel one, so the walk
            // family's target is rewritten here rather than in a shared
            // constructor that would have to know which units it is in.
            block.target = { x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) };
            // IDS, not the objects: `stepPushables` replaces every entry
            // with a new object each tick, so a list of objects would be a
            // list of the positions they had when the level was built.
            walkPushed.push(p.id);
        }
        byId.set(p.id, block);
    }
    return { byId, walkPushed, level: world.level };
}

/**
 * One tick for every block in the level, each through its own family's
 * `input()`.
 */
export function stepPushables(state, ctx = {}) {
    for (const [id, block] of state.byId) {
        state.byId.set(id, block.family === 'walk'
            ? stepWalkPushable(block, ctx)
            : stepPushable(block, ctx));
    }
    return state;
}

/**
 * The live rects, for `collidesSolid` / `plannerBlockerAt`.
 *
 * `removed` entries are kept (with the flag) rather than dropped, so a
 * consumer can tell "this block is gone" from "this world has no such
 * block", which are different bugs.
 */
export function pushableRects(state) {
    const out = new Map();
    for (const [id, b] of state.byId) {
        out.set(id, { rect: pushableRect(b), removed: b.removed, destroy: b.destroy });
    }
    return out;
}

/** Which blocks are no longer where the level built them. */
export function movedPushables(state) {
    const out = [];
    for (const b of state.byId.values()) {
        const tile = pushableTile(b);
        if (b.removed || b.x !== b.spawnX || b.y !== b.spawnY) {
            out.push({ id: b.id, x: b.x, y: b.y, ...tile, removed: b.removed });
        }
    }
    return out;
}

/** Is any block still gliding? The `spear` leg's "the push has landed" test. */
export function pushablesSettled(state) {
    for (const b of state.byId.values()) if (b.vx !== 0 || b.vy !== 0) return false;
    return true;
}

// ── THE OTHER PUSHABLE: `PushableBlock`, which a WALK moves ───────────

/**
 * `PushableBlock.input()`'s four contact tests.
 *
 * The plain pushable has no `genericHit` arm at all — no press of any weapon
 * touches one — and moves instead when the player LEANS on an edge: the
 * block probes its own hitbox displaced one pixel toward each face, and a
 * Player found there whose velocity points INTO the block sets the target
 * one tile that way.
 *
 * ⚠ THE COMMITTED R3 WALK DOES THIS, and it took modelling the rest of this
 * file to notice. At tick 3489 of `r3-walk-full` the player passes L22's
 * `pushableblock@96,64` heading south at (114.96, 77.62) with `v.x` at
 * -0.126 — a **0.04 px** overlap with the `x + 1` probe — and the game
 * pushed the block a full tile west. Nothing in the recording can see it:
 * the player is already past the block and never touches that cell again.
 *
 * That is exactly why this is MODELLED rather than made into an alarm. An
 * alarm would fire on frozen fixtures that are byte-exact against the game
 * (they are: the motion is invisible on those routes), and the assumption it
 * was protecting — "no route has ever leaned on one" — turned out to be
 * false the first time anyone checked.
 */
export function walkPushContact(walkPushed, playerBox, vx, vy) {
    const hits = [];
    const overlaps = (bx, by) => playerBox.right > bx && playerBox.bottom > by
        && playerBox.x < bx + TILE && playerBox.y < by + TILE;
    for (const b of walkPushed) {
        if (overlaps(b.x - 1, b.y) && vx > 0) hits.push({ block: b, dir: 'E' });
        if (overlaps(b.x + 1, b.y) && vx < 0) hits.push({ block: b, dir: 'W' });
        if (overlaps(b.x, b.y - 1) && vy > 0) hits.push({ block: b, dir: 'S' });
        if (overlaps(b.x, b.y + 1) && vy < 0) hits.push({ block: b, dir: 'N' });
    }
    return hits;
}

/** `Math.ceil(x / Tile.w)` — `PushableBlock`'s own cell index. */
const ceilTile = (v) => Math.ceil(v / TILE);

/**
 * One `PushableBlock.update()`.
 *
 * ⚠ ITS `tile` IS IN TILE UNITS, and `PushableBlockFire`'s is a PIXEL
 * CENTRE. Same field name, same package, two units — which is why the two
 * steppers are separate functions rather than one with a flag.
 *
 * ⚠ AND `cTile` IS A CEIL, not a floor. That single asymmetry is the whole
 * difference between the two directions: a block one half-pixel EAST of its
 * corner already reports the next cell index, so `tile.x - cTile.x` is zero
 * and the `v.x == 0` arm SNAPS IT BACK — an east push only makes progress
 * while the player keeps leaning, one re-target per tick. A block half a
 * pixel WEST still reports its own index, so a single contact tick sends it
 * the whole tile. Transcribed, not regularised: the L22 graze above is a
 * WEST push and it moved a full tile off one 0.04 px overlap.
 */
export function stepWalkPushable(block, ctx = {}) {
    const {
        collides = () => null, tileTypeAt = null, noSink = false,
        playerBox = null, playerVx = 0, playerVy = 0,
    } = ctx;
    if (block.removed) return block;
    if (block.removePending) return { ...block, removed: true, removePending: false };

    let { x, y, destroy, alpha } = block;
    const at = (nx, ny) => ({
        x: nx, y: ny, w: TILE, h: TILE, right: nx + TILE, bottom: ny + TILE,
    });
    frictionStep(block.vx, block.vy);

    // ── input() ───────────────────────────────────────────────────────
    const cTile = { x: ceilTile(x), y: ceilTile(y) };
    let tile = { ...block.target };
    if (playerBox) {
        const hits = walkPushContact([{ ...block }], playerBox, playerVx, playerVy);
        for (const h of hits) {
            if (h.dir === 'E') tile = { ...tile, x: cTile.x + 1 };
            if (h.dir === 'W') tile = { ...tile, x: cTile.x - 1 };
            if (h.dir === 'S') tile = { ...tile, y: cTile.y + 1 };
            if (h.dir === 'N') tile = { ...tile, y: cTile.y - 1 };
        }
    }
    // ⚠ The two axes are decided in SEPARATE guarded blocks here, unlike
    // `PushableBlockFire`, and each re-asks the collide question after the
    // other has possibly moved the block. Transcribed in that order.
    const grid = () => gridPos(x, y);
    const vx = PUSHABLE_SPEED * sign(tile.x - cTile.x);
    if (!collides(at(grid().x, grid().y), block) && vx === 0) x = grid().x;
    const vy = PUSHABLE_SPEED * sign(tile.y - cTile.y);
    if (!collides(at(grid().x, grid().y), block) && vy === 0) y = grid().y;

    // The sink check, gated on BOTH axes being exactly on the grid.
    if (x === Math.floor(x / TILE) * TILE && y === Math.floor(y / TILE) * TILE) {
        if (tileTypeAt) {
            const t = tileTypeAt(x + TILE / 2, y + TILE / 2);
            if (DESTROYING_TILE_TYPES[t]) destroy = true;
        } else if (!noSink) {
            throw new PushableError(
                `stepWalkPushable: block ${block.id} is grid-aligned at (${x}, ${y}) and `
                + 'the ctx has no `tileTypeAt`. Pass the resolver, or pass `noSink: true`.',
            );
        }
    }

    // ── update()'s two sweeps ─────────────────────────────────────────
    const sweptX = moveAxis(x, vx, (nx) => collides(at(nx, y), block));
    x = sweptX.pos;
    if (sweptX.blocked) tile = { ...tile, x: cTile.x };
    const sweptY = moveAxis(y, vy, (ny) => collides(at(x, ny), block));
    y = sweptY.pos;
    if (sweptY.blocked) tile = { ...tile, y: cTile.y };

    let removePending = false;
    if (destroy) {
        alpha -= ALPHA_FADE;
        if (alpha <= 0) removePending = true;
    }
    return { ...block, x, y, vx, vy, target: tile, destroy, alpha, removePending };
}
