// The control (WITH {40,12}): the leg-873 request's solve, budget lifted, at main's defaults; writes the plan as JSON.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const R = new URL('../../../../../', import.meta.url).pathname;
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const { settleSolve, solveFromTape } = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const fx = JSON.parse(gunzipSync(readFileSync(R + 'frontend/modules/seedlingDemo/fixtures/hammer-bk2-approach-order/leg873-l39-l40-bk2-request.json.gz')));
const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(fx.requests[0].request);
const drop = process.argv.includes('--no-flag12');
if (drop) tape.staging = { ...tape.staging, persistence: tape.staging.persistence.filter((c) => !(c.level === 40 && c.tag === 12)) };
let work = 0;
const cap = Number(process.argv.find((a) => a.startsWith('--cap='))?.slice(6) ?? 0);
const answer = settleSolve(() => solveFromTape({ ...tape, levelSource: levelSourceFromAtlas(source.records), dashMode: 'none',
    adds: null, fineCheckpoints: true, shouldStop: () => { work += 1; return cap > 0 && work > cap; } }));
console.log(JSON.stringify({ flag12: !drop, ok: answer.ok, work, message: answer.ok ? null : String(answer.message).slice(0, 600),
    ticks: answer.plan?.solution?.length ?? null }));
if (answer.ok) {
    const out = { staging: tape.staging, keys: answer.plan.solution.map((k) => [...k]), equipsAt: [...(answer.plan.equipsAt ?? [])],
        expectedLast: answer.plan.expected.at(-1) };
    writeFileSync(process.argv.find((a) => a.startsWith('--out='))?.slice(6) ?? '/dev/null', JSON.stringify(out));
    console.log('equipsAt', JSON.stringify(out.equipsAt), 'last', JSON.stringify(out.expectedLast));
}
