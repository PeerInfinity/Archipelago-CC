// LB D2 (measure) — one pass of a captured request at a seam time, with no `settleSolve`, so a throw keeps its stack.
//   node stack-at-seam.mjs --requests=<jsonl> --id=414 --seam=5127 [--pass=0]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO ?? '/home/user/Archipelago-CC';
const M = join(REPO, 'frontend/modules/seedlingDemo');
const arg = (n, f = null) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const { restoreRequest } = await import(join(REPO, 'scripts/procgen/seedlingSolveRequestCodec.js'));
const { levelSourceFromAtlas } = await import(join(M, 'atlasSource.js'));
const { solveFromTape, ANYTIME_PASSES } = await import(join(M, 'jsRuntimeSolver.js'));
const line = readFileSync(arg('requests'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .find((r) => String(r.id) === arg('id'));
const req = restoreRequest(line.requests[0].request);
const { source, passes: _p, budgetWork: _b, upgradeWindowWork: _w, ...tape } = req;
const staging = { ...tape.staging, seam: { ...tape.staging.seam, time: Number(arg('seam')) } };
const p = ANYTIME_PASSES[Number(arg('pass', '0'))];
try {
    const out = solveFromTape({ ...tape, staging, levelSource: levelSourceFromAtlas(source.records), dashMode: p.dashMode,
        adds: p.adds ?? null });
    console.log('ANSWER', out.ok, String(out.message ?? '').slice(0, 300));
} catch (e) {
    console.log('THREW', e.name, String(e.message).slice(0, 200));
    console.log(String(e.stack).split('\n').slice(1, 30).join('\n'));
}
