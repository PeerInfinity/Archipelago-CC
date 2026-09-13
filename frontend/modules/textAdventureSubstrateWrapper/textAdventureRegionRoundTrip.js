/**
 * textAdventureSubstrateWrapper/textAdventureRegionRoundTrip — **THE TEXT
 * ADVENTURE'S OWN DOCUMENT ⇄ ROOM ROUND TRIP**, declared on the registry entry
 * beside `exitSides` (PRESET SIDECARS G2b-1; plan §25.2, ⚖ §5i).
 *
 * ── ⛓⛓⛓ WHAT THIS SAYS THAT THE MAZE'S SAYS ─────────────────────────
 *
 * The hub's `apworldEditor/regionRoundTrip.js` imports NO substrate module:
 * it resolves `substrateRegistry.get(id)?.regionRoundTrip` and asks it two
 * things — what to hand a room editor for one region of a rules.json document
 * (`open`), and how to read that editor's save back into `{payload, exits,
 * locations}` (`save`). This file is the text adventure's answer, carrying its
 * own imports exactly as `mazeRoom/mazeRegionRoundTrip.js` carries the maze's,
 * so `apworldEditor/` never learns the name (⚖ *"I don't want to hardcode
 * support for … specific substrates"*). The rules are RE-DERIVED through
 * `compileRegion`, never carried — the same extract → compile a build does —
 * so the hub's baseline (an unedited round trip is a byte-for-byte no-op, and a
 * rule moves only where the baseline reproduces the document's own) is a fact
 * about construction rather than resemblance.
 *
 * ── ⛓⛓ WHAT IS DIFFERENT, AND WHY THIS FILE IS SHORTER ────────────────
 *
 *   · **NO LIBRARY.** The maze's `open` builds a one-entry REGION LIBRARY
 *     because the maze lab's set arm edits one. The text adventure has no
 *     `roomEditor` (Edit ▸ still says so, by name), so nothing here needs a
 *     library entry and none is built — `session` is a placeholder no editor
 *     consumes yet (see `open`).
 *   · **NO RE-STAMP.** The maze's library capture strips instance identity
 *     (exit targets, baked location names), so its `save` puts it back keyed
 *     on geometry. A text-adventure ROOM carries its identity itself: every
 *     exit record is the envelope's own (`targetRegion`, `isBackExit`, …) and
 *     every location is named by its AP `name` (`deserializeTextAdventureRoom`
 *     reads `name` as both `id` and `name`; `extractTextAdventureRules` hands
 *     it on as `global_name`; `compileRegion` keeps it). Nothing is lost on the
 *     way in, so nothing is restored on the way out.
 *   · **THE ENVELOPE RE-APPEND IS THE ONE THING `save` ADDS.**
 *     `serializeTextAdventureRoom` writes `{exits, exitGates, locations}` and
 *     never the keys the ENGINE stamps after it (`fogEnabled` always,
 *     `manaEnabled` under loop mode). Those are re-appended from the original
 *     payload in the original's own order — written as "whatever the original
 *     had and the serializer does not", the maze's rule, so a serializer that
 *     stops emitting a key cannot lose it silently either.
 *
 * ⚖ **SYNC MEMBERS.** The maze's are sync, bounce's async (a dynamic import to
 * break a cycle through `buildEditedRegion.js`). Nothing here cycles:
 * `textAdventureRoom.js` is node-importable and imports no library, so a
 * static import keeps the declaration DATA and the hub awaits either shape.
 */

import { DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import { compileRegion } from '../shared/procgen/pathsAndObstaclesCompiler.js';
import {
    deserializeTextAdventureRoom,
    extractTextAdventureRules,
    serializeTextAdventureRoom,
} from './textAdventureRoom.js';

/**
 * ⛓⛓ **THE OPEN.** The room, deserialized from the region's payload — which
 * REFUSES anything that is not a room by its own sentence (the tile grid's
 * keys, a missing `exitGates`), so the hub reports *"text_adventure refused
 * this region's payload — …"* rather than reading a maze as an empty room.
 *
 * ⚖ OPEN — `session` is a PLACEHOLDER in G2b-1: no `roomEditor` consumes it.
 * A `kind: 'panel'` editor (bounce's shape: `open({...session, onSave})`)
 * would want the room itself plus what the payload does not carry and the
 * rule form needs — the document's exit targets and location items are
 * already on the room; the region's ITEM POOL (`ctx.itemPool`, for a rule
 * picker) is not, and would ride here beside the room.
 *
 * ⛔ Deserialized TWICE, not aliased: an editor mutating `session.record.world`
 * must not move the baseline `unedited` the hub keeps on its inspection.
 */
function open({ payload }) {
    return {
        session: { record: { world: deserializeTextAdventureRoom(payload) }, room: 0 },
        unedited: { world: deserializeTextAdventureRoom(payload) },
    };
}

/**
 * ⛓⛓ **THE SAVE.** `saved` is `{world}` — the room as the reader left it.
 * Serialized through the substrate's own writer, the engine-stamped envelope
 * keys re-appended, and the rules compiled from the room's AUTHORED gates.
 * Locations answer with the AP name the room carries, so the hub maps every
 * endpoint by the document's own name.
 */
function save(saved, { regionId, payload }) {
    const world = saved?.world;
    if (!world || typeof world !== 'object' || !(world.exits instanceof Map)
        || !Array.isArray(world.locations)) {
        throw new Error('textAdventureRegionRoundTrip: the save carried no text-adventure room '
            + `(\`world\` with an \`exits\` Map and a \`locations\` array) for "${regionId}" — got `
            + `${JSON.stringify(saved && Object.keys(saved))}.`);
    }
    const extracted = extractTextAdventureRules(world, { regionId });
    const next = serializeTextAdventureRoom(world, extracted);
    for (const [k, v] of Object.entries(payload ?? {})) if (!(k in next)) next[k] = structuredClone(v);
    const compiled = compileRegion(extracted, { obstacleLib: DEFAULT_OBSTACLES });
    const locations = compiled.locations.map((l) => (l.global_name ? { ...l, name: l.global_name } : l));
    return { payload: next, exits: compiled.exits, locations };
}

/** ⛓ The declaration the registry entry carries. ⛔ DATA, like `exitSides`. */
export const textAdventureRegionRoundTrip = Object.freeze({ open, save });

export default textAdventureRegionRoundTrip;
