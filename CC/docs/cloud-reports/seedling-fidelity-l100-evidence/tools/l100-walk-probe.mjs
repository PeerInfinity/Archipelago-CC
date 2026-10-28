// naive walk: drive toward waypoints, then swing right at the rock; log jellies + hits
import { readFileSync, writeFileSync } from 'node:fs';
const M = '../../../../../frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const atlas = JSON.parse(readFileSync(new URL('../../../../../frontend/modules/flashPanel/atlases/seedling-map.json', import.meta.url)));
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const wps = JSON.parse(process.argv[3] ?? '[[44,92],[60,44],[124,44],[124,140]]');
const staging = solveStaging(stagingFromTape(tape));
const run = createRunForStaging(staging, levelSourceFromAtlas(atlas));
const perTick = [];
let wi = 0; let swung = 0;
for (let t = 0; t < 600; t++) {
  const k = new Set();
  if (wi < wps.length) {
    const [gx, gy] = wps[wi]; const dx = gx - run.state.x, dy = gy - run.state.y;
    if (Math.abs(dx) > 1) k.add(dx > 0 ? 'right' : 'left');
    if (Math.abs(dy) > 1) k.add(dy > 0 ? 'down' : 'up');
    if (k.size === 0 && run.state.vx === 0 && run.state.vy === 0) wi++;
  } else if (swung < 40) {
    if (swung === 0) k.add('right'); else if (swung % 20 === 2) k.add('primary');
    swung++;
  }
  perTick.push(k);
  run.advance(k);
  const rocks = (run.entities('brokenRocks') ?? new Set());
  if (t % 10 === 0 || run.playerHits.length) {
    const j = (run.entities('chasers') ?? []).filter(c => c.tag === 'jellyfish').map(c => `${c.id.split('@')[1]}:(${c.x.toFixed(1)},${c.y.toFixed(1)})`).join(' ');
    console.log(`t${t} p(${run.state.x.toFixed(1)},${run.state.y.toFixed(1)}) hits=${run.playerHits.length} wi=${wi} rocks=${[...rocks].join(',')} ${j}`);
  }
  if (run.playerHits.length) { console.log('HIT', JSON.stringify(run.playerHits[0]).slice(0,300)); break; }
  if (swung >= 40) break;
}
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(perTick.map((s) => [...s])));
