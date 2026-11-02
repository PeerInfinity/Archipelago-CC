// MEASUREMENT ONLY (adapted from AXIS's axis-replay.mjs): replay ONE captured solve request (a sweep capture jsonl
// row by --id/--i, or a cut fixture .json.gz) in this process, the way the worker does (`solveAnytime`), and print one
// JSON line: the answer, its ticks / refusal, and (with `--import ./slot-register.mjs`) the census summary; the census
// rows go to $SLOT_OUT. Switches are set by the environment (slot-batch's --env). Usage: node [--import ./slot-register.mjs] slot-replay.mjs
//   --root=<tree> (--fixture=<gz> | --requests=<jsonl> --id=N [--i=K]) [--d=<seam offset>] [--passes=N] [--on]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? process.env.SLOT_ROOT ?? '/home/user/Archipelago-CC';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(ROOT + '/frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(ROOT + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const PK = await import(ROOT + '/frontend/modules/seedlingDemo/pressKillCost.js');
let row;
if (args.fixture) row = JSON.parse(gunzipSync(readFileSync(args.fixture)).toString('utf8'));
else row = readFileSync(args.requests, 'utf8').trim().split('\n').map(JSON.parse).find((r) => String(r.id) === String(args.id));
const c = row.requests.find((q) => String(q.i) === String(args.i ?? 0)) ?? row.requests[0];
const captured = args.d ? { ...c.request, staging: { ...c.request.staging, seam: { ...c.request.staging.seam,
    time: c.request.staging.seam.time + Number(args.d) } } } : c.request;
const req = restoreRequest(captured);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const t0 = Date.now();
const answer = solveAnytime({ ...tape, source, levelSource }, { passes: args.passes ? passes.slice(0, Number(args.passes)) : passes });
const S = globalThis.__slotStats;
const out = { id: row.id ?? null, key: row.key ?? null, i: c.i ?? 0, d: Number(args.d ?? 0), seam: captured.staging?.seam?.time,
    on: 'on' in args, ok: answer.ok, kind: answer.kind ?? null, work: answer.work ?? null, ms: Date.now() - t0,
    ticks: answer.ok ? answer.plan.solution.length : null,
    message: answer.ok ? null : String(answer.message ?? '').slice(0, 600),
    plan: answer.ok ? (await import('node:crypto')).createHash('sha1').update(JSON.stringify(answer.plan.solution.map((k) => [...k]))).digest('hex').slice(0, 12) : null,
    census: S ? { policies: S.policies, presses: S.presses, driven: S.driven, preview: S.preview, byWeapon: S.byWeapon,
        nonBlade: S.rows.length, nonBladeDriven: S.rows.filter((r) => r.driven).length } : null };
console.log(JSON.stringify(out));
