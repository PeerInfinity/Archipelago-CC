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
let tickInterval = null;
let renderInterval = null;

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

    // Intercept region clicks to navigate to features
    registrationApi.registerDispatcherReceiver(
        'user:regionClicked',
        handleRegionClicked,
        { direction: 'bottom', stopPropagation: true }
    );

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

    // Also check if data is already loaded
    const existingData = stateManager.getStaticData();
    if (existingData) {
        initializeGame(existingData);
    }

    return () => {
        if (tickInterval) clearInterval(tickInterval);
        if (renderInterval) clearInterval(renderInterval);
        tickInterval = null;
        renderInterval = null;
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

    gameState.onStateChanged = () => {
        if (eventBus) {
            eventBus.publish('vibeCodingSim:stateChanged', { gameState });
        }
        if (panelInstance) {
            panelInstance.render();
        }
    };

    gameState.onLogEntry = () => {
        if (panelInstance) {
            panelInstance.render();
        }
    };

    // Start the game loop (simulation tick) and UI render loop (separate)
    if (tickInterval) clearInterval(tickInterval);
    if (renderInterval) clearInterval(renderInterval);
    const TICK_MS = 100;
    const RENDER_MS = 200;
    tickInterval = setInterval(() => {
        if (gameState && !gameState.paused) {
            gameState.tick(TICK_MS / 1000);
        }
    }, TICK_MS);
    renderInterval = setInterval(() => {
        if (gameState && !gameState.paused && panelInstance) {
            panelInstance.updateTick();
        }
    }, RENDER_MS);

    if (panelInstance) {
        panelInstance.render();
    }

    if (eventBus) {
        eventBus.publish('vibeCodingSim:stateChanged', { gameState });
    }
}

function handleRegionClicked(eventData) {
    // Intercept region click from Region Graph, select feature
    const regionName = eventData?.regionName || eventData?.region;
    if (regionName && panelInstance) {
        panelInstance.selectFeature(regionName);
    }
    // Don't propagate — we handle it
    return false;
}

export function setPanelInstance(instance) {
    panelInstance = instance;
}

export function getModuleApis() {
    return { eventBus, dispatcher, getGameState: () => gameState };
}
