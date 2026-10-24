/**
 * procgenCore/gridFlood.test — the ONE flood, driven on hand-written grids.
 *
 * CONSTRUCTIVE-MODE arc, slice 6. ⛔ The grids here are ASCII literals a reader
 * can check by eye, not generated ones: this is the file that says what
 * "connected" means for both bindings, and a grid the test itself computed
 * would test the flood against the flood.
 */

import { describe, expect, it } from 'vitest';
import {
    GridFloodError, SHORTCUT_LAW_CLAUSES, connected, reachableFrom, shortcutLawRefusal,
    shortestPath,
} from './gridFlood.js';

/**
 * `#` is wall, anything else is walkable. Rows are given top-to-bottom, so the
 * literal in the test reads the way the room looks.
 */
const grid = (rows) => {
    const height = rows.length;
    const width = rows[0].length;
    for (const r of rows) expect(r.length).toBe(width);
    return {
        width,
        height,
        isWalkable: (x, y) => rows[y][x] !== '#',
    };
};

const run = (rows, from, to) => {
    const g = grid(rows);
    return connected(g.width, g.height, g.isWalkable, from, to);
};

describe('procgenCore/gridFlood — connected()', () => {
    it('walks an open room corner to corner', () => {
        expect(run([
            '.....',
            '.....',
            '.....',
        ], { x: 0, y: 0 }, { x: 4, y: 2 })).toBe(true);
    });

    it('a wall spanning the room DISCONNECTS the two halves', () => {
        expect(run([
            '.....',
            '#####',
            '.....',
        ], { x: 0, y: 0 }, { x: 4, y: 2 })).toBe(false);
    });

    it('the same wall with ONE gap connects them again', () => {
        expect(run([
            '.....',
            '###.#',
            '.....',
        ], { x: 0, y: 0 }, { x: 4, y: 2 })).toBe(true);
    });

    it('⛔ 4-NEIGHBOUR: a diagonal-only link is NOT a path', () => {
        // (1,1) and (2,2) touch at a corner and nowhere else. Neither engine
        // lets a mover cross that, so neither does this.
        expect(run([
            '.#.',
            '##.',
            '..#',
        ], { x: 0, y: 0 }, { x: 2, y: 2 })).toBe(false);
    });

    it('a winding 1-wide corridor is connected end to end', () => {
        expect(run([
            '.....',
            '####.',
            '.....',
            '.####',
            '.....',
        ], { x: 0, y: 0 }, { x: 4, y: 4 })).toBe(true);
    });

    it('the SAME corridor with one cell filled is not', () => {
        expect(run([
            '.....',
            '####.',
            '..#..',
            '.####',
            '.....',
        ], { x: 0, y: 0 }, { x: 4, y: 4 })).toBe(false);
    });

    it('from === to is connected, even in a room of one cell', () => {
        expect(run(['.'], { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(true);
    });

    it('⚠ a NON-WALKABLE endpoint answers false rather than throwing', () => {
        expect(run(['...', '.#.', '...'], { x: 0, y: 0 }, { x: 1, y: 1 })).toBe(false);
        expect(run(['...', '.#.', '...'], { x: 1, y: 1 }, { x: 0, y: 0 })).toBe(false);
        // ⛓ and a walled cell that IS the start and the goal is still false —
        // "a walkable path to a cell nothing can stand on" has one answer.
        expect(run(['.#.'], { x: 1, y: 0 }, { x: 1, y: 0 })).toBe(false);
    });

    it('⛔ an OFF-GRID endpoint refuses BY NAME — a caller defect is not a sealed room', () => {
        const g = grid(['...', '...']);
        expect(() => connected(g.width, g.height, g.isWalkable, { x: -1, y: 0 }, { x: 2, y: 1 }))
            .toThrow(GridFloodError);
        expect(() => connected(g.width, g.height, g.isWalkable, { x: 0, y: 0 }, { x: 3, y: 1 }))
            .toThrow(/off the 3x2 grid/);
        expect(() => connected(g.width, g.height, g.isWalkable, { x: 0.5, y: 0 }, { x: 2, y: 1 }))
            .toThrow(/integer cells/);
    });

    it('⛔ refuses a missing predicate and a non-positive size BY NAME', () => {
        expect(() => connected(3, 3, null, { x: 0, y: 0 }, { x: 1, y: 1 }))
            .toThrow(/isWalkable\(x, y\)` must be a function/);
        expect(() => connected(0, 3, () => true, { x: 0, y: 0 }, { x: 0, y: 0 }))
            .toThrow(/width must be a positive integer/);
    });

    it('⛓ every cell is asked at most once — the flood does not re-walk', () => {
        const asked = new Map();
        const g = grid([
            '.....',
            '.....',
            '.....',
        ]);
        const counting = (x, y) => {
            const k = `${x},${y}`;
            asked.set(k, (asked.get(k) ?? 0) + 1);
            return g.isWalkable(x, y);
        };
        expect(connected(g.width, g.height, counting, { x: 0, y: 0 }, { x: 4, y: 2 })).toBe(true);
        for (const [cell, n] of asked) expect(`${cell} asked ${n}x`).toBe(`${cell} asked 1x`);
    });
});

/**
 * ⛓ PROCGEN ELEMENTS arc 1, slice 2. The same ASCII literals, because
 * `reachableFrom` is the same traversal answering a SET question — and the
 * cross-check below drives the two against each other rather than trusting the
 * docblock that says they agree.
 */
describe('procgenCore/gridFlood — reachableFrom()', () => {
    const reach = (rows, from) => {
        const g = grid(rows);
        return reachableFrom(g.width, g.height, g.isWalkable, from);
    };

    it('an open room reaches every cell, and the START is IN the set', () => {
        const set = reach(['...', '...'], { x: 0, y: 0 });
        expect([...set].sort()).toEqual(
            ['0,0', '0,1', '1,0', '1,1', '2,0', '2,1'].sort(),
        );
    });

    it('⛓ a WALLED-OFF half is absent — the set is the answer, not a boolean', () => {
        const set = reach([
            '..#..',
            '..#..',
            '..#..',
        ], { x: 0, y: 0 });
        expect([...set].sort()).toEqual(['0,0', '0,1', '0,2', '1,0', '1,1', '1,2'].sort());
        expect(set.has('2,0')).toBe(false);
        expect(set.has('3,0')).toBe(false);
    });

    it('⚠ a NON-WALKABLE start answers an EMPTY set rather than throwing', () => {
        expect(reach(['#..', '...'], { x: 0, y: 0 }).size).toBe(0);
    });

    it('⛓ AGREES WITH `connected` ON EVERY CELL OF A HAND-DRAWN ROOM — the two '
        + 'spellings are checked against each other, not against their docblocks', () => {
        const rows = [
            '.#..#',
            '.#..#',
            '.#..#',
            '.####',
            '.....',
        ];
        const g = grid(rows);
        const from = { x: 0, y: 0 };
        const set = reachableFrom(g.width, g.height, g.isWalkable, from);
        for (let y = 0; y < g.height; y += 1) {
            for (let x = 0; x < g.width; x += 1) {
                const bothSay = connected(g.width, g.height, g.isWalkable, from, { x, y });
                expect(`(${x},${y}) ${set.has(`${x},${y}`)}`).toBe(`(${x},${y}) ${bothSay}`);
            }
        }
        // ⛓ AND THE ROOM REALLY DOES HAVE AN UNREACHABLE POCKET, or the row
        // above would agree by both arms saying "true" everywhere — the first
        // draft of this grid had none, and this line is what caught it.
        expect(set.has('3,1')).toBe(false);
        expect(set.has('0,4')).toBe(true);
    });

    it('⛔ an off-grid start is a CALLER defect and refuses by name', () => {
        expect(() => reachableFrom(3, 3, () => true, { x: 5, y: 0 }))
            .toThrow(GridFloodError);
        expect(() => reachableFrom(3, 3, () => true, { x: 5, y: 0 }))
            .toThrow(/off the 3x3 grid/);
    });

    it('⛓ every cell is asked at most once', () => {
        const asked = new Map();
        const g = grid(['.....', '..#..', '.....']);
        const counting = (x, y) => {
            const k = `${x},${y}`;
            asked.set(k, (asked.get(k) ?? 0) + 1);
            return g.isWalkable(x, y);
        };
        reachableFrom(g.width, g.height, counting, { x: 0, y: 0 });
        for (const [cell, n] of asked) expect(`${cell} asked ${n}x`).toBe(`${cell} asked 1x`);
    });
});

describe('shortestPath — ONE path, not just its existence (arc 3 slice 1)', () => {
    /**
     * ⛔ AN INDEPENDENT INSTRUMENT, not the function under test. A separate
     * breadth-first DISTANCE map, written here and nowhere else, is what grades
     * the returned path's LENGTH — asserting `path.length` against
     * `shortestPath`'s own arithmetic would grade it against itself
     * (`feedback_fixed_point_is_not_correctness`).
     */
    const distanceTo = (width, height, walk, from) => {
        const dist = new Map([[`${from.x},${from.y}`, 0]]);
        let frontier = [from];
        while (frontier.length) {
            const next = [];
            for (const c of frontier) {
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const nx = c.x + dx;
                    const ny = c.y + dy;
                    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                    if (!walk(nx, ny) || dist.has(`${nx},${ny}`)) continue;
                    dist.set(`${nx},${ny}`, dist.get(`${c.x},${c.y}`) + 1);
                    next.push({ x: nx, y: ny });
                }
            }
            frontier = next;
        }
        return dist;
    };

    /**
     *        0 1 2 3 4
     *    0   . . . . .
     *    1   . # # # .
     *    2   . . . . .
     */
    const WALL = new Set(['1,1', '2,1', '3,1']);
    const walk = (x, y) => !WALL.has(`${x},${y}`);

    it('returns a CONTIGUOUS, walkable path whose length the independent BFS agrees with',
        () => {
            const path = shortestPath(5, 3, walk, { x: 0, y: 0 }, { x: 4, y: 2 });
            expect(path[0]).toEqual({ x: 0, y: 0 });
            expect(path[path.length - 1]).toEqual({ x: 4, y: 2 });
            for (const c of path) expect(walk(c.x, c.y), `${c.x},${c.y}`).toBe(true);
            for (let i = 1; i < path.length; i += 1) {
                expect(Math.abs(path[i].x - path[i - 1].x)
                    + Math.abs(path[i].y - path[i - 1].y)).toBe(1);
            }
            const dist = distanceTo(5, 3, walk, { x: 0, y: 0 });
            expect(path.length - 1).toBe(dist.get('4,2'));
        });

    it('⛓ the path is CANONICAL — the same grid gives the same cells every time', () => {
        const a = shortestPath(5, 3, walk, { x: 0, y: 0 }, { x: 4, y: 2 });
        const b = shortestPath(5, 3, walk, { x: 0, y: 0 }, { x: 4, y: 2 });
        expect(a).toEqual(b);
        // ⛔ and it is the list the site vocabulary's `main` is defined as, so
        // the literal is stated rather than left to the reader.
        expect(a).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 },
            { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }]);
    });

    it('agrees with `connected` about EXISTENCE, in both directions', () => {
        const sealed = (x, y) => x !== 2;
        for (const [w, from, to] of [
            [walk, { x: 0, y: 0 }, { x: 4, y: 2 }],
            [sealed, { x: 0, y: 0 }, { x: 4, y: 2 }],
            [walk, { x: 1, y: 1 }, { x: 0, y: 0 }],
        ]) {
            expect(shortestPath(5, 3, w, from, to) !== null)
                .toBe(connected(5, 3, w, from, to));
        }
    });

    it('⛔ `null`, never `[]`, when there is no path — and a single cell when from === to',
        () => {
            expect(shortestPath(5, 3, (x) => x !== 2, { x: 0, y: 0 }, { x: 4, y: 2 })).toBeNull();
            expect(shortestPath(5, 3, walk, { x: 2, y: 2 }, { x: 2, y: 2 }))
                .toEqual([{ x: 2, y: 2 }]);
        });

    it('a non-walkable endpoint answers `null` rather than throwing', () => {
        expect(shortestPath(5, 3, walk, { x: 0, y: 0 }, { x: 2, y: 1 })).toBeNull();
        expect(shortestPath(5, 3, walk, { x: 2, y: 1 }, { x: 0, y: 0 })).toBeNull();
    });

    it('refuses an off-grid endpoint and a `{tx,ty}` cell BY NAME', () => {
        expect(() => shortestPath(5, 3, walk, { x: 0, y: 0 }, { x: 9, y: 0 }))
            .toThrow(/off the 5x3 grid/);
        expect(() => shortestPath(5, 3, walk, { tx: 0, ty: 0 }, { x: 1, y: 0 }))
            .toThrow(/must be `\{x, y\}`/);
    });

    it('⛔ calls the predicate at most ONCE per cell — `connected`\'s own property', () => {
        const calls = new Map();
        const counted = (x, y) => {
            calls.set(`${x},${y}`, (calls.get(`${x},${y}`) ?? 0) + 1);
            return walk(x, y);
        };
        shortestPath(5, 3, counted, { x: 0, y: 0 }, { x: 4, y: 2 });
        for (const [k, n] of calls) expect(n, k).toBe(1);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE SHORTCUT LAW — arc 5, slice 5 (D1)
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * The law's own argument shape, built from an ASCII room. ⛔ `walkableFor` is
 * the caller's predicate WITH a key set forced solid — the SAME shape
 * `doorLawRefusal` takes, which is what lets an element ask either law without
 * building the room twice.
 */
const lawOn = (rows, { door, clearer = [], start, goal }) => {
    const g = grid(rows);
    const keys = new Set(door.map((c) => `${c.x},${c.y}`));
    const lengths = {};
    const why = shortcutLawRefusal({
        width: g.width,
        height: g.height,
        walkableFor: (walled) => (x, y) => {
            if (walled && walled.has(`${x},${y}`)) return false;
            return g.isWalkable(x, y);
        },
        start,
        goal,
        doorKeys: keys,
        clearerKeys: clearer.map((c) => `${c.x},${c.y}`),
        name: 'the test\'s shortcut',
        lengths,
    });
    return { why, lengths };
};

/**
 * ⛓ THE CANONICAL SHORTCUT ROOM. A 7x5 loop: the top row is the SHORT arc, the
 * bottom three rows are the LONG one. `S` is (0,0), `G` is (6,0), and the
 * shortcut cell is (3,0) — walling it forces the walk down and around.
 *
 *      S..*..G      row 0 — the short arc, `*` = the shortcut cell
 *      #.###.#      row 1
 *      #.....#      row 2 — the long arc
 *      #######      row 3
 */
const LOOP = [
    '.......',
    '#.###.#',
    '#.....#',
    '#######',
];
const S = { x: 0, y: 0 };
const G = { x: 6, y: 0 };

describe('shortcutLawRefusal — the door law\'s clause 1, INVERTED', () => {
    it('⛓⛓⛓ ACCEPTS a real shortcut, and reports what it saves', () => {
        const { why, lengths } = lawOn(LOOP, { door: [{ x: 3, y: 0 }], start: S, goal: G });
        expect(why).toBeNull();
        // 6 steps along the top; the detour is down, across and back up.
        expect(lengths.open).toBe(6);
        expect(lengths.walled).toBe(10);
        expect(lengths.walled).toBeGreaterThan(lengths.open);
    });

    /**
     * ⛔⛔ **THE MUTANT (a) ROW.** Drop the "still connected" clause and a
     * shortcut that IS a cut ships. This is the room where that happens: a
     * plain corridor, whose one cell walled leaves the goal unreachable. The
     * law must refuse it BY NAME and hand the caller to the DOOR law.
     */
    it('⛔ a CUT is refused by name — `the-shortcut-is-a-cut`', () => {
        const { why } = lawOn(['.....'], { door: [{ x: 2, y: 0 }], start: { x: 0, y: 0 },
            goal: { x: 4, y: 0 } });
        expect(why).toMatch(/IS A CUT/);
        expect(why).toMatch(/doorLawRefusal/);
        expect(why).toMatch(/grades STRONG, never SHORTENS/);
    });

    /**
     * ⛓⛓ A cell OFF every shortest route: the room stays connected AND the walk
     * does not get longer, so the lock would be decoration with a key in front
     * of it and the differential would grade the item INERT.
     */
    it('⛔ a cell that changes no route is refused — `the-shortcut-does-not-shorten`', () => {
        const { why } = lawOn([
            '.....',
            '.....',
        ], { door: [{ x: 2, y: 1 }], start: { x: 0, y: 0 }, goal: { x: 4, y: 0 } });
        expect(why).toMatch(/DOES NOT SHORTEN/);
        expect(why).toMatch(/4 step\(s\) with those cell\(s\) open and 4 with them walled/);
    });

    /**
     * ⛓ AND THE BOUNDARY IS **STRICT**. A cell whose walling leaves the walk
     * exactly as long is NOT a shortcut, and the law says so at the boundary
     * rather than one step away from it.
     */
    it('⛔ EQUAL lengths are not a shortening — the comparison is strict', () => {
        /**
         * ⛓ THE CELL IS ON *A* SHORTEST PATH AND THE ROOM HOLDS ANOTHER OF THE
         * SAME LENGTH — the case a non-strict comparison would let through, and
         * the one a room with an obviously-longer detour cannot produce.
         *
         *      S.*        (1,0) is on a 3-step route to (2,1)…
         *      ..G        …and going down first is also 3.
         */
        const { why } = lawOn([
            '...',
            '...',
        ], { door: [{ x: 1, y: 0 }], start: { x: 0, y: 0 }, goal: { x: 2, y: 1 } });
        expect(why).toMatch(/DOES NOT SHORTEN/);
        expect(why).toMatch(/3 step\(s\) with those cell\(s\) open and 3 with them walled/);
    });

    it('⛔ terrain that seals the room is refused — the door law\'s own open half', () => {
        const { why } = lawOn([
            '..#..',
        ], { door: [{ x: 1, y: 0 }], start: { x: 0, y: 0 }, goal: { x: 4, y: 0 } });
        expect(why).toMatch(/TERRAIN SEALS the room/);
    });

    /**
     * ⛓⛓⛓ **THE START-SIDE CLAUSE IS NOT FREE HERE**, and this room is why: the
     * loop keeps the goal reachable with the shortcut walled (clause 1 passes)
     * and the OPENER sits in a nub whose only mouth is the shortcut cell
     * itself. The player would have to take the short way to earn the right to
     * take the short way.
     *
     *      ###o###   `o` (3,0) — a dead-end nub off the SHORT arc
     *      S..*..G   `*` (3,1) — the shortcut cell
     *      #.###.#
     *      #.....#   the LONG arc, which does not reach `o` at all
     *      #######
     */
    it('⛔ an opener BEHIND its own shortcut is refused by name', () => {
        const rows = [
            '###o###',
            '...*...',
            '#.###.#',
            '#.....#',
            '#######',
        ].map((r) => r.replace(/[o*]/g, '.'));
        const { why } = lawOn(rows, {
            door: [{ x: 3, y: 1 }],
            clearer: [{ x: 3, y: 0 }],
            start: { x: 0, y: 1 },
            goal: { x: 6, y: 1 },
        });
        expect(why).toMatch(/OPENER cell \(3,0\)/);
        expect(why).toMatch(/BEHIND the shortcut/);
    });

    it('⛓ the opener ON the start side passes the clause', () => {
        const { why } = lawOn(LOOP, {
            door: [{ x: 3, y: 0 }], clearer: [{ x: 1, y: 2 }], start: S, goal: G,
        });
        expect(why).toBeNull();
    });

    it('⛓ the `lengths` sink is filled ONLY on acceptance', () => {
        const refused = lawOn(['.....'], { door: [{ x: 2, y: 0 }], start: { x: 0, y: 0 },
            goal: { x: 4, y: 0 } });
        expect(refused.lengths.open).toBeUndefined();
        expect(refused.lengths.walled).toBeUndefined();
    });

    /**
     * ⛔ THE CLAUSE LIST IS NOT A CENSUS KEY (see its docblock) — the law
     * returns TEXT and each CALLER files the answer under its own refusal
     * name. This row pins the vocabulary and its ORDER, which is the order the
     * clauses are asked in and therefore which one a room meets first.
     */
    it('⛓ the four CLAUSES are declared in the order the law asks them', () => {
        expect(SHORTCUT_LAW_CLAUSES).toEqual([
            'seals-the-room', 'is-a-cut', 'does-not-shorten', 'opener-behind-the-door',
        ]);
    });
});
