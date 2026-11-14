/**
 * ⛓⛓ RE2 — **THE SEEDLING JS RUNTIME'S SAVE, ONE localStorage KEY PER ROOM** (seedling-js-save-localstorage;
 * ⚖ Robert 2026-11-14: "Save; resume where you were" → "Progress now, position next"; damage: "No, a fresh life").
 *
 * Before this, a page reload lost every JS Seedling clear (the broken rocks), key, seal, totem part and the slot
 * order: the save lived only in the iframe's memory (`design-reconnect-events.md` §4). The JS runtime's core now
 * exports and restores that save (`jsRuntimeCore` `exportSave` / `restoreSave`, `JS_SAVE_VERSION`'s head); THIS
 * module is where it is kept, in the HOST window (the jsRuntime page is same-origin, so it is the same origin's
 * localStorage either way, and here a failed write reaches the Storage panel's notice through
 * `reportStorageWriteFailure`, which an iframe's own module instance would not).
 *
 *  · THE ROOM is the panel's own mount identity — `seedlingMountKey`, the string `flashPanelUI._apLoadKey` holds —
 *    never a hand-built seed + slot + set string, so "the same room" and "the same rooms mounted" cannot drift. The
 *    key is `seedlingJsSave_<hash>` (the mount key itself is the whole sidecar payload, hundreds of KB).
 *  · READ once, when the AP load has landed (the set mounted — a mount clears the core's save — and the player put at
 *    the start): `restoreSave` sets the core's state at once and reboots in place on the next tick. A different
 *    room is a different key, so nothing is restored.
 *  · WRITTEN on each change the core announces (a persistence clear, an apitem, a boot — an item fold rides on one —
 *    a crossing, a slot write), debounced; and flushed when the binding is disposed or the page hides.
 *  · ⛔ The player's position is IN the save (`at`) and is NOT used: the AP start is the host's (the follow-up slice).
 */
import { reportStorageWriteFailure } from '../../app/core/storageQuota.js';

export const JS_SAVE_KEY_PREFIX = 'seedlingJsSave_';
/** The owner the Storage panel's quota notice names. */
export const JS_SAVE_OWNER = 'Flash Panel (Seedling JS save)';
export const JS_SAVE_DEBOUNCE_MS = 500;

/** Two 32-bit FNV-1a passes (different offsets) as 16 hex digits: the room key's short, stable name. */
export function roomKeyHash(text) {
    const s = String(text);
    let a = 0x811c9dc5;
    let b = 0x01000193 ^ 0x5bd1e995;
    for (let i = 0; i < s.length; i += 1) {
        const c = s.charCodeAt(i);
        a = Math.imul(a ^ c, 0x01000193) >>> 0;
        b = Math.imul(b ^ c, 0x01000193) >>> 0;
    }
    return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

/** The localStorage key of a room (`seedlingMountKey`'s string). */
export function jsSaveKey(roomKey) {
    return `${JS_SAVE_KEY_PREFIX}${roomKeyHash(roomKey)}`;
}

/**
 * Bind a JS runtime core to its room's save: restore what is stored, then keep it written.
 *
 * @param {object} o
 * @param {object} o.runtime   the page's core (`exportSave`, `restoreSave`, `onSaveChange`)
 * @param {string} o.roomKey   `seedlingMountKey` of the rules the AP load mounted
 * @param {Storage} [o.storage]
 * @param {Function} [o.report]  `reportStorageWriteFailure`
 * @param {number} [o.debounceMs]
 * @param {{setTimeout: Function, clearTimeout: Function}} [o.timers]
 * @param {(msg: string, cls?: string) => void} [o.log]
 * @returns {{key: string, restored: null|{ok: boolean, reason?: string}, flush: () => void, dispose: () => void}}
 */
export function bindJsSave({ runtime, roomKey, storage = globalThis.localStorage, report = reportStorageWriteFailure,
    debounceMs = JS_SAVE_DEBOUNCE_MS, timers = globalThis, log = () => {} } = {}) {
    const key = jsSaveKey(roomKey);
    let restored = null;
    let raw = null;
    try { raw = storage?.getItem(key) ?? null; } catch (err) { log(`[js save] could not read ${key}: ${err.message}`, 'error'); }
    if (raw !== null) {
        let save = null;
        try { save = JSON.parse(raw); } catch (err) { restored = { ok: false, reason: `not JSON (${err.message})` }; }
        if (save) restored = runtime.restoreSave(save);
        log(restored.ok ? `[js save] restored this room's save (${key})`
            : `[js save] this room's save (${key}) was NOT restored — ${restored.reason}`, restored.ok ? undefined : 'error');
    }

    let timer = null;
    let disposed = false;
    const write = () => {
        timer = null;
        let text;
        try { text = JSON.stringify(runtime.exportSave()); } catch (err) {
            log(`[js save] could not read the game's save: ${err.message}`, 'error');
            return;
        }
        try {
            storage.setItem(key, text);
        } catch (error) {
            report({ key, value: text, error, owner: JS_SAVE_OWNER });
            log(`[js save] the save was NOT written (${key}): ${error?.message ?? error}`, 'error');
        }
    };
    const schedule = () => {
        if (disposed || timer !== null) return;
        timer = timers.setTimeout(write, debounceMs);
    };
    const off = runtime.onSaveChange(schedule);
    return {
        key,
        restored,
        flush() {
            if (timer === null) return;
            timers.clearTimeout(timer);
            write();
        },
        dispose() {
            if (disposed) return;
            this.flush();
            disposed = true;
            off();
        },
    };
}
