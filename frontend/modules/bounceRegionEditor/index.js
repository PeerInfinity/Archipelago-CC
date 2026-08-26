/**
 * bounceRegionEditor — a Golden Layout panel that edits ONE bounce region's
 * geometry. See docs/json/developer/procgen/stepped-pipeline.md
 * §"Region editors".
 *
 * Launched two ways:
 *   - pipeline: the procgen panel's 3 Edit ▸ calls openBounceRegionEditor({
 *     region, contract, onSave }); we stash the session, publish a load event,
 *     and bring the panel forward.
 *   - standalone: the panel boots itself with a fixture when no session is
 *     pending (own load/save).
 *
 * ⛓ EDITOR INTEGRATION W3: the SUBSTRATE ENTRY declares this launcher
 * (`bounceDemoLibrary` → `roomEditor: {kind: 'panel', open}`) and
 * `regionEditors.getRegionEditor` resolves Edit ▸ through the registry. This
 * module registers nothing any more.
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

    /**
     * ⛓⛓ EDITOR INTEGRATION W3 — **THE REGISTRATION IS GONE, AND THE ENTRY
     * CARRIES IT INSTEAD.** `bounceDemoLibrary.createBounceSubstrateEntry`
     * declares `roomEditor: {kind: 'panel', open}` and
     * `procgenPipeline/regionEditors.getRegionEditor` resolves Edit ▸ through
     * the substrate registry, so this module no longer has to have RUN for the
     * panel to know bounce has an editor — which is the property the maze and
     * Seedling lab PAGES need, since a page never calls `initialize()`.
     */

    return () => {
        panelInstance = null;
        eventBus = null;
        dispatcher = null;
        pendingSession = null;
    };
}

/**
 * Launch the editor on a region — the function the substrate entry's
 * `roomEditor.open` names. Pipeline mode passes onSave; standalone omits it.
 *
 * ⚠ THE ENTRY REACHES IT WITH A **DYNAMIC** IMPORT, and the measurement is
 * why: importing this module from `bounceDemoLibrary.js` statically puts the
 * whole GL-panel graph — and `centralRegistry`'s init, which PRINTS — into
 * every headless consumer of that library (the reference generator, ~30
 * `check-*.mjs` gates). Measured on `1eed5988a`: the library alone loads
 * silently, the library plus this module prints
 * `[centralRegistry] CentralRegistry initialized`.
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
