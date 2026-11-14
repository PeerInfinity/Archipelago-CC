// scratch: replay a plan on the model from leg <id> (boot re-staged, no flags); print a sample every N ticks + earned clears.
import { readFileSync } from 'node:fs';
const R = process.cwd() + '/'; const M = (p) => import(R + 'frontend/modules/seedlingDemo/' + p);
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await M('atlasSource.js'); const { replayTape } = await M('jsRuntimeSolver.js');
const [file, id, planF, bx, by, every] = process.argv.slice(2);
let req; for (const line of readFileSync(file, 'utf8').trim().split('\n')) { const o = JSON.parse(line); if (String(o.id) === id) { req = restoreRequest(o.requests[0].request); break; } }
const staging = { ...req.staging, persistence: [], ...(bx ? { boot: { ...req.staging.boot, x: Number(bx), y: Number(by) } } : {}) };
const plan = JSON.parse(readFileSync(planF, 'utf8'));
const N = Number(every ?? 50); const ls = levelSourceFromAtlas(req.source.records);
for (let t = N; t <= plan.keys.length + N - 1; t += N) {
  const n = Math.min(t, plan.keys.length);
  const r = replayTape({ staging, perTick: plan.keys.slice(0, n).map((k) => new Set(k)), levelSource: ls, scratchPersistence: true, equips: plan.equipsAt.length ? new Map(plan.equipsAt.filter(([i]) => i < n)) : null });
  console.log(n, r.level, r.state.x.toFixed(1), r.state.y.toFixed(1), 'hits', r.playerHits.length, 'earned', (r.earnedClears ?? []).map((c) => `${c.level}:${c.tag}@${c.t}`).join(' '));
}
