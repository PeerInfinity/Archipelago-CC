// frontend/modules/tileMapAnalyzer/physicsModel.test.js
//
// Sanity checks for the physics simulator. Run as a plain module in
// a browser console or via the test harness — this file uses console
// assertions to avoid pulling in a test runner. Expected values come
// from the reach analysis in
// NewDocs/plans/tile-map-analyzer-physics-model.md.

import {
  DEFAULT_PHYSICS,
  emptyAccessor,
  simulateJump,
  simulateDoubleJump,
  simulateDash,
  simulateRocket,
  floorTileToHitbox,
} from './physicsModel.js';
import {
  jumpReach,
  doubleJumpReach,
  dashReach,
  rocketReach,
} from './reachTable.js';

const phys = DEFAULT_PHYSICS;

function summarizeTable(name, table) {
  const tiles = Array.from(table.floor).map(k => k.split(',').map(Number));
  // eslint-disable-next-line no-console
  console.log(`[${name}] floor tiles: ${tiles.length}, maxDx=${table.maxDx}, maxUp=${table.maxDyUp}, maxDown=${table.maxDyDown}`);
}

export function runPhysicsSanityChecks() {
  const grid = emptyAccessor();

  // --- Single jump peak ---
  const { px, py } = floorTileToHitbox(0, 0, phys);
  const jumpRes = simulateJump(px, py, 0, grid, phys, {
    schedule: [{ untilFrame: 10000, dir: 0 }],
  });
  const minY = Math.min(...jumpRes.path.map(p => p.y));
  const peakPx = py - minY;
  // Expected peak: v0²/(2g) = 200²/(2·420) ≈ 47.6 px.
  console.assert(Math.abs(peakPx - 47.6) < 2,
    `jump peak: expected ~47.6 px, got ${peakPx.toFixed(2)}`);

  // --- Single jump horizontal reach at same level ---
  // Find the frame where the player returns to start y (crosses
  // it descending) and measure horizontal distance at that point.
  const jumpHRes = simulateJump(px, py, phys.runSpeed, grid, phys, {
    schedule: [{ untilFrame: 10000, dir: 1 }],
  });
  let horizPx = 0;
  for (let i = 1; i < jumpHRes.path.length; i++) {
    const prev = jumpHRes.path[i - 1];
    const curr = jumpHRes.path[i];
    if (prev.y < py && curr.y >= py) {
      const frac = (py - prev.y) / (curr.y - prev.y);
      horizPx = (prev.x + (curr.x - prev.x) * frac) - px;
      break;
    }
  }
  // Expected: 2·(v0/g)·runSpeed = 2·(200/420)·80 ≈ 76 px ≈ 4.76 tiles.
  console.assert(horizPx >= 70 && horizPx <= 90,
    `jump horiz at same level: expected ~76 px, got ${horizPx.toFixed(2)}`);

  // --- Double jump peak ---
  const djRes = simulateDoubleJump(px, py, 0, 30, grid, phys, {
    schedule: [{ untilFrame: 10000, dir: 0 }],
  });
  const djMinY = Math.min(...djRes.path.map(p => p.y));
  const djPeakPx = py - djMinY;
  // Expected: apex-reset gives 2·47.6 ≈ 95.2 px ≈ 5.95 tiles.
  console.assert(djPeakPx >= 85 && djPeakPx <= 100,
    `dj peak: expected ~95 px, got ${djPeakPx.toFixed(2)}`);

  // --- Dash distance at end of dash phase ---
  const dashRes = simulateDash(px, py, 1, grid, phys);
  const dashEndFrame = Math.round(phys.dashDuration * phys.frameRate);
  const dashEndSample = dashRes.path[dashEndFrame] || dashRes.path[dashRes.path.length - 1];
  const dashPx = dashEndSample.x - px;
  // Expected: 400 px/s × 1.0 s = 400 px = 25 tiles.
  console.assert(dashPx >= 380 && dashPx <= 420,
    `dash distance at end of boost: expected ~400 px, got ${dashPx.toFixed(2)}`);

  // --- Rocket apex ---
  const rocketRes = simulateRocket(px, py, 0, grid, phys, {
    schedule: [{ untilFrame: 10000, dir: 0 }],
  });
  const rocketMinY = Math.min(...rocketRes.path.map(p => p.y));
  const rocketPeakPx = py - rocketMinY;
  // Expected: 0.5 s boost gives 200 px, then coast with v=400
  // against gravity gives 400²/(2·420)=190.48 extra → ~390.5 px
  // ≈ 24.4 tiles.
  console.assert(rocketPeakPx >= 370 && rocketPeakPx <= 410,
    `rocket peak: expected ~390 px, got ${rocketPeakPx.toFixed(2)}`);

  // --- Reach tables ---
  summarizeTable('walk  ', { floor: new Set(['0,-1', '0,1']), air: new Set(), maxDx: 1, maxDyUp: 0, maxDyDown: 0 });
  summarizeTable('jump  ', jumpReach(phys));
  summarizeTable('dj    ', doubleJumpReach(phys));
  summarizeTable('dash  ', dashReach(phys));
  summarizeTable('rocket', rocketReach(phys));

  console.log('physicsModel sanity checks complete.');
}

// Auto-run if loaded as a script (e.g. pasted into browser console).
if (typeof window !== 'undefined' && window.__runPhysicsTests) {
  runPhysicsSanityChecks();
}
