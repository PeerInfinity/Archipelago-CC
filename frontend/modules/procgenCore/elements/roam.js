/**
 * procgenCore/elements/roam — **THE ROAMING ENEMY: A BODY WITHOUT A KILL LOCK.**
 * The same open floor blob `openChamber` builds, declared as an AREA exactly the
 * same way, with `bodies` enemies standing in it — and NOTHING that opens or
 * closes. No lock, no door cell, no clearer. The body is a DANGER on the room's
 * route, not a GATE across it.
 *
 * Concept library F1 (the user, 2026-09-29: *"if Seedling is currently unable
 * to place enemies without an enemy lock, then that's something we'll want to
 * fix"*). ⚖ The user ruled a THIRD head rather than `arena` with the lock off:
 * `chamber` costs a room nothing (free supply), `arena` costs it a gate, and a
 * roaming body costs it something different again — a danger and no gate.
 *
 * ── ⛔ IT DOES NOT FORK THE CHAMBER OR THE ARENA, AND THE IMPORTS ARE THE PROOF ──
 *
 * `openChamberBlob` (the footprint check and the fill) and `openChamberMouths`
 * (the two draws and the four declared mouths) are the chamber's; the body draw
 * is the arena's own `drawBlobBodies`, exported from `arena.js` for this file
 * without moving an arena draw. What this file adds is the ids and the
 * assertions that say what a roaming enemy is.
 *
 * ── ⛓⛓⛓ WHY THERE WAS NO LOCK-LESS BODY BEFORE, MEASURED (F1 W0) ─────────
 *
 * The census's own 10x10 room (start (1,1), a 6x6 chamber (2,2)..(7,7), goal
 * (8,8)), ONE spinner, NO lock:
 *
 *   1. **THE GOAL WAS DIALOGUED.** `torchpickup` shows text, and `levelRun`
 *      throws on any tick where a live spinner and a dialogued ceremony
 *      coexist. Spinner at (4,4) or (7,2) with the torch: THREW on both boots.
 *      The SAME rooms with a textless `totempart` goal SOLVED certified. ⇒ the
 *      BINDING swaps the certification goal to a textless class when the
 *      record holds a roaming body; this element does not know goals exist.
 *   2. **THE SOLVER HAS NO ROOM-CROSSING ANSWER FOR SOME POSITIONS.** Twelve
 *      positions, textless goal: six SOLVED on both boots, six REFUSED on both,
 *      *"the combat ladder is EXHAUSTED"* — the corridor still probes
 *      dangerous, and `kill` needs a death the model can OBSERVE, which only a
 *      lock's `tset:-1` gives. ⛔ That rung is the solver's (F2), not this
 *      file's: the binding REFUSES such a placement BY NAME
 *      (`the-solver-cannot-cross-the-roaming-body`, carrying the solver's own
 *      words) and nothing here redraws.
 *
 * ── ⛓ ITS LAW IS `none` (`elements.ELEMENT_LAWS`) ────────────────────────
 *
 * Neither a CUT (walling nothing disconnects anything — there is no door cell)
 * nor a SHORTCUT (nothing it holds shortens the walk). What it must satisfy is
 * that the goal stays reachable AND the walk does not get shorter, and the
 * check is the BODY ABLATION: the level solved WITH its bodies and with them
 * REMOVED, same boot, same budget. ⛔ The item differential cannot grade it —
 * its control alone moves 218 → 123 ticks between the boots.
 *
 * ── ⛓⛓ IT IS A THROUGH-ROOM (F1b) ─────────────────────────────────────
 *
 * F1 measured that a roam blob with its exit mouth SEALED is a dead-end side
 * room the route never enters: 186 of 187 body ablations INERT. ⚖ The user
 * ruled (2026-09-29): the roam blob is a THROUGH-ROOM. It declares
 * `through: true` and the BINDING opens and joins BOTH mouths of the pair it
 * chose, and refuses by name a placement the route could walk round. The
 * seal's own reason (with both mouths open the player walks round a guard's
 * DOOR) is a fact about doors, and a roam has none. ⛔ This file changes no
 * geometry and no draw for it: the four mouths and their mirrors were already
 * declared.
 *
 * ── THE DECLARED DRAW ORDER ───────────────────────────────────────────
 *
 *   1. `w`       ⎫ the parameters, in schema order, by `defineElement`'s
 *   2. `h`       ⎪ machinery. An override spends none.
 *   3. `bodies`  ⎭
 *   then, at `construct`, FROM THE SAME STREAM:
 *   4. the mouths — TWO draws, `openChamber`'s own (the preferred side, and
 *      where along it); the other three sides are derivations
 *   5. ONE `pick` PER BODY over the blob cells still free (`drawBlobBodies`)
 *
 * ⛔ **THE DRAW COUNT IS `2 + bodies`** — the arena's own count, for the
 * arena's own reason: a declared function of a parameter drawn FIRST, so the
 * stream decides the count before it spends it.
 *
 * ── REFUSALS, BY NAME ─────────────────────────────────────────────────
 *   `site-is-not-a-declared-footprint`   `openChamber`'s, raised by the shared
 *                     blob.
 *   `roam-has-no-room-for-its-bodies`    more bodies than the blob has cells —
 *                     drawn WITHOUT replacement, so running out is a refusal
 *                     rather than a stack.
 *
 * ⛔ IMPORTS NOTHING SUBSTRATE-SIDE. `gridTiles.js` arrives through
 * `openChamber`; everything else is `procgenCore/`.
 */

import { LAW_NONE, defineElement } from '../elements.js';
import { BODIES_DOMAIN, drawBlobBodies } from './arena.js';
import {
    MIN_CHAMBER, assertBlobMouths, openChamberBlob, openChamberFootprint, openChamberMouths,
} from './openChamber.js';

/** ⛓ THE CENSUS KEY for this module — every refusal name it raises. The gate is
 *  `procgenCore/refusalCensus.test.js`, which scans this file's own text. */
export const ROAM_REFUSALS = Object.freeze([
    'roam-has-no-room-for-its-bodies',
]);

/** The id the BINDING looks up to realise body `i` — the element's only ids. */
export const roamBodyId = (i) => `roam_body_${i}`;

/**
 * The element's internals, exported so the geometry is testable without the
 * contract wrapper.
 *
 * @returns {{placement}|{refused:{reason, detail}}}
 */
export function buildRoam(values, site, rng) {
    const blob = openChamberBlob(values, site);
    if (blob.refused) return blob;
    const { tiles, cells } = blob;
    if (values.bodies > cells.length) {
        return { refused: { reason: 'roam-has-no-room-for-its-bodies',
            detail: `${values.bodies} bod(y|ies) and a ${site.w}x${site.h} blob has `
                + `${cells.length} cell(s). ⛔ They are drawn WITHOUT replacement (the arena's `
                + '`drawBlobBodies`), so a blob with fewer cells than bodies is refused rather '
                + 'than stacked.' } };
    }
    const ports = openChamberMouths(site, rng);
    const bodies = drawBlobBodies(cells, values.bodies, rng, roamBodyId);
    return { placement: {
        tiles,
        /** ⛓ `obstacles`, the arena's bucket for a body — a body is neither
         *  pushed, stood on nor taken. ⛔ NOTHING opens because of it. */
        entities: { blocks: [], buttons: [], obstacles: bodies, items: [] },
        ports,
        /** ⛔ EMPTY ON PURPOSE — the arena's reason: a `pre-carve` element cannot
         *  name the region its body will wander. */
        demand: [],
        area: { cells, kind: 'element' },
        /** ⛔ NOTHING HELD, NOTHING GRANTED — there is no door for the area graph
         *  to bind and no lock for anything to open. */
        symbols: { holds: [], grants: [] },
        cost: { w: site.w, h: site.h, cells: cells.length, bodies: bodies.length },
    } };
}

/** The invariants only THIS element can state — asked on every construct. */
function assertRoamPlacement(placement, { site, values, fail }) {
    const { blocks, buttons, obstacles, items } = placement.entities;
    if (blocks.length || buttons.length || items.length) {
        fail('roam: a roaming enemy puts BODIES in the room and nothing else — got '
            + `${blocks.length} block(s), ${buttons.length} button(s), ${items.length} item(s).`);
    }
    if (obstacles.length !== values.bodies) {
        fail(`roam: \`bodies\` is ${values.bodies} and the placement carries `
            + `${obstacles.length} obstacle(s). The parameter IS the count.`);
    }
    const seen = new Set();
    for (let i = 0; i < obstacles.length; i += 1) {
        const o = obstacles[i];
        if (o.id !== roamBodyId(i)) {
            fail(`roam: body ${i} carries the id ${JSON.stringify(o.id)} and the binding looks `
                + `up ${JSON.stringify(roamBodyId(i))}. The ids are the MAPPING's keys.`);
        }
        if (o.x < site.x || o.y < site.y || o.x >= site.x + site.w || o.y >= site.y + site.h) {
            fail(`roam: body ${i} stands at (${o.x},${o.y}), outside the ${site.w}x${site.h} `
                + `site at (${site.x},${site.y}).`);
        }
        if (seen.has(`${o.x},${o.y}`)) {
            fail(`roam: two bodies stand on (${o.x},${o.y}). They are drawn WITHOUT `
                + 'replacement, so a repeat is a defect in the draw.');
        }
        seen.add(`${o.x},${o.y}`);
    }
    if (placement.symbols.holds.length !== 0 || placement.symbols.grants.length !== 0) {
        fail('roam: a roaming enemy holds and grants NOTHING — a symbol would ask the area '
            + 'graph to bind a door that does not exist.');
    }
    if (site.w < MIN_CHAMBER || site.h < MIN_CHAMBER) {
        fail(`roam: ${site.w}x${site.h} is under ${MIN_CHAMBER} on an axis, so the blob is `
            + 'CORRIDOR by `wideBlobs`\' own rule.');
    }
    if (placement.area.cells.length !== site.w * site.h) {
        fail(`roam: the declared area is ${placement.area.cells.length} cell(s) and the site `
            + `is ${site.w}x${site.h} = ${site.w * site.h}. The blob IS the site.`);
    }
    assertBlobMouths(placement, { site, fail, owner: 'roam' });
}

export const ROAM = defineElement({
    name: 'roam',
    family: 'roam',
    why: 'The ROAMING ENEMY (concept library F1): `openChamber`\'s own blob with `bodies` '
        + 'enemies standing in it and NO lock — a danger on the room\'s route, not a gate '
        + 'across it. ⚖ A third head (the user, 2026-09-29): a chamber costs a room nothing, '
        + 'an arena costs it a gate, a roaming body costs it a danger.',
    params: [
        { key: 'w', domain: [2, 3, 4, 5, 6], default: 4,
            why: 'the blob\'s width — `openChamber`\'s own domain and for its own two reasons.' },
        { key: 'h', domain: [2, 3, 4, 5, 6], default: 4,
            why: 'the blob\'s height, on the same domain; separate because a non-square blob '
                + 'has two orientations and the site pick offers both.' },
        { key: 'bodies', domain: BODIES_DOMAIN, default: 1,
            why: 'how many enemies roam the blob — the ARENA\'s domain, which its D0 arm '
                + 'priced per body (wall clock and solve ticks); a roaming body costs the '
                + 'solver the same danger map whether or not a lock waits on its death.' },
    ],
    construct(values, site, rng) {
        const out = buildRoam(values, site, rng);
        return out.refused ? out : out.placement;
    },
    footprint: openChamberFootprint,
    assertPlacement: assertRoamPlacement,
    law: LAW_NONE,
    /** ⛓ F1b — the corridor passes THROUGH the blob (⚖ the user, 2026-09-29).
     *  The pair is the chamber's own: `openChamberMouths` lists the four
     *  entries and their four mirrors in ONE order, so the exit matched BY
     *  INDEX is the OPPOSITE side at the same offset. */
    through: true,
});
