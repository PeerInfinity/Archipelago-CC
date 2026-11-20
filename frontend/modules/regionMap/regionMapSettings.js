/**
 * regionMap/regionMapSettings — the panel's settings schema and the live-panel set. Its own module so neither
 * `index.js` nor `regionMapUI.js` reads the other's bindings at evaluation time (the UI → index import cycle's TDZ).
 *
 * ⛓ The schema's `default`s ARE the defaults (the settings manager answers them for an unset key); the storage
 * panel attributes every `moduleSettings.regionMap.*` key to this module through its registered schema.
 *
 * ⛓ `clickActions` (CA-S3) is in the schema but NOT in `REGION_MAP_SETTING_DEFAULTS`: it is the "On click" strip's
 * (`regionMapClickActions.js`), loaded and saved by its own path, and a write of it must not re-read the view settings
 * (no repaint, no rebuild).
 */
import { REGION_MAP_CLICK_ACTIONS_KEY, regionMapClickActionsSchemaEntry } from './regionMapClickActions.js';

export const REGION_MAP_SETTINGS_SCHEMA = Object.freeze({
    type: 'object',
    properties: {
        followPlayer: {
            type: 'boolean', default: true,
            label: 'Follow player (keep the current region centred; a manual pan turns it off)',
        },
        cellSize: {
            type: 'string', default: 'level', enum: ['level', 'uniform'],
            label: 'Cell size: "level" = one tile scale, cells sized by their level; "uniform" = every level scaled into one square',
        },
        groupingRule: {
            type: 'string', default: 'R1',
            label: 'Grouping rule (procgenCore/regionLayout.js GROUPING_RULES)',
        },
        showLinks: { type: 'boolean', default: true, label: 'Draw the links between groups (stairs, pits)' },
        showUndiscovered: {
            type: 'boolean', default: true,
            label: 'Discovery mode: show undiscovered regions next to discovered ones as fog (off = hide them)',
        },
        minSquarePx: { type: 'number', default: 6, label: 'Smallest on-screen location square (px)' },
        // ⛓ What a click runs (CA-S3): the "On click" strip's settings; the first run copies the Region Graph's.
        clickActions: regionMapClickActionsSchemaEntry(),
    },
});

/** The schema keys the panel's view-settings loop does NOT read (they have their own load path). */
export const SEPARATELY_LOADED = Object.freeze(['clickActions']);

/** `{key: default}` off the schema: the VIEW settings (`clickActions` is loaded on its own). */
export const REGION_MAP_SETTING_DEFAULTS = Object.freeze(Object.fromEntries(
    Object.entries(REGION_MAP_SETTINGS_SCHEMA.properties).filter(([k]) => !SEPARATELY_LOADED.includes(k))
        .map(([k, v]) => [k, v.default]),
));

export const SETTINGS_PREFIX = 'moduleSettings.regionMap.';
export { REGION_MAP_CLICK_ACTIONS_KEY };

/** Every mounted Region Map panel (the in-app rows read their state through it). */
export const panelInstances = new Set();

/**
 * ⛓ step 4: the dispatcher and event bus `index.js` `initialize()` takes from its initialization API — the module's
 * OWN, under which the clicks' `user:regionMove` / `user:locationCheck` go out. Null before `initialize()` runs.
 */
export const moduleHandles = { dispatcher: null, eventBus: null };
