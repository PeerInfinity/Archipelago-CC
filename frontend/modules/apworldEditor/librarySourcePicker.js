/**
 * apworldEditor/librarySourcePicker — **THE SERVED REGION-LIBRARY PACKS, AS
 * THE REGION GENERATION FORM'S "LIBRARY ENTRY" PICKER** (APWORLD SUBSTRATE
 * CHANGE R5a, plan §12).
 *
 * The page fetches the served index ONCE (memoised per page), then each pack
 * file on demand, through the pipeline's own loader (`regionLibraryLoader.js`:
 * `loadServedIndex` / `loadServedLibrary`, which validates each pack and runs
 * the registry's capability check). The picker offers the entries whose
 * `substrate` is the target; an entry the op would REFUSE for this region is
 * shown disabled with the op's own sentence (1305: the op is the authority,
 * the picker a courtesy). A fetch failure is a SENTENCE, never a throw.
 *
 * ⛔ No substrate is named here: which packs apply is the served index's
 * `substrates`; which entries, each entry's `substrate`.
 */

import { loadServedIndex, loadServedLibrary } from '../procgenPipeline/regionLibraryLoader.js';
import { REGION_SOURCE_KINDS } from './regionRegenerate.js';
import { regenerateOpRefusal } from './rulesDocOps.js';

/**
 * ⛓ The base the served `region-libraries/` directory resolves against — the
 * pipeline panel's rule, copied (`procgenPipelineUI.js` `_libraryBasePath()`,
 * which returns `'./'`: page-relative, so it holds under a sub-path deploy).
 * The hub imports no panel, so the rule is restated here, named.
 */
export const LIBRARY_BASE_PATH = './';

/**
 * ⛓ A catalog over one fetch implementation: `index()` and `pack(file)`, both
 * MEMOISED (a failed fetch is forgotten, so the next open retries).
 *
 * @param {{fetchImpl: Function, basePath?: string}} o
 */
export function createServedLibraryCatalog({ fetchImpl, basePath = LIBRARY_BASE_PATH }) {
    let index = null;
    const packs = new Map();
    const forgetOnFailure = (promise, forget) => {
        promise.catch(forget);
        return promise;
    };
    return {
        fetches: 0,
        index() {
            if (!index) {
                this.fetches += 1;
                index = forgetOnFailure(loadServedIndex(fetchImpl, basePath), () => { index = null; });
            }
            return index;
        },
        pack(file) {
            if (!packs.has(file)) {
                this.fetches += 1;
                packs.set(file, forgetOnFailure(loadServedLibrary(fetchImpl, file, { basePath }).then((res) => {
                    if (!res.ok) throw new Error(`pack '${file}': ${res.errors.join('; ')}`);
                    return res.library;
                }), () => { packs.delete(file); }));
            }
            return packs.get(file);
        },
    };
}

let pageCatalog = null;

/** ⛓ The page's ONE catalog, over the page's `fetch`. */
export function servedLibraryCatalog() {
    if (!pageCatalog) pageCatalog = createServedLibraryCatalog({ fetchImpl: (...a) => globalThis.fetch(...a) });
    return pageCatalog;
}

/** ⛓ The sentence a failed fetch prints in the form. EXPORTED for the rows. */
export const LIBRARY_FETCH_FAILED = 'the served region-library packs could not be loaded';

export function libraryFetchFailureSentence(err) {
    return `apworld: ${LIBRARY_FETCH_FAILED} (${String(err?.message ?? err)}) — Generate still works; `
        + 'reload the page to try the packs again.';
}

/** ⛓ `Crossroads · 3 slots · exit sides N,E,S,W` — what one option says. */
export function libraryOptionLabel(entry) {
    const slots = Number.isInteger(entry?.location_slots) ? entry.location_slots : '?';
    const sides = Array.isArray(entry?.exit_sides) ? entry.exit_sides.join(',') : '?';
    return `${entry?.name ?? entry?.entry_id} · ${slots} slot${slots === 1 ? '' : 's'} · exit sides ${sides}`;
}

/** ⛓ The `source` the op carries for one pack entry — the entry INLINED. */
export function librarySourceFor(pack, entry) {
    return { kind: REGION_SOURCE_KINDS.LIBRARY, library_id: pack.library_id, entry_id: entry.entry_id, entry };
}

/**
 * ⛓⛓ **THE OPTIONS FOR `region` → `target`**, over already-loaded packs: every
 * entry whose `substrate` is the target, in pack then entry order; `disabled`
 * with the op's own refusal as `reason` when the op would refuse it here.
 *
 * @returns {Array<{value: string, library_id: string, pack_name: string,
 *   entry_id: string, label: string, disabled: boolean, reason: string|null,
 *   source: object}>}
 */
export function libraryPickerOptions(doc, player, region, target, packs) {
    const out = [];
    for (const pack of packs) {
        for (const entry of pack?.entries ?? []) {
            if (entry?.substrate !== target) continue;
            const source = librarySourceFor(pack, entry);
            const reason = regenerateOpRefusal(doc, {
                op: 'regenerate-region-sidecar', player, region, substrate: target, source,
            });
            out.push({
                value: `${pack.library_id}|${entry.entry_id}`,
                library_id: pack.library_id,
                pack_name: pack.name ?? pack.library_id,
                entry_id: entry.entry_id,
                label: libraryOptionLabel(entry),
                disabled: !!reason,
                reason,
                source,
            });
        }
    }
    return out;
}

/**
 * ⛓⛓ **LOAD THE PICKER** for `region` → `target` through `catalog`: the index,
 * then the packs whose `substrates` include the target. Never throws.
 *
 * @returns {Promise<{ok: true, options: object[], packs: number}
 *                  | {ok: false, error: string}>}
 */
export async function loadLibraryOptions(catalog, doc, player, region, target) {
    try {
        const index = await catalog.index();
        const rows = index.filter((row) => Array.isArray(row?.substrates) && row.substrates.includes(target));
        const packs = await Promise.all(rows.map((row) => catalog.pack(row.file)));
        return { ok: true, options: libraryPickerOptions(doc, player, region, target, packs), packs: packs.length };
    } catch (e) {
        return { ok: false, error: libraryFetchFailureSentence(e) };
    }
}
