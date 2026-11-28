/**
 * ⛓ USE THE SAVE / CLEAR (slice `js-save-toggle-clear`, ⚖ Robert 2026-11-19: "a clear button, and also a checkbox for
 * whether to use the save at all. Let's have it default off for now."). The RE2 save (`seedlingJsSave.js`) is read and
 * written only when `flashPanel.seedlingJsSave` is on (default OFF), and "Clear this room's save" removes exactly the
 * room's key, with the save on or off, and nothing writes it back behind the click.
 *
 * The runtime is a fake core (`exportSave` / `restoreSave` / `onSaveChange`); the storage counts every call. The
 * RE2 behaviour of the binding itself (what a save holds, the reload) is `seedlingDemo/jsRuntimeSave.test.js`'s.
 *
 * ── THE MUTATION LIST (run during development, each red by name here) ──
 *   m1 the schema default is true                    → "the setting: a boolean, default OFF…" red
 *   m2 `load` binds whatever `on` says               → "OFF: nothing is read and nothing is written" red; and the panel's
 *                                                      "the AP load with the setting OFF binds nothing" red
 *   m3 `clear` removes every `seedlingJsSave_` key   → "Clear removes exactly this room's key…" red
 *   m4 `clear` leaves the binding live               → "no re-write after a Clear…" red (the pending write lands)
 *   m5 `turnOff` disposes (flushes) the binding      → "switched OFF mid-run: the pending write is dropped…" red
 *   m6 `turnOn` binds with the restore               → "switched ON mid-run: write-only…" red (the stored save is read)
 *   m7 the panel acts on an unchanged value          → "a settings broadcast does not re-arm…" red
 */
import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import settingsManager from '../../app/core/settingsManager.js';
import { FlashPanelUI, SAVE_SWITCH_HINT } from './flashPanelUI.js';
import {
    bindJsSave, createJsSaveController, JS_SAVE_DEFAULT, JS_SAVE_KEY_PREFIX, JS_SAVE_SETTING_KEY, JS_SAVE_SETTING_PROP,
    jsSaveKey, jsSaveSchemaProps,
} from './seedlingJsSave.js';

/** A storage that records every call. */
function countingStorage(init = {}) {
    const m = new Map(Object.entries(init));
    const calls = [];
    return {
        calls,
        map: m,
        getItem: (k) => { calls.push(['get', k]); return m.has(k) ? m.get(k) : null; },
        setItem: (k, v) => { calls.push(['set', k]); m.set(k, String(v)); },
        removeItem: (k) => { calls.push(['remove', k]); m.delete(k); },
    };
}
function manualTimers() {
    const q = new Map();
    let id = 0;
    return {
        setTimeout: (fn) => { id += 1; q.set(id, fn); return id; },
        clearTimeout: (i) => q.delete(i),
        run: () => { const fns = [...q.values()]; q.clear(); fns.forEach((f) => f()); },
        get pending() { return q.size; },
    };
}
/** A fake core: its save is `{n}`, a change bumps n and announces it. */
function fakeRuntime(n = 0) {
    const listeners = new Set();
    const rt = {
        n,
        restoreSave: vi.fn((save) => { rt.n = save.n; return { ok: true }; }),
        exportSave: () => ({ n: rt.n }),
        onSaveChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
        change() { rt.n += 1; listeners.forEach((f) => f()); },
        get listening() { return listeners.size; },
    };
    return rt;
}
const writes = (storage) => storage.calls.filter(([op]) => op === 'set');
const reads = (storage) => storage.calls.filter(([op]) => op === 'get');

describe('⛓ USE THE SAVE — the setting', () => {
    it('the setting: a boolean, default OFF, in the panel\'s schema and its Settings section', () => {
        const props = jsSaveSchemaProps();
        expect(JS_SAVE_SETTING_KEY).toBe(`moduleSettings.flashPanel.${JS_SAVE_SETTING_PROP}`);
        expect(props[JS_SAVE_SETTING_PROP].type).toBe('boolean');
        expect(props[JS_SAVE_SETTING_PROP].default).toBe(false);
        expect(JS_SAVE_DEFAULT).toBe(false);
        const index = readFileSync(new URL('./index.js', import.meta.url), 'utf8');
        expect(index).toMatch(/\.\.\.jsSaveSchemaProps\(\)/);
        const ui = readFileSync(new URL('./flashPanelUI.js', import.meta.url), 'utf8');
        expect(ui).toMatch(/\{ prop: 'seedlingJsSave', label: 'Use the save', when: 'jsOrWasmSelected', hint: SAVE_SWITCH_HINT \}/);
    });
});

describe('⛓ USE THE SAVE — the controller (`createJsSaveController`)', () => {
    it('OFF: nothing is read and nothing is written, and the log says the save is off', () => {
        const storage = countingStorage({ [jsSaveKey('room A')]: JSON.stringify({ n: 7 }) });
        const timers = manualTimers();
        const logs = [];
        const ctl = createJsSaveController({ storage, timers, log: (m) => logs.push(m) });
        const rt = fakeRuntime();
        expect(ctl.load({ on: false, runtime: rt, roomKey: 'room A' })).toBe(null);
        rt.change();
        rt.change();
        timers.run();
        ctl.dispose();
        expect(storage.calls).toEqual([]);
        expect(rt.restoreSave).not.toHaveBeenCalled();
        expect(rt.listening).toBe(0);
        expect(ctl.binding).toBe(null);
        expect(logs).toEqual(['[js save] the save is off (Settings: "Use the save"): this room\'s save is neither read nor written']);
    });

    it('ON: exactly the RE2 binding — the same storage calls, the same restore, the same writes', () => {
        const run = (bindFn) => {
            const storage = countingStorage({ [jsSaveKey('room A')]: JSON.stringify({ n: 7 }) });
            const timers = manualTimers();
            const rt = fakeRuntime();
            const bound = bindFn({ storage, timers, rt });
            rt.change();
            rt.change();
            timers.run();
            rt.change();
            return { calls: storage.calls, restored: bound.restored, n: rt.n, map: [...storage.map], pending: timers.pending,
                restoreCalls: rt.restoreSave.mock.calls };
        };
        const direct = run(({ storage, timers, rt }) => bindJsSave({ runtime: rt, roomKey: 'room A', storage, timers }));
        const viaCtl = run(({ storage, timers, rt }) => createJsSaveController({ storage, timers })
            .load({ on: true, runtime: rt, roomKey: 'room A' }));
        expect(viaCtl).toEqual(direct);
        expect(direct.restored).toEqual({ ok: true });
        expect(direct.calls.map(([op]) => op)).toEqual(['get', 'set']);
    });

    it('Clear removes exactly this room\'s key: another room\'s save and every other key survive', () => {
        const other = jsSaveKey('room B');
        const storage = countingStorage({
            [jsSaveKey('room A')]: '{"n":1}', [other]: '{"n":2}', unrelated: 'x', [`${JS_SAVE_KEY_PREFIX}junk`]: 'y',
        });
        const logs = [];
        const ctl = createJsSaveController({ storage, timers: manualTimers(), log: (m) => logs.push(m) });
        const r = ctl.clear('room A');
        expect(r).toMatchObject({ key: jsSaveKey('room A'), removed: true, stopped: false });
        expect([...storage.map.keys()].sort()).toEqual([other, `${JS_SAVE_KEY_PREFIX}junk`, 'unrelated'].sort());
        expect(storage.calls.filter(([op]) => op === 'remove')).toEqual([['remove', jsSaveKey('room A')]]);
        expect(logs).toEqual([`[js save] cleared this room's save (${jsSaveKey('room A')})`]);
        // a second click: there is none, and it says so
        expect(ctl.clear('room A')).toMatchObject({ removed: false });
        expect(logs[1]).toBe(`[js save] this room had no save to clear (${jsSaveKey('room A')})`);
    });

    it('no re-write after a Clear: a pending write is dropped and later changes write nothing (save ON, bound)', () => {
        const key = jsSaveKey('room A');
        const storage = countingStorage({ [key]: '{"n":7}' });
        const timers = manualTimers();
        const ctl = createJsSaveController({ storage, timers });
        const rt = fakeRuntime();
        ctl.load({ on: true, runtime: rt, roomKey: 'room A' });
        rt.change();
        expect(timers.pending).toBe(1);                   // a write is pending behind the click
        const r = ctl.clear('room A');
        expect(r).toMatchObject({ removed: true, stopped: true, restoredThisRun: true });
        timers.run();
        rt.change();
        timers.run();
        ctl.dispose();                                    // the teardown flushes nothing either
        expect(storage.map.has(key)).toBe(false);
        expect(writes(storage)).toEqual([]);
        expect(rt.listening).toBe(0);
        // the next AP load of the room (save on) starts from no save
        const rt2 = fakeRuntime();
        const again = ctl.load({ on: true, runtime: rt2, roomKey: 'room A' });
        expect(again.restored).toBe(null);
        expect(rt2.restoreSave).not.toHaveBeenCalled();
    });

    it('Clear with a binding to ANOTHER room leaves that binding writing', () => {
        const storage = countingStorage();
        const timers = manualTimers();
        const ctl = createJsSaveController({ storage, timers });
        const rt = fakeRuntime();
        ctl.load({ on: true, runtime: rt, roomKey: 'room B' });
        expect(ctl.clear('room A')).toMatchObject({ stopped: false });
        rt.change();
        timers.run();
        expect(writes(storage)).toEqual([['set', jsSaveKey('room B')]]);
    });

    it('switched OFF mid-run: the pending write is dropped and nothing more is written', () => {
        const key = jsSaveKey('room A');
        const storage = countingStorage({ [key]: '{"n":7}' });
        const timers = manualTimers();
        const ctl = createJsSaveController({ storage, timers });
        const rt = fakeRuntime();
        ctl.load({ on: true, runtime: rt, roomKey: 'room A' });
        rt.change();
        expect(ctl.turnOff()).toBe(true);
        timers.run();
        rt.change();
        timers.run();
        ctl.dispose();
        expect(writes(storage)).toEqual([]);
        expect(storage.map.get(key)).toBe('{"n":7}');     // left as it was
    });

    it('switched ON mid-run: write-only from now on (the stored save is not read until the next load)', () => {
        const key = jsSaveKey('room A');
        const storage = countingStorage({ [key]: '{"n":7}' });
        const timers = manualTimers();
        const ctl = createJsSaveController({ storage, timers });
        const rt = fakeRuntime(3);
        ctl.load({ on: false, runtime: rt, roomKey: 'room A' });
        const bound = ctl.turnOn({ runtime: rt, roomKey: 'room A' });
        expect(bound.restored).toBe(null);
        expect(reads(storage)).toEqual([]);
        expect(rt.restoreSave).not.toHaveBeenCalled();
        rt.change();
        timers.run();
        expect(JSON.parse(storage.map.get(key))).toEqual({ n: 4 });
        expect(ctl.turnOn({ runtime: rt, roomKey: 'room A' })).toBe(bound);   // already on: the same binding
    });
});

describe('⛓ USE THE SAVE — the panel (a bare panel, the prototype\'s own methods)', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    function barePanel({ on }) {
        const storage = countingStorage({ [jsSaveKey('room A')]: '{"n":7}' });
        const timers = manualTimers();
        const logs = [];
        const rt = fakeRuntime();
        const adapter = { _getWin: () => ({ __seedlingJsRuntime: rt }) };
        const panel = Object.create(FlashPanelUI.prototype);
        Object.assign(panel, {
            adapter, transport: 'js', _apLoadKey: 'room A', _apLoadResult: { ok: true }, rootElement: { dataset: {} },
            _panelLog: (m) => logs.push(m),
        });
        panel._jsSaveCtl = createJsSaveController({ storage, timers, log: (m) => logs.push(m) });
        vi.spyOn(settingsManager, 'getSetting').mockImplementation(async (key, fallback) => (key === JS_SAVE_SETTING_KEY ? on.value : fallback));
        return { panel, storage, timers, logs, rt, adapter };
    }

    it('the AP load with the setting OFF binds nothing; ON binds and restores (glue re-read)', async () => {
        const on = { value: false };
        const { panel, storage, rt, adapter } = barePanel({ on });
        const glue = { syncEventsFromGame: vi.fn() };
        await panel._bindJsSave(adapter, glue);
        expect(panel._jsSave).toBe(null);
        expect(storage.calls).toEqual([]);
        expect(rt.restoreSave).not.toHaveBeenCalled();
        on.value = true;
        await panel._bindJsSave(adapter, glue);
        expect(panel._jsSave?.restored).toEqual({ ok: true });
        expect(glue.syncEventsFromGame).toHaveBeenCalledTimes(1);
        panel._unbindJsSave();
    });

    it('a settings broadcast does not re-arm a binding the Clear button stopped; a real switch acts', async () => {
        const on = { value: true };
        const { panel, storage, timers, rt, adapter } = barePanel({ on });
        panel._rulesLoaded = () => true;
        panel._mountKeyNow = () => 'room A';
        await panel._bindJsSave(adapter, null);
        rt.change();
        const r = panel.clearJsSave();
        expect(r).toMatchObject({ removed: true, stopped: true });
        expect(panel.rootElement.dataset.jsSaveClear).toBe('removed');
        await panel._onJsSaveSettingChanged();             // a `*` broadcast: the value did not change
        rt.change();
        timers.run();
        expect(panel._jsSave).toBe(null);
        expect(writes(storage)).toEqual([]);
        // a real switch: off, then on again → write-only from now on
        on.value = false;
        await panel._onJsSaveSettingChanged();
        on.value = true;
        await panel._onJsSaveSettingChanged();
        expect(panel._jsSave).not.toBe(null);
        rt.change();
        timers.run();
        expect(writes(storage)).toEqual([['set', jsSaveKey('room A')]]);
        panel._unbindJsSave();
    });

    // ⛓ SAVE HINT (slice `js-smalls-1`) — the measurement behind the JS row's "takes effect on the next game load":
    // the switch turned OFF mid-run leaves the run exactly where it is (the progress restored at this load stays in the
    // game; nothing is restored, re-read or reset), and turned back ON it reads nothing either. Only the next load acts.
    it('switched OFF mid-run after a restore: nothing rewinds; the run keeps its progress; ON again reads nothing', async () => {
        expect(SAVE_SWITCH_HINT).toBe('takes effect on the next game load');
        const on = { value: true };
        const { panel, storage, timers, rt, adapter } = barePanel({ on });
        await panel._bindJsSave(adapter, { syncEventsFromGame: () => {} });
        expect(rt.n).toBe(7);                                // the stored save was restored at this load
        rt.change();
        expect(rt.n).toBe(8);
        const readsBefore = reads(storage).length;
        on.value = false;
        await panel._onJsSaveSettingChanged();
        expect(panel._jsSave).toBe(null);
        expect(rt.n).toBe(8);                                // OFF: no rewind (not back to 7, not to a fresh 0)
        expect(rt.restoreSave).toHaveBeenCalledTimes(1);     // the load's restore only
        rt.change();
        expect(rt.n).toBe(9);                                // play goes on from where it was
        on.value = true;
        await panel._onJsSaveSettingChanged();
        expect(rt.n).toBe(9);                                // ON again: no restore mid-run either
        expect(rt.restoreSave).toHaveBeenCalledTimes(1);
        expect(reads(storage).length).toBe(readsBefore);     // and the stored save is not even read
        timers.run();
        panel._unbindJsSave();
    });

    it('Clear with no rules loaded names that, and touches no storage', () => {
        const { panel, storage, logs } = barePanel({ on: { value: false } });
        panel._rulesLoaded = () => false;
        expect(panel.clearJsSave()).toMatchObject({ removed: false, none: 'no-rules' });
        expect(storage.calls).toEqual([]);
        expect(logs).toEqual(['[js save] no rules are loaded, so there is no room whose save to clear']);
        expect(panel.rootElement.dataset.jsSaveClear).toBe('none');
    });
});
