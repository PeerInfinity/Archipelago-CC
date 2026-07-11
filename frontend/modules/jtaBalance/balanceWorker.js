/**
 * Pass-B balance Web Worker (Phase 3e).
 *
 * The host (index.js) posts ONE message with structured-cloneable inputs
 * derived from the loaded rules doc + sphereState's raw log; this worker stands
 * up the fork's committed `build/` behind the shared DOM stubs, runs
 * `runBalancePass`, and posts back `{ ok, patches, report }` (plus streamed
 * `{ type: 'progress', ... }` messages). It never touches the player's save:
 * headlessGameEnv stubs `localStorage`, so the solver's throwaway progression
 * writes to a black hole (see headlessGameEnv.js).
 *
 * Module-typed worker: it uses static ESM `import`, and resolves the fork build
 * relative to its OWN url (import.meta.url) — the Node caller (node-env.mjs)
 * resolves via file:// instead, but both funnel through the one shared
 * `loadJtaEnv` so the load-bearing import order lives in exactly one place.
 */

import { loadJtaEnv } from './headlessGameEnv.js';
import { runBalancePass } from './balancePass.js';

// The fork's committed build sits beside this module's parent, under
// journey-to-ascension/build/. Resolve each basename against this worker's URL.
const BUILD_DIR = new URL('../journey-to-ascension/build/', import.meta.url);
const resolveModuleUrl = (name) => new URL(name, BUILD_DIR).href;

// Fired synchronously by the pass at each new frontier reached after a reset.
// Forward as a cloneable progress message so the host can surface pass status.
function postProgress(payload) {
    self.postMessage({ type: 'progress', ...payload });
}

async function handleRun(input) {
    const {
        apLocations, gateCounts, sphereLog, playerId,
        perkItemNames, perkCountSentinel, dataset, seed, options = {},
    } = input;

    // gateCounts crosses the worker boundary as a plain object (cloneable);
    // buildWalkOrder wants a Map<number, count>.
    const gateCountsMap = new Map(
        Object.entries(gateCounts ?? {}).map(([id, count]) => [Number(id), count]),
    );

    const env = await loadJtaEnv(resolveModuleUrl);
    // Synthetic-dataset world (Phase 5e): swap the fork's content tables to
    // the world's dataset BEFORE the walk — same seam as the stats driver
    // (jta-stats driver.mjs) and the bridge. runBalancePass's own
    // initializeHeadless then re-inits against the swapped tables, and
    // estimateResetsToComplete models the dataset for free (it reads live
    // state + task defs). The dataset-keyed save slot writes to the stubbed
    // localStorage black hole, exactly like the vanilla slot.
    if (dataset) {
        if (typeof env.win.loadGameData !== 'function') {
            throw new Error('dataset world but loadGameData is unavailable (fork build predates Fork 1.7)');
        }
        const res = env.win.loadGameData(dataset);
        if (!res?.ok) {
            throw new Error(`loadGameData rejected dataset '${dataset.dataset_id}': `
                + `${(res?.errors ?? []).join('; ')}`);
        }
    }
    const { patches, report } = await runBalancePass({
        env,
        sphereLog: sphereLog ?? [],
        playerId,
        apLocations: apLocations ?? {},
        perkItemNames: perkItemNames ?? [],
        gateCounts: gateCountsMap,
        seed,
        options: { ...options, perkCountSentinel, onProgress: postProgress },
    });

    return { patches, report };
}

self.onmessage = async (event) => {
    const input = event?.data;
    if (!input || input.type === 'progress') return; // ignore echoes / malformed
    try {
        const { patches, report } = await handleRun(input);
        self.postMessage({ ok: true, patches, report });
    } catch (err) {
        self.postMessage({ ok: false, error: err?.message ?? String(err) });
    }
};
