// scratch: solve one captured leg in node (dashless + full like the page), print the answer + refusal details.
import { readFileSync, writeFileSync } from 'node:fs';
const R = process.cwd() + '/';
const M = (p) => import(R + 'frontend/modules/seedlingDemo/' + p);
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const { settleSolve, solveFromTape } = await M('jsRuntimeSolver.js');
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? null;
let req; for (const line of readFileSync(arg('req'), 'utf8').trim().split('\n')) { const o = JSON.parse(line); if (String(o.id) === arg('leg')) { req = restoreRequest(o.requests[0].request); break; } }
const { passes, source, budgetWork, upgradeWindowWork, ...tape } = req;
if (arg('boot')) { const [x, y] = arg('boot').split(',').map(Number); tape.staging = { ...tape.staging, boot: { ...tape.staging.boot, x, y }, persistence: [] };
  const { replayTape, liveOf } = await M('jsRuntimeSolver.js'); tape.live = liveOf(replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: levelSourceFromAtlas(source.records), scratchPersistence: tape.scratchPersistence, equips: tape.equips })); }
const levelSource = levelSourceFromAtlas(source.records);
for (const dashMode of (arg('dash') ?? 'none').split(',')) {
  let work = 0; const t0 = Date.now(); const cap = Number(arg('cap') ?? 0);
  const a = settleSolve(() => solveFromTape({ ...tape, levelSource, dashMode, adds: null, fineCheckpoints: true, shouldStop: () => (++work, cap > 0 && work > cap) }));
  const recs = a.plan?.records ?? a.records ?? a.trace?.records;
  console.log('SOLVE', dashMode, JSON.stringify({ ok: a.ok, work, ms: Date.now() - t0, ticks: a.plan?.solution?.length ?? null, msg: a.ok ? null : String(a.message).slice(0, 1500) }));
  if (arg('keys')) console.log('KEYS', Object.keys(a), a.plan ? Object.keys(a.plan) : '');
  if (a.ok && arg('out')) writeFileSync(arg('out') + '.' + dashMode + '.json', JSON.stringify({ keys: a.plan.solution.map((k) => [...k]), equipsAt: [...(a.plan.equipsAt ?? [])], records: a.plan.records ?? null }));
}
