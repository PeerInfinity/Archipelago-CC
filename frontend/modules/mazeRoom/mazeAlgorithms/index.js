/**
 * Side-effect: register the maze substrate's wall-generation backends
 * with the shared algorithm registry. Importing this module from
 * `mazeRoomEngine.js` ensures every backend is available before the
 * first `generateMaze` call.
 *
 * Three of the six now live in `shared/procgen/mazeAlgorithms/` — they
 * depend only on the grid contract in `gridTiles.js`, so a second grid
 * substrate can use them as carvers. The three that stay here need the
 * maze simulator (`corridor_only`, `random_walls`) or are trivial and
 * keep them company (`empty`). Registration ORDER is the order of the
 * imports below and must not change: `listBackends()` returns insertion
 * order.
 */

import './empty.js';
import './randomWalls.js';
import './corridorOnly.js';
import '../../shared/procgen/mazeAlgorithms/recursiveBacktracker.js';
import '../../shared/procgen/mazeAlgorithms/kruskals.js';
import '../../shared/procgen/mazeAlgorithms/recursiveDivision.js';
