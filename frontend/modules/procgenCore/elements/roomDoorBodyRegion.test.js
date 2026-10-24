/**
 * procgenCore/elements/roomDoor — **`bodyRegion`, THE KILL GATE'S DEMAND SET**
 * (PROCGEN ELEMENTS arc 3, slice 4d, D3).
 *
 * ⛓ The cells are ASSERTED EXACTLY, on rooms small enough to write out, because
 * the whole value of a demand is that it names a set: a rule that returned "some
 * cells" would be honoured by pass 2 and checked by nobody.
 *
 * ⛔ THE ROOM DOUBLE IS THIS DIRECTORY'S OWN (`roomDoor.test.js`'s shape,
 * re-stated here rather than exported across test files) — `procgenCore` may not
 * import a substrate, so a hand-drawn floor set is the whole room.
 */

import { describe, expect, it } from 'vitest';

import { bodyRegion } from './roomDoor.js';
import { TILE_FLOOR, TILE_WALL } from '../../shared/procgen/mazeAlgorithms/gridTiles.js';

const k = (x, y) => `${x},${y}`;

/** The minimum a `bodyRegion` walk reads: bounds and `floorAt`. */
const roomOf = (floor, { width = 10, height = 10 } = {}) => {
    const set = new Set(floor.map(([x, y]) => k(x, y)));
    return { width, height, floorAt: (x, y) => set.has(k(x, y)) };
};

const sorted = (s) => [...s].sort();

describe('the body\'s region on a corridor with a pocket', () => {
    /**
     * The kill gate's own arrangement, hand-drawn:
     *
     *      0123456789
     *    1 #........#     the corridor, y = 1, x = 1..8
     *    2 ###o######     the POCKET at (3,2), one floor neighbour
     *
     * The DOOR is the cut cell (5,1). With it shut, the body at (3,2) can be in
     * the pocket and in x = 1..4 of the corridor — and NOT in 6..8.
     */
    const CORRIDOR = [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [3, 2]];

    it('⛓⛓ the REGION is the pocket plus the START SIDE of the cut, cell for cell', () => {
        const { region } = bodyRegion(roomOf(CORRIDOR), { x: 3, y: 2 },
            { walled: [{ x: 5, y: 1 }] });
        expect(sorted(region)).toEqual(['1,1', '2,1', '3,1', '3,2', '4,1']);
    });

    it('⛔ ...and WITHOUT the door shut it runs the whole corridor — the cut is load-bearing',
        () => {
            const { region } = bodyRegion(roomOf(CORRIDOR), { x: 3, y: 2 });
            expect(sorted(region)).toEqual(
                ['1,1', '2,1', '3,1', '3,2', '4,1', '5,1', '6,1', '7,1', '8,1']);
        });

    it('⛓ the BOUNDARY is the INTERIOR wall cells touching the region — never the ring', () => {
        const { boundary } = bodyRegion(roomOf(CORRIDOR), { x: 3, y: 2 },
            { walled: [{ x: 5, y: 1 }] });
        // (1,2) (2,2) (4,2) sit under the corridor; (3,3) under the pocket.
        // ⛔ The door cell (5,1) is NOT in it: `walled` cells are the element's
        // own and it may not demand what it writes.
        expect(sorted(boundary)).toEqual(['1,2', '2,2', '3,3', '4,2']);
    });

    it('⛓ `writes` are applied over the room — a wall the element GREW confines the body', () => {
        const open = [];
        for (let y = 1; y <= 3; y += 1) for (let x = 1; x <= 5; x += 1) open.push([x, y]);
        const bare = bodyRegion(roomOf(open), { x: 1, y: 1 });
        expect(bare.region.size).toBe(15);
        const writes = new Map([['3,1', TILE_WALL], ['3,2', TILE_WALL], ['3,3', TILE_WALL]]);
        const walled = bodyRegion(roomOf(open), { x: 1, y: 1 }, { writes });
        expect(sorted(walled.region)).toEqual(['1,1', '1,2', '1,3', '2,1', '2,2', '2,3']);
        /** ⛓ THE WHOLE RIM, not just the wall the element grew: (1,4) and (2,4)
         *  are interior cells the room left un-floored, and a CARVE there would
         *  open the region downward exactly as one at (3,y) would open it east. */
        expect(sorted(walled.boundary)).toEqual(['1,4', '2,4', '3,1', '3,2', '3,3']);
    });

    it('⛓ a `writes` entry that CARVES adds the cell to the region', () => {
        const two = [[1, 1], [2, 1]];
        const carved = bodyRegion(roomOf(two), { x: 1, y: 1 },
            { writes: new Map([['3,1', TILE_FLOOR]]) });
        expect(sorted(carved.region)).toEqual(['1,1', '2,1', '3,1']);
    });

    it('⛔ the BORDER RING is never region and never boundary — it is the room, not a cell '
        + 'pass 2 could carve', () => {
        const one = [[1, 1]];
        const { region, boundary } = bodyRegion(roomOf(one), { x: 1, y: 1 });
        expect(sorted(region)).toEqual(['1,1']);
        /**
         * ⛓ (1,2) and (2,1) ARE demanded — interior wall a carve could open.
         * (0,1) and (1,0) are the RING and are not: the ring is what makes the
         * room a room, `freeRefusal` refuses it to every template already, and a
         * demand on it would be a claim that can never fail.
         */
        expect(sorted(boundary)).toEqual(['1,2', '2,1']);
        expect(boundary.has('0,1')).toBe(false);
        expect(boundary.has('1,0')).toBe(false);
    });
});
