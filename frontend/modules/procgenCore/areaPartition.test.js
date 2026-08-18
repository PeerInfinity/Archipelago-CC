/**
 * procgenCore/areaPartition.test — THE ONE PARTITION, on hand-drawn grids
 * (PROCGEN ELEMENTS arc 3, slice 4b, D1).
 *
 * ⛔ THESE ROWS ARE **NOT** A SECOND COPY OF `mazeRoom/procgenMazeAreas.test
 * .js`. That file's 35 rows drive this same body through the maze's adapter and
 * are what proves the LIFT moved nothing; these rows drive the GRID VOCABULARY
 * directly — an `isFloor` predicate over a literal a reader can check by eye —
 * which is the entry the Seedling binding uses and which had no rows at all
 * before this slice (trap 353: *a reader shipped for a route that does not
 * exist yet is untested where it will be used*).
 */

import { describe, expect, it } from 'vitest';

import { partitionAreas, verifyAreaLevels, wideBlobs } from './areaPartition.js';

/** `#` is wall, `.` is floor. The grid is a LITERAL — a fixture the test
 *  computed would test the partition against the partition. */
const gridOf = (rows) => {
    const height = rows.length;
    const width = rows[0].length;
    for (const r of rows) expect(r.length).toBe(width);
    return { width, height, isFloor: (x, y) => rows[y]?.[x] === '.' };
};
const at = (cells) => cells.map((c) => `${c.x},${c.y}`).sort().join(' ');

describe('wideBlobs — the 2x2 rule, and the two claims about its ORDER', () => {
    it('⛓ a 3x3 open square is ONE blob of nine cells, not the centre alone', () => {
        const g = gridOf(['#####', '#...#', '#...#', '#...#', '#####']);
        const blobs = wideBlobs(g.width, g.height, g.isFloor);
        expect(blobs.length).toBe(1);
        expect(blobs[0].length).toBe(9);
        /** ⛔ ROW-MAJOR: the first cell is the top-left, not the flood's entry. */
        expect(blobs[0][0]).toEqual({ x: 1, y: 1 });
        expect(blobs[0][8]).toEqual({ x: 3, y: 3 });
    });

    it('⛔ a 1-wide corridor has NO wide cell anywhere — it is an EDGE, never an area', () => {
        const g = gridOf(['#####', '#...#', '#.#.#', '#...#', '#####']);
        // the ring of floor is 1 wide everywhere: no all-floor 2x2 square exists
        expect(wideBlobs(g.width, g.height, g.isFloor)).toEqual([]);
    });

    it('⛔ two 2x2 squares that touch only at a CORNER are TWO blobs (4-connected)', () => {
        const g = gridOf(['######', '#..###', '#..###', '###..#', '###..#', '######']);
        const blobs = wideBlobs(g.width, g.height, g.isFloor);
        expect(blobs.length).toBe(2);
        expect(blobs.map((b) => b.length)).toEqual([4, 4]);
        /** the SCAN order (y then x) is the order the areas are numbered in. */
        expect(blobs[0][0]).toEqual({ x: 1, y: 1 });
        expect(blobs[1][0]).toEqual({ x: 3, y: 3 });
    });
});

describe('partitionAreas — chamber, corridor, synthetic, dead floor, declared', () => {
    /**
     *   0123456
     * 0 #######
     * 1 #S.....   the START (1,1) sits in a 1-wide corridor along row 1
     * 2 #####.#
     * 3 ###...#   a 3x2 chamber at (3..5, 3..4)
     * 4 ###...#
     * 5 ###G###   the GOAL (3,5) hangs off it
     * 6 #######
     */
    const ROOM = ['#######', '#......', '#####.#', '###...#', '###...#', '###...#', '#######'];
    const g = gridOf(ROOM);
    const P = () => partitionAreas({ ...g, entrance: { x: 1, y: 1 }, goal: { x: 3, y: 5 } });

    it('⛓ ONE real chamber (the 3x3 blob), and the ENTRANCE gets a SYNTHETIC 1-cell area', () => {
        const p = P();
        const real = p.areas.filter((a) => !a.synthetic);
        expect(real.length).toBe(1);
        expect(real[0].id).toBe('A0');
        expect(real[0].size).toBe(9);
        const synth = p.areas.filter((a) => a.synthetic);
        expect(synth.length).toBe(1);
        expect(synth[0].cells).toEqual([{ x: 1, y: 1 }]);
        expect(p.entranceArea).toBe(synth[0].id);
    });

    it('⛔ THE GOAL IS INSIDE THE CHAMBER, so no second synthetic area is grown', () => {
        const p = P();
        expect(p.goalArea).toBe('A0');
        expect(p.areas.filter((a) => a.synthetic).length).toBe(1);
    });

    it('⛓ the CORRIDOR joining them is a component that TOUCHES both areas', () => {
        const p = P();
        expect(p.corridorComponents.length).toBe(1);
        expect(p.corridorComponents[0].touches.length).toBe(2);
        expect(p.adjacency.length).toBe(1);
        expect(p.adjacency[0].via[0].kind).toBe('corridor');
    });

    it('⛓⛓ THE BOUNDARY IS THE AREA-SIDE CELL — the chamber cell the corridor meets', () => {
        const p = P();
        const chamber = p.areas.find((a) => a.id === 'A0');
        expect(at(chamber.boundary)).toBe('5,3');
        /** ⛔ and it is IN the area: an area cell belongs to exactly one area,
         *  which is what makes the door cell unambiguous. */
        expect(chamber.cells.some((c) => c.x === 5 && c.y === 3)).toBe(true);
    });

    it('⛔⛔ FLOOR THE ENTRANCE CANNOT REACH IS NOT AN AREA — it is `deadFloorCells`', () => {
        const rows = ['########', '#..#..##', '####..##', '########'];
        const gg = gridOf(rows);
        const p = partitionAreas({ ...gg, entrance: { x: 1, y: 1 }, goal: { x: 2, y: 1 } });
        /** the 2x2 blob at (4..5,1..2) is behind a wall column: it is dead floor. */
        expect(p.deadFloorCells).toBe(4);
        expect(p.areas.filter((a) => !a.synthetic).length).toBe(0);
        expect(p.liveFloorCells).toBe(2);
    });

    it('⛓⛓⛓ A DECLARED AREA IS TOLD, NOT DISCOVERED — and its cells leave the blob rule', () => {
        /** the declared lane is (1,1)-(3,1); WITHOUT the declaration those three
         *  cells complete the 2x2 squares of the block below them. */
        const rows = ['#####', '#...#', '#...#', '#####'];
        const gg = gridOf(rows);
        const bare = partitionAreas({ ...gg, entrance: { x: 1, y: 1 }, goal: { x: 3, y: 2 } });
        expect(bare.areas.length).toBe(1);
        expect(bare.areas[0].size).toBe(6);

        const told = partitionAreas({ ...gg,
            entrance: { x: 1, y: 1 },
            goal: { x: 3, y: 2 },
            declared: [{ id: 'E0', cells: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }] }] });
        const e0 = told.areas.find((a) => a.id === 'E0');
        expect(e0.kind).toBe('element');
        expect(e0.synthetic).toBe(false);
        expect(e0.size).toBe(3);
        /** ⛔ THE REST IS NOW 1-WIDE, so there is no chamber left at all — the
         *  declared cells were excluded from the rule ENTIRELY rather than
         *  merely skipped when the loop reached them. */
        expect(told.areas.filter((a) => a.kind === 'chamber' && !a.synthetic)).toEqual([]);
        /** and the goal, no longer in a blob, gets its synthetic one. */
        expect(told.areas.find((a) => a.id === told.goalArea).synthetic).toBe(true);
    });

    it('⛔ the GOAL is REQUIRED, and the refusal says why', () => {
        expect(() => partitionAreas({ ...g, entrance: { x: 1, y: 1 } }))
            .toThrow(/synthetic area has to be grown/);
    });
});

describe('verifyAreaLevels — the level-n flood, and it is NOT vacuous', () => {
    /**
     *   0123456
     * 0 #######
     * 1 #.....#    the whole row-1..2 block is one chamber A0 (level 0)
     * 2 #.....#
     * 3 ###.###    one corridor cell
     * 4 #.....#    a second chamber A1 (level 1) behind it
     * 5 #.....#
     * 6 #######
     */
    const ROWS = ['#######', '#.....#', '#.....#', '###.###', '#.....#', '#.....#', '#######'];
    const g = gridOf(ROWS);
    const p = partitionAreas({ ...g, entrance: { x: 1, y: 1 }, goal: { x: 1, y: 5 } });
    const lower = p.areas.find((a) => a.cells.some((c) => c.y === 1));
    const upper = p.areas.find((a) => a.cells.some((c) => c.y === 5));
    const levelOfArea = (id) => (id === upper.id ? 1 : 0);
    const doors = new Set(upper.boundary.map((c) => `${c.x},${c.y}`));

    it('⛓ two chambers joined by ONE corridor cell, and the far one is level 1', () => {
        expect(p.areas.filter((a) => !a.synthetic).length).toBe(2);
        expect(lower.id).not.toBe(upper.id);
        expect(at(upper.boundary)).toBe('3,4');
    });

    it('⛓ with the level-1 locks on every boundary cell, the flood AGREES', () => {
        expect(verifyAreaLevels({ ...g,
            entrance: { x: 1, y: 1 },
            partition: p,
            levelOfArea,
            doorLevelAt: (x, y) => (doors.has(`${x},${y}`) ? 1 : null) })).toBe(null);
    });

    it('⛔⛔ A HOLE IN THE CUT IS REPORTED — one boundary cell left unlocked', () => {
        const bad = verifyAreaLevels({ ...g,
            entrance: { x: 1, y: 1 },
            partition: p,
            levelOfArea,
            doorLevelAt: () => null });
        expect(bad).not.toBe(null);
        expect(bad.level).toBe(0);
        expect(bad.extra.length).toBeGreaterThan(0);
        expect(bad.detail).toMatch(/REACHED but not claimed/);
    });

    it('⛔⛔⛔ `> n` IS THE WHOLE CLAIM — a lock of level exactly n must be OPEN at n', () => {
        /** the mutant arc 1 ran, restated in grid vocabulary: treating a door of
         *  level `n` as wall at level `n` leaves the area unreachable at its own
         *  key level, and the flood says so. */
        const missing = verifyAreaLevels({ ...g,
            entrance: { x: 1, y: 1 },
            partition: p,
            levelOfArea,
            doorLevelAt: (x, y) => (doors.has(`${x},${y}`) ? 2 : null) });
        expect(missing).not.toBe(null);
        expect(missing.level).toBe(1);
        expect(missing.missing.length).toBeGreaterThan(0);
        expect(missing.detail).toMatch(/UNREACHABLE but claimed/);
    });
});
