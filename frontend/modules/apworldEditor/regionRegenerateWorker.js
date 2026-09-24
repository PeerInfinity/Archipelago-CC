/**
 * apworldEditor/regionRegenerateWorker — the MODULE WORKER the hub's Region
 * generation form runs ONE `regenerateRegionEntry` in (APWORLD SUBSTRATE CHANGE
 * R2). The protocol and the budget live in `regionGenerationRun.js`; this file
 * is the shell: import the substrate libraries into the worker's own (empty)
 * registry, then answer the job.
 *
 * ⛓ A worker cannot be bundled into `bundle.js`: `scripts/build/bundle-frontend.js`
 * copies this file, and in bundled mode the page resolves it at its SOURCE
 * location (`resolveRegenerateWorkerUrl`), where its relative imports resolve.
 */

import { REGENERATE_WORKER_LIBRARIES, runRegenerateJob } from './regionGenerationRun.js';

let loaded = null;

/** Import every library once, recording what each registered and which refused. */
function loadLibraries() {
    if (!loaded) {
        loaded = (async () => {
            const { substrateRegistry } = await import('../shared/procgen/substrateRegistry.js');
            const failed = [];
            for (const library of REGENERATE_WORKER_LIBRARIES) {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    await import(new URL(`../${library}`, import.meta.url).href);
                } catch (e) {
                    failed.push({ library, error: String(e?.message ?? e).split('\n')[0] });
                }
            }
            const { regenerateRegionEntry } = await import('./regionRegenerate.js');
            // ⛓ R5b — a ZONE source replaces the region's content; the install it
            //   needs is module-global, which is why it runs HERE and never on the page.
            const { zoneJobAnswer } = await import('./regionContent.js');
            return {
                registered: substrateRegistry.getAll().map((e) => e.id),
                failed,
                regenerate: (args) => (args?.source?.kind === 'zone' ? zoneJobAnswer(args) : regenerateRegionEntry(args)),
            };
        })();
    }
    return loaded;
}

self.onmessage = async (ev) => {
    const msg = ev?.data ?? {};
    if (msg.type !== 'run') return;
    let libs = null;
    await runRegenerateJob(msg.args, {
        post: (m) => self.postMessage(m),
        loadLibraries: async () => {
            libs = await loadLibraries();
            return { registered: libs.registered, failed: libs.failed };
        },
        regenerate: (args) => libs.regenerate(args),
    });
};
