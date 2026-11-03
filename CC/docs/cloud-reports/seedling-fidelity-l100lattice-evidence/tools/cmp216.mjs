// L100LATTICE D2: the model replaying a walk tape against a p4g `--frames` capture (first frame per tick):
// worst |Δ| of the player (x,y), the game's `hits` steps vs the model's playerHits, and the level at the end.
// Usage: node cmp216.mjs <walk-tape.json> <frames.json>
import { readFileSync } from 'node:fs';
const REPO = new URL('../../../../../', import.meta.url).pathname;
const M = REPO + 'frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const tape = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const frames = JSON.parse(readFileSync(process.argv[3], 'utf8')).frames;
const run = createRunForStaging(solveStaging(stagingFromTape(parseTape({ ...tape, inputs: [], tick_count: 0 }))), atlasLevelSource());
const model = [[run.level, run.state.x, run.state.y]];
for (let t = 0; t < tape.tick_count; t += 1) {
    run.advance(new Set(tape.inputs.filter((i) => i.from <= t && t < i.to).map((i) => i.key)));
    model.push([run.level, run.state.x, run.state.y]);
}
const first = new Map();
for (const f of frames) if (!first.has(f.tick)) first.set(f.tick, f);
let worst = 0; let at = null; let n = 0; let lvl = 0;
const gameHits = [];
let prevHits = 0;
for (const [t, f] of [...first].sort((a, b) => a[0] - b[0])) {
    if (t > tape.tick_count) continue;
    const m = model[t];
    if (f.status.level !== m[0]) { lvl += 1; continue; }
    const d = Math.max(Math.abs(m[1] - f.player.x), Math.abs(m[2] - f.player.y));
    n += 1;
    if (d > worst) { worst = d; at = t; }
    if (f.status.hits > prevHits) gameHits.push({ t, hits: f.status.hits, x: f.player.x, y: f.player.y });
    prevHits = f.status.hits;
}
console.log(`ticks ${tape.tick_count}; compared ${n} tick(s) (first frame per tick); level mismatches ${lvl}; worst |Δ| player ${worst}${at === null ? '' : ` at t${at}`}`);
console.log('game hits steps', JSON.stringify(gameHits));
console.log('model playerHits', JSON.stringify(run.playerHits.map((h) => ({ t: h.t, id: h.id, hits: h.hits }))));
console.log('end: game level', [...first.values()].at(-1).status.level, 'tick', [...first.keys()].at(-1), '| model level', run.level);
