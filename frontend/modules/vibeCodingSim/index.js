/**
 * Vibe Coding Simulator — Frontend module
 *
 * Provides a three-column interface (Features, Tests, Tasks) for managing
 * a simulated vibe coding project. Integrates with the Region Graph module
 * for dependency visualization.
 */

import { VibeCodingSimUI } from './vibeCodingSimUI.js';
import { GameState, SimulationConfig } from './simEngine.js';
import { stateManagerProxySingleton as stateManager } from '../stateManager/index.js';

export const moduleInfo = {
    name: 'vibeCodingSim',
    title: 'Vibe Coding Simulator',
    componentType: 'vibeCodingSimPanel',
    icon: '🤖',
    column: 1,
    description: 'Simulate managing an AI-assisted coding project',
};

let panelInstance = null;
let eventBus = null;
let dispatcher = null;
let gameState = null;
let renderRafId = null;

export function register(registrationApi) {
    // CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'modules/vibeCodingSim/vibeCodingSim.css';
    document.head.appendChild(link);

    // Panel
    registrationApi.registerPanelComponent('vibeCodingSimPanel', VibeCodingSimUI);

    // Events we publish
    registrationApi.registerEventBusPublisher('vibeCodingSim:featureSelected');
    registrationApi.registerEventBusPublisher('vibeCodingSim:stateChanged');

    // Events we subscribe to
    registrationApi.registerEventBusSubscriberIntent('stateManager:rulesLoaded');
    registrationApi.registerEventBusSubscriberIntent('stateManager:snapshotUpdated');
    registrationApi.registerEventBusSubscriberIntent('regionGraph:nodeSelected');

    // Public functions
    registrationApi.registerPublicFunction(
        moduleInfo.name,
        'getGameState',
        () => gameState
    );
    registrationApi.registerPublicFunction(
        moduleInfo.name,
        'getPanelInstance',
        () => panelInstance
    );
}

export async function initialize(moduleId, priorityIndex, initializationApi) {
    eventBus = initializationApi.getEventBus();
    dispatcher = initializationApi.getDispatcher();

    // Pass APIs to UI class
    VibeCodingSimUI.setModuleApis({ eventBus, dispatcher, getGameState: () => gameState });

    // Listen for rules data to initialize the game
    eventBus.subscribe('stateManager:rulesLoaded', () => {
        const staticData = stateManager.getStaticData();
        if (staticData) {
            initializeGame(staticData);
        }
    });

    // Listen for region graph clicks
    eventBus.subscribe('regionGraph:nodeSelected', (data) => {
        const nodeId = data?.nodeId;
        if (nodeId && panelInstance) {
            // Region names are like "Complete Node 3" — look up which feature this maps to
            // The graph_structure maps indices to feature IDs
            panelInstance.selectFeatureByRegion(nodeId);
        }
    });

    // Register node overlay provider for the region graph
    const registerOverlay = initializationApi.getModuleFunction('regionGraph', 'registerNodeOverlayProvider');
    if (registerOverlay) {
        const { createFeatureOverlay } = await import('./vibeCodingSimUI.js');
        registerOverlay((nodeId, nodeData) => createFeatureOverlay(nodeId, gameState));
    }

    // Listen for state changes to refresh overlays
    eventBus.subscribe('vibeCodingSim:stateChanged', () => {
        const refreshOverlays = initializationApi.getModuleFunction('regionGraph', 'refreshNodeOverlays');
        if (refreshOverlays) refreshOverlays();
    });

    // Also check if data is already loaded
    const existingData = stateManager.getStaticData();
    if (existingData) {
        initializeGame(existingData);
    }

    return () => {
        if (renderRafId) cancelAnimationFrame(renderRafId);
        renderRafId = null;
        panelInstance = null;
        eventBus = null;
        dispatcher = null;
        gameState = null;
    };
}

function initializeGame(staticData) {
    // Extract slot_data from static data (same pattern as proofShared/getPlayerWorld)
    if (!staticData?.world) return;
    const playerId = staticData.playerId || '1';
    const playerWorld = staticData.world[playerId];
    const slotData = playerWorld?.slot_data;
    if (!slotData?.graph_structure) return;

    const config = new SimulationConfig();
    gameState = new GameState(config);
    gameState.loadFromSlotData(slotData);
    gameState.setSeed(42);

    let renderDirty = false;

    gameState.onStateChanged = () => {
        if (eventBus) {
            eventBus.publish('vibeCodingSim:stateChanged', { gameState });
        }
        renderDirty = true;
    };

    gameState.onLogEntry = () => {
        renderDirty = true;
    };

    // Combined game tick + UI render loop using requestAnimationFrame
    if (renderRafId) cancelAnimationFrame(renderRafId);
    let lastFrameTime = performance.now();
    const gameLoop = (now) => {
        const dtReal = (now - lastFrameTime) / 1000;
        lastFrameTime = now;
        if (gameState && !gameState.paused) {
            gameState.tick(dtReal);
        }
        if (renderDirty && panelInstance) {
            renderDirty = false;
            panelInstance.render();
        }
        if (gameState && !gameState.paused && panelInstance) {
            panelInstance.updateTick();
        }
        renderRafId = requestAnimationFrame(gameLoop);
    };
    renderRafId = requestAnimationFrame(gameLoop);

    if (panelInstance) {
        panelInstance.render();
    }

    if (eventBus) {
        eventBus.publish('vibeCodingSim:stateChanged', { gameState });
    }
}

export function setPanelInstance(instance) {
    panelInstance = instance;
}

export function getModuleApis() {
    return { eventBus, dispatcher, getGameState: () => gameState };
}
