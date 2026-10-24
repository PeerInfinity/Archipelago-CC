#!/usr/bin/env node
// APFLIP D1 — compare the witness arms (game streams) and replay the model OFF/ON on each arm's set (no browser).
// node d1-analyze.mjs <witness-dir>
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..', '..');
const DIR = process.argv[2];
const rows = readdirSync(DIR).filter((f) => f.startsWith('l32-rock-walkout-') && !f.endsWith('summary.json'))
    .map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')));
const base = rows.find((r) => r.arm === 'vanilla');
const frozenSpans = (ticks) => { const out = []; let s = null;
    for (let i = 1; i < ticks.length; i += 1) {
        const still = ticks[i].x === ticks[i - 1].x && ticks[i].y === ticks[i - 1].y;
        if (still && s === null) s = ticks[i - 1].t; if (!still && s !== null) { if (ticks[i].t - s > 40) out.push([s, ticks[i].t]); s = null; } }
    return out; };
for (const r of rows) {
    const g = r.game.ticks; const b = base.game.ticks;
    let firstDiff = null; for (let i = 0; i < Math.min(g.length, b.length); i += 1) {
        if (g[i].x !== b[i].x || g[i].y !== b[i].y || g[i].level !== b[i].level) { firstDiff = g[i].t; break; } }
    console.log(JSON.stringify({ arm: r.arm, set: r.set_id, firstDiffVsVanilla: firstDiff,
        armFrame: g.findIndex((o) => o.y < 120), longStills: frozenSpans(g).slice(0, 4),
        cleared: (r.game.persistence_cleared ?? []).filter((c) => [30, 32].includes(Number(c.level))),
        transitions: r.game.transitions, model: r.model.transitions, modelFinal: r.model.final, gameFinal: r.game.final }));
}
