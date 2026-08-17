/**
 * procgenCore/elements/blockPocket — **THE BLOCK POCKET**, the arc's second
 * `on-connector` element (PROCGEN ELEMENTS arc 3, slice 4a, D3; design
 * catalogue #2, *block in the way, pocket beyond*).
 *
 * A `pushableblock` standing ON a main-path cut cell, and — where the room is a
 * corridor — a REST POCKET carved beyond it in the push direction, so that the
 * shove which clears the way has somewhere to put the block. Slice 2 named this
 * as the missing half of `wall-gap-block` in one sentence (§9.11): *"a span-1
 * block in a 1-wide corridor is shoved to the next bend and SEALS it — the
 * census says the cut anchors are there (170 on `winding`), and the sweep says
 * the solver cannot use them."*
 *
 * ── ⛓⛓⛓ TWO FORMS, AND WHICH ONE IS DECIDED BY WHETHER THE WALL GREW ──
 *
 * The door cell and its wall come from `roomDoor` exactly as the kill gate's do
 * — same picker, same growth, same `DOOR_GOAL_MIN`. What the wall's LENGTH then
 * says is which kind of room this is, and the two forms differ in kind rather
 * than in degree (the same split `wall-gap-spinner-killlock` writes out for
 * `span 1` vs `span 2..8`):
 *
 *   **THE WALL FORM** (the wall grew >= 1 cell — a room with AREA; on the open
 *   10x10 room it grows the full 7 and the result IS `wall-gap-block(span=8)`'s
 *   shape). The block stands in the gap of a wall that cuts the room, and the
 *   rest is a cell of the open room BEYOND the gap. ⚠ **NOT the cell one step
 *   past the gap** — see `restFor`: a block there PLUGS the only opening, which
 *   D4's census refused on all eight `empty` seeds before the rule was unified.
 *
 *   **THE CORRIDOR FORM** (the wall grew 0 cells — the path cell is the cut all
 *   by itself). The block is IN the corridor, so no cell of the corridor is a
 *   rest at all. The element walks the straight run `D+d, D+2d, …` while the
 *   room is floor and CARVES the first non-floor cell `W` — the bend — so the
 *   block ends OFF the corridor's turn and the way is really clear.
 *
 * ⛓ **ONE WALK SERVES BOTH**: it takes the FIRST cell along the push at which
 * the room reconnects, which is `k = 2` in an open room and the carved bend in
 * a corridor. The forms differ in what they FIND, not in what they ask.
 *
 * ── ⛓ WHERE THE BLOCK ACTUALLY STOPS IS THE **SOLVER'S** CHOICE ───────
 *
 * ⛔ This element does not predict the shove, it GUARANTEES one. `deriveShove`
 * scans for the minimum `k` at which a corridor to its aim appears and takes the
 * first that works, so on the open room `k = 1` already clears the gap and in a
 * corridor nothing short of the pocket does. Measured before any of this was
 * designed (`procgenShoveDistance.test.js`, D3's gate): the existing `shove`
 * pushes a block 2, 3 and 4 cells down a hand-drawn corridor into the carved
 * pocket, one record each, `to` exactly the pocket.
 *
 * ⛓ AND THAT IS WHY THE JUNCTION RULE IS NOT REDUNDANT WITH THE CUT LAW. Every
 * cell of the run must have EXACTLY TWO floor neighbours — a corridor cell. The
 * cut law already refuses a door the walk can go round, so the junction rule is
 * not what makes the room solvable; what it buys is that in a pure corridor the
 * ONLY resting place that clears the way is the pocket, so the guarantee this
 * element makes at `W` is the guarantee at every `k` the solver could pick.
 * ⚠ It is a CORRIDOR-FORM rule and must not be asked of the wall form, where
 * every interior cell of an open room has three or four floor neighbours and
 * the rule would refuse `empty` outright.
 */

import { defineElement } from '../elements.js';
import {
    DOOR_GOAL_MIN, cellKey, doorCandidates, floorNeighboursAfter, growWall, inInterior,
    manhattan, tilesFor, writesOf,
} from './roomDoor.js';

/** The id the BINDING looks up — the block that stands in the way. */
export const BLOCK_ID = 'blockpocket_block';

/** Every refusal this element can produce, BY NAME — what the census counts. */
export const BLOCK_POCKET_REFUSALS = Object.freeze([
    'no-cut-cell', 'goal-too-close', 'wall-does-not-seal', 'no-pocket',
    'the-run-reaches-the-goal', 'the-run-reaches-a-junction', 'the-run-reaches-the-ring',
    'pocket-not-legal',
]);

/**
 * The rest the block is GUARANTEED — `{cell, carved, run}` or `{refused}`.
 *
 * ⛔ THE PUSH DIRECTION IS `cell - before`: the direction the player is
 * travelling when they reach the block, which is the only direction they can
 * push it. On a straight cell that is also `after - cell`; on a BEND it is not,
 * and there the continuation is usually wall — `no-pocket`, by the geometry
 * rather than by a special case.
 *
 * ⛓⛓⛓ **THE REST IS THE FIRST `k` AT WHICH THE ROOM RECONNECTS**, which is
 * `deriveShove`'s own question asked at the picker, and it is ONE rule for both
 * forms. ⛔ THE FIRST CUT OF THIS FUNCTION HAD A SEPARATE WALL-FORM ARM that
 * rested the block at `D+d` because *"the room beyond the gap is open"* — and
 * D4's census refused **43 of 120 placements** with `the-block-would-seal-the-
 * room`, all eight `empty` seeds among them. The reason is obvious once
 * measured and invisible before: a block one cell past the gap of a full-span
 * wall **plugs the only opening**, so the wall form needs `k = 2`, not `k = 1`.
 * The unified walk finds that by asking rather than by arguing.
 * [[feedback_two_rulings_may_not_compose]]
 */
function restFor(room, cand, wall, tilesOf) {
    const dx = cand.cell.x - cand.before.x;
    const dy = cand.cell.y - cand.before.y;
    const wallKeys = new Set(wall.map((c) => cellKey(c.x, c.y)));
    const first = { x: cand.cell.x + dx, y: cand.cell.y + dy };
    if (!room.floorAt(first.x, first.y) || wallKeys.has(cellKey(first.x, first.y))) {
        return { refused: 'no-pocket' };
    }
    /**
     * ⛔ THE JUNCTION RULE IS THE CORRIDOR FORM'S ALONE. Every interior cell of
     * an open room has three or four floor neighbours, so asking it of the wall
     * form would refuse `empty` outright. What it buys where it applies: in a
     * pure corridor the ONLY resting place that clears the way is the pocket, so
     * the guarantee this element makes at `W` is the guarantee at every `k` the
     * solver could pick.
     */
    const corridorForm = wall.length === 0;
    const writes = writesOf(tilesOf([]));
    const run = [];
    let at = first;
    for (;;) {
        if (!room.floorAt(at.x, at.y) || wallKeys.has(cellKey(at.x, at.y))) break;
        if (at.x === room.goal.x && at.y === room.goal.y) {
            return { refused: 'the-run-reaches-the-goal' };
        }
        if (corridorForm && floorNeighboursAfter(room, writes, at.x, at.y) !== 2) {
            return { refused: 'the-run-reaches-a-junction' };
        }
        /** ⛓ THE FIRST `k` THAT WORKS WINS — nearest first, which is the order
         *  `deriveShove` scans in, so the element's guarantee and the solver's
         *  search are looking for the same cell. */
        if (manhattan(at, room.goal) >= DOOR_GOAL_MIN
            && room.connectedWith({ paint: tilesOf([]), walled: [at] })) {
            return { cell: at, carved: false, run: [...run, at] };
        }
        run.push(at);
        at = { x: at.x + dx, y: at.y + dy };
        if (run.length > room.width + room.height) return { refused: 'the-run-reaches-the-ring' };
    }
    if (!inInterior(room, at.x, at.y)) return { refused: 'the-run-reaches-the-ring' };
    const carvedWrites = writesOf(tilesOf([at]));
    if (floorNeighboursAfter(room, carvedWrites, at.x, at.y) !== 1) {
        return { refused: 'pocket-not-legal' };
    }
    return { cell: at, carved: true, run };
}

const STAGES = Object.freeze(['goal-too-close', 'no-pocket', 'the-run-reaches-the-goal',
    'the-run-reaches-a-junction', 'the-run-reaches-the-ring', 'pocket-not-legal',
    'wall-does-not-seal']);
const deepest = (seen) => STAGES.filter((s) => seen.has(s)).pop() ?? 'no-cut-cell';

/**
 * The element's internals, exported so the straight-run walk is testable
 * without a stream.
 *
 * @returns {{candidates}|{refused:{reason, detail}}}
 */
export function buildBlockPocket(room) {
    const seen = new Set();
    const ok = [];
    for (const cand of doorCandidates(room)) {
        if (cand.goalDistance < DOOR_GOAL_MIN) { seen.add('goal-too-close'); continue; }
        const wall = growWall(room, cand.cell, cand.wallAxis);
        const tilesOf = (carve) => tilesFor(wall, carve);
        const rest = restFor(room, cand, wall, tilesOf);
        if (rest.refused) { seen.add(rest.refused); continue; }
        if (manhattan(rest.cell, room.goal) < DOOR_GOAL_MIN) {
            seen.add('the-run-reaches-the-goal');
            continue;
        }
        const tiles = tilesOf(rest.carved ? [rest.cell] : []);
        /**
         * ⛔ `clearer` IS EMPTY, and that is `wall-gap-block`'s own reason: the
         * BLOCK stands IN the door cell, so there is no separate thing to
         * reach. Clause 2 of the law asks whether the CLEARER is start-side and
         * this family's clearer is the door.
         */
        if (room.doorLaw({ paint: tiles, doorCells: [cand.cell], clearer: [] })) {
            seen.add('wall-does-not-seal');
            continue;
        }
        /**
         * ⛓⛓ **THE ROOM STILL WORKS WITH THE BLOCK AT REST — AND THAT CHECK
         * MOVED INTO THE WALK, WHERE IT SELECTS INSTEAD OF REJECTING.** The
         * first cut asked it HERE, as a refusal (`the-block-would-seal-the-
         * room`), and D4's census refused 43 of 120 placements on it. The
         * question was right and the place was wrong: the block's rest is not
         * one cell the element must accept or refuse, it is the FIRST cell along
         * the push at which the room reconnects — which is what `restFor` now
         * returns. ⛔ So the refusal name is GONE rather than kept as a bound
         * nothing can reach (trap 355), and the guarantee is stronger: the walk
         * cannot return a sealing rest at all.
         */
        ok.push(Object.freeze({ cand, wall: Object.freeze(wall), rest, tiles }));
    }
    if (ok.length === 0) {
        const reason = deepest(seen);
        return { refused: { reason,
            detail: `no cell of the ${room.mainPath.length}-cell main path can carry a block `
                + `pocket: ${doorCandidates(room).length} interior path cell(s) tried, the `
                + `deepest stage any reached was "${reason}". ⛓ Two forms: where the wall GROWS `
                + 'the block stands in its gap and one cell of open room is enough; where it '
                + 'grows nothing the block is IN the corridor and the run must end at a bend '
                + 'that can be carved as a dead end.' } };
    }
    return { candidates: Object.freeze(ok) };
}

function placementOf(pick, count) {
    return {
        tiles: pick.tiles,
        entities: {
            blocks: [{ x: pick.cand.cell.x, y: pick.cand.cell.y }],
            buttons: [],
            obstacles: [],
            items: [],
        },
        doorCells: [{ x: pick.cand.cell.x, y: pick.cand.cell.y }],
        clearer: [],
        demand: [],
        area: null,
        symbols: { holds: [], grants: [] },
        cost: {
            wall: pick.wall.length,
            carved: pick.rest.carved ? 1 : 0,
            push: pick.rest.run.length + (pick.rest.carved ? 1 : 0),
            candidates: count,
            goalDistance: pick.cand.goalDistance,
        },
    };
}

function assertBlockPocketPlacement(placement, { fail }) {
    const { blocks, buttons, obstacles, items } = placement.entities;
    if (blocks.length !== 1 || buttons.length || obstacles.length || items.length) {
        fail('blockPocket: the element is exactly ONE block and nothing else — got '
            + `${blocks.length}/${buttons.length}/${obstacles.length}/${items.length}.`);
    }
    if (placement.doorCells.length !== 1
        || placement.doorCells[0].x !== blocks[0].x || placement.doorCells[0].y !== blocks[0].y) {
        fail('blockPocket: `doorCells` must be exactly the block\'s own cell — the block IS '
            + 'the door (`wall-gap-block`\'s own rule), which is also why `clearer` is empty.');
    }
    if (placement.clearer.length !== 0) {
        fail('blockPocket: `clearer` must be EMPTY. The thing that opens this door is the '
            + 'door: there is no separate opener to demand a route to.');
    }
    if (placement.cost.push < 1) {
        fail(`blockPocket: cost.push is ${placement.cost.push}. A block with nowhere to go is `
            + 'a wall the player cannot open, and the element must refuse `no-pocket` instead '
            + 'of placing one.');
    }
}

export const BLOCK_POCKET = defineElement({
    name: 'block-pocket',
    family: 'blockpocket',
    phase: 'on-connector',
    why: 'A `pushableblock` on a main-path cut with a REST POCKET carved beyond it in the '
        + 'push direction, so the shove that clears the corridor has somewhere to put the '
        + 'block. ⛓ It is design catalogue #2 and the half `wall-gap-block` was missing on a '
        + 'carved room (arc-3 §9.11): the census had the cut anchors and the sweep could not '
        + 'use them, because a block shoved to the next bend SEALED it.',
    params: [],
    construct(values, site, rng) {
        const out = buildBlockPocket(site.room);
        if (out.refused) return out;
        /** ⛓ THE ONE DRAW — a choice among candidates that have all already
         *  passed every rule. See `killGate`'s own line; the two elements spend
         *  the same single draw for the same reason. */
        return placementOf(rng.pick(out.candidates), out.candidates.length);
    },
    assertPlacement: assertBlockPocketPlacement,
});
