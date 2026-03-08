// jtaActionQueue module entry point
import { JTAQueuePanelUI } from './jtaQueuePanelUI.js';
import { JTAActionsPanelUI } from './jtaActionsPanelUI.js';
import { ActionQueue } from '../shared/actionQueue/actionQueue.js';
import { LoadoutManager } from '../shared/actionQueue/loadoutManager.js';
import { JTAQueueExecutor } from './jtaQueueExecutor.js';
import { buildActionCatalog, createQueueEntry } from './jtaActionDefs.js';
import { DrainStrategy } from './jtaEnergyDrainStrategy.js';
import { convertToSimState, predictQueue, snapshotSkillsFromGameState } from './jtaQueuePredictor.js';
import { StrategyType, StrategyLevel, buildQueueForStrategy } from './jtaQueueBuilder.js';
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

/** Format energy value for display in reasoning log */
function fmtE(value) {
    if (value === null || value === undefined) return '—';
    if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(1) + 'M';
    if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(1) + 'K';
    return Math.round(value).toLocaleString();
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
let lastSimState = null;
let lastGameState = null;
let predictions = null;
let predictionDebounceTimer = null;

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
    registrationApi.registerEventBusPublisher('jta:requestDetailedState');

    // Subscribers — responses from the iframe
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'jta:taskClicked');
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'jta:itemClicked');
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'jta:prestigeDone');
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'jta:taskStatus');
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'jta:gameDefsSnapshot');
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'jta:energyDepleted');
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'jta:gameOverDismissed');
    registrationApi.registerEventBusSubscriberIntent(moduleId, 'jta:detailedStateSnapshot');
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
    ensureStrategyLoadouts();
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

/** Ensure strategy loadouts exist in the loadout manager. */
function ensureStrategyLoadouts() {
    if (!loadoutManager) return;
    const existing = loadoutManager.getLoadouts();
    const existingNames = new Set(existing.map(l => l.name));

    // Remove obsolete per-strategy loadouts from earlier versions
    const obsolete = ['[Push]', '[Collect]', '[Grind XP]'];
    for (let i = existing.length - 1; i >= 0; i--) {
        if (obsolete.includes(existing[i].name)) {
            loadoutManager.delete(i);
        }
    }

    // Ensure the single [Auto] strategy loadout exists
    if (!existingNames.has('[Auto]')) {
        loadoutManager.create('[Auto]', null, {
            strategy: { type: StrategyType.AUTO },
            repeatCount: 0,
            nextLoadout: -1,
        });
    }

    // Clean up: only [Auto] should have a strategy — strip stray strategies
    // from non-[Auto] loadouts (can happen from earlier code versions)
    const cleaned = loadoutManager.getLoadouts();
    for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i].name !== '[Auto]' && loadoutManager.isStrategyBacked(i)) {
            loadoutManager.setStrategy(i, null);
        }
    }
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
        this._lastReasoning = null;
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
        this.rootElement.style.cssText = 'display: flex; flex-direction: column; height: 100%; overflow: auto; background: #1e1e1e; color: #cccccc; padding: 8px; gap: 8px; box-sizing: border-box;';
        this.rootElement.innerHTML = `
            <style>
                .jtaActionQueue-panel button {
                    background: #3a3a3a;
                    color: #ccc;
                    border: 1px solid #555;
                    border-radius: 3px;
                    padding: 3px 8px;
                    cursor: pointer;
                }
                .jtaActionQueue-panel button:hover {
                    background: #4a4a4a;
                    border-color: #777;
                }
                .jtaActionQueue-panel button:active {
                    background: #333;
                }

                /* Queue entries */
                .aq-entry {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 3px 4px;
                    border: 1px solid transparent;
                    border-radius: 3px;
                    cursor: grab;
                    transition: background-color 0.1s;
                    font-size: 1em;
                }
                .aq-entry:hover {
                    background: rgba(255, 255, 255, 0.05);
                }
                .aq-entry-index {
                    min-width: 20px;
                    text-align: right;
                    opacity: 0.5;
                    font-size: 0.8em;
                    font-family: monospace;
                }
                .aq-col-zone {
                    min-width: 16px;
                    text-align: right;
                    opacity: 0.5;
                    font-size: 0.8em;
                    font-family: monospace;
                }
                .aq-col-name {
                    width: 14ch;
                    min-width: 14ch;
                    max-width: 14ch;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    font-family: monospace;
                    font-size: 0.85em;
                }
                .aq-entry-label {
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .aq-entry-group {
                    font-size: 0.75em;
                    opacity: 0.5;
                    max-width: 80px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .aq-entry-state {
                    font-size: 0.7em;
                    opacity: 0.6;
                    min-width: 50px;
                    text-align: center;
                }

                /* Entry action buttons */
                .aq-entry-buttons {
                    display: flex;
                    gap: 1px;
                    flex-shrink: 0;
                }
                .aq-entry-buttons .aq-btn {
                    padding: 1px 4px;
                    font-size: 0.75em;
                    min-width: 20px;
                    line-height: 1.2;
                }

                /* Entry states */
                .aq-current {
                    border-color: #5a9;
                    background: rgba(85, 170, 153, 0.15);
                }
                .aq-disabled {
                    opacity: 0.4;
                }
                .aq-disabled .aq-entry-label {
                    text-decoration: line-through;
                }
                .aq-state-completed .aq-entry-state {
                    color: #5a5;
                }
                .aq-state-failed .aq-entry-state {
                    color: #d55;
                }
                .aq-state-active .aq-entry-state {
                    color: #5af;
                }

                /* Drag states */
                .aq-dragging {
                    opacity: 0.4;
                }
                .aq-drag-over {
                    border-color: #5af !important;
                    background: rgba(85, 170, 255, 0.15);
                }

                /* Amount selector */
                .aq-queue-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-bottom: 4px;
                }
                .aq-amount-selector {
                    display: flex;
                    align-items: center;
                    gap: 2px;
                    font-size: 0.8em;
                }
                .aq-amount-label {
                    opacity: 0.6;
                    margin-right: 2px;
                }
                .aq-amount-btn {
                    padding: 1px 5px !important;
                    font-size: 0.85em;
                }
                .aq-amount-active {
                    background: #555 !important;
                    border-color: #888 !important;
                }

                /* Current list (execution snapshot) */
                .aq-current-section {
                    border-bottom: 1px solid #444;
                    padding-bottom: 6px;
                }
                .aq-section-header {
                    font-size: 0.85em;
                    padding: 2px 4px;
                    opacity: 0.7;
                }
                .aq-next-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 2px 4px 4px;
                }
                .aq-current-entry {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 2px 4px;
                    border-radius: 3px;
                    position: relative;
                    overflow: hidden;
                    font-size: 1em;
                }
                .aq-current-entry .aq-progress-bar {
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    background: rgba(85, 170, 153, 0.15);
                    transition: width 0.3s ease;
                    z-index: 0;
                }
                .aq-current-entry > * {
                    position: relative;
                    z-index: 1;
                }
                .aq-current-entry.aq-current {
                    border: 1px solid #5a9;
                    background: rgba(85, 170, 153, 0.1);
                }
                .aq-current-entry.aq-state-completed {
                    opacity: 0.5;
                }
                .aq-current-entry.aq-state-completed .aq-progress-bar {
                    background: rgba(85, 170, 85, 0.2);
                }
                .aq-current-entry.aq-state-active .aq-progress-bar {
                    background: rgba(85, 170, 255, 0.2);
                }
                .aq-current-entry.aq-state-failed .aq-entry-state {
                    color: #d55;
                }
                .aq-current-loops {
                    font-size: 0.8em;
                    opacity: 0.7;
                    min-width: 30px;
                    text-align: center;
                }

                /* Predictions */
                .aq-prediction {
                    display: flex;
                    gap: 4px;
                    font-size: 0.8em;
                    font-family: monospace;
                    flex-shrink: 0;
                    margin-left: auto;
                    margin-right: 4px;
                }
                .aq-pred-cost {
                    opacity: 0.6;
                    min-width: 5ch;
                    text-align: right;
                }
                .aq-pred-remaining {
                    font-weight: bold;
                    min-width: 5ch;
                    text-align: right;
                }
                .aq-pred-good {
                    color: #5a5;
                }
                .aq-pred-warn {
                    color: #da5;
                }
                .aq-pred-low {
                    color: #d55;
                }
                .aq-pred-insufficient {
                    color: #a33;
                }
                .aq-pred-insufficient .aq-col-name {
                    text-decoration: line-through;
                }
                .aq-pred-skills {
                    display: flex;
                    gap: 3px;
                    opacity: 0.7;
                    width: 18ch;
                    min-width: 18ch;
                    justify-content: flex-end;
                }
                .aq-pred-skill {
                    color: #8bf;
                }

                /* Actuals in current list */
                .aq-actuals {
                    display: flex;
                    gap: 4px;
                    font-size: 0.8em;
                    font-family: monospace;
                    flex-shrink: 0;
                    margin-left: auto;
                    margin-right: 4px;
                }
                .aq-actual-cost {
                    opacity: 0.7;
                    min-width: 5ch;
                    text-align: right;
                }
                .aq-actual-remaining {
                    font-weight: bold;
                    color: #8cf;
                    min-width: 5ch;
                    text-align: right;
                }
                .aq-actual-skills {
                    display: flex;
                    gap: 3px;
                    opacity: 0.7;
                    width: 18ch;
                    min-width: 18ch;
                    justify-content: flex-end;
                }
                .aq-actual-skill {
                    color: #8bf;
                }
                .aq-actual-time {
                    opacity: 0.5;
                }

                /* Comparison table */
                .aq-comp-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.75em;
                }
                .aq-comp-table th, .aq-comp-table td {
                    padding: 2px 4px;
                    text-align: left;
                    border-bottom: 1px solid #333;
                }
                .aq-comp-table th {
                    opacity: 0.6;
                    font-weight: normal;
                }
                .aq-comp-worse {
                    color: #d55;
                }
                .aq-comp-better {
                    color: #5a5;
                }
                .aq-comp-exact {
                    color: #888;
                }
                .aq-comp-skills {
                    font-size: 0.9em;
                    opacity: 0.8;
                }

                /* Empty state */
                .aq-empty {
                    opacity: 0.5;
                    font-style: italic;
                    padding: 8px;
                    text-align: center;
                }

                /* Strategy reasoning log */
                .aq-reason-header {
                    padding: 2px 0 4px;
                    border-bottom: 1px solid #444;
                    margin-bottom: 4px;
                }
                .aq-reason-section {
                    margin: 4px 0;
                }
                .aq-reason-label {
                    font-weight: bold;
                    opacity: 0.7;
                    font-size: 0.9em;
                    margin-bottom: 2px;
                }
                .aq-reason-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                    padding-left: 8px;
                }
                .aq-reason-grid > span {
                    line-height: 1.4;
                }
                .aq-reason-queued {
                    color: #8c8;
                }
                .aq-reason-skipped {
                    color: #c88;
                    opacity: 0.8;
                }
            </style>
            <div class="aq-controls" style="display: flex; gap: 4px; flex-wrap: wrap;">
                <button class="aq-start-btn">Start</button>
                <button class="aq-stop-btn">Stop</button>
                <button class="aq-next-btn" title="Execute the next queue entry, then stop">Next</button>
                <button class="aq-drain-btn" title="Drain all energy using the drain strategy, then trigger reset">Drain</button>
                <button class="aq-reset-btn">Reset</button>
                <button class="aq-clear-btn">Clear</button>
                <button class="aq-undo-btn">Undo</button>
                <label class="aq-stop-after" style="margin-left: 8px; display: flex; align-items: center; gap: 4px; font-size: 0.85em; opacity: 0.8;" title="Stop after the current queue finishes (no drain, no repeat, no sequencing)">
                    <input type="checkbox" class="aq-setting-stop-after"> Stop after
                </label>
                <span class="aq-status-text" style="margin-left: 8px; align-self: center;"></span>
            </div>
            <div class="aq-loadout-bar" style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
                <select class="aq-loadout-select" style="flex: 1; background: #333; color: #ccc; border: 1px solid #555; border-radius: 3px; padding: 2px 4px;"></select>
                <button class="aq-loadout-save" title="Save current queue to loadout">Save</button>
                <button class="aq-loadout-new" title="Create new loadout">New</button>
                <button class="aq-loadout-rename" title="Rename loadout">Rename</button>
                <button class="aq-loadout-delete" title="Delete loadout">Del</button>
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
                    <hr style="border: none; border-top: 1px solid #444; margin: 4px 0;">
                    <label style="display: flex; align-items: center; gap: 6px;">
                        <input type="checkbox" class="aq-setting-add-to-top">
                        Add new actions to top of queue
                    </label>
                    <label style="display: flex; align-items: center; gap: 6px;" title="Actions are executed immediately when added. Queue stops at the end.">
                        <input type="checkbox" class="aq-setting-immediate">
                        Immediate mode
                    </label>
                    <hr style="border: none; border-top: 1px solid #444; margin: 4px 0;">
                    <div class="aq-sequencing" style="display: flex; flex-direction: column; gap: 4px;">
                        <div style="font-weight: bold; font-size: 0.85em;">Loadout Sequencing</div>
                        <label style="display: flex; align-items: center; gap: 6px;">
                            Repeat
                            <input type="number" class="aq-seq-repeat" min="0" max="9999" value="1" style="width: 50px; background: #333; color: #ccc; border: 1px solid #555; border-radius: 3px; padding: 1px 3px;">
                            times (0 = infinite)
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px;">
                            Then switch to
                            <select class="aq-seq-next" style="flex: 1; background: #333; color: #ccc; border: 1px solid #555; border-radius: 3px; padding: 2px 4px;">
                                <option value="-1">(stop)</option>
                            </select>
                        </label>
                    </div>
                    <hr style="border: none; border-top: 1px solid #444; margin: 4px 0;">
                    <div style="font-weight: bold; font-size: 0.85em; opacity: 0.7;">Debug</div>
                    <label style="display: flex; align-items: center; gap: 6px;">
                        <input type="checkbox" class="aq-setting-show-actuals">
                        Show actuals in current list
                    </label>
                    <label style="display: flex; align-items: center; gap: 6px;">
                        <input type="checkbox" class="aq-setting-show-comparison">
                        Show prediction comparison
                    </label>
                    <hr style="border: none; border-top: 1px solid #444; margin: 4px 0;">
                    <label style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-weight: bold; font-size: 0.85em;">Auto-Queue Strategy</span>
                        <select class="aq-strategy-level" style="flex: 1; background: #333; color: #ccc; border: 1px solid #555; border-radius: 3px; padding: 2px 4px;">
                            <option value="baseline">Baseline</option>
                            <option value="itemCollection">Item Collection</option>
                            <option value="pushCollect" selected>Push/Collect</option>
                            <option value="grindPushCollect" disabled>Grind with Push/Collect</option>
                            <option value="artifactUsage" disabled>Artifact Usage</option>
                        </select>
                    </label>
                    <label style="display: flex; align-items: center; gap: 6px;">
                        <input type="checkbox" class="aq-setting-verbose-log">
                        Verbose Strategy Log
                    </label>
                </div>
            </details>
            <details class="aq-actions-section" style="flex-shrink: 0;" open></details>
            <details class="aq-reasoning-details" style="border: 1px solid #444; border-radius: 4px; padding: 4px 8px; background: #252525; flex-shrink: 0;">
                <summary style="cursor: pointer; user-select: none; font-weight: bold; padding: 2px 0; font-size: 0.85em;">Strategy Log</summary>
                <div class="aq-reasoning-body" style="font-size: 0.8em; padding: 4px 0; font-family: monospace;"></div>
            </details>
            <div class="aq-queue-section" style="min-height: 60px;"></div>
        `;

        this._setupControls();
        this._setupLoadouts();
        this._setupSettings();
        this._setupSequencing();
        this._setupQueue();
        this._setupCollapsibleState();
    }

    _setupControls() {
        const el = this.rootElement;
        const statusText = el.querySelector('.aq-status-text');

        this._loadoutRunCount = 0;

        el.querySelector('.aq-start-btn').addEventListener('click', () => {
            const settings = this._savedSettings ? this._savedSettings() : {};
            const isImmediate = settings.immediateMode && !loadoutManager?.isStrategyBacked(loadoutManager.activeIndex);

            if (!executor && queue) {
                const execSettings = isImmediate ? { ...settings, drainEnabled: false, autoReset: false } : settings;
                executor = new JTAQueueExecutor(queue, getModuleEventBus(), moduleId, execSettings);
                executor.onStatusChange = () => this._refreshUI();
                executor.onQueueExhausted = () => this._handleQueueExhausted(statusText);
                executor.onBeforeReset = () => this._regenerateStrategyQueue();
            }
            if (executor) {
                if (isImmediate) {
                    // Immediate mode: override config, clear old snapshot, skip strategy regen
                    executor.updateConfig({ drainEnabled: false, autoReset: false });
                    executor.clearSnapshot();
                } else {
                    // Normal mode: regenerate strategy queue if applicable
                    if (this._regenerateStrategyQueue()) {
                        executor.clearSnapshot();
                        if (queuePanelUI) queuePanelUI.refresh();
                    }
                }
                // Initialize tracking state before starting
                if (lastSimState) {
                    executor.setTrackingState(
                        lastSimState.currentEnergy,
                        lastGameState ? snapshotSkillsFromGameState(lastGameState) : null
                    );
                }
                executor.start();
                if (isImmediate) {
                    statusText.textContent = 'Running (immediate)...';
                } else {
                    const isStrategy = loadoutManager?.isStrategyBacked(loadoutManager.activeIndex);
                    const levelLabel = this._savedSettings ? this._savedSettings().strategyLevel : '';
                    statusText.textContent = isStrategy ? `Running [${levelLabel}]...` : 'Running...';
                }
                this._refreshUI();
            }
        });

        el.querySelector('.aq-next-btn').addEventListener('click', () => {
            const settings = this._savedSettings ? this._savedSettings() : {};
            const isImmediate = settings.immediateMode && !loadoutManager?.isStrategyBacked(loadoutManager.activeIndex);

            if (!executor && queue) {
                const execSettings = isImmediate ? { ...settings, drainEnabled: false, autoReset: false } : settings;
                executor = new JTAQueueExecutor(queue, getModuleEventBus(), moduleId, execSettings);
                executor.onStatusChange = () => this._refreshUI();
                executor.onQueueExhausted = () => this._handleQueueExhausted(statusText);
                executor.onBeforeReset = () => this._regenerateStrategyQueue();
            }
            if (executor) {
                // Regenerate strategy queue before stepping if no snapshot yet
                if (!executor.snapshot) {
                    if (!isImmediate) {
                        if (this._regenerateStrategyQueue()) {
                            executor.clearSnapshot();
                            if (queuePanelUI) queuePanelUI.refresh();
                        }
                    }
                    if (lastSimState) {
                        executor.setTrackingState(
                            lastSimState.currentEnergy,
                            lastGameState ? snapshotSkillsFromGameState(lastGameState) : null
                        );
                    }
                }
                if (isImmediate) {
                    executor.updateConfig({ drainEnabled: false, autoReset: false });
                }
                executor.stepOne();
                statusText.textContent = 'Stepping...';
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

        el.querySelector('.aq-drain-btn').addEventListener('click', () => {
            // Create a temporary executor with an empty queue to drain energy and reset
            if (executor) executor.stop();
            const emptyQueue = new ActionQueue();
            const drainSettings = this._savedSettings ? this._savedSettings() : {};
            drainSettings.drainEnabled = true;
            drainSettings.autoReset = true;
            const drainExecutor = new JTAQueueExecutor(emptyQueue, getModuleEventBus(), moduleId, drainSettings);
            drainExecutor.onStatusChange = () => this._refreshUI();
            drainExecutor.onQueueExhausted = () => {
                statusText.textContent = 'Draining energy...';
            };
            // When the drain executor resets, it will request detailed state and
            // create a new snapshot from the empty queue — which exhausts immediately.
            // Detect the second exhaustion as "drain complete" and stop.
            let drainResetOccurred = false;
            const origOnExhausted = drainExecutor.onQueueExhausted;
            drainExecutor.onQueueExhausted = () => {
                if (drainResetOccurred) {
                    // Energy was drained and reset happened — we're done
                    drainExecutor.stop();
                    executor = null; // Clear so Start creates a fresh executor
                    statusText.textContent = 'Drained and reset';
                    this._refreshUI();
                    // Request fresh state for predictions
                    this._requestPredictionState();
                    return;
                }
                drainResetOccurred = true;
                statusText.textContent = 'Draining energy...';
            };
            // Replace module executor temporarily
            executor = drainExecutor;
            drainExecutor.start();
            statusText.textContent = 'Draining...';
            this._refreshUI();
        });

        el.querySelector('.aq-reset-btn').addEventListener('click', () => {
            this._loadoutRunCount = 0;
            if (executor) {
                executor.clearSnapshot();
                statusText.textContent = 'Reset';
                this._refreshUI();
            }
        });

        el.querySelector('.aq-clear-btn').addEventListener('click', () => {
            if (executor) executor.clearSnapshot();
            if (queue) {
                queue.clear();
                statusText.textContent = 'Cleared';
                this._refreshUI();
                this._saveLoadout();
            }
        });

        el.querySelector('.aq-undo-btn').addEventListener('click', () => {
            if (queue && queue.undoLast()) {
                statusText.textContent = 'Undone';
                this._refreshUI();
                this._saveLoadout();
            }
        });
    }

    _handleQueueExhausted(statusText) {
        // "Stop after" overrides all continuation logic
        const stopAfter = this.rootElement.querySelector('.aq-setting-stop-after');
        if (stopAfter?.checked) {
            stopAfter.checked = false;
            if (executor) executor.stop();
            statusText.textContent = 'Queue finished (stopped)';
            this._refreshUI();
            return;
        }

        // Immediate mode: check if new entries were added while executing
        // Only applies to non-strategy loadouts (Auto loadouts use repeat/sequencing below)
        const settings = this._savedSettings ? this._savedSettings() : {};
        if (settings.immediateMode && !loadoutManager?.isStrategyBacked(loadoutManager.activeIndex)) {
            const snapshotCount = executor?.snapshot?.length || 0;
            const queueCount = queue ? queue.getEntries().length : 0;
            if (queueCount > snapshotCount) {
                // New entries were added — append and continue from where we left off
                if (executor) {
                    executor.appendNewEntries();
                    executor.resumeAfterAppend();
                }
                statusText.textContent = 'Running (immediate)...';
                this._refreshUI();
                return;
            }
            // No new entries — stop
            if (executor) executor.stop();
            statusText.textContent = 'Ready (immediate)';
            this._refreshUI();
            return;
        }

        if (!loadoutManager) {
            statusText.textContent = 'Queue finished';
            return;
        }

        this._loadoutRunCount = (this._loadoutRunCount || 0) + 1;
        const seq = loadoutManager.getSequencing(loadoutManager.activeIndex);

        // Check if we should repeat this loadout
        if (seq.repeatCount === 0 || this._loadoutRunCount < seq.repeatCount) {
            // Regenerate strategy queue if applicable (picks new actions based on current state)
            if (this._regenerateStrategyQueue()) {
                if (executor) executor.clearSnapshot();
                if (queuePanelUI) queuePanelUI.refresh();
                if (executor) executor.start();
            } else {
                if (executor) executor.restart();
            }
            const isStrategy = loadoutManager?.isStrategyBacked(loadoutManager.activeIndex);
            const levelLabel = this._savedSettings ? this._savedSettings().strategyLevel : '';
            statusText.textContent = `Running${isStrategy ? ` [${levelLabel}]` : ''}... (repeat ${this._loadoutRunCount + 1}${seq.repeatCount > 0 ? '/' + seq.repeatCount : ''})`;
            return;
        }

        // Check if we should switch to next loadout
        if (seq.nextLoadout >= 0 && seq.nextLoadout < loadoutManager.count) {
            this._loadoutRunCount = 0;
            loadoutManager.saveActive(queue);
            if (executor) executor.clearSnapshot();
            loadoutManager.switchTo(seq.nextLoadout, queue);
            // Regenerate if new loadout is strategy-backed
            this._regenerateStrategyQueue();
            if (this._refreshLoadouts) this._refreshLoadouts();
            if (queuePanelUI) queuePanelUI.refresh();

            // Start the new loadout
            if (executor) executor.start();
            statusText.textContent = `Running ${loadoutManager.activeName}...`;
            return;
        }

        // No sequencing — fall through to drain or stop
        const settings2 = this._savedSettings ? this._savedSettings() : {};
        statusText.textContent = settings2.drainEnabled !== false ? 'Draining energy...' : 'Queue finished';
    }

    /**
     * If immediate mode is active and the executor is idle, start execution
     * so the newly-added entry runs immediately.
     */
    _maybeExecuteImmediate() {
        const settings = this._savedSettings ? this._savedSettings() : {};
        if (!settings.immediateMode) return;
        if (!queue) return;

        // Don't auto-execute for strategy-backed (Auto) loadouts — they manage their own queue
        if (loadoutManager?.isStrategyBacked(loadoutManager.activeIndex)) return;

        const statusText = this.rootElement.querySelector('.aq-status-text');

        // Create executor if needed
        if (!executor) {
            const execSettings = { ...settings, drainEnabled: false, autoReset: false };
            executor = new JTAQueueExecutor(queue, getModuleEventBus(), moduleId, execSettings);
            executor.onStatusChange = () => this._refreshUI();
            executor.onQueueExhausted = () => this._handleQueueExhausted(statusText);
            executor.onBeforeReset = () => this._regenerateStrategyQueue();
        }

        // If already running, the new entry will be picked up by _handleQueueExhausted
        if (executor.isRunning) return;

        // Override drain/reset for immediate mode
        executor.updateConfig({ drainEnabled: false, autoReset: false });

        // Append new entries to existing snapshot (preserves completed state)
        // If no snapshot exists, start() will create one from the full queue
        if (executor.snapshot) {
            executor.appendNewEntries();
        }

        // Set tracking state if available
        if (lastSimState) {
            executor.setTrackingState(
                lastSimState.currentEnergy,
                lastGameState ? snapshotSkillsFromGameState(lastGameState) : null
            );
        }

        executor.start();
        if (statusText) statusText.textContent = 'Running (immediate)...';
        this._refreshUI();
    }

    _setupLoadouts() {
        const el = this.rootElement;
        const select = el.querySelector('.aq-loadout-select');

        const refreshSelect = () => {
            if (!loadoutManager) return;
            const loadouts = loadoutManager.getLoadouts();
            select.innerHTML = loadouts.map((l, i) =>
                `<option value="${i}">${l.name}</option>`
            ).join('');
            select.selectedIndex = loadoutManager.activeIndex;
            this._refreshSequencingUI();
        };

        select.addEventListener('change', () => {
            if (!loadoutManager || !queue) return;
            // Save current queue before switching
            loadoutManager.saveActive(queue);
            if (executor) executor.clearSnapshot();
            loadoutManager.switchTo(select.selectedIndex, queue);
            // Regenerate if switching to a strategy-backed loadout
            if (!this._regenerateStrategyQueue()) {
                this._lastReasoning = null;
                this._refreshReasoningLog();
            }
            this._refreshUI();
            if (queuePanelUI) queuePanelUI.refresh();
            this._refreshSequencingUI();
            this._schedulePredictions();
        });

        el.querySelector('.aq-loadout-save').addEventListener('click', () => {
            if (loadoutManager && queue) {
                loadoutManager.saveActive(queue);
            }
        });

        el.querySelector('.aq-loadout-new').addEventListener('click', () => {
            if (!loadoutManager || !queue) return;
            loadoutManager.saveActive(queue);
            const name = prompt('Loadout name:', `Loadout ${loadoutManager.count + 1}`);
            if (name === null) return;
            loadoutManager.create(name, queue);
            if (executor) executor.clearSnapshot();
            refreshSelect();
            this._refreshUI();
            if (queuePanelUI) queuePanelUI.refresh();
        });

        el.querySelector('.aq-loadout-rename').addEventListener('click', () => {
            if (!loadoutManager) return;
            const name = prompt('New name:', loadoutManager.activeName);
            if (name === null) return;
            loadoutManager.rename(loadoutManager.activeIndex, name);
            refreshSelect();
        });

        el.querySelector('.aq-loadout-delete').addEventListener('click', () => {
            if (!loadoutManager || !queue) return;
            if (loadoutManager.count <= 1) return;
            if (!confirm(`Delete "${loadoutManager.activeName}"?`)) return;
            loadoutManager.delete(loadoutManager.activeIndex);
            loadoutManager.loadActive(queue);
            if (executor) executor.clearSnapshot();
            refreshSelect();
            this._refreshUI();
            if (queuePanelUI) queuePanelUI.refresh();
        });

        // Initial populate
        refreshSelect();
        this._refreshLoadouts = refreshSelect;
    }

    _refreshSequencingUI() {
        const el = this.rootElement;
        if (!loadoutManager) return;

        const repeatInput = el.querySelector('.aq-seq-repeat');
        const nextSelect = el.querySelector('.aq-seq-next');
        if (!repeatInput || !nextSelect) return;

        const seq = loadoutManager.getSequencing(loadoutManager.activeIndex);
        repeatInput.value = seq.repeatCount;

        // Populate next-loadout dropdown
        const loadouts = loadoutManager.getLoadouts();
        nextSelect.innerHTML = '<option value="-1">(stop)</option>' +
            loadouts.map((l, i) => `<option value="${i}">${l.name}</option>`).join('');
        nextSelect.value = String(seq.nextLoadout);
    }

    _setupSequencing() {
        const el = this.rootElement;
        const repeatInput = el.querySelector('.aq-seq-repeat');
        const nextSelect = el.querySelector('.aq-seq-next');

        const persistSeq = () => {
            if (!loadoutManager) return;
            loadoutManager.updateSequencing(loadoutManager.activeIndex, {
                repeatCount: parseInt(repeatInput.value, 10) || 0,
                nextLoadout: parseInt(nextSelect.value, 10),
            });
        };

        repeatInput.addEventListener('change', persistSeq);
        nextSelect.addEventListener('change', persistSeq);
    }

    _setupSettings() {
        const el = this.rootElement;
        const drainCheckbox = el.querySelector('.aq-setting-drain');
        const drainOptions = el.querySelector('.aq-drain-options');
        const autoResetCheckbox = el.querySelector('.aq-setting-autoreset');
        const addToTopCheckbox = el.querySelector('.aq-setting-add-to-top');
        const immediateCheckbox = el.querySelector('.aq-setting-immediate');
        const showActualsCheckbox = el.querySelector('.aq-setting-show-actuals');
        const showComparisonCheckbox = el.querySelector('.aq-setting-show-comparison');
        const radios = el.querySelectorAll('input[name="aq-drain-strategy"]');

        // Auto-queue strategy level dropdown (disabled for now)
        const strategyLevelSelect = el.querySelector('.aq-strategy-level');
        const verboseLogCheckbox = el.querySelector('.aq-setting-verbose-log');

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
            if (saved.addToTop === true) {
                addToTopCheckbox.checked = true;
            }
            if (saved.immediateMode === true) {
                immediateCheckbox.checked = true;
            }
            if (saved.showActuals === true) {
                showActualsCheckbox.checked = true;
            }
            if (saved.showComparison === true) {
                showComparisonCheckbox.checked = true;
            }
            if (saved.drainStrategy) {
                const radio = el.querySelector(`input[name="aq-drain-strategy"][value="${saved.drainStrategy}"]`);
                if (radio) radio.checked = true;
            }
            if (saved.strategyLevel) {
                strategyLevelSelect.value = saved.strategyLevel;
            }
            if (saved.verboseLog === true) {
                verboseLogCheckbox.checked = true;
            }
        } catch (e) { /* ignore */ }

        const persistSettings = () => {
            const strategy = el.querySelector('input[name="aq-drain-strategy"]:checked')?.value || 'mostDraining';
            const settings = {
                drainEnabled: drainCheckbox.checked,
                drainStrategy: strategy,
                autoReset: autoResetCheckbox.checked,
                addToTop: addToTopCheckbox.checked,
                immediateMode: immediateCheckbox.checked,
                showActuals: showActualsCheckbox.checked,
                showComparison: showComparisonCheckbox.checked,
                strategyLevel: strategyLevelSelect.value,
                verboseLog: verboseLogCheckbox.checked,
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
        addToTopCheckbox.addEventListener('change', persistSettings);
        immediateCheckbox.addEventListener('change', persistSettings);
        strategyLevelSelect.addEventListener('change', persistSettings);
        for (const radio of radios) {
            radio.addEventListener('change', persistSettings);
        }

        const updateDisplayOptions = () => {
            if (queuePanelUI) queuePanelUI.setDisplayOptions({
                showActuals: showActualsCheckbox.checked,
                showComparison: showComparisonCheckbox.checked,
            });
        };
        showActualsCheckbox.addEventListener('change', () => { persistSettings(); updateDisplayOptions(); });
        showComparisonCheckbox.addEventListener('change', () => { persistSettings(); updateDisplayOptions(); });
        verboseLogCheckbox.addEventListener('change', () => { persistSettings(); this._refreshReasoningLog(); });

        // Store ref so executor can be initialized with saved settings
        this._savedSettings = () => {
            const strategy = el.querySelector('input[name="aq-drain-strategy"]:checked')?.value || 'mostDraining';
            return {
                drainEnabled: drainCheckbox.checked,
                drainStrategy: strategy,
                autoReset: autoResetCheckbox.checked,
                addToTop: addToTopCheckbox.checked,
                immediateMode: immediateCheckbox.checked,
                strategyLevel: strategyLevelSelect.value,
            };
        };
    }

    /**
     * If the active loadout is strategy-backed, regenerate its queue entries
     * from the current game state.
     * @returns {boolean} true if regeneration occurred
     */
    _regenerateStrategyQueue() {
        if (!loadoutManager || !queue || !lastSimState) return false;
        const strategy = loadoutManager.getStrategy(loadoutManager.activeIndex);
        if (!strategy) return false;

        const strategyLevel = this._savedSettings ? this._savedSettings().strategyLevel : StrategyLevel.PUSH_COLLECT;
        const result = buildQueueForStrategy(lastSimState, strategy, strategyLevel);
        queue.clear();
        for (const entry of result.entries) queue.add(entry);
        loadoutManager.saveActive(queue);
        this._lastReasoning = result.reasoning;
        this._refreshReasoningLog();
        log('info', `Regenerated strategy queue: ${strategyLevel} (${result.entries.length} entries)`);
        return true;
    }

    _refreshReasoningLog() {
        const body = this.rootElement?.querySelector('.aq-reasoning-body');
        if (!body) return;

        const r = this._lastReasoning;
        if (!r) {
            body.innerHTML = '<div style="opacity: 0.5; font-style: italic;">No strategy queue generated yet.</div>';
            return;
        }

        // Helpers for table formatting
        const pad = (str, len) => String(str).padEnd(len);
        const rpad = (str, len) => String(str).padStart(len);
        const truncName = (name, max) => name.length > max ? name.substring(0, max - 1) + '…' : name;
        const tblRow = (cls, cols) => `<span class="${cls}">${cols}</span>`;
        const pre = (html) => `<pre style="margin:0; font-size:inherit; font-family:inherit; white-space:pre;">${html}</pre>`;

        const sections = [];

        // Header: strategy level + run type
        sections.push(`<div class="aq-reason-header"><strong>${r.strategyLevel}</strong> — ${r.runType || 'unknown'} run</div>`);

        // State summary
        const s = r.state;
        const skillParts = Object.entries(s.skillLevels).map(([name, lvl]) => `${name}:${lvl}`).join(' ');
        const itemParts = Object.entries(s.items).map(([name, count]) => `${name}×${count}`).join(', ');
        sections.push(`<div class="aq-reason-section"><div class="aq-reason-label">State</div><div class="aq-reason-grid">` +
            `<span>Energy: ${fmtE(s.maxEnergy)}${s.currentEnergy !== undefined ? ` (current: ${fmtE(s.currentEnergy)})` : ''} | Zone: ${s.highestZone + 1} | Perks: ${s.perkCount}</span>` +
            (skillParts ? `<span>Skills: ${skillParts}</span>` : '') +
            (itemParts ? `<span>Items: ${itemParts} (${fmtE(s.itemEnergy)} energy)</span>` : '<span>Items: none</span>') +
            `</div></div>`);

        // Push/collect decision
        if (r.pushCollect) {
            const pc = r.pushCollect;
            sections.push(`<div class="aq-reason-section"><div class="aq-reason-label">Push/Collect Decision</div><div class="aq-reason-grid">` +
                `<span>${pc.shouldPush ? '→ PUSH' : '→ COLLECT'}: ${pc.reason}</span>` +
                (pc.nextNewZone !== null ? `<span>Next new zone: ${pc.nextNewZone + 1}, traversal cost: ${fmtE(pc.totalCostToNextNewZone)}</span>` : '') +
                `<span>Energy: ${fmtE(pc.energy)}, item energy: ${fmtE(pc.itemEnergy)}</span>` +
                `</div></div>`);
        }

        // Items consumed
        if (r.itemsConsumed.length > 0) {
            const itemRows = r.itemsConsumed.map(ic => {
                if (ic.type === 'energy') return `<span class="aq-reason-queued">${ic.name} ×${ic.count} (+${fmtE(ic.energyValue)} energy)</span>`;
                return `<span class="aq-reason-queued">${ic.name} ×${ic.count} (skill boost)</span>`;
            }).join('');
            sections.push(`<div class="aq-reason-section"><div class="aq-reason-label">Items Consumed</div><div class="aq-reason-grid">${itemRows}</div></div>`);
        }

        // Reachability table
        if (r.reachability.zones) {
            const reach = r.reachability;
            const NW = 22; // zone name width
            const rows = [];
            rows.push(`${rpad('Z', 2)} ${pad('Zone', NW)} ${rpad('Cost', 7)} ${rpad('Remain', 7)}`);
            rows.push('─'.repeat(NW + 19));
            for (let i = 0; i < reach.zones.length; i++) {
                const z = reach.zones[i];
                const prev = i > 0 ? reach.zones[i - 1] : null;
                const cost = prev ? prev.mandatoryCost : 0;
                const remain = prev ? prev.energyAfter : 0;
                rows.push(`${rpad(z.zoneId + 1, 2)} ${pad(truncName(z.zoneName, NW), NW)} ${rpad(fmtE(cost), 7)} ${rpad(fmtE(remain), 7)}`);
            }
            if (reach.borderZone) {
                const bz = reach.borderZone;
                const last = reach.zones[reach.zones.length - 1];
                const cost = last ? last.mandatoryCost : 0;
                const remain = last ? last.energyAfter : 0;
                rows.push(`${rpad(bz.zoneId + 1, 2)} ${pad(truncName(bz.zoneName, NW), NW)} ${rpad(fmtE(cost), 7)} ${rpad(fmtE(remain), 7)}`);
                rows.push(`<span class="aq-reason-skipped">${rpad(bz.nextZoneId + 1, 2)} ${pad(truncName(bz.nextZoneName, NW), NW)} ${rpad(fmtE(bz.mandatoryCost), 7)} ${rpad('-' + fmtE(bz.deficit), 7)}  need ${fmtE(bz.mandatoryCost)}</span>`);
            }
            sections.push(`<div class="aq-reason-section"><div class="aq-reason-label">Zone Reachability (${reach.zonesReachable} zones, ${fmtE(reach.totalEnergy)} energy)</div>${pre(rows.join('\n'))}</div>`);
        }

        // Perk decisions table
        if (r.perkDecisions.length > 0) {
            const NW = 22;
            const rows = [];
            rows.push(`  ${rpad('Z', 2)} ${pad('Task', NW)} ${rpad('Trav', 7)} ${rpad('Task', 7)} ${rpad('Total', 7)}  Reason`);
            rows.push('─'.repeat(NW + 41));
            for (const d of r.perkDecisions) {
                const mark = d.queued ? '✓' : '✗';
                const cls = d.queued ? 'aq-reason-queued' : 'aq-reason-skipped';
                rows.push(tblRow(cls, `${mark} ${rpad(d.zoneId + 1, 2)} ${pad(truncName(d.task, NW), NW)} ${rpad(fmtE(d.traversalCost), 7)} ${rpad(fmtE(d.fullCost), 7)} ${rpad(fmtE(d.totalEnergyNeeded), 7)}  ${d.reason}`));
            }
            sections.push(`<div class="aq-reason-section"><div class="aq-reason-label">Perk Tasks (Priority 1)</div>${pre(rows.join('\n'))}</div>`);
        }

        // Item decisions table
        if (r.itemDecisions.length > 0) {
            const NW = 22;
            const rows = [];
            rows.push(`  ${rpad('Z', 2)} ${pad('Task', NW)} ${rpad('Trav', 7)} ${rpad('Task', 7)} ${rpad('Value', 7)} ${rpad('Net', 7)}  Reason`);
            rows.push('─'.repeat(NW + 48));
            for (const d of r.itemDecisions) {
                const mark = d.queued ? '✓' : '✗';
                const cls = d.queued ? 'aq-reason-queued' : 'aq-reason-skipped';
                rows.push(tblRow(cls, `${mark} ${rpad(d.zoneId + 1, 2)} ${pad(truncName(d.task, NW), NW)} ${rpad(fmtE(d.traversalCost), 7)} ${rpad(fmtE(d.fullCost), 7)} ${rpad(fmtE(d.itemValue), 7)} ${rpad(fmtE(d.netGain), 7)}  ${d.reason}`));
            }
            sections.push(`<div class="aq-reason-section"><div class="aq-reason-label">Energy Items (Priority 2)</div>${pre(rows.join('\n'))}</div>`);
        }

        // Boost decisions table
        if (r.boostDecisions.length > 0) {
            const NW = 22;
            const rows = [];
            rows.push(`  ${rpad('Z', 2)} ${pad('Task', NW)} ${rpad('Trav', 7)} ${rpad('Task', 7)} ${rpad('Bon/E', 7)}  Reason`);
            rows.push('─'.repeat(NW + 41));
            for (const d of r.boostDecisions) {
                const mark = d.queued ? '✓' : '✗';
                const cls = d.queued ? 'aq-reason-queued' : 'aq-reason-skipped';
                rows.push(tblRow(cls, `${mark} ${rpad(d.zoneId + 1, 2)} ${pad(truncName(d.task, NW), NW)} ${rpad(fmtE(d.traversalCost), 7)} ${rpad(fmtE(d.fullCost), 7)} ${rpad(d.bonusPerEnergy.toFixed(3), 7)}  ${d.reason}`));
            }
            sections.push(`<div class="aq-reason-section"><div class="aq-reason-label">Skill Boost Items (Priority 3)</div>${pre(rows.join('\n'))}</div>`);
        }

        // Boss decisions table
        if (r.bossDecisions.length > 0) {
            const NW = 22;
            const rows = [];
            rows.push(`  ${rpad('Z', 2)} ${pad('Task', NW)} ${rpad('Trav', 7)} ${rpad('Task', 7)}  Reason`);
            rows.push('─'.repeat(NW + 31));
            for (const d of r.bossDecisions) {
                const mark = d.queued ? '✓' : '✗';
                const cls = d.queued ? 'aq-reason-queued' : 'aq-reason-skipped';
                rows.push(tblRow(cls, `${mark} ${rpad(d.zoneId + 1, 2)} ${pad(truncName(d.task, NW), NW)} ${rpad(fmtE(d.traversalCost), 7)} ${rpad(fmtE(d.fullCost), 7)}  ${d.reason}`));
            }
            sections.push(`<div class="aq-reason-section"><div class="aq-reason-label">Boss Tasks (Priority 4)</div>${pre(rows.join('\n'))}</div>`);
        }

        // Grind plan / All tasks table
        const verbose = this.rootElement?.querySelector('.aq-setting-verbose-log')?.checked || false;
        const NW = 22;
        if (verbose && r.allTasks) {
            const selectedNames = new Set(r.grindPlan.tasks.map(gt => gt.task));
            const gp = r.grindPlan;
            const rows = [];
            rows.push(`Budget: ${fmtE(gp.budget)}, selected ${gp.tasksSelected} of ${gp.tasksConsidered} grindable`);
            rows.push('');
            rows.push(`  ${rpad('Z', 2)} ${pad('Task', NW)} ${rpad('Cost', 7)} ${rpad('XP/E', 8)} ${pad('Skills', 7)} Type`);
            rows.push('─'.repeat(NW + 38));
            for (const t of r.allTasks) {
                const isSelected = selectedNames.has(t.task);
                const mark = isSelected ? '✓' : '·';
                const cls = isSelected ? 'aq-reason-queued' : 'aq-reason-skipped';
                const tags = [];
                if (t.type !== 'Normal') tags.push(t.type);
                if (t.hasPerk) tags.push('Perk');
                const tagStr = tags.join(',');
                rows.push(tblRow(cls, `${mark} ${rpad(t.zoneId + 1, 2)} ${pad(truncName(t.task, NW), NW)} ${rpad(fmtE(t.fullCost), 7)} ${rpad(t.xpPerEnergy.toFixed(2), 8)} ${pad(t.skills.join('/'), 7)} ${tagStr}`));
            }
            sections.push(`<div class="aq-reason-section"><div class="aq-reason-label">All Tasks by XP/E (Priority 5)</div>${pre(rows.join('\n'))}</div>`);
        } else if (r.grindPlan.tasksSelected > 0) {
            const gp = r.grindPlan;
            const rows = [];
            rows.push(`Budget: ${fmtE(gp.budget)}, selected ${gp.tasksSelected} of ${gp.tasksConsidered} candidates`);
            rows.push('');
            rows.push(`  ${rpad('Z', 2)} ${pad('Task', NW)} ${rpad('Cost', 7)} ${rpad('XP/E', 8)} Skills`);
            rows.push('─'.repeat(NW + 31));
            for (const gt of gp.tasks) {
                const note = gt.overBudget ? ' drain' : '';
                rows.push(tblRow('aq-reason-queued', `✓ ${rpad(gt.zoneId + 1, 2)} ${pad(truncName(gt.task, NW), NW)} ${rpad(fmtE(gt.fullCost), 7)} ${rpad(gt.totalXpPerEnergy.toFixed(2), 8)} ${gt.skills.join('/')}${note}`));
            }
            sections.push(`<div class="aq-reason-section"><div class="aq-reason-label">XP Grinding (Priority 5)</div>${pre(rows.join('\n'))}</div>`);
        } else if (r.grindPlan.budget !== undefined) {
            sections.push(`<div class="aq-reason-section"><div class="aq-reason-label">XP Grinding</div><div class="aq-reason-grid"><span class="aq-reason-skipped">None (budget: ${fmtE(r.grindPlan.budget)}, candidates: ${r.grindPlan.tasksConsidered})</span></div></div>`);
        }

        // Notes
        if (r.notes.length > 0) {
            const noteRows = r.notes.map(n => `<span>${n}</span>`).join('');
            sections.push(`<div class="aq-reason-section"><div class="aq-reason-label">Notes</div><div class="aq-reason-grid">${noteRows}</div></div>`);
        }

        body.innerHTML = sections.join('');
    }

    _saveLoadout() {
        if (loadoutManager && queue) loadoutManager.saveActive(queue);
    }

    _setupCollapsibleState() {
        const sections = [
            { selector: '.aq-settings', id: 'settings' },
            { selector: '.aq-actions-section', id: 'actions' },
            { selector: '.aq-reasoning-details', id: 'reasoning' },
            { selector: '.aq-current-section', id: 'current' },
            { selector: '.aq-next-section', id: 'next' },
        ];
        for (const { selector, id } of sections) {
            const el = this.rootElement.querySelector(selector);
            if (el) this._bindCollapsible(el, id);
        }
    }

    _bindCollapsible(el, id) {
        const KEY = 'jta-aq-collapsed';
        let saved;
        try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { saved = {}; }
        if (saved[id] !== undefined) el.open = saved[id];
        el.addEventListener('toggle', () => {
            let current;
            try { current = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { current = {}; }
            current[id] = el.open;
            localStorage.setItem(KEY, JSON.stringify(current));
        });
    }

    _setupQueue() {
        const queueSection = this.rootElement.querySelector('.aq-queue-section');
        queuePanelUI = new JTAQueuePanelUI(queueSection);

        // Apply saved display options
        try {
            const saved = JSON.parse(localStorage.getItem('jta-aq-settings') || '{}');
            queuePanelUI.setDisplayOptions({
                showActuals: saved.showActuals || false,
                showComparison: saved.showComparison || false,
            });
        } catch (e) { /* ignore */ }

        const onQueueChanged = () => {
            this._saveLoadout();
            this._schedulePredictions();
        };

        // queue may not exist yet (GL init runs before module init),
        // so also bind lazily when game defs arrive
        if (queue) queuePanelUI.bind(queue, onQueueChanged);

        // Handle actions dragged from actions panel onto queue
        queuePanelUI.onExternalDrop = (catalogEntry, targetIndex) => {
            if (!queue) return;
            const queueEntry = createQueueEntry(catalogEntry);
            queue.add(queueEntry, targetIndex);
            queuePanelUI.refresh();
            this._saveLoadout();
            this._maybeExecuteImmediate();
        };
    }

    _ensureQueueBound() {
        if (queuePanelUI && queue && !queuePanelUI._bound) {
            queuePanelUI.bind(queue, () => this._saveLoadout());
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

            // Refresh loadout dropdown (initialize() may have added strategy loadouts
            // after the dropdown was first populated during GL panel construction)
            if (this._refreshLoadouts) this._refreshLoadouts();

            // Request game state for initial predictions
            this._requestPredictionState();

            const actionsSection = this.rootElement.querySelector('.aq-actions-section');
            actionsPanelUI = new JTAActionsPanelUI(actionsSection);
            const getInsertIndex = () => {
                const settings = this._savedSettings ? this._savedSettings() : {};
                return settings.addToTop ? 0 : undefined;
            };
            actionsPanelUI.bind(queue, catalog, () => {
                if (queuePanelUI) queuePanelUI.refresh();
                this._saveLoadout();
                this._schedulePredictions();
                this._maybeExecuteImmediate();
            }, getInsertIndex);
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

        // Subscribe to detailed state for predictions
        const handleDetailedState = (data) => {
            if (!data || !data.state) return;
            lastGameState = data.state;
            lastSimState = convertToSimState(data.state);
            this._runPredictions();
        };
        const unsub3 = bus.subscribe('jta:detailedStateSnapshot', handleDetailedState);
        this._unsubs.push(typeof unsub3 === 'function' ? unsub3 : () => bus.unsubscribe('jta:detailedStateSnapshot', handleDetailedState));

        // Request immediately in case already connected
        setTimeout(() => {
            bus.publish('jta:requestGameDefs', {});
        }, 1000);
    }

    /** Request fresh game state for predictions */
    _requestPredictionState() {
        const bus = getModuleEventBus();
        bus.publish('jta:requestDetailedState', {});
    }

    /** Run predictions (debounced) */
    _schedulePredictions() {
        if (predictionDebounceTimer) clearTimeout(predictionDebounceTimer);
        predictionDebounceTimer = setTimeout(() => {
            predictionDebounceTimer = null;
            this._requestPredictionState();
        }, 250);
    }

    /** Run predictions with current sim state */
    _runPredictions() {
        if (!lastSimState || !queue) {
            predictions = null;
        } else {
            try {
                predictions = predictQueue(queue, lastSimState);
            } catch (e) {
                log('warn', 'Prediction error:', e);
                predictions = null;
            }
        }
        if (queuePanelUI) queuePanelUI.setPredictions(predictions);
    }

    _refreshUI() {
        if (queuePanelUI) {
            const snapshot = executor?.snapshot ?? null;
            // Freeze predictions onto new snapshots for comparison
            if (snapshot && !snapshot.frozenPredictions && predictions) {
                snapshot.frozenPredictions = new Map(predictions);
            }
            queuePanelUI.setSnapshot(snapshot);
            queuePanelUI.setPredictions(predictions);
        }
    }

    destroy() {
        for (const unsub of this._unsubs) {
            try { unsub(); } catch (e) { /* ignore */ }
        }
        this._unsubs = [];
        if (executor) executor.stop();
    }
}
