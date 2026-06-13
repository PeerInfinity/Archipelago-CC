/**
 * Tests for SettingsManager's mode-keyed localStorage persistence.
 *
 * Covers Phase A of the loops-module-untangling plan
 * (CC/docs/plans/loops-module-untangling.md):
 * - saveSettings debounces a flurry of writes into one localStorage write
 * - _doSaveSettings preserves sibling fields in the existing mode blob
 * - updateSetting / updateSettings / resetToDefaults all trigger save
 * - setCurrentMode redirects writes to a different localStorage key
 *
 * The class export is used (not the default singleton) so each test
 * gets a fresh instance with no shared state.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsManager } from './settingsManager.js';
import { centralRegistry } from './centralRegistry.js';

function makeLocalStorageStub() {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
    _store: () => store,
  };
}

const SAMPLE_SETTINGS = {
  generalSettings: { theme: 'dark', autoSaveMode: false },
  moduleSettings: { loops: { autoRestart: false, defaultSpeed: 100 } },
  colorblindMode: { loops: false },
};

describe('SettingsManager — current mode tracking', () => {
  it("defaults to 'default' before app:activeModeDetermined fires", () => {
    const sm = new SettingsManager();
    expect(sm._currentMode).toBe('default');
    expect(sm.getStorageKey()).toBe('archipelagoToolSuite_modeData_default');
  });

  it('setCurrentMode updates the storage key', () => {
    const sm = new SettingsManager();
    sm.setCurrentMode('alttp');
    expect(sm._currentMode).toBe('alttp');
    expect(sm.getStorageKey()).toBe('archipelagoToolSuite_modeData_alttp');
  });

  it('setCurrentMode ignores empty strings and non-strings', () => {
    const sm = new SettingsManager();
    sm.setCurrentMode('alttp');
    sm.setCurrentMode('');
    sm.setCurrentMode(null);
    sm.setCurrentMode(undefined);
    sm.setCurrentMode(42);
    expect(sm._currentMode).toBe('alttp');
  });
});

describe('SettingsManager — debounced saveSettings', () => {
  let sm;
  beforeEach(() => {
    globalThis.localStorage = makeLocalStorageStub();
    vi.useFakeTimers();
    sm = new SettingsManager();
    sm.setInitialSettings(SAMPLE_SETTINGS);
  });
  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.localStorage;
  });

  it('does NOT write to localStorage immediately on first call', async () => {
    await sm.saveSettings();
    expect(localStorage.getItem(sm.getStorageKey())).toBeNull();
  });

  it('writes after the debounce window elapses', async () => {
    await sm.saveSettings();
    vi.advanceTimersByTime(100);
    const written = JSON.parse(localStorage.getItem(sm.getStorageKey()));
    expect(written.userSettings).toEqual(SAMPLE_SETTINGS);
  });

  it('coalesces a flurry of save calls into a single write', async () => {
    await sm.saveSettings();
    await sm.saveSettings();
    await sm.saveSettings();
    await sm.saveSettings();
    vi.advanceTimersByTime(100);
    // Inspect the localStorage stub directly.
    expect(Object.keys(localStorage._store()).length).toBe(1);
  });

  it('writes nothing when isLoading is true (e.g. before init)', async () => {
    const fresh = new SettingsManager();
    // No setInitialSettings call → isLoading stays true.
    await fresh.saveSettings();
    vi.advanceTimersByTime(100);
    expect(localStorage.getItem(fresh.getStorageKey())).toBeNull();
  });

  it('flushPendingSave runs the pending save immediately and cancels the timer', async () => {
    await sm.saveSettings();
    sm.flushPendingSave();
    // No timer advance — write happened synchronously inside flush.
    const written = JSON.parse(localStorage.getItem(sm.getStorageKey()));
    expect(written.userSettings).toEqual(SAMPLE_SETTINGS);
    // Subsequent timer fire is a no-op (the pending timeout was cleared).
    vi.advanceTimersByTime(100);
    expect(Object.keys(localStorage._store()).length).toBe(1);
  });

  it('flushPendingSave on an empty queue is a no-op', () => {
    expect(() => sm.flushPendingSave()).not.toThrow();
    expect(Object.keys(localStorage._store()).length).toBe(0);
  });
});

describe('SettingsManager — mode blob shape', () => {
  let sm;
  beforeEach(() => {
    globalThis.localStorage = makeLocalStorageStub();
    sm = new SettingsManager();
    sm.setInitialSettings(SAMPLE_SETTINGS);
  });
  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('writes the canonical {modeName, savedTimestamp, userSettings} shape', () => {
    sm._doSaveSettings();
    const written = JSON.parse(localStorage.getItem(sm.getStorageKey()));
    expect(written.modeName).toBe('default');
    expect(typeof written.savedTimestamp).toBe('string');
    expect(written.userSettings).toEqual(SAMPLE_SETTINGS);
  });

  it('preserves sibling fields in the existing mode blob (rulesConfig, layoutConfig, etc.)', () => {
    // Simulate a prior JSON-panel save that wrote rulesConfig + layoutConfig.
    localStorage.setItem(sm.getStorageKey(), JSON.stringify({
      modeName: 'default',
      savedTimestamp: '2026-05-01T00:00:00Z',
      rulesConfig: { game: 'alttp', seed: 1 },
      layoutConfig: { root: { type: 'stack' } },
      moduleConfig: { foo: 'bar' },
      userSettings: { /* will be overwritten */ },
    }));

    sm._doSaveSettings();

    const written = JSON.parse(localStorage.getItem(sm.getStorageKey()));
    expect(written.rulesConfig).toEqual({ game: 'alttp', seed: 1 });
    expect(written.layoutConfig).toEqual({ root: { type: 'stack' } });
    expect(written.moduleConfig).toEqual({ foo: 'bar' });
    expect(written.userSettings).toEqual(SAMPLE_SETTINGS);
  });

  it('updates savedTimestamp on each write', async () => {
    sm._doSaveSettings();
    const first = JSON.parse(localStorage.getItem(sm.getStorageKey())).savedTimestamp;
    await new Promise(r => setTimeout(r, 5));
    sm._doSaveSettings();
    const second = JSON.parse(localStorage.getItem(sm.getStorageKey())).savedTimestamp;
    expect(second).not.toBe(first);
  });

  it('writes a fresh blob when no existing blob exists', () => {
    expect(localStorage.getItem(sm.getStorageKey())).toBeNull();
    sm._doSaveSettings();
    const written = JSON.parse(localStorage.getItem(sm.getStorageKey()));
    expect(written).toMatchObject({
      modeName: 'default',
      userSettings: SAMPLE_SETTINGS,
    });
  });

  it('handles malformed existing blob gracefully (starts fresh, does not crash)', () => {
    localStorage.setItem(sm.getStorageKey(), 'not valid json{{{');
    expect(() => sm._doSaveSettings()).not.toThrow();
    const written = JSON.parse(localStorage.getItem(sm.getStorageKey()));
    expect(written.userSettings).toEqual(SAMPLE_SETTINGS);
  });

  it('routes writes to the current mode (changing mode redirects writes)', () => {
    sm._doSaveSettings();
    expect(localStorage.getItem('archipelagoToolSuite_modeData_default')).not.toBeNull();
    expect(localStorage.getItem('archipelagoToolSuite_modeData_alttp')).toBeNull();

    sm.setCurrentMode('alttp');
    sm._doSaveSettings();
    expect(localStorage.getItem('archipelagoToolSuite_modeData_alttp')).not.toBeNull();
  });

  it('deep-copies settings so post-save mutations do not bleed into the written blob', () => {
    sm._doSaveSettings();
    sm.settings.generalSettings.theme = 'light';
    const written = JSON.parse(localStorage.getItem(sm.getStorageKey()));
    expect(written.userSettings.generalSettings.theme).toBe('dark');
  });

  it('is a no-op when localStorage is unavailable', () => {
    delete globalThis.localStorage;
    expect(() => sm._doSaveSettings()).not.toThrow();
  });
});

describe('SettingsManager — updateSetting / updateSettings / resetToDefaults trigger save', () => {
  let sm;
  beforeEach(() => {
    globalThis.localStorage = makeLocalStorageStub();
    sm = new SettingsManager();
    sm.setInitialSettings(SAMPLE_SETTINGS);
  });
  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('updateSetting flushes to a single localStorage write', async () => {
    await sm.updateSetting('moduleSettings.loops.defaultSpeed', 250);
    sm.flushPendingSave();
    const written = JSON.parse(localStorage.getItem(sm.getStorageKey()));
    expect(written.userSettings.moduleSettings.loops.defaultSpeed).toBe(250);
  });

  it('updateSettings (bulk) flushes to one localStorage write', async () => {
    await sm.updateSettings({
      generalSettings: { theme: 'light' },
      moduleSettings: { loops: { autoRestart: true } },
    });
    sm.flushPendingSave();
    const written = JSON.parse(localStorage.getItem(sm.getStorageKey()));
    expect(written.userSettings.generalSettings.theme).toBe('light');
    expect(written.userSettings.moduleSettings.loops.autoRestart).toBe(true);
  });

  it('resetToDefaults flushes the defaults to localStorage', async () => {
    await sm.updateSetting('generalSettings.theme', 'light');
    sm.flushPendingSave();
    expect(JSON.parse(localStorage.getItem(sm.getStorageKey())).userSettings.generalSettings.theme).toBe('light');

    await sm.resetToDefaults();
    sm.flushPendingSave();
    expect(JSON.parse(localStorage.getItem(sm.getStorageKey())).userSettings.generalSettings.theme).toBe('dark');
  });

  it('updateSetting that produces no change still does NOT trigger a save', async () => {
    // updateSetting returns false (and skips the saveSettings call) when
    // the value didn't change.
    const ok = await sm.updateSetting('generalSettings.theme', 'dark'); // already 'dark'
    expect(ok).toBe(false);
    sm.flushPendingSave();
    // Nothing scheduled; localStorage still empty.
    expect(localStorage.getItem(sm.getStorageKey())).toBeNull();
  });
});

describe('SettingsManager — permissive updateSetting (auto-creates missing paths)', () => {
  let sm;
  beforeEach(() => {
    globalThis.localStorage = makeLocalStorageStub();
    sm = new SettingsManager();
    sm.setInitialSettings(SAMPLE_SETTINGS);
  });
  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('creates a missing intermediate object instead of refusing the update', async () => {
    // 'moduleSettings.brandNew' does not exist in SAMPLE_SETTINGS.
    const ok = await sm.updateSetting('moduleSettings.brandNew.enabled', true);
    expect(ok).toBe(true);
    expect(await sm.getSetting('moduleSettings.brandNew.enabled')).toBe(true);
  });

  it('persists the auto-created path to localStorage', async () => {
    await sm.updateSetting('moduleSettings.loops.brandNewToggle', true);
    sm.flushPendingSave();
    const written = JSON.parse(localStorage.getItem(sm.getStorageKey()));
    expect(written.userSettings.moduleSettings.loops.brandNewToggle).toBe(true);
  });

  it('handles deeply nested missing paths (creates each level)', async () => {
    await sm.updateSetting('a.b.c.d.e', 42);
    expect(await sm.getSetting('a.b.c.d.e')).toBe(42);
  });

  it('still rejects when the FINAL parent slot is a non-object scalar', async () => {
    // generalSettings.theme exists as a string. updateSetting('generalSettings.theme.deeper', ...)
    // tries to traverse INTO 'dark' — that's not auto-creatable.
    const ok = await sm.updateSetting('generalSettings.theme.deeper', 'oops');
    expect(ok).toBe(false);
  });
});

describe('SettingsManager — session overrides ({persist: false})', () => {
  let sm;
  beforeEach(() => {
    globalThis.localStorage = makeLocalStorageStub();
    sm = new SettingsManager();
    sm.setInitialSettings(SAMPLE_SETTINGS);
  });
  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('updateSetting with persist:false stores an override (does NOT touch this.settings or localStorage)', async () => {
    await sm.updateSetting('moduleSettings.loops.autoRestart', true, { persist: false });
    sm.flushPendingSave();
    // localStorage stays empty.
    expect(localStorage.getItem(sm.getStorageKey())).toBeNull();
    // Persisted base unchanged.
    expect(sm.settings.moduleSettings.loops.autoRestart).toBe(false);
    // But the override is visible via getSetting.
    expect(await sm.getSetting('moduleSettings.loops.autoRestart')).toBe(true);
  });

  it('persistent updateSetting clears any existing override (user write wins)', async () => {
    // Override autoRestart=true (session-only), then user writes
    // autoRestart=true with persist:true. The persistent write sees
    // `current[finalKey] === value` would be the OVERRIDE, not the
    // base — but updateSetting compares against the base
    // (this.settings), which is false, so the write goes through.
    // Override gets cleared and the new persisted value is true.
    await sm.updateSetting('moduleSettings.loops.autoRestart', true, { persist: false });
    await sm.updateSetting('moduleSettings.loops.autoRestart', true, { persist: true });
    expect(sm._overrides.has('moduleSettings.loops.autoRestart')).toBe(false);
    expect(await sm.getSetting('moduleSettings.loops.autoRestart')).toBe(true);
    sm.flushPendingSave();
    const written = JSON.parse(localStorage.getItem(sm.getStorageKey()));
    expect(written.userSettings.moduleSettings.loops.autoRestart).toBe(true);
  });

  it('clearOverride drops an override and getSetting falls back to persisted base', async () => {
    await sm.updateSetting('moduleSettings.loops.autoRestart', true, { persist: false });
    expect(await sm.getSetting('moduleSettings.loops.autoRestart')).toBe(true);
    await sm.clearOverride('moduleSettings.loops.autoRestart');
    expect(await sm.getSetting('moduleSettings.loops.autoRestart')).toBe(false);
  });

  it('clearOverride is a no-op (returns false) when no override exists', async () => {
    await expect(sm.clearOverride('nonexistent')).resolves.toBe(false);
  });

  it('clearAllOverrides drops every override at once', async () => {
    await sm.updateSetting('a', 1, { persist: false });
    await sm.updateSetting('b', 2, { persist: false });
    await sm.updateSetting('c', 3, { persist: false });
    await sm.clearAllOverrides();
    expect(sm._overrides.size).toBe(0);
  });

  it('overrides do NOT bleed into the localStorage write', async () => {
    await sm.updateSetting('moduleSettings.loops.autoRestart', true, { persist: false });
    // Trigger an unrelated persistent write that flushes the saver.
    await sm.updateSetting('moduleSettings.loops.defaultSpeed', 250, { persist: true });
    sm.flushPendingSave();
    const written = JSON.parse(localStorage.getItem(sm.getStorageKey()));
    expect(written.userSettings.moduleSettings.loops.defaultSpeed).toBe(250);
    expect(written.userSettings.moduleSettings.loops.autoRestart).toBe(false); // still the base value
  });

  it('settings:changed event fires when an override is set or cleared', async () => {
    const eventBus = (await import('./eventBus.js')).default;
    const spy = vi.spyOn(eventBus, 'publish');
    spy.mockClear();

    await sm.updateSetting('moduleSettings.loops.autoRestart', true, { persist: false });
    await sm.clearOverride('moduleSettings.loops.autoRestart');

    const matching = spy.mock.calls.filter(
      ([event, data]) => event === 'settings:changed' && data.key === 'moduleSettings.loops.autoRestart',
    );
    expect(matching.length).toBe(2);
    expect(matching[0][1].value).toBe(true);  // override set
    expect(matching[1][1].value).toBe(false); // override cleared → base value
    spy.mockRestore();
  });

  it('does NOT fire settings:changed when re-setting an override to the same value', async () => {
    const eventBus = (await import('./eventBus.js')).default;
    await sm.updateSetting('moduleSettings.loops.autoRestart', true, { persist: false });
    const spy = vi.spyOn(eventBus, 'publish');
    spy.mockClear();
    await sm.updateSetting('moduleSettings.loops.autoRestart', true, { persist: false });
    const matching = spy.mock.calls.filter(([event]) => event === 'settings:changed');
    expect(matching.length).toBe(0);
    spy.mockRestore();
  });
});

describe('SettingsManager — getSettings vs getEffectiveSettings', () => {
  let sm;
  beforeEach(() => {
    globalThis.localStorage = makeLocalStorageStub();
    sm = new SettingsManager();
    sm.setInitialSettings(SAMPLE_SETTINGS);
  });
  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('getSettings returns the persisted base (overrides excluded)', async () => {
    await sm.updateSetting('moduleSettings.loops.autoRestart', true, { persist: false });
    const snapshot = await sm.getSettings();
    expect(snapshot.moduleSettings.loops.autoRestart).toBe(false);
  });

  it('getEffectiveSettings layers overrides on top of the persisted base', async () => {
    await sm.updateSetting('moduleSettings.loops.autoRestart', true, { persist: false });
    const snapshot = await sm.getEffectiveSettings();
    expect(snapshot.moduleSettings.loops.autoRestart).toBe(true);
    // Other settings unaffected.
    expect(snapshot.generalSettings.theme).toBe('dark');
  });

  it('getEffectiveSettings creates missing intermediate objects for new override paths', async () => {
    await sm.updateSetting('moduleSettings.brandNew.toggle', true, { persist: false });
    const snapshot = await sm.getEffectiveSettings();
    expect(snapshot.moduleSettings.brandNew.toggle).toBe(true);
  });

  it('getEffectiveSettings deep-copies (mutations do not leak back to overrides)', async () => {
    await sm.updateSetting('moduleSettings.loops.autoRestart', true, { persist: false });
    const snapshot = await sm.getEffectiveSettings();
    snapshot.moduleSettings.loops.autoRestart = 'mutated';
    const fresh = await sm.getEffectiveSettings();
    expect(fresh.moduleSettings.loops.autoRestart).toBe(true);
  });
});

describe('SettingsManager — getSetting precedence (override > persisted > schema > call-site)', () => {
  // Schema-default resolution reads the live centralRegistry singleton.
  // Register schemas covering the heterogeneous shapes the resolver must
  // handle, then clean them up so the tests don't leak into siblings.
  const SCHEMA_MODULES = ['phase1Std', 'phase1Wrapped', 'phase1Flat'];

  beforeEach(() => {
    globalThis.localStorage = makeLocalStorageStub();
    // Standard shape: { type:'object', properties:{...} }.
    centralRegistry.settingsSchemas.set('phase1Std', {
      type: 'object',
      properties: {
        widgetSize: { type: 'number', default: 42 },
        // A property declared with NO default → resolver must report
        // found:false so getSetting falls through to the call-site default.
        noDefaultProp: { type: 'string' },
      },
    });
    // Double-wrapped shape: { <moduleId>: { properties:{...} } }.
    centralRegistry.settingsSchemas.set('phase1Wrapped', {
      phase1Wrapped: {
        type: 'object',
        properties: { wrappedToggle: { type: 'boolean', default: true } },
      },
    });
    // Flat shape (e.g. discovery): { <prop>: {default}, ... }.
    centralRegistry.settingsSchemas.set('phase1Flat', {
      flatColor: { type: 'string', default: '#abcdef' },
    });
  });
  afterEach(() => {
    for (const m of SCHEMA_MODULES) centralRegistry.settingsSchemas.delete(m);
    delete globalThis.localStorage;
  });

  function makeSm(settings = { moduleSettings: {} }) {
    const sm = new SettingsManager();
    sm.setInitialSettings(settings);
    return sm;
  }

  it('returns the schema default when the key is absent from persisted settings', async () => {
    const sm = makeSm();
    // No call-site default supplied → schema default (42) wins.
    expect(await sm.getSetting('moduleSettings.phase1Std.widgetSize')).toBe(42);
  });

  it('schema default beats the call-site default', async () => {
    const sm = makeSm();
    expect(await sm.getSetting('moduleSettings.phase1Std.widgetSize', 999)).toBe(42);
  });

  it('persisted value beats the schema default', async () => {
    const sm = makeSm({ moduleSettings: { phase1Std: { widgetSize: 7 } } });
    expect(await sm.getSetting('moduleSettings.phase1Std.widgetSize', 999)).toBe(7);
  });

  it('session override beats the persisted value AND the schema default', async () => {
    const sm = makeSm({ moduleSettings: { phase1Std: { widgetSize: 7 } } });
    await sm.updateSetting('moduleSettings.phase1Std.widgetSize', 123, { persist: false });
    expect(await sm.getSetting('moduleSettings.phase1Std.widgetSize', 999)).toBe(123);
  });

  it('falls through to the call-site default when the schema prop has no default', async () => {
    const sm = makeSm();
    expect(await sm.getSetting('moduleSettings.phase1Std.noDefaultProp', 'fallback')).toBe('fallback');
  });

  it('falls through to the call-site default when there is no schema entry at all', async () => {
    const sm = makeSm();
    expect(await sm.getSetting('moduleSettings.noSuchModule.prop', 'fallback')).toBe('fallback');
  });

  it('resolves defaults from the double-wrapped schema shape', async () => {
    const sm = makeSm();
    expect(await sm.getSetting('moduleSettings.phase1Wrapped.wrappedToggle', false)).toBe(true);
  });

  it('resolves defaults from the flat schema shape', async () => {
    const sm = makeSm();
    expect(await sm.getSetting('moduleSettings.phase1Flat.flatColor')).toBe('#abcdef');
  });

  it('a persisted value of false still beats a schema default (no truthiness confusion)', async () => {
    const sm = makeSm({ moduleSettings: { phase1Wrapped: { wrappedToggle: false } } });
    // Persisted false must win over schema default true.
    expect(await sm.getSetting('moduleSettings.phase1Wrapped.wrappedToggle', true)).toBe(false);
  });

  it('does not apply schema defaults to top-level (non-moduleSettings) keys', async () => {
    const sm = makeSm({ generalSettings: { theme: 'dark' } });
    // Even though a 'phase1Std' module schema exists, a top-level key is
    // not schema-able and must use the call-site default.
    expect(await sm.getSetting('generalSettings.missing', 'topLevelFallback')).toBe('topLevelFallback');
  });
});

describe('SettingsManager — disk-defaults loading for resetToDefaults', () => {
  const DISK_DEFAULTS = {
    generalSettings: { theme: 'dark', autoSaveMode: false },
    moduleSettings: { loops: { autoRestart: false, defaultSpeed: 100 } },
    colorblindMode: { loops: false },
  };

  beforeEach(() => {
    globalThis.localStorage = makeLocalStorageStub();
    globalThis.fetch = vi.fn(async (url) => {
      if (url === './settings/settings.json') {
        return {
          ok: true,
          status: 200,
          json: async () => JSON.parse(JSON.stringify(DISK_DEFAULTS)),
        };
      }
      return { ok: false, status: 404 };
    });
  });
  afterEach(() => {
    delete globalThis.localStorage;
    delete globalThis.fetch;
  });

  it('resetToDefaults uses disk defaults, NOT the session-start state', async () => {
    // Simulate init: setInitialSettings receives a localStorage-overlay
    // value (the user previously toggled autoRestart=true and saved it).
    const sessionStartSettings = JSON.parse(JSON.stringify(DISK_DEFAULTS));
    sessionStartSettings.moduleSettings.loops.autoRestart = true; // overlay
    const sm = new SettingsManager();
    sm.setInitialSettings(sessionStartSettings);

    // Wait for the lazy disk-defaults fetch.
    await sm._ensureDefaultsLoaded();

    // Sanity: settings reflect the overlay.
    expect(await sm.getSetting('moduleSettings.loops.autoRestart')).toBe(true);

    await sm.resetToDefaults();

    // After reset, the value is the DISK default (false), not the
    // session-start overlay (true). This is the bug we're fixing.
    expect(await sm.getSetting('moduleSettings.loops.autoRestart')).toBe(false);
  });

  it('resetToDefaults falls back to session-start snapshot when disk fetch fails', async () => {
    // Simulate fetch failure (matches the test/offline path).
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 404 }));

    const sessionStartSettings = JSON.parse(JSON.stringify(DISK_DEFAULTS));
    sessionStartSettings.moduleSettings.loops.autoRestart = true; // overlay
    const sm = new SettingsManager();
    sm.setInitialSettings(sessionStartSettings);

    await sm._ensureDefaultsLoaded();
    await sm.resetToDefaults();

    // Fallback: defaults = session-start snapshot. The overlay value
    // sticks. Matches the pre-fix behavior so tests / offline don't
    // regress.
    expect(await sm.getSetting('moduleSettings.loops.autoRestart')).toBe(true);
  });

  it('_ensureDefaultsLoaded only fetches once even when called repeatedly', async () => {
    const sm = new SettingsManager();
    sm.setInitialSettings(DISK_DEFAULTS);
    await Promise.all([
      sm._ensureDefaultsLoaded(),
      sm._ensureDefaultsLoaded(),
      sm._ensureDefaultsLoaded(),
    ]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
