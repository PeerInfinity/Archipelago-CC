/**
 * watchLibraryEngine — the Seedling lab's library writer, assembled: the member builder
 * (`watchLibraryMembers`), the save queue (`watchLibraryCore`) and the document library over a
 * backend (IndexedDB by default). It runs inside `watchLibraryWorker.js`, so a save point's
 * report + stamp + canonicalise + hash (~650 ms on the vanilla 116, measured) never blocks the page
 * (js-22 L3), and in-process where no module worker exists.
 *
 * ⛓ `failNext` is the browser rows' storage-failure seam: the NEXT library transaction is refused
 * with an error of that name (`QuotaExceededError` for "storage full"), exactly as a browser refuses
 * a commit. The library turns it into its `failed` answer; nothing else changes.
 */
import { createDocumentLibrary } from '../procgenCore/documentLibrary.js';
import { createIdbBackend } from '../procgenCore/documentLibraryIdb.js';
import { createSaveQueue, LIBRARY_SUBSTRATE } from './watchLibraryCore.js';
import { librarySaveOf, membersContextOf } from './watchLibraryMembers.js';

/** A backend whose next transaction can be made to fail, by error name. */
export function failableBackend(backend) {
    let failNext = null;
    return {
        ...backend,
        failNext(name) { failNext = name; },
        async transaction(stores, mode, fn) {
            if (failNext !== null) {
                const e = new Error(`the browser refused the commit (test seam: ${failNext})`);
                e.name = failNext;
                failNext = null;
                throw e;
            }
            return backend.transaction(stores, mode, fn);
        },
    };
}

/**
 * @param {{dbName?: string, backend?: object, schemas?: object, source: {page, tab_id}, substrate?: string}} o
 */
export function createLibraryEngine({ dbName, backend = null, schemas = {}, source, substrate = LIBRARY_SUBSTRATE }) {
    const store = failableBackend(backend ?? createIdbBackend({ dbName }));
    const library = createDocumentLibrary({ backend: store });
    const ctx = membersContextOf(schemas);
    const queue = createSaveQueue({
        library,
        membersOf: (record, kind) => librarySaveOf(record, kind, ctx),
        substrate,
        source,
    });
    return {
        start: (session) => queue.start(session),
        save({ record, kind, savedBecause = null, failNext = null }) {
            if (failNext) store.failNext(failNext);
            return queue.save({ record, kind, savedBecause });
        },
        state: () => queue.state(),
        close: () => store.close?.(),
    };
}
