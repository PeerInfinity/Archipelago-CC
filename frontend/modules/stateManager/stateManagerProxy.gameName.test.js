/**
 * Unit tests for StateManagerProxy.getGameName().
 *
 * The loaded player's `world` entry is the authority: a combined multiworld
 * rules.json carries `game_name: "Multiworld"` at the top level, which is not
 * a game any AP server knows (it gets a Connect refused with InvalidGame).
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

describe('StateManagerProxy.getGameName', () => {
  it("returns the loaded player's game from a combined multiworld file", () => {
    const proxy = makeProxy({
      game_name: 'Multiworld',
      playerId: '2',
      world: { 1: { game: 'A Hat in Time' }, 2: { game: 'A Link to the Past' } },
    });
    expect(proxy.getGameName()).toBe('A Link to the Past');
  });

  it('returns the game name for a single-player file', () => {
    const proxy = makeProxy({
      game_name: 'TUNIC',
      playerId: '1',
      world: { 1: { game: 'TUNIC' } },
    });
    expect(proxy.getGameName()).toBe('TUNIC');
  });

  it('falls back to game_name when the world entry has no game', () => {
    const proxy = makeProxy({ game_name: 'Adventure', playerId: '1', world: { 1: {} } });
    expect(proxy.getGameName()).toBe('Adventure');
  });

  it('falls back to the worker-reported name when no static data is cached', () => {
    const proxy = makeProxy(null);
    proxy.gameNameFromWorker = 'A Short Hike';
    expect(proxy.getGameName()).toBe('A Short Hike');
  });
});
