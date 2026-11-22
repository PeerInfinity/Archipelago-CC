/**
 * ⛓⛓ RE3 (i) — **THE SEEDLING WASM RUNTIME'S SAVE, ONE localStorage KEY PER ROOM** (slice sdc-wasm-save-host; the
 * host half of the SWFRecomp-CC SharedObject host hook, `SWFRecompDocs/guides/avm2-sharedobject-host-hook.md`, master
 * 746c39489). ⚖ Robert 2026-11-22: "Same setting and Clear" — the JS save's switch (`flashPanel.seedlingJsSave`) and
 * its "Clear this room's save" button act on this save too; the two saves keep separate keys (their formats differ).
 * RE2's rulings carry: damage is not restored ("a fresh life" — Seedling's save holds `hitsMax`, never the current
 * hits) and the saved position is not used (the AP start is the host's reset, `runSeedlingRandomizerLoad`).
 *
 *  · THE ROOM is the panel's mount identity (`seedlingMountKey`, `flashPanelUI._apLoadKey`), hashed by the JS save's
 *    `roomKeyHash`: the key is `seedlingWasmSave_<hash>`, JSON `{v, objects: {<runtime key>: <base64 AMF3>}}`, the
 *    runtime key being the hook's `host/path/name` (Seedling: `localhost/test.swf/shrumsave`).
 *  · THE HOOK (`Module.swfSharedObjectHost`) is installed on the game frame's `Module` before ▶ Start. Its `load`
 *    answers NULL at boot: the game boots on the DEFAULT set, whose `reconcileSave` would wipe an AP-stamped save.
 *  · THE RESTORE POINT is `beforeDeliver()`, called by the wiring in the SAME TURN as `deliver()` (no await between):
 *    `avm2_so_reload` repopulates `SAVE_FILE.data` in place from the stored bytes, and the AP LevelSet's constructor
 *    (`reconcileSave`, LevelSet.as:94-101, 590-661) then finds a save stamped with its own set and keeps it.
 *  · ⛔ WRITES ARE GATED UNTIL THE AP SET IS MOUNTED. Seedling never calls `flush()`, so `avm2_so_flush_all` is the
 *    only store — and before the delivery the game's save is the EMPTY, vanilla-stamped boot save. A flush then (a
 *    pagehide while the AP load is pending) would store it over the room's real save. So nothing flushes, and the
 *    hook's `store` drops what it is given, until `afterDeliver()` arms the run — in both cases, a save restored or
 *    none stored.
 *  · FLUSHED (when armed and on): debounced on each bridge state report (items, keys, totems, an apitem take, a
 *    crossing), on a 10 s idle interval (rock breaks and the slot order are not reported), on page hide, and at
 *    dispose. A store whose bytes equal the last write is not written again.
 *  · ⛓ DEGRADE BY NAME: a build without `_avm2_so_reload` / `_avm2_so_flush_all` (p4g, p4h rc1) gets no hook and no
 *    call — everything here is a no-op that says so once, and nothing throws.
 */
import { reportStorageWriteFailure } from '../../app/core/storageQuota.js';
import { roomKeyHash } from './seedlingJsSave.js';

export const WASM_SAVE_KEY_PREFIX = 'seedlingWasmSave_';
export const WASM_SAVE_VERSION = 1;
/** The owner the Storage panel's quota notice names. */
export const WASM_SAVE_OWNER = 'Flash Panel (Seedling wasm save)';
export const WASM_SAVE_DEBOUNCE_MS = 500;
export const WASM_SAVE_IDLE_FLUSH_MS = 10000;
/** The runtime's two exports (the hook doc §3), detected BY NAME on `Module` (`ccall` resolves `_<name>`). */
export const WASM_SO_RELOAD = 'avm2_so_reload';
export const WASM_SO_FLUSH_ALL = 'avm2_so_flush_all';

/** The localStorage key of a room (`seedlingMountKey`'s string). */
export function wasmSaveKey(roomKey) {
    return `${WASM_SAVE_KEY_PREFIX}${roomKeyHash(roomKey)}`;
}

/** Does this frame's `Module` carry the SharedObject host exports? (false on p4g / rc1, never a throw) */
export function wasmSaveSupported(Module) {
    try {
        return !!Module && typeof Module.ccall === 'function'
            && typeof Module[`_${WASM_SO_RELOAD}`] === 'function'
            && typeof Module[`_${WASM_SO_FLUSH_ALL}`] === 'function';
    } catch {
        return false;
    }
}

/** The SharedObject name of a runtime key `host/path/name` (its last segment). */
export function soNameOfKey(key) {
    const s = String(key);
    return s.slice(s.lastIndexOf('/') + 1);
}

function bytesToBase64(bytes) {
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
}

/** Parse a stored entry; null when absent or unreadable (with the reason logged). */
export function parseWasmSave(raw, log = () => {}) {
    if (raw === null || raw === undefined) return null;
    let save;
    try { save = JSON.parse(raw); } catch (err) {
        log(`[wasm save] the stored save is not JSON (${err.message}) — not restored`, 'error');
        return null;
    }
    if (save?.v !== WASM_SAVE_VERSION || !save.objects || typeof save.objects !== 'object') {
        log(`[wasm save] the stored save has version ${save?.v} (this host reads ${WASM_SAVE_VERSION}) — not restored`, 'error');
        return null;
    }
    return save;
}

/**
 * ⛓ USE THE SAVE / CLEAR — the panel's wasm save state, one per panel (the JS save's controller shape).
 *
 *  · `install(Module)` — on the game frame, before ▶ Start: the hook (load answers null until a reload asks).
 *  · `prepareLoad({on, roomKey})` — at the AP load, BEFORE the wiring runs (the setting read is async; nothing after
 *    it may be): this run's room and switch. Off = today's behaviour, nothing read or written.
 *  · `beforeDeliver()` — SYNC, in the delivery's turn: the stored save goes into `SAVE_FILE.data` in place.
 *  · `afterDeliver()` — the AP set is mounted: writes are armed (on), the idle interval starts.
 *  · `noteChange()` — a bridge state report: a debounced flush.
 *  · `flushNow()` — page hide / dispose.
 *  · `turnOn()` / `turnOff()` — the setting moved mid-run: on = write-only from now on (only once the set is mounted);
 *    off = nothing more is written.
 *  · `clear(roomKey)` — remove that room's key; a run on that room stops writing (its progress stays in the game).
 *  · `dispose()` — flush, then forget the frame.
 */
export function createWasmSaveController({
    storage = globalThis.localStorage, report = reportStorageWriteFailure, debounceMs = WASM_SAVE_DEBOUNCE_MS,
    idleFlushMs = WASM_SAVE_IDLE_FLUSH_MS, timers = globalThis, log = () => {},
} = {}) {
    let Module = null;
    let supported = false;
    let roomKey = null;
    let key = null;
    let on = false;
    let armed = false;
    let delivered = false;
    // ⛔ a stored save that EXISTS and was not restored is never overwritten: this load does not arm (js-22 ask 2)
    let restoreOk = true;
    let reloadAnswer = null; // {<runtime key>: base64} while a reload asks; null = "nothing" (boot)
    let objects = {};
    let lastWritten = null;
    let debounce = null;
    let idle = null;
    const counts = { flushAll: 0, reload: 0, writes: 0, storesDropped: 0 };

    const stopTimers = () => {
        if (debounce !== null) timers.clearTimeout(debounce);
        debounce = null;
        if (idle !== null) timers.clearInterval(idle);
        idle = null;
    };

    const writeEntry = () => {
        const text = JSON.stringify({ v: WASM_SAVE_VERSION, objects });
        if (text === lastWritten) return;
        try {
            storage.setItem(key, text);
            lastWritten = text;
            counts.writes += 1;
        } catch (error) {
            report({ key, value: text, error, owner: WASM_SAVE_OWNER });
            log(`[wasm save] the save was NOT written (${key}): ${error?.message ?? error}`, 'error');
        }
    };

    const hook = {
        load(_name, _localPath, rtKey) {
            return reloadAnswer?.[rtKey] ?? null;
        },
        store(_name, _localPath, bytes, rtKey) {
            // ⛔ THE GATE: before the AP set is mounted, the game's save is the vanilla boot save.
            if (!armed || !on || !key) { counts.storesDropped += 1; return; }
            if (bytes === null || bytes === undefined) delete objects[rtKey];
            else objects[rtKey] = bytesToBase64(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
            writeEntry();
        },
    };

    const flushAll = () => {
        if (!armed || !on || !supported) return 0;
        try {
            counts.flushAll += 1;
            return Module.ccall(WASM_SO_FLUSH_ALL, 'number', [], []);
        } catch (err) {
            log(`[wasm save] flush failed: ${err.message}`, 'error');
            return 0;
        }
    };

    const arm = () => {
        armed = true;
        if (idle === null && idleFlushMs > 0) idle = timers.setInterval(flushAll, idleFlushMs);
    };

    return {
        get key() { return key; },
        get armed() { return armed; },
        get supported() { return supported; },
        get on() { return on; },
        counts,
        hook,
        install(mod) {
            Module = mod ?? null;
            supported = wasmSaveSupported(Module);
            armed = false;
            delivered = false;
            stopTimers();
            if (!supported) {
                log('[wasm save] this wasm build has no SharedObject host hook (no avm2_so_reload / avm2_so_flush_all): '
                    + 'the save is not kept on this build');
                return false;
            }
            try { Module.swfSharedObjectHost = hook; } catch (err) {
                supported = false;
                log(`[wasm save] the hook could not be installed: ${err.message}`, 'error');
                return false;
            }
            return true;
        },
        prepareLoad({ on: isOn, roomKey: rk }) {
            stopTimers();
            armed = false;
            delivered = false;
            reloadAnswer = null;
            roomKey = typeof rk === 'string' ? rk : null;
            key = roomKey === null ? null : wasmSaveKey(roomKey);
            on = isOn === true && supported && key !== null;
            objects = {};
            lastWritten = null;
            restoreOk = true;
            if (!supported) return;
            if (isOn !== true) {
                log('[wasm save] the save is off (Settings: "Use the save"): this room\'s save is neither read nor written');
                return;
            }
            let raw = null;
            try { raw = storage?.getItem(key) ?? null; } catch (err) { log(`[wasm save] could not read ${key}: ${err.message}`, 'error'); }
            const save = parseWasmSave(raw, log);
            if (save) {
                objects = { ...save.objects };
                lastWritten = raw;
            }
            // a stored entry (readable or not) must be restored before anything is written over it
            if (raw !== null) restoreOk = false;
        },
        /** SYNC, in the delivery's turn. Returns {reloaded: number, tried: number}. */
        beforeDeliver() {
            const result = { reloaded: 0, tried: 0 };
            if (!on || !supported) return result;
            const keys = Object.keys(objects);
            if (keys.length === 0) return result; // nothing to restore (an unreadable entry stays unrestored)
            reloadAnswer = objects;
            try {
                for (const rtKey of keys) {
                    result.tried += 1;
                    counts.reload += 1;
                    const ok = Module.ccall(WASM_SO_RELOAD, 'number', ['string', 'string'], [soNameOfKey(rtKey), null]);
                    if (ok === 1) result.reloaded += 1;
                }
            } catch (err) {
                log(`[wasm save] the reload failed: ${err.message}`, 'error');
            } finally {
                reloadAnswer = null;
            }
            restoreOk = result.tried > 0 && result.reloaded === result.tried;
            log(result.reloaded > 0 ? `[wasm save] restored this room's save (${key})`
                : `[wasm save] this room's save (${key}) was NOT restored (the runtime took none of it)`,
            result.reloaded > 0 ? undefined : 'error');
            return result;
        },
        /** Returns whether writes were armed (false: off, or a stored save that was not restored). */
        afterDeliver() {
            delivered = true;
            if (!on) return false;
            if (!restoreOk) {
                log(`[wasm save] this room's stored save (${key}) was NOT restored, so nothing is written over it this `
                    + 'load (it is left exactly as stored)', 'error');
                return false;
            }
            arm();
            return true;
        },
        noteChange() {
            if (!armed || !on || debounce !== null) return;
            debounce = timers.setTimeout(() => { debounce = null; flushAll(); }, debounceMs);
        },
        flushNow() {
            if (debounce !== null) timers.clearTimeout(debounce);
            debounce = null;
            return flushAll();
        },
        turnOn() {
            if (on || !supported || key === null) return false;
            on = true;
            if (delivered) arm();
            log(`[wasm save] the save is on: this room's progress is written from now on (${key}); a stored save is read at the next load`);
            return true;
        },
        turnOff() {
            if (!on) return false;
            on = false;
            armed = false;
            stopTimers();
            log(`[wasm save] the save is off: nothing more is written (${key} is left as it was)`);
            return true;
        },
        clear(rk) {
            const k = wasmSaveKey(rk);
            let stopped = false;
            if (k === key && on) {
                on = false;
                armed = false;
                stopTimers();
                stopped = true;
            }
            let removed = false;
            if (!storage) return { key: k, removed, stopped }; // no storage here: nothing was ever kept
            try {
                removed = storage.getItem(k) !== null;
                storage.removeItem(k);
            } catch (err) {
                log(`[wasm save] this room's save (${k}) could not be cleared: ${err.message}`, 'error');
                return { key: k, removed: false, stopped, error: err.message };
            }
            if (removed) log(`[wasm save] cleared this room's save (${k})`);
            return { key: k, removed, stopped };
        },
        dispose() {
            if (debounce !== null || armed) this.flushNow();
            stopTimers();
            armed = false;
            delivered = false;
            on = false;
            try { if (Module && Module.swfSharedObjectHost === hook) Module.swfSharedObjectHost = undefined; } catch { /* the frame is gone */ }
            Module = null;
            supported = false;
        },
    };
}
