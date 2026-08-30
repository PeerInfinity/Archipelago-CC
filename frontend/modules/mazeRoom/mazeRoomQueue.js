/**
 * Maze room action queue. Tile-level action queue for the maze
 * substrate panel (Cavernous-2-style icon-row UI). See
 * docs/json/developer/procgen/maze.md ("The action queue").
 *
 * Verbs:
 *   - move (N/E/S/W) — also covers block pushes (side effect via a
 *     content module's onMove hook in a later phase).
 *   - wait — spends one tick (no movement). Spacebar input.
 *   - locationCheck — explicit location check at the current tile.
 *     Used by saved/replayed queues and by loops-delegation expansion;
 *     direct keypresses don't usually emit this verb (location checks
 *     fire as a side effect of stepping onto a location tile).
 *
 * Execution model: synchronous. handleInput() may immediately invoke
 * the injected executor when in append-and-execute mode (cursor at
 * tail, the appended action is the next to run). The replay path
 * (saved best-queues) drives execution via stepOne() on its own
 * clock — that's the only async surface.
 *
 * Execution vs edit cursors:
 *   - executionIndex: index of the next action to run. Equals
 *     queue.length when idle / done.
 *   - editCursor: where inserts land. null = "tail" (the default).
 *     Set by clicking between icons in the UI. Can't be placed in
 *     the done region (clamped to >= executionIndex).
 *
 * No per-action progress field: tile moves are instant, so there's
 * no fractional progress to track (unlike loops queue which gates
 * on mana cost over time).
 */

export const ACTION_MOVE = 'move';
export const ACTION_WAIT = 'wait';
export const ACTION_LOCATION_CHECK = 'locationCheck';

export const ACTION_TYPES = [
    ACTION_MOVE,
    ACTION_WAIT,
    ACTION_LOCATION_CHECK,
];

export const STATUS_PENDING = 'pending';
export const STATUS_DONE = 'done';

export const DIRECTIONS = ['N', 'E', 'S', 'W'];

let _nextId = 1;

function nextId() {
    return _nextId++;
}

// Test-only: reset the id counter for deterministic tests.
export function _testOnly_resetIdCounter() {
    _nextId = 1;
}

/**
 * Build a fresh pending action object from a spec. Throws on
 * invalid type / direction; spec is the public-facing shape, with
 * status/id added by the queue.
 *
 * @param {object} spec
 * @param {'move'|'wait'|'locationCheck'} spec.type
 * @param {'N'|'E'|'S'|'W'} [spec.dir] - required when type === 'move'
 * @param {string} [spec.locationName] - required when type === 'locationCheck'
 * @returns {object} action object
 */
export function makeAction(spec) {
    if (!spec || typeof spec !== 'object') {
        throw new Error('makeAction: spec must be an object');
    }
    if (!ACTION_TYPES.includes(spec.type)) {
        throw new Error(`makeAction: unknown action type "${spec.type}"`);
    }
    if (spec.type === ACTION_MOVE && !DIRECTIONS.includes(spec.dir)) {
        throw new Error(`makeAction: move requires dir N/E/S/W, got "${spec.dir}"`);
    }
    if (spec.type === ACTION_LOCATION_CHECK && typeof spec.locationName !== 'string') {
        throw new Error('makeAction: locationCheck requires locationName');
    }
    const action = {
        id: nextId(),
        type: spec.type,
        status: STATUS_PENDING,
    };
    if (spec.dir !== undefined) action.dir = spec.dir;
    if (spec.locationName !== undefined) action.locationName = spec.locationName;
    return action;
}

export class MazeRoomQueue {
    /**
     * @param {object} [opts]
     * @param {(action: object) => void} [opts.executor] - Called
     *   synchronously when an action runs. Performs the side effects
     *   (engine.step, dispatcher.publish, etc.). Defaults to a no-op
     *   so the queue is usable headless in tests.
     */
    constructor(opts = {}) {
        this._executor = typeof opts.executor === 'function' ? opts.executor : () => {};
        this.actions = [];
        this.executionIndex = 0;
        this.editCursor = null;
        this._listeners = new Set();
    }

    // --- State queries ---

    get length() {
        return this.actions.length;
    }

    isIdle() {
        return this.executionIndex >= this.actions.length;
    }

    pendingCount() {
        return Math.max(0, this.actions.length - this.executionIndex);
    }

    /**
     * Returns a shallow copy. Action objects are cloned so external
     * code can't mutate queue state through the snapshot.
     */
    snapshot() {
        return {
            actions: this.actions.map((a) => ({ ...a })),
            executionIndex: this.executionIndex,
            editCursor: this.editCursor,
        };
    }

    // --- Subscriptions ---

    /**
     * Register a listener for queue mutations. Listener is called
     * with no arguments; reads current state via snapshot() / direct
     * field access. Returns an unsubscribe function.
     */
    subscribe(listener) {
        if (typeof listener !== 'function') {
            throw new Error('subscribe: listener must be a function');
        }
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    _emit() {
        for (const l of this._listeners) {
            try {
                l();
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[MazeRoomQueue] listener threw:', e);
            }
        }
    }

    // --- Mutations ---

    /**
     * Player-input entry. Routes to either insert-at-cursor (when
     * editCursor is set and points into the queue) or append-and-
     * execute (when cursor is at tail / null).
     *
     * @param {object} spec - Action spec; see makeAction.
     * @returns {'insert'|'append'|'append-execute'} the disposition.
     */
    handleInput(spec) {
        if (this.editCursor !== null && this.editCursor < this.actions.length) {
            const action = makeAction(spec);
            this.actions.splice(this.editCursor, 0, action);
            this.editCursor++;
            this._emit();
            return 'insert';
        }
        const action = makeAction(spec);
        this.actions.push(action);
        const isNextToRun = this.executionIndex === this.actions.length - 1;
        this._emit();
        if (isNextToRun) {
            this._executeOne();
            return 'append-execute';
        }
        return 'append';
    }

    /**
     * Programmatic append without execute. Used for queue-building
     * paths like loops-delegation expansion or saved-queue load.
     */
    append(spec) {
        const action = makeAction(spec);
        this.actions.push(action);
        this._emit();
        return action;
    }

    /**
     * Append multiple actions in a single emit. Convenience for
     * batch construction.
     */
    appendAll(specs) {
        if (!Array.isArray(specs) || specs.length === 0) return [];
        const created = specs.map(makeAction);
        this.actions.push(...created);
        this._emit();
        return created;
    }

    /**
     * Delete an action by index. Only pending actions can be
     * deleted; deletes of already-executed actions or out-of-range
     * indices return false.
     */
    deleteAt(index) {
        if (!Number.isInteger(index)) return false;
        if (index < this.executionIndex) return false;
        if (index >= this.actions.length) return false;
        this.actions.splice(index, 1);
        if (this.editCursor !== null && this.editCursor > index) {
            this.editCursor--;
        }
        this._emit();
        return true;
    }

    /**
     * Drop pending actions, preserving the done history.
     */
    clearPending() {
        if (this.actions.length === this.executionIndex) {
            // Already nothing pending; still clear the cursor if it's set
            if (this.editCursor !== null) {
                this.editCursor = null;
                this._emit();
            }
            return;
        }
        this.actions.length = this.executionIndex;
        this.editCursor = null;
        this._emit();
    }

    /**
     * Full reset: drop both done history and pending actions. Used
     * on region transitions (manual entry resets the queue).
     */
    clearAll() {
        if (
            this.actions.length === 0
            && this.executionIndex === 0
            && this.editCursor === null
        ) {
            return;
        }
        this.actions.length = 0;
        this.executionIndex = 0;
        this.editCursor = null;
        this._emit();
    }

    /**
     * Place the edit cursor. null means "tail" (default insert
     * behavior). Indices are clamped into [executionIndex, length]
     * — cursor can't be placed within the done region.
     */
    setEditCursor(index) {
        let next;
        if (index === null) {
            next = null;
        } else if (!Number.isInteger(index)) {
            return;
        } else {
            const min = this.executionIndex;
            const max = this.actions.length;
            next = Math.max(min, Math.min(index, max));
        }
        if (this.editCursor === next) return;
        this.editCursor = next;
        this._emit();
    }

    // --- Execution ---

    /**
     * Synchronously run the next pending action. Returns true if an
     * action ran, false if the queue was idle. Used by saved-queue
     * replay drivers and tests.
     */
    stepOne() {
        if (this.isIdle()) return false;
        this._executeOne();
        return true;
    }

    _executeOne() {
        const action = this.actions[this.executionIndex];
        if (!action) return;
        try {
            this._executor(action);
        } finally {
            action.status = STATUS_DONE;
            this.executionIndex++;
            this._emit();
        }
    }

    /**
     * Advance the cursor by one without invoking the executor. Used
     * when the action's side effects are being driven externally
     * (e.g. the visualizer walking a loops-delegated path tile-by-
     * tile) — the queue is then a mirror of an external execution
     * rather than the driver. Returns true if an action was marked
     * done, false if the queue was idle.
     */
    markCurrentDone() {
        if (this.isIdle()) return false;
        const action = this.actions[this.executionIndex];
        action.status = STATUS_DONE;
        this.executionIndex++;
        this._emit();
        return true;
    }

    /**
     * Mark every remaining pending action as done without invoking the
     * executor. Same external-drive context as markCurrentDone — used
     * when a loops-delegated walk completes and the trailing
     * locationCheck verb (or any straggler verbs) need to drain so
     * the queue shows the full sequence as done.
     */
    drainPending() {
        if (this.isIdle()) return 0;
        let drained = 0;
        for (let i = this.executionIndex; i < this.actions.length; i++) {
            this.actions[i].status = STATUS_DONE;
            drained++;
        }
        this.executionIndex = this.actions.length;
        if (drained > 0) this._emit();
        return drained;
    }
}
