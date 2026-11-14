// Leg (key) `level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 12: wandlock@480,560 cleared`
// under the hammerClearTagChain.train row's set (dashless, uncapped, withL40Flip(false) + the census set).
// argv: off | on | census     → prints verdict, work, the fallback instrument and the redo audit rows.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { withChaserStagedHunt, withClearTagChain, withStanceBurn } = await import(R + 'solverBot.js');
const { withOpportunisticStrike } = await import(R + 'pressKillCost.js');
const { withPressEscapeExact } = await import(R + 'pressEscapeExact.js');
const { withContactFidelity } = await import(R + 'contactFidelity.js');
const { restoreRequest } = await import('/home/user/Archipelago-CC/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'atlasSource.js');
const { settleSolve, solveFromTape, replayTape } = await import(R + 'jsRuntimeSolver.js');
const { withL40Flip } = await import(R + 'l40FlipSet.js');
const OPF = await import(R + 'oppPressFallback.js');
const OFH = await import(R + 'oppFallbackHits.js');
const mode = process.argv[2] ?? 'off';
const FIX = JSON.parse(gunzipSync(readFileSync(R + 'fixtures/hammer-cleartag-chain/' + (process.argv[3] ?? 'leg871-l39-l40-request.json.gz'))).toString('utf8'));
const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(FIX.requests[0].request);
const levelSource = levelSourceFromAtlas(source.records);
const fid = { forecastShieldBump: true };
const withSet = (fn) => withClearTagChain(true, () => withStanceBurn(true, () => withOpportunisticStrike(true,
    () => withChaserStagedHunt(true, () => withPressEscapeExact(true, () => withContactFidelity(fid, fn))))));
OFH.OPP_FALLBACK_HITS.census = mode === 'census';
OPF.resetOppPressFallbackCounts(); OFH.resetOppFallbackHitsCounts();
const t0 = Date.now();
withL40Flip(false, () => withSet(() => OFH.withOppFallbackHits(mode === 'on', () => {
    let work = 0; let caught = null;
    const answer = settleSolve(() => { try { return solveFromTape({ ...tape, levelSource, dashMode: 'none', adds: null,
        fineCheckpoints: true, shouldStop: () => { work += 1; return false; } }); } catch (e) { caught = e; throw e; } });
    console.log(JSON.stringify({ mode, switch: OFH.OPP_FALLBACK_HITS.enabled, ok: answer.ok, work, s: Math.round((Date.now() - t0) / 1000),
        ticks: answer.ok ? answer.plan.solution.length : null, refusalKeys: caught?.perTick?.length ?? null,
        oppPressFallback: { ...OPF.OPP_PRESS_FALLBACK_COUNTS }, oppFallbackHits: { ...OFH.OPP_FALLBACK_HITS_COUNTS, rows: undefined },
        rows: OFH.OPP_FALLBACK_HITS_COUNTS.rows, errRow: caught?.oppPressFallback ?? null }));
    if (!answer.ok) console.log('MESSAGE', answer.message.split('\n')[0].slice(0, 700));
    if (answer.ok) {
        const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
        const h0 = run.playerHits.length;
        for (let k = 0; k < answer.plan.solution.length; k += 1) { const slot = answer.plan.equipsAt?.get?.(k); if (slot !== undefined) run.equipNow(slot); run.advance(answer.plan.solution[k]); }
        console.log('PLAN HITS', JSON.stringify(run.playerHits.slice(h0).map((h) => [h.t, h.source, h.id])));
    }
})));
