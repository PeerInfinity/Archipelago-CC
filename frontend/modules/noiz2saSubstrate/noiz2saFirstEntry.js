/**
 * Noiz2sa substrate — a region's FIRST ENTRY explores it fully (slice N4b), and the next action the loops queue holds
 * for a region (N4c: a move out of it, or its location check). Pure: `index.js` wires it.
 *
 * ⚖ 2026-10-05 (the coordinating session's brief change, the user's words): "The Noiz2sa regions should count as fully
 * explored when they are first entered, not when they are first cleared." (It replaced "a first clear should have the
 * effects that fully exploring the region would have in other substrates".)
 *
 * What a full explore is elsewhere: an explore action (`customAction('explore')`, the text adventure's command, the
 * maze's walk to the nearest unseen tile) ends in the dispatcher event `loop:exploreCompleted {regionName}`, and the
 * discovery module answers each one by discovering the region and ONE undiscovered location or exit of it, picked at
 * random (an exit also discovers its connected region under the `onExitDiscovered` trigger). A region is FULLY
 * explored when every location and every exit of it is discovered (loops' `_isRegionFullyExplored`, which drops the
 * queued explores of such a region). So a full explore is as many `loop:exploreCompleted` as the region has locations
 * and exits, and that is what a first entry sends — the same event, the same handler, the same discovery state.
 *
 * An ENTRY is a region load (`noiz2sa:loadRegion`, published by procgenPlayer when the player arrives); the first one
 * of each region since the last rules load explores it.
 */

/** how many explores explore a region fully: one per location and one per exit (the static data's region) */
export function exploresToFullyExplore(regionStatic) {
    const n = (a) => (Array.isArray(a) ? a.length : 0);
    return n(regionStatic?.locations) + n(regionStatic?.exits);
}

/** The watcher: `enter(region)` → true the first time since the last `reset()` (a rules load). */
export function createFirstEntryWatcher() {
    const entered = new Set();
    return {
        enter(region) {
            if (typeof region !== 'string' || !region || entered.has(region)) return false;
            entered.add(region);
            return true;
        },
        reset() { entered.clear(); },
        /** the regions entered since the last reset */
        entered: () => [...entered],
    };
}

/**
 * The NEXT action the loops queue holds for the visit the player is on in `region` (N4c): from the cursor, skipping
 * the move INTO the region (the cursor may still be on it) and every entry already completed, the first of
 *  - a `locationCheck` of the region whose location is not checked yet (`isChecked(locationName)`; loops skips a
 *    checked one too) → `{kind: 'check', locationName, index}`;
 *  - a `regionMove` out of the region → `{kind: 'move', exit, target, index}`.
 * A move from another region first, or nothing, is no next action (null): the page offers the choice list. `from` is
 * the cursor (0 for a queue that has not started). Other entry types are passed over.
 */
export function queuedNextFrom(queue, from, region, { isChecked = () => false } = {}) {
    const q = Array.isArray(queue) ? queue : [];
    for (let i = Math.max(0, from | 0); i < q.length; i++) {
        const a = q[i];
        if (!a || a.completed) continue;
        if (a.type === 'locationCheck') {
            if (a.sourceRegion !== region) return null;
            if (isChecked(a.locationName)) continue;
            return { kind: 'check', locationName: a.locationName ?? null, index: i };
        }
        if (a.type !== 'regionMove') continue;
        if (a.sourceRegion === region) return { kind: 'move', exit: a.exitUsed ?? null, target: a.destinationRegion ?? null, index: i };
        if (a.destinationRegion === region) continue;
        return null;
    }
    return null;
}
