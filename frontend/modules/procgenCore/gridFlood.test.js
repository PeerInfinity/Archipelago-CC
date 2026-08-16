/**
 * procgenCore/gridFlood.test — the ONE flood, driven on hand-written grids.
 *
 * CONSTRUCTIVE-MODE arc, slice 6. ⛔ The grids here are ASCII literals a reader
 * can check by eye, not generated ones: this is the file that says what
 * "connected" means for both bindings, and a grid the test itself computed
 * would test the flood against the flood.
 */

import { describe, expect, it } from 'vitest';
import { GridFloodError, connected } from './gridFlood.js';

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
