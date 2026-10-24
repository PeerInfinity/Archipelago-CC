/**
 * JtA ↔ procgen-pipeline integration: the substrate's panel parameters.
 * Attached to the jta registry entry as `defaultProcgenParams` (merged into
 * the panel's defaults) and `renderProcgenParams` (the controls under the JtA
 * subheader of Parameters). The entry's `pipelineConfigFromParams` turns them
 * into the `substrateConfig.jta` that spiral ① installs.
 *
 * Call-time DOM only, so headless drivers can import the jta library.
 */

import { fieldRow, numberField } from '../procgenCore/regionGenerationForm.js';

// ⚖ The user, 2026-10-11: JtA zones carry AP locations by default; the free
// zones, starting perks and perk shuffle are panel settings.
export const DEFAULT_JTA_PROCGEN_PARAMS = Object.freeze({
    // Every zone task is an AP location (first full completion checks it).
    jtaZoneLocations: true,
    // Zones playable with no perks; zone Z then needs Z - jtaFreeZones + 1.
    jtaFreeZones: 1,
    // Perks the access rules assume the player starts with.
    jtaStartingPerks: 0,
    // Deal the perks across the world's zones, seeded by the world seed.
    jtaShufflePerks: false,
});

function checkboxField(params, { key, label, title, def }, onChange) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.paramKey = key;
    input.checked = (params[key] ?? def) !== false;
    input.addEventListener('change', () => {
        params[key] = input.checked;
        onChange();
    });
    return fieldRow(label, title, input);
}

export function renderJtaProcgenParams({ params, onChange = () => {} } = {}) {
    const d = DEFAULT_JTA_PROCGEN_PARAMS;
    const wrap = document.createElement('div');
    wrap.appendChild(checkboxField(params, {
        key: 'jtaZoneLocations', label: 'Zone locations', def: d.jtaZoneLocations,
        title: 'Every task of a JtA zone is an Archipelago location, checked the first time the task '
            + 'completes. Perks are items; the final zone\'s Travel task holds the Victory unless the '
            + 'world already has a victory item. Off: JtA zones carry no locations.',
    }, onChange));
    wrap.appendChild(numberField(params, {
        key: 'jtaFreeZones', label: 'Free zones', def: d.jtaFreeZones, min: 1, integer: true,
        title: 'How many zones need no perks. After them, each zone needs one more perk.',
    }, onChange));
    wrap.appendChild(numberField(params, {
        key: 'jtaStartingPerks', label: 'Starting perks', def: d.jtaStartingPerks, min: 0, integer: true,
        title: 'Perks the access rules assume the player already has: each zone needs this many fewer.',
    }, onChange));
    wrap.appendChild(checkboxField(params, {
        key: 'jtaShufflePerks', label: 'Shuffle perks', def: d.jtaShufflePerks,
        title: 'Deal the perks across the world\'s zones (seeded by the world seed) instead of leaving '
            + 'each on its own task.',
    }, onChange));
    return wrap;
}
