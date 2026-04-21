/**
 * procgenPipeline — grid-growth procedural-generation pipeline.
 * See NewDocs/plans/procedural-generation/grid-growth-pipeline.md.
 *
 * This module hosts the stage-3 growth loop, the scenario pool, the
 * grid data model, and the UI for running the pipeline end-to-end.
 * It consumes substrate generators (currently just the maze via
 * generateMazeRegion) and produces a compiled rules.json ready for
 * world_generator.
 */

import { ProcgenPipelineUI } from './procgenPipelineUI.js';

export const moduleInfo = {
    name: 'procgenPipeline',
    title: 'Procgen Pipeline',
    componentType: 'procgenPipelinePanel',
    icon: '🧭',
    column: 3,
    description: 'Grid-growth procgen pipeline (stage 3 and beyond)',
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
