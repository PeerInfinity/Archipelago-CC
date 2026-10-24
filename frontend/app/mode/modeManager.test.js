/**
 * Unit tests for modeManager reset branches clearing the persisted last-world
 * (world-persistence-across-reloads P2). Stubs window/localStorage/
 * sessionStorage for the vitest `node` environment.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { determineActiveMode } from './modeManager.js';
import { LAST_WORLD_KEY } from '../../modules/stateManager/worldPersistence.js';

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: vi.fn((k) => map.delete(k)),
    _map: map,
  };
}

const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };

function setSearch(search) {
  globalThis.window = { location: { search } };
}

describe('modeManager reset branches clear the persisted last world', () => {
  beforeEach(() => {
    globalThis.localStorage = makeStorage();
    globalThis.sessionStorage = makeStorage();
    globalThis.sessionStorage._map.set(LAST_WORLD_KEY, 'persisted-world');
    vi.clearAllMocks();
  });
  afterEach(() => {
    delete globalThis.window;
    delete globalThis.localStorage;
    delete globalThis.sessionStorage;
  });

  it('?mode=reset removes apcc_lastWorld', async () => {
    setSearch('?mode=reset');
    const res = await determineActiveMode(logger);
    expect(res.currentActiveMode).toBe('default');
    expect(globalThis.sessionStorage.removeItem).toHaveBeenCalledWith(LAST_WORLD_KEY);
    expect(globalThis.sessionStorage._map.has(LAST_WORLD_KEY)).toBe(false);
  });

  it('?reset=true removes apcc_lastWorld', async () => {
    setSearch('?reset=true');
    await determineActiveMode(logger);
    expect(globalThis.sessionStorage.removeItem).toHaveBeenCalledWith(LAST_WORLD_KEY);
    expect(globalThis.sessionStorage._map.has(LAST_WORLD_KEY)).toBe(false);
  });

  it('a normal load leaves the persisted world intact', async () => {
    setSearch('');
    await determineActiveMode(logger);
    expect(globalThis.sessionStorage.removeItem).not.toHaveBeenCalledWith(LAST_WORLD_KEY);
    expect(globalThis.sessionStorage._map.get(LAST_WORLD_KEY)).toBe('persisted-world');
  });
});
