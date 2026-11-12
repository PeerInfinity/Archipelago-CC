// OPP-DASH-DEFERS — leg (key) `level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 12:
// wandlock@480,560 cleared` under the hammerClearTagChain.train row's set (dashless, uncapped, `withL40Flip(false)`).
// Prints the verdict, work, ticks, plan sha, hits, the OPP_DASH_DEFERS counts and every in-window aim the policy saw.
// Usage: node leg871.mjs [--defers=0|1] [--bodygate=0|1]
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const M = new URL('../../../../../frontend/modules/seedlingDemo/', import.meta.url).pathname;
const SB = await import(M + 'solverBot.js');
const SP = await import(M + 'strikePolicy.js');
const { withOpportunisticStrike, OPPORTUNISTIC_STRIKE_TRACE } = await import(M + 'pressKillCost.js');
const { withPressEscapeExact } = await import(M + 'pressEscapeExact.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { restoreRequest } = await import(new URL('../../../../../scripts/procgen/seedlingSolveRequestCodec.js', import.meta.url).pathname);
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { replayTape, settleSolve, solveFromTape } = await import(M + 'jsRuntimeSolver.js');
const { withL40Flip } = await import(M + 'l40FlipSet.js');
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const defers = arg('defers', '0') === '1';
const bodyGate = arg('bodygate', '0') === '1';
const FIX = JSON.parse(gunzipSync(readFileSync(M + 'fixtures/hammer-cleartag-chain/leg871-l39-l40-request.json.gz')).toString('utf8'));
const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(FIX.requests[0].request);
const levelSource = levelSourceFromAtlas(source.records);
const withSet = (fn) => SB.withClearTagChain(true, () => SB.withStanceBurn(true, () => withOpportunisticStrike(true,
    () => SB.withChaserStagedHunt(true, () => withPressEscapeExact(true,
        () => withContactFidelity({ forecastShieldBump: true }, fn))))));
const events = [];
SP.OPP_DASH_DEFERS_TRACE.sink = (e) => events.push({ kind: 'inWindow', ...e, why: undefined });
OPPORTUNISTIC_STRIKE_TRACE.sink = (r) => { if (r.kind === 'drive') events.push({ kind: 'drive', t: r.t, decision: r.decision, target: r.target }); };
withL40Flip(false, () => withSet(() => SB.withHammerBodyGate(bodyGate, () => SP.withOppDashDefers(defers, () => {
    let work = 0;
    const answer = settleSolve(() => solveFromTape({ ...tape, levelSource, dashMode: 'none', adds: null,
        fineCheckpoints: true, shouldStop: () => { work += 1; return false; } }));
    const C = SP.OPP_DASH_DEFERS_COUNTS;
    const head = `defers=${defers ? 1 : 0} bodygate=${bodyGate ? 1 : 0}`;
    if (!answer.ok) {
        console.log(head, JSON.stringify({ ok: false, work, counts: C, first: String(answer.message).split('\n')[0].slice(0, 240) }));
    } else {
        const { plan } = answer;
        const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource,
            scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
        const h0 = run.playerHits.length;
        const row = () => ({ level: run.level, x: run.state.x, y: run.state.y, deaths: run.playerDeaths.length });
        let bad = 0;
        for (let k = 0; k < plan.solution.length; k += 1) {
            const slot = plan.equipsAt?.get?.(k);
            if (slot !== undefined) run.equipNow(slot);
            run.advance(plan.solution[k]);
            if (plan.expected[k + 1] && JSON.stringify(row()) !== JSON.stringify(plan.expected[k + 1])) bad += 1;
        }
        console.log(head, JSON.stringify({ ok: true, work, ticks: plan.solution.length,
            sha: createHash('sha256').update(JSON.stringify(plan.solution.map((s) => [...s]))).digest('hex').slice(0, 12),
            rowMismatches: bad, hits: run.playerHits.slice(h0).map((h) => [h.t, h.source, h.id]), deaths: run.playerDeaths.length,
            clears: (run.ledger('earnedClears') ?? []).map((c) => `${c.level}:${c.tag}`).sort(), counts: C }));
    }
    // an in-window aim is a DRIVE aim when the drive's own sink names the same tick right after it
    const drive = [];
    for (let i = 0; i < events.length; i += 1) {
        const e = events[i];
        if (e.kind === 'inWindow' && events[i + 1]?.kind === 'drive' && events[i + 1].t === e.tick) drive.push({ t: e.tick, targets: e.targets, took: events[i + 1].decision });
    }
    console.log('in-window aims (all asks):', events.filter((e) => e.kind === 'inWindow').length, 'of them taken at the drive (OFF):', JSON.stringify(drive.slice(0, 20)));
}))));
