/**
 * `empty` backend — the trivial wall layout with no walls at all.
 * Useful for showcasing the topology layer (entrance, exits, items)
 * without any maze geometry getting in the way.
 *
 * One-shot: just leaves world.tiles as the all-floor grid that
 * createWorld already produced. Reports zero iterations.
 */

import { registerBackend } from '../../shared/procgen/mazeAlgorithms/registry.js';

export const emptyBackend = Object.freeze({
    id: 'empty',
    name: 'Empty',
    cellStep: 1,
    run(_world, _params, _rng) {
        return {
            iterations: 0,
            accepted: 0,
            rejectedFeasibility: 0,
            stalled: false,
        };
    },
});

registerBackend(emptyBackend);
