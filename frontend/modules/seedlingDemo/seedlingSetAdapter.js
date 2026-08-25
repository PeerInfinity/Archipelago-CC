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
 * `replace-room-xml` refusing room N of an N-room set by name is a better
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
import { applyOverlayRules, deriveAtlas } from './seedlingAtlasDerivation.js';
import {
    REGION_NONE, removeExitFromRoomXml, retargetRoomXml, signForTransition,
} from './levelSetExits.js';
import { apMappingInvalidation } from './levelSetExporter.js';
import {
    LEVEL_SET_SCHEMA_VERSION, MUSIC_COUNT, MUSIC_NONE, NAMED_ROOMS,
    parseRoomXml, stampLevelSetIdentity, validateLevelSet,
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

/** The manifest fields `set-field` may write. A path outside this is refused. */
export const SET_FIELDS = Object.freeze(['name', 'description', 'start', 'menu_rooms', 'named_rooms']);

/** The per-room fields `set-room-field` may write. ⛔ NOT `id` (position IS identity) and NOT `source`. */
export const ROOM_FIELDS = Object.freeze(['name', 'music', 'music_override_exempt', 'snow_gradient']);

/** Every op kind this adapter understands, sorted. The refusals read this. */
export const SET_OP_KINDS = Object.freeze([
    'add-room', 'connect', 'disconnect', 'mark-location', 'remove-room', 'reorder',
    'replace-room-xml', 'set-access-rule', 'set-field', 'set-overlay', 'set-room-field',
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
    return (set?.rooms ?? []).map((room, level) => {
        const xml = room?.source?.xml;
        if (typeof xml !== 'string') {
            fail(`seedlingSetAdapter: room ${level} ${JSON.stringify(room?.name ?? '')} is `
                + `${room?.source?.embed ? `EMBED-sourced (${room.source.embed})` : 'sourced by '
                    + JSON.stringify(room?.source)} — an \`embed\` is a path into a SWF's `
                + '`[Embed]` table and this module has no embeds, so the room cannot be '
                + 'parsed and the atlas cannot be derived from it. A set session can HOLD '
                + 'such a set; it cannot derive from one.');
        }
        return { ...parseOel(xml, `room ${level}`), level };
    });
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
    const derived = deriveAtlas(rooms, overlayToDeriveInput(record.overlay), {
        resolveCondition: (condition) => condition,
        ...deps,
    });
    const { atlas, applied } = applyOverlayRules(derived.atlas, exitRulesByRoom(record.overlay));
    return { ...derived, atlas, rulesApplied: applied };
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
        const xml = room?.source?.xml;
        if (typeof xml !== 'string') {
            // ⛔ NAMED, NOT SKIPPED — `retargetLevelSet`'s own rule. An
            // embed-sourced room's exits are invisible here and leaving them
            // pointing at the old layout is the graceful-skip failure.
            fail(`seedlingSetAdapter: room ${newIndex} ${JSON.stringify(room?.name ?? '')} is `
                + 'EMBED-sourced, so its exits cannot be read and a renumbering cannot '
                + 'rewrite them. A set with embed rooms can be HELD but not reordered.');
        }
        const doc = parseRoomXml(xml);
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
        const nextXml = (exits.length === 0 && fallthroughs.length === 0)
            ? xml
            : retargetRoomXml(xml, { exits, fallthroughs }).xml;
        const same = nextXml === xml && room.id === newIndex;
        return same ? room : { ...room, id: newIndex, source: { ...room.source, xml: nextXml } };
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

const parsedRoom = (record, index, what) => {
    const room = requireRoom(record, index, what);
    const xml = room?.source?.xml;
    if (typeof xml !== 'string') {
        fail(`seedlingSetAdapter: ${what} needs room ${index}'s OEL and it is EMBED-sourced `
            + `(${room?.source?.embed ?? JSON.stringify(room?.source)}). An \`embed\` is a path `
            + 'into a SWF\'s `[Embed]` table; this module has no embeds, so the room is a '
            + 'document the session can HOLD but not EDIT — the same refusal '
            + '`seedlingEditAdapter`\'s `set-room` base makes one layer down.');
    }
    return { room, xml, doc: parseRoomXml(xml) };
};

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

function addRoom(record, { xml, name = null, music = null, at = null }) {
    if (typeof xml !== 'string' || xml === '') fail('seedlingSetAdapter: add-room needs `xml`');
    let doc;
    try {
        doc = parseRoomXml(xml);
    } catch (e) {
        fail(`seedlingSetAdapter: add-room's xml does not parse — ${e.message}`);
    }
    if (doc.size === null) {
        fail('seedlingSetAdapter: add-room\'s xml carries no <width>/<height>, so it is not an '
            + 'OEL level document');
    }
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
        source: { xml },
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
        description: `add room ${index} "${nextRoom.name}" (${total} rooms)`,
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
        const xml = r?.source?.xml;
        if (typeof xml !== 'string') return;
        const doc = parseRoomXml(xml);
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
        return {
            room: {
                ...r,
                source: { ...r.source, xml: retargetRoomXml(r.source.xml, { exits, fallthroughs }).xml },
            },
            from: oldIndex,
        };
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
    const a = parsedRoom(record, fromRoom, 'connect `from`');
    const b = parsedRoom(record, toRoom, 'connect `to`');
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
    let rooms = record.set.rooms.map((r, i) => (i !== fromRoom ? r : {
        ...r, source: { ...r.source, xml: retargetRoomXml(a.xml, { exits: [forward] }).xml },
    }));
    if (!oneWay) {
        const back = {
            index: toExit,
            to: fromRoom,
            playerx: source.x,
            playery: source.y,
            sign: signForTransition(roomRegion(record.overlay, toRoom), roomRegion(record.overlay, fromRoom)),
        };
        // ⚠ read the DESTINATION's xml out of `rooms`, not out of `b`: when both
        // ends are in the SAME room the forward write has already happened.
        const current = rooms[toRoom].source.xml;
        rooms = rooms.map((r, i) => (i !== toRoom ? r : {
            ...r, source: { ...r.source, xml: retargetRoomXml(current, { exits: [back] }).xml },
        }));
    }
    return {
        record: frozenRecord({ ...record.set, rooms }, record.overlay),
        description: `connect room ${fromRoom} exit ${fromExit} ${oneWay ? '→' : '↔'} room `
            + `${toRoom} exit ${toExit}, arriving at (${land.x}, ${land.y})`,
    };
}

function disconnect(record, { room, exitIndex }) {
    const { xml, doc } = parsedRoom(record, room, 'disconnect');
    exitAt(doc, exitIndex, 'disconnect');
    const { xml: next, removed } = removeExitFromRoomXml(xml, exitIndex);
    const rooms = record.set.rooms.map((r, i) => (i !== room ? r : {
        ...r, source: { ...r.source, xml: next },
    }));
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
            + '`source` (that is `replace-room-xml`, which parses what it is given).');
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

function replaceRoomXml(record, { room, xml }) {
    requireRoom(record, room, 'replace-room-xml');
    if (typeof xml !== 'string' || xml === '') {
        fail('seedlingSetAdapter: replace-room-xml needs `xml`');
    }
    let doc;
    try {
        doc = parseRoomXml(xml);
    } catch (e) {
        fail(`seedlingSetAdapter: replace-room-xml's xml does not parse — ${e.message}`);
    }
    if (doc.size === null) {
        fail('seedlingSetAdapter: replace-room-xml\'s xml carries no <width>/<height>, so it is '
            + 'not an OEL level document');
    }
    const count = record.set.rooms.length;
    for (const ex of [...doc.exits, ...doc.fallthroughs]) {
        if (!Number.isInteger(ex.to) || ex.to < 0 || ex.to >= count) {
            fail(`seedlingSetAdapter: replace-room-xml carries a transition to room ${ex.to}, `
                + `outside 0..${count - 1}. ⛔ REFUSED rather than written: the game passes @to `
                + 'straight to `new Game()` unvalidated, and an out-of-range level boots with '
                + 'no error and reads its whole persistence row as everything already cleared.');
        }
    }
    const current = record.set.rooms[room];
    return {
        record: withRoomAt(record, room, { ...current, source: { ...current.source, xml } }),
        description: `replace room ${room} "${current.name}" OEL `
            + `(${doc.exits.length} exit${doc.exits.length === 1 ? '' : 's'}, ${xml.length} bytes)`,
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
    // ⛓ `parsedRoom` is called for its REFUSAL, not its parse: an embed-sourced
    // room has no XML to find an entity in, and the sentence should say so.
    parsedRoom(record, room, 'mark-location');
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
    const found = findEntityInXml(record.set.rooms[room].source.xml, entity);
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
        assertExitTargetExists(record, room, parsed.id, deps);
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
 */
function assertExitTargetExists(record, room, exitId, deps) {
    if (typeof deps.parseOel !== 'function' || !Number.isInteger(deps.tileSize)
        || typeof deps.tileTypeForPlacement !== 'function') {
        fail(`seedlingSetAdapter: set-access-rule on ${JSON.stringify(exitRuleKey(exitId))} cannot `
            + 'be checked — an exit id is the DERIVATION\'s (`out_<type>_<x>_<y>`, '
            + '`in_L<from>_<x>_<y>`, `out_pit_<x>_<y>`, `in_pit_L<from>_<x>_<y>`), so knowing '
            + 'whether it exists means deriving the atlas, and this adapter was built without '
            + 'a `parseOel`/`tileSize`/`tileTypeForPlacement`. ⛔ REFUSED rather than accepted unchecked: a rule on an '
            + 'exit that is not there does nothing and says nothing.');
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
}

/**
 * Whether the room's OEL holds this exact entity.
 *
 * ⚠ REGEX, like every other OEL reader in this module's neighbourhood
 * (`levelSetValidator.js`'s own note: the files are flat machine-generated Ogmo
 * output and this graph is in the browser). It asks the ELEMENT, not a parsed
 * record, so a `mark-location` needs no `parseOel` injection.
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
    'replace-room-xml': replaceRoomXml,
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
    const desc = {
        room: {
            name: room.name,
            xml: room.source?.xml ?? null,
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
 * docblock). Every op it emits is one `replace-room-xml` / `set-room-field` /
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
        if (typeof room.xml === 'string') ops.push({ op: 'replace-room-xml', room: x, xml: room.xml });
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
         * exit with children). All three are REFUSALS in the core's vocabulary.
         * ⚠ Anything else is NOT caught — a `TypeError` here is a defect, and
         * swallowing it into `{ok:false}` would make a crash look like an edit
         * the substrate declined.
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
                    || err?.name === 'LevelSetExitError') {
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
export function downloadSet(session, { validate = true } = {}) {
    const record = session.record();
    const set = stampLevelSetIdentity({
        ...record.set,
        schema_version: LEVEL_SET_SCHEMA_VERSION,
        provenance: { ...(record.set.provenance ?? {}) },
    });
    if (validate) {
        const result = validateLevelSet(set);
        if (!result.ok) {
            fail(`seedlingSetAdapter: this set is not valid and is NOT downloaded — `
                + `${result.errors.join(' · ')}`);
        }
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
            warnings: validate ? validateLevelSet(set).warnings : [],
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
 * once."* Here N room edits become ONE `replace-room-xml` on the set session,
 * and the set is stamped exactly once, at download. Five rooms edited = five set
 * ops = one id.
 *
 * ⛓ AND UNDO IS THE FOLD'S, NOT A SNAPSHOT'S. Undoing the `replace-room-xml`
 * re-folds the set session's shorter op list, so the room's OLD OEL comes back
 * BYTE-FOR-BYTE — not because anything saved it, but because the fold never
 * had it any other way.
 *
 * @param {object} setSession   the set session
 * @param {object} roomSession  a room session opened on room `room` of it
 * @param {number} room         the room index the room session was opened on
 * @param {Function} recordToOel `procgenLevelOel.recordToOel`, injected
 */
export function closeRoomSession(setSession, roomSession, room, recordToOel) {
    if (typeof recordToOel !== 'function') {
        fail('seedlingSetAdapter: closeRoomSession needs `recordToOel` injected — a room record '
            + 'becomes OEL text through `procgenLevelOel.recordToOel`, and this module names no '
            + 'renderer of its own');
    }
    const xml = recordToOel(roomSession.record());
    const result = setSession.apply({ op: 'replace-room-xml', room, xml });
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

/** The exits of one room, as `parseRoomXml` numbers them — what a UI lists. */
export function exitsOfRoom(record, room) {
    const { doc } = parsedRoom(record, room, 'exitsOfRoom');
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
        const xml = r?.source?.xml;
        if (typeof xml !== 'string') { unreadable.push(from); return; }
        const doc = parseRoomXml(xml);
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
