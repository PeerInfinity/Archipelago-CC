// ExecutionSnapshot - frozen copy of a queue for execution, with runtime state tracking
// The "current list" in the dual-queue pattern (next list = ActionQueue, current list = this)
import { ActionState } from './actionTypes.js';

/**
 * @typedef {object} RuntimeStatus
 * @property {string} entryId
 * @property {ActionState} state
 * @property {number} loopsCompleted
 * @property {string} [error]
 */

export class ExecutionSnapshot {
    /** @type {import('./actionTypes.js').QueueEntry[]} */
    #entries = [];

    /** @type {Map<string, RuntimeStatus>} */
    #statuses = new Map();

    /** @type {number} */
    #cursor = 0;

    /** @type {boolean} */
    #running = false;

    /**
     * Create a snapshot from an ActionQueue's current entries
     * @param {import('./actionQueue.js').ActionQueue} queue
     */
    static fromQueue(queue) {
        const snapshot = new ExecutionSnapshot();
        for (const entry of queue.getEntries()) {
            if (entry.disabled) continue; // skip disabled entries entirely
            snapshot.#entries.push({ ...entry });
            snapshot.#statuses.set(entry.entryId, {
                entryId: entry.entryId,
                state: ActionState.PENDING,
                loopsCompleted: 0,
            });
        }
        return snapshot;
    }

    /** @returns {import('./actionTypes.js').QueueEntry[]} */
    getEntries() {
        return [...this.#entries];
    }

    /** @returns {number} */
    get length() {
        return this.#entries.length;
    }

    /** @returns {number} */
    get cursor() {
        return this.#cursor;
    }

    /** @returns {boolean} */
    get running() {
        return this.#running;
    }

    set running(value) {
        this.#running = !!value;
    }

    /**
     * @returns {import('./actionTypes.js').QueueEntry|null}
     */
    currentEntry() {
        if (this.#cursor >= this.#entries.length) return null;
        return this.#entries[this.#cursor];
    }

    /**
     * @param {string} entryId
     * @returns {RuntimeStatus|undefined}
     */
    getStatus(entryId) {
        return this.#statuses.get(entryId);
    }

    /**
     * @param {string} entryId
     * @param {Partial<RuntimeStatus>} update
     */
    updateStatus(entryId, update) {
        const status = this.#statuses.get(entryId);
        if (!status) return;
        Object.assign(status, update);
    }

    /**
     * Advance cursor to the next entry (all disabled entries were already filtered out)
     * @returns {import('./actionTypes.js').QueueEntry|null}
     */
    advance() {
        this.#cursor++;
        if (this.#cursor < this.#entries.length) {
            return this.#entries[this.#cursor];
        }
        return null;
    }

    /**
     * Reset to beginning
     */
    reset() {
        this.#cursor = 0;
        this.#running = false;
        for (const status of this.#statuses.values()) {
            status.state = ActionState.PENDING;
            status.loopsCompleted = 0;
            status.error = undefined;
        }
    }

    /** @returns {boolean} */
    isExhausted() {
        return this.#cursor >= this.#entries.length;
    }
}
