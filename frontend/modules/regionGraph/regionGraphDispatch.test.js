/**
 * ⚠ DISPATCHER SENDERS ARE PER MODULE (region map step 2, D3). The shared actions moved into
 * `regionView/regionActions.js`; the Region Graph must still dispatch through ITS OWN dispatcher — the
 * `moduleDispatcher` that `regionGraph/index.js` takes from `initializationApi.getDispatcher()` for the module id
 * that registered the `user:regionMove` / `user:locationCheck` senders — with its byte-identical source /
 * originator strings.
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

const pathFinder = {
    stateManager: { getStaticData: () => staticData, getLatestStateSnapshot: () => ({}) },
    findPath: () => ({ steps: ['Menu', 'Field'], nextExit: 'Go', length: 1 }),
    findPathWithExits: () => ({ steps: [{ region: 'Menu' }, { region: 'Field', exitUsed: 'Go' }], length: 1 }),
    buildAccessibilityMap: () => ({}),
    findExitBetweenRegions: () => 'Go',
};
const ui = { pathFinder, updateStatus: () => {}, cy: null, isDiscoveryModeActive: false, discoverySettings: {} };
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => { regionGraphDispatcher.publish.mockClear(); bus.publish.mockClear(); });

describe('the Region Graph dispatches through its own module dispatcher', () => {
    it('one step and direct moves: user:regionMove, target "bottom", its source strings', async () => {
        const nav = new NavigationManager(ui);
        // One at a time: under vitest, two concurrent `import('./index.js')` of the mocked module resolve once.
        nav.attemptMovePlayerOneStepToRegion('Field');
        await vi.waitFor(() => expect(regionGraphDispatcher.publish).toHaveBeenCalledTimes(1));
        nav.attemptMovePlayerDirectlyToRegion('Field');
        await vi.waitFor(() => expect(regionGraphDispatcher.publish).toHaveBeenCalledTimes(2));
        expect(regionGraphDispatcher.publish.mock.calls).toEqual([
            ['user:regionMove', { sourceRegion: 'Menu', sourceUID: undefined, targetRegion: 'Field', exitName: 'Go',
                updatePath: false, source: 'regionGraph-oneStep' }, 'bottom'],
            ['user:regionMove', { sourceRegion: 'Menu', sourceUID: undefined, targetRegion: 'Field', exitName: 'Go',
                updatePath: false, source: 'regionGraph-direct' }, 'bottom'],
        ]);
    });

    it('add to path with no path yet: one user:regionMove under regionGraph-addToPath', async () => {
        await new NavigationManager(ui).addToPath('Field');
        expect(regionGraphDispatcher.publish.mock.calls).toEqual([
            ['user:regionMove', { targetRegion: 'Field', sourceRegion: 'Menu', source: 'regionGraph-addToPath' },
                { initialTarget: 'bottom' }],
        ]);
    });

    it('location checks: RegionGraphCheck (single) and RegionGraphBulkCheck (accessible ones only)', async () => {
        const im = new GraphInteractionManager(ui);
        im.dispatchLocationCheckEvent('chest', 'Field');
        await vi.waitFor(() => expect(regionGraphDispatcher.publish).toHaveBeenCalledTimes(1));
        im.checkAllLocationsInRegion('Field');
        await vi.waitFor(() => expect(regionGraphDispatcher.publish).toHaveBeenCalledTimes(2));
        expect(regionGraphDispatcher.publish.mock.calls).toEqual([
            ['user:locationCheck', { locationName: 'chest', regionName: 'Field', originator: 'RegionGraphCheck',
                originalDOMEvent: true }, { initialTarget: 'bottom' }],
            ['user:locationCheck', { locationName: 'chest', regionName: 'Field', originator: 'RegionGraphBulkCheck',
                originalDOMEvent: true }, { initialTarget: 'bottom' }],
        ]);
    });

    it('discovery\'s disableLocationCheckUI still stops the bulk check', async () => {
        const im = new GraphInteractionManager({ ...ui, isDiscoveryModeActive: true, discoverySettings: { disableLocationCheckUI: true } });
        im.checkAllLocationsInRegion('Field'); // returns before any import: the gate is synchronous
        im.dispatchLocationCheckEvent('chest', 'Field'); // a sentinel that DOES dispatch, to wait on
        await vi.waitFor(() => expect(regionGraphDispatcher.publish).toHaveBeenCalledTimes(1));
        await flush();
        expect(regionGraphDispatcher.publish.mock.calls.map((c) => c[1].originator)).toEqual(['RegionGraphCheck']);
        expect(regionGraphDispatcher.publish).not.toHaveBeenCalledWith('user:locationCheck', expect.objectContaining({ originator: 'RegionGraphBulkCheck' }), expect.anything());
    });
});
