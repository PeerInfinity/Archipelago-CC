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
        default: false,
        label: 'Auto-save Mode',
        description: 'Automatically save mode state on changes',
      },
      autoLoadMode: {
        type: 'boolean',
        default: false,
        label: 'Auto-load Mode',
        description: 'Automatically load saved mode state on startup',
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
