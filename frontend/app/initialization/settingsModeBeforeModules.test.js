/**
 * settings-persistence S2, finding 1: settingsManager must know the active
 * mode BEFORE modules load and initialise, or a settings write made during
 * module init under ?mode=X is saved into the DEFAULT mode's blob.
 *
 * initializeApplication is the whole boot (DOM, Golden Layout, every module),
 * so this pins the ORDER in its source; the behaviour is measured in the
 * browser by the S2 probe (context D: a write fired as soon as the manager is
 * loaded, under ?mode=loops, lands in the loops blob). The second test is the
 * unit half: a manager told the mode first saves its first write there.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SettingsManager } from '../core/settingsManager.js';

const src = readFileSync(fileURLToPath(new URL('./index.js', import.meta.url)), 'utf8');
const at = (needle) => {
  const i = src.indexOf(needle);
  expect(i, `index.js no longer contains ${needle}`).toBeGreaterThan(-1);
  return i;
};

describe('the settings manager learns the mode before modules initialise', () => {
  it('phase 4 calls setCurrentMode(validatedMode) before setInitialSettings and before phase 5', () => {
    const setMode = at('settingsManager.setCurrentMode(validatedMode)');
    expect(setMode).toBeGreaterThan(at("profiler.start('phase4:settingsManager')"));
    expect(setMode).toBeLessThan(at('settingsManager.setInitialSettings(combinedModeData.userSettings)'));
    expect(setMode).toBeLessThan(at("profiler.start('phase5:loadModules')"));
    expect(setMode).toBeLessThan(at("profiler.start('phase9:initializeModules')"));
  });

  describe('a manager told the mode first', () => {
    afterEach(() => { delete globalThis.localStorage; });
    it('saves its first write to that mode, not to default', async () => {
      const store = {};
      globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
      const sm = new SettingsManager();
      sm.setCurrentMode('loops');
      sm.setInitialSettings({ generalSettings: {} });
      await sm.updateSetting('generalSettings.probe', 'init-write');
      sm.flushPendingSave();
      expect(Object.keys(store)).toEqual(['archipelagoToolSuite_modeData_loops']);
    });
  });
});
