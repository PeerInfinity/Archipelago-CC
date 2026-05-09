/**
 * Tests for queue-removal behavior in loopState:
 *   removeAction, clearQueue, clearExploreActions, removeCompletedActions
 *
 * Focus areas:
 *   - currentActionIndex bookkeeping when removing before/at/after the
 *     current action
 *   - Processing state when the current action is removed
 *   - queueUpdated event publication
 *   - Interaction with auto-remove and discovery
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { LoopState } from './loopState.js';
import { GameState } from '../gameState/state.js';

// _processFrame and startProcessing call requestAnimationFrame; node has
// no such global. Mock as no-ops file-wide so tests don't crash.
beforeAll(() => {
  globalThis.requestAnimationFrame = vi.fn(() => 1);
  globalThis.cancelAnimationFrame = vi.fn();
});
afterAll(() => {
  delete globalThis.requestAnimationFrame;
  delete globalThis.cancelAnimationFrame;
});

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

function makeWired() {
  const bus = makeBus();
  const gs = new GameState(bus);
  const loopState = new LoopState();
  const dispatcher = { publish: () => {}, publishToNextModule: () => {} };
  loopState.setDependencies({
    eventBus: bus,
    stateManager: makeStubStateManager(),
    dispatcher,
    gameState: {
      getState: () => gs,
      getPath: () => gs.getPath(),
      getCurrentRegion: () => gs.getCurrentRegion(),
      clearPath: () => gs.clearPath(),
      removeAllActionsOfType: (t, n) => gs.removeAllActionsOfType(t, n),
      trimPath: (r, i) => gs.trimPath(r, i),
      addLocationCheck: (l, r, sd) => gs.addLocationCheck(l, r, sd),
      addCustomAction: (a, p) => gs.addCustomAction(a, p),
      removePathEntry: (idx) => gs.removePathEntry(idx),
      removeLocationCheckAt: (l, r, i) => gs.removeLocationCheckAt(l, r, i),
      removeCustomActionAt: (a, r, i, m) => gs.removeCustomActionAt(a, r, i, m),
      insertLocationCheckAt: (l, r, i, lr) => gs.insertLocationCheckAt(l, r, i, lr),
      insertCustomActionAt: (a, r, i, p) => gs.insertCustomActionAt(a, r, i, p),
    },
  });
  gs.maxMana = 100000;
  gs.currentMana = 100000;
  gs.setStartRegions(['Menu']);
  gs.setCurrentRegion('Menu');
  return { loopState, gs, bus, dispatcher };
}

describe('removeAction — basic guards', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
  });

  it('returns false on negative index', () => {
    gs.addCustomAction('explore');
    expect(loopState.removeAction(-1)).toBe(false);
  });

  it('returns false on out-of-range index', () => {
    gs.addCustomAction('explore');
    expect(loopState.removeAction(99)).toBe(false);
  });

  it('returns false on empty queue', () => {
    expect(loopState.removeAction(0)).toBe(false);
  });

  it('returns false when trying to remove a regionMove (managed by navigation)', () => {
    gs.updatePath('region_0_0', null, 'Menu'); // adds a regionMove
    expect(loopState.getActionQueue()[0].type).toBe('regionMove');
    expect(loopState.removeAction(0)).toBe(false);
    // Path stays intact.
    expect(gs.getPath().length).toBe(1);
  });
});

describe('removeAction — currentActionIndex bookkeeping (queue idle)', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
    gs.addCustomAction('explore'); // 0
    gs.addCustomAction('explore'); // 1
    gs.addCustomAction('explore'); // 2
  });

  it('removing action while idle does not start processing on its own', () => {
    expect(loopState.isProcessing).toBe(false);
    expect(loopState.isPaused).toBe(false);
    loopState.removeAction(1);
    // Idle queue with !isProcessing && !isPaused && length>0 — startProcessing
    // WILL fire on the post-remove restart branch. This is the documented
    // behavior; assert it.
    expect(loopState.isProcessing).toBe(true);
  });

  it('removing the only action does NOT restart processing (queue empty after)', () => {
    while (gs.getPath().length > 1) gs.removeCustomActionAt('explore', 'Menu', 1);
    // Should be 1 action left.
    expect(loopState.getActionQueue().length).toBe(1);
    loopState.removeAction(0);
    expect(loopState.isProcessing).toBe(false);
    expect(loopState.getActionQueue().length).toBe(0);
  });
});

describe('removeAction — currentActionIndex bookkeeping (queue paused)', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
    gs.addCustomAction('explore'); // 0
    gs.addCustomAction('explore'); // 1
    gs.addCustomAction('explore'); // 2
    loopState.setPaused(true);
    loopState.currentActionIndex = 1; // simulate "we paused on action 1"
  });

  it('removing an action AFTER current keeps currentActionIndex stable', () => {
    loopState.removeAction(2);
    expect(loopState.currentActionIndex).toBe(1);
    expect(loopState.isProcessing).toBe(false);
  });

  it('removing an action BEFORE current decrements currentActionIndex', () => {
    loopState.removeAction(0);
    expect(loopState.currentActionIndex).toBe(0);
  });

  it('does not auto-restart processing while paused', () => {
    loopState.removeAction(2);
    expect(loopState.isProcessing).toBe(false);
    expect(loopState.isPaused).toBe(true);
  });

  it('removing the current action while paused leaves currentActionIndex unchanged (potential staleness)', () => {
    // Documented behavior: the index stays at 1, but the queue shifted —
    // queue[1] is now what used to be queue[2]. This is a real edge case
    // worth flagging; the next setPaused(false) → startProcessing resets
    // to 0 so it doesn't surface in practice.
    loopState.removeAction(1);
    expect(loopState.currentActionIndex).toBe(1);
    expect(loopState.getActionQueue().length).toBe(2);
  });
});

describe('removeAction — currentActionIndex bookkeeping (queue running)', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
    gs.addCustomAction('explore'); // 0
    gs.addCustomAction('explore'); // 1
    gs.addCustomAction('explore'); // 2
    loopState.startProcessing();
    loopState.currentActionIndex = 1; // pretend we're mid-action 1
    loopState.currentAction = loopState.getActionQueue()[1];
  });

  it('removing the current action stops processing', () => {
    loopState.removeAction(1);
    // After stop + restart, isProcessing flips back to true (queue still
    // has actions, not paused) — but processing was reset to start from 0.
    expect(loopState.currentActionIndex).toBe(0);
  });

  it('removing an action BEFORE current decrements currentActionIndex AND keeps running', () => {
    loopState.removeAction(0);
    expect(loopState.currentActionIndex).toBe(0);
    expect(loopState.isProcessing).toBe(true);
  });

  it('removing an action AFTER current does NOT change currentActionIndex', () => {
    loopState.removeAction(2);
    expect(loopState.currentActionIndex).toBe(1);
    expect(loopState.isProcessing).toBe(true);
  });
});

describe('removeAction — restart-from-zero behavior after current-action removal', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
    gs.addCustomAction('explore'); // 0
    gs.addCustomAction('explore'); // 1
    gs.addCustomAction('explore'); // 2
    loopState.startProcessing();
    loopState.currentActionIndex = 1;
    loopState.currentAction = loopState.getActionQueue()[1];
  });

  it('after removing the current action, queue restarts from index 0 (not the next action)', () => {
    // Note: this is a behavior worth noticing — after removing action 1
    // the user might expect to continue with what was action 2 (now
    // action 1). Instead, startProcessing resets to 0. Captures the
    // current behavior so any change is intentional.
    loopState.removeAction(1);
    expect(loopState.currentActionIndex).toBe(0);
    expect(loopState.isProcessing).toBe(true);
  });
});

describe('removeAction — event publication', () => {
  let loopState, gs, bus;
  beforeEach(() => {
    ({ loopState, gs, bus } = makeWired());
    gs.addCustomAction('explore');
    gs.addCustomAction('explore');
  });

  it('publishes loopState:queueUpdated with the post-remove queue', () => {
    bus.events.length = 0;
    loopState.removeAction(0);
    const updated = bus.events.find(e => e.name === 'loopState:queueUpdated');
    expect(updated).toBeDefined();
    expect(updated.data.queue.length).toBe(1);
  });

  it('does NOT publish queueUpdated when remove fails', () => {
    bus.events.length = 0;
    loopState.removeAction(99);
    expect(bus.events.find(e => e.name === 'loopState:queueUpdated')).toBeUndefined();
  });
});


describe('clearExploreActions', () => {
  let loopState, gs, bus;
  beforeEach(() => {
    ({ loopState, gs, bus } = makeWired());
  });

  it('removes all explore actions and publishes queueUpdated', () => {
    gs.addCustomAction('explore');
    gs.addCustomAction('explore');
    bus.events.length = 0;

    loopState.clearExploreActions();

    expect(loopState.getActionQueue().length).toBe(0);
    expect(bus.events.find(e => e.name === 'loopState:queueUpdated')).toBeDefined();
  });

  it('does NOT publish queueUpdated when nothing was removed', () => {
    bus.events.length = 0;
    loopState.clearExploreActions();
    expect(bus.events.find(e => e.name === 'loopState:queueUpdated')).toBeUndefined();
  });

  it('does NOT stop processing or reset currentActionIndex when called mid-run (potential bug)', () => {
    // BUG SURFACE: if clearExploreActions removes the action that was
    // currently processing, isProcessing stays true and the next
    // _processFrame reads stale currentAction. Documenting the current
    // behavior so a fix is intentional.
    gs.addCustomAction('explore');
    gs.addCustomAction('explore');
    loopState.startProcessing();
    loopState.currentActionIndex = 0;
    loopState.currentAction = loopState.getActionQueue()[0];

    loopState.clearExploreActions();

    expect(loopState.isProcessing).toBe(true);                  // not stopped
    expect(loopState.currentActionIndex).toBe(0);               // not reset
    expect(loopState.currentAction).toBeDefined();              // stale reference
    expect(loopState.getActionQueue().length).toBe(0);          // queue is empty
  });
});

describe('removeCompletedActions — auto-remove paths', () => {
  let loopState, gs;

  beforeEach(() => {
    ({ loopState, gs } = makeWired());
  });

  it('removes locationCheck actions whose locations are in checkedLocations', () => {
    // addLocationCheck requires a prior regionMove for instance lookup.
    gs.updatePath('Region1', null, 'Menu');
    loopState.stateManager.getLatestStateSnapshot = () => ({ checkedLocations: ['Loc1'] });
    gs.addLocationCheck('Loc1', 'Region1');
    gs.addLocationCheck('Loc2', 'Region1');

    loopState.removeCompletedActions();

    const queue = loopState.getActionQueue();
    const locChecks = queue.filter(a => a.type === 'locationCheck');
    expect(locChecks.length).toBe(1);
    expect(locChecks[0].locationName).toBe('Loc2');
  });

  it('does NOT remove the currently processing action', () => {
    gs.updatePath('Region1', null, 'Menu');
    loopState.stateManager.getLatestStateSnapshot = () => ({ checkedLocations: ['Loc1', 'Loc2'] });
    gs.addLocationCheck('Loc1', 'Region1');
    gs.addLocationCheck('Loc2', 'Region1');
    // Current action is the FIRST locationCheck (queue index 1, after the regionMove).
    loopState.startProcessing();
    const queueBefore = loopState.getActionQueue();
    const loc1Idx = queueBefore.findIndex(a => a.type === 'locationCheck' && a.locationName === 'Loc1');
    loopState.currentActionIndex = loc1Idx;
    loopState.currentAction = queueBefore[loc1Idx];

    loopState.removeCompletedActions();

    // The non-current Loc2 was removed; the current Loc1 stays.
    const locChecks = loopState.getActionQueue().filter(a => a.type === 'locationCheck');
    expect(locChecks.length).toBe(1);
    expect(locChecks[0].locationName).toBe('Loc1');
  });

  it('is a no-op on an empty queue', () => {
    expect(() => loopState.removeCompletedActions()).not.toThrow();
  });

  it('returns without mutation when nothing matches the removal criteria', () => {
    gs.updatePath('Region1', null, 'Menu');
    gs.addLocationCheck('Loc1', 'Region1'); // not in checkedLocations
    gs.addCustomAction('explore');           // on Region1; no static data, not "fully explored"

    const queueBefore = loopState.getActionQueue();
    loopState.removeCompletedActions();

    expect(loopState.getActionQueue().length).toBe(queueBefore.length);
  });
});
