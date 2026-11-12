// OPP-DASH-DEFERS census: every captured page request under fixtures/ (`*request*.json.gz`), its first request's
// dashless pass at the SHIPPED defaults (OPPORTUNISTIC_STRIKE is ON there), `OPP_DASH_DEFERS` OFF then ON, capped at CAP
// work units (SPINNER-CORNER's census shape). One TSV row per fixture: verdict/work/ticks/sha OFF and ON, whether the
// refusal says "no step out", the in-window aims the policy saw (all asks, previews included) and those the DRIVE took
// OFF (`t:target`), and ON's `deferred` count. Usage: node census.mjs [cap=2560] [fixture-substring] [--shard=k/n]
// --jsonl: the requests captured under CC/docs/cloud-reports/ (`*request*.jsonl.gz`, every line) instead of fixtures/.
// Env: CENSUS_TRAIN=1 runs every request under the hammerClearTagChain.train row's set and `withL40Flip(false)` instead.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const M = new URL('../../../../../frontend/modules/seedlingDemo/', import.meta.url).pathname;
const SB = await import(M + 'solverBot.js');
const SP = await import(M + 'strikePolicy.js');
const { withOpportunisticStrike, OPPORTUNISTIC_STRIKE_TRACE } = await import(M + 'pressKillCost.js');
const { withPressEscapeExact } = await import(M + 'pressEscapeExact.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { withL40Flip } = await import(M + 'l40FlipSet.js');
const { restoreRequest } = await import(new URL('../../../../../scripts/procgen/seedlingSolveRequestCodec.js', import.meta.url).pathname);
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { settleSolve, solveFromTape } = await import(M + 'jsRuntimeSolver.js');
const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const CAP = Number(pos[0] ?? 2560);
const only = pos[1] ?? '';
const [k, n] = (process.argv.find((a) => a.startsWith('--shard='))?.slice(8) ?? '0/1').split('/').map(Number);
const TRAIN = process.env.CENSUS_TRAIN === '1';
const withSet = TRAIN
    ? (fn) => withL40Flip(false, () => SB.withClearTagChain(true, () => SB.withStanceBurn(true, () => withOpportunisticStrike(true,
        () => SB.withChaserStagedHunt(true, () => withPressEscapeExact(true,
            () => withContactFidelity({ forecastShieldBump: true }, fn)))))))
    : (fn) => fn();
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/request.*\.json\.gz$/.test(f)) files.push(p); } };
// --jsonl: every line of every `*request*.jsonl.gz` captured under CC/docs/cloud-reports/ instead (the sweep captures)
const JSONL = process.argv.includes('--jsonl');
const R = new URL('../../', import.meta.url).pathname;
if (JSONL) {
    const wj = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) wj(p); else if (/request.*\.jsonl\.gz$/.test(f)) {
        gunzipSync(readFileSync(p)).toString('utf8').trim().split('\n').forEach((line, i) => files.push({ p, i, line })); } } };
    wj(R);
} else walk(M + 'fixtures');
files.sort((a, b) => (JSONL ? 0 : (a < b ? -1 : a > b ? 1 : 0)));
const solve = (tape, levelSource) => {
    let work = 0;
    const ev = [];
    SP.OPP_DASH_DEFERS_TRACE.sink = (e) => ev.push({ kind: 'w', t: e.tick, targets: e.targets });
    OPPORTUNISTIC_STRIKE_TRACE.sink = (r) => { if (r.kind === 'drive') ev.push({ kind: 'd', t: r.t, decision: r.decision }); };
    for (const c of Object.keys(SP.OPP_DASH_DEFERS_COUNTS)) SP.OPP_DASH_DEFERS_COUNTS[c] = 0;
    let a;
    try {
        a = withSet(() => settleSolve(() => solveFromTape({ ...tape, levelSource, dashMode: 'none', adds: null, fineCheckpoints: true,
            shouldStop: () => { work += 1; return work > CAP; } })));
    } finally { SP.OPP_DASH_DEFERS_TRACE.sink = null; OPPORTUNISTIC_STRIKE_TRACE.sink = null; }
    const drive = [];
    for (let i = 0; i < ev.length; i += 1) {
        if (ev[i].kind === 'w' && ev[i + 1]?.kind === 'd' && ev[i + 1].t === ev[i].t) drive.push(`${ev[i].t}:${ev[i].targets.join('+')}`);
    }
    const C = { ...SP.OPP_DASH_DEFERS_COUNTS };
    if (a.ok) {
        const sha = createHash('sha256').update(JSON.stringify(a.plan.solution.map((s) => [...s]))).digest('hex').slice(0, 12);
        return { v: `ok/${work}/${a.plan.solution.length}/${sha}`, step: false, C, drive };
    }
    return { v: `refused/${work}${a.deadline ? '/deadline' : ''}`, step: /There is no step out/.test(a.message ?? ''), C, drive,
        msg: String(a.message ?? '').split('\n')[0].slice(0, 140) };
};
console.log(['fixture', 'key', 'off', 'on', 'offNoStepOut', 'onNoStepOut', 'offInWindow', 'offDriveInWindow', 'onDeferred', 'offMsg', 'onMsg'].join('\t'));
for (const e of files.filter((p, i) => (JSONL ? p.p : p).includes(only) && i % n === k)) {
    const f = JSONL ? `${e.p}#${e.i}` : e;
    const FIX = JSON.parse(JSONL ? e.line : gunzipSync(readFileSync(e)).toString('utf8'));
    const req = FIX.requests?.[0]?.request ?? FIX.request ?? FIX;
    let tape; let levelSource;
    try {
        const { passes, source, budgetWork, upgradeWindowWork, ...t } = restoreRequest(req);
        tape = t; levelSource = source?.records ? levelSourceFromAtlas(source.records) : atlasLevelSource();
    } catch (e) { console.log(`${f}\tunreadable: ${String(e.message).slice(0, 80)}`); continue; }
    const off = SP.withOppDashDefers(false, () => solve(tape, levelSource));
    const on = SP.withOppDashDefers(true, () => solve(tape, levelSource));
    console.log([JSONL ? f.slice(R.length) : f.slice(M.length + 'fixtures/'.length), FIX.key ?? '', off.v, on.v, off.step, on.step, off.C.inWindow,
        off.drive.join(' ') || '-', on.C.deferred, off.msg ?? '', on.msg ?? ''].join('\t'));
}
