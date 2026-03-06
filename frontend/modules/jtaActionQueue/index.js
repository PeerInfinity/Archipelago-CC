// jtaActionQueue module entry point
import { JTAQueuePanelUI } from './jtaQueuePanelUI.js';
import { JTAActionsPanelUI } from './jtaActionsPanelUI.js';
import { ActionQueue } from '../shared/actionQueue/actionQueue.js';
import { LoadoutManager } from '../shared/actionQueue/loadoutManager.js';
import { JTAQueueExecutor } from './jtaQueueExecutor.js';
import { buildActionCatalog } from './jtaActionDefs.js';
import { DrainStrategy } from './jtaEnergyDrainStrategy.js';
import eventBus from '../../app/core/eventBus.js';

// --- Module Info ---
export const moduleInfo = {
    name: 'jtaActionQueue',
    title: 'JTA Action Queue',
    componentType: 'jtaActionQueue',
    icon: '',
    column: 2,
    description: 'Queue and execute actions for Journey to Ascension.',
};

function log(level, message, ...data) {
    if (typeof window !== 'undefined' && window.logger) {
        window.logger[level]('jtaActionQueue', message, ...data);
    } else {
        const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
        consoleMethod(`[jtaActionQueue] ${message}`, ...data);
    }
}

let moduleEventBus = null;
let moduleId = 'jtaActionQueue';

// Shared module-level instances
let queue = null;
let loadoutManager = null;
let executor = null;
let catalog = null;
let queuePanelUI = null;
let actionsPanelUI = null;

export async function register(registrationApi) {
    log('info', `[${moduleId}] Registering...`);

    registrationApi.registerPanelComponent('jtaActionQueue', JTAActionQueuePanel);

    // Publishers — commands we send to the iframe
    registrationApi.registerEventBusPublisher('jta:clickTask');
    registrationApi.registerEventBusPublisher('jta:clickItem');
    registrationApi.registerEventBusPublisher('jta:doPrestige');
    registrationApi.registerEventBusPublisher('jta:requestTaskStatus');
    registrationApi.registerEventBusPublisher('jta:requestGameDefs');
    registrationApi.registerEventBusPublisher('jta:dismissGameOver');

    // Subscribers — responses from the iframe
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'jta:taskClicked');
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'jta:itemClicked');
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'jta:prestigeDone');
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'jta:taskStatus');
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'jta:gameDefsSnapshot');
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'jta:energyDepleted');
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'jta:gameOverDismissed');
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'iframe:connected');
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'iframe:disconnected');

    log('info', `[${moduleId}] Registration complete.`);
}

export async function initialize(mId, priorityIndex, initializationApi) {
    moduleId = mId;
    log('info', `[${moduleId}] Initializing with priority ${priorityIndex}...`);

    moduleEventBus = initializationApi.getEventBus();

    // Create shared instances
    queue = new ActionQueue();
    loadoutManager = new LoadoutManager('jta-action-loadouts');
    loadoutManager.loadActive(queue);

    log('info', `[${moduleId}] Initialization complete.`);
}

export function getModuleEventBus() {
    if (moduleEventBus) return moduleEventBus;
    return {
        publish: (event, data) => eventBus.publish(event, data, 'jtaActionQueue'),
        subscribe: (event, callback) => eventBus.subscribe(event, callback, 'jtaActionQueue'),
        unsubscribe: (event, callback) => eventBus.unsubscribe(event, callback, 'jtaActionQueue'),
    };
}

// Accessors for module-level instances
export function getQueue() { return queue; }
export function getLoadoutManager() { return loadoutManager; }
export function getExecutor() { return executor; }
export function getCatalog() { return catalog; }

/**
 * Panel component for Golden Layout.
 * GL passes (container, componentState, componentType) — container is a GL ComponentContainer, not an HTMLElement.
 * Must implement getRootElement() returning a DOM element.
 */
class JTAActionQueuePanel {
    constructor(container, componentState) {
        this.container = container;
        this.componentState = componentState;
        this.rootElement = null;
        this._unsubs = [];
    }

    getRootElement() {
        if (!this.rootElement) {
            this._createRootElement();
            this._subscribeToGameDefs();
        }
        return this.rootElement;
    }

    _createRootElement() {
        this.rootElement = document.createElement('div');
        this.rootElement.className = 'jtaActionQueue-panel';
        this.rootElement.style.cssText = 'display: flex; flex-direction: column; height: 100%; overflow: auto; background: #1e1e1e; color: #cccccc; padding: 8px; gap: 8px;';
        this.rootElement.innerHTML = `
            <div class="aq-controls" style="display: flex; gap: 4px; flex-wrap: wrap;">
                <button class="aq-start-btn">Start</button>
                <button class="aq-stop-btn">Stop</button>
                <button class="aq-reset-btn">Reset</button>
                <button class="aq-clear-btn">Clear</button>
                <span class="aq-status-text" style="margin-left: 8px; align-self: center;"></span>
            </div>
            <details class="aq-settings" style="border: 1px solid #444; border-radius: 4px; padding: 4px 8px; background: #252525;">
                <summary style="cursor: pointer; user-select: none; font-weight: bold; padding: 2px 0;">Settings</summary>
                <div class="aq-settings-body" style="display: flex; flex-direction: column; gap: 6px; padding: 6px 0 2px;">
                    <label style="display: flex; align-items: center; gap: 6px;">
                        <input type="checkbox" class="aq-setting-drain" checked>
                        Auto-drain energy when queue finishes
                    </label>
                    <div class="aq-drain-options" style="padding-left: 22px; display: flex; flex-direction: column; gap: 4px;">
                        <label style="display: flex; align-items: center; gap: 6px;">
                            <input type="radio" name="aq-drain-strategy" value="mostDraining" checked>
                            Most draining task
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px;">
                            <input type="radio" name="aq-drain-strategy" value="highestXp">
                            Highest XP task
                        </label>
                    </div>
                    <label style="display: flex; align-items: center; gap: 6px;">
                        <input type="checkbox" class="aq-setting-autoreset">
                        Auto-reset when energy depleted
                    </label>
                </div>
            </details>
            <div class="aq-queue-section" style="flex: 1; min-height: 100px;"></div>
            <div class="aq-actions-section" style="flex: 2; min-height: 200px; overflow: auto;"></div>
        `;

        this._setupControls();
        this._setupSettings();
        this._setupQueue();
    }

    _setupControls() {
        const el = this.rootElement;
        const statusText = el.querySelector('.aq-status-text');

        el.querySelector('.aq-start-btn').addEventListener('click', () => {
            if (!executor && queue) {
                const settings = this._savedSettings ? this._savedSettings() : {};
                executor = new JTAQueueExecutor(queue, getModuleEventBus(), moduleId, settings);
                executor.onStatusChange = () => this._refreshUI();
                executor.onQueueExhausted = () => {
                    statusText.textContent = settings.drainEnabled !== false ? 'Draining energy...' : 'Queue finished';
                };
            }
            if (executor) {
                executor.start();
                statusText.textContent = 'Running...';
                this._refreshUI();
            }
        });

        el.querySelector('.aq-stop-btn').addEventListener('click', () => {
            if (executor) {
                executor.stop();
                statusText.textContent = 'Stopped';
                this._refreshUI();
            }
        });

        el.querySelector('.aq-reset-btn').addEventListener('click', () => {
            if (executor) executor.stop();
            if (queue) {
                queue.reset();
                statusText.textContent = 'Reset';
                this._refreshUI();
            }
        });

        el.querySelector('.aq-clear-btn').addEventListener('click', () => {
            if (executor) executor.stop();
            if (queue) {
                queue.clear();
                statusText.textContent = 'Cleared';
                this._refreshUI();
            }
        });
    }

    _setupSettings() {
        const el = this.rootElement;
        const drainCheckbox = el.querySelector('.aq-setting-drain');
        const drainOptions = el.querySelector('.aq-drain-options');
        const autoResetCheckbox = el.querySelector('.aq-setting-autoreset');
        const radios = el.querySelectorAll('input[name="aq-drain-strategy"]');

        // Load persisted settings
        try {
            const saved = JSON.parse(localStorage.getItem('jta-aq-settings') || '{}');
            if (saved.drainEnabled === false) {
                drainCheckbox.checked = false;
                drainOptions.style.opacity = '0.5';
                drainOptions.style.pointerEvents = 'none';
            }
            if (saved.autoReset === true) {
                autoResetCheckbox.checked = true;
            }
            if (saved.drainStrategy) {
                const radio = el.querySelector(`input[name="aq-drain-strategy"][value="${saved.drainStrategy}"]`);
                if (radio) radio.checked = true;
            }
        } catch (e) { /* ignore */ }

        const persistSettings = () => {
            const strategy = el.querySelector('input[name="aq-drain-strategy"]:checked')?.value || 'mostDraining';
            const settings = {
                drainEnabled: drainCheckbox.checked,
                drainStrategy: strategy,
                autoReset: autoResetCheckbox.checked,
            };
            localStorage.setItem('jta-aq-settings', JSON.stringify(settings));
            if (executor) executor.updateConfig(settings);
        };

        drainCheckbox.addEventListener('change', () => {
            const enabled = drainCheckbox.checked;
            drainOptions.style.opacity = enabled ? '1' : '0.5';
            drainOptions.style.pointerEvents = enabled ? 'auto' : 'none';
            persistSettings();
        });

        autoResetCheckbox.addEventListener('change', persistSettings);
        for (const radio of radios) {
            radio.addEventListener('change', persistSettings);
        }

        // Store ref so executor can be initialized with saved settings
        this._savedSettings = () => {
            const strategy = el.querySelector('input[name="aq-drain-strategy"]:checked')?.value || 'mostDraining';
            return {
                drainEnabled: drainCheckbox.checked,
                drainStrategy: strategy,
                autoReset: autoResetCheckbox.checked,
            };
        };
    }

    _setupQueue() {
        const queueSection = this.rootElement.querySelector('.aq-queue-section');
        queuePanelUI = new JTAQueuePanelUI(queueSection);
        // queue may not exist yet (GL init runs before module init),
        // so also bind lazily when game defs arrive
        if (queue) queuePanelUI.bind(queue);
    }

    _ensureQueueBound() {
        if (queuePanelUI && queue && !queuePanelUI._bound) {
            queuePanelUI.bind(queue);
            queuePanelUI._bound = true;
        }
    }

    _subscribeToGameDefs() {
        const bus = getModuleEventBus();

        const handleGameDefs = (data) => {
            if (!data || !data.zones) return;
            log('info', `Received game definitions: ${data.zones.length} zones`);

            catalog = buildActionCatalog(data.zones, data.items || null);

            // Ensure queue panel is bound now that queue exists (created in Phase 9)
            this._ensureQueueBound();

            const actionsSection = this.rootElement.querySelector('.aq-actions-section');
            actionsPanelUI = new JTAActionsPanelUI(actionsSection);
            actionsPanelUI.bind(queue, catalog, () => {
                if (queuePanelUI) queuePanelUI.refresh();
                if (loadoutManager && queue) loadoutManager.saveActive(queue);
            });
        };

        const unsub = bus.subscribe('jta:gameDefsSnapshot', handleGameDefs);
        this._unsubs.push(typeof unsub === 'function' ? unsub : () => bus.unsubscribe('jta:gameDefsSnapshot', handleGameDefs));

        const handleConnected = () => {
            setTimeout(() => {
                bus.publish('jta:requestGameDefs', {});
            }, 500);
        };
        const unsub2 = bus.subscribe('iframe:connected', handleConnected);
        this._unsubs.push(typeof unsub2 === 'function' ? unsub2 : () => bus.unsubscribe('iframe:connected', handleConnected));

        // Request immediately in case already connected
        setTimeout(() => {
            bus.publish('jta:requestGameDefs', {});
        }, 1000);
    }

    _refreshUI() {
        if (queuePanelUI) queuePanelUI.refresh();
    }

    destroy() {
        for (const unsub of this._unsubs) {
            try { unsub(); } catch (e) { /* ignore */ }
        }
        this._unsubs = [];
        if (executor) executor.stop();
    }
}
