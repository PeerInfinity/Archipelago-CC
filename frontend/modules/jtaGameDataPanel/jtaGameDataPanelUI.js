// UI component for JTA game data panel module
import { getModuleEventBus } from './index.js';

// Helper function for logging with fallback
function log(level, message, ...data) {
    if (typeof window !== 'undefined' && window.logger) {
        window.logger[level]('jtaGameDataPanelUI', message, ...data);
    } else {
        const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
        consoleMethod(`[jtaGameDataPanelUI] ${message}`, ...data);
    }
}

export class JTAGameDataPanelUI {
    constructor(container, componentState) {
        this.container = container;
        this.componentState = componentState;
        Object.defineProperty(this, 'eventBus', { get: () => getModuleEventBus(), configurable: true });

        // UI element references
        this.rootElement = null;

        // Connection state
        this.isConnected = false;
        this.iframeId = null;
        this.lastConnectedTime = null;
        this.isIframeLoaded = false;
        this.loadedUrl = null;

        // Event log
        this.eventLog = [];
        this.maxLogEntries = 50;

        // CM6 editor
        this.editorView = null;
        this.editorInitialized = false;
        this.cm6Module = null;

        // Event subscriptions
        this.unsubscribeHandles = [];

        this.initialize();
        this.setupEventSubscriptions();

        log('info', 'JTAGameDataPanelUI initialized');
    }

    // Required method for Golden Layout
    getRootElement() {
        if (!this.rootElement) {
            this.createRootElement();
        }
        return this.rootElement;
    }

    initialize() {
        this.createRootElement();
    }

    createRootElement() {
        this.rootElement = document.createElement('div');
        this.rootElement.className = 'jta-game-data-panel-container';
        this.rootElement.style.cssText = 'height: 100%; overflow: auto; background: #1e1e1e; color: #cccccc;';
        this.rootElement.innerHTML = this._createPanelHTML();
        this._cacheElements();
        this._setupDomListeners();
    }

    _createPanelHTML() {
        return `
            <div class="jta-game-data-panel" style="padding: 15px;">
                <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #cccccc;">JTA Game Data</h3>

                <!-- Connection Status Section -->
                ${this._sectionHTML('connection', 'Connection Status', true, `
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                        <span class="jta-conn-dot" style="
                            width: 10px; height: 10px; border-radius: 50%;
                            background: #666; display: inline-block;
                        "></span>
                        <span class="jta-conn-label" style="font-size: 12px;">Disconnected</span>
                    </div>
                    <div style="font-size: 11px; color: #999;">
                        <div>Iframe ID: <span class="jta-conn-iframe-id">--</span></div>
                        <div>Last connected: <span class="jta-conn-last-time">--</span></div>
                    </div>
                `)}

                <!-- Game State Summary Section -->
                ${this._sectionHTML('gameState', 'Game State Summary', true, `
                    <div class="jta-game-state-grid" style="
                        display: grid; grid-template-columns: 1fr 1fr;
                        gap: 4px 12px; font-size: 11px; margin-bottom: 8px;
                    ">
                        <div>Zone: <strong class="jta-gs-zone">--</strong></div>
                        <div>Highest: <strong class="jta-gs-highest-zone">--</strong></div>
                        <div>Energy: <strong class="jta-gs-energy">--</strong></div>
                        <div>Resets: <strong class="jta-gs-resets">--</strong></div>
                        <div>Perks: <strong class="jta-gs-perks">--</strong></div>
                        <div>Prestige: <strong class="jta-gs-prestige">--</strong></div>
                    </div>
                    <button class="jta-refresh-btn" style="
                        padding: 4px 12px; background: #444; color: #ccc;
                        border: 1px solid #555; border-radius: 3px; cursor: pointer;
                        font-size: 11px;
                    ">Refresh</button>
                `)}

                <!-- Event Log Section -->
                ${this._sectionHTML('eventLog', 'Event Log', true, `
                    <div class="jta-log-container" style="
                        max-height: 200px; overflow-y: auto; font-size: 11px;
                        font-family: monospace; background: #2d2d30;
                        border: 1px solid #555; border-radius: 3px; padding: 6px;
                        min-height: 40px;
                    ">
                        <div class="jta-log-entries" style="color: #aaa;">No events yet</div>
                    </div>
                    <button class="jta-log-clear-btn" style="
                        padding: 4px 12px; background: #444; color: #ccc;
                        border: 1px solid #555; border-radius: 3px; cursor: pointer;
                        font-size: 11px; margin-top: 6px;
                    ">Clear</button>
                `)}

                <!-- Save Data Editor Section -->
                ${this._sectionHTML('saveEditor', 'Save Data Editor', false, `
                    <div style="margin-bottom: 8px; display: flex; gap: 6px; align-items: center;">
                        <button class="jta-export-btn" style="
                            padding: 5px 10px; background: #444; color: #ccc;
                            border: 1px solid #555; border-radius: 3px; cursor: pointer;
                            font-size: 11px;
                        ">Export from Game</button>
                        <button class="jta-import-btn" style="
                            padding: 5px 10px; background: #444; color: #ccc;
                            border: 1px solid #555; border-radius: 3px; cursor: pointer;
                            font-size: 11px;
                        ">Import to Game</button>
                        <span class="jta-editor-status" style="font-size: 11px; color: #999;"></span>
                    </div>
                    <div class="jta-editor-wrapper" style="
                        border: 1px solid #555; border-radius: 3px;
                        min-height: 200px; position: relative;
                    ">
                        <div class="jta-editor-empty" style="
                            position: absolute; inset: 0; display: flex;
                            align-items: center; justify-content: center;
                            color: #666; font-size: 12px; pointer-events: none;
                        ">Click "Export from Game" to load save data</div>
                        <div class="jta-editor-mount" style="height: 300px; overflow-y: auto;"></div>
                    </div>
                `)}
            </div>
        `;
    }

    _sectionHTML(id, title, defaultOpen, content) {
        const arrow = defaultOpen ? '\u25BC' : '\u25B6';
        const display = defaultOpen ? 'block' : 'none';
        return `
            <div class="jta-section" data-section="${id}" style="margin-bottom: 12px;">
                <div class="jta-section-header" data-section="${id}" style="
                    cursor: pointer; padding: 6px 8px; background: #2a2a2a;
                    border: 1px solid #444; border-radius: 3px;
                    font-size: 12px; font-weight: bold; user-select: none;
                    display: flex; align-items: center; gap: 6px;
                " title="Click to toggle">
                    <span class="jta-section-arrow">${arrow}</span>
                    ${title}
                </div>
                <div class="jta-section-body" data-section="${id}" style="
                    display: ${display}; padding: 8px; border: 1px solid #333;
                    border-top: none; border-radius: 0 0 3px 3px;
                ">
                    ${content}
                </div>
            </div>
        `;
    }

    _cacheElements() {
        const q = (sel) => this.rootElement.querySelector(sel);

        // Connection
        this._connDot = q('.jta-conn-dot');
        this._connLabel = q('.jta-conn-label');
        this._connIframeId = q('.jta-conn-iframe-id');
        this._connLastTime = q('.jta-conn-last-time');

        // Game state
        this._gsZone = q('.jta-gs-zone');
        this._gsHighestZone = q('.jta-gs-highest-zone');
        this._gsEnergy = q('.jta-gs-energy');
        this._gsResets = q('.jta-gs-resets');
        this._gsPerks = q('.jta-gs-perks');
        this._gsPrestige = q('.jta-gs-prestige');
        this._refreshBtn = q('.jta-refresh-btn');

        // Event log
        this._logEntries = q('.jta-log-entries');
        this._logClearBtn = q('.jta-log-clear-btn');

        // Save editor
        this._exportBtn = q('.jta-export-btn');
        this._importBtn = q('.jta-import-btn');
        this._editorStatus = q('.jta-editor-status');
        this._editorWrapper = q('.jta-editor-wrapper');
        this._editorEmpty = q('.jta-editor-empty');
        this._editorMount = q('.jta-editor-mount');
    }

    _setupDomListeners() {
        // Section toggle headers
        this.rootElement.querySelectorAll('.jta-section-header').forEach(header => {
            header.addEventListener('click', () => {
                const sectionId = header.dataset.section;
                const body = this.rootElement.querySelector(`.jta-section-body[data-section="${sectionId}"]`);
                const arrow = header.querySelector('.jta-section-arrow');
                if (!body) return;
                const isOpen = body.style.display !== 'none';
                body.style.display = isOpen ? 'none' : 'block';
                arrow.textContent = isOpen ? '\u25B6' : '\u25BC';

                // Lazy-init CM6 editor on first expand of save editor section
                if (sectionId === 'saveEditor' && !isOpen && !this.editorInitialized) {
                    this._initEditor();
                }
            });
        });

        // Refresh button - request state from iframe
        if (this._refreshBtn) {
            this._refreshBtn.addEventListener('click', () => {
                this.eventBus.publish('jta:requestState', {});
                this._refreshBtn.textContent = 'Refreshing...';
                setTimeout(() => { this._refreshBtn.textContent = 'Refresh'; }, 2000);
            });
        }

        // Clear log button
        if (this._logClearBtn) {
            this._logClearBtn.addEventListener('click', () => {
                this.eventLog = [];
                this._renderLog();
            });
        }

        // Export button
        if (this._exportBtn) {
            this._exportBtn.addEventListener('click', () => {
                this.eventBus.publish('jta:exportSave', {});
                this._setEditorStatus('Exporting...');
            });
        }

        // Import button
        if (this._importBtn) {
            this._importBtn.addEventListener('click', () => {
                const content = this._getEditorContent();
                if (!content) {
                    this._setEditorStatus('No data to import', true);
                    return;
                }
                try {
                    JSON.parse(content);
                } catch (e) {
                    this._setEditorStatus('Invalid JSON: ' + e.message, true);
                    return;
                }
                this.eventBus.publish('jta:importSave', { saveJson: content });
                this._setEditorStatus('Importing...');
            });
        }

        // Button hover effects
        this.rootElement.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('mouseenter', () => { btn.style.background = '#555'; });
            btn.addEventListener('mouseleave', () => { btn.style.background = '#444'; });
        });
    }

    // --- Event subscriptions ---

    setupEventSubscriptions() {
        if (!this.eventBus) return;

        const sub = (event, handler) => {
            const unsub = this.eventBus.subscribe(event, handler);
            this.unsubscribeHandles.push(unsub);
        };

        sub('iframe:connected', (data) => this._handleConnected(data));
        sub('iframe:disconnected', (data) => this._handleDisconnected(data));
        sub('iframePanel:loaded', (data) => this._handleIframeLoaded(data));
        sub('iframePanel:unloaded', (data) => this._handleIframeUnloaded(data));
        sub('jta:saveExported', (data) => this._handleSaveExported(data));
        sub('jta:stateSnapshot', (data) => this._handleStateSnapshot(data));
        sub('jta:zoneChanged', (data) => this._handleZoneChanged(data));
        sub('jta:energyReset', (data) => this._handleEnergyReset(data));
        sub('jta:prestige', (data) => this._handlePrestige(data));
        sub('jta:perkChanged', (data) => this._handlePerkChanged(data));
    }

    _handleConnected(data) {
        this.isConnected = true;
        this.iframeId = data.iframeId || data.id || '--';
        this.lastConnectedTime = new Date().toLocaleTimeString();
        this._updateConnectionUI();
        log('info', `Connected: ${this.iframeId}`);
    }

    _handleDisconnected(data) {
        this.isConnected = false;
        this._updateConnectionUI();
        log('info', `Disconnected: ${data?.iframeId || ''}`);
    }

    _handleIframeLoaded(data) {
        this.isIframeLoaded = true;
        if (data?.url) this.loadedUrl = data.url;
        log('info', 'Iframe loaded', data);
    }

    _handleIframeUnloaded(data) {
        this.isIframeLoaded = false;
        this.isConnected = false;
        this.iframeId = null;
        this._updateConnectionUI();
        log('info', 'Iframe unloaded', data);
    }

    _handleSaveExported(data) {
        if (data.error) {
            this._setEditorStatus(data.error, true);
            return;
        }

        const saveJson = data.saveJson;
        if (!saveJson) {
            this._setEditorStatus('No save data received', true);
            return;
        }

        // Load into editor
        this._setEditorContent(saveJson);
        this._setEditorStatus('Save data loaded');

        // Parse and update game state summary
        this._parseSaveAndUpdateSummary(saveJson);
    }

    _handleStateSnapshot(data) {
        const state = data.state;
        if (!state) return;

        if (this._gsZone) this._gsZone.textContent = state.currentZone;
        if (this._gsHighestZone) this._gsHighestZone.textContent = state.highestZoneEver;
        if (this._gsEnergy) this._gsEnergy.textContent = `${Math.floor(state.currentEnergy)}/${state.maxEnergy}`;
        if (this._gsResets) this._gsResets.textContent = state.energyResetCount;
        if (this._gsPerks) this._gsPerks.textContent = state.perkCount;
        if (this._gsPrestige) this._gsPrestige.textContent = state.prestigeCount;
    }

    _handleZoneChanged(data) {
        const time = new Date(data.timestamp).toLocaleTimeString('en-US', { hour12: false });
        this._addLogEntry(`[${time}] Zone: ${data.previousZone} -> ${data.currentZone} (highest: ${data.highestZone})`);
        // Update zone display
        if (this._gsZone) this._gsZone.textContent = data.currentZone;
        if (this._gsHighestZone) {
            const current = parseInt(this._gsHighestZone.textContent) || 0;
            if (data.highestZone > current) this._gsHighestZone.textContent = data.highestZone;
        }
    }

    _handleEnergyReset(data) {
        const time = new Date(data.timestamp).toLocaleTimeString('en-US', { hour12: false });
        this._addLogEntry(`[${time}] Energy reset #${data.resetCount}`);
        if (this._gsResets) this._gsResets.textContent = data.resetCount;
    }

    _handlePrestige(data) {
        const time = new Date(data.timestamp).toLocaleTimeString('en-US', { hour12: false });
        this._addLogEntry(`[${time}] Prestige #${data.prestigeCount}`);
        if (this._gsPrestige) this._gsPrestige.textContent = data.prestigeCount;
    }

    _handlePerkChanged(data) {
        const time = new Date(data.timestamp).toLocaleTimeString('en-US', { hour12: false });
        this._addLogEntry(`[${time}] Perks: ${data.perkCount}`);
        if (this._gsPerks) this._gsPerks.textContent = data.perkCount;
    }

    // --- UI updates ---

    _updateConnectionUI() {
        if (this._connDot) {
            this._connDot.style.background = this.isConnected ? '#4CAF50' : '#666';
        }
        if (this._connLabel) {
            this._connLabel.textContent = this.isConnected ? 'Connected' : 'Disconnected';
            this._connLabel.style.color = this.isConnected ? '#4CAF50' : '#999';
        }
        if (this._connIframeId) {
            this._connIframeId.textContent = this.iframeId || '--';
        }
        if (this._connLastTime) {
            this._connLastTime.textContent = this.lastConnectedTime || '--';
        }
    }

    _addLogEntry(entry) {
        this.eventLog.unshift(entry);
        if (this.eventLog.length > this.maxLogEntries) {
            this.eventLog.length = this.maxLogEntries;
        }
        this._renderLog();
        log('info', entry);
    }

    _renderLog() {
        if (!this._logEntries) return;
        if (this.eventLog.length === 0) {
            this._logEntries.textContent = 'No events yet';
            this._logEntries.style.color = '#aaa';
            return;
        }
        this._logEntries.style.color = '#ccc';
        this._logEntries.innerHTML = this.eventLog
            .map(entry => `<div style="padding: 1px 0;">${entry}</div>`)
            .join('');
    }

    _setEditorStatus(message, isError = false) {
        if (!this._editorStatus) return;
        this._editorStatus.textContent = message;
        this._editorStatus.style.color = isError ? '#f44336' : '#4CAF50';
        if (!isError) {
            setTimeout(() => {
                if (this._editorStatus) this._editorStatus.textContent = '';
            }, 3000);
        }
    }

    // --- Game state parsing ---

    _parseSaveAndUpdateSummary(saveJson) {
        try {
            const save = JSON.parse(saveJson);

            if (this._gsZone) this._gsZone.textContent = save.current_zone ?? '--';
            if (this._gsHighestZone) this._gsHighestZone.textContent = save.highest_zone_ever ?? save.highest_zone ?? '--';

            const energy = save.current_energy;
            const maxEnergy = save.max_energy;
            if (this._gsEnergy) {
                this._gsEnergy.textContent = energy != null && maxEnergy != null
                    ? `${Math.floor(energy)}/${maxEnergy}`
                    : '--';
            }

            if (this._gsResets) this._gsResets.textContent = save.energy_reset_count ?? '--';

            // Perks are saved as array of [perkType, boolean] entries
            let perkCount = '--';
            if (Array.isArray(save.perks)) {
                perkCount = save.perks.filter(([, owned]) => owned).length;
            }
            if (this._gsPerks) this._gsPerks.textContent = perkCount;

            if (this._gsPrestige) this._gsPrestige.textContent = save.prestige_count ?? '--';

        } catch (e) {
            log('warn', 'Failed to parse save for summary:', e.message);
        }
    }

    // --- CodeMirror 6 Editor ---

    async _initEditor() {
        if (this.editorInitialized) return;
        this.editorInitialized = true;

        try {
            this.cm6Module = await import('../../modules/editorCodeMirror6/codemirror6Imports.js');
            const {
                EditorView, EditorState, lineNumbers, highlightActiveLine,
                drawSelection, history, foldGutter, json, oneDark, keymap,
                defaultKeymap, historyKeymap, foldKeymap
            } = this.cm6Module;

            const extensions = [
                lineNumbers(),
                highlightActiveLine(),
                drawSelection(),
                history(),
                foldGutter(),
                json(),
                oneDark,
                EditorView.lineWrapping,
                keymap.of([
                    ...defaultKeymap,
                    ...historyKeymap,
                    ...foldKeymap,
                ]),
            ];

            this.editorView = new EditorView({
                state: EditorState.create({
                    doc: '',
                    extensions,
                }),
                parent: this._editorMount,
            });

            log('info', 'CM6 editor initialized');
        } catch (e) {
            log('error', 'Failed to initialize CM6 editor:', e);
            this._setEditorStatus('Editor init failed: ' + e.message, true);
        }
    }

    _setEditorContent(jsonString) {
        // Hide empty overlay
        if (this._editorEmpty) {
            this._editorEmpty.style.display = 'none';
        }

        // Pretty-print
        let formatted = jsonString;
        try {
            formatted = JSON.stringify(JSON.parse(jsonString), null, 2);
        } catch (e) {
            // Use raw string if not valid JSON
        }

        if (this.editorView) {
            this.editorView.dispatch({
                changes: {
                    from: 0,
                    to: this.editorView.state.doc.length,
                    insert: formatted,
                },
            });
        } else {
            // Editor not yet initialized - open the section and init
            const saveSection = this.rootElement.querySelector('.jta-section-body[data-section="saveEditor"]');
            const saveHeader = this.rootElement.querySelector('.jta-section-header[data-section="saveEditor"]');
            if (saveSection && saveSection.style.display === 'none') {
                saveSection.style.display = 'block';
                const arrow = saveHeader?.querySelector('.jta-section-arrow');
                if (arrow) arrow.textContent = '\u25BC';
            }
            this._initEditor().then(() => {
                if (this.editorView) {
                    this.editorView.dispatch({
                        changes: {
                            from: 0,
                            to: this.editorView.state.doc.length,
                            insert: formatted,
                        },
                    });
                }
            });
        }
    }

    _getEditorContent() {
        if (!this.editorView) return '';
        return this.editorView.state.doc.toString();
    }

    // --- Golden Layout lifecycle ---

    show() {}
    hide() {}
    focus() {}

    dispose() {
        log('info', 'JTAGameDataPanelUI disposing...');

        // Unsubscribe from events
        this.unsubscribeHandles.forEach(unsub => {
            if (typeof unsub === 'function') unsub();
        });
        this.unsubscribeHandles = [];

        // Destroy CM6 editor
        if (this.editorView) {
            this.editorView.destroy();
            this.editorView = null;
        }

        // Clear state
        this.eventLog = [];
        this.cm6Module = null;
        this._connDot = null;
        this._connLabel = null;
        this._connIframeId = null;
        this._connLastTime = null;
        this._gsZone = null;
        this._gsHighestZone = null;
        this._gsEnergy = null;
        this._gsResets = null;
        this._gsPerks = null;
        this._gsPrestige = null;
        this._refreshBtn = null;
        this._logEntries = null;
        this._logClearBtn = null;
        this._exportBtn = null;
        this._importBtn = null;
        this._editorStatus = null;
        this._editorWrapper = null;
        this._editorEmpty = null;
        this._editorMount = null;
    }
}
