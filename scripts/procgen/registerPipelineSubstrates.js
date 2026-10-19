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
 * one is refused as not registered (`checkSubstrateIds`).
 *
 * Usage (from a driver's main):
 *   import { loadPipelineSubstrates } from './registerPipelineSubstrates.js';
 *   const loads = await loadPipelineSubstrates();
 */

import { SUBSTRATE_LIBRARIES } from '../../frontend/modules/procgenCore/substrateLibraries.js';
import { substrateRegistry } from '../../frontend/modules/shared/procgen/substrateRegistry.js';
import { pipelineLayoutsOf } from '../../frontend/modules/procgenCore/substratePredicates.js';
import { isLibrarySourceId } from '../../frontend/modules/procgenPipeline/procgenPipelineEngine.js';
import { UsageError } from './cliRun.js';

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

/**
 * ⛓ Refuse, as usage (exit 1) and before any work runs, a substrate id the
 * argv names that is not registered or that the driver's layout cannot place
 * (`pipelineLayoutsOf`) — the engine's own refusal, said first and naming
 * the flag and the substrates that DO fit. A `library:<id>` source, a count of
 * 0, and a start of `auto` / null pass through to the engine as before.
 * @param {object} opts the parsed flags
 * @param {{layout: string, tool: string, counts?: Record<string, string>, start?: string|null}} how
 *        `counts`: opts key → flag (`{quotas: '--quota'}`); `start`: the opts key of the start id
 */
export function checkSubstrateIds(opts, { layout, tool, counts = {}, start = null }) {
    const all = substrateRegistry.getAll();
    const fits = all.filter((e) => pipelineLayoutsOf(e).includes(layout)).map((e) => e.id);
    const check = (id, what) => {
        if (isLibrarySourceId(id)) return;
        if (!substrateRegistry.has(id)) {
            throw new UsageError(`${what}: '${id}' is not a registered substrate (registered: ${all.map((e) => e.id).join(', ')})`);
        }
        if (!fits.includes(id)) {
            throw new UsageError(`${what}: ${tool} cannot place '${id}' (the ${layout} layout places: ${fits.join(', ')}; `
                + 'see list-substrates.js)');
        }
    };
    for (const [key, flagName] of Object.entries(counts)) {
        // ⛓ named by key AND flag: the id may have come from a `--config` file
        for (const [id, n] of Object.entries(opts[key] ?? {})) if (n > 0) check(id, `${key}.${id}=${n} (${flagName})`);
    }
    const s = start ? opts[start] : null;
    if (s != null && s !== 'auto') check(s, `${start}=${s} (--start)`);
}
