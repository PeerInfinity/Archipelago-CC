/**
 * ⛓ REGION GRAPH ELEMENT CAPTURE (region-graph-groups-a). Builds the Region Graph's Cytoscape element set from a
 * committed preset's rules.json, through the panel's OWN builder (`GraphDataManager.buildGraphFromRegions` +
 * `onStateUpdate`), on a HEADLESS Cytoscape (the panel's vendored `frontend/libs/cytoscape/cytoscape.min.js`), and
 * serialises it canonically: every element's group, id, data (keys sorted) and classes (sorted). Positions are left
 * out (a fresh build places nodes at random until a layout runs).
 *
 * A test file mocks `./index.js`, `../stateManager/index.js`, `../gameState/singleton.js`, `../discovery/singleton.js`,
 * `../shared/ruleEngine.js` and `../shared/snapshotInterface.js` FIRST (see `subRegionView.identity.test.js`), then
 * imports this and hands it the stateManager stub to drive.
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONTEND = join(HERE, '..', '..');

let _cytoscape = null;
/** The panel's vendored Cytoscape (a UMD bundle; loaded with a CommonJS `module` shim). */
export function loadCytoscape() {
    if (_cytoscape) return _cytoscape;
    const src = readFileSync(join(FRONTEND, 'libs/cytoscape/cytoscape.min.js'), 'utf8');
    const m = { exports: {} };
    // eslint-disable-next-line no-new-func
    new Function('module', 'exports', src)(m, m.exports);
    _cytoscape = m.exports;
    return _cytoscape;
}

/** A committed preset's rules.json. `rel` is relative to `frontend/presets/`. */
export function loadRules(rel) {
    return JSON.parse(readFileSync(join(FRONTEND, 'presets', rel), 'utf8'));
}

/**
 * ⛓ A FROZEN copy of a preset's rules (region-graph-groups-c; the planner's ruling 2026-11-24: no digest pin over a
 * LIVE committed preset — a legitimate rules change to the preset would trip it). `fixtures/sub-region-view/<name>`
 * holds the fields the builder reads (`regions`, `start_regions`, `preset_sidecars`, and the world's names), taken
 * from the presets at 146d8f6ef8. The live preset moves; these do not.
 */
export const FROZEN = Object.freeze(['seedling_playthrough', 'alttp', 'procgen_maze', 'seedling_atlas']);
export function loadFrozenRules(name) {
    if (!FROZEN.includes(name)) throw new Error(`no frozen rules fixture "${name}"`);
    return JSON.parse(gunzipSync(readFileSync(join(HERE, 'fixtures', 'sub-region-view', `${name}.rules.json.gz`))).toString('utf8'));
}

/** `staticData.regions` as the worker hands it to the panel: a Map name → region (with `name`). */
export function regionsOf(rules, playerId = '1') {
    return new Map(Object.entries(rules.regions[playerId]).map(([name, r]) => [name, { ...r, name }]));
}

/**
 * Three deterministic game states over a preset, as `{ name, snapshot }`:
 *   · start — only the start region reachable, nothing checked;
 *   · mid   — every other region (by order) reachable, every third location of those checked;
 *   · end   — every region reachable, every location checked.
 */
export function threeStates(rules, regions, playerId = '1') {
    const sr = rules.start_regions?.[playerId]?.default ?? [regions.keys().next().value];
    const names = [...regions.keys()];
    const reach = (pred) => Object.fromEntries(names.filter(pred).map((n) => [n, 'reachable']));
    const locs = (pred) => names.filter(pred).flatMap((n) => (regions.get(n).locations ?? []).map((l) => l.name));
    const base = { startRegions: { default: sr, available: [] }, playerId };
    return [
        { name: 'start', snapshot: { ...base, regionReachability: reach((n) => sr.includes(n)), checkedLocations: [] } },
        { name: 'mid', snapshot: { ...base,
            regionReachability: reach((n) => sr.includes(n) || names.indexOf(n) % 2 === 0),
            checkedLocations: locs((n) => names.indexOf(n) % 2 === 0).filter((_, i) => i % 3 === 0) } },
        { name: 'end', snapshot: { ...base, regionReachability: reach(() => true), checkedLocations: locs(() => true) } },
    ];
}

/** A Region Graph `ui` stub on a headless Cytoscape, the way `RegionGraphUI` wires the data manager. */
export function makeUi(cytoscape, extra = {}) {
    const ui = {
        cy: cytoscape({ headless: true, styleEnabled: false }),
        controlPanel: null,
        isDiscoveryModeActive: false,
        discoverySettings: null,
        nodePositions: new Map(),
        layoutGeneration: 0,
        locationVisibilityMode: 'force-hide',
        runLayout() {},
        updateStatus() {},
        getRegionDisplayText: (r) => (r?.name ?? '').replace(/_/g, ' '),
        getLocationDisplayText: (l) => l?.name ?? '',
        getCurrentPlayerLocation: () => null,
        ...extra,
    };
    return ui;
}

const sortKeys = (v) => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
    return v;
};

/** The canonical element set: [{ group, data, classes }] sorted by group then id. */
export function serialiseElements(cy) {
    const out = cy.elements().map((e) => ({
        group: e.group(),
        data: sortKeys(e.data()),
        classes: [...e.classes()].sort(),
    }));
    out.sort((a, b) => (a.group === b.group ? (a.data.id < b.data.id ? -1 : a.data.id > b.data.id ? 1 : 0)
        : (a.group < b.group ? -1 : 1)));
    return out;
}

export const digestOf = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
