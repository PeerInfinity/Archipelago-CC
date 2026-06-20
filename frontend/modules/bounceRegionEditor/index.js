/**
 * bounceRegionEditor — a Golden Layout panel that edits ONE bounce region's
 * geometry. See NewDocs/plans/procedural-generation/region-step-editing.md §5.
 *
 * Launched two ways:
 *   - pipeline: the procgen panel's ③ Edit ▸ calls openBounceRegionEditor({
 *     region, contract, onSave }); we stash the session, publish a load event,
 *     and bring the panel forward.
 *   - standalone: the panel boots itself with a fixture when no session is
 *     pending (own load/save).
 *
 * The editor registers itself in the procgen regionEditors registry so Edit ▸
 * routes bounce regions here (chunk 5 wires the write-back save path).
 */
import { BounceRegionEditorUI } from './bounceRegionEditorUI.js';

export const LOAD_EVENT = 'bounceRegionEditor:load';
export const BOUNCE_EDITOR_COMPONENT_TYPE = 'bounceRegionEditorPanel';

export const moduleInfo = {
    name: 'bounceRegionEditor',
    title: 'Bounce Region Editor',
    componentType: BOUNCE_EDITOR_COMPONENT_TYPE,
    icon: '🪀',
    column: 3,
    description: 'Per-region geometry editor for the bounce substrate',
    requires: [],
};

let panelInstance = null;
let eventBus = null;
let dispatcher = null;
// One-shot hand-off slot: the procgen panel's Edit ▸ writes here, then the
// (already-mounted or freshly-mounted) panel consumes it on the load event.
let pendingSession = null;

export function register(registrationApi) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'modules/bounceRegionEditor/bounceRegionEditor.css';
    document.head.appendChild(link);

    registrationApi.registerPanelComponent(BOUNCE_EDITOR_COMPONENT_TYPE, BounceRegionEditorUI);
    registrationApi.registerEventBusPublisher(LOAD_EVENT);
    registrationApi.registerEventBusPublisher('ui:activatePanel');
}

export async function initialize(_moduleId, _priorityIndex, initializationApi) {
    eventBus = initializationApi.getEventBus();
    dispatcher = initializationApi.getDispatcher?.() ?? null;
    BounceRegionEditorUI.setModuleApis({ eventBus, dispatcher });

    return () => {
        panelInstance = null;
        eventBus = null;
        dispatcher = null;
        pendingSession = null;
    };
}

/**
 * Launch the editor on a region (the regionEditors registry entry — chunk 5
 * registers this). Pipeline mode passes onSave; standalone omits it.
 */
export function openBounceRegionEditor({ region, contract, onSave } = {}) {
    pendingSession = { region, contract, onSave };
    if (eventBus) {
        eventBus.publish(LOAD_EVENT, { regionId: region?.region_id ?? null });
        eventBus.publish('ui:activatePanel', { panelId: BOUNCE_EDITOR_COMPONENT_TYPE });
    }
}

/** Consume (and clear) the pending hand-off session, or null. */
export function consumePendingSession() {
    const s = pendingSession;
    pendingSession = null;
    return s;
}

export function setPanelInstance(instance) { panelInstance = instance; }
export function getPanelInstance() { return panelInstance; }
export function getModuleApis() { return { eventBus, dispatcher }; }
