// MEASUREMENT-ONLY: the model's trajectory of a request's plan vs a reqwitness game JSON's samples (first divergence).
import { readFileSync } from 'node:fs';
const [file, id, i, gameJson] = process.argv.slice(2);
const R = '/home/user/Archipelago-CC';
const row0 = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => String(r.id) === String(id));
const cap = row0.requests[Number(i)].request;
const { restoreRequest } = await import(`${R}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${R}/frontend/modules/seedlingDemo/atlasSource.js`);
const { solveAnytime, replayTape } = await import(`${R}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const { passes, source, ...tape } = restoreRequest(cap);
const levelSource = levelSourceFromAtlas(source.records);
const a = solveAnytime({ ...tape, source, levelSource }, { passes });
const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource, equips: tape.equips ?? null, scratchPersistence: tape.scratchPersistence === true });
const P = tape.perTick.length; const traj = new Map(); const keys = [];
a.plan.solution.forEach((h, k) => { const s = a.plan.equipsAt?.get?.(k); if (s !== undefined) run.equipNow(s); run.advance(h); traj.set(P + k + 1, [run.level, run.state.x, run.state.y, [...h].join('+'), (run.entities('chasers') ?? []).map((c) => `${c.id.split('@')[1]}:${c.x.toFixed(0)},${c.y.toFixed(0)}${c.dying ? 'D' : ''}`).join(' ')]); });
console.log('equipsAt', JSON.stringify([...(a.plan.equipsAt ?? [])]));
const g = JSON.parse(readFileSync(gameJson, 'utf8'));
let shown = 0;
for (const [t, lv, x, y, hits] of g.samples) {
  const m = traj.get(t); if (!m) continue;
  const d = Math.hypot(m[1] - x, m[2] - y);
  if (d > 0.01 || shown < 3) { console.log(`t${t} game L${lv} (${x.toFixed(2)},${y.toFixed(2)}) model L${m[0]} (${m[1].toFixed(2)},${m[2].toFixed(2)}) d=${d.toFixed(2)} keys=${m[3]} | ${m[4]}`); shown++; }
  if (shown > 12) break;
}
