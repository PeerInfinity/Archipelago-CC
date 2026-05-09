import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LoopState } from './loopState.js';
import { GameState } from '../gameState/state.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';

function makeBus() {
  const events = [];
  return {
    events,
    publish: (name, data) => events.push({ name, data }),
    subscribe: () => () => {},
  };
}

function makeStubStateManager() {
  return {
    getLatestStateSnapshot: () => ({ checkedLocations: [], inventory: {} }),
    getStaticData: () => ({ regions: new Map() }),
  };
}

function makeStubDispatcher() {
  const calls = [];
  return {
    calls,
    publish: (eventName, eventData, opts) => {
      calls.push({ method: 'publish', eventName, eventData, opts });
    },
    publishToNextModule: (moduleName, eventName, eventData, opts) => {
      calls.push({ method: 'publishToNextModule', moduleName, eventName, eventData, opts });
    },
  };
}

/**
 * Wire a LoopState with a real GameState behind a flat API object,
 * matching how loops/index.js wires them at runtime. The API forwards
 * to the GameState instance so consumers see the same observable
 * behavior the runtime gives them.
 */
function makeWiredLoopState({ withDispatcher = false } = {}) {
  const bus = makeBus();
  const gs = new GameState(bus);
  const loopState = new LoopState();
  const dispatcher = withDispatcher ? makeStubDispatcher() : null;
  loopState.setDependencies({
    eventBus: bus,
    stateManager: makeStubStateManager(),
    dispatcher,
    gameState: {
      getState: () => gs,
      getCurrentRegion: () => gs.getCurrentRegion(),
      clearPath: () => gs.clearPath(),
      removeAllActionsOfType: (t, n) => gs.removeAllActionsOfType(t, n),
      trimPath: (r, i) => gs.trimPath(r, i),
      addLocationCheck: (l, r, sd) => gs.addLocationCheck(l, r, sd),
      addCustomAction: (a, p) => gs.addCustomAction(a, p),
      insertLocationCheckAt: (l, r, i, lr) => gs.insertLocationCheckAt(l, r, i, lr),
      insertCustomActionAt: (a, r, i, p) => gs.insertCustomActionAt(a, r, i, p),
    },
  });
  return { loopState, gs, bus, dispatcher };
}

describe('LoopState — XP delegation and serialization', () => {
  let loopState, gs, bus;
  beforeEach(() => {
    ({ loopState, gs, bus } = makeWiredLoopState());
  });

  it('addRegionXP delegates to gameState (so XP events fire from gameState)', () => {
    loopState.addRegionXP('Cave', 120);
    const xpEvents = bus.events.filter((e) => e.name === 'gameState:xpChanged');
    expect(xpEvents.length).toBe(1);
    expect(loopState.getRegionXP('Cave').level).toBe(1);
  });

  it('serialize/deserialize round-trips through gameState', () => {
    gs.currentMana = 50;
    loopState.addRegionXP('Region1', 30);
    const serialized = loopState.getSerializableState();
    expect(serialized.currentMana).toBe(50);
    expect(serialized.regionXP).toEqual([
      ['Region1', { level: 0, xp: 30, xpForNextLevel: 100 }],
    ]);

    const { loopState: ls2, gs: gs2 } = makeWiredLoopState();
    ls2.loadFromSerializedState(serialized);
    expect(gs2.getCurrentMana()).toBe(50);
    expect(gs2.getRegionXP('Region1').xp).toBe(30);
  });
});

describe('LoopState — substrate-handled completion (Phase 6)', () => {
  let loopState, gs, bus;
  let unregisterRegionInfo = null;

  beforeEach(() => {
    ({ loopState, gs, bus } = makeWiredLoopState());
    // Pre-set a regionInfo provider on centralRegistry so the
    // delegation check has something to query.
    centralRegistry.registerPublicFunction(
      'procgenPlayer',
      'getRegionInfo',
      (regionName) => regionInfoTable.get(regionName) ?? null,
    );
    unregisterRegionInfo = () => {
      // Vitest doesn't reset the registry between tests; null out the
      // function so other suites don't pick up stale data.
      centralRegistry.registerPublicFunction('procgenPlayer', 'getRegionInfo', () => null);
    };
  });
  afterEach(() => {
    if (unregisterRegionInfo) unregisterRegionInfo();
    regionInfoTable.clear();
  });

  // Mutated per-test to control what getRegionInfo returns.
  const regionInfoTable = new Map();

  describe('_shouldDelegateCurrentAction', () => {
    it('returns false when there is no current action', () => {
      loopState.currentAction = null;
      expect(loopState._shouldDelegateCurrentAction()).toBe(false);
    });

    it('returns false when the current action has no sourceRegion', () => {
      loopState.currentAction = { type: 'customAction', sourceRegion: null };
      expect(loopState._shouldDelegateCurrentAction()).toBe(false);
    });

    it('returns false for a non-maze substrate', () => {
      regionInfoTable.set('TARegion', { substrate: 'text_adventure', manaEnabled: true });
      loopState.currentAction = { type: 'regionMove', sourceRegion: 'TARegion' };
      expect(loopState._shouldDelegateCurrentAction()).toBe(false);
    });

    it('returns false when manaEnabled is off', () => {
      regionInfoTable.set('Maze1', { substrate: 'maze', manaEnabled: false });
      loopState.currentAction = { type: 'regionMove', sourceRegion: 'Maze1' };
      expect(loopState._shouldDelegateCurrentAction()).toBe(false);
    });

    it('returns true for maze substrate with manaEnabled', () => {
      regionInfoTable.set('Maze1', { substrate: 'maze', manaEnabled: true });
      loopState.currentAction = { type: 'regionMove', sourceRegion: 'Maze1' };
      expect(loopState._shouldDelegateCurrentAction()).toBe(true);
    });
  });

  describe('_handleSubstrateActionCompleted', () => {
    it('is a no-op when no action is currently delegated', () => {
      loopState._delegatedAction = null;
      // Just shouldn't throw; nothing to assert beyond that.
      expect(() => loopState._handleSubstrateActionCompleted({ completed: true })).not.toThrow();
    });

    it('clears _delegatedAction on either success or interruption', () => {
      loopState._delegatedAction = { type: 'regionMove', pathIndex: 0 };
      // Need an actionQueueManager / dispatcher / currentAction to make
      // _completeCurrentAction safe; this test only checks the flag
      // gets cleared. _completeCurrentAction may early-return.
      loopState.currentAction = null;
      loopState._handleSubstrateActionCompleted({ completed: false });
      expect(loopState._delegatedAction).toBeNull();
    });

    it('stops processing on completed:false', () => {
      loopState._delegatedAction = { type: 'regionMove' };
      loopState.isProcessing = true;
      loopState._handleSubstrateActionCompleted({ completed: false });
      expect(loopState.isProcessing).toBe(false);
    });
  });

  describe('stopProcessing / resetForNewRules', () => {
    it('stopProcessing clears _delegatedAction', () => {
      loopState._delegatedAction = { type: 'regionMove' };
      loopState.isProcessing = true;
      loopState.stopProcessing();
      expect(loopState._delegatedAction).toBeNull();
    });

    it('resetForNewRules clears _delegatedAction', () => {
      loopState._delegatedAction = { type: 'regionMove' };
      loopState.resetForNewRules();
      expect(loopState._delegatedAction).toBeNull();
    });
  });

  describe('step / step-mode hooks', () => {
    it('step() is a no-op while already processing', () => {
      loopState.isProcessing = true;
      loopState.step();
      expect(loopState._stepMode).toBe(false);
    });

    it('step() is a no-op when the queue is empty', () => {
      loopState.isProcessing = false;
      // No actions in gameState path → empty queue.
      loopState.step();
      expect(loopState._stepMode).toBe(false);
      expect(loopState.isProcessing).toBe(false);
    });

    it('substrate completion in step mode lands in paused', () => {
      loopState._stepMode = true;
      loopState._delegatedAction = { type: 'regionMove' };
      loopState.isProcessing = true;
      // completed:false short-circuits _completeCurrentAction and
      // exercises the post-stopProcessing pause hook.
      loopState._handleSubstrateActionCompleted({ completed: false });
      expect(loopState.isProcessing).toBe(false);
      expect(loopState.isPaused).toBe(true);
      expect(loopState._stepMode).toBe(false);
    });
  });
});

describe('LoopState — clearQueue (Phase 6g)', () => {
  let loopState, gs, bus, dispatcher;
  let unregisterStartFn = null;

  beforeEach(() => {
    ({ loopState, gs, bus, dispatcher } = makeWiredLoopState({ withDispatcher: true }));
  });
  afterEach(() => {
    if (unregisterStartFn) {
      unregisterStartFn();
      unregisterStartFn = null;
    }
  });

  function setResolvedStart(value) {
    centralRegistry.registerPublicFunction(
      'procgenPlayer', 'getResolvedStartRegion', () => value,
    );
    unregisterStartFn = () => centralRegistry.registerPublicFunction(
      'procgenPlayer', 'getResolvedStartRegion', () => null,
    );
  }

  it('clears the path via gameState.clearPath', () => {
    gs.setStartRegions(['Menu']);
    // Seed the path with two regionMove entries; currentRegion stays
    // at Menu so updatePath's redundancy check doesn't drop the first
    // hop.
    gs.updatePath('region_0_0', null, 'Menu');
    gs.updatePath('region_1_0', 'east', 'region_0_0');
    expect(gs.getPath().length).toBe(2);

    loopState.clearQueue();

    expect(gs.getPath()).toEqual([]);
  });

  it('preserves mana / XP / bestPaths (does NOT call gameState.reset)', () => {
    gs.setStartRegions(['Menu']);
    gs.deductMana(40);
    gs.addRegionXP('region_0_0', 60);
    gs.recordBestPath('a:b:c', [{ x: 0, y: 0 }, { x: 1, y: 0 }], 1);

    loopState.clearQueue();

    expect(gs.getCurrentMana()).toBe(60);
    expect(gs.getRegionXP('region_0_0').xp).toBeGreaterThan(0);
    expect(gs.getBestPath('a:b:c')).not.toBeNull();
  });

  it('teleports to procgenPlayer.getResolvedStartRegion when registered', () => {
    setResolvedStart('region_0_0');
    gs.setStartRegions(['Menu']);
    gs.setCurrentRegion('region_2_3');

    loopState.clearQueue();

    const teleport = dispatcher.calls.find(
      (c) => c.method === 'publish'
        && c.eventName === 'user:regionMove'
        && c.eventData?.targetRegion === 'region_0_0',
    );
    expect(teleport).toBeDefined();
    expect(teleport.eventData.fromReset).toBe(true);
    expect(teleport.eventData.updatePath).toBe(false);
  });

  it('falls back to gameState.startRegions[0] when no resolved start is registered', () => {
    setResolvedStart(null);
    gs.setStartRegions(['MyStart']);
    gs.setCurrentRegion('region_2_3');

    loopState.clearQueue();

    const teleport = dispatcher.calls.find(
      (c) => c.eventName === 'user:regionMove'
        && c.eventData?.targetRegion === 'MyStart',
    );
    expect(teleport).toBeDefined();
  });

  it('does NOT teleport when already at the loop start region', () => {
    setResolvedStart('region_0_0');
    gs.setStartRegions(['Menu']);
    gs.setCurrentRegion('region_0_0');

    loopState.clearQueue();

    const teleport = dispatcher.calls.find(
      (c) => c.eventName === 'user:regionMove',
    );
    expect(teleport).toBeUndefined();
  });
});

describe('LoopState — _applyActionEffects regionMove dispatch (Phase 6g)', () => {
  let loopState, gs, dispatcher;

  beforeEach(() => {
    ({ loopState, gs, dispatcher } = makeWiredLoopState({ withDispatcher: true }));
  });

  it('publishes user:regionMove with fromLoop:true (initialTarget bottom) for non-delegated completion', () => {
    loopState._completedViaDelegation = false;
    loopState._applyActionEffects({
      type: 'regionMove',
      sourceRegion: 'Menu',
      destinationRegion: 'region_0_0',
      exitUsed: 'GameStart',
    });

    // Use dispatcher.publish (initialTarget: 'bottom') so procgenPlayer
    // — which sits at a higher load priority than loops — receives
    // the event and publishes the destination substrate's loadRegion.
    // publishToNextModule(direction: 'up') would miss it.
    const moveDispatch = dispatcher.calls.find(
      (c) => c.method === 'publish'
        && c.eventName === 'user:regionMove',
    );
    expect(moveDispatch).toBeDefined();
    expect(moveDispatch.eventData).toMatchObject({
      sourceRegion: 'Menu',
      targetRegion: 'region_0_0',
      exitName: 'GameStart',
      fromLoop: true,
    });
    expect(moveDispatch.opts).toEqual({ initialTarget: 'bottom' });
    // loop:moveCompleted still fires alongside.
    expect(dispatcher.calls.some(
      (c) => c.eventName === 'loop:moveCompleted',
    )).toBe(true);
  });

  it('skips the user:regionMove dispatch when the action was delegated to a substrate', () => {
    loopState._completedViaDelegation = true;
    loopState._applyActionEffects({
      type: 'regionMove',
      sourceRegion: 'region_0_0',
      destinationRegion: 'region_1_0',
      exitUsed: 'east',
    });

    const moveDispatch = dispatcher.calls.find(
      (c) => c.eventName === 'user:regionMove',
    );
    expect(moveDispatch).toBeUndefined();
    // loop:moveCompleted still fires for discovery tracking.
    expect(dispatcher.calls.some(
      (c) => c.eventName === 'loop:moveCompleted',
    )).toBe(true);
  });
});
