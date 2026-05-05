/**
 * `corridor_only` backend — find the shortest BFS path from the
 * entrance to each exit, mark every floor tile not on the union of
 * those paths as a wall. Produces a degenerate maze with no choices,
 * useful as the extreme end of the topology spectrum.
 *
 * One-shot: walks the grid once after BFS, stamping walls.
 */

import { registerBackend } from '../../shared/procgen/mazeAlgorithms/registry.js';
import { reach } from '../../shared/simulatorCore.js';
import {
    bfsSolver, createState, apply, getTile, TILE_FLOOR,
} from '../mazeRoomEngine.js';

// Hardcoded to the same strings exported from mazeRoomEngine as
// INPUT_N/S/E/W. Importing those symbols here would land in a
// circular module dependency where this file evaluates *during*
// mazeRoomEngine's top-level execution, so the imports are still
// undefined.
const DELTAS = {
    N: { dx: 0, dy: -1 },
    S: { dx: 0, dy: 1 },
    E: { dx: 1, dy: 0 },
    W: { dx: -1, dy: 0 },
};

function posKey(x, y) { return `${x},${y}`; }

export const corridorOnlyBackend = Object.freeze({
    id: 'corridor_only',
    name: 'Corridor',
    cellStep: 1,
    run(world, _params, _rng) {
        // Union of shortest paths from entrance to each exit.
        const onPath = new Set();
        onPath.add(posKey(world.entrance.x, world.entrance.y));

        for (const exit of world.exits.values()) {
            const start = createState(world);
            const result = reach(world, bfsSolver, start, (s) =>
                s.player_pos.x === exit.x && s.player_pos.y === exit.y);
            if (!result.ok) continue;
            let { x, y } = world.entrance;
            for (const input of result.plan) {
                const d = DELTAS[input];
                x += d.dx;
                y += d.dy;
                onPath.add(posKey(x, y));
            }
        }

        let walledTiles = 0;
        for (let y = 0; y < world.height; y++) {
            for (let x = 0; x < world.width; x++) {
                if (onPath.has(posKey(x, y))) continue;
                if (getTile(world, x, y) !== TILE_FLOOR) continue;
                apply(world, { type: 'add_wall', x, y });
                walledTiles += 1;
            }
        }

        return {
            iterations: 1,
            accepted: walledTiles,
            rejectedFeasibility: 0,
            stalled: false,
        };
    },
});

registerBackend(corridorOnlyBackend);
