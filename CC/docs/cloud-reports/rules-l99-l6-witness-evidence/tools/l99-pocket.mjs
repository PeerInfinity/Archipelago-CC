#!/usr/bin/env node
// rules-l99-l6-witness: the L99 west pocket, measured on the model's player map (plannerObstacleAt, lock@80,96 shut).
// Flood-fills the player's reachable centres at 1 px from (40,88), a step off the L100 landing (32,96) and prints, for each lavarunner
// placement centre, the nearest reachable point and its distance (Bob.runRange = 80 is the wake radius), plus the
// pocket's x/y extent. Usage: node l99-pocket.mjs
import { join } from 'node:path';
const R = new URL('../../../../../', import.meta.url).pathname;
const { staging } = await import('./l99.mjs');
const { createRunForStaging } = await import(join(R, 'frontend/modules/seedlingDemo/tapeRunner.js'));
const { atlasLevelSource } = await import(join(R, 'frontend/modules/seedlingDemo/levelSource.js'));
const { solverPlanOpts } = await import(join(R, 'frontend/modules/seedlingDemo/solverBot.js'));
const { plannerObstacleAt } = await import(join(R, 'frontend/modules/seedlingDemo/botDriverV2.js'));
const st = await staging('west', 'sword');
const run = createRunForStaging(st, atlasLevelSource(), { scratchPersistence: true });
run.advance(new Set());
const opts = solverPlanOpts(run, new Set(), { nodeMargin: 0, triggerMargin: 0 });
const W = 240, H = 208;
const seen = new Uint8Array(W * H);
const q = [[40, 88]]; seen[88 * W + 40] = 1; // (40,88): the first open point of the landing (32,96) itself sits in the stairs exit
let n = 0;
while (q.length) {
    const [x, y] = q.pop(); n++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx]) continue;
        if (plannerObstacleAt(run.world, nx, ny, null, opts)) continue;
        seen[ny * W + nx] = 1; q.push([nx, ny]);
    }
}
const pts = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (seen[y * W + x]) pts.push([x, y]);
console.log(JSON.stringify({ reachableCentres: n, xMax: Math.max(...pts.map((p) => p[0])), xMin: Math.min(...pts.map((p) => p[0])),
    yMin: Math.min(...pts.map((p) => p[1])), yMax: Math.max(...pts.map((p) => p[1])), reachesLowerFloor: !!seen[136 * W + 160] }));
for (const [id, cx, cy] of [['lavarunner@160,32', 168, 40], ['lavarunner@176,64', 184, 72], ['lavarunner@192,64', 200, 72]]) {
    let best = null;
    for (const [x, y] of pts) { const d = Math.hypot(x - cx, y - cy); if (!best || d < best.d) best = { d, x, y }; }
    console.log(JSON.stringify({ runner: id, centre: [cx, cy], nearest: [best.x, best.y], distance: +best.d.toFixed(2), wakes: best.d <= 80 }));
}
