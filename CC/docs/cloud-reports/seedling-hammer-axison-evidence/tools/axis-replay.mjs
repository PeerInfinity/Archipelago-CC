// MEASUREMENT ONLY (AXISON copy of AXIS-L12HITS's tool, + the model's hits re-driven with `replayTape`): replay ONE captured solve request (a sweep capture jsonl row by --id/--i, or a cut fixture
// .json.gz) in this process, the way the worker does (`solveAnytime`), and print one JSON line: the answer, its
// ticks / refusal, the switch's counts, and (with `--import ./axis-register.mjs`) the census rows go to $AXIS_OUT.
// Every advance of the FINAL main run is also checked for the lane: a tick that moved both x and y while an axis
// walk was driving is counted (`laneBreaks`). Usage: node [--import ./axis-register.mjs] axis-replay.mjs
//   --root=<tree> (--fixture=<gz> | --requests=<jsonl> --id=N [--i=K]) [--d=<seam offset>] [--passes=N] [--on]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? process.env.AXIS_ROOT ?? '/home/user/Archipelago-CC';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(ROOT + '/frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES, replayTape } = await import(ROOT + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
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
if ('on' in args && PK.AXIS_STRIKE) PK.AXIS_STRIKE.enabled = true;
if ('off' in args && PK.AXIS_STRIKE) PK.AXIS_STRIKE.enabled = false;
const t0 = Date.now();
const answer = solveAnytime({ ...tape, source, levelSource }, { passes: args.passes ? passes.slice(0, Number(args.passes)) : passes });
const S = globalThis.__axisStats;
let hits = null;
if (answer.ok) { const sh = replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...answer.plan.solution], levelSource, scratchPersistence: tape.scratchPersistence });
    hits = sh.ledger('playerHits').map((h) => [h.t, h.source, h.id]); }
const out = { id: row.id ?? null, key: row.key ?? null, i: c.i ?? 0, d: Number(args.d ?? 0), seam: captured.staging?.seam?.time,
    on: 'on' in args, ok: answer.ok, kind: answer.kind ?? null, work: answer.work ?? null, ms: Date.now() - t0,
    ticks: answer.ok ? answer.plan.solution.length : null, hits,
    message: answer.ok ? null : String(answer.message ?? '').slice(0, 6000),
    plan: answer.ok ? (await import('node:crypto')).createHash('sha1').update(JSON.stringify(answer.plan.solution.map((k) => [...k]))).digest('hex').slice(0, 12) : null,
    counts: PK.AXIS_STRIKE_COUNTS ? { ...PK.AXIS_STRIKE_COUNTS } : null,
    census: S ? { driveTicks: S.driveTicks, axisTicks: S.axisTicks, axisArmed: S.axisArmed, inReach: S.rows.length,
        along: S.rows.filter((r) => r.along.length).length } : null };
console.log(JSON.stringify(out));
