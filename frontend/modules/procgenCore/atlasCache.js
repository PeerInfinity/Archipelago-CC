/**
 * procgenCore/atlasCache — **A HOST-SIDE CACHE OF REGION ATLASES, KEYED BY `atlas_id`** (region-map atlas-cache
 * slice; ⚖ user 2026-11-16/17: custom-world atlas → option (b), a shared cache keyed by `atlas_id`).
 *
 * A rules document names its atlas per player (`region_atlas[p] = {atlas_id, game, map_document}`) but does not
 * carry the atlas body. A shipped atlas is known to its substrate; the atlas of a world built elsewhere (a level set
 * edited in a lab, a bundle loaded from disk) is not. The host code that receives such an atlas `put`s it here, and a
 * reader that holds only the rules (the Region Map's `_hookCtx`) asks `hookCtxFor(rules, player)` for it.
 *
 * ⛔ GAME-NEUTRAL. An atlas is any object with a non-empty `atlas_id`; nothing here names a substrate or a game.
 * ⛔ PURE. No eventBus, no DOM, no fetch: a writer calls `put`, a reader calls `get`. The module-level instance is the
 *    shared one (one per realm: a lab IFRAME has its own, which is why the writer must be HOST-side).
 *
 * ⛓ THE RULES (both pinned in `atlasCache.test.js`):
 *   · **put OVERWRITES.** A world re-handed over under the SAME `atlas_id` (the lab's derived atlas is unstamped, so
 *     every hand-over carries the same id) replaces the cached atlas; the old one is never served again.
 *   · **BOUNDED, FIFO by last put.** At most `ATLAS_CACHE_LIMIT` atlases; a put past the limit evicts the one put
 *     longest ago. A put of an id already held moves it to the newest end. `get` does not reorder.
 */

/** The bound. A derived atlas is ~120 KB of JSON (the vanilla 116-room set, measured), so 8 hold < 1 MB. */
export const ATLAS_CACHE_LIMIT = 8;

const isAtlas = (a) => !!a && typeof a === 'object' && !Array.isArray(a)
    && typeof a.atlas_id === 'string' && a.atlas_id !== '';

/** A cache instance. The module exports one shared instance (`atlasCache`); tests build their own. */
export function createAtlasCache({ limit = ATLAS_CACHE_LIMIT } = {}) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error(`atlasCache: limit must be a positive integer, got ${limit}`);
    const byId = new Map();
    return Object.freeze({
        limit,
        /** Store `atlas` under `atlasId` (overwriting, newest end). Returns the ids evicted. */
        put(atlasId, atlas) {
            if (typeof atlasId !== 'string' || atlasId === '') throw new Error(`atlasCache.put: an atlas_id is a non-empty string, got ${JSON.stringify(atlasId)}`);
            if (!isAtlas(atlas)) throw new Error(`atlasCache.put(${JSON.stringify(atlasId)}): not an atlas (no atlas_id)`);
            if (atlas.atlas_id !== atlasId) {
                throw new Error(`atlasCache.put: the key ${JSON.stringify(atlasId)} is not the atlas's own atlas_id `
                    + `${JSON.stringify(atlas.atlas_id)} — a reader looks it up by the id the rules name`);
            }
            byId.delete(atlasId);
            byId.set(atlasId, atlas);
            const evicted = [];
            while (byId.size > limit) {
                const oldest = byId.keys().next().value;
                byId.delete(oldest);
                evicted.push(oldest);
            }
            return evicted;
        },
        get(atlasId) { return byId.get(atlasId) ?? null; },
        has(atlasId) { return byId.has(atlasId); },
        ids() { return [...byId.keys()]; },
        get size() { return byId.size; },
        clear() { byId.clear(); },
    });
}

/** ⛓ THE shared instance — the one host writers put into and the Region Map reads. */
export const atlasCache = createAtlasCache();

/** Every atlas in `docs` (any iterable of documents), put in order. Returns the ids put. Non-atlases are skipped. */
export function putAtlases(docs, cache = atlasCache) {
    const put = [];
    for (const doc of docs ?? []) {
        if (!isAtlas(doc)) continue;
        cache.put(doc.atlas_id, doc);
        put.push(doc.atlas_id);
    }
    return put;
}

/**
 * ⛓ THE READER'S QUESTION — the hook context for `player`'s atlas: `{atlases: {[id]: atlas}}` when the rules name an
 * `atlas_id` for THAT player (`region_atlas[player]`, never another player's or the first one) and the cache holds it;
 * otherwise `{}` (exactly what a world the cache knows nothing about got before this module existed).
 */
export function hookCtxFor(rules, player, cache = atlasCache) {
    const id = rules?.region_atlas?.[String(player)]?.atlas_id;
    if (typeof id !== 'string' || id === '') return {};
    const atlas = cache.get(id);
    return atlas ? { atlases: { [id]: atlas } } : {};
}
