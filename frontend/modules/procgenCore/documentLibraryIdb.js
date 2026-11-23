// frontend/modules/procgenCore/documentLibraryIdb.js
//
// The IndexedDB backend for `documentLibrary.js`, and THE ONLY FILE in the
// app's own modules that opens an IndexedDB database
// (`documentLibrary.test.js` pins it with a source census).
//
// · LAZY: nothing happens when this module is evaluated. The database is
//   opened on the first transaction, and re-opened after a `versionchange`
//   closed it (another page upgrading or deleting the database).
// · `unavailable`, BY NAME, when there is no `indexedDB` (node, some private
//   modes), when the open fails, or when the database has a NEWER schema than
//   this page knows (a `VersionError`): every transaction then throws
//   `LibraryUnavailableError`, which the library answers as `unavailable`.
// · The schema is built from `LIBRARY_SCHEMA` in `onupgradeneeded`; a later
//   version adds a numbered step there and never rewrites `docs`.
//
// The transaction function awaits ONLY this backend's own request promises,
// which settle inside the transaction's lifetime, so the transaction stays
// active across them. (An `await` on anything else would let it commit early.)

import { DEFAULT_LIBRARY_DB_NAME, LIBRARY_SCHEMA, LibraryUnavailableError } from './documentLibrary.js';

const req2promise = (req) => new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
});

function factoryOf(explicit) {
    if (explicit !== undefined) return explicit;
    return typeof globalThis.indexedDB === 'undefined' ? null : globalThis.indexedDB;
}

function upgrade(db, schema) {
    for (const [name, spec] of Object.entries(schema.stores)) {
        if (db.objectStoreNames.contains(name)) continue;
        const store = db.createObjectStore(name, { keyPath: spec.keyPath });
        for (const [iname, ispec] of Object.entries(spec.indexes)) {
            store.createIndex(iname, ispec.keyPath, { multiEntry: !!ispec.multiEntry });
        }
    }
}

/**
 * @param {{dbName?: string, schema?: object, indexedDB?: IDBFactory|null}} [options]
 */
export function createIdbBackend({ dbName = DEFAULT_LIBRARY_DB_NAME, schema = LIBRARY_SCHEMA, indexedDB } = {}) {
    let dbPromise = null;

    function open() {
        if (dbPromise) return dbPromise;
        const factory = factoryOf(indexedDB);
        if (!factory) return Promise.reject(new LibraryUnavailableError('no indexedDB in this browser context'));
        dbPromise = new Promise((resolve, reject) => {
            let req;
            try {
                req = factory.open(dbName, schema.version);
            } catch (e) {
                reject(new LibraryUnavailableError(`indexedDB.open threw: ${e?.name ?? 'Error'}: ${e?.message ?? e}`));
                return;
            }
            req.onupgradeneeded = () => upgrade(req.result, schema);
            req.onsuccess = () => {
                const db = req.result;
                db.onversionchange = () => {
                    db.close();
                    dbPromise = null;
                };
                resolve(db);
            };
            req.onerror = () => {
                const e = req.error;
                reject(new LibraryUnavailableError(e?.name === 'VersionError'
                    ? 'newer library schema (this page knows an older one)'
                    : `open failed: ${e?.name ?? 'Error'}: ${e?.message ?? e}`));
            };
        });
        dbPromise.catch(() => { dbPromise = null; });
        return dbPromise;
    }

    async function transaction(stores, mode, fn) {
        const db = await open();
        const t = db.transaction(stores, mode);
        const done = new Promise((resolve, reject) => {
            t.oncomplete = () => resolve();
            t.onabort = () => reject(t.error ?? new Error('AbortError: the transaction was aborted'));
            t.onerror = () => { /* the abort that follows carries the error */ };
        });
        done.catch(() => {});
        const tx = {
            get: (s, key) => req2promise(t.objectStore(s).get(key)),
            getAll: (s, query) => {
                const store = t.objectStore(s);
                return req2promise(query ? store.index(query.index).getAll(query.value) : store.getAll());
            },
            put: (s, value) => req2promise(t.objectStore(s).put(value)).then(() => undefined),
            delete: (s, key) => req2promise(t.objectStore(s).delete(key)).then(() => undefined),
        };
        let result;
        try {
            result = await fn(tx);
        } catch (e) {
            try { t.abort(); } catch { /* already finished */ }
            throw e;
        }
        await done;
        return result;
    }

    return {
        kind: 'indexeddb',
        dbName,
        transaction,
        async estimate() {
            const s = globalThis.navigator?.storage;
            if (!s || typeof s.estimate !== 'function') return null;
            const { usage, quota } = await s.estimate();
            return { usage, quota };
        },
        /** Close this backend's connection (a later transaction re-opens it). */
        async close() {
            if (!dbPromise) return;
            const p = dbPromise;
            dbPromise = null;
            try { (await p).close(); } catch { /* it never opened */ }
        },
    };
}

/**
 * Delete a library database, awaited. Resolves `{status: 'deleted', blocked}`
 * (`blocked` = another connection held it open for a while first) or
 * `{status: 'unavailable', why}`; rejects only when the delete itself fails.
 */
export function deleteLibraryDatabase(dbName, { indexedDB } = {}) {
    const factory = factoryOf(indexedDB);
    if (!factory) return Promise.resolve({ status: 'unavailable', why: 'no indexedDB in this browser context' });
    return new Promise((resolve, reject) => {
        let blocked = false;
        const req = factory.deleteDatabase(dbName);
        req.onblocked = () => { blocked = true; };
        req.onsuccess = () => resolve({ status: 'deleted', blocked });
        req.onerror = () => reject(req.error);
    });
}

/**
 * Is a database of this name present? `null` when the browser cannot list
 * databases (`indexedDB.databases` is missing).
 */
export async function libraryDatabaseExists(dbName, { indexedDB } = {}) {
    const factory = factoryOf(indexedDB);
    if (!factory || typeof factory.databases !== 'function') return null;
    const list = await factory.databases();
    return list.some((d) => d.name === dbName);
}
