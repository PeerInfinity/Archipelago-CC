/**
 * The mode-persistence defaults have ONE source (settings-persistence S2).
 * The boot readers run before settingsManager and never consult the schema;
 * when settings.json stopped carrying `autoLoadMode` (2026-06-13) they fell
 * back to their own literal while the schema said otherwise. These tests pin
 * that the schema, both boot readers and the fallback all agree, and that a
 * stored OFF wins over the default.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AUTO_LOAD_MODE_DEFAULT, AUTO_SAVE_MODE_DEFAULT } from './modePersistenceDefaults.js';
import { getAutoModeSettings, determineActiveMode } from './modeManager.js';
import { shouldLoadFromLocalStorage, reflectAutoLoadOff } from './modeDataLoader.js';
import { CORE_SETTINGS_SCHEMAS } from '../core/coreSettingsSchemas.js';

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}
const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
const BLOB = (gs) => JSON.stringify({ modeName: 'default', userSettings: { generalSettings: gs } });
// settings.json ships `generalSettings: {}` — the shape that exposed the drift.
const SHIPPED = { generalSettings: {} };
const fetchJson = vi.fn(async () => SHIPPED);

describe('mode-persistence defaults — one source', () => {
  beforeEach(() => {
    globalThis.localStorage = makeStorage();
    globalThis.sessionStorage = makeStorage();
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => SHIPPED }));
    globalThis.window = { location: { search: '' } };
  });
  afterEach(() => {
    delete globalThis.localStorage;
    delete globalThis.sessionStorage;
    delete globalThis.fetch;
    delete globalThis.window;
  });

  it('auto-load is ON by default and auto-save OFF', () => {
    expect(AUTO_LOAD_MODE_DEFAULT).toBe(true);
    expect(AUTO_SAVE_MODE_DEFAULT).toBe(false);
  });

  it('the schema declares the shared defaults', () => {
    const gs = CORE_SETTINGS_SCHEMAS.generalSettings.properties;
    expect(gs.autoLoadMode.default).toBe(AUTO_LOAD_MODE_DEFAULT);
    expect(gs.autoSaveMode.default).toBe(AUTO_SAVE_MODE_DEFAULT);
  });

  it('both boot readers return the shared default when no blob and no settings.json key exist', async () => {
    expect(await getAutoModeSettings(logger)).toEqual({
      autoLoadMode: AUTO_LOAD_MODE_DEFAULT, autoSaveMode: AUTO_SAVE_MODE_DEFAULT,
    });
    expect(await shouldLoadFromLocalStorage(fetchJson, logger)).toBe(AUTO_LOAD_MODE_DEFAULT);
  });

  it('both boot readers return the shared default for a blob whose generalSettings lacks the key', async () => {
    localStorage.setItem('archipelagoToolSuite_modeData_default', BLOB({ theme: 'dark' }));
    expect((await getAutoModeSettings(logger)).autoLoadMode).toBe(AUTO_LOAD_MODE_DEFAULT);
    expect(await shouldLoadFromLocalStorage(fetchJson, logger)).toBe(AUTO_LOAD_MODE_DEFAULT);
  });

  it('a stored OFF (the Options toggle) wins in both readers', async () => {
    localStorage.setItem('archipelagoToolSuite_modeData_default', BLOB({ autoLoadMode: false }));
    expect((await getAutoModeSettings(logger)).autoLoadMode).toBe(false);
    expect(await shouldLoadFromLocalStorage(fetchJson, logger)).toBe(false);
  });

  it('with the default, a plain URL resumes the last active mode; with a stored OFF it does not', async () => {
    localStorage.setItem('archipelagoToolSuite_lastActiveMode', 'loops');
    expect((await determineActiveMode(logger)).currentActiveMode).toBe('loops');
    localStorage.setItem('archipelagoToolSuite_modeData_loops', BLOB({ autoLoadMode: false }));
    expect((await determineActiveMode(logger)).currentActiveMode).toBe('default');
  });

  it('an OFF session shows the switch as OFF (the page holds settings.json, which lacks it)', () => {
    const fromFiles = { userSettings: { generalSettings: {} } };
    reflectAutoLoadOff(fromFiles, { autoLoadModeEnabled: false, skipLocalStorageLoad: false });
    expect(fromFiles.userSettings.generalSettings.autoLoadMode).toBe(false);
    // ON, a reset (?reset=true skips the blob but auto-load is not OFF), or an
    // explicit file value: untouched.
    for (const decision of [
      { autoLoadModeEnabled: true, skipLocalStorageLoad: false },
      { autoLoadModeEnabled: false, skipLocalStorageLoad: true },
    ]) {
      const d = { userSettings: { generalSettings: {} } };
      reflectAutoLoadOff(d, decision);
      expect(d.userSettings.generalSettings.autoLoadMode).toBeUndefined();
    }
    const explicit = { userSettings: { generalSettings: { autoLoadMode: true } } };
    reflectAutoLoadOff(explicit, { autoLoadModeEnabled: false, skipLocalStorageLoad: false });
    expect(explicit.userSettings.generalSettings.autoLoadMode).toBe(true);
  });
});
