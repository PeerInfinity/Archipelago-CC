// replay a captured request -> plan; run plan on fresh staging run; dump per-tick chaser/player state
import { readFileSync, writeFileSync } from 'node:fs';
const REPO = '/home/user/Archipelago-CC/';
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const { restoreRequest } = await import(REPO + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(REPO + 'frontend/modules/seedlingDemo/atlasSource.js');
const { solveAnytime, ANYTIME_PASSES, replayTape } = await import(REPO + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const line = readFileSync(arg('requests'), 'utf8').split('\n').find((l) => l && JSON.parse(l).id === Number(arg('id')));
const row = JSON.parse(line);
const req = restoreRequest(row.requests[0].request);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
let sol;
if (arg('plan', '')) sol = JSON.parse(readFileSync(arg('plan'), 'utf8'));
else {
  const a = solveAnytime({ ...tape, source, levelSource }, { passes });
  if (!a.ok) { console.log('REFUSED', a.kind, String(a.message).slice(0, 400)); process.exit(1); }
  sol = a.plan.solution.map((k) => [...k]);
  writeFileSync(arg('out', '/tmp/claude-0/w/plan') + `-${row.id}.json`, JSON.stringify(sol));
  // compare with captured
  const cap = row.requests[0].result;
  console.log('captured result keys', cap && Object.keys(cap), 'ticks cap', cap?.plan?.solution?.length ?? cap?.ticks);
}
console.log('PLAN ticks', sol.length);
const shadow = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, scratchPersistence: tape.scratchPersistence });
const lo = Number(arg('lo', '0')), hi = Number(arg('hi', '1e9'));
let prevHits = shadow.playerHits.length, prevSup = shadow.contactsSuppressed.length;
for (let i = 0; i < sol.length; i++) {
  shadow.advance(new Set(sol[i]));
  const t = i + 1;
  const ph = shadow.playerHits; const sup = shadow.contactsSuppressed;
  const newH = ph.slice(prevHits); const newS = sup.slice(prevSup);
  prevHits = ph.length; prevSup = sup.length;
  if (t >= lo && t <= hi || newH.length) {
    const s = shadow.state; const d = shadow.damage;
    const ch = (shadow.chasers ?? []).map((c) => `${c.id} (${c.x.toFixed(2)},${c.y.toFixed(2)}) v(${c.vx.toFixed(2)},${c.vy.toFixed(2)}) ht${c.hitsTimer}${c.attack ? ' ATK' : ''}`).join(' | ');
    console.log(`t${t} L${shadow.level} p(${s.x.toFixed(2)},${s.y.toFixed(2)}) keys[${sol[i].join(',')}] hits${d.hits} ht${d.hitsTimer} ${ch}${newH.length ? ' HIT ' + JSON.stringify(newH) : ''}${newS.length ? ' SUP ' + JSON.stringify(newS) : ''}`);
  }
}
console.log('END', shadow.level, shadow.state.x, shadow.state.y, 'deaths', shadow.playerDeaths.length, 'hits', shadow.playerHits.length);
