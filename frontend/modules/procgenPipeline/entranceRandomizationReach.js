/**
 * procgenPipeline/entranceRandomizationReach — **THE PRODUCTION `reach` BINDING OF THE ER SHUFFLE CORE**
 * (ENTRANCE RANDOMIZATION E4a). `procgenCore/entranceRandomizer.js` (E3, the GER port) takes its reachability
 * as a callback, `reach(connections) → {regions, exits}`; this builds that callback over a COMPILED rules.json
 * document with the evaluator `generateSphereLog` walks (`shared/procgen/forwardSimulator.js`), so the shuffle
 * and the sphere log read every rule the same way. It lives here, not beside the core in procgenCore, because
 * procgenCore imports nothing (its README's law) and this imports the evaluator.
 *
 * ── THE MODEL ──────────────────────────────────────────────────────────
 * `shuffled` names the exits the shuffle moves, each `{name, region, access_rule, carrier}`:
 *   - `carrier: <AP exit name>` — that AP exit of `region` IS the shufflable exit (it carries nothing else): it is
 *     REMOVED from the model, and comes back only as a placement;
 *   - `carrier: null` — the shufflable exit shares its AP exit with other connections (several atlas links merged
 *     into one AP exit, e.g. Seedling's L40 stairs with twelve screen-edge teleporters to L43): the shared AP exit
 *     STAYS (the other links still go where they went) and the shufflable leg exists only as its placement.
 * Every call clones the model with each shufflable exit as an exit of its region under its own `access_rule`: a
 * placed one (`connections` holds `{exit, from, to}`) leads to `to`, an unplaced one leads nowhere — so `exits`
 * names it once its parent is reached and its rule holds (GER: an unconnected exit is placeable exactly then). Nothing is cached across calls: E3 calls `reach`
 * speculatively with a connection it does not keep, so it must be a pure function of its argument.
 *
 * ── THE INVENTORY (stated: GER's) ──────────────────────────────────────
 * GER evaluates on `multiworld.get_all_state(False, True)` (entrance_rando.py L193-200): every item of the pool
 * held, events collected only where the sweep reaches them. `allStateInventory` is that for ONE player of the
 * document: `itempool_counts[p]` plus `starting_items[p]`, LESS every event item (the item of a location whose
 * `id` is null) — events are then swept: the fixed point alternates the region sweep and collecting each
 * reachable event location's item until neither grows. Pass `inventory` to evaluate from another state.
 *
 * ── UNDECIDED ──────────────────────────────────────────────────────────
 * A rule the evaluator cannot decide (`undefined`: a game helper, CanReachLocation, a setting) is NOT open — the
 * forward simulator's reading (`computeTraversableExits` says why that is the conservative side for a shuffle).
 * Pass `undecided` (a Map) to collect the endpoints read that way; unlike `generateSphereLog`, this does not
 * refuse: a shuffle over a document that holds such rules is the mode's decision (E4b), not the binding's.
 *
 * ⛔ PURE: no I/O. The rules document is never mutated.
 */

import {
    buildAccessibilityModel, computeReachableRegions, computeAccessibleLocations, computeTraversableExits,
} from '../shared/procgen/forwardSimulator.js';

const DEFAULT_PLAYER_ID = '1';

/** The event items of one player: the item of every location whose `id` is null. */
export function eventItemsOf(rulesDoc, playerId = DEFAULT_PLAYER_ID) {
    const events = new Map(); // location name -> item name
    for (const region of Object.values(rulesDoc.regions?.[String(playerId)] ?? {})) {
        for (const loc of region.locations ?? []) {
            if ((loc.id === null || loc.id === undefined) && loc.item?.name) events.set(loc.name, loc.item.name);
        }
    }
    return events;
}

/** GER's single-player all-state, before the event sweep: `Map<item, count>` (see the file docblock). */
export function allStateInventory(rulesDoc, playerId = DEFAULT_PLAYER_ID) {
    const p = String(playerId);
    const eventNames = new Set(eventItemsOf(rulesDoc, p).values());
    const inventory = new Map();
    for (const [name, n] of Object.entries(rulesDoc.itempool_counts?.[p] ?? {})) {
        if (!eventNames.has(name)) inventory.set(name, (inventory.get(name) ?? 0) + n);
    }
    for (const name of rulesDoc.starting_items?.[p] ?? []) inventory.set(name, (inventory.get(name) ?? 0) + 1);
    return inventory;
}

/**
 * The `reach(connections)` callback E3's `randomizeEntrances` takes, over `rulesDoc`.
 *
 * @param {object} rulesDoc a compiled rules.json document
 * @param {object} o
 * @param {Array<{name:string, region:string, access_rule:object, carrier:string|null}>} o.shuffled the shufflable exits
 * @param {string} [o.playerId='1']
 * @param {Map<string, number>} [o.inventory] the state to start from (default `allStateInventory`)
 * @param {Map} [o.undecided] collects the endpoints whose rule the evaluator could not decide
 * @returns {(connections: Array<{exit:string, from:string, to:string}>) => {regions:Set<string>, exits:Set<string>, locations:Set<string>, items:Map<string, number>}}
 *   (`locations` and `items` are extra: the core reads `regions` and `exits` only)
 */
export function makeRulesDocReach(rulesDoc, { shuffled, playerId = DEFAULT_PLAYER_ID, inventory = null, undecided = null } = {}) {
    const base = buildAccessibilityModel(rulesDoc, String(playerId));
    const byName = new Map();
    for (const s of shuffled ?? []) {
        if (byName.has(s.name)) throw new Error(`makeRulesDocReach: two shufflable exits are named ${s.name}`);
        const region = base.regions.get(s.region);
        if (!region) throw new Error(`makeRulesDocReach: ${s.name}'s region ${s.region} is not in the document`);
        if (s.carrier !== null && !region.exits.some((e) => e.name === s.carrier)) {
            throw new Error(`makeRulesDocReach: ${s.name}'s carrier ${s.carrier} is no exit of ${s.region}`);
        }
        byName.set(s.name, s);
    }
    // The disconnected model: every whole-AP-exit carrier removed.
    const removed = new Map();
    for (const s of byName.values()) {
        if (s.carrier === null) continue;
        if (!removed.has(s.region)) removed.set(s.region, new Set());
        removed.get(s.region).add(s.carrier);
    }
    const disconnected = new Map(base.regions);
    for (const [regionName, names] of removed) {
        const r = base.regions.get(regionName);
        disconnected.set(regionName, { ...r, exits: r.exits.filter((e) => !names.has(e.name)) });
    }
    const start = inventory ?? allStateInventory(rulesDoc, playerId);
    const events = eventItemsOf(rulesDoc, playerId);

    return function reach(connections = []) {
        const placedTo = new Map();
        for (const c of connections) {
            const s = byName.get(c.exit);
            if (!s) throw new Error(`reach: ${c.exit} is not a shufflable exit`);
            if (c.from !== s.region) throw new Error(`reach: ${c.exit} leaves ${s.region}, not ${c.from}`);
            placedTo.set(c.exit, c.to);
        }
        // Every shufflable exit is in the model: a placed one leads to its placement, an unplaced one to `null`, which
        // the region sweep never follows (`computeReachableRegions` skips a region the model lacks) but the
        // traversability pass still decides — GER's `blocked_connections`: an UNCONNECTED exit is traversable once
        // its parent is reached and its rule holds, and that is what makes it placeable.
        const regions = new Map(disconnected);
        for (const s of byName.values()) {
            const r = regions.get(s.region);
            regions.set(s.region, { ...r, exits: [...r.exits, { name: s.name, connected_region: placedTo.get(s.name) ?? null, access_rule: s.access_rule }] });
        }
        const model = { ...base, regions };
        const items = new Map(start);
        const collected = new Set();
        let reached;
        let locations;
        for (;;) {
            reached = computeReachableRegions(model, items, undecided);
            locations = computeAccessibleLocations(model, items, reached, undecided);
            let grew = false;
            for (const loc of locations) {
                if (collected.has(loc) || !events.has(loc)) continue;
                collected.add(loc);
                const item = events.get(loc);
                items.set(item, (items.get(item) ?? 0) + 1);
                grew = true;
            }
            if (!grew) break;
        }
        return { regions: reached, exits: computeTraversableExits(model, items, reached, undecided), locations, items };
    };
}
