/**
 * procgenCore/elements/chestDoor — **THE CHEST DOOR: a chest standing in the
 * only gap of a wall, opened from the SOUTH** (seedling gen content B2; the L38
 * pattern, `chest@144,112` under its cover, the one vanilla chest that is also
 * the only join between two rooms).
 *
 * ⚖ The user, 2026-10-30, *"I agree with your recommendations"* — chests as
 * DOORS now, each door chest an Archipelago location (it always drops a seal
 * piece), chests as LOOT or as a GOAL only after the oracle's "no collect
 * record" fix. This re-opens the 2026-08-12 ruling (`procgenPalette`
 * `POST_SWORD_EXCLUDED_TEMPLATES` `chest-in-the-gap`: *a chest is a SOLVER
 * CAPABILITY, not a palette family*) as an ELEMENT, not as that template: the
 * template's own `wouldNeed` named the missing part — a route that DOUBLES
 * BACK so the crossing runs south→north — and an element owns several cells,
 * which a depth-1 template cannot (⚖ §1.6's limit is a TEMPLATE limit).
 *
 * ── THE PARTS ─────────────────────────────────────────────────────────
 *
 *  · THE CHEST — one main-path cell `C`. ⛓ A chest is `type = "Solid"` until
 *    `open()` (`Chest.as:41`), and opening spawns a seal piece — so `C` is the
 *    element's one `doorCell`.
 *  · THE WALL — grown from `C` across the corridor (`chestWall`), so that `C`
 *    is the wall's ONLY gap: with `C` walled the goal is unreachable. On an
 *    EAST–WEST crossing the wall JOGS — its upper half in `C`'s column, its
 *    lower half one column over on the far side — so the cell under the chest
 *    stays on the start side. The grown cells and every wall 4-neighbour of
 *    `C` and the pocket are OWNED, so pass 2 cannot carve a second gap.
 *  · THE STANCE — `S = (C.x, C.y + 1)`, the cell strictly BELOW the chest.
 *    ⛓ `Chest.update` opens on a one-pixel line beneath the chest
 *    (`levelWorld`'s `chest` row, `kind: 'line-below'`), and the solver's
 *    `chestStanceBand` searches rows from there DOWNWARD only — the game's
 *    trigger geometry, not a solver choice. `S` is the element's `clearer`.
 *  · THE POCKET — when `S` is wall (a one-wide corridor), a short CARVED run
 *    of cells from `S` to a start-side floor cell: the doubling-back the design
 *    asked for, so the connector meets the chest wall from the SOUTH.
 *
 * ── THE RULES, EACH ONE A NAMED REFUSAL ─────────────────────────────────
 *
 *  ·     NOT ON THE GOAL'S DOORSTEP — `C` at least `DOOR_GOAL_MIN` from the
 *        goal (`goal-too-close`), the door elements' own clause.
 *  (i)   THE CHEST IS A CUT — the binding's door law with `doorCells = [C]`
 *        and the grown wall painted (`the-chest-is-not-a-cut`). A second gap
 *        is the far side reached WITHOUT the chest, which this refuses; the
 *        seam asks the same of every SOLVE (`procgenSeedling.
 *        chestDoorBypassRefusal`: a plan that never opens the chest is refused).
 *  (ii)  THE STANCE IS ON THE START SIDE — with `C` walled, the start floods
 *        `S` (`the-stance-is-beyond-the-chest`). ⛓ This is the design probe's
 *        `door-north` (REFUSED 2/2 `STANCE_REENTRY`): a main path that enters
 *        `C` from the north has its stance on the side the player is trying to
 *        reach, and no carve can move it back.
 *  (iii) THE POCKET STAYS ON THE START SIDE — when `S` is wall, the carve is at
 *        most `CHEST_POCKET_MAX` interior wall cells, none of them `C` and none
 *        4-adjacent to a far-side floor cell (a carve that touched the far side
 *        would BE the second gap) — else `no-stance-pocket`.
 *
 * ONE DRAW: `rng.pick` over every candidate that passed, the UNCARVED ones
 * when any exist (a pocket is the fallback, as the rope gate's is).
 *
 * ⛔ NOTHING HERE KNOWS A SUBSTRATE: `chest` and `tag` are the binding's words
 * (`procgenSeedlingElements.seedlingOnConnectorEntities`). This file says
 * *chest*, *stance*, *pocket*.
 */

import { defineElement, LAW_CUT } from '../elements.js';
import { reachableFrom } from '../gridFlood.js';
import {
    DOOR_GOAL_MIN, NB4, TILE_FLOOR, TILE_WALL, cellKey, doorCandidates, inInterior,
} from './roomDoor.js';

/** The id the BINDING looks up — the chest in the gap. */
export const CHEST_DOOR_CHEST_ID = 'chestdoor_chest';

/**
 * ⛓ THE LONGEST POCKET — carved cells from the stance to the start side.
 * ⛔ A DESIGN CHOICE, not a measurement: one cell is the stance itself, and
 * two more turn the corner from an east–west corridor's entry cell down and
 * along to below the chest. A longer pocket is a corridor the room does not
 * explain.
 */
export const CHEST_POCKET_MAX = 3;

/** ⛓ EVERY REFUSAL THIS FILE CAN PRODUCE, BY NAME, in the order the stages run. */
export const CHEST_DOOR_REFUSALS = Object.freeze([
    'no-chest-cell', 'goal-too-close', 'the-chest-is-not-a-cut',
    'the-stance-is-beyond-the-chest', 'no-stance-pocket',
]);

/**
 * The pocket from the stance `s` (a wall cell) to the start side: the shortest
 * run of carvable cells, `s` first, whose last cell has a start-side floor
 * 4-neighbour. A carvable cell is an interior wall cell (after `floorAt`, which
 * already carries the grown wall) that is not the chest and touches no
 * far-side floor. `null` when none is at most `CHEST_POCKET_MAX` long.
 */
export function stancePocket(room, floorAt, chest, s, startSide) {
    const isChest = (x, y) => x === chest.x && y === chest.y;
    const farFloor = (x, y) => floorAt(x, y) && !startSide.has(cellKey(x, y)) && !isChest(x, y);
    const carvable = (x, y) => inInterior(room, x, y) && !floorAt(x, y) && !isChest(x, y)
        && !NB4.some(([dx, dy]) => farFloor(x + dx, y + dy));
    if (!carvable(s.x, s.y)) return null;
    const touchesStart = (x, y) => NB4.some(([dx, dy]) => startSide.has(cellKey(x + dx, y + dy)));
    const parent = new Map([[cellKey(s.x, s.y), null]]);
    let frontier = [s];
    for (let len = 1; len <= CHEST_POCKET_MAX && frontier.length > 0; len += 1) {
        const hit = frontier.find((c) => touchesStart(c.x, c.y));
        if (hit) {
            const out = [];
            for (let k = cellKey(hit.x, hit.y); k !== null; k = parent.get(k)) {
                const [x, y] = k.split(',').map(Number);
                out.unshift(Object.freeze({ x, y }));
            }
            return Object.freeze(out);
        }
        const next = [];
        for (const c of frontier) {
            for (const [dx, dy] of NB4) {
                const x = c.x + dx;
                const y = c.y + dy;
                if (parent.has(cellKey(x, y)) || !carvable(x, y)) continue;
                parent.set(cellKey(x, y), cellKey(c.x, c.y));
                next.push({ x, y });
            }
        }
        frontier = next;
    }
    return null;
}

/**
 * ⛓⛓⛓ **THE WALL THROUGH THE CHEST — AND ITS JOG.** From the chest cell,
 * perpendicular to the corridor (`roomDoor.wallAxisAt`), floor cells only,
 * stopping at the start or the goal (`roomDoor.growWall`'s own stops):
 *
 *  · a NORTH–SOUTH crossing: the wall runs east–west through the chest, and
 *    the stance below it is wherever the corridor came from;
 *  · an EAST–WEST crossing: the wall's upper half runs north from the chest in
 *    its own column, and its LOWER half runs south one column OVER, on the far
 *    side. ⛓ That jog is the doubling-back: the cell under the chest is left on
 *    the START side, so the opener reaches it from the south. A straight
 *    column would put the stance IN the wall (`chest-in-the-gap`'s vertical
 *    case: "the cell below the chest is the wall itself").
 *  · a BEND: no wall (a corridor's bend is a cut by itself, or nothing is).
 */
export function chestWall(room, cand) {
    const { cell, after } = cand;
    const out = [];
    const grow = (x0, y0, dx, dy) => {
        for (let k = 0; ; k += 1) {
            const x = x0 + dx * k;
            const y = y0 + dy * k;
            if (!room.floorAt(x, y)) break;
            if ((x === room.start.x && y === room.start.y) || (x === room.goal.x && y === room.goal.y)) break;
            out.push(Object.freeze({ x, y }));
        }
    };
    if (cand.wallAxis === 'x') {
        grow(cell.x + 1, cell.y, 1, 0);
        grow(cell.x - 1, cell.y, -1, 0);
    } else if (cand.wallAxis === 'y') {
        grow(cell.x, cell.y - 1, 0, -1);
        grow(cell.x + Math.sign(after.x - cell.x), cell.y + 1, 0, 1);
    }
    return out;
}

/**
 * The shared search, exported so the geometry is testable without a stream.
 *
 * @param {object} room the `elements.assertRoomProbe` probe
 * @returns {{candidates}|{refused:{reason, detail}}}
 */
export function buildChestDoor(room) {
    const seen = new Set();
    const natural = [];
    const carved = [];
    const isEnd = (c) => (c.x === room.start.x && c.y === room.start.y)
        || (c.x === room.goal.x && c.y === room.goal.y);
    for (const cand of doorCandidates(room)) {
        const chest = cand.cell;
        if (cand.goalDistance < DOOR_GOAL_MIN) {
            seen.add('goal-too-close');
            continue;
        }
        const wall = chestWall(room, cand);
        const wallKeys = new Set(wall.map((c) => cellKey(c.x, c.y)));
        const paint = wall.map((c) => ({ x: c.x, y: c.y, tile: TILE_WALL }));
        /** ⛓ (i) — the binding's door law, with no stance yet (clause 2 is
         *  asked again at the commit, with the stance). */
        if (room.doorLaw({ paint, doorCells: [chest], clearer: [] })) {
            seen.add('the-chest-is-not-a-cut');
            continue;
        }
        const floorAt = (x, y) => room.floorAt(x, y) && !wallKeys.has(cellKey(x, y));
        const startSide = reachableFrom(room.width, room.height,
            (x, y) => floorAt(x, y) && !(x === chest.x && y === chest.y), room.start);
        const s = Object.freeze({ x: chest.x, y: chest.y + 1 });
        const base = { chest, stance: s, wall, goalDistance: cand.goalDistance };
        if (floorAt(s.x, s.y)) {
            /** ⛓ (ii) — a floor stance must be the START's. */
            if (!startSide.has(cellKey(s.x, s.y)) || isEnd(s)) {
                seen.add('the-stance-is-beyond-the-chest');
                continue;
            }
            natural.push(Object.freeze({ ...base, pocket: Object.freeze([]) }));
            continue;
        }
        /** ⛓ (iii) — a wall stance gets a pocket, or the cell refuses. */
        const pocket = stancePocket(room, floorAt, chest, s, startSide);
        if (!pocket) {
            seen.add('no-stance-pocket');
            continue;
        }
        carved.push(Object.freeze({ ...base, pocket }));
    }
    const ok = natural.length > 0 ? natural : carved;
    if (ok.length === 0) {
        const reason = CHEST_DOOR_REFUSALS.filter((r) => seen.has(r)).pop() ?? 'no-chest-cell';
        return { refused: { reason,
            detail: `no cell of the ${room.mainPath.length}-cell main path can hold a CHEST `
                + `DOOR: the deepest stage any cell reached was "${reason}". ⛓ A chest opens `
                + 'from the one-pixel line BELOW it, so the cell under the chest must be on the '
                + 'start side (or a pocket of at most '
                + `${CHEST_POCKET_MAX} carved cell(s) away from it), and the chest with its wall `
                + 'must be a cut.' } };
    }
    return { candidates: Object.freeze(ok) };
}

/** The wall cells around the chest and its pocket, which the element OWNS. */
function wallsAround(room, pick) {
    const out = new Map();
    const mine = new Set([...pick.pocket, ...pick.wall].map((c) => cellKey(c.x, c.y)));
    for (const c of [pick.chest, ...pick.pocket]) {
        for (const [dx, dy] of NB4) {
            const x = c.x + dx;
            const y = c.y + dy;
            if (!inInterior(room, x, y) || room.floorAt(x, y) || mine.has(cellKey(x, y))) continue;
            out.set(cellKey(x, y), { x, y });
        }
    }
    return [...out.values()];
}

/** One chosen candidate → the contract's placement. Absolute cells throughout. */
function placementOf(room, pick, count) {
    return {
        /**
         * ⛓ WHAT THE ELEMENT OWNS BEYOND ITS DOOR AND STANCE:
         *  · the POCKET, as FLOOR (a CARVE — the binding's carve law asks it);
         *  · the WALL around the chest and the pocket, as the wall it already
         *    is, so pass 2 can never open a second gap beside the chest.
         * ⛔ OWNED, NOT DEMANDED — the rope gate's measured reason: a `wall`
         * demand is asserted to SURVIVE the `shell` strip, and a wall cell deep
         * in wall mass is rightly dropped by it.
         */
        tiles: [
            ...pick.wall.map((c) => ({ x: c.x, y: c.y, tile: TILE_WALL })),
            ...pick.pocket.map((c) => ({ x: c.x, y: c.y, tile: TILE_FLOOR })),
            ...wallsAround(room, pick).map((c) => ({ x: c.x, y: c.y, tile: TILE_WALL })),
        ],
        entities: {
            blocks: [],
            buttons: [],
            obstacles: [{ x: pick.chest.x, y: pick.chest.y, id: CHEST_DOOR_CHEST_ID }],
            items: [],
        },
        doorCells: [{ x: pick.chest.x, y: pick.chest.y }],
        /** ⛓ The chest is SOLID until opened, so its pocket's carve law reads
         *  the chest cell as wall (`compositeSeedlingOnConnector`): the pocket
         *  ends under the chest by construction, and the chest is a door the
         *  door law asks about, not a second mouth. */
        doorSolidForCarve: pick.pocket.length > 0,
        clearer: [{ x: pick.stance.x, y: pick.stance.y }],
        demand: [],
        area: null,
        symbols: { holds: [], grants: [] },
        cost: {
            wall: pick.wall.length,
            carved: pick.pocket.length,
            candidates: count,
            goalDistance: pick.goalDistance,
        },
    };
}

/** The placement shape: ONE chest, its stance directly BELOW it. */
export function assertChestDoorPlacement(placement, { fail }) {
    const { obstacles } = placement.entities;
    if (obstacles.length !== 1 || obstacles[0].id !== CHEST_DOOR_CHEST_ID) {
        fail(`chestDoor: the door is exactly ONE chest (${CHEST_DOOR_CHEST_ID}) — got `
            + `${JSON.stringify(obstacles.map((o) => o.id))}.`);
    }
    const [chest] = obstacles;
    const cells = placement.doorCells;
    if (cells.length !== 1 || cells[0].x !== chest.x || cells[0].y !== chest.y) {
        fail('chestDoor: `doorCells` must be exactly the chest\'s cell.');
    }
    if (placement.clearer.length !== 1) {
        fail('chestDoor: `clearer` must be exactly ONE cell — the stance below the chest.');
    }
    const [s] = placement.clearer;
    if (s.x !== chest.x || s.y !== chest.y + 1) {
        fail(`chestDoor: the stance (${s.x},${s.y}) is not directly BELOW the chest `
            + `(${chest.x},${chest.y}) — a chest opens only from the line beneath it.`);
    }
}

export const CHEST_DOOR = defineElement({
    name: 'chest-door',
    family: 'chestdoor',
    phase: 'on-connector',
    law: LAW_CUT,
    why: 'A CHEST standing in the only gap of a wall (a main-path CUT), opened from the cell '
        + 'directly BELOW it — the game\'s one-pixel trigger line — with a carved pocket when '
        + 'the corridor meets the wall east–west, so the opener stands on the start side. '
        + 'Opening it is the way through, and it drops a seal piece (the L38 pattern).',
    params: [],
    construct: (values, site, rng) => {
        const out = buildChestDoor(site.room);
        if (out.refused) return out;
        /** ⛓ THE ONE DRAW — every candidate already passed every rule. */
        return placementOf(site.room, rng.pick(out.candidates), out.candidates.length);
    },
    assertPlacement: assertChestDoorPlacement,
});
