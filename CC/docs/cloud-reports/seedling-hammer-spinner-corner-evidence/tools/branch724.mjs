// SPINNER-CORNER — records leg 871's (key `level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 12:
// wandlock@480,560 cleared`) FIRST branch, switch OFF, the train row's set: solveSegment on an observed run, whose keys
// and equips (recorded as the solver drives them) end where OPP_PRESS_FALLBACK left it — the t724 "no step out" corner.
// Writes `{keys, equips}` gzipped to --emit=<path> (the row fixture `fixtures/hammer-spinner-corner/leg871-branch724.json.gz`).
import { writeFileSync, readFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
const M = new URL('../../../../../frontend/modules/seedlingDemo/', import.meta.url).pathname;
const SB = await import(M + 'solverBot.js');
const { withOpportunisticStrike } = await import(M + 'pressKillCost.js');
const { withPressEscapeExact } = await import(M + 'pressEscapeExact.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { restoreRequest } = await import(new URL('../../../../../scripts/procgen/seedlingSolveRequestCodec.js', import.meta.url).pathname);
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { replayTape, forkRunFor, solverGoalsOf } = await import(M + 'jsRuntimeSolver.js');
const { withL40Flip } = await import(M + 'l40FlipSet.js');
const emit = process.argv.find((a) => a.startsWith('--emit='))?.slice(7) ?? null;
const FIX = JSON.parse(gunzipSync(readFileSync(M + 'fixtures/hammer-cleartag-chain/leg871-l39-l40-request.json.gz')).toString('utf8'));
const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(FIX.requests[0].request);
const levelSource = levelSourceFromAtlas(source.records);
const withSet = (fn) => SB.withClearTagChain(true, () => SB.withStanceBurn(true, () => withOpportunisticStrike(true,
    () => SB.withChaserStagedHunt(true, () => withPressEscapeExact(true,
        () => withContactFidelity({ forecastShieldBump: true }, fn))))));
withL40Flip(false, () => withSet(() => SB.withHammerBodyGate(false, () => {
    const args = { staging: tape.staging, levelSource, scratchPersistence: tape.scratchPersistence === true,
        equips: tape.equips ?? null, holds: tape.holds ?? null };
    const run = replayTape({ ...args, perTick: tape.perTick });
    const keys = [];
    const equips = [];
    const adv = run.advance.bind(run);
    const eq = run.equipNow.bind(run);
    run.advance = (k) => { keys.push([...k]); return adv(k); };
    run.equipNow = (slot) => { equips.push([keys.length, slot]); return eq(slot); };
    try {
        SB.solveSegment({ run, goals: solverGoalsOf(tape.solverGoal), name: 'b724', boot: tape.staging.boot,
            prefix: tape.perTick, dashMode: 'none', forkRun: forkRunFor({ ...args, prefixLength: tape.perTick.length }),
            shouldStop: () => false, fineCheckpoints: true });
    } catch { /* the segment refuses; the observed run is the branch the fallback left */ }
    console.log(`branch: ${keys.length} keys, ${equips.length} equip(s), clock ${run.ticksCompleted}, player `
        + `(${run.state.x.toFixed(2)},${run.state.y.toFixed(2)}), prefix ${tape.perTick.length}`);
    if (emit) writeFileSync(emit, gzipSync(JSON.stringify({ keys, equips })));
})));
