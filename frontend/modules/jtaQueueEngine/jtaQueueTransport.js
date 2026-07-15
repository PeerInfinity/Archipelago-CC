// QueueTransport — the seam between the JtA action-queue engine/executor and
// the running game. The engine and executor speak ONLY this interface; they
// never publish/subscribe game-protocol eventBus topics directly. Two
// implementations exist:
//
//   - RemoteTransport: the legacy eventBus protocol used under ?mode=jta,
//     driving the frozen jta-remote game-bundle via jtaGameClient.js. This is
//     a behaviour-identical wrapper of the calls the executor/engine used to
//     make inline, so the legacy mode is unchanged.
//   - BridgeTransport (Phase 2): the substrate bridge channel (jta:queueAction),
//     driving the live fork through jtaSubstrateWrapper/bridge.js.
//
// The engine picks one at construction via createQueueTransport().

/**
 * Logical event names the transport delivers to subscribers. Each maps onto a
 * concrete game-protocol topic inside the implementation.
 * @typedef {(
 *   'taskClicked'|'itemClicked'|'prestigeDone'|'taskStatus'|
 *   'energyDepleted'|'gameOverDismissed'|'detailedState'|'gameDefs'|'connected'
 * )} QueueTransportEvent
 */

/**
 * The transport contract. Commands are fire-and-forget; results arrive as
 * events delivered to on() subscribers. The base class is a no-op stub so a
 * missing/partial transport degrades to inert rather than throwing.
 */
export class QueueTransport {
    /** @param {number} taskId */
    clickTask(taskId) {}
    /** @param {number} itemType @param {boolean} useAll */
    clickItem(itemType, useAll) {}
    doPrestige() {}
    requestTaskStatus() {}
    requestDetailedState() {}
    dismissGameOver() {}
    requestGameDefs() {}

    /**
     * Subscribe to a transport event.
     * @param {QueueTransportEvent} event
     * @param {Function} handler
     * @returns {Function} unsubscribe callback
     */
    on(event, handler) { return () => {}; }

    /** Release any transport-owned resources. */
    destroy() {}
}

/** Logical event name → legacy eventBus topic. */
const REMOTE_EVENT_TOPICS = Object.freeze({
    taskClicked: 'jta:taskClicked',
    itemClicked: 'jta:itemClicked',
    prestigeDone: 'jta:prestigeDone',
    taskStatus: 'jta:taskStatus',
    energyDepleted: 'jta:energyDepleted',
    gameOverDismissed: 'jta:gameOverDismissed',
    detailedState: 'jta:detailedStateSnapshot',
    gameDefs: 'jta:gameDefsSnapshot',
    connected: 'iframe:connected',
});

/**
 * Legacy transport: thin wrapper over the eventBus protocol handled by
 * jta-remote/jtaGameClient.js. Every command is exactly the publish the
 * executor/engine used to make inline; every event is exactly the topic they
 * used to subscribe to. Used under ?mode=jta.
 */
export class RemoteTransport extends QueueTransport {
    /** @type {{ publish: Function, subscribe: Function, unsubscribe: Function }} */
    #eventBus;

    /** @type {string} */
    #moduleName;

    /**
     * @param {{ publish: Function, subscribe: Function, unsubscribe: Function }} eventBus
     * @param {string} moduleName
     */
    constructor(eventBus, moduleName) {
        super();
        this.#eventBus = eventBus;
        this.#moduleName = moduleName;
    }

    clickTask(taskId) {
        this.#eventBus.publish('jta:clickTask', { taskId }, this.#moduleName);
    }

    clickItem(itemType, useAll) {
        this.#eventBus.publish('jta:clickItem', { itemType, useAll }, this.#moduleName);
    }

    doPrestige() {
        this.#eventBus.publish('jta:doPrestige', {}, this.#moduleName);
    }

    requestTaskStatus() {
        this.#eventBus.publish('jta:requestTaskStatus', {}, this.#moduleName);
    }

    requestDetailedState() {
        this.#eventBus.publish('jta:requestDetailedState', {}, this.#moduleName);
    }

    dismissGameOver() {
        this.#eventBus.publish('jta:dismissGameOver', {}, this.#moduleName);
    }

    requestGameDefs() {
        this.#eventBus.publish('jta:requestGameDefs', {}, this.#moduleName);
    }

    on(event, handler) {
        const topic = REMOTE_EVENT_TOPICS[event];
        if (!topic) return () => {};
        const unsub = this.#eventBus.subscribe(topic, handler);
        return typeof unsub === 'function'
            ? unsub
            : () => this.#eventBus.unsubscribe(topic, handler);
    }
}

/**
 * Build the queue transport for the current environment. Phase 1 always
 * returns the legacy RemoteTransport; Phase 2 will return a BridgeTransport
 * when the JtA substrate wrapper is present.
 * @param {{ publish: Function, subscribe: Function, unsubscribe: Function }} eventBus
 * @param {string} moduleName
 * @returns {QueueTransport}
 */
export function createQueueTransport(eventBus, moduleName) {
    return new RemoteTransport(eventBus, moduleName);
}
