/**
 * seedlingDemo/seedlingGenRegionRoundTrip — **A GENERATED SEEDLING ROOM ⇄ THE
 * SEEDLING LAB'S EDIT ARM**, declared on the `flash_seedling_gen` registry entry
 * beside `roomEditor` (region-editor-launch S2; ⚖ the user, 2026-10-19, Q3).
 *
 * The shape is `mazeRegionRoundTrip`'s: `open(ctx)` builds the document the room
 * editor wants and the value its save would carry for a session nobody touched;
 * `save(saved, ctx)` reads the editor's save back into `{payload, exits,
 * locations}`. Both the APWorld Editor's Edit ▸ and the pipeline's
 * (`procgenPipeline/pipelineRoomEdit.js`) call it through the registry.
 *
 * ── ⛓⛓ WHAT THE READER SEES: THE ROOM AS IT PLAYS ─────────────────────
 *
 * The sidecar keeps the BARE generated record — no door entities, no `apitem`s;
 * the play-time assembler (`seedlingGeneratedSet`) adds both. A reader editing
 * the bare record could not see where the doors and the AP locations are, and
 * would wall one off without knowing. So `open` hands the lab a ONE-ROOM LEVEL
 * SET whose room carries both, exactly as the assembler places them, and `save`
 * takes them out again.
 *
 * ⛔ **DOORS AND AP LOCATIONS DO NOT MOVE HERE.** Their cells are the world's
 * (an exit's `entrance_spawn` is where a neighbour's door lands the player; a
 * location's tag is its AP identity), so a save that moved, removed or added a
 * door or an `apitem` is REFUSED BY NAME, as is a resize. Tiles, and every other
 * entity, are the reader's.
 *
 * ⛓ **THE RULES ARE CARRIED, NOT DERIVED.** A generated room's access rules come
 * from the world (`extractGenRules` copies them), not from its tiles, so an edit
 * moves no rule. What an edit CAN break is the generator's guarantee that the
 * goal and every location are reachable with the doors as walls — so a CHANGED
 * room is re-certified with the generator's own oracle (`certifyGenRoom`) and the
 * verdict is stamped on `generation.edited`. ⚖ A failing room is SAVED and
 * FLAGGED, never refused: editing is free, certification is the guard.
 *
 * ⛓ An UNEDITED save returns the payload it was given, byte for byte (the hub's
 * baseline, `apworldEditor/regionRoundTrip.js`).
 */

import { buildLevelSet } from './levelSetExporter.js';
import { emitDoorEntities } from './levelSetExits.js';
import { AP_ITEM_TYPE, AP_LOOK } from './apPlacementRewriter.js';
import { GEN_ROOM_TILE_SIZE, deserializeGenRoom } from './seedlingGenRoomPayload.js';
import { certifyGenRoom, extractGenRules } from './seedlingGenRoom.js';
import { stableStringify } from '../procgenCore/contentIdentity.js';

const cellPx = (cell) => ({ x: cell.tx * GEN_ROOM_TILE_SIZE, y: cell.ty * GEN_ROOM_TILE_SIZE });
const key = (e) => stableStringify(e);
/**
 * ⛓ An entity's comparable form. `buildLevelSet` writes every OEL attribute as a
 * STRING (`tag: 0` → `"0"`, measured), so the payload's entities and the set's
 * differ in type and not in meaning; entities are compared with their attribute
 * values stringified.
 */
const entityKey = (e) => stableStringify({
    ...e,
    attrs: Object.fromEntries(Object.entries(e?.attrs ?? {}).map(([k, v]) => [k, String(v)])),
});

/** ⛓ The refusals, in one place, each a sentence for the reader. */
export const GEN_ROUND_TRIP_REFUSALS = Object.freeze({
    noRoom: (regionId, got) => `the Seedling lab's save carried no room for "${regionId}" `
        + `(\`set.rooms[0].source\` of kind \`record\`) — got ${got}.`,
    resized: (regionId, was, now) => `"${regionId}" was resized (${was.width}×${was.height} → `
        + `${now.width}×${now.height}). A generated room keeps its size here: its doors and `
        + 'locations are placed on cells of the world, so resizing is not supported from this door.',
    marker: (regionId, what) => `in "${regionId}" ${what}. Doors and AP item locations are the `
        + 'world\'s and stay where the generator put them; edit the tiles and other entities around them.',
});

/** The room as the assembler would play it: AP items on location cells, then the doors. */
function roomAsPlayed(payload) {
    const entities = [...(payload.record.entities ?? [])];
    for (const loc of payload.locations) {
        const { x, y } = cellPx(loc.cell);
        const item = { type: AP_ITEM_TYPE, x, y, attrs: { tag: String(loc.tag), look: AP_LOOK } };
        const at = entities.findIndex((e) => e.x === x && e.y === y);
        if (at < 0) entities.push(item);
        else entities[at] = item;
    }
    // ⛓ A one-room set: every door leads back into this room, at its own arrival.
    const doors = payload.exits.map((e) => ({
        cell: { tx: e.exit_tiles[0][0], ty: e.exit_tiles[0][1] },
        to: 0,
        arrival: { x: e.entrance_spawn.x, y: e.entrance_spawn.y },
        sign: 0,
    }));
    return emitDoorEntities({ ...payload.record, entities }, doors);
}

/** ⛓ The door and AP-item entities of a played room — the ones a save may not move. */
function markersOf(record, payload) {
    const doorPx = new Set(payload.exits.map((e) => key(cellPx({ tx: e.exit_tiles[0][0], ty: e.exit_tiles[0][1] }))));
    const locPx = new Set(payload.locations.map((l) => key(cellPx(l.cell))));
    return (record.entities ?? []).filter((e) => (e.type === AP_ITEM_TYPE && locPx.has(key({ x: e.x, y: e.y })))
        || (e.type === 'teleporter' && doorPx.has(key({ x: e.x, y: e.y }))));
}

function open({ regionId, payload }) {
    const played = roomAsPlayed(payload);
    const start = payload.exits.length > 0 ? payload.exits[0].entrance_spawn : cellPx(payload.start);
    const { set } = buildLevelSet([{ record: played, name: regionId }], {
        link: false,
        setId: `seedling-gen-edit-${regionId}`,
        start: { level: 0, x: start.x, y: start.y },
        menuRooms: [0],
        generator: 'seedlingDemo/seedlingGenRegionRoundTrip.js',
        provenance: { region: regionId },
    });
    return {
        session: { record: set, room: 0 },
        unedited: { set, overlay: {} },
    };
}

/** Multiset difference by stable key: the items of `a` not matched in `b`. */
function minus(a, b) {
    const left = new Map();
    for (const e of b) left.set(entityKey(e), (left.get(entityKey(e)) ?? 0) + 1);
    const out = [];
    for (const e of a) {
        const k = entityKey(e);
        if (left.get(k) > 0) left.set(k, left.get(k) - 1);
        else out.push(e);
    }
    return out;
}

/**
 * ⛓ The edited PLAYED room → the bare record the sidecar keeps. Tiles come from
 * the edit (the payload's own when unchanged, so an unedited save is byte-equal);
 * entities are the payload's own, minus what the reader removed, plus what they
 * added — markers excluded, and refused if they moved.
 */
function bareRecordOf(edited, payload, regionId) {
    const opened = roomAsPlayed(payload);
    if (edited.width !== opened.width || edited.height !== opened.height) {
        throw new Error(GEN_ROUND_TRIP_REFUSALS.resized(regionId, opened, edited));
    }
    const was = markersOf(opened, payload);
    const now = markersOf(edited, payload);
    const lost = minus(was, now);
    const gained = minus(now, was);
    const strayDoor = (edited.entities ?? []).some((e) => e.type === 'teleporter') && minus(
        (edited.entities ?? []).filter((e) => e.type === 'teleporter'), was).length > 0;
    const strayItem = minus((edited.entities ?? []).filter((e) => e.type === AP_ITEM_TYPE), was).length > 0;
    if (lost.length || gained.length || strayDoor || strayItem) {
        const what = lost.length ? `${lost.length} door/AP item(s) were moved or removed`
            : 'a door or AP item was added';
        throw new Error(GEN_ROUND_TRIP_REFUSALS.marker(regionId, what));
    }
    const notMarkers = (r) => (r.entities ?? []).filter((e) => !markersOf({ entities: [e] }, payload).length);
    const removed = minus(notMarkers(opened), notMarkers(edited));
    const added = minus(notMarkers(edited), notMarkers(opened));
    const entities = [...minus(payload.record.entities ?? [], removed), ...added];
    const sameLayers = key(edited.layers) === key(opened.layers);
    return {
        ...payload.record,
        layers: sameLayers ? payload.record.layers : structuredClone(edited.layers),
        entities: removed.length || added.length ? entities : payload.record.entities,
    };
}

function save(saved, { regionId, payload }) {
    const source = saved?.set?.rooms?.[0]?.source;
    const edited = source?.record;
    if (!edited || typeof edited !== 'object') {
        throw new Error(GEN_ROUND_TRIP_REFUSALS.noRoom(regionId,
            JSON.stringify(source ? Object.keys(source) : (saved && Object.keys(saved)))));
    }
    const record = bareRecordOf(edited, payload, regionId);
    let next = payload;
    if (key(record) !== key(payload.record)) {
        const cert = certifyGenRoom({ ...payload, record }, regionId);
        next = {
            ...payload,
            record,
            generation: {
                ...payload.generation,
                // ⛓ The seed and knobs no longer describe this room; say so, with
                //   the oracle's verdict on it.
                edited: cert.certified ? { certified: true }
                    : { certified: false, failures: cert.failures },
            },
        };
    }
    const rules = extractGenRules(deserializeGenRoom(next), { regionId });
    return {
        payload: next,
        exits: rules.exits.map((e) => ({ id: e.id, name: e.id, rule: e.access_rule })),
        locations: rules.locations.map((l) => ({ id: l.id, name: l.global_name ?? l.id, rule: l.access_rule })),
    };
}

/**
 * ⛓ The certification an edited payload carries, or `null` for a room nobody
 * edited — what the pipeline row and Compile read.
 */
export const genRoomEditOf = (payload) => payload?.generation?.edited ?? null;

/** ⛓ The declaration the registry entry carries. ⛔ DATA, like `roomEditor`. */
export const seedlingGenRegionRoundTrip = Object.freeze({ open, save });

export default seedlingGenRegionRoundTrip;
