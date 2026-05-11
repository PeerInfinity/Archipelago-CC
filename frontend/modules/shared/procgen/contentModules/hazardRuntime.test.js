import { describe, it, expect } from 'vitest';
import {
    currentTile,
    nextTile,
    facing,
    advancePhase,
    tickHazards,
    resetHazards,
    validateMove,
    hasAnyValidMove,
    getCurrentOccupancy,
} from './hazardRuntime.js';
import {
    HAZARD_SHAPE_LINEAR,
    HAZARD_SHAPE_LOOP,
} from './hazardPathGen.js';
import { TILE_FLOOR, TILE_WALL } from '../../../mazeRoom/mazeRoomEngine.js';

// ---------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------

function linear(tiles, phase = 0) {
    return {
        shape: HAZARD_SHAPE_LINEAR,
        length: tiles.length,
        tiles,
        cycleLength: 2 * (tiles.length - 1),
        phase,
    };
}

function loop(tiles, phase = 0) {
    return {
        shape: HAZARD_SHAPE_LOOP,
        length: tiles.length,
        tiles,
        cycleLength: tiles.length,
        phase,
    };
}

function makeWorld(width, height, fill = TILE_FLOOR) {
    const tiles = new Int8Array(width * height);
    if (fill === TILE_WALL) tiles.fill(TILE_WALL);
    return { width, height, tiles };
}

function setWall(world, x, y) {
    world.tiles[y * world.width + x] = TILE_WALL;
}

// Length-3 horizontal: [A=(0,0), B=(1,0), C=(2,0)]. Cycle 4.
const PATH_3 = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
// Length-5 horizontal: cycle 8.
const PATH_5 = [
    { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 },
    { x: 4, y: 1 }, { x: 5, y: 1 },
];
// 2×2 loop.
const LOOP_4 = [
    { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 },
];

// ---------------------------------------------------------------
// currentTile / nextTile / facing
// ---------------------------------------------------------------

describe('currentTile — linear path', () => {
    it('phases 0..N-1 traverse forward', () => {
        const h = linear(PATH_5);
        for (let p = 0; p < 5; p++) {
            h.phase = p;
            expect(currentTile(h)).toEqual(PATH_5[p]);
        }
    });

    it('phases N..2N-3 traverse backward (length 5 → phases 5,6,7 → tiles 3,2,1)', () => {
        const h = linear(PATH_5);
        h.phase = 5; expect(currentTile(h)).toEqual(PATH_5[3]);
        h.phase = 6; expect(currentTile(h)).toEqual(PATH_5[2]);
        h.phase = 7; expect(currentTile(h)).toEqual(PATH_5[1]);
    });

    it('length 3 (cycle 4): phases 0,1,2,3 → tiles A,B,C,B', () => {
        const h = linear(PATH_3);
        const expected = [PATH_3[0], PATH_3[1], PATH_3[2], PATH_3[1]];
        for (let p = 0; p < 4; p++) {
            h.phase = p;
            expect(currentTile(h)).toEqual(expected[p]);
        }
    });

    it('length 2 (cycle 2): phases 0,1 → tiles A,B', () => {
        const h = linear([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
        h.phase = 0; expect(currentTile(h)).toEqual({ x: 0, y: 0 });
        h.phase = 1; expect(currentTile(h)).toEqual({ x: 1, y: 0 });
    });

    it('endpoints get 1 turn each, midpoints 2 (length 5 visit counts)', () => {
        const counts = new Map();
        const h = linear(PATH_5);
        for (let p = 0; p < h.cycleLength; p++) {
            h.phase = p;
            const t = currentTile(h);
            const key = `${t.x},${t.y}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        // Tile 0 (endpoint): 1, tiles 1/2/3 (midpoints): 2 each, tile 4 (endpoint): 1
        expect(counts.get('1,1')).toBe(1); // PATH_5[0] = (1,1)
        expect(counts.get('2,1')).toBe(2);
        expect(counts.get('3,1')).toBe(2);
        expect(counts.get('4,1')).toBe(2);
        expect(counts.get('5,1')).toBe(1); // PATH_5[4] = (5,1)
    });
});

describe('currentTile — loop path', () => {
    it('phases 0..N-1 walk the loop in order', () => {
        const h = loop(LOOP_4);
        for (let p = 0; p < 4; p++) {
            h.phase = p;
            expect(currentTile(h)).toEqual(LOOP_4[p]);
        }
    });

    it('throws on unknown shape', () => {
        expect(() => currentTile({ shape: 'zigzag', tiles: [], cycleLength: 1, phase: 0 }))
            .toThrow(/unknown shape/);
    });
});

describe('nextTile', () => {
    it('linear length 5 forward phases face the next tile in sequence', () => {
        const h = linear(PATH_5);
        h.phase = 0; expect(nextTile(h)).toEqual(PATH_5[1]);
        h.phase = 1; expect(nextTile(h)).toEqual(PATH_5[2]);
        h.phase = 3; expect(nextTile(h)).toEqual(PATH_5[4]);
    });

    it('linear length 5 far endpoint (phase 4) faces back toward tile 3', () => {
        const h = linear(PATH_5, 4);
        expect(nextTile(h)).toEqual(PATH_5[3]);
    });

    it('linear length 5 backward phases face the next tile in reverse', () => {
        const h = linear(PATH_5);
        h.phase = 5; expect(nextTile(h)).toEqual(PATH_5[2]);
        h.phase = 6; expect(nextTile(h)).toEqual(PATH_5[1]);
        h.phase = 7; expect(nextTile(h)).toEqual(PATH_5[0]); // closes the cycle
    });

    it('loop nextTile wraps via modulo', () => {
        const h = loop(LOOP_4);
        h.phase = 0; expect(nextTile(h)).toEqual(LOOP_4[1]);
        h.phase = 3; expect(nextTile(h)).toEqual(LOOP_4[0]); // wrap
    });

    it('rejects malformed cycleLength', () => {
        expect(() => nextTile({ shape: 'loop', tiles: [], cycleLength: 0, phase: 0 }))
            .toThrow(/cycleLength must be a positive integer/);
    });
});

describe('facing', () => {
    it('returns N when hazard faces north', () => {
        // path: (1,2) → (1,1) (north). At phase 0, faces (1,1).
        const h = linear([{ x: 1, y: 2 }, { x: 1, y: 1 }], 0);
        expect(facing(h)).toBe('N');
    });

    it('returns S when hazard faces south', () => {
        const h = linear([{ x: 1, y: 1 }, { x: 1, y: 2 }], 0);
        expect(facing(h)).toBe('S');
    });

    it('returns E when hazard faces east', () => {
        const h = linear([{ x: 1, y: 1 }, { x: 2, y: 1 }], 0);
        expect(facing(h)).toBe('E');
    });

    it('returns W when hazard faces west', () => {
        const h = linear([{ x: 2, y: 1 }, { x: 1, y: 1 }], 0);
        expect(facing(h)).toBe('W');
    });

    it('flips on turnaround (linear length 3, phase 2 faces W)', () => {
        const h = linear(PATH_3, 2); // at C=(2,0), about to head back to B
        expect(facing(h)).toBe('W');
    });
});

// ---------------------------------------------------------------
// advancePhase / tickHazards / resetHazards
// ---------------------------------------------------------------

describe('advancePhase', () => {
    it('wraps via modulo cycleLength', () => {
        const h = linear(PATH_5);
        for (let i = 0; i < 8; i++) advancePhase(h);
        expect(h.phase).toBe(0);
    });

    it('treats missing phase as 0', () => {
        const h = linear(PATH_3);
        delete h.phase;
        advancePhase(h);
        expect(h.phase).toBe(1);
    });
});

describe('tickHazards / resetHazards', () => {
    it('tickHazards advances every hazard', () => {
        const a = linear(PATH_5, 0);
        const b = loop(LOOP_4, 1);
        tickHazards([a, b]);
        expect(a.phase).toBe(1);
        expect(b.phase).toBe(2);
    });

    it('resetHazards sets every phase to 0', () => {
        const a = linear(PATH_5, 6);
        const b = loop(LOOP_4, 3);
        resetHazards([a, b]);
        expect(a.phase).toBe(0);
        expect(b.phase).toBe(0);
    });

    it('tickHazards / resetHazards tolerate null / non-array input', () => {
        expect(() => tickHazards(null)).not.toThrow();
        expect(() => tickHazards(undefined)).not.toThrow();
        expect(() => resetHazards('nope')).not.toThrow();
    });
});

// ---------------------------------------------------------------
// validateMove
// ---------------------------------------------------------------

describe('validateMove — Rule 1 (can\'t enter the next tile)', () => {
    it('blocks moves into the hazard\'s next tile', () => {
        const h = linear(PATH_3, 0); // at A=(0,0), facing B=(1,0)
        // Move from (1,1) to (1,0) lands on B — blocked.
        expect(validateMove([h], { x: 1, y: 1 }, { x: 1, y: 0 })).toBe(false);
    });

    it('allows moves into the hazard\'s current tile from a different direction', () => {
        // hazard at A=(0,0), facing east toward B=(1,0). Player moves
        // from (0,1) — i.e., approaches A from the south, NOT from B.
        // Rule 2 doesn't fire (from ≠ next); Rule 1 doesn't fire
        // (to = A, not B). Move is allowed.
        const h = linear(PATH_3, 0);
        expect(validateMove([h], { x: 0, y: 1 }, { x: 0, y: 0 })).toBe(true);
    });

    it('blocks wait when the hazard is about to stomp the player\'s tile', () => {
        // Hazard at A, facing B. Player at B, waits. Rule 1 fires
        // (to = B = hazard\'s next tile).
        const h = linear(PATH_3, 0);
        const playerXY = { x: 1, y: 0 };
        expect(validateMove([h], playerXY, playerXY)).toBe(false);
    });
});

describe('validateMove — Rule 2 (can\'t enter from facing direction)', () => {
    it('blocks moves into the hazard\'s current tile from its facing direction', () => {
        // Hazard at A=(0,0), facing B=(1,0). Player at B, moves to A.
        // Rule 2 fires.
        const h = linear(PATH_3, 0);
        expect(validateMove([h], { x: 1, y: 0 }, { x: 0, y: 0 })).toBe(false);
    });

    it('Rule 2 specifically — same to-tile, but different from-direction is fine', () => {
        const h = linear(PATH_3, 0); // at A=(0,0), facing east
        // From south (0,1) → A: allowed (from ≠ next)
        expect(validateMove([h], { x: 0, y: 1 }, { x: 0, y: 0 })).toBe(true);
        // From north (0,-1) → A: allowed (off-grid is just a from)
        expect(validateMove([h], { x: 0, y: -1 }, { x: 0, y: 0 })).toBe(true);
    });
});

describe('validateMove — multiple hazards', () => {
    it('all hazards must permit the move', () => {
        const a = linear(PATH_3, 0);
        const b = linear([{ x: 3, y: 3 }, { x: 4, y: 3 }], 0);
        // Move to (1,0): a says no (Rule 1, that\'s a\'s next tile).
        expect(validateMove([a, b], { x: 1, y: 1 }, { x: 1, y: 0 })).toBe(false);
        // Move to (5, 5): neither hazard cares.
        expect(validateMove([a, b], { x: 5, y: 6 }, { x: 5, y: 5 })).toBe(true);
    });

    it('empty / null hazards array always permits the move', () => {
        expect(validateMove([], { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(true);
        expect(validateMove(null, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(true);
    });
});

// ---------------------------------------------------------------
// hasAnyValidMove
// ---------------------------------------------------------------

describe('hasAnyValidMove', () => {
    it('returns true on an open world without hazards', () => {
        const world = makeWorld(3, 3);
        expect(hasAnyValidMove(world, [], { x: 1, y: 1 })).toBe(true);
    });

    it('returns false when every direction is blocked by hazards + walls', () => {
        // 3x3 with walls on all 4 neighbors, and a hazard\'s next tile
        // is the player\'s current tile (wait also blocked).
        const world = makeWorld(3, 3, TILE_WALL);
        world.tiles[1 * 3 + 1] = TILE_FLOOR; // (1,1) only floor
        // Hazard at (0,1) facing (1,1). Wait blocked (Rule 1).
        // All 4 neighbors are walls. → no valid move.
        const h = linear([{ x: 0, y: 1 }, { x: 1, y: 1 }], 0);
        expect(hasAnyValidMove(world, [h], { x: 1, y: 1 })).toBe(false);
    });

    it('returns true when wait is valid even if all moves are blocked by walls', () => {
        const world = makeWorld(3, 3, TILE_WALL);
        world.tiles[1 * 3 + 1] = TILE_FLOOR;
        expect(hasAnyValidMove(world, [], { x: 1, y: 1 })).toBe(true);
    });

    it('considers walkability — walls are not valid candidates', () => {
        // 3x3 with walls except (1,1) and (2,1). Player at (1,1). Wait
        // is blocked by a hazard\'s Rule 1, only valid neighbor is (2,1).
        const world = makeWorld(3, 3, TILE_WALL);
        world.tiles[1 * 3 + 1] = TILE_FLOOR;
        world.tiles[1 * 3 + 2] = TILE_FLOOR;
        const h = linear([{ x: 0, y: 0 }, { x: 1, y: 1 }], 0); // diag illegal, but for the test we use it as faux next-tile=(1,1)
        // Wait blocked (Rule 1: hazard.next = (1,1) = player)
        // (1,0) = wall, skipped
        // (1,2) = wall, skipped
        // (0,1) = wall, skipped
        // (2,1) = floor, validateMove → not (1,1) and from(1,1) ≠ next(1,1)? Actually next is (1,1). And to is (2,1). So Rule 1 doesn\'t fire. Rule 2: to=(2,1), is it cur=(0,0)? No. Permitted.
        expect(hasAnyValidMove(world, [h], { x: 1, y: 1 })).toBe(true);
    });
});

// ---------------------------------------------------------------
// getCurrentOccupancy
// ---------------------------------------------------------------

describe('getCurrentOccupancy', () => {
    it('returns the set of tiles all hazards currently occupy', () => {
        const a = linear(PATH_5, 2); // currentTile = (3,1)
        const b = loop(LOOP_4, 1); // currentTile = (2,1)
        const occ = getCurrentOccupancy([a, b]);
        expect(occ).toEqual(new Set(['3,1', '2,1']));
    });

    it('returns an empty set for null / empty input', () => {
        expect(getCurrentOccupancy(null)).toEqual(new Set());
        expect(getCurrentOccupancy([])).toEqual(new Set());
    });

    it('collapses duplicate tiles into a single entry', () => {
        // Two hazards happen to be on the same tile at the same phase.
        const a = linear([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0);
        const b = loop([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }], 0);
        const occ = getCurrentOccupancy([a, b]);
        expect(occ.size).toBe(1);
        expect(occ.has('0,0')).toBe(true);
    });
});
