// MEASUREMENT ONLY: replay ONE captured solve request (sweep capture jsonl --requests + --id [--i], or --fixture=<gz>)
// as the worker does (`solveAnytime`) under the process's SEEDLING_* env, re-drive the answer (`replayTape`) for the
// model's player hits, and print one JSON line. With `--import ./walk-register.mjs` the answer's walks are listed too
// (the run whose last walk ends at the plan's length).
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? '/home/user/Archipelago-CC';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(ROOT + '/frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, replayTape, ANYTIME_PASSES } = await import(ROOT + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
let row;
if (args.fixture) row = JSON.parse(gunzipSync(readFileSync(args.fixture)).toString('utf8'));
else row = readFileSync(args.requests, 'utf8').trim().split('\n').map(JSON.parse).find((r) => String(r.id) === String(args.id));
const c = row.requests.find((q) => String(q.i) === String(args.i ?? 0)) ?? row.requests[0];
const req = restoreRequest(c.request);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const out0 = {};
const t0 = Date.now();
if (args.budget) tape.budgetWork = Number(args.budget);
const answer = solveAnytime({ ...tape, source, levelSource }, { passes });
out0.budgetWork = tape.budgetWork ?? null;
const out = { ...out0, id: row.id ?? null, key: row.key ?? null, i: c.i ?? 0, nReq: row.requests.length, prefix: tape.perTick.length,
    ok: answer.ok, kind: answer.kind ?? null, work: answer.work ?? null, ms: Date.now() - t0,
    ticks: answer.ok ? answer.plan.solution.length : null,
    message: answer.ok ? null : String(answer.message ?? '').slice(0, Number(process.env.MSG_LEN ?? 400)),
    plan: answer.ok ? createHash('sha1').update(JSON.stringify(answer.plan.solution.map((k) => [...k]))).digest('hex').slice(0, 12) : null };
if (answer.ok) {
    const shadow = replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...answer.plan.solution], levelSource,
        scratchPersistence: tape.scratchPersistence });
    out.hits = shadow.ledger('playerHits').map((h) => [h.t, h.source, h.id]);
}
if (globalThis.__ctsWalks && answer.ok) {
    const end = tape.perTick.length + answer.plan.solution.length;
    let pick = null;
    for (const [, recs] of globalThis.__ctsWalks) if (recs.some((r) => r.t1 !== null)) pick = recs;
    // the answer's run: the last whose walks reach the plan's end region
    const cands = [...globalThis.__ctsWalks.values()].filter((recs) => recs.some((r) => r.t1 !== null && r.t1 <= end));
    pick = cands.at(-1) ?? pick;
    out.walks = (pick ?? []).filter((r) => r.t1 !== null).map((r) => ({ what: r.what, t0: r.t0, t1: r.t1, stand: r.stand,
        ax: r.axisAligned, at: [+(r.x ?? 0).toFixed(2), +(r.y ?? 0).toFixed(2)] }));
}
console.log(JSON.stringify(out));
