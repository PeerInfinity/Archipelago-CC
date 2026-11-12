/**
 * ⛓⛓ **THE MOUNT KEY — WHAT THE AP LOAD MOUNTS FROM, AS ONE STRING** (⚖ Robert, 2026-11-02: a same-wiring Seedling
 * preset switch while the game runs loads the NEW preset's rooms — "Fix it", a visible restart accepted).
 *
 * `flashPanelUI._onRulesLoaded` re-mounts on a change of the `flash_panel` WIRING. `seedling_atlas` and
 * `seedling_atlas_location` share one, so a switch between them re-mounted nothing, and the rooms the AP load
 * (`_startSeedlingRandomizer`, run at bridge ready) had already bound or delivered stayed the PREVIOUS preset's.
 * This key is the second question the panel asks: would the AP load mount something DIFFERENT from these rules?
 *
 * ⛔ NOT "any rules change". It is exactly the inputs the load reads (`seedlingRandomizerWiring.js`'s three arms and
 * `realRoomPlaybackMap`), each by CONTENT, so a reload of the same document — a fresh object, the same rooms — keys
 * the same and restarts nothing:
 *   slot       `staticData.playerId` (the load's `selfPlayer`, `region_atlas["<p>"]`, the map path)
 *   rooms      the `flash_seedling` (atlas / vanilla) and `flash_seedling_gen` (generated) sidecars, whole payloads,
 *              in sidecar order — the rooms the atlas arm binds and the generated arm assembles
 *   atlas      `region_atlas["<p>"]` — the atlas document the atlas arm binds against
 *   map        `mapDocumentPath(...).path` — the map document every arm reads
 *   seed       `seed_name` / `generation_seed` — the generated set's id
 *   links      `realRoomLinks` — the logical sub-region links the playback map carries
 *   events     `runtimeEventsOf` — the game-state events the playback map carries
 *   placement  each location's placed item (`{name, player}`) — what the check binding / the vanilla rewrite reads
 *
 * ⛔ Pure, and it never throws: a document it cannot read keys as `unkeyable: <why>`, which differs from every
 * readable one (so the next readable load re-mounts rather than keeping a mount nobody can account for).
 */
import { atlasRoomRegions, roomPlayerOf } from '../seedlingDemo/seedlingAtlasCheckTable.js';
import { generatedRoomCensus } from '../seedlingDemo/seedlingGenRoomPayload.js';
import { mapDocumentPath, regionAtlasOf } from './mapDocumentPath.js';
import { realRoomLinks, runtimeEventsOf } from './seedlingPlaybackController.js';

/** `[name, item, player]` per location holding an item, sorted by name. */
function placementOf(locations) {
    const entries = locations instanceof Map ? [...locations.entries()] : Object.entries(locations ?? {});
    return entries
        .map(([name, rec]) => [name, rec?.item?.name ?? null, rec?.item?.player ?? null])
        .filter(([, item]) => item !== null)
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/**
 * @param {object} o
 * @param {object|null} o.rules      the raw rules.json (never the `rawJsonDataLoaded` wrapper)
 * @param {string|number|null} [o.playerId]  the loaded slot (`staticData.playerId`)
 * @param {Map|object|null} [o.locations]    `staticData.locations` (name → record with `item`)
 * @returns {string}
 */
export function seedlingMountKey({ rules, playerId = null, locations = null } = {}) {
    try {
        const player = playerId === undefined || playerId === null ? null : String(playerId);
        // The slot the room readers read (`atlasRoomRegions`, `generatedRoomCensus`): the loaded one, `'1'` when
        // none is named — every committed preset is keyed there, a room's server-built rules under the room slot.
        const roomPlayer = roomPlayerOf(player);
        const sidecars = rules?.preset_sidecars?.[roomPlayer] ?? {};
        const atlasRooms = atlasRoomRegions(rules, roomPlayer).map((r) => r.region);
        const generatedRooms = generatedRoomCensus(rules, roomPlayer).rooms;
        const payloads = new Map(atlasRooms.map((region) => [region, sidecars[region]?.playable_payload]));
        return JSON.stringify({
            player,
            rooms: [...atlasRooms, ...generatedRooms].map((region) => [region, sidecars[region] ?? null]),
            atlas: regionAtlasOf(rules, player) ?? null,
            map: mapDocumentPath(rules, player).path,
            seed: [rules?.seed_name ?? null, rules?.generation_seed ?? null],
            links: realRoomLinks(rules, payloads),
            events: runtimeEventsOf(rules, roomPlayer).events, // the slot `realRoomPlaybackMap` reads
            placement: placementOf(locations),
        });
    } catch (err) {
        return `unkeyable: ${err?.message ?? err}`;
    }
}
