// seedling-js-l107-investigate Q3: the solved plan's DODGE row(s) at a clock (which walk-offset / stall the PHASE arm took).
// Usage: node dodge-row.mjs <seam> [passes=dashless]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const R = new URL('../../../../', import.meta.url).pathname;
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const { atSeamTime } = await import(R + 'scripts/procgen/replay-seedling-solve-request.mjs');
const [seam, passArg = 'dashless'] = process.argv.slice(2);
const c = JSON.parse(gunzipSync(readFileSync(new URL('./d2/cap785.jsonl.gz', import.meta.url))).toString('utf8').trim().split('\n')[0]);
const { passes: _p, source, ...tape } = restoreRequest(atSeamTime(c.requests.find((r) => r.i === 1).request, Number(seam)));
const passes = ANYTIME_PASSES.filter((p) => passArg.split(',').includes(p.pass));
const a = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
const seen = new Set();
const walk = (o, path, depth) => {
  if (!o || typeof o !== 'object' || depth > 7 || seen.has(o)) return; seen.add(o);
  if (o.rung === 'dodge' || (o.stall && typeof o.stall === 'object' && 'ticks' in o.stall)) console.log(path, JSON.stringify(o).slice(0, 400));
  for (const [k, v] of Object.entries(o)) if (k !== 'perTick' && k !== 'samples') walk(v, `${path}.${k}`, depth + 1);
};
console.log('ok', a.ok, 'work', a.work, 'keys', Object.keys(a).join(','), 'plan', a.plan ? Object.keys(a.plan).join(',') : null);
walk(a, 'answer', 0);
// the plan's still runs (empty key sets): where the PHASE arm's stall sits in the solution
const sol = a.plan?.solution; const pt = Array.isArray(sol) ? sol : (sol?.perTick ?? sol?.ticks ?? null);
if (pt) {
  const runs = []; pt.forEach((h, i) => { const e = (h?.size ?? h?.length ?? 0) === 0; if (e) { if (runs.length && runs.at(-1)[1] === i - 1) runs.at(-1)[1] = i; else runs.push([i, i]); } });
  console.log('solution ticks', pt.length, 'still runs [from,to,len]', JSON.stringify(runs.map(([f, t]) => [f, t, t - f + 1])));
} else console.log('solution shape', typeof sol, sol && Object.keys(sol).slice(0, 20).join(','));
