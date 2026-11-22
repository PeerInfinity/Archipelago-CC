#!/usr/bin/env node
// rules-l112-owl-executor Q4: collect the per-seed table. For each (weapon, seed): the planner's report
// (`logs/plan-<w>-s<seed>.json`) and the GAME's verdict on its tape (every `logs/*.json` judge row whose tape is
// `owl-<w>-s<seed>.json`). Verdict: `0-hit YES` (game: finished, 0 hits, 112:0 + 112:1 cleared, ended in L113),
// `hit-only YES (n)` (killed and both cleared, n > 0 hits), `NO (game)` (the tape ran and did not kill/clear),
// `NOPLAN` (the executor found no 0-hit plan in the model — a PLANNER answer, not a game one), `UNJUDGED`.
//   node owl-seeds.mjs [--out=<owl-seeds.json>]
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const E = join(process.cwd(), 'CC/docs/cloud-reports/rules-l112-owl-executor-evidence');
const L = join(E, 'logs');
const out = (process.argv.find((a) => a.startsWith('--out=')) ?? `--out=${join(E, 'owl-seeds.json')}`).slice(6);
const judged = new Map();
for (const f of readdirSync(L).filter((n) => n.endsWith('.json') && !n.startsWith('plan-'))) {
    let rows; try { rows = JSON.parse(readFileSync(join(L, f), 'utf8')); } catch { continue; }
    if (!Array.isArray(rows)) continue;
    for (const r of rows) if (r?.tape?.startsWith('owl-')) judged.set(r.tape, { ...r, log: f });
}
const rows = [];
for (const f of readdirSync(L).filter((n) => /^plan(hits|nw|se)?-(sword|spear)-s\d+\.json$/.test(n)).sort()) {
    const p = JSON.parse(readFileSync(join(L, f), 'utf8'));
    // `planhits-*`: the `--max-hits` variant (a hit-only line), its tape `owl-<w>-s<seed>-hits.json`
    // `plannw-*`: a parallel orbit-nw run under its own names (`owl-<w>-s<seed>-nw.json`), so a sweep lane cannot clobber it
    const tape = `owl-${p.weapon}-s${p.seed}${f.startsWith('planhits') ? '-hits' : f.startsWith('plannw') ? '-nw' : f.startsWith('planse') ? '-se' : ''}.json`;
    const g = judged.get(tape);
    let verdict;
    if (!p.ok) verdict = p.budget ? 'NOPLAN (budget)' : 'NOPLAN';
    else if (!g || g.error) verdict = g?.error ? `UNJUDGED (${g.error.slice(0, 80)})` : 'UNJUDGED';
    else {
        const killed = g.cleared?.includes('112:0') && g.cleared?.includes('112:1');
        // ⚠ the status `hits` is the player's counter NOW, and entering L113 builds a new Game (it reads 0 there):
        // the hits taken are the poll's increments, so count those
        const taken = Math.max(g.hits ?? 0, ...(g.hitPolls ?? []).map((h) => h.hits), (g.hitPolls ?? []).length);
        if (killed && taken === 0 && g.end?.level === 113) verdict = '0-hit YES';
        else if (killed) verdict = `hit-only YES (${taken})${g.end?.level === 113 ? '' : `, ended in L${g.end?.level}`}`;
        else verdict = 'NO (game)';
    }
    rows.push({
        weapon: p.weapon, seed: p.seed, orbit: p.orbit, maxHits: p.maxHits ?? 0, verdict,
        plan: p.ok ? { shoves: p.shoves, lavaHits: p.model?.lava, tagTick: p.tagTick, exitFrom: p.exitFrom, ticks: p.ticks,
            rocks: p.model?.rocks, grenades: p.model?.grenades, shoveTestsLanded: `${p.model?.shovesLanded}/${p.model?.shoveTests}` }
            : { tried: p.tried, budget: !!p.budget },
        game: g ? { finished: g.finished, hitsAtEnd: g.hits, hitsTaken: Math.max(g.hits ?? 0, (g.hitPolls ?? []).length), cleared: g.cleared, end: g.end,
            hitTicksAtMost: (g.hitPolls ?? []).map((h) => h.hitTickAtMost), firstDivergence: g.firstDivergence?.t ?? null,
            judgeLog: g.log } : null,
        tape: existsSync(join(E, 'tapes', tape)) ? `tapes/${tape}` : null,
    });
}
writeFileSync(out, `${JSON.stringify({ note: 'rules-l112-owl-executor Q4 per-seed table (owl-seeds.mjs). Boot at the L111 '
    + 'arrival (112, 32, 208), rng {seed, split: true}, one weapon granted, noDamage false. A NOPLAN is the executor\'s '
    + '(no 0-hit plan found in the model); only a judged row is a game answer.', rows }, null, 1)}\n`);
for (const r of rows) console.log(`${r.weapon.padEnd(6)} s${String(r.seed).padEnd(4)} ${r.orbit?.padEnd(4)} ${r.verdict}`);
