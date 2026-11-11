// leg 871/872 under chaserSpinnerWalls OFF vs ON: solve each arm, replay each plan on the model under BOTH arms.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { withChaserStagedHunt, withClearTagChain, withStanceBurn } = await import(M + 'solverBot.js');
const { withOpportunisticStrike } = await import(M + 'pressKillCost.js');
const { withPressEscapeExact } = await import(M + 'pressEscapeExact.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { restoreRequest } = await import('/home/user/Archipelago-CC/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { replayTape, settleSolve, solveFromTape } = await import(M + 'jsRuntimeSolver.js');
const { withL40Flip } = await import(M + 'l40FlipSet.js');
const name = process.argv[2] ?? 'leg871-l39-l40-request.json.gz';
const seamShift = Number(process.argv[3] ?? 0);
const FIX = JSON.parse(gunzipSync(readFileSync(M + 'fixtures/hammer-cleartag-chain/' + name)).toString('utf8'));
const withSet = (walls, fn) => withClearTagChain(true, () => withStanceBurn(true, () => withOpportunisticStrike(true,
    () => withChaserStagedHunt(true, () => withPressEscapeExact(true,
        () => withContactFidelity({ forecastShieldBump: true, chaserSpinnerWalls: walls }, fn))))));
const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(FIX.requests[0].request);
if (seamShift && tape.staging?.seam) tape.staging.seam.time += seamShift;
console.log('seam', JSON.stringify(tape.staging.seam ?? null).slice(0, 200));
const levelSource = levelSourceFromAtlas(source.records);
function replay(plan, walls) {
  return withContactFidelity({ forecastShieldBump: true, chaserSpinnerWalls: walls }, () => {
    const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource,
        scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
    const h0 = run.playerHits.length; let firstPart = null;
    for (let k = 0; k < plan.solution.length; k += 1) {
        const slot = plan.equipsAt?.get?.(k);
        if (slot !== undefined) run.equipNow(slot);
        run.advance(plan.solution[k]);
        const e = plan.expected[k + 1];
        if (e && firstPart === null && (e.x !== run.state.x || e.y !== run.state.y || e.level !== run.level)) firstPart = { k: k + 1, e, got: { x: run.state.x, y: run.state.y, level: run.level } };
    }
    return { hits: run.playerHits.slice(h0).map((h) => [h.t, h.source, h.id]), deaths: run.playerDeaths.length, firstPart,
      burned: [...(run.entities('burnedTrees') ?? [])], clears: (run.ledger('earnedClears') ?? []).map((c) => `${c.level}:${c.tag}`).sort(),
      end: { x: run.state.x, y: run.state.y } };
  });
}
withL40Flip(false, () => {
  const plans = {};
  for (const walls of [false, true]) {
    let work = 0;
    const t0 = Date.now();
    const a = withSet(walls, () => settleSolve(() => solveFromTape({ ...tape, levelSource, dashMode: 'none', adds: null,
        fineCheckpoints: true, shouldStop: () => { work += 1; return false; } })));
    console.log(`\n== solve walls=${walls}: ok=${a.ok} work=${work} ms=${Date.now() - t0}`);
    if (!a.ok) { console.log('MESSAGE:', a.message); console.log('obstacle:', JSON.stringify(a.obstacle ?? a.refusal ?? null)); continue; }
    plans[walls] = a.plan;
    console.log('ticks', a.plan.solution.length, 'sha', createHash('sha256').update(JSON.stringify(a.plan.solution.map((s) => [...s]))).digest('hex').slice(0, 12),
      'steps', JSON.stringify((a.plan.steps ?? a.plan.strategies ?? []).map?.((s) => s.verb ?? s.kind ?? s) ?? null));
  }
  for (const [pw, plan] of Object.entries(plans)) for (const walls of [false, true]) {
    console.log(`replay plan(walls=${pw}) on model walls=${walls}:`, JSON.stringify(replay(plan, walls)));
  }
});
