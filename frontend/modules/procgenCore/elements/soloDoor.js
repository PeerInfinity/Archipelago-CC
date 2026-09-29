/**
 * procgenCore/elements/soloDoor — **THE ONE-OBSTACLE DOORS: the ROCK GATE, the
 * ROCK SHORTCUT and the SHIELD GATE** (seedling substrate, slice S1; plan
 * `seedling-substrate-plan.md` §2.1 G-a..G-c).
 *
 * A door that is ONE obstacle on ONE cell of the room's main path, opened by
 * something the player does while STANDING NEXT TO IT — no body to kill, no
 * block to shove, no pocket to hang an opener in. On Seedling the three are a
 * `breakablerock` (a sword swing — the solver's `break`) on a cut, the same rock
 * on a cycle's short arc, and a `shieldlocknorm` (walked into with the shield —
 * the solver's `touch`) on a cut; here they are *the door obstacle*, because
 * this file does not know which substrate it is on.
 *
 * ── ⛓⛓⛓ WHY THEY ARE NOT THE KILL GATE WITH A DIFFERENT ENTITY ─────────
 *
 * The kill gate (`killGate.js`) and the kill-lock shortcut (`shortcut.js`) are
 * TWO obstacles: the lock, and the body whose death opens it, in a start-side
 * POCKET `roomDoor.pocketFor` finds or carves. A rock or a shield lock has no
 * body. Handing one of those elements a rock would mean realising `*_body` as
 * nothing — a pocket carved for no one, a draw's worth of room spent on a
 * dead end, and an `assertPlacement` that asserts two obstacles about a door
 * that has one. ⇒ the opener's CELL is the door's own START-SIDE path
 * neighbour (`doorCandidates`' `before`), which is where the player stands to
 * swing or to walk in, and it is the `clearer` the door law asks about.
 *
 * ⛓ WHAT IS SHARED IS WHAT THE KILL GATE SHARES: `roomDoor.doorCandidates`
 * (the room's canonical main path), `roomDoor.growWall` (the wall grown to fit
 * the room), `DOOR_GOAL_MIN`, and the ONE draw. The shortcut arm takes the
 * kill-lock shortcut's TWO-ARM wall offer (grown, then bare) verbatim, for the
 * reason `shortcut.js` gives: the grown wall is what makes the door
 * un-side-steppable, and on a room with area it is usually a CUT.
 *
 * ── ⛓⛓⛓ THE SHORTCUT IS REALISED AS A ROCK, AND THAT IS A MEASUREMENT ──
 *
 * Arc 5, slice 5 (kickoff §13.6) REFUTED the Seedling shortcut on three walls,
 * and two of them were about the KILL lock: an optional kill either EXHAUSTS
 * the combat ladder (the long arc passes the body) or THROWS A10 at the
 * dialogued goal ceremony with the spinner alive. The third — *"the solver
 * derives no break; to it the rock is a WALL, 244/244 ticks, INERT"* — is the
 * one R9 slice L15 moved (`solverBot.resolveBreakStrategy`). Re-measured at
 * S1's W0 on the same hand-drawn loop (short arc row 1, long arc row 5, the
 * rock at (5,1)): **with the sword SOLVED 148 ticks, without it SOLVED 244**
 * (the long way). ⇒ a rock on the short arc is a shortcut the solver SEES,
 * and it has no body, so A10 cannot fire. That is why the head `shortcut` is
 * registered as THIS file's `ROCK_SHORTCUT` and `shortcut.js` stays the
 * kill-lock mechanism it was written as, unregistered (its tombstone stands:
 * a registered kill-lock shortcut would still abort on A10).
 *
 * ── ⛓⛓ THE SHIELD GATE FACES WEST, AND THE GAME SAYS SO ────────────────
 *
 * `ShieldLock.update` is `p = collide("Player", x - 1, y)` — the lock's own
 * mask shifted ONE PIXEL WEST — so the touch fires only for a player pressed
 * against its WEST face (`activators.touchApproachKey` is `right` for every
 * `ShieldLock`). Measured at W0: a `shieldlocknorm` entered from the west
 * SOLVED in 196 ticks; the same lock entered from the east REFUSED (no stance
 * reaches its touch rect). ⇒ the shield gate is offered only on a path cell
 * whose START-SIDE neighbour is its west neighbour, and a room with no such
 * cell refuses BY NAME (`the-door-has-no-west-approach`) rather than shipping
 * a lock nobody can open. ⛔ `shieldlocknorm`, NOT `shieldlock`: the latter is
 * `new ShieldLock(x, y, tag, 1)` (`Game.as:2324`), the DARK-shield lock.
 *
 * ── THE RULES, EACH ONE A NAMED REFUSAL ───────────────────────────────
 *
 *  1. THE DOOR CELL is an interior cell of the main path at least
 *     `DOOR_GOAL_MIN` from the goal — else `goal-too-close`.
 *  2. (shield only) its START-SIDE neighbour is its WEST neighbour — else
 *     `the-door-has-no-west-approach`.
 *  3. THE LAW ADJUDICATES: `room.doorLaw` for the two gates (the door is a CUT
 *     — `wall-does-not-seal` otherwise), `room.shortcutLaw` for the shortcut
 *     (the door is NOT a cut and the walk round is strictly longer —
 *     `the-shortcut-is-a-cut` / `the-shortcut-does-not-shorten`).
 *  4. ONE DRAW: `rng.pick` over the candidates that passed, in path order.
 *
 * ── ⛓⛓⛓ THE SHORTCUT DEMANDS ITS LONG WAY — measured at S1's W2 ─────────
 *
 * The shortcut law is asked of the SKELETON, and pass 2 runs after it. Over
 * 7 kinds x {10x10, 14x14} x seeds 1..12 (bounds 3/4/3) the first build placed
 * and certified 87 shortcuts and the differential graded **51 SHORTENS and 34
 * STRONG** — a shortcut graded STRONG is a level whose LONG way pass 2 painted
 * shut (the without-arm's words: *"no corridor … to a stance that can
 * collect"*; the kept templates were `pit-patch`, `water-pool`,
 * `wall-segment`). Re-run with pass 2 cut to one obstacle, three of four such
 * cells graded SHORTENS. That is arc-5 slice 5's residue #5 (*"pass 2 … may
 * wall the long arc"*) arriving on Seedling, and the kill gate's cure applies:
 * a `demand` — every cell of ONE shortest route with the rock cell walled must
 * stay `floor`, so the level that ships still has the way round.
 */

import { LAW_CUT, LAW_SHORTCUT, defineElement } from '../elements.js';
import { shortestPath } from '../gridFlood.js';
import { DOOR_GOAL_MIN, cellKey, doorCandidates, growWall, tilesFor } from './roomDoor.js';

/** The ids the BINDING looks up — one per element, so a payload, a census and
 *  a lifted claim can each say WHICH element put the obstacle there. */
export const ROCK_GATE_DOOR_ID = 'rockgate_door';
export const ROCK_SHORTCUT_DOOR_ID = 'rockshortcut_door';
export const SHIELD_GATE_DOOR_ID = 'shieldgate_door';
/** ⛓ Seedling swim S1 (D3/D4) — the WATER doors. ⛔ On Seedling these ids
 *  realise as TERRAIN (one water cell), not as an entity: the binding's
 *  `WATER_DOOR_IDS` is the one table that says so. */
export const WATER_GATE_DOOR_ID = 'watergate_door';
export const WATER_SHORTCUT_DOOR_ID = 'watershortcut_door';

/** Where the opener must stand, relative to the door: `null` (anywhere
 *  start-side) or `'west'` (the shield lock's one-pixel west probe). */
export const APPROACH_WEST = 'west';

/**
 * ⛓ EVERY REFUSAL THIS FILE CAN PRODUCE, BY NAME — the census key for the
 * three elements it defines (their per-element lists below are subsets).
 */
export const SOLO_DOOR_REFUSALS = Object.freeze([
    'no-cut-cell', 'no-path-cell', 'goal-too-close', 'the-door-has-no-west-approach',
    'wall-does-not-seal', 'the-shortcut-is-a-cut', 'the-shortcut-does-not-shorten',
]);
export const ROCK_GATE_REFUSALS = Object.freeze([
    'no-cut-cell', 'goal-too-close', 'wall-does-not-seal',
]);
export const ROCK_SHORTCUT_REFUSALS = Object.freeze([
    'no-path-cell', 'goal-too-close', 'the-shortcut-is-a-cut', 'the-shortcut-does-not-shorten',
]);
export const SHIELD_GATE_REFUSALS = Object.freeze([
    'no-cut-cell', 'goal-too-close', 'the-door-has-no-west-approach', 'wall-does-not-seal',
]);
/** ⛓ Swim S1 — the water doors are the rock doors' geometry, so their
 *  refusals are the rock doors' lists. */
export const WATER_GATE_REFUSALS = ROCK_GATE_REFUSALS;
export const WATER_SHORTCUT_REFUSALS = ROCK_SHORTCUT_REFUSALS;

/**
 * ⛓ The refusal a run of candidates deserves: the DEEPEST stage any reached,
 * in the order the stages RUN (trap 357). ⛔ Per law, because the two laws
 * have different stages after the shared first one.
 */
const STAGES = Object.freeze({
    [LAW_CUT]: Object.freeze(['goal-too-close', 'the-door-has-no-west-approach',
        'wall-does-not-seal']),
    [LAW_SHORTCUT]: Object.freeze(['goal-too-close', 'the-shortcut-is-a-cut',
        'the-shortcut-does-not-shorten']),
});

/** ⛓ `shortcut.js`'s own reading of the law's text, restated as literals so
 *  the reference generator's refusal scan finds the names FIRING here too. The
 *  two phrases are pinned by `gridFlood.test.js`. */
const noteClause = (seen, why) => {
    if (/IS A CUT/.test(why)) seen.add('the-shortcut-is-a-cut');
    else if (/DOES NOT SHORTEN/.test(why)) seen.add('the-shortcut-does-not-shorten');
};

/**
 * The shared search, exported so the geometry is testable without a stream.
 *
 * @param {object} room the `elements.assertRoomProbe` probe (with `shortcutLaw`
 *   for `law: 'shortcut'`)
 * @param {{law?: string, approach?: null|'west'}} [o]
 * @returns {{candidates}|{refused:{reason, detail}}}
 */
export function buildSoloDoor(room, { law = LAW_CUT, approach = null } = {}) {
    const empty = law === LAW_SHORTCUT ? 'no-path-cell' : 'no-cut-cell';
    if (law === LAW_SHORTCUT && typeof room.shortcutLaw !== 'function') {
        return { refused: { reason: 'no-path-cell',
            detail: 'the room probe offered no `shortcutLaw()`, and a shortcut is adjudicated '
                + 'by the INVERSE of the door law — a binding that cannot ask it cannot host '
                + 'one (the kill-lock shortcut\'s rule, `shortcut.js`).' } };
    }
    const seen = new Set();
    const ok = [];
    for (const cand of doorCandidates(room)) {
        if (cand.goalDistance < DOOR_GOAL_MIN) { seen.add('goal-too-close'); continue; }
        if (approach === APPROACH_WEST
            && !(cand.before.x === cand.cell.x - 1 && cand.before.y === cand.cell.y)) {
            seen.add('the-door-has-no-west-approach');
            continue;
        }
        const arms = law === LAW_SHORTCUT
            ? [growWall(room, cand.cell, cand.wallAxis), []]
            : [growWall(room, cand.cell, cand.wallAxis)];
        let placed = null;
        for (const wall of arms) {
            const tiles = tilesFor(wall);
            const args = { paint: tiles, doorCells: [cand.cell], clearer: [cand.before] };
            if (law === LAW_SHORTCUT) {
                const lengths = {};
                const why = room.shortcutLaw({ ...args, lengths });
                if (why) { noteClause(seen, why); continue; }
                placed = Object.freeze({ cand, wall: Object.freeze(wall), tiles,
                    lengths: Object.freeze({ ...lengths }),
                    demand: longWayDemand(room, cand, wall) });
            } else {
                const why = room.doorLaw(args);
                if (why) { seen.add('wall-does-not-seal'); continue; }
                placed = Object.freeze({ cand, wall: Object.freeze(wall), tiles, lengths: null,
                    demand: Object.freeze([]) });
            }
            break;
        }
        if (placed) ok.push(placed);
    }
    if (ok.length === 0) {
        const reason = STAGES[law].filter((s) => seen.has(s)).pop() ?? empty;
        return { refused: { reason,
            detail: `no cell of the ${room.mainPath.length}-cell main path can carry this `
                + `one-obstacle ${law === LAW_SHORTCUT ? 'SHORTCUT' : 'DOOR'}: `
                + `${doorCandidates(room).length} interior path cell(s) tried, the deepest `
                + `stage any reached was "${reason}".`
                + (approach === APPROACH_WEST ? ' ⛓ The shield lock opens only from its WEST '
                    + 'face (`ShieldLock.update` collides at `x - 1`), so only a path cell '
                    + 'entered from the west is offered.' : '') } };
    }
    return { candidates: Object.freeze(ok) };
}

/**
 * ⛓ THE LONG WAY, AS A DEMAND — one shortest start→goal route over the skeleton
 * with the door cell and the grown wall solid, every cell `floor` except the
 * ones this element owns (the contract refuses a demand on a cell the element
 * writes). ⛔ ONE route, not the region: the claim is *a way round exists*, and
 * the smallest set that keeps it true is the least room taken from pass 2.
 */
function longWayDemand(room, cand, wall) {
    const shut = new Set([cellKey(cand.cell.x, cand.cell.y),
        ...wall.map((c) => cellKey(c.x, c.y))]);
    const path = shortestPath(room.width, room.height,
        (x, y) => !shut.has(cellKey(x, y)) && room.floorAt(x, y), room.start, room.goal) ?? [];
    const mine = new Set([...shut, cellKey(cand.before.x, cand.before.y)]);
    return Object.freeze(path.filter((c) => !mine.has(cellKey(c.x, c.y)))
        .map((c) => Object.freeze({ x: c.x, y: c.y, must: 'floor' }))
        .sort((a, b) => (a.y - b.y) || (a.x - b.x)));
}

/** One chosen candidate → the contract's placement. Absolute cells throughout. */
function placementOf(pick, count, id) {
    return {
        tiles: pick.tiles,
        entities: {
            blocks: [],
            buttons: [],
            obstacles: [{ x: pick.cand.cell.x, y: pick.cand.cell.y, id }],
            items: [],
        },
        doorCells: [{ x: pick.cand.cell.x, y: pick.cand.cell.y }],
        clearer: [{ x: pick.cand.before.x, y: pick.cand.before.y }],
        /** ⛔ EMPTY for the two gates: there is no body whose region pass 2
         *  could poison, and the opener stands at `clearer`, which the binding
         *  OWNS. The SHORTCUT's is its long way (`longWayDemand`). */
        demand: pick.demand,
        area: null,
        symbols: { holds: [], grants: [] },
        cost: {
            wall: pick.wall.length,
            candidates: count,
            goalDistance: pick.cand.goalDistance,
            ...(pick.lengths ? { stepsOpen: pick.lengths.open,
                stepsWalled: pick.lengths.walled } : {}),
        },
    };
}

/** The placement shape all three share — ONE obstacle, the door's own cell. */
export function assertSoloPlacement(owner, id, { shortcut = false } = {}) {
    return (placement, { fail }) => {
        const { obstacles } = placement.entities;
        if (obstacles.length !== 1 || obstacles[0].id !== id) {
            fail(`${owner}: the door is exactly ONE obstacle with id ${id} — got `
                + `${JSON.stringify(obstacles.map((o) => o.id))}.`);
        }
        const [door] = obstacles;
        if (placement.doorCells.length !== 1
            || placement.doorCells[0].x !== door.x || placement.doorCells[0].y !== door.y) {
            fail(`${owner}: \`doorCells\` must be exactly the obstacle's own cell.`);
        }
        if (placement.clearer.length !== 1) {
            fail(`${owner}: \`clearer\` must be exactly ONE cell — where the player stands to `
                + 'open the door.');
        }
        const [c] = placement.clearer;
        if (Math.abs(c.x - door.x) + Math.abs(c.y - door.y) !== 1) {
            fail(`${owner}: the \`clearer\` (${c.x},${c.y}) is not 4-adjacent to the door `
                + `(${door.x},${door.y}). The opener stands NEXT TO a one-obstacle door.`);
        }
        if (!shortcut && (placement.demand ?? []).length !== 0) {
            fail(`${owner}: a one-obstacle GATE declares NO \`demand\` — it has no body.`);
        }
        if (shortcut) {
            const demand = placement.demand ?? [];
            if (demand.length === 0 || demand.some((d) => d.must !== 'floor')) {
                fail(`${owner}: a shortcut DEMANDS its long way stay \`floor\` — a non-empty `
                    + 'list of floor cells (see the module docblock\'s W2 measurement).');
            }
            const { stepsOpen, stepsWalled } = placement.cost;
            if (!Number.isInteger(stepsOpen) || !Number.isInteger(stepsWalled)
                || stepsWalled <= stepsOpen) {
                fail(`${owner}: \`cost.stepsWalled\` must be STRICTLY greater than `
                    + `\`cost.stepsOpen\` — got ${JSON.stringify({ stepsOpen, stepsWalled })}.`);
            }
        }
    };
}

const soloConstruct = (id, opts) => (values, site, rng) => {
    const out = buildSoloDoor(site.room, opts);
    if (out.refused) return out;
    /** ⛓ THE ONE DRAW — every candidate already passed every rule. */
    return placementOf(rng.pick(out.candidates), out.candidates.length, id);
};

export const ROCK_GATE = defineElement({
    name: 'rock-gate',
    family: 'rockgate',
    phase: 'on-connector',
    why: 'ONE breakable obstacle on a main-path CUT, its wall grown to seal the room, opened '
        + 'by the player standing on its start side — on Seedling a rockType-0 '
        + '`breakablerock`, broken by a plain sword (the solver\'s `break`, R9 L15). No body, '
        + 'no pocket, no ceremony.',
    params: [],
    construct: soloConstruct(ROCK_GATE_DOOR_ID, { law: LAW_CUT }),
    assertPlacement: assertSoloPlacement('rockGate', ROCK_GATE_DOOR_ID),
});

export const ROCK_SHORTCUT = defineElement({
    name: 'rock-shortcut',
    family: 'shortcut',
    phase: 'on-connector',
    law: LAW_SHORTCUT,
    why: 'The ROCK GATE with the law swapped: the rock stands on the SHORT ARC of a cycle the '
        + 'room already has, so with it unbroken the goal is still reachable, the long way. '
        + '⛓ The shortcut realised by a rock rather than a kill lock, because a rock has no '
        + 'body — the two walls arc 5 slice 5 measured against the kill-lock shortcut (the '
        + 'exhausted ladder, A10 at the ceremony) are both about the body.',
    params: [],
    construct: soloConstruct(ROCK_SHORTCUT_DOOR_ID, { law: LAW_SHORTCUT }),
    assertPlacement: assertSoloPlacement('rockShortcut', ROCK_SHORTCUT_DOOR_ID,
        { shortcut: true }),
});

export const SHIELD_GATE = defineElement({
    name: 'shield-gate',
    family: 'shieldgate',
    phase: 'on-connector',
    why: 'ONE shield lock on a main-path CUT whose START side is its WEST neighbour, its wall '
        + 'grown to seal the room — on Seedling a `shieldlocknorm`, opened by walking into '
        + 'its west face holding the shield (the solver\'s `touch`).',
    params: [],
    construct: soloConstruct(SHIELD_GATE_DOOR_ID, { law: LAW_CUT, approach: APPROACH_WEST }),
    assertPlacement: assertSoloPlacement('shieldGate', SHIELD_GATE_DOOR_ID),
});

/**
 * ⛓⛓⛓ **THE WATER GATE** (seedling swim S1, D3) — the ROCK GATE's geometry with
 * the obstacle swapped for ONE WATER CELL on the cut. The opener is not a verb
 * at the door but an ITEM in the boot: with the conch (`canSwim`) the player
 * swims the cell, without it the cell drowns (`Player.as:1456-1481`) and the
 * planner prices it as a wall (`plannerObstacleAt`'s lethal-terrain arm, which
 * the solver's bag reaches since D1). ⛔ `clearer` is still the start-side
 * neighbour — the cell the swimmer enters the water from — so the contract's
 * one-obstacle shape and the door law's cut are asked unchanged.
 */
export const WATER_GATE = defineElement({
    name: 'water-gate',
    family: 'watergate',
    phase: 'on-connector',
    why: 'ONE water cell on a main-path CUT, its wall grown to seal the room — on Seedling a '
        + '`TERRAIN.water` tile the player crosses only holding the conch (`canSwim`, AP '
        + '`Progressive Swim`). No entity and no tag: the door is terrain.',
    params: [],
    construct: soloConstruct(WATER_GATE_DOOR_ID, { law: LAW_CUT }),
    assertPlacement: assertSoloPlacement('waterGate', WATER_GATE_DOOR_ID),
});
