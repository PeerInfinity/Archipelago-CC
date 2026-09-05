/**
 * mazeRoom/mazeRegionRoundTrip — **THE MAZE'S OWN DOCUMENT ⇄ ROOM-EDITOR
 * ROUND TRIP**, declared on the registry entry beside `roomEditor`
 * (APWORLD EDITOR HUB slice H4b; plan §5's H4b row, §17).
 *
 * ── ⛓⛓⛓ WHY THIS IS A DECLARATION AND NOT AN IMPORT ──────────────────
 *
 * The hub's `apworldEditor/regionRoundTrip.js` opens a region's room from a
 * rules.json document and folds the save back as ONE `replace-region-sidecar`.
 * Everything in that sentence is substrate-INDEPENDENT except two facts:
 *
 *   1. what document this substrate's room editor wants handed IN, and
 *   2. how to read its save back into `{payload, exits, locations}`.
 *
 * ⛔ Those two are the SUBSTRATE'S, and the user's standing rule is *"I don't
 * want to hardcode support for … specific substrates"* (⚖ 2026-09-04, the
 * ruling that produced H3's `compositeMap.drawRegion`). So the hub resolves
 * `substrateRegistry.get(id)?.regionRoundTrip` exactly as the composite map
 * resolves `compositeMap.drawRegion`, and this file is the maze's declarer —
 * carrying its own imports (the engine, the serializer, the library capture
 * path, the compiler) so the hub imports NO substrate module.
 *
 * ── ⛔⛔ THE CAPTURE PATH IS LOSSY FOR A SIDECAR PAYLOAD, AND THAT IS THE
 *        WHOLE REASON THIS FILE IS MORE THAN TWO LINES ──────────────────
 *
 * The maze's room editor is `lab.html?source=set`, whose document is a REGION
 * LIBRARY — interchangeable CONTENT, deliberately stripped of the instance
 * identity a placed region has. MEASURED on the H4a fixture
 * (`multiworld/AP_05594871498841892311`, slot 1, `region_1_0`):
 *
 *     sidecar exits   targetRegion "region_2_0" · targetExitId "region_1_0" · isBackExit true
 *     capture exits   targetRegion null         · targetExitId null         · isBackExit false
 *     sidecar items   {id:"key_red", locationName:"region_1_0__key_red_pickup__5_5"}
 *     capture items   {id:"slot_0",  locationName:null}
 *     sidecar keys    … fogEnabled: true          capture keys  (fogEnabled ABSENT)
 *
 * ⇒ writing the library's payload straight back into the document would delete
 * every connection line on the hub's map, every baked AP location name the
 * substrate panel publishes `user:locationCheck` from, and the fog flag. It
 * would also be GREEN under any test that only checked the room's tiles.
 *
 * ⛓ **THE CURE IS A RE-STAMP, KEYED ON GEOMETRY.** `save` takes the edited
 * payload and puts the ORIGINAL's instance identity back:
 *   · exits, by `exit_id` — the capture keeps the id, the side and the tile;
 *   · items, by TILE POSITION — the capture renames the ids (`slot_0`…) and
 *     re-sorts them, so position is the only key that survives it;
 *   · any key the re-serialization does not emit at all (today exactly
 *     `fogEnabled`, measured), appended in the original's own order.
 * A thing the edit ADDED has no original to be re-stamped from; it comes back
 * with no name and the hub refuses it BY NAME, because a new AP location in a
 * FILLED document needs an id and a pool entry that a geometry editor cannot
 * mint.
 *
 * ⛓ **AND THE RULES ARE RE-DERIVED, NEVER CARRIED.** `maze` is a PROCEDURAL
 * library substrate (`regionLibraryValidator.LIBRARY_V1_SUBSTRATES`), whose
 * whole contract is that geometry is re-derivable: deserialize →
 * `extractPathsAndObstacles` → `compileRegion`, the same three calls
 * `compileRegionGraph` makes for a freshly grown region, with the payload's own
 * `obstacleLib` merged over the defaults exactly as the pipeline merges it
 * (`procgenPipelineEngine.js:2280-2285`). ⇒ the hub's re-derivation and the
 * pipeline's original agree by CONSTRUCTION rather than by resemblance, which
 * is what makes an unedited round trip a byte-for-byte no-op.
 */

import { DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import { compileRegion } from '../shared/procgen/pathsAndObstaclesCompiler.js';
import { stampLibraryIdentity } from '../procgenPipeline/regionLibraryValidator.js';
import { captureTileGridLibraryEntry } from './mazeLibraryEntry.js';
import { deserializeMazeWorld, extractPathsAndObstacles } from './mazeRoomEngine.js';
import { serializeMazeWorld } from './mazeSerializer.js';

/** ⛓ The three deps the capture path takes — the maze's own, in one place. */
const CAPTURE_DEPS = Object.freeze({
    serialize: serializeMazeWorld,
    extract: extractPathsAndObstacles,
    substrate: 'maze',
});

/**
 * ⛓ The exit fields GEOMETRY owns — the tile the exit sits on and which wall it
 * is in. Everything else on an exit is instance identity or an annotation the
 * document's own writer put there, and comes back from the document.
 */
const EXIT_GEOMETRY = Object.freeze(['exit_id', 'x', 'y', 'side']);

/**
 * ⛓ The exit fields the LIBRARY MINTS on capture (nulled targets, a `false`
 * back-exit flag). ⛔ Suppressed when the document's own exit does not carry
 * them: MEASURED, the ten `seedling_atlas_maze` rooms are written by the atlas
 * derivation and carry `atlas_exit_id` and NO `isBackExit`, so a round trip
 * that kept capture's minted fields and dropped the atlas's own would rewrite
 * an exit nobody edited.
 */
const EXIT_MINTED = Object.freeze([
    'exitName', 'targetRegion', 'targetExitId', 'isBackExit', 'isTeleporter',
]);

/** ⛓ The item fields the LIBRARY renames away. `x`/`y` are the KEY, not identity. */
const ITEM_IDENTITY = Object.freeze(['id', 'locationName']);

const tileKey = (o) => `${o?.x},${o?.y}`;

/**
 * ⛓ The obstacle library a maze region compiles under — the payload's own
 * per-instance entries (`logic_gate`, the coloured doors a grow drew) over the
 * shared defaults. ⛔ The same merge `compileRegionGraph` does, so a rule
 * derived here is the rule the pipeline would have emitted.
 */
const obstacleLibOf = (payload) => (payload?.obstacleLib
    ? { ...DEFAULT_OBSTACLES, ...payload.obstacleLib }
    : DEFAULT_OBSTACLES);

/**
 * ⛓⛓ **THE DOCUMENT THE MAZE LAB'S SET ARM WANTS: A ONE-ENTRY REGION
 * LIBRARY.** `labRoomEditor` hands the page whatever `open` returns as
 * `record` and then navigates to `?source=set&room=<room>`; the page SNIFFS
 * that document through `classifyDocument`, so it has to BE a region library
 * (`library_id` + an `entries` array), not the `{library, overlay}` session
 * record the page builds around it.
 *
 * ⛔ The entry is built by `captureTileGridLibraryEntry` and not assembled
 * here: `region_size`, `exit_sides`, `location_slots` and the
 * `carried_rules: null` contract all come from the ONE writer of a payload
 * from a world, and a second assembly would drift the day capture's does.
 */
function open({ regionId, payload }) {
    const world = deserializeMazeWorld(payload);
    const entry = captureTileGridLibraryEntry(
        { region_id: regionId, playable_payload: world },
        { entry_id: regionId, name: regionId },
        CAPTURE_DEPS,
    );
    const library = stampLibraryIdentity({
        schema_version: 1,
        library_id: `hub-${regionId}`,
        name: `${regionId} (from the APWorld editor)`,
        description: 'One region, opened from a rules.json document by the APWorld editor. '
            + 'Saving returns the room to the document it came from.',
        entries: [entry],
    }, `hub-${regionId}`);
    return {
        // ⛓ Spread into `roomEditor.open()` beside `onSave` — `labRoomEditor`'s
        //   own two words for "this document, that room".
        session: { record: library, room: 0 },
        /**
         * ⛓⛓ **WHAT THE SAVE WOULD CARRY FOR A SESSION NOBODY TOUCHED** — the
         * hub's BASELINE (`apworldEditor/regionRoundTrip.js`). The maze SET
         * arm's record is `{library, overlay}` (`mazeSetAdapter.setRecord`), so
         * an untouched close hands back the library it was given.
         *
         * ⛔ The overlay is `{}` and never read: `save` below takes the payload
         * out of `library.entries[0]` and nothing else, because an overlay is
         * the LIBRARY's own inter-room wiring and this document's wiring is its
         * rules.json exits.
         */
        unedited: { library, overlay: {} },
    };
}

/**
 * ⛓⛓ **THE SAVE.** `saved` is the SET arm's own record — `{library, overlay}`
 * — and room 0's payload is what the reader edited. The overlay is IGNORED and
 * that is deliberate: an overlay is the LIBRARY's own inter-room wiring, and
 * this document's wiring is the rules.json's exits, which this door may not
 * move (only `access_rule` travels).
 */
function save(saved, { regionId, payload }) {
    const edited = saved?.library?.entries?.[0]?.payload;
    if (!edited || typeof edited !== 'object' || Array.isArray(edited)) {
        throw new Error('mazeRegionRoundTrip: the maze lab\'s save carried no room payload '
            + `(\`library.entries[0].payload\`) for "${regionId}" — got `
            + `${JSON.stringify(saved && Object.keys(saved))}.`);
    }
    const next = restamp(edited, payload);
    const world = deserializeMazeWorld(next);
    const extracted = extractPathsAndObstacles(world, { regionId });
    const compiled = compileRegion(extracted, { obstacleLib: obstacleLibOf(next) });
    /**
     * ⛓⛓⛓ **THE PAYLOAD NAMES ITS OWN AP LOCATIONS, AND THAT IS WHAT MAKES A
     * TOP-DOWN REGION EDITABLE AT ALL.** `serializeMazeWorld` bakes
     * `items[].locationName` from `extractedRules.locations[].global_name ??
     * makeLocationName(...)` (`mazeSerializer.js:49-55`) — so for a region
     * grown by the maze pipeline the baked name IS what the naming convention
     * would reconstruct, and for a `procgen_topdown` region it is the SOURCE
     * GAME's name (`Inside Yellow Castle`), which no convention can.
     *
     * ⛔ Answering with it rather than leaving the hub to guess is the same
     * thing bounce does with `ap_locations`, and it is not a shortcut: an item
     * the reader MOVED or ADDED has no baked name (the re-stamp fills only the
     * tiles the document already had one on), so it comes back nameless and the
     * hub refuses it BY NAME instead of renaming somebody's AP location.
     */
    const nameByTile = new Map(
        (next.items ?? []).filter((it) => it.locationName).map((it) => [tileKey(it), it.locationName]),
    );
    const locations = compiled.locations.map((l) => {
        const name = l.position ? nameByTile.get(tileKey(l.position)) : null;
        return name ? { ...l, name } : l;
    });
    return { payload: next, exits: compiled.exits, locations };
}

/**
 * ⛓⛓⛓ **PUT THE INSTANCE IDENTITY BACK.** See the header for the measurement
 * this exists for. ⛔ It re-stamps only what it can MATCH: an exit whose
 * `exit_id` the original does not carry, or an item on a tile the original had
 * none on, is left exactly as the editor produced it — nameless — so the hub
 * refuses it by name rather than this file inventing an AP identity.
 */
function restamp(edited, original) {
    const exitsById = new Map((original?.exits ?? []).map((e) => [e.exit_id, e]));
    const itemsByTile = new Map((original?.items ?? []).map((it) => [tileKey(it), it]));
    const next = {
        ...edited,
        exits: (edited.exits ?? []).map((ex) => {
            const was = exitsById.get(ex.exit_id);
            if (!was) return ex;
            // ⛓ THE DOCUMENT'S OWN FIELDS, IN ITS OWN ORDER, with geometry from
            //   the edit — and an edited field the document lacks only when the
            //   library did not mint it.
            const out = {};
            for (const [k, v] of Object.entries(was)) {
                out[k] = EXIT_GEOMETRY.includes(k) && k in ex ? ex[k] : v;
            }
            for (const [k, v] of Object.entries(ex)) {
                if (!(k in was) && !EXIT_MINTED.includes(k)) out[k] = v;
            }
            return out;
        }),
        items: restampItems(edited.items ?? [], original?.items ?? [], itemsByTile),
    };
    // ⛓ Keys the re-serialization does not emit at all. MEASURED over the 1,034
    //   committed maze payloads: `fogEnabled` is the only one — but the rule is
    //   written as "whatever the original had and the round trip does not", so
    //   a serializer that stops emitting a second field cannot lose it silently.
    for (const [k, v] of Object.entries(original ?? {})) if (!(k in next)) next[k] = v;
    return next;
}

/**
 * ⛓⛓ **AND THE SLOT ORDER IS THE DOCUMENT'S WHEN NOTHING MOVED.** MEASURED:
 * `captureTileGridLibraryEntry` re-sorts a room's location slots
 * top-to-bottom/left-to-right (`byPosition`, its deterministic slot order),
 * and a serialized region's items are in the order the GROW placed them. Over
 * the 1,046 committed maze payloads that reorder alone accounted for **272**
 * of the 282 payloads an unedited round trip did not reproduce byte for byte.
 *
 * ⛔ It is only restored when the save moved NO slot — same tiles, same count.
 * The moment the reader adds, deletes or moves one, the original's order says
 * nothing about the new set and the library's own order is what ships.
 */
function restampItems(edited, original, itemsByTile) {
    const out = edited.map((it) => {
        const was = itemsByTile.get(tileKey(it));
        if (!was) return it;
        const next = { ...it };
        for (const f of ITEM_IDENTITY) if (f in was) next[f] = was[f];
        return next;
    });
    if (out.length !== original.length) return out;
    const order = new Map(original.map((it, i) => [tileKey(it), i]));
    if (!out.every((it) => order.has(tileKey(it)))) return out;
    return [...out].sort((a, b) => order.get(tileKey(a)) - order.get(tileKey(b)));
}

/** ⛓ The declaration the registry entry carries. ⛔ DATA, like `roomEditor`. */
export const mazeRegionRoundTrip = Object.freeze({ open, save });

export default mazeRegionRoundTrip;
