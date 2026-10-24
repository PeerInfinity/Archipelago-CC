/**
 * procgenCore/elements/roomDoor — **THE GEOMETRY TWO ROOM-AWARE DOOR ELEMENTS
 * SHARE**, and nothing else.
 *
 * PROCGEN ELEMENTS arc 3, slice 4a (D2/D3). The KILL GATE and the BLOCK POCKET
 * are different mechanisms — one is opened by killing a body, the other by
 * shoving the block out of the way — but they stand in the same place and pick
 * it the same way: a cell of the room's canonical main path, with a wall GROWN
 * from it perpendicular to the corridor's direction there. Writing that twice
 * would be two answers to *"where does a door go"*, and the day they disagreed
 * one element would place where the other refused.
 *
 * ⛔ NOTHING HERE DRAWS. Every function is a pure reading of the `room` probe
 * (`elements.assertRoomProbe`); the ONE draw an `on-connector` element spends is
 * the CHOICE among the candidates this file enumerates, and it is spent by the
 * element, in its own docblock's words.
 *
 * ⛔ AND NOTHING HERE KNOWS A SUBSTRATE. `lock`, `spinner`, `pushableblock` are
 * the BINDING's words; this file says *door cell*, *wall*, *pocket*.
 */

import { TILE_FLOOR, TILE_WALL } from '../../shared/procgen/mazeAlgorithms/gridTiles.js';

export const NB4 = Object.freeze([[0, -1], [0, 1], [-1, 0], [1, 0]]);

export const cellKey = (x, y) => `${x},${y}`;

/**
 * ⛓⛓⛓ **THE TWO REFUSALS THIS FILE RAISES** — PROCGEN ELEMENTS arc 5, slice 5.
 *
 * `pocketFor` is the only thing here that refuses, and it does so by NAME, so
 * the names get a census key where they are raised. ⛔ **AND THE ELEMENTS STILL
 * DECLARE THEM TOO**, which is not a duplicate: `KILL_GATE_REFUSALS`'
 * `SHORTCUT_REFUSALS`' and `BLOCK_POCKET_REFUSALS`' axis is the ELEMENT — what
 * a caller who asked for that head can meet — and this one's axis is the FILE.
 * Both are true, neither is a copy, and it is the same arrangement
 * `SEEDLING_ELEMENT_REFUSALS` and `MAZE_REFUSALS` have had since P5.
 */
export const ROOM_DOOR_REFUSALS = Object.freeze(['no-pocket', 'pocket-not-legal']);

/**
 * ⛓⛓⛓ **THE MINIMUM DISTANCE FROM THE GOAL — trap 348, paid at the SITE
 * PICKER rather than at the solver** (⚖ the orchestrating session's line,
 * arc-3 §11.13).
 *
 * A `lock` on the goal's own doorstep breaks the COLLECT ceremony's approach
 * sweep — *"approaching torchpickup@…, the sweep was blocked by lock at (…). A
 * pickup is not solid, so the planner and the geometry disagree about the
 * approach"* — and slice 3's `flagLockCellFor` clause (c) already pays it for
 * the flag's lock. §11.13 measured the same class from the BLOCK's side (`rooms`
 * seed 4, one placement in nine per palette) and ruled the rule belongs HERE:
 * a candidate whose door cell would land within 2 of the goal is never offered,
 * so the refusal is free instead of costing a certification solve.
 *
 * ⚠ MANHATTAN, which is clause (c)'s own reading one step further out: `>= 2`
 * is exactly *"not the goal and not 4-adjacent to it"*.
 */
export const DOOR_GOAL_MIN = 2;

export const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

const sameCell = (a, b) => a.x === b.x && a.y === b.y;

/**
 * ⛓⛓⛓ **WHICH AXIS THE WALL GROWS ALONG AT ONE PATH CELL — `'x'`, `'y'` or
 * NOTHING**, and the third answer is a rule rather than a gap.
 *
 * The corridor's direction at `path[i]` is read from its two path neighbours,
 * and the wall is PERPENDICULAR to it: a corridor running north-south is cut by
 * a wall growing east-west. Where the two neighbours are neither collinear the
 * cell is a BEND, there is no single perpendicular, and the wall grows NOTHING —
 * the door cell alone. That is not a loss: on a corridor a main-path cell is a
 * cut vertex all by itself, so a bend still makes a door; it is only in a room
 * with AREA that the wall does the cutting, and there the straight cells are
 * where the wall belongs anyway. ⛔ The law decides either way — the grown wall
 * is a PROPOSAL and `room.doorLaw` is what accepts or refuses it.
 */
export function wallAxisAt(path, i) {
    const prev = path[i - 1];
    const next = path[i + 1];
    if (!prev || !next) return null;
    if (prev.x === next.x) return 'x';      // runs N-S ⇒ the wall runs E-W
    if (prev.y === next.y) return 'y';      // runs E-W ⇒ the wall runs N-S
    return null;                            // a BEND — no single perpendicular
}

/**
 * ⛓⛓⛓ **THE WALL, GROWN** — from the door cell along `axis`, BOTH ways, one
 * cell at a time, stopping at the first cell that is not floor.
 *
 *   on a one-wide corridor   0 cells (the neighbours are already wall)
 *   in an open 10x10 room    7 cells (to the border ring both ways), which with
 *                            the door cell is the 8-cell line `INTERIOR_SPAN`
 *                            names and slice 2's door census measured as the
 *                            ONLY span that cuts an `empty` room
 *   in a chamber             to the chamber's walls
 *
 * ⛔ THE START AND THE GOAL ARE NOT GROWABLE. The growth would happily wall the
 * cell the level begins or ends on; stopping there leaves a hole, the law then
 * says the wall is not a cut, and the candidate is refused BY NAME instead of
 * building a room with no start.
 */
export function growWall(room, door, axis) {
    const cells = [];
    if (!axis) return cells;
    const [dx, dy] = axis === 'x' ? [1, 0] : [0, 1];
    for (const sign of [1, -1]) {
        for (let k = 1; ; k += 1) {
            const x = door.x + dx * sign * k;
            const y = door.y + dy * sign * k;
            if (!room.floorAt(x, y)) break;
            if (sameCell({ x, y }, room.start) || sameCell({ x, y }, room.goal)) break;
            cells.push(Object.freeze({ x, y }));
        }
    }
    return cells;
}

/** Is `(x,y)` inside the room's INTERIOR — off the border ring? */
export const inInterior = (room, x, y) => x > 0 && y > 0
    && x < room.width - 1 && y < room.height - 1;

/**
 * How many 4-neighbours of `(x,y)` are floor once `writes` (a `Map` of
 * `"x,y" -> tile`) is applied over the skeleton. ⛓ ONE reading of "floor after
 * me", used by both elements for the dead-end test and for the open-pocket
 * preference.
 */
export function floorNeighboursAfter(room, writes, x, y) {
    let n = 0;
    for (const [dx, dy] of NB4) {
        const w = writes.get(cellKey(x + dx, y + dy));
        const floor = w === undefined ? room.floorAt(x + dx, y + dy) : w === TILE_FLOOR;
        if (floor) n += 1;
    }
    return n;
}

/**
 * ⛓⛓ **EVERY CELL OF THE MAIN PATH A DOOR MAY STAND ON**, in path order from
 * the START — the list the element's ONE draw picks from.
 *
 * ⛔ The endpoints are excluded (a door on the start or the goal is not a door)
 * and so is everything within `DOOR_GOAL_MIN` of the goal. Each row carries the
 * cell, its index, the wall axis and the START-SIDE neighbour `before`, which is
 * where a pocket has to hang so that clause 2 of the door law can hold at all.
 */
export function doorCandidates(room) {
    const path = room.mainPath;
    const out = [];
    for (let i = 1; i < path.length - 1; i += 1) {
        const cell = path[i];
        out.push(Object.freeze({
            cell: Object.freeze({ x: cell.x, y: cell.y }),
            index: i,
            before: Object.freeze({ x: path[i - 1].x, y: path[i - 1].y }),
            after: Object.freeze({ x: path[i + 1].x, y: path[i + 1].y }),
            wallAxis: wallAxisAt(path, i),
            goalDistance: manhattan(cell, room.goal),
        }));
    }
    return out;
}

/** The `tiles` list for a grown wall plus (optionally) one carved cell. */
export function tilesFor(wall, carved = []) {
    return Object.freeze([
        ...wall.map((c) => Object.freeze({ x: c.x, y: c.y, tile: TILE_WALL })),
        ...carved.map((c) => Object.freeze({ x: c.x, y: c.y, tile: TILE_FLOOR })),
    ]);
}

/** The `Map` the neighbour readings above take, built from a `tiles` list. */
export function writesOf(tiles) {
    return new Map(tiles.map((t) => [cellKey(t.x, t.y), t.tile]));
}

export { TILE_FLOOR, TILE_WALL };

/**
 * ⛓⛓⛓ **THE BODY'S REGION — the cells an element's live BODY can be in, and
 * the walls that keep it there** (PROCGEN ELEMENTS arc 3, slice 4d, D3).
 *
 * The 4-connected flood of FLOOR from `from`, over the room with `writes`
 * applied and every cell of `walled` treated as solid, plus the WALL cells
 * 4-adjacent to it.
 *
 * ── ⛔⛔ WHY A FLOOD AND NOT A LANE, MEASURED ──────────────────────────
 *
 * The slice brief proposed *"the corridor cells along the spinner's bounce axis
 * until the first non-ground cell in each direction"*, and the body is not
 * axis-aligned: `spinner.SPINNER.heading` is `-PI/4`, so the ctor velocity is
 * `(0.7071, -0.7071)` and every tick moves BOTH axes, reflecting per axis on a
 * solid. A lane would have named 2–4 cells; this flood names **median 13 cells
 * on a carved kind and median 32 on the open 10x10 room** (arc 5, slice 0's
 * W2 roll-up over 224 cells and 17 placed-and-certified gates: region min 7
 * max 24 median 13 carved, min 16 max 40 median 32 `empty`).
 *
 * ⛔ **THE NUMBERS ABOVE ARE THE REGION'S OWN.** They were once a DIFFERENT
 * function's: the census used to flood the skeleton grid without the element's
 * grown wall, and this docblock quoted that copy's cells as if they were
 * `bodyRegion`'s. The copy is deleted and these are read off
 * `buildKillGate`'s candidate — the very object the element demanded.
 *
 * ── ⛓ WHY THE FLOOD CONTAINS THE BODY, AS AN ARGUMENT ─────────────────
 *
 * The body's box lives inside the cell its centre is in (a 7x7 box, ±4 about
 * the centre, in a 16x16 cell), so the centre can only be in a NON-SOLID cell;
 * and to move between two cells the box straddles their shared EDGE, which a
 * diagonal-only contact does not offer. ⇒ the centre's cell path is 4-connected
 * through non-solid cells, and this flood contains it. **MEASURED, not left as
 * an argument: over 17 placed-and-certified gates (7 `empty`, 10 carved) the
 * body's own stepper put ZERO cells outside this flood, and 6 of the 10 carved
 * sets were EQUAL to it.**
 *
 * ── ⛓ AND THE BOUNDARY IS PART OF THE ANSWER ──────────────────────────
 *
 * Pass 2 may CARVE (⚖ design ruling 17). A carve on a wall cell touching the
 * region would let the body OUT of the set this was computed on, which would
 * make a demand computed at construct time false about the level that ships.
 * So the walls are returned with the region and the element demands them too.
 *
 * ⛔ NO DRAW, NO SIMULATION — a walk on the SKELETON, a pure function of the
 * room. ⚠ It is deliberately NOT the body's own stepper: this file is
 * substrate-agnostic and does not know its body is a `Spinner`.
 *
 * ── ⛓⛓⛓ AND ARC 5 SLICE 2 PRICED THE ALTERNATIVE AND REFUSED IT ───────
 *
 * §18.2 C4 asked for the body's own STEPPED set instead — *"exact"*, against
 * this flood's *"one false positive in ten"*. Three measurements closed it:
 *
 *  1. **THE STEPPED SET IS A FUNCTION OF A TICK BOUND, AND THE BOUND IS THE
 *     SOLVER'S.** The 400 the census used is `DEFAULT_BUDGET.maxTicksPerTarget`
 *     — how long the SOLVER may spend reaching one target — and nothing about
 *     the body. On the corpus's 7 placed gates the stepped set grows with the
 *     bound and **reaches this flood exactly**: `empty` seed 29 is 25 cells at
 *     400, 37 at 800, and all 40 from 1600 on; the carved `winding` seed 9 is
 *     12 / 13 / 13 / 18 at 400 / 800 / 1600 / 3200. ⇒ the flood is not an
 *     over-approximation of where the body goes; it is the LIMIT of it.
 *  2. **SO THE PUBLISHED "24% OVER-FORBIDDING" IS A BOUND ARTEFACT** — those
 *     are cells the body reaches later than 400 ticks, not cells it never
 *     reaches.
 *  3. **AND RELAXING TO THE 400-TICK SET COSTS LEVELS.** A build that switched
 *     turned 3 rows of the 410-row committed corpus from levels into
 *     `GenerationAborted`: pass 2 painted a `water-pool` in a cell only the
 *     flood forbade and the player DROWNED walking the kill (`empty`
 *     post-sword seed 29 at (4,4), seed 38 at (1,3)). The SAME build with the
 *     bound at 4000 reproduces every committed row byte for byte — which is
 *     what says the bound, and not the switch, is the mover.
 *
 * ⇒ **C4 IS MEASURED AND REFUTED, NOT DEFERRED.** An exact demand would have
 * to be exact at every bound, and at every bound where it is, it is this.
 *
 * @returns {{region: Set<string>, boundary: Set<string>}} both as `cellKey`s
 */
export function bodyRegion(room, from, { writes = new Map(), walled = [] } = {}) {
    const shut = new Set(walled.map((c) => cellKey(c.x, c.y)));
    const floorAt = (x, y) => {
        if (!inInterior(room, x, y)) return false;
        if (shut.has(cellKey(x, y))) return false;
        const w = writes.get(cellKey(x, y));
        return w === undefined ? room.floorAt(x, y) : w === TILE_FLOOR;
    };
    const region = new Set([cellKey(from.x, from.y)]);
    const boundary = new Set();
    const stack = [{ x: from.x, y: from.y }];
    while (stack.length > 0) {
        const c = stack.pop();
        for (const [dx, dy] of NB4) {
            const x = c.x + dx;
            const y = c.y + dy;
            const k = cellKey(x, y);
            if (!floorAt(x, y)) {
                /** ⛓ Only a cell INSIDE the room can be carved, so only those
                 *  are worth demanding; the border ring is the room's own. */
                if (inInterior(room, x, y) && !shut.has(k)) boundary.add(k);
                continue;
            }
            if (region.has(k)) continue;
            region.add(k);
            stack.push({ x, y });
        }
    }
    return { region, boundary };
}

/**
 * ⛓⛓ **WHERE THE OPENER STANDS — the pocket for ONE candidate**: `{cell,
 * carved}` or `{refused}`.
 *
 * ⛔ THE CANDIDATES ARE THE 4-NEIGHBOURS OF `before`, THE START-SIDE PATH CELL,
 * and that is what makes the pocket start-side BY CONSTRUCTION rather than by
 * luck — `before` is on the start's side of the door by definition of a path.
 * Clause 2 of the door law asserts it anyway, because "by construction" is a
 * claim and the flood is a measurement.
 *
 * ⛓⛓⛓ **IT MOVED HERE FROM `killGate.js` IN ARC 5, SLICE 5, AND THE MOVE IS
 * VERBATIM.** The SHORTCUT element stands in the same place as the kill gate
 * and puts its body in the same kind of pocket; the only thing that differs
 * between them is WHICH LAW adjudicates the door. A second copy of this search
 * would be a second answer to *"where does the opener go"*, and the day they
 * disagreed one element would place where the other refused — which is the
 * exact argument that put `growWall` and `doorCandidates` in this file in the
 * first place. ⛔ The kill gate's three committed levels are byte-identical
 * across the move (`d48f424f…`/`4f736b5e…`/`3dd61600…`), which is what says it
 * was a move.
 */
export function pocketFor(room, cand, wall, { preferOpen }) {
    const onWall = new Set(wall.map((c) => cellKey(c.x, c.y)));
    const onPath = new Set(room.mainPath.map((c) => cellKey(c.x, c.y)));
    const open = [];
    const carvable = [];
    let sawCandidate = false;
    for (const [dx, dy] of NB4) {
        const x = cand.before.x + dx;
        const y = cand.before.y + dy;
        const k = cellKey(x, y);
        if (!inInterior(room, x, y)) continue;
        if (onWall.has(k) || onPath.has(k)) continue;
        if ((x === room.start.x && y === room.start.y)
            || (x === room.goal.x && y === room.goal.y)) continue;
        sawCandidate = true;
        if (room.floorAt(x, y)) {
            open.push({ cell: { x, y }, carved: false,
                neighbours: floorNeighboursAfter(room, writesOf(tilesFor(wall)), x, y) });
            continue;
        }
        /**
         * ⛔ A CARVE IS A DEAD END, and the element pre-checks the clause it can
         * see: after this element's writes the cell must have EXACTLY ONE floor
         * neighbour. The binding runs slice 2's carve rule in full (one blob,
         * one mouth, no shortcut) on the way in — this is the proposal, that is
         * the legality.
         */
        const writes = writesOf(tilesFor(wall, [{ x, y }]));
        if (floorNeighboursAfter(room, writes, x, y) === 1) {
            carvable.push({ cell: { x, y }, carved: true, neighbours: 1 });
        }
    }
    if (preferOpen) open.sort((a, b) => b.neighbours - a.neighbours);
    const chosen = open[0] ?? carvable[0] ?? null;
    if (chosen) return chosen;
    return { refused: sawCandidate ? 'pocket-not-legal' : 'no-pocket' };
}
