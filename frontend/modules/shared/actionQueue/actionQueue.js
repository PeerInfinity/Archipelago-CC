// ActionQueue - ordered list of actions with cursor, status tracking, and serialization
import { ActionState, generateEntryId } from './actionTypes.js';

export class ActionQueue {
    /** @type {import('./actionTypes.js').QueueEntry[]} */
    #entries = [];

    /** @type {Map<string, import('./actionTypes.js').ActionStatus>} */
    #statuses = new Map();

    /** @type {number} Index of the currently executing entry */
    #cursor = 0;

    /** @type {boolean} */
    #running = false;

    /**
     * @returns {import('./actionTypes.js').QueueEntry[]} Shallow copy of entries
     */
    getEntries() {
        return [...this.#entries];
    }

    /**
     * @returns {number}
     */
    get length() {
        return this.#entries.length;
    }

    /**
     * @returns {number}
     */
    get cursor() {
        return this.#cursor;
    }

    /**
     * @returns {boolean}
     */
    get running() {
        return this.#running;
    }

    set running(value) {
        this.#running = !!value;
    }

    /**
     * Get the entry currently under the cursor, or null if queue is exhausted
     * @returns {import('./actionTypes.js').QueueEntry|null}
     */
    currentEntry() {
        if (this.#cursor >= this.#entries.length) return null;
        return this.#entries[this.#cursor];
    }

    /**
     * Add an entry to the end of the queue
     * @param {Partial<import('./actionTypes.js').QueueEntry>} entry
     * @returns {import('./actionTypes.js').QueueEntry} The created entry
     */
    add(entry) {
        const full = {
            entryId: entry.entryId || generateEntryId(),
            actionType: entry.actionType,
            actionId: entry.actionId,
            label: entry.label || '',
            group: entry.group || '',
            loops: entry.loops ?? 1,
            disabled: entry.disabled ?? false,
        };
        this.#entries.push(full);
        this.#statuses.set(full.entryId, {
            entryId: full.entryId,
            state: ActionState.PENDING,
            loopsCompleted: 0,
        });
        return full;
    }

    /**
     * Remove an entry by entryId
     * @param {string} entryId
     * @returns {boolean}
     */
    remove(entryId) {
        const idx = this.#entries.findIndex(e => e.entryId === entryId);
        if (idx === -1) return false;
        this.#entries.splice(idx, 1);
        this.#statuses.delete(entryId);
        // Adjust cursor if needed
        if (idx < this.#cursor) {
            this.#cursor--;
        }
        return true;
    }

    /**
     * Move an entry from one index to another
     * @param {number} fromIndex
     * @param {number} toIndex
     */
    reorder(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.#entries.length) return;
        if (toIndex < 0 || toIndex >= this.#entries.length) return;
        const [entry] = this.#entries.splice(fromIndex, 1);
        this.#entries.splice(toIndex, 0, entry);
    }

    /**
     * Get the status of an entry
     * @param {string} entryId
     * @returns {import('./actionTypes.js').ActionStatus|undefined}
     */
    getStatus(entryId) {
        return this.#statuses.get(entryId);
    }

    /**
     * Update the status of the current entry
     * @param {string} entryId
     * @param {Partial<import('./actionTypes.js').ActionStatus>} update
     */
    updateStatus(entryId, update) {
        const status = this.#statuses.get(entryId);
        if (!status) return;
        Object.assign(status, update);
    }

    /**
     * Advance the cursor to the next non-disabled entry.
     * Marks skipped disabled entries.
     * @returns {import('./actionTypes.js').QueueEntry|null} Next entry, or null if exhausted
     */
    advance() {
        this.#cursor++;
        while (this.#cursor < this.#entries.length) {
            const entry = this.#entries[this.#cursor];
            if (!entry.disabled) {
                return entry;
            }
            this.updateStatus(entry.entryId, { state: ActionState.SKIPPED });
            this.#cursor++;
        }
        return null;
    }

    /**
     * Reset the queue: move cursor to 0, reset all statuses to PENDING
     */
    reset() {
        this.#cursor = 0;
        this.#running = false;
        for (const status of this.#statuses.values()) {
            status.state = ActionState.PENDING;
            status.loopsCompleted = 0;
            status.error = undefined;
        }
        // Skip initial disabled entries
        if (this.#entries.length > 0 && this.#entries[0].disabled) {
            this.updateStatus(this.#entries[0].entryId, { state: ActionState.SKIPPED });
            this.advance();
        }
    }

    /**
     * Clear all entries and statuses
     */
    clear() {
        this.#entries = [];
        this.#statuses.clear();
        this.#cursor = 0;
        this.#running = false;
    }

    /**
     * Check if the queue is exhausted (cursor past end)
     * @returns {boolean}
     */
    isExhausted() {
        return this.#cursor >= this.#entries.length;
    }

    /**
     * Serialize to a plain object for storage
     * @returns {object}
     */
    serialize() {
        return {
            entries: this.#entries.map(e => ({ ...e })),
        };
    }

    /**
     * Load from serialized data
     * @param {object} data
     */
    deserialize(data) {
        this.clear();
        if (data && Array.isArray(data.entries)) {
            for (const entry of data.entries) {
                this.add(entry);
            }
        }
    }
}
