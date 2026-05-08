import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DisplaySettingsBase } from './displaySettingsBase.js';

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

// Concrete subclass for tests — provides the abstract methods so the
// base can be exercised end-to-end. Records DOM-sync calls.
class TestSubclass extends DisplaySettingsBase {
  constructor(args) {
    super(args);
    this.syncToUICalls = 0;
    this.syncFromUICalls = 0;
  }
  syncToUI() { this.syncToUICalls++; }
  syncFromUI() { this.syncFromUICalls++; }
}

describe('DisplaySettingsBase — construction', () => {
  it('throws when moduleId is missing', () => {
    expect(() => new TestSubclass({
      settingsManager: makeSettingsManager(),
      defaults: {},
      rootElement: null,
    })).toThrow(/moduleId/);
  });

  it('deep-copies the defaults object (no shared mutable state)', () => {
    const defaults = { nested: { value: 1 } };
    const a = new TestSubclass({ moduleId: 'a', settingsManager: makeSettingsManager(), defaults, rootElement: null });
    const b = new TestSubclass({ moduleId: 'b', settingsManager: makeSettingsManager(), defaults, rootElement: null });
    a.settings.nested.value = 99;
    expect(b.settings.nested.value).toBe(1);
  });

  it('exposes settings via the settings field', () => {
    const sub = new TestSubclass({
      moduleId: 'loops',
      settingsManager: makeSettingsManager(),
      defaults: { speed: 100, autoRestart: false },
      rootElement: null,
    });
    expect(sub.settings).toEqual({ speed: 100, autoRestart: false });
  });
});

describe('DisplaySettingsBase — getSettingsKey', () => {
  let sub;
  beforeEach(() => {
    sub = new TestSubclass({
      moduleId: 'loops',
      settingsManager: makeSettingsManager(),
      defaults: { autoRestart: false, colorblindMode: false },
      rootElement: null,
    });
  });

  it("maps 'colorblindMode' to colorblindMode.<moduleId>", () => {
    expect(sub.getSettingsKey('colorblindMode')).toBe('colorblindMode.loops');
  });

  it('maps any other key to moduleSettings.<moduleId>.<key>', () => {
    expect(sub.getSettingsKey('autoRestart')).toBe('moduleSettings.loops.autoRestart');
    expect(sub.getSettingsKey('whatever')).toBe('moduleSettings.loops.whatever');
  });

  it('respects subclass overrides for special-path keys', () => {
    class WithOverride extends TestSubclass {
      getSettingsKey(key) {
        if (key === 'special') return 'generalSettings.special';
        return super.getSettingsKey(key);
      }
    }
    const w = new WithOverride({
      moduleId: 'regions',
      settingsManager: makeSettingsManager(),
      defaults: { special: false, normal: false },
      rootElement: null,
    });
    expect(w.getSettingsKey('special')).toBe('generalSettings.special');
    expect(w.getSettingsKey('normal')).toBe('moduleSettings.regions.normal');
  });
});

describe('DisplaySettingsBase — loadPersistedSettings', () => {
  it('reads each cache key from settingsManager via getSettingsKey', async () => {
    const sm = makeSettingsManager({
      'moduleSettings.loops.autoRestart': true,
      'moduleSettings.loops.defaultSpeed': 250,
      'colorblindMode.loops': true,
    });
    const sub = new TestSubclass({
      moduleId: 'loops',
      settingsManager: sm,
      defaults: { autoRestart: false, defaultSpeed: 100, colorblindMode: false },
      rootElement: null,
    });
    await sub.loadPersistedSettings();
    expect(sub.settings).toEqual({ autoRestart: true, defaultSpeed: 250, colorblindMode: true });
  });

  it('uses the cached default as the fallback when settingsManager has no value', async () => {
    const sm = makeSettingsManager(); // empty
    const sub = new TestSubclass({
      moduleId: 'loops',
      settingsManager: sm,
      defaults: { autoRestart: false, defaultSpeed: 100 },
      rootElement: null,
    });
    await sub.loadPersistedSettings();
    expect(sub.settings).toEqual({ autoRestart: false, defaultSpeed: 100 });
  });

  it('catches errors and continues (logs but does not throw)', async () => {
    const sm = {
      getSetting: vi.fn(async () => { throw new Error('boom'); }),
      updateSetting: vi.fn(),
    };
    const sub = new TestSubclass({
      moduleId: 'loops',
      settingsManager: sm,
      defaults: { autoRestart: false },
      rootElement: null,
    });
    await expect(sub.loadPersistedSettings()).resolves.toBeUndefined();
  });
});

describe('DisplaySettingsBase — getSetting / setSetting', () => {
  let sub, sm;
  beforeEach(() => {
    sm = makeSettingsManager();
    sub = new TestSubclass({
      moduleId: 'loops',
      settingsManager: sm,
      defaults: { autoRestart: false },
      rootElement: null,
    });
  });

  it('getSetting returns the cached value', () => {
    expect(sub.getSetting('autoRestart')).toBe(false);
  });

  it('setSetting updates the cache and persists via settingsManager.updateSetting', async () => {
    await sub.setSetting('autoRestart', true);
    expect(sub.getSetting('autoRestart')).toBe(true);
    expect(sm.updateSetting).toHaveBeenCalledWith('moduleSettings.loops.autoRestart', true);
  });

  it('setSetting with persist=false skips settingsManager', async () => {
    await sub.setSetting('autoRestart', true, false);
    expect(sub.getSetting('autoRestart')).toBe(true);
    expect(sm.updateSetting).not.toHaveBeenCalled();
  });

  it('rolls the cache back when settingsManager.updateSetting rejects', async () => {
    sm.updateSetting.mockRejectedValueOnce(new Error('disk full'));
    await sub.setSetting('autoRestart', true);
    expect(sub.getSetting('autoRestart')).toBe(false);
  });

  it('uses the override path for special-key settings', async () => {
    class WithOverride extends TestSubclass {
      getSettingsKey(key) {
        if (key === 'special') return 'generalSettings.special';
        return super.getSettingsKey(key);
      }
    }
    const w = new WithOverride({
      moduleId: 'regions',
      settingsManager: sm,
      defaults: { special: false },
      rootElement: null,
    });
    await w.setSetting('special', true);
    expect(sm.updateSetting).toHaveBeenCalledWith('generalSettings.special', true);
  });
});

describe('DisplaySettingsBase — handleSettingsChanged', () => {
  let sub, sm;
  beforeEach(() => {
    sm = makeSettingsManager({
      'moduleSettings.loops.autoRestart': true,
    });
    sub = new TestSubclass({
      moduleId: 'loops',
      settingsManager: sm,
      defaults: { autoRestart: false, colorblindMode: false },
      rootElement: null,
    });
  });

  it("returns true and awaits the reload on '*' wildcard", async () => {
    await expect(sub.handleSettingsChanged({ key: '*' })).resolves.toBe(true);
    expect(sub.getSetting('autoRestart')).toBe(true);
    expect(sub.syncToUICalls).toBeGreaterThanOrEqual(1);
  });

  it('returns true for a per-key change AND writes the new value synchronously', async () => {
    await expect(sub.handleSettingsChanged({ key: 'moduleSettings.loops.autoRestart', value: true })).resolves.toBe(true);
    expect(sub.getSetting('autoRestart')).toBe(true);
    expect(sub.syncToUICalls).toBe(1);
  });

  it('returns true for the colorblindMode special path AND writes the value', async () => {
    await expect(sub.handleSettingsChanged({ key: 'colorblindMode.loops', value: true })).resolves.toBe(true);
    expect(sub.getSetting('colorblindMode')).toBe(true);
  });

  it('returns false for unrelated keys (does NOT reload)', async () => {
    await expect(sub.handleSettingsChanged({ key: 'moduleSettings.regions.showAll', value: true })).resolves.toBe(false);
    await expect(sub.handleSettingsChanged({ key: 'colorblindMode.regions', value: true })).resolves.toBe(false);
    await expect(sub.handleSettingsChanged({ key: 'someUnrelatedKey', value: 1 })).resolves.toBe(false);
    expect(sub.syncToUICalls).toBe(0);
  });

  it('respects subclass-overridden paths when matching', async () => {
    class WithOverride extends TestSubclass {
      getSettingsKey(key) {
        if (key === 'useSubstitutedNames') return 'generalSettings.useSubstitutedNames';
        return super.getSettingsKey(key);
      }
    }
    const w = new WithOverride({
      moduleId: 'regions',
      settingsManager: sm,
      defaults: { useSubstitutedNames: true },
      rootElement: null,
    });
    await expect(w.handleSettingsChanged({ key: 'generalSettings.useSubstitutedNames', value: false })).resolves.toBe(true);
  });
});

describe('DisplaySettingsBase — initialize', () => {
  it('loads persisted settings AND calls syncToUI (NOT syncFromUI)', async () => {
    const sm = makeSettingsManager({ 'moduleSettings.loops.autoRestart': true });
    const sub = new TestSubclass({
      moduleId: 'loops',
      settingsManager: sm,
      defaults: { autoRestart: false },
      rootElement: null,
    });
    await sub.initialize();
    expect(sub.getSetting('autoRestart')).toBe(true);
    expect(sub.syncToUICalls).toBe(1);
    expect(sub.syncFromUICalls).toBe(0);
  });
});

describe('DisplaySettingsBase — abstract method guards', () => {
  it('throws if syncToUI is not overridden', () => {
    const sub = new DisplaySettingsBase({
      moduleId: 'x',
      settingsManager: makeSettingsManager(),
      defaults: {},
      rootElement: null,
    });
    expect(() => sub.syncToUI()).toThrow(/syncToUI/);
    expect(() => sub.syncFromUI()).toThrow(/syncFromUI/);
  });
});
