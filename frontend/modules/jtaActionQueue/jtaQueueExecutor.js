// JTAQueueExecutor - drives queue execution by sending eventBus commands to the iframe
import { ActionState } from '../shared/actionQueue/actionTypes.js';
import { JTAActionType } from './jtaActionDefs.js';
import { DrainStrategy, pickDrainTask } from './jtaEnergyDrainStrategy.js';

const LOG_PREFIX = '[JTAQueueExecutor]';
const POLL_INTERVAL = 500; // ms

/**
 * @typedef {object} ExecutorConfig
 * @property {DrainStrategy} [drainStrategy='mostDraining']
 * @property {number} [drainTaskId] - For SPECIFIC_TASK strategy
 * @property {boolean} [drainEnabled=true] - Whether to auto-drain when queue exhausted
 * @property {boolean} [autoReset=false] - Auto-click "Start the Journey Over, Wiser" on energy depletion
 */

export class JTAQueueExecutor {
    /** @type {import('../shared/actionQueue/actionQueue.js').ActionQueue} */
    #queue;

    /** @type {{ publish: Function, subscribe: Function, unsubscribe: Function }} */
    #eventBus;

    /** @type {string} */
    #moduleName;

    /** @type {number|null} */
    #pollTimer = null;

    /** @type {boolean} */
    #waitingForCompletion = false;

    /** @type {number|null} Task ID we're currently waiting to complete */
    #activeTaskId = null;

    /** @type {boolean} */
    #draining = false;

    /** @type {ExecutorConfig} */
    #config;

    /** @type {Function[]} Unsubscribe callbacks */
    #unsubs = [];

    /** @type {Function|null} */
    #onQueueExhausted = null;

    /** @type {Function|null} */
    #onStatusChange = null;

    /**
     * @param {import('../shared/actionQueue/actionQueue.js').ActionQueue} queue
     * @param {{ publish: Function, subscribe: Function, unsubscribe: Function }} eventBus
     * @param {string} moduleName
     * @param {ExecutorConfig} [config]
     */
    constructor(queue, eventBus, moduleName, config = {}) {
        this.#queue = queue;
        this.#eventBus = eventBus;
        this.#moduleName = moduleName;
        this.#config = {
            drainStrategy: config.drainStrategy || DrainStrategy.MOST_DRAINING,
            drainTaskId: config.drainTaskId,
            drainEnabled: config.drainEnabled !== false,
            autoReset: config.autoReset || false,
        };
    }

    /**
     * Set a callback for when the queue is fully exhausted
     * @param {Function} cb
     */
    set onQueueExhausted(cb) { this.#onQueueExhausted = cb; }

    /**
     * Set a callback for when any status changes (for UI updates)
     * @param {Function} cb
     */
    set onStatusChange(cb) { this.#onStatusChange = cb; }

    /**
     * Update drain strategy config
     * @param {Partial<ExecutorConfig>} config
     */
    updateConfig(config) {
        if (config.drainStrategy !== undefined) this.#config.drainStrategy = config.drainStrategy;
        if (config.drainTaskId !== undefined) this.#config.drainTaskId = config.drainTaskId;
        if (config.drainEnabled !== undefined) this.#config.drainEnabled = config.drainEnabled;
        if (config.autoReset !== undefined) this.#config.autoReset = config.autoReset;
    }

    /** @returns {ExecutorConfig} Current config (copy) */
    getConfig() {
        return { ...this.#config };
    }

    /**
     * @returns {boolean}
     */
    get isRunning() {
        return this.#queue.running;
    }

    /**
     * @returns {boolean}
     */
    get isDraining() {
        return this.#draining;
    }

    /**
     * Start executing the queue from the current cursor position
     */
    start() {
        if (this.#queue.running) return;
        this.#queue.running = true;
        this.#draining = false;
        console.log(`${LOG_PREFIX} Starting queue execution`);
        this.#subscribeEvents();
        this.#executeNext();
    }

    /**
     * Stop execution (pause)
     */
    stop() {
        console.log(`${LOG_PREFIX} Stopping queue execution`);
        this.#queue.running = false;
        this.#draining = false;
        this.#stopPolling();
        this.#unsubscribeEvents();
        this.#waitingForCompletion = false;
        this.#activeTaskId = null;
    }

    /**
     * Reset and restart from the beginning
     */
    restart() {
        this.stop();
        this.#queue.reset();
        this.#notifyStatusChange();
        this.start();
    }

    /** Subscribe to iframe response events */
    #subscribeEvents() {
        this.#unsubscribeEvents();
        const sub = (event, handler) => {
            const unsub = this.#eventBus.subscribe(event, handler);
            this.#unsubs.push(typeof unsub === 'function' ? unsub : () => this.#eventBus.unsubscribe(event, handler));
        };
        sub('jta:taskClicked', (data) => this.#onTaskClicked(data));
        sub('jta:itemClicked', (data) => this.#onItemClicked(data));
        sub('jta:prestigeDone', (data) => this.#onPrestigeDone(data));
        sub('jta:taskStatus', (data) => this.#onTaskStatus(data));
        sub('jta:energyDepleted', (data) => this.#onEnergyDepleted(data));
        sub('jta:gameOverDismissed', (data) => this.#onGameOverDismissed(data));
    }

    /** Unsubscribe from all events */
    #unsubscribeEvents() {
        for (const unsub of this.#unsubs) {
            try { unsub(); } catch (e) { /* ignore */ }
        }
        this.#unsubs = [];
    }

    /** Execute the next action in the queue */
    #executeNext() {
        if (!this.#queue.running) return;

        const entry = this.#queue.currentEntry();
        if (!entry) {
            // Queue exhausted — start drain strategy
            this.#startDraining();
            return;
        }

        // Skip disabled entries
        if (entry.disabled) {
            this.#queue.updateStatus(entry.entryId, { state: ActionState.SKIPPED });
            this.#queue.advance();
            this.#notifyStatusChange();
            this.#executeNext();
            return;
        }

        console.log(`${LOG_PREFIX} Executing: ${entry.label} (${entry.actionType}:${entry.actionId})`);
        this.#queue.updateStatus(entry.entryId, { state: ActionState.ACTIVE });
        this.#notifyStatusChange();

        switch (entry.actionType) {
            case JTAActionType.CLICK_TASK:
                this.#executeTask(entry);
                break;
            case JTAActionType.USE_ITEM:
                this.#executeItem(entry, false);
                break;
            case JTAActionType.USE_ALL_ITEMS:
                this.#executeItem(entry, true);
                break;
            case JTAActionType.PRESTIGE:
                this.#executePrestige(entry);
                break;
            default:
                console.warn(`${LOG_PREFIX} Unknown action type: ${entry.actionType}`);
                this.#markFailedAndAdvance(entry, `Unknown action type: ${entry.actionType}`);
        }
    }

    /** Execute a clickTask action */
    #executeTask(entry) {
        this.#activeTaskId = entry.actionId;
        this.#waitingForCompletion = false;
        this.#eventBus.publish('jta:clickTask', { taskId: entry.actionId }, this.#moduleName);
    }

    /** Execute a useItem/useAllItems action */
    #executeItem(entry, useAll) {
        this.#eventBus.publish('jta:clickItem', { itemType: entry.actionId, useAll }, this.#moduleName);
    }

    /** Execute a prestige action */
    #executePrestige(entry) {
        this.#eventBus.publish('jta:doPrestige', {}, this.#moduleName);
    }

    /** Handle jta:taskClicked response */
    #onTaskClicked(data) {
        if (!this.#queue.running) return;

        const entry = this.#queue.currentEntry();
        if (!entry || entry.actionType !== JTAActionType.CLICK_TASK) return;

        if (!data.success) {
            console.warn(`${LOG_PREFIX} clickTask failed: ${data.error}`);
            this.#markFailedAndAdvance(entry, data.error);
            return;
        }

        // Task activated — start polling for completion
        this.#waitingForCompletion = true;
        this.#startPolling();
    }

    /** Handle jta:itemClicked response */
    #onItemClicked(data) {
        if (!this.#queue.running) return;

        const entry = this.#queue.currentEntry();
        if (!entry) return;
        if (entry.actionType !== JTAActionType.USE_ITEM && entry.actionType !== JTAActionType.USE_ALL_ITEMS) return;

        // Items are immediate — mark loop completed and check loops
        this.#completeLoop(entry);
    }

    /** Handle jta:prestigeDone response */
    #onPrestigeDone(data) {
        if (!this.#queue.running) return;

        const entry = this.#queue.currentEntry();
        if (!entry || entry.actionType !== JTAActionType.PRESTIGE) return;

        if (!data.success) {
            this.#markFailedAndAdvance(entry, data.error);
            return;
        }

        this.#completeLoop(entry);
    }

    /** Handle jta:taskStatus poll response */
    #onTaskStatus(data) {
        if (!this.#queue.running || !this.#waitingForCompletion) {
            // Also handle drain task status
            if (this.#draining && data.activeTaskId === null) {
                // Drain task finished, start another
                this.#pickAndStartDrainTask(data);
            }
            return;
        }

        const entry = this.#queue.currentEntry();
        if (!entry) return;

        // Check if our task is no longer active (completed or cancelled)
        if (data.activeTaskId === null || data.activeTaskId !== this.#activeTaskId) {
            // Task completed (or was replaced)
            this.#waitingForCompletion = false;
            this.#stopPolling();
            this.#completeLoop(entry);
        }
    }

    /** Complete one loop of an entry, advance if all loops done */
    #completeLoop(entry) {
        const status = this.#queue.getStatus(entry.entryId);
        if (!status) return;

        const completed = (status.loopsCompleted || 0) + 1;
        this.#queue.updateStatus(entry.entryId, { loopsCompleted: completed });

        if (completed >= entry.loops) {
            // All loops done
            this.#queue.updateStatus(entry.entryId, { state: ActionState.COMPLETED });
            this.#queue.advance();
            this.#notifyStatusChange();
            this.#executeNext();
        } else {
            // More loops needed — re-execute same entry
            this.#notifyStatusChange();
            this.#executeCurrentAgain(entry);
        }
    }

    /** Re-execute the current entry for another loop */
    #executeCurrentAgain(entry) {
        if (!this.#queue.running) return;
        switch (entry.actionType) {
            case JTAActionType.CLICK_TASK:
                this.#executeTask(entry);
                break;
            case JTAActionType.USE_ITEM:
                this.#executeItem(entry, false);
                break;
            case JTAActionType.USE_ALL_ITEMS:
                this.#executeItem(entry, true);
                break;
            case JTAActionType.PRESTIGE:
                this.#executePrestige(entry);
                break;
        }
    }

    /** Mark entry as failed and advance */
    #markFailedAndAdvance(entry, error) {
        this.#queue.updateStatus(entry.entryId, { state: ActionState.FAILED, error });
        this.#stopPolling();
        this.#waitingForCompletion = false;
        this.#queue.advance();
        this.#notifyStatusChange();
        this.#executeNext();
    }

    /** Start polling for task completion */
    #startPolling() {
        this.#stopPolling();
        this.#pollTimer = setInterval(() => {
            this.#eventBus.publish('jta:requestTaskStatus', {}, this.#moduleName);
        }, POLL_INTERVAL);
    }

    /** Stop polling */
    #stopPolling() {
        if (this.#pollTimer !== null) {
            clearInterval(this.#pollTimer);
            this.#pollTimer = null;
        }
    }

    /** Handle energy depletion (game-over overlay appeared) */
    #onEnergyDepleted(data) {
        if (!this.#queue.running) return;
        if (!this.#config.autoReset) {
            console.log(`${LOG_PREFIX} Energy depleted — autoReset disabled, pausing`);
            return;
        }
        console.log(`${LOG_PREFIX} Energy depleted — auto-dismissing game-over`);
        this.#stopPolling();
        this.#waitingForCompletion = false;
        this.#draining = false;
        this.#eventBus.publish('jta:dismissGameOver', {}, this.#moduleName);
    }

    /** Handle game-over dismissed (energy reset performed) */
    #onGameOverDismissed(data) {
        if (!this.#queue.running) return;
        if (!data.success) {
            console.warn(`${LOG_PREFIX} dismissGameOver failed: ${data.error}`);
            return;
        }
        console.log(`${LOG_PREFIX} Game-over dismissed, restarting queue`);
        // Reset queue to beginning and re-execute
        this.#queue.reset();
        this.#queue.running = true; // reset() sets running=false, restore it
        this.#notifyStatusChange();
        this.#executeNext();
    }

    /** Start the energy drain strategy */
    #startDraining() {
        if (!this.#config.drainEnabled) {
            console.log(`${LOG_PREFIX} Queue exhausted, drain disabled — idling`);
            this.#notifyStatusChange();
            if (this.#onQueueExhausted) this.#onQueueExhausted();
            return;
        }
        console.log(`${LOG_PREFIX} Queue exhausted, starting drain strategy: ${this.#config.drainStrategy}`);
        this.#draining = true;
        this.#notifyStatusChange();
        if (this.#onQueueExhausted) this.#onQueueExhausted();

        // Request task status to pick a drain task
        this.#startPolling();
        this.#eventBus.publish('jta:requestTaskStatus', {}, this.#moduleName);
    }

    /** Pick a drain task and send clickTask */
    #pickAndStartDrainTask(statusData) {
        if (!this.#draining || !this.#queue.running) return;

        const taskId = pickDrainTask(
            this.#config.drainStrategy,
            statusData.tasks,
            this.#config.drainTaskId
        );

        if (taskId !== null) {
            this.#activeTaskId = taskId;
            this.#eventBus.publish('jta:clickTask', { taskId }, this.#moduleName);
        }
    }

    /** Notify status change callback */
    #notifyStatusChange() {
        if (this.#onStatusChange) this.#onStatusChange();
    }
}
