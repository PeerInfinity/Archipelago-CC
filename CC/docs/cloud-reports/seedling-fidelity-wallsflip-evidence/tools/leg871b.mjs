// leg 871: the OFF plan replayed on both models, tracking the chasers; and the ON solve's refusal tick.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
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
const FIX = JSON.parse(gunzipSync(readFileSync(M + 'fixtures/hammer-cleartag-chain/' + name)).toString('utf8'));
const withSet = (walls, fn) => withClearTagChain(true, () => withStanceBurn(true, () => withOpportunisticStrike(true,
    () => withChaserStagedHunt(true, () => withPressEscapeExact(true,
        () => withContactFidelity({ forecastShieldBump: true, chaserSpinnerWalls: walls }, fn))))));
const { passes, source, budgetWork, upgradeWindowWork, ...tape } = restoreRequest(FIX.requests[0].request);
const levelSource = levelSourceFromAtlas(source.records);
const fresh = () => replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource,
    scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
const IDS = ['bob@736,752', 'bob@736,800', 'bobsoldier@880,832'];
const snap = (run) => { const cs = run.entities('chasers') ?? []; return IDS.map((id) => { const c = cs.find((q) => q.id === id); return c ? `${c.removed ? 'X' : ''}(${c.x.toFixed(1)},${c.y.toFixed(1)})h${c.hits}` : '-'; }).join(' '); };
withL40Flip(false, () => {
  const off = withSet(false, () => settleSolve(() => solveFromTape({ ...tape, levelSource, dashMode: 'none', adds: null, fineCheckpoints: true })));
  const plan = off.plan;
  console.log('OFF plan keys:', Object.keys(plan).join(','));
  console.log('OFF plan steps:', JSON.stringify(plan.strategies ?? plan.verbs ?? plan.steps ?? plan.trace?.slice?.(0, 20) ?? null)?.slice(0, 2000));
  const tracks = {};
  for (const walls of [false, true]) withContactFidelity({ forecastShieldBump: true, chaserSpinnerWalls: walls }, () => {
    const run = fresh(); const rows = [];
    for (let k = 0; k < plan.solution.length; k += 1) {
      const slot = plan.equipsAt?.get?.(k); if (slot !== undefined) run.equipNow(slot);
      run.advance(plan.solution[k]);
      rows.push(`${k + 1}\t(${run.state.x.toFixed(1)},${run.state.y.toFixed(1)})\t${[...plan.solution[k]].join('+')}\t${snap(run)}`);
    }
    tracks[walls] = rows;
  });
  let first = null;
  for (let i = 0; i < tracks.false.length; i += 1) if (tracks.false[i] !== tracks.true[i]) { first = i; break; }
  console.log('first tick the two models differ on the OFF plan:', first === null ? 'NEVER' : first + 1);
  if (first !== null) for (let i = Math.max(0, first - 2); i < Math.min(tracks.false.length, first + 6); i += 1) console.log('OFF', tracks.false[i], '\n ON', tracks.true[i]);
  for (const t of [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1122]) console.log('OFFm', tracks.false[t - 1], '\n ONm', tracks.true[t - 1]);
  // the ON solve, with the driving run observed
  let lastTick = 0; const seen = [];
  const on = withSet(true, () => settleSolve(() => solveFromTape({ ...tape, levelSource, dashMode: 'none', adds: null, fineCheckpoints: true,
     onProgress: (p) => { seen.push(p); } })));
  console.log('ON answer keys', Object.keys(on).join(','), 'ok', on.ok);
  for (const k of Object.keys(on)) if (k !== 'message' && k !== 'plan') console.log(' ', k, JSON.stringify(on[k])?.slice(0, 600));
});
