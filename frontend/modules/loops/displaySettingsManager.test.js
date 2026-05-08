/**
 * Tests for DisplaySettingsManager — caches loops-panel settings,
 * persists them via settingsManager + localStorage, and reacts to
 * external settings:changed events.
 *
 * Stubs localStorage (node has none) and settingsManager.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DisplaySettingsManager } from './displaySettingsManager.js';

function makeLocalStorageStub() {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
    _store: () => store,
  };
}

function makeSettingsManager(initial = {}) {
  const values = { ...initial };
  return {
    values,
    getSetting: vi.fn(async (key, def) => (key in values ? values[key] : def)),
    updateSetting: vi.fn(async (key, value) => {
      values[key] = value;
    }),
  };
}

describe('DisplaySettingsManager — defaults and getters', () => {
  beforeEach(() => {
    globalThis.localStorage = makeLocalStorageStub();
  });
  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('initializes with documented defaults', () => {
    const mgr = new DisplaySettingsManager(makeSettingsManager(), null);
    expect(mgr.getSetting('colorblindMode')).toBe(false);
    expect(mgr.getSetting('defaultSpeed')).toBe(100);
    expect(mgr.getSetting('autoRestart')).toBe(false);
    expect(mgr.getSetting('instantMode')).toBe(false);
    expect(mgr.getSetting('loopModeEnabled')).toBe(false);
    expect(mgr.getSetting('keepFocused')).toBe(false);
  });

  it('getColorblindMode mirrors the cached value', () => {
    const mgr = new DisplaySettingsManager(makeSettingsManager(), null);
    expect(mgr.getColorblindMode()).toBe(false);
  });

  it('getSettingsKey maps colorblindMode specially and others under moduleSettings.loops', () => {
    const mgr = new DisplaySettingsManager(makeSettingsManager(), null);
    expect(mgr.getSettingsKey('colorblindMode')).toBe('colorblindMode.loops');
    expect(mgr.getSettingsKey('autoRestart')).toBe('moduleSettings.loops.autoRestart');
    expect(mgr.getSettingsKey('keepFocused')).toBe('moduleSettings.loops.keepFocused');
  });
});

describe('DisplaySettingsManager — setSetting persistence', () => {
  let sm, mgr;
  beforeEach(() => {
    globalThis.localStorage = makeLocalStorageStub();
    sm = makeSettingsManager();
    mgr = new DisplaySettingsManager(sm, null);
  });
  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('persist=true updates settingsManager AND localStorage', async () => {
    await mgr.setSetting('autoRestart', true);
    expect(sm.updateSetting).toHaveBeenCalledWith('moduleSettings.loops.autoRestart', true);
    const stored = JSON.parse(localStorage.getItem('archipelago_loop_settings'));
    expect(stored.autoRestart).toBe(true);
  });

  it('persist=false skips settingsManager AND localStorage', async () => {
    await mgr.setSetting('instantMode', true, false);
    expect(sm.updateSetting).not.toHaveBeenCalled();
    expect(localStorage.getItem('archipelago_loop_settings')).toBeNull();
    // Cache still updated.
    expect(mgr.getSetting('instantMode')).toBe(true);
  });

  it('reverts cache when settingsManager.updateSetting rejects', async () => {
    sm.updateSetting.mockRejectedValueOnce(new Error('disk full'));
    await mgr.setSetting('autoRestart', true);
    // Cache rolled back to old value (false).
    expect(mgr.getSetting('autoRestart')).toBe(false);
  });

  it('setColorblindMode persists via the colorblindMode.loops key', async () => {
    await mgr.setColorblindMode(true);
    expect(sm.updateSetting).toHaveBeenCalledWith('colorblindMode.loops', true);
    expect(mgr.getColorblindMode()).toBe(true);
  });
});

describe('DisplaySettingsManager — localStorage round-trip', () => {
  beforeEach(() => {
    globalThis.localStorage = makeLocalStorageStub();
  });
  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('loadPersistedSettings overlays localStorage on top of settingsManager values', async () => {
    // settingsManager says autoRestart=false (default), but localStorage
    // has true → localStorage wins (loadPersistedSettings calls _loadFromLocalStorage last).
    localStorage.setItem('archipelago_loop_settings', JSON.stringify({
      defaultSpeed: 250,
      autoRestart: true,
      instantMode: true,
      keepFocused: true,
    }));

    const mgr = new DisplaySettingsManager(makeSettingsManager(), null);
    await mgr.loadPersistedSettings();
    expect(mgr.getSetting('defaultSpeed')).toBe(250);
    expect(mgr.getSetting('autoRestart')).toBe(true);
    expect(mgr.getSetting('instantMode')).toBe(true);
    expect(mgr.getSetting('keepFocused')).toBe(true);
  });

  it('only persists the four LS-tracked fields (colorblindMode is NOT in LS)', async () => {
    const sm = makeSettingsManager();
    const mgr = new DisplaySettingsManager(sm, null);
    await mgr.setSetting('colorblindMode', true);
    const stored = JSON.parse(localStorage.getItem('archipelago_loop_settings'));
    expect('colorblindMode' in stored).toBe(false);
    expect(stored).toEqual({
      defaultSpeed: 100,
      autoRestart: false,
      instantMode: false,
      keepFocused: false,
    });
  });

  it('_loadFromLocalStorage tolerates malformed JSON', async () => {
    localStorage.setItem('archipelago_loop_settings', 'not-json');
    const mgr = new DisplaySettingsManager(makeSettingsManager(), null);
    await expect(mgr.loadPersistedSettings()).resolves.toBeUndefined();
    // Defaults preserved.
    expect(mgr.getSetting('autoRestart')).toBe(false);
  });

  it('_loadFromLocalStorage tolerates missing key', async () => {
    const mgr = new DisplaySettingsManager(makeSettingsManager(), null);
    await mgr.loadPersistedSettings();
    expect(mgr.getSetting('defaultSpeed')).toBe(100);
  });

  it('_loadFromLocalStorage ignores wrong-typed fields', async () => {
    localStorage.setItem('archipelago_loop_settings', JSON.stringify({
      defaultSpeed: '500',     // wrong type — string not number
      autoRestart: 'yes',      // wrong type — string not boolean
      instantMode: true,       // accepted
    }));
    const mgr = new DisplaySettingsManager(makeSettingsManager(), null);
    await mgr.loadPersistedSettings();
    expect(mgr.getSetting('defaultSpeed')).toBe(100); // default preserved
    expect(mgr.getSetting('autoRestart')).toBe(false); // default preserved
    expect(mgr.getSetting('instantMode')).toBe(true);
  });
});

describe('DisplaySettingsManager — handleSettingsChanged', () => {
  let sm, mgr;
  beforeEach(() => {
    globalThis.localStorage = makeLocalStorageStub();
    sm = makeSettingsManager();
    mgr = new DisplaySettingsManager(sm, null);
  });
  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('returns false for unrelated keys', () => {
    expect(mgr.handleSettingsChanged({ key: 'someUnrelatedKey', value: 1 })).toBe(false);
    // Unrelated change shouldn't touch the cache.
    expect(mgr.getSetting('autoRestart')).toBe(false);
  });

  it('updates cache for colorblindMode.loops', () => {
    expect(mgr.handleSettingsChanged({ key: 'colorblindMode.loops', value: true })).toBe(true);
    expect(mgr.getColorblindMode()).toBe(true);
  });

  it('updates cache for each loop-related moduleSettings key', () => {
    mgr.handleSettingsChanged({ key: 'moduleSettings.loops.defaultSpeed', value: 250 });
    mgr.handleSettingsChanged({ key: 'moduleSettings.loops.autoRestart', value: true });
    mgr.handleSettingsChanged({ key: 'moduleSettings.loops.loopModeEnabled', value: true });
    mgr.handleSettingsChanged({ key: 'moduleSettings.loops.keepFocused', value: true });
    expect(mgr.getSetting('defaultSpeed')).toBe(250);
    expect(mgr.getSetting('autoRestart')).toBe(true);
    expect(mgr.getSetting('loopModeEnabled')).toBe(true);
    expect(mgr.getSetting('keepFocused')).toBe(true);
  });

  it('returns true and reloads everything for wildcard ("*") changes', async () => {
    sm.values['moduleSettings.loops.defaultSpeed'] = 333;
    expect(mgr.handleSettingsChanged({ key: '*', value: undefined })).toBe(true);
    // Wildcard reload happens asynchronously — wait a tick.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mgr.getSetting('defaultSpeed')).toBe(333);
  });
});

describe('DisplaySettingsManager — syncFromUI / syncToUI guards', () => {
  beforeEach(() => {
    globalThis.localStorage = makeLocalStorageStub();
  });
  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('syncFromUI is a no-op when rootElement is null', () => {
    const mgr = new DisplaySettingsManager(makeSettingsManager(), null);
    expect(() => mgr.syncFromUI()).not.toThrow();
    expect(mgr.getSetting('defaultSpeed')).toBe(100);
  });

  it('syncToUI is a no-op when rootElement is null', () => {
    const mgr = new DisplaySettingsManager(makeSettingsManager(), null);
    expect(() => mgr.syncToUI()).not.toThrow();
  });

  it('syncFromUI reads speed slider when rootElement is supplied', () => {
    // Tiny stub: rootElement exposes querySelector that returns a value
    // for the speed slider only.
    const root = {
      querySelector: (sel) => sel === '#loop-ui-speed-slider' ? { value: '350' } : null,
    };
    const mgr = new DisplaySettingsManager(makeSettingsManager(), root);
    mgr.syncFromUI();
    expect(mgr.getSetting('defaultSpeed')).toBe(350);
  });

  it('syncFromUI falls back to 100 when slider value is unparseable', () => {
    const root = {
      querySelector: (sel) => sel === '#loop-ui-speed-slider' ? { value: 'abc' } : null,
    };
    const mgr = new DisplaySettingsManager(makeSettingsManager(), root);
    mgr.syncFromUI();
    expect(mgr.getSetting('defaultSpeed')).toBe(100);
  });
});
