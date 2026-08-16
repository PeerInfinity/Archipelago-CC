/**
 * procgenCore/sites — **WHAT KIND OF PLACE A CELL IS**, in one vocabulary, for
 * every substrate on the loop.
 *
 * PROCGEN ELEMENTS arc 3, slice 1 (`NewDocs/plans/procgen-elements-arc3-
 * kickoff.md` §3.1; design §4.3 *"pass 2 = today's `generateLevel`,
 * SITE-TYPED"*). Pass 2 has always proposed anchors from ONE list — every
 * interior cell — which is right on an open room and wrong on a carved one: a
 * template that wants a corner of a chamber is offered the middle of a 1-wide
 * corridor seven times out of eight, and the yield table pays for every one of
 * them with a solve.
 *
 * ── ⛔⛔⛔ THE LAW: **A SITE IS A PROPOSAL DISTRIBUTION, NEVER A LEGALITY
 * RULE** (⚖ design §4.3, confirmed by the design session 2026-08-16) ─────
 *
 * **LEGALITY IS A FACT ABOUT THE FLOOR; A SITE IS A FACT ABOUT THE SEARCH.**
 * `refusalAt` still adjudicates every cell exactly as it did before this file
 * existed; what a declared site changes is WHICH cells the shuffle walks.
 *
 * ⛔ CONFLATING THE TWO WOULD COST BOTH WAYS, which is why the law is written
 * here rather than left to be inferred from the code:
 *
 *  · a site table that also REFUSED would let itself HIDE A LEGALITY DEFECT —
 *    a cell the floor should have rejected, never offered, so never adjudicated;
 *  · and verb 2 (the page's directed attempt, the CLI's `--directed=`) would
 *    start refusing cells the free loop would happily have kept, because a
 *    person who clicked a corridor cell asked for THAT CELL.
 *
 * ⚠ ONE CONSEQUENCE FOR THE YIELD TABLE, STATED SO NOBODY MISREADS A COLUMN:
 * a KEPT delta after a row declares `chamber` is a fact about WHERE THE SHUFFLE
 * LOOKED. "kept fell" is a finding about the distribution, never about legality.
 *
 * Two more consequences, both wanted:
 *
 *  · a DIRECTED placement (the page's verb 2, `--directed=`) at a cell outside
 *    the template's own class is still LEGAL — a person who clicked a corridor
 *    cell asked for that cell, and a refusal there would be the model
 *    inventing a rule the loop's own legality does not have;
 *  · a template whose class is EMPTY on this skeleton is NO_ANCHOR at zero
 *    cost, which is the yield the site vocabulary is bought for.
 *
 * ── ⛔ IT SPENDS NO DRAW ───────────────────────────────────────────────
 *
 * Every class here is READ OFF THE TILES. No rng is passed and none can be:
 * the derivation runs once at model construction, beside the carve, and a
 * derivation that drew would move the goal of every seed the moment a class
 * was added.
 *
 * ── THE GRID VOCABULARY IS `{x, y}` ───────────────────────────────────
 *
 * Like `gridFlood`, and for its reason: a grid is the one vocabulary the two
 * substrates already share, and the BINDING converts at its own boundary
 * (Seedling's `{tx, ty}` is converted once, in `procgenSeedling`).
 *
 * ⛔ NO DOM AND NO NODE IMPORTS: both lab pages load this in a browser.
 */

import { reachableFrom, shortestPath } from './gridFlood.js';

export class SitesError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SitesError';
    }
}

const fail = (message) => { throw new SitesError(message); };

/**
 * ⛓ THE VOCABULARY, CLOSED. `assertPalette` (each substrate's own) refuses a
 * template declaring anything not in this list BY NAME — a silently unknown
 * site class would fall through to "no cells" and read as a template nobody
 * can place, which is the named-arm-nobody-built shape one field over.
 *
 * `any` is not derived: it is the WHOLE interior the binding has always
 * shuffled, and it is the default so that every existing row is byte-inert.
 */
export const SITE_CLASSES = Object.freeze([
    'any', 'main', 'bend', 'branch', 'tip', 'chamber', 'corridor',
]);

/**
 * ⛓ **ONE CLASS PER ROW — THERE IS NO FALLBACK, AND THAT IS ⚖ A RULING.**
 *
 * A `'chamber, else anywhere'` preference list was proposed on the census
 * (arc-3 as-built §8.3: a bare tree kind has NO all-ground 2x2 square on 10 of
 * 12 seeds, so `site: 'chamber'` makes the area templates NO_ANCHOR on most of
 * them) and the USER OVERRULED it with the design's own law:
 *
 * ⚖ **THINGS THAT NEED AREA ARE PLACED FIRST.** Pass 1 constructs the elements
 * and the connector leaves the space they demand; pass 2 DECORATES what pass 1
 * built. A fallback to "anywhere" would re-create the OPEN-ROOM ASSUMPTION this
 * arc exists to remove — it would drop a patch of terrain into a 1-wide
 * corridor precisely because there was nowhere proper for it.
 *
 * ⇒ **A BARE TREE KIND IS A CORRIDOR-ONLY SKELETON, and a NO_ANCHOR there is
 * the TRUTH about that room rather than a defect.** Area is pass 1's to
 * provide: `chambers=k`, `rooms`, and later the elements themselves.
 *
 * ⚠ THIS IS NOT IN TENSION WITH THE LAW ABOVE. A site still never REFUSES a
 * cell — `refusalAt` is untouched and a DIRECTED placement anywhere legal stays
 * legal. What a declared class decides is only where the FREE LOOP looks, and
 * "it looks nowhere, because this room offers none of what I need" is a
 * distribution with empty support, not a legality rule.
 */

/** The four directions, in `gridFlood`'s own order — one neighbour order. */
const DIRS = Object.freeze([
    Object.freeze({ dx: 0, dy: -1, name: 'N' }),
    Object.freeze({ dx: 0, dy: 1, name: 'S' }),
    Object.freeze({ dx: -1, dy: 0, name: 'W' }),
    Object.freeze({ dx: 1, dy: 0, name: 'E' }),
]);

const key = (x, y) => `${x},${y}`;
const cell = (x, y) => Object.freeze({ x, y });
/** ⛔ ROW-MAJOR, everywhere. See `deriveSites`' docblock for why it is a claim. */
const rowMajor = (a, b) => (a.y - b.y) || (a.x - b.x);

/**
 * ⛓⛓⛓ **THE SIX CLASSES, EACH STATED AS ITS EXACT RULE.**
 *
 * All of them are taken over the LIVE GROUND — the ground cells `from` can
 * reach. ⛔ That restriction is arc 1 §9.1's, measured there and inherited
 * whole: *a carved room can hold floor cells NOTHING CAN WALK TO*
 * (`repairConnectivity` repairs the EXITS' reachability, not every floor
 * cell's), and dead floor is not a site — it is not part of the level.
 *
 *   `main`      the cells of ONE shortest ground path from `from` to `to`,
 *               in path order (`gridFlood.shortestPath` — the same BFS, the
 *               same neighbour order, so the path is canonical for a grid).
 *               Empty when the goal is unreachable.
 *   `bend`      the main-path cells whose IN direction differs from their OUT
 *               direction. The two ENDPOINTS are never bends: they have only
 *               one of the two.
 *   `branch`    `[{mouth, dir, length, cells}]` — a STRAIGHT DEAD-END STUB
 *               hanging off the main path. Its `mouth` is a live ground cell
 *               NOT on the main path, 4-adjacent to a main-path cell; `dir` is
 *               the direction away from that cell; `cells` is the straight run
 *               from the mouth in `dir` while the next cell is live ground and
 *               off the main path. ⛔ THE RUN MUST BE A CORRIDOR THAT ENDS: every
 *               cell but the last has exactly TWO live-ground neighbours and
 *               the last has exactly ONE. A run that widens, forks or rejoins
 *               is not a stub and is not offered — which is what makes
 *               `length` a number an element may size itself against.
 *   `tip`       every live ground cell with exactly ONE live-ground neighbour
 *               (a dead end, whether or not a stub leads to it).
 *   `chamber`   the cells of `chambers`, flattened. ⛓ ONE derivation.
 *   `chambers`  the maximal 4-connected blobs of WIDE cells, where a cell is
 *               WIDE iff it belongs to at least one all-ground 2x2 square —
 *               ⚖ arc 1 §9.1's rule verbatim, one rule over two terrains.
 *               ⛔ 4-CONNECTED: two 2x2 squares that touch only at a corner are
 *               TWO chambers, because no mover in either substrate crosses a
 *               corner diagonally and "one chamber" would be a claim about a
 *               room nobody can walk across.
 *   `corridor`  every live ground cell that is not in a chamber — arc 1's
 *               EDGE, by the same rule that makes a chamber.
 *
 * ── ⛔ ROW-MAJOR ORDER IS PART OF THE OUTPUT, NOT A TIDINESS CHOICE ────
 *
 * `anchorsFor` SHUFFLES the class it is handed, and `rng.shuffle` is
 * Fisher-Yates over the list AS GIVEN: a different order is a different level
 * from the same seed. Row-major (y, then x) is chosen because it is the order
 * `procgenSeedling.interiorCells` already emits — which is what makes the open
 * room's one chamber byte-identical to today's list rather than merely equal
 * as a set (`feedback_grouping_reorders_so_assert_the_set`, from the other
 * side: here the ORDER is the claim).
 *
 * ── ⛔⛔ THE PREDICATE IS CALLED **EXACTLY ONCE PER CELL** ─────────────
 *
 * `gridFlood`'s own property, and here it is not a nicety but the difference
 * between a cheap derivation and a hot one. ⛓ MEASURED: Seedling's
 * `procgenLevel.terrainAt` is a LINEAR SCAN of the tiles layer (`tiles.find`
 * plus an `Object.values(TERRAIN).find`) and costs **5.8 µs a call**, so the
 * first draft of this function — which asked the caller's predicate from
 * `wide`, from `degree` and from every blob flood — spent **1.15 ms** on a
 * 10x10 room and made `seedlingModel` 72x more expensive to construct
 * (0.039 ms → 2.819 ms). The predicate is therefore read into a mask ONCE, up
 * front, and every rule below reads the mask.
 *
 * ⚠ A CALLER MAY THEREFORE HAND AN EXPENSIVE PREDICATE without thinking about
 * it, which is the point: the cost of asking "is this ground?" belongs to the
 * substrate, and the number of times it is asked belongs here.
 *
 * @param {number} width
 * @param {number} height
 * @param {(x:number, y:number) => boolean} isGround the CALLER's terrain
 *   predicate over the SKELETON (a wall, a pool and a pit are all not-ground).
 *   ⛔ Called exactly `width * height` times, once per cell, before any rule
 *   runs.
 * @param {{from:{x,y}, to:{x,y}}} o  the start and the goal cells.
 */
export function deriveSites(width, height, isGround, { from, to } = {}) {
    for (const [n, v] of [['width', width], ['height', height]]) {
        if (!Number.isInteger(v) || v <= 0) {
            fail(`sites: ${n} must be a positive integer, got ${JSON.stringify(v)}.`);
        }
    }
    if (typeof isGround !== 'function') {
        fail('sites: `isGround(x, y)` must be a function — the PREDICATE is the binding\'s '
            + 'and the vocabulary is shared. A default ("floor is ground") would be one '
            + 'substrate\'s terrain names imported into the other.');
    }
    for (const [n, p] of [['from', from], ['to', to]]) {
        if (!p || !Number.isInteger(p.x) || !Number.isInteger(p.y)) {
            fail(`sites: \`${n}\` must be \`{x, y}\` with integer cells, got `
                + `${JSON.stringify(p)}. ⛔ It is a CELL — the BINDING converts at its own `
                + 'boundary (`gridFlood`\'s rule, carried whole).');
        }
    }

    /**
     * ⛔ THE ONE PASS OVER THE CALLER'S PREDICATE. Everything below reads
     * `mask`; `isGround` is never called again.
     */
    const mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) if (isGround(x, y)) mask[x + y * width] = 1;
    }
    const onGrid = (x, y) => x >= 0 && y >= 0 && x < width && y < height;
    const isMaskGround = (x, y) => onGrid(x, y) && mask[x + y * width] === 1;
    const live = reachableFrom(width, height, isMaskGround, from);
    /** ⛓ THE LIVE SET, AS A MASK TOO — the rules below are all hot. */
    const liveMask = new Uint8Array(width * height);
    for (const k of live) {
        const [lx, ly] = k.split(',').map(Number);
        liveMask[lx + ly * width] = 1;
    }
    const ground = (x, y) => onGrid(x, y) && liveMask[x + y * width] === 1;
    const degree = (x, y) => {
        let n = 0;
        for (const d of DIRS) if (ground(x + d.dx, y + d.dy)) n += 1;
        return n;
    };

    // ── main + bend ───────────────────────────────────────────────────
    const path = shortestPath(width, height, ground, from, to) ?? [];
    const main = path.map((p) => cell(p.x, p.y));
    const mainSet = new Set(main.map((p) => key(p.x, p.y)));
    const bend = [];
    for (let i = 1; i < main.length - 1; i += 1) {
        const inX = main[i].x - main[i - 1].x;
        const inY = main[i].y - main[i - 1].y;
        const outX = main[i + 1].x - main[i].x;
        const outY = main[i + 1].y - main[i].y;
        if (inX !== outX || inY !== outY) bend.push(main[i]);
    }

    // ── branch stubs + tips ───────────────────────────────────────────
    const branch = [];
    const seenMouth = new Set();
    for (const m of main) {
        for (const d of DIRS) {
            const mx = m.x + d.dx;
            const my = m.y + d.dy;
            const mk = key(mx, my);
            if (!ground(mx, my) || mainSet.has(mk) || seenMouth.has(mk)) continue;
            const cells = [];
            let cx = mx;
            let cy = my;
            while (ground(cx, cy) && !mainSet.has(key(cx, cy))) {
                cells.push(cell(cx, cy));
                cx += d.dx;
                cy += d.dy;
            }
            const straightStub = cells.length > 0 && cells.every((c, i) => (
                degree(c.x, c.y) === (i === cells.length - 1 ? 1 : 2)
            ));
            if (!straightStub) continue;
            seenMouth.add(mk);
            branch.push(Object.freeze({
                mouth: cell(mx, my),
                dir: d.name,
                length: cells.length,
                cells: Object.freeze(cells),
            }));
        }
    }

    // ── chambers (the WIDE rule) + corridor + tips ────────────────────
    const wide = (x, y) => {
        if (!ground(x, y)) return false;
        for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
            if (ground(x + ox, y + oy) && ground(x + ox + 1, y + oy)
                && ground(x + ox, y + oy + 1) && ground(x + ox + 1, y + oy + 1)) return true;
        }
        return false;
    };
    const chambers = [];
    const claimed = new Set();
    const tip = [];
    const corridor = [];
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (!ground(x, y)) continue;
            if (degree(x, y) === 1) tip.push(cell(x, y));
            if (!wide(x, y)) { corridor.push(cell(x, y)); continue; }
            if (claimed.has(key(x, y))) continue;
            /**
             * ⛔ THE BLOB IS `gridFlood.reachableFrom` OVER THE WIDE CELLS —
             * ⚖ the one-of-everything law: a private BFS here would be a
             * second spelling of 4-connectivity, and the day one of them grew
             * a diagonal the partition and the pre-check would disagree while
             * both claimed to be "the flood".
             */
            const blob = reachableFrom(width, height, wide, { x, y });
            for (const k of blob) claimed.add(k);
            chambers.push(Object.freeze({
                cells: Object.freeze([...blob]
                    .map((k) => {
                        const [bx, by] = k.split(',').map(Number);
                        return cell(bx, by);
                    })
                    .sort(rowMajor)),
            }));
        }
    }
    const chamber = chambers.flatMap((c) => c.cells);

    return Object.freeze({
        main: Object.freeze(main),
        bend: Object.freeze(bend),
        branch: Object.freeze(branch),
        tip: Object.freeze(tip),
        chamber: Object.freeze(chamber),
        chambers: Object.freeze(chambers),
        corridor: Object.freeze(corridor),
    });
}

/**
 * ⛓ THE CELL LIST A DECLARED CLASS SELECTS — the ONE place a class name
 * becomes a list, so the census, the shuffle and any later reader cannot each
 * have their own answer.
 *
 * ⛔ `any` IS NOT HANDLED HERE. It is the binding's own whole-interior list
 * (which is not a site at all — it includes wall), and routing it through this
 * function would make the default row's byte-identity a claim about a
 * derivation rather than about a code path that does not run.
 */
export function siteCells(sites, klass) {
    if (klass === 'branch') return sites.branch.flatMap((b) => b.cells);
    const cells = sites?.[klass];
    if (!Array.isArray(cells)) {
        fail(`sites: "${klass}" is not a derived site class. The derived classes are `
            + `[${SITE_CLASSES.filter((c) => c !== 'any').join(', ')}]; "any" is the `
            + 'BINDING\'s whole-interior list and never reaches here.');
    }
    return cells;
}

/**
 * ⛓ COUNTS ONLY — never cell lists. Arc 1's rule for what a payload/report may
 * carry: a reader who wants the cells re-derives them from the level, because
 * a shipped cell list is a second copy of the terrain that can go stale
 * against it.
 */
export function siteSummaryOf(sites) {
    return Object.freeze({
        main: sites.main.length,
        bend: sites.bend.length,
        branch: sites.branch.length,
        branchCells: sites.branch.reduce((n, b) => n + b.length, 0),
        branchLengths: Object.freeze(sites.branch.map((b) => b.length).sort((a, b) => a - b)),
        tip: sites.tip.length,
        chamber: sites.chamber.length,
        chambers: sites.chambers.length,
        chamberSizes: Object.freeze(sites.chambers.map((c) => c.cells.length)
            .sort((a, b) => a - b)),
        corridor: sites.corridor.length,
    });
}
