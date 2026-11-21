/**
 * ⛓ `discovery.discover` (mode-toggle design §4.2, slice CA-S4): a map click on a region discovers it. It REPLACED
 * Discovery's `regionGraph:nodeSelected` listener (`discovery/index.js` `handleRegionClicked`, which still answers the
 * Regions panel's `ui:regionHeaderClicked`), and runs that same handler.
 *
 * STILL GATED BY THE SETTINGS BUNDLE: the handler does nothing unless `enableDiscoveryMode` AND `clickDiscoversRegion`
 * (loop mode's bundle sets `clickDiscoversRegion: false`, `worldDiscoveryMode.js`). So the action discovers only when a
 * panel enables it AND the bundle allows it.
 *
 * FIRST VALUES (`initial`): the Region Graph ON (its clicks always reached the listener: today's behaviour), the Region
 * Map OFF (its clicks never published `regionGraph:nodeSelected`, so they never discovered). Order `ORDER.select`: it
 * runs before the path, where the listener ran (the Graph published the event before any action).
 */
import { ORDER, PANEL_ACTION_IDS } from '../regionView/clickActions.js';

/** The descriptor, over `handleRegionClicked({ regionName })` → `{ ok, … }` (Discovery's own handler). */
export function makeDiscoverAction(handleRegionClicked) {
    return Object.freeze({
        id: PANEL_ACTION_IDS.discover,
        owner: 'discovery',
        label: 'Discover the region (when discovery mode lets a click discover)',
        summary: 'discover',
        target: 'region',
        kind: 'toggle',
        order: ORDER.select,
        initial: (panelId) => panelId === 'regionGraph',
        run: (h, ctx) => handleRegionClicked({ regionName: ctx.regionName }),
    });
}
