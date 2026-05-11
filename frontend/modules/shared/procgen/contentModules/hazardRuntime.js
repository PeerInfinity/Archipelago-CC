/**
 * Hazard runtime — pure helpers for advancing hazard cycles and
 * checking player-move validity against them.
 *
 * Plan: NewDocs/plans/procedural-generation/maze-content-modules.md
 * (Phase 2). Consumes the hazard data produced by hazardPathGen.js.
 *
 * Hazard runtime shape (mutable phase, immutable everything else):
 *
 *   {
 *     shape: 'linear' | 'loop',
 *     length: 2|3|5 (linear) or 4|8 (loop),
 *     tiles: [{x, y}, ...],           // ordered tile sequence
 *     cycleLength: 2|4|8,             // turns per cycle
 *     phase: 0..cycleLength-1,        // current position in cycle
 *   }
 *
 * The runtime mutates `phase` in place; everything else is read-only
 * after generation. `resetHazards` sets every hazard back to phase 0
 * — called from a content module's `resetOnEntry` hook in v1
 * (region-reset-on-entry per the plan).
 *
 * Validation rules (from the user's spec, Phase 2 of the plan):
 *
 *   Rule 1. The player CANNOT move into the tile the hazard will
 *           occupy on the next turn (its `nextTile`).
 *   Rule 2. The player CAN move into the tile the hazard currently
 *           occupies — but NOT from the direction the triangle is
 *           pointing (i.e., NOT from the hazard's `nextTile` toward
 *           its `currentTile`, which would be a head-on collision).
 *
 *  Both rules apply to wait actions too: if the hazard's `nextTile`
 *  equals the player's tile, waiting is invalid (the hazard would
 *  stomp them).
 *
 *  When no candidate action (wait + 4-direction move into walkable
 *  tiles) is valid, the substrate teleports the player back to the
 *  entrance.
 */

import { TILE_FLOOR } from '../../../mazeRoom/mazeRoomEngine.js';
import {
    HAZARD_SHAPE_LINEAR,
    HAZARD_SHAPE_LOOP,
} from './hazardPathGen.js';

/**
 * The tile a hazard currently occupies at `hazard.phase`. For linear
 * paths the sweep is forward through `tiles[0..N-1]`, then backward
 * through `tiles[N-2..1]` (phase 2N-3) before wrapping to phase 0;
 * endpoints get 1 turn each, midpoints 2. For loops it's just
 * `tiles[phase % length]`.
 */
export function currentTile(hazard) {
    const tiles = hazard.tiles;
    const phase = hazard.phase ?? 0;
    if (hazard.shape === HAZARD_SHAPE_LOOP) {
        return tiles[phase % tiles.length];
    }
    if (hazard.shape === HAZARD_SHAPE_LINEAR) {
        const N = tiles.length;
        if (phase < N) return tiles[phase];
        return tiles[(2 * N - 2) - phase];
    }
    throw new Error(`currentTile: unknown shape '${hazard.shape}'`);
}

/**
 * The tile the hazard will move to on its next turn — the tile its
 * triangle is rendering as facing. Computed by looking up the
 * current tile at (phase + 1) mod cycleLength.
 */
export function nextTile(hazard) {
    const cycle = hazard.cycleLength;
    if (!Number.isInteger(cycle) || cycle < 1) {
        throw new Error('nextTile: hazard.cycleLength must be a positive integer');
    }
    const nextPhase = ((hazard.phase ?? 0) + 1) % cycle;
    return currentTile({ ...hazard, phase: nextPhase });
}

/**
 * Compass direction (N/E/S/W) from a hazard's current tile to its
 * next tile — the direction the triangle visually points. Returns
 * null when current == next (degenerate path; shouldn't happen for
 * well-formed inputs).
 */
export function facing(hazard) {
    const cur = currentTile(hazard);
    const next = nextTile(hazard);
    if (next.y < cur.y) return 'N';
    if (next.y > cur.y) return 'S';
    if (next.x > cur.x) return 'E';
    if (next.x < cur.x) return 'W';
    return null;
}

/**
 * Advance a single hazard's phase by 1, modulo cycleLength. Mutates.
 */
export function advancePhase(hazard) {
    hazard.phase = ((hazard.phase ?? 0) + 1) % hazard.cycleLength;
}

/**
 * Tick all hazards by one turn. Safe for null / non-array input.
 */
export function tickHazards(hazards) {
    if (!Array.isArray(hazards)) return;
    for (const h of hazards) advancePhase(h);
}

/**
 * Reset all hazards to phase 0. Called on region entry per the v1
 * region-reset model. Safe for null / non-array input.
 */
export function resetHazards(hazards) {
    if (!Array.isArray(hazards)) return;
    for (const h of hazards) h.phase = 0;
}

/**
 * Check the player's intended move `from`→`to` against every
 * hazard's current state. Returns true when no hazard objects.
 * `from === to` represents a wait action — Rule 1 still applies
 * (waiting on a tile the hazard will stomp is invalid).
 *
 * @param {Array<object>} hazards
 * @param {{x:number, y:number}} from
 * @param {{x:number, y:number}} to
 */
export function validateMove(hazards, from, to) {
    if (!Array.isArray(hazards) || hazards.length === 0) return true;
    for (const h of hazards) {
        const cur = currentTile(h);
        const next = nextTile(h);
        // Rule 1: can't move into where the hazard is about to be.
        if (to.x === next.x && to.y === next.y) return false;
        // Rule 2: can't enter the hazard's current tile from the
        // direction the triangle points (its `next` is the
        // approach-from direction).
        if (to.x === cur.x && to.y === cur.y
                && from.x === next.x && from.y === next.y) {
            return false;
        }
    }
    return true;
}

/**
 * Returns true if any hazard's next-turn tile equals `playerXY` —
 * i.e. the hazard is about to step onto the player and stomp them.
 * Equivalent to `!validateMove(hazards, playerXY, playerXY)` (Rule 1
 * applied to the wait direction), exposed as a named helper to make
 * the substrate's pre-tick stomp check read intent-first.
 *
 * Used by the substrate to detect the doomed-by-the-tick case:
 *   - wait into a hazard.next tile (action no-op, but tick stomps),
 *   - move rejected by Rule 1 (player stays on a tile that ISN'T
 *     this hazard's next, but might be another's),
 *   - move rejected by Rule 2 (head-on bump leaves player on the
 *     same tile that IS this hazard's next, so tick stomps).
 *
 * Returning false here doesn't mean the player is safe — they may
 * still get trapped after the tick advances (caught by
 * hasAnyValidMove). It only means the tick won't stomp them this
 * turn.
 */
export function isPlayerStomped(hazards, playerXY) {
    return !validateMove(hazards, playerXY, playerXY);
}

const NEIGHBOR_DELTAS = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
];

/**
 * True iff at least one player action (wait + the 4 cardinal moves
 * into walkable in-bounds tiles) passes validateMove against the
 * current hazard state. Used by the substrate to detect the
 * teleport-to-entrance trigger after each hazard tick.
 *
 * Considers walkability via TILE_FLOOR — moves into walls / off-grid
 * are rejected here before hazard validation runs. (Obstacles like
 * locked gates are intentionally ignored: an obstacle-blocked move
 * isn't a hazard-induced trap and shouldn't trigger teleport.)
 */
export function hasAnyValidMove(world, hazards, playerXY) {
    if (validateMove(hazards, playerXY, playerXY)) return true;
    for (const d of NEIGHBOR_DELTAS) {
        const c = { x: playerXY.x + d.dx, y: playerXY.y + d.dy };
        if (!isInBounds(world, c.x, c.y)) continue;
        if (!isFloorAt(world, c.x, c.y)) continue;
        if (validateMove(hazards, playerXY, c)) return true;
    }
    return false;
}

/**
 * Set of posKey strings naming tiles currently occupied by any
 * hazard. Useful for rendering overlays without re-iterating the
 * hazard list per tile.
 */
export function getCurrentOccupancy(hazards) {
    const out = new Set();
    if (!Array.isArray(hazards)) return out;
    for (const h of hazards) {
        const t = currentTile(h);
        out.add(`${t.x},${t.y}`);
    }
    return out;
}

function isInBounds(world, x, y) {
    return x >= 0 && y >= 0 && x < world.width && y < world.height;
}

function isFloorAt(world, x, y) {
    return world.tiles[y * world.width + x] === TILE_FLOOR;
}
