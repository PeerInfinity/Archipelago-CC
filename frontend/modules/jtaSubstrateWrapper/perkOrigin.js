/**
 * Own-vs-foreign classification for AP perk items.
 *
 * Under AP-authoritative grants a perk enters JtA only as an AP item, and the
 * two origins of an item behave differently across a prestige (which sets every
 * perk to `false`):
 *
 *   - a perk found on the player's OWN location behaves like the vanilla perk
 *     it replaced: it resets on prestige and comes back the next time the task
 *     holding it completes. The AP location stays checked; only the in-run perk
 *     state cycles.
 *   - a perk found in ANOTHER player's world has no task to re-run, so it
 *     persists through prestige and the client re-grants it.
 *
 * The bridge's inventory (`{name: count}`) carries no origin, so the origin is
 * recovered from the placement: an item is own-world iff it sits on one of the
 * player's own locations AND belongs to the player. The `player` half matters —
 * in a multiworld with two JtA slots, both own an item named "Attunement", and
 * my location may hold the other player's copy while mine sits in their world.
 *
 * The placement source is `staticData`, not the region sidecar: sidecars are
 * baked into the world package at world-generation time and read back verbatim
 * at export time (exporter/games/base/handler.py `_inject_worldgen_sidecars`),
 * whereas AP's fill runs afterwards. `staticData.locationItems` is the
 * post-fill truth. `CC/scripts/jta-stats/make-ap-config.mjs` performs the same
 * join to build the harness's reference model of this runtime.
 *
 * THE FORCED PERK-CATEGORY SET (single definition — keep consumers in sync).
 * The fork's `setPerkCategoryTaskIds` hook makes automation judge the given
 * tasks as unearned-perk tasks (perk auto-fill band + perk threshold
 * category). Under AP randomization that treatment belongs to the union of:
 *
 *   1. NATIVE perk tasks — tasks whose definition granted a perk before the
 *      suppression patch erased it (the patch carries a `perk` field). The
 *      2026-07-09 categorization fix.
 *   2. PERK HOLDERS — tasks whose OWN AP location holds a perk item (fill
 *      placement). Without this leg a perk placed on a non-perk task is
 *      judged by its natural category — for `other` that is the
 *      cost-INVARIANT energy-per-level metric, which drifts against the
 *      task (~1%/skill level) until automation refuses it at any cost
 *      (the Phase-5e measurement pass's unengaged-milestone mode).
 *
 * A task is RETIRED from the set once its AP location check has landed (in
 * the solver: once it first completes) — the reward is banked, so
 * prioritizing it every run would burn energy for nothing.
 *
 * Consumers (all derive through the helpers below — do not re-implement):
 *   - the Pass-B solver (`jtaBalance/balancePass.js`; holder ids extracted
 *     host-side by `jtaBalance/hostGlue.js` and shipped to the worker),
 *   - the live bridge (`bridge.js _syncPerkCategoryTaskIds`),
 *   - the measurement model (`CC/scripts/jta-stats/make-ap-config.mjs` →
 *     `driver.mjs` apRuntime).
 */

import { JTA_ZONE_TASK_DATA } from './zoneTaskData.js';

/**
 * The perk item names of the ACTIVE data source: the dataset's placed-perk
 * names when a dataset document is given, the vanilla snapshot's otherwise.
 * Same derivation the pipeline library uses for its item surface, kept here
 * (pure, iframe-safe) so the bridge and the balance host agree on it.
 *
 * @param {object|null|undefined} dataset - a jta-dataset document, or null
 * @returns {string[]} distinct perk display names
 */
export function activePerkItemNames(dataset) {
    if (dataset) {
        return [...new Set(dataset.zones.flatMap((z) => z.tasks
            .filter((t) => t.perk != null)
            .map((t) => dataset.perks[t.perk]?.name)
            .filter(Boolean)))];
    }
    return [...new Set(JTA_ZONE_TASK_DATA.flatMap((z) => z.tasks.map((t) => t.perk).filter(Boolean)))];
}

/**
 * The PERK HOLDER leg of the forced perk-category set: task ids whose own AP
 * location holds a perk item.
 *
 * @param {object} o
 * @param {Record<string, string>|Map<any, string>} o.apLocations
 *   taskId -> location name (the payload-native `ap_locations` shape).
 * @param {(locationName: string) => (string|{name: string, player?: any}|undefined)} o.itemAtLocation
 *   Placement lookup. May return a bare item NAME (already player-filtered,
 *   e.g. the bridge's ownPlacements view) or a placement OBJECT `{name,
 *   player}` (rules-doc / staticData shape) — the player guard applies only
 *   to objects that carry `player`.
 * @param {Set<string>} o.perkNames - the active source's perk item names
 * @param {any} [o.playerId] - required to apply the player guard on objects
 * @returns {number[]} holder task ids, ascending (deterministic)
 */
export function perkHolderTaskIds({ apLocations, itemAtLocation, perkNames, playerId = null }) {
    const entries = apLocations instanceof Map
        ? [...apLocations.entries()]
        : Object.entries(apLocations ?? {});
    const ids = [];
    for (const [taskId, locationName] of entries) {
        const placed = itemAtLocation(locationName);
        if (!placed) continue;
        let name;
        if (typeof placed === 'string') {
            name = placed;
        } else {
            // My location holding another player's item grants me nothing.
            // `player` undefined = single-player export = mine.
            if (placed.player !== undefined && playerId !== null
                && String(placed.player) !== String(playerId)) continue;
            name = placed.name;
        }
        if (name && perkNames.has(name)) ids.push(Number(taskId));
    }
    return ids.sort((a, b) => a - b);
}

/**
 * The forced perk-category set: native perk tasks ∪ perk holders. Trivial by
 * construction — it exists so the DEFINITION lives in one importable place
 * and a consumer that forgets a leg fails review by not calling this.
 *
 * @param {Iterable<number>} nativeIds - suppressed native perk task ids
 * @param {Iterable<number>} holderIds - perkHolderTaskIds output
 * @returns {Set<number>}
 */
export function forcedPerkCategoryIds(nativeIds, holderIds) {
    return new Set([...(nativeIds ?? []), ...(holderIds ?? [])]);
}

/**
 * True when `staticData` describes the world the given region belongs to.
 *
 * Identity alone can't establish this. AdapterClient hands back a freshly
 * structured-cloned object per response, so a response that raced the host's
 * own cache update is a NEW object carrying the OLD world — and memoizing that
 * would misclassify every perk. Every jta AP location carries an item, so the
 * region's own location names must all be present.
 *
 * @param {object|null} staticData
 * @param {Record<string, string>|null|undefined} apLocations - world.ap_locations
 */
export function staticDataMatchesRegion(staticData, apLocations) {
    const locationItems = staticData?.locationItems;
    if (!(locationItems instanceof Map)) return false;
    const names = Object.values(apLocations ?? {});
    if (names.length === 0) return false;
    return names.every((name) => locationItems.has(name));
}

/**
 * Build the own-world placement view from a staticData snapshot.
 *
 * @param {object|null} staticData - as returned by AdapterClient.getStaticData()
 * @returns {{byLocation: Map<string, string>, itemNames: Set<string>}|null}
 *   `byLocation` maps each of the player's own location names to the item name
 *   placed on it; `itemNames` is the set of those item names. null when
 *   staticData is absent or lacks the fields (caller keeps its prior view).
 */
export function buildOwnPlacements(staticData) {
    const locationItems = staticData?.locationItems;
    const playerId = staticData?.playerId;
    if (!(locationItems instanceof Map) || playerId === undefined || playerId === null) {
        return null;
    }
    const byLocation = new Map();
    const itemNames = new Set();
    for (const [locationName, item] of locationItems.entries()) {
        if (!item || typeof item.name !== 'string' || item.name.length === 0) continue;
        // A location of mine holding someone else's item grants me nothing.
        // `player` is undefined in single-player exports — treat that as mine.
        if (item.player !== undefined && String(item.player) !== String(playerId)) continue;
        byLocation.set(locationName, item.name);
        itemNames.add(item.name);
    }
    return { byLocation, itemNames };
}
