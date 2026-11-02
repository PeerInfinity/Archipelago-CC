/**
 * procgenCore/elements/strategyGate — **THE HOLD GATE and THE WEIGH GATE**, the
 * generator's gadgets for the solver's `hold` and `weigh` verbs (seedling gen,
 * strategy-switch r3; ⚖ the user 2026-11-01, "(b) More strategy elements").
 *
 * Both are a LOCK on a main-path CUT (the rock gate's door: `roomDoor`'s
 * candidates, its grown wall, `DOOR_GOAL_MIN`, the door law) whose opener is a
 * PRESSER standing on the start side and OFF the main path, so nothing the walk
 * does on its way to the door presses it by accident. What differs is the
 * presser, and the presser is what picks the solver's verb
 * (`solverBot.refineStrategy`'s outlive question):
 *
 *   **HOLD GATE** — the presser is a LATCHING one (on Seedling a `buttonroom
 *   {room: -1}`: `ButtonRoom.as`'s local arm assigns `activate` to its group and
 *   *"Can't be reset to false!!"*, `activators.localPublish`). A lock whose group
 *   has a latching presser keeps `hold`: the player presses it once and walks
 *   through. With `hold` disabled nothing else opens the lock (it is not a kill
 *   lock, and the room has no block to weigh with).
 *
 *   **WEIGH GATE** — the presser is a MOMENTARY one (a plain `button`:
 *   `Button.update` re-collides every tick, so stepping off shuts the group), and
 *   ONE pushable block stands one cell short of it on a straight line, with a
 *   start-side stance behind. Every presser of the group republishes, so the lock
 *   refines to `weigh`: the block is shoved onto the button and weighs it for
 *   ever (`Button.hitables` holds "Solid"). Holding the button yourself opens a
 *   door you cannot then reach, because the button is at least two cells from it.
 *
 * ── THE RULES, EACH ONE A NAMED REFUSAL ───────────────────────────────
 *
 *  1. THE DOOR CELL is an interior cell of the main path at least
 *     `DOOR_GOAL_MIN` from the goal — else `goal-too-close`.
 *  2. THE DOOR LAW: with its grown wall the door is a CUT — else
 *     `wall-does-not-seal`.
 *  3. THE PRESSER SITE, on the start side once the door and wall are solid,
 *     within `PRESSER_NEAR_GATE` steps of the door's start-side neighbour:
 *       · its cells are OFF the main path, not the start, and not within one
 *         step of the door (a player straddling the button and the lock cell
 *         would open the weigh gate by holding);
 *       · with the presser cell walled the start still reaches the door's start
 *         side (a parked block, or a walk that avoids the button, costs no route);
 *       · (weigh) with the BLOCK cell walled the start still reaches the stance
 *         and the door's start side (the block, before the shove, blocks nothing).
 *     When the start side has no such floor (a one-wide corridor) the site is a
 *     CARVED one-mouth pocket off a start-side corridor cell: one cell for the
 *     hold gate's presser, a straight two-cell pocket (block, then button) for the
 *     weigh gate, its mouth the stance. Else `no-presser-site`.
 *  4. ONE DRAW: `rng.pick` over every (door, site) pair that passed, in path order.
 */

import { LAW_CUT, defineElement } from '../elements.js';
import { distancesFrom, reachableFrom } from '../gridFlood.js';
import {
    DOOR_GOAL_MIN, NB4, TILE_FLOOR, TILE_WALL, cellKey, doorCandidates, growWall, inInterior, manhattan,
    tilesFor,
} from './roomDoor.js';

/** The ids the BINDING looks up. */
export const HOLD_GATE_DOOR_ID = 'holdgate_door';
export const HOLD_GATE_BUTTON_ID = 'holdgate_button';
export const WEIGH_GATE_DOOR_ID = 'weighgate_door';
export const WEIGH_GATE_BUTTON_ID = 'weighgate_button';

/**
 * ⛓ HOW FAR FROM THE GATE THE PRESSER MAY STAND — steps from the door's
 * start-side neighbour over the start side. ⛔ A DESIGN CHOICE, the rope gate's
 * (`ROPE_NEAR_GATE`) one step wider: the presser reads as the gate's own opener
 * when it is beside the gate, and the weigh site needs three cells in a row.
 */
export const PRESSER_NEAR_GATE = 4;

/** ⛓ The nearest a presser cell may be to the door (Manhattan): two. */
export const PRESSER_DOOR_MIN = 2;

/** ⛓ EVERY REFUSAL THIS FILE CAN PRODUCE, BY NAME, in the order the stages run. */
export const STRATEGY_GATE_REFUSALS = Object.freeze([
    'no-cut-cell', 'goal-too-close', 'wall-does-not-seal', 'no-presser-site',
]);
export const HOLD_GATE_REFUSALS = STRATEGY_GATE_REFUSALS;
export const WEIGH_GATE_REFUSALS = STRATEGY_GATE_REFUSALS;

const STAGES = Object.freeze(['goal-too-close', 'wall-does-not-seal', 'no-presser-site']);

const KIND_HOLD = 'hold';
const KIND_WEIGH = 'weigh';

const byDistanceThenCell = ([ka, da], [kb, db]) => {
    if (da !== db) return da - db;
    const [ax, ay] = ka.split(',').map(Number);
    const [bx, by] = kb.split(',').map(Number);
    return (ay - by) || (ax - bx);
};

/**
 * The presser sites one door candidate offers, in a fixed order (open sites by
 * distance then cell, then the carved pocket fallback). Each is
 * `{button, block?, stance, carved: [cells], distance}`.
 */
function sitesFor(room, kind, cand, wall) {
    const shut = new Set([cellKey(cand.cell.x, cand.cell.y), ...wall.map((c) => cellKey(c.x, c.y))]);
    const onPath = new Set(room.mainPath.map((c) => cellKey(c.x, c.y)));
    const open = (x, y) => !shut.has(cellKey(x, y)) && room.floorAt(x, y);
    const startSide = reachableFrom(room.width, room.height, open, room.start);
    const near = distancesFrom(room.width, room.height, open, cand.before);
    const isStart = (c) => c.x === room.start.x && c.y === room.start.y;
    const offDoor = (c) => manhattan(c, cand.cell) >= PRESSER_DOOR_MIN;
    /** With `cells` walled (on top of the door and wall), does the start still
     *  reach every one of `targets`? */
    const reachesWith = (cells, targets) => {
        const more = new Set(cells.map((c) => cellKey(c.x, c.y)));
        const reach = reachableFrom(room.width, room.height,
            (x, y) => open(x, y) && !more.has(cellKey(x, y)), room.start);
        return targets.every((t) => reach.has(cellKey(t.x, t.y)));
    };
    const free = (c) => startSide.has(cellKey(c.x, c.y)) && !onPath.has(cellKey(c.x, c.y))
        && !isStart(c) && offDoor(c);
    /**
     * ⛓⛓ (weigh) BEHIND THE LOCK, AS THE FRONTIER COUNTS IT. The walk's frontier
     * is ordered ACTIONABLE first, then NEAREST TO THE AIM (`solverBot`'s frontier
     * sort), and both the button (a `proximity-hazard`, `hold`) and the block (a
     * Solid, `shove`) are actionable. MEASURED (hand-drawn wall-across rooms, the
     * lock's gap swept x = 1..8): a button nearer the goal than the lock is named
     * first, HELD, and the walk stalls against the shut lock; with the lock nearest
     * the same room weighs. ⇒ both cells must be at least one tile further from the
     * goal (cell centres, Euclidean) than the lock.
     */
    const behindLock = (c) => kind !== KIND_WEIGH
        || Math.hypot(c.x - room.goal.x, c.y - room.goal.y)
            >= Math.hypot(cand.cell.x - room.goal.x, cand.cell.y - room.goal.y) + 1;
    const sites = [];
    const ranked = [...near].filter(([, dist]) => dist <= PRESSER_NEAR_GATE).sort(byDistanceThenCell);
    for (const [k, dist] of ranked) {
        const [x, y] = k.split(',').map(Number);
        const at = Object.freeze({ x, y });
        if (kind === KIND_HOLD) {
            if (!free(at)) continue;
            if (!reachesWith([at], [cand.before])) continue;
            sites.push(Object.freeze({ button: at, stance: at, carved: Object.freeze([]),
                enclose: Object.freeze([]), distance: dist }));
            continue;
        }
        /** ⛓ weigh: the sites are `weighSites`' (below) — the button is ENCLOSED. */
    }
    if (kind === KIND_WEIGH) return weighSites(room, cand, ranked, { shut, onPath, open, isStart, offDoor, behindLock });
    if (sites.length > 0) return sites;
    /**
     * ⛓ (hold) THE POCKET FALLBACK — a start side with no spare floor (a one-wide
     * corridor). One cell CARVED off a start-side cell `C`: skeleton wall in the
     * interior whose only floor 4-neighbour is `C`. The binding's carve law
     * adjudicates it in full.
     */
    const len = 1;
    for (const [k, dist] of ranked) {
        const [cx, cy] = k.split(',').map(Number);
        for (const [dx, dy] of NB4) {
            const blob = Array.from({ length: len }, (_, i) => Object.freeze({
                x: cx + dx * (i + 1), y: cy + dy * (i + 1) }));
            if (blob.some((c) => !inInterior(room, c.x, c.y) || room.floorAt(c.x, c.y)
                || shut.has(cellKey(c.x, c.y)) || !offDoor(c) || !behindLock(c))) continue;
            const blobKeys = new Set(blob.map((c) => cellKey(c.x, c.y)));
            const mouths = new Set();
            for (const c of blob) {
                for (const [ex, ey] of NB4) {
                    const n = { x: c.x + ex, y: c.y + ey };
                    const nk = cellKey(n.x, n.y);
                    if (blobKeys.has(nk)) continue;
                    if (room.floorAt(n.x, n.y) || shut.has(nk)) mouths.add(nk);
                }
            }
            if (mouths.size !== 1 || !mouths.has(k)) continue;
            sites.push(Object.freeze({ button: blob[0], stance: blob[0], carved: Object.freeze(blob),
                enclose: Object.freeze([]), distance: dist + 1 }));
            break;
        }
        if (sites.length > 0) break;
    }
    return sites;
}

/**
 * ⛓⛓⛓ (weigh) **THE BUTTON IS ENCLOSED, AND THE BLOCK IS ITS ONLY MOUTH.**
 *
 * Three cells in a straight line from a start-side STANCE `S`: the BLOCK
 * `B = S + d` and the BUTTON `P = S + 2d`. Every 4-neighbour of `P` except `B`
 * is wall — skeleton wall, the grown wall, or a wall this element WRITES (owned,
 * so pass 2 cannot reopen it). `B` and `P` are floor, CARVED where the skeleton
 * has wall. ⇒ the player cannot reach the button except by shoving the block
 * off `B`, and the only shove that frees `B` from `S` lands the block ON `P`.
 *
 * ⛔ WHY, MEASURED (seeds 1–3, pre-sword, before this rule): with the button in
 * the open the `weigh`-off solve's frontier named the button (a
 * `proximity-hazard`, `hold`), the player stood on it, the lock opened and shut
 * again as they stepped off, and the walk ground against it to the budget —
 * BUDGET_EXHAUSTED, graded BOUND-DEPENDENT on 2 of 3 seeds. The third seed's
 * button happened to be enclosed behind its block, and that one refused AT the
 * disabled gate (STRONG). Holding the button by hand is not a way across this
 * gate, so the gate must not offer the solver that try.
 *
 * Conditions, each a filter (no new refusal name — a door with no site is
 * `no-presser-site`): `B` and `P` interior, off the main path, not the start,
 * at least `PRESSER_DOOR_MIN` from the door and behind the lock (`behindLock`);
 * the written walls are interior, off the main path, not the start or the goal,
 * not `S` and not the door's start-side neighbour; a carved `B` has no floor
 * neighbour but `S` and `P`; and with the written walls in place the start
 * reaches `S` and the door's start side with the block on `B`, and the door's
 * start side with the block on `P`.
 */
function weighSites(room, cand, ranked, { shut, onPath, open, isStart, offDoor, behindLock }) {
    const isGoal = (c) => c.x === room.goal.x && c.y === room.goal.y;
    const sameCell = (a, b) => a.x === b.x && a.y === b.y;
    const sites = [];
    for (const [k, dist] of ranked) {
        const [sx, sy] = k.split(',').map(Number);
        const stance = Object.freeze({ x: sx, y: sy });
        for (const [dx, dy] of NB4) {
            const block = Object.freeze({ x: sx + dx, y: sy + dy });
            const button = Object.freeze({ x: sx + 2 * dx, y: sy + 2 * dy });
            const pair = [block, button];
            if (pair.some((c) => !inInterior(room, c.x, c.y) || shut.has(cellKey(c.x, c.y))
                || onPath.has(cellKey(c.x, c.y)) || isStart(c) || isGoal(c) || !offDoor(c)
                || !behindLock(c))) continue;
            /** ⛓ the walls round the button: every floor neighbour but the block. */
            const enclose = [];
            let refused = false;
            for (const [ex, ey] of NB4) {
                const n = Object.freeze({ x: button.x + ex, y: button.y + ey });
                if (sameCell(n, block) || !open(n.x, n.y)) continue;
                if (!inInterior(room, n.x, n.y) || onPath.has(cellKey(n.x, n.y)) || isStart(n) || isGoal(n)
                    || sameCell(n, stance) || sameCell(n, cand.before)) { refused = true; break; }
                enclose.push(n);
            }
            if (refused) continue;
            /** ⛓ a carved block cell is a dead end too: floor only at `S` (and `P`). */
            const carved = pair.filter((c) => !room.floorAt(c.x, c.y));
            if (!room.floorAt(block.x, block.y) && NB4.some(([ex, ey]) => {
                const n = { x: block.x + ex, y: block.y + ey };
                return !sameCell(n, stance) && !sameCell(n, button) && open(n.x, n.y);
            })) continue;
            const encloseKeys = new Set(enclose.map((c) => cellKey(c.x, c.y)));
            const carvedKeys = new Set(carved.map((c) => cellKey(c.x, c.y)));
            const reachWith = (solid) => reachableFrom(room.width, room.height, (x, y) => {
                const key = cellKey(x, y);
                if (key === cellKey(solid.x, solid.y) || encloseKeys.has(key) || shut.has(key)) return false;
                return carvedKeys.has(key) || room.floorAt(x, y);
            }, room.start);
            const onB = reachWith(block);
            if (!onB.has(k) || !onB.has(cellKey(cand.before.x, cand.before.y))) continue;
            if (!reachWith(button).has(cellKey(cand.before.x, cand.before.y))) continue;
            sites.push(Object.freeze({ button, block, stance, carved: Object.freeze(carved),
                enclose: Object.freeze(enclose), distance: dist + 1 }));
        }
    }
    return sites;
}

/**
 * The shared search, exported so the geometry is testable without a stream.
 *
 * @param {object} room the `elements.assertRoomProbe` probe
 * @param {'hold'|'weigh'} kind
 * @returns {{candidates}|{refused:{reason, detail}}}
 */
export function buildStrategyGate(room, kind) {
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
        const sites = sitesFor(room, kind, cand, wall);
        if (sites.length === 0) { seen.add('no-presser-site'); continue; }
        for (const site of sites) ok.push(Object.freeze({ cand, wall: Object.freeze(wall), site }));
    }
    if (ok.length === 0) {
        const reason = STAGES.filter((s) => seen.has(s)).pop() ?? 'no-cut-cell';
        return { refused: { reason,
            detail: `no cell of the ${room.mainPath.length}-cell main path can carry a `
                + `${kind === KIND_HOLD ? 'HOLD' : 'WEIGH'} GATE: ${doorCandidates(room).length} interior `
                + `path cell(s) tried, the deepest stage any reached was "${reason}". ⛓ The presser stands `
                + `on the start side, off the main path, at least ${PRESSER_DOOR_MIN} from the door and within `
                + `${PRESSER_NEAR_GATE} step(s) of it${kind === KIND_WEIGH
                    ? ', with its block one cell short of it on a straight line and a stance behind' : ''}.` } };
    }
    return { candidates: Object.freeze(ok) };
}

/** One chosen candidate → the contract's placement. Absolute cells throughout. */
function placementOf(pick, count, kind) {
    const { cand, wall, site } = pick;
    const doorId = kind === KIND_HOLD ? HOLD_GATE_DOOR_ID : WEIGH_GATE_DOOR_ID;
    const buttonId = kind === KIND_HOLD ? HOLD_GATE_BUTTON_ID : WEIGH_GATE_BUTTON_ID;
    /**
     * ⛓ OWNED, written as FLOOR: the presser cell and (weigh) the block cell —
     * pass 2 can neither wall the button nor stand a template on the block's run.
     * A pocket cell is a CARVE (skeleton wall written floor); an open-site cell is
     * floor written as the floor it already is.
     */
    const floorCells = [site.button, ...(site.block ? [site.block] : [])];
    return {
        tiles: [
            ...tilesFor(wall),
            ...site.enclose.map((c) => ({ x: c.x, y: c.y, tile: TILE_WALL })),
            ...floorCells.map((c) => ({ x: c.x, y: c.y, tile: TILE_FLOOR })),
        ],
        entities: {
            blocks: site.block ? [{ x: site.block.x, y: site.block.y }] : [],
            buttons: [],
            obstacles: [
                { x: cand.cell.x, y: cand.cell.y, id: doorId },
                { x: site.button.x, y: site.button.y, id: buttonId },
            ],
            items: [],
        },
        doorCells: [{ x: cand.cell.x, y: cand.cell.y }],
        clearer: [{ x: site.stance.x, y: site.stance.y }],
        demand: [],
        area: null,
        symbols: { holds: [], grants: [] },
        cost: {
            wall: wall.length,
            carved: site.carved.length,
            enclosed: site.enclose.length,
            candidates: count,
            goalDistance: cand.goalDistance,
            presserDistance: site.distance,
        },
    };
}

/** The placement shape: the LOCK, then its PRESSER; (weigh) ONE block beside the presser. */
export function assertStrategyGatePlacement(kind) {
    const owner = kind === KIND_HOLD ? 'holdGate' : 'weighGate';
    const doorId = kind === KIND_HOLD ? HOLD_GATE_DOOR_ID : WEIGH_GATE_DOOR_ID;
    const buttonId = kind === KIND_HOLD ? HOLD_GATE_BUTTON_ID : WEIGH_GATE_BUTTON_ID;
    return (placement, { fail }) => {
        const { obstacles, blocks } = placement.entities;
        const ids = obstacles.map((o) => o.id);
        if (obstacles.length !== 2 || ids[0] !== doorId || ids[1] !== buttonId) {
            fail(`${owner}: the gate is exactly a LOCK then its PRESSER (${doorId}, ${buttonId}) — got `
                + `${JSON.stringify(ids)}.`);
        }
        const [door, button] = obstacles;
        if (placement.doorCells.length !== 1
            || placement.doorCells[0].x !== door.x || placement.doorCells[0].y !== door.y) {
            fail(`${owner}: \`doorCells\` must be exactly the lock's own cell.`);
        }
        if (manhattan(door, button) < PRESSER_DOOR_MIN) {
            fail(`${owner}: the presser (${button.x},${button.y}) is within one step of the lock `
                + `(${door.x},${door.y}).`);
        }
        if (placement.clearer.length !== 1) {
            fail(`${owner}: \`clearer\` must be exactly ONE cell — where the player stands to open the gate.`);
        }
        const [s] = placement.clearer;
        if (kind === KIND_HOLD) {
            if (blocks.length !== 0) fail(`${owner}: a hold gate has NO block.`);
            if (s.x !== button.x || s.y !== button.y) {
                fail(`${owner}: the \`clearer\` is the presser's own cell — the player stands on it.`);
            }
            return;
        }
        if (blocks.length !== 1) {
            fail(`${owner}: a weigh gate has exactly ONE block.`);
            return;
        }
        const [b] = blocks;
        if (manhattan(b, button) !== 1 || manhattan(b, s) !== 1
            || b.x - s.x !== button.x - b.x || b.y - s.y !== button.y - b.y) {
            fail(`${owner}: the stance (${s.x},${s.y}), the block (${b.x},${b.y}) and the button `
                + `(${button.x},${button.y}) must be three cells in a straight line — one shove.`);
        }
    };
}

const construct = (kind) => (values, site, rng) => {
    const out = buildStrategyGate(site.room, kind);
    if (out.refused) return out;
    /** ⛓ THE ONE DRAW — every candidate already passed every rule. */
    return placementOf(rng.pick(out.candidates), out.candidates.length, kind);
};

export const HOLD_GATE = defineElement({
    name: 'hold-gate',
    family: 'holdgate',
    phase: 'on-connector',
    law: LAW_CUT,
    why: 'A LOCK on a main-path CUT, its wall grown to seal the room, and a LATCHING presser of its '
        + 'group on the start side, OFF the main path — on Seedling a `buttonroom {room:-1}`, pressed '
        + 'once and latched for good. The solver\'s `hold`; nothing else opens the lock.',
    params: [],
    construct: construct(KIND_HOLD),
    assertPlacement: assertStrategyGatePlacement(KIND_HOLD),
});

export const WEIGH_GATE = defineElement({
    name: 'weigh-gate',
    family: 'weighgate',
    phase: 'on-connector',
    law: LAW_CUT,
    why: 'A LOCK on a main-path CUT, its wall grown to seal the room, a MOMENTARY button of its group '
        + 'on the start side OFF the main path, and ONE pushable block a cell short of the button with '
        + 'a stance behind — on Seedling a plain `button` (it republishes every tick) and a '
        + '`pushableblock`. The solver\'s `weigh`: shove the block onto the button, which holds the '
        + 'lock open for ever.',
    params: [],
    construct: construct(KIND_WEIGH),
    assertPlacement: assertStrategyGatePlacement(KIND_WEIGH),
});
