/** mazeArrival (seedling-pipeline T2b, F1) — the three arms, in order. */
import { describe, expect, it } from 'vitest';

import { resolveMazeArrival } from './mazeArrival.js';

const world = (exits) => ({ exits: new Map(exits.map((e) => [e.exit_id, e])) });
const W = world([
    { exit_id: 'exit_0', x: 6, y: 5, targetRegion: 'region_1_1' },
    { exit_id: 'exit_1', x: 0, y: 4, targetRegion: 'region_0_0' },
]);
/** The same room in a world that LINKS reverse exits (grid, sphere, top-down). */
const LINKED = world([
    { exit_id: 'exit_0', x: 6, y: 5, targetRegion: 'region_1_1', targetExitId: 'exit_3' },
    { exit_id: 'exit_1', x: 0, y: 4, targetRegion: 'region_0_0', targetExitId: 'exit_2' },
]);

describe('resolveMazeArrival', () => {
    /**
     * ⛓ T4 (finding 4): in a LINKED world `exit_id` is the source exit's
     * `targetExitId`, an authored answer — it wins over `source_region`.
     * (Until T4 this row ran on `W`, an unlinked world, where the same answer
     * was only a naming coincidence; see the T4 block below.)
     */
    it('arm 1 — in a linked world, exit_id names an exit here: that exit, even when source_region points elsewhere', () => {
        expect(resolveMazeArrival(LINKED, { exit_id: 'exit_0', source_region: 'region_0_0' }))
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

/**
 * ⛓ seedling-pipeline T4 (finding 4, trap 1392) — **IN A WORLD THAT LINKS NO
 * REVERSE EXITS, `exit_id` IS THE SOURCE EXIT'S OWN NAME.** procgenPlayer falls
 * back to it when the source exit carries no `targetExitId`, the shuffled
 * spiral's signature. If the target happens to have an exit of that name, arm 1
 * took it, whatever it leads to. On `seedling_spiral_room` the coincidence
 * lands right (all 4 maze↔maze pairs lead back), but that is the preset's luck.
 * An unlinked world prefers `source_region`; `exit_id` is the fallback there.
 */
describe('T4 — an unlinked world prefers the exit leading back over a name coincidence', () => {
    it('⛔ the source exit\'s own name exists here but leads ELSEWHERE → the exit back to the source', () => {
        // region A left through ITS `exit_0`; the target B also has an `exit_0`,
        // which leads to C. The exit leading back to A is B's `exit_1`.
        const B = world([
            { exit_id: 'exit_0', x: 3, y: 0, targetRegion: 'C', targetExitId: null },
            { exit_id: 'exit_1', x: 0, y: 2, targetRegion: 'A', targetExitId: null },
        ]);
        expect(resolveMazeArrival(B, { exit_id: 'exit_0', source_region: 'A' }))
            .toEqual({ exitId: 'exit_1', x: 0, y: 2, by: 'source_region' });
    });

    it('with no exit leading back, the coincidence is still the fallback (today\'s answer)', () => {
        expect(resolveMazeArrival(W, { exit_id: 'exit_0', source_region: 'nowhere' }))
            .toEqual({ exitId: 'exit_0', x: 6, y: 5, by: 'exit_id' });
    });

    it('with no source_region, arm 1 as before', () => {
        expect(resolveMazeArrival(W, { exit_id: 'exit_1' }))
            .toEqual({ exitId: 'exit_1', x: 0, y: 4, by: 'exit_id' });
    });

    it('ONE linked exit makes the world linked: exit_id wins', () => {
        const mixed = world([
            { exit_id: 'exit_0', x: 3, y: 0, targetRegion: 'C', targetExitId: 'exit_9' },
            { exit_id: 'exit_1', x: 0, y: 2, targetRegion: 'A', targetExitId: null },
        ]);
        expect(resolveMazeArrival(mixed, { exit_id: 'exit_0', source_region: 'A' }).by).toBe('exit_id');
    });
});

