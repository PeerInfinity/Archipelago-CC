/**
 * Noiz2sa substrate — a region's FIRST CLEAR explores it fully (slice N4b). Pure: `index.js` wires it.
 *
 * ⚖ 2026-10-05: "a first clear should have the effects that fully exploring the region would have in other
 * substrates", and "In this substrate, there is no explore or check location action."
 *
 * What a full explore is elsewhere: an explore action (`customAction('explore')`, the text adventure's command, the
 * maze's walk to the nearest unseen tile) ends in the dispatcher event `loop:exploreCompleted {regionName}`, and the
 * discovery module answers each one by discovering the region and ONE undiscovered location or exit of it, picked at
 * random (an exit also discovers its connected region under the `onExitDiscovered` trigger). A region is FULLY
 * explored when every location and every exit of it is discovered (loops' `_isRegionFullyExplored`, which drops the
 * queued explores of such a region). So a full explore is as many `loop:exploreCompleted` as the region has locations
 * and exits, and that is what a first clear sends — the same event, the same handler, the same discovery state.
 *
 * The trigger is the host's checked set (`stateManager:snapshotUpdated`): the snapshot in which a Noiz2sa region's
 * clear turns from unchecked to checked, whoever checked it (live play, the Bot, a Playback refire, the locations
 * panel). A TRANSITION, not "checked and not seen before": a rules load can be followed by a stale snapshot of the
 * state before it, which must not count as the new state's first clear. The baseline (each clear's state before any
 * play) is noted at every rules load and region load, since the clear's own snapshot may be the first one after them.
 */

/**
 * The Noiz2sa regions of procgenPlayer's warehouse (a `WorldWarehouse`, whose `regions` is a Map region →
 * {substrate, world}; a bare Map also reads) and their clear's AP name.
 */
export function clearsOf(warehouse, substrateId) {
    const out = new Map();
    const map = warehouse?.regions instanceof Map ? warehouse.regions : warehouse;
    if (!map || typeof map.entries !== 'function') return out;
    for (const [region, entry] of map.entries()) {
        if (entry?.substrate !== substrateId) continue;
        const clear = entry?.world?.ap_locations?.clear;
        if (typeof clear === 'string' && clear) out.set(region, clear);
    }
    return out;
}

/** a snapshot's checked location names (a Set, an array or a {name: true} object) → a Set */
export function checkedNamesOf(snapshot) {
    const c = snapshot?.checkedLocations;
    if (c instanceof Set) return c;
    if (Array.isArray(c)) return new Set(c);
    if (c && typeof c === 'object') return new Set(Object.keys(c).filter((k) => c[k]));
    return new Set();
}

/** how many explores explore a region fully: one per location and one per exit (the static data's region) */
export function exploresToFullyExplore(regionStatic) {
    const n = (a) => (Array.isArray(a) ? a.length : 0);
    return n(regionStatic?.locations) + n(regionStatic?.exits);
}

/**
 * The watcher: `note(clears, checked)` → the regions whose clear went from unchecked (in the last snapshot noted) to
 * checked. A region first seen already checked is not a first clear. `reset()` forgets every region (a rules load).
 */
export function createFirstClearWatcher() {
    const last = new Map(); // region → its clear was checked in the last snapshot noted
    const explored = new Set();
    return {
        note(clears, checked) {
            const fresh = [];
            for (const [region, clear] of clears) {
                const now = checked.has(clear);
                if (now && last.get(region) === false) {
                    fresh.push(region);
                    explored.add(region);
                }
                last.set(region, now);
            }
            return fresh;
        },
        reset() { last.clear(); explored.clear(); },
        /** the regions reported since the last reset */
        explored: () => [...explored],
    };
}
