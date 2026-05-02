/**
 * Forward simulator + target selector — substrate-neutral playthrough
 * walker over rules.json.
 *
 * Two entry points:
 *
 *   generateSphereLog(rulesDoc, opts) — runs the full walk from start
 *     to end, returning a sphere log as an array of JSONL-compatible
 *     entries. Used by the procgen pipeline (Phase 4) to embed a
 *     sphere log into rules.json.
 *
 *   pickNextTarget(model, state) — given current inventory + checked
 *     locations, returns one { region, location, item, accessRule }
 *     triple representing the next sensible thing to seek. Used by
 *     the playthrough visualizer (Phase 3) and the playback bot
 *     (Phase 5) when no sphere log is loaded.
 *
 * Both share the same accessibility primitives. There is exactly one
 * target-selection implementation; the visualizer / bot / sphere log
 * generator never re-implement it.
 *
 * Faithfulness target (per debugging-tools.md, Phase 1.4):
 *   - Integer-sphere contents MUST match Python's MultiWorld.get_spheres
 *     output exactly. "Integer sphere N's contents" = the set of
 *     locations whose pickups appear in fractional entries N.1, N.2, …
 *   - Fractional sphere ordering MAY differ — within an integer
 *     sphere we walk picks alphabetically rather than mirroring
 *     Python's emission order.
 *
 * Format conventions (matched against
 * exporter/sphere_logger.py output):
 *   - Leading metadata entry, then a `0` integer-header entry with
 *     the initial accessible-locations / accessible-regions sets.
 *   - One fractional entry per advancement-item pickup,
 *     `sphere_index = "N.M"`. Sphere boundaries are determined by
 *     get_spheres semantics: snapshot reachability at the start of
 *     a sphere, pick everything reachable then; locations that
 *     become reachable mid-sphere belong to the next sphere.
 *   - Filler items (location.item.advancement === false) are never
 *     emitted as sphere_locations — they're noted in
 *     `new_accessible_locations` deltas but otherwise ignored.
 *
 * Plan reference:
 * NewDocs/plans/procedural-generation/debugging-tools.md (Phase 1.4)
 */

import { evaluateRuleAgainstInventory } from './library.js';

const DEFAULT_PLAYER_ID = '1';

/**
 * Normalize a rules.json document into the shape the simulator
 * consumes. Decoupled from rules.json key churn — if the rules.json
 * shape changes, this function localizes the impact.
 *
 * Returns {
 *   playerId,
 *   regions: Map<regionName, {
 *     name,
 *     exits: [{ name, connected_region, access_rule }],
 *     locations: [{ name, item, access_rule }],
 *   }>,
 *   startRegions: [regionName, ...],
 *   locationIndex: Map<locationName, locationObject>,
 * }
 */
export function buildAccessibilityModel(rulesDoc, playerId = DEFAULT_PLAYER_ID) {
    if (!rulesDoc || typeof rulesDoc !== 'object') {
        throw new Error('buildAccessibilityModel: rulesDoc must be an object');
    }
    const regionsForPlayer = rulesDoc.regions?.[playerId];
    if (!regionsForPlayer || typeof regionsForPlayer !== 'object') {
        throw new Error(`buildAccessibilityModel: rulesDoc.regions[${playerId}] missing or not an object`);
    }
    const regions = new Map();
    const locationIndex = new Map();
    for (const [regionName, region] of Object.entries(regionsForPlayer)) {
        const normalized = {
            name: regionName,
            exits: Array.isArray(region.exits) ? region.exits.map(normalizeExit) : [],
            locations: Array.isArray(region.locations)
                ? region.locations.map(normalizeLocation)
                : [],
        };
        regions.set(regionName, normalized);
        for (const location of normalized.locations) {
            locationIndex.set(location.name, location);
        }
    }
    const startRegions = collectStartRegions(rulesDoc, playerId);
    return { playerId, regions, startRegions, locationIndex };
}

function normalizeExit(exit) {
    return {
        name: exit.name,
        connected_region: exit.connected_region,
        access_rule: exit.access_rule ?? { rule: 'True_' },
    };
}

function normalizeLocation(location) {
    return {
        name: location.name,
        item: location.item ?? null,
        access_rule: location.access_rule ?? { rule: 'True_' },
    };
}

function collectStartRegions(rulesDoc, playerId) {
    const startInfo = rulesDoc.start_regions?.[playerId];
    if (!startInfo) return [];
    if (Array.isArray(startInfo)) return startInfo.slice();
    const out = [];
    if (Array.isArray(startInfo.default)) out.push(...startInfo.default);
    if (Array.isArray(startInfo.available)) out.push(...startInfo.available);
    return Array.from(new Set(out));
}

/**
 * Compute the set of regions currently reachable given an inventory.
 * Iteratively walks exits until no new region is added.
 */
export function computeReachableRegions(model, inventory) {
    const reachable = new Set(model.startRegions);
    let changed = true;
    while (changed) {
        changed = false;
        for (const regionName of [...reachable]) {
            const region = model.regions.get(regionName);
            if (!region) continue;
            for (const exit of region.exits) {
                if (reachable.has(exit.connected_region)) continue;
                if (!model.regions.has(exit.connected_region)) continue;
                if (evaluateRuleAgainstInventory(exit.access_rule, inventory)) {
                    reachable.add(exit.connected_region);
                    changed = true;
                }
            }
        }
    }
    return reachable;
}

/**
 * Compute the set of location names currently accessible — i.e.,
 * located in a reachable region AND with their access_rule satisfied.
 */
export function computeAccessibleLocations(model, inventory, reachableRegions = null) {
    const reach = reachableRegions ?? computeReachableRegions(model, inventory);
    const locs = new Set();
    for (const regionName of reach) {
        const region = model.regions.get(regionName);
        if (!region) continue;
        for (const location of region.locations) {
            if (evaluateRuleAgainstInventory(location.access_rule, inventory)) {
                locs.add(location.name);
            }
        }
    }
    return locs;
}

/**
 * Pick the next target the bot/visualizer should seek given current
 * state. Deterministic: returns the alphabetically-first
 * accessible-and-unchecked location, preferring advancement items.
 * Returns null if no progress is possible.
 *
 * `state` is { inventory: Set|Iterable, checkedLocations: Set|Iterable }.
 */
export function pickNextTarget(model, state) {
    const inventory = toSet(state?.inventory);
    const checked = toSet(state?.checkedLocations);

    const reachable = computeReachableRegions(model, inventory);
    const advancement = [];
    const filler = [];

    for (const regionName of reachable) {
        const region = model.regions.get(regionName);
        if (!region) continue;
        for (const location of region.locations) {
            if (checked.has(location.name)) continue;
            if (!evaluateRuleAgainstInventory(location.access_rule, inventory)) continue;
            const candidate = {
                region: regionName,
                location: location.name,
                item: location.item,
                accessRule: location.access_rule,
            };
            if (isAdvancement(location.item)) advancement.push(candidate);
            else filler.push(candidate);
        }
    }
    const pool = advancement.length > 0 ? advancement : filler;
    if (pool.length === 0) return null;
    pool.sort((a, b) => a.location.localeCompare(b.location));
    return pool[0];
}

function toSet(value) {
    if (value instanceof Set) return value;
    if (value == null) return new Set();
    return new Set(value);
}

function isAdvancement(item) {
    if (!item) return false;
    // If absent default to true — better to walk a possibly-filler
    // location than to silently skip a real progression item.
    return item.advancement !== false;
}

/**
 * Walk a full playthrough and emit a sphere log. Output is an array
 * of plain objects — each one corresponds to a line in the JSONL
 * format. Caller stringifies as needed.
 *
 * `opts.metadata` is merged into the leading metadata entry. Common
 * fields: { seed, seed_name, event_locations, event_items }.
 */
export function generateSphereLog(rulesDoc, opts = {}) {
    const playerId = opts.playerId ?? DEFAULT_PLAYER_ID;
    const model = buildAccessibilityModel(rulesDoc, playerId);

    const entries = [];
    entries.push({
        type: 'metadata',
        seed: opts.metadata?.seed ?? rulesDoc.generation_seed ?? null,
        seed_name: opts.metadata?.seed_name ?? rulesDoc.seed_name ?? null,
        event_locations: opts.metadata?.event_locations ?? {},
        event_items: opts.metadata?.event_items ?? {},
    });

    // Seed inventory from rulesDoc.starting_items so accessibility on
    // sphere 0 reflects what the player actually starts with. Without
    // this, games that gate every exit on a starting item (e.g. apcalc,
    // which starts with four Buttons) compute zero reachable locations
    // and the loop terminates immediately, leaving the embedded sphere
    // log with only the metadata + an empty sphere "0" entry.
    const startingItems = rulesDoc.starting_items?.[String(playerId)] ?? [];
    const inventory = new Set(startingItems);
    const startingItemCounts = {};
    for (const name of startingItems) {
        startingItemCounts[name] = (startingItemCounts[name] ?? 0) + 1;
    }
    const checkedLocations = new Set();

    const initialRegions = computeReachableRegions(model, inventory);
    const initialLocs = computeAccessibleLocations(model, inventory, initialRegions);

    entries.push({
        type: 'state_update',
        sphere_index: '0',
        player_data: {
            [playerId]: {
                new_inventory_details: {
                    base_items: { ...startingItemCounts },
                    resolved_items: { ...startingItemCounts },
                },
                new_accessible_locations: sortedArray(initialLocs),
                new_accessible_regions: sortedArray(initialRegions),
                sphere_locations: [],
            },
        },
    });

    let sphereIdx = 0;
    const SAFETY_BUDGET = 10000;
    let totalIters = 0;

    while (true) {
        if (++totalIters > SAFETY_BUDGET) {
            throw new Error('generateSphereLog: iteration budget exceeded; possible cycle');
        }

        // Snapshot accessibility at the sphere boundary. Locations
        // accessible NOW with advancement items are this sphere's
        // pick set. Locations that become accessible mid-sphere
        // (from a pickup's item) belong to the NEXT sphere.
        const boundaryRegions = computeReachableRegions(model, inventory);
        const boundaryLocs = computeAccessibleLocations(model, inventory, boundaryRegions);

        const spherePicks = [];
        for (const locationName of boundaryLocs) {
            if (checkedLocations.has(locationName)) continue;
            const location = model.locationIndex.get(locationName);
            if (!location) continue;
            if (!isAdvancement(location.item)) continue;
            spherePicks.push(location);
        }
        if (spherePicks.length === 0) break;

        spherePicks.sort((a, b) => a.name.localeCompare(b.name));

        let fractionalIdx = 0;
        for (const location of spherePicks) {
            fractionalIdx += 1;

            const beforeRegions = computeReachableRegions(model, inventory);
            const beforeLocs = computeAccessibleLocations(model, inventory, beforeRegions);

            checkedLocations.add(location.name);
            const itemName = location.item?.name;
            if (itemName) inventory.add(itemName);

            const afterRegions = computeReachableRegions(model, inventory);
            const afterLocs = computeAccessibleLocations(model, inventory, afterRegions);

            const newRegions = sortedArray(diff(afterRegions, beforeRegions));
            const newLocs = sortedArray(filterSet(diff(afterLocs, beforeLocs), (n) => !checkedLocations.has(n)));

            const baseItems = itemName ? { [itemName]: 1 } : {};
            entries.push({
                type: 'state_update',
                sphere_index: `${sphereIdx}.${fractionalIdx}`,
                player_data: {
                    [playerId]: {
                        new_inventory_details: {
                            base_items: baseItems,
                            resolved_items: { ...baseItems },
                        },
                        new_accessible_locations: newLocs,
                        new_accessible_regions: newRegions,
                        sphere_locations: [location.name],
                    },
                },
            });
        }

        sphereIdx += 1;
    }

    return entries;
}

function sortedArray(set) {
    return [...set].sort((a, b) => a.localeCompare(b));
}

function diff(a, b) {
    const out = new Set();
    for (const x of a) if (!b.has(x)) out.add(x);
    return out;
}

function filterSet(set, pred) {
    const out = new Set();
    for (const x of set) if (pred(x)) out.add(x);
    return out;
}
