/**
 * ⛔ TEST KIT — the BEFORE oracle of CA-S3's equivalence (`regionMapClicks.equivalence.test.js`). This is
 * `regionMap/regionMapClicks.js` at base 3a1909b2dcf1 (step 4's interim Region Map click reader), kept VERBATIM below
 * this header (`git show 3a1909b2dc:frontend/modules/regionMap/regionMapClicks.js`). CA-S3 retired the live module;
 * nothing but the equivalence test imports this file. ⚠ Its `actions.moveOneStep` call is reached only with
 * `movePlayerOneStep` true, which the forced-false table never sets (the function left `regionActions.js` in CA-S3).
 */
/**
 * regionMap/regionMapClicks — **WHAT A REGION MAP CLICK DOES** (region-map step 4).
 *
 * ⚖ (user, 2026-11-17) *"Yes, let's copy the Region Graph's click behavior for now."* ⇒ this module is the Region
 * Graph's click semantics (`regionGraph/graphInteractionManager.js` `handleRegionNodeClick` /
 * `handleLocationNodeClick` / `checkAllLocationsInRegion`, `navigationManager.js`'s four moves), re-expressed over the
 * shared `regionView/regionActions.js`, with the Region Map's OWN dispatcher, event bus, source and originator
 * strings. The census and its mapping are in `CC/docs/region-map/step4-clicks.md`.
 *
 * ⚖ THE TOGGLES (planner ruling, option A): the Region Graph's click behaviour is chosen by its control panel's seven
 * checkboxes, persisted as `moduleSettings.regionGraph.*`. The Region Map has no copy of those controls (the
 * mode-toggle discussion will design one) and adds none: it READS the same settings, with the same defaults, at click
 * time (`readClickOptions`). ⇒ today the Region Graph's control panel drives Region Map clicks too. The settings
 * prefix is ONE argument (`CLICK_OPTIONS_PREFIX`), so a Region Map copy of the controls is a prefix swap.
 *
 * ⛔ No DOM, no canvas: the panel resolves a gesture to a region / location (`frameAt`, `squareAt`) and calls
 * `onRegionClick` / `onLocationClick` with its handles. `actions` is injectable (the tests stub it).
 */
import * as regionActions from '../regionView/regionActions.js';

/** `user:regionMove` `source` strings. `regionMap*` is a loop-mode planning prefix (`loops/loopModeExemptions.js`). */
export const REGION_MAP_SOURCES = Object.freeze({
    oneStep: 'regionMap-oneStep',
    direct: 'regionMap-direct',
    addToPath: 'regionMap-addToPath',
    overwritePath: 'regionMap-overwritePath',
});

/** `user:locationCheck` `originator` strings (the Region Graph's are `RegionGraphCheck` / `RegionGraphBulkCheck`). */
export const REGION_MAP_ORIGINATORS = Object.freeze({
    check: 'regionMapCheck',
    bulkCheck: 'regionMapBulkCheck',
});

export const REGION_MAP_NODE_SELECTED = 'regionMap:nodeSelected';

/** ⚖ option A: the Region Graph's toggles. One argument away from a Region Map copy. */
export const CLICK_OPTIONS_PREFIX = 'moduleSettings.regionGraph';

/**
 * The seven toggles and their defaults — the Region Graph's (`regionGraph/layoutControlsManager.js`'s checkbox list;
 * the HTML `checked` attributes agree). `addLocationsToPath` is also in the Region Graph's settings schema (false).
 */
export const CLICK_OPTION_DEFAULTS = Object.freeze({
    movePlayerOneStep: false,
    movePlayerDirectly: true,
    showRegionInPanel: true,
    addToPath: true,
    overwritePath: false,
    addLocationsToPath: false,
    checkAllLocationsInRegion: false,
});

/** Read the toggles from `settings.getSetting` (async). A key that fails to read takes its default. */
export async function readClickOptions(settings, prefix = CLICK_OPTIONS_PREFIX) {
    const out = { ...CLICK_OPTION_DEFAULTS };
    if (!settings?.getSetting) return out;
    for (const [k, dflt] of Object.entries(CLICK_OPTION_DEFAULTS)) {
        try {
            out[k] = !!(await settings.getSetting(`${prefix}.${k}`, dflt));
        } catch {
            out[k] = dflt;
        }
    }
    return out;
}

/**
 * The rules region a click on display cell `key` (with `members`, the rules regions folded into it) moves to: the key
 * itself when it is one of its members (a level and its folded sub-regions: the level), else the first member.
 */
export function regionOfCell(key, members = []) {
    if (!members || members.length === 0) return key;
    return members.includes(key) ? key : members[0];
}

/** The Regions panel's "Show All Regions" box (`#show-all-regions`), as the Region Graph sets it. */
export function setShowAllRegions(enabled, doc = (typeof document !== 'undefined' ? document : null)) {
    const box = doc?.querySelector?.('#show-all-regions');
    if (box && box.checked !== enabled) {
        box.checked = enabled;
        box.dispatchEvent(new Event('change'));
    }
}

/**
 * The status text a result reads as (the Region Graph's `updateStatus` texts), or null for a silent result.
 * `restart` / `no-path` / the four successes.
 */
export function statusOf(kind, target, r) {
    if (!r) return null;
    if (!r.ok) {
        if (r.reason !== 'no-path') return null;
        return kind === 'addToPath' || kind === 'overwritePath' ? `No path from ${r.from} to ${target}` : `No path to ${target}`;
    }
    if (r.kind === 'restart') return `Restart → ${r.region} (no walk from ${r.from} to ${target})`;
    if (kind === 'oneStep') {
        return r.path.length === 1 ? `Moving to ${target}` : `Moving to ${target} (${r.path.length} steps via ${r.path.steps[1]})`;
    }
    if (kind === 'direct') {
        return r.path.length === 1 ? `Moving directly to ${target}` : `Moving directly to ${target} (skipping ${r.path.length - 1} steps)`;
    }
    if (kind === 'addToPath') return r.kind === 'path' ? `Added ${r.dispatched} region(s) to path` : null;
    if (kind === 'overwritePath') return `Created path: ${r.from} → ${target} (${r.dispatched} steps)`;
    return null;
}

/**
 * The moves a click on `region` makes under `opts` — the Region Graph's precedence: add to path, else overwrite
 * path, else one step and/or direct. → [{kind, result}]
 */
export function moveForClick(h, region, opts, { actions = regionActions, onStatus = null, showAll = setShowAllRegions } = {}) {
    const out = [];
    const report = (kind, r) => {
        out.push({ kind, result: r });
        const s = statusOf(kind, region, r);
        if (s) onStatus?.(s);
    };
    if (opts.addToPath) {
        report('addToPath', actions.addToPath(h, region, {
            moveOnlyOneStep: !!opts.movePlayerOneStep, source: REGION_MAP_SOURCES.addToPath,
            beforeExecute: () => showAll(false),
        }));
    } else if (opts.overwritePath) {
        report('overwritePath', actions.overwritePath(h, region, {
            moveOnlyOneStep: !!opts.movePlayerOneStep, source: REGION_MAP_SOURCES.overwritePath,
            beforeExecute: () => showAll(false),
        }));
    } else {
        if (opts.movePlayerOneStep) report('oneStep', actions.moveOneStep(h, region, REGION_MAP_SOURCES.oneStep));
        if (opts.movePlayerDirectly) report('direct', actions.moveDirectly(h, region, REGION_MAP_SOURCES.direct));
    }
    return out;
}

/**
 * ⛓ A CLICK ON A REGION (a cell) — `handleRegionNodeClick`: select, the moves, show it in the Regions panel, and the
 * bulk check. → { moves, shown, bulk }
 * @param {object} h  the action handles (the Region Map's dispatcher and event bus, …)
 * @param {object} opts  `readClickOptions`'s answer
 * @param {object} discovery  `{active, settings}` (the bulk check's `disableLocationCheckUI` gate)
 */
export function onRegionClick(h, region, opts, discovery = {}, { actions = regionActions, onStatus = null,
    showAll = setShowAllRegions, data = null } = {}) {
    actions.publishNodeSelected(h, REGION_MAP_NODE_SELECTED, region, data ?? { id: region });
    const moves = moveForClick(h, region, opts, { actions, onStatus, showAll });
    let shown = false;
    if (opts.showRegionInPanel) {
        showAll(!(opts.addToPath || opts.overwritePath));
        actions.showRegionInRegionsPanel(h, region);
        shown = true;
    }
    let bulk = null;
    if (opts.checkAllLocationsInRegion && actions.locationChecksAllowed(discovery)) {
        bulk = actions.checkAccessibleLocationsInRegion(h, region, { originator: REGION_MAP_ORIGINATORS.bulkCheck });
    }
    return { moves, shown, bulk };
}

/**
 * ⛓ A CLICK ON A LOCATION SQUARE — `handleLocationNodeClick`: refused when discovery disables location checks; with
 * "Add locations to path" the region's moves then a path location check; else one `user:locationCheck`.
 * (A location the logic says is unreachable is refused DOWNSTREAM — the state manager's `not_accessible`, the
 * client's check gate — exactly as a Region Graph check is; nothing here evaluates its rule.)
 * → { refused: 'discovery' } | { moves, pathCheck } | { check }
 */
export function onLocationClick(h, { locationName, regionName }, opts, discovery = {}, { actions = regionActions,
    onStatus = null, showAll = setShowAllRegions } = {}) {
    if (!actions.locationChecksAllowed(discovery)) return { refused: 'discovery' };
    if (opts.addLocationsToPath) {
        const moves = moveForClick(h, regionName, opts, { actions, onStatus, showAll });
        const pathCheck = actions.addLocationCheckToPath(h, locationName, regionName);
        return { moves, pathCheck };
    }
    return { check: actions.checkLocation(h, { locationName, regionName, originator: REGION_MAP_ORIGINATORS.check }) };
}
