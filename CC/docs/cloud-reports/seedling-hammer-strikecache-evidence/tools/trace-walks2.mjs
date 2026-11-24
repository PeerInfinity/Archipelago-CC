// scratch: replay one captured request in-process with STRIKE_WALK_TRACE on; write one row per walkTo miss
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const R = '/home/user/Archipelago-CC';
const [file, idi, out] = process.argv.slice(2);
const [ID, I] = idi.split(':').map(Number);
const { restoreRequest } = await import(`${R}/scripts/procgen/seedlingSolveRequestCodec.js`);
const { levelSourceFromAtlas } = await import(`${R}/frontend/modules/seedlingDemo/atlasSource.js`);
const { solveAnytime, ANYTIME_PASSES } = await import(`${R}/frontend/modules/seedlingDemo/jsRuntimeSolver.js`);
const SB = await import(`${R}/frontend/modules/seedlingDemo/solverBot.js`);
let captured = null;
for (const l of readFileSync(file, 'utf8').split('\n')) { if (!l) continue; const leg = JSON.parse(l); if (leg.id !== ID) continue; captured = leg.requests.find((r) => r.i === I); break; }
const req = restoreRequest(captured.request);
const { passes = ANYTIME_PASSES, source, ...tape } = req;
const levelSource = levelSourceFromAtlas(source.records);
const h = (o) => createHash('md5').update(JSON.stringify(o)).digest('hex').slice(0, 12);
const rows = [];
const shape = (s) => { let lastMove = -1; const pos = new Set(); let presses = 0; let aimTicks = 0; const hk = [];
  for (let k = 0; k < s.length; k += 1) { pos.add(`${s[k].x},${s[k].y}`); if (k > 0 && (s[k].x !== s[k-1].x || s[k].y !== s[k-1].y)) lastMove = k;
    const h = s[k].held ? [...s[k].held].sort().join('+') : ''; hk.push(h); if (h.includes('primary')) presses += 1; }
  const tickH = s.map((x, k) => createHash('md5').update(JSON.stringify([x.x, x.y, hk[k]])).digest('hex').slice(0, 6));
  return { distinct: pos.size, lastMove, presses, keys0: hk[0], tickH }; };
SB.STRIKE_WALK_TRACE.sink = ({ run, bodyId, cell, armed, out: o }) => {
  const s = o.walk.samples;
  const motion = s.map((x) => [x.x, x.y, x.held ? [...x.held] : null]);
  const full = s.map((x) => [x.x, x.y, x.held ? [...x.held] : null, x.spinners ?? null, x.chasers ?? null, x.arrows ?? null]);
  rows.push({ t: run.ticksCompleted, body: bodyId, cell: `${cell.x},${cell.y}`, armed, start: h(run.state), n: s.length,
    trunc: o.walk.truncated?.kind ?? null, unsafeAt: o.unsafe ? s.indexOf(o.unsafe.sm) : null, motion: h(motion), full: h(full),
    strikes: o.walk.previewStrikes?.length ?? 0, x0: run.state.x, y0: run.state.y, ...shape(s) });
};
const t0 = Date.now();
const answer = solveAnytime({ ...tape, source, levelSource }, { passes });
const ms = Date.now() - t0;
writeFileSync(out, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log('ANSWER', JSON.stringify({ ok: answer.ok, kind: answer.kind, work: answer.work, ms, rows: rows.length,
  passes: (answer.passes ?? []).map((p) => [p.pass, p.kind, p.work, p.ms]) }));
