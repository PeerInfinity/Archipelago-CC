// modePersistenceDefaults.js — the ONE default for each mode-persistence
// switch (generalSettings.autoLoadMode / autoSaveMode).
//
// Two kinds of reader need these values:
//   - the boot readers in modeManager.js (getAutoModeSettings) and
//     modeDataLoader.js (shouldLoadFromLocalStorage), which run BEFORE
//     settingsManager exists and read the stored blob / settings.json raw;
//   - the settings schema (coreSettingsSchemas.js), which is what
//     settingsManager.getSetting and the Options panel resolve.
// Each used to spell its own default. On 2026-06-13 settings.json stopped
// carrying these keys, the boot readers fell back to their own literal
// `false` while the schema said `true`, and auto-load went OFF without
// anyone choosing it. All of them import from here now, so they cannot
// disagree again. This module imports nothing, so any boot-time module
// can import it without an import cycle.

/** Load the saved mode data (the stored blob) on a bare-URL startup. */
export const AUTO_LOAD_MODE_DEFAULT = true;

/** Remember the mode each boot chose as the "last active mode". */
export const AUTO_SAVE_MODE_DEFAULT = false;
