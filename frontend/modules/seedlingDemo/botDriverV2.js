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

import {
    KEY_CODES, assertTapeWithinRuntimeBudget, coerceTerrainState, serializeTape,
} from './tapeFormat.js';
import { createLevelRun } from './levelRun.js';
import { PRE_R5_ROLES, RELAXED_ROLES, TILE_SIZE } from './levelWorld.js';
import { assertRect, rectsOverlap } from './levelWorld.js';
import { playerBoxAt, terrainProbeRect } from './playerPhysicsV2.js';
import { TICKS_FROM_PRESS_TO_WALKABLE } from './bridges.js';
import {
    WAIT_AFTER_PRESS_TICKS, assertWaitCovers, rockBreaksUnder,
} from './breakableRocks.js';
import { keyLineTouches, opensOnKeyTick } from './activators.js';
import { FIRE_WINDOW, fireRect } from './fireVerb.js';
// ⚠ ALIASED, because `breakableRocks` exports a constant of the SAME NAME
// eight lines above and the two are different numbers for different
// mechanics (7 ticks of shatter against 41 of animation). An unaliased
// second import would have silently taken whichever the bundler resolved
// last — a burn leg waiting a rock's window is exactly the shape of a green
// tape that walks into a wall.
import {
    HIT_TO_GONE_TICKS as BURN_HIT_TO_GONE_TICKS,
    WAIT_AFTER_PRESS_TICKS as BURN_WAIT_AFTER_PRESS_TICKS,
} from './burnableTree.js';
import { MODELLED_ENEMY_CLASSES, unmodelledEnemies } from './spinner.js';
import { CHEST, chestProbeLine, chestStanceBand } from './chest.js';
import { HITBOX } from './playerPhysicsV1.js';
import { scanCrusher } from './crusher.js';
import { ICE_TURRET, ICE_TURRET_PLAN } from './iceTurret.js';
// ⛓⛓⛓ R5 SLICE 21: THE KILL VERB'S GEOMETRY AND ITS CADENCE.
//
// ⛔ THE SLASH RECT COMES FROM `presses.js`, NOT `combatVerbs.js`, and the
// two are not the same function: `combatVerbs.slashRect` carries the
// STALE-SCALE and ghost-sword arms, `presses.slashRect` is the plain-sword
// 16x32 that `levelRun.applyThrust` audits with. A verb that checked reach
// against one while the run audited with the other would be a leg that
// passed its own check and hit nothing.
import {
    DARK_SWORD_DAMAGE, SLASH_REACH, SWORD_DAMAGE, distanceRectPoint, slashRect,
} from './presses.js';
import { KILL_PRESS_CADENCE } from './combatVerbs.js';
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
/** R4's lethal-terrain gate, when the caller names no inventory. */
const EMPTY_INVENTORY = Object.freeze({
    canSwim: false, hasDarkSuit: false, hasFeather: false,
});
/** `Tile.types` indices the lethal-terrain policy is about. */
const LETHAL_WATER = 1;
const LETHAL_LAVA = 17;
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
export function contactsAt(level, x, y, { avoidVolumes = false, keys = null } = {}) {
    const box = playerBoxAt(x, y);
    const hits = level.teleporterHit(box)
        .map((tp) => ({ kind: 'teleporter', blocker: tp }));
    // ⚠ `keys` is the R4 addition and it selects ONE volume: a `BossLock`'s
    // probe row is inert to a walk that does not hold the matching BossKey.
    // Omitting it means "no keys", which is the truth for every rung below
    // R4 and the conservative arm anyway.
    if (avoidVolumes) hits.push(...level.avoidVolumesAt(box, { x, y }, { keys }));
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
        // R4: the two other per-VISIT families, and they are LIVE STATE for
        // exactly the reason `openActivators` is. A bridge is Solid until
        // sixty ticks after a spear press and a pushed block is not where
        // the level built it, so "is this tile walkable" has different
        // answers at two points in the same leg — and a planner with its own
        // idea of either would certify a corridor the executor walks into.
        openBridges = null, pushables = null, brokenRocks = null, pulledRopes = null,
        // ⛔⛔ R5 slice 9: the SIXTH per-visit family. `Chest.open()` writes
        // `type = ""` on the entity, and in L38 that entity is the only join
        // between the room the walk arrives in and the room the errand is
        // in — so a planner that could not be told about it cannot route the
        // second half of the level at all.
        openChests = null,
        // ⛓⛓ R5 slice 14: the SEVENTH per-visit family, and the one that
        // was WIRED BUT UNREADABLE. `plannerBlockerAt` has taken
        // `burnedTrees` since slice 12 and this function — the only way the
        // planner ever reaches it — did not forward it, so a leg planned
        // after a burn saw a 2x2 solid the game had removed. The gap was
        // invisible because nothing had ever burned anything: an option
        // whose only producer is an undriven verb cannot be caught by a
        // green suite. Driven now, in L37 and L40.
        burnedTrees = null,
        /**
         * ⛓⛓⛓ R5 slice 15: the NINTH per-visit family. A snapshot, and the
         * only member of the list that is one — see `plannerBlockerAt`'s own
         * note. A flood taken while a crusher is mid-charge is a picture of a
         * world that will not exist next tick; `run.crushersParked` is the
         * precondition, and `CRUSHER_PLAN`'s phase 2 is where it is checked.
         */
        crushers = null,
        // R4: `Main.SAVE_FILE.data.hasKey`, as a set of key types. It selects
        // exactly one avoid volume — a `BossLock`'s probe row — and it is a
        // SET rather than a boolean because a walk can hold several.
        keys = null,
        // R4: which lethal terrain the run can survive. Defaulted to
        // "neither", which is the conservative arm and is also the truth
        // for every rung below R4 — where both types are coerced anyway,
        // so the whole policy is inert.
        //
        // ⚠ NOT THREADED FROM THE RUN YET, and the direction of the gap is
        // the safe one. R4's walk drops `darksuit`, so "neither" IS the
        // truth for every tick of it; a later rung that holds the suit and
        // does not pass it here gets a planner that REFUSES a lava tile it
        // could have crossed — a route that will not plan, rather than one
        // that drowns. Threading it belongs with the leg plan, at the slice
        // that first needs a hazard-crossing leg.
        inventory = null,
    } = opts;
    const lethalSafe = inventory ?? EMPTY_INVENTORY;
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
        { noclip, noHazards, openActivators, openBridges, pushables, brokenRocks,
            pulledRopes, openChests, burnedTrees, crushers });
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
    // ⚠ ARMED LETHAL TERRAIN IS FORBIDDEN FLOOR (R4), and this policy is
    // load-bearing for exactly the reason the pit one above is. Until R4,
    // an armed water or lava tile was UNMODELLED TERRAIN and
    // `plannerBlockerAt` reported it for free; modelling the physics — which
    // is what lets a tape arm a hazard at all — took it off that list, and
    // without this the planner routes cheerfully across a lava floor.
    //
    // The gate is the ITEM, not the tape: `checkDrowning` reads the coerced
    // state and spares the player only with `canSwim` (water) or
    // `hasDarkSuit` (lava). `drownTimer` is never reset off-hazard, so the
    // budget is eleven CUMULATIVE ticks and then `die()` — which `noDamage`
    // does not guard, because it guards `hit()` and the lava arm passes
    // damage zero anyway.
    //
    // Ice and waterfall are deliberately NOT here: they are armed at R4 and
    // are ordinary floor with unusual physics. Forbidding them instead of
    // modelling them is what collapses the walk from 60 nodes to 11 (R4
    // slice 0, §8.2).
    for (const tile of level.lethalTerrainTiles) {
        const effective = coerceTerrainState(tile.t, noHazards);
        if (effective !== tile.t) continue;                       // coerced: inert
        if (tile.t === LETHAL_WATER && lethalSafe.canSwim) continue;
        if (tile.t === LETHAL_LAVA && lethalSafe.hasDarkSuit) continue;
        if (rectsOverlap(probe, tile.rect)) {
            return { kind: 'lethal-terrain', blocker: tile };
        }
    }

    if (avoidVolumes) {
        // The position, not just the box: a `point` hazard (lavatrap's
        // 33 px chomp disc, an ice turret's 129 px attack range) tests the
        // player's ENTITY position against a radius, which is what the game
        // does and is not a box test at all.
        const hit = level.avoidVolumesAt(box, { x, y }, { keys })
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
/**
 * ⛔ R5 SLICE 8, STEP 0: IT GUARDS BOTH ENDS NOW, AND NOT BECAUSE A CALLER
 * IS SUSPECT. All three callers hand in `playerBoxAt`/`terrainProbeRect`
 * output, which is built from frozen module constants and cannot be
 * malformed. But this function's whole job is to build the rect a blocking
 * sweep is then tested AGAINST, and `undefined + m` is NaN, which compares
 * false in every direction — so a widened rect with one absent edge reports
 * the route CLEAR. That is the rope's failure with a different missing
 * field and a worse consequence, and the cost of ruling it out is two
 * lines. See `levelWorld.entityRect`'s docblock for the pattern.
 */
function grow(r, m) {
    assertRect(r, 'botDriverV2.grow input');
    if (!m) return r;
    return assertRect(
        { x: r.x - m, y: r.y - m, right: r.right + m, bottom: r.bottom + m },
        `botDriverV2.grow(margin ${m})`,
    );
}

/** An empty held set — what a transport tick emits. */
const NO_HELD = new Set();

/** The one key a ceremony reads: `Player.keys[6]`, i.e. X. */
const TALK_HELD = new Set(['primary']);

/**
 * ⛓⛓⛓ R5 SLICE 22 — HOLD UNTIL THE FREEZE DRAINS, BEFORE EVERY PRESS.
 *
 * `Player.input()` returns at its first line while `frozenTimer > 0`, and
 * `useItem(Main.primary)` is called from INSIDE `input()` — so a press on a
 * frozen tick is LOST, not delayed. `levelRun` refuses to author one; this
 * is the cure, and it belongs beside the press rather than in each verb's
 * schedule because all three press verbs owe it.
 *
 * ⚠ THE PREDICATE IS `> 1`, NOT `> 0`, AND THE FENCEPOST IS `freezeStep`.
 * `run.frozenTimer` is the value AFTER the last tick's decrement; the press
 * tick runs `freezeStep()` again BEFORE `input()`, so a timer of 1 becomes
 * 0 and the gate passes. Waiting for 0 would spend one tick more than the
 * game does, every time — which is the kind of off-by-one a schedule's
 * slack hides.
 *
 * ⛔ AND IT CANNOT COVER A BLAST THAT ARRIVES ON THE PRESS TICK ITSELF.
 * That one is a same-tick collision no lookahead in this driver can see,
 * and `levelRun`'s refusal is what catches it — loudly, naming the tick, so
 * the plan moves the stance rather than the model growing a tolerance.
 *
 * @returns {number} how many ticks were spent waiting
 */
function holdUntilUnfrozen(run, perTick, what) {
    let spent = 0;
    while ((run.frozenTimer ?? 0) > 1) {
        if (spent > FREEZE_HOLD_CEILING) {
            fail(`${what}: still frozen after ${spent} held ticks. One `
                + '`IceTurretBlast` contact refuses input for 14, so a hold this long '
                + 'means the stance is inside a volley\'s path and is being re-frozen '
                + 'faster than it drains — that is a STANCE problem (cover removes a '
                + 'blast outright), not a wait problem.');
        }
        perTick.push(NO_HELD);
        const r = run.advance(NO_HELD);
        if (r.transition) {
            fail(`${what}: waiting out a blast freeze crossed from level `
                + `${r.transition.from_level} to ${r.transition.to_level}.`);
        }
        spent += 1;
    }
    return spent;
}

/**
 * Two volley periods plus a freeze span. Longer than any legitimate wait
 * and shorter than a run that has stopped making progress.
 */
const FREEZE_HOLD_CEILING = 2 * 45 + 15;

/**
 * ⛔⛔ R5 SLICE 18 — A SPAN'S `key` IS A HELD **SET**, AND READING IT AS ONE
 * NAME IS A SILENCE, NOT AN ERROR.
 *
 * Every other verb in this file hands `run.advance` a set built by the
 * walk machinery (`chooseHeld` returns diagonals routinely). `bait.spans`
 * is the one place a plan AUTHORS the held set by name, and slice 15 built
 * it as `new Set([span.key])` — one string, whatever the string was. That
 * is fine for L41, whose three choreographies are `left`/`down`/`null`, and
 * it is fatal for L42's, whose escape from a 1 px/tick body needs both axes
 * at once:
 *
 *   `applyInput` is four independent `held.has('up'|'right'|'down'|'left')`
 *   tests (`playerPhysicsV1.js:232-235`). A set holding the single string
 *   `"down+right"` matches NONE of them, so the player STANDS STILL — for
 *   every tick of a choreography whose whole point is that it moves — and
 *   the only symptom is a bait that reports the crusher parked somewhere
 *   else. ⇒ the same shape as §30.3, one field along: an authored input
 *   whose SHAPE was never checked because nothing had ever authored one.
 *
 * So: split on `+`, and refuse a token that is not in the ONE canonical
 * table. An unknown name is loud here or it is a standing-still player
 * three hundred ticks later.
 */
export function heldFromKey(key, what) {
    if (key === null || key === undefined) return NO_HELD;
    if (typeof key !== 'string' || key.length === 0) {
        fail(`${what}: a span's key must be null or a '+'-joined list of held key names, `
            + `got ${JSON.stringify(key)}.`);
    }
    const names = key.split('+');
    const held = new Set();
    for (const name of names) {
        if (!Object.prototype.hasOwnProperty.call(KEY_CODES, name)) {
            fail(`${what}: '${name}' is not a key (in '${key}'). The names are `
                + `[${Object.keys(KEY_CODES).join(' ')}] — `
                + '`tapeFormat.KEY_CODES`, the one canonical table. ⛔ This is checked '
                + 'because `applyInput` reads four independent `held.has(...)` tests: an '
                + 'unrecognised name is not an error there, it is a player that does not '
                + 'move, and a choreography that stands still completes exactly like one '
                + 'that worked.');
        }
        if (held.has(name)) {
            fail(`${what}: '${name}' appears twice in '${key}'. A held set is a set.`);
        }
        held.add(name);
    }
    return held;
}

const describe = (o) => {
    // ⚠ `lethal-terrain` JOINED THIS ARM AT R5 SLICE 4, and it had to.
    // Water was UNMODELLED terrain until the swim sound term became
    // modellable under the pin; modelling it moved every armed water tile
    // from `kind: "terrain"` to `kind: "lethal-terrain"`, and that arm fell
    // through to the entity formatter below — which reads `blocker.tag`.
    // A tile has none, so the one diagnostic a planner failure produces
    // read "not walkable: lethal-terrain undefined at (152,152)". A message
    // that names the obstacle as `undefined` is worse than no message: it
    // sends the reader looking for a missing entity.
    if (o.kind === 'terrain' || o.kind === 'pit' || o.kind === 'lethal-terrain') {
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
 * ⛔ THE THIRD TERRAIN POLICY, and the only DIRECTED one on the ladder.
 *
 * `Player.input()`'s last act is `v.y += 0.8` on a waterfall tile, exempted
 * for UPWARD motion only and only with the feather
 * (`!hasFeather || v.y >= 0`). The water move speed is far below 0.8, and
 * the shipped physics agrees: a featherless player holding UP on level 0's
 * waterfall for 120 ticks moves **3.33 px DOWN**; with the feather, 57.3 px
 * up. So an armed waterfall is a ONE-WAY DOWNWARD tile.
 *
 * ⚠ AND IT CANNOT BE A BLOCKER, which is how this was first written and why
 * that lasted about a minute. Refusing the tile outright cut level 0 in two
 * and took the reachable map from 53 nodes to TWELVE — the walk could not
 * reach the feather, the torch, the spear or health, because a waterfall is
 * something the route crosses DOWNWARD all the time and nothing about that
 * is impossible. What is impossible is climbing one, so what is forbidden is
 * an UPWARD STEP, not a cell.
 *
 * Found by R4's own route, in level 0, on the way to the FEATHER — the one
 * leg on the ladder that necessarily runs before the item that exempts it.
 * R3 stood on that very tile for 71 ticks with it COERCED to plain floor,
 * which is why three rungs never met this.
 *
 * ⚠ Applied to a step whose destination is strictly above its source when
 * EITHER endpoint is an armed waterfall: the push is on while the terrain
 * state is 25, so both leaving one upward and entering one upward fight it.
 */
export function climbsArmedWaterfall(level, from, to, opts = {}) {
    const { noHazards = [], inventory = null, lattice = DEFAULT_LATTICE } = opts;
    if (to.ty >= from.ty) return false;
    if ((inventory ?? EMPTY_INVENTORY).hasFeather) return false;
    const tiles = level.waterfallTiles;
    if (tiles.length === 0) return false;
    const cells = TILE_SIZE / lattice;
    for (const tile of tiles) {
        if (coerceTerrainState(tile.t, noHazards) !== tile.t) continue;
        for (const n of [from, to]) {
            if (Math.floor(n.tx / cells) === tile.tx && Math.floor(n.ty / cells) === tile.ty) {
                return true;
            }
        }
    }
    return false;
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
            // ⛔ THE ONE DIRECTED EDGE RULE — see `climbsArmedWaterfall`. A
            // waterfall is a cell the route crosses downward all the time and
            // cannot climb without the feather, so the refusal is on the
            // STEP. The goal is NOT exempt here: exempting it would let a leg
            // end one tile up a waterfall, which is a stall rather than a
            // tight fit.
            if (climbsArmedWaterfall(level, cur, { tx: nx, ty: ny }, opts)) continue;
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

/**
 * ⛓⛓⛓ R5 SLICE 15 — `bait`: PHASE 1 OF THE CRUSHER DOCTRINE, AS A VERB.
 *
 * Every other verb in this file is a PRESS or a HOLD: the player does one
 * thing at one place and the world answers. This one is a CHOREOGRAPHY —
 * a short sequence of held spans whose whole point is that the world is
 * moving while it runs — and it exists because the planner is not allowed
 * to route against a live mover (`CRUSHER_PLAN`).
 *
 * ```
 *   bait: {
 *     crusher:  {x, y},                the OEL cell — `crusher@x,y`
 *     approach: [{key, ticks}, …],     OPTIONAL: the walk INTO the lane
 *     spans:    [{key, ticks}, …],     the escape, in order
 *     park:     {x, y},                the ENTITY position it must END at
 *   }
 * ```
 *
 * ⚠ WHAT MAKES THIS A CLAIM RATHER THAN A REPLAY, in three parts, because
 * a bait that baits nothing and a bait that works look identical from the
 * end state:
 *
 *   THE POSITIVE CONTROL   the crusher must be at REST when the verb
 *                          starts and AWAKE when the approach ends. A
 *                          shielded crusher never moves, so "it ended
 *                          where I said" would be satisfied by a crusher
 *                          that was already there.
 *   THE MOVE               it must actually END somewhere else. Same
 *                          reason, from the other side.
 *   THE SURVIVAL           `run.crusherContacts` may not grow by one. A
 *                          contact is 1000 damage and `Bot.noDamage` is
 *                          what stops the game dying of it, so a
 *                          choreography that is run over completes exactly
 *                          as if it had worked. ⇒ [[feedback_graceful_fallback_vacuous_replay]]
 *
 * ⛓ AND THE PARK IS ASSERTED AS A POSITION, not as "it stopped". Phase 2
 * plans against the world this leaves, and a park one pixel from where the
 * plan thinks it is is a route certified against a different room.
 *
 * ── ⛔⛔ R5 SLICE 16: `approach`, AND WHY THE FIRST CUT COULD NOT DRIVE
 *    TWO OF L41's OWN THREE BAITS ─────────────────────────────────────
 *
 * Slice 15 shipped this verb with ONE precondition — the player must be
 * inside a lane with a clear sight line **at the tick the verb starts** —
 * and banked three L41 choreographies that a `describe` block drove as raw
 * spans. Put through `synthesizeLegs`, baits 2 and 3 fail that
 * precondition by construction: **their approach IS the trigger.** The
 * player walks to a cell OUTSIDE the lane (standing in it would have the
 * crusher charging before the leg is ready), and the choreography's first
 * span is the step that enters it. A verb that demands the lane up front
 * can only express a bait the player happens to already be standing in —
 * which is bait 1 and nothing else.
 *
 * ⛓⛓ AND THE REPLACEMENT IS AN OBSERVATION WHERE THE ORIGINAL WAS A
 * PREDICTION. `scanCrusher` at the start says *"it will commit"*;
 * `!run.crushersParked` after the approach says *"it did"* — the same
 * claim, taken from the run rather than from a second copy of the model.
 * The pre-flight scan survives as the FAILURE DIAGNOSIS (shielded by
 * what / in no lane), which is where it was always doing its real work,
 * and as a precondition **only when `approach` is empty**, so a bait
 * written against slice 15's shape verifies exactly as it did.
 */
function runBait(run, perTick, bait, what) {
    if (run.crushers === null) {
        fail(`${what}: a bait is a MECHANIC, and the noclip arm does not run it — `
            + '`advance` steps no crusher under noclip, so the choreography would emit '
            + 'its ticks, verify nothing and report success.');
    }
    const id = `crusher@${bait.crusher?.x},${bait.crusher?.y}`;
    const before = run.crushers.get(id);
    if (!before) {
        fail(`${what}: level ${run.level} has no ${id}; it holds `
            + `[${[...run.crushers.keys()].join(' ') || 'none'}].`);
    }
    if (!run.crushersParked) {
        fail(`${what}: a crusher in this room is already CHARGING. A bait's spans are `
            + 'verified against a scan taken at rest, so starting one mid-charge is '
            + 'planning against a world that has already moved.');
    }
    /**
     * The scan, as the game would take it right now: is the line clear, and
     * is the player in a lane. It is a PRECONDITION only for a bait with no
     * approach — the slice-15 shape, where standing still is the trigger —
     * and the FAILURE DIAGNOSIS in every case.
     */
    const scanNow = () => scanCrusher({ x: run.crushers.get(id).x, y: run.crushers.get(id).y },
        playerBoxAt(run.state.x, run.state.y), { x: run.state.x, y: run.state.y },
        run.world.solidBoxesForMover(livePerVisitOpts(run), id));
    const whyItIsAsleep = (scan) => (scan.shieldedBy
        ? `${id} CANNOT SEE the player at (${run.state.x.toFixed(2)},`
            + `${run.state.y.toFixed(2)}) — the sight line is blocked by `
            + `${scan.shieldedBy.rockId ?? scan.shieldedBy.tag ?? 'a Solid'}. A shielded `
            + 'crusher never scans (`collideLine` is an early exit), so this bait would '
            + 'emit its ticks and move nothing. In L41 that means the `breakablerock`s '
            + 'are still standing and the leg is in the wrong ORDER.'
        : `the player at (${run.state.x.toFixed(2)},${run.state.y.toFixed(2)}) `
            + `is in NONE of ${id}'s four lanes — the sight line is clear and nothing `
            + 'matched. A bait presents the player INSIDE a lane; standing next to one '
            + 'is standing where the game does nothing.');
    const approach = bait.approach ?? [];
    if (!Array.isArray(approach)) {
        fail(`${what}: bait.approach must be an array of {key, ticks} spans — the walk `
            + 'that presents the player to the lane. Omit it for a bait whose stance is '
            + 'already inside one.');
    }
    const contactsBefore = run.crusherContacts.length;
    const driveSpans = (spans, phase) => {
        for (const span of spans) {
            const keys = heldFromKey(span.key, `${what}: the ${phase}`);
            for (let i = 0; i < span.ticks; i += 1) {
                perTick.push(keys);
                const { transition } = run.advance(keys);
                if (transition) {
                    fail(`${what}: the ${phase} crossed from level `
                        + `${transition.from_level} to ${transition.to_level}. A bait stays `
                        + 'in the room — and a re-entry would reset the crusher to its '
                        + 'constructor cell, so a plan that left mid-bait would be undoing '
                        + 'itself.');
                }
            }
        }
    };
    if (approach.length === 0) {
        const scan = scanNow();
        if (scan.dir === null) {
            fail(`${what}: ${whyItIsAsleep(scan)} This bait declares no \`approach\`, so `
                + 'the stance it starts from is the whole of its trigger.');
        }
    }
    driveSpans(approach, 'approach');
    /**
     * ⛓⛓ THE POSITIVE CONTROL, AND IT IS THE RUN'S OWN ANSWER. A crusher
     * only ever leaves rest by scanning, so "it is no longer parked" is
     * exactly "the choreography woke it" — observed, not predicted.
     */
    if (run.crushersParked) {
        fail(`${what}: the approach ended with every crusher in the room STILL AT REST, `
            + `so nothing has been baited. ${whyItIsAsleep(scanNow())}`);
    }
    driveSpans(bait.spans ?? [], 'escape');
    const after = run.crushers.get(id);
    const contacts = run.crusherContacts.slice(contactsBefore);
    if (contacts.length > 0) {
        fail(`${what}: the choreography was RUN OVER — ${contacts.length} tick(s) with the `
            + `player inside ${id}'s 32x32 body, first at t${contacts[0].t}. `
            + '`Crusher.hit()` deals 1000 ("KILL EVERYTHING"), so this is `die()` at any '
            + '`hitsMax`; the run survived it only because `Bot.noDamage` is on, which is '
            + 'exactly why the count is asserted and not merely the end position.');
    }
    if (!run.crushersParked) {
        fail(`${what}: ${id} is STILL CHARGING at the end of the choreography `
            + `(${after.x},${after.y}). Phase 2 plans against a static world; a leg that `
            + 'handed it a moving one would certify a corridor that closes behind it.');
    }
    if (after.x === before.x && after.y === before.y) {
        fail(`${what}: ${id} ended exactly where it started (${before.x},${before.y}). `
            + 'A bait that moves nothing is a walk, and the flood that follows it is the '
            + 'flood that preceded it.');
    }
    const park = bait.park;
    if (park && (after.x !== park.x || after.y !== park.y)) {
        fail(`${what}: ${id} parked at (${after.x},${after.y}), not the declared `
            + `(${park.x},${park.y}). The park is a POSITION because phase 2's flood is `
            + 'taken against it — see `CRUSHER_PLAN.floodsBankWith`.');
    }
    /**
     * ⛓ THE DIRECTION IS READ OFF THE DISPLACEMENT, not off a second scan.
     * A charge is committed at rest and never re-aimed, and `moveX` runs
     * before `moveY` with only one of them ever non-zero — so the net
     * displacement of a choreography that ends parked IS the direction it
     * was charged in. Asking `scanCrusher` again would be asking a model
     * what the run already knows.
     */
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    /**
     * ⛔ R5 SLICE 16 — `crusherFrom`/`crusherTo`, AND THE RENAME IS A FIX.
     *
     * Slice 15 returned these as `from`/`to`, and `synthesizeLegs` builds
     * every verb record as `{leg, index, level, from, to: perTick.length,
     * ...record}` — where `from`/`to` are the TICK INDICES the record
     * spans. So the spread overwrote both with `{x, y}` objects and the
     * bait was the one verb in the file whose record could not say WHEN it
     * happened. Nothing caught it because nothing had ever driven the verb.
     */
    return {
        id,
        crusherFrom: { x: before.x, y: before.y },
        crusherTo: { x: after.x, y: after.y },
        dir: Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N'),
        approachTicks: approach.reduce((n, s) => n + s.ticks, 0),
        ticks: approach.reduce((n, s) => n + s.ticks, 0)
            + (bait.spans ?? []).reduce((n, s) => n + s.ticks, 0),
    };
}

/**
 * ⛓⛓⛓ R5 SLICE 16 — `wait`: THE FADE THE PLAYER IS NOT STANDING ON.
 *
 * Every opener this driver could express until now was one the PLAYER
 * held: `runHold` puts the player's own box on a presser and counts. L41
 * is the first room whose presser is held by something else — a
 * `pushableblockfire` parked on `button@176,176` — so the 101 continuous
 * ticks a `Lock` needs elapse with the player standing somewhere else
 * entirely, doing nothing.
 *
 * ⛔ AND THERE IS NO WAY TO EXPRESS THAT AS A SIDE EFFECT OF THE WALK.
 * `synthesizeLegs` plans each target against the world as it is when the
 * target is reached, and a shut `wandlock@240,96` is a wall — so the walk
 * to the part is refused before the fade it is waiting on has started. The
 * leg has to be able to say "let time pass here".
 *
 * ```
 *   wait: {
 *     ticks: 140,                      how long, EXACTLY — no early exit
 *     opens: 'wandlock@240,96',        the responder that must be shut, then open
 *     why:   '…',                      what is holding its button, since the player is not
 *   }
 * ```
 *
 * ⚠ THE TICKS ARE EMITTED IN FULL, AND `openedAt` IS THE MEASUREMENT.
 * Breaking out the moment the responder opens would shorten the tape to
 * exactly the number the ±1 lives in — the same reason `runSpear`'s rock
 * arm has no early exit. The leg declares a length comfortably past the
 * fade and asserts the tick the game opened on, so the fade length is a
 * claim the recording can refute rather than a constant the tape encodes.
 *
 * ⚠ AND THE POSITIVE CONTROL IS "SHUT BEFORE". A responder already open
 * when the wait begins makes every later assertion vacuous — which is the
 * `runHold` lesson, and it is worth repeating here because a wait is the
 * one verb whose ticks would look identical either way.
 */
/**
 * The shut-before arm: the same idle span, asserting the responder is up on
 * EVERY tick of it. See `runWait`'s note for why it is per tick.
 */
function runWaitShut(run, perTick, { ticks, staysShut, why }, what) {
    if (typeof why !== 'string' || why.length === 0) {
        fail(`${what}: wait.why must say what this arm is the control FOR — which arm `
            + 'opens the same responder, and by what one difference. A negative with no '
            + 'positive beside it is a wait that cannot fail for the right reason.');
    }
    const responder = run.world.activators.find((a) => a.id === staysShut);
    if (!responder) {
        fail(`${what}: level ${run.level} has no activator ${staysShut}; it has `
            + `[${run.world.activators.map((a) => a.id).join(' ') || 'none'}].`);
    }
    if (run.openActivators.has(staysShut)) {
        fail(`${what}: ${staysShut} is ALREADY OPEN before the wait, so a control that `
            + 'watches it stay shut is watching the wrong world.');
    }
    for (let i = 1; i <= ticks; i += 1) {
        perTick.push(NO_HELD);
        const { transition } = run.advance(NO_HELD);
        if (transition) {
            fail(`${what}: wait tick ${i} of ${ticks} crossed from level `
                + `${transition.from_level} to ${transition.to_level}.`);
        }
        if (run.openActivators.has(staysShut)) {
            fail(`${what}: ${staysShut} OPENED on tick ${i} of ${ticks}. This arm is the `
                + 'control and its premise is that nothing here holds that button — so '
                + 'either the arms are not one field apart or the field is not the one '
                + 'the pair names.');
        }
    }
    return { staysShut, ticks, openedAt: null, why };
}

function runWait(run, perTick, wait, what) {
    if (run.openActivators === null) {
        fail(`${what}: a wait is a MECHANIC, and the noclip arm does not run it — `
            + '`advance` hands `stepV2` a null activator set, so the wait would emit '
            + 'its ticks, verify nothing and report success.');
    }
    const {
        ticks, opens, why, staysShut = null,
    } = wait ?? {};
    if (!Number.isInteger(ticks) || ticks <= 0) {
        fail(`${what}: wait.ticks must be a positive integer, got ${JSON.stringify(ticks)}.`);
    }
    /**
     * ⛓⛓⛓ R5 SLICE 22 — `wait.staysShut`, THE SHUT-BEFORE ARM'S OWN VERB.
     *
     * A pair's two arms are TWO WORLDS, and until this slice only one of
     * them had a verb: `wait.opens` asserts a responder GOES DOWN, and the
     * control arm had to be a hand-edited tape because there was nothing
     * that asserted one STAYS UP. That worked while a control could be made
     * by deleting spans; it stopped working the moment the control had to
     * be synthesised (see `plan-seedling-r5-l40-part5.mjs`).
     *
     * ⛔ AND IT IS CHECKED ON EVERY TICK, NOT AT THE END. A responder that
     * opened for eleven ticks and shut again would pass an end-state test
     * and would mean the control's premise was false the whole time —
     * exactly the vacuity [[feedback_silent_watcher_vacuous_negative]]
     * names. The positive control for the negative is the OTHER ARM, which
     * opens the same responder from the same stance.
     */
    if (staysShut !== null && opens !== undefined && opens !== null) {
        fail(`${what}: wait.opens and wait.staysShut are the two ARMS of one experiment `
            + 'and a wait is one of them. Naming both is a wait that asserts a '
            + 'responder both does and does not go down.');
    }
    if (staysShut !== null) {
        if (typeof staysShut !== 'string' || staysShut.length === 0) {
            fail(`${what}: wait.staysShut must name the responder this arm asserts is `
                + 'NOT opened.');
        }
        return runWaitShut(run, perTick, { ticks, staysShut, why }, what);
    }
    if (typeof opens !== 'string' || opens.length === 0) {
        fail(`${what}: wait.opens must name the responder this wait is FOR — a wait with `
            + 'no effect check is an idle span, and an idle span verifies nothing. The '
            + 'shut-before arm of a pair says `wait.staysShut` instead.');
    }
    if (typeof why !== 'string' || why.length === 0) {
        fail(`${what}: wait.why must say what is holding ${opens}'s button, because the `
            + 'player is not. A wait with no reason is a sleep.');
    }
    const responder = run.world.activators.find((a) => a.id === opens);
    if (!responder) {
        fail(`${what}: level ${run.level} has no activator ${opens}; it has `
            + `[${run.world.activators.map((a) => a.id).join(' ') || 'none'}].`);
    }
    if (run.openActivators.has(opens)) {
        fail(`${what}: ${opens} is ALREADY OPEN before the wait, so waiting for it proves `
            + 'nothing. Either an earlier target opened it or its group was never shut.');
    }
    let openedAt = null;
    for (let i = 1; i <= ticks; i += 1) {
        perTick.push(NO_HELD);
        const { transition } = run.advance(NO_HELD);
        if (transition) {
            fail(`${what}: wait tick ${i} of ${ticks} crossed from level `
                + `${transition.from_level} to ${transition.to_level}.`);
        }
        if (openedAt === null && run.openActivators.has(opens)) openedAt = i;
    }
    if (!run.openActivators.has(opens)) {
        fail(`${what}: ${opens} is STILL SHUT after ${ticks} idle tick(s). A \`Lock\` `
            + 'needs 101 CONTINUOUS ticks of its group being published and a `Cover` 11, '
            + 'and the count restarts the moment the button is released — so this is '
            + 'either a wait that is too short or a presser nothing is standing on.');
    }
    return { opens, ticks, openedAt, why };
}

function runHold(run, perTick, hold, what, before = null) {
    if (run.openActivators === null) {
        fail(`${what}: a hold is a MECHANIC, and the noclip arm does not run it — `
            + '`advance` hands `stepV2` a null activator set, so the hold would emit '
            + 'its ticks, verify nothing and report success. A tape that holds a '
            + 'button must declare noclip: false.');
    }
    const { ticks } = hold;
    const presser = resolvePresser(run.world, hold.presser, what);

    const group = run.world.activators.filter((a) => a.t === presser.t);
    /**
     * ⛓⛓ R5 SLICE 9: A GROUP WHOSE ONLY RESPONDER IS A `Pulser`.
     *
     * §21.65's finding, from the caller's side: a Pulser is an `Activators`
     * with a `t`, and it is deliberately NOT in `world.activators` because
     * it is `type = "Solid"` published or not — putting it there would make
     * `collidesSolid` treat an armed one as passable. So the group check
     * above, which asks "does anything answer this?", answered NO for
     * L38's link 2 and the leg failed at the one button the level turns on.
     *
     * The answer is not to widen `activators`; it is that a pulser group's
     * EFFECT is a different observable. Nothing opens. What happens is that
     * the pulser starts hitting — see `run.armedPulsers`.
     */
    const pulserGroup = (run.world.pulsers ?? []).filter((p) => p.t === presser.t);
    /**
     * ⛔⛔ AND A THIRD OBSERVABLE: a CROSS-ROOM presser answers nothing in
     * this level at all.
     *
     * `buttonroom@32,48 {t 8, room 39}` — L38's entrance button, and the
     * only way into the whole totem cluster — publishes to NOTHING here:
     * `ButtonRoom.as:93` writes `Game.setPersistence(t, persist, room)` and
     * the thing it changes is what ANOTHER level BUILDS. So both checks
     * above are structurally unanswerable for it, and the effect it does
     * have is `run.roomWrites`.
     *
     * ⚠ THIS IS THE THIRD TIME IN ONE VERB that "which responder opened?"
     * was the wrong question. A latching ButtonRoom moved the control
     * earlier; a Pulser needed a different observable; this one has no
     * responder at all. The pattern is that `hold` was written for a
     * `Button` and every `ButtonRoom` is a different mechanism wearing the
     * same rect.
     */
    const crossRoom = presser.room >= 0;
    if (group.length === 0 && pulserGroup.length === 0 && !crossRoom) {
        fail(`${what}: ${presser.tag}@${presser.x},${presser.y} presses group `
            + `t=${presser.t}, which NO responder in level ${run.level} answers — the `
            + `level's responders are [${run.world.activators
                .map((a) => `${a.id}(t=${a.t})`).join(' ')
                || 'none'}] and its pulsers are [${(run.world.pulsers ?? [])
                .map((p) => `${p.id}(t=${p.t})`).join(' ') || 'none'}]. Holding it `
            + 'would open nothing and arm nothing.');
    }
    // ⚠ THE POSITIVE CONTROL, BEFORE THE NEGATIVE. "The lock is open after
    // the hold" is satisfied by a lock that was never shut — the same
    // vacuity `l71-lock-shut` exists to close on the game's side. So the
    // responders this hold CHANGES are recorded here, and a hold that
    // changes nothing is a named failure rather than a silent pass.
    // ⛓ THE APPROACH IS PART OF THE MECHANIC for a latching presser — see
    // the `before` snapshot at the call site. Falling back to the current
    // state keeps every direct caller (and every test) on the old reading.
    const openBefore = before?.open ?? run.openActivators;
    const shutBefore = group.filter((a) => !openBefore.has(a.id));
    // The same control for the pulser arm: quiet before, loud after.
    const armedBefore = before?.armed ?? run.armedPulsers ?? new Set();
    const quietBefore = pulserGroup.filter((p) => !armedBefore.has(p.id));
    const writesBefore = crossRoom ? run.roomWrites.length : 0;
    if (shutBefore.length === 0 && quietBefore.length === 0 && !crossRoom) {
        // ⚠ THE DIAGNOSIS BRANCHES ON WHICH ARM IS EMPTY. A group with no
        // pulser in it fails for the reason it always did, in the words it
        // always used; only a group that HAS one has an "already armed"
        // arm to be wrong about. A message that named both would describe
        // a state the failing run is not in.
        fail(`${what}: every responder in group t=${presser.t} `
            + `[${[...group.map((a) => a.id), ...pulserGroup.map((p) => p.id)].join(' ')}] `
            + `is ALREADY OPEN${pulserGroup.length > 0 ? ' (or already armed)' : ''} `
            + 'before the hold begins, so holding the button proves nothing about it. '
            + 'A hold that changes nothing is a check that cannot fail.');
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
    // ⛓ THE CROSS-ROOM EFFECT: the write happened, and it names this presser.
    let wrote = null;
    if (crossRoom) {
        wrote = run.roomWrites.slice(writesBefore)
            .filter((w) => w.id === `${presser.tag}@${presser.x},${presser.y}`);
        if (wrote.length === 0) {
            // The write is emitted ONCE PER VISIT (`roomWritten`), so a hold
            // that arrives after the approach already made it sees none — the
            // same latch shape as everything else in this verb. Fall back to
            // the whole ledger, which still fails for a presser nobody stood on.
            wrote = run.roomWrites
                .filter((w) => w.id === `${presser.tag}@${presser.x},${presser.y}`);
        }
        if (wrote.length === 0) {
            fail(`${what}: held ${presser.tag}@${presser.x},${presser.y} for ${ticks} `
                + `tick(s) and it made NO cross-room write. It publishes to level `
                + `${presser.room} (t=${presser.t}, flip=${presser.flip}), and `
                + '`ButtonRoom.set activate` fires on the rising edge of a press — so '
                + 'no write means the stance never overlapped the button.');
        }
    }
    const armedAfter = run.armedPulsers ?? new Set();
    const quiet = pulserGroup.filter((p) => !armedAfter.has(p.id));
    if (quiet.length > 0) {
        fail(`${what}: held ${presser.tag}@${presser.x},${presser.y} for ${ticks} `
            + `tick(s) and [${quiet.map((p) => p.id).join(' ')}] `
            + `${quiet.length === 1 ? 'is' : 'are'} STILL QUIET. A room = -1 `
            + 'ButtonRoom LATCHES its group (§20.6), so one tick standing on it is '
            + 'enough — a pulser still quiet after the hold means the stance never '
            + 'overlapped the button at all.');
    }
    return {
        presser: { tag: presser.tag, x: presser.x, y: presser.y, t: presser.t },
        ticks,
        at: { ...start },
        // The responders this hold CHANGED — shut when it started, open when
        // it ended. Not the whole group: one already open proves nothing.
        opened: shutBefore.map((a) => a.id),
        // ⛓ And the pulsers it ARMED, which open nothing and are the whole
        // effect of L38's link 2.
        armed: quietBefore.map((p) => p.id),
        // ⛓ …and the cross-room writes it made, which are the whole effect
        // of L38's entrance button.
        wrote: wrote === null ? [] : wrote.map((w) => ({ level: w.level, tag: w.tag, value: w.value })),
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

/** Shape-check a `keylock` before anything is planned or driven with it. */
export function assertKeyLock(keylock, what) {
    if (keylock === null || typeof keylock !== 'object' || Array.isArray(keylock)) {
        fail(`${what}: keylock must be { lock: {x, y} }`);
    }
    const l = keylock.lock;
    if (!l || !Number.isFinite(l.x) || !Number.isFinite(l.y)) {
        fail(`${what}: keylock.lock must be the lock's OEL {x, y}`);
    }
}

/** The `BossLock` a keylock NAMES, by OEL coordinates. */
export function resolveKeyLock(world, named, what) {
    const lock = world.activators.find((a) => a.x === named.x && a.y === named.y);
    if (!lock) {
        fail(`${what}: level ${world.level} has no activator at (${named.x},${named.y}); `
            + `it has [${world.activators.map((a) => `${a.tag}@${a.x},${a.y}(t=${a.t})`)
                .join(' ') || 'none'}].`);
    }
    if (!lock.keyLine) {
        fail(`${what}: ${lock.id} is a "${lock.tag}", which does not open on a KEY — it `
            + `answers group t=${lock.t}. Only a BossLock reads Player.hasKey.`);
    }
    return lock;
}

/**
 * ── THE KEYLOCK PRIMITIVE (R4) ────────────────────────────────────────
 *
 * The fifth leg verb, and the third way a responder opens. `hold` stands on
 * a button and the flag is republished every tick; `touch` walks into a
 * shield lock and is TAKEN OVER for the fade; this one stands on a
 * one-pixel line beneath a `BossLock` holding the right key, and then —
 * uniquely — is free to do anything at all, because `activate` latches and
 * the fade runs to completion regardless.
 *
 * ⚠ THE WALK STANDS THERE ANYWAY, and that is a deliberate over-payment.
 * The latch is a claim about an ABSENCE (nothing in the extract sets
 * `BossLock.activate` false), and an absence is the one kind of source
 * reading a recording cannot confirm — a game that re-closed on leave and a
 * game that latched would look identical to a walk that never leaves. So
 * the leg holds the stance for the whole window, which is correct under
 * BOTH readings, and the model's latch stays a transcription with nothing
 * resting on it.
 *
 * Four checks, the `runSpear` shape:
 *   1. the STANCE — the player's box really contains one of the line's
 *      integer probes, asked of the world's own geometry;
 *   2. the KEY — the run holds `keyType`, before the wait rather than after;
 *   3. the POSITIVE CONTROL — the lock is SOLID now, or opening it proves
 *      nothing;
 *   4. the EFFECT — `run.openActivators` has it, and `run.keyOpens` names
 *      the flag.
 */
function runKeyLock(run, perTick, keylock, what) {
    if (run.openActivators === null) {
        fail(`${what}: a keylock is a MECHANIC, and the noclip arm does not run it — `
            + '`advance` hands `stepV2` a null activator set, so the walk would pass '
            + 'through the lock whether or not it ever opened.');
    }
    const lock = resolveKeyLock(run.world, keylock.lock, what);
    if (!run.keys.has(lock.keyType)) {
        fail(`${what}: ${lock.id} gates on \`Player.hasKey(${lock.keyType})\` and the run `
            + `holds key type(s) [${[...run.keys].join(', ') || 'none'}]. `
            + '`BossKey.removed()` is the only writer, so this means the key pickup is '
            + 'later in the route than the lock it opens — or in another segment, which '
            + 'is the same thing: a key is NOT inheritable through a boot grant.');
    }
    if (run.openActivators.has(lock.id)) {
        fail(`${what}: ${lock.id} is ALREADY OPEN before the stance, so opening it proves `
            + 'nothing. A BossLock that opened on an earlier visit is DESPAWNED by '
            + '`check()` rather than open, so this means an earlier leg of this visit '
            + 'already spent the window.');
    }
    if (!keyLineTouches(playerBoxAt(run.state.x, run.state.y), lock.keyLine)) {
        const b = playerBoxAt(run.state.x, run.state.y);
        fail(`${what}: the player is at (${run.state.x},${run.state.y}) — box `
            + `[${b.x},${b.right}) x [${b.y},${b.bottom}) — which contains none of `
            + `${lock.id}'s probes x=${lock.keyLine.x0}..${lock.keyLine.x1} at `
            + `y=${lock.keyLine.y}. \`World.collideLine\` tests INTEGER points and skips `
            + 'its own end point, and the pitch-8 lattice has no cell centre in the '
            + "band — so the leg's target has to be a pixel, pinned against the lock's "
            + 'own south face.');
    }
    const from = perTick.length;
    const window = KEY_LOCK_WINDOW;
    for (let i = 1; i <= window + KEY_LOCK_SLACK; i++) {
        perTick.push(NO_HELD);
        const { transition } = run.advance(NO_HELD);
        if (transition) {
            fail(`${what}: tick ${i} of ${lock.id}'s window crossed from level `
                + `${transition.from_level} to ${transition.to_level}. A world swap `
                + 'rebuilds the Game, so the fade restarts from `keyTimer` 60 and the '
                + 'flag is never written.');
        }
        if (run.openActivators.has(lock.id)) break;
    }
    if (!run.openActivators.has(lock.id)) {
        fail(`${what}: ${lock.id} is STILL SOLID after ${window + KEY_LOCK_SLACK} ticks `
            + `of standing on its line. \`opensOnKeyTick\` says ${window}.`);
    }
    const opened = run.keyOpens[run.keyOpens.length - 1];
    if (!opened || opened.id !== lock.id) {
        fail(`${what}: ${lock.id} reports open but the run's keyOpens ledger names `
            + `${opened ? opened.id : 'nothing'} — the two halves disagree about which `
            + 'lock this was.');
    }
    return {
        lock: { tag: lock.tag, x: lock.x, y: lock.y, id: lock.id },
        keyType: lock.keyType,
        persistTag: lock.persistTag,
        at: { x: run.state.x, y: run.state.y },
        from,
        window: perTick.length - from,
    };
}

/**
 * `activators.opensOnKeyTick(60, 0.05)` — imported as a NUMBER rather than
 * recomputed, so the driver and the state machine cannot disagree about the
 * window. The slack exists because the stance tick itself may or may not be
 * the latching one depending on where the approach stopped, and a verb that
 * waited exactly the window would fail by one on a stance reached mid-tick.
 */
const KEY_LOCK_WINDOW = opensOnKeyTick(60, 0.05);
const KEY_LOCK_SLACK = 4;
/** How long friction is given to bring a face nudge back to a full stop. */
const FACE_COAST_TICKS = 20;
/**
 * `Player.direction`'s own numbering (`Player.sprites()`), hoisted to module
 * scope at R5 slice 21 when `faceTowards` was lifted out of `runSpear`.
 * Two press verbs that disagreed about which number "N" is would be a bug
 * with no symptom until the rect fired at a wall.
 */
const FACINGS = { E: 0, N: 1, W: 2, S: 3 };
/** 32 ticks of glide plus slack — the wait a push that LANDS needs. */
const PUSH_GLIDE_TICKS = 40;
/**
 * ⛓⛓ How long `runKill` waits after its last press before asking whether
 * there is a corpse.
 *
 * The killing blow lands on the tick after the press (`slash()` runs above
 * `Mobile.input()` in `Player.update`, so the flag is set after that tick's
 * hit test) and `Mobile.death()` makes the corpse on the tick after THAT
 * (the body updates before the player, so its turn is already spent). Two
 * ticks is the arithmetic; this is padded to a whole slash window because
 * the cost is ticks and the failure is a leg that reports a live turret it
 * killed. ⚠ NOT `PUSH_GLIDE_TICKS`: a corpse does not glide until it is
 * bumped, and borrowing another mechanic's constant is how a wait comes to
 * mean nothing. [[feedback_two_cost_models_must_agree]]
 */
const KILL_STAGE_TICKS = 8;

/**
 * ⛓ R5 slice 13: how long a threaded press will wait for its corridor.
 *
 * L39's spinners cross the room in well under this, so a corridor that is
 * still occupied after it is one a wait cannot fix — which is a different
 * finding from "the timing is tight", and the failure says so.
 */
const THREAD_MAX_WAIT = 400;
/** ...and the eleven-frame fade on top, for a push that SINKS. */
const PUSH_SINK_TICKS = 60;

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

/**
 * ⛓ THE FACE NUDGE, EXTRACTED AT R5 SLICE 21 — same code, two callers.
 *
 * `runSpear` has carried this since R4 and `runKill` needs it for the same
 * reason and the same weapon. Lifted VERBATIM rather than rewritten: the
 * commentary below is the finding it exists to carry, and a second copy is
 * how two press verbs come to disagree about what "facing N" means.
 *
 * ⚠ AND IT IS LIFTED, NOT GENERALISED. It does exactly what it did — one
 * tap, up to `FACE_COAST_TICKS` of coast, two refusals — and takes no
 * options. [[feedback_refactor_same_work_different_program]]: the way this
 * goes wrong is a "cleanup" that changes the program.
 */
function faceTowards(run, perTick, facing, what) {
    const FACE_KEY = { E: 'right', N: 'up', W: 'left', S: 'down' };
    if (run.state.direction !== FACINGS[facing]) {
        const before = { x: run.state.x, y: run.state.y };
        const tap = new Set([FACE_KEY[facing]]);
        perTick.push(tap);
        run.advance(tap);
        for (let i = 0; i < FACE_COAST_TICKS; i++) {
            if (run.state.vx === 0 && run.state.vy === 0) break;
            perTick.push(NO_HELD);
            const { transition } = run.advance(NO_HELD);
            if (transition) {
                fail(`${what}: the face nudge crossed from level `
                    + `${transition.from_level} to ${transition.to_level}.`);
            }
        }
        if (run.state.direction !== FACINGS[facing]) {
            const names = Object.entries(FACINGS)
                .find(([, v]) => v === run.state.direction)?.[0] ?? run.state.direction;
            fail(`${what}: the leg declares facing ${facing}, the player was facing `
                + `${names} at (${before.x},${before.y}), and a tap of `
                + `${FACE_KEY[facing]} left them facing ${names} at `
                + `(${run.state.x},${run.state.y}). A tap that changes nothing means `
                + 'the stance is pinned against something in the facing direction, so '
                + 'the press would fire its rect at a wall.');
        }
        const o = plannerObstacleAt(run.world, run.state.x, run.state.y, null,
            liveGeometryOpts(run, {
                noclip: false, noHazards: run.noHazards, inventory: run.inventory,
            }));
        if (o) {
            fail(`${what}: the face nudge moved the player from (${before.x},${before.y})`
                + ` to (${run.state.x},${run.state.y}), which is ${describe(o)}. The tap `
                + 'is a fraction of a pixel, so a stance this close to something is a '
                + 'stance the route should not have chosen.');
        }
    }
}

/**
 * ── ⛓⛓⛓ THE KILL PRIMITIVE (R5 slice 21) ─────────────────────────────
 *
 * The eleventh leg verb, and the first one whose target is ALIVE.
 *
 *     { x: 488, y: 448, kill: { id: 'iceturret@472,400', facing: 'N' } }
 *
 * ── ⛔ WHY IT IS NOT `runSpear` WITH A FOURTH TARGET ─────────────────
 *
 * Every other press verb is ONE press with ONE effect. A kill is three
 * presses that must be SPACED: `Enemy.hit`'s first gate is
 * `hitsTimer <= 0`, a landed hit sets it to 30, and the body's `hitUpdate`
 * runs BEFORE the player each tick — so the gate reopens on the thirtieth
 * tick after and `KILL_PRESS_CADENCE` (31) clears it by ONE. Presses closer
 * than that are not a faster kill; they are presses the enemy refuses,
 * and the ones inside `SLASH_TIMER_MAX` are a DASH that moves the player.
 *
 * ⛓ AND THE COUNT IS A FLOOR, THE ASSERTION IS THE EFFECT — `killSchedule`'s
 * doctrine, applied. The leg may send a slack press; gate 4 of `Enemy.hit`
 * (`hits < hitsMax`) makes a press at a dying body a true no-op, so slack
 * costs ticks and nothing else. What is asserted is that the CORPSE EXISTS.
 *
 * ── ⛔⛔ THE FIVE THINGS THAT COULD SILENTLY NOT HAPPEN ──────────────
 *
 *   1. the STANCE — at a full stop, so the rect fires where the leg aimed;
 *   2. the FACING — `faceTowards`, shared with `runSpear`;
 *   3. the REACH — the slash rect has to CONTAIN the body, and the game
 *      then applies a 16 px distance gate the rect does not express. A
 *      press that hits nothing is not an error the game reports;
 *   4. the POSITIVE CONTROL — the target is ALIVE before the first press,
 *      because a corpse refuses every hit (`IceTurret.hit` is entirely
 *      inside `if (currentAnim != "dead")`) and a leg that killed it on an
 *      earlier visit would pass by doing nothing;
 *   5. the LEDGER — how many `tset == -1` locks the room holds and how many
 *      the death opened, asserted as the run COMPUTED them rather than
 *      assumed nil. "There were no kill locks" and "nobody looked" print
 *      the same thing.
 *
 * ⚠ THE DAMAGE THE PLAYER TAKES IS PRICED, NOT FORBIDDEN. An `IceTurret`
 * shoots a three-blast spread every 25 ticks inside 128 px and its
 * `hitPlayer` is worth 1 — a leg that has to stand inside that for ~65
 * ticks is going to be hit. `Bot.noDamage` and the run's health are what
 * carry it; this verb refuses to pretend the approach is free.
 */
function runKill(run, perTick, kill, what) {
    if (run.openActivators === null) {
        fail(`${what}: a kill is a MECHANIC, and the noclip arm does not run it — `
            + '`advance` hands `stepV2` a null world state, so the presses would emit '
            + 'their spans, kill nothing and report success. A tape that kills must '
            + 'declare noclip: false.');
    }
    const {
        id = null, facing = null, presses = null, cadence = KILL_PRESS_CADENCE,
        wait = null, blastsUnmodelled = null,
    } = kill;
    /**
     * ── ⛔⛔⛔ THE DECLARATION THE RECORDING FORCED (R5 slice 21) ──────
     *
     * `r5-l40-part5` synthesised clean, drove clean, and DIVERGED FROM THE
     * REAL GAME at tick 1616 of 1965 — in BOTH arms of its pair, at the
     * same tick, by the same 0.8 px, growing to a permanent 14.15 px y
     * offset. The recording is valid; the model is refuted; the fixtures
     * were withdrawn rather than committed.
     *
     * The cause is `IceTurretBlast`, and it is NOT the damage:
     *
     *     case "Player":
     *         (hits[i] as Player).freeze(freezeTime);            // 15 ticks
     *         (hits[i] as Player).hit(null, 0, new Point(x, y)); // Bot.noDamage
     *
     * `Player.hit`'s whole body is behind `if (Bot.noDamage) return`, so
     * the damage is free. `freeze()` is the line ABOVE it and is guarded by
     * nothing, and `Player.input()` returns while `frozenTimer > 0` — so a
     * blast STOPS THE WALK. The recording shows a nine-tick dead stop the
     * model walks straight through.
     *
     * ⛔ AND IT IS UNAVOIDABLE FOR THIS ERRAND. `attackRange` is 128 and
     * the slash reach is 16, so every stance that can kill one is 112 px
     * inside the volume the blasts come out of. There is no approach that
     * is out of range, which is why this is a DECLARATION rather than a
     * re-route: the leg is model-sound and it is NOT byte-exact, and an
     * author who has not met that fact should not be able to write one.
     *
     * ⚠ THE SAME SHAPE AS `fire.enemyRoom`, and for a stronger reason: that
     * one is a bound nobody has measured, this one is a divergence somebody
     * HAS. [[feedback_silent_watcher_vacuous_negative]] would let a green
     * synthesis stand in for a green recording; this will not.
     */
    // ⛓⛓⛓ R5 SLICE 22: THE DECLARATION IS RETIRED, AND ONLY BECAUSE THE
    // GAP IT NAMED IS CLOSED. `iceTurretBlast.js` models the projectile and
    // the same two tapes now replay BYTE-IDENTICAL to the recording that
    // refuted them. A `blastsUnmodelled` string is REFUSED rather than
    // ignored: a leg still carrying one is a leg written against the old
    // model, and silently accepting it is how a retired guard keeps
    // reporting green ([[feedback_retired_oracle_check_the_regen]]).
    if (blastsUnmodelled !== null) {
        fail(`${what}: kill.blastsUnmodelled is RETIRED. \`IceTurretBlast\` is modelled `
            + `(the ELEVENTH per-visit family) and this leg's freezes are PRICED — `
            + `${ICE_TURRET_PLAN.blasts.costTicksPerContact} refused input ticks each, `
            + 'reported as `blastFreezes` on the kill record and on `run.blastFreezes`. '
            + 'Delete the declaration; the leg is byte-exact now.');
    }
    if (typeof id !== 'string') {
        fail(`${what}: kill.id must be the turret id \`world.iceTurrets\` carries, e.g. `
            + '"iceturret@472,400". It is the OEL placement, not a live position — the '
            + 'body moves once it is a corpse.');
    }
    if (!(facing in FACINGS)) {
        fail(`${what}: kill.facing must be one of E/N/W/S, got ${JSON.stringify(facing)}. `
            + 'Declared rather than derived for `runSpear`\'s reason: `Player.direction` '
            + 'comes from the last tick that had velocity, so a wall-pinned stance has a '
            + 'facing and no keys.');
    }
    if (cadence < KILL_PRESS_CADENCE) {
        fail(`${what}: a cadence of ${cadence} is under the ${KILL_PRESS_CADENCE}-tick `
            + `floor. \`Enemy.hit\`'s i-frame is ${ICE_TURRET.hitsTimerMax} ticks and the `
            + `body's \`hitUpdate\` runs BEFORE the player, so the gate reopens on the `
            + `${ICE_TURRET.hitsTimerMax}th tick after a landed hit — the margin is ONE. `
            + `And anything under \`SLASH_TIMER_MAX\` turns the second press into a DASH, `
            + 'which MOVES the player and re-aims the rect.');
    }

    // ── the target, and the two rosters that have to agree about it ───
    const row = (run.world.iceTurrets ?? []).find((t) => t.id === id);
    if (!row) {
        fail(`${what}: level ${run.level} holds no ${id}. Known: `
            + `[${(run.world.iceTurrets ?? []).map((t) => t.id).join(', ') || 'none'}].`);
    }
    const before = (run.turretDamage ?? []).find((t) => t.id === id);
    if (!before) {
        fail(`${what}: the run has no damage state for ${id}, which means \`levelRun\` `
            + 'did not build a turret roster for this level — a kill against no state '
            + 'would report the body unhurt and say nothing about why.');
    }

    // ── the positive control, BEFORE anything is pressed ──────────────
    if (before.dead || before.dying) {
        fail(`${what}: ${id} is ALREADY ${before.dead ? 'a CORPSE' : 'DYING'} before the `
            + 'first press, so killing it proves nothing. `IceTurret.hit` is entirely '
            + 'inside `if (currentAnim != "dead")`, so every press below would be a real '
            + 'no-op — and the turret is PER VISIT (no `check()`, no tag), so a corpse '
            + 'here means an earlier leg of THIS window already spent the kill.');
    }
    if (before.hits !== 0) {
        fail(`${what}: ${id} already has ${before.hits}/${before.hitsMax} hits before the `
            + 'leg starts. The press count below is priced from a full body; starting '
            + 'part-damaged makes the schedule an over-estimate that would still pass, '
            + 'which is the shape of a leg that is measuring the wrong thing.');
    }

    // ── the stance and the facing ─────────────────────────────────────
    if (run.state.vx !== 0 || run.state.vy !== 0) {
        fail(`${what}: the stance (${run.state.x},${run.state.y}) is still MOVING — `
            + `v=(${run.state.vx},${run.state.vy}). The slash rect is anchored on the `
            + 'player and fires the tick AFTER the press, so a drifting stance aims '
            + 'somewhere the leg did not choose.');
    }
    faceTowards(run, perTick, facing, what);
    const at = { x: run.state.x, y: run.state.y };

    /**
     * ── ⛔ THE REACH, CHECKED BEFORE THE FIRST PRESS ─────────────────
     *
     * `Player.slash()` collects with `collideRectInto` and then applies
     * `FP.distanceRectPoint(x, y, <target box>) <= slashingSprite.width *
     * scaleX` — 16 px from the player's CENTRE POINT to the target's BOX.
     * So the rect is necessary and not sufficient, and a stance in the
     * corner of the 16x32 box can be 20 px away and hit nothing.
     *
     * ⚠ CHECKED AGAINST THE ALIVE 32x32 BODY, which is the one that is
     * standing right now. The corpse is 16x16 and this verb never presses
     * at one.
     */
    const rect = slashRect(at.x, at.y, FACINGS[facing]);
    const body = {
        x: row.x, y: row.y, right: row.x + ICE_TURRET.alive.w, bottom: row.y + ICE_TURRET.alive.h,
    };
    assertRect(body, `${what}: ${id}'s alive body`);
    if (!rectsOverlap(rect, body)) {
        fail(`${what}: the ${facing}-facing slash rect from (${at.x},${at.y}) — `
            + `[${rect.x},${rect.right}) x [${rect.y},${rect.bottom}) — does not reach `
            + `${id}'s body [${body.x},${body.right}) x [${body.y},${body.bottom}). A `
            + 'press that hits nothing is not an error the game reports; it is a walk '
            + 'that stands beside a live enemy pressing X.');
    }
    const reach = distanceRectPoint(at.x, at.y, body);
    if (reach > SLASH_REACH) {
        fail(`${what}: the rect reaches ${id} and the DISTANCE GATE does not — `
            + `${reach.toFixed(2)} px from the player's centre to the body, against `
            + `${SLASH_REACH}. \`Player.slash\` filters the rect's own candidates with `
            + '`FP.distanceRectPoint(...) <= slashingSprite.width * scaleX`, so a corner '
            + 'of the 16x32 box is inside the rect and outside the swing.');
    }

    // ── the presses ───────────────────────────────────────────────────
    // ⛓ THE COUNT IS A FLOOR. `hitsMax` at this weapon's damage, and the
    // leg may ask for more; gate 4 (`hits < hitsMax`) makes the extra ones
    // true no-ops rather than a second death.
    const need = Math.ceil(ICE_TURRET.hitsMax
        / (run.inventory?.hasDarkSword ? DARK_SWORD_DAMAGE : SWORD_DAMAGE));
    const count = presses ?? need;
    if (!Number.isInteger(count) || count < need) {
        fail(`${what}: ${count} press(es) cannot kill ${id} — it takes ${need} landed `
            + `hits at ${ICE_TURRET.hitsMax} \`hitsMax\` and this weapon's damage. The `
            + 'count is a FLOOR and the assertion is the corpse; asking for fewer is a '
            + 'leg that would end beside a live turret and report success.');
    }
    const PRESS = new Set(['primary']);
    const pressTick = perTick.length;
    // ⛓⛓⛓ R5 SLICE 22: WHAT THE STANCE COSTS, MEASURED ACROSS THE LEG.
    // Every kill stance is 112 px inside `attackRange`, so a kill leg
    // stands in a three-blast spread on purpose; this counts what that
    // bought the turret. ⛔ `levelRun` already REFUSES a press that lands
    // inside a freeze span, so a leg that gets here has spent only ticks.
    const freezesBefore = (run.blastFreezes ?? []).length;
    for (let k = 0; k < count; k += 1) {
        // ⛓⛓⛓ R5 SLICE 22: and this is where the stance's own price is
        // paid. Every kill stance is 112 px inside `attackRange`, so a
        // volley is in the air for most of the cadence; a press inside its
        // freeze span would be LOST and the body would take two hits, not
        // three. The gap below is a floor, so spending ticks here is free.
        holdUntilUnfrozen(run, perTick, `${what} press ${k + 1}`);
        perTick.push(PRESS);
        const pressed = run.advance(PRESS);
        if (pressed.transition) {
            fail(`${what}: press ${k + 1} crossed from level `
                + `${pressed.transition.from_level} to ${pressed.transition.to_level}.`);
        }
        // ⚠ THE GAP IS HELD EMPTY, not walked. Any movement here re-aims the
        // next rect and re-derives the facing, and the whole point of the
        // cadence is that the player is standing still through it.
        const gap = k === count - 1 ? 0 : cadence - 1;
        for (let i = 0; i < gap; i += 1) {
            perTick.push(NO_HELD);
            const { transition } = run.advance(NO_HELD);
            if (transition) {
                fail(`${what}: the gap after press ${k + 1} crossed from level `
                    + `${transition.from_level} to ${transition.to_level}.`);
            }
        }
    }

    /**
     * ── ⛔⛔ THE WAIT, AND IT IS NOT ZERO ────────────────────────────
     *
     * The killing blow sets `destroy`; `Mobile.mobileUpdate`'s
     * unconditional `death()` is what turns the body into the corpse, and
     * that is the NEXT tick — the body updates BEFORE the player, so its
     * turn for the killing tick has already been taken.
     *
     * ⛓ AND THE CORPSE IS NOT A WALL UNTIL THE PLAYER IS OFF IT.
     * `type = "Solid"` is `IceTurret.update`'s own tail —
     * `else if (!collide("Player", x, y))` — and it is a LATCH. A leg that
     * kills from inside the 16x16 corpse box has to step off before the
     * flip, which is the NEXT verb's job and is why this one reports
     * `solid` rather than asserting it.
     */
    const ticks = wait ?? KILL_STAGE_TICKS;
    for (let i = 0; i < ticks; i += 1) {
        perTick.push(NO_HELD);
        const { transition } = run.advance(NO_HELD);
        if (transition) {
            fail(`${what}: wait tick ${i + 1} of ${ticks} crossed from level `
                + `${transition.from_level} to ${transition.to_level}.`);
        }
    }

    // ── the effect ────────────────────────────────────────────────────
    const after = (run.turretDamage ?? []).find((t) => t.id === id);
    if (!after?.dead) {
        fail(`${what}: ${count} press(es) at ${cadence}-tick cadence from `
            + `(${at.x},${at.y}) facing ${facing} left ${id} on `
            + `${after?.hits ?? '?'}/${after?.hitsMax ?? '?'} hits and it is NOT a `
            + 'corpse. Either the rect missed (the 16 px distance gate, not the box), '
            + 'the slot holds no sword (a press with an empty `Main.primary` is a '
            + 'silent no-op), or the presses were closer than the i-frame and the body '
            + 'refused them.');
    }
    if (after.removed) {
        fail(`${what}: ${id} is GONE, not a corpse. \`IceTurret.death()\` intercepts the `
            + 'first `destroy`, so a REMOVED body means the corpse then reached water, '
            + 'lava or a pit and `Mobile.death()` faded it out — there is nothing left '
            + 'to push.');
    }

    /**
     * ⛔⛔⛔ THE LEDGER, ASSERTED FROM WHAT THE RUN COMPUTED.
     *
     * This is the half that makes the R4 refusal safe to lift. The run
     * scans the room's `tset == -1` locks at every kill and throws if any
     * would open; the leg reads back HOW MANY it found, so a room that
     * silently stopped having locks — a changed extract, a different level
     * — is a diff rather than a still-green pass.
     * [[feedback_bounded_sweep_must_name_what_it_bounded]]
     */
    const record = (run.turretKills ?? []).filter((k) => k.id === id);
    if (record.length !== 1) {
        fail(`${what}: the run recorded ${record.length} kills of ${id} and the leg is `
            + 'ONE. A second entry means the body was killed twice, which `IceTurret.hit`'
            + "'s own `currentAnim != \"dead\"` gate makes impossible — so the two "
            + 'halves disagree about what happened.');
    }
    const [k0] = record;
    if (k0.killLocksOpened !== 0) {
        fail(`${what}: the kill of ${id} OPENED ${k0.killLocksOpened} kill lock(s) in `
            + `level ${run.level}. \`KILL_ARM_POLICY\` lifted IceTurret because its `
            + 'death moves NOTHING — `death()` intercepts the removal, so `classCount` '
            + 'is unchanged — and a room where it does is a room this arm has no '
            + 'verdict for.');
    }

    return {
        kind: 'kill',
        id,
        facing,
        /**
         * ⛓⛓ R5 SLICE 22: the freezes this leg took, and the ticks they
         * cost. Replaces `blastsUnmodelled`: the gap that string declared
         * is closed, and what a leg owes now is a NUMBER.
         */
        blastFreezes: (run.blastFreezes ?? []).slice(freezesBefore),
        blastFreezeTicks: ((run.blastFreezes ?? []).length - freezesBefore)
            * ICE_TURRET_PLAN.blasts.costTicksPerContact,
        at,
        pressTick,
        presses: count,
        cadence,
        reach,
        hits: after.hits,
        solid: after.solid === true,
        killLocks: k0.killLocks,
        killLocksOpened: k0.killLocksOpened,
        totalEnemies: k0.totalEnemies,
        ticks: perTick.length - pressTick,
    };
}

/**
 * ── THE SPEAR PRIMITIVE (R4) ──────────────────────────────────────────
 *
 * The fourth leg verb, and the first one that PRESSES A KEY on purpose.
 * `hold` stands on a volume, `touch` walks into a lock, `collect` walks onto
 * a pickup — all three are position. A press is not: it is one `primary`
 * span whose whole effect is decided by a 32x5 rect the player cannot see,
 * fired one tick later, against a facing derived from VELOCITY.
 *
 * So the verb declares what it is FOR, and the driver checks all four of the
 * things that could silently not happen:
 *
 *   1. the STANCE — the player is where the leg thinks, at a full stop;
 *   2. the FACING — declared by name and checked against `Player.direction`,
 *      because the direction comes from the last tick with velocity and a
 *      wall-pinned player is the one case where "holding a key" and "having
 *      a velocity" differ;
 *   3. the POSITIVE CONTROL, before the negative: the bridge is CLOSED /
 *      the block is where the leg says, or the press proves nothing;
 *   4. the EFFECT, from the run's own state after the wait.
 *
 * ⚠ THE AUDIT IS NOT HERE. `levelRun.applyThrust` runs it on the tick the
 * rect fires, because that is where the rect and the world are — a stray
 * lightpole or an unmodelled arm throws there, naming the tick. This verb's
 * job is the four checks above, which are about INTENT.
 */
function runSpear(run, perTick, spear, what) {
    if (run.openActivators === null) {
        fail(`${what}: a spear press is a MECHANIC, and the noclip arm does not run it — `
            + '`advance` hands `stepV2` a null world state, so the press would emit its '
            + 'span, change nothing and report success. A tape that presses must '
            + 'declare noclip: false.');
    }
    const { bridge = null, block = null, rock = null, facing, wait = null } = spear;
    // ⚠ `to` IS THE SPEAR'S, NOT THE BLOCK'S. A `block` names the entity by
    // the coordinates the LEVEL built it at — which never change — and `to`
    // names where this particular push should leave it, which is a fact
    // about the push. An earlier cut read `block.to` while the docblock said
    // `spear.to`; the route generator believed the docblock.
    const { to } = spear;
    // ⛓ R5 slice 5: a THIRD effect, and the first one a SWORD causes.
    // The verb was never really "a spear" — it is one tick of `primary`,
    // and which weapon that is comes from the equip — so a rock press is
    // the same four checks over a different positive control.
    const named = [bridge, block, rock].filter((e) => e !== null);
    if (named.length !== 1) {
        fail(`${what}: a press names EXACTLY ONE of \`bridge\` (by tile), \`block\` `
            + '(by OEL coordinates, with the tile it should end on) or `rock` (a '
            + 'BreakableRock, by OEL coordinates). Naming none presses at nothing; '
            + `naming ${named.length} makes the effect check ambiguous.`);
    }
    if (!(facing in FACINGS)) {
        fail(`${what}: \`facing\` must be one of E/N/W/S, got ${JSON.stringify(facing)}. `
            + 'It is DECLARED rather than derived because `Player.direction` comes from '
            + 'the last tick that had velocity — a wall-pinned player has a facing and '
            + 'no keys — so a stance that ended up facing the wrong way is a leg defect '
            + 'this names instead of a press that quietly hits nothing.');
    }
    /**
     * ── THE FACE NUDGE, and why a stance alone is not a facing ────────
     *
     * `sprites()` derives `direction` from VELOCITY, x before y, sticky at
     * rest — so the facing a press captures is the way the player was LAST
     * MOVING, not the way they are standing. And the bang-bang controller
     * OVERSHOOTS: driving west to (180,116) it passes the target, brakes,
     * and corrects EAST for the last tick with any velocity. The stance is
     * perfect and the rect fires at a wall behind the player.
     *
     * (That is not hypothetical. L67's push is exactly it: arrival at
     * (180.045, 116.519), facing E, one twentieth of a pixel past the aim
     * point.)
     *
     * So the verb taps the facing key for ONE tick and lets friction bring
     * the player back to a stop, where `direction` sticks. A tap is a
     * fraction of a pixel — far less than the ~5 px coast a released HELD
     * arrow leaves — and the position it lands on is re-checked against the
     * geometry rather than assumed, because "a nudge is small" is exactly
     * the kind of claim that is true until the stance is one pixel from a
     * pit.
     *
     * ⚠ A SETUP TARGET IS STILL THE FIRST ANSWER. The route gives every
     * push an axis-aligned approach point so the last leg is along the push
     * axis; this handles the overshoot the approach cannot, and it FAILS by
     * name if a tap does not fix it — which would mean the stance is pinned
     * against something in the facing direction.
     */
    faceTowards(run, perTick, facing, what);

    // ── the positive control, before the press ────────────────────────
    let expect = null;
    if (bridge) {
        const id = `${bridge.tx},${bridge.ty}`;
        const tile = run.world.bridgeTiles.find((t) => t.tx === bridge.tx && t.ty === bridge.ty);
        if (!tile) {
            fail(`${what}: level ${run.level} has no bridge tile at (${bridge.tx},`
                + `${bridge.ty}); it has [${run.world.bridgeTiles
                    .map((t) => `(${t.tx},${t.ty})`).join(' ') || 'none'}].`);
        }
        if (run.openBridges.has(id)) {
            fail(`${what}: bridge ${id} is ALREADY OPEN before the press, so opening it `
                + 'proves nothing. A bridge rebuilds CLOSED on every entry — an open '
                + 'one means an earlier leg in this visit already spent the press.');
        }
        expect = { kind: 'bridge', id };
    } else if (rock) {
        // ── R5: the rock, and its positive control ────────────────────
        const id = `breakablerock@${rock.x},${rock.y}`;
        const solid = run.world.solids.find((e) => e.rockId === id);
        if (!solid) {
            fail(`${what}: level ${run.level} has no BreakableRock at (${rock.x},`
                + `${rock.y}); it has [${run.world.solids.filter((e) => e.rockId)
                    .map((e) => e.rockId).join(' ') || 'none'}]. A rock is named by the `
                + 'coordinates the LEVEL built it at.');
        }
        if (!rockBreaksUnder(solid.rockType, run.inventory)) {
            fail(`${what}: ${id} is rockType ${solid.rockType} and the run holds `
                + `${run.inventory?.hasGhostSword ? 'the ghostsword' : 'no ghostsword'}. `
                + '`hit(_t)` breaks only when `rockType <= _t` and `Player.as:1071-1074` '
                + 'passes `hasGhostSword ? 1 : 0`, so this press would be a real no-op.');
        }
        if (run.brokenRocks.has(id)) {
            fail(`${what}: ${id} is ALREADY GONE before the press, so breaking it proves `
                + 'nothing. A rock with tag -1 rebuilds on every entry, so a broken one '
                + 'means an earlier leg of THIS visit already spent the swing.');
        }
        expect = { kind: 'rock', id, at: { x: rock.x, y: rock.y } };
    } else {
        const id = `${'pushableblockspear'}@${block.x},${block.y}`;
        const live = run.pushables.get(id);
        if (!live) {
            fail(`${what}: level ${run.level} has no pushable at (${block.x},${block.y}); `
                + `it has [${[...run.pushables.keys()].join(' ') || 'none'}]. A block is `
                + 'named by the coordinates the LEVEL built it at, which do not change '
                + 'when it moves.');
        }
        // ⚠ `to: null` IS A DECLARATION, not an omission — and it is the
        // one three of R4's five pushes make. A block that comes to rest on
        // water, lava or a pit DESTROYS itself
        // (`PushableBlockFire.input()`), which is what turns a push into a
        // REMOVAL and is the whole of §8.5's one wrong sentence. So the
        // effect check has two arms: a tile the block should be standing on,
        // or the block being GONE. `undefined` is still refused, because
        // "something moved" is a check a mis-aimed press satisfies.
        const destroys = to === null;
        if (!destroys
            && (!to || !Number.isInteger(to.tx) || !Number.isInteger(to.ty))) {
            fail(`${what}: a block press must name \`to: {tx, ty}\` — the tile the block `
                + 'should be standing on when the push lands — or `to: null` for a push '
                + 'onto water, lava or a pit, which destroys it. Without one of the two '
                + 'the effect check is "something moved", which a mis-aimed press '
                + 'satisfies.');
        }
        if (live.removed) {
            fail(`${what}: ${id} is ALREADY GONE before the press. A block is destroyed `
                + 'per VISIT and rebuilt on re-entry, so this means an earlier leg of '
                + 'this visit already spent it.');
        }
        const from = { tx: Math.floor(live.rect.x / TILE_SIZE), ty: Math.floor(live.rect.y / TILE_SIZE) };
        if (!destroys && from.tx === to.tx && from.ty === to.ty) {
            fail(`${what}: the block is ALREADY on (${to.tx},${to.ty}), so the push `
                + 'proves nothing.');
        }
        expect = { kind: 'block', id, from, to, destroys };
    }

    // ── the press: ONE tick of `primary` ──────────────────────────────
    // One span, one firing. `spearDelayMax` is 1 and `spearing` is cleared
    // by a sprite callback, so a LONGER hold would not fire the rect twice —
    // it is one tick because that is what the probe measured, not because a
    // longer one would be worse.
    const at = { x: run.state.x, y: run.state.y };
    // ⛓ R5 SLICE 22: a press on a frozen tick is LOST — see
    // `holdUntilUnfrozen`. Held before `pressTick` is read, so the tick the
    // schedule reports is the tick the press actually landed on.
    holdUntilUnfrozen(run, perTick, what);
    const pressTick = perTick.length;
    const PRESS = new Set(['primary']);
    perTick.push(PRESS);
    const pressed = run.advance(PRESS);
    if (pressed.transition) {
        fail(`${what}: the press tick crossed from level ${pressed.transition.from_level} `
            + `to ${pressed.transition.to_level}. The rect fires the tick AFTER the `
            + 'press, in whatever world the run is in by then — press away from a '
            + 'trigger volume.');
    }

    // ── the wait ──────────────────────────────────────────────────────
    // A bridge needs `TICKS_FROM_PRESS_TO_WALKABLE` on-screen ticks and the
    // run asserts the 64 px policy on every one of them; a block needs the
    // 32-tick glide, and `pushesSettled` is the run's own answer rather than
    // a count this verb repeats.
    // ⚠ A DESTROYING PUSH IS THE LONG ONE, and 40 was not enough. A block
    // glides 32 ticks (0.5 px/tick over a 16 px tile), and only THEN does
    // the sink check see it exactly on its target — after which the fade is
    // eleven more frames at 0.1 alpha before `FP.world.remove` lands. The
    // first cut waited 40 and reported a push that had happened as a push
    // that had not.
    // ⛔ AND A ROCK'S WAIT IS A PROMISE, NOT A MEASUREMENT. The animation
    // is seven ticks and the update order leaves ±1 of it open (see
    // `breakableRocks.HIT_TO_GONE_TICKS`), so the leg waits comfortably
    // past both and the difference cannot reach the stream.
    const ticks = wait ?? (expect.kind === 'bridge'
        ? TICKS_FROM_PRESS_TO_WALKABLE
        : (expect.kind === 'rock'
            ? WAIT_AFTER_PRESS_TICKS
            : (expect.destroys ? PUSH_SINK_TICKS : PUSH_GLIDE_TICKS)));
    if (expect.kind === 'rock') assertWaitCovers(ticks, what);
    for (let i = 1; i <= ticks; i++) {
        perTick.push(NO_HELD);
        const { transition } = run.advance(NO_HELD);
        if (transition) {
            fail(`${what}: wait tick ${i} of ${ticks} crossed from level `
                + `${transition.from_level} to ${transition.to_level}.`);
        }
        if (expect.kind === 'bridge' && run.openBridges.has(expect.id)) break;
        // ⚠ AND A DESTROYING PUSH IS NOT DONE WHEN THE GLIDE STOPS. The
        // sink is an eleven-frame fade AFTER the block reaches the tile, and
        // `FP.world.remove` lands at the end of it — so a wait that stopped
        // at `pushesSettled` would check `removed` before the game had
        // written it.
        if (expect.kind === 'block' && run.pushesSettled && i > 1
            && (!expect.destroys || run.pushables.get(expect.id).removed)) break;
    }

    // ── the effect ────────────────────────────────────────────────────
    if (expect.kind === 'rock') {
        // ⚠ NO EARLY EXIT FROM THE WAIT ABOVE, deliberately: a bridge's
        // loop breaks the moment the tile opens, and doing that here would
        // shorten the tape to exactly the number the ±1 lives in.
        if (!run.brokenRocks.has(expect.id)) {
            fail(`${what}: pressed at (${at.x},${at.y}) facing ${facing} and `
                + `${expect.id} is STILL SOLID after ${ticks} tick(s). The rect has to `
                + 'CONTAIN the rock (32x5 from the player, so a diagonal stance misses '
                + 'it) and the slot has to hold a sword — a press with an empty '
                + '`Main.primary` is a silent no-op in the game and here.');
        }
    } else if (expect.kind === 'bridge') {
        if (!run.openBridges.has(expect.id)) {
            fail(`${what}: pressed at (${at.x},${at.y}) facing ${facing} and bridge `
                + `${expect.id} is STILL SOLID after ${ticks} tick(s). The Tile arm of `
                + '`genericHit` fires only under t == "Spear" — check the equip — and '
                + 'the rect has to contain the tile.');
        }
    } else {
        const live = run.pushables.get(expect.id);
        const now = { tx: Math.floor(live.rect.x / TILE_SIZE), ty: Math.floor(live.rect.y / TILE_SIZE) };
        if (expect.destroys) {
            if (!live.removed) {
                fail(`${what}: pressed at (${at.x},${at.y}) facing ${facing} and the `
                    + `block is on (${now.tx},${now.ty}) and STILL THERE. The leg `
                    + 'declares `to: null`, which is "it comes to rest on water, lava or '
                    + 'a pit and destroys itself" — so either the destination is dry or '
                    + 'the push went somewhere else.');
            }
        } else if (now.tx !== expect.to.tx || now.ty !== expect.to.ty) {
            fail(`${what}: pressed at (${at.x},${at.y}) facing ${facing} and the block is `
                + `on (${now.tx},${now.ty}), not (${expect.to.tx},${expect.to.ty}). The `
                + 'block moves ONE TILE in the FACING direction and refuses a hit while '
                + 'it is already moving, and a push into a solid goes nowhere at all.');
        } else if (live.removed) {
            fail(`${what}: the block reached (${now.tx},${now.ty}) and was DESTROYED, `
                + 'which the leg did not declare. A destination that turns out to be '
                + 'water, lava or a pit is an opener the route did not plan for and a '
                + 'block a later push in the chain will aim at and miss.');
        }
        if (!run.pushesSettled) {
            fail(`${what}: the block reached (${now.tx},${now.ty}) but is still MOVING `
                + `after ${ticks} tick(s). A block is 16 px of solid at a straddling `
                + 'rect until it stops — walking now would meet it mid-glide.');
        }
    }
    return {
        ...expect, facing, at, pressTick, ticks: perTick.length - pressTick,
    };
}

/**
 * ── ⛓⛓ THE FIRE PRIMITIVE (R5 slice 7) ────────────────────────────────
 *
 * The sixth leg verb, and the first one with NO FACING.
 *
 *     { x: 152, y: 200, fire: { moves: [{ from: {tx:9,ty:11}, to: {tx:9,ty:10} }] } }
 *     { x: 104, y: 392, fire: { rope: { x: 96, y: 384 } } }
 *
 * `runSpear`'s four checks were stance / facing / positive control /
 * effect. This one keeps three of them and REPLACES the second, because
 * `Player.fire()`'s rect is 32x32 centred on the player: which way they
 * are pointing changes nothing, and the direction each block goes is
 * `atan2` AWAY from the stance. A face nudge here would be ceremony.
 *
 * ⛔ AND THE EFFECT CHECK IS AN EXACT SET, not "the block I named moved".
 * That is the finding this verb exists to carry: a press has no aim, so
 * every block inside the rect moves, and a leg that lists one of two is a
 * leg whose author did not know about the other. `moves` is checked both
 * ways against what the run reports.
 *
 * ⚠ THE WAIT IS THE GLIDE, and it is the same 32 ticks a spear push takes
 * (`pushables.TICKS_PER_TILE` — 16 px at `moveSpeed` 0.5). `PUSH_GLIDE_TICKS`
 * is the padded number `runSpear` already uses; `run.pushesSettled` is the
 * run's own answer and this waits for that rather than counting.
 */
function runFire(run, perTick, fire, what) {
    if (run.openActivators === null) {
        fail(`${what}: a fire press is a MECHANIC, and the noclip arm does not run it — `
            + '`advance` hands `stepV2` a null world state, so the press would emit its '
            + 'span, change nothing and report success. A tape that fires must declare '
            + 'noclip: false.');
    }
    const { moves = null, rope = null, burns = null, bumps = null, wait = null } = fire;
    const named = [moves, rope, burns, bumps].filter((e) => e !== null);
    if (named.length !== 1) {
        fail(`${what}: a fire press names EXACTLY ONE of \`moves\` (blocks, by the tile `
            + 'they are on and the tile they should end on), `rope` (a RopeStart, by '
            + 'its OEL coordinates), `burns` (BurnableTrees, by their OEL '
            + 'coordinates) or `bumps` (IceTurret CORPSES, by id and the tile they '
            + 'should end on). Naming none fires at nothing; naming more than one makes '
            + 'the effect check ambiguous.');
    }
    /**
     * ⛔ THE WEAPON, BEFORE ANYTHING ELSE — and the diagnosis this replaces
     * described the PASS.
     *
     * `useItem(Main.primary)` reads the SELECTED SLOT, and a run whose
     * `primary` is still 0 fires a SWORD. The whole verb then runs: the
     * press lands, a thrust is scheduled, the 40-tick wait elapses, and the
     * effect check reports *"the rope is STILL its full span … a stance too
     * far along the span is outside the rect"* — a sentence about geometry,
     * on a leg whose geometry was perfect. That cost a shaft plan an
     * afternoon. [[feedback_failure_detail_describes_the_pass]].
     *
     * §20.5's "one weapon, one equip, for the whole visit" is a LEG
     * OBLIGATION, not a remark: a fire leg needs an `equip` target ahead of
     * it, and this is where its absence gets named.
     */
    if (run.primaryWeapon !== 'fire') {
        fail(`${what}: the run's selected slot holds `
            + `${run.primaryWeapon ? `a ${run.primaryWeapon}` : 'NOTHING'} `
            + `(Main.primary = ${run.primary}), so \`useItem\` would fire that instead. `
            + 'A fire press needs an `equip` target ahead of it — `fire()` is a different '
            + 'rect, a different window and a different arm table from a slash, and the '
            + 'effect check below would report the target unmoved without ever saying '
            + 'why.');
    }
    /**
     * ⛔⛔⛔ R5 SLICE 12 — A GLIDE CORRIDOR IN A ROOM WITH ENEMIES CANNOT
     * BE CERTIFIED, AND THIS IS WHERE THAT IS SAID OUT LOUD.
     *
     * `PushableBlock*`'s constructor does `solids.push("Enemy", "Player")`.
     * A block is the ONE mover in the game that collides with enemies, and
     * the model does not simulate a single enemy's POSITION — the combat
     * census gives their spawn cell and their threat volume and stops
     * there. So in any room with a live enemy, "the block glides one tile"
     * is a prediction the model is not entitled to make.
     *
     * ⛔ It is not hypothetical: a wandering `Spinner` wedged block 2
     * mid-glide in L39 and cost the shaft its entire ledger, and the model
     * reported eighteen successful presses (`r5Shaft.SPINNER_WEDGE`; four
     * probe tapes, one of them byte-exact once the press was moved 120
     * ticks). A silent wrong answer is what this replaces.
     *
     * ⚠ THE ESCAPE HATCH IS A DECLARATION WITH EVIDENCE, not a flag. A leg
     * may pass `fire.enemyRoom: '<why>'` to say that this particular press
     * has been checked against the GAME — which is exactly what
     * `r5-press-delay` is. A boolean would let the next plan silence this
     * by typing `true`.
     */
    if (moves) {
        // ⚠ `combat.enemies`, NOT `combat` — the census is a REPORT
        // (`{level, enemies, hazards, counts, bill, killLocks, …}`) and a
        // `?? []` on the report itself would have made this check silently
        // vacuous, which is the exact shape of the defect it exists for.
        //
        // ⛔⛔ AND AN ABSENT CENSUS IS A REFUSAL, NOT A PASS. The `combat`
        // role is OPT-IN (§11.1) and the first cut of this check read
        // `run.world?.combat ?? []` — which on a world built without the
        // role is an empty list and a silent green, on the one question it
        // exists to ask. [[feedback_silent_watcher_vacuous_negative]], made
        // on the day the check was written.
        if (!fire.enemyRoom && !run.world?.combat) {
            fail(`${what}: the run's world for level ${run.level} has NO COMBAT CENSUS, so `
                + 'whether an enemy can wedge this block\'s glide cannot be asked. The '
                + '`combat` role is opt-in; build the world with it, or declare '
                + '`fire.enemyRoom: "<what the GAME said>"`. An absent census is not an '
                + 'empty one.');
        }
        const enemies = (run.world?.combat?.enemies ?? []).filter((e) => !e.removed);
        /**
         * ⛓⛓ R5 SLICE 13 — THE REFUSAL NARROWS TO THE UNMODELLED, AND NOT
         * ONE CLASS FURTHER.
         *
         * `spinner.js` steps a `Spinner`'s position every tick and
         * `levelRun`'s `pushableCtx().collides` now asks about its body, so a
         * glide corridor holding only spinners IS certifiable — the model
         * predicts the wedge rather than missing it, which
         * `r5-press-glide` and `r5-press-repeat` prove byte-exact over 816
         * observations, and `r5-press-delay` proves in the other direction.
         *
         * ⚠ THE PREDICATE IS `MODELLED_ENEMY_CLASSES`, WHICH IS A LIST OF
         * THINGS WITH A `step*`, not a list of things somebody understands.
         * A class earns a row by having a stepper and per-visit state. That
         * is the difference between narrowing this refusal and deleting it.
         */
        const unmodelled = unmodelledEnemies(enemies);
        if (unmodelled.length > 0 && !fire.enemyRoom) {
            fail(`${what}: level ${run.level} holds ${enemies.length} live `
                + `enem${enemies.length === 1 ? 'y' : 'ies'}, of which `
                + `[${unmodelled.join(', ')}] ${unmodelled.length === 1 ? 'is' : 'are'} `
                + 'NOT MODELLED — no stepper, no per-visit position. A `PushableBlock`\'s '
                + 'constructor pushes "Enemy" onto its own solids list, so an enemy '
                + 'standing in the glide corridor WEDGES the block — permanently, because '
                + 'a blocked block keeps `v` non-zero and `hit()` returns on '
                + '`v.length > 0`. The model cannot certify this press. Either model the '
                + 'class (`spinner.js` is the worked example, and '
                + `[${Object.keys(MODELLED_ENEMY_CLASSES).join(', ')}] `
                + 'already ha' + (Object.keys(MODELLED_ENEMY_CLASSES).length === 1 ? 's' : 've')
                + ' one), CLEAR the room with the encounter ladder\'s kill verb, or declare '
                + '`fire.enemyRoom: "<what the GAME said>"` on this target — see '
                + '`r5Shaft.SPINNER_WEDGE`.');
        }
        /**
         * ⛔⛔⛔ R5 SLICE 15 — AND AN ENEMY IS NOT THE ONLY MOVER THAT WEDGES
         * A BLOCK. A `Crusher` IS ONE, AND IT IS `type = "Solid"`.
         *
         * The refusal above was written for the class whose wedge cost the
         * shaft its ledger, and it asks about `combat.enemies`. A crusher is
         * in no combat census — `Crusher extends Activators` — and a block's
         * `solids` list carries "Solid" from `Mobile` itself, so it does not
         * need the ctor's two pushes to be stopped by one. It is a STRICTLY
         * WORSE wedge than a spinner's, for two reasons:
         *
         *   ⛓ it is 32x32 and moves in a straight line at 1 px/tick, so it
         *     crosses a whole glide corridor rather than grazing one;
         *   ⛔ and its own `moveX` collides only "Solid", so it does not stop
         *     for the block either — it shoves through the cell the block is
         *     gliding into and keeps coming.
         *
         * ⚠ AND THE CHECK IS THE SCAN, NOT A ROSTER TEST. A crusher this
         * press cannot wake is harmless, and in L41 that is exactly the
         * ORDER the room demands: push the block with the `breakablerock`s
         * STANDING (shielded, inert), break them afterwards. So the question
         * asked is the game's own — from the press stance, is any crusher
         * unshielded with the player in a lane, or already moving — and a
         * plan that gets the order wrong is told which crusher and why.
         */
        const liveCrushers = run.crushers;
        if (liveCrushers && liveCrushers.size > 0 && !fire.enemyRoom) {
            const box = playerBoxAt(run.state.x, run.state.y);
            const point = { x: run.state.x, y: run.state.y };
            for (const [id, c] of liveCrushers) {
                const solids = run.world.solidBoxesForMover(livePerVisitOpts(run), id);
                const s = scanCrusher({ x: c.x, y: c.y }, box, point, solids);
                if (s.dir === null && run.crushersParked) continue;
                const why = run.crushersParked
                    ? `it can see the player and its ${s.dir} lane matches`
                    : 'it is already CHARGING';
                fail(`${what}: ${id} is AWAKE at this press stance — ${why}. `
                    + 'A `Crusher` is a 32x32 '
                    + '`type = "Solid"` that MOVES, and a `PushableBlock`\'s solids list '
                    + 'carries "Solid" from `Mobile` — so it wedges a glide exactly as a '
                    + 'spinner does, permanently (a blocked block keeps `v` non-zero and '
                    + '`hit()` returns on `v.length > 0`), and unlike a spinner it does '
                    + 'not stop for the block either. Push with the crusher SHIELDED, or '
                    + 'bait and park it first — the order is the leg. See `CRUSHER_PLAN`.');
            }
        }
    }

    const at = { x: run.state.x, y: run.state.y };
    if (run.state.vx !== 0 || run.state.vy !== 0) {
        fail(`${what}: the stance (${at.x},${at.y}) is still MOVING — v=(${run.state.vx},`
            + `${run.state.vy}). The rect is centred on the player and it fires four `
            + 'ticks after the press, so a drifting stance aims somewhere the leg did '
            + 'not choose. Let the approach come to rest first.');
    }

    // ── the positive control, before the press ────────────────────────
    let expect;
    if (rope) {
        const id = `rope@${rope.x},${rope.y}`;
        if (run.pulledRopes.has(id)) {
            fail(`${what}: ${id} is ALREADY PULLED before the press, so pulling it proves `
                + 'nothing. `RopeStart.hit()` is entirely inside `if (!activate)`, so a '
                + 'second press is a real no-op — which means an earlier leg of this '
                + 'visit already spent it.');
        }
        expect = { kind: 'rope', id };
    } else if (bumps) {
        /**
         * ── ⛓⛓⛓ THE BUMP ARM (R5 slice 20) ───────────────────────────
         *
         * The FOURTH shape of a fire press, and the first whose target is
         * an ENEMY. `Player.genericHit` has a special case for exactly one
         * class — `if (e is IceTurret) (e as IceTurret).bump(new Point(x,
         * y), t)` — and it runs BEFORE `Enemy.hit`, on every dispatch.
         *
         * ⛔⛔ THE VERB TAKES A STANCE AND A COUNT, NOT A TICK. §33.5
         * measured ONE bump, found that the direction flips with the rest
         * cycle's phase, and concluded that "a fire press's tick PARITY is
         * load-bearing, which no press verb in this driver can express". A
         * press is FIVE bumps — `FIRE_WINDOW.hitTicks` is [4,5,6,7,8] — so
         * whichever phase the first lands on, the second lands on the
         * other, and the refused direction (half a pixel, back in two
         * ticks) never settles. All four cardinal pushes move a tile from
         * both parities. What survives is a ±0.5 px difference in where the
         * body comes to rest, which is why `to` is a TILE.
         *
         * ⛔ AND IT IS THE TILE OF THE ENTITY, not of the box. The corpse's
         * 16x16 box straddles a tile boundary on one half of the cycle
         * (`[479.5,495.5)` floors to col 29 where `[480,496)` floors to 30),
         * so a `to` read off the box would be parity-dependent — which is
         * exactly the thing this verb exists to stop a plan having to know.
         */
        if (!Array.isArray(bumps) || bumps.length === 0) {
            fail(`${what}: fire.bumps must be a non-empty array of {id, to:{tx,ty}} — the `
                + 'turret id `world.iceTurrets` carries and the ENTITY tile the corpse '
                + 'should end on.');
        }
        const live = [];
        for (const b of bumps) {
            if (!b || typeof b.id !== 'string' || !b.to
                || !Number.isInteger(b.to.tx) || !Number.isInteger(b.to.ty)) {
                fail(`${what}: fire.bumps[] must be {id, to:{tx,ty}} with integer tiles, `
                    + `got ${JSON.stringify(b)}.`);
            }
            const row = (run.world.iceTurrets ?? []).find((t) => t.id === b.id);
            if (!row) {
                fail(`${what}: level ${run.level} holds no ${b.id}. Known: `
                    + `[${(run.world.iceTurrets ?? []).map((t) => t.id).join(', ') || 'none'}].`);
            }
            const now = (run.turrets ?? new Map()).get(b.id);
            if (!now) {
                fail(`${what}: the run has no state for ${b.id}, which means `
                    + '`levelRun` did not build a roster for this level — a bump against '
                    + 'no state would report the corpse unmoved and say nothing about why.');
            }
            const from = { tx: Math.floor(now.x / TILE_SIZE), ty: Math.floor(now.y / TILE_SIZE) };
            if (from.tx === b.to.tx && from.ty === b.to.ty) {
                fail(`${what}: ${b.id} is ALREADY on (${b.to.tx},${b.to.ty}), so a press `
                    + 'that changed nothing would pass. Name where it should GO.');
            }
            live.push({ id: b.id, from, to: { ...b.to } });
        }
        /**
         * ⛔⛔ AND THE ENEMY-ROOM REFUSAL APPLIES HERE TOO, for the SAME
         * reason it applies to a block: `death()` runs
         * `solids.push("Enemy", "Player")`, so a corpse is the second mover
         * in the game that collides with enemies, and the model does not
         * simulate a single wandering enemy's POSITION. "The corpse glides
         * two tiles" is a prediction it is not entitled to make in a room
         * with a live bob in it. The escape hatch is the same declaration
         * with evidence, not a flag.
         *
         * ⚠ THE TURRET'S OWN CORPSE DOES NOT COUNT. It is in the census as
         * an enemy and it is the thing being pushed; the question is what
         * ELSE is alive.
         */
        // ⛔⛔ AN ABSENT CENSUS IS A REFUSAL, NOT A PASS — the `moves` arm's
        // own lesson, on the one question this check exists to ask.
        // [[feedback_silent_watcher_vacuous_negative]].
        if (!fire.enemyRoom && !run.world?.combat) {
            fail(`${what}: the run's world for level ${run.level} has NO COMBAT CENSUS, so `
                + "whether an enemy can wedge this corpse's glide cannot be asked. The "
                + '`combat` role is opt-in; build the world with it, or declare '
                + '`fire.enemyRoom: "<what the GAME said>"`. An absent census is not an '
                + 'empty one.');
        }
        const others = (run.world.combat?.enemies ?? []).filter(
            (e) => !e.removed && !live.some((m) => m.id === `${e.tag}@${e.x},${e.y}`));
        if (others.length > 0 && !fire.enemyRoom) {
            fail(`${what}: level ${run.level} holds ${others.length} other enemy/enemies `
                + `[${[...new Set(others.map((e) => e.tag))].join(', ')}] and a CORPSE `
                + 'collides with "Enemy" (`death()` runs `solids.push("Enemy","Player")`), '
                + 'so its glide corridor cannot be certified by a model that does not '
                + 'simulate their positions. Declare `fire.enemyRoom: "<why>"` — the same '
                + 'declaration-with-evidence a `moves` press in an enemy room needs, and '
                + 'the evidence is a recording.');
        }
        /**
         * ⛔⛔ THE POSITIVE CONTROL IS "IT IS DEAD", AND IT IS THE ONE THAT
         * MATTERS — SO IT IS CHECKED LAST, after every refusal that is a
         * property of the PLAN. `IceTurret.bump` is gated on the "dead"
         * anim and `knockback` is an EMPTY override, so a press at a LIVE
         * turret is a silent no-op in both directions: the effect check
         * below would report the body unmoved and read as a geometry
         * mistake on a leg whose geometry was perfect.
         * [[feedback_failure_detail_describes_the_pass]], pre-empted.
         *
         * ⛔⛔⛔ AND IT IS THE SLICE'S OWN BLOCKER, NAMED WHERE IT BITES. No
         * enemy in this model is killable by any weapon:
         * `PRESS_ARM_POLICY.Enemy` is `refused` ("a death moves
         * totalEnemies(), which opens tSet == -1 locks") and the four
         * modelled sword/spear arms are Tile, PushableBlockSpear,
         * BreakableRock and LightPole. The corpse is built, the bump is
         * driven, and the KILL is an enemy damage model nobody has written.
         */
        for (const m of live) {
            const now = run.turrets.get(m.id);
            if (!now.dead) {
                fail(`${what}: ${m.id} is ALIVE. \`IceTurret.bump\` is gated on the "dead" `
                    + 'anim and `knockback` is an empty override, so a live turret is '
                    + 'undisplaceable by anything — the press would land, the five '
                    + 'dispatches would run and NOTHING would move. Kill it first: '
                    + `${ICE_TURRET.hitsMax} hits, and NOT with fire (\`Enemy.hit\`'s `
                    + '`if (hitByFire || t != "Fire")` sends a fire hit to the empty '
                    + '`knockback`). ⛔ NO WEAPON IN THIS MODEL KILLS ANYTHING YET — '
                    + '`PRESS_ARM_POLICY.Enemy` is `refused`, so the kill is the next '
                    + 'thing that has to be built.');
            }
            if (now.removed) {
                fail(`${what}: ${m.id} is GONE — it reached water, lava or a pit and `
                    + '`Enemy.death()` ran for real. There is no body to push.');
            }
        }
        expect = {
            kind: 'bumps',
            live,
            // ⛓ The whole roster's positions BEFORE the press — the strays
            // check's other half, and a snapshot rather than a reference
            // because `run.turrets` is rebuilt every query.
            beforeTurrets: new Map([...(run.turrets ?? new Map())]
                .map(([id, t]) => [id, { x: t.x, y: t.y }])),
        };
    } else if (burns) {
        /**
         * ── ⛓⛓⛓ THE BURN ARM (R5 slice 14) ───────────────────────────
         *
         * The THIRD shape of a fire press, and the first whose effect is
         * neither immediate nor local to the pressed thing. §27.10 called
         * for it: `moves` demands a non-empty list of block displacements
         * and a burn displaces NOTHING, so a tree pressed through the
         * `moves` arm would fail its own shape check before the press.
         *
         * ── ⛔ WHY THE TREE IS NAMED BY ITS OEL (x, y) ────────────────
         *
         * §27.10 sketched `burns: [{tx, ty}]`. It is `{x, y}` instead, and
         * the reason is the id: a `BurnableTree`'s is `burnabletree@x,y`,
         * exactly as a rope's is `rope@x,y` and a chest's is `chest@x,y`,
         * and the sprite is a 32x32 `centerOO()` — so it covers FOUR tiles
         * and four different `{tx, ty}` would name the same tree. `moves`
         * is keyed on tiles because a block MOVES and its id is a spawn
         * cell it has left; nothing here moves. One spelling, no aliasing.
         *
         * ── ⛓ THE CHECK IS TWO-SIDED IN TIME, NOT JUST IN SET ────────
         *
         * `rope` and `moves` both ask "did the named thing change and
         * nothing else". This one asks that AND a question neither of them
         * has: **was it still solid immediately after the press?**
         * `hit()`'s whole body is `playSound; burn = true; play("burn")`
         * — it removes nothing — and the 2x2 opens 41 ticks later when
         * `burnEnd -> die()` fires. A model that opened the cell on the
         * press tick would pass a set-valued effect check and plan a step
         * the game refuses, which is the `FallRock` mistake mirrored: that
         * one writes its flag EARLY and this one removes its solid LATE.
         */
        if (!Array.isArray(burns) || burns.length === 0) {
            fail(`${what}: fire.burns must be a non-empty array of {x, y} — the OEL `
                + 'coordinates of the BurnableTrees this press should set alight.');
        }
        const roster = run.world.burnableTrees ?? [];
        const live = [];
        for (const b of burns) {
            if (!b || !Number.isFinite(b.x) || !Number.isFinite(b.y)) {
                fail(`${what}: fire.burns[] must be {x, y} finite numbers, got `
                    + `${JSON.stringify(b)}`);
            }
            const tree = roster.find((t) => t.x === b.x && t.y === b.y);
            if (!tree) {
                fail(`${what}: level ${run.level} has no burnable tree at (${b.x},${b.y}); `
                    + `its roster is [${roster.map((t) => t.id).join(' ') || 'none'}]. `
                    + '⚠ A tree whose tag this run has ALREADY cleared is not in the '
                    + 'roster at all rather than present-and-burned: `check()` is '
                    + '`if (tag >= 0 && !Game.checkPersistence(tag)) die()`, so the next '
                    + '`new Game` builds the room without it. An absent tree and a '
                    + 'mistyped coordinate are different bugs and this does not guess.');
            }
            if ((run.burnedTrees ?? new Set()).has(tree.id)
                || run.treeBurns.some((t) => t.id === tree.id)) {
                fail(`${what}: ${tree.id} is ALREADY BURNING or BURNED before the press, so `
                    + 'setting it alight proves nothing. `hit()`\'s body is behind '
                    + '`if (t == "Fire" && !burn)`, so a second press on a burning tree '
                    + 'is a real no-op — not a restart and not a second write.');
            }
            /**
             * ⛔ THE POSITIVE CONTROL, AT THE TREE'S OWN CENTRE. A burn
             * whose cell was already walkable is a burn that opened
             * nothing, and the whole reason link 2 of `L40_CHAIN` exists is
             * that the tree IS the wall.
             */
            const cx = tree.rect.x + (tree.rect.right - tree.rect.x) / 2;
            const cy = tree.rect.y + (tree.rect.bottom - tree.rect.y) / 2;
            const before = plannerObstacleAt(run.world, cx, cy, null, burnProbeOpts(run));
            if (before === null) {
                fail(`${what}: the cell under ${tree.id} — (${cx},${cy}) — is ALREADY CLEAR `
                    + 'before the press, so "the burn opened the passage" would be a claim '
                    + 'about a cell that was never blocked.');
            }
            live.push({ id: tree.id, tag: tree.tag, x: tree.x, y: tree.y, cx, cy });
        }
        /**
         * ⛔⛔ AND A PUSHABLE INSIDE THE RECT IS A REFUSAL, NOT A STRAY.
         *
         * `Player.fire()` has no aim: every responder in the 32x32 rect is
         * dispatched, so a block sharing it is pushed exactly as hard as
         * the tree is lit. The `moves` arm refuses an unmodelled-enemy room
         * because it cannot certify a GLIDE; this arm has no glide to
         * certify and would rather not acquire one — so it asks the
         * geometric question instead of the census one, and gets an answer
         * that does not depend on what is modelled.
         */
        const rect = fireRect(run.state.x, run.state.y);
        const inRect = [...(run.pushables ?? new Map()).entries()]
            .filter(([, b]) => !b.removed && rectsOverlap(rect, b.rect))
            .map(([id]) => id);
        if (inRect.length > 0) {
            fail(`${what}: the 32x32 fire rect at (${run.state.x},${run.state.y}) also `
                + `contains pushable [${inRect.join(', ')}]. A burn press has no aim, so `
                + 'that block is shoved `atan2` away from the stance while the tree '
                + 'burns — and this arm certifies no glide corridor. Move the stance, or '
                + 'press the block through `fire.moves` and name where it goes.');
        }
        expect = { kind: 'burns', live };
    } else {
        if (!Array.isArray(moves) || moves.length === 0) {
            fail(`${what}: fire.moves must be a non-empty array of `
                + '{from: {tx, ty}, to: {tx, ty}}.');
        }
        const live = [];
        for (const m of moves) {
            for (const [k, v] of [['from', m.from], ['to', m.to]]) {
                if (!v || !Number.isInteger(v.tx) || !Number.isInteger(v.ty)) {
                    fail(`${what}: fire.moves[].${k} must be {tx, ty} integers, got `
                        + `${JSON.stringify(v)}`);
                }
            }
            // ⚠ NAMED BY WHERE IT IS, not by where it spawned. A block's id
            // is its spawn cell and never changes; a choreography's steps
            // are about the cell it is standing on NOW, and eighteen presses
            // in a row is exactly where the two diverge.
            const found = [...run.pushables.entries()].find(([, b]) => !b.removed
                && Math.floor(b.rect.x / TILE_SIZE) === m.from.tx
                && Math.floor(b.rect.y / TILE_SIZE) === m.from.ty);
            if (!found) {
                fail(`${what}: no live pushable is standing on (${m.from.tx},`
                    + `${m.from.ty}); the level's blocks are at `
                    + `[${[...run.pushables.entries()].filter(([, b]) => !b.removed)
                        .map(([id, b]) => `${id} on (${Math.floor(b.rect.x / TILE_SIZE)},`
                            + `${Math.floor(b.rect.y / TILE_SIZE)})`).join(' ') || 'none'}]`);
            }
            if (m.from.tx === m.to.tx && m.from.ty === m.to.ty) {
                fail(`${what}: a move from (${m.from.tx},${m.from.ty}) to itself proves `
                    + 'nothing.');
            }
            live.push({ id: found[0], from: m.from, to: m.to });
        }
        // ⛔ EVERY block's position BEFORE the press, not just the named
        // ones — the other half of the exact-set check below.
        const before = new Map([...run.pushables.entries()]
            .filter(([, b]) => !b.removed)
            .map(([id, b]) => [id, {
                tx: Math.floor(b.rect.x / TILE_SIZE),
                ty: Math.floor(b.rect.y / TILE_SIZE),
            }]));
        expect = { kind: 'blocks', live, before };
    }

    /**
     * ⛓⛓⛓ R5 SLICE 13 — THE THREAD. The press WAITS for the corridor.
     *
     * §25.3 left the shaft with two ways forward and only one of them keeps
     * the certified ledger: KILL L39's three spinners and write
     * {39,3}/{39,4}/{39,6}, or TIME the presses so no spinner is ever in a
     * block's way. The second is what `SHAFT_LEDGER`'s nine writes mean, and
     * it is only possible because the billiard is player-independent — so
     * "when is this corridor clear" is a question with an answer, computed
     * rather than searched for by re-recording.
     *
     * ── WHAT IS KEPT CLEAR ────────────────────────────────────────────
     *
     * The CORRIDOR is the union of each declared move's from-cell and
     * to-cell, which is exactly the block's swept rect: it starts on the
     * first and ends on the second and is a 16x16 box in between. And the
     * SPAN is `[press + firstHitTick, press + lastHitTick + TICKS_PER_TILE]`
     * — the block cannot move before a hit lands and takes 32 ticks to
     * cross once one does.
     *
     * ⚠ A CONSERVATIVE UNION ON PURPOSE. A spinner that clips the corner of
     * the destination cell on the last tick of the glide costs one refused
     * press; one that clips it and is not modelled here costs the whole
     * ledger, which is what §24.8 spent.
     *
     * ── ⚠ AND THE FORECAST IS NOT THE ORACLE ─────────────────────────
     *
     * `run.spinnerForecast` holds the other blocks still, so it can be a
     * tick of geometry out. The exact-set effect check below is what
     * DECIDES, and it drives the real models — so a bad thread costs a named
     * failure and never a green tape. That asymmetry is why this is allowed
     * to be a heuristic at all.
     */
    let threadedBy = 0;
    if (moves && fire.thread) {
        if (typeof fire.thread !== 'string' || fire.thread.length === 0) {
            fail(`${what}: fire.thread must be a SENTENCE saying what is being threaded `
                + 'around and why timing is the answer rather than clearing the room. A '
                + 'boolean would let the next plan turn this on without saying which '
                + 'mechanic it is dodging.');
        }
        const corridor = expect.live.map((m) => {
            const x = Math.min(m.from.tx, m.to.tx) * TILE_SIZE;
            const y = Math.min(m.from.ty, m.to.ty) * TILE_SIZE;
            const w = (Math.abs(m.to.tx - m.from.tx) + 1) * TILE_SIZE;
            const h = (Math.abs(m.to.ty - m.from.ty) + 1) * TILE_SIZE;
            return { x, y, w, h, right: x + w, bottom: y + h };
        });
        const span = FIRE_WINDOW.lastHitTick + PUSH_GLIDE_TICKS;
        const horizon = (fire.threadMaxWait ?? THREAD_MAX_WAIT) + span + 1;
        const forecast = run.spinnerForecast(horizon);
        const blockedAt = (i) => forecast[i]
            ?.some((s) => corridor.some((c) => rectsOverlap(s, c))) ?? false;
        let delay = null;
        for (let d = 0; d <= (fire.threadMaxWait ?? THREAD_MAX_WAIT); d += 1) {
            let clear = true;
            for (let i = d + FIRE_WINDOW.firstHitTick; i <= d + span && clear; i += 1) {
                if (blockedAt(i)) clear = false;
            }
            if (clear) { delay = d; break; }
        }
        if (delay === null) {
            fail(`${what}: no clear window for the glide corridor `
                + `[${corridor.map((c) => `(${c.x},${c.y})+${c.w}x${c.h}`).join(' ')}] in the `
                + `next ${fire.threadMaxWait ?? THREAD_MAX_WAIT} tick(s). The declared `
                + `thread is "${fire.thread}". A corridor that is never clear is not a `
                + 'timing problem — clear the room with the encounter ladder, or move the '
                + 'stance.');
        }
        // ⚠ IDLE, NOT HELD. A held key would move the player off the stance
        // the rect is centred on, and `runFire` has already refused a moving
        // one two checks above.
        for (let i = 0; i < delay; i += 1) {
            perTick.push(NO_HELD);
            const { transition } = run.advance(NO_HELD);
            if (transition) {
                fail(`${what}: thread tick ${i + 1} of ${delay} crossed from level `
                    + `${transition.from_level} to ${transition.to_level}.`);
            }
        }
        threadedBy = delay;
    }

    // ── the press: ONE tick of `primary` ──────────────────────────────
    // The hit ticks are T+4..T+8 and `useItem`'s `if (!firing)` swallows a
    // press inside an open window, so the span is one tick and the run's
    // own cadence guard is what refuses a second one too early.
    // ⛓ R5 SLICE 22: a press on a frozen tick is LOST — see
    // `holdUntilUnfrozen`. Held before `pressTick` is read, so the tick the
    // schedule reports is the tick the press actually landed on.
    holdUntilUnfrozen(run, perTick, what);
    const pressTick = perTick.length;
    const PRESS = new Set(['primary']);
    perTick.push(PRESS);
    const pressed = run.advance(PRESS);
    if (pressed.transition) {
        fail(`${what}: the press tick crossed from level ${pressed.transition.from_level} `
            + `to ${pressed.transition.to_level}.`);
    }

    // ── the wait: the window, then the glide (or the animation) ───────
    /**
     * ⛔ A BURN'S WAIT IS NOT A GLIDE'S. `PUSH_GLIDE_TICKS` is 40 and
     * `burnableTree.WAIT_AFTER_PRESS_TICKS` is 53 — the 41-tick animation
     * plus the press window plus the ±1 the graphic-update order leaves
     * unknowable — so defaulting a burn to the glide number would end the
     * leg with the tree still standing on twelve of the ticks that matter.
     * `assertBurnWaitCovers` is the module's own statement of the same
     * obligation and the plan side calls it; this is the driver's floor.
     */
    const DEFAULT_WAIT = {
        burns: BURN_WAIT_AFTER_PRESS_TICKS,
        bumps: ICE_TURRET_PLAN.waitAfterPressTicks,
    };
    const ticks = wait ?? (DEFAULT_WAIT[expect.kind] ?? PUSH_GLIDE_TICKS);
    /**
     * ⛓ A BUMP'S WAIT IS NOT A BLOCK'S EITHER, and the coincidence is worth
     * naming: a block's glide is 32 ticks from the press and a corpse's is
     * 32 ticks from the END of the five-bump window, so the corpse settles
     * at T+38 (parity 0) or T+37 (parity 1) against `PUSH_GLIDE_TICKS`'s 40.
     * It fits, by two ticks, for reasons that have nothing to do with each
     * other — so the floor is `ICE_TURRET_PLAN.waitAfterPressTicks` and not
     * the block's constant.
     */
    if (expect.kind === 'bumps' && ticks < ICE_TURRET_PLAN.waitAfterPressTicks) {
        fail(`${what}: fire.wait is ${ticks} and a corpse takes `
            + `${ICE_TURRET_PLAN.settledBy.parity0} ticks to settle from the press `
            + `(32 ticks of 0.5 px motion, starting from the LAST of the five bumps at `
            + `T+${FIRE_WINDOW.lastHitTick}) — wait at least `
            + `${ICE_TURRET_PLAN.waitAfterPressTicks}.`);
    }
    if (expect.kind === 'burns' && ticks < BURN_WAIT_AFTER_PRESS_TICKS) {
        fail(`${what}: fire.wait is ${ticks} and a burn is SOLID for `
            + `${BURN_HIT_TO_GONE_TICKS} ticks after the press — `
            + `wait at least ${BURN_WAIT_AFTER_PRESS_TICKS}. \`hit()\` removes nothing; `
            + '`burnEnd -> die()` does, twenty animation frames later at 15 * 0.0333 = '
            + '0.4995 per update.');
    }
    let stillSolidAt = null;
    let glidingAt = null;
    for (let i = 1; i <= ticks; i++) {
        perTick.push(NO_HELD);
        const { transition } = run.advance(NO_HELD);
        if (transition) {
            fail(`${what}: wait tick ${i} of ${ticks} crossed from level `
                + `${transition.from_level} to ${transition.to_level}.`);
        }
        /**
         * ⛓⛓ THE FIRST HALF OF THE TWO-SIDED CLAIM, TAKEN WHILE IT IS
         * TRUE. The window has fired (`lastHitTick` is 8) and the animation
         * has 30-odd ticks to run, so every named tree must STILL be a
         * solid here. Asserted in the middle of the leg rather than derived
         * afterwards, because "it was solid at T+10" is not recoverable
         * from a run that only reports the end state.
         */
        if (expect.kind === 'burns' && i === FIRE_WINDOW.endTick) {
            const walkable = expect.live.filter(
                (t) => plannerObstacleAt(run.world, t.cx, t.cy, null, burnProbeOpts(run)) === null);
            if (walkable.length > 0) {
                fail(`${what}: ${walkable.map((t) => t.id).join(', ')} stopped being solid `
                    + `${i} tick(s) after the press, and the game keeps a burning tree `
                    + `standing for ${BURN_HIT_TO_GONE_TICKS}. \`BurnableTree.hit()\` is `
                    + '`playSound; burn = true; play("burn")` and removes NOTHING — so a '
                    + 'model that opens the cell here is a model whose legs walk into '
                    + 'walls the game has not taken down yet.');
            }
            stillSolidAt = i;
        }
        /**
         * ⛓⛓ THE BUMP ARM'S OWN MID-LEG READING, and it is the burn's
         * shape with the sign flipped: a burning tree must STILL BE THERE
         * at T+10 and a bumped corpse must ALREADY BE MOVING and NOT YET
         * ARRIVED. Both are facts about the middle of the leg that the end
         * state cannot recover — a model that teleported the body to its
         * target on the press tick would pass every end-state check.
         */
        if (expect.kind === 'bumps' && i === FIRE_WINDOW.endTick) {
            for (const m of expect.live) {
                const now = run.turrets.get(m.id);
                const at = { tx: Math.floor(now.x / TILE_SIZE), ty: Math.floor(now.y / TILE_SIZE) };
                if (at.tx === m.to.tx && at.ty === m.to.ty) {
                    fail(`${what}: ${m.id} was already on (${m.to.tx},${m.to.ty}) `
                        + `${i} tick(s) after the press. A corpse glides at `
                        + `${ICE_TURRET.moveSpeed} px/tick and a tile is ${TILE_SIZE} px, `
                        + 'so arriving inside the press window is a model that moved it '
                        + 'instantly rather than one that pushed it.');
                }
                if (run.turretsSettled) {
                    fail(`${what}: ${m.id} reports SETTLED ${i} tick(s) after the press, `
                        + 'i.e. it never started moving. The five bumps ran and the body '
                        + 'is where it was — check the stance is inside the 32x32 fire '
                        + 'rect and the 16 px radius cut.');
                }
            }
            glidingAt = i;
        }
        // ⚠ NOT BEFORE THE WINDOW HAS FIRED. `run.pushesSettled` is true
        // for the first four ticks too — the hits have not landed yet — so
        // an early break would report a press that never dispatched as a
        // push that settled instantly.
        if (expect.kind === 'blocks' && i > FIRE_WINDOW.lastHitTick && run.pushesSettled) break;
    }

    // ── the effect ────────────────────────────────────────────────────
    if (expect.kind === 'rope') {
        if (!run.pulledRopes.has(expect.id)) {
            fail(`${what}: fired at (${at.x},${at.y}) and ${expect.id} is STILL its full `
                + `span after ${ticks} tick(s). The 32x32 rect has to CONTAIN the rope `
                + 'and the 16 px radius cut has to admit it — and a rope is a wide, '
                + 'shallow box, so a stance too far along the span is outside the rect '
                + 'even though it looks adjacent on the map.');
        }
    } else if (expect.kind === 'burns') {
        // ── ⛓⛓ THE SECOND HALF: GONE, AND ONLY THE NAMED ONES ────────
        const burnedNow = run.burnedTrees ?? new Set();
        for (const t of expect.live) {
            if (!burnedNow.has(t.id)) {
                fail(`${what}: fired at (${at.x},${at.y}) and ${t.id} is STILL STANDING `
                    + `after ${ticks} tick(s). The 32x32 rect has to CONTAIN the tree's `
                    + `own 32x32 box and the ${'`'}fireHits${'`'} radius cut has to admit `
                    + 'it — and `hit(t)` is gated on `t == "Fire"`, so a press with any '
                    + 'other weapon selected reaches it and does nothing.');
            }
            const after = plannerObstacleAt(run.world, t.cx, t.cy, null, burnProbeOpts(run));
            if (after !== null) {
                fail(`${what}: ${t.id} reports burned and its cell (${t.cx},${t.cy}) is `
                    + `STILL BLOCKED by ${after.kind}. \`die()\` writes \`type = ""\` AND `
                    + '`FP.world.remove(this)`, so the 2x2 leaves the solids list '
                    + 'entirely — which means something else shares the cell.');
            }
        }
        // ⛔ THE OTHER HALF, the rule this whole verb family runs on: no
        // tree the leg did not name may have burned. A fire press has no
        // aim and a 32x32 rect covers a 2x2 tree with room to spare, so two
        // adjacent trees are one press — and the ledger would carry a write
        // the plan never predicted.
        const namedIds = new Set(expect.live.map((t) => t.id));
        const strays = [...burnedNow].filter((id) => !namedIds.has(id));
        const strayStarts = run.treeBurns.filter((b) => !namedIds.has(b.id));
        if (strays.length > 0 || strayStarts.length > 0) {
            fail(`${what}: the press at (${at.x},${at.y}) ALSO set alight `
                + `[${[...new Set([...strays, ...strayStarts.map((b) => b.id)])].join(', ')}], `
                + 'which the leg does not name. Every burn is a persistence write '
                + '(`removed()` -> `Game.setPersistence(tag, false)`), so an unnamed one '
                + 'is a ledger entry the plan cannot account for and a room a later '
                + 'window boots differently.');
        }
        if (stillSolidAt === null) {
            fail(`${what}: the leg never took the STILL-SOLID reading — the wait ended `
                + `before tick ${FIRE_WINDOW.endTick}. That reading is half the claim; `
                + 'without it "the tree burned" is compatible with a model that removed '
                + 'it on the press tick.');
        }
    } else if (expect.kind === 'bumps') {
        // ── ⛓⛓ THE EFFECT: THE NAMED TILE, AND NOTHING ELSE MOVED ────
        if (!run.turretsSettled) {
            fail(`${what}: a corpse is STILL GLIDING after ${ticks} tick(s). A route `
                + 'flooded against a moving body is a route planned against a wall that '
                + 'is not there yet — wait for `run.turretsSettled`.');
        }
        const at = (id) => {
            const now = run.turrets.get(id);
            return { tx: Math.floor(now.x / TILE_SIZE), ty: Math.floor(now.y / TILE_SIZE) };
        };
        for (const m of expect.live) {
            const got = at(m.id);
            if (got.tx !== m.to.tx || got.ty !== m.to.ty) {
                fail(`${what}: fired at (${at.x},${at.y}) and ${m.id} ended on `
                    + `(${got.tx},${got.ty}) rather than (${m.to.tx},${m.to.ty}). The push `
                    + 'is AWAY from the press point and it moves ONE TILE PER AXIS '
                    + `(\`bothRange ${ICE_TURRET.bothRange}\` lets both arms fire), so a `
                    + 'stance off the cardinal by more than that moves it diagonally.');
            }
            /**
             * ⛔⛔ AND THE SOLID LATCH IS THE OTHER HALF, because a corpse
             * that is not a Solid presses no button. `type = "Solid"` is set
             * only on a tick the player's box is OFF the body, and nothing
             * ever writes it back — so this is a claim about the WALK as
             * much as about the push.
             */
            if (!run.turrets.get(m.id).solid) {
                fail(`${what}: ${m.id} is on (${got.tx},${got.ty}) and is NOT a Solid. `
                    + '`IceTurret.update`\'s `else if (!collide("Player", x, y)) type = '
                    + '"Solid"` needs one tick with the player off the body, and a corpse '
                    + 'that is not Solid presses nothing and blocks nothing. Step OFF it.');
            }
        }
        // ⛔ A fire press has no aim and there is no second turret in the
        // game within a 32x32 rect of the first — but the rule is the
        // family's, not the level's, and a silence here is what the `moves`
        // arm's strays check exists to stop.
        const namedIds = new Set(expect.live.map((m) => m.id));
        const strays = [];
        for (const [id, before] of expect.beforeTurrets) {
            if (namedIds.has(id)) continue;
            const now = run.turrets.get(id);
            if (!now || now.x !== before.x || now.y !== before.y) strays.push(id);
        }
        if (strays.length > 0) {
            fail(`${what}: the press at (${at.x},${at.y}) ALSO moved `
                + `[${strays.join(', ')}], which the leg does not name.`);
        }
        if (glidingAt === null) {
            fail(`${what}: the leg never took the STILL-GLIDING reading — the wait ended `
                + `before tick ${FIRE_WINDOW.endTick}. Without it "the corpse ended on the `
                + 'tile" is compatible with a model that teleported it on the press tick.');
        }
    } else {
        const got = [];
        for (const [id, b] of run.pushables) {
            if (b.removed) continue;
            got.push({
                id,
                tx: Math.floor(b.rect.x / TILE_SIZE),
                ty: Math.floor(b.rect.y / TILE_SIZE),
            });
        }
        const wantKey = expect.live
            .map((m) => `${m.id}->${m.to.tx},${m.to.ty}`).sort().join(' ');
        const gotKey = expect.live
            .map((m) => {
                const now = got.find((g) => g.id === m.id);
                return `${m.id}->${now ? `${now.tx},${now.ty}` : 'GONE'}`;
            }).sort().join(' ');
        if (wantKey !== gotKey) {
            fail(`${what}: fired at (${at.x},${at.y}) and the declared blocks ended at `
                + `[${gotKey}] rather than [${wantKey}].`);
        }
        // ⛔⛔ AND THE OTHER HALF, which is the whole reason this verb
        // exists: NOTHING THE LEG DID NOT NAME MAY HAVE MOVED. A fire press
        // has no aim, so a block the author did not think about is pushed
        // exactly as hard as the one they did — and §19.8's eighteen-press
        // choreography failed on precisely that, twice, while every one of
        // its presses "worked".
        const namedIds = new Set(expect.live.map((m) => m.id));
        const strays = got.filter((g) => {
            if (namedIds.has(g.id)) return false;
            const was = expect.before.get(g.id);
            return !was || was.tx !== g.tx || was.ty !== g.ty;
        });
        const vanished = [...expect.before.keys()]
            .filter((id) => !namedIds.has(id) && !got.some((g) => g.id === id));
        if (strays.length > 0 || vanished.length > 0) {
            fail(`${what}: the press at (${at.x},${at.y}) ALSO moved `
                + `[${strays.map((g) => `${g.id} to (${g.tx},${g.ty})`).join(', ')}`
                + `${vanished.length ? ` and DESTROYED [${vanished.join(', ')}]` : ''}], `
                + 'which the leg does not name. `Player.fire()` has no aim — the rect is '
                + '32x32 around the player and `genericHit` runs on everything inside '
                + 'it, each pushed `atan2` away from the stance. Either name the move or '
                + 'choose a stance the other block is outside of.');
        }
    }
    return {
        kind: expect.kind, pressTick, at,
        // ⛓ R5 slice 13: how many idle ticks the thread cost. Reported so a
        // plan can price the wait — a schedule whose every press waits 200
        // ticks is a schedule, and one whose presses all wait 0 is a
        // declaration that never did anything.
        threadedBy,
        ...(expect.kind === 'rope' ? { id: expect.id } : {}),
        ...(expect.kind === 'blocks' ? { moves: expect.live.map((m) => ({ ...m })) } : {}),
        ...(expect.kind === 'bumps' ? {
            bumps: expect.live.map((m) => ({ ...m, to: { ...m.to }, from: { ...m.from } })),
            // ⛓ The mid-leg reading, reported so a plan can see that the
            // two-sided claim was actually taken rather than skipped.
            glidingAt,
        } : {}),
        ...(expect.kind === 'burns' ? {
            burns: expect.live.map((t) => {
                // ⛓ THE TIMESTAMPS, REPORTED SEPARATELY, because a SET has
                // no timestamps and the whole finding here is a gap of 41
                // ticks between the two. `t` is the press and `goneAt` is
                // `removed()`, which is where `Game.setPersistence` lives.
                const rec = run.treeBurns.find((b) => b.id === t.id);
                return {
                    id: t.id,
                    tag: t.tag,
                    firedAt: rec?.t ?? null,
                    goneAt: rec?.goneAt ?? null,
                    flag: rec ? { ...rec.flag } : null,
                };
            }),
            stillSolidAt,
        } : {}),
    };
}

/**
 * ── ⛔⛔ ONE OPTIONS BUILDER FOR EVERY MID-LEG GEOMETRY PROBE ─────────
 *
 * A verb that asks "is this cell blocked" DURING a leg has to ask it of the
 * world the run is actually in — every per-visit family, live. Three call
 * sites had hand-written literals and each was missing a different subset:
 *
 * ```
 *   runFire's burn probes    (new)      needed `burnedTrees`
 *   runChest's join probes              no `burnedTrees`
 *   runSpear's face nudge               no `brokenRocks`, no `pulledRopes`,
 *                                       no `openChests`, no `burnedTrees`
 * ```
 *
 * ⛔ AND THE LAST ONE COST A LEG. L40's second rock swing stands in the
 * cell the FIRST swing emptied, and the nudge probe reported *"solid
 * breakablerock at (176,144)"* — a wall the run had watched shatter. The
 * before / still-solid / after readings of a two-sided claim are only a
 * claim if they ask the SAME question, and so is a nudge against a stance.
 *
 * ⚠ The probe-specific bits (`noHazards`, `inventory`) stay per call: a
 * face nudge is a POSITION the player will occupy and must respect the
 * terrain policy, where a join probe is a question about a cell's solidity
 * and must not.
 */
export function livePerVisitOpts(run) {
    return {
        openActivators: run.openActivators,
        openChests: run.openChests,
        pushables: run.pushables,
        openBridges: run.openBridges,
        brokenRocks: run.brokenRocks,
        pulledRopes: run.pulledRopes,
        burnedTrees: run.burnedTrees,
        // ⛓⛓⛓ R5 slice 15: the NINTH, and the only SNAPSHOT in the list.
        crushers: run.crushers,
        // ⛓⛓⛓ R5 slice 20: the TENTH, and the only one whose absence means
        // "not a solid" rather than "still where the level built it".
        turrets: run.turrets,
        // ⛓⛓⛓ R5 slice 23: the TWELFTH, and the only one whose absence
        // means "still a solid" — an unwoken BossTotem is a Solid, so the
        // key expresses the WAKE rather than the wall.
        bosses: run.bosses,
    };
}
function liveGeometryOpts(run, extra = {}) {
    return { ...livePerVisitOpts(run), avoidVolumes: false, ...extra };
}
const burnProbeOpts = (run) => liveGeometryOpts(run);

/** Shape-check a `chest` before anything is planned or driven with it. */
export function assertChest(chest, what) {
    if (chest === null || typeof chest !== 'object' || Array.isArray(chest)) {
        fail(`${what}: chest must be { chest: {x, y} }`);
    }
    const c = chest.chest;
    if (!c || !Number.isFinite(c.x) || !Number.isFinite(c.y)) {
        fail(`${what}: chest.chest must be the chest's OEL {x, y}`);
    }
}

/** The `Chest` a chest leg NAMES, by OEL coordinates. */
export function resolveChest(world, named, what) {
    const chest = (world.chests ?? []).find((c) => c.x === named.x && c.y === named.y);
    if (!chest) {
        fail(`${what}: level ${world.level} has no chest at (${named.x},${named.y}); `
            + `it has [${(world.chests ?? []).map((c) => c.id).join(' ') || 'none'}].`);
    }
    return chest;
}

/**
 * ── ⛔⛔ THE CHEST PRIMITIVE (R5 slice 9) ─────────────────────────────
 *
 * The EIGHTH leg verb, and the fourth way a thing in the world opens. It
 * is closest to `keylock` — a graze stance, an automatic trigger, a fade —
 * and differs from it in the three places that matter:
 *
 *  1. ⛔ **THERE IS NO FLAG AND NO GROUP.** `Chest.open()` writes
 *     `type = ""` on the entity. `run.openActivators` cannot see it and
 *     `run.openChests` is where it lives.
 *  2. ⛔ **THE GATE IS NOT THE PLAYER'S.** `!collide("Solid", x, y)` is the
 *     CHEST colliding, and in L38 the thing it collides with is the cover.
 *     So the leg has a prerequisite the stance cannot express, and it says
 *     so by name rather than standing there failing.
 *  3. ⛔⛔ **OPENING IT SPAWNS A PICKUP ON TOP OF THE PLAYER.** The
 *     `SealPiece` lands at the chest's own position and comes down to
 *     them; the ceremony behind it is 331 dead frames the stream cannot
 *     see. The leg waits for the collection rather than assuming it, and
 *     then waits out the 60-tick fade so the cell is genuinely clear when
 *     the next target plans through it.
 *
 * ⛓ THE EFFECT CHECK IS AN EXACT SET, both ways — `runFire`'s rule, one
 * verb later:
 *
 *     the tag write     `run.earnedClears` gains exactly this chest's flag
 *     the type flip     `run.openChests` gains exactly this chest's id
 *     the cell          `plannerObstacleAt` at the join is null AFTER and
 *                       was NOT null before
 *
 * A leg that opened a chest the plan did not name, or left a cell the plan
 * expected open still solid, is a named failure.
 */
function runChest(run, perTick, chest, maxTicks, what, before = null) {
    if (run.openChests === null) {
        fail(`${what}: a chest is a MECHANIC, and the noclip arm does not run it — `
            + '`advance` skips the chest step entirely, so the leg would emit its '
            + 'ticks, verify nothing and report success on a wall it never opened.');
    }
    const target = resolveChest(run.world, chest.chest, what);
    // ── the POSITIVE CONTROL, from BEFORE THE APPROACH ────────────────
    // ⛔ The trigger is a line the approach crosses, so "shut when the verb
    // began" is a state a correct leg is never in. See the `before`
    // snapshot at the call site — the same correction a latching
    // `ButtonRoom` forced on `runHold`, one verb later and for a different
    // mechanism.
    const chestsBefore = before?.chests ?? run.openChests;
    if (chestsBefore.has(target.id)) {
        fail(`${what}: ${target.id} is ALREADY OPEN before the target, so opening it `
            + 'proves nothing. A chest whose flag was cleared on an earlier visit is '
            + 'DESPAWNED by `check()` rather than open, so this means an earlier leg '
            + 'of this visit already opened it.');
    }
    const joinBefore = plannerObstacleAt(run.world, target.x + 8, target.y + 8, null,
        liveGeometryOpts(run, { openChests: chestsBefore }));
    if (joinBefore === null) {
        fail(`${what}: the cell under ${target.id} is ALREADY CLEAR before the leg, so `
            + '"the chest opened the passage" is a claim about a cell that was never '
            + 'blocked. The whole point of this verb is that the chest IS the wall.');
    }
    // ── the STANCE, asked of the same derivation the run uses ─────────
    const band = chestStanceBand(target.x, target.y, HITBOX);
    if (!band.includes(Math.round(run.state.y)) || Math.abs(run.state.y - Math.round(run.state.y)) > 0) {
        // ⚠ The band is INTEGER rows because `World.collideLine` probes
        // integer points, and the player's `y` is a float. The real test is
        // the line test itself; this one reports the band because "you are
        // 1.4 px low" is the diagnosis a plan author needs.
        const b = playerBoxAt(run.state.x, run.state.y);
        if (!keyLineTouches(b, chestProbeLine(target.x, target.y))) {
            fail(`${what}: the player is at (${run.state.x},${run.state.y}) — box `
                + `[${b.y},${b.bottom}) — and ${target.id}'s probe row is `
                + `y=${chestProbeLine(target.x, target.y).y}. The reachable band is `
                + `y in {${band.join(', ')}} and it is TWO PIXELS: the rows below it `
                + 'miss the line and the rows above it are inside the chest, which is '
                + 'Solid until the instant this fires.');
        }
    }
    // ── the wait: the open, then the collection, then the fade ────────
    const from = perTick.length;
    let openedAt = null;
    let collectedAt = null;
    for (let i = 1; i <= maxTicks; i++) {
        perTick.push(NO_HELD);
        const { transition } = run.advance(NO_HELD);
        if (transition) {
            fail(`${what}: tick ${i} of ${target.id}'s window crossed from level `
                + `${transition.from_level} to ${transition.to_level}. A world swap `
                + 'rebuilds the Game and the chest with it.');
        }
        // ⚠ `run.chestOpens` RATHER THAN THE SET, because the approach may
        // have opened it already: the trigger is a line and the last
        // waypoint crosses it. The ledger carries the tick it really
        // happened on, which is the only honest number here.
        if (openedAt === null && run.openChests.has(target.id)) {
            openedAt = run.chestOpens.find((c) => c.id === target.id)?.t ?? i;
        }
        if (openedAt !== null && collectedAt === null
            && run.sealCollections.length > 0
            && run.sealCollections[run.sealCollections.length - 1].from === target.id) {
            collectedAt = i;
        }
        // The fade: `openTimer` runs 60 ticks after the flip and the entity
        // is removed at the end of it. Solidity went first, so the wait is
        // for the CEREMONY rather than for the fade — but the leg stands
        // through both, because a plan that walked through the cell while
        // the piece was still approaching would collect it in motion and
        // `hasArrived` needs the player STOPPED.
        if (collectedAt !== null && i >= collectedAt + CHEST.openTimerMax) break;
    }
    if (openedAt === null) {
        fail(`${what}: ${target.id} NEVER OPENED in ${maxTicks} ticks of standing on its `
            + 'line. `Chest.update`\'s gate is `!collide("Solid", x, y)` — the chest '
            + 'colliding with whatever shares its cell — so the usual cause is that '
            + 'the cover above it is still shut. The stance is not the prerequisite; '
            + 'the cover is.');
    }
    if (collectedAt === null) {
        fail(`${what}: ${target.id} opened at tick ${openedAt} but its SealPiece was `
            + `never collected in ${maxTicks} ticks. \`Chest.open()\` spawns one `
            + 'unconditionally at the chest\'s own position and `Pickup`\'s attraction '
            + 'brings it to a stationary player in nine ticks — so this means the '
            + 'player is more than 24 px away, which for a stance in the band is '
            + 'impossible.');
    }
    // ── ⛓ THE EFFECT, AS AN EXACT SET ────────────────────────────────
    const opened = [...run.openChests];
    if (opened.length !== 1 || opened[0] !== target.id) {
        fail(`${what}: the leg opened [${opened.join(' ')}] and named only ${target.id}. `
            + 'A chest the leg did not name is a wall somewhere else that the plan '
            + 'still believes is standing.');
    }
    const write = run.chestOpens.find((c) => c.id === target.id);
    if (!write || write.persistTag !== target.persistTag) {
        fail(`${what}: ${target.id} opened but the run's chestOpens ledger names `
            + `${write ? `tag ${write.persistTag}` : 'nothing'}, against the census's `
            + `tag ${target.persistTag} — the two halves disagree about which flag `
            + '`open()` cleared.');
    }
    const joinAfter = plannerObstacleAt(run.world, target.x + 8, target.y + 8, null,
        liveGeometryOpts(run));
    if (joinAfter !== null) {
        fail(`${what}: ${target.id} reports open and its cell is STILL BLOCKED by `
            + `${joinAfter.kind}. \`type = ""\` is the passage, so this means something `
            + 'else shares the cell — in L38 that is the cover, and a cover whose '
            + 'group went quiet RESETS (`Cover.update`\'s else arm collides '
            + '["Solid","Player"] and a Chest in the cell makes it reset).');
    }
    return {
        chest: { id: target.id, x: target.x, y: target.y, persistTag: target.persistTag },
        at: { x: run.state.x, y: run.state.y },
        /** The run tick `open()` fired on — often DURING the approach. */
        openedAt,
        collectedAt: from + collectedAt,
        ticks: perTick.length - from,
        deadFrames: run.sealCollections[run.sealCollections.length - 1].deadFrames,
        band: [...band],
    };
}

function runCollect(run, perTick, collect, maxTicks, what) {
    const pickup = resolvePickup(run.world, collect.pickup, what);
    const before = run.collected.length;
    const level = run.level;

    // ── the approach ──────────────────────────────────────────────────
    // Aim at the pickup's centre and press until the ceremony takes over.
    // A pickup is not solid, so any hit on the way is the ordinary
    // planner-bug throw.
    /**
     * ⛓⛓ R5 SLICE 13 — `collect.aim`, AND IT IS A DECLARATION.
     *
     * The default is the pickup's own centre, which is right whenever the
     * stance sees the whole volume. `totempart@72,40` is the first one that
     * does not: its rect straddles a column boundary, the only free cell
     * above it is (5,1), and the line from there to the centre drifts WEST
     * into `tile:Blue Wall (dark)` at (4,1) — the approach dies four pixels
     * before it touches anything.
     *
     * ⚠ AN OVERRIDE, NOT A TOLERANCE. The approach still has to make real
     * contact with the real volume and the sweep still fails on any blocked
     * step; what this changes is WHICH POINT the walk aims at, and the leg
     * has to say why. A relaxed hit test would have made the same tape pass
     * without the player ever touching the part.
     */
    if (collect.aim !== undefined) {
        if (!Number.isFinite(collect.aim?.x) || !Number.isFinite(collect.aim?.y)
            || typeof collect.aim.why !== 'string' || collect.aim.why.length === 0) {
            fail(`${what}: collect.aim must be {x, y, why} — a point AND a sentence saying `
                + 'why the pickup\'s own centre is not on a clear line from the stance. '
                + 'The default is the centre and it is right almost always; an override '
                + 'with no reason is a tolerance wearing a coordinate.');
        }
    }
    const aim = collect.aim ?? {
        x: (pickup.rect.x + pickup.rect.right) / 2,
        y: (pickup.rect.y + pickup.rect.bottom) / 2,
    };
    const from = perTick.length;
    let approach = 0;
    // ⚠ TWO EXIT CONDITIONS, and the second one is the TEXTLESS ceremony.
    // `Pickup.pick_up()` spawns an NPC only when `text != ""`, so a boss key
    // or a totem part runs phase A — 150 invisible frozen frames — and then
    // resolves itself with no dialogue at all. On this side that whole
    // ceremony begins and ENDS inside one `advance`, so `inCeremony` is
    // never observed true and a loop waiting for it walks on top of the
    // pickup for its entire budget. (It did: 1,500 ticks standing inside
    // `bosskey@48,64`'s own volume.)
    while (!run.inCeremony && run.collected.length === before) {
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
    // A textless ceremony has already recorded itself by the time the
    // approach loop exits, so this runs zero times — which is right: there
    // is no dialogue to page and no release to send.
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
            const v = run.world.avoidVolumesAt(box, { x: s.x, y: s.y }, { keys: run.keys })
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
/**
 * ⛓⛓ R5 SLICE 13 — `relax.roles`, and it may only WIDEN.
 *
 * A plan that needs the `combat` census — which every `moves` press does
 * since §25.3, because "is there an unmodelled enemy in this room" cannot be
 * asked without one — says so here. Narrowing is refused rather than
 * honoured: a leg list that dropped `blocking` would silently get a walk
 * that consults no collider, and the resulting tape would look planned.
 */
function rolesFor(base, asked) {
    if (!asked) return base;
    if (!Array.isArray(asked) || asked.length === 0) {
        fail('synthesizeLegs: relax.roles must be a non-empty array of role names');
    }
    const missing = base.filter((r) => !asked.includes(r));
    if (missing.length > 0) {
        fail(`synthesizeLegs: relax.roles [${asked.join(', ')}] DROPS `
            + `[${missing.join(', ')}] from this plan's base roles `
            + `[${base.join(', ')}]. This option exists to WIDEN — a plan that asks for `
            + '`combat` must still consult everything a walk consulted before it, or the '
            + 'route is planned against geometry the executor will hit.');
    }
    return Object.freeze([...asked]);
}

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
            // R4: the slot `Main.primary` holds. Without it every press is a
            // SWORD slash and the bridge arm — which fires only under
            // t == "Spear" — never runs, which is a green tape that opens
            // nothing.
            equips: relax.equips ?? [],
            // R5 slice 4: the physics refuses a wet tick without the sound
            // pin, so a plan over armed water has to declare it here too —
            // and the emitted tape carries the same list, per the `relax`
            // rule that one object decides the plan AND the tape.
            pins: relax.pins ?? [],
            // A relaxed walk consults no collider, so it must not be stopped
            // by one being unpriced — that is the whole of slice 1b. A walk
            // with collision ON is the opposite: it consults EVERY role, and
            // an unpriced collider must stop it by name. R2 paid that bill
            // for the levels its walk enters.
            // ⚠ PRE_R5_ROLES, NOT "every role there is". R5 added a fifth
            // (`combat`), and a driver that consulted it by default would
            // throw on every committed route — all four of which were
            // planned and recorded with `noDamage: true`, where the guard is
            // real and the game honoured it. The R5 driver asks for combat
            // by name; see levelWorld's PRE_R5_ROLES docblock.
            //
            // ⛓⛓ R5 SLICE 13: AND THIS IS WHERE IT ASKS. `relax.roles` is
            // that "by name" — the promise the comment above has been making
            // since slice 2 with no mechanism behind it, which is why
            // §25.3's absent-census refusal blocked EVERY `moves` press in
            // the game rather than only the uncertifiable ones. ⚠ It may
            // only WIDEN: a plan that quietly dropped `blocking` would get a
            // walk that consults no collider, which is the same defect
            // pointing the other way and much harder to see.
            roles: rolesFor(noclip ? RELAXED_ROLES : PRE_R5_ROLES, relax.roles),
        } : {}),
    });
    const perTick = [];
    const arrivals = [];
    const waypoints = [];
    const holds = [];
    /** ⛓⛓⛓ R5 slice 15: one record per `bait` — phase 1 of `CRUSHER_PLAN`. */
    const baits = [];
    /** ⛓⛓⛓ R5 slice 16: one record per `wait` — a fade the player is not holding. */
    const waits = [];
    const touches = [];
    const collects = [];
    /** ⛔⛔ R5 slice 9: one record per chest leg — the join cell of L38. */
    const chestLegs = [];
    const spears = [];
    /** ⛓ R5 slice 7: one record per FIRE press — see `runFire`. */
    const fires = [];
    /**
     * ⛓⛓⛓ R5 slice 21: one record per KILL — see `runKill`.
     *
     * ⛔ AND IT IS THE ONLY WITNESS. `IceTurret` writes no persistence and
     * leaves no entity behind, so nothing in the tape, the flag set or the
     * observation stream says the body died. This list and the run's own
     * `turretKills` are the two halves, and `runKill` asserts they agree.
     */
    const kills = [];
    const keylocks = [];
    const equips = [];
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
            { avoidVolumes: Boolean(relax), keys: run.keys });
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
         * ⛓⛓⛓ AND A KILL'S TURRET IS ONE — R5 slice 21, and it is the
         * exemption with the largest radius by an order of magnitude.
         *
         * `ENTITY_CLASSES.iceturret.hazard` is the 128 px `attackRange`
         * disc, and the slash reach is 16 — so EVERY stance that can kill
         * one is 112 px inside the volume a route would otherwise refuse.
         * Without this the planner cannot reach its own goal and A* reports
         * the level unreachable, exactly as it did for a hold's button.
         *
         * ⛔ AND THE OVER-PERMISSION IS REAL AND IS NOT A SHRUG. A hold's
         * button is 16x16; this is a 256 px circle, so a leg that declares
         * a kill has the turret's whole disc exempted for its WHOLE
         * duration — including the walk in, which is the point (there is no
         * approach that is outside it) and including any later leg-mate
         * that wanders back through, which is not. What bounds it is the
         * verb's own arithmetic rather than the planner: `runKill` checks
         * the stance, the facing, the rect, the 16 px distance gate and the
         * corpse, and a leg that entered the disc anywhere else gains
         * nothing from having been allowed to.
         *
         * ⚠ AND THE DAMAGE IS PRICED, NOT WAIVED. The disc is where the
         * turret SHOOTS — a three-blast spread every 25 ticks — so this
         * exemption is the planner agreeing to walk into fire, and the
         * run's health (or `noDamage`) is what carries it. The volume is
         * not a lie the exemption makes true; it is a cost the leg accepts.
         */
        (leg.targets ?? []).forEach((t, ti) => {
            if (t?.kill === undefined) return;
            const what = `legs[${li}] level ${leg.level} target ${ti} kill`;
            if (typeof t.kill?.id !== 'string') {
                fail(`${what}: kill.id must be the turret id \`world.iceTurrets\` carries.`);
            }
            const row = (run.world.iceTurrets ?? []).find((r) => r.id === t.kill.id);
            if (!row) {
                fail(`${what}: level ${leg.level} holds no ${t.kill.id}. Known: `
                    + `[${(run.world.iceTurrets ?? []).map((r) => r.id).join(', ') || 'none'}].`);
            }
            legContacts.add(`proximity-hazard:${row.tag}@${row.x},${row.y}`);
        });
        /**
         * ⛓⛓⛓ R5 SLICE 22: AND A `fire.bumps` TARGET EARNS THE SAME ONE,
         * FOR THE SAME REASON AND ONE VERB OVER.
         *
         * A bump press has to REACH the body — `Player.genericHit` calls
         * `IceTurret.bump` from inside the fire rect — so every stance that
         * can push a turret is inside its 128 px disc, exactly as every
         * stance that can kill one is. Until this slice the exemption came
         * free with the `kill` target that always preceded the presses.
         *
         * ⛔ AND THE CASE THAT FOUND IT IS THE CONTROL ARM. The shut-before
         * control is the same target list with the kill REMOVED, and
         * without this its A* cannot reach its own stance — so the pair
         * could not be authored at all, and the reason would have read as
         * "the control is unroutable" rather than "the exemption was
         * attached to the wrong verb". A control that cannot be built is
         * the experiment failing quietly.
         *
         * ⚠ The same over-permission as the kill's, bounded the same way:
         * `runFire`'s bump arm checks the stance, the rect, the corpse's
         * own `bump` gate and the destination tile, so a leg that entered
         * the disc anywhere else gains nothing from having been allowed to.
         */
        (leg.targets ?? []).forEach((t, ti) => {
            for (const b of t?.fire?.bumps ?? []) {
                const what = `legs[${li}] level ${leg.level} target ${ti} fire.bumps`;
                const row = (run.world.iceTurrets ?? []).find((r) => r.id === b?.id);
                if (!row) {
                    fail(`${what}: level ${leg.level} holds no ${b?.id}. Known: `
                        + `[${(run.world.iceTurrets ?? []).map((r) => r.id).join(', ') || 'none'}].`);
                }
                legContacts.add(`proximity-hazard:${row.tag}@${row.x},${row.y}`);
            }
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
        /**
         * ⚠ AND A KEYLOCK'S LINE IS AN EXEMPTED CONTACT, like a hold's
         * button and a touch's lock, for the same reason and with the same
         * bound. `bosslock`'s `key-line` hazard IS the rect the mechanic
         * reads, so without this the planner refuses to route onto the one
         * pixel band the leg exists to stand in — and the walk to the health
         * pickup beyond it crosses the same band on the way out.
         *
         * Leg-scoped, so a leg that clipped its own line somewhere other
         * than the keylock would not be caught here; what catches that is
         * the verb's own solid-before / open-after verification.
         */
        (leg.targets ?? []).forEach((t, ti) => {
            if (t?.keylock === undefined) return;
            const what = `legs[${li}] level ${leg.level} target ${ti} keylock`;
            assertKeyLock(t.keylock, what);
            const l = resolveKeyLock(run.world, t.keylock.lock, what);
            legContacts.add(`proximity-hazard:${l.tag}@${l.x},${l.y}`);
        });
        /**
         * ⛔⛔ AND A CHEST'S VOLUME IS THE SAME KIND OF EXEMPTION, for the
         * same reason and with one more.
         *
         * `ENTITY_CLASSES.chest.hazard` is `[x, x+16) x [y, y+18)` — the
         * chest's own cell plus the two rows the probe line and the player
         * box need — so it IS the rect the mechanic reads, exactly as a
         * `bosslock`'s key-line is. Without this the planner refuses the
         * only two rows from which the chest can ever be opened.
         *
         * ⚠ AND IT IS LEG-SCOPED FOR A REASON THE KEYLOCK DOES NOT HAVE:
         * once the chest is open the walk goes THROUGH the cell — it is the
         * join between L38's two rooms — so the volume has to stop being an
         * obstacle for every later target as well, not just for the
         * approach. `runCollect`'s "keep the planner out, let the executor
         * in" is the opposite trade and it is the right one there: a pickup
         * clipped early is a ceremony fired at the wrong waypoint, while a
         * chest clipped early is the errand happening a few ticks sooner in
         * a cell the walk has to enter anyway.
         */
        (leg.targets ?? []).forEach((t, ti) => {
            if (t?.chest === undefined) return;
            const what = `legs[${li}] level ${leg.level} target ${ti} chest`;
            assertChest(t.chest, what);
            const c = resolveChest(run.world, t.chest.chest, what);
            legContacts.add(`proximity-hazard:${c.tag}@${c.x},${c.y}`);
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
        // ⚠ `inventory` joins them at R4, and for the same reason: it is an
        // input that changes DURING a walk, not a decision the caller made
        // about a leg. `plannerObstacleAt`'s lethal-terrain policy gates on
        // the ITEM — `canSwim` for water, `hasDarkSuit` for lava — and
        // until now it defaulted to "neither", which over-forbids. That
        // default is the TRUTH for the whole R4 walk (the rung drops
        // `darksuit` and `canSwim` is the conch, R5), so this changes no
        // R4 route and is threaded anyway: the alternative is a later rung
        // that holds the suit and gets a planner refusing a lava tile it
        // could cross — a route that will not plan, discovered at slice 8.
        //
        // Read from `run` per call rather than captured, because the grant
        // that would flip it fires mid-walk at a level boundary.
        // ⚠ ...and so do `openBridges` and `pushables` (R4), for the third
        // and fourth time this docblock has had to make the same point. A
        // bridge is Solid until sixty ticks after its press and a pushed
        // block is not where the level built it, so both have different
        // answers at two points in the SAME leg — and R4's route depends on
        // it in both directions: the leg that pushes L63's block plans its
        // walk to the door AFTER the block is gone, and the leg that comes
        // back into L65 plans around a block the game rebuilt.
        //
        // Reading them off the run rather than recomputing means the planner
        // and the executor cannot disagree, which is the `openActivators`
        // lesson and the reason all four arrive through this one function.
        //
        // ⛔⛔ R5 SLICE 15: AND THIS WAS THE SECOND COPY OF
        // `liveGeometryOpts`, IN THE SAME FILE. Slice 14 built that function
        // because three hand-written literals had each dropped a different
        // key (§28.2) — and did not notice that the leg planner's own
        // options were a fourth literal listing the same eight families. The
        // families now come from ONE place (`livePerVisitOpts`) and what
        // stays here is only what a PLAN adds to them.
        const planNow = (extra) => ({
            ...plan,
            contacts: contactsNow(),
            ...livePerVisitOpts(run),
            inventory: run.inventory,
            keys: run.keys,
            ...extra,
        });

        const legWaypoints = [];
        (leg.targets ?? []).forEach((target, ti) => {
            if (!Number.isFinite(target?.x) || !Number.isFinite(target?.y)) {
                fail(`legs[${li}].targets[${ti}] must be {x, y} finite numbers`);
            }
            /**
             * ⛓⛓ R5 SLICE 9: THE POSITIVE CONTROL IS TAKEN BEFORE THE
             * APPROACH, NOT BEFORE THE HOLD — and the reason is a latch.
             *
             * `runHold` asked "was this responder shut when the hold
             * began?", which is exactly right for a `Button` (it
             * republishes its flag every tick, so the group closes the
             * moment the player steps off) and STRUCTURALLY UNSATISFIABLE
             * for a `room = -1` ButtonRoom. That presser LATCHES its group
             * (§20.6: the setter is behind `if (a)` with the author's own
             * "Can't be reset to false!!"), so the ARRIVAL on the button is
             * already the whole mechanic — the cover has fully faded before
             * the first held tick, and the control fired "already open" on
             * a leg that had done nothing wrong.
             *
             * Measured on L38's link 1: `cover@208,224` opens during the
             * drive's own braking ticks.
             *
             * Snapshotting here is also strictly WEAKER as a refusal and
             * strictly STRONGER as a claim: the set of responders shut
             * before the approach contains the set shut before the hold, so
             * no run that passed can start failing, and what the record now
             * reports is what the TARGET changed rather than what the last
             * few ticks of it did.
             */
            const before = {
                open: run.openActivators === null ? null : new Set(run.openActivators),
                armed: run.armedPulsers === null ? null : new Set(run.armedPulsers),
                // ⛔⛔ AND THE CHEST, for the same reason twice over: its
                // trigger is a LINE the approach crosses, so by the time the
                // verb runs the chest has already opened and a control asked
                // then would report "already open" on a leg that did exactly
                // what it was written to do.
                chests: run.openChests === null ? null : new Set(run.openChests),
            };
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
                    `legs[${li}] level ${leg.level} target ${ti} hold`, before);
                holds.push({
                    leg: li, index: ti, level: leg.level, from, to: perTick.length,
                    ...record,
                });
            }
            /**
             * ⛓⛓⛓ R5 slice 15: the bait, AFTER the arrival and BEFORE any
             * hold. The arrival is what puts the player in a lane, and
             * `runBait` asserts exactly that before it emits a tick.
             */
            if (target.bait !== undefined) {
                const from = perTick.length;
                const record = runBait(run, perTick, target.bait,
                    `legs[${li}] level ${leg.level} target ${ti} bait`);
                baits.push({
                    leg: li, index: ti, level: leg.level, from, to: perTick.length,
                    ...record,
                });
            }
            /**
             * ⛓⛓⛓ R5 slice 16: the wait, AFTER the bait and the hold. It is
             * last of the "let the world settle" verbs because the thing it
             * waits on is generally what one of them started.
             */
            if (target.wait !== undefined) {
                const from = perTick.length;
                const record = runWait(run, perTick, target.wait,
                    `legs[${li}] level ${leg.level} target ${ti} wait`);
                waits.push({
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
            /**
             * ── THE EQUIP, which is not a movement at all (R4) ─────────
             *
             * `equip: {slot}` costs the tape NO TICKS: it is one write to
             * `Main.primary` at the tick the run has reached, and `Bot.as`
             * applies it beside a grant. It is a leg TARGET rather than a
             * tape field because the headline COLLECTS the spear — so the
             * tick at which the slot becomes selectable is a fact synthesis
             * produces, and a `relax.equips` written before the drive would
             * be guessing the length of four legs and a ceremony.
             *
             * The target still carries an `{x, y}` and is still driven to,
             * because a selection made at an unspecified position would put
             * the tick — and therefore the emitted `{t, slot}` — at the mercy
             * of wherever the previous target happened to end.
             */
            if (target.equip !== undefined) {
                const what = `legs[${li}] level ${leg.level} target ${ti} equip`;
                const slot = target.equip.slot;
                if (!Number.isInteger(slot) || slot < 0) {
                    fail(`${what}: equip.slot must be a non-negative integer, got `
                        + `${JSON.stringify(slot)}`);
                }
                run.equipNow(slot);
                equips.push({ leg: li, index: ti, t: perTick.length, slot });
            }
            if (target.spear !== undefined) {
                const from = perTick.length;
                const record = runSpear(run, perTick, target.spear,
                    `legs[${li}] level ${leg.level} target ${ti} spear`);
                spears.push({
                    leg: li, index: ti, level: leg.level, from, to: perTick.length,
                    ...record,
                });
            }
            // ⛓⛓⛓ R5 SLICE 21: THE KILL, and it sits ABOVE `fire` because
            // that is the order the leg runs in — a `fire.bumps` press at a
            // live turret is a silent no-op in both directions, so a window
            // that fired first would report the corpse unmoved and read as a
            // geometry mistake on a leg whose geometry was perfect.
            if (target.kill !== undefined) {
                const from = perTick.length;
                const record = runKill(run, perTick, target.kill,
                    `legs[${li}] level ${leg.level} target ${ti} kill`);
                kills.push({
                    leg: li, index: ti, level: leg.level, from, to: perTick.length,
                    ...record,
                });
            }
            if (target.fire !== undefined) {
                const from = perTick.length;
                const record = runFire(run, perTick, target.fire,
                    `legs[${li}] level ${leg.level} target ${ti} fire`);
                fires.push({
                    leg: li, index: ti, level: leg.level, from, to: perTick.length,
                    ...record,
                });
            }
            if (target.keylock !== undefined) {
                const record = runKeyLock(run, perTick, target.keylock,
                    `legs[${li}] level ${leg.level} target ${ti} keylock`);
                keylocks.push({
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
            if (target.chest !== undefined) {
                const record = runChest(run, perTick, target.chest, maxTicksPerTarget,
                    `legs[${li}] level ${leg.level} target ${ti} chest`, before);
                chestLegs.push({
                    leg: li, index: ti, level: leg.level, to: perTick.length, ...record,
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
    // A declared equip that never fires is a tape claiming a selection the
    // walk does not make, and every press after it would be a SWORD SLASH
    // with nothing saying so — the `unfiredGrantLevels` rule, one field over.
    if (relax && run.unfiredEquipTicks.length > 0) {
        fail(`the tape equips a slot at tick(s) ${run.unfiredEquipTicks.join(', ')}, `
            + `which the ${perTick.length}-tick walk never reaches. An equip fires at `
            + 'its own observation, so either the walk got shorter or the tick is stale.');
    }
    // ⚠ `equips` IS A MEASUREMENT, not a declaration, and this line is where
    // that becomes true of the artifact. `relax.equips` decides the tape
    // VERSION (v4 is selected by the field's presence) and seeds the
    // segments' own tick-0 selections; what gets WRITTEN is every equip the
    // run actually fired, which is those plus the ones the `equip` leg verb
    // made at ticks only synthesis could know. Replaying the emitted list
    // through `applyEquipsAt` lands on exactly the same ticks.
    /**
     * ⛔⛔ AN EQUIP THE TAPE WOULD DROP IS THE TWO-CONSUMERS FAILURE, and it
     * is silent in the worst possible way.
     *
     * `equips` is a version-4 field and it is optional BY PRESENCE (see
     * `buildTape`), so a `relax` that omits it makes a version-3 tape — and
     * a leg that ran an `equip` target verifies its fire presses with the
     * slot selected and then emits a tape that never selects it. The
     * driver is green, the fixture is written, and the REPLAY fails
     * hundreds of ticks later with "the sword press at tick 809 reaches a
     * responder this rung refuses": a message about the wrong mechanic, in
     * the wrong file, at the wrong tick.
     *
     * Measured on the shaft plan, which is exactly the leg the field exists
     * for. Loud here instead.
     */
    if (relax && relax.equips === undefined && run.equipsFired.length > 0) {
        fail(`synthesizeLegs: ${run.equipsFired.length} equip target(s) ran `
            + `(slot(s) ${run.equipsFired.map((e) => e.slot).join(', ')}) and \`relax\` `
            + 'does not declare `equips`. `equips` is version 4 and it is optional by '
            + 'PRESENCE, so the emitted tape would be version 3 and would never select '
            + 'the slot — the driver would verify one execution and the tape would '
            + 'replay another. Declare `equips: []` in `relax`.');
    }
    /**
     * ⛔⛔ AND THE SAME FAILURE ONE VERSION LATER, found in slice 16 by a
     * plan that declared `pins` and got an unpinned tape.
     *
     * `pins` reaches `createLevelRun` above, so the driver's whole
     * verification runs with the pinned execution — and until slice 16
     * `buildTape` had no version-5 arm, so the emitted tape asked the game
     * for the unpinned one. The two-consumers failure with no symptom on
     * this side at all.
     *
     * The guard is the mirror of the equip one: a `relax` that pins must
     * say so, and a pin the tape would drop is loud here.
     */
    if (relax && relax.pins !== undefined && !Array.isArray(relax.pins)) {
        fail('synthesizeLegs: relax.pins must be an ARRAY of pin names — [] for "this '
            + `plan pins nothing" — got ${typeof relax.pins}. It selects which `
            + 'vanilla-reachable execution BOTH the run and the emitted tape get, and a '
            + 'plan that pins one and a tape that pins the other is two experiments.');
    }
    const tape = buildTape(perTick, boot, name, relax
        ? {
            ...relax,
            ...(relax.equips === undefined ? {} : { equips: run.equipsFired }),
        }
        : { noclip: false });
    if (relax && (relax.pins ?? []).join(' ') !== (tape.pins ?? []).join(' ')) {
        fail(`synthesizeLegs: the plan declares pins [${(relax.pins ?? []).join(' ')}] and `
            + `the emitted tape carries [${(tape.pins ?? []).join(' ')}]. A pin selects an `
            + 'execution, so the run this driver verified and the run the game would '
            + 'replay are different ones.');
    }

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
        /**
         * ⛓⛓⛓ R5 slice 15: one per bait — `{id, from, to, dir, ticks}`. The
         * `from`/`to` pair is what makes "the crusher is the wall" a
         * measurement in the tape rather than a claim in a comment.
         */
        baits: baits.map((b) => ({ ...b })),
        waits: waits.map((w) => ({ ...w })),
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
        // ⛔⛔ R5 slice 9. One record per CHEST the run opened: which chest,
        // the flag `open()` cleared, the tick it fired on (often DURING the
        // approach — the trigger is a line), the tick its SealPiece was
        // collected, and the dead frames the ceremony cost. The tape is
        // empty ticks here too.
        chests: chestLegs.map((c) => ({ ...c })),
        /** Every pulse tick, every block a pulse moved, every seal collected. */
        pulses: {
            hits: run.pulserHits,
            pushes: run.pulserPushes,
            playerHits: run.pulserPlayerHits,
        },
        seals: run.sealCollections,
        chestOpens: run.chestOpens,
        roomWrites: run.roomWrites,
        // One record per SPEAR press the run verified: what it was aimed at,
        // which way the player was facing, where they stood, and the tick
        // range it cost. The tape carries a one-tick `primary` span and a
        // wait, so — as with the other three verbs — this is the only place
        // a consumer can learn the walk opens a bridge or moves a block. The
        // run's own `presses` ledger is the other half: this says what was
        // INTENDED, that says what the rect actually contained.
        spears: spears.map((s2) => ({ ...s2 })),
        fires: fires.map((f) => ({ ...f })),
        /**
         * ⛓⛓⛓ One record per KILL — R5 slice 21, and the same rule for the
         * strongest reason yet: `IceTurret` writes NO persistence and its
         * body is never removed, so the tape, the flag set and the
         * observation stream are all silent about the death. Without this
         * list there is no consumer-visible fact that the walk killed
         * anything. It carries the LEDGER ARITHMETIC too (how many
         * `tset == -1` locks the room held, how many the death opened), so
         * a room that quietly stopped having locks is a diff rather than a
         * still-green pass.
         */
        kills: kills.map((k) => ({ ...k })),
        // One record per BOSSLOCK the run opened with a key: which lock,
        // which key type, which flag it wrote, where the player stood and how
        // long the window ran. The `holds`/`touches`/`spears` rule again —
        // the tape is only empty ticks, so this is the only place a consumer
        // can learn the walk opened anything with a key.
        keylocks: keylocks.map((k) => ({ ...k })),
        // One record per EQUIP a leg made, with the tick it landed on. The
        // tape carries the same list (see `buildTape` above); this one also
        // says WHICH leg asked for it.
        equips: equips.map((e) => ({ ...e })),
        keys: [...run.keys],
        presses: run.presses,
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
