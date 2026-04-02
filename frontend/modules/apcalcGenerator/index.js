/**
 * APCalc Generator — Frontend module
 *
 * Procedural generation of APCalc game data with detailed logging.
 * Produces rules.json for download or direct loading into stateManager.
 */

import { APCalcGeneratorUI } from './apcalcGeneratorUI.js';

export const moduleInfo = {
    name: 'apcalcGenerator',
    title: 'APCalc Generator',
    componentType: 'apcalcGeneratorPanel',
    icon: '🔧',
    column: 3,
    description: 'Generate APCalc puzzle data with configurable parameters',
    requires: ['stateManager'],
};

let panelInstance = null;
let eventBus = null;
let dispatcher = null;

export function register(registrationApi) {
    // CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'modules/apcalcGenerator/apcalcGenerator.css';
    document.head.appendChild(link);

    // Panel
    registrationApi.registerPanelComponent('apcalcGeneratorPanel', APCalcGeneratorUI);

    // Events
    registrationApi.registerEventBusPublisher('apcalcGenerator:generated');
    registrationApi.registerEventBusPublisher('files:jsonLoaded');
}

export async function initialize(moduleId, priorityIndex, initializationApi) {
    eventBus = initializationApi.getEventBus();
    dispatcher = initializationApi.getDispatcher();

    APCalcGeneratorUI.setModuleApis({ eventBus, dispatcher });

    return () => {
        panelInstance = null;
        eventBus = null;
        dispatcher = null;
    };
}

export function setPanelInstance(instance) {
    panelInstance = instance;
}

export function getModuleApis() {
    return { eventBus, dispatcher };
}
