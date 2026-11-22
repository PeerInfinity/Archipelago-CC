/**
 * ⛓ RE2 — wrap an in-app row so the Seedling JS runtime's per-room saves (`seedlingJsSave_*`,
 * `flashPanel/seedlingJsSave.js`) neither reach it nor outlive it.
 *
 * The save is keyed by the room (the panel's mount key), and every row that loads the same preset loads the same
 * room. Unwrapped, a row restored the progress the row before it left: measured on the first TT dispatch of slice
 * seedling-js-save-localstorage (run 43621671362, seedling-js batch), four rows went red. The generated room's apitem
 * was already taken, the house chest already open, and an event a kill-lock row walked was "checked" on its own. The
 * person's own saves would be overwritten the same way. So the row starts with NO JS save (⚖ in-app tests set their
 * own initial state), and afterwards every key is put back exactly as found: the ones the row wrote are removed, and
 * the person's are restored. (⚖ 2026-09-26: every row cleans up after itself; `savedQueueIsolation.js` is the precedent.)
 */
import { JS_SAVE_KEY_PREFIX } from '../flashPanel/seedlingJsSave.js';
import { WASM_SAVE_KEY_PREFIX } from '../flashPanel/seedlingWasmSave.js';

/** ⛓ RE3 (i) — the wasm runtime's per-room saves (`seedlingWasmSave_*`) are isolated the same way. */
export const ISOLATED_SAVE_PREFIXES = Object.freeze([JS_SAVE_KEY_PREFIX, WASM_SAVE_KEY_PREFIX]);

function jsSaveKeys(storage) {
    const keys = [];
    for (let i = 0; i < storage.length; i += 1) {
        const k = storage.key(i);
        if (k !== null && ISOLATED_SAVE_PREFIXES.some((p) => k.startsWith(p))) keys.push(k);
    }
    return keys;
}

export function isolatesJsSaves(testFunction, storage = globalThis.localStorage) {
    const wrapped = async function (testController) {
        let found = null;
        try {
            found = new Map(jsSaveKeys(storage).map((k) => [k, storage.getItem(k)]));
            for (const k of found.keys()) storage.removeItem(k);
        } catch { found = null; /* no storage: nothing to isolate */ }
        try {
            return await testFunction(testController);
        } finally {
            if (found) {
                try {
                    for (const k of jsSaveKeys(storage)) storage.removeItem(k);
                    for (const [k, v] of found) storage.setItem(k, v);
                } catch { /* best effort, as savedQueueIsolation */ }
            }
        }
    };
    Object.defineProperty(wrapped, 'name', { value: testFunction.name });
    return wrapped;
}
