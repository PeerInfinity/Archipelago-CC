// arrtape.mjs --plan=<tape.json> --boot=70,x,y --walk=key:n [--gap=N] --out=<tape.json> : the plan's staging re-booted in L70,
// a walk into the pit, then (after the landing + gap idle ticks) the plan's own per-tick keys.
import { readFileSync, writeFileSync } from 'node:fs';
const REPO = '/home/user/Archipelago-CC';
const M = `${REPO}/frontend/modules/seedlingDemo`;
const arg = (k, d = null) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const { parseTape, heldKeysAt } = await import(`${M}/tapeFormat.js`);
const { stagingFromTape, createRunForStaging } = await import(`${M}/tapeRunner.js`);
const { buildStagedTape } = await import(`${M}/botDriverV1.js`);
const { atlasLevelSource } = await import(`${M}/levelSource.js`);
const plan = parseTape(readFileSync(arg('plan'), 'utf8'));
const staging = stagingFromTape(plan);
const [lv, bx, by] = arg('boot').split(',').map(Number);
staging.boot = { level: lv, x: bx, y: by };
const [wk, wn] = arg('walk').split(':');
const run = createRunForStaging(staging, atlasLevelSource());
const perTick = [];
let landed = null;
for (let i = 0; i < 200 && landed === null; i++) {
  const k = i < Number(wn) ? new Set([wk]) : new Set();
  perTick.push(k);
  const r = run.advance(k);
  if (r.transition) { landed = perTick.length; console.log('transition at', landed, JSON.stringify(r.transition), 'state', run.state.x, run.state.y, 'level', run.level ?? ''); }
}
if (landed === null) { console.log('no transition; at', run.state.x, run.state.y); process.exit(1); }
const gap = Number(arg('gap', '0'));
for (let i = 0; i < gap; i++) { perTick.push(new Set()); run.advance(new Set()); }
console.log('after gap state', run.state.x, run.state.y, 'clock', run.clock?.now?.());
for (let t = 0; t < plan.tick_count; t++) perTick.push(new Set(heldKeysAt(plan, t)));
const tape = buildStagedTape({ staging, perTick, name: arg('name', 'lightsarr-arrival') });
writeFileSync(arg('out'), JSON.stringify(tape));
console.log('wrote', arg('out'), 'ticks', perTick.length, 'plan offset', landed + gap);
