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
 * ⛓ B5 — `ensureHeld` fills a front miss from the document library. The library is HANDED IN (an object with `get`,
 *   or a function resolving to one), never imported here, so nothing that imports this file carries library code.
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
 * ⛓ S4 — THE HOST READER'S CALL: the level set `rules` name for `player`, IF `cache` holds it under that id AND
 * that content hash. `{ref, status, set, why}`: `none` (the slot names no set — nothing asked), `held` (`set` is
 * the body), `absent` / `mismatch` (`set` null, `why` the cache's sentence). Never serves a mismatched body.
 */
export function heldLevelSetOf(rules, player, cache = levelSetCache) {
    const ref = levelSetRefOf(rules, player);
    if (!ref) return { ref: null, status: 'none', set: null, why: null };
    const got = cache.get(ref.set_id, ref.content_hash);
    return { ref, status: got.status, set: got.status === 'held' ? got.set : null, why: got.why };
}

/**
 * ⛓ THE HOST WRITER'S CALL — every level set in `docs`, put under its own `(set_id, computed content hash)`, in
 * order. Returns `{put: [{set_id, content_hash}], evicted: [{set_id, content_hash}]}`: what was put, and what the
 * front's bound let go of for these puts (never a held entry, and never one put by this same call). Non-sets are
 * skipped.
 */
export function fileLevelSets(docs, cache = levelSetCache) {
    const put = [];
    const evicted = [];
    for (const doc of docs ?? []) {
        if (!doc || typeof doc !== 'object' || !isNonEmptyString(doc.set_id) || !Array.isArray(doc.rooms)) continue;
        const ref = levelSetReferenceOf(doc);
        evicted.push(...cache.put(ref.set_id, doc, { contentHash: ref.content_hash }));
        put.push(ref);
    }
    const same = (a, b) => a.set_id === b.set_id && a.content_hash === b.content_hash;
    return { put, evicted: evicted.filter((e) => !put.some((p) => same(p, e))) };
}

/** `fileLevelSets`' `put` alone — the bundle door's call. */
export function putLevelSets(docs, cache = levelSetCache) {
    return fileLevelSets(docs, cache).put;
}

/** The answers `ensureHeld` gives besides `held` — the library's own, passed through by name. */
export const ENSURE_HELD_REFUSALS = Object.freeze(['absent', 'mismatch', 'corrupt', 'unavailable']);

/**
 * ⛓⛓ B5 — **THE FRONT, FILLED FROM THE LIBRARY.** `ref` is `{set_id, content_hash}` (the rules' `level_set`).
 *   · a front HIT → `{status: 'held', source: 'front'}`; the library is not opened;
 *   · a miss → `library.get({idKey: 'set_id', docId, contentHash})` (the library recomputes the fingerprint from its
 *     stored bytes; its id and hash are checked against `ref` here as well) → put in the front →
 *     `{status: 'held', source: 'library', entries}` (`entries`: the library versions that name this document);
 *   · anything else passes through BY NAME — `absent`, `mismatch` (`heldHashes`), `corrupt`, `unavailable` — with
 *     `set: null`, and nothing is put. ⛔ Never another version of the id, never a fallback body: the caller shows its
 *     own named refusal.
 * `library` is the library itself, or a function resolving to it or to an answer `{status, why}` (the page's lazy
 * opener: a browser with nothing saved answers `absent` without a database being made).
 * @returns {Promise<{status: string, source: 'front'|'library', set: object|null, why: string|null,
 *   entries?: object[], heldHashes?: string[]}>}
 */
export async function ensureHeld(cache = levelSetCache, ref, { library = null } = {}) {
    const front = cache.get(ref?.set_id, ref?.content_hash);
    if (front.status === 'held') return { status: 'held', source: 'front', set: front.set, why: null };
    const answer = (status, why, extra = {}) => ({ status, source: 'library', set: null, why, ...extra });
    let lib = library;
    try {
        if (typeof lib === 'function') lib = await lib();
    } catch (e) {
        return answer('unavailable', `the document library could not be opened: ${e?.message ?? e}`);
    }
    if (!lib) return answer('unavailable', 'no document library on this page');
    if (typeof lib.get !== 'function') {
        const status = ENSURE_HELD_REFUSALS.includes(lib.status) ? lib.status : 'unavailable';
        return answer(status, lib.why ?? `the document library answered ${JSON.stringify(lib.status ?? null)}`);
    }
    let got;
    try {
        got = await lib.get({ idKey: 'set_id', docId: ref.set_id, contentHash: ref.content_hash });
    } catch (e) {
        return answer('unavailable', `the document library read threw: ${e?.message ?? e}`);
    }
    const named = `level set ${ref.set_id} at ${ref.content_hash}`;
    if (got?.status !== 'held') {
        const status = ENSURE_HELD_REFUSALS.includes(got?.status) ? got.status : 'unavailable';
        const why = status === 'absent' ? `the document library holds no ${named}`
            : status === 'mismatch' ? `the document library holds ${ref.set_id} only at ${(got.heldHashes ?? []).join(', ')}, `
                + `not ${ref.content_hash} — another version is NOT served`
                : `the document library answered ${status} for ${named}${got?.why ? ` (${got.why})` : ''}`;
        return answer(status, why, status === 'mismatch' ? { heldHashes: got.heldHashes ?? [] } : {});
    }
    const doc = got.doc;
    if (got.contentHash !== ref.content_hash || doc?.set_id !== ref.set_id || !Array.isArray(doc?.rooms)) {
        return answer('corrupt', `the document library served ${JSON.stringify(doc?.set_id ?? null)} at `
            + `${JSON.stringify(got.contentHash ?? null)} for ${named} — refused`);
    }
    cache.put(ref.set_id, doc, { contentHash: ref.content_hash });
    return { status: 'held', source: 'library', set: doc, why: null, entries: got.entries ?? [] };
}
