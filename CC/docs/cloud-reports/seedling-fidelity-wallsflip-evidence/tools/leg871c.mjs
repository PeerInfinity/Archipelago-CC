// leg 871/872: drive solveSegment on an observed run in each arm; where do the two drives part, and where is each chaser?
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const M = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { withChaserStagedHunt, withClearTagChain, withStanceBurn, solveSegment } = await import(M + 'solverBot.js');
const { withOpportunisticStrike } = await import(M + 'pressKillCost.js');
const { withPressEscapeExact } = await import(M + 'pressEscapeExact.js');
const { withContactFidelity } = await import(M + 'contactFidelity.js');
const { restoreRequest } = await import('/home/user/Archipelago-CC/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(M + 'atlasSource.js');
const { replayTape, settleSolve, forkRunFor, solverGoalsOf } = await import(M + 'jsRuntimeSolver.js');
const { withL40Flip } = await import(M + 'l40FlipSet.js');
const name = process.argv[2] ?? 'leg871-l39-l40-request.json.gz';
const FIX = JSON.parse(gunzipSync(readFileSync(M + 'fixtures/hammer-cleartag-chain/' + name)).toString('utf8'));
const withSet = (walls, fn) => withClearTagChain(true, () => withStanceBurn(true, () => withOpportunisticStrike(true,
    () => withChaserStagedHunt(true, () => withPressEscapeExact(true,
        () => withContactFidelity({ forecastShieldBump: true, chaserSpinnerWalls: walls }, fn))))));
const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(FIX.requests[0].request);
const levelSource = levelSourceFromAtlas(source.records);
const IDS = (process.argv[3] ?? 'bob@736,752|bob@736,800|bobsoldier@880,832').split('|');
const snap = (run) => { const cs = run.entities('chasers') ?? []; return IDS.map((id) => { const c = cs.find((q) => q.id === id); return c ? `${c.removed ? 'X' : ''}(${c.x.toFixed(1)},${c.y.toFixed(1)})h${c.hits}` : '-'; }).join(' '); };
const out = {};
withL40Flip(false, () => { for (const walls of [false, true]) {
  const args = { staging: tape.staging, levelSource, scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null };
  const run = replayTape({ ...args, perTick: tape.perTick });
  const rows = []; const adv = run.advance.bind(run);
  run.advance = (k) => { const r = adv(k); rows.push(`${run.ticksCompleted}\t(${run.state.x.toFixed(1)},${run.state.y.toFixed(1)})\t${[...k].sort().join('+')}\t${snap(run)}`); return r; };
  const forkOf = forkRunFor({ ...args, prefixLength: tape.perTick.length });
  let res; let work = 0;
  try { res = withSet(walls, () => solveSegment({ run, goals: solverGoalsOf(tape.solverGoal), name: 'd', boot: tape.staging.boot, prefix: tape.perTick, dashMode: 'none', forkRun: () => forkOf(), shouldStop: () => { work += 1; return false; }, fineCheckpoints: true })); }
  catch (e) { res = { err: e }; }
  out[walls] = { rows, res, run, work };
  console.log(`walls=${walls}: ${res.err ? 'REFUSED' : 'ok'} work=${work} shadowTicks=${rows.length} runTick=${run.ticksCompleted} liveRun=${res.liveRun === undefined ? 'shadow' : 'fork@' + res.liveRun.ticksCompleted} hits=${JSON.stringify(run.playerHits.map((h) => [h.t, h.id]))}`);
  if (res.err) console.log('  first line:', String(res.err.message).split('\n')[0].slice(0, 400));
  else console.log('  trace:', JSON.stringify((res.trace?.rows ?? []).map((r) => [r.strategy?.verb, r.goal?.kind, r.note?.slice?.(0, 60)])).slice(0, 1500));
  console.log('  last row:', rows[rows.length - 1]);
} });
const a = out.false.rows, b = out.true.rows; let first = null;
for (let i = 0; i < Math.min(a.length, b.length); i += 1) { const ka = a[i].split('\t').slice(0, 3).join('\t'), kb = b[i].split('\t').slice(0, 3).join('\t'); if (ka !== kb) { first = i; break; } }
console.log('first tick the two DRIVES part (player/keys):', first === null ? `never within ${Math.min(a.length, b.length)}` : first + 1);
const lo = Math.max(0, (first ?? Math.min(a.length, b.length)) - 4);
for (let i = lo; i < Math.min(a.length, b.length, lo + 12); i += 1) console.log('OFF', a[i], '\n ON', b[i]);
console.log("--- window"); const W=(process.argv[4]??"").split("..").map(Number); if(W.length===2) for (let i=W[0]-1;i<W[1];i+=1) console.log("OFF", a[i] ?? "-", "\n ON", b[i] ?? "-");
