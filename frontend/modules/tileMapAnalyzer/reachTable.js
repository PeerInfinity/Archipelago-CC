// frontend/modules/tileMapAnalyzer/reachTable.js
//
// Builds per-ability-set reach tables by running the physics
// simulators on an empty grid across a parameter grid of trajectory
// inputs. The result is a set of (dx, dy) tile offsets that the
// player can land on (floorReach) and pass through (midairReach)
// starting from a floor tile.
//
// These tables are obstacle-independent — the real-grid arc check
// (in reachabilityAnalyzer.js) validates each candidate against the
// actual map. The table only defines the CANDIDATE set; the BFS
// still has to prove each candidate with a per-map trajectory sim.
//
// See NewDocs/plans/tile-map-analyzer-physics-model.md.

import {
  DEFAULT_PHYSICS,
  emptyAccessor,
  simulateJump,
  simulateDoubleJump,
  simulateDash,
  simulateRocket,
  simulateFall,
  simulateTrajectory,
  floorTileToHitbox,
  hitboxToFloorTile,
} from './physicsModel.js';

/**
 * A reach table is:
 *   {
 *     floor: Set<"dy,dx">  // relative tile offsets where player lands
 *     air:   Set<"dy,dx">  // tile offsets the hitbox passes through
 *     maxDx: number        // max |dx| in the table
 *     maxDyUp: number      // max −dy
 *     maxDyDown: number    // max +dy
 *   }
 */

function offsetKey(dx, dy) { return `${dy},${dx}`; }

/**
 * Post-process a trajectory to find every tile the player could
 * have LANDED on if that tile were a floor tile. Since the reach
 * table is obstacle-independent, we simulate on an empty grid and
 * treat every downward crossing of a tile boundary as a potential
 * landing.
 *
 * For each pair of adjacent path samples, find all tile boundaries
 * crossed going downward by the hitbox bottom. Interpolate the x
 * position at the crossing; every column the hitbox overlaps at
 * that moment is a landing candidate at tile row (boundary - 1).
 */
function extractLandingOffsets(path, phys) {
  const out = new Set();
  const { tile, hitboxW, hitboxH } = phys;
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const prevBot = prev.y + hitboxH;
    const currBot = curr.y + hitboxH;
    if (currBot <= prevBot) continue;  // ascending or flat
    const tyStart = Math.ceil(prevBot / tile);
    const tyEnd = Math.floor(currBot / tile);
    for (let tyB = tyStart; tyB <= tyEnd; tyB++) {
      if (tyB * tile <= prevBot || tyB * tile > currBot) continue;
      const frac = (tyB * tile - prevBot) / (currBot - prevBot);
      const xAt = prev.x + (curr.x - prev.x) * frac;
      const tx0 = Math.floor(xAt / tile);
      const tx1 = Math.floor((xAt + hitboxW - 1) / tile);
      for (let tx = tx0; tx <= tx1; tx++) {
        // Landing row is tyB - 1: the floor tile directly above
        // the solid tile at row tyB.
        out.add(offsetKey(tx, tyB - 1));
      }
    }
  }
  return out;
}

function recordResult(result, originTx, originTy, floorSet, airSet, phys) {
  // Air tiles: every tile the hitbox overlapped during the
  // trajectory, relative to origin.
  for (const key of result.sweptTiles) {
    const [ty, tx] = key.split(',').map(Number);
    airSet.add(offsetKey(tx - originTx, ty - originTy));
  }
  // Landing offsets: extracted from downward tile-boundary
  // crossings in the path.
  const landings = extractLandingOffsets(result.path, phys);
  for (const k of landings) {
    const [dy, dx] = k.split(',').map(Number);
    // Skip the origin itself (we already stand there).
    if (dx === 0 && dy === 0) continue;
    floorSet.add(offsetKey(dx - originTx, dy - originTy));
  }
  // Also keep the simulator's explicit landing if it produced one.
  if (result.landing) {
    const { tx, ty } = result.landing;
    floorSet.add(offsetKey(tx - originTx, ty - originTy));
  }
}

/**
 * Input schedules to explore. Each is a (duration → direction)
 * schedule. The grid is coarse on purpose: robotkitty's horizontal
 * accel is 640 px/s² and max speed 80 px/s, so reversing takes
 * 0.25 s or ~15 frames. A few representative schedules span the
 * reachable envelope.
 */
function* inputSchedules(dir) {
  // Constant direction.
  yield [{ untilFrame: 10000, dir }];
  // Start with direction, stop at frame F (lets player land short).
  for (const stopFrame of [10, 20, 30, 60, 120]) {
    yield [
      { untilFrame: stopFrame, dir },
      { untilFrame: 10000, dir: 0 },
    ];
  }
  // Reverse mid-flight (lets player overshoot and come back — not
  // usually useful for reaching new ground, but covers some cases).
  for (const switchFrame of [15, 30]) {
    yield [
      { untilFrame: switchFrame, dir },
      { untilFrame: 10000, dir: -dir },
    ];
  }
}

/**
 * Builds the reach table for walk.
 *
 * Walk is a single-tile adjacency edge. We emit the four-direction
 * cross (the BFS only needs horizontal, but a walk-off-the-edge
 * drop is distinct from walk and handled by the fall family).
 */
export function walkReach(_phys) {
  const floor = new Set();
  const air = new Set();
  floor.add(offsetKey(-1, 0));
  floor.add(offsetKey(1, 0));
  air.add(offsetKey(-1, 0));
  air.add(offsetKey(1, 0));
  return { floor, air, maxDx: 1, maxDyUp: 0, maxDyDown: 0 };
}

/**
 * Builds the reach table for a ballistic jump.
 */
export function jumpReach(phys = DEFAULT_PHYSICS) {
  const floor = new Set();
  const air = new Set();
  const grid = emptyAccessor();
  // Origin: stand on floor tile (0, 0) → ballistic from that pose.
  const { px, py } = floorTileToHitbox(0, 0, phys);

  for (const dir of [-1, 0, 1]) {
    for (const vx0 of [-phys.runSpeed, 0, phys.runSpeed]) {
      // Skip senseless combos: no input and no initial velocity
      // means no horizontal motion; record once.
      if (dir === 0 && vx0 === 0) {
        const res = simulateJump(px, py, 0, grid, phys, {
          schedule: [{ untilFrame: 10000, dir: 0 }],
        });
        recordResult(res, 0, 0, floor, air, phys);
        continue;
      }
      for (const schedule of inputSchedules(dir || Math.sign(vx0))) {
        const res = simulateJump(px, py, vx0, grid, phys, { schedule });
        recordResult(res, 0, 0, floor, air, phys);
      }
    }
  }

  return summarize(floor, air);
}

/**
 * Builds the reach table for a double-jump, which can reset vy
 * once during airtime. The dj-time is quantized to a grid.
 */
export function doubleJumpReach(phys = DEFAULT_PHYSICS) {
  const floor = new Set();
  const air = new Set();
  const grid = emptyAccessor();
  const { px, py } = floorTileToHitbox(0, 0, phys);
  // Baseline single jump is a subset — include it.
  mergeInto(jumpReach(phys), floor, air);

  // Grid of dj-times from early to late in the first jump + first
  // part of the fall.
  const djFrames = [3, 6, 10, 15, 20, 25, 30, 40, 55, 70, 85, 100];
  for (const dir of [-1, 1]) {
    for (const vx0 of [-phys.runSpeed, 0, phys.runSpeed]) {
      if (Math.sign(vx0) === -dir && vx0 !== 0) continue;  // don't reverse
      for (const schedule of inputSchedules(dir)) {
        for (const djFrame of djFrames) {
          const res = simulateDoubleJump(px, py, vx0, djFrame, grid, phys, { schedule });
          recordResult(res, 0, 0, floor, air, phys);
        }
      }
    }
  }

  return summarize(floor, air);
}

/**
 * Dash reach: horizontal ray at starting y. Dash duration = 1.0 s
 * at 400 px/s → 400 px = 25 tiles. Direction is left or right.
 */
export function dashReach(phys = DEFAULT_PHYSICS) {
  const floor = new Set();
  const air = new Set();
  const grid = emptyAccessor();
  const { px, py } = floorTileToHitbox(0, 0, phys);

  for (const dir of [-1, 1]) {
    const res = simulateDash(px, py, dir, grid, phys);
    recordResult(res, 0, 0, floor, air, phys);
  }
  // Dash always ends in the air (in empty grid), so no floor
  // entry comes from this simulator alone. We include the air
  // cells so collectables on the dash path are marked reachable.
  // Floor landing tiles from "dash then fall" are added via the
  // dash+fall combo; see composedReach.

  return summarize(floor, air);
}

/**
 * Rocket reach: triggered from a duck (vx0 = 0). During the 0.5 s
 * boost, vy = -400 is forced. After boost, gravity resumes.
 */
export function rocketReach(phys = DEFAULT_PHYSICS) {
  const floor = new Set();
  const air = new Set();
  const grid = emptyAccessor();
  const { px, py } = floorTileToHitbox(0, 0, phys);

  for (const dir of [-1, 0, 1]) {
    for (const schedule of inputSchedules(dir || 1)) {
      const res = simulateRocket(px, py, 0, grid, phys, { schedule });
      recordResult(res, 0, 0, floor, air, phys);
    }
  }
  return summarize(floor, air);
}

/**
 * Edge-fall from a floor tile. The player runs off and falls with
 * horizontal velocity carried over. We simulate with vx0 = ±runSpeed
 * AND with input held in the same or opposite direction during fall.
 *
 * Note: the origin is the floor tile the player RAN OFF of. The
 * simulator starts at the hitbox pose matching standing on (0, 0),
 * and gravity plus horizontal momentum carries them over the edge.
 * Because the empty grid has no ledge, the trajectory never finds a
 * landing — we harvest only the sweptTiles (air reach). Real-grid
 * arc validation finds concrete landings.
 */
export function fallReach(phys = DEFAULT_PHYSICS) {
  const floor = new Set();
  const air = new Set();
  const grid = emptyAccessor();
  const { px, py } = floorTileToHitbox(0, 0, phys);

  for (const dir of [-1, 1]) {
    for (const schedule of inputSchedules(dir)) {
      const res = simulateFall(px, py, dir * phys.runSpeed, grid, phys, { schedule });
      recordResult(res, 0, 0, floor, air, phys);
    }
  }
  return summarize(floor, air);
}

function mergeInto(table, floor, air) {
  for (const k of table.floor) floor.add(k);
  for (const k of table.air) air.add(k);
}

function summarize(floor, air) {
  let maxDx = 0, maxDyUp = 0, maxDyDown = 0;
  for (const k of floor) {
    const [dy, dx] = k.split(',').map(Number);
    if (Math.abs(dx) > maxDx) maxDx = Math.abs(dx);
    if (-dy > maxDyUp) maxDyUp = -dy;
    if (dy > maxDyDown) maxDyDown = dy;
  }
  for (const k of air) {
    const [dy, dx] = k.split(',').map(Number);
    if (Math.abs(dx) > maxDx) maxDx = Math.abs(dx);
    if (-dy > maxDyUp) maxDyUp = -dy;
    if (dy > maxDyDown) maxDyDown = dy;
  }
  return { floor, air, maxDx, maxDyUp, maxDyDown };
}

/**
 * Compose per-ability tables into a single reach table for the
 * owned ability set. This is the union of each ability's floor /
 * air reach PLUS a few cross-ability combinations that expand the
 * envelope beyond independent union.
 *
 * Cross-ability combinations worth modeling:
 *   - jump + dash: dash at any frame of a jump. Adds 25 horizontal
 *     tiles at various y levels.
 *   - jump + double_jump: already covered by doubleJumpReach.
 *   - rocket + dash: not valid (dash disabled during rocketTime).
 *   - rocket + double_jump: legal but rarely useful; skipped.
 *   - walk + fall: always available if the player owns walk.
 */
export function buildReachTable(abilitySet, config, phys = DEFAULT_PHYSICS) {
  const floor = new Set();
  const air = new Set();

  const have = (a) => abilitySet.has(a);
  // Walk is implicit for BFS adjacency.
  mergeInto(walkReach(phys), floor, air);
  // Fall is always available (gravity).
  mergeInto(fallReach(phys), floor, air);

  if (have('jump')) {
    mergeInto(jumpReach(phys), floor, air);
  }
  if (have('double_jump')) {
    mergeInto(doubleJumpReach(phys), floor, air);
  }
  if (have('dash')) {
    mergeInto(dashReach(phys), floor, air);
  }
  if (have('rocket')) {
    mergeInto(rocketReach(phys), floor, air);
  }

  // Combo: jump-then-dash. Only compute if player has both.
  if (have('jump') && have('dash')) {
    mergeInto(jumpThenDashReach(phys), floor, air);
  }
  // Combo: double-jump-then-dash, or dash-then-jump (airjump shared
  // so only one midair event).
  // TODO: enumerate these if diffs vs the existing model show gaps.

  return summarize(floor, air);
}

/**
 * Jump, then dash at frame F. The dash overrides vy and vx during
 * its duration, then gravity resumes.
 */
export function jumpThenDashReach(phys = DEFAULT_PHYSICS) {
  const floor = new Set();
  const air = new Set();
  const grid = emptyAccessor();
  const { px, py } = floorTileToHitbox(0, 0, phys);
  const dashFrames = Math.round(phys.dashDuration * phys.frameRate);

  for (const dashDir of [-1, 1]) {
    for (const dashStart of [3, 8, 15, 25, 40, 60]) {
      for (const vx0 of [-phys.runSpeed, 0, phys.runSpeed]) {
        if (Math.sign(vx0) === -dashDir && vx0 !== 0) continue;
        // Simulate: jump with input held dashDir until dashStart,
        // then override velocity for dash phase, then ballistic.
        const schedule = [{ untilFrame: 10000, dir: dashDir }];
        const res = simulateTrajectory(
          px, py, vx0, -phys.jumpVelocity,
          grid, phys,
          {
            maxFrames: 360,
            schedule,
            onStep(next, frame /*, prev */) {
              if (frame >= dashStart && frame < dashStart + dashFrames) {
                next.vy = 0;
                next.vx = dashDir * phys.dashSpeed;
              }
              return null;
            },
          },
        );
        recordResult(res, 0, 0, floor, air, phys);
      }
    }
  }
  return summarize(floor, air);
}
