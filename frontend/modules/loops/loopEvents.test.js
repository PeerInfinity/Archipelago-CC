import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub the loops module's getters so the handlers can pick up our
// test doubles without booting the whole module.
const dispatcherCalls = [];
const dispatcher = {
  publish: (eventName, eventData, opts) => {
    dispatcherCalls.push({ method: 'publish', eventName, eventData, opts });
  },
  publishToNextModule: (moduleName, eventName, eventData, opts) => {
    dispatcherCalls.push({ method: 'publishToNextModule', moduleName, eventName, eventData, opts });
  },
};

const gameStateCalls = [];
const gameStateAPI = {
  updatePath: (target, exit, source) => {
    gameStateCalls.push({ method: 'updatePath', target, exit, source });
  },
  addLocationCheck: (loc, region) => {
    gameStateCalls.push({ method: 'addLocationCheck', loc, region });
  },
  addCustomAction: (name, params) => {
    gameStateCalls.push({ method: 'addCustomAction', name, params });
  },
};

const pathFinderResults = { value: null };
const pathFinder = {
  findDiscoveredPath: () => pathFinderResults.value,
};

const stateManagerStaticData = { regions: new Map() };
const stateManager = {
  getStaticData: () => stateManagerStaticData,
};

vi.mock('./index.js', () => ({
  getLoopsModuleDispatcher: () => dispatcher,
  getGameStateAPI: () => gameStateAPI,
  getPathFinder: () => pathFinder,
  moduleInfo: { name: 'loops' },
}));

// loopStateSingleton.resetQueue is called by both handlers but isn't
// the unit under test here. Stub it so we can observe whether it ran
// without booting the real loop state machinery.
const loopStateCalls = [];
vi.mock('./loopStateSingleton.js', () => ({
  default: {
    resetQueue: () => loopStateCalls.push('resetQueue'),
  },
}));

vi.mock('../stateManager/index.js', () => ({
  stateManagerProxySingleton: stateManager,
}));

const discoveryState = {
  isLocationDiscovered: () => true,
  isRegionDiscovered: () => true,
  isExitDiscovered: () => true,
};

vi.mock('../discovery/singleton.js', () => ({
  default: discoveryState,
}));

const {
  initializeLoopEvents,
  handleUserExitClickedForLoops,
  handleUserLocationCheckForLoops,
} = await import('./loopEvents.js');

function makeEventBus() {
  const subs = new Map();
  return {
    subs,
    subscribe: (name, cb) => {
      if (!subs.has(name)) subs.set(name, []);
      subs.get(name).push(cb);
    },
    publish: (name, data) => {
      (subs.get(name) ?? []).forEach((cb) => cb(data));
    },
  };
}

function setRegionWithExits(regionName, exits) {
  // exits: [{ name, connected_region }]
  stateManagerStaticData.regions.set(regionName, { exits });
}

describe('loopEvents — Phase 6g queue building', () => {
  beforeEach(() => {
    dispatcherCalls.length = 0;
    gameStateCalls.length = 0;
    loopStateCalls.length = 0;
    stateManagerStaticData.regions.clear();
    pathFinderResults.value = null;

    // Activate loop mode via the loopUI:modeChanged event so
    // handlers go down the queue-building path (not propagation).
    const bus = makeEventBus();
    initializeLoopEvents(bus);
    bus.publish('loopUI:modeChanged', { active: true });
  });

  describe('handleUserExitClickedForLoops', () => {
    it('appends path entries via gameStateAPI.updatePath, never dispatches user:regionMove', () => {
      // Path: Menu → region_0_0 → region_1_0
      pathFinderResults.value = ['Menu', 'region_0_0', 'region_1_0'];
      setRegionWithExits('Menu', [{ name: 'GameStart', connected_region: 'region_0_0' }]);
      setRegionWithExits('region_0_0', [{ name: 'east', connected_region: 'region_1_0' }]);

      handleUserExitClickedForLoops({
        exitName: 'east',
        sourceRegion: 'region_1_0',
        destinationRegion: 'region_2_0',
        isDiscovered: false,
      });

      // updatePath called for every hop in the path (Menu→region_0_0,
      // region_0_0→region_1_0). Undiscovered exit doesn't get appended
      // as a regionMove — it's a customAction(explore) instead.
      const updates = gameStateCalls.filter((c) => c.method === 'updatePath');
      expect(updates).toEqual([
        { method: 'updatePath', target: 'region_0_0', exit: 'GameStart', source: 'Menu' },
        { method: 'updatePath', target: 'region_1_0', exit: 'east', source: 'region_0_0' },
      ]);

      // Crucial: queue-building never dispatches user:regionMove.
      const regionMoves = dispatcherCalls.filter(
        (c) => c.eventName === 'user:regionMove',
      );
      expect(regionMoves).toEqual([]);
    });

    it('discovered exit appends a final regionMove via updatePath', () => {
      pathFinderResults.value = ['Menu', 'region_0_0'];
      setRegionWithExits('Menu', [{ name: 'GameStart', connected_region: 'region_0_0' }]);

      handleUserExitClickedForLoops({
        exitName: 'east',
        sourceRegion: 'region_0_0',
        destinationRegion: 'region_1_0',
        isDiscovered: true,
      });

      const updates = gameStateCalls.filter((c) => c.method === 'updatePath');
      // Includes the buildMoveSequence path PLUS the discovered exit's
      // final hop appended in handleUserExitClickedForLoops.
      expect(updates.map((u) => `${u.source}->${u.target}`)).toEqual([
        'Menu->region_0_0',
        'region_0_0->region_1_0',
      ]);
      expect(dispatcherCalls.filter(
        (c) => c.eventName === 'user:regionMove',
      )).toEqual([]);
    });
  });

  describe('handleUserLocationCheckForLoops', () => {
    it('appends path entries via updatePath, then enqueues the location check', () => {
      pathFinderResults.value = ['Menu', 'region_0_0'];
      setRegionWithExits('Menu', [{ name: 'GameStart', connected_region: 'region_0_0' }]);

      handleUserLocationCheckForLoops({
        locationName: 'My Location',
        regionName: 'region_0_0',
      });

      const updates = gameStateCalls.filter((c) => c.method === 'updatePath');
      expect(updates).toEqual([
        { method: 'updatePath', target: 'region_0_0', exit: 'GameStart', source: 'Menu' },
      ]);
      expect(gameStateCalls.find(
        (c) => c.method === 'addLocationCheck' && c.loc === 'My Location',
      )).toBeDefined();
      expect(dispatcherCalls.filter(
        (c) => c.eventName === 'user:regionMove',
      )).toEqual([]);
    });
  });
});
