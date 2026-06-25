/**
 * Unit tests for reportGoalIfComplete — the proof→client goal-reporting hook.
 *
 * Verifies that a completed proof publishes `user:goalReached` exactly when it
 * should, and stays silent otherwise (not loaded, no dispatcher, not complete).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// proofModuleHelpers imports the stateManager singleton at module load; stub it
// so the test runs in plain node without spinning up the worker proxy.
vi.mock('../stateManager/index.js', () => ({
  stateManagerProxySingleton: {
    getLatestStateSnapshot: () => null,
    getStaticData: () => null,
  },
}));

import { reportGoalIfComplete } from './proofModuleHelpers.js';

function makeState({ isLoaded = true, complete = false } = {}) {
  return {
    isLoaded,
    isProofComplete: () => complete,
  };
}

describe('reportGoalIfComplete', () => {
  let dispatcher;

  beforeEach(() => {
    dispatcher = { publish: vi.fn() };
  });

  it('publishes user:goalReached when the proof is complete', () => {
    reportGoalIfComplete(makeState({ complete: true }), dispatcher);

    expect(dispatcher.publish).toHaveBeenCalledTimes(1);
    const [eventName, payload, options] = dispatcher.publish.mock.calls[0];
    expect(eventName).toBe('user:goalReached');
    expect(payload).toMatchObject({ originator: 'proof' });
    expect(options).toMatchObject({ initialTarget: 'bottom' });
  });

  it('does not publish when the proof is not complete', () => {
    reportGoalIfComplete(makeState({ complete: false }), dispatcher);
    expect(dispatcher.publish).not.toHaveBeenCalled();
  });

  it('does not publish when the state is not loaded', () => {
    reportGoalIfComplete(makeState({ isLoaded: false, complete: true }), dispatcher);
    expect(dispatcher.publish).not.toHaveBeenCalled();
  });

  it('does not throw when there is no dispatcher', () => {
    expect(() => reportGoalIfComplete(makeState({ complete: true }), null)).not.toThrow();
  });

  it('does not throw when the state is null', () => {
    expect(() => reportGoalIfComplete(null, dispatcher)).not.toThrow();
    expect(dispatcher.publish).not.toHaveBeenCalled();
  });
});
