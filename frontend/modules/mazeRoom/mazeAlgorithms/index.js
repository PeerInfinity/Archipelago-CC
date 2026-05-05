/**
 * Side-effect: register the maze substrate's wall-generation backends
 * with the shared algorithm registry. Importing this module from
 * `mazeRoomEngine.js` ensures every backend is available before the
 * first `generateMaze` call.
 *
 * Tree-based backends (recursive_backtracker, kruskals, recursive
 * division) plus their post-processors land in a follow-up commit.
 */

import './empty.js';
import './randomWalls.js';
import './corridorOnly.js';
