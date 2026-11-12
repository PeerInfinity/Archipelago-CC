// rules-route-goals-witness: step the MODEL from leg 919's L65 arrival (L63, no flags) by a script, e.g.
//   node l63-model-steps.mjs <capture.jsonl> "w5,eq2,L4,w20,U1,w3,U1,w3"   (w wait, L/R/U/D move, P primary, eqN equip slot N)
// printing position, facing, fall, hits, lightpole@112,272 and darktrap@128,272 after each step (the stance search in the report).
import { readFileSync } from 'node:fs';
const R = (process.env.REPO || process.cwd()) + '/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { createRunForStaging } = await import(R + 'frontend/modules/seedlingDemo/tapeRunner.js');
let req; for (const line of readFileSync(process.argv[2], 'utf8').trim().split('\n')) { const o = JSON.parse(line); if (o.id === 919) { req = restoreRequest(o.requests[0].request); break; } }
const src = levelSourceFromAtlas(req.source.records);
const script = process.argv[3]; // e.g. "w5,eq2,L7,w10,U3,P,w80"
const run = createRunForStaging({ ...req.staging }, src, { scratchPersistence: true });
let t = 0;
const tick = (k) => { run.advance(new Set(k)); t++; };
const K = { L: ['left'], R: ['right'], U: ['up'], D: ['down'], P: ['primary'], UL: ['up', 'left'], UP: ['up', 'primary'], LP: ['left', 'primary'], w: [] };
for (const step of script.split(',')) {
  if (step.startsWith('eq')) { run.equipNow(Number(step.slice(2))); continue; }
  const m = step.match(/^([A-Za-z]+?)(\d*)$/); const k = K[m[1]]; const n = Number(m[2] || 1);
  for (let i = 0; i < n; i++) { tick(k); }
  console.log(step, 't' + t, run.level, run.state.x.toFixed(2), run.state.y.toFixed(2), 'dir', run.state.direction, 'fall', run.state.fall ? run.state.fall.phase : '-', 'hits', run.playerHits.length, 'pole7', run.lightPolesNow.find((p) => p.id.endsWith('112,272'))?.activate, 'dt4', JSON.stringify(run.entities('darkTraps').filter((d) => d.id.endsWith('128,272')).map((d) => [d.startDying, d.removed])));
}
