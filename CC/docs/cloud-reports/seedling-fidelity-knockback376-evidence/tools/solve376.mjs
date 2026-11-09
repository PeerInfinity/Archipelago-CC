// scratch: solve leg 376's captured request at a staged seam time, save the answer
import { readFileSync, writeFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC';
const { restoreRequest } = await import(R + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { atSeamTime } = await import(R + '/scripts/procgen/replay-seedling-solve-request.mjs');
const { levelSourceFromAtlas } = await import(R + '/frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(R + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const [capFile, seam, out] = process.argv.slice(2);
const line = readFileSync(capFile, 'utf8').split('\n').filter(Boolean).map(JSON.parse).find((r) => r.id === 376);
const req = restoreRequest(atSeamTime(line.requests[0].request, Number(seam)));
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const a = solveAnytime({ ...tape, source, levelSource }, { passes });
console.log('ok', a.ok, 'work', a.work, 'planKeys', a.plan && Object.keys(a.plan));
if (a.plan) {
  const p = a.plan;
  for (const k of Object.keys(p)) { const v = p[k]; console.log(' ', k, Array.isArray(v) ? `array(${v.length})` : (v instanceof Map ? `Map(${v.size})` : typeof v === 'object' ? JSON.stringify(v)?.slice(0, 300) : v)); }
  writeFileSync(out, JSON.stringify({ seam: Number(seam), solution: p.solution.map((k) => [...k]), equips: p.equips ? [...(p.equips instanceof Map ? p.equips : Object.entries(p.equips))] : null, hits: p.hits ?? null, plan: Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'solution').map(([k, v]) => [k, v instanceof Map ? [...v] : v instanceof Set ? [...v] : v])) }, null, 0));
}
console.log('staging keys', Object.keys(tape.staging ?? {}), Object.keys(tape));
