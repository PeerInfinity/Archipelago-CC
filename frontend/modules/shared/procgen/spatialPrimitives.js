/**
 * Spatial primitives — pure geometry helpers used by every tile-grid
 * substrate (and by the procgen pipeline driver to position regions
 * on a grid). No dependencies on any substrate's world model — these
 * are functions of width / height / side / tile coordinates only.
 *
 * See NewDocs/plans/procedural-generation/text-adventure-substrate.md
 * §"Adapter primitives library" for why this module exists separately
 * from `adapterPrimitives.js`: the adapter primitives implement
 * substrate adapter functions and depend on the maze world model;
 * spatial primitives don't depend on any world model and live one
 * layer below.
 */

// --- Side / direction constants ---

export const SIDE_N = 'N';
export const SIDE_S = 'S';
export const SIDE_E = 'E';
export const SIDE_W = 'W';
export const SIDES = [SIDE_N, SIDE_S, SIDE_E, SIDE_W];

export const OPPOSITE_SIDE = Object.freeze({
    [SIDE_N]: SIDE_S,
    [SIDE_S]: SIDE_N,
    [SIDE_E]: SIDE_W,
    [SIDE_W]: SIDE_E,
});

export const SIDE_DELTAS = Object.freeze({
    [SIDE_N]: { dx: 0, dy: -1 },
    [SIDE_S]: { dx: 0, dy: 1 },
    [SIDE_E]: { dx: 1, dy: 0 },
    [SIDE_W]: { dx: -1, dy: 0 },
});

// --- Auto-grow knobs ---
//
// Used by tryAssignExitTiles + the spatialCore auto-grow loop. Cap
// retries so a pathologically over-constrained input fails loudly
// instead of looping; grow uniformly so per-side capacity goes up
// evenly.

export const REGION_GROW_STEP = 2;
export const REGION_GROW_MAX_ATTEMPTS = 4;

// --- Perimeter helpers ---

/**
 * Returns the perimeter tiles in clockwise order starting from the
 * top edge of the east wall: E (top→bottom), S (right→left), W
 * (bottom→top), N (left→right). Corners are excluded — a tile in a
 * corner is on two walls at once and the rendering can't disambiguate
 * which side an exit/entrance there belongs to (which direction does
 * stepping off it lead?). Region size is required to be at least 3×3
 * so each side has at least one non-corner tile.
 *
 * Used by the multi-exit assignment in spatialCore: when the caller
 * doesn't specify `spec.side`, the next clockwise slot from the
 * cursor is assigned. See top-down-driver.md §1.
 */
export function clockwisePerimeterTiles(width, height) {
    const tiles = [];
    // E: top to bottom, skipping the two E corners (y=0 and y=height-1).
    for (let y = 1; y < height - 1; y++) tiles.push({ x: width - 1, y, side: SIDE_E });
    // S: right to left, skipping the two S corners.
    for (let x = width - 2; x >= 1; x--) tiles.push({ x, y: height - 1, side: SIDE_S });
    // W: bottom to top, skipping the two W corners.
    for (let y = height - 2; y >= 1; y--) tiles.push({ x: 0, y, side: SIDE_W });
    // N: left to right, skipping the two N corners.
    for (let x = 1; x < width - 1; x++) tiles.push({ x, y: 0, side: SIDE_N });
    return tiles;
}

/**
 * Pick a random non-corner tile on the requested side. Region size
 * must be at least 3 along the relevant axis so a non-corner choice
 * exists; tryAssignExitTiles (and the driver's per-region size
 * formula) bake that in.
 */
export function pickTileOnSide(side, size, rng) {
    const xInner = () => 1 + Math.floor(rng.next() * (size.width - 2));
    const yInner = () => 1 + Math.floor(rng.next() * (size.height - 2));
    switch (side) {
        case SIDE_N: return { x: xInner(), y: 0 };
        case SIDE_S: return { x: xInner(), y: size.height - 1 };
        case SIDE_E: return { x: size.width - 1, y: yInner() };
        case SIDE_W: return { x: 0, y: yInner() };
        default: throw new Error(`pickTileOnSide: unknown side '${side}'`);
    }
}

/**
 * Default entrance tile for a "start" region (no incoming side):
 * geometric center.
 */
export function entranceTileForStartRegion(size) {
    return { x: Math.floor(size.width / 2), y: Math.floor(size.height / 2) };
}

/**
 * Mirror a tile across the shared wall between two adjacent regions.
 *
 * When region A has an exit at tile (px, py) on its east wall and
 * region B sits to the east of A, B's matching entrance tile is at
 * (0, py) — same y, x snapped to B's left edge. This helper does
 * the snap for any of the four sides.
 *
 * When the parent has auto-grown wider/taller than the child along
 * the shared wall, the parent's exit coord can exceed the child's
 * bounds. Treat the parent wall as a sequence of child-sized
 * segments and pick the local coord within the segment containing
 * the exit (parentTile.x % regionSize.width on N/S walls,
 * parentTile.y % regionSize.height on E/W walls). When the parent
 * fits inside the child the modulo is a no-op.
 *
 * Used by both pipeline drivers when wiring a child region's
 * entrance to its parent's exit.
 */
export function mirrorTileAcrossSide(parentTile, parentSide, regionSize) {
    const localX = ((parentTile.x % regionSize.width) + regionSize.width) % regionSize.width;
    const localY = ((parentTile.y % regionSize.height) + regionSize.height) % regionSize.height;
    switch (parentSide) {
        case SIDE_E: return { x: 0, y: localY };
        case SIDE_W: return { x: regionSize.width - 1, y: localY };
        case SIDE_N: return { x: localX, y: regionSize.height - 1 };
        case SIDE_S: return { x: localX, y: 0 };
        default: throw new Error(`mirrorTileAcrossSide: unknown side '${parentSide}'`);
    }
}

// --- Multi-exit assignment ---
//
// Resolve a tile per exit at the given size. Returns the resolved
// list, or null if any exit can't be placed (caller's signal to
// auto-grow and retry).
//
// Per-exit rules:
//   - spec.tile specified → pin to that exact tile (caller-controlled
//     placement). Used by top-down to line up an exit with the
//     entrance tile so cross-region walls match. Allowed to coincide
//     with the entrance — the driver opts into this — but collisions
//     with another already-placed exit fail the layout.
//   - spec.side specified → pick a random tile on that side, with
//     collision avoidance (used by grid-growth, which targets
//     specific sides for parent/child alignment).
//   - spec.side omitted   → take the next clockwise slot from the
//     cursor (used by top-down, which doesn't care which wall an
//     exit lives on). Skips occupied slots and advances the cursor
//     past each placement so subsequent unspecified-side exits move
//     forward through the perimeter.

export function tryAssignExitTiles(size, exits, entrance_tile, rng, defaultExitId) {
    const entranceKey = `${entrance_tile.x},${entrance_tile.y}`;
    const usedKeys = new Set([entranceKey]);
    const perimeter = clockwisePerimeterTiles(size.width, size.height);
    let cwCursor = 0;

    const resolved = [];
    for (let i = 0; i < exits.length; i++) {
        const spec = exits[i];
        let tile = null;
        let resolvedSide = spec.side ?? null;

        if (spec.tile) {
            // Pinned tile (caller-controlled placement). Allowed to
            // overlap with the entrance — top-down uses this to put
            // the BFS-parent's reverse exit on the entrance tile so
            // it lines up with the parent's exit across the shared
            // wall. A collision with another already-placed exit's
            // tile is still a hard failure.
            const key = `${spec.tile.x},${spec.tile.y}`;
            if (usedKeys.has(key) && key !== entranceKey) return null;
            tile = spec.tile;
            resolvedSide = spec.side ?? null;
        } else if (spec.side) {
            // Random on the requested side, retry on collision.
            let attempts = 0;
            while (attempts < 50) {
                const candidate = pickTileOnSide(spec.side, size, rng);
                if (!usedKeys.has(`${candidate.x},${candidate.y}`)) {
                    tile = candidate;
                    break;
                }
                attempts++;
            }
            if (!tile) return null; // every random pick collided — likely too-small side
        } else {
            // Clockwise: walk from cursor until we find an unused
            // slot. Bound the walk by the full perimeter; if every
            // slot is used, signal failure.
            let placed = false;
            for (let step = 0; step < perimeter.length; step++) {
                const idx = (cwCursor + step) % perimeter.length;
                const candidate = perimeter[idx];
                if (!usedKeys.has(`${candidate.x},${candidate.y}`)) {
                    tile = candidate;
                    resolvedSide = candidate.side;
                    cwCursor = idx + 1;
                    placed = true;
                    break;
                }
            }
            if (!placed) return null;
        }

        usedKeys.add(`${tile.x},${tile.y}`);
        resolved.push({
            exit_id: spec.exit_id ?? defaultExitId(i),
            side: resolvedSide,
            x: tile.x,
            y: tile.y,
            exitName: spec.exitName ?? null,
            targetRegion: spec.targetRegion ?? null,
        });
    }
    return resolved;
}
