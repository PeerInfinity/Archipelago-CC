// scratch: replay a captured request under ROOT; at the first orbitKillChaser entry, save the live prefix (perTick) and
// run an analysis of the bobsoldier fight on forks, then abort the solve.
import { readFileSync, writeFileSync } from 'node:fs';
const B = (process.env.ROOT ?? '/home/user/Archipelago-CC') + '/';
const { restoreRequest } = await import(B + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(B + 'frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES } = await import(B + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const [file, id, i, out] = process.argv.slice(2);
globalThis.__orbitHook = (run, fork, bid, perTick) => {
  const s = run.state;
  console.log(`HOOK t${run.ticksCompleted} perTick ${perTick.length} player (${s.x.toFixed(1)},${s.y.toFixed(1)}) body ${bid}`);
  for (const c of run.entities('chasers') ?? []) if (Math.hypot(c.x - s.x, c.y - s.y) < 200) console.log(`  chaser ${c.id} (${c.x.toFixed(1)},${c.y.toFixed(1)}) hits ${c.hits} spin ${c.swordSpin} spinning ${c.swordSpinning} reset ${c.swordSpinResetTimer}`);
  writeFileSync(out, JSON.stringify({ tick: run.ticksCompleted, perTick: perTick.map((k) => [...k]) }));
  throw Object.assign(new Error('HOOK-ABORT'), { hook: true });
};
for (const l of readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
  const r = JSON.parse(l);
  if (String(r.id) !== id) continue;
  const q = r.requests.find((x) => String(x.i) === i);
  const req = restoreRequest(q.request);
  const { passes = ANYTIME_PASSES, source, ...tape } = req;
  writeFileSync(out + '.tape.json', JSON.stringify({ staging: tape.staging, keys: Object.keys(tape) }));
  try { const a = solveAnytime({ ...tape, source, levelSource: levelSourceFromAtlas(source.records) }, { passes }); console.log('no hook; ok', a.ok, String(a.message).slice(0, 200)); }
  catch (e) { console.log('caught', e.message.slice(0, 200)); }
}
