// FADE-MOVE scratch instrument (measure only): replay a captured divergence-sweep request in node (the worker's own
// dispatch, as `replay-seedling-solve-request.mjs` does it), then play the answer on a fresh `replayTape` and print one
// JSON row: ok/kind, ticks, model hits (t, source, id), deaths, the end, and the FADE_MOVE census/decision rows.
// Switches come from the env (SEEDLING_FADE_MOVE=1 …), read when solverBot loads.
// Usage: [ENV…] node replay.mjs --requests=<jsonl> --id=N [--i=0] [--root=<repo>] [--trace=lo..hi] [--plan-out=<file>]
import { readFileSync, writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const ROOT = args.root ?? '/home/user/Archipelago-CC';
const { restoreRequest } = await import(`${ROOT}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${ROOT}/frontend/modules/seedlingDemo/atlasSource.js`);
const JR = await import(`${ROOT}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const SB = await import(`${ROOT}/frontend/modules/seedlingDemo/solverBot.js`);
let row = null;
for (const line of readFileSync(args.requests, 'utf8').split('\n')) {
    if (!line) continue;
    const r = JSON.parse(line);
    if (String(r.id) === String(args.id)) { row = r; break; }
}
if (!row) { console.error('no such id'); process.exit(2); }
const cap = row.requests.find((c) => String(c.i) === String(args.i ?? 0)) ?? row.requests[0];
const req = restoreRequest(cap.request);
const { passes = JR.ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
SB.resetFadeMoveCounts?.();
const t0 = Date.now();
const a = JR.solveAnytime({ ...tape, source, levelSource }, { passes });
const ms = Date.now() - t0;
const fm = SB.FADE_MOVE_COUNTS ? JSON.parse(JSON.stringify(SB.FADE_MOVE_COUNTS)) : null;
if (!a.ok) {
    console.log(JSON.stringify({ id: row.id, key: row.key, ok: false, kind: a.kind ?? null,
        message: String(a.message ?? '').slice(0, 600), ms, fadeMove: fm }));
    process.exit(0);
}
const sol = a.plan.solution.map((k) => [...k]);
if (args['plan-out']) writeFileSync(args['plan-out'], JSON.stringify(sol));
const shadow = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource,
    scratchPersistence: tape.scratchPersistence });
const [lo, hi] = (args.trace ?? '').split('..').map(Number);
let prevHits = shadow.playerHits.length;
const trace = [];
for (let i = 0; i < sol.length; i += 1) {
    shadow.advance(new Set(sol[i]));
    const t = i + 1;
    const newH = shadow.playerHits.slice(prevHits);
    prevHits = shadow.playerHits.length;
    if ((args.trace && t >= lo && t <= hi) || newH.length) {
        const s = shadow.state;
        const ch = (shadow.chasers ?? []).map((c) => `${c.id}(${c.x.toFixed(1)},${c.y.toFixed(1)})`).join(' ');
        trace.push(`t${t} L${shadow.level} p(${s.x.toFixed(2)},${s.y.toFixed(2)}) [${sol[i].join(',')}] ${ch}`
            + `${newH.length ? ` HIT ${JSON.stringify(newH)}` : ''}`);
    }
}
const hits = shadow.playerHits.map((h) => ({ t: h.t, source: h.source, id: h.id }));
console.log(JSON.stringify({ id: row.id, key: row.key, ok: true, ticks: sol.length, hits: hits.length, hitRows: hits,
    deaths: shadow.playerDeaths.length, end: { level: shadow.level, x: shadow.state.x, y: shadow.state.y }, ms,
    passes: (a.passes ?? []).map(({ ms: _m, ...r }) => r), fadeMove: fm }));
if (args.trace || hits.length) for (const l of trace) console.error(l);
