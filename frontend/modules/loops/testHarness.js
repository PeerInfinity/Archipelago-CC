/**
 * Shared test harness for loops/ unit tests.
 *
 * Wires a real GameState (with stub eventBus, stateManager, dispatcher)
 * to a real LoopState, returning the live objects plus a `tick` helper
 * that drives _processFrame manually since RAF doesn't fire in node.
 *
 * Existing tests (manaReset, stepButton, queueRemoval, loopState,
 * eventCoordinator, costDataManager) each duplicate this harness; they
 * pre-date this file and are not migrated as part of this commit. New
 * tests should import from here.
 */
import { vi } from 'vitest';
import { LoopState } from './loopState.js';
import { GameState } from '../gameState/state.js';

export function installRafShim() {
  globalThis.requestAnimationFrame = vi.fn(() => 1);
  globalThis.cancelAnimationFrame = vi.fn();
}

export function uninstallRafShim() {
  delete globalThis.requestAnimationFrame;
  delete globalThis.cancelAnimationFrame;
}

export function makeBus() {
  const events = [];
  return {
    events,
    publish: (name, data) => events.push({ name, data }),
    subscribe: () => () => {},
  };
}

export function makeStubStateManager(snapshot = {}, staticData = {}) {
  return {
    getLatestStateSnapshot: () => ({
      checkedLocations: [],
      inventory: {},
      ...snapshot,
    }),
    getStaticData: () => ({ regions: new Map(), ...staticData }),
  };
}

export function makeWired({ snapshot, staticData, startRegion = 'Menu' } = {}) {
  const bus = makeBus();
  const gs = new GameState(bus);
  const loopState = new LoopState();
  const dispatcher = { publish: () => {}, publishToNextModule: () => {} };
  loopState.setDependencies({
    eventBus: bus,
    stateManager: makeStubStateManager(snapshot, staticData),
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
      addManualAction: (r) => gs.addManualAction(r),
      removePathEntry: (idx) => gs.removePathEntry(idx),
      removeLocationCheckAt: (l, r, i) => gs.removeLocationCheckAt(l, r, i),
      removeCustomActionAt: (a, r, i, m) => gs.removeCustomActionAt(a, r, i, m),
      insertLocationCheckAt: (l, r, i, lr) =>
        gs.insertLocationCheckAt(l, r, i, lr),
      insertCustomActionAt: (a, r, i, p) => gs.insertCustomActionAt(a, r, i, p),
    },
  });
  gs.setStartRegions([startRegion]);
  gs.setCurrentRegion(startRegion);
  return { loopState, gs, bus, dispatcher };
}

/**
 * Drive a single _processFrame, advancing a shared frame clock.
 *
 * _processFrame primes _lastFrameTime on the first call without doing
 * real work; the caller usually wants progress in one tick(). Pump a
 * second time when that happens.
 *
 * Returns the post-tick frame clock so callers can tell which timestamp
 * the work happened on.
 */
export function makeTicker(initial = 1000) {
  let clock = initial;
  return function tick(loopState) {
    loopState._processFrame(clock);
    clock += 16;
    if (loopState.isProcessing && loopState._lastFrameTime === clock - 16) {
      loopState._processFrame(clock);
      clock += 16;
    }
    return clock;
  };
}
