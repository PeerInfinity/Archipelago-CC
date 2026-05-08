/**
 * displaySettingsBase.js — base class for module-scoped display
 * settings managers.
 *
 * Background: panels (loops, regions, ...) each maintain a local
 * cache of display settings (toggles, sliders, dropdowns) backed by
 * settingsManager. Pre-Phase-C this was duplicated across two
 * 200-300 line files with the same shape:
 *
 *   - settings cache
 *   - loadPersistedSettings (pull each key from settingsManager)
 *   - setSetting (write through to settingsManager with rollback)
 *   - getSettingsKey (map internal key → settingsManager dotted path)
 *   - handleSettingsChanged (route external changes back into the cache)
 *
 * The subclass-specific bits are just (a) the defaults table and
 * (b) the syncFromUI / syncToUI bindings to module-specific DOM IDs.
 *
 * Subclass contract:
 *
 *   class LoopsDisplaySettings extends DisplaySettingsBase {
 *     constructor(settingsManager, rootElement) {
 *       super({ moduleId: 'loops', settingsManager, rootElement,
 *               defaults: { autoRestart: false, ... } });
 *     }
 *     syncFromUI() { ... }   // required (read DOM → cache)
 *     syncToUI()   { ... }   // required (cache → DOM)
 *   }
 *
 * Special-path settings (e.g. regions' `useSubstitutedNames` lives at
 * `generalSettings.useSubstitutedNames`, not `moduleSettings.regions.*`)
 * are handled by overriding getSettingsKey:
 *
 *     getSettingsKey(key) {
 *       if (key === 'useSubstitutedNames') return 'generalSettings.useSubstitutedNames';
 *       return super.getSettingsKey(key);
 *     }
 */
import { createUniversalLogger } from '../../app/core/universalLogger.js';

export class DisplaySettingsBase {
  /**
   * @param {Object} args
   * @param {string} args.moduleId - e.g. 'loops', 'regions'. Used for
   *   the default key prefix and the logger tag.
   * @param {Object} args.settingsManager - The global settingsManager
   *   instance (or a stub with getSetting/updateSetting).
   * @param {Object<string, *>} args.defaults - Cache shape +
   *   defaults. Each key is loaded via getSetting on init and written
   *   via updateSetting on setSetting.
   * @param {Element|null} args.rootElement - Panel root for DOM
   *   queries in subclass syncFromUI/syncToUI.
   */
  constructor({ moduleId, settingsManager, defaults, rootElement }) {
    if (!moduleId) throw new Error('DisplaySettingsBase requires moduleId');
    this.moduleId = moduleId;
    this.settingsManager = settingsManager;
    this.rootElement = rootElement;
    this.logger = createUniversalLogger(`${moduleId}UI:DisplaySettings`);

    // Settings cache. Deep-copy the defaults so subclass instances
    // don't share mutable state via the prototype.
    this.settings = JSON.parse(JSON.stringify(defaults || {}));
    // Remember the keys we own — load/handleSettingsChanged iterate this.
    this._cacheKeys = Object.keys(this.settings);

    this.logger.debug(`${this.constructor.name} constructed`);
  }

  /**
   * Map an internal cache key to the settingsManager dotted path.
   * Override for special cases. Default mapping:
   *   colorblindMode → colorblindMode.<moduleId>
   *   anything else → moduleSettings.<moduleId>.<key>
   */
  getSettingsKey(key) {
    if (key === 'colorblindMode') return `colorblindMode.${this.moduleId}`;
    return `moduleSettings.${this.moduleId}.${key}`;
  }

  /**
   * Initialize: load persisted values, then sync them to the UI.
   * NEVER calls syncFromUI here — it would overwrite persisted
   * values with checkbox defaults (`.checked` is always boolean).
   */
  async initialize() {
    this.logger.info('Initializing display settings...');
    await this.loadPersistedSettings();
    this.syncToUI();
    this.logger.info('Display settings initialized', this.settings);
  }

  /**
   * Pull every cache key's value from settingsManager. Each call
   * uses the current cached value as the fallback so the defaults
   * table also serves as the fallback table.
   */
  async loadPersistedSettings() {
    try {
      for (const key of this._cacheKeys) {
        const path = this.getSettingsKey(key);
        const fallback = this.settings[key];
        this.settings[key] = await this.settingsManager.getSetting(path, fallback);
      }
      this.logger.debug('Persisted settings loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load persisted settings:', error);
    }
  }

  /**
   * Get a cached setting value.
   */
  getSetting(key) {
    return this.settings[key];
  }

  /**
   * Update a setting's cached value, optionally writing through to
   * settingsManager. Rolls the cache back if the persistence write
   * rejects.
   */
  async setSetting(key, value, persist = true) {
    const oldValue = this.settings[key];
    this.settings[key] = value;
    this.logger.debug(`Setting changed: ${key} = ${value} (persist: ${persist})`);

    if (persist) {
      try {
        const path = this.getSettingsKey(key);
        await this.settingsManager.updateSetting(path, value);
        this.logger.debug(`Persisted setting: ${path} = ${value}`);
      } catch (error) {
        this.logger.error(`Failed to persist setting ${key}:`, error);
        this.settings[key] = oldValue;
      }
    }
  }

  /**
   * React to an external `settings:changed` event. Returns true if
   * the event was relevant to this module. On a wildcard or
   * relevant per-key change, reloads everything and re-syncs the UI
   * (background; the call returns synchronously).
   */
  /**
   * React to an external `settings:changed` event. Returns a Promise
   * that resolves to true if the event was relevant, false otherwise.
   * Async so the wildcard branch (which re-fetches every setting)
   * can be awaited by callers that need the cache up-to-date before
   * triggering re-renders.
   */
  async handleSettingsChanged(event) {
    const { key, value } = event;

    if (key === '*') {
      // Wildcard: every setting may have changed. Re-fetch all and
      // re-sync the UI before returning so awaiting callers see a
      // fully-updated cache.
      this.logger.info('Wildcard settings change — reloading');
      await this.loadPersistedSettings();
      this.syncToUI();
      return true;
    }

    // Per-key: if this event's path matches one of our cache keys,
    // write the new value into the cache directly and sync the UI
    // synchronously. Avoids a full re-fetch when we already know
    // the new value.
    for (const cacheKey of this._cacheKeys) {
      if (this.getSettingsKey(cacheKey) === key) {
        this.logger.info(`External setting changed: ${key}`);
        this.settings[cacheKey] = value;
        this.syncToUI();
        return true;
      }
    }
    return false;
  }

  /** Subclass MUST implement: read DOM into this.settings. */
  syncFromUI() {
    throw new Error(`${this.constructor.name} must implement syncFromUI()`);
  }

  /** Subclass MUST implement: write this.settings to the DOM. */
  syncToUI() {
    throw new Error(`${this.constructor.name} must implement syncToUI()`);
  }
}

export default DisplaySettingsBase;
