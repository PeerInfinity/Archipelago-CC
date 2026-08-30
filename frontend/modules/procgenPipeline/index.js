/**
 * procgenPipeline — the procedural-generation pipeline
 * (docs/json/developer/procgen/architecture.md).
 *
 * This module hosts the layout drivers (sphere growth, top-down,
 * shuffled spiral, and the deprecated grid growth), the grid data
 * model, the stepped-pipeline runners, and the panel UI for running
 * a pipeline end-to-end. It consumes substrates through the substrate
 * registry and produces a compiled rules.json ready for
 * world_generator.
 */

import { ProcgenPipelineUI } from './procgenPipelineUI.js';

export const moduleInfo = {
    name: 'procgenPipeline',
    title: 'Procgen Pipeline',
    componentType: 'procgenPipelinePanel',
    icon: '🧭',
    column: 3,
    description: 'Procedural-generation pipeline (sphere growth, top-down, shuffled spiral, grid growth)',
    requires: [],
};

let panelInstance = null;
let eventBus = null;
let dispatcher = null;

export function register(registrationApi) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'modules/procgenPipeline/procgenPipeline.css';
    document.head.appendChild(link);

    registrationApi.registerPanelComponent('procgenPipelinePanel', ProcgenPipelineUI);
    // Published when the user clicks "Load into frontend" on a
    // generated rules.json — same event + payload shape the editor's
    // Apply button uses.
    registrationApi.registerEventBusPublisher('files:jsonLoaded');
    // Published by "Edit in APWorld Editor" to bring that panel forward after
    // handing it the generated rules.json.
    registrationApi.registerEventBusPublisher('ui:activatePanel');
    // Dedicated channel that routes a generated world straight to the APWorld
    // Editor (no global files:jsonLoaded → no substrate-panel auto-activation).
    registrationApi.registerEventBusPublisher('apworldEditor:loadRules');
}

export async function initialize(moduleId, priorityIndex, initializationApi) {
    eventBus = initializationApi.getEventBus();
    dispatcher = initializationApi.getDispatcher();

    ProcgenPipelineUI.setModuleApis({ eventBus, dispatcher });

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
