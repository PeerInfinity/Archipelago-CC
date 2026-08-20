/**
 * procgenCore/elements/shortcut — **THE SWORD-GATED SHORTCUT**, the element
 * that makes the differential's FIFTH GRADE reachable (PROCGEN ELEMENTS arc 5,
 * slice 5, D2; design §4.7 / ⚖ rulings 11 and 16).
 *
 * A kill lock standing on the SHORT ARC of a cycle the room already has. Kill
 * the body and the short way opens; leave it alive and the level still solves
 * — the LONG way, and slower. ⛓ On Seedling that is `lock {tset:-1}` +
 * `spinner`, exactly the kill gate's realisation; here it is *the door
 * obstacle* and *the body obstacle*, because this file does not know which
 * substrate it is on.
 *
 * ── ⛓⛓⛓ IT IS THE KILL GATE WITH ONE LAW SWAPPED, AND THAT IS THE DESIGN
 *
 * Same candidate list (`roomDoor.doorCandidates` — the room's canonical main
 * path), same grown wall (`roomDoor.growWall`), same opener pocket
 * (`roomDoor.pocketFor`), same ONE draw. ⛔ **THE ONLY DIFFERENCE IS WHICH
 * QUESTION THE ROOM IS ASKED**, and it is the whole difference:
 *
 *   KILL GATE   `room.doorLaw`      — with the door walled the goal is
 *                                     UNREACHABLE. The item is REQUIRED, and
 *                                     the differential grades it STRONG.
 *   SHORTCUT    `room.shortcutLaw`  — with the door walled the goal is STILL
 *                                     reachable and the walk is STRICTLY
 *                                     LONGER. The item is not required, and the
 *                                     differential grades it SHORTENS.
 *
 * ⇒ the two elements are DISJOINT on every room by construction: a cell either
 * cuts or it does not, so no cell can carry both, and a census that found a
 * room hosting both would have found a defect in one of the two laws.
 *
 * ── ⛔⛔ THE WALL IS GROWN **AND DROPPED**, AND THAT IS THE ONE PLACE THIS
 *     ELEMENT'S GEOMETRY DIFFERS ────────────────────────────────────────
 *
 * The kill gate grows its wall until the wall meets the room, because a lock
 * that does not span the corridor is a lock the walk goes round. A SHORTCUT
 * wants the same thing — a lock nobody can side-step — but the grown wall on a
 * room with area is usually a CUT, and a cut is a door rather than a shortcut.
 * ⇒ each candidate is offered TWICE, in this order:
 *
 *   1. the GROWN wall (`growWall`), which is what makes the lock un-side-steppable;
 *   2. the BARE cell, no wall at all, if (1) was refused.
 *
 * ⛓ **BOTH ARE ADJUDICATED BY THE SAME LAW**, so neither is a weakening: a
 * bare-cell proposal that the walk simply steps around fails
 * `the-shortcut-does-not-shorten` on its own merits. What the second offer buys
 * is the room where the grown wall cut the level and the bare cell does not —
 * ⛔ and `cost.wall` records which arm placed, so the split is a MEASUREMENT
 * rather than a claim. ⚠ It costs up to 2 law calls per candidate and the law
 * itself is two full BFS walks; `shortcutLawRefusal`'s docblock carries that
 * price.
 *
 * ── ⛔⛔ ITS `demand` IS EMPTY, ON PURPOSE, AND THE REASON IS STRUCTURAL ─
 *
 * The kill gate demands its body's REGION stay floor, because arc-3 slice 4d
 * measured 2 of 10 certified gates opened by pass-2 WATER rather than by the
 * sword. The gate can compute that region because its door is a CUT: with the
 * door shut the body is confined to the start side BY CONSTRUCTION.
 *
 * ⛔ **A SHORTCUT'S DOOR IS NOT A CUT — THAT IS ITS DEFINITION — SO NOTHING
 * CONFINES ITS BODY.** The flood from the pocket with the shortcut cell shut is
 * the whole loop, and demanding `floor` over a loop would forbid pass 2 from
 * painting anywhere in the room. ⇒ the demand is EMPTY, the way the ARENA's is
 * (arc 5, slice 4, §12.6) and for a sibling reason, and the exposure is
 * MEASURED instead of guarded.
 *
 * ⛓⛓ **AND THE DIFFERENTIAL IS ITS OWN GUARD HERE, WHICH THE KILL GATE'S IS
 * NOT.** A shortcut whose lock is opened by water is a level where the short
 * way is open without the sword — so BOTH arms take the short way, the tick
 * counts converge, and the row grades INERT rather than SHORTENS. The drown
 * does not produce a FALSE claim; it produces a level that fails to reach the
 * grade, visibly, in the same table. ⚠ That is a weaker protection than a
 * demand and it is said as such: it catches the case in the REPORT rather than
 * refusing it at generation time.
 *
 * ── ⛔⛔⛔ AND IT IS **NOT IN `elementSpec`'s CATALOGUE**, ON THREE
 *     MEASUREMENTS — arc 5, slice 5's central finding ─────────────────
 *
 * The brief's D2 said *"the grade is the point"*: `requirementsFor` WITHOUT the
 * sword must SOLVE the long way with more ticks, WITH it fewer. **On Seedling
 * that is unreachable today, and three independent probes say why.** Each was
 * run on a hand-drawn loop room whose short arc carries the blocker and whose
 * long arc is clear (kickoff §13; `probe-rock.mjs` / `probe2.mjs` in the
 * as-built's REPRODUCE block):
 *
 *  1. **A `breakablerock` SHORTCUT IS INVISIBLE TO THE SOLVER.** The rock is
 *     the ideal opener on paper — a plain sword breaks a rockType-0 rock
 *     (`BreakableRock.as`, `breakableRocks.js`), it is no enemy, and it needs no
 *     ceremony. Measured: **both arms solve in 244 ticks** against the open
 *     room's 129. `presses.PRESS_ARM_POLICY.BreakableRock` is `modelled`, but
 *     the automatic solver DERIVES no break — a rock press is named by OEL
 *     COORDINATE in a hand-written leg (`botDriverV2`), and `refineStrategy`'s
 *     verbs are `shove` / `weigh` / `kill`. To this solver the rock is a wall,
 *     with the sword and without it. ⇒ **INERT**, not SHORTENS.
 *  2. **A KILL LOCK WHOSE LONG ARC PASSES THE BODY REFUSES IN BOTH ARMS.**
 *     *"the combat ladder is EXHAUSTED … the corridor passes through danger"* —
 *     the walk cannot avoid the spinner and cannot fight past it either.
 *  3. **AND A KILL LOCK WHOSE LONG ARC IS CLEAR **THROWS** IN BOTH ARMS.**
 *     ⚖ §11.8a's ladder prefers AVOID over KILL, so with a way round the solver
 *     takes it — and reaches the goal with the spinner ALIVE, which is
 *     `levelRun.assertDialogueFreeSpinnerRoom`: *"level 900 holds live spinners
 *     AND a DIALOGUED ceremony (torch) is running at tick 215"*. That is A10,
 *     for the fourth time in this design, and it is not a bug: the generated
 *     goal is a `torchpickup` and a live spinner at a dialogued ceremony is an
 *     ENGINE refusal.
 *
 * ⇒ **A SPINNER NOBODY IS FORCED TO KILL CANNOT SHIP**, and a shortcut is by
 * definition a level where nobody is forced. The chain closes: the
 * differential's only candidate on Seedling is `hasSword` (the biomes grant
 * `{hasSword, hasShield}` and only the first is ever true), the only SOLVER verb
 * `hasSword` gates is `kill`, and an optional kill throws at the ceremony.
 *
 * ⛔ **SO THE HEAD IS NOT REGISTERED**, and the reason is the one that matters:
 * a registered `--elements=shortcut` would ABORT a real generation with an
 * engine THROW rather than refuse by name, which is a catalogue entry that
 * breaks the run of anyone who types it. ⛓ What ships is the MECHANISM — this
 * element, the law it asks (`gridFlood.shortcutLawRefusal`), the binding's
 * `ELEMENT_LAWS` dispatch and these rows — and the head is **ONE LINE in
 * `elementSpec.ELEMENT_TABLE`** on the day any ONE of the three walls moves: a
 * derived break verb, a combat ladder that prefers a cheap kill to a long
 * detour, or a non-dialogued goal class. All three are R9's or a re-record's,
 * and this arc tunes no solver. ⚠ The MAZE reaches the grade in the same
 * slice (`procgenMaze.realiseAreaShortcut`), so SHORTENS is a grade something
 * can reach — which is the claim trap 355 actually asks for.
 */

import { LAW_SHORTCUT, defineElement } from '../elements.js';
import {
    DOOR_GOAL_MIN, doorCandidates, growWall, pocketFor, tilesFor,
} from './roomDoor.js';

/** The two ids the BINDING looks up — the lock, and the body that opens it. */
export const SHORTCUT_DOOR_ID = 'shortcut_door';
export const SHORTCUT_BODY_ID = 'shortcut_body';

/**
 * ⛓ The kill gate's own pocket preference, imported by VALUE rather than
 * re-decided: §9b.3 measured that 79% of the corridor kill lock's
 * `collideLine("Solid")` throws happen at a pocket cell with ONE floor
 * neighbour, and that measurement is about the SOLVER and the pocket, not about
 * which law adjudicated the door.
 */
export { POCKET_PREFERS_OPEN } from './killGate.js';

/** Every refusal this element can produce, BY NAME — what the census counts. */
export const SHORTCUT_REFUSALS = Object.freeze([
    'no-path-cell', 'goal-too-close', 'no-pocket', 'pocket-not-legal',
    'the-shortcut-is-a-cut', 'the-shortcut-does-not-shorten',
]);

/**
 * ⛓ The refusal a run of candidates deserves: the DEEPEST stage any reached,
 * in the order the stages RUN (trap 357 — a "deepest stage" list that does not
 * match the pipeline names the wrong one).
 *
 * ⛔ `the-shortcut-is-a-cut` sits BELOW `the-shortcut-does-not-shorten` because a
 * candidate that reaches the length comparison has already passed the
 * connectivity clause: on a room where every candidate cuts, *"this room has no
 * cycle"* is the honest answer, and it is the one the census wants to count.
 */
const STAGES = Object.freeze(['goal-too-close', 'no-pocket', 'pocket-not-legal',
    'the-shortcut-is-a-cut', 'the-shortcut-does-not-shorten']);
const deepest = (seen) => STAGES.filter((s) => seen.has(s)).pop() ?? 'no-path-cell';

/**
 * ⛓ WHICH CLAUSE THE LAW'S TEXT REFUSED ON — read off the law's own sentence,
 * which is the only thing it returns.
 *
 * ⛔ IT IS A CLASSIFICATION OF A STRING AND THAT IS A TRAP-337 SHAPE, so it is
 * kept to the two phrases `shortcutLawRefusal` writes in CAPITALS and never
 * more: `IS A CUT` and `DOES NOT SHORTEN`. ⛓ It maps the law's CLAUSE
 * vocabulary (`gridFlood.SHORTCUT_LAW_CLAUSES`) onto THIS element's census
 * names, and it writes them as `seen.add('…')` LITERALS — the shape the
 * reference generator's refusal scan reads, so a name declared in
 * `SHORTCUT_REFUSALS` is a name the scan can find (`refusalCensus.test.js`
 * asserts both directions). Anything else — a sealed room, an
 * opener behind its own door — is not a stage this element can offer a second
 * proposal for, so it does not need a name of its own here; it falls through
 * to the deepest stage the run already saw. ⚠ `gridFlood.test.js` pins both
 * phrases, so a rewording reddens there before it can silently re-classify
 * a census column here.
 */
const noteClause = (seen, why) => {
    if (/IS A CUT/.test(why)) seen.add('the-shortcut-is-a-cut');
    else if (/DOES NOT SHORTEN/.test(why)) seen.add('the-shortcut-does-not-shorten');
};

/**
 * The element's internals, exported so the geometry is testable without a
 * stream and so a census can run the wall arms through the same code.
 *
 * @param {object} room the `elements.assertRoomProbe` probe, WITH `shortcutLaw`.
 * @returns {{candidates, }|{refused:{reason, detail}}}
 */
export function buildShortcut(room, { preferOpen = true } = {}) {
    if (typeof room.shortcutLaw !== 'function') {
        return { refused: { reason: 'no-path-cell',
            detail: 'the room probe offered no `shortcutLaw()`. ⛔ A shortcut is adjudicated '
                + 'by the INVERSE of the binding\'s door law and the element does not '
                + 're-derive it — a binding that offers `doorLaw` and not `shortcutLaw` can '
                + 'host a kill gate and cannot host a shortcut, and saying so by name is '
                + 'better than answering the door law\'s question and calling the result a '
                + 'shortcut.' } };
    }
    const seen = new Set();
    const ok = [];
    for (const cand of doorCandidates(room)) {
        if (cand.goalDistance < DOOR_GOAL_MIN) { seen.add('goal-too-close'); continue; }
        /**
         * ⛓ THE TWO WALL ARMS — the grown wall first, the bare cell second. ⛔
         * The POCKET is recomputed per arm rather than once: `pocketFor` reads
         * the wall (a pocket may not stand ON it) and a cell the grown wall
         * occupied is a legal pocket once the wall is dropped.
         */
        let placed = null;
        for (const wall of [growWall(room, cand.cell, cand.wallAxis), []]) {
            const pocket = pocketFor(room, cand, wall, { preferOpen });
            if (pocket.refused) { seen.add(pocket.refused); continue; }
            const tiles = tilesFor(wall, pocket.carved ? [pocket.cell] : []);
            const lengths = {};
            const why = room.shortcutLaw({ paint: tiles,
                doorCells: [cand.cell], clearer: [pocket.cell], lengths });
            if (why) { noteClause(seen, why); continue; }
            placed = Object.freeze({ cand, wall: Object.freeze(wall), pocket, tiles,
                lengths: Object.freeze({ ...lengths }) });
            break;
        }
        /**
         * ⛔ THE GROWN ARM WINS WHERE BOTH WOULD PASS, and the loop's `break` is
         * what says so: the wall is what makes the lock un-side-steppable, and
         * a bare cell is the fallback for the room the wall would have cut.
         */
        if (placed) ok.push(placed);
    }
    if (ok.length === 0) {
        const reason = deepest(seen);
        return { refused: { reason,
            detail: `no cell of the ${room.mainPath.length}-cell main path can carry a `
                + `SHORTCUT: ${doorCandidates(room).length} interior path cell(s) tried, each `
                + 'with a GROWN wall and then BARE, and the deepest stage any reached was '
                + `"${reason}". ⛓ A shortcut needs a CYCLE — with its cell(s) walled the goal `
                + 'must still be reachable AND strictly further away. ⛔ `the-shortcut-is-a-cut` '
                + 'on every candidate is a room with no loop at all, which is what a tree '
                + 'skeleton is; `the-shortcut-does-not-shorten` is a room whose loop is there and '
                + 'costs nothing to walk round. Neither is a defect — they are the two ways a '
                + 'room can decline to hold one.' } };
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
                { x: pick.cand.cell.x, y: pick.cand.cell.y, id: SHORTCUT_DOOR_ID },
                { x: pick.pocket.cell.x, y: pick.pocket.cell.y, id: SHORTCUT_BODY_ID },
            ],
            items: [],
        },
        doorCells: [{ x: pick.cand.cell.x, y: pick.cand.cell.y }],
        clearer: [{ x: pick.pocket.cell.x, y: pick.pocket.cell.y }],
        /** ⛔ EMPTY, ON PURPOSE — see the file docblock. A shortcut cannot
         *  confine its body, because its door is not a cut. */
        demand: Object.freeze([]),
        area: null,
        symbols: { holds: [], grants: [] },
        /**
         * ⛓ WHAT IT COST THE ROOM, AND WHAT IT SAVES THE PLAYER. `wall` is 0 on
         * the BARE arm and the grown length otherwise — the split the file
         * docblock says is measured rather than claimed. `stepsOpen`/
         * `stepsWalled` are the law's OWN two numbers, carried out of the
         * `lengths` sink rather than re-walked: ⛔ the geometric saving, in
         * steps, which is the thing the differential's tick saving is the
         * SOLVER's account of. Two numbers, two instruments, and a level where
         * they disagree in SIGN is a finding.
         */
        cost: {
            wall: pick.wall.length,
            carved: pick.pocket.carved ? 1 : 0,
            candidates: count,
            goalDistance: pick.cand.goalDistance,
            stepsOpen: pick.lengths.open,
            stepsWalled: pick.lengths.walled,
        },
    };
}

export function assertShortcutPlacement(placement, { fail }) {
    const { obstacles } = placement.entities;
    if (obstacles.length !== 2) {
        fail('shortcut: the shortcut is exactly TWO obstacles — the lock and the body whose '
            + `death opens it — got ${obstacles.length}.`);
    }
    const [door, body] = obstacles;
    if (door.id !== SHORTCUT_DOOR_ID || body.id !== SHORTCUT_BODY_ID) {
        fail(`shortcut: the ids must be ${SHORTCUT_DOOR_ID}/${SHORTCUT_BODY_ID}, in that order.`);
    }
    if (door.x === body.x && door.y === body.y) {
        fail('shortcut: the body stands IN the lock cell. A shortcut whose only enemy is '
            + 'inside the lock it opens is one the player walks past on the tick it dies.');
    }
    if (placement.doorCells.length !== 1
        || placement.doorCells[0].x !== door.x || placement.doorCells[0].y !== door.y) {
        fail('shortcut: `doorCells` must be exactly the lock obstacle\'s own cell — the law '
            + 'is asked about the cells that get WALLED, and a law asked about any other '
            + 'cell is a law asked about a different room.');
    }
    if (placement.clearer.length !== 1
        || placement.clearer[0].x !== body.x || placement.clearer[0].y !== body.y) {
        fail('shortcut: `clearer` must be exactly the body\'s cell — it is the one thing that '
            + 'has to be reachable from the START with the shortcut walled.');
    }
    if ((placement.demand ?? []).length !== 0) {
        fail('shortcut: a shortcut declares NO `demand`. Its door is not a cut, so nothing '
            + 'confines its body and the region a demand would be computed over is the whole '
            + 'loop — see the module docblock. A non-empty demand here is a claim about a '
            + 'confinement that does not exist.');
    }
    const { stepsOpen, stepsWalled } = placement.cost;
    if (!Number.isInteger(stepsOpen) || !Number.isInteger(stepsWalled)
        || stepsWalled <= stepsOpen) {
        fail('shortcut: `cost.stepsWalled` must be STRICTLY greater than `cost.stepsOpen` — '
            + `got ${JSON.stringify({ stepsOpen, stepsWalled })}. Those two numbers come out `
            + 'of the law\'s own sink, so a placement that reaches here without them is a '
            + 'placement the law never accepted.');
    }
}

export const SHORTCUT = defineElement({
    name: 'shortcut',
    family: 'shortcut',
    phase: 'on-connector',
    /** ⛓⛓⛓ THE DECLARATION THAT SWAPS THE LAW — see `elements.ELEMENT_LAWS`.
     *  The binding reads it off the concrete element and asks `shortcutLaw`
     *  where every other door element gets `doorLaw`. ⛔ Without this line the
     *  composite would re-ask the CUT law at commit time and refuse every
     *  placement this element's own construct accepted. */
    law: LAW_SHORTCUT,
    why: 'A `tset:-1` lock on the SHORT ARC of a cycle the room already has, and the body '
        + 'whose death opens it in a start-side pocket. ⛓ It is the KILL GATE with one law '
        + 'swapped: with the lock\'s cell walled the goal must still be REACHABLE and '
        + 'STRICTLY FURTHER, where the gate requires it unreachable. That inversion is what '
        + 'makes the requirements differential\'s fifth grade — SHORTENS, ⚖ design §4.5 — '
        + 'reachable on a generated level for the first time.',
    params: [],
    construct(values, site, rng) {
        const out = buildShortcut(site.room);
        if (out.refused) return out;
        /**
         * ⛓ THE ONE DRAW, DECLARED HERE AND NOWHERE ELSE — the kill gate's own
         * discipline: every candidate has already passed every rule, so this is
         * a choice among equals and not a search.
         */
        return placementOf(rng.pick(out.candidates), out.candidates.length);
    },
    assertPlacement: assertShortcutPlacement,
});
