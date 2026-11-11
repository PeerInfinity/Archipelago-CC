// leg 871: the decision trace of each arm (which strategy was decided at which tick), and what the refusal carries.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { withChaserStagedHunt, withClearTagChain, withStanceBurn, solveSegment } = await import(M + 'solverBot.js');
const { withOpportunisticStrike } = await import(M + 'pressKillCost.js');
const { withPressEscapeExact } = await import(M + 'pressEscapeExact.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { restoreRequest } = await import('/home/user/Archipelago-CC/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { replayTape, forkRunFor, solverGoalsOf } = await import(M + 'jsRuntimeSolver.js');
const { withL40Flip } = await import(M + 'l40FlipSet.js');
const FIX = JSON.parse(gunzipSync(readFileSync(M + 'fixtures/hammer-cleartag-chain/leg871-l39-l40-request.json.gz')).toString('utf8'));
const withSet = (walls, fn) => withClearTagChain(true, () => withStanceBurn(true, () => withOpportunisticStrike(true,
    () => withChaserStagedHunt(true, () => withPressEscapeExact(true,
        () => withContactFidelity({ forecastShieldBump: true, chaserSpinnerWalls: walls }, fn))))));
const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(FIX.requests[0].request);
const levelSource = levelSourceFromAtlas(source.records);
withL40Flip(false, () => { for (const walls of [false, true]) {
  const args = { staging: tape.staging, levelSource, scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null };
  const run = replayTape({ ...args, perTick: tape.perTick });
  const forkOf = forkRunFor({ ...args, prefixLength: 0 });
  let res;
  try { res = withSet(walls, () => solveSegment({ run, goals: solverGoalsOf(tape.solverGoal), name: 'd', boot: tape.staging.boot, prefix: tape.perTick, dashMode: 'none', forkRun: () => forkOf() })); }
  catch (e) { res = { err: e }; }
  console.log(`\n== walls=${walls}: ${res.err ? 'REFUSED at t' + run.ticksCompleted : 'ok ' + run.ticksCompleted + ' t'}`);
  const rows = (res.trace ?? res.err?.trace)?.rows ?? null;
  if (res.err) console.log('refusal fields:', Object.keys(res.err).join(','), '| obstacle', JSON.stringify(res.err.obstacle ?? null));
  if (rows) for (const r of rows) console.log('  ', JSON.stringify({ t: r.t ?? r.tick, verb: r.strategy?.verb, target: r.strategy?.target ?? r.strategy?.id ?? null, saw: r.saw && [Math.round(r.saw.x), Math.round(r.saw.y)], note: r.note }).slice(0, 330));
  else console.log('  (no trace rows on this object)');
} });
