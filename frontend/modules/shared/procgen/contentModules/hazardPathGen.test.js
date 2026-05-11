import { describe, it, expect } from 'vitest';
import {
    computeCycleLength,
    generateLinearPath,
    generateLoopPath,
    generateHazards,
    LINEAR_LENGTHS,
    LOOP_LENGTHS,
    HAZARD_SHAPE_LINEAR,
    HAZARD_SHAPE_LOOP,
    _internal,
} from './hazardPathGen.js';
import { TILE_FLOOR, TILE_WALL } from '../../../mazeRoom/mazeRoomEngine.js';
import { createRng } from '../../rng.js';

// ---------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------

function makeWorld(width, height, fill = TILE_FLOOR) {
    const tiles = new Int8Array(width * height);
    if (fill === TILE_WALL) tiles.fill(TILE_WALL);
    return { width, height, tiles };
}

function setWall(world, x, y) {
    world.tiles[y * world.width + x] = TILE_WALL;
}

function pathIsAdjacent(tiles) {
    for (let i = 1; i < tiles.length; i++) {
        const dx = Math.abs(tiles[i].x - tiles[i - 1].x);
        const dy = Math.abs(tiles[i].y - tiles[i - 1].y);
        if (dx + dy !== 1) return false;
    }
    return true;
}

function pathIsLoopAdjacent(tiles) {
    if (!pathIsAdjacent(tiles)) return false;
    // Last tile must be adjacent to the first (closes the loop).
    const dx = Math.abs(tiles[tiles.length - 1].x - tiles[0].x);
    const dy = Math.abs(tiles[tiles.length - 1].y - tiles[0].y);
    return dx + dy === 1;
}

function pathTilesUnique(tiles) {
    return new Set(tiles.map((t) => `${t.x},${t.y}`)).size === tiles.length;
}

// ---------------------------------------------------------------
// computeCycleLength
// ---------------------------------------------------------------

describe('computeCycleLength', () => {
    it('linear N → 2(N-1)', () => {
        expect(computeCycleLength('linear', 2)).toBe(2);
        expect(computeCycleLength('linear', 3)).toBe(4);
        expect(computeCycleLength('linear', 5)).toBe(8);
    });

    it('loop N → N', () => {
        expect(computeCycleLength('loop', 4)).toBe(4);
        expect(computeCycleLength('loop', 8)).toBe(8);
    });

    it('rejects invalid linear lengths (4, 6, 7, etc.)', () => {
        expect(() => computeCycleLength('linear', 4)).toThrow(/length must be 2\/3\/5/);
        expect(() => computeCycleLength('linear', 6)).toThrow();
        expect(() => computeCycleLength('linear', 7)).toThrow();
    });

    it('rejects invalid loop lengths', () => {
        expect(() => computeCycleLength('loop', 3)).toThrow(/length must be 4\/8/);
        expect(() => computeCycleLength('loop', 5)).toThrow();
        expect(() => computeCycleLength('loop', 6)).toThrow();
    });

    it('rejects unknown shapes', () => {
        expect(() => computeCycleLength('zigzag', 5)).toThrow(/unknown shape/);
    });

    it('exported length lists match', () => {
        expect(LINEAR_LENGTHS).toEqual([2, 3, 5]);
        expect(LOOP_LENGTHS).toEqual([4, 8]);
    });
});

// ---------------------------------------------------------------
// generateLinearPath
// ---------------------------------------------------------------

describe('generateLinearPath', () => {
    it('builds a 2-tile path on an open world', () => {
        const world = makeWorld(8, 6);
        const rng = createRng(1);
        const result = generateLinearPath(world, { length: 2 }, rng);
        expect(result).not.toBeNull();
        expect(result.shape).toBe(HAZARD_SHAPE_LINEAR);
        expect(result.length).toBe(2);
        expect(result.tiles).toHaveLength(2);
        expect(result.cycleLength).toBe(2);
        expect(pathIsAdjacent(result.tiles)).toBe(true);
        expect(pathTilesUnique(result.tiles)).toBe(true);
    });

    it('builds a 3-tile path on an open world', () => {
        const world = makeWorld(8, 6);
        const rng = createRng(2);
        const result = generateLinearPath(world, { length: 3 }, rng);
        expect(result.tiles).toHaveLength(3);
        expect(result.cycleLength).toBe(4);
        expect(pathIsAdjacent(result.tiles)).toBe(true);
        expect(pathTilesUnique(result.tiles)).toBe(true);
    });

    it('builds a 5-tile path on an open world', () => {
        const world = makeWorld(10, 10);
        const rng = createRng(3);
        const result = generateLinearPath(world, { length: 5 }, rng);
        expect(result.tiles).toHaveLength(5);
        expect(result.cycleLength).toBe(8);
        expect(pathIsAdjacent(result.tiles)).toBe(true);
        expect(pathTilesUnique(result.tiles)).toBe(true);
    });

    it('every tile is walkable when wallOverlapAllowed is off (default)', () => {
        const world = makeWorld(10, 10);
        // Add some walls
        setWall(world, 5, 5);
        setWall(world, 6, 5);
        const rng = createRng(4);
        const result = generateLinearPath(world, { length: 5 }, rng);
        for (const t of result.tiles) {
            expect(world.tiles[t.y * world.width + t.x]).toBe(TILE_FLOOR);
        }
    });

    it('returns null when no walkable seed exists', () => {
        const world = makeWorld(4, 4, TILE_WALL);
        const rng = createRng(5);
        expect(generateLinearPath(world, { length: 2 }, rng)).toBeNull();
    });

    it('returns null when the walkable island is too small', () => {
        // 1-tile island surrounded by walls: no 2-tile path possible.
        const world = makeWorld(5, 5, TILE_WALL);
        world.tiles[2 * 5 + 2] = TILE_FLOOR; // only (2,2) is floor
        const rng = createRng(6);
        const result = generateLinearPath(world, { length: 2 }, rng);
        expect(result).toBeNull();
    });

    it('respects reservedTiles', () => {
        const world = makeWorld(6, 1); // 6×1 corridor
        const reserved = new Set(['3,0']); // middle tile blocked
        const rng = createRng(7);
        // Only 3-tile segments are (0,0)-(1,0)-(2,0) or (4,0)-(5,0); the
        // latter is too short. Walk from (0,0) and verify it never hits
        // the reserved tile.
        for (let i = 0; i < 10; i++) {
            const r = generateLinearPath(world, {
                length: 2, reservedTiles: reserved,
            }, createRng(100 + i));
            if (r) {
                for (const t of r.tiles) {
                    expect(reserved.has(`${t.x},${t.y}`)).toBe(false);
                }
            }
        }
    });

    it('allows wall tiles when wallOverlapAllowed is true', () => {
        // 5×1 corridor of walls, except (0,0) is floor.
        const world = makeWorld(5, 1, TILE_WALL);
        world.tiles[0] = TILE_FLOOR;
        const rng = createRng(8);
        const result = generateLinearPath(
            world,
            { length: 3, wallOverlapAllowed: true },
            rng,
        );
        // Should succeed because walls are in-bounds + permitted.
        expect(result).not.toBeNull();
        expect(result.tiles).toHaveLength(3);
    });

    it('is deterministic for a fixed rng seed', () => {
        const world = makeWorld(8, 6);
        const a = generateLinearPath(world, { length: 5 }, createRng(42));
        const b = generateLinearPath(world, { length: 5 }, createRng(42));
        expect(a.tiles).toEqual(b.tiles);
    });

    it('different seeds give different paths (statistical)', () => {
        const world = makeWorld(10, 10);
        const seen = new Set();
        for (let i = 0; i < 20; i++) {
            const r = generateLinearPath(world, { length: 5 }, createRng(i));
            if (r) seen.add(JSON.stringify(r.tiles));
        }
        // Out of 20 different seeds we should observe more than one
        // unique path. (Even 2 is enough to prove non-degeneracy.)
        expect(seen.size).toBeGreaterThan(1);
    });

    it('throws on bad inputs', () => {
        const rng = createRng(1);
        expect(() => generateLinearPath(null, { length: 5 }, rng))
            .toThrow(/world must have/);
        expect(() => generateLinearPath(makeWorld(4, 4), { length: 4 }, rng))
            .toThrow(/length must be one of/);
        expect(() => generateLinearPath(makeWorld(4, 4), { length: 2 }, null))
            .toThrow(/rng required/);
    });
});

// ---------------------------------------------------------------
// generateLoopPath
// ---------------------------------------------------------------

describe('generateLoopPath', () => {
    it('builds a 4-tile loop (2×2) on an open world', () => {
        const world = makeWorld(6, 6);
        const rng = createRng(1);
        const result = generateLoopPath(world, { length: 4 }, rng);
        expect(result).not.toBeNull();
        expect(result.shape).toBe(HAZARD_SHAPE_LOOP);
        expect(result.length).toBe(4);
        expect(result.tiles).toHaveLength(4);
        expect(result.cycleLength).toBe(4);
        expect(pathTilesUnique(result.tiles)).toBe(true);
        expect(pathIsLoopAdjacent(result.tiles)).toBe(true);
    });

    it('builds an 8-tile loop on an open world', () => {
        const world = makeWorld(8, 8);
        const rng = createRng(2);
        const result = generateLoopPath(world, { length: 8 }, rng);
        expect(result.tiles).toHaveLength(8);
        expect(result.cycleLength).toBe(8);
        expect(pathTilesUnique(result.tiles)).toBe(true);
        expect(pathIsLoopAdjacent(result.tiles)).toBe(true);
    });

    it('returns null when no anchor fits', () => {
        // 1×1 world: no 2×2 anchor possible.
        const world = makeWorld(1, 1);
        const rng = createRng(3);
        expect(generateLoopPath(world, { length: 4 }, rng)).toBeNull();
    });

    it('respects reservedTiles', () => {
        const world = makeWorld(5, 5);
        // Reserve enough tiles that 2×2 anchor placement is severely
        // constrained — but still possible in a corner.
        const reserved = new Set();
        for (let x = 0; x < 5; x++) {
            for (let y = 0; y < 5; y++) {
                if (x > 1 || y > 1) reserved.add(`${x},${y}`);
            }
        }
        const rng = createRng(4);
        const result = generateLoopPath(world, {
            length: 4, reservedTiles: reserved, maxAttempts: 200,
        }, rng);
        // Only the (0,0) anchor for 2×2 fits.
        expect(result).not.toBeNull();
        expect(result.tiles).toEqual([
            { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
        ]);
    });

    it('rejects walls when wallOverlapAllowed is off', () => {
        const world = makeWorld(5, 5);
        // Make every tile a wall except a 2×2 in a corner.
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                if (x >= 2 || y >= 2) setWall(world, x, y);
            }
        }
        const rng = createRng(5);
        const result = generateLoopPath(world, {
            length: 4, maxAttempts: 200,
        }, rng);
        // Only the (0,0) 2×2 fits.
        expect(result).not.toBeNull();
        expect(result.tiles).toEqual([
            { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
        ]);
    });

    it('throws on bad inputs', () => {
        const rng = createRng(1);
        expect(() => generateLoopPath(null, { length: 4 }, rng))
            .toThrow(/world must have/);
        expect(() => generateLoopPath(makeWorld(4, 4), { length: 5 }, rng))
            .toThrow(/length must be one of/);
        expect(() => generateLoopPath(makeWorld(4, 4), { length: 4 }, null))
            .toThrow(/rng required/);
    });
});

// ---------------------------------------------------------------
// generateHazards
// ---------------------------------------------------------------

describe('generateHazards', () => {
    it('places the requested count when room is plentiful', () => {
        const world = makeWorld(20, 20);
        const rng = createRng(1);
        const result = generateHazards(world, { count: 5 }, rng);
        expect(result.hazards).toHaveLength(5);
        expect(result.stopReason).toBe('all_placed');
    });

    it('hazards do not overlap', () => {
        const world = makeWorld(15, 15);
        const rng = createRng(2);
        const result = generateHazards(world, { count: 8 }, rng);
        const allTiles = result.hazards.flatMap((h) => h.tiles);
        const keys = new Set(allTiles.map((t) => `${t.x},${t.y}`));
        expect(keys.size).toBe(allTiles.length); // no duplicates
    });

    it('stops early with consecutive_fails when room runs out', () => {
        // 3×1 corridor; only a couple of 2-tile linear paths fit, no
        // loops at all. Asking for 50 hazards triggers the fail-budget.
        const world = makeWorld(3, 1);
        const rng = createRng(3);
        const result = generateHazards(world, {
            count: 50,
            maxConsecutiveFails: 5,
            shapeMix: [{ shape: 'linear', length: 2 }],
        }, rng);
        expect(result.stopReason).toBe('consecutive_fails');
        expect(result.hazards.length).toBeLessThan(50);
    });

    it('returns no_request stopReason when count is 0', () => {
        const world = makeWorld(5, 5);
        const rng = createRng(4);
        const result = generateHazards(world, { count: 0 }, rng);
        expect(result.hazards).toEqual([]);
        expect(result.stopReason).toBe('no_request');
    });

    it('honors shapeMix (linear-only)', () => {
        const world = makeWorld(15, 15);
        const rng = createRng(5);
        const result = generateHazards(world, {
            count: 5,
            shapeMix: [
                { shape: 'linear', length: 5 },
                { shape: 'linear', length: 3 },
            ],
        }, rng);
        expect(result.hazards).toHaveLength(5);
        for (const h of result.hazards) {
            expect(h.shape).toBe(HAZARD_SHAPE_LINEAR);
        }
    });

    it('honors shapeMix (loop-only)', () => {
        const world = makeWorld(15, 15);
        const rng = createRng(6);
        const result = generateHazards(world, {
            count: 3,
            shapeMix: [{ shape: 'loop', length: 4 }],
        }, rng);
        expect(result.hazards).toHaveLength(3);
        for (const h of result.hazards) {
            expect(h.shape).toBe(HAZARD_SHAPE_LOOP);
            expect(h.length).toBe(4);
        }
    });

    it('is deterministic for fixed rng seed + opts', () => {
        const world = makeWorld(10, 10);
        const a = generateHazards(world, { count: 4 }, createRng(99));
        const b = generateHazards(world, { count: 4 }, createRng(99));
        expect(a).toEqual(b);
    });
});

// ---------------------------------------------------------------
// _internal helpers
// ---------------------------------------------------------------

describe('_internal.isHazardTile', () => {
    it('rejects out-of-bounds tiles', () => {
        const world = makeWorld(3, 3);
        expect(_internal.isHazardTile(world, -1, 0, {}, null)).toBe(false);
        expect(_internal.isHazardTile(world, 0, -1, {}, null)).toBe(false);
        expect(_internal.isHazardTile(world, 3, 0, {}, null)).toBe(false);
        expect(_internal.isHazardTile(world, 0, 3, {}, null)).toBe(false);
    });

    it('rejects walls when wallOverlapAllowed is off', () => {
        const world = makeWorld(3, 3);
        setWall(world, 1, 1);
        expect(_internal.isHazardTile(world, 1, 1, {}, null)).toBe(false);
    });

    it('accepts walls when wallOverlapAllowed is on', () => {
        const world = makeWorld(3, 3);
        setWall(world, 1, 1);
        expect(_internal.isHazardTile(world, 1, 1, {
            wallOverlapAllowed: true,
        }, null)).toBe(true);
    });

    it('rejects already-visited tiles', () => {
        const world = makeWorld(3, 3);
        const visited = new Set(['1,1']);
        expect(_internal.isHazardTile(world, 1, 1, {}, visited)).toBe(false);
    });

    it('rejects reserved tiles', () => {
        const world = makeWorld(3, 3);
        const reserved = new Set(['1,1']);
        expect(_internal.isHazardTile(world, 1, 1, {
            reservedTiles: reserved,
        }, null)).toBe(false);
    });
});
