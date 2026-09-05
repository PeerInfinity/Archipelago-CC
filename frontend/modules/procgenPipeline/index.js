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

/**
 * ⛓⛓⛓ APWORLD EDITOR HUB slice H5 — **THE PIPELINE'S WORKING-COPY INTAKE.**
 * Published by the hub's `procgen_metadata` Document row (and by anything else
 * that holds a rules.json and wants the pipeline to look at it), carrying
 * `{jsonData, source}`.
 *
 * ⛔ **IT IS A SECOND CHANNEL ON PURPOSE.** `stateManager:rawJsonDataLoaded`
 * means *"the app has loaded this document"*; this one means *"here is a
 * document nobody has applied"*. Collapsing them would make an unapplied
 * working copy indistinguishable from applied state — the distinction plan §1's
 * working-copy ruling is entirely about — and would fire every substrate panel
 * that listens for an app-wide load.
 *
 * ⚠ `source` NAMES THE DOOR (H4c's rule for `apworldEditor:loadRules`): the
 * panel's own source label reads `hand-off (<door>)`, so a person can tell
 * which editor handed this over from three rows away.
 */
export const PROCGEN_PIPELINE_LOAD_RULES = 'procgenPipeline:loadRules';

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
    // Published by "Open in APWorld Editor" to bring that panel forward after
    // handing it the generated rules.json.
    registrationApi.registerEventBusPublisher('ui:activatePanel');
    // Dedicated channel that routes a generated world straight to the APWorld
    // Editor (no global files:jsonLoaded → no substrate-panel auto-activation).
    registrationApi.registerEventBusPublisher('apworldEditor:loadRules');
    // ⛓ H5 — the panel subscribes to the hub's hand-off. The bus auto-registers
    // a subscriber intent on subscribe(); declaring it here as well is how
    // `procgenLabPanel` spells the same thing, and it puts the event in the
    // module's registration record whether or not the panel is mounted.
    registrationApi.registerEventBusSubscriberIntent(PROCGEN_PIPELINE_LOAD_RULES);
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
