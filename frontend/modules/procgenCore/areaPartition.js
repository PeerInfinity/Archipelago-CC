/**
 * procgenCore/areaPartition — **WHAT AN AREA IS**, in grid vocabulary, for
 * every substrate on the loop.
 *
 * PROCGEN ELEMENTS arc 3, slice 4b (D1). ⛔ THIS IS A **MOVE**, NOT A REWRITE:
 * the body below is `mazeRoom/procgenMaze.partitionMazeAreas`' body (arc 1,
 * slice 2) with the maze's `getTile(world, x, y) === TILE_FLOOR` replaced by
 * the caller's `isFloor(x, y)` — which is exactly what that function's own
 * docblock said it was written for:
 *
 *   *"⚠ ARC 3 WILL WANT THIS FOR SEEDLING and will have to LIFT it into
 *   `procgenCore/`. … the rule above is stated in grid vocabulary (`isFloor`
 *   plus a width and a height) precisely so the lift is a move rather than a
 *   rewrite."*
 *
 * The proof that it IS a move is the maze's own byte-identity md5, its nine
 * per-kind CLI md5s, `procgenMazeAreas.test.js` and `check-maze-lab` — all
 * unchanged across the lift.
 *
 * ── ⛓⛓⛓ THE RULE ──────────────────────────────────────────────────────
 *
 *   **A cell is WIDE iff it belongs to at least one all-floor 2x2 square.**
 *   **An AREA is a maximal 4-connected blob of WIDE cells.**
 *   **Every other floor cell is a CORRIDOR cell — an EDGE, never an area.**
 *
 * ⛔ THE BRIEF'S FIRST WORDING WAS TRIED AND REJECTED BY ARITHMETIC (arc-1
 * §9.1): *"a floor cell with >= 2 floor neighbours in BOTH axes"* keeps only
 * the CENTRE of a 3x3 chamber, so `chambers`' own stamp would have reduced to a
 * ONE-cell area. ⛓ `minArea` is therefore not a separate bound: the smallest
 * possible blob IS a 2x2, so `minArea = 4` is implied by the rule.
 *
 * ── ⛔⛔ ONE BLOB PRIMITIVE, TWO CALLERS — AND THE TWO RULES DIFFER ────
 *
 * `procgenCore/sites.js`'s `chamber` class is THE SAME 2x2 rule, and this file
 * is where the rule lives now: `wideBlobs` is the primitive and `sites.js`
 * calls it. ⚠ The two CALLERS differ in two details, and both live ABOVE the
 * primitive rather than inside it — which is why one primitive is enough:
 *
 *  1. **`partitionAreas` excludes DECLARED areas from the blob rule**
 *     (an element's push lane is 1 wide and would be shredded into corridor;
 *     worse, a gadget cell left in the blob set could COMPLETE some
 *     neighbouring chamber's 2x2 square and pull a corridor cell into an area
 *     for a reason about the gadget rather than about the room). `sites.js`
 *     has no declared areas and passes none.
 *  2. **`partitionAreas` grows SYNTHETIC 1-cell areas** on the entrance and
 *     the goal when neither lies in a chamber. `sites.js` does not: a site is
 *     a proposal distribution, and a 1-cell "chamber" nobody can decorate is
 *     not a place.
 *
 * ⇒ the primitive takes a GROUND PREDICATE and returns blobs; each caller
 * decides what it hands in and what it does with the answer.
 *
 * ── ADJACENCY ─────────────────────────────────────────────────────────
 *
 * Two areas are adjacent iff some CORRIDOR COMPONENT touches both, or iff two
 * of their cells are 4-adjacent (a zero-corridor edge, reachable only through a
 * synthetic area, since two touching WIDE cells are by construction one blob).
 * A corridor component touching three areas makes all three pairs adjacent.
 *
 * ⛔ ONE FLOOD (⚖ arc-1 ruling 5): every blob and every component here is
 * `procgenCore/gridFlood.reachableFrom`, the same function the level-n
 * verification runs.
 *
 * ⛔ NO DOM AND NO NODE IMPORTS: both lab pages load this in a browser.
 */

import { reachableFrom } from './gridFlood.js';

export class AreaPartitionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AreaPartitionError';
    }
}

const fail = (message) => { throw new AreaPartitionError(message); };

const key = (x, y) => `${x},${y}`;
/** ⛔ ROW-MAJOR, everywhere — see `partitionAreas`' `claim`. */
const rowMajor = (a, b) => (a.y - b.y) || (a.x - b.x);
const NEIGHBOURS = Object.freeze([[0, -1], [0, 1], [-1, 0], [1, 0]]);

/**
 * ⛓⛓⛓ **THE BLOB PRIMITIVE — the 2x2 rule, once, for both callers.**
 *
 * @param {number} width
 * @param {number} height
 * @param {(x:number,y:number)=>boolean} isBlobGround the cells the rule may
 *   use. ⛔ It is asked off-grid too and must answer `false` there — every
 *   caller's predicate already does, and guarding here as well would be a
 *   second answer to "where does the grid end".
 * @returns {Array<Array<{x,y}>>} the blobs, in the SCAN ORDER (y then x) their
 *   first cell is met, each blob's cells ROW-MAJOR. Both orders are part of the
 *   output: the maze numbers areas `A0, A1, …` by this order, and `sites.js`'s
 *   shuffle is Fisher-Yates over the list AS GIVEN.
 */
export function wideBlobs(width, height, isBlobGround) {
    const onGrid = (x, y) => x >= 0 && y >= 0 && x < width && y < height;
    const g = (x, y) => onGrid(x, y) && isBlobGround(x, y);
    /** ⛓ THE WIDE RULE, in one line: some all-floor 2x2 square contains (x,y). */
    const wide = (x, y) => {
        if (!g(x, y)) return false;
        for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
            if (g(x + ox, y + oy) && g(x + ox + 1, y + oy)
                && g(x + ox, y + oy + 1) && g(x + ox + 1, y + oy + 1)) return true;
        }
        return false;
    };
    const claimed = new Set();
    const blobs = [];
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (!wide(x, y) || claimed.has(key(x, y))) continue;
            const cells = reachableFrom(width, height, wide, { x, y });
            for (const k of cells) claimed.add(k);
            blobs.push([...cells]
                .map((k) => {
                    const [bx, by] = k.split(',').map(Number);
                    return Object.freeze({ x: bx, y: by });
                })
                .sort(rowMajor));
        }
    }
    return blobs;
}

/**
 * ⛓⛓⛓ **THE PARTITION** — arc-1 slice 2's `partitionMazeAreas`, in grid
 * vocabulary. Every rule below carries its own forcing measurement from that
 * slice; nothing here is new to slice 4b except the parameter list.
 *
 * ── ⛓ THE ENTRANCE AND THE GOAL GET A 1-CELL AREA WHEN THEY NEED ONE ──
 *
 * On the maze they usually do NOT lie in a chamber (the entrance is the corner
 * (0,0), the goal is drawn from the whole grid, and both are attached by an
 * L-carve — a 1-wide stub), so a SYNTHETIC one-cell area is grown on each and
 * marked `synthetic: true`. ⛔ It is grown BEFORE the corridor components are
 * found, because it removes its cell from the corridor set and would otherwise
 * split one component into two.
 *
 * ── ⛓⛓⛓ ONLY THE FLOOR THE ENTRANCE CAN REACH IS PARTITIONED ──────────
 *
 * A carved room can hold floor cells NOTHING CAN WALK TO (`repairConnectivity`
 * repairs the EXITS' reachability, not every floor cell's — measured on `rooms`
 * seed 6 at 11x11: rows 7-10 are a pocket behind a solid wall row). The first
 * draft partitioned them anyway and `buildAreaGraph` THREW by name. ⇒ dead
 * floor is not wall and is not an area: it is NOT PART OF THE LEVEL, and
 * `deadFloorCells` says how much of it there was.
 *
 * @param {object} o
 * @param {number} o.width
 * @param {number} o.height
 * @param {(x:number,y:number)=>boolean} o.isFloor the caller's terrain
 *   predicate. ⛔ On the maze that is `getTile === TILE_FLOOR`; on Seedling it
 *   is `terrainAt === 'ground'` (wall, water and pit all block). There is no
 *   default: a default would be one substrate's terrain names imported into
 *   the other (`gridFlood`'s and `sites.js`'s own rule).
 * @param {{x,y}} o.entrance
 * @param {{x,y}} o.goal ⛔ REQUIRED — it is what decides whether a synthetic
 *   area has to be grown, and guessing it from an exits map would be a second
 *   reading of a fact the model already owns.
 * @param {Array<{id, cells, kind}>} [o.declared] areas that EXIST BEFORE the
 *   partition runs (an element's own cells). Their cells are excluded from the
 *   blob rule entirely — see the file docblock, difference 1.
 */
export function partitionAreas({
    width, height, isFloor, entrance, goal, declared = [],
} = {}) {
    for (const [n, v] of [['width', width], ['height', height]]) {
        if (!Number.isInteger(v) || v <= 0) {
            fail(`areaPartition: ${n} must be a positive integer, got ${JSON.stringify(v)}.`);
        }
    }
    if (typeof isFloor !== 'function') {
        fail('areaPartition: `isFloor(x, y)` must be a function — the PREDICATE is the '
            + 'binding\'s and the vocabulary is shared.');
    }
    const start = entrance;
    const end = goal;
    for (const [n, p] of [['entrance', start], ['goal', end]]) {
        if (!p || !Number.isInteger(p.x) || !Number.isInteger(p.y)) {
            fail(`areaPartition: \`${n}\` must be \`{x, y}\` with integer cells, got `
                + `${JSON.stringify(p)}. ⛔ The GOAL in particular is REQUIRED: it is what `
                + 'decides whether a synthetic area has to be grown.');
        }
    }
    const onGrid = (x, y) => x >= 0 && y >= 0 && x < width && y < height;
    const floorAt = (x, y) => onGrid(x, y) && isFloor(x, y);
    const live = reachableFrom(width, height, floorAt, start);
    const floor = (x, y) => onGrid(x, y) && live.has(key(x, y));
    /**
     * ⛓⛓⛓ **A DECLARED AREA IS NOT DISCOVERED, IT IS TOLD** (arc-2 slice 3
     * §9.9.5). ⛔ ITS CELLS BELONG TO IT AND TO NOTHING ELSE, so they are
     * excluded from the blob rule ENTIRELY — not merely skipped when the loop
     * reaches them.
     */
    const declaredKeys = new Set();
    for (const dArea of declared) for (const c of dArea.cells) declaredKeys.add(key(c.x, c.y));
    const blobFloor = (x, y) => floor(x, y) && !declaredKeys.has(key(x, y));

    const label = new Map();          // "x,y" -> area id
    const areas = [];
    /**
     * ⛔ CELLS ARE SORTED **ROW-MAJOR**, not left in the flood's BFS order. The
     * flood's order is deterministic but it is an artefact of where the blob was
     * entered; row-major is the order a reader checking a fixture by eye
     * expects, and it is the order the payload and every drift fixture carry.
     */
    const claim = (id, cells, synthetic, kind = 'chamber') => {
        const list = [...cells].map((c) => (typeof c === 'string'
            ? (() => { const [x, y] = c.split(',').map(Number); return Object.freeze({ x, y }); })()
            : Object.freeze({ x: c.x, y: c.y })));
        for (const c of list) label.set(key(c.x, c.y), id);
        areas.push({ id, cells: list.sort(rowMajor), synthetic, kind });
    };
    /**
     * ⛓ THE DECLARED AREAS FIRST — they exist before the partition runs. ⛔ Only
     * their LIVE cells are claimed. ⛓ THE `A` COUNTER IS ITS OWN, NOT
     * `areas.length`: claiming a declared area first would otherwise renumber
     * every chamber on the level, and the ids are what the payload, the census
     * and the drift fixtures carry.
     */
    let nextA = 0;
    for (const dArea of declared) {
        const cells = dArea.cells.filter((c) => live.has(key(c.x, c.y)));
        if (cells.length === 0) continue;
        /**
         * ⛓ A DECLARED AREA MAY NAME ITS OWN `kind`. The default is `element`
         * (what arc 2 declared and what the maze still passes), and arc 3's
         * Seedling binding uses `goal` for the vestibule it grows around the
         * torch — two declared areas that mean different things, and a reader
         * of a census column has to be able to tell them apart.
         */
        claim(dArea.id, cells, false, dArea.kind ?? 'element');
    }
    for (const blob of wideBlobs(width, height, blobFloor)) {
        nextA += 1;
        claim(`A${nextA - 1}`, blob, false);
    }
    /** ⛓ The synthetic ones, in a FIXED order (entrance then goal) so two runs agree. */
    for (const p of [start, end]) {
        if (!floor(p.x, p.y) || label.has(key(p.x, p.y))) continue;
        nextA += 1;
        claim(`A${nextA - 1}`, [{ x: p.x, y: p.y }], true);
    }

    const corridor = (x, y) => floor(x, y) && !label.has(key(x, y));
    const corridorComponents = [];
    const seenCorridor = new Set();
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            if (!corridor(x, y) || seenCorridor.has(key(x, y))) continue;
            const cells = reachableFrom(width, height, corridor, { x, y });
            for (const k of cells) seenCorridor.add(k);
            const touches = new Set();
            for (const k of cells) {
                const [cx, cy] = k.split(',').map(Number);
                for (const [dx, dy] of NEIGHBOURS) {
                    const id = label.get(key(cx + dx, cy + dy));
                    if (id !== undefined) touches.add(id);
                }
            }
            corridorComponents.push(Object.freeze({
                cells: Object.freeze([...cells]),
                size: cells.size,
                touches: Object.freeze([...touches].sort()),
            }));
        }
    }

    const pairs = new Map();
    const addPair = (a, b, via) => {
        if (a === b) return;
        const k = a < b ? `${a}|${b}` : `${b}|${a}`;
        const prev = pairs.get(k);
        if (prev) { prev.via.push(via); return; }
        pairs.set(k, { a: a < b ? a : b, b: a < b ? b : a, via: [via] });
    };
    for (const [i, comp] of corridorComponents.entries()) {
        for (let a = 0; a < comp.touches.length; a += 1) {
            for (let b = a + 1; b < comp.touches.length; b += 1) {
                addPair(comp.touches[a], comp.touches[b], { kind: 'corridor', component: i,
                    corridorCells: comp.size });
            }
        }
    }
    /** ⛓ ZERO-CORRIDOR adjacency — only a synthetic area can produce one. */
    for (const area of areas) {
        for (const c of area.cells) {
            for (const [dx, dy] of NEIGHBOURS) {
                const other = label.get(key(c.x + dx, c.y + dy));
                if (other !== undefined && other !== area.id) {
                    addPair(area.id, other, { kind: 'touch', corridorCells: 0 });
                }
            }
        }
    }

    /**
     * ⛓⛓⛓ EVERY AREA'S **BOUNDARY** CELLS — its own cells that touch a floor
     * cell NOT its own. ⛔ NOT "cells that touch a CORRIDOR cell": a SYNTHETIC
     * area can sit directly against a chamber (a zero-corridor adjacency), and
     * a boundary defined by corridors alone would miss that side and leave the
     * realisation's door with an unguarded way in.
     *
     * ⛓ THE BOUNDARY IS WHERE THE DOOR GOES, and it is an AREA-side cell rather
     * than a corridor-side one, which is what makes the door cell UNAMBIGUOUS: a
     * corridor mouth cell can be adjacent to TWO areas at once, and one cell
     * holds one obstacle. An area cell belongs to exactly one area.
     */
    for (const area of areas) {
        const boundary = [];
        for (const c of area.cells) {
            for (const [dx, dy] of NEIGHBOURS) {
                const other = label.get(key(c.x + dx, c.y + dy));
                if (floor(c.x + dx, c.y + dy) && other !== area.id) { boundary.push(c); break; }
            }
        }
        area.boundary = Object.freeze(boundary);
        area.size = area.cells.length;
        Object.freeze(area.cells);
        Object.freeze(area);
    }

    return Object.freeze({
        areas: Object.freeze(areas),
        adjacency: Object.freeze([...pairs.values()].map((p) => Object.freeze({
            a: p.a, b: p.b, via: Object.freeze(p.via),
        }))),
        corridorComponents: Object.freeze(corridorComponents),
        labelAt: (x, y) => label.get(key(x, y)) ?? null,
        entranceArea: label.get(key(start.x, start.y)) ?? null,
        goalArea: label.get(key(end.x, end.y)) ?? null,
        cellCount: label.size,
        liveFloorCells: live.size,
        /** ⛓ Floor the entrance cannot reach — see `live` above. */
        deadFloorCells: (() => {
            let n = 0;
            for (let y = 0; y < height; y += 1) {
                for (let x = 0; x < width; x += 1) {
                    if (floorAt(x, y) && !live.has(key(x, y))) n += 1;
                }
            }
            return n;
        })(),
    });
}

/**
 * ⛓⛓⛓ **THE LEVEL-n FLOOD** — arc-1 slice 2's `verifyAreaLevels`, in grid
 * vocabulary. ⛔ A MOVE, like the partition above; the maze's own function is
 * now a thin adapter and its 35 rows still drive this body.
 *
 * For each key level `n`, with every door of level > `n` treated as WALL, the
 * set of floor cells the entrance reaches must be EXACTLY
 *
 *   { every cell of every area whose keyLevel <= n }
 *   ∪ { every cell of every corridor component that touches such an area }
 *
 * A corridor component is freely walkable (no door ever sits on one — the doors
 * are on AREA-side boundary cells), so the ones the player reaches are exactly
 * the ones adjacent to an area they can enter, and a component touching only
 * high-level areas is unreachable until those open. ⚠ It is a claim about
 * TERRAIN AND DOORS with an assumed inventory, NOT about whether the keys can
 * actually be collected in order — that is the ORACLE's question and the
 * skeleton solve is what asks it.
 *
 * @param {object} o
 * @param {number} o.width
 * @param {number} o.height
 * @param {(x,y)=>boolean} o.isFloor
 * @param {{x,y}} o.entrance
 * @param {object} o.partition the value `partitionAreas` returned.
 * @param {(id)=>number} o.levelOfArea an area's key level (0 when the graph
 *   gave it none).
 * @param {(x,y)=>(number|null)} o.doorLevelAt the level of the door on a cell,
 *   or `null` for no door. ⛔ THE LEVEL, not the symbol: an area at key level
 *   `L` is entered with `K{L-1}` in hand, so its doors are `door_K{L-1}` and
 *   the LEVEL of that door is `L`. The two spellings are the same arithmetic
 *   seen from two sides and a second one is how an off-by-one gets in.
 * @param {object|null} [o.sets] ⛓⛓ PROCGEN ELEMENTS arc 3, slice 5b (D2) — an
 *   OPTIONAL OUT-PARAMETER. When present it is filled with `levels: [{level,
 *   reached, expected}]`, one row per key level ASKED, in the order they were
 *   asked and INCLUDING the level that refused. ⛔ It is an out-parameter and
 *   not a second return value for one reason: every existing caller's read has
 *   to stay byte-identical, and the maze's adapter passes nothing and therefore
 *   allocates nothing. The sets are what the flood ALREADY computed — a refused
 *   level-n flood is exactly the picture a reader wants and re-deriving it
 *   afterwards would be a second answer to the same question.
 * @returns {null | {level, missing, extra, detail}} a REFUSAL naming the first
 *   offending cell, or `null`. ⛔ Never a throw: a mismatch is something the
 *   CLI and the lab page must be able to PRINT.
 */
export function verifyAreaLevels({
    width, height, isFloor, entrance, partition, levelOfArea, doorLevelAt, sets = null,
} = {}) {
    const levelOf = new Map();
    let maxLevel = 0;
    for (const area of partition.areas) {
        const l = levelOfArea(area.id) ?? 0;
        levelOf.set(area.id, l);
        if (l > maxLevel) maxLevel = l;
    }
    const from = { x: entrance.x, y: entrance.y };
    for (let n = 0; n <= maxLevel; n += 1) {
        const expected = new Set();
        for (const area of partition.areas) {
            if (levelOf.get(area.id) > n) continue;
            for (const c of area.cells) expected.add(key(c.x, c.y));
        }
        for (const comp of partition.corridorComponents) {
            if (!comp.touches.some((id) => levelOf.get(id) <= n)) continue;
            for (const k of comp.cells) expected.add(k);
        }
        const walkable = (x, y) => {
            if (!isFloor(x, y)) return false;
            const level = doorLevelAt(x, y);
            /**
             * ⛔ `> n`, AND THE COMPARISON IS THE WHOLE CLAIM. A door of level
             * exactly `n` is one the player at level `n` has the key for
             * (`door_K{n-1}`); walling it too would be an off-by-one that reads
             * as "the lock is one level too strong" — the mutant this rule is
             * gated against, in BOTH bindings.
             */
            return level === null || level <= n;
        };
        const actual = reachableFrom(width, height, walkable, from);
        /** ⛓ SLICE 5b (D2) — CARRIED, never re-derived: this is the flood the
         *  verdict is computed FROM. */
        if (sets) {
            if (!sets.levels) sets.levels = [];
            sets.levels.push(Object.freeze({
                level: n,
                reached: Object.freeze([...actual]),
                expected: Object.freeze([...expected]),
            }));
        }
        const missing = [...expected].filter((k) => !actual.has(k)).sort();
        const extra = [...actual].filter((k) => !expected.has(k)).sort();
        if (missing.length || extra.length) {
            return {
                level: n,
                missing: Object.freeze(missing),
                extra: Object.freeze(extra),
                detail: `at key level ${n} the entrance reaches ${actual.size} floor cell(s) `
                    + `and the partition says it should reach ${expected.size}. `
                    + (missing.length
                        ? `UNREACHABLE but claimed: (${missing[0]})${missing.length > 1
                            ? ` and ${missing.length - 1} more` : ''}. ` : '')
                    + (extra.length
                        ? `REACHED but not claimed: (${extra[0]})${extra.length > 1
                            ? ` and ${extra.length - 1} more` : ''}. ` : '')
                    + '⛓ A locked edge is a CUT by construction of the tree; this is the check '
                    + 'that the GRID agrees, which is the one thing construction cannot '
                    + 'promise (trap 272).',
            };
        }
    }
    return null;
}
