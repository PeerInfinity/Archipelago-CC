// scratch: one captured request in-process; print answer, wall, and the lean counts + why pinnable refused (probe)
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC';
const [file, idi] = process.argv.slice(2);
const [ID, I] = idi.split(':').map(Number);
const { restoreRequest } = await import(`${R}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${R}/frontend/modules/seedlingDemo/atlasSource.js`);
const { solveAnytime, ANYTIME_PASSES } = await import(`${R}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const SB = await import(`${R}/frontend/modules/seedlingDemo/solverBot.js`);
let captured = null;
for (const l of readFileSync(file, 'utf8').split('\n')) { if (!l) continue; const leg = JSON.parse(l); if (leg.id !== ID) continue; captured = leg.requests.find((r) => r.i === I); break; }
const req = restoreRequest(captured.request);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const why = new Map(); let walks = 0; let trunc = 0; let filled = 0;
SB.STRIKE_WALK_TRACE.sink = ({ run, armed, out }) => {
  walks += 1; if (out.walk.truncated) trunc += 1;
  if (out.walk.samples.some((s) => s.lean)) filled += 1;
  const k = `armed=${armed} arrows=${!!run.arrowForecast?.()} spits=${!!run.spitForecast?.()} gren=${!!run.grenadeForecast?.()} corr=${!!run.corridorBodyForecast?.()} chas=${!!run.chaserForecast?.()} shake=${run.shake} band=${run.cameraNow?.band !== null}`;
  why.set(k, (why.get(k) ?? 0) + 1);
};
const t0 = Date.now();
const a = solveAnytime({ ...tape, source, levelSource }, { passes });
console.log('ANSWER', a.ok, a.kind, a.work, Date.now() - t0, 'ms', JSON.stringify(SB.STRIKE_PREVIEW_LEAN_COUNTS), { walks, trunc, filled });
console.log([...why]);
