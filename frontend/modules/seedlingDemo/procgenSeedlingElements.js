/**
 * seedlingDemo/procgenSeedlingElements — **THE SEEDLING ELEMENT BINDING**: the
 * reverse-pull block gadget (`procgenCore/elements/reversePullBlock.js`, the
 * SAME element the maze binds) mapped onto Seedling's parts, placed ELEMENTS
 * FIRST with the composite carve, GUARDING a `buttonroom` FLAG whose lock is a
 * CUT of the main path.
 *
 * PROCGEN ELEMENTS arc 3, slice 3 (`NewDocs/plans/procgen-elements-arc3-
 * kickoff.md` §3.4, D2-D4). The maze's binding (`mazeRoom/procgenMaze.js` §10)
 * is the PATTERN — read, not imported: the two substrates share the ELEMENT and
 * the CONTRACT, and nothing else. Everything here is Seedling's own vocabulary
 * (`{tx,ty}` anchors, terrain records, `tset`/`tag` attributes,
 * `placementGroupId`/`placementTagId`).
 *
 * ── ⛓⛓⛓ THE CERTIFICATION GAP — MEASURED BY SLICE 3, CLOSED BY SLICE S1 ──
 *
 * ⚖ Design ruling 22's shape is *block on `Button`(A) HOLDS `Lock`(A) open →
 * the player reaches `ButtonRoom`(B) → pressing it PERMANENTLY opens the
 * level's `Lock`(B)s → collect*. Slice 3 shipped this binding UNCERTIFIED
 * because the solver could not drive that chain, and measured why on a
 * hand-drawn room (arc-3 kickoff §10.2) rather than discovering it from a yield
 * table. **Slice S1 ("nested openers") built the capability**, and the same
 * placements now certify — 16 of 18 at `len=2`, 16 of 16 at `len=3`, every one
 * with the lifted claim `true`. The three gaps and what closed each:
 *
 *   · **NO SUB-ORDER FOR A BLOCK IN THE WAY OF ANOTHER OBSTACLE'S STANCE.** The
 *     frontier names `lock`(B), `refineStrategy` correctly KEEPS `hold` (the
 *     presser is a LATCHING `buttonroom`, `activators.localPublish`), and
 *     `deriveHoldStance` refused BY NAME. The cell that blocked it was **the
 *     gadget's own BLOCK**, not `lock`(A) — measured by ablation, one entity at
 *     a time — because the reverse-pull geometry puts the block in the entry
 *     lane by construction (`entry0 = stances[len]`, the block is `path[len]`).
 *     ⇒ S1's `stancePrerequisite`: the derivation may answer *"reachable once
 *     `<id>` is discharged"*, and `walkTo` — the ONE place a stance becomes a
 *     walk — raises that as an order, executes it, and re-derives. Its MECHANISM
 *     arm is what keeps this element's block from being spent as scenery: the
 *     prerequisite is `lock`(A), whose own `weigh` parks the block on
 *     `button`(A) and clears the lane in the same act.
 *   · **AN OPTIMISTIC HYPOTHESIS WITH NO DURABLE REDEEMER.** ⇒ guard (iii) in
 *     `stanceHypothesis`: an activator whose verb is `weigh` and whose weigh no
 *     block can serve is a WALL, because the only order left for it is a `hold`
 *     the walker shuts again by leaving.
 *   · **NO "ALREADY HOME" ARM.** ⇒ the dwell-only `weigh`.
 *
 * ⛔ THE BINDING ITSELF DID NOT CHANGE FOR ANY OF IT. Certification is still the
 * solve's own verdict, a refusal is still published with the solve's own words,
 * and a refused gadget is still DROPPED rather than forced: no template-side
 * trick, no widened catch, no gate on `span`/`len` that hides a class.
 *
 * ── ⛓ THE FLAG'S VERB IS `hold`, NOT `touch` — a DELTA against §3.4 ────
 *
 * Design §4.2.1 and the arc-3 kickoff both say the `ButtonRoom` flag is
 * certified by the `touch` verb. It is not: `solverBot.resolveTouchStrategy`
 * keys on `activators.TOUCH_RESPONDERS`, which is `shieldlock`/`shieldlocknorm`
 * (its own rejection text is about `tSet = -2`). A `buttonroom` with `room = -1`
 * is reached by `refineStrategy` KEEPING `hold`, because `localPublish` is
 * non-null for a latch — the L20 shape `procgenWeigh.test.js` already drives.
 * D1(a)'s OPEN arm is the positive control: one `{strategy:'hold'}` record on
 * the buttonroom, then the walk, then the collect, with `lock`(B) open and
 * nobody standing on the presser.
 *
 * ── ⛓⛓ THE SITE MARGIN IS **MEASURED**, AND IT IS NOT THE MAZE'S ───────
 *
 * `procgenMaze.SITE_MARGIN` is 4 — sized for `turns` up to 3, where every turn
 * costs a corner cell. On a 10x10 room with an 8x8 interior that fits NOTHING:
 * D1(b)'s census found **zero candidate sites at `len+4` for len 3 and 4, on
 * every kind and all 12 seeds**, because the reserved rectangle (site + 1) is
 * then 7x7 or 8x8 and cannot avoid both the start and the goal. At `turns = 0`
 * the gadget's own extent is `len + 2` along the pull axis and `EXIT_RUN + 1 =
 * 4` across, so `SITE_MARGIN_STRAIGHT = 2` is the SNUG size — and a len-2
 * gadget then fits `MIN_SITE` (4x4) exactly. ⛔ No bound was widened and the
 * room did not grow (⚖ arc-3 ruling 7); the margin was measured and the census
 * publishes both arms.
 *
 * ── ⛓⛓⛓ ARC 5 SLICE 2: **AND THE SNUG SIZE WAS ONLY SNUG ON ONE AXIS** ──
 *
 * `len + 2` is the PULL axis's number and the square applied it to the other
 * one, which never needed more than 4. Arc-3 §18.2 C1 measured what that cost
 * — the guard census fell 29 → 21 of 360 when the goal draw moved goals
 * centrally, with `no-site-fits-this-room` at **130 of 360** and ZERO
 * placements at `len = 4` on every kind — and named a snug, non-corner-aligned
 * site as the recovery.
 *
 * ⇒ the ELEMENT now declares its own footprint per orientation
 * (`procgenCore/elements.assertFootprints`; the gadget's is
 * `reversePullFootprint`) and `seedlingElementSiteCandidates` enumerates every
 * orientation. Measured on the same census, same command: **`no-site-fits-
 * this-room` 130 → 0 and PLACED 21 → 62 of 360**, with all three declared
 * orientations drawn (`wide` 29 · `tall` 23 · `square` 10).
 *
 * ⛔ **AND IT MOVED NO COMMITTED ARTIFACT AT THE TIME**, which was a fact about
 * the DEFAULT and not a claim about the change: `defaultElementsFor` then pinned
 * the biome's guard at `len = 2`, whose snug footprint IS the 4x4 square the
 * binding already sized. The recovery lived entirely in `len` 3 and 4, which no
 * default drew.
 *
 * ⛓⛓⛓ **AND THAT IS EXACTLY WHY THE PIN CAME OFF AT THE CLOSE** (arc 5, slice
 * 6a; ⚖ ruling 8): a default that could not reach the recovery was a default
 * hiding a real improvement (trap 447). The biome guard member is now BARE and
 * draws `len` over `[2..6]`, and the arc's ONE re-record — reserved by ⚖ ruling
 * 6, left unspent by slice 2 — is what paid for it.
 */

import { TILE_FLOOR } from '../shared/procgen/mazeAlgorithms/gridTiles.js';
import {
    DIR_DELTA, LAW_CUT, LAW_SHORTCUT, chooseEntryPort, guardIdsFor,
} from '../procgenCore/elements.js';
import { KILL_BODY_ID, KILL_DOOR_ID } from '../procgenCore/elements/killGate.js';
import {
    SHORTCUT_BODY_ID, SHORTCUT_DOOR_ID,
} from '../procgenCore/elements/shortcut.js';
import { connected, reachableFrom, shortestPath } from '../procgenCore/gridFlood.js';
import { ELEMENT_TABLE, NONE as ELEMENTS_NONE } from '../procgenCore/elementSpec.js';

export class ProcgenSeedlingElementError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProcgenSeedlingElementError';
    }
}

const fail = (message) => { throw new ProcgenSeedlingElementError(message); };

/**
 * ⛓ THE SNUG SIZE FOR A STRAIGHT LANE — MEASURED (see the file docblock).
 * ⛔ Named `_STRAIGHT` because it is only right at `turns = 0`, which is the
 * only value this arc's Seedling binding admits (⚖ arc-3 ruling 1); a bent
 * gadget needs the maze's 4 and arrives with the CHAIN (arc 4).
 */
export const SITE_MARGIN_STRAIGHT = 2;

/**
 * ⛓⛓⛓ **THE CENSUS KEY FOR THE SEEDLING ELEMENT PATH** — every refusal name
 * any Seedling ELEMENT path can produce, WHEREVER IT FIRES.
 *
 * ⛔⛔ IT IS A CENSUS KEY, NOT A DESCRIPTION OF THIS MODULE, and the difference
 * is a fact the generated refusal table publishes rather than a detail. THREE
 * of the names below are raised by a DIFFERENT module and never by this one:
 *
 *   `the-chain-is-arc-4`                          `procgenSeedling.js`
 *   `the-skeleton-does-not-solve-with-the-element` `procgenSeedling.js`
 *   `no-site-fits-this-room`                       `procgenSeedling.js` AND
 *                                                  `mazeRoom/procgenMaze.js`
 *
 * They belong here because the census that counts a Seedling run's element
 * refusals is keyed on THIS list, and a name it cannot count is a hole in the
 * count — which is exactly what `the-tunnel-shortens-the-way-to-the-goal` was
 * until PROCGEN DOCS · P5. The generated table found it: the constant said
 * *every*, the literal scan of this file found a name the constant lacked, and
 * the finding sat on the reference page for two slices before it was fixed.
 *
 * ⛓ THE GATE IS `procgenCore/refusalCensus.test.js` — it runs the reference
 * generator's OWN literal scan over the named sources and asserts this
 * constant ⊇ the scan. ⛔ The generator never edits the code it reads, so the
 * gate is what makes the docblock's *every* a checked word rather than a
 * hopeful one.
 */
export const SEEDLING_ELEMENT_REFUSALS = Object.freeze([
    'the-chain-is-arc-4',
    'no-site-fits-this-room',
    'the-entry-mouth-is-the-rooms-border-ring',
    'the-entry-port-cannot-be-joined',
    'the-elements-demand-is-not-met',
    'the-reserved-rectangle-seals-the-room',
    'the-cell-beyond-the-guard-door-is-not-floor',
    'the-guard-is-not-a-cut-of-the-level',
    'no-cut-for-the-flag-lock',
    /** ⛓ arc 5, slice 4 — the SAME cut rule for an element that declares BODIES;
     *  named apart so a census never says "the flag" about a room with none. */
    'no-cut-for-the-kill-lock',
    'the-skeleton-does-not-solve-with-the-element',
    /** ⛓ arc 3 slice 4a — the `on-connector` composite's own three. Each is
     *  TRUE BY CONSTRUCTION for the two elements shipped here (they filter with
     *  the very law this re-asks), so each is trap 296's shape on real data and
     *  each has a unit row that hands the composite a placement it must refuse. */
    'the-elements-carve-is-not-legal',
    'the-elements-door-is-not-a-cut',
    'the-elements-write-lands-on-the-start-or-the-goal',
    /**
     * ⛓⛓ arc 5, slice 5 — the SHORTCUT's own two, named APART from
     * `the-elements-door-is-not-a-cut` on the same rule that split
     * `no-cut-for-the-kill-lock` off `no-cut-for-the-flag-lock` one slice
     * earlier: a census that filed a shortcut's refusal under "the door was not
     * a cut" would say the opposite of what happened, about a thing whose whole
     * job is not being a cut.
     */
    'the-elements-shortcut-is-not-a-shortcut',
    'the-elements-shortcut-law-is-not-offered',
    /** ⛓⛓ P5 — THE NAME THE LIST WAS MISSING, and unlike the three above it
     *  this one FIRES ON REAL DATA: slice 2's carve rule's NO-SHORTCUT clause,
     *  re-asked of the whole composite, refused 4 of the census's cells. It is
     *  raised in this file, by `compositeSeedlingElement`'s clause (vi). */
    'the-tunnel-shortens-the-way-to-the-goal',
]);

/** The RESERVED rectangle: the site plus the one-cell ring the binding writes. */
export const reservedRect = (site) => Object.freeze({
    x: site.x - 1, y: site.y - 1, w: site.w + 2, h: site.h + 2,
});

const inRect = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const NB4 = Object.freeze([[0, -1], [0, 1], [-1, 0], [1, 0]]);

/**
 * ⛓⛓ EVERY LEGAL SITE, ROW-MAJOR — the list ONE `pick` draws from, and a
 * function of the ROOM and the FOOTPRINTS alone (never of the carve), so the
 * site is decided before a single wall exists. The maze's three conditions, in
 * Seedling's vocabulary:
 *
 *  1. the site is off the room's own BORDER RING (which is wall and must stay
 *     wall — `procgenSeedling`'s own carve check);
 *  2. the RESERVED rectangle holds neither the START nor the GOAL — both are
 *     cells the level needs and the ring walls everything it covers;
 *  3. (implied by 1) the ring may overlap the border ring, which costs nothing:
 *     writing `wall` over wall is a no-op.
 *
 * ── ⛓⛓⛓ ARC 5, SLICE 2: **ORIENTED RECTANGLES, ONE LIST, STILL ONE `pick`** ──
 *
 * `footprints` is the element's own snug extents per orientation
 * (`procgenCore/elements.assertFootprints`) — `[{w, h, orient}]`, never a
 * single `size`. The enumeration is still ROW-MAJOR over the room and the draw
 * is still ONE `pick`; what changed is that the LIST is longer, because a
 * `len = 4` gadget that really needs 6x4 fits 15 positions each way where the
 * 6x6 square it used to be offered fit 9.
 *
 * ⛔ **THE ORDER IS ROW-MAJOR FIRST, ORIENTATION SECOND**, and that is the
 * shape of the identity: at ONE cell the footprints are offered in the
 * element's own declaration order, then the walk moves on. A list assembled
 * footprint-by-footprint would hold the same SET in a different ORDER, which
 * is a different `pick` for the same draw — the `feedback_grouping_reorders_
 * so_assert_the_set` law read from the other side, so the unit row asserts the
 * literal order and not the set.
 *
 * ⛔ **A SINGLE SQUARE FOOTPRINT REPRODUCES THE OLD LIST EXACTLY**, which is
 * what lets a binding with no footprint-declaring element keep its stream: the
 * caller passes `[{w: size, h: size, orient: 'square'}]` and the walk below is
 * the walk that was here before the orientation existed.
 *
 * @param {Array<{w,h,orient}>} o.footprints the element's snug extents.
 */
export function seedlingElementSiteCandidates({ width, height, start, goal, footprints }) {
    const out = [];
    for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
            for (const f of footprints) {
                if (x + f.w > width - 1 || y + f.h > height - 1) continue;
                const r = reservedRect({ x, y, w: f.w, h: f.h });
                if (inRect(r, start.tx, start.ty) || inRect(r, goal.tx, goal.ty)) continue;
                out.push(Object.freeze({ x, y, w: f.w, h: f.h, orient: f.orient }));
            }
        }
    }
    return out;
}

/**
 * ⛓⛓⛓ **THE FLAG'S LOCK — WHICH CELL, EXACTLY.**
 *
 * ⚖ Ruling 22's `Lock`(B) has to be a CUT of the main path, or the flag opens a
 * door the walk never needed. Slice 4's area binding will take over WHICH cell
 * (it will be a boundary cell of the area the goal is in); THIS slice's rule is
 * stated here in one sentence and measured by the census:
 *
 *   **the LAST cell of one canonical shortest start->goal path, walking from
 *   the GOAL end backwards, that (a) is not the start or the goal, (b) is not
 *   inside the element's reserved rectangle, (c) is not 4-ADJACENT to the goal,
 *   (d) DISCONNECTS the goal from the start when walled, and (e) leaves the
 *   element's ENTRY MOUTH still reachable from the start when walled.**
 *
 * — i.e. *the first main-path cut cell after the mouth, nearest the goal.*
 *
 * ⛔ (c) IS A MEASUREMENT, NOT TIDINESS. D1(a)'s first fixture put the lock
 * 4-adjacent to the goal and the solve refused for a reason that has nothing to
 * do with the gadget: *"approaching torchpickup@…, the sweep was blocked by
 * lock at (…). A pickup is not solid, so the planner and the geometry disagree
 * about the approach."* A lock on the goal's own doorstep breaks the COLLECT
 * ceremony's approach sweep, so a level built with one is unsolvable for a
 * reason no reader would attribute to the flag.
 *
 * ⛔ (e) IS THE DOOR LAW'S START-SIDE CLAUSE, one layer out (slice 2 §9.3): the
 * thing that OPENS `lock`(B) is inside the element, so the element's mouth must
 * be on the START's side of `lock`(B) or the room has no answer.
 *
 * ⛔ AND THE PATH IS `gridFlood.shortestPath`'s ONE canonical path (slice 1
 * §8.5): NOT "every cell at that distance". A cut cell off that path is a cut
 * this rule does not offer, which is a PROPOSAL narrowing and not a legality
 * claim — the census is what says how often it costs a placement.
 *
 * @returns {{cell}|{refused:{reason, detail}}}
 */
export function flagLockCellFor({ width, height, walkable, start, goal, reserved, entryMouth,
    /** ⛓ THE DEFAULT IS THE GUARD'S, and both PRODUCTION callers pass their own
     *  anyway (arc 5, slice 4) — the literal at the CALL SITE is what the
     *  refusal census scans for, and the default is what keeps a direct caller
     *  (a unit row handing this function a room) from getting `undefined`. */
    reason = 'no-cut-for-the-flag-lock' }) {
    const path = shortestPath(width, height, walkable, start, goal);
    if (!path) {
        return { refused: { reason: 'the-reserved-rectangle-seals-the-room',
            detail: `no ground path from the START (${start.x},${start.y}) to the GOAL `
                + `(${goal.x},${goal.y}) once the element's ring is walled.` } };
    }
    const tried = [];
    for (let i = path.length - 2; i >= 1; i -= 1) {
        const c = path[i];
        if (c.x === start.x && c.y === start.y) continue;
        if (c.x === goal.x && c.y === goal.y) continue;
        if (inRect(reserved, c.x, c.y)) { tried.push(`(${c.x},${c.y}) is inside the element`); continue; }
        if (NB4.some(([dx, dy]) => c.x + dx === goal.x && c.y + dy === goal.y)) {
            tried.push(`(${c.x},${c.y}) is 4-adjacent to the goal`);
            continue;
        }
        const walled = (x, y) => walkable(x, y) && !(x === c.x && y === c.y);
        if (connected(width, height, walled, start, goal)) {
            tried.push(`(${c.x},${c.y}) is not a cut`);
            continue;
        }
        if (!connected(width, height, walled, start, entryMouth)) {
            tried.push(`(${c.x},${c.y}) leaves the entry mouth GOAL-side`);
            continue;
        }
        return { cell: Object.freeze({ x: c.x, y: c.y }) };
    }
    return { refused: { reason,
        detail: `no cell of the ${path.length}-cell main path can carry `
            + `the ${reason === 'no-cut-for-the-kill-lock' ? 'arena\'s kill' : 'flag\'s'} lock: `
            + (tried.length ? tried.join('; ') : '(the path is two cells)')
            + '. ⛔ The element is REFUSED rather than placed as DECORATION: a `buttonroom` '
            + 'whose `lock`(B) is not a cut opens a door the walk never needed, which is '
            + '⚖ ruling 17\'s own definition of decoration. ⛓ On the OPEN room this is the '
            + 'ordinary answer and slice 2\'s door census says why — on `empty` a span-1 '
            + 'door cuts NOTHING (0 anchors at spans 1..7, 384 at span 8), so a one-cell '
            + 'lock is a CORRIDOR mechanism.' } };
}

/**
 * ⛓⛓⛓ **THE CELLS WITHIN `radius` STEPS OF A CELL** — PROCGEN ELEMENTS arc 3,
 * slice 4b, and it lives here because it is what SUPERSEDES `flagLockCellFor`
 * above: where that rule picked ONE main-path cut cell, this one describes the
 * neighbourhood the area graph's locks must stay OUT of, and the VESTIBULE the
 * goal's own synthetic area is grown into so that they can.
 *
 * ⛔ **IT IS A BOUNDED NEIGHBOURHOOD, NOT A SECOND FLOOD.** `gridFlood` is the
 * ONE flood family and it has no distance member — `reachableFrom` answers
 * *which cells*, never *how far*. This asks a different question: the cells at
 * graph distance <= a CONSTANT, expanded `radius` times over the 4-neighbours
 * and never asking reachability at all. Adding a distance map to `gridFlood`
 * for one caller would put a member on the shared surface that only this rule
 * reads; stating the expansion here, bounded by a constant the caller names,
 * keeps the flood family at one.
 *
 * @param {object} o
 * @param {number} o.width
 * @param {number} o.height
 * @param {(x,y)=>boolean} o.walkable the room's ground predicate.
 * @param {{x,y}} o.goal the centre — always included, walkable or not (a goal
 *   cell is ground by construction, and asking would make the rule depend on a
 *   fact the caller already guarantees).
 * @param {number} o.radius how many steps out. `0` is the goal alone.
 * @param {Array<{x,y}>} [o.exclude] cells that belong to somebody else (the
 *   element's declared area) and may not be taken.
 * @returns {Array<{x,y}>} row-major, frozen.
 */
export function vestibuleCellsAround({ width, height, walkable, goal, radius, exclude = [] }) {
    const key = (x, y) => `${x},${y}`;
    const blocked = new Set(exclude.map((c) => key(c.x, c.y)));
    const seen = new Set([key(goal.x, goal.y)]);
    let frontier = [{ x: goal.x, y: goal.y }];
    for (let step = 0; step < radius; step += 1) {
        const next = [];
        for (const c of frontier) {
            for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
                const nx = c.x + dx;
                const ny = c.y + dy;
                const k = key(nx, ny);
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                if (seen.has(k) || blocked.has(k) || !walkable(nx, ny)) continue;
                seen.add(k);
                next.push({ x: nx, y: ny });
            }
        }
        frontier = next;
    }
    return Object.freeze([...seen]
        .map((k) => {
            const [x, y] = k.split(',').map(Number);
            return Object.freeze({ x, y });
        })
        .sort((a, b) => (a.y - b.y) || (a.x - b.x)));
}

/**
 * ⛓⛓⛓ **THE COMPOSITE + EVERY CHECK ON THE WAY OUT** (trap 272's shape), in
 * the maze's order and with the maze's reasons — see `procgenMaze.js`'s section
 * docblock for the four decisions the ELEMENTS CENSUS took (the ring is the
 * BINDING's; the carve's answer inside the rectangle is DISCARDED; the EXIT
 * MOUTH IS SEALED; a snug site).
 *
 * ⛔ IT WRITES A MASK, NOT A RECORD. The caller owns the record: this returns
 * the cells to paint and the entities to add, so `seedlingModel` keeps ONE
 * writer (`withTerrain`/`withEntities`) and this file never learns the record
 * format. ⛔ AND IT SPENDS NO DRAW — every decision here reads tiles.
 *
 * @returns {{placed}|{refused:{reason, detail}}}
 */
export function compositeSeedlingElement({
    width, height, groundAt, site, placement, start, goal,
}) {
    const mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) if (groundAt(x, y)) mask[x + y * width] = 1;
    }
    const at = (x, y) => x >= 0 && y >= 0 && x < width && y < height && mask[x + y * width] === 1;
    const set = (x, y, v) => { mask[x + y * width] = v ? 1 : 0; };
    const reserved = reservedRect(site);
    /**
     * ⛓⛓⛓ **THE MOUTH IS PICKED HERE, OUT OF EVERY ONE THE ELEMENT DECLARED**
     * — PROCGEN ELEMENTS arc 5, slice 4, and it is slice 3's named carry
     * (§11.11 residue 2) rather than a generalisation for its own sake.
     *
     * A mouth is the cell one step OUTWARD from an entry port, and Seedling's
     * border ring is what makes the room a room — so a mouth that lands on it
     * cannot be opened and the placement is refused BY NAME. Slice 3 counted
     * the price of the element choosing alone: **28 of 70 refusals at 10x10**
     * carried that name, and 0 at 20x20, because a small room is where a snug
     * site sits against the interior's edge.
     *
     * ⛔ THE ELEMENT STILL DECIDES, AND THE BINDING STILL DOES NOT REDRAW. The
     * candidates and their ORDER are the element's own (its first is the one
     * its draws chose); this asks each one the single question only the room
     * can answer. A one-entry element — the guard — gets its own port back,
     * which is why this is a strict extension and not a re-record.
     */
    const onBorderRing = (x, y) => x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1;
    const mouthOf = (p) => Object.freeze({
        x: p.x + DIR_DELTA[p.dir].dx, y: p.y + DIR_DELTA[p.dir].dy,
    });
    const chosen = chooseEntryPort(placement,
        (entry) => !onBorderRing(mouthOf(entry).x, mouthOf(entry).y));
    if (chosen.refusedAll) {
        const [first] = chosen.refusedAll;
        const firstMouth = mouthOf(first.entry);
        /**
         * ⛓⛓⛓ **A REFUSAL DETAIL RIDES THE PAYLOAD, SO RE-WORDING ONE SPENDS A
         * RE-RECORD** (arc 5, slice 4; trap 446's sibling one field over). The
         * four-mouth sentence below is NEW INFORMATION only when there is more
         * than one mouth to report — and a ONE-MOUTH element (the guard) is
         * every committed artifact this refusal appears in. Measured: with the
         * new sentence printed unconditionally, the acceptance batch moved on
         * exactly two rows (`ab540ac4…` → `9b4c42ae…`), and a field-by-field
         * diff of both payloads found ONE changed string and not one moved cell.
         * ⇒ the single-mouth branch is the sentence that was here before, byte
         * for byte, and the plural one is the only thing this slice adds.
         */
        return { refused: { reason: 'the-entry-mouth-is-the-rooms-border-ring',
            detail: chosen.refusedAll.length === 1
                ? `the gadget's entry port (${first.entry.x},${first.entry.y}) faces `
                    + `${first.entry.dir}, so its mouth is (${firstMouth.x},${firstMouth.y}) `
                    + '— a cell of the room\'s BORDER RING. Opening it would open the room. '
                    + '⛓ The site is drawn before the element picks its port directions, so '
                    + 'this is decided after the fact and REFUSED rather than redrawn.'
                : `EVERY one of the ${chosen.refusedAll.length} mouth(s) the gadget declared `
                    + 'has its mouth cell on the room\'s BORDER RING — '
                    + `${chosen.refusedAll.map(({ entry }) => `${entry.dir}:(${mouthOf(entry).x},`
                        + `${mouthOf(entry).y})`).join(', ')}. Opening one would open the room. `
                    + `⛓ The element PREFERRED ${first.entry.dir} (its own draw) and the binding `
                    + 'takes the first the room can use (arc 5, slice 4); when the site is '
                    + 'against the interior\'s edge on every side there is none, and the site '
                    + 'is drawn before the element picks its ports, so this is decided after '
                    + 'the fact and REFUSED rather than redrawn.' } };
    }
    const entryPort = chosen.entry;
    const exitPort = chosen.exit;
    const entryMouth = mouthOf(entryPort);

    /** ⛓ THE NON-VACUITY WITNESS: how many cells the carve had made different
     *  from what the element wants. `0` means the reservation decided nothing on
     *  this seed and every check below proves nothing about it. */
    let carveOverwrote = 0;
    const painted = new Map();
    const paint = (x, y, ground) => {
        painted.set(`${x},${y}`, ground ? 'ground' : 'wall');
        set(x, y, ground);
    };
    for (const t of placement.tiles) {
        const ground = t.tile === TILE_FLOOR;
        if (at(t.x, t.y) !== ground) carveOverwrote += 1;
        paint(t.x, t.y, ground);
    }
    /**
     * ⛔ THE RING IS WALL EXCEPT THE ENTRY MOUTH — the exit mouth is SEALED.
     * The maze measured the alternative: with both mouths open the player walks
     * round the OUTSIDE of the site and the guard door is not a cut on ~30% of
     * runs (arc-2 §10.1 arm `bothjoin`).
     */
    for (let y = reserved.y; y < reserved.y + reserved.h; y += 1) {
        for (let x = reserved.x; x < reserved.x + reserved.w; x += 1) {
            if (x < 0 || y < 0 || x >= width || y >= height) continue;
            if (inRect(site, x, y)) continue;
            paint(x, y, x === entryMouth.x && y === entryMouth.y);
        }
    }
    /**
     * ⛓⛓ THE CONNECTOR JOINS THE ENTRY MOUTH — the SHORTEST tunnel to floor the
     * START already reaches, breadth-first in the one neighbour order, NEVER
     * entering the reserved rectangle and never touching the border ring.
     *
     * ⛔ **AND IT IS A CARVE, SO SLICE 2's CARVE RULE IS ANSWERED HERE BY NAME.**
     * That rule has two clauses (§9.5): a carve is a DEAD END (one blob, one
     * mouth) and it is NO SHORTCUT. The tunnel is legal under it as follows:
     *  · NO-SHORTCUT holds and is CHECKED below (the start->goal distance is
     *    compared before and after the whole composite);
     *  · DEAD-END does NOT apply and must not: the tunnel exists precisely to
     *    JOIN two live regions — the element's mouth and the carve — so it has
     *    two ends by construction. ⚖ The template rule's clause (a) is about a
     *    POCKET (somewhere to stand); this is a CORRIDOR (somewhere to walk),
     *    and the thing that keeps it honest is that it may not enter the
     *    reserved rectangle, which is what stops it opening a second way in.
     */
    const live = reachableFrom(width, height, at, { x: start.tx, y: start.ty });
    const beforeLen = (() => {
        const p = shortestPath(width, height, groundAt,
            { x: start.tx, y: start.ty }, { x: goal.tx, y: goal.ty });
        return p ? p.length : null;
    })();
    let tunnel = [];
    if (!live.has(`${entryMouth.x},${entryMouth.y}`)) {
        const parent = new Map([[`${entryMouth.x},${entryMouth.y}`, null]]);
        const queue = [entryMouth];
        let hit = null;
        while (queue.length && hit === null) {
            const p = queue.shift();
            for (const [dx, dy] of NB4) {
                const nx = p.x + dx;
                const ny = p.y + dy;
                // ⛔ never the border ring, never the reserved rectangle.
                if (nx <= 0 || ny <= 0 || nx >= width - 1 || ny >= height - 1) continue;
                if (inRect(reserved, nx, ny)) continue;
                const k = `${nx},${ny}`;
                if (parent.has(k)) continue;
                parent.set(k, `${p.x},${p.y}`);
                if (live.has(k)) { hit = k; break; }
                queue.push({ x: nx, y: ny });
            }
        }
        if (hit === null) {
            return { refused: { reason: 'the-entry-port-cannot-be-joined',
                detail: `the gadget's entry mouth (${entryMouth.x},${entryMouth.y}) has no `
                    + 'route to any ground the START reaches that stays outside the reserved '
                    + 'rectangle and off the border ring.' } };
        }
        /** ⛔ THE WALK STOPS **BEFORE** THE MOUTH — the mouth is a RING cell,
         *  already written ground by the ring pass, and including it would make
         *  "the tunnel never enters the reserved rectangle" false for every
         *  joined gadget (the maze's own §10.5 defect 2). */
        for (let k = parent.get(hit); parent.get(k) !== null; k = parent.get(k)) {
            const [cx, cy] = k.split(',').map(Number);
            paint(cx, cy, true);
            tunnel.push(Object.freeze({ x: cx, y: cy }));
        }
        tunnel = tunnel.reverse();
    }

    // ── (i) `demand` — the element's own claim about what it does NOT write ──
    for (const dm of placement.demand) {
        if (dm.x < 0 || dm.y < 0 || dm.x >= width || dm.y >= height) continue;
        if (dm.x === entryMouth.x && dm.y === entryMouth.y) continue;
        if (at(dm.x, dm.y) !== (dm.must === 'floor')) {
            return { refused: { reason: 'the-elements-demand-is-not-met',
                detail: `the gadget demands ${dm.must} at (${dm.x},${dm.y}) and the finished `
                    + 'room has the other. ⛓ The binding WRITES the ring, so this is a check '
                    + 'that the writing was right — the element\'s demand and the binding\'s '
                    + 'reserved rectangle are two statements of one fact and this is where '
                    + 'they are made to agree (trap 272).' } };
        }
    }

    // ── (ii) the room still works ───────────────────────────────────────
    if (!connected(width, height, at, { x: start.tx, y: start.ty },
        { x: goal.tx, y: goal.ty })) {
        return { refused: { reason: 'the-reserved-rectangle-seals-the-room',
            detail: `walling the gadget's ring cut every ground route from the START `
                + `(${start.tx},${start.ty}) to the GOAL (${goal.tx},${goal.ty}). ⛔ The `
                + 'answer is a smaller gadget, never a hole punched through the ring — that '
                + 'hole would be the second way in the door is supposed to be the only '
                + 'alternative to.' } };
    }

    /**
     * ⛓⛓⛓ **(iii)-(v) ARE THE GUARD'S HALF, AND AN ELEMENT THAT IS SPACE HAS
     * NONE** — PROCGEN ELEMENTS arc 5, slice 3 (§3.3).
     *
     * The three checks below are all about ONE DOOR: the FLAG sits one step
     * past it, that door has to be a CUT of the level, and the flag's own LOCK
     * goes on a main-path cut. They exist because the guard element declares an
     * `obstacle` — a door — and the binding realises the symbol it holds as a
     * `buttonroom` beyond it (⚖ rulings 21-22).
     *
     * ⛔ **THE TEST IS WHAT THE ELEMENT DECLARED, NOT WHICH ELEMENT IT IS.** An
     * `openChamber` declares no obstacle, no block, no button and no symbol —
     * so there is no door to be a cut of anything, no cell beyond it, and no
     * flag to lock. Skipping the three is not a relaxation: each would be asked
     * of `undefined` and would answer a question nobody posed. ⛓ EVERY CHECK
     * THAT IS ABOUT THE ROOM STILL RUNS FOR IT — the mouth's ring cell (above),
     * the element's `demand`, start->goal connectivity through the re-walled
     * ring, and clause (vi)'s NO-SHORTCUT — because those are the BINDING's
     * claims about the room and not the guard's about its door.
     *
     * ⚠ The record then carries `null` in the five guard fields rather than
     * omitting them, so a reader of `elements.placed[0]` never has to ask
     * whether an absent `door` means "no door" or "not recorded".
     */
    /**
     * ⛓⛓⛓ **WHICH OBSTACLE IS A DOOR — ASKED OF `symbols`, NOT OF THE ARRAY**
     * (arc 5, slice 4, and it is slice 3's rule read one turn further).
     *
     * Slice 3 learned to skip (iii)-(v) when an element declares NO obstacle. An
     * ARENA declares obstacles and none of them is a door: they are BODIES, and
     * the thing that opens its lock is the game's `totalEnemies() == 0` rather
     * than a symbol. ⛔ So the test is `symbols.holds` — *this element derives a
     * token while it is satisfied*, which is precisely what makes an obstacle a
     * door the area graph can bind a FLAG behind (⚖ rulings 21-22). An element
     * that holds nothing has no door, whatever it put in the room.
     */
    const doorCell = placement.symbols.holds.length > 0
        ? (placement.entities.obstacles[0] ?? null) : null;
    let flagCell = null;
    let flagLockCell = null;
    if (doorCell !== null) {
        // ── (iii) the FLAG's cell — one step past the door on the exit lane ──
        const dex = DIR_DELTA[exitPort.dir];
        flagCell = Object.freeze({ x: doorCell.x + dex.dx, y: doorCell.y + dex.dy });
        if (!at(flagCell.x, flagCell.y)) {
            return { refused: { reason: 'the-cell-beyond-the-guard-door-is-not-floor',
                detail: `(${flagCell.x},${flagCell.y}) is one step beyond the guard door along `
                    + 'the exit lane and is not ground. The element carves that lane, so this is '
                    + 'a defect in the placement rather than a fact about the room.' } };
        }

        // ── (iv) THE GUARD IS A CUT: the flag is unreachable with the door walled ──
        const doorless = (x, y) => at(x, y) && !(x === doorCell.x && y === doorCell.y);
        if (connected(width, height, doorless, { x: start.tx, y: start.ty }, flagCell)) {
            return { refused: { reason: 'the-guard-is-not-a-cut-of-the-level',
                detail: `with the guard door at (${doorCell.x},${doorCell.y}) treated as WALL the `
                    + `START still reaches the flag at (${flagCell.x},${flagCell.y}). ⛓ THE DOOR `
                    + 'IS THE POINT (⚖ design ruling 17): a guard the player can walk around is '
                    + 'a decoration and the block would never have to be pushed. ⚠ The exit mouth '
                    + 'is SEALED, so on a generated room this is TRUE BY CONSTRUCTION and the '
                    + 'refusal is unfalsifiable on real data (trap 296) — its gate is the unit '
                    + 'row that hands this function a room with a second way in.' } };
        }

        // ── (v) THE FLAG'S LOCK, on a main-path cut ─────────────────────────
        /** ⛓ THE NAME IS PASSED, NOT DEFAULTED (arc 5, slice 4): each caller
         *  names its own lock, and the LITERAL at the call site is what the
         *  refusal census scans for. A default would make one of the two names
         *  invisible to `generate-procgen-reference --check`. */
        const lock = flagLockCellFor({ width, height, walkable: at,
            start: { x: start.tx, y: start.ty }, goal: { x: goal.tx, y: goal.ty },
            reserved, entryMouth, reason: 'no-cut-for-the-flag-lock' });
        if (lock.refused) return lock;
        flagLockCell = lock.cell;
    }

    /**
     * ⛓⛓⛓ **(v′) THE KILL LOCK — THE SAME CUT RULE, FOR AN ELEMENT THAT
     * DECLARES BODIES** (arc 5, slice 4; §3.4).
     *
     * An arena's obstacles are enemies and the thing that opens its lock is
     * the game's own `totalEnemies() == 0`. ⛔ **THE LOCK IS NOT ON THE BLOB'S
     * MOUTH**, which is where the brief put it: the ring is walled and exactly
     * one mouth is opened, so a lock standing in it is the only way to the
     * bodies — the player cannot reach them, the count never falls to zero and
     * the gate never opens. It goes exactly where the guard's `Lock`(B) goes,
     * and by the SAME function: the main-path cut nearest the goal that leaves
     * the element's ENTRY MOUTH on the START's side (`flagLockCellFor` clause
     * (e)). ⇒ the player detours into the arena, clears it, and walks on.
     *
     * ⛔ ONE FUNCTION, TWO CALLERS, AND EACH NAMES ITS OWN LOCK — the refusal
     * is `no-cut-for-the-kill-lock` here and `no-cut-for-the-flag-lock` there,
     * because a census that counted them together would say "the flag" about a
     * room that has no flag.
     */
    const bodies = placement.symbols.holds.length === 0
        ? placement.entities.obstacles : [];
    let killLockCell = null;
    if (bodies.length > 0) {
        const lock = flagLockCellFor({ width, height, walkable: at,
            start: { x: start.tx, y: start.ty }, goal: { x: goal.tx, y: goal.ty },
            reserved, entryMouth, reason: 'no-cut-for-the-kill-lock' });
        if (lock.refused) return lock;
        killLockCell = lock.cell;
    }

    // ── (vi) NO SHORTCUT — slice 2's carve clause (b), asked of the whole composite ──
    const afterPath = shortestPath(width, height, at,
        { x: start.tx, y: start.ty }, { x: goal.tx, y: goal.ty });
    if (beforeLen !== null && afterPath && afterPath.length < beforeLen) {
        return { refused: { reason: 'the-tunnel-shortens-the-way-to-the-goal',
            detail: `the composite would shorten the start->goal path from ${beforeLen - 1} `
                + `steps to ${afterPath.length - 1}. The connector tunnel is a CORRIDOR the `
                + 'binding carves to reach the element\'s mouth, and slice 2\'s carve rule\'s '
                + 'NO-SHORTCUT clause applies to it: pass 1 committed to the skeleton\'s '
                + 'distances.' } };
    }

    return { placed: Object.freeze({
        site: Object.freeze({ ...site }),
        ports: Object.freeze(placement.ports.map((p) => Object.freeze({ ...p }))),
        entryMouth,
        block: placement.entities.blocks[0]
            ? Object.freeze({ ...placement.entities.blocks[0] }) : null,
        button: placement.entities.buttons[0]
            ? Object.freeze({ ...placement.entities.buttons[0] }) : null,
        door: doorCell === null ? null : Object.freeze({ x: doorCell.x, y: doorCell.y }),
        flagCell,
        flagLockCell,
        /**
         * ⛓⛓⛓ **ARC 5, SLICE 4 — PRESENT ONLY WHERE THERE ARE ANY, AND THE
         * PAYLOAD HAS TWO DOORS INTO IT.**
         *
         * Slice 3's five guard fields are `null` on a chamber rather than
         * omitted, so a reader never has to ask whether an absent `door` means
         * "no door" or "not recorded" — and that cost nothing, because a guard
         * placement already carried those keys. A NEW key is different: this
         * record IS `certification.geometry`, verbatim, and that object rides
         * into every payload that holds an element. ⛔ MEASURED: with `bodies:
         * []` and `killLockCell: null` written unconditionally, the acceptance
         * batch moved on a row whose element is a GUARD — two added keys, not
         * one moved cell. `elementSummaryOf`'s conditional spread is NOT enough
         * on its own, because it is only ONE of the two doors.
         *
         * ⇒ a placement that declares no body carries neither key, and the
         * question *"no bodies or not recorded?"* is answered by the element's
         * own name — an `arena` always has at least one.
         */
        ...(bodies.length > 0 ? {
            bodies: Object.freeze(bodies.map((b) => Object.freeze({
                x: b.x, y: b.y, id: b.id,
            }))),
            killLockCell,
        } : {}),
        areaCells: placement.area.cells,
        tunnel: Object.freeze(tunnel),
        carveOverwrote,
        painted: Object.freeze([...painted].map(([k, terrain]) => {
            const [tx, ty] = k.split(',').map(Number);
            return Object.freeze({ tx, ty, terrain });
        })),
        cost: Object.freeze({ ...placement.cost }),
    }) };
}

/**
 * ⛓⛓⛓ **THE `on-connector` COMPOSITE — EVERY CHECK THE BINDING OWES A ROOM-
 * AWARE DOOR**, PROCGEN ELEMENTS arc 3, slice 4a (D1).
 *
 * The pre-carve composite above builds a room AROUND a rectangle. This one does
 * the opposite: the room already exists, the element wrote a SPARSE handful of
 * cells into it, and the binding's job is to ask the two laws the room's own
 * templates are asked — the CARVE rule and the DOOR law — of exactly those
 * cells. ⛔ Both laws are `procgenSeedling`'s, passed in: this file does not
 * own a second copy of either, and that is what "one law, both callers" means
 * at the composite end.
 *
 * ⚠⚠ **ALL THREE REFUSALS ARE TRUE BY CONSTRUCTION FOR THE TWO ELEMENTS
 * SHIPPED HERE** (trap 296, said out loud rather than discovered later): both
 * filter their candidates with `room.doorLaw` — the same function — and both
 * pre-check the dead-end clause, so a placement that reaches this function has
 * already passed. That does not make the checks decoration: they are the
 * CONTRACT an element that did NOT ask would meet, and their gate is the unit
 * rows that hand this function a hand-built placement of each shape.
 *
 * ⛔ IT WRITES A MASK, NOT A RECORD, and it spends NO draw — the pre-carve
 * composite's two rules, unchanged.
 *
 * @returns {{placed}|{refused:{reason, detail}}}
 */
export function compositeSeedlingOnConnector({
    width, height, groundAt, skeletonWallAt, placement, start, goal, doorLaw, carveLaw,
    law = LAW_CUT, shortcutLaw = null,
}) {
    const painted = new Map();
    for (const t of placement.tiles) {
        painted.set(`${t.x},${t.y}`, t.tile === TILE_FLOOR ? 'ground' : 'wall');
    }
    const at = (x, y) => {
        const p = painted.get(`${x},${y}`);
        return p === undefined ? groundAt(x, y) : p === 'ground';
    };
    const before = (x, y) => groundAt(x, y);

    // ── (i) NOTHING LANDS ON THE START OR THE GOAL ──────────────────────
    for (const t of placement.tiles) {
        const isStart = t.x === start.tx && t.y === start.ty;
        const isGoal = t.x === goal.tx && t.y === goal.ty;
        if (isStart || isGoal) {
            return { refused: { reason: 'the-elements-write-lands-on-the-start-or-the-goal',
                detail: `the element writes (${t.x},${t.y}), which is the `
                    + `${isStart ? 'START' : 'GOAL'} cell. Neither endpoint's terrain is an `
                    + 'element\'s to re-decide — `freeRefusal` says the same thing to a '
                    + 'template, and a room whose start is wall is a room whose refusal is '
                    + 'about geometry rather than about the element.' } };
        }
    }

    // ── (ii) THE CARVE — slice 2's rule, asked of the cells it carved ───
    const carved = placement.tiles
        .filter((t) => t.tile === TILE_FLOOR && skeletonWallAt(t.x, t.y))
        .map((t) => ({ x: t.x, y: t.y }));
    const carveWhy = carveLaw({ carved, walkableAfter: at, walkableBefore: before });
    if (carveWhy) {
        return { refused: { reason: 'the-elements-carve-is-not-legal', detail: carveWhy } };
    }

    /**
     * ── ⛓⛓⛓ (iia) `demand` — THE SAME CLAUSE THE PRE-CARVE COMPOSITE ASKS,
     *     ONE PHASE OVER (arc 3, slice 4d, D3) ─────────────────────────
     *
     * The element's claim about cells it does NOT write. For the kill gate that
     * is the BODY'S REGION (`floor`) and the walls that keep the body in it
     * (`wall`) — see `killGate.placementOf`'s own docblock for why.
     *
     * ⛔ IT HOLDS BY CONSTRUCTION HERE and is asked anyway. The element computed
     * the region from the room it is being placed into, so this reads as a
     * self-consistency check — and that is exactly its value: the day the
     * element's geometry and its demand are computed from two different pictures
     * of the room, this is the line that says so, instead of pass 2 silently
     * enforcing a claim about a room that never existed. ⛓ The PRE-CARVE
     * composite has had this clause since arc 2 and a phase without it would be
     * two answers to what a `demand` means (trap 272's shape).
     */
    for (const dm of placement.demand ?? []) {
        if (dm.x < 0 || dm.y < 0 || dm.x >= width || dm.y >= height) continue;
        if (at(dm.x, dm.y) !== (dm.must === 'floor')) {
            return { refused: { reason: 'the-elements-demand-is-not-met',
                detail: `the element demands ${dm.must} at (${dm.x},${dm.y}) and the room it `
                    + 'was placed into has the other. ⛔ An `on-connector` element reads the '
                    + 'room it is standing in, so this clause holds BY CONSTRUCTION — a '
                    + 'refusal here means the geometry and the demand were computed from two '
                    + 'different pictures of the room, which is a defect in the element and '
                    + 'not a property of the level.' } };
        }
    }

    /**
     * ── (iii) THE DOOR LAW — both clauses, plus the open half ───────────
     *
     * ⛓⛓⛓ **OR ITS INVERSE, AND THE ELEMENT IS WHAT SAYS WHICH** (arc 5, slice
     * 5, D1). An `on-connector` element declares `law` — `'cut'` for every one
     * written before arc 5, `'shortcut'` for the SWORD-GATED SHORTCUT — and the
     * commit asks THAT law, on the placement that is about to ship.
     *
     * ⛔ **IT IS NOT A BRANCH THIS FILE INVENTED.** The element's `construct`
     * filtered its candidates with one of the two laws; a commit that asked the
     * other would refuse every placement the element accepted (a shortcut is
     * never a cut — that is its definition), and a binding that guessed from the
     * element's NAME would be a second table of which elements are shortcuts
     * kept in a different file from the first. ⇒ the declaration travels with
     * the element, exactly as `phase` does.
     *
     * ⛓ AND THE REFUSAL NAME IS THE LAW'S. `the-elements-door-is-not-a-cut` is
     * a sentence about a DOOR; a census that filed a shortcut's refusal under it
     * would say "the door was not a cut" about a thing whose whole job is not
     * being one.
     */
    const paintedFor = (walled) => (x, y) => {
        if (walled && walled.has(`${x},${y}`)) return false;
        return at(x, y);
    };
    const doorKeys = new Set(placement.doorCells.map((c) => `${c.x},${c.y}`));
    const clearerKeys = placement.clearer.map((c) => `${c.x},${c.y}`);
    if (law === LAW_SHORTCUT) {
        if (typeof shortcutLaw !== 'function') {
            return { refused: { reason: 'the-elements-shortcut-law-is-not-offered',
                detail: 'the element declares `law: "shortcut"` and the binding offered no '
                    + '`shortcutLaw`. ⛔ Falling back to the door law would adjudicate the '
                    + 'placement by the rule it was built to fail, so the run refuses BY NAME '
                    + 'instead — a binding that cannot ask the inverse cannot host a '
                    + 'shortcut, and that is a fact about the binding.' } };
        }
        const why = shortcutLaw({ paintedFor, doorKeys, clearerKeys });
        if (why) {
            return { refused: { reason: 'the-elements-shortcut-is-not-a-shortcut',
                detail: why } };
        }
    } else {
        const doorWhy = doorLaw({ paintedFor, doorKeys, clearerKeys });
        if (doorWhy) {
            return { refused: { reason: 'the-elements-door-is-not-a-cut', detail: doorWhy } };
        }
    }

    return { placed: Object.freeze({
        doorCell: Object.freeze({ ...placement.doorCells[0] }),
        doorCells: Object.freeze(placement.doorCells.map((c) => Object.freeze({ ...c }))),
        clearer: Object.freeze(placement.clearer.map((c) => Object.freeze({ ...c }))),
        wall: Object.freeze(placement.tiles.filter((t) => t.tile !== TILE_FLOOR)
            .map((t) => Object.freeze({ x: t.x, y: t.y }))),
        carved: Object.freeze(carved.map((c) => Object.freeze({ ...c }))),
        /**
         * ⛔⛔ **THE `demand` IS DELIBERATELY *NOT* ON `placed`** (arc 3, slice
         * 4d), and the first cut had it here. `procgenSeedling` copies this
         * whole object onto `certification.geometry`, which `elementSummaryOf`
         * ships in the PAYLOAD — so a `demand` field here put a CELL LIST of
         * 7–40 entries into every payload holding an `on-connector` element, and
         * an empty `demand: []` into every one holding a BLOCK POCKET. Measured:
         * it moved the acceptance batch's PRE-SWORD rows, which have no kill
         * gate at all and could not possibly have been moved by the demand
         * itself. ⇒ arc 1's payload rule, met head-on: a payload carries what a
         * reader CANNOT re-derive, and this is a function of the level and the
         * geometry. The binding reads it off the PLACEMENT instead.
         */
        entities: Object.freeze([
            ...placement.entities.blocks.map((b) => Object.freeze({ role: 'block', ...b })),
            ...placement.entities.obstacles.map((o) => Object.freeze({ role: 'obstacle', ...o })),
        ]),
        /** ⛓ THE CELLS PASS 2 MAY NOT TOUCH — the door, its clearer, the wall
         *  and the carve. ⛔ NOT a rectangle: this element has none, and
         *  reserving one would take a corridor's worth of room away from the
         *  ladder for a door that occupies two cells. */
        owned: Object.freeze([
            ...placement.doorCells, ...placement.clearer,
            ...placement.tiles.map((t) => ({ x: t.x, y: t.y })),
        ].map((c) => Object.freeze({ ...c }))),
        painted: Object.freeze([...painted].map(([k, terrain]) => {
            const [tx, ty] = k.split(',').map(Number);
            return Object.freeze({ tx, ty, terrain });
        })),
        cost: Object.freeze({ ...placement.cost }),
    }) };
}

/**
 * ⛓⛓⛓ **THE `on-connector` MAPPING** — the element's ids become Seedling
 * entities here and nowhere else, exactly as `seedlingElementEntities` does it
 * for the guard.
 *
 *   `killgate_door`      -> `lock {tset:'-1', tag:<own>}`   the KILL lock: `tset
 *                           == -1` is L5/L18's own spelling and is what
 *                           `refineStrategy` takes to `kill`
 *   `killgate_body`      -> `spinner {tag:'-1'}`            the body whose death
 *                           opens it; `tag:'-1'` is the palette row's own
 *   `shortcut_door`      -> `lock {tset:'-1', tag:<own>}`   arc 5 slice 5 — the
 *                           SAME lock, chosen by the INVERSE law
 *   `shortcut_body`      -> `spinner {tag:'-1'}`            the same body
 *   the block            -> `pushableblock`                 `PushableBlock.as:27`
 *                           is `type = "Solid"`, which is why a block in a
 *                           corridor is a door at all
 *
 * ⛔ ONE TAG, NOT THREE. The guard needs three persistence slots (lock A, the
 * flag, lock B); a kill gate needs ONE (its lock's own durable clear, 4b's
 * scratch layer) and the block pocket needs NONE AT ALL — a `pushableblock`
 * carries no tag, so the block pocket is the first element in the arc that
 * costs nothing out of `TAGS_PER_LEVEL`'s 30.
 */
export function seedlingOnConnectorEntities({ placed, tagFor }) {
    const tags = {};
    const entities = [];
    for (const e of placed.entities) {
        if (e.role === 'block') {
            entities.push({ type: 'pushableblock', tx: e.x, ty: e.y });
            continue;
        }
        if (e.id === KILL_DOOR_ID) {
            const tag = tagFor();
            tags.lock = tag;
            entities.push({ type: 'lock', tx: e.x, ty: e.y,
                attrs: { tset: '-1', tag: String(tag) } });
            continue;
        }
        if (e.id === KILL_BODY_ID) {
            entities.push({ type: 'spinner', tx: e.x, ty: e.y, attrs: { tag: '-1' } });
            continue;
        }
        /**
         * ⛓⛓⛓ **THE SHORTCUT'S TWO ARE THE KILL GATE'S TWO** (arc 5, slice 5).
         * ⛔ The REALISATION is identical on purpose — a `tset:-1` lock and the
         * spinner whose death clears it — because the mechanism IS the kill
         * gate's; what differs is the LAW that chose the cell, and a law is not
         * something an entity carries. ⚠ Two ids rather than a re-used pair, so
         * a payload, a census and a lifted claim can each say WHICH element put
         * the lock there without inferring it from the room.
         */
        if (e.id === SHORTCUT_DOOR_ID) {
            const tag = tagFor();
            tags.lock = tag;
            entities.push({ type: 'lock', tx: e.x, ty: e.y,
                attrs: { tset: '-1', tag: String(tag) } });
            continue;
        }
        if (e.id === SHORTCUT_BODY_ID) {
            entities.push({ type: 'spinner', tx: e.x, ty: e.y, attrs: { tag: '-1' } });
            continue;
        }
        fail(`procgenSeedlingElements: the on-connector element named the id `
            + `${JSON.stringify(e.id)} and this binding has no Seedling part for it. ⛔ The `
            + 'mapping is a TABLE and an id it does not carry is an element the binding '
            + 'cannot realise — never a silently dropped entity.');
    }
    return {
        tags: Object.freeze(tags),
        entities: Object.freeze(entities.map((e) => Object.freeze({
            ...e, ...(e.attrs ? { attrs: Object.freeze(e.attrs) } : {}),
        }))),
    };
}

/**
 * ⛓⛓⛓ **THE MAPPING (§3.4 / D2), IN ONE PLACE.** The element's symbols become
 * Seedling entities here and nowhere else.
 *
 *   `entities.blocks`        -> `pushableblock`
 *   `buttons`                -> `button {tset: A}`
 *   `obstacles door_A`       -> `lock {tset: A, tag: <own>}`
 *   the FLAG (the binding's)  -> `buttonroom {tset: B, tag: <own>, flip:'0', room:'-1'}`
 *   the FLAG'S LOCK (ditto)  -> `lock {tset: B, tag: <own>}`
 *
 * ── ⛔ THE TWO GROUPS COME FROM ONE PLACEMENT, AND THE RULE IS THE CELL ──
 *
 * `placementGroupId(at, height)` = `tx * height + ty + 1`, the allocator the
 * whole binding already uses (its own docblock says why it is the ANCHOR and
 * not a counter). Group **A is the BUTTON cell's** id and group **B is the
 * BUTTONROOM cell's** — two ids from one placement, DISTINCT because the two
 * cells are distinct and the arithmetic is injective. ⛔ Asserted rather than
 * assumed: a collision would make the flag's own lock openable by the guard's
 * button, which is ⚖ ruling 22 collapsing into ⚖ ruling 21.
 *
 * ⛓ THE MAZE'S `guardIdsFor(index)` NAMING MAPS TO THESE NUMERIC TSETS HERE,
 * ONE PLACE: `button_A0`/`door_A0`/`sw_A0` are the maze's LIBRARY KEYS, and
 * Seedling has no library — its group is an integer on the entity's `tset`
 * attribute. So the ids are carried on the record for the payload and the page
 * to name the parts, and the MECHANISM is the integer.
 *
 * ── ⛔ THREE TAGS PER ELEMENT, FROM THE 30 ─────────────────────────────
 *
 * `lock`(A), the `buttonroom` and `lock`(B) each need a private persistence
 * slot (`placementTagId`; `TAGS_PER_LEVEL` is 30 and the game indexes one flat
 * array with NO bounds check). They are allocated in that order from the record
 * as it stands, so the goal's own tag is taken before any of them can ask.
 */
export function seedlingElementEntities({ placed, groupIdFor, tagFor, ids }) {
    /**
     * ⛓⛓⛓ **AN ELEMENT THAT IS SPACE REALISES NO ENTITY, AND SPENDS NO TAG**
     * — PROCGEN ELEMENTS arc 5, slice 3.
     *
     * The mapping above is a TABLE from what an element DECLARED to what
     * Seedling puts in the room, and an `openChamber` declares nothing but
     * floor: no block to push, no button to press, no door to hold and no
     * symbol for the area graph to bind. ⛔ So the honest realisation is the
     * EMPTY one — and the important half of that sentence is `tags`: the
     * guard's three (`lock`(A), the `buttonroom`, `lock`(B)) come out of a
     * budget of THIRTY per level (`TAGS_PER_LEVEL`, one flat array with no
     * bounds check), and a chamber asks for NONE of them. A branch that
     * allocated three tags for a room with nothing in it would spend a
     * third of a level's persistence on space.
     *
     * ⚠ It is `placed.door === null` that decides, not the element's NAME: the
     * composite already answered that question and this is the same fact read
     * one layer out (`compositeSeedlingElement`'s (iii)-(v) gate).
     */
    if (placed.door === null) {
        /**
         * ⛓⛓⛓ **THE ARENA'S REALISATION — SPINNERS AND ONE LOCK** (arc 5,
         * slice 4). The mapping stays a TABLE from what the element DECLARED to
         * what Seedling puts in the room:
         *
         *   each declared BODY -> `spinner {tag:'-1'}`  the kill gate's own
         *                        spelling, one per body, in the element's own
         *                        order. ⛓ The `arena_body_<i>` IDS are the
         *                        record's names for the parts (the guard's
         *                        `button_A0` is the same idea) and the element's
         *                        own `assertPlacement` is what pins them; this
         *                        mapping reads the LIST, so a body cannot be
         *                        silently dropped by a rename.
         *   the KILL LOCK     -> `lock {tset:'-1', tag:<own>}`  the binding's,
         *                        on the main-path cut (`killLockCell`);
         *                        `tset == -1` is L5/L18's own spelling and is
         *                        what `refineStrategy` takes to `kill`
         *
         * ⛔ **ONE TAG, WHATEVER `bodies` IS.** The lock is the only thing here
         * with durable state; a spinner carries `tag:'-1'`, which is the
         * palette row's own literal and not an allocation. So an arena costs
         * ONE of `TAGS_PER_LEVEL`'s 30 at `bodies=1` and ONE at `bodies=n` —
         * the count buys enemies, never persistence.
         */
        if ((placed.bodies?.length ?? 0) > 0) {
            const tag = tagFor();
            return {
                groups: Object.freeze({}),
                tags: Object.freeze({ lock: tag }),
                ids,
                entities: Object.freeze([
                    ...placed.bodies.map((b) => Object.freeze({
                        type: 'spinner', tx: b.x, ty: b.y, attrs: Object.freeze({ tag: '-1' }),
                    })),
                    Object.freeze({ type: 'lock', tx: placed.killLockCell.x,
                        ty: placed.killLockCell.y,
                        attrs: Object.freeze({ tset: '-1', tag: String(tag) }) }),
                ]),
            };
        }
        return {
            groups: Object.freeze({}),
            tags: Object.freeze({}),
            ids,
            entities: Object.freeze([]),
        };
    }
    const groupA = groupIdFor({ tx: placed.button.x, ty: placed.button.y });
    const groupB = groupIdFor({ tx: placed.flagCell.x, ty: placed.flagCell.y });
    if (groupA === groupB) {
        fail('procgenSeedlingElements: the guard group and the flag group came out EQUAL '
            + `(${groupA}) for button (${placed.button.x},${placed.button.y}) and flag `
            + `(${placed.flagCell.x},${placed.flagCell.y}). `
            + '`placementGroupId` is injective over the interior, so this is a defect in the '
            + 'placement rather than an unlucky room — and a collision would let the guard\'s '
            + 'own button open the flag\'s locks, which is ⚖ ruling 22 collapsing into 21.');
    }
    const tagA = tagFor();
    const tagFlag = tagFor(tagA);
    const tagB = tagFor(tagA, tagFlag);
    return {
        groups: Object.freeze({ A: groupA, B: groupB }),
        tags: Object.freeze({ lockA: tagA, flag: tagFlag, lockB: tagB }),
        ids,
        entities: Object.freeze([
            Object.freeze({ type: 'pushableblock', tx: placed.block.x, ty: placed.block.y }),
            Object.freeze({ type: 'button', tx: placed.button.x, ty: placed.button.y,
                attrs: Object.freeze({ tset: String(groupA) }) }),
            Object.freeze({ type: 'lock', tx: placed.door.x, ty: placed.door.y,
                attrs: Object.freeze({ tset: String(groupA), tag: String(tagA) }) }),
            Object.freeze({ type: 'buttonroom', tx: placed.flagCell.x, ty: placed.flagCell.y,
                attrs: Object.freeze({ tset: String(groupB), tag: String(tagFlag),
                    flip: '0', room: '-1' }) }),
            Object.freeze({ type: 'lock', tx: placed.flagLockCell.x, ty: placed.flagLockCell.y,
                attrs: Object.freeze({ tset: String(groupB), tag: String(tagB) }) }),
        ]),
    };
}

/**
 * ⛓⛓⛓ **THE LIFTED CLAIM, READ FROM THE SOLVE'S OWN RECORDS.**
 *
 * ⚖ Arc-2 §9.4 measured that the obvious claims are worthless: `pushes >= len`
 * is FALSE on real data (18 of 408 plans finish in fewer) and `pushes > 0` is
 * INERT (the deliberately-violating adjacent-door world still spends one push,
 * because the block sits in the entry lane and has to be shoved aside). The
 * claim that DISCRIMINATES is
 *
 *   **A BLOCK WAS ON THE BUTTON AT THE TICK THE PLAYER FIRST ENTERED THE DOOR
 *   CELL.**
 *
 * ⛔ WHAT IT READS, AND WHY EACH PART IS THE HONEST SOURCE:
 *  · the PARK tick — the `weigh` record's `shove.startTick + shove.ticks`.
 *    `runShove` releases on the tick whose own `cTile` puts the landing on
 *    `to`, so that sum IS the tick the block came to rest, and `shove.to` is
 *    compared against the element's OWN button cell rather than "some button".
 *  · the CROSSING tick — the first decision row whose `path` contains the door
 *    cell. ⚠ A row's `tick` is when the corridor was PLANNED, and the walk
 *    happens after it, so `park <= plan` is a SUFFICIENT condition and the
 *    comparison is stated as such: it cannot be fooled late (a park after the
 *    plan tick is not proof of anything) and it does not need per-tick player
 *    positions, which `procgenOracle.solve` does not return.
 *  · NOTHING MOVED IT AFTERWARDS — any later `shove`/`weigh` record naming this
 *    block invalidates the claim, because the first two facts alone would let a
 *    plan park the block, cross, and then be given credit for a block it had
 *    since shoved away.
 *
 * ⛓⛓ **AND A GADGET CAN ARRIVE ALREADY PARKED** (arc 3 slice S1, gap 3). Where
 * the block was on the button before the first tick, the solve's `weigh` record
 * is DWELL-ONLY: it has no `shove`, because there was no lean to order, and it
 * carries `parked: {block, tile, sinceTick: 0}` instead. The park tick is then
 * `0` — not a guess, and not a softening of the claim: the block is where the
 * LEVEL RECORD put it and no tick of this run moved it, which is the strongest
 * form of "it was there when the player crossed" the claim can take. ⛔ The
 * ROUTE half is unchanged, so a dwell-only weigh whose route never crossed the
 * door still answers `null`.
 *
 * @returns {true|false|null} `null` = the route never crossed the door (which
 *   is what an UNGUARDED gadget looks like from the plan's side, and a fact
 *   about the ROUTE rather than a defect); `false` = it crossed WITHOUT the
 *   block parked. ⚠ On a generated level `false` has never been observed — the
 *   maze's own ablation (the door moved adjacent to its button) is the only
 *   thing that has produced one.
 */
export function liftedClaimFrom({ records = [], trace = null }, { block, button, door }) {
    const sameTile = (a, b) => a && b && a.tx === b.tx && a.ty === b.ty;
    const buttonTile = { tx: button.x, ty: button.y };
    let park = null;
    let parkIndex = -1;
    records.forEach((r, i) => {
        if (park !== null) return;
        if (r.strategy !== 'weigh') return;
        if (r.shove) {
            if (!sameTile(r.shove.to, buttonTile)) return;
            park = (r.shove.startTick ?? 0) + (r.shove.ticks ?? 0);
            parkIndex = i;
            return;
        }
        // ⛓ the DWELL-ONLY arm — a gadget that arrived already parked.
        if (!r.parked || !sameTile(r.parked.tile, buttonTile)) return;
        park = r.parked.sinceTick ?? 0;
        parkIndex = i;
    });
    if (park === null) return null;
    for (let i = parkIndex + 1; i < records.length; i += 1) {
        const s = records[i].shove;
        if (s && s.id && block.id && s.id === block.id) return false;
        if (s && sameTile(s.from, buttonTile)) return false;
    }
    const cross = (trace?.rows ?? []).find((row) => rowCrosses(row, door));
    if (!cross) return null;
    return park <= cross.tick;
}

/**
 * ⛓⛓⛓ **DOES THIS DECISION ROW'S CORRIDOR PASS THROUGH THE DOOR CELL?** — and
 * slice S1 is what proved the first cut of this test could not answer it, in TWO
 * separate ways that both look identical from outside: *"the route never crossed
 * it"* on a route that plainly did.
 *
 * ⛔ (1) A ROW'S `path` IS ITS **WAYPOINTS**, NOT ITS CELLS. `planWaypoints`
 * STRING-PULLS, so a corridor running straight down a lane arrives as two points
 * with every tile between them unmentioned. The first cut tested the door cell
 * for MEMBERSHIP in that list, which asks *"did a waypoint land on the door"*.
 *
 * ⛔ (2) A ROW'S CORRIDOR STARTS WHERE THE PLAYER **STANDS**, not at waypoint 0.
 * `drive` walks from the live position to `path[0]`, and that leading leg is a
 * real part of the route the row describes — it is where the walk out of the
 * flag's own cell crosses the guard door, measured on seed 7 `winding`: the row
 * `saw` (136.9, 135.9) with `path[0]` (136, 104), and the door cell (8,7)
 * sitting between them.
 *
 * ⛔⛔ AND THE READER'S FIVE SYNTHETIC ROWS COULD NOT SEE EITHER, because every
 * one of them put the door cell exactly ON a waypoint. ⇒ a reader written for a
 * route that does not exist yet is untested precisely where it will be used, and
 * the fixture is what has to make the two readings differ.
 * [[feedback_fixture_must_discriminate_two_builds]]
 *
 * ⚠ THE TRACE MERGE IS WHY THE LEADING LEG MATTERS SO MUCH HERE. Rows sharing a
 * tick are merged and a SUBSTANTIVE decision outranks a `walk`, so the corridor
 * to a stance the same decision derived is not a row of its own at all
 * (`solverBot`'s merge docblock). The rows that survive with a `path` are the
 * ones that re-planned later — and for this element that is the walk OUT of the
 * flag, whose crossing lives entirely in the leading leg.
 *
 * ⛓ THE SAMPLE PITCH IS EIGHT PIXELS, for `probeCorridor`'s own reason: eight is
 * finer than any 16-px tile, so no cell a segment passes through can fall between
 * two samples. ⚠ This is still the SUFFICIENT condition §10.8 states — the row's
 * `tick` is when the corridor was PLANNED and the walk follows after it, so an
 * estimate that is EARLIER than the true crossing only makes `park <= cross`
 * harder to satisfy, never easier.
 */
function rowCrosses(row, door) {
    return corridorTilesOf(row).some((c) => c.x === door.x && c.y === door.y);
}

/** ⛓ The pitch and the tile, named once — see `rowCrosses`' docblock for why 8. */
export const CORRIDOR_SAMPLE_PX = 8;
const ROUTE_TILE_PX = 16;

/**
 * ⛓⛓⛓ **ONE DECISION ROW'S CORRIDOR, AS THE TILES IT PASSES THROUGH** (arc 3,
 * slice 5b, D4) — the body §11.6's reader was, LIFTED so that the two callers
 * cannot disagree about what a row's corridor is. `rowCrosses` above asks
 * MEMBERSHIP of it; the certification's ROUTE paintable asks for the whole
 * sequence. ⛔ A second sampler would be trap 375's shape one file over: two
 * spellings of *"where did the walk go"*, drifting the moment either is fixed.
 *
 * The leading leg from `saw` to `path[0]` is part of the corridor (that is
 * §11.6's second defect) and consecutive duplicates are dropped, so the answer
 * is a cell PATH rather than a sample list.
 */
export function corridorTilesOf(row) {
    const pts = [];
    if (row?.saw && Number.isFinite(row.saw.x) && Number.isFinite(row.saw.y)) {
        pts.push({ x: row.saw.x, y: row.saw.y });
    }
    for (const p of (row?.path ?? [])) pts.push(p);
    const out = [];
    const push = (px, py) => {
        const c = { x: Math.floor(px / ROUTE_TILE_PX), y: Math.floor(py / ROUTE_TILE_PX) };
        const last = out[out.length - 1];
        if (last && last.x === c.x && last.y === c.y) return;
        out.push(Object.freeze(c));
    };
    if (pts.length === 0) return out;
    if (pts.length === 1) { push(pts[0].x, pts[0].y); return out; }
    for (let i = 1; i < pts.length; i += 1) {
        const a = pts[i - 1];
        const b = pts[i];
        const steps = Math.max(1,
            Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / CORRIDOR_SAMPLE_PX));
        for (let s = 0; s <= steps; s += 1) {
            push(a.x + ((b.x - a.x) * s) / steps, a.y + ((b.y - a.y) * s) / steps);
        }
    }
    return out;
}

/**
 * ⛓⛓⛓ **THE CERTIFICATION SOLVE'S ROUTE** (arc 3, slice 5b, D4) — the trace's
 * decision rows, in order, each one's corridor appended to the last.
 *
 * ⛔⛔ **AND IT IS NOT CONTINUOUS, WHICH IS A FACT ABOUT THE TRACE AND NOT A BUG
 * IN THE READER.** §11.6's third finding, measured and deliberately not acted
 * on: the trace MERGE lets a substantive decision outrank a `walk` on a shared
 * tick, so *the walk to a stance is never a `path` row at all*. Its corridor is
 * therefore missing from the rows that survive, and the route jumps. ⇒ the gaps
 * are COUNTED and NAMED in the paintable's note. ⛔ Nothing bridges them: a
 * straight line drawn between two ends the solver never walked would be the
 * reader inventing a route, which is worse than a route with holes in it.
 *
 * @returns {{cells: Array<{x,y}>, gaps: number, rows: number}}
 */
export function certificationRouteCells(trace) {
    const cells = [];
    let gaps = 0;
    let rows = 0;
    for (const row of (trace?.rows ?? [])) {
        const tiles = corridorTilesOf(row);
        if (tiles.length === 0) continue;
        rows += 1;
        const last = cells[cells.length - 1];
        if (last && Math.abs(last.x - tiles[0].x) + Math.abs(last.y - tiles[0].y) > 1) gaps += 1;
        for (const c of tiles) {
            const prev = cells[cells.length - 1];
            if (prev && prev.x === c.x && prev.y === c.y) continue;
            cells.push(c);
        }
    }
    return { cells, gaps, rows };
}

/**
 * ⛓⛓⛓ **THE LIFTED CLAIM PER ELEMENT — ONE TABLE, THREE READERS.**
 *
 * PROCGEN ELEMENTS arc 3, slice 4a. Certification is the SOLVE's own verdict
 * for every element; the LIFTED CLAIM is the extra, discriminating question
 * *"did the gadget actually do its job on the route the solve took?"* (arc-2
 * §9.4's discharge-existence instrument). It is necessarily per-element, because
 * the three mechanisms leave three different records:
 *
 *   `reverse-pull-block`  a BLOCK WAS ON THE BUTTON when the player first
 *                         crossed the door (`liftedClaimFrom`, unchanged)
 *   `kill-gate`           THE LOCK OPENED BECAUSE THIS ELEMENT'S BODY DIED, and
 *                         it opened BEFORE the route crossed the door
 *   `block-pocket`        THIS ELEMENT'S BLOCK WAS SHOVED OFF THE DOOR CELL,
 *                         and the route crossed the door AFTER that
 *
 * ⛔ EACH READS STRUCTURED FIELDS, NEVER PROSE (trap 337/354), and each answers
 * `null` for *"the route never crossed the door"* — a fact about the ROUTE
 * rather than a defect, which is what an unguarded placement looks like from
 * the plan's side.
 */
const seedlingId = (type, cell) => `${type}@${cell.x * 16},${cell.y * 16}`;

/**
 * ⛓⛓⛓ **THE KILL GATE'S CLAIM, AND THE FIELD IT READS IS NOT ON THE RECORD.**
 *
 * ⛔ MEASURED BEFORE IT WAS WRITTEN (trap 353: a reader shipped for a route that
 * does not exist yet is untested exactly where it will be used). The `kill`
 * record carries the WORK — `arm: 'press'`, its landings, its cycles and
 * `bodies: ['spinner@32,96']` — and carries NO lock and NO open tick at all.
 * What says the lock opened is `run.scratchClears`, 4b's durable-persistence
 * ledger, which `procgenOracle.solve` returns beside the records:
 *
 *   `{level:900, tag:1, at:608, declaredAt:607, removedAt:507,
 *     by:'spinner@32,96', lock:'lock@48,112', cause:'sword',
 *     why:'1 kill lock(s) OPEN: totalEnemies() went 1 -> 0'}`
 *
 * ⇒ the claim is **THIS element's lock was cleared BY this element's body, and
 * the clear landed no later than the tick the route crossed the door**. Both
 * halves are needed: the tick alone would credit this gate for a clear some
 * other spinner earned, and the ids alone would not say the player waited.
 *
 * ⚠ `at <= cross` is the same SUFFICIENT comparison the guard's claim makes, and
 * for the same reason: a row's `tick` is when the corridor was PLANNED and the
 * walk follows after it, so an estimate EARLIER than the true crossing only
 * makes the claim harder to satisfy.
 */
function killGateClaim({ records = [], trace = null, scratchClears = [] }, placed) {
    const lockId = seedlingId('lock', placed.doorCell);
    const bodyId = seedlingId('spinner', placed.clearer[0]);
    if (!records.some((r) => r.strategy === 'kill')) return null;
    const clear = (scratchClears ?? []).find((c) => c.lock === lockId);
    if (!clear) return null;
    /**
     * ⛔ THE BODY MUST BE THIS ELEMENT'S. A clear credited to some other room's
     * spinner is a lock that opened for a reason this gate cannot claim — which
     * is exactly what an ABLATED fixture produces, and the only thing that
     * makes the claim discriminating rather than a restatement of SOLVED.
     */
    if (clear.by !== bodyId) return false;
    const cross = (trace?.rows ?? []).find((row) => rowCrosses(row, placed.doorCell));
    if (!cross) return null;
    const opened = clear.at ?? clear.declaredAt ?? null;
    return opened === null ? null : opened <= cross.tick;
}

/**
 * ⛓⛓⛓ **THE BLOCK POCKET'S CLAIM — AND ITS ROUTE HALF HAD TO GO, MEASURED.**
 *
 * D3 asks for *"the record `{strategy:'shove'}` naming this block, `to` the
 * pocket cell or beyond"*, and the first cut of this reader added the guard's
 * own second half — *and the route crossed the door after it*. ⛔ THAT HALF IS
 * WRONG HERE AND THE TRACE SAYS SO. `winding` seed 3: the block goes
 * (2,1)→(6,1) east, the player follows it east under the lean, and the three
 * trace rows are `(24,24)` · `(80,24)` with a path to `(56,56)` · `(55,67)` —
 * the player is ALREADY past the door cell when the first row with a corridor
 * is written, because **the crossing happens DURING the shove**, which is one
 * executor and not a decision row. The reader answered `null` on 4 of 16
 * certified placements whose route had plainly crossed. ⇒ the route test is the
 * GUARD's instrument (its player walks to the door long after parking the
 * block) and not this element's. [[feedback_leak_witness_snapshot_cannot_see_leak]]
 *
 * ⇒ **THE CLAIM IS THE SHOVE ITSELF, AND IT IS STILL DISCRIMINATING**: the
 * block that stood IN the door cell was shoved, and it travelled AT LEAST as
 * far as the element guaranteed (`cost.push` — the first `k` at which the walk
 * found the room reconnected). ⛔ A decorative block nobody has to move earns
 * no `shove` record from that cell at all and the claim is `null`; a block the
 * solver shoved one cell out of the way and left in the corridor travels less
 * than `cost.push` and the claim is `false`.
 *
 * ⚠ THE DISTANCE IS THE READING, NOT THE DESTINATION CELL, because the element
 * does not own a seventh placement field to put the rest cell in (arc-2's
 * contract: *"`tiles`, `ports`, `demand`, `area`, `symbols` and `cost` are the
 * contract's fields and an element does not get to add a seventh"*) — and
 * `cost` is exactly where a number about the placement belongs.
 */
function blockPocketClaim({ records = [] }, placed) {
    const door = placed.doorCell;
    const from = (r) => r.from && r.from.tx === door.x && r.from.ty === door.y;
    const shove = records.find((r) => r.strategy === 'shove' && from(r));
    if (!shove) return null;
    /**
     * ⛔ AND NOTHING PUT IT BACK. A later shove whose destination is the door
     * cell again leaves the room exactly as it started, and the first fact
     * alone would still read as a success.
     */
    if (records.some((r) => r.strategy === 'shove'
        && r.to && r.to.tx === door.x && r.to.ty === door.y)) return false;
    const travelled = Math.abs(shove.to.tx - door.x) + Math.abs(shove.to.ty - door.y);
    return travelled >= (placed.cost?.push ?? 1);
}

/**
 * ⛓⛓⛓ **THE ARENA'S CLAIM — THE KILL GATE'S, OVER A LIST** (arc 5, slice 4).
 *
 * The gate's reader asks whether the clear that opened the lock was credited to
 * THIS gate's own body; an arena has `bodies` of them, so the same question is
 * membership in a SET. ⛔ That is the whole difference, and it is why this is
 * not a copy with a different constant: `execKillByPress` already carries
 * `resolved.bodies` as a LIST (design §7c's own note), so the solver's side of
 * `bodies = n` needed nothing.
 *
 * ⛔ AND THE `cause` IS CARRIED RATHER THAN ASSERTED. A lock cleared because
 * pass-2 furniture DROWNED a body opens for a reason the level did not pose —
 * arc 3 measured it at 2 of 10 certified kill gates — and the gate answers it
 * with a `demand` over the body's region. An arena cannot compute that region
 * (it is `pre-carve`; the room does not exist yet), so the exposure is measured
 * instead: this reader returns `false` when the clear was not this arena's, and
 * the as-built publishes the `cause` distribution over the corpus.
 */
function arenaClaim({ records = [], trace = null, scratchClears = [] }, placed) {
    if (!placed.killLockCell || (placed.bodies?.length ?? 0) === 0) return null;
    const lockId = seedlingId('lock', placed.killLockCell);
    const mine = new Set(placed.bodies.map((b) => seedlingId('spinner', b)));
    if (!records.some((r) => r.strategy === 'kill')) return null;
    const clear = (scratchClears ?? []).find((c) => c.lock === lockId);
    if (!clear) return null;
    if (!mine.has(clear.by)) return false;
    const cross = (trace?.rows ?? []).find((row) => rowCrosses(row, placed.killLockCell));
    if (!cross) return null;
    const opened = clear.at ?? clear.declaredAt ?? null;
    return opened === null ? null : opened <= cross.tick;
}

/** ⛔ ONE TABLE, and an element with no reader answers `null` rather than a
 *  green `true` nobody measured. */
const LIFTED_CLAIMS = Object.freeze({
    'reverse-pull-block': (cert, placed) => liftedClaimFrom(cert, placed),
    'kill-gate': killGateClaim,
    'block-pocket': blockPocketClaim,
    arena: arenaClaim,
});

export function liftedClaimFor(elementName) {
    return LIFTED_CLAIMS[elementName] ?? (() => null);
}

/**
 * ⛓ THE ELEMENT BLOCK A PAYLOAD CARRIES — the SPEC, what was PLACED and the
 * REFUSAL, in the maze's own shape (`procgenMaze.elementSummaryOf`) so a reader
 * who knows one substrate's payload knows the other's.
 *
 * ⛔ `certified` IS ALWAYS `false` TODAY and carries the SOLVE'S OWN TEXT — see
 * the file docblock. A field that said `true` would be the one thing this slice
 * must not ship.
 */
export function elementSummaryOf(model, { certification = null } = {}) {
    const e = model.elements;
    if (!e) return null;
    /**
     * ⛓ THE GEOMETRY COMES FROM WHICHEVER MODEL HAS IT. When the certification
     * solve refuses, `generateSeedlingLevel` regenerates with the element
     * DROPPED (its draws still spent — arc-2 §10.3's rule) and that model's
     * `placed` is empty; the geometry it measured is carried on the
     * certification so the census numbers survive the drop. ⛔ Both are
     * reported, because "the gadget fits here" and "the level shipped with it"
     * are different facts and this slice's whole finding is that they differ.
     */
    const placed = e.placed.length ? e.placed : (certification?.geometry ?? []);
    /**
     * ⛓ **THE COMMON HALF AND THE PHASE'S OWN HALF** (arc 3, slice 4a). Every
     * placement carries the same identity and draw span; what it carries BESIDE
     * that is the phase's geometry, and a summary that flattened the two shapes
     * into one would report `site: undefined` for a door that has no site.
     */
    const shapeOf = (p) => (p.phase === 'on-connector' ? {
        phase: p.phase,
        doorCell: p.doorCell,
        clearer: p.clearer,
        wall: p.wall.length,
        carved: p.carved.length,
        entities: p.entities,
        tags: p.tags,
    } : {
        phase: 'pre-carve',
        site: p.site,
        ports: p.ports,
        entryMouth: p.entryMouth,
        block: p.block,
        button: p.button,
        door: p.door,
        flagCell: p.flagCell,
        flagLockCell: p.flagLockCell,
        /**
         * ⛓⛓ **CARRIED ONLY WHERE THERE ARE ANY** (arc 5, slice 4) — and the
         * conditional is measured rather than stylistic. This object rides
         * `summary.elements.placed[]` AND `certification.geometry[]` into every
         * payload that holds a guard, so two keys added unconditionally would
         * move every committed md5 for a pair of `null`s (trap 375, and slice
         * 2's `orient` is the same finding). A payload carries what the
         * placement HAS.
         */
        ...((p.bodies?.length ?? 0) > 0
            ? { bodies: p.bodies, killLockCell: p.killLockCell } : {}),
        groups: p.groups,
        tags: p.tags,
        ids: p.ids,
        tunnel: p.tunnel.length,
        carveOverwrote: p.carveOverwrote,
    });
    return {
        spec: e.spec,
        ran: e.ran,
        placed: placed.map((p) => ({
            element: p.element,
            family: p.family,
            instance: p.instance,
            index: p.index,
            params: p.params,
            drawsBefore: p.drawsBefore,
            drawsAtConstruct: p.drawsAtConstruct,
            ...shapeOf(p),
            cost: p.cost,
        })),
        refused: e.refused,
        /**
         * ⛔⛔ `certified` IS `false` ON EVERY PLACED GADGET TODAY, and the
         * SOLVE'S OWN TEXT is what says so — see the file docblock and arc-3
         * §10's S1 work order. `null` means no certification was attempted
         * (nothing was placed).
         */
        certified: certification ? certification.certified : null,
        certification,
    };
}

export { ELEMENTS_NONE, ELEMENT_TABLE, guardIdsFor };
