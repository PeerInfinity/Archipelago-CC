/**
 * ⛓ The Region Graph's click settings (mode-toggle design §4.4, slice CA-S2): `moduleSettings.regionGraph.clickActions`
 * (⚖ R4, per panel), and the ONE-TIME migration from the seven "On Region Node Click" keys it replaced.
 *
 * MIGRATION: while `clickActions` has no value of its own (`hasStoredSetting` false — only the schema default answers),
 * read the seven `moduleSettings.regionGraph.*` keys (stored, preset-supplied, else their old defaults), run
 * `migrateRegionGraphClickKeys`, and WRITE the result. Once written it is never recomputed: a second load reads it,
 * and a stored `clickActions` is never overwritten. The old keys are LEFT IN PLACE (never deleted from a user's
 * storage) and, since CA-S4, nothing else reads them: the Regions panel's location clicks read this resolver
 * (`regionGraphLocationAddsToPath`), and the strip's mirror of `addLocationsToPath` is retired. The Region Map's first
 * run copies this resolver's answer (`regionMap/regionMapClickActions.js`, ⚖ R4).
 * ⚖ `movePlayerOneStep` is read but ignored (user, 2026-11-17T23:00:54Z): the migration treats it as false.
 *
 * `settings` is the settings manager (injectable for the tests): `hasStoredSetting`, `getSetting`, `updateSetting`
 * (and `hasOverride`, for a seeded save).
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
 * The Region Graph's resolved `clickActions`, READ ONLY (nothing is written): the stored (or preset) value; else the
 * migration of the seven old keys as they read now (stored, preset-supplied, else their old defaults).
 * → { clickActions, stored: boolean, from?: <the seven keys as read> }
 */
export async function readRegionGraphClickActions(settings) {
    if (await settings.hasStoredSetting(CLICK_ACTIONS_KEY)) {
        const value = await settings.getSetting(CLICK_ACTIONS_KEY);
        return { clickActions: usable(value) ?? defaultClickActions(), stored: true };
    }
    const from = {};
    for (const [k, dflt] of Object.entries(LEGACY_REGION_GRAPH_CLICK_DEFAULTS)) {
        try {
            from[k] = await settings.getSetting(`${LEGACY_CLICK_KEY_PREFIX}.${k}`, dflt);
        } catch {
            from[k] = dflt;
        }
    }
    return { clickActions: migrateRegionGraphClickKeys(from), stored: false, from };
}

/**
 * Load the Region Graph's `clickActions`, migrating once when it was never written.
 * → { clickActions, migrated: boolean, from?: <the seven keys as read> }
 * A stored value that is not an object is not overwritten: the panel runs `defaultClickActions()` in memory.
 */
export async function loadRegionGraphClickActions(settings) {
    const read = await readRegionGraphClickActions(settings);
    if (read.stored) return { clickActions: read.clickActions, migrated: false };
    await settings.updateSetting(CLICK_ACTIONS_KEY, read.clickActions);
    return { clickActions: read.clickActions, migrated: true, from: read.from };
}

/**
 * ⛓ THE REGIONS PANEL'S LOCATION CLICK (CA-S4): does the Region Graph's location action add the check to the path
 * (`clickActions.location['path.check'] === 'addToPath'`)? Read through the Graph's resolver, migration included, and
 * never written. It replaced the panel's read of the old `addLocationsToPath` key, which only the CA-S2 mirror kept in
 * step with the strip: so a user whose only stored state is that old key (no `clickActions` yet) reads the same answer.
 */
export async function regionGraphLocationAddsToPath(settings) {
    const { clickActions } = await readRegionGraphClickActions(settings);
    return clickActions?.location?.[BUILT_IN_IDS.check] === 'addToPath';
}

/**
 * A STRIP SAVE: store `next` as `clickActions`. A SEEDED save (`{ seeded: true }`: the strip writing an action's
 * initial value, CA-S4) keeps a session override session-only (`persist: false` while the key has one), so a row that
 * set its own click actions is not cleared by a registration.
 * (CA-S2's mirror of the location choice into `addLocationsToPath` is retired in CA-S4: the Regions panel reads
 * `regionGraphLocationAddsToPath`.)
 */
export async function saveRegionGraphClickActions(settings, next, { seeded = false } = {}) {
    const persist = !(seeded && settings.hasOverride?.(CLICK_ACTIONS_KEY));
    if (persist) await settings.updateSetting(CLICK_ACTIONS_KEY, next);
    else await settings.updateSetting(CLICK_ACTIONS_KEY, next, { persist: false });
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
