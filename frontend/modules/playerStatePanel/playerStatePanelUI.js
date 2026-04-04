import { getModuleEventBus } from './index.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';

/**
 * PlayerStatePanelUI - UI component for displaying player state information
 */
export class PlayerStatePanelUI {
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
        this.rootElement.className = 'player-state-panel';
        this.rootElement.innerHTML = `
            <h3>Player State</h3>
            <div class="player-state-content">
                <div class="current-region">
                    <strong>Current Region:</strong> <span class="region-name">Loading...</span>
                </div>
                <div class="path-section">
                    <strong>Path:</strong>
                    <div class="path-entries"></div>
                </div>
            </div>
        `;

        this.currentRegionElement = this.rootElement.querySelector('.region-name');
        this.pathEntriesElement = this.rootElement.querySelector('.path-entries');
        return this.rootElement;
    }

    getRootElement() {
        return this.rootElement;
    }

    setupEventListeners() {
        // Listen for region changes
        const handle = this.eventBus.subscribe('playerState:regionChanged', (data) => {
            this.updateDisplay();
        });
        this.unsubscribeHandles.push(handle);

        // Listen for path updates
        const pathHandle = this.eventBus.subscribe('playerState:pathUpdated', () => {
            this.updateDisplay();
        });
        this.unsubscribeHandles.push(pathHandle);

        // Also listen for rules loaded to get initial state
        const rulesHandle = this.eventBus.subscribe('stateManager:rulesLoaded', () => {
            this.updateDisplay();
        });
        this.unsubscribeHandles.push(rulesHandle);
    }

    updateDisplay() {
        if (!this.currentRegionElement) {
            return;
        }

        // Get current region from playerState module
        const getCurrentRegion = centralRegistry.getPublicFunction('playerState', 'getCurrentRegion');
        if (getCurrentRegion) {
            const currentRegion = getCurrentRegion();
            this.currentRegionElement.textContent = currentRegion || 'Unknown';
        }

        // Get and display path
        if (this.pathEntriesElement) {
            const getPath = centralRegistry.getPublicFunction('playerState', 'getPath');
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