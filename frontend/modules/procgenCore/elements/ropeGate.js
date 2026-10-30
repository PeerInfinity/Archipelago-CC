/**
 * procgenCore/elements/ropeGate — **THE ROPE GATE: an ARROW TRAP's lane on a
 * main-path cut, silenced by cutting its ROPE** (seedling gen content A1; the
 * L16 pattern, `Dungeon2_3`'s three `shoot 1` traps and the `rope@32,16` that
 * disarms them).
 *
 * ⚖ The user, 2026-10-28: *"Arrow traps would need to be combined with either
 * a switch or a rope."* and, 2026-10-30, approving the design: the ROPE trap
 * now, the switch trap later, the pre-sword arrow-weapon puzzle not now. This
 * is the `arrow-lane` TEMPLATE's own `wouldNeed` (`procgenPalette`
 * `EXCLUDED_TEMPLATES`, ⚖ design ruling 9) met the way it asked: the trap and
 * its disarmer built TOGETHER, as ONE element.
 *
 * ── THE PARTS ─────────────────────────────────────────────────────────
 *
 *  · THE LANE — the BOTTOM-MOST floor run of one column `x`, `L` = rows
 *    `y0..y1`, wall above `y0` (a run is maximal) and nothing but wall below
 *    `y1` to the level's floor. Its cells are the element's `doorCells`.
 *  · THE TRAP — at the lane's HEAD, `(x, y0)`, an armed-by-default trap. ⛓ An
 *    `ArrowTrap` is not solid (`levelWorld`'s `notSolid` row) and its lane
 *    starts at its own cell's top edge (`arrowTrapEntityPoint`'s `+2` and
 *    `ARROW_TRAP.spawnDY`'s `-2` cancel), so the trap's cell IS the lane's
 *    first cell and the wall above it is out of the lane.
 *  · THE ROPE — one cell `R` on the START side, near the gate, with its node on
 *    its own cell (a one-cell span). ⛓ A rope is `type = "Rope"`, in the
 *    player's solids list, and a CUT rope SHRINKS to one solid cell rather than
 *    despawning (`levelWorld.ropeSpanRect`), so `R` is solid for ever: it must
 *    be a cell no route needs.
 *  · THE STANCE — a floor neighbour of `R` on the start side: where the sword
 *    swing is made from. It is the element's `clearer`.
 *
 * ── THE RULES, EACH ONE A NAMED REFUSAL (design §1.4) ──────────────────
 *
 *  (iii) THE GOAL SIDE IS REACHABLE ONLY THROUGH THE LANE — the binding's own
 *        door law with `doorCells = L` (a CUT, clause 1), asked BEFORE the rope
 *        is looked for — else `the-lane-is-not-a-cut`.
 *  (ii)  ⚠ **THE PRICED LANE RUNS TO THE LEVEL FLOOR, THROUGH WALLS**
 *        (`arrowTrap.arrowLaneRect`; the game's arrows stop at the first
 *        Solid, the danger map's do not). A lane over floor this element does
 *        not own would sever routes it never claimed. ⇒ only the bottom-most
 *        run of a column is offered, and the column's wall cells below it are
 *        OWNED (written as the wall they are) so pass 2 cannot carve floor
 *        into the priced lane. A
 *        column whose bottom-most run holds the start or the goal refuses
 *        `the-lane-holds-the-start-or-the-goal`. ⛔ `arrowLaneRect` and the
 *        danger map are other arcs' files; this is a PLACEMENT rule, not a fix.
 *  (i)   THE ROPE'S STANCE IS REACHABLE FROM THE START WITHOUT CROSSING THE
 *        LANE — with `L` and `R` walled, the stance floods from the start
 *        (else no rope candidate) — and the rope costs no route: with only
 *        `R` walled the start still reaches the goal. A lane with no such
 *        rope cell within `ROPE_NEAR_GATE` steps of the gate falls back to a
 *        CARVED one-mouth pocket off the gate's entry cell; with neither it
 *        refuses `no-rope-cell`.
 *  ·     THE GATE IS NOT ON THE GOAL'S DOORSTEP — every lane cell at least
 *        `DOOR_GOAL_MIN` from the goal (`goal-too-close`), the door elements'
 *        own clause.
 *
 * ONE DRAW: `rng.pick` over every (lane, rope) pair that passed, in column
 * then rope order.
 *
 * ⛔ NOTHING HERE KNOWS A SUBSTRATE: `arrowtrap`, `rope`, `tset` and `tag` are
 * the binding's words (`procgenSeedlingElements.seedlingOnConnectorEntities`).
 * This file says *trap*, *rope*, *lane*.
 */

import { LAW_CUT, defineElement } from '../elements.js';
import { distancesFrom, reachableFrom } from '../gridFlood.js';
import {
    DOOR_GOAL_MIN, NB4, TILE_FLOOR, TILE_WALL, cellKey, inInterior, manhattan,
} from './roomDoor.js';

/** The ids the BINDING looks up — the trap, and the rope that disarms it. */
export const ROPE_GATE_TRAP_ID = 'ropegate_trap';
export const ROPE_GATE_ROPE_ID = 'ropegate_rope';

/**
 * ⛓ HOW FAR FROM THE GATE THE ROPE MAY HANG — steps from the start-side cell
 * that enters the lane, with the lane walled. ⛔ A DESIGN CHOICE, not a
 * measurement: the rope reads as the gate's own disarmer when it is beside the
 * gate, and a rope across the room would make the certification walk a detour
 * the room does not explain.
 */
export const ROPE_NEAR_GATE = 3;

/** ⛓ EVERY REFUSAL THIS FILE CAN PRODUCE, BY NAME, in the order the stages run. */
export const ROPE_GATE_REFUSALS = Object.freeze([
    'no-lane-cell', 'the-lane-holds-the-start-or-the-goal', 'goal-too-close',
    'the-lane-is-not-a-cut', 'no-rope-cell',
]);

/**
 * The lane a column offers: its BOTTOM-MOST floor run, with the wall cells
 * below it to the level's floor. `null` for a column with no floor.
 */
export function laneOfColumn(room, x) {
    let y1 = -1;
    for (let y = room.height - 1; y >= 0; y -= 1) {
        if (room.floorAt(x, y)) { y1 = y; break; }
    }
    if (y1 < 0) return null;
    let y0 = y1;
    while (y0 - 1 >= 0 && room.floorAt(x, y0 - 1)) y0 -= 1;
    const cells = [];
    for (let y = y0; y <= y1; y += 1) cells.push(Object.freeze({ x, y }));
    const below = [];
    for (let y = y1 + 1; y < room.height; y += 1) below.push(Object.freeze({ x, y }));
    return Object.freeze({ x, cells: Object.freeze(cells), below: Object.freeze(below),
        ringY: room.height - 1 });
}

/**
 * The shared search, exported so the geometry is testable without a stream.
 *
 * @param {object} room the `elements.assertRoomProbe` probe
 * @returns {{candidates}|{refused:{reason, detail}}}
 */
export function buildRopeGate(room) {
    const seen = new Set();
    const ok = [];
    const isStart = (c) => c.x === room.start.x && c.y === room.start.y;
    const isGoal = (c) => c.x === room.goal.x && c.y === room.goal.y;
    /** ⛔ A lane the main path never enters is not a gate on this room: offered
     *  columns are the ones the canonical path crosses, in path order. */
    const columns = [...new Set(room.mainPath.map((c) => c.x))];
    for (const x of columns) {
        const lane = laneOfColumn(room, x);
        if (!lane) continue;
        if (lane.cells.some((c) => isStart(c) || isGoal(c))) {
            seen.add('the-lane-holds-the-start-or-the-goal');
            continue;
        }
        if (lane.cells.some((c) => manhattan(c, room.goal) < DOOR_GOAL_MIN)) {
            seen.add('goal-too-close');
            continue;
        }
        const laneKeys = new Set(lane.cells.map((c) => cellKey(c.x, c.y)));
        /** ⛓ (iii) — the binding's door law, with no stance yet (clause 2 is
         *  asked again at the commit, with the stance). */
        if (room.doorLaw({ paint: [], doorCells: lane.cells, clearer: [] })) {
            seen.add('the-lane-is-not-a-cut');
            continue;
        }
        /** The start-side cell that ENTERS the lane: the main path's cell just
         *  before its first lane cell. */
        const entry = room.mainPath.find((c, i) => !laneKeys.has(cellKey(c.x, c.y))
            && i + 1 < room.mainPath.length
            && laneKeys.has(cellKey(room.mainPath[i + 1].x, room.mainPath[i + 1].y)));
        const offLane = (x2, y2) => !laneKeys.has(cellKey(x2, y2)) && room.floorAt(x2, y2);
        const near = entry ? distancesFrom(room.width, room.height, offLane, entry) : new Map();
        let ropes = 0;
        for (const [k, dist] of [...near].sort(([a], [b]) => {
            const [ax, ay] = a.split(',').map(Number);
            const [bx, by] = b.split(',').map(Number);
            return (ay - by) || (ax - bx);
        })) {
            if (dist > ROPE_NEAR_GATE) continue;
            const [rx, ry] = k.split(',').map(Number);
            const rope = Object.freeze({ x: rx, y: ry });
            if (isStart(rope) || isGoal(rope)) continue;
            /** ⛓ (i), the rope half — a solid rope cell costs no route. */
            if (!room.connectedWith({ walled: [rope] })) continue;
            /** ⛓ (i), the stance half — a floor neighbour of the rope the START
             *  reaches with the lane AND the rope walled. */
            const startSide = reachableFrom(room.width, room.height,
                (x2, y2) => offLane(x2, y2) && !(x2 === rx && y2 === ry), room.start);
            const stance = NB4.map(([dx, dy]) => ({ x: rx + dx, y: ry + dy }))
                .find((c) => startSide.has(cellKey(c.x, c.y)));
            if (!stance) continue;
            ropes += 1;
            ok.push(Object.freeze({
                lane,
                rope,
                stance: Object.freeze(stance),
                ropeDistance: dist,
                carved: false,
                goalDistance: Math.min(...lane.cells.map((c) => manhattan(c, room.goal))),
            }));
        }
        /**
         * ⛓ THE POCKET FALLBACK — a lane whose start side has no spare floor (a
         * `winding` corridor: every cell is the route, so a solid rope on any of
         * them is a wall across it; measured, `no-rope-cell` on 2/2 seeds). The
         * rope goes into a CARVED dead end off the gate's entry cell instead:
         * a wall neighbour of `entry` whose only floor neighbour after the carve
         * is `entry` (the kill gate's pocket rule, `roomDoor.pocketFor`, one
         * element over). The binding's carve law adjudicates it in full.
         */
        if (ropes === 0 && entry) {
            for (const [dx, dy] of NB4) {
                const c = { x: entry.x + dx, y: entry.y + dy };
                if (!inInterior(room, c.x, c.y) || room.floorAt(c.x, c.y)) continue;
                if (c.x === x) continue;
                const floorNbrs = NB4.filter(([ex, ey]) => room.floorAt(c.x + ex, c.y + ey));
                if (floorNbrs.length !== 1) continue;
                ropes += 1;
                ok.push(Object.freeze({
                    lane,
                    rope: Object.freeze(c),
                    stance: Object.freeze({ x: entry.x, y: entry.y }),
                    ropeDistance: 1,
                    carved: true,
                    goalDistance: Math.min(...lane.cells.map((l) => manhattan(l, room.goal))),
                }));
                break;
            }
        }
        if (ropes === 0) seen.add('no-rope-cell');
    }
    if (ok.length === 0) {
        const reason = ROPE_GATE_REFUSALS.filter((s) => seen.has(s)).pop() ?? 'no-lane-cell';
        return { refused: { reason,
            detail: `no column the ${room.mainPath.length}-cell main path crosses can carry a `
                + `ROPE GATE: ${columns.length} column(s) tried, the deepest stage any reached `
                + `was "${reason}". ⛓ A lane is a column's BOTTOM-MOST floor run, because the `
                + 'danger map prices a lane to the level\'s floor through walls '
                + '(`arrowLaneRect`); its rope hangs within '
                + `${ROPE_NEAR_GATE} step(s) of the gate on the start side.` } };
    }
    return { candidates: Object.freeze(ok) };
}

/** One chosen candidate → the contract's placement. Absolute cells throughout. */
function placementOf(pick, count) {
    const [head] = pick.lane.cells;
    return {
        /**
         * ⛓ WHAT THE ELEMENT OWNS BEYOND ITS DOOR AND STANCE, written as the
         * terrain each cell ALREADY is (so nothing is grown and nothing carved):
         *  · the rope's cell, as FLOOR — pass 2 can neither stand a body on the
         *    rope nor paint under it (a CARVE when it is the pocket fallback);
         *  · (ii) the priced lane BELOW the run, as WALL, to the ring — a pass-2
         *    carve there would put floor in a lane this element does not own.
         * ⛔ OWNED, NOT DEMANDED: a `wall` demand is asserted to SURVIVE the
         * `shell` strip (`procgenSeedling.shellLevel`, a kill gate's walls keep
         * its body in), and a lane wall deep in wall mass is rightly dropped by
         * it — an absent cell nobody reaches costs the lane nothing. Measured:
         * the demand spelling threw on `rooms` seed 1 at `--fill=shell`.
         */
        tiles: [
            { x: pick.rope.x, y: pick.rope.y, tile: TILE_FLOOR },
            ...pick.lane.below.filter((c) => c.y < pick.lane.ringY)
                .map((c) => ({ x: c.x, y: c.y, tile: TILE_WALL })),
        ],
        entities: {
            blocks: [],
            buttons: [],
            obstacles: [
                { x: head.x, y: head.y, id: ROPE_GATE_TRAP_ID },
                { x: pick.rope.x, y: pick.rope.y, id: ROPE_GATE_ROPE_ID,
                    node: { x: pick.rope.x, y: pick.rope.y } },
            ],
            items: [],
        },
        doorCells: pick.lane.cells.map((c) => ({ x: c.x, y: c.y })),
        clearer: [{ x: pick.stance.x, y: pick.stance.y }],
        demand: [],
        area: null,
        symbols: { holds: [], grants: [] },
        cost: {
            wall: 0,
            carved: pick.carved ? 1 : 0,
            candidates: count,
            goalDistance: pick.goalDistance,
            lane: pick.lane.cells.length,
            ropeDistance: pick.ropeDistance,
        },
    };
}

/** The placement shape: ONE trap at the lane's head, ONE rope, ONE stance. */
export function assertRopeGatePlacement(placement, { fail }) {
    const { obstacles } = placement.entities;
    const ids = obstacles.map((o) => o.id);
    if (obstacles.length !== 2 || ids[0] !== ROPE_GATE_TRAP_ID || ids[1] !== ROPE_GATE_ROPE_ID) {
        fail(`ropeGate: the gate is exactly a TRAP then a ROPE (${ROPE_GATE_TRAP_ID}, `
            + `${ROPE_GATE_ROPE_ID}) — got ${JSON.stringify(ids)}.`);
    }
    const [trap, rope] = obstacles;
    const cells = placement.doorCells;
    if (cells.length === 0 || cells.some((c) => c.x !== trap.x)
        || cells[0].y !== trap.y || cells.some((c, i) => c.y !== trap.y + i)) {
        fail('ropeGate: `doorCells` must be the lane — one column\'s contiguous run, the trap on '
            + 'its first (top) cell.');
    }
    if (!rope.node || rope.node.y !== rope.y) {
        fail('ropeGate: the rope carries its `node` on its own row (a rope spans horizontally, '
            + '`RopeStart`\'s `setHitbox(_xend - _x + 16, 16, …)`).');
    }
    if (placement.clearer.length !== 1) {
        fail('ropeGate: `clearer` must be exactly ONE cell — the stance the sword swings from.');
    }
    const [s] = placement.clearer;
    if (manhattan(s, rope) !== 1) {
        fail(`ropeGate: the stance (${s.x},${s.y}) is not 4-adjacent to the rope `
            + `(${rope.x},${rope.y}).`);
    }
    if (cells.some((c) => c.x === rope.x && c.y === rope.y)) {
        fail('ropeGate: the rope stands IN the lane.');
    }
}

export const ROPE_GATE = defineElement({
    name: 'rope-gate',
    family: 'ropegate',
    phase: 'on-connector',
    why: 'An ARMED arrow trap at the head of a lane that is a main-path CUT (a column\'s '
        + 'bottom-most floor run, so the lane the danger map prices to the floor holds nothing '
        + 'else), and a ROPE of the same group on the start side: cut it with the sword and the '
        + 'lane falls silent (the L16 pattern; the solver\'s `pull`). No hit is ever the route.',
    params: [],
    construct: (values, site, rng) => {
        const out = buildRopeGate(site.room);
        if (out.refused) return out;
        /** ⛓ THE ONE DRAW — every candidate already passed every rule. */
        return placementOf(rng.pick(out.candidates), out.candidates.length);
    },
    assertPlacement: assertRopeGatePlacement,
});
