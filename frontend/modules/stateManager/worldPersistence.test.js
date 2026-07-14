/**
 * Unit tests for world persistence across reloads (P1).
 * Runs under vitest's `node` environment: sessionStorage and fetch are stubbed
 * via dependency injection, no jsdom.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LAST_WORLD_KEY,
  INLINE_SIZE_CAP,
  buildLastWorldRecord,
  persistLastWorld,
  restoreLastWorld,
} from './worldPersistence.js';

/** Minimal in-memory Storage stub with instrumentable failures. */
function makeStorage() {
  const map = new Map();
  return {
    getItem: vi.fn((k) => (map.has(k) ? map.get(k) : null)),
    setItem: vi.fn((k, v) => {
      map.set(k, String(v));
    }),
    removeItem: vi.fn((k) => {
      map.delete(k);
    }),
    _map: map,
  };
}

function okResponse(json) {
  return { ok: true, status: 200, json: async () => json };
}

describe('buildLastWorldRecord — shape', () => {
  it('preset paths persist as path-type', () => {
    const rec = buildLastWorldRecord({
      jsonData: { game_name: 'TUNIC' },
      selectedPlayerId: '1',
      sourceName: './presets/tunic/AP_1/AP_1_rules.json',
    });
    expect(rec).toMatchObject({
      v: 1,
      type: 'path',
      path: './presets/tunic/AP_1/AP_1_rules.json',
      selectedPlayerId: '1',
      sourceName: './presets/tunic/AP_1/AP_1_rules.json',
    });
    expect(rec.jsonData).toBeUndefined();
  });

  it('a preset path without a leading ./ still matches', () => {
    const rec = buildLastWorldRecord({
      jsonData: {},
      selectedPlayerId: 1,
      sourceName: 'presets/foo/bar_rules.json',
    });
    expect(rec.type).toBe('path');
  });

  it('manual uploads persist inline', () => {
    const jsonData = { game_name: 'Custom' };
    const rec = buildLastWorldRecord({
      jsonData,
      selectedPlayerId: 2,
      sourceName: 'userLoaded:my_world.json',
    });
    expect(rec).toMatchObject({ v: 1, type: 'inline', selectedPlayerId: 2 });
    expect(rec.jsonData).toBe(jsonData);
  });

  it('procgen worlds persist inline', () => {
    const rec = buildLastWorldRecord({
      jsonData: { world: {} },
      selectedPlayerId: 1,
      sourceName: 'procgenPipeline',
    });
    expect(rec.type).toBe('inline');
  });

  it('returns null when there is no jsonData', () => {
    expect(buildLastWorldRecord({ selectedPlayerId: 1 })).toBeNull();
    expect(buildLastWorldRecord(null)).toBeNull();
  });
});

describe('persistLastWorld', () => {
  let storage;
  beforeEach(() => {
    storage = makeStorage();
  });

  it('writes the record under the shared key', () => {
    persistLastWorld(
      { jsonData: { a: 1 }, selectedPlayerId: 1, sourceName: 'userLoaded:x.json' },
      { storage }
    );
    const stored = JSON.parse(storage._map.get(LAST_WORLD_KEY));
    expect(stored.type).toBe('inline');
    expect(stored.jsonData).toEqual({ a: 1 });
  });

  it('removes any existing entry when the payload is not persistable', () => {
    storage._map.set(LAST_WORLD_KEY, JSON.stringify({ v: 1, type: 'inline', jsonData: {} }));
    persistLastWorld({ selectedPlayerId: 1 /* no jsonData */ }, { storage });
    expect(storage._map.has(LAST_WORLD_KEY)).toBe(false);
    expect(storage.removeItem).toHaveBeenCalledWith(LAST_WORLD_KEY);
  });

  it('skips + clears when an inline payload exceeds the size cap', () => {
    storage._map.set(LAST_WORLD_KEY, 'stale');
    const big = { blob: 'x'.repeat(INLINE_SIZE_CAP + 1) };
    persistLastWorld(
      { jsonData: big, selectedPlayerId: 1, sourceName: 'userLoaded:big.json' },
      { storage }
    );
    expect(storage._map.has(LAST_WORLD_KEY)).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('clears on a write failure (e.g. QuotaExceededError)', () => {
    storage._map.set(LAST_WORLD_KEY, 'stale');
    storage.setItem = vi.fn(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    persistLastWorld(
      { jsonData: { a: 1 }, selectedPlayerId: 1, sourceName: 'userLoaded:x.json' },
      { storage }
    );
    expect(storage.removeItem).toHaveBeenCalledWith(LAST_WORLD_KEY);
  });

  it('is a no-op when storage is unavailable', () => {
    expect(() =>
      persistLastWorld({ jsonData: {}, selectedPlayerId: 1 }, { storage: null })
    ).not.toThrow();
  });
});

describe('restoreLastWorld', () => {
  let storage;
  beforeEach(() => {
    storage = makeStorage();
  });

  it('returns null and clears nothing when there is no entry', async () => {
    const res = await restoreLastWorld({ storage, fetchFn: vi.fn() });
    expect(res).toBeNull();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('resolves an inline record directly (no fetch) and keeps the entry', async () => {
    const jsonData = { game_name: 'Custom' };
    storage._map.set(
      LAST_WORLD_KEY,
      JSON.stringify({ v: 1, type: 'inline', jsonData, selectedPlayerId: 2, sourceName: 'userLoaded:x.json' })
    );
    const fetchFn = vi.fn();
    const res = await restoreLastWorld({ storage, fetchFn });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(res).toMatchObject({
      rulesConfig: jsonData,
      sourceName: 'userLoaded:x.json',
      selectedPlayerId: 2,
    });
    // success keeps the entry so repeated reloads keep restoring
    expect(storage._map.has(LAST_WORLD_KEY)).toBe(true);
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('fetches a path record and keeps the entry on success', async () => {
    const path = './presets/tunic/AP_1/AP_1_rules.json';
    storage._map.set(
      LAST_WORLD_KEY,
      JSON.stringify({ v: 1, type: 'path', path, selectedPlayerId: '1', sourceName: path })
    );
    const fetched = { game_name: 'TUNIC' };
    const fetchFn = vi.fn(async () => okResponse(fetched));
    const res = await restoreLastWorld({ storage, fetchFn });
    expect(fetchFn).toHaveBeenCalledWith(path);
    expect(res).toMatchObject({ rulesConfig: fetched, sourceName: path, selectedPlayerId: '1' });
    expect(storage._map.has(LAST_WORLD_KEY)).toBe(true);
  });

  it('clears + falls through on a corrupt entry', async () => {
    storage._map.set(LAST_WORLD_KEY, '{not json');
    const res = await restoreLastWorld({ storage, fetchFn: vi.fn() });
    expect(res).toBeNull();
    expect(storage._map.has(LAST_WORLD_KEY)).toBe(false);
  });

  it('clears + falls through on an unknown record shape', async () => {
    storage._map.set(LAST_WORLD_KEY, JSON.stringify({ v: 1, type: 'bogus' }));
    const res = await restoreLastWorld({ storage, fetchFn: vi.fn() });
    expect(res).toBeNull();
    expect(storage._map.has(LAST_WORLD_KEY)).toBe(false);
  });

  it('clears + falls through when a path fetch is non-OK', async () => {
    const path = './presets/gone/AP_1/AP_1_rules.json';
    storage._map.set(
      LAST_WORLD_KEY,
      JSON.stringify({ v: 1, type: 'path', path, selectedPlayerId: '1', sourceName: path })
    );
    const fetchFn = vi.fn(async () => ({ ok: false, status: 404 }));
    const res = await restoreLastWorld({ storage, fetchFn });
    expect(res).toBeNull();
    expect(storage._map.has(LAST_WORLD_KEY)).toBe(false);
  });

  it('clears + falls through when the fetch throws', async () => {
    const path = './presets/x/AP_1/AP_1_rules.json';
    storage._map.set(
      LAST_WORLD_KEY,
      JSON.stringify({ v: 1, type: 'path', path, selectedPlayerId: '1', sourceName: path })
    );
    const fetchFn = vi.fn(async () => {
      throw new Error('network');
    });
    const res = await restoreLastWorld({ storage, fetchFn });
    expect(res).toBeNull();
    expect(storage._map.has(LAST_WORLD_KEY)).toBe(false);
  });
});
