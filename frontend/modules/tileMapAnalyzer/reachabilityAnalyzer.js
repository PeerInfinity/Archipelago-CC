// frontend/modules/tileMapAnalyzer/reachabilityAnalyzer.js
//
// Bounding-box reachability: BFS from a starting floor tile, with
// per-source state-machine expansion modelling the Player.as air-
// state transitions (G → A0 jump / A1 DJ / A2 dash / rocket). A
// rough approximation — the physics-accurate model in
// reachabilityPhysics.js is the ground truth and is dispatched when
// config.use_physics_model is true.

import { computeReachablePhysics } from './reachabilityPhysics.js';
//
// Inputs:
//   - effectiveGrid : categorized tile grid after tile_transforms
//   - floorFlags    : [y][x] boolean — can the player stand here?
//   - categoryGrid  : raw (pre-transforms) category grid — used to
//                     detect POIs, whose flags are stable across
//                     ability-specific transforms
//   - config        : the game config (for categories, abilities,
//                     movement_models)
//   - abilitySet    : Set<string> of ability names currently "owned"
//   - startX, startY: tile coordinates of the BFS source
//
// Output:
//   - reachable    : Set of "y,x" keys for reached floor tiles
//   - parents      : Map from "y,x" → "y,x" of the tile it was reached
//                    from (for diagnostic path reconstruction later)
//   - sweptPre     : Set of "y,x" keys for air tiles traversed by
//                    arcs BEFORE any midair ability (DJ / dash /
//                    rocket) was used — jump arcs and walk-off falls.
//   - sweptPost    : Set of "y,x" keys for air tiles traversed by
//                    arcs AFTER a midair ability was used — DJ chain,
//                    dash, rocket, and the walk-off midair composites.
//   - midairPOIs   : Set of "y,x" keys for POI tiles (non-floor) that
//                    a reachable floor tile has a clear arc to. Kept
//                    separate from `reachable` so callers can
//                    distinguish floor-reachable from POI-only.

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
 * Given an ability set, resolve each movement-bearing ability to its
 * (dv, dh) box and compute the maximum fall distance.
 *
 * Returns { perAbility, maxFall }. Composition between abilities (e.g.
 * jump-then-dash) is modelled explicitly by the state-machine
 * expansion in `expandFromFloor`, not by synthetic boxes here.
 */
export function computeMovementBox(abilitySet, config) {
  const perAbility = {};
  let maxDv = 0;
  for (const ability of abilitySet) {
    const def = config.abilities && config.abilities[ability];
    if (!def || !def.movement) continue;
    const box = parseMovementBox(def.movement);
    if (!box) continue;
    perAbility[ability] = box;
    if (box.dv > maxDv) maxDv = box.dv;
  }
  const maxFall = Math.max(maxDv, config.fall_distance || maxDv);
  return { perAbility, maxFall };
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
 *
 * @param maxDv - maximum upward jump reach in tiles (needed for the
 *   "hop" arc on horizontal jumps). Pass 0 to skip the hop check.
 * @param swept - optional Set<"y,x">. When provided, the tiles
 *   traversed by the winning arc shape (excluding the source,
 *   including the dest) are unioned in. Tiles from failed shape
 *   attempts are not recorded.
 */
function arcIsClear(x0, y0, x1, y1, effectiveGrid, config, maxDv = 0, swept = null) {
  if (x0 === x1 && y0 === y1) return true;
  const h = effectiveGrid.length;
  const w = effectiveGrid[0].length;

  const blocked = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return true;
    return isBlockingArcTile(effectiveGrid[y][x], config);
  };

  // Each shape helper returns a Set<"y,x"> of tiles it traversed on
  // success, or null on failure. Source tile is never added; dest is.
  // The outer logic unions the first successful shape's set into the
  // caller's `swept` (if provided).

  const checkL = (vertFirst) => {
    const local = new Set();
    const dxSign = x1 > x0 ? 1 : x1 < x0 ? -1 : 0;
    const dySign = y1 > y0 ? 1 : y1 < y0 ? -1 : 0;
    if (vertFirst) {
      for (let y = y0 + dySign; y !== y1 + dySign; y += dySign) {
        if (blocked(x0, y)) return null;
        local.add(`${y},${x0}`);
      }
      for (let x = x0 + dxSign; x !== x1 + dxSign; x += dxSign) {
        if (blocked(x, y1)) return null;
        local.add(`${y1},${x}`);
      }
    } else {
      for (let x = x0 + dxSign; x !== x1 + dxSign; x += dxSign) {
        if (blocked(x, y0)) return null;
        local.add(`${y0},${x}`);
      }
      for (let y = y0 + dySign; y !== y1 + dySign; y += dySign) {
        if (blocked(x1, y)) return null;
        local.add(`${y},${x1}`);
      }
    }
    return local;
  };

  // Straight diagonal with corner-cut prevention.
  //
  // The original implementation sampled Math.round at fractional
  // steps, which skipped intermediate tiles. A move from (20, 48)
  // to (22, 49), for instance, would sample (21, 49) but never
  // (21, 48) — so a wall at (21, 48) went undetected and the arc
  // was falsely accepted.
  //
  // Fix: oversample (2× steps), and whenever a sample advances
  // both x and y relative to the previous sample, require at
  // least one of the two "corner" tiles — (newX, prevY) or
  // (prevX, newY) — to be clear. Blocking both corners means the
  // diagonal can't squeeze through.
  const checkDiag = () => {
    const local = new Set();
    const adx = Math.abs(x1 - x0);
    const ady = Math.abs(y1 - y0);
    const steps = Math.max(adx, ady) * 2;
    if (steps === 0) return local;
    const dx = x1 - x0;
    const dy = y1 - y0;
    let prevX = x0, prevY = y0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(x0 + dx * t);
      const y = Math.round(y0 + dy * t);
      if (x === prevX && y === prevY) continue;
      if (x !== prevX && y !== prevY) {
        if (blocked(x, prevY) && blocked(prevX, y)) return null;
      }
      if (blocked(x, y)) return null;
      local.add(`${y},${x}`);
      prevX = x; prevY = y;
    }
    return local;
  };

  // High hop arc: up by maxDv at x0, across at the peak, down to y1
  // at x1. Handles jumping over ground-level enemies with enough
  // ceiling clearance — the jump peaks above the enemy tile.
  const checkHop = () => {
    if (maxDv <= 0) return null;
    const peakY = y0 - maxDv;
    if (peakY < 0) return null;
    const local = new Set();
    for (let y = y0 - 1; y >= peakY; y--) {
      if (blocked(x0, y)) return null;
      local.add(`${y},${x0}`);
    }
    if (x0 !== x1) {
      const dxSign = x1 > x0 ? 1 : -1;
      for (let x = x0 + dxSign; x !== x1 + dxSign; x += dxSign) {
        if (blocked(x, peakY)) return null;
        local.add(`${peakY},${x}`);
      }
    }
    for (let y = peakY + 1; y <= y1; y++) {
      if (blocked(x1, y)) return null;
      local.add(`${y},${x1}`);
    }
    return local;
  };

  const commit = (local) => {
    if (!local) return false;
    if (swept) for (const k of local) swept.add(k);
    return true;
  };

  if (y0 === y1) {
    if (commit(checkDiag())) return true;
  } else {
    if (commit(checkL(true))) return true;
    if (commit(checkL(false))) return true;
    if (commit(checkDiag())) return true;
  }
  if (commit(checkHop())) return true;
  return false;
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
 * State-machine expansion from a single floor tile. Enumerates every
 * floor landing reachable in one "flight" — a sequence of primitives
 * starting from G (grounded) and ending when the player next touches
 * a floor. Populates `sweptPre` with tiles swept by chains that
 * haven't consumed a midair ability yet, and `sweptPost` with those
 * after a DJ / dash / rocket.
 *
 * Air states (Player.as-derived):
 *   A0  airborne, DJ available, dash available   (via jump / rocket / walk-off)
 *   A1  airborne, DJ used,      dash available   (via DJ from A0)
 *   A2  airborne, dash used     (DJ locked)      (via ground dash, or dash from A0/A1)
 *
 * Transitions:
 *   G  --jump--------> A0        G  --rocket----> A0
 *   G  --walkoff/drop> A0        G  --dash------> A2
 *   A0 --DJ----------> A1        A0 --dash------> A2        A1 --dash--> A2
 *   any air --gravity-> same state, until floor (land → G)
 *
 * Each transition uses the corresponding ability's movement box and
 * `arcIsClear` for obstacle validation. Composite reaches like
 * "jump then dash" emerge from the chain naturally — no synthetic
 * boxes needed. Returns { landings: Set<"y,x"> }.
 */
function expandFromFloor(cx, cy, effectiveGrid, floorFlags, abilitySet, config, sweptPre, sweptPost) {
  const h = effectiveGrid.length;
  const w = effectiveGrid[0].length;
  const { perAbility, maxFall } = computeMovementBox(abilitySet, config);
  const landings = new Set();

  const jumpBox = perAbility['jump'];
  const chainDjBox = perAbility['double_jump'];
  const dashBox = perAbility['dash'];
  const rocketBox = perAbility['rocket'];
  const haveJump = abilitySet.has('jump');
  const haveDJ = abilitySet.has('double_jump');
  const haveDash = abilitySet.has('dash');
  const haveRocket = abilitySet.has('rocket');

  // Midair-only DJ box: chain minus jump (Minkowski inverse). See the
  // comments in expandFromFloor's earlier revisions for why.
  const midairDjBox = chainDjBox
    ? (jumpBox
        ? { dv: Math.max(0, chainDjBox.dv - jumpBox.dv),
            dh: Math.max(0, chainDjBox.dh - jumpBox.dh) }
        : chainDjBox)
    : null;

  const inBounds = (x, y) => x >= 0 && y >= 0 && x < w && y < h;

  // Per-source dedup, split by category so a tile reached via pre
  // (e.g. jump) and via post (e.g. DJ chain) records both sweep paths.
  const reachedPre = new Set();
  const reachedPost = new Set();

  // tryArc targets a floor only. `swept` + `reached` pick which side
  // of the split this chain belongs to.
  const tryArc = (fx, fy, tx, ty, hopDv, swept, reached) => {
    if (tx === fx && ty === fy) return;
    if (!inBounds(tx, ty)) return;
    if (tx === cx && ty === cy) return;
    if (!floorFlags[ty][tx]) return;
    const tkey = `${ty},${tx}`;
    if (reached.has(tkey)) return;
    if (!arcIsClear(fx, fy, tx, ty, effectiveGrid, config, hopDv, swept)) return;
    reached.add(tkey);
    landings.add(key(tx, ty));
  };

  // 2D reach iteration for jump / DJ / rocket / composites.
  const seedArcBox = (fx, fy, box, swept, reached) => {
    if (!box) return;
    for (let dy = -box.dv; dy <= maxFall; dy++) {
      for (let dx = -box.dh; dx <= box.dh; dx++) {
        if (dx === 0 && dy === 0) continue;
        tryArc(fx, fy, fx + dx, fy + dy, box.dv, swept, reached);
      }
    }
  };

  // Horizontal-only reach for dash (gravity after the dash is picked
  // up by the next BFS expansion from the A2 landing tile).
  const seedDash = (fx, fy, swept, reached) => {
    if (!dashBox) return;
    for (let dx = -dashBox.dh; dx <= dashBox.dh; dx++) {
      if (dx === 0) continue;
      tryArc(fx, fy, fx + dx, fy, 0, swept, reached);
    }
  };

  // Ground-initiated chains from source. Tagged pre/post by which
  // midair abilities the chain uses:
  //   pre  = no midair ability consumed yet (just jump)
  //   post = DJ, dash, or rocket used somewhere in the chain
  if (haveJump) seedArcBox(cx, cy, jumpBox, sweptPre, reachedPre);
  if (haveDJ) seedArcBox(cx, cy, chainDjBox, sweptPost, reachedPost);
  if (haveRocket) seedArcBox(cx, cy, rocketBox, sweptPost, reachedPost);
  if (haveDash) seedDash(cx, cy, sweptPost, reachedPost);
  if (haveJump && haveDash) {
    seedArcBox(cx, cy, { dv: jumpBox.dv, dh: jumpBox.dh + dashBox.dh },
               sweptPost, reachedPost);
  }
  if (haveDJ && haveDash) {
    seedArcBox(cx, cy, { dv: chainDjBox.dv, dh: chainDjBox.dh + dashBox.dh },
               sweptPost, reachedPost);
  }

  // Walk-off + gravity fall: pre (no midair used). The first few
  // fall tiles also seed the walk-off midair composites:
  //   walk-off + midair DJ   (A0 → A1, post)
  //   walk-off + dash        (A0 → A2, post)
  // The 3-chain is skipped for perf (see earlier notes).
  const WALKOFF_COMPOSITE_DEPTH = 4;
  for (const dir of [-1, 1]) {
    const ex = cx + dir;
    if (!inBounds(ex, cy)) continue;
    if (floorFlags[cy][ex]) { landings.add(key(ex, cy)); continue; }
    if (!isPassableTile(effectiveGrid[cy][ex], config)) continue;
    for (let k = 0; k <= maxFall; k++) {
      const ay = cy + k;
      if (ay >= h) break;
      if (!isPassableTile(effectiveGrid[ay][ex], config)) break;
      sweptPre.add(`${ay},${ex}`);
      if (floorFlags[ay][ex]) { landings.add(key(ex, ay)); break; }
      if (k < WALKOFF_COMPOSITE_DEPTH) {
        if (haveDJ && midairDjBox) seedArcBox(ex, ay, midairDjBox, sweptPost, reachedPost);
        if (haveDash) seedDash(ex, ay, sweptPost, reachedPost);
      }
    }
  }

  return { landings };
}

export function computeReachable(startX, startY, effectiveGrid, floorFlags, categoryGrid, abilitySet, config) {
  if (config && config.use_physics_model) {
    return computeReachablePhysics(startX, startY, effectiveGrid, floorFlags, categoryGrid, abilitySet, config);
  }
  const h = effectiveGrid.length;
  const w = effectiveGrid[0].length;
  const reachable = new Set();
  const parents = new Map();
  const sweptPre = new Set();
  const sweptPost = new Set();
  const midairPOIs = new Set();

  if (startX < 0 || startY < 0 || startX >= w || startY >= h) {
    return { reachable, parents, sweptPre, sweptPost, midairPOIs };
  }
  if (!floorFlags[startY][startX]) {
    return { reachable, parents, sweptPre, sweptPost, midairPOIs };
  }

  const startKey = key(startX, startY);
  reachable.add(startKey);
  const queue = [[startX, startY]];
  let head = 0;

  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    const { landings } = expandFromFloor(
      cx, cy, effectiveGrid, floorFlags, abilitySet, config, sweptPre, sweptPost,
    );
    for (const lk of landings) {
      if (reachable.has(lk)) continue;
      reachable.add(lk);
      parents.set(lk, key(cx, cy));
      const comma = lk.indexOf(',');
      const ly = parseInt(lk.slice(0, comma), 10);
      const lx = parseInt(lk.slice(comma + 1), 10);
      queue.push([lx, ly]);
    }
  }

  // Midair POIs: a POI tile is reachable if it was swept by a
  // successful floor-to-floor arc (pre or post), or — as a fallback —
  // if a direct arc from any reachable floor terminates there. The
  // fallback iterates every ground-rooted chain (primitives AND
  // composites) so a POI reachable only via e.g. jump+dash isn't
  // missed.
  const cats = config.categories;
  const { perAbility, maxFall } = computeMovementBox(abilitySet, config);
  const jumpBox = perAbility['jump'];
  const djBox = perAbility['double_jump'];
  const dashBox = perAbility['dash'];
  const rocketBox = perAbility['rocket'];
  const poiBoxes = [];
  if (abilitySet.has('jump') && jumpBox) {
    poiBoxes.push({ box: jumpBox, swept: sweptPre });  // pre: no midair used
  }
  if (abilitySet.has('double_jump') && djBox) {
    poiBoxes.push({ box: djBox, swept: sweptPost });
  }
  if (abilitySet.has('rocket') && rocketBox) {
    poiBoxes.push({ box: rocketBox, swept: sweptPost });
  }
  if (abilitySet.has('dash') && dashBox) {
    poiBoxes.push({ box: dashBox, swept: sweptPost });
  }
  if (abilitySet.has('jump') && abilitySet.has('dash') && jumpBox && dashBox) {
    poiBoxes.push({
      box: { dv: jumpBox.dv, dh: jumpBox.dh + dashBox.dh },
      swept: sweptPost,
    });
  }
  if (abilitySet.has('double_jump') && abilitySet.has('dash') && djBox && dashBox) {
    poiBoxes.push({
      box: { dv: djBox.dv, dh: djBox.dh + dashBox.dh },
      swept: sweptPost,
    });
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cat = cats[categoryGrid[y][x]];
      if (!cat || !(cat.is_region || cat.is_location)) continue;
      if (floorFlags[y][x]) continue;
      const poiKey = key(x, y);
      if (reachable.has(poiKey)) continue;
      if (sweptPre.has(poiKey) || sweptPost.has(poiKey)) {
        midairPOIs.add(poiKey); continue;
      }
      for (const k of reachable) {
        const comma = k.indexOf(',');
        const fy = parseInt(k.slice(0, comma), 10);
        const fx = parseInt(k.slice(comma + 1), 10);
        const adx = Math.abs(x - fx);
        const adyUp = fy - y;
        const adyDown = y - fy;
        if (adyDown > maxFall) continue;
        let matched = false;
        for (const { box, swept } of poiBoxes) {
          if (adx > box.dh) continue;
          if (adyUp > box.dv) continue;
          if (arcIsClear(fx, fy, x, y, effectiveGrid, config, box.dv, swept)) {
            matched = true; break;
          }
        }
        if (matched) { midairPOIs.add(poiKey); break; }
      }
    }
  }

  return { reachable, parents, sweptPre, sweptPost, midairPOIs };
}

/**
 * Single-step probe under the bounding-box model: enumerate every
 * floor tile reachable from (cx, cy) by one "flight" — a state-machine
 * chain of primitives terminating on a floor. Mirrors the inner body
 * of computeReachable() but skips BFS expansion. Used by the "click
 * to explore" diagnostic overlay.
 *
 * Returns { landings: [{x, y}], sweptPre, sweptPost } where the swept
 * sets are air tiles traversed by chains before / after a midair
 * ability (DJ, dash, rocket) was used.
 */
export function probeOneTileOld(cx, cy, effectiveGrid, floorFlags, abilitySet, config) {
  const h = effectiveGrid.length;
  const w = effectiveGrid[0].length;
  if (cx < 0 || cy < 0 || cx >= w || cy >= h || !floorFlags[cy][cx]) {
    return { landings: [], sweptPre: new Set(), sweptPost: new Set() };
  }
  const sweptPre = new Set();
  const sweptPost = new Set();
  const { landings } = expandFromFloor(
    cx, cy, effectiveGrid, floorFlags, abilitySet, config, sweptPre, sweptPost,
  );
  const out = [];
  for (const lk of landings) {
    const comma = lk.indexOf(',');
    const ly = parseInt(lk.slice(0, comma), 10);
    const lx = parseInt(lk.slice(comma + 1), 10);
    out.push({ x: lx, y: ly });
  }
  return { landings: out, sweptPre, sweptPost };
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
 * Order save points according to config.save_point_order if present.
 * Each entry in the order array is { x, y }. Save points matching
 * those coordinates are placed first in that order; any remaining
 * save points (not in the order list) are appended at the end in
 * their original order.
 */
export function orderSavePoints(savePoints, config) {
  const order = config.save_point_order;
  if (!Array.isArray(order) || order.length === 0) return savePoints;
  const ordered = [];
  const remaining = [...savePoints];
  for (const entry of order) {
    const idx = remaining.findIndex(sp => sp.x === entry.x && sp.y === entry.y);
    if (idx !== -1) {
      ordered.push(remaining.splice(idx, 1)[0]);
    }
  }
  return ordered.concat(remaining);
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

