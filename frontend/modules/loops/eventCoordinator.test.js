/**
 * Tests for EventCoordinator — the routing layer between the eventBus
 * and LoopUI. Most handlers are gated by `loopUI.isLoopModeActive`;
 * the value of these tests is catching wiring regressions (handler
 * names, gate conditions, downstream method calls).
 *
 * Out of scope here:
 *  - _handleSetLoopMode (touches centralRegistry + the async cost-gen
 *    chain; too tangled for a unit test).
 *  - _enableDiscoveryForLoopMode / _restoreDiscoverySettings (depend
 *    on the real settingsManager singleton).
 *  - The `window.requestAnimationFrame` branch in _handleProgressUpdated
 *    (DOM-ish; we cover the data-routing parts only).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EventCoordinator } from './eventCoordinator.js';

function makeBus() {
  const subs = new Map(); // eventName -> Set<handler>
  const calls = [];
  return {
    subs,
    calls,
    subscribe(eventName, handler) {
      if (!subs.has(eventName)) subs.set(eventName, new Set());
      subs.get(eventName).add(handler);
      calls.push({ method: 'subscribe', eventName });
      return () => {
        subs.get(eventName)?.delete(handler);
        calls.push({ method: 'unsubscribe', eventName });
      };
    },
    publish(eventName, data) {
      const handlers = subs.get(eventName);
      if (handlers) handlers.forEach(h => h(data));
    },
  };
}

function makeStubLoopUI({ isLoopModeActive = true, isProcessing = false, autoRemoveCompleted = false, autoRestartQueue = false, gameSpeed = 100 } = {}) {
  const calls = [];
  const trackedQuerySelector = (sel) => {
    // Return generic stub elements for any selector the coordinator queries.
    return { value: '', checked: false, offsetWidth: 0 };
  };
  const loopState = {
    isProcessing,
    autoRemoveCompleted,
    autoRestartQueue,
    isPaused: false,
    gameSpeed,
    currentActionIndex: 0,
    _processingState: 'idle',
    getProcessingState() { return this._processingState; },
    getActionQueue: () => [],
    resumeProcessing() { calls.push({ method: 'loopState.resumeProcessing' }); },
    removeCompletedActions() { calls.push({ method: 'loopState.removeCompletedActions' }); },
    disableRepeatForExploredRegions() { calls.push({ method: 'loopState.disableRepeatForExploredRegions' }); },
  };
  return {
    calls,
    loopState,
    isLoopModeActive,
    isDiscoveryModeActive: false,
    discoverySettings: {},
    expansionState: {
      expandedRegions: new Set(),
      setRegionExpanded(name, expanded, instance) { calls.push({ method: 'expansionState.setRegionExpanded', name, expanded, instance }); },
    },
    regionsInQueue: new Set(),
    rootElement: { querySelector: trackedQuerySelector },
    pickInitialExpandedRegion() { calls.push({ method: 'pickInitialExpandedRegion' }); return { name: 'Forest', instance: 1 }; },
    getLoopState() { return this.loopState; },
    getPanelManager() { return null; },
    toggleLoopMode() { calls.push({ method: 'toggleLoopMode' }); },
    renderLoopPanel() { calls.push({ method: 'renderLoopPanel' }); },
    _updateManaDisplay(c, m) { calls.push({ method: '_updateManaDisplay', c, m }); },
    _updateRegionXPDisplay(r) { calls.push({ method: '_updateRegionXPDisplay', r }); },
    _updateLoopStats() { calls.push({ method: '_updateLoopStats' }); },
    _updatePauseButtonState(isPaused, processingState) { calls.push({ method: '_updatePauseButtonState', isPaused, processingState }); },
    _updateRegionsInQueue(q) { calls.push({ method: '_updateRegionsInQueue', queueLen: q?.length }); },
    _updateActionProgress(a) { calls.push({ method: '_updateActionProgress', id: a?.id }); },
    _updateCurrentActionDisplay(a) { calls.push({ method: '_updateCurrentActionDisplay', id: a?.id }); },
    _handleLoopReset(d) { calls.push({ method: '_handleLoopReset', data: d }); },
  };
}

describe('EventCoordinator — subscription lifecycle', () => {
  let bus, loopUI, coord;
  beforeEach(() => {
    bus = makeBus();
    loopUI = makeStubLoopUI();
    coord = new EventCoordinator(bus, loopUI);
  });

  it('subscribeToEvents registers all expected event names', () => {
    coord.subscribeToEvents();
    const expected = [
      'gameState:manaChanged',
      'gameState:xpChanged',
      'loopState:pauseStateChanged',
      'loopState:queueUpdated',
      'loopState:autoRestartChanged',
      'loopState:progressUpdated',
      'loopState:actionCompleted',
      'loopState:newActionStarted',
      'loopState:queueCompleted',
      'stateManager:ready',
      'stateManager:snapshotUpdated',
      'stateManager:rulesLoaded',
      'discovery:locationDiscovered',
      'discovery:exitDiscovered',
      'discovery:regionDiscovered',
      'discovery:changed',
      'discovery:modeChanged',
      'discovery:settingsChanged',
      'loopState:loopReset',
      'loopState:stateLoaded',
      'loopState:exploreActionRepeated',
      'loops:setLoopMode',
      'gameState:pathUpdated',
    ];
    for (const name of expected) {
      expect(bus.subs.has(name)).toBe(true);
    }
    expect(coord.eventSubscriptions.length).toBe(expected.length);
  });

  it('subscribeToEvents called twice is a no-op (no duplicate subscriptions)', () => {
    coord.subscribeToEvents();
    const firstCount = coord.eventSubscriptions.length;
    coord.subscribeToEvents();
    expect(coord.eventSubscriptions.length).toBe(firstCount);
  });

  it('unsubscribeAll calls every recorded unsubscribe and clears the list', () => {
    coord.subscribeToEvents();
    const subscribedCount = coord.eventSubscriptions.length;
    coord.unsubscribeAll();
    const unsubCalls = bus.calls.filter(c => c.method === 'unsubscribe');
    expect(unsubCalls.length).toBe(subscribedCount);
    expect(coord.eventSubscriptions.length).toBe(0);
  });
});

describe('EventCoordinator — gating by isLoopModeActive', () => {
  function setup(isLoopModeActive) {
    const bus = makeBus();
    const loopUI = makeStubLoopUI({ isLoopModeActive });
    const coord = new EventCoordinator(bus, loopUI);
    coord.subscribeToEvents();
    return { bus, loopUI, coord };
  }

  it('mana-changed does NOT update display when loop mode is off', () => {
    const { bus, loopUI } = setup(false);
    bus.publish('gameState:manaChanged', { current: 50, max: 100 });
    expect(loopUI.calls.find(c => c.method === '_updateManaDisplay')).toBeUndefined();
  });

  it('mana-changed updates display when loop mode is on', () => {
    const { bus, loopUI } = setup(true);
    bus.publish('gameState:manaChanged', { current: 50, max: 100 });
    expect(loopUI.calls.find(c => c.method === '_updateManaDisplay')).toMatchObject({ c: 50, m: 100 });
  });

  it('xp-changed updates region XP + loop stats when active', () => {
    const { bus, loopUI } = setup(true);
    bus.publish('gameState:xpChanged', { regionName: 'Forest', xpData: { level: 1 } });
    const regionUpdate = loopUI.calls.find(c => c.method === '_updateRegionXPDisplay');
    const statsUpdate = loopUI.calls.find(c => c.method === '_updateLoopStats');
    expect(regionUpdate?.r).toBe('Forest');
    expect(statsUpdate).toBeDefined();
  });

  it('pause-state-changed forwards to _updatePauseButtonState with both args', () => {
    const { bus, loopUI } = setup(true);
    bus.publish('loopState:pauseStateChanged', { isPaused: true, processingState: 'paused' });
    const call = loopUI.calls.find(c => c.method === '_updatePauseButtonState');
    expect(call).toMatchObject({ isPaused: true, processingState: 'paused' });
  });
});

describe('EventCoordinator — _handleQueueUpdated and _handlePathUpdated', () => {
  it('queueUpdated re-renders + refreshes Step button + updates queue regions', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI();
    new EventCoordinator(bus, loopUI).subscribeToEvents();
    bus.publish('loopState:queueUpdated', { queue: [{ id: 'a' }, { id: 'b' }] });
    expect(loopUI.calls.find(c => c.method === '_updateRegionsInQueue')).toMatchObject({ queueLen: 2 });
    expect(loopUI.calls.find(c => c.method === 'renderLoopPanel')).toBeDefined();
    expect(loopUI.calls.find(c => c.method === '_updatePauseButtonState')).toBeDefined();
  });

  it('pathUpdated calls resumeProcessing when state is "waiting" with new actions', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI();
    loopUI.loopState._processingState = 'waiting';
    loopUI.loopState.currentActionIndex = 0;
    loopUI.loopState.getActionQueue = () => [{ id: 'a' }, { id: 'b' }];
    new EventCoordinator(bus, loopUI).subscribeToEvents();
    bus.publish('gameState:pathUpdated', {});

    expect(loopUI.calls.find(c => c.method === 'loopState.resumeProcessing')).toBeDefined();
    // Early-returned before re-rendering to let resumeProcessing fire its own UI update.
    expect(loopUI.calls.find(c => c.method === 'renderLoopPanel')).toBeUndefined();
  });

  it('pathUpdated re-renders and refreshes Step button when NOT in waiting state', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI();
    loopUI.loopState._processingState = 'idle';
    new EventCoordinator(bus, loopUI).subscribeToEvents();
    bus.publish('gameState:pathUpdated', {});

    expect(loopUI.calls.find(c => c.method === 'loopState.resumeProcessing')).toBeUndefined();
    expect(loopUI.calls.find(c => c.method === 'renderLoopPanel')).toBeDefined();
    expect(loopUI.calls.find(c => c.method === '_updatePauseButtonState')).toBeDefined();
  });

  it('pathUpdated does NOTHING when loop mode is off', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI({ isLoopModeActive: false });
    new EventCoordinator(bus, loopUI).subscribeToEvents();
    bus.publish('gameState:pathUpdated', {});
    expect(loopUI.calls).toEqual([]);
  });
});

describe('EventCoordinator — progress / action / queue events', () => {
  it('progressUpdated does NOTHING when loopState is not processing', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI({ isProcessing: false });
    new EventCoordinator(bus, loopUI).subscribeToEvents();
    bus.publish('loopState:progressUpdated', { action: { id: 'a' }, mana: { current: 50, max: 100 } });
    expect(loopUI.calls.find(c => c.method === '_updateActionProgress')).toBeUndefined();
    expect(loopUI.calls.find(c => c.method === '_updateManaDisplay')).toBeUndefined();
  });

  it('progressUpdated updates mana even when no action is provided (data.action falsy)', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI({ isProcessing: true });
    // _handleProgressUpdated calls window.requestAnimationFrame ONLY in the
    // data.action branch — providing only mana avoids any DOM dependency.
    new EventCoordinator(bus, loopUI).subscribeToEvents();
    bus.publish('loopState:progressUpdated', { mana: { current: 30, max: 100 } });
    expect(loopUI.calls.find(c => c.method === '_updateManaDisplay')).toMatchObject({ c: 30, m: 100 });
    expect(loopUI.calls.find(c => c.method === '_updateActionProgress')).toBeUndefined();
  });

  it('actionCompleted refreshes loop stats and re-renders', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI();
    new EventCoordinator(bus, loopUI).subscribeToEvents();
    bus.publish('loopState:actionCompleted', { action: { id: 'a' } });
    expect(loopUI.calls.find(c => c.method === '_updateLoopStats')).toBeDefined();
    expect(loopUI.calls.find(c => c.method === 'renderLoopPanel')).toBeDefined();
  });

  it('newActionStarted updates the current action display only when data.action is set', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI();
    new EventCoordinator(bus, loopUI).subscribeToEvents();
    bus.publish('loopState:newActionStarted', { action: { id: 'a' } });
    expect(loopUI.calls.find(c => c.method === '_updateCurrentActionDisplay')).toMatchObject({ id: 'a' });

    loopUI.calls.length = 0;
    bus.publish('loopState:newActionStarted', { action: null });
    expect(loopUI.calls.find(c => c.method === '_updateCurrentActionDisplay')).toBeUndefined();
  });

  it('queueCompleted runs auto-remove when autoRemoveCompleted is on, then re-renders', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI({ autoRemoveCompleted: true });
    new EventCoordinator(bus, loopUI).subscribeToEvents();
    bus.publish('loopState:queueCompleted', {});
    expect(loopUI.calls.find(c => c.method === 'loopState.removeCompletedActions')).toBeDefined();
    expect(loopUI.calls.find(c => c.method === 'renderLoopPanel')).toBeDefined();
  });

  it('queueCompleted with autoRemoveCompleted=false does NOT call removeCompletedActions', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI({ autoRemoveCompleted: false });
    new EventCoordinator(bus, loopUI).subscribeToEvents();
    bus.publish('loopState:queueCompleted', {});
    expect(loopUI.calls.find(c => c.method === 'loopState.removeCompletedActions')).toBeUndefined();
  });
});

describe('EventCoordinator — stateManager events', () => {
  it('stateManager:ready expands initial region when expansion is empty', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI();
    const coord = new EventCoordinator(bus, loopUI);
    coord.subscribeToEvents();
    bus.publish('stateManager:ready', {});

    expect(coord._stateManagerReady).toBe(true);
    const expandCall = loopUI.calls.find(c => c.method === 'expansionState.setRegionExpanded');
    expect(expandCall).toMatchObject({ name: 'Forest', expanded: true, instance: 1 });
    expect(loopUI.calls.find(c => c.method === 'renderLoopPanel')).toBeDefined();
  });

  it('stateManager:ready does NOT pick a region when one is already expanded', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI();
    loopUI.expansionState.expandedRegions.add('Forest#1');
    new EventCoordinator(bus, loopUI).subscribeToEvents();
    bus.publish('stateManager:ready', {});
    expect(loopUI.calls.find(c => c.method === 'pickInitialExpandedRegion')).toBeUndefined();
    expect(loopUI.calls.find(c => c.method === 'expansionState.setRegionExpanded')).toBeUndefined();
  });

  it('snapshotUpdated re-renders, and runs auto-remove when enabled', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI({ autoRemoveCompleted: true });
    new EventCoordinator(bus, loopUI).subscribeToEvents();
    bus.publish('stateManager:snapshotUpdated', {});
    expect(loopUI.calls.find(c => c.method === 'loopState.removeCompletedActions')).toBeDefined();
    expect(loopUI.calls.find(c => c.method === 'renderLoopPanel')).toBeDefined();
  });

  it('rulesLoaded re-renders the loop panel', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI();
    new EventCoordinator(bus, loopUI).subscribeToEvents();
    bus.publish('stateManager:rulesLoaded', {});
    expect(loopUI.calls.find(c => c.method === 'renderLoopPanel')).toBeDefined();
  });
});

describe('EventCoordinator — discovery events', () => {
  it('discovery:changed triggers auto-remove + repeat disable when enabled', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI({ autoRemoveCompleted: true });
    new EventCoordinator(bus, loopUI).subscribeToEvents();
    bus.publish('discovery:changed', {});
    expect(loopUI.calls.find(c => c.method === 'loopState.disableRepeatForExploredRegions')).toBeDefined();
    expect(loopUI.calls.find(c => c.method === 'loopState.removeCompletedActions')).toBeDefined();
    expect(loopUI.calls.find(c => c.method === 'renderLoopPanel')).toBeDefined();
  });

  it('all four discovery channels route through the same handler', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI();
    new EventCoordinator(bus, loopUI).subscribeToEvents();
    for (const ch of ['discovery:locationDiscovered', 'discovery:exitDiscovered', 'discovery:regionDiscovered', 'discovery:changed']) {
      loopUI.calls.length = 0;
      bus.publish(ch, {});
      expect(loopUI.calls.find(c => c.method === 'renderLoopPanel')).toBeDefined();
    }
  });

  it('discovery:modeChanged updates isDiscoveryModeActive flag and re-renders', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI();
    new EventCoordinator(bus, loopUI).subscribeToEvents();
    bus.publish('discovery:modeChanged', { active: true });
    expect(loopUI.isDiscoveryModeActive).toBe(true);
    expect(loopUI.calls.find(c => c.method === 'renderLoopPanel')).toBeDefined();
  });

  it('discovery:settingsChanged copies settings keys onto loopUI.discoverySettings', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI();
    new EventCoordinator(bus, loopUI).subscribeToEvents();
    bus.publish('discovery:settingsChanged', {
      settings: {
        undiscoveredDisplay: 'placeholder',
        clickDiscoversLocation: false,
        clickDiscoversRegion: true,
        disableLocationCheckUI: true,
        showUndiscoveredDetails: true,
        showUndiscoveredRegionNames: true,
        enableDiscoveryMode: true,
      },
    });
    expect(loopUI.discoverySettings).toMatchObject({
      undiscoveredDisplay: 'placeholder',
      clickDiscoversLocation: false,
      clickDiscoversRegion: true,
      disableLocationCheckUI: true,
      showUndiscoveredDetails: true,
      showUndiscoveredRegionNames: true,
    });
    expect(loopUI.isDiscoveryModeActive).toBe(true);
  });
});

describe('EventCoordinator — loop-state lifecycle events', () => {
  it('loopState:loopReset forwards mana data to _updateManaDisplay', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI();
    new EventCoordinator(bus, loopUI).subscribeToEvents();
    bus.publish('loopState:loopReset', { mana: { current: 100, max: 100 } });
    expect(loopUI.calls.find(c => c.method === '_handleLoopReset')).toBeDefined();
    expect(loopUI.calls.find(c => c.method === '_updateManaDisplay')).toMatchObject({ c: 100, m: 100 });
  });

  it('loopState:exploreActionRepeated adds region to regionsInQueue and re-renders', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI();
    new EventCoordinator(bus, loopUI).subscribeToEvents();
    bus.publish('loopState:exploreActionRepeated', { regionName: 'NewRegion' });
    expect(loopUI.regionsInQueue.has('NewRegion')).toBe(true);
    expect(loopUI.calls.find(c => c.method === 'renderLoopPanel')).toBeDefined();
  });

  it('loopState:stateLoaded re-renders and forwards isPaused to pause button', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI();
    loopUI.loopState.isPaused = true;
    new EventCoordinator(bus, loopUI).subscribeToEvents();
    bus.publish('loopState:stateLoaded', {});
    expect(loopUI.calls.find(c => c.method === 'renderLoopPanel')).toBeDefined();
    expect(loopUI.calls.find(c => c.method === '_updatePauseButtonState')).toMatchObject({ isPaused: true });
  });

  it('loopState:autoRestartChanged updates the checkbox when present', () => {
    const bus = makeBus();
    const loopUI = makeStubLoopUI();
    // Make querySelector return a writable checkbox so we can verify mutation.
    const checkbox = { checked: false };
    loopUI.rootElement = {
      querySelector: (sel) => sel === '#loop-ui-toggle-auto-restart' ? checkbox : null,
    };
    new EventCoordinator(bus, loopUI).subscribeToEvents();
    bus.publish('loopState:autoRestartChanged', { autoRestart: true });
    expect(checkbox.checked).toBe(true);
  });
});
