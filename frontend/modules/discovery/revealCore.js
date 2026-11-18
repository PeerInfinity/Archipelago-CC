/**
 * discovery/revealCore — **REVEALING WITHOUT EXPLORING** (ActionNodes AN-1b; ⚖ Robert 2026-11-16T19:59:48Z).
 *
 * The ruling, as the planner numbered it: D1 the start node starts fully discovered; D2 the nodes connected to it
 * start showing all their contents; D3 a visible node not yet completed on any loop shows how many exits it has and
 * their direction, not the exit's name or its target's name; D4 discovery stays on loop reset; D6 no random explore
 * effect. Extended (the design addendum's reading of D2): a node completed on some loop behaves like the start — its
 * exits are named and the nodes they lead to are visible with their contents.
 *
 * Pure functions over a `DiscoveryState`-shaped object (`discoverRegion`, `discoverExit`, `discoverLocation`) and the
 * static regions (a Map: name → `{exits: [{name, connected_region}], locations: [{name}]}`). No random pick, no
 * settings read: `index.js` wires them to the module's singletons and decides WHEN.
 *
 *   - `revealExits(state, regions, regionName, exitNames)`: each named exit, the region it leads to, that region's
 *     locations, and that region's exits straight back to `regionName` (an exit PAIR's other half — both of its ends
 *     are known, so it hides nothing; this is how an ActionNodes reverse exit is revealed "together with its node" and
 *     never shows as a `???`, never adding to the visible exit count).
 *   - `revealStartNeighbourhood(state, regions, startRegions)`: D1 + D2. The regions the start regions lead to (an
 *     ActionNodes world: `Menu → start`, so the start node) have ALL their exits revealed as above.
 *   - `cascadeTargetsOf(regions, startRegions)`: the regions the `onExitDiscovered` cascade discovers from the start
 *     regions — where the location step must re-run when `autoDiscoverLocations` turns on after the trigger did (the
 *     override applier's order, `worldDiscoveryMode.js` OVERRIDE_KEYS).
 */

const exitsOf = (regions, name) => regions?.get?.(name)?.exits ?? [];
const locationsOf = (regions, name) => regions?.get?.(name)?.locations ?? [];

/**
 * Reveal `exitNames` of `regionName` with their targets, the targets' locations, and each target's exits back.
 * Unknown exit names are skipped. Returns what it newly discovered.
 * @returns {{exits: string[], regions: string[], locations: string[]}}
 */
export function revealExits(state, regions, regionName, exitNames = []) {
    const out = { exits: [], regions: [], locations: [] };
    if (!state || !regionName) return out;
    const wanted = new Set(exitNames);
    for (const exit of exitsOf(regions, regionName)) {
        if (!wanted.has(exit.name)) continue;
        if (state.discoverExit(regionName, exit.name)) out.exits.push(`${regionName}:${exit.name}`);
        const target = exit.connected_region;
        if (!target || !regions.has(target)) continue;
        if (state.discoverRegion(target)) out.regions.push(target);
        for (const loc of locationsOf(regions, target)) {
            if (loc?.name && state.discoverLocation(loc.name)) out.locations.push(loc.name);
        }
        for (const back of exitsOf(regions, target)) {
            if (back.connected_region === regionName && state.discoverExit(target, back.name)) {
                out.exits.push(`${target}:${back.name}`);
            }
        }
    }
    return out;
}

/** The regions the start regions' exits lead to, in exit order, without repeats. */
export function cascadeTargetsOf(regions, startRegions = []) {
    const out = [];
    for (const s of startRegions) {
        for (const e of exitsOf(regions, s)) {
            if (e.connected_region && regions.has(e.connected_region) && !out.includes(e.connected_region)) out.push(e.connected_region);
        }
    }
    return out;
}

/** D1 + D2: every region a start region leads to is revealed in full (all its exits, as `revealExits`). */
export function revealStartNeighbourhood(state, regions, startRegions = []) {
    const out = { exits: [], regions: [], locations: [] };
    for (const t of cascadeTargetsOf(regions, startRegions)) {
        if (state.discoverRegion(t)) out.regions.push(t);
        for (const loc of locationsOf(regions, t)) if (loc?.name && state.discoverLocation(loc.name)) out.locations.push(loc.name);
        const r = revealExits(state, regions, t, exitsOf(regions, t).map((e) => e.name));
        out.exits.push(...r.exits);
        out.regions.push(...r.regions);
        out.locations.push(...r.locations);
    }
    return out;
}
