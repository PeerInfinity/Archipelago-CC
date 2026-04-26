/**
 * Adapter primitives — substrate-neutral catalog of reusable adapter
 * functions. Substrate libraries (e.g. mazeRoomLibrary.js,
 * textAdventureSubstrateLibrary.js) compose registry entries by
 * picking primitives from this file.
 *
 * Why this module exists separately from spatialPrimitives.js:
 * spatial primitives are pure geometry (no world model). The
 * primitives below are tile-grid adapter functions — they operate
 * on the maze world model (tiles, exits Map, obstacles Map, items
 * Map) and call into maze world-model APIs (createWorld, step,
 * reachableTiles, etc.). Any substrate that wants to share the
 * tile-grid world model picks from here.
 *
 * Layering note: this file imports from `mazeRoom/`, which means
 * `shared/procgen/` has a dependency on a substrate module. That's
 * a deliberate inversion in v1 — the tile-grid world model is the
 * substrate-neutral data shape, but its implementation has
 * historically lived in `mazeRoom/`. A future refactor can move
 * the world model out of `mazeRoom/` into `shared/procgen/` if
 * a third substrate's needs justify it; the substrate registry
 * interface stays unchanged.
 *
 * See NewDocs/plans/procedural-generation/text-adventure-substrate.md
 * §"Adapter primitives library" for the design discussion.
 */

// Tile-grid adapter functions. Implementations live in mazeRoom/ and
// procgenPipeline/; this module re-exports them under substrate-
// neutral names so registry entries don't have to mention `maze` in
// their imports just to use the tile-grid primitives.

export {
    generateRegionCore as spatialCore,
    placeFromItems as itemBasedPlacer,
    placeFromRules as ruleGatePlacer,
    extractPathsAndObstacles as tileGridPathExtractor,
    deserializeMazeWorld as tileGridDeserializer,
} from '../../mazeRoom/mazeRoomEngine.js';

export {
    serializeMazeWorld as tileGridSerializer,
} from '../../procgenPipeline/procgenPipelineEngine.js';
