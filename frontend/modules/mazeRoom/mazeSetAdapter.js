/**
 * mazeRoom/mazeSetAdapter — **D1's SET ADAPTER, OVER A REGION LIBRARY.**
 *
 * EDITOR v3 arc, slice E2a (`NewDocs/plans/seedling-editor-v3.md` §20.4, §22.3;
 * as-built §26). D1 shipped `seedlingSetAdapter.js` — twelve ops over
 * `{set, overlay}`, a derivation, `rulesJsonOf`, a download and a room session
 * — and D2 built a page on it. This file is the SECOND one, over
 * `{library, overlay}`, and it is what turns E2a's `setEditorCore` from a
 * refactor into a seam.
 *
 * ⛓ THE OP NAMES ARE §20.4's, DELIBERATELY. `setEditorCore` needs no
 * per-substrate op table, `renumberDecision` names the same three renumbering
 * ops, and the page E2b writes can press the same buttons. Where the maze
 * differs it differs in the op's PAYLOAD (`{payload}` rather than `{xml}`,
 * `{room, exit_id}` rather than `{room, exitIndex}`), never in what the op is
 * called.
 *
 * ── ⛔⛔ THE FOUR PLACES THIS ADAPTER IS NOT FREE TO INVENT ────────────
 *
 *  1. **THE ENTRY.** `add-room` and `replace-room` build the library entry
 *     through `mazeLibraryEntry.captureTileGridLibraryEntry` — the ONE writer
 *     of a payload from a world — so `region_size`, `exit_sides`,
 *     `location_slots` and `carried_rules: null` are all DERIVED by the same
 *     code the capture path uses and none of them is hand-assembled here.
 *     MEASURED 2026-08-25: deserialize → capture round-trips all four committed
 *     demo-pack entries BYTE-IDENTICALLY, so an edit that changes nothing
 *     changes nothing.
 *  2. **THE LIBRARY'S CONTRACT.** `validateRegionLibrary` is the authority on
 *     what a library is, and `stampLibraryIdentity` is the one place an id is
 *     written. ⛔ `library_id` is REFUSED by `set-field`: it is a STAMP over the
 *     content, so setting it by hand would make the document lie about itself.
 *  3. **WHAT `set-access-rule` MAY GATE.** `setEditorCore.gateabilityOf` reads
 *     the DERIVED atlas's connections, and this op refuses an endpoint it calls
 *     ungateable. §21.2 found Seedling's op accepting a rule on an arrival
 *     endpoint that gates nothing; E3 will make Seedling refuse it, and this
 *     adapter — being new — does it from day one.
 *  4. **`exit_sides` IS DERIVED AND THEREFORE NOT SETTABLE.** The brief listed
 *     it as a `set-room-field` field; MEASURED, `captureTileGridLibraryEntry`
 *     computes it from the payload's own exits, so a hand-set value would make
 *     the entry stale against its tiles — the exact drift
 *     `mazeAtlasDerivation`'s side cross-check refuses. The op names `name` and
 *     refuses `exit_sides` with that reason.
 *
 * ── ⚠ WHAT A MAZE SET HAS NO ANALOGUE OF ─────────────────────────────
 *
 * **NO AP COMPANION.** Seedling's download carries an `apMappingInvalidation`
 * document because a Seedling level set has a VANILLA mapping that an edit
 * invalidates. A region library is interchangeable content that never shipped
 * as anybody's vanilla game, so there is no mapping to invalidate and this
 * download emits no companion — said out loud rather than emitted empty, which
 * would read as "checked, nothing to say".
 */

import { canonicalJson, createEditSession, foldEdits, group } from '../procgenCore/editCore.js';
import { stampIdentity } from '../procgenCore/contentIdentity.js';
import { replaceRuleAt } from '../procgenCore/ruleTreeOps.js';
import { ruleSchemaErrors } from '../procgenCore/jsonSchemaCheck.js';
import { gateabilityOf } from '../procgenCore/setEditorCore.js';
import {
    stampLibraryIdentity, validateRegionLibrary,
} from '../procgenPipeline/regionLibraryValidator.js';
import { blankTileGridLibraryEntry, captureTileGridLibraryEntry } from './mazeLibraryEntry.js';
import { createWorld, deserializeMazeWorld, extractPathsAndObstacles } from './mazeRoomEngine.js';
import { serializeMazeWorld } from '../procgenPipeline/procgenPipelineEngine.js';
import {
    LINK_ONE_WAY_DEFAULT, assertOverlay, deriveAtlasOf, emptyMazeOverlay, exitRuleKey,
    locationRuleKey, overlayErrors, parseRuleTarget, renumberOverlay, rulesJsonOf,
} from './mazeAtlasDerivation.js';

export class MazeSetAdapterError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MazeSetAdapterError';
    }
}

const fail = (message) => { throw new MazeSetAdapterError(message); };
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));

/**
 * ⛓ The refusal classes an `apply` catch may swallow. ⚠ Anything else is NOT
 * caught — a `TypeError` here is a defect, and turning it into `{ok:false}`
 * would make a crash look like an edit the substrate declined.
 */
export const isMazeSetRefusal = (e) => e?.name === 'MazeSetAdapterError'
    || e?.name === 'MazeAtlasDerivationError';

/** ⛓ The manifest fields `set-field` may write. ⛔ `library_id` is a STAMP. */
export const LIBRARY_FIELDS = Object.freeze(['name', 'description']);

/**
 * ⛓ The per-room fields `set-room-field` may write. ⛔ `exit_sides`,
 * `region_size`, `location_slots` and `carried_rules` are all DERIVED by the
 * capture path and are refused by name.
 */
export const ROOM_FIELDS = Object.freeze(['name']);

/** ⛓ The derived entry fields, so the refusal lists them rather than typing them. */
const DERIVED_ENTRY_FIELDS = Object.freeze([
    'entry_id', 'substrate', 'region_size', 'exit_sides', 'location_slots', 'carried_rules',
]);

/** The twelve ops, in §20.4's own vocabulary. */
export const SET_OP_KINDS = Object.freeze([
    'add-room', 'connect', 'disconnect', 'mark-location', 'remove-room', 'reorder',
    'replace-room', 'set-access-rule', 'set-field', 'set-overlay', 'set-room-field',
    'unmark-location',
]);

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ READING THE RECORD
 * ══════════════════════════════════════════════════════════════════════ */

const entriesOf = (record) => record?.library?.entries ?? [];

const roomAt = (record, room, where) => {
    const entries = entriesOf(record);
    if (!Number.isInteger(room) || room < 0 || room >= entries.length) {
        fail(`mazeSetAdapter: ${where} names room ${JSON.stringify(room)}; this library has `
            + `${entries.length}`);
    }
    return entries[room];
};

/**
 * The exits of one room, in the ordinal a UI lists them in — each carrying the
 * room its overlay LINK crosses to, or `null` when nothing links it yet.
 *
 * ⛓⛓ `to` IS WHY THIS EXISTS. `setEditorCore.exitArrowShapes` draws from
 * `row.exitList[].to` and knows nothing else; a Seedling exit carries its own
 * `@to` and a maze exit's target lives in the overlay, so the join happens here
 * and the arrows are the same function on both substrates.
 */
export function exitsOfRoom(record, room) {
    const entry = roomAt(record, room, 'exitsOfRoom');
    const links = record?.overlay?.links ?? [];
    return (entry.payload?.exits ?? []).map((exit, index) => {
        const link = links.find((l) => (l.from?.[0] === room && l.from?.[1] === exit.exit_id)
            || (l.to?.[0] === room && l.to?.[1] === exit.exit_id));
        const far = link === undefined ? null
            : (link.from[0] === room && link.from[1] === exit.exit_id ? link.to : link.from);
        return Object.freeze({
            index,
            exit_id: exit.exit_id,
            side: exit.side ?? null,
            tile: Object.freeze([exit.x, exit.y]),
            isTeleporter: exit.isTeleporter === true,
            to: far === null ? null : far[0],
            toExit: far === null ? null : far[1],
            one_way: link?.one_way ?? (link === undefined ? null : LINK_ONE_WAY_DEFAULT),
        });
    });
}

/**
 * ⛓⛓⛓ **WHICH ROOMS LINK INTO `room` — AND THE MAZE'S ANSWER TO §21.4's BOUND.**
 *
 * ⛔ **THERE IS NO SCAN TO BOUND HERE, AND THAT IS A MEASUREMENT, NOT A HOPE.**
 * Seedling's `whatLinksHere` reads EVERY ROOM'S DOCUMENT — 116 rooms × the
 * whole set, which E1 measured at 17–19 s of OEL parsing and E1b re-measured at
 * 365 ms over records (§24.7). The maze's links are ONE authored list, so this
 * is O(|links|) per room and O(n × |links|) for the whole column, with no
 * document parsed at all.
 *
 * MEASURED 2026-08-25 over a synthetic 116-entry library with 115 links (node,
 * loadavg 0.75, 50 repeats):
 *
 *   ·  ONE room                              1.49 µs
 *   ·  the WHOLE "links here" column         **0.363 ms**  (116 rooms)
 *   ·  the whole `exitsOfRoom` column        0.910 ms      (the other per-row read)
 *
 * — against the **250 ms** budget `LINK_SCAN` sets for Seedling, i.e. the two
 * columns together cost **~0.5 %** of it and E1b's record path is still ~290×
 * more expensive. ⇒ **no bound is needed**, and
 * `mazeSetAdapter` therefore exports none: a bound whose predicate can never
 * fire is a `(bounded)` column nobody would ever see and a constant that would
 * decay unread ([[feedback_bounded_sweep_must_name_what_it_bounded]] in
 * reverse — what is NOT bounded has to be said too).
 *
 * ⚠ `unreadable` is ALWAYS EMPTY and the shape keeps it anyway: a library entry
 * is a JSON payload the adapter can always read, unlike an `embed`-sourced
 * Seedling room. The core's `roomRowsOf` reads the field for both substrates.
 */
export function whatLinksHere(record, room) {
    const links = [];
    (record?.overlay?.links ?? []).forEach((link, index) => {
        const twoWay = (link.one_way ?? LINK_ONE_WAY_DEFAULT) === false;
        if (link.to?.[0] === room) links.push({ from: link.from[0], kind: 'link', index, exit_id: link.to[1] });
        else if (twoWay && link.from?.[0] === room) {
            links.push({ from: link.to[0], kind: 'link', index, exit_id: link.from[1] });
        }
    });
    return { links, unreadable: [] };
}

/**
 * ⛓ A CELL DESCRIPTOR IS A ROOM'S CONTENT PLUS ITS OVERLAY — closed, comparable
 * and free of anything positional.
 *
 * ⛔ **`entry_id` IS NOT IN IT**, for the same reason Seedling's descriptor
 * omits a room's `id`: it is the cell's IDENTITY and not its content. Copying
 * it would make a pasted room claim to be the room it came from, and contract
 * law 7 (write the descriptor at a DIFFERENT cell, read it back) would fail on
 * the one field the substrate is not free to choose.
 *
 * ⛔ **AND `links` IS NOT IN IT EITHER — MEASURED against law 7.** The brief
 * asked for "the links touching i". A link names BOTH endpoints, so
 * reproducing room 0's links at room 3 has no meaning the format can express,
 * and `writeOps` never sees the record so it could not rewrite the far ends
 * anyway. The links a room has are read through `whatLinksHere`/`exitsOfRoom`,
 * exactly as Seedling reads its own — a separate question, not a field of the
 * cell.
 */
export function readSetCell(record, x, y) {
    if (y !== 0) {
        fail(`mazeSetAdapter: readCell was asked for row ${y}. Rooms are a ONE-ROW grid `
            + '(`bounds` is {w: entries.length, h: 1}) because a region library is a '
            + 'positionally addressed LIST of interchangeable rooms. There is no second row.');
    }
    const entry = roomAt(record, x, 'readCell');
    return {
        room: { name: entry.name ?? null, music: null },
        payload: entry.payload,
        overlay: record.overlay?.rooms?.[String(x)] ?? null,
    };
}

/**
 * ⛓⛓ A DESCRIPTOR → THE OPS THAT REPRODUCE IT AT (x, 0).
 *
 * ⛔ `writeOps` NEVER SEES THE RECORD — that is the core's signature — so every
 * op it emits is one that refuses by name against a room that does not exist.
 */
export function setWriteOps(desc, x, y) {
    if (y !== 0) fail(`mazeSetAdapter: writeOps was asked for row ${y}; rooms are a ONE-ROW grid`);
    if (!isPlainObject(desc)) {
        fail(`mazeSetAdapter: writeOps needs a cell descriptor, got ${JSON.stringify(desc)}`);
    }
    const ops = [];
    if (Object.hasOwn(desc, 'payload')) ops.push({ op: 'replace-room', room: x, payload: desc.payload });
    if (isPlainObject(desc.room)) {
        for (const field of ROOM_FIELDS) {
            if (Object.hasOwn(desc.room, field)) {
                ops.push({ op: 'set-room-field', room: x, field, value: desc.room[field] });
            }
        }
    }
    if (Object.hasOwn(desc, 'overlay')) ops.push({ op: 'set-overlay', room: x, overlay: desc.overlay });
    return ops;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓ THE ENTRY CONSTRUCTOR — the library's own, never hand-assembled
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓ The composition `mazeRoomLibrary.js`'s registry entry makes, minus the
 * registry. ⛔ Importing `mazeRoomLibrary.js` itself would drag `./index.js`
 * (the PANEL) into a node-only module and register a substrate as a side
 * effect of opening an editor session; the three primitives are what the
 * registry entry actually composes, so this composes the same three and takes
 * an override for a caller that wants the registry's.
 */
export const MAZE_CAPTURE_DEPS = Object.freeze({
    serialize: serializeMazeWorld,
    extract: extractPathsAndObstacles,
    substrate: 'maze',
});

/**
 * ⛓⛓ **THE BLANK ROOM'S PAYLOAD, BOUND TO THE MAZE'S OWN PRIMITIVES** (E3b).
 *
 * `mazeLibraryEntry.js` names no engine — every hook in it takes its
 * `serialize`/`extract`/`deserialize` as `deps`, and the blank constructor
 * follows. This is the binding, so a page adding a room calls ONE function and
 * hands its result straight to `add-room`:
 *
 *   `session.apply({ op: 'add-room', payload: blankMazeRoomPayload({width, height}) })`
 *
 * ⛓ `createWorld` joins `MAZE_CAPTURE_DEPS`' three here rather than being added
 * to that frozen object: those three are what the CAPTURE path composes, and a
 * fourth in it would be a dependency `entryFromPayload` does not use.
 *
 * ⛔ The BUTTON is not here. `mazeSetLab.js` is another slice's file; this is
 * the vocabulary it will call.
 */
export const blankMazeRoomPayload = (spec) => blankTileGridLibraryEntry(spec, {
    createWorld,
    serialize: MAZE_CAPTURE_DEPS.serialize,
    extract: MAZE_CAPTURE_DEPS.extract,
});

/**
 * ⛓⛓⛓ **A LIBRARY ENTRY FROM A PAYLOAD, THROUGH THE CAPTURE PATH.**
 *
 * ⛔ The payload is DESERIALISED and RE-CAPTURED rather than wrapped: capture
 * is where `region_size`, `exit_sides`, `location_slots` and the
 * `carried_rules: null` contract come from, and an entry assembled here would
 * be a second spelling of all four. MEASURED: over the committed demo pack the
 * trip is byte-identical, so re-capturing an unedited payload changes nothing.
 */
function entryFromPayload(payload, { entry_id: entryId, name }, deps) {
    if (!isPlainObject(payload)) {
        fail(`mazeSetAdapter: a room payload must be an object, got ${JSON.stringify(payload)}`);
    }
    let world;
    try {
        world = deserializeMazeWorld(payload);
    } catch (e) {
        fail(`mazeSetAdapter: this payload is not a tile-grid maze world — ${e.message}`);
    }
    const entry = captureTileGridLibraryEntry(
        { region_id: entryId, playable_payload: world },
        { entry_id: entryId, ...(name ? { name } : {}) },
        deps.capture ?? MAZE_CAPTURE_DEPS,
    );
    // ⛔ THE CONTRACT, ASSERTED RATHER THAN ASSUMED. `regionLibraryValidator`
    // requires `carried_rules: null` for a procedural substrate; the rules live
    // in the OVERLAY and reach the world only through the compiled atlas.
    if (entry.carried_rules !== null) {
        fail(`mazeSetAdapter: the capture path returned carried_rules `
            + `${JSON.stringify(entry.carried_rules)} for "${entryId}", and a procedural `
            + 'substrate\'s entry MUST carry null — its rules are re-derived on instantiate');
    }
    return entry;
}

/**
 * ⛓ A fresh entry id that no entry in the library holds. ⛔ DERIVED from the
 * count and then advanced past a collision, rather than a random suffix: an
 * editor's ids should be readable, and two sessions that add a room to the same
 * library should produce the same id.
 */
function freshEntryId(entries, base = 'room') {
    const taken = new Set(entries.map((e) => e.entry_id));
    for (let i = entries.length; ; i += 1) {
        const id = `${base}_${i}`;
        if (!taken.has(id)) return id;
    }
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE RENUMBERING MACHINE — one for all three ops
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * ⛓⛓ **ONE RENUMBERING MACHINE**, exactly as D1 §20.4 has: `reorder`,
 * `add-room` and `remove-room` all come through here.
 *
 * ⛔⛔ **AND NO PAYLOAD IS REWRITTEN.** Seedling's `renumberSet` has to rewrite
 * every `@to`, every `@fallthrough`, `rooms[].id`, `start`, `menu_rooms` and
 * `named_rooms[*].level`, because a Seedling room's transitions name room
 * indices INSIDE the room's own document. A maze entry names nothing outside
 * itself — its exits' targets are null by the library's contract — so a
 * renumbering touches the OVERLAY and only the overlay. The row pins the
 * payload bytes.
 */
function renumberLibrary(record, entries, mapping) {
    const { overlay, dropped } = renumberOverlay(record.overlay, mapping);
    return {
        record: Object.freeze({
            library: { ...record.library, entries },
            overlay,
        }),
        dropped,
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ THE TWELVE OPS
 * ══════════════════════════════════════════════════════════════════════ */

const withOverlay = (record, overlay) => Object.freeze({ library: record.library, overlay });

function addRoom(record, { payload, name = null, at = null }, deps) {
    const entries = entriesOf(record);
    const index = at === null ? entries.length : at;
    if (!Number.isInteger(index) || index < 0 || index > entries.length) {
        fail(`mazeSetAdapter: add-room \`at\` must be inside 0..${entries.length}, got `
            + `${JSON.stringify(at)}`);
    }
    const entry = entryFromPayload(payload, { entry_id: freshEntryId(entries), name }, deps);
    const next = [...entries.slice(0, index), entry, ...entries.slice(index)];
    const mapping = new Map(entries.map((_e, old) => [old, old >= index ? old + 1 : old]));
    const { record: out } = renumberLibrary(record, next, mapping);
    return {
        record: out,
        description: `add room "${entry.entry_id}" at ${index} (${entry.region_size.width}x`
            + `${entry.region_size.height}, ${entry.payload.exits.length} exit(s), `
            + `${entry.location_slots} slot(s))`,
    };
}

function removeRoom(record, { room, retarget = null }) {
    const entries = entriesOf(record);
    roomAt(record, room, 'remove-room');
    if (entries.length === 1) {
        fail('mazeSetAdapter: remove-room would empty the library, and a library with no '
            + 'entries is refused by `validateRegionLibrary` ("entries must be a non-empty '
            + 'array")');
    }
    /**
     * ⛔⛔ THE REFUSAL LISTS EVERY LINK, not the first. An author who has to
     * press remove once per link they did not know about is an author being
     * told the answer one bit at a time.
     */
    const touching = (record.overlay?.links ?? [])
        .map((link, index) => ({ link, index }))
        .filter(({ link }) => link.from?.[0] === room || link.to?.[0] === room);
    if (touching.length > 0 && retarget !== 'drop') {
        fail(`mazeSetAdapter: room ${room} ("${entries[room].entry_id}") is still linked by `
            + `${touching.length} link(s): ${touching.map(({ link, index }) => `#${index} `
                + `[${link.from}] ↔ [${link.to}]`).join(', ')}. ⛔ REFUSED rather than silently `
            + 'unwired: a removal that dropped the links would leave the author believing rooms '
            + 'were still joined. Pass `retarget: "drop"` to remove them with the room, or '
            + '`disconnect` them first.');
    }
    const next = entries.filter((_e, i) => i !== room);
    const mapping = new Map(entries.map((_e, old) => {
        if (old === room) return [old, null];
        return [old, old > room ? old - 1 : old];
    }));
    const { record: out, dropped } = renumberLibrary(record, next, mapping);
    return {
        record: out,
        description: `remove room ${room} ("${entries[room].entry_id}")`
            + (touching.length > 0 ? `, dropping ${touching.length} link(s)` : '')
            + (dropped.length > 0 ? `, dropping the overlay of room(s) ${dropped.join(', ')}` : ''),
    };
}

function reorder(record, { order }) {
    const entries = entriesOf(record);
    const n = entries.length;
    const ok = Array.isArray(order) && order.length === n
        && new Set(order).size === n && order.every((i) => Number.isInteger(i) && i >= 0 && i < n);
    if (!ok) {
        fail(`mazeSetAdapter: reorder needs a permutation of 0..${n - 1}, got `
            + `${JSON.stringify(order)}`);
    }
    const next = order.map((old) => entries[old]);
    const mapping = new Map(order.map((old, now) => [old, now]));
    const { record: out } = renumberLibrary(record, next, mapping);
    return {
        record: out,
        description: `reorder ${n} room(s) — rooms_new[i] = rooms_old[order[i]], order `
            + `[${order.join(', ')}]`,
    };
}

/** ⛓ The endpoint an op names, checked against the entry's own exits. */
function assertEndpoint(record, endpoint, where) {
    if (!Array.isArray(endpoint) || endpoint.length !== 2) {
        fail(`mazeSetAdapter: ${where} must be [roomIndex, exit_id], got `
            + `${JSON.stringify(endpoint)}`);
    }
    const entry = roomAt(record, endpoint[0], where);
    const ids = (entry.payload?.exits ?? []).map((e) => e.exit_id);
    if (!ids.includes(endpoint[1])) {
        fail(`mazeSetAdapter: ${where} names exit ${JSON.stringify(endpoint[1])}, which entry `
            + `"${entry.entry_id}" (room ${endpoint[0]}) does not have. Its exits are `
            + `${ids.join(', ') || '(none)'}.`);
    }
    return entry;
}

function connect(record, { from, to, one_way: oneWay = LINK_ONE_WAY_DEFAULT }) {
    assertEndpoint(record, from, 'connect `from`');
    assertEndpoint(record, to, 'connect `to`');
    if (typeof oneWay !== 'boolean') {
        fail(`mazeSetAdapter: connect \`one_way\` must be a boolean, got ${JSON.stringify(oneWay)}`);
    }
    if (from[0] === to[0] && from[1] === to[1]) {
        fail('mazeSetAdapter: an exit cannot connect to itself');
    }
    const links = [...(record.overlay?.links ?? []), { from: [...from], to: [...to], one_way: oneWay }];
    const overlay = { ...record.overlay, links };
    assertOverlay(overlay, { roomCount: entriesOf(record).length, entries: entriesOf(record) });
    return {
        record: withOverlay(record, overlay),
        description: `connect ${from[0]}/${from[1]} ${oneWay ? '->' : '<->'} ${to[0]}/${to[1]}`,
    };
}

function disconnect(record, { room, exit_id: exitId }) {
    assertEndpoint(record, [room, exitId], 'disconnect');
    const links = record.overlay?.links ?? [];
    const at = links.findIndex((l) => (l.from?.[0] === room && l.from?.[1] === exitId)
        || (l.to?.[0] === room && l.to?.[1] === exitId));
    if (at === -1) {
        fail(`mazeSetAdapter: exit "${exitId}" of room ${room} is not linked, so there is `
            + 'nothing to disconnect');
    }
    const gone = links[at];
    return {
        record: withOverlay(record, { ...record.overlay, links: links.filter((_l, i) => i !== at) }),
        description: `disconnect ${gone.from[0]}/${gone.from[1]} — ${gone.to[0]}/${gone.to[1]}`,
    };
}

function setField(record, { path, value }) {
    if (!LIBRARY_FIELDS.includes(path)) {
        // ⛔ `library_id` gets its OWN sentence: it is not a field somebody
        //    forgot to declare, it is a STAMP over the content.
        if (path === 'library_id' || path === 'provenance') {
            fail(`mazeSetAdapter: \`${path}\` is STAMPED, not set. `
                + '`stampLibraryIdentity` writes it from the document\'s own content hash at '
                + 'download, and a hand-set id would make the library claim to be content it '
                + 'is not — the whole reason the id carries the hash.');
        }
        fail(`mazeSetAdapter: set-field takes ${LIBRARY_FIELDS.join(', ')}, got `
            + `${JSON.stringify(path)}`);
    }
    if (typeof value !== 'string' || (path === 'name' && value.length === 0)) {
        fail(`mazeSetAdapter: library ${path} must be a ${path === 'name' ? 'non-empty ' : ''}`
            + `string, got ${JSON.stringify(value)}`);
    }
    return {
        record: Object.freeze({ library: { ...record.library, [path]: value }, overlay: record.overlay }),
        description: `set library ${path} to ${JSON.stringify(value)}`,
    };
}

function setRoomField(record, { room, field, value }) {
    const entry = roomAt(record, room, 'set-room-field');
    if (!ROOM_FIELDS.includes(field)) {
        if (DERIVED_ENTRY_FIELDS.includes(field)) {
            fail(`mazeSetAdapter: \`${field}\` is DERIVED from the room's payload by the `
                + 'library\'s own capture path (`captureTileGridLibraryEntry`), not set by hand. '
                + `The derived fields are ${DERIVED_ENTRY_FIELDS.join(', ')}; a hand-set value `
                + 'would make the entry stale against its own tiles, which is exactly the drift '
                + '`mazeAtlasDerivation`\'s side cross-check refuses. Change the PAYLOAD '
                + '(`replace-room`) and the field follows.');
        }
        fail(`mazeSetAdapter: set-room-field takes ${ROOM_FIELDS.join(', ')}, got `
            + `${JSON.stringify(field)}`);
    }
    if (typeof value !== 'string' || value.length === 0) {
        fail(`mazeSetAdapter: a room ${field} must be a non-empty string, got `
            + `${JSON.stringify(value)}`);
    }
    const entries = entriesOf(record).map((e, i) => (i === room ? { ...e, [field]: value } : e));
    return {
        record: Object.freeze({ library: { ...record.library, entries }, overlay: record.overlay }),
        description: `set room ${room} ("${entry.entry_id}") ${field} to ${JSON.stringify(value)}`,
    };
}

function replaceRoom(record, { room, payload }, deps) {
    const entry = roomAt(record, room, 'replace-room');
    const next = entryFromPayload(payload, { entry_id: entry.entry_id, name: entry.name }, deps);
    /**
     * ⛔ AN EXIT THE NEW PAYLOAD NO LONGER HAS IS NAMED. The links live in the
     * overlay and would otherwise survive pointing at an exit that is gone —
     * `deriveAtlas` would then refuse with a sentence about the ATLAS, at a
     * point where the author can no longer see which room they replaced.
     */
    const ids = new Set((next.payload.exits ?? []).map((e) => e.exit_id));
    const orphaned = (record.overlay?.links ?? []).filter((l) => (
        (l.from?.[0] === room && !ids.has(l.from[1])) || (l.to?.[0] === room && !ids.has(l.to[1]))
    ));
    if (orphaned.length > 0) {
        fail(`mazeSetAdapter: the new payload for room ${room} ("${entry.entry_id}") has no `
            + `${orphaned.map((l) => (l.from[0] === room ? l.from[1] : l.to[1])).join(', ')} — `
            + `${orphaned.length} overlay link(s) name exit(s) it does not have. Disconnect them `
            + `first; its exits are ${[...ids].join(', ') || '(none)'}.`);
    }
    const entries = entriesOf(record).map((e, i) => (i === room ? next : e));
    return {
        record: Object.freeze({ library: { ...record.library, entries }, overlay: record.overlay }),
        description: `replace room ${room} ("${entry.entry_id}") — ${next.region_size.width}x`
            + `${next.region_size.height}, ${next.payload.exits.length} exit(s), `
            + `${next.location_slots} slot(s)`,
    };
}

function setOverlay(record, { room, overlay: entry }) {
    roomAt(record, room, 'set-overlay');
    const rooms = { ...(record.overlay?.rooms ?? {}) };
    if (entry === null || entry === undefined) delete rooms[String(room)];
    else rooms[String(room)] = entry;
    const overlay = { ...record.overlay, rooms };
    assertOverlay(overlay, { roomCount: entriesOf(record).length, entries: entriesOf(record) });
    return {
        record: withOverlay(record, overlay),
        description: `set the overlay of room ${room}`,
    };
}

function markLocation(record, { room, item, name, vanilla_item: vanillaItem }) {
    const entry = roomAt(record, room, 'mark-location');
    const items = entry.payload?.items ?? [];
    if (!Number.isInteger(item) || item < 0 || item >= items.length) {
        fail(`mazeSetAdapter: mark-location names item ${JSON.stringify(item)} of room ${room} `
            + `("${entry.entry_id}"), which holds ${items.length} item slot(s)`);
    }
    const rooms = { ...(record.overlay?.rooms ?? {}) };
    const before = rooms[String(room)] ?? {};
    const locations = [...(before.locations ?? [])];
    if (locations.some((l) => l.item === item)) {
        fail(`mazeSetAdapter: item ${item} of room ${room} is already marked as `
            + `"${locations.find((l) => l.item === item).name}"`);
    }
    locations.push({ item, name, vanilla_item: vanillaItem });
    rooms[String(room)] = { ...before, locations };
    const overlay = { ...record.overlay, rooms };
    assertOverlay(overlay, { roomCount: entriesOf(record).length, entries: entriesOf(record) });
    return {
        record: withOverlay(record, overlay),
        description: `mark item ${item} of room ${room} as location "${name}" (${vanillaItem})`,
    };
}

function unmarkLocation(record, { room, name }) {
    const entry = roomAt(record, room, 'unmark-location');
    const rooms = { ...(record.overlay?.rooms ?? {}) };
    const before = rooms[String(room)] ?? {};
    const locations = before.locations ?? [];
    const at = locations.findIndex((l) => l.name === name);
    if (at === -1) {
        fail(`mazeSetAdapter: room ${room} ("${entry.entry_id}") has no location named `
            + `${JSON.stringify(name)}. It has ${locations.map((l) => `"${l.name}"`).join(', ') || '(none)'}.`);
    }
    const key = locationRuleKey(name);
    const rules = { ...(before.rules ?? {}) };
    const hadRule = Object.hasOwn(rules, key);
    delete rules[key];
    rooms[String(room)] = { ...before, locations: locations.filter((_l, i) => i !== at) };
    if (Object.keys(rules).length > 0) rooms[String(room)].rules = rules;
    else delete rooms[String(room)].rules;
    return {
        record: withOverlay(record, { ...record.overlay, rooms }),
        description: `unmark location "${name}" of room ${room}`
            + (hadRule ? ' (and the access rule authored on it)' : ''),
    };
}

/**
 * ⛓⛓⛓ **`set-access-rule`, AND §21.2's DEFECT REFUSED FROM DAY ONE.**
 *
 * ⛔ An endpoint the compiler builds no AP exit for — the `to` of a one-way
 * link, or an exit nothing links at all — is REFUSED, using
 * `setEditorCore.gateabilityOf` over the DERIVED atlas: the same reading the
 * REPORT's inert-rule row uses, so the op and the report cannot disagree.
 * §21.2 found Seedling's op accepting exactly this; E3 makes Seedling refuse
 * it, and this adapter — being new — never accepted it.
 */
function setAccessRule(record, { room, target, rule, path = null }, deps) {
    const entry = roomAt(record, room, 'set-access-rule');
    const parsed = parseRuleTarget(target);
    if (deps.rulesSchema) {
        const errors = ruleSchemaErrors(rule, deps.rulesSchema);
        if (errors.length > 0) {
            fail(`mazeSetAdapter: this rule does not validate — ${errors.join(' · ')}`);
        }
    }
    if (parsed.kind === 'exit') {
        const { atlas } = deriveAtlasOf(record, deps);
        const region = (atlas.regions ?? []).find((r) => r.map_ref === room);
        if (!region || !(region.exits ?? []).some((e) => e.exit_id === parsed.id)) {
            fail(`mazeSetAdapter: room ${room} ("${entry.entry_id}") has no exit `
                + `"${parsed.id}" to hang an access rule on`);
        }
        const gate = gateabilityOf(atlas, region.region_id, parsed.id);
        if (!gate.gates) {
            fail(`mazeSetAdapter: a rule on exit "${parsed.id}" of room ${room} would REACH `
                + `NOTHING — ${gate.why}. ⛔ REFUSED rather than accepted: an authored rule the `
                + 'compiler builds no edge for leaves the author believing a door is gated and '
                + 'the world treating it as free, and the two are the same bytes downstream.');
        }
    } else {
        const locations = record.overlay?.rooms?.[String(room)]?.locations ?? [];
        if (!locations.some((l) => l.name === parsed.id)) {
            fail(`mazeSetAdapter: room ${room} ("${entry.entry_id}") has no location named `
                + `"${parsed.id}" — mark it first. It has `
                + `${locations.map((l) => `"${l.name}"`).join(', ') || '(none)'}.`);
        }
    }
    const rooms = { ...(record.overlay?.rooms ?? {}) };
    const before = rooms[String(room)] ?? {};
    const rules = { ...(before.rules ?? {}) };
    rules[target] = path === null || path.length === 0
        ? rule
        : replaceRuleAt(rules[target], path, rule);
    rooms[String(room)] = { ...before, rules };
    const overlay = { ...record.overlay, rooms };
    assertOverlay(overlay, { roomCount: entriesOf(record).length, entries: entriesOf(record) });
    return {
        record: withOverlay(record, overlay),
        description: `author a rule on ${target} of room ${room}`
            + (path === null || path.length === 0 ? '' : ` at path [${path.join('.')}]`),
    };
}

const OPS = Object.freeze({
    'add-room': addRoom,
    'remove-room': removeRoom,
    reorder,
    connect,
    disconnect,
    'set-field': setField,
    'set-room-field': setRoomField,
    'replace-room': replaceRoom,
    'set-overlay': setOverlay,
    'mark-location': markLocation,
    'unmark-location': unmarkLocation,
    'set-access-rule': setAccessRule,
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE ADAPTER
 * ══════════════════════════════════════════════════════════════════════ */

/**
 * @param {object} [o]
 * @param {object} [o.rulesSchema] parsed `rules.schema.json`; supply it and
 *   every authored rule is checked before it lands
 * @param {Function} [o.librarySource] `(library_id) => library`, for the `library` base
 * @param {Function} [o.overlaySource] `(overlay_id) => overlay`; absent = empty
 * @param {object} [o.capture] override the capture composition (the registry's)
 * @param {object} [o.atlas] the envelope handed to the derivation
 */
export function createMazeSetAdapter({
    rulesSchema = null, librarySource = null, overlaySource = null, capture = null,
    atlas = null, note = null,
} = {}) {
    const deps = { rulesSchema, capture, atlas, note };
    return Object.freeze({
        name: 'maze-set',

        apply(record, op) {
            const kind = op?.op;
            const fn = Object.hasOwn(OPS, kind) ? OPS[kind] : null;
            if (!fn) {
                return {
                    ok: false,
                    description: `maze-set: no op "${kind}" — the vocabulary is `
                        + `${SET_OP_KINDS.join(', ')}`,
                };
            }
            try {
                const { record: next, description } = fn(record, op, deps);
                return { ok: true, op, record: next, description };
            } catch (err) {
                if (isMazeSetRefusal(err)) {
                    return { ok: false, description: `maze-set: ${err.message}`, reason: err.name };
                }
                throw err;
            }
        },

        /** ⛓ BOTH HALVES, CANONICALLY. A record is its library AND its overlay. */
        equal: (a, b) => canonicalJson(a?.library) === canonicalJson(b?.library)
            && canonicalJson(a?.overlay) === canonicalJson(b?.overlay),

        bounds: (record) => ({ w: entriesOf(record).length, h: 1 }),
        readCell: readSetCell,
        writeOps: setWriteOps,

        bases: Object.freeze({
            library: (tag) => libraryBase(tag, { librarySource, overlaySource }),
        }),
    });
}

/**
 * ⛓⛓ **THE BASE CHECKS THE ID** — ⚖ ruling 2's shape (§13.5). A `library_id`
 * ends in the document's own content hash, so a session resolved out of a
 * DIFFERENT library would be editing rooms this base never named, and nothing
 * downstream could tell.
 */
function libraryBase(tag, { librarySource, overlaySource }) {
    if (typeof tag?.library_id !== 'string') {
        fail('mazeSetAdapter: a `library` base is {kind:\'library\', library_id, overlay_id?}, '
            + `got ${JSON.stringify(tag)}`);
    }
    if (!librarySource) {
        fail('mazeSetAdapter: a `library` base needs a `librarySource`, and none was injected. '
            + 'A region library arrives by PASTE or by fetch — both of them the PAGE\'s '
            + 'business — so the document is handed in.');
    }
    const library = librarySource(tag.library_id);
    if (!library || library.library_id !== tag.library_id) {
        fail(`mazeSetAdapter: no region library with library_id ${JSON.stringify(tag.library_id)} `
            + `is loaded here${library ? ` (the one that is holds ${JSON.stringify(library.library_id)})` : ''}. `
            + '⛔ REFUSED rather than opened against whatever library happens to be in hand: a '
            + '`library_id` carries the DOCUMENT\'s CONTENT HASH, so a session resolved out of a '
            + 'different library would be editing rooms this base never named.');
    }
    let overlay = emptyMazeOverlay();
    if (tag.overlay_id !== undefined && tag.overlay_id !== null) {
        if (!overlaySource) {
            fail(`mazeSetAdapter: this base names overlay_id ${JSON.stringify(tag.overlay_id)} `
                + 'and no `overlaySource` was injected. ⛔ An overlay that silently fell back to '
                + 'EMPTY would open a session missing every LINK, every location and every '
                + 'authored rule — and for the maze the links are the whole graph.');
        }
        overlay = overlaySource(tag.overlay_id);
        if (!overlay) {
            fail(`mazeSetAdapter: no overlay with overlay_id ${JSON.stringify(tag.overlay_id)} `
                + 'is loaded here');
        }
    }
    return setRecord(library, overlay);
}

/** A record from its two halves, with the overlay's shape refused by name. */
export function setRecord(library, overlay = emptyMazeOverlay()) {
    assertOverlay(overlay, {
        roomCount: (library?.entries ?? []).length,
        entries: library?.entries ?? [],
    });
    return Object.freeze({ library, overlay });
}

/** Open a set session over a region library. */
export function createSetSession(adapter, record, { base = null, certified = null } = {}) {
    return createEditSession(adapter, record, { base, certified });
}

/**
 * ⛓⛓⛓ **CLOSE A ROOM SESSION INTO THE LIBRARY — ONE `replace-room`.**
 *
 * EDITOR v3 E2b (§27.1 #3, §28). Seedling's twin takes the room session's
 * `record()` straight over, because an E1b room session's record IS the payload.
 * A MAZE room session's record is a live WORLD — `exits` and `items` are `Map`s
 * and the tiles are an `Int8Array` — so somebody owes the serialisation hop, and
 * E2a deliberately left `replace-room` taking a PAYLOAD so the choice was this
 * slice's. ⇒ **THE ADAPTER OWES IT**, not the page: then no page can pick the
 * wrong spelling.
 *
 * ⛔⛔ **AND THERE ARE TWO SPELLINGS.** `procgenMaze.js:270-281` says so by name:
 * `serializeMazeLevel`/`deserializeMazeLevel` is the LAB's loop-determinism
 * channel and carries NO AP vocabulary, while
 * `serializeMazeWorld`/`deserializeMazeWorld` is the LIBRARY payload with
 * AP-canonical exit and location names baked in. ⛓ This goes through
 * `MAZE_CAPTURE_DEPS` — the SAME composition `entryFromPayload` captures with —
 * so the spelling cannot drift from the one the entry constructor uses, and the
 * `regionId` handed to `extract` is the ENTRY'S OWN id for the same reason.
 * (Trap 714's shape, one arc over: one function, two spellings, only one
 * matches.)
 *
 * ⛓ Everything DERIVED — `region_size`, `exit_sides`, `location_slots`,
 * `carried_rules: null` — comes back from `replace-room`'s own re-capture rather
 * than from anything assembled here (§26.1 overturn #5).
 *
 * @param {object} setSession   the LIBRARY session
 * @param {object} roomSession  the ROOM session; its `record()` is a maze WORLD
 * @param {number} room         which entry it was opened from
 * @param {object} [o.capture]  the capture composition (the registry's, by default)
 */
export function closeRoomSession(setSession, roomSession, room, { capture = null } = {}) {
    const deps = capture ?? MAZE_CAPTURE_DEPS;
    const entry = roomAt(setSession.record(), room, 'closeRoomSession');
    const world = roomSession.record();
    if (!world || !(world.exits instanceof Map)) {
        fail(`mazeSetAdapter: closing room ${room} ("${entry.entry_id}") needs a room session `
            + 'whose `record()` is a tile-grid maze WORLD (its `exits` is a Map). ⛔ A PAYLOAD '
            + 'was handed over instead, and re-serialising one would be a second spelling of '
            + 'the capture path.');
    }
    const payload = deps.serialize(world, deps.extract(world, { regionId: entry.entry_id }));
    const result = setSession.apply({ op: 'replace-room', room, payload });
    if (!result.ok) {
        fail(`mazeSetAdapter: closing room ${room} ("${entry.entry_id}") into the library `
            + `session was REFUSED — ${result.description}`);
    }
    return result;
}

/** Fold an op list onto a record without opening a session. */
export const foldSetEdits = (adapter, record, ops) => foldEdits(adapter, record, ops);

/** A labelled group of set ops — ONE undo. ⛔ `reorder` is NOT one of these. */
export const setGroup = (label, ops) => group(label, ops);

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓ THE DOWNLOAD, AND THE VALIDATION IT RIDES ON
 * ══════════════════════════════════════════════════════════════════════ */

/** ⛓ The library the download would write — stamped ONCE, from a COPY. */
function stampedLibraryOf(record) {
    return stampLibraryIdentity(clone(record.library));
}

/**
 * ⛓ The download's errors as a LIST rather than a joined sentence — §20.11 #5's
 * ruling, for the same measured reason: `validateRegionLibrary` interpolates
 * entry ids and substrate names into its messages, both free-form, so a page
 * that split on a separator would turn one error into two on the first library
 * whose entry is called `a · b`.
 *
 * ⛓ It validates the SAME stamped document the download would, so a page cannot
 * be told the library is fine and then have the download refuse it.
 */
export function validateForDownload(session) {
    const library = stampedLibraryOf(session.record());
    const { ok, errors, warnings } = validateRegionLibrary(library);
    return { ok, errors: [...errors], warnings: [...warnings], library_id: library.library_id };
}

/**
 * ⛓⛓ **THREE DOCUMENTS, ONE STAMP, ONE PRESS — AND NO AP COMPANION.**
 *
 * Seedling's download carries an `apMappingInvalidation` document because a
 * Seedling level set has a VANILLA mapping an edit invalidates. A region
 * library never shipped as anybody's vanilla game, so there is no mapping to
 * invalidate. ⛔ SAID, not emitted empty: `apMapping: null` with a `why` is a
 * page that can print the reason, and an empty companion would read as
 * "checked, nothing to say".
 */
export function downloadLibrary(session, { validate = true } = {}) {
    const record = session.record();
    const library = stampedLibraryOf(record);
    let warnings = [];
    if (validate) {
        const result = validateRegionLibrary(library);
        if (!result.ok) {
            fail('mazeSetAdapter: this region library is not valid and is NOT downloaded — '
                + `${result.errors.join(' · ')}`);
        }
        warnings = result.warnings;
    }
    const overlay = stampIdentity(
        { ...record.overlay, provenance: { ...(record.overlay.provenance ?? {}) } },
        { idKey: 'overlay_id', defaultBase: 'maze-overlay' },
    );
    return {
        library,
        overlay,
        apMapping: null,
        apMappingWhy: 'a region library has no VANILLA mapping to invalidate — its entries are '
            + 'interchangeable content that never shipped as a game, so there is no companion '
            + 'to emit and an empty one would read as "checked, nothing to say"',
        report: {
            library_id: library.library_id,
            overlay_id: overlay.overlay_id,
            rooms: (library.entries ?? []).length,
            links: (record.overlay?.links ?? []).length,
            edits: session.ops().length,
            warnings,
        },
    };
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ RE-EXPORTS — the vocabulary read off the adapter's own module
 * ══════════════════════════════════════════════════════════════════════ */

export {
    deriveAtlasOf, emptyMazeOverlay, exitRuleKey, locationRuleKey, overlayErrors, rulesJsonOf,
};
