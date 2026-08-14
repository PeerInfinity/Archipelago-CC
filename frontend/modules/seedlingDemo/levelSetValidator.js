// Seedling level-set validator — the authoritative enforcement point for the
// external-level-set format (CC/docs/plans/seedling-external-level-sets.md,
// Phase 2). The JSON Schema files document the same shape for editors:
//   frontend/schema/seedling-level-set.schema.json        the whole set
//   frontend/schema/seedling-level-set-chunk.schema.json  one EI call
// but the cross-reference rules below are the ones that matter, and JSON Schema
// structurally cannot express any of them: level-index range on the three OEL
// attributes, the closed 7-entry sign table, the 30-tag ceiling, FinalBoss's
// tag+1, ButtonRoom's tset-as-tag ACROSS rooms, named_rooms completeness, and
// content-hash identity.
//
// ⛔ WHY THIS MODULE IS THE ONLY LINE OF DEFENCE. The game does not check. An
// out-of-range level boots with `load: ok`, `start: ok`, no error and a live VM,
// and reads its whole persistence row as EVERY TAG ALREADY CLEARED — driven in
// the recompiled runtime at levels 116 and 200 against level-0/115 controls
// (plan §8.3). `levelPersistence` is a plain Array, not a Vector, so a read past
// the end returns `undefined`, which the `:Boolean` return type coerces to
// `false`, which in this polarity means "cleared". Nothing errors; it quietly
// means something else. A set that fails validation is therefore refused BY
// NAME and never coerced.
//
// Headless-safe: no top-level await, no `node:` imports, no DOM — this module is
// in the bundled browser graph and the OEL parse below is deliberately regex
// based rather than DOMParser/ElementTree based for that reason.

import { TAGS_PER_LEVEL } from './breakableRocks.js';

export const LEVEL_SET_SCHEMA_VERSION = 1;

// Music.songs has exactly 14 entries (Music.as:218-220) and Game.as:198 sets
// bossMusic = 13, the last of them. -1 is legal and means "the room's boss
// writes this slot at runtime" — measured: the seven vanilla rooms whose static
// levelMusics entry is -1 are exactly the seven boss rooms (19, 32, 43, 57, 69,
// 82, 112), which is §8.2c's list of seven runtime mutators arriving from the
// data side.
export const MUSIC_COUNT = 14;
export const MUSIC_NONE = -1;

// Message.as:15-16 holds `titles` and `subtitles` of exactly 7 entries, indexed
// by `_sign` where the parsers store `sign - 1` (Teleporter's ctor, and
// Game.as:2129 `fallthroughSign = int(o.@sign) - 1`). So 0 means "no sign" and
// 1..7 index the table. ⛔ THE TABLE IS CLOSED: a set cannot name an eighth
// region without an AS3 change, which is out of scope here — this records the
// bound, it does not widen it.
export const SIGN_NONE = 0;
export const SIGN_TABLE_SIZE = 7;

// The Game constructor's own defaults (Game.as:629), used when a spawn omits
// x/y so the manifest never has to restate them.
export const DEFAULT_SPAWN_X = 80;
export const DEFAULT_SPAWN_Y = 128;

// --- transport constants (plan §8.1) -----------------------------------------
//
// ⛔ THESE LIVE BESIDE THE SENDER, NOT IN THE DATA. No authored set carries a
// delivery number: re-chunking is a delivery decision and must edit no set.
//
// What was measured: a whole set cannot cross EI in one call. The vanilla set is
// 1,676,662 B of JSON; 1,264,992 B (80 rooms) survives and 1,353,464 B (88)
// aborts. The cause is the 0.5 GB AVM2 GC arena, not EI marshalling and not the
// 8 MB shadow stack — 2 MB of JSON-legal WHITESPACE crosses and parses fine
// while 1.35 MB of real structure aborts, so the binding constraint is the
// parsed object graph.
//
// ⚠ AND THE LIMIT IS NOT A SINGLE NUMBER. Cumulative total is not the limiter
// (16 rooms survived 15 consecutive calls totalling 3,599,505 B) but 32
// rooms/call SUCCEEDS ON THE FIRST CALL AND DIES ON A LATER ONE. What fails is
// repeated allocation in the arena, which no per-call size can express. ⇒ a
// chunk size is only ever validated BY REPETITION, never by a single call.
export const MAX_ROOMS_PER_CHUNK = 16;

// ⚠ AND 16 ROOMS ALONE IS NOT SUFFICIENT — measured, and it bites on VANILLA.
// The 16-room figure was proven on a corpus whose mean room is 11,946 B, so it
// is a proxy for the thing that actually failed: allocation volume. Vanilla's
// own largest room is 135,847 B (Dungeon4/2.oel) and its worst 16-room window in
// set order is 424,299 B — larger than the 404,224 B chunk that ABORTED at 32
// rooms. A rooms-only bound would hand that window to the runtime as one call.
// ⇒ bound on rooms AND bytes, whichever binds first. The byte figure is the
// serialized chunk JSON — what actually crosses and gets parsed — and 239,967 B
// is the size proven over 15 consecutive calls.
export const MAX_CHUNK_BYTES = 239967;

// The nine LIVE debug warps on keys 1-9 (Player.as:1827-1999), each preceded by
// Main.clearSave(). Only the Key.E block above them is commented out; these are
// not, and the source's own comment reads "For the love of god, please make sure
// you remove this." They compose badly with §8.3: under a small custom set these
// indices are out of range and boot as "everything already cleared", silently.
// A set author cannot control them, so this is a WARNING, not a refusal.
export const DEBUG_WARP_LEVELS = [2, 13, 12, 37, 45, 95, 12, 93, 110];

// ⛔ CLOSED VOCABULARY, AND REQUIREDNESS IS DERIVED FROM THE ROOM DATA. These
// are the room references that live in CODE rather than in level data, so NO
// bundle rewrite can reach them (plan §8.2a) — which is why the manifest is the
// only place they can be expressed. An invented name would do nothing at all.
//
// ⚖ USER, 2026-08-14 (plan §14): an entry may be OMITTED exactly when the set
// contains nothing that dereferences it, and the validator decides that from the
// rooms rather than taking the author's word. Phase 2 required all six, ruled
// when VANILLA WAS THE ONLY SET IN EXISTENCE; a generated set has no Watcher, no
// moonrock and no Owl, and §4.1's "must say so rather than defaulting silently"
// had no way to be said. Omission is now the way to say it, and it is CHECKED —
// which is what makes it a statement rather than a default.
//
// ⛓ AND NONE OF THE SIX IS DEREFERENCED UNCONDITIONALLY — measured 2026-08-14,
// every call site, and it is what makes the rule possible. Each sits inside one
// entity's own behaviour, and every one of those entities is built ONLY from an
// OEL element (`Game.as:2166-2287`), so the validator can already see it.
//
// ⛔ `trigger` IS NOT THE SAME-NAMED ELEMENT, AND `bloody_seed_ending` IS THE
// PROOF. The OEL `<seed>` element always constructs `new Seed(o.@x, o.@y, false,
// …)` — `bloody` is hardcoded FALSE there — and the only bloody Seed in the game
// is born at `NPCs/Watcher.as:102` when the Watcher is killed. So the element
// whose presence makes `bloody_seed_ending` live is `<watcher>`, not `<seed>`.
// A key-name match would have got exactly one of the six wrong, and it is the
// same trap as `@fallthrough`, `@room` and `map_ref`: ASK THE CONSUMER.
//
// `warp` entries are constructed with an arrival position and carry x/y;
// `persistence` entries are a cross-level tag index and carry only a level.
//
// ⛔ `position` IS ITS OWN FIELD, not inferred from `kind`. `moonrock_target` is
// BOTH — a cross-level persistence write (Moonrock.as:135) and a teleporter
// built with an arrival (Moonrock.as:134) — so a `kind === 'warp'` test would
// have quietly excused the one entry that needed the requirement most.
export const NAMED_ROOMS = Object.freeze({
    moonrock_target: {
        kind: 'persistence+warp', position: true,
        cite: 'Scenery/Moonrock.as:134 (teleporter) and :135 (persistence)', vanilla: 2,
        trigger: 'moonrock',
        via: 'Game.as:2244 builds every Moonrock from <moonrock>, and Moonrock.as:131-136 is the only reader',
    },
    watcher_text: {
        kind: 'persistence', position: false, cite: 'Scenery/FinalDoor.as:50', vanilla: 114,
        trigger: 'finaldoor',
        via: 'Game.as:2284 builds every FinalDoor from <finaldoor>',
    },
    dark_shrum_death: {
        kind: 'warp', position: true, cite: 'Player.as:491', vanilla: 114,
        trigger: 'oracle',
        via: 'NPCs/Oracle.as:107 is the ONLY sprShrumDark.play("die"), and Game.as:2271 builds every Oracle from <oracle>',
    },
    bloody_seed_ending: {
        kind: 'warp', position: true, cite: 'Pickups/Seed.as:73', vanilla: 1,
        trigger: 'watcher',
        via: 'NPCs/Watcher.as:102 is the ONLY `new Seed(…, true, …)`; the OEL <seed> at Game.as:2227 always passes bloody=false',
    },
    light_boss_exit: {
        kind: 'warp', position: true, cite: 'Enemies/LightBossController.as:104', vanilla: 36,
        trigger: 'lightbosscontroller',
        via: 'Game.as:2166 builds every LightBossController from <lightbosscontroller>',
    },
    tentacle_beast_mouth: {
        kind: 'warp', position: true, cite: 'Enemies/TentacleBeast.as:213', vanilla: 58,
        trigger: 'tentaclebeast',
        via: 'Game.as:2173 builds every TentacleBeast from <tentaclebeast>',
    },
});

export const NAMED_ROOM_KEYS = Object.freeze(Object.keys(NAMED_ROOMS));

/** The OEL elements whose presence makes a `named_rooms` entry mandatory. */
export const NAMED_ROOM_TRIGGERS = Object.freeze(
    NAMED_ROOM_KEYS.map((k) => NAMED_ROOMS[k].trigger),
);

// Hitboxes, for the one rule that needs GEOMETRY. `Moonrock.as:131` finds the
// stairs it is about to replace with `collide("Teleporter", x, y)` — by overlap,
// not by name — so the only way to know WHICH stairs a manifest entry must agree
// with is to reproduce the overlap.
export const MOONROCK_HITBOX = 48;      // Scenery/Moonrock.as:46  setHitbox(48, 48)
export const TELEPORTER_HITBOX = 16;    // Teleporter.as:36        setHitbox(16, 16, 0, 0)

/** FlashPunk hitboxes, both with a zero origin: [x, x+w) x [y, y+h). */
function hitboxesOverlap(ax, ay, aSize, bx, by, bSize) {
    return ax < bx + bSize && bx < ax + aSize && ay < by + bSize && by < ay + aSize;
}

// --- helpers -----------------------------------------------------------------

const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

// --- content-hash identity (mirrors regionAtlasValidator's precedent) ---------
//
// ⛔ THIS IS FOR THE SAVE STAMP, NOT FOR TRANSPORT INTEGRITY. Plan §4.2's rule
// is "if the save's set_id matches the mounted set, KEEP the persistence table."
// `set_id` alone cannot detect an EDITED SET REUSING ITS ID — the normal case in
// development: regenerate a procgen set, same id, different rooms, and you keep
// a persistence table whose rows describe entities that no longer exist at
// indices that now mean different rooms. That is exactly the silent
// reinterpretation §4.2 exists to prevent. Stamping the id WITH the hash closes
// it: an edited set is a different set by construction.

export function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

function fnv1a32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}

export function computeLevelSetContentHash(set) {
    const content = { ...set };
    delete content.provenance;
    delete content.set_id;
    return fnv1a32(stableStringify(content));
}

/** Stamp (or re-stamp) identity in place; idempotent. Returns the set. */
export function stampLevelSetIdentity(set, baseId = null) {
    const hash = computeLevelSetContentHash(set);
    let base = baseId ?? set.set_id ?? 'level-set';
    if (baseId == null) {
        const prior = set.provenance?.content_hash;
        if (typeof prior === 'string' && base.endsWith(`-${prior}`)) {
            base = base.slice(0, -(prior.length + 1));
        }
    }
    set.set_id = `${base}-${hash}`;
    if (!isPlainObject(set.provenance)) set.provenance = {};
    set.provenance.content_hash = hash;
    return set;
}

/**
 * The stamp a save file must carry, and the comparison it must make.
 *
 * ⛔ A MISMATCH ON EITHER FIELD MUST FORCE A FRESH SAVE AND SAY SO — never
 * reinterpret. SAVE_FILE.data carries `level`, `playerPositionX/Y`,
 * `levelPersistence` and ~28 inventory booleans, and NO level-set identity, so
 * today a save from set A loaded under set B resumes at an index meaning a
 * different room with a persistence table describing different entities, and
 * nothing errors.
 */
export function levelSetSaveStamp(set) {
    return { set_id: set?.set_id ?? null, content_hash: set?.provenance?.content_hash ?? null };
}

export function saveStampMatches(stamp, set) {
    const current = levelSetSaveStamp(set);
    return isPlainObject(stamp)
        && stamp.set_id === current.set_id
        && stamp.content_hash === current.content_hash;
}

// --- OEL parsing --------------------------------------------------------------
//
// Regex rather than a real XML parser: this module is in the bundled browser
// graph, and the OEL files are flat machine-generated Ogmo output. Cross-checked
// against a Python ElementTree walk over the 116 embedded rooms — both give
// 228 teleporters and 52 stairs, so the two methods agree on the corpus.

const ELEMENT_RE = /<([A-Za-z_][\w.-]*)((?:\s+[\w.:-]+\s*=\s*"[^"]*")*)\s*\/?>/g;
const ATTR_RE = /([\w.:-]+)\s*=\s*"([^"]*)"/g;

function attrsOf(raw) {
    const out = {};
    ATTR_RE.lastIndex = 0;
    let m = ATTR_RE.exec(raw);
    while (m !== null) {
        out[m[1]] = m[2];
        m = ATTR_RE.exec(raw);
    }
    return out;
}

const intOr = (v, fallback) => {
    if (v === undefined || v === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : NaN;
};

/**
 * Extract everything in one room's OEL XML that references another room, or
 * that consumes a persistence slot.
 *
 * The three level-index attributes, all measured over the 116 embedded rooms:
 *   @to           on <teleporter> (228) and <stairsup>/<stairsdown> (52)
 *   @fallthrough  on <control> (12)   ⚠ NOT on the level root
 *   @room         on <buttonroom> (11 total, 4 of them cross-level)
 */
export function parseRoomXml(xml) {
    const exits = [];
    const fallthroughs = [];
    const buttonRooms = [];
    const finalBosses = [];
    const tags = [];
    const tsets = [];
    const moonrocks = [];
    // The `named_rooms` trigger elements present in this room. ⚠ NOT a count —
    // one <tentaclebeast> makes `tentacle_beast_mouth` mandatory exactly as
    // eleven do, so what is wanted is presence.
    const triggers = new Set();
    if (typeof xml !== 'string') {
        return { exits, fallthroughs, buttonRooms, finalBosses, tags, tsets, moonrocks, triggers };
    }

    ELEMENT_RE.lastIndex = 0;
    let m = ELEMENT_RE.exec(xml);
    while (m !== null) {
        const el = m[1];
        const a = attrsOf(m[2] ?? '');

        if (el === 'teleporter' || el === 'stairsup' || el === 'stairsdown') {
            if (a.to !== undefined && a.to !== '') {
                exits.push({
                    element: el,
                    to: intOr(a.to, NaN),
                    playerx: intOr(a.playerx, null),
                    playery: intOr(a.playery, null),
                    sign: intOr(a.sign, SIGN_NONE),
                    // ⚠ GEOMETRY, carried because Moonrock.as:131 finds the
                    // stairs it replaces by COLLISION, not by name.
                    x: intOr(a.x, NaN),
                    y: intOr(a.y, NaN),
                });
            }
        }
        // ⚠ @fallthrough rides <control>, not the level root, and carries a SIGN
        // plus xOff/yOff — an OFFSET summed with (@x,@y), not an absolute
        // position (Game.as:2125-2129). A destination rewrite must carry the
        // sign here exactly as it must for a teleporter.
        if (a.fallthrough !== undefined && a.fallthrough !== '') {
            fallthroughs.push({
                element: el,
                to: intOr(a.fallthrough, NaN),
                sign: intOr(a.sign, SIGN_NONE),
            });
        }
        if (el === 'buttonroom' && a.room !== undefined && a.room !== '') {
            buttonRooms.push({ room: intOr(a.room, NaN), tset: intOr(a.tset, -1) });
        }
        if (el === 'finalboss') {
            finalBosses.push({ tag: intOr(a.tag, -1) });
        }
        if (el === 'moonrock') {
            moonrocks.push({ x: intOr(a.x, NaN), y: intOr(a.y, NaN) });
        }
        if (NAMED_ROOM_TRIGGERS.includes(el)) triggers.add(el);
        if (a.tag !== undefined && a.tag !== '') tags.push({ element: el, tag: intOr(a.tag, NaN) });
        if (a.tset !== undefined && a.tset !== '') tsets.push({ element: el, tset: intOr(a.tset, NaN) });

        m = ELEMENT_RE.exec(xml);
    }
    return { exits, fallthroughs, buttonRooms, finalBosses, tags, tsets, moonrocks, triggers };
}

// --- chunk planning -----------------------------------------------------------

/**
 * Split a set's rooms into deliverable chunks, bounded by rooms AND bytes,
 * whichever binds first. A single room larger than MAX_CHUNK_BYTES gets its own
 * chunk and is REPORTED — it cannot be made smaller here, and the caller needs
 * to know the proven envelope no longer covers it.
 */
export function planLevelSetChunks(set, options = {}) {
    const maxRooms = options.maxRooms ?? MAX_ROOMS_PER_CHUNK;
    const maxBytes = options.maxBytes ?? MAX_CHUNK_BYTES;
    const rooms = Array.isArray(set?.rooms) ? set.rooms : [];
    const chunks = [];
    const oversized = [];
    let current = [];
    let currentBytes = 0;

    for (const room of rooms) {
        const bytes = JSON.stringify(room).length;
        if (bytes > maxBytes) {
            oversized.push({ id: room?.id ?? null, name: room?.name ?? null, bytes });
        }
        const wouldExceed = current.length > 0
            && (current.length + 1 > maxRooms || currentBytes + bytes > maxBytes);
        if (wouldExceed) {
            chunks.push(current);
            current = [];
            currentBytes = 0;
        }
        current.push(room);
        currentBytes += bytes;
    }
    if (current.length > 0) chunks.push(current);

    const { rooms: _omit, ...meta } = set ?? {};
    return {
        chunks: chunks.map((roomsInChunk, i) => ({
            schema_version: LEVEL_SET_SCHEMA_VERSION,
            set_id: set?.set_id,
            chunk_index: i,
            chunk_count: chunks.length,
            ...(i === 0 ? { set: meta } : {}),
            rooms: roomsInChunk,
        })),
        oversized,
    };
}

/**
 * Reassemble a delivery. ⛔ ROOM `id` IS AUTHORITATIVE, NOT CHUNK POSITION.
 * If reassembly were positional, a delivery-order bug would produce a set
 * shifted by one, and under this game's semantics every `to`/`@room`/
 * `@fallthrough` would then point one room off WITH NOTHING ERRORING. Asserting
 * that the assembled ids are exactly 0..N-1 makes `chunk_index` pure bookkeeping
 * and turns a mis-ordered delivery into a caught error instead of an absorbed
 * one.
 *
 * ⛔ AND THE CALLER MUST MOUNT ONLY AFTER THIS SUCCEEDS. A chunk that exceeds
 * the arena kills the runtime mid-call, so an incremental mount leaves a PARTIAL
 * set mounted — on which the game runs happily, every index past the end reading
 * as already cleared (§8.3). Assemble, validate, then mount, as one commit step.
 */
export function assembleLevelSetChunks(chunks) {
    const errors = [];
    const err = (m) => errors.push(m);
    if (!Array.isArray(chunks) || chunks.length === 0) {
        return { ok: false, errors: ['chunks must be a non-empty array'], set: null };
    }

    const seenIndex = new Map();
    let setId;
    let chunkCount;
    let meta = null;

    chunks.forEach((chunk, i) => {
        const label = `chunks[${i}]`;
        if (!isPlainObject(chunk)) {
            err(`${label} must be an object`);
            return;
        }
        if (chunk.schema_version !== LEVEL_SET_SCHEMA_VERSION) {
            err(`${label}.schema_version must be ${LEVEL_SET_SCHEMA_VERSION}, got ${JSON.stringify(chunk.schema_version)}`);
        }
        if (!isNonEmptyString(chunk.set_id)) {
            err(`${label}.set_id must be a non-empty string`);
        } else if (setId === undefined) {
            setId = chunk.set_id;
        } else if (chunk.set_id !== setId) {
            err(`${label}.set_id "${chunk.set_id}" disagrees with "${setId}" — a delivery must not splice two sets into one table`);
        }
        if (!Number.isInteger(chunk.chunk_count) || chunk.chunk_count < 1) {
            err(`${label}.chunk_count must be a positive integer`);
        } else if (chunkCount === undefined) {
            chunkCount = chunk.chunk_count;
        } else if (chunk.chunk_count !== chunkCount) {
            err(`${label}.chunk_count ${chunk.chunk_count} disagrees with ${chunkCount}`);
        }
        if (!Number.isInteger(chunk.chunk_index) || chunk.chunk_index < 0) {
            err(`${label}.chunk_index must be a non-negative integer`);
        } else if (seenIndex.has(chunk.chunk_index)) {
            err(`${label}.chunk_index ${chunk.chunk_index} is a duplicate of chunks[${seenIndex.get(chunk.chunk_index)}]`);
        } else {
            seenIndex.set(chunk.chunk_index, i);
        }
        if (!Array.isArray(chunk.rooms) || chunk.rooms.length === 0) {
            err(`${label}.rooms must be a non-empty array`);
        } else if (chunk.rooms.length > MAX_ROOMS_PER_CHUNK) {
            err(`${label}.rooms carries ${chunk.rooms.length} rooms, above MAX_ROOMS_PER_CHUNK (${MAX_ROOMS_PER_CHUNK}) — the size proven over 15 consecutive calls`);
        }
        if (chunk.chunk_index === 0) {
            if (!isPlainObject(chunk.set)) {
                err(`${label}.set is required on chunk_index 0 (the set metadata)`);
            } else {
                meta = chunk.set;
            }
        } else if (chunk.set !== undefined) {
            err(`${label}.set is forbidden on chunk_index ${chunk.chunk_index} — metadata travels once, on chunk 0`);
        }
    });

    if (chunkCount !== undefined) {
        if (chunks.length !== chunkCount) {
            err(`delivery has ${chunks.length} chunks but declares chunk_count ${chunkCount}`);
        }
        for (let i = 0; i < chunkCount; i += 1) {
            if (!seenIndex.has(i)) err(`delivery is missing chunk_index ${i} of ${chunkCount}`);
        }
    }
    if (errors.length > 0) return { ok: false, errors, set: null };

    // Order by declared index, then let room.id be the authority.
    const ordered = [...chunks].sort((a, b) => a.chunk_index - b.chunk_index);
    const collected = ordered.flatMap((c) => c.rooms);
    const byId = new Map();
    collected.forEach((room, i) => {
        const id = room?.id;
        if (!Number.isInteger(id)) {
            err(`assembled room at position ${i} has no integer id — room id is authoritative, not chunk position`);
            return;
        }
        if (byId.has(id)) err(`assembled rooms contain duplicate id ${id}`);
        else byId.set(id, room);
    });
    if (errors.length === 0) {
        for (let i = 0; i < collected.length; i += 1) {
            if (!byId.has(i)) err(`assembled rooms are missing id ${i} — ids must be exactly 0..${collected.length - 1} with no gaps`);
        }
    }
    if (errors.length > 0) return { ok: false, errors, set: null };

    const rooms = [];
    for (let i = 0; i < collected.length; i += 1) rooms.push(byId.get(i));
    return { ok: true, errors: [], set: { ...(meta ?? {}), rooms } };
}

// --- set validation -----------------------------------------------------------

function checkSpawn(spawn, label, roomCount, err, { requirePosition = false } = {}) {
    if (!isPlainObject(spawn)) {
        err(`${label} must be an object with a level`);
        return;
    }
    const lvl = spawn.level;
    if (!Number.isInteger(lvl)) {
        err(`${label}.level must be an integer`);
    } else if (lvl < 0 || lvl >= roomCount) {
        err(`${label}.level ${lvl} is out of range for this set (0..${roomCount - 1}) — the game will NOT catch this: an out-of-range level boots with no error and reads its whole persistence row as everything already cleared (plan §8.3)`);
    }
    for (const axis of ['x', 'y']) {
        if (spawn[axis] !== undefined && !Number.isInteger(spawn[axis])) {
            err(`${label}.${axis} must be an integer when present`);
        }
    }
    if (requirePosition) {
        for (const axis of ['x', 'y']) {
            if (spawn[axis] === undefined) {
                err(`${label}.${axis} is required — this reference is CONSTRUCTED with an arrival position, and omitting it would silently use whatever default the constructing code has (the Game constructor's ${axis === 'x' ? DEFAULT_SPAWN_X : DEFAULT_SPAWN_Y}, or Teleporter.as:31's own 0)`);
            }
        }
    }
}

/**
 * @param {object} set a seedling-level-set document
 * @param {{ xmlByRoomId?: Record<number,string> }} [options] OEL XML for rooms
 *   whose `source` is an `embed` reference the validator cannot read. Supply it
 *   and every room is cross-checked; omit it and the embed-sourced rooms are
 *   NAMED as unchecked rather than passing silently.
 * @returns {{ok:boolean, errors:string[], warnings:string[], stats:object|null}}
 */
export function validateLevelSet(set, options = {}) {
    const errors = [];
    const warnings = [];
    const err = (m) => errors.push(m);
    const warn = (m) => warnings.push(m);
    const xmlById = options.xmlByRoomId ?? null;

    if (!isPlainObject(set)) {
        return { ok: false, errors: ['level set is not an object'], warnings, stats: null };
    }

    // --- envelope ---
    if (set.schema_version !== LEVEL_SET_SCHEMA_VERSION) {
        err(`schema_version must be ${LEVEL_SET_SCHEMA_VERSION}, got ${JSON.stringify(set.schema_version)}`);
    }
    if (!isNonEmptyString(set.set_id)) err('set_id must be a non-empty string');

    const prov = set.provenance;
    if (prov === undefined) {
        warn('provenance missing — an unstamped set cannot be told apart from an edited one by a save file (plan §4.2)');
    } else if (!isPlainObject(prov)) {
        err('provenance must be an object when present');
    } else if (prov.content_hash === undefined) {
        warn('provenance.content_hash missing — stamp with stampLevelSetIdentity()');
    } else if (typeof prov.content_hash !== 'string') {
        err('provenance.content_hash must be a string');
    } else {
        const actual = computeLevelSetContentHash(set);
        if (prov.content_hash !== actual) {
            err(`provenance.content_hash "${prov.content_hash}" does not match the document (${actual}) — an EDITED SET REUSING ITS ID is exactly what the save stamp cannot otherwise detect (plan §4.2)`);
        } else if (isNonEmptyString(set.set_id) && !set.set_id.endsWith(`-${actual}`)) {
            err(`set_id "${set.set_id}" must end with "-${actual}" so that an edited set is a different set by construction`);
        }
    }

    // --- rooms ---
    const rooms = set.rooms;
    if (!Array.isArray(rooms) || rooms.length === 0) {
        err('rooms must be a non-empty array');
        return { ok: false, errors, warnings, stats: null };
    }
    const roomCount = rooms.length;
    const namesSeen = new Map();
    const parsed = new Map();
    const unresolved = [];

    rooms.forEach((room, i) => {
        const label = `rooms[${i}]`;
        if (!isPlainObject(room)) {
            err(`${label} must be an object`);
            return;
        }
        // ⛔ Position IS identity: the game indexes levels[level] positionally
        // and the persistence table is levelPersistence[level * 30 + tag].
        if (room.id !== i) {
            err(`${label}.id is ${JSON.stringify(room.id)} but must equal its array position ${i} — the level table is positional (Game.as levels[level]) and the persistence row is level * ${TAGS_PER_LEVEL} + tag`);
        }
        if (!isNonEmptyString(room.name)) {
            err(`${label}.name must be a non-empty string`);
        } else if (namesSeen.has(room.name)) {
            err(`${label}.name "${room.name}" duplicates rooms[${namesSeen.get(room.name)}]`);
        } else {
            namesSeen.set(room.name, i);
        }

        if (!Number.isInteger(room.music)) {
            err(`${label}.music must be an integer`);
        } else if (room.music < MUSIC_NONE || room.music >= MUSIC_COUNT) {
            err(`${label}.music ${room.music} is out of range ${MUSIC_NONE}..${MUSIC_COUNT - 1} — Music.songs has ${MUSIC_COUNT} entries and ${MUSIC_NONE} means "written at runtime by this room's boss"`);
        }
        for (const flag of ['snow_gradient', 'music_override_exempt']) {
            if (room[flag] !== undefined && typeof room[flag] !== 'boolean') {
                err(`${label}.${flag} must be a boolean when present`);
            }
        }

        const src = room.source;
        if (!isPlainObject(src)) {
            err(`${label}.source must be an object with exactly one of xml/embed`);
            return;
        }
        const hasXml = isNonEmptyString(src.xml);
        const hasEmbed = isNonEmptyString(src.embed);
        if (hasXml === hasEmbed) {
            err(`${label}.source must carry exactly one of xml/embed (got ${hasXml ? 'both' : 'neither'})`);
            return;
        }
        const xml = hasXml ? src.xml : xmlById?.[room.id];
        if (isNonEmptyString(xml)) parsed.set(i, parseRoomXml(xml));
        else unresolved.push(`${label} "${room.name}" (embed ${JSON.stringify(src.embed)})`);
    });

    // ⛔ NAME WHAT WAS NOT CHECKED. A set whose rooms could not be read must not
    // look the same as one that passed every cross-reference.
    if (unresolved.length > 0) {
        warn(`${unresolved.length} of ${roomCount} rooms carry an embed source the validator cannot read, so their level-index, sign and tag references were NOT checked: ${unresolved.slice(0, 8).join(', ')}${unresolved.length > 8 ? `, +${unresolved.length - 8} more` : ''}`);
    }

    // --- start / menu_rooms ---
    checkSpawn(set.start, 'start', roomCount, err);

    const menu = set.menu_rooms;
    if (!Array.isArray(menu)) {
        err('menu_rooms must be an array');
    } else if (menu.length === 0) {
        // Game.as:1294 advances menuIndex = (menuIndex + 1) % menuLevels.length.
        err('menu_rooms must not be empty — Game.as:1294 advances menuIndex = (menuIndex + 1) % menu_rooms.length, so a zero-length list makes that index NaN');
    } else {
        const seen = new Set();
        menu.forEach((lvl, i) => {
            if (!Number.isInteger(lvl)) {
                err(`menu_rooms[${i}] must be an integer`);
            } else if (lvl < 0 || lvl >= roomCount) {
                err(`menu_rooms[${i}] ${lvl} is out of range for this set (0..${roomCount - 1})`);
            } else if (seen.has(lvl)) {
                warn(`menu_rooms[${i}] ${lvl} appears twice — the title screen would show it twice per cycle`);
            } else {
                seen.add(lvl);
            }
        });
    }

    // --- named_rooms: closed vocabulary, requiredness DERIVED from the rooms ---
    //
    // ⚖ USER, 2026-08-14. Phase 2 required all six because vanilla was the only
    // set that existed and vanilla has all six triggers. A generated set has
    // none of them, and every one of the six dereferences is ENTITY-GATED
    // (measured: `NAMED_ROOMS[*].via`), so requiring an entry a set can never
    // reach would force the author to invent a destination — which is either
    // out of range (§8.3's silent "everything already cleared") or an in-range
    // room the reference would fly to if it ever did fire. Both are the failure
    // this arc exists to prevent, wearing a default's clothing.
    //
    // ⛔ AND THE OMISSION IS CHECKED IN BOTH DIRECTIONS, which is what makes it
    // a statement rather than a default:
    //   trigger present + entry missing  → ERROR, naming the room that carries it
    //   trigger absent  + entry supplied → warning, the entry is inert
    //   trigger unverifiable (unread rooms) → NEITHER is claimed; say so instead
    //
    // ⛓ THE THIRD LINE IS THE ONE VANILLA FORCED. Validated without
    // `xmlByRoomId`, all 116 vanilla rooms are `embed`-sourced and unreadable,
    // so "no room carries <moonrock>" is true of what was PARSED and false of
    // the set. A rule that warned there would fire on the real game — §4.3's
    // anti-rot property catching a rule for the second time in this arc.
    const named = set.named_rooms;
    const triggerRooms = new Map();     // element → [room index, …]
    for (const [i, doc] of parsed) {
        for (const el of doc.triggers) {
            if (!triggerRooms.has(el)) triggerRooms.set(el, []);
            triggerRooms.get(el).push(i);
        }
    }
    const allRoomsRead = unresolved.length === 0;
    const namedRequired = [];
    const namedOmitted = [];
    const namedUnverifiable = [];

    if (!isPlainObject(named)) {
        err(`named_rooms must be an object — it may be EMPTY (a set that dereferences none of ${NAMED_ROOM_KEYS.join(', ')}), but it must be present so the document always states the shape`);
    } else {
        for (const key of NAMED_ROOM_KEYS) {
            const spec = NAMED_ROOMS[key];
            const carriers = triggerRooms.get(spec.trigger) ?? [];
            const where = carriers.slice(0, 3)
                .map((i) => `rooms[${i}] "${rooms[i]?.name}"`).join(', ');

            if (named[key] === undefined) {
                if (carriers.length > 0) {
                    namedRequired.push(key);
                    err(`named_rooms.${key} is required: ${where}${carriers.length > 3 ? ` (+${carriers.length - 3} more)` : ''} carries <${spec.trigger}>, and ${spec.cite} dereferences this entry from it. It is a room reference that lives in CODE, so no bundle rewrite can reach it and this manifest is the only place it can be expressed`);
                } else if (!allRoomsRead) {
                    namedUnverifiable.push(key);
                    warn(`named_rooms.${key} is omitted, and ${unresolved.length} of ${roomCount} rooms carry an embed source this validator cannot read, so the omission could NOT be verified — <${spec.trigger}> may be in one of them, and ${spec.cite} would then read a name that is not there`);
                } else {
                    namedOmitted.push(key);
                }
                continue;
            }
            checkSpawn(named[key], `named_rooms.${key}`, roomCount, err, {
                requirePosition: spec.position,
            });
            if (carriers.length === 0 && allRoomsRead) {
                warn(`named_rooms.${key} names room ${named[key]?.level}, but no room in this set carries <${spec.trigger}> — the only thing that dereferences it (${spec.via}). The entry is inert: harmless today, and a claim about a mechanism this set does not have`);
            }
        }
        for (const key of Object.keys(named)) {
            if (!NAMED_ROOM_KEYS.includes(key)) {
                err(`named_rooms.${key} is not a known name — the vocabulary is closed (${NAMED_ROOM_KEYS.join(', ')}); an invented name would silently do nothing`);
            }
        }
    }

    // --- cross-references carried in the ROOM DATA ---
    let exitCount = 0;
    let fallthroughCount = 0;
    let buttonRoomCount = 0;
    const inboundTeleports = new Map();

    for (const [i, doc] of parsed) {
        const label = `rooms[${i}] "${rooms[i].name}"`;

        for (const ex of doc.exits) {
            exitCount += 1;
            if (!Number.isInteger(ex.to)) {
                err(`${label}: <${ex.element}> has a non-integer @to`);
            } else if (ex.to < 0 || ex.to >= roomCount) {
                err(`${label}: <${ex.element}> @to ${ex.to} is out of range for this set (0..${roomCount - 1}) — the game passes @to straight to new Game() unvalidated, and an out-of-range level reads as everything already cleared (§8.3)`);
            } else {
                if (!inboundTeleports.has(ex.to)) inboundTeleports.set(ex.to, []);
                inboundTeleports.get(ex.to).push(i);
            }
            checkSign(ex.sign, `${label}: <${ex.element}>`, err);
        }

        // ⛔ THE MOONROCK'S TELEPORTER DUPLICATES THE STAIRS IT REPLACES, AND
        // THE TWO CAN DISAGREE SILENTLY. `Moonrock.as:131-136`: a landed
        // moonrock collides with a Teleporter and, if it is a Stairs, REMOVES it
        // and adds a plain Teleporter at the same position carrying
        // `named_rooms.moonrock_target` — then writes tag 0 into that same room.
        // The stairs it destroyed already carried @to/@playerx/@playery; in
        // vanilla they are the identical (2, 48, 32). Two authorities for one
        // fact: let them differ and the puzzle sends the player somewhere the
        // stairs did not, and banks the pile's persistence in a third room, with
        // nothing erroring anywhere. So the sender makes them agree.
        const mt = isPlainObject(named) ? named.moonrock_target : undefined;
        for (const rock of doc.moonrocks) {
            if (!Number.isInteger(rock.x) || !Number.isInteger(rock.y)) {
                err(`${label}: <moonrock> has no integer @x/@y, so the stairs it replaces cannot be identified`);
                continue;
            }
            const touched = doc.exits.filter((ex) => Number.isInteger(ex.x) && Number.isInteger(ex.y)
                && hitboxesOverlap(rock.x, rock.y, MOONROCK_HITBOX, ex.x, ex.y, TELEPORTER_HITBOX));
            const stairs = touched.filter((ex) => ex.element !== 'teleporter');
            if (touched.length === 0) {
                warn(`${label}: <moonrock> at (${rock.x}, ${rock.y}) lands on no teleporter or stairs, so Moonrock.as:131's replacement never fires — this rock is scenery`);
                continue;
            }
            if (touched.length > 1) {
                warn(`${label}: <moonrock> at (${rock.x}, ${rock.y}) overlaps ${touched.length} teleporters/stairs — collide() returns ONE of them and which is arbitrary (Moonrock.as:131)`);
            }
            if (stairs.length === 0) {
                warn(`${label}: <moonrock> at (${rock.x}, ${rock.y}) lands on a plain <teleporter>, not stairs — Moonrock.as:132's \`stairs is Stairs\` is false, so nothing is replaced`);
                continue;
            }
            if (!isPlainObject(mt)) continue;   // already refused above, by name
            for (const s of stairs) {
                const disagree = [];
                if (s.to !== mt.level) disagree.push(`@to ${s.to} vs moonrock_target.level ${mt.level}`);
                if (s.playerx !== mt.x) disagree.push(`@playerx ${s.playerx} vs moonrock_target.x ${mt.x}`);
                if (s.playery !== mt.y) disagree.push(`@playery ${s.playery} vs moonrock_target.y ${mt.y}`);
                if (disagree.length > 0) {
                    err(`${label}: the <${s.element}> at (${s.x}, ${s.y}) under a moonrock disagrees with named_rooms.moonrock_target — ${disagree.join('; ')}. Moonrock.as:134 REPLACES this stairs with a teleporter built from the manifest, so a disagreement silently sends the player somewhere the stairs did not`);
                }
            }
        }

        for (const f of doc.fallthroughs) {
            fallthroughCount += 1;
            if (!Number.isInteger(f.to)) {
                err(`${label}: <${f.element}> has a non-integer @fallthrough`);
            } else if (f.to < 0 || f.to >= roomCount) {
                err(`${label}: <${f.element}> @fallthrough ${f.to} is out of range for this set (0..${roomCount - 1}) — the pit-fall destination (Game.as:2125 → Player.as:764)`);
            }
            checkSign(f.sign, `${label}: <${f.element}> @fallthrough`, err);
        }

        // ⛔ ButtonRoom passes its TSET as the TAG in the TARGET room:
        // ButtonRoom.as:93 Game.setPersistence(t, persist, room), with the
        // author's own comment "tset matches up with tag for objects in other
        // rooms, not their tsets." ⇒ tset and tag are SEPARATE namespaces except
        // across rooms, where they are ONE — and the ceiling that applies there
        // is the TAG ceiling, 30, not the tset allocator's range (which reaches
        // ~89 in a 10x10 room).
        for (const br of doc.buttonRooms) {
            buttonRoomCount += 1;
            if (br.room === -1) continue;
            if (!Number.isInteger(br.room)) {
                err(`${label}: <buttonroom> has a non-integer @room`);
                continue;
            }
            if (br.room < 0 || br.room >= roomCount) {
                err(`${label}: <buttonroom> @room ${br.room} is out of range for this set (0..${roomCount - 1})`);
                continue;
            }
            if (!Number.isInteger(br.tset) || br.tset < 0 || br.tset >= TAGS_PER_LEVEL) {
                err(`${label}: <buttonroom> @tset ${br.tset} targets room ${br.room}, where it is used as a TAG (ButtonRoom.as:93), so it must be in 0..${TAGS_PER_LEVEL - 1} — a higher value writes the NEXT room's persistence row`);
                continue;
            }
            const target = parsed.get(br.room);
            if (target && !target.tags.some((t) => t.tag === br.tset)) {
                warn(`${label}: <buttonroom> @tset ${br.tset} targets room ${br.room} "${rooms[br.room].name}", where no entity carries tag ${br.tset} — the button controls nothing`);
            }
        }

        // --- persistence-slot occupancy ---
        const tagOwners = new Map();
        for (const t of doc.tags) {
            if (t.tag === -1) continue;   // the explicit "untagged" value
            if (!Number.isInteger(t.tag) || t.tag < 0 || t.tag >= TAGS_PER_LEVEL) {
                err(`${label}: <${t.element}> tag ${t.tag} is out of range 0..${TAGS_PER_LEVEL - 1} — levelPersistence is indexed level * ${TAGS_PER_LEVEL} + tag with NO bounds check (Main.as:201), so an out-of-range tag writes another room's row`);
                continue;
            }
            if (!tagOwners.has(t.tag)) tagOwners.set(t.tag, []);
            tagOwners.get(t.tag).push(t.element);
        }
        if (tagOwners.size > TAGS_PER_LEVEL) {
            err(`${label}: uses ${tagOwners.size} distinct tags, above the ceiling of ${TAGS_PER_LEVEL}`);
        }

        // ⛔ FinalBoss consumes `tag` AND `tag + 1` (FinalBoss.as:222).
        // ⚠ AND THE NEIGHBOUR IS DELIBERATELY SOMEBODY ELSE'S. In vanilla,
        // End/Boss.oel pairs <finalboss tag="0"> with <rocklock tag="1">: the
        // boss's second clear is what opens the rock lock. So the rule is NOT
        // "tag+1 must be free" — that rule would refuse vanilla, which is the
        // §4.3 anti-rot property failing on day one. The real constraint is that
        // tag+1 must stay inside the room's own row.
        for (const fb of doc.finalBosses) {
            if (fb.tag === -1) continue;
            if (!Number.isInteger(fb.tag) || fb.tag < 0 || fb.tag >= TAGS_PER_LEVEL) continue;
            if (fb.tag + 1 >= TAGS_PER_LEVEL) {
                err(`${label}: <finalboss> tag ${fb.tag} consumes tag AND tag+1 (FinalBoss.as:222), and ${fb.tag + 1} is past the ceiling of ${TAGS_PER_LEVEL} — it would clear a flag in the NEXT room's row`);
            } else if (!tagOwners.has(fb.tag + 1)) {
                warn(`${label}: <finalboss> tag ${fb.tag} also clears tag ${fb.tag + 1} (FinalBoss.as:222), which no entity in this room carries — the boss's second clear controls nothing (in vanilla it opens the <rocklock tag="1"> beside it)`);
            }
        }
    }

    // Pairing: a destination that never points back is legal (one-way drops
    // exist by design) but is worth surfacing, per plan §4.6.
    for (const [dest, sources] of inboundTeleports) {
        const back = parsed.get(dest);
        if (!back) continue;
        const pointsBack = back.exits.some((ex) => sources.includes(ex.to));
        if (!pointsBack) {
            warn(`room ${dest} "${rooms[dest].name}" is entered from room(s) ${[...new Set(sources)].join(', ')} but has no exit back to any of them — a one-way transition`);
        }
    }

    // ⛔ TWO PERSISTENCE SLOTS ARE CLAIMED BY CODE, AND NO TAG AUDIT CAN SEE
    // THEM. Every tag rule above reads @tag out of the room data; these two do
    // not appear there, so a set can satisfy every occupancy rule in this file
    // and still collide.
    //
    //   · moonrock_target's room: Moonrock.as:135 WRITES tag 0, and its consumer
    //     MoonrockPile.as:22 hardcodes tag = 0 with inverted polarity and
    //     carries no @tag. Vanilla's room 2 authors NOTHING at tag 0 — the pile
    //     holds that slot invisibly. An authored tag-0 entity there shares it.
    //   · watcher_text's room: FinalDoor.as:50 READS tag 0, and vanilla's room
    //     114 DOES author it (<watcher tag="0">) — the read is aimed at a real
    //     entity. A set that omits it makes the door ask a slot nothing sets.
    //
    // ⇒ the SAME slot is a hazard in one room and a requirement in the other,
    // which is why neither can be a rule about tag 0 in general.
    const authoredTagZero = (level) => {
        const doc = parsed.get(level);
        if (!doc) return null;              // unresolved room — already named as unchecked
        return doc.tags.filter((t) => t.tag === 0).map((t) => t.element);
    };
    if (isPlainObject(named)) {
        const mrLevel = named.moonrock_target?.level;
        const sharers = Number.isInteger(mrLevel) ? authoredTagZero(mrLevel) : null;
        if (sharers && sharers.length > 0) {
            warn(`named_rooms.moonrock_target names room ${mrLevel} "${rooms[mrLevel]?.name}", where <${sharers.join('>, <')}> carries tag 0 — the same slot MoonrockPile.as:22 claims in CODE (hardcoded, inverted polarity, no @tag in the data). Moonrock.as:135's cross-level write clears it for both.`);
        }
        const wtLevel = named.watcher_text?.level;
        const readers = Number.isInteger(wtLevel) ? authoredTagZero(wtLevel) : null;
        if (readers && readers.length === 0) {
            warn(`named_rooms.watcher_text names room ${wtLevel} "${rooms[wtLevel]?.name}", where nothing carries tag 0 — FinalDoor.as:50 reads that slot to decide whether the Watcher is dealt with, and in vanilla room 114 authors it as <watcher tag="0">. Here the door asks a slot nothing in that room sets.`);
        }
    }

    // --- the debug warps (§8.2a #6 composed with §8.3) ---
    const outOfRangeWarps = [...new Set(DEBUG_WARP_LEVELS)].filter((l) => l >= roomCount);
    if (outOfRangeWarps.length > 0) {
        warn(`this set has ${roomCount} rooms; the LIVE debug warps on keys 1-9 (Player.as:1827-1999, each preceded by Main.clearSave()) reach levels ${DEBUG_WARP_LEVELS.join(', ')}, of which ${outOfRangeWarps.join(', ')} are out of range here and would boot as "everything already cleared" (§8.3). Guarded by a debug keypress, so this is not a refusal.`);
    }

    const stats = {
        rooms: roomCount,
        rooms_checked: parsed.size,
        rooms_unresolved: unresolved.length,
        exits: exitCount,
        fallthroughs: fallthroughCount,
        button_rooms: buttonRoomCount,
        menu_rooms: Array.isArray(menu) ? menu.length : 0,
        // ⛓ WHY AN OMISSION WAS ALLOWED, RECORDED. An empty findings list and a
        // clean pass look identical otherwise: a reader of `ok: true` cannot
        // otherwise tell "this set legitimately has no Watcher" from "the rule
        // never ran". `named_rooms_omitted` is the set of names this set was
        // MEASURED not to need; `named_rooms_unverifiable` is the set whose
        // absence could not be checked because rooms went unread.
        named_rooms_present: isPlainObject(named)
            ? NAMED_ROOM_KEYS.filter((k) => named[k] !== undefined) : [],
        named_rooms_omitted: namedOmitted,
        named_rooms_unverifiable: namedUnverifiable,
        named_rooms_required_missing: namedRequired,
    };
    return { ok: errors.length === 0, errors, warnings, stats };
}

function checkSign(sign, where, err) {
    if (sign === SIGN_NONE) return;
    if (!Number.isInteger(sign) || sign < 0 || sign > SIGN_TABLE_SIZE) {
        err(`${where} sign ${sign} is out of range 0..${SIGN_TABLE_SIZE} — Message.as:15-16 holds exactly ${SIGN_TABLE_SIZE} titles/subtitles indexed by (sign - 1), and 0 means "no sign". The table is CLOSED: a set cannot name an eighth region without an AS3 change.`);
    }
}
