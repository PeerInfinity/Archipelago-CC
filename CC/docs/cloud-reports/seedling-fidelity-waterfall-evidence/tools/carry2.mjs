import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const M = R + 'frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const mk = (feather) => {
  const atlas = JSON.parse(readFileSync(R + 'frontend/modules/flashPanel/atlases/seedling-map.json'));
  const lv = atlas.levels.find((l) => l.level === 100); lv.entities = lv.entities.filter((e) => e.type !== 'jellyfish');
  const raw = JSON.parse(readFileSync(R + 'CC/docs/cloud-reports/seedling-fidelity-l100-evidence/step-219-boot.json', 'utf8')); raw.seam.items.hasFeather = feather;
  const run = createRunForStaging(solveStaging(stagingFromTape(parseTape(raw))), levelSourceFromAtlas(atlas));
  const tick = (k) => run.advance(new Set(k));
  for (const [gx, gy] of [[44, 92], [60, 44], [72, 44]]) for (let i = 0; i < 400; i++) {
    const dx = gx - run.state.x, dy = gy - run.state.y; const k = [];
    if (Math.abs(dx) > 0.5) k.push(dx > 0 ? 'right' : 'left'); if (Math.abs(dy) > 0.5) k.push(dy > 0 ? 'down' : 'up');
    if (!k.length && Math.abs(run.state.vx) < 0.05 && Math.abs(run.state.vy) < 0.05) break; tick(k);
  }
  return { run, tick };
};
console.log('feather keys | first-push tick x,y | +4px: ticks drift | +8px: ticks drift | +16px: ticks drift | v.y after 8 ticks');
for (const feather of [true, false]) for (const keys of [['right'], ['right', 'down'], ['right', 'up']]) {
  const { run, tick } = mk(feather);
  let first = null; const marks = {}; let vy8 = null; let n = 0;
  for (let t = 0; t < 300; t++) {
    tick(keys); const s = run.state; const on = s.hazard?.onWaterfall ?? (s.x >= 80 && s.x < 112 && s.y >= 32 && s.y < 128);
    if (first === null && on) first = { t, x: s.x, y: s.y };
    if (first) { n++; if (n === 8) vy8 = s.vy; for (const d of [4, 8, 16]) if (!marks[d] && s.x >= first.x + d) marks[d] = `${t - first.t}t ${(s.y - first.y).toFixed(1)}px`; }
    if (marks[16] || s.x >= 111) break;
  }
  console.log(`${feather ? 'F' : '-'} ${keys.join('+').padEnd(10)} | ${first ? `t${first.t} ${first.x.toFixed(2)},${first.y.toFixed(2)}` : 'never'} | ${marks[4] ?? '—'} | ${marks[8] ?? '—'} | ${marks[16] ?? '—'} | ${vy8?.toFixed(2)} | hazardKeys=${Object.keys(run.state.hazard ?? {}).join(',')}`);
}
