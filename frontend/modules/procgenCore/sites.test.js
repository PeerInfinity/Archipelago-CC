/**
 * procgenCore/sites — the SITE vocabulary, on HAND-DRAWN skeletons.
 *
 * ⛔ THE FIXTURES ARE LITERAL AND THE EXPECTATIONS ARE HAND-COMPUTED (trap
 * 250). Every list below was worked out on paper from the ASCII map beside it
 * before the code was run; a test that printed what the derivation returned and
 * pasted it back would grade the derivation against itself.
 */
import { describe, expect, it } from 'vitest';

import { SITE_CLASSES, deriveSites, siteCells, siteSummaryOf } from './sites.js';

/**
 * A 10x10 room, ring walled, drawn as eight interior rows of eight characters.
 * `#` is wall, `.` is ground. Row 0 and row 9 (and column 0 / column 9) are the
 * ring and are never written here — the ring is what makes the room a room.
 */
const room = (rows) => {
    const width = 10;
    const height = 10;
    const ground = new Set();
    rows.forEach((row, i) => {
        [...row].forEach((ch, j) => {
            if (ch === '.') ground.add(`${j + 1},${i + 1}`);
        });
    });
    return {
        width,
        height,
        isGround: (x, y) => ground.has(`${x},${y}`),
        ground,
    };
};

const cells = (list) => list.map(([x, y]) => ({ x, y }));

/**
 * ⛓ FIXTURE A — A WINDING CORRIDOR WITH TWO DEAD-END STUBS, and not one
 * all-ground 2x2 square anywhere in it.
 *
 *        1 2 3 4 5 6 7 8
 *    1   . # # # # # # #
 *    2   . # # # # # # #
 *    3   . . . . . . # #
 *    4   # # # . # # # #
 *    5   # . . . . . # #
 *    6   # # # # # # # #
 *    7   # # # # # # # #
 *    8   # # # # # # # #
 *
 * start (1,1), goal (6,5). The whole thing is a TREE, so the shortest path is
 * the only path: (1,1) (1,2) (1,3) (2,3) (3,3) (4,3) (4,4) (4,5) (5,5) (6,5).
 */
const WINDING = room([
    '.#######',
    '.#######',
    '......##',
    '###.####',
    '#.....##',
    '########',
    '########',
    '########',
]);
const WINDING_ENDS = { from: { x: 1, y: 1 }, to: { x: 6, y: 5 } };

/**
 * ⛓ FIXTURE B — TWO 2x2 CHAMBERS THAT TOUCH ONLY AT A CORNER, joined by one
 * corridor cell. ⛔ This is the fixture the 8-neighbour mutant reddens: under
 * 4-connectivity (2,2) and (3,3) are two blobs; under 8 they are one.
 *
 *        1 2 3 4 5 6 7 8
 *    1   . . # # # # # #
 *    2   . . . # # # # #
 *    3   # # . . # # # #
 *    4   # # . . # # # #
 *    5   # # # # # # # #
 *
 * start (1,1), goal (4,4). (3,2) is the joint and is NOT wide: every 2x2
 * square containing it needs (3,1), (4,2) or (2,3), and all three are wall.
 */
const TWO_CHAMBERS = room([
    '..######',
    '...#####',
    '##..####',
    '##..####',
    '########',
    '########',
    '########',
    '########',
]);
const TWO_CHAMBERS_ENDS = { from: { x: 1, y: 1 }, to: { x: 4, y: 4 } };

const sitesOf = (r, ends) => deriveSites(r.width, r.height, r.isGround, ends);

describe('the site vocabulary is closed and its classes are named', () => {
    it('lists exactly the seven classes, with `any` first', () => {
        expect(SITE_CLASSES).toEqual(['any', 'main', 'bend', 'branch', 'tip', 'chamber',
            'corridor']);
    });

    it('⛔ `siteCells` refuses a class it does not derive, BY NAME', () => {
        const s = sitesOf(WINDING, WINDING_ENDS);
        expect(() => siteCells(s, 'nook')).toThrow(/"nook" is not a derived site class/);
        // ⛔ and `any` never reaches it — it is the BINDING's whole-interior list.
        expect(() => siteCells(s, 'any')).toThrow(/"any" is not a derived site class/);
    });
});

describe('FIXTURE A — the winding corridor', () => {
    const s = sitesOf(WINDING, WINDING_ENDS);

    it('the MAIN PATH is the only path, cell for cell', () => {
        expect(s.main).toEqual(cells([[1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [4, 3],
            [4, 4], [4, 5], [5, 5], [6, 5]]));
    });

    it('the BENDS are the three cells where the direction changes — never an endpoint', () => {
        expect(s.bend).toEqual(cells([[1, 3], [4, 3], [4, 5]]));
    });

    it('⛓ the two BRANCH STUBS carry mouth, direction and straight length', () => {
        expect(s.branch).toEqual([
            { mouth: { x: 5, y: 3 }, dir: 'E', length: 2, cells: cells([[5, 3], [6, 3]]) },
            { mouth: { x: 3, y: 5 }, dir: 'W', length: 2, cells: cells([[3, 5], [2, 5]]) },
        ]);
    });

    it('the TIPS are every dead end — the two stub ends, the start and the goal', () => {
        expect(s.tip).toEqual(cells([[1, 1], [6, 3], [2, 5], [6, 5]]));
    });

    it('⛔ there is NO chamber — no all-ground 2x2 square exists, so every cell is corridor',
        () => {
            expect(s.chambers).toEqual([]);
            expect(s.chamber).toEqual([]);
            expect(s.corridor).toEqual(cells([[1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [4, 3],
                [5, 3], [6, 3], [4, 4], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5]]));
        });

    it('the summary is COUNTS, never cells', () => {
        expect(siteSummaryOf(s)).toEqual({
            main: 10,
            bend: 3,
            branch: 2,
            branchCells: 4,
            branchLengths: [2, 2],
            tip: 4,
            chamber: 0,
            chambers: 0,
            chamberSizes: [],
            corridor: 14,
        });
    });
});

describe('FIXTURE B — two chambers that touch only at a corner', () => {
    const s = sitesOf(TWO_CHAMBERS, TWO_CHAMBERS_ENDS);

    it('⛔⛔ TWO chambers, not one — the blob rule is 4-CONNECTED', () => {
        expect(s.chambers).toEqual([
            { cells: cells([[1, 1], [2, 1], [1, 2], [2, 2]]) },
            { cells: cells([[3, 3], [4, 3], [3, 4], [4, 4]]) },
        ]);
        expect(s.chamber).toEqual(cells([[1, 1], [2, 1], [1, 2], [2, 2],
            [3, 3], [4, 3], [3, 4], [4, 4]]));
    });

    it('the joint cell is CORRIDOR — no 2x2 square contains it', () => {
        expect(s.corridor).toEqual(cells([[3, 2]]));
    });

    it('the main path crosses the joint, and there is no tip and no stub', () => {
        expect(s.main).toEqual(cells([[1, 1], [1, 2], [2, 2], [3, 2], [3, 3], [3, 4], [4, 4]]));
        expect(s.bend).toEqual(cells([[1, 2], [3, 2], [3, 4]]));
        expect(s.tip).toEqual([]);
        /**
         * ⛔ (2,1) and (4,3) are ground, off the main path and adjacent to it —
         * and NEITHER is a branch: both have TWO ground neighbours, so each is
         * a way round rather than a way in. A stub must END.
         */
        expect(s.branch).toEqual([]);
    });
});

describe('the derivation refuses what it cannot answer', () => {
    it('an unreachable goal gives an EMPTY main path rather than a throw', () => {
        const r = room([
            '..######',
            '..######',
            '########',
            '#####...',
            '#####...',
            '########',
            '########',
            '########',
        ]);
        const s = deriveSites(r.width, r.height, r.isGround,
            { from: { x: 1, y: 1 }, to: { x: 6, y: 4 } });
        expect(s.main).toEqual([]);
        expect(s.bend).toEqual([]);
        expect(s.branch).toEqual([]);
        /**
         * ⛔ AND THE STRANDED BLOB IS NOT A SITE AT ALL. Arc 1 §9.1's rule,
         * carried whole: only the ground the START can reach is partitioned,
         * because dead floor is not wall and it is not an area — it is not part
         * of the level.
         */
        expect(s.chambers).toHaveLength(1);
        expect(s.chamber).toEqual(cells([[1, 1], [2, 1], [1, 2], [2, 2]]));
        expect(s.corridor).toEqual([]);
    });

    /**
     * ⛔⛔ THE COST PROPERTY, AND IT IS A REGRESSION TEST FOR A REAL DEFECT.
     * The first draft asked the caller's predicate from `wide`, from `degree`
     * and from every blob flood; Seedling's `terrainAt` is a LINEAR SCAN
     * (5.8 µs a call), so `seedlingModel` construction went 0.039 ms → 2.819 ms
     * — 72x — and the whole vitest suite crawled. ⛓ The number of times a
     * predicate is asked belongs to THIS function, and it is asserted rather
     * than hoped for.
     */
    it('⛔ calls `isGround` EXACTLY ONCE PER CELL — the cost belongs to this function', () => {
        const calls = new Map();
        const counted = (x, y) => {
            calls.set(`${x},${y}`, (calls.get(`${x},${y}`) ?? 0) + 1);
            return WINDING.isGround(x, y);
        };
        deriveSites(10, 10, counted, WINDING_ENDS);
        expect(calls.size).toBe(100);
        for (const [cell, n] of calls) expect(`${cell}:${n}`).toBe(`${cell}:1`);
    });

    it('refuses a non-cell endpoint and a missing predicate BY NAME', () => {
        expect(() => deriveSites(10, 10, WINDING.isGround, { from: { tx: 1, ty: 1 }, to: { x: 2, y: 2 } }))
            .toThrow(/`from` must be `\{x, y\}`/);
        expect(() => deriveSites(10, 10, null, WINDING_ENDS))
            .toThrow(/`isGround\(x, y\)` must be a function/);
    });
});
