// usage: KEYS=<file> node jtrace.mjs <jsonl> <id> <i> [from] [to] [every] — replay saved plan keys; print player + chasers. Measurement only.
import { readFileSync } from 'node:fs';
const R = '/home/user/Archipelago-CC/';
const { restoreRequest } = await import(R + 'scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(R + 'frontend/modules/seedlingDemo/atlasSource.js');
const J = await import(R + 'frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const [,, file, id, i, from = 0, to = 9999, every = 5] = process.argv;
const leg = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === id);
const { passes, source, ...tape } = restoreRequest(leg.requests.find((r) => String(r.i) === i).request);
const levelSource = levelSourceFromAtlas(source.records);
const K = JSON.parse(readFileSync(process.env.KEYS, 'utf8'));
const run = J.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, equips: tape.equips, scratchPersistence: tape.scratchPersistence === true });
const eq = new Map(K.equipsAt);
console.log('start', JSON.stringify(J.liveOf(run).row), 'chasers', JSON.stringify((run.chasers ?? []).map((c) => [c.id, +c.x.toFixed(1), +c.y.toFixed(1)])));
for (const [k, held] of K.solution.entries()) {
  if (eq.has(k)) run.equipNow(eq.get(k));
  run.advance(new Set(held));
  const t = k + 1;
  if (t < +from || t > +to || (t % +every !== 0)) continue;
  const p = J.liveOf(run).row;
  console.log(t, held.join('+') || '-', p.x.toFixed(1), p.y.toFixed(1), (run.chasers ?? []).filter((c) => !c.removed).map((c) => `${c.id}(${c.x.toFixed(1)},${c.y.toFixed(1)}${c.dying ? ' dying' : ''} h${c.hits})`).join(' '));
}
