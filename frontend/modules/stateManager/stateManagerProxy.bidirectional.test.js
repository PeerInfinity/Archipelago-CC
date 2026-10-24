/**
 * Unit tests for StateManagerProxy.getEffectiveBidirectionalSetting().
 *
 * `assume_bidirectional_exits` is PER PLAYER (rules F1, ⚖ user 2026-10-03):
 * its one home is `exporter["<p>"]`, and the proxy answers the LOADED slot's
 * statement. Until F1 it read `Object.values(exporter)[0]` — the first block
 * present, whichever slot that was — with a top-level fallback.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { StateManagerProxy } from './stateManagerProxy.js';

// The constructor spins up the state worker; a no-op stand-in keeps the
// (caught) "Worker is not defined" failure out of the test output.
const originalWorker = globalThis.Worker;
beforeAll(() => {
  globalThis.Worker = class {
    postMessage() {}
    terminate() {}
    addEventListener() {}
  };
});
afterAll(() => {
  globalThis.Worker = originalWorker;
});

function makeProxy(staticData) {
  const proxy = new StateManagerProxy({
    publish: () => {},
    subscribe: () => () => {},
  });
  proxy.staticDataCache = staticData;
  return proxy;
}

// Two slots that DISAGREE, slot 1's block first in key order.
const exporter = {
  1: { assume_bidirectional_exits: true },
  2: { assume_bidirectional_exits: false },
};

describe('StateManagerProxy.getEffectiveBidirectionalSetting', () => {
  it("answers the LOADED slot's exporter flag when two slots disagree", () => {
    for (const [playerId, expected] of [['1', true], ['2', false]]) {
      const result = makeProxy({ playerId, exporter, regions: new Map() }).getEffectiveBidirectionalSetting();
      expect(result, `slot ${playerId}`).toEqual({ assumeBidirectional: expected, source: 'explicit', detection: null });
    }
  });

  it("does not borrow another slot's block when the loaded slot states nothing", () => {
    // Slot 3 has no exporter block; slot 1's `true` must not answer for it.
    const result = makeProxy({ playerId: '3', exporter, regions: new Map() }).getEffectiveBidirectionalSetting();
    expect(result.source).not.toBe('explicit');
  });

  it('reads no top-level copy — absent from the slot means auto-detect', () => {
    const regions = new Map([
      ['Menu', { name: 'Menu', exits: [{ name: 'go', connected_region: 'A' }] }],
      ['A', { name: 'A', exits: [] }],
    ]);
    const result = makeProxy({
      playerId: '1', exporter: {}, assume_bidirectional_exits: true, regions,
    }).getEffectiveBidirectionalSetting();
    expect(result.source).toBe('auto-detected');
  });
});
