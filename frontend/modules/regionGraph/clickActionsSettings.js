/**
 * ⛓ The Region Graph's click settings (mode-toggle design §4.4, slice CA-S2): `moduleSettings.regionGraph.clickActions`
 * (⚖ R4, per panel), and the ONE-TIME migration from the seven "On Region Node Click" keys it replaced.
 *
 * MIGRATION: while `clickActions` has no value of its own (`hasStoredSetting` false — only the schema default answers),
 * read the seven `moduleSettings.regionGraph.*` keys (stored, preset-supplied, else their old defaults), run
 * `migrateRegionGraphClickKeys`, and WRITE the result. Once written it is never recomputed: a second load reads it,
 * and a stored `clickActions` is never overwritten. The seven old keys are LEFT IN PLACE: the Region Map's interim
 * click reader (`regionMap/regionMapClicks.js`, until CA-S3) still reads them, and the Regions panel reads
 * `addLocationsToPath` (which a strip save mirrors: `saveRegionGraphClickActions`).
 * ⚖ `movePlayerOneStep` is read but ignored (user, 2026-11-17T23:00:54Z): the migration treats it as false.
 *
 * `settings` is the settings manager (injectable for the tests): `hasStoredSetting`, `getSetting`, `updateSetting`.
 */
import {
    LEGACY_REGION_GRAPH_CLICK_DEFAULTS, migrateRegionGraphClickKeys, defaultClickActions, BUILT_IN_IDS,
} from '../regionView/clickActions.js';

export const CLICK_ACTIONS_KEY = 'moduleSettings.regionGraph.clickActions';
export const LEGACY_CLICK_KEY_PREFIX = 'moduleSettings.regionGraph';

/** A usable `clickActions` value (an object), else null. */
function usable(v) {
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

/**
 * Load the Region Graph's `clickActions`, migrating once when it was never written.
 * → { clickActions, migrated: boolean, from?: <the seven keys as read> }
 * A stored value that is not an object is not overwritten: the panel runs `defaultClickActions()` in memory.
 */
export async function loadRegionGraphClickActions(settings) {
    if (await settings.hasStoredSetting(CLICK_ACTIONS_KEY)) {
        const stored = await settings.getSetting(CLICK_ACTIONS_KEY);
        return { clickActions: usable(stored) ?? defaultClickActions(), migrated: false };
    }
    const from = {};
    for (const [k, dflt] of Object.entries(LEGACY_REGION_GRAPH_CLICK_DEFAULTS)) {
        try {
            from[k] = await settings.getSetting(`${LEGACY_CLICK_KEY_PREFIX}.${k}`, dflt);
        } catch {
            from[k] = dflt;
        }
    }
    const clickActions = migrateRegionGraphClickKeys(from);
    await settings.updateSetting(CLICK_ACTIONS_KEY, clickActions);
    return { clickActions, migrated: true, from };
}

/** The one old key the strip still WRITES (the mirror below). */
export const MIRRORED_LEGACY_KEY = `${LEGACY_CLICK_KEY_PREFIX}.addLocationsToPath`;

/**
 * A STRIP SAVE: store `next` as `clickActions`, and MIRROR the location choice into the old `addLocationsToPath` key
 * (= `location['path.check'] === 'addToPath'`).
 * ⚖ planner archipelago-cc-23, 2026-11-19: the old box drove three readers — the Graph, the Regions panel's own
 * location clicks (`regions/regionBlockBuilder.js`, which reads `regionGraph.addLocationsToPath`) and the interim
 * Region Map — so a strip edit keeps moving the other two exactly as the box did. ONLY this key, and ONLY on a save:
 * the migration and the load path never write it. Retired with the key once the Regions panel reads `clickActions`
 * or owns its option (CA-S3/CA-S4).
 */
export async function saveRegionGraphClickActions(settings, next) {
    await settings.updateSetting(CLICK_ACTIONS_KEY, next);
    const addToPath = next?.location?.[BUILT_IN_IDS.check] === 'addToPath';
    if ((await settings.getSetting(MIRRORED_LEGACY_KEY, false)) !== addToPath) {
        await settings.updateSetting(MIRRORED_LEGACY_KEY, addToPath);
    }
}

/** The settings-schema entry (`regionGraph/index.js`): the default is `defaultClickActions()`. */
export function clickActionsSchemaEntry() {
    return {
        type: 'object',
        default: defaultClickActions(),
        label: 'On click (the click actions strip)',
        description: 'What a click on a region or a location runs: { enabled, region: { <action id>: value }, '
            + 'location: { <action id>: value } }. Edited by the "On click" strip at the top of the panel.',
    };
}
