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

  it('persist=true delegates persistence to settingsManager (no side-channel localStorage)', async () => {
    await mgr.setSetting('autoRestart', true);
    expect(sm.updateSetting).toHaveBeenCalledWith('moduleSettings.loops.autoRestart', true);
    // Phase B: the legacy archipelago_loop_settings side-channel is
    // gone. Persistence flows through settingsManager → mode-keyed
    // localStorage; this module no longer owns its own LS key.
    expect(localStorage.getItem('archipelago_loop_settings')).toBeNull();
  });

  it('persist=false skips settingsManager', async () => {
    await mgr.setSetting('instantMode', true, false);
    expect(sm.updateSetting).not.toHaveBeenCalled();
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

describe('DisplaySettingsManager — legacy localStorage cleanup (Phase B)', () => {
  beforeEach(() => {
    globalThis.localStorage = makeLocalStorageStub();
  });
  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('loadPersistedSettings reads only from settingsManager (legacy LS data is ignored)', async () => {
    // Pre-Phase-B, this module overlay-loaded from
    // archipelago_loop_settings on top of settingsManager values.
    // Now it loads only from settingsManager — the legacy data is
    // not consulted, and the key gets cleaned up as a side effect.
    localStorage.setItem('archipelago_loop_settings', JSON.stringify({
      defaultSpeed: 250,
      autoRestart: true,
    }));

    const sm = makeSettingsManager({
      'moduleSettings.loops.defaultSpeed': 100,  // settingsManager says 100
      'moduleSettings.loops.autoRestart': false, // settingsManager says false
    });
    const mgr = new DisplaySettingsManager(sm, null);
    await mgr.loadPersistedSettings();
    // settingsManager values win — legacy LS is ignored entirely.
    expect(mgr.getSetting('defaultSpeed')).toBe(100);
    expect(mgr.getSetting('autoRestart')).toBe(false);
  });

  it('loadPersistedSettings removes the legacy archipelago_loop_settings key', async () => {
    localStorage.setItem('archipelago_loop_settings', JSON.stringify({ defaultSpeed: 999 }));
    expect(localStorage.getItem('archipelago_loop_settings')).not.toBeNull();

    const mgr = new DisplaySettingsManager(makeSettingsManager(), null);
    await mgr.loadPersistedSettings();

    expect(localStorage.getItem('archipelago_loop_settings')).toBeNull();
  });

  it('loadPersistedSettings is a no-op cleanup when the legacy key was never written', async () => {
    const mgr = new DisplaySettingsManager(makeSettingsManager(), null);
    await expect(mgr.loadPersistedSettings()).resolves.toBeUndefined();
    expect(localStorage.getItem('archipelago_loop_settings')).toBeNull();
  });

  it('setSetting no longer writes to the legacy localStorage key', async () => {
    const mgr = new DisplaySettingsManager(makeSettingsManager(), null);
    await mgr.setSetting('autoRestart', true);
    expect(localStorage.getItem('archipelago_loop_settings')).toBeNull();
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
