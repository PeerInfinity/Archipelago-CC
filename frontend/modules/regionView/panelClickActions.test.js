/**
 * ⛓ CA-S4: THE PANEL-OWNED CLICK ACTIONS (mode-toggle design §4.2) and the generic click event's listeners (§4.3).
 *   1. the registry's CA-S4 fields: `initial(panelId)` (`effectiveValue`, `withInitialValues`), `offeredTo(panelId)`
 *      (a panel never offers to centre itself), `ORDER.select` (before the path), `withoutPerPanelInitials`;
 *   2. the strip: lists only what is offered to its panel, shows an unnamed action by its initial value, and `seed()`
 *      writes the initial values ONCE (and, after the host's first seed, a newly registered action's);
 *   3. each action's registration, first values (Graph = today, Map = OFF) and run: `discovery.discover` (gated by the
 *      settings bundle, loop mode's `clickDiscoversRegion: false` included), `regions.scrollTo`, `regionGraph.centre`,
 *      `regionMap.centre`;
 *   4. apcalc and vibeCodingSim hear `regionView:regionClicked` from the Region Graph and IGNORE the Region Map.
 * (Flash's teleport: `flashPanel/flashClickActions.test.js`.)
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { FakeElement } from '../procgenCore/fakeEditorDom.testkit.js';

const CA = await import('./clickActions.js');
const UI = await import('./clickActionsUI.js');
const { makeDiscoverAction } = await import('../discovery/discoveryClickActions.js');
const { REGIONS_SCROLL_TO_ACTION, REGIONS_OPEN_ACTION } = await import('../regions/regionsClickActions.js');
const { makeRegionGraphCentreAction } = await import('../regionGraph/regionGraphCentreAction.js');
const { makeRegionMapCentreAction } = await import('../regionMap/regionMapClickActions.js');

const ID = CA.PANEL_ACTION_IDS;
const doc = { createElement: (t) => new FakeElement(t) };
const bare = () => ({ enabled: true, region: {}, location: {} });
const toggle = (id, extra = {}) => ({ id, owner: id.split('.')[0], target: 'region', kind: 'toggle', run: () => ({ ok: true }), ...extra });

beforeEach(() => CA.resetClickActionsForTests());
afterAll(() => CA.resetClickActionsForTests());

describe('1. the registry\'s CA-S4 fields', () => {
    it('initial: absent → initial(panelId); named (even false) → the stored value', () => {
        const d = CA.registerClickAction(toggle('t.a', { initial: (p) => p === 'regionGraph' }));
        expect(CA.effectiveValue(d, 'regionGraph', {})).toBe(true);
        expect(CA.effectiveValue(d, 'regionMap', {})).toBe(false);
        expect(CA.effectiveValue(d, 'regionGraph', { 't.a': false })).toBe(false);
        const plain = CA.registerClickAction(toggle('t.b'));
        expect(CA.effectiveValue(plain, 'regionGraph', {})).toBeUndefined();
    });

    it('withInitialValues adds only the missing, offered ids with a defined initial; nothing else moves', () => {
        CA.registerClickAction(toggle('t.a', { initial: () => true }));
        CA.registerClickAction(toggle('t.b', { initial: () => undefined }));
        CA.registerClickAction(toggle('t.c', { initial: () => true, offeredTo: (p) => p !== 'regionGraph' }));
        const s = { enabled: true, region: { 'path.route': { from: 'player' }, 'x.unknown': true }, location: {} };
        const { settings, added } = CA.withInitialValues('regionGraph', s);
        expect(added).toEqual([{ target: 'region', id: 't.a', value: true }]);
        expect(settings).toEqual({ enabled: true, region: { 'path.route': { from: 'player' }, 'x.unknown': true, 't.a': true }, location: {} });
        expect(s.region['t.a']).toBeUndefined(); // the input is not mutated
        const again = CA.withInitialValues('regionGraph', settings);
        expect(again.added).toEqual([]);
        expect(again.settings).toBe(settings);
    });

    it('offeredTo: an action not offered to a panel is neither listed nor run there, and not reported as unloaded', () => {
        const ran = [];
        CA.registerClickAction(toggle('t.x', { offeredTo: (p) => p !== 'regionGraph', run: (h, ctx) => { ran.push(ctx.panelId); return { ok: true }; } }));
        expect(CA.listClickActions('region', 'regionGraph').map((d) => d.id)).not.toContain('t.x');
        expect(CA.listClickActions('region', 'regionMap').map((d) => d.id)).toContain('t.x');
        expect(CA.listClickActions('region').map((d) => d.id)).toContain('t.x');
        const s = { enabled: true, region: { 't.x': true }, location: {} };
        expect(CA.runClickActions('regionGraph', 'region', { regionName: 'R' }, s, {})).toEqual({ ran: true, results: [], skipped: [] });
        CA.runClickActions('regionMap', 'region', { regionName: 'R' }, s, {});
        expect(ran).toEqual(['regionMap']);
    });

    it('ORDER.select runs before the path, and the panel actions after the checks', () => {
        const order = [];
        CA.resetClickActionsForTests();
        CA.unregisterClickAction(CA.BUILT_IN_IDS.route);
        CA.unregisterClickAction(CA.BUILT_IN_IDS.checkAll);
        CA.registerClickAction(toggle('p.panel', { run: () => { order.push('panel'); return { ok: true }; } }));
        CA.registerClickAction(toggle('p.path', { order: CA.ORDER.path, run: () => { order.push('path'); return { ok: true }; } }));
        CA.registerClickAction(toggle('p.select', { order: CA.ORDER.select, run: () => { order.push('select'); return { ok: true }; } }));
        CA.runClickActions('regionGraph', 'region', { regionName: 'R' },
            { enabled: true, region: { 'p.panel': true, 'p.path': true, 'p.select': true } }, {});
        expect(order).toEqual(['select', 'path', 'panel']);
        expect(CA.ORDER.select).toBeLessThan(CA.ORDER.path);
    });

    it('withoutPerPanelInitials drops exactly the PANEL_ACTION_IDS', () => {
        const all = Object.values(ID);
        expect(all.sort()).toEqual(['discovery.discover', 'flash.teleport', 'flash.teleportLocation', 'regionGraph.centre',
            'regionMap.centre', 'regions.scrollTo']);
        const s = { enabled: false, region: Object.fromEntries([...all, 'regions.open', 'path.route', 'zz.other'].map((k) => [k, true])),
            location: Object.fromEntries([...all, 'path.check'].map((k) => [k, 'now'])) };
        expect(CA.withoutPerPanelInitials(s)).toEqual({ enabled: false,
            region: { 'regions.open': true, 'path.route': true, 'zz.other': true }, location: { 'path.check': 'now' } });
    });

    it('isClickFromPanel and the event names', () => {
        expect(CA.REGION_CLICKED).toBe('regionView:regionClicked');
        expect(CA.LOCATION_CLICKED).toBe('regionView:locationClicked');
        expect(CA.isClickFromPanel({ panelId: 'regionGraph' }, 'regionGraph')).toBe(true);
        expect(CA.isClickFromPanel({ panelId: 'regionMap' }, 'regionGraph')).toBe(false);
        expect(CA.isClickFromPanel(null, 'regionGraph')).toBe(false);
    });
});

describe('2. the strip, per panel', () => {
    function mount(panelId, settings) {
        const state = { settings, saved: [] };
        const strip = UI.mountClickActionsStrip({ panelId, container: new FakeElement('div'), doc,
            getSettings: () => state.settings,
            saveSettings: (next, opts) => { state.saved.push([next, opts]); state.settings = next; } });
        return { strip, state };
    }
    const rowIds = (strip) => {
        const out = [];
        const walk = (n) => { for (const c of n.children) { if (c.dataset?.actionId && c.className.includes(UI.STRIP.row)) out.push(c.dataset.actionId); walk(c); } };
        walk(strip.element);
        return out;
    };

    it('lists only what is offered to the panel; the summary shows an unnamed action by its initial value', () => {
        CA.registerClickAction(makeRegionGraphCentreAction(() => []));
        CA.registerClickAction(makeRegionMapCentreAction(() => []));
        CA.registerClickAction(makeDiscoverAction(() => ({ ok: true })));
        const g = mount('regionGraph', bare());
        const m = mount('regionMap', bare());
        g.strip.setExpanded(true);
        m.strip.setExpanded(true);
        expect(rowIds(g.strip)).toContain(ID.mapCentre);
        expect(rowIds(g.strip)).not.toContain(ID.graphCentre);
        expect(rowIds(m.strip)).toContain(ID.graphCentre);
        expect(rowIds(m.strip)).not.toContain(ID.mapCentre);
        expect(UI.summarizeClickActions(bare(), 'regionGraph')).toBe('On click: discover');
        expect(UI.summarizeClickActions(bare(), 'regionMap')).toBe('On click: nothing');
        expect(UI.summarizeClickActions({ ...bare(), region: { [ID.discover]: false } }, 'regionGraph')).toBe('On click: nothing');
    });

    it('seed() writes the initial values once (a seeded save), and nothing before the host calls it', () => {
        const g = mount('regionGraph', bare());
        CA.registerClickAction(makeDiscoverAction(() => ({ ok: true })));
        expect(g.state.saved).toEqual([]); // not loaded yet: a registration does not seed
        expect(g.strip.seed()).toEqual([{ target: 'region', id: ID.discover, value: true }]);
        expect(g.state.saved).toEqual([[{ ...bare(), region: { [ID.discover]: true } }, { seeded: true }]]);
        expect(g.strip.seed()).toEqual([]);
        expect(g.state.saved).toHaveLength(1);
        // after the host's first seed, a NEW registration is seeded at once (the Map's centre, off)
        CA.registerClickAction(makeRegionMapCentreAction(() => []));
        expect(g.state.saved).toHaveLength(2);
        expect(g.state.settings.region[ID.mapCentre]).toBe(false);
        // a stored value is never re-seeded: the user's choice decides
        g.state.settings = { ...g.state.settings, region: { ...g.state.settings.region, [ID.discover]: false } };
        expect(g.strip.seed()).toEqual([]);
        g.strip.destroy();
    });

    it('the Map seeds every CA-S4 action OFF', () => {
        CA.registerClickAction(makeDiscoverAction(() => ({ ok: true })));
        CA.registerClickAction(REGIONS_SCROLL_TO_ACTION);
        CA.registerClickAction(makeRegionGraphCentreAction(() => []));
        const m = mount('regionMap', bare());
        m.strip.seed();
        expect(m.state.settings).toEqual({ enabled: true, region: { [ID.discover]: false, [ID.graphCentre]: false },
            location: { [ID.regionsScrollTo]: false } });
    });
});

describe('3. the actions', () => {
    it('discovery.discover: Graph ON / Map OFF; runs Discovery\'s own handler, before the path', () => {
        const calls = [];
        const d = CA.registerClickAction(makeDiscoverAction((e) => { calls.push(e); return { ok: true, discovered: true }; }));
        expect(d.initial('regionGraph')).toBe(true);
        expect(d.initial('regionMap')).toBe(false);
        expect(d.order).toBe(CA.ORDER.select);
        const r = CA.runClickActions('regionGraph', 'region', { regionName: 'Cave' }, bare(), {});
        expect(r.results).toEqual([{ id: ID.discover, owner: 'discovery', result: { ok: true, discovered: true } }]);
        expect(calls).toEqual([{ regionName: 'Cave' }]);
        CA.runClickActions('regionMap', 'region', { regionName: 'Cave' }, bare(), {});
        expect(calls).toHaveLength(1);
    });

    // The settings-bundle gate (loop mode's clickDiscoversRegion: false): `discovery/discoveryClickActions.test.js`.

    it('regions.scrollTo: a location click activates the Regions panel and publishes ui:navigateToLocation; OFF to start', () => {
        CA.registerClickAction(REGIONS_SCROLL_TO_ACTION);
        expect(REGIONS_SCROLL_TO_ACTION.initial('regionGraph')).toBe(false);
        expect(REGIONS_SCROLL_TO_ACTION.initial('regionMap')).toBe(false);
        const pub = [];
        const h = { eventBus: { publish: (...a) => pub.push(a) } };
        CA.runClickActions('regionMap', 'location', { regionName: 'R', locationName: 'L' },
            { enabled: true, region: {}, location: { [ID.regionsScrollTo]: true } }, h);
        expect(pub).toEqual([['ui:activatePanel', { panelId: 'regionsPanel' }], ['ui:navigateToLocation', { regionName: 'R', locationName: 'L' }]]);
        expect(REGIONS_OPEN_ACTION.initial).toBeUndefined(); // regions.open keeps its migrated value (CA-S2)
    });

    it('regionGraph.centre: offered to the Map only, OFF, centres every live Graph that draws the region', () => {
        const animated = [];
        const node = (empty) => ({ empty: () => empty });
        const ui = { cy: { getElementById: (id) => node(id !== 'R'), zoom: () => 0.5, animate: (a) => animated.push(a) } };
        const d = CA.registerClickAction(makeRegionGraphCentreAction(() => [ui]));
        expect(d.offeredTo('regionGraph')).toBe(false);
        expect(d.offeredTo('regionMap')).toBe(true);
        expect(d.initial('regionMap')).toBe(false);
        const on = { enabled: true, region: { [ID.graphCentre]: true } };
        expect(CA.runClickActions('regionMap', 'region', { regionName: 'R' }, on, {}).results[0].result).toEqual({ ok: true, centred: 1 });
        expect(animated).toHaveLength(1);
        expect(animated[0].zoom).toBe(1);
        expect(CA.runClickActions('regionMap', 'region', { regionName: 'Q' }, on, {}).results[0].result).toEqual({ ok: false, reason: 'not-drawn' });
        expect(CA.runClickActions('regionGraph', 'region', { regionName: 'R' }, on, {}).results).toEqual([]);
    });

    it('regionMap.centre: offered to the Graph only, OFF, asks every live Map panel to centre', () => {
        const asked = [];
        const p = { centreOnRegion: (r) => { asked.push(r); return r === 'R'; } };
        const d = CA.registerClickAction(makeRegionMapCentreAction(() => [p]));
        expect(d.offeredTo('regionMap')).toBe(false);
        expect(d.offeredTo('regionGraph')).toBe(true);
        expect(d.initial('regionGraph')).toBe(false);
        const on = { enabled: true, region: { [ID.mapCentre]: true } };
        expect(CA.runClickActions('regionGraph', 'region', { regionName: 'R' }, on, {}).results[0].result).toEqual({ ok: true, centred: 1 });
        expect(CA.runClickActions('regionMap', 'region', { regionName: 'R' }, on, {}).results).toEqual([]);
        expect(asked).toEqual(['R']);
    });
});

describe('4. apcalc and vibeCodingSim hear the Region Graph\'s generic click, never the Map\'s', () => {
    async function boot(path) {
        const subs = new Map();
        const api = {
            getEventBus: () => ({ subscribe: (n, fn) => { subs.set(n, fn); return () => {}; }, publish: () => {} }),
            getDispatcher: () => ({ publish: () => {} }),
            getModuleFunction: () => null,
        };
        const mod = await import(path);
        await mod.initialize('m', 0, api);
        return { mod, subs };
    }

    it('apcalc: a Graph click filters its paths; a Map click is ignored; it no longer subscribes to regionGraph:nodeSelected', async () => {
        const { mod, subs } = await boot('../apcalc/index.js');
        const seen = [];
        mod.setPanelInstance({ setPathFilter: (r) => seen.push(r), render() {} });
        expect(subs.has('regionGraph:nodeSelected')).toBe(false);
        const fn = subs.get(CA.REGION_CLICKED);
        fn({ panelId: 'regionMap', regionName: 'B' });
        fn({ panelId: 'regionGraph', regionName: 'A' });
        expect(seen).toEqual(['A']);
        mod.setPanelInstance(null);
    });

    it('vibeCodingSim: a Graph click selects the feature; a Map click is ignored', async () => {
        const { mod, subs } = await boot('../vibeCodingSim/index.js');
        const seen = [];
        mod.setPanelInstance({ selectFeatureByRegion: (r) => seen.push(r) });
        expect(subs.has('regionGraph:nodeSelected')).toBe(false);
        const fn = subs.get(CA.REGION_CLICKED);
        fn({ panelId: 'regionMap', regionName: 'Complete Node 2' });
        fn({ panelId: 'regionGraph', regionName: 'Complete Node 3' });
        expect(seen).toEqual(['Complete Node 3']);
        mod.setPanelInstance(null);
    });
});
