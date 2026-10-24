/**
 * checksLine.js — the "Checked: 0/24, Reachable: 10, Unreachable: 14, Events: 0/1" line.
 *
 * A widget, not a panel: `mountChecksLine(element)` fills any element with the line and keeps it
 * current from `stateManager:snapshotUpdated` / `stateManager:rulesLoaded` until its `dispose()`.
 * The Console shows it; anything else that wants the line mounts its own copy. The host passes its
 * event bus and the stateManager proxy, so the widget imports nothing heavy (unit tests load it bare).
 *
 * The counting is a pure function of a snapshot and the static data, so it is unit-tested apart
 * from the DOM. A location with no `id` is an EVENT location: counted under Events only.
 */
export const CHECKS_LINE_CLASS = 'checks-line';
const UNKNOWN_TEXT = 'Checked: ?/?, Reachable: ?, Unreachable: ?, Events: ?/?';

/**
 * Count `staticData.locations` (a Map of name → location) against a snapshot.
 * Returns null while either is missing.
 */
export function computeLocationProgress(snapshot, staticData) {
    if (!snapshot || !staticData?.locations) return null;
    const checkedLocations = new Set(snapshot.checkedLocations || []);
    const counts = { checked: 0, total: 0, reachable: 0, unreachable: 0, eventsChecked: 0, eventsTotal: 0 };
    for (const [name, loc] of staticData.locations.entries()) {
        const checked = checkedLocations.has(name);
        if (loc.id === null || loc.id === undefined) {
            counts.eventsTotal++;
            if (checked) counts.eventsChecked++;
            continue;
        }
        counts.total++;
        if (checked) counts.checked++;
        else if (snapshot.locationReachability?.[name] === 'reachable') counts.reachable++;
        else counts.unreachable++;
    }
    return counts;
}

/** The line's text; the "?" form for null counts. */
export function formatLocationProgress(counts) {
    if (!counts) return UNKNOWN_TEXT;
    return `Checked: ${counts.checked}/${counts.total}, Reachable: ${counts.reachable}, `
        + `Unreachable: ${counts.unreachable}, Events: ${counts.eventsChecked}/${counts.eventsTotal}`;
}

/** The line's tooltip. */
export function describeLocationProgress(counts) {
    if (!counts) return 'Location or snapshot data not yet available.';
    return `Checked ${counts.checked} of ${counts.total} locations (${counts.reachable} reachable, `
        + `${counts.unreachable} unreachable)\nEvents: ${counts.eventsChecked} of ${counts.eventsTotal} event locations collected`;
}

/**
 * Fill `element` with the checks line and keep it current. Returns `{ element, update, dispose }`.
 * `bus` is the app's event bus, `stateManager` the stateManager proxy; `moduleName` is the subscriber
 * the bus files the line under (the host's module, so disabling the host mutes it).
 */
export function mountChecksLine(element, { bus, stateManager, moduleName = 'commonUI' }) {
    element.classList.add(CHECKS_LINE_CLASS);
    const update = (snapshot = null) => {
        const counts = computeLocationProgress(
            snapshot || stateManager.getLatestStateSnapshot?.(), stateManager.getStaticData?.());
        element.textContent = formatLocationProgress(counts);
        element.title = describeLocationProgress(counts);
    };
    const onSnapshot = (data) => update(data?.snapshot);
    const offs = ['stateManager:snapshotUpdated', 'stateManager:rulesLoaded']
        .map((event) => bus.subscribe(event, onSnapshot, moduleName));
    update();
    return {
        element,
        update,
        dispose() {
            for (const off of offs.splice(0)) if (typeof off === 'function') off();
        },
    };
}
