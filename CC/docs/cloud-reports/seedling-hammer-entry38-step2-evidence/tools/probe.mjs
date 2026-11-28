// usage: KEYS=<plan> T=<n> PROG='<ops>' node probe.mjs <jsonl> <id> <i> — replay T plan keys, then a scripted tail; print the hits. Measurement only.
// ops (space-separated): idle:N | key:K1+K2:N | walk:DIR:X (hold DIR until x passes X, cap 120) | walky:DIR:Y | press | glide:TX (idle until block tile x == TX and settled, cap 60) | sink (idle until block removed, cap 60) | equip:S | plan:A:B (plan keys A..B)
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const J = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const [,, file, id, i] = process.argv;
const leg = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === id);
const { passes, source, ...tape } = restoreRequest(leg.requests.find((r) => String(r.i) === i).request);
const levelSource = levelSourceFromAtlas(source.records);
const K = JSON.parse(readFileSync(process.env.KEYS, 'utf8'));
const run = J.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, equips: tape.equips, scratchPersistence: tape.scratchPersistence === true });
const eq = new Map(K.equipsAt);
let t = 0;
const verbose = process.env.V === '1';
const blk = () => [...run.entities('pushables').values()].find((b) => b.id?.includes?.('spear') || true);
const show = (k) => {
  const p = J.liveOf(run).row; const b = blk();
  return `${t} ${k} ${p.x.toFixed(1)},${p.y.toFixed(1)} blk=${b ? (b.removed ? 'GONE' : b.rect.x + ',' + b.rect.y) : '-'} ${(run.chasers ?? []).filter((c) => !c.removed).map((c) => `${c.id}(${c.x.toFixed(1)},${c.y.toFixed(1)})`).join(' ')}`;
};
const adv = (keys) => { const r = run.advance(new Set(keys)); t += 1; if (verbose) console.log(show(keys.join('+') || '-')); if (r.transition) { console.log('TRANSITION', t, JSON.stringify(r.transition)); } return r; };
const T = Number(process.env.T);
for (let k = 0; k < T; k++) { if (eq.has(k)) run.equipNow(eq.get(k)); adv(K.solution[k]); }
console.log('AT', show('start'));
const ops = (process.env.PROG ?? '').split(' ').filter(Boolean);
for (const op of ops) {
  const [v, a, b] = op.split(':');
  if (v === 'idle') for (let n = 0; n < +a; n++) adv([]);
  else if (v === 'key') for (let n = 0; n < +b; n++) adv(a.split('+'));
  else if (v === 'press') adv(['primary']);
  else if (v === 'equip') run.equipNow(+a);
  else if (v === 'walk') { for (let n = 0; n < 120; n++) { const x = run.state.x; if ((a === 'left' && x <= +b) || (a === 'right' && x >= +b)) break; adv([a]); } for (let n = 0; n < 60 && (run.state.vx || run.state.vy); n++) adv([]); }
  else if (v === 'walky') { for (let n = 0; n < 120; n++) { const y = run.state.y; if ((a === 'up' && y <= +b) || (a === 'down' && y >= +b)) break; adv([a]); } }
  else if (v === 'settle') { for (let n = 0; n < 60 && (run.state.vx || run.state.vy); n++) adv([]); }
  else if (v === 'glide') { for (let n = 0; n < 60; n++) { const bb = blk(); if (n > 1 && bb && !bb.removed && Math.floor(bb.rect.x / 16) === +a && bb.rect.x % 16 === 0 && run.entities('pushesSettled')) break; adv([]); } }
  else if (v === 'sink') { for (let n = 0; n < 60; n++) { const bb = blk(); if (!bb || bb.removed) break; adv([]); } }
  else if (v === 'plan') for (let k = +a; k < +b; k++) { if (eq.has(k)) run.equipNow(eq.get(k)); adv(K.solution[k]); }
  console.log('after', op, show(''));
}
const hits = (run.ledger('playerHits') ?? []);
console.log('HITS', JSON.stringify(hits.map((h) => ({ t: h.t, source: h.source, id: h.id }))), 'DEATHS', (run.ledger('playerDeaths') ?? []).map((d) => d.t ?? '?').join(',') || 0, 'END', show('end'));
