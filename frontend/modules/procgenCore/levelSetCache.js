/**
 * procgenCore/levelSetCache — **A HOST-SIDE CACHE OF LEVEL SETS, KEYED BY `(set_id, content_hash)`** (S3, "the app
 * keeps the set you hand it"; re-keyed by document library B5). `atlasCache.js`'s pattern, for the other half of a
 * world built in a lab.
 *
 * A rules document names the set its rooms came from per player (`region_atlas[p].level_set = {set_id,
 * content_hash}`) and does not carry the set's body. The host code that receives a set (a bundle's `level-set`
 * member, a lab hand-over, a document-library read) `put`s it here, and a reader that holds only the rules asks
 * `get(set_id, content_hash)` for it. This is the SYNCHRONOUS FRONT; the document library is the store of record
 * behind it, and a miss is filled from there (`levelSetReference.ensureHeld`, which awaits — never a reader of this
 * file).
 *
 * ⛔ GAME-NEUTRAL. A level set is any object with a non-empty `set_id` and a `rooms` array; nothing here names a
 *    substrate or a game.
 * ⛔ PURE, AND IT IMPORTS NOTHING. The writer hands in the set's content hash (`levelSetReference.js`'s
 *    `levelSetContentHash`, the ONE spelling), so this module needs no hash function of its own.
 *
 * ⛓ THE RULES (pinned in `levelSetCache.test.js`):
 *   · **ONE ENTRY PER VERSION.** The key is the pair, so X@H1 and X@H2 are two entries and both are served, each
 *     under its own hash. A re-put of the SAME pair replaces that entry (same id, same hash: the same content).
 *   · **⛔ `get` NEEDS THE HASH.** `get(setId)` with no content hash THROWS `LevelSetCacheReadError`
 *     (`code: 'read-missing-content-hash'`): a reader that does not name the version it plays would be served
 *     "whatever is held", which is the one-version-per-id hazard this key retires.
 *   · **A HASH MISMATCH IS REPORTED, NEVER SERVED.** `get` answers `{status, set, ...}`: `held` (the body of exactly
 *     that version), `absent` (no version of that id), or `mismatch` (other versions of that id ARE held — `set` is
 *     null, and their hashes are listed in `held_hashes`).
 *   · **BOUNDED ON THE UNHELD ONLY, FIFO by last put.** At most `LEVEL_SET_CACHE_LIMIT` entries that nobody holds; a
 *     put past it evicts the unheld one put longest ago. `hold(ref)` takes an entry out of the bound until
 *     `release(ref)` (counted: two holds need two releases), so a set something is playing is never pushed out by
 *     later hand-overs. A put of a pair already held moves it to the newest end. `get` does not reorder.
 */

/**
 * The bound on UNHELD entries. A whole 116-room set is the largest a lab writes today; 4 of them is a few MB of JSON
 * at most, and a page holds one world at a time — the extra slots are for switching back and forth between bundles.
 */
export const LEVEL_SET_CACHE_LIMIT = 4;

/** The refusal codes a caller can match on. */
export const LEVEL_SET_CACHE_REFUSAL = Object.freeze({
    missingContentHash: 'read-missing-content-hash',
    badSetId: 'read-bad-set-id',
});

/** A caller error on a read, by name (`err.name === 'LevelSetCacheReadError'`, `err.code` one of the refusals). */
export class LevelSetCacheReadError extends Error {
    constructor(code, detail) {
        super(`${code}: ${detail}`);
        this.name = 'LevelSetCacheReadError';
        this.code = code;
    }
}

const isNonEmptyString = (s) => typeof s === 'string' && s !== '';
const isLevelSet = (s) => !!s && typeof s === 'object' && !Array.isArray(s)
    && isNonEmptyString(s.set_id) && Array.isArray(s.rooms);
// ⛔ NUL cannot occur in a stamped set id or an 8-hex hash, so the joined key is unambiguous.
const keyOf = (setId, contentHash) => `${setId}\u0000${contentHash}`;

function checkRef(where, setId, contentHash) {
    if (!isNonEmptyString(setId)) {
        throw new LevelSetCacheReadError(LEVEL_SET_CACHE_REFUSAL.badSetId,
            `${where}: a set_id is a non-empty string, got ${JSON.stringify(setId)}`);
    }
    if (!isNonEmptyString(contentHash)) {
        throw new LevelSetCacheReadError(LEVEL_SET_CACHE_REFUSAL.missingContentHash,
            `${where}(${JSON.stringify(setId)}): no content hash — a reader names the VERSION it plays `
            + '(the rules\' `level_set.content_hash`), never "whatever is held under that id"');
    }
}

/** A cache instance. The module exports one shared instance (`levelSetCache`); tests build their own. */
export function createLevelSetCache({ limit = LEVEL_SET_CACHE_LIMIT } = {}) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error(`levelSetCache: limit must be a positive integer, got ${limit}`);
    /** key → {setId, contentHash, set, holds}; Map order = put order (oldest first). */
    const entries = new Map();
    const refOf = (e) => ({ set_id: e.setId, content_hash: e.contentHash });
    const hashesOf = (setId) => [...entries.values()].filter((e) => e.setId === setId).map((e) => e.contentHash);

    /** Evict the oldest UNHELD entries while more than `limit` are unheld. Returns the refs evicted. */
    const trim = () => {
        const evicted = [];
        const unheld = [...entries.values()].filter((e) => e.holds === 0);
        while (unheld.length > limit) {
            const oldest = unheld.shift();
            entries.delete(keyOf(oldest.setId, oldest.contentHash));
            evicted.push(refOf(oldest));
        }
        return evicted;
    };

    return Object.freeze({
        limit,
        /**
         * Store `set` under `(setId, contentHash)` (that entry replaced, newest end, its holds kept), with the content
         * hash the writer computed over it. Returns the refs `[{set_id, content_hash}]` the bound evicted — never a
         * held one.
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
            const key = keyOf(setId, contentHash);
            const holds = entries.get(key)?.holds ?? 0;
            entries.delete(key);
            entries.set(key, { setId, contentHash, set, holds });
            return trim();
        },
        /**
         * @param {string} setId
         * @param {string} contentHash  the hash the rules name — MANDATORY (a missing one throws by name)
         * @returns {{status: 'held'|'absent'|'mismatch', set: object|null, set_id: string, content_hash: string,
         *   held_hash: string|null, held_hashes: string[], why: string|null}}
         */
        get(setId, contentHash) {
            checkRef('levelSetCache.get', setId, contentHash);
            const hit = entries.get(keyOf(setId, contentHash));
            if (hit) {
                return { status: 'held', set: hit.set, set_id: setId, content_hash: contentHash, held_hash: contentHash,
                    held_hashes: [contentHash], why: null };
            }
            const others = hashesOf(setId);
            if (others.length === 0) {
                return { status: 'absent', set: null, set_id: setId, content_hash: contentHash, held_hash: null,
                    held_hashes: [], why: `no level set with set_id ${JSON.stringify(setId)} is held` };
            }
            return { status: 'mismatch', set: null, set_id: setId, content_hash: contentHash,
                held_hash: others[others.length - 1], held_hashes: others,
                why: `the level set held as ${JSON.stringify(setId)} has content hash ${others.join(', ')}, `
                    + `not the ${contentHash} the rules name — it is NOT served` };
        },
        /**
         * Keep `(set_id, content_hash)` out of the bound (a running game's set). `{status: 'held', holds}`, or
         * `{status: 'absent'}` when no such entry is held (the caller fills it first).
         */
        hold(ref) {
            checkRef('levelSetCache.hold', ref?.set_id, ref?.content_hash);
            const e = entries.get(keyOf(ref.set_id, ref.content_hash));
            if (!e) return { status: 'absent' };
            e.holds += 1;
            return { status: 'held', holds: e.holds };
        },
        /**
         * Undo one `hold`. When the last hold goes the entry counts against the bound again, and the bound is applied
         * at once. `{status: 'released', holds, evicted}`, or `{status: 'absent'}` when it was not held.
         */
        release(ref) {
            checkRef('levelSetCache.release', ref?.set_id, ref?.content_hash);
            const e = entries.get(keyOf(ref.set_id, ref.content_hash));
            if (!e || e.holds === 0) return { status: 'absent' };
            e.holds -= 1;
            return { status: 'released', holds: e.holds, evicted: e.holds === 0 ? trim() : [] };
        },
        /** How many holds `(set_id, content_hash)` has (0 when unheld or absent). */
        holdsOf(ref) {
            checkRef('levelSetCache.holdsOf', ref?.set_id, ref?.content_hash);
            return entries.get(keyOf(ref.set_id, ref.content_hash))?.holds ?? 0;
        },
        /** Any version of `setId` (no hash: `undefined` or `null`), or exactly `(setId, contentHash)` when one is given. */
        has(setId, contentHash) {
            if (contentHash === undefined || contentHash === null) return hashesOf(setId).length > 0;
            return entries.has(keyOf(setId, contentHash));
        },
        /** Every entry, oldest put first: `[{set_id, content_hash, holds}]`. */
        refs() { return [...entries.values()].map((e) => ({ ...refOf(e), holds: e.holds })); },
        /** The distinct set ids held, in the order their oldest entry was put. */
        ids() { return [...new Set([...entries.values()].map((e) => e.setId))]; },
        /** The number of entries (versions), held or not. */
        get size() { return entries.size; },
        /** Empty it, holds included (a test's own state). */
        clear() { entries.clear(); },
    });
}

/** ⛓ THE shared instance — the one host writers put into and the runtime (S4) reads. */
export const levelSetCache = createLevelSetCache();
