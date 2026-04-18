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
  return !!cat.solid || !!cat.lethal || !!cat.blocks_floor;
}

/**
 * Check whether a jump arc from (x0, y0) to (x1, y1) is traversable.
 *
 * Tries **three arc shapes** and accepts if ANY is clear. A real
 * jump trajectory is a parabola, which none of the three shapes
 * model exactly, but together they cover the cases that matter:
 *
 * 1. **L-arc "vertical first"**: go straight up/down at source
 *    column, then horizontally to destination. Handles shafts
 *    (player jumps up through a vertical opening, then drifts over).
 * 2. **L-arc "horizontal first"**: go horizontally at source height,
 *    then up/down at destination column. Handles ledges with walls
 *    directly above (player runs sideways off a ledge, then
 *    rises/falls).
 * 3. **Diagonal**: step-by-step interpolation from source to
 *    destination. Handles open-air jumps where neither L-shape
 *    fits.
 *
 * Source tile is NOT checked. Dest tile IS checked.
 * Phase 6's physics reach table will replace all of this.
 *
 * @param maxDv - maximum upward jump reach in tiles (needed for the
 *   "hop" arc on horizontal jumps). Pass 0 to skip the hop check.
 */
function arcIsClear(x0, y0, x1, y1, effectiveGrid, config, maxDv = 0) {
  if (x0 === x1 && y0 === y1) return true;
  const h = effectiveGrid.length;
  const w = effectiveGrid[0].length;

  const blocked = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return true;
    return isBlockingArcTile(effectiveGrid[y][x], config);
  };

  // Helper: check an L-shaped path (phase1 then phase2).
  // Each phase is a list of (x, y) to check.
  const checkL = (vertFirst) => {
    const dxSign = x1 > x0 ? 1 : x1 < x0 ? -1 : 0;
    const dySign = y1 > y0 ? 1 : y1 < y0 ? -1 : 0;
    if (vertFirst) {
      // Phase 1: vertical at x0
      for (let y = y0 + dySign; y !== y1 + dySign; y += dySign) {
        if (blocked(x0, y)) return false;
      }
      // Phase 2: horizontal at y1
      for (let x = x0 + dxSign; x !== x1 + dxSign; x += dxSign) {
        if (blocked(x, y1)) return false;
      }
    } else {
      // Phase 1: horizontal at y0
      for (let x = x0 + dxSign; x !== x1 + dxSign; x += dxSign) {
        if (blocked(x, y0)) return false;
      }
      // Phase 2: vertical at x1
      for (let y = y0 + dySign; y !== y1 + dySign; y += dySign) {
        if (blocked(x1, y)) return false;
      }
    }
    return true;
  };

  // Helper: check a straight diagonal path.
  const checkDiag = () => {
    const adx = Math.abs(x1 - x0);
    const ady = Math.abs(y1 - y0);
    const steps = Math.max(adx, ady);
    if (steps === 0) return true;
    const dx = x1 - x0;
    const dy = y1 - y0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(x0 + dx * t);
      const y = Math.round(y0 + dy * t);
      if (blocked(x, y)) return false;
    }
    return true;
  };

  // For horizontal moves (dy == 0), try the straight horizontal
  // first, then a "hop" arc that jumps up by maxDv, crosses
  // horizontally at the elevated height, and comes back down. The
  // hop handles ground-level enemies the player can jump over.
  if (y0 === y1) {
    if (checkDiag()) return true;
    if (maxDv > 0) {
      // Hop: up maxDv at x0, across at y0 - maxDv, down maxDv at x1.
      const peakY = y0 - maxDv;
      if (peakY >= 0) {
        let clear = true;
        // Phase 1: go up at x0
        for (let y = y0 - 1; y >= peakY; y--) {
          if (blocked(x0, y)) { clear = false; break; }
        }
        if (clear) {
          // Phase 2: go across at peakY
          const dxSign = x1 > x0 ? 1 : -1;
          for (let x = x0 + dxSign; x !== x1 + dxSign; x += dxSign) {
            if (blocked(x, peakY)) { clear = false; break; }
          }
        }
        if (clear) {
          // Phase 3: go down at x1
          for (let y = peakY + 1; y <= y1; y++) {
            if (blocked(x1, y)) { clear = false; break; }
          }
        }
        if (clear) return true;
      }
    }
    return false;
  }

  // Try all three; accept if any succeeds.
  return checkL(true) || checkL(false) || checkDiag();
}

function key(x, y) { return `${y},${x}`; }

/**
 * BFS from (startX, startY) over the floor-tile graph. Returns
 * { reachable, parents } where reachable is a Set<key> and parents is
 * a Map<key, key>.
 */
/**
 * Check if a tile is passable for traversal (edge-fall drops, etc.).
 * A tile is passable if it is not solid, not lethal, and not
 * blocks_floor. Note: the ARC check uses isBlockingArcTile which
 * does NOT check blocks_floor — that's intentional, because the
 * player can jump OVER enemies. But for edge-fall (vertical drop),
 * passing through an enemy tile means touching it, which kills the
 * player.
 */
function isPassableTile(categoryName, config) {
  const cat = config.categories[categoryName];
  if (!cat) return false;
  return !cat.solid && !cat.lethal && !cat.blocks_floor;
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
        if (!arcIsClear(cx, cy, nx, ny, effectiveGrid, config, maxDv)) continue;
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

/**
 * Post-BFS pass: find midair POIs reachable via jump arcs from the
 * already-computed reachable floor set. Some collectables are placed
 * in midair — the player collects them by jumping through the tile,
 * not by standing on it. These tiles aren't floor tiles so the main
 * BFS never visits them, but they should count as "reachable" if
 * any reached floor tile has a clear jump arc that passes through
 * them.
 *
 * Returns a new Set that is the union of the original reachable set
 * plus any midair POI tiles that are reachable.
 */
export function addMidairPOIs(reachable, effectiveGrid, floorFlags, categoryGrid, abilitySet, config) {
  const { maxDv, maxDh, maxFall } = computeMovementBox(abilitySet, config);
  const cats = config.categories;
  const h = effectiveGrid.length;
  const w = effectiveGrid[0].length;
  const augmented = new Set(reachable);

  // Collect midair POIs: POI tiles that are NOT floor tiles and
  // are NOT already in the reachable set.
  const midairPOIs = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const name = categoryGrid[y][x];
      const cat = cats[name];
      if (!cat) continue;
      if (!(cat.is_region || cat.is_location)) continue;
      if (floorFlags[y][x]) continue;              // it's a floor tile, BFS handles it
      if (augmented.has(key(x, y))) continue;       // already reached
      midairPOIs.push({ x, y });
    }
  }

  if (midairPOIs.length === 0) return augmented;

  // For each midair POI, check if any reachable floor tile can
  // reach it. We invert the search: for each midair POI, scan the
  // reachable set for tiles within jump range.
  for (const poi of midairPOIs) {
    let found = false;
    for (const k of reachable) {
      const comma = k.indexOf(',');
      const fy = parseInt(k.slice(0, comma), 10);
      const fx = parseInt(k.slice(comma + 1), 10);
      const dx = poi.x - fx;
      const dy = poi.y - fy;
      if (Math.abs(dx) > maxDh) continue;
      if (dy < -maxDv || dy > maxFall) continue;
      if (arcIsClear(fx, fy, poi.x, poi.y, effectiveGrid, config, maxDv)) {
        augmented.add(key(poi.x, poi.y));
        found = true;
        break;
      }
    }
  }

  return augmented;
}
