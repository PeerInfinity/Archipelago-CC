/**
 * In-app row for the shared document library's IndexedDB backend
 * (`procgenCore/documentLibraryIdb.js`, lab arc slice B1). Nothing in the app
 * uses the library yet; this row is its one browser check.
 *
 * ⚖ The row SETS its own state and cleans up after itself:
 *   · it uses its OWN database name (never the app's library), and asserts at
 *     its start that no database of that name exists — so a run that died
 *     mid-row is seen by the next start, not inherited;
 *   · it DELETES that database at its end (awaited, `blocked` handled: its own
 *     connections are closed first, and a blocked delete is reported).
 *
 * ⛓ BOTH BOOTS. The library is not in `dist/bundle.js` (nothing the bundle
 * imports names it, and this file is a static import of `init-bundled.js`).
 * So the modules are reached by a computed, document-relative URL — the
 * `regionMapTests.js` `appUrl` pattern — which the bundler leaves alone and
 * the browser fetches raw on either boot.
 */

import { registerTest } from '../testRegistry.js';

const CATEGORY = 'Document library';
const ROW_ID = 'document-library-idb';
/** This row's own database: never the app's library. */
const DB_NAME = `archipelago-cc-document-library-test-${ROW_ID}`;

const appUrl = (rel) => new URL(rel, document.baseURI).href;

async function loadLibraryModules() {
    const [core, idb] = await Promise.all([
        import(/* @vite-ignore */ appUrl('./modules/procgenCore/documentLibrary.js')),
        import(/* @vite-ignore */ appUrl('./modules/procgenCore/documentLibraryIdb.js')),
    ]);
    const { stampIdentity } = await import(/* @vite-ignore */ appUrl('./modules/procgenCore/contentIdentity.js'));
    return { core, idb, stampIdentity };
}

/** Two versions of a small set (generic documents: a set, an overlay, id-less rules). */
function twoVersions(stampIdentity) {
    const set = (rooms) => stampIdentity({ set_id: 'row-set', name: 'Row set', rooms }, { idKey: 'set_id', defaultBase: 'row-set' });
    const overlay = stampIdentity({ overlay_id: 'row-overlay', note: 'shared' }, { idKey: 'overlay_id', defaultBase: 'row-overlay' });
    const v1 = set([{ name: 'a', tiles: [0, 1, 0] }]);
    const v2 = set([{ name: 'a', tiles: [0, 1, 0] }, { name: 'b', tiles: [1, 1, 1] }]);
    const rules = (n) => ({ regions: { start: { exits: n } } });
    const membersOf = (s, n) => [
        { role: 'set', idKey: 'set_id', doc: s },
        { role: 'overlay', idKey: 'overlay_id', doc: overlay },
        { role: 'rules', idKey: null, doc: rules(n) },
    ];
    return { v1, v2, membersOf };
}

export async function documentLibraryIdbRoundTrip(testController) {
    const bundled = !!window.__BUNDLED_TEST_CASES__;
    testController.log(`boot: ${bundled ? 'bundled' : 'unbundled'}; database ${DB_NAME}`);
    let mods = null;
    const backends = [];
    try {
        mods = await loadLibraryModules();
        const { core, idb, stampIdentity } = mods;
        testController.reportCondition('the library modules load by URL on this boot', !!core.createDocumentLibrary && !!idb.createIdbBackend);

        const existed = await idb.libraryDatabaseExists(DB_NAME);
        testController.reportCondition('the browser lists its databases (indexedDB.databases)', existed !== null);
        testController.reportCondition("at the start, the row's database does not exist (the last run deleted it)", existed === false);

        const writerBackend = idb.createIdbBackend({ dbName: DB_NAME });
        backends.push(writerBackend);
        const writer = core.createDocumentLibrary({ backend: writerBackend });
        const empty = await writer.estimate();
        testController.reportCondition('a fresh library is empty (no docs, entries, lineages or holds)',
            empty.status === 'ok' && Object.values(empty.counts).every((n) => n === 0));

        const { v1, v2, membersOf } = twoVersions(stampIdentity);
        const source = { page: 'in-app-test', tab_id: `row-${Date.now()}` };
        const s1 = await writer.saveVersion({ lineageId: null, parent: null, draft: false, savedBecause: 'report',
            substrate: 'in-app-test', source, label: 'Row set', members: membersOf(v1, 1) });
        testController.reportCondition('version 1 saved', s1.status === 'saved' && s1.seq === 1);
        const s2 = await writer.saveVersion({ lineageId: s1.lineage_id, parent: s1.entry_id, draft: false, savedBecause: 'download',
            substrate: 'in-app-test', source, label: 'Row set', members: membersOf(v2, 2) });
        testController.reportCondition('version 2 saved in the same lineage', s2.status === 'saved' && s2.seq === 2 && s2.lineage_id === s1.lineage_id);
        await writerBackend.close();

        // ⛓ A FRESH library over a FRESH connection: what it reads came through IndexedDB, not memory.
        const readerBackend = idb.createIdbBackend({ dbName: DB_NAME });
        backends.push(readerBackend);
        const reader = core.createDocumentLibrary({ backend: readerBackend });
        const r1 = await reader.get({ idKey: 'set_id', docId: v1.set_id, contentHash: v1.provenance.content_hash });
        const r2 = await reader.get({ idKey: 'set_id', docId: v2.set_id, contentHash: v2.provenance.content_hash });
        testController.reportCondition('a fresh library reads version 1 back by its fingerprint', r1.status === 'held'
            && core.canonicalOf(r1.doc, 'set_id') === core.canonicalOf(v1, 'set_id'));
        testController.reportCondition('a fresh library reads version 2 back by its fingerprint', r2.status === 'held'
            && core.canonicalOf(r2.doc, 'set_id') === core.canonicalOf(v2, 'set_id'));
        const wrong = await reader.get({ idKey: 'set_id', docId: v1.set_id, contentHash: v2.provenance.content_hash });
        testController.reportCondition("version 1's id with version 2's fingerprint is absent or a mismatch, never served",
            (wrong.status === 'absent' || wrong.status === 'mismatch') && wrong.doc === undefined);
        let threw = '';
        try { await reader.get({ idKey: 'set_id', docId: v1.set_id }); } catch (e) { threw = `${e.name}:${e.code}`; }
        testController.reportCondition('a get without a fingerprint throws by name', threw === `LibraryReadError:${core.READ_REFUSAL.missingContentHash}`);
        const listed = await reader.entriesOf(s1.lineage_id);
        testController.reportCondition('the lineage lists both versions, in order', listed.status === 'ok'
            && listed.entries.map((e) => e.seq).join(',') === '1,2');
    } catch (error) {
        testController.log(`ERROR: ${error?.stack ?? error}`);
        testController.reportCondition('document library row error-free', false);
    } finally {
        for (const b of backends) { try { await b.close(); } catch { /* best effort */ } }
        if (mods) {
            try {
                const del = await mods.idb.deleteLibraryDatabase(DB_NAME);
                if (del.blocked) testController.log('the delete was blocked for a while by an open connection');
                testController.reportCondition("at the end, the row's database is deleted", del.status === 'deleted');
                const after = await mods.idb.libraryDatabaseExists(DB_NAME);
                testController.reportCondition('…and the browser no longer lists it', after === false);
            } catch (e) {
                testController.log(`delete failed: ${e?.name}: ${e?.message}`);
                testController.reportCondition("at the end, the row's database is deleted", false);
            }
        }
    }
    return testController.getOverallResult();
}

registerTest({
    id: ROW_ID,
    name: 'Document library: two versions saved to IndexedDB read back by fingerprint in a fresh library',
    description: "Its own database, absent at the start; saves version 1 and 2 of a set; a fresh library on a fresh "
               + 'connection reads both by fingerprint and refuses a wrong one; the database is deleted at the end.',
    testFunction: documentLibraryIdbRoundTrip,
    category: CATEGORY,
    enabled: false, // off by default — runs only in the test-substrates mode (batch fast)
});
