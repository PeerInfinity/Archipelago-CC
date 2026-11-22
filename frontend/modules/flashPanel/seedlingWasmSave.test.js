/**
 * ⛓⛓ RE3 (i) — the wasm Seedling save's host half (`seedlingWasmSave.js`, slice sdc-wasm-save-host). The runtime is a
 * FAKE of the SWFRecomp-CC hook contract (`SWFRecompDocs/guides/avm2-sharedobject-host-hook.md` §1–3): one
 * SharedObject, `getLocal` at boot calls `load` once, `avm2_so_flush_all` calls `store` with its bytes, `avm2_so_reload`
 * calls `load` again and repopulates in place. The live half is measured on the p4h build (the slice's as-built).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
    WASM_SAVE_KEY_PREFIX, WASM_SAVE_VERSION, WASM_SO_FLUSH_ALL, WASM_SO_RELOAD, createWasmSaveController, soNameOfKey,
    wasmSaveKey, wasmSaveSupported,
} from './seedlingWasmSave.js';
import { jsSaveKey, roomKeyHash } from './seedlingJsSave.js';
import { runSeedlingRandomizerLoad } from './seedlingRandomizerWiring.js';
import {
    SO_SAVE_CAPABILITY, WASM_BUILD_CAPABILITIES,
} from './seedlingRandomizerEligibility.js';
import { isolatesJsSaves, ISOLATED_SAVE_PREFIXES } from '../tests/jsSaveIsolation.js';

const RT_KEY = 'localhost/test.swf/shrumsave';
const b64 = (arr) => Buffer.from(Uint8Array.from(arr)).toString('base64');

function memStorage(init = {}) {
    const map = new Map(Object.entries(init));
    const calls = [];
    return {
        map, calls,
        getItem(k) { calls.push(['get', k]); return map.has(k) ? map.get(k) : null; },
        setItem(k, v) { calls.push(['set', k]); map.set(k, String(v)); },
        removeItem(k) { calls.push(['remove', k]); map.delete(k); },
        key(i) { return [...map.keys()][i] ?? null; },
        get length() { return map.size; },
    };
}

function manualTimers() {
    let id = 0;
    const timeouts = new Map();
    const intervals = new Map();
    return {
        setTimeout(fn) { id += 1; timeouts.set(id, fn); return id; },
        clearTimeout(i) { timeouts.delete(i); },
        setInterval(fn) { id += 1; intervals.set(id, fn); return id; },
        clearInterval(i) { intervals.delete(i); },
        runTimeouts() { const fns = [...timeouts.values()]; timeouts.clear(); fns.forEach((f) => f()); },
        tickInterval() { [...intervals.values()].forEach((f) => f()); },
        get pendingTimeouts() { return timeouts.size; },
        get intervals() { return intervals.size; },
    };
}

/** The runtime's contract, faked: one SharedObject whose `data` is a byte array. */
function fakeModule({ exports = true } = {}) {
    const m = {
        data: null, // the live save (bytes) — null before getLocal
        loads: [],
        calls: [],
        swfSharedObjectHost: undefined,
        getLocal() { // Main.begin at boot: load ONCE
            const h = m.swfSharedObjectHost;
            const got = h?.load?.('shrumsave', null, RT_KEY) ?? null;
            m.loads.push(got);
            m.data = got ? [...Buffer.from(got, 'base64')] : [0xb0, 0x07]; // the vanilla boot save
        },
        play(bytes) { m.data = bytes; }, // the game changed its save
        ccall(name, ret, types, args) {
            m.calls.push(name);
            if (typeof m[`_${name}`] !== 'function') throw new Error(`${name} not exported`);
            return m[`_${name}`](...args);
        },
    };
    if (exports) {
        m[`_${WASM_SO_FLUSH_ALL}`] = () => {
            if (m.data === null) return 0;
            m.swfSharedObjectHost?.store?.('shrumsave', null, Uint8Array.from(m.data), RT_KEY);
            return 1;
        };
        m[`_${WASM_SO_RELOAD}`] = (name) => {
            if (m.data === null || name !== 'shrumsave') return 0;
            const got = m.swfSharedObjectHost?.load?.('shrumsave', null, RT_KEY) ?? null;
            if (!got) return 0;
            m.data = [...Buffer.from(got, 'base64')];
            return 1;
        };
    }
    return m;
}

const stored = (bytes) => JSON.stringify({ v: WASM_SAVE_VERSION, objects: { [RT_KEY]: b64(bytes) } });

function setup({ store = {}, exports = true, on = true, room = 'room A' } = {}) {
    const storage = memStorage(store);
    const timers = manualTimers();
    const logs = [];
    const report = vi.fn();
    const ctl = createWasmSaveController({ storage, timers, report, log: (m) => logs.push(m) });
    const Module = fakeModule({ exports });
    ctl.install(Module);
    Module.getLocal(); // ▶ Start → Main.begin
    ctl.prepareLoad({ on, roomKey: room });
    return { storage, timers, logs, report, ctl, Module };
}

describe('RE3 (i) — the key, the vocabulary, the setting', () => {
    it('the key is seedlingWasmSave_<roomKeyHash(mount key)>, the JS save\'s hash (never a hand-built string)', () => {
        expect(wasmSaveKey('room A')).toBe(`${WASM_SAVE_KEY_PREFIX}${roomKeyHash('room A')}`);
        expect(wasmSaveKey('room A').slice(WASM_SAVE_KEY_PREFIX.length)).toBe(jsSaveKey('room A').slice('seedlingJsSave_'.length));
        expect(wasmSaveKey('room A')).not.toBe(wasmSaveKey('room B'));
        expect(soNameOfKey(RT_KEY)).toBe('shrumsave');
    });

    it('`sosave` is in the declared vocabulary; flashPanel declares the prefix in moduleInfo.storage', () => {
        expect(SO_SAVE_CAPABILITY).toBe('sosave');
        expect(WASM_BUILD_CAPABILITIES).toContain(SO_SAVE_CAPABILITY);
        const index = readFileSync(new URL('./index.js', import.meta.url), 'utf8');
        expect(index).toContain(`prefix: '${WASM_SAVE_KEY_PREFIX}'`);
    });

    it('the panel: the JS setting\'s row shows for js OR wasm, the wasm side only on a `sosave` build', () => {
        const ui = readFileSync(new URL('./flashPanelUI.js', import.meta.url), 'utf8');
        expect(ui).toMatch(/\{ prop: 'seedlingJsSave', label: 'Use the save', when: 'jsOrWasmSelected' \}/);
        expect(ui).toMatch(/const wasmSelected = \(\(transport === 'wasm' && seedling\)[^;]*&& this\._wasmSaveCapable\(\);/s);
        expect(ui).toMatch(/includes\(SO_SAVE_CAPABILITY\) === true/);
        expect(ui).toMatch(/this\._jsSaveClearButton\.dataset\.applies = String\(jsOrWasmSelected\)/);
    });
});

describe('RE3 (i) — the hook', () => {
    it('boot: load answers NULL (the default set would wipe a real save), even with a save stored', () => {
        const { Module } = setup({ store: { [wasmSaveKey('room A')]: stored([1, 2, 3]) } });
        expect(Module.loads).toEqual([null]);
        expect(Module.data).toEqual([0xb0, 0x07]);
    });

    it('the reload puts the stored bytes into the live save, and the next store writes the room\'s entry', () => {
        const { ctl, Module, storage, timers } = setup({ store: { [wasmSaveKey('room A')]: stored([1, 2, 3]) } });
        expect(ctl.beforeDeliver()).toEqual({ reloaded: 1, tried: 1 });
        expect(Module.data).toEqual([1, 2, 3]);
        ctl.afterDeliver();
        Module.play([4, 5]);
        ctl.noteChange();
        timers.runTimeouts();
        expect(JSON.parse(storage.map.get(wasmSaveKey('room A')))).toEqual({ v: WASM_SAVE_VERSION, objects: { [RT_KEY]: b64([4, 5]) } });
    });

    it('store(null) — the game\'s clear() — deletes that object from the entry', () => {
        const { ctl, Module, storage } = setup();
        ctl.beforeDeliver();
        ctl.afterDeliver();
        Module.play([9]);
        ctl.flushNow();
        ctl.hook.store('shrumsave', null, null, RT_KEY);
        expect(JSON.parse(storage.map.get(wasmSaveKey('room A'))).objects).toEqual({});
    });

    it('a store whose bytes equal the last write is not written again (the 10 s idle flush)', () => {
        const { ctl, Module, storage, timers } = setup();
        ctl.afterDeliver();
        Module.play([7, 7]);
        expect(timers.intervals).toBe(1);
        timers.tickInterval();
        timers.tickInterval();
        timers.tickInterval();
        expect(storage.calls.filter(([op]) => op === 'set')).toHaveLength(1);
        expect(ctl.counts.flushAll).toBe(3);
        Module.play([8]);
        timers.tickInterval();
        expect(storage.calls.filter(([op]) => op === 'set')).toHaveLength(2);
    });

    it('a failed write goes to reportStorageWriteFailure', () => {
        const { ctl, Module, storage, report } = setup();
        storage.setItem = () => { throw new Error('QuotaExceededError'); };
        ctl.afterDeliver();
        Module.play([1]);
        ctl.flushNow();
        expect(report).toHaveBeenCalledTimes(1);
        expect(report.mock.calls[0][0]).toMatchObject({ key: wasmSaveKey('room A'), owner: 'Flash Panel (Seedling wasm save)' });
    });
});

describe('⛔ RE3 (i) — THE HAZARD: nothing is written before the AP set is mounted', () => {
    for (const withSave of [true, false]) {
        it(`${withSave ? 'a save stored' : 'no save stored'}: before deliver() returns, ZERO flush-all calls — a report, the idle tick and a page hide included — and the stored save is untouched`, () => {
            const before = stored([1, 2, 3]);
            const { ctl, Module, storage, timers } = setup({ store: withSave ? { [wasmSaveKey('room A')]: before } : {} });
            ctl.noteChange();
            timers.runTimeouts();
            timers.tickInterval();
            ctl.flushNow(); // pagehide while the AP load is pending
            ctl.hook.store('shrumsave', null, Uint8Array.from([0xb0, 0x07]), RT_KEY); // the runtime storing anyway
            expect(Module.calls.filter((c) => c === WASM_SO_FLUSH_ALL)).toEqual([]);
            expect(storage.map.get(wasmSaveKey('room A')) ?? null).toBe(withSave ? before : null);
            expect(storage.calls.filter(([op]) => op === 'set')).toEqual([]);
            ctl.beforeDeliver();
            ctl.flushNow(); // still before afterDeliver
            expect(Module.calls.filter((c) => c === WASM_SO_FLUSH_ALL)).toEqual([]);
            ctl.afterDeliver();
            ctl.flushNow();
            expect(Module.calls.filter((c) => c === WASM_SO_FLUSH_ALL)).toEqual([WASM_SO_FLUSH_ALL]);
        });
    }

    it('in the wiring: the reload runs IN THE SAME TURN as deliver() (no await between), and flush-all only after it', async () => {
        const order = [];
        let microtaskRan = false;
        const { ctl, Module } = setup({ store: { [wasmSaveKey('room A')]: stored([1, 2, 3]) } });
        const origReload = Module[`_${WASM_SO_RELOAD}`];
        Module[`_${WASM_SO_RELOAD}`] = (...a) => {
            order.push('reload');
            Promise.resolve().then(() => { microtaskRan = true; });
            return origReload(...a);
        };
        const flushes = () => Module.calls.filter((c) => c === WASM_SO_FLUSH_ALL).length;
        const delivery = {
            attachBot() { return this; },
            deliver() {
                order.push(`deliver(microtask ran: ${microtaskRan}, data: ${Module.data.join(',')}, flushes: ${flushes()})`);
                return { ok: true, chunks: 1, why: null };
            },
        };
        const glue = { setDelivery() { return glue; }, setCheckBinding() { order.push('bind'); return glue; }, binding: null };
        const overlay = { show() {}, hide() {}, setText() {}, remove() {} };
        const r = await runSeedlingRandomizerLoad({
            loaded: { tileSize: 16, set: { rooms: [1], start: { level: 0 } }, delivery, checkBinding: {} },
            glue, overlay,
            teleport: () => order.push('teleport'),
            bot: (n) => (n === 'botStatus' ? '{"level":0}' : '{"mobiles":[{"cls":"Player","x":88,"y":136}]}'),
            waitFrame: async () => {}, sleep: async () => {},
            now: (() => { let t = 0; return () => { t += 10; return t; }; })(),
            beforeDeliver: () => ctl.beforeDeliver(),
            afterDeliver: () => { order.push('afterDeliver'); ctl.afterDeliver(); },
        });
        expect(r.ok).toBe(true);
        expect(order.slice(0, 3)).toEqual(['reload', 'deliver(microtask ran: false, data: 1,2,3, flushes: 0)', 'afterDeliver']);
        expect(r.steps.find((s) => s.name === 'save-reload').detail).toEqual({ reloaded: 1, tried: 1 });
        expect(ctl.armed).toBe(true);
    });

    it('a REFUSED delivery does not arm (the vanilla rooms are playing)', async () => {
        const { ctl } = setup();
        const delivery = { attachBot() { return this; }, deliver: () => ({ ok: false, chunks: 0, why: 'no' }) };
        const glue = { setDelivery() { return glue; }, setCheckBinding() { return glue; }, binding: null };
        await runSeedlingRandomizerLoad({
            loaded: { tileSize: 16, set: { rooms: [1], start: { level: 0 } }, delivery },
            glue, overlay: { show() {}, hide() {}, setText() {}, remove() {} },
            teleport: () => {}, bot: () => '{}', waitFrame: async () => {}, sleep: async () => {},
            beforeDeliver: () => ctl.beforeDeliver(), afterDeliver: () => ctl.afterDeliver(),
        });
        expect(ctl.armed).toBe(false);
    });
});

describe('RE3 (i) — the switch, Clear, the degrade', () => {
    it('OFF: nothing is read, nothing reloaded, nothing flushed or written — today\'s behaviour', () => {
        const { ctl, Module, storage, timers } = setup({ on: false, store: { [wasmSaveKey('room A')]: stored([1]) } });
        expect(ctl.beforeDeliver()).toEqual({ reloaded: 0, tried: 0 });
        ctl.afterDeliver();
        Module.play([2]);
        ctl.noteChange();
        timers.runTimeouts();
        timers.tickInterval();
        ctl.flushNow();
        ctl.dispose();
        expect(Module.calls).toEqual([]);
        expect(storage.calls).toEqual([]);
        expect(timers.intervals).toBe(0);
    });

    it('turned ON mid-run: write-only, and only once the set is mounted; OFF mid-run: no more writes', () => {
        const { ctl, Module, storage } = setup({ on: false, store: { [wasmSaveKey('room A')]: stored([1]) } });
        ctl.turnOn();
        ctl.flushNow();
        expect(Module.calls).toEqual([]); // not mounted yet
        ctl.afterDeliver();
        Module.play([5]);
        ctl.flushNow();
        expect(Module.data).toEqual([5]); // never reloaded
        expect(JSON.parse(storage.map.get(wasmSaveKey('room A'))).objects[RT_KEY]).toBe(b64([5]));
        ctl.turnOff();
        Module.play([6]);
        ctl.flushNow();
        expect(JSON.parse(storage.map.get(wasmSaveKey('room A'))).objects[RT_KEY]).toBe(b64([5]));
    });

    it('Clear removes exactly this room\'s wasm key and stops this run writing', () => {
        const other = wasmSaveKey('room B');
        const { ctl, Module, storage } = setup({ store: { [wasmSaveKey('room A')]: stored([1]), [other]: stored([2]), x: 'y' } });
        ctl.beforeDeliver();
        ctl.afterDeliver();
        expect(ctl.clear('room A')).toEqual({ key: wasmSaveKey('room A'), removed: true, stopped: true });
        Module.play([3]);
        ctl.flushNow();
        expect(storage.map.has(wasmSaveKey('room A'))).toBe(false);
        expect(storage.map.get(other)).toBe(stored([2]));
        expect(storage.map.get('x')).toBe('y');
    });

    it('the panel\'s Clear button clears BOTH runtimes\' keys (the JS save\'s controller, then the wasm one)', () => {
        const ui = readFileSync(new URL('./flashPanelUI.js', import.meta.url), 'utf8');
        expect(ui).toMatch(/result = this\._jsSaveController\(\)\.clear\(roomKey\);\s*\/\/[^\n]*\n\s*const wasm = this\._wasmSaveController\(\)\.clear\(roomKey\);/);
    });

    it('p4g / rc1 (no avm2_so_reload / avm2_so_flush_all): no hook, no call, no throw', () => {
        expect(wasmSaveSupported(null)).toBe(false);
        expect(wasmSaveSupported({ ccall() {} })).toBe(false);
        expect(wasmSaveSupported(fakeModule())).toBe(true);
        const { ctl, Module, storage, timers, logs } = setup({ exports: false, store: { [wasmSaveKey('room A')]: stored([1]) } });
        expect(Module.swfSharedObjectHost).toBeUndefined();
        expect(() => {
            ctl.beforeDeliver();
            ctl.afterDeliver();
            ctl.noteChange();
            timers.runTimeouts();
            ctl.flushNow();
            ctl.turnOn();
            ctl.dispose();
        }).not.toThrow();
        expect(Module.calls).toEqual([]);
        expect(storage.calls).toEqual([]);
        expect(logs.some((l) => /no SharedObject host hook/.test(l))).toBe(true);
    });

    it('dispose flushes an armed run and takes the hook off the frame', () => {
        const { ctl, Module, storage } = setup();
        ctl.afterDeliver();
        Module.play([4]);
        ctl.dispose();
        expect(JSON.parse(storage.map.get(wasmSaveKey('room A'))).objects[RT_KEY]).toBe(b64([4]));
        expect(Module.swfSharedObjectHost).toBeUndefined();
    });
});

describe('RE3 (i) — the in-app isolation wrapper clears the wasm saves too', () => {
    it('a row starts with no wasm save and leaves the person\'s exactly as found', async () => {
        expect(ISOLATED_SAVE_PREFIXES).toContain(WASM_SAVE_KEY_PREFIX);
        const mine = wasmSaveKey('mine');
        const storage = memStorage({ [mine]: 'person', other: 'keep' });
        let seen = null;
        const row = isolatesJsSaves(async () => {
            seen = storage.getItem(mine);
            storage.setItem(wasmSaveKey('row'), 'row wrote this');
        }, storage);
        await row({});
        expect(seen).toBe(null);
        expect([...storage.map.entries()].sort()).toEqual([[mine, 'person'], ['other', 'keep']].sort());
    });
});

describe('RE3 (i) — the panel gates the wasm save on the build\'s CAPABILITY (a bare panel)', () => {
    const manifest = {
        builds: [
            { name: 'seedling_bot_ap_p4g', capabilities: ['apitem', 'arm', 'hold', 'tag', 'freeze', 'sincebegin', 'bossreport'] },
            { name: 'seedling_bot_ap_p4h', capabilities: ['apitem', 'arm', 'hold', 'tag', 'freeze', 'sincebegin', 'bossreport', 'sosave'] },
        ],
    };
    async function barePanel(build) {
        const { FlashPanelUI } = await import('./flashPanelUI.js');
        const panel = Object.create(FlashPanelUI.prototype);
        const logs = [];
        Object.assign(panel, {
            componentState: { wasmPath: `${build}/game.html` }, _wasmManifest: manifest, _panelLog: (m) => logs.push(m),
            rootElement: { dataset: {} },
        });
        return { panel, logs };
    }

    it('p4g (no `sosave`): not capable — the wasm side of "Use the save" and Clear is absent', async () => {
        const { panel } = await barePanel('seedling_bot_ap_p4g');
        expect(panel._wasmSaveCapable()).toBe(false);
    });

    it('a `sosave` build: capable; the panel\'s Clear deletes the room\'s wasm key (and the game\'s clear() is a store(null))', async () => {
        const { panel } = await barePanel('seedling_bot_ap_p4h');
        expect(panel._wasmSaveCapable()).toBe(true);
        const storage = memStorage({ [wasmSaveKey('room A')]: stored([1]) });
        panel._wasmSaveCtl = createWasmSaveController({ storage, timers: manualTimers() });
        panel._jsSaveCtl = { clear: () => ({ removed: false, stopped: false }) };
        panel._rulesLoaded = () => true;
        panel._mountKeyNow = () => 'room A';
        const r = panel.clearJsSave();
        expect(r).toMatchObject({ removed: true, wasm: { key: wasmSaveKey('room A'), removed: true } });
        expect(storage.map.has(wasmSaveKey('room A'))).toBe(false);
        expect(panel.rootElement.dataset.jsSaveClear).toBe('removed');
    });

    it('an unknown build or no manifest: not capable (and never a throw)', async () => {
        const { panel } = await barePanel('seedling_bot_ap_nope');
        expect(panel._wasmSaveCapable()).toBe(false);
        panel._wasmManifest = null;
        expect(panel._wasmSaveCapable()).toBe(false);
    });
});
