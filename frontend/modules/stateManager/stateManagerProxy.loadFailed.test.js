/**
 * StateManagerProxy on the worker's `rulesLoadFailed` (option A, ⚖ user 2026-11-01).
 *
 * ⛓ Before: `initialLoadPromise` had only a resolver, fed by `rulesLoadedConfirmation`.
 * A load that threw in the worker posted only `workerError` (no queryId), so
 * `ensureReady()` waited out its whole timeout, and its callers hung.
 *
 * Pinned here:
 * - the failure SETTLES the promise with `false` (never a rejection: loadRules is
 *   fire-and-forget, so nobody may be awaiting it) and publishes `stateManager:loadFailed`;
 * - fail, then a good load: the next loadRules re-arms the promise, and the good
 *   confirmation boots (ensureReady → true, stateManager:ready);
 * - an overtaken failure (an older loadSeq) is dropped, like an overtaken confirmation;
 * - the success path publishes exactly what it did before (no new event).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { StateManagerProxy } from './stateManagerProxy.js';

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

function makeProxy() {
  const published = [];
  const proxy = new StateManagerProxy({
    publish: (name, data) => published.push({ name, data }),
    subscribe: () => () => {},
  });
  proxy._sendCommand = async () => {};
  return { proxy, published };
}

const confirmation = (loadSeq) => ({
  type: 'rulesLoadedConfirmation',
  loadSeq,
  playerId: '1',
  gameName: 'Test',
  initialSnapshot: { region: 'Menu' },
  newStaticData: { regions: [['Menu', { name: 'Menu' }]] },
});

const failed = (loadSeq) => ({
  type: 'rulesLoadFailed',
  loadSeq,
  game: 'Procgen Maze',
  player: '1',
  phase: 'processStartingItems',
  where: null,
  message: 'region.exits is not iterable',
  stack: 'TypeError: region.exits is not iterable\n    at …',
});

const names = (published) => published.map((e) => e.name);
const SHORT = 200; // ms: anything that waits out the timeout is a fail, not a slow pass

describe('StateManagerProxy — rulesLoadFailed', () => {
  it('settles ensureReady with false, at once, and publishes stateManager:loadFailed', async () => {
    const { proxy, published } = makeProxy();
    await proxy.loadRules({}, { playerId: '1' }, 'broken.json');
    const ready = proxy.ensureReady(10_000);
    proxy.handleWorkerMessage(failed(1));
    const t0 = Date.now();
    expect(await ready).toBe(false);
    expect(Date.now() - t0).toBeLessThan(SHORT);
    const events = published.filter((e) => e.name === 'stateManager:loadFailed');
    expect(events).toHaveLength(1);
    expect(events[0].data).toMatchObject({
      game: 'Procgen Maze', player: '1', phase: 'processStartingItems',
      message: 'region.exits is not iterable', source: 'broken.json', loadSeq: 1,
    });
    expect(proxy.lastLoadFailure).toMatchObject({ phase: 'processStartingItems' });
  });

  it('settles a promise awaited only AFTER the failure too', async () => {
    const { proxy } = makeProxy();
    await proxy.loadRules({}, { playerId: '1' }, 'broken.json');
    proxy.handleWorkerMessage(failed(1));
    const t0 = Date.now();
    expect(await proxy.ensureReady(10_000)).toBe(false);
    expect(Date.now() - t0).toBeLessThan(SHORT);
  });

  it('fail, then a good load: the promise re-arms and the good load boots', async () => {
    const { proxy, published } = makeProxy();
    await proxy.loadRules({}, { playerId: '1' }, 'broken.json');
    proxy.handleWorkerMessage(failed(1));
    expect(await proxy.ensureReady(10_000)).toBe(false);

    await proxy.loadRules({}, { playerId: '1' }, 'good.json');
    expect(proxy.lastLoadFailure).toBe(null);
    // Waiting BEFORE the confirmation must wait for it, not return the settled false.
    const ready = proxy.ensureReady(10_000);
    proxy.handleWorkerMessage(confirmation(2));
    expect(await ready).toBe(true);
    expect(proxy.isPotentialStaleSnapshot).toBe(false);
    expect(names(published)).toContain('stateManager:ready');
    expect(published.filter((e) => e.name === 'stateManager:rulesLoaded')).toHaveLength(1);
  });

  it('a good load, a failed reload, then a good reload boots again', async () => {
    const { proxy } = makeProxy();
    await proxy.loadRules({}, { playerId: '1' }, 'good.json');
    proxy.handleWorkerMessage(confirmation(1));
    expect(await proxy.ensureReady(1000)).toBe(true);

    await proxy.loadRules({}, { playerId: '1' }, 'broken.json');
    proxy.handleWorkerMessage(failed(2));
    const t0 = Date.now();
    expect(await proxy.ensureReady(10_000)).toBe(false);
    expect(Date.now() - t0).toBeLessThan(SHORT);
    expect(proxy.isPotentialStaleSnapshot).toBe(true); // the half-loaded worker publishes nothing

    await proxy.loadRules({}, { playerId: '1' }, 'good2.json');
    const ready = proxy.ensureReady(10_000);
    proxy.handleWorkerMessage(confirmation(3));
    expect(await ready).toBe(true);
    expect(proxy.isPotentialStaleSnapshot).toBe(false);
  });

  it('drops a failure a newer load has overtaken', async () => {
    const { proxy, published } = makeProxy();
    await proxy.loadRules({}, { playerId: '1' }, 'broken.json');
    await proxy.loadRules({}, { playerId: '1' }, 'good.json');
    proxy.handleWorkerMessage(failed(1));
    expect(proxy.lastLoadFailure).toBe(null);
    expect(names(published)).not.toContain('stateManager:loadFailed');
    const ready = proxy.ensureReady(10_000);
    proxy.handleWorkerMessage(confirmation(2));
    expect(await ready).toBe(true);
  });

  it('the success path publishes exactly the events it did before (no new one)', async () => {
    const { proxy, published } = makeProxy();
    await proxy.loadRules({}, { playerId: '1' }, 'good.json');
    proxy.handleWorkerMessage(confirmation(1));
    expect(await proxy.ensureReady(1000)).toBe(true);
    const seq = names(published);
    expect(seq).not.toContain('stateManager:loadFailed');
    // Today's order, measured at efbeb33501 before this slice's proxy change.
    expect(seq).toEqual(SUCCESS_SEQUENCE);
  });
});

// Filled from the base commit's proxy (see the slice report): the publishes a good first load makes.
const SUCCESS_SEQUENCE = ['stateManager:rulesLoaded', 'stateManager:ready'];
