/**
 * preloadContent — **THE DEFAULT CONTENT PACKS, FOR A HEADLESS PROCESS**
 * (⛓ CONTENT SETS C4).
 *
 * A script that builds worlds SYNCHRONOUSLY (`buildRunFromState`, the engine's
 * growers, a fixed-config check) reads the default packs its substrates declare
 * from a process-level cache (`worldContent.preloadDefaultContent`), so it awaits
 * this ONCE, after its substrate libraries have registered and before it builds.
 * With no entry declaring a default pack it reads nothing (a no-op).
 *
 * The pipeline drivers get it from `loadPipelineSubstrates()`; a script that
 * registers its libraries itself calls it on the line after.
 *
 * ⛔ NODE ONLY (`nodePackIo` reads the committed `frontend/packs/` from disk).
 */
import { preloadDefaultContent } from '../../frontend/modules/procgenPipeline/worldContent.js';
import { nodePackIo } from '../../frontend/modules/contentPacks/nodePackIo.js';

/** Await `preloadDefaultContent(nodePackIo())`; returns the preloaded pack ids. */
export function preloadScriptContent() {
    return preloadDefaultContent(nodePackIo());
}
