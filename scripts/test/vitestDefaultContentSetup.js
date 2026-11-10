/**
 * vitestDefaultContentSetup — **EVERY VITEST FILE THAT BUILDS WORLDS FINDS THE
 * DEFAULT CONTENT PACKS PRELOADED** (⛓ CONTENT SETS C4; a `setupFiles` entry of
 * each vitest config).
 *
 * A suite that builds a world through the synchronous `buildRunFromState` (or the
 * engine's growers) reads the default packs its substrates declare from a
 * process-level cache (`worldContent.preloadDefaultContent`). Each test file runs
 * in its own module graph, so this hook preloads them per file, in a `beforeAll`:
 * by then the file's imports have run and its substrate libraries have
 * registered. It shares the file's module instances, so the cache it fills is
 * the one the file's builders read.
 *
 * ⛔ Cost. Most files register no substrate, and none declares a default pack
 * today; the hook imports only the (import-free) registry to ask, and loads
 * `worldContent.js` only when an entry declares one. A file whose registry
 * declares nothing pays one cached import and reads no pack.
 *
 * ⚠ A build at COLLECTION time (in a `describe` callback, or at a module's top
 * level) runs before any `beforeAll`: such a file awaits
 * `preloadDefaultContent(nodePackIo())` itself before it builds (or builds
 * through the async `prepareRunFromState`). The refusal names the call.
 */
import { beforeAll } from 'vitest';

/** The registry-entry field the hook asks about (`worldContent.DEFAULT_CONTENT_PACK_FIELD`; pinned equal). */
export const SETUP_DEFAULT_PACK_FIELD = 'defaultContentPack';

beforeAll(async () => {
    const { substrateRegistry } = await import('../../frontend/modules/shared/procgen/substrateRegistry.js');
    const entries = substrateRegistry?.getAll?.() ?? [];
    if (!entries.some((e) => e?.[SETUP_DEFAULT_PACK_FIELD] !== undefined && e?.[SETUP_DEFAULT_PACK_FIELD] !== null)) return;
    const { preloadDefaultContent } = await import('../../frontend/modules/procgenPipeline/worldContent.js');
    const { nodePackIo } = await import('../../frontend/modules/contentPacks/nodePackIo.js');
    await preloadDefaultContent(nodePackIo());
});
