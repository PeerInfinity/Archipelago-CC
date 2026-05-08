/**
 * Verifies the "Derived (named) states" section of
 * docs/json/developer/reference/loops-module-states.md — that
 * getProcessingState() collapses the flag tuples into the right named
 * label.
 *
 * Mapping under test (from loopState.js:787):
 *   isProcessing=true                                       → 'running'
 *   isProcessing=false, isPaused=true                       → 'paused'
 *   _queueCompleted=true, autoResumeOnNewAction=false       → 'completed'
 *   _queueCompleted=true, autoResumeOnNewAction=true        → 'waiting'
 *   otherwise                                               → 'idle'
 *
 * Order matters in getProcessingState — the early returns mean
 * 'running' wins over 'paused' wins over 'completed'/'waiting' wins
 * over 'idle' if multiple flags are set. These tests pin the priority
 * order as well as each individual mapping.
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

describe('getProcessingState — individual mappings', () => {
  let loopState;
  beforeEach(() => {
    ({ loopState } = makeWired());
  });

  it('all flags false → "idle"', () => {
    loopState.isProcessing = false;
    loopState.isPaused = false;
    loopState._queueCompleted = false;
    expect(loopState.getProcessingState()).toBe('idle');
  });

  it('isProcessing=true → "running"', () => {
    loopState.isProcessing = true;
    loopState.isPaused = false;
    loopState._queueCompleted = false;
    expect(loopState.getProcessingState()).toBe('running');
  });

  it('isPaused=true (not processing) → "paused"', () => {
    loopState.isProcessing = false;
    loopState.isPaused = true;
    loopState._queueCompleted = false;
    expect(loopState.getProcessingState()).toBe('paused');
  });

  it('_queueCompleted=true, autoResumeOnNewAction=false → "completed"', () => {
    loopState.isProcessing = false;
    loopState.isPaused = false;
    loopState._queueCompleted = true;
    loopState.autoResumeOnNewAction = false;
    expect(loopState.getProcessingState()).toBe('completed');
  });

  it('_queueCompleted=true, autoResumeOnNewAction=true → "waiting"', () => {
    loopState.isProcessing = false;
    loopState.isPaused = false;
    loopState._queueCompleted = true;
    loopState.autoResumeOnNewAction = true;
    expect(loopState.getProcessingState()).toBe('waiting');
  });
});

describe('getProcessingState — priority order when flags overlap', () => {
  // The flags shouldn't overlap in normal operation, but
  // getProcessingState defines a clear priority that any future
  // refactor must preserve.
  let loopState;
  beforeEach(() => {
    ({ loopState } = makeWired());
  });

  it('isProcessing wins over isPaused', () => {
    loopState.isProcessing = true;
    loopState.isPaused = true;
    expect(loopState.getProcessingState()).toBe('running');
  });

  it('isProcessing wins over _queueCompleted', () => {
    loopState.isProcessing = true;
    loopState._queueCompleted = true;
    expect(loopState.getProcessingState()).toBe('running');
  });

  it('isPaused wins over _queueCompleted', () => {
    loopState.isProcessing = false;
    loopState.isPaused = true;
    loopState._queueCompleted = true;
    expect(loopState.getProcessingState()).toBe('paused');
  });
});

describe('getProcessingState — autoResumeOnNewAction toggle on completed', () => {
  let loopState;
  beforeEach(() => {
    ({ loopState } = makeWired());
    loopState._queueCompleted = true;
  });

  it('toggling autoResumeOnNewAction switches "completed" ↔ "waiting" without other state changes', () => {
    loopState.autoResumeOnNewAction = false;
    expect(loopState.getProcessingState()).toBe('completed');
    loopState.autoResumeOnNewAction = true;
    expect(loopState.getProcessingState()).toBe('waiting');
    loopState.autoResumeOnNewAction = false;
    expect(loopState.getProcessingState()).toBe('completed');
  });

  it('autoResumeOnNewAction has no effect when _queueCompleted is false', () => {
    loopState._queueCompleted = false;
    loopState.autoResumeOnNewAction = true;
    expect(loopState.getProcessingState()).toBe('idle');
  });
});

describe('getProcessingState — observed after public state mutations', () => {
  // Sanity: the public methods land in the expected named state.
  let loopState, gs;
  beforeEach(() => {
    ({ loopState, gs } = makeWired());
  });

  it('startProcessing → "running"', () => {
    gs.addCustomAction('explore');
    loopState.startProcessing();
    expect(loopState.getProcessingState()).toBe('running');
  });

  it('setPaused(true) from running → "paused"', () => {
    gs.addCustomAction('explore');
    loopState.startProcessing();
    loopState.setPaused(true);
    expect(loopState.getProcessingState()).toBe('paused');
  });

  it('stopProcessing from running with no other flags → "idle"', () => {
    gs.addCustomAction('explore');
    loopState.startProcessing();
    loopState.stopProcessing();
    expect(loopState.getProcessingState()).toBe('idle');
  });

  it('_pauseAfterStep from running → "paused"', () => {
    gs.addCustomAction('explore');
    loopState.startProcessing();
    loopState._pauseAfterStep();
    expect(loopState.getProcessingState()).toBe('paused');
  });
});
