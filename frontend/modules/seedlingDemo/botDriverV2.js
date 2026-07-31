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

import { serializeTape } from './tapeFormat.js';
import { createLevelRun } from './levelRun.js';
import { RELAXED_ROLES, TILE_SIZE } from './levelWorld.js';
import { rectsOverlap } from './levelWorld.js';
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

/** Tile centre, which is where `Tile` entities actually sit. */
export function tileCentre(tx, ty) {
    return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
}

/** The tile containing a pixel position. */
export function tileAt(x, y) {
    return { tx: Math.floor(x / TILE_SIZE), ty: Math.floor(y / TILE_SIZE) };
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
    } = opts;
    const box = playerBoxAt(x, y);
    const geometry = level.plannerBlockerAt(box, terrainProbeRect(x, y),
        { noclip, noHazards });
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
    const probe = terrainProbeRect(x, y);
    for (const tile of level.pitTiles) {
        if (allowPit && tile.tx === allowPit.tx && tile.ty === allowPit.ty) continue;
        if (rectsOverlap(probe, tile.rect)) return { kind: 'pit', blocker: tile };
    }
    if (avoidVolumes) {
        // The position, not just the box: a `point` hazard (lavatrap's
        // 33 px chomp disc, an ice turret's 129 px attack range) tests the
        // player's ENTITY position against a radius, which is what the game
        // does and is not a box test at all.
        const [hit] = level.avoidVolumesAt(box, { x, y });
        if (hit) return hit;
    }
    for (let i = 0; i < level.teleporters.length; i++) {
        const tp = level.teleporters[i];
        if (i === allowTeleporter || tp.deactivated) continue;
        if (rectsOverlap(box, tp.rect)) return { kind: 'teleporter', blocker: tp };
    }
    return null;
}

/** An empty held set — what a transport tick emits. */
const NO_HELD = new Set();

const describe = (o) => (o.kind === 'terrain' || o.kind === 'pit'
    ? `${o.kind} ${o.blocker.name} (t=${o.blocker.t}) at tile (${o.blocker.tx},${o.blocker.ty})`
    : `${o.kind} ${o.blocker.tag ?? o.blocker.cls?.as3} at (${o.blocker.x},${o.blocker.y})`);

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
    if (tx < 0 || ty < 0 || tx >= level.width || ty >= level.height) return false;
    const c = tileCentre(tx, ty);
    return plannerObstacleAt(level, c.x, c.y, allowTeleporter, opts) === null;
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
    const start = tileAt(from.x, from.y);
    const goal = tileAt(to.x, to.y);

    for (const [what, t, pos] of [['start', start, from], ['goal', goal, to]]) {
        if (!isWalkableTile(level, t.tx, t.ty, allowTeleporter, opts)) {
            const c = tileCentre(t.tx, t.ty);
            const o = plannerObstacleAt(level, c.x, c.y, allowTeleporter, opts);
            fail(`A* ${what} tile (${t.tx},${t.ty}) in level ${level.level} — for `
                + `(${pos.x},${pos.y}) — is not walkable: `
                + `${o ? describe(o) : 'outside the level'}. The planner works in whole `
                + 'tiles, so both ends of a route must be tiles the player box fits in '
                + 'at the centre of.');
        }
    }

    const key = (tx, ty) => ty * level.width + tx;
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
            if (closed.has(nk) || !isWalkableTile(level, nx, ny, allowTeleporter, opts)) continue;
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
export function planWaypoints(level, from, to, allowTeleporter = null, opts = {}) {
    const path = planTilePath(level, from, to, allowTeleporter, opts);
    const points = [
        { x: from.x, y: from.y },
        ...path.slice(1).map((t) => tileCentre(t.tx, t.ty)),
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
 * Drive the run to `target`, one bang-bang tick at a time.
 *
 * `until` is `'arrival'` (v1's criterion: within tolerance AND stopped) or
 * `'transition'` (keep pressing toward the trigger until the world swaps —
 * an exit is reached by TOUCHING it, not by parking on it, and the trigger
 * fires from the position the previous tick left).
 */
function drive(run, target, perTick, { until, tolerance, maxTicks, what, avoidVolumes }) {
    let ticks = 0;
    for (;;) {
        if (until === 'arrival' && hasArrived(run.state, target, tolerance)) return null;
        if (ticks >= maxTicks) {
            const s = run.state;
            fail(`${what}: not reached within ${maxTicks} ticks; stalled at `
                + `(${s.x},${s.y}) v=(${s.vx},${s.vy}) in level ${run.level}, `
                + `aiming at (${target.x},${target.y}).`);
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
        const { transition, hitX, hitY } = run.advance(held);
        ticks++;

        if (transition) {
            if (until === 'transition') return transition;
            fail(`${what}: the run crossed from level ${transition.from_level} to `
                + `${transition.to_level} at tick ${transition.t} without being asked to. `
                + 'A live teleporter volume is supposed to be an obstacle to the planner '
                + '— this is a routing defect, not a surprise to absorb.');
        }
        // A hit means the level geometry stopped a move the planner had
        // certified clear. THROW: re-planning here would hide the
        // disagreement, because the tape would still reach the target and
        // every downstream assertion would pass.
        const hit = hitX || hitY;
        if (hit) {
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
            const [v] = run.world.avoidVolumesAt(playerBoxAt(s.x, s.y), { x: s.x, y: s.y });
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
    } = opts;
    if (typeof levelSource !== 'function') {
        fail('synthesizeLegs: opts.levelSource (level) => levelRecord is required — '
            + 'the v2 rung plans against real geometry and there is no default for it');
    }
    // ⚠ ONE object decides the plan, the run AND the emitted tape. Splitting
    // them is how a driver plans for a run it does not emit: the whole point
    // of `relax` being a single argument is that `planWaypoints`,
    // `createLevelRun` and `buildTape` cannot be given different ideas of
    // which experiment this is.
    if (relax !== null) {
        for (const field of ['noDamage', 'noHazards', 'grants']) {
            if (relax[field] === undefined) {
                fail(`synthesizeLegs: opts.relax must declare ${field}. A relaxation `
                    + 'with a default is a tape the planner and the game read '
                    + 'differently.');
            }
        }
    }
    const plan = relax
        ? { noclip: true, noHazards: relax.noHazards, avoidVolumes: true }
        : {};

    const run = createLevelRun({
        levelSource,
        boot,
        noclip: Boolean(relax),
        ...(relax ? {
            noHazards: relax.noHazards,
            noDamage: relax.noDamage,
            grants: relax.grants,
            // A relaxed walk consults no collider, so it must not be stopped
            // by one being unpriced — that is the whole of slice 1b.
            roles: RELAXED_ROLES,
        } : {}),
    });
    const perTick = [];
    const arrivals = [];
    const waypoints = [];

    legs.forEach((leg, li) => {
        if (run.level !== leg.level) {
            fail(`legs[${li}] declares level ${leg.level} but the run is in level `
                + `${run.level}. A leg's level is an ASSERTION about where the previous `
                + "leg's exit landed, not a request to go there.");
        }
        const legWaypoints = [];
        (leg.targets ?? []).forEach((target, ti) => {
            if (!Number.isFinite(target?.x) || !Number.isFinite(target?.y)) {
                fail(`legs[${li}].targets[${ti}] must be {x, y} finite numbers`);
            }
            const wps = planWaypoints(run.world, run.state, target, null, plan);
            legWaypoints.push(...wps);
            wps.forEach((wp, wi) => drive(run, wp, perTick, {
                until: 'arrival',
                tolerance,
                maxTicks: maxTicksPerTarget,
                avoidVolumes: Boolean(relax),
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
            const centre = tileCentre(tx, ty);
            const legPlan = { ...plan, allowPit: { tx, ty } };
            const wps = planWaypoints(run.world, run.state, centre, null, legPlan);
            legWaypoints.push(...wps);
            wps.forEach((wp, wi) => {
                const last = wi === wps.length - 1;
                const t = drive(run, wp, perTick, {
                    until: last ? 'transition' : 'arrival',
                    tolerance,
                    maxTicks: maxTicksPerTarget,
                    avoidVolumes: Boolean(relax),
                    what: `legs[${li}] level ${leg.level} pit exit (${tx},${ty}) `
                        + `waypoint ${wi} (${wp.x},${wp.y})`,
                });
                if (last && !t) {
                    fail(`legs[${li}] reached pit tile (${tx},${ty}) without falling. `
                        + 'The edge is a RAW state change to 6 while onGround, so this '
                        + 'means the route arrived already resolving that tile.');
                }
            });
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
        const wps = planWaypoints(run.world, run.state, centre, index, plan);
        legWaypoints.push(...wps);
        wps.forEach((wp, wi) => {
            const last = wi === wps.length - 1;
            const t = drive(run, wp, perTick, {
                until: last ? 'transition' : 'arrival',
                tolerance,
                maxTicks: maxTicksPerTarget,
                avoidVolumes: Boolean(relax),
                what: `legs[${li}] level ${leg.level} exit (${leg.exit.x},${leg.exit.y}) `
                    + `waypoint ${wi} (${wp.x},${wp.y})`,
            });
            if (last && !t) {
                fail(`legs[${li}] reached the teleporter at (${leg.exit.x},${leg.exit.y}) `
                    + 'without triggering it. The trigger volume is 16x16 and the aim '
                    + 'point is its centre, so this means the overlap test disagrees '
                    + 'with the geometry.');
            }
        });
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

    return {
        tape: buildTape(perTick, boot, name, relax
            ? { noclip: true, ...relax }
            : { noclip: false }),
        arrivals,
        transitions: run.transitions.map((t) => ({ ...t })),
        waypoints,
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
