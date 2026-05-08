/**
 * End-to-end tests for the Step button on the loops panel.
 *
 * Drives loopState.step() through the real _processFrame loop with
 * instantMode = true so each frame completes exactly one action. RAF
 * is mocked as a no-op so we control ticks manually — call
 * `tick(loopState)` to advance one frame.
 *
 * Covers the no-substrate path (the substrate-delegation path has
 * its own coverage in loopState.test.js).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LoopState } from './loopState.js';
import { GameState } from '../gameState/state.js';

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

function makeWiredLoopState() {
  const bus = makeBus();
  const gs = new GameState(bus);
  const loopState = new LoopState();
  const dispatcher = makeStubDispatcher();
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
      insertLocationCheckAt: (l, r, i, lr) => gs.insertLocationCheckAt(l, r, i, lr),
      insertCustomActionAt: (a, r, i, p) => gs.insertCustomActionAt(a, r, i, p),
    },
  });
  return { loopState, gs, bus, dispatcher };
}

/**
 * Drive one animation frame. We pass timestamps that advance by 16ms
 * each call so deltaTime calculations don't blow up; with instantMode
 * the action completes in a single frame regardless.
 */
let frameClock = 1000;
function tick(loopState) {
  // _processFrame uses _lastFrameTime as a bootstrap; the first call
  // primes it and re-schedules. With instantMode we still want one
  // logical frame per tick(), so feed two timestamps when needed.
  loopState._processFrame(frameClock);
  frameClock += 16;
  // If processing is still active and lastFrameTime got primed but no
  // progress was made, push another frame to actually do the work.
  if (loopState.isProcessing && loopState._lastFrameTime === frameClock - 16) {
    loopState._processFrame(frameClock);
    frameClock += 16;
  }
}

describe('Step button — single-step semantics (no substrate)', () => {
  let loopState, gs, bus, dispatcher;

  beforeEach(() => {
    // No-op RAF so _processFrame doesn't try to re-schedule into a
    // browser API that doesn't exist in node.
    globalThis.requestAnimationFrame = vi.fn(() => 1);
    globalThis.cancelAnimationFrame = vi.fn();

    ({ loopState, gs, bus, dispatcher } = makeWiredLoopState());
    loopState.instantMode = true;
    // Plenty of mana so the mana-reset path stays out of the way for
    // the basic single-step tests.
    loopState.maxMana = 100000;
    loopState.currentMana = 100000;
    gs.setStartRegions(['Menu']);
    gs.setCurrentRegion('Menu');
    frameClock = 1000;
  });

  afterEach(() => {
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
  });

  function queueThree() {
    gs.addCustomAction('explore'); // 0
    gs.addCustomAction('explore'); // 1
    gs.addCustomAction('explore'); // 2
  }

  it('sanity: instantMode + tick() completes exactly one action per frame when running', () => {
    queueThree();
    loopState.startProcessing();
    expect(loopState.currentActionIndex).toBe(0);
    expect(loopState.isProcessing).toBe(true);

    tick(loopState);
    expect(loopState.currentActionIndex).toBe(1);
    expect(loopState.isProcessing).toBe(true);
  });

  it('Step from idle: runs one action and lands in paused', () => {
    queueThree();
    expect(loopState.getProcessingState()).toBe('idle');

    loopState.step();
    // step() flipped _stepMode and called startProcessing().
    expect(loopState._stepMode).toBe(true);
    expect(loopState.isProcessing).toBe(true);

    tick(loopState);

    expect(loopState.currentActionIndex).toBe(1);
    expect(loopState.isPaused).toBe(true);
    expect(loopState.isProcessing).toBe(false);
    expect(loopState._stepMode).toBe(false);
    expect(loopState.getProcessingState()).toBe('paused');
  });

  it('Step from paused: advances exactly one more action and re-pauses', () => {
    queueThree();
    loopState.step();
    tick(loopState);
    expect(loopState.currentActionIndex).toBe(1);
    expect(loopState.getProcessingState()).toBe('paused');

    loopState.step();
    expect(loopState._stepMode).toBe(true);
    expect(loopState.isProcessing).toBe(true);
    tick(loopState);

    expect(loopState.currentActionIndex).toBe(2);
    expect(loopState.getProcessingState()).toBe('paused');
    expect(loopState._stepMode).toBe(false);
  });

  it('Three Step clicks complete three actions exactly', () => {
    queueThree();
    loopState.step(); tick(loopState);
    loopState.step(); tick(loopState);
    loopState.step(); tick(loopState);

    // Last action took us off the end of the queue → completed state.
    expect(loopState.getProcessingState()).toBe('completed');
    expect(loopState._stepMode).toBe(false);
  });

  it('Step on the LAST action: lands in completed (not paused)', () => {
    gs.addCustomAction('explore');
    loopState.step();
    tick(loopState);

    expect(loopState._queueCompleted).toBe(true);
    expect(loopState.getProcessingState()).toBe('completed');
    expect(loopState._stepMode).toBe(false);
  });

  it('Step is a no-op when isProcessing is true (e.g., user spams the button)', () => {
    queueThree();
    loopState.startProcessing();
    expect(loopState.isProcessing).toBe(true);
    const before = loopState.currentActionIndex;

    loopState.step();
    // _stepMode must NOT get set on a running queue — otherwise a
    // currently-running multi-action run would suddenly halt after
    // its next action completes, surprising the user.
    expect(loopState._stepMode).toBe(false);
    expect(loopState.currentActionIndex).toBe(before);
  });

  it('Step is a no-op on an empty queue', () => {
    expect(loopState.getActionQueue().length).toBe(0);
    loopState.step();
    expect(loopState._stepMode).toBe(false);
    expect(loopState.isProcessing).toBe(false);
  });

  it('Step from completed-with-new-actions resumes from currentActionIndex (not from 0)', () => {
    // Run the queue to completion, then append a new action.
    gs.addCustomAction('explore'); // index 0
    loopState.step(); tick(loopState);
    expect(loopState.getProcessingState()).toBe('completed');
    expect(loopState.currentActionIndex).toBe(1);

    // Append a 2nd action AFTER completion.
    gs.addCustomAction('explore'); // index 1

    loopState.step();
    // step() should have called resumeProcessing() (not startProcessing,
    // which would reset currentActionIndex to 0 and re-walk action 0).
    expect(loopState.isProcessing).toBe(true);
    expect(loopState.currentActionIndex).toBe(1);

    tick(loopState);
    expect(loopState.currentActionIndex).toBe(2);
    // Off the end again → completed.
    expect(loopState.getProcessingState()).toBe('completed');
  });

  it('Step from completed with NO new actions is a no-op', () => {
    gs.addCustomAction('explore');
    loopState.step(); tick(loopState);
    expect(loopState.getProcessingState()).toBe('completed');
    const idxBefore = loopState.currentActionIndex;

    loopState.step();
    expect(loopState._stepMode).toBe(false);
    expect(loopState.isProcessing).toBe(false);
    expect(loopState.currentActionIndex).toBe(idxBefore);
  });

  it('Step publishes pauseStateChanged so the Pause/Resume label refreshes', () => {
    queueThree();
    bus.events.length = 0;

    loopState.step();
    tick(loopState);

    const pauseEvents = bus.events.filter(e => e.name === 'loopState:pauseStateChanged');
    // Expect at least one event landing in the paused state.
    const pausedEvent = pauseEvents.find(e => e.data.processingState === 'paused');
    expect(pausedEvent).toBeDefined();
  });
});

describe('Step button — interaction with mana reset', () => {
  let loopState, gs, bus, dispatcher;

  beforeEach(() => {
    globalThis.requestAnimationFrame = vi.fn(() => 1);
    globalThis.cancelAnimationFrame = vi.fn();

    ({ loopState, gs, bus, dispatcher } = makeWiredLoopState());
    loopState.instantMode = true;
    gs.setStartRegions(['Menu']);
    gs.setCurrentRegion('Menu');
    frameClock = 1000;
  });

  afterEach(() => {
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
  });

  it('Step that triggers an out-of-mana reset: reset counts as the step, lands in paused', () => {
    // Mid-action OOM (not instantMode): mana hits 0 before progress
    // reaches 100, so _resetLoop fires from the OOM check. Step mode
    // forces the pause path. (The instantMode-completion-with-OOM
    // edge case is covered separately in manaReset.test.js — both
    // paths now end in the same "paused at index 0, mana refilled"
    // shape.)
    loopState.instantMode = false;
    gs.addCustomAction('explore'); // index 0  (cost 50 fallback)
    gs.addCustomAction('explore'); // index 1
    loopState.maxMana = 100;
    loopState.currentMana = 5; // ~10% of action 0's cost

    loopState.step();
    // Pump frames until we either complete action 0 or hit OOM. Cap
    // iterations so a runaway loop fails the test instead of hanging.
    for (let i = 0; i < 200; i++) {
      if (!loopState.isProcessing) break;
      tick(loopState);
    }

    // The OOM reset fired before the action could complete → _resetLoop
    // ran, which under _stepMode forces the pause path regardless of
    // autoRestartQueue.
    expect(loopState.isProcessing).toBe(false);
    expect(loopState.isPaused).toBe(true);
    expect(loopState._stepMode).toBe(false);
    // After reset, we should be back at action 0 with mana refilled.
    expect(loopState.currentActionIndex).toBe(0);
    expect(loopState.currentMana).toBe(loopState.maxMana);
  });
});

describe('Step button — autoRestartQueue interaction', () => {
  let loopState, gs, bus;

  beforeEach(() => {
    globalThis.requestAnimationFrame = vi.fn(() => 1);
    globalThis.cancelAnimationFrame = vi.fn();

    ({ loopState, gs, bus } = makeWiredLoopState());
    loopState.instantMode = true;
    loopState.maxMana = 100000;
    loopState.currentMana = 100000;
    gs.setStartRegions(['Menu']);
    gs.setCurrentRegion('Menu');
    frameClock = 1000;
  });

  afterEach(() => {
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
  });

  it('Step on the last action with autoRestartQueue: still stops after one action', () => {
    // With autoRestartQueue on, completing the last action wraps to
    // index 0. Step mode must override that and stop anyway —
    // otherwise Step would loop forever on a 1-action queue.
    gs.addCustomAction('explore');
    loopState.setAutoRestartQueue(true);

    loopState.step();
    tick(loopState);

    // Behavior under audit: with autoRestartQueue=true, the queue
    // wraps and isProcessing stays true. _stepMode is supposed to
    // pause it. Verify what actually happens.
    expect(loopState.isProcessing).toBe(false);
    expect(loopState._stepMode).toBe(false);
  });
});
