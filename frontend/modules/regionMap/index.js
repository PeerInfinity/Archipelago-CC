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
 * ⛓ v1 PUBLISHES NOTHING: no region moves, no location checks (clicks only select). Clicks are step 4, through
 * `regionView/regionActions.js`. ⇒ no `loops/loopModeExemptions.js` entry is needed today. ⚠ STEP 4: a Region Map
 * click's `source` that does not start with `regionGraph` is NOT a loop-mode planning source
 * (`loopModeExemptions.js` `source.startsWith('regionGraph')`) — when the clicks land, add the Region Map's own
 * prefix there (and its pin in `loopModeExemptions.test.js`) if its clicks should plan the way the Region Graph's do.
 *
 * Open it from the panel menu ("Region Map"); it is in no layout preset.
 */
import { RegionMapUI } from './regionMapUI.js';
import { REGION_MAP_SETTINGS_SCHEMA, panelInstances } from './regionMapSettings.js';

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
}

export function initialize() {}

export function postInitialize() {}
