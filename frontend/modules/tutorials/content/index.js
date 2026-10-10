/**
 * Every tutorial, in the order the Tutorial panel lists them. `source` is the
 * file that holds it (the generated guide names it; `tutorials.test.js` checks
 * it is this entry's file). ⛔ Imports only content files: the guide generator
 * imports this in node.
 */
import { GUIDED_TOUR } from './guidedTour.js';
import { PROCGEN_SPHERE_GROWTH } from './procgen/sphereGrowth.js';
import { PROCGEN_SHUFFLED_SPIRAL } from './procgen/shuffledSpiral.js';
import { PROCGEN_GRID_GROWTH } from './procgen/gridGrowth.js';
import { PROCGEN_TOP_DOWN } from './procgen/topDown.js';
import { PROCGEN_SETTINGS_AND_BOT } from './procgen/settingsAndBot.js';
import { PROCGEN_TO_MULTIWORLD } from './procgen/toMultiworld.js';

const entry = (source, tutorial) => Object.freeze({ source: `frontend/modules/tutorials/content/${source}`, tutorial });

export const TUTORIALS = Object.freeze([
    entry('guidedTour.js', GUIDED_TOUR),
    entry('procgen/sphereGrowth.js', PROCGEN_SPHERE_GROWTH),
    entry('procgen/shuffledSpiral.js', PROCGEN_SHUFFLED_SPIRAL),
    entry('procgen/gridGrowth.js', PROCGEN_GRID_GROWTH),
    entry('procgen/topDown.js', PROCGEN_TOP_DOWN),
    entry('procgen/settingsAndBot.js', PROCGEN_SETTINGS_AND_BOT),
    entry('procgen/toMultiworld.js', PROCGEN_TO_MULTIWORLD),
]);
