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
let pathState = [];          // mutable view of gameState.path used by getPath()
let currentRegionValue = null;
// Loop-mode flag now lives on gameState; loopEvents reads it via
// getGameStateAPI().getState().isLoopModeActive. Tests flip this directly
// (was: publish 'loopUI:modeChanged').
let mockLoopModeActive = false;
const gameStateAPI = {
  updatePath: (target, exit, source) => {
    gameStateCalls.push({ method: 'updatePath', target, exit, source });
    pathState.push({ type: 'regionMove', sourceRegion: source, destinationRegion: target, exitName: exit });
  },
  addLocationCheck: (loc, region) => {
    gameStateCalls.push({ method: 'addLocationCheck', loc, region });
  },
  addCustomAction: (name, params) => {
    gameStateCalls.push({ method: 'addCustomAction', name, params });
  },
  getPath: () => pathState,
  getCurrentRegion: () => currentRegionValue,
  getState: () => ({ isLoopModeActive: mockLoopModeActive }),
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

// loopStateSingleton.clearQueue is called by the legacy rebuild branch
// but isn't the unit under test here. Stub it so we can observe whether
// it ran without booting the real loop state machinery. The M3b strict
// gate (evaluateActionGate) is stubbed with a settable verdict; its own
// decision matrix is unit-tested in loopGate.test.js against the real
// LoopState — here we test how the handlers ROUTE on each verdict class.
const loopStateCalls = [];
const gateCalls = [];
const observeCalls = [];
// Default: gate out of scope (AP-native region) — the legacy clickToQueue
// contract applies unchanged.
let mockGateVerdict = { allowed: true, reason: 'apNative' };
vi.mock('./loopStateSingleton.js', () => ({
  default: {
    clearQueue: () => loopStateCalls.push('clearQueue'),
    evaluateActionGate: (args) => {
      gateCalls.push(args);
      return mockGateVerdict;
    },
    observeParkedLiveAction: (action) => observeCalls.push(action),
    noteLocationChecked: () => {},
    _handleBotWake_locationCheck: () => {},
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
  handleLoopExploreCompletedForLoops,
  _testOnly_resetLoopEvents,
} = await import('./loopEvents.js');

function makeEventBus() {
  const subs = new Map();
  const published = [];
  return {
    subs,
    published,
    subscribe: (name, cb) => {
      if (!subs.has(name)) subs.set(name, []);
      subs.get(name).push(cb);
    },
    publish: (name, data) => {
      published.push({ name, data });
      (subs.get(name) ?? []).forEach((cb) => cb(data));
    },
  };
}

function setRegionWithExits(regionName, exits) {
  stateManagerStaticData.regions.set(regionName, { exits });
}

function setQueueEndRegion(regionName) {
  // Stand in for "the queue ends in region X" by appending a
  // regionMove path entry with that destination.
  pathState.push({ type: 'regionMove', sourceRegion: null, destinationRegion: regionName, exitName: null });
}

let bus;

beforeEach(() => {
  _testOnly_resetLoopEvents();
  dispatcherCalls.length = 0;
  gameStateCalls.length = 0;
  loopStateCalls.length = 0;
  gateCalls.length = 0;
  observeCalls.length = 0;
  mockGateVerdict = { allowed: true, reason: 'apNative' };
  stateManagerStaticData.regions.clear();
  pathFinderResults.value = null;
  pathState = [];
  currentRegionValue = null;
  bus = makeEventBus();
  initializeLoopEvents(bus);
  // Default for the test bed: loop mode on, clickToQueue 'off', gate
  // out of scope (AP-native) — clicks pass through, the legacy
  // contract. Describe blocks below opt into 'append' / 'rebuildPath'
  // and gate verdicts as needed.
  mockLoopModeActive = true;
});

describe('loopEvents — clickToQueue off (default): pass-through', () => {
  it('user:locationCheck propagates up unchanged while loop mode is active', () => {
    handleUserLocationCheckForLoops({
      locationName: 'My Location',
      regionName: 'region_0_0',
    });

    // No queue mutation, no rebuild, no feedback — the click goes up.
    expect(gameStateCalls).toEqual([]);
    expect(loopStateCalls).toEqual([]);
    expect(bus.published.filter((p) => p.name === 'loops:clickIgnored')).toEqual([]);

    const propagations = dispatcherCalls.filter(
      (c) => c.method === 'publishToNextModule' && c.eventName === 'user:locationCheck',
    );
    expect(propagations).toHaveLength(1);
    expect(propagations[0].opts).toEqual({ direction: 'up' });
    expect(propagations[0].eventData).toEqual({
      locationName: 'My Location',
      regionName: 'region_0_0',
    });
  });

  it('user:exitClicked propagates up unchanged while loop mode is active', () => {
    handleUserExitClickedForLoops({
      exitName: 'east',
      sourceRegion: 'region_0_0',
      destinationRegion: 'region_1_0',
      isDiscovered: true,
    });

    expect(gameStateCalls).toEqual([]);
    expect(loopStateCalls).toEqual([]);

    const propagations = dispatcherCalls.filter(
      (c) => c.method === 'publishToNextModule' && c.eventName === 'user:exitClicked',
    );
    expect(propagations).toHaveLength(1);
    expect(propagations[0].opts).toEqual({ direction: 'up' });
  });

  it('ignores malformed clickToQueueChanged payloads (stays in pass-through)', () => {
    bus.publish('loopUI:clickToQueueChanged', { mode: 'bogus' });
    bus.publish('loopUI:clickToQueueChanged', { active: true });

    handleUserLocationCheckForLoops({
      locationName: 'My Location',
      regionName: 'region_0_0',
    });

    expect(gameStateCalls).toEqual([]);
    const propagations = dispatcherCalls.filter(
      (c) => c.method === 'publishToNextModule' && c.eventName === 'user:locationCheck',
    );
    expect(propagations).toHaveLength(1);
  });
});

describe('loopEvents — append-or-feedback (clickToQueue append)', () => {
  beforeEach(() => {
    bus.publish('loopUI:clickToQueueChanged', { mode: 'append' });
  });

  describe('handleUserLocationCheckForLoops', () => {
    it('appends a locationCheck when click region matches the queue end region', () => {
      setQueueEndRegion('region_0_0');

      handleUserLocationCheckForLoops({
        locationName: 'My Location',
        regionName: 'region_0_0',
      });

      expect(gameStateCalls).toEqual([
        { method: 'addLocationCheck', loc: 'My Location', region: 'region_0_0' },
      ]);
      // No queue-rebuild side effects: no clearQueue, no updatePath path.
      expect(loopStateCalls).toEqual([]);
      // No clickIgnored event.
      expect(bus.published.filter((p) => p.name === 'loops:clickIgnored')).toEqual([]);
    });

    it('appends an explore action when location is undiscovered but region matches', () => {
      setQueueEndRegion('region_0_0');
      discoveryState.isLocationDiscovered = () => false;

      handleUserLocationCheckForLoops({
        locationName: 'Hidden Location',
        regionName: 'region_0_0',
      });

      // Restore default for subsequent tests.
      discoveryState.isLocationDiscovered = () => true;

      expect(gameStateCalls).toEqual([
        { method: 'addCustomAction', name: 'explore', params: { regionName: 'region_0_0', repeatExplore: true } },
      ]);
    });

    it('drops the click and emits loops:clickIgnored when region does not match', () => {
      setQueueEndRegion('region_A');

      handleUserLocationCheckForLoops({
        locationName: 'My Location',
        regionName: 'region_B',
      });

      // No queue mutation.
      expect(gameStateCalls).toEqual([]);
      expect(loopStateCalls).toEqual([]);

      // loops:clickIgnored fired with the expected payload.
      const ignored = bus.published.filter((p) => p.name === 'loops:clickIgnored');
      expect(ignored).toHaveLength(1);
      expect(ignored[0].data).toMatchObject({
        kind: 'location',
        regionName: 'region_B',
        expectedRegion: 'region_A',
        payload: { locationName: 'My Location' },
      });
    });

    it('falls back to currentRegion when the queue has no regionMove entries', () => {
      currentRegionValue = 'startRegion';

      handleUserLocationCheckForLoops({
        locationName: 'L',
        regionName: 'startRegion',
      });

      expect(gameStateCalls).toEqual([
        { method: 'addLocationCheck', loc: 'L', region: 'startRegion' },
      ]);
    });
  });

  describe('handleUserExitClickedForLoops', () => {
    it('appends a regionMove via updatePath when source region matches the queue end region', () => {
      setQueueEndRegion('region_0_0');
      pathState.length = 0; // re-seed so updatePath calls below are the only entries
      setQueueEndRegion('region_0_0');

      handleUserExitClickedForLoops({
        exitName: 'east',
        sourceRegion: 'region_0_0',
        destinationRegion: 'region_1_0',
        isDiscovered: true,
      });

      const updates = gameStateCalls.filter((c) => c.method === 'updatePath');
      expect(updates).toEqual([
        { method: 'updatePath', target: 'region_1_0', exit: 'east', source: 'region_0_0' },
      ]);
      expect(loopStateCalls).toEqual([]);
    });

    it('appends an explore action when the exit is undiscovered but source matches', () => {
      setQueueEndRegion('region_0_0');

      handleUserExitClickedForLoops({
        exitName: 'east',
        sourceRegion: 'region_0_0',
        destinationRegion: 'region_1_0',
        isDiscovered: false,
      });

      expect(gameStateCalls).toEqual([
        { method: 'addCustomAction', name: 'explore', params: { regionName: 'region_0_0', repeatExplore: true } },
      ]);
    });

    it('drops the click and emits loops:clickIgnored when source region does not match', () => {
      setQueueEndRegion('region_A');

      handleUserExitClickedForLoops({
        exitName: 'east',
        sourceRegion: 'region_B',
        destinationRegion: 'region_C',
        isDiscovered: true,
      });

      expect(gameStateCalls).toEqual([]);
      expect(loopStateCalls).toEqual([]);

      const ignored = bus.published.filter((p) => p.name === 'loops:clickIgnored');
      expect(ignored).toHaveLength(1);
      expect(ignored[0].data).toMatchObject({
        kind: 'exit',
        regionName: 'region_B',
        expectedRegion: 'region_A',
        payload: { exitName: 'east', destinationRegion: 'region_C', isDiscovered: true },
      });
    });
  });

  it('loop mode off → user:locationCheck propagates up unchanged', () => {
    mockLoopModeActive = false;

    handleUserLocationCheckForLoops({
      locationName: 'My Location',
      regionName: 'region_0_0',
    });

    expect(gameStateCalls).toEqual([]);
    const propagations = dispatcherCalls.filter(
      (c) => c.method === 'publishToNextModule' && c.eventName === 'user:locationCheck',
    );
    expect(propagations).toHaveLength(1);
  });
});

describe('loopEvents — rebuild path (clickToQueue rebuildPath, advanced legacy behavior)', () => {
  beforeEach(() => {
    bus.publish('loopUI:clickToQueueChanged', { mode: 'rebuildPath' });
  });

  describe('handleUserExitClickedForLoops', () => {
    it('rebuilds the queue via updatePath, never dispatches user:regionMove', () => {
      pathFinderResults.value = ['Menu', 'region_0_0', 'region_1_0'];
      setRegionWithExits('Menu', [{ name: 'GameStart', connected_region: 'region_0_0' }]);
      setRegionWithExits('region_0_0', [{ name: 'east', connected_region: 'region_1_0' }]);

      handleUserExitClickedForLoops({
        exitName: 'east',
        sourceRegion: 'region_1_0',
        destinationRegion: 'region_2_0',
        isDiscovered: false,
      });

      const updates = gameStateCalls.filter((c) => c.method === 'updatePath');
      expect(updates).toEqual([
        { method: 'updatePath', target: 'region_0_0', exit: 'GameStart', source: 'Menu' },
        { method: 'updatePath', target: 'region_1_0', exit: 'east', source: 'region_0_0' },
      ]);
      expect(loopStateCalls).toContain('clearQueue');
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
      expect(updates.map((u) => `${u.source}->${u.target}`)).toEqual([
        'Menu->region_0_0',
        'region_0_0->region_1_0',
      ]);
    });
  });

  describe('handleUserLocationCheckForLoops', () => {
    it('rebuilds the queue and enqueues the location check', () => {
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
      expect(loopStateCalls).toContain('clearQueue');
    });

    it('system:locationCheck still propagates without queue-building', () => {
      pathFinderResults.value = ['Menu', 'region_0_0'];
      setRegionWithExits('Menu', [{ name: 'GameStart', connected_region: 'region_0_0' }]);

      handleUserLocationCheckForLoops({
        locationName: 'My Location',
        regionName: 'region_0_0',
      }, 'system:locationCheck');

      expect(gameStateCalls).toEqual([]);
      expect(loopStateCalls).toEqual([]);
      const propagations = dispatcherCalls.filter(
        (c) => c.method === 'publishToNextModule'
          && c.eventName === 'system:locationCheck',
      );
      expect(propagations).toHaveLength(1);
      expect(propagations[0].opts).toEqual({ direction: 'up' });
    });
  });
});

describe('loopEvents — M3b strict action gate routing', () => {
  function propagationsOf(eventName) {
    return dispatcherCalls.filter(
      (c) => c.method === 'publishToNextModule' && c.eventName === eventName,
    );
  }
  function ignoredEvents() {
    return bus.published.filter((p) => p.name === 'loops:clickIgnored');
  }

  it('blocked verdict + clickToQueue off → locationCheck is swallowed with feedback', () => {
    mockGateVerdict = { allowed: false, reason: 'emptyQueue', expectedRegion: null };

    handleUserLocationCheckForLoops({
      locationName: 'My Location',
      regionName: 'region_0_0',
    });

    expect(propagationsOf('user:locationCheck')).toHaveLength(0);
    expect(gameStateCalls).toEqual([]);
    const ignored = ignoredEvents();
    expect(ignored).toHaveLength(1);
    expect(ignored[0].data).toMatchObject({
      kind: 'location',
      regionName: 'region_0_0',
      reason: 'emptyQueue',
    });
  });

  it('blocked verdict + clickToQueue append → the click still AUTHORS (planning is never gated)', () => {
    bus.publish('loopUI:clickToQueueChanged', { mode: 'append' });
    mockGateVerdict = { allowed: false, reason: 'notStarted', expectedRegion: null };
    setQueueEndRegion('region_0_0');

    handleUserLocationCheckForLoops({
      locationName: 'My Location',
      regionName: 'region_0_0',
    });

    expect(gameStateCalls).toEqual([
      { method: 'addLocationCheck', loc: 'My Location', region: 'region_0_0' },
    ]);
    expect(propagationsOf('user:locationCheck')).toHaveLength(0);
  });

  it('parkedLivePlay verdict → observes the action (charge/capture) and passes it through', () => {
    mockGateVerdict = { allowed: true, reason: 'parkedLivePlay' };

    handleUserLocationCheckForLoops({
      locationName: 'My Location',
      regionName: 'region_0_0',
    });

    expect(observeCalls).toEqual([
      { type: 'locationCheck', locationName: 'My Location', regionName: 'region_0_0' },
    ]);
    expect(propagationsOf('user:locationCheck')).toHaveLength(1);
    expect(ignoredEvents()).toEqual([]);
  });

  it('exempt verdict (planningSource / queueExecution) → passes through without observation', () => {
    mockGateVerdict = { allowed: true, reason: 'queueExecution' };

    handleUserLocationCheckForLoops({
      locationName: 'My Location',
      regionName: 'region_0_0',
    });

    expect(observeCalls).toEqual([]);
    expect(propagationsOf('user:locationCheck')).toHaveLength(1);
  });

  it('fromLoop events never reach the gate at all', () => {
    mockGateVerdict = { allowed: false, reason: 'emptyQueue' };

    handleUserLocationCheckForLoops({
      locationName: 'My Location',
      regionName: 'region_0_0',
      fromLoop: true,
    });

    expect(gateCalls).toEqual([]);
    expect(propagationsOf('user:locationCheck')).toHaveLength(1);
  });

  it('blocked verdict + clickToQueue off → exitClicked is swallowed with feedback', () => {
    mockGateVerdict = { allowed: false, reason: 'hardPause', expectedRegion: 'region_A' };

    handleUserExitClickedForLoops({
      exitName: 'east',
      sourceRegion: 'region_0_0',
      destinationRegion: 'region_1_0',
      isDiscovered: true,
    });

    expect(propagationsOf('user:exitClicked')).toHaveLength(0);
    const ignored = ignoredEvents();
    expect(ignored).toHaveLength(1);
    expect(ignored[0].data).toMatchObject({
      kind: 'exit',
      regionName: 'region_0_0',
      reason: 'hardPause',
      expectedRegion: 'region_A',
    });
  });

  it('parkedLivePlay verdict → exitClicked passes through (the move performs)', () => {
    mockGateVerdict = { allowed: true, reason: 'parkedLivePlay' };

    handleUserExitClickedForLoops({
      exitName: 'east',
      sourceRegion: 'region_0_0',
      destinationRegion: 'region_1_0',
      isDiscovered: true,
    });

    expect(propagationsOf('user:exitClicked')).toHaveLength(1);
  });

  describe('handleLoopExploreCompletedForLoops (new explore receiver)', () => {
    it('loop mode off → propagates to discovery untouched', () => {
      mockLoopModeActive = false;
      handleLoopExploreCompletedForLoops({ regionName: 'region_0_0' });
      expect(gateCalls).toEqual([]);
      expect(propagationsOf('loop:exploreCompleted')).toHaveLength(1);
    });

    it('fromLoop (queue execution) → propagates without gating or observation', () => {
      mockGateVerdict = { allowed: false, reason: 'emptyQueue' };
      handleLoopExploreCompletedForLoops({ regionName: 'region_0_0', fromLoop: true });
      expect(gateCalls).toEqual([]);
      expect(observeCalls).toEqual([]);
      expect(propagationsOf('loop:exploreCompleted')).toHaveLength(1);
    });

    it('parkedLivePlay → observes (charge + capture) and propagates to discovery', () => {
      mockGateVerdict = { allowed: true, reason: 'parkedLivePlay' };
      handleLoopExploreCompletedForLoops({ regionName: 'region_0_0' });
      expect(observeCalls).toEqual([
        { type: 'explore', regionName: 'region_0_0' },
      ]);
      expect(propagationsOf('loop:exploreCompleted')).toHaveLength(1);
    });

    it('blocked → swallowed with feedback; discovery never reveals anything', () => {
      mockGateVerdict = { allowed: false, reason: 'notStarted', expectedRegion: null };
      handleLoopExploreCompletedForLoops({ regionName: 'region_0_0' });
      expect(propagationsOf('loop:exploreCompleted')).toHaveLength(0);
      const ignored = ignoredEvents();
      expect(ignored).toHaveLength(1);
      expect(ignored[0].data).toMatchObject({ kind: 'explore', reason: 'notStarted' });
    });

    it('out-of-scope substrate (not mode-integrated) → propagates untouched', () => {
      mockGateVerdict = { allowed: true, reason: 'substrateNotGated' };
      handleLoopExploreCompletedForLoops({ regionName: 'jta_zone_1' });
      expect(observeCalls).toEqual([]);
      expect(propagationsOf('loop:exploreCompleted')).toHaveLength(1);
    });
  });
});
