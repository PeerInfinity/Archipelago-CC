/**
 * Maze biome library — named bundles of (backend, params,
 * post-processors) that the substrate looks up by id when generating
 * a region. Per-region biome selection lives in
 * `preset_sidecars[player][region].biome` of rules.json; the substrate
 * falls back to `DEFAULT_BIOME_ID` when no biome is specified.
 *
 * ⛓⛓ THE TABLE ITSELF NOW LIVES IN `procgenCore/skeletonKinds.js` and this
 * file re-exports it (CONSTRUCTIVE-MODE arc, slice 5). ⚖ Ruling 2: the maze
 * biome names ARE the constructive skeleton kinds, one vocabulary across both
 * substrates — and `seedlingDemo/` may not import `mazeRoom/`, so the shared
 * half had to move to a neutral file rather than be re-exported from one. ⛔
 * Nothing about the maze's use of it changed: every caller here keeps this
 * import path, `resolveBiome` is the same function, and `DEFAULT_BIOME_ID` is
 * still `classic` (the CONSTRUCTIVE default is a different constant —
 * `DEFAULT_SKELETON_KIND` — and the two must not be collapsed).
 *
 * Adding a new biome that uses an existing backend is a one-line
 * change in `skeletonKinds.js`. Adding a new backend is a new file under
 * `shared/procgen/mazeAlgorithms/` (portable) or `mazeAlgorithms/`
 * (simulator-bound) plus an entry there.
 *
 * See docs/json/developer/procgen/maze.md ("Biomes and wall backends").
 */

export {
    BIOMES, DEFAULT_BIOME_ID, resolveBiome,
} from '../procgenCore/skeletonKinds.js';
