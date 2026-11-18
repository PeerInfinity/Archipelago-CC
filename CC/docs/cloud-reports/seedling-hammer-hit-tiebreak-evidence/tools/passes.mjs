// HIT-TIEBREAK scratch instrument (measure only): replay a captured request (the worker's dispatch), and for EVERY
// pass print its plan's ticks, the model's hits/deaths re-driven on a fresh replayTape (independent of any stamp),
// the plan's own `modelHits` stamp (present only with SEEDLING_HIT_AWARE_ANSWER=1), and which pass shipped.
// Usage: [ENV…] node passes.mjs --requests=<jsonl> --id=N [--i=K|--all] [--root=<repo>]
import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? '/home/user/Archipelago-CC';
const { restoreRequest } = await import(`${ROOT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${ROOT}/frontend/modules/seedlingDemo/atlasSource.js`);
const JR = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
let row = null;
for (const line of readFileSync(args.requests, 'utf8').split('\n')) {
    if (!line) continue;
    const r = JSON.parse(line);
    if (String(r.id) === String(args.id)) { row = r; break; }
}
if (!row) { console.error('no such id'); process.exit(2); }
const caps = args.all !== undefined ? row.requests : [row.requests.find((c) => String(c.i) === String(args.i ?? 0)) ?? row.requests[0]];
for (const cap of caps) {
    const req = restoreRequest(cap.request);
    const { passes = JR.ANYTIME_PASSES, source, ...tape } = req;
    const levelSource = levelSourceFromAtlas(source.records);
    const seen = [];
    const a = JR.solveAnytime({ ...tape, source, levelSource }, { passes, onPass: (ans) => seen.push(ans) });
    const out = [];
    for (const ans of seen) {
        if (!ans.ok) { out.push({ pass: ans.pass, ok: false, kind: ans.kind ?? null, msg: String(ans.message ?? '').slice(0, 160) }); continue; }
        const base = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, scratchPersistence: tape.scratchPersistence });
        const h0 = base.ledger('playerHits').length; const d0 = base.playerDeaths.length;
        const sh = JR.replayTape({ staging: tape.staging, perTick: [...tape.perTick, ...ans.plan.solution], levelSource,
            scratchPersistence: tape.scratchPersistence });
        const hits = sh.ledger('playerHits').slice(h0).map((h) => [h.t - tape.perTick.length, h.source, h.id]);
        out.push({ pass: ans.pass, ok: true, ticks: ans.plan.solution.length, replayHits: hits.length,
            replayDeaths: sh.playerDeaths.length - d0, hitRows: hits, modelHits: ans.plan.modelHits ?? null,
            forcedHits: JR.billedHitsOf(ans.plan), deadline: ans.plan.deadline?.first ?? null,
            endDeaths: ans.plan.expected.at(-1).deaths - ans.plan.expected[0].deaths });
    }
    console.log(JSON.stringify({ id: row.id, key: row.key, i: cap.i, shipped: a.ok ? a.plan.pass : null,
        shippedTicks: a.ok ? a.plan.solution.length : null, hitAware: JR.HIT_AWARE_ANSWER?.enabled ?? null, passes: out }));
}
