// Census: every captured page request under fixtures/ (`*request*.json.gz`), its first request's dashless pass solved
// at the shipped defaults, OFF then ON (`withDyingBodyWait`), capped at CAP work units. Prints one TSV row per fixture:
// verdict/work/ticks OFF and ON, and the arm's counts ON (asked / kept / refused + whys).
// Usage: node census.mjs [cap=2560] [fixture-substring]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
const M = new URL('../../../../../frontend/modules/seedlingDemo/', import.meta.url).pathname;
const SB = await import(M + 'solverBot.js');
const { restoreRequest } = await import(new URL('../../../../../scripts/procgen/seedlingSolveRequestCodec.js', import.meta.url).pathname);
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { settleSolve, solveFromTape } = await import(M + 'jsRuntimeSolver.js');
const CAP = Number(process.argv[2] ?? 2560);
const only = process.argv[3] ?? '';
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/request.*\.json\.gz$/.test(f)) files.push(p); } };
walk(M + 'fixtures');
files.sort();
const solve = (tape, levelSource) => {
    let work = 0;
    const a = settleSolve(() => solveFromTape({ ...tape, levelSource, dashMode: 'none', adds: null, fineCheckpoints: true,
        shouldStop: () => { work += 1; return work > CAP; } }));
    return a.ok ? `ok/${work}/${a.plan.solution.length}` : `refused/${work}${a.deadline ? '/deadline' : ''}`;
};
console.log(['fixture', 'off', 'on', 'asked', 'kept', 'refused', 'detail'].join('\t'));
for (const f of files.filter((p) => p.includes(only))) {
    const FIX = JSON.parse(gunzipSync(readFileSync(f)).toString('utf8'));
    const req = FIX.requests?.[0]?.request ?? FIX.request ?? FIX;
    let tape; let levelSource;
    try {
        const { passes, source, budgetWork, upgradeWindowWork, ...t } = restoreRequest(req);
        tape = t; levelSource = source?.records ? levelSourceFromAtlas(source.records) : atlasLevelSource();
    } catch (e) { console.log(`${f.slice(M.length)}\tunreadable: ${String(e.message).slice(0, 80)}`); continue; }
    const off = SB.withDyingBodyWait(false, () => solve(tape, levelSource));
    const C = SB.DYING_BODY_WAIT_COUNTS; C.asked = 0; C.kept.length = 0; C.refused.length = 0;
    const on = SB.withDyingBodyWait(true, () => solve(tape, levelSource));
    const detail = [...C.kept.map((k) => `KEPT ${k.ids.join('+')} ${k.ticks}t@${k.from} clean=${k.clean}`),
        ...C.refused.map((r) => `REF@${r.t} ${r.why.slice(0, 140)}`)].join(' | ');
    console.log([f.slice(M.length + 'fixtures/'.length), off, on, C.asked, C.kept.length, C.refused.length, detail].join('\t'));
}
