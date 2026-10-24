import { readFileSync } from 'node:fs';
const R = (process.env.REPO ?? '/home/user/Archipelago-CC') + '/frontend/modules/seedlingDemo/';
const { createRunForStaging } = await import(R + 'tapeRunner.js');
const { atlasLevelSource } = await import(R + 'levelSource.js');
const { staging, perTick } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const game = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const byT = new Map(); for (const r of game.rows) { if (!r.model) continue; (byT.get(r.t) ?? byT.set(r.t, []).get(r.t)).push(r); }
const run = createRunForStaging(staging, atlasLevelSource());
let first = null; let worst = 0; let n = 0;
for (let t = 0; t < perTick.length; t += 1) {
  run.advance(new Set(perTick[t]));
  const rows = byT.get(run.ticksCompleted) ?? [];
  const ch = new Map((run.entities('chasers') ?? []).map((c) => [c.id, c]));
  for (const r of rows) { const c = ch.get(r.model.id); n += 1;
    const d = c ? Math.max(Math.abs(c.x - r.game.x), Math.abs(c.y - r.game.y)) : 999;
    if (d > worst) worst = d; if (d > 1e-9 && first === null) first = { t: run.ticksCompleted, id: r.model.id, game: [r.game.x, r.game.y], model: c ? [c.x, c.y] : null }; }
}
console.log(JSON.stringify({ compared: n, worst, first, hits: run.ledger('playerHits').map((h) => h.t + ':' + h.id) }));
