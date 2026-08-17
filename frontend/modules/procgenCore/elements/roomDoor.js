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
