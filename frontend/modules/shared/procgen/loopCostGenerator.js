/**
 * Pure-function loop-mode cost generator.
 *
 * Derives per-region `moveCost` and per-location cost numbers from a
 * sphere log + rules.json. Output schema matches what
 * `frontend/modules/loops/costDataManager.js` consumes at runtime, so
 * sidecars produced here are interchangeable with sidecars produced by
 * the runtime CostGenerator.
 *
 * Algorithm (mirrors the runtime CostGenerator's behavior, but without
 * mutating live loop state):
 *   - Start with maxMana = 100 (or `startingMaxMana` opt). The simulated
 *     "current mana" at the start of each iteration equals maxMana,
 *     because the runtime version refills mana via `_resetLoop` between
 *     iterations.
 *   - For each location entry in sphere order:
 *       • BFS from the start region to the target region (rule-gates
 *         ignored — the sphere log already orders entries past their
 *         prereqs, so any traversable graph path is acceptable).
 *       • For each region in the path that hasn't been costed yet:
 *           cost = max(1, floor((maxMana / 2) / remainingUncostedInPath))
 *       • If the location hasn't been costed yet:
 *           cost = max(1, floor(maxMana / 2))
 *   - After each entry: maxMana += itemsReceived * manaPerItem.
 *   - Fill in defaults for regions/locations the sphere log didn't
 *     touch (default region cost = highest neighbor cost, location
 *     cost = max of existing location costs).
 *
 * This module has no DOM or eventBus dependencies and runs both in the
 * browser pipeline and in tests.
 */

const DEFAULT_PLAYER_ID = '1';

const VALID_REGION_XP_EFFECTS = ['cost', 'speed', 'both', 'none'];
const DEFAULT_REGION_XP_EFFECT = 'cost';

function _normalizeRegionXpEffect(effect) {
    return VALID_REGION_XP_EFFECTS.includes(effect) ? effect : DEFAULT_REGION_XP_EFFECT;
}

/**
 * @param {Object} args
 * @param {Object} args.rulesJson — the source rules.json
 * @param {Array}  args.sphereLog — parsed sphere log entries
 * @param {string} [args.playerId='1']
 * @param {number} [args.startingMaxMana=100]
 * @param {number} [args.manaPerItem=10]
 * @param {number} [args.defaultRegionCost=50]
 * @param {number} [args.defaultLocationCost=10]
 * @param {'cost'|'speed'|'both'|'none'} [args.regionXpEffect='cost']
 *        Per-region XP effect mode. Stamped on every region entry as
 *        `xpEffect`, plus written to `defaultRegionXpEffect` at the
 *        sidecar root for fallback.
 * @param {string} [args.sourceFileName=null] — recorded in metadata
 * @returns {Object} cost data (version, generatedAt, regions, locations,
 *                   defaultRegionCost, defaultLocationCost,
 *                   defaultRegionXpEffect)
 */
export function generateLoopCosts({
    rulesJson,
    sphereLog,
    playerId = DEFAULT_PLAYER_ID,
    startingMaxMana = 100,
    manaPerItem = 10,
    defaultRegionCost = 50,
    defaultLocationCost = 10,
    regionXpEffect = DEFAULT_REGION_XP_EFFECT,
    sourceFileName = null,
} = {}) {
    if (!rulesJson || typeof rulesJson !== 'object') {
        throw new Error('generateLoopCosts: rulesJson required');
    }
    if (!Array.isArray(sphereLog)) {
        throw new Error('generateLoopCosts: sphereLog must be an array');
    }

    const regions = rulesJson?.regions?.[playerId] ?? {};
    if (Object.keys(regions).length === 0) {
        throw new Error(`generateLoopCosts: no regions for player '${playerId}'`);
    }

    const startRegion = resolveStartRegion(rulesJson, regions, playerId);
    if (!startRegion) {
        throw new Error(`generateLoopCosts: no usable start region for player '${playerId}'`);
    }

    const adjacency = buildAdjacency(regions);
    const locationToRegion = buildLocationIndex(regions);
    const xpEffect = _normalizeRegionXpEffect(regionXpEffect);

    const costs = {
        version: '1.0',
        generatedAt: new Date().toISOString(),
        generatedFrom: sourceFileName,
        regions: { [startRegion]: { moveCost: 0, xpEffect } },
        locations: {},
        defaultRegionCost,
        defaultLocationCost,
        defaultRegionXpEffect: xpEffect,
    };

    const assignedRegions = new Set([startRegion]);
    const assignedLocations = new Set();

    let maxMana = startingMaxMana;

    const entries = extractLocationEntries(sphereLog, playerId);
    for (const entry of entries) {
        if (!entry.locationName) {
            // Phantom entry (items received from other players, no
            // location to check): just bump maxMana.
            maxMana += entry.itemsReceived * manaPerItem;
            continue;
        }

        const targetRegion = locationToRegion.get(entry.locationName);
        if (!targetRegion) {
            // Location not in this player's static data — apply mana
            // boost and skip.
            maxMana += entry.itemsReceived * manaPerItem;
            continue;
        }

        const path = bfsRegions(adjacency, startRegion, targetRegion);
        if (!path) {
            // Disconnected graph — still apply mana boost.
            maxMana += entry.itemsReceived * manaPerItem;
            continue;
        }

        // Cost the uncosted regions along the path.
        const uncosted = path.filter((r) => !assignedRegions.has(r));
        if (uncosted.length > 0) {
            const manaForRegions = maxMana / 2;
            let remaining = uncosted.length;
            for (const region of uncosted) {
                const cost = Math.max(1, Math.floor(manaForRegions / remaining));
                costs.regions[region] = { moveCost: cost, xpEffect };
                assignedRegions.add(region);
                remaining -= 1;
            }
        }

        // Cost the location if not already costed.
        if (!assignedLocations.has(entry.locationName)) {
            const locationCost = Math.max(1, Math.floor(maxMana / 2));
            costs.locations[entry.locationName] = locationCost;
            assignedLocations.add(entry.locationName);
        }

        // Mana boost from items received in this sphere takes effect
        // for the next iteration.
        maxMana += entry.itemsReceived * manaPerItem;
    }

    fillDefaults(costs, regions, assignedRegions, assignedLocations);
    return costs;
}

// ---------- helpers ----------

function resolveStartRegion(rulesJson, regions, playerId) {
    const startField = rulesJson?.start_regions?.[playerId];
    let declared = null;
    if (Array.isArray(startField?.default)) declared = startField.default[0];
    else if (Array.isArray(startField)) declared = startField[0];
    if (declared && regions[declared]) return declared;
    // Fall back to the first region in the map.
    const keys = Object.keys(regions);
    return keys.length > 0 ? keys[0] : null;
}

function buildAdjacency(regions) {
    // Map<regionName, Array<connectedRegion>>
    const map = new Map();
    for (const [name, data] of Object.entries(regions)) {
        const targets = [];
        for (const exit of data?.exits ?? []) {
            if (exit.connected_region) targets.push(exit.connected_region);
        }
        map.set(name, targets);
    }
    return map;
}

function buildLocationIndex(regions) {
    // Map<locationName, regionName>
    const idx = new Map();
    for (const [name, data] of Object.entries(regions)) {
        for (const loc of data?.locations ?? []) {
            const locName = typeof loc === 'string' ? loc : loc?.name;
            if (locName) idx.set(locName, name);
        }
    }
    return idx;
}

function bfsRegions(adjacency, source, target) {
    if (source === target) return [source];
    const visited = new Set([source]);
    const queue = [{ region: source, path: [source] }];
    while (queue.length > 0) {
        const { region, path } = queue.shift();
        for (const neighbor of adjacency.get(region) ?? []) {
            if (visited.has(neighbor)) continue;
            visited.add(neighbor);
            const next = [...path, neighbor];
            if (neighbor === target) return next;
            queue.push({ region: neighbor, path: next });
        }
    }
    return null;
}

function extractLocationEntries(sphereLog, playerId) {
    const out = [];
    const pid = String(playerId);
    for (const logEntry of sphereLog) {
        if (logEntry?.type !== 'state_update') continue;
        const playerData = logEntry.player_data?.[pid];
        if (!playerData) continue;

        const sphereLocations = playerData.sphere_locations || [];
        const baseItems = playerData.new_inventory_details?.base_items || {};
        const itemsReceived = Object.values(baseItems).reduce(
            (sum, count) => sum + count,
            0,
        );

        if (sphereLocations.length === 0 && itemsReceived > 0) {
            out.push({
                sphereIndex: logEntry.sphere_index,
                locationName: null,
                itemsReceived,
            });
            continue;
        }
        for (let i = 0; i < sphereLocations.length; i++) {
            out.push({
                sphereIndex: logEntry.sphere_index,
                locationName: sphereLocations[i],
                // Items received are credited on the last location of
                // the sphere (matches runtime CostGenerator).
                itemsReceived: i === sphereLocations.length - 1 ? itemsReceived : 0,
            });
        }
    }
    return out;
}

function fillDefaults(costs, regions, assignedRegions, assignedLocations) {
    const xpEffect = _normalizeRegionXpEffect(costs.defaultRegionXpEffect);
    // Uncosted regions: highest neighbor cost, or defaultRegionCost.
    for (const [name, data] of Object.entries(regions)) {
        if (assignedRegions.has(name)) continue;
        let highest = 0;
        for (const exit of data?.exits ?? []) {
            const neighborCost = costs.regions[exit.connected_region]?.moveCost;
            if (neighborCost && neighborCost > highest) highest = neighborCost;
        }
        costs.regions[name] = {
            moveCost: highest > 0 ? highest : costs.defaultRegionCost,
            xpEffect,
        };
    }

    // Uncosted locations: max of existing location costs (or default).
    const existing = Object.values(costs.locations);
    const fallback = existing.length > 0
        ? Math.max(costs.defaultLocationCost, ...existing)
        : costs.defaultLocationCost;
    for (const [name, data] of Object.entries(regions)) {
        for (const loc of data?.locations ?? []) {
            const locName = typeof loc === 'string' ? loc : loc?.name;
            if (!locName || assignedLocations.has(locName)) continue;
            costs.locations[locName] = fallback;
        }
    }
}

// Exported for tests
export const _internal = {
    bfsRegions,
    buildAdjacency,
    buildLocationIndex,
    extractLocationEntries,
    fillDefaults,
};
