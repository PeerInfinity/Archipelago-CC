/**
 * Side-effect: register the maze substrate's wall-generation backends
 * with the shared algorithm registry. Importing this module from
 * `mazeRoomEngine.js` ensures every backend is available before the
 * first `generateMaze` call.
 */

import './empty.js';
import './randomWalls.js';
import './corridorOnly.js';
import './recursiveBacktracker.js';
import './kruskals.js';
import './recursiveDivision.js';
