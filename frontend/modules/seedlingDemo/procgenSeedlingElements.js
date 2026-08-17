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
 */

import { TILE_FLOOR } from '../shared/procgen/mazeAlgorithms/gridTiles.js';
import { DIR_DELTA, guardIdsFor } from '../procgenCore/elements.js';
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

/** Every refusal this binding can produce, BY NAME — what the census counts. */
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
    'the-skeleton-does-not-solve-with-the-element',
]);

/** The RESERVED rectangle: the site plus the one-cell ring the binding writes. */
export const reservedRect = (site) => Object.freeze({
    x: site.x - 1, y: site.y - 1, w: site.w + 2, h: site.h + 2,
});

const inRect = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const NB4 = Object.freeze([[0, -1], [0, 1], [-1, 0], [1, 0]]);

/**
 * ⛓⛓ EVERY LEGAL SITE, ROW-MAJOR — the list ONE `pick` draws from, and a
 * function of the ROOM and the SIZE alone (never of the carve), so the site is
 * decided before a single wall exists. The maze's three conditions, in
 * Seedling's vocabulary:
 *
 *  1. the site is off the room's own BORDER RING (which is wall and must stay
 *     wall — `procgenSeedling`'s own carve check);
 *  2. the RESERVED rectangle holds neither the START nor the GOAL — both are
 *     cells the level needs and the ring walls everything it covers;
 *  3. (implied by 1) the ring may overlap the border ring, which costs nothing:
 *     writing `wall` over wall is a no-op.
 */
export function seedlingElementSiteCandidates({ width, height, start, goal, size }) {
    const out = [];
    for (let y = 1; y + size <= height - 1; y += 1) {
        for (let x = 1; x + size <= width - 1; x += 1) {
            const r = reservedRect({ x, y, w: size, h: size });
            if (inRect(r, start.tx, start.ty) || inRect(r, goal.tx, goal.ty)) continue;
            out.push(Object.freeze({ x, y, w: size, h: size }));
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
export function flagLockCellFor({ width, height, walkable, start, goal, reserved, entryMouth }) {
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
    return { refused: { reason: 'no-cut-for-the-flag-lock',
        detail: `no cell of the ${path.length}-cell main path can carry `
            + 'the flag\'s lock: ' + (tried.length ? tried.join('; ') : '(the path is two cells)')
            + '. ⛔ The element is REFUSED rather than placed as DECORATION: a `buttonroom` '
            + 'whose `lock`(B) is not a cut opens a door the walk never needed, which is '
            + '⚖ ruling 17\'s own definition of decoration. ⛓ On the OPEN room this is the '
            + 'ordinary answer and slice 2\'s door census says why — on `empty` a span-1 '
            + 'door cuts NOTHING (0 anchors at spans 1..7, 384 at span 8), so a one-cell '
            + 'lock is a CORRIDOR mechanism.' } };
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
    const port = (role) => placement.ports.find((p) => p.role === role);
    const entryPort = port('entry');
    const exitPort = port('exit');
    const din = DIR_DELTA[entryPort.dir];
    const entryMouth = Object.freeze({ x: entryPort.x + din.dx, y: entryPort.y + din.dy });

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
     * ⛔⛔ AND THE MOUTH MAY NOT BE THE ROOM'S OWN BORDER RING — a refusal the
     * maze does not need and Seedling does. A maze room has NO wall ring (its
     * entrance is the corner tile (0,0)), so a ring cell there is an ordinary
     * cell; Seedling's border is what makes the room a room (`loadlevel` drops
     * out-of-rectangle tiles and nothing stops a player walking off a floor
     * that ends), so opening it is refused rather than painted over. ⛓ The maze
     * folds this case into `the-entry-port-cannot-be-joined`, whose own docblock
     * names it as that refusal's common cause; here it is a DISTINCT fact — the
     * mouth is UNOPENABLE, not merely unreached — and the census counts them
     * apart.
     */
    if (entryMouth.x <= 0 || entryMouth.y <= 0
        || entryMouth.x >= width - 1 || entryMouth.y >= height - 1) {
        return { refused: { reason: 'the-entry-mouth-is-the-rooms-border-ring',
            detail: `the gadget's entry port (${entryPort.x},${entryPort.y}) faces `
                + `${entryPort.dir}, so its mouth is (${entryMouth.x},${entryMouth.y}) — a cell `
                + 'of the room\'s BORDER RING. Opening it would open the room. ⛓ The site is '
                + 'drawn before the element picks its port directions, so this is decided '
                + 'after the fact and REFUSED rather than redrawn.' } };
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

    // ── (iii) the FLAG's cell — one step past the door on the exit lane ──
    const doorCell = placement.entities.obstacles[0];
    const dex = DIR_DELTA[exitPort.dir];
    const flagCell = Object.freeze({ x: doorCell.x + dex.dx, y: doorCell.y + dex.dy });
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
    const lock = flagLockCellFor({ width, height, walkable: at,
        start: { x: start.tx, y: start.ty }, goal: { x: goal.tx, y: goal.ty },
        reserved, entryMouth });
    if (lock.refused) return lock;

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
        block: Object.freeze({ ...placement.entities.blocks[0] }),
        button: Object.freeze({ ...placement.entities.buttons[0] }),
        door: Object.freeze({ x: doorCell.x, y: doorCell.y }),
        flagCell,
        flagLockCell: lock.cell,
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
    const inDoor = (x, y) => Math.floor(x / 16) === door.x && Math.floor(y / 16) === door.y;
    const pts = [];
    if (row?.saw && Number.isFinite(row.saw.x) && Number.isFinite(row.saw.y)) {
        pts.push({ x: row.saw.x, y: row.saw.y });
    }
    for (const p of (row?.path ?? [])) pts.push(p);
    if (pts.length === 0) return false;
    if (pts.length === 1) return inDoor(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i += 1) {
        const a = pts[i - 1];
        const b = pts[i];
        const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8));
        for (let s = 0; s <= steps; s += 1) {
            if (inDoor(a.x + ((b.x - a.x) * s) / steps,
                a.y + ((b.y - a.y) * s) / steps)) return true;
        }
    }
    return false;
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
            site: p.site,
            ports: p.ports,
            entryMouth: p.entryMouth,
            block: p.block,
            button: p.button,
            door: p.door,
            flagCell: p.flagCell,
            flagLockCell: p.flagLockCell,
            groups: p.groups,
            tags: p.tags,
            ids: p.ids,
            tunnel: p.tunnel.length,
            carveOverwrote: p.carveOverwrote,
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
