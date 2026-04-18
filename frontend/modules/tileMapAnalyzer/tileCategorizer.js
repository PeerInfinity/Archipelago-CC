// frontend/modules/tileMapAnalyzer/tileCategorizer.js
//
// Secondary categorization: takes the base category grid produced by
// tileMapDataManager.buildCategoryGrid and derives the data that the
// reachability analyzer needs.
//
// Two outputs:
//
//   1. An "effective" category grid for a given ability set, with all
//      matching tile_transforms applied. E.g. with ability "red_key"
//      owned, every "door_red" tile becomes "air" in the effective
//      grid. The base grid is untouched so other ability sets can be
//      computed against it.
//
//   2. A floor-flag grid: boolean per tile, true iff the tile is
//      non-solid AND the tile directly beneath is solid. These are
//      the tiles the player can stand on. The BFS state space is
//      limited to floor tiles.
//
// Neither the base category grid nor the floor-flag grid depends on
// the movement model. The reachability analyzer picks the movement
// primitives separately.

/**
 * Return a new 2D category grid with every ability's tile_transforms
 * applied. If a category appears as a key in multiple abilities'
 * transform maps, the last one wins (abilitySet iteration order). In
 * practice there should be no such overlap in a well-formed config.
 */
export function applyTileTransforms(baseGrid, abilitySet, config) {
  const transforms = {};
  for (const ability of abilitySet) {
    const abilityDef = config.abilities && config.abilities[ability];
    if (!abilityDef || !abilityDef.tile_transforms) continue;
    Object.assign(transforms, abilityDef.tile_transforms);
  }
  if (Object.keys(transforms).length === 0) {
    return baseGrid;
  }
  const h = baseGrid.length;
  const w = baseGrid[0].length;
  const out = new Array(h);
  for (let y = 0; y < h; y++) {
    const row = baseGrid[y];
    const outRow = new Array(w);
    for (let x = 0; x < w; x++) {
      const name = row[x];
      outRow[x] = transforms[name] || name;
    }
    out[y] = outRow;
  }
  return out;
}

/**
 * Build the floor-flag grid. floorFlags[y][x] === true iff:
 *   - (x, y) is non-solid, non-lethal, and not blocks_floor
 *   - (x, y+1) exists and is solid
 *
 * Lethal tiles (acid) can't be stood on — the player dies.
 * blocks_floor tiles (enemies) can't be stood on — the enemy
 * blocks ground movement. But blocks_floor tiles are still
 * passable for jump arcs (the player can jump over them).
 */
export function deriveFloorFlags(categoryGrid, config) {
  const cats = config.categories;
  const h = categoryGrid.length;
  const w = categoryGrid[0].length;
  const out = new Array(h);

  const isSolid = (name) => !!(cats[name] && cats[name].solid);
  const isLethal = (name) => !!(cats[name] && cats[name].lethal);
  const blocksFloor = (name) => !!(cats[name] && cats[name].blocks_floor);

  for (let y = 0; y < h; y++) {
    const row = categoryGrid[y];
    const flagRow = new Array(w).fill(false);
    for (let x = 0; x < w; x++) {
      const here = row[x];
      if (isSolid(here) || isLethal(here) || blocksFloor(here)) continue;
      if (y + 1 >= h) continue;
      const below = categoryGrid[y + 1][x];
      if (isSolid(below)) flagRow[x] = true;
    }
    out[y] = flagRow;
  }
  return out;
}

/**
 * Convenience: produce both the effective category grid and the
 * floor-flag grid in one call.
 */
export function buildEffectiveGrids(baseGrid, abilitySet, config) {
  const effectiveGrid = applyTileTransforms(baseGrid, abilitySet, config);
  const floorFlags = deriveFloorFlags(effectiveGrid, config);
  return { effectiveGrid, floorFlags };
}
