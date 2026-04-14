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

async function fetchJson(path) {
  const res = await fetch(path);
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
