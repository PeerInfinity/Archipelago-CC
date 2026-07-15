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
 *   'energyDepleted'|'gameOverDismissed'|'detailedState'|'gameDefs'|'connected'|
 *   'actions'|'loopReset'|'regionChanged'
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
    /** Ask JtA to report its currently-loaded actions (substrate catalog source). */
    requestActions() {}

    /**
     * Subscribe to a transport event.
     * @param {QueueTransportEvent} event
     * @param {Function} handler
     * @returns {Function} unsubscribe callback
     */
    on(event, handler) { return () => {}; }

    /**
     * True for the substrate BridgeTransport, false for the legacy
     * RemoteTransport. The engine gates substrate-only lifecycle policy
     * (automation off/restore, pause-on-loop-reset, prediction skipping) on
     * this rather than sniffing the environment itself.
     * @returns {boolean}
     */
    get isBridge() { return false; }

    /**
     * Called once before a run starts. On the substrate path this records and
     * disables the fork's automation so a queue-issued task isn't fought by
     * the automation tick; a no-op on the legacy path.
     */
    async beginRun() {}

    /** Called when a run stops/pauses/finishes; restores what beginRun changed. */
    async endRun() {}

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

// AutomationMode.Off from journey-to-ascension/simulation.ts (All=0, Zone=1,
// Off=2). Hardcoded — the fork exposes the mode as a number, not the enum.
const JTA_AUTOMATION_MODE_OFF = 2;

/**
 * Normalize the fork's getFullState() into the shape the shared skill/energy
 * helpers (convertToSimState / snapshotSkillsFromGameState) expect: skills and
 * items keyed by type rather than the fork's arrays. Skill "progress" maps onto
 * the legacy "xp" slot (both are progress toward the next level); the fractional
 * level this yields is approximate (stale XP curve) and only ever feeds the
 * actuals table, which is hidden on the substrate path.
 * @param {object} fs
 * @returns {object}
 */
function normalizeForkState(fs) {
    const skills = {};
    for (const s of fs.skills || []) skills[s.type] = { level: s.level, xp: s.progress };
    const items = {};
    for (const it of fs.items || []) items[it.type] = it.count;
    return {
        currentEnergy: fs.currentEnergy,
        maxEnergy: fs.maxEnergy,
        currentZone: fs.currentZone,
        highestZone: fs.highestZone,
        highestZoneFullyCompleted: fs.highestZoneFullyCompleted,
        power: fs.power,
        attunement: fs.attunement,
        perks: fs.perks || [],
        skills,
        items,
    };
}

/**
 * Substrate transport: drives the live JtA fork through the jtaSubstrateWrapper
 * bridge's jta:queueAction request/response channel. Each command becomes a
 * request whose reply is translated back into the executor's event vocabulary
 * (taskClicked / itemClicked / taskStatus / detailedState). Also re-emits the
 * host loop-reset as a 'loopReset' transport event so the engine can pause, and
 * owns the automation off/restore around a run.
 */
export class BridgeTransport extends QueueTransport {
    /** @type {{ publish: Function, subscribe: Function, unsubscribe: Function }} */
    #eventBus;

    /** @type {string} */
    #moduleName;

    /** @type {Map<string, Set<Function>>} logical event → handlers */
    #handlers = new Map();

    /** @type {Map<string, Function>} requestId → promise resolver */
    #pending = new Map();

    /** @type {number} */
    #reqSeq = 0;

    /** @type {number|null} Automation mode to restore in endRun (null = we didn't change it) */
    #priorAutomationMode = null;

    /** @type {Function} */
    #unsubResult;

    /** @type {Function} */
    #unsubLoopReset;

    /** @type {Function} */
    #unsubRegion;

    constructor(eventBus, moduleName) {
        super();
        this.#eventBus = eventBus;
        this.#moduleName = moduleName;
        // Persistent subscriptions: command replies + host loop reset + zone
        // change (the catalog is re-requested when the loaded zone changes).
        this.#unsubResult = this.#subscribe('jta:queueActionResult', (p) => this.#onResult(p));
        this.#unsubLoopReset = this.#subscribe('gameState:loopReset', () => this.#emit('loopReset', {}));
        this.#unsubRegion = this.#subscribe('gameState:regionChanged', () => this.#emit('regionChanged', {}));
    }

    get isBridge() { return true; }

    #subscribe(topic, handler) {
        const unsub = this.#eventBus.subscribe(topic, handler);
        return typeof unsub === 'function'
            ? unsub
            : () => this.#eventBus.unsubscribe(topic, handler);
    }

    /** Send a queueAction command; resolves with the reply {result, error}. */
    #request(method, args = []) {
        const requestId = `${this.#moduleName}#${++this.#reqSeq}`;
        return new Promise((resolve) => {
            this.#pending.set(requestId, resolve);
            this.#eventBus.publish('jta:queueAction', { method, args, requestId }, this.#moduleName);
        });
    }

    #onResult(payload) {
        const resolve = this.#pending.get(payload?.requestId);
        if (resolve) {
            this.#pending.delete(payload.requestId);
            resolve(payload || {});
        }
    }

    on(event, handler) {
        if (!this.#handlers.has(event)) this.#handlers.set(event, new Set());
        this.#handlers.get(event).add(handler);
        return () => this.#handlers.get(event)?.delete(handler);
    }

    #emit(event, data) {
        const set = this.#handlers.get(event);
        if (!set) return;
        for (const handler of [...set]) {
            try { handler(data); } catch (e) { /* isolate one bad subscriber */ }
        }
    }

    // --- Commands (translated to queueAction; replies become executor events) ---

    clickTask(taskId) {
        this.#request('performTask', [taskId]).then((res) => {
            const r = res.result || {};
            const error = res.error || r.error || null;
            this.#emit('taskClicked', {
                success: !!r.success && !res.error,
                taskId,
                error,
                alreadyCompleted: !!error && /already completed/i.test(error),
                walkInFlight: !!r.walkInFlight,
            });
        });
    }

    clickItem(itemType, useAll) {
        this.#request('useItem', [itemType, !!useAll]).then((res) => {
            const r = res.result || {};
            this.#emit('itemClicked', {
                success: !!r.success && !res.error,
                itemType,
                error: res.error || r.error || null,
                walkInFlight: !!r.walkInFlight,
            });
        });
    }

    doPrestige() {
        // Prestige is dropped on the substrate path — the fork has no
        // window.doPrestige hook (plan R8). Report failure so the entry is
        // skipped rather than hanging.
        Promise.resolve().then(() => this.#emit('prestigeDone', {
            success: false,
            error: 'prestige is not supported on the substrate',
        }));
    }

    requestTaskStatus() {
        this.#request('getStatus').then((res) => {
            const s = res.result || {};
            this.#emit('taskStatus', {
                activeTaskId: s.activeTaskId ?? null,
                currentEnergy: s.currentEnergy,
                tasks: s.tasks,
                walkInFlight: !!s.walkInFlight,
            });
        });
    }

    requestDetailedState() {
        this.#request('getFullState').then((res) => {
            const fs = res.result;
            this.#emit('detailedState', { state: fs ? normalizeForkState(fs) : null });
        });
    }

    requestGameDefs() {
        // The substrate catalog is a live report (requestActions), not a
        // gameDefs round-trip.
    }

    requestActions() {
        this.#request('getActions').then((res) => {
            this.#emit('actions', res.result || null);
        });
    }

    dismissGameOver() {
        // Substrate depletion pauses the run (pause-on-loop-reset); there is no
        // game-over overlay to dismiss.
    }

    // --- Run lifecycle: automation off/restore ---

    async beginRun() {
        const res = await this.#request('getAutomationMode');
        const prior = res.result;
        if (typeof prior !== 'number') return; // fork/hook unavailable
        const setRes = await this.#request('setAutomationMode', [JTA_AUTOMATION_MODE_OFF]);
        // A playback walk refuses the change (result.walkInFlight); leave its
        // automation intact and don't claim we changed it, so endRun won't
        // clobber the walk's mode.
        if (setRes.result && setRes.result.walkInFlight) return;
        this.#priorAutomationMode = prior;
    }

    async endRun() {
        if (this.#priorAutomationMode == null) return;
        const mode = this.#priorAutomationMode;
        this.#priorAutomationMode = null;
        await this.#request('setAutomationMode', [mode]);
    }

    destroy() {
        try { this.#unsubResult?.(); } catch (e) { /* ignore */ }
        try { this.#unsubLoopReset?.(); } catch (e) { /* ignore */ }
        try { this.#unsubRegion?.(); } catch (e) { /* ignore */ }
        this.#handlers.clear();
        this.#pending.clear();
    }
}

/**
 * Build the queue transport for the current environment. Legacy JtA play
 * (?mode=jta) drives the frozen game-bundle over the eventBus protocol
 * (RemoteTransport, behaviour-identical); every other mode — the
 * substrate/default mode — drives the live fork through the jtaSubstrateWrapper
 * bridge (BridgeTransport). The app enters legacy mode explicitly via ?mode=jta.
 * @param {{ publish: Function, subscribe: Function, unsubscribe: Function }} eventBus
 * @param {string} moduleName
 * @returns {QueueTransport}
 */
export function createQueueTransport(eventBus, moduleName) {
    let mode = null;
    try {
        mode = new URLSearchParams(window.location.search).get('mode');
    } catch (e) { /* non-browser (tests) → default to bridge */ }
    if (mode === 'jta') return new RemoteTransport(eventBus, moduleName);
    return new BridgeTransport(eventBus, moduleName);
}
