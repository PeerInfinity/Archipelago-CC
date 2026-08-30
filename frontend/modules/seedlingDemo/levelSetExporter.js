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
 * ── EDITOR v3 E1/E1b: `vanillaRecordSet` — THE SAME ASSEMBLER OVER REAL DATA ─
 *
 * `buildLevelSet` was written for GENERATED rooms and every Tier-B feature of
 * the set editor was demonstrated on them, because the committed vanilla set is
 * 116 `embed`-sourced rooms and an `embed` cannot be opened (plan §13.5). The
 * missing piece was never a fixture: the map extract's records are exactly the
 * shape a set's room carries, so the vanilla 116 is a pure FUNCTION of two
 * committed documents. `vanillaRecordSet` below is that function and the only
 * writer of it; the CLI's `--vanilla` arm and the watch page's
 * `#editLoadVanilla` button are its two callers.
 *
 * ⛓ E1 built it as `xml` (`vanillaXmlSet`, id base `seedling-vanilla-xml`);
 * ⚖ §22.8 made a room's `source` a `{record}` and E1b RE-POINTED the same PATH
 * join at the record, dropped the render and minted a new id. Same join, same
 * refusals, a different document.
 *
 * Headless-safe: no `node:` imports and no DOM.
 */

import { stableStringify } from '../procgenCore/contentIdentity.js';
import { linkGeneratedRooms } from './levelSetExits.js';
import {
    LEVEL_SET_SCHEMA_VERSION,
    NAMED_ROOM_KEYS,
    coreLevelRecord,
    indexOfRoom,
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
 * @param {object|boolean} [options.link] PHASE 5b: give the rooms EXITS before
 *        they are rendered. `true`, or `{topology, regions, element}` passed
 *        through to `linkGeneratedRooms`. ⛔ OPT-IN AND NOT A DEFAULT: this
 *        function is an assembler, and a caller whose records ALREADY carry
 *        exits (a hand-authored set, a retargeted one) must not have a second
 *        set of doors added underneath it. The CLI and the round trip pass it,
 *        so the PRODUCT is connected while the library stays honest.
 * @returns {{set: object, report: object}}
 */
export function buildLevelSet(entries, options = {}) {
    if (!Array.isArray(entries) || entries.length === 0) {
        fail('levelSetExporter: buildLevelSet needs a non-empty array of generated rooms');
    }

    // --- PHASE 5b: exits, on the RECORDS ---------------------------------------
    //
    // ⛓ IT HAS TO HAPPEN HERE. `linkGeneratedRooms` adds ENTITIES to a record.
    // ⛓⛓ EDITOR v3 E1b: this used to be "before anything is rendered to OEL",
    // and the render is GONE from this function — so the argument is now simply
    // that a record is the thing to edit while it is still in hand, and the
    // RETARGET arm exists for the legacy `xml` rooms that are not.
    let linkReport = null;
    let doors = [];
    if (options.link) {
        const opts = options.link === true ? {} : options.link;
        const linked = linkGeneratedRooms(entries.map((raw) => {
            const entry = (raw && typeof raw === 'object' && raw.record) ? raw : { record: raw };
            return {
                record: entry.record,
                // The generator's own start cell, which is the origin every
                // reachability claim about this room is made from.
                start: entry.summary?.startCell ?? { tx: 1, ty: 1 },
            };
        }), opts);
        linkReport = linked.report;
        doors = linked.doors;
        entries = entries.map((raw, i) => {
            const entry = (raw && typeof raw === 'object' && raw.record) ? raw : { record: raw };
            return { ...entry, record: linked.records[i] };
        });
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

        /**
         * ⛓⛓⛓ **EDITOR v3 E1b — THE SET CARRIES THE RECORD, NOT ITS RENDER**
         * (⚖ plan §22.8). `recordToOel` used to be the LAST step of this
         * function; it is now the FIRST step of delivery
         * (`planLevelSetChunks`), because the game's Ogmo loader is the last
         * hop and everything between here and it is JSON.
         *
         * ⛔ `coreLevelRecord` and not the record as handed in: a generated
         * record carries `level`, a map-extract record carries `class`, `path`
         * and `tiles_outside_level`, and each of those would be a second
         * authority for something the SET already says (see its own note).
         */
        const room = { id, name, source: { record: coreLevelRecord(record) }, music };
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
        report: {
            invented: [...inventedFields].sort(),
            notes,
            reachability: reachabilityOf(set),
            // ⛓ THE DOORS TRAVEL IN THE REPORT, NOT IN THE SET. Each carries the
            // free cell it is approached from and the direction key that walks
            // into it, which is what lets the round trip DRIVE a transition in
            // the artifact instead of asserting that a number crossed. The set
            // document's schema is frozen at v1 and this is not part of it.
            ...(linkReport === null ? {} : { link: linkReport, doors }),
        },
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
        // ⛓ EDITOR v3 E1b — ONE INDEX DOOR. `null` is an `embed` room, still
        // counted in `rooms_not_walked` rather than passed off as having none.
        const doc = indexOfRoom(room);
        if (doc === null) return null;
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

// --- THE VANILLA 116 AS `record` ----------------------------------------------

/**
 * The stamp base for the record-sourced vanilla set — ⛔ **NEVER
 * `seedling-vanilla`**, and the difference is the whole point.
 *
 * `fixtures/seedling-vanilla-set.json` carries `seedling-vanilla-02408e1d`:
 * ⚖ ruling 2's subject, `VanillaSet.SET_ID` in the AS3 fork, and what every
 * save stamp keys on (`levelSetValidator.js:222`). The set THIS function builds
 * is DIFFERENT BYTES — the same 116 rooms carried as level RECORDS instead of
 * as `[Embed]` paths — so it takes an id of its own and the two COEXIST by
 * construction. A shared base would have made `<base>-<hash>` the only thing
 * telling them apart, i.e. one careless truncation away from a set claiming to
 * be the one the save files name.
 *
 * ⛓⛓⛓ **EDITOR v3 E1b RETIRED `seedling-vanilla-xml`, AND THE MOVE WAS THE
 * POINT OF SAYING SO.** E1 pinned `seedling-vanilla-xml-02a70624` — the hash of
 * the OEL-BEARING document. ⚖ §22.8 makes a room's `source` a `{record}`, so
 * this function's output is a different document and MUST take a different
 * hash; a base that stayed put would have produced a THIRD id under an old
 * name. Plan §23.12 item 6 pinned the retirement in advance, and §24 pins the
 * replacement.
 */
export const VANILLA_RECORD_SET_ID_BASE = 'seedling-vanilla-record';

/** The one place the two committed inputs' shapes are checked, by name. */
function requireArray(value, label) {
    if (!Array.isArray(value) || value.length === 0) {
        fail(`levelSetExporter: vanillaRecordSet needs ${label} — got ${JSON.stringify(value)?.slice(0, 60)}`);
    }
    return value;
}

/**
 * The longest `/`-terminated prefix every string shares. REPORTED, never used
 * to join: it is the MEASUREMENT of the difference between the two documents'
 * roots, and a set whose rooms all sat in one subdirectory would give a longer
 * one that is still perfectly true about the corpus and useless as a rule.
 */
function commonDirPrefix(paths) {
    if (paths.length === 0) return '';
    let prefix = paths[0];
    for (const p of paths) {
        let i = 0;
        while (i < prefix.length && i < p.length && prefix[i] === p[i]) i += 1;
        prefix = prefix.slice(0, i);
    }
    const cut = prefix.lastIndexOf('/');
    return cut < 0 ? '' : prefix.slice(0, cut + 1);
}

/**
 * The vanilla 116 as a `record`-sourced level set — a pure function of TWO
 * COMMITTED DOCUMENTS and nothing else.
 *
 * ── WHY THIS IS A FUNCTION AND NOT A FIXTURE ─────────────────────────────────
 *
 * Both inputs are already in the repository and both already reach the watch
 * page: `flashPanel/atlases/seedling-map.json` (the Phase-2 extract, 116
 * records) and `fixtures/seedling-vanilla-set.json` (the manifest, 116
 * `embed`-sourced rooms). A map record IS the shape a set's room carries since
 * ⚖ plan §22.8, so `buildLevelSet` writes `source: {record}` and there is no
 * render on this path at all. ⇒ a third committed copy of the 116 would be a
 * document that is a pure function of two documents beside it, stale the day
 * either moves. The CLI's `--vanilla` arm and the page's `#editLoadVanilla`
 * button are two CALLERS of this; there is exactly ONE writer.
 *
 * ⛓⛓ **AND E1b TOOK 1.12 MB OUT OF IT.** MEASURED: this set is **528,752 B**
 * as records and **1,652,312 B** with every room rendered — **32.0%**, a 3.12×
 * reduction —
 * because the text form escapes every attribute and repeats an element name
 * twice per entity. The OEL is regenerated at the chunk boundary, where it is
 * what crosses.
 *
 * ── ⛔ THE JOIN IS BY PATH, NEVER BY INDEX ───────────────────────────────────
 *
 * MEASURED 2026-08-25: the map's `levels[i].level === i` and the set's
 * `rooms[i].id === i` for all 116, so an index join gives the same answer TODAY
 * on this corpus — which is exactly what makes it the dangerous spelling. The
 * two documents are produced by two different extractors
 * (`extract-seedling-map.mjs` and `extract-seedling-vanilla-set.py`) and
 * nothing keeps their orders in step; a set built from a reordered map would
 * carry every room's geometry under its neighbour's name and validate clean.
 * The join key is the FILE: a record's `path` relative to the map document's
 * own `source.level_root`, matched against the room's `source.embed` on a
 * SEGMENT BOUNDARY (measured difference: `assets/levels/…` vs `levels/…`, i.e.
 * one leading directory — reported in `report.join`, not typed into the rule).
 * A room whose embed matches no record, or two records, or a record another
 * room already claimed, REFUSES BY NAME.
 *
 * ── WHAT IS CARRIED, AND HOW THAT IS PROVED ──────────────────────────────────
 *
 * Every manifest field (`name`, `description`, `start`, `menu_rooms`,
 * `named_rooms`) and every room field but `source` is carried VERBATIM from the
 * embed set, and the function CHECKS both by re-encoding through the identity's
 * own `stableStringify` rather than promising it. `report.invented` must come
 * back EMPTY — that is the proof no field was guessed, so a non-empty one is a
 * refusal here rather than a line in a report nobody reads.
 *
 * @param {object} embedSet  the committed vanilla manifest (116 `embed` rooms)
 * @param {object} mapDoc    the committed map extract (116 records)
 * @returns {{set: object, report: object}} `report` is `buildLevelSet`'s, plus
 *   `join` (the measured prefixes and the match tally)
 */
export function vanillaRecordSet(embedSet, mapDoc) {
    const rooms = requireArray(embedSet?.rooms, 'the embed set\'s `rooms`');
    const levels = requireArray(mapDoc?.levels, 'the map document\'s `levels`');
    const levelRoot = mapDoc?.source?.level_root;
    if (typeof levelRoot !== 'string' || levelRoot === '') {
        fail('levelSetExporter: vanillaRecordSet needs the map document\'s `source.level_root` — '
            + 'it is what the join key is measured relative to, and guessing a root would make '
            + 'every path in the document mean something this function chose');
    }

    // --- the join key: each record's path, relative to the map's own root -----
    const root = `${levelRoot}/`;
    const byRel = new Map();
    levels.forEach((record, i) => {
        const path = record?.path;
        if (typeof path !== 'string' || !path.startsWith(root)) {
            fail(`levelSetExporter: vanillaRecordSet — map levels[${i}].path ${JSON.stringify(path)} `
                + `is not under the document's own source.level_root ${JSON.stringify(levelRoot)}`);
        }
        const rel = path.slice(root.length);
        if (byRel.has(rel)) {
            fail(`levelSetExporter: vanillaRecordSet — map levels[${i}] and levels[${byRel.get(rel).i}] `
                + `both name ${JSON.stringify(rel)}; the join key would be ambiguous`);
        }
        byRel.set(rel, { record, i });
    });

    const claimedBy = new Map();
    let exact = 0;
    let bySuffix = 0;
    const entries = rooms.map((room, id) => {
        const embed = room?.source?.embed;
        if (typeof embed !== 'string' || embed === '') {
            fail(`levelSetExporter: vanillaRecordSet — rooms[${id}] `
                + `${JSON.stringify(room?.name ?? null)} is not embed-sourced `
                + `(source: ${JSON.stringify(room?.source)}); this function turns `
                + '`embed` paths into `record`s, and has nothing to look up for any other source');
        }
        const hits = [...byRel.entries()]
            .filter(([rel]) => embed === rel || embed.endsWith(`/${rel}`));
        if (hits.length === 0) {
            fail(`levelSetExporter: vanillaRecordSet — rooms[${id}] "${room.name}" embeds `
                + `${JSON.stringify(embed)} and NO map record names that file (the map's `
                + `${levels.length} records are rooted at ${JSON.stringify(levelRoot)}). A renamed `
                + 'or re-extracted level is the ordinary cause, and joining by position instead '
                + 'would have carried the neighbouring room\'s geometry silently');
        }
        if (hits.length > 1) {
            fail(`levelSetExporter: vanillaRecordSet — rooms[${id}] "${room.name}" embeds `
                + `${JSON.stringify(embed)} and ${hits.length} map records name that file `
                + `(${hits.map(([rel]) => rel).join(', ')}); the join would have to guess`);
        }
        const [rel, { record, i }] = hits[0];
        if (claimedBy.has(rel)) {
            fail(`levelSetExporter: vanillaRecordSet — rooms[${id}] "${room.name}" and rooms[`
                + `${claimedBy.get(rel)}] both join to map levels[${i}] (${rel}); one record `
                + 'cannot be two rooms');
        }
        claimedBy.set(rel, id);
        if (embed === rel) exact += 1; else bySuffix += 1;

        // ⛓ EVERY ROOM FIELD BUT `source` AND `id` TRAVELS. `id` is the array
        // position and `buildLevelSet` assigns it; `source` is what this
        // function replaces. Anything else is the manifest's and is passed
        // through — the CHECK below is what makes that a fact rather than a
        // hope, because this spread reaches `buildLevelSet`, which writes the
        // fields it knows and would drop a seventh in silence.
        const { source: _source, id: _id, ...carried } = room;
        return { ...carried, record };
    });

    const { set, report } = buildLevelSet(entries, {
        setId: VANILLA_RECORD_SET_ID_BASE,
        generator: 'levelSetExporter.vanillaRecordSet',
        // Only the fields the embed set ACTUALLY carries: passing `undefined`
        // for an absent one would put `buildLevelSet` back on its own defaults
        // and list them as invented, which is the failure this arm exists to
        // make impossible.
        ...(Object.hasOwn(embedSet, 'name') ? { name: embedSet.name } : {}),
        ...(Object.hasOwn(embedSet, 'description') ? { description: embedSet.description } : {}),
        ...(Object.hasOwn(embedSet, 'start') ? { start: embedSet.start } : {}),
        ...(Object.hasOwn(embedSet, 'menu_rooms') ? { menuRooms: embedSet.menu_rooms } : {}),
        ...(Object.hasOwn(embedSet, 'named_rooms') ? { namedRooms: embedSet.named_rooms } : {}),
        provenance: {
            // ⛓ WHICH SET THIS REPRODUCES, BY ITS OWN IDENTITY. `derived_from`
            // is what lets a reader of the xml set — or of a re-stamped
            // descendant of it — say which vanilla it came from, and it is what
            // the §6.1 companion's note points at.
            derived_from: {
                set_id: embedSet.set_id ?? null,
                content_hash: embedSet.provenance?.content_hash ?? null,
            },
            map: {
                generator: mapDoc.generator ?? null,
                source: mapDoc.source,
            },
        },
    });

    // --- ⛔ THE CARRY IS CHECKED, NOT PROMISED --------------------------------
    //
    // `buildLevelSet` writes a room from a closed set of fields
    // (`id, name, source, music` + two flags) and a manifest from a closed set
    // of options. Both are the RIGHT authorities — but a field the embed set
    // carries and this exporter cannot express would be DROPPED in silence, and
    // "silently drops what it cannot carry" is the failure this whole arc is
    // written against. So the output is differenced against the input, under
    // the identity's own encoding, and a drop REFUSES BY NAME.
    for (const field of ['name', 'description', 'start', 'menu_rooms', 'named_rooms']) {
        if (!Object.hasOwn(embedSet, field)) continue;
        if (stableStringify(set[field]) !== stableStringify(embedSet[field])) {
            fail(`levelSetExporter: vanillaRecordSet — the manifest field \`${field}\` did not `
                + `survive: ${JSON.stringify(embedSet[field])} went in and `
                + `${JSON.stringify(set[field])} came out`);
        }
    }
    set.rooms.forEach((out, id) => {
        const { source: _outSource, ...outRest } = out;
        const { source: _inSource, ...inRest } = rooms[id];
        if (stableStringify(outRest) !== stableStringify({ ...inRest, id })) {
            fail(`levelSetExporter: vanillaRecordSet — rooms[${id}] "${rooms[id].name}" lost or `
                + `gained a field: ${JSON.stringify(inRest)} went in and `
                + `${JSON.stringify(outRest)} came out (\`source\` excluded — it is what this `
                + 'function replaces)');
        }
    });
    if (report.invented.length > 0) {
        fail('levelSetExporter: vanillaRecordSet INVENTED '
            + `${report.invented.join(', ')} — every field of this set comes from one of the two `
            + 'committed documents, so an invented one means a field was not passed through and '
            + 'the set would carry a value nobody chose');
    }

    return {
        set,
        report: {
            ...report,
            /**
             * The MEASUREMENT of the two documents' roots, and the tally of how
             * each room found its record. A reader who wants to know why the
             * join is a suffix match rather than a strip-and-compare gets the
             * answer from the data instead of from a comment.
             */
            join: {
                rooms: rooms.length,
                level_root: levelRoot,
                embed_prefix: commonDirPrefix(rooms.map((r) => r.source.embed)),
                matched_exact: exact,
                matched_by_suffix: bySuffix,
            },
        },
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
