/**
 * seedlingDemo/levelSetExporter — generated rooms → a mountable level set.
 *
 * Phase 5 of `CC/docs/plans/seedling-external-level-sets.md`. Everything
 * downstream of this file already exists and is gated: `validateLevelSet` is the
 * sender-side authority, `planLevelSetChunks` bounds a delivery on rooms AND
 * bytes, `assembleLevelSetChunks` reassembles by room id, and the artifact
 * mounts and reports the result through `botLevelSet`. This is the producer they
 * have been waiting for since Phase 2.
 *
 * ── ⛔ WHAT THE GENERATOR DOES NOT HAVE, MEASURED RATHER THAN PAPERED OVER ───
 *
 * Plan §5 says "emit a manifest from generated levels", which presumes
 * `procgenSeedling`'s output already carries what a manifest needs. Measured
 * 2026-08-14, it does not, and the shortfall is structural rather than cosmetic:
 *
 *   1. ⛔ THE GENERATOR EMITS ONE ROOM PER INVOCATION AND HAS NO NOTION OF A
 *      SET. `--count` is the obstacle target, not a level count. There is no
 *      inter-room structure of any kind.
 *   2. ⛔ EVERY GENERATED RECORD CARRIES THE SAME IDENTITY — `level: 900`,
 *      `class: "Procgen900"`, `path: "procgen/900.oel"` (`SEEDLING_DEFAULTS`).
 *      Two records are indistinguishable, and the manifest needs dense ids
 *      0..N-1 and names unique within the set. Both are ASSIGNED here.
 *   3. ⛔ NO GENERATED ROOM HAS AN EXIT. No teleporter, no stairs, no
 *      `@fallthrough` — the palette places obstacles, not transitions. A set of
 *      N generated rooms is N ISOLATED ROOMS, and the player can only ever be in
 *      the one the manifest starts them in. That is Phase 5b's work (exits as
 *      data), and until it lands `reachability` below reports it every time
 *      rather than letting a set look whole because it validated.
 *   4. The manifest owns per-room metadata the generator never had: `music`,
 *      `snow_gradient`, `music_override_exempt`, plus `menu_rooms` at set level.
 *
 * ⇒ (1)–(3) are findings about the GENERATOR, recorded in the plan's Phase 5
 * as-built. (4) is this exporter's to supply — and it does so through
 * `provenance.invented`, a list of every field no input determined, so a reader
 * of the emitted set can tell a value that was MEASURED from one that was
 * CHOSEN. An empty findings list and a clean pass look identical otherwise.
 *
 * ── `named_rooms` ────────────────────────────────────────────────────────────
 *
 * ⚖ USER, 2026-08-14: requiredness is derived from the room data, so a set that
 * dereferences none of the six carries `named_rooms: {}`. A generated set has no
 * Watcher, no moonrock and no Owl, so that is the ordinary case here — and it is
 * CHECKED by `validateLevelSet` rather than assumed, which is what makes the
 * empty object a statement instead of a default. See `levelSetValidator.js`.
 *
 * Headless-safe: no `node:` imports and no DOM.
 */

import { recordToOel } from './procgenLevelOel.js';
import {
    LEVEL_SET_SCHEMA_VERSION,
    NAMED_ROOM_KEYS,
    parseRoomXml,
    stampLevelSetIdentity,
} from './levelSetValidator.js';

export class LevelSetExportError extends Error {
    constructor(message) {
        super(message);
        this.name = 'LevelSetExportError';
    }
}

const fail = (message) => { throw new LevelSetExportError(message); };

/**
 * ⛔ THE TILE SIZE IS NOT A FREE CHOICE HERE. A generated record's `startCell`
 * is in TILES and a manifest spawn is in PIXELS, exactly as `recordToOel`
 * converts geometry — the same factor, and getting it wrong would put the player
 * one sixteenth of the way into the room with nothing erroring.
 */
const TILE_SIZE = 16;

/** Music.songs index used when nothing determines one. Always reported. */
export const DEFAULT_MUSIC = 0;

/**
 * Build a level set from generated rooms.
 *
 * @param {Array<object|{record:object, summary?:object, name?:string, music?:number}>} entries
 *   One per room, IN SET ORDER — position is identity. A bare record is
 *   accepted and treated as `{record}`.
 * @param {object} [options]
 * @param {string} [options.setId]        base id; the content hash is appended
 * @param {string} [options.name]         human label for pickers
 * @param {string} [options.description]
 * @param {string} [options.generator]    provenance.generator
 * @param {object} [options.provenance]   extra provenance fields, merged
 * @param {number[]} [options.menuRooms]  title-screen cycle; defaults to [0]
 * @param {object} [options.start]        `{level,x,y}`; derived from entry 0
 * @param {object} [options.namedRooms]   defaults to `{}` — see the header
 * @returns {{set: object, report: object}}
 */
export function buildLevelSet(entries, options = {}) {
    if (!Array.isArray(entries) || entries.length === 0) {
        fail('levelSetExporter: buildLevelSet needs a non-empty array of generated rooms');
    }

    // ⚠ FIELD PATHS, NOT ONE ENTRY PER ROOM. A 116-room set would otherwise
    // carry 232 near-identical strings in its provenance and the reader would
    // skim past all of them — which defeats the point of writing it down.
    const inventedFields = new Set();
    const notes = [];
    const seenNames = new Map();

    const rooms = entries.map((raw, id) => {
        const entry = (raw && typeof raw === 'object' && raw.record) ? raw : { record: raw };
        const record = entry.record;
        if (record === null || typeof record !== 'object') {
            fail(`levelSetExporter: entries[${id}] has no level record`);
        }

        // ⛔ THE RECORD'S OWN `level` IS DISCARDED, DELIBERATELY, AND SAID SO.
        // Every generated record answers to 900 (SEEDLING_DEFAULTS), so keeping
        // it would make every room in the set claim the same index — and the
        // validator's positional-id rule would then refuse the set with a
        // message about array positions rather than about the generator. The
        // manifest's id IS the array position, and this is where it is assigned.
        if (Number.isInteger(record.level) && record.level !== id) {
            notes.push(`rooms[${id}]: the record answers to level ${record.level}; the set assigns ${id} (position is identity)`);
        }

        const name = entry.name ?? `${record.class ?? 'room'}_${String(id).padStart(3, '0')}`;
        if (typeof name !== 'string' || name.length === 0) {
            fail(`levelSetExporter: entries[${id}].name must be a non-empty string`);
        }
        if (seenNames.has(name)) {
            fail(`levelSetExporter: entries[${id}].name "${name}" duplicates entries[${seenNames.get(name)}] — names must be unique within a set. ⚠ Every generated record carries class "${record.class}", so a caller passing record.class straight through gets this for every room after the first`);
        }
        seenNames.set(name, id);
        if (entry.name === undefined) inventedFields.add('rooms[].name');

        const music = entry.music ?? options.music ?? DEFAULT_MUSIC;
        if (entry.music === undefined && options.music === undefined) inventedFields.add('rooms[].music');

        const room = { id, name, source: { xml: recordToOel(record) }, music };
        // Absent means false in the schema, so the flags are written only when
        // true — a set full of `false` would be noise, and the generator has no
        // opinion about either.
        if (entry.snow_gradient) room.snow_gradient = true;
        if (entry.music_override_exempt) room.music_override_exempt = true;
        return room;
    });

    // --- start ---------------------------------------------------------------
    //
    // ⛓ DERIVED WHEN THE GENERATOR ACTUALLY KNOWS IT. `summary.startCell` is the
    // cell the solver's player starts from, in TILES; a manifest spawn is in
    // PIXELS. That is a real measurement and is NOT listed as invented. Without
    // a summary there is nothing to derive from, and the entry says so.
    let start = options.start;
    if (start === undefined) {
        const cell = entries[0]?.summary?.startCell;
        if (cell && Number.isInteger(cell.tx) && Number.isInteger(cell.ty)) {
            start = { level: 0, x: cell.tx * TILE_SIZE, y: cell.ty * TILE_SIZE };
        } else {
            start = { level: 0 };
            inventedFields.add('start');
            notes.push('start: no summary.startCell on entries[0], so the arrival position falls to the Game constructor\'s own (80, 128)');
        }
    }

    const menuRooms = options.menuRooms ?? [0];
    if (options.menuRooms === undefined) inventedFields.add('menu_rooms');

    const namedRooms = options.namedRooms ?? {};
    if (options.namedRooms === undefined && Object.keys(namedRooms).length === 0) {
        notes.push(`named_rooms is empty: no generated room carries any of the six trigger entities, so all of ${NAMED_ROOM_KEYS.join(', ')} are omitted (⚖ user 2026-08-14). validateLevelSet CHECKS that against the rooms — it is not taken on trust`);
    }

    const set = {
        schema_version: LEVEL_SET_SCHEMA_VERSION,
        set_id: options.setId ?? 'procgen-seedling',
        ...(options.name === undefined ? {} : { name: options.name }),
        ...(options.description === undefined ? {} : { description: options.description }),
        provenance: {
            generator: options.generator ?? 'levelSetExporter',
            ...options.provenance,
            // ⛔ THE LIST IS PART OF THE DOCUMENT, not of a log nobody keeps. A
            // reader of the set must be able to tell a value the generator
            // determined from one this exporter chose, and a report printed once
            // at export time is gone by the time anyone asks.
            invented: [...inventedFields].sort(),
        },
        rooms,
        start,
        menu_rooms: menuRooms,
        named_rooms: namedRooms,
    };

    stampLevelSetIdentity(set, options.setId ?? 'procgen-seedling');

    return {
        set,
        report: { invented: [...inventedFields].sort(), notes, reachability: reachabilityOf(set) },
    };
}

/**
 * Which rooms can be reached from `start`, following only what the ROOM DATA
 * carries — the same three attributes `validateLevelSet` range-checks.
 *
 * ⛔ THIS IS A REPORT, NOT A RULE, AND THE DISTINCTION IS DELIBERATE. It lives
 * here rather than in the validator because a validator rule applies to VANILLA
 * too, and §9.3 is this arc's recorded case of a hardening rule that refuses the
 * real game — the 116 are reached by mechanisms this walk cannot see (a boss
 * that warps you, a debug key, `named_rooms`), so "unreachable" would be wrong
 * about them and right about a generated set. The generated case is the one
 * worth saying out loud, and this is where saying it costs nothing.
 *
 * ⛓ AND IT WILL REPORT EVERY GENERATED SET AS DISCONNECTED UNTIL PHASE 5b. No
 * generated room has an exit; the palette places obstacles, not transitions.
 * That is the finding, and a set that validated clean while being N unreachable
 * rooms is exactly the kind of quiet §6 exists to name.
 */
export function reachabilityOf(set) {
    const rooms = Array.isArray(set?.rooms) ? set.rooms : [];
    const startLevel = Number.isInteger(set?.start?.level) ? set.start.level : 0;
    const edges = rooms.map((room) => {
        const xml = room?.source?.xml;
        if (typeof xml !== 'string') return null;      // embed-sourced: unknown
        const doc = parseRoomXml(xml);
        return [...new Set([
            ...doc.exits.map((e) => e.to),
            ...doc.fallthroughs.map((f) => f.to),
        ].filter((n) => Number.isInteger(n) && n >= 0 && n < rooms.length))];
    });

    const seen = new Set();
    const queue = [startLevel];
    while (queue.length > 0) {
        const at = queue.pop();
        if (seen.has(at) || at < 0 || at >= rooms.length) continue;
        seen.add(at);
        for (const next of edges[at] ?? []) queue.push(next);
    }

    const unknown = edges.reduce((n, e) => n + (e === null ? 1 : 0), 0);
    const unreachable = rooms.map((r, i) => i).filter((i) => !seen.has(i));
    return {
        start: startLevel,
        reachable: seen.size,
        total: rooms.length,
        unreachable,
        // ⛔ NAME WHAT THE WALK COULD NOT SEE. An embed-sourced room's exits are
        // unreadable here, so a reachable count computed over them would be a
        // floor presented as a fact.
        rooms_not_walked: unknown,
    };
}

// --- §6.1: what a replaced set invalidates ------------------------------------

/**
 * The 24 vanilla level references the frontend holds outside the level set,
 * measured 2026-08-14 (plan §6.1) by asking the CONSUMER rather than by scanning
 * key names — which mattered: a scan for keys called `level` finds ZERO in the
 * atlas, whose level ids are called `map_ref`.
 *
 * ⛔ NONE OF THEM FORCES A `named_rooms` ENTRY. `named_rooms` exists for
 * references the game's own AS3 makes that a replaced set cannot otherwise
 * express. All 24 of these are the FRONTEND describing the vanilla game to
 * itself — a debug-teleport UI, an item jump-list and a map — and under a
 * replaced set they describe a game that is not loaded.
 */
export const VANILLA_AP_REFERENCES = Object.freeze([
    Object.freeze({
        artifact: 'frontend/modules/flashPanel/games/seedling.json',
        table: 'region_coords',
        count: 9,
        consumer: 'flashPanelUI region dropdown → flashBridgeAdapter.teleportToRegion',
        derivation: 'transcribed from Player.as\'s debug-warp list, SEVEN of the nine from the block that is commented out; the names are Message.as\'s seven <sign> titles',
    }),
    Object.freeze({
        artifact: 'frontend/modules/flashPanel/games/seedling.json',
        table: 'location_coords',
        count: 11,
        consumer: 'the same UI\'s item jump-list',
        derivation: 'exact and mechanical — the item entity\'s own position, y offset by one tile (+16 for ten, -16 for Conch alone)',
    }),
    Object.freeze({
        artifact: 'frontend/modules/flashPanel/atlases/seedling.json',
        table: 'regions[].map_ref',
        count: 4,
        consumer: 'the region atlas — region → level id (0, 86, 2, 3)',
        derivation: 'authored against the vanilla 116; regionAtlasValidator.js:196 says plainly "map_ref — a level id"',
    }),
]);

export const VANILLA_AP_REFERENCE_COUNT = VANILLA_AP_REFERENCES
    .reduce((n, r) => n + r.count, 0);

/**
 * The companion a generated set must ship with — ⚖ USER, 2026-08-14: INVALIDATE,
 * STAMPED.
 *
 * A generated set shipped with the vanilla AP mapping still attached is a silent
 * mismatch of exactly the kind plan §6 exists to name, and §6.1 records it as
 * the last one left in this arc. The cure is not to widen a vocabulary the game
 * reads: it is to say, carrying the same identity the save stamp uses, that
 * these 24 references do not describe this set. Regenerating them is derivable
 * later and does not change this contract.
 *
 * ⛓ THE STAMP IS THE MECHANISM ALREADY BUILT. `set_id` ends in the content hash
 * of the whole document, so an EDITED set reusing its id is a different set by
 * construction — which is the one thing a bare id cannot detect and the normal
 * case in development.
 */
export function apMappingInvalidation(set) {
    const setId = set?.set_id;
    const contentHash = set?.provenance?.content_hash;
    if (typeof setId !== 'string' || typeof contentHash !== 'string') {
        fail('levelSetExporter: apMappingInvalidation needs a STAMPED set — call stampLevelSetIdentity first, or the companion could not be matched to the set it invalidates');
    }
    return {
        schema_version: LEVEL_SET_SCHEMA_VERSION,
        set_id: setId,
        content_hash: contentHash,
        status: 'invalidated',
        reason: 'This set REPLACES the vanilla 116 rooms. The level references below were authored against the originals and describe a game that is not loaded; a consumer must refuse them under this set rather than jump to rooms that no longer exist. They are DERIVED tables (plan §6.1) and can be regenerated per set; nothing here forces a named_rooms entry.',
        references: VANILLA_AP_REFERENCES.map((r) => ({ ...r })),
        total_references: VANILLA_AP_REFERENCE_COUNT,
    };
}
