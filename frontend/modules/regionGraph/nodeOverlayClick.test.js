/**
 * nodeOverlayClick.test.js — the overlay card's body click (slice AN-3b). Harness copied from regionGraphDispatch.test.js.
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
const { NodeOverlayManager } = await import('./nodeOverlayManager.js');

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

beforeEach(() => {
    CA.resetClickActionsForTests();
    regionGraphDispatcher.publish.mockClear();
    bus.publish.mockClear();
});

/**
 * ⚖ overlay card click → runClickActions (planner ruling 2026-11-20, archipelago-cc-23's option 1; slice AN-3b).
 * A click on an overlay card's BODY clicks the node like a bare node: `handleRegionNodeClick` publishes
 * `regionView:regionClicked` ({ panelId: 'regionGraph', regionName }) ONCE and runs the panel's click actions ONCE
 * (until CA-S5 retired it, `regionGraph:nodeSelected` was the event counted here; it is now published never). A BUTTON inside the card
 * is the card's own. These hold for any provider's card (ActionNodes', vibeCodingSim's): the listener is the overlay
 * manager's, not the provider's.
 * The forwarded mousedown (the card → the canvas, for dragging) adding no second run is MEASURED with a real mouse
 * (Playwright, the AN-3b report): one nodeSelected and one strip run per click, centre and corner, where the base gave
 * one nodeSelected and NO strip run.
 */

/** A minimal element: listeners and a tag. */
function fakeEl(tagName = 'DIV') {
    const el = { tagName, listeners: {}, style: {}, dataset: {},
        addEventListener(t, fn) { (el.listeners[t] ??= []).push(fn); } };
    return el;
}
const click = (el, target = el) => { for (const fn of el.listeners.click ?? []) fn({ target }); };

function overlayFor(ui, nodeId) {
    const om = new NodeOverlayManager(ui);
    const el = fakeEl();
    om._attachInteractionHandlers(el, nodeId, regionNode(nodeId));
    return el;
}
const counting = () => {
    const runs = [];
    CA.registerClickAction({ id: 'probe.count', owner: 'probe', target: 'region', kind: 'toggle',
        run: (h, ctx) => { runs.push(ctx.regionName); return { ok: true }; } });
    return runs;
};
const settingsWith = (extra) => ({ ...withRegion({ [CA.BUILT_IN_IDS.route]: false, 'regions.open': false, 'probe.count': true }), ...extra });
const selected = () => bus.publish.mock.calls.filter(([e]) => e === 'regionView:regionClicked');
const nodeSelected = () => bus.publish.mock.calls.filter(([e]) => /:nodeSelected$/.test(e));

describe('⛓ an overlay card\'s body click is the node\'s click (AN-3b)', () => {
    for (const kind of ['an ActionNodes card', 'a vibeCodingSim card']) {
        it(`${kind}: regionView:regionClicked once with { panelId, regionName }, the strip once, no nodeSelected`, () => {
            const runs = counting();
            const ui = makeUi(settingsWith({}));
            ui.interactionManager = new GraphInteractionManager(ui);
            const el = overlayFor(ui, 'Field');
            click(el);
            expect(selected()).toEqual([['regionView:regionClicked', { panelId: 'regionGraph', regionName: 'Field' }]]);
            expect(nodeSelected()).toEqual([]);
            expect(runs).toEqual(['Field']);
        });
    }

    it('a BUTTON inside the card: neither the click event nor the strip', () => {
        const runs = counting();
        const ui = makeUi(settingsWith({}));
        ui.interactionManager = new GraphInteractionManager(ui);
        const el = overlayFor(ui, 'Field');
        click(el, fakeEl('BUTTON'));
        expect(selected()).toEqual([]);
        expect(runs).toEqual([]);
    });

    it('the master switch off: no action runs; regionView:regionClicked is still published once, no nodeSelected', () => {
        const runs = counting();
        const ui = makeUi(settingsWith({ enabled: false }));
        ui.interactionManager = new GraphInteractionManager(ui);
        click(overlayFor(ui, 'Field'));
        expect(selected()).toEqual([['regionView:regionClicked', { panelId: 'regionGraph', regionName: 'Field' }]]);
        expect(nodeSelected()).toEqual([]);
        expect(runs).toEqual([]);
        expect(regionGraphDispatcher.publish).not.toHaveBeenCalled();
    });
});
