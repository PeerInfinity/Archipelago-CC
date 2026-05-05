import { describe, it, expect } from 'vitest';
import { createWorld, setEntrance } from './mazeRoomEngine.js';
import { bfsShortestPathLength, computeLongestShortestPath } from './mazeGeometry.js';

// Build a tiny open world so BFS has clear, predictable distances.
function makeOpenWorld(width, height, opts = {}) {
    return createWorld(width, height, {
        entrance: opts.entrance ?? { x: 0, y: 0 },
        exits: opts.exits ?? [],
        // Empty maze: every tile is floor. createWorld initializes all
        // tiles as walls; we'd need to override. Easier path: pass
        // exits and let createWorld place the default if exits empty.
        ...opts,
    });
}

// Minimal world fixture: tiles array as floor, no walls.
// We use a low-level build because createWorld wants a generator.
function plainWorld(width, height, entrance, exits = []) {
    const tiles = new Int8Array(width * height); // 0 = floor
    const exitsMap = new Map();
    exits.forEach((e, i) => {
        exitsMap.set(e.exit_id ?? `exit_${i}`, {
            exit_id: e.exit_id ?? `exit_${i}`,
            x: e.x,
            y: e.y,
            side: e.side ?? null,
        });
    });
    return {
        width, height, tiles,
        entrance: { x: entrance.x, y: entrance.y },
        exits: exitsMap,
    };
}

describe('mazeGeometry — bfsShortestPathLength', () => {
    it('returns 0 when from === to', () => {
        const w = plainWorld(3, 3, { x: 0, y: 0 });
        expect(bfsShortestPathLength(w, { x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
    });

    it('returns straight-line distance on an open grid', () => {
        const w = plainWorld(5, 1, { x: 0, y: 0 });
        expect(bfsShortestPathLength(w, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(4);
    });

    it('uses 4-connectivity (Manhattan distance on open grids)', () => {
        const w = plainWorld(5, 5, { x: 0, y: 0 });
        // Diagonal of (3,3): manhattan = 6
        expect(bfsShortestPathLength(w, { x: 0, y: 0 }, { x: 3, y: 3 })).toBe(6);
    });

    it('routes around walls', () => {
        // 5x3 world, mid column is wall except top
        const tiles = new Int8Array(15);
        // tile 1 = wall: rows are y, cols are x. Index = y*width + x
        // width=5, height=3
        tiles[5 + 2] = 1; // (2,1) wall
        tiles[10 + 2] = 1; // (2,2) wall
        const w = { width: 5, height: 3, tiles, entrance: { x: 0, y: 1 }, exits: new Map() };
        // From (1,1) to (3,1): direct path is blocked at (2,1) and (2,2),
        // must go up to (2,0).
        const len = bfsShortestPathLength(w, { x: 1, y: 1 }, { x: 3, y: 1 });
        expect(len).toBe(4);
    });

    it('returns null when unreachable', () => {
        // 3x3 with center wall isolating (2,1) from (0,1)
        const tiles = new Int8Array(9).fill(1); // all walls
        // open the two endpoints only
        tiles[3 + 0] = 0; // (0,1) floor
        tiles[3 + 2] = 0; // (2,1) floor
        const w = { width: 3, height: 3, tiles, entrance: { x: 0, y: 1 }, exits: new Map() };
        expect(bfsShortestPathLength(w, { x: 0, y: 1 }, { x: 2, y: 1 })).toBeNull();
    });

    it('returns null when from or to is on a wall tile', () => {
        const tiles = new Int8Array(9).fill(0);
        tiles[4] = 1; // (1,1) wall
        const w = { width: 3, height: 3, tiles, entrance: { x: 0, y: 0 }, exits: new Map() };
        expect(bfsShortestPathLength(w, { x: 1, y: 1 }, { x: 0, y: 0 })).toBeNull();
        expect(bfsShortestPathLength(w, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
    });
});

describe('mazeGeometry — computeLongestShortestPath', () => {
    it('returns 1 floor for a region with no exits', () => {
        const w = plainWorld(3, 3, { x: 0, y: 0 });
        expect(computeLongestShortestPath(w)).toBe(1);
    });

    it('single-exit case: longest = entrance-to-exit distance', () => {
        const w = plainWorld(5, 1, { x: 0, y: 0 }, [{ x: 4, y: 0 }]);
        expect(computeLongestShortestPath(w)).toBe(4);
    });

    it('multi-exit case: longest = max pairwise', () => {
        // entrance at (0,0). Exit A at (4,0). Exit B at (0,4).
        // pairs: (entrance, A) = 4; (entrance, B) = 4; (A, B) = 8.
        // longest = 8.
        const w = plainWorld(5, 5, { x: 0, y: 0 }, [
            { x: 4, y: 0, exit_id: 'A' },
            { x: 0, y: 4, exit_id: 'B' },
        ]);
        expect(computeLongestShortestPath(w)).toBe(8);
    });

    it('de-duplicates exits sharing the entrance tile', () => {
        // entrance = exit at (0,0); one extra exit at (3,0)
        const w = plainWorld(4, 1, { x: 0, y: 0 }, [
            { x: 0, y: 0, exit_id: 'samepos' },
            { x: 3, y: 0, exit_id: 'far' },
        ]);
        // After dedup: endpoints = [entrance, far] → distance 3
        expect(computeLongestShortestPath(w)).toBe(3);
    });

    it('ignores unreachable pairs (treats them as 0) but never returns 0', () => {
        // Two isolated patches of floor; entrance at (0,0), exit at (2,1)
        const tiles = new Int8Array(9).fill(1);
        tiles[0] = 0; // (0,0)
        tiles[3 + 2] = 0; // (2,1)
        const w = {
            width: 3, height: 3, tiles,
            entrance: { x: 0, y: 0 },
            exits: new Map([['e', { exit_id: 'e', x: 2, y: 1, side: null }]]),
        };
        // No path from entrance to exit → BFS returns null. Function
        // floors the result at 1.
        expect(computeLongestShortestPath(w)).toBe(1);
    });
});
