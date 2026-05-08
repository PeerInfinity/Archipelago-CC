// displaySettingsManager.js
import { createUniversalLogger } from '../../app/core/universalLogger.js';

const logger = createUniversalLogger('loopUI:DisplaySettings');

/**
 * DisplaySettingsManager
 *
 * Centralizes all display settings for the loops panel.
 * Manages both persisted settings (from settingsManager) and session-only settings (from UI controls).
 *
 * Data Flow:
 * 1. Initialize: Load persisted settings from settingsManager
 * 2. Sync from UI: Read current checkbox/select states
 * 3. Get setting: Return cached value
 * 4. Set setting: Update cache and optionally persist
 * 5. Sync to UI: Update checkbox/select states to match cache
 */

// Legacy storage key — pre-Phase-A workaround for the missing
// settingsManager.saveSettings() implementation. Kept here only to
// remove orphaned data from existing users' localStorage; no code
// reads from or writes to this key anymore.
const LEGACY_LOOP_SETTINGS_STORAGE_KEY = 'archipelago_loop_settings';

export class DisplaySettingsManager {
  constructor(settingsManager, rootElement) {
    this.settingsManager = settingsManager;
    this.rootElement = rootElement;

    // Cache all settings - single source of truth
    this.settings = {
      // From settingsManager (persisted across sessions)
      colorblindMode: false,

      // Loop-specific settings (persisted)
      defaultSpeed: 100,
      autoRestart: false,
      autoResumeOnNewAction: false,
      instantMode: false,
      loopModeEnabled: false,
      autoRemoveCompleted: false,

      // When true, suppress substrate self-activation during queue
      // processing so the loops panel stays focused. Substrate panels
      // (maze, textAdventure) check loops.isFocusLocked() before
      // publishing ui:activatePanel on loadRegion.
      keepFocused: false,
    };

    logger.debug('DisplaySettingsManager constructed');
  }

  /**
   * Initialize settings manager
   * Loads persisted settings and syncs TO UI (not FROM UI, which would overwrite persisted values)
   */
  async initialize() {
    logger.info('Initializing display settings...');
    await this.loadPersistedSettings();
    // Sync TO UI to ensure controls match loaded persisted settings
    // DO NOT call syncFromUI() here - that would overwrite persisted settings
    this.syncToUI();
    logger.info('Display settings initialized', this.settings);
  }

  /**
   * Load persisted settings from settingsManager
   */
  async loadPersistedSettings() {
    try {
      // Load display settings
      this.settings.colorblindMode = await this.settingsManager.getSetting('colorblindMode.loops', false);

      // Load loop-specific settings from settingsManager (defaults from settings.json)
      this.settings.defaultSpeed = await this.settingsManager.getSetting('moduleSettings.loops.defaultSpeed', 100);
      this.settings.autoRestart = await this.settingsManager.getSetting('moduleSettings.loops.autoRestart', false);
      this.settings.autoResumeOnNewAction = await this.settingsManager.getSetting('moduleSettings.loops.autoResumeOnNewAction', false);
      this.settings.loopModeEnabled = await this.settingsManager.getSetting('moduleSettings.loops.loopModeEnabled', false);
      this.settings.instantMode = await this.settingsManager.getSetting('moduleSettings.loops.instantMode', false);
      this.settings.autoRemoveCompleted = await this.settingsManager.getSetting('moduleSettings.loops.autoRemoveCompleted', false);
      this.settings.keepFocused = await this.settingsManager.getSetting('moduleSettings.loops.keepFocused', false);

      // One-time cleanup of the legacy side-channel localStorage key.
      // Pre-Phase-A this module wrote settings here directly because
      // settingsManager.saveSettings() was a stub. Now persistence
      // flows through settingsManager → mode-keyed localStorage; the
      // legacy key is orphaned and harmless, but worth removing so
      // it doesn't linger as confusing debug noise.
      this._removeLegacyStorageKey();

      logger.debug('Persisted settings loaded successfully');
    } catch (error) {
      logger.error('Failed to load persisted settings:', error);
      // Continue with defaults
    }
  }

  /**
   * Sync settings from UI controls to cache
   * Reads current checkbox/slider states and updates cached settings
   */
  syncFromUI() {
    if (!this.rootElement) {
      logger.warn('Cannot sync from UI: rootElement not available');
      return;
    }

    // Read slider value for game speed
    const speedSlider = this.rootElement.querySelector('#loop-ui-speed-slider');
    if (speedSlider) {
      this.settings.defaultSpeed = parseFloat(speedSlider.value) || 100;
    }

    logger.debug('Settings synced from UI');
  }

  /**
   * Sync settings to UI controls from cache
   * Updates checkbox/slider states to match cached settings
   */
  syncToUI() {
    if (!this.rootElement) {
      logger.warn('Cannot sync to UI: rootElement not available');
      return;
    }

    // Update speed slider if it exists
    const speedSlider = this.rootElement.querySelector('#loop-ui-speed-slider');
    const speedInput = this.rootElement.querySelector('#loop-ui-speed-value');
    if (speedSlider) {
      speedSlider.value = this.settings.defaultSpeed;
      if (speedInput) {
        speedInput.value = this.settings.defaultSpeed;
      }
    }

    // Update auto-restart checkbox if it exists
    const autoRestartCheckbox = this.rootElement.querySelector('#loop-ui-toggle-auto-restart');
    if (autoRestartCheckbox) {
      autoRestartCheckbox.checked = this.settings.autoRestart;
    }

    // Update instant mode checkbox and slider disabled state
    const instantCheckbox = this.rootElement.querySelector('#loop-ui-toggle-instant');
    if (instantCheckbox) {
      instantCheckbox.checked = this.settings.instantMode;
      if (speedSlider) {
        speedSlider.disabled = this.settings.instantMode;
      }
      if (speedInput) {
        speedInput.disabled = this.settings.instantMode;
      }
    }

    const keepFocusedCheckbox = this.rootElement.querySelector('#loop-ui-toggle-keep-focused');
    if (keepFocusedCheckbox) {
      keepFocusedCheckbox.checked = !!this.settings.keepFocused;
    }

    logger.debug('Settings synced to UI');
  }

  /**
   * Get a setting value
   * @param {string} key - Setting key
   * @returns {*} Setting value
   */
  getSetting(key) {
    return this.settings[key];
  }

  /**
   * Set a setting value
   * @param {string} key - Setting key
   * @param {*} value - Setting value
   * @param {boolean} persist - Whether to persist to settingsManager (default: true)
   */
  async setSetting(key, value, persist = true) {
    const oldValue = this.settings[key];
    this.settings[key] = value;

    logger.debug(`Setting changed: ${key} = ${value} (persist: ${persist})`);

    if (persist) {
      try {
        const settingsKey = this.getSettingsKey(key);
        await this.settingsManager.updateSetting(settingsKey, value);
        logger.debug(`Persisted setting: ${settingsKey} = ${value}`);
      } catch (error) {
        logger.error(`Failed to persist setting ${key}:`, error);
        // Revert on failure
        this.settings[key] = oldValue;
      }
    }
  }

  /**
   * Map internal setting key to settingsManager key
   * @param {string} key - Internal setting key
   * @returns {string} settingsManager key
   */
  getSettingsKey(key) {
    if (key === 'colorblindMode') {
      return 'colorblindMode.loops';
    }
    return `moduleSettings.loops.${key}`;
  }

  /**
   * Get colorblind mode setting
   * @returns {boolean} Whether colorblind mode is enabled
   */
  getColorblindMode() {
    return this.settings.colorblindMode;
  }

  /**
   * Set colorblind mode setting
   * @param {boolean} enabled - Whether to enable colorblind mode
   */
  async setColorblindMode(enabled) {
    await this.setSetting('colorblindMode', enabled, true);
  }

  /**
   * Handle settings:changed event from global settingsManager (synchronous version)
   * @param {Object} event - Event object with key and value
   * @returns {boolean} True if settings were updated
   */
  handleSettingsChanged(event) {
    const { key, value } = event;

    // Handle wildcard separately - need to reload all settings
    if (key === '*') {
      logger.info('Wildcard settings change - reloading all loop settings');
      // For wildcard, we need to reload all settings asynchronously
      // but we do it in the background to keep this method synchronous
      this.loadPersistedSettings().then(() => {
        this.syncToUI();
        logger.info('All loop settings reloaded after wildcard change');
      }).catch(err => {
        logger.error('Failed to reload settings after wildcard change:', err);
      });
      return true;
    }

    // Check if this is a specific loop-related setting
    if (key.startsWith('colorblindMode.loops') || key.startsWith('moduleSettings.loops')) {
      logger.info(`External setting changed: ${key}`);

      // Update the specific setting in cache
      if (key === 'colorblindMode.loops') {
        this.settings.colorblindMode = value;
      } else if (key === 'moduleSettings.loops.defaultSpeed') {
        this.settings.defaultSpeed = value;
      } else if (key === 'moduleSettings.loops.autoRestart') {
        this.settings.autoRestart = value;
      } else if (key === 'moduleSettings.loops.loopModeEnabled') {
        this.settings.loopModeEnabled = value;
      } else if (key === 'moduleSettings.loops.autoResumeOnNewAction') {
        this.settings.autoResumeOnNewAction = value;
      } else if (key === 'moduleSettings.loops.instantMode') {
        this.settings.instantMode = value;
      } else if (key === 'moduleSettings.loops.autoRemoveCompleted') {
        this.settings.autoRemoveCompleted = value;
      } else if (key === 'moduleSettings.loops.keepFocused') {
        this.settings.keepFocused = value;
      }

      // Sync to UI to reflect the change
      this.syncToUI();

      return true; // Indicate that settings were updated
    }

    return false; // Not a loop-related setting
  }

  /**
   * Remove the legacy archipelago_loop_settings key from localStorage
   * if it exists. Pre-Phase-A workaround data; safe to drop now.
   * @private
   */
  _removeLegacyStorageKey() {
    try {
      if (typeof localStorage !== 'undefined' &&
          localStorage.getItem(LEGACY_LOOP_SETTINGS_STORAGE_KEY) !== null) {
        localStorage.removeItem(LEGACY_LOOP_SETTINGS_STORAGE_KEY);
        logger.debug('Removed legacy localStorage key', LEGACY_LOOP_SETTINGS_STORAGE_KEY);
      }
    } catch (e) {
      // localStorage may be unavailable / blocked; ignore.
    }
  }
}

export default DisplaySettingsManager;
