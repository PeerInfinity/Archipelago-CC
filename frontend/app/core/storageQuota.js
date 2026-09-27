/**
 * storageQuota — one place a failed localStorage write is reported, so a full
 * origin is SEEN instead of logged (plan §37.7.5, §37.9: the user's only trace
 * of a full origin was a console error from a Quick Launch fold).
 *
 * A writer that catches its own write error calls `reportStorageWriteFailure`.
 * When the error is a quota error, every listener registered with
 * `onStorageWriteFailure` receives one notice naming the key, the size that did
 * not fit and the largest keys. The Storage panel module registers the listener
 * that shows it (modules/storagePanel/quotaNotice.js). With no listener (a mode
 * without the Storage panel, or a unit test) the notice goes to console.warn.
 *
 * Imports nothing but storageKinds, and touches no DOM, so settingsManager and
 * the vitest suites can import it.
 */
import { LOCAL_STORAGE_QUOTA_CHARS } from './storageKinds.js';

/**
 * Whether `error` is the browser saying "this origin's storage is full".
 * Chromium/WebKit: DOMException name 'QuotaExceededError', legacy code 22.
 * Firefox: the same name today; older builds used 'NS_ERROR_DOM_QUOTA_REACHED' (code 1014).
 */
export function isQuotaExceededError(error) {
    if (!error) return false;
    const name = error.name;
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
    return error.code === 22 || error.code === 1014;
}

/**
 * The origin's localStorage use: key count, total chars (key + value, the unit
 * the quota counts) and the `top` largest keys. Never throws.
 */
export function localStorageUsage(storage = globalThis.localStorage, top = 3) {
    const rows = [];
    try {
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key === null) continue;
            rows.push({ key, chars: key.length + (storage.getItem(key)?.length ?? 0) });
        }
    } catch {
        /* storage unavailable: report what was read */
    }
    rows.sort((a, b) => b.chars - a.chars);
    return {
        keys: rows.length,
        chars: rows.reduce((sum, r) => sum + r.chars, 0),
        top: rows.slice(0, top),
    };
}

const listeners = new Set();

/** Register `listener(notice)`; returns the unsubscribe function. */
export function onStorageWriteFailure(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** "1,234,567" — the notice's number format. */
function fmt(n) {
    return Number(n).toLocaleString('en-US');
}

/**
 * Report a localStorage write that threw. Returns the notice when the error is a
 * quota error (null otherwise — the caller keeps its own handling for those).
 *
 * @param {object} failure
 * @param {string} failure.key          the key whose write failed
 * @param {string} [failure.value]      the value that did not fit (or pass `chars`)
 * @param {number} [failure.chars]      its size in chars, when the value is not at hand
 * @param {Error}  failure.error        what setItem threw
 * @param {string} [failure.owner]      who wrote it, for the message ("Settings", "Procgen Pipeline")
 */
export function reportStorageWriteFailure({ key, value, chars, error, owner } = {}) {
    if (!isQuotaExceededError(error)) return null;
    const attemptedChars = chars ?? ((key?.length ?? 0) + (value?.length ?? 0));
    const usage = localStorageUsage(globalThis.localStorage, 3);
    const largest = usage.top.map((r) => `${r.key} (${fmt(r.chars)})`).join(', ');
    const notice = {
        key,
        owner: owner ?? null,
        attemptedChars,
        usedChars: usage.chars,
        quotaChars: LOCAL_STORAGE_QUOTA_CHARS,
        top: usage.top,
        message: `Browser storage for this site is full (${fmt(usage.chars)} of about `
            + `${fmt(LOCAL_STORAGE_QUOTA_CHARS)} chars). ${owner ? `${owner}: saving` : 'Saving'} `
            + `"${key}" needed ${fmt(attemptedChars)} chars and was NOT saved.`
            + (largest ? ` The largest keys: ${largest}.` : ''),
    };
    if (listeners.size === 0) {
        console.warn(`[storageQuota] ${notice.message}`);
    }
    for (const listener of listeners) {
        try {
            listener(notice);
        } catch (e) {
            console.error('[storageQuota] a write-failure listener threw:', e);
        }
    }
    return notice;
}
