// MEASURE ONLY: solve the captured L39 request at seam time T; dump the plan (perTick keys, equips, verbs) to <out>.json
import { readFileSync, writeFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const [file, seam, out] = process.argv.slice(2);
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { atSeamTime } = await import(R + 'scripts/procgen/replay-seedling-solve-request.mjs');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES, billedHitsOf } = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const line = JSON.parse(readFileSync(file, 'utf8').split('\n')[0]);
const cap = line.requests[0].request;
const req = restoreRequest(atSeamTime(cap, Number(seam)));
if (process.env.BUDGET) req.budgetWork = Number(process.env.BUDGET);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const a = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
const p = a.plan;
console.log('keys', Object.keys(a), 'plan keys', p && Object.keys(p));
console.log(JSON.stringify({ seam: Number(seam), ok: a.ok, ticks: p?.solution?.length, billed: p ? billedHitsOf(p) : null,
  verbs: p?.verbs ?? a.verbs, pass: a.pass, passes: (a.passes ?? []).map(({ ms, ...r }) => r) }));
if (!a.ok) console.log('REFUSAL', JSON.stringify({ message: String(a.message).slice(0, 900), obstacle: a.obstacle }));
if (out && a.ok) writeFileSync(out, JSON.stringify({ seam: Number(seam), solution: p.solution.map((k) => [...k]),
  equips: p.equips ?? null, equipsAt: p.equipsAt ? [...p.equipsAt] : null, verbs: p.verbs ?? null,
  expected: p.expected ?? null }));
