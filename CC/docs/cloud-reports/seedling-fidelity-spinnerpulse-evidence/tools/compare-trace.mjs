#!/usr/bin/env node
// wave 72 D1: the game's sampled spinner stream (witness-spinner.mjs) beside the model's (model-trace.mjs), for ONE
// spinner tracked by nearest-neighbour from its spawn. Row t of the model = after t advances; the game's sample at
// `tick` = t (wave 69's alignment for the readers). Prints the hit ticks of each side and the first divergence.
// usage: node compare-trace.mjs <game.json> <model.json> [id=spinner@224,112] [--eps=1e-6] [--show=a-b]
import { readFileSync } from 'node:fs';
const [gf, mf, id0] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d);
const id = id0 ?? 'spinner@224,112';
const g = JSON.parse(readFileSync(gf, 'utf8')); const m = JSON.parse(readFileSync(mf, 'utf8'));
const mrow = new Map(m.rows.map((r) => [r.t, r]));
const eps = Number(arg('eps', '1e-6'));
let prev = null; let first = null; const gHits = []; const mHits = []; let gGone = null; let mGone = null;
let lastG = null; let lastM = null; const out = [];
for (const s of g.whole.samples) {
    const r = mrow.get(s.tick); if (!r) continue;
    const ms = r.sp.find((x) => x.id === id) ?? null;
    let gs = null;
    const ref = prev ?? (ms ? { x: ms.x, y: ms.y } : null);
    if (ref && s.sp.length) gs = s.sp.reduce((a, b) => (Math.hypot(a.x - ref.x, a.y - ref.y) <= Math.hypot(b.x - ref.x, b.y - ref.y) ? a : b));
    if (gs && prev && Math.hypot(gs.x - prev.x, gs.y - prev.y) > 12) gs = null;
    if (gs) prev = { x: gs.x, y: gs.y };
    if (gs && lastG && gs.hits !== lastG.hits) gHits.push({ t: s.tick, hits: gs.hits });
    if (ms && lastM && ms.hits !== lastM.hits) mHits.push({ t: s.tick, hits: ms.hits });
    if (lastG && !gs && gGone === null && s.level === 39) gGone = s.tick;
    if (lastM && !ms && mGone === null) mGone = s.tick;
    if (gs) lastG = gs; if (ms) lastM = ms;
    if (gs && ms && first === null && (Math.abs(gs.x - ms.x) > eps || Math.abs(gs.y - ms.y) > eps || gs.hits !== ms.hits || gs.ht !== ms.ht))
        first = { t: s.tick, game: gs, model: ms };
    out.push({ t: s.tick, gs, ms });
}
console.log('game hits', JSON.stringify(gHits), 'gone', gGone);
console.log('model hits', JSON.stringify(mHits), 'gone', mGone);
console.log('first divergence', JSON.stringify(first));
const [a, b] = (arg('show', '') || '0-0').split('-').map(Number);
for (const o of out) if (o.t >= a && o.t <= b) console.log(o.t, 'G', o.gs && [o.gs.x, o.gs.y, o.gs.vx, o.gs.vy, o.gs.hits, o.gs.ht, o.gs.destroy, o.gs.alpha].join(' '), '| M', o.ms && [o.ms.x, o.ms.y, o.ms.hits, o.ms.ht, o.ms.d, o.ms.a].join(' '));
