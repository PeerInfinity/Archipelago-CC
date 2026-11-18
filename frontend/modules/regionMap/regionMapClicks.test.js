/**
 * regionMapClicks — the Region Map's gesture → action mapping (region-map step 4) is the Region Graph's
 * (`regionGraph/graphInteractionManager.js` `handleRegionNodeClick` / `handleLocationNodeClick`), under the Region
 * Map's own strings. Stubbed actions for the mapping; the real `regionActions` for the payloads.
 */
import fs from 'node:fs';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../shared/snapshotInterface.js', () => ({ createSnapshotInterface: () => ({}) }));
vi.mock('../shared/ruleEngine.js', () => ({ evaluateRule: (rule) => rule.ok }));

const {
    CLICK_OPTION_DEFAULTS, CLICK_OPTIONS_PREFIX, REGION_MAP_NODE_SELECTED, REGION_MAP_ORIGINATORS, REGION_MAP_SOURCES,
    onLocationClick, onRegionClick, readClickOptions, regionOfCell, statusOf,
} = await import('./regionMapClicks.js');
const realActions = await import('../regionView/regionActions.js');
const { REGION_GRAPH_SOURCES, REGION_GRAPH_ORIGINATORS } = await import('../regionGraph/regionGraphOriginators.js');

/** A stub `actions` that records every call (name + args) in order. */
function stubActions({ allowed = true } = {}) {
    const calls = [];
    const rec = (name, ret) => (...args) => { calls.push([name, ...args]); return typeof ret === 'function' ? ret(...args) : ret; };
    return {
        calls,
        names: () => calls.map((c) => c[0]),
        publishNodeSelected: rec('publishNodeSelected'),
        addToPath: rec('addToPath', { ok: true, kind: 'single', from: 'Menu' }),
        overwritePath: rec('overwritePath', { ok: true, kind: 'path', from: 'Menu', dispatched: 2, regions: ['A', 'B'] }),
        moveOneStep: rec('moveOneStep', { ok: false, reason: 'already-there', from: 'B' }),
        moveDirectly: rec('moveDirectly', { ok: false, reason: 'no-path', from: 'Menu' }),
        showRegionInRegionsPanel: rec('showRegionInRegionsPanel'),
        locationChecksAllowed: rec('locationChecksAllowed', () => allowed),
        checkAccessibleLocationsInRegion: rec('checkAccessibleLocationsInRegion', { ok: true, checked: 1 }),
        checkLocation: rec('checkLocation', { ok: true }),
        addLocationCheckToPath: rec('addLocationCheckToPath', { ok: true }),
    };
}
const H = { tag: 'handles' };
const opts = (o = {}) => ({ ...CLICK_OPTION_DEFAULTS, ...o });

describe('⛓ the toggles are the Region Graph\'s (planner ruling: option A)', () => {
    it('the same seven keys and defaults as regionGraph/layoutControlsManager.js', () => {
        const src = fs.readFileSync(new URL('../regionGraph/layoutControlsManager.js', import.meta.url), 'utf8');
        const rg = {};
        for (const m of src.matchAll(/setting: 'moduleSettings\.regionGraph\.(\w+)', default: (true|false)/g)) rg[m[1]] = m[2] === 'true';
        const clickKeys = Object.keys(CLICK_OPTION_DEFAULTS);
        expect(Object.fromEntries(clickKeys.map((k) => [k, rg[k]]))).toEqual({ ...CLICK_OPTION_DEFAULTS });
        expect(CLICK_OPTIONS_PREFIX).toBe('moduleSettings.regionGraph');
    });

    it('readClickOptions reads each key under the prefix, defaulting a missing or throwing one', async () => {
        const seen = [];
        const settings = { getSetting: async (k, d) => {
            seen.push(k);
            if (k.endsWith('.overwritePath')) return true;
            if (k.endsWith('.addToPath')) throw new Error('boom');
            return d;
        } };
        const o = await readClickOptions(settings);
        expect(seen).toEqual(Object.keys(CLICK_OPTION_DEFAULTS).map((k) => `moduleSettings.regionGraph.${k}`));
        expect(o).toEqual({ ...CLICK_OPTION_DEFAULTS, overwritePath: true, addToPath: true });
        expect(await readClickOptions(null)).toEqual({ ...CLICK_OPTION_DEFAULTS });
        const other = [];
        await readClickOptions({ getSetting: async (k, d) => { other.push(k); return d; } }, 'moduleSettings.regionMap');
        expect(other[0]).toBe('moduleSettings.regionMap.movePlayerOneStep');
    });
});

describe('⛓ a click on a region (cell) — handleRegionNodeClick', () => {
    it('defaults: select, add to path, show in the Regions panel (Show All off); no bulk check', () => {
        const a = stubActions();
        const showAll = vi.fn();
        const r = onRegionClick(H, 'Field', opts(), {}, { actions: a, showAll });
        expect(a.names()).toEqual(['publishNodeSelected', 'addToPath', 'showRegionInRegionsPanel']);
        expect(a.calls[0]).toEqual(['publishNodeSelected', H, REGION_MAP_NODE_SELECTED, 'Field', { id: 'Field' }]);
        const [, h, target, o] = a.calls[1];
        expect([h, target, o.moveOnlyOneStep, o.source]).toEqual([H, 'Field', false, 'regionMap-addToPath']);
        o.beforeExecute();
        expect(showAll.mock.calls).toEqual([[false], [false]]);
        expect(r.shown).toBe(true);
        expect(r.bulk).toBe(null);
    });

    it('the precedence: add to path, else overwrite, else one step AND/OR direct', () => {
        const run = (o) => { const a = stubActions(); onRegionClick(H, 'X', opts({ showRegionInPanel: false, ...o }), {}, { actions: a, showAll: () => {} }); return a; };
        expect(run({ addToPath: true, overwritePath: true }).names()).toEqual(['publishNodeSelected', 'addToPath']);
        const ow = run({ addToPath: false, overwritePath: true, movePlayerOneStep: true });
        expect(ow.names()).toEqual(['publishNodeSelected', 'overwritePath']);
        expect(ow.calls[1][3]).toMatchObject({ moveOnlyOneStep: true, source: 'regionMap-overwritePath' });
        const both = run({ addToPath: false, movePlayerOneStep: true, movePlayerDirectly: true });
        expect(both.calls.slice(1)).toEqual([['moveOneStep', H, 'X', 'regionMap-oneStep'], ['moveDirectly', H, 'X', 'regionMap-direct']]);
        expect(run({ addToPath: false, movePlayerDirectly: false }).names()).toEqual(['publishNodeSelected']);
    });

    it('Show region in panel: Show All Regions ON only when neither path toggle is on', () => {
        const showAll = vi.fn();
        onRegionClick(H, 'X', opts({ addToPath: false, movePlayerDirectly: false }), {}, { actions: stubActions(), showAll });
        expect(showAll.mock.calls).toEqual([[true]]);
    });

    it('the bulk check: under regionMapBulkCheck, and refused by discovery\'s disableLocationCheckUI', () => {
        const a = stubActions();
        const disc = { active: false, settings: {} };
        const r = onRegionClick(H, 'X', opts({ checkAllLocationsInRegion: true, showRegionInPanel: false }), disc, { actions: a, showAll: () => {} });
        expect(a.calls.at(-2)).toEqual(['locationChecksAllowed', disc]);
        expect(a.calls.at(-1)).toEqual(['checkAccessibleLocationsInRegion', H, 'X', { originator: 'regionMapBulkCheck' }]);
        expect(r.bulk).toEqual({ ok: true, checked: 1 });
        const no = stubActions({ allowed: false });
        onRegionClick(H, 'X', opts({ checkAllLocationsInRegion: true }), { active: true, settings: { disableLocationCheckUI: true } }, { actions: no, showAll: () => {} });
        expect(no.names()).not.toContain('checkAccessibleLocationsInRegion');
    });

    it('statuses: the Region Graph\'s status-bar texts', () => {
        const seen = [];
        const a = stubActions();
        onRegionClick(H, 'X', opts({ addToPath: false, overwritePath: false, movePlayerDirectly: true, showRegionInPanel: false }), {}, { actions: a, showAll: () => {}, onStatus: (s) => seen.push(s) });
        expect(seen).toEqual(['No path to X']);
        expect(statusOf('addToPath', 'X', { ok: false, reason: 'no-path', from: 'M' })).toBe('No path from M to X');
        expect(statusOf('oneStep', 'X', { ok: true, kind: 'move', path: { length: 3, steps: ['M', 'A', 'B', 'X'] } })).toBe('Moving to X (3 steps via A)');
        expect(statusOf('direct', 'X', { ok: true, kind: 'move', path: { length: 1, steps: ['M', 'X'] } })).toBe('Moving directly to X');
        expect(statusOf('oneStep', 'X', { ok: true, kind: 'restart', from: 'M', region: 'Menu' })).toBe('Restart → Menu (no walk from M to X)');
        expect(statusOf('overwritePath', 'X', { ok: true, kind: 'path', from: 'M', dispatched: 2 })).toBe('Created path: M → X (2 steps)');
        expect(statusOf('direct', 'X', { ok: false, reason: 'already-there' })).toBe(null);
    });
});

describe('⛓ a click on a location square — handleLocationNodeClick', () => {
    it('default: one check under regionMapCheck', () => {
        const a = stubActions();
        const r = onLocationClick(H, { locationName: 'chest', regionName: 'Field' }, opts(), {}, { actions: a });
        expect(a.calls).toEqual([['locationChecksAllowed', {}], ['checkLocation', H, { locationName: 'chest', regionName: 'Field', originator: 'regionMapCheck' }]]);
        expect(r).toEqual({ check: { ok: true } });
    });

    it('discovery\'s disableLocationCheckUI refuses it before anything else', () => {
        const a = stubActions({ allowed: false });
        expect(onLocationClick(H, { locationName: 'chest', regionName: 'Field' }, opts({ addLocationsToPath: true }), {}, { actions: a })).toEqual({ refused: 'discovery' });
        expect(a.names()).toEqual(['locationChecksAllowed']);
    });

    it('Add locations to path: the region\'s moves (same precedence), THEN the path location check — no dispatch', () => {
        const a = stubActions();
        onLocationClick(H, { locationName: 'chest', regionName: 'Field' }, opts({ addLocationsToPath: true }), {}, { actions: a, showAll: () => {} });
        expect(a.names()).toEqual(['locationChecksAllowed', 'addToPath', 'addLocationCheckToPath']);
        expect(a.calls.at(-1)).toEqual(['addLocationCheckToPath', H, 'chest', 'Field']);
        const b = stubActions();
        onLocationClick(H, { locationName: 'chest', regionName: 'Field' }, opts({ addLocationsToPath: true, addToPath: false }), {}, { actions: b, showAll: () => {} });
        expect(b.names()).toEqual(['locationChecksAllowed', 'moveDirectly', 'addLocationCheckToPath']);
    });
});

describe('⛓ the payloads are the Region Graph\'s byte for byte, but for the strings (real regionActions)', () => {
    const staticData = { regions: new Map([
        ['Menu', { locations: [], exits: [{ name: 'Go', connected_region: 'Field' }] }],
        ['Field', { locations: [{ name: 'chest' }, { name: 'locked', access_rule: { ok: false } }] }],
    ]) };
    const pathFinder = {
        stateManager: { getStaticData: () => staticData, getLatestStateSnapshot: () => ({}) },
        findPath: () => ({ steps: ['Menu', 'Field'], nextExit: 'Go', length: 1 }),
        findPathWithExits: () => ({ steps: [{ region: 'Menu' }, { region: 'Field', exitUsed: 'Go' }], length: 1 }),
        buildAccessibilityMap: () => ({}),
        findExitBetweenRegions: () => 'Go',
    };
    const handles = () => ({
        dispatcher: { publish: vi.fn() }, eventBus: { publish: vi.fn() }, pathFinder,
        stateManager: { getStaticData: () => staticData, getLatestStateSnapshot: () => ({ checkedLocations: [] }), getStartRegions: () => ['Menu'] },
        gameState: { getCurrentRegion: () => 'Menu', getPath: () => [] },
        getRules: () => ({ rules: null, playerId: '1' }), restart: () => null,
    });

    it('every move and check, with the Region Graph\'s source/originator swapped in, equals its payload', () => {
        const h = handles();
        const all = opts({ addToPath: false, movePlayerOneStep: true, movePlayerDirectly: true, checkAllLocationsInRegion: true });
        onRegionClick(h, 'Field', all, {}, { actions: realActions, showAll: () => {} });
        onLocationClick(h, { locationName: 'chest', regionName: 'Field' }, opts(), {}, { actions: realActions });
        onRegionClick(h, 'Field', opts({ showRegionInPanel: false }), {}, { actions: realActions, showAll: () => {} });
        const RG = { ...Object.fromEntries(Object.keys(REGION_MAP_SOURCES).map((k) => [REGION_MAP_SOURCES[k], REGION_GRAPH_SOURCES[k]])),
            ...Object.fromEntries(Object.keys(REGION_MAP_ORIGINATORS).map((k) => [REGION_MAP_ORIGINATORS[k], REGION_GRAPH_ORIGINATORS[k]])) };
        const asRG = h.dispatcher.publish.mock.calls.map(([ev, p, t]) => [ev, { ...p, ...(p.source ? { source: RG[p.source] } : {}),
            ...(p.originator ? { originator: RG[p.originator] } : {}) }, t]);
        // The Region Graph's own payloads (regionGraph/regionGraphDispatch.test.js).
        expect(asRG).toEqual([
            ['user:regionMove', { sourceRegion: 'Menu', sourceUID: undefined, targetRegion: 'Field', exitName: 'Go',
                updatePath: false, source: 'regionGraph-oneStep' }, 'bottom'],
            ['user:regionMove', { sourceRegion: 'Menu', sourceUID: undefined, targetRegion: 'Field', exitName: 'Go',
                updatePath: false, source: 'regionGraph-direct' }, 'bottom'],
            ['user:locationCheck', { locationName: 'chest', regionName: 'Field', originator: 'RegionGraphBulkCheck',
                originalDOMEvent: true }, { initialTarget: 'bottom' }],
            ['user:locationCheck', { locationName: 'chest', regionName: 'Field', originator: 'RegionGraphCheck',
                originalDOMEvent: true }, { initialTarget: 'bottom' }],
            ['user:regionMove', { targetRegion: 'Field', sourceRegion: 'Menu', source: 'regionGraph-addToPath' },
                { initialTarget: 'bottom' }],
        ]);
        expect(h.eventBus.publish.mock.calls.map((c) => c[0])).toEqual(
            ['regionMap:nodeSelected', 'ui:activatePanel', 'ui:navigateToRegion', 'regionMap:nodeSelected']);
    });
});

describe('regionOfCell', () => {
    it('the cell key when it is a member (a level and its sub-regions), else the first member', () => {
        expect(regionOfCell('L1', ['L1:a', 'L1', 'L1:b'])).toBe('L1');
        expect(regionOfCell('level-3', ['L3 top', 'L3 bottom'])).toBe('L3 top');
        expect(regionOfCell('Solo', [])).toBe('Solo');
    });
});
