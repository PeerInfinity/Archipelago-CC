// frontend/modules/procgenCore/documentLibraryMemory.js
//
// An IN-MEMORY backend for `documentLibrary.js`, with the transaction
// semantics the library relies on from IndexedDB:
//
//   · transactions are SERIALISED (one at a time, in the order they were
//     asked for), so a read-then-write inside one transaction is atomic
//     against every other library instance sharing this backend — two
//     "tabs" are two `createDocumentLibrary` calls over one backend;
//   · a transaction is ALL OR NOTHING: its writes land only when its function
//     resolves, and a throw discards every one of them;
//   · values are STRUCTURED-CLONED on the way in and on the way out, so a
//     caller that edits an object after `put` (or after a read) changes
//     nothing stored;
//   · a transaction touches only the stores it named, and a `readonly` one
//     cannot write.
//
// No dependency: this is what the vitest rows run on (no `fake-indexeddb`).
// Test hooks: `failNextCommit(error)` (a write the browser refuses, e.g.
// quota), `unavailable(why)` (no database), `raw(store)` (the stored Map,
// for a row that edits a body behind the library's back).

import { LIBRARY_SCHEMA, LibraryUnavailableError } from './documentLibrary.js';

const clone = (v) => (v === undefined ? undefined : structuredClone(v));

export function createMemoryBackend({ schema = LIBRARY_SCHEMA } = {}) {
    const data = new Map(Object.keys(schema.stores).map((s) => [s, new Map()]));
    let queue = Promise.resolve();
    let pendingFailure = null;
    let unavailableWhy = null;

    function storeSpec(name) {
        const spec = schema.stores[name];
        if (!spec) throw new Error(`NotFoundError: no object store "${name}"`);
        return spec;
    }

    function indexMatches(value, indexSpec, wanted) {
        const v = value[indexSpec.keyPath];
        if (indexSpec.multiEntry && Array.isArray(v)) return v.includes(wanted);
        return v === wanted;
    }

    async function runOne(stores, mode, fn) {
        if (unavailableWhy !== null) throw new LibraryUnavailableError(unavailableWhy);
        const scope = new Set(stores);
        for (const s of scope) storeSpec(s);
        /** store → Map(key → value | DELETED): this transaction's writes, unseen by others until commit. */
        const staged = new Map();
        const DELETED = Symbol('deleted');
        const inScope = (s) => {
            if (!scope.has(s)) throw new Error(`NotFoundError: store "${s}" is not in this transaction's scope`);
        };
        const writable = () => {
            if (mode !== 'readwrite') throw new Error('ReadOnlyError: the transaction is readonly');
        };
        const view = (s) => {
            const merged = new Map(data.get(s));
            for (const [k, v] of staged.get(s) ?? []) {
                if (v === DELETED) merged.delete(k);
                else merged.set(k, v);
            }
            return merged;
        };
        const tx = {
            async get(s, key) {
                inScope(s);
                return clone(view(s).get(key));
            },
            async getAll(s, query) {
                inScope(s);
                const all = [...view(s).values()];
                if (!query) return all.map(clone);
                const idx = storeSpec(s).indexes[query.index];
                if (!idx) throw new Error(`NotFoundError: no index "${query.index}" on "${s}"`);
                return all.filter((v) => indexMatches(v, idx, query.value)).map(clone);
            },
            async put(s, value) {
                inScope(s);
                writable();
                const key = value[storeSpec(s).keyPath];
                if (typeof key !== 'string') throw new Error(`DataError: "${s}" key must be a string`);
                if (!staged.has(s)) staged.set(s, new Map());
                staged.get(s).set(key, clone(value));
            },
            async delete(s, key) {
                inScope(s);
                writable();
                if (!staged.has(s)) staged.set(s, new Map());
                staged.get(s).set(key, DELETED);
            },
        };
        const result = await fn(tx);
        if (mode === 'readwrite' && pendingFailure) {
            const e = pendingFailure;
            pendingFailure = null;
            throw e;
        }
        for (const [s, writes] of staged) {
            const target = data.get(s);
            for (const [k, v] of writes) {
                if (v === DELETED) target.delete(k);
                else target.set(k, v);
            }
        }
        return result;
    }

    return {
        kind: 'memory',
        transaction(stores, mode, fn) {
            const p = queue.then(() => runOne(stores, mode, fn));
            queue = p.catch(() => {});
            return p;
        },
        async estimate() {
            return null;
        },
        /** Test hook: the next readwrite commit fails with `error` (nothing it wrote lands). */
        failNextCommit(error) {
            pendingFailure = error;
        },
        /** Test hook: every transaction answers unavailable (`null` restores). */
        unavailable(why) {
            unavailableWhy = why;
        },
        /** Test hook: the stored Map of one store (edit it to corrupt a row behind the library). */
        raw(store) {
            storeSpec(store);
            return data.get(store);
        },
    };
}
