// displaySettingsManager.js
import { createUniversalLogger } from '../../app/core/universalLogger.js';
import { DisplaySettingsBase } from '../shared/displaySettingsBase.js';

const logger = createUniversalLogger('loopUI:DisplaySettings');

// Legacy storage key — pre-Phase-A workaround for the missing
// settingsManager.saveSettings() implementation. Kept here only to
// remove orphaned data from existing users' localStorage; no code
// reads from or writes to this key anymore.
const LEGACY_LOOP_SETTINGS_STORAGE_KEY = 'archipelago_loop_settings';

const DEFAULTS = {
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

  // Click-to-queue mode: what a user:locationCheck or user:exitClicked
  // from another panel does while loop mode is active.
  //   'off'         — (default) the click passes through and checks
  //                   immediately, exactly as with loop mode off.
  //   'append'      — append a single action to the end of the queue
  //                   iff the click's region matches the queue's
  //                   current end region; mismatches drop the click
  //                   and emit loops:clickIgnored.
  //   'rebuildPath' — CLEAR the queue and rebuild it as a path from
  //                   the current location to the click target.
  // Switching away from 'off' in the UI is gated by a confirmation
  // modal. Replaces the retired boolean autoBuildPathOnClick setting
  // (true → 'rebuildPath'); see _migrateAutoBuildPathOnClick.
  clickToQueue: 'off',
};

const CLICK_TO_QUEUE_MODES = ['off', 'append', 'rebuildPath'];

/**
 * DisplaySettingsManager (loops panel)
 *
 * Subclass of DisplaySettingsBase. Provides:
 *   - the loops-specific defaults table
 *   - syncFromUI / syncToUI bindings to loops-panel DOM IDs
 *   - one-time legacy-localStorage cleanup (Phase B leftover)
 *   - thin colorblindMode helpers (kept for call-site readability)
 */
export class DisplaySettingsManager extends DisplaySettingsBase {
  constructor(settingsManager, rootElement) {
    super({
      moduleId: 'loops',
      settingsManager,
      rootElement,
      defaults: DEFAULTS,
    });
  }

  async loadPersistedSettings() {
    await super.loadPersistedSettings();
    await this._migrateAutoBuildPathOnClick();
    // Sanitize: an unknown persisted clickToQueue value falls back to
    // the safe default.
    if (!CLICK_TO_QUEUE_MODES.includes(this.settings.clickToQueue)) {
      this.settings.clickToQueue = 'off';
    }
    // One-time cleanup of the legacy side-channel localStorage key.
    // Pre-Phase-A this module wrote settings here directly because
    // settingsManager.saveSettings() was a stub. Now persistence
    // flows through settingsManager → mode-keyed localStorage; the
    // legacy key is orphaned and harmless, but worth removing so
    // it doesn't linger as confusing debug noise.
    this._removeLegacyStorageKey();
  }

  /**
   * One-time migration from the retired boolean autoBuildPathOnClick
   * setting. A persisted `true` becomes clickToQueue 'rebuildPath'
   * (the behavior it used to select). `false`/absent maps to the new
   * 'off' default — the old always-intercept-and-append behavior is
   * deliberately NOT carried forward; interception is opt-in now.
   * The orphaned legacy key is left in place; nothing reads it.
   * @private
   */
  async _migrateAutoBuildPathOnClick() {
    try {
      const persistedMode = await this.settingsManager.getSetting(
        'moduleSettings.loops.clickToQueue', null);
      if (persistedMode !== null) return; // already migrated or user-set
      const legacy = await this.settingsManager.getSetting(
        'moduleSettings.loops.autoBuildPathOnClick', null);
      if (legacy === true) {
        await this.setSetting('clickToQueue', 'rebuildPath', true);
        logger.info('Migrated autoBuildPathOnClick=true → clickToQueue=rebuildPath');
      }
    } catch (e) {
      logger.warn('autoBuildPathOnClick migration failed:', e);
    }
  }

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

  syncToUI() {
    if (!this.rootElement) {
      logger.warn('Cannot sync to UI: rootElement not available');
      return;
    }

    // Speed slider + numeric input
    const speedSlider = this.rootElement.querySelector('#loop-ui-speed-slider');
    const speedInput = this.rootElement.querySelector('#loop-ui-speed-value');
    if (speedSlider) {
      speedSlider.value = this.settings.defaultSpeed;
      if (speedInput) speedInput.value = this.settings.defaultSpeed;
    }

    // Auto-restart checkbox
    const autoRestartCheckbox = this.rootElement.querySelector('#loop-ui-toggle-auto-restart');
    if (autoRestartCheckbox) autoRestartCheckbox.checked = this.settings.autoRestart;

    // Instant mode checkbox + slider/input disabled state
    const instantCheckbox = this.rootElement.querySelector('#loop-ui-toggle-instant');
    if (instantCheckbox) {
      instantCheckbox.checked = this.settings.instantMode;
      if (speedSlider) speedSlider.disabled = this.settings.instantMode;
      if (speedInput) speedInput.disabled = this.settings.instantMode;
    }

    // Keep-focused checkbox
    const keepFocusedCheckbox = this.rootElement.querySelector('#loop-ui-toggle-keep-focused');
    if (keepFocusedCheckbox) keepFocusedCheckbox.checked = !!this.settings.keepFocused;

    // Click-to-queue mode select
    const clickToQueueSelect = this.rootElement.querySelector('#loop-ui-click-to-queue');
    if (clickToQueueSelect) clickToQueueSelect.value = this.settings.clickToQueue;

    logger.debug('Settings synced to UI');
  }

  /** Convenience reader for the colorblind toggle. */
  getColorblindMode() {
    return this.settings.colorblindMode;
  }

  /** Convenience writer for the colorblind toggle. */
  async setColorblindMode(enabled) {
    await this.setSetting('colorblindMode', enabled, true);
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
