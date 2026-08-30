// frontend/modules/procgenCore/worldDocument.js
/**
 * ⛓⛓⛓ **THE WORLD — ONE DOCUMENT THAT HOLDS SEVERAL SET DOCUMENTS, THEIR
 * OVERLAYS, AND THE CROSSINGS BETWEEN THEM.**
 *
 * EDITOR INTEGRATION slice W2 (`NewDocs/plans/editor-integration.md` §2.2 #3–#4;
 * ⚖ the user's A2 ruling, §6 Q1). W1 taught the ATLAS a per-region `substrate`
 * and the compiler a per-region dispatch; this is the AUTHORING half — the
 * document a person edits when the rooms of one world are not all the same kind.
 *
 * ── ⛓ THE SHAPE ───────────────────────────────────────────────────────
 *
 *   world = {
 *     schema_version: 1,
 *     world_id?,                     // stamped at DOWNLOAD, exactly as every
 *     name?, description?,           //   other document here (§20.6)
 *     parts:    { <partId>: {kind, substrate?, doc_id?} },
 *     overlays: { <partId>: <that part's own overlay, verbatim> },
 *     links:    [ {from: {part, room, exit}, to: {part, room, exit}, one_way} ],
 *   }
 *
 * and the editing RECORD is `{world, parts: {<partId>: <the sub-document>}}` —
 * the manifest and the held documents, kept apart so a part can be swapped
 * without touching what the world says about it.
 *
 * ── ⛔⛔ WHY THE SUB-OVERLAYS LIVE INSIDE THE WORLD ────────────────────
 *
 * The bundle has exactly ONE `overlay.json` member: `BUNDLE_ENTRY_NAMES`
 * derives entry names from KINDS (`presets/documentBundle.js`), so two overlays
 * cannot both ride one bundle and there is nowhere else for the second to go.
 * ⇒ **the world IS the composite overlay.** A bundle carrying `level-set` +
 * `region-library` + `world` is a world; one carrying `level-set` + `overlay`
 * is exactly today's Seedling set, and every committed bundle re-reads
 * identically (`documentBundle.test.js` pins it).
 *
 * ⛔ AND THE SUB-OVERLAYS ARE HELD VERBATIM, NEVER RE-VALIDATED HERE.
 * MEASURED (W2 measurement 1): `seedlingSetOverlay.assertOverlay` and the
 * maze's both take `(overlay, {roomCount, entries})` and are pure functions of
 * ONE part's overlay against ONE part's room count — each refuses an
 * out-of-range room key by name, unchanged, when handed that part's LOCAL
 * count. The world only HOLDS them, so nothing here knows what a `locations[]`
 * row or a `rules{}` key means; the composite adapter forwards `set-overlay` to
 * the part that owns the room and the part's own validator is what runs.
 *
 * ── ⛓⛓ THE NAMESPACE, AND WHY IT IS A DOT ─────────────────────────────
 *
 * A merged atlas's region ids are `<partId>.<region_id>`. MEASURED (W2
 * measurement 2): the only charset rule a region id has is the `__` BAN —
 * `regionAtlasValidator.js` refuses `__` because `apRegionName` uses it as the
 * AP sub-region separator, and `region-atlas.schema.json` spells the same rule
 * as `^(?!.*__).+$`. Nothing else is forbidden, and a census of all 120
 * committed region ids finds the charset `[0-9_a-z]` — no dot and no dash
 * anywhere. So a dot is free, it reads as a qualified name, and it cannot
 * manufacture a `__`: a part id may not contain one and neither may a region
 * id, and the dot stands between them. ⛓ THE SAME REASONING THE `__`
 * SEPARATOR ITSELF RESTS ON — splitting on the FIRST separator recovers the
 * pair — which is why `PART_ID_RE` forbids a dot INSIDE a part id rather than
 * leaving the split ambiguous.
 *
 * ── ⛔⛔ `one_way` IS REQUIRED ON A WORLD LINK, AND THAT IS A DEPARTURE ─
 *
 * The two part substrates DISAGREE about the default, measured: Seedling's
 * derivation emits `one_way: true` on every connection it makes (its one
 * transition primitive is a one-way jump), and the maze's
 * `LINK_ONE_WAY_DEFAULT` is `false` (a crossing is a tile you walk back off).
 * A crossing BETWEEN them belongs to neither convention, so a default here
 * would silently pick one substrate's law for a door that is not in it. ⛔
 * REFUSED BY NAME instead, quoting both defaults — the author says which.
 */

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ REFUSALS
 * ══════════════════════════════════════════════════════════════════════ */

export class WorldDocumentError extends Error {
    constructor(message) {
        super(message);
        this.name = 'WorldDocumentError';
    }
}

const fail = (message) => { throw new WorldDocumentError(`worldDocument: ${message}`); };

export const isWorldDocumentRefusal = (e) => e?.name === 'WorldDocumentError';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v !== '';

/* ══════════════════════════════════════════════════════════════════════
 * ⛓ THE VOCABULARY
 * ══════════════════════════════════════════════════════════════════════ */

/** The world document's own schema version. ⛔ NOT the rules.json one. */
export const WORLD_SCHEMA_VERSION = 1;

/**
 * ⛓ The part kinds a world may hold — the two SET documents that have an
 * adapter and a derivation today. ⛔ Spelled as the bundle spells them, so a
 * part kind and a bundle member kind are the same word.
 */
export const WORLD_PART_KINDS = Object.freeze(['level-set', 'region-library']);

/** ⛓ `<partId>.<region_id>` — see the docblock for why a dot. */
export const PART_ID_SEPARATOR = '.';

/**
 * ⛓ A part id: letters, digits, `_` and `-`. ⛔ No dot (the split would be
 * ambiguous) and no `__` (checked separately, so the refusal can say WHICH of
 * the two rules the id broke — the AP sub-region separator is a different
 * reason from the namespace one).
 */
export const PART_ID_RE = /^[A-Za-z0-9_-]+$/;

/** The AP sub-region separator, banned inside both halves of a namespaced id. */
export const AP_SUBREGION_SEPARATOR = '__';

/** ⛓ `region_id` in the merged atlas, from the part that owns it. */
export function namespacedRegionId(partId, regionId) {
    assertPartId(partId);
    if (!isNonEmptyString(regionId)) {
        fail(`a region id must be a non-empty string, got ${JSON.stringify(regionId)}`);
    }
    if (regionId.includes(AP_SUBREGION_SEPARATOR)) {
        fail(`region id "${regionId}" contains "${AP_SUBREGION_SEPARATOR}" — it is the AP `
            + 'sub-region separator and `regionAtlasValidator` refuses it; the part\'s own '
            + 'derivation should never have produced one');
    }
    return `${partId}${PART_ID_SEPARATOR}${regionId}`;
}

/**
 * ⛓ …and back. Splitting on the FIRST separator recovers the pair exactly
 * because a part id may not contain one. Returns `null` for an id that carries
 * no separator at all — a region of a single-part atlas, not an error.
 */
export function splitNamespacedRegionId(id) {
    if (!isNonEmptyString(id)) return null;
    const at = id.indexOf(PART_ID_SEPARATOR);
    if (at <= 0 || at === id.length - 1) return null;
    return Object.freeze({ part: id.slice(0, at), region: id.slice(at + 1) });
}

function assertPartId(partId) {
    if (!isNonEmptyString(partId)) {
        fail(`a part id must be a non-empty string, got ${JSON.stringify(partId)}`);
    }
    if (partId.includes(AP_SUBREGION_SEPARATOR)) {
        fail(`part id "${partId}" contains "${AP_SUBREGION_SEPARATOR}" — that is the AP `
            + 'sub-region separator, and a merged region id carrying one would split into a '
            + 'sub-region nobody declared');
    }
    if (!PART_ID_RE.test(partId)) {
        fail(`part id "${partId}" is not ${PART_ID_RE} — a merged region id is `
            + `\`<part>${PART_ID_SEPARATOR}<region_id>\` and splitting on the first `
            + `"${PART_ID_SEPARATOR}" is what recovers the pair, so a part id may not carry one`);
    }
    return partId;
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓ THE LINKS
 * ══════════════════════════════════════════════════════════════════════ */

const LINK_FIELDS = Object.freeze(['from', 'to', 'one_way']);
const ENDPOINT_FIELDS = Object.freeze(['part', 'room', 'exit']);

const endpointKey = (e) => `${e.part}${PART_ID_SEPARATOR}${e.room}/${e.exit}`;

/**
 * ⛓⛓⛓ **EVERY WAY A WORLD LINK CAN BE WRONG, AS A LIST** — the shape the two
 * part overlays' own validators already use, so the world's refusals read like
 * theirs.
 *
 * @param {unknown} links
 * @param {object} o
 * @param {string[]} o.partIds       the parts this world declares
 * @param {object} [o.roomCounts]    `{<partId>: n}`; supply it and a room out of
 *   range is caught here, naming the count — omit it and only the shape is checked
 */
export function linksErrors(links, { partIds = [], roomCounts = null } = {}) {
    if (!Array.isArray(links)) return ['world.links must be an array'];
    const errors = [];
    const seen = new Map();
    links.forEach((link, i) => {
        const label = `world.links[${i}]`;
        if (!isPlainObject(link)) { errors.push(`${label} must be an object`); return; }
        for (const key of Object.keys(link)) {
            if (!LINK_FIELDS.includes(key)) {
                errors.push(`${label}.${key} is not a declared field — a world link carries `
                    + `${LINK_FIELDS.join(', ')}`);
            }
        }
        /**
         * ⛔ REQUIRED, NOT DEFAULTED — the docblock's measurement: Seedling's
         * derivation writes `one_way: true` on every connection and the maze's
         * `LINK_ONE_WAY_DEFAULT` is `false`, so a crossing between them has no
         * default that is not one substrate's law imposed on the other.
         */
        if (typeof link.one_way !== 'boolean') {
            errors.push(`${label}.one_way must be a boolean and is REQUIRED — the two set `
                + 'substrates disagree about the default (Seedling derives every connection '
                + '`one_way: true`, a maze link defaults `false`), so a crossing between them '
                + 'has none that is not one substrate\'s law imposed on the other');
        }
        for (const side of ['from', 'to']) {
            const e = link[side];
            if (!isPlainObject(e)) {
                errors.push(`${label}.${side} must be {${ENDPOINT_FIELDS.join(', ')}}, got `
                    + `${JSON.stringify(e)}`);
                continue;
            }
            for (const key of Object.keys(e)) {
                if (!ENDPOINT_FIELDS.includes(key)) {
                    errors.push(`${label}.${side}.${key} is not a declared field — an endpoint `
                        + `carries ${ENDPOINT_FIELDS.join(', ')}`);
                }
            }
            if (!isNonEmptyString(e.part) || !partIds.includes(e.part)) {
                errors.push(`${label}.${side}.part names ${JSON.stringify(e.part)}, which this `
                    + `world does not hold — its parts are ${partIds.join(', ') || '(none)'}`);
            }
            if (!Number.isInteger(e.room) || e.room < 0) {
                errors.push(`${label}.${side}.room must be a non-negative room INDEX inside its `
                    + `own part, got ${JSON.stringify(e.room)}`);
            } else if (roomCounts && Number.isInteger(roomCounts[e.part])
                && e.room >= roomCounts[e.part]) {
                errors.push(`${label}.${side}.room is ${e.room} and part "${e.part}" holds `
                    + `${roomCounts[e.part]} room(s)`);
            }
            /**
             * ⛓ THE EXIT IS THE **DERIVED ATLAS** EXIT ID, not the part op
             * vocabulary's endpoint: a Seedling boundary exit is
             * `out_<type>_<x>_<y>` (its own `connect` takes an ORDINAL) and a
             * maze exit is `exit_<n>`. The two spellings are why a cross-part
             * connect is a different op shape from a part-internal one.
             */
            if (!isNonEmptyString(e.exit)) {
                errors.push(`${label}.${side}.exit must be the DERIVED atlas exit id (a Seedling `
                    + 'boundary exit `out_<type>_<x>_<y>`, a maze exit `exit_<n>`), got '
                    + `${JSON.stringify(e.exit)}`);
            }
        }
        /**
         * ⛔ A WORLD LINK IS A **CROSSING**. A link whose two endpoints are in
         * ONE part is that part's own `connect` — written here it would reach
         * the merged atlas as a second connection on an exit the part already
         * wired, and `atlasOps.connect` would refuse it with a sentence about
         * an atlas rather than about a link.
         */
        if (isPlainObject(link.from) && isPlainObject(link.to)
            && isNonEmptyString(link.from.part) && link.from.part === link.to.part) {
            errors.push(`${label} joins two rooms of part "${link.from.part}" — a world link is `
                + 'a crossing BETWEEN parts, and a door inside one part is that part\'s own '
                + '`connect`');
        }
        // ⛔ ONE ENDPOINT, ONE LINK — the maze overlay's own law
        //   (`mazeAtlasDerivation.js` `linkErrors`), caught here so the author
        //   hears about a LINK rather than about a merged atlas.
        for (const side of ['from', 'to']) {
            const e = link[side];
            if (!isPlainObject(e) || !isNonEmptyString(e.part) || !isNonEmptyString(e.exit)
                || !Number.isInteger(e.room)) continue;
            const key = endpointKey(e);
            if (seen.has(key)) {
                errors.push(`${label}.${side} names ${key}, which world.links[${seen.get(key)}] `
                    + 'already joins — an exit crosses to exactly one place');
            } else {
                seen.set(key, i);
            }
        }
    });
    return errors;
}

/**
 * ⛓⛓ **A RENUMBERING IN ONE PART, APPLIED TO THE WORLD'S LINKS.**
 *
 * ⛔ THE MAPPING IS THE PART'S OWN — `setEditorCore`'s `reorderMapping` /
 * `addRoomMapping` / `removeRoomMapping`, the three the part uses to re-key its
 * own overlay. A world that computed its own would be a second answer to "where
 * did room 3 go", and the two would disagree the first time a part learned a
 * fourth renumbering op.
 *
 * ⛓ A link touching a room that DIED is DROPPED, exactly as the maze's
 * `renumberLinks` drops one — a crossing to a room that is gone is not a
 * crossing, and keeping it would name a room by an index that now means
 * something else.
 */
export function renumberWorldLinks(links, partId, mapOldToNew) {
    if (typeof mapOldToNew !== 'function') {
        fail('renumberWorldLinks needs the PART\'s own old→new mapping (`reorderMapping`, '
            + '`addRoomMapping` or `removeRoomMapping` from `setEditorCore`), and none was given');
    }
    const move = (e) => (e?.part === partId ? { ...e, room: mapOldToNew(e.room) } : e);
    return (links ?? [])
        .map((link) => ({ ...link, from: move(link.from), to: move(link.to) }))
        .filter((link) => Number.isInteger(link.from?.room) && Number.isInteger(link.to?.room));
}

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ THE DOCUMENT
 * ══════════════════════════════════════════════════════════════════════ */

/** The part ids this world declares, in DECLARATION order — which is the order
 *  the composite grid concatenates them in and the order the merge walks. */
export function partIdsOf(world) {
    return Object.keys(world?.parts ?? {});
}

/**
 * ⛓ An EMPTY world over parts the caller has already built.
 *
 * ⛔ EACH PART SUPPLIES ITS OWN EMPTY OVERLAY. This module cannot build one —
 * `emptyOverlay()` is the substrate's (`seedlingSetOverlay`'s carries
 * `neverEnter`/`regions`, the maze's carries `links`/`start`) and `procgenCore/`
 * may not import either. The world holds what it is given.
 *
 * @param {Array<{id, kind, overlay, substrate?, doc_id?}>} parts
 */
export function emptyWorld(parts = []) {
    if (!Array.isArray(parts) || parts.length === 0) {
        fail('emptyWorld needs at least one part — a world with no parts is not a document '
            + 'anybody can edit, and the composite grid would have no rooms at all');
    }
    const manifest = {};
    const overlays = {};
    for (const part of parts) {
        if (!isPlainObject(part)) fail(`a part is {id, kind, overlay}, got ${JSON.stringify(part)}`);
        assertPartId(part.id);
        if (Object.hasOwn(manifest, part.id)) fail(`two parts are called "${part.id}"`);
        if (!WORLD_PART_KINDS.includes(part.kind)) {
            fail(`part "${part.id}" declares kind ${JSON.stringify(part.kind)}; the kinds are `
                + `${WORLD_PART_KINDS.join(', ')}`);
        }
        if (part.overlay === undefined) {
            fail(`part "${part.id}" was given no overlay — the world IS the composite overlay `
                + '(a bundle has one `overlay.json` member), so a part\'s own empty overlay is '
                + 'what it starts with, and only the substrate can build one');
        }
        const row = { kind: part.kind };
        if (part.substrate !== undefined) row.substrate = part.substrate;
        if (part.doc_id !== undefined) row.doc_id = part.doc_id;
        manifest[part.id] = row;
        overlays[part.id] = part.overlay;
    }
    return {
        schema_version: WORLD_SCHEMA_VERSION,
        parts: manifest,
        overlays,
        links: [],
    };
}

/**
 * ⛓⛓⛓ **EVERY WAY A WORLD DOCUMENT CAN BE WRONG, AS A LIST.**
 *
 * @param {unknown} world
 * @param {object} [o]
 * @param {object} [o.docs]        the HELD sub-documents `{<partId>: doc}` — supply
 *   them and a DANGLING part (declared, not held) and an ORPHAN (held, not
 *   declared) are both named
 * @param {object} [o.roomCounts]  `{<partId>: n}`, passed through to `linksErrors`
 */
export function worldErrors(world, { docs = null, roomCounts = null } = {}) {
    if (!isPlainObject(world)) return [`a world is an object, got ${JSON.stringify(world)}`];
    const errors = [];
    if (world.schema_version !== WORLD_SCHEMA_VERSION) {
        errors.push(`world.schema_version must be ${WORLD_SCHEMA_VERSION}, got `
            + `${JSON.stringify(world.schema_version)}`);
    }
    for (const field of ['world_id', 'name', 'description']) {
        if (world[field] !== undefined && typeof world[field] !== 'string') {
            errors.push(`world.${field} must be a string when present`);
        }
    }
    if (!isPlainObject(world.parts) || Object.keys(world.parts).length === 0) {
        errors.push('world.parts must be a non-empty object of {<partId>: {kind, substrate?, '
            + 'doc_id?}} — the parts are what a world IS');
        return errors;
    }
    const ids = partIdsOf(world);
    for (const id of ids) {
        try {
            assertPartId(id);
        } catch (e) {
            errors.push(e.message.replace(/^worldDocument: /, ''));
        }
        const row = world.parts[id];
        if (!isPlainObject(row)) {
            errors.push(`world.parts["${id}"] must be {kind, substrate?, doc_id?}`);
            continue;
        }
        if (!WORLD_PART_KINDS.includes(row.kind)) {
            errors.push(`world.parts["${id}"].kind is ${JSON.stringify(row.kind)}; the kinds `
                + `are ${WORLD_PART_KINDS.join(', ')}`);
        }
        for (const field of ['substrate', 'doc_id']) {
            if (row[field] !== undefined && !isNonEmptyString(row[field])) {
                errors.push(`world.parts["${id}"].${field} must be a non-empty string when present`);
            }
        }
    }
    if (!isPlainObject(world.overlays)) {
        errors.push('world.overlays must be an object of {<partId>: <that part\'s overlay>} — '
            + 'the bundle has ONE `overlay.json` member, so the world is where the second lives');
    } else {
        for (const id of ids) {
            if (world.overlays[id] === undefined) {
                errors.push(`world.overlays["${id}"] is missing — every part carries its own `
                    + 'overlay INSIDE the world, and a part whose overlay silently fell back to '
                    + 'empty would open missing every location and every authored rule');
            }
        }
        for (const id of Object.keys(world.overlays)) {
            if (!ids.includes(id)) {
                errors.push(`world.overlays["${id}"] belongs to no declared part — its parts `
                    + `are ${ids.join(', ')}`);
            }
        }
    }
    errors.push(...linksErrors(world.links, { partIds: ids, roomCounts }));
    if (docs !== null) {
        for (const id of ids) {
            if (docs[id] === undefined) {
                errors.push(`part "${id}" is DECLARED and not HELD — the record's \`parts\` `
                    + `carries ${Object.keys(docs).join(', ') || '(nothing)'}, so there is no `
                    + `${world.parts[id]?.kind ?? 'document'} to edit`);
            }
        }
        for (const id of Object.keys(docs)) {
            if (!ids.includes(id)) {
                errors.push(`part "${id}" is HELD and not DECLARED — a document the world's `
                    + 'manifest does not name would travel in a bundle and come back as nobody\'s');
            }
        }
    }
    return errors;
}

/** ⛓ The same question as a REFUSAL, for the ops and the record constructor. */
export function assertWorld(world, options = {}) {
    const errors = worldErrors(world, options);
    if (errors.length > 0) {
        fail(`this world document is not well formed — ${errors.join(' | ')}`);
    }
    return world;
}
