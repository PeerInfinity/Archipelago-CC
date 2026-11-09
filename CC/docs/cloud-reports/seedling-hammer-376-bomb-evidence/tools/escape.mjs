// scratch: from rest, the displacement after k ticks of one held direction (the run's own preview stepper)
import { readFileSync } from 'node:fs'; import { gunzipSync } from 'node:zlib';
const R = '/home/user/Archipelago-CC';
const { restoreRequest } = await import(R + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { atlasLevelSource } = await import(R + '/frontend/modules/seedlingDemo/levelSource.js');
const { createRunForStaging } = await import(R + '/frontend/modules/seedlingDemo/tapeRunner.js');
const w = JSON.parse(gunzipSync(readFileSync(process.env.SCRATCH + '/leg376-play.json.gz')).toString());
const req = restoreRequest(w.request);
const run = createRunForStaging(req.staging, atlasLevelSource(), {});
for (const k of req.perTick) run.advance(k);
for (let i = 0; i < 30 && (run.state.vx || run.state.vy); i++) run.advance(new Set());
for (const dir of [['left'], ['up'], ['up', 'left']]) {
  const step = run.previewStepper(); let st = { ...run.state }; const s0 = { ...st }; const out = [];
  for (let k = 1; k <= 20; k++) { st = step(st, new Set(dir)); out.push(Math.hypot(st.x - s0.x, st.y - s0.y).toFixed(1)); }
  console.log(dir.join('+'), 'from', s0.x.toFixed(1), s0.y.toFixed(1), out.join(' '));
}
