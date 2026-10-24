/**
 * tileMapDataMissing.test — **an ABSENT DEFAULT is not an error**, and the two
 * paths that can be absent are named.
 *
 * ⛓ `.gitignore` excludes `*_tilemap.json` and `*_tiles.json`, so the default
 * preset's two files exist only on the machine that produced them. GitHub Pages
 * therefore served neither, and the panel printed
 * `error: failed to fetch … 404` to every visitor's console on open — a red
 * line about a file that is missing BY DESIGN.
 *
 * ⛔ WHAT IS GATED HERE IS THE DISCRIMINATION, not the console. A blanket "404
 * is fine" would swallow a real typo in a path somebody chose, which is the
 * failure this panel most needs to report — so the loader raises a CLASS that
 * carries the path, and only the two DEFAULT paths are excused.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_CONFIG_PATH,
  DEFAULT_TILEMAP_PATH,
  TileMapDataMissingError,
  isDefaultDataPath,
  loadCategoryConfig,
  loadTileMap,
} from './tileMapDataManager.js';

const respond = (status, body = {}) => vi.fn(async () => ({
  status,
  ok: status >= 200 && status < 300,
  statusText: status === 404 ? 'File not found' : 'Server Error',
  json: async () => body,
}));

afterEach(() => { delete globalThis.fetch; });

describe('a 404 is its own class, and it carries the path', () => {
  it('loadTileMap raises TileMapDataMissingError on 404, naming the file', async () => {
    globalThis.fetch = respond(404);
    await expect(loadTileMap(DEFAULT_TILEMAP_PATH)).rejects.toThrowError(TileMapDataMissingError);
    await expect(loadTileMap(DEFAULT_TILEMAP_PATH)).rejects.toThrowError(/is not served here/);
    const e = await loadTileMap(DEFAULT_TILEMAP_PATH).catch((x) => x);
    expect(e.path).toBe(DEFAULT_TILEMAP_PATH);
  });

  it('loadCategoryConfig does the same for its own file', async () => {
    globalThis.fetch = respond(404);
    const e = await loadCategoryConfig(DEFAULT_CONFIG_PATH).catch((x) => x);
    expect(e).toBeInstanceOf(TileMapDataMissingError);
    expect(e.path).toBe(DEFAULT_CONFIG_PATH);
  });

  it('⛔ any OTHER bad status stays a plain error — a 500 is not an absence', async () => {
    globalThis.fetch = respond(500);
    const e = await loadTileMap(DEFAULT_TILEMAP_PATH).catch((x) => x);
    expect(e).not.toBeInstanceOf(TileMapDataMissingError);
    expect(e.message).toMatch(/failed to fetch/);
  });
});

describe('only the DEFAULT paths are excusable', () => {
  it('names exactly the two gitignored files', () => {
    expect(isDefaultDataPath(DEFAULT_TILEMAP_PATH)).toBe(true);
    expect(isDefaultDataPath(DEFAULT_CONFIG_PATH)).toBe(true);
  });

  it('⛔ and a path somebody TYPED is not one — its 404 stays a real error', () => {
    // The whole point of carrying the path: a blanket "404 is fine" would hide
    // a typo in a preset name, which is the mistake this panel most needs to
    // report.
    expect(isDefaultDataPath('./presets/typo/AP_1/typo_tilemap.json')).toBe(false);
    expect(isDefaultDataPath(`${DEFAULT_TILEMAP_PATH}x`)).toBe(false);
  });

  it('⚠ the defaults still point at the gitignored preset — if that moves, this moves', () => {
    // A row that only asserted the predicate would pass on two paths that had
    // silently become something else.
    expect(DEFAULT_TILEMAP_PATH).toMatch(/robotkitty_tilemap\.json$/);
    expect(DEFAULT_CONFIG_PATH).toMatch(/robotkitty_tiles\.json$/);
  });
});
