/**
 * procgenCore/elements/arena — **THE CHAMBER WEAPONISED.** The same open floor
 * blob `openChamber` builds, declared as an AREA exactly the same way, with
 * `bodies` enemies standing in it — and a KILL LOCK the binding puts on the
 * room's main path, so clearing the room is what opens the way on.
 *
 * PROCGEN ELEMENTS arc 5, slice 4 (`NewDocs/plans/procgen-elements-arc5-
 * kickoff.md` §3.4; design catalogue #4/#6, ⚖ §7c's `bodies = n`).
 *
 * ── ⛔ IT DOES NOT FORK THE CHAMBER, AND THE IMPORT LIST IS THE PROOF ──
 *
 * `openChamberBlob` (the footprint check and the fill) and `openChamberMouths`
 * (the two draws and the four declared mouths) are IMPORTED, not copied. What
 * this file adds is the payload: `bodies` cells drawn out of the blob, and the
 * assertions that say what an arena is. ⛓ So the two elements agree about
 * geometry by CONSTRUCTION — a chamber whose footprint rule changed and an
 * arena whose did not would be two elements the binding offers one site pick.
 *
 * ── ⛓⛓⛓ WHY THE LOCK IS NOT ON THE BLOB'S MOUTH ──────────────────────
 *
 * The brief asked for *a kill lock on the blob's mouth*. ⛔ THAT LEVEL CANNOT
 * BE SOLVED AND THE REASON IS REACHABILITY, not tuning: the binding walls the
 * site's ring and opens exactly ONE mouth, so a lock standing in it is the only
 * way to the bodies. `totalEnemies() == 0` is what opens it, the player cannot
 * reach the enemies to make it true, and the gate never opens. ⇒ the lock goes
 * where the guard's own `Lock`(B) goes — a cell of the room's main path that
 * CUTS the goal from the start and LEAVES THE MOUTH ON THE START'S SIDE
 * (`flagLockCellFor` clause (e), which is exactly this requirement written a
 * slice earlier). The player detours into the arena, clears it, and walks on.
 *
 * ⛓ AND THE LOCK IS LOAD-BEARING RATHER THAN DECORATION (arc-3 §18.2 A10):
 * a live spinner with NO lock REFUSES the collect ceremony outright —
 * *"level 900 holds live spinners AND a DIALOGUED ceremony (torch) is
 * running"* — and in a bare corridor with no lock the solver answers *"the
 * combat ladder is EXHAUSTED"*. The lock is what makes killing the bodies the
 * goal. The measurement is this slice's D2 arm and the mutant table's (a).
 *
 * ── THE DECLARED DRAW ORDER ───────────────────────────────────────────
 *
 *   1. `w`       ⎫ the parameters, in schema order, by `defineElement`'s
 *   2. `h`       ⎪ machinery. An override spends none.
 *   3. `bodies`  ⎭
 *   then, at `construct`, FROM THE SAME STREAM:
 *   4. the mouths — TWO draws, `openChamber`'s own (the preferred side, and
 *      where along it); the other three sides are derivations
 *   5. ONE `pick` PER BODY over the blob cells still free
 *
 * ⛔ **THE DRAW COUNT IS `2 + bodies`, WHICH IS A DECLARED FUNCTION OF A
 * PARAMETER DRAWN FIRST** — `templateContract`'s own rule (*"the number of
 * draws an attempt spends is TEMPLATE-DEPENDENT, which is harmless precisely
 * because the template is drawn first — the stream decides the count before it
 * spends it"*). A record is still `{params, site}` plus the seed.
 *
 * ── REFUSALS, BY NAME ─────────────────────────────────────────────────
 *   `site-is-not-a-declared-footprint`   `openChamber`'s, raised by the shared
 *                     blob: the rectangle the binding offered is not one this
 *                     element declared for these values.
 *   `arena-has-no-room-for-its-bodies`   more bodies than the blob has cells.
 *                     ⛔ Two enemies in one tile is a placement that lies about
 *                     being two, so the bodies are drawn WITHOUT replacement
 *                     and running out is a refusal rather than a stack.
 *
 * ⚠ **WHAT THIS ELEMENT DOES NOT DEMAND, AND WHY IT IS NAMED HERE.** The kill
 * gate demands `floor` over its body's REGION and `wall` around it, because a
 * pass-2 pool that drowns the body opens the lock for a reason the level did
 * not pose (arc 3, slice 4d: 2 of 10 certified gates). An arena CANNOT compute
 * that region: it is a `pre-carve` element and the room does not exist yet when
 * it constructs. What protects the blob itself is the binding's reserved
 * rectangle, which pass 2 may not paint, carve or occupy at all
 * (`elementRefusalAt`); what is NOT protected is wherever a body wanders to
 * after it leaves the mouth. ⛓ So the arena's `demand` is empty ON PURPOSE and
 * the exposure is MEASURED instead — the arc-5 as-built §12 publishes the
 * `cause` of every arena lock clear over the corpus, which is the same reading
 * that found the kill gate's two.
 *
 * ⛔ IMPORTS NOTHING SUBSTRATE-SIDE. `gridTiles.js` is the ONE grid vocabulary
 * and it arrives through `openChamber`; everything else is `procgenCore/`.
 */

import { defineElement } from '../elements.js';
import {
    MIN_CHAMBER, assertBlobMouths, openChamberBlob, openChamberFootprint, openChamberMouths,
} from './openChamber.js';

/** ⛓ THE CENSUS KEY for this module — every refusal name it raises. The gate is
 *  `procgenCore/refusalCensus.test.js`, which scans this file's own text. */
export const ARENA_REFUSALS = Object.freeze([
    'arena-has-no-room-for-its-bodies',
]);

/** The id the BINDING looks up to realise body `i` — the arena's only ids. */
export const arenaBodyId = (i) => `arena_body_${i}`;

/**
 * ⛓⛓ **THE `bodies` DOMAIN IS A MEASUREMENT** (⚖ arc-5 ruling 9 / design §7c:
 * *"measure `n = 2` on the yield table BEFORE the domain is offered"*), and the
 * measurement is in the as-built §12: the D0 arm prices one body against two on
 * this element's own geometry — wall clock, solve ticks, certification rate and
 * abort classes — and the domain below is what it priced as sane. A value
 * nobody swept is a value nobody adjudicated, so it is not in this list.
 */
export const BODIES_DOMAIN = Object.freeze([1, 2]);

/**
 * The element's internals, exported so the geometry is testable without the
 * contract wrapper.
 *
 * @returns {{placement}|{refused:{reason, detail}}}
 */
export function buildArena(values, site, rng) {
    const blob = openChamberBlob(values, site);
    if (blob.refused) return blob;
    const { tiles, cells } = blob;
    if (values.bodies > cells.length) {
        return { refused: { reason: 'arena-has-no-room-for-its-bodies',
            detail: `${values.bodies} bod(y|ies) and a ${site.w}x${site.h} blob has `
                + `${cells.length} cell(s). ⛔ They are drawn WITHOUT replacement — two enemies `
                + 'in one tile is a placement that lies about being two — so a blob with fewer '
                + 'cells than bodies is refused rather than stacked.' } };
    }
    const ports = openChamberMouths(site, rng);
    /**
     * ⛓ ONE `pick` PER BODY, over the cells still free, in the blob's row-major
     * order. ⛔ The candidate list SHRINKS, which is what "without replacement"
     * means for a draw: the second body's `pick` is over a strictly smaller
     * list, so two bodies can never be one.
     */
    const free = [...cells];
    const bodies = [];
    for (let i = 0; i < values.bodies; i += 1) {
        const cell = rng.pick(free);
        free.splice(free.indexOf(cell), 1);
        bodies.push({ x: cell.x, y: cell.y, id: arenaBodyId(i) });
    }
    return { placement: {
        tiles,
        /**
         * ⛔ THE BODIES ARE `obstacles`, WHICH IS THE KILL GATE'S OWN BUCKET
         * for the thing whose death opens its lock. They are not `blocks` (a
         * block is pushed), not `buttons` (a button is stood on) and not
         * `items` (an item is taken).
         */
        entities: { blocks: [], buttons: [], obstacles: bodies, items: [] },
        ports,
        /** ⛔ EMPTY ON PURPOSE — see the file docblock's last paragraph. */
        demand: [],
        /** ⛓ THE WHOLE BLOB, exactly as `openChamber` declares it: an arena is
         *  a place the graph may use, and being a fight does not stop it being
         *  a room. */
        area: { cells, kind: 'element' },
        /**
         * ⛔ **NOTHING IS HELD AND NOTHING IS GRANTED**, and the first half is
         * load-bearing: `symbols.holds` is how an element says *this obstacle
         * of mine is a DOOR the area graph may bind to*, and the binding reads
         * exactly that to decide whether a FLAG belongs one step past it (arc
         * 5, slice 4). An arena's obstacles are BODIES; its lock is the
         * binding's, on the room's main path, and it is opened by the game's
         * own `totalEnemies() == 0` rule rather than by a symbol.
         */
        symbols: { holds: [], grants: [] },
        cost: { w: site.w, h: site.h, cells: cells.length, bodies: bodies.length },
    } };
}

/** The invariants only THIS element can state — asked on every construct. */
function assertArenaPlacement(placement, { site, values, fail }) {
    const { blocks, buttons, obstacles, items } = placement.entities;
    if (blocks.length || buttons.length || items.length) {
        fail('arena: an arena puts BODIES in the room and nothing else — got '
            + `${blocks.length} block(s), ${buttons.length} button(s), ${items.length} item(s). `
            + 'A block or a button here would be a guard wearing this element\'s name.');
    }
    if (obstacles.length !== values.bodies) {
        fail(`arena: \`bodies\` is ${values.bodies} and the placement carries `
            + `${obstacles.length} obstacle(s). The parameter IS the count — a placement that `
            + 'disagreed would make every census column about `bodies` a column about nothing.');
    }
    const seen = new Set();
    for (let i = 0; i < obstacles.length; i += 1) {
        const o = obstacles[i];
        if (o.id !== arenaBodyId(i)) {
            fail(`arena: body ${i} carries the id ${JSON.stringify(o.id)} and the binding looks `
                + `up ${JSON.stringify(arenaBodyId(i))}. The ids are the MAPPING's keys.`);
        }
        if (o.x < site.x || o.y < site.y || o.x >= site.x + site.w || o.y >= site.y + site.h) {
            fail(`arena: body ${i} stands at (${o.x},${o.y}), outside the ${site.w}x${site.h} `
                + `site at (${site.x},${site.y}). A body outside the blob is a body in a room `
                + 'the element did not build and cannot claim to confine.');
        }
        if (seen.has(`${o.x},${o.y}`)) {
            fail(`arena: two bodies stand on (${o.x},${o.y}). They are drawn WITHOUT `
                + 'replacement, so a repeat is a defect in the draw rather than an unlucky room.');
        }
        seen.add(`${o.x},${o.y}`);
    }
    if (placement.symbols.holds.length !== 0 || placement.symbols.grants.length !== 0) {
        fail('arena: an arena holds and grants NOTHING. Its lock is the BINDING\'s, on the '
            + 'room\'s main path, and the game\'s `totalEnemies() == 0` is what opens it — a '
            + 'symbol here would ask the area graph to bind a door that has no key.');
    }
    if (site.w < MIN_CHAMBER || site.h < MIN_CHAMBER) {
        fail(`arena: ${site.w}x${site.h} is under ${MIN_CHAMBER} on an axis, so the blob has no `
            + 'all-floor 2x2 square and is CORRIDOR by `wideBlobs`\' own rule — and a corridor '
            + 'is the geometry arc-3 §15.9 measured 20 of 23 enemy classes REFUSING.');
    }
    if (placement.area.cells.length !== site.w * site.h) {
        fail(`arena: the declared area is ${placement.area.cells.length} cell(s) and the site `
            + `is ${site.w}x${site.h} = ${site.w * site.h}. The blob IS the site.`);
    }
    assertBlobMouths(placement, { site, fail, owner: 'arena' });
}

export const ARENA = defineElement({
    name: 'arena',
    family: 'arena',
    why: 'The CHAMBER WEAPONISED (arc-5 §3.4; design catalogue #4/#6): `openChamber`\'s own '
        + 'blob, declared as an area exactly as it is, with `bodies` enemies standing in it '
        + 'and a KILL LOCK the binding puts on the room\'s main path. ⛓ Arc-3 §15.9 measured '
        + 'why the space matters: 20 of 23 enemy classes SOLVE a 6x6 chamber and 20 of 23 '
        + 'REFUSE a 1-wide corridor, so a fight needs somewhere to happen.',
    params: [
        { key: 'w', domain: [2, 3, 4, 5, 6], default: 4,
            why: 'the blob\'s width — `openChamber`\'s own domain and for its own two reasons '
                + '(2 is the smallest rectangle the 2x2 rule calls a chamber; 6 is where the '
                + 'reserved rectangle stops fitting the DEFAULT 10x10 room\'s interior).' },
        { key: 'h', domain: [2, 3, 4, 5, 6], default: 4,
            why: 'the blob\'s height, on the same domain. ⛓ Separate from `w` because a '
                + 'non-square blob has two orientations and the site pick offers both.' },
        { key: 'bodies', domain: BODIES_DOMAIN, default: 1,
            why: '⚖ design §7c, the user\'s named item: how many enemies stand in the blob, '
                + 'ONE lock, opened by the game\'s own `totalEnemies() == 0`. ⛔ COST-FIRST '
                + '(⚖ arc-5 ruling 9): the domain is what the D0 pricing arm measured as sane '
                + '— see `BODIES_DOMAIN` and the as-built §12.' },
    ],
    construct(values, site, rng) {
        const out = buildArena(values, site, rng);
        return out.refused ? out : out.placement;
    },
    footprint: openChamberFootprint,
    assertPlacement: assertArenaPlacement,
});
