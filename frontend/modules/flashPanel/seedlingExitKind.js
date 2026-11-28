/**
 * flashPanel/seedlingExitKind — **SEEDLING'S EXIT CLASSIFIER, PURE** (maze-arrival-spawns).
 *
 * The rule that says what a Seedling exit IS on the map: a staircase / pit (`down` / `up`, off the exit id), a
 * walk-off-the-edge `join`, or a doorway / teleporter `warp` (an exit that is not an edge transition). Factored out of
 * `seedlingCompositeMap.js` so a substrate that PLAYS Seedling's levels (the maze, `mazeRoom/mazeRegionMapHooks.js`) asks
 * the same rule instead of copying it: `seedlingCompositeMap.js` imports the Seedling skin renderer (for `TILE`) and the
 * door-direction module, and a maze hook must not pull a substrate's renderer in to classify an exit. This module
 * imports NOTHING. `seedlingCompositeMap.js` re-exports all three names (its `seedlingEdgeTransitionOf` with `ts = TILE`),
 * so every existing caller is unchanged.
 *
 * ⛔ PURE: no import, no DOM, never a preset or region name. Owned by `flashPanel`.
 */

/**
 * ⛓ The layout KIND of a Seedling exit, off its `exit_id` prefix — the only stairs/pit signal a compiled sidecar
 * carries (every exit's `kind` is `teleporter`: Seedling's own Teleporter object, which the game uses for walk-off
 * edges and doorways alike). `out_stairsdown_*` and `out_pit_*` go DOWN, `out_stairsup_*` UP, every other exit
 * (`out_teleporter_*`, the boss doors) is a `join` here; `seedlingLayoutGraph` then makes each one that is not an
 * edge transition a `warp` (`seedlingEdgeTransitionOf`).
 */
export function seedlingExitLayoutKind(exitId) {
    const id = String(exitId ?? '');
    if (id.startsWith('out_stairsdown') || id.startsWith('out_pit')) return 'down';
    if (id.startsWith('out_stairsup')) return 'up';
    return 'join';
}

/**
 * ⛓⛓ **IS THIS EXIT AN EDGE TRANSITION?** (region-map placement (A); ⚖ user 2026-11-16/17: ONLY a walk-off-edge
 * transition is a `join`; a doorway into a dungeon, an in-game teleporter or any other non-spatial warp is not.)
 * An exit is an edge transition when its door tile (`exit_tiles[0]`) lies ON the border of its source level AND its
 * arrival (`target_spawn`, in `ts`-sized units) lies within `EDGE_ARRIVAL_TILES` tiles of the OPPOSITE border of the
 * target level. MEASURED on `seedling_playthrough`: every one of the 184 edge exits arrives 0–1 tiles from that border;
 * every one of the 46 others arrives ≥ 2 (one at exactly 2: `level_28 → level_27`).
 * A caller whose sizes and arrival are already in TILES passes `ts = 1` (the maze hooks do).
 * @param {object} exit      `{exit_tiles: [[x, y], …], target_spawn: {x, y}}`
 * @param {{w,h}|null} srcPx  the source level's size, in the same units as `target_spawn`
 * @param {{w,h}|null} tgtPx  the target level's size, in those units
 * @param {number} ts         the tile size in those units (Seedling's pixels: 16)
 * @returns {boolean|null} null when the data cannot say (a size, the door tile or the arrival is missing)
 */
export const EDGE_ARRIVAL_TILES = 1;
export function seedlingEdgeTransitionOf(exit, srcPx, tgtPx, ts) {
    const tile = Array.isArray(exit?.exit_tiles) ? exit.exit_tiles[0] : null;
    const ax = exit?.target_spawn?.x;
    const ay = exit?.target_spawn?.y;
    if (!srcPx || !tgtPx || !Array.isArray(tile) || !Number.isFinite(ax) || !Number.isFinite(ay)) return null;
    const sw = Math.round(srcPx.w / ts);
    const sh = Math.round(srcPx.h / ts);
    const tw = Math.round(tgtPx.w / ts);
    const th = Math.round(tgtPx.h / ts);
    const [x, y] = tile;
    const sides = [];
    if (x <= 0) sides.push('W');
    if (x >= sw - 1) sides.push('E');
    if (y <= 0) sides.push('N');
    if (y >= sh - 1) sides.push('S');
    const tx = Math.floor(ax / ts);
    const ty = Math.floor(ay / ts);
    // distance (tiles) from the arrival to the target border OPPOSITE each source side
    const opposite = { W: tw - 1 - tx, E: tx, N: th - 1 - ty, S: ty };
    return sides.some((d) => opposite[d] <= EDGE_ARRIVAL_TILES);
}
