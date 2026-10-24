/**
 * The Path Analyzer's settings round trip (settings-persistence S2, task 5).
 * "Save as Defaults" called settingsManager.updateModuleSettings — a method
 * that does not exist — inside a try/catch, so it threw, logged, and the
 * button said "Saved!" anyway; and the saved settings were read without
 * `await`, so a Promise's `.maxPaths` (undefined) always fell back to the
 * built-in defaults. No regression row presses the button.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../stateManager/index.js', () => ({ stateManagerProxySingleton: {} }));
vi.mock('../shared/ruleEngine.js', () => ({ evaluateRule: () => true }));
vi.mock('../commonUI/index.js', () => ({ default: {} }));
vi.mock('../loops/loopStateSingleton.js', () => ({ default: {} }));
vi.mock('../shared/snapshotInterface.js', () => ({ createSnapshotInterface: () => ({}) }));
vi.mock('./index.js', () => ({ getModuleEventBus: () => ({ subscribe: () => () => {} }) }));

const { PathAnalyzerUI } = await import('./pathAnalyzerUI.js');
const { default: settingsManager } = await import('../../app/core/settingsManager.js');

describe('PathAnalyzerUI — saved settings', () => {
  beforeEach(() => {
    const store = {};
    globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
    settingsManager.setInitialSettings({ moduleSettings: {} });
  });
  afterEach(() => { delete globalThis.localStorage; });

  it('starts from the built-in defaults when nothing is saved', async () => {
    const ui = new PathAnalyzerUI(null);
    await ui.savedSettingsLoaded;
    expect(ui.getSettings()).toEqual({ maxPaths: 100, maxAnalysisTimeMs: 10000 });
  });

  it('"Save as Defaults" stores each key as a module setting, and a new instance reads them back', async () => {
    const ui = new PathAnalyzerUI(null);
    await ui.savedSettingsLoaded;
    ui.updateSettings({ maxPaths: 42, maxAnalysisTimeMs: 5000 });
    expect(await ui.saveSettingsAsDefaults()).toBe(true);
    expect(await settingsManager.getSetting('moduleSettings.pathAnalyzer.maxPaths')).toBe(42);
    expect(await settingsManager.getSetting('moduleSettings.pathAnalyzer.maxAnalysisTimeMs')).toBe(5000);

    const next = new PathAnalyzerUI(null);
    await next.savedSettingsLoaded;
    expect(next.getSettings()).toEqual({ maxPaths: 42, maxAnalysisTimeMs: 5000 });
  });

  it('explicit constructor settings are not replaced by the saved ones', async () => {
    await settingsManager.updateModuleSetting('pathAnalyzer', 'maxPaths', 7);
    const ui = new PathAnalyzerUI(null, { maxPaths: 3, maxAnalysisTimeMs: 1000 });
    await ui.savedSettingsLoaded;
    expect(ui.getSettings().maxPaths).toBe(3);
  });

  it('a failing save reports false instead of claiming success', async () => {
    const ui = new PathAnalyzerUI(null);
    await ui.savedSettingsLoaded;
    const spy = vi.spyOn(settingsManager, 'updateModuleSetting').mockRejectedValueOnce(new Error('boom'));
    expect(await ui.saveSettingsAsDefaults()).toBe(false);
    spy.mockRestore();
  });
});
