/**
 * ⛓ The Regions panel's click action (mode-toggle design §4.2): `regions.open` — "open the Regions panel at the
 * clicked region". Registered by `regions/index.js` `initialize` and unregistered by its cleanup, so a layout without
 * the Regions module offers no such action (the strip shows a kept setting as "(not loaded)").
 *
 * Registered in CA-S2 so the Region Graph's default click keeps "show region in the Regions panel" when its seven
 * checkboxes go. CA-S4 adds the location action `regions.scrollTo` beside it (`REGIONS_SCROLL_TO_ACTION`, below).
 *
 * Behaviour = the Region Graph's `showRegionInPanel` branch before CA-S2 (`graphInteractionManager.js`
 * `handleRegionNodeClick`): set the panel's "Show All Regions" box to !(the click's route edits the path — from its end
 * or from the start), then `ui:activatePanel` + `ui:navigateToRegion` on the CLICKING panel's event bus (`h.eventBus`),
 * which is the publisher those events were registered for.
 */
import { BUILT_IN_IDS, REGIONS_OPEN_ID, PANEL_ACTION_IDS } from '../regionView/clickActions.js';
import { showRegionInRegionsPanel } from '../regionView/regionActions.js';

/** Tick / untick the Regions panel's "Show All Regions" box and fire its change, only on a change. */
export function setShowAllRegionsBox(enabled, doc = (typeof document !== 'undefined' ? document : null)) {
    const box = doc?.querySelector?.('#show-all-regions');
    if (box && box.checked !== enabled) {
        box.checked = enabled;
        box.dispatchEvent(new Event('change'));
    }
}

export const REGIONS_OPEN_ACTION = Object.freeze({
    id: REGIONS_OPEN_ID,
    owner: 'regions',
    label: 'Open it in the Regions panel',
    summary: 'Regions',
    target: 'region',
    kind: 'toggle',
    run: (h, ctx) => {
        const route = ctx.settings?.region?.[BUILT_IN_IDS.route];
        setShowAllRegionsBox(!(route && (route.from === 'pathEnd' || route.from === 'start')));
        showRegionInRegionsPanel(h, ctx.regionName);
        return { ok: true };
    },
});

/**
 * ⛓ `regions.scrollTo` (CA-S4, design §4.2 and R5's preview): a LOCATION click "scrolls the Regions panel to it":
 * `ui:activatePanel` (the Regions panel) then `ui:navigateToLocation { regionName, locationName }` on the clicking
 * panel's bus, the event the Regions panel already answers (`regions/eventCoordinator.js` `handleNavigateToLocation`:
 * open the region, scroll the location into view, highlight it). OFF in every strip to start (`initial`), so no click
 * changes until a user turns it on.
 */
export const REGIONS_SCROLL_TO_ACTION = Object.freeze({
    id: PANEL_ACTION_IDS.regionsScrollTo,
    owner: 'regions',
    label: 'Scroll the Regions panel to it',
    summary: 'Regions',
    target: 'location',
    kind: 'toggle',
    initial: () => false,
    run: (h, ctx) => {
        if (!h.eventBus) return { ok: false, reason: 'no-event-bus' };
        h.eventBus.publish('ui:activatePanel', { panelId: 'regionsPanel' });
        h.eventBus.publish('ui:navigateToLocation', { regionName: ctx.regionName, locationName: ctx.locationName });
        return { ok: true };
    },
});
