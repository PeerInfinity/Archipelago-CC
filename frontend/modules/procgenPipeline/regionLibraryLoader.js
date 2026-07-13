// Region-library loader (region-library F3) — the headless core of loading and
// selecting region libraries, decoupled from any panel chrome. It:
//   - fetches the served index + served library files (frontend/region-libraries/),
//   - parses + validates ad-hoc user files (picker/drag-drop),
//   - runs the substrate capability check when the registry is available,
//   - turns a SELECTION of libraries + per-library quotas into the
//     `substrateQuotas` / `substrateConfig` fragment the shuffled-spiral engine
//     consumes (`library:<id>` content sources).
//
// The `fetch` implementation is injected so this is unit-testable in Node; the
// panel passes the browser `fetch`. Nothing here touches the DOM or localStorage
// — the panel owns persistence (via its _saveToLocalStorage) and rendering.

import { validateRegionLibrary, stampLibraryIdentity } from './regionLibraryValidator.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { librarySourceId } from './procgenPipelineEngine.js';

export const SERVED_LIBRARY_DIR = 'region-libraries';
export const SERVED_LIBRARY_INDEX = 'region_library_files.json';

// A capability check backed by the live substrate registry: each entry's
// substrate adapter (maze/bounce) revalidates its own payload-vs-metadata. Absent
// adapters ⇒ structural-only (the pure validator still runs).
export function registryCapabilityCheck(entry) {
    const adapter = substrateRegistry.get(entry.substrate);
    if (adapter && typeof adapter.validateLibraryEntry === 'function') {
        return adapter.validateLibraryEntry(entry);
    }
    return {};
}

/**
 * Parse + validate a region-library document from raw JSON text (an ad-hoc file
 * load). Optionally restamp first (a hand-authored file with no/stale id).
 * Returns { ok, library, errors, warnings }.
 */
export function parseRegionLibrary(text, { restamp = false, capabilityCheck = registryCapabilityCheck } = {}) {
    let library;
    try {
        library = JSON.parse(text);
    } catch (e) {
        return { ok: false, library: null, errors: [`not valid JSON: ${e.message}`], warnings: [] };
    }
    if (restamp) stampLibraryIdentity(library);
    const res = validateRegionLibrary(library, { entryCapabilityCheck: capabilityCheck });
    return { ok: res.ok, library: res.ok ? library : null, errors: res.errors, warnings: res.warnings };
}

/**
 * Fetch + parse the served library index. `fetchImpl` and `basePath` are injected
 * (the panel passes window.fetch and the app-relative base). Returns the index's
 * `libraries` array (each { file, library_id, name, entry_count, substrates }),
 * or throws on a fetch/parse failure.
 */
export async function loadServedIndex(fetchImpl, basePath = '') {
    const url = `${basePath}${SERVED_LIBRARY_DIR}/${SERVED_LIBRARY_INDEX}`;
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`region-library index fetch failed: ${res.status} ${url}`);
    const idx = await res.json();
    return Array.isArray(idx.libraries) ? idx.libraries : [];
}

/**
 * Fetch + validate one served library file. Returns { ok, library, errors, warnings }.
 */
export async function loadServedLibrary(fetchImpl, file, { basePath = '', capabilityCheck = registryCapabilityCheck } = {}) {
    const url = `${basePath}${SERVED_LIBRARY_DIR}/${file}`;
    const res = await fetchImpl(url);
    if (!res.ok) return { ok: false, library: null, errors: [`fetch failed: ${res.status} ${url}`], warnings: [] };
    const text = await res.text();
    return parseRegionLibrary(text, { capabilityCheck });
}

/**
 * Turn a selection of loaded libraries into the spiral config fragment the engine
 * consumes. Each selected library contributes a `library:<library_id>` quota
 * (its per-library slot count) and a `substrateConfig` entry carrying the
 * document. Merges INTO an existing quotas/config pair (so it composes with a
 * substrate mix like { maze: 2 }).
 *
 * @param selection  Array<{ library, count }>
 * @param base       { substrateQuotas?, substrateConfig? } to merge into
 * @returns          { substrateQuotas, substrateConfig }
 */
export function buildLibrarySpiralConfig(selection, base = {}) {
    const substrateQuotas = { ...(base.substrateQuotas ?? {}) };
    const substrateConfig = { ...(base.substrateConfig ?? {}) };
    for (const { library, count } of selection) {
        if (!library?.library_id || !(count > 0)) continue;
        const id = librarySourceId(library.library_id);
        substrateQuotas[id] = count;
        substrateConfig[id] = { ...(substrateConfig[id] ?? {}), libraryDoc: library };
    }
    return { substrateQuotas, substrateConfig };
}

/**
 * Whether a quota id is a library source whose document is present in the config
 * — the predicate the panel's substrate filter must consult so a `library:<id>`
 * quota is NOT dropped as an "unregistered substrate" (it has no registry entry;
 * its document rides substrateConfig). Complements substrateRegistry.has().
 */
export function isLoadedLibrarySource(id, substrateConfig = {}) {
    return typeof id === 'string' && id.startsWith('library:') && substrateConfig[id]?.libraryDoc != null;
}
