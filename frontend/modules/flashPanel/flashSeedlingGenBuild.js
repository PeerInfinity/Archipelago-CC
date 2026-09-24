/**
 * `flash_seedling_gen`'s BUILD door, headless (seedling generated levels G1).
 *
 * Importing this registers the entry (`flashSeedlingGenLibrary.js`, a side
 * effect) AND installs the Seedling generator into it (`seedlingGenRoom.js`),
 * so the entry can realise regions. It is what every headless caller that
 * BUILDS worlds loads — `REGISTRY_LIBRARIES` (`scripts/procgen/reference/
 * registry.mjs`) and the regenerate worker's `REGENERATE_WORKER_LIBRARIES` name
 * this file, not the light library.
 *
 * ⛔ NOT imported by `flashPanel/index.js`: that would put the generator
 * (+94 files, +4.96 MB) in the panel's static closure. The live app installs
 * the room through a computed specifier instead (see the library's header).
 */
import * as seedlingGenRoom from '../seedlingDemo/seedlingGenRoom.js';
import { installSeedlingGenRoom } from './flashSeedlingGenLibrary.js';

installSeedlingGenRoom(seedlingGenRoom);

export { substrateRegistryEntry, FLASH_SEEDLING_GEN_SUBSTRATE_ID } from './flashSeedlingGenLibrary.js';
