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

// ─── initializeProofState: a new document reloads the structure ─────────────
// (sdc-proof-goal-report) The UI panels force a reload on rulesLoaded; the
// module handler did not, so with the panels closed a state loaded from the
// mode's boot preset kept that preset's steps (and goal) after a connect loaded
// the room's rules.

import { initializeProofState } from './proofModuleHelpers.js';
import { ProofGraphState } from '../proofGraph/proofGraphState.js';

function graphDoc(n, nameOf = (i) => `Complete Node ${i}`) {
  const graph_structure = {};
  const locations = new Map();
  for (let i = 1; i <= n; i++) {
    graph_structure[i] = { label: `n${i}`, expression: `Node expr ${i}`, dependencies: i > 1 ? [i - 1] : [] };
    locations.set(nameOf(i), { name: nameOf(i), id: 1000 + i });
  }
  return { playerId: '1', locations, world: { 1: { slot_data: { graph_structure }, options: {} } } };
}

describe('initializeProofState', () => {
  const log = () => {};

  it('reloads from a new document even when a state is already loaded', () => {
    const state = new ProofGraphState();
    const wire = vi.fn();
    expect(initializeProofState(state, graphDoc(5), log, wire)).toBe(true);
    expect(state.goalStepIndex).toBe(5);
    const room = graphDoc(8, (i) => (i === 8 ? 'Room Goal' : `Complete Node ${i}`));
    room.world[1].slot_data.graph_structure[8].expression = 'Room Goal';
    expect(initializeProofState(state, room, log, wire)).toBe(true);
    expect(state.goalStepIndex).toBe(8);
    expect(state.steps.get(8).locationName).toBe('Room Goal');
    // The stale goal no longer completes the proof.
    state.syncLocations(['Complete Node 5']);
    expect(state.isProofComplete()).toBe(false);
    state.syncLocations(['Room Goal']);
    expect(state.isProofComplete()).toBe(true);
    expect(wire).toHaveBeenCalledTimes(1);
  });

  it('the same document is not reparsed, and publishing is wired once', () => {
    const state = new ProofGraphState();
    const wire = vi.fn();
    const doc = graphDoc(3);
    initializeProofState(state, doc, log, wire);
    state.checkLocation('Complete Node 1');
    const steps = state.steps;
    initializeProofState(state, doc, log, wire);
    expect(state.steps).toBe(steps);
    expect(state.checkedLocations.has('Complete Node 1')).toBe(true);
    expect(wire).toHaveBeenCalledTimes(1);
  });
});
