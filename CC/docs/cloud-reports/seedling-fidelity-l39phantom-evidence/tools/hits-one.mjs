// L39PHANTOM D2 (measure only): one captured request at one seam time; prints ok, ticks, billed hits.
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const [file, i, seam] = process.argv.slice(2);
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { atSeamTime } = await import(R + 'scripts/procgen/replay-seedling-solve-request.mjs');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES, billedHitsOf } = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const line = JSON.parse(readFileSync(file, 'utf8').split('\n')[0]);
const cap = line.requests.find((r) => String(r.i) === i).request;
const req = restoreRequest(atSeamTime(cap, Number(seam)));
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const a = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes });
console.log(JSON.stringify({ i: Number(i), seam: Number(seam), on: process.env.SEEDLING_SPINNER_ROSTER_GONE === '1', ok: a.ok,
    ticks: a.ok ? a.plan.solution.length : null, billed: a.ok ? billedHitsOf(a.plan) : null,
    forced: a.ok ? (a.plan.forcedHits ?? []).map((f) => f.what ?? f.tick) : null, pass: a.ok ? a.pass ?? a.plan.pass ?? null : null }));
