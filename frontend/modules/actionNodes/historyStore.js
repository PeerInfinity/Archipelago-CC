/**
 * actionNodes/historyStore — **THE PER-WORLD "COMPLETED BEFORE" SAVE** (AN-TIME-2, ⚖ Robert's Q6, minimal form).
 *
 * The runtime keeps, per world, the loop each node was first performed in and the current loop number
 * (`ActionNodesRuntime._saveHistory`: `{version: 1, loop, progressed, completed: {<node id>: <loop>}}`). This is the
 * `env.historyStore` index.js injects: one localStorage key per world, `actionNodesHistory_v1_<graph>:<seed>:<slot>`
 * (`historyKeyOf`), declared in `moduleInfo.storage`. A failed write is reported (`reportStorageWriteFailure`) and the
 * runtime keeps the set in memory; a missing or unreadable entry is an empty history.
 */

import { reportStorageWriteFailure } from '../../app/core/storageQuota.js';

/** The localStorage key family (declared in index.js's `moduleInfo.storage`). */
export const HISTORY_STORAGE_PREFIX = 'actionNodesHistory_v1_';

/**
 * A history store over `storage` (default: the page's localStorage).
 * @param {Storage|null} [storage]
 * @returns {{load: (key: string) => object|null, save: (key: string, data: object) => void}}
 */
export function createHistoryStore(storage = globalThis.localStorage ?? null) {
    return {
        load(key) {
            try {
                const raw = storage?.getItem(HISTORY_STORAGE_PREFIX + key);
                return raw ? JSON.parse(raw) : null;
            } catch {
                return null;
            }
        },
        save(key, data) {
            const value = JSON.stringify(data);
            try {
                storage?.setItem(HISTORY_STORAGE_PREFIX + key, value);
            } catch (error) {
                reportStorageWriteFailure({ key: HISTORY_STORAGE_PREFIX + key, value, error, owner: 'Action Nodes history' });
            }
        },
    };
}
