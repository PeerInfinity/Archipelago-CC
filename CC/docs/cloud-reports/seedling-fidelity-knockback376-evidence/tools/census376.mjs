// scratch: leg 376 captured request at a seam: solve, then replay the plan in a fresh run → ok, pass, ticks, hits
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC';
const { restoreRequest } = await import(R + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { atSeamTime } = await import(R + '/scripts/procgen/replay-seedling-solve-request.mjs');
const { levelSourceFromAtlas } = await import(R + '/frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(R + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const { createRunForStaging } = await import(R + '/frontend/modules/seedlingDemo/tapeRunner.js');
const [capFile, seam] = process.argv.slice(2);
const line = readFileSync(capFile, 'utf8').split('\n').filter(Boolean).map(JSON.parse).find((r) => r.id === 376);
const req = restoreRequest(atSeamTime(line.requests[0].request, Number(seam)));
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const a = solveAnytime({ ...tape, source, levelSource }, { passes });
const out = { seam: Number(seam), on: process.env.SEEDLING_ROCK_GONE_FENCEPOST === '1', ok: a.ok, work: a.work, passes: (a.passes ?? []).map((p) => `${p.pass}:${p.ok}:${p.work}`).join(',') };
if (a.ok) {
  const run = createRunForStaging(tape.staging, levelSource, {});
  for (const k of a.plan.solution) run.advance(k);
  out.ticks = a.plan.solution.length; out.pass = a.plan.pass;
  out.hits = run.playerHits.map((h) => `${h.t}:${h.source}:${h.id}`);
  out.rocks = run.rocksBroken.map((r) => `${r.id}:${r.hitTick}/${r.goneAt}`);
} else out.msg = String(a.message ?? '').slice(0, 160);
console.log('ROW ' + JSON.stringify(out));
