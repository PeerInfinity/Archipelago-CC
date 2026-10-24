// coreSettingsSchemas.js — schemas for TOP-LEVEL (non-moduleSettings) settings.
//
// schema-as-default-source Phase 4: top-level scopes get the same
// schema-is-the-default-source treatment as moduleSettings.<mod>.* (Phase 1-3).
// registerCoreSettingsSchemas() is called once at app bootstrap (before
// modules load), so a top-level settings read (e.g. generalSettings.layoutMode)
// resolves these defaults and settings.json no longer needs to carry them.
//
// Scope is intentionally limited to the simple, flat scalar scopes:
//   - generalSettings, colorblindMode
// Deliberately NOT migrated (kept in settings.json):
//   - logging.*  — large nested categoryLevels map, consumed directly by the
//                  logger init (not via getSetting); doesn't fit the flat model.
//   - playerId / playerName — 1-part identity keys (not <scope>.<prop> shaped).
//   - activeLayout / customLayoutConfig — layout bootstrap state.
//
// EDITOR v3 E1c adds `rulesJson` — one flat integer (`rulesJson.indent`) that
// four rules.json writers read. It is top-level rather than a moduleSettings
// scope because no single module owns "how a rules.json is written".

import { centralRegistry } from './centralRegistry.js';
// ⛓ EDITOR v3 E1c — the rules.json OUTPUT scope is declared beside the writer
// that honours it (`modules/presets/documentBundle.js`), not here, because a
// standalone lab page reads the same default without any of app/core. This file
// stays what it is: the REGISTRAR for top-level scopes.
import { RULES_JSON_SETTINGS_SCHEMA } from '../../modules/presets/documentBundle.js';
// ⛓ settings-persistence S2 — the mode-persistence defaults are shared with
// the two boot readers that run before settingsManager (modeManager /
// modeDataLoader), so the schema and the boot cannot disagree again.
import { AUTO_LOAD_MODE_DEFAULT, AUTO_SAVE_MODE_DEFAULT } from '../mode/modePersistenceDefaults.js';

export const CORE_SETTINGS_SCHEMAS = {
  generalSettings: {
    type: 'object',
    properties: {
      layoutMode: {
        type: 'string',
        default: 'auto',
        enum: ['auto', 'desktop', 'mobile'],
        label: 'Layout Mode',
        description: 'Which layout to use. Requires a page reload to take effect.',
      },
      autoSaveMode: {
        type: 'boolean',
        default: AUTO_SAVE_MODE_DEFAULT,
        label: 'Auto-save Mode',
        description: 'Remember the mode each startup opens as the last active mode, so the next plain-URL startup (with Auto-load Mode on) reopens it. Your settings are saved whenever you change them, whatever this says.',
      },
      autoLoadMode: {
        type: 'boolean',
        default: AUTO_LOAD_MODE_DEFAULT,
        label: 'Auto-load Mode',
        description: 'On (the default): a plain URL (no ?mode=) reopens your last active mode with its saved settings, and those saved settings are used in place of the shipped settings.json. Off: a plain URL starts from settings.json; your saved settings are kept and come back when you turn this on again (or open ?mode=default). To turn it off: open the app with a plain URL and choose No here.',
      },
      useSubstitutedNames: {
        type: 'boolean',
        default: true,
        label: 'Use Substituted Names',
        description: 'Show meaningful display names instead of generic internal names',
      },
      restoreLastWorld: {
        type: 'boolean',
        default: false,
        label: 'Restore Last World',
        description: 'Save the most recently loaded world and automatically restore it after a page reload (off by default)',
      },
    },
  },
  colorblindMode: {
    type: 'object',
    properties: {
      locations: { type: 'boolean', default: false, label: 'Locations' },
      exits: { type: 'boolean', default: false, label: 'Exits' },
      regions: { type: 'boolean', default: false, label: 'Regions' },
      dungeons: { type: 'boolean', default: false, label: 'Dungeons' },
      loops: { type: 'boolean', default: false, label: 'Loops' },
      helpers: { type: 'boolean', default: false, label: 'Helpers' },
      pathAnalyzer: { type: 'boolean', default: false, label: 'Path Analyzer' },
    },
  },
  rulesJson: RULES_JSON_SETTINGS_SCHEMA,
};

/**
 * Register all core top-level settings schemas on the centralRegistry.
 * Idempotent (re-registration just overwrites with a warning). Call once
 * early in app bootstrap, before modules load and before any getSetting read.
 */
export function registerCoreSettingsSchemas() {
  for (const [scope, snippet] of Object.entries(CORE_SETTINGS_SCHEMAS)) {
    centralRegistry.registerTopLevelSettingsSchema(scope, snippet);
  }
}
