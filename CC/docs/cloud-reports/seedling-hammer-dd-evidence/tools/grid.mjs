// SCRATCH (seedling-hammer-dd W0/D1): search boot positions on one view for a kill-rung press-arm dwell that starts
// with its target already gone (the census hook in the tree's solverBot logs `press-arm-dwell-start` rows to
// DD_CENSUS_FILE). One process, many solves. Measure-only.
//   REPO=<tree> DD_CENSUS_FILE=x.jsonl node grid.mjs --view=boot.json --goal="exit:224,160" --xs=16:304:16 --ys=16:224:16 [--lapse=1]
import { readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
const MODULE = `${process.env.REPO}/frontend/modules/seedlingDemo`;
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { solveSegment } = await import(join(MODULE, 'solverBot.js'));
const { createRunForStaging, solveStaging, stagingFromTape } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { CONTACT_FIDELITY } = await import(join(MODULE, 'contactFidelity.js'));
if (arg('lapse', null) !== null) CONTACT_FIDELITY.strikeIframeLapse = arg('lapse') === '1';
const goalOf = (spec) => {
    const m = /^(collect|exit):(-?\d+),(-?\d+)$/.exec(spec);
    const p = { x: Number(m[2]), y: Number(m[3]) };
    return m[1] === 'collect' ? { kind: 'collect-placement', placement: p } : { kind: 'reach-exit', exit: p };
};
const range = (s) => { const [a, b, st] = s.split(':').map(Number); const o = []; for (let v = a; v <= b; v += st) o.push(v); return o; };
const base = solveStaging(stagingFromTape(parseTape(readFileSync(arg('view'), 'utf8'))));
const goals = arg('goal').split(';').map(goalOf);
const out = arg('out', null);
for (const y of range(arg('ys'))) for (const x of range(arg('xs'))) {
    const staging = { ...base, boot: { ...base.boot, x, y } };
    let run;
    try { run = createRunForStaging(staging, atlasLevelSource()); } catch { continue; }
    process.env.DD_AT = `${x},${y}`;
    let verdict; let msg = '';
    try {
        const r = solveSegment({ run, goals, name: 'grid', boot: staging.boot, dashMode: 'all',
            shouldStop: () => run.ticksCompleted > 3000 });
        verdict = `SOLVED ${r.perTick.length}`;
    } catch (e) { verdict = `REFUSED ${run.ticksCompleted}`; msg = String(e?.message ?? e).slice(0, 200); }
    const row = { x, y, verdict, already: /ALREADY TRUE/.test(msg), msg: /ALREADY TRUE/.test(msg) ? msg : msg.slice(0, 80) };
    if (out) appendFileSync(out, JSON.stringify(row) + '\n');
}
