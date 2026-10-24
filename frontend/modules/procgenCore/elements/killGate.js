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
    DOOR_GOAL_MIN, bodyRegion, cellKey, doorCandidates, growWall, pocketFor, tilesFor, writesOf,
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

/**
 * Every refusal this element can produce, BY NAME — what the census counts.
 *
 * ⛓⛓ **ITS AXIS IS THE ELEMENT, NOT THIS FILE** (arc 5, slice 5). `no-pocket`
 * and `pocket-not-legal` are raised by `roomDoor.pocketFor`, which moved there
 * when the SHORTCUT element needed the same search: two copies of *where does
 * the opener go* would be two answers, and the day they disagreed one element
 * would place where the other refused. ⇒ the reference's refusal table declares
 * this source `spansModules`, and `roomDoor.js` is scanned so the names are
 * found FIRING rather than reported as dead.
 */
export const KILL_GATE_REFUSALS = Object.freeze([
    'no-cut-cell', 'goal-too-close', 'wall-does-not-seal', 'no-pocket', 'pocket-not-legal',
]);

/**
 * ⛓ The refusal a run of candidates deserves: the DEEPEST stage any reached.
 * ⛔ THE ORDER IS THE PIPELINE'S OWN, and the first cut had it wrong: the
 * pocket is searched BEFORE the law is asked, so a room where every candidate
 * found a pocket and every wall failed to cut would have been reported as
 * `pocket-not-legal`. A "deepest stage" list that does not match the order the
 * stages run in names the wrong one.
 */
const STAGES = Object.freeze(['goal-too-close', 'no-pocket', 'pocket-not-legal',
    'wall-does-not-seal']);
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
        /**
         * ⛓⛓⛓ **THE DEMAND'S GEOMETRY — WHERE THE BODY CAN BE** (slice 4d, D3).
         * The flood from the pocket, over the room this element has just
         * written, with the DOOR CELL SHUT: while the body lives the lock is
         * closed and is `Solid`, so the body is confined to the start side BY
         * CONSTRUCTION — the same fact clause 2 of the door law asserts about
         * the player's reach.
         */
        const body = bodyRegion(room, pocket.cell,
            { writes: writesOf(tiles), walled: [cand.cell] });
        ok.push(Object.freeze({ cand, wall: Object.freeze(wall), pocket, tiles, body }));
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

/**
 * The demand rows for one candidate — see `placementOf`'s `demand` docblock for
 * what they claim. ⛔ Sorted by cell so the placement is a function of the room
 * and not of a `Set`'s insertion order, which a flood's stack order would make
 * it (two rooms that differ only in walk order would ship different `demand`
 * arrays and the payload would move for nothing).
 */
function demandOf(pick) {
    const mine = new Set([
        cellKey(pick.cand.cell.x, pick.cand.cell.y),
        cellKey(pick.pocket.cell.x, pick.pocket.cell.y),
        ...pick.tiles.map((t) => cellKey(t.x, t.y)),
    ]);
    const rows = [];
    for (const [set, must] of [[pick.body.region, 'floor'], [pick.body.boundary, 'wall']]) {
        for (const k of set) {
            if (mine.has(k)) continue;
            const [x, y] = k.split(',').map(Number);
            rows.push({ x, y, must });
        }
    }
    rows.sort((a, b) => (a.y - b.y) || (a.x - b.x) || a.must.localeCompare(b.must));
    return Object.freeze(rows.map((r) => Object.freeze(r)));
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
        /**
         * ⛓⛓⛓ **THE DEMAND — arc 3, slice 4d, D3(ii). MEASURED FIRST.**
         *
         * ⛔ THE PROBLEM IT SOLVES IS NOT HYPOTHETICAL. Over 224 (kind, arm,
         * seed) cells, TEN kill gates placed and certified and all ten had
         * their lock CLEARED — **eight by `sword` and TWO by `water`**. A gate
         * whose spinner drowns in a pool pass 2 painted opens for a reason the
         * level did not pose, and the level's own `require:['hasSword']`
         * differential then grades the sword not required. ⇒ *"the spinner was
         * cut down"* has to be ENSURED, not hoped for.
         *
         * TWO CLAUSES, and the second is what makes the first hold on the level
         * that actually ships:
         *
         *  · every cell of the BODY'S REGION must be `floor` — so pass 2 may
         *    not paint water, a pit, lava or a wall anywhere the body goes;
         *  · every WALL cell touching that region must stay `wall` — pass 2 may
         *    CARVE (⚖ ruling 17), and a carve on the edge would let the body
         *    out of the region this was computed on.
         *
         * ⛓ THE PREDICTOR IS EXACT ON THE MEASURED CORPUS: over the ten
         * certified gates, *lethal terrain inside the BODY'S OWN STEPPED PATH*
         * ⟺ `cause:'water'`, 2 for 2 both ways. The REGION is a superset of
         * that path — over 17 placed gates the stepper put ZERO cells outside
         * it, and 6 of the 10 carved sets were EQUAL — so it is sound. Its
         * size, measured (arc 5, slice 0's W2): **region median 32 `empty` /
         * 13 carved against the 400-tick stepped set's 21 / 13**.
         *
         * ⛔⛔ **AND THE GAP IS A TICK BOUND, NOT AN ERROR** (arc 5, slice 2).
         * 400 is `DEFAULT_BUDGET.maxTicksPerTarget`, the SOLVER's per-target
         * budget; raise it and the stepped set grows into the region and
         * reaches it exactly (seed 29: 25 → 37 → 40 of 40 at 400 → 800 →
         * 1600). A build that demanded only the 400-tick set turned three
         * committed corpus rows into `GenerationAborted` — pass 2 painted
         * water where the body goes after tick 400 and the player drowned
         * walking the kill — while the same build at 4000 ticks reproduced
         * every committed row byte for byte. ⇒ §18.2 C4 is MEASURED AND
         * REFUTED; `bodyRegion`'s docblock carries the table.
         *
         * ⚠ `must:'floor'` FORBIDS A WALL TOO, which is stricter than the drown
         * mechanism needs — a `wall-segment` in the region changes the bounce
         * and kills nothing. It is kept because `floor`/`wall` is the CONTRACT's
         * whole vocabulary and inventing a third word for "not lethal" would
         * make every binding decide what lethal means; the price is on the yield
         * table with everything else.
         *
         * ⛔ THE ELEMENT'S OWN CELLS ARE EXCLUDED, because `assertPlacement
         * Shape` refuses a demand on a cell the element WRITES — *"demanding
         * one's own write is a claim that can never fail"* — and because
         * `elementRefusalAt` already owns the door, the clearer, the wall and
         * the carve.
         */
        demand: demandOf(pick),
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
        /**
         * ⛔⛔ **THE DEMAND'S SIZE IS DELIBERATELY NOT IN `cost`** (arc 3, slice
         * 4d). It belongs there by meaning — it IS what this element costs the
         * room — and putting it there would move the `elements` block of EVERY
         * payload that holds a kill gate, for a number a reader can re-derive
         * from the level and the geometry (`demand.length`, or `roomDoor
         * .bodyRegion` run again). Arc 1's payload rule is that a payload
         * carries what cannot be re-derived; the byte-inertness of every
         * committed kill-gate row is worth more than a convenience field, and
         * the instruments read the MODEL rather than the payload.
         */
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
