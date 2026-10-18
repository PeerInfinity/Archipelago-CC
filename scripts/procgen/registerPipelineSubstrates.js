/**
 * registerPipelineSubstrates — the ONE substrate bootstrap the headless
 * pipeline drivers call (§5au item 5). Each library registers its adapter
 * on import; the libraries are the ones
 * `procgenCore/substrateLibraries.js` lists — the same list the regenerate
 * worker and the docs generator read, so a substrate the app registers is a
 * substrate the drivers can name (Seedling and noiz2sa included).
 *
 * Before item 5 each driver kept its own import list and they disagreed:
 * spiral-step registered jta + omsi, sphere-step / dump-sphere-growth did not,
 * topdown-step had maze + bounce only, dump-grid-growth maze + text_adventure.
 * A `--quota jta=…` that worked on one driver threw "unknown substrate" on its
 * neighbour.
 *
 * Loading is a call, not an import side effect, so `--help` does not pay
 * for ten libraries: each driver's `main` awaits
 * `loadPipelineSubstrates()` first. Measured 2026-10-18: all ten add ~0.5–0.8 s
 * to a run over the six item 5 loaded, with byte-identical outputs.
 *
 * A library that cannot load headless is recorded (its error's first line)
 * rather than ending the run: its ids are then absent, and a quota naming
 * one is refused as not registered.
 *
 * Usage (from a driver's main):
 *   import { loadPipelineSubstrates } from './registerPipelineSubstrates.js';
 *   const loads = await loadPipelineSubstrates();
 */

import { SUBSTRATE_LIBRARIES } from '../../frontend/modules/procgenCore/substrateLibraries.js';
import { substrateRegistry } from '../../frontend/modules/shared/procgen/substrateRegistry.js';

let loading = null;

/**
 * Import every library once (memoized).
 * @returns {Promise<ReadonlyArray<{library: string, registered: string[], error: string|null}>>}
 *          one row per library, in manifest order
 */
export function loadPipelineSubstrates() {
    loading ??= (async () => {
        const loads = [];
        for (const library of SUBSTRATE_LIBRARIES) {
            const before = new Set(substrateRegistry.getAll().map((e) => e.id));
            let error = null;
            try {
                // eslint-disable-next-line no-await-in-loop
                await import(new URL(`../../frontend/modules/${library}`, import.meta.url).href);
            } catch (e) {
                error = String(e?.message ?? e).split('\n')[0];
            }
            const registered = substrateRegistry.getAll().map((e) => e.id).filter((id) => !before.has(id));
            loads.push(Object.freeze({ library, registered, error }));
        }
        return Object.freeze(loads);
    })();
    return loading;
}
