/**
 * World persistence across reloads.
 *
 * Persists the most-recently-loaded world to sessionStorage on every
 * `files:jsonLoaded`, and restores it at boot inside
 * `stateManager.postInitialize` — ahead of the first-preset fallback.
 * A full host-page reload (or a mobile-Chrome tab discard, which reboots
 * the page from scratch with sessionStorage preserved) otherwise drops the
 * user back to the default preset. Design:
 * `NewDocs/plans/world-persistence-reload-design.md`.
 *
 * Scope is the RULES PAYLOAD only, not play state — after a restore the world
 * is at sphere 0 exactly as if it had been re-loaded manually. Progress
 * snapshotting is a separate, out-of-scope project.
 *
 * Storage semantics (user ruling): sessionStorage, so a restored world dies
 * with the tab — no stale worlds leaking across browser sessions. The frontend
 * uses sessionStorage nowhere else, so there are no key-collision concerns.
 *
 * Persist/restore are split into small, dependency-injected functions so P1
 * can be unit-tested under vitest's `node` environment (no jsdom / no real
 * sessionStorage or fetch).
 *
 * @module stateManager/worldPersistence
 */

/** Single sessionStorage key holding the last-loaded world record. */
export const LAST_WORLD_KEY = 'apcc_lastWorld';

/**
 * Skip persisting inline payloads whose `JSON.stringify(jsonData)` exceeds this
 * many chars. The worst measured real cases (stardew preset ~2.6 MB, procgen
 * zone worlds ~1.8 MB) sit under it, and presets are path-type (~100 bytes)
 * anyway — this only guards pathological generated inline worlds against the
 * ~5M-UTF16-char sessionStorage quota.
 */
export const INLINE_SIZE_CAP = 4_000_000;

/**
 * A fetchable preset path, e.g.
 * `./presets/tunic/AP_14089154938208861744/AP_..._rules.json`. Preset loads
 * publish `sourceName: fullPath` (presetUI.js), so those persist as tiny
 * path-type records; everything else (manual upload, procgen, editor Apply)
 * persists inline.
 */
const PRESET_PATH_RE = /^\.?\/?presets\/.+\.json$/;

/** Best-effort access to sessionStorage (can throw in sandboxed iframes). */
function getSessionStorage() {
  try {
    return (typeof globalThis !== 'undefined' && globalThis.sessionStorage) || null;
  } catch {
    return null;
  }
}

/** Remove the entry, swallowing any storage error. */
function safeRemove(storage) {
  try {
    storage.removeItem(LAST_WORLD_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Validate the minimal shape of a parsed record. Returns the record if valid,
 * else null. Keeps the restore path (below) and any unit test in agreement.
 */
function isValidRecord(rec) {
  if (!rec || rec.v !== 1) return false;
  if (rec.type === 'path') return typeof rec.path === 'string' && rec.path.length > 0;
  if (rec.type === 'inline') return !!rec.jsonData && typeof rec.jsonData === 'object';
  return false;
}

/**
 * Build a persistable record from a `files:jsonLoaded` eventData, or null when
 * the payload is not persistable (no jsonData). Preset paths persist as
 * path-type; everything else inline.
 *
 * @param {object} eventData - The `files:jsonLoaded` payload.
 * @returns {object|null}
 */
export function buildLastWorldRecord(eventData) {
  if (!eventData || !eventData.jsonData) return null;
  const selectedPlayerId = eventData.selectedPlayerId;
  const playerInfo = eventData.playerInfo || null;
  const sourceName =
    eventData.sourceName || eventData.filename || eventData.source || 'userLoadedFile';
  if (PRESET_PATH_RE.test(sourceName)) {
    return { v: 1, type: 'path', path: sourceName, selectedPlayerId, playerInfo, sourceName };
  }
  return { v: 1, type: 'inline', jsonData: eventData.jsonData, selectedPlayerId, playerInfo, sourceName };
}

/**
 * Persist the last-loaded world from a `files:jsonLoaded` eventData.
 *
 * On an oversize inline payload, a write failure (e.g. QuotaExceededError) or a
 * non-persistable payload, the existing entry is REMOVED rather than left
 * behind — never keep a stale older world in front of a newer un-persisted one.
 *
 * Caller is responsible for the `generalSettings.restoreLastWorld` gate.
 *
 * @param {object} eventData - The `files:jsonLoaded` payload.
 * @param {{storage?: Storage}} [opts]
 */
export function persistLastWorld(eventData, { storage = getSessionStorage() } = {}) {
  if (!storage) return;
  let record;
  try {
    record = buildLastWorldRecord(eventData);
  } catch {
    record = null;
  }
  if (!record) {
    safeRemove(storage);
    return;
  }
  try {
    if (record.type === 'inline') {
      const serialized = JSON.stringify(record.jsonData);
      if (!serialized || serialized.length > INLINE_SIZE_CAP) {
        safeRemove(storage);
        return;
      }
    }
    storage.setItem(LAST_WORLD_KEY, JSON.stringify(record));
  } catch {
    // QuotaExceededError or any other write failure — clear, never leave stale.
    safeRemove(storage);
  }
}

/**
 * Resolve a validated record into the fields postInitialize needs. Path-type
 * records are fetched; inline-type use their stored payload directly. Throws on
 * fetch failure so the caller can clear + fall through to the preset ladder.
 *
 * @param {object} rec - A record already validated by isValidRecord.
 * @param {{fetchFn?: typeof fetch}} [opts]
 */
async function resolveRecord(rec, { fetchFn = globalThis.fetch } = {}) {
  if (rec.type === 'inline') {
    return {
      rulesConfig: rec.jsonData,
      sourceName: rec.sourceName || 'userLoaded',
      selectedPlayerId: rec.selectedPlayerId,
      playerInfo: rec.playerInfo || null,
    };
  }
  const resp = await fetchFn(rec.path);
  if (!resp || !resp.ok) {
    throw new Error(`fetch ${rec.path} -> ${resp ? resp.status : 'no response'}`);
  }
  const jsonData = await resp.json();
  return {
    rulesConfig: jsonData,
    sourceName: rec.sourceName || rec.path,
    selectedPlayerId: rec.selectedPlayerId,
    playerInfo: rec.playerInfo || null,
  };
}

/**
 * Read + validate + resolve the persisted world for boot restore.
 *
 * Returns the resolved `{ rulesConfig, sourceName, selectedPlayerId,
 * playerInfo }` on success, or null (fall through to the preset ladder) when
 * there is nothing to restore. On a CORRUPT entry or a fetch failure the entry
 * is REMOVED before returning null, so a bad payload cannot loop across
 * reboots. A SUCCESSFUL restore keeps the entry, so repeated tab
 * discards/reloads keep restoring the same world (the boot restore does not
 * re-publish `files:jsonLoaded`, so it neither re-persists nor mutates it).
 *
 * Caller is responsible for the `generalSettings.restoreLastWorld` gate.
 *
 * @param {{storage?: Storage, fetchFn?: typeof fetch}} [opts]
 * @returns {Promise<object|null>}
 */
export async function restoreLastWorld({ storage = getSessionStorage(), fetchFn = globalThis.fetch } = {}) {
  if (!storage) return null;
  let raw;
  try {
    raw = storage.getItem(LAST_WORLD_KEY);
  } catch {
    return null;
  }
  if (!raw) return null; // nothing stored — nothing to clear

  let rec = null;
  try {
    const parsed = JSON.parse(raw);
    if (isValidRecord(parsed)) rec = parsed;
  } catch {
    rec = null;
  }
  if (!rec) {
    safeRemove(storage); // corrupt/invalid → self-clear + fall through
    return null;
  }

  try {
    return await resolveRecord(rec, { fetchFn });
  } catch {
    safeRemove(storage); // fetch/resolve failure → self-clear + fall through
    return null;
  }
}
