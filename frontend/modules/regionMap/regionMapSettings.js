/**
 * regionMap/regionMapSettings — the panel's settings schema and the live-panel set. Its own module so neither
 * `index.js` nor `regionMapUI.js` reads the other's bindings at evaluation time (the UI → index import cycle's TDZ).
 *
 * ⛓ The schema's `default`s ARE the defaults (the settings manager answers them for an unset key); the storage
 * panel attributes every `moduleSettings.regionMap.*` key to this module through its registered schema.
 */

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
    },
});

/** `{key: default}` off the schema. */
export const REGION_MAP_SETTING_DEFAULTS = Object.freeze(Object.fromEntries(
    Object.entries(REGION_MAP_SETTINGS_SCHEMA.properties).map(([k, v]) => [k, v.default]),
));

export const SETTINGS_PREFIX = 'moduleSettings.regionMap.';

/** Every mounted Region Map panel (the in-app rows read their state through it). */
export const panelInstances = new Set();
