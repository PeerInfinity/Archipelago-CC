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
