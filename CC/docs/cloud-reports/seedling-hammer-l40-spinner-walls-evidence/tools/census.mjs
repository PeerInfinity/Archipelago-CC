// L40-SPINNER-WALLS census (SPINNER-CORNER's census.mjs, the switch swapped for SHOVED_BODY_LOOKAHEAD): every captured page request under fixtures/ (`*request*.json.gz`), its first request's dashless
// pass at the shipped defaults, `HAMMER_BODY_GATE` OFF then ON, capped at CAP work units (DYING-BODY-WAIT's census shape).
// One TSV row per fixture: the request's key when it carries one, verdict/work/ticks OFF and ON, whether the OFF refusal
// says "no step out", and the switch's counts ON. Usage: node census.mjs [cap=2560] [fixture-substring] [--shard=k/n]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const SB = await import(M + 'solverBot.js');
const { restoreRequest } = await import('/home/user/Archipelago-CC/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { settleSolve, solveFromTape } = await import(M + 'jsRuntimeSolver.js');
const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const CAP = Number(pos[0] ?? 2560);
const only = pos[1] ?? '';
const [k, n] = (process.argv.find((a) => a.startsWith('--shard='))?.slice(8) ?? '0/1').split('/').map(Number);
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/request.*\.json\.gz$/.test(f)) files.push(p); } };
walk(M + 'fixtures');
files.sort();
const solve = (tape, levelSource) => {
    let work = 0;
    const a = settleSolve(() => solveFromTape({ ...tape, levelSource, dashMode: 'none', adds: null, fineCheckpoints: true,
        shouldStop: () => { work += 1; return work > CAP; } }));
    if (a.ok) {
        const sha = createHash('sha256').update(JSON.stringify(a.plan.solution.map((s) => [...s]))).digest('hex').slice(0, 12);
        return { v: `ok/${work}/${a.plan.solution.length}/${sha}`, step: false };
    }
    return { v: `refused/${work}${a.deadline ? '/deadline' : ''}`, step: /There is no step out/.test(a.message ?? '') };
};
console.log(['fixture', 'key', 'off', 'on', 'offNoStepOut', 'onNoStepOut', 'asked', 'deepened', 'rechosen', 'spent'].join('\t'));
for (const f of files.filter((p, i) => p.includes(only) && i % n === k)) {
    const FIX = JSON.parse(gunzipSync(readFileSync(f)).toString('utf8'));
    const req = FIX.requests?.[0]?.request ?? FIX.request ?? FIX;
    let tape; let levelSource;
    try {
        const { passes, source, budgetWork, upgradeWindowWork, ...t } = restoreRequest(req);
        tape = t; levelSource = source?.records ? levelSourceFromAtlas(source.records) : atlasLevelSource();
    } catch (e) { console.log(`${f.slice(M.length)}\tunreadable: ${String(e.message).slice(0, 80)}`); continue; }
    const off = SB.withShovedBodyLookahead(false, () => solve(tape, levelSource));
    for (const c of Object.keys(SB.SHOVED_BODY_LOOKAHEAD_COUNTS)) SB.SHOVED_BODY_LOOKAHEAD_COUNTS[c] = 0;
    const on = SB.withShovedBodyLookahead(true, () => solve(tape, levelSource));
    const C = SB.SHOVED_BODY_LOOKAHEAD_COUNTS;
    console.log([f.slice(M.length + 'fixtures/'.length), FIX.key ?? '', off.v, on.v, off.step, on.step, C.asked, C.deepened, C.rechosen, C.spent
        ].join('\t'));
}
