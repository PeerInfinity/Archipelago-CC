/**
 * seedlingDemo/seedlingSetAdapter — **THE LEVEL SET AS AN `editCore` ADAPTER,
 * AND THE SESSION THAT OWNS ITS IDENTITY** (EDITOR v3 slice D1; plan §16.3,
 * §16.4, §19.10; ⚖ RULED by the user 2026-08-25).
 *
 * ── ⛓⛓⛓ THE RECORD IS `{set, overlay}` AND THE ATLAS IS NEITHER ──────────
 *
 * §16.3's ruling: an atlas's regions, boundary exits and connections are a
 * FUNCTION of the rooms (`seedlingAtlasDerivation.deriveAtlas`), and only three
 * things are AUTHORED — locations, the access rules the analyzer cannot derive,
 * and names. ⇒ the document a set session edits is
 *
 *     record = Object.freeze({ set, overlay })
 *
 * where `set` is a schema-v1 level set and `overlay` is the JSON in
 * `seedlingSetOverlay.js`. **The atlas is not in the record**: it is
 * `deriveAtlasOf(record, deps)`, rebuilt on demand, so no op has to keep it in
 * step and no undo has to unwind it. `rules.json` is one step further out —
 * `compileRegionAtlas` of the derived atlas — which is the user's own ruling
 * that *the editor writes an atlas and rules.json is compiled*.
 *
 * ── ⛓⛓ ROOMS ARE A **ONE-ROW GRID**, AND THAT IS A DECISION ──────────────
 *
 * `bounds(record) = {w: rooms.length, h: 1}`. Three reasons, in order of weight:
 *
 *  1. **It is HONEST about the core's model.** `editCore`'s bounds, clip, paste
 *     and flood are all expressed over a rectangle of CELLS, and a set really is
 *     a one-dimensional, positionally-addressed list — the schema says so out
 *     loud (*"Position is identity"*), which is exactly why a `reorder` has to
 *     rewrite every `@to`. Pretending it were 2-D would invent an axis with no
 *     meaning, and `assertAdapterBehaviour`'s law 7 would then be writing a room
 *     descriptor to a coordinate the substrate cannot name.
 *  2. **`rectCopy`/`rectPasteOps` become ROOM COPY between sets for free.** A
 *     clip of `{x: 2, y: 0, w: 3, h: 1}` is three rooms with their overlays, and
 *     pasting it into another set's session is the core's own code with no new
 *     op. That is the whole reason the core has a cell descriptor.
 *  3. It costs nothing: `h` is `1`, `y` is always `0`, and a `y !== 0` is
 *     REFUSED BY NAME rather than folded away, so a caller that thought the grid
 *     were 2-D finds out at the first write instead of at the readback.
 *
 * ⛔ **A PASTE PAST THE END IS A REFUSAL, NOT AN IMPLICIT `add-room`.** The
 * brief proposed the append; MEASURED, it cannot be written: `writeOps(desc, x,
 * y)` is handed a DESCRIPTOR and two coordinates and never sees the record, so
 * it cannot know where the end is. `rectPasteOps` clips to `bounds` before
 * calling it, so the case only arises from a hand-built op list — and there
 * `replace-room` refusing room N of an N-room set by name is a better
 * answer than an append the caller did not ask for. Growing a set is
 * `add-room {at}`, deliberately.
 *
 * ── ⛓⛓⛓ ONE STAMP PER WRITE, AND THE RECORD IS NEVER STAMPED ─────────────
 *
 * C2's residue (§13.10): *"the download re-stamps, so every write changes the
 * `set_id`"* — five edits either produce five ids, four of which nobody ever
 * saw, or one. This slice closes it BY CONSTRUCTION rather than by policy:
 *
 *   ·  the session's identity is `payload() = {base, edits, certified}` —
 *      `base` is the tag `{kind:'set', set_id, overlay_id}` and the edits are
 *      the ops. Nothing in it is a hash of the document.
 *   ·  **no op stamps.** `stampLevelSetIdentity` is called in exactly ONE place
 *      in this file, `downloadSet`, on the folded set, once. A mutant that
 *      stamps inside an op turns five edits into five ids and the row goes red.
 *   ·  **the derived atlas is never stamped at all** (§19.10 hard #1;
 *      `contentIdentity` is load-bearing for ten committed ids and `deriveAtlas`
 *      hands back an unstamped document on purpose).
 *
 * The model is `levelSetExits.retargetLevelSet`'s own re-stamp: `provenance` is
 * COPIED, never shared, because `stampLevelSetIdentity` writes into the object
 * it is given and a shallow spread would stamp the CALLER's set with the
 * output's hash.
 *
 * ── ⛔ WHAT THIS ADAPTER DOES NOT DECIDE ─────────────────────────────────
 *
 * **Cross-room uniqueness is `levelSetValidator`'s, not an op's.** A
 * `set-room-field name` may write a name another room already has, and
 * `downloadSet` REFUSES the set for it by quoting the validator. That is not
 * laxity: `assertAdapterBehaviour`'s law 7 writes a room's whole descriptor to a
 * DIFFERENT cell, so an op that refused a duplicate name would make the core's
 * own contract unsatisfiable — and two authorities for one rule is how the two
 * come to disagree.
 */

import {
    canonicalJson, createEditSession, foldEdits, group,
} from '../procgenCore/editCore.js';
import { stampIdentity } from '../procgenCore/contentIdentity.js';
import { ruleSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
import { replaceRuleAt } from '../procgenCore/ruleTreeOps.js';
/**
 * ⛓⛓ **ONE READING OF GATEABILITY, TWO READERS** (E3b, §21.2). The REPORT's
 * inert-rule row already asks `gateabilityOf`; from this slice the OP asks the
 * same function over the same derived atlas, so the two cannot disagree about
 * which endpoint a rule can reach.
 */
import { gateabilityOf } from '../procgenCore/setEditorCore.js';
import { applyOverlayRules, deriveAtlas } from './seedlingAtlasDerivation.js';
import {
    REGION_NONE, removeExitFromRecord, removeExitFromRoomXml, retargetRoomRecord,
    retargetRoomXml, signForTransition,
} from './levelSetExits.js';
import { apMappingInvalidation } from './levelSetExporter.js';
import {
    LEVEL_SET_SCHEMA_VERSION, MUSIC_COUNT, MUSIC_NONE, NAMED_ROOMS,
    coreLevelRecord, indexOfRoom, roomRecordOf, roomSourceKind,
    stampLevelSetIdentity, validateLevelSet,
} from './levelSetValidator.js';
import {
    assertOverlay, emptyOverlay, exitRuleKey, exitRulesByRoom, locationRuleKey,
    overlayErrors, overlayLocationNames, overlayToDeriveInput, parseRuleTarget, renumberOverlay,
} from './seedlingSetOverlay.js';

export class SeedlingSetAdapterError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SeedlingSetAdapterError';
    }
}

const fail = (message) => { throw new SeedlingSetAdapterError(message); };

/**
 * ⛓⛓⛓ **THE FOURTH REFUSAL CLASS — A DERIVATION FAILURE IS DATA, NOT A DEFECT.**
 *
 * EDITOR v3 E3b, §21.11 #2. `deriveAtlas` throws a plain `Error` for a set the
 * author has not finished — a collectible in a room no door reaches ("lost
 * collectible"), a room with no integer level, a `neverEnter` fact that
 * contradicts the doors. Those are legitimate DATA conditions, and until this
 * slice they were neither of `apply`'s three names, so they were RETHROWN and
 * took the page's arm down.
 *
 * ⛔ **THE WRAP IS AT `deriveAtlasOf`, NOT AT `apply`,** because `deriveAtlasOf`
 * is called from BOTH sides: inside an op (through `apply`) and outside it, by
 * `roomRowsOf`/`reportOver` through the substrate's `isRefusal`. Wrapping at the
 * one derivation door is what makes both readers see the SAME class — wrapping
 * inside `apply` would have left the readout's reader still holding a bare
 * `Error`.
 *
 * ⚠ **THE NET DID NOT WIDEN.** Only a plain `Error` out of `deriveAtlas` /
 * `applyOverlayRules` is wrapped; a `TypeError` still escapes both catches,
 * exactly as `apply`'s docblock promises, and a row pins that.
 */
export class SeedlingSetDeriveRefusal extends Error {
    constructor(message, cause) {
        super(message, { cause });
        this.name = 'SeedlingSetDeriveRefusal';
    }
}

/** The manifest fields `set-field` may write. A path outside this is refused. */
export const SET_FIELDS = Object.freeze(['name', 'description', 'start', 'menu_rooms', 'named_rooms']);

/** The per-room fields `set-room-field` may write. ⛔ NOT `id` (position IS identity) and NOT `source`. */
export const ROOM_FIELDS = Object.freeze(['name', 'music', 'music_override_exempt', 'snow_gradient']);

/** Every op kind this adapter understands, sorted. The refusals read this. */
export const SET_OP_KINDS = Object.freeze([
    'add-room', 'connect', 'disconnect', 'mark-location', 'remove-room', 'reorder',
    'replace-room', 'set-access-rule', 'set-field', 'set-overlay', 'set-room-field',
    'unmark-location',
].sort());

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const frozenRecord = (set, overlay) => Object.freeze({ set, overlay });

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ THE DERIVATION, FROM A RECORD
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓⛓ **§19.5's ONE LINE, IN ONE PLACE.**
 *
 * `deriveAtlas` needs `{level, width, height, layers, entities}` per room and a
 * parsed `.oel` carries every one of those but `level` — a parsed room does not
 * know its own index, the SET does. D0b measured that this is the ONLY
 * difference between the two input shapes, and §19.10 hard #4 named the risk:
 * *the one line is one line only while the two shapes agree, and there is no
 * gate today that would catch a NEW divergence.* This is that single place, and
 * `seedlingSetAdapter.test.js`'s field-census row is that gate.
 */
export function roomsOfSet(set, parseOel) {
    if (typeof parseOel !== 'function') {
        fail('seedlingSetAdapter: deriving an atlas needs a `parseOel`, and none was injected. '
            + 'The OEL parser lives in `scripts/procgen/seedlingOgmo.js` and no module under '
            + '`frontend/` imports anything under `scripts/` — the direction is scripts → '
            + 'frontend, every time (`seedlingEditAdapter.js`\'s own note).');
    }
    // ⛓⛓ EDITOR v3 E1b — ONE NORMALISER. `roomRecordOf` resolves all three
    // source kinds and REFUSES an unreadable `embed` by name; a `record` room
    // costs no parse at all, which is what the ruling was for.
    return (set?.rooms ?? []).map((room, level) => ({
        ...roomRecordOf({ ...room, id: room?.id ?? level }, { parseOel }), level,
    }));
}

/**
 * ⛓ THE ATLAS OF A RECORD — derive from the rooms, then write the overlay's
 * authored EXIT rules onto it.
 *
 * ⚠ `resolveCondition` DEFAULTS TO THE IDENTITY here and that is deliberate:
 * the vanilla build's guards name a CONDITION its own script resolves, while an
 * editor's author has already typed the rule tree. A caller with a condition
 * vocabulary of its own may still inject one.
 *
 * @returns {{atlas, dropped, stats, rulesApplied}} the atlas UNSTAMPED
 */
export function deriveAtlasOf(record, deps = {}) {
    const rooms = roomsOfSet(record.set, deps.parseOel);
    /**
     * ⛔ **THE ONE DOOR THE DERIVATION'S DATA REFUSALS COME THROUGH** (E3b,
     * §21.11 #2). `deriveAtlas` and `applyOverlayRules` throw a plain `Error`
     * for a set the author has not finished; `SeedlingSetDeriveRefusal` is the
     * class that makes that a REFUSAL both `apply` and the readout can name.
     *
     * ⚠ `err.constructor === Error` and not `instanceof Error`: a `TypeError`
     * IS an `Error`, and re-labelling one as a data condition is exactly the
     * widening the fourth class was written not to do.
     */
    let derived;
    try {
        derived = deriveAtlas(rooms, overlayToDeriveInput(record.overlay), {
            resolveCondition: (condition) => condition,
            ...deps,
        });
        const { atlas, applied } = applyOverlayRules(derived.atlas, exitRulesByRoom(record.overlay));
        return { ...derived, atlas, rulesApplied: applied };
    } catch (err) {
        if (err?.constructor !== Error) throw err;
        throw new SeedlingSetDeriveRefusal(
            `seedlingSetAdapter: this set cannot be DERIVED as it stands — ${err.message}`, err,
        );
    }
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ RENUMBERING — the ONE machine behind `reorder`, `add-room`, `remove-room`
 * ══════════════════════════════════════════════════════════════════════ */

const roomRegion = (overlay, index) => {
    const r = overlay?.regions?.[index];
    return Number.isInteger(r) ? r : REGION_NONE;
};

/**
 * ⛓⛓⛓ **REBUILD A SET UNDER A ROOM RENUMBERING.**
 *
 * `mapping` is `oldIndex -> newIndex | null`; `nextRooms` is the new `rooms[]`
 * already in its final order, holding the OLD room objects. Everything that
 * names a room by index is rewritten HERE, in one place, because a renumbering
 * that missed one of them produces a set that still validates and sends the
 * player somewhere else:
 *
 *   ·  every `@to` on a `<teleporter>`/`<stairsup>`/`<stairsdown>`
 *   ·  **every `@fallthrough` on a `<control>`** — the pit destination. ⚠ It is
 *      a SEPARATE list in `retargetRoomXml` and a separate ordinal space; a
 *      rewrite that did the exits and forgot the pits is the mutant this
 *      slice's chain row is built to catch.
 *   ·  `rooms[].id` (position IS identity)
 *   ·  `start.level`, every `menu_rooms` entry, every `named_rooms[*].level`
 *   ·  the overlay's room keys, `neverEnter` and `regions`
 *
 * ⛓ `sign` is recomputed from `signForTransition(region(newFrom),
 * region(newTo))` on every rewritten transition, never carried: `sign` is a
 * property of the TRANSITION (`levelSetExits.js`'s header, measured over all
 * 292 vanilla transitions), so a permuted set that kept its old signs would
 * announce the region of the room the player did NOT go to.
 *
 * ⚠ `playerx`/`playery` are KEPT. A renumbering relabels rooms; the geometry
 * inside each room is the same geometry, so the arrival that was correct still
 * is (`retargetLevelSet`'s docblock makes the same call for the same reason).
 */
function renumberSet(set, overlay, plan, mapping) {
    const remap = (i) => {
        const to = mapping.get(i);
        return to === null || to === undefined ? null : to;
    };
    const rooms = plan.map(({ room, from }, newIndex) => {
        /**
         * ⛔⛔ **A BRAND-NEW ROOM'S `@to`s ARE ALREADY IN NEW COORDINATES.**
         * `from === null` means this room did not exist before the edit, so its
         * exits were authored against the set this edit MAKES and remapping
         * them through an old → new table would move every one of them. Measured
         * the hard way: `add-room` with a wired room sent its exits one room too
         * far the first time this function was written.
         */
        if (from === null) return room.id === newIndex ? room : { ...room, id: newIndex };
        const doc = indexOfRoom(room);
        if (doc === null) {
            // ⛔ NAMED, NOT SKIPPED — `retargetLevelSet`'s own rule. An
            // embed-sourced room's exits are invisible here and leaving them
            // pointing at the old layout is the graceful-skip failure.
            fail(`seedlingSetAdapter: room ${newIndex} ${JSON.stringify(room?.name ?? '')} is `
                + 'EMBED-sourced, so its exits cannot be read and a renumbering cannot '
                + 'rewrite them. A set with embed rooms can be HELD but not reordered.');
        }
        const exits = [];
        const fallthroughs = [];
        doc.exits.forEach((ex, index) => {
            const to = remap(ex.to);
            if (to === null) {
                fail(`seedlingSetAdapter: room ${newIndex} exit ${index} targets room ${ex.to}, `
                    + 'which this edit removes and nothing retargets');
            }
            if (to === ex.to) return;
            /**
             * ⛓ **THE REGIONS ARE READ IN OLD COORDINATES.** `overlay.regions`
             * is re-keyed at the END of this function; during the rewrite it is
             * still indexed by the OLD room ids, and `ex.to` is an old id too.
             * Reading it by `newIndex` would give a permuted set every room's
             * neighbour's region and announce the wrong doorway.
             */
            exits.push({
                index,
                to,
                sign: signForTransition(roomRegion(overlay, from), roomRegion(overlay, ex.to)),
            });
        });
        doc.fallthroughs.forEach((f, index) => {
            const to = remap(f.to);
            if (to === null) {
                fail(`seedlingSetAdapter: room ${newIndex} fallthrough ${index} targets room `
                    + `${f.to}, which this edit removes and nothing retargets`);
            }
            if (to === f.to) return;
            fallthroughs.push({
                index,
                to,
                sign: signForTransition(roomRegion(overlay, from), roomRegion(overlay, f.to)),
            });
        });
        const next = (exits.length === 0 && fallthroughs.length === 0)
            ? room
            : retargetRoomInKind(room, { exits, fallthroughs });
        return (next === room && room.id === newIndex) ? room : { ...next, id: newIndex };
    });

    const next = { ...set, rooms };
    const spawn = (value, where) => {
        if (!isPlainObject(value)) return value;
        const to = remap(value.level);
        if (to === null) {
            fail(`seedlingSetAdapter: ${where} names room ${value.level}, which this edit removes`);
        }
        return to === value.level ? value : { ...value, level: to };
    };
    if (isPlainObject(set.start)) next.start = spawn(set.start, 'start');
    if (Array.isArray(set.menu_rooms)) {
        next.menu_rooms = set.menu_rooms.map((i, at) => {
            const to = remap(i);
            if (to === null) {
                fail(`seedlingSetAdapter: menu_rooms[${at}] names room ${i}, which this edit `
                    + 'removes. ⚠ menu_rooms must never be empty — Game.as:1294 advances '
                    + '`menuIndex = (menuIndex + 1) % menuLevels.length` and a zero-length '
                    + 'array makes that index NaN.');
            }
            return to;
        });
    }
    if (isPlainObject(set.named_rooms)) {
        next.named_rooms = Object.fromEntries(Object.entries(set.named_rooms)
            .map(([key, value]) => [key, spawn(value, `named_rooms.${key}`)]));
    }
    const { overlay: nextOverlay, dropped } = renumberOverlay(overlay, mapping);
    return { set: next, overlay: nextOverlay, droppedOverlays: dropped };
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE OPS — every one PURE, every refusal BY NAME
 * ══════════════════════════════════════════════════════════════════════ */

const requireRoom = (record, index, what) => {
    const rooms = record.set?.rooms ?? [];
    if (!Number.isInteger(index) || index < 0 || index >= rooms.length) {
        fail(`seedlingSetAdapter: ${what} names room ${JSON.stringify(index)}; this set has `
            + `${rooms.length} (0..${rooms.length - 1}). ⚠ A room id IS its position in `
            + '`rooms[]` — the schema\'s own rule, which is why a reorder rewrites every `@to`.');
    }
    return rooms[index];
};

/**
 * ⛓⛓⛓ **EDITOR v3 E1b — A ROOM'S INDEX, IN WHATEVER KIND IT IS.**
 * `indexOfRoom` is `parseRoomXml` for the two TEXT kinds and `indexRoom` for
 * the RECORD kind; `null` is the answer for a room nothing here can read, and
 * this is where that becomes a refusal BY NAME.
 */
const indexedRoom = (record, index, what) => {
    const room = requireRoom(record, index, what);
    const doc = indexOfRoom(room);
    if (doc === null) {
        fail(`seedlingSetAdapter: ${what} needs room ${index}'s level document and it is `
            + `EMBED-sourced (${room?.source?.embed ?? JSON.stringify(room?.source)}). An `
            + '`embed` is a path into a SWF\'s `[Embed]` table; this module has no embeds, so '
            + 'the room is a document the session can HOLD but not EDIT — the same refusal '
            + '`seedlingEditAdapter`\'s `set-room` base makes one layer down.');
    }
    return { room, kind: roomSourceKind(room.source), doc };
};

/**
 * ⛓⛓⛓ **THE KIND OF A ROOM'S DOCUMENT IS THE AUTHOR'S, AND NO EDIT CONVERTS
 * IT** (plan §22.8's additive rule, PINNED by
 * `seedlingSetAdapter.test.js`'s "an edit never converts a kind" row).
 *
 * ⛔ A retarget of a legacy `xml` room happens AS TEXT — `retargetRoomXml`,
 * byte-preserving — and a retarget of a `record` room happens on
 * `entities[].attrs`. Converting on touch would silently rewrite a document the
 * author chose the form of, and would move the set's content hash for a reason
 * nobody asked for.
 */
function retargetRoomInKind(room, edits) {
    const kind = roomSourceKind(room?.source);
    if (kind === 'record') {
        const { record } = retargetRoomRecord(room.source.record, edits);
        return record === room.source.record
            ? room : { ...room, source: { ...room.source, record } };
    }
    if (kind === 'xml') {
        const { xml } = retargetRoomXml(room.source.xml, edits);
        return xml === room.source.xml ? room : { ...room, source: { ...room.source, xml } };
    }
    fail(`seedlingSetAdapter: room ${room?.id} ${JSON.stringify(room?.name ?? '')} is `
        + 'EMBED-sourced, so its exits cannot be rewritten here.');
    return room;
}

/** Unwire one exit of a room, IN ITS OWN KIND. §20.5: an unwired exit is DELETED. */
function removeExitInKind(room, exitIndex) {
    const kind = roomSourceKind(room?.source);
    if (kind === 'record') {
        const { record, removed } = removeExitFromRecord(room.source.record, exitIndex);
        return { room: { ...room, source: { ...room.source, record } }, removed };
    }
    const { xml, removed } = removeExitFromRoomXml(room.source.xml, exitIndex);
    return { room: { ...room, source: { ...room.source, xml } }, removed };
}

/**
 * ⛓ A room `source` built from an op payload. ⛔ ONE OP, TWO DOORS: the payload
 * arrives as `{record}` or as `{xml}` and is STORED IN THE KIND IT ARRIVED IN —
 * an author who pastes OEL gets an `xml` room and an author who hands a record
 * gets a `record` room, and neither is quietly turned into the other.
 */
function sourceFromPayload(what, { record: rec, xml }) {
    const hasRecord = isPlainObject(rec);
    const hasXml = typeof xml === 'string' && xml !== '';
    if (hasRecord === hasXml) {
        fail(`seedlingSetAdapter: ${what} needs exactly one of \`record\` (a `
            + '`{width, height, layers, entities}` level record) or `xml` (OEL text), got '
            + `${hasRecord ? 'both' : 'neither'}`);
    }
    /**
     * ⛔ **`coreLevelRecord` AND NOT THE PAYLOAD AS HANDED IN**, at every door a
     * record enters a set by. A ROOM SESSION's fold carries `level`, `class` and
     * `path` (the base's provenance) and `closeRoomSession` hands that straight
     * over — storing it would put a SECOND authority for the room's index into
     * a document whose whole rule is that POSITION IS IDENTITY. It also
     * normalises attribute values to strings, which is what makes the stored
     * record survive the render at the chunk boundary by value (see its note).
     */
    return hasRecord ? { record: coreLevelRecord(rec) } : { xml };
}

/** The index of a room built from an op payload, with the parse refusal named. */
function indexOfPayload(what, source) {
    let doc;
    try {
        doc = indexOfRoom({ id: 0, source });
    } catch (e) {
        if (!(e instanceof Error)) throw e;
        fail(`seedlingSetAdapter: ${what}'s document does not read — ${e.message}`);
    }
    if (doc === null || doc.size === null) {
        fail(`seedlingSetAdapter: ${what}'s document carries no rectangle `
            + `(${source.record ? '`record.width`/`record.height`' : '<width>/<height>'}), so it `
            + 'is not a level');
    }
    return doc;
}

const withRoomAt = (record, index, room) => frozenRecord(
    { ...record.set, rooms: record.set.rooms.map((r, i) => (i === index ? room : r)) },
    record.overlay,
);

const withOverlayRoom = (record, index, entry) => {
    const rooms = { ...record.overlay.rooms };
    if (entry === null || (isPlainObject(entry) && Object.keys(entry).length === 0)) {
        delete rooms[String(index)];
    } else {
        rooms[String(index)] = entry;
    }
    return frozenRecord(record.set, { ...record.overlay, rooms });
};

function addRoom(record, { xml, record: newRecord, name = null, music = null, at = null }) {
    const source = sourceFromPayload('add-room', { record: newRecord, xml });
    const doc = indexOfPayload('add-room', source);
    const rooms = record.set.rooms ?? [];
    const index = at === null ? rooms.length : at;
    if (!Number.isInteger(index) || index < 0 || index > rooms.length) {
        fail(`seedlingSetAdapter: add-room \`at\` is ${JSON.stringify(at)}; it must be 0..`
            + `${rooms.length} (${rooms.length} appends)`);
    }
    // ⛓ EVERY EXIT THE NEW ROOM CARRIES MUST NAME A ROOM THAT WILL EXIST, and
    // the count it is checked against is the count AFTER the insert.
    const total = rooms.length + 1;
    for (const ex of [...doc.exits, ...doc.fallthroughs]) {
        if (!Number.isInteger(ex.to) || ex.to < 0 || ex.to >= total) {
            fail(`seedlingSetAdapter: add-room's xml carries an exit to room ${ex.to}, outside `
                + `0..${total - 1} for the set this makes`);
        }
    }
    const nextRoom = {
        id: index,
        name: name ?? `Room${String(index).padStart(3, '0')}`,
        source,
        music: music ?? 0,
    };
    if (music !== null && (!Number.isInteger(music) || music < MUSIC_NONE || music >= MUSIC_COUNT)) {
        fail(`seedlingSetAdapter: add-room music ${JSON.stringify(music)} is outside `
            + `${MUSIC_NONE}..${MUSIC_COUNT - 1}`);
    }
    // Old rooms at or after `index` shift up by one; the new room is not in the
    // mapping because it has no old index.
    const mapping = new Map(rooms.map((_, i) => [i, i < index ? i : i + 1]));
    const plan = [
        ...rooms.slice(0, index).map((room, i) => ({ room, from: i })),
        { room: nextRoom, from: null },
        ...rooms.slice(index).map((room, i) => ({ room, from: index + i })),
    ];
    const { set, overlay } = renumberSet(record.set, record.overlay, plan, mapping);
    return {
        record: frozenRecord(set, overlay),
        description: `add room ${index} "${nextRoom.name}" as \`${
            roomSourceKind(source)}\` (${total} rooms)`,
    };
}

function removeRoom(record, { room, retarget = null }) {
    requireRoom(record, room, 'remove-room');
    const rooms = record.set.rooms;
    if (rooms.length === 1) {
        fail('seedlingSetAdapter: remove-room would empty the set — `rooms` is `minItems: 1` '
            + 'and a set with no level table is not a game');
    }
    // ⛔ EVERY TRANSITION INTO THE ROOM MUST BE NAMED, AND THE REFUSAL LISTS
    // THEM. A remove that silently retargeted them somewhere would move doors
    // the author never looked at.
    const cover = isPlainObject(retarget) ? retarget : {};
    const orphans = [];
    rooms.forEach((r, from) => {
        if (from === room) return;
        const doc = indexOfRoom(r);
        if (doc === null) return;
        doc.exits.forEach((ex, index) => {
            if (ex.to === room && cover[`${from}_${index}`] === undefined) {
                orphans.push(`room ${from} exit ${index}`);
            }
        });
        doc.fallthroughs.forEach((f, index) => {
            if (f.to === room && cover[`${from}_f${index}`] === undefined) {
                orphans.push(`room ${from} fallthrough ${index}`);
            }
        });
    });
    for (const [key, value] of Object.entries(cover)) {
        if (!Number.isInteger(value) || value < 0 || value >= rooms.length || value === room) {
            fail(`seedlingSetAdapter: remove-room retarget[${JSON.stringify(key)}] is `
                + `${JSON.stringify(value)}; it must be an OLD room index in 0..`
                + `${rooms.length - 1} other than ${room} (the retarget speaks in the `
                + 'coordinates the caller can see; this op maps them through the renumbering)');
        }
    }
    if (orphans.length > 0) {
        fail(`seedlingSetAdapter: remove-room ${room} would orphan ${orphans.length} `
            + `transition${orphans.length === 1 ? '' : 's'} into it — ${orphans.join(', ')}. `
            + 'Name where each goes in `retarget` (keys `<room>_<exitIndex>` and '
            + '`<room>_f<fallthroughIndex>`), or remove them first. ⛔ REFUSED rather than '
            + 'silently repointed: a door that moves without the author looking at it is the '
            + 'defect this op exists to prevent.');
    }
    const mapping = new Map();
    let next = 0;
    rooms.forEach((_, i) => {
        if (i === room) { mapping.set(i, null); return; }
        mapping.set(i, next);
        next += 1;
    });
    // The covered transitions are rewritten FIRST, in OLD coordinates, so the
    // renumbering below sees a set with no reference to the dying room.
    const patched = rooms.map((r, oldIndex) => {
        if (oldIndex === room) return null;
        const exits = [];
        const fallthroughs = [];
        for (const [key, to] of Object.entries(cover)) {
            const m = /^(\d+)_(f?)(\d+)$/.exec(key);
            if (!m || Number(m[1]) !== oldIndex) continue;
            const entry = {
                index: Number(m[3]),
                to,
                sign: signForTransition(roomRegion(record.overlay, oldIndex),
                    roomRegion(record.overlay, to)),
            };
            if (m[2] === 'f') fallthroughs.push(entry); else exits.push(entry);
        }
        if (exits.length === 0 && fallthroughs.length === 0) return { room: r, from: oldIndex };
        return { room: retargetRoomInKind(r, { exits, fallthroughs }), from: oldIndex };
    }).filter((entry) => entry !== null);
    const { set, overlay, droppedOverlays } = renumberSet(record.set, record.overlay, patched, mapping);
    const dropNote = droppedOverlays.length === 0 ? ''
        : ` (dropping the overlay of room ${droppedOverlays.join(', ')})`;
    return {
        record: frozenRecord(set, overlay),
        description: `remove room ${room} "${rooms[room].name}"${dropNote} (${set.rooms.length} rooms)`,
    };
}

/**
 * ⛓⛓⛓ **`reorder` IS ONE ATOMIC OP, NOT A GROUP** — and that is the decision
 * §16.4 asked for.
 *
 * A group is N ops and therefore N entries in the fold's `applied` list, but
 * ONE undo (the core's own rule). A permutation is one edit either way, so the
 * question is what the payload SAYS: a group would put N mechanical retargets in
 * a payload whose whole promise is *a person can count the edits in it*, and a
 * reader could not tell a reorder from N hand retargets that happen to compose
 * into one. `{op: 'reorder', order: [...]}` says what happened.
 *
 * ⚠ `order` is the NEW ARRAY IN OLD INDICES: `rooms_new[i] = rooms_old[order[i]]`.
 * The other reading (`order[i]` is where old room `i` goes) is equally natural
 * and produces the INVERSE permutation, so it is written down and pinned.
 */
function reorder(record, { order }) {
    const rooms = record.set.rooms ?? [];
    const n = rooms.length;
    const ok = Array.isArray(order) && order.length === n
        && order.every((v) => Number.isInteger(v) && v >= 0 && v < n)
        && new Set(order).size === n;
    if (!ok) {
        fail(`seedlingSetAdapter: reorder needs a PERMUTATION of 0..${n - 1}, got `
            + `${JSON.stringify(order)}. ⚠ \`order\` is the NEW array in OLD indices — `
            + '`rooms_new[i] = rooms_old[order[i]]`.');
    }
    const mapping = new Map();
    order.forEach((oldIndex, newIndex) => mapping.set(oldIndex, newIndex));
    const plan = order.map((oldIndex) => ({ room: rooms[oldIndex], from: oldIndex }));
    const { set, overlay } = renumberSet(record.set, record.overlay, plan, mapping);
    return {
        record: frozenRecord(set, overlay),
        description: `reorder ${n} rooms to [${order.join(', ')}]`,
    };
}

const exitAt = (doc, index, what) => {
    if (!Number.isInteger(index) || index < 0 || index >= doc.exits.length) {
        fail(`seedlingSetAdapter: ${what} names exit ${JSON.stringify(index)}; that room has `
            + `${doc.exits.length} exit${doc.exits.length === 1 ? '' : 's'} carrying a @to `
            + `(0..${doc.exits.length - 1}), in document order — the same ordinal `
            + '`retargetRoomXml` addresses.');
    }
    return doc.exits[index];
};

/**
 * ⛓⛓ **`connect` — AND THE ARRIVAL IS THE DESTINATION'S RETURN DOOR.**
 *
 * `to` names an EXISTING exit in the destination room, and the player lands ON
 * it. That is not a shortcut: `levelSetExits.js`'s header measures vanilla doing
 * exactly this four times (11↔3, 88↔87, 97↔37, 107↔102), and the reason it does
 * not warp-loop is a LATCH — `Game.update()` runs every entity's `check()`
 * before `super.update()`, so the portal under the player is already
 * `playerTouching` on the first frame. Landing on the return door needs no
 * second free cell and makes a two-way link symmetric by construction.
 *
 * ⛔ TWO-WAY IS THE DEFAULT AND IT RETARGETS **BOTH** ROOMS. A `connect` that
 * wrote one side would leave a set whose `reachabilityOf` and whose derived
 * atlas disagree about which rooms are entered — the mutant this slice's chain
 * row is built to catch.
 */
function connect(record, { from, to, one_way: oneWay = false, arrival = null }) {
    const pair = (v, what) => {
        if (!Array.isArray(v) || v.length !== 2) {
            fail(`seedlingSetAdapter: connect \`${what}\` is [room, exitIndex], got ${JSON.stringify(v)}`);
        }
        return v;
    };
    const [fromRoom, fromExit] = pair(from, 'from');
    const [toRoom, toExit] = pair(to, 'to');
    const a = indexedRoom(record, fromRoom, 'connect `from`');
    const b = indexedRoom(record, toRoom, 'connect `to`');
    if (fromRoom === toRoom && fromExit === toExit) {
        fail(`seedlingSetAdapter: connect joins room ${fromRoom} exit ${fromExit} to itself`);
    }
    const source = exitAt(a.doc, fromExit, 'connect `from`');
    const destination = exitAt(b.doc, toExit, 'connect `to`');
    if (arrival !== null && (!isPlainObject(arrival)
        || !Number.isInteger(arrival.x) || !Number.isInteger(arrival.y))) {
        fail(`seedlingSetAdapter: connect \`arrival\` is {x, y} in PIXELS, got ${JSON.stringify(arrival)}`);
    }
    const land = arrival ?? { x: destination.x, y: destination.y };
    const forward = {
        index: fromExit,
        to: toRoom,
        playerx: land.x,
        playery: land.y,
        sign: signForTransition(roomRegion(record.overlay, fromRoom), roomRegion(record.overlay, toRoom)),
    };
    let rooms = record.set.rooms.map(
        (r, i) => (i !== fromRoom ? r : retargetRoomInKind(r, { exits: [forward] })),
    );
    if (!oneWay) {
        const back = {
            index: toExit,
            to: fromRoom,
            playerx: source.x,
            playery: source.y,
            sign: signForTransition(roomRegion(record.overlay, toRoom), roomRegion(record.overlay, fromRoom)),
        };
        // ⚠ the BACK write reads the destination out of `rooms`, not out of
        // `b`: when both ends are in the SAME room the forward write has
        // already happened, and `retargetRoomInKind` takes the room it is
        // handed rather than a document captured earlier.
        rooms = rooms.map((r, i) => (i !== toRoom ? r : retargetRoomInKind(r, { exits: [back] })));
    }
    return {
        record: frozenRecord({ ...record.set, rooms }, record.overlay),
        description: `connect room ${fromRoom} exit ${fromExit} ${oneWay ? '→' : '↔'} room `
            + `${toRoom} exit ${toExit}, arriving at (${land.x}, ${land.y})`,
    };
}

/**
 * ⛓⛓⛓ **`disconnect` — AND SINCE E3b IT REFUSES OVER A MARKED LOCATION**
 * (§21.11 #3).
 *
 * ⛔ Seedling has no inert door, so `disconnect` DELETES the `<teleporter>` /
 * `<stairsup>` / `<stairsdown>` element. A location the overlay marked ON THAT
 * ELEMENT would then name a body the room no longer has, and every later
 * derivation refuses by name — a refusal about a room the author did not touch,
 * one edit after the edit that caused it.
 *
 * ⛔ **THE COMPARISON HAPPENS BEFORE THE REMOVAL**, because after
 * `removeExitInKind` the entity is gone and there is nothing left to compare
 * against. The exit is read through `exitAt`, whose entries carry the OEL
 * element's own `@x`/`@y` in PIXELS — the same units `mark-location` stores in
 * `overlay.rooms[room].locations[].entity` (`{type, x, y}`), so the match is
 * exact on both sides, as `findEntityInRoom`'s is.
 *
 * ⛓ THE DOOR OUT IS NAMED: `unmark-location`, which already takes the `loc:`
 * rule with it — the same sentence `mazeSetAdapter` prints (§26.6).
 */
function disconnect(record, { room, exitIndex }) {
    const { room: current, doc } = indexedRoom(record, room, 'disconnect');
    const exit = exitAt(doc, exitIndex, 'disconnect');
    const marked = (record.overlay?.rooms?.[String(room)]?.locations ?? [])
        .filter((l) => l.entity?.type === exit.element
            && l.entity?.x === exit.x && l.entity?.y === exit.y);
    if (marked.length > 0) {
        fail(`seedlingSetAdapter: room ${room} exit ${exitIndex} is the <${exit.element}> at `
            + `(${exit.x}, ${exit.y}), and the overlay has marked it as location`
            + `${marked.length === 1 ? '' : 's'} `
            + `${marked.map((l) => JSON.stringify(l.name)).join(', ')}. ⛔ REFUSED rather than `
            + 'unwired: Seedling has no inert door, so this op DELETES the element — the '
            + 'location would be left naming a body the room no longer has, and every later '
            + 'derivation would refuse by name, one edit after the edit that caused it. '
            + `Run \`unmark-location\` on ${marked.map((l) => JSON.stringify(l.name)).join(', ')} `
            + 'first (it takes the `loc:` access rule with it and says so).');
    }
    const { room: next, removed } = removeExitInKind(current, exitIndex);
    const rooms = record.set.rooms.map((r, i) => (i !== room ? r : next));
    return {
        record: frozenRecord({ ...record.set, rooms }, record.overlay),
        // ⛔ THE SENTENCE SAYS THE DOOR IS GONE, because it is: the OEL format
        // has no spelling for a door that leads nowhere that every reader agrees
        // on — see `removeExitFromRoomXml`'s measured table.
        description: `unwire room ${room} exit ${exitIndex} — the <${removed.element}> to room `
            + `${removed.to} at (${removed.x}, ${removed.y}) is DELETED (Seedling has no inert `
            + `door; exits ${exitIndex + 1}..${doc.exits.length - 1} shift down by one)`,
    };
}

function setField(record, { path, value }) {
    if (!SET_FIELDS.includes(path)) {
        fail(`seedlingSetAdapter: set-field path ${JSON.stringify(path)} is not one the level-set `
            + `schema declares — the writable manifest fields are ${SET_FIELDS.join(', ')}. `
            + '⛔ `schema_version`, `set_id`, `provenance` and `rooms` are NOT among them: the '
            + 'first three are identity (stamped once, at download) and `rooms` is what the '
            + 'room ops are for.');
    }
    const count = record.set.rooms.length;
    const checkSpawn = (v, where) => {
        if (!isPlainObject(v) || !Number.isInteger(v.level)) {
            fail(`seedlingSetAdapter: ${where} must be {level, x?, y?} with an integer level, `
                + `got ${JSON.stringify(v)}`);
        }
        if (v.level < 0 || v.level >= count) {
            fail(`seedlingSetAdapter: ${where} names room ${v.level}; this set has ${count} `
                + '(the game will NOT check — an out-of-range level boots with no error and '
                + 'reads its whole persistence row as everything already cleared, §8.3)');
        }
    };
    if (path === 'start') checkSpawn(value, 'start');
    if (path === 'menu_rooms') {
        if (!Array.isArray(value) || value.length === 0 || !value.every(Number.isInteger)) {
            fail('seedlingSetAdapter: menu_rooms must be a NON-EMPTY array of integer room ids '
                + '— Game.as:1294 advances `menuIndex = (menuIndex + 1) % menuLevels.length` '
                + 'and a zero-length array makes that index NaN');
        }
        value.forEach((i, at) => {
            if (i < 0 || i >= count) {
                fail(`seedlingSetAdapter: menu_rooms[${at}] names room ${i}; this set has ${count}`);
            }
        });
    }
    if (path === 'named_rooms') {
        if (!isPlainObject(value)) fail('seedlingSetAdapter: named_rooms must be an object');
        for (const [key, entry] of Object.entries(value)) {
            if (!Object.hasOwn(NAMED_ROOMS, key)) {
                fail(`seedlingSetAdapter: named_rooms.${key} is not one of the six the game's own `
                    + `AS3 makes — ${Object.keys(NAMED_ROOMS).join(', ')}. The vocabulary is `
                    + 'CLOSED; an invented name would do nothing.');
            }
            checkSpawn(entry, `named_rooms.${key}`);
        }
    }
    if ((path === 'name' || path === 'description') && typeof value !== 'string') {
        fail(`seedlingSetAdapter: set-field ${path} must be a string, got ${JSON.stringify(value)}`);
    }
    return {
        record: frozenRecord({ ...record.set, [path]: value }, record.overlay),
        description: `set ${path} = ${JSON.stringify(value)}`,
    };
}

function setRoomField(record, { room, field, value }) {
    const current = requireRoom(record, room, 'set-room-field');
    if (!ROOM_FIELDS.includes(field)) {
        fail(`seedlingSetAdapter: set-room-field ${JSON.stringify(field)} is not one the schema `
            + `declares — a room's writable fields are ${ROOM_FIELDS.join(', ')}. ⛔ NOT \`id\` `
            + '(position IS identity — a reorder moves a room, an assignment does not) and NOT '
            + '`source` (that is `replace-room`, which takes the whole document).');
    }
    if (field === 'name' && (typeof value !== 'string' || value === '')) {
        fail('seedlingSetAdapter: a room name must be a non-empty string');
    }
    if (field === 'music' && (!Number.isInteger(value) || value < MUSIC_NONE || value >= MUSIC_COUNT)) {
        fail(`seedlingSetAdapter: music ${JSON.stringify(value)} is outside ${MUSIC_NONE}..`
            + `${MUSIC_COUNT - 1} — Music.songs has exactly ${MUSIC_COUNT} entries and `
            + `${MUSIC_NONE} means "written at runtime by this room's boss"`);
    }
    if ((field === 'music_override_exempt' || field === 'snow_gradient') && typeof value !== 'boolean') {
        fail(`seedlingSetAdapter: ${field} is a boolean, got ${JSON.stringify(value)}`);
    }
    const next = { ...current };
    // ⛓ ABSENT MEANS FALSE IN THE SCHEMA, so a `false` is written as an ABSENCE
    // rather than as a key. `buildLevelSet` does the same, and a set full of
    // `false` flags is noise a reader skims past.
    if (value === false && (field === 'music_override_exempt' || field === 'snow_gradient')) {
        delete next[field];
    } else {
        next[field] = value;
    }
    return {
        record: withRoomAt(record, room, next),
        description: `set room ${room} ${field} = ${JSON.stringify(value)}`,
    };
}

/**
 * ⛓⛓⛓ **EDITOR v3 E1b — `replace-room-xml` BECAME `replace-room`, BECAUSE ITS
 * PAYLOAD DID.** The op now takes a whole level DOCUMENT: `{record}` (the shape
 * a set carries since plan §22.8) or `{xml}` (OEL text, the legacy door). ⛔ The
 * NAME changed with the payload rather than staying and meaning something else
 * — an op called `replace-room-xml` that mostly carries records is a true
 * sentence about the wrong subject.
 *
 * ⛓ AND THE PAYLOAD'S KIND BECOMES THE ROOM'S KIND, which is the one place this
 * adapter converts anything: a `replace-room` is the author REPLACING the
 * document, so the document they hand over is the one that lands.
 */
function replaceRoom(record, { room, record: newRecord, xml }) {
    requireRoom(record, room, 'replace-room');
    const source = sourceFromPayload('replace-room', { record: newRecord, xml });
    const doc = indexOfPayload('replace-room', source);
    const count = record.set.rooms.length;
    for (const ex of [...doc.exits, ...doc.fallthroughs]) {
        if (!Number.isInteger(ex.to) || ex.to < 0 || ex.to >= count) {
            fail(`seedlingSetAdapter: replace-room carries a transition to room ${ex.to}, `
                + `outside 0..${count - 1}. ⛔ REFUSED rather than written: the game passes @to `
                + 'straight to `new Game()` unvalidated, and an out-of-range level boots with '
                + 'no error and reads its whole persistence row as everything already cleared.');
        }
    }
    const current = record.set.rooms[room];
    const entities = source.record
        ? (source.record.entities ?? []).length
        : indexOfPayload('replace-room', source).exits.length;
    // ⛓ THE SENTENCE COUNTS WHAT THE DOCUMENT HAS, NOT THE BYTES IT WOULD
    // RENDER TO. A record has no byte count until the chunk boundary, and
    // quoting one here would be quoting a number this op never produced.
    return {
        record: withRoomAt(record, room, { ...current, source }),
        description: `replace room ${room} "${current.name}" (\`${roomSourceKind(source)}\`, `
            + `${source.record ? `${entities} entit${entities === 1 ? 'y' : 'ies'}` : `${xml.length} bytes`}`
            + `, ${doc.size.w / 16}x${doc.size.h / 16} tiles, `
            + `${doc.exits.length} exit${doc.exits.length === 1 ? '' : 's'})`,
    };
}

function setOverlay(record, { room, overlay }) {
    requireRoom(record, room, 'set-overlay');
    if (overlay !== null) {
        const probe = {
            ...record.overlay,
            rooms: { ...record.overlay.rooms, [String(room)]: overlay },
        };
        const errors = overlayErrors(probe, { roomCount: record.set.rooms.length });
        if (errors.length > 0) {
            fail(`seedlingSetAdapter: set-overlay for room ${room} is refused — ${errors.join(' · ')}`);
        }
    }
    const fields = overlay === null ? 'cleared' : Object.keys(overlay).sort().join(', ') || 'empty';
    return {
        record: withOverlayRoom(record, room, overlay),
        description: `set room ${room} overlay (${fields})`,
    };
}

function markLocation(record, { room, entity, name, vanilla_item: item }) {
    // ⛓ `indexedRoom` is called for its REFUSAL, not its index: an embed-sourced
    // room has no document to find an entity in, and the sentence should say so.
    indexedRoom(record, room, 'mark-location');
    if (!isPlainObject(entity) || typeof entity.type !== 'string'
        || !Number.isInteger(entity.x) || !Number.isInteger(entity.y)) {
        fail(`seedlingSetAdapter: mark-location \`entity\` is {type, x, y} in PIXELS, got `
            + `${JSON.stringify(entity)}`);
    }
    const names = overlayLocationNames(record.overlay);
    if (names.has(name)) {
        fail(`seedlingSetAdapter: a location named ${JSON.stringify(name)} already exists in room `
            + `${names.get(name)}. ⛔ Location names are unique across the SET: `
            + '`regionAtlasCompiler` allocates AP location ids from `loc.name` ALONE, so two '
            + 'locations with one name collapse to one id and the second\'s item is lost.');
    }
    if (typeof name !== 'string' || name === '' || typeof item !== 'string' || item === '') {
        fail('seedlingSetAdapter: mark-location needs a non-empty `name` and `vanilla_item`');
    }
    // ⛔ THE ENTITY MUST BE IN THE ROOM'S XML, EXACTLY. A location marked on
    // nothing derives an atlas that throws at build time with a message about a
    // ledger row; refusing here names the room and the click.
    const found = findEntityInRoom(record.set.rooms[room], entity);
    if (!found) {
        fail(`seedlingSetAdapter: room ${room} holds no <${entity.type}> at (${entity.x}, `
            + `${entity.y}). ⚠ The coordinates are the OEL element's own @x/@y in PIXELS, and `
            + 'the match is EXACT — two entities of one type in a room are ordinary, so a '
            + 'tolerant match would silently mark whichever sorted first.');
    }
    const entry = record.overlay.rooms[String(room)] ?? {};
    const next = {
        ...entry,
        locations: [...(entry.locations ?? []), { entity: { ...entity }, name, vanilla_item: item }],
    };
    return {
        record: withOverlayRoom(record, room, next),
        description: `mark room ${room} <${entity.type}> at (${entity.x}, ${entity.y}) as `
            + `location "${name}" holding ${item}`,
    };
}

function unmarkLocation(record, { room, name }) {
    requireRoom(record, room, 'unmark-location');
    const entry = record.overlay.rooms[String(room)] ?? {};
    const rows = entry.locations ?? [];
    if (!rows.some((r) => r.name === name)) {
        fail(`seedlingSetAdapter: room ${room} has no location named ${JSON.stringify(name)} — it `
            + `has ${rows.length === 0 ? 'none' : rows.map((r) => JSON.stringify(r.name)).join(', ')}`);
    }
    const locations = rows.filter((r) => r.name !== name);
    const rules = { ...(entry.rules ?? {}) };
    // ⛓ THE RULE GOES WITH IT. A `loc:` rule left behind would name a location
    // that no longer exists, and the derivation would never look for it — a
    // rule that silently does nothing.
    delete rules[locationRuleKey(name)];
    const next = { ...entry };
    if (locations.length === 0) delete next.locations; else next.locations = locations;
    if (Object.keys(rules).length === 0) delete next.rules; else next.rules = rules;
    return {
        record: withOverlayRoom(record, room, next),
        description: `unmark location "${name}" in room ${room}`,
    };
}

function setAccessRule(record, { room, target, rule, path = null }, deps) {
    requireRoom(record, room, 'set-access-rule');
    const parsed = parseRuleTarget(target);
    const entry = record.overlay.rooms[String(room)] ?? {};
    const existing = entry.rules?.[target] ?? null;
    let node = rule;
    if (path !== null) {
        // ⛓ PATH-ADDRESSED EDITING IS `ruleTreeOps`', not this file's. §19.10:
        // "so that op is a delegation rather than an implementation."
        if (existing === null) {
            fail(`seedlingSetAdapter: set-access-rule was given a \`path\` but room ${room} has no `
                + `rule on ${JSON.stringify(target)} yet — a path addresses a node INSIDE an `
                + 'existing tree. Write the whole tree first.');
        }
        const out = replaceRuleAt(existing, path, rule, { schema: deps.rulesSchema ?? undefined });
        if (!out.ok) fail(`seedlingSetAdapter: set-access-rule — ${out.error}`);
        node = out.tree;
    } else if (deps.rulesSchema) {
        const errors = ruleSchemaErrors(rule, deps.rulesSchema);
        if (errors.length > 0) {
            fail(`seedlingSetAdapter: set-access-rule's rule is not a valid Rule Builder node — `
                + `${errors.join(' · ')}`);
        }
    }
    if (parsed.kind === 'loc') {
        const names = overlayLocationNames(record.overlay);
        if (names.get(parsed.id) !== room) {
            fail(`seedlingSetAdapter: set-access-rule names location ${JSON.stringify(parsed.id)} `
                + `in room ${room}, and ${names.has(parsed.id)
                    ? `it lives in room ${names.get(parsed.id)}` : 'no such location is marked'}`);
        }
    } else {
        assertExitGateable(record, room, parsed.id, deps);
    }
    const rules = { ...(entry.rules ?? {}), [target]: node };
    return {
        record: withOverlayRoom(record, room, { ...entry, rules }),
        description: `set the access rule on ${target} in room ${room} to `
            + `${node.rule}${path === null ? '' : ` (at path ${JSON.stringify(path)})`}`,
    };
}

/**
 * ⛔ **"UNKNOWN AT DERIVE TIME" IS ASKED BY DERIVING**, and when the derivation
 * cannot be run the op REFUSES BY NAME rather than accepting the key.
 *
 * A rule on an exit that does not exist is invisible: `applyOverlayRules` would
 * throw at derive time, long after the click, and a version that dropped it
 * would leave the author believing a door is gated. Checking here costs one
 * derivation of a set the editor is holding anyway.
 * [[feedback_fallback_reinstates_the_defect]] — the underived case refuses.
 *
 * ⛓⛓⛓ **AND SINCE E3b IT ASKS TWO QUESTIONS, WHICH IS WHY IT IS NO LONGER
 * CALLED `assertExitTargetExists`** (§21.2, §22.4). Existing is not enough: the
 * derivation gives a room its ARRIVAL ids too (`in_L<from>_<x>_<y>`), and
 * `regionAtlasCompiler.js:320-347` records the `to` endpoint of a `one_way`
 * connection as `{apExitName: null, arrivalOnly: true}` and builds NO AP exit
 * for it. **Every Seedling connection is `one_way`** — the game's one transition
 * primitive is a one-way jump to a declared destination — so before this slice
 * a rule authored on any `in_*` was written into the overlay, applied to the
 * atlas, and reached nothing: the door stayed FREE.
 *
 * ⛔ The gateability answer is `setEditorCore.gateabilityOf` over the SAME
 * derived atlas the REPORT's `inertRulesOf` reads, so the OP and the REPORT
 * cannot disagree — which is the point of routing both through one function
 * rather than re-spelling the connection rule here. `mazeSetAdapter` has
 * refused on this reading since E2a (§26.6); this is Seedling catching up.
 */
function assertExitGateable(record, room, exitId, deps) {
    if (typeof deps.parseOel !== 'function' || !Number.isInteger(deps.tileSize)
        || typeof deps.tileTypeForPlacement !== 'function') {
        fail(`seedlingSetAdapter: set-access-rule on ${JSON.stringify(exitRuleKey(exitId))} cannot `
            + 'be checked — an exit id is the DERIVATION\'s (`out_<type>_<x>_<y>`, '
            + '`in_L<from>_<x>_<y>`, `out_pit_<x>_<y>`, `in_pit_L<from>_<x>_<y>`), so knowing '
            + 'whether it exists means deriving the atlas, and this adapter was built without '
            + 'a `parseOel`/`tileSize`/`tileTypeForPlacement`. ⛔ REFUSED rather than accepted unchecked: a rule on an '
            + 'exit that is not there — or on one the compiler builds no edge for — does '
            + 'nothing and says nothing.');
    }
    const { atlas } = deriveAtlasOf(record, deps);
    const region = atlas.regions.find((r) => r.map_ref === room);
    if (!region) {
        fail(`seedlingSetAdapter: room ${room} has no region in the derived atlas — a room with `
            + 'no door at all is DROPPED by the derivation, so there is nothing to gate');
    }
    if (!region.exits.some((e) => e.exit_id === exitId)) {
        fail(`seedlingSetAdapter: region ${JSON.stringify(region.region_id)} has no exit `
            + `${JSON.stringify(exitId)}. Its exits are `
            + `${region.exits.map((e) => e.exit_id).join(', ') || '(none)'}.`);
    }
    const gate = gateabilityOf(atlas, region.region_id, exitId);
    if (!gate.gates) {
        fail(`seedlingSetAdapter: a rule on exit ${JSON.stringify(exitId)} of room ${room} `
            + `(region ${JSON.stringify(region.region_id)}) would REACH NOTHING — ${gate.why}. `
            + '⛔ REFUSED rather than accepted: an authored rule the compiler builds no edge '
            + 'for leaves the author believing a door is gated and the world treating it as '
            + 'free, and a missing `access_rule` is the same bytes downstream as one that was '
            + 'never written. ⛓ This is the SAME reading the REPORT\'s inert-rule row uses.');
    }
}

/**
 * ⛓⛓ **EDITOR v3 E1b — whether the room holds this exact entity, IN WHATEVER
 * KIND IT IS.** A `record` room answers from `entities[]` (no parse, no regex);
 * an `xml` room answers from the text, as it always did.
 *
 * ⚠ THE MATCH IS EXACT ON BOTH SIDES — two entities of one type in a room are
 * ordinary, so a tolerant match would silently mark whichever sorted first.
 */
function findEntityInRoom(room, entity) {
    const kind = roomSourceKind(room?.source);
    if (kind === 'record') {
        return (room.source.record.entities ?? []).some(
            (e) => e?.type === entity.type && e.x === entity.x && e.y === entity.y,
        );
    }
    if (kind === 'xml') return findEntityInXml(room.source.xml, entity);
    return false;
}

/**
 * Whether the room's OEL holds this exact entity.
 *
 * ⚠ REGEX, like every other OEL reader in this module's neighbourhood
 * (`levelSetValidator.js`'s own note: the files are flat machine-generated Ogmo
 * output and this graph is in the browser). It asks the ELEMENT, not a parsed
 * record, so a `mark-location` on a legacy `xml` room needs no `parseOel`.
 */
function findEntityInXml(xml, entity) {
    const re = new RegExp(`<${entity.type}((?:\\s+[\\w.:-]+\\s*=\\s*"[^"]*")*)\\s*/?>`, 'g');
    let m = re.exec(xml);
    while (m !== null) {
        const attrs = m[1] ?? '';
        const x = /\sx\s*=\s*"(-?\d+)"/.exec(attrs);
        const y = /\sy\s*=\s*"(-?\d+)"/.exec(attrs);
        if (x && y && Number(x[1]) === entity.x && Number(y[1]) === entity.y) return true;
        m = re.exec(xml);
    }
    return false;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE ADAPTER
 * ══════════════════════════════════════════════════════════════════════ */

const OPS = Object.freeze({
    'add-room': addRoom,
    'remove-room': removeRoom,
    reorder,
    connect,
    disconnect,
    'set-field': setField,
    'set-room-field': setRoomField,
    'set-access-rule': setAccessRule,
    'mark-location': markLocation,
    'unmark-location': unmarkLocation,
    'replace-room': replaceRoom,
    'set-overlay': setOverlay,
});

/**
 * ⛓ A CELL DESCRIPTOR IS A ROOM PLUS ITS OVERLAY — closed and comparable.
 *
 * ⛔ `id` is NOT in it. A room's id is its POSITION, so carrying it in a
 * descriptor would make a copied room disagree with wherever it is pasted, and
 * law 7 (write the descriptor at a DIFFERENT cell, read it back) would fail on
 * the one field the substrate is not free to choose.
 */
export function readSetCell(record, x, y) {
    if (y !== 0) {
        fail(`seedlingSetAdapter: readCell was asked for row ${y}. Rooms are a ONE-ROW grid `
            + '(`bounds` is {w: rooms.length, h: 1}) because a level set is a positionally '
            + 'addressed LIST — the schema says "Position is identity". There is no second row.');
    }
    const room = record.set.rooms[x];
    if (!room) {
        fail(`seedlingSetAdapter: readCell was asked for room ${x}; this set has `
            + `${record.set.rooms.length}`);
    }
    // ⛓⛓ EDITOR v3 E1b — THE WHOLE `source` TRAVELS, KIND AND ALL. A
    // descriptor that force-converted an `xml` room to a record on COPY would
    // silently change the document's kind on PASTE, which is the one thing
    // §22.8's additive rule forbids. So a `record` room copies as `{record}`
    // and a legacy `xml` room copies as `{xml}` — and law 7 (write the
    // descriptor at a DIFFERENT cell, read it back) holds for both.
    const desc = {
        room: {
            name: room.name,
            source: room.source ?? null,
            music: room.music,
        },
        overlay: record.overlay.rooms[String(x)] ?? null,
    };
    // ⛓ THE TWO OPTIONAL FLAGS ARE PRESENT ONLY WHEN TRUE, exactly as the set
    // carries them — a descriptor that always spelled `false` would make every
    // paste write two keys the schema says mean nothing.
    if (room.music_override_exempt) desc.room.music_override_exempt = true;
    if (room.snow_gradient) desc.room.snow_gradient = true;
    return desc;
}

/**
 * ⛓⛓ A DESCRIPTOR → THE OPS THAT REPRODUCE IT AT (x, 0).
 *
 * ⛔ `writeOps` NEVER SEES THE RECORD — that is the core's signature and it is
 * why "paste past the end appends a room" is not implementable here (the file
 * docblock). Every op it emits is one `replace-room` / `set-room-field` /
 * `set-overlay` refuses by name against a room that does not exist.
 */
export function setWriteOps(desc, x, y) {
    if (y !== 0) {
        fail(`seedlingSetAdapter: writeOps was asked for row ${y}; rooms are a ONE-ROW grid`);
    }
    if (!isPlainObject(desc)) {
        fail(`seedlingSetAdapter: writeOps needs a cell descriptor, got ${JSON.stringify(desc)}`);
    }
    const ops = [];
    const room = desc.room ?? null;
    if (room !== null) {
        // ⛓ ONE `replace-room` CARRYING THE DESCRIPTOR'S OWN KIND.
        if (isPlainObject(room.source)) ops.push({ op: 'replace-room', room: x, ...room.source });
        for (const field of ROOM_FIELDS) {
            // ⛓ ONLY THE FIELDS THE DESCRIPTOR PRESENTS — a filtered paste
            // (`only: 'overlay'`) hands over a descriptor with no `room` at all,
            // and writing defaults for the absent half would make a filter that
            // was asked for one thing quietly write two.
            if (Object.hasOwn(room, field)) {
                ops.push({ op: 'set-room-field', room: x, field, value: room[field] });
            } else if (field === 'music_override_exempt' || field === 'snow_gradient') {
                // ⛔ ABSENT MEANS FALSE, so reproducing the descriptor means
                // CLEARING a flag the destination happens to carry. Without this
                // a paste of an unexempt room onto an exempt one reads back a
                // different descriptor and law 7 fails.
                ops.push({ op: 'set-room-field', room: x, field, value: false });
            }
        }
    }
    if (Object.hasOwn(desc, 'overlay')) {
        ops.push({ op: 'set-overlay', room: x, overlay: desc.overlay });
    }
    return ops;
}

/**
 * ⛓⛓⛓ **THE ADAPTER.** Every dependency is a construction parameter and each
 * refuses BY NAME at the moment it is needed, exactly as `seedlingEditAdapter`
 * does and for the same reason: this graph is the browser's, and the OEL parser
 * lives under `scripts/`.
 *
 * @param {object} [o]
 * @param {Function} [o.parseOel]  `(xml, where) => {width, height, layers, entities}`
 * @param {number}   [o.tileSize]  pixels per tile, for the derivation
 * @param {Function} [o.tileTypeForPlacement] the semantics table's tile classifier
 * @param {object}   [o.rulesSchema] parsed `rules.schema.json`; supply it and every
 *                                   authored rule is checked before it lands
 * @param {Function} [o.levelSetSource] `(set_id) => set`, for the `set` base
 * @param {Function} [o.overlaySource]  `(overlay_id) => overlay`; absent = empty
 */
export function createSeedlingSetAdapter({
    parseOel = null, tileSize = null, tileTypeForPlacement = null, rulesSchema = null,
    levelSetSource = null, overlaySource = null, atlas = null, note = null,
} = {}) {
    const deps = { parseOel, tileSize, tileTypeForPlacement, rulesSchema, atlas, note };
    return Object.freeze({
        name: 'seedling-set',

        /**
         * ⛓⛓ ONE ATOMIC OP, PURE. The record is frozen and every op rebuilds
         * rather than writes, so a refusal leaves the caller's record untouched
         * by construction rather than by a discarded clone.
         *
         * ⛔ ONE CATCH, AND IT NAMES THE CLASSES. `SeedlingSetAdapterError` is
         * this file's refusal; `SeedlingSetOverlayError` is the overlay's;
         * `LevelSetExitError` is `retargetRoomXml`'s (a `to` with no `sign`, an
         * exit with children); **`SeedlingSetDeriveRefusal` is the DERIVATION's**
         * (E3b, §21.11 #2) — a set that cannot be derived as it stands is a data
         * condition an author fixes, not a crash. All four are REFUSALS in the
         * core's vocabulary.
         * ⚠ Anything else is NOT caught — a `TypeError` here is a defect, and
         * swallowing it into `{ok:false}` would make a crash look like an edit
         * the substrate declined. ⛓ The fourth class is wrapped at
         * `deriveAtlasOf` rather than here precisely so the net stays that
         * narrow: only a plain `Error` out of the derivation is re-labelled.
         */
        apply(record, op) {
            const kind = op?.op;
            const fn = Object.hasOwn(OPS, kind) ? OPS[kind] : null;
            if (!fn) {
                return {
                    ok: false,
                    description: `seedling-set: no op "${kind}" — the vocabulary is `
                        + `${SET_OP_KINDS.join(', ')}`,
                };
            }
            try {
                const { record: next, description } = fn(record, op, deps);
                return { ok: true, op, record: next, description };
            } catch (err) {
                if (err?.name === 'SeedlingSetAdapterError'
                    || err?.name === 'SeedlingSetOverlayError'
                    || err?.name === 'LevelSetExitError'
                    || err?.name === 'SeedlingSetDeriveRefusal') {
                    return { ok: false, description: `seedling-set: ${err.message}`, reason: err.name };
                }
                throw err;
            }
        },

        /** ⛓ BOTH HALVES, CANONICALLY. A record is its set AND its overlay. */
        equal: (a, b) => canonicalJson(a?.set) === canonicalJson(b?.set)
            && canonicalJson(a?.overlay) === canonicalJson(b?.overlay),

        bounds: (record) => ({ w: (record?.set?.rooms ?? []).length, h: 1 }),
        readCell: readSetCell,
        writeOps: setWriteOps,

        /**
         * ⛓ ONE KIND. A set session's base is the SET, and the room session's
         * `set-room` base (`seedlingEditAdapter`) is what opens one room inside
         * it — two adapters, two bases, one document.
         */
        bases: Object.freeze({
            set: (tag) => setBase(tag, { levelSetSource, overlaySource }),
        }),
    });
}

function setBase(tag, { levelSetSource, overlaySource }) {
    if (typeof tag?.set_id !== 'string') {
        fail(`seedlingSetAdapter: a \`set\` base is {kind:'set', set_id, overlay_id?}, got `
            + `${JSON.stringify(tag)}`);
    }
    if (!levelSetSource) {
        fail('seedlingSetAdapter: a `set` base needs a `levelSetSource`, and none was injected. '
            + 'A level set arrives by PASTE or by fetch — both of them the PAGE\'s business — '
            + 'so the document is handed in.');
    }
    const set = levelSetSource(tag.set_id);
    if (!set) {
        fail(`seedlingSetAdapter: no level set with set_id ${JSON.stringify(tag.set_id)} is loaded `
            + 'here. ⛔ REFUSED rather than opened against whatever set happens to be in hand: a '
            + '`set_id` carries the DOCUMENT\'s CONTENT HASH, so a session resolved out of a '
            + 'different set would be editing a set this base never named.');
    }
    let overlay = emptyOverlay();
    if (tag.overlay_id !== undefined && tag.overlay_id !== null) {
        if (!overlaySource) {
            fail(`seedlingSetAdapter: this base names overlay_id ${JSON.stringify(tag.overlay_id)} `
                + 'and no `overlaySource` was injected. ⛔ An overlay that silently fell back to '
                + 'EMPTY would open a session missing every location and every authored rule, '
                + 'and nothing downstream could tell that from a set nobody had annotated.');
        }
        overlay = overlaySource(tag.overlay_id);
        if (!overlay) {
            fail(`seedlingSetAdapter: no overlay with overlay_id ${JSON.stringify(tag.overlay_id)} `
                + 'is loaded here');
        }
    }
    assertOverlay(overlay, { roomCount: (set.rooms ?? []).length });
    return frozenRecord(set, overlay);
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE SESSION, AND THE ONE STAMP
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * Open a set session. `base` is `{kind:'set', set_id, overlay_id?}` and the
 * core carries it verbatim — the record is resolved by whoever holds the
 * documents (the page, or `adapter.bases.set`).
 */
export function createSetSession(adapter, record, { base = null, certified = null } = {}) {
    return createEditSession(adapter, record, { base, certified });
}

/** A record from its two halves, with the overlay's shape refused by name. */
export function setRecord(set, overlay = emptyOverlay()) {
    assertOverlay(overlay, { roomCount: (set?.rooms ?? []).length });
    return frozenRecord(set, overlay);
}

/**
 * ⛓⛓⛓ **DOWNLOAD — WHERE THE ONE STAMP HAPPENS, AND THE ONLY PLACE.**
 *
 * ⛔ `provenance` IS COPIED, NEVER SHARED. `stampLevelSetIdentity` writes
 * `content_hash` INTO the object it is given, so a shallow `{...set}` hands it
 * the SESSION's own provenance and leaves the session holding a set whose id no
 * longer matches its rooms. `retargetLevelSet` learned this the same way and
 * says so at `levelSetExits.js:564-581`; this is the same fix.
 *
 * ⛔ AND THE SET IS VALIDATED FIRST. Cross-room rules — name uniqueness, arrival
 * positions, the `named_rooms` completeness the schema cannot express — are
 * `levelSetValidator`'s and this is where they are asked. A set that fails is
 * refused BY NAME rather than downloaded; a set that only WARNS is downloaded
 * and the warnings ride in the report.
 *
 * @returns {{set, overlay, apMapping, report}}
 */
const stampedSetOf = (record) => stampLevelSetIdentity({
    ...record.set,
    schema_version: LEVEL_SET_SCHEMA_VERSION,
    provenance: { ...(record.set.provenance ?? {}) },
});

/**
 * ⛓⛓⛓ **THE DOWNLOAD'S VERDICT AS A LIST — §20.11 #5, ADDITIVE (EDITOR v3 D2).**
 *
 * `downloadSet` quotes every validator error into ONE throw, which is right for
 * a module and wrong for a form: a page wants to print them as rows, and the
 * only way to get them back out of that sentence is to split it on the ` · `
 * the join used.
 *
 * ⛔ **AND THAT SPLIT IS NOT RECOVERABLE, MEASURED.** Nothing stops a validator
 * sentence carrying the separator — `levelSetValidator.js` builds its messages
 * by interpolation from room NAMES and `named_rooms` citations, both of which
 * are free-form — so a page that split would silently turn ONE error into two
 * rows on the first set whose room is called `a · b`. Today's corpus cannot
 * arbitrate (zero of the sentences a bare set produces carry it), and *"zero
 * today"* is exactly the reasoning §20.5 refused to accept about an inert door.
 * ⇒ the structured answer is returned rather than reconstructed.
 *
 * ⛓ It validates the SAME stamped document the download would, through
 * `stampedSetOf` — one spelling, so a page cannot be told the set is fine and
 * then have the download refuse it.
 *
 * @returns {{ok: boolean, errors: string[], warnings: string[], set_id: string}}
 */
export function validateForDownload(session) {
    const set = stampedSetOf(session.record());
    const { ok, errors, warnings } = validateLevelSet(set);
    return { ok, errors: [...errors], warnings: [...warnings], set_id: set.set_id };
}

export function downloadSet(session, { validate = true } = {}) {
    const record = session.record();
    const set = stampedSetOf(record);
    let warnings = [];
    if (validate) {
        const result = validateLevelSet(set);
        if (!result.ok) {
            fail(`seedlingSetAdapter: this set is not valid and is NOT downloaded — `
                + `${result.errors.join(' · ')}`);
        }
        warnings = result.warnings;
    }
    const overlay = stampIdentity(
        { ...record.overlay, provenance: { ...(record.overlay.provenance ?? {}) } },
        { idKey: 'overlay_id', defaultBase: 'overlay' },
    );
    return {
        set,
        overlay,
        apMapping: apMappingInvalidation(set),
        report: {
            set_id: set.set_id,
            overlay_id: overlay.overlay_id,
            rooms: set.rooms.length,
            edits: session.ops().length,
            warnings,
        },
    };
}

/**
 * ⛓ `rules.json` — the OUTPUT, and the derived atlas is NEVER STAMPED on the
 * way (§19.10 hard #1).
 *
 * ⚠ `mapDoc` IS THE SET. `regionAtlasValidator.indexMapDocument` wants
 * `{levels: [...]}` keyed by each level's own `level` id, which is exactly what
 * `roomsOfSet` produces — measured in D0b's agreement row and re-derived here
 * rather than assumed.
 */
export function rulesJsonOf(session, deps, { compileRegionAtlas, gameName = 'Seedling Set' } = {}) {
    if (typeof compileRegionAtlas !== 'function') {
        fail('seedlingSetAdapter: rulesJsonOf needs `compileRegionAtlas` injected — it lives in '
            + '`procgenPipeline/` and this module names no pipeline dependency of its own');
    }
    const record = session.record();
    const derived = deriveAtlasOf(record, deps);
    const mapDoc = { levels: roomsOfSet(record.set, deps.parseOel) };
    const { rules, report } = compileRegionAtlas(derived.atlas, { mapDoc, gameName });
    return { rules, report, atlas: derived.atlas, stats: derived.stats, dropped: derived.dropped };
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE ROOM SESSION INSIDE THE SET SESSION
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ **THE `levelSetSource` A ROOM SESSION IS OPENED THROUGH.**
 *
 * `seedlingEditAdapter`'s `set-room` base resolves `{kind:'set-room', set_id,
 * room}` through an injected `levelSetSource(set_id)`. Point that at a LIVE set
 * session and a room opens against the session's CURRENT folded set — which is
 * what a page wants, because a room opened after a `reorder` must be the room
 * that is there NOW.
 *
 * ⛔ AND THE ID IS CHECKED HERE. `setRoomBase` does not compare the set it is
 * handed against the `set_id` in the tag (measured, 2026-08-25 —
 * `atlasBase` does, `setRoomBase` does not), so a page that injected the raw
 * `() => session.record().set` and later opened a DIFFERENT set into the same
 * session would silently resolve an old tag against the new document. This
 * closure is the check, and it is the injection a page should use.
 */
export function setSessionRoomSource(session) {
    return (setId) => {
        const set = session.record()?.set;
        return set && set.set_id === setId ? set : null;
    };
}

/**
 * ⛓⛓⛓ **CLOSE A ROOM SESSION INTO ITS SET SESSION — C2's BATCHING RESIDUE,
 * CLOSED BY CONSTRUCTION.**
 *
 * §13.10: *"a slice that edits five rooms in a row either re-stamps five times
 * (five ids, four of them never seen by anybody) or holds the edits and stamps
 * once."* Here N room edits become ONE `replace-room` on the set session,
 * and the set is stamped exactly once, at download. Five rooms edited = five set
 * ops = one id.
 *
 * ⛓ AND UNDO IS THE FOLD'S, NOT A SNAPSHOT'S. Undoing the `replace-room`
 * re-folds the set session's shorter op list, so the room's OLD document comes
 * back EXACTLY — not because anything saved it, but because the fold never had
 * it any other way.
 *
 * ⛓⛓⛓ **EDITOR v3 E1b — THE `recordToOel` PARAMETER IS GONE, AND THAT IS THE
 * WHOLE POINT OF THE RULING.** This function was the ONE existing record → text
 * hinge in the editor: a room session's fold IS a level record, and it had to be
 * rendered because a set carried text. It does not any more — the room session's
 * `record()` is the payload — so the render moved to the ONE place OEL is
 * actually needed, the chunk boundary (`planLevelSetChunks`).
 *
 * @param {object} setSession   the set session
 * @param {object} roomSession  a room session opened on room `room` of it
 * @param {number} room         the room index the room session was opened on
 */
export function closeRoomSession(setSession, roomSession, room) {
    const result = setSession.apply({ op: 'replace-room', room, record: roomSession.record() });
    if (!result.ok) {
        fail(`seedlingSetAdapter: closing room ${room} into the set session was REFUSED — `
            + `${result.description}`);
    }
    return result;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ CONVENIENCES THE PAGE AND THE TESTS BOTH WANT
 * ══════════════════════════════════════════════════════════════════════ */

/** Fold an op list onto a record without opening a session. */
export const foldSetEdits = (adapter, record, ops) => foldEdits(adapter, record, ops);

/** A labelled group of set ops — ONE undo. ⛔ `reorder` is NOT one of these. */
export const setGroup = (label, ops) => group(label, ops);

/** The exits of one room, in the ordinal both writers address — what a UI lists. */
export function exitsOfRoom(record, room) {
    const { doc } = indexedRoom(record, room, 'exitsOfRoom');
    return doc.exits.map((ex, index) => ({ index, ...ex }));
}

/**
 * Which rooms carry a transition INTO `room` — D2's "what links here".
 *
 * ⛔ **A ROOM THIS CANNOT READ IS NAMED, NOT SKIPPED.** An `embed`-sourced
 * room's exits are invisible here, and a readout that quietly reported "nothing
 * links here" over a set holding one would be a floor presented as a fact —
 * `reachabilityOf`'s `rooms_not_walked` exists for the same reason.
 *
 * @returns {{links: object[], unreadable: number[]}}
 */
export function whatLinksHere(record, room) {
    const links = [];
    const unreadable = [];
    (record.set.rooms ?? []).forEach((r, from) => {
        const doc = indexOfRoom(r);
        if (doc === null) { unreadable.push(from); return; }
        doc.exits.forEach((ex, index) => {
            if (ex.to === room) links.push({ from, kind: 'exit', index, element: ex.element });
        });
        doc.fallthroughs.forEach((f, index) => {
            if (f.to === room) links.push({ from, kind: 'fallthrough', index, element: f.element });
        });
    });
    return { links, unreadable };
}

/** ⛓ Re-exported so a caller reads the rule-target vocabulary off the adapter's
 *  own module rather than reaching past it. ⛔ The SAME frozen values. */
export { exitRuleKey, locationRuleKey };
