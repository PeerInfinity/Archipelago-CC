/**
 * procgenCore/levelSetReference — **WHICH LEVEL SET A WORLD'S ROOMS CAME FROM, AS A RULES FIELD** (S3).
 *
 * `region_atlas["<p>"].level_set = {set_id, content_hash}` (optional, closed; `rules.schema.json`):
 *   · `set_id`        the level-set DOCUMENT's own stamped id — the id of the bundle's `level-set` member, and the
 *                     key `levelSetCache` holds it under;
 *   · `content_hash`  `computeContentHash(set, {idKey: 'set_id'})` — the WHOLE document minus its own id and
 *                     `provenance` (rooms, start, menu/named rooms: everything a player is delivered), 8 hex. It is
 *                     what a stamped set already carries as `provenance.content_hash`, so a stamped set's
 *                     reference is `{set_id, content_hash: provenance.content_hash}` — and recomputed here rather
 *                     than read off `provenance`, because a body edited after its stamp must not pass as the
 *                     stamped one.
 *
 * ⛓ ONE SPELLING, TWO SIDES: the lab writes the field through `levelSetReferenceOf`, the host computes the hash it
 *   holds a set under through `levelSetContentHash`. Neither re-derives the other's answer.
 * ⛔ GAME-NEUTRAL AND PURE: it imports `contentIdentity.js` (which imports nothing) and the cache.
 */
import { computeContentHash } from './contentIdentity.js';
import { levelSetCache } from './levelSetCache.js';

const isNonEmptyString = (s) => typeof s === 'string' && s !== '';

/** The content hash of a level-set document: the whole document minus `set_id` and `provenance`. */
export function levelSetContentHash(set) {
    if (!set || typeof set !== 'object' || Array.isArray(set) || !Array.isArray(set.rooms)) {
        throw new Error('levelSetReference: a level set is a document with a `rooms` array');
    }
    return computeContentHash(set, { idKey: 'set_id' });
}

/** `{set_id, content_hash}` for a STAMPED level set (one that carries its own `set_id`). */
export function levelSetReferenceOf(set) {
    if (!isNonEmptyString(set?.set_id)) {
        throw new Error('levelSetReference: the set carries no `set_id` — stamp it first; an unstamped set has no '
            + 'id a host could hold it under');
    }
    return { set_id: set.set_id, content_hash: levelSetContentHash(set) };
}

/**
 * The reference `rules` name for `player` (`region_atlas["<p>"].level_set`), or null when that slot names none.
 * Never another player's.
 */
export function levelSetRefOf(rules, player) {
    if (player === undefined || player === null || player === '') return null;
    const ref = rules?.region_atlas?.[String(player)]?.level_set;
    return ref && isNonEmptyString(ref.set_id) && isNonEmptyString(ref.content_hash) ? ref : null;
}

/**
 * ⛓ THE HOST WRITER'S CALL — every level set in `docs`, put under its own `set_id` with its computed content
 * hash, in order. Returns `[{set_id, content_hash}]` for what was put. Non-sets are skipped.
 */
export function putLevelSets(docs, cache = levelSetCache) {
    const put = [];
    for (const doc of docs ?? []) {
        if (!doc || typeof doc !== 'object' || !isNonEmptyString(doc.set_id) || !Array.isArray(doc.rooms)) continue;
        const ref = levelSetReferenceOf(doc);
        cache.put(ref.set_id, doc, { contentHash: ref.content_hash });
        put.push(ref);
    }
    return put;
}
