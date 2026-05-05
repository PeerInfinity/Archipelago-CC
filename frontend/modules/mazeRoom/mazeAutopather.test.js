import { describe, it, expect } from 'vitest';
import { findPath, bestPathKey, stepsToInputs } from './mazeAutopather.js';

// Minimal world fixture: tiles array of 0 (floor) / 1 (wall). Caller
// supplies entrance and exits.
function makeWorld({ width, height, tiles = null, entrance = { x: 0, y: 0 }, exits = [], itemLocations = [] }) {
    const t = tiles ?? new Int8Array(width * height); // default: all floor
    const exitsMap = new Map();
    for (const e of exits) {
        exitsMap.set(e.exit_id, {
            exit_id: e.exit_id, x: e.x, y: e.y, side: e.side ?? null,
        });
    }
    const itemLocationNames = new Map();
    for (const loc of itemLocations) {
        itemLocationNames.set(`${loc.x},${loc.y}`, loc.name);
    }
    return {
        width, height, tiles: t,
        entrance: { x: entrance.x, y: entrance.y },
        exits: exitsMap,
        itemLocationNames,
    };
}

describe('mazeAutopather — findPath', () => {
    describe('tile target', () => {
        it('returns trivial path when from === to', () => {
            const w = makeWorld({ width: 3, height: 3 });
            const r = findPath(w, { x: 1, y: 1 }, { kind: 'tile', x: 1, y: 1 });
            expect(r).toEqual({ steps: [{ x: 1, y: 1 }], length: 0 });
        });

        it('walks a straight line on an open grid', () => {
            const w = makeWorld({ width: 5, height: 1 });
            const r = findPath(w, { x: 0, y: 0 }, { kind: 'tile', x: 4, y: 0 });
            expect(r.length).toBe(4);
            expect(r.steps).toHaveLength(5);
            expect(r.steps[0]).toEqual({ x: 0, y: 0 });
            expect(r.steps[4]).toEqual({ x: 4, y: 0 });
        });

        it('routes around walls', () => {
            // 5x3 grid with vertical wall at x=2, y=1 and y=2; must go around via y=0
            const tiles = new Int8Array(15);
            tiles[5 + 2] = 1; // (2,1) wall
            tiles[10 + 2] = 1; // (2,2) wall
            const w = makeWorld({ width: 5, height: 3, tiles });
            const r = findPath(w, { x: 1, y: 1 }, { kind: 'tile', x: 3, y: 1 });
            expect(r).not.toBeNull();
            expect(r.length).toBe(4);
            // Path should go through (2, 0)
            expect(r.steps.some((s) => s.x === 2 && s.y === 0)).toBe(true);
        });

        it('returns null when target is unreachable', () => {
            const tiles = new Int8Array(9).fill(1);
            tiles[0] = 0; // (0,0) floor
            tiles[4] = 0; // (1,1) floor (isolated)
            const w = makeWorld({ width: 3, height: 3, tiles });
            const r = findPath(w, { x: 0, y: 0 }, { kind: 'tile', x: 1, y: 1 });
            expect(r).toBeNull();
        });

        it('returns null when from is on a wall tile', () => {
            const tiles = new Int8Array(9);
            tiles[4] = 1; // (1,1) wall
            const w = makeWorld({ width: 3, height: 3, tiles });
            const r = findPath(w, { x: 1, y: 1 }, { kind: 'tile', x: 0, y: 0 });
            expect(r).toBeNull();
        });
    });

    describe('exit target', () => {
        it('finds an exit by id', () => {
            const w = makeWorld({
                width: 5, height: 1,
                exits: [{ exit_id: 'east', x: 4, y: 0 }],
            });
            const r = findPath(w, { x: 0, y: 0 }, { kind: 'exit', exitId: 'east' });
            expect(r).not.toBeNull();
            expect(r.length).toBe(4);
            expect(r.steps.at(-1)).toEqual({ x: 4, y: 0 });
        });

        it('returns null for an unknown exit id', () => {
            const w = makeWorld({
                width: 5, height: 1,
                exits: [{ exit_id: 'east', x: 4, y: 0 }],
            });
            const r = findPath(w, { x: 0, y: 0 }, { kind: 'exit', exitId: 'nonexistent' });
            expect(r).toBeNull();
        });
    });

    describe('location target', () => {
        it('finds a location tile by name', () => {
            const w = makeWorld({
                width: 5, height: 1,
                itemLocations: [{ x: 3, y: 0, name: 'Slay Yorgle' }],
            });
            const r = findPath(w, { x: 0, y: 0 }, { kind: 'location', locationName: 'Slay Yorgle' });
            expect(r).not.toBeNull();
            expect(r.length).toBe(3);
            expect(r.steps.at(-1)).toEqual({ x: 3, y: 0 });
        });

        it('returns null when the location name is not in the world', () => {
            const w = makeWorld({
                width: 5, height: 1,
                itemLocations: [{ x: 3, y: 0, name: 'Slay Yorgle' }],
            });
            const r = findPath(w, { x: 0, y: 0 }, { kind: 'location', locationName: 'Other' });
            expect(r).toBeNull();
        });
    });

    describe('closestUnexplored target', () => {
        it('finds the nearest frontier tile', () => {
            // 5x1 grid; player at (0,0), seen tiles up to (2,0); frontier
            // is (2,0) since (3,0) is unseen.
            const w = makeWorld({ width: 5, height: 1 });
            const seenTiles = new Set(['0,0', '1,0', '2,0']);
            const r = findPath(
                w, { x: 0, y: 0 },
                { kind: 'closestUnexplored' },
                { seenTiles },
            );
            expect(r).not.toBeNull();
            expect(r.length).toBe(2);
            expect(r.steps.at(-1)).toEqual({ x: 2, y: 0 });
        });

        it('returns null when there are no frontier tiles', () => {
            // Whole grid is seen → no unseen neighbors anywhere.
            const w = makeWorld({ width: 3, height: 1 });
            const seenTiles = new Set(['0,0', '1,0', '2,0']);
            const r = findPath(
                w, { x: 0, y: 0 },
                { kind: 'closestUnexplored' },
                { seenTiles },
            );
            expect(r).toBeNull();
        });

        it('returns null when seenTiles is missing', () => {
            const w = makeWorld({ width: 3, height: 1 });
            const r = findPath(w, { x: 0, y: 0 }, { kind: 'closestUnexplored' });
            expect(r).toBeNull();
        });

        it('returns trivial path when starting on a frontier tile', () => {
            // Player at (1,0); seen = (0,0), (1,0); (2,0) unseen. So
            // (1,0) itself is a frontier tile.
            const w = makeWorld({ width: 3, height: 1 });
            const seenTiles = new Set(['0,0', '1,0']);
            const r = findPath(
                w, { x: 1, y: 0 },
                { kind: 'closestUnexplored' },
                { seenTiles },
            );
            expect(r).toEqual({ steps: [{ x: 1, y: 0 }], length: 0 });
        });

        it('does not pick a wall tile as a frontier', () => {
            // 3x1 with a wall at (1,0): the only walkable tiles are
            // (0,0) and (2,0), and they're disconnected.
            const tiles = new Int8Array(3);
            tiles[1] = 1;
            const w = makeWorld({ width: 3, height: 1, tiles });
            const seenTiles = new Set(['0,0']);
            const r = findPath(
                w, { x: 0, y: 0 },
                { kind: 'closestUnexplored' },
                { seenTiles },
            );
            // (0,0) is seen; its only neighbor is wall (1,0). Wall isn't
            // walkable so it doesn't count toward frontier — no frontier
            // tile reachable.
            expect(r).toBeNull();
        });
    });

    describe('bestPathKey', () => {
        it('composes exit-target keys', () => {
            expect(bestPathKey('Forest', 'south_entrance', { kind: 'exit', exitId: 'north_exit' }))
                .toBe('Forest|south_entrance|exit:north_exit');
        });

        it('composes location-target keys', () => {
            expect(bestPathKey('Forest', 'south_entrance', { kind: 'location', locationName: 'Slay Yorgle' }))
                .toBe('Forest|south_entrance|loc:Slay Yorgle');
        });

        it('uses "entrance" when fromExitId is null/undefined', () => {
            expect(bestPathKey('Forest', null, { kind: 'exit', exitId: 'e' }))
                .toBe('Forest|entrance|exit:e');
            expect(bestPathKey('Forest', undefined, { kind: 'exit', exitId: 'e' }))
                .toBe('Forest|entrance|exit:e');
        });

        it('returns null on missing fields', () => {
            expect(bestPathKey('', 'in', { kind: 'exit', exitId: 'e' })).toBeNull();
            expect(bestPathKey('R', 'in', null)).toBeNull();
            expect(bestPathKey('R', 'in', { kind: 'exit' })).toBeNull(); // no exitId
            expect(bestPathKey('R', 'in', { kind: 'location' })).toBeNull(); // no locationName
            expect(bestPathKey('R', 'in', { kind: 'tile', x: 1, y: 1 })).toBeNull(); // unsupported kind
        });
    });

    describe('inventory / obstacle awareness', () => {
        function withObstacle({ width = 5, height = 1, obstacleAt, obstacleId = 'door_red', obstacleLib = {} } = {}) {
            const w = makeWorld({ width, height });
            w.obstacles = new Map([[`${obstacleAt.x},${obstacleAt.y}`, obstacleId]]);
            w.obstacleLib = obstacleLib;
            return w;
        }

        it('routes through obstacle tiles when inventory is omitted (geometry-only mode)', () => {
            // Obstacle blocks the only path; without inventory awareness
            // we should still find a route (geometric fallback).
            const w = withObstacle({
                obstacleAt: { x: 2, y: 0 },
                obstacleId: 'door_red',
                obstacleLib: { door_red: { id: 'door_red', clear_set: [['key_red']] } },
            });
            const r = findPath(w, { x: 0, y: 0 }, { kind: 'tile', x: 4, y: 0 });
            expect(r).not.toBeNull();
            expect(r.length).toBe(4); // routes through (2,0)
        });

        it('blocks routing through unclearable obstacles when inventory is provided', () => {
            const w = withObstacle({
                obstacleAt: { x: 2, y: 0 },
                obstacleId: 'door_red',
                obstacleLib: { door_red: { id: 'door_red', clear_set: [['key_red']] } },
            });
            const r = findPath(
                w, { x: 0, y: 0 }, { kind: 'tile', x: 4, y: 0 },
                { inventory: new Set() }, // empty inventory
            );
            // 5x1 corridor with a locked door at (2,0) and no key —
            // unreachable.
            expect(r).toBeNull();
        });

        it('passes through clearable obstacles when the player has the key', () => {
            const w = withObstacle({
                obstacleAt: { x: 2, y: 0 },
                obstacleId: 'door_red',
                obstacleLib: { door_red: { id: 'door_red', clear_set: [['key_red']] } },
            });
            const r = findPath(
                w, { x: 0, y: 0 }, { kind: 'tile', x: 4, y: 0 },
                { inventory: new Set(['key_red']) },
            );
            expect(r).not.toBeNull();
            expect(r.length).toBe(4);
        });
    });

    describe('excludeOtherExits', () => {
        it('routes through arbitrary exits by default (geometry-only)', () => {
            // 5x1 with an exit at (2,0). Default behaviour (no exit
            // exclusion) lets the path pass through.
            const w = makeWorld({
                width: 5, height: 1,
                exits: [
                    { exit_id: 'mid', x: 2, y: 0 },
                    { exit_id: 'far', x: 4, y: 0 },
                ],
            });
            const r = findPath(w, { x: 0, y: 0 }, { kind: 'tile', x: 4, y: 0 });
            expect(r).not.toBeNull();
            expect(r.length).toBe(4);
        });

        it('treats off-route exits as walls when excludeOtherExits is set', () => {
            const w = makeWorld({
                width: 5, height: 1,
                exits: [
                    { exit_id: 'mid', x: 2, y: 0 }, // off-route exit blocks the corridor
                    { exit_id: 'far', x: 4, y: 0 },
                ],
            });
            const r = findPath(
                w, { x: 0, y: 0 }, { kind: 'tile', x: 4, y: 0 },
                { excludeOtherExits: true },
            );
            // 5x1 corridor with the off-route exit blocking → no path
            expect(r).toBeNull();
        });

        it('still allows the goal tile itself to be an exit when excludeOtherExits is on', () => {
            const w = makeWorld({
                width: 5, height: 1,
                exits: [{ exit_id: 'far', x: 4, y: 0 }],
            });
            const r = findPath(
                w, { x: 0, y: 0 }, { kind: 'exit', exitId: 'far' },
                { excludeOtherExits: true },
            );
            expect(r).not.toBeNull();
            expect(r.steps.at(-1)).toEqual({ x: 4, y: 0 });
        });
    });

    describe('stepsToInputs', () => {
        it('returns empty for a zero-or-one-step path', () => {
            expect(stepsToInputs([])).toEqual([]);
            expect(stepsToInputs([{ x: 0, y: 0 }])).toEqual([]);
        });

        it('encodes cardinal moves as N/S/E/W', () => {
            const steps = [
                { x: 0, y: 0 },
                { x: 1, y: 0 }, // E
                { x: 1, y: 1 }, // S
                { x: 0, y: 1 }, // W
                { x: 0, y: 0 }, // N
            ];
            expect(stepsToInputs(steps)).toEqual(['E', 'S', 'W', 'N']);
        });
    });

    describe('error / edge cases', () => {
        it('returns null on missing world', () => {
            expect(findPath(null, { x: 0, y: 0 }, { kind: 'tile', x: 1, y: 1 })).toBeNull();
        });
        it('returns null on missing from', () => {
            expect(findPath(makeWorld({ width: 3, height: 3 }), null, { kind: 'tile', x: 1, y: 1 })).toBeNull();
        });
        it('returns null on missing target', () => {
            expect(findPath(makeWorld({ width: 3, height: 3 }), { x: 0, y: 0 }, null)).toBeNull();
        });
        it('returns null on unknown target kind', () => {
            const w = makeWorld({ width: 3, height: 3 });
            expect(findPath(w, { x: 0, y: 0 }, { kind: 'made_up' })).toBeNull();
        });
    });
});
