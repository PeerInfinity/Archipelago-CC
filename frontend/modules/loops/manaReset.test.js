/**
 * Tests for the out-of-mana reset path in loopState._processFrame.
 *
 * Drives _processFrame manually (no RAF in node) and exercises:
 *   - basic OOM mid-action triggers _resetLoop
 *   - autoRestartQueue=true continues; =false pauses
 *   - _stepMode forces the pause path regardless of autoRestart
 *   - noManaDepletionReset suppresses the reset and accumulates manaDebt
 *   - multiple consecutive OOM cycles refill correctly
 *   - pauseStateChanged events fire on the pause path
 *   - loopReset events fire on every reset
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { LoopState } from './loopState.js';
import { GameState } from '../gameState/state.js';

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
  gs.setStartRegions(['Menu']);
  gs.setCurrentRegion('Menu');
  return { loopState, gs, bus, dispatcher };
}

let frameClock = 1000;
function tick(loopState) {
  loopState._processFrame(frameClock);
  frameClock += 16;
  // _processFrame sometimes primes _lastFrameTime on the first call and
  // re-schedules without doing work; pump again so the test sees real
  // progress in one tick().
  if (loopState.isProcessing && loopState._lastFrameTime === frameClock - 16) {
    loopState._processFrame(frameClock);
    frameClock += 16;
  }
}

describe('OOM — basic reset path', () => {
  let loopState, gs, bus;
  beforeEach(() => {
    ({ loopState, gs, bus } = makeWired());
    frameClock = 1000;
  });

  it('mid-action mana exhaustion triggers _resetLoop and refills mana', () => {
    gs.addCustomAction('explore'); // cost 50 (default)
    gs.maxMana = 100;
    gs.currentMana = 5; // ~10% of action 0's cost
    loopState.startProcessing();

    // Pump frames until processing stops or we hit a safety cap.
    for (let i = 0; i < 200 && loopState.isProcessing; i++) tick(loopState);

    // No autoRestart: the OOM path pauses.
    expect(loopState.isPaused).toBe(true);
    expect(loopState.isProcessing).toBe(false);
    // _resetLoop refilled mana to max.
    expect(gs.currentMana).toBe(gs.maxMana);
    // Action progress was reset to 0; index reset to 0.
    expect(loopState.currentActionIndex).toBe(0);
  });

  it('publishes loopState:loopReset on the OOM reset', () => {
    gs.addCustomAction('explore');
    gs.maxMana = 100;
    gs.currentMana = 5;
    loopState.startProcessing();
    bus.events.length = 0;

    for (let i = 0; i < 200 && loopState.isProcessing; i++) tick(loopState);

    expect(bus.events.find(e => e.name === 'loopState:loopReset')).toBeDefined();
  });

  it('publishes loopState:pauseStateChanged with paused state after OOM (autoRestart=false)', () => {
    gs.addCustomAction('explore');
    gs.maxMana = 100;
    gs.currentMana = 5;
    loopState.startProcessing();
    bus.events.length = 0;

    for (let i = 0; i < 200 && loopState.isProcessing; i++) tick(loopState);

    const pauseEvents = bus.events.filter(e => e.name === 'loopState:pauseStateChanged');
    const paused = pauseEvents.find(e => e.data.processingState === 'paused');
    expect(paused).toBeDefined();
  });
});

describe('OOM — autoRestartQueue=true continues processing', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
    frameClock = 1000;
  });

  it('does NOT transition to paused after OOM when autoRestart is on', () => {
    gs.addCustomAction('explore');
    gs.addCustomAction('explore');
    loopState.setAutoRestartQueue(true);
    gs.maxMana = 100;
    gs.currentMana = 5;
    loopState.instantMode = false;
    loopState.startProcessing();

    // Tick enough for OOM to fire once.
    for (let i = 0; i < 50; i++) tick(loopState);

    // After the OOM reset under autoRestart, processing should still be
    // running (the queue continues from action 0).
    expect(loopState.isProcessing).toBe(true);
    expect(loopState.isPaused).toBe(false);
  });
});

describe('OOM — noManaDepletionReset suppresses the reset', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
    frameClock = 1000;
  });

  it('mana goes negative and manaDebt tracks how negative', () => {
    gs.addCustomAction('explore');
    gs.maxMana = 100;
    gs.currentMana = 5;
    gs.noManaDepletionReset = true;
    loopState.instantMode = true;
    loopState.startProcessing();

    // One tick completes the action under instantMode (cost ~50, current 5 → -45).
    tick(loopState);

    // Mana went negative, no reset fired, manaDebt records the negative excess.
    expect(gs.currentMana).toBeLessThan(0);
    expect(gs.manaDebt).toBeGreaterThanOrEqual(45);
    // Without the reset, the action completed normally and we advance.
    expect(loopState.currentActionIndex).toBeGreaterThan(0);
  });

  it('manaDebt accumulates the MAX (deepest) negative across multiple deductions', () => {
    gs.maxMana = 100;
    gs.currentMana = 5;
    gs.noManaDepletionReset = true;

    // Drive deductions directly via gameState.
    loopState._gs().deductMana(20); // -15
    loopState._gs().deductMana(10); // -25
    loopState._gs().deductMana(5);  // -30
    expect(gs.manaDebt).toBe(30);
  });
});

describe('OOM — _stepMode forces pause path regardless of autoRestart', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
    frameClock = 1000;
  });

  it('OOM during a step lands paused even with autoRestartQueue=true', () => {
    gs.addCustomAction('explore');
    gs.addCustomAction('explore');
    loopState.setAutoRestartQueue(true);
    gs.maxMana = 100;
    gs.currentMana = 5;
    loopState.instantMode = false;

    loopState.step();
    for (let i = 0; i < 200 && loopState.isProcessing; i++) tick(loopState);

    // Even with autoRestart, step mode forces the pause path.
    expect(loopState.isProcessing).toBe(false);
    expect(loopState.isPaused).toBe(true);
    // Step mode cleared after the reset.
    expect(loopState._stepMode).toBe(false);
  });
});

describe('OOM — multiple consecutive resets', () => {
  let loopState, gs, bus;
  beforeEach(() => {
    ({ loopState, gs, bus } = makeWired());
    frameClock = 1000;
  });

  it('autoRestart with low mana triggers multiple resets in a chain', () => {
    gs.addCustomAction('explore');
    loopState.setAutoRestartQueue(true);
    gs.maxMana = 30; // less than action cost (50)
    gs.currentMana = 30;
    loopState.instantMode = false;
    loopState.startProcessing();
    bus.events.length = 0;

    // Tick a lot — every cycle should hit OOM, reset, retry.
    for (let i = 0; i < 500 && loopState.isProcessing; i++) tick(loopState);

    // Still processing — autoRestart never lets the queue end.
    expect(loopState.isProcessing).toBe(true);
    // Multiple loopReset events — proves we cycled through OOM at least
    // a few times rather than getting stuck.
    const resetEvents = bus.events.filter(e => e.name === 'loopState:loopReset');
    expect(resetEvents.length).toBeGreaterThanOrEqual(2);
  });
});

describe('OOM — instantMode + completion + OOM in one frame', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
    frameClock = 1000;
  });

  it('non-step instantMode: action completes, advances index, then OOM check fires and resets', () => {
    // _processFrame ordering: completion runs first, then the OOM check.
    // When the queue still has more actions, isProcessing stays true and
    // the OOM check runs — _resetLoop resets currentActionIndex back to 0
    // and refills mana.
    gs.addCustomAction('explore');
    gs.addCustomAction('explore');
    gs.maxMana = 100;
    gs.currentMana = 50; // exactly the action cost
    loopState.instantMode = true;
    loopState.startProcessing();

    tick(loopState);

    // Reset happened — index back to 0, mana refilled.
    expect(loopState.currentActionIndex).toBe(0);
    expect(gs.currentMana).toBe(100);
    // No autoRestart → paused after the reset.
    expect(loopState.isPaused).toBe(true);
  });

  it('step mode + instantMode: completion pauses, OOM still fires and resets', () => {
    // Step + completion + OOM all in one frame: _completeCurrentAction
    // calls _pauseAfterStep (isProcessing → false), then the OOM check
    // still runs (it only skips when _queueCompleted is true). Reset
    // refills mana and snaps the queue back to index 0; the user lands
    // in "paused at index 0 with mana refilled" — ready for the next
    // Step click rather than stranded at mana=0.
    gs.addCustomAction('explore');
    gs.addCustomAction('explore');
    gs.maxMana = 100;
    gs.currentMana = 50;
    loopState.instantMode = true;

    loopState.step();
    tick(loopState);

    // Reset fired: index back to 0, mana refilled, paused.
    expect(loopState.currentActionIndex).toBe(0);
    expect(gs.currentMana).toBe(100);
    expect(loopState.isPaused).toBe(true);
    expect(loopState.isProcessing).toBe(false);
    expect(loopState._stepMode).toBe(false);
  });
});

describe('OOM — gameState.deductMana semantics', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
  });

  it('clamps to 0 when noManaDepletionReset is OFF (default)', () => {
    gs.maxMana = 100;
    gs.currentMana = 10;
    loopState._gs().deductMana(50);
    expect(gs.currentMana).toBe(0);
    expect(gs.manaDebt).toBe(0);
  });

  it('emits gameState:manaChanged on every deduction', () => {
    const bus = loopState.eventBus;
    gs.maxMana = 100;
    gs.currentMana = 50;
    bus.events.length = 0;

    loopState._gs().deductMana(10);
    loopState._gs().deductMana(10);

    const manaEvents = bus.events.filter(e => e.name === 'gameState:manaChanged');
    expect(manaEvents.length).toBe(2);
    expect(manaEvents[1].data).toMatchObject({ current: 30, max: 100 });
  });

  it('refillMana brings currentMana back to maxMana and emits manaChanged', () => {
    const bus = loopState.eventBus;
    gs.maxMana = 100;
    gs.currentMana = 0;
    bus.events.length = 0;

    loopState._gs().refillMana();

    expect(gs.currentMana).toBe(100);
    expect(bus.events.find(e => e.name === 'gameState:manaChanged')).toBeDefined();
  });
});

describe('OOM — recalculateMaxMana does NOT cap currentMana (max = starting mana, not a ceiling)', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
  });

  it('leaves currentMana above the new max (maxMana is starting mana, not a cap)', () => {
    gs.maxMana = 200;
    gs.currentMana = 150;
    gs.manaPerItem = 10;
    // Snapshot with no items → base 100. New maxMana = 100, but currentMana
    // is NOT clamped down to it: maxMana is the loop's STARTING mana (and the
    // mana-bar max), never a ceiling. Matches gameState state.test.js.
    loopState._gs().recalculateMaxMana({ inventory: {} });
    expect(gs.maxMana).toBe(100);
    expect(gs.currentMana).toBe(150);
  });

  it('leaves currentMana alone when below the new max', () => {
    gs.maxMana = 100;
    gs.currentMana = 30;
    gs.manaPerItem = 10;
    loopState._gs().recalculateMaxMana({ inventory: { item1: 5 } });
    expect(gs.maxMana).toBe(150);
    expect(gs.currentMana).toBe(30);
  });
});
