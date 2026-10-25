/**
 * Unit tests for StateManagerProxy dropping an overtaken rules load.
 *
 * Two loadRules in flight (the boot preset, then a test's in-memory world):
 * the worker confirms both, in order. Only the latest may reach the bus as
 * stateManager:rulesLoaded — the first used to be published too, with the
 * second load's source name on the first world's snapshot.
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
  const sent = [];
  const proxy = new StateManagerProxy({
    publish: (name, data) => published.push({ name, data }),
    subscribe: () => () => {},
  });
  proxy._sendCommand = async (command, payload) => { sent.push({ command, payload }); };
  return { proxy, published, sent };
}

const confirmation = (loadSeq, region) => ({
  type: 'rulesLoadedConfirmation',
  loadSeq,
  playerId: '1',
  gameName: 'Test',
  initialSnapshot: { region },
  newStaticData: { regions: [[region, { name: region }]] },
});

const rulesLoaded = (published) => published.filter((e) => e.name === 'stateManager:rulesLoaded');

describe('StateManagerProxy — an overtaken loadRules', () => {
  it('numbers each load and sends the number to the worker', async () => {
    const { proxy, sent } = makeProxy();
    await proxy.loadRules({}, { playerId: '1' }, 'boot.json');
    await proxy.loadRules({}, { playerId: '1' }, 'inMemory');
    expect(sent.map((s) => s.payload.loadSeq)).toEqual([1, 2]);
  });

  it('drops the overtaken confirmation and publishes only the latest, under its own source', async () => {
    const { proxy, published } = makeProxy();
    await proxy.loadRules({}, { playerId: '1' }, 'boot.json');
    await proxy.loadRules({}, { playerId: '1' }, 'inMemory');
    proxy.handleWorkerMessage(confirmation(1, 'BootRegion'));
    expect(rulesLoaded(published)).toHaveLength(0);
    expect(proxy.getLatestStateSnapshot()).toBe(null);
    proxy.handleWorkerMessage(confirmation(2, 'TestRegion'));
    const events = rulesLoaded(published);
    expect(events).toHaveLength(1);
    expect(events[0].data.source).toBe('inMemory');
    expect(events[0].data.snapshot).toEqual({ region: 'TestRegion' });
  });

  it('still publishes a confirmation that carries no number', () => {
    const { proxy, published } = makeProxy();
    const { loadSeq, ...unnumbered } = confirmation(undefined, 'Region');
    proxy.handleWorkerMessage(unnumbered);
    expect(rulesLoaded(published)).toHaveLength(1);
  });
});
