import { getModuleEventBus } from './index.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';

/**
 * GameStatePanelUI - UI component for displaying game state information
 */
export class GameStatePanelUI {
    constructor(container, componentState) {
        Object.defineProperty(this, 'eventBus', { get: () => getModuleEventBus(), configurable: true });
        this.container = container;
        this.componentState = componentState;
        this.currentRegionElement = null;
        this.rootElement = null;
        this.unsubscribeHandles = [];
        
        // Create and setup the UI immediately
        this.createRootElement();
        this.container.element.appendChild(this.rootElement);
        this.setupEventListeners();
        
        // Initial display update
        setTimeout(() => this.updateDisplay(), 100);
    }

    createRootElement() {
        this.rootElement = document.createElement('div');
        this.rootElement.className = 'game-state-panel';
        // Match the JTA / Maze game-data panels: fill the host
        // container and scroll when the path log overflows.
        this.rootElement.style.cssText = 'height: 100%; overflow: auto;';
        this.rootElement.innerHTML = `
            <h3>Game State</h3>
            <div class="game-state-content">
                <div class="current-region">
                    <strong>Current Region:</strong> <span class="region-name">Loading...</span>
                </div>
                <div class="mana-section" style="display: none;">
                    <strong>Mana:</strong> <span class="mana-value">—</span>
                </div>
                <div class="region-xp-section" style="display: none;">
                    <strong>Region XP:</strong>
                    <div class="region-xp-entries"></div>
                </div>
                <div class="path-section">
                    <strong>Path:</strong>
                    <div class="path-entries"></div>
                </div>
            </div>
        `;

        this.currentRegionElement = this.rootElement.querySelector('.region-name');
        this.pathEntriesElement = this.rootElement.querySelector('.path-entries');
        this.manaSection = this.rootElement.querySelector('.mana-section');
        this.manaValueElement = this.rootElement.querySelector('.mana-value');
        this.regionXPSection = this.rootElement.querySelector('.region-xp-section');
        this.regionXPEntriesElement = this.rootElement.querySelector('.region-xp-entries');
        return this.rootElement;
    }

    getRootElement() {
        return this.rootElement;
    }

    setupEventListeners() {
        // Listen for region changes
        const handle = this.eventBus.subscribe('gameState:regionChanged', (data) => {
            this.updateDisplay();
        });
        this.unsubscribeHandles.push(handle);

        // Listen for path updates
        const pathHandle = this.eventBus.subscribe('gameState:pathUpdated', () => {
            this.updateDisplay();
        });
        this.unsubscribeHandles.push(pathHandle);

        // Also listen for rules loaded to get initial state
        const rulesHandle = this.eventBus.subscribe('stateManager:rulesLoaded', () => {
            this.updateDisplay();
        });
        this.unsubscribeHandles.push(rulesHandle);

        // Loop-mode resource events. Mana display becomes visible when
        // cost data is loaded; region XP display becomes visible when
        // any region has accumulated XP.
        const manaHandle = this.eventBus.subscribe('gameState:manaChanged', () => {
            this.updateManaDisplay();
        });
        this.unsubscribeHandles.push(manaHandle);
        const xpHandle = this.eventBus.subscribe('gameState:xpChanged', () => {
            this.updateRegionXPDisplay();
        });
        this.unsubscribeHandles.push(xpHandle);
        // Cost data flipping on/off (e.g. after rulesLoaded or "Generate
        // Costs") changes whether mana is meaningful, so we re-evaluate
        // the mana section's visibility too.
        const costLoadedHandle = this.eventBus.subscribe('costDataManager:loaded', () => {
            this.updateManaDisplay();
        });
        this.unsubscribeHandles.push(costLoadedHandle);
        const costClearedHandle = this.eventBus.subscribe('costDataManager:cleared', () => {
            this.updateManaDisplay();
        });
        this.unsubscribeHandles.push(costClearedHandle);
    }

    updateDisplay() {
        if (!this.currentRegionElement) {
            return;
        }

        // Get current region from gameState module
        const getCurrentRegion = centralRegistry.getPublicFunction('gameState', 'getCurrentRegion');
        if (getCurrentRegion) {
            const currentRegion = getCurrentRegion();
            this.currentRegionElement.textContent = currentRegion || 'Unknown';
        }

        // Get and display path
        if (this.pathEntriesElement) {
            const getPath = centralRegistry.getPublicFunction('gameState', 'getPath');
            const path = getPath ? getPath() : [];
            if (path.length === 0) {
                this.pathEntriesElement.textContent = '(empty)';
            } else {
                this.pathEntriesElement.innerHTML = '';
                for (const entry of path) {
                    const el = document.createElement('div');
                    el.className = 'path-entry';
                    if (entry.type === 'regionMove') {
                        el.textContent = `→ ${entry.destinationRegion}`;
                        if (entry.exitUsed) el.textContent += ` (via ${entry.exitUsed})`;
                    } else if (entry.type === 'locationCheck') {
                        el.textContent = `  ✓ ${entry.locationName}`;
                        el.style.color = '#6ea8d9';
                    } else if (entry.type === 'customAction') {
                        el.textContent = `  ⚡ ${entry.actionName}`;
                        el.style.color = '#e0a030';
                    }
                    this.pathEntriesElement.appendChild(el);
                }
            }
        }

        // Loop-mode resource sections — refreshed alongside the rest.
        this.updateManaDisplay();
        this.updateRegionXPDisplay();
    }

    /**
     * Mana readout. Visible whenever the loops module's cost data is
     * loaded — the player always sees their resource regardless of
     * which substrate they're in. 1-decimal formatting per spec.
     */
    updateManaDisplay() {
        if (!this.manaSection || !this.manaValueElement) return;
        const cdm = this._getCostDataManager();
        const visible = !!cdm?.isLoaded?.();
        this.manaSection.style.display = visible ? '' : 'none';
        if (!visible) return;
        const getCur = centralRegistry.getPublicFunction('gameState', 'getCurrentMana');
        const getMax = centralRegistry.getPublicFunction('gameState', 'getMaxMana');
        const cur = getCur ? getCur() : 0;
        const max = getMax ? getMax() : 0;
        this.manaValueElement.textContent = `${cur.toFixed(1)} / ${max.toFixed(1)}`;
    }

    /**
     * Region XP readout. Visible whenever any region has XP. Reads the
     * underlying GameState.regionXP map via getState (registered by
     * gameState/index.js as a public function).
     */
    updateRegionXPDisplay() {
        if (!this.regionXPSection || !this.regionXPEntriesElement) return;
        const getState = centralRegistry.getPublicFunction('gameState', 'getState');
        const gs = getState ? getState() : null;
        const map = gs?.regionXP;
        if (!map || map.size === 0) {
            this.regionXPSection.style.display = 'none';
            return;
        }
        this.regionXPSection.style.display = '';
        this.regionXPEntriesElement.innerHTML = '';
        // Sort by name for stable display.
        const entries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        for (const [regionName, data] of entries) {
            const el = document.createElement('div');
            el.className = 'region-xp-entry';
            const lvl = data?.level ?? 0;
            const xp = data?.xp ?? 0;
            const need = data?.xpForNextLevel ?? 0;
            el.textContent = `${regionName}: L${lvl} (${xp.toFixed(0)}/${need} xp)`;
            this.regionXPEntriesElement.appendChild(el);
        }
    }

    _getCostDataManager() {
        if (this._costDataManager) return this._costDataManager;
        try {
            const fn = centralRegistry.getPublicFunction?.('loops', 'getCostDataManager');
            this._costDataManager = fn?.() ?? null;
        } catch {
            this._costDataManager = null;
        }
        return this._costDataManager;
    }

    destroy() {
        // Unsubscribe from all events
        this.unsubscribeHandles.forEach(handle => handle());
        this.unsubscribeHandles = [];
        
        // Clean up DOM
        if (this.rootElement && this.rootElement.parentNode) {
            this.rootElement.parentNode.removeChild(this.rootElement);
        }
    }
}