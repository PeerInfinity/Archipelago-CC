/**
 * Pure, browser-free helpers for the jtaBalance host module (Phase 3e).
 *
 * Everything here is a pure function of a rules doc / patch list — no DOM, no
 * eventBus, no warehouse — so it is unit-testable in Node (hostGlue.test.js)
 * and reusable from both the host module (index.js) and, if ever needed, the
 * worker. The extraction logic mirrors scripts/procgen/verify-jta-balance-pass.mjs
 * (which we may not modify): ap_locations come from the preset_sidecars
 * `playable_payload` in payload-native direction (taskId -> location name), and
 * gate counts come from a defensive walk of each location's access rule tree
 * looking for the `HasFromListUnique` perk count.
 *
 * The worker message boundary requires structured-cloneable inputs, so
 * `extractGateCounts` returns a PLAIN OBJECT keyed by stringified task id (the
 * worker rehydrates it into a Map before calling runBalancePass, which expects
 * a Map). apLocations is already a plain object.
 */

/** Read the substrate payload for a sidecar entry (playable_payload or the entry itself). */
function sidecarPayload(sidecar) {
    return sidecar?.playable_payload ?? sidecar ?? {};
}

/**
 * Detect whether the loaded rules doc is a procgen jta world for balancing
 * purposes: a player whose preset_sidecars carry at least one region payload
 * with a non-empty `ap_locations` map. Returns { isJta, playerId }.
 *
 * playerId is the first player that has ap_locations-bearing sidecars — the
 * same player the balance pass and the procgenPlayer warehouse key on.
 */
export function detectJtaWorld(rulesDoc) {
    const sidecarsByPlayer = rulesDoc?.preset_sidecars;
    if (!sidecarsByPlayer || typeof sidecarsByPlayer !== 'object') {
        return { isJta: false, playerId: null };
    }
    for (const [playerId, sidecars] of Object.entries(sidecarsByPlayer)) {
        if (!sidecars || typeof sidecars !== 'object') continue;
        let hasApLocations = false;
        let hasDataset = false;
        for (const sidecar of Object.values(sidecars)) {
            const payload = sidecarPayload(sidecar);
            // Synthetic-dataset worlds (jta_dataset_ref carriage, Phase 5d)
            // are NOT balanceable yet: the worker would solve against the
            // fork's vanilla tables while the world's task ids belong to the
            // dataset. Pass-B dataset support is Phase 5e — until then the
            // solve is skipped and the world plays on its Pass-A
            // provisional costs.
            if (payload.jta_dataset_ref || payload.jta_dataset) hasDataset = true;
            const apLocations = payload.ap_locations;
            if (apLocations && typeof apLocations === 'object' && Object.keys(apLocations).length) {
                hasApLocations = true;
            }
        }
        if (hasApLocations && !hasDataset) return { isJta: true, playerId };
    }
    return { isJta: false, playerId: null };
}

/**
 * Merge every region's `ap_locations` for one player into a single
 * { taskId(string) -> location name } object. Payload-native direction, exactly
 * as the verify script consumes it.
 */
export function extractApLocations(rulesDoc, playerId) {
    const apLocations = {};
    const sidecars = rulesDoc?.preset_sidecars?.[playerId] ?? {};
    for (const sidecar of Object.values(sidecars)) {
        const payloadLocations = sidecarPayload(sidecar).ap_locations ?? {};
        for (const [taskId, locName] of Object.entries(payloadLocations)) {
            apLocations[taskId] = locName;
        }
    }
    return apLocations;
}

/**
 * The HasFromListUnique perk count on a location's access rule (Phase 3a's loose
 * zone gate); no rule = free (0). Walk the tree defensively — the count may sit
 * under a combinator. Verbatim behaviour of verify-jta-balance-pass.mjs.
 */
export function ruleGateCount(rule) {
    if (!rule || typeof rule !== 'object') return 0;
    if (rule.rule === 'HasFromListUnique') return Number(rule.args?.count ?? 0);
    let max = 0;
    for (const v of Object.values(rule.args ?? rule)) {
        if (Array.isArray(v)) for (const x of v) max = Math.max(max, ruleGateCount(x));
        else if (v && typeof v === 'object') max = Math.max(max, ruleGateCount(v));
    }
    return max;
}

/**
 * Gate counts as a PLAIN OBJECT { taskId(string) -> count } for every jta task
 * location, walking `regions[playerId][*].locations[*].access_rule`. Structured-
 * cloneable for the worker boundary; the worker converts to the Map the pass
 * wants. apLocations gives the name->taskId inversion.
 */
export function extractGateCounts(rulesDoc, playerId, apLocations) {
    const nameToTaskId = new Map(
        Object.entries(apLocations).map(([id, name]) => [name, Number(id)]),
    );
    const gateCounts = {};
    const regions = rulesDoc?.regions?.[playerId] ?? {};
    for (const region of Object.values(regions)) {
        for (const loc of region?.locations ?? []) {
            const taskId = nameToTaskId.get(loc.name);
            if (taskId == null) continue;
            gateCounts[taskId] = ruleGateCount(loc.access_rule);
        }
    }
    return gateCounts;
}

/**
 * The seed identifier the cache and the pass key on. Matches the verify script:
 * `seed_name` preferred, then `seed`, then 1.
 */
export function computeSeedName(rulesDoc) {
    // Empty-string seed_name happens in Pass-A-only presets; || (not ??)
    // deliberately treats it as missing.
    return rulesDoc?.seed_name || rulesDoc?.generation_seed || rulesDoc?.seed || 1;
}

/** localStorage cache key for a seed's solved cost patches (versioned). */
export function cacheKey(seedName) {
    return `jtaBalance_patches_v1_${seedName}`;
}

/**
 * Partition a flat cost-patch list ([{ id, cost_multiplier }]) across regions.
 * `regionTaskIds` is [{ regionId, taskIds: Set<number> }]; each patch lands in
 * the region whose task set contains its id. Patches for ids in no region are
 * dropped. Pure — the warehouse merge (index.js) supplies the region task sets
 * from each jta world's `ap_locations`.
 */
export function partitionPatchesByRegion(patches, regionTaskIds) {
    const byRegion = new Map();
    for (const { regionId } of regionTaskIds) byRegion.set(regionId, []);
    for (const patch of patches ?? []) {
        for (const { regionId, taskIds } of regionTaskIds) {
            if (taskIds.has(patch.id)) {
                byRegion.get(regionId).push(patch);
                break;
            }
        }
    }
    return byRegion;
}
