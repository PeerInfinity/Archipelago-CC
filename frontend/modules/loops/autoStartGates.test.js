/**
 * Verifies the auto-start gates documented in
 * docs/json/developer/reference/loops-module-states.md under
 * "Auto-start when an action is added" and "Auto-start when an action
 * is removed".
 *
 * The gates live in:
 *   - queueAction (loopState.js:352): !isProcessing && !isPaused && !_queueCompleted
 *   - removeAction (loopState.js:404): !isProcessing && queueLen > 0 && !isPaused
 *
 * The two paths disagree on whether _queueCompleted blocks auto-start.
 * The doc flags this as an asymmetry; tests below pin the current
 * behavior so any future fix is intentional.
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

describe('queueAction — auto-start gate', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
  });

  it('idle: auto-starts processing on first action', () => {
    expect(loopState.getProcessingState()).toBe('idle');
    loopState.queueAction({ type: 'customAction', actionName: 'explore' });
    expect(loopState.isProcessing).toBe(true);
  });

  it('paused: does NOT auto-start', () => {
    loopState.isPaused = true;
    loopState.queueAction({ type: 'customAction', actionName: 'explore' });
    expect(loopState.isProcessing).toBe(false);
    expect(loopState.isPaused).toBe(true);
  });

  it('running: does NOT call startProcessing again (no double-start)', () => {
    gs.addCustomAction('explore');
    loopState.startProcessing();
    const idxBefore = loopState.currentActionIndex;
    // Mutate index to detect a stray startProcessing (which would reset to 0).
    loopState.currentActionIndex = 5;
    loopState.queueAction({ type: 'customAction', actionName: 'explore' });
    // Still running; index not reset to 0.
    expect(loopState.isProcessing).toBe(true);
    expect(loopState.currentActionIndex).toBe(5);
    void idxBefore;
  });

  it('completed: does NOT auto-start (gated by !_queueCompleted)', () => {
    loopState._queueCompleted = true;
    expect(loopState.getProcessingState()).toBe('completed');
    loopState.queueAction({ type: 'customAction', actionName: 'explore' });
    expect(loopState.isProcessing).toBe(false);
    expect(loopState._queueCompleted).toBe(true);
  });

  it('waiting: does NOT auto-start in queueAction (eventCoordinator handles auto-resume)', () => {
    loopState._queueCompleted = true;
    loopState.autoResumeOnNewAction = true;
    expect(loopState.getProcessingState()).toBe('waiting');
    loopState.queueAction({ type: 'customAction', actionName: 'explore' });
    // queueAction itself does not start. The eventCoordinator's
    // _handlePathUpdated subscriber is what resumes from 'waiting'.
    expect(loopState.isProcessing).toBe(false);
  });
});

describe('removeAction — auto-stop when removing the running action', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
  });

  it('removing the currently processing action stops processing first', () => {
    gs.addCustomAction('explore');
    gs.addCustomAction('explore');
    loopState.startProcessing();
    expect(loopState.isProcessing).toBe(true);

    // currentActionIndex is 0; remove that one.
    loopState.removeAction(0);

    // Removed: gate at line 404 fires and restarts (queue still has 1 item).
    // Current action index after removal: was 0; queue shifted; now points
    // at what was index 1 (the next action), which is now at index 0.
    expect(loopState.isProcessing).toBe(true);
    expect(loopState.currentActionIndex).toBe(0);
  });

  it('removing the only action and nothing left → does NOT restart (queue empty)', () => {
    gs.addCustomAction('explore');
    loopState.startProcessing();
    loopState.removeAction(0);
    expect(loopState.isProcessing).toBe(false);
  });
});

describe('removeAction — auto-restart gate per source state', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
    gs.addCustomAction('explore');
    gs.addCustomAction('explore');
  });

  it('idle (queue still non-empty) → restarts', () => {
    // Force into a "stopped but not paused, queue intact" state.
    loopState.isProcessing = false;
    loopState.isPaused = false;
    loopState._queueCompleted = false;

    // Now remove a non-current action and verify auto-restart fires.
    loopState.removeAction(1);
    expect(loopState.isProcessing).toBe(true);
  });

  it('paused → stays paused (gated by !isPaused)', () => {
    loopState.isPaused = true;
    loopState.removeAction(1);
    expect(loopState.isProcessing).toBe(false);
    expect(loopState.isPaused).toBe(true);
  });

  it('running, removed non-current action → no stop, no restart, queue keeps running', () => {
    loopState.startProcessing();
    expect(loopState.currentActionIndex).toBe(0);
    // Remove action 1 (not the current).
    loopState.removeAction(1);
    expect(loopState.isProcessing).toBe(true);
    expect(loopState.currentActionIndex).toBe(0);
  });

  it('ASYMMETRY: completed → restarts on remove (NOT gated by _queueCompleted)', () => {
    // queueAction would skip auto-start in this state; removeAction
    // does not. This pins the asymmetry flagged in the doc.
    loopState.isProcessing = false;
    loopState.isPaused = false;
    loopState._queueCompleted = true;
    expect(loopState.getProcessingState()).toBe('completed');

    loopState.removeAction(1);
    // Auto-restart fires. _queueCompleted is NOT cleared by
    // removeAction; startProcessing → _beginProcessing clears it.
    expect(loopState.isProcessing).toBe(true);
    expect(loopState._queueCompleted).toBe(false);
  });

  it('ASYMMETRY: waiting → restarts on remove (also not gated by _queueCompleted)', () => {
    loopState.isProcessing = false;
    loopState.isPaused = false;
    loopState._queueCompleted = true;
    loopState.autoResumeOnNewAction = true;
    expect(loopState.getProcessingState()).toBe('waiting');

    loopState.removeAction(1);
    expect(loopState.isProcessing).toBe(true);
    expect(loopState._queueCompleted).toBe(false);
  });
});

describe('removeAction — currentActionIndex bookkeeping at boundaries', () => {
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
    gs.addCustomAction('explore');
    gs.addCustomAction('explore');
    gs.addCustomAction('explore');
  });

  it('removing the last action while at the last index snaps currentActionIndex to 0', () => {
    // Set up: currently at index 2 (the last), running.
    loopState.startProcessing();
    loopState.currentActionIndex = 2;
    loopState.currentAction = loopState.getActionQueue()[2];

    // Remove index 2 — the running action. stopProcessing fires,
    // then auto-restart sees currentActionIndex (2) >= queueLen (2)
    // and snaps to 0.
    loopState.removeAction(2);

    expect(loopState.currentActionIndex).toBe(0);
    expect(loopState.isProcessing).toBe(true);
  });
});
