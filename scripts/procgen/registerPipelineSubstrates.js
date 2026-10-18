/**
 * registerPipelineSubstrates — the ONE substrate bootstrap the headless
 * pipeline drivers import (§5au item 5). Each library registers its adapter
 * on import, so this module has no exports: importing it is the act.
 *
 * Before this, each driver kept its own import list and they disagreed:
 * spiral-step registered jta + omsi, sphere-step / dump-sphere-growth did not,
 * topdown-step had maze + bounce only, dump-grid-growth maze + text_adventure.
 * A `--quota jta=…` that worked on one driver threw "unknown substrate" on its
 * neighbour.
 *
 * Usage (from a driver):
 *   import './registerPipelineSubstrates.js';
 */

import '../../frontend/modules/mazeRoom/mazeRoomLibrary.js';
import '../../frontend/modules/textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js';
import '../../frontend/modules/jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js';
import '../../frontend/modules/bounceDemo/bounceDemoLibrary.js';
import '../../frontend/modules/runnerDemo/runnerDemoLibrary.js';
import '../../frontend/modules/omsiSubstrateWrapper/omsiSubstrateWrapperLibrary.js';
