/**
 * regionMapClickActions — the Region Map's click settings and click path (slice CA-S3):
 *   1. the FIRST-RUN COPY (⚖ R4, js-21 edit 1): the Map's `clickActions`, never written, = the Region Graph's RESOLVED
 *      config through the Graph's own loader — its stored `clickActions`; else the migration of the old keys; else the
 *      defaults — saved ONCE. A stored Map config is never overwritten; a second load writes nothing;
 *   2. independence: a Graph strip save never touches the Map's key, and a Map strip save writes the Map's key only
 *      (and, since CA-S4, a Graph save writes no `addLocationsToPath` mirror either);
 *   2b. CA-S4: the copy leaves out the panel-owned actions (`PANEL_ACTION_IDS`), whose first value is per panel;
 *   3. the generic click events' payloads, master switch off included;
 *   4. the schema entry.
 * The settings manager is a fake with getSetting's precedence (stored > schema default > call-site).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const M = await import('./regionMapClickActions.js');
const G = await import('../regionGraph/clickActionsSettings.js');
const CA = await import('../regionView/clickActions.js');
const { REGION_MAP_SETTINGS_SCHEMA, REGION_MAP_SETTING_DEFAULTS } = await import('./regionMapSettings.js');

const GRAPH_KEY = G.CLICK_ACTIONS_KEY;
const MAP_KEY = M.REGION_MAP_CLICK_ACTIONS_KEY;
const SCHEMA = { [GRAPH_KEY]: CA.defaultClickActions(), [MAP_KEY]: CA.defaultClickActions() };

function fakeSettings(tree = {}) {
    const writes = [];
    const lookup = (key) => {
        let cur = tree;
        for (const k of key.split('.')) {
            if (cur && typeof cur === 'object' && k in cur) cur = cur[k];
            else return { found: false };
        }
        return { found: true, value: cur };
    };
    return {
        writes, tree,
        async hasStoredSetting(key) { return lookup(key).found; },
        async getSetting(key, dflt) {
            const l = lookup(key);
            if (l.found) return l.value;
            if (key in SCHEMA) return structuredClone(SCHEMA[key]);
            return dflt;
        },
        async updateSetting(key, value) {
            writes.push([key, structuredClone(value)]);
            const ks = key.split('.');
            let cur = tree;
            for (const k of ks.slice(0, -1)) cur = (cur[k] ??= {});
            cur[ks.at(-1)] = value;
        },
    };
}

const GRAPH_STORED = { enabled: true, region: { 'path.route': { from: 'player' }, 'path.checkAll': true, 'regions.open': false,
    'actionNodes.act': true }, location: { 'path.check': 'addToPath' } };
/** CA-S4: the Graph's stored config WITH the panel-owned actions (their first value is per panel: not copied). */
const GRAPH_STORED_S4 = { enabled: true,
    region: { ...GRAPH_STORED.region, 'flash.teleport': true, 'discovery.discover': true, 'regionMap.centre': true },
    location: { ...GRAPH_STORED.location, 'flash.teleportLocation': true, 'regions.scrollTo': true } };

describe('⛓ the first-run copy of the Region Graph\'s RESOLVED config (⚖ R4; js-21 edit 1: all three sources)', () => {
    it('(1) the Graph\'s stored clickActions: copied as is (unknown ids kept), saved once; the Graph is not written', async () => {
        const sm = fakeSettings({ moduleSettings: { regionGraph: { clickActions: structuredClone(GRAPH_STORED), addToPath: true } } });
        const r = await M.loadRegionMapClickActions(sm);
        expect(r).toEqual({ clickActions: GRAPH_STORED, copied: true, graphMigrated: false });
        expect(sm.writes).toEqual([[MAP_KEY, GRAPH_STORED]]);
        // A deep COPY: an edit of one never moves the other.
        expect(sm.tree.moduleSettings.regionMap.clickActions).not.toBe(sm.tree.moduleSettings.regionGraph.clickActions);
        sm.tree.moduleSettings.regionGraph.clickActions.region['path.checkAll'] = false;
        expect(sm.tree.moduleSettings.regionMap.clickActions.region['path.checkAll']).toBe(true);
    });

    it('(2) no Graph clickActions, old keys stored (or preset-supplied): the Graph\'s migration of them, which the Graph also saves', async () => {
        const old = { addToPath: false, overwritePath: true, movePlayerDirectly: false, showRegionInPanel: false,
            checkAllLocationsInRegion: true, addLocationsToPath: true };
        const sm = fakeSettings({ moduleSettings: { regionGraph: { ...old } } });
        const r = await M.loadRegionMapClickActions(sm);
        const want = CA.migrateRegionGraphClickKeys(old);
        expect(r).toEqual({ clickActions: want, copied: true, graphMigrated: true });
        expect(sm.writes).toEqual([[GRAPH_KEY, want], [MAP_KEY, want]]);
    });

    it('(3) nothing stored: the defaults (= the migration of the old defaults = the schema default)', async () => {
        const sm = fakeSettings({ moduleSettings: {} });
        const r = await M.loadRegionMapClickActions(sm);
        expect(r.clickActions).toEqual(CA.defaultClickActions());
        expect(r.clickActions).toEqual(REGION_MAP_SETTINGS_SCHEMA.properties.clickActions.default);
        expect(sm.writes.map(([k]) => k)).toEqual([GRAPH_KEY, MAP_KEY]);
    });

    it('idempotent: a second (and third) load reads the Map\'s value and writes nothing', async () => {
        const sm = fakeSettings({ moduleSettings: { regionGraph: { clickActions: structuredClone(GRAPH_STORED) } } });
        await M.loadRegionMapClickActions(sm);
        const n = sm.writes.length;
        for (let i = 0; i < 2; i++) {
            expect(await M.loadRegionMapClickActions(sm)).toEqual({ clickActions: GRAPH_STORED, copied: false });
        }
        expect(sm.writes).toHaveLength(n);
    });

    it('a stored Map config is NEVER overwritten, whatever the Graph holds', async () => {
        const mine = { enabled: false, region: { 'path.route': false }, location: { 'path.check': 'now' } };
        const sm = fakeSettings({ moduleSettings: { regionMap: { clickActions: structuredClone(mine) },
            regionGraph: { clickActions: structuredClone(GRAPH_STORED) } } });
        for (let i = 0; i < 3; i++) expect(await M.loadRegionMapClickActions(sm)).toEqual({ clickActions: mine, copied: false });
        expect(sm.writes).toEqual([]);
    });

    it('a stored Map value that is not an object is not overwritten; the panel runs the defaults in memory', async () => {
        const sm = fakeSettings({ moduleSettings: { regionMap: { clickActions: 'garbage' } } });
        expect(await M.loadRegionMapClickActions(sm)).toEqual({ clickActions: CA.defaultClickActions(), copied: false });
        expect(sm.writes).toEqual([]);
    });
});

describe('⛓ CA-S4: the copy leaves out the panel-owned actions (⚖ user 2026-11-20T16:29:00Z: the Map\'s teleport starts OFF)', () => {
    it('every PANEL_ACTION_IDS id is dropped from the copy; every other id (an unknown one too) is kept', async () => {
        const sm = fakeSettings({ moduleSettings: { regionGraph: { clickActions: structuredClone(GRAPH_STORED_S4) } } });
        const r = await M.loadRegionMapClickActions(sm);
        expect(r.clickActions).toEqual(GRAPH_STORED);
        expect(sm.writes).toEqual([[MAP_KEY, GRAPH_STORED]]);
        // the Graph's own value is untouched
        expect(sm.tree.moduleSettings.regionGraph.clickActions).toEqual(GRAPH_STORED_S4);
    });
    it('a seeded save keeps a session override session-only; a plain save persists', async () => {
        const calls = [];
        const sm = { hasOverride: (k) => k === MAP_KEY, updateSetting: async (...a) => { calls.push(a); } };
        await M.saveRegionMapClickActions(sm, { enabled: true }, { seeded: true });
        await M.saveRegionMapClickActions(sm, { enabled: false });
        expect(calls).toEqual([[MAP_KEY, { enabled: true }, { persist: false }], [MAP_KEY, { enabled: false }]]);
        const sm2 = { hasOverride: () => false, updateSetting: async (...a) => { calls.push(a); } };
        await M.saveRegionMapClickActions(sm2, { enabled: true }, { seeded: true });
        expect(calls.at(-1)).toEqual([MAP_KEY, { enabled: true }]);
    });
});

describe('⛓ the two panels are independent once the copy is made (⚖ R4)', () => {
    it('a Graph strip save never writes the Map\'s key; a Map strip save writes the Map\'s key only (no mirror)', async () => {
        const sm = fakeSettings({ moduleSettings: {} });
        const { clickActions: map0 } = await M.loadRegionMapClickActions(sm);
        const n = sm.writes.length;
        const graphNext = { ...CA.defaultClickActions(), enabled: false, location: { 'path.check': 'addToPath' } };
        await G.saveRegionGraphClickActions(sm, graphNext);
        // CA-S4: the Graph's save writes its own key only (the addLocationsToPath mirror is retired)
        expect(sm.writes.slice(n).map(([k]) => k)).toEqual([GRAPH_KEY]);
        expect((await M.loadRegionMapClickActions(sm)).clickActions).toEqual(map0);
        const mapNext = { ...map0, location: { 'path.check': 'addToPath' } };
        const m = sm.writes.length;
        await M.saveRegionMapClickActions(sm, mapNext);
        expect(sm.writes.slice(m)).toEqual([[MAP_KEY, mapNext]]);
        expect((await sm.getSetting(GRAPH_KEY)).enabled).toBe(false);
    });
});

describe('⛓ the generic click events (design §4.3)', () => {
    const calls = [];
    const h = M.withClickHandles({
        eventBus: { publish: (ev, data) => calls.push([ev, data]) },
        dispatcher: { publish: (ev, data) => calls.push([`dispatch ${ev}`, data]) },
        stateManager: { getStaticData: () => ({ regions: new Map() }), getLatestStateSnapshot: () => ({}) },
        gameState: { getCurrentRegion: () => 'Field', getPath: () => [] },
        pathFinder: {},
    }, { showAll: () => {} });
    beforeAll(() => CA.resetClickActionsForTests());
    afterAll(() => CA.resetClickActionsForTests());

    it('a region click (master off): regionView:regionClicked { panelId, regionName } alone', () => {
        calls.length = 0;
        const off = { ...CA.defaultClickActions(), enabled: false };
        const r = M.runRegionMapClick(h, 'region', { regionName: 'Field' }, off);
        expect(calls).toEqual([
            ['regionView:regionClicked', { panelId: 'regionMap', regionName: 'Field' }],
        ]);
        expect(r.run).toMatchObject({ ran: false, reason: 'disabled' });
        expect(r.status).toBe(null);
    });

    // ⛓ CA-S5: the bus recorder, master on AND off — the Map publishes no `*:nodeSelected` (regionMap:nodeSelected is
    // retired), and exactly ONE generic event per click, first, before anything the actions publish or dispatch.
    for (const enabled of [true, false]) {
        it(`CA-S5, master ${enabled ? 'on' : 'off'}: a region click and a location click publish no *:nodeSelected, one generic event each, first`, () => {
            const settings = { ...CA.defaultClickActions(), enabled };
            for (const [target, click, generic] of [
                ['region', { regionName: 'Field' }, ['regionView:regionClicked', { panelId: 'regionMap', regionName: 'Field' }]],
                ['location', { regionName: 'Field', locationName: 'chest' },
                    ['regionView:locationClicked', { panelId: 'regionMap', regionName: 'Field', locationName: 'chest' }]],
            ]) {
                calls.length = 0;
                M.runRegionMapClick(h, target, click, settings, {});
                expect(calls.filter(([ev]) => /:nodeSelected$/.test(ev)), target).toEqual([]);
                expect(calls.filter(([ev]) => ev.startsWith('regionView:')), target).toEqual([generic]);
                expect(calls[0], target).toEqual(generic);
            }
        });
    }

    it('a location click: regionView:locationClicked { panelId, regionName, locationName }, then the check (originator regionMapCheck)', () => {
        calls.length = 0;
        const r = M.runRegionMapClick(h, 'location', { regionName: 'Field', locationName: 'chest' }, CA.defaultClickActions(), {});
        expect(calls[0]).toEqual(['regionView:locationClicked', { panelId: 'regionMap', regionName: 'Field', locationName: 'chest' }]);
        expect(calls[1][0]).toBe('dispatch user:locationCheck');
        expect(calls[1][1]).toMatchObject({ locationName: 'chest', regionName: 'Field', originator: 'regionMapCheck' });
        expect(r.run.results.map((x) => x.id)).toEqual(['path.check']);
    });

    it('master off still publishes the generic event (it reports the click, not what the click ran)', () => {
        calls.length = 0;
        M.runRegionMapClick(h, 'location', { regionName: 'Field', locationName: 'chest' }, { ...CA.defaultClickActions(), enabled: false });
        expect(calls).toEqual([['regionView:locationClicked', { panelId: 'regionMap', regionName: 'Field', locationName: 'chest' }]]);
    });

    it('the event names and the panel id', () => {
        expect([M.REGION_CLICKED, M.LOCATION_CLICKED, M.PANEL_ID]).toEqual(['regionView:regionClicked', 'regionView:locationClicked', 'regionMap']);
    });
});

describe('⛓ the schema entry', () => {
    it('clickActions is in the schema with default defaultClickActions(), and NOT among the view settings', () => {
        expect(REGION_MAP_SETTINGS_SCHEMA.properties.clickActions.default).toEqual(CA.defaultClickActions());
        expect(REGION_MAP_SETTINGS_SCHEMA.properties.clickActions.type).toBe('object');
        expect('clickActions' in REGION_MAP_SETTING_DEFAULTS).toBe(false);
        expect(MAP_KEY).toBe('moduleSettings.regionMap.clickActions');
    });

    it('regionOfCell: the cell key when it is a member (a level and its sub-regions), else the first member', () => {
        expect(M.regionOfCell('L1', ['L1:a', 'L1', 'L1:b'])).toBe('L1');
        expect(M.regionOfCell('level-3', ['L3 top', 'L3 bottom'])).toBe('L3 top');
        expect(M.regionOfCell('Solo', [])).toBe('Solo');
    });
});
