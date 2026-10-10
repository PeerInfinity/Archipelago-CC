/**
 * Every tutorial, in the order the Tutorial panel lists them. `source` is the
 * file that holds it (the generated guide names it; `tutorials.test.js` checks
 * it is this entry's file). ⛔ Imports only content files: the guide generator
 * imports this in node.
 */
import { GUIDED_TOUR } from './guidedTour.js';

export const TUTORIALS = Object.freeze([
    Object.freeze({ source: 'frontend/modules/tutorials/content/guidedTour.js', tutorial: GUIDED_TOUR }),
]);
