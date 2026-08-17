/**
 * procgenCore/elements/killGate — **THE KILL GATE**, the arc's first
 * `on-connector` element (PROCGEN ELEMENTS arc 3, slice 4a, D2; design
 * catalogue #4, *kill gate + Spinner*).
 *
 * A lock on a main-path cut cell that opens when the room's enemy count reaches
 * zero, and the body whose death opens it standing in a pocket the player can
 * reach from the START. On Seedling that is `lock {tset:-1}` + `spinner`; here
 * it is *the door obstacle* and *the body obstacle*, because this file does not
 * know which substrate it is on.
 *
 * ── ⛓⛓⛓ WHY IT IS AN ELEMENT AND NOT THE TEMPLATE IT REPLACES ─────────
 *
 * `procgenPalette`'s `wall-gap-spinner-killlock` is the same mechanism as a
 * PASS-2 TEMPLATE, and being a template is what costs it. A template writes a
 * RELATIVE footprint at an anchor somebody else offers, so it cannot know how
 * long its wall should be: slice 2 had to give it a `span` PARAMETER whose
 * domain the census measured as `{1, 8}` — one value for the open room and one
 * for a corridor — and then pay for it, because *"half this family's `empty`
 * draws are now NO_ANCHOR by construction"* (§9.11's named price). ⛓ An element
 * constructed AFTER the carve does not draw a span at all: it GROWS the wall
 * until the wall meets the room, which is 0 cells on a corridor, 7 on the open
 * 10x10 room and whatever a chamber needs. **The parameter was a proxy for a
 * measurement the room can make itself.**
 *
 * ── THE RULES, EACH ONE A NAMED REFUSAL ───────────────────────────────
 *
 *  1. THE DOOR CELL is a cell of the room's canonical main path (`roomDoor
 *     .doorCandidates`), never an endpoint, and at least `DOOR_GOAL_MIN` from
 *     the goal (trap 348 at the picker) — else `goal-too-close`.
 *  2. THE WALL grows from it perpendicular to the corridor's direction, both
 *     ways, to the first non-floor cell (`roomDoor.growWall`).
 *  3. THE POCKET is a 4-neighbour of the START-SIDE path cell `before`, off the
 *     path and off the wall: an existing floor cell where there is one, else a
 *     wall cell CARVED as a dead end (exactly one floor neighbour afterwards) —
 *     else `no-pocket` / `pocket-not-legal`.
 *  4. THE LAW ADJUDICATES, and the element does not second-guess it:
 *     `room.doorLaw` is the BINDING's own door rule, handed in through the
 *     probe. With the wall painted and the door cell WALLED the goal must be
 *     unreachable (the CUT), with it open reachable (it does not seal), and the
 *     pocket must be reachable from the START (START-SIDE). A chamber with a
 *     second exit is not sealed by one line and the law is what says so —
 *     `wall-does-not-seal`.
 *  5. ONE DRAW, AND IT IS THE ONLY ONE: `rng.pick` over the candidates that
 *     passed all four, in path order from the start. ⛔ Everything before the
 *     pick is a function of the room; nothing after it is a choice.
 *
 * ⚠ **THE POCKET PREFERENCE IS A MEASUREMENT, NOT A TASTE.** §9b.3 measured
 * that 79% of the corridor kill lock's `swing … collideLine("Solid")` throws
 * happen at a pocket cell with ONE floor neighbour — the solver's own
 * pre-existing class, ⛔ not this slice's to fix. So where the room offers a
 * pocket with two or more, this element prefers it BY CONSTRUCTION, and the
 * census measures the throw rate with and without (`POCKET_PREFERS_OPEN`, and
 * `buildKillGate` takes the flag so the control arm is the same code).
 */

import { defineElement } from '../elements.js';
import {
    DOOR_GOAL_MIN, NB4, cellKey, doorCandidates, floorNeighboursAfter, growWall,
    inInterior, tilesFor, writesOf,
} from './roomDoor.js';

/** The two ids the BINDING looks up — the door, and the body that opens it. */
export const KILL_DOOR_ID = 'killgate_door';
export const KILL_BODY_ID = 'killgate_body';

/**
 * ⛓ Prefer a pocket cell with >= 2 floor neighbours where the room has one —
 * see the file docblock. Exported so the census can run the control arm through
 * `buildKillGate` rather than through a second copy of the search.
 */
export const POCKET_PREFERS_OPEN = true;

/** Every refusal this element can produce, BY NAME — what the census counts. */
export const KILL_GATE_REFUSALS = Object.freeze([
    'no-cut-cell', 'goal-too-close', 'wall-does-not-seal', 'no-pocket', 'pocket-not-legal',
]);

/**
 * The pocket for ONE candidate: `{cell, carved}` or `{refused}`.
 *
 * ⛔ THE CANDIDATES ARE THE 4-NEIGHBOURS OF `before`, THE START-SIDE PATH CELL,
 * and that is what makes the pocket start-side BY CONSTRUCTION rather than by
 * luck — `before` is on the start's side of the door by definition of a path.
 * Clause 2 of the door law asserts it anyway, because "by construction" is a
 * claim and the flood is a measurement.
 */
function pocketFor(room, cand, wall, { preferOpen }) {
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

/** ⛓ The refusal a run of candidates deserves: the DEEPEST stage any reached. */
const STAGES = Object.freeze(['goal-too-close', 'wall-does-not-seal',
    'no-pocket', 'pocket-not-legal']);
const deepest = (seen) => STAGES.filter((s) => seen.has(s)).pop() ?? 'no-cut-cell';

/**
 * The element's internals, exported so the geometry is testable without a
 * stream and so the census can run the pocket-preference control arm.
 *
 * @returns {{candidates, placementOf}|{refused:{reason, detail}}}
 */
export function buildKillGate(room, { preferOpen = POCKET_PREFERS_OPEN } = {}) {
    const seen = new Set();
    const ok = [];
    for (const cand of doorCandidates(room)) {
        if (cand.goalDistance < DOOR_GOAL_MIN) { seen.add('goal-too-close'); continue; }
        const wall = growWall(room, cand.cell, cand.wallAxis);
        const pocket = pocketFor(room, cand, wall, { preferOpen });
        if (pocket.refused) { seen.add(pocket.refused); continue; }
        const tiles = tilesFor(wall, pocket.carved ? [pocket.cell] : []);
        const why = room.doorLaw({ paint: tiles,
            doorCells: [cand.cell], clearer: [pocket.cell] });
        if (why) { seen.add('wall-does-not-seal'); continue; }
        ok.push(Object.freeze({ cand, wall: Object.freeze(wall), pocket, tiles }));
    }
    if (ok.length === 0) {
        const reason = deepest(seen);
        return { refused: { reason,
            detail: `no cell of the ${room.mainPath.length}-cell main path can carry a kill `
                + `gate: ${doorCandidates(room).length} interior path cell(s) tried, the `
                + `deepest stage any reached was "${reason}". ⛓ The wall is GROWN, not drawn `
                + '— on a corridor it is 0 cells and the path cell alone is the cut; in a room '
                + 'with area it must cross to the walls, and a chamber with a SECOND EXIT is '
                + 'not sealed by one line. The law decides that, not the geometry.' } };
    }
    return { candidates: Object.freeze(ok) };
}

/** One chosen candidate → the contract's placement. Absolute cells throughout. */
function placementOf(pick, count) {
    return {
        tiles: pick.tiles,
        entities: {
            blocks: [],
            buttons: [],
            obstacles: [
                { x: pick.cand.cell.x, y: pick.cand.cell.y, id: KILL_DOOR_ID },
                { x: pick.pocket.cell.x, y: pick.pocket.cell.y, id: KILL_BODY_ID },
            ],
            items: [],
        },
        doorCells: [{ x: pick.cand.cell.x, y: pick.cand.cell.y }],
        clearer: [{ x: pick.pocket.cell.x, y: pick.pocket.cell.y }],
        demand: [],
        area: null,
        symbols: { holds: [], grants: [] },
        /** ⛓ WHAT IT COST THE ROOM, in the units the room measures: how much
         *  wall it grew, whether the pocket was a CARVE, and how many cells
         *  could have carried it — the last one is what says whether the draw
         *  was a choice or a formality. */
        cost: {
            wall: pick.wall.length,
            carved: pick.pocket.carved ? 1 : 0,
            candidates: count,
            goalDistance: pick.cand.goalDistance,
        },
    };
}

function assertKillGatePlacement(placement, { fail }) {
    const { obstacles } = placement.entities;
    if (obstacles.length !== 2) {
        fail(`killGate: the gate is exactly TWO obstacles — the door and the body whose death `
            + `opens it — got ${obstacles.length}.`);
    }
    const [door, body] = obstacles;
    if (door.id !== KILL_DOOR_ID || body.id !== KILL_BODY_ID) {
        fail(`killGate: the ids must be ${KILL_DOOR_ID}/${KILL_BODY_ID}, in that order.`);
    }
    if (door.x === body.x && door.y === body.y) {
        fail('killGate: the body stands IN the door cell. A gate whose only enemy is inside '
            + 'the lock it opens is one the player walks past on the tick it dies.');
    }
    if (placement.doorCells.length !== 1
        || placement.doorCells[0].x !== door.x || placement.doorCells[0].y !== door.y) {
        fail('killGate: `doorCells` must be exactly the door obstacle\'s own cell — the lock '
            + 'IS the door on a corridor, and a law asked about any other cell is a law '
            + 'asked about a different room.');
    }
    if (placement.clearer.length !== 1
        || placement.clearer[0].x !== body.x || placement.clearer[0].y !== body.y) {
        fail('killGate: `clearer` must be exactly the body\'s cell — it is the one thing that '
            + 'has to be reachable from the START with the door walled.');
    }
}

export const KILL_GATE = defineElement({
    name: 'kill-gate',
    family: 'killgate',
    phase: 'on-connector',
    why: 'A lock on a main-path cut whose wall is GROWN to fit the room — 0 cells on a '
        + 'corridor, the full span on the open room, a chamber\'s walls in a chamber — and '
        + 'the body whose death opens it in a start-side pocket. ⛓ It is the room-aware '
        + 'answer to `wall-gap-spinner-killlock`, whose `span` parameter was a proxy for a '
        + 'measurement the room can make itself (arc-3 §9.11).',
    params: [],
    construct(values, site, rng) {
        const out = buildKillGate(site.room);
        if (out.refused) return out;
        /**
         * ⛓⛓⛓ **THE ONE DRAW, DECLARED HERE AND NOWHERE ELSE.** Every candidate
         * in the list has already passed every rule, so this is a choice among
         * equals and not a search: a `pick` that landed on a candidate the law
         * would refuse would be an element that spent a draw to fail.
         */
        return placementOf(rng.pick(out.candidates), out.candidates.length);
    },
    assertPlacement: assertKillGatePlacement,
});
