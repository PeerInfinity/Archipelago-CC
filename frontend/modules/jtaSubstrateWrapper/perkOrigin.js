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
 */

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
