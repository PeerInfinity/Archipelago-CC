// frontend/modules/tileMapAnalyzer/physicsModel.js
//
// Trajectory simulators for the robotkitty physics model. See
// NewDocs/plans/tile-map-analyzer-physics-model.md and
// NewDocs/reference/tile-map-analyzer-reachability.md.
//
// Physics constants come from xplor.Player (decompiled Player.as):
//   PLAYER_RUN_SPEED = 80  px/s   (maxVelocity.x)
//   GRAVITY          = 420 px/s²
//   JUMP_VELOCITY    = 200 px/s   (initial upward velocity on jump)
//   MAX_FALL         = 1200 px/s
//   ROCKET_BOOST     = -400 px/s (forced each frame for 0.5 s)
//   DASH_SPEED       = 400 px/s
//   DASH_DURATION    = 1.0 s
//   TILE             = 16 px
//   HITBOX           = 8 × 14 px
//   FRAME            = 1/60 s
//
// Each simulator takes a starting state and a control schedule, and
// returns { path, landing, status, sweptTiles } where
//   - path: array of { x, y, frame } per frame (hitbox top-left)
//   - landing: null or { tx, ty } of the floor tile the player
//     landed on
//   - status: "landed" | "blocked" | "timeout" | "airborne"
//   - sweptTiles: Set<"ty,tx"> of every tile the hitbox overlapped
//     during the trajectory (used for midair POI reachability)
//
// The grid accessor is passed in so the same simulator works for
// empty-grid table building and for real-grid arc validation.

export const DEFAULT_PHYSICS = Object.freeze({
  tile: 16,
  hitboxW: 8,
  hitboxH: 14,
  runSpeed: 80,
  gravity: 420,
  jumpVelocity: 200,
  maxFall: 1200,
  rocketBoost: -400,
  rocketDuration: 0.5,
  dashSpeed: 400,
  dashDuration: 1.0,
  frameRate: 60,
});

export function dt(phys) {
  return 1 / phys.frameRate;
}

/**
 * Grid accessor interface. Either pass a real grid+category test or
 * an "empty" accessor that treats every tile as non-blocking. The
 * simulator calls `isBlocking(tx, ty)` for every tile the hitbox
 * might overlap.
 *
 * For reach-table building, use `emptyAccessor()`.
 * For real-grid arc validation, wrap effectiveGrid + config.
 */
export function emptyAccessor() {
  return {
    isBlocking: () => false,
    isFloor: () => false,
    inBounds: () => true,
    width: Infinity,
    height: Infinity,
  };
}

export function gridAccessor(effectiveGrid, floorFlags, config) {
  const h = effectiveGrid.length;
  const w = effectiveGrid[0] ? effectiveGrid[0].length : 0;
  const cats = config.categories || {};
  return {
    isSolid(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) return true;
      const cat = cats[effectiveGrid[ty][tx]];
      return !!(cat && cat.solid);
    },
    isLethal(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) return false;
      const cat = cats[effectiveGrid[ty][tx]];
      return !!(cat && cat.lethal);
    },
    isBlocking(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) return true;
      const cat = cats[effectiveGrid[ty][tx]];
      if (!cat) return true;
      return !!cat.solid || !!cat.lethal;
    },
    // blocks_floor ("enemy") is handled separately: blocks standing,
    // but jump arcs may pass over it. The caller decides.
    isBlocksFloor(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) return false;
      const cat = cats[effectiveGrid[ty][tx]];
      return !!(cat && cat.blocks_floor);
    },
    isFloor(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) return false;
      return !!floorFlags[ty][tx];
    },
    inBounds(tx, ty) {
      return tx >= 0 && ty >= 0 && tx < w && ty < h;
    },
    width: w,
    height: h,
  };
}

/**
 * Return the tiles overlapped by a hitbox-AABB at pixel position
 * (px, py). Hitbox is (px, py) to (px + hitboxW, py + hitboxH).
 *
 * Yields each (tx, ty) such that the AABB strictly overlaps the
 * tile's pixel extent. Tiles touched only at an edge (zero-area
 * overlap) do not count.
 */
function* hitboxTiles(px, py, phys) {
  const { tile, hitboxW, hitboxH } = phys;
  const x0 = Math.floor(px / tile);
  const y0 = Math.floor(py / tile);
  const x1 = Math.floor((px + hitboxW - 1) / tile);
  const y1 = Math.floor((py + hitboxH - 1) / tile);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      yield [tx, ty];
    }
  }
}

function tileKey(tx, ty) { return `${ty},${tx}`; }

/**
 * Foot tile(s) immediately beneath the hitbox at (px, py). The
 * player is "standing" if a foot tile is a solid tile AND the
 * hitbox bottom row exactly meets that tile's top edge.
 */
function feetTouchingFloor(px, py, grid, phys) {
  const { tile, hitboxW, hitboxH } = phys;
  // Bottom of hitbox in pixels.
  const bottom = py + hitboxH;
  // Must align with a tile boundary (within 1 px tolerance).
  if (Math.abs(bottom - Math.round(bottom / tile) * tile) > 1) return null;
  const ty = Math.round(bottom / tile);  // tile row directly below
  if (!grid.inBounds(0, ty)) return null;
  const x0 = Math.floor(px / tile);
  const x1 = Math.floor((px + hitboxW - 1) / tile);
  const isSolid = grid.isSolid || grid.isBlocking;
  for (let tx = x0; tx <= x1; tx++) {
    // "Grounded" requires a pure solid tile underfoot — lethal
    // (acid) kills on contact, so the player is never standing on
    // it even if the feet are at the tile boundary.
    if (isSolid(tx, ty)) {
      return { tx, ty: ty - 1 };
    }
  }
  return null;
}

/**
 * Does the hitbox at (px, py) collide with any blocking tile?
 * blocks_floor is treated per `enemyBlocks` flag — for pure arcs,
 * the caller can ignore enemies; for edge-fall, enemies block.
 */
function hitboxBlocked(px, py, grid, phys, enemyBlocks) {
  for (const [tx, ty] of hitboxTiles(px, py, phys)) {
    if (grid.isBlocking(tx, ty)) return true;
    if (enemyBlocks && grid.isBlocksFloor && grid.isBlocksFloor(tx, ty)) return true;
  }
  return false;
}

/**
 * Collect tiles overlapped by the hitbox into `swept` (Set of keys).
 */
function sweepHitbox(px, py, swept, phys) {
  for (const [tx, ty] of hitboxTiles(px, py, phys)) {
    swept.add(tileKey(tx, ty));
  }
}

/**
 * Horizontal input model. Given a schedule (array of { untilFrame,
 * dir } segments), return the direction at a given frame.
 * dir ∈ {-1, 0, +1}.
 */
function inputAt(schedule, frame) {
  for (const seg of schedule) {
    if (frame < seg.untilFrame) return seg.dir;
  }
  return schedule.length ? schedule[schedule.length - 1].dir : 0;
}

/**
 * Update horizontal velocity toward the max run speed given current
 * input direction. Uses drag.x = runSpeed * 8 as the accel.
 */
function stepVx(vx, dir, phys) {
  const accel = phys.runSpeed * 8;
  const step = accel * dt(phys);
  if (dir > 0) {
    return Math.min(phys.runSpeed, vx + step);
  }
  if (dir < 0) {
    return Math.max(-phys.runSpeed, vx - step);
  }
  // No input: drag toward 0.
  if (vx > 0) return Math.max(0, vx - step);
  if (vx < 0) return Math.min(0, vx + step);
  return 0;
}

/**
 * Compute the next-frame velocities from `state`, accounting for
 * input (horizontal accel / drag) and gravity. When the player is
 * genuinely resting on solid ground (vy exactly zero and feet on a
 * solid tile), gravity is skipped. This is pure velocity math —
 * the position update happens separately so hooks can modify vx /
 * vy before it commits.
 */
function stepVelocities(state, dir, phys, grid) {
  const vx = stepVx(state.vx, dir, phys);
  const grounded = state.vy === 0 && !!feetTouchingFloor(state.x, state.y, grid, phys);
  const vy = grounded ? 0 : Math.min(phys.maxFall, state.vy + phys.gravity * dt(phys));
  return { vx, vy, grounded };
}

/**
 * If the hitbox bottom crosses a tile boundary going downward this
 * frame, and that boundary has a solid tile below, return a snap:
 *   { landedOn: { tx, ty }, snapX, snapY }
 * Returns null if no landing occurs.
 *
 * This replaces the naive "hitbox AABB overlaps solid = blocked"
 * check for descending motion, which would otherwise classify every
 * landing as a wall collision.
 */
/**
 * If the hitbox top crosses a tile boundary going upward into a
 * solid tile ("ceiling bonk"), return a clamp:
 *   { ceiling: { tx, ty }, snapY: <py aligned with ceiling's bottom> }
 * Caller should set next.y = snapY and next.vy = 0, then CONTINUE
 * the trajectory — this is not a termination. Flixel's collision
 * resolver does exactly this: hitting a ceiling while ascending
 * zeroes upward velocity; gravity then takes over and the player
 * falls.
 *
 * Without this handling, jumps that clip the side of an overhang
 * while drifting right/left are incorrectly classified as blocked,
 * whereas in-game they land on platforms reachable only after the
 * bonk-and-drift.
 */
function snapCeiling(prevState, nextState, grid, phys) {
  const prevTop = prevState.y;
  const nextTop = nextState.y;
  if (nextTop >= prevTop) return null;  // not ascending
  const isSolid = grid.isSolid || grid.isBlocking;
  const kMin = Math.ceil(nextTop / phys.tile);
  const kMax = Math.floor(prevTop / phys.tile);
  for (let k = kMin; k <= kMax; k++) {
    if (k * phys.tile > prevTop || k * phys.tile <= nextTop) continue;
    // Boundary at y = k*tile crossed going up. Entering tile k-1.
    const tyCeiling = k - 1;
    const denom = nextTop - prevTop;  // negative
    const frac = denom === 0 ? 0 : (k * phys.tile - prevTop) / denom;
    const xAt = prevState.x + (nextState.x - prevState.x) * frac;
    const tx0 = Math.floor(xAt / phys.tile);
    const tx1 = Math.floor((xAt + phys.hitboxW - 1) / phys.tile);
    for (let tx = tx0; tx <= tx1; tx++) {
      if (isSolid(tx, tyCeiling)) {
        return {
          ceiling: { tx, ty: tyCeiling },
          snapY: k * phys.tile,
        };
      }
    }
  }
  return null;
}

/**
 * If the next position overlaps a solid tile because of a pure
 * horizontal move (wall), snap x to the wall edge and zero vx.
 * The trajectory continues — the player is now pressed against
 * the wall with vy unchanged. Flixel calls hitLeft() / hitRight()
 * for this case; for jump arcs the effect is that the player
 * slides down (or up) the wall until they can move horizontally
 * again.
 *
 * Only fires when:
 *   - horizontal move alone would overlap (x-only blocked), AND
 *   - vertical move alone would NOT overlap (y-only clear).
 * Anything else (e.g. stuck into both a wall and a ceiling) is
 * left to the outer block check.
 */
function snapWall(prevState, nextState, grid, phys, enemyBlocks) {
  const dx = nextState.x - prevState.x;
  if (dx === 0) return null;
  const xOnlyOverlaps = hitboxBlocked(nextState.x, prevState.y, grid, phys, enemyBlocks);
  if (!xOnlyOverlaps) return null;
  const yOnlyOverlaps = hitboxBlocked(prevState.x, nextState.y, grid, phys, enemyBlocks);
  if (yOnlyOverlaps) return null;
  const { tile, hitboxW } = phys;
  if (dx > 0) {
    // Right-bound: hitbox right edge ran into a wall column. Snap
    // so the right edge sits flush against the wall's left face.
    const nextRight = nextState.x + hitboxW;
    const wallCol = Math.floor((nextRight - 1) / tile);
    return { snapX: wallCol * tile - hitboxW };
  }
  // Left-bound: hitbox left edge ran into a wall column. Snap so
  // the left edge sits flush against the wall's right face.
  const wallCol = Math.floor(nextState.x / tile);
  return { snapX: (wallCol + 1) * tile };
}

function snapLanding(prevState, nextState, grid, phys) {
  const prevBot = prevState.y + phys.hitboxH;
  const nextBot = nextState.y + phys.hitboxH;
  if (nextBot <= prevBot) return null;
  const tyStart = Math.ceil(prevBot / phys.tile);
  const tyEnd = Math.floor(nextBot / phys.tile);
  const isSolid = grid.isSolid || grid.isBlocking;
  for (let tyB = tyStart; tyB <= tyEnd; tyB++) {
    if (tyB * phys.tile < prevBot || tyB * phys.tile > nextBot) continue;
    const frac = nextBot === prevBot ? 0
      : (tyB * phys.tile - prevBot) / (nextBot - prevBot);
    const xAt = prevState.x + (nextState.x - prevState.x) * frac;
    const tx0 = Math.floor(xAt / phys.tile);
    const tx1 = Math.floor((xAt + phys.hitboxW - 1) / phys.tile);
    for (let tx = tx0; tx <= tx1; tx++) {
      // Landing requires a pure solid underfoot AND a valid floor
      // tile to stand in (i.e. the tile above the solid is a
      // registered floor). Lethal or enemy tiles under the feet
      // are NOT a landing — they kill the player on impact. Those
      // fall through to the wall-collision check below.
      if (isSolid(tx, tyB) && grid.isFloor && grid.isFloor(tx, tyB - 1)) {
        return {
          landedOn: { tx, ty: tyB - 1 },
          snapX: xAt,
          snapY: tyB * phys.tile - phys.hitboxH,
        };
      }
    }
  }
  return null;
}

/**
 * Run a trajectory, frame by frame, until one of:
 *   - landed (vy >= 0 and feet touch a floor tile)
 *   - blocked (hitbox overlaps a solid/lethal tile)
 *   - timeout (exceeded maxFrames)
 *
 * Returns { path, landing, status, sweptTiles }.
 *
 * `options`:
 *   - maxFrames: hard cap on simulation length
 *   - schedule:  horizontal input schedule
 *   - onStep:    optional callback (state, frame) -> "stop" | "continue"
 *                used by double-jump to inject v_y reset at dj_time,
 *                and by rocket to force v_y during boost phase.
 *   - enemyBlocks: if true, blocks_floor tiles block the arc.
 *                  Use for edge-fall / descent; false for jump arcs.
 */
export function simulateTrajectory(x0, y0, vx0, vy0, grid, phys, options = {}) {
  const {
    maxFrames = 600,
    schedule = [],
    onStep = null,
    // Enemies (blocks_floor tiles) kill the player on contact in
    // robotkitty, so by default treat them as blockers for any
    // trajectory. Callers can opt out if they're modeling a
    // one-shot arc where touching the enemy is intentional (not
    // currently used, but preserved for flexibility).
    enemyBlocks = true,
    allowInitialOverlap = true,
  } = options;

  const path = [];
  const sweptTiles = new Set();
  let state = { x: x0, y: y0, vx: vx0, vy: vy0 };
  // Whether the player has been airborne at any point during the
  // trajectory. A "settled" landing only counts if the player
  // actually left the ground — otherwise walking along the source
  // floor and stopping would falsely register every intermediate
  // tile as a direct-reach neighbor.
  let wasAirborne = false;

  // Record starting position.
  path.push({ x: state.x, y: state.y, frame: 0 });
  sweepHitbox(state.x, state.y, sweptTiles, phys);

  for (let frame = 1; frame <= maxFrames; frame++) {
    const dir = inputAt(schedule, frame);

    // Compute velocities first. The hook may override them
    // (rocket boost, dash force, double-jump reset) BEFORE the
    // position update so the new vx / vy actually govern where
    // the player ends up this frame. Previously the hook ran
    // after position commit, letting gravity drift y downward
    // during a vy=0-forcing dash.
    let { vx, vy, grounded } = stepVelocities(state, dir, phys, grid);
    if (!grounded) wasAirborne = true;
    const proposal = { vx, vy, x: state.x, y: state.y };

    if (onStep) {
      const hookResult = onStep(proposal, frame, state);
      if (hookResult && hookResult.override) {
        if ('vx' in hookResult.override) proposal.vx = hookResult.override.vx;
        if ('vy' in hookResult.override) proposal.vy = hookResult.override.vy;
      }
      if (hookResult && hookResult.stop) break;
    }

    let next = {
      x: state.x + proposal.vx * dt(phys),
      y: state.y + proposal.vy * dt(phys),
      vx: proposal.vx,
      vy: proposal.vy,
    };

    // Ceiling bonk: hitbox top rose into a solid tile. Clamp y
    // so the head sits just below the ceiling and zero vy. The
    // trajectory continues — gravity takes over from here.
    const ceiling = snapCeiling(state, next, grid, phys);
    if (ceiling) {
      next = { ...next, y: ceiling.snapY, vy: 0 };
    }

    // Wall bonk: hitbox side ran into a solid tile via horizontal
    // motion. Clamp x so the edge sits against the wall and zero
    // vx. Trajectory continues with gravity/input still active.
    const wall = snapWall(state, next, grid, phys, enemyBlocks);
    if (wall) {
      next = { ...next, x: wall.snapX, vx: 0 };
    }

    // Landing: crossing a tile boundary going downward into a
    // solid tile. This is the normal "feet hit ground" case.
    const landing = snapLanding(state, next, grid, phys);
    if (landing) {
      state = { x: landing.snapX, y: landing.snapY, vx: next.vx, vy: 0 };
      sweepHitbox(state.x, state.y, sweptTiles, phys);
      path.push({ x: state.x, y: state.y, frame });
      return {
        path,
        landing: landing.landedOn,
        status: 'landed',
        sweptTiles,
        finalState: state,
        stoppedFrame: frame,
      };
    }

    // Wall collision: hitbox at next position overlaps a blocker
    // that is NOT a landing (i.e. not a downward-crossing solid).
    // This covers horizontal walls, ceilings hit by upward motion,
    // and lethal tiles.
    if (!allowInitialOverlap || frame > 1) {
      if (hitboxBlocked(next.x, next.y, grid, phys, enemyBlocks)) {
        return {
          path,
          landing: null,
          status: 'blocked',
          sweptTiles,
          finalState: state,
          stoppedFrame: frame,
        };
      }
    }

    state = next;
    sweepHitbox(state.x, state.y, sweptTiles, phys);
    path.push({ x: state.x, y: state.y, frame });

    // Terminate early if the player has settled (vx=0, vy=0, on a
    // solid floor, not moving) AFTER having been airborne. Walk-
    // off-ledge → fall → land cases need this because snapLanding
    // only fires on the descent's boundary crossing; dash-into-
    // wall-then-fall cases need this too.
    if (state.vx === 0 && state.vy === 0 && wasAirborne) {
      const settled = feetTouchingFloor(state.x, state.y, grid, phys);
      if (settled && inputAt(schedule, frame + 1) === 0) {
        return {
          path,
          landing: settled,
          status: 'settled',
          sweptTiles,
          finalState: state,
          stoppedFrame: frame,
        };
      }
    }
  }

  // At timeout, if the player was airborne at some point and is
  // now resting on a solid floor, report that as the landing.
  const restFloor = (wasAirborne && state.vy === 0)
    ? feetTouchingFloor(state.x, state.y, grid, phys)
    : null;
  return {
    path,
    landing: restFloor,
    status: 'timeout',
    sweptTiles,
    finalState: state,
    stoppedFrame: maxFrames,
  };
}

/**
 * Jump from (px0, py0) with horizontal-input schedule. Initial
 * velocity is (vx0, -jumpVelocity).
 */
export function simulateJump(px0, py0, vx0, grid, phys, options = {}) {
  return simulateTrajectory(
    px0, py0, vx0, -phys.jumpVelocity,
    grid, phys,
    { maxFrames: 240, ...options },
  );
}

/**
 * Double-jump: same as jump, but resets vy to -jumpVelocity at
 * `djFrame`.
 */
export function simulateDoubleJump(px0, py0, vx0, djFrame, grid, phys, options = {}) {
  const innerOnStep = options.onStep || null;
  return simulateTrajectory(
    px0, py0, vx0, -phys.jumpVelocity,
    grid, phys,
    {
      maxFrames: 300,
      ...options,
      onStep(next, frame, prev) {
        if (frame === djFrame) {
          next.vy = -phys.jumpVelocity;
        }
        return innerOnStep ? innerOnStep(next, frame, prev) : null;
      },
    },
  );
}

/**
 * Dash: horizontal ray with vy forced to 0 for dashDuration frames.
 * After dash ends, gravity resumes. Dash cancels on wall collision.
 * `direction` is +1 or -1.
 */
export function simulateDash(px0, py0, direction, grid, phys, options = {}) {
  const dashFrames = Math.round(phys.dashDuration * phys.frameRate);
  const dashVx = direction * phys.dashSpeed;
  const innerOnStep = options.onStep || null;
  // Dash is aborted by wall contact (Player.as: hitWall zeroes
  // dashTime). We detect the wall as "state.vx was snapped to 0 by
  // the previous frame's snapWall" — since the dash hook otherwise
  // keeps forcing vx to dashVx, any zero vx after frame 1 means
  // the collision resolver intervened. Gravity then takes over
  // and the rest of the trajectory is ballistic.
  let dashAborted = false;
  return simulateTrajectory(
    px0, py0, dashVx, 0,
    grid, phys,
    {
      maxFrames: 240,
      ...options,
      onStep(next, frame, state) {
        if (!dashAborted && frame > 1 && state.vx === 0) dashAborted = true;
        if (!dashAborted && frame > dashFrames) dashAborted = true;
        if (!dashAborted) {
          next.vy = 0;
          next.vx = dashVx;
        }
        return innerOnStep ? innerOnStep(next, frame, state) : null;
      },
    },
  );
}

/**
 * Rocket: vy clamped to -400 for the first rocketDuration seconds,
 * then ballistic.
 */
export function simulateRocket(px0, py0, vx0, grid, phys, options = {}) {
  const boostFrames = Math.round(phys.rocketDuration * phys.frameRate);
  const boost = phys.rocketBoost;
  const innerOnStep = options.onStep || null;
  return simulateTrajectory(
    px0, py0, vx0, boost,
    grid, phys,
    {
      maxFrames: 300,
      ...options,
      onStep(next, frame, prev) {
        if (frame <= boostFrames) {
          next.vy = boost;
        }
        return innerOnStep ? innerOnStep(next, frame, prev) : null;
      },
    },
  );
}

/**
 * Walk-off-edge fall. Start with vx0 = ±runSpeed (player was
 * running) and vy0 = 0. Gravity takes over.
 *
 * For floor-to-floor reach, the direction sign determines which way
 * the player steps off.
 */
export function simulateFall(px0, py0, vx0, grid, phys, options = {}) {
  return simulateTrajectory(
    px0, py0, vx0, 0,
    grid, phys,
    { maxFrames: 300, enemyBlocks: true, ...options },
  );
}

/**
 * Convert tile coordinates to the pixel position the hitbox
 * occupies when the player stands on floor tile (tx, ty). The
 * player's feet rest on the top edge of tile (tx, ty+1) = the
 * solid tile beneath the floor tile.
 *
 * Centering: hitbox x = tx*16 + (16 - hitboxW)/2.
 */
export function floorTileToHitbox(tx, ty, phys) {
  const px = tx * phys.tile + (phys.tile - phys.hitboxW) / 2;
  const py = (ty + 1) * phys.tile - phys.hitboxH;
  return { px, py };
}

/**
 * Inverse: given a hitbox pixel position that represents a
 * standing pose, return the tile (tx, ty) the player is standing
 * on. Returns null if the pose isn't a valid floor stand.
 */
export function hitboxToFloorTile(px, py, phys) {
  const bottom = py + phys.hitboxH;
  const ty1 = Math.round(bottom / phys.tile);  // tile below feet
  if (Math.abs(bottom - ty1 * phys.tile) > 1) return null;
  const tx = Math.round((px - (phys.tile - phys.hitboxW) / 2) / phys.tile);
  return { tx, ty: ty1 - 1 };
}
