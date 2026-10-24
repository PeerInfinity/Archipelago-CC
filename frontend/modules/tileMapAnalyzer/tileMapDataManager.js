// frontend/modules/tileMapAnalyzer/tileMapDataManager.js
//
// Loads the extractor output (tilemap.json) and the per-game category
// config (robotkitty_tiles.json) from the preset directory, and joins
// them into a single in-memory model that the renderer and analyzer
// consume.

const DEFAULT_PRESET_DIR =
  './presets/robotkitty_tilemap/AP_14089154938208861744';

export const DEFAULT_TILEMAP_PATH =
  `${DEFAULT_PRESET_DIR}/robotkitty_tilemap.json`;
export const DEFAULT_CONFIG_PATH =
  `${DEFAULT_PRESET_DIR}/robotkitty_tiles.json`;

/**
 * ⛓⛓ THE DEFAULT PRESET IS **GITIGNORED**, so a deployed site can never have it.
 *
 * `.gitignore` excludes `*_tilemap.json` and `*_tiles.json` (the extractor's
 * output is large and re-derivable), which means `robotkitty_tilemap.json` and
 * `robotkitty_tiles.json` exist on the machine that produced them and NOWHERE
 * ELSE. On GitHub Pages the panel therefore opened, fetched two files that are
 * not there, and printed `error: failed to fetch … 404` to the console of every
 * visitor — a red line about a file that is absent BY DESIGN.
 *
 * ⛔ A 404 IS A DIFFERENT FACT FROM A BAD RESPONSE, so it gets its own class
 * rather than a string match at the call site. And it carries the PATH, because
 * the caller's question is "was this the default, or something the user
 * chose?" — a 404 on a path somebody typed is a real error and stays one.
 */
export class TileMapDataMissingError extends Error {
  constructor(path) {
    super(`${path} is not served here (HTTP 404)`);
    this.name = 'TileMapDataMissingError';
    this.path = path;
  }
}

/** Is this one of the two paths that are gitignored and therefore optional? */
export const isDefaultDataPath = (path) =>
  path === DEFAULT_TILEMAP_PATH || path === DEFAULT_CONFIG_PATH;

async function fetchJson(path) {
  const res = await fetch(path);
  if (res.status === 404) throw new TileMapDataMissingError(path);
  if (!res.ok) {
    throw new Error(`failed to fetch ${path}: ${res.status} ${res.statusText}`);
  }
  return await res.json();
}

export async function loadTileMap(path = DEFAULT_TILEMAP_PATH) {
  const data = await fetchJson(path);
  if (!Array.isArray(data.tiles)) {
    throw new Error(`tilemap ${path} missing tiles array`);
  }
  if (typeof data.map_width !== 'number' || typeof data.map_height !== 'number') {
    throw new Error(`tilemap ${path} missing map_width/map_height`);
  }
  return data;
}

export async function loadCategoryConfig(path = DEFAULT_CONFIG_PATH) {
  const data = await fetchJson(path);
  if (!data.categories || typeof data.categories !== 'object') {
    throw new Error(`category config ${path} missing categories object`);
  }
  if (!data.tile_ids || typeof data.tile_ids !== 'object') {
    throw new Error(`category config ${path} missing tile_ids object`);
  }
  return data;
}

/**
 * Resolve each raw byte in the tile grid to a category name using the
 * config's tile_ids table. Returns a 2D array of category names, the
 * same shape as the input tiles grid. Unknown raw values fall through
 * to config.default_category (typically "unknown").
 */
export function buildCategoryGrid(tilemap, config) {
  const fallback = config.default_category || 'unknown';
  const idTable = config.tile_ids;
  const height = tilemap.map_height;
  const width = tilemap.map_width;
  const out = new Array(height);
  for (let y = 0; y < height; y++) {
    const row = tilemap.tiles[y];
    const outRow = new Array(width);
    for (let x = 0; x < width; x++) {
      const id = row[x];
      const name = idTable[String(id)] || fallback;
      outRow[x] = name;
    }
    out[y] = outRow;
  }
  return out;
}
