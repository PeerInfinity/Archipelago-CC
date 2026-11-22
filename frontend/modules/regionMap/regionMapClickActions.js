/**
 * regionMap/regionMapClickActions — **WHAT A REGION MAP CLICK RUNS** (mode-toggle design §4, slice CA-S3).
 *
 * The Region Map's clicks run the shared click-action registry (`regionView/clickActions.js` `runClickActions`) over
 * its OWN settings, `moduleSettings.regionMap.clickActions` (⚖ R4, per panel), edited by the shared "On click" strip
 * (`regionView/clickActionsUI.js`). This replaced step 4's interim reader (`regionMapClicks.js`, which read the Region
 * Graph's seven old `regionGraph.*` keys).
 *
 * ⛓ FIRST RUN COPIES THE REGION GRAPH (⚖ R4: "The Map's first-run default copies the Graph's current setup"). While
 * the Map's key was never written (`hasStoredSetting` false — `getSetting` cannot tell, the schema default always
 * answers), the Map takes the Graph's RESOLVED config through the Graph's own loader,
 * `regionGraph/clickActionsSettings.js` `loadRegionGraphClickActions`:
 *   1. the Graph's stored (or preset-supplied) `clickActions`, if present;
 *   2. otherwise `migrateRegionGraphClickKeys` over the old keys (stored or preset), which the loader also saves as
 *      the Graph's (its own idempotent one-time migration);
 *   3. otherwise the defaults (the migration of the old defaults = `defaultClickActions()`).
 * and SAVES a deep copy once as the Map's, WITHOUT the CA-S4 panel-owned actions (`PANEL_ACTION_IDS`), whose first
 * value is per panel: the Map's strip then seeds its own (⚖ user 2026-11-20T16:29:00Z, *"Per-map option
 * (Recommended)"*: the Map's teleport starts OFF; Discovery's discover too, as the Map's clicks never discovered).
 * A stored Map config is never overwritten; a second load writes nothing.
 * From then on the two are independent: an edit of either strip never moves the other.
 *
 * ⛓ THE EVENTS (design §4.3): every Map click publishes `regionView:regionClicked` / `regionView:locationClicked`
 * `{ panelId: 'regionMap', regionName, locationName? }`, whatever the click actions do (master off included).
 * CA-S5 retired `regionMap:nodeSelected` (a region click's selection, published first until then): nothing heard it.
 */
import {
    runClickActions, clickStatusOf, defaultClickActions, withoutPerPanelInitials, PANEL_ACTION_IDS,
    REGION_CLICKED, LOCATION_CLICKED,
} from '../regionView/clickActions.js';
import { loadRegionGraphClickActions } from '../regionGraph/clickActionsSettings.js';
import { setShowAllRegionsBox } from '../regions/regionsClickActions.js';

export const PANEL_ID = 'regionMap';
export const REGION_MAP_CLICK_ACTIONS_KEY = 'moduleSettings.regionMap.clickActions';

/** `user:locationCheck` `originator` strings (the Region Graph's are `RegionGraphCheck` / `RegionGraphBulkCheck`). */
export const REGION_MAP_ORIGINATORS = Object.freeze({
    check: 'regionMapCheck',
    bulkCheck: 'regionMapBulkCheck',
});

/** The generic click events (design §4.3), published by every map panel (named in `regionView/clickActions.js`). */
export { REGION_CLICKED, LOCATION_CLICKED };

/** A usable `clickActions` value (an object), else null. */
function usable(v) {
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

/**
 * Load the Map's `clickActions`; on the FIRST run (never written) copy the Region Graph's resolved config and save it.
 * → { clickActions, copied: boolean, graphMigrated?: boolean }
 * A stored value that is not an object is not overwritten: the panel runs `defaultClickActions()` in memory.
 * `settings`: `hasStoredSetting`, `getSetting`, `updateSetting` (the settings manager; injectable for the tests).
 */
export async function loadRegionMapClickActions(settings) {
    if (await settings.hasStoredSetting(REGION_MAP_CLICK_ACTIONS_KEY)) {
        const stored = await settings.getSetting(REGION_MAP_CLICK_ACTIONS_KEY);
        return { clickActions: usable(stored) ?? defaultClickActions(), copied: false };
    }
    const graph = await loadRegionGraphClickActions(settings);
    const clickActions = withoutPerPanelInitials(structuredClone(graph.clickActions));
    await settings.updateSetting(REGION_MAP_CLICK_ACTIONS_KEY, clickActions);
    return { clickActions, copied: true, graphMigrated: graph.migrated };
}

/**
 * A strip save: the Map's key only (no mirror — the Map's location choice is its own, ⚖ R4). A SEEDED save (the
 * strip writing an action's initial value, CA-S4) keeps a session override session-only, as the Graph's does.
 */
export async function saveRegionMapClickActions(settings, next, { seeded = false } = {}) {
    if (seeded && settings.hasOverride?.(REGION_MAP_CLICK_ACTIONS_KEY)) {
        await settings.updateSetting(REGION_MAP_CLICK_ACTIONS_KEY, next, { persist: false });
    } else {
        await settings.updateSetting(REGION_MAP_CLICK_ACTIONS_KEY, next);
    }
}

/**
 * ⛓ `regionMap.centre` (CA-S4): "centre the Region Map on the clicked region", the Map's own action, offered to the
 * OTHER map (the Region Graph) and never to the Map itself. It starts OFF in every strip. It eases every live Map
 * panel's camera onto the region's cell (`RegionMapUI.centreOnRegion`) and turns its Follow off, as a manual pan does.
 * Registered by `regionMap/index.js` `initialize`, over `getPanels()` (the live panels).
 */
export function makeRegionMapCentreAction(getPanels) {
    return Object.freeze({
        id: PANEL_ACTION_IDS.mapCentre,
        owner: 'regionMap',
        label: 'Centre the Region Map on it',
        summary: 'centre Map',
        target: 'region',
        kind: 'toggle',
        initial: () => false,
        offeredTo: (panelId) => panelId !== PANEL_ID,
        run: (h, ctx) => {
            let centred = 0;
            for (const p of getPanels()) if (p?.centreOnRegion?.(ctx.regionName)) centred++;
            return centred > 0 ? { ok: true, centred } : { ok: false, reason: 'not-drawn' };
        },
    });
}

/** The settings-schema entry (`regionMapSettings.js`): the default is `defaultClickActions()`. */
export function regionMapClickActionsSchemaEntry() {
    return {
        type: 'object',
        default: defaultClickActions(),
        label: 'On click (the click actions strip)',
        description: 'What a click on a region or a location square runs: { enabled, region: { <action id>: value }, '
            + 'location: { <action id>: value } }. Edited by the "On click" strip at the top of the panel. The first run '
            + 'copies the Region Graph\'s.',
    };
}

/**
 * The rules region a click on display cell `key` (with `members`, the rules regions folded into it) moves to: the key
 * itself when it is one of its members (a level and its folded sub-regions: the level), else the first member.
 */
export function regionOfCell(key, members = []) {
    if (!members || members.length === 0) return key;
    return members.includes(key) ? key : members[0];
}

/**
 * The extra handles the built-in actions read (`clickActions.js` header) on top of the panel's `regionActions`
 * handles: the Map's originators, and the Regions panel's "Show All Regions" off before a path edit runs (as the
 * Region Graph's path edits always did, and the Map's did since step 4).
 */
export function withClickHandles(h, { showAll = setShowAllRegionsBox } = {}) {
    return Object.assign(h, {
        originators: REGION_MAP_ORIGINATORS,
        beforePathExecute: () => showAll(false),
    });
}

/**
 * ⛓ ONE MAP CLICK. A region click: the generic event, then the region click actions. A location click: the generic event, then the location click actions.
 * @param {object} h  the panel's handles (`withClickHandles` applied)
 * @param {'region'|'location'} target
 * @param {{ regionName, locationName? }} click
 * @param {object} settings  the Map's `clickActions`
 * @param {object} discovery  `{ active, settings }` (the checks' `disableLocationCheckUI` gate)
 * → { run: <runClickActions answer>, status: { text, from } | null }
 */
export function runRegionMapClick(h, target, { regionName, locationName = undefined }, settings, discovery = {}) {
    if (target === 'region') {
        h.eventBus.publish(REGION_CLICKED, { panelId: PANEL_ID, regionName });
    } else {
        h.eventBus.publish(LOCATION_CLICKED, { panelId: PANEL_ID, regionName, locationName });
    }
    const ctx = target === 'region' ? { regionName, discovery } : { regionName, locationName, discovery };
    const run = runClickActions(PANEL_ID, target, ctx, settings, h);
    return { run, status: clickStatusOf(run, ctx, settings) };
}
