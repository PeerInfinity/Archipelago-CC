/**
 * mazeLocationCapacity — **HOW MANY LOCATIONS A MAZE ROOM HOLDS AT A SIZE**,
 * the maze entry's `locationCapacity.capacityAt` (APWORLD SUBSTRATE CHANGE C2;
 * vocabulary: `procgenCore/locationCapacity.js`).
 *
 * ── WHAT IS DECLARED, AND ONLY THAT ───────────────────────────────────
 *
 * The placer needs one reachable floor tile per location (`pickReachableFloorTile`:
 * reachable from the entrance, not the entrance, not an exit, not already
 * holding an item or an obstacle). So a room's capacity is its reachable floor,
 * and the declaration answers only where that floor is a FUNCTION OF THE SIZE:
 *
 *   · an OPEN room — the classic generator with `maxIterations: 0` (what the
 *     top-down driver and the hub's Initialise realise with) draws no wall, and
 *     a room with no exit skips wall generation altogether. Its floor is every
 *     tile but the entrance and the exits: `width × height − 1 − exits`.
 *     Measured at C2 over 8×6 … 27×27 × 0–4 exits × 40 seeds: exact, every seed.
 *     ⚠ Since tutorial-bugs (2026-10-10) it is an UPPER BOUND, short by the
 *     corners whose two neighbours are both exits: an exit tile is a dead end
 *     to the generator (mazeRoomEngine `isDeadEndExit`), so such a corner is
 *     reached only by crossing. Where the exits land is a draw, so no function
 *     of the size can subtract it; it is rare past the smallest rooms (the
 *     unit row meets it on a handful of 3- and 4-exit rooms of 8×6 … 15×11).
 *   · a WALLED room (any other params or biome) answers `null`: its floor is the
 *     wall draw's (a 27×27 corridor room with one exit held 15–83 candidates over
 *     40 seeds), so no function of the size can hold it.
 *
 * ── ⛓⛓ THE GATED SHARE — WHY A ROOM OF RULED LOCATIONS NEEDS MORE THAN ONE
 *    TILE EACH ─────────────────────────────────────────────────────────
 *
 * A location with a rule that is not `True_` gets a logic gate ON its tile, and
 * a gate is a wall to the placer's reach until its rule clears. Every such
 * location therefore removes a tile from the walkable floor at a random
 * reachable spot — site percolation on the square lattice. Past the blocked
 * share `1 − p_c` (p_c = 0.592746, the square-lattice site-percolation
 * threshold — Newman & Ziff, PRL 85, 4104 (2000)) the open floor stops being
 * one connected piece, the entrance's piece stops holding the rest of the
 * gates, and the realiser re-rolls and grows. So an open room of floor F holds
 * F locations of which at most ⌊(1 − p_c)·F⌋ are gated.
 *
 * ⛓ MEASURED AGAINST THE REALISER (C2 §45.0), not assumed: over the hub's
 * Initialise of every committed classic slot (180; 11,442 rooms), the declared
 * size equals the size the realiser grows the room to on 11,422 and differs by
 * −1 … +2 grow steps on the rest (the realiser's layout is a draw; the
 * declaration is its threshold). `apworldEditor/locationCapacity.slow.test.js`
 * holds that relation to the realiser.
 */

import { resolveBiome } from './mazeRoomBiomeLibrary.js';

/** ⛓ The square-lattice site-percolation threshold (Newman & Ziff 2000). */
export const SQUARE_SITE_PERCOLATION = 0.592746;

/** ⛓ The share of an open room's floor its gated locations may take. */
export const GATED_FLOOR_SHARE = 1 - SQUARE_SITE_PERCOLATION;

/** ⛓ The backend that reads `maxIterations` as its wall budget (the default biome's). */
const OPEN_CAPABLE_BACKEND = 'random_walls';

/** ⛓ Does a room of these params / biome / exits come out with no wall inside? */
export function mazeRoomIsOpen(params = {}, { exits = 0, biome = null } = {}) {
    if (exits === 0) return true;
    let resolved;
    try {
        resolved = resolveBiome(biome);
    } catch {
        return false;
    }
    if (resolved.biome.backend !== OPEN_CAPABLE_BACKEND) return false;
    if ((resolved.biome.postProcessors ?? []).length > 0) return false;
    return { ...params, ...resolved.params }.maxIterations === 0;
}

/**
 * `capacityAt(size, params, demand)` → `{locations, gated}` for an open room,
 * `null` for a walled one.
 */
export function mazeCapacityAt(size, params = {}, { exits = 0, biome = null } = {}) {
    if (!mazeRoomIsOpen(params, { exits, biome })) return null;
    const floor = size.width * size.height - 1 - exits;
    return { locations: floor, gated: Math.floor(GATED_FLOOR_SHARE * floor) };
}
