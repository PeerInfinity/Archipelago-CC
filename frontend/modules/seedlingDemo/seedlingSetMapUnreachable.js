/**
 * seedlingDemo/seedlingSetMapUnreachable — **THE REPORT'S UNREACHABLE REGIONS, AS ROOMS OF THE LAB MAP** (slice
 * `seedling-map-unreachable`). `seedlingSetMap.createSetMap` hands this to `setEditorView` as the provider's optional
 * `unreachableOf`. ⛔ Its own module, not an export of `seedlingSetMap`: that module's export list is part of the
 * map digest `seedlingSetMapLift.test.js` pins, and a mark drawn only after a REPORT must leave that digest alone.
 *
 * ⛓ (slice `maze-map-unreachable`) the function itself MOVED, unchanged, to `procgenCore/setMapUnreachable.js`: it
 * reads only the REPORT (`rules` + the derived atlas's `map_ref`), so the maze lab's map provider answers the same
 * hook with it. Re-exported here, same function, so every caller of this module reads exactly what it read before.
 */

export { unreachableRoomsOf } from '../procgenCore/setMapUnreachable.js';
