/**
 * regionMap — **THE REGION MAP PANEL** (region-map step 3b). Each whole-level region of the loaded world as its
 * rendered level, laid out flat in groups (no node/edge graph): the composition of step 1 (the Seedling painter,
 * `procgenCore/compositeMapRenderer.js`), step 2 (the region view, `regionView/regionViewState.js`) and step 3a (the
 * layout, `procgenCore/regionLayoutResolve.js`).
 *
 * ⚖ (user, 2026-11-14/15) a SEPARATE panel, not a Region Graph mode; discovery hides undiscovered regions; follow
 * player; green/red location squares with a minimum on-screen size; groups with gaps, a group reached by going DOWN
 * below; sub-regions fold into their level; it loads for any world (no `grid_cell`, no substrate hook → the generic
 * layout and boxes); cells sized by level by default, uniform cells as a toggle.
 *
 * ⛓ CLICKS (step 4) do what the Region Graph's clicks do (`regionMapClicks.js`), through
 * `regionView/regionActions.js`, under THIS module's dispatcher and event bus (registered below) and its own
 * `regionMap-*` sources / `regionMap*Check` originators. `regionMap` is a loop-mode planning prefix
 * (`loops/loopModeExemptions.js`), as `regionGraph` is. ⚖ The Region Graph's control-panel toggles
 * (`moduleSettings.regionGraph.*`) choose what a click does in BOTH panels until the Region Map has its own copy.
 *
 * Open it from the panel menu ("Region Map"); it is in no layout preset.
 */
import { RegionMapUI } from './regionMapUI.js';
import { REGION_MAP_SETTINGS_SCHEMA, moduleHandles, panelInstances } from './regionMapSettings.js';
import { REGION_MAP_NODE_SELECTED } from './regionMapClicks.js';

export const moduleInfo = {
    name: 'regionMap',
    title: 'Region Map',
    componentType: 'regionMapPanel',
    docs: 'docs/json/user/modules/regionMap.md',
    icon: '🗺️',
    column: 2,
    category: 'Analysis Panels',
    description: 'The loaded world\'s regions as a flat map of their rendered levels, grouped, with location squares coloured by accessibility.',
    requires: ['stateManager', 'gameState'],
};

/** The mounted panels (tests read their state through `getDebugState()`). */
export const getPanelInstances = () => [...panelInstances];

export function register(registrationApi) {
    registrationApi.registerPanelComponent('regionMapPanel', RegionMapUI);
    registrationApi.registerSettingsSchema(REGION_MAP_SETTINGS_SCHEMA);
    // ⛓ step 4: the clicks' senders and publishers — the same set the Region Graph registers for its own clicks.
    registrationApi.registerEventBusPublisher('ui:activatePanel');
    registrationApi.registerEventBusPublisher('ui:navigateToRegion');
    registrationApi.registerDispatcherSender('user:regionMove', 'bottom', 'first');
    registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');
    registrationApi.registerEventBusPublisher(REGION_MAP_NODE_SELECTED);
}

export function initialize(mId, priorityIndex, initializationApi) {
    // Held in regionMapSettings.js, not here: the UI reads them, and a UI → index import is a TDZ cycle.
    moduleHandles.dispatcher = initializationApi?.getDispatcher?.() ?? null;
    moduleHandles.eventBus = initializationApi?.getEventBus?.() ?? null;
}

export function postInitialize() {}
