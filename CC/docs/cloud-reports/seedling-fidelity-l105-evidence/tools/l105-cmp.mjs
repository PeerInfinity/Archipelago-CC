#!/usr/bin/env node
// L105 D1: the player in a probe's `--frames` file (the GAME, first frame per tick) vs the model replaying the same tape.
// Usage: node l105-cmp.mjs <tape.json> <frames.json>
import { readFileSync } from 'node:fs';
const M = new URL('../../../../../frontend/modules/seedlingDemo/', import.meta.url).pathname;
const { parseTape } = await import(M + 'tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await import(M + 'tapeRunner.js');
const { atlasLevelSource } = await import(M + 'levelSource.js');
const { expandInputs } = await import(M + 'tapeFormat.js').then((m) => ({ expandInputs: m.expandInputs ?? m.perTickFromTape ?? null }));
const tape = parseTape(readFileSync(process.argv[2], 'utf8'));
const frames = JSON.parse(readFileSync(process.argv[3], 'utf8')).frames;
const run = createRunForStaging(solveStaging(stagingFromTape(tape)), atlasLevelSource());
const per = Array.from({ length: tape.tick_count }, () => new Set());
for (const k of tape.inputs) for (let t = k.from; t < k.to; t += 1) per[t].add(k.key);
const model = [{ t: 0, x: run.state.x, y: run.state.y, level: run.level, hits: run.playerHits.length }];
per.forEach((h, i) => { run.advance(h); model.push({ t: i + 1, x: run.state.x, y: run.state.y, level: run.level, hits: run.playerHits.length }); });
const seen = new Map();
for (const f of frames) if (!seen.has(f.status.tick)) seen.set(f.status.tick, f);
let worst = 0; let n = 0; let first = null;
for (const [t, f] of seen) {
    const m = model[t];
    if (!m || !f.player) continue;
    if (f.status.level !== m.level) { first ??= `t${t} level game ${f.status.level} model ${m.level}`; continue; }
    const d = Math.max(Math.abs(f.player.x - m.x), Math.abs(f.player.y - m.y));
    n += 1; if (d > worst) { worst = d; } if (d > 0 && first === null) first = `t${t} game (${f.player.x},${f.player.y}) model (${m.x},${m.y})`;
}
const last = [...seen.values()].at(-1);
console.log(`player: ${n} sampled tick(s), worst |Δ| ${worst} px${first ? `; first difference ${first}` : ''}`);
console.log(`game: hits ${Math.max(...[...seen.values()].map((f) => f.status.hits ?? 0))} (max over frames), last frame t${last.status.tick} level ${last.status.level}; model: hits ${run.playerHits.length}, deaths ${run.ledger('playerDeaths').length}, level ${run.level} at t${tape.tick_count}`);
