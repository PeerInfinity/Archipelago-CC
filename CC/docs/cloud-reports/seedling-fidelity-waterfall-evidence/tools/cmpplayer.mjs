// game frames' player (x,y) vs the model replaying the same tape, at the first frame per tick
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const M = R + 'frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const atlas = JSON.parse(readFileSync(R + 'frontend/modules/flashPanel/atlases/seedling-map.json'));
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const frames = JSON.parse(readFileSync(process.argv[3], 'utf8')).frames;
const game = new Map(); for (const f of frames) if (!game.has(f.tick) && f.player) game.set(f.tick, f.player);
const run = createRunForStaging(solveStaging(stagingFromTape({ ...tape })), levelSourceFromAtlas(atlas));
const model = new Map([[0, { x: run.state.x, y: run.state.y }]]);
const held = (t) => new Set((tape.inputs ?? []).filter((i) => i.from <= t && t < i.to).map((i) => i.key));
for (let t = 0; t < tape.tick_count; t++) { run.advance(held(t)); model.set(t + 1, { x: run.state.x, y: run.state.y }); }
let n = 0, worst = 0, at = null, wf = 0, first = null;
for (const [t, g] of game) { const m = model.get(t); if (!m) continue; n++; const d = Math.max(Math.abs(g.x - m.x), Math.abs(g.y - m.y)); if (d > 0.001 && first === null) first = `t${t} game (${g.x.toFixed(2)},${g.y.toFixed(2)}) model (${m.x.toFixed(2)},${m.y.toFixed(2)})`; if (d > worst) { worst = d; at = t; } if (g.x >= 80 && g.x < 112 && g.y >= 32 && g.y < 128) wf++; }
console.log("first divergence:", first); console.log(`player (x,y) game vs model: ${n} ticks compared, worst |Δ| ${worst}${at !== null ? ' at t' + at : ''}; ${wf} of them with the player's centre over the waterfall (x 80-111, y 32-127)`);
