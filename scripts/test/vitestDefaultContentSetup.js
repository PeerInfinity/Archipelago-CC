/**
 * vitestDefaultContentSetup — **EVERY VITEST FILE THAT BUILDS WORLDS FINDS THE
 * DEFAULT CONTENT PACKS PRELOADED** (⛓ CONTENT SETS C4; a `setupFiles` entry of
 * each vitest config).
 *
 * A suite that builds a world through the synchronous `buildRunFromState` (or the
 * engine's growers, or the APWorld editor's regenerate) reads the default packs
 * its substrates declare from a process-level cache
 * (`worldContent.preloadDefaultContent`). Each test file runs in its own module
 * graph, and this file runs in it FIRST — before the test file's imports and its
 * collection — so the cache it fills is the one the file's builders read.
 *
 * ⛔ WHY EVERY COMMITTED PACK, NOT THE REGISTRY'S DECLARATIONS. At this point
 * the file's substrate libraries have not registered: suites register them in
 * their own imports, in their own `beforeAll`, or inside a `describe` callback,
 * and some build a world while they are being collected. Measured on the C4
 * probe branch (maze and text adventure declaring a committed pack): a
 * `beforeAll` here saw an empty registry in about twenty world-building files.
 * A default pack is always a committed pack (`packs.json`), so preloading every
 * one covers any declaration, at any point in the file.
 */
import { readFileSync } from 'node:fs';

import { parseRegistry } from '../../frontend/modules/contentPacks/contentPacks.js';
import { nodePackIo } from '../../frontend/modules/contentPacks/nodePackIo.js';
import { preloadDefaultContent } from '../../frontend/modules/procgenPipeline/worldContent.js';

const io = nodePackIo();
const { packs } = parseRegistry(JSON.parse(readFileSync(new URL('packs.json', io.base), 'utf8')));
await preloadDefaultContent({ ...io, ids: [...packs] });
