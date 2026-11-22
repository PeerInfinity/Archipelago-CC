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
 *    a crossing, a slot write, ⛓ a host delivery written into the live run), debounced; and flushed when the binding is disposed or the page hides.
 *  · ⛔ The player's position is IN the save (`at`) and is NOT used: the AP start is the host's (the follow-up slice).
 *
 * ⛓ USE THE SAVE / CLEAR (slice `js-save-toggle-clear`, ⚖ Robert 2026-11-19: "a clear button, and also a checkbox for
 * whether to use the save at all. Let's have it default off for now."): `flashPanel.seedlingJsSave`, a boolean,
 * DEFAULT OFF. Off = the save is neither READ (no restore) nor WRITTEN. `createJsSaveController` is the panel's whole
 * save state: the binding (or none), the switch at run time, and the Clear button.
 */
import { reportStorageWriteFailure } from '../../app/core/storageQuota.js';

export const JS_SAVE_KEY_PREFIX = 'seedlingJsSave_';
/** The owner the Storage panel's quota notice names. */
export const JS_SAVE_OWNER = 'Flash Panel (Seedling JS save)';
export const JS_SAVE_DEBOUNCE_MS = 500;
/** ⛓ USE THE SAVE — the setting (`moduleSettings.flashPanel.seedlingJsSave`), default OFF. */
export const JS_SAVE_SETTING_PROP = 'seedlingJsSave';
export const JS_SAVE_SETTING_KEY = `moduleSettings.flashPanel.${JS_SAVE_SETTING_PROP}`;
export const JS_SAVE_DEFAULT = false;

/** The schema prop (the Settings panel's row and the default's one source). */
export function jsSaveSchemaProps() {
    return {
        [JS_SAVE_SETTING_PROP]: {
            type: 'boolean',
            default: JS_SAVE_DEFAULT,
            label: 'Seedling JS / wasm: use the save',
            description: "Runtime 'js', and runtime 'wasm' on a build that can keep its save (the manifest's `sosave`). "
                + "On: the game's progress in this room (the broken rocks, keys, seals, totem "
                + 'parts, slot order, and the time of day, on both runtimes) is kept in this browser and comes back '
                + 'when the same room is loaded again. Off '
                + '(the default): the save is neither read nor written. Turning it on takes effect at once (written from '
                + 'now on; a stored save is read at the next load); turning it off stops writing at once. The Flash '
                + "panel's \"Clear this room's save\" removes the stored save (both runtimes') either way.",
        },
    };
}

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
 * @param {boolean} [o.restore]  false = write only: the stored save is not read (⛓ USE THE SAVE turned on mid-run)
 * @returns {{key: string, restored: null|{ok: boolean, reason?: string}, flush: () => void, dispose: () => void,
 *   discard: () => void}}
 */
export function bindJsSave({ runtime, roomKey, storage = globalThis.localStorage, report = reportStorageWriteFailure,
    debounceMs = JS_SAVE_DEBOUNCE_MS, timers = globalThis, log = () => {}, restore = true } = {}) {
    const key = jsSaveKey(roomKey);
    let restored = null;
    let raw = null;
    if (restore) {
        try { raw = storage?.getItem(key) ?? null; } catch (err) { log(`[js save] could not read ${key}: ${err.message}`, 'error'); }
    }
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
        /** ⛓ USE THE SAVE — stop WITHOUT writing: a pending write is dropped (switched off; the save cleared). */
        discard() {
            if (disposed) return;
            if (timer !== null) timers.clearTimeout(timer);
            timer = null;
            disposed = true;
            off();
        },
    };
}

/**
 * ⛓ USE THE SAVE / CLEAR — the panel's save state, one per panel. `runtime` / `roomKey` are the page's core and the
 * mount key of the AP load, as `bindJsSave` takes them.
 *
 *  · `load({on, runtime, roomKey})` — at the AP load: the previous binding is disposed (flushed, as before), then ON
 *    binds exactly as before (read + write) and OFF binds nothing and logs one line.
 *  · `turnOn({runtime, roomKey})` — the setting turned on mid-run: binds WRITE-ONLY from now on (the stored save is
 *    read only at the next AP load; reading it now would rewind a run that is in progress).
 *  · `turnOff()` — the setting turned off mid-run: unbinds and writes nothing further (a pending write is dropped).
 *  · `dispose()` — the panel's teardown: flush and unbind (today's behaviour; nothing to do when off).
 *  · `clear(roomKey)` — remove that room's key, and nothing else. A binding to THAT room is stopped first, without
 *    writing: the run's own memory still holds the progress, so a binding left live would write it straight back on
 *    the next change. The next AP load binds again (if on), with no save to read.
 *
 * @returns the controller; `binding` is the live binding or null.
 */
export function createJsSaveController({ storage = globalThis.localStorage, report, debounceMs, timers, log = () => {} } = {}) {
    let binding = null;
    const bind = (runtime, roomKey, restore) => bindJsSave({
        runtime, roomKey, storage, log, restore,
        ...(report ? { report } : {}), ...(debounceMs !== undefined ? { debounceMs } : {}), ...(timers ? { timers } : {}),
    });
    return {
        get binding() { return binding; },
        load({ on, runtime, roomKey }) {
            this.dispose();
            if (on !== true) {
                log(`[js save] the save is off (Settings: "Use the save"): this room's save is neither read nor written`);
                return null;
            }
            binding = bind(runtime, roomKey, true);
            return binding;
        },
        turnOn({ runtime, roomKey }) {
            if (binding) return binding;
            binding = bind(runtime, roomKey, false);
            log(`[js save] the save is on: this room's progress is written from now on (${binding.key}); a stored save is read at the next load`);
            return binding;
        },
        turnOff() {
            if (!binding) return false;
            const { key } = binding;
            binding.discard();
            binding = null;
            log(`[js save] the save is off: nothing more is written (${key} is left as it was)`);
            return true;
        },
        dispose() {
            binding?.dispose();
            binding = null;
        },
        clear(roomKey) {
            const key = jsSaveKey(roomKey);
            let stopped = false;
            let restoredThisRun = false;
            if (binding && binding.key === key) {
                restoredThisRun = binding.restored?.ok === true;
                binding.discard();
                binding = null;
                stopped = true;
            }
            let removed = false;
            try {
                removed = storage.getItem(key) !== null;
                storage.removeItem(key);
            } catch (err) {
                log(`[js save] this room's save (${key}) could not be cleared: ${err.message}`, 'error');
                return { key, removed: false, stopped, restoredThisRun, error: err.message };
            }
            log(removed ? `[js save] cleared this room's save (${key})` : `[js save] this room had no save to clear (${key})`);
            if (stopped) {
                log(`[js save] nothing more is written for this run (its progress is still in the game${
                    restoredThisRun ? ', restored from the save at this load' : ''}); the next load of this room starts with no save`);
            }
            return { key, removed, stopped, restoredThisRun };
        },
    };
}
