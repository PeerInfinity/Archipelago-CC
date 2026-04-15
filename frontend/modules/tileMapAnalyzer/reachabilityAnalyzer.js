// frontend/modules/tileMapAnalyzer/reachabilityAnalyzer.js
//
// v1 reachability: BFS from a starting floor tile using a simple
// bounding-box movement model (walk + jump variants). Known to be a
// rough approximation — see the plan doc (phase 3 movement model)
// for the caveats. Phase 6 will replace the neighbor function with a
// physics-accurate reach table; the BFS scaffolding here stays the
// same.
//
// Inputs:
//   - effectiveGrid : categorized tile grid after tile_transforms
//   - floorFlags    : [y][x] boolean — can the player stand here?
//   - config        : the game config (for categories, abilities,
//                     movement_models)
//   - abilitySet    : Set<string> of ability names currently "owned"
//   - startX, startY: tile coordinates of the BFS source
//
// Output:
//   - reachable : Set of "y,x" keys for reached floor tiles
//   - parents   : Map from "y,x" → "y,x" of the tile it was reached from
//                 (for diagnostic path reconstruction later)

/**
 * Parse a movement-model identifier like "jump_2_2" or "jump_4_6"
 * into {dv, dh}. walk_horizontal is treated as jump_0_1 since the
 * neighbor function's bounding-box approach handles it the same way
 * (from a floor tile, reach an adjacent floor tile).
 *
 * Returns null if unrecognized.
 */
function parseMovementBox(name) {
  if (name === 'walk_horizontal') return { dv: 0, dh: 1 };
  const m = /^jump_(\d+)_(\d+)$/.exec(name);
  if (!m) return null;
  return { dv: parseInt(m[1], 10), dh: parseInt(m[2], 10) };
}

/**
 * Given an ability set, compute the union bounding box of all
 * movement primitives the player has access to. For v1 we take the
 * max over (dv, dh) pairs independently, which is a loose union
 * (allows combinations not strictly supported by any single ability,
 * e.g. max-dv of jump + max-dh of dash). Good enough for the v1
 * approximation; phase 6 will do real per-ability reach tables.
 *
 * maxDv is the upward reach (jump-up distance). maxFall is a
 * separate downward bound from config.fall_distance, modeling
 * "player walks off an edge / jumps down" without actually
 * integrating gravity. Without this, the bounding box model can't
 * represent any descent bigger than maxDv, and real maps become
 * nearly unreachable.
 */
export function computeMovementBox(abilitySet, config) {
  let maxDv = 0;
  let maxDh = 0;
  for (const ability of abilitySet) {
    const def = config.abilities && config.abilities[ability];
    if (!def || !def.movement) continue;
    const box = parseMovementBox(def.movement);
    if (!box) continue;
    if (box.dv > maxDv) maxDv = box.dv;
    if (box.dh > maxDh) maxDh = box.dh;
  }
  // Always at least walk.
  if (maxDh < 1) maxDh = 1;
  const maxFall = Math.max(maxDv, config.fall_distance || maxDv);
  return { maxDv, maxDh, maxFall };
}

function isBlockingArcTile(categoryName, config) {
  const cat = config.categories[categoryName];
  if (!cat) return true;
  return !!cat.solid || !!cat.lethal;
}

/**
 * Walk the straight line from (x0, y0) to (x1, y1) in tile space and
 * return false if any tile on the path (excluding the source) is
 * solid or lethal. Uses Bresenham with supercover-ish handling: we
 * include every tile whose center the line passes through. For the
 * v1 approximation we're generous — the arc isn't a real arc
 * anyway — so a simple midpoint interpolation is fine.
 *
 * Source tile is NOT checked (the player is standing on it). Dest
 * tile IS checked: it must be non-blocking and the caller separately
 * requires it to be a floor tile.
 */
function arcIsClear(x0, y0, x1, y1, effectiveGrid, config) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) return true;
  const h = effectiveGrid.length;
  const w = effectiveGrid[0].length;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(x0 + dx * t);
    const y = Math.round(y0 + dy * t);
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    if (isBlockingArcTile(effectiveGrid[y][x], config)) return false;
  }
  return true;
}

function key(x, y) { return `${y},${x}`; }

/**
 * BFS from (startX, startY) over the floor-tile graph. Returns
 * { reachable, parents } where reachable is a Set<key> and parents is
 * a Map<key, key>.
 */
function isPassableTile(categoryName, config) {
  const cat = config.categories[categoryName];
  if (!cat) return false;
  return !cat.solid && !cat.lethal;
}

/**
 * Walk-off-edge + fall primitive. From a floor tile (x, y), step
 * one tile horizontally into a non-floor air column, then fall
 * straight down until landing on the first floor tile. Returns an
 * array of {x, y} landing coordinates (0, 1, or 2 entries depending
 * on whether left/right edges exist).
 *
 * This models "the player walks off a ledge" — something the
 * diagonal-arc bounding-box model can't express because any
 * descending arc from a floor tile immediately crosses the solid
 * tile directly beneath the source. Phase 6's physics reach table
 * will subsume this.
 */
function edgeFallNeighbors(x, y, effectiveGrid, floorFlags, maxFall, config) {
  const out = [];
  const h = effectiveGrid.length;
  const w = effectiveGrid[0].length;
  for (const dx of [-1, 1]) {
    const ex = x + dx;
    if (ex < 0 || ex >= w) continue;
    const edgeTile = effectiveGrid[y][ex];
    if (!isPassableTile(edgeTile, config)) continue;
    if (floorFlags[y][ex]) continue;  // neighbor is already a floor — the normal walk neighbor handles it
    // Fall straight down through the air column at column ex.
    for (let k = 1; k <= maxFall; k++) {
      const ny = y + k;
      if (ny >= h) break;
      const cell = effectiveGrid[ny][ex];
      if (!isPassableTile(cell, config)) break;  // hit a wall / acid, fall aborted
      if (floorFlags[ny][ex]) {
        out.push({ x: ex, y: ny });
        break;
      }
    }
  }
  return out;
}

export function computeReachable(startX, startY, effectiveGrid, floorFlags, abilitySet, config) {
  const { maxDv, maxDh, maxFall } = computeMovementBox(abilitySet, config);
  const h = effectiveGrid.length;
  const w = effectiveGrid[0].length;
  const reachable = new Set();
  const parents = new Map();

  if (startX < 0 || startY < 0 || startX >= w || startY >= h) {
    return { reachable, parents };
  }
  if (!floorFlags[startY][startX]) {
    return { reachable, parents };
  }

  const startKey = key(startX, startY);
  reachable.add(startKey);
  const queue = [[startX, startY]];
  let head = 0;

  const visit = (nx, ny, cx, cy) => {
    const k = key(nx, ny);
    if (reachable.has(k)) return;
    reachable.add(k);
    parents.set(k, key(cx, cy));
    queue.push([nx, ny]);
  };

  // Neighbor box is asymmetric: up by maxDv (jump), down by maxFall
  // (fall). Horizontal reach is symmetric maxDh.
  while (head < queue.length) {
    const [cx, cy] = queue[head++];

    // Bounding-box jump/walk neighbors.
    for (let dy = -maxDv; dy <= maxFall; dy++) {
      for (let dx = -maxDh; dx <= maxDh; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (!floorFlags[ny][nx]) continue;
        if (reachable.has(key(nx, ny))) continue;
        if (!arcIsClear(cx, cy, nx, ny, effectiveGrid, config)) continue;
        visit(nx, ny, cx, cy);
      }
    }

    // Walk-off-edge + fall neighbors (handles descents the diagonal
    // arc check can't express).
    const fallTargets = edgeFallNeighbors(cx, cy, effectiveGrid, floorFlags, maxFall, config);
    for (const t of fallTargets) visit(t.x, t.y, cx, cy);
  }

  return { reachable, parents };
}

/**
 * Locate the player_start tile (category with is_player_start flag).
 * Returns {x, y} or null.
 */
export function findPlayerStart(categoryGrid, config) {
  const h = categoryGrid.length;
  const w = categoryGrid[0].length;
  const cats = config.categories;
  for (let y = 0; y < h; y++) {
    const row = categoryGrid[y];
    for (let x = 0; x < w; x++) {
      const cat = cats[row[x]];
      if (cat && cat.is_player_start) return { x, y };
    }
  }
  return null;
}

/**
 * Given a reachable set and a category predicate, return all
 * reachable tiles whose category satisfies the predicate. Used for
 * "find save points reachable from the start," "find collectables
 * reachable under basic abilities," etc.
 */
export function filterReachableByCategory(reachable, categoryGrid, config, predicate) {
  const out = [];
  const cats = config.categories;
  for (const k of reachable) {
    const [y, x] = k.split(',').map(Number);
    const cat = cats[categoryGrid[y][x]];
    if (predicate(cat)) out.push({ x, y });
  }
  return out;
}

/**
 * Collect all the collectable and save-point tiles on the map
 * (regardless of reachability). Used for overlays and later for
 * region discovery. Returns an array of { x, y, categoryName, ap_name }.
 */
export function findPointsOfInterest(categoryGrid, config) {
  const out = [];
  const cats = config.categories;
  const h = categoryGrid.length;
  const w = categoryGrid[0].length;
  for (let y = 0; y < h; y++) {
    const row = categoryGrid[y];
    for (let x = 0; x < w; x++) {
      const name = row[x];
      const cat = cats[name];
      if (!cat) continue;
      if (cat.is_region || cat.is_location || cat.is_player_start) {
        out.push({ x, y, categoryName: name, ap_name: cat.ap_name || null });
      }
    }
  }
  return out;
}
