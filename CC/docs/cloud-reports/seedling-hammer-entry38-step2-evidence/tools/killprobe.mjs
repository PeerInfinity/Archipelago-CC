// usage: KEYS=<plan> T=<n> node killprobe.mjs <jsonl> <id> <i> — from plan tick T (sword selected), chase a chaser and swing every P ticks; report its hits/death and the player's. Measurement only.
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
const eq = new Map(K.equipsAt);
const T = Number(process.env.T), target = process.env.TARGET ?? 'jellyfish@192,56';
const out = [];
for (const stand of [0, 4, 8, 12, 16]) for (const period of [6, 8, 12, 16]) for (const gap of [6, 10, 14]) {
  const run = J.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, equips: tape.equips, scratchPersistence: tape.scratchPersistence === true });
  for (let k = 0; k < T; k++) { if (eq.has(k)) run.equipNow(eq.get(k)); run.advance(new Set(K.solution[k])); }
  run.equipNow(0);
  const h0 = (run.ledger('playerHits') ?? []).length, d0 = (run.ledger('playerDeaths') ?? []).length;
  let killed = null;
  for (let n = 0; n < 200; n++) {
    const c = (run.chasers ?? []).find((q) => q.id === target);
    if (!c || c.removed || c.dying) { killed = n; break; }
    const keys = [];
    if (n >= stand) {
      const dx = c.x - run.state.x, dy = c.y - run.state.y;
      if (Math.abs(dx) > gap) keys.push(dx > 0 ? 'right' : 'left');
      if (Math.abs(dy) > gap) keys.push(dy > 0 ? 'down' : 'up');
      if (n % period === 0) keys.push('primary');
    }
    run.advance(new Set(keys));
  }
  const hits = (run.ledger('playerHits') ?? []).slice(h0), deaths = (run.ledger('playerDeaths') ?? []).length - d0;
  out.push({ stand, period, gap, killed, hits: hits.map((h) => `${h.source}:${h.id}@${h.t}`), deaths, at: [+run.state.x.toFixed(1), +run.state.y.toFixed(1)] });
}
for (const r of out) console.log(JSON.stringify(r));
const clean = out.filter((r) => r.killed !== null && !r.hits.length && !r.deaths);
console.log('KILLED', out.filter((r) => r.killed !== null).length, 'of', out.length, 'HITLESS KILLS', clean.length, clean.length ? 'fastest ' + Math.min(...clean.map((r) => r.killed)) + ' t' : '');
