/**
 * `random_walls` backend — uniform random wall proposals with a
 * feasibility check. The original v1 wall generator from
 * `maze-room-generator.md`, refactored into a backend so it can be
 * dispatched alongside other strategies.
 *
 * Stop conditions: `maxIterations` total proposals, or `stallLimit`
 * consecutive feasibility-rejections.
 */

import { registerBackend } from '../../shared/procgen/mazeAlgorithms/registry.js';
import {
    floorTilesExcluding, allTargetsReachable, apply, undo,
} from '../mazeRoomEngine.js';

const DEFAULT_MAX_ITERATIONS = 2000;
const DEFAULT_STALL_LIMIT = 200;

export const randomWallsBackend = Object.freeze({
    id: 'random_walls',
    name: 'Classic (Random Walls)',
    cellStep: 1,
    run(world, params, rng) {
        const exclude = [world.entrance, ...world.exits.values()];
        const maxIterations = params.maxIterations ?? DEFAULT_MAX_ITERATIONS;
        const stallLimit = params.stallLimit ?? DEFAULT_STALL_LIMIT;

        let accepted = 0;
        let rejectedFeasibility = 0;
        let stall = 0;
        let iterations = 0;

        for (iterations = 0; iterations < maxIterations; iterations++) {
            if (stall >= stallLimit) break;

            const candidates = floorTilesExcluding(world, exclude);
            if (candidates.length === 0) break;

            const pick = candidates[Math.floor(rng.next() * candidates.length)];
            const token = apply(world, { type: 'add_wall', x: pick.x, y: pick.y });

            if (!allTargetsReachable(world)) {
                undo(world, token);
                rejectedFeasibility += 1;
                stall += 1;
                continue;
            }

            accepted += 1;
            stall = 0;
        }

        return {
            iterations,
            accepted,
            rejectedFeasibility,
            stalled: stall >= stallLimit,
        };
    },
});

registerBackend(randomWallsBackend);
