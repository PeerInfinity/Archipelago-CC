/**
 * ⚠ DISPATCHER SENDERS ARE PER MODULE (region map step 2, D3). The shared actions moved into
 * `regionView/regionActions.js`; the Region Graph must still dispatch through ITS OWN dispatcher — the
 * `moduleDispatcher` that `regionGraph/index.js` takes from `initializationApi.getDispatcher()` for the module id
 * that registered the `user:regionMove` / `user:locationCheck` senders — with its byte-identical originator strings.
 * Since CA-S2 a click runs the panel's click actions (`regionView/clickActions.js` `runClickActions`) over
 * `ui.clickActions`; its path moves carry `regionView-path-regionGraph` (R7) instead of the four `regionGraph-*`
 * sources. These rows drive the ADOPTED handlers, with the real `regionActions`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const regionGraphDispatcher = { id: 'regionGraph', publish: vi.fn() };
const bus = { publish: vi.fn() };
vi.mock('./index.js', () => ({
    moduleDispatcher: regionGraphDispatcher,
    getModuleEventBus: () => bus,
    getNodeLabelProvider: () => null,
}));
const staticData = { regions: new Map([
    ['Menu', { locations: [], exits: [{ name: 'Go', connected_region: 'Field' }] }],
    ['Field', { locations: [{ name: 'chest' }, { name: 'locked', access_rule: { ok: false } }] }],
]) };
vi.mock('../stateManager/index.js', () => ({
    stateManagerProxySingleton: {
        getStaticData: () => staticData,
        getLatestStateSnapshot: () => ({ checkedLocations: [] }),
        getStartRegions: () => ['Menu'],
    },
    getLastRawJsonData: () => null,
}));
vi.mock('../gameState/singleton.js', () => ({ getGameStateSingleton: () => ({ getCurrentRegion: () => 'Menu', getPath: () => [] }) }));
vi.mock('../discovery/singleton.js', () => ({ default: {} }));
vi.mock('../../app/core/centralRegistry.js', () => ({ centralRegistry: { getPublicFunction: () => null } }));
vi.mock('../../app/core/settingsManager.js', () => ({ default: { getSetting: async (k, d) => d } }));
vi.mock('../shared/snapshotInterface.js', () => ({ createSnapshotInterface: () => ({}) }));
vi.mock('../shared/ruleEngine.js', () => ({ evaluateRule: (rule) => rule.ok }));

const { NavigationManager } = await import('./navigationManager.js');
const { GraphInteractionManager } = await import('./graphInteractionManager.js');
const CA = await import('../regionView/clickActions.js');

const pathFinder = {
    stateManager: { getStaticData: () => staticData, getLatestStateSnapshot: () => ({}) },
    findPath: () => ({ steps: ['Menu', 'Field'], nextExit: 'Go', length: 1 }),
    findPathWithExits: () => ({ steps: [{ region: 'Menu' }, { region: 'Field', exitUsed: 'Go' }], length: 1 }),
    buildAccessibilityMap: () => ({}),
    findExitBetweenRegions: () => 'Go',
};

/** A Region Graph `ui` with the given click settings; `statuses` records the status bar. */
function makeUi(clickActions, { discovery = { active: false, settings: {} } } = {}) {
    const ui = {
        pathFinder, statuses: [], updateStatus: (t) => ui.statuses.push(t),
        cy: { $: () => ({ removeClass: () => {} }), nodes: () => [], edges: () => [] },
        isDiscoveryModeActive: discovery.active, discoverySettings: discovery.settings, clickActions,
    };
    ui.navigationManager = new NavigationManager(ui);
    return ui;
}
const regionNode = (id) => ({ id: () => id, data: () => ({ id }), addClass: () => {} });
const locationNode = (name, parent) => ({ data: (k) => ({ locationName: name, label: name, parentRegion: parent })[k] });
const withRegion = (region) => ({ ...CA.defaultClickActions(), region: { ...CA.defaultClickActions().region, ...region } });
const SRC = 'regionView-path-regionGraph';

beforeEach(() => {
    CA.resetClickActionsForTests();
    regionGraphDispatcher.publish.mockClear();
    bus.publish.mockClear();
});

describe('the Region Graph dispatches through its own module dispatcher (adopted handlers, CA-S2)', () => {
    it('route from the player: a direct user:regionMove, target "bottom", source regionView-path-regionGraph', () => {
        const ui = makeUi(withRegion({ [CA.BUILT_IN_IDS.route]: { from: 'player' }, 'regions.open': false }));
        new GraphInteractionManager(ui).handleRegionNodeClick(regionNode('Field'));
        expect(regionGraphDispatcher.publish.mock.calls).toEqual([
            ['user:regionMove', { sourceRegion: 'Menu', sourceUID: undefined, targetRegion: 'Field', exitName: 'Go',
                updatePath: false, source: SRC }, 'bottom'],
        ]);
        expect(ui.statuses).toEqual(['Moving directly to Field']);
    });

    it('the default click with no path yet: one user:regionMove (extend the path), after regionView:regionClicked', () => {
        const ui = makeUi(CA.defaultClickActions());
        new GraphInteractionManager(ui).handleRegionNodeClick(regionNode('Field'));
        expect(regionGraphDispatcher.publish.mock.calls).toEqual([
            ['user:regionMove', { targetRegion: 'Field', sourceRegion: 'Menu', source: SRC }, { initialTarget: 'bottom' }],
        ]);
        // CA-S4: the generic click event, before any action. CA-S5: it is the FIRST publish (no regionGraph:nodeSelected).
        expect(bus.publish.mock.calls[0]).toEqual(['regionView:regionClicked', { panelId: 'regionGraph', regionName: 'Field' }]);
    });

    it('location checks: RegionGraphCheck (a location click) and RegionGraphBulkCheck (accessible ones only)', () => {
        const ui = makeUi(withRegion({ [CA.BUILT_IN_IDS.route]: false, [CA.BUILT_IN_IDS.checkAll]: true, 'regions.open': false }));
        const im = new GraphInteractionManager(ui);
        im.handleLocationNodeClick(locationNode('chest', 'Field'));
        im.handleRegionNodeClick(regionNode('Field'));
        expect(regionGraphDispatcher.publish.mock.calls).toEqual([
            ['user:locationCheck', { locationName: 'chest', regionName: 'Field', originator: 'RegionGraphCheck',
                originalDOMEvent: true }, { initialTarget: 'bottom' }],
            ['user:locationCheck', { locationName: 'chest', regionName: 'Field', originator: 'RegionGraphBulkCheck',
                originalDOMEvent: true }, { initialTarget: 'bottom' }],
        ]);
    });

    it('discovery\'s disableLocationCheckUI still stops both checks', () => {
        const ui = makeUi(withRegion({ [CA.BUILT_IN_IDS.route]: false, [CA.BUILT_IN_IDS.checkAll]: true }),
            { discovery: { active: true, settings: { disableLocationCheckUI: true } } });
        const im = new GraphInteractionManager(ui);
        im.handleRegionNodeClick(regionNode('Field'));
        im.handleLocationNodeClick(locationNode('chest', 'Field'));
        expect(regionGraphDispatcher.publish).not.toHaveBeenCalled();
    });

    it('the master switch off: no move, no check, no Regions-panel publish; the generic click events are still published', () => {
        const ui = makeUi({ ...withRegion({ [CA.BUILT_IN_IDS.checkAll]: true }), enabled: false });
        CA.registerClickAction({ id: 'regions.open', owner: 'regions', target: 'region', kind: 'toggle',
            run: (h, ctx) => { h.eventBus.publish('ui:navigateToRegion', { regionName: ctx.regionName }); return { ok: true }; } });
        const im = new GraphInteractionManager(ui);
        expect(im.handleRegionNodeClick(regionNode('Field'))).toEqual({ ran: false, reason: 'disabled', results: [], skipped: [] });
        im.handleLocationNodeClick(locationNode('chest', 'Field'));
        expect(regionGraphDispatcher.publish).not.toHaveBeenCalled();
        // CA-S4: the generic click events are published too, master off included (as the Region Map's are).
        expect(bus.publish.mock.calls).toEqual([
            ['regionView:regionClicked', { panelId: 'regionGraph', regionName: 'Field' }],
            ['regionView:locationClicked', { panelId: 'regionGraph', regionName: 'Field', locationName: 'chest' }]]);
        // Switched on, the same click runs the registered panel action on the Graph's own bus.
        ui.clickActions = { ...ui.clickActions, enabled: true };
        im.handleRegionNodeClick(regionNode('Field'));
        expect(bus.publish.mock.calls.map((c) => c[0])).toContain('ui:navigateToRegion');
    });
});

// ⛓ CA-S5: the bus recorder, master on AND off — the Graph publishes no `*:nodeSelected` (regionGraph:nodeSelected is
// retired) and exactly ONE generic event per click, first. The overlay card's body click is pinned the same way in
// `nodeOverlayClick.test.js` (AN-3b's exactly-once).
describe('CA-S5: no regionGraph:nodeSelected; one generic event per click', () => {
    for (const enabled of [true, false]) {
        it(`master ${enabled ? 'on' : 'off'}: a region tap and a location tap`, () => {
            const ui = makeUi({ ...CA.defaultClickActions(), enabled });
            const im = new GraphInteractionManager(ui);
            for (const [click, generic] of [
                [() => im.handleRegionNodeClick(regionNode('Field')),
                    ['regionView:regionClicked', { panelId: 'regionGraph', regionName: 'Field' }]],
                [() => im.handleLocationNodeClick(locationNode('chest', 'Field')),
                    ['regionView:locationClicked', { panelId: 'regionGraph', regionName: 'Field', locationName: 'chest' }]],
            ]) {
                bus.publish.mockClear();
                click();
                const calls = bus.publish.mock.calls;
                expect(calls.filter(([ev]) => /:nodeSelected$/.test(ev))).toEqual([]);
                expect(calls.filter(([ev]) => ev.startsWith('regionView:'))).toEqual([generic]);
                expect(calls[0]).toEqual(generic);
            }
            expect(ui.selectedNode).toBe('Field'); // the SELECTION stays; only the event went
        });
    }
});
