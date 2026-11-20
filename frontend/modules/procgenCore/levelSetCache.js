/**
 * procgenCore/levelSetCache — **A HOST-SIDE CACHE OF LEVEL SETS, KEYED BY `set_id`** (S3, "the app keeps the set
 * you hand it"). `atlasCache.js`'s pattern, for the other half of a world built in a lab.
 *
 * A rules document names the set its rooms came from per player (`region_atlas[p].level_set = {set_id,
 * content_hash}`) and does not carry the set's body. The host code that receives a set (a bundle's `level-set`
 * member) `put`s it here, and a reader that holds only the rules asks `get(set_id, content_hash)` for it.
 *
 * ⛔ GAME-NEUTRAL. A level set is any object with a non-empty `set_id` and a `rooms` array; nothing here names a
 *    substrate or a game.
 * ⛔ PURE, AND IT IMPORTS NOTHING. The writer hands in the set's content hash (`levelSetReference.js`'s
 *    `levelSetContentHash`, the ONE spelling), so this module needs no hash function of its own.
 *
 * ⛓ THE RULES (pinned in `levelSetCache.test.js`):
 *   · **put OVERWRITES.** A set re-handed over under the SAME `set_id` replaces the held one; the old body is
 *     never served again.
 *   · **BOUNDED, FIFO by last put.** At most `LEVEL_SET_CACHE_LIMIT` sets; a put past the limit evicts the one put
 *     longest ago. A put of an id already held moves it to the newest end. `get` does not reorder.
 *   · **A HASH MISMATCH IS REPORTED, NEVER SERVED.** `get(setId, contentHash)` answers `{status, set, ...}`:
 *     `held` (the set, its hash equal to the one asked for), `absent` (no set under that id), or `mismatch`
 *     (a set IS held under that id but its content hash is not the one the rules name — `set` is null, and both
 *     hashes are quoted). A reader that names no hash gets `held` with whatever is held: that is the reader's
 *     choice to make, and it is visible in the call.
 */

/**
 * The bound. A whole 116-room set is the largest a lab writes today; 4 of them is a few MB of JSON at most, and
 * a page holds one world at a time — the extra slots are for switching back and forth between bundles.
 */
export const LEVEL_SET_CACHE_LIMIT = 4;

const isNonEmptyString = (s) => typeof s === 'string' && s !== '';
const isLevelSet = (s) => !!s && typeof s === 'object' && !Array.isArray(s)
    && isNonEmptyString(s.set_id) && Array.isArray(s.rooms);

/** A cache instance. The module exports one shared instance (`levelSetCache`); tests build their own. */
export function createLevelSetCache({ limit = LEVEL_SET_CACHE_LIMIT } = {}) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error(`levelSetCache: limit must be a positive integer, got ${limit}`);
    /** set_id → {set, contentHash} */
    const byId = new Map();
    return Object.freeze({
        limit,
        /**
         * Store `set` under `setId` (overwriting, newest end), with the content hash the writer computed over it.
         * Returns the ids evicted.
         */
        put(setId, set, { contentHash } = {}) {
            if (!isNonEmptyString(setId)) throw new Error(`levelSetCache.put: a set_id is a non-empty string, got ${JSON.stringify(setId)}`);
            if (!isLevelSet(set)) throw new Error(`levelSetCache.put(${JSON.stringify(setId)}): not a level set (no set_id, or no rooms array)`);
            if (set.set_id !== setId) {
                throw new Error(`levelSetCache.put: the key ${JSON.stringify(setId)} is not the set's own set_id `
                    + `${JSON.stringify(set.set_id)} — a reader looks it up by the id the rules name`);
            }
            if (!isNonEmptyString(contentHash)) {
                throw new Error(`levelSetCache.put(${JSON.stringify(setId)}): no contentHash — a held set is always `
                    + 'held WITH its hash, or a mismatch could not be told from a match');
            }
            byId.delete(setId);
            byId.set(setId, { set, contentHash });
            const evicted = [];
            while (byId.size > limit) {
                const oldest = byId.keys().next().value;
                byId.delete(oldest);
                evicted.push(oldest);
            }
            return evicted;
        },
        /**
         * @param {string} setId
         * @param {string} [contentHash]  the hash the rules name; omitted → no check
         * @returns {{status: 'held'|'absent'|'mismatch', set: object|null, set_id: string,
         *   content_hash: string|null, held_hash: string|null, why: string|null}}
         */
        get(setId, contentHash) {
            const hit = byId.get(setId);
            const asked = contentHash === undefined || contentHash === null ? null : contentHash;
            if (!hit) {
                return { status: 'absent', set: null, set_id: setId, content_hash: asked, held_hash: null,
                    why: `no level set with set_id ${JSON.stringify(setId)} is held` };
            }
            if (asked !== null && asked !== hit.contentHash) {
                return { status: 'mismatch', set: null, set_id: setId, content_hash: asked, held_hash: hit.contentHash,
                    why: `the level set held as ${JSON.stringify(setId)} has content hash ${hit.contentHash}, `
                        + `not the ${asked} the rules name — it is NOT served` };
            }
            return { status: 'held', set: hit.set, set_id: setId, content_hash: asked, held_hash: hit.contentHash, why: null };
        },
        has(setId) { return byId.has(setId); },
        ids() { return [...byId.keys()]; },
        get size() { return byId.size; },
        clear() { byId.clear(); },
    });
}

/** ⛓ THE shared instance — the one host writers put into and the runtime (S4) will read. */
export const levelSetCache = createLevelSetCache();
