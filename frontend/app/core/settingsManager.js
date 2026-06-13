import eventBus from './eventBus.js';
import { centralRegistry } from './centralRegistry.js';
import { deepMerge } from '../../utils/settingsMerger.js';


// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('settingsManager', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[settingsManager] ${message}`, ...data);
  }
}

// Mode-keyed localStorage shape (matches modeDataLoader's load path).
// One blob per mode, keyed `<prefix><modeName>`. The blob carries
// userSettings alongside other mode-scoped fields (rulesConfig,
// moduleConfig, layoutConfig, ...) written by the JSON panel's
// "Save to LocalStorage" flow. Our auto-save preserves those other
// fields by reading the existing blob and only replacing userSettings.
const LOCAL_STORAGE_MODE_PREFIX = 'archipelagoToolSuite_modeData_';

// Debounce window for auto-save: a flurry of updateSetting calls
// (e.g. dragging a slider, bulk JSON apply firing many writes)
// coalesces into one localStorage write. Trailing-edge: write fires
// once SAVE_DEBOUNCE_MS after the last call.
const SAVE_DEBOUNCE_MS = 100;

export class SettingsManager {
  constructor() {
    this.settings = null;
    this._defaultSettings = null; // Stores the initial/default settings for merge base
    this.isLoading = true; // Will be set to false once settings are loaded or provided
    this.loadPromise = null; // Initialize to null, created by ensureLoaded if needed

    // Mode-keyed persistence: writes go to localStorage[<prefix><currentMode>].
    // Defaults to 'default' until app:activeModeDetermined fires (which
    // happens during app initialization, before any UI can drive a save).
    this._currentMode = 'default';
    this._saveTimeoutId = null;

    // Session-only overrides. Keyed by full dotted path (same shape
    // as updateSetting's key). Reads via getSetting fall back to
    // this.settings; only persisted writes touch localStorage. Used
    // by callers that want to override a setting for the duration of
    // the session WITHOUT clobbering the user's saved value (e.g.
    // loops mode auto-enabling discovery while loops is active).
    this._overrides = new Map();

    // Subscribe to the mode-determination event so we save under the
    // right slot. Guard for the test environment where eventBus may
    // be a stub.
    if (eventBus && typeof eventBus.subscribe === 'function') {
      try {
        eventBus.subscribe('app:activeModeDetermined', (data) => {
          if (data && typeof data.activeMode === 'string' && data.activeMode.length > 0) {
            this._currentMode = data.activeMode;
          }
        }, 'core');
      } catch (e) {
        // EventBus.subscribe enforces a moduleName parameter; if the
        // signature ever changes or we're in a test stub, fall back
        // to direct setCurrentMode calls.
        log('warn', 'Could not subscribe to app:activeModeDetermined:', e?.message);
      }
    }
  }

  /**
   * Override the active mode used for saving. Called automatically
   * from the app:activeModeDetermined subscription; exposed for tests
   * and for any future runtime mode-switch flow.
   */
  setCurrentMode(modeName) {
    if (typeof modeName === 'string' && modeName.length > 0) {
      this._currentMode = modeName;
    }
  }

  /**
   * The localStorage key currently used for persistence. Useful for
   * test assertions and for any future migration / debug tooling.
   */
  getStorageKey() {
    return `${LOCAL_STORAGE_MODE_PREFIX}${this._currentMode}`;
  }

  setInitialSettings(initialSettings) {
    if (initialSettings && typeof initialSettings === 'object') {
      log('info',
        '[SettingsManager] Setting initial settings directly:',
        initialSettings
      );
      this.settings = JSON.parse(JSON.stringify(initialSettings)); // Deep copy
      this.isLoading = false;
      // If there was a loadPromise, it's now irrelevant or should be handled.
      // For simplicity, ensureLoaded will check isLoading and this.settings.
      eventBus.publish('settings:loaded', this.settings, 'core');

      // Lazy-load disk defaults in the background so resetToDefaults
      // resets to the SHIPPED defaults, not to "whatever was loaded
      // at session start" (which would include user/mode overlays).
      // Fire-and-forget; resetToDefaults awaits the same promise if
      // it hasn't resolved yet.
      this._ensureDefaultsLoaded();
    } else {
      log('warn',
        '[SettingsManager] setInitialSettings called with invalid settings object.',
        initialSettings
      );
      // Do not set isLoading to false, allow normal loading to proceed if ensureLoaded is called.
    }
  }

  /**
   * Fetch settings.json once and cache as `this._defaultSettings`.
   * Used as the reset-to-defaults baseline. Decoupled from
   * setInitialSettings so that user/mode overlays loaded at init
   * don't masquerade as defaults.
   *
   * If the fetch fails (e.g. test env, offline), falls back to a
   * snapshot of the current settings — matches the prior behavior
   * where _defaultSettings was just whatever setInitialSettings
   * received. Existing tests that don't stub fetch keep passing.
   * @private
   */
  async _ensureDefaultsLoaded() {
    if (this._defaultSettings) return;
    if (this._defaultsPromise) return this._defaultsPromise;
    this._defaultsPromise = (async () => {
      try {
        if (typeof fetch !== 'function') throw new Error('fetch unavailable');
        const response = await fetch('./settings/settings.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        this._defaultSettings = JSON.parse(JSON.stringify(json));
        log('info', 'Disk defaults loaded for resetToDefaults');
      } catch (e) {
        log('warn', 'Could not load disk defaults; resetToDefaults will fall back to session-start state:', e?.message);
        // Fallback: snapshot whatever we have right now. Preserves
        // the pre-fix behavior so tests + offline use don't regress.
        if (this.settings) {
          this._defaultSettings = JSON.parse(JSON.stringify(this.settings));
        }
      }
    })();
    return this._defaultsPromise;
  }

  async _loadSettingsFromServer() {
    try {
      const response = await fetch('./settings/settings.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      this.settings = await response.json();
      this._defaultSettings = JSON.parse(JSON.stringify(this.settings)); // Store defaults for merging
      log('info',
        'Settings loaded successfully from ./settings/settings.json:',
        this.settings
      );
      // Add validation against schema maybe?
    } catch (error) {
      log('error',
        'Error loading settings from ./settings/settings.json:',
        error
      );
      // Fallback to some default or handle error state
      this.settings = this._getDefaultFallbackSettings(); // Use a fallback
      log('warn', 'Using default fallback settings.');
    } finally {
      this.isLoading = false;
      eventBus.publish('settings:loaded', this.settings, 'core'); // Notify when loaded/failed
    }
    return this.settings; // Return settings for chaining/awaiting
  }

  // Provides a basic structure if loading fails
  _getDefaultFallbackSettings() {
    return {
      activeGame: null,
      activeLayout: 'default',
      customLayoutConfig: null,
      generalSettings: { theme: 'dark' },
      moduleSettings: {},
    };
  }

  // Method to ensure settings are loaded before accessing them
  async ensureLoaded() {
    if (this.isLoading && !this.settings) {
      // Only load from server if still loading AND no initial settings were provided
      if (!this.loadPromise) {
        // Create load promise only if needed
        this.loadPromise = this._loadSettingsFromServer();
      }
      await this.loadPromise;
    } else if (this.isLoading && this.settings) {
      // This case means setInitialSettings was called, but isLoading wasn't set to false properly, or an edge case.
      // For safety, mark as not loading if settings are present.
      this.isLoading = false;
      log('info', 
        '[SettingsManager] ensureLoaded: Settings already provided, marking as not loading.'
      );
    }
    // If !this.isLoading, settings are already loaded (either via setInitialSettings or previous _loadSettingsFromServer)
    return this.settings;
  }

  /**
   * Schedule a debounced write of `this.settings` to the current mode's
   * localStorage blob. Multiple calls within SAVE_DEBOUNCE_MS coalesce
   * into one write. Called from updateSetting / updateSettings /
   * resetToDefaults; callers don't need to await — the in-memory
   * cache and `settings:changed` events are already synchronous, the
   * persistence is fire-and-forget.
   *
   * Returns the (resolved) Promise that callers awaited under the old
   * stub API, for backwards compatibility.
   */
  async saveSettings() {
    if (this.isLoading) {
      log('warn', 'Settings not loaded yet, cannot save.');
      return;
    }
    if (this._saveTimeoutId !== null) {
      clearTimeout(this._saveTimeoutId);
    }
    this._saveTimeoutId = setTimeout(() => {
      this._saveTimeoutId = null;
      this._doSaveSettings();
    }, SAVE_DEBOUNCE_MS);
  }

  /**
   * Cancel any pending debounced save and run it immediately. For
   * tests and any future "save before page unload" path.
   */
  flushPendingSave() {
    if (this._saveTimeoutId !== null) {
      clearTimeout(this._saveTimeoutId);
      this._saveTimeoutId = null;
      this._doSaveSettings();
    }
  }

  /**
   * Synchronous core of the save. Reads the current mode's existing
   * blob (so we preserve sibling fields like rulesConfig / layoutConfig
   * written by the JSON panel), replaces the userSettings field, and
   * writes back. Updates lastActiveMode to match what JsonUI's manual
   * save does.
   * @private
   */
  _doSaveSettings() {
    if (typeof localStorage === 'undefined') return;
    if (!this.settings) return;

    const key = this.getStorageKey();
    let existing = {};
    try {
      const raw = localStorage.getItem(key);
      if (raw) existing = JSON.parse(raw);
    } catch (e) {
      log('warn', `Could not parse existing mode blob at ${key}, starting fresh:`, e);
      existing = {};
    }

    const blob = {
      ...existing,
      modeName: this._currentMode,
      savedTimestamp: new Date().toISOString(),
      // Deep copy so subsequent in-memory mutations don't bleed into
      // the just-written blob (existing settings:changed semantics
      // don't promise a fresh-snapshot otherwise).
      userSettings: JSON.parse(JSON.stringify(this.settings)),
    };

    try {
      localStorage.setItem(key, JSON.stringify(blob));
      log('info', `Settings persisted to mode '${this._currentMode}'`);
    } catch (e) {
      log('error', 'Error saving settings to localStorage:', e);
    }
  }

  /**
   * Gets the entire settings object. Ensures settings are loaded first.
   * @returns {Promise<object>} A promise resolving to the current settings object.
   */
  async getSettings() {
    await this.ensureLoaded();
    log('info', 
      '[SettingsManager getSettings] this.settings BEFORE stringify/parse:',
      this.settings
        ? JSON.parse(JSON.stringify(this.settings))
        : 'null or undefined'
    );
    // Return a deep copy to prevent accidental mutation
    return JSON.parse(JSON.stringify(this.settings));
  }

  /**
   * Gets a specific setting value using a dot-notation key. Ensures settings are loaded first.
   * Session overrides (set via updateSetting with persist:false) take
   * precedence over the persisted base.
   * Resolution precedence:
   *   session override  >  persisted value  >  SCHEMA default  >  call-site default
   *
   * The schema default (for `moduleSettings.<mod>.<prop>` keys) is read
   * from the registered schema via centralRegistry, so defaults need only
   * be declared once (in the schema) rather than duplicated across the
   * schema, settings.json, and the call-site fallback. The call-site
   * `defaultValue` remains the final fallback for keys with no schema
   * default (top-level settings, stubbed settingsManager, etc.).
   *
   * @param {string} key - The setting key (e.g., 'generalSettings.theme' or 'moduleSettings.client.defaultServer')
   * @param {*} defaultValue - Value to return if key not found.
   * @returns {Promise<*>} A promise resolving to the setting value or defaultValue.
   */
  async getSetting(key, defaultValue = undefined) {
    await this.ensureLoaded();
    if (this._overrides.has(key)) return this._overrides.get(key);
    const keys = key.split('.');
    let current = this.settings;
    let foundInSettings = true;
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        foundInSettings = false;
        break;
      }
    }
    if (foundInSettings) return current;

    // Not persisted — consult the registered schema default before the
    // call-site fallback. Non-moduleSettings keys (and keys with no schema
    // default) return found:false and fall through to defaultValue.
    const schemaDefault = centralRegistry.getSchemaDefault(key);
    if (schemaDefault.found) return schemaDefault.value;

    return defaultValue;
  }

  /**
   * Updates a specific setting value using a dot-notation key.
   * Publishes a 'settings:changed' event and (when persisting)
   * triggers saveSettings. Ensures settings are loaded first.
   *
   * @param {string} key - The setting key (e.g., 'generalSettings.theme')
   * @param {*} value - The new value.
   * @param {Object} [options]
   * @param {boolean} [options.persist=true] - When false, the value
   *   is stored as a session-only override (does NOT touch
   *   localStorage). The override takes precedence over the
   *   persisted base for subsequent getSetting calls. Use this for
   *   transient overrides (e.g. "while loop mode is on, force
   *   discovery on") that shouldn't survive a reload. A subsequent
   *   persistent write to the same key clears the override —
   *   user-explicit writes always win.
   * @returns {Promise<boolean>} A promise resolving to true if the setting was updated, false otherwise.
   */
  async updateSetting(key, value, options = {}) {
    const { persist = true } = options;
    await this.ensureLoaded();

    if (!persist) {
      // Session-only override path. Doesn't touch this.settings or
      // localStorage. Reads via getSetting see this value first.
      if (this._overrides.get(key) === value) return false;
      this._overrides.set(key, value);
      log('info', `Setting overridden (session): ${key} =`, value);
      eventBus.publish('settings:changed', {
        key,
        value,
        settings: await this.getEffectiveSettings(),
      }, 'core');
      return true;
    }

    // Persistent path: a user-driven write. Clear any session override
    // for this key — the user's explicit value should win and become
    // the new "real" value going forward.
    const hadOverride = this._overrides.delete(key);
    if (hadOverride) {
      log('info', `Cleared session override for ${key} (replaced by persistent write)`);
    }

    const keys = key.split('.');
    let current = this.settings;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (current[k] === undefined || current[k] === null) {
        // Permissive: auto-create the missing intermediate object so
        // a brand-new setting (declared in code but not yet in
        // settings.json) can still be saved. Log a warning so a
        // genuine typo (e.g. 'lops' instead of 'loops') is still
        // discoverable in the console.
        log('warn',
          `Auto-creating missing settings path '${keys
            .slice(0, i + 1)
            .join('.')}' (typo, or first use of a new setting?).`
        );
        current[k] = {};
      } else if (typeof current[k] !== 'object') {
        // Slot exists as a non-object scalar — overwriting it with
        // an object would silently destroy a real setting. Refuse.
        log('warn',
          `Cannot update setting. Path '${keys
            .slice(0, i + 1)
            .join('.')}' is a scalar (${typeof current[k]}); refusing to overwrite with an object.`
        );
        return false;
      }
      current = current[k];
    }

    const finalKey = keys[keys.length - 1];
    if (typeof current === 'object' && current !== null) {
      if (current[finalKey] !== value) {
        current[finalKey] = value;
        log('info', `Setting updated: ${key} =`, value);
        eventBus.publish('settings:changed', {
          key,
          value,
          settings: await this.getEffectiveSettings(),
        }, 'core');
        await this.saveSettings(); // Trigger save
        return true;
      }
    } else {
      log('warn', 
        `Cannot update setting. Parent object for key '${key}' is not an object.`
      );
      return false;
    }
    return false; // Value was the same, no update
  }

  /**
   * Drop a single session override. Reads via getSetting subsequently
   * fall back to the persisted base. Fires settings:changed so
   * subscribers re-read (the effective value may have changed).
   * No-op when no override exists for the key.
   *
   * @param {string} key
   * @returns {Promise<boolean>} true if an override was cleared
   */
  async clearOverride(key) {
    if (!this._overrides.has(key)) return false;
    this._overrides.delete(key);
    log('info', `Cleared session override: ${key}`);
    // Look up the underlying persisted value to include in the event,
    // matching the shape of a per-key updateSetting publish.
    const value = await this.getSetting(key);
    eventBus.publish('settings:changed', {
      key,
      value,
      settings: await this.getEffectiveSettings(),
    }, 'core');
    return true;
  }

  /**
   * Drop every session override. Used by exit-loop-mode and similar
   * teardown paths. Fires one settings:changed per cleared key so
   * subscribers re-read.
   */
  async clearAllOverrides() {
    if (this._overrides.size === 0) return;
    const keys = Array.from(this._overrides.keys());
    for (const key of keys) {
      await this.clearOverride(key);
    }
  }

  /**
   * Snapshot of `this.settings` with all session overrides layered on
   * top. Use this when you need "what value would getSetting return
   * for any key" — e.g. populating settings:changed event payloads.
   *
   * Distinct from getSettings(), which returns the persisted base
   * (used by the JSON panel's save flow so transient overrides don't
   * accidentally get saved into the mode blob).
   */
  async getEffectiveSettings() {
    await this.ensureLoaded();
    if (this._overrides.size === 0) return JSON.parse(JSON.stringify(this.settings));
    const snapshot = JSON.parse(JSON.stringify(this.settings));
    for (const [key, value] of this._overrides) {
      const keys = key.split('.');
      let current = snapshot;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (current[k] === undefined || current[k] === null || typeof current[k] !== 'object') {
          current[k] = {};
        }
        current = current[k];
      }
      current[keys[keys.length - 1]] = value;
    }
    return snapshot;
  }

  // Merges user-provided settings on top of defaults, ensuring new default keys
  // are never lost when the user applies partial or edited settings.
  async updateSettings(newSettings) {
    await this.ensureLoaded();
    if (typeof newSettings !== 'object' || newSettings === null) {
      log('error', 'updateSettings received invalid input:', newSettings);
      return;
    }
    // Merge user settings on top of defaults so that any keys the user omitted
    // fall back to their default values rather than being deleted.
    if (this._defaultSettings) {
      this.settings = deepMerge(this._defaultSettings, newSettings);
    } else {
      this.settings = JSON.parse(JSON.stringify(newSettings));
    }
    log('info', 'Settings object updated:', this.settings);
    eventBus.publish('settings:changed', {
      key: '*', // Indicate general change
      value: this.settings,
      settings: await this.getSettings(),
    }, 'core');
    await this.saveSettings();
  }

  // --- New methods based on plan ---

  /**
   * Gets the settings object for a specific module. Ensures settings are loaded first.
   * @param {string} moduleId - The ID of the module (e.g., 'client').
   * @returns {Promise<object>} A promise resolving to the module's settings object or an empty object if not found.
   */
  async getModuleSettings(moduleId) {
    await this.ensureLoaded();
    return this.settings?.moduleSettings?.[moduleId] ?? {};
  }

  /**
   * Updates a specific setting within a module's settings object.
   * Publishes 'settings:changed' and triggers save. Ensures settings are loaded first.
   * @param {string} moduleId - The ID of the module.
   * @param {string} key - The setting key within the module's settings.
   * @param {*} value - The new value.
   * @returns {Promise<boolean>} True if updated, false otherwise.
   */
  async updateModuleSetting(moduleId, key, value) {
    await this.ensureLoaded();
    if (!this.settings.moduleSettings) {
      this.settings.moduleSettings = {}; // Ensure moduleSettings exists
    }
    if (!this.settings.moduleSettings[moduleId]) {
      this.settings.moduleSettings[moduleId] = {}; // Ensure module's settings object exists
    }

    const moduleSettings = this.settings.moduleSettings[moduleId];
    if (moduleSettings[key] !== value) {
      moduleSettings[key] = value;
      log('info', `Module setting updated: ${moduleId}.${key} =`, value);
      eventBus.publish('settings:changed', {
        key: `moduleSettings.${moduleId}.${key}`, // More specific key
        value,
        settings: await this.getSettings(),
      }, 'core');
      await this.saveSettings();
      return true;
    }
    return false; // Value was the same
  }

  /**
   * Gets the active layout identifier ('default', preset name, or null). Ensures settings are loaded first.
   * @returns {Promise<string|null>} A promise resolving to the active layout identifier.
   */
  async getActiveLayoutIdentifier() {
    await this.ensureLoaded();
    return this.settings?.activeLayout ?? 'default'; // Default to 'default' if missing
  }

  /**
   * Gets the custom Golden Layout configuration object. Ensures settings are loaded first.
   * @returns {Promise<object|null>} A promise resolving to the custom layout config or null.
   */
  async getCustomLayoutConfig() {
    await this.ensureLoaded();
    return this.settings?.customLayoutConfig ?? null;
  }

  /**
   * Gets the general application settings. Ensures settings are loaded first.
   * @returns {Promise<object>} A promise resolving to the general settings object or an empty object.
   */
  async getGeneralSettings() {
    await this.ensureLoaded();
    return this.settings?.generalSettings ?? {};
  }

  /**
   * Resets in-memory settings to the defaults loaded from settings.json.
   * Publishes 'settings:changed' event.
   * @returns {Promise<void>}
   */
  async resetToDefaults() {
    // Wait for the disk-defaults fetch (kicked off in setInitialSettings)
    // so reset uses shipped defaults rather than "whatever was loaded
    // at session start." Falls back to the session-start snapshot if
    // the fetch failed (offline / test env).
    await this._ensureDefaultsLoaded();
    if (!this._defaultSettings) {
      log('warn', 'No default settings available for reset.');
      return;
    }
    this.settings = JSON.parse(JSON.stringify(this._defaultSettings));
    log('info', 'Settings reset to defaults.');
    eventBus.publish('settings:changed', {
      key: '*',
      value: this.settings,
      settings: await this.getSettings(),
    }, 'core');
    await this.saveSettings();
  }
}

// Export singleton instance
// Initialization is now async, so consumers need to `await settingsManager.ensureLoaded()`
// or listen for 'settings:loaded' event.
const settingsManager = new SettingsManager();
export default settingsManager;
