import { readFileSync } from 'node:fs';
const M = process.cwd() + '/frontend/modules/seedlingDemo/';
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { previewWalk } = await import(M + 'solverBot.js');
const { drive } = await import(M + 'botDriverV2.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const w = JSON.parse(readFileSync(M + 'fixtures/chaser-witness/smallgaps-l45-62-slide.json', 'utf8'));
const [bx, by, ax, ay, cx, cy] = process.argv.slice(2).map(Number);
const SRC = atlasLevelSource();
const mk = () => createRunForStaging({ ...stagingFromTape(parseTape(JSON.stringify(w.tape))), boot: { level: 45, x: bx, y: by } }, SRC);
const WPS = [{ x: ax, y: ay }, { x: cx, y: cy }];
const key = (h) => [...h].sort().join('+') || '-';
for (const on of [false, true]) withContactFidelity({ waypointSlide: on }, () => {
  const a = mk(); console.log('boot terrain', a.state.terrain, a.state.hazard?.onIce);
  const pv = previewWalk(a, WPS, 1);
  const ph = pv.samples.map((x) => key(x.held ?? new Set()));
  const b = mk(); const perTick = []; let err = null;
  try { WPS.forEach((wp, i) => drive(b, wp, perTick, { until: 'arrival', tolerance: 1, maxTicks: 400, what: 'eq', avoidVolumes: false, intermediate: i < WPS.length - 1 })); } catch (e) { err = e.message.slice(0, 200); }
  const dh = perTick.map(key);
  console.log(`slide=${on}: preview ${ph.length} t (truncated ${pv.truncated?.kind ?? 'no'}), drive ${dh.length} t ${err ?? ''}, equal ${JSON.stringify(ph) === JSON.stringify(dh)}, end (${b.state.x.toFixed(2)},${b.state.y.toFixed(2)}) v(${b.state.vx.toFixed(2)},${b.state.vy.toFixed(2)})`);
});
