// scratch (ICEST, from CPAIR's tools/full.mjs): replay ONE captured request (optionally at seam time captured+d) in this process; print the FULL answer,
// the main run's kill records and CHOOSER_PAIR_COUNTS. Usage: node full.mjs --root=<tree> --requests=<jsonl> --id=N --i=K [--d=offset] [--json=out]
import { readFileSync, writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? '/home/user/Archipelago-CC';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { atSeamTime } = await import(ROOT + '/scripts/procgen/replay-seedling-solve-request.mjs');
const { levelSourceFromAtlas } = await import(ROOT + '/frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(ROOT + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const SB = await import(ROOT + '/frontend/modules/seedlingDemo/solverBot.js');
const row = readFileSync(args.requests, 'utf8').trim().split('\n').map(JSON.parse).find((r) => String(r.id) === String(args.id));
const c = row.requests.find((q) => String(q.i) === String(args.i ?? 0));
const captured = args.d ? atSeamTime(c.request, c.request.staging.seam.time + Number(args.d)) : c.request;
const req = restoreRequest(captured);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const t0 = Date.now();
const answer = solveAnytime({ ...tape, source, levelSource }, { passes: args.passes ? passes.slice(0, Number(args.passes)) : passes });
const out = { id: row.id, i: args.i, d: args.d ?? 0, seam: captured.staging?.seam?.time, ok: answer.ok, kind: answer.kind ?? null, ms: Date.now() - t0,
    message: answer.ok ? null : String(answer.message ?? ''), ticks: answer.ok ? answer.plan.solution.length : null,
    pair: SB.CHOOSER_PAIR_COUNTS ?? null, icest: SB.ICETURRET_STATIC_KILL_COUNTS ?? null };
console.log(JSON.stringify(out, null, 1));
if (args.json) writeFileSync(args.json, JSON.stringify(out));
