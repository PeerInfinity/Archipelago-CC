/**
 * APCalc — Frontend module
 *
 * Calculator-themed Archipelago game. Collect number and operation buttons,
 * budget presses to navigate a graph of target numbers.
 * Integrates with the Region Graph module for visualization.
 */

import { APCalcUI } from './apcalcUI.js';
import { APCalcState } from './apcalcState.js';
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';

export const moduleInfo = {
    name: 'apcalc',
    title: 'APCalc',
    componentType: 'apcalcPanel',
    icon: '🧮',
    column: 2,
    description: 'Calculator-themed puzzle game for Archipelago',
    requires: ['stateManager'],
};

let panelInstance = null;
let eventBus = null;
let dispatcher = null;
let gameState = null;

export function register(registrationApi) {
    // CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'modules/apcalc/apcalc.css';
    document.head.appendChild(link);

    // Panel
    registrationApi.registerPanelComponent('apcalcPanel', APCalcUI);

    // Events
    registrationApi.registerEventBusPublisher('apcalc:stateChanged');
    registrationApi.registerEventBusSubscriberIntent('stateManager:rulesLoaded');
    registrationApi.registerEventBusSubscriberIntent('stateManager:snapshotUpdated');
    registrationApi.registerEventBusSubscriberIntent('regionGraph:nodeSelected');

    // Dispatcher: send region moves, location checks, and path clearing
    registrationApi.registerDispatcherSender('user:regionMove', 'bottom', 'first');
    registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');
    registrationApi.registerDispatcherSender('playerState:trimPath', 'bottom', 'first');

    // Public functions
    registrationApi.registerPublicFunction(moduleInfo.name, 'getGameState', () => gameState);
    registrationApi.registerPublicFunction(moduleInfo.name, 'getPanelInstance', () => panelInstance);
}

export async function initialize(moduleId, priorityIndex, initializationApi) {
    eventBus = initializationApi.getEventBus();
    dispatcher = initializationApi.getDispatcher();

    // Pass APIs to UI class
    APCalcUI.setModuleApis({ eventBus, dispatcher, getGameState: () => gameState });

    // Listen for rules data
    eventBus.subscribe('stateManager:rulesLoaded', () => {
        const staticData = stateManager.getStaticData();
        if (staticData) initializeGame(staticData);
    });

    // Listen for region graph node clicks → filter paths, or clear on C click
    eventBus.subscribe('regionGraph:nodeSelected', (data) => {
        const nodeId = data?.nodeId;
        if (!nodeId) return;
        if (nodeId === 'C' && gameState) {
            gameState.reset();
            if (panelInstance) panelInstance.render();
        } else if (panelInstance) {
            panelInstance.setPathFilter(nodeId);
        }
    });

    // Register node label provider for the region graph
    const registerLabelProvider = initializationApi.getModuleFunction('regionGraph', 'registerNodeLabelProvider');
    if (registerLabelProvider) {
        registerLabelProvider((nodeId, nodeData) => {
            if (!gameState || !gameState.nodes[nodeId]) return null;
            return String(gameState.nodes[nodeId].value);
        });
    }

    // Register edge visibility filter for difficulty modes
    const registerEdgeFilter = initializationApi.getModuleFunction('regionGraph', 'registerEdgeVisibilityFilter');
    if (registerEdgeFilter) {
        registerEdgeFilter((sourceId, targetId) => {
            if (!gameState) return true;
            return gameState.isEdgeVisible(sourceId, targetId);
        });
    }

    // Register accessibility visibility for hard mode
    const registerAccessibilityFilter = initializationApi.getModuleFunction('regionGraph', 'registerAccessibilityVisibilityFilter');
    if (registerAccessibilityFilter) {
        registerAccessibilityFilter(() => {
            if (!gameState) return true;
            return gameState.showAccessibility();
        });
    }

    // Forward keyboard events from the Region Graph to the APCalc panel
    const registerKeyForwarder = initializationApi.getModuleFunction('regionGraph', 'registerKeyForwarder');
    if (registerKeyForwarder) {
        registerKeyForwarder((event) => {
            if (panelInstance) panelInstance._handleKeyDown(event);
        });
    }

    // Sync received items from Archipelago
    eventBus.subscribe('stateManager:snapshotUpdated', (data) => {
        if (gameState) {
            gameState.syncFromSnapshot(data?.snapshot);
            if (panelInstance) panelInstance.render();
        }
    });

    // Refresh region graph when state changes (difficulty mode, etc.)
    eventBus.subscribe('apcalc:stateChanged', () => {
        const refreshLabels = initializationApi.getModuleFunction('regionGraph', 'refreshNodeLabels');
        if (refreshLabels) refreshLabels();
    });

    // Check if data is already loaded
    const existingData = stateManager.getStaticData();
    if (existingData) initializeGame(existingData);

    return () => {
        panelInstance = null;
        eventBus = null;
        dispatcher = null;
        gameState = null;
    };
}

function initializeGame(staticData) {
    if (!staticData?.world) return;
    const playerId = staticData.playerId || '1';
    const playerWorld = staticData.world[playerId];
    const slotData = playerWorld?.slot_data;
    if (!slotData?.nodes) return;

    gameState = new APCalcState();
    gameState.loadFromSlotData(slotData);

    gameState.onStateChanged = () => {
        if (eventBus) eventBus.publish('apcalc:stateChanged', { gameState });
        if (panelInstance) panelInstance.render();
    };

    gameState.onRegionMove = (regionName) => {
        if (!dispatcher) return;
        dispatcher.publish('user:regionMove', {
            targetRegion: regionName,
            source: 'apcalc',
        }, { initialTarget: 'bottom' });
    };

    gameState.onPathClear = () => {
        if (!dispatcher) return;
        dispatcher.publish('playerState:trimPath', {}, { initialTarget: 'bottom' });
    };

    gameState.onLocationCheck = (locationName, regionName) => {
        if (!dispatcher) return;
        dispatcher.publish('user:locationCheck', {
            locationName,
            regionName,
            originator: 'APCalcCheck',
            originalDOMEvent: true,
        }, { initialTarget: 'bottom' });
    };

    // Sync from current snapshot
    const currentSnapshot = stateManager.getLatestStateSnapshot();
    if (currentSnapshot) gameState.syncFromSnapshot(currentSnapshot);

    if (panelInstance) panelInstance.render();
    if (eventBus) eventBus.publish('apcalc:stateChanged', { gameState });
}

export function setPanelInstance(instance) {
    panelInstance = instance;
}

export function getModuleApis() {
    return { eventBus, dispatcher, getGameState: () => gameState };
}
