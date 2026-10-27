// scratch: solve a staging (default step 67's boot, goal chest (880,816)) in node under ROOT; print verdict, hits, chaser deaths
import { readFileSync } from 'node:fs';
const D = (process.env.ROOT ?? '/home/user/Archipelago-CC') + '/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(D + 'levelSource.js');
const { parseTape } = await import(D + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(D + 'tapeRunner.js');
const { solveSegment } = await import(D + 'solverBot.js');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)));
const boot = args.boot ?? D + 'fixtures/l40bk2-witness/step67-boot.json';
const goal = JSON.parse(args.goal ?? '{"kind":"collect-placement","placement":{"x":880,"y":816}}');
const staging = solveStaging(stagingFromTape(parseTape(readFileSync(boot, 'utf8'))));
const run = createRunForStaging(staging, atlasLevelSource());
if (args.prefix) { const ks = JSON.parse(readFileSync(args.prefix, 'utf8')); for (const k of ks) run.advance(new Set(k)); console.log(`# prefix: ${ks.length} keys -> t${run.ticksCompleted} at (${run.state.x.toFixed(1)},${run.state.y.toFixed(1)})`); }
const gone = new Map();
const adv = run.advance.bind(run);
run.advance = (k) => {
  const before = new Set([...(run.entities('chasers') ?? []), ...(run.entities('spinnerBodies') ?? [])].map((c) => c.id));
  const o = adv(k);
  const after = new Set([...(run.entities('chasers') ?? []), ...(run.entities('spinnerBodies') ?? [])].map((c) => c.id));
  for (const id of before) if (!after.has(id) && !gone.has(id)) gone.set(id, run.ticksCompleted);
  return o;
};
let error = null; let res = null;
const t0 = Date.now();
try { res = solveSegment({ run, goals: [goal], name: 'l40bk2b', boot: staging.boot, dashMode: 'all', ...(args.nofork ? {} : { forkRun: () => createRunForStaging(staging, atlasLevelSource()) }) }); } catch (e) { error = e; }
console.log(`# verdict: ${error ? `${error.name}: ${String(error.message).slice(0, Number(args.len ?? 600))}` : 'SOLVED'} at t${run.ticksCompleted} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`# hits: ${run.playerHits.map((h) => `${h.t}:${h.source}:${h.id}`).join(' ') || 'none'}`);
console.log(`# removed: ${[...gone].map(([i, t]) => `${i}@t${t}`).join(' ') || 'none'}`);
console.log(`# player at end: (${run.state.x.toFixed(1)},${run.state.y.toFixed(1)}) level ${run.level ?? ''}`);
if (args.dumpPrefix && error?.perTick) { const fs = await import('node:fs'); fs.writeFileSync(args.dumpPrefix, JSON.stringify(error.perTick.map((k) => [...k]))); console.log(`# dumped ${error.perTick.length} prefix keys`); }
if (args.full && error) console.log(String(error.message));
if (args.tape && !error) { const fs = await import('node:fs'); fs.writeFileSync(args.tape, JSON.stringify(res, (k, v) => (v instanceof Set ? [...v] : v instanceof Map ? [...v] : v))); }
