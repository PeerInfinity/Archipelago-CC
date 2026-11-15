/**
 * ⛓ REGION VIEW MODEL — the renderer-agnostic state of a region view (region map step 2).
 *
 * Pure functions of (snapshot, staticData, discovery state, settings). Nothing here imports Cytoscape, the DOM,
 * a panel instance or a singleton: every input is an argument. The Region Graph (`regionGraph/graphDataManager.js`)
 * computes its node/edge classes from these; the Region Map panel (step 3b) reads the same answers through
 * `regionViewState.js`.
 *
 * The DISCOVERY CONTEXT (`ctx`) that the visibility functions take:
 *   {
 *     active:           boolean — discovery mode on (`moduleSettings.discovery.enableDiscoveryMode`);
 *     settings:         the discovery settings ({ undiscoveredDisplay, showUndiscoveredRegionNames,
 *                       showUndiscoveredDetails, colorUndiscoveredByReachability, … });
 *     discovery:        { isRegionDiscovered(name), isLocationDiscovered(name), isExitDiscovered(region, exit) }
 *                       — `discovery/singleton.js` in the app, a fake in a test;
 *     regions:          staticData.regions (a Map) — for "has an entrance from a discovered region";
 *     showUndiscovered: the panel's own "Show undiscovered" control (the Region Graph reads its
 *                       `#graph-show-undiscovered` box; the Region Map has its own). Default true.
 *   }
 * `discoveryContext(...)` builds one.
 */
import { evaluateRule } from '../shared/ruleEngine.js';
import { createSnapshotInterface } from '../shared/snapshotInterface.js';

/** The `snapshot.regionReachability` values that mean "reachable". */
export const REACHABLE_VALUES = Object.freeze([true, 'reachable', 'checked']);

/** Is `name` reachable in `snapshot`? The tri-value test, in one place. */
export function isRegionReachable(snapshot, name) {
    const v = snapshot?.regionReachability?.[name];
    return v === true || v === 'reachable' || v === 'checked';
}

/**
 * Evaluate an access rule; a throw counts as false and is reported through `onError(error)`. A missing rule is
 * true. `snapshotInterface` is built from (snapshot, staticData) when not given.
 */
export function evaluateAccessRule(rule, { snapshot, staticData, snapshotInterface = null, onError = null } = {}) {
    if (!rule) return true;
    try {
        return evaluateRule(rule, snapshotInterface ?? createSnapshotInterface(snapshot, staticData));
    } catch (e) {
        onError?.(e);
        return false;
    }
}

/**
 * A location's state: `'checked' | 'accessible' | 'inaccessible'`. Region accessibility comes from the snapshot
 * (`isRegionReachable`), never from a renderer.
 * @param {object} location - a staticData location ({ name, access_rule, … })
 * @param {object} [opts] - { regionName (default `location.parent_region ?? location.region`), snapshotInterface,
 *   onError(error) }
 */
export function locationState(snapshot, staticData, location, opts = {}) {
    if (!snapshot || !staticData) return 'inaccessible';
    if ((snapshot.checkedLocations || []).includes(location.name)) return 'checked';
    const regionName = opts.regionName ?? location.parent_region ?? location.region;
    if (!isRegionReachable(snapshot, regionName)) return 'inaccessible';
    const ok = evaluateAccessRule(location.access_rule, { snapshot, staticData, ...opts });
    return ok ? 'accessible' : 'inaccessible';
}

/**
 * A region's location counts. `regionData` defaults to `staticData.regions.get(regionName)`.
 * → { checked, accessible, inaccessible, total, hasAccessible, hasInaccessible, hasUnchecked, allChecked,
 *     hasLocations } — or `{ checked: 0, accessible: 0, inaccessible: 0, total: 0 }` without data.
 */
export function locationCounts(snapshot, staticData, regionName, regionData = staticData?.regions?.get?.(regionName),
    { onError = null } = {}) {
    if (!snapshot || !staticData || !regionData) {
        return { checked: 0, accessible: 0, inaccessible: 0, total: 0 };
    }
    const snapshotInterface = createSnapshotInterface(snapshot, staticData);
    const locations = regionData.locations || [];
    const checkedLocations = new Set(snapshot.checkedLocations || []);
    let checked = 0;
    let accessible = 0;
    let inaccessible = 0;
    const regionIsReachable = isRegionReachable(snapshot, regionName);
    for (const location of locations) {
        if (checkedLocations.has(location.name)) {
            checked++;
            continue;
        }
        // A location needs its region reachable first.
        let locationAccessible = regionIsReachable;
        if (location.access_rule && regionIsReachable) {
            locationAccessible = evaluateAccessRule(location.access_rule,
                { snapshotInterface, onError: onError && ((e) => onError(e, location)) });
        }
        if (locationAccessible) accessible++;
        else inaccessible++;
    }
    return {
        checked,
        accessible,
        inaccessible,
        total: locations.length,
        hasAccessible: accessible > 0,
        hasInaccessible: inaccessible > 0,
        hasUnchecked: (accessible + inaccessible) > 0,
        allChecked: checked === locations.length && locations.length > 0,
        hasLocations: locations.length > 0,
    };
}

/**
 * A region's interior state from its counts: `'completed'` (every location checked, or none),
 * `'all-accessible' | 'mixed-locations' | 'all-inaccessible'`, or null (unreachable, or nothing unchecked).
 */
export function regionInteriorState(counts, reachable) {
    if (counts.allChecked || counts.total === 0) return 'completed';
    if (!reachable || !counts.hasUnchecked) return null;
    if (counts.hasAccessible && !counts.hasInaccessible) return 'all-accessible';
    if (counts.hasAccessible && counts.hasInaccessible) return 'mixed-locations';
    if (!counts.hasAccessible && counts.hasInaccessible) return 'all-inaccessible';
    return null;
}

/**
 * The reachability colour a view shows for a region: `'accessible' | 'inaccessible'`, or null when it shows none —
 * an external accessibility filter turned colours off (`ctx.showAccessibility === false`), or discovery hides an
 * undiscovered region's reachability (unless `settings.colorUndiscoveredByReachability`).
 * ⚠ This is what the Region Graph's region node CLASS encodes, so it is what its location nodes'
 * `region-accessible` / `region-inaccessible` follow. A view that wants raw reachability uses `isRegionReachable`.
 */
export function regionColorState(snapshot, name, ctx = {}) {
    if (ctx.showAccessibility === false) return null;
    const skip = ctx.active && !ctx.discovery?.isRegionDiscovered(name) && !ctx.settings?.colorUndiscoveredByReachability;
    if (skip) return null;
    return isRegionReachable(snapshot, name) ? 'accessible' : 'inaccessible';
}

/**
 * An exit pair's traversability. `exit` = { source, target, forwardRule, reverseRule, bidirectional }: the forward
 * exit leads source → target; the reverse (when `bidirectional`) target → source.
 * → { sourceReachable, targetReachable, forwardAccessible, reverseAccessible, traversable }.
 * A bidirectional pair is traversable when either direction is; a one-way exit when its forward one is.
 * `onError(error, direction)` hears a rule that threw (counted as not accessible).
 */
export function exitState(snapshot, staticData, exit, { snapshotInterface = null, onError = null } = {}) {
    const si = snapshotInterface ?? createSnapshotInterface(snapshot, staticData);
    const sourceReachable = isRegionReachable(snapshot, exit.source);
    const targetReachable = isRegionReachable(snapshot, exit.target);
    const forwardAccessible = exit.forwardRule
        ? evaluateAccessRule(exit.forwardRule, { snapshotInterface: si, onError: onError && ((e) => onError(e, 'forward')) })
        : true;
    const reverseAccessible = (exit.reverseRule && exit.bidirectional)
        ? evaluateAccessRule(exit.reverseRule, { snapshotInterface: si, onError: onError && ((e) => onError(e, 'reverse')) })
        : true;
    const traversable = exit.bidirectional
        ? (sourceReachable && forwardAccessible) || (targetReachable && reverseAccessible)
        : sourceReachable && forwardAccessible;
    return { sourceReachable, targetReachable, forwardAccessible, reverseAccessible, traversable };
}

/* ══════════════════════════════════════════════════════════════════════
 * DISCOVERY VISIBILITY — the ONE copy of the hide / placeholder decision
 * ══════════════════════════════════════════════════════════════════════ */

/** Build a discovery context (see the file header). */
export function discoveryContext({ active = false, settings = {}, discovery, regions, showUndiscovered = true,
    showAccessibility = true } = {}) {
    return { active: !!active, settings: settings || {}, discovery, regions, showUndiscovered, showAccessibility };
}

/** Does any DISCOVERED region have an exit to `regionName`? */
export function hasEntranceFromDiscoveredRegion(regionName, regions, discovery) {
    for (const [sourceName, sourceData] of regions?.entries?.() ?? []) {
        if (!discovery.isRegionDiscovered(sourceName)) continue;
        for (const exit of sourceData?.exits ?? []) {
            if (exit.connected_region === regionName) return true;
        }
    }
    return false;
}

const hidesUndiscovered = (ctx) => ctx.settings?.undiscoveredDisplay === 'hidden' && !ctx.showUndiscovered;

/**
 * A region's discovery standing: { discovered, hasEntrance, visibility }. `visibility` is
 * `'shown'` (discovery off, or discovered) | `'placeholder'` (undiscovered, entered from a discovered region) |
 * `'hidden'` (no such entrance, or undiscovered ones are hidden). `hasEntrance` is computed only when it matters
 * (undiscovered, discovery on) and is null otherwise.
 */
export function regionDiscovery(name, ctx) {
    const discovered = ctx.discovery.isRegionDiscovered(name);
    if (!ctx.active || discovered) return { discovered, hasEntrance: null, visibility: 'shown' };
    const hasEntrance = hasEntranceFromDiscoveredRegion(name, ctx.regions, ctx.discovery);
    const hidden = !hasEntrance || hidesUndiscovered(ctx);
    return { discovered, hasEntrance, visibility: hidden ? 'hidden' : 'placeholder' };
}

/** `'shown' | 'placeholder' | 'hidden'` — see `regionDiscovery`. */
export function regionVisibility(name, ctx) {
    return regionDiscovery(name, ctx).visibility;
}

/**
 * A location's discovery standing: { discovered, placeholder, regionHidden, visibility }.
 *   · `placeholder` — discovery on, and the location or its region is undiscovered;
 *   · `regionHidden` — discovery on, and its region's visibility is `'hidden'`;
 *   · `visibility` — `'hidden'` (region hidden, or a placeholder while undiscovered ones are not shown) |
 *     `'placeholder'` | `'shown'`.
 * `discovered` is the location's own flag, whatever the mode.
 */
export function locationDiscovery(locationName, regionName, ctx) {
    const discovered = ctx.discovery.isLocationDiscovered(locationName);
    if (!ctx.active) return { discovered, placeholder: false, regionHidden: false, visibility: 'shown' };
    const placeholder = !ctx.discovery.isRegionDiscovered(regionName) || !discovered;
    const regionHidden = regionVisibility(regionName, ctx) === 'hidden';
    const visibility = regionHidden ? 'hidden'
        : placeholder ? (ctx.showUndiscovered ? 'placeholder' : 'hidden')
            : 'shown';
    return { discovered, placeholder, regionHidden, visibility };
}

/** `'shown' | 'placeholder' | 'hidden'` — see `locationDiscovery`. */
export function locationVisibility(locationName, regionName, ctx) {
    return locationDiscovery(locationName, regionName, ctx).visibility;
}

/**
 * An exit pair's discovery standing: { discovered, visibility }. `exit` = { source, target, forwardExitName,
 * reverseExitName } (the reverse exit, when there is one, leaves `target`).
 *   · `discovered` — discovery off, or either direction's exit is discovered;
 *   · `visibility` — `'hidden'` when an endpoint is neither discovered nor entered from a discovered region, or the
 *     pair is undiscovered while undiscovered ones are hidden; else `'placeholder'` (undiscovered) or `'shown'`.
 */
export function exitDiscovery(exit, ctx) {
    if (!ctx.active) return { discovered: true, visibility: 'shown' };
    const d = ctx.discovery;
    const forward = exit.forwardExitName ? d.isExitDiscovered(exit.source, exit.forwardExitName) : false;
    const reverse = exit.reverseExitName ? d.isExitDiscovered(exit.target, exit.reverseExitName) : false;
    const entered = (r) => d.isRegionDiscovered(r) || hasEntranceFromDiscoveredRegion(r, ctx.regions, d);
    let hidden = !entered(exit.source) || !entered(exit.target);
    const discovered = forward || reverse;
    if (!discovered && hidesUndiscovered(ctx)) hidden = true;
    return { discovered, visibility: hidden ? 'hidden' : discovered ? 'shown' : 'placeholder' };
}

/** `'shown' | 'placeholder' | 'hidden'` — see `exitDiscovery`. */
export function exitVisibility(exit, ctx) {
    return exitDiscovery(exit, ctx).visibility;
}

/* ══════════════════════════════════════════════════════════════════════
 * DISPLAY GROUPS — the `compositeMap.displayRegionOf` fold
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * The display key of each rules region, grouped: `Map<displayKey, rulesRegion[]>`, in first-seen order.
 *
 * Each region's substrate (`substrateOf(name)`, default `sidecarOf(name)?.substrate`) names a registry entry; when
 * that entry declares `compositeMap.displayRegionOf(regionName, sidecar)`, its answer is the key (step 1 registered
 * it for Seedling: `level_N__rRcC` → `level_N`, read off the payload's `atlas_region`). Otherwise a region is its
 * own key.
 *
 * ⚠ (step-1 residue) **The keys are DISPLAY groups, not rules regions.** A level split into sub-regions has no
 * `level_N` region in the rules, so a key is never looked up in `staticData.regions`, never dispatched as a move
 * target, and never compared against `snapshot.regionReachability`. A view acts on a group's MEMBERS.
 *
 * @param {Iterable<string>} regionNames
 * @param {object} opts - { registry (has `get(id)`), sidecarOf(name) → sidecar entry | null, substrateOf(name) }
 */
export function displayGroupsOf(regionNames, { registry = null, sidecarOf = () => null, substrateOf = null } = {}) {
    const groups = new Map();
    for (const name of regionNames) {
        const sidecar = sidecarOf(name) ?? null;
        const substrate = substrateOf ? substrateOf(name) : sidecar?.substrate;
        const hook = substrate != null ? registry?.get?.(substrate)?.compositeMap?.displayRegionOf : null;
        const key = typeof hook === 'function' ? (hook(name, sidecar) ?? name) : name;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(name);
    }
    return groups;
}

/** `Map<rulesRegion, displayKey>` — the inverse of `displayGroupsOf`. */
export function displayKeyIndex(groups) {
    const out = new Map();
    for (const [key, members] of groups) for (const m of members) out.set(m, key);
    return out;
}

/** The sidecar entries of `rulesJson.preset_sidecars[playerId]`, by region id. */
export function sidecarIndex(rulesJson, playerId = '1') {
    const out = new Map();
    const list = rulesJson?.preset_sidecars?.[String(playerId)];
    for (const sc of Array.isArray(list) ? list : []) {
        if (sc && typeof sc.region_id === 'string') out.set(sc.region_id, sc);
    }
    return out;
}

/** A display group's counts: the members' counts summed, the flags recomputed. */
export function aggregateCounts(countsList) {
    let checked = 0; let accessible = 0; let inaccessible = 0; let total = 0;
    for (const c of countsList) {
        checked += c.checked || 0;
        accessible += c.accessible || 0;
        inaccessible += c.inaccessible || 0;
        total += c.total || 0;
    }
    return {
        checked, accessible, inaccessible, total,
        hasAccessible: accessible > 0,
        hasInaccessible: inaccessible > 0,
        hasUnchecked: (accessible + inaccessible) > 0,
        allChecked: checked === total && total > 0,
        hasLocations: total > 0,
    };
}

/** A display group's visibility: `'shown'` if any member is, else `'placeholder'` if any member is, else `'hidden'`. */
export function aggregateVisibility(visibilities) {
    let placeholder = false;
    for (const v of visibilities) {
        if (v === 'shown') return 'shown';
        if (v === 'placeholder') placeholder = true;
    }
    return placeholder ? 'placeholder' : 'hidden';
}
