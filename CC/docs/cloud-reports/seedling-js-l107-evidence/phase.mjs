// seedling-js-l107-investigate Q1: clock -> tower phase -> solve/refuse. Per arrival clock, the visit is stepped with
// the player standing at the landing (no beam reaches it) and tower 1's trace is read: its y offset (the bob's
// integral fixes it at the arrival clock), the band [y-19, y-15] at each of its LEFT firings while a walk is in the
// corridor (visit ticks 150..330), and whether any of them touches the planner's tile-centre box (y 120.8, 4x5,
// box y [118.8, 123.8]). The solver's verdict per clock is joined from MISCRES's seam785-i1.jsonl when given.
// Usage: node phase.mjs <seamFrom> <seamTo> [seam785-i1.jsonl]
import { readFileSync } from 'node:fs';
import { runAt } from './runapi.mjs';
const [a, b] = process.argv.slice(2, 4).map(Number);
const solver = new Map();
if (process.argv[4]) for (const l of readFileSync(process.argv[4], 'utf8').trim().split('\n')) { const r = JSON.parse(l); solver.set(r.seamTime, r.ok); }
const T1 = 'beamtower@208,120';
const BOX = { top: 118.8, bottom: 123.8 };
for (let seam = a; seam <= b; seam++) {
  const { run } = await runAt(seam);
  for (let i = 0; i < 340; i++) run.advance(new Set());
  const tr = run.beamTowerTrace.filter((r) => r.id === T1);
  const ys = tr.filter((r) => r.t >= 150 && r.t <= 330).map((r) => r.y);
  const fires = [];
  for (const r of tr) if (r.beam && r.beam.x === 0 && r.t >= 150 && r.t <= 330) {
    const last = fires.at(-1);
    if (last && r.t === last.to + 1) { last.to = r.t; last.lo = Math.min(last.lo, r.beam.y); last.hi = Math.max(last.hi, r.beam.y + r.beam.h); }
    else fires.push({ from: r.t, to: r.t, lo: r.beam.y, hi: r.beam.y + r.beam.h });
  }
  const touches = fires.filter((f) => f.lo <= BOX.bottom && f.hi >= BOX.top);
  console.log(JSON.stringify({ seam, gameTime0: run.beamTowerTrace[0]?.gameTime ?? null, y1First: +tr[0].y.toFixed(2),
    y1Min: +Math.min(...ys).toFixed(2), y1Max: +Math.max(...ys).toFixed(2),
    leftFires: fires.map((f) => `${f.from}-${f.to}:[${f.lo.toFixed(1)},${f.hi.toFixed(1)}]`).join(' '),
    plannerLaneClear: touches.length === 0, solver: solver.has(seam) ? (solver.get(seam) ? 'SOLVE' : 'refuse') : null }));
}
