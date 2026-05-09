/**
 * Verifies the "Settings that influence transitions" section of
 * docs/json/developer/reference/loops-module-states.md:
 *
 *   - setAutoRestartQueue / setAutoResumeOnNewAction /
 *     setAutoRemoveCompleted setter shape (which mutate state, which
 *     publish events, which trigger side effects).
 *   - autoRestartQueue at queue-end: snap to index 0 and continue
 *     vs transition to 'completed'.
 *   - _stepMode override: forces pause path even with autoRestart=true.
 *
 * The OOM-side autoRestart effects are already covered in
 * manaReset.test.js; this file focuses on the queue-end branch in
 * _completeCurrentAction (loopState.js:1216).
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
  makeTicker,
} from './testHarness.js';

beforeAll(installRafShim);
afterAll(uninstallRafShim);

describe('setAutoRestartQueue — setter shape', () => {
  let loopState, bus;
  beforeEach(() => {
    ({ loopState, bus } = makeWired());
  });

  it('sets the flag', () => {
    loopState.setAutoRestartQueue(true);
    expect(loopState.autoRestartQueue).toBe(true);
    loopState.setAutoRestartQueue(false);
    expect(loopState.autoRestartQueue).toBe(false);
  });

  it('publishes loopState:autoRestartChanged with the new value', () => {
    bus.events.length = 0;
    loopState.setAutoRestartQueue(true);
    const evt = bus.events.find((e) => e.name === 'loopState:autoRestartChanged');
    expect(evt).toBeDefined();
    expect(evt.data.autoRestart).toBe(true);
  });

  it('does NOT change state flags when toggled in completed', () => {
    loopState._queueCompleted = true;
    expect(loopState.getProcessingState()).toBe('completed');

    loopState.setAutoRestartQueue(true);

    // Setting the flag does not retroactively restart the queue.
    expect(loopState.isProcessing).toBe(false);
    expect(loopState._queueCompleted).toBe(true);
    expect(loopState.getProcessingState()).toBe('completed');
  });

  it('does NOT change state flags when toggled in idle', () => {
    expect(loopState.getProcessingState()).toBe('idle');
    loopState.setAutoRestartQueue(true);
    expect(loopState.getProcessingState()).toBe('idle');
  });
});

describe('setAutoResumeOnNewAction — setter shape', () => {
  let loopState, bus;
  beforeEach(() => {
    ({ loopState, bus } = makeWired());
  });

  it('sets the flag', () => {
    loopState.setAutoResumeOnNewAction(true);
    expect(loopState.autoResumeOnNewAction).toBe(true);
    loopState.setAutoResumeOnNewAction(false);
    expect(loopState.autoResumeOnNewAction).toBe(false);
  });

  it('does NOT publish an event (no loopState:autoResumeChanged exists)', () => {
    bus.events.length = 0;
    loopState.setAutoResumeOnNewAction(true);
    const names = bus.events.map((e) => e.name);
    expect(names).not.toContain('loopState:autoResumeChanged');
  });

  it('toggling on completed switches getProcessingState to "waiting"', () => {
    loopState._queueCompleted = true;
    expect(loopState.getProcessingState()).toBe('completed');
    loopState.setAutoResumeOnNewAction(true);
    expect(loopState.getProcessingState()).toBe('waiting');
  });
});

describe('setAutoRemoveCompleted — setter shape', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
  });

  it('sets the flag', () => {
    loopState.setAutoRemoveCompleted(true);
    expect(loopState.autoRemoveCompleted).toBe(true);
    loopState.setAutoRemoveCompleted(false);
    expect(loopState.autoRemoveCompleted).toBe(false);
  });

  it('calls removeCompletedActions when enabling (immediate prune)', () => {
    let called = 0;
    const orig = loopState.removeCompletedActions.bind(loopState);
    loopState.removeCompletedActions = () => { called++; orig(); };

    loopState.setAutoRemoveCompleted(true);
    expect(called).toBe(1);
  });

  it('does NOT call removeCompletedActions when disabling', () => {
    loopState.autoRemoveCompleted = true;
    let called = 0;
    loopState.removeCompletedActions = () => { called++; };
    loopState.setAutoRemoveCompleted(false);
    expect(called).toBe(0);
  });

  it('does not affect queue state by itself (just toggles the flag)', () => {
    gs.addCustomAction('explore');
    loopState.startProcessing();
    loopState.setAutoRemoveCompleted(true);
    // Flag toggled, but processing is unaffected (unless the prune
    // happens to remove the running action — not the case here).
    expect(loopState.isProcessing).toBe(true);
  });
});

describe('autoRestartQueue — _completeCurrentAction queue-end branch', () => {
  // The queue-end branch lives in _completeCurrentAction
  // (loopState.js:1170-1192). When the queue index reaches the end,
  // autoRestartQueue=true snaps to 0 and continues; =false transitions
  // to 'completed' (isProcessing=false, _queueCompleted=true).
  let loopState, gs;
  let tick;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
    tick = makeTicker();
    gs.maxMana = 100000;
    gs.currentMana = 100000; // enough mana not to OOM
    loopState.instantMode = true;
  });

  it('autoRestart=false: queue ends → "completed" with _queueCompleted=true', () => {
    gs.addCustomAction('explore');
    loopState.setAutoRestartQueue(false);
    loopState.startProcessing();

    // Pump until the queue lands in completed.
    for (let i = 0; i < 20 && loopState.isProcessing; i++) tick(loopState);

    expect(loopState.isProcessing).toBe(false);
    expect(loopState._queueCompleted).toBe(true);
    expect(loopState.isPaused).toBe(false);
    expect(loopState.getProcessingState()).toBe('completed');
  });

  it('autoRestart=true: queue ends → snaps to index 0, stays running', () => {
    gs.addCustomAction('explore');
    loopState.setAutoRestartQueue(true);
    loopState.startProcessing();

    // Pump enough frames that the action completes once and the queue
    // wraps. Verify it's still processing (didn't transition to
    // completed) and currentActionIndex is back at 0.
    for (let i = 0; i < 5; i++) tick(loopState);

    expect(loopState.isProcessing).toBe(true);
    expect(loopState._queueCompleted).toBe(false);
    expect(loopState.currentActionIndex).toBe(0);
  });

  it('autoRestart=true clears action progress on wrap (re-runs from clean state)', () => {
    gs.addCustomAction('explore');
    loopState.setAutoRestartQueue(true);
    loopState.startProcessing();

    // First completion: action reached 100, then index wrapped → 0,
    // and _resetActionsProgress() should have cleared progress on
    // every queue entry.
    for (let i = 0; i < 5; i++) tick(loopState);

    const queue = loopState.getActionQueue();
    // The action is currently being processed again (instant mode means
    // it'll be at 100 again on the next frame), so we don't compare to
    // 0; instead, verify the progress map for index 0 is in the
    // "running" range, not stuck completed=true from the prior run.
    expect(queue[0].completed).not.toBe(true);
  });

  it('autoRestart=true + _stepMode: queue wraps to index 0, then step pauses (does NOT continue running)', () => {
    // Subtle: with autoRestart=true the queue-end branch resets the
    // index to 0 (and clears action progress) BEFORE _pauseAfterStep
    // fires for step mode. So the end state is "paused at index 0",
    // not "completed". The doc's claim that step mode "forces the
    // pause path" holds — the queue does pause — but _queueCompleted
    // never flips because the autoRestart wrap takes the alternate
    // branch.
    gs.addCustomAction('explore');
    loopState.setAutoRestartQueue(true);
    loopState.step(); // sets _stepMode=true and starts

    for (let i = 0; i < 10 && loopState.isProcessing; i++) tick(loopState);

    expect(loopState.isProcessing).toBe(false);
    expect(loopState.isPaused).toBe(true);
    expect(loopState._queueCompleted).toBe(false);
    expect(loopState._stepMode).toBe(false);
    expect(loopState.currentActionIndex).toBe(0);
  });
});

describe('autoRestart vs autoResume — co-existence (LoopState level)', () => {
  // The doc notes the UI enforces mutual exclusion but LoopState does
  // not. If both are programmatically true, autoRestartQueue wins
  // because the queue-end branch fires first and prevents
  // _queueCompleted from ever becoming true (so 'waiting' is
  // unreachable).
  let loopState, gs;
  let tick;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
    tick = makeTicker();
    gs.maxMana = 100000;
    gs.currentMana = 100000;
    loopState.instantMode = true;
  });

  it('both flags set → autoRestart wins; never reaches "waiting" state', () => {
    gs.addCustomAction('explore');
    loopState.setAutoRestartQueue(true);
    loopState.setAutoResumeOnNewAction(true);
    loopState.startProcessing();

    for (let i = 0; i < 10; i++) tick(loopState);

    // autoRestart kept the queue running. _queueCompleted never
    // flipped to true, so 'waiting' is unreachable.
    expect(loopState.isProcessing).toBe(true);
    expect(loopState._queueCompleted).toBe(false);
    expect(loopState.getProcessingState()).toBe('running');
  });
});
