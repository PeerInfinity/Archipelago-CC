/**
 * seedlingDemo/botDriverV2 — synthesize an input tape that PATHS to its
 * targets through real geometry, and chains legs across levels.
 *
 * v2 slice 4 of the real-game bot ladder. Brief:
 * `CC/docs/plans/seedling-bot-v2-opus-kickoff.md` §3.4. v1's driver
 * (`botDriverV1`) walks straight lines with collision off; this one plans
 * around the level's solids and its unmodelled terrain, and takes named
 * teleporters between levels.
 *
 * v1's two doctrines are unchanged and are the reason this is short:
 *
 *   **Simulate, don't solve.** The controller is still v1's bang-bang
 *   braking rule, still driving the REAL physics in a loop rather than
 *   computing a hold length from a distance. Velocity is not proportional
 *   to anything convenient (`Player.input()` overshoots its own cap into a
 *   ~3-tick limit cycle, and friction is vector-length so the axes couple),
 *   and a closed form would be a second model of the physics, free to drift
 *   from the first.
 *
 *   **The tape is the artifact.** The tests re-run the emitted tape through
 *   `runTape` independently and check the arrivals there, rather than
 *   trusting the planner's own running state — and the oracle then runs the
 *   same tape through the real game.
 *
 * ── Planner and engine share the engine ───────────────────────────────
 * The single most important line in this file is that execution goes
 * through `createLevelRun`, the same object `tapeRunner` replays tapes
 * with. That is the walkTo-divergence lesson from the maze arc: a driver
 * with its own idea of how movement works produces a tape that the runner
 * then interprets differently, and the disagreement surfaces as a physics
 * divergence in the differential. Here the driver's only privilege over
 * the runner is that it CHOOSES the held keys instead of reading them.
 *
 * ── The planner's three obstacle kinds ────────────────────────────────
 * `levelWorld.plannerBlockerAt` reports solids, pixelmasks and unmodelled
 * terrain — the last of which blocks nothing at all in the game (water is
 * walkable geometry) but ends the run through `assertModelledTerrain`. To
 * those this module adds a fourth that is pure planning policy and does not
 * belong in the geometry: **a live teleporter volume is an obstacle**,
 * except the one leg's `exit` names. An in-level route that clipped a
 * trigger would silently end up in another level, which is exactly the
 * accident that ate v1's original `clamp-left` fixture.
 *
 * ── Where it refuses rather than recovers ─────────────────────────────
 * If the simulated run hits a wall on the way to a waypoint, that is a
 * PLANNER BUG and it THROWS. It never re-plans quietly. Silent re-planning
 * is how a divergence hides: the tape still reaches the target, so every
 * assertion passes, and the fact that the model's geometry disagreed with
 * the game's is never reported. `step()` returns `hitX`/`hitY` for exactly
 * this — slice 2 added them for this slice.
 *
 * Same for a transition nobody asked for, a leg that starts in the wrong
 * level, and an `exit` whose teleporter does not go where the next leg
 * says. All named errors.
 *
 * ── Cross-level legs, and what the caller owes ────────────────────────
 * A task is `[{level, targets: [...], exit?: {x, y}}]`. The driver walks
 * the targets, then walks INTO the teleporter whose OEL coordinates are
 * `exit`, and asserts it arrived in the next leg's `level`. **The CALLER
 * names the teleporter; the driver never searches the teleporter graph**
 * (§1 ruling 4). Full auto cross-level routing waits for a rung that needs
 * it — the maze bot's `(region, arrival-exit)` routing lessons come into
 * scope then, not now.
 */

import { assertTapeWithinRuntimeBudget, serializeTape } from './tapeFormat.js';
import { createLevelRun } from './levelRun.js';
import { RELAXED_ROLES, ROLES, TILE_SIZE } from './levelWorld.js';
import { assertRect, rectsOverlap } from './levelWorld.js';
import { playerBoxAt, terrainProbeRect } from './playerPhysicsV2.js';
import {
    DEFAULT_MAX_TICKS_PER_TARGET,
    DEFAULT_TOLERANCE,
    buildTape,
    chooseHeld,
    hasArrived,
} from './botDriverV1.js';

export class BotDriverV2Error extends Error {
    constructor(message) {
        super(message);
        this.name = 'BotDriverV2Error';
    }
}

const fail = (message) => { throw new BotDriverV2Error(message); };

/**
 * Segment-clearance sampling pitch, in pixels.
 *
 * The sweep advances at most 1 px per step, so half a pixel is finer than
 * the physics can resolve. It is not a tolerance to tune: coarsening it
 * would let a smoothed segment skip past a 16 px tile corner, and the only
 * thing that would notice is the wall the executor then throws on.
 */
export const SEGMENT_SAMPLE_STEP = 0.5;

/**
 * ── FORCED CONTACTS: what the game has already put the player inside ──
 *
 * A leg starts where the previous leg's exit LANDED, and an arrival is not
 * a position the planner chose. Four of the extract's teleporters arrive on
 * top of another trigger (the game suppresses the re-fire through the latch
 * `arriveIn` already pre-arms), and at least one arrives inside a priced
 * avoid volume — L37's exit to L38 lands squarely on L38's own
 * `buttonroom` at (144,288), which is a room-entry puzzle the level was
 * BUILT around.
 *
 * The planner refuses both outright: `plannerObstacleAt` reports the
 * teleporter and the volume, so A\* fails on its own start tile and the
 * route reports the level unreachable. That is the wrong answer — the
 * player is standing there whatever anyone thinks about it.
 *
 * So a leg may DECLARE the contacts it starts inside, by key, and the
 * planner exempts exactly those for that leg. Two rules make the exemption
 * safe to have:
 *
 *   - **undeclared is a THROW.** A contact the run is actually in that the
 *     leg does not name is a route that has silently changed under a
 *     geometry or pricing edit — the loudest possible place to find that
 *     out is here, before a seven-minute recording.
 *   - **declared-but-absent is also a THROW.** A stale declaration would
 *     quietly re-permit something the route no longer touches.
 *
 * ⚠ It is a LEG-SCOPED exemption, not a start-tile one, and that is a
 * bounded over-permission recorded rather than hidden: a leg that walked
 * off its start volume and back onto it would not be caught here. What
 * catches it instead is the game — a re-entered trigger fires (the latch
 * disarms the moment the box stops overlapping) and `drive` throws on the
 * transition nobody asked for.
 */
const EMPTY_CONTACTS = new Set();
const EMPTY_VOLUMES = [];

/** The stable key for one contact: kind, tag and OEL position. */
export function contactKey(hit) {
    const b = hit.blocker;
    return `${hit.kind}:${b.tag ?? b.cls?.as3 ?? '?'}@${b.x},${b.y}`;
}

/**
 * Every live trigger volume and avoid volume the player is standing in at
 * `(x, y)`, as contact keys — what a leg starting there must declare.
 */
export function contactsAt(level, x, y, { avoidVolumes = false } = {}) {
    const box = playerBoxAt(x, y);
    const hits = level.teleporterHit(box)
        .map((tp) => ({ kind: 'teleporter', blocker: tp }));
    if (avoidVolumes) hits.push(...level.avoidVolumesAt(box, { x, y }));
    return hits.map(contactKey);
}

/** Tile centre, which is where `Tile` entities actually sit. */
export function tileCentre(tx, ty) {
    return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
}

/** The tile containing a pixel position. */
export function tileAt(x, y) {
    return { tx: Math.floor(x / TILE_SIZE), ty: Math.floor(y / TILE_SIZE) };
}

/**
 * ── THE PLANNING LATTICE, and why it is an option (R2) ────────────────
 *
 * A\* works over cell CENTRES, and until R2 a cell was a tile: the box is
 * 4x5 and a tile is 16x16, so it fits with 6 px to spare on every side,
 * which is what makes tile-granular planning legitimate. It is SOUND —
 * every route it finds is walkable — and INCOMPLETE, and the incompleteness
 * bites the moment a collider sits OFF the tile grid.
 *
 * The case that forced this: `planttorch@120,152` in level 62. Its hitbox
 * is 16x16 at (120,152), half a tile off in both axes, in a corridor two
 * tiles wide — so it clips FOUR tile centres at once and the tile lattice
 * reports the shaft to level 64 (and with it the SPEAR) unreachable. It is
 * not: 16 px of the corridor is clear, and `Mobile.moveX/moveY` step ONE
 * PIXEL at a time, so the player walks past it without touching it.
 *
 * So the pitch is an option. **The default is TILE_SIZE, which is exactly
 * the behaviour every committed R1 tape was planned under** — this had to
 * be opt-in rather than a global refinement, because the R1 recordings are
 * frozen milestone artifacts and a finer lattice would re-route them. R2's
 * legs pass 8, which puts a node centre at x ≡ 4 (mod 8) and threads the
 * torch. Finer is not free: the node count goes as 1/pitch².
 *
 * ⚠ It changes only WHICH ROUTE is found, never whether the route is
 * checked. Every segment the smoother keeps is still re-tested with the
 * real box along its whole length, and the executor still throws if the
 * run touches anything.
 */
export const DEFAULT_LATTICE = TILE_SIZE;

/** The centre of lattice cell `(nx, ny)` at `pitch`. */
export function nodeCentre(nx, ny, pitch) {
    return { x: nx * pitch + pitch / 2, y: ny * pitch + pitch / 2 };
}

/** The lattice cell containing a pixel position. */
export function nodeAt(x, y, pitch) {
    return { tx: Math.floor(x / pitch), ty: Math.floor(y / pitch) };
}

/**
 * Everything that would stop, throw or misdirect the player standing at
 * (x, y): the geometry's kinds plus this module's own planning policy.
 *
 * `allowTeleporter` is an INDEX into `level.teleporters`, or null. The leg's
 * own exit has to be steppable — walking into it is the entire point — while
 * every other live trigger is an obstacle.
 *
 * `opts` is the RELAXED mode (R0), and it has two halves that must move
 * together with the tape:
 *   `noclip` / `noHazards`  passed straight through to the geometry, so the
 *      planner routes around exactly what the emitted tape will meet — no
 *      more (routing around a wall a noclip tape walks through) and no less
 *      (walking into water a tape has not disabled).
 *   `avoidVolumes`  adds the R0 fourth obstacle kind: **pickups and
 *      proximity hazards**. Walking over a special pickup freezes the game
 *      behind a dialogue only `Input.released(V)` clears — during frozen
 *      frames the tape cannot reach — so a route that clips one never
 *      finishes. A chest's open-line and a Watcher's 24 px talk circle are
 *      the same shape of problem without the pickup.
 *
 * ⚠ `avoidVolumes` DEFAULTS OFF, and that is deliberate rather than
 * conservative. Level 94 holds a Watcher, and `cross-level-leg` plans
 * through level 94; turning the volumes on for the v2 path would re-route a
 * committed fixture, and those are oracle RECORDINGS — a re-route is a
 * re-record, not a test update. The v2 driver's teleporter-only policy is
 * what the eleven committed tapes were planned under and stays that way.
 */
export function plannerObstacleAt(level, x, y, allowTeleporter = null, opts = {}) {
    const {
        noclip = false, noHazards = [], avoidVolumes = false, allowPit = null,
        contacts = EMPTY_CONTACTS, extraVolumes = EMPTY_VOLUMES,
        openActivators = null, margin = 0, triggerMargin = 0,
    } = opts;
    const box = grow(playerBoxAt(x, y), margin);
    // ⚠ A TRIGGER IS NOT A WALL, and it needs MORE room rather than less.
    // An overshoot into a wall is absorbed — the sweep stops, the run
    // arrives, `allowGrazes` records it. An overshoot into a teleporter
    // volume ends up in another level, and there is no recovering from
    // that. So a trigger's clearance is its own number and, unlike the node
    // margin, it does NOT descend with `planWaypoints`'s clearance ladder:
    // one tight destination (a button in a one-column shaft) would otherwise
    // strip the clearance from every trigger on the way to it, which is
    // precisely how three R2 legs ended up in the wrong level.
    const triggerBox = grow(playerBoxAt(x, y), Math.max(margin, triggerMargin));
    // ⚠ `openActivators` is LIVE STATE, not a plan setting, and that is why
    // it arrives per call rather than sitting in the leg's plan object. A
    // Lock is Solid until its button has been held for 101 ticks and Solid
    // again the moment the player steps off (`activators.js`), so "is this
    // tile walkable" has different answers at two points in the SAME leg.
    // The caller passes the RUN's own set — the same one `stepV2` consults —
    // so the planner cannot believe a door is open that the engine will
    // find shut.
    const geometry = level.plannerBlockerAt(box, terrainProbeRect(x, y),
        { noclip, noHazards, openActivators });
    if (geometry) return geometry;
    // ⚠ PIT TILES ARE FORBIDDEN FLOOR, and this policy is LOAD-BEARING from
    // R1 on. Until R1 a pit was unmodelled terrain, so `plannerBlockerAt`
    // reported it for free; modelling the transport took it off that list,
    // and without this the planner cheerfully routes ACROSS pits — the exact
    // accident class that ate v1's `clamp-left`, except this one is fatal
    // rather than merely misdirecting. 27 of the 116 levels hold pit tiles
    // with NO `control` block, and `checkFallingInPit`'s else branch is
    // `die()`: Dungeon 6 and most of Dungeon 8 are floors of lethal holes.
    //
    // `allowPit` is the one exemption, and it is the same shape as
    // `allowTeleporter`: a leg names the pit it intends to fall down, by
    // tile, and only that one tile is steppable. The driver never searches
    // the fall graph.
    // ── volumes the STATIC census cannot know about ────────────────────
    // A route can change the game's persistence, and a level built from a
    // static extract does not know it. R1 has exactly one: the L38 arrival
    // presses a `buttonroom` whose `room="37"` write arms L37's FallRock,
    // and `FallRock`'s CONSTRUCTOR reads that flag — so on the return visit
    // the rock is built already fallen, Solid, and writing `p.y` for
    // anything overlapping it. Under `noclip` the solidity is irrelevant;
    // the position write is not. See `r1Walk.R1_PERSISTENCE_EFFECTS`.
    for (const v of extraVolumes) {
        if (v.level !== level.level) continue;
        if (rectsOverlap(box, v.rect)) return { kind: 'persistence-effect', blocker: v };
    }
    const probe = grow(terrainProbeRect(x, y), margin);
    for (const tile of level.pitTiles) {
        if (allowPit && tile.tx === allowPit.tx && tile.ty === allowPit.ty) continue;
        if (rectsOverlap(probe, tile.rect)) return { kind: 'pit', blocker: tile };
    }
    if (avoidVolumes) {
        // The position, not just the box: a `point` hazard (lavatrap's
        // 33 px chomp disc, an ice turret's 129 px attack range) tests the
        // player's ENTITY position against a radius, which is what the game
        // does and is not a box test at all.
        const hit = level.avoidVolumesAt(box, { x, y })
            .find((h) => !contacts.has(contactKey(h)));
        if (hit) return hit;
    }
    for (let i = 0; i < level.teleporters.length; i++) {
        const tp = level.teleporters[i];
        if (i === allowTeleporter || tp.deactivated) continue;
        if (!rectsOverlap(triggerBox, tp.rect)) continue;
        const hit = { kind: 'teleporter', blocker: tp };
        if (contacts.has(contactKey(hit))) continue;
        return hit;
    }
    return null;
}

/**
 * A rect grown by `m` pixels on every side — the whole of the clearance
 * machinery, used by `nodeMargin` and `triggerMargin`.
 *
 * ⚠ AND WHAT IT IS *NOT* USED FOR ANY MORE, because the measurement is
 * worth keeping. The controller overshoots its waypoint before braking
 * back, which the six pixels between a TILE centre and its edges absorbed
 * and eight-pixel cells do not — level 0's `brickwell@208,256` leaves 1.5 px
 * and the overshoot is nearer two. The first answer was to grow the box
 * while TESTING a smoothed segment, so a long shortcut through a tight gap
 * stopped qualifying and the tape gained waypoints where the geometry was
 * close. It worked, and it cost 30% more ticks and **4.7x the input spans**
 * — and the recompiled runtime then could not load the headline tape at
 * all (`heap_alloc(72671) failed - out of memory`, 2,569 spans, 185 KB).
 *
 * `allowGrazes` is the better answer to the same problem: a wall the
 * overshoot touches stops the sweep and the run arrives anyway, so there
 * was never anything to route around. What genuinely needs clearance is a
 * TRIGGER, because entering one is not absorbed — and that has its own
 * number. The segment test now runs at zero.
 */
function grow(r, m) {
    if (!m) return r;
    return { x: r.x - m, y: r.y - m, right: r.right + m, bottom: r.bottom + m };
}

/** An empty held set — what a transport tick emits. */
const NO_HELD = new Set();

/** The one key a ceremony reads: `Player.keys[6]`, i.e. X. */
const TALK_HELD = new Set(['primary']);

const describe = (o) => {
    if (o.kind === 'terrain' || o.kind === 'pit') {
        return `${o.kind} ${o.blocker.name} (t=${o.blocker.t}) at tile `
            + `(${o.blocker.tx},${o.blocker.ty})`;
    }
    if (o.kind === 'persistence-effect') {
        return `${o.kind} ${o.blocker.tag} at (${o.blocker.rect.x},${o.blocker.rect.y}): `
            + `${o.blocker.why}`;
    }
    return `${o.kind} ${o.blocker.tag ?? o.blocker.cls?.as3} `
        + `at (${o.blocker.x},${o.blocker.y})`;
};

/**
 * Is the player box clear at this tile's CENTRE?
 *
 * ⚠ The box is 4x5 and a tile is 16x16, so the box fits inside a tile with
 * 6 px to spare on each side — which is what makes tile-granular planning
 * legitimate at all, and also what makes it insufficient on its own. A tile
 * whose centre is clear may still have a solid overlapping its edge, so
 * the centre test decides only the NODES; every segment the smoother keeps
 * is re-checked with the real box along its whole length, and the executor
 * throws if the real run touches anything regardless. The brief called for
 * exactly that belt and braces.
 */
export function isWalkableTile(level, tx, ty, allowTeleporter = null, opts = {}) {
    const pitch = opts.lattice ?? DEFAULT_LATTICE;
    const nx = level.width * TILE_SIZE / pitch;
    const ny = level.height * TILE_SIZE / pitch;
    if (tx < 0 || ty < 0 || tx >= nx || ty >= ny) return false;
    const c = nodeCentre(tx, ty, pitch);
    // ⚠ THE NODE MARGIN IS A SEPARATE KNOB FROM THE SMOOTHER'S, and it has
    // to be, because they want opposite things. The smoother's margin only
    // ever REJECTS a shortcut, so more is safer. This one deletes nodes, and
    // a corridor 16 px wide has exactly one lattice column the player fits
    // in — inflate there and the corridor disappears, which is the
    // over-blocking this rung has spent its whole length unpicking.
    // `planWaypoints` therefore plans WITH it and falls back to zero when
    // that finds no path at all.
    return plannerObstacleAt(level, c.x, c.y, allowTeleporter,
        { ...opts, margin: opts.nodeMargin ?? 0 }) === null;
}

/**
 * A* over walkable tiles, 4-connected, unit cost, Manhattan heuristic.
 *
 * 4-connected rather than 8 on purpose: a diagonal tile step can cut a
 * corner the player's box does not fit around, and the smoother produces
 * diagonals anyway — from segments that have been CHECKED, which a diagonal
 * graph edge would not have been.
 *
 * Ties are broken deterministically (lowest f, then lowest ty, then lowest
 * tx) because the emitted tape is a COMMITTED FIXTURE. A planner that
 * depended on Map/Set iteration order for its tie-breaks would re-record
 * differently on a different engine and the diff would look like a physics
 * change.
 */
export function planTilePath(level, from, to, allowTeleporter = null, opts = {}) {
    const pitch = opts.lattice ?? DEFAULT_LATTICE;
    const start = nodeAt(from.x, from.y, pitch);
    const goal = nodeAt(to.x, to.y, pitch);

    // Both ENDPOINTS are checked without ANY clearance, for the same reason
    // the goal is exempt during expansion: they are positions the caller
    // named or the game chose, not cells the planner picked. The trigger
    // margin especially — a leg starts where the previous leg's exit landed,
    // which is INSIDE a trigger by construction.
    const ends = { ...opts, nodeMargin: 0, triggerMargin: 0 };
    for (const [what, t, pos] of [['start', start, from], ['goal', goal, to]]) {
        if (!isWalkableTile(level, t.tx, t.ty, allowTeleporter, ends)) {
            const c = nodeCentre(t.tx, t.ty, pitch);
            const o = plannerObstacleAt(level, c.x, c.y, allowTeleporter, ends);
            fail(`A* ${what} tile (${t.tx},${t.ty}) in level ${level.level} — for `
                + `(${pos.x},${pos.y}) — is not walkable: `
                + `${o ? describe(o) : 'outside the level'}. The planner works in whole `
                + 'tiles, so both ends of a route must be tiles the player box fits in '
                + 'at the centre of.');
        }
    }

    const stride = level.width * TILE_SIZE / pitch;
    const key = (tx, ty) => ty * stride + tx;
    const h = (tx, ty) => Math.abs(tx - goal.tx) + Math.abs(ty - goal.ty);

    const gScore = new Map([[key(start.tx, start.ty), 0]]);
    const cameFrom = new Map();
    const open = [{ ...start, f: h(start.tx, start.ty), g: 0 }];
    const closed = new Set();

    while (open.length > 0) {
        let bi = 0;
        for (let i = 1; i < open.length; i++) {
            const a = open[i];
            const b = open[bi];
            if (a.f < b.f || (a.f === b.f && (a.ty < b.ty || (a.ty === b.ty && a.tx < b.tx)))) {
                bi = i;
            }
        }
        const cur = open.splice(bi, 1)[0];
        const ck = key(cur.tx, cur.ty);
        if (closed.has(ck)) continue;
        closed.add(ck);

        if (cur.tx === goal.tx && cur.ty === goal.ty) {
            const path = [{ tx: cur.tx, ty: cur.ty }];
            let k = ck;
            while (cameFrom.has(k)) {
                const p = cameFrom.get(k);
                path.push({ tx: p.tx, ty: p.ty });
                k = key(p.tx, p.ty);
            }
            return path.reverse();
        }

        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const nx = cur.tx + dx;
            const ny = cur.ty + dy;
            const nk = key(nx, ny);
            if (closed.has(nk)) continue;
            // The GOAL is exempt from the node margin: it is a position the
            // caller named (a trigger's centre, a button, an item room's
            // door), not a cell the planner chose, and refusing it for being
            // tight would refuse the errand rather than route around it.
            const isGoal = nx === goal.tx && ny === goal.ty;
            if (!isWalkableTile(level, nx, ny, allowTeleporter,
                isGoal ? { ...opts, nodeMargin: 0, triggerMargin: 0 } : opts)) continue;
            const g = cur.g + 1;
            if (gScore.has(nk) && gScore.get(nk) <= g) continue;
            gScore.set(nk, g);
            cameFrom.set(nk, { tx: cur.tx, ty: cur.ty });
            open.push({ tx: nx, ty: ny, g, f: g + h(nx, ny) });
        }
    }

    fail(`no walkable tile path in level ${level.level} from tile `
        + `(${start.tx},${start.ty}) to (${goal.tx},${goal.ty}). The two are in different `
        + 'connected components of the tiles the player box fits in — which at the v2 '
        + 'rung includes being separated by water, a pixelmask or a teleporter volume, '
        + 'none of which is a wall in the game.');
}

/**
 * ⚠ THE CONTROLLER DOES NOT WALK THE STRAIGHT LINE, so neither does this.
 *
 * The brief said "smooth greedily while the straight SEGMENT stays clear",
 * and a first cut did exactly that — and put a fixture into the lake. The
 * bang-bang rule is PER AXIS: it holds toward the target on each axis
 * independently until coasting would arrive. Both axes accelerate by the
 * same `accel`, and friction is vector-length, so while both are held they
 * advance at the SAME rate. The player therefore leaves `a` at 45 degrees
 * and only straightens out once the shorter axis has arrived:
 *
 *      a ┐                 a ─────────┐   45 degrees for min(|dx|,|dy|),
 *        └────────── b       ╲        │   then axis-aligned. NOT a→b.
 *      (what a segment          ╲     │
 *       test assumes)             ╲   b
 *
 * For a shallow leg — dx of 128, dy of 16 — the difference is most of the
 * way across the level. That is how `thread-the-gap`'s first cut certified
 * a leg as clear and then descended 6.6 px below it into the water at tile
 * (7,12), where the terrain resolver fired: the check was right about a
 * curve the player never traverses.
 *
 * So the traversed path is modelled as the two legs above, and both are
 * sampled. Still a heuristic in two smaller ways, both bounded and both
 * caught downstream: within a tick `moveX` fully resolves before `moveY`
 * (so each sample also tests the X-first intermediate corner), and the
 * controller overshoots a waypoint by up to one accel quantum before
 * braking back — which the 6 px of slack between a tile centre and its
 * edges absorbs. The executor throws if the real run touches anything, so
 * the smoother is allowed to be approximate because something downstream
 * is not.
 */
export function controllerPathClear(level, a, b, allowTeleporter = null, opts = {}) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const diagonal = Math.min(Math.abs(dx), Math.abs(dy));
    const corner = {
        x: a.x + Math.sign(dx) * diagonal,
        y: a.y + Math.sign(dy) * diagonal,
    };
    if (plannerObstacleAt(level, a.x, a.y, allowTeleporter, opts)) return false;
    for (const [from, to] of [[a, corner], [corner, b]]) {
        const dist = Math.hypot(to.x - from.x, to.y - from.y);
        const steps = Math.max(1, Math.ceil(dist / SEGMENT_SAMPLE_STEP));
        let prev = from;
        for (let i = 1; i <= steps; i++) {
            const f = i / steps;
            const p = { x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f };
            if (plannerObstacleAt(level, p.x, prev.y, allowTeleporter, opts)) return false;
            if (plannerObstacleAt(level, p.x, p.y, allowTeleporter, opts)) return false;
            prev = p;
        }
    }
    return true;
}

/**
 * The waypoint list for one target: A* tile centres, greedily smoothed.
 *
 * Greedy from the current anchor — take the FARTHEST later point whose
 * straight segment is clear — which is the standard string-pull and, more
 * usefully here, keeps the waypoint count (and therefore the tape) short:
 * each waypoint costs a full stop, because v1's arrival criterion requires
 * one and is carried over unchanged.
 *
 * The last point is the TARGET ITSELF, not its tile's centre, so a caller
 * asking for (120, 100) gets (120, 100) and not (120, 104).
 */
/**
 * The A* goal for a target: its own cell, or the nearest cell to it.
 *
 * ⚠ A TARGET CAN BE STANDABLE IN A CELL WHOSE CENTRE IS NOT, and the case
 * that proves it is the one the recon called route-critical.
 * `OpenTreeMask.png` is 32x32 and solid except for a 10x12 DOORWAY, and
 * level 12's exit to the fall cluster is a teleporter INSIDE that doorway.
 * The target (48,696) is clear; the lattice cell containing it has its
 * centre at (52,700), which is canopy. A* refused the goal and the walk
 * reported darkshield and darksuit unreachable — the exact failure Phase 5a
 * predicted for rect approximations, arriving from the opposite direction.
 *
 * So when the target itself is clear and its cell is not, the search aims
 * at the nearest cell that IS, and `planWaypoints` appends the real target
 * as the last point — which it already did, and whose segment the smoother
 * already checks. A ring of two cells: further than that and "nearest" has
 * stopped meaning anything about the corridor the player is in.
 */
function nearestGoalNode(level, to, allowTeleporter, opts) {
    const pitch = opts.lattice ?? DEFAULT_LATTICE;
    const ends = { ...opts, nodeMargin: 0, triggerMargin: 0 };
    const cell = nodeAt(to.x, to.y, pitch);
    if (isWalkableTile(level, cell.tx, cell.ty, allowTeleporter, ends)) return to;
    // Only if the TARGET is genuinely standable. A blocked target is a
    // caller error and must keep reporting itself as one.
    if (plannerObstacleAt(level, to.x, to.y, allowTeleporter,
        { ...ends, margin: 0 }) !== null) {
        return to;
    }
    let best = null;
    for (let r = 1; r <= 2 && best === null; r++) {
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                const tx = cell.tx + dx;
                const ty = cell.ty + dy;
                if (!isWalkableTile(level, tx, ty, allowTeleporter, ends)) continue;
                const c = nodeCentre(tx, ty, pitch);
                const d = Math.hypot(c.x - to.x, c.y - to.y);
                // Deterministic tie-break: this route is a committed artifact.
                if (best === null || d < best.d
                    || (d === best.d && (ty < best.ty || (ty === best.ty && tx < best.tx)))) {
                    best = { d, tx, ty, point: c };
                }
            }
        }
    }
    // No substitute found: hand the original back so `planTilePath` reports
    // the unwalkable goal by name, as it always has.
    return best ? best.point : to;
}

export function planWaypoints(level, from, to, allowTeleporter = null, opts = {}) {
    // ⚠ TWO PASSES, AND THE SECOND ONE IS THE POINT. The greedy string-pull
    // below has a FALLBACK — when no smoothed segment is clear it keeps the
    // next A* node regardless — and that node was never clearance-checked.
    // Level 12's `tree@32,416` is what found it: the node at (44,412) leaves
    // the player box half a pixel clear of the trunk, the controller
    // overshoots by more than that, and no amount of SMOOTHER margin helps
    // because the offending waypoint is the one the smoother falls back to.
    //
    // So the first pass routes with clearance and the second, only if the
    // first finds no path at all, routes without it. Where the map is roomy
    // the route keeps its distance; where it is genuinely one lattice column
    // wide the route still exists and the executor's throw is the net.
    const pitch = opts.lattice ?? DEFAULT_LATTICE;
    const goal = nearestGoalNode(level, to, allowTeleporter, opts);
    let path = null;
    let lastError = null;
    // ⚠ A LADDER, NOT A SWITCH. The first cut fell straight from the full
    // node margin to zero, and the fall is expensive: one leg through
    // level 62's pit maze had no 2 px route, so the WHOLE leg replanned with
    // no clearance at all and the very first hop overshot into a teleporter
    // to the wrong level. Stepping down one pixel at a time keeps whatever
    // clearance the map allows instead of trading all of it for the tightest
    // cell on the route.
    for (let m = opts.nodeMargin ?? 0; m >= 0 && path === null; m--) {
        try {
            path = planTilePath(level, from, goal, allowTeleporter,
                { ...opts, nodeMargin: m });
        } catch (e) {
            if (!(e instanceof BotDriverV2Error)) throw e;
            lastError = e;
        }
    }
    if (path === null) throw lastError;
    // ⚠ THE START CELL'S OWN CENTRE IS A POINT, and it exists for the
    // smoother's FALLBACK. When no smoothed segment is clear the string-pull
    // keeps `points[anchor + 1]` regardless of clearance, and with the start
    // cell dropped that could be a cell TWO away from an arbitrary arrival
    // position — a diagonal long enough to sag into something. Level 12's
    // `pole@16,96` is the case: the arrival at (24,88), the second A* cell at
    // (36,92), and a first hop that clipped the pole on the way.
    //
    // It changes nothing anywhere the fallback does not fire, because the
    // string-pull takes the FARTHEST clear point and an extra nearer
    // candidate cannot become that. The twenty-three frozen R1 tapes are
    // byte-identical with it in, which is the check that says so.
    // ...but ONLY when that cell is one the planner would have chosen. A leg
    // begins where the previous leg's exit landed, which is beside the
    // trigger it came through — and the start cell is exempt from every
    // clearance for exactly that reason. Handing it to the smoother as a
    // WAYPOINT re-imports the clearance it was exempted from: three R2 legs
    // walked four pixels, back into the trigger they had just used, and
    // arrived in the level they had just left.
    const startCentre = nodeCentre(path[0].tx, path[0].ty, pitch);
    const startIsANode = isWalkableTile(level, path[0].tx, path[0].ty, allowTeleporter,
        { ...opts, nodeMargin: opts.nodeMargin ?? 0 })
        && !(startCentre.x === from.x && startCentre.y === from.y);
    const points = [
        { x: from.x, y: from.y },
        ...(startIsANode ? [startCentre] : []),
        ...path.slice(1).map((t) => nodeCentre(t.tx, t.ty, pitch)),
        { x: to.x, y: to.y },
    ];

    const kept = [];
    let anchor = 0;
    while (anchor < points.length - 1) {
        let next = anchor + 1;
        for (let j = points.length - 1; j > anchor; j--) {
            if (controllerPathClear(level, points[anchor], points[j], allowTeleporter, opts)) {
                next = j;
                break;
            }
        }
        kept.push(points[next]);
        anchor = next;
    }
    return kept;
}

/** Locate the teleporter a leg's `exit` names, by its OEL coordinates. */
function findExit(level, exit) {
    const i = level.teleporters.findIndex((tp) => tp.x === exit.x && tp.y === exit.y);
    if (i < 0) {
        fail(`level ${level.level} has no teleporter at (${exit.x},${exit.y}); it has `
            + `${level.teleporters.map((tp) => `(${tp.x},${tp.y})->${tp.to}`).join(' ')}. `
            + 'An exit names a trigger by its OEL coordinates — the driver does not '
            + 'search the teleporter graph.');
    }
    const tp = level.teleporters[i];
    if (tp.deactivated) {
        fail(`the teleporter at (${exit.x},${exit.y}) in level ${level.level} is `
            + `DEACTIVATED (tag ${tp.tag}, invert ${tp.invert}). On a fresh boot every `
            + 'persistence flag is true, which deactivates a tagged, non-inverted '
            + 'trigger — fixtures must stay off tagged teleporters.');
    }
    const tx = Math.floor(tp.x / TILE_SIZE);
    const ty = Math.floor(tp.y / TILE_SIZE);
    if (level.pitTiles.some((t) => t.tx === tx && t.ty === ty)) {
        fail(`the teleporter at (${exit.x},${exit.y}) in level ${level.level} stands ON `
            + `a PIT tile (${tx},${ty}). Walking into it fires the trigger and the pit `
            + 'edge in the same tick, and which one wins is FlashPunk bookkeeping this '
            + 'module does not transcribe — the physics throws on the conflict. Two '
            + "exist in the extract (L43's exit to L37, L100's to L101); route around "
            + 'them.');
    }
    return { index: i, teleporter: tp };
}

/**
 * Advance a PIT TRANSPORT to its end, pressing nothing.
 *
 * ⚠ The driver must not schedule inputs between the fall edge and the
 * descent landing. `checkFallingInPit` sets `receiveInput = false` and the
 * `fallFromCeiling` arm keeps it false, so a span the game ignores while
 * the JS honours it would be the v1 boot asymmetry reborn — a tape whose
 * two consumers disagree about what it asked for. So the driver emits an
 * EMPTY held set for every transport tick, and the runner sees exactly the
 * same nothing.
 *
 * `emitted` counts them, so a caller can pin that a transport really
 * happened (61 ticks for a landing on a pit, 100 for one that bounces)
 * rather than assuming.
 */
function coastThroughTransport(run, perTick, maxTicks, what) {
    let emitted = 0;
    while (run.state.fall) {
        if (emitted >= maxTicks) {
            fail(`${what}: the pit transport did not finish within ${maxTicks} ticks `
                + `(phase "${run.state.fall.phase}"). A fall is 20 fall-out ticks plus a `
                + '41-tick descent plus a 39-tick bounce if it bounces, so this means '
                + 'the model is not converging.');
        }
        perTick.push(NO_HELD);
        run.advance(NO_HELD);
        emitted++;
    }
    return emitted;
}

/**
 * ── THE HOLD PRIMITIVE (R2) ───────────────────────────────────────────
 *
 * "Stand on (120,184) for 101 ticks, then walk north" is not a target, and
 * the leg vocabulary — `targets`, `exit`, `contacts` — had no word for it.
 * L71's `lock@112,160` is the only way into Dungeon 7 and it opens on
 * nothing but time on the `button@112,176` directly below it, so R2's walk
 * needs one.
 *
 * A hold is written on the target it follows:
 *
 *     { x: 120, y: 184, hold: { ticks: 101, presser: { x: 112, y: 176 } } }
 *
 * — walk there as usual, then press NOTHING for `ticks` ticks. The presser
 * is named by its OEL coordinates and resolved through `world.pressers`,
 * exactly as an `exit` names a teleporter: the driver never searches for a
 * button that would do, and an index into a list is never carried across a
 * regeneration. (An index read against the wrong table has bitten this arc
 * four times.)
 *
 * ⚠ THE EXECUTOR VERIFIES THE HOLD, FROM THE RUN'S OWN STATE. Emitting N
 * empty ticks and moving on would make a hold that ran 99 of them present
 * as a collision divergence 2,000 ticks later, in another level, against a
 * lock nobody was looking at. So every tick of it is checked: the position
 * did not change, the box is still inside the presser, and nothing crossed
 * a level boundary. Then the EFFECT is checked — every responder sharing
 * the presser's group is open in the run's own activator state. A hold one
 * tick short fails HERE, by name, with the count.
 *
 * ⚠ And it is refused outright under `noclip`. The relaxed arm hands
 * `stepV2` a null activator set and models no lock at all, so a hold there
 * would emit its ticks, verify nothing, and report success for a mechanic
 * that was not running. That is the shape of a check that cannot fail.
 */
/** Shape-check a `hold` before anything is planned or driven with it. */
export function assertHold(hold, what) {
    if (hold === null || typeof hold !== 'object' || Array.isArray(hold)) {
        fail(`${what}: hold must be { ticks, presser: {x, y} }`);
    }
    if (!Number.isInteger(hold.ticks) || hold.ticks < 1) {
        fail(`${what}: hold.ticks must be a positive integer, got `
            + `${JSON.stringify(hold.ticks)}. The count is the CLAIM — a Lock opens on `
            + '101 and a Cover on 11 — so there is no default for it.');
    }
    const p = hold.presser;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
        fail(`${what}: hold.presser must be the button's OEL {x, y}`);
    }
}

/**
 * The presser a hold NAMES, resolved through the world's own table.
 *
 * By OEL coordinates, exactly as an `exit` names a teleporter — never by
 * index, and never by searching for a button that would do. An index into
 * a regenerated list is the failure this arc has now met four times.
 */
export function resolvePresser(world, named, what) {
    const presser = world.pressers.find((p) => p.x === named.x && p.y === named.y);
    if (!presser) {
        fail(`${what}: level ${world.level} has no presser at (${named.x},${named.y}); `
            + `it has [${world.pressers.map((p) => `${p.tag}@${p.x},${p.y}(t=${p.t})`)
                .join(' ') || 'none'}]. A hold names its button by OEL coordinates — `
            + 'the driver does not search for one that would do.');
    }
    // The R1 rect lesson, at the one boundary this primitive imports a rect
    // across: a rect with no `right`/`bottom` never overlaps anything, so
    // every check against it would pass and the hold would be green by
    // construction.
    assertRect(presser.rect, `${what}: ${presser.tag}@${presser.x},${presser.y} rect`);
    return presser;
}

function runHold(run, perTick, hold, what) {
    if (run.openActivators === null) {
        fail(`${what}: a hold is a MECHANIC, and the noclip arm does not run it — `
            + '`advance` hands `stepV2` a null activator set, so the hold would emit '
            + 'its ticks, verify nothing and report success. A tape that holds a '
            + 'button must declare noclip: false.');
    }
    const { ticks } = hold;
    const presser = resolvePresser(run.world, hold.presser, what);

    const group = run.world.activators.filter((a) => a.t === presser.t);
    if (group.length === 0) {
        fail(`${what}: ${presser.tag}@${presser.x},${presser.y} presses group `
            + `t=${presser.t}, which NO responder in level ${run.level} answers — the `
            + `level's responders are [${run.world.activators
                .map((a) => `${a.id}(t=${a.t})`).join(' ') || 'none'}]. Holding it `
            + 'would open nothing.');
    }
    // ⚠ THE POSITIVE CONTROL, BEFORE THE NEGATIVE. "The lock is open after
    // the hold" is satisfied by a lock that was never shut — the same
    // vacuity `l71-lock-shut` exists to close on the game's side. So the
    // responders this hold CHANGES are recorded here, and a hold that
    // changes nothing is a named failure rather than a silent pass.
    const openBefore = run.openActivators;
    const shutBefore = group.filter((a) => !openBefore.has(a.id));
    if (shutBefore.length === 0) {
        fail(`${what}: every responder in group t=${presser.t} `
            + `[${group.map((a) => a.id).join(' ')}] is ALREADY OPEN before the hold `
            + 'begins, so holding the button proves nothing about it. A hold that '
            + 'changes nothing is a check that cannot fail.');
    }

    const start = { x: run.state.x, y: run.state.y };
    if (!rectsOverlap(playerBoxAt(start.x, start.y), presser.rect)) {
        fail(`${what}: the hold point (${start.x},${start.y}) is NOT on `
            + `${presser.tag}@${presser.x},${presser.y} `
            + `[${presser.rect.x},${presser.rect.right}) x `
            + `[${presser.rect.y},${presser.rect.bottom}). The target before a hold has `
            + 'to land the player box inside the button, not near it.');
    }

    for (let i = 1; i <= ticks; i++) {
        perTick.push(NO_HELD);
        const { transition } = run.advance(NO_HELD);
        if (transition) {
            fail(`${what}: hold tick ${i} of ${ticks} crossed from level `
                + `${transition.from_level} to ${transition.to_level}. A hold stands `
                + 'still; a button that is also a trigger is a routing defect.');
        }
        const s = run.state;
        if (s.x !== start.x || s.y !== start.y) {
            fail(`${what}: hold tick ${i} of ${ticks} MOVED, from `
                + `(${start.x},${start.y}) to (${s.x},${s.y}). A hold presses nothing `
                + 'from a full stop, so a position that changes means the arrival was '
                + 'still carrying velocity or something moved the player.');
        }
        if (!rectsOverlap(playerBoxAt(s.x, s.y), presser.rect)) {
            fail(`${what}: hold tick ${i} of ${ticks} is no longer inside `
                + `${presser.tag}@${presser.x},${presser.y}.`);
        }
    }

    // ⚠ THE EFFECT, not the ceremony. Everything above says the player stood
    // there; only this says the game answered. `Button.update` republishes
    // its flag every tick and `Lock.activationStep` fades by 0.01 with
    // `Image.alpha` clamping at 0 and the test BEFORE the decrement, so a
    // lock opens on tick 101 and 100 leaves it solid.
    const open = run.openActivators;
    const shut = group.filter((a) => !open.has(a.id));
    if (shut.length > 0) {
        fail(`${what}: held ${presser.tag}@${presser.x},${presser.y} for ${ticks} `
            + `tick(s) and [${shut.map((a) => `${a.id}(${a.tag})`).join(' ')}] `
            + `${shut.length === 1 ? 'is' : 'are'} STILL SOLID. A Lock needs 101 `
            + 'continuous ticks and a Cover 11 — one short opens nothing, and the walk '
            + 'would meet the wall somewhere it was certified clear.');
    }
    return {
        presser: { tag: presser.tag, x: presser.x, y: presser.y, t: presser.t },
        ticks,
        at: { ...start },
        // The responders this hold CHANGED — shut when it started, open when
        // it ended. Not the whole group: one already open proves nothing.
        opened: shutBefore.map((a) => a.id),
    };
}

/**
 * ── THE TOUCH PRIMITIVE (R3) ──────────────────────────────────────────
 *
 * R3's one real opener. A `ShieldLock` has no button and no key: the way
 * through it is to WALK INTO IT holding the right shield, after which the
 * lock takes the player over — it snaps `p.y`, sets `receiveInput = false`,
 * fades for the same 101 ticks any Lock fades for, and then hands input
 * back. See `activators.TOUCH_RESPONDERS` for the transcription.
 *
 * A touch is written on the target it follows, and it names its lock by OEL
 * coordinates exactly as a hold names its button:
 *
 *     { x: 280, y: 264, touch: { lock: { x: 288, y: 256 } } }
 *
 * ⚠ THE WINDOW GETS NO SPANS. That is the transport rule again, one
 * mechanic over: the tick counter runs while the player cannot act, so a
 * controller left to its own devices would happily choose keys for a
 * hundred ticks the game drops on the floor. `useItem(Main.primary)` is
 * inside `Player.input()` too, so those spans are inert in the game as
 * well — but a span one consumer honours and the other drops is exactly the
 * asymmetry the tape format exists to prevent, and 100 of them is also 100
 * spans against a runtime with a measured span ceiling.
 *
 * ⚠ And every claim here is a PAIR, the `l71-lock-shut` pattern: the lock
 * must be SHUT when the touch begins and OPEN when it ends. "The player got
 * through" is satisfied by a lock that was never there — which is what
 * `l71-shieldlock-shut` exists to show on the game's side.
 */
/** Shape-check a `touch` before anything is planned or driven with it. */
export function assertTouch(touch, what) {
    if (touch === null || typeof touch !== 'object' || Array.isArray(touch)) {
        fail(`${what}: touch must be { lock: {x, y} }`);
    }
    const l = touch.lock;
    if (!l || !Number.isFinite(l.x) || !Number.isFinite(l.y)) {
        fail(`${what}: touch.lock must be the lock's OEL {x, y}`);
    }
}

/**
 * The touch responder a touch NAMES, resolved through the world's own
 * table. By OEL coordinates, never by index and never by searching for a
 * lock that would do.
 */
export function resolveTouchLock(world, named, what) {
    const lock = world.activators.find((a) => a.x === named.x && a.y === named.y);
    if (!lock) {
        fail(`${what}: level ${world.level} has no activator at (${named.x},${named.y}); `
            + `it has [${world.activators.map((a) => `${a.tag}@${a.x},${a.y}(t=${a.t})`)
                .join(' ') || 'none'}].`);
    }
    if (!lock.touchRect) {
        fail(`${what}: ${lock.id} is a "${lock.tag}", which does not open on TOUCH — it `
            + `answers group t=${lock.t}. Only the ShieldLock classes press themselves; `
            + 'everything else needs its button, its key or its item.');
    }
    // The R1 rect lesson at the boundary this primitive imports a rect
    // across: a rect with no `right`/`bottom` never overlaps anything, so
    // every check against it would pass and the touch would be green by
    // construction.
    assertRect(lock.touchRect, `${what}: ${lock.id} touch rect`);
    return lock;
}

function runTouch(run, perTick, touch, maxTicks, what) {
    if (run.openActivators === null) {
        fail(`${what}: a touch is a MECHANIC, and the noclip arm does not run it — `
            + '`advance` hands `stepV2` a null activator set, so the walk would pass '
            + 'through the lock whether or not it ever opened, and every check below '
            + 'would be green for a mechanic that was not running. A tape that touches '
            + 'a lock must declare noclip: false.');
    }
    const lock = resolveTouchLock(run.world, touch.lock, what);

    // ⚠ THE POSITIVE CONTROL, BEFORE THE NEGATIVE.
    if (run.openActivators.has(lock.id)) {
        fail(`${what}: ${lock.id} is ALREADY OPEN before the touch begins, so walking `
            + 'into it proves nothing about it. A touch that changes nothing is a check '
            + 'that cannot fail.');
    }
    // The item, checked BEFORE the walk rather than diagnosed from the
    // stall it causes. Without the shield `ShieldLock.update`'s condition is
    // simply false, the lock stays Solid, and the approach below would spend
    // its whole budget pressing into a wall — a timeout naming a waypoint,
    // for a route-ordering defect.
    if (run.inventory[lock.shield] !== true) {
        fail(`${what}: ${lock.id} opens on \`Player.${lock.shield}\`, which the run does `
            + 'NOT have yet. The order is load-bearing — the shield room comes first — '
            + 'and without it the lock never activates at all.');
    }

    // ── the approach ──────────────────────────────────────────────────
    // Aim at the lock's own centre and press until it takes over. The
    // player never gets there: the lock is Solid, so the sweep pins them
    // one pixel outside it, which is exactly where the `x - 1` collide
    // rect is. Hits against THIS lock are the errand; anything else is the
    // ordinary planner-bug throw.
    const aim = {
        x: (lock.rect.x + lock.rect.right) / 2,
        y: (lock.rect.y + lock.rect.bottom) / 2,
    };
    const from = perTick.length;
    let approach = 0;
    while (!run.inputRefused) {
        if (approach >= maxTicks) {
            const s = run.state;
            fail(`${what}: pressed toward ${lock.id} for ${maxTicks} ticks without the `
                + `lock taking over; stalled at (${s.x},${s.y}) in level ${run.level}. `
                + `Its collide rect is [${lock.touchRect.x},${lock.touchRect.right}) x `
                + `[${lock.touchRect.y},${lock.touchRect.bottom}) — the approach has to `
                + 'reach it, so this is a route that arrives beside the lock rather than '
                + 'against it.');
        }
        const held = chooseHeld(run.state, aim, 0);
        perTick.push(held);
        const { transition, hitX, hitY } = run.advance(held);
        approach++;
        if (transition) {
            fail(`${what}: the run crossed from level ${transition.from_level} to `
                + `${transition.to_level} while approaching ${lock.id}. The approach `
                + 'walks into a wall; a trigger on the way to it is a routing defect.');
        }
        const hit = hitX || hitY;
        if (hit && hit.activatorId !== lock.id) {
            const s = run.state;
            fail(`${what}: approaching ${lock.id}, the sweep was blocked by `
                + `${hit.tag ?? hit.cls?.as3 ?? 'a solid'} at (${hit.x},${hit.y}) at `
                + `(${s.x},${s.y}) in level ${run.level}. Only the lock being touched may `
                + 'stop this walk.');
        }
    }

    // ── the window ────────────────────────────────────────────────────
    // Not one span. The count is the GAME's — `Lock.activationStep` fades
    // 0.01 per tick with `Image.alpha` clamping at 0 and the test before the
    // decrement — so the driver waits for the run to say the window closed
    // rather than counting to a number of its own.
    const at = { x: run.state.x, y: run.state.y };
    let window = 0;
    while (run.inputRefused) {
        if (window >= maxTicks) {
            fail(`${what}: ${lock.id}'s input-refused window has run ${maxTicks} ticks `
                + 'without closing. A Lock fades in 101; a window that does not end is a '
                + 'fade that is not running.');
        }
        perTick.push(NO_HELD);
        const { transition } = run.advance(NO_HELD);
        window++;
        if (transition) {
            fail(`${what}: the run crossed from level ${transition.from_level} to `
                + `${transition.to_level} INSIDE ${lock.id}'s window. `);
        }
        // The window is a position-writing ceremony, so the position is not
        // pinned the way a hold's is — but the box must stay inside the
        // collide rect, because `turnOff` restores input only `if (p)`.
        const s = run.state;
        if (!rectsOverlap(playerBoxAt(s.x, s.y), lock.touchRect)) {
            fail(`${what}: window tick ${window} left ${lock.id}'s collide rect, at `
                + `(${s.x},${s.y}). \`ShieldLock.turnOff\` restores \`receiveInput\` only `
                + 'while the player is still inside it, so this run would never get '
                + 'input back.');
        }
    }

    // ⚠ THE EFFECT, not the ceremony. Everything above says the lock took
    // the player over; only this says it opened.
    if (!run.openActivators.has(lock.id)) {
        fail(`${what}: ${lock.id}'s window ended after ${window} tick(s) and it is STILL `
            + 'SOLID. The fade and the input window are driven by the same `activate` '
            + 'flag, so a window that ends without opening the lock means the two have '
            + 'come apart.');
    }
    const record = run.lockSnaps[run.lockSnaps.length - 1];
    if (!record || record.id !== lock.id) {
        fail(`${what}: the run recorded no completed touch-lock window for ${lock.id}.`);
    }
    return {
        lock: { id: lock.id, tag: lock.tag, x: lock.x, y: lock.y },
        shield: lock.shield,
        persistTag: lock.persistTag,
        approach,
        window,
        from,
        at,
        snappedTo: record.y,
    };
}

/**
 * ── THE COLLECT PRIMITIVE (R3) ────────────────────────────────────────
 *
 * Every rung before this one took an item by ENTERING ITS ROOM: `grants`
 * is a property write on the arrival tick, so a leg could stop at the door.
 * R3 retires that, and the difference is not a smaller tolerance — it is a
 * different verb. The player has to stand ON the pickup and then talk its
 * ceremony through:
 *
 *     { x: 56, y: 56, collect: { pickup: { x: 48, y: 48 } } }
 *
 * ⚠ AND EVERY PLANNER ON THIS LADDER REFUSES TO WALK INTO ONE. A pickup is
 * an R0 avoid volume, priced because walking over one freezes the game
 * behind a dialogue an unaware tape cannot dismiss. So the leg exempts the
 * pickup it is collecting — the hold's button exemption, one volume over —
 * and the approach below drives the last pixels itself.
 *
 * ⚠ THE PRESSES ARE SPACED, AND THAT IS PHYSICS RATHER THAN TIDINESS.
 * `slashTimer` is 20 and the sword's own text says "double tap to dash": a
 * press that lands once the ceremony is over reaches
 * `useItem(Main.primary)`, so one is a swing and two inside twenty ticks is
 * a DASH that moves the player. The cadence is `PRESS_GAP`, and the
 * executor asserts that NO press lands after the ceremony ends.
 *
 * ⚠ The count of releases is the CEREMONY's, not the author's. It depends
 * on the text — `NPC.talk` sets `currentCharacter = page.length - 1`, so a
 * release that lands mid-type-out fast-forwards the page instead of turning
 * it — so the loop presses until the run reports the pickup collected
 * rather than counting to a number.
 */
/** Ticks between the X releases that page a ceremony. See above. */
export const PRESS_GAP = 8;

/** Shape-check a `collect` before anything is planned or driven with it. */
export function assertCollect(collect, what) {
    if (collect === null || typeof collect !== 'object' || Array.isArray(collect)) {
        fail(`${what}: collect must be { pickup: {x, y} }`);
    }
    const p = collect.pickup;
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
        fail(`${what}: collect.pickup must be the pickup's OEL {x, y}`);
    }
}

/**
 * The pickup a collect NAMES, resolved through the world's own table — by
 * OEL coordinates, never by index and never by searching for one that
 * would do.
 */
export function resolvePickup(world, named, what) {
    const pickup = (world.pickups ?? []).find((p) => p.x === named.x && p.y === named.y);
    if (!pickup) {
        fail(`${what}: level ${world.level} has no pickup at (${named.x},${named.y}); `
            + `it has [${(world.pickups ?? []).map((p) => `${p.tag}@${p.x},${p.y}`)
                .join(' ') || 'none'}]. A collect names its pickup by OEL coordinates.`);
    }
    assertRect(pickup.rect, `${what}: ${pickup.tag}@${pickup.x},${pickup.y} rect`);
    return pickup;
}

function runCollect(run, perTick, collect, maxTicks, what) {
    const pickup = resolvePickup(run.world, collect.pickup, what);
    const before = run.collected.length;
    const level = run.level;

    // ── the approach ──────────────────────────────────────────────────
    // Aim at the pickup's centre and press until the ceremony takes over.
    // A pickup is not solid, so any hit on the way is the ordinary
    // planner-bug throw.
    const aim = {
        x: (pickup.rect.x + pickup.rect.right) / 2,
        y: (pickup.rect.y + pickup.rect.bottom) / 2,
    };
    const from = perTick.length;
    let approach = 0;
    while (!run.inCeremony) {
        if (approach >= maxTicks) {
            const s = run.state;
            fail(`${what}: walked at ${pickup.tag}@${pickup.x},${pickup.y} for `
                + `${maxTicks} ticks without touching it; stalled at (${s.x},${s.y}) in `
                + `level ${run.level}. Its volume is [${pickup.rect.x},`
                + `${pickup.rect.right}) x [${pickup.rect.y},${pickup.rect.bottom}).`);
        }
        const held = chooseHeld(run.state, aim, 0);
        perTick.push(held);
        const { transition, hitX, hitY } = run.advance(held);
        approach++;
        if (transition) {
            fail(`${what}: the run crossed from level ${transition.from_level} to `
                + `${transition.to_level} while approaching `
                + `${pickup.tag}@${pickup.x},${pickup.y}.`);
        }
        const hit = hitX || hitY;
        if (hit) {
            const s = run.state;
            fail(`${what}: approaching ${pickup.tag}@${pickup.x},${pickup.y}, the sweep `
                + `was blocked by ${hit.tag ?? hit.cls?.as3 ?? 'a solid'} at `
                + `(${hit.x},${hit.y}) at (${s.x},${s.y}). A pickup is not solid, so the `
                + 'planner and the geometry disagree about the approach.');
        }
    }

    // ── the ceremony ──────────────────────────────────────────────────
    // ⚠ THE MOVEMENT KEY IS ALREADY RELEASED: the approach loop pushed its
    // last held set on the tick BEFORE contact, and everything from here is
    // either a press or nothing. So no movement span overlaps the freeze.
    let releases = 0;
    let sinceRelease = PRESS_GAP;
    let pressing = false;
    let ticks = 0;
    while (run.collected.length === before) {
        if (ticks >= maxTicks) {
            fail(`${what}: ${pickup.tag}@${pickup.x},${pickup.y}'s ceremony has not `
                + `finished after ${maxTicks} ticks and ${releases} release(s). A `
                + 'dialogue advances on `Input.released`, so a ceremony that never ends '
                + 'means the releases are not reaching `NPC.talk()`.');
        }
        let held = NO_HELD;
        if (pressing) { pressing = false; sinceRelease = 0; releases++; } else if (
            sinceRelease >= PRESS_GAP) { held = TALK_HELD; pressing = true; }
        perTick.push(held);
        const { transition } = run.advance(held);
        ticks++;
        sinceRelease++;
        if (transition) {
            fail(`${what}: the run crossed from level ${transition.from_level} to `
                + `${transition.to_level} DURING a ceremony. A frozen player cannot walk `
                + 'into a trigger, so this is a pickup standing inside one.');
        }
    }

    // ⚠ NO PRESS AFTER THE CEREMONY. The loop exits on the tick the pickup
    // was taken, and the tick it exits on carried either nothing or the
    // release that ended it — never a fresh press. Asserted rather than
    // reasoned, because the consequence is a sword swing at best and a dash
    // that moves the player at worst.
    if (pressing) {
        fail(`${what}: the ceremony ended with a press still down, so its release would `
            + `land on a live frame and reach useItem(Main.primary).`);
    }

    const record = run.collected[run.collected.length - 1];
    if (!record || run.collected.length !== before + 1) {
        fail(`${what}: expected exactly one new ceremony, got `
            + `${run.collected.length - before}.`);
    }
    if (record.level !== level) {
        fail(`${what}: the ceremony that ran was in level ${record.level}, not `
            + `${level}.`);
    }
    return {
        pickup: { tag: pickup.tag, x: pickup.x, y: pickup.y },
        item: record.item,
        level,
        approach,
        ceremony: ticks,
        releases,
        from,
    };
}

/**
 * Drive the run to `target`, one bang-bang tick at a time.
 *
 * `until` is `'arrival'` (v1's criterion: within tolerance AND stopped) or
 * `'transition'` (keep pressing toward the trigger until the world swaps —
 * an exit is reached by TOUCHING it, not by parking on it, and the trigger
 * fires from the position the previous tick left).
 */
function drive(run, target, perTick, {
    until, tolerance, maxTicks, what, avoidVolumes, contacts = EMPTY_CONTACTS,
    extraVolumes = EMPTY_VOLUMES, crossTo = null, grazes = null,
}) {
    let ticks = 0;
    const touched = [];
    for (;;) {
        if (until === 'arrival' && hasArrived(run.state, target, tolerance)) {
            // ⚠ A GRAZE THAT STILL ARRIVES IS NOT A RE-PLAN, and that is the
            // whole of the distinction. See the `grazes` docblock.
            if (touched.length > 0) grazes.push(...touched);
            return null;
        }
        if (ticks >= maxTicks) {
            const s = run.state;
            fail(`${what}: not reached within ${maxTicks} ticks; stalled at `
                + `(${s.x},${s.y}) v=(${s.vx},${s.vy}) in level ${run.level}, `
                + `aiming at (${target.x},${target.y})`
                + `${touched.length ? `, after grazing ${touched.length} solid(s): `
                    + `${touched.slice(0, 3).map((g) => g.what).join('; ')}` : ''}.`);
        }
        // ⚠ ONCE A TRANSPORT IS IN FLIGHT, THE DRIVER PRESSES NOTHING.
        // The twenty fall-out ticks are ordinary live ticks — `receiveInput
        // = false` stops input, not the tick counter — so the controller
        // would happily keep choosing keys for them, and the game would
        // ignore every one. A span one consumer honours and the other drops
        // is the asymmetry this format exists to prevent, so the driver
        // emits the same nothing the game acts on.
        const held = run.state.fall ? NO_HELD : chooseHeld(run.state, target, tolerance);
        perTick.push(held);
        // Where the player was when the edge could have fired. A pit's
        // identity is the tile UNDER them, and after `advance` they are in
        // the next level.
        const before = { x: run.state.x, y: run.state.y };
        const { transition, hitX, hitY } = run.advance(held);
        ticks++;

        if (transition) {
            if (until === 'transition') return transition;
            // ⚠ AN EARLY CROSSING THROUGH THE LEG'S OWN EXIT IS THE ERRAND,
            // not a defect — and telling the two apart is what `crossTo` is
            // for. The leg's exit is exempt from being an obstacle (walking
            // into it is the whole point), so A* may route THROUGH it to
            // reach the far side of its 16x16 volume, and the trigger then
            // fires two waypoints before the planner expected. R1 never met
            // it: a trigger was one tile-lattice node, so the aim point and
            // the volume were the same cell.
            //
            // Accepted ONLY on identity, never on "it went somewhere
            // plausible": the destination level AND the arrival position
            // must be the named teleporter's own. A different trigger to the
            // same level would land somewhere else and still be caught here,
            // which is the case the original throw exists for.
            if (crossTo && transition.to_level === crossTo.level
                && (crossTo.pit
                    ? rectsOverlap(terrainProbeRect(before.x, before.y), crossTo.pit.rect)
                    : (run.state.x === crossTo.arrival.x
                        && run.state.y === crossTo.arrival.y))) {
                return transition;
            }
            fail(`${what}: the run crossed from level ${transition.from_level} to `
                + `${transition.to_level} at tick ${transition.t} without being asked to`
                + `${crossTo ? ` — it was aiming at ${crossTo.pit
                    ? `the pit tile (${crossTo.pit.tx},${crossTo.pit.ty}) and fell from `
                    + `(${before.x},${before.y})`
                    : `the exit to level ${crossTo.level}, whose arrival is `
                    + `(${crossTo.arrival.x},${crossTo.arrival.y}), and landed at `
                    + `(${run.state.x},${run.state.y})`}` : ''}. `
                + 'A live teleporter volume is supposed to be an obstacle to the planner '
                + '— this is a routing defect, not a surprise to absorb.');
        }
        // A hit means the level geometry stopped a move the planner had
        // certified clear. THROW: re-planning here would hide the
        // disagreement, because the tape would still reach the target and
        // every downstream assertion would pass.
        const hit = hitX || hitY;
        if (hit && grazes) {
            // Recorded and carried, not thrown on — YET. If the drive goes on
            // to arrive, the sweep was an overshoot the wall absorbed and
            // nothing was re-planned; if it stalls, every graze is attached
            // to the failure above.
            const s = run.state;
            touched.push({
                what: `${hit.tag ?? hit.cls?.as3 ?? 'a solid'} at (${hit.x},${hit.y}) on `
                    + `the ${hitX ? 'X' : 'Y'} axis, at (${s.x},${s.y}) in level `
                    + `${run.level}, aiming at (${target.x},${target.y})`,
                level: run.level,
                tag: hit.tag ?? hit.cls?.as3 ?? null,
                x: hit.x ?? null,
                y: hit.y ?? null,
            });
        } else if (hit) {
            const s = run.state;
            fail(`${what}: PLANNER BUG — the sweep was blocked by `
                + `${hit.tag ?? hit.cls?.as3 ?? 'a solid'} at (${hit.x},${hit.y}) on the `
                + `${hitX ? 'X' : 'Y'} axis, at (${s.x},${s.y}) in level ${run.level}, `
                + `en route to (${target.x},${target.y}). The planner certified this `
                + 'segment clear, so either the route is too tight for the controller\'s '
                + 'overshoot or the geometry and the plan disagree. Not re-planned on '
                + 'purpose: a silent re-plan turns a model defect into a green run.');
        }
        // R0's counterpart to the hit-throw, and it is a DETECTOR rather
        // than a diagnostic: an avoid volume stops nothing in the game, so
        // the run walks straight through one and produces a perfectly
        // plausible stream — which the real game then answers with 150
        // frozen frames, a dialogue the tape cannot dismiss, or a shifted
        // RNG stream. There is no wall here to notice, so this check IS the
        // noticing. The smoother is approximate in two bounded ways (§ the
        // controllerPathClear docblock); this is what makes that safe.
        if (avoidVolumes) {
            const s = run.state;
            const box = playerBoxAt(s.x, s.y);
            const effect = extraVolumes.find((e) => e.level === run.level
                && rectsOverlap(box, e.rect));
            if (effect) {
                fail(`${what}: the route entered ${effect.tag} at `
                    + `(${effect.rect.x},${effect.rect.y}) in level ${run.level} at `
                    + `(${s.x},${s.y}). ${effect.why} The static census cannot see this `
                    + 'volume, so this check is the only place it can be caught.');
            }
            const v = run.world.avoidVolumesAt(box, { x: s.x, y: s.y })
                .find((h) => !contacts.has(contactKey(h)));
            if (v) {
                fail(`${what}: the route entered a ${v.kind} — ${v.blocker.tag} at `
                    + `(${v.blocker.x},${v.blocker.y}) in level ${run.level} — at `
                    + `(${s.x},${s.y}). ${v.blocker.effect ?? 'A pickup freezes the game '
                    + 'behind a dialogue only Input.released(V) clears, during frozen '
                    + 'frames the tape never reaches.'} Nothing in the game stops the `
                    + `player here, so this is the only place it can be caught.`);
            }
        }
    }
}

/**
 * Synthesize a tape for a list of cross-level legs.
 *
 * A target may additionally carry a MECHANIC: `hold` (stand on a button —
 * see THE HOLD PRIMITIVE) or `touch` (walk into a shield lock — see THE
 * TOUCH PRIMITIVE). Both are declared by PRESENCE, so a `null` written where
 * an omission was meant is a named failure rather than a silent skip.
 *
 * @param {Array<{level:number, targets?:Array<{x,y}>, exit?:{x,y}}>} legs
 * @param {object}   opts
 * @param {Function} opts.levelSource         `(level) => levelRecord` (required)
 * @param {object}   [opts.boot]              defaults to the build's baked-in spawn
 * @param {number}   [opts.tolerance]
 * @param {number}   [opts.maxTicksPerTarget]
 * @param {string}   [opts.name]
 * @returns {{tape, arrivals, transitions, waypoints}} — `arrivals` is one
 *   record per TARGET (`{leg, index, target, tick, x, y, level}`),
 *   `transitions` the `{t, from_level, to_level}` records the run produced,
 *   and `waypoints` the planned points per leg, for tests and for reading a
 *   fixture back later.
 */
export function synthesizeLegs(legs, opts = {}) {
    if (!Array.isArray(legs) || legs.length === 0) {
        fail('synthesizeLegs: legs must be a non-empty array');
    }
    const {
        levelSource,
        boot = { level: 0, x: 80, y: 128 },
        tolerance = DEFAULT_TOLERANCE,
        maxTicksPerTarget = DEFAULT_MAX_TICKS_PER_TARGET,
        name,
        relax = null,
        extraVolumes = EMPTY_VOLUMES,
        // The A* cell pitch. Defaults to TILE_SIZE, which is what every
        // committed R1 tape was planned under — see the DEFAULT_LATTICE
        // docblock for why this is opt-in rather than a global refinement.
        lattice = DEFAULT_LATTICE,
        /**
         * The clearance A* KEEPS FROM A SOLID, in pixels.
         *
         * ⚠ It deletes cells, so it is not a "more is safer" number: raise
         * it and the clearance pass finds no path at all, after which
         * `planWaypoints` walks its ladder down to nothing and the route
         * loses the clearance everywhere rather than in the one tight spot.
         * R2 traded one planner throw for an earlier one by moving a single
         * number from 2 to 6. Two is enough to dodge the half-pixel
         * clearances the smoother's fallback used to keep, and small enough
         * that a 16 px corridor still has a column.
         */
        nodeMargin = 0,
        // See `plannerObstacleAt`: a trigger's clearance is its own number
        // and survives the clearance ladder. Zero is R1's behaviour.
        triggerMargin = 0,
        /**
         * ⚠ WHEN A SWEEP THAT WAS BLOCKED IS NOT A DEFECT.
         *
         * The executor throws on any hit, because a hit means the geometry
         * stopped a move the planner had certified and a silent re-plan
         * would turn a model defect into a green run. With collision on and
         * an eight-pixel lattice that stopped being the whole truth: the
         * bang-bang controller OVERSHOOTS a waypoint before braking back,
         * so it can graze a wall a pixel past its target and then arrive
         * perfectly. Three different levels produced exactly that, and no
         * amount of margin fixes it — the overshoot is downstream of the
         * plan.
         *
         * So a graze is fatal only if the drive then FAILS TO ARRIVE.
         * Nothing is re-planned either way; what changes is whether an
         * absorbed overshoot ends the walk. Every graze is collected and
         * returned, and the tape's own description carries the count, so a
         * route that grazes forty times cannot look like one that grazes
         * none.
         *
         * Defaults FALSE: R1's twenty-three tapes were planned under the
         * strict rule and never grazed once.
         */
        allowGrazes = false,
    } = opts;
    for (const [what, v] of [['nodeMargin', nodeMargin], ['triggerMargin', triggerMargin]]) {
        if (!Number.isFinite(v) || v < 0) {
            fail(`synthesizeLegs: opts.${what} must be a non-negative number, got `
                + `${JSON.stringify(v)}`);
        }
    }
    if (!Number.isInteger(lattice) || lattice <= 0 || TILE_SIZE % lattice !== 0) {
        fail(`synthesizeLegs: opts.lattice must be a positive integer divisor of `
            + `${TILE_SIZE}, got ${JSON.stringify(lattice)}. A pitch that does not `
            + 'divide the tile puts node centres inside tile edges rather than clear of '
            + 'them.');
    }
    // A volume whose rect has no `right`/`bottom` never overlaps anything,
    // so every check against it passes and the route is "clear" by
    // construction. Loud here, once, rather than silently green forever.
    extraVolumes.forEach((v, i) => assertRect(v.rect,
        `opts.extraVolumes[${i}] (${v.tag}) rect`));
    if (typeof levelSource !== 'function') {
        fail('synthesizeLegs: opts.levelSource (level) => levelRecord is required — '
            + 'the v2 rung plans against real geometry and there is no default for it');
    }
    // ⚠ ONE object decides the plan, the run AND the emitted tape. Splitting
    // them is how a driver plans for a run it does not emit: the whole point
    // of `relax` being a single argument is that `planWaypoints`,
    // `createLevelRun` and `buildTape` cannot be given different ideas of
    // which experiment this is.
    //
    // ⚠⚠ `noclip` JOINED THE OBJECT AT R2, and it is the reason this
    // paragraph is not decoration. Until R2 the driver read
    // `noclip: Boolean(relax)` — "a relaxed walk is a noclip walk" — which
    // was true of every tape that existed and is false of every R2 tape:
    // R2's whole subject is a walk that keeps `noDamage`, `noHazards`,
    // `grants` and a persistence clear list while putting the SOLIDS BACK.
    // Derived from the presence of a sibling field, `noclip` was one edit
    // away from a planner that routed around walls the emitted tape would
    // walk through, or the reverse. It is declared now, like the rest.
    if (relax !== null) {
        for (const field of ['noclip', 'noDamage', 'noHazards', 'grants']) {
            if (relax[field] === undefined) {
                fail(`synthesizeLegs: opts.relax must declare ${field}. A relaxation `
                    + 'with a default is a tape the planner and the game read '
                    + 'differently.');
            }
        }
        if (typeof relax.noclip !== 'boolean') {
            fail(`synthesizeLegs: opts.relax.noclip must be a boolean, got `
                + `${JSON.stringify(relax.noclip)}`);
        }
        // `persistence` is the ONE optional field, and it is optional by
        // PRESENCE: declaring it (even as []) makes a version 3 tape,
        // omitting it makes the version 2 tape R0 and R1 emit. See
        // `buildTape`'s docblock for why the alternative — deciding on the
        // value — is the R0 value-vs-presence bug.
        if (relax.persistence !== undefined && !Array.isArray(relax.persistence)) {
            fail('synthesizeLegs: opts.relax.persistence must be an array of '
                + '{level, tag, note} clears, or absent for a version 2 tape');
        }
    }
    const noclip = relax ? relax.noclip : false;
    const basePlan = relax
        ? {
            noclip, noHazards: relax.noHazards, avoidVolumes: true,
            lattice, nodeMargin, triggerMargin,
        }
        : { lattice, nodeMargin, triggerMargin };

    const run = createLevelRun({
        levelSource,
        boot,
        noclip,
        ...(relax ? {
            noHazards: relax.noHazards,
            noDamage: relax.noDamage,
            grants: relax.grants,
            persistence: relax.persistence ?? [],
            // A relaxed walk consults no collider, so it must not be stopped
            // by one being unpriced — that is the whole of slice 1b. A walk
            // with collision ON is the opposite: it consults EVERY role, and
            // an unpriced collider must stop it by name. R2 paid that bill
            // for the levels its walk enters.
            roles: noclip ? RELAXED_ROLES : ROLES,
        } : {}),
    });
    const perTick = [];
    const arrivals = [];
    const waypoints = [];
    const holds = [];
    const touches = [];
    const collects = [];
    const grazes = allowGrazes ? [] : null;

    legs.forEach((leg, li) => {
        if (run.level !== leg.level) {
            fail(`legs[${li}] declares level ${leg.level} but the run is in level `
                + `${run.level}. A leg's level is an ASSERTION about where the previous `
                + "leg's exit landed, not a request to go there.");
        }
        // What the game has already put the player inside, checked against
        // what the leg says it starts inside — see the FORCED CONTACTS
        // docblock. Both directions are named failures.
        const standing = contactsAt(run.world, run.state.x, run.state.y,
            { avoidVolumes: Boolean(relax) });
        const declared = new Set(leg.contacts ?? []);
        const undeclared = standing.filter((k) => !declared.has(k));
        if (undeclared.length > 0) {
            fail(`legs[${li}] starts at (${run.state.x},${run.state.y}) in level `
                + `${leg.level} INSIDE ${undeclared.join(', ')}, which the leg does not `
                + 'declare. An arrival is not a position the planner chose, so a leg may '
                + 'declare the contacts it lands in — but an undeclared one is a route '
                + 'that has changed under a geometry or pricing edit, and the effect '
                + '(a trigger, a dialogue freeze, a persistence write) is real.');
        }
        const stale = [...declared].filter((k) => !standing.includes(k));
        if (stale.length > 0) {
            fail(`legs[${li}] declares contact(s) ${stale.join(', ')} that the run is `
                + `NOT in at (${run.state.x},${run.state.y}). A stale declaration `
                + 're-permits something the route no longer touches.');
        }
        /**
         * ⚠ A HOLD'S BUTTON IS A CONTACT THE LEG IS PERMITTED TO TOUCH.
         *
         * A `button` is an R0 avoid volume — the presser rect IS the
         * proximity-hazard rect, one geometry answering two questions — so
         * without this the planner refuses to route onto it and, worse, the
         * executor's volume detector throws the moment the walk arrives on
         * the very thing the hold exists to stand on.
         *
         * The exemption is added to the PLAN set only. The leg-start
         * assertions above still read `leg.contacts` alone, so a hold
         * cannot smuggle in a declaration the leg does not actually make on
         * arrival, and a stale one is still a throw. It is leg-scoped
         * rather than moment-scoped, which is the same bounded
         * over-permission the FORCED CONTACTS docblock records: a leg that
         * clipped its own button somewhere other than the hold would not be
         * caught here. What catches that instead is the hold's own
         * verification — the button it stands on is the button it names.
         */
        const legContacts = new Set(declared);
        // ⚠ PRESENCE, not truthiness. A `hold: null` written by a route
        // generator that meant to omit it would otherwise be silently
        // skipped, and `assertHold`'s own null branch would be unreachable.
        (leg.targets ?? []).forEach((t, ti) => {
            if (t?.hold === undefined) return;
            const what = `legs[${li}] level ${leg.level} target ${ti} hold`;
            assertHold(t.hold, what);
            const p = resolvePresser(run.world, t.hold.presser, what);
            legContacts.add(`proximity-hazard:${p.tag}@${p.x},${p.y}`);
        });
        /**
         * ⚠ AND A TOUCH'S LOCK IS ONE TOO, for the same reason and with the
         * same bound. A `shieldlock` is an R0 avoid volume — its `lock-snap`
         * hazard rect IS the collide rect the mechanic uses — so without
         * this the planner refuses to route up to it and the executor's
         * volume detector throws on the very thing the touch exists to walk
         * into. Leg-scoped, so a leg that clipped its own lock somewhere
         * other than the touch would not be caught here; what catches that
         * is the touch's own shut-before/open-after verification.
         */
        (leg.targets ?? []).forEach((t, ti) => {
            if (t?.touch === undefined) return;
            const what = `legs[${li}] level ${leg.level} target ${ti} touch`;
            assertTouch(t.touch, what);
            const l = resolveTouchLock(run.world, t.touch.lock, what);
            legContacts.add(`proximity-hazard:${l.tag}@${l.x},${l.y}`);
        });
        /**
         * ⚠ A COLLECT'S PICKUP IS **NOT** EXEMPTED, and that is the
         * opposite of the hold and the touch on purpose.
         *
         * A button and a shield lock are things the leg walks INTO and
         * stops at; a pickup is a thing the leg walks ONTO and cannot leave
         * until its dialogue is paged through. Exempting it leg-wide lets
         * A* route STRAIGHT THROUGH the item on the way to somewhere else —
         * and L89's feather is exactly that case: its approach cell is on
         * the far side, the planner cut across the pickup, the ceremony
         * fired mid-drive, and the waypoint was never reached. A stall
         * 1,500 ticks long, for a route that was one waypoint from correct.
         *
         * So the pickup stays an obstacle to the PLANNER, which routes
         * around it to the approach point, and `runCollect` walks the last
         * pixels in itself — where the ceremony is the errand rather than
         * an accident. The shape is validated by `assertCollect` here so a
         * malformed one is still a named failure before anything is driven.
         */
        (leg.targets ?? []).forEach((t, ti) => {
            if (t?.collect === undefined) return;
            const what = `legs[${li}] level ${leg.level} target ${ti} collect`;
            assertCollect(t.collect, what);
            resolvePickup(run.world, t.collect.pickup, what);
        });
        // A persistence effect exists only from the leg that CAUSED it. The
        // first visit to L37 is before the button is pressed and the rock is
        // still parked at y = -16; pricing it there would be over-avoiding a
        // volume that does not exist yet, in the one level whose exit sits
        // two tiles from it.
        const legVolumes = extraVolumes.filter((v) => li >= v.fromLeg);
        const plan = { ...basePlan, contacts: legContacts, extraVolumes: legVolumes };
        /**
         * The leg's plan AS OF NOW. Everything in `plan` is a decision the
         * caller made about this leg; `openActivators` is the one input that
         * changes DURING it, so it is read at the moment each waypoint list
         * is computed rather than captured once at the top. A hold opens a
         * lock in the middle of a leg — planning the leg's later targets
         * against the state before the hold would route around a door the
         * run has already opened.
         */
        //
        // ⚠ `takenPickups` joins it at R3, and it is the same kind of thing:
        // a pickup that has been collected is GONE, so the tile the walk is
        // standing on the moment a ceremony ends must stop being an
        // obstacle — otherwise the next plan fails at its own START tile.
        const contactsNow = () => new Set([...legContacts, ...run.takenPickups]);
        const planNow = (extra) => ({
            ...plan, contacts: contactsNow(), openActivators: run.openActivators, ...extra,
        });

        const legWaypoints = [];
        (leg.targets ?? []).forEach((target, ti) => {
            if (!Number.isFinite(target?.x) || !Number.isFinite(target?.y)) {
                fail(`legs[${li}].targets[${ti}] must be {x, y} finite numbers`);
            }
            const wps = planWaypoints(run.world, run.state, target, null, planNow());
            legWaypoints.push(...wps);
            wps.forEach((wp, wi) => drive(run, wp, perTick, {
                until: 'arrival',
                tolerance,
                maxTicks: maxTicksPerTarget,
                avoidVolumes: Boolean(relax),
                contacts: contactsNow(),
                extraVolumes: legVolumes,
                grazes,
                what: `legs[${li}] level ${leg.level} target ${ti} waypoint ${wi} `
                    + `(${wp.x},${wp.y})`,
            }));
            // Record-then-act indexing: after N recorded ticks the player
            // has completed N movement ticks, so the arrival observation is
            // at index perTick.length.
            arrivals.push({
                leg: li,
                index: ti,
                target: { x: target.x, y: target.y },
                tick: perTick.length,
                x: run.state.x,
                y: run.state.y,
                level: run.level,
            });
            if (target.hold !== undefined) {
                const from = perTick.length;
                const record = runHold(run, perTick, target.hold,
                    `legs[${li}] level ${leg.level} target ${ti} hold`);
                holds.push({
                    leg: li, index: ti, level: leg.level, from, to: perTick.length,
                    ...record,
                });
            }
            if (target.touch !== undefined) {
                const record = runTouch(run, perTick, target.touch, maxTicksPerTarget,
                    `legs[${li}] level ${leg.level} target ${ti} touch`);
                touches.push({
                    leg: li, index: ti, level: leg.level, to: perTick.length, ...record,
                });
            }
            if (target.collect !== undefined) {
                const record = runCollect(run, perTick, target.collect, maxTicksPerTarget,
                    `legs[${li}] level ${leg.level} target ${ti} collect`);
                collects.push({
                    leg: li, index: ti, to: perTick.length, ...record,
                });
            }
        });

        if (!leg.exit) {
            if (li !== legs.length - 1) {
                fail(`legs[${li}] has no exit but is not the last leg — a leg that is `
                    + 'not the last one has to say how the run leaves it.');
            }
            waypoints.push(legWaypoints);
            return;
        }
        if (li === legs.length - 1) {
            fail(`legs[${li}] is the last leg but declares an exit. The driver asserts a `
                + "crossing against the NEXT leg's level; with no next leg there is "
                + 'nothing to assert and the tape would end mid-transition.');
        }

        // ── PIT EXIT ───────────────────────────────────────────────
        // `exit: {pit: {tx, ty}}` — walk onto that ONE pit tile, then let
        // the game carry the player. The caller names the pit exactly as it
        // names a teleporter; the driver never searches the fall graph.
        if (leg.exit.pit) {
            const { tx, ty } = leg.exit.pit;
            const destination = legs[li + 1].level;
            const pit = run.world.pitTiles.find((t) => t.tx === tx && t.ty === ty);
            if (!pit) {
                fail(`legs[${li}].exit names pit tile (${tx},${ty}) in level `
                    + `${leg.level}, which has no pit there. Its pits are `
                    + `[${run.world.pitTiles.map((t) => `(${t.tx},${t.ty})`).join(' ')}].`);
            }
            const ft = run.world.fallthrough;
            if (!ft) {
                fail(`legs[${li}] falls down a pit in level ${leg.level}, which has NO `
                    + 'control block — that pit is lethal, not transport.');
            }
            if (ft.level !== destination) {
                fail(`legs[${li}].exit falls to level ${ft.level}, but legs[${li + 1}] `
                    + `declares level ${destination}.`);
            }
            // ⚠ THE SAME ONCE-ONLY PROBLEM, one volume over. `allowPit`
            // exempts the named tile for the whole leg, so A* would happily
            // cross it en route to somewhere else and the fall would fire
            // early. Approached from outside, like a trigger.
            const legPlan = planNow({ allowPit: { tx, ty } });
            const centre = tileCentre(tx, ty);
            const wps = planWaypoints(run.world, run.state, centre, null, legPlan);
            legWaypoints.push(...wps);
            // The pit's counterpart to a teleporter's early crossing, and
            // the identity is the TILE rather than an arrival position: all
            // of a level's pits fall to the same level, so "it went where I
            // wanted" proves nothing. What proves it is that the player was
            // standing on the tile the leg NAMED when the edge fired.
            const crossTo = { level: destination, pit };
            let fell = false;
            for (let wi = 0; wi < wps.length && !fell; wi++) {
                const wp = wps[wi];
                const last = wi === wps.length - 1;
                const t = drive(run, wp, perTick, {
                    until: last ? 'transition' : 'arrival',
                    tolerance,
                    maxTicks: maxTicksPerTarget,
                    avoidVolumes: Boolean(relax),
                    contacts: contactsNow(),
                    extraVolumes: legVolumes,
                    grazes,
                    crossTo,
                    what: `legs[${li}] level ${leg.level} pit exit (${tx},${ty}) `
                        + `waypoint ${wi} (${wp.x},${wp.y})`,
                });
                if (t) { fell = true; break; }
                if (last) {
                    fail(`legs[${li}] reached pit tile (${tx},${ty}) without falling. `
                        + 'The edge is a RAW state change to 6 while onGround, so this '
                        + 'means the route arrived already resolving that tile.');
                }
            }
            // The arrival is mid-air: the fall-from-ceiling descent still has
            // to land before the next leg can plan from a real position.
            coastThroughTransport(run, perTick, maxTicksPerTarget,
                `legs[${li}] pit exit (${tx},${ty})`);
            waypoints.push(legWaypoints);
            return;
        }

        const { index, teleporter } = findExit(run.world, leg.exit);
        const destination = legs[li + 1].level;
        if (teleporter.to !== destination) {
            fail(`legs[${li}].exit (${leg.exit.x},${leg.exit.y}) goes to level `
                + `${teleporter.to}, but legs[${li + 1}] declares level ${destination}.`);
        }
        // Aim at the trigger's CENTRE: it is 16x16 and the player box is
        // 4x5, so the centre is the point furthest from any neighbouring
        // trigger — which matters, because two triggers firing on one tick
        // is a named error in the physics (level 0's own west pair overlaps
        // for y in (141,146), with different arrivals).
        const centre = {
            x: teleporter.rect.x + TILE_SIZE / 2,
            y: teleporter.rect.y + TILE_SIZE / 2,
        };
        const wps = planWaypoints(run.world, run.state, centre, index, planNow());
        legWaypoints.push(...wps);
        const crossTo = { level: destination, arrival: { ...teleporter.arrival } };
        let crossed = false;
        for (let wi = 0; wi < wps.length && !crossed; wi++) {
            const wp = wps[wi];
            const last = wi === wps.length - 1;
            const t = drive(run, wp, perTick, {
                until: last ? 'transition' : 'arrival',
                tolerance,
                maxTicks: maxTicksPerTarget,
                avoidVolumes: Boolean(relax),
                contacts: contactsNow(),
                extraVolumes: legVolumes,
                grazes,
                crossTo,
                what: `legs[${li}] level ${leg.level} exit (${leg.exit.x},${leg.exit.y}) `
                    + `waypoint ${wi} (${wp.x},${wp.y})`,
            });
            if (t) { crossed = true; break; }
            if (last) {
                fail(`legs[${li}] reached the teleporter at (${leg.exit.x},${leg.exit.y}) `
                    + 'without triggering it. The trigger volume is 16x16 and the aim '
                    + 'point is its centre, so this means the overlap test disagrees '
                    + 'with the geometry.');
            }
        }
        waypoints.push(legWaypoints);
    });

    // A grant that never fired is a ROUTE CLAIM that stopped being true —
    // and here it is worse than in `runTape`, because the driver PLANNED the
    // route: a grant naming a level the plan does not enter means the legs
    // and the grants disagree about what walk this is.
    if (relax && run.unfiredGrantLevels.length > 0) {
        fail(`the legs grant items in level(s) ${run.unfiredGrantLevels.join(', ')}, `
            + 'which the planned walk never enters. A grant fires on FIRST ENTRY, so '
            + 'either the legs stopped covering that room or the grant is stale.');
    }

    // ⚠ `...relax` and nothing else. Spreading a `noclip` of this module's
    // own choosing OVER the relax object — which is what this line did
    // until R2 — is precisely the split the docblock above forbids: the
    // tape would have said one thing and the plan another, and only the
    // game would have found out.
    const tape = buildTape(perTick, boot, name, relax ? { ...relax } : { noclip: false });

    // The runtime's tape budget, measured at R3 slice 0 and enforced HERE
    // because this is where a plan becomes an artifact. R2 discovered the
    // budget by exceeding it and losing a recording deadline to a game that
    // refused the tape at load; the driver refuses rather than recovers, and
    // this is the same rule applied to the one failure that happens after
    // the driver has already succeeded.
    assertTapeWithinRuntimeBudget(tape, name ? `tape "${name}"` : 'the synthesized tape');

    return {
        tape,
        arrivals,
        transitions: run.transitions.map((t) => ({ ...t })),
        waypoints,
        // One record per HOLD the run actually verified: which button, for
        // how many ticks, over which tick range, and which responders it
        // opened. The tape itself is only empty spans, so this is the ONLY
        // place a consumer can find out that the walk holds anything at all.
        holds: holds.map((h) => ({ ...h, opened: [...h.opened] })),
        // One record per TOUCH the run verified: which lock, which shield
        // opened it, how long the approach and the input-refused window ran,
        // and the y the lock snapped the player to. As with `holds`, the tape
        // is only spans and empty ticks, so this is the only place a consumer
        // can learn the walk opens anything by hand.
        touches: touches.map((t) => ({ ...t })),
        // One record per ITEM the run walked onto and talked through: which
        // pickup, which item, how long the approach and the ceremony ran,
        // and how many releases the ceremony needed. `grants` is what was
        // HANDED over; this is what was EARNED, and the R3 ledger is the
        // statement that the first list is empty and this one is not.
        collects: collects.map((c) => ({ ...c })),
        /** Every sweep a wall stopped that the drive went on to arrive past. */
        grazes: grazes ? grazes.map((g) => ({ ...g })) : [],
        grants: relax ? run.grantsFired : [],
        inventory: relax ? run.inventory : null,
    };
}

/** Convenience: a single-level task, expressed as one leg. */
export function synthesizeWalk(targets, opts = {}) {
    const level = opts.boot?.level ?? 0;
    return synthesizeLegs([{ level, targets }], opts);
}

/** Convenience: synthesize and serialize in one step. */
export function synthesizeLegsJson(legs, opts = {}) {
    return serializeTape(synthesizeLegs(legs, opts).tape);
}
