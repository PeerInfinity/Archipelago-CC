/**
 * procgenCore/elements/baitGate — **THE BAIT GATE**, the generator's gadget for
 * the solver's `bait` RUNG (seedling gen baitgate; ⚖ the user 2026-11-04, "(1)
 * Bait gadget", the last of "(b) More strategy elements"). The vanilla model is
 * L6: a chaser stands where the walk must pass, and the room's own water kills
 * it once the player stands where its straight-line chase crosses the water.
 *
 * A live CHASER (on Seedling a `bob`: speed 0.5, chase range 80, wall-bound,
 * drowns in water) stands ON a main-path CUT (the rock gate's door: `roomDoor`'s
 * candidates, its grown wall, `DOOR_GOAL_MIN`, the door law), and ONE WATER
 * cell — the LURE — stands on the start side beside the door's approach. The
 * player cannot pass the body pre-sword (no strike, and the oracle refuses a
 * contact), so the solver's ladder reaches `bait`: a stance whose line from the
 * body crosses the lure, a dwell, and the body drowns (`solverBot.deriveBaitStance`).
 *
 * ⛓ NO SOLVER BEHAVIOUR IS NEW. The bait rung, its forecast and the drowning are
 * the shipped model's; this element only places what L6 already has.
 *
 * ── THE RULES, EACH ONE A NAMED REFUSAL ───────────────────────────────
 *
 *  1. THE DOOR CELL is an interior cell of the main path at least
 *     `DOOR_GOAL_MIN` from the goal — else `goal-too-close`.
 *  2. THE DOOR LAW: with its grown wall the door is a CUT — else
 *     `wall-does-not-seal`.
 *  3. THE LURE SITE (`lureSites`), one cell `W` on the start side once the door
 *     and wall are solid, at the first of `LURE_OFFSETS` (from the door's
 *     start-side neighbour: never level with it, measured) that offers one:
 *       · interior, not on the main path, not the start or the goal;
 *       · with `W` impassable the start still reaches the door's start side (the
 *         lure blocks no route: pre-swim, water is a wall to the player);
 *       · every floor neighbour of `W` is on the start side, so a swimmer crossing
 *         `W` never bridges the cut (the lure is never a second door);
 *       · at least one STANCE (`lureStances`): start-side floor within the body's
 *         leash whose straight line from the body reaches `W` before any wall.
 *     Else `no-lure-site`. The element also OWNS the start-side floor inside the
 *     leash (`clear`), so pass 2 lays no second kill region beside the body.
 *  4. ONE DRAW: `rng.pick` over every (door, lure) pair that passed, in path order.
 */

import { LAW_CUT, defineElement } from '../elements.js';
import { reachableFrom } from '../gridFlood.js';
import {
    DOOR_GOAL_MIN, NB4, TILE_FLOOR, cellKey, doorCandidates, growWall, inInterior, manhattan, tilesFor,
} from './roomDoor.js';

/** The ids the BINDING looks up: the body (a `bob`) and the lure (one `water` cell, terrain). */
export const BAIT_GATE_BODY_ID = 'baitgate_body';
export const BAIT_GATE_LURE_ID = 'baitgate_lure';

/** ⛓ EVERY REFUSAL THIS FILE CAN PRODUCE, BY NAME, in the order the stages run. */
export const BAIT_GATE_REFUSALS = Object.freeze([
    'no-cut-cell', 'goal-too-close', 'wall-does-not-seal', 'no-lure-site',
]);

const STAGES = Object.freeze(['goal-too-close', 'wall-does-not-seal', 'no-lure-site']);

/**
 * ⛓⛓⛓ **WHERE THE LURE MAY STAND, MEASURED** — offsets from the door's start-side neighbour `B`, in (cells
 * AWAY from the door, cells ACROSS the approach) units, tried in this order; the first offset that yields a site
 * for a door is that door's only offset (the rest are fallbacks, not extra draws).
 *
 * ⛔ NOT `(0, 1)` — the lure LEVEL with `B`, beside the approach — and that is the measurement this table rests
 * on. With bait OFF the ladder's DETOUR rung walks a bent path (≤ 2 vias, no wait at a via) and the chasing body
 * follows the player sideways; a lure beside the approach is exactly where that sideways pull drags it, so the
 * detour drowns it and the room solves without `bait` (⚖ hammer-2, 2026-11-04: a LEGITIMATE different
 * solution, the game drowns a chaser that follows you into water). Measured on the 60-cell pre-sword battery
 * (empty/open/branchy/winding/rooms × 10/14 × seeds 1–6): `(0,1)` left the detour solving most certified rooms;
 * one cell or more AWAY from the door the bait's DWELL (the body walks its whole straight line while the player
 * stands) is what reaches the water, and a passing walk mostly does not.
 */
export const LURE_OFFSETS = Object.freeze([
    Object.freeze([1, 1]), Object.freeze([2, 1]), Object.freeze([1, 2]), Object.freeze([2, 2]),
]);

/**
 * The lure sites one door candidate offers, in a fixed order. Each is `{lure, carved: [cells], stances, clear}`;
 * a lure on skeleton wall is a CARVE (written floor, painted water by the binding), and `clear` is the start-side
 * floor inside the body's leash the element OWNS (written as the floor it already is) so pass 2 cannot lay a
 * second kill region there — measured: pass-2 pits and water beside the door were what the bait-OFF detour drowned
 * or dropped the body in on seeds 1 and 3 of the default room.
 */
export function lureSites(room, cand, wall) {
    const shut = new Set([cellKey(cand.cell.x, cand.cell.y), ...wall.map((c) => cellKey(c.x, c.y))]);
    const onPath = new Set(room.mainPath.map((c) => cellKey(c.x, c.y)));
    const open = (x, y) => !shut.has(cellKey(x, y)) && room.floorAt(x, y);
    const startSide = reachableFrom(room.width, room.height, open, room.start);
    const same = (a, b) => a.x === b.x && a.y === b.y;
    const B = cand.before;
    const dx = cand.cell.x - B.x;
    const dy = cand.cell.y - B.y;
    /** the two perpendiculars to the approach `B → door` */
    const perps = [[dy, dx], [-dy, -dx]];
    const sites = [];
    for (const [ka, kp] of LURE_OFFSETS) {
        if (sites.length > 0) break;
        for (const [px, py] of perps) {
            const w = Object.freeze({ x: B.x - dx * ka + px * kp, y: B.y - dy * ka + py * kp });
            const k = cellKey(w.x, w.y);
            if (!inInterior(room, w.x, w.y) || shut.has(k) || onPath.has(k)
                || same(w, room.start) || same(w, room.goal)) continue;
            const floor = room.floorAt(w.x, w.y);
            if (floor && !startSide.has(k)) continue;
            /** ⛓ no swimmer bridge: every open neighbour of the lure is start side */
            if (NB4.some(([ex, ey]) => open(w.x + ex, w.y + ey) && !startSide.has(cellKey(w.x + ex, w.y + ey)))) continue;
            /** ⛓ the lure blocks no route: the start still reaches the door's start side with it impassable */
            const reach = reachableFrom(room.width, room.height,
                (x, y) => open(x, y) && cellKey(x, y) !== k, room.start);
            if (!reach.has(cellKey(B.x, B.y))) continue;
            const stances = lureStances(room, cand.cell, w, reach);
            if (stances.length === 0) continue;
            const clear = [];
            for (const rk of reach) {
                const [rx, ry] = rk.split(',').map(Number);
                const c = { x: rx, y: ry };
                if (same(c, room.start) || same(c, room.goal)) continue;
                if (Math.hypot(rx - cand.cell.x, ry - cand.cell.y) <= BAIT_LEASH_CELLS) clear.push(Object.freeze(c));
            }
            sites.push(Object.freeze({ lure: w, carved: Object.freeze(floor ? [] : [w]), stances: stances.length,
                clear: Object.freeze(clear) }));
        }
    }
    return sites;
}

/**
 * ⛓ THE BAIT LEASH IN CELLS — `combat.ENEMY_CLASSES.bob.aggro.range` (80 px) over the 16 px tile. A stance
 * farther than this from the body never wakes it, so it baits nothing.
 */
export const BAIT_LEASH_CELLS = 5;

/**
 * ⛓⛓ THE STANCES A LURE OFFERS — start-side floor cells (the lure impassable: `reach`) within
 * `BAIT_LEASH_CELLS` of the body whose straight line from the body's cell centre runs through the LURE before
 * it meets any wall. The body chases on that line and is wall-bound, so a line that meets a wall first pins it;
 * one that reaches the lure drowns it. A lure with NO such stance is no lure (measured: a door against the
 * room's edge put every crossing stance outside the room, and the certification solve refused).
 */
export function lureStances(room, body, lure, reach) {
    const out = [];
    const bx = body.x + 0.5;
    const by = body.y + 0.5;
    for (const k of reach) {
        const [sx, sy] = k.split(',').map(Number);
        if (Math.hypot(sx - body.x, sy - body.y) > BAIT_LEASH_CELLS) continue;
        const ex = sx + 0.5;
        const ey = sy + 0.5;
        const len = Math.hypot(ex - bx, ey - by);
        const steps = Math.max(1, Math.ceil(len * 8));
        let crossed = false;
        for (let i = 1; i <= steps; i += 1) {
            const cx = Math.floor(bx + ((ex - bx) * i) / steps);
            const cy = Math.floor(by + ((ey - by) * i) / steps);
            if (cx === lure.x && cy === lure.y) { crossed = true; break; }
            if (cx === body.x && cy === body.y) continue;
            if (!room.floorAt(cx, cy)) break;
        }
        if (crossed) out.push(Object.freeze({ x: sx, y: sy }));
    }
    return out;
}

/**
 * The shared search, exported so the geometry is testable without a stream.
 *
 * @param {object} room the `elements.assertRoomProbe` probe
 * @returns {{candidates}|{refused:{reason, detail}}}
 */
export function buildBaitGate(room) {
    const seen = new Set();
    const ok = [];
    for (const cand of doorCandidates(room)) {
        if (cand.goalDistance < DOOR_GOAL_MIN) { seen.add('goal-too-close'); continue; }
        const wall = growWall(room, cand.cell, cand.wallAxis);
        const tiles = tilesFor(wall);
        if (room.doorLaw({ paint: tiles, doorCells: [cand.cell], clearer: [cand.before] })) {
            seen.add('wall-does-not-seal');
            continue;
        }
        const sites = lureSites(room, cand, wall);
        if (sites.length === 0) { seen.add('no-lure-site'); continue; }
        for (const site of sites) ok.push(Object.freeze({ cand, wall: Object.freeze(wall), site }));
    }
    if (ok.length === 0) {
        const reason = STAGES.filter((s) => seen.has(s)).pop() ?? 'no-cut-cell';
        return { refused: { reason,
            detail: `no cell of the ${room.mainPath.length}-cell main path can carry a BAIT GATE: `
                + `${doorCandidates(room).length} interior path cell(s) tried, the deepest stage any reached was `
                + `"${reason}". ⛓ The body stands on the cut; the lure is one water cell on the start side beside `
                + 'the door\'s approach, off the main path, blocking no route and bridging nothing for a swimmer.' } };
    }
    return { candidates: Object.freeze(ok) };
}

/** One chosen candidate → the contract's placement. Absolute cells throughout. */
function placementOf(pick, count) {
    const { cand, wall, site } = pick;
    return {
        tiles: [
            ...tilesFor(wall),
            /** ⛓ OWNED, written as FLOOR (a carve where the skeleton had wall); the binding paints it water. */
            { x: site.lure.x, y: site.lure.y, tile: TILE_FLOOR },
            ...site.clear.map((c) => ({ x: c.x, y: c.y, tile: TILE_FLOOR })),
        ],
        entities: {
            blocks: [],
            buttons: [],
            obstacles: [
                { x: cand.cell.x, y: cand.cell.y, id: BAIT_GATE_BODY_ID },
                { x: site.lure.x, y: site.lure.y, id: BAIT_GATE_LURE_ID },
            ],
            items: [],
        },
        doorCells: [{ x: cand.cell.x, y: cand.cell.y }],
        clearer: [{ x: cand.before.x, y: cand.before.y }],
        demand: [],
        area: null,
        symbols: { holds: [], grants: [] },
        cost: {
            wall: wall.length,
            carved: site.carved.length,
            candidates: count,
            goalDistance: cand.goalDistance,
            lureDistance: manhattan(site.lure, cand.cell),
        },
    };
}

/** The placement shape: the BODY on the door cell, then its LURE, off the door. */
export function assertBaitGatePlacement(placement, { fail }) {
    const { obstacles, blocks } = placement.entities;
    const ids = obstacles.map((o) => o.id);
    if (obstacles.length !== 2 || ids[0] !== BAIT_GATE_BODY_ID || ids[1] !== BAIT_GATE_LURE_ID) {
        fail(`baitGate: the gate is exactly a BODY then its LURE (${BAIT_GATE_BODY_ID}, ${BAIT_GATE_LURE_ID}) — `
            + `got ${JSON.stringify(ids)}.`);
        return;
    }
    if (blocks.length !== 0) fail('baitGate: a bait gate has NO block.');
    const [body, lure] = obstacles;
    if (placement.doorCells.length !== 1
        || placement.doorCells[0].x !== body.x || placement.doorCells[0].y !== body.y) {
        fail('baitGate: `doorCells` must be exactly the body\'s own cell.');
    }
    if (manhattan(body, lure) < 1 || (body.x === lure.x && body.y === lure.y)) {
        fail(`baitGate: the lure (${lure.x},${lure.y}) may not be the body's cell.`);
    }
    if (placement.clearer.length !== 1) {
        fail('baitGate: `clearer` must be exactly ONE cell — the door\'s start-side neighbour.');
    }
}

export const BAIT_GATE = defineElement({
    name: 'bait-gate',
    family: 'baitgate',
    phase: 'on-connector',
    law: LAW_CUT,
    why: 'A live CHASER on a main-path CUT, its wall grown to seal the room, and ONE WATER cell (the lure) '
        + 'on the start side beside the door\'s approach — on Seedling a `bob`, which drowns when its '
        + 'straight-line chase crosses the water. The solver\'s `bait` rung (the L6 pattern): stand where the '
        + 'chase crosses the lure, and wait.',
    params: [],
    construct: (values, site, rng) => {
        const out = buildBaitGate(site.room);
        if (out.refused) return out;
        /** ⛓ THE ONE DRAW — every candidate already passed every rule. */
        return placementOf(rng.pick(out.candidates), out.candidates.length);
    },
    assertPlacement: assertBaitGatePlacement,
});
