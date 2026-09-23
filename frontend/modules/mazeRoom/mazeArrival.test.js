/** mazeArrival (seedling-pipeline T2b, F1) — the three arms, in order. */
import { describe, expect, it } from 'vitest';

import { resolveMazeArrival } from './mazeArrival.js';

const world = (exits) => ({ exits: new Map(exits.map((e) => [e.exit_id, e])) });
const W = world([
    { exit_id: 'exit_0', x: 6, y: 5, targetRegion: 'region_1_1' },
    { exit_id: 'exit_1', x: 0, y: 4, targetRegion: 'region_0_0' },
]);

describe('resolveMazeArrival', () => {
    it('arm 1 — exit_id names an exit here: that exit, even when source_region points elsewhere', () => {
        expect(resolveMazeArrival(W, { exit_id: 'exit_0', source_region: 'region_0_0' }))
            .toEqual({ exitId: 'exit_0', x: 6, y: 5, by: 'exit_id' });
    });

    it('arm 2 — exit_id names nothing here: the exit whose targetRegion is source_region', () => {
        expect(resolveMazeArrival(W, { exit_id: 'exit_S', source_region: 'region_0_0' }))
            .toEqual({ exitId: 'exit_1', x: 0, y: 4, by: 'source_region' });
    });

    it('two exits back to the source → the first in the world\'s order', () => {
        const two = world([
            { exit_id: 'a', x: 1, y: 1, targetRegion: 'S' },
            { exit_id: 'b', x: 2, y: 2, targetRegion: 'S' },
        ]);
        expect(resolveMazeArrival(two, { exit_id: 'zz', source_region: 'S' }).exitId).toBe('a');
    });

    it('arm 3 — nothing matches (or no arrivedFrom): null, and the caller keeps the entrance', () => {
        expect(resolveMazeArrival(W, { exit_id: 'exit_S', source_region: 'nowhere' })).toBeNull();
        expect(resolveMazeArrival(W, { exit_id: 'exit_S' })).toBeNull();
        expect(resolveMazeArrival(W, null)).toBeNull();
        expect(resolveMazeArrival({}, { exit_id: 'x', source_region: 'y' })).toBeNull();
    });
});
