// arrfight.mjs --plan=<tape> --spans='key:a-b,...' (ticks after the landing) --ticks=N --out=<tape> : L70 boot (40,24), walk down into
// the pit, then the spans. Prints the model's fight ledger summary.
import { writeFileSync, readFileSync } from 'node:fs';
const REPO = '/home/user/Archipelago-CC';
const M = `${REPO}/frontend/modules/seedlingDemo`;
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const { parseTape } = await import(`${M}/tapeFormat.js`);
const { stagingFromTape, createRunForStaging } = await import(`${M}/tapeRunner.js`);
const { buildStagedTape } = await import(`${M}/botDriverV1.js`);
const { atlasLevelSource } = await import(`${M}/levelSource.js`);
const staging = stagingFromTape(parseTape(readFileSync(arg('plan'), 'utf8')));
staging.boot = { level: 70, x: 40, y: 24 };
const run = createRunForStaging(staging, atlasLevelSource());
const perTick = [];
const spans = (arg('spans', '')).split(',').filter(Boolean).map((s) => { const [k, r] = s.split(':'); const [a, b] = r.split('-').map(Number); return { k, a, b }; });
let landed = null;
for (let i = 0; landed === null; i++) { const k = new Set(['down']); perTick.push(k); if (run.advance(k).transition) landed = perTick.length; }
const N = Number(arg('ticks', '400'));
let last = '';
for (let t = 0; t < N; t++) {
  const k = new Set(spans.filter((s) => t >= s.a && t < s.b).map((s) => s.k));
  perTick.push(k); run.advance(k);
  const F = run.entities('lightsFight')?.[0];
  const line = `L${run.state.level ?? ''} p(${run.state.x.toFixed(1)},${run.state.y.toFixed(1)}) hits ${run.damage.hits} intro ${F?.introUp} fliers ${F ? F.bodies.filter(b=>!b.removed).map(b=>b.hits).join('') : '-'}`;
  if (line !== last || t % 25 === 0) console.log(`+${t} (T${perTick.length})`, line);
  last = line;
}
const F = run.entities('lightsFight')?.[0];
const ev = (F?.events ?? []).reduce((m, e) => (m[e.what] = (m[e.what] ?? 0) + 1, m), {});
console.log('landed at', landed, 'events', JSON.stringify(ev));
const tape = buildStagedTape({ staging, perTick, name: arg('name', 'lightsarr-arrival-fight') });
writeFileSync(arg('out'), JSON.stringify(tape));
console.log('wrote', arg('out'), perTick.length);
