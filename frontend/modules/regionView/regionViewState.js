/**
 * ⛓ REGION VIEW STATE — a small stateful wrapper over `regionViewModel.js`, for the Region Map panel (step 3b).
 *
 * It subscribes to the triggers the Region Graph reacts to and recomputes the whole view model at most ONCE per
 * animation frame, however many of them fire in it:
 *   stateManager:snapshotUpdated · stateManager:rulesLoaded · gameState:regionChanged · gameState:pathUpdated ·
 *   discovery:modeChanged · discovery:settingsChanged · discovery:changed · settings:changed
 * A discovery trigger (or a `settings:changed` under `moduleSettings.discovery`) re-reads the discovery settings
 * first.
 *
 *   const view = createRegionViewState({ stateManager, eventBus, discovery, gameState, registry, settings, … });
 *   view.get()          // the frozen view (below); computed on first call
 *   view.subscribe(fn)  // fn(view) after each recompute; returns an unsubscribe
 *   view.refresh()      // schedule a recompute (e.g. the panel's own "show undiscovered" control changed)
 *   view.dispose()      // unsubscribe EVERYTHING and cancel a pending frame
 *
 * ⚠ A panel that remounts must `dispose()` the old one: a remounted panel otherwise keeps its old listeners.
 *
 * The view (frozen, and so are its records):
 *   { regions: Map<name, { name, reachable, counts, interior, color, discovered, visibility, displayKey }>,
 *     locations: Map<name, { name, region, state, discovered, visibility }>,
 *     exits: [{ name, from, to, reverseName, accessible, traversable, discovered, visibility }],
 *     displayGroups: Map<displayKey, { key, members, counts, reachable, visibility }>,
 *     currentRegion, currentDisplayRegion, path, discoveryActive, version }
 * `exits` holds one record per DIRECTED exit, its visibility being its pair's (`exitDiscovery`).
 * `color` is `regionColorState` (what the Region Graph colours); `reachable` is raw.
 *
 * Handles:
 *   stateManager — { getStaticData(), getLatestStateSnapshot() }
 *   eventBus     — { subscribe(event, fn, owner) → unsubscribe }
 *   discovery    — { isRegionDiscovered, isLocationDiscovered, isExitDiscovered } (`discovery/singleton.js`)
 *   gameState    — { getCurrentRegion(), getPath() } (or null)
 *   registry     — the substrate registry ({ get(id) }), for `compositeMap.displayRegionOf`
 *   settings     — { getSetting(key, default) → Promise } (the settings manager), for the discovery settings
 *   getRules     — () → { rules, playerId } (the raw rules.json, for `preset_sidecars`); default none
 *   showUndiscovered — () → boolean (the panel's own control); default true
 *   showAccessibility — () → boolean (an external accessibility filter); default true
 *   schedule / cancel — the frame scheduler (default requestAnimationFrame, else a 16 ms timeout)
 *   owner        — the event-bus subscriber name (default 'regionView')
 */
import { getRegionMovesFromPath } from '../shared/pathUtils.js';
import {
    isRegionReachable, locationCounts, regionInteriorState, regionColorState, locationState,
    discoveryContext, regionDiscovery, locationDiscovery, exitDiscovery, evaluateAccessRule, enteredFromDiscoveredIndex,
    displayGroupsOf, displayKeyIndex, sidecarIndex, aggregateCounts, aggregateVisibility,
} from './regionViewModel.js';
import { createSnapshotInterface } from '../shared/snapshotInterface.js';

export const REGION_VIEW_TRIGGERS = Object.freeze([
    'stateManager:snapshotUpdated',
    'stateManager:rulesLoaded',
    'gameState:regionChanged',
    'gameState:pathUpdated',
    'discovery:modeChanged',
    'discovery:settingsChanged',
    'discovery:changed',
    'settings:changed',
]);

const DISCOVERY_SETTING_DEFAULTS = Object.freeze({
    undiscoveredDisplay: 'hidden',
    clickDiscoversLocation: true,
    clickDiscoversRegion: false,
    disableLocationCheckUI: false,
    showUndiscoveredDetails: false,
    showUndiscoveredRegionNames: false,
    colorUndiscoveredByReachability: false,
});

/** Read the discovery settings the Region Graph reads (`moduleSettings.discovery.*`). */
export async function readDiscoverySettings(settings) {
    const out = {};
    for (const [k, dflt] of Object.entries(DISCOVERY_SETTING_DEFAULTS)) {
        out[k] = settings ? await settings.getSetting(`moduleSettings.discovery.${k}`, dflt) : dflt;
    }
    const active = settings ? await settings.getSetting('moduleSettings.discovery.enableDiscoveryMode', false) : false;
    return { active: !!active, settings: out };
}

const refuse = () => { throw new TypeError('the region view is read-only'); };
// Object.freeze does not stop Map#set, so a view's Maps get throwing mutators first.
const deepFreeze = (o) => {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
        if (o instanceof Map) { o.set = refuse; o.delete = refuse; o.clear = refuse; }
        Object.freeze(o);
        for (const v of (o instanceof Map ? o.values() : Object.values(o))) deepFreeze(v);
    }
    return o;
};

/** Compute a view from its inputs — pure; `createRegionViewState` calls it once per frame. */
export function computeRegionView({ snapshot, staticData, discovery, discoveryState = { active: false, settings: {} },
    registry = null, rules = null, playerId = '1', currentRegion = null, path = [], showUndiscovered = true,
    showAccessibility = true, version = 0 }) {
    const regions = new Map();
    const locations = new Map();
    const exits = [];
    const rd = staticData?.regions;
    const empty = { regions, locations, exits, displayGroups: new Map(), currentRegion, currentDisplayRegion: currentRegion,
        path, discoveryActive: !!discoveryState.active, version };
    if (!snapshot || !rd) return deepFreeze(empty);
    // ⛓ region-map step 3b: the inverse-entrance index, built once per recompute when discovery is on (the
    // per-region scan made a seedling_playthrough recompute 7.3 ms; see CC/docs/region-map/step3b-panel.md).
    const ctx = discoveryContext({ active: discoveryState.active, settings: discoveryState.settings, discovery,
        regions: rd, showUndiscovered, showAccessibility,
        enteredFromDiscovered: discoveryState.active ? enteredFromDiscoveredIndex(rd, discovery) : null });
    const sidecars = sidecarIndex(rules, playerId);
    const groups = displayGroupsOf(rd.keys(), { registry, sidecarOf: (n) => sidecars.get(n) ?? null });
    const keyOf = displayKeyIndex(groups);
    const si = createSnapshotInterface(snapshot, staticData);
    for (const [name, data] of rd) {
        const reachable = isRegionReachable(snapshot, name);
        const counts = locationCounts(snapshot, staticData, name, data);
        const d = regionDiscovery(name, ctx);
        regions.set(name, {
            name, reachable, counts, interior: regionInteriorState(counts, reachable),
            color: regionColorState(snapshot, name, ctx), discovered: d.discovered, visibility: d.visibility,
            displayKey: keyOf.get(name) ?? name,
        });
        for (const loc of data.locations ?? []) {
            const ld = locationDiscovery(loc.name, name, ctx);
            locations.set(loc.name, {
                name: loc.name, region: name,
                state: locationState(snapshot, staticData, loc, { regionName: name, snapshotInterface: si }),
                discovered: ld.discovered, visibility: ld.visibility,
            });
        }
    }
    for (const [from, data] of rd) {
        for (const exit of data.exits ?? []) {
            const to = exit.connected_region;
            if (!to || !rd.has(to)) continue;
            const reverse = (rd.get(to).exits ?? []).find((e) => e.connected_region === from) ?? null;
            const accessible = evaluateAccessRule(exit.access_rule, { snapshotInterface: si });
            const ed = exitDiscovery({ source: from, target: to, forwardExitName: exit.name,
                reverseExitName: reverse?.name ?? '' }, ctx);
            exits.push({ name: exit.name, from, to, reverseName: reverse?.name ?? null, accessible,
                traversable: isRegionReachable(snapshot, from) && !!accessible, discovered: ed.discovered,
                visibility: ed.visibility });
        }
    }
    const displayGroups = new Map();
    for (const [key, members] of groups) {
        const recs = members.map((m) => regions.get(m));
        displayGroups.set(key, {
            key, members,
            counts: aggregateCounts(recs.map((r) => r.counts)),
            reachable: recs.some((r) => r.reachable),
            visibility: aggregateVisibility(recs.map((r) => r.visibility)),
        });
    }
    return deepFreeze({ ...empty, regions, locations, exits, displayGroups,
        currentDisplayRegion: currentRegion != null ? (keyOf.get(currentRegion) ?? currentRegion) : null });
}

const defaultSchedule = (fn) => (typeof requestAnimationFrame === 'function'
    ? { raf: requestAnimationFrame(fn) } : { timeout: setTimeout(fn, 16) });
const defaultCancel = (h) => {
    if (h?.raf != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(h.raf);
    if (h?.timeout != null) clearTimeout(h.timeout);
};

export function createRegionViewState({
    stateManager, eventBus, discovery, gameState = null, registry = null, settings = null,
    getRules = () => null, showUndiscovered = () => true, showAccessibility = () => true,
    schedule = defaultSchedule, cancel = defaultCancel, owner = 'regionView',
} = {}) {
    let view = null;
    let version = 0;
    let pending = null;
    let disposed = false;
    let discoveryState = { active: false, settings: { ...DISCOVERY_SETTING_DEFAULTS } };
    let discoveryLoad = null;
    const listeners = new Set();
    const unsubs = [];

    const compute = () => {
        const { rules = null, playerId = '1' } = getRules() ?? {};
        let path = [];
        let currentRegion = null;
        try {
            currentRegion = gameState?.getCurrentRegion?.() ?? null;
            path = getRegionMovesFromPath(gameState?.getPath?.() ?? []);
        } catch { /* no game state yet */ }
        view = computeRegionView({
            snapshot: stateManager.getLatestStateSnapshot(), staticData: stateManager.getStaticData(),
            discovery, discoveryState, registry, rules, playerId, currentRegion, path,
            showUndiscovered: showUndiscovered(), showAccessibility: showAccessibility(), version: ++version,
        });
        return view;
    };

    const flush = () => {
        pending = null;
        if (disposed) return;
        compute();
        for (const fn of [...listeners]) fn(view);
    };

    const refresh = () => {
        if (disposed || pending) return;
        pending = schedule(flush);
    };

    const reloadDiscovery = () => {
        discoveryLoad = readDiscoverySettings(settings).then((d) => { discoveryState = d; }).catch(() => {});
        return discoveryLoad.then(refresh);
    };

    for (const event of REGION_VIEW_TRIGGERS) {
        const handler = (data) => {
            const discoveryKey = event.startsWith('discovery:')
                || (event === 'settings:changed' && (data?.key === '*' || String(data?.key ?? '').startsWith('moduleSettings.discovery')));
            if (discoveryKey) reloadDiscovery();
            else refresh();
        };
        const u = eventBus.subscribe(event, handler, owner);
        unsubs.push(typeof u === 'function' ? u : () => eventBus.unsubscribe?.(event, handler, owner));
    }
    reloadDiscovery();

    return {
        get: () => view ?? compute(),
        subscribe(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        refresh,
        /** Resolves once the discovery settings read at creation (or the latest re-read) has landed. */
        ready: () => discoveryLoad,
        dispose() {
            disposed = true;
            if (pending) cancel(pending);
            pending = null;
            for (const u of unsubs.splice(0)) u();
            listeners.clear();
        },
    };
}
