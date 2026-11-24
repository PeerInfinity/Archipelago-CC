// FEWER-HITS instrument (measure only): replay captured requests as the worker does (solveAnytime with the request's
// own budgets), under whatever SEEDLING_* env is set, and print the pass rows, the shipped plan and an INDEPENDENT
// re-drive of the shipped plan on a fresh replayTape (hits/deaths on the plan's ticks).
// Usage: [ENV…] node replay.mjs --requests=<jsonl> [--id=N] [--i=K]   (every request of every leg by default)
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? process.cwd();
const { restoreRequest } = await import(`${ROOT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${ROOT}/frontend/modules/seedlingDemo/atlasSource.js`);
const JR = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const rows = readFileSync(args.requests, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .filter((r) => args.id === undefined || String(r.id) === String(args.id));
for (const row of rows) for (const cap of row.requests.filter((c) => args.i === undefined || String(c.i) === String(args.i))) {
    const req = restoreRequest(cap.request);
    const { passes = JR.ANYTIME_PASSES, source, ...tape } = req;
    const levelSource = levelSourceFromAtlas(source.records);
    const t0 = Date.now();
    const a = JR.solveAnytime({ ...tape, source, levelSource }, { passes });
    const ms = Date.now() - t0;
    let redrive = null;
    if (a.ok) {
        const rp = (perTick) => JR.replayTape({ staging: tape.staging, perTick, levelSource, scratchPersistence: tape.scratchPersistence, equips: tape.equips, holds: tape.holds });
        const b = rp(tape.perTick); const s = rp([...tape.perTick, ...a.plan.solution]);
        redrive = { hits: s.ledger('playerHits').length - b.ledger('playerHits').length, deaths: s.playerDeaths.length - b.playerDeaths.length,
            end: [s.level, +s.state.x.toFixed(3), +s.state.y.toFixed(3)], expectedEnd: [a.plan.expected.at(-1).level, +a.plan.expected.at(-1).x.toFixed(3), +a.plan.expected.at(-1).y.toFixed(3)] };
    }
    const md5 = a.ok ? createHash('md5').update(JSON.stringify(a.plan.solution.map((h) => [...h]))).digest('hex') : null;
    console.log(JSON.stringify({ id: row.id, i: cap.i, env: { avoid: JR.HIT_AVOID_PASS.enabled, fewer: JR.FEWER_HITS_RANK.enabled, aware: JR.HIT_AWARE_ANSWER.enabled },
        ms, ok: a.ok, shipped: a.ok ? { pass: a.plan.pass, ticks: a.plan.solution.length, modelHits: a.plan.modelHits ?? null, delay: a.plan.hitAvoidDelay ?? null, md5 } : String(a.message).slice(0, 160),
        redrive, passes: (a.passes ?? []).map(({ ms: _m, ...r }) => r) }));
}
