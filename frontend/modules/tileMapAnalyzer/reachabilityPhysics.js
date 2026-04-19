// frontend/modules/tileMapAnalyzer/reachabilityPhysics.js
//
// Physics-accurate reachability BFS. Replaces the bounding-box +
// L-arc logic in reachabilityAnalyzer.js for robotkitty. Dispatch
// is gated by config.use_physics_model.
//
// See NewDocs/plans/tile-map-analyzer-physics-model.md.
//
// Approach:
//   1. Build a reach table from the ability set (empty-grid, obstacle-
//      independent). This defines the CANDIDATE set of (dx, dy)
//      offsets the player might reach from any floor tile.
//   2. BFS. At each source floor tile, run trajectory probes on the
//      REAL grid for every ability family the player owns. Each probe
//      yields a path that respects solid/lethal tiles and lands where
//      a floor tile catches the feet.
//   3. Every landing tile found is a BFS neighbor.
//   4. Midair POIs: any tile the hitbox sweeps during a probe that
//      is a POI counts as reachable (same as the old model).
//
// The candidate reach table acts as a pre-filter: we only search for
// trajectories to (dx, dy) offsets that are theoretically reachable
// with the current ability set. In practice, the probes collect ALL
// landings anyway, so the table is mostly used to bound the search
// radius and to validate the new code against a known envelope.

import {
  DEFAULT_PHYSICS,
  gridAccessor,
  simulateJump,
  simulateDoubleJump,
  simulateDash,
  simulateRocket,
  simulateFall,
  simulateTrajectory,
  floorTileToHitbox,
} from './physicsModel.js';
import { buildReachTable } from './reachTable.js';

function key(x, y) { return `${y},${x}`; }

function getPhysics(config) {
  if (config && config.physics) {
    return { ...DEFAULT_PHYSICS, ...config.physics };
  }
  return DEFAULT_PHYSICS;
}

/**
 * For each adjacent-frame pair in `path`, find every tile boundary
 * the hitbox bottom crosses going downward. Each crossing over
 * `tyB` produces a candidate landing on floor tile (tx, tyB - 1),
 * for every column `tx` the hitbox overlapped at the crossing
 * moment. Only crossings where the target is actually a floor tile
 * in `floorFlags` are kept.
 */
function collectLandings(path, phys, floorFlags, w, h) {
  const landings = [];
  const seen = new Set();
  const { tile, hitboxW, hitboxH } = phys;
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const prevBot = prev.y + hitboxH;
    const currBot = curr.y + hitboxH;
    if (currBot <= prevBot) continue;
    const tyStart = Math.ceil(prevBot / tile);
    const tyEnd = Math.floor(currBot / tile);
    for (let tyB = tyStart; tyB <= tyEnd; tyB++) {
      if (tyB * tile <= prevBot || tyB * tile > currBot) continue;
      const frac = (tyB * tile - prevBot) / (currBot - prevBot);
      const xAt = prev.x + (curr.x - prev.x) * frac;
      const tx0 = Math.floor(xAt / tile);
      const tx1 = Math.floor((xAt + hitboxW - 1) / tile);
      const landTy = tyB - 1;
      if (landTy < 0 || landTy >= h) continue;
      for (let tx = tx0; tx <= tx1; tx++) {
        if (tx < 0 || tx >= w) continue;
        if (!floorFlags[landTy][tx]) continue;
        const k = key(tx, landTy);
        if (seen.has(k)) continue;
        seen.add(k);
        landings.push({ x: tx, y: landTy, frame: i });
      }
    }
  }
  return landings;
}

/**
 * Coarse input schedule grid. Each schedule is a list of
 * (untilFrame, direction) segments. Same grid as reachTable.js so
 * the real-grid probes match the empty-grid candidate set.
 */
function* inputSchedules(dir) {
  yield [{ untilFrame: 10000, dir }];
  for (const stopFrame of [10, 20, 30, 60, 120]) {
    yield [{ untilFrame: stopFrame, dir }, { untilFrame: 10000, dir: 0 }];
  }
  for (const switchFrame of [15, 30]) {
    yield [{ untilFrame: switchFrame, dir }, { untilFrame: 10000, dir: -dir }];
  }
}

/**
 * Run all trajectory probes from floor tile (cx, cy). Returns
 * { landings: [{x, y}], sweptTiles: Set<"y,x"> } aggregating across
 * every probe.
 */
function probeFromTile(cx, cy, abilitySet, grid, phys, floorFlags, w, h) {
  const { px, py } = floorTileToHitbox(cx, cy, phys);
  const allLandings = [];
  const allSwept = new Set();
  const seenLanding = new Set();

  const addResult = (res) => {
    for (const k of res.sweptTiles) allSwept.add(k);
    const lands = collectLandings(res.path, phys, floorFlags, w, h);
    for (const l of lands) {
      const k = key(l.x, l.y);
      if (l.x === cx && l.y === cy) continue;
      if (seenLanding.has(k)) continue;
      seenLanding.add(k);
      allLandings.push(l);
    }
    // collectLandings only detects landings via downward tile-
    // boundary crossings; trajectories that end with the player
    // settled on a floor after a wall bonk or dash-abort don't
    // produce a crossing. Include any floor the simulator
    // reported explicitly.
    if (res.landing) {
      const { tx, ty } = res.landing;
      const k = key(tx, ty);
      if (!(tx === cx && ty === cy) && !seenLanding.has(k)) {
        seenLanding.add(k);
        allLandings.push({ x: tx, y: ty, frame: res.stoppedFrame || 0 });
      }
    }
  };

  const have = (a) => abilitySet.has(a);

  // Walk (lateral adjacency). Simulate as a 1-frame lateral step
  // with no gravity effect: the BFS could handle this without sim,
  // but running it keeps the logic uniform.
  for (const dx of [-1, 1]) {
    const nx = cx + dx;
    if (nx >= 0 && nx < w && floorFlags[cy][nx]) {
      // Check that the tile the player moves into is not blocked.
      // Walking within a floor row is always legal if both tiles
      // are floor (they're non-solid by definition).
      const kk = key(nx, cy);
      if (!seenLanding.has(kk)) {
        seenLanding.add(kk);
        allLandings.push({ x: nx, y: cy, frame: 0 });
      }
    }
  }

  // Walk-off-edge + gravity fall (carry momentum): held-input,
  // full-speed step-off. Lets the player land on platforms
  // displaced horizontally from the ledge.
  for (const dir of [-1, 1]) {
    for (const schedule of inputSchedules(dir)) {
      const res = simulateFall(px, py, dir * phys.runSpeed, grid, phys, { schedule });
      addResult(res);
    }
  }

  // Step-off-ledge fall (release momentum): if the adjacent tile
  // at (cx ± 1, cy) is passable air (not a floor, not solid, not
  // lethal, not an enemy), simulate gravity starting from the
  // adjacent tile's pose with varying initial horizontal velocity.
  // This covers the "release input at the edge" case that the
  // sustained-input fall can't produce.
  for (const dx of [-1, 1]) {
    const nx = cx + dx;
    if (nx < 0 || nx >= w) continue;
    if (floorFlags[cy][nx]) continue;  // adjacent is a floor → walk handles it
    if (grid.isBlocking(nx, cy)) continue;
    if (grid.isBlocksFloor && grid.isBlocksFloor(nx, cy)) continue;
    const { px: epx, py: epy } = floorTileToHitbox(nx, cy, phys);
    for (const vx0 of [0, dx * phys.runSpeed]) {
      for (const dir of [-1, 0, 1]) {
        const schedule = [{ untilFrame: 10000, dir }];
        const res = simulateFall(epx, epy, vx0, grid, phys, { schedule });
        addResult(res);
      }
    }
  }

  if (have('jump')) {
    for (const vx0 of [-phys.runSpeed, 0, phys.runSpeed]) {
      const primaryDir = Math.sign(vx0) || 1;
      for (const dir of [-1, primaryDir, 1]) {
        for (const schedule of inputSchedules(dir)) {
          const res = simulateJump(px, py, vx0, grid, phys, { schedule });
          addResult(res);
        }
      }
    }
  }

  if (have('double_jump')) {
    const djFrames = [3, 6, 10, 15, 20, 25, 30, 40, 55, 70, 85, 100];
    for (const dir of [-1, 1]) {
      for (const vx0 of [-phys.runSpeed, 0, phys.runSpeed]) {
        if (Math.sign(vx0) === -dir && vx0 !== 0) continue;
        for (const schedule of inputSchedules(dir)) {
          for (const djFrame of djFrames) {
            const res = simulateDoubleJump(px, py, vx0, djFrame, grid, phys, { schedule });
            addResult(res);
          }
        }
      }
    }
  }

  if (have('dash')) {
    for (const dir of [-1, 1]) {
      const res = simulateDash(px, py, dir, grid, phys);
      addResult(res);
    }
  }

  if (have('rocket')) {
    for (const dir of [-1, 0, 1]) {
      for (const schedule of inputSchedules(dir || 1)) {
        const res = simulateRocket(px, py, 0, grid, phys, { schedule });
        addResult(res);
      }
    }
  }

  // Combo: jump, then dash mid-arc.
  if (have('jump') && have('dash')) {
    const dashFrames = Math.round(phys.dashDuration * phys.frameRate);
    for (const dashDir of [-1, 1]) {
      for (const dashStart of [3, 8, 15, 25, 40, 60]) {
        for (const vx0 of [-phys.runSpeed, 0, phys.runSpeed]) {
          if (Math.sign(vx0) === -dashDir && vx0 !== 0) continue;
          const schedule = [{ untilFrame: 10000, dir: dashDir }];
          let dashAborted = false;
          const res = simulateTrajectory(
            px, py, vx0, -phys.jumpVelocity,
            grid, phys,
            {
              maxFrames: 360,
              schedule,
              onStep(next, frame, state) {
                // Dash is only active between dashStart and
                // dashStart+dashFrames, and ends on wall contact
                // (state.vx === 0 while dash was forcing it).
                const inWindow = frame >= dashStart && frame < dashStart + dashFrames;
                if (inWindow && !dashAborted) {
                  if (frame > dashStart && state.vx === 0) {
                    dashAborted = true;
                  } else {
                    next.vy = 0;
                    next.vx = dashDir * phys.dashSpeed;
                  }
                }
                return null;
              },
            },
          );
          addResult(res);
        }
      }
    }
  }

  return { landings: allLandings, sweptTiles: allSwept };
}

/**
 * Single-step probe from one floor tile: enumerate every landing
 * and hitbox-swept tile reachable by one movement primitive (walk,
 * jump, double-jump, dash, rocket, fall, jump+dash) without
 * passing through any intermediate floor tile.
 *
 * Returns { landings: [{x, y, frame}], sweptTiles: Set<"y,x"> }.
 * Suitable for interactive "explore from this tile" diagnostics —
 * it's the inner body of the BFS without the BFS.
 */
export function probeOneTilePhysics(cx, cy, effectiveGrid, floorFlags, abilitySet, config) {
  const phys = getPhysics(config);
  const h = effectiveGrid.length;
  const w = effectiveGrid[0].length;
  const grid = gridAccessor(effectiveGrid, floorFlags, config);
  if (cx < 0 || cy < 0 || cx >= w || cy >= h || !floorFlags[cy][cx]) {
    return { landings: [], sweptTiles: new Set() };
  }
  return probeFromTile(cx, cy, abilitySet, grid, phys, floorFlags, w, h);
}

/**
 * Physics-accurate BFS. Signature matches computeReachable() in
 * reachabilityAnalyzer.js for drop-in dispatch.
 */
export function computeReachablePhysics(startX, startY, effectiveGrid, floorFlags, abilitySet, config) {
  const phys = getPhysics(config);
  const h = effectiveGrid.length;
  const w = effectiveGrid[0].length;
  const reachable = new Set();
  const parents = new Map();
  const sweptByTile = new Map();  // used later by midair POI pass

  if (startX < 0 || startY < 0 || startX >= w || startY >= h) {
    return { reachable, parents, sweptByTile };
  }
  if (!floorFlags[startY][startX]) {
    return { reachable, parents, sweptByTile };
  }

  // Build the reach-table envelope (unused for now, but available
  // for pruning / diagnostics).
  buildReachTable(abilitySet, config, phys);

  const grid = gridAccessor(effectiveGrid, floorFlags, config);
  const startKey = key(startX, startY);
  reachable.add(startKey);
  const queue = [[startX, startY]];
  let head = 0;

  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    const { landings, sweptTiles } = probeFromTile(
      cx, cy, abilitySet, grid, phys, floorFlags, w, h,
    );
    sweptByTile.set(key(cx, cy), sweptTiles);
    for (const l of landings) {
      const k = key(l.x, l.y);
      if (reachable.has(k)) continue;
      reachable.add(k);
      parents.set(k, key(cx, cy));
      queue.push([l.x, l.y]);
    }
  }

  return { reachable, parents, sweptByTile };
}

/**
 * Midair POI pass. Any POI tile swept by a probe from a reachable
 * floor tile counts as reachable.
 *
 * If `sweptByTile` is provided (from computeReachablePhysics), we
 * reuse it. Otherwise we re-run probes for every reachable floor
 * tile — slower, but keeps the API consistent with the old model.
 */
export function addMidairPOIsPhysics(
  reachable, effectiveGrid, floorFlags, categoryGrid, abilitySet, config, sweptByTile = null,
) {
  const phys = getPhysics(config);
  const cats = config.categories;
  const h = effectiveGrid.length;
  const w = effectiveGrid[0].length;
  const augmented = new Set(reachable);

  // Enumerate POI tiles not already reachable and not floor tiles.
  const midairPOIs = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const name = categoryGrid[y][x];
      const cat = cats[name];
      if (!cat) continue;
      if (!(cat.is_region || cat.is_location)) continue;
      if (floorFlags[y][x]) continue;
      if (augmented.has(key(x, y))) continue;
      midairPOIs.push({ x, y });
    }
  }
  if (midairPOIs.length === 0) return augmented;

  // Ensure we have swept-tile sets for every reachable floor tile.
  let swept = sweptByTile;
  if (!swept) {
    swept = new Map();
    const grid = gridAccessor(effectiveGrid, floorFlags, config);
    for (const k of reachable) {
      const [fy, fx] = k.split(',').map(Number);
      if (!floorFlags[fy][fx]) continue;
      const { sweptTiles } = probeFromTile(
        fx, fy, abilitySet, grid, phys, floorFlags, w, h,
      );
      swept.set(k, sweptTiles);
    }
  }

  // Union all swept tiles; POIs inside the union are reachable.
  const allSwept = new Set();
  for (const s of swept.values()) {
    for (const t of s) allSwept.add(t);
  }
  for (const poi of midairPOIs) {
    if (allSwept.has(key(poi.x, poi.y))) {
      augmented.add(key(poi.x, poi.y));
    }
  }
  return augmented;
}
