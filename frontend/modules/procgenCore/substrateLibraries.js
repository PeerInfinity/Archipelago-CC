/**
 * procgenCore/substrateLibraries — **THE ONE LIST OF SUBSTRATE LIBRARIES** a
 * caller with no panels imports to get a populated registry, relative to
 * `frontend/modules/`.
 *
 * Entries self-register as a side effect of importing their library
 * (`substrate-registry.md` § *Registry mechanics*), so this list IS how
 * every headless caller learns which substrates exist:
 *
 *   `apworldEditor/regionGenerationRun.js` `REGENERATE_WORKER_LIBRARIES` (the
 *       regenerate worker)
 *   `scripts/procgen/reference/registry.mjs` `REGISTRY_LIBRARIES` (the docs
 *       generator's capability matrix, and the tests that import it)
 *   `scripts/procgen/registerPipelineSubstrates.js` (the six pipeline drivers
 *       and `list-substrates.js`)
 *
 * Before this module those were three hand-kept copies, and the drivers' copy
 * had six of the ten. `substrateLibraries.test.js` refuses a file that calls
 * `substrateRegistry.register(` and that no entry here reaches.
 *
 * ⚠ `flash` registers as a side effect of `bounceDemo/bounceDemoLibrary.js`,
 * and `flash_seedling_gen` through its BUILD door `flashSeedlingGenBuild.js`
 * (which also installs the generator), not its light library.
 *
 * ⛔ BROWSER-SAFE: no imports, so the worker and the panel can read it.
 */
export const SUBSTRATE_LIBRARIES = Object.freeze([
    'mazeRoom/mazeRoomLibrary.js',
    'bounceDemo/bounceDemoLibrary.js',
    'runnerDemo/runnerDemoLibrary.js',
    'textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js',
    'flashSubstrate/flashSubstrateLibrary.js',
    'flashPanel/flashSeedlingLibrary.js',
    'flashPanel/flashSeedlingGenBuild.js',
    'jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js',
    'omsiSubstrateWrapper/omsiSubstrateWrapperLibrary.js',
    'noiz2saSubstrate/noiz2saSubstrateLibrary.js',
]);
