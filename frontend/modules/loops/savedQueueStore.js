/**
 * savedQueueStore — per-(rules-hash, region, substrate) record of
 * substrate-native action sequences captured during region visits.
 * Replaces the maze-only `bestPaths` Map on gameState.
 *
 * Each saved queue is the player's action sequence from entering a
 * region to leaving it through an exit, plus mana-tracking metadata
 * (entry / exit / min-during-visit). Recording is always-on: every
 * region visit either matches an existing queue (exact match on
 * arrival exit, departure exit, action sequence) and is discarded, or
 * is appended as a new entry.
 *
 * Per-region capacity is capped (FIFO eviction by recordedAt). The
 * cap is exposed as a named constant so it can be retuned in one
 * place.
 *
 * Storage: a single localStorage key holding a flat map keyed by
 * `${rulesHash}|${substrate}|${region}` → SavedQueue[].
 *
 * SavedQueue shape:
 *   {
 *     regionName,         // string
 *     substrate,          // string ('maze', 'text_adventure', ...)
 *     arrivalExitId,      // string or 'entrance' for the start region
 *     departureExitId,    // string or null if the visit didn't exit
 *     actions,            // substrate-native action array
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

function isDuplicate(existing, candidate) {
    return existing.arrivalExitId === candidate.arrivalExitId
        && existing.departureExitId === candidate.departureExitId
        && actionsEqual(existing.actions, candidate.actions);
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
 * Save a queue. Returns:
 *   'saved'     — the queue was appended (and possibly evicted the oldest)
 *   'duplicate' — an existing queue with identical (arrival, departure,
 *                 actions) was already stored; the new one was dropped
 *   'invalid'   — required fields missing; nothing happened
 *
 * The caller supplies most fields; `recordedAt` and `name` are filled
 * in here so callers don't have to keep them in sync.
 */
export function saveQueue(rulesHash, queue) {
    if (!rulesHash || !queue || !queue.regionName || !queue.substrate || !Array.isArray(queue.actions)) {
        return 'invalid';
    }
    const cache = loadCache();
    const key = bucketKey(rulesHash, queue.regionName, queue.substrate);
    const bucket = cache.get(key) ?? [];

    if (bucket.some((existing) => isDuplicate(existing, queue))) {
        return 'duplicate';
    }

    const enriched = {
        ...queue,
        recordedAt: queue.recordedAt ?? Date.now(),
        name:
            queue.name
            ?? `auto: ${queue.arrivalExitId ?? '?'}→${queue.departureExitId ?? '?'}`,
    };

    bucket.push(enriched);
    // FIFO eviction by recordedAt — oldest first. The just-saved entry
    // is always the newest, so trimming from the front drops the oldest.
    bucket.sort((a, b) => (a.recordedAt ?? 0) - (b.recordedAt ?? 0));
    while (bucket.length > SAVED_QUEUE_PER_REGION_LIMIT) {
        bucket.shift();
    }
    cache.set(key, bucket);
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
