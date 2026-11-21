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
 * ⛓ CLICKS (CA-S3) run the shared click-action registry (`regionView/clickActions.js`) over the panel's OWN
 * `moduleSettings.regionMap.clickActions` (⚖ R4; the first run copies the Region Graph's), edited by the "On click"
 * strip at the top of the panel (`regionMapClickActions.js`). They go out under THIS module's dispatcher and event bus
 * (registered below): path moves under `regionView-path-regionMap` (R7, a loop-mode planning source), checks under
 * the `regionMap*Check` originators. Every click also publishes the generic `regionView:regionClicked` /
 * `regionView:locationClicked` (design §4.3).
 *
 * Open it from the panel menu ("Region Map"); it is in no layout preset.
 */
import { RegionMapUI } from './regionMapUI.js';
import { REGION_MAP_SETTINGS_SCHEMA, moduleHandles, panelInstances } from './regionMapSettings.js';
import {
    LOCATION_CLICKED, REGION_CLICKED, REGION_MAP_NODE_SELECTED, makeRegionMapCentreAction,
} from './regionMapClickActions.js';
import { registerClickAction, unregisterClickAction, PANEL_ACTION_IDS } from '../regionView/clickActions.js';

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
    // ⛓ step 4: the clicks' senders and publishers — the same set the Region Graph registers for its own clicks
    // (`ui:activatePanel` / `ui:navigateToRegion` are the Regions panel's `regions.open` action, published on THIS bus).
    registrationApi.registerEventBusPublisher('ui:activatePanel');
    registrationApi.registerEventBusPublisher('ui:navigateToRegion');
    registrationApi.registerDispatcherSender('user:regionMove', 'bottom', 'first');
    registrationApi.registerDispatcherSender('user:locationCheck', 'bottom', 'first');
    registrationApi.registerEventBusPublisher(REGION_MAP_NODE_SELECTED);
    // ⛓ CA-S3: the generic click events (mode-toggle design §4.3), `{ panelId: 'regionMap', regionName, locationName? }`.
    registrationApi.registerEventBusPublisher(REGION_CLICKED);
    registrationApi.registerEventBusPublisher(LOCATION_CLICKED);
    // ⛓ CA-S4: the Regions panel's `regions.scrollTo` (a location click's action), published on THIS bus.
    registrationApi.registerEventBusPublisher('ui:navigateToLocation');
}

export function initialize(mId, priorityIndex, initializationApi) {
    // Held in regionMapSettings.js, not here: the UI reads them, and a UI → index import is a TDZ cycle.
    moduleHandles.dispatcher = initializationApi?.getDispatcher?.() ?? null;
    moduleHandles.eventBus = initializationApi?.getEventBus?.() ?? null;
    // ⛓ CA-S4: "centre the Region Map on it", for the OTHER map's "On click" strip (off by default).
    try { registerClickAction(makeRegionMapCentreAction(() => [...panelInstances])); }
    catch (e) { console.warn(`regionMap: regionMap.centre not registered: ${e.message}`); }
    return () => { unregisterClickAction(PANEL_ACTION_IDS.mapCentre); };
}

export function postInitialize() {}
