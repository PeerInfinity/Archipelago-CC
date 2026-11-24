// OPP-DASH-DEFERS — one captured request's dashless pass at the SHIPPED defaults, OFF and ON, capped at CAP: each plan
// replayed on a fresh run of its staging, listing every press (plan tick, whether `set slashing` DASHED, speed before ->
// after) and every player hit; plus, ON, the call sites whose in-window aims were refused (the caller of `decide`).
// Usage: node plancheck.mjs <fixture path under seedlingDemo/fixtures/ | path under CC/docs/cloud-reports/#line> [cap=2560]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const M = new URL('../../../../../frontend/modules/seedlingDemo/', import.meta.url).pathname;
const SP = await import(M + 'strikePolicy.js');
const { restoreRequest } = await import(new URL('../../../../../scripts/procgen/seedlingSolveRequestCodec.js', import.meta.url).pathname);
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { replayTape, settleSolve, solveFromTape } = await import(M + 'jsRuntimeSolver.js');
const [name, capArg] = process.argv.slice(2);
const CAP = Number(capArg ?? 2560);
// `<path under CC/docs/cloud-reports/>#<line>` reads one line of a captured `*.jsonl.gz` instead
const [jp, jl] = name.split('#');
const FIX = jl !== undefined
    ? JSON.parse(gunzipSync(readFileSync(new URL('../../' + jp, import.meta.url))).toString('utf8').trim().split('\n')[Number(jl)])
    : JSON.parse(gunzipSync(readFileSync(M + 'fixtures/' + name)).toString('utf8'));
const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(FIX.requests?.[0]?.request ?? FIX.request ?? FIX);
const levelSource = source?.records ? levelSourceFromAtlas(source.records) : atlasLevelSource();
const sp = (s) => Math.hypot(s.vx ?? 0, s.vy ?? 0).toFixed(2);
for (const on of [false, true]) {
    const sites = new Map();
    SP.OPP_DASH_DEFERS_TRACE.sink = (e) => {
        const fr = new Error().stack.split('\n').slice(2).map((l) => l.trim().replace(/^at /, '').replace(/ \(.*\/([^/]+:\d+):\d+\)$/, ' $1'));
        const site = fr.find((l) => !/strikePolicy\.js|axisAlongStrike|Proxy/.test(l)) ?? fr[0];
        const key = `${site}`;
        sites.set(key, (sites.get(key) ?? 0) + 1);
    };
    let work = 0;
    const a = SP.withOppDashDefers(on, () => settleSolve(() => solveFromTape({ ...tape, levelSource, dashMode: 'none', adds: null,
        fineCheckpoints: true, shouldStop: () => { work += 1; return work > CAP; } })));
    SP.OPP_DASH_DEFERS_TRACE.sink = null;
    if (!a.ok) { console.log(`ON=${on} refused work ${work}: ${String(a.message).split('\n')[0].slice(0, 200)}`); continue; }
    const { plan } = a;
    const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource,
        scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
    const h0 = run.playerHits.length;
    const presses = [];
    for (let k = 0; k < plan.solution.length; k += 1) {
        const slot = plan.equipsAt?.get?.(k);
        if (slot !== undefined) run.equipNow(slot);
        const before = sp(run.state);
        run.advance(plan.solution[k]);
        if (plan.solution[k].has('primary')) presses.push(`${k}${run.progress('slashInfo').state.slashDashed ? 'DASH' : ''}(${before}->${sp(run.state)})`);
    }
    console.log(`ON=${on} ok work ${work} ticks ${plan.solution.length} sha ${createHash('sha256').update(JSON.stringify(plan.solution.map((s) => [...s]))).digest('hex').slice(0, 12)}`
        + ` hits ${JSON.stringify(run.playerHits.slice(h0).map((h) => [h.t, h.source, h.id]))}`);
    console.log('   presses:', presses.join(' '));
    console.log('   in-window asks by caller:', JSON.stringify([...sites]));
}
