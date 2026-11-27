/**
 * ⛓ USE THE SAVE / CLEAR FOR THE FLASH (RUFFLE) SAVE (slice `ruffle-save-toggle-clear`, ⚖ Robert 2026-11-19: "Same
 * toggle + clear for Ruffle"). `flashPanel.seedlingRuffleSave`, default OFF: OFF = the SWF finds no save at its boot
 * and nothing it saves is seen by a later boot; ON = untouched. "Clear the Flash save" removes exactly this page's
 * `…/shrumsave` key and its aside key.
 *
 * Ruffle is modelled by what was MEASURED on the pinned 0.7.1 (`seedlingRuffleSave.js`'s header): it reads the key
 * once at the SWF's `getLocal` (after the host's `prepareRuffleSave`, which runs before the player is built), writes
 * it at each `flush()`, and writes it again when the player is removed and when the page unloads — in any order
 * relative to the host's own handlers.
 *
 * ── THE MUTATION LIST (run during development, each red by name here) ──
 *   m1 `RUFFLE_SAVE_DEFAULT = true` / the schema default true   → "the setting: a boolean, default OFF…"
 *   m2 `prepareRuffleSave` ignores `on` (never sets aside)      → "OFF: the game boots with no save…"
 *   m3 OFF with an aside key keeps the save key                 → "OFF: what an OFF run saved is never seen…"
 *   m4 ON ignores the aside key                                 → "ON after OFF: the save set aside comes back byte for byte"
 *   m5 ON touches the save key with no aside key                → "ON: today's behaviour…"
 *   m6 `clearRuffleSave` removes every `/shrumsave` key          → "Clear removes exactly this page's key…"
 *   m7 a live Clear does not set the marker                     → "Clear during a run: what the running game writes…"
 *   m8 a failed aside write still removes the save              → "a save that cannot be set aside is never removed"
 *   m9 the panel prepares for a non-Seedling game               → "the panel: only Seedling's save…"
 */
import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import settingsManager from '../../app/core/settingsManager.js';
import { FlashPanelUI, SAVE_SWITCH_HINT } from './flashPanelUI.js';
import {
    clearRuffleSave, endRuffleSaveRun, prepareRuffleSave, RUFFLE_SAVE_ASIDE_PREFIX, RUFFLE_SAVE_DEFAULT,
    RUFFLE_SAVE_SETTING_KEY, RUFFLE_SAVE_SETTING_PROP, ruffleSaveAsideKey, ruffleSaveKey, ruffleSaveSchemaProps,
} from './seedlingRuffleSave.js';

const BASE = 'http://localhost:8000/frontend/index.html';
const SWF = './modules/flashPanel/swf/seedling_injected.swf';
const KEY = 'localhost/frontend/modules/flashPanel/swf/seedling_injected.swf/shrumsave';
const ASIDE = `${RUFFLE_SAVE_ASIDE_PREFIX}${KEY}`;

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

/** Ruffle's player, as measured: `boot` = the SWF's getLocal; `flush`; `remove` / `unload` write what it holds. */
function rufflePlayer(storage, key = KEY) {
    const p = {
        seen: undefined,
        data: null,
        boot() { p.seen = storage.map.has(key) ? storage.map.get(key) : null; p.data = p.seen; return p.seen; },
        play(v) { p.data = v; },
        flush() { storage.map.set(key, p.data); },
        remove() { if (p.data !== null) storage.map.set(key, p.data); },
    };
    return p;
}
/** One page boot: the host prepares, then the player is built and the SWF reads its save. */
function boot(storage, on) {
    prepareRuffleSave({ on, key: KEY, storage });
    const p = rufflePlayer(storage);
    p.boot();
    return p;
}

describe('⛓ USE THE SAVE (Flash) — the setting and the key', () => {
    it('the setting: a boolean, default OFF, in the panel\'s schema and its Settings section', () => {
        const props = ruffleSaveSchemaProps();
        expect(RUFFLE_SAVE_SETTING_KEY).toBe(`moduleSettings.flashPanel.${RUFFLE_SAVE_SETTING_PROP}`);
        expect(RUFFLE_SAVE_SETTING_PROP).toBe('seedlingRuffleSave');
        expect(props[RUFFLE_SAVE_SETTING_PROP].type).toBe('boolean');
        expect(props[RUFFLE_SAVE_SETTING_PROP].default).toBe(false);
        expect(RUFFLE_SAVE_DEFAULT).toBe(false);
        const index = readFileSync(new URL('./index.js', import.meta.url), 'utf8');
        expect(index).toMatch(/\.\.\.ruffleSaveSchemaProps\(\)/);
        expect(index).toMatch(/prefix: 'seedlingRuffleSaveAside_'/);
        const ui = readFileSync(new URL('./flashPanelUI.js', import.meta.url), 'utf8');
        expect(ui).toMatch(/\{ prop: 'seedlingRuffleSave', label: 'Use the save', when: 'flashSelected', hint: SAVE_SWITCH_HINT \}/);
    });

    it('the key is Ruffle\'s, as measured: hostname (no port), the SWF path, the name; the query is not in it', () => {
        expect(ruffleSaveKey(SWF, BASE)).toBe(KEY);
        expect(ruffleSaveKey(`${SWF}?v=2`, BASE)).toBe(KEY);
        expect(ruffleSaveKey('swf/probe.swf', 'http://localhost:8191/probe.html')).toBe('localhost/swf/probe.swf/shrumsave');
        expect(ruffleSaveKey(null, BASE)).toBe(null);
        expect(ruffleSaveAsideKey(KEY)).toBe(ASIDE);
    });
});

describe('⛓ USE THE SAVE (Flash) — OFF / ON', () => {
    it('OFF: the game boots with no save; the stored save is set aside untouched', () => {
        const storage = countingStorage({ [KEY]: 'STORED' });
        const r = prepareRuffleSave({ on: false, key: KEY, storage });
        expect(r.action).toBe('set-aside');
        const p = rufflePlayer(storage);
        expect(p.boot()).toBe(null);
        expect(JSON.parse(storage.map.get(ASIDE))).toEqual({ saved: 'STORED' });
    });

    it('OFF: what an OFF run saved is never seen by a later boot, whatever order the unload writes come in', () => {
        const storage = countingStorage({ [KEY]: 'STORED' });
        const a = boot(storage, false);
        a.play('OFF-RUN-1'); a.flush();
        a.remove();                                      // Ruffle's removal write
        expect(endRuffleSaveRun({ key: KEY, storage })).toBe(true); // the panel's courtesy, after it
        expect(storage.map.has(KEY)).toBe(false);
        // a second OFF run whose unload write lands AFTER every host handler (no courtesy ran)
        const b = boot(storage, false);
        expect(b.seen).toBe(null);
        b.play('OFF-RUN-2'); b.flush(); b.remove();
        expect(storage.map.get(KEY)).toBe('OFF-RUN-2');  // on disk until the next boot …
        const c = boot(storage, false);
        expect(c.seen).toBe(null);                       // … which never shows it
        c.remove();
        // ON again: the stored save from before the switch, not an OFF run's
        expect(boot(storage, true).seen).toBe('STORED');
    });

    it('ON after OFF: the save set aside comes back byte for byte, and the aside key goes', () => {
        const bytes = 'AL8AAAAeVENTTwAEAAAAAAAJc2hydW1zYXZlAAAAAwNuBAEA';
        const storage = countingStorage({ [KEY]: bytes });
        boot(storage, false).remove();
        const r = prepareRuffleSave({ on: true, key: KEY, storage });
        expect(r.action).toBe('restored');
        expect(storage.map.get(KEY)).toBe(bytes);
        expect(storage.map.has(ASIDE)).toBe(false);
        // OFF with no save stored, then ON: still no save (the OFF run's is thrown away)
        const empty = countingStorage();
        const off = boot(empty, false); off.play('X'); off.flush(); off.remove();
        expect(prepareRuffleSave({ on: true, key: KEY, storage: empty }).action).toBe('restored-none');
        expect([...empty.map.keys()]).toEqual([]);
    });

    it('ON: today\'s behaviour — the host reads only the aside key, never touches the save key', () => {
        const storage = countingStorage({ [KEY]: 'STORED', other: '1' });
        const r = prepareRuffleSave({ on: true, key: KEY, storage });
        expect(r.action).toBe('untouched');
        expect(storage.calls).toEqual([['get', ASIDE]]);
        expect(Object.fromEntries(storage.map)).toEqual({ [KEY]: 'STORED', other: '1' });
        const p = rufflePlayer(storage);
        expect(p.boot()).toBe('STORED');
        p.play('NEXT'); p.flush();
        expect(endRuffleSaveRun({ key: KEY, storage })).toBe(false); // an ON run's save stays
        expect(storage.map.get(KEY)).toBe('NEXT');
    });

    it('a save that cannot be set aside is never removed (this run sees it, and the log says so)', () => {
        const storage = countingStorage({ [KEY]: 'STORED' });
        storage.setItem = () => { throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); };
        const logs = [];
        const report = vi.fn();
        const r = prepareRuffleSave({ on: false, key: KEY, storage, log: (m) => logs.push(m), report });
        expect(r.action).toBe('error');
        expect(storage.map.get(KEY)).toBe('STORED');
        expect(report).toHaveBeenCalledTimes(1);
        expect(logs.at(-1)).toMatch(/could not be set aside .*this run sees the stored save/);
    });
});

describe('⛓ CLEAR THE FLASH SAVE', () => {
    it('Clear removes exactly this page\'s key and its aside key; every other key survives', () => {
        const otherSwf = 'localhost/frontend/modules/flashPanel/swf/other.swf/shrumsave';
        const storage = countingStorage({
            [KEY]: 'S', [ASIDE]: '{"saved":"T"}', [otherSwf]: 'O', [`${RUFFLE_SAVE_ASIDE_PREFIX}${otherSwf}`]: '{"saved":"P"}',
            seedlingJsSave_0123456789abcdef: '{}', unrelated: 'u',
        });
        const logs = [];
        expect(clearRuffleSave({ key: KEY, storage, log: (m) => logs.push(m) })).toMatchObject({ removed: true, key: KEY });
        expect(storage.calls.filter(([op]) => op !== 'get')).toEqual([['remove', KEY], ['remove', ASIDE]]);
        expect([...storage.map.keys()].sort()).toEqual([`${RUFFLE_SAVE_ASIDE_PREFIX}${otherSwf}`, otherSwf,
            'seedlingJsSave_0123456789abcdef', 'unrelated'].sort());
        expect(logs).toEqual([`[flash save] cleared the Flash save (${KEY})`]);
        expect(clearRuffleSave({ key: KEY, storage, log: (m) => logs.push(m) }).removed).toBe(false);
        expect(logs.at(-1)).toBe(`[flash save] there was no Flash save to clear (${KEY})`);
    });

    it('Clear with the save set aside (OFF) removes the save set aside too', () => {
        const storage = countingStorage({ [KEY]: 'STORED' });
        boot(storage, false).remove();
        expect(clearRuffleSave({ key: KEY, storage }).removed).toBe(true);
        expect(boot(storage, true).seen).toBe(null);
    });

    it('Clear during a run: what the running game writes afterwards is thrown away at the next boot (on or off)', () => {
        for (const on of [true, false]) {
            const storage = countingStorage({ [KEY]: 'STORED' });
            const p = boot(storage, on);
            expect(clearRuffleSave({ key: KEY, live: true, storage }).removed).toBe(true);
            p.play('AFTER-CLEAR'); p.flush(); p.remove();   // the running game writes again
            expect(boot(storage, on).seen).toBe(null);
            expect(boot(storage, true).seen).toBe(null);
        }
    });

    it('Clear with no Flash game configured names that and touches no storage', () => {
        const storage = countingStorage({ [KEY]: 'S' });
        const logs = [];
        expect(clearRuffleSave({ key: null, storage, log: (m) => logs.push(m) })).toMatchObject({ removed: false, none: 'no-key' });
        expect(storage.calls).toEqual([]);
        expect(logs).toEqual(['[flash save] no Flash game is configured, so there is no save to clear']);
    });
});

describe('⛓ USE THE SAVE (Flash) — the panel (a bare panel, the prototype\'s own methods)', () => {
    afterEach(() => { vi.restoreAllMocks(); });

    function barePanel({ configPath = './modules/flashPanel/games/seedling.json', storage = countingStorage({ [KEY]: 'STORED' }) } = {}) {
        const logs = [];
        const panel = Object.create(FlashPanelUI.prototype);
        Object.assign(panel, {
            swfPath: SWF, configPath, rootElement: { dataset: {} }, _ruffleSaveStorage: storage,
            _panelLog: (m) => logs.push(m),
        });
        vi.stubGlobal('document', { baseURI: BASE });
        return { panel, storage, logs };
    }
    afterEach(() => { vi.unstubAllGlobals(); });

    it('the panel: only Seedling\'s save — another Flash game\'s boot touches no storage', () => {
        const { panel, storage } = barePanel({ configPath: './modules/flashPanel/games/robotkitty.json' });
        expect(panel._ruffleSaveKeyNow()).toBe(null);
        expect(panel._prepareRuffleSave(false)).toBe(null);
        expect(storage.calls).toEqual([]);
        expect(panel.clearRuffleSave()).toMatchObject({ removed: false, none: 'no-key' });
        expect(storage.calls).toEqual([]);
    });

    it('the panel: OFF sets the save aside before the embed, the teardown throws the OFF run\'s save away; Clear marks the live run', () => {
        const { panel, storage, logs } = barePanel();
        vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
        expect(panel._ruffleSaveKeyNow()).toBe(KEY);
        expect(panel._prepareRuffleSave(false).action).toBe('set-aside');
        expect(panel.rootElement.dataset.ruffleSave).toBe('off:set-aside');
        expect(panel._ruffleSaveRun).toEqual({ key: KEY, on: false });
        expect(window.addEventListener).toHaveBeenCalledWith('pagehide', expect.any(Function));
        const p = rufflePlayer(storage);
        expect(p.boot()).toBe(null);
        p.play('OFF-RUN'); p.flush(); p.remove();
        expect(panel._endRuffleSaveRun()).toBe(true);
        expect(storage.map.has(KEY)).toBe(false);
        expect(panel._ruffleSaveRun).toBe(null);
        // ON: the save comes back; Clear with the run live marks it, so the game's later write is thrown away
        expect(panel._prepareRuffleSave(true).action).toBe('restored');
        expect(panel.clearRuffleSave()).toMatchObject({ removed: true, live: true });
        expect(panel.rootElement.dataset.ruffleSaveClear).toBe('removed');
        expect(Number(panel.rootElement.dataset.ruffleSaveClearedAt)).toBeGreaterThan(0);
        expect(JSON.parse(storage.map.get(ASIDE))).toEqual({ saved: null });
        expect(logs.some((m) => m.startsWith('[flash save] the save is off'))).toBe(true);
    });

    it('the panel: a change of the switch during a run says it acts at the next load; the same value says nothing', () => {
        const { panel, logs } = barePanel();
        panel._ruffleSaveRun = { key: KEY, on: false };
        panel._onRuffleSaveSettingChanged(false);
        expect(logs).toEqual([]);
        panel._onRuffleSaveSettingChanged(true);
        expect(logs).toEqual(["[flash save] \"Use the save\" is now on: it takes effect at the game's next load (this run keeps the save off)"]);
    });

    it('the panel reads the setting with its default OFF', async () => {
        const { panel } = barePanel();
        const spy = vi.spyOn(settingsManager, 'getSetting').mockImplementation(async (_k, fallback) => fallback);
        expect(await panel._readRuffleSaveSetting()).toBe(false);
        expect(spy).toHaveBeenCalledWith(RUFFLE_SAVE_SETTING_KEY, false);
    });
});

/* ── ⛓ SAVE HINT (slice `js-smalls-1`, ⚖ Robert 2026-11-26: "Leave it, note it in the UI") ── a switch changed during a
 * run never rewinds a game that already read its save, so both "Use the save" rows carry a muted hint saying when the
 * switch acts. Pinned on the RENDERED Settings section (a minimal fake document: no jsdom in this repo). */
function fakeEl(tag) {
    const el = {
        tagName: tag.toUpperCase(), children: [], dataset: {}, style: {}, className: '', title: '', type: '', value: '',
        textContent: '', classList: { add: (c) => { el.className = `${el.className} ${c}`.trim(); } },
        append: (...kids) => { el.children.push(...kids); },
        appendChild: (k) => { el.children.push(k); return k; },
        addEventListener: () => {}, setAttribute: () => {},
        set innerHTML(v) { el._html = v; },
        querySelector: () => fakeEl('span'),
    };
    return el;
}
describe('⛓ SAVE HINT — both "Use the save" switches say when they act', () => {
    it('the hint reads "takes effect on the next game load", in the Ruffle row and the JS row, and in no other row', () => {
        expect(SAVE_SWITCH_HINT).toBe('takes effect on the next game load');
        const host = fakeEl('div');
        const panel = Object.create(FlashPanelUI.prototype);
        panel.rootElement = { querySelector: (sel) => (sel === '.flash-panel-settings' ? host : fakeEl('div')) };
        const saved = globalThis.document;
        globalThis.document = { createElement: fakeEl };
        try { panel._buildSettingsControls(); } finally { globalThis.document = saved; }
        const hinted = host.children
            .filter((row) => row.className === 'flash-panel-setting')
            .filter((row) => row.children.some((c) => c.className === 'flash-panel-setting-hint'));
        expect(hinted.map((row) => row.dataset.setting)).toEqual(['seedlingJsSave', 'seedlingRuffleSave']);
        for (const row of hinted) {
            const hint = row.children.find((c) => c.className === 'flash-panel-setting-hint');
            expect(hint.textContent).toBe(SAVE_SWITCH_HINT);
            expect(row.children.indexOf(hint)).toBe(row.children.length - 1);   // after the switch and its label
            expect(hint.tagName).toBe('SPAN');
        }
    });
});
