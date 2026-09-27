/**
 * Wrap an in-app row that records saved queues so it leaves the person's saved
 * queues (`loops:savedQueues:v1`) exactly as it found them.
 *
 * The store keeps ONE key for every rules hash, region and substrate, so a
 * test-scoped key is not available; the rows' own buckets are keyed by a
 * generated world's rules hash, but a snapshot of the raw string is the one
 * restore that cannot delete an entry the person made. Measured (plan §39): the
 * substrates `fast` batch left four buckets behind from these rows before.
 * ⚖ RULED (2026-09-26): every row cleans up after itself.
 */
import { _testOnly_restoreRaw, _testOnly_snapshotRaw } from '../loops/savedQueueStore.js';

export function restoresSavedQueues(testFunction) {
    const wrapped = async function (testController) {
        const raw = _testOnly_snapshotRaw();
        try {
            return await testFunction(testController);
        } finally {
            _testOnly_restoreRaw(raw);
        }
    };
    Object.defineProperty(wrapped, 'name', { value: testFunction.name });
    return wrapped;
}
