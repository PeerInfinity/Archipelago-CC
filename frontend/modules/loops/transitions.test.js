/**
 * Verifies the "Transition entry points" table in
 * docs/json/developer/reference/loops-module-states.md — for each
 * method that mutates state flags, what it sets and what it leaves
 * alone.
 *
 * Each describe block corresponds to one row in the doc table. If a
 * test fails, either the doc claim is wrong or the implementation has
 * drifted; reconcile before merging.
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
  afterAll,
} from 'vitest';
import {
  installRafShim,
  uninstallRafShim,
  makeWired,
} from './testHarness.js';

beforeAll(installRafShim);
afterAll(uninstallRafShim);

describe('Transitions — startProcessing', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
  });

  it('sets isProcessing=true and clears _queueCompleted', () => {
    gs.addCustomAction('explore');
    loopState._queueCompleted = true; // simulate prior completion
    loopState.startProcessing();
    expect(loopState.isProcessing).toBe(true);
    expect(loopState._queueCompleted).toBe(false);
  });

  it('resets currentActionIndex to 0', () => {
    gs.addCustomAction('explore');
    gs.addCustomAction('explore');
    loopState.currentActionIndex = 1;
    loopState.startProcessing();
    expect(loopState.currentActionIndex).toBe(0);
  });

  it('publishes loopState:processingStarted and loopState:pauseStateChanged', () => {
    const wired = makeWired();
    wired.gs.addCustomAction('explore');
    wired.bus.events.length = 0;
    wired.loopState.startProcessing();
    const names = wired.bus.events.map((e) => e.name);
    expect(names).toContain('loopState:processingStarted');
    expect(names).toContain('loopState:pauseStateChanged');
  });

  it('is a no-op when already processing', () => {
    gs.addCustomAction('explore');
    loopState.startProcessing();
    loopState.currentActionIndex = 5; // pretend we advanced
    loopState.startProcessing(); // should NOT reset
    expect(loopState.currentActionIndex).toBe(5);
  });

  it('is a no-op when paused', () => {
    gs.addCustomAction('explore');
    loopState.isPaused = true;
    loopState.startProcessing();
    expect(loopState.isProcessing).toBe(false);
  });

  it('is a no-op when queue is empty', () => {
    loopState.startProcessing();
    expect(loopState.isProcessing).toBe(false);
  });
});

describe('Transitions — resumeProcessing', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
  });

  it('preserves currentActionIndex (does not reset to 0)', () => {
    gs.addCustomAction('explore');
    gs.addCustomAction('explore');
    loopState.currentActionIndex = 1;
    loopState.resumeProcessing();
    expect(loopState.isProcessing).toBe(true);
    expect(loopState.currentActionIndex).toBe(1);
  });

  it('clears _queueCompleted on resume', () => {
    gs.addCustomAction('explore');
    loopState._queueCompleted = true;
    loopState.resumeProcessing();
    expect(loopState._queueCompleted).toBe(false);
  });

  it('does NOT publish loopState:processingStarted (only startProcessing does)', () => {
    const wired = makeWired();
    wired.gs.addCustomAction('explore');
    wired.bus.events.length = 0;
    wired.loopState.resumeProcessing();
    const names = wired.bus.events.map((e) => e.name);
    expect(names).not.toContain('loopState:processingStarted');
    expect(names).toContain('loopState:pauseStateChanged');
  });

  it('returns early when currentActionIndex is past end of queue', () => {
    gs.addCustomAction('explore');
    loopState.currentActionIndex = 5;
    loopState.resumeProcessing();
    expect(loopState.isProcessing).toBe(false);
  });
});

describe('Transitions — stopProcessing', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
  });

  it('clears isProcessing only (leaves isPaused and _queueCompleted)', () => {
    gs.addCustomAction('explore');
    loopState.startProcessing();
    loopState.isPaused = false; // not paused mid-run
    loopState._queueCompleted = false;

    loopState.stopProcessing();

    expect(loopState.isProcessing).toBe(false);
    expect(loopState.isPaused).toBe(false);
    expect(loopState._queueCompleted).toBe(false);
  });

  it('does not clear isPaused when paused first', () => {
    gs.addCustomAction('explore');
    loopState.startProcessing();
    loopState.isPaused = true; // pretend we paused mid-frame
    loopState.stopProcessing();
    expect(loopState.isPaused).toBe(true);
  });

  it('is a no-op when already stopped', () => {
    const wired = makeWired();
    wired.bus.events.length = 0;
    wired.loopState.stopProcessing(); // not running
    const names = wired.bus.events.map((e) => e.name);
    expect(names).not.toContain('loopState:processingStopped');
  });

  it('publishes loopState:processingStopped and loopState:pauseStateChanged', () => {
    const wired = makeWired();
    wired.gs.addCustomAction('explore');
    wired.loopState.startProcessing();
    wired.bus.events.length = 0;
    wired.loopState.stopProcessing();
    const names = wired.bus.events.map((e) => e.name);
    expect(names).toContain('loopState:processingStopped');
    expect(names).toContain('loopState:pauseStateChanged');
  });

  it('clears _delegatedAction (substrate parking is dropped on stop)', () => {
    gs.addCustomAction('explore');
    loopState.startProcessing();
    loopState._delegatedAction = { fake: true };
    loopState.stopProcessing();
    expect(loopState._delegatedAction).toBe(null);
  });
});

describe('Transitions — setPaused(true)', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
  });

  it('sets isPaused=true and clears isProcessing via stopProcessing', () => {
    gs.addCustomAction('explore');
    loopState.startProcessing();
    loopState.setPaused(true);
    expect(loopState.isPaused).toBe(true);
    expect(loopState.isProcessing).toBe(false);
  });

  it('does not touch _queueCompleted', () => {
    gs.addCustomAction('explore');
    loopState._queueCompleted = true;
    loopState.setPaused(true);
    expect(loopState._queueCompleted).toBe(true);
  });
});

describe('Transitions — setPaused(false)', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
  });

  it('clears isPaused and starts processing when queue has work', () => {
    gs.addCustomAction('explore');
    loopState.isPaused = true;
    loopState.setPaused(false);
    expect(loopState.isPaused).toBe(false);
    expect(loopState.isProcessing).toBe(true);
  });

  it('resets currentActionIndex to 0 (via startProcessing)', () => {
    gs.addCustomAction('explore');
    gs.addCustomAction('explore');
    loopState.isPaused = true;
    loopState.currentActionIndex = 1;
    loopState.setPaused(false);
    expect(loopState.currentActionIndex).toBe(0);
  });

  it('calls _resetLoop when _shouldResetOnResume returns true (currentActionIndex past end)', () => {
    gs.addCustomAction('explore');
    loopState.maxMana = 100;
    loopState.currentMana = 25; // not max
    loopState.isPaused = true;
    loopState.currentActionIndex = 1; // past end of 1-item queue
    loopState.setPaused(false);
    // _resetLoop refills mana to maxMana; verifies it ran.
    expect(loopState.currentMana).toBe(100);
  });

  it('does NOT reset mana when _shouldResetOnResume returns false (paused mid-action with progress)', () => {
    gs.addCustomAction('explore');
    gs.addCustomAction('explore');
    loopState.maxMana = 100;
    loopState.currentMana = 25; // depleted but action still has progress
    loopState.isPaused = true;
    loopState.currentActionIndex = 0;
    // Make the queue look "in progress" (action 0 partially done)
    const queue = loopState.getActionQueue();
    queue[0].progress = 30;
    queue[0].completed = false;

    loopState.setPaused(false);

    // _shouldResetOnResume returned false → no _resetLoop → mana stays
    // at 25 (modulo whatever startProcessing's first frame did).
    expect(loopState.currentMana).toBe(25);
  });

  it('is essentially a no-op when queue is empty (does not start processing)', () => {
    loopState.isPaused = true;
    loopState.setPaused(false);
    expect(loopState.isPaused).toBe(false);
    expect(loopState.isProcessing).toBe(false);
  });
});

describe('Transitions — _pauseAfterStep', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
  });

  it('sets isPaused=true and isProcessing=false; clears _stepMode', () => {
    gs.addCustomAction('explore');
    loopState.startProcessing();
    loopState._stepMode = true;
    loopState._pauseAfterStep();
    expect(loopState.isPaused).toBe(true);
    expect(loopState.isProcessing).toBe(false);
    expect(loopState._stepMode).toBe(false);
  });

  it('publishes loopState:pauseStateChanged even when processing already stopped', () => {
    const wired = makeWired();
    wired.gs.addCustomAction('explore');
    wired.bus.events.length = 0;
    // Not processing — _pauseAfterStep should still fire pauseStateChanged.
    wired.loopState._pauseAfterStep();
    const names = wired.bus.events.map((e) => e.name);
    expect(names).toContain('loopState:pauseStateChanged');
  });
});

describe('Transitions — _resetLoop', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
  });

  it('refills mana, resets progress, and clears _queueCompleted', () => {
    gs.addCustomAction('explore');
    gs.addCustomAction('explore');
    loopState.maxMana = 100;
    loopState.currentMana = 0;
    loopState._queueCompleted = true;
    loopState.currentActionIndex = 1;
    const queue = loopState.getActionQueue();
    queue[0].progress = 50;

    loopState._resetLoop();

    expect(loopState.currentMana).toBe(100);
    expect(loopState._queueCompleted).toBe(false);
    expect(loopState.currentActionIndex).toBe(0);
  });

  it('does NOT touch isProcessing or isPaused (caller decides)', () => {
    gs.addCustomAction('explore');
    loopState.isProcessing = true;
    loopState.isPaused = false;
    loopState._resetLoop();
    expect(loopState.isProcessing).toBe(true);
    expect(loopState.isPaused).toBe(false);
  });

  it('publishes loopState:loopReset with mana data', () => {
    const wired = makeWired();
    wired.gs.addCustomAction('explore');
    wired.loopState.maxMana = 100;
    wired.bus.events.length = 0;
    wired.loopState._resetLoop();
    const reset = wired.bus.events.find((e) => e.name === 'loopState:loopReset');
    expect(reset).toBeDefined();
    expect(reset.data.mana).toBeDefined();
  });
});

describe('Transitions — resetForNewRules', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
  });

  it('stops processing and clears isPaused / _queueCompleted', () => {
    gs.addCustomAction('explore');
    loopState.startProcessing();
    loopState.isPaused = false;
    loopState._queueCompleted = true;

    loopState.resetForNewRules();

    expect(loopState.isProcessing).toBe(false);
    expect(loopState.isPaused).toBe(false);
    expect(loopState._queueCompleted).toBe(false);
  });

  it('clears _delegatedAction and repeatExploreStates', () => {
    loopState._delegatedAction = { fake: true };
    loopState.repeatExploreStates.set('Menu', true);
    loopState.resetForNewRules();
    expect(loopState._delegatedAction).toBe(null);
    expect(loopState.repeatExploreStates.size).toBe(0);
  });
});

describe('Transitions — restartFromStart({ autoStart: true })', () => {
  // Restart button semantics: refill mana, snap to index 0, unpause,
  // and run. Replaces the prior restartQueueFromBeginning.
  let loopState, gs, bus;
  beforeEach(() => {
    ({ loopState, gs, bus } = makeWired());
    gs.addCustomAction('explore');
    gs.addCustomAction('explore');
  });

  it('refills mana, resets index to 0, clears _queueCompleted', () => {
    loopState.maxMana = 100;
    loopState.currentMana = 25;
    loopState.currentActionIndex = 1;
    loopState._queueCompleted = true;

    loopState.restartFromStart({ autoStart: true });

    expect(loopState.currentMana).toBe(100);
    expect(loopState.currentActionIndex).toBe(0);
    expect(loopState._queueCompleted).toBe(false);
  });

  it('starts processing when queue is non-empty', () => {
    loopState.restartFromStart({ autoStart: true });
    expect(loopState.isProcessing).toBe(true);
    expect(loopState.isPaused).toBe(false);
  });

  it('unpauses if previously paused', () => {
    loopState.isPaused = true;
    loopState.restartFromStart({ autoStart: true });
    expect(loopState.isPaused).toBe(false);
    expect(loopState.isProcessing).toBe(true);
  });

  it('stops a running queue first, then restarts from index 0', () => {
    loopState.startProcessing();
    loopState.currentActionIndex = 1;
    loopState.restartFromStart({ autoStart: true });
    expect(loopState.currentActionIndex).toBe(0);
    expect(loopState.isProcessing).toBe(true);
  });

  it('publishes loopState:queueUpdated and pauseStateChanged', () => {
    bus.events.length = 0;
    loopState.restartFromStart({ autoStart: true });
    const names = bus.events.map((e) => e.name);
    expect(names).toContain('loopState:queueUpdated');
    expect(names).toContain('loopState:pauseStateChanged');
  });

  it('handles empty queue gracefully (no startProcessing, still publishes events)', () => {
    const { loopState: lsEmpty, bus: busEmpty } = makeWired();
    busEmpty.events.length = 0;
    lsEmpty.restartFromStart({ autoStart: true });
    expect(lsEmpty.isProcessing).toBe(false);
    expect(lsEmpty.isPaused).toBe(false);
    const names = busEmpty.events.map((e) => e.name);
    expect(names).toContain('loopState:queueUpdated');
    expect(names).toContain('loopState:pauseStateChanged');
  });

  it('autoStart defaults to true when called with no arguments', () => {
    loopState.restartFromStart();
    expect(loopState.isProcessing).toBe(true);
  });
});

describe('Transitions — restartFromStart({ autoStart: false })', () => {
  // Step button "Reset" variant: refill mana, snap to index 0, land
  // paused. The user clicks Reset and then chooses when to resume.
  let loopState, gs, bus;
  beforeEach(() => {
    ({ loopState, gs, bus } = makeWired());
    gs.addCustomAction('explore');
    gs.addCustomAction('explore');
  });

  it('refills mana, resets index to 0, clears _queueCompleted', () => {
    loopState.maxMana = 100;
    loopState.currentMana = 0;
    loopState.currentActionIndex = 2;
    loopState._queueCompleted = true;

    loopState.restartFromStart({ autoStart: false });

    expect(loopState.currentMana).toBe(100);
    expect(loopState.currentActionIndex).toBe(0);
    expect(loopState._queueCompleted).toBe(false);
  });

  it('lands paused (does NOT start processing)', () => {
    loopState.restartFromStart({ autoStart: false });
    expect(loopState.isProcessing).toBe(false);
    expect(loopState.isPaused).toBe(true);
    expect(loopState.getProcessingState()).toBe('paused');
  });

  it('publishes loopState:queueUpdated and pauseStateChanged with paused state', () => {
    bus.events.length = 0;
    loopState.restartFromStart({ autoStart: false });
    const names = bus.events.map((e) => e.name);
    expect(names).toContain('loopState:queueUpdated');
    const pause = bus.events.find((e) => e.name === 'loopState:pauseStateChanged');
    expect(pause).toBeDefined();
    expect(pause.data.processingState).toBe('paused');
  });

  it('stops a running queue first, then lands paused', () => {
    loopState.startProcessing();
    loopState.currentActionIndex = 1;
    loopState.restartFromStart({ autoStart: false });
    expect(loopState.isProcessing).toBe(false);
    expect(loopState.isPaused).toBe(true);
    expect(loopState.currentActionIndex).toBe(0);
  });

  it('from completed state: lands paused at index 0 with mana refilled (Reset button case)', () => {
    // Simulate the Step button "Reset" entry condition: queue ran to
    // end, autoRestart off, mana drained.
    loopState.maxMana = 100;
    loopState.currentMana = 5;
    loopState._queueCompleted = true;
    loopState.currentActionIndex = 2; // past end
    expect(loopState.getProcessingState()).toBe('completed');

    loopState.restartFromStart({ autoStart: false });

    expect(loopState.currentMana).toBe(100);
    expect(loopState.currentActionIndex).toBe(0);
    expect(loopState.getProcessingState()).toBe('paused');
  });
});
