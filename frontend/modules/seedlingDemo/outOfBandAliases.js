/**
 * seedlingDemo/outOfBandAliases — WHICH `{level, tag}` ADDRESSES A `tag = −1`
 * WRITE CAN CLEAR, derived once from a map, so the tag allocator and the rules
 * producer guard against the same set.
 *
 * Slice `rules-spinner-alias-guards` (rules arc; witness and census:
 * `rules-spinner-tag-alias`, report § 5.1).
 *
 * ── THE MECHANISM (source) ────────────────────────────────────────────
 *
 * ```
 *   Game.as:1902-1904   setPersistence(tag, o, _l = -1) ->
 *                       Main.levelPersistenceSet(_l >= 0 ? _l : Main.level, tag, o)
 *   Main.as:222         levelPersistence[i * Game.tagsPerLevel + j] = _t   (no bounds check)
 * ```
 *
 * A writer in level N+1 carrying the sentinel writes index `30(N+1) − 1`, which
 * is `{N, 29}` — the PREVIOUS level's last slot (`outOfBandLedger`). That slot is
 * harmless while nothing owns it. It stops being harmless the moment something
 * in level N is ADDRESSED there: a rules event minted at `{N, 29}` is then
 * collected by an unrelated kill in N+1, and an apitem or lock allocated tag 29
 * in N is despawned (or opened) by that kill before the player reaches it.
 *
 * ── ONE DERIVATION, TWO GUARDS ────────────────────────────────────────
 *
 * The WRITERS are read, never re-listed:
 *
 *  · which ENTITY TYPES build which AS3 class — the engine's own
 *    `levelWorld.OUT_OF_BAND_WRITER_CLASSES`, plus every
 *    `outOfBandLedger.OUT_OF_BAND_WRITERS` class not yet mapped there under its
 *    lower-cased name (the `Game.as` loader's own spelling: `xml.objects[0].fire`
 *    builds `new Fire`, `.spinner` builds `new Spinner`). So a class registered in
 *    the ledger ARRIVES here without a second edit; the unit pin reads `Game.as`
 *    and holds every loader element that builds a ledger class to this table.
 *  · the resolved tag — the engine's `tagOf`, with `outOfBandWritersOnto`'s rule
 *    that only an EXPLICIT `tag` attribute counts (`o.@tag` on a missing
 *    attribute is `int("")` = 0, an in-band write; `tagOf` reads it −1).
 *  · the landing — `outOfBandFlagForWriter`, which refuses an unclassified class.
 *
 * Guard (a): the allocator (`procgenSeedling.placementTagId`) is handed
 * `aliasReservedFor(targets, level)` wherever it places into an existing map.
 * Guard (b): the rules producer refuses an event on an alias target
 * (`seedlingObstacleEvents.refuseAliasedEvents`). A level set built before its
 * successor exists is checked once at the END of the build
 * (`levelSetValidator`, through `aliasCollisionsOf`), never by reserving a
 * standing slot.
 *
 * ⛔ No level or tag literal lives here. The vanilla answer (`{17:{29}, 91:{29}}`)
 * is a TEST EXPECTATION only.
 */

import { OUT_OF_BAND_WRITER_CLASSES, tagOf } from './levelWorld.js';
import { OUT_OF_BAND_WRITERS, TAGS_PER_LEVEL, outOfBandFlagForWriter } from './outOfBandLedger.js';

/** `Main.as:222` — the line every refusal here cites. */
export const ALIAS_CITE = 'Main.as:222 levelPersistence[level * 30 + tag] (no bounds check), Game.as:1902-1904';

export class OutOfBandAliasError extends Error {
    constructor(message) { super(message); this.name = 'OutOfBandAliasError'; }
}
const fail = (m) => { throw new OutOfBandAliasError(m); };

/**
 * Entity type → the ledger class it builds. The engine's table first; then each
 * ledger class the engine's table does not yet name, under the loader's
 * lower-cased element name.
 */
export const ALIAS_WRITER_TYPES = Object.freeze((() => {
    const out = { ...OUT_OF_BAND_WRITER_CLASSES };
    const mapped = new Set(Object.values(out));
    for (const as3 of Object.keys(OUT_OF_BAND_WRITERS)) {
        if (mapped.has(as3)) continue;
        const type = as3.toLowerCase();
        if (out[type] === undefined) out[type] = as3;
    }
    return out;
})());

/** A map document (`{levels}`), a level-set's records, or a bare array of records → `[record]`. */
function recordsOf(mapDoc) {
    const list = Array.isArray(mapDoc) ? mapDoc : mapDoc?.levels;
    if (!Array.isArray(list)) {
        fail('outOfBandAliases: expects a map document `{levels: [{level, entities}]}` or an array of '
            + `level records, got ${mapDoc === null ? 'null' : typeof mapDoc}`);
    }
    for (const [i, r] of list.entries()) {
        if (!Number.isInteger(r?.level)) {
            fail(`outOfBandAliases: record [${i}] has no integer \`level\` (got ${JSON.stringify(r?.level)}) — `
                + 'a -1 write lands on `level - 1`, so a record without one cannot be placed');
        }
    }
    return list;
}

/**
 * Every map-placed −1 writer and the address it lands on:
 * `[{level, tag, from, id, type, as3}]` (`level`/`tag` the ALIAS address,
 * `from` the writer's own level). A writer in level 0 writes index −1, before
 * the array's first row: it aliases no slot (and `outOfBandFlagFor` refuses to
 * model it), so it is skipped here rather than refused.
 */
export function aliasWritersOf(mapDoc, { writerTypes = ALIAS_WRITER_TYPES } = {}) {
    const out = [];
    for (const record of recordsOf(mapDoc)) {
        for (const e of record.entities ?? []) {
            const as3 = writerTypes[e.type];
            // ⚠ ONLY AN EXPLICIT `tag` ATTRIBUTE (levelWorld.outOfBandWritersOnto's rule, and why).
            if (!as3 || e.attrs?.tag === undefined || e.attrs.tag === '') continue;
            const tag = tagOf(e.type, e.attrs);
            if (!(tag < 0)) continue;
            if (record.level * TAGS_PER_LEVEL + tag < 0) continue;
            const flag = outOfBandFlagForWriter({ as3, level: record.level, tag });
            out.push({
                level: flag.level, tag: flag.tag, from: record.level,
                id: `${e.type}@${e.x},${e.y}`, type: e.type, as3,
            });
        }
    }
    return out;
}

/** `Map<level, Set<tag>>` — every address a −1 writer on this map can clear. */
export function aliasTargetsOf(mapDoc, opts = {}) {
    const out = new Map();
    for (const w of aliasWritersOf(mapDoc, opts)) {
        if (!out.has(w.level)) out.set(w.level, new Set());
        out.get(w.level).add(w.tag);
    }
    return out;
}

/** The tags `placementTagId` must not hand out in `level`, sorted. */
export function aliasReservedFor(targets, level) {
    return [...(targets.get(level) ?? [])].sort((a, b) => a - b);
}

/** The writers that land on `{level, tag}`, as `type@x,y (L<from>)` strings. */
export function aliasWritersAt(mapDoc, { level, tag }, opts = {}) {
    return aliasWritersOf(mapDoc, opts)
        .filter((w) => w.level === level && w.tag === tag)
        .map((w) => `${w.id} (L${w.from}, ${w.as3})`);
}

/**
 * Every entity of the map that OWNS an alias address — `[{level, tag, owner,
 * writers}]`. An owner is any entity whose `tagOf` is that slot in that level.
 */
export function aliasCollisionsOf(mapDoc, opts = {}) {
    const records = recordsOf(mapDoc);
    const writers = aliasWritersOf(records, opts);
    if (writers.length === 0) return [];
    const byLevel = new Map(records.map((r) => [r.level, r]));
    const out = [];
    for (const [level, tags] of aliasTargetsOf(records, opts)) {
        for (const e of byLevel.get(level)?.entities ?? []) {
            const t = tagOf(e.type, e.attrs);
            if (!tags.has(t)) continue;
            out.push({
                level, tag: t, owner: `${e.type}@${e.x},${e.y}`,
                writers: writers.filter((w) => w.level === level && w.tag === t)
                    .map((w) => `${w.id} (L${w.from}, ${w.as3})`),
            });
        }
    }
    return out;
}

/** The refusal sentence for one collision, shared by every guard. */
export function aliasCollisionMessage({ level, tag, owner, writers }) {
    return `{${level},${tag}} is owned by ${owner} in L${level}, and the tag -1 write of `
        + `${writers.join(', ')} lands on that same slot (${ALIAS_CITE}): a kill or break in `
        + `L${level + 1} would clear it — an event collected by an unrelated action, or a pickup despawned `
        + 'before it is taken';
}

/** Throws by name when any entity of the map owns an alias address. */
export function assertNoAliasCollision(mapDoc, { who = 'outOfBandAliases', ...opts } = {}) {
    const hits = aliasCollisionsOf(mapDoc, opts);
    if (hits.length > 0) {
        fail(`${who}: ${hits.length} persistence slot(s) collide with a tag -1 write —\n  `
            + hits.map(aliasCollisionMessage).join('\n  '));
    }
}
