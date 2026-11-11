// scratch (BOBIFRAME): replay a cached plan (.plan.json) on the model; per tick dump player + chasers + spinnerBodies (jsonl).
import { readFileSync, writeFileSync } from 'node:fs';
const [inp, reqs, id, out] = process.argv.slice(2);
const ROOT = '/home/user/Archipelago-CC';
const { restoreRequest } = await import(ROOT + '/scripts/procgen/seedlingSolveRequestCodec.js');
const { levelSourceFromAtlas } = await import(ROOT + '/frontend/modules/seedlingDemo/atlasSource.js');
const JR = await import(ROOT + '/frontend/modules/seedlingDemo/jsRuntimeSolver.js');
const p = JSON.parse(readFileSync(inp, 'utf8'));
let c0; for (const line of readFileSync(reqs, 'utf8').trim().split('\n')) { const row = JSON.parse(line); if (String(row.id) === id) c0 = row.requests[1].request; }
const req = restoreRequest({ ...c0, staging: p.staging });
const { source, ...tape } = req;
const run = JR.replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: levelSourceFromAtlas(source.records),
  scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
const lines = [];
const snap = (t, keys) => {
  const o = { t, keys, p: { x: run.state.x, y: run.state.y }, hits: run.playerHits.length };
  for (const f of ['chasers', 'spinnerBodies']) { try { o[f] = (run.entities(f) ?? []).map((e) => JSON.parse(JSON.stringify(e))); } catch (e) { o[f] = String(e.message).slice(0, 80); } }
  lines.push(JSON.stringify(o));
};
snap(0, []);
for (let k = 0; k < p.perTick.length; k += 1) { run.advance(new Set(p.perTick[k])); snap(k + 1, p.perTick[k]); }
writeFileSync(out, lines.join('\n') + '\n');
console.log('ticks', p.perTick.length, 'hits', JSON.stringify(run.playerHits.map((h) => ({ t: h.t, s: h.source, id: h.id }))));
