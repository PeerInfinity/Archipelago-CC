/**
 * regionMarkingTool — a Golden Layout panel that authors a game's REGION ATLAS
 * over its real map (CC/docs/plans/region-atlas-plan.md, Phase 2).
 *
 * It is its own module rather than a mode inside tileMapAnalyzer (ruled
 * 2026-07-27): the analyzer is an RWK-specific reachability/physics tool with
 * its own tilemap+categories data model, while this reads a map-source
 * document and writes the game-agnostic atlas format. What they genuinely
 * share — the pan/zoom/click canvas — is shared as code:
 * markingRenderer.js subclasses the analyzer's TileMapCanvasRenderer.
 *
 * Launched two ways, following bounceRegionEditor's shape:
 *   - standalone: the panel boots itself, fetches the map document and starts
 *     on an empty atlas;
 *   - hand-off: a caller stashes a session (an atlas to edit) and publishes the
 *     load event; the panel consumes it whether it was already mounted or not.
 */
import { RegionMarkingToolUI } from './regionMarkingToolUI.js';
import eventBus from '../../app/core/eventBus.js';

export const LOAD_EVENT = 'regionMarkingTool:load';
export const REGION_MARKING_COMPONENT_TYPE = 'regionMarkingTool';

/**
 * The map-source document the tool renders from. Seedling's is committed
 * (MIT); regenerate it with scripts/procgen/extract-seedling-map.mjs.
 */
export const MAP_DOCUMENT_URL = 'modules/flashPanel/atlases/seedling-map.json';

export const moduleInfo = {
    name: 'regionMarkingTool',
    title: 'Region Marking Tool',
    componentType: REGION_MARKING_COMPONENT_TYPE,
    icon: '🧭',
    column: 2,
    description: "Marks a real game's map into procgen regions and writes the region atlas.",
    requires: [],
};

let activePanelInstance = null;
let moduleEventBus = null;
let moduleDispatcher = null;
// One-shot hand-off slot, consumed on the load event (bounceRegionEditor's
// pattern): the panel may not be mounted when the caller writes it.
let pendingSession = null;

export function register(registrationApi) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'modules/regionMarkingTool/regionMarkingTool.css';
    document.head.appendChild(link);

    registrationApi.registerPanelComponent(REGION_MARKING_COMPONENT_TYPE, RegionMarkingToolUI);
    registrationApi.registerEventBusPublisher(LOAD_EVENT);
    registrationApi.registerEventBusPublisher('ui:activatePanel');
    // "Edit in APWorld Editor" (Phase 3): the dedicated hand-off channel, not
    // files:jsonLoaded — see regionMarkingToolUI._editInApworldEditor. The bus
    // rejects unregistered publishers, so this line is load-bearing.
    registrationApi.registerEventBusPublisher('apworldEditor:loadRules');
}

export async function initialize(_moduleId, _priorityIndex, initializationApi) {
    moduleEventBus = initializationApi.getEventBus();
    moduleDispatcher = initializationApi.getDispatcher?.() ?? null;
    return () => {
        activePanelInstance = null;
        moduleEventBus = null;
        moduleDispatcher = null;
        pendingSession = null;
    };
}

/** Open the tool on an existing atlas document. */
export function openRegionMarkingTool({ atlas = null, levelId = null } = {}) {
    pendingSession = { atlas, levelId };
    const bus = getModuleEventBus();
    bus.publish(LOAD_EVENT, { regions: atlas?.regions?.length ?? 0 });
    bus.publish('ui:activatePanel', { panelId: REGION_MARKING_COMPONENT_TYPE });
}

/** Consume (and clear) the pending hand-off session, or null. */
export function consumePendingSession() {
    const s = pendingSession;
    pendingSession = null;
    return s;
}

export function setActivePanelInstance(instance) { activePanelInstance = instance; }
export function getActivePanelInstance() { return activePanelInstance; }
export function getModuleDispatcher() { return moduleDispatcher; }

export function getModuleEventBus() {
    if (moduleEventBus) return moduleEventBus;
    return {
        publish: (event, data) => eventBus.publish(event, data, 'regionMarkingTool'),
        subscribe: (event, cb) => eventBus.subscribe(event, cb, 'regionMarkingTool'),
        unsubscribe: (event, cb) => eventBus.unsubscribe(event, cb, 'regionMarkingTool'),
    };
}
