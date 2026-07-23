/**
 * savedQueueStore — per-(rules-hash, region, substrate) record of
 * substrate-native action sequences captured during region visits.
 * Replaces the maze-only `bestPaths` Map on gameState.
 *
 * Each saved queue is the player's action sequence from entering a
 * region to leaving it through an exit, plus mana-tracking metadata
 * (entry / exit / min-during-visit).
 *
 * As of M2 (Record mode), a saved queue carries a persistent RECORDING
 * TAG `(region, arrivalExitId, ordinal)` — see blockIdentity.js. The
 * region is implicit in the bucket key; the entry stores `arrivalExitId`
 * and `ordinal`. Re-recording a block REPLACES the entry with the
 * matching tag (never appends a second same-tag entry); entries with
 * OTHER tags are retained as FIFO history (fodder for the future
 * chooser). A byte-identical re-record (same tag + same departure +
 * same actions) is a no-op ('duplicate').
 *
 * Per-region capacity is capped (FIFO eviction by recordedAt) across
 * distinct tags. The cap is a named constant so it retunes in one place.
 *
 * Storage: a single localStorage key holding a flat map keyed by
 * `${rulesHash}|${substrate}|${region}` → SavedQueue[].
 *
 * SavedQueue shape:
 *   {
 *     regionName,         // string
 *     substrate,          // string ('maze', 'text_adventure', ...)
 *     arrivalExitId,      // string or 'entrance' for the start region
 *     ordinal,            // number — Nth block sharing (region, arrival);
 *                         //   part of the recording tag. Legacy entries
 *                         //   without one read as 0.
 *     departureExitId,    // string or null if the visit didn't exit
 *     actions,            // substrate-native action array; EMPTY for a
 *                         //   coarse substrate's annotations-only entry
 *                         //   and for a SUMMARY entry (M5)
 *     annotations,        // M4: {items: {key: {net, min}}, xp: {net}} —
 *                         //   deltas from block start, or null/absent
 *     summary,            // M5: {durationSeconds, checks: string[],
 *                         //   costedActions: [...]} — the NET RESULT of a
 *                         //   summary substrate's visit (runner, bounce).
 *                         //   Absent for coarse / fine-grained entries.
 *     manaAtEntry,        // number — currentMana when the visit began
 *     manaAtExit,         // number — currentMana when the visit ended
 *     manaMin,            // number — lowest currentMana reached during visit
 *     locationsChecked,   // string[] of AP location names checked
 *     itemsPickedUp,      // string[] of item ids gained
 *     recordedAt,         // ms timestamp; FIFO eviction key
 *     name,               // synthesized 'auto: <arrival>→<departure>'
 *   }
 */

const STORAGE_KEY = 'loops:savedQueues:v1';

export const SAVED_QUEUE_PER_REGION_LIMIT = 10;

// In-memory mirror of the persisted map, loaded on first access.
// Shape: Map<bucketKey, SavedQueue[]>.
let _cache = null;

function bucketKey(rulesHash, regionName, substrate) {
    return `${rulesHash}|${substrate}|${regionName}`;
}

function loadCache() {
    if (_cache) return _cache;
    _cache = new Map();
    try {
        if (typeof localStorage === 'undefined') return _cache;
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return _cache;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            for (const [k, v] of Object.entries(parsed)) {
                if (Array.isArray(v)) _cache.set(k, v);
            }
        }
    } catch (err) {
        // Malformed entry — drop the cache and start fresh. The next
        // save will overwrite. No need to surface to the user.
        _cache = new Map();
    }
    return _cache;
}

function persistCache() {
    if (typeof localStorage === 'undefined') return;
    if (!_cache) return;
    try {
        const obj = {};
        for (const [k, v] of _cache.entries()) obj[k] = v;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (err) {
        // QuotaExceeded or similar — drop silently. The in-memory
        // copy is still valid for this session.
    }
}

function actionsEqual(a, b) {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return JSON.stringify(a) === JSON.stringify(b);
}

/** Same persistent recording tag: (arrivalExitId, ordinal). Region is
 * implicit in the bucket. Legacy entries without an ordinal read as 0. */
function sameTag(existing, candidate) {
    return existing.arrivalExitId === candidate.arrivalExitId
        && (existing.ordinal ?? 0) === (candidate.ordinal ?? 0);
}

/**
 * Byte-identical recording — same tag AND same departure AND same actions
 * AND the same annotations AND the same summary. Annotations matter to the
 * comparison because a COARSE substrate's entry (M4 slice 4) is
 * ACTIONS-LESS: two successive coarse recordings of the same block always
 * agree on `actions: []` and a null departure, so without this a re-record
 * with a different economy would read as a duplicate and the stale
 * annotations would survive. The `summary` field (M5) is ACTIONS-LESS for
 * the same reason and needs the same treatment: a re-record of a summary
 * block that took a different amount of time — the thing Playback prices
 * off — must not read as a duplicate.
 */
function isDuplicate(existing, candidate) {
    return sameTag(existing, candidate)
        && existing.departureExitId === candidate.departureExitId
        && actionsEqual(existing.actions, candidate.actions)
        && JSON.stringify(existing.annotations ?? null) === JSON.stringify(candidate.annotations ?? null)
        && JSON.stringify(existing.summary ?? null) === JSON.stringify(candidate.summary ?? null);
}

/**
 * Whether a stored entry holds a PLAYABLE recording. savedQueueStore is the
 * universal recording+metadata envelope (M4), so an entry may legitimately
 * carry annotations with NO actions — that is how a coarse-only substrate
 * (text adventure) stores its economy, its recording being the block's own
 * interior. Such an entry must never bind to a Playback block or count as
 * "a recording exists" in the UI.
 */
export function hasPlayableRecording(entry) {
    return Array.isArray(entry?.actions) && entry.actions.length > 0;
}

/**
 * Whether a stored entry holds a SUMMARY recording (M5) — the net result of
 * a summary substrate's visit (runner, bounce): how long it took, which
 * checks it performed, which explicitly-costed actions it ran. A summary
 * entry is deliberately ACTIONS-LESS (`actions: []`), so
 * `hasPlayableRecording` is false for it: it is not a replayable script and
 * must never bind to a fine-grained Playback block. This is its parallel
 * guard — the one summary Playback and the ● indicator read.
 *
 * `durationSeconds` is the required field: it is what replay-time repricing
 * multiplies the region's current drain rate by, so an entry without it is
 * not a usable summary regardless of what else it carries.
 */
export function hasSummaryRecording(entry) {
    const s = entry?.summary;
    return !!s && typeof s === 'object' && !Array.isArray(s)
        && Number.isFinite(s.durationSeconds);
}

/**
 * Look up saved queues for one (rules, region, substrate) bucket.
 * Returns a defensive copy so callers can't mutate the cache.
 */
export function getSavedQueues(rulesHash, regionName, substrate) {
    if (!rulesHash || !regionName || !substrate) return [];
    const cache = loadCache();
    const bucket = cache.get(bucketKey(rulesHash, regionName, substrate));
    return bucket ? bucket.slice() : [];
}

/**
 * Look up the single saved queue matching a recording tag, or null.
 * The region + substrate select the bucket; (arrivalExitId, ordinal)
 * select the entry. Returns a defensive copy. Used for auto-restore at
 * block creation.
 */
export function getSavedQueueByTag(rulesHash, regionName, substrate, arrivalExitId, ordinal = 0) {
    if (!rulesHash || !regionName || !substrate) return null;
    const cache = loadCache();
    const bucket = cache.get(bucketKey(rulesHash, regionName, substrate));
    if (!bucket) return null;
    const match = bucket.find(
        (e) => e.arrivalExitId === arrivalExitId && (e.ordinal ?? 0) === ordinal,
    );
    return match ? { ...match } : null;
}

/**
 * Save a queue. Returns:
 *   'saved'     — the queue was stored (new tag, or REPLACED the existing
 *                 entry with the same tag); FIFO may have evicted the oldest
 *   'duplicate' — a byte-identical entry (same tag + departure + actions)
 *                 was already stored; nothing changed
 *   'invalid'   — required fields missing; nothing happened
 *
 * Re-recording a block (same tag, different content) REPLACES the prior
 * recording — there is at most one entry per (arrivalExitId, ordinal) tag
 * per bucket. Entries with other tags are retained (FIFO history).
 *
 * The caller supplies most fields; `ordinal` defaults to 0, and
 * `recordedAt` / `name` are filled in here so callers stay in sync.
 */
export function saveQueue(rulesHash, queue) {
    if (!rulesHash || !queue || !queue.regionName || !queue.substrate || !Array.isArray(queue.actions)) {
        return 'invalid';
    }
    const cache = loadCache();
    const key = bucketKey(rulesHash, queue.regionName, queue.substrate);
    const bucket = cache.get(key) ?? [];

    const candidate = { ordinal: 0, ...queue };

    if (bucket.some((existing) => isDuplicate(existing, candidate))) {
        return 'duplicate';
    }

    const enriched = {
        ...candidate,
        recordedAt: candidate.recordedAt ?? Date.now(),
        name:
            candidate.name
            ?? `auto: ${candidate.arrivalExitId ?? '?'}→${candidate.departureExitId ?? '?'}`,
    };

    // Replace-on-tag: drop any prior recording of the same block (same tag,
    // different content). Other-tag entries are retained as FIFO history.
    const next = bucket.filter((existing) => !sameTag(existing, enriched));
    next.push(enriched);
    // FIFO eviction by recordedAt — oldest first. The just-saved entry
    // is always the newest, so trimming from the front drops the oldest.
    next.sort((a, b) => (a.recordedAt ?? 0) - (b.recordedAt ?? 0));
    while (next.length > SAVED_QUEUE_PER_REGION_LIMIT) {
        next.shift();
    }
    cache.set(key, next);
    persistCache();
    return 'saved';
}

/** Drop saved queues for one bucket. */
export function clearForRegion(rulesHash, regionName, substrate) {
    if (!rulesHash || !regionName || !substrate) return;
    const cache = loadCache();
    cache.delete(bucketKey(rulesHash, regionName, substrate));
    persistCache();
}

// Test-only — drop all stored queues and the in-memory cache.
export function _testOnly_clearAll() {
    _cache = new Map();
    persistCache();
    if (typeof localStorage !== 'undefined') {
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
}
