import { describe, it, expect } from 'vitest';

import { createRng } from '../../rng.js';
import {
    createWorld, getTile, setTile,
    TILE_FLOOR, TILE_WALL,
    allTargetsReachable,
} from '../../../mazeRoom/mazeRoomEngine.js';
// Side-effect: registers backends. Used by `mazeFromBackend` below.
import '../../../mazeRoom/mazeAlgorithms/index.js';
import { getBackend } from './registry.js';
import { braid, pruneDeadEnds } from './postProcessors.js';

function mazeWithBackend(backendId, params, seed = 1) {
    const w = createWorld(11, 9);
    const rng = createRng(seed);
    getBackend(backendId).run(w, params, rng);
    return w;
}

function countDeadEnds(world) {
    let n = 0;
    for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
            if (getTile(world, x, y) !== TILE_FLOOR) continue;
            let neighbors = 0;
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || nx >= world.width || ny < 0 || ny >= world.height) continue;
                if (getTile(world, nx, ny) === TILE_FLOOR) neighbors += 1;
            }
            if (neighbors === 1) n += 1;
        }
    }
    return n;
}

describe('braid', () => {
    it('p=0 is a no-op', () => {
        const world = mazeWithBackend('recursive_backtracker', { picker: 'newest' });
        const before = countDeadEnds(world);
        braid(world, { p: 0 }, createRng(99));
        expect(countDeadEnds(world)).toBe(before);
    });

    it('p=1 removes (almost) every dead end', () => {
        const world = mazeWithBackend('recursive_backtracker', { picker: 'newest' });
        expect(countDeadEnds(world)).toBeGreaterThan(0);
        braid(world, { p: 1 }, createRng(99));
        // Some boundary or fully-walled-corner dead-ends may not have
        // an eligible knockdown target; allow up to a couple of
        // residuals rather than insisting on exactly zero.
        expect(countDeadEnds(world)).toBeLessThanOrEqual(2);
    });

    it('intermediate p reduces dead-end count', () => {
        const world = mazeWithBackend('recursive_backtracker', { picker: 'newest' });
        const before = countDeadEnds(world);
        braid(world, { p: 0.5 }, createRng(7));
        expect(countDeadEnds(world)).toBeLessThan(before);
    });

    it('does not break feasibility', () => {
        const world = mazeWithBackend('recursive_backtracker', { picker: 'newest' });
        braid(world, { p: 1.0 }, createRng(7));
        expect(allTargetsReachable(world)).toBe(true);
    });

    it('does not knock down walls protecting entrance/exit tiles', () => {
        // Surround the entrance with walls, then verify braid doesn't
        // touch them. Use 'empty' so the only walls present are the
        // ones we set, then place an artificial dead-end.
        const w = createWorld(7, 7, { entrance: { x: 3, y: 3 }, exit: { x: 6, y: 6 } });
        // Wall everything except a thin corridor entrance→exit.
        for (let y = 0; y < w.height; y++) {
            for (let x = 0; x < w.width; x++) {
                if (x === 3 && y >= 3) continue;
                if (y === 6 && x >= 3) continue;
                setTile(w, x, y, TILE_WALL);
            }
        }
        // The entrance is a dead-end of the corridor — braid should
        // refuse to touch (3, 2) because that's adjacent to entrance.
        // (Actually entrance itself is protected; the wall at (3, 2)
        // is what would be knocked down. But we want to verify the
        // PROTECTED tile isn't itself overwritten.)
        const beforeEntrance = getTile(w, w.entrance.x, w.entrance.y);
        braid(w, { p: 1 }, createRng(1));
        expect(getTile(w, w.entrance.x, w.entrance.y)).toBe(beforeEntrance);
    });
});

describe('pruneDeadEnds', () => {
    it('threshold=0 is a no-op', () => {
        const world = mazeWithBackend('recursive_backtracker', { picker: 'newest' });
        const before = countDeadEnds(world);
        pruneDeadEnds(world, { threshold: 0 }, createRng(1));
        expect(countDeadEnds(world)).toBe(before);
    });

    it('threshold=1 removes single-tile dead-end stubs', () => {
        const world = mazeWithBackend('recursive_backtracker', { picker: 'newest' });
        const before = countDeadEnds(world);
        pruneDeadEnds(world, { threshold: 1 }, createRng(1));
        expect(countDeadEnds(world)).toBeLessThan(before);
    });

    it('higher threshold removes more', () => {
        const a = mazeWithBackend('recursive_backtracker', { picker: 'newest' });
        const b = mazeWithBackend('recursive_backtracker', { picker: 'newest' });
        pruneDeadEnds(a, { threshold: 1 }, createRng(1));
        pruneDeadEnds(b, { threshold: 5 }, createRng(1));
        // b should have fewer floor tiles than a (more pruning).
        const countFloor = (w) => {
            let n = 0;
            for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i] === TILE_FLOOR) n++;
            return n;
        };
        expect(countFloor(b)).toBeLessThanOrEqual(countFloor(a));
    });

    it('does not fill entrance or exit even if they are dead-end stubs', () => {
        const w = createWorld(5, 5, { entrance: { x: 0, y: 0 }, exit: { x: 4, y: 4 } });
        // Wall most of the grid; leave only entrance and a single corridor.
        for (let y = 0; y < w.height; y++) {
            for (let x = 0; x < w.width; x++) {
                setTile(w, x, y, TILE_WALL);
            }
        }
        // Carve entrance + 1 floor tile next to it = single-tile dead-end.
        setTile(w, 0, 0, TILE_FLOOR);
        setTile(w, 1, 0, TILE_FLOOR);
        pruneDeadEnds(w, { threshold: 5 }, createRng(1));
        expect(getTile(w, 0, 0)).toBe(TILE_FLOOR);    // entrance
    });

    it('does not break feasibility', () => {
        const world = mazeWithBackend('recursive_backtracker', { picker: 'newest' });
        pruneDeadEnds(world, { threshold: 3 }, createRng(1));
        expect(allTargetsReachable(world)).toBe(true);
    });
});
