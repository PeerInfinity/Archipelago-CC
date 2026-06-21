// Shared substrate-hook-driven config assembly for sphere-growth.
//
// The Procgen Pipeline panel and the two headless CLIs (sphere-step.js,
// dump-sphere-growth.js) all build a sphere-growth config the same way: merge
// each registered/active substrate's `defaultProcgenParams`,
// `prepareSphereGrowth` and `buildRegionParams` registry hooks. Centralising
// it here keeps the drivers substrate-agnostic AND keeps the CLIs from
// diverging from the panel — they previously hard-coded a bounce arrow-entry
// block and a MINIMAL regionParams ({fallBehavior, physicsProfile}) that
// omitted the braid layout keys the panel produces (bounceMode, braidWidth,
// bounceJitter, platformRows, decoration). The panel delegates its
// _defaultParams / _activeSubstrateIds / _collectSphereGrowthPrep /
// _assembleRegionParams to these functions, so there is ONE assembly path.

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

/**
 * Merge `base` with every registered substrate's declared
 * `defaultProcgenParams` (e.g. bounce's fall behavior / physics profile /
 * braid layout). Substrates own their param defaults via the registry so the
 * drivers stay substrate-agnostic.
 */
export function defaultProcgenParams(base = {}) {
    const merged = { ...base };
    for (const entry of substrateRegistry.getAll()) {
        if (entry?.defaultProcgenParams) Object.assign(merged, entry.defaultProcgenParams);
    }
    return merged;
}

/**
 * Substrate ids participating in a sphere-growth run: every substrate with a
 * positive quota, plus an explicit start substrate. Drives the per-substrate
 * pre-plan + regionParams hooks.
 */
export function activeSubstrateIds(quotas, startSub) {
    const ids = new Set();
    for (const [id, n] of Object.entries(quotas ?? {})) {
        if (Number(n) > 0) ids.add(id);
    }
    if (startSub) ids.add(startSub);
    return [...ids];
}

/**
 * Gather each active substrate's pre-plan contributions via its optional
 * `prepareSphereGrowth` hook: starting items, sphere-1 reservations
 * (exclusiveSpheres), canonical-placement locks, item pool removals
 * (itemPoolDelta, applied IN PLACE to `itemPool`), regionParams additions, and
 * a note. Substrates without the hook contribute nothing.
 */
export function collectSphereGrowthPrep({
    activeIds, itemPool, quotas, startSubstrate, seed, params,
}) {
    const startingItems = [];
    const lockedCanonicalItems = [];
    const exclusiveSpheres = {};
    const regionParams = {};
    const notes = [];
    for (const id of activeIds) {
        const hook = substrateRegistry.get(id)?.prepareSphereGrowth;
        if (typeof hook !== 'function') continue;
        const c = hook({
            itemPool, quotas, startSubstrate, seed, params, substrateId: id,
        }) || {};
        if (c.startingItems) startingItems.push(...c.startingItems);
        if (c.lockedCanonicalItems) lockedCanonicalItems.push(...c.lockedCanonicalItems);
        for (const [k, v] of Object.entries(c.exclusiveSpheres ?? {})) {
            exclusiveSpheres[k] = [...(exclusiveSpheres[k] ?? []), ...v];
        }
        for (const [k, d] of Object.entries(c.itemPoolDelta ?? {})) {
            itemPool[k] = (itemPool[k] ?? 0) + d;
            if (itemPool[k] <= 0) delete itemPool[k];
        }
        Object.assign(regionParams, c.regionParams ?? {});
        if (c.note) notes.push(c.note);
    }
    return {
        startingItems, lockedCanonicalItems, exclusiveSpheres,
        regionParams, note: notes.join(' — '),
    };
}

/**
 * Merge each active substrate's `buildRegionParams` hook output into one
 * regionParams object. `mode` is 'sphere' | 'topDown'. `extra` (e.g. the
 * pre-plan hook's regionParams contribution) wins last.
 */
export function assembleRegionParams({ activeIds, mode = 'sphere', params, extra = {} }) {
    const out = {};
    for (const id of activeIds) {
        const fn = substrateRegistry.get(id)?.buildRegionParams;
        if (typeof fn === 'function') Object.assign(out, fn({ params, mode }));
    }
    Object.assign(out, extra);
    return out;
}

/**
 * Item library merge: `baseLib` plus each selected substrate's `libraryItems`.
 * Mirrors the panel's _mergedItemLib(). `selectedIds` is the quota + start set.
 */
export function mergeSubstrateItemLib(baseLib, selectedIds) {
    const lib = { ...baseLib };
    for (const id of selectedIds) {
        const extra = substrateRegistry.get(id)?.libraryItems;
        if (extra) Object.assign(lib, extra);
    }
    return lib;
}

/**
 * Victory resolution, mirroring the panel's _resolveVictoryItemId(): an
 * explicit id, else an is_victory item in `itemPool` (looked up in `itemLib`),
 * else a selected substrate's registry `victoryItem`. Returns null if none.
 */
export function resolveVictoryItem({ explicit, itemPool, itemLib, selectedIds }) {
    if (explicit) return explicit;
    const fromPool = Object.keys(itemPool ?? {}).find((id) => itemLib[id]?.is_victory);
    if (fromPool) return fromPool;
    for (const id of selectedIds) {
        const vi = substrateRegistry.get(id)?.victoryItem;
        if (vi) return vi;
    }
    return null;
}
