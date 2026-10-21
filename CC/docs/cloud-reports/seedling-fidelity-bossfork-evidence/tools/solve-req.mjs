// BOSSFORK: solve one captured request in node; print the plan's verbs/tried variants; optionally write a tape.
// node solve-req.mjs <requests.jsonl> <id> [--tape=<out.json>] [--off=key,key]
import { readFileSync, writeFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const [file, id] = process.argv.slice(2);
const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const row = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).find((r) => String(r.id) === id);
const cap = row.requests[0];
if (arg('off')) for (const k of arg('off').split(',')) cap.request.contactFidelity[k] = false;
const req = restoreRequest(cap.request);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
if (!tape.live) {
    const { runDigest } = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
    const { createRunForStaging } = await import(R + 'frontend/modules/seedlingDemo/tapeRunner.js');
    const { withContactFidelity } = await import(R + 'frontend/modules/seedlingDemo/contactFidelity.js');
    withContactFidelity(tape.contactFidelity ?? {}, () => {
        const sh = createRunForStaging(tape.staging, levelSource, { scratchPersistence: tape.scratchPersistence });
        tape.live = { digest: runDigest(sh), row: { level: sh.level, x: sh.state.x, y: sh.state.y, deaths: 0 } };
    });
}
const t0 = Date.now();
const a = solveAnytime({ ...tape, source, levelSource }, { passes });
console.log('ok', a.ok, 'kind', a.kind, 'ms', Date.now() - t0, a.ok ? '' : String(a.message).slice(0, 600));
if (a.ok) {
    const p = a.plan;
    console.log('plan keys', Object.keys(p).join(','));
    console.log('ticks', p.solution.length);
    const recs = p.verbs ?? [];
    console.log('verbs', JSON.stringify(recs).slice(0, 1500));
    if (arg('tape')) {
        const per = p.solution.map((s) => [...s]);
        const inputs = [];
        for (const k of ['up', 'down', 'left', 'right', 'primary', 'secondary']) { let from = null; for (let t = 0; t <= per.length; t++) { const o = t < per.length && per[t].includes(k); if (o && from === null) from = t; if (!o && from !== null) { inputs.push({ key: k, from, to: t }); from = null; } } }
        inputs.sort((x, y) => x.from - y.from || x.key.localeCompare(y.key));
        const st = cap.request.staging;
        const out = { game: 'seedling', name: arg('name') ?? `bossfork-${id}`, ...st, tick_count: per.length, inputs, tape_version: 8,
            description: `BOSSFORK D1: the solver's leg-${id} answer (captured request, fork passed), played as a tape` };
        writeFileSync(arg('tape'), JSON.stringify(out, null, 1));
        console.log('wrote', arg('tape'));
    }
}
