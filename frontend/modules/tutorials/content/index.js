/**
 * Every tutorial, in the order the Tutorial panel lists them. `source` is the
 * file that holds it (the generated guide names it; `tutorials.test.js` checks
 * it is this entry's file). ⛔ Imports only content files: the guide generator
 * imports this in node.
 */
import { GUIDED_TOUR } from './guidedTour.js';
import { START_SAVING_YOUR_SETUP, START_WORKBENCH } from './start/workbench.js';
import { TRACKER_TRACK_A_GAME } from './tracker/trackAGame.js';
import {
    TRACKER_DUNGEONS, TRACKER_EDITOR, TRACKER_HELPERS, TRACKER_PATH_ANALYZER, TRACKER_REGION_GRAPH,
    TRACKER_SPOILER_CHECKLIST, TRACKER_TIMER,
} from './tracker/panels.js';
import { PROCGEN_SPHERE_GROWTH } from './procgen/sphereGrowth.js';
import { PROCGEN_SHUFFLED_SPIRAL } from './procgen/shuffledSpiral.js';
import { PROCGEN_GRID_GROWTH } from './procgen/gridGrowth.js';
import { PROCGEN_TOP_DOWN } from './procgen/topDown.js';
import { PROCGEN_SETTINGS_AND_BOT } from './procgen/settingsAndBot.js';
import { PROCGEN_TO_MULTIWORLD } from './procgen/toMultiworld.js';
import { PROCGEN_BOUNCE_REGION_EDITOR } from './procgen/bounceRegionEditor.js';
import { PROCGEN_SEEDLING } from './procgen/seedling.js';
import { PROCGEN_MIXED_WORLD } from './procgen/mixedWorld.js';
import { PROCGEN_LOOP_MODE_JTA } from './procgen/loopModeJta.js';
import { PROCGEN_LOOP_MODE_EVERYTHING } from './procgen/loopModeEverything.js';
import { METAMATH_DEMO } from './games/metamath.js';
import { DEPGRAPH_DEMO } from './games/depgraph.js';
import { DEPGRAPH_EXTRAS } from './games/depgraphExtras.js';
import { APCALC_DEMO, APCALC_GENERATOR } from './games/apcalc.js';
import { APCALC_MULTIWORLD, DEPGRAPH_MULTIWORLD, METAMATH_MULTIWORLD } from './games/multiworld.js';

const entry = (source, tutorial) => Object.freeze({ source: `frontend/modules/tutorials/content/${source}`, tutorial });

export const TUTORIALS = Object.freeze([
    entry('guidedTour.js', GUIDED_TOUR),
    entry('start/workbench.js', START_WORKBENCH),
    entry('start/workbench.js', START_SAVING_YOUR_SETUP),
    entry('procgen/sphereGrowth.js', PROCGEN_SPHERE_GROWTH),
    entry('procgen/shuffledSpiral.js', PROCGEN_SHUFFLED_SPIRAL),
    entry('procgen/gridGrowth.js', PROCGEN_GRID_GROWTH),
    entry('procgen/topDown.js', PROCGEN_TOP_DOWN),
    entry('procgen/settingsAndBot.js', PROCGEN_SETTINGS_AND_BOT),
    entry('procgen/toMultiworld.js', PROCGEN_TO_MULTIWORLD),
    entry('procgen/bounceRegionEditor.js', PROCGEN_BOUNCE_REGION_EDITOR),
    entry('procgen/seedling.js', PROCGEN_SEEDLING),
    entry('procgen/mixedWorld.js', PROCGEN_MIXED_WORLD),
    entry('procgen/loopModeJta.js', PROCGEN_LOOP_MODE_JTA),
    entry('procgen/loopModeEverything.js', PROCGEN_LOOP_MODE_EVERYTHING),
    entry('games/metamath.js', METAMATH_DEMO),
    entry('games/multiworld.js', METAMATH_MULTIWORLD),
    entry('games/depgraph.js', DEPGRAPH_DEMO),
    entry('games/depgraphExtras.js', DEPGRAPH_EXTRAS),
    entry('games/multiworld.js', DEPGRAPH_MULTIWORLD),
    entry('games/apcalc.js', APCALC_DEMO),
    entry('games/apcalc.js', APCALC_GENERATOR),
    entry('games/multiworld.js', APCALC_MULTIWORLD),
    entry('tracker/trackAGame.js', TRACKER_TRACK_A_GAME),
    entry('tracker/panels.js', TRACKER_PATH_ANALYZER),
    entry('tracker/panels.js', TRACKER_REGION_GRAPH),
    entry('tracker/panels.js', TRACKER_DUNGEONS),
    entry('tracker/panels.js', TRACKER_HELPERS),
    entry('tracker/panels.js', TRACKER_SPOILER_CHECKLIST),
    entry('tracker/panels.js', TRACKER_TIMER),
    entry('tracker/panels.js', TRACKER_EDITOR),
]);
